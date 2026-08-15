/**
 * @fileoverview Analytics feature library for bakery management
 * @module @bakery/management/feature-analytics
 */

// Chart components
export { RevenueTrendChart } from './lib/revenue-trend-chart/revenue-trend-chart'
export type { RevenueTrendChartProps } from './lib/revenue-trend-chart/revenue-trend-chart'

export { PaymentMethodsChart } from './lib/payment-methods-chart/payment-methods-chart'
export type { PaymentMethodsChartProps } from './lib/payment-methods-chart/payment-methods-chart'

// Table components
export { ProductRankingTable } from './lib/product-ranking-table/product-ranking-table'
export type { ProductRankingTableProps } from './lib/product-ranking-table/product-ranking-table'

// Input components
export { DateRangePicker } from './lib/date-range-picker/date-range-picker'
export type { DateRangePickerProps } from './lib/date-range-picker/date-range-picker'

// Action components
export { ExportButton } from './lib/export-button/export-button'
export type {
  ExportButtonProps,
  ExportFormat,
} from './lib/export-button/export-button'

// Display components
export { AnalyticsSummaryCard } from './lib/analytics-summary-card/analytics-summary-card'
export type { AnalyticsSummaryCardProps } from './lib/analytics-summary-card/analytics-summary-card'

// Hooks
export { useExportReports } from './lib/hooks/use-export-reports'
export type { ExportParams } from './lib/hooks/use-export-reports'
