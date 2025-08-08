const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'bakery-api',
    environment: process.env.NODE_ENV || 'development',
  })
})

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Bakery API is running in Docker!',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not configured',
      REDIS_URL: process.env.REDIS_URL ? 'configured' : 'not configured',
    },
  })
})

// Mock products endpoint
app.get('/api/products', (req, res) => {
  res.json([
    { id: 1, name: 'Sourdough Bread', price: 4.5, category: 'bread' },
    { id: 2, name: 'Croissant', price: 2.5, category: 'pastry' },
    { id: 3, name: 'Chocolate Cake', price: 35.0, category: 'cake' },
    { id: 4, name: 'Ham & Cheese Sandwich', price: 6.5, category: 'sandwich' },
    { id: 5, name: 'Cappuccino', price: 3.5, category: 'beverage' },
  ])
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
