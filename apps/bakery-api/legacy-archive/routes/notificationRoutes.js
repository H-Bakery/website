const express = require('express')
const router = express.Router()
const { Notification, User } = require('../models')
const { authenticate } = require('../middleware/authMiddleware')
const logger = require('../utils/logger')
const { Op } = require('sequelize')
const socketService = require('../services/socketService')
const {
  notificationCreationRules,
  bulkNotificationRules,
  notificationIdRules,
} = require('../validators/notificationValidator')
const { handleValidationErrors } = require('../middleware/validationMiddleware')

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     description: Retrieve notifications for the authenticated user with optional filtering and pagination
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Filter to show only unread notifications
 *         example: true
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, order, staff, inventory, system]
 *         description: Filter by notification category
 *         example: order
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by priority level
 *         example: high
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of notifications to return
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of notifications to skip for pagination
 *         example: 0
 *     responses:
 *       '200':
 *         description: Successfully retrieved notifications with statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get all notifications for authenticated user with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { unreadOnly, category, priority, limit = 50, offset = 0 } = req.query

    // Build where clause - exclude archived and deleted notifications by default
    const where = {
      userId: req.user.id,
      archived: false,
      deletedAt: null,
    }

    if (unreadOnly === 'true') {
      where.read = false
    }

    if (category) {
      where.category = category
    }

    if (priority) {
      where.priority = priority
    }

    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
        },
      ],
    })

    // Get counts for stats - exclude archived and deleted
    const stats = await Notification.findOne({
      where: {
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
      attributes: [
        [
          Notification.sequelize.fn('COUNT', Notification.sequelize.col('id')),
          'total',
        ],
        [
          Notification.sequelize.fn(
            'SUM',
            Notification.sequelize.literal(
              'CASE WHEN read = false THEN 1 ELSE 0 END'
            )
          ),
          'unread',
        ],
      ],
      raw: true,
    })

    // Get counts by priority - exclude archived and deleted
    const priorityStats = await Notification.findAll({
      where: {
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
      attributes: [
        'priority',
        [
          Notification.sequelize.fn('COUNT', Notification.sequelize.col('id')),
          'count',
        ],
      ],
      group: ['priority'],
      raw: true,
    })

    const byPriority = priorityStats.reduce((acc, stat) => {
      acc[stat.priority] = parseInt(stat.count)
      return acc
    }, {})

    res.json({
      notifications,
      stats: {
        total: parseInt(stats?.total || 0),
        unread: parseInt(stats?.unread || 0),
        byPriority,
      },
    })
  } catch (error) {
    logger.error('Error fetching notifications:', error)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

/**
 * @openapi
 * /api/notifications/{id}:
 *   get:
 *     summary: Get single notification
 *     description: Retrieve a specific notification by ID for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Notification ID
 *         example: 42
 *     responses:
 *       '200':
 *         description: Successfully retrieved notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationDetail'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get single notification
router.get('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
        },
      ],
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json(notification)
  } catch (error) {
    logger.error('Error fetching notification:', error)
    res.status(500).json({ error: 'Failed to fetch notification' })
  }
})

/**
 * @openapi
 * /api/notifications:
 *   post:
 *     summary: Create a notification
 *     description: Create a new notification (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationRequest'
 *     responses:
 *       '201':
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationDetail'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Create notification (admin only)
router.post(
  '/',
  authenticate,
  notificationCreationRules(),
  handleValidationErrors,
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const { title, message, type, category, priority, userId, metadata } =
        req.body

      const notification = await Notification.create({
        title,
        message,
        type: type || 'info',
        category: category || 'general',
        priority: priority || 'medium',
        userId: userId || req.user.id,
        metadata: metadata || {},
        read: false,
      })

      // Send WebSocket notification to the user
      if (notification.userId) {
        socketService.sendNotificationToUser(notification.userId, notification)
      }

      logger.info(`Notification created: ${notification.id}`)
      res.status(201).json(notification)
    } catch (error) {
      logger.error('Error creating notification:', error)
      res.status(500).json({ error: 'Failed to create notification' })
    }
  }
)

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Notification ID
 *         example: 42
 *     responses:
 *       '200':
 *         description: Notification marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationDetail'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Mark notification as read
router.put(
  '/:id/read',
  authenticate,
  notificationIdRules(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const notification = await Notification.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          archived: false,
          deletedAt: null,
        },
      })

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      notification.read = true
      await notification.save()

      // Send WebSocket update
      socketService.updateNotificationForUser(req.user.id, notification.id, {
        read: true,
      })

      res.json(notification)
    } catch (error) {
      logger.error('Error marking notification as read:', error)
      res.status(500).json({ error: 'Failed to update notification' })
    }
  }
)

/**
 * @openapi
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     description: Mark all unread notifications as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: '5 notifications marked as read'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Mark all notifications as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const [count] = await Notification.update(
      { read: true },
      {
        where: {
          userId: req.user.id,
          read: false,
          archived: false,
          deletedAt: null,
        },
      }
    )

    logger.info(`Marked ${count} notifications as read for user ${req.user.id}`)
    res.json({ message: `${count} notifications marked as read` })
  } catch (error) {
    logger.error('Error marking all notifications as read:', error)
    res.status(500).json({ error: 'Failed to update notifications' })
  }
})

/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: Soft delete a notification (marks as deleted but keeps in database)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Notification ID
 *         example: 42
 *     responses:
 *       '200':
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Notification deleted successfully'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Soft delete notification
router.delete(
  '/:id',
  authenticate,
  notificationIdRules(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const notification = await Notification.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id,
          archived: false,
          deletedAt: null,
        },
      })

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' })
      }

      // Soft delete by setting deletedAt timestamp
      await notification.update({ deletedAt: new Date() })

      // Send WebSocket delete event
      socketService.deleteNotificationForUser(req.user.id, req.params.id)

      res.json({ message: 'Notification deleted successfully' })
    } catch (error) {
      logger.error('Error deleting notification:', error)
      res.status(500).json({ error: 'Failed to delete notification' })
    }
  }
)

/**
 * @openapi
 * /api/notifications/bulk:
 *   post:
 *     summary: Bulk create notifications
 *     description: Create multiple notifications at once (admin only, for system events)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkNotificationRequest'
 *     responses:
 *       '201':
 *         description: Notifications created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: integer
 *                   description: Number of notifications created
 *                   example: 10
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Bulk create notifications (admin only, for system events)
router.post(
  '/bulk',
  authenticate,
  bulkNotificationRules(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const { notifications } = req.body

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({ error: 'Notifications array required' })
      }

      // Add default values to each notification
      const notificationsWithDefaults = notifications.map((n) => ({
        ...n,
        type: n.type || 'info',
        category: n.category || 'general',
        priority: n.priority || 'medium',
        read: false,
        metadata: n.metadata || {},
      }))

      const created = await Notification.bulkCreate(notificationsWithDefaults)
      logger.info(`Created ${created.length} notifications in bulk`)

      // Send WebSocket notifications for each created notification
      created.forEach((notification) => {
        if (notification.userId) {
          socketService.sendNotificationToUser(
            notification.userId,
            notification
          )
        } else {
          // Broadcast to all if no specific user
          socketService.broadcastNotification(notification)
        }
      })

      res.status(201).json({ created: created.length })
    } catch (error) {
      logger.error('Error bulk creating notifications:', error)
      res.status(500).json({ error: 'Failed to create notifications' })
    }
  }
)

module.exports = router
