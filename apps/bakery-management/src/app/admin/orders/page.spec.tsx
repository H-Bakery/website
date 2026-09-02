import React from 'react'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import OrdersPage from './page'

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
    items: [
      { productId: 'roggenbrot', name: 'Roggenbrot', quantity: 2, price: 4.5 },
      { productId: 'croissant', name: 'Croissant', quantity: 3, price: 1.8 },
    ],
    total: 14.4,
    status: 'pending',
    createdAt: '2026-08-15T06:00:00.000Z',
    updatedAt: '2026-08-15T06:00:00.000Z',
    pickupDate: '2026-09-05',
    pickupTime: '09:30',
    phone: '06841 555999',
    email: 'max@example.de',
    notes: 'Bitte in zwei Tüten packen.',
  },
  {
    id: '2',
    customerName: 'Anna Schmidt',
    items: [
      {
        productId: 'vollkornbrot',
        name: 'Vollkornbrot',
        quantity: 1,
        price: 3.9,
      },
    ],
    total: 3.9,
    status: 'completed',
    createdAt: '2026-08-14T06:00:00.000Z',
    updatedAt: '2026-08-14T06:00:00.000Z',
  },
]

describe('AdminOrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiClient.get.mockResolvedValue({ success: true, data: mockOrders })
    apiClient.put.mockImplementation((_url: string, body: { status: string }) =>
      Promise.resolve({ success: true, data: { ...mockOrders[0], ...body } })
    )
  })

  it('renders heading and shows loading state before data arrives', async () => {
    renderWithTheme(<OrdersPage />)
    expect(
      screen.getByRole('heading', { name: 'Bestellungen' })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('loads orders from /api/orders and renders them', async () => {
    renderWithTheme(<OrdersPage />)
    expect(await screen.findByText('Max Mustermann')).toBeInTheDocument()
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
    expect(screen.getByText('14,40 €')).toBeInTheDocument()
    expect(screen.getByText('Ausstehend')).toBeInTheDocument()
    expect(screen.getByText('Zeige 2 von 2 Bestellungen')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders')
  })

  it('opens the detail dialog and updates the status', async () => {
    renderWithTheme(<OrdersPage />)
    await screen.findByText('Max Mustermann')

    fireEvent.click(screen.getByLabelText('Bestellung 1 anzeigen'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bestellung #1')).toBeInTheDocument()
    expect(within(dialog).getByText('2 × Roggenbrot')).toBeInTheDocument()

    // Open status select inside dialog and pick a new status
    const select = within(dialog).getByLabelText('Status')
    fireEvent.mouseDown(select)
    fireEvent.click(await screen.findByRole('option', { name: 'Bereit' }))

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/api/orders/1', {
        status: 'ready',
      })
    )
    expect(await screen.findByText('Status aktualisiert')).toBeInTheDocument()
  })

  it('zeigt Abholung, Kontakt und Anmerkung einer Shop-Bestellung', async () => {
    renderWithTheme(<OrdersPage />)
    await screen.findByText('Max Mustermann')

    // Die Liste zeigt den Abholtermin, nicht das Bestelldatum - der Bäcker
    // will wissen, wann jemand vor der Theke steht.
    expect(screen.getByText(/05\.09\.2026, 09:30 Uhr/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Bestellung 1 anzeigen'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Abholung')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/05\.09\.2026, 09:30 Uhr/)
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Telefon')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: '06841 555999' })
    ).toHaveAttribute('href', 'tel:06841555999')
    expect(within(dialog).getByText('E-Mail')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: 'max@example.de' })
    ).toHaveAttribute('href', 'mailto:max@example.de')
    expect(within(dialog).getByText('Anmerkung')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Bitte in zwei Tüten packen.')
    ).toBeInTheDocument()
  })

  it('lässt Kontaktzeilen weg, wenn eine Bestellung keine Abholdaten hat', async () => {
    renderWithTheme(<OrdersPage />)
    await screen.findByText('Anna Schmidt')

    // Die beiden gesäten Mock-Bestellungen kennen keine Abholung.
    expect(screen.getByText('–')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Bestellung 2 anzeigen'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Abholung')).toBeInTheDocument()
    expect(within(dialog).getByText('–')).toBeInTheDocument()
    expect(within(dialog).queryByText('Telefon')).toBeNull()
    expect(within(dialog).queryByText('E-Mail')).toBeNull()
    expect(within(dialog).queryByText('Anmerkung')).toBeNull()
  })

  it('übernimmt customerPhone/customerEmail der TypeScript-API', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: [
        {
          ...mockOrders[1],
          customerPhone: '0170 1234567',
          customerEmail: 'anna@example.de',
        },
      ],
    })
    renderWithTheme(<OrdersPage />)
    await screen.findByText('Anna Schmidt')
    fireEvent.click(screen.getByLabelText('Bestellung 2 anzeigen'))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('link', { name: '0170 1234567' })
    ).toHaveAttribute('href', 'tel:01701234567')
    expect(
      within(dialog).getByRole('link', { name: 'anna@example.de' })
    ).toHaveAttribute('href', 'mailto:anna@example.de')
  })

  it('shows an empty state when there are no orders', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: [] })
    renderWithTheme(<OrdersPage />)
    expect(
      await screen.findByText('Keine Bestellungen vorhanden.')
    ).toBeInTheDocument()
  })

  it('shows an error with retry when loading fails', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Netzwerkfehler'))
    renderWithTheme(<OrdersPage />)
    expect(await screen.findByText('Netzwerkfehler')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Max Mustermann')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })
})
