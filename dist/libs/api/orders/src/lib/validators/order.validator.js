'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.orderDeleteRules =
  exports.orderUpdateRules =
  exports.orderCreationRules =
    void 0
var express_validator_1 = require('express-validator')
/**
 * Validation rules for creating an order
 */
var orderCreationRules = function () {
  return [
    (0, express_validator_1.body)('customerName')
      .trim()
      .notEmpty()
      .withMessage('Customer name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Customer name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('customerPhone')
      .trim()
      .notEmpty()
      .withMessage('Customer phone is required')
      .matches(/^[\d\s\-\+\(\)]+$/)
      .withMessage('Invalid phone number format')
      .isLength({ min: 7, max: 20 })
      .withMessage('Phone number must be between 7 and 20 characters'),
    (0, express_validator_1.body)('customerEmail')
      .optional({ nullable: true })
      .trim()
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    (0, express_validator_1.body)('pickupDate')
      .notEmpty()
      .withMessage('Pickup date is required')
      .isISO8601()
      .withMessage('Invalid date format')
      .custom(function (value) {
        var pickupDate = new Date(value)
        var today = new Date()
        today.setHours(0, 0, 0, 0)
        if (pickupDate < today) {
          throw new Error('Pickup date cannot be in the past')
        }
        return true
      }),
    (0, express_validator_1.body)('status')
      .optional()
      .trim()
      .isIn([
        'pending',
        'confirmed',
        'in_progress',
        'ready',
        'completed',
        'cancelled',
      ])
      .withMessage('Invalid order status'),
    (0, express_validator_1.body)('notes')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('items')
      .isArray({ min: 1 })
      .withMessage('Order must contain at least one item'),
    (0, express_validator_1.body)('items.*.productId')
      .isInt({ min: 1 })
      .withMessage('Each item must have a valid product ID'),
    (0, express_validator_1.body)('items.*.productName')
      .trim()
      .notEmpty()
      .withMessage('Each item must have a product name'),
    (0, express_validator_1.body)('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Each item quantity must be at least 1'),
    (0, express_validator_1.body)('items.*.unitPrice')
      .isFloat({ min: 0 })
      .withMessage('Each item must have a valid unit price')
      .toFloat(),
    (0, express_validator_1.body)('totalPrice')
      .notEmpty()
      .withMessage('Total price is required')
      .isFloat({ min: 0 })
      .withMessage('Total price must be a non-negative number')
      .toFloat(),
  ]
}
exports.orderCreationRules = orderCreationRules
/**
 * Validation rules for updating an order
 */
var orderUpdateRules = function () {
  return [
    (0, express_validator_1.param)('id')
      .isInt({ min: 1 })
      .withMessage('Invalid order ID'),
    (0, express_validator_1.body)('customerName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Customer name cannot be empty if provided')
      .isLength({ min: 1, max: 100 })
      .withMessage('Customer name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('customerPhone')
      .optional()
      .trim()
      .matches(/^[\d\s\-\+\(\)]+$/)
      .withMessage('Invalid phone number format')
      .isLength({ min: 7, max: 20 })
      .withMessage('Phone number must be between 7 and 20 characters'),
    (0, express_validator_1.body)('customerEmail')
      .optional({ nullable: true })
      .trim()
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    (0, express_validator_1.body)('pickupDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format')
      .custom(function (value) {
        var pickupDate = new Date(value)
        var today = new Date()
        today.setHours(0, 0, 0, 0)
        if (pickupDate < today) {
          throw new Error('Pickup date cannot be in the past')
        }
        return true
      }),
    (0, express_validator_1.body)('status')
      .optional()
      .trim()
      .isIn([
        'pending',
        'confirmed',
        'in_progress',
        'ready',
        'completed',
        'cancelled',
      ])
      .withMessage('Invalid order status'),
    (0, express_validator_1.body)('notes')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must not exceed 1000 characters'),
    (0, express_validator_1.body)('items')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Order must contain at least one item if updating items'),
    (0, express_validator_1.body)('items.*.productId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Each item must have a valid product ID'),
    (0, express_validator_1.body)('items.*.productName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Each item must have a product name'),
    (0, express_validator_1.body)('items.*.quantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Each item quantity must be at least 1'),
    (0, express_validator_1.body)('items.*.unitPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Each item must have a valid unit price')
      .toFloat(),
    (0, express_validator_1.body)('totalPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Total price must be a non-negative number')
      .toFloat(),
  ]
}
exports.orderUpdateRules = orderUpdateRules
/**
 * Validation rules for deleting an order
 */
var orderDeleteRules = function () {
  return [
    (0, express_validator_1.param)('id')
      .isInt({ min: 1 })
      .withMessage('Invalid order ID'),
  ]
}
exports.orderDeleteRules = orderDeleteRules
