const { Notification, User } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

class NotificationArchiveService {
  /**
   * Archive a single notification
   */
  async archiveNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          archived: false,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error("Notification not found or already archived");
      }

      await notification.update({
        archived: true,
        archivedAt: new Date(),
      });

      logger.info(`Notification ${notificationId} archived by user ${userId}`);
      return notification;
    } catch (error) {
      logger.error("Error archiving notification:", error);
      throw error;
    }
  }

  /**
   * Archive multiple notifications
   */
  async archiveBulk(notificationIds, userId) {
    try {
      const [updatedCount] = await Notification.update(
        {
          archived: true,
          archivedAt: new Date(),
        },
        {
          where: {
            id: { [Op.in]: notificationIds },
            userId: userId,
            archived: false,
            deletedAt: null,
          },
        }
      );

      logger.info(`${updatedCount} notifications archived by user ${userId}`);
      return updatedCount;
    } catch (error) {
      logger.error("Error bulk archiving notifications:", error);
      throw error;
    }
  }

  /**
   * Restore a notification from archive
   */
  async restoreNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          archived: true,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error("Archived notification not found");
      }

      await notification.update({
        archived: false,
        archivedAt: null,
      });

      logger.info(`Notification ${notificationId} restored by user ${userId}`);
      return notification;
    } catch (error) {
      logger.error("Error restoring notification:", error);
      throw error;
    }
  }

  /**
   * Restore multiple notifications from archive
   */
  async restoreBulk(notificationIds, userId) {
    try {
      const [updatedCount] = await Notification.update(
        {
          archived: false,
          archivedAt: null,
        },
        {
          where: {
            id: { [Op.in]: notificationIds },
            userId: userId,
            archived: true,
            deletedAt: null,
          },
        }
      );

      logger.info(`${updatedCount} notifications restored by user ${userId}`);
      return updatedCount;
    } catch (error) {
      logger.error("Error bulk restoring notifications:", error);
      throw error;
    }
  }

  /**
   * Soft delete a notification
   */
  async softDeleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await notification.update({
        deletedAt: new Date(),
      });

      logger.info(`Notification ${notificationId} soft deleted by user ${userId}`);
      return notification;
    } catch (error) {
      logger.error("Error soft deleting notification:", error);
      throw error;
    }
  }

  /**
   * Permanently delete a notification
   */
  async permanentDeleteNotification(notificationId, userId) {
    try {
      const result = await Notification.destroy({
        where: {
          id: notificationId,
          userId: userId,
        },
      });

      if (result === 0) {
        throw new Error("Notification not found");
      }

      logger.info(`Notification ${notificationId} permanently deleted by user ${userId}`);
      return result;
    } catch (error) {
      logger.error("Error permanently deleting notification:", error);
      throw error;
    }
  }

  /**
   * Get archived notifications for a user
   */
  async getArchivedNotifications(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        category,
        priority,
        dateRange,
        searchQuery,
      } = options;

      const where = {
        userId: userId,
        archived: true,
        deletedAt: null,
      };

      // Apply filters
      if (category) {
        where.category = category;
      }

      if (priority) {
        where.priority = priority;
      }

      if (dateRange) {
        where.archivedAt = {
          [Op.between]: [dateRange.start, dateRange.end],
        };
      }

      if (searchQuery) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${searchQuery}%` } },
          { message: { [Op.iLike]: `%${searchQuery}%` } },
        ];
      }

      const notifications = await Notification.findAll({
        where,
        order: [["archivedAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            attributes: ["id", "username"],
          },
        ],
      });

      // Get total count for pagination
      const total = await Notification.count({ where });

      return {
        notifications,
        total,
        hasMore: offset + notifications.length < total,
      };
    } catch (error) {
      logger.error("Error getting archived notifications:", error);
      throw error;
    }
  }

  /**
   * Get archive statistics for a user
   */
  async getArchiveStats(userId) {
    try {
      const [stats] = await Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          [Notification.sequelize.fn("COUNT", Notification.sequelize.col("id")), "total"],
          [
            Notification.sequelize.fn(
              "COUNT",
              Notification.sequelize.literal("CASE WHEN read = true THEN 1 END")
            ),
            "read",
          ],
          [
            Notification.sequelize.fn(
              "COUNT",
              Notification.sequelize.literal("CASE WHEN read = false THEN 1 END")
            ),
            "unread",
          ],
        ],
        raw: true,
      });

      // Get category distribution
      const categoryStats = await Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          "category",
          [Notification.sequelize.fn("COUNT", Notification.sequelize.col("id")), "count"],
        ],
        group: ["category"],
        raw: true,
      });

      // Get priority distribution
      const priorityStats = await Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          "priority",
          [Notification.sequelize.fn("COUNT", Notification.sequelize.col("id")), "count"],
        ],
        group: ["priority"],
        raw: true,
      });

      const byCategory = categoryStats.reduce((acc, stat) => {
        acc[stat.category] = parseInt(stat.count);
        return acc;
      }, {});

      const byPriority = priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = parseInt(stat.count);
        return acc;
      }, {});

      return {
        total: parseInt(stats?.total || 0),
        read: parseInt(stats?.read || 0),
        unread: parseInt(stats?.unread || 0),
        byCategory,
        byPriority,
      };
    } catch (error) {
      logger.error("Error getting archive stats:", error);
      throw error;
    }
  }

  /**
   * Auto-archive old notifications based on rules
   */
  async autoArchiveOldNotifications(rules = {}) {
    try {
      const {
        readOlderThanDays = 30,
        unreadOlderThanDays = 90,
        categories = [],
        priorities = [],
      } = rules;

      const readCutoff = new Date();
      readCutoff.setDate(readCutoff.getDate() - readOlderThanDays);

      const unreadCutoff = new Date();
      unreadCutoff.setDate(unreadCutoff.getDate() - unreadOlderThanDays);

      let where = {
        archived: false,
        deletedAt: null,
        [Op.or]: [
          {
            read: true,
            createdAt: { [Op.lt]: readCutoff },
          },
          {
            read: false,
            createdAt: { [Op.lt]: unreadCutoff },
          },
        ],
      };

      // Apply category filter if specified
      if (categories.length > 0) {
        where.category = { [Op.in]: categories };
      }

      // Apply priority filter if specified
      if (priorities.length > 0) {
        where.priority = { [Op.in]: priorities };
      }

      const [updatedCount] = await Notification.update(
        {
          archived: true,
          archivedAt: new Date(),
        },
        { where }
      );

      logger.info(`Auto-archived ${updatedCount} old notifications`);
      return updatedCount;
    } catch (error) {
      logger.error("Error auto-archiving notifications:", error);
      throw error;
    }
  }

  /**
   * Permanently delete old archived notifications
   */
  async cleanupOldArchives(daysOld = 365) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysOld);

      const deletedCount = await Notification.destroy({
        where: {
          archived: true,
          archivedAt: { [Op.lt]: cutoff },
        },
      });

      logger.info(`Permanently deleted ${deletedCount} old archived notifications`);
      return deletedCount;
    } catch (error) {
      logger.error("Error cleaning up old archives:", error);
      throw error;
    }
  }

  /**
   * Search across all notifications (active and archived)
   */
  async searchNotifications(userId, searchQuery, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        includeArchived = true,
        category,
        priority,
        dateRange,
      } = options;

      const where = {
        userId: userId,
        deletedAt: null,
        [Op.or]: [
          { title: { [Op.iLike]: `%${searchQuery}%` } },
          { message: { [Op.iLike]: `%${searchQuery}%` } },
        ],
      };

      if (!includeArchived) {
        where.archived = false;
      }

      if (category) {
        where.category = category;
      }

      if (priority) {
        where.priority = priority;
      }

      if (dateRange) {
        where.createdAt = {
          [Op.between]: [dateRange.start, dateRange.end],
        };
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

      const total = await Notification.count({ where });

      return {
        notifications,
        total,
        hasMore: offset + notifications.length < total,
      };
    } catch (error) {
      logger.error("Error searching notifications:", error);
      throw error;
    }
  }
}

module.exports = new NotificationArchiveService();