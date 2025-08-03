/**
 * API route for listing available reports
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ReportListResponse, ReportMetadata } from '@bakery/shared/types'

/**
 * GET /api/reports
 * Returns list of available report files
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters for date filtering
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Resolve path to reports directory
    // When running from apps/reports, go up to monorepo root then to content
    const reportsDir = path.resolve(
      process.cwd(),
      '../../../content/reports/converted'
    )

    // Check if directory exists
    try {
      await fs.access(reportsDir)
    } catch {
      // If not found, try alternative path (when running from monorepo root)
      const altPath = path.resolve(process.cwd(), '../content/reports/converted')
      try {
        await fs.access(altPath)
        // Use alternative path if it exists
        Object.assign(reportsDir, altPath)
      } catch {
        return NextResponse.json(
          {
            success: false,
            message: 'Reports directory not found',
            data: null,
          },
          { status: 404 }
        )
      }
    }

    // Read all files in the directory
    const files = await fs.readdir(reportsDir)

    // Filter JSON files and extract metadata
    const reports: ReportMetadata[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      // Extract date from filename (YYYY-MM-DD_registerId.json)
      const match = file.match(/^(\d{4}-\d{2}-\d{2})_\d+\.json$/)
      if (!match) continue

      const date = match[1]

      // Apply date filters if provided
      if (startDate && date < startDate) continue
      if (endDate && date > endDate) continue

      // Get file stats for size
      const filePath = path.join(reportsDir, file)
      const stats = await fs.stat(filePath)

      // Optionally read file to get transaction count and revenue
      // (Only for first few files to avoid performance issues)
      let transactionCount: number | undefined
      let totalRevenue: number | undefined

      if (reports.length < 10) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const reportData = JSON.parse(content)
          transactionCount = reportData.transactions?.length
          totalRevenue = reportData.daily_summary?.total_revenue
        } catch {
          // Ignore parse errors
        }
      }

      reports.push({
        date,
        filename: file,
        filesize: stats.size,
        transaction_count: transactionCount,
        total_revenue: totalRevenue,
      })
    }

    // Sort by date descending
    reports.sort((a, b) => b.date.localeCompare(a.date))

    const response: ReportListResponse = {
      reports,
      total: reports.length,
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Reports fetched successfully',
    })
  } catch (error) {
    console.error('Error fetching reports:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
        data: null,
      },
      { status: 500 }
    )
  }
}