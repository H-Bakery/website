const express = require('express')
const request = require('supertest')

// Mock auth middleware to pass through
jest.mock('../../middleware/authMiddleware', () => ({
  authenticate: (req, res, next) => next(),
}))

describe('Notification API Integration Tests', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../middleware/authMiddleware', () => ({
      authenticate: (req, res, next) => next(),
    }))
    const notificationRoutes = require('../../routes/notificationRoutes')
    app = express()
    app.use(express.json())
    app.use('/api/notifications', notificationRoutes)
  })

  describe('GET /api/notifications', () => {
    it('should return notification list', async () => {
      const res = await request(app).get('/api/notifications')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.notifications)).toBe(true)
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('unreadCount')
      expect(res.body).toHaveProperty('pagination')
    })

    it('should exclude archived notifications', async () => {
      const res = await request(app).get('/api/notifications')
      expect(res.body.notifications.every((n) => !n.isArchived)).toBe(true)
    })

    it('should filter by type', async () => {
      const res = await request(app).get('/api/notifications?type=warning')
      expect(res.status).toBe(200)
      expect(res.body.notifications.every((n) => n.type === 'warning')).toBe(
        true
      )
    })

    it('should filter by category', async () => {
      const res = await request(app).get(
        '/api/notifications?category=inventory'
      )
      expect(res.status).toBe(200)
      expect(
        res.body.notifications.every((n) => n.category === 'inventory')
      ).toBe(true)
    })

    it('should filter by read status', async () => {
      const res = await request(app).get('/api/notifications?isRead=false')
      expect(res.status).toBe(200)
      expect(res.body.notifications.every((n) => !n.isRead)).toBe(true)
    })
  })

  describe('GET /api/notifications/stats/summary', () => {
    it('should return notification statistics', async () => {
      const res = await request(app).get('/api/notifications/stats/summary')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.stats).toHaveProperty('total')
      expect(res.body.stats).toHaveProperty('unread')
      expect(res.body.stats).toHaveProperty('archived')
      expect(res.body.stats).toHaveProperty('byType')
      expect(res.body.stats).toHaveProperty('byPriority')
    })
  })

  describe('GET /api/notifications/:id', () => {
    it('should return a notification by id', async () => {
      const res = await request(app).get('/api/notifications/notif-001')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.notification.id).toBe('notif-001')
      expect(res.body.notification.title).toBeDefined()
    })

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app).get('/api/notifications/nonexistent')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/notifications', () => {
    it('should create a new notification', async () => {
      const newNotification = {
        type: 'info',
        category: 'production',
        title: 'Batch fertig',
        message: 'Batch #42 wurde abgeschlossen',
        priority: 'low',
      }
      const res = await request(app)
        .post('/api/notifications')
        .send(newNotification)
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.notification.title).toBe('Batch fertig')
      expect(res.body.notification.isRead).toBe(false)
      expect(res.body.notification.id).toBeDefined()
    })

    it('should reject notification without title', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .send({ message: 'Test' })
      expect(res.status).toBe(400)
    })

    it('should reject notification without message', async () => {
      const res = await request(app)
        .post('/api/notifications')
        .send({ title: 'Test' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const res = await request(app).put('/api/notifications/notif-001/read')
      expect(res.status).toBe(200)
      expect(res.body.notification.isRead).toBe(true)
      expect(res.body.notification.readAt).toBeDefined()
    })

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app).put('/api/notifications/nonexistent/read')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/notifications/mark-read (bulk)', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/mark-read')
        .send({ all: true })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.updatedCount).toBeGreaterThanOrEqual(0)
    })

    it('should mark specific notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/mark-read')
        .send({ notificationIds: ['notif-001'] })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should reject without ids or all flag', async () => {
      const res = await request(app)
        .put('/api/notifications/mark-read')
        .send({})
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/notifications/:id/archive', () => {
    it('should archive a notification', async () => {
      const res = await request(app).put('/api/notifications/notif-001/archive')
      expect(res.status).toBe(200)
      expect(res.body.notification.isArchived).toBe(true)
      expect(res.body.notification.archivedAt).toBeDefined()
    })

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app).put(
        '/api/notifications/nonexistent/archive'
      )
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const res = await request(app).delete('/api/notifications/notif-001')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify it's gone
      const getRes = await request(app).get('/api/notifications/notif-001')
      expect(getRes.status).toBe(404)
    })

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app).delete('/api/notifications/nonexistent')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/notifications/preferences', () => {
    it('should return notification preferences', async () => {
      const res = await request(app).get('/api/notifications/preferences')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.preferences).toHaveProperty('email')
      expect(res.body.preferences).toHaveProperty('push')
      expect(res.body.preferences).toHaveProperty('autoArchive')
    })
  })

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      const res = await request(app)
        .put('/api/notifications/preferences')
        .send({
          email: { enabled: false },
          push: { enabled: true, categories: ['order'] },
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.preferences.email.enabled).toBe(false)
    })
  })
})
