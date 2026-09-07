import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductAnalyticsPage from './page'

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

const unavailable = /Die API liefert keine Produktdaten/

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

    await waitFor(() => expect(screen.getByText('35,00 €')).toBeInTheDocument())
    expect(screen.queryByText(unavailable)).not.toBeInTheDocument()
  })
})
