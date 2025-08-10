/**
 * Notification Service Factory - Integrates all notification services
 * Bakery Management System
 */

import { 
  NotificationArchivalService, 
  NotificationArchiveService 
} from '@bakery/api/notifications';
import { Notification, User } from '../models';

// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
};

// Create notification archival service instance
const notificationArchivalService = new NotificationArchivalService({
  Notification,
  logger,
});

// Create notification archive service instance
const notificationArchiveService = new NotificationArchiveService({
  Notification,
  User,
  logger,
});

// Initialize archival service with default policies
// This can be customized based on environment variables or config
notificationArchivalService.initialize({
  enabled: process.env.ENABLE_AUTO_ARCHIVAL === 'true',
  autoArchiveAfterDays: parseInt(process.env.ARCHIVE_AFTER_DAYS || '30'),
  permanentDeleteAfterDays: parseInt(process.env.DELETE_AFTER_DAYS || '90'),
  archiveReadOnly: process.env.ARCHIVE_READ_ONLY !== 'false',
  batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '100'),
});

// Export services
export { 
  notificationArchivalService, 
  notificationArchiveService 
};