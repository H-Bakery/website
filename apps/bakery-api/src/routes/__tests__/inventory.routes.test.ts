import request from 'supertest'
import express from 'express'
import inventoryRoutes from '../inventory.routes'
import inventoryController from '../../controllers/inventory.controller'
import * as validators from '../../validators/inventory.validator'

// Mock the controller
jest.mock('../../controllers/inventory.controller')

const app = express()
app.use(express.json())
app.use('/api/inventory', inventoryRoutes)

describe('Inventory Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/inventory', () => {
    it('should get all inventory items', async () => {
      const mockResponse = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }

      ;(inventoryController.getAll as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockResponse)
        }
      )

      const response = await request(app).get('/api/inventory').expect(200)

      expect(response.body).toEqual(mockResponse)
      expect(inventoryController.getAll).toHaveBeenCalled()
    })

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/inventory?page=invalid&limit=200')
        .expect(400)

      expect(response.body).toHaveProperty('errors')
    })
  })

  describe('GET /api/inventory/:id', () => {
    it('should get inventory item by id', async () => {
      const mockItem = {
        id: 1,
        productId: 1,
        quantity: 100,
      }

      ;(inventoryController.getById as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockItem)
        }
      )

      const response = await request(app).get('/api/inventory/1').expect(200)

      expect(response.body).toEqual(mockItem)
    })

    it('should validate id parameter', async () => {
      const response = await request(app)
        .get('/api/inventory/invalid')
        .expect(400)

      expect(response.body).toHaveProperty('errors')
    })
  })

  describe('POST /api/inventory', () => {
    it('should create new inventory item', async () => {
      const newItem = {
        productId: 1,
        quantity: 100,
        minimumQuantity: 20,
        unit: 'kg',
      }

      const mockCreatedItem = {
        id: 1,
        ...newItem,
      }

      ;(inventoryController.create as jest.Mock).mockImplementation(
        (req, res) => {
          res.status(201).json(mockCreatedItem)
        }
      )

      const response = await request(app)
        .post('/api/inventory')
        .send(newItem)
        .expect(201)

      expect(response.body).toEqual(mockCreatedItem)
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/inventory')
        .send({})
        .expect(400)

      expect(response.body).toHaveProperty('errors')
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'productId' }),
          expect.objectContaining({ path: 'minimumQuantity' }),
        ])
      )
    })
  })

  describe('PUT /api/inventory/:id', () => {
    it('should update inventory item', async () => {
      const updateData = {
        minimumQuantity: 30,
        reorderPoint: 50,
        location: 'A1-B2',
      }

      const mockUpdatedItem = {
        id: 1,
        ...updateData,
      }

      ;(inventoryController.update as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockUpdatedItem)
        }
      )

      const response = await request(app)
        .put('/api/inventory/1')
        .send(updateData)
        .expect(200)

      expect(response.body).toEqual(mockUpdatedItem)
    })

    it('should validate update fields', async () => {
      const response = await request(app)
        .put('/api/inventory/1')
        .send({ minimumQuantity: -10 })
        .expect(400)

      expect(response.body).toHaveProperty('errors')
    })
  })

  describe('POST /api/inventory/:id/adjust', () => {
    it('should adjust stock', async () => {
      const adjustmentData = {
        adjustmentType: 'increase',
        quantity: 50,
        reason: 'New delivery',
      }

      const mockAdjustedItem = {
        id: 1,
        quantity: 150,
      }

      ;(inventoryController.adjustStock as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockAdjustedItem)
        }
      )

      const response = await request(app)
        .post('/api/inventory/1/adjust')
        .send(adjustmentData)
        .expect(200)

      expect(response.body).toEqual(mockAdjustedItem)
    })

    it('should validate adjustment data', async () => {
      const response = await request(app)
        .post('/api/inventory/1/adjust')
        .send({
          adjustmentType: 'invalid',
          quantity: -10,
        })
        .expect(400)

      expect(response.body).toHaveProperty('errors')
    })
  })

  describe('DELETE /api/inventory/:id', () => {
    it('should delete inventory item', async () => {
      ;(inventoryController.delete as jest.Mock).mockImplementation(
        (req, res) => {
          res.json({ message: 'Inventory item deleted successfully' })
        }
      )

      const response = await request(app).delete('/api/inventory/1').expect(200)

      expect(response.body).toHaveProperty('message')
    })
  })

  describe('GET /api/inventory/low-stock', () => {
    it('should get low stock items', async () => {
      const mockLowStockItems = [{ id: 1, quantity: 5, minimumQuantity: 10 }]

      ;(inventoryController.getLowStock as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockLowStockItems)
        }
      )

      const response = await request(app)
        .get('/api/inventory/low-stock')
        .expect(200)

      expect(response.body).toEqual(mockLowStockItems)
    })
  })

  describe('GET /api/inventory/categories', () => {
    it('should get categories', async () => {
      const mockCategories = ['Rohstoffe', 'Verpackung', 'Hilfsstoffe']

      ;(inventoryController.getCategories as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockCategories)
        }
      )

      const response = await request(app)
        .get('/api/inventory/categories')
        .expect(200)

      expect(response.body).toEqual(mockCategories)
    })
  })

  describe('GET /api/inventory/suppliers', () => {
    it('should get suppliers', async () => {
      const mockSuppliers = ['Supplier A', 'Supplier B']

      ;(inventoryController.getSuppliers as jest.Mock).mockImplementation(
        (req, res) => {
          res.json(mockSuppliers)
        }
      )

      const response = await request(app)
        .get('/api/inventory/suppliers')
        .expect(200)

      expect(response.body).toEqual(mockSuppliers)
    })
  })
})
