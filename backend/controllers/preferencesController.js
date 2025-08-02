const { NotificationPreferences, User } = require("../models");
const logger = require("../utils/logger");

// Default preference values
const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  browserEnabled: true,
  soundEnabled: true,
  categoryPreferences: {
    staff: true,
    order: true,
    system: true,
    inventory: true,
    general: true,
  },
  priorityThreshold: "low",
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00",
  },
};

// Get user's notification preferences
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    // Try to find existing preferences
    let preferences = await NotificationPreferences.findOne({
      where: { userId },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await NotificationPreferences.create({
        userId,
        ...DEFAULT_PREFERENCES,
      });
      logger.info(`Created default notification preferences for user ${userId}`);
    }

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
    logger.error("Error fetching notification preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification preferences",
    });
  }
};

// Update user's notification preferences
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      emailEnabled,
      browserEnabled,
      soundEnabled,
      categoryPreferences,
      priorityThreshold,
      quietHours,
    } = req.body;

    // Find or create preferences
    let preferences = await NotificationPreferences.findOne({
      where: { userId },
    });

    if (!preferences) {
      preferences = await NotificationPreferences.create({
        userId,
        ...DEFAULT_PREFERENCES,
      });
    }

    // Update preferences with provided values
    const updates = {};

    if (typeof emailEnabled === "boolean") {
      updates.emailEnabled = emailEnabled;
    }

    if (typeof browserEnabled === "boolean") {
      updates.browserEnabled = browserEnabled;
    }

    if (typeof soundEnabled === "boolean") {
      updates.soundEnabled = soundEnabled;
    }

    if (categoryPreferences && typeof categoryPreferences === "object") {
      // Validate category preferences
      const validCategories = ["staff", "order", "system", "inventory", "general"];
      const newCategoryPrefs = { ...preferences.categoryPreferences };

      for (const category of validCategories) {
        if (typeof categoryPreferences[category] === "boolean") {
          newCategoryPrefs[category] = categoryPreferences[category];
        }
      }

      updates.categoryPreferences = newCategoryPrefs;
    }

    if (priorityThreshold && ["low", "medium", "high", "urgent"].includes(priorityThreshold)) {
      updates.priorityThreshold = priorityThreshold;
    }

    if (quietHours && typeof quietHours === "object") {
      const newQuietHours = { ...preferences.quietHours };

      if (typeof quietHours.enabled === "boolean") {
        newQuietHours.enabled = quietHours.enabled;
      }

      if (quietHours.start && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.start)) {
        newQuietHours.start = quietHours.start;
      }

      if (quietHours.end && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(quietHours.end)) {
        newQuietHours.end = quietHours.end;
      }

      updates.quietHours = newQuietHours;
    }

    // Apply updates
    await preferences.update(updates);

    logger.info(`Updated notification preferences for user ${userId}`);

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
    logger.error("Error updating notification preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update notification preferences",
    });
  }
};

// Reset preferences to defaults
exports.resetPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find existing preferences
    let preferences = await NotificationPreferences.findOne({
      where: { userId },
    });

    if (!preferences) {
      // Create new preferences with defaults
      preferences = await NotificationPreferences.create({
        userId,
        ...DEFAULT_PREFERENCES,
      });
    } else {
      // Reset to defaults
      await preferences.update(DEFAULT_PREFERENCES);
    }

    logger.info(`Reset notification preferences to defaults for user ${userId}`);

    res.json({
      success: true,
      message: "Notification preferences reset to defaults",
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
    logger.error("Error resetting notification preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset notification preferences",
    });
  }
};