import { Request, Response, NextFunction } from 'express';
import { logger } from '@bakery/api/core';

export interface RequestWithTimestamp extends Request {
  timestamp?: number;
}

export function loggerMiddleware(
  req: RequestWithTimestamp,
  res: Response,
  next: NextFunction
): void {
  req.timestamp = Date.now();
  
  // Log request
  logger.info(
    `${req.method} ${req.path} - ${req.ip} - ${
      req.headers['user-agent'] || 'Unknown User Agent'
    }`
  );

  // Log response when finished
  res.on('finish', () => {
    const duration = req.timestamp ? Date.now() - req.timestamp : 0;
    const message = `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      logger.error(message);
    } else {
      logger.info(message);
    }
  });

  next();
}