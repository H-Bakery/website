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
    // Der Fallback protokolliert absichtlich; im Test nur Rauschen.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getRevenueTrendsWithSource', () => {
    it('kennzeichnet Beispieldaten, wenn die API mit 404 antwortet', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result.isMock).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(result.data[0].date).toBe('2026-08-01')
    })

    it('kennzeichnet Beispieldaten, wenn die API eine leere Liste liefert', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data: [] },
        message: '',
      })

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result.isMock).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('reicht echte Umsatzdaten unverändert und ohne Kennzeichnung durch', async () => {
      const data = [
        { date: '2026-08-01', revenue: 1234.5, transactionCount: 77 },
      ]
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { data },
        message: '',
      })

      const result = await analyticsService.getRevenueTrendsWithSource(params)

      expect(result).toEqual({ data, isMock: false })
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/analytics/revenue-trends?startDate=2026-08-01&endDate=2026-08-03&granularity=daily'
      )
    })

    it('getRevenueTrends liefert weiterhin nur die Liste', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getRevenueTrends(params)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)
    })
  })

  describe('getProductPerformanceWithSource', () => {
    it('kennzeichnet Beispieldaten, wenn die API mit 404 antwortet', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('HTTP 404: Not Found'))

      const result = await analyticsService.getProductPerformanceWithSource({
        ...params,
        type: 'top',
        limit: 3,
      })

      expect(result.isMock).toBe(true)
      expect(result.data).toHaveLength(3)
    })

    it('reicht echte Produktdaten unverändert und ohne Kennzeichnung durch', async () => {
      const data = [
        {
          productId: 'brot-1',
          productName: 'Bauernbrot',
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

      expect(result).toEqual({ data, isMock: false })
    })
  })
})
