const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
const templateService = require("./templateService");
const { NotificationPreferences } = require("../models");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.config = {
      provider: process.env.EMAIL_PROVIDER || "smtp",
      from: process.env.EMAIL_FROM || "noreply@bakery.com",
      fromName: process.env.EMAIL_FROM_NAME || "Bakery Notifications",
    };
    
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Skip initialization if no email configuration
      if (!process.env.EMAIL_HOST && !process.env.EMAIL_PROVIDER) {
        logger.info("Email service not configured. Skipping email notifications.");
        return;
      }

      let transportConfig;

      switch (this.config.provider) {
        case "gmail":
          transportConfig = {
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD,
            },
          };
          break;

        case "sendgrid":
          transportConfig = {
            host: "smtp.sendgrid.net",
            port: 587,
            auth: {
              user: "apikey",
              pass: process.env.SENDGRID_API_KEY,
            },
          };
          break;

        case "aws-ses":
          transportConfig = {
            host: process.env.AWS_SES_ENDPOINT || "email-smtp.us-east-1.amazonaws.com",
            port: 587,
            secure: false,
            auth: {
              user: process.env.AWS_SES_USERNAME,
              pass: process.env.AWS_SES_PASSWORD,
            },
          };
          break;

        case "smtp":
        default:
          transportConfig = {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || "587"),
            secure: process.env.EMAIL_SECURE === "true",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD,
            },
          };
      }

      // Add TLS options if specified
      if (process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === "false") {
        transportConfig.tls = {
          rejectUnauthorized: false,
        };
      }

      this.transporter = nodemailer.createTransporter(transportConfig);
      this.isConfigured = true;

      // Verify connection
      this.verifyConnection();
    } catch (error) {
      logger.error("Failed to initialize email transporter:", error);
      this.isConfigured = false;
    }
  }

  async verifyConnection() {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      logger.info("Email service connected successfully");
      return true;
    } catch (error) {
      logger.error("Email service connection failed:", error);
      this.isConfigured = false;
      return false;
    }
  }

  async sendNotificationEmail(notification, recipientEmail, language = "de") {
    if (!this.isConfigured) {
      logger.warn("Email service not configured. Skipping email notification.");
      return { success: false, error: "Email service not configured" };
    }

    try {
      // Generate HTML email from notification
      const htmlContent = await this.generateEmailHtml(notification, language);
      const textContent = this.generateEmailText(notification);

      const mailOptions = {
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: recipientEmail,
        subject: notification.title,
        text: textContent,
        html: htmlContent,
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${recipientEmail}`, {
        messageId: result.messageId,
        notificationId: notification.id,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendTemplatedEmail(templateKey, variables, recipientEmail, options = {}) {
    if (!this.isConfigured) {
      logger.warn("Email service not configured. Skipping email.");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const { language = "de", subject = null } = options;

      // Render notification from template
      const notificationData = await templateService.renderTemplate(
        templateKey,
        variables,
        language
      );

      // Use custom subject if provided
      if (subject) {
        notificationData.title = subject;
      }

      return await this.sendNotificationEmail(notificationData, recipientEmail, language);
    } catch (error) {
      logger.error("Failed to send templated email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendBulkEmails(notifications, recipients) {
    if (!this.isConfigured) {
      logger.warn("Email service not configured. Skipping bulk emails.");
      return { success: false, error: "Email service not configured" };
    }

    const results = [];
    
    // Process in batches to avoid overwhelming the email server
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map((recipient) =>
        this.sendNotificationEmail(
          notifications[recipient.notificationIndex],
          recipient.email,
          recipient.language
        )
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - successful;

    logger.info(`Bulk email completed: ${successful} sent, ${failed} failed`);
    return { success: true, sent: successful, failed };
  }

  generateEmailHtml(notification, language = "de") {
    const logoUrl = process.env.LOGO_URL || "https://bakery.com/logo.png";
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    
    // Basic HTML template with inline CSS for better email client support
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
                                ${language === "de" ? "Bäckerei Benachrichtigung" : "Bakery Notification"}
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
                                            ${language === "de" ? "Kategorie" : "Category"}: 
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
                                            ${language === "de" ? "Im Dashboard anzeigen" : "View in Dashboard"}
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
                                ${language === "de" 
                                  ? "Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht darauf."
                                  : "This email was generated automatically. Please do not reply."}
                            </p>
                            <p style="margin: 0; color: #888888; font-size: 12px; text-align: center;">
                                <a href="${appUrl}/admin/settings/notifications" style="color: #8B4513;">
                                    ${language === "de" ? "E-Mail-Einstellungen verwalten" : "Manage email preferences"}
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

  generateEmailText(notification) {
    return `${notification.title}\n\n${notification.message}\n\nKategorie: ${notification.category}\nPriorität: ${notification.priority}`;
  }

  getPriorityBadgeHtml(priority, language) {
    const colors = {
      low: "#28a745",
      medium: "#ffc107",
      high: "#fd7e14",
      urgent: "#dc3545",
    };

    const labels = {
      low: { de: "Niedrig", en: "Low" },
      medium: { de: "Mittel", en: "Medium" },
      high: { de: "Hoch", en: "High" },
      urgent: { de: "Dringend", en: "Urgent" },
    };

    return `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 12px; background-color: ${colors[priority]}; color: #ffffff; border-radius: 4px; font-size: 14px; font-weight: bold;">
          ${labels[priority][language]}
        </span>
      </div>
    `;
  }

  translateCategory(category, language) {
    const translations = {
      staff: { de: "Personal", en: "Staff" },
      order: { de: "Bestellungen", en: "Orders" },
      system: { de: "System", en: "System" },
      inventory: { de: "Inventar", en: "Inventory" },
      production: { de: "Produktion", en: "Production" },
      sales: { de: "Verkauf", en: "Sales" },
      general: { de: "Allgemein", en: "General" },
    };

    return translations[category]?.[language] || category;
  }

  // Check if user wants email notifications
  async shouldSendEmail(userId, notification) {
    try {
      // If no userId, check default behavior
      if (!userId) {
        // For broadcast notifications, we might want to send to all users with email enabled
        return process.env.SEND_BROADCAST_EMAILS === "true";
      }

      // Get user preferences
      const preferences = await NotificationPreferences.findOne({
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
      const thresholdLevel = priorityLevels[preferences.priorityThreshold] || 1;
      
      if (notificationLevel < thresholdLevel) {
        return false;
      }

      // Check quiet hours (for non-urgent notifications)
      if (notification.priority !== "urgent" && preferences.quietHours.enabled) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;
        
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
      logger.error("Error checking email preferences:", error);
      return false;
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;