import { Sequelize, DataTypes } from 'sequelize';
import { DailySalesReport } from './daily-sales-report.model';

describe('DailySalesReport Model', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    // Initialize model
    DailySalesReport.initialize(sequelize);

    // Mock Product model
    const Product = sequelize.define('Product', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: DataTypes.STRING,
    });

    // Set up associations
    const models = { DailySalesReport, Product };
    DailySalesReport.associate(models);

    await sequelize.sync({ force: true });

    // Create test products
    await Product.create({ id: 1, name: 'Croissant' });
    await Product.create({ id: 2, name: 'Baguette' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Model Creation', () => {
    it('should create a daily sales report successfully', async () => {
      const report = await DailySalesReport.create({
        reportDate: new Date('2024-01-15'),
        totalSales: 1250.50,
        cashSales: 850.00,
        totalTransactions: 45,
        mostPopularProductId: 1,
        vatTotals: {
          '0%': 100,
          '7%': 950.50,
          '19%': 200,
        },
        reportNumber: 15,
        registerId: 'REG-001',
      });

      expect(report.reportDate).toEqual('2024-01-15');
      expect(report.totalSales).toBe(1250.50);
      expect(report.cashSales).toBe(850.00);
      expect(report.totalTransactions).toBe(45);
      expect(report.vatTotals).toEqual({
        '0%': 100,
        '7%': 950.50,
        '19%': 200,
      });
    });

    it('should use reportDate as primary key', async () => {
      const date = new Date('2024-01-16');
      
      await DailySalesReport.create({
        reportDate: date,
        totalSales: 1000,
        cashSales: 500,
        totalTransactions: 30,
        reportNumber: 16,
        registerId: 'REG-001',
      });

      // Trying to create another report for the same date should fail
      await expect(
        DailySalesReport.create({
          reportDate: date,
          totalSales: 2000,
          cashSales: 1000,
          totalTransactions: 60,
          reportNumber: 16,
          registerId: 'REG-001',
        })
      ).rejects.toThrow();
    });
  });

  describe('Validations', () => {
    it('should not allow negative sales values', async () => {
      await expect(
        DailySalesReport.create({
          reportDate: new Date('2024-01-17'),
          totalSales: -100,
          cashSales: 0,
          totalTransactions: 10,
          reportNumber: 17,
          registerId: 'REG-001',
        })
      ).rejects.toThrow('Total sales cannot be negative');
    });

    it('should not allow negative transaction count', async () => {
      await expect(
        DailySalesReport.create({
          reportDate: new Date('2024-01-18'),
          totalSales: 100,
          cashSales: 50,
          totalTransactions: -5,
          reportNumber: 18,
          registerId: 'REG-001',
        })
      ).rejects.toThrow('Total transactions cannot be negative');
    });

    it('should not allow empty register ID', async () => {
      await expect(
        DailySalesReport.create({
          reportDate: new Date('2024-01-19'),
          totalSales: 100,
          cashSales: 50,
          totalTransactions: 10,
          reportNumber: 19,
          registerId: '',
        })
      ).rejects.toThrow('Register ID cannot be empty');
    });
  });

  describe('Instance Methods', () => {
    let testReport: DailySalesReport;

    beforeEach(async () => {
      // Clear existing data to avoid duplicate key errors
      await DailySalesReport.destroy({ where: {} });
      
      testReport = await DailySalesReport.create({
        reportDate: new Date('2024-01-20'),
        totalSales: 1500,
        cashSales: 900,
        totalTransactions: 50,
        reportNumber: 20,
        registerId: 'REG-001',
      });
    });

    it('should correctly identify high sales days', () => {
      expect(testReport.isHighSalesDay(1000)).toBe(true);
      expect(testReport.isHighSalesDay(2000)).toBe(false);
    });

    it('should calculate cash percentage correctly', () => {
      const percentage = testReport.getCashPercentage();
      expect(percentage).toBe(60); // 900 / 1500 * 100
    });

    it('should handle zero total sales for cash percentage', async () => {
      const zeroSalesReport = await DailySalesReport.create({
        reportDate: new Date('2024-01-21'),
        totalSales: 0,
        cashSales: 0,
        totalTransactions: 0,
        reportNumber: 21,
        registerId: 'REG-001',
      });

      expect(zeroSalesReport.getCashPercentage()).toBe(0);
    });

    it('should calculate average transaction value', () => {
      const avg = testReport.getAverageTransactionValue();
      expect(avg).toBe(30); // 1500 / 50
    });

    it('should handle zero transactions for average', async () => {
      const noTransReport = await DailySalesReport.create({
        reportDate: new Date('2024-01-22'),
        totalSales: 0,
        cashSales: 0,
        totalTransactions: 0,
        reportNumber: 22,
        registerId: 'REG-001',
      });

      expect(noTransReport.getAverageTransactionValue()).toBe(0);
    });
  });

  describe('Associations', () => {
    it('should associate with most popular product', async () => {
      const report = await DailySalesReport.create({
        reportDate: new Date('2024-01-23'),
        totalSales: 1000,
        cashSales: 500,
        totalTransactions: 30,
        mostPopularProductId: 1,
        reportNumber: 23,
        registerId: 'REG-001',
      });

      const reportWithProduct = await DailySalesReport.findOne({
        where: {
          reportDate: report.reportDate,
        },
        include: [{
          model: sequelize.models['Product'],
          as: 'mostPopularProduct',
        }],
      });

      expect(reportWithProduct?.mostPopularProduct).toBeDefined();
      expect(reportWithProduct?.mostPopularProduct?.name).toBe('Croissant');
    });
  });
});