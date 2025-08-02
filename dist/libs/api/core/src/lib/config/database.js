'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.sequelize = void 0
exports.getDatabaseConfig = getDatabaseConfig
exports.createSequelize = createSequelize
exports.testConnection = testConnection
exports.syncDatabase = syncDatabase
exports.closeConnection = closeConnection
var tslib_1 = require('tslib')
var sequelize_1 = require('sequelize')
var logger_1 = require('../utils/logger')
// Default configuration for SQLite
var defaultConfig = {
  dialect: 'sqlite',
  storage: process.env['DATABASE_PATH'] || 'database.db',
  logging: function (msg) {
    return logger_1.logger.db(msg)
  },
}
// Get database configuration from environment or use defaults
function getDatabaseConfig() {
  var config = tslib_1.__assign({}, defaultConfig)
  // Check if we should use a different database
  if (process.env['DATABASE_URL']) {
    // Parse DATABASE_URL for PostgreSQL/MySQL
    var url = new URL(process.env['DATABASE_URL'])
    config.dialect = url.protocol.replace(':', '')
    config.host = url.hostname
    config.port = parseInt(url.port) || undefined
    config.database = url.pathname.substring(1)
    config.username = url.username
    config.password = url.password
  }
  // Override with individual environment variables if set
  if (process.env['DB_DIALECT']) {
    config.dialect = process.env['DB_DIALECT']
  }
  if (process.env['DB_HOST']) {
    config.host = process.env['DB_HOST']
  }
  if (process.env['DB_PORT']) {
    config.port = parseInt(process.env['DB_PORT'])
  }
  if (process.env['DB_NAME']) {
    config.database = process.env['DB_NAME']
  }
  if (process.env['DB_USER']) {
    config.username = process.env['DB_USER']
  }
  if (process.env['DB_PASS']) {
    config.password = process.env['DB_PASS']
  }
  // Configure logging
  if (process.env['DB_LOGGING'] === 'false') {
    config.logging = false
  }
  return config
}
// Create Sequelize instance
function createSequelize(config) {
  var dbConfig = config || getDatabaseConfig()
  logger_1.logger.info(
    'Initializing Sequelize with '.concat(dbConfig.dialect, ' database...')
  )
  var sequelizeOptions = {
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
  }
  // Add SQLite-specific options
  if (dbConfig.dialect === 'sqlite' && dbConfig.storage) {
    sequelizeOptions.storage = dbConfig.storage
  }
  // Add connection options for other databases
  if (dbConfig.dialect !== 'sqlite') {
    if (dbConfig.host) sequelizeOptions.host = dbConfig.host
    if (dbConfig.port) sequelizeOptions.port = dbConfig.port
    if (dbConfig.database) sequelizeOptions.database = dbConfig.database
    if (dbConfig.username) sequelizeOptions.username = dbConfig.username
    if (dbConfig.password) sequelizeOptions.password = dbConfig.password
    // Connection pool configuration
    sequelizeOptions.pool = dbConfig.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    }
  }
  return new sequelize_1.Sequelize(sequelizeOptions)
}
// Default Sequelize instance
exports.sequelize = createSequelize()
// Function to test database connection
function testConnection(seq) {
  return tslib_1.__awaiter(this, void 0, void 0, function () {
    var dbInstance, error_1
    return tslib_1.__generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          dbInstance = seq || exports.sequelize
          _a.label = 1
        case 1:
          _a.trys.push([1, 3, , 4])
          return [4 /*yield*/, dbInstance.authenticate()]
        case 2:
          _a.sent()
          logger_1.logger.info('Database connection established successfully.')
          return [2 /*return*/, true]
        case 3:
          error_1 = _a.sent()
          logger_1.logger.error('Unable to connect to the database:', error_1)
          return [2 /*return*/, false]
        case 4:
          return [2 /*return*/]
      }
    })
  })
}
// Function to sync database models
function syncDatabase(seq_1) {
  return tslib_1.__awaiter(this, arguments, void 0, function (seq, force) {
    var dbInstance, error_2
    if (force === void 0) {
      force = false
    }
    return tslib_1.__generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          dbInstance = seq || exports.sequelize
          _a.label = 1
        case 1:
          _a.trys.push([1, 3, , 4])
          logger_1.logger.info(
            'Syncing database models'.concat(force ? ' (force)' : '', '...')
          )
          return [4 /*yield*/, dbInstance.sync({ force: force })]
        case 2:
          _a.sent()
          logger_1.logger.info('Database models synced successfully.')
          return [3 /*break*/, 4]
        case 3:
          error_2 = _a.sent()
          logger_1.logger.error('Error syncing database models:', error_2)
          throw error_2
        case 4:
          return [2 /*return*/]
      }
    })
  })
}
// Function to close database connection
function closeConnection(seq) {
  return tslib_1.__awaiter(this, void 0, void 0, function () {
    var dbInstance, error_3
    return tslib_1.__generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          dbInstance = seq || exports.sequelize
          _a.label = 1
        case 1:
          _a.trys.push([1, 3, , 4])
          return [4 /*yield*/, dbInstance.close()]
        case 2:
          _a.sent()
          logger_1.logger.info('Database connection closed.')
          return [3 /*break*/, 4]
        case 3:
          error_3 = _a.sent()
          logger_1.logger.error('Error closing database connection:', error_3)
          throw error_3
        case 4:
          return [2 /*return*/]
      }
    })
  })
}
