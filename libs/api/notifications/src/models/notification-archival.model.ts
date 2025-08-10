/**
 * Notification Archival Model - Types and interfaces for notification archival
 * Bakery Management System
 */

export interface ArchivalPolicy {
  autoArchiveAfterDays: number;
  permanentDeleteAfterDays: number;
  archiveReadOnly: boolean;
  excludeCategories: string[];
  excludePriorities: string[];
  batchSize: number;
  enabled: boolean;
}

export interface ArchivalStats {
  total: number;
  archived: number;
  deleted: number;
  eligibleForArchival: number;
  eligibleForCleanup: number;
  policies: ArchivalPolicy;
  isRunning: boolean;
}

export interface ArchivalResult {
  archived?: number;
  deleted?: number;
  duration: number;
  policies: ArchivalPolicy;
  skipped?: boolean;
}

export interface ArchivalScheduleStatus {
  isRunning: boolean;
  scheduledTasks: string[];
  policies: ArchivalPolicy;
}

export interface ArchivedNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  read: boolean;
  archived: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ArchiveSearchOptions {
  limit?: number;
  offset?: number;
  category?: string;
  priority?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  includeArchived?: boolean;
}

export interface ArchiveSearchResult {
  notifications: ArchivedNotification[];
  total: number;
  hasMore: boolean;
}

export interface ArchiveStats {
  total: number;
  read: number;
  unread: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface AutoArchiveRules {
  readOlderThanDays?: number;
  unreadOlderThanDays?: number;
  categories?: string[];
  priorities?: string[];
}

// Default archival policies
export const DEFAULT_ARCHIVAL_POLICIES: ArchivalPolicy = {
  autoArchiveAfterDays: 30,
  permanentDeleteAfterDays: 90,
  archiveReadOnly: true,
  excludeCategories: ['urgent'],
  excludePriorities: [],
  batchSize: 100,
  enabled: true,
};

// Cron schedule patterns
export const ARCHIVAL_SCHEDULES = {
  daily: '0 2 * * *', // Daily at 2:00 AM
  weekly: '0 3 * * 0', // Weekly on Sundays at 3:00 AM
};