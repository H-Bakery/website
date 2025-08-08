'use client'

/**
 * @fileoverview Enhanced notification context with real-time updates, filtering, and preferences
 * @module @bakery/shared/contexts/notification
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { 
  Notification as NotificationType,
  NotificationPreferences,
  NotificationChannel,
  NotificationCategory,
  NotificationPriority 
} from '@bakery/shared/types'
import { notificationService } from '@bakery/shared/data-access'

// Use a local type alias that handles date serialization
type Notification = Omit<NotificationType, 'createdAt' | 'expiresAt'> & {
  createdAt: string | Date
  expiresAt?: string | Date
}

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
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>
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
 * Notification context
 */
const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

/**
 * Calculate notification statistics
 */
const calculateStats = (notifications: Notification[]): NotificationStats => {
  const stats: NotificationStats = {
    total: notifications.length,
    unread: 0,
    byCategory: {} as Record<NotificationCategory, number>,
    byPriority: {} as Record<NotificationPriority, number>,
    byChannel: {} as Record<NotificationChannel, number>,
  }

  // Initialize counters
  const categories: NotificationCategory[] = ['order', 'inventory', 'staff', 'system', 'customer']
  const priorities: NotificationPriority[] = ['low', 'medium', 'high', 'urgent']
  const channels: NotificationChannel[] = ['inApp', 'email', 'sms', 'push']

  categories.forEach(cat => { stats.byCategory[cat] = 0 })
  priorities.forEach(pri => { stats.byPriority[pri] = 0 })
  channels.forEach(cha => { stats.byChannel[cha] = 0 })

  // Count notifications
  notifications.forEach(notification => {
    if (!notification.read) stats.unread++
    stats.byCategory[notification.category]++
    stats.byPriority[notification.priority]++
    stats.byChannel[notification.channel]++
  })

  return stats
}

/**
 * Filter notifications based on filters
 */
const filterNotifications = (
  notifications: Notification[],
  filters: NotificationFilters
): Notification[] => {
  return notifications.filter(notification => {
    // Unread filter
    if (filters.unreadOnly && notification.read) return false

    // Category filter
    if (filters.categories?.length && !filters.categories.includes(notification.category)) {
      return false
    }

    // Priority filter
    if (filters.priorities?.length && !filters.priorities.includes(notification.priority)) {
      return false
    }

    // Channel filter
    if (filters.channels?.length) {
      const hasChannel = filters.channels!.includes(notification.channel)
      if (!hasChannel) return false
    }

    // Date range filter
    if (filters.dateRange) {
      const createdAt = new Date(notification.createdAt)
      if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
        return false
      }
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = notification.title.toLowerCase().includes(searchLower)
      const matchesMessage = notification.message.toLowerCase().includes(searchLower)
      if (!matchesTitle && !matchesMessage) return false
    }

    return true
  })
}

/**
 * Enhanced notification provider component
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  enableRealTime = true,
  pollingInterval = 30000, // 30 seconds
  requestPermissionOnMount = true,
  maxNotifications = 100,
  autoMarkAsReadDelay = 5000, // 5 seconds
  soundUrl = '/notification-sound.mp3',
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [filters, setFilters] = useState<NotificationFilters>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoMarkTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Calculate filtered notifications and stats
  const filteredNotifications = useMemo(
    () => filterNotifications(notifications, filters),
    [notifications, filters]
  )

  const stats = useMemo(
    () => calculateStats(notifications),
    [notifications]
  )

  const unreadCount = stats.unread

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined' && soundUrl) {
      audioRef.current = new Audio(soundUrl)
      audioRef.current.preload = 'auto'
    }
  }, [soundUrl])

  // Request notification permission
  useEffect(() => {
    if (requestPermissionOnMount && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [requestPermissionOnMount])

  // Load initial data
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const [notifs, prefs] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getPreferences(),
      ])
      if (notifs.success && notifs.data) {
        setNotifications(notifs.data)
      }
      if (prefs.success && prefs.data) {
        setPreferences(prefs.data)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [maxNotifications])

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    if (!preferences?.channels?.inApp?.enabled) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    // Check preferences
    const inAppSettings = preferences.channels.inApp
    const categoryEnabled = inAppSettings?.categories?.includes(notification.category) !== false
    if (!categoryEnabled) return

    // Check priority threshold
    const priorityOrder: Record<NotificationPriority, number> = {
      low: 0,
      medium: 1,
      high: 2,
      urgent: 3,
    }
    const threshold = priorityOrder[inAppSettings?.minPriority] || 0
    const priority = priorityOrder[notification.priority] || 0
    if (priority < threshold) return

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date()
      const currentHour = now.getHours()
      const startHour = parseInt(preferences.quietHours.start.split(':')[0])
      const endHour = parseInt(preferences.quietHours.end.split(':')[0])
      
      const inQuietHours = startHour > endHour
        ? currentHour >= startHour || currentHour < endHour
        : currentHour >= startHour && currentHour < endHour
      
      if (inQuietHours) return
    }

    // Show notification
    new Notification(notification.title, {
      body: notification.message,
      icon: '/logo192.png',
      tag: notification.id,
      data: notification,
    })

    // Play sound
    if (preferences.sound?.enabled && audioRef.current) {
      audioRef.current.play().catch(console.error)
    }
  }, [preferences])

  // Setup WebSocket connection
  useEffect(() => {
    if (!enableRealTime || typeof window === 'undefined') return

    const connectWebSocket = () => {
      try {
        // TODO: Replace with actual WebSocket URL
        const ws = new WebSocket(`ws://localhost:5000/notifications`)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('Notification WebSocket connected')
          setIsConnected(true)
        }

        ws.onclose = () => {
          console.log('Notification WebSocket disconnected')
          setIsConnected(false)
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000)
        }

        ws.onerror = (error) => {
          console.error('Notification WebSocket error:', error)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'notification') {
              const notification = data.payload as Notification
              
              // Add to notifications
              setNotifications(prev => {
                const filtered = prev.filter(n => n.id !== notification.id)
                const updated = [notification, ...filtered]
                // Keep only max notifications
                return updated.slice(0, maxNotifications)
              })

              // Show browser notification
              showBrowserNotification(notification)

              // Auto mark as read
              if (autoMarkAsReadDelay > 0 && !notification.read) {
                const timeout = setTimeout(() => {
                  markAsRead(notification.id)
                }, autoMarkAsReadDelay)
                autoMarkTimeoutsRef.current.set(notification.id, timeout)
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        return ws
      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
        return null
      }
    }

    const ws = connectWebSocket()

    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [enableRealTime, maxNotifications, showBrowserNotification, autoMarkAsReadDelay])

  // Setup polling fallback
  useEffect(() => {
    if (enableRealTime || pollingInterval <= 0) return

    const poll = () => {
      loadNotifications()
    }

    pollingRef.current = setInterval(poll, pollingInterval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [enableRealTime, pollingInterval, loadNotifications])

  // Initial load
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Cleanup auto-mark timeouts
  useEffect(() => {
    return () => {
      autoMarkTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      autoMarkTimeoutsRef.current.clear()
    }
  }, [])

  // Mark as read handler
  const markAsRead = useCallback(async (id: string) => {
    try {
      // Cancel auto-mark timeout if exists
      const timeout = autoMarkTimeoutsRef.current.get(id)
      if (timeout) {
        clearTimeout(timeout)
        autoMarkTimeoutsRef.current.delete(id)
      }

      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )

      // Send to server
      await notificationService.deleteNotification(id)
    } catch (error) {
      console.error('Failed to mark as read:', error)
      // Revert on error
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: false } : n)
      )
    }
  }, [])

  // Mark all as read handler
  const markAllAsRead = useCallback(async () => {
    try {
      // Cancel all auto-mark timeouts
      autoMarkTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      autoMarkTimeoutsRef.current.clear()

      // Optimistic update
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      )

      // Send to server
      // TODO: Implement bulk mark as read in service
      await Promise.all(
        notifications
          .filter(n => !n.read)
          .map(n => notificationService.deleteNotification(n.id))
      )
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      // Reload on error
      loadNotifications()
    }
  }, [notifications, loadNotifications])

  // Delete notification handler
  const deleteNotification = useCallback(async (id: string) => {
    try {
      // Cancel auto-mark timeout if exists
      const timeout = autoMarkTimeoutsRef.current.get(id)
      if (timeout) {
        clearTimeout(timeout)
        autoMarkTimeoutsRef.current.delete(id)
      }

      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id))

      // Send to server
      await notificationService.deleteNotification(id)
    } catch (error) {
      console.error('Failed to delete notification:', error)
      // Reload on error
      loadNotifications()
    }
  }, [loadNotifications])

  // Clear all handler
  const clearAll = useCallback(async () => {
    try {
      // Cancel all auto-mark timeouts
      autoMarkTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      autoMarkTimeoutsRef.current.clear()

      // Optimistic update
      setNotifications([])

      // Send to server
      // TODO: Implement bulk delete in service
      await Promise.all(
        notifications.map(n => notificationService.deleteNotification(n.id))
      )
    } catch (error) {
      console.error('Failed to clear all notifications:', error)
      // Reload on error
      loadNotifications()
    }
  }, [notifications, loadNotifications])

  // Update preferences handler
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    try {
      const updated = await notificationService.updatePreferences(prefs)
      if (updated.success && updated.data) {
        setPreferences(updated.data)
      }
    } catch (error) {
      console.error('Failed to update preferences:', error)
      throw error
    }
  }, [])

  // Reset preferences handler
  const resetPreferences = useCallback(async () => {
    try {
      // Reset to default preferences
      const defaultPrefs: Partial<NotificationPreferences> = {
        userId: 'default',
        channels: {
          inApp: { enabled: true, categories: [], minPriority: 'low' },
          email: { enabled: true, categories: [], minPriority: 'medium' },
          sms: { enabled: false, categories: [], minPriority: 'high' },
          push: { enabled: true, categories: [], minPriority: 'medium' }
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC',
        },
        sound: {
          enabled: true,
          volume: 50
        },
        digest: {
          enabled: false,
          frequency: 'daily',
          time: '09:00',
          categories: []
        },
        language: 'de'
      }
      
      const updated = await notificationService.updatePreferences(defaultPrefs)
      if (updated.success && updated.data) {
        setPreferences(updated.data)
      }
    } catch (error) {
      console.error('Failed to reset preferences:', error)
      throw error
    }
  }, [])

  // Send test notification
  const sendTest = useCallback(async (channel: NotificationChannel) => {
    try {
      // TODO: Implement test notification
      console.log('Test notification would be sent to channel:', channel)
    } catch (error) {
      console.error('Failed to send test notification:', error)
      throw error
    }
  }, [])

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      // TODO: Implement push subscription
      console.log('Would subscribe to push notifications:', subscription)
    } catch (error) {
      console.error('Failed to subscribe to push:', error)
      throw error
    }
  }, [])

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
        // TODO: Send unsubscribe to server
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error)
      throw error
    }
  }, [])

  // Context value
  const value = useMemo<NotificationContextType>(
    () => ({
      notifications,
      filteredNotifications,
      unreadCount,
      stats,
      filters,
      preferences,
      isLoading,
      isConnected,
      setFilters,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      refresh: loadNotifications,
      updatePreferences,
      resetPreferences,
      sendTest,
      subscribeToPush,
      unsubscribeFromPush,
    }),
    [
      notifications,
      filteredNotifications,
      unreadCount,
      stats,
      filters,
      preferences,
      isLoading,
      isConnected,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      loadNotifications,
      updatePreferences,
      resetPreferences,
      sendTest,
      subscribeToPush,
      unsubscribeFromPush,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook to use notification context
 * @throws {Error} If used outside of NotificationProvider
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

/**
 * Hook to get unread notification count
 */
export const useUnreadCount = (): number => {
  const { unreadCount } = useNotifications()
  return unreadCount
}

/**
 * Hook to get notification preferences
 */
export const useNotificationPreferences = (): NotificationPreferences | null => {
  const { preferences } = useNotifications()
  return preferences
}