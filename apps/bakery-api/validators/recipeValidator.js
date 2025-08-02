const { body, param } = require('express-validator');

/**
 * Validation rules for creating a recipe
 */
const recipeCreationRules = () => [
  body('title')
    .trim()
    .notEmpty().withMessage('Recipe title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
    .isLength({ min: 1, max: 200 }).withMessage('Slug must be between 1 and 200 characters'),
  
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required')
    .isIn(['bread', 'pastry', 'cake', 'cookie', 'savory', 'other'])
    .withMessage('Invalid category'),
  
  body('prepTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Prep time must be a non-negative integer'),
  
  body('cookTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Cook time must be a non-negative integer'),
  
  body('yield')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Yield must not exceed 50 characters'),
  
  body('ingredients')
    .isArray({ min: 1 }).withMessage('Recipe must have at least one ingredient'),
  
  body('ingredients.*')
    .trim()
    .notEmpty().withMessage('Ingredient cannot be empty')
    .isLength({ max: 200 }).withMessage('Each ingredient must not exceed 200 characters'),
  
  body('instructions')
    .isArray({ min: 1 }).withMessage('Recipe must have at least one instruction'),
  
  body('instructions.*')
    .trim()
    .notEmpty().withMessage('Instruction cannot be empty')
    .isLength({ max: 1000 }).withMessage('Each instruction must not exceed 1000 characters'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes must not exceed 2000 characters')
];

/**
 * Validation rules for updating a recipe
 */
const recipeUpdateRules = () => [
  param('slug')
    .trim()
    .notEmpty().withMessage('Recipe slug is required'),
  
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty if provided')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  
  body('category')
    .optional()
    .trim()
    .isIn(['bread', 'pastry', 'cake', 'cookie', 'savory', 'other'])
    .withMessage('Invalid category'),
  
  body('prepTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Prep time must be a non-negative integer'),
  
  body('cookTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Cook time must be a non-negative integer'),
  
  body('yield')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Yield must not exceed 50 characters'),
  
  body('ingredients')
    .optional()
    .isArray({ min: 1 }).withMessage('Recipe must have at least one ingredient if updating ingredients'),
  
  body('ingredients.*')
    .optional()
    .trim()
    .notEmpty().withMessage('Ingredient cannot be empty')
    .isLength({ max: 200 }).withMessage('Each ingredient must not exceed 200 characters'),
  
  body('instructions')
    .optional()
    .isArray({ min: 1 }).withMessage('Recipe must have at least one instruction if updating instructions'),
  
  body('instructions.*')
    .optional()
    .trim()
    .notEmpty().withMessage('Instruction cannot be empty')
    .isLength({ max: 1000 }).withMessage('Each instruction must not exceed 1000 characters'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes must not exceed 2000 characters')
];

/**
 * Validation rules for deleting a recipe
 */
const recipeDeleteRules = () => [
  param('slug')
    .trim()
    .notEmpty().withMessage('Recipe slug is required')
];

module.exports = {
  recipeCreationRules,
  recipeUpdateRules,
  recipeDeleteRules
};