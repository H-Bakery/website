/**
 * Preference Routes - API endpoint definitions
 * Bakery Management System
 */

import { Router } from 'express';
import { PreferenceController } from '../controllers/preference.controller';
import { updatePreferencesValidator } from '../validators/preference.validators';

export interface PreferenceRoutesDeps {
  preferenceController: PreferenceController;
  authMiddleware: any;
  validationMiddleware: any;
}

export function createPreferenceRoutes(deps: PreferenceRoutesDeps): Router {
  const router = Router();
  const { preferenceController, authMiddleware, validationMiddleware } = deps;

  /**
   * @route   GET /api/preferences
   * @desc    Get user's notification preferences
   * @access  Private
   */
  router.get('/', authMiddleware, preferenceController.getPreferences);

  /**
   * @route   PUT /api/preferences
   * @desc    Update user's notification preferences
   * @access  Private
   */
  router.put(
    '/',
    authMiddleware,
    updatePreferencesValidator,
    validationMiddleware,
    preferenceController.updatePreferences
  );

  /**
   * @route   POST /api/preferences/reset
   * @desc    Reset preferences to defaults
   * @access  Private
   */
  router.post('/reset', authMiddleware, preferenceController.resetPreferences);

  /**
   * @route   GET /api/preferences/quiet-hours
   * @desc    Check quiet hours status
   * @access  Private
   */
  router.get('/quiet-hours', authMiddleware, preferenceController.checkQuietHours);

  return router;
}