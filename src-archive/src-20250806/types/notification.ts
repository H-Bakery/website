export interface Notification {
  id: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  category: 'staff' | 'order' | 'system' | 'inventory' | 'general'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  read: boolean
  archived: boolean
  archivedAt?: string
  deletedAt?: string
  createdAt: string
  updatedAt?: string
  userId?: number
  metadata?: Record<string, any>
}

export interface NotificationFilters {
  unreadOnly?: boolean
  categories?: string[]
  priorities?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface NotificationStats {
  total: number
  unread: number
  archived?: number
  byCategory: Record<string, number>
  byPriority: Record<string, number>
}

export interface ArchiveResult {
  notifications: Notification[]
  total: number
  hasMore: boolean
}

export interface ArchiveStats {
  total: number
  read: number
  unread: number
  byCategory: Record<string, number>
  byPriority: Record<string, number>
}
