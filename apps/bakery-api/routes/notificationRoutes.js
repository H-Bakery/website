const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')

// In-memory mock notification data
let notifications = [
  {
    id: 'notif-001',
    userId: 1,
    type: 'warning',
    category: 'inventory',
    title: 'Mehl-Bestand niedrig',
    message: 'Mehl-Bestand ist niedrig (15kg verbleibend)',
    data: { item: 'Mehl', current: 15, minimum: 50 },
    priority: 'high',
    isRead: false,
    isArchived: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-002',
    userId: 1,
    type: 'success',
    category: 'order',
    title: 'Große Bestellung eingegangen',
    message: 'Neue Bestellung #1234 über €250,00',
    data: { orderId: 1234, amount: 250.0 },
    priority: 'medium',
    isRead: true,
    isArchived: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    readAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-003',
    userId: 1,
    type: 'info',
    category: 'system',
    title: 'System-Update',
    message: 'System-Update wurde erfolgreich durchgeführt',
    priority: 'low',
    isRead: true,
    isArchived: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    readAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    archivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// GET /api/notifications - List notifications
router.get('/', authenticate, (req, res) => {
  const { type, category, priority, isRead, limit = 50, offset = 0 } = req.query
  let filtered = notifications.filter((n) => !n.isArchived)

  if (type) filtered = filtered.filter((n) => n.type === type)
  if (category) filtered = filtered.filter((n) => n.category === category)
  if (priority) filtered = filtered.filter((n) => n.priority === priority)
  if (isRead !== undefined) {
    filtered = filtered.filter((n) => n.isRead === (isRead === 'true'))
  }

  const start = parseInt(offset)
  const lim = parseInt(limit)

  res.json({
    success: true,
    notifications: filtered.slice(start, start + lim),
    total: filtered.length,
    unreadCount: filtered.filter((n) => !n.isRead).length,
    pagination: {
      limit: lim,
      offset: start,
      hasMore: start + lim < filtered.length,
    },
  })
})

// GET /api/notifications/preferences (must be before /:id)
router.get('/preferences', authenticate, (req, res) => {
  res.json({
    success: true,
    preferences: {
      userId: 1,
      email: {
        enabled: true,
        frequency: 'immediate',
        categories: ['order', 'inventory'],
      },
      push: { enabled: true, categories: ['order', 'production', 'system'] },
      autoArchive: { enabled: true, afterDays: 30, keepUnread: true },
    },
  })
})

// PUT /api/notifications/preferences
router.put('/preferences', authenticate, (req, res) => {
  const preferences = req.body
  res.json({
    success: true,
    preferences: {
      userId: 1,
      ...preferences,
      updatedAt: new Date().toISOString(),
    },
    message: 'Notification preferences updated successfully',
  })
})

// GET /api/notifications/stats/summary
router.get('/stats/summary', authenticate, (req, res) => {
  const active = notifications.filter((n) => !n.isArchived)
  res.json({
    success: true,
    stats: {
      total: notifications.length,
      unread: active.filter((n) => !n.isRead).length,
      archived: notifications.filter((n) => n.isArchived).length,
      byType: {
        info: notifications.filter((n) => n.type === 'info').length,
        warning: notifications.filter((n) => n.type === 'warning').length,
        error: notifications.filter((n) => n.type === 'error').length,
        success: notifications.filter((n) => n.type === 'success').length,
      },
      byPriority: {
        low: notifications.filter((n) => n.priority === 'low').length,
        medium: notifications.filter((n) => n.priority === 'medium').length,
        high: notifications.filter((n) => n.priority === 'high').length,
      },
    },
  })
})

// GET /api/notifications/:id
router.get('/:id', authenticate, (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id)
  if (!notification) {
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  }
  res.json({ success: true, notification })
})

// POST /api/notifications
router.post('/', authenticate, (req, res) => {
  const {
    type = 'info',
    category = 'system',
    title,
    message,
    data,
    priority = 'medium',
  } = req.body

  if (!title || !message) {
    return res
      .status(400)
      .json({ success: false, error: 'Title and message are required' })
  }

  const notification = {
    id: `notif-${Date.now()}`,
    userId: 1,
    type,
    category,
    title,
    message,
    data: data || null,
    priority,
    isRead: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
  }
  notifications.push(notification)
  res.status(201).json({
    success: true,
    notification,
    message: 'Notification created successfully',
  })
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id)
  if (!notification) {
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  }

  notification.isRead = true
  notification.readAt = new Date().toISOString()
  res.json({
    success: true,
    notification,
    message: 'Notification marked as read',
  })
})

// PUT /api/notifications/mark-read (bulk)
router.put('/mark-read', authenticate, (req, res) => {
  const { notificationIds, all = false } = req.body
  let updatedCount = 0

  if (all) {
    notifications.forEach((n) => {
      if (!n.isRead) {
        n.isRead = true
        n.readAt = new Date().toISOString()
        updatedCount++
      }
    })
  } else if (notificationIds && Array.isArray(notificationIds)) {
    notificationIds.forEach((id) => {
      const n = notifications.find((n) => n.id === id)
      if (n && !n.isRead) {
        n.isRead = true
        n.readAt = new Date().toISOString()
        updatedCount++
      }
    })
  } else {
    return res.status(400).json({
      success: false,
      error: 'Provide notificationIds array or set all to true',
    })
  }

  res.json({
    success: true,
    updatedCount,
    message: `${updatedCount} notifications marked as read`,
  })
})

// PUT /api/notifications/:id/archive
router.put('/:id/archive', authenticate, (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id)
  if (!notification) {
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  }

  notification.isArchived = true
  notification.archivedAt = new Date().toISOString()
  res.json({
    success: true,
    notification,
    message: 'Notification archived successfully',
  })
})

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, (req, res) => {
  const index = notifications.findIndex((n) => n.id === req.params.id)
  if (index === -1) {
    return res
      .status(404)
      .json({ success: false, error: 'Notification not found' })
  }

  notifications.splice(index, 1)
  res.json({ success: true, message: 'Notification deleted successfully' })
})

module.exports = router
