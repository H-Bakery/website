import React from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import RevenueAnalyticsPage from './page'

// Das Ranking-Tabellenmodul zieht @mui/x-data-grid nach, das in jsdom an
// TextEncoder scheitert; die Tabelle ist hier nicht Gegenstand des Tests.
jest.mock('@mui/x-data-grid', () => ({
  DataGrid: () => null,
}))

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  analyticsService: {
    getRevenueTrendsWithSource: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyticsService } = require('@bakery/shared/data-access') as {
  analyticsService: { getRevenueTrendsWithSource: jest.Mock }
}

const revenue = [
  { date: '2026-08-01', revenue: 1500, transactionCount: 90 },
  { date: '2026-08-02', revenue: 2500, transactionCount: 120 },
]

const unavailable = /Die API liefert keine Umsatzdaten/
const noReports = /liegt kein Kassenbericht vor/

describe('RevenueAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    analyticsService.getRevenueTrendsWithSource.mockReset()
  })

  it('zeigt gar keine Zahlen, wenn die API nicht antwortet', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: [],
      available: false,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    expect(await screen.findByText(unavailable)).toBeInTheDocument()
    expect(screen.queryByText('Gesamtumsatz')).not.toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
  })

  it('sagt bei 403 „Nur für Inhaber“ statt „API liefert nichts“ (F4)', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: [],
      available: false,
      forbidden: true,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    expect(await screen.findByText('Nur für Inhaber')).toBeInTheDocument()
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
    // Kein Export-Knopf mehr: /api/reports/generate gibt es nicht.
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
  })

  it('unterscheidet „kein Bericht im Zeitraum“ vom Ausfall', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: [],
      available: true,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    expect(await screen.findByText(noReports)).toBeInTheDocument()
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
    expect(screen.queryByText('Gesamtumsatz')).not.toBeInTheDocument()
  })

  it('zeigt echte Umsatzdaten ohne Warnung', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: revenue,
      available: true,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    await waitFor(() =>
      expect(screen.getByText('4.000,00 €')).toBeInTheDocument()
    )
    expect(screen.getByText('2 Tage mit Bericht')).toBeInTheDocument()
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
    expect(screen.queryByText(noReports)).not.toBeInTheDocument()
  })

  it('zeigt nach schnellem Zeitraumwechsel die Zahlen der jüngsten Auswahl', async () => {
    // Regression: die Antwort der älteren, langsameren Anfrage überschrieb
    // die der neuen Auswahl.
    let resolveSlow: (value: unknown) => void = () => undefined
    analyticsService.getRevenueTrendsWithSource
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSlow = resolve))
      )
      .mockResolvedValueOnce({
        data: [{ date: '2026-08-02', revenue: 700, transactionCount: 10 }],
        available: true,
      })

    renderWithTheme(<RevenueAnalyticsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '7 Tage' }))
    expect(await screen.findAllByText('700,00 €')).not.toHaveLength(0)

    await act(async () => {
      resolveSlow({ data: revenue, available: true })
    })
    expect(screen.queryByText('4.000,00 €')).not.toBeInTheDocument()
    expect(screen.getAllByText('700,00 €').length).toBeGreaterThan(0)
  })

  it('lehnt einen Zeitraum über 400 Tage ab, statt die API zu fragen', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: revenue,
      available: true,
    })
    renderWithTheme(<RevenueAnalyticsPage />)
    await screen.findByText('4.000,00 €')
    const calls = analyticsService.getRevenueTrendsWithSource.mock.calls.length

    const user = userEvent.setup()
    const from = screen.getByLabelText('Von')
    await user.clear(from)
    await user.type(from, '2020-01-01')

    expect(
      screen.getByText('Höchstens 400 Tage auf einmal.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anzeigen' })).toBeDisabled()
    expect(analyticsService.getRevenueTrendsWithSource).toHaveBeenCalledTimes(
      calls
    )
  })
})
