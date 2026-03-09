const express = require('express')
const router = express.Router()

// Mock analytics data generator
const generateRevenueTrends = (startDate, endDate, granularity) => {
  const data = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    data.push({
      date: current.toISOString().split('T')[0],
      revenue:
        Math.round((Math.random() * 500 + 1500 + (isWeekend ? 800 : 0)) * 100) /
        100,
      transactionCount: Math.floor(Math.random() * 50) + 80,
    })
    current.setDate(current.getDate() + (granularity === 'weekly' ? 7 : 1))
  }
  return data
}

const mockProducts = [
  {
    productId: '1',
    productName: 'Bauernbrot',
    quantitySold: 245,
    revenue: 857.5,
  },
  {
    productId: '2',
    productName: 'Croissant',
    quantitySold: 189,
    revenue: 756.0,
  },
  {
    productId: '3',
    productName: 'Brezel',
    quantitySold: 312,
    revenue: 468.0,
  },
  {
    productId: '4',
    productName: 'Vollkornbrot',
    quantitySold: 134,
    revenue: 536.0,
  },
  {
    productId: '5',
    productName: 'Apfelkuchen',
    quantitySold: 67,
    revenue: 301.5,
  },
  {
    productId: '6',
    productName: 'Rosinenbrot',
    quantitySold: 45,
    revenue: 202.5,
  },
  {
    productId: '7',
    productName: 'Baguette',
    quantitySold: 156,
    revenue: 234.0,
  },
  {
    productId: '8',
    productName: 'Käsekuchen',
    quantitySold: 34,
    revenue: 153.0,
  },
]

// GET /api/analytics/revenue-trends
router.get('/revenue-trends', (req, res) => {
  const { startDate, endDate, granularity } = req.query
  const start =
    startDate ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const end = endDate || new Date().toISOString().split('T')[0]
  res.json({
    success: true,
    data: generateRevenueTrends(start, end, granularity || 'daily'),
  })
})

// GET /api/analytics/product-performance
router.get('/product-performance', (req, res) => {
  const { type, limit } = req.query
  const sorted =
    type === 'bottom'
      ? [...mockProducts].sort((a, b) => a.revenue - b.revenue)
      : [...mockProducts].sort((a, b) => b.revenue - a.revenue)
  res.json({ success: true, data: sorted.slice(0, parseInt(limit) || 5) })
})

// GET /api/analytics/cashier-performance
router.get('/cashier-performance', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        userId: '1',
        userName: 'Maria Schmidt',
        transactionCount: 145,
        totalRevenue: 3234.5,
        averageTransactionValue: 22.31,
      },
      {
        userId: '2',
        userName: 'Thomas Müller',
        transactionCount: 132,
        totalRevenue: 2876.0,
        averageTransactionValue: 21.79,
      },
      {
        userId: '3',
        userName: 'Julia Klein',
        transactionCount: 98,
        totalRevenue: 2145.0,
        averageTransactionValue: 21.89,
      },
    ],
  })
})

// GET /api/analytics/payment-methods
router.get('/payment-methods', (req, res) => {
  res.json({
    success: true,
    data: [
      { method: 'Bargeld', count: 267, amount: 3645.5 },
      { method: 'EC-Karte', count: 189, amount: 4123.0 },
      { method: 'Kreditkarte', count: 45, amount: 987.5 },
    ],
  })
})

// GET /api/analytics/summary
router.get('/summary', (req, res) => {
  res.json({
    success: true,
    data: {
      totalRevenue: 8756.0,
      totalTransactions: 501,
      avgTransactionValue: 17.48,
      cashPercentage: 41.6,
      topSellingProduct: mockProducts[0],
      busiestDay: new Date().toISOString().split('T')[0],
    },
  })
})

module.exports = router
