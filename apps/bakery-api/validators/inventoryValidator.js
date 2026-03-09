const { body } = require('express-validator')

const validUnits = [
  'kg',
  'g',
  'liters',
  'ml',
  'units',
  'pieces',
  'bags',
  'boxes',
  'bottles',
  'jars',
]

const inventoryCreationRules = () => [
  body('name').notEmpty().withMessage('Name is required').escape(),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('unit')
    .notEmpty()
    .withMessage('Unit is required')
    .isIn(validUnits)
    .withMessage(`Invalid unit. Must be one of: ${validUnits.join(', ')}`),
  body('lowStockThreshold')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Low stock threshold must be a positive number'),
  body('reorderLevel')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Reorder level must be a positive number'),
  body('category').optional().trim(),
  body('supplier').optional().trim(),
  body('costPerUnit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a positive number'),
  body('notes').optional().escape(),
]

const inventoryUpdateRules = () => [
  body('name').optional().escape(),
  body('quantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('unit')
    .optional()
    .isIn(validUnits)
    .withMessage(`Invalid unit. Must be one of: ${validUnits.join(', ')}`),
  body('notes').optional().escape(),
]

const stockAdjustmentRules = () => [
  body('adjustment')
    .notEmpty()
    .withMessage('Adjustment is required')
    .isFloat()
    .withMessage('Adjustment must be a number')
    .custom((value) => {
      if (value === 0) {
        throw new Error('Adjustment cannot be zero')
      }
      return true
    }),
  body('reason').optional().trim(),
]

const bulkStockAdjustmentRules = () => [
  body('adjustments')
    .isArray({ min: 1 })
    .withMessage('At least one adjustment is required')
    .custom((value) => {
      if (value && value.length > 100) {
        throw new Error('Cannot process more than 100 adjustments at once')
      }
      return true
    }),
  body('adjustments.*.itemId')
    .isInt()
    .withMessage('Item ID must be an integer'),
  body('adjustments.*.adjustment')
    .isFloat()
    .withMessage('Adjustment must be a number')
    .custom((value) => {
      if (value === 0) {
        throw new Error('Adjustment cannot be zero')
      }
      return true
    }),
]

module.exports = {
  inventoryCreationRules,
  inventoryUpdateRules,
  stockAdjustmentRules,
  bulkStockAdjustmentRules,
}
