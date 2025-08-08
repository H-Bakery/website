'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create SalesTransactions table
    await queryInterface.createTable('SalesTransactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      transactionId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      transactionDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      totalAmount: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      registerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('sale', 'refund', 'adjustment'),
        allowNull: false,
        defaultValue: 'sale',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })

    // Create indexes for SalesTransactions
    await queryInterface.addIndex('SalesTransactions', ['transactionId'], {
      unique: true,
      name: 'idx_sales_transactions_transaction_id',
    })
    await queryInterface.addIndex('SalesTransactions', ['transactionDate'], {
      name: 'idx_sales_transactions_transaction_date',
    })
    await queryInterface.addIndex('SalesTransactions', ['userId'], {
      name: 'idx_sales_transactions_user_id',
    })

    // Create TransactionItems table
    await queryInterface.createTable('TransactionItems', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      salesTransactionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'SalesTransactions',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Products',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Denormalized product name for historical accuracy',
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      pricePerItem: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      totalPrice: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })

    // Create indexes for TransactionItems
    await queryInterface.addIndex('TransactionItems', ['salesTransactionId'], {
      name: 'idx_transaction_items_sales_transaction_id',
    })
    await queryInterface.addIndex('TransactionItems', ['productId'], {
      name: 'idx_transaction_items_product_id',
    })

    // Create DailySalesReports table
    await queryInterface.createTable('DailySalesReports', {
      reportDate: {
        type: Sequelize.DATEONLY,
        primaryKey: true,
        allowNull: false,
      },
      totalSales: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      cashSales: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      totalTransactions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      mostPopularProductId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Products',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      vatTotals: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'JSON object containing VAT breakdown',
      },
      reportNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      registerId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })

    // Create index for DailySalesReports
    await queryInterface.addIndex('DailySalesReports', ['reportDate'], {
      unique: true,
      name: 'idx_daily_sales_reports_report_date',
    })
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex(
      'DailySalesReports',
      'idx_daily_sales_reports_report_date'
    )
    await queryInterface.removeIndex(
      'TransactionItems',
      'idx_transaction_items_product_id'
    )
    await queryInterface.removeIndex(
      'TransactionItems',
      'idx_transaction_items_sales_transaction_id'
    )
    await queryInterface.removeIndex(
      'SalesTransactions',
      'idx_sales_transactions_user_id'
    )
    await queryInterface.removeIndex(
      'SalesTransactions',
      'idx_sales_transactions_transaction_date'
    )
    await queryInterface.removeIndex(
      'SalesTransactions',
      'idx_sales_transactions_transaction_id'
    )

    // Drop tables
    await queryInterface.dropTable('DailySalesReports')
    await queryInterface.dropTable('TransactionItems')
    await queryInterface.dropTable('SalesTransactions')
  },
}
