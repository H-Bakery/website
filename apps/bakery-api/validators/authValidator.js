const { body } = require('express-validator');

/**
 * Validation rules for user registration
 */
const userRegistrationRules = () => [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
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
  
  body('role')
    .optional()
    .trim()
    .isIn(['admin', 'staff', 'user']).withMessage('Role must be one of: admin, staff, user')
];

/**
 * Validation rules for user login
 */
const loginRules = () => [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

module.exports = {
  userRegistrationRules,
  loginRules
};