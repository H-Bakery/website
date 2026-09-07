import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import FinanceClient, { formatEuro, formatMonth } from './FinanceClient'
import type { FinanceSummaryResponse } from '../../../lib/financeTypes'

jest.mock('@bakery/shared/data-access', () => {
  class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  }
  return {
    ApiError,
    apiClient: { get: jest.fn() },
  }
})

const authState = { isAuthenticated: false, isLoading: false }
jest.mock('@bakery/shared/contexts', () => ({
  useAuth: () => authState,
}))

// recharts misst im jsdom keine Größen - die Diagramme selbst sind hier nicht
// Gegenstand des Tests, nur die Zustände der Seite drumherum.
jest.mock('recharts', () => {
  const Empty = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  )
  return {
    ResponsiveContainer: Empty,
    ComposedChart: Empty,
    BarChart: Empty,
    Bar: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number) => Error
}

/**
 * Intl setzt vor dem € ein geschütztes Leerzeichen (je nach ICU U+00A0 oder
 * U+202F) - deshalb ein Muster statt eines festen Strings.
 */
function euro(value: number): RegExp {
  const text = formatEuro(value)
    .replace(/[\s\u00a0\u202f]+/g, '\\s*')
    .replace(/\./g, '\\.')
  return new RegExp(`^${text}$`)
}

/** Synthetische, bereits bereinigte Antwort von `/api/finance/summary`. */
function syntheticSummary(): FinanceSummaryResponse {
  const months = [
    {
      month: '2026-01',
      transactions: 10,
      operating_income: 1000,
      operating_expense: -600,
      operating_result: 400,
      neutral: -100,
      net_change: 300,
      categories: {},
    },
    {
      month: '2026-02',
      transactions: 12,
      operating_income: 1200,
      operating_expense: -700,
      operating_result: 500,
      neutral: 0,
      net_change: 500,
      categories: {},
    },
  ]
  return {
    generated_at: '2026-03-01T09:30:00+01:00',
    schema_version: 1,
    period: { from: '2026-01-01', to: '2026-02-28' },
    transaction_count: 22,
    category_labels: { umsatz: 'Umsatzerlöse', wareneinsatz: 'Wareneinsatz' },
    category_kinds: { umsatz: 'einnahme', wareneinsatz: 'ausgabe' },
    subcategory_labels: {},
    totals: {},
    months,
    uncategorized: { count: 2, amount: -42 },
    derived: {
      overview: {
        months: 2,
        from: '2026-01',
        to: '2026-02',
        transactions: 22,
        income: 2200,
        expense: -1300,
        result: 900,
        neutral: -100,
        net_change: 800,
      },
      series: months.map((m) => ({
        month: m.month,
        transactions: m.transactions,
        income: m.operating_income,
        expense: m.operating_expense,
        result: m.operating_result,
        neutral: m.neutral,
        net_change: m.net_change,
      })),
      cost_structure: [
        {
          category: 'wareneinsatz',
          label: 'Wareneinsatz',
          kind: 'ausgabe',
          amount: -1300,
          count: 8,
          income: 0,
          expense: -1300,
          share: 1,
        },
      ],
      income_structure: [],
      invariant: { ok: true, violations: [] },
    },
  }
}

describe('FinanceClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    authState.isAuthenticated = false
    authState.isLoading = false
  })

  it('zeigt ohne Anmeldung einen Hinweis mit Link zur Anmeldung, keinen Fehler', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Anmeldung erforderlich. Bitte melden Sie sich an.', 401)
    )
    renderWithTheme(<FinanceClient />)

    expect(
      await screen.findByText('Anmeldung erforderlich')
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Zur Anmeldung/ })
    expect(link).toHaveAttribute('href', '/admin/login?next=/admin/finance')
    expect(screen.queryByRole('alert')).not.toHaveTextContent(/Fehler/)
  })

  it('zeigt bei falscher Rolle den Hinweis auf Inhaber/Admin', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Keine Berechtigung für diesen Bereich.', 403)
    )
    renderWithTheme(<FinanceClient />)
    expect(await screen.findByText('Keine Berechtigung')).toBeInTheDocument()
    expect(screen.getByText(/Inhaber\/Admin/)).toBeInTheDocument()
  })

  it('zeigt "keine Daten" mit Grund und ohne Beispielwerte', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Finanzdaten nicht gefunden (hq/data/finance fehlt).',
    })
    renderWithTheme(<FinanceClient />)
    expect(
      await screen.findByText('Keine Finanzdaten vorhanden')
    ).toBeInTheDocument()
    expect(screen.getByText(/hq\/data\/finance fehlt/)).toBeInTheDocument()
    expect(screen.queryByText('Einnahmen')).not.toBeInTheDocument()
  })

  it('zeigt einen echten Serverfehler als Fehler', async () => {
    apiClient.get.mockRejectedValue(new Error('Request timeout'))
    renderWithTheme(<FinanceClient />)
    expect(
      await screen.findByText('Finanzdaten konnten nicht geladen werden')
    ).toBeInTheDocument()
    expect(screen.getByText('Request timeout')).toBeInTheDocument()
  })

  it('rendert Kennzahlen, Stand, GuV-Hinweis und den Hinweis auf offene Buchungen', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'ok',
      data: syntheticSummary(),
    })
    renderWithTheme(<FinanceClient />)

    expect(await screen.findByText('Einnahmen')).toBeInTheDocument()
    expect(screen.getByText(euro(2200))).toBeInTheDocument()
    // Ausgaben-Kachel und Kostenstruktur-Zeile zeigen denselben Betrag
    expect(screen.getAllByText(euro(-1300)).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(euro(900))).toBeInTheDocument()
    expect(screen.getByText(euro(800))).toBeInTheDocument()

    // Stand und Zeitraum
    expect(screen.getByText(/Stand: 01\.03\.2026/)).toBeInTheDocument()
    expect(screen.getByText(/22 Buchungen/)).toBeInTheDocument()

    // Cashflow, keine GuV
    expect(
      screen.getByText(/Cashflow-Sicht nach Buchungsdatum, keine GuV/)
    ).toBeInTheDocument()

    // Nicht zugeordnet: Info, nicht Warnung
    const uncategorized = screen
      .getByText('Nicht zugeordnete Buchungen')
      .closest('.MuiAlert-root')
    expect(uncategorized).toHaveClass('MuiAlert-colorInfo')
    expect(uncategorized).toHaveTextContent('2 Buchungen')
    expect(uncategorized).toHaveTextContent(/42,00/)

    // Summenprüfung
    expect(screen.getByText('Summenprüfung stimmig')).toBeInTheDocument()

    // Kostenstruktur-Tabelle
    expect(screen.getByText('Wareneinsatz')).toBeInTheDocument()
    expect(screen.getByText('100 %')).toBeInTheDocument()

    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/summary')
  })

  it('holt bei einem Zeitraumfilter die Reihe vom Server', async () => {
    apiClient.get.mockImplementation((url: string) => {
      if (url === '/api/finance/summary') {
        return Promise.resolve({
          success: true,
          status: 'ok',
          data: syntheticSummary(),
        })
      }
      return Promise.resolve({
        success: true,
        status: 'ok',
        data: {
          from: '2026-02',
          to: null,
          generated_at: null,
          months: syntheticSummary().derived.series.slice(1),
          overview: {
            months: 1,
            from: '2026-02',
            to: '2026-02',
            transactions: 12,
            income: 1200,
            expense: -700,
            result: 500,
            neutral: 0,
            net_change: 500,
          },
          cost_structure: [],
          income_structure: [],
        },
      })
    })
    renderWithTheme(<FinanceClient />)
    await screen.findByText('Einnahmen')

    // MUI-Select: Menü öffnen und Februar wählen
    const fromSelect = screen.getByLabelText('Von')
    fromSelect.focus()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fireEvent } = require('@testing-library/react')
    fireEvent.mouseDown(fromSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Februar 2026' }))

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/api/finance/months', {
        from: '2026-02',
        to: undefined,
      })
    )
    expect(await screen.findByText(euro(1200))).toBeInTheDocument()
    expect(screen.getByText('1 Monat')).toBeInTheDocument()
    expect(screen.getByText('Gesamter Zeitraum')).toBeInTheDocument()
  })

  it('wartet mit dem Laden, bis die Anmeldung geprüft ist', () => {
    authState.isLoading = true
    renderWithTheme(<FinanceClient />)
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(
      screen.getByLabelText('Finanzdaten werden geladen')
    ).toBeInTheDocument()
  })
})

describe('Formatierung', () => {
  it('formatiert Euro und Monate deutsch', () => {
    expect(formatEuro(-1234.5)).toMatch(/-1\.234,50\s€/)
    expect(formatMonth('2026-03')).toMatch(/März|Mär/)
    expect(formatMonth('kaputt')).toBe('kaputt')
  })
})
