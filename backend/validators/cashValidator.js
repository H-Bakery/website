const { body, param } = require('express-validator');

/**
 * Validation rules for creating a cash entry
 */
const cashEntryCreationRules = () => [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number')
    .toFloat(),
  
  body('date')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid date'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
];

/**
 * Validation rules for updating a cash entry
 */
const cashEntryUpdateRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid cash entry ID'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number')
    .toFloat(),
  
  body('date')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid date'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
];

/**
 * Validation rules for deleting a cash entry
 */
const cashEntryDeleteRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid cash entry ID')
];

module.exports = {
  cashEntryCreationRules,
  cashEntryUpdateRules,
  cashEntryDeleteRules
};