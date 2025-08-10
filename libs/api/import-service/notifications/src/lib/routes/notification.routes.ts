import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '@bakery/api/core';
import { validationMiddleware } from '@bakery/api/core';
import { 
  notificationCreationRules,
  templateNotificationRules,
  bulkNotificationRules,
  notificationIdRules,
  notificationQueryRules,
  preferencesUpdateRules,
  templateQueryRules
} from '../validators/notification.validator';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

/**
 * Main Notification Routes
 */

// Get all notifications for authenticated user with filters
router.get(
  '/',
  notificationQueryRules,
  validationMiddleware,
  NotificationController.getNotifications
);

// Get archived notifications
router.get(
  '/archived',
  notificationQueryRules,
  validationMiddleware,
  NotificationController.getArchivedNotifications
);

// Get single notification
router.get(
  '/:id',
  notificationIdRules,
  validationMiddleware,
  NotificationController.getNotification
);

// Create notification (admin only)
router.post(
  '/',
  notificationCreationRules,
  validationMiddleware,
  NotificationController.createNotification
);

// Create notification from template (admin only)
router.post(
  '/from-template',
  templateNotificationRules,
  validationMiddleware,
  NotificationController.createFromTemplate
);

// Bulk create notifications (admin only)
router.post(
  '/bulk',
  bulkNotificationRules,
  validationMiddleware,
  NotificationController.bulkCreate
);

// Mark notification as read
router.put(
  '/:id/read',
  notificationIdRules,
  validationMiddleware,
  NotificationController.markAsRead
);

// Mark all notifications as read
router.put(
  '/read-all',
  NotificationController.markAllAsRead
);

// Archive notification
router.put(
  '/:id/archive',
  notificationIdRules,
  validationMiddleware,
  NotificationController.archiveNotification
);

// Soft delete notification
router.delete(
  '/:id',
  notificationIdRules,
  validationMiddleware,
  NotificationController.deleteNotification
);

/**
 * Preference Routes
 */

// Get user notification preferences
router.get(
  '/preferences',
  NotificationController.getPreferences
);

// Update user notification preferences
router.put(
  '/preferences',
  preferencesUpdateRules,
  validationMiddleware,
  NotificationController.updatePreferences
);

/**
 * Template Routes (Admin Only)
 */

// Get notification templates
router.get(
  '/templates',
  templateQueryRules,
  validationMiddleware,
  NotificationController.getTemplates
);

export default router;