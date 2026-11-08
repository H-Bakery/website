import { ApiError } from '@bakery/shared/data-access'
import {
  classifyFinanceError,
  fetchFinanceMonths,
  fetchFinanceSummary,
  fetchMonthReport,
  fetchYearReport,
} from './financeApi'
import {
  completeMonthFixture,
  provisionalYearFixture,
} from './financeReportFixtures'

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

  it('holt den Jahresabschluss mit und ohne Jahr', async () => {
    const report = provisionalYearFixture()
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: report,
    })
    expect(await fetchYearReport()).toEqual({ status: 'ok', data: report })
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/year')
    await fetchYearReport('2025')
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/year/2025')
  })

  it('holt die Monatsanalyse mit und ohne Monat', async () => {
    const report = completeMonthFixture()
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: report,
    })
    expect(await fetchMonthReport()).toEqual({ status: 'ok', data: report })
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/month')
    await fetchMonthReport('2026-09')
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/month/2026-09')
  })

  it('reicht no-data der Berichte mit Grund durch', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Für 2019 gibt es keine Bankdaten.',
    })
    expect(await fetchYearReport('2019')).toEqual({
      status: 'no-data',
      reason: 'Für 2019 gibt es keine Bankdaten.',
    })
    apiClient.get.mockResolvedValue({ success: true, status: 'no-data' })
    expect(await fetchMonthReport('2019-01')).toEqual({
      status: 'no-data',
      reason: 'Keine Finanzdaten vorhanden.',
    })
  })

  it('wirft Zugriffsfehler der Berichte weiter', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Bitte anmelden.', 401))
    await expect(fetchYearReport()).rejects.toMatchObject({ status: 401 })
    await expect(fetchMonthReport()).rejects.toMatchObject({ status: 401 })
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
