"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerIdRules = exports.passwordUpdateRules = exports.customerUpdateRules = exports.loginRules = exports.userRegistrationRules = void 0;
var express_validator_1 = require("express-validator");
/**
 * Validation rules for user registration
 */
var userRegistrationRules = function () { return [
    (0, express_validator_1.body)('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    (0, express_validator_1.body)('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    (0, express_validator_1.body)('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
    (0, express_validator_1.body)('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    (0, express_validator_1.body)('role')
        .optional()
        .trim()
        .isIn(['admin', 'staff', 'user']).withMessage('Role must be one of: admin, staff, user')
]; };
exports.userRegistrationRules = userRegistrationRules;
/**
 * Validation rules for user login
 */
var loginRules = function () { return [
    (0, express_validator_1.body)('username')
        .trim()
        .notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password')
        .notEmpty().withMessage('Password is required')
]; };
exports.loginRules = loginRules;
/**
 * Validation rules for customer update
 */
var customerUpdateRules = function () { return [
    (0, express_validator_1.param)('id')
        .notEmpty().withMessage('Customer ID is required')
        .isInt({ min: 1 }).withMessage('Customer ID must be a positive integer'),
    (0, express_validator_1.body)('email')
        .optional()
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    (0, express_validator_1.body)('firstName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
    (0, express_validator_1.body)('lastName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    (0, express_validator_1.body)('role')
        .optional()
        .trim()
        .isIn(['admin', 'staff', 'user']).withMessage('Role must be one of: admin, staff, user'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean value')
]; };
exports.customerUpdateRules = customerUpdateRules;
/**
 * Validation rules for password update
 */
var passwordUpdateRules = function () { return [
    (0, express_validator_1.param)('id')
        .notEmpty().withMessage('Customer ID is required')
        .isInt({ min: 1 }).withMessage('Customer ID must be a positive integer'),
    (0, express_validator_1.body)('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
        .custom(function (value, _a) {
        var req = _a.req;
        return value !== req.body.currentPassword;
    })
        .withMessage('New password must be different from current password')
]; };
exports.passwordUpdateRules = passwordUpdateRules;
/**
 * Validation rules for customer ID parameter
 */
var customerIdRules = function () { return [
    (0, express_validator_1.param)('id')
        .notEmpty().withMessage('Customer ID is required')
        .isInt({ min: 1 }).withMessage('Customer ID must be a positive integer')
]; };
exports.customerIdRules = customerIdRules;
