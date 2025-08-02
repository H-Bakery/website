import { default as React } from 'react'
import {
  Notification,
  NotificationPreferences,
  NotificationChannel,
  NotificationCategory,
  NotificationPriority,
} from '@bakery/shared/types'
/**
 * Notification filters
 */
export interface NotificationFilters {
  /** Show only unread notifications */
  unreadOnly?: boolean
  /** Filter by categories */
  categories?: NotificationCategory[]
  /** Filter by priorities */
  priorities?: NotificationPriority[]
  /** Filter by channels */
  channels?: NotificationChannel[]
  /** Date range filter */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Search query */
  search?: string
}
/**
 * Notification statistics
 */
export interface NotificationStats {
  /** Total number of notifications */
  total: number
  /** Number of unread notifications */
  unread: number
  /** Count by category */
  byCategory: Record<NotificationCategory, number>
  /** Count by priority */
  byPriority: Record<NotificationPriority, number>
  /** Count by channel */
  byChannel: Record<NotificationChannel, number>
}
/**
 * Notification context type
 */
export interface NotificationContextType {
  /** All notifications */
  notifications: Notification[]
  /** Filtered notifications based on current filters */
  filteredNotifications: Notification[]
  /** Number of unread notifications */
  unreadCount: number
  /** Notification statistics */
  stats: NotificationStats
  /** Current filters */
  filters: NotificationFilters
  /** User preferences */
  preferences: NotificationPreferences | null
  /** Whether notifications are loading */
  isLoading: boolean
  /** Whether real-time updates are connected */
  isConnected: boolean
  /** Apply filters */
  setFilters: (filters: NotificationFilters) => void
  /** Mark notification as read */
  markAsRead: (id: string) => Promise<void>
  /** Mark all as read */
  markAllAsRead: () => Promise<void>
  /** Delete notification */
  deleteNotification: (id: string) => Promise<void>
  /** Delete all notifications */
  clearAll: () => Promise<void>
  /** Refresh notifications from server */
  refresh: () => Promise<void>
  /** Update preferences */
  updatePreferences: (
    preferences: Partial<NotificationPreferences>
  ) => Promise<void>
  /** Reset preferences to defaults */
  resetPreferences: () => Promise<void>
  /** Send test notification */
  sendTest: (channel: NotificationChannel) => Promise<void>
  /** Subscribe to push notifications */
  subscribeToPush: () => Promise<void>
  /** Unsubscribe from push notifications */
  unsubscribeFromPush: () => Promise<void>
}
/**
 * Notification provider props
 */
export interface NotificationProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Whether to enable real-time updates via WebSocket */
  enableRealTime?: boolean
  /** Polling interval in ms (if real-time is disabled) */
  pollingInterval?: number
  /** Whether to request notification permission on mount */
  requestPermissionOnMount?: boolean
  /** Maximum notifications to keep in memory */
  maxNotifications?: number
  /** Auto-mark as read delay in ms */
  autoMarkAsReadDelay?: number
  /** Notification sound URL */
  soundUrl?: string
}
/**
 * Enhanced notification provider component
 */
export declare const NotificationProvider: React.FC<NotificationProviderProps>
/**
 * Hook to use notification context
 * @throws {Error} If used outside of NotificationProvider
 */
export declare const useNotifications: () => NotificationContextType
/**
 * Hook to get unread notification count
 */
export declare const useUnreadCount: () => number
/**
 * Hook to get notification preferences
 */
export declare const useNotificationPreferences: () => NotificationPreferences | null
