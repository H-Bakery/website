import winston from 'winston';
import { Application, Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create winston logger instance
export const winstonLogger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'bakery-api',
    environment: process.env['NODE_ENV'] || 'development'
  },
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add production transports
if (process.env['NODE_ENV'] === 'production') {
  // Daily rotate file transport
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  winstonLogger.add(new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
  }));
}

// Request logging middleware
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  winstonLogger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.headers['x-request-id'] || 'no-request-id',
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    winstonLogger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      requestId: req.headers['x-request-id'] || 'no-request-id',
    });
    
    // Log slow requests
    if (duration > 1000) {
      winstonLogger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
      });
    }
  });
  
  next();
}

// Error logging middleware
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  winstonLogger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      headers: req.headers,
    },
  });
  
  next(err);
}

// Structured logging utilities
export function logBusinessEvent(event: string, data: any) {
  winstonLogger.info('Business event', {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function logSecurityEvent(event: string, data: any) {
  winstonLogger.warn('Security event', {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function logPerformanceMetric(metric: string, value: number, unit: string, metadata?: any) {
  winstonLogger.info('Performance metric', {
    metric,
    value,
    unit,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

// Log rotation and cleanup
export function setupLogRotation() {
  // Clean up old log files (older than 30 days)
  setInterval(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    fs.readdir(logsDir, (err, files) => {
      if (err) {
        winstonLogger.error('Error reading logs directory', err);
        return;
      }
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          
          if (stats.mtime.getTime() < thirtyDaysAgo && file.endsWith('.log')) {
            fs.unlink(filePath, (err) => {
              if (err) {
                winstonLogger.error(`Error deleting old log file ${file}`, err);
              } else {
                winstonLogger.info(`Deleted old log file ${file}`);
              }
            });
          }
        });
      });
    });
  }, 24 * 60 * 60 * 1000); // Run daily
}

// Export logger instance
export { winstonLogger as logger };