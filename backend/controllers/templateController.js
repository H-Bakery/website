const templateService = require("../services/templateService");
const logger = require("../utils/logger");

// Get all templates
exports.getTemplates = async (req, res) => {
  try {
    const { category } = req.query;

    let templates;
    if (category) {
      templates = await templateService.getTemplatesByCategory(category);
    } else {
      templates = await templateService.getAllTemplates();
    }

    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    logger.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch templates",
    });
  }
};

// Get a single template by key
exports.getTemplate = async (req, res) => {
  try {
    const { key } = req.params;

    const template = await templateService.getTemplate(key);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error("Error fetching template:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch template",
    });
  }
};

// Preview a template with sample data
exports.previewTemplate = async (req, res) => {
  try {
    const { key } = req.params;
    const { variables = {}, language = "de" } = req.body;

    const rendered = await templateService.renderTemplate(key, variables, language);

    res.json({
      success: true,
      preview: rendered,
    });
  } catch (error) {
    logger.error("Error previewing template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to preview template",
    });
  }
};

// Create or update a template
exports.upsertTemplate = async (req, res) => {
  try {
    const {
      key,
      name,
      category,
      defaultTitle,
      defaultMessage,
      variables,
      defaultPriority,
      defaultType,
      isActive,
      metadata,
    } = req.body;

    // Validate required fields
    if (!key || !name || !category || !defaultTitle || !defaultMessage) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Validate template variables
    const titleValidation = templateService.validateTemplateVariables(
      defaultTitle.de + " " + defaultTitle.en,
      variables || []
    );

    const messageValidation = templateService.validateTemplateVariables(
      defaultMessage.de + " " + defaultMessage.en,
      variables || []
    );

    if (!titleValidation.valid || !messageValidation.valid) {
      return res.status(400).json({
        success: false,
        error: "Template validation failed",
        validation: {
          title: titleValidation,
          message: messageValidation,
        },
      });
    }

    const template = await templateService.upsertTemplate({
      key,
      name,
      category,
      defaultTitle,
      defaultMessage,
      variables,
      defaultPriority,
      defaultType,
      isActive: isActive !== undefined ? isActive : true,
      metadata,
    });

    res.json({
      success: true,
      template,
      message: template.isNewRecord ? "Template created" : "Template updated",
    });
  } catch (error) {
    logger.error("Error upserting template:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save template",
    });
  }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
  try {
    const { key } = req.params;

    const deleted = await templateService.deleteTemplate(key);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete template",
    });
  }
};

// Validate template syntax
exports.validateTemplate = async (req, res) => {
  try {
    const { title, message, variables = [] } = req.body;

    const titleValidation = templateService.validateTemplateVariables(title, variables);
    const messageValidation = templateService.validateTemplateVariables(message, variables);

    const valid = titleValidation.valid && messageValidation.valid;

    res.json({
      success: true,
      valid,
      validation: {
        title: titleValidation,
        message: messageValidation,
      },
    });
  } catch (error) {
    logger.error("Error validating template:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate template",
    });
  }
};