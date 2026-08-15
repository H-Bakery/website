import React from 'react'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductionPage from './page'

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
  apiClient: {
    get: jest.Mock
    put: jest.Mock
    post: jest.Mock
    delete: jest.Mock
  }
}

const mockPlans = [
  {
    id: '1',
    date: '2026-03-20',
    product: 'Kornbrot',
    quantity: 50,
    status: 'planned',
  },
  {
    id: '2',
    date: '2026-03-20',
    product: 'Brötchen',
    quantity: 200,
    status: 'in-progress',
  },
  {
    id: '4',
    date: '2026-03-19',
    product: 'Roggenbrot',
    quantity: 50,
    status: 'completed',
  },
]

const mockLowStock = [
  { id: '3', name: 'Hefe', stock: 1, minStock: 2, unit: 'kg' },
]

describe('AdminProductionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiClient.get.mockImplementation((url: string) => {
      if (url === '/api/production')
        return Promise.resolve({ success: true, data: mockPlans })
      if (url === '/api/inventory/low-stock')
        return Promise.resolve({ success: true, data: mockLowStock })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    apiClient.put.mockImplementation(
      (url: string, body: { status: string }) => {
        const id = url.split('/').pop()
        const plan = mockPlans.find((p) => p.id === id)
        return Promise.resolve({ success: true, data: { ...plan, ...body } })
      }
    )
  })

  it('renders heading, loads plans and computes metrics', async () => {
    renderWithTheme(<ProductionPage />)
    expect(
      screen.getByRole('heading', { name: /Produktionsplanung/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    expect(await screen.findByText('Kornbrot')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/production')
    // 50 of 300 units completed => 17%
    expect(screen.getByText('17%')).toBeInTheDocument()
    expect(screen.getByText('50 von 300 Stück produziert')).toBeInTheDocument()
    expect(screen.getByText('1 geplant')).toBeInTheDocument()
    expect(screen.getByText('1 in Produktion')).toBeInTheDocument()
    // low stock from inventory endpoint
    expect(
      screen.getByText(/1 Rohstoff unter Mindestbestand/)
    ).toBeInTheDocument()
    expect(screen.getByText('Hefe')).toBeInTheDocument()
  })

  it('starts and completes production orders', async () => {
    renderWithTheme(<ProductionPage />)
    await screen.findByText('Kornbrot')

    fireEvent.click(screen.getByLabelText('Kornbrot starten'))
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/production/1', {
        status: 'in-progress',
      })
    )
    expect(
      await screen.findByLabelText('Kornbrot abschließen')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Brötchen abschließen'))
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/production/2', {
        status: 'completed',
      })
    )
  })

  it('creates a new production order', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: '9',
        date: '2026-08-15',
        product: 'Brezel',
        quantity: 40,
        status: 'planned',
      },
    })
    renderWithTheme(<ProductionPage />)
    await screen.findByText('Kornbrot')

    fireEvent.click(screen.getByRole('button', { name: 'Neuer Auftrag' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Produkt/), {
      target: { value: 'Brezel' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Menge/), {
      target: { value: '40' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' }))

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/production',
        expect.objectContaining({ product: 'Brezel', quantity: 40 })
      )
    )
    expect(await screen.findByText('Brezel')).toBeInTheDocument()
  })

  it('shows empty and error states', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] })
    const { unmount } = renderWithTheme(<ProductionPage />)
    expect(
      await screen.findByText('Keine Produktionsaufträge vorhanden.')
    ).toBeInTheDocument()
    unmount()

    apiClient.get.mockRejectedValue(new Error('Kaputt'))
    renderWithTheme(<ProductionPage />)
    expect(await screen.findByText('Kaputt')).toBeInTheDocument()
  })
})
