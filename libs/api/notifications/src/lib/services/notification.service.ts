import { Op, WhereOptions } from 'sequelize';
import { Notification, NotificationPreferences, NotificationTemplate } from '../models';
import { logger } from '@bakery/api/core';
import { sendNotificationToUser, updateNotificationForUser, deleteNotificationForUser, broadcastNotification } from '../utils/notification.helper';

interface NotificationData {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: 'staff' | 'order' | 'system' | 'inventory' | 'general';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  userId?: number | null;
  metadata?: Record<string, any>;
}

interface NotificationStats {
  total: number;
  unread: number;
  byPriority: Record<string, number>;
}

export class NotificationService {
  /**
   * Get notifications with pagination and stats
   */
  async getNotifications(
    where: WhereOptions<Notification>,
    limit: number,
    offset: number
  ): Promise<{ notifications: Notification[]; stats: NotificationStats }> {
    try {
      const notifications = await Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      // Get counts for stats - exclude archived and deleted
      const stats = await this.getNotificationStats(where.userId as number);

      return {
        notifications,
        stats
      };
    } catch (error) {
      logger.error('Error in getNotifications:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID for a specific user
   */
  async getNotificationById(notificationId: number, userId: number): Promise<Notification | null> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId,
          archived: false,
          deletedAt: null,
        },
      });

      return notification;
    } catch (error) {
      logger.error('Error in getNotificationById:', error);
      throw error;
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<Notification> {
    try {
      const notification = await Notification.create({
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        category: data.category || 'general',
        priority: data.priority || 'medium',
        userId: data.userId || null,
        metadata: data.metadata || {},
        read: false,
        archived: false,
        archivedAt: null,
      });

      // Send WebSocket notification to the user
      if (notification.userId) {
        await sendNotificationToUser(notification.userId, notification);
      } else {
        // Broadcast to all if no specific user
        await broadcastNotification(notification);
      }

      logger.info(`Notification created: ${notification.id}`);
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notification from template
   */
  async createFromTemplate(
    templateKey: string,
    userId: number,
    variables: Record<string, any>,
    language: 'de' | 'en' = 'de'
  ): Promise<Notification> {
    try {
      const template = await NotificationTemplate.findOne({
        where: {
          key: templateKey,
          isActive: true
        }
      });

      if (!template) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      // Validate required variables
      const missingVars = template.validateVariables(variables);
      if (missingVars.length > 0) {
        throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
      }

      // Create notification from template
      const notificationData = template.createNotification(userId, variables, language);
      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Error creating notification from template:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<Notification | null> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId,
          archived: false,
          deletedAt: null,
        },
      });

      if (!notification) {
        return null;
      }

      await notification.markAsRead();

      // Send WebSocket update
      await updateNotificationForUser(userId, notificationId, { read: true });

      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      const [count] = await Notification.update(
        { read: true },
        {
          where: {
            userId,
            read: false,
            archived: false,
            deletedAt: null,
          },
        }
      );

      logger.info(`Marked ${count} notifications as read for user ${userId}`);
      return count;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Archive a notification
   */
  async archiveNotification(notificationId: number, userId: number): Promise<Notification | null> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId,
          archived: false,
          deletedAt: null,
        },
      });

      if (!notification) {
        return null;
      }

      await notification.archive();

      // Send WebSocket update
      await updateNotificationForUser(userId, notificationId, { archived: true });

      return notification;
    } catch (error) {
      logger.error('Error archiving notification:', error);
      throw error;
    }
  }

  /**
   * Get archived notifications
   */
  async getArchivedNotifications(
    userId: number,
    limit: number,
    offset: number
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const { count, rows } = await Notification.findAndCountAll({
        where: {
          userId,
          archived: true,
          deletedAt: null,
        },
        order: [['archivedAt', 'DESC']],
        limit,
        offset,
      });

      return {
        notifications: rows,
        total: count
      };
    } catch (error) {
      logger.error('Error fetching archived notifications:', error);
      throw error;
    }
  }

  /**
   * Soft delete a notification
   */
  async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId,
          archived: false,
          deletedAt: null,
        },
      });

      if (!notification) {
        return false;
      }

      // Soft delete by setting deletedAt timestamp
      await notification.update({ deletedAt: new Date() });
      
      // Send WebSocket delete event
      await deleteNotificationForUser(userId, notificationId);
      
      return true;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Bulk create notifications
   */
  async bulkCreateNotifications(notificationsData: NotificationData[]): Promise<Notification[]> {
    try {
      // Add default values to each notification
      const notificationsWithDefaults = notificationsData.map((n) => ({
        ...n,
        type: n.type || 'info',
        category: n.category || 'general',
        priority: n.priority || 'medium',
        read: false,
        archived: false,
        metadata: n.metadata || {},
      }));

      const created = await Notification.bulkCreate(notificationsWithDefaults as any);
      logger.info(`Created ${created.length} notifications in bulk`);

      // Send WebSocket notifications for each created notification
      for (const notification of created) {
        if (notification.userId) {
          await sendNotificationToUser(notification.userId, notification);
        } else {
          // Broadcast to all if no specific user
          await broadcastNotification(notification);
        }
      }

      return created;
    } catch (error) {
      logger.error('Error bulk creating notifications:', error);
      throw error;
    }
  }

  /**
   * Get or create user preferences
   */
  async getOrCreatePreferences(userId: number): Promise<NotificationPreferences> {
    try {
      let preferences = await NotificationPreferences.findOne({
        where: { userId }
      });

      if (!preferences) {
        preferences = await NotificationPreferences.create({
          userId,
          emailEnabled: true,
          browserEnabled: true,
          soundEnabled: true,
          categoryPreferences: {
            staff: true,
            order: true,
            system: true,
            inventory: true,
            general: true,
          },
          priorityThreshold: 'low',
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '07:00',
          },
        });
      }

      return preferences;
    } catch (error) {
      logger.error('Error getting/creating preferences:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: number,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getOrCreatePreferences(userId);
      
      await preferences.update(updates);
      
      return preferences;
    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification templates
   */
  async getTemplates(category?: string, isActive?: boolean): Promise<NotificationTemplate[]> {
    try {
      const where: any = {};
      
      if (category) {
        where.category = category;
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const templates = await NotificationTemplate.findAll({
        where,
        order: [['category', 'ASC'], ['key', 'ASC']]
      });

      return templates;
    } catch (error) {
      logger.error('Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Helper: Get notification statistics
   */
  private async getNotificationStats(userId: number): Promise<NotificationStats> {
    try {
      // Get total and unread count
      const stats = await Notification.findOne({
        where: { 
          userId,
          archived: false,
          deletedAt: null,
        },
        attributes: [
          [Notification.sequelize!.fn('COUNT', Notification.sequelize!.col('id')), 'total'],
          [
            Notification.sequelize!.fn(
              'SUM',
              Notification.sequelize!.literal('CASE WHEN read = false THEN 1 ELSE 0 END')
            ),
            'unread',
          ],
        ],
        raw: true,
      }) as any;

      // Get counts by priority
      const priorityStats = await Notification.findAll({
        where: { 
          userId,
          archived: false,
          deletedAt: null,
        },
        attributes: [
          'priority',
          [Notification.sequelize!.fn('COUNT', Notification.sequelize!.col('id')), 'count'],
        ],
        group: ['priority'],
        raw: true,
      }) as any[];

      const byPriority = priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        total: parseInt(stats?.total || 0),
        unread: parseInt(stats?.unread || 0),
        byPriority,
      };
    } catch (error) {
      logger.error('Error calculating notification stats:', error);
      return {
        total: 0,
        unread: 0,
        byPriority: {}
      };
    }
  }
}