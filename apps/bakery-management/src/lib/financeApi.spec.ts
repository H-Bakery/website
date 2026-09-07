import { ApiError } from '@bakery/shared/data-access'
import {
  classifyFinanceError,
  fetchFinanceMonths,
  fetchFinanceSummary,
} from './financeApi'

jest.mock('@bakery/shared/data-access', () => {
  const actual = jest.requireActual('@bakery/shared/data-access')
  return { ...actual, apiClient: { get: jest.fn() } }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
}

describe('financeApi', () => {
  beforeEach(() => apiClient.get.mockReset())

  it('packt eine ok-Antwort aus', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: { months: [] },
    })
    const result = await fetchFinanceSummary()
    expect(result).toEqual({ status: 'ok', data: { months: [] } })
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/summary')
  })

  it('reicht no-data mit Grund durch', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Finanzdaten nicht gefunden.',
    })
    const result = await fetchFinanceMonths({ from: '2026-01' })
    expect(result).toEqual({
      status: 'no-data',
      reason: 'Finanzdaten nicht gefunden.',
    })
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/months', {
      from: '2026-01',
    })
  })

  it('unterscheidet 401, 403 und sonstige Fehler', () => {
    expect(classifyFinanceError(new ApiError('bitte anmelden', 401))).toEqual({
      kind: 'unauthenticated',
      message: 'bitte anmelden',
    })
    expect(classifyFinanceError(new ApiError('nicht erlaubt', 403))).toEqual({
      kind: 'forbidden',
      message: 'nicht erlaubt',
    })
    expect(classifyFinanceError(new ApiError('kaputt', 500)).kind).toBe('error')
    expect(classifyFinanceError(new Error('Request timeout'))).toEqual({
      kind: 'error',
      message: 'Request timeout',
    })
    expect(classifyFinanceError('???').kind).toBe('error')
  })
})
