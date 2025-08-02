const cron = require('node-cron');
const { Notification } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Notification Archival Service
 * Provides automated archival policies and cron job management
 */
class NotificationArchivalService {
  constructor() {
    this.isRunning = false;
    this.scheduledTasks = new Map();
    this.defaultPolicies = {
      // Archive notifications older than 30 days
      autoArchiveAfterDays: 30,
      // Permanently delete archived notifications older than 90 days
      permanentDeleteAfterDays: 90,
      // Only archive read notifications automatically
      archiveReadOnly: true,
      // Categories to exclude from auto-archival
      excludeCategories: ['urgent'], // Don't auto-archive urgent notifications
      // Priorities to exclude from auto-archival
      excludePriorities: [], // Can be ['urgent', 'high'] etc.
      // Maximum number of notifications to process per batch
      batchSize: 100,
      // Enable/disable auto-archival
      enabled: true,
    };
    this.currentPolicies = { ...this.defaultPolicies };
  }

  /**
   * Initialize the archival service with custom policies
   */
  initialize(customPolicies = {}) {
    this.currentPolicies = { ...this.defaultPolicies, ...customPolicies };
    
    if (this.currentPolicies.enabled) {
      this.startScheduledTasks();
      logger.info('Notification archival service initialized with policies:', this.currentPolicies);
    } else {
      logger.info('Notification archival service initialized but disabled');
    }
  }

  /**
   * Start all scheduled tasks
   */
  startScheduledTasks() {
    this.stopScheduledTasks(); // Stop any existing tasks first

    // Daily archival job at 2:00 AM
    const archivalTask = cron.schedule('0 2 * * *', async () => {
      await this.runAutoArchival();
    }, {
      scheduled: false,
      timezone: "Europe/Berlin"
    });

    // Weekly cleanup job on Sundays at 3:00 AM
    const cleanupTask = cron.schedule('0 3 * * 0', async () => {
      await this.runCleanup();
    }, {
      scheduled: false,
      timezone: "Europe/Berlin"
    });

    this.scheduledTasks.set('archival', archivalTask);
    this.scheduledTasks.set('cleanup', cleanupTask);

    // Start the tasks
    archivalTask.start();
    cleanupTask.start();

    this.isRunning = true;
    logger.info('Notification archival cron jobs started');
  }

  /**
   * Stop all scheduled tasks
   */
  stopScheduledTasks() {
    for (const [name, task] of this.scheduledTasks) {
      if (task && typeof task.stop === 'function') {
        task.stop();
        logger.info(`Stopped ${name} cron job`);
      }
    }
    this.scheduledTasks.clear();
    this.isRunning = false;
  }

  /**
   * Update archival policies
   */
  updatePolicies(newPolicies) {
    const oldEnabled = this.currentPolicies.enabled;
    this.currentPolicies = { ...this.currentPolicies, ...newPolicies };
    
    logger.info('Archival policies updated:', this.currentPolicies);

    // Restart tasks if enabled status changed
    if (oldEnabled !== this.currentPolicies.enabled) {
      if (this.currentPolicies.enabled) {
        this.startScheduledTasks();
      } else {
        this.stopScheduledTasks();
      }
    }
  }

  /**
   * Get current archival policies
   */
  getPolicies() {
    return { ...this.currentPolicies };
  }

  /**
   * Run automatic archival based on current policies
   */
  async runAutoArchival() {
    if (!this.currentPolicies.enabled) {
      logger.info('Auto-archival is disabled, skipping');
      return { archived: 0, skipped: true };
    }

    const startTime = Date.now();
    logger.info('Starting automatic notification archival...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.currentPolicies.autoArchiveAfterDays);

      // Build where conditions
      const whereConditions = {
        archived: false,
        deletedAt: null,
        createdAt: {
          [Op.lt]: cutoffDate
        }
      };

      // Only archive read notifications if policy is set
      if (this.currentPolicies.archiveReadOnly) {
        whereConditions.read = true;
      }

      // Exclude certain categories
      if (this.currentPolicies.excludeCategories.length > 0) {
        whereConditions.category = {
          [Op.notIn]: this.currentPolicies.excludeCategories
        };
      }

      // Exclude certain priorities
      if (this.currentPolicies.excludePriorities.length > 0) {
        whereConditions.priority = {
          [Op.notIn]: this.currentPolicies.excludePriorities
        };
      }

      // Get notifications to archive in batches
      let totalArchived = 0;
      let hasMore = true;

      while (hasMore) {
        const notifications = await Notification.findAll({
          where: whereConditions,
          limit: this.currentPolicies.batchSize,
          order: [['createdAt', 'ASC']]
        });

        if (notifications.length === 0) {
          hasMore = false;
          break;
        }

        // Archive this batch
        const notificationIds = notifications.map(n => n.id);
        
        const [affectedRows] = await Notification.update(
          {
            archived: true,
            archivedAt: new Date()
          },
          {
            where: {
              id: {
                [Op.in]: notificationIds
              }
            }
          }
        );

        totalArchived += affectedRows;
        
        logger.info(`Archived ${affectedRows} notifications (batch ${Math.ceil(totalArchived / this.currentPolicies.batchSize)})`);

        // If we got fewer notifications than the batch size, we're done
        if (notifications.length < this.currentPolicies.batchSize) {
          hasMore = false;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Auto-archival completed: ${totalArchived} notifications archived in ${duration}ms`);

      return {
        archived: totalArchived,
        duration,
        policies: this.currentPolicies
      };

    } catch (error) {
      logger.error('Error during auto-archival:', error);
      throw error;
    }
  }

  /**
   * Run cleanup of old archived notifications (permanent deletion)
   */
  async runCleanup() {
    if (!this.currentPolicies.enabled) {
      logger.info('Auto-cleanup is disabled, skipping');
      return { deleted: 0, skipped: true };
    }

    const startTime = Date.now();
    logger.info('Starting automatic notification cleanup...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.currentPolicies.permanentDeleteAfterDays);

      // Find archived notifications older than the cutoff
      const whereConditions = {
        archived: true,
        deletedAt: null,
        archivedAt: {
          [Op.lt]: cutoffDate
        }
      };

      // Soft delete (set deletedAt timestamp)
      const [affectedRows] = await Notification.update(
        {
          deletedAt: new Date()
        },
        {
          where: whereConditions
        }
      );

      const duration = Date.now() - startTime;
      logger.info(`Auto-cleanup completed: ${affectedRows} notifications marked for deletion in ${duration}ms`);

      return {
        deleted: affectedRows,
        duration,
        policies: this.currentPolicies
      };

    } catch (error) {
      logger.error('Error during auto-cleanup:', error);
      throw error;
    }
  }

  /**
   * Get archival statistics
   */
  async getArchivalStats() {
    try {
      const [
        totalNotifications,
        archivedNotifications,
        deletedNotifications,
        eligibleForArchival,
        eligibleForCleanup
      ] = await Promise.all([
        // Total active notifications
        Notification.count({
          where: {
            archived: false,
            deletedAt: null
          }
        }),
        
        // Total archived notifications
        Notification.count({
          where: {
            archived: true,
            deletedAt: null
          }
        }),
        
        // Total deleted notifications
        Notification.count({
          where: {
            deletedAt: {
              [Op.ne]: null
            }
          }
        }),
        
        // Notifications eligible for archival
        this.getEligibleForArchival(),
        
        // Archived notifications eligible for cleanup
        this.getEligibleForCleanup()
      ]);

      return {
        total: totalNotifications,
        archived: archivedNotifications,
        deleted: deletedNotifications,
        eligibleForArchival,
        eligibleForCleanup,
        policies: this.currentPolicies,
        isRunning: this.isRunning
      };

    } catch (error) {
      logger.error('Error getting archival stats:', error);
      throw error;
    }
  }

  /**
   * Get count of notifications eligible for archival
   */
  async getEligibleForArchival() {
    if (!this.currentPolicies.enabled) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.currentPolicies.autoArchiveAfterDays);

    const whereConditions = {
      archived: false,
      deletedAt: null,
      createdAt: {
        [Op.lt]: cutoffDate
      }
    };

    if (this.currentPolicies.archiveReadOnly) {
      whereConditions.read = true;
    }

    if (this.currentPolicies.excludeCategories.length > 0) {
      whereConditions.category = {
        [Op.notIn]: this.currentPolicies.excludeCategories
      };
    }

    if (this.currentPolicies.excludePriorities.length > 0) {
      whereConditions.priority = {
        [Op.notIn]: this.currentPolicies.excludePriorities
      };
    }

    return await Notification.count({ where: whereConditions });
  }

  /**
   * Get count of archived notifications eligible for cleanup
   */
  async getEligibleForCleanup() {
    if (!this.currentPolicies.enabled) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.currentPolicies.permanentDeleteAfterDays);

    return await Notification.count({
      where: {
        archived: true,
        deletedAt: null,
        archivedAt: {
          [Op.lt]: cutoffDate
        }
      }
    });
  }

  /**
   * Manually trigger archival (for testing or immediate execution)
   */
  async triggerArchival() {
    logger.info('Manual archival triggered');
    return await this.runAutoArchival();
  }

  /**
   * Manually trigger cleanup (for testing or immediate execution)  
   */
  async triggerCleanup() {
    logger.info('Manual cleanup triggered');
    return await this.runCleanup();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
      policies: this.currentPolicies
    };
  }
}

// Export singleton instance
const notificationArchivalService = new NotificationArchivalService();

module.exports = notificationArchivalService;