/**
 * Dashboard routes - Express routing configuration
 */

import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

// Auth middleware interface for factory pattern
interface AuthMiddleware {
  authMiddleware: (req: any, res: any, next: any) => void;
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => void;
}

/**
 * Create dashboard routes with optional auth middleware
 * Factory pattern to handle auth dependencies
 */
export function createDashboardRoutes(auth?: AuthMiddleware): Router {
  const router = Router();

  // Use auth middleware if provided, otherwise use pass-through
  const authMiddleware = auth?.authMiddleware || ((req, res, next) => next());
  const requireRole = auth?.requireRole || ((roles: string[]) => (req, res, next) => next());

  /**
   * @swagger
   * /api/dashboard/sales-summary:
   *   get:
   *     summary: Get sales summary analytics
   *     description: Retrieve sales metrics including total sales, order count, and daily breakdown
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 365
   *           default: 30
   *         description: Number of days to analyze
   *     responses:
   *       200:
   *         description: Sales summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/SalesSummary'
   *       400:
   *         description: Invalid days parameter
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/sales-summary', 
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getSalesSummary.bind(dashboardController)
  );

  /**
   * @swagger
   * /api/dashboard/production-overview:
   *   get:
   *     summary: Get production overview analytics
   *     description: Retrieve production metrics including top products and category breakdown
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 365
   *           default: 30
   *         description: Number of days to analyze
   *     responses:
   *       200:
   *         description: Production overview retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ProductionOverview'
   *       400:
   *         description: Invalid days parameter
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/production-overview',
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getProductionOverview.bind(dashboardController)
  );

  /**
   * @swagger
   * /api/dashboard/revenue-analytics:
   *   get:
   *     summary: Get revenue analytics
   *     description: Retrieve revenue metrics including cash flow and daily revenue breakdown
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 365
   *           default: 30
   *         description: Number of days to analyze
   *     responses:
   *       200:
   *         description: Revenue analytics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/RevenueAnalytics'
   *       400:
   *         description: Invalid days parameter
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/revenue-analytics',
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getRevenueAnalytics.bind(dashboardController)
  );

  /**
   * @swagger
   * /api/dashboard/order-analytics:
   *   get:
   *     summary: Get order analytics
   *     description: Retrieve order metrics including hourly distribution and customer frequency
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 365
   *           default: 30
   *         description: Number of days to analyze
   *     responses:
   *       200:
   *         description: Order analytics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/OrderAnalytics'
   *       400:
   *         description: Invalid days parameter
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/order-analytics',
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getOrderAnalytics.bind(dashboardController)
  );

  /**
   * @swagger
   * /api/dashboard/product-performance:
   *   get:
   *     summary: Get product performance analytics
   *     description: Retrieve product metrics including velocity and growth trends
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 365
   *           default: 30
   *         description: Number of days to analyze
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by product category
   *     responses:
   *       200:
   *         description: Product performance retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ProductPerformance'
   *       400:
   *         description: Invalid parameters
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/product-performance',
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getProductPerformance.bind(dashboardController)
  );

  /**
   * @swagger
   * /api/dashboard/daily-metrics:
   *   get:
   *     summary: Get daily metrics summary
   *     description: Retrieve today's key metrics and comparison with yesterday
   *     tags: [Dashboard]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Daily metrics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/DailyMetrics'
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/daily-metrics',
    authMiddleware,
    requireRole(['admin', 'manager']),
    dashboardController.getDailyMetrics.bind(dashboardController)
  );

  return router;
}

// Default export for backward compatibility
export const dashboardRoutes = createDashboardRoutes();