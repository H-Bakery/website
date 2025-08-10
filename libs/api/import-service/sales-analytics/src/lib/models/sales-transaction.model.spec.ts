import { Sequelize, DataTypes } from 'sequelize';
import { SalesTransaction } from './sales-transaction.model';
import { TransactionItem } from './transaction-item.model';

describe('SalesTransaction Model', () => {
  let sequelize: Sequelize;

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

    // Create test products
    await Product.create({ id: 1, name: 'Croissant' });
    await Product.create({ id: 2, name: 'Baguette' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Model Creation', () => {
    it('should create a sales transaction successfully', async () => {
      const transaction = await SalesTransaction.create({
        transactionId: 'TEST-001',
        transactionDate: new Date('2024-01-15T10:30:00'),
        totalAmount: 25.50,
        paymentMethod: 'Bar',
        userId: 'user-123',
        registerNumber: 'REG-001',
        type: 'sale',
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.transactionId).toBe('TEST-001');
      expect(transaction.totalAmount).toBe(25.50);
      expect(transaction.type).toBe('sale');
    });

    it('should enforce unique transactionId constraint', async () => {
      await SalesTransaction.create({
        transactionId: 'UNIQUE-001',
        transactionDate: new Date(),
        totalAmount: 10,
        paymentMethod: 'Bar',
        userId: 'user-123',
        registerNumber: 'REG-001',
        type: 'sale',
      });

      await expect(
        SalesTransaction.create({
          transactionId: 'UNIQUE-001',
          transactionDate: new Date(),
          totalAmount: 20,
          paymentMethod: 'Unbar',
          userId: 'user-456',
          registerNumber: 'REG-001',
          type: 'sale',
        })
      ).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      await expect(
        SalesTransaction.create({
          transactionId: '',
          transactionDate: new Date(),
          totalAmount: 10,
          paymentMethod: 'Bar',
          userId: 'user-123',
          registerNumber: 'REG-001',
          type: 'sale',
        })
      ).rejects.toThrow('Transaction ID cannot be empty');
    });
  });

  describe('Associations', () => {
    it('should have many transaction items', async () => {
      const transaction = await SalesTransaction.create({
        transactionId: 'ASSOC-001',
        transactionDate: new Date(),
        totalAmount: 50,
        paymentMethod: 'Bar',
        userId: 'user-123',
        registerNumber: 'REG-001',
        type: 'sale',
      });

      const item1 = await TransactionItem.create({
        salesTransactionId: transaction.id,
        productId: 1,
        productName: 'Croissant',
        quantity: 2,
        pricePerItem: 2.50,
        totalPrice: 5.00,
      });

      const item2 = await TransactionItem.create({
        salesTransactionId: transaction.id,
        productId: 2,
        productName: 'Baguette',
        quantity: 1,
        pricePerItem: 1.80,
        totalPrice: 1.80,
      });

      const transactionWithItems = await SalesTransaction.findByPk(transaction.id, {
        include: [{
          model: TransactionItem,
          as: 'transactionItems',
        }],
      });

      expect(transactionWithItems?.transactionItems).toHaveLength(2);
      expect(transactionWithItems?.transactionItems?.[0].productName).toBe('Croissant');
      expect(transactionWithItems?.transactionItems?.[1].productName).toBe('Baguette');
    });
  });

  describe('Validations', () => {
    it('should not allow negative total amount', async () => {
      await expect(
        SalesTransaction.create({
          transactionId: 'NEG-001',
          transactionDate: new Date(),
          totalAmount: -10,
          paymentMethod: 'Bar',
          userId: 'user-123',
          registerNumber: 'REG-001',
          type: 'sale',
        })
      ).rejects.toThrow('Total amount cannot be negative');
    });

    it('should only allow valid transaction types', async () => {
      const validTypes = ['sale', 'refund', 'adjustment'];
      
      for (const type of validTypes) {
        const transaction = await SalesTransaction.create({
          transactionId: `TYPE-${type}`,
          transactionDate: new Date(),
          totalAmount: 10,
          paymentMethod: 'Bar',
          userId: 'user-123',
          registerNumber: 'REG-001',
          type: type as any,
        });
        
        expect(transaction.type).toBe(type);
      }
    });
  });
});