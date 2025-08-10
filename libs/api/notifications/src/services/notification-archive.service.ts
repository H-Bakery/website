/**
 * Notification Archive Service - Individual notification archival operations
 * Bakery Management System
 */

import { Op } from 'sequelize';
import {
  ArchivedNotification,
  ArchiveSearchOptions,
  ArchiveSearchResult,
  ArchiveStats,
  AutoArchiveRules,
} from '../models/notification-archival.model';

export interface NotificationArchiveServiceDeps {
  Notification: any; // Sequelize model
  User?: any; // Optional User model for includes
  logger: any;
}

export class NotificationArchiveService {
  private Notification: any;
  private User: any;
  private logger: any;

  constructor(deps: NotificationArchiveServiceDeps) {
    this.Notification = deps.Notification;
    this.User = deps.User;
    this.logger = deps.logger;
  }

  /**
   * Archive a single notification
   */
  async archiveNotification(notificationId: number, userId: number): Promise<ArchivedNotification | null> {
    try {
      const notification = await this.Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          archived: false,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error('Notification not found or already archived');
      }

      await notification.update({
        archived: true,
        archivedAt: new Date(),
      });

      this.logger.info(`Notification ${notificationId} archived by user ${userId}`);
      return this.mapToArchivedNotification(notification);
    } catch (error) {
      this.logger.error('Error archiving notification:', error);
      throw error;
    }
  }

  /**
   * Archive multiple notifications
   */
  async archiveBulk(notificationIds: number[], userId: number): Promise<number> {
    try {
      const [updatedCount] = await this.Notification.update(
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

      this.logger.info(`${updatedCount} notifications archived by user ${userId}`);
      return updatedCount;
    } catch (error) {
      this.logger.error('Error bulk archiving notifications:', error);
      throw error;
    }
  }

  /**
   * Restore a notification from archive
   */
  async restoreNotification(notificationId: number, userId: number): Promise<ArchivedNotification | null> {
    try {
      const notification = await this.Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          archived: true,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error('Archived notification not found');
      }

      await notification.update({
        archived: false,
        archivedAt: null,
      });

      this.logger.info(`Notification ${notificationId} restored by user ${userId}`);
      return this.mapToArchivedNotification(notification);
    } catch (error) {
      this.logger.error('Error restoring notification:', error);
      throw error;
    }
  }

  /**
   * Restore multiple notifications from archive
   */
  async restoreBulk(notificationIds: number[], userId: number): Promise<number> {
    try {
      const [updatedCount] = await this.Notification.update(
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

      this.logger.info(`${updatedCount} notifications restored by user ${userId}`);
      return updatedCount;
    } catch (error) {
      this.logger.error('Error bulk restoring notifications:', error);
      throw error;
    }
  }

  /**
   * Soft delete a notification
   */
  async softDeleteNotification(notificationId: number, userId: number): Promise<ArchivedNotification | null> {
    try {
      const notification = await this.Notification.findOne({
        where: {
          id: notificationId,
          userId: userId,
          deletedAt: null,
        },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.update({
        deletedAt: new Date(),
      });

      this.logger.info(
        `Notification ${notificationId} soft deleted by user ${userId}`
      );
      return this.mapToArchivedNotification(notification);
    } catch (error) {
      this.logger.error('Error soft deleting notification:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a notification
   */
  async permanentDeleteNotification(notificationId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.Notification.destroy({
        where: {
          id: notificationId,
          userId: userId,
        },
      });

      if (result === 0) {
        throw new Error('Notification not found');
      }

      this.logger.info(
        `Notification ${notificationId} permanently deleted by user ${userId}`
      );
      return true;
    } catch (error) {
      this.logger.error('Error permanently deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get archived notifications for a user
   */
  async getArchivedNotifications(
    userId: number,
    options: ArchiveSearchOptions = {}
  ): Promise<ArchiveSearchResult> {
    try {
      const {
        limit = 50,
        offset = 0,
        category,
        priority,
        dateRange,
        searchQuery,
      } = options;

      const where: any = {
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

      const includeOptions = this.User
        ? [{
            model: this.User,
            attributes: ['id', 'username'],
          }]
        : [];

      const notifications = await this.Notification.findAll({
        where,
        order: [['archivedAt', 'DESC']],
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        include: includeOptions,
      });

      // Get total count for pagination
      const total = await this.Notification.count({ where });

      return {
        notifications: notifications.map((n: any) => this.mapToArchivedNotification(n)),
        total,
        hasMore: offset + notifications.length < total,
      };
    } catch (error) {
      this.logger.error('Error getting archived notifications:', error);
      throw error;
    }
  }

  /**
   * Get archive statistics for a user
   */
  async getArchiveStats(userId: number): Promise<ArchiveStats> {
    try {
      const [stats] = await this.Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          [
            this.Notification.sequelize.fn(
              'COUNT',
              this.Notification.sequelize.col('id')
            ),
            'total',
          ],
          [
            this.Notification.sequelize.fn(
              'COUNT',
              this.Notification.sequelize.literal('CASE WHEN read = true THEN 1 END')
            ),
            'read',
          ],
          [
            this.Notification.sequelize.fn(
              'COUNT',
              this.Notification.sequelize.literal(
                'CASE WHEN read = false THEN 1 END'
              )
            ),
            'unread',
          ],
        ],
        raw: true,
      });

      // Get category distribution
      const categoryStats = await this.Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          'category',
          [
            this.Notification.sequelize.fn(
              'COUNT',
              this.Notification.sequelize.col('id')
            ),
            'count',
          ],
        ],
        group: ['category'],
        raw: true,
      });

      // Get priority distribution
      const priorityStats = await this.Notification.findAll({
        where: {
          userId: userId,
          archived: true,
          deletedAt: null,
        },
        attributes: [
          'priority',
          [
            this.Notification.sequelize.fn(
              'COUNT',
              this.Notification.sequelize.col('id')
            ),
            'count',
          ],
        ],
        group: ['priority'],
        raw: true,
      });

      const byCategory = categoryStats.reduce((acc: any, stat: any) => {
        acc[stat.category] = parseInt(stat.count);
        return acc;
      }, {});

      const byPriority = priorityStats.reduce((acc: any, stat: any) => {
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
      this.logger.error('Error getting archive stats:', error);
      throw error;
    }
  }

  /**
   * Auto-archive old notifications based on rules
   */
  async autoArchiveOldNotifications(rules: AutoArchiveRules = {}): Promise<number> {
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

      let where: any = {
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

      const [updatedCount] = await this.Notification.update(
        {
          archived: true,
          archivedAt: new Date(),
        },
        { where }
      );

      this.logger.info(`Auto-archived ${updatedCount} old notifications`);
      return updatedCount;
    } catch (error) {
      this.logger.error('Error auto-archiving notifications:', error);
      throw error;
    }
  }

  /**
   * Permanently delete old archived notifications
   */
  async cleanupOldArchives(daysOld: number = 365): Promise<number> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysOld);

      const deletedCount = await this.Notification.destroy({
        where: {
          archived: true,
          archivedAt: { [Op.lt]: cutoff },
        },
      });

      this.logger.info(
        `Permanently deleted ${deletedCount} old archived notifications`
      );
      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up old archives:', error);
      throw error;
    }
  }

  /**
   * Search across all notifications (active and archived)
   */
  async searchNotifications(
    userId: number,
    searchQuery: string,
    options: ArchiveSearchOptions = {}
  ): Promise<ArchiveSearchResult> {
    try {
      const {
        limit = 50,
        offset = 0,
        includeArchived = true,
        category,
        priority,
        dateRange,
      } = options;

      const where: any = {
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

      const includeOptions = this.User
        ? [{
            model: this.User,
            attributes: ['id', 'username'],
          }]
        : [];

      const notifications = await this.Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        include: includeOptions,
      });

      const total = await this.Notification.count({ where });

      return {
        notifications: notifications.map((n: any) => this.mapToArchivedNotification(n)),
        total,
        hasMore: offset + notifications.length < total,
      };
    } catch (error) {
      this.logger.error('Error searching notifications:', error);
      throw error;
    }
  }

  /**
   * Map database notification to ArchivedNotification type
   */
  private mapToArchivedNotification(dbNotification: any): ArchivedNotification {
    return {
      id: dbNotification.id,
      userId: dbNotification.userId,
      title: dbNotification.title,
      message: dbNotification.message,
      type: dbNotification.type,
      category: dbNotification.category,
      priority: dbNotification.priority,
      read: dbNotification.read || false,
      archived: dbNotification.archived || false,
      archivedAt: dbNotification.archivedAt,
      deletedAt: dbNotification.deletedAt,
      createdAt: dbNotification.createdAt,
      updatedAt: dbNotification.updatedAt,
      metadata: dbNotification.metadata || {},
    };
  }
}