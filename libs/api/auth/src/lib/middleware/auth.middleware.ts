/**
 * Authentication middleware
 */

import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { JwtPayload } from '../models/user.model'

// Extend Express Request type to include auth properties
declare global {
  // Express-Typaugmentation: hierfür ist ein Namespace die vorgesehene Form
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number
      userRole?: string
    }
  }
}

/**
 * Verify JWT token and attach user info to request
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      })
      return
    }

    // Check if token starts with Bearer
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format',
      })
      return
    }

    // Extract token
    const token = authHeader.substring(7)

    // Verify token
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key'
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload

    // Attach user info to request
    req.userId = decoded.id
    req.userRole = decoded.role

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      })
      return
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      })
      return
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error',
    })
  }
}

/**
 * Check if user has required role
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
      return
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      })
      return
    }

    next()
  }
}

/**
 * Optional auth - attach user info if token is provided, but don't require it
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without auth
      next()
      return
    }

    const token = authHeader.substring(7)
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key'
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload

    req.userId = decoded.id
    req.userRole = decoded.role

    next()
  } catch (error) {
    // Invalid token, continue without auth
    next()
  }
}
