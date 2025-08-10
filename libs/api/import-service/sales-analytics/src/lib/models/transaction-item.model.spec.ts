import { Sequelize, DataTypes } from 'sequelize';
import { SalesTransaction } from './sales-transaction.model';
import { TransactionItem } from './transaction-item.model';

describe('TransactionItem Model', () => {
  let sequelize: Sequelize;
  let testTransaction: SalesTransaction;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    // Initialize models
    SalesTransaction.initialize(sequelize);
    TransactionItem.initialize(sequelize);

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
    const models = { SalesTransaction, TransactionItem, Product };
    SalesTransaction.associate(models);
    TransactionItem.associate(models);

    await sequelize.sync({ force: true });

    // Create test data
    await Product.create({ id: 1, name: 'Croissant' });
    await Product.create({ id: 2, name: 'Baguette' });

    testTransaction = await SalesTransaction.create({
      transactionId: 'TEST-TRANS-001',
      transactionDate: new Date(),
      totalAmount: 10,
      paymentMethod: 'Bar',
      userId: 'user-123',
      registerNumber: 'REG-001',
      type: 'sale',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Model Creation', () => {
    it('should create a transaction item successfully', async () => {
      const item = await TransactionItem.create({
        salesTransactionId: testTransaction.id,
        productId: 1,
        productName: 'Croissant',
        quantity: 2,
        pricePerItem: 2.50,
        totalPrice: 5.00,
      });

      expect(item.id).toBeDefined();
      expect(item.productName).toBe('Croissant');
      expect(item.quantity).toBe(2);
      expect(item.totalPrice).toBe(5.00);
    });

    it('should validate required fields', async () => {
      await expect(
        TransactionItem.create({
          salesTransactionId: testTransaction.id,
          productId: 1,
          productName: '',
          quantity: 1,
          pricePerItem: 1,
          totalPrice: 1,
        })
      ).rejects.toThrow('Product name cannot be empty');
    });
  });

  describe('Validations', () => {
    it('should not allow quantity less than 1', async () => {
      await expect(
        TransactionItem.create({
          salesTransactionId: testTransaction.id,
          productId: 1,
          productName: 'Test Product',
          quantity: 0,
          pricePerItem: 1,
          totalPrice: 0,
        })
      ).rejects.toThrow('Quantity must be at least 1');
    });

    it('should not allow negative prices', async () => {
      await expect(
        TransactionItem.create({
          salesTransactionId: testTransaction.id,
          productId: 1,
          productName: 'Test Product',
          quantity: 1,
          pricePerItem: -5,
          totalPrice: -5,
        })
      ).rejects.toThrow('Price per item cannot be negative');
    });
  });

  describe('Associations', () => {
    it('should belong to a sales transaction', async () => {
      const item = await TransactionItem.create({
        salesTransactionId: testTransaction.id,
        productId: 1,
        productName: 'Croissant',
        quantity: 1,
        pricePerItem: 2.50,
        totalPrice: 2.50,
      });

      const itemWithTransaction = await TransactionItem.findByPk(item.id, {
        include: [{
          model: SalesTransaction,
          as: 'salesTransaction',
        }],
      });

      expect(itemWithTransaction?.salesTransaction).toBeDefined();
      expect(itemWithTransaction?.salesTransaction?.transactionId).toBe('TEST-TRANS-001');
    });

    it('should cascade delete when transaction is deleted', async () => {
      const transaction = await SalesTransaction.create({
        transactionId: 'CASCADE-TEST',
        transactionDate: new Date(),
        totalAmount: 5,
        paymentMethod: 'Bar',
        userId: 'user-123',
        registerNumber: 'REG-001',
        type: 'sale',
      });

      const item = await TransactionItem.create({
        salesTransactionId: transaction.id,
        productId: 1,
        productName: 'Test',
        quantity: 1,
        pricePerItem: 5,
        totalPrice: 5,
      });

      await transaction.destroy();

      const deletedItem = await TransactionItem.findByPk(item.id);
      expect(deletedItem).toBeNull();
    });
  });
});