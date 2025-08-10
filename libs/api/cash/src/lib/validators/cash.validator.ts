/**
 * Cash validation rules
 */

import { body, param, query } from 'express-validator';
import { CASH_VALIDATION } from '../models/cash.model';

/**
 * Validation rules for creating a cash entry
 */
export const cashEntryCreationRules = () => [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: CASH_VALIDATION.MIN_AMOUNT, max: CASH_VALIDATION.MAX_AMOUNT })
    .withMessage(`Amount must be between ${CASH_VALIDATION.MIN_AMOUNT} and ${CASH_VALIDATION.MAX_AMOUNT}`)
    .toFloat(),
  
  body('date')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid date'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: CASH_VALIDATION.MAX_NOTES_LENGTH })
    .withMessage(`Notes must not exceed ${CASH_VALIDATION.MAX_NOTES_LENGTH} characters`)
];

/**
 * Validation rules for updating a cash entry
 */
export const cashEntryUpdateRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid cash entry ID'),
  
  body('amount')
    .optional()
    .isFloat({ min: CASH_VALIDATION.MIN_AMOUNT, max: CASH_VALIDATION.MAX_AMOUNT })
    .withMessage(`Amount must be between ${CASH_VALIDATION.MIN_AMOUNT} and ${CASH_VALIDATION.MAX_AMOUNT}`)
    .toFloat(),
  
  body('date')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('Date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid date'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: CASH_VALIDATION.MAX_NOTES_LENGTH })
    .withMessage(`Notes must not exceed ${CASH_VALIDATION.MAX_NOTES_LENGTH} characters`)
];

/**
 * Validation rules for deleting a cash entry
 */
export const cashEntryDeleteRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid cash entry ID')
];

/**
 * Validation rules for getting a single cash entry
 */
export const getCashEntryRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid cash entry ID')
];

/**
 * Validation rules for getting cash entries with filters
 */
export const getCashEntriesRules = () => [
  query('startDate')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('Start date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid start date'),
  
  query('endDate')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('End date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid end date'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
];

/**
 * Validation rules for getting cash statistics
 */
export const getCashStatsRules = () => [
  query('startDate')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('Start date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid start date'),
  
  query('endDate')
    .optional()
    .trim()
    .matches(CASH_VALIDATION.DATE_FORMAT).withMessage('End date must be in YYYY-MM-DD format')
    .isISO8601().withMessage('Invalid end date')
];