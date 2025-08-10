const {
  reportingService,
  ReportType,
  ReportFormat,
} = require('../services/reportingService')
const fs = require('fs')
const path = require('path')

class ReportingController {
  /**
   * POST /api/reports/generate
   * Generate a report on demand
   */
  async generateReport(req, res) {
    try {
      const reportRequest = {
        type: req.body.type || ReportType.CUSTOM_RANGE,
        format: req.body.format || ReportFormat.PDF,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        recipients: req.body.recipients,
        includeCharts: req.body.includeCharts !== false,
      }

      // Validate required fields
      if (!reportRequest.startDate || !reportRequest.endDate) {
        return res.status(400).json({
          error: 'Start date and end date are required',
        })
      }

      // Generate the report
      const generatedReport = await reportingService.generateReport(
        reportRequest
      )

      res.status(201).json({
        success: true,
        report: generatedReport,
      })
    } catch (error) {
      console.error('[ReportingController] Error generating report:', error)
      res.status(500).json({
        error: 'Failed to generate report',
        message: error.message,
      })
    }
  }

  /**
   * GET /api/reports/:id
   * Get report details
   */
  async getReport(req, res) {
    try {
      const reportId = req.params.id

      // In a real implementation, we would fetch from database
      res.json({
        id: reportId,
        message: 'Report details would be fetched from database',
      })
    } catch (error) {
      console.error('[ReportingController] Error fetching report:', error)
      res.status(500).json({
        error: 'Failed to fetch report',
      })
    }
  }

  /**
   * GET /api/reports/download/:token
   * Download a report file
   */
  async downloadReport(req, res) {
    try {
      const token = req.params.token

      // Validate token and get file path
      const filePath = await reportingService.validateDownloadToken(token)

      if (!filePath) {
        return res.status(404).json({
          error: 'Invalid or expired download link',
        })
      }

      // Get file metadata
      const metadata = await reportingService.getFileMetadata(filePath)
      const fileName = path.basename(filePath)

      // Set headers
      res.setHeader('Content-Type', metadata.mimeType)
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Content-Length', metadata.size)

      // Stream the file
      const fileStream = fs.createReadStream(filePath)
      fileStream.pipe(res)

      fileStream.on('error', (error) => {
        console.error('[ReportingController] Error streaming file:', error)
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download file',
          })
        }
      })
    } catch (error) {
      console.error('[ReportingController] Error downloading report:', error)
      res.status(500).json({
        error: 'Failed to download report',
      })
    }
  }

  /**
   * POST /api/reports/schedule
   * Create a report schedule
   */
  async createSchedule(req, res) {
    try {
      const scheduleData = {
        reportType: req.body.reportType,
        format: req.body.format || ReportFormat.PDF,
        frequency: req.body.frequency,
        recipients: req.body.recipients || [],
        active: req.body.active !== false,
        dayOfWeek: req.body.dayOfWeek,
        dayOfMonth: req.body.dayOfMonth,
        timeOfDay: req.body.timeOfDay || '08:00',
      }

      // Validate required fields
      if (!scheduleData.reportType || !scheduleData.frequency) {
        return res.status(400).json({
          error: 'Report type and frequency are required',
        })
      }

      // Create the schedule
      const createdSchedule = await reportingService.createSchedule(
        scheduleData
      )

      res.status(201).json({
        success: true,
        schedule: createdSchedule,
      })
    } catch (error) {
      console.error('[ReportingController] Error creating schedule:', error)
      res.status(500).json({
        error: 'Failed to create schedule',
        message: error.message,
      })
    }
  }

  /**
   * GET /api/reports/schedules
   * Get all report schedules
   */
  async getSchedules(req, res) {
    try {
      const schedules = await reportingService.getSchedules()

      res.json({
        success: true,
        schedules,
      })
    } catch (error) {
      console.error('[ReportingController] Error fetching schedules:', error)
      res.status(500).json({
        error: 'Failed to fetch schedules',
      })
    }
  }

  /**
   * PUT /api/reports/schedule/:id
   * Update a report schedule
   */
  async updateSchedule(req, res) {
    try {
      const scheduleId = req.params.id
      const updates = req.body

      const updatedSchedule = await reportingService.updateSchedule(
        scheduleId,
        updates
      )

      res.json({
        success: true,
        schedule: updatedSchedule,
      })
    } catch (error) {
      console.error('[ReportingController] Error updating schedule:', error)
      res.status(500).json({
        error: 'Failed to update schedule',
        message: error.message,
      })
    }
  }

  /**
   * DELETE /api/reports/schedule/:id
   * Delete a report schedule
   */
  async deleteSchedule(req, res) {
    try {
      const scheduleId = req.params.id

      await reportingService.deleteSchedule(scheduleId)

      res.json({
        success: true,
        message: `Schedule ${scheduleId} deleted successfully`,
      })
    } catch (error) {
      console.error('[ReportingController] Error deleting schedule:', error)
      res.status(500).json({
        error: 'Failed to delete schedule',
        message: error.message,
      })
    }
  }

  /**
   * GET /api/reports/storage/stats
   * Get storage statistics
   */
  async getStorageStats(req, res) {
    try {
      // Mock storage stats for now
      const stats = {
        totalFiles: 5,
        totalSize: 1024 * 1024 * 2.5, // 2.5MB
        oldestFile: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        newestFile: new Date(),
      }

      res.json({
        success: true,
        stats,
      })
    } catch (error) {
      console.error(
        '[ReportingController] Error fetching storage stats:',
        error
      )
      res.status(500).json({
        error: 'Failed to fetch storage statistics',
      })
    }
  }

  /**
   * POST /api/reports/storage/cleanup
   * Clean up old report files
   */
  async cleanupStorage(req, res) {
    try {
      // Mock cleanup for now
      console.log('[ReportingController] Storage cleanup requested')

      res.json({
        success: true,
        message: 'Storage cleanup completed',
      })
    } catch (error) {
      console.error(
        '[ReportingController] Error during storage cleanup:',
        error
      )
      res.status(500).json({
        error: 'Failed to clean up storage',
      })
    }
  }
}

module.exports = { ReportingController }
