import { apiClient } from '../api-client'
import type {
  RevenueData,
  ProductAnalyticsPerformance,
  PaymentMethodData,
  AnalyticsSummary,
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
 * Analysedaten samt Herkunft. `available` ist false, wenn die API nicht
 * geantwortet hat - dann ist `data` leer. Es gibt bewusst keine
 * Beispieldaten mehr: erfundene Zahlen lasen sich wie echter Umsatz. Eine
 * leere Liste bei `available: true` heißt „für den Zeitraum liegt nichts vor"
 * (kein Kassenbericht), nicht „API kaputt" - die Oberfläche unterscheidet das.
 */
export interface AnalyticsResult<T> {
  data: T
  available: boolean
}

class AnalyticsService {
  private basePath = '/api/analytics'

  async getRevenueTrends(params: AnalyticsParams): Promise<RevenueData[]> {
    return (await this.getRevenueTrendsWithSource(params)).data
  }

  async getRevenueTrendsWithSource(
    params: AnalyticsParams
  ): Promise<AnalyticsResult<RevenueData[]>> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      ...(params.granularity && { granularity: params.granularity }),
    })
    return this.fetchList<RevenueData>(
      `${this.basePath}/revenue-trends?${queryParams}`,
      'Umsatzverlauf'
    )
  }

  async getProductPerformance(
    params: AnalyticsParams & { type?: 'top' | 'bottom' }
  ): Promise<ProductAnalyticsPerformance[]> {
    return (await this.getProductPerformanceWithSource(params)).data
  }

  async getProductPerformanceWithSource(
    params: AnalyticsParams & { type?: 'top' | 'bottom' }
  ): Promise<AnalyticsResult<ProductAnalyticsPerformance[]>> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      ...(params.type && { type: params.type }),
      ...(params.limit && { limit: params.limit.toString() }),
    })
    return this.fetchList<ProductAnalyticsPerformance>(
      `${this.basePath}/product-performance?${queryParams}`,
      'Produktanalyse'
    )
  }

  async getCashierPerformance(
    params: AnalyticsParams
  ): Promise<CashierPerformance[]> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    })
    return (
      await this.fetchList<CashierPerformance>(
        `${this.basePath}/cashier-performance?${queryParams}`,
        'Kassiererauswertung'
      )
    ).data
  }

  async getPaymentMethods(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<PaymentMethodData[]> {
    return (await this.getPaymentMethodsWithSource(params)).data
  }

  async getPaymentMethodsWithSource(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<AnalyticsResult<PaymentMethodData[]>> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    })
    return this.fetchList<PaymentMethodData>(
      `${this.basePath}/payment-methods?${queryParams}`,
      'Zahlungsarten'
    )
  }

  /** `null`, wenn die API nicht antwortet oder für den Zeitraum nichts vorliegt. */
  async getSummary(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<AnalyticsSummary | null> {
    return (await this.getSummaryWithSource(params)).data
  }

  async getSummaryWithSource(
    params: Omit<AnalyticsParams, 'granularity' | 'limit' | 'type'>
  ): Promise<AnalyticsResult<AnalyticsSummary | null>> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    })
    try {
      const response = await apiClient.get<{ data: AnalyticsSummary | null }>(
        `${this.basePath}/summary?${queryParams}`
      )
      const data = response.data?.data
      return {
        data: data && typeof data === 'object' ? data : null,
        available: true,
      }
    } catch (error) {
      console.warn('Analyse-Zusammenfassung nicht verfügbar:', error)
      return { data: null, available: false }
    }
  }

  private async fetchList<T>(
    url: string,
    label: string
  ): Promise<AnalyticsResult<T[]>> {
    try {
      const response = await apiClient.get<{ data: T[] }>(url)
      const data = response.data?.data
      return { data: Array.isArray(data) ? data : [], available: true }
    } catch (error) {
      console.warn(`${label} nicht verfügbar:`, error)
      return { data: [], available: false }
    }
  }
}

export const analyticsService = new AnalyticsService()
