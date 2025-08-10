/**
 * Dashboard controller - HTTP request handlers for dashboard analytics
 */

import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { DASHBOARD_ERROR_MESSAGES, DASHBOARD_CONSTANTS } from '../models/dashboard.model';

// Extend Request interface to include userId from auth middleware
interface AuthenticatedRequest extends Request {
  userId?: number;
}

export class DashboardController {
  /**
   * Get sales summary analytics
   * GET /api/dashboard/sales-summary
   */
  async getSalesSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : DASHBOARD_CONSTANTS.DEFAULT_DAYS;

      if (isNaN(daysNum)) {
        res.status(400).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.INVALID_DAYS
        });
        return;
      }

      const summary = await dashboardService.getSalesSummary({ days: daysNum });

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      if (error.message === DASHBOARD_ERROR_MESSAGES.INVALID_DAYS) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get production overview analytics
   * GET /api/dashboard/production-overview
   */
  async getProductionOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : DASHBOARD_CONSTANTS.DEFAULT_DAYS;

      if (isNaN(daysNum)) {
        res.status(400).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.INVALID_DAYS
        });
        return;
      }

      const overview = await dashboardService.getProductionOverview({ days: daysNum });

      res.status(200).json({
        success: true,
        data: overview
      });
    } catch (error: any) {
      if (error.message === DASHBOARD_ERROR_MESSAGES.INVALID_DAYS) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get revenue analytics
   * GET /api/dashboard/revenue-analytics
   */
  async getRevenueAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : DASHBOARD_CONSTANTS.DEFAULT_DAYS;

      if (isNaN(daysNum)) {
        res.status(400).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.INVALID_DAYS
        });
        return;
      }

      const analytics = await dashboardService.getRevenueAnalytics({ days: daysNum });

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      if (error.message === DASHBOARD_ERROR_MESSAGES.INVALID_DAYS) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get order analytics
   * GET /api/dashboard/order-analytics
   */
  async getOrderAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { days } = req.query;
      const daysNum = days ? parseInt(days as string) : DASHBOARD_CONSTANTS.DEFAULT_DAYS;

      if (isNaN(daysNum)) {
        res.status(400).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.INVALID_DAYS
        });
        return;
      }

      const analytics = await dashboardService.getOrderAnalytics({ days: daysNum });

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      if (error.message === DASHBOARD_ERROR_MESSAGES.INVALID_DAYS) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get product performance analytics
   * GET /api/dashboard/product-performance
   */
  async getProductPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { days, category } = req.query;
      const daysNum = days ? parseInt(days as string) : DASHBOARD_CONSTANTS.DEFAULT_DAYS;

      if (isNaN(daysNum)) {
        res.status(400).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.INVALID_DAYS
        });
        return;
      }

      const performance = await dashboardService.getProductPerformance({ 
        days: daysNum,
        category: category as string
      });

      res.status(200).json({
        success: true,
        data: performance
      });
    } catch (error: any) {
      if (error.message === DASHBOARD_ERROR_MESSAGES.INVALID_DAYS ||
          error.message === DASHBOARD_ERROR_MESSAGES.INVALID_CATEGORY) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get daily metrics summary
   * GET /api/dashboard/daily-metrics
   */
  async getDailyMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: DASHBOARD_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const metrics = await dashboardService.getDailyMetrics();

      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: DASHBOARD_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }
}

// Export singleton instance
export const dashboardController = new DashboardController();