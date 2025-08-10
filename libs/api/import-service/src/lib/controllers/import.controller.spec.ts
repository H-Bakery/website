import { Request, Response } from 'express';
import { importController } from './import.controller';
import { importService } from '../services/import.service';
import { validateDailyReport } from '../validators/report.validator';
import type { DailyReport } from '@bakery/shared/types';

// Mock dependencies
jest.mock('../services/import.service');
jest.mock('../validators/report.validator');
jest.mock('@bakery/api/core', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('ImportController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup response mocks
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe('importSalesReport', () => {
    const mockReport: DailyReport = {
      date: '2024-01-15',
      register_id: 'REG001',
      report_number: 1,
      company: 'Test Bakery',
      transactions: [],
      daily_summary: {
        total_revenue: 0,
        cash_revenue: 0,
        transaction_count: 0,
        vat_totals: {},
      },
    };

    beforeEach(() => {
      mockReq = {
        body: mockReport,
      };
    });

    it('should import report successfully', async () => {
      // Mock validation passes
      (validateDailyReport as jest.Mock).mockReturnValue({ error: null });
      
      // Mock no duplicate
      (importService.checkDuplicateReport as jest.Mock).mockResolvedValue(false);
      
      // Mock successful import
      (importService.processReport as jest.Mock).mockResolvedValue({
        reportId: 1,
        date: '2024-01-15',
        transactionsImported: 10,
        itemsImported: 20,
      });

      await importController.importSalesReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          reportId: 1,
          date: '2024-01-15',
          transactionsImported: 10,
          itemsImported: 20,
        },
        message: 'Sales report imported successfully',
      });
    });

    it('should return 400 for validation errors', async () => {
      (validateDailyReport as jest.Mock).mockReturnValue({
        error: {
          details: [{ message: 'Invalid date format' }],
        },
      });

      await importController.importSalesReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format',
      });
    });

    it('should return 409 for duplicate report', async () => {
      (validateDailyReport as jest.Mock).mockReturnValue({ error: null });
      (importService.checkDuplicateReport as jest.Mock).mockResolvedValue(true);

      await importController.importSalesReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Report for date 2024-01-15 already exists',
      });
    });

    it('should return 422 for missing user or product', async () => {
      (validateDailyReport as jest.Mock).mockReturnValue({ error: null });
      (importService.checkDuplicateReport as jest.Mock).mockResolvedValue(false);
      (importService.processReport as jest.Mock).mockRejectedValue(
        new Error('User not found: john.doe')
      );

      await importController.importSalesReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'User not found: john.doe',
      });
    });

    it('should return 500 for unexpected errors', async () => {
      (validateDailyReport as jest.Mock).mockReturnValue({ error: null });
      (importService.checkDuplicateReport as jest.Mock).mockResolvedValue(false);
      (importService.processReport as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await importController.importSalesReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to import sales report',
      });
    });
  });

  describe('importSalesReportsBulk', () => {
    beforeEach(() => {
      mockReq = {
        body: {
          reports: [
            {
              date: '2024-01-15',
              register_id: 'REG001',
              report_number: 1,
              company: 'Test Bakery',
              transactions: [],
              daily_summary: {
                total_revenue: 0,
                cash_revenue: 0,
                transaction_count: 0,
                vat_totals: {},
              },
            },
          ],
        },
      };
    });

    it('should process bulk import successfully', async () => {
      (importService.processBulkReports as jest.Mock).mockResolvedValue({
        imported: 5,
        skipped: 2,
        failed: 1,
        details: [],
      });

      await importController.importSalesReportsBulk(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 1,
          imported: 5,
          skipped: 2,
          failed: 1,
          details: [],
        },
        message: 'Bulk import completed',
      });
    });

    it('should return 400 if reports is not an array', async () => {
      mockReq.body = { reports: 'not-an-array' };

      await importController.importSalesReportsBulk(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Reports must be an array',
      });
    });

    it('should return 500 for bulk import errors', async () => {
      (importService.processBulkReports as jest.Mock).mockRejectedValue(
        new Error('Bulk processing failed')
      );

      await importController.importSalesReportsBulk(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to process bulk import',
      });
    });
  });

  describe('checkImportStatus', () => {
    beforeEach(() => {
      mockReq = {
        params: { date: '2024-01-15' },
      };
    });

    it('should return import status', async () => {
      (importService.checkDuplicateReport as jest.Mock).mockResolvedValue(true);

      await importController.checkImportStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2024-01-15',
          imported: true,
        },
      });
    });

    it('should return 400 for invalid date format', async () => {
      mockReq.params = { date: 'invalid-date' };

      await importController.checkImportStatus(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    });

    it('should return 500 for service errors', async () => {
      (importService.checkDuplicateReport as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await importController.checkImportStatus(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check import status',
      });
    });
  });
});