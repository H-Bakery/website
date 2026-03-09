const { validationResult } = require('express-validator')
const logger = require('../utils/logger')

/**
 * Middleware to handle validation errors from express-validator
 * Returns a consistent error response format for validation failures
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    logger.warn('Validation failed for request', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
    })

    // Format errors as object keyed by field name
    const formattedErrors = {}
    errors.array().forEach((error) => {
      const field = error.path || error.param
      formattedErrors[field] = error.msg
    })

    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors,
    })
  }

  next()
}

module.exports = { handleValidationErrors }
