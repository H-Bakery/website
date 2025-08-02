const unsoldProductController = require('../../controllers/unsoldProductController')
const models = require('../../models')

// Mock the models
jest.mock('../../models', () => ({
  UnsoldProduct: {
    create: jest.fn(),
    findAll: jest.fn(),
  },
  Product: {
    findByPk: jest.fn(),
  },
  User: {},
  sequelize: {
    fn: jest.fn((func, col) => `${func}(${col})`),
    col: jest.fn((col) => col),
  },
}))

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('Unsold Product Controller', () => {
  let req, res, next

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 1 },
    }
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    }
    next = jest.fn()
    jest.clearAllMocks()
  })

  describe('addUnsoldProduct', () => {
    it('should create an unsold product entry successfully', async () => {
      req.body = { productId: 1, quantity: 5 }
      
      models.Product.findByPk.mockResolvedValue({ id: 1, name: 'Test Product' })
      models.UnsoldProduct.create.mockResolvedValue({ id: 1 })

      await unsoldProductController.addUnsoldProduct(req, res)

      expect(models.Product.findByPk).toHaveBeenCalledWith(1)
      expect(models.UnsoldProduct.create).toHaveBeenCalledWith({
        ProductId: 1,
        quantity: 5,
        UserId: 1,
        date: expect.any(String),
      })
      expect(res.json).toHaveBeenCalledWith({ message: "Unsold product entry saved" })
    })

    it('should return 400 for invalid input', async () => {
      req.body = { productId: null, quantity: -1 }

      await unsoldProductController.addUnsoldProduct(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: "Product ID and non-negative quantity are required"
      })
    })

    it('should return 404 when product not found', async () => {
      req.body = { productId: 999, quantity: 5 }
      models.Product.findByPk.mockResolvedValue(null)

      await unsoldProductController.addUnsoldProduct(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: "Product not found" })
    })

    it('should handle database errors', async () => {
      req.body = { productId: 1, quantity: 5 }
      models.Product.findByPk.mockRejectedValue(new Error('Database error'))

      await unsoldProductController.addUnsoldProduct(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: "Database error" })
    })
  })

  describe('getUnsoldProducts', () => {
    it('should retrieve unsold products successfully', async () => {
      const mockUnsoldProducts = [
        {
          id: 1,
          quantity: 5,
          date: '2023-06-09',
          Product: { name: 'Test Product', category: 'Brot' },
          User: { username: 'testuser' },
        },
      ]

      models.UnsoldProduct.findAll.mockResolvedValue(mockUnsoldProducts)

      await unsoldProductController.getUnsoldProducts(req, res)

      expect(models.UnsoldProduct.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: models.Product,
            attributes: ['name', 'category']
          },
          {
            model: models.User,
            attributes: ['username']
          }
        ],
        order: [['date', 'DESC'], ['createdAt', 'DESC']]
      })
      expect(res.json).toHaveBeenCalledWith(mockUnsoldProducts)
    })

    it('should handle database errors', async () => {
      models.UnsoldProduct.findAll.mockRejectedValue(new Error('Database error'))

      await unsoldProductController.getUnsoldProducts(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: "Database error" })
    })
  })

  describe('getUnsoldProductsSummary', () => {
    it('should retrieve unsold products summary successfully', async () => {
      const mockSummary = [
        {
          ProductId: 1,
          totalUnsold: 25,
          Product: { name: 'Test Product', category: 'Brot' },
        },
      ]

      models.UnsoldProduct.findAll.mockResolvedValue(mockSummary)

      await unsoldProductController.getUnsoldProductsSummary(req, res)

      expect(models.UnsoldProduct.findAll).toHaveBeenCalledWith({
        attributes: [
          'ProductId',
          ['SUM(quantity)', 'totalUnsold'],
        ],
        include: [
          {
            model: models.Product,
            attributes: ['name', 'category']
          }
        ],
        group: ['ProductId', 'Product.id'],
        order: [['SUM(quantity)', 'DESC']]
      })
      expect(res.json).toHaveBeenCalledWith(mockSummary)
    })

    it('should handle database errors', async () => {
      models.UnsoldProduct.findAll.mockRejectedValue(new Error('Database error'))

      await unsoldProductController.getUnsoldProductsSummary(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: "Database error" })
    })
  })
})