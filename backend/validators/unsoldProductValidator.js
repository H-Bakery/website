const { body } = require('express-validator');

/**
 * Validation rules for recording unsold products
 */
const unsoldProductRules = () => [
  body('productId')
    .notEmpty().withMessage('Product ID is required')
    .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  
  body('date')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid date'),
  
  body('reason')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Reason must not exceed 200 characters')
];

module.exports = {
  unsoldProductRules
};