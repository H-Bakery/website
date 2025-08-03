import express, { Express } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import { importRoutes } from './import.routes';
import { importService } from '../services/import.service';
import { initSalesAnalyticsModels } from '@bakery/api/sales-analytics';
import { authMiddleware } from '@bakery/api/core';
import type { DailyReport } from '@bakery/shared/types';
import jwt from 'jsonwebtoken';

// Mock auth middleware for testing
jest.mock('@bakery/api/core', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    if (token === 'valid-token') {
      req.user = { id: 1, username: 'admin', role: 'admin' };
      next();
    } else if (token === 'user-token') {
      req.user = { id: 2, username: 'user', role: 'user' };
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Import Routes Integration Tests', () => {
  let app: Express;
  let sequelize: Sequelize;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Setup in-memory SQLite database
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    // Initialize models
    const User = sequelize.define('User', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING,
        defaultValue: 'user',
      },
    });

    const Product = sequelize.define('Product', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      category: Sequelize.STRING,
    });

    // Initialize sales analytics models
    initSalesAnalyticsModels(sequelize);
    
    // Initialize import service
    importService.initialize(sequelize);

    // Mount routes
    app.use('/api/import', importRoutes);

    // Sync database
    await sequelize.sync({ force: true });

    // Create test data
    await User.bulkCreate([
      { username: 'admin', email: 'admin@test.com', role: 'admin' },
      { username: 'john.doe', email: 'john@test.com', role: 'user' },
      { username: 'jane.smith', email: 'jane@test.com', role: 'user' },
    ]);

    await Product.bulkCreate([
      { id: 1, name: 'Croissant', price: 2.50, category: 'Gebäck' },
      { id: 2, name: 'Baguette', price: 1.80, category: 'Brot' },
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear transaction data between tests
    const { SalesTransaction, TransactionItem, DailySalesReport } = sequelize.models;
    await TransactionItem.destroy({ where: {} });
    await SalesTransaction.destroy({ where: {} });
    await DailySalesReport.destroy({ where: {} });
  });

  describe('Authentication and Authorization', () => {
    const validReport: DailyReport = {
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

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .send(validReport);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer invalid-token')
        .send(validReport);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });

    it('should allow admin users to import reports', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .send(validReport);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should check if regular users can import (depends on middleware implementation)', async () => {
      // This test depends on whether authMiddleware checks for admin role
      // For now, assuming all authenticated users can import
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer user-token')
        .send(validReport);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/import/sales-report', () => {
    const validReport: DailyReport = {
      date: '2024-02-01',
      register_id: 'REG001',
      report_number: 1,
      company: 'Test Bakery',
      transactions: [
        {
          id: 'TX001',
          timestamp: '2024-02-01T10:00:00Z',
          type: 'sale',
          user: 'john.doe',
          items: [
            {
              product: 'Croissant',
              product_id: '1',
              quantity: 2,
              price: 2.50,
              total: 5.00,
            },
          ],
          total: 5.00,
          payment: 'Bar',
        },
      ],
      daily_summary: {
        total_revenue: 5.00,
        cash_revenue: 5.00,
        transaction_count: 1,
        vat_totals: { '19%': 0.95 },
      },
    };

    it('should handle valid report with complete response structure', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .send(validReport);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          reportId: expect.any(Number),
          date: '2024-02-01',
          transactionsImported: 1,
          itemsImported: 1,
        },
        message: 'Sales report imported successfully',
      });
    });

    it('should validate request body structure', async () => {
      const invalidReport = {
        // Missing required fields
        date: '2024-02-02',
        transactions: [],
      };

      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidReport);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should handle large payloads efficiently', async () => {
      const largeReport: DailyReport = {
        date: '2024-02-03',
        register_id: 'REG001',
        report_number: 3,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      };

      // Add 100 transactions
      for (let i = 0; i < 100; i++) {
        largeReport.transactions.push({
          id: `TX${i.toString().padStart(3, '0')}`,
          timestamp: `2024-02-03T${(10 + Math.floor(i / 10)).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00Z`,
          type: 'sale',
          user: i % 2 === 0 ? 'john.doe' : 'jane.smith',
          items: [
            {
              product: i % 2 === 0 ? 'Croissant' : 'Baguette',
              product_id: i % 2 === 0 ? '1' : '2',
              quantity: 1,
              price: i % 2 === 0 ? 2.50 : 1.80,
              total: i % 2 === 0 ? 2.50 : 1.80,
            },
          ],
          total: i % 2 === 0 ? 2.50 : 1.80,
          payment: i % 3 === 0 ? 'Bar' : 'Unbar',
        });
        largeReport.daily_summary.total_revenue += largeReport.transactions[i].total;
        largeReport.daily_summary.transaction_count++;
      }

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .send(largeReport);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(response.body.data.transactionsImported).toBe(100);
      expect(response.body.data.itemsImported).toBe(100);
      
      // Should complete within reasonable time (5 seconds for 100 transactions)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('POST /api/import/sales-reports/bulk', () => {
    it('should handle bulk imports with proper batching', async () => {
      const reports: DailyReport[] = [];
      
      // Create 10 reports
      for (let day = 10; day < 20; day++) {
        reports.push({
          date: `2024-02-${day}`,
          register_id: 'REG001',
          report_number: day,
          company: 'Test Bakery',
          transactions: [
            {
              id: `TX${day}01`,
              timestamp: `2024-02-${day}T10:00:00Z`,
              type: 'sale',
              user: 'john.doe',
              items: [
                {
                  product: 'Croissant',
                  product_id: '1',
                  quantity: 1,
                  price: 2.50,
                  total: 2.50,
                },
              ],
              total: 2.50,
              payment: 'Bar',
            },
          ],
          daily_summary: {
            total_revenue: 2.50,
            cash_revenue: 2.50,
            transaction_count: 1,
            vat_totals: { '19%': 0.48 },
          },
        });
      }

      const response = await request(app)
        .post('/api/import/sales-reports/bulk')
        .set('Authorization', 'Bearer valid-token')
        .send({ reports });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          total: 10,
          imported: 10,
          skipped: 0,
          failed: 0,
          details: expect.any(Array),
        },
        message: 'Bulk import completed',
      });

      expect(response.body.data.details).toHaveLength(10);
      response.body.data.details.forEach((detail: any) => {
        expect(detail.status).toBe('imported');
      });
    });

    it('should handle empty array gracefully', async () => {
      const response = await request(app)
        .post('/api/import/sales-reports/bulk')
        .set('Authorization', 'Bearer valid-token')
        .send({ reports: [] });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          total: 0,
          imported: 0,
          skipped: 0,
          failed: 0,
          details: [],
        },
      });
    });
  });

  describe('GET /api/import/status/:date', () => {
    it('should check status with proper date validation', async () => {
      // Valid date format
      const response1 = await request(app)
        .get('/api/import/status/2024-02-25')
        .set('Authorization', 'Bearer valid-token');

      expect(response1.status).toBe(200);
      expect(response1.body).toMatchObject({
        success: true,
        data: {
          date: '2024-02-25',
          imported: false,
        },
      });

      // Invalid date format
      const response2 = await request(app)
        .get('/api/import/status/02-25-2024')
        .set('Authorization', 'Bearer valid-token');

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('Invalid date format');
    });

    it('should handle URL encoding in date parameter', async () => {
      // Some HTTP clients might encode the date
      const response = await request(app)
        .get('/api/import/status/2024%2D02%2D26')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.date).toBe('2024-02-26');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle missing content-type', async () => {
      const response = await request(app)
        .post('/api/import/sales-report')
        .set('Authorization', 'Bearer valid-token')
        .send('some data');

      expect(response.status).toBe(400);
    });
  });
});