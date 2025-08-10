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
import { apiClient } from '../api-client'

export class NotificationService {
  private readonly basePath = '/api/notifications'

  /**
   * Get all notifications for the current user
   */
  async getNotifications(
    filters?: NotificationFilters
  ): Promise<ApiResponse<Notification[]>> {
    const params = new URLSearchParams()

    if (filters?.categories?.length) {
      params.append('categories', filters.categories.join(','))
    }
    if (filters?.priorities?.length) {
      params.append('priorities', filters.priorities.join(','))
    }
    if (filters?.channels?.length) {
      params.append('channels', filters.channels.join(','))
    }
    if (filters?.types?.length) {
      params.append('types', filters.types.join(','))
    }
    if (typeof filters?.read === 'boolean') {
      params.append('read', String(filters.read))
    }
    if (filters?.dateRange) {
      params.append('startDate', filters.dateRange.start.toISOString())
      params.append('endDate', filters.dateRange.end.toISOString())
    }

    const query = params.toString()
    const endpoint = query ? `${this.basePath}?${query}` : this.basePath

    return apiClient.get<Notification[]>(endpoint)
  }

  /**
   * Get a specific notification by ID
   */
  async getNotification(id: string): Promise<ApiResponse<Notification>> {
    return apiClient.get<Notification>(`${this.basePath}/${id}`)
  }

  /**
   * Create a new notification
   */
  async createNotification(
    data: CreateNotificationInput
  ): Promise<ApiResponse<Notification>> {
    return apiClient.post<Notification>(this.basePath, data)
  }

  /**
   * Update a notification
   */
  async updateNotification(
    id: string,
    data: UpdateNotificationInput
  ): Promise<ApiResponse<Notification>> {
    return apiClient.put<Notification>(`${this.basePath}/${id}`, data)
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${this.basePath}/${id}`)
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<ApiResponse<Notification>> {
    return apiClient.patch<Notification>(`${this.basePath}/${id}/read`, {})
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(id: string): Promise<ApiResponse<Notification>> {
    return apiClient.patch<Notification>(`${this.basePath}/${id}/unread`, {})
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.basePath}/mark-all-read`, {})
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<ApiResponse<NotificationStats>> {
    return apiClient.get<NotificationStats>(`${this.basePath}/stats`)
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get<{ count: number }>(`${this.basePath}/unread-count`)
  }

  /**
   * Bulk operations on notifications
   */
  async bulkOperation(
    operation: BulkNotificationOperation
  ): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.basePath}/bulk`, operation)
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    return apiClient.get<NotificationPreferences>(
      `${this.basePath}/preferences`
    )
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<ApiResponse<NotificationPreferences>> {
    return apiClient.put<NotificationPreferences>(
      `${this.basePath}/preferences`,
      preferences
    )
  }

  /**
   * Send test notification
   */
  async sendTest(channel: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.basePath}/test`, { channel })
  }

  /**
   * Subscribe to real-time notifications (WebSocket)
   */
  subscribeToRealTime(
    callback: (notification: Notification) => void
  ): () => void {
    // This would typically set up a WebSocket connection
    // For now, return a no-op cleanup function
    console.log('Real-time notifications subscription not implemented yet')
    return () => {
      console.log('Unsubscribing from real-time notifications')
    }
  }

  /**
   * Get notification templates (admin only)
   */
  async getTemplates(): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`${this.basePath}/templates`)
  }

  /**
   * Send broadcast notification (admin only)
   */
  async sendBroadcast(data: {
    title: string
    message: string
    category: string
    priority: string
    channels: string[]
    targetUsers?: string[]
  }): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`${this.basePath}/broadcast`, data)
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
