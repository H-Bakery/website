import { body, param, query, ValidationChain } from 'express-validator';
import { UNSOLD_PRODUCT_CONSTANTS, UNSOLD_PRODUCT_ERROR_MESSAGES } from '../models/unsold-product.model';

/**
 * Validation rules for recording unsold products
 */
export const unsoldProductCreationRules = (): ValidationChain[] => [
  body('productId')
    .notEmpty().withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.PRODUCT_ID_REQUIRED)
    .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  
  body('quantity')
    .notEmpty().withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.QUANTITY_REQUIRED)
    .isInt({ min: 1 }).withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_QUANTITY),
  
  body('date')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE),
  
  body('reason')
    .optional({ nullable: true })
    .trim()
    .isIn(UNSOLD_PRODUCT_CONSTANTS.WASTE_REASONS)
    .withMessage(`Reason must be one of: ${UNSOLD_PRODUCT_CONSTANTS.WASTE_REASONS.join(', ')}`),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: UNSOLD_PRODUCT_CONSTANTS.MAX_NOTES_LENGTH })
    .withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.NOTES_TOO_LONG)
];

/**
 * Validation rules for updating unsold products
 */
export const unsoldProductUpdateRules = (): ValidationChain[] => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid unsold product ID'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_QUANTITY),
  
  body('reason')
    .optional({ nullable: true })
    .trim()
    .isIn(UNSOLD_PRODUCT_CONSTANTS.WASTE_REASONS)
    .withMessage(`Reason must be one of: ${UNSOLD_PRODUCT_CONSTANTS.WASTE_REASONS.join(', ')}`),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: UNSOLD_PRODUCT_CONSTANTS.MAX_NOTES_LENGTH })
    .withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.NOTES_TOO_LONG)
];

/**
 * Validation rules for deleting unsold products
 */
export const unsoldProductDeleteRules = (): ValidationChain[] => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid unsold product ID')
];

/**
 * Validation rules for querying unsold products
 */
export const unsoldProductQueryRules = (): ValidationChain[] => [
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Start date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid start date'),
  
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('End date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid end date'),
  
  query('productId')
    .optional()
    .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  
  query('category')
    .optional()
    .trim()
    .notEmpty().withMessage('Category cannot be empty'),
  
  query('userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: UNSOLD_PRODUCT_CONSTANTS.MAX_PAGE_SIZE })
    .withMessage(`Limit must be between 1 and ${UNSOLD_PRODUCT_CONSTANTS.MAX_PAGE_SIZE}`)
];

/**
 * Validation rules for daily waste report
 */
export const dailyWasteReportRules = (): ValidationChain[] => [
  query('date')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage(UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE)
];