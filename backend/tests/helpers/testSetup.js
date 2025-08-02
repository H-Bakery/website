const path = require('path')
const { sequelize } = require('../../config/database')
const models = require('../../models')

// Create a test database setup helper
async function setupTestDatabase() {
  try {
    // Sync database with force option to recreate tables
    await sequelize.sync({ force: true })
    return true
  } catch (error) {
    console.error('Failed to set up test database:', error)
    return false
  }
}

// Clean up test database
async function cleanupTestDatabase() {
  try {
    // Close the database connection
    await sequelize.close()
    return true
  } catch (error) {
    console.error('Failed to clean up test database:', error)
    return false
  }
}

// Seed the database with test data
async function seedTestData(data = {}) {
  try {
    // Add test products
    if (data.products) {
      await models.Product.bulkCreate(data.products)
    } else {
      // Default test products
      await models.Product.bulkCreate([
        {
          id: 1,
          name: 'Test Bread',
          price: 2.99,
          stock: 10,
          dailyTarget: 20,
          description: 'Fresh test bread',
          isActive: true,
          image: '/test-bread.jpg',
          category: 'Bread'
        },
        {
          id: 2,
          name: 'Test Pastry',
          price: 1.99,
          stock: 15,
          dailyTarget: 30,
          description: 'Delicious test pastry',
          isActive: true,
          image: '/test-pastry.jpg',
          category: 'Pastry'
        }
      ])
    }

    // Add other test data types as needed here

    return true
  } catch (error) {
    console.error('Failed to seed test data:', error)
    return false
  }
}

// Create test fixtures path helper
function getFixturePath(fileName) {
  return path.join(__dirname, '../fixtures', fileName)
}

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  seedTestData,
  getFixturePath
}