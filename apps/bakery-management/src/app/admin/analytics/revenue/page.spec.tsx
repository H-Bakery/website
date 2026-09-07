import React from 'react'
import { screen, waitFor } from '@testing-library/react'
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

  it('unterscheidet „kein Bericht im Zeitraum" vom Ausfall', async () => {
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
})
