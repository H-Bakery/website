'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  LegacyNotification as Notification, 
  NotificationFilters, 
  NotificationStats,
  LegacyNotificationPreferences as NotificationPreferences 
} from '@bakery/shared/types';
import { notificationService } from '@bakery/shared/data-access';
import { useAuth } from '../auth/auth.context';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  loading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  getFilteredNotifications: (filters?: NotificationFilters) => Notification[];
  isWebSocketConnected: boolean;
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const { user } = useAuth();

  // Calculate unread count
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications();
      if (response.success && response.data) {
        // Convert the response to legacy format
        const legacyNotifs: Notification[] = response.data.map((n: any) => ({
          id: parseInt(n.id),
          title: n.title,
          message: n.message,
          type: n.type as any,
          category: n.category as any,
          priority: n.priority as any,
          read: n.read,
          archived: false,
          createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
          userId: n.userId ? parseInt(n.userId) : undefined,
          metadata: n.metadata
        }));
        setNotifications(legacyNotifs);
        
        // Calculate stats
        const newStats: NotificationStats = {
          total: legacyNotifs.length,
          unread: legacyNotifs.filter(n => !n.read).length,
          byCategory: {} as any,
          byPriority: {} as any,
          byChannel: {} as any,
          byType: {} as any
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    try {
      const response = await notificationService.getPreferences();
      if (response.success && response.data) {
        // Convert to legacy format if needed
        const legacyPrefs = response.data as any;
        setPreferences(legacyPrefs);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications();
    if (user) {
      loadPreferences();
    }
  }, [loadNotifications, loadPreferences, user]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: number) => {
    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      // Server update
      await notificationService.deleteNotification(id.toString());
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert on error
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: false } : n)
      );
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Server update - delete all unread
      await Promise.all(
        notifications.filter(n => !n.read).map(n => 
          notificationService.deleteNotification(n.id.toString())
        )
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
      // Reload on error
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  // Delete notification
  const deleteNotification = useCallback(async (id: number) => {
    try {
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id));
      // Server update
      await notificationService.deleteNotification(id.toString());
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Reload on error
      loadNotifications();
    }
  }, [loadNotifications]);

  // Filter notifications
  const getFilteredNotifications = useCallback((filters?: NotificationFilters) => {
    if (!filters) return notifications;
    
    return notifications.filter(n => {
      if (filters.categories?.length && !filters.categories.includes(n.category as any)) {
        return false;
      }
      if (filters.priorities?.length && !filters.priorities.includes(n.priority as any)) {
        return false;
      }
      if (filters.read !== undefined && n.read !== filters.read) {
        return false;
      }
      return true;
    });
  }, [notifications]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    try {
      // Convert legacy format to new format for API call
      const response = await notificationService.updatePreferences(prefs as any);
      if (response.success && response.data) {
        const legacyPrefs = response.data as any;
        setPreferences(legacyPrefs);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }, []);

  // Reset preferences
  const resetPreferences = useCallback(async () => {
    const defaultPrefs: NotificationPreferences = {
      emailEnabled: true,
      browserEnabled: true,
      soundEnabled: true,
      categoryPreferences: {},
      priorityThreshold: 'low',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
    
    try {
      const response = await notificationService.updatePreferences(defaultPrefs as any);
      if (response.success && response.data) {
        const legacyPrefs = response.data as any;
        setPreferences(legacyPrefs);
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;