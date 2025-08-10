import { Sequelize, DataTypes } from 'sequelize';
import { initializeSalesAnalyticsModels } from './models';

describe('Sales Analytics Module', () => {
  let sequelize: Sequelize;

  beforeEach(() => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    // Mock Product model
    sequelize.define('Product', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: DataTypes.STRING,
    });
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('should initialize all models successfully', async () => {
    await expect(initializeSalesAnalyticsModels(sequelize)).resolves.not.toThrow();

    // Verify models are registered
    expect(sequelize.models['SalesTransaction']).toBeDefined();
    expect(sequelize.models['TransactionItem']).toBeDefined();
    expect(sequelize.models['DailySalesReport']).toBeDefined();
  });

  it('should create tables successfully', async () => {
    await initializeSalesAnalyticsModels(sequelize);
    await sequelize.sync({ force: true });

    // Get table names
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    expect(tables).toContain('SalesTransactions');
    expect(tables).toContain('TransactionItems');
    expect(tables).toContain('DailySalesReports');
  });

  it('should set up associations correctly', async () => {
    await initializeSalesAnalyticsModels(sequelize);

    const { SalesTransaction, TransactionItem, DailySalesReport } = sequelize.models;

    // Check SalesTransaction associations
    expect(SalesTransaction.associations['transactionItems']).toBeDefined();
    expect(SalesTransaction.associations['transactionItems'].associationType).toBe('HasMany');

    // Check TransactionItem associations
    expect(TransactionItem.associations['salesTransaction']).toBeDefined();
    expect(TransactionItem.associations['salesTransaction'].associationType).toBe('BelongsTo');
    expect(TransactionItem.associations['product']).toBeDefined();
    expect(TransactionItem.associations['product'].associationType).toBe('BelongsTo');

    // Check DailySalesReport associations
    expect(DailySalesReport.associations['mostPopularProduct']).toBeDefined();
    expect(DailySalesReport.associations['mostPopularProduct'].associationType).toBe('BelongsTo');
  });
});