import { Op, Transaction, WhereOptions } from 'sequelize';
import { ProductionSchedule, ProductionBatch, ProductionStep, Recipe } from '../models';
import { logger } from '@bakery/api/core';

interface ScheduleData {
  scheduleDate: Date;
  scheduleType: 'daily' | 'weekly' | 'special';
  status?: string;
  targetQuantities: Record<string, number>;
  assignedStaffIds?: number[];
  notes?: string;
  metadata?: Record<string, any>;
  createdBy: number;
}

interface BatchData {
  workflowId: string;
  productId: number;
  recipeId?: number;
  plannedQuantity: number;
  plannedStartTime: Date;
  plannedEndTime?: Date;
  priority?: string;
  scheduleId?: number;
  assignedStaffIds?: number[];
  notes?: string;
  metadata?: Record<string, any>;
  createdBy: number;
}

interface StepUpdate {
  status?: string;
  progress?: number;
  actualParameters?: Record<string, any>;
  notes?: string;
  qualityResults?: Record<string, any>;
  assignedStaffIds?: number[];
}

interface TodayOverview {
  date: Date;
  schedules: ProductionSchedule[];
  batches: {
    total: number;
    byStatus: Record<string, number>;
    urgent: ProductionBatch[];
    inProgress: ProductionBatch[];
  };
  steps: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: ProductionStep[];
  };
  staffUtilization: Record<number, number>;
  completionRate: number;
}

export class ProductionService {
  /**
   * Get production schedules with pagination
   */
  async getSchedules(
    whereClause: WhereOptions<ProductionSchedule>,
    limit: number,
    offset: number
  ): Promise<{ schedules: ProductionSchedule[]; total: number }> {
    try {
      const { count, rows } = await ProductionSchedule.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['scheduleDate', 'DESC']],
        include: [
          {
            model: ProductionBatch,
            as: 'batches',
            required: false,
          }
        ]
      });

      return {
        schedules: rows,
        total: count
      };
    } catch (error) {
      logger.error('Error in getSchedules:', error);
      throw error;
    }
  }

  /**
   * Create new production schedule
   */
  async createSchedule(data: ScheduleData): Promise<ProductionSchedule> {
    try {
      const schedule = await ProductionSchedule.create(data);
      logger.info(`Created production schedule ${schedule.id} for ${data.scheduleDate}`);
      return schedule;
    } catch (error) {
      logger.error('Error creating schedule:', error);
      throw error;
    }
  }

  /**
   * Get production batches with pagination
   */
  async getBatches(
    whereClause: WhereOptions<ProductionBatch>,
    limit: number,
    offset: number
  ): Promise<{ batches: ProductionBatch[]; total: number }> {
    try {
      const { count, rows } = await ProductionBatch.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [
          ['priority', 'DESC'],
          ['plannedStartTime', 'ASC']
        ],
        include: [
          {
            model: Recipe,
            as: 'recipe',
            required: false,
          }
        ]
      });

      return {
        batches: rows,
        total: count
      };
    } catch (error) {
      logger.error('Error in getBatches:', error);
      throw error;
    }
  }

  /**
   * Create new production batch with workflow steps
   */
  async createBatch(data: BatchData): Promise<ProductionBatch> {
    const transaction = await ProductionBatch.sequelize!.transaction();

    try {
      // Create the batch
      const batch = await ProductionBatch.create(data, { transaction });

      // Load workflow definition (would normally come from a workflow service)
      const workflowSteps = await this.getWorkflowSteps(data.workflowId);

      // Create production steps based on workflow
      const steps = await this.createProductionSteps(batch.id, workflowSteps, data.plannedStartTime, transaction);

      await transaction.commit();
      
      logger.info(`Created production batch ${batch.id} with ${steps.length} steps`);
      
      // Return batch with steps
      return await this.getBatchWithSteps(batch.id) as ProductionBatch;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating batch:', error);
      throw error;
    }
  }

  /**
   * Get batch with all its steps
   */
  async getBatchWithSteps(batchId: number): Promise<ProductionBatch | null> {
    try {
      const batch = await ProductionBatch.findByPk(batchId, {
        include: [
          {
            model: ProductionStep,
            as: 'steps',
            order: [['stepIndex', 'ASC']]
          },
          {
            model: Recipe,
            as: 'recipe',
            required: false
          }
        ]
      });

      return batch;
    } catch (error) {
      logger.error('Error fetching batch with steps:', error);
      throw error;
    }
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: number,
    status: string,
    userId: number,
    notes?: string
  ): Promise<ProductionBatch | null> {
    try {
      const batch = await ProductionBatch.findByPk(batchId);
      if (!batch) return null;

      batch.status = status as any;
      if (notes) {
        batch.notes = (batch.notes || '') + `\n[${new Date().toISOString()}] Status changed to ${status}: ${notes}`;
      }

      // Update timeline based on status
      if (status === 'in_progress' && !batch.actualStartTime) {
        batch.actualStartTime = new Date();
      } else if (status === 'completed' && !batch.actualEndTime) {
        batch.actualEndTime = new Date();
        batch.completedBy = userId;
      }

      await batch.save();
      logger.info(`Updated batch ${batchId} status to ${status}`);
      
      return batch;
    } catch (error) {
      logger.error('Error updating batch status:', error);
      throw error;
    }
  }

  /**
   * Start production batch
   */
  async startBatch(batchId: number): Promise<ProductionBatch | null> {
    const transaction = await ProductionBatch.sequelize!.transaction();

    try {
      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{
          model: ProductionStep,
          as: 'steps'
        }],
        transaction
      });

      if (!batch) return null;

      // Update batch
      batch.status = 'in_progress';
      batch.actualStartTime = new Date();
      await batch.save({ transaction });

      // Mark first step as ready
      const firstStep = batch.steps?.find(s => s.stepIndex === 0);
      if (firstStep) {
        firstStep.status = 'ready';
        await firstStep.save({ transaction });
      }

      await transaction.commit();
      logger.info(`Started production batch ${batchId}`);
      
      return batch;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error starting batch:', error);
      throw error;
    }
  }

  /**
   * Complete production batch
   */
  async completeBatch(
    batchId: number,
    actualQuantity: number,
    qualityNotes?: string
  ): Promise<ProductionBatch | null> {
    try {
      const batch = await ProductionBatch.findByPk(batchId);
      if (!batch) return null;

      batch.status = 'completed';
      batch.actualEndTime = new Date();
      batch.actualQuantity = actualQuantity;
      batch.qualityNotes = qualityNotes || null;

      await batch.save();
      logger.info(`Completed production batch ${batchId} with quantity ${actualQuantity}`);
      
      return batch;
    } catch (error) {
      logger.error('Error completing batch:', error);
      throw error;
    }
  }

  /**
   * Get production steps for a batch
   */
  async getBatchSteps(batchId: number): Promise<ProductionStep[]> {
    try {
      const steps = await ProductionStep.findAll({
        where: { batchId },
        order: [['stepIndex', 'ASC']]
      });

      return steps;
    } catch (error) {
      logger.error('Error fetching batch steps:', error);
      throw error;
    }
  }

  /**
   * Update production step
   */
  async updateStep(
    stepId: number,
    updates: StepUpdate,
    userId: number
  ): Promise<ProductionStep | null> {
    try {
      const step = await ProductionStep.findByPk(stepId);
      if (!step) return null;

      // Apply updates
      Object.assign(step, updates);

      // Update timestamps based on status
      if (updates.status === 'in_progress' && !step.actualStartTime) {
        step.actualStartTime = new Date();
      } else if (updates.status === 'completed') {
        step.actualEndTime = new Date();
        step.completedBy = userId;
      }

      await step.save();
      logger.info(`Updated production step ${stepId}`);
      
      // Check if we need to update next step
      if (updates.status === 'completed') {
        await this.updateNextStepStatus(step.batchId, step.stepIndex);
      }

      return step;
    } catch (error) {
      logger.error('Error updating step:', error);
      throw error;
    }
  }

  /**
   * Complete production step
   */
  async completeStep(
    stepId: number,
    userId: number,
    qualityResults?: Record<string, any>,
    notes?: string
  ): Promise<ProductionStep | null> {
    try {
      const step = await ProductionStep.findByPk(stepId);
      if (!step) return null;

      await step.completeStep(userId);
      
      if (qualityResults) {
        step.qualityResults = qualityResults;
        step.qualityCheckCompleted = true;
      }
      
      if (notes) {
        step.notes = notes;
      }

      await step.save();
      
      // Update next step
      await this.updateNextStepStatus(step.batchId, step.stepIndex);

      return step;
    } catch (error) {
      logger.error('Error completing step:', error);
      throw error;
    }
  }

  /**
   * Get today's production overview
   */
  async getTodayOverview(): Promise<TodayOverview> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's schedules
      const schedules = await ProductionSchedule.findAll({
        where: {
          scheduleDate: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        }
      });

      // Get today's batches
      const batches = await ProductionBatch.findAll({
        where: {
          [Op.or]: [
            {
              plannedStartTime: {
                [Op.gte]: today,
                [Op.lt]: tomorrow
              }
            },
            {
              status: ['in_progress', 'ready']
            }
          ]
        },
        include: [{
          model: ProductionStep,
          as: 'steps'
        }]
      });

      // Calculate batch statistics
      const batchStats = {
        total: batches.length,
        byStatus: batches.reduce((acc, batch) => {
          acc[batch.status] = (acc[batch.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        urgent: batches.filter(b => b.priority === 'urgent'),
        inProgress: batches.filter(b => b.status === 'in_progress')
      };

      // Calculate step statistics
      const allSteps = batches.flatMap(b => b.steps || []);
      const stepStats = {
        total: allSteps.length,
        completed: allSteps.filter(s => s.status === 'completed').length,
        inProgress: allSteps.filter(s => s.status === 'in_progress').length,
        overdue: allSteps.filter(s => s.isOverdue)
      };

      // Calculate staff utilization
      const staffUtilization = batches.reduce((acc, batch) => {
        batch.assignedStaffIds.forEach(staffId => {
          acc[staffId] = (acc[staffId] || 0) + 1;
        });
        return acc;
      }, {} as Record<number, number>);

      // Calculate completion rate
      const completionRate = stepStats.total > 0 
        ? Math.round((stepStats.completed / stepStats.total) * 100)
        : 0;

      return {
        date: today,
        schedules,
        batches: batchStats,
        steps: stepStats,
        staffUtilization,
        completionRate
      };
    } catch (error) {
      logger.error('Error getting today overview:', error);
      throw error;
    }
  }

  /**
   * Helper: Get workflow steps (mock implementation)
   */
  private async getWorkflowSteps(workflowId: string): Promise<any[]> {
    // In a real implementation, this would load from a workflow service or database
    // For now, return mock workflow steps
    const workflows: Record<string, any[]> = {
      'bread-production': [
        {
          stepName: 'Mixing',
          stepType: 'active',
          plannedDurationMinutes: 30,
          activities: ['Measure ingredients', 'Mix dough', 'Check consistency'],
          parameters: { mixingSpeed: 'medium', duration: 20 }
        },
        {
          stepName: 'First Rise',
          stepType: 'sleep',
          plannedDurationMinutes: 120,
          parameters: { temperature: 28, humidity: 75 }
        },
        {
          stepName: 'Shaping',
          stepType: 'active',
          plannedDurationMinutes: 45,
          activities: ['Divide dough', 'Shape loaves', 'Place in pans']
        },
        {
          stepName: 'Final Proof',
          stepType: 'sleep',
          plannedDurationMinutes: 90,
          parameters: { temperature: 30, humidity: 80 }
        },
        {
          stepName: 'Baking',
          stepType: 'active',
          plannedDurationMinutes: 40,
          activities: ['Load oven', 'Monitor baking', 'Remove when done'],
          parameters: { temperature: 200, steamInjection: true }
        },
        {
          stepName: 'Quality Check',
          stepType: 'quality_check',
          plannedDurationMinutes: 15,
          qualityCheckRequired: true
        }
      ],
      'pastry-production': [
        {
          stepName: 'Dough Preparation',
          stepType: 'active',
          plannedDurationMinutes: 45,
          activities: ['Prepare butter block', 'Mix dough', 'Initial fold']
        },
        {
          stepName: 'Lamination',
          stepType: 'active',
          plannedDurationMinutes: 60,
          activities: ['First fold', 'Second fold', 'Third fold'],
          repeatCount: 3
        },
        {
          stepName: 'Resting',
          stepType: 'sleep',
          plannedDurationMinutes: 180,
          parameters: { temperature: 4 }
        },
        {
          stepName: 'Shaping',
          stepType: 'active',
          plannedDurationMinutes: 30,
          activities: ['Cut dough', 'Shape croissants', 'Place on trays']
        },
        {
          stepName: 'Proofing',
          stepType: 'sleep',
          plannedDurationMinutes: 120,
          parameters: { temperature: 28, humidity: 75 }
        },
        {
          stepName: 'Baking',
          stepType: 'active',
          plannedDurationMinutes: 25,
          parameters: { temperature: 180 }
        }
      ]
    };

    return workflows[workflowId] || [];
  }

  /**
   * Helper: Create production steps from workflow
   */
  private async createProductionSteps(
    batchId: number,
    workflowSteps: any[],
    startTime: Date,
    transaction: Transaction
  ): Promise<ProductionStep[]> {
    const steps: ProductionStep[] = [];
    let currentTime = new Date(startTime);

    for (let i = 0; i < workflowSteps.length; i++) {
      const workflowStep = workflowSteps[i];
      const plannedStartTime = new Date(currentTime);
      const plannedEndTime = new Date(currentTime);
      plannedEndTime.setMinutes(plannedEndTime.getMinutes() + (workflowStep.plannedDurationMinutes || 60));

      const step = await ProductionStep.create({
        batchId,
        stepIndex: i,
        stepName: workflowStep.stepName,
        stepType: workflowStep.stepType,
        plannedStartTime,
        plannedEndTime,
        plannedDurationMinutes: workflowStep.plannedDurationMinutes,
        status: i === 0 ? 'ready' : 'pending',
        progress: 0,
        activities: workflowStep.activities || [],
        completedActivities: [],
        conditions: workflowStep.conditions || [],
        parameters: workflowStep.parameters || {},
        actualParameters: {},
        assignedStaffIds: [],
        requiredEquipment: workflowStep.requiredEquipment || [],
        location: workflowStep.location || null,
        qualityCheckRequired: workflowStep.qualityCheckRequired || false,
        qualityCheckCompleted: false,
        qualityResults: {},
        hasIssues: false,
        issues: [],
        notes: null,
        workflowNotes: workflowStep.notes || null,
        repeatCount: workflowStep.repeatCount || 1,
        currentRepeat: 1,
        metadata: workflowStep.metadata || {},
        completedBy: null
      }, { transaction });

      steps.push(step);
      currentTime = plannedEndTime;
    }

    return steps;
  }

  /**
   * Helper: Update next step status when current step is completed
   */
  private async updateNextStepStatus(batchId: number, currentStepIndex: number): Promise<void> {
    try {
      const nextStep = await ProductionStep.findOne({
        where: {
          batchId,
          stepIndex: currentStepIndex + 1
        }
      });

      if (nextStep && nextStep.status === 'pending') {
        nextStep.status = 'ready';
        await nextStep.save();
        logger.info(`Set step ${nextStep.id} to ready status`);
      }

      // Check if all steps are complete and update batch
      const allSteps = await ProductionStep.findAll({
        where: { batchId }
      });

      if (allSteps.every(s => s.status === 'completed')) {
        await ProductionBatch.update(
          { status: 'completed', actualEndTime: new Date() },
          { where: { id: batchId } }
        );
        logger.info(`All steps completed for batch ${batchId}, marking batch as completed`);
      }
    } catch (error) {
      logger.error('Error updating next step status:', error);
      // Don't throw - this is a helper function
    }
  }
}