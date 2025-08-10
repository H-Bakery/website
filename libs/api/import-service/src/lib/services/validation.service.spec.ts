import { Sequelize } from 'sequelize';
import { validationService } from './validation.service';
import type { DailyReport } from '@bakery/shared/types';

// Mock logger
jest.mock('@bakery/api/core', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ValidationService', () => {
  let sequelize: Sequelize;
  let mockModels: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModels = {
      User: {
        findOne: jest.fn(),
      },
      Product: {
        findByPk: jest.fn(),
      },
    };

    sequelize = {
      models: mockModels,
    } as any;
  });

  describe('validateReportData', () => {
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
              price: 2.50,
              total: 5.00,
            },
            {
              product: 'Baguette',
              product_id: '2',
              quantity: 1,
              price: 1.80,
              total: 1.80,
            },
          ],
          total: 6.80,
          payment: 'Bar',
        },
        {
          id: 'TX002',
          timestamp: '2024-01-15T11:00:00Z',
          type: 'sale',
          user: 'jane.smith',
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
          payment: 'Unbar',
        },
      ],
      daily_summary: {
        total_revenue: 9.30,
        cash_revenue: 6.80,
        transaction_count: 2,
        vat_totals: { '19%': 1.77 },
      },
    };

    it('should pass validation when all users and products exist', async () => {
      // Mock all users and products exist
      mockModels.User.findOne.mockResolvedValue({ id: 1 });
      mockModels.Product.findByPk.mockResolvedValue({ id: 1 });

      await expect(validationService.validateReportData(mockReport, sequelize))
        .resolves.not.toThrow();

      // Check correct number of calls
      expect(mockModels.User.findOne).toHaveBeenCalledTimes(2); // 2 unique users
      expect(mockModels.Product.findByPk).toHaveBeenCalledTimes(2); // 2 unique products
    });

    it('should throw error when user not found', async () => {
      // First user exists, second doesn't
      mockModels.User.findOne
        .mockResolvedValueOnce({ id: 1 }) // john.doe exists
        .mockResolvedValueOnce(null);     // jane.smith doesn't exist
      
      mockModels.Product.findByPk.mockResolvedValue({ id: 1 });

      await expect(validationService.validateReportData(mockReport, sequelize))
        .rejects.toThrow('Validation failed: User not found: jane.smith');
    });

    it('should throw error when product not found', async () => {
      mockModels.User.findOne.mockResolvedValue({ id: 1 });
      
      // First product exists, second doesn't
      mockModels.Product.findByPk
        .mockResolvedValueOnce({ id: 1 }) // Product 1 exists
        .mockResolvedValueOnce(null);     // Product 2 doesn't exist

      await expect(validationService.validateReportData(mockReport, sequelize))
        .rejects.toThrow('Validation failed: Product not found: 2');
    });

    it('should report all validation errors at once', async () => {
      // No users or products exist
      mockModels.User.findOne.mockResolvedValue(null);
      mockModels.Product.findByPk.mockResolvedValue(null);

      await expect(validationService.validateReportData(mockReport, sequelize))
        .rejects.toThrow(
          'Validation failed: User not found: john.doe, User not found: jane.smith, ' +
          'Product not found: 1, Product not found: 2'
        );
    });
  });

  describe('validateTransactionTotals', () => {
    it('should pass when transaction totals match item totals', () => {
      const report: DailyReport = {
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
              { product: 'A', product_id: '1', quantity: 2, price: 2.50, total: 5.00 },
              { product: 'B', product_id: '2', quantity: 1, price: 1.80, total: 1.80 },
            ],
            total: 6.80,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 6.80,
          cash_revenue: 6.80,
          transaction_count: 1,
          vat_totals: {},
        },
      };

      expect(() => validationService.validateTransactionTotals(report)).not.toThrow();
    });

    it('should throw error when transaction total does not match item totals', () => {
      const report: DailyReport = {
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
              { product: 'A', product_id: '1', quantity: 2, price: 2.50, total: 5.00 },
              { product: 'B', product_id: '2', quantity: 1, price: 1.80, total: 1.80 },
            ],
            total: 10.00, // Wrong total
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 10.00,
          cash_revenue: 10.00,
          transaction_count: 1,
          vat_totals: {},
        },
      };

      expect(() => validationService.validateTransactionTotals(report))
        .toThrow('Transaction TX001 total mismatch: calculated 6.8, reported 10');
    });
  });

  describe('validateDailySummary', () => {
    it('should pass when daily summary matches transactions', () => {
      const report: DailyReport = {
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
            items: [],
            total: 10.00,
            payment: 'Bar',
          },
          {
            id: 'TX002',
            timestamp: '2024-01-15T11:00:00Z',
            type: 'sale',
            user: 'jane.smith',
            items: [],
            total: 5.00,
            payment: 'Unbar',
          },
          {
            id: 'TX003',
            timestamp: '2024-01-15T12:00:00Z',
            type: 'refund',
            user: 'john.doe',
            items: [],
            total: 2.00,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 13.00, // 10 + 5 - 2
          cash_revenue: 8.00,
          transaction_count: 2, // Only sales count
          vat_totals: {},
        },
      };

      expect(() => validationService.validateDailySummary(report)).not.toThrow();
    });

    it('should throw error when daily summary total does not match', () => {
      const report: DailyReport = {
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
            items: [],
            total: 10.00,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 15.00, // Wrong total
          cash_revenue: 10.00,
          transaction_count: 1,
          vat_totals: {},
        },
      };

      expect(() => validationService.validateDailySummary(report))
        .toThrow('Daily summary total mismatch: calculated 10, reported 15');
    });
  });
});