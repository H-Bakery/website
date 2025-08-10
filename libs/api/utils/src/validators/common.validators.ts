/**
 * Common Validators - Reusable validation utilities
 * Bakery Management System
 */

import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Email validation
 */
export const emailValidator = (field = 'email'): ValidationChain =>
  body(field)
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail();

/**
 * Phone number validation (German format)
 */
export const phoneValidator = (field = 'phone'): ValidationChain =>
  body(field)
    .optional()
    .trim()
    .matches(/^(\+49|0)[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format');

/**
 * Date validation
 */
export const dateValidator = (field: string, options?: { required?: boolean }): ValidationChain => {
  const validator = options?.required ? body(field).notEmpty() : body(field).optional();
  return validator
    .isISO8601()
    .withMessage('Invalid date format (use ISO 8601)')
    .toDate();
};

/**
 * Date range validation
 */
export const dateRangeValidator = (): ValidationChain[] => [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query?.['startDate'] && endDate < new Date(req.query['startDate'] as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

/**
 * Pagination validation
 */
export const paginationValidator = (): ValidationChain[] => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

/**
 * ID parameter validation (numeric)
 */
export const idParamValidator = (paramName = 'id'): ValidationChain =>
  param(paramName)
    .notEmpty()
    .withMessage('ID is required')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
    .toInt();

/**
 * UUID parameter validation
 */
export const uuidParamValidator = (paramName = 'id'): ValidationChain =>
  param(paramName)
    .notEmpty()
    .withMessage('ID is required')
    .isUUID()
    .withMessage('Invalid UUID format');

/**
 * Price validation
 */
export const priceValidator = (field = 'price'): ValidationChain =>
  body(field)
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
    .toFloat();

/**
 * Quantity validation
 */
export const quantityValidator = (field = 'quantity'): ValidationChain =>
  body(field)
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer')
    .toInt();

/**
 * Percentage validation (0-100)
 */
export const percentageValidator = (field: string): ValidationChain =>
  body(field)
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Percentage must be between 0 and 100')
    .toFloat();

/**
 * Language validation
 */
export const languageValidator = (field = 'language'): ValidationChain =>
  body(field)
    .optional()
    .isIn(['de', 'en'])
    .withMessage('Language must be either de or en')
    .default('de');

/**
 * Sort order validation
 */
export const sortOrderValidator = (): ValidationChain[] => [
  query('sortBy')
    .optional()
    .isString()
    .withMessage('Sort field must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', 'ASC', 'DESC'])
    .withMessage('Sort order must be asc or desc')
    .toLowerCase(),
];

/**
 * Search query validation
 */
export const searchValidator = (minLength = 2): ValidationChain =>
  query('search')
    .optional()
    .trim()
    .isLength({ min: minLength })
    .withMessage(`Search query must be at least ${minLength} characters`);

/**
 * Boolean flag validation
 */
export const booleanValidator = (field: string): ValidationChain =>
  body(field)
    .optional()
    .isBoolean()
    .withMessage(`${field} must be a boolean`)
    .toBoolean();

/**
 * Array validation
 */
export const arrayValidator = (
  field: string,
  options?: { min?: number; max?: number; unique?: boolean }
): ValidationChain =>
  body(field)
    .isArray({ min: options?.min, max: options?.max })
    .withMessage(
      `${field} must be an array${options?.min ? ` with at least ${options.min} items` : ''}${
        options?.max ? ` and at most ${options.max} items` : ''
      }`
    )
    .custom((value) => {
      if (options?.unique && new Set(value).size !== value.length) {
        throw new Error(`${field} must contain unique values`);
      }
      return true;
    });

/**
 * Enum validation
 */
export const enumValidator = <T extends string>(
  field: string,
  validValues: readonly T[],
  options?: { required?: boolean }
): ValidationChain => {
  const validator = options?.required ? body(field).notEmpty() : body(field).optional();
  return validator
    .isIn(validValues as any)
    .withMessage(`${field} must be one of: ${validValues.join(', ')}`);
};

/**
 * File upload validation
 */
export const fileUploadValidator = (
  field: string,
  options?: {
    mimeTypes?: string[];
    maxSize?: number;
    required?: boolean;
  }
): ValidationChain =>
  body(field).custom((value, { req }) => {
    const file = (req as any).files?.[field];

    if (options?.required && !file) {
      throw new Error(`${field} is required`);
    }

    if (!file) return true;

    if (options?.mimeTypes && !options.mimeTypes.includes(file.mimetype)) {
      throw new Error(
        `Invalid file type. Allowed types: ${options.mimeTypes.join(', ')}`
      );
    }

    if (options?.maxSize && file.size > options.maxSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${options.maxSize} bytes`
      );
    }

    return true;
  });

/**
 * Sanitize HTML content
 */
export const htmlSanitizer = (field: string): ValidationChain =>
  body(field)
    .optional()
    .trim()
    .escape()
    .withMessage('Invalid HTML content');

/**
 * URL validation
 */
export const urlValidator = (field: string, options?: { protocols?: string[] }): ValidationChain =>
  body(field)
    .optional()
    .isURL({
      protocols: options?.protocols || ['http', 'https'],
      require_protocol: true,
    })
    .withMessage('Invalid URL format');