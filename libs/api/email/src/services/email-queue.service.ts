/**
 * Email Queue Service - Queue management for bulk email sending
 * Bakery Management System
 */

import { EmailService } from './email.service';
import {
  EmailNotification,
  EmailRecipient,
  EmailQueueItem,
  EmailQueueStatus,
  EmailResult,
} from '../models/email.model';

export interface EmailQueueServiceDeps {
  emailService: EmailService;
  logger: any;
}

export class EmailQueueService {
  private queue: EmailQueueItem[] = [];
  private processing = false;
  private batchSize = 5;
  private batchDelay = 2000; // 2 seconds between batches
  private retryAttempts = 3;
  private retryDelay = 5000; // 5 seconds between retries
  
  private emailService: EmailService;
  private logger: any;

  constructor(deps: EmailQueueServiceDeps) {
    this.emailService = deps.emailService;
    this.logger = deps.logger;
  }

  /**
   * Add email to queue
   */
  addToQueue(
    notification: EmailNotification,
    recipientEmail: string,
    userId: string | null = null,
    language: 'de' | 'en' = 'de'
  ): void {
    this.queue.push({
      notification,
      recipientEmail,
      userId,
      language,
      attempts: 0,
      addedAt: new Date(),
      priority: notification.priority,
    });

    this.logger.info(
      `Email added to queue for ${recipientEmail}. Queue size: ${this.queue.length}`
    );

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Add bulk emails to queue
   */
  addBulkToQueue(notifications: EmailNotification[], recipients: EmailRecipient[]): void {
    recipients.forEach((recipient) => {
      const notification = notifications[recipient.notificationIndex || 0];
      this.queue.push({
        notification,
        recipientEmail: recipient.email,
        userId: recipient.userId || null,
        language: recipient.language || 'de',
        attempts: 0,
        addedAt: new Date(),
        priority: notification.priority,
      });
    });

    // Sort queue by priority
    this.sortQueueByPriority();

    this.logger.info(
      `${recipients.length} emails added to queue. Total queue size: ${this.queue.length}`
    );

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process email queue
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.logger.info('Starting email queue processing...');

    while (this.queue.length > 0) {
      // Get next batch
      const batch = this.queue.splice(0, this.batchSize);

      // Process batch
      const results = await Promise.allSettled(
        batch.map((item) => this.sendEmailWithRetry(item))
      );

      // Handle failed emails
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
          const item = batch[index];
          item.attempts++;

          if (item.attempts < this.retryAttempts) {
            // Re-add to queue for retry
            this.logger.warn(
              `Email to ${item.recipientEmail} failed, attempt ${item.attempts}. Re-queueing...`
            );
            setTimeout(() => {
              this.queue.push(item);
              this.sortQueueByPriority();
            }, this.retryDelay);
          } else {
            this.logger.error(
              `Email to ${item.recipientEmail} failed after ${this.retryAttempts} attempts. Giving up.`
            );
            this.logFailedEmail(item);
          }
        }
      });

      // Wait before processing next batch
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.batchDelay));
      }
    }

    this.processing = false;
    this.logger.info('Email queue processing completed');
  }

  /**
   * Send email with retry logic
   */
  private async sendEmailWithRetry(item: EmailQueueItem): Promise<EmailResult> {
    try {
      const result = await this.emailService.sendNotificationEmail(
        item.notification,
        item.recipientEmail,
        item.language
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      this.logger.info(`Email sent successfully to ${item.recipientEmail}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${item.recipientEmail}:`, error);
      throw error;
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    
    this.queue.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      return aPriority - bPriority;
    });
  }

  /**
   * Log failed email for manual review
   */
  private logFailedEmail(item: EmailQueueItem): void {
    // In a production system, this would write to a database or monitoring system
    this.logger.error('Failed email details:', {
      recipient: item.recipientEmail,
      notificationId: item.notification.id,
      title: item.notification.title,
      attempts: item.attempts,
      queuedAt: item.addedAt,
      failedAt: new Date(),
    });
  }

  /**
   * Get queue status
   */
  getStatus(): EmailQueueStatus {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
    };
  }

  /**
   * Clear queue (for emergency use)
   */
  clearQueue(): number {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.logger.warn(`Email queue cleared. ${clearedCount} emails removed.`);
    return clearedCount;
  }

  /**
   * Update queue configuration
   */
  updateConfig(config: {
    batchSize?: number;
    batchDelay?: number;
    retryAttempts?: number;
    retryDelay?: number;
  }): void {
    if (config.batchSize !== undefined) {
      this.batchSize = config.batchSize;
    }
    if (config.batchDelay !== undefined) {
      this.batchDelay = config.batchDelay;
    }
    if (config.retryAttempts !== undefined) {
      this.retryAttempts = config.retryAttempts;
    }
    if (config.retryDelay !== undefined) {
      this.retryDelay = config.retryDelay;
    }

    this.logger.info('Email queue configuration updated:', config);
  }

  /**
   * Get queue items by priority
   */
  getQueueByPriority(): Record<string, EmailQueueItem[]> {
    const grouped: Record<string, EmailQueueItem[]> = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    };

    this.queue.forEach((item) => {
      const priority = item.priority || 'medium';
      grouped[priority].push(item);
    });

    return grouped;
  }
}