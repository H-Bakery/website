/**
 * Template Model - Notification templates
 * Bakery Management System
 */

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type TemplateCategory = 'production' | 'inventory' | 'order' | 'staff' | 'financial' | 'system' | 'customer';

export interface LocalizedText {
  de: string;
  en: string;
}

export interface NotificationTemplate {
  id: string;
  key: string; // e.g., 'order.new', 'inventory.low'
  name: string;
  category: TemplateCategory;
  defaultTitle: LocalizedText;
  defaultMessage: LocalizedText;
  variables: string[]; // e.g., ['orderId', 'customerName', 'total']
  defaultPriority: NotificationPriority;
  defaultType: NotificationType;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  key: string;
  name: string;
  category: TemplateCategory;
  defaultTitle: LocalizedText;
  defaultMessage: LocalizedText;
  variables?: string[];
  defaultPriority?: NotificationPriority;
  defaultType?: NotificationType;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  defaultTitle?: LocalizedText;
  defaultMessage?: LocalizedText;
  variables?: string[];
  defaultPriority?: NotificationPriority;
  defaultType?: NotificationType;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface RenderTemplateInput {
  templateKey: string;
  variables: Record<string, any>;
  language?: 'de' | 'en';
}

export interface RenderedTemplate {
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: string;
  metadata: Record<string, any>;
}

export interface TemplateValidationResult {
  valid: boolean;
  usedVars: string[];
  undeclaredVars: string[];
  unusedVars: string[];
}

// Template category to notification category mapping
export const CATEGORY_MAP: Record<TemplateCategory, string> = {
  production: 'system',
  inventory: 'inventory',
  order: 'order',
  staff: 'staff',
  financial: 'system',
  system: 'system',
  customer: 'general',
};

// Variable placeholder regex
export const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;