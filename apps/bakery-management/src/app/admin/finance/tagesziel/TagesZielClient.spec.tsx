import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import TagesZielClient, {
  describeAverageRatio,
  formatSignedEuro,
} from './TagesZielClient'
import {
  syntheticPeriod,
  syntheticStatus,
  syntheticTargets,
} from '../../../../lib/targetsFixtures'

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

const authState = { isAuthenticated: true, isLoading: false }
jest.mock('@bakery/shared/contexts', () => ({
  useAuth: () => authState,
}))

// recharts misst im jsdom keine Größen - geprüft werden die Zustände der
// Seite drumherum, nicht das Diagramm.
jest.mock('recharts', () => {
  const Empty = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  )
  return {
    ResponsiveContainer: Empty,
    ComposedChart: Empty,
    Bar: Empty,
    Cell: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number) => Error
}

function mockHappyPath(
  overrides: {
    targets?: ReturnType<typeof syntheticTargets>
    status?: ReturnType<typeof syntheticStatus>
  } = {}
) {
  apiClient.get.mockImplementation(
    (url: string, params?: { date?: string }) => {
      if (url === '/api/finance/targets') {
        return Promise.resolve({
          success: true,
          status: 'ok',
          data: overrides.targets ?? syntheticTargets(),
        })
      }
      if (url === '/api/finance/targets/status') {
        const data = overrides.status ?? syntheticStatus()
        if (params?.date) {
          return Promise.resolve({
            success: true,
            status: 'ok',
            data: {
              ...data,
              day: { ...data.day, date: params.date },
              month: {
                ...data.month,
                month: params.date.slice(0, 7),
                to: params.date,
              },
            },
          })
        }
        return Promise.resolve({ success: true, status: 'ok', data })
      }
      if (url === '/api/finance/targets/period') {
        return Promise.resolve({
          success: true,
          status: 'ok',
          data: syntheticPeriod(),
        })
      }
      return Promise.reject(new Error(`unerwartet: ${url}`))
    }
  )
}

describe('TagesZielClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    authState.isAuthenticated = true
    authState.isLoading = false
  })

  it('zeigt ohne Anmeldung den Hinweis mit Link zur Anmeldung', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Bitte anmelden.', 401))
    renderWithTheme(<TagesZielClient />)
    expect(
      await screen.findByText('Anmeldung erforderlich')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zur Anmeldung/ })).toHaveAttribute(
      'href',
      '/admin/login?next=/admin/finance/tagesziel'
    )
  })

  it('zeigt bei falscher Rolle "Keine Berechtigung"', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Nicht erlaubt.', 403))
    renderWithTheme(<TagesZielClient />)
    expect(await screen.findByText('Keine Berechtigung')).toBeInTheDocument()
  })

  it('zeigt "kein Ziel" mit Grund und Stand, aber keinen Schätzwert', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-target',
      data: { config: { updated: '2026-05-01', mode: 'derived' } },
      message: 'Keine Kassenberichte - Wochentagsfaktoren nicht berechenbar.',
    })
    renderWithTheme(<TagesZielClient />)
    expect(
      await screen.findByText('Kein Tagesziel verfügbar')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Wochentagsfaktoren nicht berechenbar/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Stand der Kostenbasis: 01\.05\.2026/)
    ).toBeInTheDocument()
    expect(screen.queryByText('Ziel je Wochentag')).not.toBeInTheDocument()
  })

  it('zeigt einen Serverfehler als Fehler', async () => {
    apiClient.get.mockRejectedValue(new Error('Request timeout'))
    renderWithTheme(<TagesZielClient />)
    expect(
      await screen.findByText('Tagesziel konnte nicht geladen werden')
    ).toBeInTheDocument()
  })

  it('rendert Kopfzeile, Kennzahlen, Kostenquote, Wochentagstabelle, Verlauf und Monatssicht', async () => {
    mockHappyPath()
    renderWithTheme(<TagesZielClient />)

    expect(await screen.findByText('Ziel je Wochentag')).toBeInTheDocument()

    // Kopfzeile: zuletzt ausgewertet + Stand der Kostenbasis
    expect(screen.getByText(/Zuletzt ausgewertet:/)).toBeInTheDocument()
    expect(screen.getAllByText('Dienstag, 02.06.2026').length).toBe(2)
    expect(
      screen.getByText(/Kostenbasis: Stand 01\.05\.2026/)
    ).toBeInTheDocument()
    expect(screen.queryByText('Kostenbasis veraltet')).not.toBeInTheDocument()

    // Cashflow, keine GuV
    expect(
      screen.getByText(/Cashflow-Sicht nach Buchungsdatum, keine GuV/)
    ).toBeInTheDocument()

    // Kennzahlen
    expect(screen.getByText('Letzter Tag')).toBeInTheDocument()
    expect(screen.getByText('Woche bis 02.06.')).toBeInTheDocument()
    expect(screen.getByText('Monat bis 02.06.')).toBeInTheDocument()
    expect(screen.getAllByText('Hochrechnung Monatsende').length).toBe(2)

    // Kostenquote sichtbar
    expect(screen.getByText('Variable Kostenquote')).toBeInTheDocument()
    expect(screen.getByText('30 %')).toBeInTheDocument()
    expect(screen.getByText(/Deckungsbeitrag 70 %/)).toBeInTheDocument()

    // Wochentagstabelle: Ruhetag ohne Ziel, Samstag mit Faktor
    const weekdayTable = screen.getByRole('table', {
      name: 'Ziel je Wochentag',
    })
    expect(within(weekdayTable).getByText('Ruhetag')).toBeInTheDocument()
    expect(within(weekdayTable).getByText('1,50')).toBeInTheDocument()
    // Abweichung kommt vom Server und steht ohne Prozent in der Zeile;
    // das (an allen Wochentagen gleiche) Verhältnis steht einmal darunter.
    expect(within(weekdayTable).getByText('+30,00 €')).toBeInTheDocument()
    expect(within(weekdayTable).queryByText(/110 %/)).not.toBeInTheDocument()
    expect(screen.getByTestId('weekday-average-ratio')).toHaveTextContent(
      /10 % über dem Tagesziel \(110 %/
    )

    // Tagesverlauf: Ruhetag und laufender Tag sind offen, nicht rot
    await waitFor(() =>
      expect(
        screen.getByRole('table', { name: 'Tagesverlauf' })
      ).toBeInTheDocument()
    )
    const dayTable = screen.getByRole('table', { name: 'Tagesverlauf' })
    expect(within(dayTable).getByText('Ruhetag')).toBeInTheDocument()
    expect(within(dayTable).getByText('Laufender Tag')).toBeInTheDocument()
    expect(within(dayTable).queryAllByText(/Unter Ziel · 86 %/).length).toBe(1)
    const red = dayTable.querySelectorAll('[data-status="red"]')
    expect(red.length).toBe(1)
    expect(dayTable.querySelectorAll('[data-status="open"]').length).toBe(2)

    // Monatssicht mit Hochrechnung
    const monthTable = screen.getByRole('table', { name: 'Monatssicht' })
    expect(
      within(monthTable).getByText('Hochrechnung Monatsende')
    ).toBeInTheDocument()
    expect(within(monthTable).getByText(/24 · Restziel/)).toBeInTheDocument()

    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/targets/period', {
      from: '2026-05-06',
      to: '2026-06-02',
    })
  })

  it('schaltet auf die Entnahme-Stufe um und kennzeichnet sie als Annahme', async () => {
    mockHappyPath()
    renderWithTheme(<TagesZielClient />)
    await screen.findByText('Ziel je Wochentag')

    const toggle = screen.getByRole('button', { name: /Inklusive Entnahme/ })
    expect(within(toggle).getByText('Annahme')).toBeInTheDocument()
    await userEvent.click(toggle)

    expect(
      screen.getByText(/Annahme: Die Privatentnahme ist/)
    ).toBeInTheDocument()
    expect(screen.getByText(/inkl\. Entnahme/)).toBeInTheDocument()
    // Die Tageszahlen der zweiten Stufe: Ziel 25 % höher, alle drei Tage rot
    const dayTable = screen.getByRole('table', { name: 'Tagesverlauf' })
    expect(dayTable.querySelectorAll('[data-status="red"]').length).toBe(3)
  })

  it('warnt, wenn die Kostenbasis älter als sechs Monate ist', async () => {
    const targets = syntheticTargets()
    targets.config = { ...targets.config, stale: true, age_months: 8 }
    mockHappyPath({ targets })
    renderWithTheme(<TagesZielClient />)
    expect(await screen.findByText('Kostenbasis veraltet')).toBeInTheDocument()
    expect(screen.getByText('Kostenbasis 8 Monate alt')).toBeInTheDocument()
  })

  it('holt für einen anderen Monat den Status bis zum Monatsende', async () => {
    mockHappyPath()
    renderWithTheme(<TagesZielClient />)
    await screen.findByText('Ziel je Wochentag')

    await userEvent.click(screen.getByRole('combobox', { name: 'Monat' }))
    await userEvent.click(screen.getByRole('option', { name: 'Mai 2026' }))

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/finance/targets/status',
        {
          date: '2026-05-31',
        }
      )
    )
    expect(
      await screen.findByText('Mai 2026', { selector: 'h6' })
    ).toBeInTheDocument()
  })

  it('formatiert Abweichungen mit Vorzeichen', () => {
    expect(formatSignedEuro(12.3)).toMatch(/^\+12,30/)
    expect(formatSignedEuro(-4)).toMatch(/^−4,00/)
  })

  it('beschreibt das Verhältnis Ø Ist / Ziel als Fußnote', () => {
    expect(describeAverageRatio(1.16)).toMatch(/16\s% über dem Tagesziel/)
    expect(describeAverageRatio(0.9)).toMatch(/10\s% unter dem Tagesziel/)
    expect(describeAverageRatio(1)).toMatch(/genau auf dem Tagesziel/)
  })
})
