import { Request, Response } from 'express';
import { UnsoldProductService } from '../services/unsold-product.service';
import {
  CreateUnsoldProductInput,
  UpdateUnsoldProductInput,
  UnsoldProductFilters,
  UNSOLD_PRODUCT_ERROR_MESSAGES
} from '../models/unsold-product.model';
// Temporary local logger until utils is fixed
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) => console.log(`[DB] ${message}`, ...args)
};

export class UnsoldProductController {
  constructor(private unsoldProductService: UnsoldProductService) {}

  /**
   * Add unsold product entry
   */
  addUnsoldProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId; // From auth middleware

      if (!userId) {
        logger.warn('No user ID found in request');
        res.status(401).json({ 
          success: false,
          error: UNSOLD_PRODUCT_ERROR_MESSAGES.UNAUTHORIZED 
        });
        return;
      }

      const input: CreateUnsoldProductInput = {
        productId: req.body.productId,
        quantity: req.body.quantity,
        date: req.body.date,
        reason: req.body.reason,
        notes: req.body.notes
      };

      const unsoldProduct = await this.unsoldProductService.addUnsoldProduct(input, userId);

      res.json({
        success: true,
        message: 'Unsold product entry saved',
        data: unsoldProduct
      });
    } catch (error: any) {
      logger.error('Error adding unsold product entry:', error);

      if (error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.PRODUCT_NOT_FOUND) {
        res.status(404).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      if (error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE ||
          error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.FUTURE_DATE_NOT_ALLOWED) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Get unsold products history
   */
  getUnsoldProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: UnsoldProductFilters = {
        startDate: req.query['startDate'] as string,
        endDate: req.query['endDate'] as string,
        productId: req.query['productId'] ? parseInt(req.query['productId'] as string) : undefined,
        category: req.query['category'] as string,
        userId: req.query['userId'] ? parseInt(req.query['userId'] as string) : undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20
      };

      const result = await this.unsoldProductService.getUnsoldProducts(filters);

      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          totalPages: result.totalPages,
          totalItems: result.total,
          itemsPerPage: filters.limit || 20
        }
      });
    } catch (error: any) {
      logger.error('Error retrieving unsold products:', error);

      if (error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE ||
          error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE_RANGE) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Get unsold products summary
   */
  getUnsoldProductsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = {
        startDate: req.query['startDate'] as string,
        endDate: req.query['endDate'] as string
      };

      const summary = await this.unsoldProductService.getUnsoldProductsSummary(filters);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error retrieving unsold products summary:', error);
      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Get daily waste report
   */
  getDailyWasteReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const date = req.query['date'] as string || new Date().toISOString().split('T')[0];

      const report = await this.unsoldProductService.getDailyWasteReport(date);

      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      logger.error('Error generating daily waste report:', error);

      if (error.message === UNSOLD_PRODUCT_ERROR_MESSAGES.INVALID_DATE) {
        res.status(400).json({ 
          success: false,
          error: error.message 
        });
        return;
      }

      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Update unsold product entry
   */
  updateUnsoldProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params['id']);

      if (isNaN(id)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid unsold product ID' 
        });
        return;
      }

      const input: UpdateUnsoldProductInput = {
        quantity: req.body.quantity,
        reason: req.body.reason,
        notes: req.body.notes
      };

      const updated = await this.unsoldProductService.updateUnsoldProduct(id, input);

      if (!updated) {
        res.status(404).json({ 
          success: false,
          error: UNSOLD_PRODUCT_ERROR_MESSAGES.ENTRY_NOT_FOUND 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Unsold product entry updated',
        data: updated
      });
    } catch (error) {
      logger.error('Error updating unsold product:', error);
      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };

  /**
   * Delete unsold product entry
   */
  deleteUnsoldProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params['id']);

      if (isNaN(id)) {
        res.status(400).json({ 
          success: false,
          error: 'Invalid unsold product ID' 
        });
        return;
      }

      const deleted = await this.unsoldProductService.deleteUnsoldProduct(id);

      if (!deleted) {
        res.status(404).json({ 
          success: false,
          error: UNSOLD_PRODUCT_ERROR_MESSAGES.ENTRY_NOT_FOUND 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Unsold product entry deleted'
      });
    } catch (error) {
      logger.error('Error deleting unsold product:', error);
      res.status(500).json({ 
        success: false,
        error: UNSOLD_PRODUCT_ERROR_MESSAGES.DATABASE_ERROR 
      });
    }
  };
}