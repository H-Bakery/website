'use client'
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import type {
  Notification,
  NotificationFilters,
  NotificationStats,
} from '../types/notification'
import { NotificationPreferences } from '../types/notificationPreferences'
import { notificationAPI } from '../services/notificationService'
import { socketService } from '../services/socketService'
import bakeryAPI from '../services/bakeryAPI'
import { useAuth } from './AuthContext'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  stats: NotificationStats | null
  loading: boolean
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  refreshNotifications: () => Promise<void>
  getFilteredNotifications: (filters?: NotificationFilters) => Notification[]
  isWebSocketConnected: boolean
  preferences: NotificationPreferences | null
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>
  resetPreferences: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    )
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null)
  const { user } = useAuth()

  // Calculate unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  // Load preferences
  const loadPreferences = useCallback(async () => {
    try {
      const response = await bakeryAPI.getNotificationPreferences()
      if (response.success && response.preferences) {
        setPreferences(response.preferences)
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error)
    }
  }, [])

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const [notifs, notifStats] = await Promise.all([
        notificationAPI.getNotifications(),
        notificationAPI.getStats(),
      ])
      setNotifications(notifs)
      setStats(notifStats)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('auth_token')
    if (token) {
      // Connect to WebSocket
      socketService.connect(token)
      setIsWebSocketConnected(socketService.isConnected())

      // Set up WebSocket event handlers
      const unsubscribeNew = socketService.onNewNotification((notification) => {
        setNotifications((prev) => [notification, ...prev])
        setStats((prev) => {
          if (!prev) return null
          return {
            ...prev,
            total: prev.total + 1,
            unread: prev.unread + 1,
            byCategory: {
              ...prev.byCategory,
              [notification.category]:
                (prev.byCategory[notification.category] || 0) + 1,
            },
            byPriority: {
              ...prev.byPriority,
              [notification.priority]:
                (prev.byPriority[notification.priority] || 0) + 1,
            },
          }
        })

        // Check if notification should be shown based on preferences
        if (preferences) {
          // Check category preference
          const categoryEnabled =
            preferences.categoryPreferences[notification.category] ?? true

          // Check priority threshold
          const priorityOrder = { low: 0, medium: 1, high: 2, urgent: 3 }
          const meetsThreshold =
            priorityOrder[notification.priority] >=
            priorityOrder[preferences.priorityThreshold]

          // Check quiet hours
          let inQuietHours = false
          if (preferences.quietHours.enabled) {
            const now = new Date()
            const currentTime = now.getHours() * 60 + now.getMinutes()
            const [startHour, startMin] = preferences.quietHours.start
              .split(':')
              .map(Number)
            const [endHour, endMin] = preferences.quietHours.end
              .split(':')
              .map(Number)
            const startTime = startHour * 60 + startMin
            const endTime = endHour * 60 + endMin

            if (startTime > endTime) {
              // Quiet hours span midnight
              inQuietHours = currentTime >= startTime || currentTime < endTime
            } else {
              inQuietHours = currentTime >= startTime && currentTime < endTime
            }
          }

          // Show browser notification if all conditions are met
          if (
            preferences.browserEnabled &&
            categoryEnabled &&
            meetsThreshold &&
            !inQuietHours &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/logo192.png',
            })

            // Play sound if enabled
            if (preferences.soundEnabled) {
              // Play notification sound
              const audio = new Audio('/notification-sound.mp3')
              audio
                .play()
                .catch((e) =>
                  console.log('Could not play notification sound:', e)
                )
            }
          }
        }
      })

      const unsubscribeUpdate = socketService.onNotificationUpdate((update) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === update.id ? { ...n, ...update } : n))
        )

        // Update stats if read status changed
        if ('read' in update) {
          setStats((prev) => {
            if (!prev) return null
            return {
              ...prev,
              unread: update.read ? prev.unread - 1 : prev.unread + 1,
            }
          })
        }
      })

      const unsubscribeDelete = socketService.onNotificationDelete((id) => {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === id)
          if (deleted && stats) {
            setStats({
              ...stats,
              total: stats.total - 1,
              unread: deleted.read ? stats.unread : stats.unread - 1,
              byCategory: {
                ...stats.byCategory,
                [deleted.category]: Math.max(
                  0,
                  (stats.byCategory[deleted.category] || 0) - 1
                ),
              },
              byPriority: {
                ...stats.byPriority,
                [deleted.priority]: Math.max(
                  0,
                  (stats.byPriority[deleted.priority] || 0) - 1
                ),
              },
            })
          }
          return prev.filter((n) => n.id !== id)
        })
      })

      // Check connection status periodically
      const connectionInterval = setInterval(() => {
        setIsWebSocketConnected(socketService.isConnected())
      }, 5000)

      return () => {
        unsubscribeNew()
        unsubscribeUpdate()
        unsubscribeDelete()
        clearInterval(connectionInterval)
        socketService.disconnect()
      }
    }
  }, [user, stats])

  // Subscribe to notification updates from service (for local changes)
  useEffect(() => {
    // Initial load
    loadNotifications()

    // Load preferences if user is logged in
    if (user) {
      loadPreferences()
    }

    // Subscribe to updates
    const unsubscribe = notificationAPI.subscribe((updatedNotifications) => {
      setNotifications(updatedNotifications)
      // Update stats when notifications change
      notificationAPI.getStats().then(setStats)
    })

    return unsubscribe
  }, [loadNotifications, loadPreferences, user])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Mark notification as read
  const markAsRead = useCallback(async (id: number) => {
    try {
      await notificationAPI.markAsRead(id)
      // Emit WebSocket event
      socketService.markAsRead(id)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationAPI.markAllAsRead()
      // Updates will come through WebSocket
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [])

  // Delete notification
  const deleteNotification = useCallback(async (id: number) => {
    try {
      await notificationAPI.deleteNotification(id)
      // Emit WebSocket event
      socketService.deleteNotification(id)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [])

  // Get filtered notifications
  const getFilteredNotifications = useCallback(
    (filters?: NotificationFilters) => {
      if (!filters) return notifications

      let filtered = [...notifications]

      if (filters.unreadOnly) {
        filtered = filtered.filter((n) => !n.read)
      }
      if (filters.categories && filters.categories.length > 0) {
        filtered = filtered.filter((n) =>
          filters.categories!.includes(n.category)
        )
      }
      if (filters.priorities && filters.priorities.length > 0) {
        filtered = filtered.filter((n) =>
          filters.priorities!.includes(n.priority)
        )
      }
      if (filters.dateRange) {
        filtered = filtered.filter((n) => {
          const date = new Date(n.createdAt)
          return (
            date >= filters.dateRange!.start && date <= filters.dateRange!.end
          )
        })
      }

      return filtered
    },
    [notifications]
  )

  // Update notification preferences
  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      try {
        const response = await bakeryAPI.updateNotificationPreferences(prefs)
        if (response.success && response.preferences) {
          setPreferences(response.preferences)
        }
      } catch (error) {
        console.error('Error updating notification preferences:', error)
        throw error
      }
    },
    []
  )

  // Reset notification preferences
  const resetPreferences = useCallback(async () => {
    try {
      const response = await bakeryAPI.resetNotificationPreferences()
      if (response.success && response.preferences) {
        setPreferences(response.preferences)
      }
    } catch (error) {
      console.error('Error resetting notification preferences:', error)
      throw error
    }
  }, [])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      stats,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refreshNotifications: loadNotifications,
      getFilteredNotifications,
      isWebSocketConnected,
      preferences,
      updatePreferences,
      resetPreferences,
    }),
    [
      notifications,
      unreadCount,
      stats,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      loadNotifications,
      getFilteredNotifications,
      isWebSocketConnected,
      preferences,
      updatePreferences,
      resetPreferences,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
