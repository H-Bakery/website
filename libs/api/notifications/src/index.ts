/**
 * Notifications Library - Public API
 * Bakery Management System
 */

// Export models
export * from './models/notification-archival.model';

// Export services
export { NotificationArchivalService } from './services/notification-archival.service';
export type { NotificationArchivalServiceDeps } from './services/notification-archival.service';

export { NotificationArchiveService } from './services/notification-archive.service';
export type { NotificationArchiveServiceDeps } from './services/notification-archive.service';

// Re-export any existing services from import-service/notifications if needed
export * from '@bakery/api/import-service/notifications';