export interface NotificationCategory {
  staff: boolean
  order: boolean
  system: boolean
  inventory: boolean
  general: boolean
}

export interface QuietHours {
  enabled: boolean
  start: string // HH:MM format
  end: string // HH:MM format
}

export type PriorityThreshold = 'low' | 'medium' | 'high' | 'urgent'

export interface NotificationPreferences {
  id?: number
  emailEnabled: boolean
  browserEnabled: boolean
  soundEnabled: boolean
  categoryPreferences: NotificationCategory
  priorityThreshold: PriorityThreshold
  quietHours: QuietHours
  updatedAt?: string
}

export interface PreferencesResponse {
  success: boolean
  preferences?: NotificationPreferences
  message?: string
  error?: string
}
