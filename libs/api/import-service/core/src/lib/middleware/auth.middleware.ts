import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  user?: any;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  logger.info('Authenticating request...');
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    logger.info('Authentication failed: No authorization header provided');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  if (!token) {
    logger.info('Authentication failed: No token provided');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const jwtSecret = process.env['JWT_SECRET'] || 'default-secret-key';

  jwt.verify(token, jwtSecret, async (err: any, decoded: any) => {
    if (err) {
      logger.error('Authentication failed: Invalid token', err);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    try {
      // For now, we'll skip user lookup and just set the decoded values
      // In a real implementation, you would fetch the user from the database
      req.userId = decoded.id;
      req.userRole = decoded.role || 'user';
      req.user = { id: decoded.id, role: decoded.role };
      
      logger.info(`Authentication successful for user ID: ${req.userId} with role: ${req.userRole}`);
      next();
    } catch (error) {
      logger.error('Error during authentication:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }
  });
};

// Middleware to require admin role
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin') {
    logger.info(`Access denied: User ${req.userId} with role ${req.userRole} attempted to access admin resource`);
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
};

// Middleware to require at least staff role
export const requireStaff = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin' && req.userRole !== 'staff') {
    logger.info(`Access denied: User ${req.userId} with role ${req.userRole} attempted to access staff resource`);
    res.status(403).json({ error: 'Forbidden: Staff access required' });
    return;
  }
  next();
};