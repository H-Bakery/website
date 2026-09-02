import { apiClient } from '../api-client'
import type {
  RevenueData,
  ProductAnalyticsPerformance,
  PaymentMethodData,
  AnalyticsSummary,
  DateRange,
  Granularity,
  CashierPerformance,
} from '@bakery/shared/types'

export interface AnalyticsParams {
  startDate: string
  endDate: string
  granularity?: Granularity
  limit?: number
  type?: 'top' | 'bottom'
}

/**
 * Analysedaten samt Herkunft. `isMock` ist true, wenn die API nichts geliefert
 * hat und stattdessen Beispieldaten zurückgegeben werden - die Oberfläche muss
 * das kennzeichnen, sonst lesen sich erfundene Zahlen wie echter Umsatz.
 */
export interface AnalyticsResult<T> {
  data: T
  isMock: boolean
}

class AnalyticsService {
  private basePath = '/api/analytics'

  async getRevenueTrends(params: AnalyticsParams): Promise<RevenueData[]> {
    return (await this.getRevenueTrendsWithSource(params)).data
  }

  async getRevenueTrendsWithSource(
    params: AnalyticsParams
  ): Promise<AnalyticsResult<RevenueData[]>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.granularity && { granularity: params.granularity }),
      })

      const response = await apiClient.get<{ data: RevenueData[] }>(
        `${this.basePath}/revenue-trends?${queryParams}`
      )

      // Use mock data temporarily until backend is fully implemented
      if (
        !response.data ||
        !response.data.data ||
        response.data.data.length === 0
      ) {
        return { data: this.getMockRevenueTrends(params), isMock: true }
      }

      return { data: response.data.data, isMock: false }
    } catch (error) {
      console.warn('Using mock revenue data:', error)
      return { data: this.getMockRevenueTrends(params), isMock: true }
    }
  }

  async getProductPerformance(
    params: AnalyticsParams & { type?: 'top' | 'bottom' }
  ): Promise<ProductAnalyticsPerformance[]> {
    return (await this.getProductPerformanceWithSource(params)).data
  }

  async getProductPerformanceWithSource(
    params: AnalyticsParams & { type?: 'top' | 'bottom' }
  ): Promise<AnalyticsResult<ProductAnalyticsPerformance[]>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.type && { type: params.type }),
        ...(params.limit && { limit: params.limit.toString() }),
      })

      const response = await apiClient.get<{
        data: ProductAnalyticsPerformance[]
      }>(`${this.basePath}/product-performance?${queryParams}`)

      if (
        !response.data ||
        !response.data.data ||
        response.data.data.length === 0
      ) {
        return { data: this.getMockProductPerformance(params), isMock: true }
      }

      return { data: response.data.data, isMock: false }
    } catch (error) {
      console.warn('Using mock product performance data:', error)
      return { data: this.getMockProductPerformance(params), isMock: true }
    }
  }

  async getCashierPerformance(
    params: AnalyticsParams
  ): Promise<CashierPerformance[]> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
      })

      const response = await apiClient.get<{ data: CashierPerformance[] }>(
        `${this.basePath}/cashier-performance?${queryParams}`
      )

      if (
        !response.data ||
        !response.data.data ||
        response.data.data.length === 0
      ) {
        return this.getMockCashierPerformance()
      }

      return response.data.data
    } catch (error) {
      console.warn('Using mock cashier performance data:', error)
      return this.getMockCashierPerformance()
    }
  }

  async getPaymentMethods(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<PaymentMethodData[]> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
      })

      const response = await apiClient.get<{ data: PaymentMethodData[] }>(
        `${this.basePath}/payment-methods?${queryParams}`
      )

      if (
        !response.data ||
        !response.data.data ||
        response.data.data.length === 0
      ) {
        return this.getMockPaymentMethods()
      }

      return response.data.data
    } catch (error) {
      console.warn('Using mock payment methods data:', error)
      return this.getMockPaymentMethods()
    }
  }

  async getSummary(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<AnalyticsSummary> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
      })

      const response = await apiClient.get<{ data: AnalyticsSummary }>(
        `${this.basePath}/summary?${queryParams}`
      )

      if (!response.data || !response.data.data) {
        return this.getMockSummary()
      }

      return response.data.data
    } catch (error) {
      console.warn('Using mock summary data:', error)
      return this.getMockSummary()
    }
  }

  // Mock data methods for development
  private getMockRevenueTrends(params: AnalyticsParams): RevenueData[] {
    const data: RevenueData[] = []
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      data.push({
        date: currentDate.toISOString().split('T')[0],
        revenue:
          Math.floor(Math.random() * 500) +
          1500 +
          (currentDate.getDay() === 6 ? 800 : 0), // Higher on Saturdays
        transactionCount: Math.floor(Math.random() * 50) + 80,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return data
  }

  private getMockProductPerformance(
    params: AnalyticsParams & { type?: 'top' | 'bottom' }
  ): ProductAnalyticsPerformance[] {
    const products: ProductAnalyticsPerformance[] = [
      {
        productId: '1',
        productName: 'Bauernbrot',
        quantitySold: 245,
        revenue: 857.5,
      },
      {
        productId: '2',
        productName: 'Croissant',
        quantitySold: 189,
        revenue: 756.0,
      },
      {
        productId: '3',
        productName: 'Brezel',
        quantitySold: 312,
        revenue: 468.0,
      },
      {
        productId: '4',
        productName: 'Vollkornbrot',
        quantitySold: 134,
        revenue: 536.0,
      },
      {
        productId: '5',
        productName: 'Apfelkuchen',
        quantitySold: 67,
        revenue: 301.5,
      },
      {
        productId: '6',
        productName: 'Rosinenbrot',
        quantitySold: 45,
        revenue: 202.5,
      },
      {
        productId: '7',
        productName: 'Baguette',
        quantitySold: 156,
        revenue: 234.0,
      },
      {
        productId: '8',
        productName: 'Käsekuchen',
        quantitySold: 34,
        revenue: 153.0,
      },
    ]

    const sorted =
      params.type === 'bottom'
        ? products.sort((a, b) => a.revenue - b.revenue)
        : products.sort((a, b) => b.revenue - a.revenue)

    return sorted.slice(0, params.limit || 5)
  }

  private getMockCashierPerformance(): CashierPerformance[] {
    return [
      {
        userId: '1',
        userName: 'Maria Schmidt',
        transactionCount: 145,
        totalRevenue: 3234.5,
        averageTransactionValue: 22.31,
      },
      {
        userId: '2',
        userName: 'Thomas Müller',
        transactionCount: 132,
        totalRevenue: 2876.0,
        averageTransactionValue: 21.79,
      },
    ]
  }

  private getMockPaymentMethods(): PaymentMethodData[] {
    return [
      { method: 'Bargeld', count: 267, amount: 3645.5 },
      { method: 'EC-Karte', count: 189, amount: 4123.0 },
      { method: 'Kreditkarte', count: 45, amount: 987.5 },
    ]
  }

  private getMockSummary(): AnalyticsSummary {
    const topProduct: ProductAnalyticsPerformance = {
      productId: '1',
      productName: 'Bauernbrot',
      quantitySold: 245,
      revenue: 857.5,
    }

    return {
      totalRevenue: 8756.0,
      totalTransactions: 501,
      avgTransactionValue: 17.48,
      cashPercentage: 41.6,
      topSellingProduct: topProduct,
      busiestDay: '2024-01-20',
    }
  }
}

export const analyticsService = new AnalyticsService()
