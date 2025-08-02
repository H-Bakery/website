'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.logger = void 0
var tslib_1 = require('tslib')
exports.logger = {
  info: function (message) {
    console.log(
      '[INFO] ['.concat(new Date().toISOString(), '] ').concat(message)
    )
  },
  error: function (message, error) {
    console.error(
      '[ERROR] ['.concat(new Date().toISOString(), '] ').concat(message)
    )
    if (error) console.error(error)
  },
  warn: function (message) {
    console.warn(
      '[WARN] ['.concat(new Date().toISOString(), '] ').concat(message)
    )
  },
  db: function (message) {
    console.log('[DB] ['.concat(new Date().toISOString(), '] ').concat(message))
  },
  debug: function (message) {
    console.log(
      '[DEBUG] ['.concat(new Date().toISOString(), '] ').concat(message)
    )
  },
  request: function (req) {
    console.log(
      '[REQUEST] ['
        .concat(new Date().toISOString(), '] ')
        .concat(req.method, ' ')
        .concat(req.url)
    )
    if (req.body && Object.keys(req.body).length > 0) {
      var sanitizedBody = tslib_1.__assign({}, req.body)
      // Sanitize sensitive data
      if (sanitizedBody.password) sanitizedBody.password = '********'
      console.log('Request Body:', sanitizedBody)
    }
  },
}
