'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.requireStaff = exports.requireAdmin = exports.authenticate = void 0
var tslib_1 = require('tslib')
var jwt = require('jsonwebtoken')
var logger_1 = require('../utils/logger')
var authenticate = function (req, res, next) {
  logger_1.logger.info('Authenticating request...')
  var authHeader = req.headers['authorization']
  if (!authHeader) {
    logger_1.logger.info(
      'Authentication failed: No authorization header provided'
    )
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  // Extract token from "Bearer <token>" format
  var token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader
  if (!token) {
    logger_1.logger.info('Authentication failed: No token provided')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  var jwtSecret = process.env['JWT_SECRET'] || 'default-secret-key'
  jwt.verify(token, jwtSecret, function (err, decoded) {
    return tslib_1.__awaiter(void 0, void 0, void 0, function () {
      return tslib_1.__generator(this, function (_a) {
        if (err) {
          logger_1.logger.error('Authentication failed: Invalid token', err)
          res.status(401).json({ error: 'Invalid token' })
          return [2 /*return*/]
        }
        try {
          // For now, we'll skip user lookup and just set the decoded values
          // In a real implementation, you would fetch the user from the database
          req.userId = decoded.id
          req.userRole = decoded.role || 'user'
          req.user = { id: decoded.id, role: decoded.role }
          logger_1.logger.info(
            'Authentication successful for user ID: '
              .concat(req.userId, ' with role: ')
              .concat(req.userRole)
          )
          next()
        } catch (error) {
          logger_1.logger.error('Error during authentication:', error)
          res.status(500).json({ error: 'Server error' })
          return [2 /*return*/]
        }
        return [2 /*return*/]
      })
    })
  })
}
exports.authenticate = authenticate
// Middleware to require admin role
var requireAdmin = function (req, res, next) {
  if (req.userRole !== 'admin') {
    logger_1.logger.info(
      'Access denied: User '
        .concat(req.userId, ' with role ')
        .concat(req.userRole, ' attempted to access admin resource')
    )
    res.status(403).json({ error: 'Forbidden: Admin access required' })
    return
  }
  next()
}
exports.requireAdmin = requireAdmin
// Middleware to require at least staff role
var requireStaff = function (req, res, next) {
  if (req.userRole !== 'admin' && req.userRole !== 'staff') {
    logger_1.logger.info(
      'Access denied: User '
        .concat(req.userId, ' with role ')
        .concat(req.userRole, ' attempted to access staff resource')
    )
    res.status(403).json({ error: 'Forbidden: Staff access required' })
    return
  }
  next()
}
exports.requireStaff = requireStaff
