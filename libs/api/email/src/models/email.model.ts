/**
 * Email Model - Email service types and interfaces
 * Bakery Management System
 */

export type EmailProvider = 'smtp' | 'gmail' | 'sendgrid' | 'aws-ses';
export type EmailPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface EmailConfig {
  provider: EmailProvider;
  from: string;
  fromName: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  apiKey?: string;
  endpoint?: string;
}

export interface EmailNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: EmailPriority;
  type?: string;
  metadata?: Record<string, any>;
}

export interface EmailRecipient {
  email: string;
  userId?: string;
  language?: 'de' | 'en';
  notificationIndex?: number;
}

export interface EmailOptions {
  language?: 'de' | 'en';
  subject?: string;
  attachments?: EmailAttachment[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

export interface EmailQueueItem {
  notification: EmailNotification;
  recipientEmail: string;
  userId?: string | null;
  language: 'de' | 'en';
  attempts: number;
  addedAt: Date;
  priority?: EmailPriority;
}

export interface EmailQueueStatus {
  queueSize: number;
  processing: boolean;
  batchSize: number;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email category translations
export const EMAIL_CATEGORY_TRANSLATIONS = {
  staff: { de: 'Personal', en: 'Staff' },
  order: { de: 'Bestellungen', en: 'Orders' },
  system: { de: 'System', en: 'System' },
  inventory: { de: 'Inventar', en: 'Inventory' },
  production: { de: 'Produktion', en: 'Production' },
  sales: { de: 'Verkauf', en: 'Sales' },
  general: { de: 'Allgemein', en: 'General' },
};

// Priority labels
export const PRIORITY_LABELS = {
  low: { de: 'Niedrig', en: 'Low' },
  medium: { de: 'Mittel', en: 'Medium' },
  high: { de: 'Hoch', en: 'High' },
  urgent: { de: 'Dringend', en: 'Urgent' },
};

// Priority colors for HTML emails
export const PRIORITY_COLORS = {
  low: '#28a745',
  medium: '#ffc107',
  high: '#fd7e14',
  urgent: '#dc3545',
};