/**
 * Email and Notification Services Tests
 * Bakery Management System
 */

import { 
  emailService, 
  emailQueueService, 
  templateService,
  notificationArchivalService,
  notificationArchiveService 
} from '../index';

describe('Email and Notification Services', () => {
  describe('EmailService', () => {
    it('should be defined', () => {
      expect(emailService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof emailService.sendNotificationEmail).toBe('function');
      expect(typeof emailService.sendTemplatedEmail).toBe('function');
      expect(typeof emailService.sendBulkEmails).toBe('function');
      expect(typeof emailService.shouldSendEmail).toBe('function');
      expect(typeof emailService.verifyConnection).toBe('function');
    });
  });

  describe('EmailQueueService', () => {
    it('should be defined', () => {
      expect(emailQueueService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof emailQueueService.addToQueue).toBe('function');
      expect(typeof emailQueueService.addBulkToQueue).toBe('function');
      expect(typeof emailQueueService.processQueue).toBe('function');
      expect(typeof emailQueueService.getStatus).toBe('function');
      expect(typeof emailQueueService.clearQueue).toBe('function');
    });

    it('should initialize with default configuration', () => {
      const status = emailQueueService.getStatus();
      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('processing');
      expect(status).toHaveProperty('batchSize');
      expect(status.batchSize).toBe(5);
    });
  });

  describe('TemplateService', () => {
    it('should be defined', () => {
      expect(templateService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof templateService.getTemplate).toBe('function');
      expect(typeof templateService.renderTemplate).toBe('function');
      expect(typeof templateService.createTemplate).toBe('function');
      expect(typeof templateService.updateTemplate).toBe('function');
      expect(typeof templateService.deleteTemplate).toBe('function');
      expect(typeof templateService.validateTemplateVariables).toBe('function');
    });
  });

  describe('NotificationArchivalService', () => {
    it('should be defined', () => {
      expect(notificationArchivalService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof notificationArchivalService.initialize).toBe('function');
      expect(typeof notificationArchivalService.startScheduledTasks).toBe('function');
      expect(typeof notificationArchivalService.stopScheduledTasks).toBe('function');
      expect(typeof notificationArchivalService.updatePolicies).toBe('function');
      expect(typeof notificationArchivalService.getPolicies).toBe('function');
      expect(typeof notificationArchivalService.runAutoArchival).toBe('function');
      expect(typeof notificationArchivalService.runCleanup).toBe('function');
      expect(typeof notificationArchivalService.getArchivalStats).toBe('function');
      expect(typeof notificationArchivalService.triggerArchival).toBe('function');
      expect(typeof notificationArchivalService.triggerCleanup).toBe('function');
      expect(typeof notificationArchivalService.getStatus).toBe('function');
    });

    it('should have default policies', () => {
      const policies = notificationArchivalService.getPolicies();
      expect(policies).toHaveProperty('autoArchiveAfterDays');
      expect(policies).toHaveProperty('permanentDeleteAfterDays');
      expect(policies).toHaveProperty('archiveReadOnly');
      expect(policies).toHaveProperty('excludeCategories');
      expect(policies).toHaveProperty('excludePriorities');
      expect(policies).toHaveProperty('batchSize');
      expect(policies).toHaveProperty('enabled');
    });

    it('should return status correctly', () => {
      const status = notificationArchivalService.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('scheduledTasks');
      expect(status).toHaveProperty('policies');
      expect(Array.isArray(status.scheduledTasks)).toBe(true);
    });
  });

  describe('NotificationArchiveService', () => {
    it('should be defined', () => {
      expect(notificationArchiveService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof notificationArchiveService.archiveNotification).toBe('function');
      expect(typeof notificationArchiveService.archiveBulk).toBe('function');
      expect(typeof notificationArchiveService.restoreNotification).toBe('function');
      expect(typeof notificationArchiveService.restoreBulk).toBe('function');
      expect(typeof notificationArchiveService.softDeleteNotification).toBe('function');
      expect(typeof notificationArchiveService.permanentDeleteNotification).toBe('function');
      expect(typeof notificationArchiveService.getArchivedNotifications).toBe('function');
      expect(typeof notificationArchiveService.getArchiveStats).toBe('function');
      expect(typeof notificationArchiveService.autoArchiveOldNotifications).toBe('function');
      expect(typeof notificationArchiveService.cleanupOldArchives).toBe('function');
      expect(typeof notificationArchiveService.searchNotifications).toBe('function');
    });
  });

  describe('Service Integration', () => {
    it('should handle email queue operations', () => {
      const mockNotification = {
        id: 'test-1',
        title: 'Test Notification',
        message: 'This is a test',
        category: 'general',
        priority: 'medium' as const,
      };

      // Add to queue
      emailQueueService.addToQueue(mockNotification, 'test@example.com');
      
      const status = emailQueueService.getStatus();
      expect(status.queueSize).toBeGreaterThan(0);

      // Clear queue
      const cleared = emailQueueService.clearQueue();
      expect(cleared).toBeGreaterThanOrEqual(1);
      
      const statusAfterClear = emailQueueService.getStatus();
      expect(statusAfterClear.queueSize).toBe(0);
    });

    it('should handle policy updates', () => {
      const newPolicies = {
        autoArchiveAfterDays: 60,
        permanentDeleteAfterDays: 180,
      };

      notificationArchivalService.updatePolicies(newPolicies);
      
      const updatedPolicies = notificationArchivalService.getPolicies();
      expect(updatedPolicies.autoArchiveAfterDays).toBe(60);
      expect(updatedPolicies.permanentDeleteAfterDays).toBe(180);
    });
  });
});