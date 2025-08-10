const { Sequelize } = require("sequelize");
const ProductModel = require("../../models/product");
const logger = require("../../utils/logger");

// Create a separate test database connection
const testSequelize = new Sequelize("sqlite::memory:", {
  logging: false, // Disable SQL logging during tests
});

// Initialize models with test database
const models = {
  Product: ProductModel(testSequelize, Sequelize.DataTypes),
  // Add other models here as needed for tests
};

/**
 * Initialize the test database
 */
async function initTestDb() {
  try {
    await testSequelize.authenticate();
    await testSequelize.sync({ force: true });
    return true;
  } catch (error) {
    logger.error("Test database initialization error:", error);
    return false;
  }
}

/**
 * Close the test database
 */
async function closeTestDb() {
  try {
    await testSequelize.close();
    return true;
  } catch (error) {
    logger.error("Test database close error:", error);
    return false;
  }
}

/**
 * Seed test data into the database
 */
async function seedTestData(data = {}) {
  try {
    if (data.products && data.products.length > 0) {
      await models.Product.bulkCreate(data.products);
    }
    return true;
  } catch (error) {
    logger.error("Test data seeding error:", error);
    return false;
  }
}

/**
 * Clear all data from test database tables
 */
async function clearTestData() {
  try {
    await models.Product.destroy({ where: {}, truncate: true });
    return true;
  } catch (error) {
    logger.error("Test data clearing error:", error);
    return false;
  }
}

module.exports = {
  testSequelize,
  models,
  initTestDb,
  closeTestDb,
  seedTestData,
  clearTestData,
};
