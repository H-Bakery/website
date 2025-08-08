/**
 * Preference Service - Business logic for notification preferences
 * Bakery Management System
 */

import {
  NotificationPreference,
  CreateNotificationPreferenceInput,
  UpdateNotificationPreferenceInput,
  DEFAULT_PREFERENCES,
  NotificationCategoryPreferences,
  QuietHoursConfig,
  TIME_REGEX,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
} from '../models/preference.model';

export interface PreferenceServiceDeps {
  NotificationPreferences: any; // Sequelize model
  logger: any;
}

export class PreferenceService {
  private NotificationPreferences: any;
  private logger: any;

  constructor(deps: PreferenceServiceDeps) {
    this.NotificationPreferences = deps.NotificationPreferences;
    this.logger = deps.logger;
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreference> {
    try {
      // Try to find existing preferences
      let preferences = await this.NotificationPreferences.findOne({
        where: { userId },
      });

      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await this.NotificationPreferences.create({
          userId,
          ...DEFAULT_PREFERENCES,
        });
        this.logger.info(`Created default notification preferences for user ${userId}`);
      }

      return this.mapToNotificationPreference(preferences);
    } catch (error) {
      this.logger.error('Error fetching notification preferences:', error);
      throw new Error('Failed to fetch notification preferences');
    }
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferenceInput
  ): Promise<NotificationPreference> {
    try {
      // Find or create preferences
      let preferences = await this.NotificationPreferences.findOne({
        where: { userId },
      });

      if (!preferences) {
        preferences = await this.NotificationPreferences.create({
          userId,
          ...DEFAULT_PREFERENCES,
        });
      }

      // Build update object
      const updates: any = {};

      // Update boolean flags
      if (typeof input.emailEnabled === 'boolean') {
        updates.emailEnabled = input.emailEnabled;
      }

      if (typeof input.browserEnabled === 'boolean') {
        updates.browserEnabled = input.browserEnabled;
      }

      if (typeof input.soundEnabled === 'boolean') {
        updates.soundEnabled = input.soundEnabled;
      }

      // Update category preferences
      if (input.categoryPreferences && typeof input.categoryPreferences === 'object') {
        const newCategoryPrefs = { ...preferences.categoryPreferences };

        for (const category of VALID_CATEGORIES) {
          if (typeof input.categoryPreferences[category] === 'boolean') {
            newCategoryPrefs[category] = input.categoryPreferences[category];
          }
        }

        updates.categoryPreferences = newCategoryPrefs;
      }

      // Update priority threshold
      if (input.priorityThreshold && VALID_PRIORITIES.includes(input.priorityThreshold)) {
        updates.priorityThreshold = input.priorityThreshold;
      }

      // Update quiet hours
      if (input.quietHours && typeof input.quietHours === 'object') {
        updates.quietHours = this.validateQuietHours(
          input.quietHours,
          preferences.quietHours
        );
      }

      // Apply updates
      await preferences.update(updates);

      this.logger.info(`Updated notification preferences for user ${userId}`);

      return this.mapToNotificationPreference(preferences);
    } catch (error) {
      this.logger.error('Error updating notification preferences:', error);
      throw new Error('Failed to update notification preferences');
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<NotificationPreference> {
    try {
      // Find existing preferences
      let preferences = await this.NotificationPreferences.findOne({
        where: { userId },
      });

      if (!preferences) {
        // Create new preferences with defaults
        preferences = await this.NotificationPreferences.create({
          userId,
          ...DEFAULT_PREFERENCES,
        });
      } else {
        // Reset to defaults
        await preferences.update(DEFAULT_PREFERENCES);
      }

      this.logger.info(`Reset notification preferences to defaults for user ${userId}`);

      return this.mapToNotificationPreference(preferences);
    } catch (error) {
      this.logger.error('Error resetting notification preferences:', error);
      throw new Error('Failed to reset notification preferences');
    }
  }

  /**
   * Check if notifications should be sent based on quiet hours
   */
  isWithinQuietHours(preferences: NotificationPreference): boolean {
    if (!preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    const { start, end } = preferences.quietHours;

    // Handle quiet hours that span midnight
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }

    return currentTime >= start && currentTime <= end;
  }

  /**
   * Check if a specific category is enabled
   */
  isCategoryEnabled(
    preferences: NotificationPreference,
    category: keyof NotificationCategoryPreferences
  ): boolean {
    return preferences.categoryPreferences[category] || false;
  }

  /**
   * Validate and merge quiet hours configuration
   */
  private validateQuietHours(
    input: Partial<QuietHoursConfig>,
    existing: QuietHoursConfig
  ): QuietHoursConfig {
    const newQuietHours = { ...existing };

    if (typeof input.enabled === 'boolean') {
      newQuietHours.enabled = input.enabled;
    }

    if (input.start && TIME_REGEX.test(input.start)) {
      newQuietHours.start = input.start;
    }

    if (input.end && TIME_REGEX.test(input.end)) {
      newQuietHours.end = input.end;
    }

    return newQuietHours;
  }

  /**
   * Map database model to domain model
   */
  private mapToNotificationPreference(dbPreference: any): NotificationPreference {
    return {
      id: dbPreference.id,
      userId: dbPreference.userId,
      emailEnabled: dbPreference.emailEnabled,
      browserEnabled: dbPreference.browserEnabled,
      soundEnabled: dbPreference.soundEnabled,
      categoryPreferences: dbPreference.categoryPreferences,
      priorityThreshold: dbPreference.priorityThreshold,
      quietHours: dbPreference.quietHours,
      createdAt: dbPreference.createdAt,
      updatedAt: dbPreference.updatedAt,
    };
  }
}