const express = require('express')
const router = express.Router()
const cashController = require('../controllers/cashController')
const { authenticate } = require('../middleware/authMiddleware')
const {
  cashEntryCreationRules,
  cashEntryUpdateRules,
  cashEntryDeleteRules,
} = require('../validators/cashValidator')
const { handleValidationErrors } = require('../middleware/validationMiddleware')

/**
 * @openapi
 * /api/cash:
 *   post:
 *     summary: Create a new cash entry
 *     description: Record a new daily cash total for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCashEntryRequest'
 *     responses:
 *       '201':
 *         description: Cash entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashEntry'
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
  cashEntryCreationRules(),
  handleValidationErrors,
  cashController.addCashEntry
)

/**
 * @openapi
 * /api/cash:
 *   get:
 *     summary: Get cash entries
 *     description: Retrieve cash entries for the authenticated user with optional date filtering
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date for filtering (YYYY-MM-DD)
 *         example: '2025-08-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date for filtering (YYYY-MM-DD)
 *         example: '2025-08-31'
 *     responses:
 *       '200':
 *         description: Successfully retrieved cash entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CashEntry'
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
router.get('/', authenticate, cashController.getCashEntries)

/**
 * @openapi
 * /api/cash/stats:
 *   get:
 *     summary: Get cash statistics
 *     description: Retrieve aggregated cash statistics for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date for statistics calculation (YYYY-MM-DD)
 *         example: '2025-08-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date for statistics calculation (YYYY-MM-DD)
 *         example: '2025-08-31'
 *     responses:
 *       '200':
 *         description: Successfully calculated cash statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashStatistics'
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
router.get('/stats', authenticate, cashController.getCashStats)

/**
 * @openapi
 * /api/cash/{id}:
 *   put:
 *     summary: Update cash entry
 *     description: Update an existing cash entry for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Cash entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCashEntryRequest'
 *     responses:
 *       '200':
 *         description: Cash entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Cash entry updated successfully'
 *                 cashEntry:
 *                   $ref: '#/components/schemas/CashEntry'
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
 *         description: Cash entry not found
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
  cashEntryUpdateRules(),
  handleValidationErrors,
  cashController.updateCashEntry
)

/**
 * @openapi
 * /api/cash/{id}:
 *   delete:
 *     summary: Delete cash entry
 *     description: Delete a cash entry for the authenticated user
 *     tags: [Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Cash entry ID
 *     responses:
 *       '200':
 *         description: Cash entry deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Cash entry deleted successfully'
 *       '401':
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '404':
 *         description: Cash entry not found
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
  cashEntryDeleteRules(),
  handleValidationErrors,
  cashController.deleteCashEntry
)

module.exports = router
