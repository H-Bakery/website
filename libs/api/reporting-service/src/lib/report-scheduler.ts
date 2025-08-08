import * as cron from 'node-cron';
import { ReportSchedule, ScheduleFrequency } from './types/report.types';
import type { ReportingService } from './reporting.service';

export class ReportScheduler {
  private schedules: Map<string, cron.ScheduledTask> = new Map();
  
  constructor(private reportingService: ReportingService) {}

  /**
   * Schedule a report based on the schedule configuration
   */
  public scheduleReport(schedule: ReportSchedule): void {
    if (!schedule.active || !schedule.id) {
      return;
    }

    // Cancel existing schedule if any
    this.cancelSchedule(schedule.id);

    const cronExpression = this.buildCronExpression(schedule);
    console.log(`[ReportScheduler] Scheduling report ${schedule.id} with cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
      console.log(`[ReportScheduler] Executing scheduled report ${schedule.id}`);
      try {
        await this.reportingService.executeScheduledReport(schedule);
      } catch (error) {
        console.error(`[ReportScheduler] Error executing scheduled report ${schedule.id}:`, error);
      }
    }, {
      timezone: 'Europe/Berlin', // German timezone
    });

    this.schedules.set(schedule.id, task);
  }

  /**
   * Update an existing schedule
   */
  public updateSchedule(schedule: ReportSchedule): void {
    if (!schedule.id) return;
    
    // Cancel and reschedule
    this.cancelSchedule(schedule.id);
    if (schedule.active) {
      this.scheduleReport(schedule);
    }
  }

  /**
   * Cancel a scheduled report
   */
  public cancelSchedule(scheduleId: string): void {
    const task = this.schedules.get(scheduleId);
    if (task) {
      task.stop();
      this.schedules.delete(scheduleId);
      console.log(`[ReportScheduler] Cancelled schedule ${scheduleId}`);
    }
  }

  /**
   * Calculate the next run time for a schedule
   */
  public calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);

    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case ScheduleFrequency.DAILY:
          nextRun.setDate(nextRun.getDate() + 1);
          break;

        case ScheduleFrequency.WEEKLY:
          const targetDayOfWeek = schedule.dayOfWeek || 1; // Default to Monday
          let daysToAdd = targetDayOfWeek - nextRun.getDay();
          if (daysToAdd <= 0) daysToAdd += 7;
          nextRun.setDate(nextRun.getDate() + daysToAdd);
          break;

        case ScheduleFrequency.MONTHLY:
          const targetDayOfMonth = schedule.dayOfMonth || 1;
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(targetDayOfMonth);
          
          // Handle months with fewer days
          while (nextRun.getDate() !== targetDayOfMonth) {
            nextRun.setDate(0); // Last day of previous month
          }
          break;
      }
    }

    return nextRun;
  }

  /**
   * Build cron expression from schedule configuration
   */
  private buildCronExpression(schedule: ReportSchedule): string {
    const [hours, minutes] = schedule.timeOfDay.split(':');

    switch (schedule.frequency) {
      case ScheduleFrequency.DAILY:
        // Every day at specified time
        return `${minutes} ${hours} * * *`;

      case ScheduleFrequency.WEEKLY:
        // Every week on specified day at specified time
        const dayOfWeek = schedule.dayOfWeek || 1; // Default to Monday
        return `${minutes} ${hours} * * ${dayOfWeek}`;

      case ScheduleFrequency.MONTHLY:
        // Every month on specified day at specified time
        const dayOfMonth = schedule.dayOfMonth || 1;
        return `${minutes} ${hours} ${dayOfMonth} * *`;

      default:
        throw new Error(`Unsupported schedule frequency: ${schedule.frequency}`);
    }
  }

  /**
   * Get all active schedules
   */
  public getActiveSchedules(): string[] {
    return Array.from(this.schedules.keys());
  }

  /**
   * Stop all schedules
   */
  public stopAll(): void {
    this.schedules.forEach((task, id) => {
      task.stop();
      console.log(`[ReportScheduler] Stopped schedule ${id}`);
    });
    this.schedules.clear();
  }
}