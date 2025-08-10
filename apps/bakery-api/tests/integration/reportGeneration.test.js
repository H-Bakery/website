#!/usr/bin/env node

/**
 * Development Test Script for Report Generation
 * Tests the reporting service functionality in a development environment
 */

const {
  reportingService,
  ReportType,
  ReportFormat,
} = require('../../services/reportingService')
const path = require('path')

const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
}

async function testReportGeneration() {
  logger.info('🧪 Starting Report Generation Tests...\n')

  try {
    // Test 1: Generate PDF Report
    logger.info('📊 Test 1: Generating PDF Sales Report...')
    const pdfRequest = {
      type: ReportType.CUSTOM_RANGE,
      format: ReportFormat.PDF,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      recipients: ['test@bakery.de'],
      includeCharts: true,
    }

    const pdfReport = await reportingService.generateReport(pdfRequest)
    logger.info('✅ PDF Report generated successfully!')
    logger.info(`   Report ID: ${pdfReport.id}`)
    logger.info(`   File: ${pdfReport.filePath}`)
    logger.info(`   Download URL: ${pdfReport.downloadUrl}\n`)

    // Test 2: Generate Excel Report
    logger.info('📈 Test 2: Generating Excel Sales Report...')
    const excelRequest = {
      type: ReportType.CUSTOM_RANGE,
      format: ReportFormat.EXCEL,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      recipients: ['manager@bakery.de'],
      includeCharts: false,
    }

    const excelReport = await reportingService.generateReport(excelRequest)
    logger.info('✅ Excel Report generated successfully!')
    logger.info(`   Report ID: ${excelReport.id}`)
    logger.info(`   File: ${excelReport.filePath}`)
    logger.info(`   Download URL: ${excelReport.downloadUrl}\n`)

    // Test 3: Test Report Scheduling
    logger.info('⏰ Test 3: Creating Report Schedule...')
    const scheduleRequest = {
      reportType: ReportType.WEEKLY,
      format: ReportFormat.PDF,
      frequency: 'WEEKLY',
      recipients: ['weekly-reports@bakery.de'],
      active: true,
      dayOfWeek: 1, // Monday
      timeOfDay: '08:00',
    }

    const schedule = await reportingService.createSchedule(scheduleRequest)
    logger.info('✅ Report Schedule created successfully!')
    logger.info(`   Schedule ID: ${schedule.id}`)
    logger.info(`   Frequency: ${schedule.frequency}`)
    logger.info(`   Next Run: ${schedule.nextRun}\n`)

    // Test 4: List All Schedules
    logger.info('📋 Test 4: Retrieving All Schedules...')
    const schedules = await reportingService.getSchedules()
    logger.info(`✅ Retrieved ${schedules.length} schedule(s)`)
    schedules.forEach((s, index) => {
      logger.info(
        `   ${index + 1}. ${s.id} - ${s.frequency} ${s.reportType} reports`
      )
    })

    // Test 5: File Storage Stats
    logger.info('\n💾 Test 5: Checking Storage Statistics...')
    // This would normally be called via the file storage service
    logger.info('✅ Storage check completed (mock implementation)')

    logger.info('\n🎉 All Report Generation Tests Completed Successfully!')
    logger.info('📁 Generated files are stored in: generated-reports/')
    logger.info('🔗 Use the download URLs to access the reports')
  } catch (error) {
    logger.error('❌ Test failed:', error.message)
    logger.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

async function testAPIIntegration() {
  logger.info('\n🌐 Testing API Integration...')

  try {
    const axios = require('axios')
    const API_BASE = 'http://localhost:5000' // Update if different

    // Check if API server is running
    logger.info('🔍 Checking if API server is running...')
    try {
      const healthCheck = await axios.get(`${API_BASE}/health`)
      logger.info('✅ API server is running')
    } catch (error) {
      logger.warn('⚠️  API server may not be running on port 5000')
      logger.warn(
        '   Start the API server with: npm start (in bakery-api directory)'
      )
      return
    }

    // Test report generation endpoint (requires authentication)
    logger.info('🔐 Note: API endpoints require authentication')
    logger.info('   To test manually:')
    logger.info('   1. Start API server: cd apps/bakery-api && npm start')
    logger.info('   2. Login to get JWT token')
    logger.info('   3. Use token in Authorization header')
    logger.info('   4. POST to /api/reports/generate')
  } catch (error) {
    logger.warn('⚠️  API integration test skipped:', error.message)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  🥖 BAKERY REPORTING SERVICE TEST SUITE  ')
  console.log('═══════════════════════════════════════════\n')

  // Test report generation
  await testReportGeneration()

  // Test API integration
  await testAPIIntegration()

  console.log('\n═══════════════════════════════════════════')
  console.log('             ✅ TESTS COMPLETE              ')
  console.log('═══════════════════════════════════════════')
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Test suite failed:', error)
    process.exit(1)
  })
}

module.exports = { testReportGeneration, testAPIIntegration }
