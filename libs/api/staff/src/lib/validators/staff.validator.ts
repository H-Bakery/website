import { body, param, ValidationChain } from 'express-validator';
import { STAFF_CONSTANTS, STAFF_ERROR_MESSAGES } from '../models/staff.model';

/**
 * Validation rules for creating a staff member
 */
export const staffCreationRules = (): ValidationChain[] => [
  body('firstName')
    .trim()
    .notEmpty().withMessage(STAFF_ERROR_MESSAGES.FIRST_NAME_REQUIRED)
    .isLength({ min: STAFF_CONSTANTS.MIN_NAME_LENGTH, max: STAFF_CONSTANTS.MAX_NAME_LENGTH })
    .withMessage(`First name must be between ${STAFF_CONSTANTS.MIN_NAME_LENGTH} and ${STAFF_CONSTANTS.MAX_NAME_LENGTH} characters`)
    .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .trim()
    .notEmpty().withMessage(STAFF_ERROR_MESSAGES.LAST_NAME_REQUIRED)
    .isLength({ min: STAFF_CONSTANTS.MIN_NAME_LENGTH, max: STAFF_CONSTANTS.MAX_NAME_LENGTH })
    .withMessage(`Last name must be between ${STAFF_CONSTANTS.MIN_NAME_LENGTH} and ${STAFF_CONSTANTS.MAX_NAME_LENGTH} characters`)
    .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .trim()
    .notEmpty().withMessage(STAFF_ERROR_MESSAGES.EMAIL_REQUIRED)
    .isEmail().withMessage(STAFF_ERROR_MESSAGES.INVALID_EMAIL)
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage(STAFF_ERROR_MESSAGES.PHONE_REQUIRED)
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage(STAFF_ERROR_MESSAGES.INVALID_PHONE)
    .isLength({ min: STAFF_CONSTANTS.MIN_PHONE_LENGTH, max: STAFF_CONSTANTS.MAX_PHONE_LENGTH })
    .withMessage(`Phone number must be between ${STAFF_CONSTANTS.MIN_PHONE_LENGTH} and ${STAFF_CONSTANTS.MAX_PHONE_LENGTH} characters`),
  
  body('role')
    .trim()
    .notEmpty().withMessage(STAFF_ERROR_MESSAGES.ROLE_REQUIRED)
    .isIn(STAFF_CONSTANTS.VALID_ROLES)
    .withMessage(STAFF_ERROR_MESSAGES.INVALID_ROLE),
  
  body('schedule')
    .optional({ nullable: true })
    .isObject().withMessage(STAFF_ERROR_MESSAGES.INVALID_SCHEDULE),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
    .toBoolean(),

  body('password')
    .optional()
    .isLength({ min: STAFF_CONSTANTS.PASSWORD_MIN_LENGTH })
    .withMessage(STAFF_ERROR_MESSAGES.PASSWORD_TOO_SHORT)
];

/**
 * Validation rules for updating a staff member
 */
export const staffUpdateRules = (): ValidationChain[] => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid staff member ID'),
  
  body('firstName')
    .optional()
    .trim()
    .notEmpty().withMessage('First name cannot be empty if provided')
    .isLength({ min: STAFF_CONSTANTS.MIN_NAME_LENGTH, max: STAFF_CONSTANTS.MAX_NAME_LENGTH })
    .withMessage(`First name must be between ${STAFF_CONSTANTS.MIN_NAME_LENGTH} and ${STAFF_CONSTANTS.MAX_NAME_LENGTH} characters`)
    .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('lastName')
    .optional()
    .trim()
    .notEmpty().withMessage('Last name cannot be empty if provided')
    .isLength({ min: STAFF_CONSTANTS.MIN_NAME_LENGTH, max: STAFF_CONSTANTS.MAX_NAME_LENGTH })
    .withMessage(`Last name must be between ${STAFF_CONSTANTS.MIN_NAME_LENGTH} and ${STAFF_CONSTANTS.MAX_NAME_LENGTH} characters`)
    .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage(STAFF_ERROR_MESSAGES.INVALID_EMAIL)
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage(STAFF_ERROR_MESSAGES.INVALID_PHONE)
    .isLength({ min: STAFF_CONSTANTS.MIN_PHONE_LENGTH, max: STAFF_CONSTANTS.MAX_PHONE_LENGTH })
    .withMessage(`Phone number must be between ${STAFF_CONSTANTS.MIN_PHONE_LENGTH} and ${STAFF_CONSTANTS.MAX_PHONE_LENGTH} characters`),
  
  body('role')
    .optional()
    .trim()
    .isIn(STAFF_CONSTANTS.VALID_ROLES)
    .withMessage(STAFF_ERROR_MESSAGES.INVALID_ROLE),
  
  body('schedule')
    .optional({ nullable: true })
    .isObject().withMessage(STAFF_ERROR_MESSAGES.INVALID_SCHEDULE),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean value')
    .toBoolean(),

  body('password')
    .optional()
    .isLength({ min: STAFF_CONSTANTS.PASSWORD_MIN_LENGTH })
    .withMessage(STAFF_ERROR_MESSAGES.PASSWORD_TOO_SHORT)
];

/**
 * Validation rules for deleting a staff member
 */
export const staffDeleteRules = (): ValidationChain[] => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid staff member ID')
];

/**
 * Validation rules for getting a staff member by ID
 */
export const staffGetByIdRules = (): ValidationChain[] => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid staff member ID')
];