const ExcelJS = require('exceljs')
const puppeteer = require('puppeteer')
const fs = require('fs/promises')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

// Mock event bus for now
const eventBus = {
  emit: (event, data) => {
    console.log(`[EventBus] ${event}:`, data)
  },
  safeEmit: (event, data) => {
    try {
      console.log(`[EventBus] ${event}:`, data)
    } catch (error) {
      console.error(`[EventBus] Error emitting event ${event}:`, error)
    }
  },
}

// Report types and formats
const ReportType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM_RANGE: 'CUSTOM_RANGE',
}

const ReportFormat = {
  PDF: 'PDF',
  EXCEL: 'EXCEL',
  CSV: 'CSV',
}

class ReportingService {
  constructor() {
    this.storageDir = path.join(process.cwd(), 'generated-reports')
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5000'
    this.downloadTokens = new Map()
    this.schedules = new Map()

    this.ensureStorageDirectory()
  }

  async ensureStorageDirectory() {
    try {
      await fs.access(this.storageDir)
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true })
    }
  }

  async generateReport(request) {
    try {
      console.log('[ReportingService] Generating report:', request)

      const reportId = uuidv4()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      let filePath
      let filename

      // Generate report based on format
      switch (request.format) {
        case ReportFormat.EXCEL:
          filename = `sales-report-${timestamp}.xlsx`
          filePath = await this.generateExcelReport(request, filename)
          break

        case ReportFormat.PDF:
          filename = `sales-report-${timestamp}.pdf`
          filePath = await this.generatePDFReport(request, filename)
          break

        case ReportFormat.CSV:
          filename = `sales-report-${timestamp}.csv`
          filePath = await this.generateCSVReport(request, filename)
          break

        default:
          throw new Error(`Unsupported format: ${request.format}`)
      }

      // Generate secure download URL
      const downloadUrl = await this.generateDownloadUrl(filePath)

      const report = {
        id: reportId,
        filename,
        filePath,
        downloadUrl,
        format: request.format,
        type: request.type,
        createdAt: new Date(),
        size: (await fs.stat(filePath)).size,
      }

      // Emit event
      eventBus.safeEmit('report.generated', {
        reportId,
        format: request.format,
        recipients: request.recipients || [],
      })

      return report
    } catch (error) {
      console.error('[ReportingService] Error generating report:', error)
      throw error
    }
  }

  async generateExcelReport(request, filename) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sales Report')

    // Add header info
    sheet.addRow(['Sales Report'])
    sheet.addRow([`Period: ${request.startDate} to ${request.endDate}`])
    sheet.addRow(['Generated at:', new Date().toLocaleString()])
    sheet.addRow([]) // Empty row

    // Add mock data headers
    const headers = ['Date', 'Product', 'Quantity', 'Revenue']
    const headerRow = sheet.addRow(headers)

    // Style headers
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
    })

    // Add mock data
    const mockData = [
      ['2024-01-15', 'Bauernbrot', 25, 87.5],
      ['2024-01-15', 'Croissant', 18, 72.0],
      ['2024-01-16', 'Brezel', 32, 48.0],
      ['2024-01-16', 'Vollkornbrot', 12, 48.0],
      ['2024-01-17', 'Apfelkuchen', 8, 36.0],
    ]

    mockData.forEach((row) => sheet.addRow(row))

    // Auto-fit columns
    sheet.columns.forEach((column) => {
      column.width = 15
    })

    const filePath = path.join(this.storageDir, filename)
    await workbook.xlsx.writeFile(filePath)

    return filePath
  }

  async generatePDFReport(request, filename) {
    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .period { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .summary { margin-top: 30px; padding: 20px; background-color: #f9f9f9; }
          .total { font-weight: bold; color: #2196F3; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🥖 Bakery Sales Report</h1>
          <div class="period">Period: ${request.startDate} to ${
      request.endDate
    }</div>
          <div>Generated: ${new Date().toLocaleString()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>2024-01-15</td><td>Bauernbrot</td><td>25</td><td>€87.50</td></tr>
            <tr><td>2024-01-15</td><td>Croissant</td><td>18</td><td>€72.00</td></tr>
            <tr><td>2024-01-16</td><td>Brezel</td><td>32</td><td>€48.00</td></tr>
            <tr><td>2024-01-16</td><td>Vollkornbrot</td><td>12</td><td>€48.00</td></tr>
            <tr><td>2024-01-17</td><td>Apfelkuchen</td><td>8</td><td>€36.00</td></tr>
          </tbody>
        </table>

        <div class="summary">
          <h3>Summary</h3>
          <p><strong>Total Revenue:</strong> <span class="total">€291.50</span></p>
          <p><strong>Total Items Sold:</strong> 95</p>
          <p><strong>Average Order Value:</strong> €58.30</p>
        </div>
      </body>
      </html>
    `

    await page.setContent(html)
    const filePath = path.join(this.storageDir, filename)

    await page.pdf({
      path: filePath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    })

    await browser.close()
    return filePath
  }

  async generateCSVReport(request, filename) {
    const headers = ['Date', 'Product', 'Quantity', 'Revenue']
    const mockData = [
      ['2024-01-15', 'Bauernbrot', '25', '87.50'],
      ['2024-01-15', 'Croissant', '18', '72.00'],
      ['2024-01-16', 'Brezel', '32', '48.00'],
      ['2024-01-16', 'Vollkornbrot', '12', '48.00'],
      ['2024-01-17', 'Apfelkuchen', '8', '36.00'],
    ]

    const csvContent = [
      headers.join(','),
      ...mockData.map((row) => row.join(',')),
    ].join('\n')

    const filePath = path.join(this.storageDir, filename)
    await fs.writeFile(filePath, csvContent, 'utf8')

    return filePath
  }

  async generateDownloadUrl(filePath) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    this.downloadTokens.set(token, { filePath, expiresAt })

    return `${this.baseUrl}/api/reports/download/${token}`
  }

  async validateDownloadToken(token) {
    const tokenData = this.downloadTokens.get(token)

    if (!tokenData) {
      return null
    }

    if (new Date() > tokenData.expiresAt) {
      this.downloadTokens.delete(token)
      return null
    }

    try {
      await fs.access(tokenData.filePath)
      return tokenData.filePath
    } catch {
      this.downloadTokens.delete(token)
      return null
    }
  }

  async getFileMetadata(filePath) {
    const stats = await fs.stat(filePath)
    const ext = path.extname(filePath).toLowerCase()

    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
    }

    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
    }
  }

  // Schedule management methods
  async createSchedule(scheduleData) {
    const scheduleId = uuidv4()
    const schedule = {
      id: scheduleId,
      ...scheduleData,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(scheduleData),
    }

    this.schedules.set(scheduleId, schedule)
    console.log(`[ReportingService] Created schedule ${scheduleId}`)

    return schedule
  }

  async getSchedules() {
    return Array.from(this.schedules.values())
  }

  async updateSchedule(scheduleId, updates) {
    const existing = this.schedules.get(scheduleId)
    if (!existing) {
      throw new Error(`Schedule ${scheduleId} not found`)
    }

    const updated = { ...existing, ...updates }
    this.schedules.set(scheduleId, updated)

    return updated
  }

  async deleteSchedule(scheduleId) {
    const deleted = this.schedules.delete(scheduleId)
    if (!deleted) {
      throw new Error(`Schedule ${scheduleId} not found`)
    }
  }

  calculateNextRun(scheduleData) {
    const now = new Date()
    const [hours, minutes] = scheduleData.timeOfDay.split(':').map(Number)

    const nextRun = new Date()
    nextRun.setHours(hours, minutes, 0, 0)

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }

    return nextRun
  }
}

// Export singleton instance
const reportingService = new ReportingService()

module.exports = {
  reportingService,
  ReportingService,
  ReportType,
  ReportFormat,
}
