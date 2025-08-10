/**
 * Template Service - Business logic for notification templates
 * Bakery Management System
 */

import {
  NotificationTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  RenderTemplateInput,
  RenderedTemplate,
  TemplateValidationResult,
  CATEGORY_MAP,
  VARIABLE_REGEX,
  TemplateCategory,
} from '../models/template.model';

export interface TemplateServiceDeps {
  NotificationTemplate: any; // Sequelize model
  logger: any;
}

export class TemplateService {
  private NotificationTemplate: any;
  private logger: any;

  constructor(deps: TemplateServiceDeps) {
    this.NotificationTemplate = deps.NotificationTemplate;
    this.logger = deps.logger;
  }

  /**
   * Get a template by key
   */
  async getTemplate(key: string): Promise<NotificationTemplate | null> {
    try {
      const template = await this.NotificationTemplate.findOne({
        where: { key, isActive: true },
      });

      if (!template) {
        this.logger.warn(`Template not found: ${key}`);
        return null;
      }

      return this.mapToNotificationTemplate(template);
    } catch (error) {
      this.logger.error(`Error fetching template ${key}:`, error);
      throw new Error(`Failed to fetch template: ${key}`);
    }
  }

  /**
   * Get all templates by category
   */
  async getTemplatesByCategory(category: TemplateCategory): Promise<NotificationTemplate[]> {
    try {
      const templates = await this.NotificationTemplate.findAll({
        where: { category, isActive: true },
        order: [['name', 'ASC']],
      });

      return templates.map((t: any) => this.mapToNotificationTemplate(t));
    } catch (error) {
      this.logger.error(`Error fetching templates for category ${category}:`, error);
      throw new Error(`Failed to fetch templates for category: ${category}`);
    }
  }

  /**
   * Get all active templates
   */
  async getAllTemplates(): Promise<NotificationTemplate[]> {
    try {
      const templates = await this.NotificationTemplate.findAll({
        where: { isActive: true },
        order: [['category', 'ASC'], ['name', 'ASC']],
      });

      return templates.map((t: any) => this.mapToNotificationTemplate(t));
    } catch (error) {
      this.logger.error('Error fetching all templates:', error);
      throw new Error('Failed to fetch templates');
    }
  }

  /**
   * Render a template with variables
   */
  async renderTemplate(input: RenderTemplateInput): Promise<RenderedTemplate> {
    try {
      const { templateKey, variables = {}, language = 'de' } = input;
      const template = await this.getTemplate(templateKey);

      if (!template) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      // Get the title and message for the specified language
      let title = template.defaultTitle[language] || template.defaultTitle.de;
      let message = template.defaultMessage[language] || template.defaultMessage.de;

      // Replace variables in title and message
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), String(value));
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      }

      // Check for any unreplaced variables
      const unreplacedVars: string[] = [];
      let match;

      VARIABLE_REGEX.lastIndex = 0;
      while ((match = VARIABLE_REGEX.exec(title + ' ' + message)) !== null) {
        if (!unreplacedVars.includes(match[1])) {
          unreplacedVars.push(match[1]);
        }
      }

      if (unreplacedVars.length > 0) {
        this.logger.warn(
          `Unreplaced variables in template ${templateKey}: ${unreplacedVars.join(', ')}`
        );
      }

      return {
        title,
        message,
        type: template.defaultType,
        priority: template.defaultPriority,
        category: this.getCategoryFromKey(templateKey),
        metadata: {
          ...variables,
          templateKey,
          language,
        },
      };
    } catch (error) {
      this.logger.error(`Error rendering template ${input.templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<NotificationTemplate> {
    try {
      // Check if template with key already exists
      const existing = await this.NotificationTemplate.findOne({
        where: { key: input.key },
      });

      if (existing) {
        throw new Error(`Template with key '${input.key}' already exists`);
      }

      // Validate template variables
      const titleValidation = this.validateTemplateVariables(
        input.defaultTitle.de + ' ' + input.defaultTitle.en,
        input.variables || []
      );

      const messageValidation = this.validateTemplateVariables(
        input.defaultMessage.de + ' ' + input.defaultMessage.en,
        input.variables || []
      );

      if (!titleValidation.valid || !messageValidation.valid) {
        throw new Error('Template validation failed: undeclared variables found');
      }

      const template = await this.NotificationTemplate.create({
        ...input,
        isActive: input.isActive !== undefined ? input.isActive : true,
        defaultPriority: input.defaultPriority || 'medium',
        defaultType: input.defaultType || 'info',
      });

      this.logger.info(`Template created: ${input.key}`);
      return this.mapToNotificationTemplate(template);
    } catch (error) {
      this.logger.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(key: string, input: UpdateTemplateInput): Promise<NotificationTemplate> {
    try {
      const template = await this.NotificationTemplate.findOne({
        where: { key },
      });

      if (!template) {
        throw new Error(`Template not found: ${key}`);
      }

      // If variables are being updated, validate the templates
      if (input.defaultTitle || input.defaultMessage || input.variables) {
        const title = input.defaultTitle
          ? input.defaultTitle.de + ' ' + input.defaultTitle.en
          : template.defaultTitle.de + ' ' + template.defaultTitle.en;

        const message = input.defaultMessage
          ? input.defaultMessage.de + ' ' + input.defaultMessage.en
          : template.defaultMessage.de + ' ' + template.defaultMessage.en;

        const variables = input.variables || template.variables || [];

        const titleValidation = this.validateTemplateVariables(title, variables);
        const messageValidation = this.validateTemplateVariables(message, variables);

        if (!titleValidation.valid || !messageValidation.valid) {
          throw new Error('Template validation failed: undeclared variables found');
        }
      }

      await template.update(input);

      this.logger.info(`Template updated: ${key}`);
      return this.mapToNotificationTemplate(template);
    } catch (error) {
      this.logger.error(`Error updating template ${key}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a template
   */
  async upsertTemplate(input: CreateTemplateInput): Promise<NotificationTemplate> {
    try {
      const { key, ...data } = input;

      // Validate template variables
      const titleValidation = this.validateTemplateVariables(
        input.defaultTitle.de + ' ' + input.defaultTitle.en,
        input.variables || []
      );

      const messageValidation = this.validateTemplateVariables(
        input.defaultMessage.de + ' ' + input.defaultMessage.en,
        input.variables || []
      );

      if (!titleValidation.valid || !messageValidation.valid) {
        throw new Error('Template validation failed: undeclared variables found');
      }

      const [template, created] = await this.NotificationTemplate.findOrCreate({
        where: { key },
        defaults: {
          ...data,
          isActive: data.isActive !== undefined ? data.isActive : true,
          defaultPriority: data.defaultPriority || 'medium',
          defaultType: data.defaultType || 'info',
        },
      });

      if (!created) {
        await template.update(data);
      }

      this.logger.info(`Template ${created ? 'created' : 'updated'}: ${key}`);
      return this.mapToNotificationTemplate(template);
    } catch (error) {
      this.logger.error('Error upserting template:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(key: string): Promise<boolean> {
    try {
      const result = await this.NotificationTemplate.destroy({
        where: { key },
      });

      if (result > 0) {
        this.logger.info(`Template deleted: ${key}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error deleting template ${key}:`, error);
      throw new Error(`Failed to delete template: ${key}`);
    }
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(
    templateText: string,
    declaredVars: string[]
  ): TemplateValidationResult {
    const usedVars: string[] = [];
    let match;

    VARIABLE_REGEX.lastIndex = 0;
    while ((match = VARIABLE_REGEX.exec(templateText)) !== null) {
      if (!usedVars.includes(match[1])) {
        usedVars.push(match[1]);
      }
    }

    const undeclaredVars = usedVars.filter((v) => !declaredVars.includes(v));
    const unusedVars = declaredVars.filter((v) => !usedVars.includes(v));

    return {
      valid: undeclaredVars.length === 0,
      usedVars,
      undeclaredVars,
      unusedVars,
    };
  }

  /**
   * Extract category from template key
   */
  private getCategoryFromKey(key: string): string {
    const category = key.split('.')[0] as TemplateCategory;
    return CATEGORY_MAP[category] || 'general';
  }

  /**
   * Map database model to domain model
   */
  private mapToNotificationTemplate(dbTemplate: any): NotificationTemplate {
    return {
      id: dbTemplate.id,
      key: dbTemplate.key,
      name: dbTemplate.name,
      category: dbTemplate.category,
      defaultTitle: dbTemplate.defaultTitle,
      defaultMessage: dbTemplate.defaultMessage,
      variables: dbTemplate.variables || [],
      defaultPriority: dbTemplate.defaultPriority,
      defaultType: dbTemplate.defaultType,
      isActive: dbTemplate.isActive,
      metadata: dbTemplate.metadata,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt,
    };
  }
}