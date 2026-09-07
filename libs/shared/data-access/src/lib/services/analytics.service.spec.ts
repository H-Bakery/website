import { analyticsService } from './analytics.service'
import { apiClient } from '../api-client'

jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}))

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

const params = {
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  granularity: 'daily' as const,
}

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Der Ausfall protokolliert absichtlich; im Test nur Rauschen.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getRevenueTrendsWithSource', () => {
    it('liefert leer und nicht verfügbar, wenn die API mit 404 antwortet - keine Beispieldaten', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result).toEqual({ data: [], available: false })
    })

    it('unterscheidet eine leere Antwort (kein Bericht) von einem Ausfall', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data: [] },
        message: '',
      })

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result).toEqual({ data: [], available: true })
    })

    it('reicht echte Umsatzdaten unverändert durch', async () => {
      const data = [
        { date: '2026-08-01', revenue: 1234.5, transactionCount: 77 },
      ]
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data },
        message: '',
      })

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result).toEqual({ data, available: true })
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/analytics/revenue-trends?startDate=2026-08-01&endDate=2026-08-03&granularity=daily'
      )
    })

    it('getRevenueTrends liefert nur die Liste - und bei Ausfall eine leere', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getRevenueTrends(params)

      expect(result).toEqual([])
    })
  })

  describe('getProductPerformanceWithSource', () => {
    it('liefert leer und nicht verfügbar, wenn die API mit 404 antwortet', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getProductPerformanceWithSource({
        ...params,
        type: 'top',
        limit: 3,
      })

      expect(result).toEqual({ data: [], available: false })
    })

    it('reicht echte Produktdaten unverändert durch', async () => {
      const data = [
        {
          productId: 'brot-1',
          productName: 'Testbrot',
          quantitySold: 12,
          revenue: 42,
        },
      ]
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data },
        message: '',
      })

      const result = await analyticsService.getProductPerformanceWithSource({
        ...params,
        type: 'top',
        limit: 3,
      })

      expect(result).toEqual({ data, available: true })
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/analytics/product-performance?startDate=2026-08-01&endDate=2026-08-03&type=top&limit=3'
      )
    })
  })

  describe('getSummary', () => {
    it('liefert null statt erfundener Kennzahlen, wenn die API ausfällt', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      expect(await analyticsService.getSummary(params)).toBeNull()
    })

    it('liefert null, wenn die API für den Zeitraum nichts hat', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data: null },
        message: '',
      })

      const result = await analyticsService.getSummaryWithSource(params)

      expect(result).toEqual({ data: null, available: true })
    })
  })

  it('getPaymentMethods liefert bei Ausfall eine leere Liste', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 500'))

    expect(await analyticsService.getPaymentMethods(params)).toEqual([])
  })
})
