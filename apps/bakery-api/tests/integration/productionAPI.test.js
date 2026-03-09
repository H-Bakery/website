const express = require('express')
const request = require('supertest')

// Mock auth middleware to pass through
jest.mock('../../middleware/authMiddleware', () => ({
  authenticate: (req, res, next) => next(),
}))

describe('Production API Integration Tests', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../middleware/authMiddleware', () => ({
      authenticate: (req, res, next) => next(),
    }))
    const productionRoutes = require('../../routes/productionRoutes')
    app = express()
    app.use(express.json())
    app.use('/api/production', productionRoutes)
  })

  describe('GET /api/production/schedules', () => {
    it('should return production schedules', async () => {
      const res = await request(app).get('/api/production/schedules')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body).toHaveProperty('total')
    })

    it('should filter by date', async () => {
      const res = await request(app).get(
        '/api/production/schedules?date=2026-03-09'
      )
      expect(res.status).toBe(200)
      expect(res.body.data.every((s) => s.date === '2026-03-09')).toBe(true)
    })

    it('should filter by status', async () => {
      const res = await request(app).get(
        '/api/production/schedules?status=active'
      )
      expect(res.status).toBe(200)
      expect(res.body.data.every((s) => s.status === 'active')).toBe(true)
    })

    it('should have required schedule fields', async () => {
      const res = await request(app).get('/api/production/schedules')
      const schedule = res.body.data[0]
      expect(schedule).toHaveProperty('id')
      expect(schedule).toHaveProperty('name')
      expect(schedule).toHaveProperty('date')
      expect(schedule).toHaveProperty('status')
      expect(schedule).toHaveProperty('items')
    })
  })

  describe('POST /api/production/schedules', () => {
    it('should create a new schedule', async () => {
      const newSchedule = {
        name: 'Abend-Backplan',
        date: '2026-03-10',
        type: 'daily',
        items: [{ productId: 2, name: 'Croissant', quantity: 80 }],
      }
      const res = await request(app)
        .post('/api/production/schedules')
        .send(newSchedule)
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe('Abend-Backplan')
      expect(res.body.data.status).toBe('pending')
      expect(res.body.data.id).toBeDefined()
    })

    it('should reject schedule without name', async () => {
      const res = await request(app)
        .post('/api/production/schedules')
        .send({ date: '2026-03-10' })
      expect(res.status).toBe(400)
    })

    it('should reject schedule without date', async () => {
      const res = await request(app)
        .post('/api/production/schedules')
        .send({ name: 'Test' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/production/schedules/:id', () => {
    it('should update a schedule', async () => {
      const res = await request(app)
        .put('/api/production/schedules/1')
        .send({ name: 'Updated Morgen-Backplan' })
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Updated Morgen-Backplan')
    })

    it('should return 404 for non-existent schedule', async () => {
      const res = await request(app)
        .put('/api/production/schedules/999')
        .send({ name: 'No' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/production/status', () => {
    it('should return production status', async () => {
      const res = await request(app).get(
        '/api/production/status?date=2026-03-09'
      )
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('date')
      expect(res.body.data).toHaveProperty('schedulesCount')
      expect(res.body.data).toHaveProperty('batchesTotal')
      expect(res.body.data).toHaveProperty('batchesPending')
      expect(res.body.data).toHaveProperty('batchesInProgress')
      expect(res.body.data).toHaveProperty('batchesCompleted')
    })
  })

  describe('POST /api/production/batches', () => {
    it('should create a new batch', async () => {
      const newBatch = {
        scheduleId: 1,
        productName: 'Roggenbrot',
        quantity: 30,
        assignedTo: 'Thomas Weber',
      }
      const res = await request(app)
        .post('/api/production/batches')
        .send(newBatch)
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.productName).toBe('Roggenbrot')
      expect(res.body.data.status).toBe('pending')
    })

    it('should reject batch without required fields', async () => {
      const res = await request(app)
        .post('/api/production/batches')
        .send({ scheduleId: 1 })
      expect(res.status).toBe(400)
    })

    it('should reject batch with non-existent schedule', async () => {
      const res = await request(app)
        .post('/api/production/batches')
        .send({ scheduleId: 999, productName: 'Brot', quantity: 10 })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/production/batches/:id/start', () => {
    it('should start a pending batch', async () => {
      const res = await request(app).post('/api/production/batches/2/start')
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('in_progress')
      expect(res.body.data.startedAt).toBeDefined()
    })

    it('should return 404 for non-existent batch', async () => {
      const res = await request(app).post('/api/production/batches/999/start')
      expect(res.status).toBe(404)
    })

    it('should reject starting an already in-progress batch', async () => {
      const res = await request(app).post('/api/production/batches/1/start')
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/production/batches/:id/complete', () => {
    it('should complete an in-progress batch', async () => {
      const res = await request(app)
        .post('/api/production/batches/1/complete')
        .send({ notes: 'Gut gelaufen' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('completed')
      expect(res.body.data.completedAt).toBeDefined()
      expect(res.body.data.notes).toBe('Gut gelaufen')
    })

    it('should reject completing a pending batch', async () => {
      const res = await request(app).post('/api/production/batches/2/complete')
      expect(res.status).toBe(400)
    })

    it('should return 404 for non-existent batch', async () => {
      const res = await request(app).post(
        '/api/production/batches/999/complete'
      )
      expect(res.status).toBe(404)
    })
  })
})
