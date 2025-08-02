const { ProductionBatch, ProductionStep, User, Product } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const notificationHelper = require('../utils/notificationHelper');
const socketService = require('./socketService');

/**
 * Production Execution Service
 * Real-time production monitoring, workflow execution, and issue management
 */
class ProductionExecutionService {

  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  /**
   * Get real-time production status
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Current production status
   */
  async getProductionStatus(filters = {}) {
    try {
      const { date, includeCompleted = false } = filters;

      // Build query conditions
      const whereClause = {};
      if (date) {
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);
        whereClause.plannedStartTime = {
          [Op.between]: [startOfDay, endOfDay]
        };
      }

      if (!includeCompleted) {
        whereClause.status = {
          [Op.in]: ['planned', 'ready', 'in_progress', 'waiting']
        };
      }

      // Get active batches with steps
      const batches = await ProductionBatch.findAll({
        where: whereClause,
        include: [
          {
            model: ProductionStep,
            required: false
          },
          {
            model: Product,
            attributes: ['id', 'name', 'category']
          },
          {
            model: User,
            as: 'Creator',
            attributes: ['id', 'username']
          }
        ],
        order: [['plannedStartTime', 'ASC'], [ProductionStep, 'stepIndex', 'ASC']]
      });

      // Calculate real-time metrics
      const status = {
        overview: await this.calculateProductionOverview(batches),
        activeBatches: await this.enrichBatchData(batches.filter(b => b.status === 'in_progress')),
        pendingBatches: await this.enrichBatchData(batches.filter(b => ['planned', 'ready'].includes(b.status))),
        waitingBatches: await this.enrichBatchData(batches.filter(b => b.status === 'waiting')),
        alerts: await this.getProductionAlerts(batches),
        timeline: await this.generateProductionTimeline(batches),
        lastUpdated: new Date()
      };

      if (includeCompleted) {
        status.completedBatches = await this.enrichBatchData(
          batches.filter(b => ['completed', 'failed', 'cancelled'].includes(b.status))
        );
      }

      return status;
    } catch (error) {
      logger.error('Error getting production status:', error);
      throw error;
    }
  }

  /**
   * Start real-time monitoring for a production batch
   * @param {number} batchId - Batch ID to monitor
   * @param {number} userId - User starting monitoring
   * @returns {Promise<Object>} Monitoring session
   */
  async startBatchMonitoring(batchId, userId) {
    try {
      logger.info(`Starting batch monitoring: ${batchId}`, { userId });

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep }]
      });

      if (!batch) {
        throw new Error('Production batch not found');
      }

      // Create monitoring session
      const monitoringSession = {
        batchId,
        userId,
        startTime: new Date(),
        status: 'active',
        metrics: await this.initializeBatchMetrics(batch)
      };

      // Start real-time updates
      this.initializeRealTimeUpdates(batchId);

      // Send initial status via WebSocket
      socketService.emitToUser(userId, 'batch_monitoring_started', {
        batchId,
        batch: await this.enrichSingleBatch(batch),
        session: monitoringSession
      });

      logger.info(`Batch monitoring started successfully: ${batchId}`);
      return monitoringSession;
    } catch (error) {
      logger.error(`Error starting batch monitoring ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Update step progress in real-time
   * @param {number} stepId - Step ID
   * @param {Object} progressData - Progress update
   * @param {number} userId - User making update
   * @returns {Promise<Object>} Updated step
   */
  async updateStepProgress(stepId, progressData, userId) {
    try {
      logger.info(`Updating step progress: ${stepId}`, { progress: progressData.progress, userId });

      const step = await ProductionStep.findByPk(stepId, {
        include: [{ model: ProductionBatch }]
      });

      if (!step) {
        throw new Error('Production step not found');
      }

      // Validate progress data
      this.validateProgressUpdate(step, progressData);

      // Update step
      const updateData = {
        ...progressData,
        updatedAt: new Date()
      };

      // Handle status changes
      if (progressData.status && progressData.status !== step.status) {
        updateData.statusChangeTime = new Date();
        
        if (progressData.status === 'in_progress' && step.status !== 'in_progress') {
          updateData.actualStartTime = new Date();
        }
      }

      await step.update(updateData);

      // Update batch progress
      await this.updateBatchProgress(step.batchId);

      // Send real-time update
      const enrichedStep = await this.enrichStepData(step);
      socketService.emitToRoom(`batch_${step.batchId}`, 'step_progress_updated', {
        stepId,
        step: enrichedStep,
        updatedBy: userId,
        timestamp: new Date()
      });

      // Check for automatic notifications
      await this.checkStepNotifications(step, progressData, userId);

      logger.info(`Step progress updated successfully: ${stepId}`);
      return enrichedStep;
    } catch (error) {
      logger.error(`Error updating step progress ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Handle production issues and exceptions
   * @param {number} batchId - Batch ID
   * @param {Object} issueData - Issue information
   * @param {number} userId - User reporting issue
   * @returns {Promise<Object>} Issue handling result
   */
  async reportProductionIssue(batchId, issueData, userId) {
    try {
      logger.info(`Reporting production issue for batch: ${batchId}`, { 
        type: issueData.type, 
        severity: issueData.severity,
        userId 
      });

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep }]
      });

      if (!batch) {
        throw new Error('Production batch not found');
      }

      // Create issue record
      const issue = {
        id: `issue_${Date.now()}`,
        batchId,
        stepId: issueData.stepId,
        type: issueData.type,
        severity: issueData.severity || 'medium',
        description: issueData.description,
        reportedBy: userId,
        reportedAt: new Date(),
        status: 'open',
        impact: issueData.impact || 'unknown'
      };

      // Add issue to batch metadata
      const currentIssues = batch.metadata?.issues || [];
      currentIssues.push(issue);
      await batch.update({
        metadata: { ...batch.metadata, issues: currentIssues }
      });

      // Handle issue based on severity
      const handling = await this.handleIssueBasedOnSeverity(issue, batch);

      // Send notifications
      await this.sendIssueNotifications(issue, batch, userId);

      // Real-time update
      socketService.emitToRoom(`batch_${batchId}`, 'production_issue_reported', {
        issue,
        handling,
        batch: await this.enrichSingleBatch(batch),
        timestamp: new Date()
      });

      logger.info(`Production issue reported successfully: ${issue.id}`);
      return { issue, handling };
    } catch (error) {
      logger.error(`Error reporting production issue for batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Execute quality control check
   * @param {number} stepId - Step ID
   * @param {Object} qualityData - Quality check data
   * @param {number} userId - User performing check
   * @returns {Promise<Object>} Quality check result
   */
  async performQualityCheck(stepId, qualityData, userId) {
    try {
      logger.info(`Performing quality check for step: ${stepId}`, { userId });

      const step = await ProductionStep.findByPk(stepId, {
        include: [{ model: ProductionBatch }]
      });

      if (!step) {
        throw new Error('Production step not found');
      }

      // Execute quality checks
      const qualityResult = {
        checkId: `qc_${Date.now()}`,
        stepId,
        performedBy: userId,
        performedAt: new Date(),
        checks: qualityData.checks || [],
        overallScore: this.calculateQualityScore(qualityData.checks || []),
        notes: qualityData.notes,
        status: 'completed'
      };

      // Determine if quality check passed
      const passed = qualityResult.overallScore >= (qualityData.passingScore || 70);
      qualityResult.passed = passed;

      // Update step with quality results
      const currentQuality = step.qualityResults || {};
      currentQuality[qualityResult.checkId] = qualityResult;

      await step.update({
        qualityResults: currentQuality,
        qualityCheckCompleted: true,
        hasIssues: step.hasIssues || !passed
      });

      // Handle quality failure
      if (!passed) {
        await this.handleQualityFailure(step, qualityResult, userId);
      }

      // Real-time update
      socketService.emitToRoom(`batch_${step.batchId}`, 'quality_check_completed', {
        stepId,
        qualityResult,
        step: await this.enrichStepData(step),
        timestamp: new Date()
      });

      logger.info(`Quality check completed for step: ${stepId}`, { 
        passed, 
        score: qualityResult.overallScore 
      });
      return qualityResult;
    } catch (error) {
      logger.error(`Error performing quality check for step ${stepId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================

  /**
   * Advance workflow to next step
   * @param {number} batchId - Batch ID
   * @param {number} currentStepIndex - Current step index
   * @returns {Promise<Object>} Next step or completion status
   */
  async advanceWorkflow(batchId, currentStepIndex) {
    try {
      logger.info(`Advancing workflow for batch: ${batchId}`, { currentStep: currentStepIndex });

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep }]
      });

      if (!batch) {
        throw new Error('Production batch not found');
      }

      const nextStepIndex = currentStepIndex + 1;
      const nextStep = batch.ProductionSteps.find(step => step.stepIndex === nextStepIndex);

      if (!nextStep) {
        // Workflow completed
        return await this.completeWorkflow(batch);
      }

      // Check if next step can be started
      const canStart = await this.validateStepPreconditions(nextStep, batch);
      if (!canStart.valid) {
        return {
          status: 'waiting',
          reason: canStart.reason,
          nextStep: await this.enrichStepData(nextStep)
        };
      }

      // Start next step
      await nextStep.update({
        status: 'ready',
        plannedStartTime: new Date()
      });

      // Update batch current step
      await batch.update({
        currentStepIndex: nextStepIndex
      });

      // Real-time update
      socketService.emitToRoom(`batch_${batchId}`, 'workflow_advanced', {
        batchId,
        previousStep: currentStepIndex,
        currentStep: nextStepIndex,
        nextStep: await this.enrichStepData(nextStep),
        timestamp: new Date()
      });

      logger.info(`Workflow advanced successfully for batch: ${batchId}`, { newStep: nextStepIndex });
      return {
        status: 'advanced',
        nextStep: await this.enrichStepData(nextStep)
      };
    } catch (error) {
      logger.error(`Error advancing workflow for batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Pause production batch
   * @param {number} batchId - Batch ID
   * @param {string} reason - Pause reason
   * @param {number} userId - User pausing batch
   * @returns {Promise<Object>} Pause result
   */
  async pauseBatch(batchId, reason, userId) {
    try {
      logger.info(`Pausing batch: ${batchId}`, { reason, userId });

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep }]
      });

      if (!batch) {
        throw new Error('Production batch not found');
      }

      if (!['in_progress'].includes(batch.status)) {
        throw new Error('Batch cannot be paused in current status');
      }

      // Pause batch
      await batch.update({
        status: 'waiting',
        metadata: {
          ...batch.metadata,
          pausedAt: new Date(),
          pausedBy: userId,
          pauseReason: reason,
          previousStatus: 'in_progress'
        }
      });

      // Pause active steps
      const activeStep = batch.ProductionSteps.find(step => step.status === 'in_progress');
      if (activeStep) {
        await activeStep.update({
          status: 'waiting',
          metadata: {
            ...activeStep.metadata,
            pausedAt: new Date(),
            pausedBy: userId
          }
        });
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
          reason
        }
      });

      // Real-time update
      socketService.emitToRoom(`batch_${batchId}`, 'batch_paused', {
        batchId,
        reason,
        pausedBy: userId,
        batch: await this.enrichSingleBatch(batch),
        timestamp: new Date()
      });

      logger.info(`Batch paused successfully: ${batchId}`);
      return { status: 'paused', reason };
    } catch (error) {
      logger.error(`Error pausing batch ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Resume paused production batch
   * @param {number} batchId - Batch ID
   * @param {number} userId - User resuming batch
   * @returns {Promise<Object>} Resume result
   */
  async resumeBatch(batchId, userId) {
    try {
      logger.info(`Resuming batch: ${batchId}`, { userId });

      const batch = await ProductionBatch.findByPk(batchId, {
        include: [{ model: ProductionStep }]
      });

      if (!batch) {
        throw new Error('Production batch not found');
      }

      if (batch.status !== 'waiting') {
        throw new Error('Batch is not paused');
      }

      const previousStatus = batch.metadata?.previousStatus || 'in_progress';

      // Resume batch
      await batch.update({
        status: previousStatus,
        metadata: {
          ...batch.metadata,
          resumedAt: new Date(),
          resumedBy: userId,
          previousStatus: null
        }
      });

      // Resume active step
      const waitingStep = batch.ProductionSteps.find(step => step.status === 'waiting');
      if (waitingStep) {
        await waitingStep.update({
          status: 'in_progress',
          metadata: {
            ...waitingStep.metadata,
            resumedAt: new Date(),
            resumedBy: userId
          }
        });
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
          batchName: batch.name
        }
      });

      // Real-time update
      socketService.emitToRoom(`batch_${batchId}`, 'batch_resumed', {
        batchId,
        resumedBy: userId,
        batch: await this.enrichSingleBatch(batch),
        timestamp: new Date()
      });

      logger.info(`Batch resumed successfully: ${batchId}`);
      return { status: 'resumed' };
    } catch (error) {
      logger.error(`Error resuming batch ${batchId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate production overview metrics
   * @param {Array} batches - Production batches
   * @returns {Promise<Object>} Overview metrics
   */
  async calculateProductionOverview(batches) {
    const overview = {
      totalBatches: batches.length,
      activeBatches: batches.filter(b => b.status === 'in_progress').length,
      pendingBatches: batches.filter(b => ['planned', 'ready'].includes(b.status)).length,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      delayedBatches: 0,
      totalItems: 0,
      completedItems: 0,
      efficiency: 0,
      alerts: []
    };

    const now = new Date();

    for (const batch of batches) {
      overview.totalItems += batch.plannedQuantity;
      
      if (batch.status === 'completed') {
        overview.completedItems += batch.actualQuantity || batch.plannedQuantity;
      }

      // Check for delays
      if (batch.plannedEndTime && now > new Date(batch.plannedEndTime) && 
          !['completed', 'cancelled'].includes(batch.status)) {
        overview.delayedBatches++;
      }
    }

    // Calculate efficiency
    if (overview.totalItems > 0) {
      overview.efficiency = Math.round((overview.completedItems / overview.totalItems) * 100);
    }

    return overview;
  }

  /**
   * Enrich batch data with calculated fields
   * @param {Array} batches - Raw batch data
   * @returns {Promise<Array>} Enriched batch data
   */
  async enrichBatchData(batches) {
    const enriched = [];

    for (const batch of batches) {
      enriched.push(await this.enrichSingleBatch(batch));
    }

    return enriched;
  }

  /**
   * Enrich single batch with calculated fields
   * @param {Object} batch - Raw batch data
   * @returns {Promise<Object>} Enriched batch data
   */
  async enrichSingleBatch(batch) {
    const now = new Date();
    const enriched = batch.toJSON();

    // Calculate progress
    if (batch.ProductionSteps) {
      const totalSteps = batch.ProductionSteps.length;
      const completedSteps = batch.ProductionSteps.filter(s => s.status === 'completed').length;
      enriched.progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      // Current step info
      const currentStep = batch.ProductionSteps.find(s => s.stepIndex === batch.currentStepIndex);
      if (currentStep) {
        enriched.currentStep = await this.enrichStepData(currentStep);
      }
    }

    // Calculate timing
    if (batch.plannedEndTime) {
      const plannedEnd = new Date(batch.plannedEndTime);
      enriched.isDelayed = now > plannedEnd && !['completed', 'cancelled'].includes(batch.status);
      enriched.delayMinutes = enriched.isDelayed ? Math.round((now - plannedEnd) / (1000 * 60)) : 0;
    }

    // Calculate duration
    if (batch.actualStartTime) {
      const actualEnd = batch.actualEndTime || now;
      enriched.actualDurationMinutes = Math.round((new Date(actualEnd) - new Date(batch.actualStartTime)) / (1000 * 60));
    }

    return enriched;
  }

  /**
   * Enrich step data with calculated fields
   * @param {Object} step - Raw step data
   * @returns {Promise<Object>} Enriched step data
   */
  async enrichStepData(step) {
    const enriched = step.toJSON();
    const now = new Date();

    // Calculate timing
    if (step.actualStartTime) {
      const actualEnd = step.actualEndTime || now;
      enriched.actualDurationMinutes = Math.round((new Date(actualEnd) - new Date(step.actualStartTime)) / (1000 * 60));
    }

    // Check if overdue
    if (step.plannedEndTime) {
      const plannedEnd = new Date(step.plannedEndTime);
      enriched.isOverdue = now > plannedEnd && !['completed', 'skipped'].includes(step.status);
      enriched.delayMinutes = enriched.isOverdue ? Math.round((now - plannedEnd) / (1000 * 60)) : 0;
    }

    // Activity progress
    if (step.activities && step.activities.length > 0) {
      const completedActivities = step.completedActivities || [];
      enriched.activityProgress = Math.round((completedActivities.length / step.activities.length) * 100);
    }

    return enriched;
  }

  /**
   * Get production alerts
   * @param {Array} batches - Production batches
   * @returns {Promise<Array>} Production alerts
   */
  async getProductionAlerts(batches) {
    const alerts = [];
    const now = new Date();

    for (const batch of batches) {
      // Delay alerts
      if (batch.plannedEndTime && now > new Date(batch.plannedEndTime) && 
          !['completed', 'cancelled'].includes(batch.status)) {
        const delayMinutes = Math.round((now - new Date(batch.plannedEndTime)) / (1000 * 60));
        alerts.push({
          type: 'delay',
          severity: delayMinutes > 60 ? 'high' : 'medium',
          batchId: batch.id,
          batchName: batch.name,
          message: `Batch is ${delayMinutes} minutes overdue`,
          timestamp: new Date()
        });
      }

      // Quality issues
      if (batch.ProductionSteps) {
        for (const step of batch.ProductionSteps) {
          if (step.hasIssues) {
            alerts.push({
              type: 'quality',
              severity: 'high',
              batchId: batch.id,
              stepId: step.id,
              batchName: batch.name,
              stepName: step.stepName,
              message: `Quality issues detected in ${step.stepName}`,
              timestamp: new Date()
            });
          }
        }
      }

      // Metadata issues
      if (batch.metadata?.issues) {
        batch.metadata.issues.forEach(issue => {
          if (issue.status === 'open') {
            alerts.push({
              type: 'issue',
              severity: issue.severity,
              batchId: batch.id,
              batchName: batch.name,
              message: issue.description,
              timestamp: new Date(issue.reportedAt)
            });
          }
        });
      }
    }

    return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Generate production timeline
   * @param {Array} batches - Production batches
   * @returns {Promise<Array>} Timeline events
   */
  async generateProductionTimeline(batches) {
    const timeline = [];

    for (const batch of batches) {
      if (batch.actualStartTime) {
        timeline.push({
          type: 'batch_started',
          batchId: batch.id,
          batchName: batch.name,
          timestamp: new Date(batch.actualStartTime)
        });
      }

      if (batch.actualEndTime) {
        timeline.push({
          type: 'batch_completed',
          batchId: batch.id,
          batchName: batch.name,
          timestamp: new Date(batch.actualEndTime)
        });
      }

      // Add step completions
      if (batch.ProductionSteps) {
        batch.ProductionSteps.forEach(step => {
          if (step.actualEndTime) {
            timeline.push({
              type: 'step_completed',
              batchId: batch.id,
              stepId: step.id,
              batchName: batch.name,
              stepName: step.stepName,
              timestamp: new Date(step.actualEndTime)
            });
          }
        });
      }
    }

    return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
  }

  /**
   * Initialize real-time updates for a batch
   * @param {number} batchId - Batch ID
   */
  initializeRealTimeUpdates(batchId) {
    // Create WebSocket room for batch
    socketService.createRoom(`batch_${batchId}`);
    
    // Set up periodic status updates (every 30 seconds)
    const updateInterval = setInterval(async () => {
      try {
        const batch = await ProductionBatch.findByPk(batchId, {
          include: [{ model: ProductionStep }]
        });

        if (!batch || ['completed', 'failed', 'cancelled'].includes(batch.status)) {
          clearInterval(updateInterval);
          return;
        }

        const enrichedBatch = await this.enrichSingleBatch(batch);
        socketService.emitToRoom(`batch_${batchId}`, 'batch_status_update', {
          batchId,
          batch: enrichedBatch,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error in real-time update for batch ${batchId}:`, error);
      }
    }, 30000);

    // Store interval reference for cleanup
    this.activeMonitoring = this.activeMonitoring || new Map();
    this.activeMonitoring.set(batchId, updateInterval);
  }

  /**
   * Initialize batch metrics
   * @param {Object} batch - Production batch
   * @returns {Promise<Object>} Initial metrics
   */
  async initializeBatchMetrics(batch) {
    return {
      startTime: new Date(),
      initialProgress: batch.progress || 0,
      initialStepIndex: batch.currentStepIndex || 0,
      plannedDuration: batch.estimatedDurationMinutes || 0,
      alerts: [],
      qualityChecks: 0
    };
  }

  /**
   * Validate progress update
   * @param {Object} step - Production step
   * @param {Object} progressData - Progress data
   */
  validateProgressUpdate(step, progressData) {
    if (progressData.progress !== undefined) {
      if (progressData.progress < 0 || progressData.progress > 100) {
        throw new Error('Progress must be between 0 and 100');
      }
    }

    if (progressData.status) {
      const validStatuses = ['pending', 'ready', 'in_progress', 'waiting', 'completed', 'skipped', 'failed'];
      if (!validStatuses.includes(progressData.status)) {
        throw new Error(`Invalid status: ${progressData.status}`);
      }
    }
  }

  /**
   * Update batch progress based on step completion
   * @param {number} batchId - Batch ID
   */
  async updateBatchProgress(batchId) {
    const batch = await ProductionBatch.findByPk(batchId, {
      include: [{ model: ProductionStep }]
    });

    if (!batch) return;

    const totalSteps = batch.ProductionSteps.length;
    const completedSteps = batch.ProductionSteps.filter(s => s.status === 'completed').length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Update batch metadata with progress
    await batch.update({
      metadata: {
        ...batch.metadata,
        progress,
        lastProgressUpdate: new Date()
      }
    });
  }

  /**
   * Check for step-related notifications
   * @param {Object} step - Production step
   * @param {Object} progressData - Progress data
   * @param {number} userId - User ID
   */
  async checkStepNotifications(step, progressData, userId) {
    // Notify on step completion
    if (progressData.status === 'completed') {
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktionsschritt abgeschlossen',
        message: `${step.stepName} wurde abgeschlossen`,
        type: 'success',
        category: 'production',
        priority: 'low',
        templateKey: 'production.step_completed',
        templateVars: {
          stepName: step.stepName,
          batchId: step.batchId
        }
      });
    }

    // Notify on issues
    if (progressData.hasIssues && !step.hasIssues) {
      await notificationHelper.sendNotification({
        userId,
        title: 'Produktionsproblem gemeldet',
        message: `Problem in ${step.stepName} gemeldet`,
        type: 'warning',
        category: 'production',
        priority: 'high',
        templateKey: 'production.step_issue',
        templateVars: {
          stepName: step.stepName,
          batchId: step.batchId
        }
      });
    }
  }

  /**
   * Handle issue based on severity
   * @param {Object} issue - Issue data
   * @param {Object} batch - Production batch
   * @returns {Promise<Object>} Handling result
   */
  async handleIssueBasedOnSeverity(issue, batch) {
    const handling = {
      actions: [],
      escalated: false,
      paused: false
    };

    switch (issue.severity) {
      case 'critical':
        // Auto-pause batch
        handling.paused = true;
        handling.actions.push('batch_paused');
        handling.escalated = true;
        break;

      case 'high':
        // Escalate to supervisor
        handling.escalated = true;
        handling.actions.push('escalated_to_supervisor');
        break;

      case 'medium':
        // Log and continue
        handling.actions.push('logged_for_review');
        break;

      case 'low':
        // Just log
        handling.actions.push('logged');
        break;
    }

    return handling;
  }

  /**
   * Send issue notifications
   * @param {Object} issue - Issue data
   * @param {Object} batch - Production batch
   * @param {number} userId - User ID
   */
  async sendIssueNotifications(issue, batch, userId) {
    await notificationHelper.sendNotification({
      userId,
      title: 'Produktionsproblem gemeldet',
      message: `${issue.type} Problem in ${batch.name}: ${issue.description}`,
      type: 'error',
      category: 'production',
      priority: issue.severity === 'critical' ? 'high' : 'medium',
      templateKey: 'production.issue_reported',
      templateVars: {
        batchName: batch.name,
        issueType: issue.type,
        severity: issue.severity,
        description: issue.description
      }
    });
  }

  /**
   * Calculate quality score from checks
   * @param {Array} checks - Quality checks
   * @returns {number} Overall quality score
   */
  calculateQualityScore(checks) {
    if (checks.length === 0) return 100;

    const totalScore = checks.reduce((sum, check) => sum + (check.score || 0), 0);
    return Math.round(totalScore / checks.length);
  }

  /**
   * Handle quality failure
   * @param {Object} step - Production step
   * @param {Object} qualityResult - Quality result
   * @param {number} userId - User ID
   */
  async handleQualityFailure(step, qualityResult, userId) {
    // Add to issues
    await step.update({
      hasIssues: true,
      issues: [
        ...(step.issues || []),
        {
          type: 'quality_failure',
          severity: 'high',
          description: `Quality check failed with score ${qualityResult.overallScore}`,
          reportedAt: new Date(),
          reportedBy: userId
        }
      ]
    });

    // Send notification
    await notificationHelper.sendNotification({
      userId,
      title: 'Qualitätskontrolle fehlgeschlagen',
      message: `${step.stepName} hat die Qualitätskontrolle nicht bestanden`,
      type: 'error',
      category: 'production',
      priority: 'high',
      templateKey: 'production.quality_failed',
      templateVars: {
        stepName: step.stepName,
        score: qualityResult.overallScore,
        batchId: step.batchId
      }
    });
  }

  /**
   * Complete workflow
   * @param {Object} batch - Production batch
   * @returns {Promise<Object>} Completion result
   */
  async completeWorkflow(batch) {
    await batch.update({
      status: 'completed',
      actualEndTime: new Date(),
      actualQuantity: batch.plannedQuantity
    });

    // Send completion notification
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
        unit: batch.unit
      }
    });

    // Real-time update
    socketService.emitToRoom(`batch_${batch.id}`, 'workflow_completed', {
      batchId: batch.id,
      batch: await this.enrichSingleBatch(batch),
      timestamp: new Date()
    });

    return {
      status: 'completed',
      batch: await this.enrichSingleBatch(batch)
    };
  }

  /**
   * Validate step preconditions
   * @param {Object} step - Production step
   * @param {Object} batch - Production batch
   * @returns {Promise<Object>} Validation result
   */
  async validateStepPreconditions(step, batch) {
    // Check if previous steps are completed
    const previousSteps = batch.ProductionSteps.filter(s => s.stepIndex < step.stepIndex);
    const incompletePrevious = previousSteps.filter(s => s.status !== 'completed');

    if (incompletePrevious.length > 0) {
      return {
        valid: false,
        reason: `Previous steps must be completed: ${incompletePrevious.map(s => s.stepName).join(', ')}`
      };
    }

    // Check conditions if specified
    if (step.conditions && step.conditions.length > 0) {
      // Implement condition checking logic here
      // For now, assume all conditions are met
    }

    return { valid: true };
  }
}

module.exports = new ProductionExecutionService();