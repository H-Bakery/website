/**
 * Analytics data types for the bakery management system
 */

export interface RevenueData {
  date: string;
  revenue: number;
  transactionCount: number;
}

export interface ProductAnalyticsPerformance {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  rank?: number;
}

export interface CashierPerformance {
  userId: string;
  userName: string;
  transactionCount: number;
  totalRevenue: number;
  averageTransactionValue: number;
}

export interface PaymentMethodData {
  method: string;
  count: number;
  amount: number;
  percentage?: number;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  cashPercentage: number;
  topSellingProduct?: ProductAnalyticsPerformance;
  busiestDay?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface AnalyticsFilters {
  dateRange: DateRange;
  granularity?: Granularity;
  productCategories?: string[];
  paymentMethods?: string[];
}

export interface AnalyticsChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
  }[];
}

export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface AnalyticsResponse<T> {
  data: T;
  pagination?: PaginationParams;
  filters: AnalyticsFilters;
}