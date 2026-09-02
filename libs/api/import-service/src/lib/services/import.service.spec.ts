import { Sequelize } from 'sequelize'
import { importService, ImportResult, BulkImportResult } from './import.service'
import { mappingService } from './mapping.service'
import { validationService } from './validation.service'
import type { DailyReport } from '../types/report.types'

// Mock dependencies
jest.mock('./mapping.service')
jest.mock('./validation.service')
jest.mock('@bakery/api/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('ImportService', () => {
  let sequelize: Sequelize
  let mockTransaction: any
  let mockModels: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock transaction
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    }

    // Mock models
    mockModels = {
      DailySalesReport: {
        findOne: jest.fn(),
        create: jest.fn(),
      },
      SalesTransaction: {
        create: jest.fn(),
      },
      TransactionItem: {
        create: jest.fn(),
      },
    }

    // Mock sequelize instance
    sequelize = {
      models: mockModels,
      transaction: jest.fn().mockResolvedValue(mockTransaction),
    } as any

    // Initialize service
    importService.initialize(sequelize)
  })

  describe('checkDuplicateReport', () => {
    it('should return true if report exists', async () => {
      mockModels.DailySalesReport.findOne.mockResolvedValue({ id: 1 })

      const result = await importService.checkDuplicateReport('2024-01-15')

      expect(result).toBe(true)
      expect(mockModels.DailySalesReport.findOne).toHaveBeenCalledWith({
        where: { reportDate: '2024-01-15' },
      })
    })

    it('should return false if report does not exist', async () => {
      mockModels.DailySalesReport.findOne.mockResolvedValue(null)

      const result = await importService.checkDuplicateReport('2024-01-15')

      expect(result).toBe(false)
    })

    it('should throw error if service not initialized', async () => {
      importService.sequelize = null

      await expect(
        importService.checkDuplicateReport('2024-01-15')
      ).rejects.toThrow('Import service not initialized')
    })
  })

  describe('processReport', () => {
    const mockReport: DailyReport = {
      date: '2024-01-15',
      register_id: 'REG001',
      report_number: 1,
      company: 'Test Bakery',
      transactions: [
        {
          id: 'TX001',
          timestamp: '2024-01-15T10:00:00Z',
          type: 'sale',
          user: 'john.doe',
          items: [
            {
              product: 'Croissant',
              product_id: '1',
              quantity: 2,
              price: 2.5,
              total: 5.0,
            },
          ],
          total: 5.0,
          payment: 'Bar',
        },
      ],
      daily_summary: {
        total_revenue: 5.0,
        cash_revenue: 5.0,
        transaction_count: 1,
        vat_totals: { '19%': 0.95 },
      },
    }

    beforeEach(() => {
      // Mock successful validation
      ;(validationService.validateReportData as jest.Mock).mockResolvedValue(
        undefined
      )

      // Mock successful user and product mapping
      ;(mappingService.mapUser as jest.Mock).mockResolvedValue(1)
      ;(mappingService.mapProduct as jest.Mock).mockResolvedValue(1)

      // Mock model create operations
      mockModels.SalesTransaction.create.mockResolvedValue({ id: 100 })
      mockModels.TransactionItem.create.mockResolvedValue({ id: 200 })
      mockModels.DailySalesReport.create.mockResolvedValue({ id: 300 })
    })

    it('should process report successfully', async () => {
      const result = await importService.processReport(mockReport)

      expect(result).toEqual<ImportResult>({
        reportId: 300,
        date: '2024-01-15',
        transactionsImported: 1,
        itemsImported: 1,
      })

      expect(mockTransaction.commit).toHaveBeenCalled()
      expect(mockTransaction.rollback).not.toHaveBeenCalled()
    })

    it('should rollback transaction on validation error', async () => {
      ;(validationService.validateReportData as jest.Mock).mockRejectedValue(
        new Error('Validation failed')
      )

      await expect(importService.processReport(mockReport)).rejects.toThrow(
        'Validation failed'
      )

      expect(mockTransaction.rollback).toHaveBeenCalled()
      expect(mockTransaction.commit).not.toHaveBeenCalled()
    })

    it('should rollback transaction if user not found', async () => {
      ;(mappingService.mapUser as jest.Mock).mockResolvedValue(null)

      await expect(importService.processReport(mockReport)).rejects.toThrow(
        'User not found: john.doe'
      )

      expect(mockTransaction.rollback).toHaveBeenCalled()
      expect(mockTransaction.commit).not.toHaveBeenCalled()
    })

    it('should rollback transaction if product not found', async () => {
      ;(mappingService.mapProduct as jest.Mock).mockResolvedValue(null)

      await expect(importService.processReport(mockReport)).rejects.toThrow(
        'Product not found: 1 (Croissant)'
      )

      expect(mockTransaction.rollback).toHaveBeenCalled()
      expect(mockTransaction.commit).not.toHaveBeenCalled()
    })
  })

  describe('processBulkReports', () => {
    const mockReports: DailyReport[] = [
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
      {
        date: '2024-01-16',
        register_id: 'REG001',
        report_number: 2,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      },
    ]

    it('should process multiple reports and skip duplicates', async () => {
      // First report exists, second doesn't
      importService.checkDuplicateReport = jest
        .fn()
        .mockResolvedValueOnce(true) // First report exists
        .mockResolvedValueOnce(false) // Second report doesn't exist

      // Mock successful processing
      importService.processReport = jest.fn().mockResolvedValue({
        reportId: 1,
        date: '2024-01-16',
        transactionsImported: 0,
        itemsImported: 0,
      })

      const result = await importService.processBulkReports(mockReports)

      expect(result).toEqual<BulkImportResult>({
        imported: 1,
        skipped: 1,
        failed: 0,
        details: [
          { date: '2024-01-15', status: 'skipped' },
          { date: '2024-01-16', status: 'imported' },
        ],
      })
    })

    it('should handle processing errors gracefully', async () => {
      importService.checkDuplicateReport = jest.fn().mockResolvedValue(false)
      importService.processReport = jest
        .fn()
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({
          reportId: 2,
          date: '2024-01-16',
          transactionsImported: 0,
          itemsImported: 0,
        })

      const result = await importService.processBulkReports(mockReports)

      expect(result).toEqual<BulkImportResult>({
        imported: 1,
        skipped: 0,
        failed: 1,
        details: [
          { date: '2024-01-15', status: 'failed', error: 'Processing failed' },
          { date: '2024-01-16', status: 'imported' },
        ],
      })
    })
  })
})
