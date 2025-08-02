const express = require("express");
const router = express.Router();
const notificationArchiveService = require("../services/notificationArchiveService");
const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");
const { body, param, query, validationResult } = require("express-validator");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Get archived notifications for authenticated user
router.get("/", authenticate, [
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("offset").optional().isInt({ min: 0 }),
  query("category").optional().isIn(["staff", "order", "system", "inventory", "general"]),
  query("priority").optional().isIn(["low", "medium", "high", "urgent"]),
  query("search").optional().isLength({ min: 1, max: 255 }),
], handleValidationErrors, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      category,
      priority,
      search,
      startDate,
      endDate,
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    if (category) options.category = category;
    if (priority) options.priority = priority;
    if (search) options.searchQuery = search;

    if (startDate && endDate) {
      options.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const result = await notificationArchiveService.getArchivedNotifications(
      req.user.id,
      options
    );

    res.json(result);
  } catch (error) {
    logger.error("Error getting archived notifications:", error);
    res.status(500).json({ error: "Failed to get archived notifications" });
  }
});

// Get archive statistics for authenticated user
router.get("/stats", authenticate, async (req, res) => {
  try {
    const stats = await notificationArchiveService.getArchiveStats(req.user.id);
    res.json(stats);
  } catch (error) {
    logger.error("Error getting archive stats:", error);
    res.status(500).json({ error: "Failed to get archive statistics" });
  }
});

// Archive a single notification
router.put("/:id/archive", authenticate, [
  param("id").isInt({ min: 1 }),
], handleValidationErrors, async (req, res) => {
  try {
    const notification = await notificationArchiveService.archiveNotification(
      req.params.id,
      req.user.id
    );
    res.json({ 
      message: "Notification archived successfully",
      notification 
    });
  } catch (error) {
    logger.error("Error archiving notification:", error);
    if (error.message.includes("not found") || error.message.includes("already archived")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to archive notification" });
  }
});

// Archive multiple notifications
router.put("/archive/bulk", authenticate, [
  body("notificationIds").isArray({ min: 1, max: 100 }),
  body("notificationIds.*").isInt({ min: 1 }),
], handleValidationErrors, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const count = await notificationArchiveService.archiveBulk(
      notificationIds,
      req.user.id
    );
    res.json({ 
      message: `${count} notifications archived successfully`,
      count 
    });
  } catch (error) {
    logger.error("Error bulk archiving notifications:", error);
    res.status(500).json({ error: "Failed to archive notifications" });
  }
});

// Restore a notification from archive
router.put("/:id/restore", authenticate, [
  param("id").isInt({ min: 1 }),
], handleValidationErrors, async (req, res) => {
  try {
    const notification = await notificationArchiveService.restoreNotification(
      req.params.id,
      req.user.id
    );
    res.json({ 
      message: "Notification restored successfully",
      notification 
    });
  } catch (error) {
    logger.error("Error restoring notification:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to restore notification" });
  }
});

// Restore multiple notifications from archive
router.put("/restore/bulk", authenticate, [
  body("notificationIds").isArray({ min: 1, max: 100 }),
  body("notificationIds.*").isInt({ min: 1 }),
], handleValidationErrors, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const count = await notificationArchiveService.restoreBulk(
      notificationIds,
      req.user.id
    );
    res.json({ 
      message: `${count} notifications restored successfully`,
      count 
    });
  } catch (error) {
    logger.error("Error bulk restoring notifications:", error);
    res.status(500).json({ error: "Failed to restore notifications" });
  }
});

// Permanently delete a notification
router.delete("/:id/permanent", authenticate, [
  param("id").isInt({ min: 1 }),
], handleValidationErrors, async (req, res) => {
  try {
    await notificationArchiveService.permanentDeleteNotification(
      req.params.id,
      req.user.id
    );
    res.json({ message: "Notification permanently deleted" });
  } catch (error) {
    logger.error("Error permanently deleting notification:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Search across all notifications (active and archived)
router.get("/search", authenticate, [
  query("q").notEmpty().isLength({ min: 1, max: 255 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("offset").optional().isInt({ min: 0 }),
  query("includeArchived").optional().isBoolean(),
  query("category").optional().isIn(["staff", "order", "system", "inventory", "general"]),
  query("priority").optional().isIn(["low", "medium", "high", "urgent"]),
], handleValidationErrors, async (req, res) => {
  try {
    const {
      q: searchQuery,
      limit = 50,
      offset = 0,
      includeArchived = true,
      category,
      priority,
      startDate,
      endDate,
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeArchived: includeArchived === "true",
    };

    if (category) options.category = category;
    if (priority) options.priority = priority;

    if (startDate && endDate) {
      options.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const result = await notificationArchiveService.searchNotifications(
      req.user.id,
      searchQuery,
      options
    );

    res.json(result);
  } catch (error) {
    logger.error("Error searching notifications:", error);
    res.status(500).json({ error: "Failed to search notifications" });
  }
});

// Admin-only routes for system management

// Auto-archive old notifications (admin only)
router.post("/auto-archive", requireAdmin, [
  body("readOlderThanDays").optional().isInt({ min: 1, max: 365 }),
  body("unreadOlderThanDays").optional().isInt({ min: 1, max: 365 }),
  body("categories").optional().isArray(),
  body("categories.*").optional().isIn(["staff", "order", "system", "inventory", "general"]),
  body("priorities").optional().isArray(),
  body("priorities.*").optional().isIn(["low", "medium", "high", "urgent"]),
], handleValidationErrors, async (req, res) => {
  try {
    const count = await notificationArchiveService.autoArchiveOldNotifications(req.body);
    res.json({ 
      message: `${count} notifications auto-archived`,
      count 
    });
  } catch (error) {
    logger.error("Error auto-archiving notifications:", error);
    res.status(500).json({ error: "Failed to auto-archive notifications" });
  }
});

// Cleanup old archived notifications (admin only)
router.post("/cleanup", requireAdmin, [
  body("daysOld").optional().isInt({ min: 30, max: 1095 }), // 30 days to 3 years
], handleValidationErrors, async (req, res) => {
  try {
    const { daysOld = 365 } = req.body;
    const count = await notificationArchiveService.cleanupOldArchives(daysOld);
    res.json({ 
      message: `${count} old archived notifications permanently deleted`,
      count 
    });
  } catch (error) {
    logger.error("Error cleaning up old archives:", error);
    res.status(500).json({ error: "Failed to cleanup old archives" });
  }
});

module.exports = router;