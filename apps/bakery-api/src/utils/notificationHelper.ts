import { Notification } from '../models'
import { logger } from './logger'

export interface NotificationData {
  userId?: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  category: string
  priority: 'low' | 'medium' | 'high'
  templateKey?: string
  templateVars?: Record<string, any>
  metadata?: any
}

class NotificationHelper {
  async sendNotification(data: NotificationData): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Check user notification preferences
      // 2. Apply template if templateKey is provided
      // 3. Send via appropriate channels (email, push, in-app)
      // 4. Store in database

      // For now, just create a notification record
      if (data.userId) {
        await Notification.create({
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          category: data.category,
          priority: data.priority,
          metadata: {
            templateKey: data.templateKey,
            templateVars: data.templateVars,
            ...data.metadata
          },
          isRead: false,
          readAt: null
        })
      }

      logger.info('Notification sent', {
        userId: data.userId,
        title: data.title,
        category: data.category
      })
    } catch (error) {
      logger.error('Failed to send notification', error)
      // Don't throw - notifications shouldn't break the main flow
    }
  }

  async sendBulkNotifications(notifications: NotificationData[]): Promise<void> {
    for (const notification of notifications) {
      await this.sendNotification(notification)
    }
  }

  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          id: notificationId,
          userId
        }
      }
    )
  }

  async markAllAsRead(userId: number): Promise<void> {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          userId,
          isRead: false
        }
      }
    )
  }

  async getUnreadCount(userId: number): Promise<number> {
    return await Notification.count({
      where: {
        userId,
        isRead: false
      }
    })
  }

  async getNotifications(
    userId: number,
    options: {
      limit?: number
      offset?: number
      category?: string
      isRead?: boolean
    } = {}
  ): Promise<Notification[]> {
    const where: any = { userId }
    
    if (options.category) {
      where.category = options.category
    }
    
    if (typeof options.isRead === 'boolean') {
      where.isRead = options.isRead
    }

    return await Notification.findAll({
      where,
      limit: options.limit || 50,
      offset: options.offset || 0,
      order: [['createdAt', 'DESC']]
    })
  }
}

export default new NotificationHelper()