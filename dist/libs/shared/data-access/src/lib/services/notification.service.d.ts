/**
 * Notification service for the bakery management system
 */
import {
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilters,
  NotificationPreferences,
  NotificationStats,
  BulkNotificationOperation,
  ApiResponse,
} from '@bakery/shared/types'
export declare class NotificationService {
  private readonly basePath
  /**
   * Get all notifications for the current user
   */
  getNotifications(
    filters?: NotificationFilters
  ): Promise<ApiResponse<Notification[]>>
  /**
   * Get a specific notification by ID
   */
  getNotification(id: string): Promise<ApiResponse<Notification>>
  /**
   * Create a new notification
   */
  createNotification(
    data: CreateNotificationInput
  ): Promise<ApiResponse<Notification>>
  /**
   * Update a notification
   */
  updateNotification(
    id: string,
    data: UpdateNotificationInput
  ): Promise<ApiResponse<Notification>>
  /**
   * Delete a notification
   */
  deleteNotification(id: string): Promise<ApiResponse<void>>
  /**
   * Mark notification as read
   */
  markAsRead(id: string): Promise<ApiResponse<Notification>>
  /**
   * Mark notification as unread
   */
  markAsUnread(id: string): Promise<ApiResponse<Notification>>
  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Promise<ApiResponse<void>>
  /**
   * Get notification statistics
   */
  getStats(): Promise<ApiResponse<NotificationStats>>
  /**
   * Get unread count
   */
  getUnreadCount(): Promise<
    ApiResponse<{
      count: number
    }>
  >
  /**
   * Bulk operations on notifications
   */
  bulkOperation(
    operation: BulkNotificationOperation
  ): Promise<ApiResponse<void>>
  /**
   * Get user notification preferences
   */
  getPreferences(): Promise<ApiResponse<NotificationPreferences>>
  /**
   * Update user notification preferences
   */
  updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<ApiResponse<NotificationPreferences>>
  /**
   * Send test notification
   */
  sendTest(channel: string): Promise<ApiResponse<void>>
  /**
   * Subscribe to real-time notifications (WebSocket)
   */
  subscribeToRealTime(
    callback: (notification: Notification) => void
  ): () => void
  /**
   * Get notification templates (admin only)
   */
  getTemplates(): Promise<ApiResponse<any[]>>
  /**
   * Send broadcast notification (admin only)
   */
  sendBroadcast(data: {
    title: string
    message: string
    category: string
    priority: string
    channels: string[]
    targetUsers?: string[]
  }): Promise<ApiResponse<void>>
}
export declare const notificationService: NotificationService
