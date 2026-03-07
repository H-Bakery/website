/**
 * Template Routes - Local route setup
 * Integrates templates domain with the main application
 */

import { Router } from 'express'
import {
  TemplateService,
  TemplateController,
  createTemplateRoutes,
} from '@bakery/api/templates'
import authMiddleware from '../../middleware/authMiddleware'
import { validationMiddleware } from '../middleware/validation.middleware'

export default function setupTemplateRoutes(dependencies: {
  NotificationTemplate: any
  logger: any
}): Router {
  // Create service with dependencies
  const templateService = new TemplateService({
    NotificationTemplate: dependencies.NotificationTemplate,
    logger: dependencies.logger,
  })

  // Create controller
  const templateController = new TemplateController(templateService)

  // Create routes
  return createTemplateRoutes({
    templateController,
    authMiddleware,
    validationMiddleware,
  })
}
