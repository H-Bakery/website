/**
 * Notification Routes - Local integration with notifications domain
 * Bakery Management System
 */

import { Router, Request, Response, NextFunction } from 'express'
import { format, subDays, subMonths } from 'date-fns'

const router = Router()

// ============================================================================
// NOTIFICATION INTERFACES
// ============================================================================

interface Notification {
  id: string
  userId: number
  type: 'info' | 'warning' | 'error' | 'success' | 'alert'
  category: 'order' | 'inventory' | 'production' | 'staff' | 'system'
  title: string
  message: string
  data?: any
  priority: 'low' | 'medium' | 'high' | 'critical'
  isRead: boolean
  isArchived: boolean
  createdAt: Date
  readAt?: Date
  archivedAt?: Date
  expiresAt?: Date
}

interface NotificationFilters {
  userId?: number
  type?: string
  category?: string
  priority?: string
  isRead?: boolean
  isArchived?: boolean
  startDate?: string
  endDate?: string
  search?: string
  limit?: number
  offset?: number
}

interface ArchiveOptions {
  olderThan?: number // days
  type?: string
  category?: string
  isRead?: boolean
  keepCount?: number // keep most recent N notifications
}

// ============================================================================
// NOTIFICATION RETRIEVAL ROUTES
// ============================================================================

// Get user notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const filters: NotificationFilters = {
      userId,
      type: req.query.type as string,
      category: req.query.category as string,
      priority: req.query.priority as string,
      isRead: req.query.isRead === 'true',
      isArchived: req.query.isArchived === 'true',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    }

    // Mock data - replace with actual database query
    const notifications: Notification[] = [
      {
        id: 'notif-001',
        userId,
        type: 'warning',
        category: 'inventory',
        title: 'Low Stock Alert',
        message: 'Flour stock is running low (15kg remaining)',
        data: { item: 'Flour', current: 15, minimum: 50 },
        priority: 'high',
        isRead: false,
        isArchived: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: 'notif-002',
        userId,
        type: 'success',
        category: 'order',
        title: 'Large Order Received',
        message: 'New order #1234 for €250.00',
        data: { orderId: 1234, amount: 250.00 },
        priority: 'medium',
        isRead: true,
        isArchived: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        readAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
      }
    ]

    res.json({
      success: true,
      notifications: notifications.slice(filters.offset, filters.offset + filters.limit),
      total: notifications.length,
      unreadCount: notifications.filter(n => !n.isRead).length,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < notifications.length
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get notification by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id
    const userId = (req as any).user?.id || 1

    // Mock data - replace with actual database query
    const notification: Notification = {
      id: notificationId,
      userId,
      type: 'warning',
      category: 'inventory',
      title: 'Low Stock Alert',
      message: 'Flour stock is running low (15kg remaining)',
      data: { item: 'Flour', current: 15, minimum: 50 },
      priority: 'high',
      isRead: false,
      isArchived: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }

    res.json({
      success: true,
      notification
    })
  } catch (error) {
    next(error)
  }
})

// Get notification statistics
router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1

    // Mock data - replace with actual database query
    const stats = {
      total: 156,
      unread: 12,
      archived: 89,
      byType: {
        info: 45,
        warning: 38,
        error: 8,
        success: 65,
        alert: 0
      },
      byCategory: {
        order: 52,
        inventory: 28,
        production: 35,
        staff: 18,
        system: 23
      },
      byPriority: {
        low: 78,
        medium: 56,
        high: 19,
        critical: 3
      },
      recentActivity: {
        today: 5,
        thisWeek: 28,
        thisMonth: 89
      }
    }

    res.json({
      success: true,
      stats
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// NOTIFICATION MANAGEMENT ROUTES
// ============================================================================

// Create notification
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const {
      type = 'info',
      category = 'system',
      title,
      message,
      data,
      priority = 'medium',
      expiresAt
    } = req.body

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required'
      })
    }

    // Mock implementation - would save to database
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      userId,
      type,
      category,
      title,
      message,
      data,
      priority,
      isRead: false,
      isArchived: false,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    }

    res.status(201).json({
      success: true,
      notification,
      message: 'Notification created successfully'
    })
  } catch (error) {
    next(error)
  }
})

// Mark notification as read
router.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id
    const userId = (req as any).user?.id || 1

    // Mock implementation - would update database
    const notification: Notification = {
      id: notificationId,
      userId,
      type: 'warning',
      category: 'inventory',
      title: 'Low Stock Alert',
      message: 'Flour stock is running low',
      priority: 'high',
      isRead: true,
      isArchived: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      readAt: new Date()
    }

    res.json({
      success: true,
      notification,
      message: 'Notification marked as read'
    })
  } catch (error) {
    next(error)
  }
})

// Mark multiple notifications as read
router.put('/mark-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const { notificationIds, all = false } = req.body

    let updatedCount = 0

    if (all) {
      // Mark all unread notifications as read
      // Mock implementation - would update database
      updatedCount = 12
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      // Mock implementation - would update database
      updatedCount = notificationIds.length
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide notificationIds array or set all to true'
      })
    }

    res.json({
      success: true,
      updatedCount,
      message: `${updatedCount} notifications marked as read`
    })
  } catch (error) {
    next(error)
  }
})

// Delete notification
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id
    const userId = (req as any).user?.id || 1

    // Mock implementation - would delete from database
    res.json({
      success: true,
      message: `Notification ${notificationId} deleted successfully`
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// NOTIFICATION ARCHIVAL ROUTES
// ============================================================================

// Archive single notification
router.put('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id
    const userId = (req as any).user?.id || 1

    // Mock implementation - would update database
    const notification: Notification = {
      id: notificationId,
      userId,
      type: 'info',
      category: 'system',
      title: 'Archived Notification',
      message: 'This notification has been archived',
      priority: 'low',
      isRead: true,
      isArchived: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      readAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      archivedAt: new Date()
    }

    res.json({
      success: true,
      notification,
      message: 'Notification archived successfully'
    })
  } catch (error) {
    next(error)
  }
})

// Bulk archive notifications
router.post('/archive/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const options: ArchiveOptions = {
      olderThan: req.body.olderThan || 30,
      type: req.body.type,
      category: req.body.category,
      isRead: req.body.isRead,
      keepCount: req.body.keepCount || 100
    }

    // Mock implementation - would update database
    const archivedCount = 45

    res.json({
      success: true,
      archivedCount,
      message: `${archivedCount} notifications archived`,
      criteria: options
    })
  } catch (error) {
    next(error)
  }
})

// Get archived notifications
router.get('/archived/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const filters: NotificationFilters = {
      userId,
      isArchived: true,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    }

    // Mock data - replace with actual database query
    const archivedNotifications: Notification[] = [
      {
        id: 'notif-archived-001',
        userId,
        type: 'info',
        category: 'order',
        title: 'Order Completed',
        message: 'Order #987 has been completed',
        priority: 'low',
        isRead: true,
        isArchived: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        readAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        archivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ]

    res.json({
      success: true,
      notifications: archivedNotifications,
      total: archivedNotifications.length,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: false
      }
    })
  } catch (error) {
    next(error)
  }
})

// Restore archived notification
router.put('/archived/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id
    const userId = (req as any).user?.id || 1

    // Mock implementation - would update database
    res.json({
      success: true,
      message: `Notification ${notificationId} restored from archive`
    })
  } catch (error) {
    next(error)
  }
})

// Delete archived notifications permanently
router.delete('/archived/purge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const {
      olderThan = 90, // days
      confirm = false
    } = req.body

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Please confirm permanent deletion by setting confirm: true'
      })
    }

    // Mock implementation - would delete from database
    const deletedCount = 23

    res.json({
      success: true,
      deletedCount,
      message: `${deletedCount} archived notifications permanently deleted`,
      criteria: {
        olderThan: `${olderThan} days`,
        archivedBefore: format(subDays(new Date(), olderThan), 'yyyy-MM-dd')
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get archive statistics
router.get('/archived/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1

    // Mock data - replace with actual database query
    const stats = {
      totalArchived: 89,
      oldestArchived: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      newestArchived: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      byMonth: {
        [format(subMonths(new Date(), 2), 'yyyy-MM')]: 28,
        [format(subMonths(new Date(), 1), 'yyyy-MM')]: 34,
        [format(new Date(), 'yyyy-MM')]: 27
      },
      storageSize: '2.3 MB',
      averageAge: '45 days'
    }

    res.json({
      success: true,
      stats
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================================================

// Get user notification preferences
router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1

    // Mock data - replace with actual database query
    const preferences = {
      userId,
      email: {
        enabled: true,
        frequency: 'immediate',
        categories: ['order', 'inventory']
      },
      push: {
        enabled: true,
        categories: ['order', 'production', 'system']
      },
      autoArchive: {
        enabled: true,
        afterDays: 30,
        keepUnread: true
      },
      quiet: {
        enabled: false,
        startTime: '22:00',
        endTime: '07:00'
      }
    }

    res.json({
      success: true,
      preferences
    })
  } catch (error) {
    next(error)
  }
})

// Update notification preferences
router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 1
    const preferences = req.body

    // Mock implementation - would update database
    res.json({
      success: true,
      preferences: {
        userId,
        ...preferences,
        updatedAt: new Date()
      },
      message: 'Notification preferences updated successfully'
    })
  } catch (error) {
    next(error)
  }
})

export default router
