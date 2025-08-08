/**
 * Email Service - Core email sending functionality
 * Bakery Management System
 */

import * as nodemailer from 'nodemailer';
import {
  EmailConfig,
  EmailNotification,
  EmailOptions,
  EmailResult,
  BulkEmailResult,
  EmailRecipient,
  EmailTemplate,
  EMAIL_CATEGORY_TRANSLATIONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  EmailPriority,
} from '../models/email.model';

export interface EmailServiceDeps {
  logger: any;
  templateService?: any;
  NotificationPreferences?: any;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;
  private config: EmailConfig;
  private logger: any;
  private templateService: any;
  private NotificationPreferences: any;

  constructor(deps: EmailServiceDeps) {
    this.logger = deps.logger;
    this.templateService = deps.templateService;
    this.NotificationPreferences = deps.NotificationPreferences;

    this.config = {
      provider: (process.env['EMAIL_PROVIDER'] || 'smtp') as EmailConfig['provider'],
      from: process.env['EMAIL_FROM'] || 'noreply@bakery.com',
      fromName: process.env['EMAIL_FROM_NAME'] || 'Bakery Notifications',
    };

    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on configuration
   */
  private initializeTransporter(): void {
    try {
      // Skip initialization if no email configuration
      if (!process.env['EMAIL_HOST'] && !process.env['EMAIL_PROVIDER']) {
        this.logger.info('Email service not configured. Skipping email notifications.');
        return;
      }

      let transportConfig: any;

      switch (this.config.provider) {
        case 'gmail':
          transportConfig = {
            service: 'gmail',
            auth: {
              user: process.env['EMAIL_USER'],
              pass: process.env['EMAIL_PASSWORD'],
            },
          };
          break;

        case 'sendgrid':
          transportConfig = {
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: process.env['SENDGRID_API_KEY'],
            },
          };
          break;

        case 'aws-ses':
          transportConfig = {
            host: process.env['AWS_SES_ENDPOINT'] || 'email-smtp.us-east-1.amazonaws.com',
            port: 587,
            secure: false,
            auth: {
              user: process.env['AWS_SES_USERNAME'],
              pass: process.env['AWS_SES_PASSWORD'],
            },
          };
          break;

        case 'smtp':
        default:
          transportConfig = {
            host: process.env['EMAIL_HOST'],
            port: parseInt(process.env['EMAIL_PORT'] || '587'),
            secure: process.env['EMAIL_SECURE'] === 'true',
            auth: {
              user: process.env['EMAIL_USER'],
              pass: process.env['EMAIL_PASSWORD'],
            },
          };
      }

      // Add TLS options if specified
      if (process.env['EMAIL_TLS_REJECT_UNAUTHORIZED'] === 'false') {
        transportConfig.tls = {
          rejectUnauthorized: false,
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);
      this.isConfigured = true;

      // Verify connection
      this.verifyConnection();
    } catch (error) {
      this.logger.error('Failed to initialize email transporter:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Verify email connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      this.logger.info('Email service connected successfully');
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed:', error);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    notification: EmailNotification,
    recipientEmail: string,
    language: 'de' | 'en' = 'de'
  ): Promise<EmailResult> {
    if (!this.isConfigured || !this.transporter) {
      this.logger.warn('Email service not configured. Skipping email notification.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Generate email content
      const template = await this.generateEmailTemplate(notification, language);

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.info(`Email sent successfully to ${recipientEmail}`, {
        messageId: result.messageId,
        notificationId: notification.id,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send templated email using template service
   */
  async sendTemplatedEmail(
    templateKey: string,
    variables: Record<string, any>,
    recipientEmail: string,
    options: EmailOptions = {}
  ): Promise<EmailResult> {
    if (!this.isConfigured) {
      this.logger.warn('Email service not configured. Skipping email.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { language = 'de', subject = null } = options;

      // Render notification from template if template service is available
      if (this.templateService) {
        const notificationData = await this.templateService.renderTemplate({
          templateKey,
          variables,
          language,
        });

        // Use custom subject if provided
        if (subject) {
          notificationData.title = subject;
        }

        return await this.sendNotificationEmail(notificationData, recipientEmail, language);
      } else {
        // Fallback to simple email without template
        const notification: EmailNotification = {
          id: `email-${Date.now()}`,
          title: subject || templateKey,
          message: JSON.stringify(variables),
          category: 'general',
          priority: 'medium',
        };

        return await this.sendNotificationEmail(notification, recipientEmail, language);
      }
    } catch (error) {
      this.logger.error('Failed to send templated email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    notifications: EmailNotification[],
    recipients: EmailRecipient[]
  ): Promise<BulkEmailResult> {
    if (!this.isConfigured) {
      this.logger.warn('Email service not configured. Skipping bulk emails.');
      return { success: false, sent: 0, failed: recipients.length };
    }

    const results: PromiseSettledResult<EmailResult>[] = [];
    const errors: string[] = [];

    // Process in batches to avoid overwhelming the email server
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map((recipient) => {
        const notification = notifications[recipient.notificationIndex || 0];
        return this.sendNotificationEmail(
          notification,
          recipient.email,
          recipient.language || 'de'
        );
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Collect errors
      batchResults.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
          const error = result.status === 'rejected' 
            ? result.reason 
            : result.value.error;
          errors.push(`${batch[index].email}: ${error}`);
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;

    this.logger.info(`Bulk email completed: ${successful} sent, ${failed} failed`);
    return { success: true, sent: successful, failed, errors };
  }

  /**
   * Generate email template
   */
  private async generateEmailTemplate(
    notification: EmailNotification,
    language: 'de' | 'en' = 'de'
  ): Promise<EmailTemplate> {
    const html = this.generateEmailHtml(notification, language);
    const text = this.generateEmailText(notification);

    return {
      subject: notification.title,
      html,
      text,
    };
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHtml(notification: EmailNotification, language: 'de' | 'en'): string {
    const appUrl = process.env['APP_URL'] || 'http://localhost:3000';

    return `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${notification.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; background-color: #8B4513; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px;">
                                ${language === 'de' ? 'Bäckerei Benachrichtigung' : 'Bakery Notification'}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <!-- Priority indicator -->
                            ${this.getPriorityBadgeHtml(notification.priority, language)}
                            
                            <!-- Title -->
                            <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px;">
                                ${notification.title}
                            </h2>
                            
                            <!-- Message -->
                            <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                ${notification.message}
                            </p>
                            
                            <!-- Category and Type -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 10px; background-color: #f8f8f8; border-radius: 4px;">
                                        <span style="color: #888888; font-size: 14px;">
                                            ${language === 'de' ? 'Kategorie' : 'Category'}: 
                                            <strong>${this.translateCategory(notification.category, language)}</strong>
                                        </span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${appUrl}/admin/notifications" 
                                           style="display: inline-block; padding: 12px 30px; background-color: #8B4513; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px;">
                                            ${language === 'de' ? 'Im Dashboard anzeigen' : 'View in Dashboard'}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px 0; color: #888888; font-size: 12px; text-align: center;">
                                ${
                                  language === 'de'
                                    ? 'Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht darauf.'
                                    : 'This email was generated automatically. Please do not reply.'
                                }
                            </p>
                            <p style="margin: 0; color: #888888; font-size: 12px; text-align: center;">
                                <a href="${appUrl}/admin/settings/notifications" style="color: #8B4513;">
                                    ${language === 'de' ? 'E-Mail-Einstellungen verwalten' : 'Manage email preferences'}
                                </a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email content
   */
  private generateEmailText(notification: EmailNotification): string {
    return `${notification.title}

${notification.message}

Kategorie: ${notification.category}
Priorität: ${notification.priority}`;
  }

  /**
   * Generate priority badge HTML
   */
  private getPriorityBadgeHtml(priority: EmailPriority, language: 'de' | 'en'): string {
    const color = PRIORITY_COLORS[priority];
    const label = PRIORITY_LABELS[priority][language];

    return `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: ${color}; color: #ffffff; border-radius: 4px; font-size: 14px; font-weight: bold;">
          ${label}
        </span>
      </div>
    `;
  }

  /**
   * Translate category
   */
  private translateCategory(category: string, language: 'de' | 'en'): string {
    const translations = EMAIL_CATEGORY_TRANSLATIONS as any;
    return translations[category]?.[language] || category;
  }

  /**
   * Check if user wants email notifications
   */
  async shouldSendEmail(userId: string | null, notification: EmailNotification): Promise<boolean> {
    try {
      // If no userId, check default behavior
      if (!userId) {
        // For broadcast notifications, we might want to send to all users with email enabled
        return process.env['SEND_BROADCAST_EMAILS'] === 'true';
      }

      // If no NotificationPreferences service, default to true
      if (!this.NotificationPreferences) {
        return true;
      }

      // Get user preferences
      const preferences = await this.NotificationPreferences.findOne({
        where: { userId },
      });

      if (!preferences || !preferences.emailEnabled) {
        return false;
      }

      // Check category preferences
      const categoryEnabled = preferences.categoryPreferences[notification.category] !== false;
      if (!categoryEnabled) {
        return false;
      }

      // Check priority threshold
      const priorityLevels = { low: 1, medium: 2, high: 3, urgent: 4 };
      const notificationLevel = priorityLevels[notification.priority] || 1;
      const thresholdLevel = priorityLevels[preferences.priorityThreshold as keyof typeof priorityLevels] || 1;

      if (notificationLevel < thresholdLevel) {
        return false;
      }

      // Check quiet hours (for non-urgent notifications)
      if (notification.priority !== 'urgent' && preferences.quietHours?.enabled) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;

        const { start, end } = preferences.quietHours;

        // Handle overnight quiet hours
        if (start > end) {
          if (currentTime >= start || currentTime < end) {
            return false;
          }
        } else {
          if (currentTime >= start && currentTime < end) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking email preferences:', error);
      return false;
    }
  }
}