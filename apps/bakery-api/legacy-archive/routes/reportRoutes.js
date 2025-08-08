const express = require('express')
const router = express.Router()
const { ReportingController } = require('../controllers/reportingController')
const { authenticate } = require('../middleware/authMiddleware')

// Initialize the reporting controller
const reportingController = new ReportingController()

/**
 * @swagger
 * components:
 *   schemas:
 *     ReportRequest:
 *       type: object
 *       required:
 *         - startDate
 *         - endDate
 *       properties:
 *         type:
 *           type: string
 *           enum: [DAILY, WEEKLY, MONTHLY, CUSTOM_RANGE]
 *           description: Type of report to generate
 *         format:
 *           type: string
 *           enum: [PDF, EXCEL, CSV]
 *           description: Output format for the report
 *         startDate:
 *           type: string
 *           format: date
 *           description: Start date for report data
 *         endDate:
 *           type: string
 *           format: date
 *           description: End date for report data
 *         recipients:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           description: Email addresses to send the report to
 *         includeCharts:
 *           type: boolean
 *           default: true
 *           description: Whether to include charts in the report
 *
 *     ReportSchedule:
 *       type: object
 *       required:
 *         - reportType
 *         - frequency
 *       properties:
 *         reportType:
 *           type: string
 *           enum: [DAILY, WEEKLY, MONTHLY]
 *           description: Type of report to schedule
 *         format:
 *           type: string
 *           enum: [PDF, EXCEL, CSV]
 *           default: PDF
 *           description: Output format for scheduled reports
 *         frequency:
 *           type: string
 *           enum: [DAILY, WEEKLY, MONTHLY]
 *           description: How often to generate the report
 *         recipients:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           description: Email addresses to send scheduled reports to
 *         active:
 *           type: boolean
 *           default: true
 *           description: Whether the schedule is active
 *         dayOfWeek:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: Day of week for weekly schedules (0=Sunday)
 *         dayOfMonth:
 *           type: integer
 *           minimum: 1
 *           maximum: 31
 *           description: Day of month for monthly schedules
 *         timeOfDay:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           default: '08:00'
 *           description: Time of day to generate reports (HH:MM format)
 */

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate a sales report on demand
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportRequest'
 *     responses:
 *       201:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 report:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     downloadUrl:
 *                       type: string
 *                     filename:
 *                       type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate', authenticate, async (req, res) => {
  await reportingController.generateReport(req, res)
})

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get report details by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report details retrieved successfully
 *       404:
 *         description: Report not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authenticate, async (req, res) => {
  await reportingController.getReport(req, res)
})

/**
 * @swagger
 * /api/reports/download/{token}:
 *   get:
 *     summary: Download a report file using a secure token
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Secure download token
 *     responses:
 *       200:
 *         description: File download initiated
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Invalid or expired download link
 *       500:
 *         description: Download error
 */
router.get('/download/:token', async (req, res) => {
  await reportingController.downloadReport(req, res)
})

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Create a new report schedule
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportSchedule'
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         description: Invalid schedule parameters
 *       401:
 *         description: Unauthorized
 */
router.post('/schedule', authenticate, async (req, res) => {
  await reportingController.createSchedule(req, res)
})

/**
 * @swagger
 * /api/reports/schedules:
 *   get:
 *     summary: Get all report schedules
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 schedules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ReportSchedule'
 *       401:
 *         description: Unauthorized
 */
router.get('/schedules', authenticate, async (req, res) => {
  await reportingController.getSchedules(req, res)
})

/**
 * @swagger
 * /api/reports/schedule/{id}:
 *   put:
 *     summary: Update a report schedule
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportSchedule'
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       404:
 *         description: Schedule not found
 *       401:
 *         description: Unauthorized
 */
router.put('/schedule/:id', authenticate, async (req, res) => {
  await reportingController.updateSchedule(req, res)
})

/**
 * @swagger
 * /api/reports/schedule/{id}:
 *   delete:
 *     summary: Delete a report schedule
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *       404:
 *         description: Schedule not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/schedule/:id', authenticate, async (req, res) => {
  await reportingController.deleteSchedule(req, res)
})

/**
 * @swagger
 * /api/reports/storage/stats:
 *   get:
 *     summary: Get storage statistics for generated reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                     totalSize:
 *                       type: integer
 *                       description: Total size in bytes
 *                     oldestFile:
 *                       type: string
 *                       format: date-time
 *                     newestFile:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/storage/stats', authenticate, async (req, res) => {
  await reportingController.getStorageStats(req, res)
})

/**
 * @swagger
 * /api/reports/storage/cleanup:
 *   post:
 *     summary: Clean up old report files (older than 30 days)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage cleanup completed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Cleanup error
 */
router.post('/storage/cleanup', authenticate, async (req, res) => {
  await reportingController.cleanupStorage(req, res)
})

module.exports = router
