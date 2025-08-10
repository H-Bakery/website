const express = require('express')
const router = express.Router()
const dashboardController = require('../controllers/dashboardController')
const { authenticate } = require('../middleware/authMiddleware')

/**
 * @openapi
 * /api/dashboard/sales-summary:
 *   get:
 *     summary: Get sales summary analytics
 *     description: Retrieve comprehensive sales metrics including total sales, order counts, average order value, and daily breakdowns
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *       '200':
 *         description: Successfully retrieved sales summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSales:
 *                       type: number
 *                       description: Total sales amount for the period
 *                       example: 5250.50
 *                     orderCount:
 *                       type: integer
 *                       description: Total number of orders
 *                       example: 125
 *                     avgOrderValue:
 *                       type: number
 *                       description: Average order value
 *                       example: 42.00
 *                     dailySales:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: '2025-08-01'
 *                           orders:
 *                             type: integer
 *                             example: 15
 *                           revenue:
 *                             type: number
 *                             example: 625.50
 *                     statusBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: 'Completed'
 *                           count:
 *                             type: integer
 *                             example: 95
 *                     period:
 *                       type: string
 *                       example: '30 days'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/sales-summary', authenticate, dashboardController.getSalesSummary)

/**
 * @openapi
 * /api/dashboard/production-overview:
 *   get:
 *     summary: Get production overview analytics
 *     description: Retrieve production metrics including top products, category breakdowns, and daily production volumes
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *       '200':
 *         description: Successfully retrieved production overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     topProducts:
 *                       type: array
 *                       description: Top 10 most ordered products
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: 'Croissant'
 *                           category:
 *                             type: string
 *                             example: 'Pastries'
 *                           totalQuantity:
 *                             type: integer
 *                             example: 250
 *                           orderCount:
 *                             type: integer
 *                             example: 85
 *                           revenue:
 *                             type: number
 *                             example: 625.00
 *                     categoryBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             example: 'Breads'
 *                           totalQuantity:
 *                             type: integer
 *                             example: 500
 *                           productCount:
 *                             type: integer
 *                             example: 12
 *                           revenue:
 *                             type: number
 *                             example: 1500.00
 *                     dailyProduction:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: '2025-08-01'
 *                           totalItems:
 *                             type: integer
 *                             example: 150
 *                           uniqueProducts:
 *                             type: integer
 *                             example: 25
 *                     period:
 *                       type: string
 *                       example: '30 days'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/production-overview',
  authenticate,
  dashboardController.getProductionOverview
)

/**
 * @openapi
 * /api/dashboard/revenue-analytics:
 *   get:
 *     summary: Get revenue analytics
 *     description: Retrieve detailed revenue analysis including cash entries, order revenue, and category breakdowns
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *       '200':
 *         description: Successfully retrieved revenue analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue:
 *                       type: number
 *                       description: Total revenue for the period
 *                       example: 15750.50
 *                     totalCash:
 *                       type: number
 *                       description: Total cash recorded
 *                       example: 15500.00
 *                     dailyCash:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: '2025-08-01'
 *                           amount:
 *                             type: number
 *                             example: 525.50
 *                     dailyRevenue:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: '2025-08-01'
 *                           revenue:
 *                             type: number
 *                             example: 625.50
 *                           orders:
 *                             type: integer
 *                             example: 15
 *                     categoryRevenue:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             example: 'Breads'
 *                           revenue:
 *                             type: number
 *                             example: 5250.00
 *                           avgPrice:
 *                             type: number
 *                             example: 3.50
 *                           totalQuantity:
 *                             type: integer
 *                             example: 1500
 *                     period:
 *                       type: string
 *                       example: '30 days'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/revenue-analytics',
  authenticate,
  dashboardController.getRevenueAnalytics
)

/**
 * @openapi
 * /api/dashboard/order-analytics:
 *   get:
 *     summary: Get order analytics
 *     description: Retrieve order metrics including statistics, hourly distribution, and customer frequency analysis
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *       '200':
 *         description: Successfully retrieved order analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderMetrics:
 *                       type: object
 *                       properties:
 *                         totalOrders:
 *                           type: integer
 *                           example: 125
 *                         avgOrderValue:
 *                           type: number
 *                           example: 42.00
 *                         minOrderValue:
 *                           type: number
 *                           example: 5.50
 *                         maxOrderValue:
 *                           type: number
 *                           example: 250.00
 *                         uniqueCustomers:
 *                           type: integer
 *                           example: 95
 *                     hourlyDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: integer
 *                             minimum: 0
 *                             maximum: 23
 *                             example: 10
 *                           orders:
 *                             type: integer
 *                             example: 25
 *                           revenue:
 *                             type: number
 *                             example: 1050.50
 *                     customerFrequency:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           customerName:
 *                             type: string
 *                             example: 'John Doe'
 *                           orderCount:
 *                             type: integer
 *                             example: 15
 *                           totalSpent:
 *                             type: number
 *                             example: 625.50
 *                           avgOrderValue:
 *                             type: number
 *                             example: 41.70
 *                     weeklyPattern:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayOfWeek:
 *                             type: integer
 *                             minimum: 0
 *                             maximum: 6
 *                             example: 1
 *                           orders:
 *                             type: integer
 *                             example: 35
 *                           revenue:
 *                             type: number
 *                             example: 1470.00
 *                     period:
 *                       type: string
 *                       example: '30 days'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/order-analytics',
  authenticate,
  dashboardController.getOrderAnalytics
)

/**
 * @openapi
 * /api/dashboard/product-performance:
 *   get:
 *     summary: Get product performance analytics
 *     description: Retrieve detailed product performance metrics including sales velocity, revenue contribution, and growth trends
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *       '200':
 *         description: Successfully retrieved product performance analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     productMetrics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: 'Sourdough Bread'
 *                           category:
 *                             type: string
 *                             example: 'Breads'
 *                           totalQuantity:
 *                             type: integer
 *                             example: 150
 *                           totalRevenue:
 *                             type: number
 *                             example: 525.00
 *                           orderCount:
 *                             type: integer
 *                             example: 45
 *                           avgOrderQuantity:
 *                             type: number
 *                             example: 3.33
 *                           velocityPerDay:
 *                             type: number
 *                             example: 5.0
 *                     slowMovers:
 *                       type: array
 *                       description: Products with low sales velocity
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: 'Rye Bread'
 *                           quantitySold:
 *                             type: integer
 *                             example: 5
 *                           daysSinceLastOrder:
 *                             type: integer
 *                             example: 7
 *                     growthTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productName:
 *                             type: string
 *                             example: 'Chocolate Croissant'
 *                           currentPeriod:
 *                             type: number
 *                             example: 250
 *                           previousPeriod:
 *                             type: number
 *                             example: 200
 *                           growthRate:
 *                             type: number
 *                             example: 25.0
 *                     period:
 *                       type: string
 *                       example: '30 days'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/product-performance',
  authenticate,
  dashboardController.getProductPerformance
)

/**
 * @openapi
 * /api/dashboard/daily-metrics:
 *   get:
 *     summary: Get daily metrics summary
 *     description: Retrieve today's key performance indicators including sales, orders, top products, and waste metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Successfully retrieved daily metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                       description: Current date
 *                       example: '2025-08-03'
 *                     todaySales:
 *                       type: number
 *                       description: Total sales for today
 *                       example: 725.50
 *                     todayOrders:
 *                       type: integer
 *                       description: Number of orders today
 *                       example: 18
 *                     avgOrderValue:
 *                       type: number
 *                       description: Average order value today
 *                       example: 40.31
 *                     topProducts:
 *                       type: array
 *                       description: Top 5 products sold today
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: 'Baguette'
 *                           quantity:
 *                             type: integer
 *                             example: 25
 *                           revenue:
 *                             type: number
 *                             example: 87.50
 *                     unsoldItems:
 *                       type: object
 *                       properties:
 *                         totalQuantity:
 *                           type: integer
 *                           example: 12
 *                         totalValue:
 *                           type: number
 *                           example: 36.00
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               productName:
 *                                 type: string
 *                                 example: 'Whole Wheat Bread'
 *                               quantity:
 *                                 type: integer
 *                                 example: 3
 *                               value:
 *                                 type: number
 *                                 example: 10.50
 *                     comparisonWithYesterday:
 *                       type: object
 *                       properties:
 *                         salesChange:
 *                           type: number
 *                           description: Percentage change in sales
 *                           example: 15.5
 *                         ordersChange:
 *                           type: number
 *                           description: Percentage change in orders
 *                           example: 12.0
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/daily-metrics', authenticate, dashboardController.getDailyMetrics)

module.exports = router
