const { body, param } = require('express-validator');

/**
 * Validation rules for creating a staff member
 */
const staffCreationRules = () => [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format')
    .isLength({ min: 7, max: 20 }).withMessage('Phone number must be between 7 and 20 characters'),
  
  body('role')
    .trim()
    .notEmpty().withMessage('Role is required')
    .isIn(['manager', 'baker', 'assistant', 'cashier', 'delivery'])
    .withMessage('Invalid role'),
  
  body('schedule')
    .optional({ nullable: true })
    .isObject().withMessage('Schedule must be an object if provided'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
    .toBoolean()
];

/**
 * Validation rules for updating a staff member
 */
const staffUpdateRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid staff member ID'),
  
  body('firstName')
    .optional()
    .trim()
    .notEmpty().withMessage('First name cannot be empty if provided')
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .trim()
    .notEmpty().withMessage('Last name cannot be empty if provided')
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format')
    .isLength({ min: 7, max: 20 }).withMessage('Phone number must be between 7 and 20 characters'),
  
  body('role')
    .optional()
    .trim()
    .isIn(['manager', 'baker', 'assistant', 'cashier', 'delivery'])
    .withMessage('Invalid role'),
  
  body('schedule')
    .optional({ nullable: true })
    .isObject().withMessage('Schedule must be an object if provided'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
    .toBoolean()
];

/**
 * Validation rules for deleting a staff member
 */
const staffDeleteRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid staff member ID')
];

module.exports = {
  staffCreationRules,
  staffUpdateRules,
  staffDeleteRules
};