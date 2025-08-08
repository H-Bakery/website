/**
 * Notification types for the bakery management system
 */

/**
 * Notification categories
 */
export type NotificationCategory =
  | 'order'
  | 'inventory'
  | 'staff'
  | 'system'
  | 'customer'
  | 'general'

/**
 * Notification priorities
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Notification channels
 */
export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'push'

/**
 * Notification type
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

/**
 * Base notification interface
 */
export interface Notification {
  /** Unique notification ID */
  id: string

  /** Notification type */
  type: NotificationType

  /** Notification category */
  category: NotificationCategory

  /** Notification priority */
  priority: NotificationPriority

  /** Notification title */
  title: string

  /** Notification message */
  message: string

  /** Creation timestamp */
  createdAt: Date

  /** Read status */
  read: boolean

  /** Expiration time (optional) */
  expiresAt?: Date

  /** Associated user ID */
  userId?: string

  /** Related entity ID (order, product, etc.) */
  relatedId?: string

  /** Related entity type */
  relatedType?: string

  /** Additional metadata */
  metadata?: Record<string, any>

  /** Action buttons */
  actions?: NotificationAction[]

  /** Notification channel */
  channel: NotificationChannel

  /** Delivery status */
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed'

  /** Retry count for failed notifications */
  retryCount?: number
}

/**
 * Notification action interface
 */
export interface NotificationAction {
  /** Action ID */
  id: string

  /** Action label */
  label: string

  /** Action type */
  type: 'primary' | 'secondary' | 'danger'

  /** Action URL or handler */
  action: string | (() => void)

  /** Icon for the action */
  icon?: string
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  /** User ID */
  userId: string

  /** Channel preferences */
  channels: {
    [K in NotificationChannel]: {
      enabled: boolean
      categories: NotificationCategory[]
      minPriority: NotificationPriority
    }
  }

  /** Quiet hours */
  quietHours?: {
    enabled: boolean
    start: string // HH:MM format
    end: string // HH:MM format
    timezone: string
  }

  /** Sound preferences */
  sound: {
    enabled: boolean
    volume: number // 0-100
    customSound?: string
  }

  /** Digest preferences */
  digest: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    time: string // HH:MM format
    categories: NotificationCategory[]
  }

  /** Language preference */
  language: string

  /** Updated timestamp */
  updatedAt: Date
}

/**
 * Create notification input
 */
export interface CreateNotificationInput {
  type: NotificationType
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  userId?: string
  relatedId?: string
  relatedType?: string
  metadata?: Record<string, any>
  actions?: Omit<NotificationAction, 'id'>[]
  channel: NotificationChannel
  expiresAt?: Date
}

/**
 * Update notification input
 */
export interface UpdateNotificationInput {
  read?: boolean
  metadata?: Record<string, any>
}

/**
 * Notification filters
 */
export interface NotificationFilters {
  categories?: NotificationCategory[]
  priorities?: NotificationPriority[]
  channels?: NotificationChannel[]
  types?: NotificationType[]
  read?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
  userId?: string
  relatedType?: string
}

/**
 * Notification query options
 */
export interface NotificationQueryOptions {
  filters?: NotificationFilters
  sortBy?: 'createdAt' | 'priority' | 'category'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * Bulk notification operations
 */
export interface BulkNotificationOperation {
  action: 'markAsRead' | 'delete' | 'archive'
  notificationIds: string[]
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number
  unread: number
  byCategory: Record<NotificationCategory, number>
  byPriority: Record<NotificationPriority, number>
  byChannel: Record<NotificationChannel, number>
  byType: Record<NotificationType, number>
}

/**
 * Real-time notification event
 */
export interface NotificationEvent {
  type: 'created' | 'updated' | 'deleted'
  notification: Notification
  timestamp: Date
}

/**
 * Legacy notification interface for backward compatibility
 */
export interface LegacyNotification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'staff' | 'order' | 'system' | 'inventory' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  archived: boolean;
  archivedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
  userId?: number;
  metadata?: Record<string, any>;
}

/**
 * Archive result for paginated archive queries
 */
export interface ArchiveResult {
  notifications: LegacyNotification[];
  total: number;
  hasMore: boolean;
}

/**
 * Archive statistics
 */
export interface ArchiveStats {
  total: number;
  read: number;
  unread: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

/**
 * Legacy notification preferences
 */
export interface LegacyNotificationPreferences {
  id?: number;
  emailEnabled: boolean;
  browserEnabled: boolean;
  soundEnabled: boolean;
  categoryPreferences: Record<string, boolean>;
  priorityThreshold: 'low' | 'medium' | 'high' | 'urgent';
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  updatedAt?: string;
}

export type PriorityThreshold = LegacyNotificationPreferences['priorityThreshold'];
