/**
 * Dashboard service - business logic for dashboard analytics
 */

import {
  SalesSummary,
  ProductionOverview,
  RevenueAnalytics,
  OrderAnalytics,
  ProductPerformance,
  DailyMetrics,
  DashboardFilters,
  DASHBOARD_CONSTANTS,
  DASHBOARD_ERROR_MESSAGES,
  DailySalesData,
  TopProductData,
  ProductMetricData,
  HourlyOrderData,
  CustomerFrequencyData
} from '../models/dashboard.model';

// Mock data interfaces for in-memory implementation
interface MockOrder {
  id: number;
  customerName: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  items: MockOrderItem[];
}

interface MockOrderItem {
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  price: number;
}

interface MockCashEntry {
  id: number;
  date: string;
  amount: number;
}

interface MockProduct {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface MockUnsoldProduct {
  id: number;
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  value: number;
  date: string;
}

export class DashboardService {
  private mockOrders: MockOrder[] = [];
  private mockCashEntries: MockCashEntry[] = [];
  private mockProducts: MockProduct[] = [];
  private mockUnsoldProducts: MockUnsoldProduct[] = [];

  constructor() {
    this.initializeMockData();
  }

  /**
   * Validate days parameter
   */
  private validateDays(days: number): void {
    if (days < DASHBOARD_CONSTANTS.MIN_DAYS || days > DASHBOARD_CONSTANTS.MAX_DAYS) {
      throw new Error(DASHBOARD_ERROR_MESSAGES.INVALID_DAYS);
    }
  }

  /**
   * Get date range for filtering
   */
  private getDateRange(days: number): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
  }

  /**
   * Filter orders by date range
   */
  private filterOrdersByDateRange(orders: MockOrder[], startDate: Date): MockOrder[] {
    return orders.filter(order => new Date(order.createdAt) >= startDate);
  }

  /**
   * Get sales summary analytics
   */
  async getSalesSummary(filters: DashboardFilters = {}): Promise<SalesSummary> {
    const days = filters.days || DASHBOARD_CONSTANTS.DEFAULT_DAYS;
    this.validateDays(days);

    const { startDate } = this.getDateRange(days);
    const filteredOrders = this.filterOrdersByDateRange(this.mockOrders, startDate);

    // Calculate totals
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    // Daily sales data
    const dailySalesMap = new Map<string, { orders: number; revenue: number }>();
    filteredOrders.forEach(order => {
      const date = order.createdAt.split('T')[0];
      const existing = dailySalesMap.get(date) || { orders: 0, revenue: 0 };
      dailySalesMap.set(date, {
        orders: existing.orders + 1,
        revenue: existing.revenue + order.totalPrice
      });
    });

    const dailySales: DailySalesData[] = Array.from(dailySalesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Status breakdown
    const statusMap = new Map<string, number>();
    filteredOrders.forEach(order => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });

    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      orderCount,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      dailySales,
      statusBreakdown,
      period: `${days} days`
    };
  }

  /**
   * Get production overview analytics
   */
  async getProductionOverview(filters: DashboardFilters = {}): Promise<ProductionOverview> {
    const days = filters.days || DASHBOARD_CONSTANTS.DEFAULT_DAYS;
    this.validateDays(days);

    const { startDate } = this.getDateRange(days);
    const filteredOrders = this.filterOrdersByDateRange(this.mockOrders, startDate);

    // Top products
    const productMap = new Map<string, { name: string; category: string; totalQuantity: number; orderCount: number; revenue: number }>();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.productId}`;
        const existing = productMap.get(key) || {
          name: item.productName,
          category: item.category,
          totalQuantity: 0,
          orderCount: 0,
          revenue: 0
        };
        productMap.set(key, {
          ...existing,
          totalQuantity: existing.totalQuantity + item.quantity,
          orderCount: existing.orderCount + 1,
          revenue: existing.revenue + (item.quantity * item.price)
        });
      });
    });

    const topProducts: TopProductData[] = Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, DASHBOARD_CONSTANTS.TOP_PRODUCTS_LIMIT);

    // Category breakdown
    const categoryMap = new Map<string, { totalQuantity: number; productCount: number; revenue: number }>();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = categoryMap.get(item.category) || { totalQuantity: 0, productCount: 0, revenue: 0 };
        categoryMap.set(item.category, {
          totalQuantity: existing.totalQuantity + item.quantity,
          productCount: existing.productCount + 1,
          revenue: existing.revenue + (item.quantity * item.price)
        });
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Daily production
    const dailyProductionMap = new Map<string, { totalItems: number; uniqueProducts: Set<number> }>();
    filteredOrders.forEach(order => {
      const date = order.createdAt.split('T')[0];
      const existing = dailyProductionMap.get(date) || { totalItems: 0, uniqueProducts: new Set() };
      order.items.forEach(item => {
        existing.totalItems += item.quantity;
        existing.uniqueProducts.add(item.productId);
      });
      dailyProductionMap.set(date, existing);
    });

    const dailyProduction = Array.from(dailyProductionMap.entries())
      .map(([date, data]) => ({
        date,
        totalItems: data.totalItems,
        uniqueProducts: data.uniqueProducts.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      topProducts,
      categoryBreakdown,
      dailyProduction,
      period: `${days} days`
    };
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(filters: DashboardFilters = {}): Promise<RevenueAnalytics> {
    const days = filters.days || DASHBOARD_CONSTANTS.DEFAULT_DAYS;
    this.validateDays(days);

    const { startDate } = this.getDateRange(days);
    const filteredOrders = this.filterOrdersByDateRange(this.mockOrders, startDate);

    // Calculate totals
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);

    // Cash entries for the period
    const startDateStr = startDate.toISOString().split('T')[0];
    const filteredCash = this.mockCashEntries.filter(entry => entry.date >= startDateStr);
    const totalCash = filteredCash.reduce((sum, entry) => sum + entry.amount, 0);

    // Daily cash data
    const dailyCash = filteredCash
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(entry => ({ date: entry.date, amount: entry.amount }));

    // Daily revenue (from orders)
    const dailyRevenueMap = new Map<string, { orders: number; revenue: number }>();
    filteredOrders.forEach(order => {
      const date = order.createdAt.split('T')[0];
      const existing = dailyRevenueMap.get(date) || { orders: 0, revenue: 0 };
      dailyRevenueMap.set(date, {
        orders: existing.orders + 1,
        revenue: existing.revenue + order.totalPrice
      });
    });

    const dailyRevenue: DailySalesData[] = Array.from(dailyRevenueMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Category revenue
    const categoryRevenueMap = new Map<string, { revenue: number; totalQuantity: number; priceSum: number; count: number }>();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = categoryRevenueMap.get(item.category) || { revenue: 0, totalQuantity: 0, priceSum: 0, count: 0 };
        categoryRevenueMap.set(item.category, {
          revenue: existing.revenue + (item.quantity * item.price),
          totalQuantity: existing.totalQuantity + item.quantity,
          priceSum: existing.priceSum + item.price,
          count: existing.count + 1
        });
      });
    });

    const categoryRevenue = Array.from(categoryRevenueMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: Math.round(data.revenue * 100) / 100,
        avgPrice: Math.round((data.priceSum / data.count) * 100) / 100,
        totalQuantity: data.totalQuantity
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCash: Math.round(totalCash * 100) / 100,
      dailyCash,
      dailyRevenue,
      categoryRevenue,
      period: `${days} days`
    };
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(filters: DashboardFilters = {}): Promise<OrderAnalytics> {
    const days = filters.days || DASHBOARD_CONSTANTS.DEFAULT_DAYS;
    this.validateDays(days);

    const { startDate } = this.getDateRange(days);
    const filteredOrders = this.filterOrdersByDateRange(this.mockOrders, startDate);

    // Order metrics
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const orderPrices = filteredOrders.map(order => order.totalPrice);
    const uniqueCustomers = new Set(filteredOrders.map(order => order.customerName)).size;

    const orderMetrics = {
      totalOrders: filteredOrders.length,
      avgOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
      minOrderValue: orderPrices.length > 0 ? Math.min(...orderPrices) : 0,
      maxOrderValue: orderPrices.length > 0 ? Math.max(...orderPrices) : 0,
      uniqueCustomers
    };

    // Hourly distribution
    const hourlyMap = new Map<number, { orders: number; revenue: number }>();
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      const existing = hourlyMap.get(hour) || { orders: 0, revenue: 0 };
      hourlyMap.set(hour, {
        orders: existing.orders + 1,
        revenue: existing.revenue + order.totalPrice
      });
    });

    const hourlyDistribution: HourlyOrderData[] = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour);

    // Customer frequency
    const customerMap = new Map<string, { orderCount: number; totalSpent: number }>();
    filteredOrders.forEach(order => {
      const existing = customerMap.get(order.customerName) || { orderCount: 0, totalSpent: 0 };
      customerMap.set(order.customerName, {
        orderCount: existing.orderCount + 1,
        totalSpent: existing.totalSpent + order.totalPrice
      });
    });

    const customerFrequency: CustomerFrequencyData[] = Array.from(customerMap.entries())
      .map(([customerName, data]) => ({
        customerName,
        orderCount: data.orderCount,
        totalSpent: Math.round(data.totalSpent * 100) / 100,
        avgOrderValue: Math.round((data.totalSpent / data.orderCount) * 100) / 100
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, DASHBOARD_CONSTANTS.TOP_CUSTOMERS_LIMIT);

    // Weekly pattern
    const weeklyMap = new Map<number, { orders: number; revenue: number }>();
    filteredOrders.forEach(order => {
      const dayOfWeek = new Date(order.createdAt).getDay();
      const existing = weeklyMap.get(dayOfWeek) || { orders: 0, revenue: 0 };
      weeklyMap.set(dayOfWeek, {
        orders: existing.orders + 1,
        revenue: existing.revenue + order.totalPrice
      });
    });

    const weeklyPattern = Array.from(weeklyMap.entries())
      .map(([dayOfWeek, data]) => ({ dayOfWeek, ...data }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    return {
      orderMetrics,
      hourlyDistribution,
      customerFrequency,
      weeklyPattern,
      period: `${days} days`
    };
  }

  /**
   * Get product performance analytics
   */
  async getProductPerformance(filters: DashboardFilters = {}): Promise<ProductPerformance> {
    const days = filters.days || DASHBOARD_CONSTANTS.DEFAULT_DAYS;
    this.validateDays(days);

    const { startDate } = this.getDateRange(days);
    const filteredOrders = this.filterOrdersByDateRange(this.mockOrders, startDate);

    // Product metrics
    const productMap = new Map<number, {
      name: string;
      category: string;
      totalQuantity: number;
      totalRevenue: number;
      orderCount: number;
    }>();

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productId) || {
          name: item.productName,
          category: item.category,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0
        };
        productMap.set(item.productId, {
          ...existing,
          totalQuantity: existing.totalQuantity + item.quantity,
          totalRevenue: existing.totalRevenue + (item.quantity * item.price),
          orderCount: existing.orderCount + 1
        });
      });
    });

    const productMetrics: ProductMetricData[] = Array.from(productMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        category: data.category,
        totalQuantity: data.totalQuantity,
        totalRevenue: Math.round(data.totalRevenue * 100) / 100,
        orderCount: data.orderCount,
        avgOrderQuantity: Math.round((data.totalQuantity / data.orderCount) * 100) / 100,
        velocityPerDay: Math.round((data.totalQuantity / days) * 100) / 100
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Slow movers (products with low velocity)
    const slowMovers = productMetrics
      .filter(product => product.velocityPerDay < 1)
      .map(product => ({
        name: product.name,
        quantitySold: product.totalQuantity,
        daysSinceLastOrder: Math.floor(Math.random() * 14) // Mock data
      }))
      .slice(0, 5);

    // Growth trends (mock data for demonstration)
    const growthTrends = productMetrics
      .slice(0, 5)
      .map(product => ({
        productName: product.name,
        currentPeriod: product.totalQuantity,
        previousPeriod: Math.floor(product.totalQuantity * (0.8 + Math.random() * 0.4)),
        growthRate: Math.round(((product.totalQuantity - (product.totalQuantity * 0.9)) / (product.totalQuantity * 0.9)) * 100)
      }));

    return {
      productMetrics,
      slowMovers,
      growthTrends,
      period: `${days} days`
    };
  }

  /**
   * Get daily metrics summary
   */
  async getDailyMetrics(): Promise<DailyMetrics> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Today's orders
    const todayOrders = this.mockOrders.filter(order => order.createdAt.startsWith(today));
    const yesterdayOrders = this.mockOrders.filter(order => order.createdAt.startsWith(yesterdayStr));

    // Calculate metrics
    const todaySales = todayOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const yesterdaySales = yesterdayOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const avgOrderValue = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;

    // Top products today
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productName) || { quantity: 0, revenue: 0 };
        productMap.set(item.productName, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.quantity * item.price)
        });
      });
    });

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Unsold items for today
    const todayUnsold = this.mockUnsoldProducts.filter(item => item.date === today);
    const unsoldItems = {
      totalQuantity: todayUnsold.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: todayUnsold.reduce((sum, item) => sum + item.value, 0),
      items: todayUnsold.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        value: item.value
      }))
    };

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const comparisonWithYesterday = {
      salesChange: calculateChange(todaySales, yesterdaySales),
      ordersChange: calculateChange(todayOrders.length, yesterdayOrders.length)
    };

    return {
      date: today,
      todaySales: Math.round(todaySales * 100) / 100,
      todayOrders: todayOrders.length,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      topProducts,
      unsoldItems,
      comparisonWithYesterday
    };
  }

  /**
   * Initialize mock data for testing
   */
  private initializeMockData(): void {
    // Mock products
    this.mockProducts = [
      { id: 1, name: 'Sauerteigbrot', category: 'Breads', price: 4.50 },
      { id: 2, name: 'Croissant', category: 'Pastries', price: 2.80 },
      { id: 3, name: 'Apfelkuchen', category: 'Cakes', price: 3.20 },
      { id: 4, name: 'Baguette', category: 'Breads', price: 2.20 },
      { id: 5, name: 'Schoko-Croissant', category: 'Pastries', price: 3.50 },
      { id: 6, name: 'Vollkornbrot', category: 'Breads', price: 4.80 },
      { id: 7, name: 'Kaisersemmel', category: 'Rolls', price: 0.80 },
      { id: 8, name: 'Schwarzwälder Kirschtorte', category: 'Cakes', price: 18.50 }
    ];

    // Mock orders (last 60 days)
    const now = new Date();
    for (let i = 0; i < 200; i++) {
      const orderDate = new Date(now);
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 60));
      
      const numItems = 1 + Math.floor(Math.random() * 4);
      const items: MockOrderItem[] = [];
      let totalPrice = 0;

      for (let j = 0; j < numItems; j++) {
        const product = this.mockProducts[Math.floor(Math.random() * this.mockProducts.length)];
        const quantity = 1 + Math.floor(Math.random() * 3);
        const price = product.price * (0.9 + Math.random() * 0.2); // Small price variation

        items.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          quantity,
          price
        });

        totalPrice += quantity * price;
      }

      this.mockOrders.push({
        id: i + 1,
        customerName: `Customer ${Math.floor(Math.random() * 50) + 1}`,
        totalPrice: Math.round(totalPrice * 100) / 100,
        status: Math.random() > 0.1 ? 'completed' : (Math.random() > 0.5 ? 'pending' : 'cancelled'),
        createdAt: orderDate.toISOString(),
        items
      });
    }

    // Mock cash entries (last 60 days)
    for (let i = 0; i < 60; i++) {
      const entryDate = new Date(now);
      entryDate.setDate(entryDate.getDate() - i);
      
      this.mockCashEntries.push({
        id: i + 1,
        date: entryDate.toISOString().split('T')[0],
        amount: Math.round((800 + Math.random() * 400) * 100) / 100
      });
    }

    // Mock unsold products (last 30 days)
    for (let i = 0; i < 30; i++) {
      const entryDate = new Date(now);
      entryDate.setDate(entryDate.getDate() - i);
      
      const product = this.mockProducts[Math.floor(Math.random() * this.mockProducts.length)];
      const quantity = 1 + Math.floor(Math.random() * 5);
      
      this.mockUnsoldProducts.push({
        id: i + 1,
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity,
        value: Math.round(quantity * product.price * 100) / 100,
        date: entryDate.toISOString().split('T')[0]
      });
    }
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();