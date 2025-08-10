/**
 * Email Service Factory - Integrates all email services
 * Bakery Management System
 */

import { EmailService, EmailQueueService } from '@bakery/api/email';
import { TemplateService } from '@bakery/api/templates';
import { NotificationPreferences } from '../models';

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

// Create template service instance
const templateService = new TemplateService({
  NotificationTemplate: require('../models').NotificationTemplate,
  logger,
});

// Create email service instance
const emailService = new EmailService({
  logger,
  templateService,
  NotificationPreferences,
});

// Create email queue service instance  
const emailQueueService = new EmailQueueService({
  emailService,
  logger,
});

// Export services
export { emailService, emailQueueService, templateService };