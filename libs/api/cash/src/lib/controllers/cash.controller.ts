/**
 * Cash controller - HTTP request handlers for cash management
 */

import { Request, Response } from 'express';
import { cashService } from '../services/cash.service';
import { CASH_ERROR_MESSAGES } from '../models/cash.model';

// Extend Request interface to include userId from auth middleware
interface AuthenticatedRequest extends Request {
  userId?: number;
}

export class CashController {
  /**
   * Create a new cash entry
   * POST /api/cash
   */
  async createCashEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { amount, date, notes } = req.body;
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const cashEntry = await cashService.createCashEntry(
        { amount, date, notes },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Cash entry created successfully',
        data: {
          id: cashEntry.id,
          amount: cashEntry.amount,
          date: cashEntry.date,
          notes: cashEntry.notes,
          createdAt: cashEntry.createdAt
        }
      });
    } catch (error: any) {
      if (error.message === CASH_ERROR_MESSAGES.INVALID_AMOUNT ||
          error.message === CASH_ERROR_MESSAGES.INVALID_DATE_FORMAT ||
          error.message === CASH_ERROR_MESSAGES.NOTES_TOO_LONG) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get cash entries for authenticated user
   * GET /api/cash
   */
  async getCashEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { startDate, endDate, limit, offset } = req.query;

      const filters = {
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      };

      const entries = await cashService.getCashEntries(userId, filters);

      res.status(200).json({
        success: true,
        count: entries.length,
        data: entries
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get cash entry by ID
   * GET /api/cash/:id
   */
  async getCashEntryById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const entryId = parseInt(id);
      if (isNaN(entryId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid cash entry ID'
        });
        return;
      }

      const entry = await cashService.getCashEntryById(entryId, userId);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: CASH_ERROR_MESSAGES.CASH_ENTRY_NOT_FOUND
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: entry
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Update cash entry
   * PUT /api/cash/:id
   */
  async updateCashEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const { amount, date, notes } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const entryId = parseInt(id);
      if (isNaN(entryId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid cash entry ID'
        });
        return;
      }

      const updatedEntry = await cashService.updateCashEntry(
        entryId,
        { amount, date, notes },
        userId
      );

      if (!updatedEntry) {
        res.status(404).json({
          success: false,
          error: CASH_ERROR_MESSAGES.CASH_ENTRY_NOT_FOUND
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Cash entry updated successfully',
        data: {
          id: updatedEntry.id,
          amount: updatedEntry.amount,
          date: updatedEntry.date,
          notes: updatedEntry.notes,
          updatedAt: updatedEntry.updatedAt
        }
      });
    } catch (error: any) {
      if (error.message === CASH_ERROR_MESSAGES.INVALID_AMOUNT ||
          error.message === CASH_ERROR_MESSAGES.INVALID_DATE_FORMAT ||
          error.message === CASH_ERROR_MESSAGES.NOTES_TOO_LONG) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Delete cash entry
   * DELETE /api/cash/:id
   */
  async deleteCashEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const entryId = parseInt(id);
      if (isNaN(entryId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid cash entry ID'
        });
        return;
      }

      const deleted = await cashService.deleteCashEntry(entryId, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: CASH_ERROR_MESSAGES.CASH_ENTRY_NOT_FOUND
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Cash entry deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }

  /**
   * Get cash statistics
   * GET /api/cash/stats
   */
  async getCashStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { startDate, endDate } = req.query;

      const filters = {
        startDate: startDate as string,
        endDate: endDate as string
      };

      const stats = await cashService.getCashStatistics(userId, filters);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: CASH_ERROR_MESSAGES.DATABASE_ERROR
      });
    }
  }
}

// Export singleton instance
export const cashController = new CashController();