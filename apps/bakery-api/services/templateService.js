const { NotificationTemplate } = require("../models");
const logger = require("../utils/logger");

class TemplateService {
  /**
   * Get a template by key
   * @param {string} key - Template key (e.g., 'order.new')
   * @returns {Promise<NotificationTemplate>}
   */
  async getTemplate(key) {
    try {
      const template = await NotificationTemplate.findOne({
        where: { key, isActive: true },
      });

      if (!template) {
        logger.warn(`Template not found: ${key}`);
        return null;
      }

      return template;
    } catch (error) {
      logger.error(`Error fetching template ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all templates by category
   * @param {string} category - Template category
   * @returns {Promise<Array<NotificationTemplate>>}
   */
  async getTemplatesByCategory(category) {
    try {
      return await NotificationTemplate.findAll({
        where: { category, isActive: true },
        order: [["name", "ASC"]],
      });
    } catch (error) {
      logger.error(`Error fetching templates for category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Render a template with variables
   * @param {string} templateKey - Template key
   * @param {Object} variables - Variables to replace in template
   * @param {string} language - Language code (de/en)
   * @returns {Promise<Object>} Rendered notification data
   */
  async renderTemplate(templateKey, variables = {}, language = "de") {
    try {
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
        title = title.replace(new RegExp(placeholder, 'g'), value);
        message = message.replace(new RegExp(placeholder, 'g'), value);
      }

      // Check for any unreplaced variables
      const unreplacedVars = [];
      const varPattern = /\{\{(\w+)\}\}/g;
      let match;

      while ((match = varPattern.exec(title + " " + message)) !== null) {
        unreplacedVars.push(match[1]);
      }

      if (unreplacedVars.length > 0) {
        logger.warn(`Unreplaced variables in template ${templateKey}: ${unreplacedVars.join(", ")}`);
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
      logger.error(`Error rendering template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Extract category from template key
   * @param {string} key - Template key
   * @returns {string} Category
   */
  getCategoryFromKey(key) {
    const category = key.split('.')[0];
    // Map template category to notification category
    const categoryMap = {
      production: 'system',
      inventory: 'inventory',
      order: 'order',
      staff: 'staff',
      financial: 'system',
      system: 'system',
      customer: 'general',
    };
    return categoryMap[category] || 'general';
  }

  /**
   * Create or update a template
   * @param {Object} templateData - Template data
   * @returns {Promise<NotificationTemplate>}
   */
  async upsertTemplate(templateData) {
    try {
      const { key, ...data } = templateData;

      const [template, created] = await NotificationTemplate.findOrCreate({
        where: { key },
        defaults: data,
      });

      if (!created) {
        await template.update(data);
      }

      logger.info(`Template ${created ? 'created' : 'updated'}: ${key}`);
      return template;
    } catch (error) {
      logger.error("Error upserting template:", error);
      throw error;
    }
  }

  /**
   * Validate template variables
   * @param {string} templateText - Template text with variables
   * @param {Array<string>} declaredVars - Declared variable names
   * @returns {Object} Validation result
   */
  validateTemplateVariables(templateText, declaredVars) {
    const usedVars = [];
    const varPattern = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = varPattern.exec(templateText)) !== null) {
      if (!usedVars.includes(match[1])) {
        usedVars.push(match[1]);
      }
    }

    const undeclaredVars = usedVars.filter(v => !declaredVars.includes(v));
    const unusedVars = declaredVars.filter(v => !usedVars.includes(v));

    return {
      valid: undeclaredVars.length === 0,
      usedVars,
      undeclaredVars,
      unusedVars,
    };
  }

  /**
   * Get all active templates
   * @returns {Promise<Array<NotificationTemplate>>}
   */
  async getAllTemplates() {
    try {
      return await NotificationTemplate.findAll({
        where: { isActive: true },
        order: [["category", "ASC"], ["name", "ASC"]],
      });
    } catch (error) {
      logger.error("Error fetching all templates:", error);
      throw error;
    }
  }

  /**
   * Delete a template
   * @param {string} key - Template key
   * @returns {Promise<boolean>}
   */
  async deleteTemplate(key) {
    try {
      const result = await NotificationTemplate.destroy({
        where: { key },
      });

      if (result > 0) {
        logger.info(`Template deleted: ${key}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting template ${key}:`, error);
      throw error;
    }
  }
}

module.exports = new TemplateService();