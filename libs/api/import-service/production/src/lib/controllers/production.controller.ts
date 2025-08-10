import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ProductionSchedule, ProductionBatch, ProductionStep } from '../models';
import { ProductionService } from '../services/production.service';
import { logger } from '@bakery/api/core';

export class ProductionController {
  private static productionService = new ProductionService();

  /**
   * Get production schedules
   * @route GET /api/production/schedules
   */
  static async getSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { 
        startDate, 
        endDate, 
        status, 
        type = 'daily',
        limit = '50',
        offset = '0' 
      } = req.query;

      const whereClause: any = {};
      
      // Date range filter
      if (startDate && endDate) {
        whereClause.scheduleDate = {
          [Op.between]: [startDate as string, endDate as string]
        };
      } else if (startDate) {
        whereClause.scheduleDate = {
          [Op.gte]: startDate as string
        };
      } else if (endDate) {
        whereClause.scheduleDate = {
          [Op.lte]: endDate as string
        };
      }
      
      // Status filter
      if (status && status !== 'all') {
        whereClause.status = status;
      }
      
      // Type filter
      if (type && type !== 'all') {
        whereClause.scheduleType = type;
      }

      const result = await ProductionController.productionService.getSchedules(
        whereClause,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching production schedules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch production schedules'
      });
    }
  }

  /**
   * Create new production schedule
   * @route POST /api/production/schedules
   */
  static async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId; // From auth middleware
      const scheduleData = {
        ...req.body,
        createdBy: userId
      };

      const schedule = await ProductionController.productionService.createSchedule(scheduleData);

      res.status(201).json({
        success: true,
        data: schedule,
        message: 'Production schedule created successfully'
      });
    } catch (error) {
      logger.error('Error creating production schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create production schedule'
      });
    }
  }

  /**
   * Get production batches
   * @route GET /api/production/batches
   */
  static async getBatches(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status, 
        priority,
        date,
        workflowId,
        productId,
        limit = '50',
        offset = '0'
      } = req.query;

      const whereClause: any = {};

      if (status) whereClause.status = status;
      if (priority) whereClause.priority = priority;
      if (workflowId) whereClause.workflowId = workflowId;
      if (productId) whereClause.productId = productId;

      if (date) {
        const startOfDay = new Date(date as string);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date as string);
        endOfDay.setHours(23, 59, 59, 999);
        
        whereClause.plannedStartTime = {
          [Op.between]: [startOfDay, endOfDay]
        };
      }

      const result = await ProductionController.productionService.getBatches(
        whereClause,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching production batches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch production batches'
      });
    }
  }

  /**
   * Create new production batch
   * @route POST /api/production/batches
   */
  static async createBatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const batchData = {
        ...req.body,
        createdBy: userId
      };

      const batch = await ProductionController.productionService.createBatch(batchData);

      res.status(201).json({
        success: true,
        data: batch,
        message: 'Production batch created successfully'
      });
    } catch (error) {
      logger.error('Error creating production batch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create production batch'
      });
    }
  }

  /**
   * Get batch details with steps
   * @route GET /api/production/batches/:id
   */
  static async getBatchDetails(req: Request, res: Response): Promise<void> {
    try {
      const batchId = parseInt(req.params['id']);
      const batch = await ProductionController.productionService.getBatchWithSteps(batchId);

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Production batch not found'
        });
        return;
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (error) {
      logger.error('Error fetching batch details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch batch details'
      });
    }
  }

  /**
   * Update batch status
   * @route PATCH /api/production/batches/:id/status
   */
  static async updateBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const batchId = parseInt(req.params['id']);
      const { status, notes } = req.body;
      const userId = (req as any).userId;

      const batch = await ProductionController.productionService.updateBatchStatus(
        batchId,
        status,
        userId,
        notes
      );

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Production batch not found'
        });
        return;
      }

      res.json({
        success: true,
        data: batch,
        message: 'Batch status updated successfully'
      });
    } catch (error) {
      logger.error('Error updating batch status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update batch status'
      });
    }
  }

  /**
   * Start production batch
   * @route POST /api/production/batches/:id/start
   */
  static async startBatch(req: Request, res: Response): Promise<void> {
    try {
      const batchId = parseInt(req.params['id']);
      const batch = await ProductionController.productionService.startBatch(batchId);

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Production batch not found'
        });
        return;
      }

      res.json({
        success: true,
        data: batch,
        message: 'Production batch started successfully'
      });
    } catch (error) {
      logger.error('Error starting batch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start production batch'
      });
    }
  }

  /**
   * Complete production batch
   * @route POST /api/production/batches/:id/complete
   */
  static async completeBatch(req: Request, res: Response): Promise<void> {
    try {
      const batchId = parseInt(req.params['id']);
      const { actualQuantity, qualityNotes } = req.body;
      
      const batch = await ProductionController.productionService.completeBatch(
        batchId,
        actualQuantity,
        qualityNotes
      );

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Production batch not found'
        });
        return;
      }

      res.json({
        success: true,
        data: batch,
        message: 'Production batch completed successfully'
      });
    } catch (error) {
      logger.error('Error completing batch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete production batch'
      });
    }
  }

  /**
   * Get production steps for a batch
   * @route GET /api/production/batches/:id/steps
   */
  static async getBatchSteps(req: Request, res: Response): Promise<void> {
    try {
      const batchId = parseInt(req.params['id']);
      const steps = await ProductionController.productionService.getBatchSteps(batchId);

      res.json({
        success: true,
        data: steps
      });
    } catch (error) {
      logger.error('Error fetching batch steps:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch batch steps'
      });
    }
  }

  /**
   * Update production step
   * @route PATCH /api/production/steps/:id
   */
  static async updateStep(req: Request, res: Response): Promise<void> {
    try {
      const stepId = parseInt(req.params['id']);
      const updates = req.body;
      const userId = (req as any).userId;

      const step = await ProductionController.productionService.updateStep(
        stepId,
        updates,
        userId
      );

      if (!step) {
        res.status(404).json({
          success: false,
          error: 'Production step not found'
        });
        return;
      }

      res.json({
        success: true,
        data: step,
        message: 'Production step updated successfully'
      });
    } catch (error) {
      logger.error('Error updating step:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update production step'
      });
    }
  }

  /**
   * Complete production step
   * @route POST /api/production/steps/:id/complete
   */
  static async completeStep(req: Request, res: Response): Promise<void> {
    try {
      const stepId = parseInt(req.params['id']);
      const userId = (req as any).userId;
      const { qualityResults, notes } = req.body;

      const step = await ProductionController.productionService.completeStep(
        stepId,
        userId,
        qualityResults,
        notes
      );

      if (!step) {
        res.status(404).json({
          success: false,
          error: 'Production step not found'
        });
        return;
      }

      res.json({
        success: true,
        data: step,
        message: 'Production step completed successfully'
      });
    } catch (error) {
      logger.error('Error completing step:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete production step'
      });
    }
  }

  /**
   * Get today's production overview
   * @route GET /api/production/today
   */
  static async getTodayOverview(req: Request, res: Response): Promise<void> {
    try {
      const overview = await ProductionController.productionService.getTodayOverview();

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Error fetching today\'s overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch today\'s production overview'
      });
    }
  }
}