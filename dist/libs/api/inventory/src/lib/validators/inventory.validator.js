'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.bulkStockAdjustmentRules =
  exports.stockAdjustmentRules =
  exports.inventoryDeleteRules =
  exports.inventoryUpdateRules =
  exports.inventoryCreationRules =
    void 0
var express_validator_1 = require('express-validator')
/**
 * Validation rules for creating an inventory item
 */
var inventoryCreationRules = function () {
  return [
    (0, express_validator_1.body)('name')
      .trim()
      .escape()
      .notEmpty()
      .withMessage('Item name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Item name must be between 1 and 255 characters'),
    (0, express_validator_1.body)('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be a positive number')
      .toFloat(),
    (0, express_validator_1.body)('unit')
      .trim()
      .notEmpty()
      .withMessage('Unit is required')
      .isIn([
        'kg',
        'g',
        'liters',
        'ml',
        'units',
        'pieces',
        'bags',
        'boxes',
        'bottles',
        'jars',
      ])
      .withMessage('Invalid unit type'),
    (0, express_validator_1.body)('minStockLevel')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum stock level must be a non-negative number')
      .toFloat(),
    (0, express_validator_1.body)('maxStockLevel')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum stock level must be a non-negative number')
      .toFloat()
      .custom(function (value, _a) {
        var req = _a.req
        if (
          value &&
          req.body.minStockLevel &&
          parseFloat(value) <= parseFloat(req.body.minStockLevel)
        ) {
          throw new Error(
            'Maximum stock level must be greater than minimum stock level'
          )
        }
        return true
      }),
    (0, express_validator_1.body)('category')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 100 })
      .withMessage('Category must not exceed 100 characters'),
    (0, express_validator_1.body)('supplier')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 255 })
      .withMessage('Supplier name must not exceed 255 characters'),
    (0, express_validator_1.body)('costPerUnit')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Cost per unit must be a non-negative number')
      .toFloat(),
    (0, express_validator_1.body)('notes')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters'),
  ]
}
exports.inventoryCreationRules = inventoryCreationRules
/**
 * Validation rules for updating an inventory item
 */
var inventoryUpdateRules = function () {
  return [
    (0, express_validator_1.param)('id')
      .notEmpty()
      .withMessage('Inventory item ID is required')
      .isInt({ min: 1 })
      .withMessage('Inventory item ID must be a positive integer'),
    (0, express_validator_1.body)('name')
      .optional()
      .trim()
      .escape()
      .notEmpty()
      .withMessage('Item name cannot be empty')
      .isLength({ min: 1, max: 255 })
      .withMessage('Item name must be between 1 and 255 characters'),
    (0, express_validator_1.body)('quantity')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Quantity must be a non-negative number')
      .toFloat(),
    (0, express_validator_1.body)('unit')
      .optional()
      .trim()
      .isIn([
        'kg',
        'g',
        'liters',
        'ml',
        'units',
        'pieces',
        'bags',
        'boxes',
        'bottles',
        'jars',
      ])
      .withMessage('Invalid unit type'),
    (0, express_validator_1.body)('minStockLevel')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum stock level must be a non-negative number')
      .toFloat(),
    (0, express_validator_1.body)('maxStockLevel')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum stock level must be a non-negative number')
      .toFloat()
      .custom(function (value, _a) {
        var req = _a.req
        if (
          value &&
          req.body.minStockLevel &&
          parseFloat(value) <= parseFloat(req.body.minStockLevel)
        ) {
          throw new Error(
            'Maximum stock level must be greater than minimum stock level'
          )
        }
        return true
      }),
    (0, express_validator_1.body)('category')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 100 })
      .withMessage('Category must not exceed 100 characters'),
    (0, express_validator_1.body)('supplier')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 255 })
      .withMessage('Supplier name must not exceed 255 characters'),
    (0, express_validator_1.body)('costPerUnit')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Cost per unit must be a non-negative number')
      .toFloat(),
    (0, express_validator_1.body)('notes')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters'),
  ]
}
exports.inventoryUpdateRules = inventoryUpdateRules
/**
 * Validation rules for deleting an inventory item
 */
var inventoryDeleteRules = function () {
  return [
    (0, express_validator_1.param)('id')
      .notEmpty()
      .withMessage('Inventory item ID is required')
      .isInt({ min: 1 })
      .withMessage('Inventory item ID must be a positive integer'),
  ]
}
exports.inventoryDeleteRules = inventoryDeleteRules
/**
 * Validation rules for stock adjustment
 */
var stockAdjustmentRules = function () {
  return [
    (0, express_validator_1.param)('id')
      .notEmpty()
      .withMessage('Inventory item ID is required')
      .isInt({ min: 1 })
      .withMessage('Inventory item ID must be a positive integer'),
    (0, express_validator_1.body)('adjustment')
      .notEmpty()
      .withMessage('Adjustment amount is required')
      .isFloat()
      .withMessage('Adjustment must be a number')
      .custom(function (value) {
        if (parseFloat(value) === 0) {
          throw new Error('Adjustment cannot be zero')
        }
        return true
      })
      .toFloat(),
    (0, express_validator_1.body)('reason')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 255 })
      .withMessage('Reason must not exceed 255 characters'),
  ]
}
exports.stockAdjustmentRules = stockAdjustmentRules
/**
 * Validation rules for bulk stock adjustments
 */
var bulkStockAdjustmentRules = function () {
  return [
    (0, express_validator_1.body)('adjustments')
      .notEmpty()
      .withMessage('Adjustments array is required')
      .isArray({ min: 1, max: 100 })
      .withMessage(
        'At least one adjustment is required and cannot process more than 100 adjustments at once'
      ),
    (0, express_validator_1.body)('adjustments.*.itemId')
      .notEmpty()
      .withMessage('Item ID is required for each adjustment')
      .isInt({ min: 1 })
      .withMessage('Item ID must be a positive integer'),
    (0, express_validator_1.body)('adjustments.*.adjustment')
      .notEmpty()
      .withMessage('Adjustment amount is required')
      .isFloat()
      .withMessage('Adjustment must be a number')
      .custom(function (value) {
        if (parseFloat(value) === 0) {
          throw new Error('Adjustment cannot be zero')
        }
        return true
      })
      .toFloat(),
    (0, express_validator_1.body)('adjustments.*.reason')
      .optional({ nullable: true })
      .trim()
      .escape()
      .isLength({ max: 255 })
      .withMessage('Reason must not exceed 255 characters'),
  ]
}
exports.bulkStockAdjustmentRules = bulkStockAdjustmentRules
