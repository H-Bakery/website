/**
 * Email Routes - Local route setup
 * Integrates email domain with the main application
 */

import { Router } from 'express'
import {
  EmailService,
  EmailQueueService,
  EmailController,
  createEmailRoutes,
} from '@bakery/api/email'
import { authMiddleware } from '@bakery/api/auth'
import { validationMiddleware } from '../middleware/validation.middleware'

export default function setupEmailRoutes(dependencies: {
  logger: any
  templateService?: any
  NotificationPreferences?: any
}): Router {
  // Create services with dependencies
  const emailService = new EmailService({
    logger: dependencies.logger,
    templateService: dependencies.templateService,
    NotificationPreferences: dependencies.NotificationPreferences,
  })

  const emailQueueService = new EmailQueueService({
    emailService,
    logger: dependencies.logger,
  })

  // Create controller
  const emailController = new EmailController(emailService, emailQueueService)

  // Create routes
  return createEmailRoutes({
    emailController,
    authMiddleware,
    validationMiddleware,
  })
}
