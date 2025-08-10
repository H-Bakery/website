import { Router } from 'express';
import { ProductionController } from '../controllers/production.controller';
import { authMiddleware } from '@bakery/api/core';
import { validationMiddleware } from '@bakery/api/core';
import { 
  createScheduleValidator,
  createBatchValidator,
  updateBatchStatusValidator,
  completeBatchValidator,
  updateStepValidator,
  completeStepValidator
} from '../validators/production.validator';

const router = Router();

// All production routes require authentication
router.use(authMiddleware);

/**
 * Production Schedule Routes
 */

// Get production schedules
router.get(
  '/schedules',
  ProductionController.getSchedules
);

// Create new production schedule
router.post(
  '/schedules',
  createScheduleValidator,
  validationMiddleware,
  ProductionController.createSchedule
);

/**
 * Production Batch Routes
 */

// Get production batches
router.get(
  '/batches',
  ProductionController.getBatches
);

// Create new production batch
router.post(
  '/batches',
  createBatchValidator,
  validationMiddleware,
  ProductionController.createBatch
);

// Get batch details with steps
router.get(
  '/batches/:id',
  ProductionController.getBatchDetails
);

// Update batch status
router.patch(
  '/batches/:id/status',
  updateBatchStatusValidator,
  validationMiddleware,
  ProductionController.updateBatchStatus
);

// Start production batch
router.post(
  '/batches/:id/start',
  ProductionController.startBatch
);

// Complete production batch
router.post(
  '/batches/:id/complete',
  completeBatchValidator,
  validationMiddleware,
  ProductionController.completeBatch
);

// Get batch steps
router.get(
  '/batches/:id/steps',
  ProductionController.getBatchSteps
);

/**
 * Production Step Routes
 */

// Update production step
router.patch(
  '/steps/:id',
  updateStepValidator,
  validationMiddleware,
  ProductionController.updateStep
);

// Complete production step
router.post(
  '/steps/:id/complete',
  completeStepValidator,
  validationMiddleware,
  ProductionController.completeStep
);

/**
 * Overview Routes
 */

// Get today's production overview
router.get(
  '/today',
  ProductionController.getTodayOverview
);

export default router;