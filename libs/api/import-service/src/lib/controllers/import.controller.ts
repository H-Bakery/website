import { Request, Response } from 'express';
import { importService } from '../services/import.service';
import { logger } from '../utils/logger';
import { validateDailyReport } from '../validators/report.validator';
import type { DailyReport } from '../types/report.types';

export const importController = {
  /**
   * Import a single sales report
   * POST /api/import/sales-report
   */
  async importSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const report = req.body as DailyReport;
      
      // Validate report structure
      const validation = validateDailyReport(report);
      if (validation.error) {
        res.status(400).json({
          success: false,
          error: validation.error.details[0].message,
        });
        return;
      }

      // Check if report already exists
      const exists = await importService.checkDuplicateReport(report.date);
      if (exists) {
        res.status(409).json({
          success: false,
          error: `Report for date ${report.date} already exists`,
        });
        return;
      }

      // Process the import
      const result = await importService.processReport(report);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Sales report imported successfully',
      });
    } catch (error) {
      logger.error('Error importing sales report:', error);
      
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('User not found') || error.message.includes('Product not found')) {
          res.status(422).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to import sales report',
      });
    }
  },

  /**
   * Import multiple sales reports (bulk import)
   * POST /api/import/sales-reports/bulk
   */
  async importSalesReportsBulk(req: Request, res: Response): Promise<void> {
    try {
      const { reports } = req.body as { reports: DailyReport[] };
      
      if (!Array.isArray(reports)) {
        res.status(400).json({
          success: false,
          error: 'Reports must be an array',
        });
        return;
      }

      const results = await importService.processBulkReports(reports);

      res.status(201).json({
        success: true,
        data: {
          total: reports.length,
          imported: results.imported,
          skipped: results.skipped,
          failed: results.failed,
          details: results.details,
        },
        message: 'Bulk import completed',
      });
    } catch (error) {
      logger.error('Error in bulk import:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bulk import',
      });
    }
  },

  /**
   * Check if a report has already been imported
   * GET /api/import/status/:date
   */
  async checkImportStatus(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      const exists = await importService.checkDuplicateReport(date);

      res.json({
        success: true,
        data: {
          date,
          imported: exists,
        },
      });
    } catch (error) {
      logger.error('Error checking import status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check import status',
      });
    }
  },
};