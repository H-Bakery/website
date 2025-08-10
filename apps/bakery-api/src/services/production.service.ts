import { Op } from 'sequelize'
import {
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  User,
  Product
} from '../models'
import workflowParser, { Workflow } from '../utils/workflowParser'
import notificationHelper, { NotificationData } from '../utils/notificationHelper'
import { logger } from '../utils/logger'

export interface ScheduleData {
  scheduleDate: Date | string
  scheduleType?: 'daily' | 'weekly' | 'special'
  staffShifts?: Record<string, any>
  availableEquipment?: any[]
  plannedBatches?: any[]
  workdayStartTime?: string
  workdayEndTime?: string
  notes?: string
}

export interface BatchData {
  name: string
  workflowId: string
  productId?: number
  recipeId?: number
  plannedQuantity: number
  unit?: string
  plannedStartTime: Date | string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedStaffIds?: number[]
  requiredEquipment?: string[]
  notes?: string
}

export interface StepCompletionData {
  qualityResults?: any
  actualParameters?: any
  notes?: string
}

export interface ScheduleFilters {
  startDate?: Date | string
  endDate?: Date | string
  status?: string
  type?: string
  limit?: number
  offset?: number
  includeMetrics?: boolean
}

export interface CapacityMetrics {
  totalStaffHours: number
  estimatedProductionTime: number
  workdayMinutes: number
}

class ProductionService {
  // ============================================================================
  // SCHEDULE MANAGEMENT
  // ============================================================================

  /**
   * Create a new production schedule with validation and optimization
   */
  async createSchedule(scheduleData: ScheduleData, userId: number): Promise<ProductionSchedule> {
    try {
      logger.info('Creating production schedule', {
        date: scheduleData.scheduleDate,
        userId,
      })

      // Validate schedule data
      await this.validateScheduleData(scheduleData)

      // Check for existing schedule on the same date
      const existingSchedule = await ProductionSchedule.findOne({
        where: { scheduleDate: scheduleData.scheduleDate },
      })

      if (existingSchedule) {
        throw new Error(
          `Production schedule already exists for ${scheduleData.scheduleDate}`
        )
      }

      // Calculate capacity metrics
      const capacityMetrics = await this.calculateScheduleCapacity(scheduleData)

      // Create the schedule
      const schedule = await ProductionSchedule.create({
        ...scheduleData,
        ...capacityMetrics,
        createdBy: userId,
        status: 'draft',
      } as any)

      // Send notification
      await notificationHelper.sendNotification({
        userId,
        title: 'Neuer Produktionsplan erstellt',
        message: `Produktionsplan für ${scheduleData.scheduleDate} wurde erstellt`,
        type: 'info',
        category: 'production',
        priority: 'low',
        templateKey: 'production.schedule_created',
        templateVars: {
          date: scheduleData.scheduleDate,
          type: scheduleData.scheduleType || 'daily',
        },
      })

      logger.info(`Production schedule created successfully: ${schedule.id}`)
      return schedule
    } catch (error) {
      logger.error('Error creating production schedule:', error)
      throw error
    }
  }

  /**
   * Update production schedule with business logic validation
   */
  async updateSchedule(
    scheduleId: number,
    updateData: Partial<ScheduleData>,
    userId: number
  ): Promise<ProductionSchedule> {
    try {
      logger.info(`Updating production schedule: ${scheduleId}`, { userId })

      const schedule = await ProductionSchedule.findByPk(scheduleId)
      if (!schedule) {
        throw new Error('Production schedule not found')
      }

      // Validate status transitions
      if (
        updateData.status &&
        !this.isValidStatusTransition(schedule.status, updateData.status as any)
      ) {
        throw new Error(
          `Invalid status transition from ${schedule.status} to ${updateData.status}`
        )
      }

      // Recalculate capacity if staff or equipment changed
      if (updateData.staffShifts || updateData.availableEquipment) {
        const capacityMetrics = await this.calculateScheduleCapacity({
          ...schedule.toJSON(),
          ...updateData,
        })
        Object.assign(updateData, capacityMetrics)
      }

      await schedule.update(updateData)

      logger.info(`Production schedule updated successfully: ${scheduleId}`)
      return schedule
    } catch (error) {
      logger.error(`Error updating production schedule ${scheduleId}:`, error)
      throw error
    }
  }

  /**
   * Get schedules with advanced filtering and pagination
   */
  async getSchedules(filters: ScheduleFilters = {}): Promise<{
    schedules: ProductionSchedule[]
    total: number
    hasMore: boolean
  }> {
    try {
      const {
        startDate,
        endDate,
        status,
        type,
        limit = 50,
        offset = 0,
        includeMetrics = false,
      } = filters

      const whereClause: any = {}

      // Date range filter
      if (startDate || endDate) {
        whereClause.scheduleDate = {}
        if (startDate) whereClause.scheduleDate[Op.gte] = startDate
        if (endDate) whereClause.scheduleDate[Op.lte] = endDate
      }

      // Status and type filters
      if (status && status !== 'all') whereClause.status = status
      if (type && type !== 'all') whereClause.scheduleType = type

      const include = [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'username', 'email'],
        },
        {
          model: User,
          as: 'Approver',
          attributes: ['id', 'username', 'email'],
        },
      ]

      const schedules = await ProductionSchedule.findAndCountAll({
        where: whereClause,
        include,
        order: [['scheduleDate', 'DESC']],
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
      })

      // Add metrics if requested
      if (includeMetrics) {
        for (const schedule of schedules.rows) {
          (schedule as any).dataValues.metrics = await this.calculateScheduleMetrics(
            schedule
          )
        }
      }

      return {
        schedules: schedules.rows,
        total: schedules.count,
        hasMore: parseInt(offset.toString()) + schedules.rows.length < schedules.count,
      }
    } catch (error) {
      logger.error('Error fetching production schedules:', error)
      throw error
    }
  }

  // ============================================================================
  // BATCH MANAGEMENT
  // ============================================================================

  /**
   * Create a production batch with workflow integration
   */
  async createBatch(batchData: BatchData, userId: number): Promise<{
    batch: ProductionBatch
    steps: ProductionStep[]
  }> {
    try {
      logger.info('Creating production batch', {
        name: batchData.name,
        workflow: batchData.workflowId,
        userId,
      })

      // Validate workflow exists
      const workflow = await workflowParser.getWorkflowById(batchData.workflowId)
      if (!workflow) {
        throw new Error(`Workflow not found: ${batchData.workflowId}`)
      }

      // Calculate timing based on workflow
      const timingData = await this.calculateBatchTiming(batchData, workflow)

      // Create the batch
      const batch = await ProductionBatch.create({
        ...batchData,
        ...timingData,
        createdBy: userId,
        status: 'planned',
      } as any)

      // Create production steps from workflow
      const steps = await this.createBatchSteps(batch.id, workflow)

      // Send notification
      await notificationHelper.sendNotification({
        userId,
        title: 'Neuer Produktionsauftrag',
        message: `${batchData.name} wurde für ${new Date(
          batchData.plannedStartTime
        ).toLocaleString('de-DE')} geplant`,
        type: 'info',
        category: 'production',
        priority: 'low',
        templateKey: 'production.batch_created',
        templateVars: {
          batchName: batchData.name,
          startTime: batchData.plannedStartTime,
          quantity: batchData.plannedQuantity,
          unit: batchData.unit,
        },
      })

      logger.info(
        `Production batch created successfully: ${batch.id} with ${steps.length} steps`
      )
      return { batch, steps }
    } catch (error) {
      logger.error('Error creating production batch:', error)
      throw error
    }
  }

  /**
   * Start a production batch with validation
   */
  async startBatch(batchId: number, userId: number): Promise<ProductionBatch> {
    try {
      logger.info(`Starting production batch: ${batchId}`, { userId })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      // Validate batch can be started
      if (!['planned', 'ready'].includes(batch.status)) {
        throw new Error(`Batch cannot be started in status: ${batch.status}`)
      }

      // Check resource availability
      await this.validateResourceAvailability(batch)

      const now = new Date()

      // Update batch status
      await batch.update({
        status: 'in_progress',
        actualStartTime: now,
        updatedBy: userId,
      })

      // Start first step
      const firstStep = batch.steps?.find((step: any) => step.stepIndex === 0)
      if (firstStep) {
        await firstStep.update({
          status: 'ready',
          actualStartTime: now,
        })
      }

      // Send notification
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktion gestartet',
        message: `${batch.name} wurde gestartet`,
        type: 'info',
        category: 'production',
        priority: 'medium',
        templateKey: 'production.start',
        templateVars: {
          batchName: batch.name,
          startTime: now.toLocaleString('de-DE'),
        },
      })

      logger.info(`Production batch started successfully: ${batchId}`)
      return batch
    } catch (error) {
      logger.error(`Error starting production batch ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Complete a production step and advance workflow
   */
  async completeStep(
    stepId: number,
    completionData: StepCompletionData,
    userId: number
  ): Promise<ProductionStep> {
    try {
      logger.info(`Completing production step: ${stepId}`, { userId })

      const step = await ProductionStep.findByPk(stepId, {
        include: [{ model: ProductionBatch, as: 'batch' }],
      })

      if (!step) {
        throw new Error('Production step not found')
      }

      if (step.status !== 'in_progress') {
        throw new Error('Step is not in progress')
      }

      const now = new Date()

      // Update step completion
      await step.update({
        status: 'completed',
        actualEndTime: now,
        completedBy: userId,
        progress: 100,
        qualityResults: completionData.qualityResults || step.qualityResults,
        actualParameters:
          completionData.actualParameters || step.actualParameters,
        notes: completionData.notes || step.notes,
      })

      // Progress workflow
      await this.progressWorkflow(step.batchId, step.stepIndex + 1)

      // Check batch completion
      await this.checkBatchCompletion(step.batch)

      logger.info(`Production step completed successfully: ${stepId}`)
      return step
    } catch (error) {
      logger.error(`Error completing production step ${stepId}:`, error)
      throw error
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Validate schedule data
   */
  private async validateScheduleData(scheduleData: ScheduleData): Promise<void> {
    if (!scheduleData.scheduleDate) {
      throw new Error('Schedule date is required')
    }

    const scheduleDate = new Date(scheduleData.scheduleDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (scheduleDate < today) {
      throw new Error('Cannot create schedule for past dates')
    }

    // Validate staff shifts if provided
    if (scheduleData.staffShifts) {
      for (const [staffId, shift] of Object.entries(scheduleData.staffShifts)) {
        if (!shift.start || !shift.end) {
          throw new Error(`Invalid shift data for staff ${staffId}`)
        }
      }
    }
  }

  /**
   * Calculate schedule capacity metrics
   */
  private async calculateScheduleCapacity(scheduleData: ScheduleData): Promise<CapacityMetrics> {
    let totalStaffHours = 0
    let estimatedProductionTime = 0

    // Calculate total staff hours
    if (scheduleData.staffShifts) {
      totalStaffHours = Object.values(scheduleData.staffShifts).reduce(
        (total, shift: any) => {
          if (shift.start && shift.end) {
            const start = new Date(`1970-01-01T${shift.start}`)
            const end = new Date(`1970-01-01T${shift.end}`)
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
            return total + Math.max(hours, 0)
          }
          return total
        },
        0
      )
    }

    // Calculate workday duration
    const workdayMinutes =
      scheduleData.workdayStartTime && scheduleData.workdayEndTime
        ? this.calculateWorkdayMinutes(
            scheduleData.workdayStartTime,
            scheduleData.workdayEndTime
          )
        : 720 // Default 12 hours

    return {
      totalStaffHours,
      estimatedProductionTime,
      workdayMinutes,
    }
  }

  /**
   * Check if status transition is valid
   */
  private isValidStatusTransition(
    currentStatus: string,
    newStatus: string
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      draft: ['planned', 'cancelled'],
      planned: ['active', 'cancelled'],
      active: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['draft'],
    }

    return validTransitions[currentStatus]?.includes(newStatus) || false
  }

  /**
   * Calculate batch timing based on workflow
   */
  private async calculateBatchTiming(
    batchData: BatchData,
    workflow: Workflow
  ): Promise<{ plannedEndTime: Date; estimatedDurationMinutes: number }> {
    let totalDurationMinutes = 0

    // Calculate total duration from workflow steps
    if (workflow.steps) {
      totalDurationMinutes = workflow.steps.reduce((total, step) => {
        return (
          total +
          this.parseStepDuration(step.timeout || step.duration || '30min')
        )
      }, 0)
    }

    const plannedStartTime = new Date(batchData.plannedStartTime)
    const plannedEndTime = new Date(
      plannedStartTime.getTime() + totalDurationMinutes * 60 * 1000
    )

    return {
      plannedEndTime,
      estimatedDurationMinutes: totalDurationMinutes,
    }
  }

  /**
   * Create production steps from workflow
   */
  private async createBatchSteps(
    batchId: number,
    workflow: Workflow
  ): Promise<ProductionStep[]> {
    if (!workflow.steps) return []

    const steps = workflow.steps.map((step, index) => ({
      batchId,
      stepIndex: index,
      stepName: step.name,
      stepType: step.type || 'active',
      activities: step.activities || [],
      conditions: step.conditions || [],
      parameters: step.params || {},
      workflowNotes: step.notes,
      location: step.location,
      repeatCount: step.repeat || 1,
      requiredEquipment: step.equipment || [],
      plannedDurationMinutes: this.parseStepDuration(
        step.timeout || step.duration || '30min'
      ),
      status: 'pending',
      progress: 0,
    }))

    return await ProductionStep.bulkCreate(steps as any)
  }

  /**
   * Parse step duration string to minutes
   */
  private parseStepDuration(duration: string): number {
    const timeValue = parseInt(duration.replace(/[^0-9]/g, '')) || 30
    const timeUnit = duration.replace(/[0-9]/g, '').trim().toLowerCase()

    if (timeUnit.startsWith('h')) return timeValue * 60
    return timeValue // Assume minutes
  }

  /**
   * Validate resource availability for batch
   */
  private async validateResourceAvailability(batch: ProductionBatch): Promise<void> {
    // Check staff availability
    if (batch.assignedStaffIds && batch.assignedStaffIds.length > 0) {
      // In a real implementation, check staff schedules
      logger.info(`Validating staff availability for batch ${batch.id}`)
    }

    // Check equipment availability
    if (batch.requiredEquipment && batch.requiredEquipment.length > 0) {
      // In a real implementation, check equipment schedules
      logger.info(`Validating equipment availability for batch ${batch.id}`)
    }
  }

  /**
   * Progress workflow to next step
   */
  private async progressWorkflow(
    batchId: number,
    nextStepIndex: number
  ): Promise<void> {
    const nextStep = await ProductionStep.findOne({
      where: { batchId, stepIndex: nextStepIndex },
    })

    if (nextStep && nextStep.status === 'pending') {
      await nextStep.update({
        status: 'ready',
        plannedStartTime: new Date(),
      })

      // Update batch current step
      await ProductionBatch.update(
        { currentStepIndex: nextStepIndex },
        { where: { id: batchId } }
      )
    }
  }

  /**
   * Check if batch is completed and update status
   */
  private async checkBatchCompletion(batch: ProductionBatch): Promise<void> {
    const steps = await ProductionStep.findAll({
      where: { batchId: batch.id },
    })

    const completedSteps = steps.filter((step) => step.status === 'completed')
    const failedSteps = steps.filter((step) => step.status === 'failed')

    if (failedSteps.length > 0) {
      await batch.update({
        status: 'failed',
        actualEndTime: new Date(),
      })

      await notificationHelper.sendNotification({
        title: 'Produktion fehlgeschlagen',
        message: `${batch.name} konnte nicht abgeschlossen werden`,
        type: 'error',
        category: 'production',
        priority: 'high',
        templateKey: 'production.batch_failed',
        templateVars: {
          batchName: batch.name,
          failedSteps: failedSteps.length,
        },
      })
    } else if (completedSteps.length === steps.length) {
      await batch.update({
        status: 'completed',
        actualEndTime: new Date(),
        actualQuantity: batch.plannedQuantity,
      })

      await notificationHelper.sendNotification({
        title: 'Produktion abgeschlossen',
        message: `${batch.name} wurde erfolgreich abgeschlossen`,
        type: 'success',
        category: 'production',
        priority: 'low',
        templateKey: 'production.complete',
        templateVars: {
          batchName: batch.name,
          quantity: batch.actualQuantity || batch.plannedQuantity,
          unit: batch.unit,
          duration: batch.actualDurationMinutes || 0,
        },
      })
    }
  }

  /**
   * Calculate workday duration in minutes
   */
  private calculateWorkdayMinutes(startTime: string, endTime: string): number {
    const start = new Date(`1970-01-01T${startTime}`)
    const end = new Date(`1970-01-01T${endTime}`)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  /**
   * Calculate schedule metrics
   */
  private async calculateScheduleMetrics(schedule: ProductionSchedule): Promise<{
    efficiency: number
    utilization: number
    completionRate: number
  }> {
    // Implementation would calculate efficiency, completion rates, etc.
    return {
      efficiency: schedule.efficiencyScore || 0,
      utilization: schedule.capacityUtilization || 0,
      completionRate: schedule.completionPercentage || 0,
    }
  }
}

export default new ProductionService()