const productController = require('../../controllers/productController')
const models = require('../../models')
const logger = require('../../utils/logger')

// Mock the models
jest.mock('../../models', () => ({
  Product: {
    findAll: jest.fn(),
    findByPk: jest.fn()
  }
}))

describe('Product Controller', () => {
  let req, res

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Setup request and response objects
    req = {
      params: { id: '1' }
    }
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
  })

  describe('getProducts', () => {
    test('should return all active products', async () => {
      // Arrange
      const mockProducts = [
        { 
          id: 1, 
          name: 'Test Product 1', 
          price: 2.99, 
          stock: 10, 
          description: 'Description 1',
          image: '/image1.jpg',
          category: 'Category 1'
        },
        { 
          id: 2, 
          name: 'Test Product 2', 
          price: 3.99, 
          stock: 5, 
          description: 'Description 2',
          image: '/image2.jpg',
          category: 'Category 2'
        }
      ]
      
      models.Product.findAll.mockResolvedValue(mockProducts)

      // Act
      await productController.getProducts(req, res)

      // Assert
      expect(models.Product.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        attributes: ['id', 'name', 'price', 'stock', 'description', 'image', 'category']
      })
      expect(res.json).toHaveBeenCalledWith(mockProducts)
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Retrieved 2 products'))
    })

    test('should handle database error', async () => {
      // Arrange
      const error = new Error('Database error')
      models.Product.findAll.mockRejectedValue(error)

      // Act
      await productController.getProducts(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' })
      expect(logger.error).toHaveBeenCalledWith('Product retrieval error:', error)
    })
  })

  describe('getProduct', () => {
    test('should return a specific product by ID', async () => {
      // Arrange
      const mockProduct = { 
        id: 1, 
        name: 'Test Product', 
        price: 2.99, 
        stock: 10, 
        description: 'Test Description',
        image: '/image.jpg',
        category: 'Test Category',
        dailyTarget: 20,
        isActive: true
      }
      
      models.Product.findByPk.mockResolvedValue(mockProduct)

      // Act
      await productController.getProduct(req, res)

      // Assert
      expect(models.Product.findByPk).toHaveBeenCalledWith('1', {
        attributes: ['id', 'name', 'price', 'stock', 'description', 'image', 'category', 'dailyTarget', 'isActive']
      })
      expect(res.json).toHaveBeenCalledWith(mockProduct)
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Product 1 retrieved successfully'))
    })

    test('should return 404 when product not found', async () => {
      // Arrange
      models.Product.findByPk.mockResolvedValue(null)

      // Act
      await productController.getProduct(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' })
      expect(logger.warn).toHaveBeenCalledWith('Product not found: 1')
    })

    test('should handle database error when getting specific product', async () => {
      // Arrange
      const error = new Error('Database error')
      models.Product.findByPk.mockRejectedValue(error)

      // Act
      await productController.getProduct(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' })
      expect(logger.error).toHaveBeenCalledWith('Error retrieving product 1:', error)
    })
  })
})