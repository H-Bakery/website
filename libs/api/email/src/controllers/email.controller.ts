/**
 * Email Controller - HTTP request handling for email operations
 * Bakery Management System
 */

import { Request, Response } from 'express';
import { EmailService } from '../services/email.service';
import { EmailQueueService } from '../services/email-queue.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class EmailController {
  constructor(
    private emailService: EmailService,
    private emailQueueService: EmailQueueService
  ) {}

  /**
   * Send test email
   * POST /api/email/test
   */
  sendTestEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { recipientEmail, language = 'de' } = req.body;
      const userEmail = recipientEmail || req.user?.email;

      if (!userEmail) {
        res.status(400).json({
          success: false,
          error: 'Recipient email is required',
        });
        return;
      }

      const notification = {
        id: `test-${Date.now()}`,
        title: language === 'de' ? 'Test E-Mail' : 'Test Email',
        message:
          language === 'de'
            ? 'Dies ist eine Test-E-Mail vom Bäckerei-System.'
            : 'This is a test email from the bakery system.',
        category: 'system',
        priority: 'medium' as const,
        type: 'info',
      };

      const result = await this.emailService.sendNotificationEmail(
        notification,
        userEmail,
        language
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Test email sent successfully',
          messageId: result.messageId,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send test email',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email',
      });
    }
  };

  /**
   * Send templated email
   * POST /api/email/send
   */
  sendEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { templateKey, variables, recipientEmail, options = {} } = req.body;

      if (!templateKey || !recipientEmail) {
        res.status(400).json({
          success: false,
          error: 'Template key and recipient email are required',
        });
        return;
      }

      const result = await this.emailService.sendTemplatedEmail(
        templateKey,
        variables || {},
        recipientEmail,
        options
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Email sent successfully',
          messageId: result.messageId,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      });
    }
  };

  /**
   * Send bulk emails
   * POST /api/email/bulk
   */
  sendBulkEmails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const { notifications, recipients } = req.body;

      if (!notifications || !recipients || !Array.isArray(recipients)) {
        res.status(400).json({
          success: false,
          error: 'Notifications and recipients array are required',
        });
        return;
      }

      // Add to queue for processing
      this.emailQueueService.addBulkToQueue(notifications, recipients);

      const status = this.emailQueueService.getStatus();

      res.json({
        success: true,
        message: `${recipients.length} emails added to queue`,
        queueStatus: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue bulk emails',
      });
    }
  };

  /**
   * Get email queue status
   * GET /api/email/queue/status
   */
  getQueueStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const status = this.emailQueueService.getStatus();
      const queueByPriority = this.emailQueueService.getQueueByPriority();

      res.json({
        success: true,
        status,
        queueByPriority: {
          urgent: queueByPriority['urgent'].length,
          high: queueByPriority['high'].length,
          medium: queueByPriority['medium'].length,
          low: queueByPriority['low'].length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queue status',
      });
    }
  };

  /**
   * Clear email queue
   * DELETE /api/email/queue
   */
  clearQueue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const clearedCount = this.emailQueueService.clearQueue();

      res.json({
        success: true,
        message: `Email queue cleared. ${clearedCount} emails removed.`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear queue',
      });
    }
  };

  /**
   * Update queue configuration
   * PUT /api/email/queue/config
   */
  updateQueueConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const { batchSize, batchDelay, retryAttempts, retryDelay } = req.body;

      this.emailQueueService.updateConfig({
        batchSize,
        batchDelay,
        retryAttempts,
        retryDelay,
      });

      res.json({
        success: true,
        message: 'Queue configuration updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update queue configuration',
      });
    }
  };

  /**
   * Verify email connection
   * GET /api/email/verify
   */
  verifyConnection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const isConnected = await this.emailService.verifyConnection();

      res.json({
        success: true,
        connected: isConnected,
        message: isConnected
          ? 'Email service is connected and ready'
          : 'Email service is not configured or connection failed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify connection',
      });
    }
  };
}