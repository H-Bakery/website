const express = require('express')
const router = express.Router()
const { sequelize } = require('../config/database')
const logger = require('../utils/logger')
const fs = require('fs')
const path = require('path')

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Comprehensive health check
 *     description: Performs comprehensive health checks on database, filesystem, memory, and environment. Used for monitoring and alerting.
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: Service is healthy or degraded but operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   description: Overall health status
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Time of health check
 *                   example: '2025-08-15T10:30:00.000Z'
 *                 version:
 *                   type: string
 *                   description: Application version
 *                   example: '1.0.0'
 *                 uptime:
 *                   type: number
 *                   description: Application uptime in seconds
 *                   example: 3600
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     filesystem:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     memory:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     environment:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *       '503':
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [unhealthy]
 *                   example: unhealthy
 *                 error:
 *                   type: string
 *                   example: 'Health check failed'
 */

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Basic check to verify the service is running. Used by Kubernetes liveness probe.
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok]
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2025-08-15T10:30:00.000Z'
 */

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Comprehensive check to verify the service is ready to accept traffic. Used by Kubernetes readiness probe.
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: Service is ready to accept traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                   description: Service is operational even if degraded
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2025-08-15T10:30:00.000Z'
 *                 version:
 *                   type: string
 *                   example: '1.0.0'
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     filesystem:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     memory:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     environment:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *       '503':
 *         description: Service is not ready to accept traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [unhealthy]
 *                   example: unhealthy
 *                 error:
 *                   type: string
 *                   example: 'Service not ready'
 */

// Get application version from package.json
function getAppVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return packageJson.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

// Database health check
async function checkDatabase() {
  try {
    await sequelize.authenticate()
    await sequelize.query('SELECT 1+1 AS result')
    return { status: 'healthy' }
  } catch (error) {
    logger.error('Database health check failed', error)
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
    }
  }
}

// Filesystem health check
async function checkFilesystem() {
  try {
    const testDir = path.join(__dirname, '../temp')

    // Ensure temp directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }

    // Try to write and read a test file
    const testFile = path.join(testDir, 'health-check.tmp')
    const testData = `Health check at ${new Date().toISOString()}`

    fs.writeFileSync(testFile, testData)
    const readData = fs.readFileSync(testFile, 'utf8')
    fs.unlinkSync(testFile)

    if (readData !== testData) {
      throw new Error('File read/write mismatch')
    }

    return { status: 'healthy' }
  } catch (error) {
    logger.error('Filesystem health check failed', error)
    return {
      status: 'unhealthy',
      message: 'Filesystem access failed',
    }
  }
}

// Memory health check
async function checkMemory() {
  const memUsage = process.memoryUsage()
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024
  const usagePercent = (heapUsedMB / heapTotalMB) * 100

  if (usagePercent > 90) {
    return {
      status: 'unhealthy',
      message: `High memory usage: ${usagePercent.toFixed(2)}%`,
    }
  }

  return { status: 'healthy' }
}

// Environment health check
async function checkEnvironment() {
  const requiredEnvVars = ['NODE_ENV', 'DATABASE_PATH', 'JWT_SECRET']

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    return {
      status: 'unhealthy',
      message: `Missing environment variables: ${missingVars.join(', ')}`,
    }
  }

  return { status: 'healthy' }
}

// Main health check function
async function performHealthCheck() {
  const checks = {
    database: await checkDatabase(),
    filesystem: await checkFilesystem(),
    memory: await checkMemory(),
    environment: await checkEnvironment(),
  }

  // Determine overall status
  const unhealthyChecks = Object.values(checks).filter(
    (check) => check.status === 'unhealthy'
  )
  let overallStatus

  if (unhealthyChecks.length === 0) {
    overallStatus = 'healthy'
  } else if (unhealthyChecks.length === 1) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'unhealthy'
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    version: getAppVersion(),
    uptime: process.uptime(),
    checks,
  }
}

// Liveness probe - basic check if the service is running
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
  })
})

// Readiness probe - comprehensive health check
router.get('/ready', async (req, res) => {
  try {
    const health = await performHealthCheck()
    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
        ? 200
        : 503

    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check error', error)
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
    })
  }
})

// Detailed health check
router.get('/', async (req, res) => {
  try {
    const health = await performHealthCheck()
    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
        ? 200
        : 503

    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check error', error)
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
    })
  }
})

module.exports = router
