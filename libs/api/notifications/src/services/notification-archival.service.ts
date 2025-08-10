/**
 * Notification Archival Service - Automated archival policies and cron job management
 * Bakery Management System
 */

import * as cron from 'node-cron';
import { Op } from 'sequelize';
import {
  ArchivalPolicy,
  ArchivalStats,
  ArchivalResult,
  ArchivalScheduleStatus,
  DEFAULT_ARCHIVAL_POLICIES,
  ARCHIVAL_SCHEDULES,
} from '../models/notification-archival.model';

export interface NotificationArchivalServiceDeps {
  Notification: any; // Sequelize model
  logger: any;
}

export class NotificationArchivalService {
  private isRunning = false;
  private scheduledTasks = new Map<string, cron.ScheduledTask>();
  private defaultPolicies: ArchivalPolicy = DEFAULT_ARCHIVAL_POLICIES;
  private currentPolicies: ArchivalPolicy;
  
  private Notification: any;
  private logger: any;

  constructor(deps: NotificationArchivalServiceDeps) {
    this.Notification = deps.Notification;
    this.logger = deps.logger;
    this.currentPolicies = { ...this.defaultPolicies };
  }

  /**
   * Initialize the archival service with custom policies
   */
  initialize(customPolicies: Partial<ArchivalPolicy> = {}): void {
    this.currentPolicies = { ...this.defaultPolicies, ...customPolicies };

    if (this.currentPolicies.enabled) {
      this.startScheduledTasks();
      this.logger.info(
        'Notification archival service initialized with policies:',
        this.currentPolicies
      );
    } else {
      this.logger.info('Notification archival service initialized but disabled');
    }
  }

  /**
   * Start all scheduled tasks
   */
  startScheduledTasks(): void {
    this.stopScheduledTasks(); // Stop any existing tasks first

    // Daily archival job at 2:00 AM
    const archivalTask = cron.schedule(
      ARCHIVAL_SCHEDULES.daily,
      async () => {
        await this.runAutoArchival();
      },
      {
        scheduled: false,
        timezone: 'Europe/Berlin',
      }
    );

    // Weekly cleanup job on Sundays at 3:00 AM
    const cleanupTask = cron.schedule(
      ARCHIVAL_SCHEDULES.weekly,
      async () => {
        await this.runCleanup();
      },
      {
        scheduled: false,
        timezone: 'Europe/Berlin',
      }
    );

    this.scheduledTasks.set('archival', archivalTask);
    this.scheduledTasks.set('cleanup', cleanupTask);

    // Start the tasks
    archivalTask.start();
    cleanupTask.start();

    this.isRunning = true;
    this.logger.info('Notification archival cron jobs started');
  }

  /**
   * Stop all scheduled tasks
   */
  stopScheduledTasks(): void {
    for (const [name, task] of this.scheduledTasks) {
      if (task && typeof task.stop === 'function') {
        task.stop();
        this.logger.info(`Stopped ${name} cron job`);
      }
    }
    this.scheduledTasks.clear();
    this.isRunning = false;
  }

  /**
   * Update archival policies
   */
  updatePolicies(newPolicies: Partial<ArchivalPolicy>): void {
    const oldEnabled = this.currentPolicies.enabled;
    this.currentPolicies = { ...this.currentPolicies, ...newPolicies };

    this.logger.info('Archival policies updated:', this.currentPolicies);

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
  getPolicies(): ArchivalPolicy {
    return { ...this.currentPolicies };
  }

  /**
   * Run automatic archival based on current policies
   */
  async runAutoArchival(): Promise<ArchivalResult> {
    if (!this.currentPolicies.enabled) {
      this.logger.info('Auto-archival is disabled, skipping');
      return { 
        skipped: true,
        duration: 0,
        policies: this.currentPolicies
      };
    }

    const startTime = Date.now();
    this.logger.info('Starting automatic notification archival...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.currentPolicies.autoArchiveAfterDays
      );

      // Build where conditions
      const whereConditions: any = {
        archived: false,
        deletedAt: null,
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      };

      // Only archive read notifications if policy is set
      if (this.currentPolicies.archiveReadOnly) {
        whereConditions.read = true;
      }

      // Exclude certain categories
      if (this.currentPolicies.excludeCategories.length > 0) {
        whereConditions.category = {
          [Op.notIn]: this.currentPolicies.excludeCategories,
        };
      }

      // Exclude certain priorities
      if (this.currentPolicies.excludePriorities.length > 0) {
        whereConditions.priority = {
          [Op.notIn]: this.currentPolicies.excludePriorities,
        };
      }

      // Get notifications to archive in batches
      let totalArchived = 0;
      let hasMore = true;

      while (hasMore) {
        const notifications = await this.Notification.findAll({
          where: whereConditions,
          limit: this.currentPolicies.batchSize,
          order: [['createdAt', 'ASC']],
        });

        if (notifications.length === 0) {
          hasMore = false;
          break;
        }

        // Archive this batch
        const notificationIds = notifications.map((n: any) => n.id);

        const [affectedRows] = await this.Notification.update(
          {
            archived: true,
            archivedAt: new Date(),
          },
          {
            where: {
              id: {
                [Op.in]: notificationIds,
              },
            },
          }
        );

        totalArchived += affectedRows;

        this.logger.info(
          `Archived ${affectedRows} notifications (batch ${Math.ceil(
            totalArchived / this.currentPolicies.batchSize
          )})`
        );

        // If we got fewer notifications than the batch size, we're done
        if (notifications.length < this.currentPolicies.batchSize) {
          hasMore = false;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        `Auto-archival completed: ${totalArchived} notifications archived in ${duration}ms`
      );

      return {
        archived: totalArchived,
        duration,
        policies: this.currentPolicies,
      };
    } catch (error) {
      this.logger.error('Error during auto-archival:', error);
      throw error;
    }
  }

  /**
   * Run cleanup of old archived notifications (permanent deletion)
   */
  async runCleanup(): Promise<ArchivalResult> {
    if (!this.currentPolicies.enabled) {
      this.logger.info('Auto-cleanup is disabled, skipping');
      return { 
        skipped: true,
        duration: 0,
        policies: this.currentPolicies
      };
    }

    const startTime = Date.now();
    this.logger.info('Starting automatic notification cleanup...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.currentPolicies.permanentDeleteAfterDays
      );

      // Find archived notifications older than the cutoff
      const whereConditions = {
        archived: true,
        deletedAt: null,
        archivedAt: {
          [Op.lt]: cutoffDate,
        },
      };

      // Soft delete (set deletedAt timestamp)
      const [affectedRows] = await this.Notification.update(
        {
          deletedAt: new Date(),
        },
        {
          where: whereConditions,
        }
      );

      const duration = Date.now() - startTime;
      this.logger.info(
        `Auto-cleanup completed: ${affectedRows} notifications marked for deletion in ${duration}ms`
      );

      return {
        deleted: affectedRows,
        duration,
        policies: this.currentPolicies,
      };
    } catch (error) {
      this.logger.error('Error during auto-cleanup:', error);
      throw error;
    }
  }

  /**
   * Get archival statistics
   */
  async getArchivalStats(): Promise<ArchivalStats> {
    try {
      const [
        totalNotifications,
        archivedNotifications,
        deletedNotifications,
        eligibleForArchival,
        eligibleForCleanup,
      ] = await Promise.all([
        // Total active notifications
        this.Notification.count({
          where: {
            archived: false,
            deletedAt: null,
          },
        }),

        // Total archived notifications
        this.Notification.count({
          where: {
            archived: true,
            deletedAt: null,
          },
        }),

        // Total deleted notifications
        this.Notification.count({
          where: {
            deletedAt: {
              [Op.ne]: null,
            },
          },
        }),

        // Notifications eligible for archival
        this.getEligibleForArchival(),

        // Archived notifications eligible for cleanup
        this.getEligibleForCleanup(),
      ]);

      return {
        total: totalNotifications,
        archived: archivedNotifications,
        deleted: deletedNotifications,
        eligibleForArchival,
        eligibleForCleanup,
        policies: this.currentPolicies,
        isRunning: this.isRunning,
      };
    } catch (error) {
      this.logger.error('Error getting archival stats:', error);
      throw error;
    }
  }

  /**
   * Get count of notifications eligible for archival
   */
  private async getEligibleForArchival(): Promise<number> {
    if (!this.currentPolicies.enabled) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.currentPolicies.autoArchiveAfterDays
    );

    const whereConditions: any = {
      archived: false,
      deletedAt: null,
      createdAt: {
        [Op.lt]: cutoffDate,
      },
    };

    if (this.currentPolicies.archiveReadOnly) {
      whereConditions.read = true;
    }

    if (this.currentPolicies.excludeCategories.length > 0) {
      whereConditions.category = {
        [Op.notIn]: this.currentPolicies.excludeCategories,
      };
    }

    if (this.currentPolicies.excludePriorities.length > 0) {
      whereConditions.priority = {
        [Op.notIn]: this.currentPolicies.excludePriorities,
      };
    }

    return await this.Notification.count({ where: whereConditions });
  }

  /**
   * Get count of archived notifications eligible for cleanup
   */
  private async getEligibleForCleanup(): Promise<number> {
    if (!this.currentPolicies.enabled) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.currentPolicies.permanentDeleteAfterDays
    );

    return await this.Notification.count({
      where: {
        archived: true,
        deletedAt: null,
        archivedAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });
  }

  /**
   * Manually trigger archival (for testing or immediate execution)
   */
  async triggerArchival(): Promise<ArchivalResult> {
    this.logger.info('Manual archival triggered');
    return await this.runAutoArchival();
  }

  /**
   * Manually trigger cleanup (for testing or immediate execution)
   */
  async triggerCleanup(): Promise<ArchivalResult> {
    this.logger.info('Manual cleanup triggered');
    return await this.runCleanup();
  }

  /**
   * Get service status
   */
  getStatus(): ArchivalScheduleStatus {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
      policies: this.currentPolicies,
    };
  }
}