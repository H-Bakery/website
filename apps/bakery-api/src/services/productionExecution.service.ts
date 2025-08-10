import { Op } from 'sequelize'
import {
  ProductionBatch,
  ProductionStep,
  User,
  Product
} from '../models'
import notificationHelper from '../utils/notificationHelper'
import { logger } from '../utils/logger'
import { socketService } from './socket.service'

export interface ProductionStatusFilters {
  date?: string
  includeCompleted?: boolean
}

export interface ProgressData {
  progress?: number
  status?: string
  notes?: string
  actualParameters?: any
}

export interface IssueData {
  stepId?: number
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact?: string
}

export interface QualityCheckData {
  checks: Array<{
    name: string
    value: any
    passed: boolean
    notes?: string
  }>
  notes?: string
  passingScore?: number
}

export interface ProductionOverview {
  totalBatches: number
  activeBatches: number
  pendingBatches: number
  completedBatches: number
  delayedBatches: number
  totalItems: number
  completedItems: number
  efficiency: number
  alerts: any[]
}

export interface MonitoringSession {
  batchId: number
  userId: number
  startTime: Date
  status: string
  metrics: any
}

export interface ProductionIssue {
  id: string
  batchId: number
  stepId?: number
  type: string
  severity: string
  description: string
  reportedBy: number
  reportedAt: Date
  status: string
  impact: string
}

export interface QualityResult {
  checkId: string
  stepId: number
  performedBy: number
  performedAt: Date
  checks: any[]
  overallScore: number
  notes?: string
  status: string
  passed: boolean
}

class ProductionExecutionService {
  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  /**
   * Get real-time production status
   */
  async getProductionStatus(filters: ProductionStatusFilters = {}) {
    try {
      const { date, includeCompleted = false } = filters

      // Build query conditions
      const whereClause: any = {}
      if (date) {
        const startOfDay = new Date(`${date}T00:00:00.000Z`)
        const endOfDay = new Date(`${date}T23:59:59.999Z`)
        whereClause.plannedStartTime = {
          [Op.between]: [startOfDay, endOfDay],
        }
      }

      if (!includeCompleted) {
        whereClause.status = {
          [Op.in]: ['planned', 'ready', 'in_progress', 'waiting'],
        }
      }

      // Get active batches with steps
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: [
          {
            model: ProductionStep,
            as: 'steps',
            required: false,
          },
          {
            model: Product,
            attributes: ['id', 'name', 'category'],
          },
          {
            model: User,
            as: 'Creator',
            attributes: ['id', 'username'],
          },
        ],
        order: [
          ['plannedStartTime', 'ASC'],
          [{ model: ProductionStep, as: 'steps' }, 'stepIndex', 'ASC'],
        ],
      })

      // Calculate real-time metrics
      const status = {
        overview: await this.calculateProductionOverview(batches),
        activeBatches: await this.enrichBatchData(
          batches.filter((b) => b.status === 'in_progress')
        ),
        pendingBatches: await this.enrichBatchData(
          batches.filter((b) => ['planned', 'ready'].includes(b.status))
        ),
        waitingBatches: await this.enrichBatchData(
          batches.filter((b) => b.status === 'waiting')
        ),
        alerts: await this.getProductionAlerts(batches),
        timeline: await this.generateProductionTimeline(batches),
        lastUpdated: new Date(),
      }

      if (includeCompleted) {
        status.completedBatches = await this.enrichBatchData(
          batches.filter((b) =>
            ['completed', 'failed', 'cancelled'].includes(b.status)
          )
        )
      }

      return status
    } catch (error) {
      logger.error('Error getting production status:', error)
      throw error
    }
  }

  /**
   * Start real-time monitoring for a production batch
   */
  async startBatchMonitoring(batchId: number, userId: number): Promise<MonitoringSession> {
    try {
      logger.info(`Starting batch monitoring: ${batchId}`, { userId })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      // Create monitoring session
      const monitoringSession: MonitoringSession = {
        batchId,
        userId,
        startTime: new Date(),
        status: 'active',
        metrics: await this.initializeBatchMetrics(batch),
      }

      // Start real-time updates
      this.initializeRealTimeUpdates(batchId)

      // Send initial status via WebSocket
      socketService.sendToUser(userId.toString(), 'batch_monitoring_started', {
        batchId,
        batch: await this.enrichSingleBatch(batch),
        session: monitoringSession,
      })

      logger.info(`Batch monitoring started successfully: ${batchId}`)
      return monitoringSession
    } catch (error) {
      logger.error(`Error starting batch monitoring ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Update step progress in real-time
   */
  async updateStepProgress(
    stepId: number,
    progressData: ProgressData,
    userId: number
  ): Promise<any> {
    try {
      logger.info(`Updating step progress: ${stepId}`, {
        progress: progressData.progress,
        userId,
      })

      const step = await ProductionStep.findByPk(stepId, {
        include: [{ model: ProductionBatch, as: 'batch' }],
      })

      if (!step) {
        throw new Error('Production step not found')
      }

      // Validate progress data
      this.validateProgressUpdate(step, progressData)

      // Update step
      const updateData: any = {
        ...progressData,
        updatedAt: new Date(),
      }

      // Handle status changes
      if (progressData.status && progressData.status !== step.status) {
        updateData.statusChangeTime = new Date()

        if (
          progressData.status === 'in_progress' &&
          step.status !== 'in_progress'
        ) {
          updateData.actualStartTime = new Date()
        }
      }

      await step.update(updateData)

      // Update batch progress
      await this.updateBatchProgress(step.batchId)

      // Send real-time update
      const enrichedStep = await this.enrichStepData(step)
      socketService.sendToRoom(
        `batch_${step.batchId}`,
        'step_progress_updated',
        {
          stepId,
          step: enrichedStep,
          updatedBy: userId,
          timestamp: new Date(),
        }
      )

      // Check for automatic notifications
      await this.checkStepNotifications(step, progressData, userId)

      logger.info(`Step progress updated successfully: ${stepId}`)
      return enrichedStep
    } catch (error) {
      logger.error(`Error updating step progress ${stepId}:`, error)
      throw error
    }
  }

  /**
   * Handle production issues and exceptions
   */
  async reportProductionIssue(
    batchId: number,
    issueData: IssueData,
    userId: number
  ): Promise<{ issue: ProductionIssue; handling: any }> {
    try {
      logger.info(`Reporting production issue for batch: ${batchId}`, {
        type: issueData.type,
        severity: issueData.severity,
        userId,
      })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      // Create issue record
      const issue: ProductionIssue = {
        id: `issue_${Date.now()}`,
        batchId,
        stepId: issueData.stepId,
        type: issueData.type,
        severity: issueData.severity,
        description: issueData.description,
        reportedBy: userId,
        reportedAt: new Date(),
        status: 'open',
        impact: issueData.impact || 'unknown',
      }

      // Add issue to batch metadata
      const currentIssues = batch.metadata?.issues || []
      currentIssues.push(issue)
      await batch.update({
        metadata: { ...batch.metadata, issues: currentIssues },
      })

      // Handle issue based on severity
      const handling = await this.handleIssueBasedOnSeverity(issue, batch)

      // Send notifications
      await this.sendIssueNotifications(issue, batch, userId)

      // Real-time update
      socketService.sendToRoom(
        `batch_${batchId}`,
        'production_issue_reported',
        {
          issue,
          handling,
          batch: await this.enrichSingleBatch(batch),
          timestamp: new Date(),
        }
      )

      logger.info(`Production issue reported successfully: ${issue.id}`)
      return { issue, handling }
    } catch (error) {
      logger.error(
        `Error reporting production issue for batch ${batchId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Execute quality control check
   */
  async performQualityCheck(
    stepId: number,
    qualityData: QualityCheckData,
    userId: number
  ): Promise<QualityResult> {
    try {
      logger.info(`Performing quality check for step: ${stepId}`, { userId })

      const step = await ProductionStep.findByPk(stepId, {
        include: [{ model: ProductionBatch, as: 'batch' }],
      })

      if (!step) {
        throw new Error('Production step not found')
      }

      // Execute quality checks
      const qualityResult: QualityResult = {
        checkId: `qc_${Date.now()}`,
        stepId,
        performedBy: userId,
        performedAt: new Date(),
        checks: qualityData.checks || [],
        overallScore: this.calculateQualityScore(qualityData.checks || []),
        notes: qualityData.notes,
        status: 'completed',
        passed: false,
      }

      // Determine if quality check passed
      const passed =
        qualityResult.overallScore >= (qualityData.passingScore || 70)
      qualityResult.passed = passed

      // Update step with quality results
      const currentQuality = step.qualityResults || {}
      currentQuality[qualityResult.checkId] = qualityResult

      await step.update({
        qualityResults: currentQuality,
        qualityCheckCompleted: true,
        hasIssues: step.hasIssues || !passed,
      })

      // Handle quality failure
      if (!passed) {
        await this.handleQualityFailure(step, qualityResult, userId)
      }

      // Real-time update
      socketService.sendToRoom(
        `batch_${step.batchId}`,
        'quality_check_completed',
        {
          stepId,
          qualityResult,
          step: await this.enrichStepData(step),
          timestamp: new Date(),
        }
      )

      logger.info(`Quality check completed for step: ${stepId}`, {
        passed,
        score: qualityResult.overallScore,
      })
      return qualityResult
    } catch (error) {
      logger.error(`Error performing quality check for step ${stepId}:`, error)
      throw error
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================

  /**
   * Advance workflow to next step
   */
  async advanceWorkflow(batchId: number, currentStepIndex: number): Promise<any> {
    try {
      logger.info(`Advancing workflow for batch: ${batchId}`, {
        currentStep: currentStepIndex,
      })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      const nextStepIndex = currentStepIndex + 1
      const nextStep = batch.steps?.find(
        (step: any) => step.stepIndex === nextStepIndex
      )

      if (!nextStep) {
        // Workflow completed
        return await this.completeWorkflow(batch)
      }

      // Check if next step can be started
      const canStart = await this.validateStepPreconditions(nextStep, batch)
      if (!canStart.valid) {
        return {
          status: 'waiting',
          reason: canStart.reason,
          nextStep: await this.enrichStepData(nextStep),
        }
      }

      // Start next step
      await nextStep.update({
        status: 'ready',
        plannedStartTime: new Date(),
      })

      // Update batch current step
      await batch.update({
        currentStepIndex: nextStepIndex,
      })

      // Real-time update
      socketService.sendToRoom(`batch_${batchId}`, 'workflow_advanced', {
        batchId,
        previousStep: currentStepIndex,
        currentStep: nextStepIndex,
        nextStep: await this.enrichStepData(nextStep),
        timestamp: new Date(),
      })

      logger.info(`Workflow advanced successfully for batch: ${batchId}`, {
        newStep: nextStepIndex,
      })
      return {
        status: 'advanced',
        nextStep: await this.enrichStepData(nextStep),
      }
    } catch (error) {
      logger.error(`Error advancing workflow for batch ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Pause production batch
   */
  async pauseBatch(
    batchId: number,
    reason: string,
    userId: number
  ): Promise<{ status: string; reason: string }> {
    try {
      logger.info(`Pausing batch: ${batchId}`, { reason, userId })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      if (!['in_progress'].includes(batch.status)) {
        throw new Error('Batch cannot be paused in current status')
      }

      // Pause batch
      await batch.update({
        status: 'waiting',
        metadata: {
          ...batch.metadata,
          pausedAt: new Date(),
          pausedBy: userId,
          pauseReason: reason,
          previousStatus: 'in_progress',
        },
      })

      // Pause active steps
      const activeStep = batch.steps?.find(
        (step: any) => step.status === 'in_progress'
      )
      if (activeStep) {
        await activeStep.update({
          status: 'waiting',
          metadata: {
            ...activeStep.metadata,
            pausedAt: new Date(),
            pausedBy: userId,
          },
        })
      }

      // Send notifications
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktion pausiert',
        message: `${batch.name} wurde pausiert: ${reason}`,
        type: 'warning',
        category: 'production',
        priority: 'medium',
        templateKey: 'production.paused',
        templateVars: {
          batchName: batch.name,
          reason,
        },
      })

      // Real-time update
      socketService.sendToRoom(`batch_${batchId}`, 'batch_paused', {
        batchId,
        reason,
        pausedBy: userId,
        batch: await this.enrichSingleBatch(batch),
        timestamp: new Date(),
      })

      logger.info(`Batch paused successfully: ${batchId}`)
      return { status: 'paused', reason }
    } catch (error) {
      logger.error(`Error pausing batch ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Resume paused production batch
   */
  async resumeBatch(batchId: number, userId: number): Promise<{ status: string }> {
    try {
      logger.info(`Resuming batch: ${batchId}`, { userId })

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep, as: 'steps' }],
      })

      if (!batch) {
        throw new Error('Production batch not found')
      }

      if (batch.status !== 'waiting') {
        throw new Error('Batch is not paused')
      }

      const previousStatus = batch.metadata?.previousStatus || 'in_progress'

      // Resume batch
      await batch.update({
        status: previousStatus,
        metadata: {
          ...batch.metadata,
          resumedAt: new Date(),
          resumedBy: userId,
          previousStatus: null,
        },
      })

      // Resume active step
      const waitingStep = batch.steps?.find(
        (step: any) => step.status === 'waiting'
      )
      if (waitingStep) {
        await waitingStep.update({
          status: 'in_progress',
          metadata: {
            ...waitingStep.metadata,
            resumedAt: new Date(),
            resumedBy: userId,
          },
        })
      }

      // Send notifications
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktion fortgesetzt',
        message: `${batch.name} wurde fortgesetzt`,
        type: 'info',
        category: 'production',
        priority: 'low',
        templateKey: 'production.resumed',
        templateVars: {
          batchName: batch.name,
        },
      })

      // Real-time update
      socketService.sendToRoom(`batch_${batchId}`, 'batch_resumed', {
        batchId,
        resumedBy: userId,
        batch: await this.enrichSingleBatch(batch),
        timestamp: new Date(),
      })

      logger.info(`Batch resumed successfully: ${batchId}`)
      return { status: 'resumed' }
    } catch (error) {
      logger.error(`Error resuming batch ${batchId}:`, error)
      throw error
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate production overview metrics
   */
  private async calculateProductionOverview(batches: ProductionBatch[]): Promise<ProductionOverview> {
    const overview: ProductionOverview = {
      totalBatches: batches.length,
      activeBatches: batches.filter((b) => b.status === 'in_progress').length,
      pendingBatches: batches.filter((b) =>
        ['planned', 'ready'].includes(b.status)
      ).length,
      completedBatches: batches.filter((b) => b.status === 'completed').length,
      delayedBatches: 0,
      totalItems: 0,
      completedItems: 0,
      efficiency: 0,
      alerts: [],
    }

    const now = new Date()

    for (const batch of batches) {
      overview.totalItems += batch.plannedQuantity

      if (batch.status === 'completed') {
        overview.completedItems += batch.actualQuantity || batch.plannedQuantity
      }

      // Check for delays
      if (
        batch.plannedEndTime &&
        now > new Date(batch.plannedEndTime) &&
        !['completed', 'cancelled'].includes(batch.status)
      ) {
        overview.delayedBatches++
      }
    }

    // Calculate efficiency
    if (overview.totalItems > 0) {
      overview.efficiency = Math.round(
        (overview.completedItems / overview.totalItems) * 100
      )
    }

    return overview
  }

  /**
   * Enrich batch data with calculated fields
   */
  private async enrichBatchData(batches: ProductionBatch[]): Promise<any[]> {
    const enriched = []

    for (const batch of batches) {
      enriched.push(await this.enrichSingleBatch(batch))
    }

    return enriched
  }

  /**
   * Enrich single batch with calculated fields
   */
  private async enrichSingleBatch(batch: ProductionBatch): Promise<any> {
    const now = new Date()
    const enriched = batch.toJSON() as any

    // Calculate progress
    if (batch.steps) {
      const totalSteps = batch.steps.length
      const completedSteps = batch.steps.filter(
        (s: any) => s.status === 'completed'
      ).length
      enriched.progress =
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

      // Current step info
      const currentStep = batch.steps.find(
        (s: any) => s.stepIndex === batch.currentStepIndex
      )
      if (currentStep) {
        enriched.currentStep = await this.enrichStepData(currentStep)
      }
    }

    // Calculate timing
    if (batch.plannedEndTime) {
      const plannedEnd = new Date(batch.plannedEndTime)
      enriched.isDelayed =
        now > plannedEnd && !['completed', 'cancelled'].includes(batch.status)
      enriched.delayMinutes = enriched.isDelayed
        ? Math.round((now.getTime() - plannedEnd.getTime()) / (1000 * 60))
        : 0
    }

    // Calculate duration
    if (batch.actualStartTime) {
      const actualEnd = batch.actualEndTime || now
      enriched.actualDurationMinutes = Math.round(
        (new Date(actualEnd).getTime() - new Date(batch.actualStartTime).getTime()) / (1000 * 60)
      )
    }

    return enriched
  }

  /**
   * Enrich step data with calculated fields
   */
  private async enrichStepData(step: ProductionStep): Promise<any> {
    const enriched = step.toJSON() as any
    const now = new Date()

    // Calculate timing
    if (step.actualStartTime) {
      const actualEnd = step.actualEndTime || now
      enriched.actualDurationMinutes = Math.round(
        (new Date(actualEnd).getTime() - new Date(step.actualStartTime).getTime()) / (1000 * 60)
      )
    }

    // Check if overdue
    if (step.plannedEndTime) {
      const plannedEnd = new Date(step.plannedEndTime)
      enriched.isOverdue =
        now > plannedEnd && !['completed', 'skipped'].includes(step.status)
      enriched.delayMinutes = enriched.isOverdue
        ? Math.round((now.getTime() - plannedEnd.getTime()) / (1000 * 60))
        : 0
    }

    // Activity progress
    if (step.activities && step.activities.length > 0) {
      const completedActivities = step.completedActivities || []
      enriched.activityProgress = Math.round(
        (completedActivities.length / step.activities.length) * 100
      )
    }

    return enriched
  }

  /**
   * Get production alerts
   */
  private async getProductionAlerts(batches: ProductionBatch[]): Promise<any[]> {
    const alerts: any[] = []
    const now = new Date()

    for (const batch of batches) {
      // Delay alerts
      if (
        batch.plannedEndTime &&
        now > new Date(batch.plannedEndTime) &&
        !['completed', 'cancelled'].includes(batch.status)
      ) {
        const delayMinutes = Math.round(
          (now.getTime() - new Date(batch.plannedEndTime).getTime()) / (1000 * 60)
        )
        alerts.push({
          type: 'delay',
          severity: delayMinutes > 60 ? 'high' : 'medium',
          batchId: batch.id,
          batchName: batch.name,
          message: `Batch is ${delayMinutes} minutes overdue`,
          timestamp: new Date(),
        })
      }

      // Quality issues
      if (batch.steps) {
        for (const step of batch.steps) {
          if ((step as any).hasIssues) {
            alerts.push({
              type: 'quality',
              severity: 'high',
              batchId: batch.id,
              stepId: step.id,
              batchName: batch.name,
              stepName: step.stepName,
              message: `Quality issues detected in ${step.stepName}`,
              timestamp: new Date(),
            })
          }
        }
      }
    }

    return alerts
  }

  /**
   * Generate production timeline
   */
  private async generateProductionTimeline(batches: ProductionBatch[]): Promise<any[]> {
    // Simple timeline generation - can be expanded
    return batches.map(batch => ({
      batchId: batch.id,
      batchName: batch.name,
      startTime: batch.plannedStartTime,
      endTime: batch.plannedEndTime,
      status: batch.status,
      progress: 0, // Will be calculated
    }))
  }

  /**
   * Initialize batch metrics
   */
  private async initializeBatchMetrics(batch: ProductionBatch): Promise<any> {
    return {
      batchId: batch.id,
      startTime: new Date(),
      totalSteps: batch.steps?.length || 0,
      completedSteps: 0,
      qualityChecks: 0,
      issues: 0,
    }
  }

  /**
   * Initialize real-time updates for a batch
   */
  private initializeRealTimeUpdates(batchId: number): void {
    // Set up real-time monitoring
    logger.info(`Initializing real-time updates for batch ${batchId}`)
    // Implementation would set up WebSocket rooms, etc.
  }

  /**
   * Validate progress update
   */
  private validateProgressUpdate(step: ProductionStep, progressData: ProgressData): void {
    if (progressData.progress !== undefined) {
      if (progressData.progress < 0 || progressData.progress > 100) {
        throw new Error('Progress must be between 0 and 100')
      }
    }

    if (progressData.status) {
      const validStatuses = ['pending', 'ready', 'in_progress', 'completed', 'failed', 'skipped', 'waiting']
      if (!validStatuses.includes(progressData.status)) {
        throw new Error(`Invalid status: ${progressData.status}`)
      }
    }
  }

  /**
   * Update batch progress based on steps
   */
  private async updateBatchProgress(batchId: number): Promise<void> {
    const batch = await ProductionBatch.findByPk(batchId, {
      include: [{ model: ProductionStep, as: 'steps' }],
    })

    if (batch && batch.steps) {
      const totalSteps = batch.steps.length
      const completedSteps = batch.steps.filter(
        (s: any) => s.status === 'completed'
      ).length
      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

      await batch.update({ overallProgress: progress })
    }
  }

  /**
   * Check and send step notifications
   */
  private async checkStepNotifications(
    step: ProductionStep,
    progressData: ProgressData,
    userId: number
  ): Promise<void> {
    // Send notifications based on progress milestones
    if (progressData.progress === 100 || progressData.status === 'completed') {
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktionsschritt abgeschlossen',
        message: `${step.stepName} wurde abgeschlossen`,
        type: 'success',
        category: 'production',
        priority: 'low',
      })
    }
  }

  /**
   * Handle issue based on severity
   */
  private async handleIssueBasedOnSeverity(issue: ProductionIssue, batch: ProductionBatch): Promise<any> {
    const handling: any = {
      action: 'logged',
      escalated: false,
    }

    if (issue.severity === 'critical') {
      // Pause batch for critical issues
      await batch.update({ status: 'waiting' })
      handling.action = 'batch_paused'
      handling.escalated = true
    } else if (issue.severity === 'high') {
      // Alert supervisors
      handling.action = 'supervisor_alerted'
      handling.escalated = true
    }

    return handling
  }

  /**
   * Send issue notifications
   */
  private async sendIssueNotifications(
    issue: ProductionIssue,
    batch: ProductionBatch,
    userId: number
  ): Promise<void> {
    await notificationHelper.sendNotification({
      userId,
      title: 'Produktionsproblem gemeldet',
      message: `Problem in ${batch.name}: ${issue.description}`,
      type: 'error',
      category: 'production',
      priority: issue.severity as any,
      templateKey: 'production.issue',
      templateVars: {
        batchName: batch.name,
        issueType: issue.type,
        severity: issue.severity,
      },
    })
  }

  /**
   * Calculate quality score from checks
   */
  private calculateQualityScore(checks: any[]): number {
    if (checks.length === 0) return 0
    const passedChecks = checks.filter(c => c.passed).length
    return Math.round((passedChecks / checks.length) * 100)
  }

  /**
   * Handle quality check failure
   */
  private async handleQualityFailure(
    step: ProductionStep,
    qualityResult: QualityResult,
    userId: number
  ): Promise<void> {
    await notificationHelper.sendNotification({
      userId,
      title: 'Qualitätsprüfung fehlgeschlagen',
      message: `${step.stepName} hat die Qualitätsprüfung nicht bestanden`,
      type: 'error',
      category: 'production',
      priority: 'high',
      templateKey: 'production.quality_failed',
      templateVars: {
        stepName: step.stepName,
        score: qualityResult.overallScore,
      },
    })
  }

  /**
   * Complete workflow when all steps are done
   */
  private async completeWorkflow(batch: ProductionBatch): Promise<any> {
    await batch.update({
      status: 'completed',
      actualEndTime: new Date(),
    })

    await notificationHelper.sendNotification({
      title: 'Produktionsworkflow abgeschlossen',
      message: `${batch.name} wurde erfolgreich abgeschlossen`,
      type: 'success',
      category: 'production',
      priority: 'low',
    })

    return {
      status: 'completed',
      batch: await this.enrichSingleBatch(batch),
    }
  }

  /**
   * Validate step preconditions
   */
  private async validateStepPreconditions(
    step: ProductionStep,
    batch: ProductionBatch
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check if previous steps are completed
    if (step.stepIndex > 0) {
      const previousStep = batch.steps?.find(
        (s: any) => s.stepIndex === step.stepIndex - 1
      )
      if (previousStep && previousStep.status !== 'completed') {
        return {
          valid: false,
          reason: 'Previous step not completed',
        }
      }
    }

    // Additional validations can be added here
    return { valid: true }
  }
}

export default new ProductionExecutionService()