import { Request, Response } from 'express';
import { reportingService } from './reporting.service';
import { FileStorageService } from './file-storage.service';
import {
  ReportRequest,
  ReportSchedule,
  ReportType,
  ReportFormat,
  ScheduleFrequency,
} from './types/report.types';
import * as fs from 'fs';
import * as path from 'path';

export class ReportingController {
  private fileStorage: FileStorageService;

  constructor() {
    this.fileStorage = new FileStorageService();
  }

  /**
   * POST /api/reports/generate
   * Generate a report on demand
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const reportRequest: ReportRequest = {
        type: req.body.type || ReportType.CUSTOM_RANGE,
        format: req.body.format || ReportFormat.PDF,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        recipients: req.body.recipients,
        includeCharts: req.body.includeCharts !== false,
      };

      // Validate required fields
      if (!reportRequest.startDate || !reportRequest.endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
        });
        return;
      }

      // Generate the report
      const generatedReport = await reportingService.generateReport(reportRequest);

      res.status(201).json({
        success: true,
        report: generatedReport,
      });
    } catch (error) {
      console.error('[ReportingController] Error generating report:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/reports/:id
   * Get report details
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = req.params.id;
      
      // In a real implementation, we would fetch from database
      // For now, return a placeholder
      res.json({
        id: reportId,
        message: 'Report details would be fetched from database',
      });
    } catch (error) {
      console.error('[ReportingController] Error fetching report:', error);
      res.status(500).json({
        error: 'Failed to fetch report',
      });
    }
  }

  /**
   * GET /api/reports/download/:token
   * Download a report file
   */
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token;
      
      // Validate token and get file path
      const filePath = await this.fileStorage.validateDownloadToken(token);
      
      if (!filePath) {
        res.status(404).json({
          error: 'Invalid or expired download link',
        });
        return;
      }

      // Get file metadata
      const metadata = await this.fileStorage.getFileMetadata(filePath);
      const fileName = path.basename(filePath);

      // Set headers
      res.setHeader('Content-Type', metadata.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', metadata.size);

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('[ReportingController] Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download file',
          });
        }
      });
    } catch (error) {
      console.error('[ReportingController] Error downloading report:', error);
      res.status(500).json({
        error: 'Failed to download report',
      });
    }
  }

  /**
   * POST /api/reports/schedule
   * Create a report schedule
   */
  async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const scheduleData: ReportSchedule = {
        reportType: req.body.reportType,
        format: req.body.format || ReportFormat.PDF,
        frequency: req.body.frequency,
        recipients: req.body.recipients || [],
        active: req.body.active !== false,
        dayOfWeek: req.body.dayOfWeek,
        dayOfMonth: req.body.dayOfMonth,
        timeOfDay: req.body.timeOfDay || '08:00',
      };

      // Validate required fields
      if (!scheduleData.reportType || !scheduleData.frequency) {
        res.status(400).json({
          error: 'Report type and frequency are required',
        });
        return;
      }

      // Validate frequency-specific fields
      if (scheduleData.frequency === ScheduleFrequency.WEEKLY && scheduleData.dayOfWeek === undefined) {
        res.status(400).json({
          error: 'Day of week is required for weekly schedules',
        });
        return;
      }

      if (scheduleData.frequency === ScheduleFrequency.MONTHLY && scheduleData.dayOfMonth === undefined) {
        res.status(400).json({
          error: 'Day of month is required for monthly schedules',
        });
        return;
      }

      // Create the schedule
      const createdSchedule = await reportingService.createSchedule(scheduleData);

      res.status(201).json({
        success: true,
        schedule: createdSchedule,
      });
    } catch (error) {
      console.error('[ReportingController] Error creating schedule:', error);
      res.status(500).json({
        error: 'Failed to create schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/reports/schedules
   * Get all report schedules
   */
  async getSchedules(req: Request, res: Response): Promise<void> {
    try {
      const schedules = await reportingService.getSchedules();
      
      res.json({
        success: true,
        schedules,
      });
    } catch (error) {
      console.error('[ReportingController] Error fetching schedules:', error);
      res.status(500).json({
        error: 'Failed to fetch schedules',
      });
    }
  }

  /**
   * PUT /api/reports/schedule/:id
   * Update a report schedule
   */
  async updateSchedule(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = req.params.id;
      const updates = req.body;

      const updatedSchedule = await reportingService.updateSchedule(scheduleId, updates);

      res.json({
        success: true,
        schedule: updatedSchedule,
      });
    } catch (error) {
      console.error('[ReportingController] Error updating schedule:', error);
      res.status(500).json({
        error: 'Failed to update schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * DELETE /api/reports/schedule/:id
   * Delete a report schedule
   */
  async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = req.params.id;

      await reportingService.deleteSchedule(scheduleId);

      res.json({
        success: true,
        message: `Schedule ${scheduleId} deleted successfully`,
      });
    } catch (error) {
      console.error('[ReportingController] Error deleting schedule:', error);
      res.status(500).json({
        error: 'Failed to delete schedule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/reports/storage/stats
   * Get storage statistics
   */
  async getStorageStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.fileStorage.getStorageStats();
      
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[ReportingController] Error fetching storage stats:', error);
      res.status(500).json({
        error: 'Failed to fetch storage statistics',
      });
    }
  }

  /**
   * POST /api/reports/storage/cleanup
   * Clean up old report files
   */
  async cleanupStorage(req: Request, res: Response): Promise<void> {
    try {
      await this.fileStorage.cleanupOldFiles();
      
      res.json({
        success: true,
        message: 'Storage cleanup completed',
      });
    } catch (error) {
      console.error('[ReportingController] Error during storage cleanup:', error);
      res.status(500).json({
        error: 'Failed to clean up storage',
      });
    }
  }
}