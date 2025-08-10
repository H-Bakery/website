const { Sequelize } = require('sequelize')
const logger = require('../utils/logger')

logger.info('Initializing Sequelize with PostgreSQL database...')

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(
  process.env.DATABASE_URL ||
    'postgresql://bakery_user:bakery_password@postgres:5432/bakery_dev',
  {
    dialect: 'postgres',
    logging: (msg) => logger.db(`${msg}`), // Log SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
)

// Function to test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate()
    logger.info('Database connection established successfully.')
    return true
  } catch (error) {
    logger.error('Unable to connect to the database:', error)
    return false
  }
}

module.exports = {
  sequelize,
  testConnection,
}
