import { Application, Request, Response } from 'express';
import { sequelize } from '@bakery/api/core';
import { logger } from '@bakery/api/core';
import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message?: string;
  timestamp?: Date;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    filesystem: HealthCheckResult;
    memory: HealthCheckResult;
    environment: HealthCheckResult;
  };
}

// Get application version from package.json
function getAppVersion(): string {
  try {
    const packagePath = path.join(__dirname, '../../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Database health check
async function checkDatabase(): Promise<HealthCheckResult> {
  try {
    await sequelize.authenticate();
    await sequelize.query('SELECT 1+1 AS result');
    return { status: 'healthy' };
  } catch (error) {
    logger.error('Database health check failed', error);
    return { 
      status: 'unhealthy', 
      message: 'Database connection failed' 
    };
  }
}

// Filesystem health check
async function checkFilesystem(): Promise<HealthCheckResult> {
  try {
    const testDir = path.join(__dirname, '../../../../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Try to write and read a test file
    const testFile = path.join(testDir, 'health-check.tmp');
    const testData = `Health check at ${new Date().toISOString()}`;
    
    fs.writeFileSync(testFile, testData);
    const readData = fs.readFileSync(testFile, 'utf8');
    fs.unlinkSync(testFile);
    
    if (readData !== testData) {
      throw new Error('File read/write mismatch');
    }
    
    return { status: 'healthy' };
  } catch (error) {
    logger.error('Filesystem health check failed', error);
    return { 
      status: 'unhealthy', 
      message: 'Filesystem access failed' 
    };
  }
}

// Memory health check
async function checkMemory(): Promise<HealthCheckResult> {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;
  
  if (usagePercent > 90) {
    return { 
      status: 'unhealthy', 
      message: `High memory usage: ${usagePercent.toFixed(2)}%` 
    };
  }
  
  return { status: 'healthy' };
}

// Environment health check
async function checkEnvironment(): Promise<HealthCheckResult> {
  const requiredEnvVars = [
    'NODE_ENV',
    'DATABASE_PATH',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    return { 
      status: 'unhealthy', 
      message: `Missing environment variables: ${missingVars.join(', ')}` 
    };
  }
  
  return { status: 'healthy' };
}

// Main health check function
async function performHealthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(),
    filesystem: await checkFilesystem(),
    memory: await checkMemory(),
    environment: await checkEnvironment()
  };
  
  // Determine overall status
  const unhealthyChecks = Object.values(checks).filter(check => check.status === 'unhealthy');
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  
  if (unhealthyChecks.length === 0) {
    overallStatus = 'healthy';
  } else if (unhealthyChecks.length === 1) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date(),
    version: getAppVersion(),
    uptime: process.uptime(),
    checks
  };
}

// Setup health check endpoints
export function setupHealthEndpoints(app: Application) {
  // Liveness probe - basic check if the service is running
  app.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date()
    });
  });
  
  // Readiness probe - comprehensive health check
  app.get('/health/ready', async (req: Request, res: Response) => {
    try {
      const health = await performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check error', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  });
  
  // Detailed health check
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check error', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  });
  
  logger.info('Health check endpoints configured at /health, /health/live, /health/ready');
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any) {
  let isShuttingDown = false;
  
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    
    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connections
    try {
      await sequelize.close();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', error);
    }
    
    // Allow existing connections to complete (max 30 seconds)
    setTimeout(() => {
      logger.info('Forcing shutdown after timeout');
      process.exit(0);
    }, 30000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}