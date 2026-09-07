import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import TargetsTile from './TargetsTile'
import { syntheticStatus } from '../../lib/targetsFixtures'

jest.mock('@bakery/shared/data-access', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return { ApiError, apiClient: { get: jest.fn() } }
})

const authState = { isAuthenticated: false, isLoading: false }
jest.mock('@bakery/shared/contexts', () => ({
  useAuth: () => authState,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number) => Error
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

  it('zeigt einen Serverfehler als Warnung', async () => {
    apiClient.get.mockRejectedValue(new Error('Request timeout'))
    renderWithTheme(<TargetsTile />)
    expect(
      await screen.findByText(/konnte nicht geladen werden/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Request timeout/)).toBeInTheDocument()
  })

  it('rendert letzten Tag, Woche und Monat mit Ampel, Label und Zahl', async () => {
    authState.isAuthenticated = true
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: syntheticStatus(),
    })
    renderWithTheme(<TargetsTile />)

    expect(await screen.findByText('Letzter Tag')).toBeInTheDocument()
    expect(
      screen.getByText(/Zuletzt ausgewertet: 02\.06\.2026/)
    ).toBeInTheDocument()
    expect(screen.getByText('Dienstag, 02.06.2026')).toBeInTheDocument()
    expect(screen.getByText('Woche bis 02.06.')).toBeInTheDocument()
    expect(screen.getByText('Monat bis 02.06.')).toBeInTheDocument()
    expect(screen.getByText(/Hochrechnung Monatsende/)).toBeInTheDocument()

    // Ampel je Stufe: Farbe nie allein - Label und Verhältnis stehen im Chip
    const chips = document.querySelectorAll('[data-status]')
    expect(chips.length).toBe(6)
    expect(screen.getAllByText(/Ziel erreicht · 106 %/).length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText(/Unter Ziel · 84 %/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\(Annahme\)/).length).toBe(3)

    expect(
      screen.getByRole('link', { name: /Tagesziel im Detail/ })
    ).toHaveAttribute('href', '/admin/finance/tagesziel')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/finance/targets/status',
      undefined
    )
  })

  it('wartet, bis der AuthProvider ein gespeichertes Token geprüft hat', () => {
    authState.isLoading = true
    renderWithTheme(<TargetsTile />)
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Tagesziel wird geladen')).toBeInTheDocument()
  })
})
