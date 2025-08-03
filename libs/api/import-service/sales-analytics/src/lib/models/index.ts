import { Sequelize } from 'sequelize';
import { logger } from '@bakery/api/core';
import { SalesTransaction } from './sales-transaction.model';
import { TransactionItem } from './transaction-item.model';
import { DailySalesReport } from './daily-sales-report.model';

// Export models
export { SalesTransaction } from './sales-transaction.model';
export { TransactionItem } from './transaction-item.model';
export { DailySalesReport } from './daily-sales-report.model';

// Export types
export type { SalesTransactionAttributes, SalesTransactionCreationAttributes } from './sales-transaction.model';
export type { TransactionItemAttributes, TransactionItemCreationAttributes } from './transaction-item.model';
export type { DailySalesReportAttributes, DailySalesReportCreationAttributes } from './daily-sales-report.model';

export async function initializeSalesAnalyticsModels(sequelize: Sequelize): Promise<void> {
  logger.info('Initializing sales analytics models...');

  try {
    // Initialize models
    SalesTransaction.initialize(sequelize);
    TransactionItem.initialize(sequelize);
    DailySalesReport.initialize(sequelize);

    // Set up associations
    const models = {
      SalesTransaction,
      TransactionItem,
      DailySalesReport,
      // Product model will be passed from the main app
      Product: sequelize.models['Product'],
    };

    // Call associate methods
    SalesTransaction.associate(models);
    TransactionItem.associate(models);
    DailySalesReport.associate(models);

    logger.info('Sales analytics models initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize sales analytics models:', error);
    throw error;
  }
}