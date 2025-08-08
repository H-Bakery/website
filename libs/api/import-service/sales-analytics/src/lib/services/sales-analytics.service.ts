import { Transaction, Op, Sequelize } from 'sequelize';
import { logger } from '../utils/logger';
import { SalesTransaction, TransactionItem, DailySalesReport } from '../models';
import { 
  SalesTransactionAttributes, 
  TransactionItemAttributes, 
  DailySalesReportAttributes 
} from '../models';
import { DailyReport, Transaction as ReportTransaction } from '../types/report.types';

// Types for analytics responses
export interface RevenueTrendData {
  date: string;
  revenue: number;
  transactions: number;
  averageTransactionValue: number;
}

export interface ProductPerformanceData {
  productId: number;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  transactionCount: number;
}

export interface CashierPerformanceData {
  userId: string;
  userName?: string;
  transactionCount: number;
  totalRevenue: number;
  averageTransactionValue: number;
  cashSales: number;
  cardSales: number;
}

export interface PaymentMethodBreakdown {
  paymentMethod: string;
  transactionCount: number;
  totalRevenue: number;
  percentage: number;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  topProducts: ProductPerformanceData[];
  paymentBreakdown: PaymentMethodBreakdown[];
  dailyTrend: RevenueTrendData[];
}

export class SalesAnalyticsService {
  /**
   * Import daily report data into the database
   */
  async importDailyReport(report: DailyReport, dbTransaction?: Transaction): Promise<void> {
    try {
      logger.info(`Importing daily report for ${report.date}`);

      // Process each transaction
      for (const transaction of report.transactions) {
        // Create sales transaction
        const salesTransaction = await SalesTransaction.create({
          transactionId: transaction.id,
          transactionDate: new Date(transaction.timestamp),
          totalAmount: transaction.total,
          paymentMethod: transaction.payment,
          userId: transaction.user,
          registerNumber: report.register_id,
          type: transaction.type,
        }, { transaction: dbTransaction });

        // Create transaction items
        for (const item of transaction.items) {
          await TransactionItem.create({
            salesTransactionId: salesTransaction.id,
            productId: parseInt(item.product_id),
            productName: item.product,
            quantity: item.quantity,
            pricePerItem: item.price,
            totalPrice: item.total,
          }, { transaction: dbTransaction });
        }
      }

      // Calculate most popular product
      const productStats = await this.calculateProductStats(report.date);
      const mostPopularProductId = productStats.length > 0 ? productStats[0].productId : null;

      // Create or update daily report
      await DailySalesReport.upsert({
        reportDate: new Date(report.date),
        totalSales: report.daily_summary.total_revenue,
        cashSales: report.daily_summary.cash_revenue,
        totalTransactions: report.daily_summary.transaction_count,
        mostPopularProductId,
        vatTotals: report.daily_summary.vat_totals,
        reportNumber: report.report_number,
        registerId: report.register_id,
      }, { transaction: dbTransaction });

      logger.info(`Successfully imported daily report for ${report.date}`);
    } catch (error) {
      logger.error('Error importing daily report:', error);
      throw error;
    }
  }

  /**
   * Get sales transactions for a specific date
   */
  async getTransactionsByDate(date: string): Promise<SalesTransaction[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return SalesTransaction.findAll({
      where: {
        transactionDate: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      include: [{
        model: TransactionItem,
        as: 'transactionItems',
        include: [{
          association: 'product',
        }],
      }],
      order: [['transactionDate', 'ASC']],
    });
  }

  /**
   * Get daily sales report for a specific date
   */
  async getDailyReport(date: string): Promise<DailySalesReport | null> {
    return DailySalesReport.findOne({
      where: {
        reportDate: new Date(date),
      },
      include: [{
        association: 'mostPopularProduct',
      }],
    });
  }

  /**
   * Calculate product statistics for a given date
   */
  async calculateProductStats(date: string): Promise<any[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const results = await TransactionItem.findAll({
      attributes: [
        'productId',
        'productName',
        [TransactionItem.sequelize!.fn('SUM', TransactionItem.sequelize!.col('quantity')), 'totalQuantity'],
        [TransactionItem.sequelize!.fn('SUM', TransactionItem.sequelize!.col('totalPrice')), 'totalRevenue'],
      ],
      include: [{
        model: SalesTransaction,
        as: 'salesTransaction',
        attributes: [],
        where: {
          transactionDate: {
            [Op.gte]: startDate,
            [Op.lte]: endDate,
          },
        },
      }],
      group: ['productId', 'productName'],
      order: [[TransactionItem.sequelize!.fn('SUM', TransactionItem.sequelize!.col('quantity')), 'DESC']],
      raw: true,
    });

    return results;
  }

  /**
   * Get sales summary for a date range
   */
  async getSalesSummary(startDate: string, endDate: string): Promise<any> {
    const reports = await DailySalesReport.findAll({
      where: {
        reportDate: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate),
        },
      },
      attributes: [
        [DailySalesReport.sequelize!.fn('SUM', DailySalesReport.sequelize!.col('totalSales')), 'totalRevenue'],
        [DailySalesReport.sequelize!.fn('SUM', DailySalesReport.sequelize!.col('cashSales')), 'totalCashSales'],
        [DailySalesReport.sequelize!.fn('SUM', DailySalesReport.sequelize!.col('totalTransactions')), 'totalTransactions'],
        [DailySalesReport.sequelize!.fn('AVG', DailySalesReport.sequelize!.col('totalSales')), 'averageDailyRevenue'],
        [DailySalesReport.sequelize!.fn('COUNT', DailySalesReport.sequelize!.col('reportDate')), 'numberOfDays'],
      ],
      raw: true,
    });

    return reports[0] || {
      totalRevenue: 0,
      totalCashSales: 0,
      totalTransactions: 0,
      averageDailyRevenue: 0,
      numberOfDays: 0,
    };
  }

  /**
   * Check if a report has already been imported
   */
  async isReportImported(date: string): Promise<boolean> {
    const count = await DailySalesReport.count({
      where: {
        reportDate: new Date(date),
      },
    });

    return count > 0;
  }

  /**
   * Get revenue trends for a date range with specified granularity
   */
  async getRevenueTrends(
    startDate: string, 
    endDate: string, 
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<RevenueTrendData[]> {
    try {
      logger.info(`Getting revenue trends from ${startDate} to ${endDate} with ${granularity} granularity`);

      let dateFormat: string;
      let groupBy: string;

      switch (granularity) {
        case 'weekly':
          dateFormat = '%Y-%u'; // Year-Week
          groupBy = 'week';
          break;
        case 'monthly':
          dateFormat = '%Y-%m'; // Year-Month
          groupBy = 'month';
          break;
        default:
          dateFormat = '%Y-%m-%d'; // Year-Month-Day
          groupBy = 'day';
      }

      const results = await SalesTransaction.findAll({
        attributes: [
          [Sequelize.fn('DATE_FORMAT', Sequelize.col('transactionDate'), dateFormat), 'period'],
          [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'revenue'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactions'],
          [Sequelize.fn('AVG', Sequelize.col('totalAmount')), 'averageTransactionValue'],
        ],
        where: {
          transactionDate: {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          },
          type: 'sale', // Only include sales, not refunds
        },
        group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('transactionDate'), dateFormat)],
        order: [['period', 'ASC']],
        raw: true,
      });

      return results.map((result: any) => ({
        date: result.period,
        revenue: parseFloat(result.revenue) || 0,
        transactions: parseInt(result.transactions) || 0,
        averageTransactionValue: parseFloat(result.averageTransactionValue) || 0,
      }));
    } catch (error) {
      logger.error('Error getting revenue trends:', error);
      throw error;
    }
  }

  /**
   * Get product performance analytics
   */
  async getProductPerformance(
    startDate: string,
    endDate: string,
    limit: number = 10,
    sort: 'top' | 'bottom' = 'top'
  ): Promise<ProductPerformanceData[]> {
    try {
      logger.info(`Getting ${sort} ${limit} product performance from ${startDate} to ${endDate}`);

      const results = await TransactionItem.findAll({
        attributes: [
          'productId',
          'productName',
          [Sequelize.fn('SUM', Sequelize.col('quantity')), 'quantitySold'],
          [Sequelize.fn('SUM', Sequelize.col('totalPrice')), 'totalRevenue'],
          [Sequelize.fn('AVG', Sequelize.col('pricePerItem')), 'averagePrice'],
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('salesTransactionId'))), 'transactionCount'],
        ],
        include: [{
          model: SalesTransaction,
          as: 'salesTransaction',
          attributes: [],
          where: {
            transactionDate: {
              [Op.gte]: new Date(startDate),
              [Op.lte]: new Date(endDate),
            },
            type: 'sale',
          },
        }],
        group: ['productId', 'productName'],
        order: [
          [Sequelize.fn('SUM', Sequelize.col('totalPrice')), sort === 'top' ? 'DESC' : 'ASC']
        ],
        limit,
        raw: true,
      });

      return results.map((result: any) => ({
        productId: result.productId,
        productName: result.productName,
        quantitySold: parseInt(result.quantitySold) || 0,
        totalRevenue: parseFloat(result.totalRevenue) || 0,
        averagePrice: parseFloat(result.averagePrice) || 0,
        transactionCount: parseInt(result.transactionCount) || 0,
      }));
    } catch (error) {
      logger.error('Error getting product performance:', error);
      throw error;
    }
  }

  /**
   * Get cashier/user performance analytics
   */
  async getCashierPerformance(
    startDate: string,
    endDate: string
  ): Promise<CashierPerformanceData[]> {
    try {
      logger.info(`Getting cashier performance from ${startDate} to ${endDate}`);

      const results = await SalesTransaction.findAll({
        attributes: [
          'userId',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactionCount'],
          [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'totalRevenue'],
          [Sequelize.fn('AVG', Sequelize.col('totalAmount')), 'averageTransactionValue'],
          [
            Sequelize.fn('SUM', 
              Sequelize.literal("CASE WHEN paymentMethod = 'Bar' THEN totalAmount ELSE 0 END")
            ), 
            'cashSales'
          ],
          [
            Sequelize.fn('SUM', 
              Sequelize.literal("CASE WHEN paymentMethod != 'Bar' THEN totalAmount ELSE 0 END")
            ), 
            'cardSales'
          ],
        ],
        where: {
          transactionDate: {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          },
          type: 'sale',
        },
        group: ['userId'],
        order: [['totalRevenue', 'DESC']],
        raw: true,
      });

      return results.map((result: any) => ({
        userId: result.userId,
        transactionCount: parseInt(result.transactionCount) || 0,
        totalRevenue: parseFloat(result.totalRevenue) || 0,
        averageTransactionValue: parseFloat(result.averageTransactionValue) || 0,
        cashSales: parseFloat(result.cashSales) || 0,
        cardSales: parseFloat(result.cardSales) || 0,
      }));
    } catch (error) {
      logger.error('Error getting cashier performance:', error);
      throw error;
    }
  }

  /**
   * Get payment method breakdown
   */
  async getPaymentMethodBreakdown(
    startDate: string,
    endDate: string
  ): Promise<PaymentMethodBreakdown[]> {
    try {
      logger.info(`Getting payment method breakdown from ${startDate} to ${endDate}`);

      const results = await SalesTransaction.findAll({
        attributes: [
          'paymentMethod',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactionCount'],
          [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'totalRevenue'],
        ],
        where: {
          transactionDate: {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          },
          type: 'sale',
        },
        group: ['paymentMethod'],
        order: [['totalRevenue', 'DESC']],
        raw: true,
      });

      // Calculate total revenue for percentage calculation
      const totalRevenue = results.reduce(
        (sum, result: any) => sum + parseFloat(result.totalRevenue || 0), 
        0
      );

      return results.map((result: any) => {
        const revenue = parseFloat(result.totalRevenue) || 0;
        return {
          paymentMethod: result.paymentMethod,
          transactionCount: parseInt(result.transactionCount) || 0,
          totalRevenue: revenue,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        };
      });
    } catch (error) {
      logger.error('Error getting payment method breakdown:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary with overview data
   */
  async getDashboardSummary(
    startDate: string,
    endDate: string
  ): Promise<DashboardSummary> {
    try {
      logger.info(`Getting dashboard summary from ${startDate} to ${endDate}`);

      // Get overall totals
      const totals = await SalesTransaction.findOne({
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'totalRevenue'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalTransactions'],
          [Sequelize.fn('AVG', Sequelize.col('totalAmount')), 'averageTransactionValue'],
        ],
        where: {
          transactionDate: {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          },
          type: 'sale',
        },
        raw: true,
      });

      // Get top 5 products
      const topProducts = await this.getProductPerformance(startDate, endDate, 5, 'top');

      // Get payment method breakdown
      const paymentBreakdown = await this.getPaymentMethodBreakdown(startDate, endDate);

      // Get last 7 days trend for chart
      const trendEndDate = new Date(endDate);
      const trendStartDate = new Date(trendEndDate);
      trendStartDate.setDate(trendStartDate.getDate() - 6); // Last 7 days

      const dailyTrend = await this.getRevenueTrends(
        trendStartDate.toISOString().split('T')[0],
        endDate,
        'daily'
      );

      return {
        totalRevenue: parseFloat((totals as any)?.totalRevenue) || 0,
        totalTransactions: parseInt((totals as any)?.totalTransactions) || 0,
        averageTransactionValue: parseFloat((totals as any)?.averageTransactionValue) || 0,
        topProducts,
        paymentBreakdown,
        dailyTrend,
      };
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const salesAnalyticsService = new SalesAnalyticsService();