/**
 * Services Index - Central export for all services
 * Bakery Management System
 */

// Export email services
export { emailService, emailQueueService, templateService } from './email.service';

// Export notification services
export { notificationArchivalService, notificationArchiveService } from './notification.service';

// Export production services
export { default as productionService } from './production.service';
export { default as productionPlanningService } from './productionPlanning.service';
export { default as productionExecutionService } from './productionExecution.service';
export { default as productionAnalyticsService } from './productionAnalytics.service';

// Export analytics services
export { default as analyticsService } from './analytics.service';

// Export inventory service
export { default as inventoryService } from './inventory.service';

// Export socket service
export { default as socketService } from './socket.service';