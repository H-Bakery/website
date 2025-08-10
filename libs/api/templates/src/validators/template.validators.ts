/**
 * Template Validators - Input validation for template endpoints
 * Bakery Management System
 */

import { body, param, query, ValidationChain } from 'express-validator';

const VALID_CATEGORIES = ['production', 'inventory', 'order', 'staff', 'financial', 'system', 'customer'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_TYPES = ['info', 'success', 'warning', 'error'];

export const getTemplatesValidator: ValidationChain[] = [
  query('category')
    .optional()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),
];

export const templateKeyValidator: ValidationChain[] = [
  param('key')
    .notEmpty()
    .withMessage('Template key is required')
    .matches(/^[a-z]+\.[a-z]+(\.[a-z]+)?$/)
    .withMessage('Template key must be in format: category.action or category.action.detail'),
];

export const previewTemplateValidator: ValidationChain[] = [
  ...templateKeyValidator,
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  body('language')
    .optional()
    .isIn(['de', 'en'])
    .withMessage('Language must be either de or en'),
];

export const createTemplateValidator: ValidationChain[] = [
  body('key')
    .notEmpty()
    .withMessage('Template key is required')
    .matches(/^[a-z]+\.[a-z]+(\.[a-z]+)?$/)
    .withMessage('Template key must be in format: category.action or category.action.detail'),

  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Template name must be between 3 and 100 characters'),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(VALID_CATEGORIES)
    .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  body('defaultTitle')
    .notEmpty()
    .withMessage('Default title is required')
    .isObject()
    .withMessage('Default title must be an object')
    .custom((value) => {
      if (!value.de || !value.en) {
        throw new Error('Default title must contain both de and en translations');
      }
      if (typeof value.de !== 'string' || typeof value.en !== 'string') {
        throw new Error('Title translations must be strings');
      }
      return true;
    }),

  body('defaultMessage')
    .notEmpty()
    .withMessage('Default message is required')
    .isObject()
    .withMessage('Default message must be an object')
    .custom((value) => {
      if (!value.de || !value.en) {
        throw new Error('Default message must contain both de and en translations');
      }
      if (typeof value.de !== 'string' || typeof value.en !== 'string') {
        throw new Error('Message translations must be strings');
      }
      return true;
    }),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && /^\w+$/.test(v));
    })
    .withMessage('Each variable must be a string containing only alphanumeric characters and underscores'),

  body('defaultPriority')
    .optional()
    .isIn(VALID_PRIORITIES)
    .withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`),

  body('defaultType')
    .optional()
    .isIn(VALID_TYPES)
    .withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

export const updateTemplateValidator: ValidationChain[] = [
  ...templateKeyValidator,

  body('name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Template name must be between 3 and 100 characters'),

  body('category')
    .optional()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`),

  body('defaultTitle')
    .optional()
    .isObject()
    .withMessage('Default title must be an object')
    .custom((value) => {
      if (!value.de || !value.en) {
        throw new Error('Default title must contain both de and en translations');
      }
      if (typeof value.de !== 'string' || typeof value.en !== 'string') {
        throw new Error('Title translations must be strings');
      }
      return true;
    }),

  body('defaultMessage')
    .optional()
    .isObject()
    .withMessage('Default message must be an object')
    .custom((value) => {
      if (!value.de || !value.en) {
        throw new Error('Default message must contain both de and en translations');
      }
      if (typeof value.de !== 'string' || typeof value.en !== 'string') {
        throw new Error('Message translations must be strings');
      }
      return true;
    }),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && /^\w+$/.test(v));
    })
    .withMessage('Each variable must be a string containing only alphanumeric characters and underscores'),

  body('defaultPriority')
    .optional()
    .isIn(VALID_PRIORITIES)
    .withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`),

  body('defaultType')
    .optional()
    .isIn(VALID_TYPES)
    .withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
];

export const validateTemplateValidator: ValidationChain[] = [
  body('title')
    .notEmpty()
    .withMessage('Title is required for validation')
    .isString()
    .withMessage('Title must be a string'),

  body('message')
    .notEmpty()
    .withMessage('Message is required for validation')
    .isString()
    .withMessage('Message must be a string'),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((v) => typeof v === 'string' && /^\w+$/.test(v));
    })
    .withMessage('Each variable must be a string containing only alphanumeric characters and underscores'),
];