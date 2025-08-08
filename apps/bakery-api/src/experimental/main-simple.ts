// Simplified main application entry point
import * as dotenv from 'dotenv'
dotenv.config()

import express, { Application, Request, Response } from 'express'
import * as bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import * as http from 'http'

// Import database connection
import { initializeDatabase } from '@bakery/api/database'

// Temporary local logger
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
    message: 'Bakery API - TypeScript Migration (Simplified)',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api',
      '// Note: Domain routes will be added as libraries are fixed',
    ],
  })
})

// TODO: Add domain routes once exports are fixed
// Current issues:
// - Need to create route factories for all domains
// - Need to fix export names to be consistent
// - Need to pass proper dependencies to route factories

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
      logger.info('')
      logger.info('📌 Backend Migration Status:')
      logger.info('✅ Migrated to TypeScript:')
      logger.info('  - Database connection')
      logger.info('  - All domain models')
      logger.info('  - All domain services')
      logger.info('  - All domain controllers')
      logger.info('')
      logger.info('⚠️  Pending fixes:')
      logger.info('  - Route factory patterns need standardization')
      logger.info('  - Export names need consistency')
      logger.info('  - Dependency injection for routes')
      logger.info('')
      logger.info(
        '✅ Successfully migrated domains (models/services/controllers):'
      )
      logger.info('  - Auth, Baking List, Cash, Delivery, Email')
      logger.info('  - Preferences, Products, Recipes, Templates')
      logger.info('  - Unsold Products, Import Service, WebSocket')
      logger.info('')
      logger.info('📝 TODO: Create missing domains:')
      logger.info('  - Orders, Inventory, Customers, Production')
      logger.info('  - Notifications, Staff, Dashboard, Chat')
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
