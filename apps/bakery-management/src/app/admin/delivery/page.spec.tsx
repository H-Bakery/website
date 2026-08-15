import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import DeliveryPage from './page'

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
  apiClient: { get: jest.Mock; put: jest.Mock }
}

const mockOrders = [
  {
    id: '1',
    customerName: 'Max Mustermann',
    items: [{ productId: 'a', name: 'A', quantity: 2, price: 1 }],
    total: 2,
    status: 'pending',
    createdAt: '2026-08-15T06:00:00.000Z',
    updatedAt: '',
  },
  {
    id: '2',
    customerName: 'Anna Schmidt',
    items: [{ productId: 'b', name: 'B', quantity: 1, price: 1 }],
    total: 1,
    status: 'ready',
    createdAt: '2026-08-15T06:00:00.000Z',
    updatedAt: '',
  },
  {
    id: '3',
    customerName: 'Peter Fischer',
    items: [],
    total: 0,
    status: 'delivered',
    createdAt: '2026-08-15T06:00:00.000Z',
    updatedAt: '',
  },
  {
    id: '4',
    customerName: 'Storno Kunde',
    items: [],
    total: 0,
    status: 'cancelled',
    createdAt: '2026-08-15T06:00:00.000Z',
    updatedAt: '',
  },
]

describe('AdminDeliveryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiClient.get.mockResolvedValue({ success: true, data: mockOrders })
    apiClient.put.mockImplementation(
      (url: string, body: { status: string }) => {
        const id = url.split('/').pop()
        const order = mockOrders.find((o) => o.id === id)
        return Promise.resolve({ success: true, data: { ...order, ...body } })
      }
    )
  })

  it('renders heading, loads orders and groups them by delivery stage', async () => {
    renderWithTheme(<DeliveryPage />)
    expect(
      screen.getByRole('heading', { name: /Lieferungen/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    expect(await screen.findByText('Max Mustermann')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders')
    // cancelled orders are not deliveries
    expect(screen.queryByText('Storno Kunde')).toBeNull()
    expect(
      screen.getByText('In Vorbereitung', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(screen.getByText('Bereit zur Auslieferung')).toBeInTheDocument()
    expect(
      screen.getByText('Zugestellt', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('33% der Lieferungen zugestellt (1 von 3)')
    ).toBeInTheDocument()
  })

  it('marks an order as ready and then as delivered', async () => {
    renderWithTheme(<DeliveryPage />)
    await screen.findByText('Max Mustermann')

    fireEvent.click(screen.getByLabelText('Bestellung 1 als bereit markieren'))
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/orders/1', {
        status: 'ready',
      })
    )
    expect(
      await screen.findByLabelText('Bestellung 1 als zugestellt markieren')
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByLabelText('Bestellung 2 als zugestellt markieren')
    )
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/orders/2', {
        status: 'delivered',
      })
    )
    expect(
      await screen.findByText('Bestellung #2: Zugestellt')
    ).toBeInTheDocument()
  })

  it('shows empty and error states', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: [] })
    const { unmount } = renderWithTheme(<DeliveryPage />)
    expect(
      await screen.findByText('Keine Lieferungen vorhanden.')
    ).toBeInTheDocument()
    unmount()

    apiClient.get.mockRejectedValueOnce(new Error('Timeout'))
    renderWithTheme(<DeliveryPage />)
    expect(await screen.findByText('Timeout')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erneut versuchen' })
    ).toBeInTheDocument()
  })
})
