const request = require('supertest')
const express = require('express')
const analyticsRoutes = require('../../routes/analyticsRoutes')

describe('Analytics API Integration Tests', () => {
  let app

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/analytics', analyticsRoutes)
  })

  describe('GET /api/analytics/revenue-trends', () => {
    it('should return revenue trends with default params', async () => {
      const res = await request(app).get('/api/analytics/revenue-trends')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should return data entries with date, revenue, transactionCount', async () => {
      const res = await request(app).get('/api/analytics/revenue-trends')
      const entry = res.body.data[0]
      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('revenue')
      expect(entry).toHaveProperty('transactionCount')
      expect(typeof entry.revenue).toBe('number')
      expect(typeof entry.transactionCount).toBe('number')
    })

    it('should accept date range params', async () => {
      const res = await request(app).get(
        '/api/analytics/revenue-trends?startDate=2026-03-01&endDate=2026-03-03'
      )
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.length).toBeLessThanOrEqual(3)
    })

    it('should accept granularity param', async () => {
      const res = await request(app).get(
        '/api/analytics/revenue-trends?startDate=2026-03-01&endDate=2026-03-14&granularity=weekly'
      )
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/analytics/product-performance', () => {
    it('should return top products by default', async () => {
      const res = await request(app).get('/api/analytics/product-performance')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeLessThanOrEqual(5)
    })

    it('should return products sorted by revenue descending', async () => {
      const res = await request(app).get('/api/analytics/product-performance')
      const data = res.body.data
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].revenue).toBeGreaterThanOrEqual(data[i].revenue)
      }
    })

    it('should support bottom performers', async () => {
      const res = await request(app).get(
        '/api/analytics/product-performance?type=bottom&limit=3'
      )
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeLessThanOrEqual(3)
      const data = res.body.data
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].revenue).toBeLessThanOrEqual(data[i].revenue)
      }
    })

    it('should respect limit param', async () => {
      const res = await request(app).get(
        '/api/analytics/product-performance?limit=2'
      )
      expect(res.body.data.length).toBe(2)
    })

    it('should have required product fields', async () => {
      const res = await request(app).get('/api/analytics/product-performance')
      const product = res.body.data[0]
      expect(product).toHaveProperty('productId')
      expect(product).toHaveProperty('productName')
      expect(product).toHaveProperty('quantitySold')
      expect(product).toHaveProperty('revenue')
    })
  })

  describe('GET /api/analytics/cashier-performance', () => {
    it('should return cashier performance data', async () => {
      const res = await request(app).get('/api/analytics/cashier-performance')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should have required cashier fields', async () => {
      const res = await request(app).get('/api/analytics/cashier-performance')
      const cashier = res.body.data[0]
      expect(cashier).toHaveProperty('userId')
      expect(cashier).toHaveProperty('userName')
      expect(cashier).toHaveProperty('transactionCount')
      expect(cashier).toHaveProperty('totalRevenue')
      expect(cashier).toHaveProperty('averageTransactionValue')
    })
  })

  describe('GET /api/analytics/payment-methods', () => {
    it('should return payment method breakdown', async () => {
      const res = await request(app).get('/api/analytics/payment-methods')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should have method, count, and amount fields', async () => {
      const res = await request(app).get('/api/analytics/payment-methods')
      const method = res.body.data[0]
      expect(method).toHaveProperty('method')
      expect(method).toHaveProperty('count')
      expect(method).toHaveProperty('amount')
    })
  })

  describe('GET /api/analytics/summary', () => {
    it('should return analytics summary', async () => {
      const res = await request(app).get('/api/analytics/summary')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('totalRevenue')
      expect(res.body.data).toHaveProperty('totalTransactions')
      expect(res.body.data).toHaveProperty('avgTransactionValue')
      expect(res.body.data).toHaveProperty('topSellingProduct')
    })
  })
})
