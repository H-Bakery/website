const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')

// In-memory storage for schedules (mock)
let schedules = [
  {
    id: '1',
    reportType: 'DAILY',
    format: 'PDF',
    frequency: 'DAILY',
    recipients: ['chef@baeckerei-heusser.de'],
    active: true,
    timeOfDay: '06:00',
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
]

// POST /api/reports/generate
router.post('/generate', authenticate, (req, res) => {
  const { type, format, startDate } = req.body
  const report = {
    id: Date.now().toString(),
    downloadUrl: `/api/reports/download/${Date.now()}`,
    filename: `bericht-${(type || 'custom').toLowerCase()}-${
      startDate || 'now'
    }.${(format || 'pdf').toLowerCase()}`,
    format: format || 'PDF',
    generatedAt: new Date().toISOString(),
  }
  res.json({ success: true, report })
})

// GET /api/reports/download/:token
router.get('/download/:token', (req, res) => {
  res.status(200).json({ message: 'Download not available in mock mode' })
})

// POST /api/reports/schedule
router.post('/schedule', authenticate, (req, res) => {
  const schedule = {
    ...req.body,
    id: Date.now().toString(),
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
  schedules.push(schedule)
  res.json({ success: true, schedule })
})

// GET /api/reports/schedules
router.get('/schedules', authenticate, (req, res) => {
  res.json({ success: true, schedules })
})

// PUT /api/reports/schedule/:id
router.put('/schedule/:id', authenticate, (req, res) => {
  const index = schedules.findIndex((s) => s.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Schedule not found' })
  }
  schedules[index] = { ...schedules[index], ...req.body }
  res.json({ success: true, schedule: schedules[index] })
})

// DELETE /api/reports/schedule/:id
router.delete('/schedule/:id', authenticate, (req, res) => {
  schedules = schedules.filter((s) => s.id !== req.params.id)
  res.json({ success: true })
})

// GET /api/reports/storage/stats
router.get('/storage/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    stats: {
      totalFiles: 12,
      totalSize: 4500000,
      oldestFile: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      newestFile: new Date().toISOString(),
    },
  })
})

// POST /api/reports/storage/cleanup
router.post('/storage/cleanup', authenticate, (req, res) => {
  res.json({ success: true })
})

module.exports = router
