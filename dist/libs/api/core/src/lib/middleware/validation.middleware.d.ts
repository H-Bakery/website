import { Request, Response, NextFunction } from 'express'
/**
 * Middleware to handle validation errors from express-validator
 * Returns a consistent error response format for validation failures
 */
export declare const handleValidationErrors: (
  req: Request,
  res: Response,
  next: NextFunction
) => void
