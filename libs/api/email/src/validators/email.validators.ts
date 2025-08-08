/**
 * Email Validators - Input validation for email endpoints
 * Bakery Management System
 */

import { body, ValidationChain } from 'express-validator';

export const sendTestEmailValidator: ValidationChain[] = [
  body('recipientEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('language')
    .optional()
    .isIn(['de', 'en'])
    .withMessage('Language must be either de or en'),
];

export const sendEmailValidator: ValidationChain[] = [
  body('templateKey')
    .notEmpty()
    .withMessage('Template key is required')
    .matches(/^[a-z]+\.[a-z]+(\.[a-z]+)?$/)
    .withMessage('Template key must be in format: category.action or category.action.detail'),

  body('recipientEmail')
    .notEmpty()
    .withMessage('Recipient email is required')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),

  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),

  body('options.language')
    .optional()
    .isIn(['de', 'en'])
    .withMessage('Language must be either de or en'),

  body('options.subject')
    .optional()
    .isString()
    .withMessage('Subject must be a string')
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
];

export const sendBulkEmailsValidator: ValidationChain[] = [
  body('notifications')
    .notEmpty()
    .withMessage('Notifications array is required')
    .isArray()
    .withMessage('Notifications must be an array')
    .custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Notifications array must not be empty');
      }
      
      // Validate each notification
      for (const notification of value) {
        if (!notification.id || !notification.title || !notification.message || !notification.category || !notification.priority) {
          throw new Error('Each notification must have id, title, message, category, and priority');
        }
      }
      return true;
    }),

  body('recipients')
    .notEmpty()
    .withMessage('Recipients array is required')
    .isArray()
    .withMessage('Recipients must be an array')
    .custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Recipients array must not be empty');
      }
      
      // Validate each recipient
      for (const recipient of value) {
        if (!recipient.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
          throw new Error('Each recipient must have a valid email address');
        }
        
        if (recipient.language && !['de', 'en'].includes(recipient.language)) {
          throw new Error('Recipient language must be either de or en');
        }
        
        if (recipient.notificationIndex !== undefined && (typeof recipient.notificationIndex !== 'number' || recipient.notificationIndex < 0)) {
          throw new Error('Notification index must be a non-negative number');
        }
      }
      return true;
    }),
];

export const updateQueueConfigValidator: ValidationChain[] = [
  body('batchSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Batch size must be between 1 and 50'),

  body('batchDelay')
    .optional()
    .isInt({ min: 100, max: 60000 })
    .withMessage('Batch delay must be between 100ms and 60s'),

  body('retryAttempts')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Retry attempts must be between 0 and 10'),

  body('retryDelay')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('Retry delay must be between 1s and 5min'),
];