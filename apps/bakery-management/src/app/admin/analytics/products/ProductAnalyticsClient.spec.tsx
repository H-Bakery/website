import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductAnalyticsPage from './ProductAnalyticsClient'

// Das Ranking-Tabellenmodul zieht @mui/x-data-grid nach, das in jsdom an
// TextEncoder scheitert; die Tabelle ist hier nicht Gegenstand des Tests.
jest.mock('@mui/x-data-grid', () => ({
  DataGrid: () => null,
}))

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  analyticsService: {
    getProductPerformanceWithSource: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyticsService } = require('@bakery/shared/data-access') as {
  analyticsService: { getProductPerformanceWithSource: jest.Mock }
}

const products = [
  { productId: '1', productName: 'Bauernbrot', quantitySold: 10, revenue: 35 },
]

const unavailable = /Der Server hat keine Produktdaten geliefert/

describe('ProductAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('zeigt gar keine Zahlen, wenn die API nicht antwortet', async () => {
    analyticsService.getProductPerformanceWithSource.mockResolvedValue({
      data: [],
      available: false,
    })

    renderWithTheme(<ProductAnalyticsPage />)

    expect(await screen.findByText(unavailable)).toBeInTheDocument()
    expect(screen.queryByText('Bestseller')).not.toBeInTheDocument()
  })

  it('meldet einen Zeitraum ohne Kassenbericht als solchen', async () => {
    analyticsService.getProductPerformanceWithSource.mockResolvedValue({
      data: [],
      available: true,
    })

    renderWithTheme(<ProductAnalyticsPage />)

    expect(
      await screen.findByText(/liegt kein Kassenbericht vor/)
    ).toBeInTheDocument()
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
  })

  it('zeigt echte Produktdaten ohne Warnung', async () => {
    analyticsService.getProductPerformanceWithSource.mockResolvedValue({
      data: products,
      available: true,
    })

    renderWithTheme(<ProductAnalyticsPage />)

    await waitFor(() =>
      expect(screen.getAllByText('35,00 €').length).toBeGreaterThan(0)
    )
    expect(
      screen.getByRole('table', { name: 'Produkte nach Umsatz' })
    ).toBeInTheDocument()
    // Der Hinweis zu Nettomengen steht zugeklappt unter der Liste.
    expect(
      screen.getByRole('button', { name: 'Hinweis zu den Mengen' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
  })

  it('zeigt „Wenig verkauft“ als Sortierung derselben Liste, nicht als zweite Tabelle', async () => {
    analyticsService.getProductPerformanceWithSource.mockImplementation(
      (params: { type: string }) =>
        Promise.resolve({
          data:
            params.type === 'bottom'
              ? [
                  {
                    ...products[0],
                    productId: '2',
                    productName: 'Zopf',
                    quantitySold: 1,
                    revenue: 4,
                  },
                  ...products,
                ]
              : [
                  ...products,
                  {
                    productId: '2',
                    productName: 'Zopf',
                    quantitySold: 1,
                    revenue: 4,
                  },
                ],
          available: true,
        })
    )
    renderWithTheme(<ProductAnalyticsPage latestReportDate="2026-03-06" />)

    expect(
      await screen.findByRole('table', { name: 'Produkte nach Umsatz' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(
      analyticsService.getProductPerformanceWithSource
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-02-05',
        endDate: '2026-03-06',
      })
    )

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Wenig verkauft' }))
    expect(
      screen.getByRole('table', { name: 'Wenig verkaufte Produkte' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })
})
