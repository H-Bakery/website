const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const matter = require('gray-matter')

const app = express()
const PORT = process.env.PORT || 5000

// HQ products directory
const HQ_PRODUCTS_DIR =
  process.env.HQ_PRODUCTS_DIR ||
  path.join(__dirname, '..', '..', '..', 'hq', 'products')

/**
 * Read and parse all product markdown files from HQ.
 */
function loadHQProducts() {
  if (!fs.existsSync(HQ_PRODUCTS_DIR)) {
    console.warn(`HQ products directory not found: ${HQ_PRODUCTS_DIR}`)
    return []
  }

  const files = fs
    .readdirSync(HQ_PRODUCTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))

  return files
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(HQ_PRODUCTS_DIR, file), 'utf-8')
        const { data } = matter(raw)
        if (!data.id || !data.name) return null
        return {
          id: data.id,
          numeric_id: data.numeric_id,
          name: data.name,
          category: data.category,
          price: data.price,
          available: data.available ?? true,
          seasonal: data.seasonal ?? false,
          image: data.image || null,
          short_description: data.short_description || '',
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.numeric_id || 0) - (b.numeric_id || 0))
}

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

// Products endpoint — reads real product data from HQ markdown files
app.get('/api/products', (req, res) => {
  const products = loadHQProducts()
  const { category } = req.query
  const filtered = category
    ? products.filter((p) => p.category === category)
    : products
  res.json({ success: true, data: filtered, count: filtered.length })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
