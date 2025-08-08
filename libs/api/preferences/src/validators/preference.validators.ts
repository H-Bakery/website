/**
 * Preference Validators - Input validation for preference endpoints
 * Bakery Management System
 */

import { body, ValidationChain } from 'express-validator';
import { VALID_CATEGORIES, VALID_PRIORITIES, TIME_REGEX } from '../models/preference.model';

export const updatePreferencesValidator: ValidationChain[] = [
  body('emailEnabled')
    .optional()
    .isBoolean()
    .withMessage('Email enabled must be a boolean'),

  body('browserEnabled')
    .optional()
    .isBoolean()
    .withMessage('Browser enabled must be a boolean'),

  body('soundEnabled')
    .optional()
    .isBoolean()
    .withMessage('Sound enabled must be a boolean'),

  body('categoryPreferences')
    .optional()
    .isObject()
    .withMessage('Category preferences must be an object')
    .custom((value) => {
      if (typeof value !== 'object') return false;
      
      // Validate each category if provided
      for (const key of Object.keys(value)) {
        if (!VALID_CATEGORIES.includes(key as any)) {
          throw new Error(`Invalid category: ${key}`);
        }
        if (typeof value[key] !== 'boolean') {
          throw new Error(`Category preference ${key} must be a boolean`);
        }
      }
      return true;
    }),

  body('priorityThreshold')
    .optional()
    .isIn(VALID_PRIORITIES)
    .withMessage(`Priority threshold must be one of: ${VALID_PRIORITIES.join(', ')}`),

  body('quietHours')
    .optional()
    .isObject()
    .withMessage('Quiet hours must be an object')
    .custom((value) => {
      if (typeof value !== 'object') return false;

      // Validate enabled flag if provided
      if ('enabled' in value && typeof value.enabled !== 'boolean') {
        throw new Error('Quiet hours enabled must be a boolean');
      }

      // Validate start time if provided
      if ('start' in value) {
        if (typeof value.start !== 'string' || !TIME_REGEX.test(value.start)) {
          throw new Error('Quiet hours start must be in HH:MM format');
        }
      }

      // Validate end time if provided
      if ('end' in value) {
        if (typeof value.end !== 'string' || !TIME_REGEX.test(value.end)) {
          throw new Error('Quiet hours end must be in HH:MM format');
        }
      }

      return true;
    }),
];