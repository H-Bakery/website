import { Op } from 'sequelize';
import { salesAnalyticsService } from './sales-analytics.service';
import { SalesTransaction, TransactionItem, DailySalesReport } from '../models';

// Mock the models
jest.mock('../models', () => ({
  SalesTransaction: {
    findAll: jest.fn(),
  },
  TransactionItem: {
    findAll: jest.fn(),
  },
  DailySalesReport: {
    findAll: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@bakery/api/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SalesAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
      ];

      (SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData);

      const result = await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-02',
        'daily'
      );

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
      );

      expect(result).toEqual([
        { date: '2024-01-01', revenue: 1500, transactions: 25 },
        { date: '2024-01-02', revenue: 1800, transactions: 30 },
      ]);
    });

    it('should return weekly revenue trends', async () => {
      const mockData = [
        {
          week: '2024-01',
          revenue: '3300.00',
          transactions: 55,
        },
      ];

      (SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData);

      await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-07',
        'weekly'
      );

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            expect.arrayContaining(['YEARWEEK(transaction_date)', 'week']),
          ]),
        })
      );
    });

    it('should return monthly revenue trends', async () => {
      const mockData = [
        {
          month: '2024-01',
          revenue: '15000.00',
          transactions: 300,
        },
      ];

      (SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData);

      await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-31',
        'monthly'
      );

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            expect.arrayContaining(['DATE_FORMAT(transaction_date, "%Y-%m")', 'month']),
          ]),
        })
      );
    });

    it('should handle empty results', async () => {
      (SalesTransaction.findAll as jest.Mock).mockResolvedValue([]);

      const result = await salesAnalyticsService.getRevenueTrends(
        '2024-01-01',
        '2024-01-02'
      );

      expect(result).toEqual([]);
    });
  });

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
      ];

      (TransactionItem.findAll as jest.Mock).mockResolvedValue(mockData);

      const result = await salesAnalyticsService.getProductPerformance(
        '2024-01-01',
        '2024-01-02',
        10,
        'top'
      );

      expect(TransactionItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            'product_id',
            'product_name',
            expect.arrayContaining(['SUM(quantity)', 'total_quantity']),
            expect.arrayContaining(['SUM(quantity * unit_price)', 'total_revenue']),
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
      );

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
      ]);
    });

    it('should return bottom performing products', async () => {
      (TransactionItem.findAll as jest.Mock).mockResolvedValue([]);

      await salesAnalyticsService.getProductPerformance(
        '2024-01-01',
        '2024-01-02',
        5,
        'bottom'
      );

      expect(TransactionItem.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['total_quantity', 'ASC']],
          limit: 5,
        })
      );
    });
  });

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
      ];

      (SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData);

      const result = await salesAnalyticsService.getCashierPerformance(
        '2024-01-01',
        '2024-01-02'
      );

      expect(SalesTransaction.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            'cashier_id',
            'cashier_name',
            expect.arrayContaining(['COUNT(*)', 'total_transactions']),
            expect.arrayContaining(['SUM(total_amount)', 'total_revenue']),
            expect.arrayContaining(['AVG(total_amount)', 'avg_transaction_value']),
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
      );

      expect(result).toEqual([
        {
          cashier_id: 1,
          cashier_name: 'John Doe',
          total_transactions: 45,
          total_revenue: 2250,
          avg_transaction_value: 50,
        },
      ]);
    });
  });

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
      ];

      (SalesTransaction.findAll as jest.Mock).mockResolvedValue(mockData);

      const result = await salesAnalyticsService.getPaymentMethodBreakdown(
        '2024-01-01',
        '2024-01-02'
      );

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
      ]);
    });

    it('should handle empty payment method data', async () => {
      (SalesTransaction.findAll as jest.Mock).mockResolvedValue([]);

      const result = await salesAnalyticsService.getPaymentMethodBreakdown(
        '2024-01-01',
        '2024-01-02'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive dashboard summary', async () => {
      // Mock total transactions and revenue
      (SalesTransaction.findAll as jest.Mock)
        .mockResolvedValueOnce([
          {
            total_revenue: '5000.00',
            total_transactions: '100',
            avg_transaction_value: '50.00',
          },
        ])
        // Mock top product
        .mockResolvedValueOnce([
          {
            product_name: 'Croissant',
            total_quantity: '150',
          },
        ])
        // Mock previous period for growth calculation
        .mockResolvedValueOnce([
          {
            total_revenue: '4000.00',
          },
        ]);

      // Mock product count
      (TransactionItem.findAll as jest.Mock).mockResolvedValue([
        { distinct_products: '25' },
      ]);

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      );

      expect(result).toEqual({
        totalRevenue: 5000,
        totalTransactions: 100,
        avgTransactionValue: 50,
        totalProducts: 25,
        topProduct: {
          name: 'Croissant',
          quantity: 150,
        },
        growthRate: 25.0,
      });
    });

    it('should handle no previous period data for growth calculation', async () => {
      (SalesTransaction.findAll as jest.Mock)
        .mockResolvedValueOnce([
          {
            total_revenue: '5000.00',
            total_transactions: '100',
            avg_transaction_value: '50.00',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (TransactionItem.findAll as jest.Mock).mockResolvedValue([
        { distinct_products: '25' },
      ]);

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      );

      expect(result.growthRate).toBe(0);
    });

    it('should handle empty current period data', async () => {
      (SalesTransaction.findAll as jest.Mock).mockResolvedValue([]);
      (TransactionItem.findAll as jest.Mock).mockResolvedValue([]);

      const result = await salesAnalyticsService.getDashboardSummary(
        '2024-01-01',
        '2024-01-02'
      );

      expect(result.totalRevenue).toBe(0);
      expect(result.totalTransactions).toBe(0);
      expect(result.avgTransactionValue).toBe(0);
      expect(result.totalProducts).toBe(0);
      expect(result.topProduct).toBeNull();
      expect(result.growthRate).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      (SalesTransaction.findAll as jest.Mock).mockRejectedValue(dbError);

      await expect(
        salesAnalyticsService.getRevenueTrends('2024-01-01', '2024-01-02')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid date formats', async () => {
      (SalesTransaction.findAll as jest.Mock).mockResolvedValue([]);

      // Test with invalid date format - service should still call with provided dates
      const result = await salesAnalyticsService.getRevenueTrends(
        'invalid-date',
        '2024-01-02'
      );

      expect(SalesTransaction.findAll).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});