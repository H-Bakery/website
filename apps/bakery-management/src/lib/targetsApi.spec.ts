import {
  fetchTargetPeriod,
  fetchTargetStatus,
  fetchTargets,
} from './targetsApi'

jest.mock('@bakery/shared/data-access', () => {
  const actual = jest.requireActual('@bakery/shared/data-access')
  return { ...actual, apiClient: { get: jest.fn() } }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
}

describe('targetsApi', () => {
  beforeEach(() => apiClient.get.mockReset())

  it('packt eine ok-Antwort aus', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: { today: '2026-06-03' },
    })
    const result = await fetchTargets()
    expect(result).toEqual({ status: 'ok', data: { today: '2026-06-03' } })
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/targets')
  })

  it('reicht no-target mit Grund und Teildaten durch', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-target',
      data: { config: { updated: '2026-05-01' } },
      message: 'Keine Kassenberichte.',
    })
    const result = await fetchTargets()
    expect(result).toEqual({
      status: 'no-target',
      reason: 'Keine Kassenberichte.',
      partial: { config: { updated: '2026-05-01' } },
    })
  })

  it('gibt bei no-target ohne Daten keinen Schätzwert zurück', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-target',
      data: null,
      message: 'Keine Zielkonfiguration gefunden.',
    })
    const result = await fetchTargetStatus()
    expect(result.status).toBe('no-target')
    expect(result).not.toHaveProperty('data')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/finance/targets/status',
      undefined
    )
  })

  it('übergibt Datum und Zeitraum als Query', async () => {
    apiClient.get.mockResolvedValue({ success: true, status: 'ok', data: {} })
    await fetchTargetStatus('2026-06-01')
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/targets/status', {
      date: '2026-06-01',
    })
    await fetchTargetPeriod('2026-05-01', '2026-05-31')
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/targets/period', {
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })

  it('wirft Fehler des ApiClient weiter (401/403 klassifiziert die Seite)', async () => {
    apiClient.get.mockRejectedValue(new Error('kaputt'))
    await expect(fetchTargets()).rejects.toThrow('kaputt')
  })
})
