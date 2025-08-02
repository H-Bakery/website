const { body, param } = require('express-validator');

/**
 * Validation rules for creating an inventory item
 */
const inventoryCreationRules = () => [
  body('name')
    .trim()
    .escape()
    .notEmpty().withMessage('Item name is required')
    .isLength({ min: 1, max: 255 }).withMessage('Item name must be between 1 and 255 characters'),
  
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number')
    .toFloat(),
  
  body('unit')
    .trim()
    .notEmpty().withMessage('Unit is required')
    .isIn(['kg', 'g', 'liters', 'ml', 'units', 'pieces', 'bags', 'boxes', 'bottles', 'jars'])
    .withMessage('Invalid unit type'),
  
  body('minStockLevel')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum stock level must be a non-negative number')
    .toFloat(),
  
  body('maxStockLevel')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maximum stock level must be a non-negative number')
    .toFloat()
    .custom((value, { req }) => {
      if (value && req.body.minStockLevel && parseFloat(value) <= parseFloat(req.body.minStockLevel)) {
        throw new Error('Maximum stock level must be greater than minimum stock level');
      }
      return true;
    }),
  
  body('category')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Category must not exceed 100 characters'),
  
  body('supplier')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 255 }).withMessage('Supplier name must not exceed 255 characters'),
  
  body('costPerUnit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Cost per unit must be a non-negative number')
    .toFloat(),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
];

/**
 * Validation rules for updating an inventory item
 */
const inventoryUpdateRules = () => [
  param('id')
    .notEmpty().withMessage('Inventory item ID is required')
    .isInt({ min: 1 }).withMessage('Inventory item ID must be a positive integer'),
  
  body('name')
    .optional()
    .trim()
    .escape()
    .notEmpty().withMessage('Item name cannot be empty')
    .isLength({ min: 1, max: 255 }).withMessage('Item name must be between 1 and 255 characters'),
  
  body('quantity')
    .optional()
    .isFloat({ min: 0 }).withMessage('Quantity must be a non-negative number')
    .toFloat(),
  
  body('unit')
    .optional()
    .trim()
    .isIn(['kg', 'g', 'liters', 'ml', 'units', 'pieces', 'bags', 'boxes', 'bottles', 'jars'])
    .withMessage('Invalid unit type'),
  
  body('minStockLevel')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum stock level must be a non-negative number')
    .toFloat(),
  
  body('maxStockLevel')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maximum stock level must be a non-negative number')
    .toFloat()
    .custom((value, { req }) => {
      if (value && req.body.minStockLevel && parseFloat(value) <= parseFloat(req.body.minStockLevel)) {
        throw new Error('Maximum stock level must be greater than minimum stock level');
      }
      return true;
    }),
  
  body('category')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Category must not exceed 100 characters'),
  
  body('supplier')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 255 }).withMessage('Supplier name must not exceed 255 characters'),
  
  body('costPerUnit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Cost per unit must be a non-negative number')
    .toFloat(),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
];

/**
 * Validation rules for deleting an inventory item
 */
const inventoryDeleteRules = () => [
  param('id')
    .notEmpty().withMessage('Inventory item ID is required')
    .isInt({ min: 1 }).withMessage('Inventory item ID must be a positive integer')
];

/**
 * Validation rules for stock adjustment
 */
const stockAdjustmentRules = () => [
  param('id')
    .notEmpty().withMessage('Inventory item ID is required')
    .isInt({ min: 1 }).withMessage('Inventory item ID must be a positive integer'),
  
  body('adjustment')
    .notEmpty().withMessage('Adjustment amount is required')
    .isFloat().withMessage('Adjustment must be a number')
    .custom((value) => {
      if (parseFloat(value) === 0) {
        throw new Error('Adjustment cannot be zero');
      }
      return true;
    })
    .toFloat(),
  
  body('reason')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 255 }).withMessage('Reason must not exceed 255 characters')
];

/**
 * Validation rules for bulk stock adjustments
 */
const bulkStockAdjustmentRules = () => [
  body('adjustments')
    .notEmpty().withMessage('Adjustments array is required')
    .isArray({ min: 1, max: 100 }).withMessage('At least one adjustment is required and cannot process more than 100 adjustments at once'),
  
  body('adjustments.*.itemId')
    .notEmpty().withMessage('Item ID is required for each adjustment')
    .isInt({ min: 1 }).withMessage('Item ID must be a positive integer'),
  
  body('adjustments.*.adjustment')
    .notEmpty().withMessage('Adjustment amount is required')
    .isFloat().withMessage('Adjustment must be a number')
    .custom((value) => {
      if (parseFloat(value) === 0) {
        throw new Error('Adjustment cannot be zero');
      }
      return true;
    })
    .toFloat(),
  
  body('adjustments.*.reason')
    .optional({ nullable: true })
    .trim()
    .escape()
    .isLength({ max: 255 }).withMessage('Reason must not exceed 255 characters')
];

module.exports = {
  inventoryCreationRules,
  inventoryUpdateRules,
  inventoryDeleteRules,
  stockAdjustmentRules,
  bulkStockAdjustmentRules
};