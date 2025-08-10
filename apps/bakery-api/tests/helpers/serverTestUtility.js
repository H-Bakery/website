const express = require('express')
const cors = require('cors')
const { sequelize } = require('../../config/database')

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

// Database status
app.get('/api/status', async (req, res) => {
  try {
    await sequelize.authenticate()
    const result = await sequelize.query(
      'SELECT current_database() as db, version() as version'
    )
    res.json({
      status: 'connected',
      database: result[0][0],
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    })
  }
})

// Simple products endpoint
app.get('/api/products', async (req, res) => {
  try {
    const products = await sequelize.query(
      'SELECT * FROM bakery.products LIMIT 10',
      { type: sequelize.QueryTypes.SELECT }
    )
    res.json(products)
  } catch (error) {
    res.status(500).json({
      error: error.message,
    })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(
    `Database URL: ${
      process.env.DATABASE_URL ? 'configured' : 'not configured'
    }`
  )
})
