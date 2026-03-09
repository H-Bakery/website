const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const {
  apiLimiter,
  authLimiter,
  publicLimiter,
} = require('./middleware/rateLimitMiddleware')
const authRoutes = require('./routes/authRoutes')
const recipeRoutes = require('./routes/recipeRoutes')
const workflowRoutes = require('./routes/workflowRoutes')
const inventoryRoutes = require('./routes/inventoryRoutes')
const cashRoutes = require('./routes/cashRoutes')
const analyticsRoutes = require('./routes/analyticsRoutes')
const reportingRoutes = require('./routes/reportingRoutes')
const orderRoutes = require('./routes/orderRoutes')
const productionRoutes = require('./routes/productionRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const staffRoutes = require('./routes/staffRoutes')
const logger = require('./utils/logger')

const app = express()

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: [
          "'self'",
          'ws://localhost:3000',
          'ws://localhost:4200',
          'ws://localhost:4201',
          'ws://localhost:5000',
        ],
        imgSrc: ["'self'", 'data:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  })
)

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:4200',
        'http://localhost:4201',
        'http://localhost:5000',
      ]
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || '*')
      } else {
        callback(null, origin)
      }
    },
    credentials: true,
  })
)

// Body parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting (order matters: general first, then specific overrides)
app.use('/api', apiLimiter)
app.use('/api/auth', authLimiter)
app.use('/products', publicLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/recipes', recipeRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/cash', cashRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/reports', reportingRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/production', productionRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/staff', staffRoutes)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server when run directly
const PORT = process.env.PORT || 5000

if (require.main === module) {
  const { syncDatabase } = require('./models')

  syncDatabase()
    .then(() => {
      app.listen(PORT, () => {
        logger.info(`Server running on http://localhost:${PORT}`)
      })
    })
    .catch((err) => {
      logger.error('Failed to initialize database:', err)
      process.exit(1)
    })
}

module.exports = app
