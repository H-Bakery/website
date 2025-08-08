import { useQuery, UseQueryResult } from 'react-query'
import bakeryAPI from '../services/bakeryAPI'
import {
  SalesData,
  CustomerData,
  TimeSeriesData,
  SummaryData,
  ProductionData,
  FinancialData,
  InventoryItem,
  StaffData,
  TimeRange,
} from '../services/types'
import { Product } from '../types/product'

// Query key factory for dashboard queries
const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (range: TimeRange) =>
    [...dashboardKeys.all, 'summary', range] as const,
  sales: (range: TimeRange) => [...dashboardKeys.all, 'sales', range] as const,
  customers: () => [...dashboardKeys.all, 'customers'] as const,
  products: () => [...dashboardKeys.all, 'products'] as const,
  timeSeries: (type: string, range: TimeRange) =>
    [...dashboardKeys.all, 'timeSeries', type, range] as const,
  production: (range: TimeRange) =>
    [...dashboardKeys.all, 'production', range] as const,
  financial: (range: TimeRange) =>
    [...dashboardKeys.all, 'financial', range] as const,
  inventory: () => [...dashboardKeys.all, 'inventory'] as const,
  staff: () => [...dashboardKeys.all, 'staff'] as const,
}

// Hook for summary data
export const useSummaryData = (
  range: TimeRange
): UseQueryResult<SummaryData, Error> => {
  return useQuery({
    queryKey: dashboardKeys.summary(range),
    queryFn: () => bakeryAPI.getSummaryData(range),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for sales data
export const useSalesData = (
  range: TimeRange
): UseQueryResult<SalesData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.sales(range),
    queryFn: () => bakeryAPI.getSalesData(range),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for customer data
export const useCustomerData = (): UseQueryResult<CustomerData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.customers(),
    queryFn: () => bakeryAPI.getCustomerData(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for product data
export const useProductData = (): UseQueryResult<Product[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.products(),
    queryFn: () => bakeryAPI.getProducts(),
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for time series data
export const useTimeSeriesData = (
  type: 'sales' | 'customers' | 'production' | 'waste',
  range: TimeRange
): UseQueryResult<TimeSeriesData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.timeSeries(type, range),
    queryFn: () => bakeryAPI.getTimeSeriesData(type, range),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for production data
export const useProductionData = (
  range: TimeRange
): UseQueryResult<ProductionData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.production(range),
    queryFn: () => bakeryAPI.getProductionData(range),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for financial data
export const useFinancialData = (
  range: TimeRange
): UseQueryResult<FinancialData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.financial(range),
    queryFn: () => bakeryAPI.getFinancialData(range),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for inventory data
export const useInventoryData = (): UseQueryResult<InventoryItem[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.inventory(),
    queryFn: () => bakeryAPI.getInventoryData(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Hook for staff data
export const useStaffData = (): UseQueryResult<StaffData[], Error> => {
  return useQuery({
    queryKey: dashboardKeys.staff(),
    queryFn: () => bakeryAPI.getStaffData(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('Authentication')) {
        return false
      }
      return failureCount < 3
    },
  })
}

// Combined hook for sales dashboard data
export const useSalesDashboardData = (timeRange: TimeRange) => {
  const summaryQuery = useSummaryData(timeRange)
  const salesQuery = useSalesData(timeRange)
  const customerQuery = useCustomerData()
  const productQuery = useProductData()
  const salesTrendQuery = useTimeSeriesData('sales', timeRange)
  const customerTrendQuery = useTimeSeriesData('customers', timeRange)

  const isLoading =
    summaryQuery.isLoading ||
    salesQuery.isLoading ||
    customerQuery.isLoading ||
    productQuery.isLoading ||
    salesTrendQuery.isLoading ||
    customerTrendQuery.isLoading

  const error =
    summaryQuery.error ||
    salesQuery.error ||
    customerQuery.error ||
    productQuery.error ||
    salesTrendQuery.error ||
    customerTrendQuery.error

  return {
    summary: summaryQuery.data,
    salesData: salesQuery.data || [],
    customerData: customerQuery.data || [],
    productData: productQuery.data || [],
    salesTrend: salesTrendQuery.data || [],
    customerTrend: customerTrendQuery.data || [],
    isLoading,
    error,
    refetch: () => {
      summaryQuery.refetch()
      salesQuery.refetch()
      customerQuery.refetch()
      productQuery.refetch()
      salesTrendQuery.refetch()
      customerTrendQuery.refetch()
    },
  }
}

// Combined hook for production dashboard data
export const useProductionDashboardData = (timeRange: TimeRange) => {
  const productionQuery = useProductionData(timeRange)
  const productionTrendQuery = useTimeSeriesData('production', timeRange)
  const wasteTrendQuery = useTimeSeriesData('waste', timeRange)
  const inventoryQuery = useInventoryData()
  const staffQuery = useStaffData()

  const isLoading =
    productionQuery.isLoading ||
    productionTrendQuery.isLoading ||
    wasteTrendQuery.isLoading ||
    inventoryQuery.isLoading ||
    staffQuery.isLoading

  const error =
    productionQuery.error ||
    productionTrendQuery.error ||
    wasteTrendQuery.error ||
    inventoryQuery.error ||
    staffQuery.error

  return {
    productionData: productionQuery.data || [],
    productionTrend: productionTrendQuery.data || [],
    wasteTrend: wasteTrendQuery.data || [],
    inventoryData: inventoryQuery.data || [],
    staffData: staffQuery.data || [],
    isLoading,
    error,
    refetch: () => {
      productionQuery.refetch()
      productionTrendQuery.refetch()
      wasteTrendQuery.refetch()
      inventoryQuery.refetch()
      staffQuery.refetch()
    },
  }
}

// Combined hook for management dashboard data
export const useManagementDashboardData = (timeRange: TimeRange) => {
  const financialQuery = useFinancialData(timeRange)
  const summaryQuery = useSummaryData(timeRange)
  const salesTrendQuery = useTimeSeriesData('sales', timeRange)

  const isLoading =
    financialQuery.isLoading ||
    summaryQuery.isLoading ||
    salesTrendQuery.isLoading

  const error =
    financialQuery.error || summaryQuery.error || salesTrendQuery.error

  return {
    financialData: financialQuery.data || [],
    summary: summaryQuery.data,
    salesTrend: salesTrendQuery.data || [],
    isLoading,
    error,
    refetch: () => {
      financialQuery.refetch()
      summaryQuery.refetch()
      salesTrendQuery.refetch()
    },
  }
}
