const request = require('supertest')

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  db: jest.fn(),
  debug: jest.fn(),
  request: jest.fn(),
}))

const app = require('../../index')

describe('Health API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body).toHaveProperty('timestamp')
      expect(res.body).toHaveProperty('uptime')
      expect(res.body).toHaveProperty('environment')
    })

    it('should return valid ISO timestamp', async () => {
      const res = await request(app).get('/health')
      expect(res.status).toBe(200)
      const ts = new Date(res.body.timestamp)
      expect(ts.toISOString()).toBe(res.body.timestamp)
    })

    it('should return numeric uptime', async () => {
      const res = await request(app).get('/health')
      expect(typeof res.body.uptime).toBe('number')
      expect(res.body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should return test environment during tests', async () => {
      const res = await request(app).get('/health')
      expect(res.body.environment).toBe('test')
    })
  })

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent')
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })

    it('should return 404 for unknown nested routes', async () => {
      const res = await request(app).get('/api/unknown/deep/path')
      expect(res.status).toBe(404)
    })
  })
})
