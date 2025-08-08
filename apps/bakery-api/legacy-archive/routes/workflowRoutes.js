const express = require('express')
const router = express.Router()
const workflowController = require('../controllers/workflowController')
const { authenticate } = require('../middleware/authMiddleware')

/**
 * @openapi
 * /api/workflows:
 *   get:
 *     summary: List all workflows
 *     description: Retrieve a list of all available workflow summaries
 *     tags: [Workflows]
 *     responses:
 *       '200':
 *         description: Successfully retrieved workflow list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of workflows
 *                   example: 12
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkflowSummary'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', workflowController.listWorkflows)

/**
 * @openapi
 * /api/workflows/categories:
 *   get:
 *     summary: Get workflow categories
 *     description: Retrieve all available workflow categories
 *     tags: [Workflows]
 *     responses:
 *       '200':
 *         description: Successfully retrieved categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ['production', 'quality', 'cleaning', 'inventory']
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/categories', workflowController.getCategories)

/**
 * @openapi
 * /api/workflows/stats:
 *   get:
 *     summary: Get workflow statistics
 *     description: Retrieve statistics about available workflows
 *     tags: [Workflows]
 *     responses:
 *       '200':
 *         description: Successfully retrieved workflow statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkflowStatistics'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/stats', workflowController.getWorkflowStats)

/**
 * @openapi
 * /api/workflows/{workflowId}:
 *   get:
 *     summary: Get specific workflow
 *     description: Retrieve detailed information about a specific workflow
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow identifier (filename without extension)
 *         example: bread-production
 *     responses:
 *       '200':
 *         description: Successfully retrieved workflow
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkflowDetail'
 *       '404':
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:workflowId', workflowController.getWorkflow)

/**
 * @openapi
 * /api/workflows/validate:
 *   post:
 *     summary: Validate workflow structure
 *     description: Validate a workflow definition structure (requires authentication)
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkflowValidationRequest'
 *     responses:
 *       '200':
 *         description: Workflow is valid
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
 *                   example: 'Workflow is valid'
 *       '400':
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: 'Workflow validation failed'
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ['Missing required field: name', 'Invalid step format at index 2']
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/validate', authenticate, workflowController.validateWorkflow)

module.exports = router
