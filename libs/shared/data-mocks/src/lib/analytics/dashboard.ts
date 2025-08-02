/**
 * @fileoverview Mock dashboard and analytics data
 * @module @bakery/shared/data-mocks/analytics
 */

import {
  SalesData,
  ProductionData,
  InventoryData,
  StaffPerformance,
  CustomerAnalytics,
  FinancialSummary,
  TimeSeriesData,
} from '@bakery/shared/types'
import { ALL_PRODUCTS } from '../products'
import { ALL_ORDERS } from '../orders'
import { MOCK_USERS } from '../users'
import { MOCK_CUSTOMERS } from '../users/customers'

// Generate sales analytics
export const generateSalesAnalytics = (days: number = 30): SalesData => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const relevantOrders = ALL_ORDERS.filter(
    (order) =>
      order.createdAt >= startDate &&
      order.createdAt <= endDate &&
      order.status === 'completed'
  )

  const totalRevenue = relevantOrders.reduce(
    (sum, order) => sum + order.total,
    0
  )
  const totalOrders = relevantOrders.length
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Group by date for time series
  const dailySales: TimeSeriesData[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const dayOrders = relevantOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === date.getTime()
    })

    dailySales.unshift({
      date: date.toISOString().split('T')[0],
      value: dayOrders.reduce((sum, order) => sum + order.total, 0),
      count: dayOrders.length,
    })
  }

  // Product performance
  const productSales = new Map<number, { quantity: number; revenue: number }>()
  relevantOrders.forEach((order) => {
    order.items.forEach((item) => {
      const current = productSales.get(item.productId) || {
        quantity: 0,
        revenue: 0,
      }
      productSales.set(item.productId, {
        quantity: current.quantity + item.quantity,
        revenue: current.revenue + item.total,
      })
    })
  })

  const topProducts = Array.from(productSales.entries())
    .map(([productId, data]) => ({
      productId,
      productName:
        ALL_PRODUCTS.find((p) => p.id === productId)?.name || 'Unknown',
      ...data,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    dailySales,
    topProducts,
    growthRate: calculateGrowthRate(relevantOrders),
    conversionRate: 0.68, // Mock conversion rate
    returningCustomerRate: 0.42,
  }
}

// Generate production analytics
export const generateProductionAnalytics = (
  days: number = 7
): ProductionData => {
  const productionRecords = []
  const endDate = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Generate production data for each active product
    ALL_PRODUCTS.filter((p) => p.isActive).forEach((product) => {
      const produced =
        Math.floor(Math.random() * (product.dailyTarget || 20)) + 10
      const sold = Math.min(
        produced,
        Math.floor(produced * (0.7 + Math.random() * 0.3))
      )
      const waste = Math.floor((produced - sold) * 0.1)

      productionRecords.push({
        date: date.toISOString().split('T')[0],
        productId: product.id,
        productName: product.name,
        produced,
        sold,
        waste,
        efficiency: (sold / produced) * 100,
      })
    })
  }

  const totalProduced = productionRecords.reduce(
    (sum, r) => sum + r.produced,
    0
  )
  const totalSold = productionRecords.reduce((sum, r) => sum + r.sold, 0)
  const totalWaste = productionRecords.reduce((sum, r) => sum + r.waste, 0)

  return {
    totalProduced,
    totalSold,
    totalWaste,
    efficiency: (totalSold / totalProduced) * 100,
    productionRecords,
    wasteReasons: [
      { reason: 'Überproduktion', percentage: 45 },
      { reason: 'Abgelaufen', percentage: 25 },
      { reason: 'Beschädigt', percentage: 20 },
      { reason: 'Qualitätsmängel', percentage: 10 },
    ],
  }
}

// Generate inventory status
export const generateInventoryStatus = (): InventoryData => {
  const inventoryItems = ALL_PRODUCTS.map((product) => {
    const currentStock = product.stock || 0
    const minStock = Math.floor((product.dailyTarget || 10) * 0.5)
    const maxStock = (product.dailyTarget || 10) * 3
    const status =
      currentStock < minStock
        ? 'low'
        : currentStock > maxStock
        ? 'excess'
        : 'optimal'

    return {
      productId: product.id,
      productName: product.name,
      currentStock,
      minStock,
      maxStock,
      status,
      daysUntilReorder: Math.floor(currentStock / (product.dailyTarget || 10)),
      lastRestocked: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ),
    }
  })

  const lowStockItems = inventoryItems.filter(
    (item) => item.status === 'low'
  ).length
  const excessStockItems = inventoryItems.filter(
    (item) => item.status === 'excess'
  ).length
  const totalValue = inventoryItems.reduce((sum, item) => {
    const product = ALL_PRODUCTS.find((p) => p.id === item.productId)
    return sum + item.currentStock * (product?.price || 0)
  }, 0)

  return {
    totalItems: inventoryItems.length,
    lowStockItems,
    excessStockItems,
    totalValue,
    inventoryItems,
    turnoverRate: 4.2, // Mock turnover rate
    averageDaysInStock: 3.5,
  }
}

// Generate staff performance data
export const generateStaffPerformance = (): StaffPerformance => {
  const staffMembers = MOCK_USERS.filter((user) =>
    ['baker', 'cashier', 'delivery'].includes(user.role)
  ).map((user) => {
    const productivity = 70 + Math.random() * 30
    const attendance = 85 + Math.random() * 15
    const rating = 3.5 + Math.random() * 1.5

    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      productivity,
      attendance,
      customerRating: rating,
      tasksCompleted: Math.floor(Math.random() * 50) + 20,
      hoursWorked: Math.floor(Math.random() * 160) + 120,
      overtimeHours: Math.floor(Math.random() * 20),
    }
  })

  const averageProductivity =
    staffMembers.reduce((sum, s) => sum + s.productivity, 0) /
    staffMembers.length
  const averageAttendance =
    staffMembers.reduce((sum, s) => sum + s.attendance, 0) / staffMembers.length

  return {
    totalStaff: staffMembers.length,
    averageProductivity,
    averageAttendance,
    staffMembers,
    departmentStats: [
      { department: 'Produktion', staffCount: 4, productivity: 88.5 },
      { department: 'Verkauf', staffCount: 3, productivity: 92.3 },
      { department: 'Lieferung', staffCount: 2, productivity: 85.7 },
    ],
  }
}

// Generate customer analytics
export const generateCustomerAnalytics = (): CustomerAnalytics => {
  const activeCustomers = MOCK_CUSTOMERS.filter((c) => c.isActive)
  const newCustomers = activeCustomers.filter((c) => {
    const daysSinceRegistration =
      (Date.now() - c.registeredAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceRegistration <= 30
  })

  const customerSegments = [
    { segment: 'Premium', count: 3, revenue: 58000, percentage: 15 },
    { segment: 'Regular', count: 8, revenue: 32000, percentage: 40 },
    { segment: 'Gelegenheit', count: 6, revenue: 12000, percentage: 30 },
    { segment: 'Neu', count: 3, revenue: 3000, percentage: 15 },
  ]

  const satisfactionScores = {
    overall: 4.3,
    product: 4.5,
    service: 4.2,
    delivery: 4.1,
    price: 3.9,
  }

  return {
    totalCustomers: MOCK_CUSTOMERS.length,
    activeCustomers: activeCustomers.length,
    newCustomers: newCustomers.length,
    churnRate: 5.2,
    lifetimeValue: 1250.5,
    customerSegments,
    satisfactionScores,
    topCustomers: activeCustomers
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map((c) => ({
        customerId: c.id,
        name: c.name,
        totalSpent: c.totalSpent,
        orderCount: c.totalOrders,
      })),
  }
}

// Generate financial summary
export const generateFinancialSummary = (
  days: number = 30
): FinancialSummary => {
  const sales = generateSalesAnalytics(days)
  const production = generateProductionAnalytics(days)

  const revenue = sales.totalRevenue
  const costs = revenue * 0.65 // Mock COGS at 65%
  const grossProfit = revenue - costs
  const operatingExpenses = revenue * 0.2 // Mock operating expenses at 20%
  const netProfit = grossProfit - operatingExpenses

  const cashFlow = [
    { category: 'Verkäufe', amount: revenue },
    { category: 'Materialkosten', amount: -costs * 0.4 },
    { category: 'Personalkosten', amount: -costs * 0.3 },
    { category: 'Betriebskosten', amount: -operatingExpenses },
    { category: 'Sonstige', amount: -costs * 0.3 },
  ]

  return {
    revenue,
    costs,
    grossProfit,
    grossMargin: (grossProfit / revenue) * 100,
    operatingExpenses,
    netProfit,
    netMargin: (netProfit / revenue) * 100,
    cashFlow,
    profitTrend: generateTrendData(30, 'profit'),
    expenseBreakdown: [
      { category: 'Material', amount: costs * 0.4, percentage: 40 },
      { category: 'Personal', amount: costs * 0.3, percentage: 30 },
      { category: 'Miete', amount: operatingExpenses * 0.3, percentage: 6 },
      { category: 'Energie', amount: operatingExpenses * 0.2, percentage: 4 },
      { category: 'Marketing', amount: operatingExpenses * 0.2, percentage: 4 },
      { category: 'Sonstige', amount: operatingExpenses * 0.3, percentage: 16 },
    ],
  }
}

// Helper functions
const calculateGrowthRate = (orders: Order[]): number => {
  if (orders.length === 0) return 0

  const midPoint = Math.floor(orders.length / 2)
  const firstHalf = orders.slice(0, midPoint)
  const secondHalf = orders.slice(midPoint)

  const firstHalfRevenue = firstHalf.reduce((sum, o) => sum + o.total, 0)
  const secondHalfRevenue = secondHalf.reduce((sum, o) => sum + o.total, 0)

  if (firstHalfRevenue === 0) return 0
  return ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
}

const generateTrendData = (days: number, type: string): TimeSeriesData[] => {
  const trend: TimeSeriesData[] = []
  let baseValue = type === 'profit' ? 500 : 1000

  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Add some randomness with upward trend
    baseValue = baseValue * (0.98 + Math.random() * 0.05)

    trend.push({
      date: date.toISOString().split('T')[0],
      value: baseValue,
    })
  }

  return trend
}

// Export pre-generated summaries for quick access
export const DASHBOARD_SUMMARY = {
  sales: generateSalesAnalytics(30),
  production: generateProductionAnalytics(7),
  inventory: generateInventoryStatus(),
  staff: generateStaffPerformance(),
  customers: generateCustomerAnalytics(),
  financial: generateFinancialSummary(30),
}
