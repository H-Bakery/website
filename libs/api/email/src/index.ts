/**
 * Email Domain - Public API
 * Bakery Management System
 */

// Models
export {
  EmailConfig,
  EmailNotification,
  EmailRecipient,
  EmailOptions,
  EmailAttachment,
  EmailResult,
  BulkEmailResult,
  EmailQueueItem,
  EmailQueueStatus,
  EmailTemplate,
  EmailProvider,
  EmailPriority,
  EMAIL_CATEGORY_TRANSLATIONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from './models/email.model';

// Services
export { EmailService, EmailServiceDeps } from './services/email.service';
export { EmailQueueService, EmailQueueServiceDeps } from './services/email-queue.service';

// Controllers
export { EmailController } from './controllers/email.controller';

// Routes
export { createEmailRoutes, EmailRoutesDeps } from './routes/email.routes';

// Validators
export {
  sendTestEmailValidator,
  sendEmailValidator,
  sendBulkEmailsValidator,
  updateQueueConfigValidator,
} from './validators/email.validators';
