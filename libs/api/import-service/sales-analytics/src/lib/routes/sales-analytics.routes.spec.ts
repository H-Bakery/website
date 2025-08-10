import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import salesAnalyticsRoutes from './sales-analytics.routes';
import { salesAnalyticsService } from '../services/sales-analytics.service';

// Mock the service
jest.mock('../services/sales-analytics.service', () => ({
  salesAnalyticsService: {
    getRevenueTrends: jest.fn(),
    getProductPerformance: jest.fn(),
    getCashierPerformance: jest.fn(),
    getPaymentMethodBreakdown: jest.fn(),
    getDashboardSummary: jest.fn(),
  },
}));

// Mock authentication middleware
jest.mock('@bakery/api/core', () => ({
  authenticate: jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    try {
      jwt.verify(token, 'test-secret');
      req.user = { id: 1, username: 'testuser' };
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Sales Analytics Routes', () => {
  let app: express.Application;
  let validToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics/sales', salesAnalyticsRoutes);
    
    // Create a valid JWT token for testing
    validToken = jwt.sign({ id: 1, username: 'testuser' }, 'test-secret');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /revenue-trends', () => {
    it('should return revenue trends with valid parameters', async () => {
      const mockTrends = [
        { date: '2024-01-01', revenue: 1500, transactions: 25 },
        { date: '2024-01-02', revenue: 1800, transactions: 30 },
      ];

      (salesAnalyticsService.getRevenueTrends as jest.Mock).mockResolvedValue(mockTrends);

      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          granularity: 'daily',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrends);
      expect(response.body.meta).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        granularity: 'daily',
        count: 2,
      });
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          // Missing endDate
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'endDate',
            message: 'endDate is required',
          }),
        ])
      );
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: 'invalid-date',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'startDate',
            message: 'startDate must be in YYYY-MM-DD format',
          }),
        ])
      );
    });

    it('should validate granularity parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          granularity: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'granularity',
            message: 'granularity must be one of: daily, weekly, monthly',
          }),
        ])
      );
    });

    it('should validate date range', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-02',
          endDate: '2024-01-01', // End date before start date
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'endDate',
            message: 'endDate must be after or equal to startDate',
          }),
        ])
      );
    });

    it('should validate future dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: futureDateStr,
          endDate: futureDateStr,
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'startDate',
            message: 'startDate cannot be in the future',
          }),
        ])
      );
    });
  });

  describe('GET /product-performance', () => {
    it('should return product performance with pagination', async () => {
      const mockProducts = [
        {
          product_id: 1,
          product_name: 'Croissant',
          total_quantity: 150,
          total_revenue: 750,
          avg_price: 5.0,
        },
      ];

      (salesAnalyticsService.getProductPerformance as jest.Mock).mockResolvedValue(mockProducts);

      const response = await request(app)
        .get('/api/analytics/sales/product-performance')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          page: '2',
          limit: '5',
          sort: 'bottom',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProducts);
      expect(response.body.meta).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        sort: 'bottom',
        page: 2,
        limit: 5,
        count: 1,
      });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/product-performance')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          page: '0', // Invalid page
          limit: '101', // Limit too high
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            message: 'page must be a positive integer',
          }),
          expect.objectContaining({
            field: 'limit',
            message: 'limit must be between 1 and 100',
          }),
        ])
      );
    });

    it('should validate sort parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/product-performance')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          sort: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'sort',
            message: 'sort must be either "top" or "bottom"',
          }),
        ])
      );
    });
  });

  describe('GET /cashier-performance', () => {
    it('should return cashier performance data', async () => {
      const mockCashiers = [
        {
          cashier_id: 1,
          cashier_name: 'John Doe',
          total_transactions: 45,
          total_revenue: 2250,
          avg_transaction_value: 50,
        },
      ];

      (salesAnalyticsService.getCashierPerformance as jest.Mock).mockResolvedValue(mockCashiers);

      const response = await request(app)
        .get('/api/analytics/sales/cashier-performance')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCashiers);
      expect(salesAnalyticsService.getCashierPerformance).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-02'
      );
    });
  });

  describe('GET /payment-methods', () => {
    it('should return payment method breakdown', async () => {
      const mockPaymentMethods = [
        { payment_method: 'cash', total_transactions: 25, total_amount: 1250, percentage: 55.6 },
        { payment_method: 'card', total_transactions: 20, total_amount: 1000, percentage: 44.4 },
      ];

      (salesAnalyticsService.getPaymentMethodBreakdown as jest.Mock).mockResolvedValue(
        mockPaymentMethods
      );

      const response = await request(app)
        .get('/api/analytics/sales/payment-methods')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPaymentMethods);
    });
  });

  describe('GET /summary', () => {
    it('should return dashboard summary', async () => {
      const mockSummary = {
        totalRevenue: 5000,
        totalTransactions: 100,
        avgTransactionValue: 50,
        totalProducts: 25,
        topProduct: { name: 'Croissant', quantity: 150 },
        growthRate: 15.5,
      };

      (salesAnalyticsService.getDashboardSummary as jest.Mock).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/sales/summary')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      (salesAnalyticsService.getRevenueTrends as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch revenue trends');
    });

    it('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', 'Bearer invalid-token')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Date Range Validation', () => {
    it('should reject date ranges longer than 2 years', async () => {
      const response = await request(app)
        .get('/api/analytics/sales/revenue-trends')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          startDate: '2022-01-01',
          endDate: '2024-01-02', // More than 2 years
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'endDate',
            message: 'Date range cannot exceed 2 years (730 days)',
          }),
        ])
      );
    });
  });
});