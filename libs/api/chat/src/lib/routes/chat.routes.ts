/**
 * Chat routes - Express routing configuration
 */

import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

// Auth middleware interface for factory pattern
interface AuthMiddleware {
  authMiddleware: (req: any, res: any, next: any) => void;
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => void;
}

/**
 * Create chat routes with optional auth middleware
 * Factory pattern to handle auth dependencies
 */
export function createChatRoutes(auth?: AuthMiddleware): Router {
  const router = Router();

  // Use auth middleware if provided, otherwise use pass-through
  const authMiddleware = auth?.authMiddleware || ((req, res, next) => next());
  const requireRole = auth?.requireRole || ((roles: string[]) => (req, res, next) => next());

  /**
   * @swagger
   * /api/chat:
   *   get:
   *     summary: Get all chat messages
   *     description: Retrieve chat messages with optional filtering and pagination
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: userFilter
   *         schema:
   *           type: integer
   *         description: Filter by user ID
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter messages from this date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter messages until this date
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 200
   *           default: 50
   *         description: Number of messages to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of messages to skip
   *     responses:
   *       200:
   *         description: Chat messages retrieved successfully
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
   *                     $ref: '#/components/schemas/ChatMessageWithUser'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   *                     total:
   *                       type: integer
   *       400:
   *         description: Invalid parameters
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/',
    authMiddleware,
    chatController.getChatMessages.bind(chatController)
  );

  /**
   * @swagger
   * /api/chat:
   *   post:
   *     summary: Send a new chat message
   *     description: Create a new chat message for team communication
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 1000
   *                 example: "Good morning team! Ready for today's production."
   *             required:
   *               - message
   *     responses:
   *       201:
   *         description: Message sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ChatMessage'
   *                 message:
   *                   type: string
   *                   example: "Message sent successfully"
   *       400:
   *         description: Validation error
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.post('/',
    authMiddleware,
    chatController.createChatMessage.bind(chatController)
  );

  /**
   * @swagger
   * /api/chat/statistics:
   *   get:
   *     summary: Get chat statistics
   *     description: Retrieve chat usage statistics and analytics
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Chat statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ChatStatistics'
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Internal server error
   */
  router.get('/statistics',
    authMiddleware,
    requireRole(['admin', 'manager']),
    chatController.getChatStatistics.bind(chatController)
  );

  /**
   * @swagger
   * /api/chat/all:
   *   delete:
   *     summary: Clear all chat messages
   *     description: Delete all chat messages (admin only)
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: All messages cleared successfully
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
   *                   example: "All messages cleared successfully"
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Insufficient permissions
   *       500:
   *         description: Internal server error
   */
  router.delete('/all',
    authMiddleware,
    requireRole(['admin']),
    chatController.clearAllMessages.bind(chatController)
  );

  /**
   * @swagger
   * /api/chat/{id}:
   *   get:
   *     summary: Get chat message by ID
   *     description: Retrieve a specific chat message by its ID
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Chat message ID
   *     responses:
   *       200:
   *         description: Chat message retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/ChatMessageWithUser'
   *       400:
   *         description: Invalid message ID
   *       401:
   *         description: Authentication required
   *       404:
   *         description: Message not found
   *       500:
   *         description: Internal server error
   */
  router.get('/:id',
    authMiddleware,
    chatController.getChatMessageById.bind(chatController)
  );

  /**
   * @swagger
   * /api/chat/{id}:
   *   delete:
   *     summary: Delete chat message
   *     description: Delete a specific chat message (admin only)
   *     tags: [Chat]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Chat message ID
   *     responses:
   *       200:
   *         description: Message deleted successfully
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
   *                   example: "Message deleted successfully"
   *       400:
   *         description: Invalid message ID
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Message not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/:id',
    authMiddleware,
    requireRole(['admin', 'manager']),
    chatController.deleteChatMessage.bind(chatController)
  );

  return router;
}

// Default export for backward compatibility
export const chatRoutes = createChatRoutes();