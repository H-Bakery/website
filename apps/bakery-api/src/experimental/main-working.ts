// Main application entry point with migrated domains only
import * as dotenv from 'dotenv'
dotenv.config()

import express, { Application, Request, Response } from 'express'
import * as bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import * as http from 'http'

// Import only the successfully migrated domain routes
import { authRoutes } from '@bakery/api/auth'
import { bakingListRoutes } from '@bakery/api/baking-list'
import { cashRoutes } from '@bakery/api/cash'
import { deliveryRoutes } from '@bakery/api/delivery'
import { emailRoutes } from '@bakery/api/email'
import { preferencesRoutes } from '@bakery/api/preferences'
import { productsRoutes } from '@bakery/api/products'
import { recipesRoutes } from '@bakery/api/recipes'
import { templatesRoutes } from '@bakery/api/templates'
import { unsoldProductsRoutes } from '@bakery/api/unsold-products'

// Import database connection
import { initializeDatabase } from '@bakery/api/database'

// Temporary local logger until we fix utils
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

const app: Application = express()
const PORT = process.env['PORT'] || 5000

// Configure middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`)
  next()
})

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    version: '1.0.0',
  })
})

// Base API endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Bakery API - TypeScript Migration',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api',
      '/api/auth',
      '/api/baking-list',
      '/api/cash',
      '/api/delivery',
      '/api/email',
      '/api/preferences',
      '/api/products',
      '/api/recipes',
      '/api/templates',
      '/api/unsold-products',
    ],
  })
})

// Mount successfully migrated domain routes
app.use('/api/auth', authRoutes)
app.use('/api/baking-list', bakingListRoutes)
app.use('/api/cash', cashRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/preferences', preferencesRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/recipes', recipesRoutes)
app.use('/api/templates', templatesRoutes)
app.use('/api/unsold-products', unsoldProductsRoutes)

// TODO: Add these routes once domains are migrated
// app.use('/api/orders', orderRoutes);
// app.use('/api/inventory', inventoryRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/production', productionRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/staff', staffRoutes);
// app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/chat', chatRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  })
})

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    ...(process.env['NODE_ENV'] !== 'production' && { details: err.message }),
  })
})

// Create HTTP server
const server = http.createServer(app)

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    logger.info('Initializing database...')
    await initializeDatabase()
    logger.info('Database initialized successfully')

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`)
      logger.info(`📋 Environment: ${process.env['NODE_ENV'] || 'development'}`)
      logger.info(`🔗 API Documentation: http://localhost:${PORT}/api`)
      logger.info('✅ Successfully migrated domains:')
      logger.info('  - Auth')
      logger.info('  - Baking List')
      logger.info('  - Cash')
      logger.info('  - Delivery')
      logger.info('  - Email')
      logger.info('  - Preferences')
      logger.info('  - Products')
      logger.info('  - Recipes')
      logger.info('  - Templates')
      logger.info('  - Unsold Products')
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
  })
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
  })
  process.exit(0)
})

// Start the server
startServer()

export { app }
