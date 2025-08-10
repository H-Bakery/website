/**
 * Report types for daily sales reports
 */

/**
 * Individual item within a transaction
 */
export interface TransactionItem {
  product: string
  product_id: string
  quantity: number
  price: number
  total: number
}

/**
 * Individual transaction/sale
 */
export interface Transaction {
  id: string
  timestamp: string
  type: 'sale' | 'refund' | 'adjustment'
  user: string
  items: TransactionItem[]
  total: number
  payment: 'Bar' | 'Unbar' | string
}

/**
 * VAT breakdown totals
 */
export interface VatTotals {
  '0%'?: number
  '7%'?: number
  '19%'?: number
  [key: string]: number | undefined
}

/**
 * Daily summary statistics
 */
export interface DailySummary {
  total_revenue: number
  cash_revenue: number
  transaction_count: number
  vat_totals: VatTotals
}

/**
 * User performance metrics (if included in report)
 */
export interface UserPerformance {
  user: string
  transaction_count: number
  total_revenue: number
  average_transaction: number
}

/**
 * Product performance metrics (if included in report)
 */
export interface ProductPerformance {
  product_id: string
  product_name: string
  quantity_sold: number
  total_revenue: number
}

/**
 * Complete daily report structure
 */
export interface DailyReport {
  date: string
  register_id: string
  report_number: number
  company: string
  transactions: Transaction[]
  daily_summary: DailySummary
  user_performance?: UserPerformance[]
  product_performance?: ProductPerformance[]
}

/**
 * Report metadata for listing reports
 */
export interface ReportMetadata {
  date: string
  filename: string
  filesize?: number
  transaction_count?: number
  total_revenue?: number
}

/**
 * Report list response
 */
export interface ReportListResponse {
  reports: ReportMetadata[]
  total: number
}