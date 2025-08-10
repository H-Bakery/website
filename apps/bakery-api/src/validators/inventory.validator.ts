import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'

// Validation middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

// Create inventory validation
export const validateCreateInventory = [
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('minimumQuantity')
    .isInt({ min: 0 })
    .withMessage('Minimum quantity must be a non-negative integer'),
  body('maximumQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum quantity must be a non-negative integer'),
  body('reorderPoint')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reorder point must be a non-negative integer'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be a string with max 255 characters'),
  body('unit')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must be a string with max 50 characters'),
  body('category')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must be a string with max 100 characters'),
  body('supplier')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Supplier must be a string with max 200 characters'),
  body('supplierContact')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Supplier contact must be a string with max 200 characters'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string'),
  handleValidationErrors,
]

// Update inventory validation
export const validateUpdateInventory = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('minimumQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum quantity must be a non-negative integer'),
  body('maximumQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum quantity must be a non-negative integer'),
  body('reorderPoint')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reorder point must be a non-negative integer'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must be a string with max 255 characters'),
  body('unit')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must be a string with max 50 characters'),
  body('category')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must be a string with max 100 characters'),
  body('supplier')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Supplier must be a string with max 200 characters'),
  body('supplierContact')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Supplier contact must be a string with max 200 characters'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string'),
  handleValidationErrors,
]

// Stock adjustment validation
export const validateStockAdjustment = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('adjustmentType')
    .isIn(['increase', 'decrease', 'set'])
    .withMessage('Adjustment type must be increase, decrease, or set'),
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('reason')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage('Reason is required and must be max 200 characters'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string'),
  handleValidationErrors,
]

// ID parameter validation
export const validateIdParam = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  handleValidationErrors,
]

// Query parameters validation
export const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn([
      'id',
      'quantity',
      'minimumQuantity',
      'lastRestocked',
      'createdAt',
      'updatedAt',
    ])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  query('category')
    .optional()
    .isString()
    .trim()
    .withMessage('Category must be a string'),
  query('supplier')
    .optional()
    .isString()
    .trim()
    .withMessage('Supplier must be a string'),
  query('search')
    .optional()
    .isString()
    .trim()
    .withMessage('Search must be a string'),
  query('lowStock')
    .optional()
    .isBoolean()
    .withMessage('Low stock must be a boolean'),
  handleValidationErrors,
]
