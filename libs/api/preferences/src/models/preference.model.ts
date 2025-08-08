/**
 * Preference Model - Notification and system preferences
 * Bakery Management System
 */

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationCategoryPreferences {
  staff: boolean;
  order: boolean;
  system: boolean;
  inventory: boolean;
  general: boolean;
}

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  browserEnabled: boolean;
  soundEnabled: boolean;
  categoryPreferences: NotificationCategoryPreferences;
  priorityThreshold: NotificationPriority;
  quietHours: QuietHoursConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationPreferenceInput {
  userId: string;
  emailEnabled?: boolean;
  browserEnabled?: boolean;
  soundEnabled?: boolean;
  categoryPreferences?: Partial<NotificationCategoryPreferences>;
  priorityThreshold?: NotificationPriority;
  quietHours?: Partial<QuietHoursConfig>;
}

export interface UpdateNotificationPreferenceInput {
  emailEnabled?: boolean;
  browserEnabled?: boolean;
  soundEnabled?: boolean;
  categoryPreferences?: Partial<NotificationCategoryPreferences>;
  priorityThreshold?: NotificationPriority;
  quietHours?: Partial<QuietHoursConfig>;
}

// Default preference values
export const DEFAULT_PREFERENCES: Omit<NotificationPreference, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  emailEnabled: true,
  browserEnabled: true,
  soundEnabled: true,
  categoryPreferences: {
    staff: true,
    order: true,
    system: true,
    inventory: true,
    general: true,
  },
  priorityThreshold: 'low',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

// Validation constants
export const VALID_CATEGORIES = ['staff', 'order', 'system', 'inventory', 'general'] as const;
export const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;