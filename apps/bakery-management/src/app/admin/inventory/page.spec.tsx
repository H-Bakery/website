import React from 'react'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import InventoryPage from './page'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; post: jest.Mock }
}

const mockItems = [
  {
    id: '1',
    name: 'Mehl Type 550',
    category: 'Mehl',
    unit: 'kg',
    stock: 120,
    minStock: 50,
    supplier: 'Mühle Schneider',
    lastRestocked: '2026-03-15',
  },
  {
    id: '3',
    name: 'Hefe',
    category: 'Backmittel',
    unit: 'kg',
    stock: 1,
    minStock: 2,
    supplier: 'BäckerZutaten GmbH',
    lastRestocked: '2026-03-18',
  },
]

describe('AdminInventoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiClient.get.mockResolvedValue({ success: true, data: mockItems })
  })

  it('renders heading, loads items and shows summary counts', async () => {
    renderWithTheme(<InventoryPage />)
    expect(
      screen.getByRole('heading', { name: /Inventar & Lagerbestand/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    expect(await screen.findByText('Mehl Type 550')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/inventory')
    // 2 items total, 1 below minimum
    expect(screen.getByText('Gesamtartikel').nextSibling).toHaveTextContent('2')
    expect(screen.getByText('Niedrige Bestände').nextSibling).toHaveTextContent(
      '1'
    )
    expect(
      screen.getByText(/1 Artikel \(Hefe\) hat einen niedrigen Lagerbestand/)
    ).toBeInTheDocument()
  })

  it('adjusts stock via the adjust dialog', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: { ...mockItems[1], stock: 6 },
    })
    renderWithTheme(<InventoryPage />)
    await screen.findByText('Hefe')

    fireEvent.click(screen.getByLabelText('Bestand von Hefe anpassen'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Änderung/), {
      target: { value: '5' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/api/inventory/3/adjust', {
        adjustment: 5,
        reason: '',
      })
    )
    expect(await screen.findByText('Bestand angepasst')).toBeInTheDocument()
    expect(screen.getByText('6 kg')).toBeInTheDocument()
  })

  it('creates a new item via the add dialog', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: '9',
        name: 'Sesam',
        category: 'Saaten',
        unit: 'kg',
        stock: 3,
        minStock: 1,
      },
    })
    renderWithTheme(<InventoryPage />)
    await screen.findByText('Hefe')

    fireEvent.click(screen.getByRole('button', { name: 'Neuer Artikel' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Bezeichnung/), {
      target: { value: 'Sesam' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/inventory',
        expect.objectContaining({ name: 'Sesam' })
      )
    )
    expect(await screen.findByText('Sesam')).toBeInTheDocument()
  })

  it('shows empty state and error state', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: [] })
    const { unmount } = renderWithTheme(<InventoryPage />)
    expect(
      await screen.findByText(/Keine Artikel im Lager/)
    ).toBeInTheDocument()
    unmount()

    apiClient.get.mockRejectedValueOnce(new Error('Server nicht erreichbar'))
    renderWithTheme(<InventoryPage />)
    expect(
      await screen.findByText('Server nicht erreichbar')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erneut versuchen' })
    ).toBeInTheDocument()
  })
})
