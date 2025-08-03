/**
 * Unit tests for ReportService
 */

import { ReportService } from './report.service'
import { apiClient } from '../api-client'
import type { DailyReport, ReportListResponse } from '@bakery/shared/types'

// Mock the apiClient
jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}))

describe('ReportService', () => {
  let reportService: ReportService
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

  beforeEach(() => {
    reportService = new ReportService()
    jest.clearAllMocks()
  })

  describe('getReports', () => {
    it('should fetch list of reports successfully', async () => {
      const mockResponse: ReportListResponse = {
        reports: [
          {
            date: '2025-07-12',
            filename: '2025-07-12_50779225.json',
            filesize: 12345,
            transaction_count: 110,
            total_revenue: 3157.25,
          },
          {
            date: '2025-07-11',
            filename: '2025-07-11_50779225.json',
            filesize: 11000,
            transaction_count: 95,
            total_revenue: 2850.0,
          },
        ],
        total: 2,
      }

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
        message: 'Reports fetched successfully',
      })

      const result = await reportService.getReports()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/reports')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
      expect(result.data?.reports).toHaveLength(2)
    })

    it('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'))

      const result = await reportService.getReports()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Network error')
      expect(result.data).toBeUndefined()
    })
  })

  describe('getReportByDate', () => {
    it('should fetch a specific report by date', async () => {
      const mockReport: DailyReport = {
        date: '2025-07-12',
        register_id: '50779225',
        report_number: 78,
        company: 'Bäckerei Heusser GbR',
        transactions: [
          {
            id: '7443',
            timestamp: '2025-07-12T06:13:03+02:00',
            type: 'sale',
            user: 'Daniela',
            items: [
              {
                product: 'Käseweck',
                product_id: '206',
                quantity: 3,
                price: 1.2,
                total: 3.6,
              },
            ],
            total: 3.6,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 3157.25,
          cash_revenue: 2784.5,
          transaction_count: 110,
          vat_totals: {
            '19%': 0.11,
            '0%': 206.5,
          },
        },
      }

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockReport,
        message: 'Report fetched successfully',
      })

      const result = await reportService.getReportByDate('2025-07-12')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/reports/2025-07-12')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockReport)
      expect(result.data?.date).toBe('2025-07-12')
    })

    it('should handle missing report gracefully', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Report not found'))

      const result = await reportService.getReportByDate('2025-01-01')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Report not found')
      expect(result.data).toBeUndefined()
    })
  })

  describe('getReportsByDateRange', () => {
    it('should fetch reports within date range', async () => {
      const mockResponse: ReportListResponse = {
        reports: [
          {
            date: '2025-07-12',
            filename: '2025-07-12_50779225.json',
          },
          {
            date: '2025-07-11',
            filename: '2025-07-11_50779225.json',
          },
        ],
        total: 2,
      }

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
        message: 'Reports fetched successfully',
      })

      const result = await reportService.getReportsByDateRange(
        '2025-07-10',
        '2025-07-12'
      )

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/reports', {
        startDate: '2025-07-10',
        endDate: '2025-07-12',
      })
      expect(result.success).toBe(true)
      expect(result.data?.reports).toHaveLength(2)
    })
  })

  describe('formatReportDate', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-07-12T10:30:00')
      const result = reportService.formatReportDate(date)
      expect(result).toBe('2025-07-12')
    })

    it('should format date string to YYYY-MM-DD', () => {
      const result = reportService.formatReportDate('2025-07-12T10:30:00')
      expect(result).toBe('2025-07-12')
    })
  })

  describe('parseReportFilename', () => {
    it('should parse valid report filename', () => {
      const result = reportService.parseReportFilename('2025-07-12_50779225.json')
      expect(result).toEqual({
        date: '2025-07-12',
        registerId: '50779225',
      })
    })

    it('should return null for invalid filename', () => {
      const result = reportService.parseReportFilename('invalid-filename.json')
      expect(result).toBeNull()
    })

    it('should return null for non-JSON file', () => {
      const result = reportService.parseReportFilename('2025-07-12_50779225.txt')
      expect(result).toBeNull()
    })
  })

  describe('calculateReportStats', () => {
    it('should calculate report statistics correctly', () => {
      const mockReport: DailyReport = {
        date: '2025-07-12',
        register_id: '50779225',
        report_number: 78,
        company: 'Bäckerei Heusser GbR',
        transactions: [
          {
            id: '1',
            timestamp: '2025-07-12T08:00:00',
            type: 'sale',
            user: 'User1',
            items: [
              {
                product: 'Product A',
                product_id: '101',
                quantity: 2,
                price: 5.0,
                total: 10.0,
              },
            ],
            total: 10.0,
            payment: 'Bar',
          },
          {
            id: '2',
            timestamp: '2025-07-12T09:00:00',
            type: 'sale',
            user: 'User2',
            items: [
              {
                product: 'Product B',
                product_id: '102',
                quantity: 1,
                price: 15.0,
                total: 15.0,
              },
            ],
            total: 15.0,
            payment: 'Unbar',
          },
          {
            id: '3',
            timestamp: '2025-07-12T09:30:00',
            type: 'sale',
            user: 'User1',
            items: [
              {
                product: 'Product A',
                product_id: '101',
                quantity: 3,
                price: 5.0,
                total: 15.0,
              },
            ],
            total: 15.0,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 40.0,
          cash_revenue: 25.0,
          transaction_count: 3,
          vat_totals: {},
        },
      }

      const stats = reportService.calculateReportStats(mockReport)

      // Check hourly distribution
      expect(stats.hourlyDistribution).toEqual([
        [8, 1],
        [9, 2],
      ])

      // Check payment method distribution
      expect(stats.paymentMethodDistribution).toContainEqual(['Bar', 25.0])
      expect(stats.paymentMethodDistribution).toContainEqual(['Unbar', 15.0])

      // Check top products
      expect(stats.topProducts).toHaveLength(2)
      expect(stats.topProducts[0]).toEqual({
        productId: '101',
        quantity: 5,
        revenue: 25.0,
      })
      expect(stats.topProducts[1]).toEqual({
        productId: '102',
        quantity: 1,
        revenue: 15.0,
      })

      // Check calculated values
      expect(stats.averageTransactionValue).toBeCloseTo(13.33, 2)
      expect(stats.cashPercentage).toBe(62.5)
    })

    it('should handle empty transactions', () => {
      const mockReport: DailyReport = {
        date: '2025-07-12',
        register_id: '50779225',
        report_number: 78,
        company: 'Bäckerei Heusser GbR',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      }

      const stats = reportService.calculateReportStats(mockReport)

      expect(stats.hourlyDistribution).toEqual([])
      expect(stats.paymentMethodDistribution).toEqual([])
      expect(stats.topProducts).toEqual([])
      expect(stats.averageTransactionValue).toBe(NaN)
      expect(stats.cashPercentage).toBe(NaN)
    })
  })
})