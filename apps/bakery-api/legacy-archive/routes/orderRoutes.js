const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController')
const { authenticate } = require('../middleware/authMiddleware')
const {
  orderCreationRules,
  orderUpdateRules,
  orderDeleteRules,
} = require('../validators/orderValidator')
const { handleValidationErrors } = require('../middleware/validationMiddleware')

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: Get all orders
 *     description: Retrieve a list of orders with optional filtering by date range and status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders from this date onwards
 *         example: '2025-08-01T00:00:00Z'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders up to this date
 *         example: '2025-08-31T23:59:59Z'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in_progress, ready, completed, cancelled]
 *         description: Filter by order status
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (partial match)
 *     responses:
 *       '200':
 *         description: Successfully retrieved orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
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
router.get('/', authenticate, orderController.getOrders)

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     description: Retrieve detailed information about a specific order including all order items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Order ID
 *     responses:
 *       '200':
 *         description: Successfully retrieved order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderDetail'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '404':
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', authenticate, orderController.getOrder)

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Create a new order
 *     description: Create a new customer order with one or more items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       '201':
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Order created successfully'
 *                 order:
 *                   $ref: '#/components/schemas/OrderDetail'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
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
router.post(
  '/',
  authenticate,
  orderCreationRules(),
  handleValidationErrors,
  orderController.createOrder
)

/**
 * @openapi
 * /api/orders/{id}:
 *   put:
 *     summary: Update an order
 *     description: Update an existing order's details, status, or items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrderRequest'
 *     responses:
 *       '200':
 *         description: Order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Order updated successfully'
 *                 order:
 *                   $ref: '#/components/schemas/OrderDetail'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '404':
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/:id',
  authenticate,
  orderUpdateRules(),
  handleValidationErrors,
  orderController.updateOrder
)

/**
 * @openapi
 * /api/orders/{id}:
 *   delete:
 *     summary: Delete an order
 *     description: Delete an order (only allowed for pending or cancelled orders)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Order ID
 *     responses:
 *       '200':
 *         description: Order deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Order deleted successfully'
 *       '400':
 *         description: Cannot delete order in current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '404':
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/:id',
  authenticate,
  orderDeleteRules(),
  handleValidationErrors,
  orderController.deleteOrder
)

module.exports = router
