import { Request, Response, NextFunction } from 'express'
// Temporary local logger until utils library is properly configured
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

export interface RequestWithTimestamp extends Request {
  timestamp?: number
}

export function loggerMiddleware(
  req: RequestWithTimestamp,
  res: Response,
  next: NextFunction
): void {
  req.timestamp = Date.now()

  // Log request
  logger.info(
    `${req.method} ${req.path} - ${req.ip} - ${
      req.headers['user-agent'] || 'Unknown User Agent'
    }`
  )

  // Log response when finished
  res.on('finish', () => {
    const duration = req.timestamp ? Date.now() - req.timestamp : 0
    const message = `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`

    if (res.statusCode >= 400) {
      logger.error(message)
    } else {
      logger.info(message)
    }
  })

  next()
}
