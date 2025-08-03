import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { logger } from '../utils/logger';

interface FormattedError {
  field: string;
  message: string;
  value?: any;
  location?: string;
}

/**
 * Middleware to handle validation errors from express-validator
 * Returns a consistent error response format for validation failures
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorArray = errors.array() as ValidationError[];
    
    logger.warn('Validation failed for request: ' + JSON.stringify({
      path: req.path,
      method: req.method,
      errors: errorArray
    }));
    
    // Format errors for better client consumption
    const formattedErrors: FormattedError[] = errorArray.map((error: any) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
    
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors
    });
    return;
  }
  
  next();
};