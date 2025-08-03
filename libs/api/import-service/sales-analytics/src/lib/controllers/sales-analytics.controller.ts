import { Request, Response } from 'express';
import { logger } from '@bakery/api/core';
import { 
  salesAnalyticsService, 
  RevenueTrendData, 
  ProductPerformanceData, 
  CashierPerformanceData, 
  PaymentMethodBreakdown, 
  DashboardSummary 
} from '../services/sales-analytics.service';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

interface RevenueTrendsQuery extends DateRangeParams {
  granularity?: 'daily' | 'weekly' | 'monthly';
}

interface ProductPerformanceQuery extends DateRangeParams, PaginationParams {
  sort?: 'top' | 'bottom';
}

export class SalesAnalyticsController {
  /**
   * GET /api/analytics/sales/revenue-trends
   * Get revenue trends with granularity support
   */
  static async getRevenueTrends(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, granularity = 'daily' } = req.query as RevenueTrendsQuery;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate parameters are required'
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        });
        return;
      }

      // Validate granularity
      if (!['daily', 'weekly', 'monthly'].includes(granularity)) {
        res.status(400).json({
          success: false,
          error: 'granularity must be one of: daily, weekly, monthly'
        });
        return;
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        res.status(422).json({
          success: false,
          error: 'startDate must be before or equal to endDate'
        });
        return;
      }

      logger.info(`Getting revenue trends from ${startDate} to ${endDate} with ${granularity} granularity`);

      const trends = await salesAnalyticsService.getRevenueTrends(startDate, endDate, granularity);

      res.json({
        success: true,
        data: trends,
        meta: {
          startDate,
          endDate,
          granularity,
          count: trends.length
        }
      });
    } catch (error) {
      logger.error('Error getting revenue trends:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve revenue trends'
      });
    }
  }

  /**
   * GET /api/analytics/sales/product-performance
   * Get product performance analytics with pagination and sorting
   */
  static async getProductPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10, 
        sort = 'top' 
      } = req.query as ProductPerformanceQuery;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate parameters are required'
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        });
        return;
      }

      // Validate pagination parameters
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      
      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          error: 'page must be a positive integer'
        });
        return;
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          error: 'limit must be between 1 and 100'
        });
        return;
      }

      // Validate sort parameter
      if (!['top', 'bottom'].includes(sort)) {
        res.status(400).json({
          success: false,
          error: 'sort must be either "top" or "bottom"'
        });
        return;
      }

      logger.info(`Getting ${sort} ${limitNum} product performance from ${startDate} to ${endDate}`);

      const products = await salesAnalyticsService.getProductPerformance(
        startDate, 
        endDate, 
        limitNum, 
        sort
      );

      res.json({
        success: true,
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: products.length,
          hasMore: products.length === limitNum // Indicates if there might be more data
        },
        meta: {
          startDate,
          endDate,
          sort
        }
      });
    } catch (error) {
      logger.error('Error getting product performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve product performance data'
      });
    }
  }

  /**
   * GET /api/analytics/sales/cashier-performance
   * Get cashier/user performance analytics
   */
  static async getCashierPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, page = 1, limit = 20 } = req.query as DateRangeParams & PaginationParams;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate parameters are required'
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        });
        return;
      }

      // Validate pagination
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      
      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          error: 'page must be a positive integer'
        });
        return;
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          error: 'limit must be between 1 and 100'
        });
        return;
      }

      logger.info(`Getting cashier performance from ${startDate} to ${endDate}`);

      const cashiers = await salesAnalyticsService.getCashierPerformance(startDate, endDate);

      // Apply pagination manually since we got all results for ranking
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedCashiers = cashiers.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedCashiers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: cashiers.length,
          totalPages: Math.ceil(cashiers.length / limitNum),
          hasMore: endIndex < cashiers.length
        },
        meta: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      logger.error('Error getting cashier performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cashier performance data'
      });
    }
  }

  /**
   * GET /api/analytics/sales/payment-methods
   * Get payment method breakdown and analysis
   */
  static async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query as DateRangeParams;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate parameters are required'
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        });
        return;
      }

      logger.info(`Getting payment method breakdown from ${startDate} to ${endDate}`);

      const paymentMethods = await salesAnalyticsService.getPaymentMethodBreakdown(startDate, endDate);

      // Calculate summary statistics
      const totalRevenue = paymentMethods.reduce((sum, method) => sum + method.totalRevenue, 0);
      const totalTransactions = paymentMethods.reduce((sum, method) => sum + method.transactionCount, 0);

      res.json({
        success: true,
        data: paymentMethods,
        summary: {
          totalRevenue,
          totalTransactions,
          averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          methodCount: paymentMethods.length
        },
        meta: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      logger.error('Error getting payment method breakdown:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment method data'
      });
    }
  }

  /**
   * GET /api/analytics/sales/summary
   * Get high-level dashboard summary
   */
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query as DateRangeParams;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate parameters are required'
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Dates must be in YYYY-MM-DD format'
        });
        return;
      }

      logger.info(`Getting dashboard summary from ${startDate} to ${endDate}`);

      const summary = await salesAnalyticsService.getDashboardSummary(startDate, endDate);

      // Calculate additional metrics
      const dateRange = {
        startDate,
        endDate,
        dayCount: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      };

      res.json({
        success: true,
        data: summary,
        meta: {
          ...dateRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard summary'
      });
    }
  }
}