import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Notification, NotificationPreferences, NotificationTemplate } from '../models';
import { NotificationService } from '../services/notification.service';
import { logger } from '@bakery/api/core';

export class NotificationController {
  private static notificationService = new NotificationService();

  /**
   * Get all notifications for authenticated user with filters
   * @route GET /api/notifications
   */
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId; // From auth middleware
      const {
        unreadOnly,
        category,
        priority,
        limit = '50',
        offset = '0',
      } = req.query;

      // Build where clause - exclude archived and deleted notifications by default
      const where: any = { 
        userId,
        archived: false,
        deletedAt: null,
      };
      
      if (unreadOnly === 'true') {
        where.read = false;
      }
      
      if (category) {
        where.category = category;
      }
      
      if (priority) {
        where.priority = priority;
      }

      const result = await NotificationController.notificationService.getNotifications(
        where,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
  }

  /**
   * Get single notification
   * @route GET /api/notifications/:id
   */
  static async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const notificationId = parseInt(req.params['id']);

      const notification = await NotificationController.notificationService.getNotificationById(
        notificationId,
        userId
      );

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      logger.error('Error fetching notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification'
      });
    }
  }

  /**
   * Create notification (admin only)
   * @route POST /api/notifications
   */
  static async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).userRole;
      
      // Check if user is admin
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const notificationData = req.body;
      const notification = await NotificationController.notificationService.createNotification(notificationData);

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created successfully'
      });
    } catch (error) {
      logger.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification'
      });
    }
  }

  /**
   * Create notification from template
   * @route POST /api/notifications/from-template
   */
  static async createFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const { templateKey, userId, variables, language = 'de' } = req.body;

      const notification = await NotificationController.notificationService.createFromTemplate(
        templateKey,
        userId,
        variables,
        language
      );

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created from template'
      });
    } catch (error) {
      logger.error('Error creating notification from template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification from template'
      });
    }
  }

  /**
   * Mark notification as read
   * @route PUT /api/notifications/:id/read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const notificationId = parseInt(req.params['id']);

      const notification = await NotificationController.notificationService.markAsRead(
        notificationId,
        userId
      );

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification'
      });
    }
  }

  /**
   * Mark all notifications as read
   * @route PUT /api/notifications/read-all
   */
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const count = await NotificationController.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `${count} notifications marked as read`
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notifications'
      });
    }
  }

  /**
   * Archive notification
   * @route PUT /api/notifications/:id/archive
   */
  static async archiveNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const notificationId = parseInt(req.params['id']);

      const notification = await NotificationController.notificationService.archiveNotification(
        notificationId,
        userId
      );

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
        message: 'Notification archived'
      });
    } catch (error) {
      logger.error('Error archiving notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to archive notification'
      });
    }
  }

  /**
   * Get archived notifications
   * @route GET /api/notifications/archived
   */
  static async getArchivedNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { limit = '50', offset = '0' } = req.query;

      const result = await NotificationController.notificationService.getArchivedNotifications(
        userId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching archived notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch archived notifications'
      });
    }
  }

  /**
   * Soft delete notification
   * @route DELETE /api/notifications/:id
   */
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const notificationId = parseInt(req.params['id']);

      const success = await NotificationController.notificationService.deleteNotification(
        notificationId,
        userId
      );

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification'
      });
    }
  }

  /**
   * Bulk create notifications (admin only)
   * @route POST /api/notifications/bulk
   */
  static async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Notifications array required'
        });
        return;
      }

      const created = await NotificationController.notificationService.bulkCreateNotifications(notifications);

      res.status(201).json({
        success: true,
        created: created.length,
        message: `Created ${created.length} notifications`
      });
    } catch (error) {
      logger.error('Error bulk creating notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notifications'
      });
    }
  }

  /**
   * Get user notification preferences
   * @route GET /api/notifications/preferences
   */
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const preferences = await NotificationController.notificationService.getOrCreatePreferences(userId);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Error fetching preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch preferences'
      });
    }
  }

  /**
   * Update user notification preferences
   * @route PUT /api/notifications/preferences
   */
  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const updates = req.body;

      const preferences = await NotificationController.notificationService.updatePreferences(
        userId,
        updates
      );

      res.json({
        success: true,
        data: preferences,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }
  }

  /**
   * Get notification templates (admin only)
   * @route GET /api/notifications/templates
   */
  static async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).userRole;
      
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const { category, isActive } = req.query;
      const templates = await NotificationController.notificationService.getTemplates(
        category as string,
        isActive === 'true'
      );

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch templates'
      });
    }
  }
}