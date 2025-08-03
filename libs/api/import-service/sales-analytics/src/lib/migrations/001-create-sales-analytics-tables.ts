import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  // Create SalesTransactions table
  await queryInterface.createTable('SalesTransactions', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    registerNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('sale', 'refund', 'adjustment'),
      allowNull: false,
      defaultValue: 'sale',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // Create indexes for SalesTransactions
  await queryInterface.addIndex('SalesTransactions', ['transactionId'], {
    unique: true,
    name: 'idx_sales_transactions_transaction_id',
  });
  await queryInterface.addIndex('SalesTransactions', ['transactionDate'], {
    name: 'idx_sales_transactions_transaction_date',
  });
  await queryInterface.addIndex('SalesTransactions', ['userId'], {
    name: 'idx_sales_transactions_user_id',
  });

  // Create TransactionItems table
  await queryInterface.createTable('TransactionItems', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    salesTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'SalesTransactions',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Products',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    productName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Denormalized product name for historical accuracy',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pricePerItem: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    totalPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // Create indexes for TransactionItems
  await queryInterface.addIndex('TransactionItems', ['salesTransactionId'], {
    name: 'idx_transaction_items_sales_transaction_id',
  });
  await queryInterface.addIndex('TransactionItems', ['productId'], {
    name: 'idx_transaction_items_product_id',
  });

  // Create DailySalesReports table
  await queryInterface.createTable('DailySalesReports', {
    reportDate: {
      type: DataTypes.DATEONLY,
      primaryKey: true,
      allowNull: false,
    },
    totalSales: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    cashSales: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    totalTransactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    mostPopularProductId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Products',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    vatTotals: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'JSON object containing VAT breakdown',
    },
    reportNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    registerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // Create index for DailySalesReports
  await queryInterface.addIndex('DailySalesReports', ['reportDate'], {
    unique: true,
    name: 'idx_daily_sales_reports_report_date',
  });
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  // Drop indexes first
  await queryInterface.removeIndex('DailySalesReports', 'idx_daily_sales_reports_report_date');
  await queryInterface.removeIndex('TransactionItems', 'idx_transaction_items_product_id');
  await queryInterface.removeIndex('TransactionItems', 'idx_transaction_items_sales_transaction_id');
  await queryInterface.removeIndex('SalesTransactions', 'idx_sales_transactions_user_id');
  await queryInterface.removeIndex('SalesTransactions', 'idx_sales_transactions_transaction_date');
  await queryInterface.removeIndex('SalesTransactions', 'idx_sales_transactions_transaction_id');

  // Drop tables
  await queryInterface.dropTable('DailySalesReports');
  await queryInterface.dropTable('TransactionItems');
  await queryInterface.dropTable('SalesTransactions');
};