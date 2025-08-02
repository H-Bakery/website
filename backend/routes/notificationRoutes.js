const express = require("express");
const router = express.Router();
const { Notification, User } = require("../models");
const { authenticate } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const socketService = require("../services/socketService");
const { 
  notificationCreationRules,
  bulkNotificationRules,
  notificationIdRules
} = require("../validators/notificationValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// Get all notifications for authenticated user with filters
router.get("/", authenticate, async (req, res) => {
  try {
    const {
      unreadOnly,
      category,
      priority,
      limit = 50,
      offset = 0,
    } = req.query;

    // Build where clause - exclude archived and deleted notifications by default
    const where = { 
      userId: req.user.id,
      archived: false,
      deletedAt: null,
    };
    
    if (unreadOnly === "true") {
      where.read = false;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (priority) {
      where.priority = priority;
    }

    const notifications = await Notification.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          attributes: ["id", "username"],
        },
      ],
    });

    // Get counts for stats - exclude archived and deleted
    const stats = await Notification.findOne({
      where: { 
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
      attributes: [
        [Notification.sequelize.fn("COUNT", Notification.sequelize.col("id")), "total"],
        [
          Notification.sequelize.fn(
            "SUM",
            Notification.sequelize.literal("CASE WHEN read = false THEN 1 ELSE 0 END")
          ),
          "unread",
        ],
      ],
      raw: true,
    });

    // Get counts by priority - exclude archived and deleted
    const priorityStats = await Notification.findAll({
      where: { 
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
      attributes: [
        "priority",
        [Notification.sequelize.fn("COUNT", Notification.sequelize.col("id")), "count"],
      ],
      group: ["priority"],
      raw: true,
    });

    const byPriority = priorityStats.reduce((acc, stat) => {
      acc[stat.priority] = parseInt(stat.count);
      return acc;
    }, {});

    res.json({
      notifications,
      stats: {
        total: parseInt(stats?.total || 0),
        unread: parseInt(stats?.unread || 0),
        byPriority,
      },
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get single notification
router.get("/:id", authenticate, async (req, res) => {
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
          attributes: ["id", "username"],
        },
      ],
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    logger.error("Error fetching notification:", error);
    res.status(500).json({ error: "Failed to fetch notification" });
  }
});

// Create notification (admin only)
router.post("/", authenticate, notificationCreationRules(), handleValidationErrors, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, message, type, category, priority, userId, metadata } = req.body;

    const notification = await Notification.create({
      title,
      message,
      type: type || "info",
      category: category || "general",
      priority: priority || "medium",
      userId: userId || req.user.id,
      metadata: metadata || {},
      read: false,
    });

    // Send WebSocket notification to the user
    if (notification.userId) {
      socketService.sendNotificationToUser(notification.userId, notification);
    }

    logger.info(`Notification created: ${notification.id}`);
    res.status(201).json(notification);
  } catch (error) {
    logger.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// Mark notification as read
router.put("/:id/read", authenticate, notificationIdRules(), handleValidationErrors, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    // Send WebSocket update
    socketService.updateNotificationForUser(req.user.id, notification.id, { read: true });

    res.json(notification);
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all notifications as read
router.put("/read-all", authenticate, async (req, res) => {
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
    );

    logger.info(`Marked ${count} notifications as read for user ${req.user.id}`);
    res.json({ message: `${count} notifications marked as read` });
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Soft delete notification
router.delete("/:id", authenticate, notificationIdRules(), handleValidationErrors, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        archived: false,
        deletedAt: null,
      },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Soft delete by setting deletedAt timestamp
    await notification.update({ deletedAt: new Date() });
    
    // Send WebSocket delete event
    socketService.deleteNotificationForUser(req.user.id, req.params.id);
    
    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Bulk create notifications (admin only, for system events)
router.post("/bulk", authenticate, bulkNotificationRules(), handleValidationErrors, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ error: "Notifications array required" });
    }

    // Add default values to each notification
    const notificationsWithDefaults = notifications.map((n) => ({
      ...n,
      type: n.type || "info",
      category: n.category || "general",
      priority: n.priority || "medium",
      read: false,
      metadata: n.metadata || {},
    }));

    const created = await Notification.bulkCreate(notificationsWithDefaults);
    logger.info(`Created ${created.length} notifications in bulk`);

    // Send WebSocket notifications for each created notification
    created.forEach((notification) => {
      if (notification.userId) {
        socketService.sendNotificationToUser(notification.userId, notification);
      } else {
        // Broadcast to all if no specific user
        socketService.broadcastNotification(notification);
      }
    });

    res.status(201).json({ created: created.length });
  } catch (error) {
    logger.error("Error bulk creating notifications:", error);
    res.status(500).json({ error: "Failed to create notifications" });
  }
});

module.exports = router;