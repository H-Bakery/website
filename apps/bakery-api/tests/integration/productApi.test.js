const request = require('supertest')
const path = require('path')
const { sequelize } = require('../../config/database')
const models = require('../../models')
const logger = require('../../utils/logger')
const express = require('express')
const productController = require('../../controllers/productController')

// Create a mock Express app for testing instead of using the main app
let app

describe('Product API Endpoints', () => {
  beforeAll(async () => {
    // Connect to the test database before all tests
    try {
      // Create a mock Express app instead of using the real app
      app = express()
      
      // Set up routes on the mock app
      app.get('/products', productController.getProducts)
      app.get('/products/:id', productController.getProduct)
      
      // Use in-memory SQLite for tests
      await sequelize.sync({ force: true })
      
      // Seed with some test data - use unique IDs for test
      await models.Product.bulkCreate([
        {
          id: 101,
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
          id: 102,
          name: 'Test Pastry',
          price: 1.99,
          stock: 15,
          dailyTarget: 30,
          description: 'Delicious test pastry',
          isActive: true,
          image: '/test-pastry.jpg',
          category: 'Pastry'
        },
        {
          id: 103,
          name: 'Inactive Product',
          price: 3.99,
          stock: 0,
          dailyTarget: 0,
          description: 'This product is not active',
          isActive: false,
          image: '/inactive.jpg',
          category: 'Other'
        }
      ])
    } catch (err) {
      console.error('Test setup failed:', err)
    }
  }, 30000) // Increase timeout for database setup

  afterAll(async () => {
    // Disconnect and clean up after all tests
    try {
      await sequelize.close()
    } catch (err) {
      console.error('Test teardown failed:', err)
    }
  })

  describe('GET /products', () => {
    it('should return all active products', async () => {
      const response = await request(app)
        .get('/products')
        .expect('Content-Type', /json/)
        .expect(200)

      // Should return only active products
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBe(2)
      expect(response.body.some(p => p.name === 'Test Bread')).toBeTruthy()
      expect(response.body.some(p => p.name === 'Test Pastry')).toBeTruthy()
      
      // Should not return inactive products
      expect(response.body.some(p => p.name === 'Inactive Product')).toBeFalsy()
      
      // Should include the expected fields
      const product = response.body[0]
      expect(product).toHaveProperty('id')
      expect(product).toHaveProperty('name')
      expect(product).toHaveProperty('price')
      expect(product).toHaveProperty('stock')
      expect(product).toHaveProperty('description')
      expect(product).toHaveProperty('image')
      expect(product).toHaveProperty('category')
    })
  })

  describe('GET /products/:id', () => {
    it('should return a specific product by ID', async () => {
      const response = await request(app)
        .get('/products/101')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('id', 101)
      expect(response.body).toHaveProperty('name', 'Test Bread')
      expect(response.body).toHaveProperty('price', 2.99)
      expect(response.body).toHaveProperty('stock', 10)
      expect(response.body).toHaveProperty('dailyTarget', 20)
      expect(response.body).toHaveProperty('description', 'Fresh test bread')
      expect(response.body).toHaveProperty('isActive', true)
      expect(response.body).toHaveProperty('image', '/test-bread.jpg')
      expect(response.body).toHaveProperty('category', 'Bread')
    })

    it('should handle nonexistent product IDs', async () => {
      const response = await request(app)
        .get('/products/999')
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('message', 'Product not found')
    })

    it('should handle invalid product IDs', async () => {
      const response = await request(app)
        .get('/products/invalid')
        .expect('Content-Type', /json/)
        .expect(404)  // Sequelize actually returns 404 for invalid IDs, not 500

      expect(response.body).toHaveProperty('message', 'Product not found')
    })
  })
})