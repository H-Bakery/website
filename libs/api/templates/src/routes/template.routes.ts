/**
 * Template Routes - API endpoint definitions
 * Bakery Management System
 */

import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import {
  getTemplatesValidator,
  templateKeyValidator,
  previewTemplateValidator,
  createTemplateValidator,
  updateTemplateValidator,
  validateTemplateValidator,
} from '../validators/template.validators';

export interface TemplateRoutesDeps {
  templateController: TemplateController;
  authMiddleware: any;
  validationMiddleware: any;
}

export function createTemplateRoutes(deps: TemplateRoutesDeps): Router {
  const router = Router();
  const { templateController, authMiddleware, validationMiddleware } = deps;

  /**
   * @route   GET /api/templates
   * @desc    Get all templates with optional category filter
   * @access  Private
   */
  router.get(
    '/',
    authMiddleware,
    getTemplatesValidator,
    validationMiddleware,
    templateController.getTemplates
  );

  /**
   * @route   POST /api/templates/validate
   * @desc    Validate template syntax
   * @access  Private
   */
  router.post(
    '/validate',
    authMiddleware,
    validateTemplateValidator,
    validationMiddleware,
    templateController.validateTemplate
  );

  /**
   * @route   PUT /api/templates/upsert
   * @desc    Create or update a template
   * @access  Private (Admin/Manager)
   */
  router.put(
    '/upsert',
    authMiddleware,
    createTemplateValidator,
    validationMiddleware,
    templateController.upsertTemplate
  );

  /**
   * @route   GET /api/templates/:key
   * @desc    Get a single template by key
   * @access  Private
   */
  router.get(
    '/:key',
    authMiddleware,
    templateKeyValidator,
    validationMiddleware,
    templateController.getTemplate
  );

  /**
   * @route   POST /api/templates/:key/preview
   * @desc    Preview a template with sample data
   * @access  Private
   */
  router.post(
    '/:key/preview',
    authMiddleware,
    previewTemplateValidator,
    validationMiddleware,
    templateController.previewTemplate
  );

  /**
   * @route   POST /api/templates
   * @desc    Create a new template
   * @access  Private (Admin/Manager)
   */
  router.post(
    '/',
    authMiddleware,
    createTemplateValidator,
    validationMiddleware,
    templateController.createTemplate
  );

  /**
   * @route   PUT /api/templates/:key
   * @desc    Update an existing template
   * @access  Private (Admin/Manager)
   */
  router.put(
    '/:key',
    authMiddleware,
    updateTemplateValidator,
    validationMiddleware,
    templateController.updateTemplate
  );

  /**
   * @route   DELETE /api/templates/:key
   * @desc    Delete a template
   * @access  Private (Admin only)
   */
  router.delete(
    '/:key',
    authMiddleware,
    templateKeyValidator,
    validationMiddleware,
    templateController.deleteTemplate
  );

  return router;
}