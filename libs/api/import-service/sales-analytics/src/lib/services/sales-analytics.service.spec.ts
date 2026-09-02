import { Op } from 'sequelize'
import {
  salesAnalyticsService,
  PaymentMethodBreakdown,
  ProductPerformanceData,
  RevenueTrendData,
} from './sales-analytics.service'
import { SalesTransaction, TransactionItem, DailySalesReport } from '../models'

// Mock the models
jest.mock('../models', () => ({
  SalesTransaction: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  TransactionItem: {
    findAll: jest.fn(),
  },
  DailySalesReport: {
    findAll: jest.fn(),
  },
}))

// Mock the logger
jest.mock('@bakery/api/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('SalesAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getRevenueTrends', () => {
    it('should return daily revenue trends', async () => {
      const mockData = [
        {
          date: '2024-01-01',
          revenue: '1500.00',
          transactions: 25,
        },
        {
          date: '2024-01-02',
          revenue: '1800.00',
          transactions: 30,
        },
      ]

      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData)

      const result = await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-02',
        'daily'
      )

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            expect.arrayContaining(['DATE(transaction_date)', 'date']),
            expect.arrayContaining(['SUM(total_amount)', 'revenue']),
            expect.arrayContaining(['COUNT(*)', 'transactions']),
          ]),
          where: {
            transaction_date: {
              [Op.between]: ['2024-01-01 00:00:00', '2024-01-02 23:59:59'],
            },
          },
          group: expect.arrayContaining(['DATE(transaction_date)']),
          order: expect.arrayContaining([['DATE(transaction_date)', 'ASC']]),
          raw: true,
        })
      )

      expect(result).toEqual([
        { date: '2024-01-01', revenue: 1500, transactions: 25 },
        { date: '2024-01-02', revenue: 1800, transactions: 30 },
      ])
    })

    it('should return weekly revenue trends', async () => {
      const mockData = [
        {
          week: '2024-01',
          revenue: '3300.00',
          transactions: 55,
        },
      ]

      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData)

      await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-07',
        'weekly'
      )

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            expect.arrayContaining(['YEARWEEK(transaction_date)', 'week']),
          ]),
        })
      )
    })

    it('should return monthly revenue trends', async () => {
      const mockData = [
        {
          month: '2024-01',
          revenue: '15000.00',
          transactions: 300,
        },
      ]

      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData)

      await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-31',
        'monthly'
      )

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            expect.arrayContaining([
              'DATE_FORMAT(transaction_date, "%Y-%m")',
              'month',
            ]),
          ]),
        })
      )
    })

    it('should handle empty results', async () => {
      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue([])

      const result = await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result).toEqual([])
    })
  })

  describe('getProductPerformance', () => {
    it('should return top performing products', async () => {
      const mockData = [
        {
          product_id: 1,
          product_name: 'Croissant',
          total_quantity: '150',
          total_revenue: '750.00',
          avg_price: '5.00',
        },
        {
          product_id: 2,
          product_name: 'Baguette',
          total_quantity: '120',
          total_revenue: '480.00',
          avg_price: '4.00',
        },
      ]

      ;(TransactionItem.findAll as jest.Mock).mockResolvedValue(mockData)

      const result = await salesAnalyticsService.getProductPerformance(
        '2024-01-01',
        '2024-01-02',
        10,
        'top'
      )

      expect(TransactionItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            'product_id',
            'product_name',
            expect.arrayContaining(['SUM(quantity)', 'total_quantity']),
            expect.arrayContaining([
              'SUM(quantity * unit_price)',
              'total_revenue',
            ]),
            expect.arrayContaining(['AVG(unit_price)', 'avg_price']),
          ]),
          include: expect.arrayContaining([
            expect.objectContaining({
              model: SalesTransaction,
              where: {
                transaction_date: {
                  [Op.between]: ['2024-01-01 00:00:00', '2024-01-02 23:59:59'],
                },
              },
            }),
          ]),
          group: ['product_id', 'product_name'],
          order: [['total_quantity', 'DESC']],
          limit: 10,
          raw: true,
        })
      )

      expect(result).toEqual([
        {
          product_id: 1,
          product_name: 'Croissant',
          total_quantity: 150,
          total_revenue: 750,
          avg_price: 5.0,
        },
        {
          product_id: 2,
          product_name: 'Baguette',
          total_quantity: 120,
          total_revenue: 480,
          avg_price: 4.0,
        },
      ])
    })

    it('should return bottom performing products', async () => {
      ;(TransactionItem.findAll as jest.Mock).mockResolvedValue([])

      await salesAnalyticsService.getProductPerformance(
        '2024-01-01',
        '2024-01-02',
        5,
        'bottom'
      )

      expect(TransactionItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['total_quantity', 'ASC']],
          limit: 5,
        })
      )
    })
  })

  describe('getCashierPerformance', () => {
    it('should return cashier performance data', async () => {
      const mockData = [
        {
          cashier_id: 1,
          cashier_name: 'John Doe',
          total_transactions: '45',
          total_revenue: '2250.00',
          avg_transaction_value: '50.00',
        },
      ]

      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData)

      const result = await salesAnalyticsService.getCashierPerformance(
        '2024-01-01',
        '2024-01-02'
      )

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            'cashier_id',
            'cashier_name',
            expect.arrayContaining(['COUNT(*)', 'total_transactions']),
            expect.arrayContaining(['SUM(total_amount)', 'total_revenue']),
            expect.arrayContaining([
              'AVG(total_amount)',
              'avg_transaction_value',
            ]),
          ]),
          where: {
            transaction_date: {
              [Op.between]: ['2024-01-01 00:00:00', '2024-01-02 23:59:59'],
            },
          },
          group: ['cashier_id', 'cashier_name'],
          order: [['total_revenue', 'DESC']],
          raw: true,
        })
      )

      expect(result).toEqual([
        {
          cashier_id: 1,
          cashier_name: 'John Doe',
          total_transactions: 45,
          total_revenue: 2250,
          avg_transaction_value: 50,
        },
      ])
    })
  })

  describe('getPaymentMethodBreakdown', () => {
    it('should return payment method breakdown with percentages', async () => {
      const mockData = [
        {
          payment_method: 'cash',
          total_transactions: '25',
          total_amount: '1250.00',
        },
        {
          payment_method: 'card',
          total_transactions: '20',
          total_amount: '1000.00',
        },
      ]

      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData)

      const result = await salesAnalyticsService.getPaymentMethodBreakdown(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result).toEqual([
        {
          payment_method: 'cash',
          total_transactions: 25,
          total_amount: 1250,
          percentage: 55.6,
        },
        {
          payment_method: 'card',
          total_transactions: 20,
          total_amount: 1000,
          percentage: 44.4,
        },
      ])
    })

    it('should handle empty payment method data', async () => {
      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue([])

      const result = await salesAnalyticsService.getPaymentMethodBreakdown(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result).toEqual([])
    })
  })

  describe('getDashboardSummary', () => {
    // Die Übersicht ist eine Komposition: Gesamtwerte per findOne, dazu
    // Top-Produkte, Zahlungsarten und der 7-Tage-Trend über die eigenen
    // Methoden (jede hat oben ihre eigenen Tests). Die werden hier gestubbt.
    const stubParts = (parts: {
      topProducts?: ProductPerformanceData[]
      paymentBreakdown?: PaymentMethodBreakdown[]
      dailyTrend?: RevenueTrendData[]
    }) => ({
      top: jest
        .spyOn(salesAnalyticsService, 'getProductPerformance')
        .mockResolvedValue(parts.topProducts ?? []),
      pay: jest
        .spyOn(salesAnalyticsService, 'getPaymentMethodBreakdown')
        .mockResolvedValue(parts.paymentBreakdown ?? []),
      trend: jest
        .spyOn(salesAnalyticsService, 'getRevenueTrends')
        .mockResolvedValue(parts.dailyTrend ?? []),
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return comprehensive dashboard summary', async () => {
      ;(SalesTransaction.findOne as jest.Mock).mockResolvedValue({
        totalRevenue: '5000.00',
        totalTransactions: '100',
        averageTransactionValue: '50.00',
      })
      const topProducts: ProductPerformanceData[] = [
        {
          productId: 1,
          productName: 'Croissant',
          quantitySold: 150,
          totalRevenue: 375,
          averagePrice: 2.5,
          transactionCount: 120,
        },
      ]
      const paymentBreakdown: PaymentMethodBreakdown[] = [
        {
          paymentMethod: 'Bar',
          transactionCount: 60,
          totalRevenue: 3000,
          percentage: 60,
        },
      ]
      const dailyTrend: RevenueTrendData[] = [
        {
          date: '2024-01-02',
          revenue: 1500,
          transactions: 25,
          averageTransactionValue: 60,
        },
      ]
      const spies = stubParts({ topProducts, paymentBreakdown, dailyTrend })

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result).toEqual({
        totalRevenue: 5000,
        totalTransactions: 100,
        averageTransactionValue: 50,
        topProducts,
        paymentBreakdown,
        dailyTrend,
      })
      expect(spies.top).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02',
        5,
        'top'
      )
      expect(spies.pay).toHaveBeenCalledWith('2024-01-01', '2024-01-02')
      // Der Trend umfasst die letzten sieben Tage bis einschließlich endDate
      expect(spies.trend).toHaveBeenCalledWith(
        '2023-12-27',
        '2024-01-02',
        'daily'
      )
    })

    it('should treat NULL aggregates (SUM/AVG over an empty period) as zero', async () => {
      ;(SalesTransaction.findOne as jest.Mock).mockResolvedValue({
        totalRevenue: null,
        totalTransactions: '0',
        averageTransactionValue: null,
      })
      stubParts({})

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result.totalRevenue).toBe(0)
      expect(result.totalTransactions).toBe(0)
      expect(result.averageTransactionValue).toBe(0)
    })

    it('should handle empty current period data', async () => {
      ;(SalesTransaction.findOne as jest.Mock).mockResolvedValue(null)
      stubParts({})

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      )

      expect(result).toEqual({
        totalRevenue: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        topProducts: [],
        paymentBreakdown: [],
        dailyTrend: [],
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      ;(SalesTransaction.findAll as jest.Mock).mockRejectedValue(dbError)

      await expect(
        salesAnalyticsService.getRevenueTrends('2024-01-01', '2024-01-02')
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle invalid date formats', async () => {
      ;(SalesTransaction.findAll as jest.Mock).mockResolvedValue([])

      // Test with invalid date format - service should still call with provided dates
      const result = await salesAnalyticsService.getRevenueTrends(
        'invalid-date',
        '2024-01-02'
      )

      expect(SalesTransaction.findAll).toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })
})
