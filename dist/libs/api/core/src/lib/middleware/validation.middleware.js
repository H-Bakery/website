'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.handleValidationErrors = void 0
var express_validator_1 = require('express-validator')
var logger_1 = require('../utils/logger')
/**
 * Middleware to handle validation errors from express-validator
 * Returns a consistent error response format for validation failures
 */
var handleValidationErrors = function (req, res, next) {
  var errors = (0, express_validator_1.validationResult)(req)
  if (!errors.isEmpty()) {
    var errorArray = errors.array()
    logger_1.logger.warn(
      'Validation failed for request: ' +
        JSON.stringify({
          path: req.path,
          method: req.method,
          errors: errorArray,
        })
    )
    // Format errors for better client consumption
    var formattedErrors = errorArray.map(function (error) {
      return {
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
        location: error.location,
      }
    })
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors,
    })
    return
  }
  next()
}
exports.handleValidationErrors = handleValidationErrors
