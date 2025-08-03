import { body, query, param } from 'express-validator';

/**
 * Schedule Validators
 */
export const createScheduleValidator = [
  body('scheduleDate')
    .notEmpty()
    .withMessage('Schedule date is required')
    .isISO8601()
    .withMessage('Schedule date must be a valid date'),
  
  body('scheduleType')
    .notEmpty()
    .withMessage('Schedule type is required')
    .isIn(['daily', 'weekly', 'special'])
    .withMessage('Schedule type must be daily, weekly, or special'),
  
  body('targetQuantities')
    .notEmpty()
    .withMessage('Target quantities are required')
    .isObject()
    .withMessage('Target quantities must be an object'),
  
  body('assignedStaffIds')
    .optional()
    .isArray()
    .withMessage('Assigned staff IDs must be an array'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

/**
 * Batch Validators
 */
export const createBatchValidator = [
  body('workflowId')
    .notEmpty()
    .withMessage('Workflow ID is required')
    .isString()
    .withMessage('Workflow ID must be a string'),
  
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  body('recipeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Recipe ID must be a positive integer'),
  
  body('plannedQuantity')
    .notEmpty()
    .withMessage('Planned quantity is required')
    .isFloat({ min: 0.01 })
    .withMessage('Planned quantity must be greater than 0'),
  
  body('plannedStartTime')
    .notEmpty()
    .withMessage('Planned start time is required')
    .isISO8601()
    .withMessage('Planned start time must be a valid date'),
  
  body('plannedEndTime')
    .optional()
    .isISO8601()
    .withMessage('Planned end time must be a valid date'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  
  body('scheduleId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Schedule ID must be a positive integer'),
  
  body('assignedStaffIds')
    .optional()
    .isArray()
    .withMessage('Assigned staff IDs must be an array'),
  
  body('assignedStaffIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each assigned staff ID must be a positive integer'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

export const updateBatchStatusValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Batch ID must be a positive integer'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'ready', 'in_progress', 'paused', 'completed', 'cancelled', 'failed'])
    .withMessage('Invalid status value'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

export const completeBatchValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Batch ID must be a positive integer'),
  
  body('actualQuantity')
    .notEmpty()
    .withMessage('Actual quantity is required')
    .isFloat({ min: 0 })
    .withMessage('Actual quantity must be a non-negative number'),
  
  body('qualityNotes')
    .optional()
    .isString()
    .withMessage('Quality notes must be a string')
];

/**
 * Step Validators
 */
export const updateStepValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Step ID must be a positive integer'),
  
  body('status')
    .optional()
    .isIn(['pending', 'ready', 'in_progress', 'waiting', 'completed', 'skipped', 'failed'])
    .withMessage('Invalid status value'),
  
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  
  body('actualParameters')
    .optional()
    .isObject()
    .withMessage('Actual parameters must be an object'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),
  
  body('qualityResults')
    .optional()
    .isObject()
    .withMessage('Quality results must be an object'),
  
  body('assignedStaffIds')
    .optional()
    .isArray()
    .withMessage('Assigned staff IDs must be an array'),
  
  body('assignedStaffIds.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each assigned staff ID must be a positive integer')
];

export const completeStepValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Step ID must be a positive integer'),
  
  body('qualityResults')
    .optional()
    .isObject()
    .withMessage('Quality results must be an object'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

/**
 * Query Validators
 */
export const getSchedulesQueryValidator = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  query('status')
    .optional()
    .isIn(['all', 'planned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
  
  query('type')
    .optional()
    .isIn(['all', 'daily', 'weekly', 'special'])
    .withMessage('Invalid schedule type'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

export const getBatchesQueryValidator = [
  query('status')
    .optional()
    .isIn(['pending', 'ready', 'in_progress', 'paused', 'completed', 'cancelled', 'failed'])
    .withMessage('Invalid status value'),
  
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority value'),
  
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid date'),
  
  query('workflowId')
    .optional()
    .isString()
    .withMessage('Workflow ID must be a string'),
  
  query('productId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];