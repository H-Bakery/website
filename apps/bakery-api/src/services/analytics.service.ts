/**
 * Analytics Service
 * Comprehensive business analytics for the bakery management system
 */

import { Op, QueryTypes } from 'sequelize'
import {
  Order,
  OrderItem,
  Product,
  Cash,
  UnsoldProduct,
  User,
  sequelize,
} from '../models'
import { logger } from '../utils/logger'

export interface AnalyticsFilters {
  startDate?: Date | string
  endDate?: Date | string
  category?: string
  customerId?: number
  productId?: number
  groupBy?: 'day' | 'week' | 'month' | 'year'
  limit?: number
}

export interface RevenueMetrics {
  totalRevenue: number
  orderCount: number
  averageOrderValue: number
  revenueGrowth: number
  dailyRevenue: Array<{
    date: string
    revenue: number
    orders: number
  }>
  categoryRevenue: Array<{
    category: string
    revenue: number
    percentage: number
  }>
  paymentMethodBreakdown: Array<{
    method: string
    amount: number
    percentage: number
  }>
}

export interface ProductPerformanceMetrics {
  topProducts: Array<{
    id: number
    name: string
    category: string
    totalQuantity: number
    revenue: number
    orderCount: number
    averagePrice: number
  }>
  categoryPerformance: Array<{
    category: string
    totalQuantity: number
    revenue: number
    productCount: number
    growthRate: number
  }>
  slowMovingProducts: Array<{
    id: number
    name: string
    daysInInventory: number
    lastSoldDate: Date | null
  }>
  productTrends: Array<{
    productId: number
    productName: string
    trend: 'up' | 'down' | 'stable'
    changePercent: number
  }>
}

export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  topCustomers: Array<{
    id: number
    name: string
    orderCount: number
    totalSpent: number
    averageOrderValue: number
    lastOrderDate: Date
  }>
  customerSegments: Array<{
    segment: string
    count: number
    avgValue: number
    totalRevenue: number
  }>
  customerRetention: {
    rate: number
    churnRate: number
    averageLifetimeValue: number
  }
  orderFrequency: Array<{
    frequency: string
    customerCount: number
    percentage: number
  }>
}

export interface OperationalMetrics {
  peakHours: Array<{
    hour: number
    orderCount: number
    avgOrderValue: number
  }>
  dayOfWeekAnalysis: Array<{
    day: string
    orderCount: number
    revenue: number
    avgOrderValue: number
  }>
  staffPerformance: Array<{
    staffId: number
    staffName: string
    ordersProcessed: number
    totalRevenue: number
    avgProcessingTime: number
  }>
  wasteAnalysis: {
    totalWaste: number
    wasteValue: number
    wasteByCategory: Array<{
      category: string
      quantity: number
      value: number
    }>
  }
}

export interface BusinessSummary {
  revenue: {
    total: number
    growth: number
    projection: number
  }
  orders: {
    total: number
    average: number
    completed: number
    cancelled: number
  }
  products: {
    totalSold: number
    uniqueProducts: number
    outOfStock: number
  }
  customers: {
    total: number
    new: number
    returning: number
    churnRate: number
  }
  period: {
    start: string
    end: string
    days: number
  }
}

class AnalyticsService {
  // ============================================================================
  // REVENUE ANALYTICS
  // ============================================================================

  /**
   * Get comprehensive revenue analytics
   */
  async getRevenueAnalytics(filters: AnalyticsFilters = {}): Promise<RevenueMetrics> {
    try {
      const { startDate, endDate, groupBy = 'day' } = filters

      logger.info('Calculating revenue analytics', { startDate, endDate, groupBy })

      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Total revenue and order count
      const totalMetrics = await Order.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalRevenue'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount'],
          [sequelize.fn('AVG', sequelize.col('totalPrice')), 'avgOrderValue'],
        ],
        where: {
          createdAt: {
            [Op.between]: [start, end],
          },
          status: {
            [Op.ne]: 'cancelled',
          },
        },
        raw: true,
      })

      // Daily revenue breakdown
      const dailyRevenue = await this.getDailyRevenue(start, end)

      // Revenue by category
      const categoryRevenue = await this.getCategoryRevenue(start, end)

      // Payment method breakdown
      const paymentBreakdown = await this.getPaymentMethodBreakdown(start, end)

      // Calculate growth rate
      const previousPeriodStart = new Date(start.getTime() - (end.getTime() - start.getTime()))
      const previousRevenue = await Order.sum('totalPrice', {
        where: {
          createdAt: {
            [Op.between]: [previousPeriodStart, start],
          },
          status: {
            [Op.ne]: 'cancelled',
          },
        },
      })

      const currentRevenue = Number(totalMetrics?.totalRevenue) || 0
      const growthRate = previousRevenue
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0

      return {
        totalRevenue: currentRevenue,
        orderCount: Number(totalMetrics?.orderCount) || 0,
        averageOrderValue: Number(totalMetrics?.avgOrderValue) || 0,
        revenueGrowth: Math.round(growthRate * 100) / 100,
        dailyRevenue,
        categoryRevenue,
        paymentMethodBreakdown: paymentBreakdown,
      }
    } catch (error) {
      logger.error('Error calculating revenue analytics:', error)
      throw error
    }
  }

  /**
   * Get daily revenue data
   */
  private async getDailyRevenue(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as orders,
        COALESCE(SUM(totalPrice), 0) as revenue
      FROM Orders 
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt) ASC
    `,
      {
        replacements: { 
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      date: row.date,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
    }))
  }

  /**
   * Get revenue by category
   */
  private async getCategoryRevenue(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        p.category,
        SUM(oi.quantity * oi.price) as revenue
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      JOIN Products p ON oi.ProductId = p.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
      GROUP BY p.category
      ORDER BY revenue DESC
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const totalRevenue = results.reduce((sum: number, row: any) => sum + parseFloat(row.revenue), 0)

    return results.map((row: any) => ({
      category: row.category,
      revenue: parseFloat(row.revenue) || 0,
      percentage: totalRevenue > 0 ? Math.round((parseFloat(row.revenue) / totalRevenue) * 10000) / 100 : 0,
    }))
  }

  /**
   * Get payment method breakdown
   */
  private async getPaymentMethodBreakdown(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        paymentMethod as method,
        COUNT(*) as count,
        SUM(totalPrice) as amount
      FROM Orders 
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
      GROUP BY paymentMethod
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const totalAmount = results.reduce((sum: number, row: any) => sum + parseFloat(row.amount), 0)

    return results.map((row: any) => ({
      method: row.method || 'Unknown',
      amount: parseFloat(row.amount) || 0,
      percentage: totalAmount > 0 ? Math.round((parseFloat(row.amount) / totalAmount) * 10000) / 100 : 0,
    }))
  }

  // ============================================================================
  // PRODUCT PERFORMANCE ANALYTICS
  // ============================================================================

  /**
   * Get product performance metrics
   */
  async getProductPerformance(filters: AnalyticsFilters = {}): Promise<ProductPerformanceMetrics> {
    try {
      const { startDate, endDate, category, limit = 10 } = filters

      logger.info('Calculating product performance', { startDate, endDate, category })

      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Top selling products
      const topProducts = await this.getTopProducts(start, end, category, limit)

      // Category performance
      const categoryPerformance = await this.getCategoryPerformance(start, end)

      // Slow moving products
      const slowMovingProducts = await this.getSlowMovingProducts(start, end)

      // Product trends
      const productTrends = await this.getProductTrends(start, end)

      return {
        topProducts,
        categoryPerformance,
        slowMovingProducts,
        productTrends,
      }
    } catch (error) {
      logger.error('Error calculating product performance:', error)
      throw error
    }
  }

  /**
   * Get top selling products
   */
  private async getTopProducts(startDate: Date, endDate: Date, category?: string, limit: number = 10) {
    let categoryFilter = ''
    const replacements: any = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
    }

    if (category) {
      categoryFilter = 'AND p.category = :category'
      replacements.category = category
    }

    const results = await sequelize.query(
      `
      SELECT 
        p.id,
        p.name,
        p.category,
        SUM(oi.quantity) as totalQuantity,
        COUNT(DISTINCT o.id) as orderCount,
        SUM(oi.quantity * oi.price) as revenue,
        AVG(oi.price) as averagePrice
      FROM Products p
      JOIN OrderItems oi ON p.id = oi.ProductId
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
        ${categoryFilter}
      GROUP BY p.id, p.name, p.category
      ORDER BY totalQuantity DESC
      LIMIT :limit
    `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      totalQuantity: parseInt(row.totalQuantity) || 0,
      revenue: parseFloat(row.revenue) || 0,
      orderCount: parseInt(row.orderCount) || 0,
      averagePrice: parseFloat(row.averagePrice) || 0,
    }))
  }

  /**
   * Get category performance metrics
   */
  private async getCategoryPerformance(startDate: Date, endDate: Date) {
    const current = await sequelize.query(
      `
      SELECT 
        p.category,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.quantity * oi.price) as revenue,
        COUNT(DISTINCT p.id) as productCount
      FROM Products p
      JOIN OrderItems oi ON p.id = oi.ProductId
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
      GROUP BY p.category
      ORDER BY revenue DESC
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    // Calculate growth rates
    const periodLength = endDate.getTime() - startDate.getTime()
    const previousStart = new Date(startDate.getTime() - periodLength)
    const previousEnd = startDate

    const previous = await sequelize.query(
      `
      SELECT 
        p.category,
        SUM(oi.quantity * oi.price) as revenue
      FROM Products p
      JOIN OrderItems oi ON p.id = oi.ProductId
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
      GROUP BY p.category
    `,
      {
        replacements: {
          startDate: previousStart.toISOString(),
          endDate: previousEnd.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const previousMap = new Map(previous.map((row: any) => [row.category, parseFloat(row.revenue)]))

    return current.map((row: any) => {
      const currentRevenue = parseFloat(row.revenue)
      const previousRevenue = previousMap.get(row.category) || 0
      const growthRate = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0

      return {
        category: row.category,
        totalQuantity: parseInt(row.totalQuantity) || 0,
        revenue: currentRevenue,
        productCount: parseInt(row.productCount) || 0,
        growthRate: Math.round(growthRate * 100) / 100,
      }
    })
  }

  /**
   * Get slow moving products
   */
  private async getSlowMovingProducts(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        p.id,
        p.name,
        MAX(o.createdAt) as lastSoldDate,
        JULIANDAY('now') - JULIANDAY(MAX(o.createdAt)) as daysInInventory
      FROM Products p
      LEFT JOIN OrderItems oi ON p.id = oi.ProductId
      LEFT JOIN Orders o ON oi.OrderId = o.id AND o.status != 'cancelled'
      WHERE p.stockQuantity > 0
      GROUP BY p.id, p.name
      HAVING lastSoldDate IS NULL OR lastSoldDate < :startDate
      ORDER BY daysInInventory DESC
      LIMIT 20
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      id: row.id,
      name: row.name,
      daysInInventory: Math.round(row.daysInInventory) || 0,
      lastSoldDate: row.lastSoldDate ? new Date(row.lastSoldDate) : null,
    }))
  }

  /**
   * Get product sales trends
   */
  private async getProductTrends(startDate: Date, endDate: Date) {
    const periodLength = endDate.getTime() - startDate.getTime()
    const midPoint = new Date(startDate.getTime() + periodLength / 2)

    const firstHalf = await sequelize.query(
      `
      SELECT 
        p.id as productId,
        p.name as productName,
        SUM(oi.quantity) as quantity
      FROM Products p
      JOIN OrderItems oi ON p.id = oi.ProductId
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt < :midPoint
        AND o.status != 'cancelled'
      GROUP BY p.id, p.name
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          midPoint: midPoint.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const secondHalf = await sequelize.query(
      `
      SELECT 
        p.id as productId,
        p.name as productName,
        SUM(oi.quantity) as quantity
      FROM Products p
      JOIN OrderItems oi ON p.id = oi.ProductId
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :midPoint
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
      GROUP BY p.id, p.name
    `,
      {
        replacements: {
          midPoint: midPoint.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const firstHalfMap = new Map(firstHalf.map((row: any) => [row.productId, parseInt(row.quantity)]))
    
    return secondHalf.map((row: any) => {
      const currentQuantity = parseInt(row.quantity)
      const previousQuantity = firstHalfMap.get(row.productId) || 0
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let changePercent = 0

      if (previousQuantity > 0) {
        changePercent = ((currentQuantity - previousQuantity) / previousQuantity) * 100
        if (changePercent > 10) trend = 'up'
        else if (changePercent < -10) trend = 'down'
      } else if (currentQuantity > 0) {
        trend = 'up'
        changePercent = 100
      }

      return {
        productId: row.productId,
        productName: row.productName,
        trend,
        changePercent: Math.round(changePercent * 100) / 100,
      }
    }).filter(item => Math.abs(item.changePercent) > 5) // Only show significant changes
  }

  // ============================================================================
  // CUSTOMER ANALYTICS
  // ============================================================================

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(filters: AnalyticsFilters = {}): Promise<CustomerAnalytics> {
    try {
      const { startDate, endDate } = filters

      logger.info('Calculating customer analytics', { startDate, endDate })

      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Customer counts
      const customerCounts = await this.getCustomerCounts(start, end)

      // Top customers
      const topCustomers = await this.getTopCustomers(start, end)

      // Customer segments
      const customerSegments = await this.getCustomerSegments(start, end)

      // Customer retention
      const customerRetention = await this.getCustomerRetention(start, end)

      // Order frequency distribution
      const orderFrequency = await this.getOrderFrequencyDistribution(start, end)

      return {
        totalCustomers: customerCounts.total,
        newCustomers: customerCounts.new,
        returningCustomers: customerCounts.returning,
        topCustomers,
        customerSegments,
        customerRetention,
        orderFrequency,
      }
    } catch (error) {
      logger.error('Error calculating customer analytics:', error)
      throw error
    }
  }

  /**
   * Get customer counts
   */
  private async getCustomerCounts(startDate: Date, endDate: Date) {
    const totalResult = await sequelize.query(
      `
      SELECT COUNT(DISTINCT customerName) as total
      FROM Orders
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const newResult = await sequelize.query(
      `
      SELECT COUNT(DISTINCT customerName) as new
      FROM Orders o1
      WHERE o1.createdAt >= :startDate
        AND o1.createdAt <= :endDate
        AND o1.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM Orders o2
          WHERE o2.customerName = o1.customerName
          AND o2.createdAt < :startDate
        )
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const total = (totalResult[0] as any)?.total || 0
    const newCustomers = (newResult[0] as any)?.new || 0

    return {
      total,
      new: newCustomers,
      returning: total - newCustomers,
    }
  }

  /**
   * Get top customers
   */
  private async getTopCustomers(startDate: Date, endDate: Date, limit: number = 10) {
    const results = await sequelize.query(
      `
      SELECT 
        customerName as name,
        COUNT(*) as orderCount,
        SUM(totalPrice) as totalSpent,
        AVG(totalPrice) as averageOrderValue,
        MAX(createdAt) as lastOrderDate
      FROM Orders 
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
        AND customerName IS NOT NULL
      GROUP BY customerName
      ORDER BY totalSpent DESC
      LIMIT :limit
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit,
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any, index: number) => ({
      id: index + 1, // Since we don't have customer IDs, use index
      name: row.name,
      orderCount: parseInt(row.orderCount) || 0,
      totalSpent: parseFloat(row.totalSpent) || 0,
      averageOrderValue: parseFloat(row.averageOrderValue) || 0,
      lastOrderDate: new Date(row.lastOrderDate),
    }))
  }

  /**
   * Get customer segments
   */
  private async getCustomerSegments(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        CASE 
          WHEN orderCount = 1 THEN 'One-time'
          WHEN orderCount BETWEEN 2 AND 5 THEN 'Regular'
          WHEN orderCount > 5 THEN 'Loyal'
        END as segment,
        COUNT(*) as count,
        AVG(avgValue) as avgValue,
        SUM(totalRevenue) as totalRevenue
      FROM (
        SELECT 
          customerName,
          COUNT(*) as orderCount,
          AVG(totalPrice) as avgValue,
          SUM(totalPrice) as totalRevenue
        FROM Orders
        WHERE createdAt >= :startDate
          AND createdAt <= :endDate
          AND status != 'cancelled'
          AND customerName IS NOT NULL
        GROUP BY customerName
      ) as customer_stats
      GROUP BY segment
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      segment: row.segment,
      count: parseInt(row.count) || 0,
      avgValue: parseFloat(row.avgValue) || 0,
      totalRevenue: parseFloat(row.totalRevenue) || 0,
    }))
  }

  /**
   * Get customer retention metrics
   */
  private async getCustomerRetention(startDate: Date, endDate: Date) {
    const periodLength = endDate.getTime() - startDate.getTime()
    const previousStart = new Date(startDate.getTime() - periodLength)

    // Customers from previous period
    const previousCustomers = await sequelize.query(
      `
      SELECT DISTINCT customerName
      FROM Orders
      WHERE createdAt >= :previousStart
        AND createdAt < :startDate
        AND status != 'cancelled'
        AND customerName IS NOT NULL
    `,
      {
        replacements: {
          previousStart: previousStart.toISOString(),
          startDate: startDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    // Customers who returned in current period
    const returnedCustomers = await sequelize.query(
      `
      SELECT COUNT(DISTINCT customerName) as returned
      FROM Orders
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
        AND customerName IN (:customers)
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          customers: previousCustomers.map((c: any) => c.customerName),
        },
        type: QueryTypes.SELECT,
      }
    )

    const previousCount = previousCustomers.length
    const returnedCount = (returnedCustomers[0] as any)?.returned || 0
    const retentionRate = previousCount > 0 ? (returnedCount / previousCount) * 100 : 0

    // Average lifetime value
    const lifetimeValue = await sequelize.query(
      `
      SELECT AVG(totalSpent) as avgLifetimeValue
      FROM (
        SELECT 
          customerName,
          SUM(totalPrice) as totalSpent
        FROM Orders
        WHERE status != 'cancelled'
          AND customerName IS NOT NULL
        GROUP BY customerName
      ) as customer_totals
    `,
      {
        type: QueryTypes.SELECT,
      }
    )

    return {
      rate: Math.round(retentionRate * 100) / 100,
      churnRate: Math.round((100 - retentionRate) * 100) / 100,
      averageLifetimeValue: parseFloat((lifetimeValue[0] as any)?.avgLifetimeValue) || 0,
    }
  }

  /**
   * Get order frequency distribution
   */
  private async getOrderFrequencyDistribution(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        CASE 
          WHEN orderCount = 1 THEN 'Once'
          WHEN orderCount = 2 THEN 'Twice'
          WHEN orderCount BETWEEN 3 AND 5 THEN '3-5 times'
          WHEN orderCount BETWEEN 6 AND 10 THEN '6-10 times'
          ELSE 'More than 10'
        END as frequency,
        COUNT(*) as customerCount
      FROM (
        SELECT 
          customerName,
          COUNT(*) as orderCount
        FROM Orders
        WHERE createdAt >= :startDate
          AND createdAt <= :endDate
          AND status != 'cancelled'
          AND customerName IS NOT NULL
        GROUP BY customerName
      ) as customer_orders
      GROUP BY frequency
      ORDER BY 
        CASE frequency
          WHEN 'Once' THEN 1
          WHEN 'Twice' THEN 2
          WHEN '3-5 times' THEN 3
          WHEN '6-10 times' THEN 4
          ELSE 5
        END
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const total = results.reduce((sum: number, row: any) => sum + parseInt(row.customerCount), 0)

    return results.map((row: any) => ({
      frequency: row.frequency,
      customerCount: parseInt(row.customerCount) || 0,
      percentage: total > 0 ? Math.round((parseInt(row.customerCount) / total) * 10000) / 100 : 0,
    }))
  }

  // ============================================================================
  // OPERATIONAL ANALYTICS
  // ============================================================================

  /**
   * Get operational metrics
   */
  async getOperationalMetrics(filters: AnalyticsFilters = {}): Promise<OperationalMetrics> {
    try {
      const { startDate, endDate } = filters

      logger.info('Calculating operational metrics', { startDate, endDate })

      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Peak hours analysis
      const peakHours = await this.getPeakHours(start, end)

      // Day of week analysis
      const dayOfWeekAnalysis = await this.getDayOfWeekAnalysis(start, end)

      // Staff performance
      const staffPerformance = await this.getStaffPerformance(start, end)

      // Waste analysis
      const wasteAnalysis = await this.getWasteAnalysis(start, end)

      return {
        peakHours,
        dayOfWeekAnalysis,
        staffPerformance,
        wasteAnalysis,
      }
    } catch (error) {
      logger.error('Error calculating operational metrics:', error)
      throw error
    }
  }

  /**
   * Get peak hours analysis
   */
  private async getPeakHours(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        CAST(strftime('%H', createdAt) AS INTEGER) as hour,
        COUNT(*) as orderCount,
        AVG(totalPrice) as avgOrderValue
      FROM Orders 
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
      GROUP BY CAST(strftime('%H', createdAt) AS INTEGER)
      ORDER BY hour ASC
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      hour: row.hour,
      orderCount: parseInt(row.orderCount) || 0,
      avgOrderValue: parseFloat(row.avgOrderValue) || 0,
    }))
  }

  /**
   * Get day of week analysis
   */
  private async getDayOfWeekAnalysis(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        CASE CAST(strftime('%w', createdAt) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        COUNT(*) as orderCount,
        SUM(totalPrice) as revenue,
        AVG(totalPrice) as avgOrderValue
      FROM Orders 
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
        AND status != 'cancelled'
      GROUP BY CAST(strftime('%w', createdAt) AS INTEGER)
      ORDER BY CAST(strftime('%w', createdAt) AS INTEGER) ASC
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      day: row.day,
      orderCount: parseInt(row.orderCount) || 0,
      revenue: parseFloat(row.revenue) || 0,
      avgOrderValue: parseFloat(row.avgOrderValue) || 0,
    }))
  }

  /**
   * Get staff performance metrics
   */
  private async getStaffPerformance(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        o.staffId,
        u.username as staffName,
        COUNT(o.id) as ordersProcessed,
        SUM(o.totalPrice) as totalRevenue,
        AVG(
          CASE 
            WHEN o.completedAt IS NOT NULL 
            THEN (JULIANDAY(o.completedAt) - JULIANDAY(o.createdAt)) * 24 * 60
            ELSE NULL
          END
        ) as avgProcessingTime
      FROM Orders o
      LEFT JOIN Users u ON o.staffId = u.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
        AND o.staffId IS NOT NULL
      GROUP BY o.staffId, u.username
      ORDER BY totalRevenue DESC
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    return results.map((row: any) => ({
      staffId: row.staffId,
      staffName: row.staffName || 'Unknown',
      ordersProcessed: parseInt(row.ordersProcessed) || 0,
      totalRevenue: parseFloat(row.totalRevenue) || 0,
      avgProcessingTime: row.avgProcessingTime ? Math.round(row.avgProcessingTime) : 0,
    }))
  }

  /**
   * Get waste analysis
   */
  private async getWasteAnalysis(startDate: Date, endDate: Date) {
    const wasteData = await UnsoldProduct.findAll({
      where: {
        recordDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name', 'category', 'price'],
        },
      ],
    })

    const totalQuantity = wasteData.reduce((sum, item) => sum + item.quantity, 0)
    const totalValue = wasteData.reduce(
      (sum, item) => sum + item.quantity * (item.product?.price || 0),
      0
    )

    // Group by category
    const categoryMap = new Map<string, { quantity: number; value: number }>()
    
    wasteData.forEach((item) => {
      const category = item.product?.category || 'Unknown'
      const existing = categoryMap.get(category) || { quantity: 0, value: 0 }
      existing.quantity += item.quantity
      existing.value += item.quantity * (item.product?.price || 0)
      categoryMap.set(category, existing)
    })

    const wasteByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      quantity: data.quantity,
      value: Math.round(data.value * 100) / 100,
    }))

    return {
      totalWaste: totalQuantity,
      wasteValue: Math.round(totalValue * 100) / 100,
      wasteByCategory,
    }
  }

  // ============================================================================
  // BUSINESS SUMMARY
  // ============================================================================

  /**
   * Get comprehensive business summary
   */
  async getBusinessSummary(filters: AnalyticsFilters = {}): Promise<BusinessSummary> {
    try {
      const { startDate, endDate } = filters

      logger.info('Generating business summary', { startDate, endDate })

      const end = endDate ? new Date(endDate) : new Date()
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Revenue metrics
      const revenueMetrics = await this.getRevenueAnalytics({ startDate: start, endDate: end })

      // Order metrics
      const orderMetrics = await this.getOrderMetrics(start, end)

      // Product metrics
      const productMetrics = await this.getProductMetrics(start, end)

      // Customer metrics
      const customerAnalytics = await this.getCustomerAnalytics({ startDate: start, endDate: end })

      // Calculate revenue projection (simple linear projection)
      const dailyAverage = revenueMetrics.totalRevenue / ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const projection = dailyAverage * 30 // 30-day projection

      return {
        revenue: {
          total: revenueMetrics.totalRevenue,
          growth: revenueMetrics.revenueGrowth,
          projection: Math.round(projection * 100) / 100,
        },
        orders: orderMetrics,
        products: productMetrics,
        customers: {
          total: customerAnalytics.totalCustomers,
          new: customerAnalytics.newCustomers,
          returning: customerAnalytics.returningCustomers,
          churnRate: customerAnalytics.customerRetention.churnRate,
        },
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
        },
      }
    } catch (error) {
      logger.error('Error generating business summary:', error)
      throw error
    }
  }

  /**
   * Get order metrics for summary
   */
  private async getOrderMetrics(startDate: Date, endDate: Date) {
    const results = await sequelize.query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        AVG(CASE WHEN status != 'cancelled' THEN totalPrice END) as average
      FROM Orders
      WHERE createdAt >= :startDate
        AND createdAt <= :endDate
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const data = results[0] as any

    return {
      total: parseInt(data.total) || 0,
      average: parseFloat(data.average) || 0,
      completed: parseInt(data.completed) || 0,
      cancelled: parseInt(data.cancelled) || 0,
    }
  }

  /**
   * Get product metrics for summary
   */
  private async getProductMetrics(startDate: Date, endDate: Date) {
    const soldResults = await sequelize.query(
      `
      SELECT 
        SUM(oi.quantity) as totalSold,
        COUNT(DISTINCT oi.ProductId) as uniqueProducts
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
        AND o.createdAt <= :endDate
        AND o.status != 'cancelled'
    `,
      {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )

    const outOfStock = await Product.count({
      where: {
        stockQuantity: 0,
      },
    })

    const soldData = soldResults[0] as any

    return {
      totalSold: parseInt(soldData.totalSold) || 0,
      uniqueProducts: parseInt(soldData.uniqueProducts) || 0,
      outOfStock,
    }
  }
}

export default new AnalyticsService()