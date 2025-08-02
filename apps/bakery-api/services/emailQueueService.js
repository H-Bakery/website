const emailService = require("./emailService");
const logger = require("../utils/logger");

class EmailQueueService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 5;
    this.batchDelay = 2000; // 2 seconds between batches
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds between retries
  }

  // Add email to queue
  addToQueue(notification, recipientEmail, userId = null, language = "de") {
    this.queue.push({
      notification,
      recipientEmail,
      userId,
      language,
      attempts: 0,
      addedAt: new Date(),
    });

    logger.info(`Email added to queue for ${recipientEmail}. Queue size: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Add bulk emails to queue
  addBulkToQueue(notifications, recipients) {
    recipients.forEach((recipient) => {
      this.queue.push({
        notification: notifications[recipient.notificationIndex || 0],
        recipientEmail: recipient.email,
        userId: recipient.userId || null,
        language: recipient.language || "de",
        attempts: 0,
        addedAt: new Date(),
      });
    });

    logger.info(`${recipients.length} emails added to queue. Total queue size: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Process email queue
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.info("Starting email queue processing...");

    while (this.queue.length > 0) {
      // Get next batch
      const batch = this.queue.splice(0, this.batchSize);
      
      // Process batch
      const results = await Promise.allSettled(
        batch.map((item) => this.sendEmailWithRetry(item))
      );

      // Handle failed emails
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const item = batch[index];
          item.attempts++;
          
          if (item.attempts < this.retryAttempts) {
            // Re-add to queue for retry
            logger.warn(
              `Email to ${item.recipientEmail} failed, attempt ${item.attempts}. Re-queueing...`
            );
            setTimeout(() => {
              this.queue.push(item);
            }, this.retryDelay);
          } else {
            logger.error(
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
    logger.info("Email queue processing completed");
  }

  // Send email with retry logic
  async sendEmailWithRetry(item) {
    try {
      const result = await emailService.sendNotificationEmail(
        item.notification,
        item.recipientEmail,
        item.language
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info(`Email sent successfully to ${item.recipientEmail}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send email to ${item.recipientEmail}:`, error);
      throw error;
    }
  }

  // Log failed email for manual review
  logFailedEmail(item) {
    // In a production system, this would write to a database or monitoring system
    logger.error("Failed email details:", {
      recipient: item.recipientEmail,
      notificationId: item.notification.id,
      title: item.notification.title,
      attempts: item.attempts,
      queuedAt: item.addedAt,
      failedAt: new Date(),
    });
  }

  // Get queue status
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      batchSize: this.batchSize,
    };
  }

  // Clear queue (for emergency use)
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    logger.warn(`Email queue cleared. ${clearedCount} emails removed.`);
    return clearedCount;
  }
}

// Create singleton instance
const emailQueueService = new EmailQueueService();

module.exports = emailQueueService;