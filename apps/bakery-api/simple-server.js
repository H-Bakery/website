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

// --- Staff management endpoints (mock, no auth for simple server) ---
let staffMembers = [
  {
    id: 1,
    username: 'mmueller',
    email: 'max.mueller@baeckerei.de',
    firstName: 'Max',
    lastName: 'Müller',
    role: 'admin',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    username: 'aschmidt',
    email: 'anna.schmidt@baeckerei.de',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    username: 'tweber',
    email: 'thomas.weber@baeckerei.de',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'staff',
    isActive: true,
    lastLogin: null,
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    username: 'lbecker',
    email: 'lisa.becker@baeckerei.de',
    firstName: 'Lisa',
    lastName: 'Becker',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    username: 'jklein',
    email: 'julia.klein@baeckerei.de',
    firstName: 'Julia',
    lastName: 'Klein',
    role: 'user',
    isActive: false,
    lastLogin: null,
    createdAt: '2024-05-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
]

app.get('/api/staff', (req, res) => {
  const { page = 1, limit = 10, search, role, isActive } = req.query
  let filtered = [...staffMembers]

  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(
      (u) =>
        u.firstName.toLowerCase().includes(s) ||
        u.lastName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.username.toLowerCase().includes(s)
    )
  }

  if (role) filtered = filtered.filter((u) => u.role === role)
  if (isActive !== undefined)
    filtered = filtered.filter((u) => u.isActive === (isActive === 'true'))

  const p = parseInt(page)
  const l = parseInt(limit)
  const start = (p - 1) * l

  res.json({
    users: filtered.slice(start, start + l),
    pagination: {
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / l),
      currentPage: p,
      itemsPerPage: l,
    },
  })
})

app.get('/api/staff/:id', (req, res) => {
  const member = staffMembers.find((s) => s.id === parseInt(req.params.id))
  if (!member) return res.status(404).json({ error: 'Staff member not found' })
  res.json(member)
})

app.post('/api/staff', (req, res) => {
  const { username, email, firstName, lastName, role } = req.body
  const newMember = {
    id: Math.max(...staffMembers.map((s) => s.id)) + 1,
    username,
    email,
    firstName,
    lastName,
    role: role || 'staff',
    isActive: true,
    lastLogin: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  staffMembers.push(newMember)
  res.status(201).json(newMember)
})

app.put('/api/staff/:id', (req, res) => {
  const index = staffMembers.findIndex((s) => s.id === parseInt(req.params.id))
  if (index === -1)
    return res.status(404).json({ error: 'Staff member not found' })

  const { id: _id, createdAt: _ca, ...safeFields } = req.body
  staffMembers[index] = {
    ...staffMembers[index],
    ...safeFields,
    updatedAt: new Date().toISOString(),
  }
  res.json(staffMembers[index])
})

app.delete('/api/staff/:id', (req, res) => {
  const index = staffMembers.findIndex((s) => s.id === parseInt(req.params.id))
  if (index === -1)
    return res.status(404).json({ error: 'Staff member not found' })

  staffMembers[index].isActive = false
  staffMembers[index].updatedAt = new Date().toISOString()
  res.json({ message: 'Staff member deactivated successfully' })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
