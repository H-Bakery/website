const express = require('express')
const router = express.Router()
const productionController = require('../controllers/productionController')
const { authenticate } = require('../middleware/authMiddleware')
const logger = require('../utils/logger')

/**
 * Production Planning Routes
 * All routes require authentication for proper user tracking
 */

// Apply authentication middleware to all production routes
router.use(authenticate)

// ============================================================================
// PRODUCTION SCHEDULES
// ============================================================================

/**
 * @swagger
 * /api/production/schedules:
 *   get:
 *     summary: Get production schedules
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter schedules from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter schedules until this date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, draft, planned, active, completed, cancelled]
 *         description: Filter by schedule status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, daily, weekly, special]
 *         description: Filter by schedule type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of schedules to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of schedules to skip
 *     responses:
 *       200:
 *         description: Production schedules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     schedules:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProductionSchedule'
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     hasMore:
 *                       type: boolean
 *                       example: false
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/schedules', productionController.getSchedules)

/**
 * @swagger
 * /api/production/schedules:
 *   post:
 *     summary: Create new production schedule
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduleDate
 *             properties:
 *               scheduleDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-15"
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly, special]
 *                 default: daily
 *               workdayStartTime:
 *                 type: string
 *                 format: time
 *                 default: "06:00:00"
 *               workdayEndTime:
 *                 type: string
 *                 format: time
 *                 default: "18:00:00"
 *               availableStaffIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *               staffShifts:
 *                 type: object
 *                 example: {"1": {"start": "06:00", "end": "14:00", "role": "baker"}}
 *               availableEquipment:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["oven_1", "mixer_large", "proofer_1"]
 *               dailyTargets:
 *                 type: object
 *                 example: {"bread": 50, "pastries": 30, "cakes": 10}
 *               planningNotes:
 *                 type: string
 *                 example: "Special order for wedding cake"
 *               specialRequests:
 *                 type: array
 *                 items:
 *                   type: object
 *                 example: [{"type": "custom_order", "details": "Gluten-free bread"}]
 *               environmentalConditions:
 *                 type: object
 *                 example: {"temperature": 22, "humidity": 65}
 *     responses:
 *       201:
 *         description: Production schedule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ProductionSchedule'
 *       400:
 *         description: Bad request - validation error
 *       409:
 *         description: Conflict - schedule already exists for this date
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/schedules', productionController.createSchedule)

/**
 * @swagger
 * /api/production/schedules/{id}:
 *   put:
 *     summary: Update production schedule
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly, special]
 *               workdayStartTime:
 *                 type: string
 *                 format: time
 *               workdayEndTime:
 *                 type: string
 *                 format: time
 *               availableStaffIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               staffShifts:
 *                 type: object
 *               availableEquipment:
 *                 type: array
 *                 items:
 *                   type: string
 *               dailyTargets:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [draft, planned, active, completed, cancelled]
 *               planningNotes:
 *                 type: string
 *               dailyNotes:
 *                 type: string
 *               specialRequests:
 *                 type: array
 *               environmentalConditions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Production schedule updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Schedule not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/schedules/:id', productionController.updateSchedule)

// ============================================================================
// PRODUCTION BATCHES
// ============================================================================

/**
 * @swagger
 * /api/production/batches:
 *   get:
 *     summary: Get production batches
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scheduleDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter batches by schedule date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (comma-separated for multiple)
 *       - in: query
 *         name: workflowId
 *         schema:
 *           type: string
 *         description: Filter by workflow ID
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: assignedStaff
 *         schema:
 *           type: string
 *         description: Filter by assigned staff member
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of batches to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of batches to skip
 *     responses:
 *       200:
 *         description: Production batches retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/batches', productionController.getBatches)

/**
 * @swagger
 * /api/production/batches:
 *   post:
 *     summary: Create new production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - workflowId
 *               - plannedStartTime
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Sourdough Batch #15"
 *               workflowId:
 *                 type: string
 *                 example: "sourdough_bread"
 *               productId:
 *                 type: integer
 *                 example: 5
 *               plannedStartTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-15T06:00:00.000Z"
 *               plannedQuantity:
 *                 type: integer
 *                 default: 1
 *                 example: 20
 *               unit:
 *                 type: string
 *                 default: "pieces"
 *                 example: "loaves"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               assignedStaffIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 3]
 *               requiredEquipment:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["oven_1", "mixer_large"]
 *               notes:
 *                 type: string
 *                 example: "Use starter from yesterday"
 *     responses:
 *       201:
 *         description: Production batch created successfully
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/batches', productionController.createBatch)

/**
 * @swagger
 * /api/production/batches/{id}/start:
 *   post:
 *     summary: Start production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     responses:
 *       200:
 *         description: Production batch started successfully
 *       400:
 *         description: Bad request - batch cannot be started
 *       404:
 *         description: Batch not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/batches/:id/start', productionController.startBatch)

/**
 * @swagger
 * /api/production/batches/{id}/pause:
 *   post:
 *     summary: Pause production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Equipment maintenance"
 *     responses:
 *       200:
 *         description: Production batch paused successfully
 *       400:
 *         description: Bad request - batch cannot be paused
 *       404:
 *         description: Batch not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/batches/:id/pause', productionController.pauseBatch)

/**
 * @swagger
 * /api/production/batches/{id}/resume:
 *   post:
 *     summary: Resume production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     responses:
 *       200:
 *         description: Production batch resumed successfully
 *       400:
 *         description: Bad request - batch cannot be resumed
 *       404:
 *         description: Batch not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/batches/:id/resume', productionController.resumeBatch)

/**
 * @swagger
 * /api/production/batches/{id}:
 *   delete:
 *     summary: Delete production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     responses:
 *       200:
 *         description: Production batch deleted successfully
 *       400:
 *         description: Bad request - batch cannot be deleted
 *       404:
 *         description: Batch not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/batches/:id', productionController.deleteBatch)

/**
 * @swagger
 * /api/production/batches/{id}/issues:
 *   post:
 *     summary: Report issue for production batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issueData
 *             properties:
 *               issueData:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [quality, equipment, timing, resource, other]
 *                     example: "quality"
 *                   severity:
 *                     type: string
 *                     enum: [low, medium, high, critical]
 *                     example: "high"
 *                   description:
 *                     type: string
 *                     example: "Dough did not rise properly"
 *                   impact:
 *                     type: string
 *                     enum: [low, medium, high, unknown]
 *                     example: "high"
 *                   stepId:
 *                     type: integer
 *                     example: 45
 *                   stepName:
 *                     type: string
 *                     example: "First rise"
 *     responses:
 *       200:
 *         description: Issue reported successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Batch not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/batches/:id/issues', productionController.reportIssue)

// ============================================================================
// PRODUCTION STEPS
// ============================================================================

/**
 * @swagger
 * /api/production/batches/{batchId}/steps:
 *   get:
 *     summary: Get production steps for a batch
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production batch ID
 *     responses:
 *       200:
 *         description: Production steps retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductionStep'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/batches/:batchId/steps', productionController.getBatchSteps)

/**
 * @swagger
 * /api/production/steps/{id}:
 *   put:
 *     summary: Update production step
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production step ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, ready, in_progress, waiting, completed, skipped, failed]
 *               progress:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *               actualParameters:
 *                 type: object
 *                 example: {"temperature": 220, "duration": 45}
 *               qualityResults:
 *                 type: object
 *                 example: {"texture": "good", "color": "golden"}
 *               notes:
 *                 type: string
 *                 example: "Dough rose perfectly"
 *               hasIssues:
 *                 type: boolean
 *               issues:
 *                 type: array
 *                 items:
 *                   type: object
 *                 example: [{"type": "temperature", "description": "Oven too hot"}]
 *     responses:
 *       200:
 *         description: Production step updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Step not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/steps/:id', productionController.updateStep)

/**
 * @swagger
 * /api/production/steps/{id}/complete:
 *   post:
 *     summary: Complete production step
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production step ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qualityResults:
 *                 type: object
 *                 example: {"appearance": "excellent", "texture": "perfect"}
 *               actualParameters:
 *                 type: object
 *                 example: {"final_temp": 98, "bake_time": 42}
 *               notes:
 *                 type: string
 *                 example: "Step completed without issues"
 *     responses:
 *       200:
 *         description: Production step completed successfully
 *       400:
 *         description: Bad request - step cannot be completed
 *       404:
 *         description: Step not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/steps/:id/complete', productionController.completeStep)

/**
 * @swagger
 * /api/production/steps/{id}/progress:
 *   post:
 *     summary: Update production step progress
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production step ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - progressData
 *             properties:
 *               progressData:
 *                 type: object
 *                 properties:
 *                   progress:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 75
 *                   status:
 *                     type: string
 *                     enum: [pending, ready, in_progress, waiting, completed, skipped, failed]
 *                   notes:
 *                     type: string
 *                   hasIssues:
 *                     type: boolean
 *                   qualityCheckCompleted:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Step progress updated successfully
 *       404:
 *         description: Step not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/steps/:id/progress', productionController.updateStepProgress)

/**
 * @swagger
 * /api/production/steps/{id}/quality-check:
 *   post:
 *     summary: Perform quality check on production step
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Production step ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qualityData
 *             properties:
 *               qualityData:
 *                 type: object
 *                 properties:
 *                   checks:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Visual inspection"
 *                         score:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                           example: 90
 *                         passed:
 *                           type: boolean
 *                           example: true
 *                   notes:
 *                     type: string
 *                     example: "Excellent quality, perfect texture"
 *                   passingScore:
 *                     type: integer
 *                     default: 80
 *                     example: 80
 *     responses:
 *       200:
 *         description: Quality check performed successfully
 *       404:
 *         description: Step not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/steps/:id/quality-check',
  productionController.performQualityCheck
)

// ============================================================================
// PRODUCTION STATUS & MONITORING
// ============================================================================

/**
 * @swagger
 * /api/production/status:
 *   get:
 *     summary: Get real-time production status
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to get status for (defaults to today)
 *       - in: query
 *         name: includeCompleted
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include completed batches in the response
 *     responses:
 *       200:
 *         description: Production status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         date:
 *                           type: string
 *                           format: date
 *                         totalBatches:
 *                           type: integer
 *                         activeBatches:
 *                           type: integer
 *                         pendingBatches:
 *                           type: integer
 *                         waitingBatches:
 *                           type: integer
 *                         completedBatches:
 *                           type: integer
 *                         totalQuantity:
 *                           type: integer
 *                         efficiency:
 *                           type: number
 *                     activeBatches:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pendingBatches:
 *                       type: array
 *                       items:
 *                         type: object
 *                     waitingBatches:
 *                       type: array
 *                       items:
 *                         type: object
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           severity:
 *                             type: string
 *                           message:
 *                             type: string
 *                           batchId:
 *                             type: integer
 *                           batchName:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                     timeline:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           batchId:
 *                             type: integer
 *                           batchName:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/status', productionController.getProductionStatus)

// ============================================================================
// PRODUCTION ANALYTICS
// ============================================================================

/**
 * @swagger
 * /api/production/analytics:
 *   get:
 *     summary: Get production analytics
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Analytics start date (defaults to 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Analytics end date (defaults to today)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: How to group the analytics data
 *     responses:
 *       200:
 *         description: Production analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     batchStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           priority:
 *                             type: string
 *                           workflowId:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           avgDurationMinutes:
 *                             type: number
 *                     efficiencyData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           completedBatches:
 *                             type: integer
 *                           totalProduced:
 *                             type: integer
 *                           delayRate:
 *                             type: number
 *                     period:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/analytics', productionController.getAnalytics)

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Log all production route access
router.use((req, res, next) => {
  logger.info(`Production API accessed: ${req.method} ${req.path}`, {
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })
  next()
})

// Handle 404 for production routes
router.use((req, res) => {
  logger.warn(`Production route not found: ${req.method} ${req.path}`)
  res.status(404).json({
    success: false,
    error: 'Production endpoint not found',
  })
})

module.exports = router
