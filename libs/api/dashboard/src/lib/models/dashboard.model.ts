/**
 * Dashboard domain models and types
 */

// Base interface
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// Sales Summary Analytics
export interface SalesSummary {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  dailySales: DailySalesData[];
  statusBreakdown: OrderStatusCount[];
  period: string;
}

export interface DailySalesData {
  date: string;
  orders: number;
  revenue: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

// Production Overview Analytics
export interface ProductionOverview {
  topProducts: TopProductData[];
  categoryBreakdown: CategoryBreakdownData[];
  dailyProduction: DailyProductionData[];
  period: string;
}

export interface TopProductData {
  name: string;
  category: string;
  totalQuantity: number;
  orderCount: number;
  revenue: number;
}

export interface CategoryBreakdownData {
  category: string;
  totalQuantity: number;
  productCount: number;
  revenue: number;
}

export interface DailyProductionData {
  date: string;
  totalItems: number;
  uniqueProducts: number;
}

// Revenue Analytics
export interface RevenueAnalytics {
  totalRevenue: number;
  totalCash: number;
  dailyCash: DailyCashData[];
  dailyRevenue: DailySalesData[];
  categoryRevenue: CategoryRevenueData[];
  period: string;
}

export interface DailyCashData {
  date: string;
  amount: number;
}

export interface CategoryRevenueData {
  category: string;
  revenue: number;
  avgPrice: number;
  totalQuantity: number;
}

// Order Analytics
export interface OrderAnalytics {
  orderMetrics: OrderMetrics;
  hourlyDistribution: HourlyOrderData[];
  customerFrequency: CustomerFrequencyData[];
  weeklyPattern: WeeklyPatternData[];
  period: string;
}

export interface OrderMetrics {
  totalOrders: number;
  avgOrderValue: number;
  minOrderValue: number;
  maxOrderValue: number;
  uniqueCustomers: number;
}

export interface HourlyOrderData {
  hour: number;
  orders: number;
  revenue: number;
}

export interface CustomerFrequencyData {
  customerName: string;
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
}

export interface WeeklyPatternData {
  dayOfWeek: number;
  orders: number;
  revenue: number;
}

// Product Performance Analytics
export interface ProductPerformance {
  productMetrics: ProductMetricData[];
  slowMovers: SlowMoverData[];
  growthTrends: GrowthTrendData[];
  period: string;
}

export interface ProductMetricData {
  id: number;
  name: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  avgOrderQuantity: number;
  velocityPerDay: number;
}

export interface SlowMoverData {
  name: string;
  quantitySold: number;
  daysSinceLastOrder: number;
}

export interface GrowthTrendData {
  productName: string;
  currentPeriod: number;
  previousPeriod: number;
  growthRate: number;
}

// Daily Metrics
export interface DailyMetrics {
  date: string;
  todaySales: number;
  todayOrders: number;
  avgOrderValue: number;
  topProducts: DailyTopProductData[];
  unsoldItems: UnsoldItemsSummary;
  comparisonWithYesterday: DailyComparison;
}

export interface DailyTopProductData {
  name: string;
  quantity: number;
  revenue: number;
}

export interface UnsoldItemsSummary {
  totalQuantity: number;
  totalValue: number;
  items: UnsoldItemData[];
}

export interface UnsoldItemData {
  productName: string;
  quantity: number;
  value: number;
}

export interface DailyComparison {
  salesChange: number;
  ordersChange: number;
}

// Filter interfaces
export interface DashboardFilters {
  days?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}

// Constants
export const DASHBOARD_CONSTANTS = {
  DEFAULT_DAYS: 30,
  MAX_DAYS: 365,
  MIN_DAYS: 1,
  TOP_PRODUCTS_LIMIT: 10,
  TOP_CUSTOMERS_LIMIT: 10,
  RECENT_ORDERS_LIMIT: 10
} as const;

// Error messages
export const DASHBOARD_ERROR_MESSAGES = {
  INVALID_DAYS: "Days parameter must be between 1 and 365",
  INVALID_CATEGORY: "Invalid product category",
  DATABASE_ERROR: "Database error occurred",
  UNAUTHORIZED: "Authentication required"
} as const;