const { body, param } = require('express-validator');

/**
 * Validation rules for creating a notification
 */
const notificationCreationRules = () => [
  body('title')
    .notEmpty().withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  
  body('message')
    .notEmpty().withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),
  
  body('type')
    .optional()
    .isIn(['info', 'warning', 'error', 'success']).withMessage('Invalid notification type'),
  
  body('category')
    .optional()
    .trim()
    .isIn(['general', 'order', 'staff', 'inventory', 'system']).withMessage('Invalid category'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority level'),
  
  body('userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object')
];

/**
 * Validation rules for bulk notification creation
 */
const bulkNotificationRules = () => [
  body('notifications')
    .notEmpty().withMessage('Notifications array is required')
    .isArray({ min: 1, max: 100 }).withMessage('Notifications must be an array with 1 to 100 items'),
  
  body('notifications.*.title')
    .notEmpty().withMessage('Title is required for each notification')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  
  body('notifications.*.message')
    .notEmpty().withMessage('Message is required for each notification')
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),
  
  body('notifications.*.type')
    .optional()
    .isIn(['info', 'warning', 'error', 'success']).withMessage('Invalid notification type'),
  
  body('notifications.*.category')
    .optional()
    .trim()
    .isIn(['general', 'order', 'staff', 'inventory', 'system']).withMessage('Invalid category'),
  
  body('notifications.*.priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority level'),
  
  body('notifications.*.userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer')
];

/**
 * Validation rules for notification ID parameter
 */
const notificationIdRules = () => [
  param('id')
    .notEmpty().withMessage('Notification ID is required')
    .isInt({ min: 1 }).withMessage('Notification ID must be a positive integer')
];

module.exports = {
  notificationCreationRules,
  bulkNotificationRules,
  notificationIdRules
};