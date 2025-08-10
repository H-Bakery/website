import { Request, Response } from 'express';
import { BakingListService } from '../services/baking-list.service';
import {
  BakingListFilters,
  CreateProductionPlanInput,
  BAKING_LIST_ERROR_MESSAGES
} from '../models/baking-list.model';
// Temporary local logger until utils is fixed
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) => console.log(`[DB] ${message}`, ...args)
};

export class BakingListController {
  constructor(private bakingListService: BakingListService) {}

  /**
   * Get baking list for a specific date
   */
  getBakingList = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: BakingListFilters = {
        date: req.query['date'] as string
      };

      const bakingList = await this.bakingListService.getBakingList(filters);

      res.json(bakingList);
    } catch (error: any) {
      logger.error('Error generating baking list:', error);

      if (error.message === BAKING_LIST_ERROR_MESSAGES.INVALID_DATE) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      if (error.message === BAKING_LIST_ERROR_MESSAGES.NO_PRODUCTS_FOUND) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error generating baking list'
      });
    }
  };

  /**
   * Get Hefezopf-specific orders
   */
  getHefezopfOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const date = req.query['date'] as string;

      const hefezopfOrders = await this.bakingListService.getHefezopfOrders(date);

      res.json(hefezopfOrders);
    } catch (error: any) {
      logger.error('Error fetching hefezopf orders:', error);

      if (error.message === BAKING_LIST_ERROR_MESSAGES.INVALID_DATE) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Save production plan
   */
  saveProductionPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, plan } = req.body;
      const userId = (req as any).userId; // From auth middleware

      if (!date || !plan) {
        res.status(400).json({
          success: false,
          error: 'Date and plan are required'
        });
        return;
      }

      const input: CreateProductionPlanInput = {
        date,
        plan,
        notes: req.body.notes
      };

      const result = await this.bakingListService.saveProductionPlan(input, userId);

      res.json(result);
    } catch (error: any) {
      logger.error('Error saving production plan:', error);

      if (error.message === BAKING_LIST_ERROR_MESSAGES.INVALID_DATE ||
          error.message === BAKING_LIST_ERROR_MESSAGES.INVALID_QUANTITY ||
          error.message === BAKING_LIST_ERROR_MESSAGES.PLAN_ALREADY_EXISTS ||
          error.message.includes('Invalid plan item')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to save production plan'
      });
    }
  };

  /**
   * Get production plan by date
   */
  getProductionPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const date = req.query['date'] as string;

      if (!date) {
        res.status(400).json({
          success: false,
          error: BAKING_LIST_ERROR_MESSAGES.DATE_REQUIRED
        });
        return;
      }

      const plan = await this.bakingListService.getProductionPlan(date);

      if (!plan) {
        res.status(404).json({
          success: false,
          error: BAKING_LIST_ERROR_MESSAGES.PLAN_NOT_FOUND
        });
        return;
      }

      res.json({
        success: true,
        data: plan
      });
    } catch (error: any) {
      logger.error('Error fetching production plan:', error);

      if (error.message === BAKING_LIST_ERROR_MESSAGES.INVALID_DATE) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch production plan'
      });
    }
  };
}