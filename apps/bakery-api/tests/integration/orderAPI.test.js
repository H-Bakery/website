const express = require('express')
const request = require('supertest')

// Mock auth middleware to pass through
jest.mock('../../middleware/authMiddleware', () => ({
  authenticate: (req, res, next) => next(),
}))

describe('Order API Integration Tests', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../middleware/authMiddleware', () => ({
      authenticate: (req, res, next) => next(),
    }))
    const orderRoutes = require('../../routes/orderRoutes')
    app = express()
    app.use(express.json())
    app.use('/api/orders', orderRoutes)
  })

  describe('GET /api/orders', () => {
    it('should return paginated order list', async () => {
      const res = await request(app).get('/api/orders')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.currentPage).toBe(1)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should filter by status', async () => {
      const res = await request(app).get('/api/orders?status=pending')
      expect(res.status).toBe(200)
      expect(res.body.data.every((o) => o.status === 'pending')).toBe(true)
    })

    it('should filter by search term', async () => {
      const res = await request(app).get('/api/orders?search=Hans')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].customerName).toBe('Hans Meier')
    })

    it('should paginate correctly', async () => {
      const res = await request(app).get('/api/orders?page=1&limit=1')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.pagination.itemsPerPage).toBe(1)
      expect(res.body.pagination.totalPages).toBeGreaterThan(1)
    })
  })

  describe('GET /api/orders/:id', () => {
    it('should return order by id', async () => {
      const res = await request(app).get('/api/orders/1')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBe(1)
      expect(res.body.data.customerName).toBe('Hans Meier')
      expect(res.body.data.items).toBeDefined()
    })

    it('should return 404 for non-existent order', async () => {
      const res = await request(app).get('/api/orders/999')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Order not found')
    })
  })

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const newOrder = {
        customerName: 'Lisa Becker',
        items: [{ productId: 1, name: 'Bauernbrot', quantity: 3, price: 3.5 }],
      }
      const res = await request(app).post('/api/orders').send(newOrder)
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.customerName).toBe('Lisa Becker')
      expect(res.body.data.status).toBe('pending')
      expect(res.body.data.total).toBe(10.5)
      expect(res.body.data.id).toBeDefined()
    })

    it('should reject order without customerName', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ items: [{ name: 'Brot', quantity: 1 }] })
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('customerName')
    })

    it('should reject order without items', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ customerName: 'Test' })
      expect(res.status).toBe(400)
    })

    it('should reject order with empty items array', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ customerName: 'Test', items: [] })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/orders/:id', () => {
    it('should update an existing order', async () => {
      const res = await request(app)
        .put('/api/orders/1')
        .send({ customerName: 'Hans Meier-Schmidt' })
      expect(res.status).toBe(200)
      expect(res.body.data.customerName).toBe('Hans Meier-Schmidt')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .put('/api/orders/999')
        .send({ customerName: 'Nobody' })
      expect(res.status).toBe(404)
    })

    it('should not allow id override', async () => {
      const res = await request(app).put('/api/orders/1').send({ id: 999 })
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(1)
    })
  })

  describe('PATCH /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const res = await request(app)
        .patch('/api/orders/1/status')
        .send({ status: 'in_progress' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('in_progress')
    })

    it('should reject invalid status', async () => {
      const res = await request(app)
        .patch('/api/orders/1/status')
        .send({ status: 'invalid' })
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid status')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .patch('/api/orders/999/status')
        .send({ status: 'completed' })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/orders/:id', () => {
    it('should cancel an order (soft delete)', async () => {
      const res = await request(app).delete('/api/orders/1')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('cancelled')

      // Verify order is now cancelled
      const getRes = await request(app).get('/api/orders/1')
      expect(getRes.body.data.status).toBe('cancelled')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await request(app).delete('/api/orders/999')
      expect(res.status).toBe(404)
    })
  })
})
