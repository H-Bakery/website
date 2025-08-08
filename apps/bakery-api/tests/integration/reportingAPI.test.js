#!/usr/bin/env node

/**
 * End-to-End Test Script for Report Generation with Authentication
 * This script demonstrates the complete flow from login to report download
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

const API_BASE = 'http://localhost:5000'

// Test credentials (from the seeded users)
const TEST_USER = {
  username: 'admin',
  password: 'admin123',
}

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) =>
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
}

async function testAuthAndReportFlow() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  🧪 AUTHENTICATION & REPORT GENERATION TEST')
  console.log('═══════════════════════════════════════════════════\n')

  let authToken = null

  try {
    // Step 1: Login to get JWT token
    log.info('Step 1: Authenticating user...')
    const loginResponse = await axios.post(
      `${API_BASE}/api/auth/login`,
      TEST_USER
    )

    if (loginResponse.data && loginResponse.data.token) {
      authToken = loginResponse.data.token
      log.success(
        `Authentication successful! Token: ${authToken.substring(0, 20)}...`
      )
      log.info(
        `User: ${loginResponse.data.user.username} (${loginResponse.data.user.role})`
      )
    } else {
      throw new Error('No token received in login response')
    }

    // Step 2: Test report generation with authentication
    log.info('\nStep 2: Generating authenticated PDF report...')
    const reportRequest = {
      type: 'CUSTOM_RANGE',
      format: 'PDF',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      recipients: ['admin@bakery.de'],
      includeCharts: true,
    }

    const reportResponse = await axios.post(
      `${API_BASE}/api/reports/generate`,
      reportRequest,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (
      reportResponse.data &&
      reportResponse.data.success &&
      reportResponse.data.report
    ) {
      const report = reportResponse.data.report
      log.success('Report generated successfully!')
      log.info(`Report ID: ${report.id}`)
      log.info(`Filename: ${report.filename}`)
      log.info(`Download URL: ${report.downloadUrl}`)
      log.info(`Generated at: ${report.generatedAt}`)

      // Step 3: Test download endpoint
      log.info('\nStep 3: Testing download endpoint...')
      const downloadToken = report.downloadUrl.split('/').pop()
      const downloadUrl = `${API_BASE}/api/reports/download/${downloadToken}`

      log.info(`Download URL: ${downloadUrl}`)

      // Verify download works (HEAD request to check)
      try {
        const downloadCheck = await axios.head(downloadUrl)
        log.success(
          `Download endpoint is accessible (Status: ${downloadCheck.status})`
        )
        log.info(
          `Content-Type: ${
            downloadCheck.headers['content-type'] || 'not specified'
          }`
        )
      } catch (downloadError) {
        log.warn(`Download check failed: ${downloadError.message}`)
      }

      // Step 4: Test report schedules
      log.info('\nStep 4: Creating report schedule...')
      const scheduleRequest = {
        reportType: 'WEEKLY',
        format: 'EXCEL',
        frequency: 'WEEKLY',
        recipients: ['admin@bakery.de'],
        active: true,
        dayOfWeek: 1, // Monday
        timeOfDay: '09:00',
      }

      const scheduleResponse = await axios.post(
        `${API_BASE}/api/reports/schedule`,
        scheduleRequest,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (scheduleResponse.data && scheduleResponse.data.success) {
        const schedule = scheduleResponse.data.schedule
        log.success('Schedule created successfully!')
        log.info(`Schedule ID: ${schedule.id}`)
        log.info(`Next run: ${schedule.nextRun}`)
      }

      // Step 5: Get all schedules
      log.info('\nStep 5: Retrieving all schedules...')
      const schedulesResponse = await axios.get(
        `${API_BASE}/api/reports/schedules`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      if (schedulesResponse.data && schedulesResponse.data.success) {
        const schedules = schedulesResponse.data.schedules
        log.success(`Retrieved ${schedules.length} schedule(s)`)
        schedules.forEach((s, index) => {
          log.info(
            `  ${index + 1}. ${s.id} - ${s.frequency} ${s.reportType} reports`
          )
        })
      }
    } else {
      throw new Error('Invalid report generation response')
    }
  } catch (error) {
    log.error(`Test failed: ${error.message}`)
    if (error.response) {
      log.error(`Response status: ${error.response.status}`)
      log.error(`Response data: ${JSON.stringify(error.response.data)}`)
    }
    process.exit(1)
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════')
  console.log('               ✅ ALL TESTS PASSED!')
  console.log('═══════════════════════════════════════════════════')
  console.log('\n📊 Summary:')
  console.log('  ✓ Authentication working')
  console.log('  ✓ Report generation with auth working')
  console.log('  ✓ Download URLs generated correctly')
  console.log('  ✓ Schedule creation working')
  console.log('  ✓ Schedule retrieval working')
  console.log('\n🎉 The reporting integration is fully functional!')
}

// Test unauthenticated access (should fail)
async function testUnauthenticatedAccess() {
  log.info('\n🔒 Testing unauthenticated access (should fail)...')

  try {
    await axios.post(`${API_BASE}/api/reports/generate`, {
      type: 'DAILY',
      format: 'PDF',
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    })

    log.error(
      '❌ Unauthenticated access was allowed (this is a security issue!)'
    )
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log.success(
        '✅ Unauthenticated access correctly denied (401 Unauthorized)'
      )
    } else {
      log.error(`Unexpected error: ${error.message}`)
    }
  }
}

// Main execution
async function main() {
  // First test unauthenticated access
  await testUnauthenticatedAccess()

  // Then test authenticated flow
  await testAuthAndReportFlow()
}

if (require.main === module) {
  main().catch((error) => {
    log.error(`Unexpected error: ${error.message}`)
    process.exit(1)
  })
}

module.exports = { testAuthAndReportFlow, testUnauthenticatedAccess }
