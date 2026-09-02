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

const warning = /Beispieldaten und nicht der echte Umsatz/

describe('RevenueAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('warnt sichtbar, wenn die Zahlen nur Beispieldaten sind', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: revenue,
      isMock: true,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    expect(await screen.findByText(warning)).toBeInTheDocument()
    // Die Kennzahlen bleiben stehen - nur eben als gekennzeichnete Beispieldaten.
    expect(screen.getByText('4.000,00 €')).toBeInTheDocument()
  })

  it('zeigt keine Warnung, wenn die API echte Umsatzdaten liefert', async () => {
    analyticsService.getRevenueTrendsWithSource.mockResolvedValue({
      data: revenue,
      isMock: false,
    })

    renderWithTheme(<RevenueAnalyticsPage />)

    await waitFor(() =>
      expect(screen.getByText('4.000,00 €')).toBeInTheDocument()
    )
    expect(screen.queryByText(warning)).not.toBeInTheDocument()
  })
})
