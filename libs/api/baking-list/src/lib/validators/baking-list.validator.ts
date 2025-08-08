import { query, body, ValidationChain } from 'express-validator';
import { BAKING_LIST_ERROR_MESSAGES } from '../models/baking-list.model';

/**
 * Validation rules for getting baking list
 */
export const bakingListValidationRules = (): ValidationChain[] => [
  query('date')
    .optional()
    .isISO8601()
    .withMessage(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE)
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format')
];

/**
 * Validation rules for saving production plan
 */
export const productionPlanValidationRules = (): ValidationChain[] => [
  body('date')
    .notEmpty()
    .withMessage(BAKING_LIST_ERROR_MESSAGES.DATE_REQUIRED)
    .isISO8601()
    .withMessage(BAKING_LIST_ERROR_MESSAGES.INVALID_DATE)
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  
  body('plan')
    .notEmpty()
    .withMessage('Production plan is required')
    .isArray()
    .withMessage('Plan must be an array of items'),
  
  body('plan.*.productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  body('plan.*.productName')
    .notEmpty()
    .withMessage('Product name is required')
    .isString()
    .withMessage('Product name must be a string')
    .trim(),
  
  body('plan.*.plannedQuantity')
    .notEmpty()
    .withMessage('Planned quantity is required')
    .isInt({ min: 1 })
    .withMessage(BAKING_LIST_ERROR_MESSAGES.INVALID_QUANTITY),
  
  body('plan.*.actualQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Actual quantity must be a non-negative integer'),
  
  body('plan.*.notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .trim(),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .trim()
];