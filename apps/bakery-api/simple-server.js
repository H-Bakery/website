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
        const { data, content } = matter(raw)
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
          description:
            content.replace(/^\s*#[^\n]*\n+/, '').trim() ||
            data.short_description ||
            '',
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

// --- Orders endpoints (mock) ---
let orders = [
  {
    id: '1',
    customerName: 'Max Mustermann',
    items: [
      { productId: 'roggenbrot', name: 'Roggenbrot', quantity: 2, price: 4.5 },
      { productId: 'croissant', name: 'Croissant', quantity: 3, price: 1.8 },
    ],
    total: 14.4,
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    customerName: 'Anna Schmidt',
    items: [
      {
        productId: 'vollkornbrot',
        name: 'Vollkornbrot',
        quantity: 1,
        price: 3.9,
      },
    ],
    total: 3.9,
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

app.get('/api/orders', (req, res) => {
  const { status } = req.query
  const filtered = status ? orders.filter((o) => o.status === status) : orders
  res.json({ success: true, data: filtered, count: filtered.length })
})

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id)
  if (!order)
    return res.status(404).json({ success: false, error: 'Order not found' })
  res.json({ success: true, data: order })
})

app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: String(orders.length + 1),
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  orders.push(newOrder)
  res.status(201).json({ success: true, data: newOrder })
})

app.put('/api/orders/:id', (req, res) => {
  const index = orders.findIndex((o) => o.id === req.params.id)
  if (index === -1)
    return res.status(404).json({ success: false, error: 'Order not found' })
  orders[index] = {
    ...orders[index],
    ...req.body,
    id: orders[index].id,
    updatedAt: new Date().toISOString(),
  }
  res.json({ success: true, data: orders[index] })
})

app.delete('/api/orders/:id', (req, res) => {
  const index = orders.findIndex((o) => o.id === req.params.id)
  if (index === -1)
    return res.status(404).json({ success: false, error: 'Order not found' })
  orders.splice(index, 1)
  res.json({ success: true, message: 'Order deleted' })
})

// --- Cash endpoints (mock) ---
let cashEntries = [
  {
    id: '1',
    type: 'income',
    amount: 245.5,
    description: 'Tageseinnahmen Montag',
    category: 'sales',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'expense',
    amount: 89.0,
    description: 'Mehl-Lieferung',
    category: 'supplies',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
]

app.get('/api/cash', (req, res) => {
  const { type, date } = req.query
  let filtered = [...cashEntries]
  if (type) filtered = filtered.filter((e) => e.type === type)
  if (date) filtered = filtered.filter((e) => e.date === date)
  const balance = filtered.reduce(
    (sum, e) => sum + (e.type === 'income' ? e.amount : -e.amount),
    0
  )
  res.json({ success: true, data: filtered, balance, count: filtered.length })
})

app.post('/api/cash', (req, res) => {
  const entry = {
    id: String(cashEntries.length + 1),
    ...req.body,
    createdAt: new Date().toISOString(),
  }
  cashEntries.push(entry)
  res.status(201).json({ success: true, data: entry })
})

app.delete('/api/cash/:id', (req, res) => {
  const index = cashEntries.findIndex((e) => e.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Cash entry not found' })
  cashEntries.splice(index, 1)
  res.json({ success: true, message: 'Cash entry deleted' })
})

// --- Notifications endpoints (mock) ---
let notifications = [
  {
    id: '1',
    type: 'info',
    category: 'system',
    priority: 'medium',
    title: 'System Update',
    message: 'Das System wurde erfolgreich aktualisiert.',
    read: false,
    channel: 'inApp',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '2',
    type: 'warning',
    category: 'inventory',
    priority: 'high',
    title: 'Niedriger Bestand',
    message: 'Roggenmehl Bestand unter Mindestmenge.',
    read: false,
    channel: 'inApp',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    type: 'success',
    category: 'order',
    priority: 'low',
    title: 'Neue Bestellung',
    message: 'Bestellung #42 wurde aufgegeben.',
    read: true,
    channel: 'inApp',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: notifications, count: notifications.length })
})

app.post('/api/notifications', (req, res) => {
  const notification = {
    id: String(notifications.length + 1),
    ...req.body,
    read: false,
    channel: 'inApp',
    createdAt: new Date().toISOString(),
  }
  notifications.push(notification)
  res.status(201).json({ success: true, data: notification })
})

app.put('/api/notifications/:id/read', (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id)
  if (!notification)
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  notification.read = true
  res.json({ success: true, data: notification })
})

app.delete('/api/notifications/:id', (req, res) => {
  const index = notifications.findIndex((n) => n.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  notifications.splice(index, 1)
  res.json({ success: true, message: 'Notification deleted' })
})

app.post('/api/notifications/:id/archive', (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id)
  if (!notification)
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  const index = notifications.indexOf(notification)
  notifications.splice(index, 1)
  res.json({ success: true, message: 'Notification archived' })
})

// --- Notification preferences (mock) ---
let notificationPreferences = {
  userId: 'default',
  channels: {
    inApp: { enabled: true, categories: [], minPriority: 'low' },
    email: { enabled: false, categories: [], minPriority: 'medium' },
    sms: { enabled: false, categories: [], minPriority: 'high' },
    push: { enabled: false, categories: [], minPriority: 'medium' },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'Europe/Berlin',
  },
  sound: { enabled: true, volume: 50 },
  digest: {
    enabled: false,
    frequency: 'daily',
    time: '09:00',
    categories: [],
  },
  language: 'de',
}

app.get('/api/preferences', (req, res) => {
  res.json({ success: true, data: notificationPreferences })
})

app.put('/api/preferences', (req, res) => {
  notificationPreferences = { ...notificationPreferences, ...req.body }
  res.json({ success: true, data: notificationPreferences })
})

// --- HQ Product edit endpoint (writes back to markdown files) ---
app.get('/api/hq-products/:id', (req, res) => {
  const products = loadHQProducts()
  const product = products.find((p) => p.id === req.params.id)
  if (!product)
    return res.status(404).json({ success: false, error: 'Product not found' })
  res.json({ success: true, data: product })
})

app.put('/api/hq-products/:id', (req, res) => {
  if (!fs.existsSync(HQ_PRODUCTS_DIR)) {
    return res
      .status(500)
      .json({ success: false, error: 'HQ products directory not found' })
  }

  const files = fs
    .readdirSync(HQ_PRODUCTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))

  let targetFile = null
  let originalData = null
  let originalContent = null

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(HQ_PRODUCTS_DIR, file), 'utf-8')
      const parsed = matter(raw)
      if (parsed.data.id === req.params.id) {
        targetFile = file
        originalData = parsed.data
        originalContent = parsed.content
        break
      }
    } catch {
      continue
    }
  }

  if (!targetFile) {
    return res.status(404).json({ success: false, error: 'Product not found' })
  }

  const {
    name,
    category,
    price,
    short_description,
    description,
    available,
    seasonal,
  } = req.body

  const updatedData = { ...originalData }
  if (name !== undefined) updatedData.name = name
  if (category !== undefined) updatedData.category = category
  if (price !== undefined) updatedData.price = parseFloat(price)
  if (short_description !== undefined)
    updatedData.short_description = short_description
  if (available !== undefined) updatedData.available = available
  if (seasonal !== undefined) updatedData.seasonal = seasonal

  let updatedContent = originalContent
  if (description !== undefined) {
    updatedContent = `\n# ${updatedData.name}\n\n${description}\n`
  }

  const output = matter.stringify(updatedContent, updatedData)
  fs.writeFileSync(path.join(HQ_PRODUCTS_DIR, targetFile), output, 'utf-8')

  res.json({ success: true, data: { ...updatedData, description } })
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

// --- Production endpoints (mock) ---
let productionPlans = [
  {
    id: '1',
    date: '2026-03-20',
    product: 'Kornbrot',
    quantity: 50,
    status: 'planned',
  },
  {
    id: '2',
    date: '2026-03-20',
    product: 'Brötchen',
    quantity: 200,
    status: 'planned',
  },
  {
    id: '3',
    date: '2026-03-20',
    product: 'Croissant',
    quantity: 80,
    status: 'planned',
  },
  {
    id: '4',
    date: '2026-03-19',
    product: 'Roggenbrot',
    quantity: 40,
    status: 'completed',
  },
  {
    id: '5',
    date: '2026-03-19',
    product: 'Vollkornbrot',
    quantity: 30,
    status: 'completed',
  },
]

app.get('/api/production', (req, res) => {
  const { date, status } = req.query
  let filtered = [...productionPlans]
  if (date) filtered = filtered.filter((p) => p.date === date)
  if (status) filtered = filtered.filter((p) => p.status === status)
  res.json({ success: true, data: filtered, count: filtered.length })
})

app.get('/api/production/:id', (req, res) => {
  const plan = productionPlans.find((p) => p.id === req.params.id)
  if (!plan)
    return res
      .status(404)
      .json({ success: false, error: 'Production plan not found' })
  res.json({ success: true, data: plan })
})

app.post('/api/production', (req, res) => {
  const plan = {
    id: String(productionPlans.length + 1),
    ...req.body,
    status: req.body.status || 'planned',
  }
  productionPlans.push(plan)
  res.status(201).json({ success: true, data: plan })
})

app.put('/api/production/:id', (req, res) => {
  const index = productionPlans.findIndex((p) => p.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Production plan not found' })
  productionPlans[index] = {
    ...productionPlans[index],
    ...req.body,
    id: productionPlans[index].id,
  }
  res.json({ success: true, data: productionPlans[index] })
})

app.delete('/api/production/:id', (req, res) => {
  const index = productionPlans.findIndex((p) => p.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Production plan not found' })
  productionPlans.splice(index, 1)
  res.json({ success: true, message: 'Production plan deleted' })
})

// --- Inventory endpoints (mock) ---
let inventoryItems = [
  {
    id: '1',
    name: 'Mehl Type 550',
    category: 'Mehl',
    unit: 'kg',
    stock: 120,
    minStock: 50,
    supplier: 'Mühle Schneider',
    lastRestocked: '2026-03-15',
  },
  {
    id: '2',
    name: 'Roggenmehl',
    category: 'Mehl',
    unit: 'kg',
    stock: 80,
    minStock: 30,
    supplier: 'Mühle Schneider',
    lastRestocked: '2026-03-14',
  },
  {
    id: '3',
    name: 'Hefe',
    category: 'Backmittel',
    unit: 'kg',
    stock: 5,
    minStock: 2,
    supplier: 'BäckerZutaten GmbH',
    lastRestocked: '2026-03-18',
  },
  {
    id: '4',
    name: 'Butter',
    category: 'Milchprodukte',
    unit: 'kg',
    stock: 25,
    minStock: 10,
    supplier: 'Molkerei Weber',
    lastRestocked: '2026-03-17',
  },
  {
    id: '5',
    name: 'Zucker',
    category: 'Backmittel',
    unit: 'kg',
    stock: 45,
    minStock: 20,
    supplier: 'Südzucker AG',
    lastRestocked: '2026-03-12',
  },
  {
    id: '6',
    name: 'Salz',
    category: 'Gewürze',
    unit: 'kg',
    stock: 15,
    minStock: 5,
    supplier: 'BäckerZutaten GmbH',
    lastRestocked: '2026-03-10',
  },
]

app.get('/api/inventory', (req, res) => {
  const { category, lowStock } = req.query
  let filtered = [...inventoryItems]
  if (category) filtered = filtered.filter((i) => i.category === category)
  if (lowStock === 'true')
    filtered = filtered.filter((i) => i.stock <= i.minStock)
  res.json({ success: true, data: filtered, count: filtered.length })
})

app.get('/api/inventory/low-stock', (req, res) => {
  const lowStock = inventoryItems.filter((i) => i.stock <= i.minStock)
  res.json({ success: true, data: lowStock, count: lowStock.length })
})

app.get('/api/inventory/:id', (req, res) => {
  const item = inventoryItems.find((i) => i.id === req.params.id)
  if (!item)
    return res
      .status(404)
      .json({ success: false, error: 'Inventory item not found' })
  res.json({ success: true, data: item })
})

app.post('/api/inventory', (req, res) => {
  const item = {
    id: String(inventoryItems.length + 1),
    ...req.body,
    lastRestocked: new Date().toISOString().split('T')[0],
  }
  inventoryItems.push(item)
  res.status(201).json({ success: true, data: item })
})

app.put('/api/inventory/:id', (req, res) => {
  const index = inventoryItems.findIndex((i) => i.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Inventory item not found' })
  inventoryItems[index] = {
    ...inventoryItems[index],
    ...req.body,
    id: inventoryItems[index].id,
  }
  res.json({ success: true, data: inventoryItems[index] })
})

app.post('/api/inventory/:id/adjust', (req, res) => {
  const index = inventoryItems.findIndex((i) => i.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Inventory item not found' })
  const { adjustment, reason } = req.body
  inventoryItems[index].stock += adjustment || 0
  inventoryItems[index].lastRestocked = new Date().toISOString().split('T')[0]
  res.json({ success: true, data: inventoryItems[index] })
})

app.delete('/api/inventory/:id', (req, res) => {
  const index = inventoryItems.findIndex((i) => i.id === req.params.id)
  if (index === -1)
    return res
      .status(404)
      .json({ success: false, error: 'Inventory item not found' })
  inventoryItems.splice(index, 1)
  res.json({ success: true, message: 'Inventory item deleted' })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
