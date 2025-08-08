const express = require('express')
const router = express.Router()
const chatController = require('../controllers/chatController')
const { authenticate } = require('../middleware/authMiddleware')
const { chatMessageRules } = require('../validators/chatValidator')
const { handleValidationErrors } = require('../middleware/validationMiddleware')

/**
 * @openapi
 * /api/chat:
 *   get:
 *     summary: Get all chat messages
 *     description: Retrieve all chat messages in chronological order with user information
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Successfully retrieved chat messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatMessage'
 *             example:
 *               - id: 1
 *                 message: "Good morning everyone!"
 *                 timestamp: "2025-08-04T08:00:00.000Z"
 *                 UserId: 3
 *                 User:
 *                   username: "john.doe"
 *               - id: 2
 *                 message: "Ready for today's production"
 *                 timestamp: "2025-08-04T08:05:00.000Z"
 *                 UserId: 5
 *                 User:
 *                   username: "jane.baker"
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
router.get('/', authenticate, chatController.getChatMessages)

/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: Send a new chat message
 *     description: Create a new chat message for internal staff communication
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatMessageRequest'
 *     responses:
 *       '200':
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Message saved'
 *       '400':
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
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
router.post(
  '/',
  authenticate,
  chatMessageRules(),
  handleValidationErrors,
  chatController.addChatMessage
)

module.exports = router
