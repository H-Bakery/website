// Minimal main.ts to test basic build
import * as dotenv from 'dotenv'
dotenv.config()

import express, { Application, Request, Response } from 'express'
import * as bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import * as http from 'http'

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
const PORT = process.env.PORT || 5000

// Configure middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// Basic routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Bakery API - Minimal Build',
    version: '0.0.1',
    endpoints: [
      '/health',
      '/api',
      // List other endpoints as they are added
    ],
  })
})

// Error handling
app.use((err: Error, req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
    ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
  })
})

// Create HTTP server
const server = http.createServer(app)

// Start server
server.listen(PORT, () => {
  logger.info(`Minimal server running on http://localhost:${PORT}`)
  logger.info(`Health check available at http://localhost:${PORT}/health`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
  })
  process.exit(0)
})

export { app }
