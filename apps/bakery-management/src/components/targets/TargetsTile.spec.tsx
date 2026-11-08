import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import TargetsTile from './TargetsTile'
import { syntheticStatus } from '../../lib/targetsFixtures'

jest.mock('@bakery/shared/data-access', () => {
  class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.code = code
      this.name = 'ApiError'
      this.status = status
    }
  }
  return { ApiError, apiClient: { get: jest.fn() } }
})

const authState = { isAuthenticated: false, isLoading: false }
jest.mock('../../lib/session', () => ({
  useSession: () => authState,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

describe('TargetsTile', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    authState.isAuthenticated = false
    authState.isLoading = false
  })

  it('zeigt ohne Anmeldung "Anmeldung erforderlich" mit Link - keinen Fehler', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Anmeldung erforderlich. Bitte melden Sie sich an.', 401)
    )
    renderWithTheme(<TargetsTile />)
    expect(
      await screen.findByText(/Anmeldung erforderlich/)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zur Anmeldung/ })).toHaveAttribute(
      'href',
      '/admin/login?next=/admin'
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('zeigt bei falscher Rolle einen Hinweis, keinen Fehler', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Keine Berechtigung.', 403))
    renderWithTheme(<TargetsTile />)
    expect(await screen.findByText(/Keine Berechtigung/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('MuiAlert-colorInfo')
  })

  it('zeigt an der PIN-Station den Passwort-Hinweis (F4)', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Nur mit Passwort.', 403, 'personal_session_required')
    )
    renderWithTheme(<TargetsTile />)
    expect(
      await screen.findByText(/An der PIN-Station nicht verfügbar/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Keine Berechtigung/)).toBeNull()
  })

  it('zeigt "kein Ziel" mit Grund und ohne Zahlen', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-target',
      data: null,
      message: 'Keine Zielkonfiguration gefunden.',
    })
    renderWithTheme(<TargetsTile />)
    expect(
      await screen.findByText(/Kein Tagesziel verfügbar/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Keine Zielkonfiguration/)).toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
  })

  // UI-Runde 2: vorher „Das Tagesziel konnte nicht geladen werden. Failed to
  // fetch“ neben dem Dashboard-Hinweis „API nicht erreichbar“.
  it.each([
    ['abgebrochenes fetch', () => new TypeError('Failed to fetch')],
    ['Zeitüberschreitung', () => new Error('Request timeout')],
    ['Caddy 502', () => new ApiError('HTTP 502: Bad Gateway', 502)],
  ])(
    'ohne Server (%s): WLAN-Hinweis und Erneut versuchen',
    async (_l, make) => {
      apiClient.get.mockRejectedValueOnce(make())
      renderWithTheme(<TargetsTile />)
      expect(
        await screen.findByText('Tagesziel konnte nicht geladen werden')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Keine Verbindung zum Server – bitte WLAN prüfen.')
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/Failed to fetch|Bad Gateway|Request timeout/)
      ).toBeNull()
      apiClient.get.mockResolvedValueOnce({
        success: true,
        status: 'no-target',
        data: null,
        message: 'Keine Zielkonfiguration gefunden.',
      })
      fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
      expect(
        await screen.findByText(/Kein Tagesziel verfügbar/)
      ).toBeInTheDocument()
    }
  )

  it('rendert letzten Tag, Woche und Monat mit Ampel, Label und Zahl', async () => {
    authState.isAuthenticated = true
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: syntheticStatus(),
    })
    renderWithTheme(<TargetsTile />)

    expect(await screen.findByTestId('targets-figure-day')).toHaveTextContent(
      'Letzter Tag'
    )
    expect(
      screen.getByText(/Zuletzt ausgewertet: 02\.06\.2026/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Dienstag, 02\.06\.2026 · Ziel/)
    ).toBeInTheDocument()
    expect(screen.getByTestId('targets-figure-week')).toHaveTextContent(
      'Woche bis 02.06.'
    )
    expect(screen.getByTestId('targets-figure-month')).toHaveTextContent(
      'Monat bis 02.06.'
    )
    expect(screen.getByText(/Hochrechnung Monatsende/)).toBeInTheDocument()

    // Ampel je Stufe: Farbe nie allein - Label und Verhältnis stehen im Chip
    const chips = document.querySelectorAll('[data-status]')
    expect(chips.length).toBe(6)
    expect(screen.getAllByText(/Ziel erreicht · 106 %/).length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText(/Unter Ziel · 84 %/).length).toBeGreaterThan(0)
    // Die zweite Stufe ist eine Annahme - das steht am Details-Knopf.
    expect(
      screen.getByRole('button', { name: 'Inklusive Entnahme (Annahme)' })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', { name: /Tagesziel im Detail/ })
    ).toHaveAttribute('href', '/admin/finance/tagesziel')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/finance/targets/status',
      undefined
    )
  })

  it('zeigt die Zahlen wie Kasse und Sortiment als KeyFigures (Review r1)', async () => {
    authState.isAuthenticated = true
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: syntheticStatus(),
    })
    renderWithTheme(<TargetsTile />)
    const group = await screen.findByLabelText('Tagesziel je Zeitraum')
    expect(group.tagName).toBe('DL')
    // je Zeitraum eine Kennzahl, der Ampel-Chip der ersten Stufe als Badge
    ;['day', 'week', 'month'].forEach((key) => {
      const figure = screen.getByTestId(`targets-figure-${key}`)
      expect(figure.querySelectorAll('[data-status]')).toHaveLength(1)
      expect(figure.querySelector('dd')).toHaveTextContent(/€|–/)
    })
    // die zweite Stufe steht zugeklappt in „Details“
    const drawLevel = screen.getByTestId('targets-draw-level')
    expect(drawLevel.querySelectorAll('[data-status]')).toHaveLength(3)
    expect(drawLevel).not.toBeVisible()
  })

  it('wartet, bis der AuthProvider ein gespeichertes Token geprüft hat', () => {
    authState.isLoading = true
    renderWithTheme(<TargetsTile />)
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Tagesziel wird geladen')).toBeInTheDocument()
  })
})
