const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const {
  apiLimiter,
  authLimiter,
  publicLimiter,
} = require('./middleware/rateLimitMiddleware')
const authRoutes = require('./routes/authRoutes')
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

app.get('/api/recipes', (req, res) => {
  res.json({ success: true, data: [] })
})

app.get('/products', (req, res) => {
  res.json({ success: true, data: [] })
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

module.exports = app
