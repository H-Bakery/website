import { Sequelize } from 'sequelize';
import type { DailyReport } from '@bakery/shared/types';
import { logger } from '@bakery/api/core';

export const validationService = {
  /**
   * Validate all report data before processing
   * Checks for missing users and products
   */
  async validateReportData(report: DailyReport, sequelize: Sequelize): Promise<void> {
    const errors: string[] = [];
    
    // Get models
    const User = sequelize.models['User'];
    const Product = sequelize.models['Product'];
    
    // Collect all unique users and products
    const users = new Set<string>();
    const products = new Set<string>();
    
    for (const transaction of report.transactions) {
      users.add(transaction.user);
      
      for (const item of transaction.items) {
        products.add(item.product_id);
      }
    }
    
    // Validate users exist
    for (const username of users) {
      const user = await User.findOne({
        where: { username },
      });
      
      if (!user) {
        errors.push(`User not found: ${username}`);
      }
    }
    
    // Validate products exist
    for (const productId of products) {
      const product = await Product.findByPk(productId);
      
      if (!product) {
        errors.push(`Product not found: ${productId}`);
      }
    }
    
    // If any errors, throw with all details
    if (errors.length > 0) {
      const errorMessage = `Validation failed: ${errors.join(', ')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  },
  
  /**
   * Validate transaction totals match item totals
   */
  validateTransactionTotals(report: DailyReport): void {
    for (const transaction of report.transactions) {
      const calculatedTotal = transaction.items.reduce(
        (sum, item) => sum + item.total,
        0
      );
      
      // Allow small floating point differences
      if (Math.abs(calculatedTotal - transaction.total) > 0.01) {
        throw new Error(
          `Transaction ${transaction.id} total mismatch: ` +
          `calculated ${calculatedTotal}, reported ${transaction.total}`
        );
      }
    }
  },
  
  /**
   * Validate daily summary totals
   */
  validateDailySummary(report: DailyReport): void {
    const calculatedTotal = report.transactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.total, 0);
    
    const refundTotal = report.transactions
      .filter(t => t.type === 'refund')
      .reduce((sum, t) => sum + t.total, 0);
    
    const netTotal = calculatedTotal - refundTotal;
    
    // Allow small floating point differences
    if (Math.abs(netTotal - report.daily_summary.total_revenue) > 0.01) {
      throw new Error(
        `Daily summary total mismatch: ` +
        `calculated ${netTotal}, reported ${report.daily_summary.total_revenue}`
      );
    }
    
    // Validate transaction count
    const transactionCount = report.transactions.filter(t => t.type === 'sale').length;
    if (transactionCount !== report.daily_summary.transaction_count) {
      logger.warn(
        `Transaction count mismatch: ` +
        `calculated ${transactionCount}, reported ${report.daily_summary.transaction_count}`
      );
    }
  },
};