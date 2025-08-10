/**
 * Preference Controller - HTTP request handling for preferences
 * Bakery Management System
 */

import { Request, Response } from 'express';
import { PreferenceService } from '../services/preference.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class PreferenceController {
  constructor(private preferenceService: PreferenceService) {}

  /**
   * Get user's notification preferences
   * GET /api/preferences
   */
  getPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const preferences = await this.preferenceService.getPreferences(userId);

      res.json({
        success: true,
        preferences: {
          id: preferences.id,
          emailEnabled: preferences.emailEnabled,
          browserEnabled: preferences.browserEnabled,
          soundEnabled: preferences.soundEnabled,
          categoryPreferences: preferences.categoryPreferences,
          priorityThreshold: preferences.priorityThreshold,
          quietHours: preferences.quietHours,
          updatedAt: preferences.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notification preferences',
      });
    }
  };

  /**
   * Update user's notification preferences
   * PUT /api/preferences
   */
  updatePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const preferences = await this.preferenceService.updatePreferences(userId, req.body);

      res.json({
        success: true,
        preferences: {
          id: preferences.id,
          emailEnabled: preferences.emailEnabled,
          browserEnabled: preferences.browserEnabled,
          soundEnabled: preferences.soundEnabled,
          categoryPreferences: preferences.categoryPreferences,
          priorityThreshold: preferences.priorityThreshold,
          quietHours: preferences.quietHours,
          updatedAt: preferences.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notification preferences',
      });
    }
  };

  /**
   * Reset preferences to defaults
   * POST /api/preferences/reset
   */
  resetPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const preferences = await this.preferenceService.resetPreferences(userId);

      res.json({
        success: true,
        message: 'Notification preferences reset to defaults',
        preferences: {
          id: preferences.id,
          emailEnabled: preferences.emailEnabled,
          browserEnabled: preferences.browserEnabled,
          soundEnabled: preferences.soundEnabled,
          categoryPreferences: preferences.categoryPreferences,
          priorityThreshold: preferences.priorityThreshold,
          quietHours: preferences.quietHours,
          updatedAt: preferences.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset notification preferences',
      });
    }
  };

  /**
   * Check quiet hours status
   * GET /api/preferences/quiet-hours
   */
  checkQuietHours = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      const preferences = await this.preferenceService.getPreferences(userId);
      const isQuietHours = this.preferenceService.isWithinQuietHours(preferences);

      res.json({
        success: true,
        quietHours: {
          enabled: preferences.quietHours.enabled,
          currentlyActive: isQuietHours,
          start: preferences.quietHours.start,
          end: preferences.quietHours.end,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check quiet hours status',
      });
    }
  };
}