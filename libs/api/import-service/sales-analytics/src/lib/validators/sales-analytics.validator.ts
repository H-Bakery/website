import { body, query, ValidationChain } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { logger } from '../utils/logger'

/**
 * Handle validation errors middleware
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Validation failed:', { errors: errors.array(), url: req.url })
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((error) => ({
        // express-validator 7 nennt das Feld `path` (bis v6 `param`)
        field: 'path' in error ? error.path : 'unknown',
        message: error.msg,
        value: 'value' in error ? error.value : undefined,
      })),
    })
    return
  }

  next()
}

/**
 * Base date range validation rules
 */
export const dateRangeValidationRules = (): ValidationChain[] => {
  return [
    query('startDate')
      .notEmpty()
      .withMessage('startDate is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('startDate must be in YYYY-MM-DD format')
      .isISO8601({ strict: true })
      .withMessage('startDate must be a valid date')
      .custom((value) => {
        const date = new Date(value)
        if (date > new Date()) {
          throw new Error('startDate cannot be in the future')
        }
        return true
      }),

    query('endDate')
      .notEmpty()
      .withMessage('endDate is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('endDate must be in YYYY-MM-DD format')
      .isISO8601({ strict: true })
      .withMessage('endDate must be a valid date')
      .custom((value, { req }) => {
        const endDate = new Date(value)
        const startDate = new Date(req.query?.['startDate'] as string)

        if (endDate > new Date()) {
          throw new Error('endDate cannot be in the future')
        }

        if (endDate < startDate) {
          throw new Error('endDate must be after or equal to startDate')
        }

        // Limit date range to 2 years for performance
        const daysDiff = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysDiff > 730) {
          throw new Error('Date range cannot exceed 2 years (730 days)')
        }

        return true
      }),
  ]
}

/**
 * Pagination validation rules
 */
export const paginationValidationRules = (): ValidationChain[] => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer')
      .toInt(),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be between 1 and 100')
      .toInt(),
  ]
}

/**
 * Revenue trends validation rules
 */
export const revenueTrendsValidationRules = (): ValidationChain[] => {
  return [
    ...dateRangeValidationRules(),

    query('granularity')
      .optional()
      .isIn(['daily', 'weekly', 'monthly'])
      .withMessage('granularity must be one of: daily, weekly, monthly')
      .customSanitizer((value) => value || 'daily'),
  ]
}

/**
 * Product performance validation rules
 */
export const productPerformanceValidationRules = (): ValidationChain[] => {
  return [
    ...dateRangeValidationRules(),
    ...paginationValidationRules(),

    query('sort')
      .optional()
      .isIn(['top', 'bottom'])
      .withMessage('sort must be either "top" or "bottom"')
      .customSanitizer((value) => value || 'top'),
  ]
}

/**
 * Cashier performance validation rules
 */
export const cashierPerformanceValidationRules = (): ValidationChain[] => {
  return [...dateRangeValidationRules(), ...paginationValidationRules()]
}

/**
 * Validation rules for analytics endpoints that only need date range
 */
export const summaryValidationRules = (): ValidationChain[] => {
  return dateRangeValidationRules()
}
