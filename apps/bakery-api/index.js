// Load environment variables first
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { testConnection } = require("./config/database");
const { initializeDatabaseWithMigrations } = require("./models");
const logger = require("./utils/logger");
const loggerMiddleware = require("./middleware/loggerMiddleware");
const socketService = require("./services/socketService");
const { apiLimiter, publicLimiter } = require("./middleware/rateLimitMiddleware");

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  logger.error("CRITICAL: JWT_SECRET environment variable is not set!");
  logger.error("Please set JWT_SECRET in your .env file");
  process.exit(1);
}

// Security check for JWT secret strength
if (process.env.JWT_SECRET.length < 32) {
  logger.warn("WARNING: JWT_SECRET should be at least 32 characters long for security");
}

if (process.env.JWT_SECRET.includes("CHANGE-THIS") || 
    process.env.JWT_SECRET === "your-very-secure-jwt-secret-key-change-this-in-production-minimum-32-chars") {
  if (process.env.NODE_ENV === "production") {
    logger.error("CRITICAL: Using default JWT_SECRET in production is not allowed!");
    process.exit(1);
  } else {
    logger.warn("WARNING: Using default JWT_SECRET. Please change this before deploying to production!");
  }
}

// Import routes
const authRoutes = require("./routes/authRoutes");
const cashRoutes = require("./routes/cashRoutes");
const chatRoutes = require("./routes/chatRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const orderRoutes = require("./routes/orderRoutes");
const bakingListRoutes = require("./routes/bakingListRoutes");
const productRoutes = require("./routes/productRoutes");
const unsoldProductRoutes = require("./routes/unsoldProductRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const staffRoutes = require("./routes/staffRoutes");
const workflowRoutes = require("./routes/workflowRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const notificationArchiveRoutes = require("./routes/notificationArchiveRoutes");
const notificationArchivalRoutes = require("./routes/notificationArchivalRoutes");
const preferencesRoutes = require("./routes/preferencesRoutes");
const templateRoutes = require("./routes/templateRoutes");
const emailRoutes = require("./routes/emailRoutes");
const productionRoutes = require("./routes/productionRoutes");

// Swagger documentation setup
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./config/swagger.config');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure security middleware (helmet should be first)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding for development
}));

// Configure middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(bodyParser.json());
app.use(loggerMiddleware);

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// Apply public rate limiting to non-API routes
app.use("/products", publicLimiter);
app.use("/recipes", publicLimiter);

// API Documentation with Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Bakery Management API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
}));

// Initialize database
logger.info("Initializing application...");
testConnection().then(async (connected) => {
  if (connected) {
    await initializeDatabaseWithMigrations();
    
    // Seed users first
    const userSeeder = require("./seeders/userSeeder");
    await userSeeder
      .seed()
      .catch((err) => logger.error("Error in user seeder:", err));
    
    // Then seed products
    const productSeeder = require("./seeders/productSeeder");
    await productSeeder
      .seed()
      .catch((err) => logger.error("Error in product seeder:", err));
    
    // Then seed notifications
    const notificationSeeder = require("./seeders/notificationSeeder");
    await notificationSeeder
      .seed()
      .catch((err) => logger.error("Error in notification seeder:", err));
    
    // Then seed notification templates
    const templateSeeder = require("./seeders/templateSeeder");
    await templateSeeder
      .seed()
      .catch((err) => logger.error("Error in template seeder:", err));
    
    // Initialize notification archival service
    const notificationArchivalService = require("./services/notificationArchivalService");
    notificationArchivalService.initialize({
      // Custom policies can be set here or via API
      enabled: process.env.ARCHIVAL_ENABLED !== 'false', // Default enabled unless explicitly disabled
      autoArchiveAfterDays: parseInt(process.env.ARCHIVAL_DAYS) || 30,
      permanentDeleteAfterDays: parseInt(process.env.CLEANUP_DAYS) || 90,
    });
    logger.info("Notification archival service initialized");
  } else {
    logger.error("Failed to connect to database. Exiting...");
    process.exit(1);
  }
});

// Register routes
app.use("/api/auth", authRoutes);
app.use("/cash", cashRoutes);
app.use("/chat", chatRoutes);
app.use("/dashboard", dashboardRoutes);

// Admin routes
app.use("/orders", orderRoutes);
app.use("/baking-list", bakingListRoutes);
app.use("/products", productRoutes);
app.use("/unsold-products", unsoldProductRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notifications/archive", notificationArchiveRoutes);
app.use("/api/notifications/archival", notificationArchivalRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/production", productionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled application error:", err);
  res.status(500).json({ error: "An unexpected error occurred" });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket
socketService.initialize(server);

// Starting the server
server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  logger.info("Available routes:");
  logger.info("  POST /api/auth/register - Register a new user");
  logger.info("  POST /api/auth/login - Login a user");
  logger.info("  POST /cash - Add a cash entry (authenticated)");
  logger.info("  GET /cash - Get cash entries (authenticated)");
  logger.info("  PUT /cash/:id - Update a cash entry (authenticated)");
  logger.info("  DELETE /cash/:id - Delete a cash entry (authenticated)");
  logger.info("  GET /chat - Get all chat messages (authenticated)");
  logger.info("  POST /chat - Post a new chat message (authenticated)");
  logger.info("  GET /dashboard/sales-summary - Get sales analytics (authenticated)");
  logger.info("  GET /dashboard/production-overview - Get production analytics (authenticated)");
  logger.info("  GET /dashboard/revenue-analytics - Get revenue analytics (authenticated)");
  logger.info("  GET /dashboard/order-analytics - Get order analytics (authenticated)");
  logger.info("  GET /dashboard/product-performance - Get product performance (authenticated)");
  logger.info("  GET /dashboard/daily-metrics - Get daily metrics (authenticated)");
  logger.info("  GET /api/recipes - Get all recipes");
  logger.info("  GET /api/recipes/:slug - Get recipe by slug");
  logger.info("  POST /api/recipes - Create new recipe (authenticated)");
  logger.info("  PUT /api/recipes/:slug - Update recipe (authenticated)");
  logger.info("  DELETE /api/recipes/:slug - Delete recipe (authenticated)");
  logger.info("  GET /api/staff - Get all staff members (admin only)");
  logger.info("  GET /api/staff/:id - Get staff member by ID (admin only)");
  logger.info("  POST /api/staff - Create new staff member (admin only)");
  logger.info("  PUT /api/staff/:id - Update staff member (admin only)");
  logger.info("  DELETE /api/staff/:id - Delete staff member (admin only)");
  logger.info("  GET /api/workflows - Get all workflows");
  logger.info("  GET /api/workflows/:workflowId - Get workflow by ID");
  logger.info("  GET /api/workflows/categories - Get workflow categories");
  logger.info("  GET /api/workflows/stats - Get workflow statistics");
  logger.info("  POST /api/workflows/validate - Validate workflow structure (authenticated)");
  logger.info("  POST /api/inventory - Create new inventory item (authenticated)");
  logger.info("  GET /api/inventory - Get all inventory items (authenticated)");
  logger.info("  GET /api/inventory/:id - Get inventory item by ID (authenticated)");
  logger.info("  PUT /api/inventory/:id - Update inventory item (authenticated)");
  logger.info("  DELETE /api/inventory/:id - Delete inventory item (authenticated)");
  logger.info("  PATCH /api/inventory/:id/stock - Adjust stock level (authenticated)");
  logger.info("  GET /api/inventory/low-stock - Get low stock items (authenticated)");
  logger.info("  GET /api/inventory/needs-reorder - Get items needing reorder (authenticated)");
  logger.info("  POST /api/inventory/bulk-adjust - Bulk adjust stock levels (authenticated)");
  logger.info("  GET /api/notifications - Get all notifications for user (authenticated)");
  logger.info("  GET /api/notifications/:id - Get single notification (authenticated)");
  logger.info("  POST /api/notifications - Create notification (admin only)");
  logger.info("  PUT /api/notifications/:id/read - Mark notification as read (authenticated)");
  logger.info("  PUT /api/notifications/read-all - Mark all notifications as read (authenticated)");
  logger.info("  DELETE /api/notifications/:id - Delete notification (authenticated)");
  logger.info("  POST /api/notifications/bulk - Bulk create notifications (admin only)");
  logger.info("  GET /api/preferences - Get user notification preferences (authenticated)");
  logger.info("  PUT /api/preferences - Update notification preferences (authenticated)");
  logger.info("  POST /api/preferences/reset - Reset preferences to defaults (authenticated)");
  logger.info("  GET /api/templates - Get all notification templates (authenticated)");
  logger.info("  GET /api/templates/:key - Get template by key (authenticated)");
  logger.info("  POST /api/templates/:key/preview - Preview template with variables (authenticated)");
  logger.info("  POST /api/templates - Create template (admin only)");
  logger.info("  PUT /api/templates/:key - Update template (admin only)");
  logger.info("  DELETE /api/templates/:key - Delete template (admin only)");
  logger.info("  GET /api/production/schedules - Get production schedules (authenticated)");
  logger.info("  POST /api/production/schedules - Create production schedule (authenticated)");
  logger.info("  PUT /api/production/schedules/:id - Update production schedule (authenticated)");
  logger.info("  GET /api/production/batches - Get production batches (authenticated)");
  logger.info("  POST /api/production/batches - Create production batch (authenticated)");
  logger.info("  POST /api/production/batches/:id/start - Start production batch (authenticated)");
  logger.info("  GET /api/production/batches/:batchId/steps - Get batch steps (authenticated)");
  logger.info("  PUT /api/production/steps/:id - Update production step (authenticated)");
  logger.info("  POST /api/production/steps/:id/complete - Complete production step (authenticated)");
  logger.info("  GET /api/production/analytics - Get production analytics (authenticated)");
});
