import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
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

interface FormattedError {
  field: string
  message: string
  value?: any
  location?: string
}

/**
 * Middleware to handle validation errors from express-validator
 * Returns a consistent error response format for validation failures
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Validation failed for request', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
    })

    // Format errors for better client consumption
    const formattedErrors: FormattedError[] = errors
      .array()
      .map((error: any) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
        location: error.location,
      }))

    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors,
    })
    return
  }

  next()
}

export const validationMiddleware = {
  handleValidationErrors,
}
