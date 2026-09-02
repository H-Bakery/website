import { Sequelize, DataTypes } from 'sequelize'
import { Request, Response } from 'express'
import { importController } from './import.controller'
import { importService } from '../services/import.service'
import { initializeSalesAnalyticsModels } from '@bakery/api/sales-analytics'
import type { DailyReport } from '@bakery/shared/types'

describe('ImportController Integration Tests', () => {
  let sequelize: Sequelize
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeAll(async () => {
    // Setup in-memory SQLite database
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })

    // Initialize models
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
    })

    const Product = sequelize.define('Product', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      category: DataTypes.STRING,
      description: DataTypes.TEXT,
    })

    // Initialize sales analytics models
    initializeSalesAnalyticsModels(sequelize)

    // Initialize import service
    importService.initialize(sequelize)

    // Sync database
    await sequelize.sync({ force: true })

    // Create test data
    await User.bulkCreate([
      {
        username: 'john.doe',
        email: 'john@test.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        username: 'jane.smith',
        email: 'jane@test.com',
        firstName: 'Jane',
        lastName: 'Smith',
      },
    ])

    await Product.bulkCreate([
      { id: 1, name: 'Croissant', price: 2.5, category: 'Gebäck' },
      { id: 2, name: 'Baguette', price: 1.8, category: 'Brot' },
      { id: 3, name: 'Pain au Chocolat', price: 3.0, category: 'Gebäck' },
    ])
  })

  afterAll(async () => {
    await sequelize.close()
  })

  beforeEach(async () => {
    // Clear transaction data between tests
    const { SalesTransaction, TransactionItem, DailySalesReport } =
      sequelize.models
    await TransactionItem.destroy({ where: {} })
    await SalesTransaction.destroy({ where: {} })
    await DailySalesReport.destroy({ where: {} })

    // Setup response mocks
    jsonMock = jest.fn()
    statusMock = jest.fn().mockReturnThis()
    mockRes = {
      json: jsonMock,
      status: statusMock,
    }
  })

  describe('POST /api/import/sales-report', () => {
    const validReport: DailyReport = {
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
            {
              product: 'Baguette',
              product_id: '2',
              quantity: 1,
              price: 1.8,
              total: 1.8,
            },
          ],
          total: 6.8,
          payment: 'Bar',
        },
        {
          id: 'TX002',
          timestamp: '2024-01-15T11:00:00Z',
          type: 'sale',
          user: 'jane.smith',
          items: [
            {
              product: 'Pain au Chocolat',
              product_id: '3',
              quantity: 3,
              price: 3.0,
              total: 9.0,
            },
          ],
          total: 9.0,
          payment: 'Unbar',
        },
      ],
      daily_summary: {
        total_revenue: 15.8,
        cash_revenue: 6.8,
        transaction_count: 2,
        vat_totals: { '19%': 3.0 },
      },
    }

    it('should successfully import a new sales report', async () => {
      mockReq = { body: validReport }

      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(201)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          reportId: expect.any(Number),
          date: '2024-01-15',
          transactionsImported: 2,
          itemsImported: 3,
        },
        message: 'Sales report imported successfully',
      })

      // Verify data in database
      const { SalesTransaction, TransactionItem, DailySalesReport } =
        sequelize.models

      const transactions = await SalesTransaction.findAll({
        order: [['transaction_id', 'ASC']],
      })
      expect(transactions).toHaveLength(2)
      expect(transactions[0].getDataValue('transaction_id')).toBe('TX001')
      expect(transactions[0].getDataValue('user_id')).toBe(1) // john.doe
      expect(transactions[0].getDataValue('total')).toBe('6.80')

      const items = await TransactionItem.findAll({ order: [['id', 'ASC']] })
      expect(items).toHaveLength(3)
      expect(items[0].getDataValue('product_id')).toBe(1) // Croissant
      expect(items[0].getDataValue('quantity')).toBe(2)

      const dailyReport = await DailySalesReport.findOne({
        where: { date: '2024-01-15' },
      })
      expect(dailyReport).toBeTruthy()
      expect(dailyReport?.getDataValue('total_revenue')).toBe('15.80')
      expect(dailyReport?.getDataValue('transaction_count')).toBe(2)
    })

    it('should reject duplicate report for same date', async () => {
      // First import
      mockReq = { body: validReport }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      // Reset mocks
      jsonMock.mockClear()
      statusMock.mockClear()

      // Try to import same date again
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(409)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Report for date 2024-01-15 already exists',
      })
    })

    it('should handle refund transactions correctly', async () => {
      const reportWithRefund: DailyReport = {
        ...validReport,
        date: '2024-01-16',
        transactions: [
          {
            id: 'TX003',
            timestamp: '2024-01-16T10:00:00Z',
            type: 'sale',
            user: 'john.doe',
            items: [
              {
                product: 'Croissant',
                product_id: '1',
                quantity: 5,
                price: 2.5,
                total: 12.5,
              },
            ],
            total: 12.5,
            payment: 'Bar',
          },
          {
            id: 'TX004',
            timestamp: '2024-01-16T11:00:00Z',
            type: 'refund',
            user: 'john.doe',
            items: [
              {
                product: 'Croissant',
                product_id: '1',
                quantity: 1,
                price: 2.5,
                total: 2.5,
              },
            ],
            total: 2.5,
            payment: 'Bar',
          },
        ],
        daily_summary: {
          total_revenue: 10.0, // 12.50 - 2.50
          cash_revenue: 10.0,
          transaction_count: 1, // Only sales count
          vat_totals: { '19%': 1.9 },
        },
      }

      mockReq = { body: reportWithRefund }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(201)

      // Verify refund transaction in database
      const { SalesTransaction } = sequelize.models
      const refundTx = await SalesTransaction.findOne({
        where: { transaction_id: 'TX004' },
      })
      expect(refundTx?.getDataValue('type')).toBe('refund')
      expect(refundTx?.getDataValue('total')).toBe('2.50')
    })

    it('should return 422 for missing user', async () => {
      const reportWithMissingUser: DailyReport = {
        ...validReport,
        date: '2024-01-17',
        transactions: [
          {
            ...validReport.transactions[0],
            user: 'unknown.user',
          },
        ],
      }

      mockReq = { body: reportWithMissingUser }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(422)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('User not found: unknown.user'),
      })
    })

    it('should return 422 for missing product', async () => {
      const reportWithMissingProduct: DailyReport = {
        ...validReport,
        date: '2024-01-18',
        transactions: [
          {
            ...validReport.transactions[0],
            items: [
              {
                product: 'Unknown Product',
                product_id: '999',
                quantity: 1,
                price: 5.0,
                total: 5.0,
              },
            ],
          },
        ],
      }

      mockReq = { body: reportWithMissingProduct }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(422)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Product not found: 999'),
      })
    })
  })

  describe('POST /api/import/sales-reports/bulk', () => {
    it('should process bulk import with mixed results', async () => {
      const bulkReports: DailyReport[] = [
        {
          // Valid report
          date: '2024-01-20',
          register_id: 'REG001',
          report_number: 20,
          company: 'Test Bakery',
          transactions: [
            {
              id: 'TX020',
              timestamp: '2024-01-20T10:00:00Z',
              type: 'sale',
              user: 'john.doe',
              items: [
                {
                  product: 'Croissant',
                  product_id: '1',
                  quantity: 1,
                  price: 2.5,
                  total: 2.5,
                },
              ],
              total: 2.5,
              payment: 'Bar',
            },
          ],
          daily_summary: {
            total_revenue: 2.5,
            cash_revenue: 2.5,
            transaction_count: 1,
            vat_totals: { '19%': 0.48 },
          },
        },
        {
          // Invalid report (missing user)
          date: '2024-01-21',
          register_id: 'REG001',
          report_number: 21,
          company: 'Test Bakery',
          transactions: [
            {
              id: 'TX021',
              timestamp: '2024-01-21T10:00:00Z',
              type: 'sale',
              user: 'missing.user',
              items: [
                {
                  product: 'Baguette',
                  product_id: '2',
                  quantity: 1,
                  price: 1.8,
                  total: 1.8,
                },
              ],
              total: 1.8,
              payment: 'Unbar',
            },
          ],
          daily_summary: {
            total_revenue: 1.8,
            cash_revenue: 0,
            transaction_count: 1,
            vat_totals: { '19%': 0.34 },
          },
        },
      ]

      // First, import one report to create a duplicate
      const duplicateReport: DailyReport = {
        date: '2024-01-22',
        register_id: 'REG001',
        report_number: 22,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      }

      mockReq = { body: duplicateReport }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      // Add duplicate to bulk reports
      bulkReports.push(duplicateReport)

      // Now test bulk import
      mockReq = { body: { reports: bulkReports } }
      jsonMock.mockClear()
      statusMock.mockClear()

      await importController.importSalesReportsBulk(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(201)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 3,
          imported: 1,
          skipped: 1,
          failed: 1,
          details: expect.arrayContaining([
            expect.objectContaining({
              date: '2024-01-20',
              status: 'imported',
            }),
            expect.objectContaining({
              date: '2024-01-21',
              status: 'failed',
              error: expect.stringContaining('User not found: missing.user'),
            }),
            expect.objectContaining({
              date: '2024-01-22',
              status: 'skipped',
              error: 'Duplicate report',
            }),
          ]),
        },
        message: 'Bulk import completed',
      })
    })
  })

  describe('GET /api/import/status/:date', () => {
    it('should return correct import status', async () => {
      // Import a report first
      const report: DailyReport = {
        date: '2024-01-25',
        register_id: 'REG001',
        report_number: 25,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      }

      mockReq = { body: report }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      // Check status for imported date
      mockReq = { params: { date: '2024-01-25' } }
      jsonMock.mockClear()
      statusMock.mockClear()

      await importController.checkImportStatus(
        mockReq as Request,
        mockRes as Response
      )

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2024-01-25',
          imported: true,
        },
      })

      // Check status for non-imported date
      mockReq = { params: { date: '2024-01-26' } }
      jsonMock.mockClear()

      await importController.checkImportStatus(
        mockReq as Request,
        mockRes as Response
      )

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2024-01-26',
          imported: false,
        },
      })
    })
  })

  describe('Transaction rollback on error', () => {
    it('should rollback all changes on validation error', async () => {
      const reportWithError: DailyReport = {
        date: '2024-01-30',
        register_id: 'REG001',
        report_number: 30,
        company: 'Test Bakery',
        transactions: [
          {
            id: 'TX030',
            timestamp: '2024-01-30T10:00:00Z',
            type: 'sale',
            user: 'john.doe',
            items: [
              {
                product: 'Croissant',
                product_id: '1',
                quantity: 1,
                price: 2.5,
                total: 2.5,
              },
            ],
            total: 2.5,
            payment: 'Bar',
          },
          {
            id: 'TX031',
            timestamp: '2024-01-30T11:00:00Z',
            type: 'sale',
            user: 'invalid.user', // This user doesn't exist
            items: [
              {
                product: 'Baguette',
                product_id: '2',
                quantity: 1,
                price: 1.8,
                total: 1.8,
              },
            ],
            total: 1.8,
            payment: 'Unbar',
          },
        ],
        daily_summary: {
          total_revenue: 4.3,
          cash_revenue: 2.5,
          transaction_count: 2,
          vat_totals: { '19%': 0.82 },
        },
      }

      mockReq = { body: reportWithError }
      await importController.importSalesReport(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(422)

      // Verify no data was saved
      const { SalesTransaction, TransactionItem, DailySalesReport } =
        sequelize.models

      const transactions = await SalesTransaction.findAll({
        where: { date: '2024-01-30' },
      })
      expect(transactions).toHaveLength(0)

      const dailyReport = await DailySalesReport.findOne({
        where: { date: '2024-01-30' },
      })
      expect(dailyReport).toBeNull()
    })
  })
})
