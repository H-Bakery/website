// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import * as http from 'http';
import swaggerUi from 'swagger-ui-express';

// Import from domain libraries
import { logger, testConnection, sequelize, syncDatabase } from '@bakery/api/core';
import { orderRoutes } from '@bakery/api/orders';
import { inventoryRoutes } from '@bakery/api/inventory';
import { customerRoutes } from '@bakery/api/customers';
import { productionRoutes } from '@bakery/api/production';
import { notificationRoutes } from '@bakery/api/notifications';

// Import monitoring
import { setupMonitoring, recordOrder, updateInventoryMetrics, recordAuthAttempt } from './monitoring';

// Import local services and middleware
import { initializeModels } from './models';
import { socketService } from './services/socket.service';
import { apiLimiter, publicLimiter } from './middleware/rate-limit.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';
import { swaggerSpec } from './config/swagger.config';

// Import local routes that haven't been migrated yet
import authRoutes from './routes/auth.routes';
import cashRoutes from './routes/cash.routes';
import chatRoutes from './routes/chat.routes';
import dashboardRoutes from './routes/dashboard.routes';
import bakingListRoutes from './routes/baking-list.routes';
import productRoutes from './routes/product.routes';
import unsoldProductRoutes from './routes/unsold-product.routes';
import recipeRoutes from './routes/recipe.routes';
import staffRoutes from './routes/staff.routes';
import workflowRoutes from './routes/workflow.routes';
import preferencesRoutes from './routes/preferences.routes';
import templateRoutes from './routes/template.routes';
import emailRoutes from './routes/email.routes';

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  logger.error('CRITICAL: JWT_SECRET environment variable is not set!');
  logger.error('Please set JWT_SECRET in your .env file');
  process.exit(1);
}

// Security check for JWT secret strength
if (process.env.JWT_SECRET.length < 32) {
  logger.warn('WARNING: JWT_SECRET should be at least 32 characters long for security');
}

if (
  process.env.JWT_SECRET.includes('CHANGE-THIS') ||
  process.env.JWT_SECRET === 'your-very-secure-jwt-secret-key-change-this-in-production-minimum-32-chars'
) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Using default JWT_SECRET in production is not allowed!');
    process.exit(1);
  } else {
    logger.warn('WARNING: Using default JWT_SECRET. Please change this before deploying to production!');
  }
}

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Configure security middleware (helmet should be first)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws://localhost:*', 'wss://localhost:*'],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for development
  })
);

// Configure middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(loggerMiddleware);

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Apply public rate limiting to non-API routes
app.use('/products', publicLimiter);
app.use('/recipes', publicLimiter);

// API Documentation with Swagger UI
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bakery Management API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
  })
);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Initialize database
logger.info('Initializing application...');

async function initializeApp() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Sync database models
    await syncDatabase();
    
    // Initialize models
    await initializeModels(sequelize);

    // Run seeders in development
    if (process.env.NODE_ENV !== 'production') {
      const { runSeeders } = await import('./seeders');
      await runSeeders();
    }

    // Initialize services
    initializeServices();
    
    // Register routes
    registerRoutes();

    // Error handling middleware
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled application error:', err);
      res.status(500).json({ 
        success: false,
        error: 'An unexpected error occurred',
        ...(process.env.NODE_ENV !== 'production' && { details: err.message })
      });
    });

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket
    socketService.initialize(server);

    // Setup monitoring and observability
    setupMonitoring(app, server, {
      enableTracing: process.env['ENABLE_TRACING'] === 'true',
      enableMetrics: true,
      enableHealthChecks: true,
      enableRequestLogging: true,
      enableAlerts: process.env['NODE_ENV'] === 'production'
    });

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`Metrics available at http://localhost:${PORT}/metrics`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logRoutes();
    });

    // Graceful shutdown is now handled by monitoring module
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      await sequelize.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

function initializeServices() {
  // Initialize notification archival service
  if (process.env.ARCHIVAL_ENABLED !== 'false') {
    const { notificationArchivalService } = require('./services/notification-archival.service');
    notificationArchivalService.initialize({
      enabled: true,
      autoArchiveAfterDays: parseInt(process.env.ARCHIVAL_DAYS || '30'),
      permanentDeleteAfterDays: parseInt(process.env.CLEANUP_DAYS || '90'),
    });
    logger.info('Notification archival service initialized');
  }
}

function registerRoutes() {
  // Auth routes (not yet migrated)
  app.use('/api/auth', authRoutes);

  // Domain library routes
  app.use('/api/orders', orderRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/production', productionRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Local routes (not yet migrated)
  app.use('/api/cash', cashRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/baking-list', bakingListRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/unsold-products', unsoldProductRoutes);
  app.use('/api/recipes', recipeRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/preferences', preferencesRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/email', emailRoutes);

  // Catch-all route
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.originalUrl,
    });
  });
}

function logRoutes() {
  logger.info('Available routes:');
  logger.info('  Health Check:');
  logger.info('    GET /health - Application health check');
  
  logger.info('  Authentication:');
  logger.info('    POST /api/auth/register - Register a new user');
  logger.info('    POST /api/auth/login - Login a user');
  logger.info('    POST /api/auth/logout - Logout a user');
  logger.info('    POST /api/auth/refresh - Refresh access token');
  
  logger.info('  Orders:');
  logger.info('    GET /api/orders - Get all orders (authenticated)');
  logger.info('    POST /api/orders - Create new order (authenticated)');
  logger.info('    GET /api/orders/:id - Get order by ID (authenticated)');
  logger.info('    PUT /api/orders/:id - Update order (authenticated)');
  logger.info('    DELETE /api/orders/:id - Delete order (authenticated)');
  
  logger.info('  Inventory:');
  logger.info('    GET /api/inventory - Get all inventory items (authenticated)');
  logger.info('    POST /api/inventory - Create inventory item (authenticated)');
  logger.info('    GET /api/inventory/:id - Get inventory item (authenticated)');
  logger.info('    PUT /api/inventory/:id - Update inventory item (authenticated)');
  logger.info('    DELETE /api/inventory/:id - Delete inventory item (authenticated)');
  logger.info('    PATCH /api/inventory/:id/stock - Adjust stock level (authenticated)');
  
  logger.info('  Production:');
  logger.info('    GET /api/production/schedules - Get production schedules (authenticated)');
  logger.info('    POST /api/production/schedules - Create production schedule (authenticated)');
  logger.info('    GET /api/production/batches - Get production batches (authenticated)');
  logger.info('    POST /api/production/batches - Create production batch (authenticated)');
  
  logger.info('  Notifications:');
  logger.info('    GET /api/notifications - Get user notifications (authenticated)');
  logger.info('    POST /api/notifications - Create notification (admin only)');
  logger.info('    PUT /api/notifications/:id/read - Mark as read (authenticated)');
  logger.info('    DELETE /api/notifications/:id - Delete notification (authenticated)');
  
  logger.info('  And more... Check /api-docs for full documentation');
}

// Start the application
initializeApp();