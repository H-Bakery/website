/**
 * Chat controller - HTTP request handlers for chat messaging
 */

import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { CHAT_ERROR_MESSAGES, CHAT_CONSTANTS } from '../models/chat.model';

// Extend Request interface to include userId from auth middleware
interface AuthenticatedRequest extends Request {
  userId?: number;
}

export class ChatController {
  /**
   * Get all chat messages
   * GET /api/chat
   */
  async getChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      // Parse query parameters
      const {
        userFilter,
        startDate,
        endDate,
        limit,
        offset
      } = req.query;

      const filters = {
        userId: userFilter ? parseInt(userFilter as string) : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : CHAT_CONSTANTS.DEFAULT_LIMIT,
        offset: offset ? parseInt(offset as string) : 0
      };

      // Validate limit
      if (filters.limit && (isNaN(filters.limit) || filters.limit > CHAT_CONSTANTS.MAX_LIMIT)) {
        res.status(400).json({
          success: false,
          error: `Limit must be a number between 1 and ${CHAT_CONSTANTS.MAX_LIMIT}`
        });
        return;
      }

      const messages = await chatService.getChatMessages(filters);

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: messages.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Create a new chat message
   * POST /api/chat
   */
  async createChatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const { message } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.MESSAGE_REQUIRED
        });
        return;
      }

      const chatMessage = await chatService.createChatMessage(userId, { message });

      res.status(201).json({
        success: true,
        data: chatMessage,
        message: 'Message sent successfully'
      });
    } catch (error: any) {
      if (error.message === CHAT_ERROR_MESSAGES.MESSAGE_REQUIRED ||
          error.message === CHAT_ERROR_MESSAGES.MESSAGE_TOO_LONG ||
          error.message === CHAT_ERROR_MESSAGES.MESSAGE_TOO_SHORT ||
          error.message === CHAT_ERROR_MESSAGES.INVALID_USER) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get chat message by ID
   * GET /api/chat/:id
   */
  async getChatMessageById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const messageId = parseInt(req.params['id']);

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID'
        });
        return;
      }

      const message = await chatService.getChatMessageById(messageId);

      if (!message) {
        res.status(404).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.MESSAGE_NOT_FOUND
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: message
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Delete chat message by ID (admin only)
   * DELETE /api/chat/:id
   */
  async deleteChatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const messageId = parseInt(req.params['id']);

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid message ID'
        });
        return;
      }

      const deleted = await chatService.deleteChatMessage(messageId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.MESSAGE_NOT_FOUND
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get chat statistics
   * GET /api/chat/statistics
   */
  async getChatStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      const statistics = await chatService.getChatStatistics();

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Clear all messages (admin only)
   * DELETE /api/chat/all
   */
  async clearAllMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: CHAT_ERROR_MESSAGES.UNAUTHORIZED
        });
        return;
      }

      await chatService.clearAllMessages();

      res.status(200).json({
        success: true,
        message: 'All messages cleared successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CHAT_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }
}

// Export singleton instance
export const chatController = new ChatController();