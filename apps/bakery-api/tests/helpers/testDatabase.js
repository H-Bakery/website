const { Sequelize, DataTypes } = require('sequelize')
const logger = require('../../utils/logger')

// Create a separate test database connection
const testSequelize = new Sequelize('sqlite::memory:', {
  logging: false, // Disable SQL logging during tests
})

// Define Product model for test database (mirrors models/index.js definition)
const Product = testSequelize.define(
  'Product',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.FLOAT, allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    dailyTarget: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    description: { type: DataTypes.STRING(1000), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    image: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: 'Products', timestamps: true }
)

const models = {
  Product,
}

/**
 * Initialize the test database
 */
async function initTestDb() {
  try {
    await testSequelize.authenticate()
    await testSequelize.sync({ force: true })
    return true
  } catch (error) {
    logger.error('Test database initialization error:', error)
    return false
  }
}

/**
 * Close the test database
 */
async function closeTestDb() {
  try {
    await testSequelize.close()
    return true
  } catch (error) {
    logger.error('Test database close error:', error)
    return false
  }
}

/**
 * Seed test data into the database
 */
async function seedTestData(data = {}) {
  try {
    if (data.products && data.products.length > 0) {
      await models.Product.bulkCreate(data.products)
    }
    return true
  } catch (error) {
    logger.error('Test data seeding error:', error)
    return false
  }
}

/**
 * Clear all data from test database tables
 */
async function clearTestData() {
  try {
    await models.Product.destroy({ where: {}, truncate: true })
    return true
  } catch (error) {
    logger.error('Test data clearing error:', error)
    return false
  }
}

module.exports = {
  testSequelize,
  models,
  initTestDb,
  closeTestDb,
  seedTestData,
  clearTestData,
}
