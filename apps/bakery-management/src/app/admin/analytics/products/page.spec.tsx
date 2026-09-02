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

const warning = /Beispieldaten und nicht die echten Verkaufszahlen/

describe('ProductAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('warnt sichtbar, wenn die Zahlen nur Beispieldaten sind', async () => {
    analyticsService.getProductPerformanceWithSource.mockResolvedValue({
      data: products,
      isMock: true,
    })

    renderWithTheme(<ProductAnalyticsPage />)

    expect(await screen.findByText(warning)).toBeInTheDocument()
  })

  it('zeigt keine Warnung, wenn die API echte Produktdaten liefert', async () => {
    analyticsService.getProductPerformanceWithSource.mockResolvedValue({
      data: products,
      isMock: false,
    })

    renderWithTheme(<ProductAnalyticsPage />)

    await waitFor(() => expect(screen.getByText('35,00 €')).toBeInTheDocument())
    expect(screen.queryByText(warning)).not.toBeInTheDocument()
  })
})
