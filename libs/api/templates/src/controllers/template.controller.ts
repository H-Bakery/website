/**
 * Template Controller - HTTP request handling for templates
 * Bakery Management System
 */

import { Request, Response } from 'express';
import { TemplateService } from '../services/template.service';
import { TemplateCategory } from '../models/template.model';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class TemplateController {
  constructor(private templateService: TemplateService) {}

  /**
   * Get all templates
   * GET /api/templates
   */
  getTemplates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { category } = req.query;

      let templates;
      if (category) {
        templates = await this.templateService.getTemplatesByCategory(category as TemplateCategory);
      } else {
        templates = await this.templateService.getAllTemplates();
      }

      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      });
    }
  };

  /**
   * Get a single template by key
   * GET /api/templates/:key
   */
  getTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { key } = req.params;

      const template = await this.templateService.getTemplate(key);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        template,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      });
    }
  };

  /**
   * Preview a template with sample data
   * POST /api/templates/:key/preview
   */
  previewTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const { variables = {}, language = 'de' } = req.body;

      const rendered = await this.templateService.renderTemplate({
        templateKey: key,
        variables,
        language: language as 'de' | 'en',
      });

      res.json({
        success: true,
        preview: rendered,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to preview template',
      });
    }
  };

  /**
   * Create a new template
   * POST /api/templates
   */
  createTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const template = await this.templateService.createTemplate(req.body);

      res.status(201).json({
        success: true,
        template,
        message: 'Template created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      });
    }
  };

  /**
   * Update an existing template
   * PUT /api/templates/:key
   */
  updateTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const { key } = req.params;

      const template = await this.templateService.updateTemplate(key, req.body);

      res.json({
        success: true,
        template,
        message: 'Template updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  };

  /**
   * Create or update a template
   * PUT /api/templates/upsert
   */
  upsertTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const template = await this.templateService.upsertTemplate(req.body);

      res.json({
        success: true,
        template,
        message: 'Template saved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save template',
      });
    }
  };

  /**
   * Delete a template
   * DELETE /api/templates/:key
   */
  deleteTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      const { key } = req.params;

      const deleted = await this.templateService.deleteTemplate(key);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      });
    }
  };

  /**
   * Validate template syntax
   * POST /api/templates/validate
   */
  validateTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, message, variables = [] } = req.body;

      const titleValidation = this.templateService.validateTemplateVariables(title, variables);
      const messageValidation = this.templateService.validateTemplateVariables(message, variables);

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
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate template',
      });
    }
  };
}