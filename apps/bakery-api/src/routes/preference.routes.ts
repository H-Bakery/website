/**
 * Preference Routes - Local route setup
 * Integrates preferences domain with the main application
 */

import { Router } from 'express'
import {
  PreferenceService,
  PreferenceController,
  createPreferenceRoutes,
} from '@bakery/api/preferences'
import authMiddleware from '../../middleware/authMiddleware'
import { validationMiddleware } from '../middleware/validation.middleware'

export default function setupPreferenceRoutes(dependencies: {
  NotificationPreferences: any
  logger: any
}): Router {
  // Create service with dependencies
  const preferenceService = new PreferenceService({
    NotificationPreferences: dependencies.NotificationPreferences,
    logger: dependencies.logger,
  })

  // Create controller
  const preferenceController = new PreferenceController(preferenceService)

  // Create routes
  return createPreferenceRoutes({
    preferenceController,
    authMiddleware,
    validationMiddleware,
  })
}
