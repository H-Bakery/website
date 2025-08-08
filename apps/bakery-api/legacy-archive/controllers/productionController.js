const {
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  User,
  Product,
} = require('../models')
const workflowParser = require('../utils/workflowParser')
const logger = require('../utils/logger')
const { Op } = require('sequelize')
const notificationHelper = require('../utils/notificationHelper')
const socketService = require('../services/socketService')

/**
 * Production Planning Controller
 * Handles all production scheduling, batch management, and workflow execution
 */

// ============================================================================
// PRODUCTION SCHEDULES
// ============================================================================

/**
 * Get production schedules
 * @route GET /api/production/schedules
 */
exports.getSchedules = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      type = 'daily',
      limit = 50,
      offset = 0,
    } = req.query

    const whereClause = {}

    // Date range filter
    if (startDate && endDate) {
      whereClause.scheduleDate = {
        [Op.between]: [startDate, endDate],
      }
    } else if (startDate) {
      whereClause.scheduleDate = {
        [Op.gte]: startDate,
      }
    } else if (endDate) {
      whereClause.scheduleDate = {
        [Op.lte]: endDate,
      }
    }

    // Status filter
    if (status && status !== 'all') {
      whereClause.status = status
    }

    // Type filter
    if (type && type !== 'all') {
      whereClause.scheduleType = type
    }

    const schedules = await ProductionSchedule.findAndCountAll({
      where: whereClause,
      include: [
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
      ],
      order: [['scheduleDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    })

    res.json({
      success: true,
      data: {
        schedules: schedules.rows,
        total: schedules.count,
        hasMore: parseInt(offset) + schedules.rows.length < schedules.count,
      },
    })
  } catch (error) {
    logger.error('Error fetching production schedules:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production schedules',
    })
  }
}

/**
 * Create new production schedule
 * @route POST /api/production/schedules
 */
exports.createSchedule = async (req, res) => {
  try {
    const {
      scheduleDate,
      scheduleType = 'daily',
      workdayStartTime = '06:00:00',
      workdayEndTime = '18:00:00',
      availableStaffIds = [],
      staffShifts = {},
      availableEquipment = [],
      dailyTargets = {},
      planningNotes,
      specialRequests = [],
      environmentalConditions = {},
    } = req.body

    // Validate required fields
    if (!scheduleDate) {
      return res.status(400).json({
        success: false,
        error: 'Schedule date is required',
      })
    }

    // Check if schedule already exists for this date
    const existingSchedule = await ProductionSchedule.findOne({
      where: { scheduleDate },
    })

    if (existingSchedule) {
      return res.status(409).json({
        success: false,
        error: 'Production schedule already exists for this date',
      })
    }

    // Calculate total staff hours
    const totalStaffHours = Object.values(staffShifts).reduce(
      (total, shift) => {
        if (shift.start && shift.end) {
          const start = new Date(`1970-01-01T${shift.start}`)
          const end = new Date(`1970-01-01T${shift.end}`)
          const hours = (end - start) / (1000 * 60 * 60)
          return total + Math.max(hours, 0)
        }
        return total
      },
      0
    )

    const schedule = await ProductionSchedule.create({
      scheduleDate,
      scheduleType,
      workdayStartTime,
      workdayEndTime,
      availableStaffIds,
      staffShifts,
      totalStaffHours,
      availableEquipment,
      dailyTargets,
      planningNotes,
      specialRequests,
      environmentalConditions,
      createdBy: req.user?.id,
      status: 'draft',
    })

    // Send notification
    await notificationHelper.sendNotification({
      userId: req.user?.id,
      title: 'Neuer Produktionsplan erstellt',
      message: `Produktionsplan für ${scheduleDate} wurde erstellt`,
      type: 'info',
      category: 'production',
      priority: 'low',
      templateKey: 'production.schedule_created',
      templateVars: {
        date: scheduleDate,
        type: scheduleType,
      },
    })

    res.status(201).json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    logger.error('Error creating production schedule:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create production schedule',
    })
  }
}

/**
 * Update production schedule
 * @route PUT /api/production/schedules/:id
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const schedule = await ProductionSchedule.findByPk(id)
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Production schedule not found',
      })
    }

    // Recalculate staff hours if staffShifts changed
    if (updateData.staffShifts) {
      updateData.totalStaffHours = Object.values(updateData.staffShifts).reduce(
        (total, shift) => {
          if (shift.start && shift.end) {
            const start = new Date(`1970-01-01T${shift.start}`)
            const end = new Date(`1970-01-01T${shift.end}`)
            const hours = (end - start) / (1000 * 60 * 60)
            return total + Math.max(hours, 0)
          }
          return total
        },
        0
      )
    }

    await schedule.update(updateData)

    // Emit WebSocket event for schedule update
    socketService.emitScheduleUpdate(schedule.scheduleDate, {
      scheduleId: schedule.id,
      updates: updateData,
      updatedBy: req.user?.id,
    })

    res.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    logger.error('Error updating production schedule:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update production schedule',
    })
  }
}

// ============================================================================
// PRODUCTION BATCHES
// ============================================================================

/**
 * Get production batches
 * @route GET /api/production/batches
 */
exports.getBatches = async (req, res) => {
  try {
    const {
      scheduleDate,
      status,
      workflowId,
      priority,
      assignedStaff,
      limit = 50,
      offset = 0,
    } = req.query

    const whereClause = {}

    // Date range filter (planned start time within the day)
    if (scheduleDate) {
      const startOfDay = new Date(`${scheduleDate}T00:00:00.000Z`)
      const endOfDay = new Date(`${scheduleDate}T23:59:59.999Z`)

      whereClause.plannedStartTime = {
        [Op.between]: [startOfDay, endOfDay],
      }
    }

    // Status filter
    if (status && status !== 'all') {
      if (Array.isArray(status)) {
        whereClause.status = { [Op.in]: status }
      } else if (status.includes(',')) {
        whereClause.status = { [Op.in]: status.split(',') }
      } else {
        whereClause.status = status
      }
    }

    // Workflow filter
    if (workflowId && workflowId !== 'all') {
      whereClause.workflowId = workflowId
    }

    // Priority filter
    if (priority && priority !== 'all') {
      whereClause.priority = priority
    }

    // Staff filter (JSON search)
    if (assignedStaff) {
      // This is SQLite compatible JSON search
      whereClause[Op.and] = [
        {
          assignedStaffIds: {
            [Op.like]: `%${assignedStaff}%`,
          },
        },
      ]
    }

    const batches = await ProductionBatch.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'category', 'price'],
        },
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'username'],
        },
        {
          model: ProductionStep,
          required: false,
          where: { status: ['in_progress', 'waiting', 'failed'] },
          limit: 1,
        },
      ],
      order: [['plannedStartTime', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    })

    res.json({
      success: true,
      data: {
        batches: batches.rows,
        total: batches.count,
        hasMore: parseInt(offset) + batches.rows.length < batches.count,
      },
    })
  } catch (error) {
    logger.error('Error fetching production batches:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production batches',
    })
  }
}

/**
 * Create new production batch
 * @route POST /api/production/batches
 */
exports.createBatch = async (req, res) => {
  try {
    const {
      name,
      workflowId,
      productId,
      plannedStartTime,
      plannedQuantity = 1,
      unit = 'pieces',
      priority = 'medium',
      assignedStaffIds = [],
      requiredEquipment = [],
      notes,
    } = req.body

    // Validate required fields
    if (!name || !workflowId || !plannedStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Name, workflow ID, and planned start time are required',
      })
    }

    // Validate workflow exists
    const workflow = await workflowParser.getWorkflowById(workflowId)
    if (!workflow) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow ID',
      })
    }

    // Calculate estimated end time based on workflow
    const totalDurationMinutes = workflow.steps.reduce((total, step) => {
      if (step.timeout) {
        const timeValue = parseInt(step.timeout.replace(/[^0-9]/g, ''))
        const timeUnit = step.timeout.replace(/[0-9]/g, '').trim()

        let minutes = timeValue
        if (timeUnit.startsWith('h')) minutes *= 60

        return total + minutes
      }
      if (step.duration) {
        const timeValue = parseInt(step.duration.replace(/[^0-9]/g, ''))
        const timeUnit = step.duration.replace(/[0-9]/g, '').trim()

        let minutes = timeValue
        if (timeUnit.startsWith('h')) minutes *= 60

        return total + minutes
      }
      return total + 30 // Default 30 minutes per step
    }, 0)

    const plannedEndTime = new Date(
      new Date(plannedStartTime).getTime() + totalDurationMinutes * 60 * 1000
    )

    const batch = await ProductionBatch.create({
      name,
      workflowId,
      productId,
      plannedStartTime,
      plannedEndTime,
      plannedQuantity,
      unit,
      priority,
      assignedStaffIds,
      requiredEquipment,
      notes,
      createdBy: req.user?.id,
      status: 'planned',
    })

    // Create production steps from workflow
    const steps = workflow.steps.map((step, index) => ({
      batchId: batch.id,
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
      plannedDurationMinutes: (() => {
        if (step.timeout) {
          const timeValue = parseInt(step.timeout.replace(/[^0-9]/g, ''))
          const timeUnit = step.timeout.replace(/[0-9]/g, '').trim()
          return timeUnit.startsWith('h') ? timeValue * 60 : timeValue
        }
        if (step.duration) {
          const timeValue = parseInt(step.duration.replace(/[^0-9]/g, ''))
          const timeUnit = step.duration.replace(/[0-9]/g, '').trim()
          return timeUnit.startsWith('h') ? timeValue * 60 : timeValue
        }
        return 30
      })(),
    }))

    await ProductionStep.bulkCreate(steps)

    // Send notification
    await notificationHelper.sendNotification({
      userId: req.user?.id,
      title: 'Neuer Produktionsauftrag',
      message: `${name} wurde für ${new Date(plannedStartTime).toLocaleString(
        'de-DE'
      )} geplant`,
      type: 'info',
      category: 'production',
      priority: 'low',
      templateKey: 'production.batch_created',
      templateVars: {
        batchName: name,
        startTime: plannedStartTime,
        quantity: plannedQuantity,
        unit: unit,
      },
    })

    // Emit WebSocket event for new batch
    const scheduleDate = new Date(plannedStartTime).toISOString().split('T')[0]
    socketService.emitScheduleUpdate(scheduleDate, {
      type: 'batch_created',
      batch: batch.toJSON(),
    })

    res.status(201).json({
      success: true,
      data: batch,
    })
  } catch (error) {
    logger.error('Error creating production batch:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create production batch',
    })
  }
}

/**
 * Start production batch
 * @route POST /api/production/batches/:id/start
 */
exports.startBatch = async (req, res) => {
  try {
    const { id } = req.params

    const batch = await ProductionBatch.findByPk(id, {
      include: [{ model: ProductionStep }],
    })

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found',
      })
    }

    if (batch.status !== 'planned' && batch.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: 'Batch cannot be started in current status',
      })
    }

    const now = new Date()

    // Update batch status
    await batch.update({
      status: 'in_progress',
      actualStartTime: now,
      updatedBy: req.user?.id,
    })

    // Start first step
    const firstStep = batch.ProductionSteps[0]
    if (firstStep) {
      await firstStep.update({
        status: 'ready',
        actualStartTime: now,
      })
    }

    // Send notification
    await notificationHelper.sendNotification({
      userId: req.user?.id,
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

    // Emit WebSocket events
    socketService.emitBatchUpdate(batch.id, {
      status: 'in_progress',
      actualStartTime: now,
    })

    // Emit to production status room
    socketService.emitProductionStatus({
      type: 'batch_started',
      batchId: batch.id,
      batchName: batch.name,
      timestamp: now,
    })

    res.json({
      success: true,
      data: batch,
    })
  } catch (error) {
    logger.error('Error starting production batch:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start production batch',
    })
  }
}

/**
 * Pause production batch
 * @route POST /api/production/batches/:id/pause
 */
exports.pauseBatch = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const batch = await ProductionBatch.findByPk(id)

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found',
      })
    }

    if (batch.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Batch is not in progress',
      })
    }

    await batch.update({
      status: 'waiting',
      pausedAt: new Date(),
      pauseReason: reason || 'Manual pause',
      updatedBy: req.user?.id,
    })

    // Emit WebSocket events
    socketService.emitBatchUpdate(batch.id, {
      status: 'waiting',
      pausedAt: new Date(),
      pauseReason: reason || 'Manual pause',
    })

    socketService.emitProductionStatus({
      type: 'batch_paused',
      batchId: batch.id,
      batchName: batch.name,
      reason: reason || 'Manual pause',
    })

    res.json({
      success: true,
      data: batch,
    })
  } catch (error) {
    logger.error('Error pausing production batch:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to pause production batch',
    })
  }
}

/**
 * Resume production batch
 * @route POST /api/production/batches/:id/resume
 */
exports.resumeBatch = async (req, res) => {
  try {
    const { id } = req.params

    const batch = await ProductionBatch.findByPk(id)

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found',
      })
    }

    if (batch.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        error: 'Batch is not paused',
      })
    }

    await batch.update({
      status: 'in_progress',
      resumedAt: new Date(),
      updatedBy: req.user?.id,
    })

    // Emit WebSocket events
    socketService.emitBatchUpdate(batch.id, {
      status: 'in_progress',
      resumedAt: new Date(),
    })

    socketService.emitProductionStatus({
      type: 'batch_resumed',
      batchId: batch.id,
      batchName: batch.name,
    })

    res.json({
      success: true,
      data: batch,
    })
  } catch (error) {
    logger.error('Error resuming production batch:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to resume production batch',
    })
  }
}

/**
 * Delete production batch
 * @route DELETE /api/production/batches/:id
 */
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params

    const batch = await ProductionBatch.findByPk(id)

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found',
      })
    }

    if (batch.status === 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete batch that is in progress',
      })
    }

    // Delete associated steps first
    await ProductionStep.destroy({
      where: { batchId: id },
    })

    await batch.destroy()

    // Emit WebSocket event
    const scheduleDate = new Date(batch.plannedStartTime)
      .toISOString()
      .split('T')[0]
    socketService.emitScheduleUpdate(scheduleDate, {
      type: 'batch_deleted',
      batchId: id,
    })

    res.json({
      success: true,
      message: 'Production batch deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting production batch:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete production batch',
    })
  }
}

// ============================================================================
// PRODUCTION STEPS
// ============================================================================

/**
 * Get production steps for a batch
 * @route GET /api/production/batches/:batchId/steps
 */
exports.getBatchSteps = async (req, res) => {
  try {
    const { batchId } = req.params

    const steps = await ProductionStep.findAll({
      where: { batchId },
      include: [
        {
          model: User,
          as: 'Completer',
          attributes: ['id', 'username'],
        },
      ],
      order: [['stepIndex', 'ASC']],
    })

    res.json({
      success: true,
      data: steps,
    })
  } catch (error) {
    logger.error('Error fetching production steps:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production steps',
    })
  }
}

/**
 * Update production step
 * @route PUT /api/production/steps/:id
 */
exports.updateStep = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const step = await ProductionStep.findByPk(id, {
      include: [{ model: ProductionBatch }],
    })

    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Production step not found',
      })
    }

    // Handle status changes
    if (updateData.status && updateData.status !== step.status) {
      const now = new Date()

      switch (updateData.status) {
        case 'in_progress':
          updateData.actualStartTime = now
          break
        case 'completed':
          updateData.actualEndTime = now
          updateData.completedBy = req.user?.id
          updateData.progress = 100
          break
        case 'failed':
          updateData.actualEndTime = now
          updateData.hasIssues = true
          break
      }
    }

    await step.update(updateData)

    // Emit WebSocket event for step update
    socketService.emitStepUpdate(step.batchId, step.id, {
      ...updateData,
      stepName: step.stepName,
      stepIndex: step.stepIndex,
    })

    // Check if batch should be updated
    if (updateData.status === 'completed') {
      await this.checkBatchCompletion(step.ProductionBatch)
    }

    res.json({
      success: true,
      data: step,
    })
  } catch (error) {
    logger.error('Error updating production step:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update production step',
    })
  }
}

/**
 * Complete production step
 * @route POST /api/production/steps/:id/complete
 */
exports.completeStep = async (req, res) => {
  try {
    const { id } = req.params
    const { qualityResults, actualParameters, notes } = req.body

    const step = await ProductionStep.findByPk(id, {
      include: [{ model: ProductionBatch }],
    })

    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Production step not found',
      })
    }

    if (step.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Step is not in progress',
      })
    }

    const now = new Date()

    await step.update({
      status: 'completed',
      actualEndTime: now,
      completedBy: req.user?.id,
      progress: 100,
      qualityResults: qualityResults || step.qualityResults,
      actualParameters: actualParameters || step.actualParameters,
      notes: notes || step.notes,
    })

    // Start next step if available
    const nextStep = await ProductionStep.findOne({
      where: {
        batchId: step.batchId,
        stepIndex: step.stepIndex + 1,
      },
    })

    if (nextStep && nextStep.status === 'pending') {
      await nextStep.update({
        status: 'ready',
        plannedStartTime: now,
      })
    }

    // Emit WebSocket events
    socketService.emitStepUpdate(step.batchId, step.id, {
      status: 'completed',
      progress: 100,
      completedBy: req.user?.id,
      actualEndTime: now,
    })

    if (qualityResults) {
      socketService.emitQualityCheck(step.batchId, step.id, qualityResults)
    }

    // Check batch completion
    await this.checkBatchCompletion(step.ProductionBatch)

    res.json({
      success: true,
      data: step,
    })
  } catch (error) {
    logger.error('Error completing production step:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to complete production step',
    })
  }
}

/**
 * Update production step progress
 * @route POST /api/production/steps/:id/progress
 */
exports.updateStepProgress = async (req, res) => {
  try {
    const { id } = req.params
    const { progressData } = req.body

    const step = await ProductionStep.findByPk(id)

    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Production step not found',
      })
    }

    await step.update({
      ...progressData,
      updatedAt: new Date(),
    })

    // Emit WebSocket event
    socketService.emitStepUpdate(step.batchId, step.id, {
      ...progressData,
      stepName: step.stepName,
      stepIndex: step.stepIndex,
    })

    res.json({
      success: true,
      data: step,
    })
  } catch (error) {
    logger.error('Error updating step progress:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update step progress',
    })
  }
}

/**
 * Perform quality check on production step
 * @route POST /api/production/steps/:id/quality-check
 */
exports.performQualityCheck = async (req, res) => {
  try {
    const { id } = req.params
    const { qualityData } = req.body

    const step = await ProductionStep.findByPk(id)

    if (!step) {
      return res.status(404).json({
        success: false,
        error: 'Production step not found',
      })
    }

    const overallPassed = qualityData.checks.every((check) => check.passed)

    await step.update({
      qualityCheckCompleted: true,
      qualityResults: qualityData,
      qualityCheckTime: new Date(),
      qualityCheckedBy: req.user?.id,
      hasIssues: !overallPassed,
    })

    // Emit WebSocket event
    socketService.emitQualityCheck(step.batchId, step.id, {
      ...qualityData,
      overallPassed,
      checkedBy: req.user?.id,
      timestamp: new Date(),
    })

    res.json({
      success: true,
      data: step,
    })
  } catch (error) {
    logger.error('Error performing quality check:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to perform quality check',
    })
  }
}

/**
 * Report issue for production batch
 * @route POST /api/production/batches/:id/issues
 */
exports.reportIssue = async (req, res) => {
  try {
    const { id } = req.params
    const { issueData } = req.body

    const batch = await ProductionBatch.findByPk(id)

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found',
      })
    }

    // Add issue to batch
    const currentIssues = batch.issues || []
    const newIssue = {
      ...issueData,
      id: Date.now(),
      reportedBy: req.user?.id,
      reportedAt: new Date(),
      resolved: false,
    }

    await batch.update({
      issues: [...currentIssues, newIssue],
      hasIssues: true,
    })

    // Update step if specified
    if (issueData.stepId) {
      const step = await ProductionStep.findByPk(issueData.stepId)
      if (step) {
        await step.update({
          hasIssues: true,
        })
      }
    }

    // Emit WebSocket event
    socketService.emitIssueReported(batch.id, newIssue)

    // Send notification for critical issues
    if (issueData.severity === 'critical' || issueData.severity === 'high') {
      await notificationHelper.sendNotification({
        title: 'Kritisches Produktionsproblem',
        message: `${issueData.description} bei ${batch.name}`,
        type: 'error',
        category: 'production',
        priority: 'urgent',
        templateKey: 'production.issue_reported',
        templateVars: {
          batchName: batch.name,
          issueType: issueData.type,
          severity: issueData.severity,
          description: issueData.description,
        },
      })
    }

    res.json({
      success: true,
      data: newIssue,
    })
  } catch (error) {
    logger.error('Error reporting issue:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to report issue',
    })
  }
}

/**
 * Get production status
 * @route GET /api/production/status
 */
exports.getProductionStatus = async (req, res) => {
  try {
    const { date, includeCompleted = false } = req.query

    const whereClause = {}

    // Date filter - default to today
    const targetDate = date || new Date().toISOString().split('T')[0]
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`)
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`)

    whereClause.plannedStartTime = {
      [Op.between]: [startOfDay, endOfDay],
    }

    // Status filter
    if (!includeCompleted) {
      whereClause.status = {
        [Op.notIn]: ['completed', 'cancelled'],
      }
    }

    // Get all batches for the day
    const batches = await ProductionBatch.findAll({
      where: whereClause,
      include: [
        {
          model: ProductionStep,
          required: false,
        },
      ],
      order: [['plannedStartTime', 'ASC']],
    })

    // Categorize batches
    const activeBatches = batches.filter((b) => b.status === 'in_progress')
    const pendingBatches = batches.filter(
      (b) => b.status === 'planned' || b.status === 'ready'
    )
    const waitingBatches = batches.filter((b) => b.status === 'waiting')
    const completedBatches = batches.filter((b) => b.status === 'completed')

    // Calculate overview stats
    const totalBatches = batches.length
    const totalQuantity = batches.reduce(
      (sum, b) => sum + (b.actualQuantity || b.plannedQuantity),
      0
    )

    // Calculate efficiency
    const completedOnTime = completedBatches.filter(
      (b) =>
        b.actualEndTime &&
        b.plannedEndTime &&
        new Date(b.actualEndTime) <= new Date(b.plannedEndTime)
    ).length

    const efficiency =
      completedBatches.length > 0
        ? (completedOnTime / completedBatches.length) * 100
        : 0

    // Get recent alerts/issues
    const alerts = []
    batches.forEach((batch) => {
      if (batch.issues && batch.issues.length > 0) {
        batch.issues.forEach((issue) => {
          if (!issue.resolved) {
            alerts.push({
              id: issue.id,
              type: issue.type,
              severity: issue.severity,
              message: issue.description,
              batchId: batch.id,
              batchName: batch.name,
              stepId: issue.stepId,
              stepName: issue.stepName,
              timestamp: issue.reportedAt,
            })
          }
        })
      }

      // Check for delays
      if (batch.isDelayed && batch.status === 'in_progress') {
        alerts.push({
          id: `delay-${batch.id}`,
          type: 'delay',
          severity: 'medium',
          message: `${batch.name} ist ${batch.delayMinutes} Minuten verspätet`,
          batchId: batch.id,
          batchName: batch.name,
          timestamp: new Date(),
        })
      }
    })

    // Sort alerts by severity and timestamp
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(b.timestamp) - new Date(a.timestamp)
    })

    // Create timeline events
    const timeline = []
    const now = new Date()
    const oneHourAgo = new Date(now - 60 * 60 * 1000)

    batches.forEach((batch) => {
      // Batch events
      if (
        batch.actualStartTime &&
        new Date(batch.actualStartTime) >= oneHourAgo
      ) {
        timeline.push({
          type: 'batch_started',
          batchId: batch.id,
          batchName: batch.name,
          timestamp: batch.actualStartTime,
        })
      }

      if (batch.actualEndTime && new Date(batch.actualEndTime) >= oneHourAgo) {
        timeline.push({
          type: 'batch_completed',
          batchId: batch.id,
          batchName: batch.name,
          timestamp: batch.actualEndTime,
        })
      }

      // Step events
      batch.ProductionSteps?.forEach((step) => {
        if (step.actualEndTime && new Date(step.actualEndTime) >= oneHourAgo) {
          timeline.push({
            type: 'step_completed',
            batchId: batch.id,
            batchName: batch.name,
            stepId: step.id,
            stepName: step.stepName,
            timestamp: step.actualEndTime,
          })
        }

        if (
          step.qualityCheckTime &&
          new Date(step.qualityCheckTime) >= oneHourAgo
        ) {
          timeline.push({
            type: 'quality_check',
            batchId: batch.id,
            batchName: batch.name,
            stepId: step.id,
            stepName: step.stepName,
            timestamp: step.qualityCheckTime,
          })
        }
      })

      // Issue events
      batch.issues?.forEach((issue) => {
        if (new Date(issue.reportedAt) >= oneHourAgo) {
          timeline.push({
            type: 'issue_reported',
            batchId: batch.id,
            batchName: batch.name,
            stepId: issue.stepId,
            stepName: issue.stepName,
            timestamp: issue.reportedAt,
          })
        }
      })
    })

    // Sort timeline by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const response = {
      overview: {
        date: targetDate,
        totalBatches,
        activeBatches: activeBatches.length,
        pendingBatches: pendingBatches.length,
        waitingBatches: waitingBatches.length,
        completedBatches: completedBatches.length,
        totalQuantity,
        efficiency,
      },
      activeBatches: activeBatches.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        progress: b.progress || 0,
        plannedStartTime: b.plannedStartTime,
        plannedEndTime: b.plannedEndTime,
        actualStartTime: b.actualStartTime,
        plannedQuantity: b.plannedQuantity,
        actualQuantity: b.actualQuantity,
        unit: b.unit,
        priority: b.priority,
        assignedStaffIds: b.assignedStaffIds,
        isDelayed: b.isDelayed,
        delayMinutes: b.delayMinutes,
        hasIssues: b.hasIssues,
      })),
      pendingBatches: pendingBatches.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        plannedStartTime: b.plannedStartTime,
        plannedEndTime: b.plannedEndTime,
        plannedQuantity: b.plannedQuantity,
        unit: b.unit,
        priority: b.priority,
        assignedStaffIds: b.assignedStaffIds,
      })),
      waitingBatches: waitingBatches.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        plannedStartTime: b.plannedStartTime,
        plannedEndTime: b.plannedEndTime,
        plannedQuantity: b.plannedQuantity,
        unit: b.unit,
        priority: b.priority,
        assignedStaffIds: b.assignedStaffIds,
        pausedAt: b.pausedAt,
        pauseReason: b.pauseReason,
      })),
      alerts: alerts.slice(0, 20), // Limit to 20 most recent/severe
      timeline: timeline.slice(0, 50), // Limit to 50 most recent events
      lastUpdated: new Date(),
    }

    res.json({
      success: true,
      data: response,
    })
  } catch (error) {
    logger.error('Error fetching production status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production status',
    })
  }
}

// ============================================================================
// PRODUCTION ANALYTICS
// ============================================================================

/**
 * Get production analytics
 * @route GET /api/production/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get batch statistics
    const batchStats = await ProductionBatch.findAll({
      where: {
        plannedStartTime: {
          [Op.between]: [start, end],
        },
      },
      attributes: [
        'status',
        'priority',
        'workflowId',
        [
          ProductionBatch.sequelize.fn(
            'COUNT',
            ProductionBatch.sequelize.col('id')
          ),
          'count',
        ],
        [
          ProductionBatch.sequelize.fn(
            'AVG',
            ProductionBatch.sequelize.literal(
              'CASE WHEN actualEndTime IS NOT NULL AND actualStartTime IS NOT NULL ' +
                'THEN (julianday(actualEndTime) - julianday(actualStartTime)) * 24 * 60 ' +
                'ELSE NULL END'
            )
          ),
          'avgDurationMinutes',
        ],
      ],
      group: ['status', 'priority', 'workflowId'],
      raw: true,
    })

    // Get efficiency metrics
    const efficiencyData = await ProductionBatch.findAll({
      where: {
        plannedStartTime: {
          [Op.between]: [start, end],
        },
        status: 'completed',
      },
      attributes: [
        [
          ProductionBatch.sequelize.fn(
            'DATE',
            ProductionBatch.sequelize.col('plannedStartTime')
          ),
          'date',
        ],
        [
          ProductionBatch.sequelize.fn(
            'COUNT',
            ProductionBatch.sequelize.col('id')
          ),
          'completedBatches',
        ],
        [
          ProductionBatch.sequelize.fn(
            'SUM',
            ProductionBatch.sequelize.col('actualQuantity')
          ),
          'totalProduced',
        ],
        [
          ProductionBatch.sequelize.fn(
            'AVG',
            ProductionBatch.sequelize.literal(
              'CASE WHEN actualEndTime > plannedEndTime THEN 1 ELSE 0 END'
            )
          ),
          'delayRate',
        ],
      ],
      group: [
        ProductionBatch.sequelize.fn(
          'DATE',
          ProductionBatch.sequelize.col('plannedStartTime')
        ),
      ],
      order: [
        [
          ProductionBatch.sequelize.fn(
            'DATE',
            ProductionBatch.sequelize.col('plannedStartTime')
          ),
          'ASC',
        ],
      ],
      raw: true,
    })

    res.json({
      success: true,
      data: {
        batchStats,
        efficiencyData,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    })
  } catch (error) {
    logger.error('Error fetching production analytics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production analytics',
    })
  }
}

// ============================================================================
// HELPER METHODS
// ============================================================================

/**
 * Check if batch is completed and update status
 */
exports.checkBatchCompletion = async (batch) => {
  try {
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

      // Emit WebSocket event
      socketService.emitBatchUpdate(batch.id, {
        status: 'failed',
        actualEndTime: new Date(),
      })

      socketService.emitProductionStatus({
        type: 'batch_failed',
        batchId: batch.id,
        batchName: batch.name,
        failedSteps: failedSteps.length,
      })

      // Send failure notification
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
      const endTime = new Date()
      await batch.update({
        status: 'completed',
        actualEndTime: endTime,
        actualQuantity: batch.plannedQuantity, // Can be overridden
      })

      // Emit WebSocket event
      socketService.emitBatchUpdate(batch.id, {
        status: 'completed',
        actualEndTime: endTime,
        actualQuantity: batch.actualQuantity || batch.plannedQuantity,
      })

      socketService.emitProductionStatus({
        type: 'batch_completed',
        batchId: batch.id,
        batchName: batch.name,
        quantity: batch.actualQuantity || batch.plannedQuantity,
        unit: batch.unit,
      })

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
          unit: batch.unit,
          duration: batch.actualDurationMinutes || 0,
        },
      })
    }
  } catch (error) {
    logger.error('Error checking batch completion:', error)
  }
}
