import { body, param, query } from 'express-validator';

/**
 * Validation rules for creating a notification
 */
export const notificationCreationRules = [
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
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level'),
  
  body('userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object')
];

/**
 * Validation rules for creating notification from template
 */
export const templateNotificationRules = [
  body('templateKey')
    .notEmpty().withMessage('Template key is required')
    .trim()
    .matches(/^[a-z]+\.[a-z_]+$/).withMessage('Invalid template key format'),
  
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  
  body('variables')
    .optional()
    .isObject().withMessage('Variables must be an object'),
  
  body('language')
    .optional()
    .isIn(['de', 'en']).withMessage('Language must be de or en')
];

/**
 * Validation rules for bulk notification creation
 */
export const bulkNotificationRules = [
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
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level'),
  
  body('notifications.*.userId')
    .optional()
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  
  body('notifications.*.metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object')
];

/**
 * Validation rules for notification ID parameter
 */
export const notificationIdRules = [
  param('id')
    .notEmpty().withMessage('Notification ID is required')
    .isInt({ min: 1 }).withMessage('Notification ID must be a positive integer')
];

/**
 * Validation rules for notification query parameters
 */
export const notificationQueryRules = [
  query('unreadOnly')
    .optional()
    .isBoolean().withMessage('unreadOnly must be a boolean'),
  
  query('category')
    .optional()
    .isIn(['general', 'order', 'staff', 'inventory', 'system']).withMessage('Invalid category'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
];

/**
 * Validation rules for updating preferences
 */
export const preferencesUpdateRules = [
  body('emailEnabled')
    .optional()
    .isBoolean().withMessage('emailEnabled must be a boolean'),
  
  body('browserEnabled')
    .optional()
    .isBoolean().withMessage('browserEnabled must be a boolean'),
  
  body('soundEnabled')
    .optional()
    .isBoolean().withMessage('soundEnabled must be a boolean'),
  
  body('categoryPreferences')
    .optional()
    .isObject().withMessage('categoryPreferences must be an object'),
  
  body('categoryPreferences.staff')
    .optional()
    .isBoolean().withMessage('staff preference must be a boolean'),
  
  body('categoryPreferences.order')
    .optional()
    .isBoolean().withMessage('order preference must be a boolean'),
  
  body('categoryPreferences.system')
    .optional()
    .isBoolean().withMessage('system preference must be a boolean'),
  
  body('categoryPreferences.inventory')
    .optional()
    .isBoolean().withMessage('inventory preference must be a boolean'),
  
  body('categoryPreferences.general')
    .optional()
    .isBoolean().withMessage('general preference must be a boolean'),
  
  body('priorityThreshold')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority threshold'),
  
  body('quietHours')
    .optional()
    .isObject().withMessage('quietHours must be an object'),
  
  body('quietHours.enabled')
    .optional()
    .isBoolean().withMessage('quietHours.enabled must be a boolean'),
  
  body('quietHours.start')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
  
  body('quietHours.end')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format')
];

/**
 * Validation rules for template query parameters
 */
export const templateQueryRules = [
  query('category')
    .optional()
    .isIn(['production', 'inventory', 'order', 'staff', 'financial', 'system', 'customer'])
    .withMessage('Invalid template category'),
  
  query('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean')
];