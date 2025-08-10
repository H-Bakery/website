/**
 * Report service for fetching and managing daily sales reports
 */

import { apiClient } from '../api-client'
import type {
  ApiResponse,
  DailyReport,
  ReportMetadata,
  ReportListResponse,
} from '@bakery/shared/types'

export class ReportService {
  private basePath = '/api/reports'

  /**
   * Get list of available reports
   */
  async getReports(): Promise<ApiResponse<ReportListResponse>> {
    try {
      return await apiClient.get<ReportListResponse>(this.basePath)
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
        data: undefined,
      }
    }
  }

  /**
   * Get a specific report by date
   * @param date - Date in YYYY-MM-DD format
   */
  async getReportByDate(date: string): Promise<ApiResponse<DailyReport>> {
    try {
      return await apiClient.get<DailyReport>(`${this.basePath}/${date}`)
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch report',
        data: undefined,
      }
    }
  }

  /**
   * Get reports within a date range
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   */
  async getReportsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<ReportListResponse>> {
    try {
      return await apiClient.get<ReportListResponse>(this.basePath, {
        startDate,
        endDate,
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
        data: undefined,
      }
    }
  }

  /**
   * Format date for report filename
   * @param date - Date object or string
   */
  formatReportDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toISOString().split('T')[0]
  }

  /**
   * Parse report filename to extract date
   * @param filename - Report filename (e.g., "2025-07-12_50779225.json")
   */
  parseReportFilename(filename: string): {
    date: string
    registerId: string
  } | null {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(\d+)\.json$/)
    if (!match) return null

    return {
      date: match[1],
      registerId: match[2],
    }
  }

  /**
   * Calculate report statistics
   * @param report - Daily report data
   */
  calculateReportStats(report: DailyReport) {
    const { transactions, daily_summary } = report

    // Calculate hourly distribution
    const hourlyDistribution = new Map<number, number>()
    transactions.forEach((transaction) => {
      const hour = new Date(transaction.timestamp).getHours()
      hourlyDistribution.set(hour, (hourlyDistribution.get(hour) || 0) + 1)
    })

    // Calculate payment method distribution
    const paymentMethods = new Map<string, number>()
    transactions.forEach((transaction) => {
      paymentMethods.set(
        transaction.payment,
        (paymentMethods.get(transaction.payment) || 0) + transaction.total
      )
    })

    // Calculate top products
    const productSales = new Map<string, { quantity: number; revenue: number }>()
    transactions.forEach((transaction) => {
      transaction.items.forEach((item) => {
        const existing = productSales.get(item.product_id) || {
          quantity: 0,
          revenue: 0,
        }
        productSales.set(item.product_id, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.total,
        })
      })
    })

    const topProducts = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      hourlyDistribution: Array.from(hourlyDistribution.entries()).sort(
        (a, b) => a[0] - b[0]
      ),
      paymentMethodDistribution: Array.from(paymentMethods.entries()),
      topProducts,
      averageTransactionValue:
        daily_summary.total_revenue / daily_summary.transaction_count,
      cashPercentage: (daily_summary.cash_revenue / daily_summary.total_revenue) * 100,
    }
  }
}

// Export singleton instance
export const reportService = new ReportService()