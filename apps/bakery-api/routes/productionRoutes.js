const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')

// In-memory mock production data
let schedules = [
  {
    id: 1,
    name: 'Morgen-Backplan',
    date: '2026-03-09',
    status: 'active',
    type: 'daily',
    items: [
      { productId: 1, name: 'Bauernbrot', quantity: 50 },
      { productId: 3, name: 'Brezel', quantity: 100 },
    ],
    createdAt: '2026-03-08T20:00:00Z',
    updatedAt: '2026-03-08T20:00:00Z',
  },
  {
    id: 2,
    name: 'Nachmittag-Backplan',
    date: '2026-03-09',
    status: 'pending',
    type: 'daily',
    items: [
      { productId: 5, name: 'Apfelkuchen', quantity: 10 },
      { productId: 8, name: 'Käsekuchen', quantity: 8 },
    ],
    createdAt: '2026-03-08T20:00:00Z',
    updatedAt: '2026-03-08T20:00:00Z',
  },
]

let batches = [
  {
    id: 1,
    scheduleId: 1,
    productName: 'Bauernbrot',
    quantity: 50,
    status: 'in_progress',
    startedAt: '2026-03-09T04:00:00Z',
    completedAt: null,
    assignedTo: 'Max Müller',
    notes: '',
  },
  {
    id: 2,
    scheduleId: 1,
    productName: 'Brezel',
    quantity: 100,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    assignedTo: 'Anna Schmidt',
    notes: '',
  },
]

// GET /api/production/schedules
router.get('/schedules', authenticate, (req, res) => {
  const { date, status, type, limit = 50, offset = 0 } = req.query
  let filtered = [...schedules]

  if (date) filtered = filtered.filter((s) => s.date === date)
  if (status) filtered = filtered.filter((s) => s.status === status)
  if (type) filtered = filtered.filter((s) => s.type === type)

  const start = parseInt(offset)
  const lim = parseInt(limit)

  res.json({
    success: true,
    data: filtered.slice(start, start + lim),
    total: filtered.length,
  })
})

// POST /api/production/schedules
router.post('/schedules', authenticate, (req, res) => {
  const { name, date, type, items } = req.body

  if (!name || !date) {
    return res.status(400).json({ error: 'name and date are required' })
  }

  const schedule = {
    id: Math.max(...schedules.map((s) => s.id), 0) + 1,
    name,
    date,
    status: 'pending',
    type: type || 'daily',
    items: items || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  schedules.push(schedule)
  res.status(201).json({ success: true, data: schedule })
})

// PUT /api/production/schedules/:id
router.put('/schedules/:id', authenticate, (req, res) => {
  const index = schedules.findIndex((s) => s.id === parseInt(req.params.id))
  if (index === -1) return res.status(404).json({ error: 'Schedule not found' })

  const { id: _id, createdAt: _ca, ...safeFields } = req.body
  schedules[index] = {
    ...schedules[index],
    ...safeFields,
    updatedAt: new Date().toISOString(),
  }
  res.json({ success: true, data: schedules[index] })
})

// GET /api/production/status
router.get('/status', authenticate, (req, res) => {
  const { date } = req.query
  const today = date || new Date().toISOString().split('T')[0]

  const todaySchedules = schedules.filter((s) => s.date === today)
  const todayBatches = batches.filter((b) =>
    todaySchedules.some((s) => s.id === b.scheduleId)
  )

  res.json({
    success: true,
    data: {
      date: today,
      schedulesCount: todaySchedules.length,
      batchesTotal: todayBatches.length,
      batchesPending: todayBatches.filter((b) => b.status === 'pending').length,
      batchesInProgress: todayBatches.filter((b) => b.status === 'in_progress')
        .length,
      batchesCompleted: todayBatches.filter((b) => b.status === 'completed')
        .length,
    },
  })
})

// POST /api/production/batches
router.post('/batches', authenticate, (req, res) => {
  const { scheduleId, productName, quantity, assignedTo } = req.body

  if (!scheduleId || !productName || !quantity) {
    return res
      .status(400)
      .json({ error: 'scheduleId, productName, and quantity are required' })
  }

  const schedule = schedules.find((s) => s.id === scheduleId)
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' })

  const batch = {
    id: Math.max(...batches.map((b) => b.id), 0) + 1,
    scheduleId,
    productName,
    quantity,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    assignedTo: assignedTo || null,
    notes: '',
  }
  batches.push(batch)
  res.status(201).json({ success: true, data: batch })
})

// POST /api/production/batches/:id/start
router.post('/batches/:id/start', authenticate, (req, res) => {
  const batch = batches.find((b) => b.id === parseInt(req.params.id))
  if (!batch) return res.status(404).json({ error: 'Batch not found' })

  if (batch.status !== 'pending' && batch.status !== 'paused') {
    return res
      .status(400)
      .json({ error: 'Batch cannot be started in current state' })
  }

  batch.status = 'in_progress'
  batch.startedAt = batch.startedAt || new Date().toISOString()
  res.json({ success: true, data: batch })
})

// POST /api/production/batches/:id/complete
router.post('/batches/:id/complete', authenticate, (req, res) => {
  const batch = batches.find((b) => b.id === parseInt(req.params.id))
  if (!batch) return res.status(404).json({ error: 'Batch not found' })

  if (batch.status !== 'in_progress') {
    return res
      .status(400)
      .json({ error: 'Only in-progress batches can be completed' })
  }

  batch.status = 'completed'
  batch.completedAt = new Date().toISOString()
  if (req.body.notes) batch.notes = req.body.notes
  res.json({ success: true, data: batch })
})

module.exports = router
