import { Request, Response } from 'express'
import { SalesAnalyticsController } from './sales-analytics.controller'
import { salesAnalyticsService } from '../services/sales-analytics.service'

// Mock the sales analytics service
jest.mock('../services/sales-analytics.service', () => ({
  salesAnalyticsService: {
    getRevenueTrends: jest.fn(),
    getProductPerformance: jest.fn(),
    getCashierPerformance: jest.fn(),
    getPaymentMethodBreakdown: jest.fn(),
    getDashboardSummary: jest.fn(),
  },
}))

// Mock the logger
jest.mock('@bakery/api/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('SalesAnalyticsController', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: jest.Mock

  beforeEach(() => {
    mockRequest = {
      query: {},
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()
    jest.clearAllMocks()
  })

  describe('getRevenueTrends', () => {
    it('should return revenue trends data successfully', async () => {
      const mockTrends = [
        { date: '2024-01-01', revenue: 1500, transactions: 25 },
        { date: '2024-01-02', revenue: 1800, transactions: 30 },
      ]

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        granularity: 'daily',
      }
      ;(salesAnalyticsService.getRevenueTrends as jest.Mock).mockResolvedValue(
        mockTrends
      )

      await SalesAnalyticsController.getRevenueTrends(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(salesAnalyticsService.getRevenueTrends).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02',
        'daily'
      )
      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTrends,
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          granularity: 'daily',
          count: 2,
        },
      })
    })

    it('should handle service errors gracefully', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }

      const error = new Error('Database connection failed')
      ;(salesAnalyticsService.getRevenueTrends as jest.Mock).mockRejectedValue(
        error
      )

      await SalesAnalyticsController.getRevenueTrends(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(mockResponse.status).toHaveBeenCalledWith(500)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        // Der Controller gibt Fehlerdetails bewusst nicht an den Client weiter
        error: 'Failed to retrieve revenue trends',
      })
    })
  })

  describe('getProductPerformance', () => {
    it('should return product performance data with pagination', async () => {
      const mockProducts = [
        {
          product_id: 1,
          product_name: 'Croissant',
          total_quantity: 150,
          total_revenue: 750,
          avg_price: 5.0,
        },
      ]

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        page: '1',
        limit: '10',
        sort: 'top',
      }
      ;(
        salesAnalyticsService.getProductPerformance as jest.Mock
      ).mockResolvedValue(mockProducts)

      await SalesAnalyticsController.getProductPerformance(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(salesAnalyticsService.getProductPerformance).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02',
        10,
        'top'
      )
      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockProducts,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          hasMore: false,
        },
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          sort: 'top',
        },
      })
    })

    it('should use default pagination values', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }
      ;(
        salesAnalyticsService.getProductPerformance as jest.Mock
      ).mockResolvedValue([])

      await SalesAnalyticsController.getProductPerformance(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(salesAnalyticsService.getProductPerformance).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02',
        10,
        'top'
      )
    })
  })

  describe('getCashierPerformance', () => {
    it('should return cashier performance data', async () => {
      const mockCashiers = [
        {
          cashier_id: 1,
          cashier_name: 'John Doe',
          total_transactions: 45,
          total_revenue: 2250,
          avg_transaction_value: 50,
        },
      ]

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }
      ;(
        salesAnalyticsService.getCashierPerformance as jest.Mock
      ).mockResolvedValue(mockCashiers)

      await SalesAnalyticsController.getCashierPerformance(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(salesAnalyticsService.getCashierPerformance).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02'
      )
      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCashiers,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        },
      })
    })
  })

  describe('getPaymentMethods', () => {
    it('should return payment method breakdown', async () => {
      const mockPaymentMethods = [
        {
          paymentMethod: 'cash',
          transactionCount: 25,
          totalRevenue: 1250,
          percentage: 55.6,
        },
        {
          paymentMethod: 'card',
          transactionCount: 20,
          totalRevenue: 1000,
          percentage: 44.4,
        },
      ]

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }
      ;(
        salesAnalyticsService.getPaymentMethodBreakdown as jest.Mock
      ).mockResolvedValue(mockPaymentMethods)

      await SalesAnalyticsController.getPaymentMethods(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(
        salesAnalyticsService.getPaymentMethodBreakdown
      ).toHaveBeenCalledWith('2024-01-01', '2024-01-02')
      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPaymentMethods,
        summary: {
          totalRevenue: 2250,
          totalTransactions: 45,
          averageTransactionValue: 50,
          methodCount: 2,
        },
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        },
      })
    })
  })

  describe('getSummary', () => {
    it('should return dashboard summary data', async () => {
      const mockSummary = {
        totalRevenue: 5000,
        totalTransactions: 100,
        avgTransactionValue: 50,
        totalProducts: 25,
        topProduct: { name: 'Croissant', quantity: 150 },
        growthRate: 15.5,
      }

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }
      ;(
        salesAnalyticsService.getDashboardSummary as jest.Mock
      ).mockResolvedValue(mockSummary)

      await SalesAnalyticsController.getSummary(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(salesAnalyticsService.getDashboardSummary).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02'
      )
      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary,
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          dayCount: 2,
          generatedAt: expect.any(String),
        },
      })
    })

    it('should handle empty summary data', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }
      ;(
        salesAnalyticsService.getDashboardSummary as jest.Mock
      ).mockResolvedValue(null)

      await SalesAnalyticsController.getSummary(
        mockRequest as Request,
        mockResponse as Response
      )

      // Erfolgsfall antwortet über res.json() (implizit 200); kein Fehlerstatus gesetzt
      expect(mockResponse.status).not.toHaveBeenCalled()
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        meta: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          dayCount: 2,
          generatedAt: expect.any(String),
        },
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors in all endpoints', async () => {
      const endpoints = [
        'getRevenueTrends',
        'getProductPerformance',
        'getCashierPerformance',
        'getPaymentMethods',
        'getSummary',
      ]

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }

      for (const endpoint of endpoints) {
        // Reset mocks
        jest.clearAllMocks()

        // Mock service to throw error
        const serviceMethods = Object.keys(salesAnalyticsService)
        serviceMethods.forEach((method) => {
          ;(
            salesAnalyticsService[
              method as keyof typeof salesAnalyticsService
            ] as jest.Mock
          ).mockRejectedValue(new Error('Unexpected error'))
        })

        await (SalesAnalyticsController as any)[endpoint](
          mockRequest as Request,
          mockResponse as Response
        )

        expect(mockResponse.status).toHaveBeenCalledWith(500)
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Failed to retrieve'),
          })
        )
      }
    })
  })
})
