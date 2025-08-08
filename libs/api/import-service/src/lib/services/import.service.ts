import { Sequelize, Transaction } from 'sequelize';
import { logger } from '../utils/logger';
import type { DailyReport, Transaction as ReportTransaction } from '../types/report.types';
import { mappingService } from './mapping.service';
import { validationService } from './validation.service';

// Models will be accessed from the sequelize instance

export interface ImportResult {
  reportId: number;
  date: string;
  transactionsImported: number;
  itemsImported: number;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  failed: number;
  details: Array<{
    date: string;
    status: 'imported' | 'skipped' | 'failed';
    error?: string;
  }>;
}

export const importService = {
  sequelize: null as Sequelize | null,
  
  /**
   * Initialize the service with sequelize instance
   */
  initialize(sequelize: Sequelize) {
    this.sequelize = sequelize;
  },

  /**
   * Check if a report already exists for a given date
   */
  async checkDuplicateReport(date: string): Promise<boolean> {
    if (!this.sequelize) {
      throw new Error('Import service not initialized');
    }

    const DailySalesReport = this.sequelize.models['DailySalesReport'];
    
    const existingReport = await DailySalesReport.findOne({
      where: { reportDate: date },
    });

    return !!existingReport;
  },

  /**
   * Process a single report with full transaction support
   */
  async processReport(report: DailyReport): Promise<ImportResult> {
    if (!this.sequelize) {
      throw new Error('Import service not initialized');
    }

    const transaction = await this.sequelize.transaction();

    try {
      // Validate all data upfront
      await validationService.validateReportData(report, this.sequelize);

      // Get models
      const SalesTransaction = this.sequelize.models['SalesTransaction'];
      const TransactionItem = this.sequelize.models['TransactionItem'];
      const DailySalesReport = this.sequelize.models['DailySalesReport'];

      let transactionCount = 0;
      let itemCount = 0;

      // Process each transaction
      for (const reportTransaction of report.transactions) {
        // Map user and validate
        const userId = await mappingService.mapUser(reportTransaction.user, this.sequelize);
        if (!userId) {
          throw new Error(`User not found: ${reportTransaction.user}`);
        }

        // Create sales transaction
        const salesTransaction = await SalesTransaction.create({
          transactionId: reportTransaction.id,
          transactionDate: new Date(reportTransaction.timestamp),
          totalAmount: reportTransaction.total,
          paymentMethod: reportTransaction.payment,
          userId: reportTransaction.user,
          registerNumber: report.register_id,
          type: reportTransaction.type,
        }, { transaction });

        transactionCount++;

        // Process transaction items
        for (const item of reportTransaction.items) {
          // Map product and validate
          const productId = await mappingService.mapProduct(item.product_id, this.sequelize);
          if (!productId) {
            throw new Error(`Product not found: ${item.product_id} (${item.product})`);
          }

          await TransactionItem.create({
            salesTransactionId: (salesTransaction as any).id,
            productId: productId,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.total,
          }, { transaction });

          itemCount++;
        }
      }

      // Create daily sales report summary
      const dailyReport = await DailySalesReport.create({
        reportDate: report.date,
        totalRevenue: report.daily_summary.total_revenue,
        cashRevenue: report.daily_summary.cash_revenue,
        transactionCount: report.daily_summary.transaction_count,
        vatTotals: report.daily_summary.vat_totals,
        registerId: report.register_id,
        reportNumber: report.report_number,
      }, { transaction });

      // Commit the transaction
      await transaction.commit();

      logger.info(`Successfully imported report for ${report.date}: ${transactionCount} transactions, ${itemCount} items`);

      return {
        reportId: (dailyReport as any).id,
        date: report.date,
        transactionsImported: transactionCount,
        itemsImported: itemCount,
      };
    } catch (error) {
      // Rollback on any error
      await transaction.rollback();
      logger.error(`Failed to import report for ${report.date}:`, error);
      throw error;
    }
  },

  /**
   * Process multiple reports in bulk
   */
  async processBulkReports(reports: DailyReport[]): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    // Sort reports by date to process chronologically
    const sortedReports = [...reports].sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    for (const report of sortedReports) {
      try {
        // Check if already imported
        const exists = await this.checkDuplicateReport(report.date);
        if (exists) {
          result.skipped++;
          result.details.push({
            date: report.date,
            status: 'skipped',
          });
          continue;
        }

        // Process the report
        await this.processReport(report);
        result.imported++;
        result.details.push({
          date: report.date,
          status: 'imported',
        });
      } catch (error) {
        result.failed++;
        result.details.push({
          date: report.date,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Failed to import report for ${report.date}:`, error);
      }
    }

    logger.info(`Bulk import completed: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed`);
    return result;
  },
};