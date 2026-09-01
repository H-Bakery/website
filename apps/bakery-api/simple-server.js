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

app.get('/api/notifications/preferences', (req, res) => {
  res.json({ success: true, data: notificationPreferences })
})

app.put('/api/notifications/preferences', (req, res) => {
  notificationPreferences = { ...notificationPreferences, ...req.body }
  res.json({ success: true, data: notificationPreferences })
})

// --- HQ Product edit endpoint (writes back to markdown files) ---
// --- HQ product file serialisation ------------------------------------------
const { serializeProductFile } = require('./src/services/product-file.core')

/** Body text without its leading `# Heading` line. */
function stripHeading(body) {
  return String(body)
    .trim()
    .replace(/^#{1,6}[^\n]*\n+/, '')
    .trim()
}

/** "Käse-Brötchen 500g" -> "kaese-broetchen-500g" */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

app.get('/api/hq-products/:id', (req, res) => {
  const products = loadHQProducts()
  const product = products.find((p) => p.id === req.params.id)
  if (!product)
    return res.status(404).json({
      success: false,
      error: 'Product not found',
      message: 'Product not found',
    })
  res.json({ success: true, data: product })
})

app.put('/api/hq-products/:id', (req, res) => {
  if (!fs.existsSync(HQ_PRODUCTS_DIR)) {
    return res.status(500).json({
      success: false,
      error: 'HQ products directory not found',
      message: 'HQ products directory not found',
    })
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
    return res.status(404).json({
      success: false,
      error: 'Product not found',
      message: 'Product not found',
    })
  }

  const {
    name,
    category,
    price,
    short_description,
    description,
    image,
    available,
    seasonal,
  } = req.body

  const updatedData = { ...originalData }
  if (name !== undefined) updatedData.name = name
  if (category !== undefined) updatedData.category = category
  if (price !== undefined) updatedData.price = parseFloat(price)
  if (short_description !== undefined)
    updatedData.short_description = short_description
  if (image !== undefined) updatedData.image = image
  if (available !== undefined) updatedData.available = available
  if (seasonal !== undefined) updatedData.seasonal = seasonal

  let updatedBody = originalContent.trim()
  if (description !== undefined) {
    // `description` is the full body the editor loaded, minus the heading.
    updatedBody = `# ${updatedData.name}\n\n${String(description).trim()}`
  } else if (name !== undefined) {
    // Name changed but the body was not sent: retitle in place, keep the rest.
    updatedBody = updatedBody.replace(/^#{1,6}[^\n]*/, `# ${updatedData.name}`)
  }

  fs.writeFileSync(
    path.join(HQ_PRODUCTS_DIR, targetFile),
    serializeProductFile(updatedData, updatedBody),
    'utf-8'
  )

  res.json({
    success: true,
    data: { ...updatedData, description: stripHeading(updatedBody) },
  })
})

app.post('/api/hq-products', (req, res) => {
  if (!fs.existsSync(HQ_PRODUCTS_DIR)) {
    return res.status(500).json({
      success: false,
      error: 'HQ products directory not found',
      message: 'HQ products directory not found',
    })
  }

  const {
    name,
    category,
    price,
    short_description,
    description,
    image,
    available,
    seasonal,
  } = req.body

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Produktname ist erforderlich',
      message: 'Produktname ist erforderlich',
    })
  }
  if (!category || !String(category).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Kategorie ist erforderlich',
      message: 'Kategorie ist erforderlich',
    })
  }
  const parsedPrice = parseFloat(price)
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({
      success: false,
      error: 'Preis ist ungültig',
      message: 'Preis ist ungültig',
    })
  }

  const existing = loadHQProducts()
  const id = slugify(name)
  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Aus dem Namen lässt sich keine ID ableiten',
      message: 'Aus dem Namen lässt sich keine ID ableiten',
    })
  }
  if (existing.some((p) => p.id === id)) {
    return res.status(409).json({
      success: false,
      error: `Ein Produkt mit der ID "${id}" existiert bereits`,
      message: `Ein Produkt mit der ID "${id}" existiert bereits`,
    })
  }

  const numericId =
    existing.reduce((max, p) => Math.max(max, p.numeric_id || 0), 0) + 1

  const data = {
    id,
    numeric_id: numericId,
    name: String(name).trim(),
    category: String(category).trim(),
    price: parsedPrice,
    available: available !== false,
    seasonal: seasonal === true,
    image: image ? String(image).trim() : '',
    short_description: short_description
      ? String(short_description).trim()
      : '',
  }
  const body = `# ${data.name}\n\n${String(description || '').trim()}`
  const fileName = `${numericId}-${id}.md`

  fs.writeFileSync(
    path.join(HQ_PRODUCTS_DIR, fileName),
    serializeProductFile(data, body),
    'utf-8'
  )

  res
    .status(201)
    .json({ success: true, data: { ...data, description: stripHeading(body) } })
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

// --- Baking list endpoint (derived from HQ products) ---
app.get('/api/baking-list', (req, res) => {
  try {
    const products = loadHQProducts()
    const today = new Date().toISOString().split('T')[0]
    const bakingList = products
      .filter((p) => p.available !== false)
      .map((p) => ({
        id: p.numeric_id || p.id,
        productId: p.id,
        name: p.name,
        category: p.category,
        quantity: Math.floor(Math.random() * 30) + 10,
        unit: 'Stück',
        status: 'planned',
        date: today,
      }))
      .slice(0, 20)

    res.json({ success: true, data: bakingList })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// --- Verkaufspartner: Besuche am Backschrank (TASK-037) ---
// Erfasst wird ein *Besuch*, keine Lieferung: was lag noch da (countedQty) und
// was wurde neu eingeräumt (deliveredQty). Jede abgeleitete Zahl kommt aus
// partner-stats.core - derselben Datei, die auch die echte API benutzt.
const partnerStats = require('./src/services/partner-stats.core')

// Der Mock-Server hat keine Datenbank. Erfassungen sollen einen Neustart
// trotzdem überleben, deshalb ein schlichter JSON-Store neben dem Server.
const PARTNER_STORE = path.join(__dirname, 'data', 'partner-store.json')

/** Auslieferungszustand: CAP-Markt als erster Partner, sonst nichts. */
function seedPartnerStore() {
  return {
    partners: [
      {
        id: 1,
        name: 'CAP-Markt Homburg-Kirrberg',
        slug: 'cap-markt-homburg-kirrberg',
        // Straße und PLZ bewusst leer - trägt das Team mit den echten Daten nach.
        street: '',
        zip: '',
        city: 'Homburg',
        contactName: null,
        phone: null,
        email: null,
        deliveryDays: [2, 3, 4, 5, 6],
        settlementModel: 'commission',
        active: true,
        notes:
          'Backschrank mit Brot, Brötchen und Kaffeestückchen. Belieferung Dienstag bis Samstag morgens, Nachlieferungen nach Bedarf.',
      },
    ],
    templates: [],
    visits: [],
  }
}

function savePartnerStore(store) {
  try {
    fs.mkdirSync(path.dirname(PARTNER_STORE), { recursive: true })
    fs.writeFileSync(PARTNER_STORE, JSON.stringify(store, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.warn(
      `Partner-Store konnte nicht geschrieben werden: ${err.message}`
    )
    return false
  }
}

/**
 * Liest den Store. Fehlt die Datei, wird der Seed angelegt; ist sie kaputt,
 * arbeitet der Server mit dem Seed weiter, statt beim Request abzustürzen.
 */
function loadPartnerStore() {
  const seed = seedPartnerStore()
  try {
    if (fs.existsSync(PARTNER_STORE)) {
      const parsed = JSON.parse(fs.readFileSync(PARTNER_STORE, 'utf-8'))
      return {
        partners:
          Array.isArray(parsed.partners) && parsed.partners.length
            ? parsed.partners
            : seed.partners,
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        visits: Array.isArray(parsed.visits) ? parsed.visits : [],
      }
    }
    savePartnerStore(seed)
  } catch (err) {
    console.warn(`Partner-Store konnte nicht gelesen werden: ${err.message}`)
  }
  return seed
}

/** Fehlerantwort mit deutschem Text - ApiClient wirft `new Error(data.message)`. */
function partnerError(res, status, error, message) {
  return res.status(status).json({ error, message })
}

/** IDs kommen aus einem max+1-Zähler über den jeweiligen Store-Abschnitt. */
function nextPartnerId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function wholeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function isBusinessDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Preis-Snapshot: `null`/`''`/Unsinn fällt auf den HQ-Preis zurück. */
function snapshotPrice(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : fallback
}

/** Umlaut-sicherer Slug - gleiche Konvention wie bei den HQ-Produkten. */
function partnerSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Partner aus dem Store holen. Antwortet selbst mit 404 und gibt dann
 * `null` zurück - der Aufrufer bricht mit `if (!partner) return` ab.
 *
 * Status und Text sind absichtlich identisch zu `loadPartner()` in
 * src/routes/partner.routes.ts: das Frontend soll später ohne Anpassung von
 * diesem Mock auf die echte API umschalten können.
 */
function requirePartner(req, res, store) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    partnerError(
      res,
      404,
      'PARTNER_NOT_FOUND',
      'Verkaufspartner nicht gefunden - die Kennung muss eine Zahl sein.'
    )
    return null
  }
  const partner = store.partners.find((p) => p.id === id)
  if (!partner) {
    partnerError(
      res,
      404,
      'PARTNER_NOT_FOUND',
      `Verkaufspartner mit der Kennung ${id} wurde nicht gefunden.`
    )
    return null
  }
  return partner
}

/** `from`/`to` aus der Query, beide optional und inklusiv. */
function parseRange(req) {
  const { from, to } = req.query
  if ((from && !isBusinessDate(from)) || (to && !isBusinessDate(to))) {
    return { error: true }
  }
  return { from: from || null, to: to || null }
}

function invalidRange(res) {
  return partnerError(
    res,
    400,
    'Invalid range',
    'Ungültiger Zeitraum. Datumsangaben werden im Format JJJJ-MM-TT erwartet.'
  )
}

/** HQ-Katalog als Nachschlagewerk für die Namens- und Preis-Snapshots. */
function buildHQIndex() {
  const bySlug = new Map()
  const byNumericId = new Map()
  for (const product of loadHQProducts()) {
    bySlug.set(product.id, product)
    const numericId = Number(product.numeric_id)
    if (Number.isFinite(numericId)) byNumericId.set(numericId, product)
  }
  return { bySlug, byNumericId }
}

function findHQProduct(index, item) {
  return (
    index.bySlug.get(item.productSlug) ||
    index.byNumericId.get(Number(item.productId)) ||
    null
  )
}

/**
 * Positionen eines Besuchs normalisieren. `productName` und `unitPrice` werden
 * als Snapshot festgeschrieben - fehlen sie im Request, kommen sie aus HQ.
 * Genau das hält alte Reports korrekt, wenn sich später ein Preis ändert.
 */
function normalizeVisitItems(items, index) {
  return (
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const hq = findHQProduct(index, item)
        const counted =
          item.countedQty === null ||
          item.countedQty === undefined ||
          item.countedQty === ''
            ? null
            : Math.max(0, wholeNumber(item.countedQty, 0))
        return {
          productId: wholeNumber(
            item.productId,
            hq ? wholeNumber(hq.numeric_id, 0) : 0
          ),
          productSlug: item.productSlug || (hq ? hq.id : ''),
          productName:
            item.productName ||
            (hq ? hq.name : item.productSlug || 'Unbekannt'),
          unitPrice: snapshotPrice(
            item.unitPrice,
            hq ? Number(hq.price) || 0 : 0
          ),
          countedQty: counted,
          deliveredQty: Math.max(0, wholeNumber(item.deliveredQty, 0)),
        }
      })
      // Zeilen ohne jede Information (nicht gezählt, nichts geliefert) fliegen
      // raus - sonst steht im Report der halbe Katalog mit lauter Nullen.
      .filter(
        (item) =>
          item.productSlug &&
          (item.countedQty !== null || item.deliveredQty > 0)
      )
      .map((item, i) => ({ id: i + 1, ...item }))
  )
}

function partnerVisits(store, partnerId) {
  return partnerStats.sortVisits(
    store.visits.filter((v) => v.partnerId === partnerId)
  )
}

/**
 * Für jeden Liefertag existiert eine Vorlage - fehlende werden leer angelegt,
 * damit die Pflegeseite für Di-Sa je eine Karte bekommt.
 */
function ensurePartnerTemplates(store, partner) {
  const deliveryDays = Array.isArray(partner.deliveryDays)
    ? partner.deliveryDays
    : []
  let created = false
  for (const weekday of deliveryDays) {
    const exists = store.templates.some(
      (t) => t.partnerId === partner.id && t.weekday === weekday
    )
    if (exists) continue
    store.templates.push({
      id: nextPartnerId(store.templates),
      partnerId: partner.id,
      weekday,
      items: [],
      active: true,
    })
    created = true
  }
  if (created) savePartnerStore(store)
  return store.templates
    .filter((t) => t.partnerId === partner.id)
    .sort((a, b) => a.weekday - b.weekday)
}

app.get('/api/partners', (req, res) => {
  const store = loadPartnerStore()
  const { active } = req.query
  const list =
    active === undefined
      ? store.partners
      : store.partners.filter((p) => Boolean(p.active) === (active === 'true'))
  res.json(list)
})

app.post('/api/partners', (req, res) => {
  const store = loadPartnerStore()
  const body = req.body || {}
  if (!body.name || !String(body.name).trim()) {
    return partnerError(
      res,
      400,
      'Name is required',
      'Der Name des Partners ist erforderlich.'
    )
  }
  const slug = partnerSlug(body.slug || body.name)
  if (store.partners.some((p) => p.slug === slug)) {
    return partnerError(
      res,
      409,
      'Slug already exists',
      'Ein Partner mit diesem Kürzel existiert bereits.'
    )
  }
  const partner = {
    id: nextPartnerId(store.partners),
    name: String(body.name).trim(),
    slug,
    street: body.street || '',
    zip: body.zip || '',
    city: body.city || '',
    contactName: body.contactName || null,
    phone: body.phone || null,
    email: body.email || null,
    deliveryDays: Array.isArray(body.deliveryDays)
      ? body.deliveryDays
          .map((d) => wholeNumber(d, 0))
          .filter((d) => d >= 1 && d <= 7)
      : [2, 3, 4, 5, 6],
    settlementModel:
      body.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission',
    active: body.active === undefined ? true : Boolean(body.active),
    notes: body.notes || null,
  }
  store.partners.push(partner)
  savePartnerStore(store)
  res.status(201).json(partner)
})

app.get('/api/partners/:id', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  res.json(partner)
})

app.put('/api/partners/:id', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const body = req.body || {}

  if (body.slug !== undefined) {
    const slug = partnerSlug(body.slug)
    if (store.partners.some((p) => p.slug === slug && p.id !== partner.id)) {
      return partnerError(
        res,
        409,
        'Slug already exists',
        'Ein Partner mit diesem Kürzel existiert bereits.'
      )
    }
    partner.slug = slug
  }
  for (const field of [
    'name',
    'street',
    'zip',
    'city',
    'contactName',
    'phone',
    'email',
    'notes',
  ]) {
    if (body[field] !== undefined) partner[field] = body[field]
  }
  if (Array.isArray(body.deliveryDays)) {
    partner.deliveryDays = body.deliveryDays
      .map((d) => wholeNumber(d, 0))
      .filter((d) => d >= 1 && d <= 7)
  }
  if (body.settlementModel !== undefined) {
    partner.settlementModel =
      body.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission'
  }
  if (body.active !== undefined) partner.active = Boolean(body.active)

  savePartnerStore(store)
  res.json(partner)
})

app.get('/api/partners/:id/templates', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  res.json(ensurePartnerTemplates(store, partner))
})

app.put('/api/partners/:id/templates/:weekday', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return

  const weekday = Number(req.params.weekday)
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return partnerError(
      res,
      400,
      'Invalid weekday',
      'Ungültiger Wochentag. Erlaubt sind 1 (Montag) bis 7 (Sonntag).'
    )
  }
  const body = req.body || {}
  if (body.items !== undefined && !Array.isArray(body.items)) {
    return partnerError(
      res,
      400,
      'Invalid items',
      'Die Vorlage braucht eine Liste von Positionen.'
    )
  }

  const index = buildHQIndex()
  const items = (body.items || [])
    .map((item) => {
      const hq = findHQProduct(index, item)
      return {
        productId: wholeNumber(
          item.productId,
          hq ? wholeNumber(hq.numeric_id, 0) : 0
        ),
        productSlug: item.productSlug || (hq ? hq.id : ''),
        quantity: Math.max(0, wholeNumber(item.quantity, 0)),
      }
    })
    .filter((item) => item.productSlug && item.quantity > 0)

  let template = store.templates.find(
    (t) => t.partnerId === partner.id && t.weekday === weekday
  )
  if (!template) {
    template = {
      id: nextPartnerId(store.templates),
      partnerId: partner.id,
      weekday,
      items,
      active: true,
    }
    store.templates.push(template)
  } else {
    template.items = items
    if (body.active !== undefined) template.active = Boolean(body.active)
  }
  savePartnerStore(store)
  res.json(template)
})

app.get('/api/partners/:id/visits', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const range = parseRange(req)
  if (range.error) return invalidRange(res)

  const visits = partnerVisits(store, partner.id).filter(
    (v) =>
      (!range.from || v.businessDate >= range.from) &&
      (!range.to || v.businessDate <= range.to)
  )
  res.json(visits)
})

// Muss vor keiner anderen `/visits`-Route stehen, ist aber der Klarheit halber
// direkt hinter der Liste: Tagesdetail inklusive Timeline für die Detailseite.
app.get('/api/partners/:id/visits/today', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const { date } = req.query
  if (date && !isBusinessDate(date)) {
    return partnerError(
      res,
      400,
      'Invalid date',
      'Ungültiges Datum. Erwartet wird das Format JJJJ-MM-TT.'
    )
  }
  const businessDate = date || partnerStats.businessDateOf(new Date())
  const dayVisits = partnerVisits(store, partner.id).filter(
    (v) => v.businessDate === businessDate
  )
  const detail = partnerStats.computeDayDetail(dayVisits)
  res.json({
    ...detail,
    businessDate: detail.businessDate || businessDate,
    visits: dayVisits,
  })
})

app.post('/api/partners/:id/visits', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const body = req.body || {}

  if (!partnerStats.VISIT_TYPES.includes(body.visitType)) {
    return partnerError(
      res,
      400,
      'Invalid visit type',
      `Unbekannter Besuchstyp. Erlaubt sind: ${partnerStats.VISIT_TYPES.join(
        ', '
      )}.`
    )
  }
  if (body.items !== undefined && !Array.isArray(body.items)) {
    return partnerError(
      res,
      400,
      'Invalid items',
      'Der Besuch braucht eine Liste von Positionen.'
    )
  }
  if (body.businessDate !== undefined && !isBusinessDate(body.businessDate)) {
    return partnerError(
      res,
      400,
      'Invalid business date',
      'Ungültiger Geschäftstag. Erwartet wird das Format JJJJ-MM-TT.'
    )
  }
  const visitAt = body.visitAt ? new Date(body.visitAt) : new Date()
  if (Number.isNaN(visitAt.getTime())) {
    return partnerError(
      res,
      400,
      'Invalid visitAt',
      'Der Zeitpunkt des Besuchs ist ungültig.'
    )
  }

  const businessDate = body.businessDate || partnerStats.businessDateOf(visitAt)
  const dayVisits = store.visits.filter(
    (v) => v.partnerId === partner.id && v.businessDate === businessDate
  )
  if (
    body.visitType === 'initial' &&
    dayVisits.some((v) => v.visitType === 'initial')
  ) {
    return partnerError(
      res,
      409,
      'Initial visit already exists',
      'Für diesen Geschäftstag ist bereits eine Erstbestückung erfasst.'
    )
  }

  const now = new Date().toISOString()
  const visit = {
    id: nextPartnerId(store.visits),
    partnerId: partner.id,
    businessDate,
    visitAt: visitAt.toISOString(),
    visitType: body.visitType,
    // Laufende Nummer innerhalb des Geschäftstags, automatisch vergeben.
    sequence:
      dayVisits.reduce(
        (max, v) => Math.max(max, wholeNumber(v.sequence, 0)),
        0
      ) + 1,
    staffId: body.staffId == null ? null : wholeNumber(body.staffId, null),
    staffName: body.staffName || null,
    note: body.note || null,
    items: normalizeVisitItems(body.items, buildHQIndex()),
    createdAt: now,
    updatedAt: now,
  }
  store.visits.push(visit)
  savePartnerStore(store)
  res.status(201).json(visit)
})

app.patch('/api/partners/:id/visits/:visitId', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const visitId = Number(req.params.visitId)
  if (!Number.isInteger(visitId) || visitId <= 0) {
    return partnerError(
      res,
      404,
      'VISIT_NOT_FOUND',
      'Besuch nicht gefunden - die Kennung muss eine Zahl sein.'
    )
  }
  const visit = store.visits.find(
    (v) => v.id === visitId && v.partnerId === partner.id
  )
  if (!visit) {
    return partnerError(
      res,
      404,
      'VISIT_NOT_FOUND',
      `Besuch mit der Kennung ${visitId} wurde für diesen Verkaufspartner nicht gefunden.`
    )
  }

  const body = req.body || {}
  if (
    body.visitType !== undefined &&
    !partnerStats.VISIT_TYPES.includes(body.visitType)
  ) {
    return partnerError(
      res,
      400,
      'Invalid visit type',
      `Unbekannter Besuchstyp. Erlaubt sind: ${partnerStats.VISIT_TYPES.join(
        ', '
      )}.`
    )
  }
  if (body.items !== undefined && !Array.isArray(body.items)) {
    return partnerError(
      res,
      400,
      'Invalid items',
      'Der Besuch braucht eine Liste von Positionen.'
    )
  }
  if (body.businessDate !== undefined && !isBusinessDate(body.businessDate)) {
    return partnerError(
      res,
      400,
      'Invalid business date',
      'Ungültiger Geschäftstag. Erwartet wird das Format JJJJ-MM-TT.'
    )
  }
  let visitAt = visit.visitAt
  if (body.visitAt !== undefined) {
    const parsed = new Date(body.visitAt)
    if (Number.isNaN(parsed.getTime())) {
      return partnerError(
        res,
        400,
        'Invalid visitAt',
        'Der Zeitpunkt des Besuchs ist ungültig.'
      )
    }
    visitAt = parsed.toISOString()
  }

  // Geschäftstag folgt der korrigierten Uhrzeit, sofern nicht ausdrücklich gesetzt.
  const businessDate =
    body.businessDate ||
    (body.visitAt !== undefined
      ? partnerStats.businessDateOf(visitAt)
      : visit.businessDate)
  const visitType = body.visitType || visit.visitType
  const others = store.visits.filter(
    (v) =>
      v.partnerId === partner.id &&
      v.businessDate === businessDate &&
      v.id !== visit.id
  )
  if (
    visitType === 'initial' &&
    others.some((v) => v.visitType === 'initial')
  ) {
    return partnerError(
      res,
      409,
      'Initial visit already exists',
      'Für diesen Geschäftstag ist bereits eine Erstbestückung erfasst.'
    )
  }

  if (businessDate !== visit.businessDate) {
    visit.sequence =
      others.reduce((max, v) => Math.max(max, wholeNumber(v.sequence, 0)), 0) +
      1
  }
  visit.businessDate = businessDate
  visit.visitAt = visitAt
  visit.visitType = visitType
  if (body.staffId !== undefined) {
    visit.staffId =
      body.staffId == null ? null : wholeNumber(body.staffId, null)
  }
  if (body.staffName !== undefined) visit.staffName = body.staffName || null
  if (body.note !== undefined) visit.note = body.note || null
  if (body.items !== undefined) {
    visit.items = normalizeVisitItems(body.items, buildHQIndex())
  }
  visit.updatedAt = new Date().toISOString()

  savePartnerStore(store)
  res.json(visit)
})

app.delete('/api/partners/:id/visits/:visitId', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const visitId = Number(req.params.visitId)
  if (!Number.isInteger(visitId) || visitId <= 0) {
    return partnerError(
      res,
      404,
      'VISIT_NOT_FOUND',
      'Besuch nicht gefunden - die Kennung muss eine Zahl sein.'
    )
  }
  const index = store.visits.findIndex(
    (v) => v.id === visitId && v.partnerId === partner.id
  )
  if (index === -1) {
    return partnerError(
      res,
      404,
      'VISIT_NOT_FOUND',
      `Besuch mit der Kennung ${visitId} wurde für diesen Verkaufspartner nicht gefunden.`
    )
  }
  store.visits.splice(index, 1)
  savePartnerStore(store)
  res.json({ id: visitId, deleted: true, message: 'Besuch gelöscht.' })
})

app.get('/api/partners/:id/stats', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const range = parseRange(req)
  if (range.error) return invalidRange(res)
  res.json(
    partnerStats.computeStats(partnerVisits(store, partner.id), {
      from: range.from,
      to: range.to,
    })
  )
})

app.get('/api/partners/:id/report', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const range = parseRange(req)
  if (range.error) return invalidRange(res)
  const stats = partnerStats.computeStats(partnerVisits(store, partner.id), {
    from: range.from,
    to: range.to,
  })
  res.json({ partner, generatedAt: new Date().toISOString(), stats })
})

app.get('/api/partners/:id/report.csv', (req, res) => {
  const store = loadPartnerStore()
  const partner = requirePartner(req, res, store)
  if (!partner) return
  const range = parseRange(req)
  if (range.error) return invalidRange(res)
  const stats = partnerStats.computeStats(partnerVisits(store, partner.id), {
    from: range.from,
    to: range.to,
  })
  const filename = `partner-report-${partner.slug}-${
    range.from || 'gesamt'
  }-bis-${range.to || 'gesamt'}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  // BOM voran, damit Excel die Umlaute als UTF-8 erkennt.
  res.send('\uFEFF' + partnerStats.statsToCsv(stats, partner))
})

// --- Liefertouren: Samstagsauslieferung mit ein bis zwei Fahrern ---
//
// Eine *Tour* gehoert einem Tag und einem Fahrer und besteht aus *Stopps* in
// gefahrener Reihenfolge. Der Fahrer hakt unterwegs ab; die Backstube sieht am
// selben Datensatz, wie weit die Tour ist.
//
// Rechnen tut `delivery-tours.core.js`, Adresssuche und Strassenrouting
// `delivery-geo.core.js`. Beide Dienste sind optional: faellt das Netz aus,
// bleiben Reihenfolge und Kilometer Schaetzwerte, aber die Tour funktioniert.
const tours = require('./src/services/delivery-tours.core')
const geo = require('./src/services/delivery-geo.core')

const DELIVERY_STORE = path.join(__dirname, 'data', 'delivery-store.json')

/** Auslieferungszustand: Backstube, zwei Fahrer, die naechste Samstagstour. */
function seedDeliveryStore() {
  const saturday = tours.nextWeekday(new Date(), 6)
  return {
    depot: {
      name: 'Bäckerei Heusser',
      street: 'Eckstraße 3',
      zip: '66424',
      city: 'Homburg-Kirrberg',
      phone: '+49 6841 2229',
      lat: 49.3015165,
      lon: 7.3695327,
    },
    // Namen und Nummern bewusst leer - traegt das Team mit den echten Daten nach.
    drivers: [
      { id: 1, name: 'Fahrer 1', phone: null, vehicle: 'car', active: true },
      { id: 2, name: 'Fahrer 2', phone: null, vehicle: 'car', active: true },
    ],
    tours: [
      {
        id: 1,
        date: saturday,
        driverId: 1,
        name: 'Samstagstour',
        status: 'planned',
        vehicleType: 'car',
        plannedStart: '06:30',
        startedAt: null,
        finishedAt: null,
        distance: null,
        duration: null,
        isEstimate: true,
        geometry: null,
        routedAt: null,
        lastPosition: null,
        stops: [
          {
            id: 1,
            customer: 'CAP-Markt Homburg-Kirrberg',
            street: 'Ortsstraße 36-38',
            zip: '66424',
            city: 'Homburg',
            phone: null,
            timeWindow: '07:00-08:00',
            notes: 'Backschrank bestücken, Reste zählen.',
            items: [],
            status: 'open',
            completedAt: null,
            failureReason: null,
            lat: null,
            lon: null,
            geocodeSource: null,
          },
        ],
      },
    ],
    geocache: {},
  }
}

function saveDeliveryStore(store) {
  try {
    fs.mkdirSync(path.dirname(DELIVERY_STORE), { recursive: true })
    // Erst in eine Nachbardatei, dann umbenennen. Stirbt der Prozess mitten im
    // Schreiben, bleibt die alte Datei heil - sonst braechte eine halbe
    // JSON-Datei beim naechsten Start den Seed zurueck, und die Tour waere weg.
    const tmp = `${DELIVERY_STORE}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
    fs.renameSync(tmp, DELIVERY_STORE)
    return true
  } catch (err) {
    console.warn(`Liefer-Store konnte nicht geschrieben werden: ${err.message}`)
    return false
  }
}

/**
 * Liest den Store. Fehlt die Datei, wird der Seed angelegt; ist sie kaputt,
 * arbeitet der Server mit dem Seed weiter, statt beim Request abzustuerzen.
 */
function loadDeliveryStore() {
  const seed = seedDeliveryStore()
  try {
    if (fs.existsSync(DELIVERY_STORE)) {
      const parsed = JSON.parse(fs.readFileSync(DELIVERY_STORE, 'utf-8'))
      return {
        depot: parsed.depot && parsed.depot.street ? parsed.depot : seed.depot,
        drivers:
          Array.isArray(parsed.drivers) && parsed.drivers.length
            ? parsed.drivers
            : seed.drivers,
        tours: Array.isArray(parsed.tours)
          ? parsed.tours
              .filter((t) => t && Number.isFinite(Number(t.id)))
              .map((t) => ({
                ...t,
                stops: Array.isArray(t.stops) ? t.stops : [],
              }))
          : [],
        geocache:
          parsed.geocache && typeof parsed.geocache === 'object'
            ? parsed.geocache
            : {},
      }
    }
    saveDeliveryStore(seed)
  } catch (err) {
    console.warn(`Liefer-Store konnte nicht gelesen werden: ${err.message}`)
  }
  return seed
}

/**
 * Der Store lebt im Speicher und wird nach jeder Aenderung geschrieben.
 *
 * Frueher las jeder Request die Datei neu und schrieb seine eigene Kopie
 * zurueck. Ein Handler, der derweil auf Nominatim oder OSRM wartete, schrieb
 * danach seinen alten Stand ueber alles, was in der Zwischenzeit abgehakt oder
 * angelegt worden war - genau so verlor die E2E-Suite ihren frisch angelegten
 * Stopp. Mit einem einzigen Objekt gibt es nichts mehr zu ueberschreiben.
 */
let deliveryStore = null
function getDeliveryStore() {
  if (!deliveryStore) deliveryStore = loadDeliveryStore()
  return deliveryStore
}

/** Fehlerantwort mit deutschem Text - ApiClient wirft `new Error(data.message)`. */
function deliveryError(res, status, error, message) {
  return res.status(status).json({ error, message })
}

/**
 * Express 4 faengt abgelehnte Promises nicht: ein Fehler in einem
 * `async`-Handler liesse den Request einfach haengen, bis das Handy aufgibt.
 * Hier wird daraus eine 500 mit deutschem Text.
 */
function deliveryRoute(handler) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((err) => {
        console.error(
          `Liefer-Endpunkt ${req.method} ${req.originalUrl}: ${
            (err && err.stack) || err
          }`
        )
        if (!res.headersSent) {
          deliveryError(
            res,
            500,
            'Internal error',
            'Interner Fehler im Liefer-Server.'
          )
        }
      })
  }
}

function nextDeliveryId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function findTour(req, res, store) {
  const id = Number(req.params.id)
  const tour = store.tours.find((t) => t.id === id)
  if (!tour) {
    deliveryError(res, 404, 'Tour not found', 'Diese Tour existiert nicht.')
    return null
  }
  return tour
}

function findStop(req, res, tour) {
  const stopId = Number(req.params.stopId)
  const stop = tour.stops.find((s) => s.id === stopId)
  if (!stop) {
    deliveryError(res, 404, 'Stop not found', 'Dieser Stopp existiert nicht.')
    return null
  }
  return stop
}

/**
 * Fehlversuche der Adresssuche werden fuer eine Weile gemerkt. Ohne das fragte
 * jedes Lesen der Tourliste fuer jeden nicht gefundenen Stopp erneut bei
 * Nominatim an - bei Netzausfall mit Timeout, also sekundenlang pro Stopp und
 * Aufruf. Eine ausdrueckliche Aktion (Stopp anlegen, Route berechnen)
 * probiert es mit `force` trotzdem.
 */
const GEOCODE_RETRY_MS = 5 * 60 * 1000
const geocodeMisses = new Map() // Adress-Schluessel -> Zeitpunkt des Fehlversuchs
const geocodeInFlight = new Map() // Adress-Schluessel -> laufende Suche

/**
 * Sucht eine Adresse: erst im Cache des Stores, dann bei Nominatim. Treffer
 * landen dauerhaft im Store, eine Adresse wird also genau einmal gesucht.
 * Rueckgabe `{ hit, source }` oder `null`.
 */
async function lookupAddress(store, address, force) {
  const key = tours.normalizeAddress(address)
  const cached = store.geocache[key]
  if (cached && tours.hasCoordinates(cached)) {
    return { hit: cached, source: 'cache' }
  }

  const missedAt = geocodeMisses.get(key)
  if (!force && missedAt && Date.now() - missedAt < GEOCODE_RETRY_MS) {
    return null
  }

  // Gleichzeitige Anfragen nach derselben Adresse teilen sich eine Suche.
  if (!geocodeInFlight.has(key)) {
    const search = geo
      .geocodeAddress(address)
      .then((hit) => {
        if (hit) {
          store.geocache[key] = { ...hit, at: new Date().toISOString() }
          geocodeMisses.delete(key)
        } else {
          geocodeMisses.set(key, Date.now())
        }
        return hit
      })
      .finally(() => geocodeInFlight.delete(key))
    geocodeInFlight.set(key, search)
  }

  const hit = await geocodeInFlight.get(key)
  return hit ? { hit, source: 'nominatim' } : null
}

/**
 * Sucht die Koordinaten eines Stopps (oder des Depots) nach.
 *
 * Schlaegt die Suche fehl, bleibt `lat/lon` auf `null`: der Stopp steht dann
 * ohne Kartenpunkt in der Liste, statt an einer falschen Stelle zu liegen.
 */
async function ensureStopCoordinates(store, stop, options) {
  if (tours.hasCoordinates(stop)) return stop

  const address = tours.formatAddress(stop)
  if (!address) return stop

  const found = await lookupAddress(store, address, options && options.force)
  if (found) {
    stop.lat = found.hit.lat
    stop.lon = found.hit.lon
    stop.geocodeSource = found.source
  }
  return stop
}

/** Haengt die berechneten Felder an eine Tour - nie im Store gespeichert. */
function decorateTour(store, tour) {
  const progress = tours.tourProgress(tour)
  const next = tours.nextOpenStop(tour)
  // Geplante Tour: ab Depot und geplanter Abfahrt. Laufende Tour: ab dem
  // zuletzt erledigten Stopp bzw. der juengeren Fahrerposition - siehe
  // `arrivalBaseline` im Core.
  const baseline = tours.arrivalBaseline(store.depot, tour)
  const arrivals = tours.estimateArrivals(
    baseline.origin,
    tour.stops.filter((s) => s.status === 'open'),
    baseline.startedAt,
    tour.vehicleType
  )

  return {
    ...tour,
    depot: store.depot,
    driver: store.drivers.find((d) => d.id === tour.driverId) || null,
    progress,
    nextStopId: next ? next.id : null,
    stops: tour.stops.map((stop) => ({
      ...stop,
      address: tours.formatAddress(stop),
      estimatedArrival: arrivals[stop.id] || null,
    })),
  }
}

/**
 * Rechnet die Tour neu: optional die Reihenfolge, immer Strecke und Dauer.
 * OSRM liefert echte Strassenwerte; ohne Netz kommen die Schaetzformeln zum
 * Zug und `isEstimate` bleibt true, damit die Oberflaeche das kennzeichnen kann.
 */
async function recalculateTour(store, tour, { optimize } = {}) {
  const open = tour.stops.filter((s) => s.status === 'open')
  const routable = open.length > 0 ? open : tour.stops

  const routed = await geo.routeTour(store.depot, routable, {
    optimize,
    vehicleType: tour.vehicleType,
  })

  if (routed) {
    if (optimize && routed.order.length > 0) {
      applyStopOrder(tour, routed.order)
    }
    tour.distance = routed.distance
    tour.duration = routed.duration
    tour.geometry = routed.geometry
    tour.isEstimate = false
  } else {
    if (optimize) {
      const ordered = tours.orderStopsNearestNeighbour(store.depot, routable)
      applyStopOrder(
        tour,
        ordered.map((s) => s.id)
      )
    }
    const estimate = tours.estimateTour(
      store.depot,
      tour.stops.filter((s) => s.status === 'open'),
      tour.vehicleType
    )
    tour.distance = estimate.distance
    tour.duration = estimate.duration
    tour.geometry = null
    tour.isEstimate = true
  }

  tour.routedAt = new Date().toISOString()
  return tour
}

/** Sortiert `tour.stops` nach einer ID-Liste; nicht genannte Stopps bleiben hinten. */
function applyStopOrder(tour, order) {
  const rank = new Map(order.map((id, index) => [Number(id), index]))
  tour.stops.sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER
    const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

app.get(
  '/api/deliveries/depot',
  deliveryRoute((req, res) => {
    res.json(getDeliveryStore().depot)
  })
)

app.put(
  '/api/deliveries/depot',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const body = req.body || {}
    const depot = {
      ...store.depot,
      name: String(body.name || store.depot.name).trim(),
      street: String(body.street || store.depot.street).trim(),
      zip: String(body.zip === undefined ? store.depot.zip : body.zip).trim(),
      city: String(body.city || store.depot.city).trim(),
      phone: tours.normalizePhone(
        body.phone === undefined ? store.depot.phone : body.phone
      ),
    }

    // Koordinaten duerfen direkt gesetzt werden, wenn die Adresssuche daneben
    // liegt. Sonst: Adresse geaendert? Koordinaten neu suchen, sonst startet die
    // Tour am alten Ort. Ohne Koordinaten gibt es kein Depot - `Number(null)`
    // waere 0, und jede Tour begaenne im Atlantik.
    if (body.lat !== undefined || body.lon !== undefined) {
      if (!tours.isNumber(body.lat) || !tours.isNumber(body.lon)) {
        return deliveryError(
          res,
          400,
          'Invalid coordinates',
          'Koordinaten der Backstube müssen Zahlen sein.'
        )
      }
      depot.lat = Number(body.lat)
      depot.lon = Number(body.lon)
    } else if (
      tours.formatAddress(depot) !== tours.formatAddress(store.depot)
    ) {
      depot.lat = null
      depot.lon = null
      await ensureStopCoordinates(store, depot, { force: true })
      if (!tours.hasCoordinates(depot)) {
        return deliveryError(
          res,
          422,
          'Address not found',
          'Die neue Adresse der Backstube wurde nicht gefunden; die alte bleibt bestehen. Koordinaten können auch direkt als lat/lon angegeben werden.'
        )
      }
    }

    store.depot = depot
    saveDeliveryStore(store)
    res.json(depot)
  })
)

app.get(
  '/api/deliveries/drivers',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const { active } = req.query
    const list =
      active === undefined
        ? store.drivers
        : store.drivers.filter((d) => Boolean(d.active) === (active === 'true'))
    res.json(list)
  })
)

app.post(
  '/api/deliveries/drivers',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) {
      return deliveryError(
        res,
        400,
        'Name is required',
        'Der Name des Fahrers ist erforderlich.'
      )
    }

    const driver = {
      id: nextDeliveryId(store.drivers),
      name,
      phone: tours.normalizePhone(body.phone),
      vehicle: ['bike', 'car', 'van'].includes(body.vehicle)
        ? body.vehicle
        : 'car',
      active: body.active === undefined ? true : Boolean(body.active),
    }
    store.drivers.push(driver)
    saveDeliveryStore(store)
    res.status(201).json(driver)
  })
)

app.put(
  '/api/deliveries/drivers/:id',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const driver = store.drivers.find((d) => d.id === Number(req.params.id))
    if (!driver) {
      return deliveryError(
        res,
        404,
        'Driver not found',
        'Dieser Fahrer existiert nicht.'
      )
    }

    const body = req.body || {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) {
        return deliveryError(
          res,
          400,
          'Name is required',
          'Der Name des Fahrers ist erforderlich.'
        )
      }
      driver.name = name
    }
    if (body.phone !== undefined)
      driver.phone = tours.normalizePhone(body.phone)
    if (['bike', 'car', 'van'].includes(body.vehicle))
      driver.vehicle = body.vehicle
    if (body.active !== undefined) driver.active = Boolean(body.active)

    saveDeliveryStore(store)
    res.json(driver)
  })
)

/**
 * Sucht fehlende Koordinaten aller Stopps nach. Laeuft beim Lesen, damit ein
 * Stopp nie ohne Kartenpunkt in der Liste haengen bleibt - der Treffer landet
 * im Cache, die Suche kostet also nur beim allerersten Mal Zeit.
 */
async function hydrateTours(store, list) {
  let changed = false
  for (const tour of list) {
    for (const stop of tour.stops) {
      if (tours.hasCoordinates(stop)) continue
      const before = stop.lat
      await ensureStopCoordinates(store, stop)
      if (stop.lat !== before) changed = true
    }
  }
  if (changed) saveDeliveryStore(store)
  return changed
}

/**
 * Wartet hoechstens so lange auf die Adresssuche. Dauert sie laenger -
 * Nominatim langsam, Netz weg -, geht die Antwort ohne die fehlenden
 * Koordinaten raus, die Suche laeuft im Hintergrund weiter und der naechste
 * Aufruf sieht das Ergebnis. Samstags frueh muss die Liste da sein, auch wenn
 * ein fremder Server gerade nicht antwortet - und ein neuer Stopp darf nicht
 * 24 s auf drei Nominatim-Timeouts warten, sonst gibt das Handy vorher auf
 * und die Backstube legt ihn ein zweites Mal an.
 */
const HYDRATE_BUDGET_MS = 2500

function withBudget(work) {
  let timer = null
  const budget = new Promise((resolve) => {
    timer = setTimeout(resolve, HYDRATE_BUDGET_MS)
  })
  const guarded = work
    .catch((err) => console.warn(`Adresssuche fehlgeschlagen: ${err.message}`))
    .finally(() => clearTimeout(timer))
  return Promise.race([guarded, budget])
}

function hydrateWithBudget(store, list) {
  return withBudget(hydrateTours(store, list))
}

/**
 * Adresssuche fuer einen einzelnen Stopp mit Zeitbudget. Kommt der Treffer
 * erst nach der Antwort, wird er nachtraeglich gespeichert.
 */
function locateWithBudget(store, stop, options) {
  return withBudget(
    ensureStopCoordinates(store, stop, options).then(() => {
      if (tours.hasCoordinates(stop)) saveDeliveryStore(store)
    })
  )
}

app.get(
  '/api/deliveries/tours',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const { date, driverId, status } = req.query
    let list = store.tours

    if (date !== undefined) {
      if (!tours.isBusinessDate(date)) {
        return deliveryError(
          res,
          400,
          'Invalid date',
          'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
        )
      }
      list = list.filter((t) => t.date === date)
    }
    if (driverId !== undefined) {
      list = list.filter((t) => t.driverId === Number(driverId))
    }
    if (status !== undefined) {
      list = list.filter((t) => t.status === status)
    }

    const sorted = [...list].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id
    )
    await hydrateWithBudget(store, sorted)

    res.json(sorted.map((tour) => decorateTour(store, tour)))
  })
)

app.post(
  '/api/deliveries/tours',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const body = req.body || {}

    const date = body.date || tours.nextWeekday(new Date(), 6)
    if (!tours.isBusinessDate(date)) {
      return deliveryError(
        res,
        400,
        'Invalid date',
        'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
      )
    }

    const driverId = tours.wholeNumber(body.driverId, 0)
    if (driverId && !store.drivers.some((d) => d.id === driverId)) {
      return deliveryError(
        res,
        400,
        'Driver not found',
        'Dieser Fahrer existiert nicht.'
      )
    }

    const tour = {
      id: nextDeliveryId(store.tours),
      date,
      driverId: driverId || null,
      name: String(body.name || 'Tour').trim() || 'Tour',
      status: 'planned',
      plannedStart: /^\d{2}:\d{2}$/.test(body.plannedStart)
        ? body.plannedStart
        : '06:30',
      vehicleType: ['bike', 'car', 'van'].includes(body.vehicleType)
        ? body.vehicleType
        : 'car',
      startedAt: null,
      finishedAt: null,
      distance: null,
      duration: null,
      isEstimate: true,
      geometry: null,
      routedAt: null,
      lastPosition: null,
      stops: [],
    }

    store.tours.push(tour)
    saveDeliveryStore(store)
    res.status(201).json(decorateTour(store, tour))
  })
)

app.get(
  '/api/deliveries/tours/:id',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return
    await hydrateWithBudget(store, [tour])
    res.json(decorateTour(store, tour))
  })
)

app.patch(
  '/api/deliveries/tours/:id',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return

    const body = req.body || {}
    if (body.status !== undefined) {
      if (!tours.TOUR_STATUS.includes(body.status)) {
        return deliveryError(
          res,
          400,
          'Invalid status',
          'Status muss "planned", "active" oder "done" sein.'
        )
      }
      if (body.status === 'active' && !tour.startedAt) {
        tour.startedAt = new Date().toISOString()
      }
      if (body.status === 'done' && !tour.finishedAt) {
        tour.finishedAt = new Date().toISOString()
      }
      if (body.status === 'planned') {
        tour.startedAt = null
        tour.finishedAt = null
      }
      tour.status = body.status
    }
    if (body.driverId !== undefined) {
      const driverId = tours.wholeNumber(body.driverId, 0)
      if (driverId && !store.drivers.some((d) => d.id === driverId)) {
        return deliveryError(
          res,
          400,
          'Driver not found',
          'Dieser Fahrer existiert nicht.'
        )
      }
      tour.driverId = driverId || null
    }
    if (body.name !== undefined)
      tour.name = String(body.name).trim() || tour.name
    if (/^\d{2}:\d{2}$/.test(body.plannedStart))
      tour.plannedStart = body.plannedStart
    if (['bike', 'car', 'van'].includes(body.vehicleType)) {
      tour.vehicleType = body.vehicleType
    }
    if (Array.isArray(body.stopOrder)) {
      applyStopOrder(tour, body.stopOrder.map(Number))
    }

    saveDeliveryStore(store)
    res.json(decorateTour(store, tour))
  })
)

app.delete(
  '/api/deliveries/tours/:id',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return
    store.tours = store.tours.filter((t) => t.id !== tour.id)
    saveDeliveryStore(store)
    res.json({ success: true, message: 'Tour gelöscht.' })
  })
)

app.post(
  '/api/deliveries/tours/:id/stops',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return

    const result = tours.normalizeStopInput(req.body, null)
    if (result.error)
      return deliveryError(res, 400, result.error, result.message)

    const stop = {
      id: nextDeliveryId(tour.stops),
      lat: null,
      lon: null,
      geocodeSource: null,
      completedAt: null,
      failureReason: null,
      ...result.stop,
    }

    await locateWithBudget(store, stop, { force: true })
    tour.stops.push(stop)
    // Ein nachgeschobener Stopp macht eine abgeschlossene Tour wieder auf.
    tours.syncTourStatus(tour)
    saveDeliveryStore(store)
    res.status(201).json(decorateTour(store, tour))
  })
)

app.patch(
  '/api/deliveries/tours/:id/stops/:stopId',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return
    const stop = findStop(req, res, tour)
    if (!stop) return

    const result = tours.normalizeStopInput(req.body, stop)
    if (result.error)
      return deliveryError(res, 400, result.error, result.message)

    const addressChanged =
      tours.formatAddress(result.stop) !== tours.formatAddress(stop)
    Object.assign(stop, result.stop)

    if (addressChanged && result.stop.geocodeSource !== 'manual') {
      stop.lat = null
      stop.lon = null
      stop.geocodeSource = null
    }
    await locateWithBudget(store, stop, { force: addressChanged })

    // Erster abgehakter Stopp startet die Tour, der letzte schliesst sie ab, ein
    // zurueckgesetzter macht sie wieder auf - der Fahrer soll dafuer keinen
    // zweiten Knopf druecken muessen.
    tours.syncTourStatus(tour)

    saveDeliveryStore(store)
    res.json(decorateTour(store, tour))
  })
)

app.delete(
  '/api/deliveries/tours/:id/stops/:stopId',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return
    const stop = findStop(req, res, tour)
    if (!stop) return

    tour.stops = tour.stops.filter((s) => s.id !== stop.id)
    // War das der letzte offene Stopp, ist die Tour jetzt fertig.
    tours.syncTourStatus(tour)
    saveDeliveryStore(store)
    res.json(decorateTour(store, tour))
  })
)

app.post(
  '/api/deliveries/tours/:id/optimize',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return

    // Fehlende Koordinaten noch einmal probieren - aber ohne `force`: eine
    // Adresse, die vor zwei Minuten nicht gefunden wurde, kostet sonst bei
    // jedem "Route berechnen" drei Nominatim-Timeouts.
    await withBudget(hydrateTours(store, [tour]))

    await recalculateTour(store, tour, {
      optimize: req.body?.optimize !== false,
    })
    saveDeliveryStore(store)
    res.json(decorateTour(store, tour))
  })
)

app.post(
  '/api/deliveries/tours/:id/position',
  deliveryRoute((req, res) => {
    const store = getDeliveryStore()
    const tour = findTour(req, res, store)
    if (!tour) return

    const body = req.body || {}
    // `isNumber`, nicht `Number.isFinite(Number(x))`: `null` waere sonst eine
    // gueltige Position auf dem Nullmeridian.
    if (!tours.isNumber(body.lat) || !tours.isNumber(body.lon)) {
      return deliveryError(
        res,
        400,
        'Invalid position',
        'Position benötigt gültige Koordinaten.'
      )
    }

    tour.lastPosition = {
      lat: Number(body.lat),
      lon: Number(body.lon),
      accuracy: tours.isNumber(body.accuracy) ? Number(body.accuracy) : null,
      speed: tours.isNumber(body.speed) ? Number(body.speed) : null,
      at: new Date().toISOString(),
    }
    saveDeliveryStore(store)
    res.json(tour.lastPosition)
  })
)

/** Adresssuche fuer die Erfassungsmaske - ohne einen Stopp anzulegen. */
app.post(
  '/api/deliveries/geocode',
  deliveryRoute(async (req, res) => {
    const store = getDeliveryStore()
    const address =
      tours.formatAddress(req.body || {}) || String(req.body?.address || '')
    if (!address.trim()) {
      return deliveryError(
        res,
        400,
        'Address is required',
        'Es fehlt eine Adresse.'
      )
    }

    const found = await lookupAddress(store, address, true)
    if (!found) {
      return deliveryError(
        res,
        404,
        'Address not found',
        'Zu dieser Adresse wurde kein Ort gefunden.'
      )
    }

    if (found.source !== 'cache') saveDeliveryStore(store)
    res.json(found.hit)
  })
)

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bakery API server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
