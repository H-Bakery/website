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
    expect(
      classifyFinanceError(
        new ApiError('Nur mit Passwort.', 403, 'personal_session_required')
      )
    ).toEqual({
      kind: 'personal_session',
      message:
        'An der PIN-Station nicht verfügbar – bitte am Büro-PC oder eigenen Gerät mit Passwort anmelden.',
    })
    expect(classifyFinanceError(new ApiError('kaputt', 500)).kind).toBe('error')
    expect(classifyFinanceError('???').kind).toBe('error')
  })

  // UI-Runde 2: Finanzen, Tagesziel und Kachel zeigten die rohe Meldung.
  it('übersetzt Netz- und Proxyfehler in den WLAN-Hinweis', () => {
    const OFFLINE = 'Keine Verbindung zum Server – bitte WLAN prüfen.'
    for (const err of [
      new TypeError('Failed to fetch'),
      new Error('Request timeout'),
      new ApiError('HTTP 502: Bad Gateway', 502),
      new ApiError('HTTP 504: Gateway Timeout', 504),
    ]) {
      expect(classifyFinanceError(err)).toEqual({
        kind: 'error',
        message: OFFLINE,
      })
    }
  })

  it('ein unerwarteter Serverfehler nennt Text und Status, eine deutsche API-Meldung bleibt', () => {
    expect(
      classifyFinanceError(
        new ApiError('Internal error', 500, 'internal'),
        'Das Tagesziel konnte nicht geladen werden.'
      ).message
    ).toBe(
      'Das Tagesziel konnte nicht geladen werden. Fehler auf dem Server (500) – bitte im Büro Bescheid geben.'
    )
    expect(
      classifyFinanceError(new ApiError('Zeitraum ungültig.', 400, 'invalid'))
        .message
    ).toBe('Zeitraum ungültig.')
    expect(
      classifyFinanceError(new TypeError('Cannot read properties of null'))
        .message
    ).toBe('Die Finanzdaten konnten nicht geladen werden.')
  })
})
