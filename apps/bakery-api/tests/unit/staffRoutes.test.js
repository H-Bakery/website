const express = require('express')
const request = require('supertest')

// Mock auth middleware to pass through
jest.mock('../../middleware/authMiddleware', () => ({
  authenticate: (req, res, next) => next(),
}))

const staffRoutes = require('../../routes/staffRoutes')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/staff', staffRoutes)
  return app
}

describe('Staff Routes', () => {
  let app

  beforeEach(() => {
    // Re-import to reset in-memory data
    jest.resetModules()
    jest.mock('../../middleware/authMiddleware', () => ({
      authenticate: (req, res, next) => next(),
    }))
    const routes = require('../../routes/staffRoutes')
    app = express()
    app.use(express.json())
    app.use('/api/staff', routes)
  })

  describe('GET /api/staff', () => {
    it('returns paginated staff list', async () => {
      const res = await request(app).get('/api/staff')
      expect(res.status).toBe(200)
      expect(res.body.users).toBeDefined()
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.currentPage).toBe(1)
      expect(res.body.users.length).toBeGreaterThan(0)
    })

    it('filters by search term', async () => {
      const res = await request(app).get('/api/staff?search=Max')
      expect(res.status).toBe(200)
      expect(res.body.users.length).toBe(1)
      expect(res.body.users[0].firstName).toBe('Max')
    })

    it('filters by role', async () => {
      const res = await request(app).get('/api/staff?role=admin')
      expect(res.status).toBe(200)
      expect(res.body.users.every((u) => u.role === 'admin')).toBe(true)
    })

    it('filters by isActive status', async () => {
      const res = await request(app).get('/api/staff?isActive=false')
      expect(res.status).toBe(200)
      expect(res.body.users.every((u) => u.isActive === false)).toBe(true)
    })

    it('paginates correctly', async () => {
      const res = await request(app).get('/api/staff?page=1&limit=2')
      expect(res.status).toBe(200)
      expect(res.body.users.length).toBeLessThanOrEqual(2)
      expect(res.body.pagination.itemsPerPage).toBe(2)
    })
  })

  describe('GET /api/staff/:id', () => {
    it('returns a staff member by id', async () => {
      const res = await request(app).get('/api/staff/1')
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(1)
      expect(res.body.username).toBe('mmueller')
    })

    it('returns 404 for non-existent id', async () => {
      const res = await request(app).get('/api/staff/999')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/staff', () => {
    it('creates a new staff member', async () => {
      const newStaff = {
        username: 'neuer',
        email: 'neu@baeckerei.de',
        firstName: 'Neuer',
        lastName: 'Mitarbeiter',
        role: 'staff',
      }
      const res = await request(app).post('/api/staff').send(newStaff)
      expect(res.status).toBe(201)
      expect(res.body.username).toBe('neuer')
      expect(res.body.isActive).toBe(true)
      expect(res.body.id).toBeDefined()
    })
  })

  describe('PUT /api/staff/:id', () => {
    it('updates an existing staff member', async () => {
      const res = await request(app)
        .put('/api/staff/1')
        .send({ firstName: 'Maximilian' })
      expect(res.status).toBe(200)
      expect(res.body.firstName).toBe('Maximilian')
    })

    it('returns 404 for non-existent id', async () => {
      const res = await request(app)
        .put('/api/staff/999')
        .send({ firstName: 'Nobody' })
      expect(res.status).toBe(404)
    })

    it('does not allow id override', async () => {
      const res = await request(app)
        .put('/api/staff/1')
        .send({ id: 999, firstName: 'Hacked' })
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(1)
    })

    it('does not allow createdAt override', async () => {
      const originalRes = await request(app).get('/api/staff/1')
      const originalCreatedAt = originalRes.body.createdAt

      const res = await request(app)
        .put('/api/staff/1')
        .send({ createdAt: '2000-01-01T00:00:00Z' })
      expect(res.status).toBe(200)
      expect(res.body.createdAt).toBe(originalCreatedAt)
    })
  })

  describe('DELETE /api/staff/:id', () => {
    it('soft-deletes a staff member', async () => {
      const res = await request(app).delete('/api/staff/1')
      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deactivated')

      const getRes = await request(app).get('/api/staff/1')
      expect(getRes.body.isActive).toBe(false)
    })

    it('returns 404 for non-existent id', async () => {
      const res = await request(app).delete('/api/staff/999')
      expect(res.status).toBe(404)
    })
  })
})
