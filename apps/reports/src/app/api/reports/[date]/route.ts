/**
 * API route for fetching a specific report by date
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { DailyReport } from '@bakery/shared/types'

interface RouteParams {
  params: {
    date: string
  }
}

/**
 * GET /api/reports/[date]
 * Returns a specific report by date
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { date } = params

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
          data: null,
        },
        { status: 400 }
      )
    }

    // Resolve path to reports directory
    const reportsDir = path.resolve(
      process.cwd(),
      '../../../content/reports/converted'
    )

    // Try to find the report file
    // The filename pattern is typically YYYY-MM-DD_registerId.json
    let reportFile: string | null = null
    let reportPath: string | null = null

    try {
      // Check if directory exists
      await fs.access(reportsDir)

      // Read directory and find matching file
      const files = await fs.readdir(reportsDir)
      const matchingFile = files.find((file) => file.startsWith(`${date}_`))

      if (matchingFile) {
        reportFile = matchingFile
        reportPath = path.join(reportsDir, matchingFile)
      }
    } catch {
      // Try alternative path
      const altDir = path.resolve(process.cwd(), '../content/reports/converted')
      try {
        await fs.access(altDir)
        const files = await fs.readdir(altDir)
        const matchingFile = files.find((file) => file.startsWith(`${date}_`))

        if (matchingFile) {
          reportFile = matchingFile
          reportPath = path.join(altDir, matchingFile)
        }
      } catch {
        // Directory not found
      }
    }

    if (!reportPath || !reportFile) {
      return NextResponse.json(
        {
          success: false,
          message: `Report not found for date: ${date}`,
          data: null,
        },
        { status: 404 }
      )
    }

    // Read and parse the report file
    const content = await fs.readFile(reportPath, 'utf-8')
    const reportData: DailyReport = JSON.parse(content)

    // Validate report structure
    if (
      !reportData.date ||
      !reportData.transactions ||
      !Array.isArray(reportData.transactions)
    ) {
      throw new Error('Invalid report format')
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      message: 'Report fetched successfully',
    })
  } catch (error) {
    console.error('Error fetching report:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid JSON format in report file',
          data: null,
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch report',
        data: null,
      },
      { status: 500 }
    )
  }
}