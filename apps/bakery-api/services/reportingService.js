const logger = require('../utils/logger')
const path = require('path')
const fs = require('fs')

const ReportType = {
  CUSTOM_RANGE: 'custom_range',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  DAILY: 'daily',
}

const ReportFormat = {
  PDF: 'pdf',
  EXCEL: 'excel',
}

const reportingService = {
  async generateReport(request) {
    const id = `RPT-${Date.now()}`
    const filename = `report-${id}.${
      request.format === ReportFormat.EXCEL ? 'xlsx' : 'pdf'
    }`
    const filePath = path.join(__dirname, '..', 'generated-reports', filename)
    const downloadUrl = `/api/reports/download/${filename}`

    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Write placeholder report
    fs.writeFileSync(filePath, `Report ${id}`)

    logger.info(`Report generated: ${id}`)

    return {
      id,
      filename,
      filePath,
      downloadUrl,
      generatedAt: new Date().toISOString(),
    }
  },

  async createSchedule(request) {
    const id = `SCH-${Date.now()}`
    const nextRun = new Date()
    nextRun.setDate(nextRun.getDate() + 7)

    return {
      id,
      ...request,
      nextRun: nextRun.toISOString(),
      createdAt: new Date().toISOString(),
    }
  },

  async getSchedules() {
    return []
  },
}

module.exports = {
  reportingService,
  ReportType,
  ReportFormat,
}
