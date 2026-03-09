const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')

// In-memory mock order data
let orders = [
  {
    id: 1,
    customerName: 'Hans Meier',
    items: [
      { productId: 1, name: 'Bauernbrot', quantity: 2, price: 3.5 },
      { productId: 3, name: 'Brezel', quantity: 5, price: 1.5 },
    ],
    total: 14.5,
    status: 'pending',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 2,
    customerName: 'Maria Schmidt',
    items: [{ productId: 2, name: 'Croissant', quantity: 4, price: 4.0 }],
    total: 16.0,
    status: 'completed',
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 3,
    customerName: 'Thomas Weber',
    items: [
      { productId: 4, name: 'Vollkornbrot', quantity: 1, price: 4.0 },
      { productId: 5, name: 'Apfelkuchen', quantity: 1, price: 4.5 },
    ],
    total: 8.5,
    status: 'in_progress',
    createdAt: '2026-03-02T07:30:00Z',
    updatedAt: '2026-03-02T08:00:00Z',
  },
]

// GET /api/orders - List orders with filtering and pagination
router.get('/', authenticate, (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query
  let filtered = [...orders]

  if (status) filtered = filtered.filter((o) => o.status === status)

  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter((o) => o.customerName.toLowerCase().includes(s))
  }

  const p = parseInt(page)
  const l = parseInt(limit)
  const start = (p - 1) * l

  res.json({
    success: true,
    data: filtered.slice(start, start + l),
    pagination: {
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / l),
      currentPage: p,
      itemsPerPage: l,
    },
  })
})

// GET /api/orders/:id
router.get('/:id', authenticate, (req, res) => {
  const order = orders.find((o) => o.id === parseInt(req.params.id))
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json({ success: true, data: order })
})

// POST /api/orders
router.post('/', authenticate, (req, res) => {
  const { customerName, items } = req.body

  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: 'customerName and items are required' })
  }

  const total = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  )

  const newOrder = {
    id: Math.max(...orders.map((o) => o.id)) + 1,
    customerName,
    items,
    total: Math.round(total * 100) / 100,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  orders.push(newOrder)
  res.status(201).json({ success: true, data: newOrder })
})

// PUT /api/orders/:id
router.put('/:id', authenticate, (req, res) => {
  const index = orders.findIndex((o) => o.id === parseInt(req.params.id))
  if (index === -1) return res.status(404).json({ error: 'Order not found' })

  const { id: _id, createdAt: _ca, ...safeFields } = req.body
  orders[index] = {
    ...orders[index],
    ...safeFields,
    updatedAt: new Date().toISOString(),
  }
  res.json({ success: true, data: orders[index] })
})

// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticate, (req, res) => {
  const index = orders.findIndex((o) => o.id === parseInt(req.params.id))
  if (index === -1) return res.status(404).json({ error: 'Order not found' })

  const { status } = req.body
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
  }

  orders[index].status = status
  orders[index].updatedAt = new Date().toISOString()
  res.json({ success: true, data: orders[index] })
})

// DELETE /api/orders/:id
router.delete('/:id', authenticate, (req, res) => {
  const index = orders.findIndex((o) => o.id === parseInt(req.params.id))
  if (index === -1) return res.status(404).json({ error: 'Order not found' })

  orders[index].status = 'cancelled'
  orders[index].updatedAt = new Date().toISOString()
  res.json({ success: true, message: 'Order cancelled successfully' })
})

module.exports = router
