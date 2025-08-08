// bakery/backend/routes/bakingListRoutes.js
const express = require('express')
const router = express.Router()
const bakingListController = require('../controllers/bakingListController')

/**
 * @openapi
 * /api/baking-list:
 *   get:
 *     summary: Get baking list
 *     description: Generate a consolidated baking list showing total quantities needed for shop inventory and customer orders
 *     tags: [Production]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date for baking list (YYYY-MM-DD) - defaults to today
 *         example: '2025-08-04'
 *     responses:
 *       '200':
 *         description: Successfully generated baking list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BakingListResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', bakingListController.getBakingList)

/**
 * @openapi
 * /api/baking-list/production/hefezopf-orders:
 *   get:
 *     summary: Get Hefezopf orders
 *     description: Retrieve quantities for all Hefezopf-related products (special yeast bread products)
 *     tags: [Production]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Date for orders (YYYY-MM-DD)
 *         example: '2025-08-04'
 *     responses:
 *       '200':
 *         description: Successfully retrieved Hefezopf orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Map of product names to quantities
 *               additionalProperties:
 *                 type: integer
 *                 minimum: 0
 *               example:
 *                 "Hefezopf Plain": 15
 *                 "Hefekranz Nuss": 8
 *                 "Hefekranz Schoko": 12
 *                 "Hefekranz Pudding": 5
 *                 "Hefekranz Marzipan": 4
 *                 "Mini Hefezopf": 20
 *                 "Hefeschnecken Nuss": 30
 *                 "Hefeschnecken Schoko": 25
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/production/hefezopf-orders', async (req, res) => {
  try {
    const { date } = req.query

    // In a real implementation, query your database for orders
    // For now, return mock data
    const mockOrders = {
      'Hefezopf Plain': 15,
      'Hefekranz Nuss': 8,
      'Hefekranz Schoko': 12,
      'Hefekranz Pudding': 5,
      'Hefekranz Marzipan': 4,
      'Mini Hefezopf': 20,
      'Hefeschnecken Nuss': 30,
      'Hefeschnecken Schoko': 25,
    }

    res.json(mockOrders)
  } catch (error) {
    console.error('Error fetching hefezopf orders:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @openapi
 * /api/baking-list/production/plans:
 *   post:
 *     summary: Save production plan
 *     description: Save a production plan with quantities and notes for a specific date
 *     tags: [Production]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductionPlanRequest'
 *     responses:
 *       '200':
 *         description: Production plan saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Production plan saved successfully'
 *                 id:
 *                   type: string
 *                   description: Unique identifier for the saved plan
 *                   example: 'plan-1234567890'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/production/plans', async (req, res) => {
  try {
    const { date, plan } = req.body

    // In a real implementation, save to your database
    // For now, just acknowledge receipt

    res.json({
      success: true,
      message: 'Production plan saved successfully',
      id: `plan-${Date.now()}`,
    })
  } catch (error) {
    console.error('Error saving production plan:', error)
    res.status(500).json({ error: 'Failed to save production plan' })
  }
})

module.exports = router
