import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InternOrdersPage from './page'
import { internOrderService } from '../../../../services/internOrderService'
import type { InternOrder } from '../../../../types'

jest.mock('../../../../services/internOrderService', () => ({
  internOrderService: {
    getAllInternOrders: jest.fn(),
    addInternOrder: jest.fn(),
    updateInternOrder: jest.fn(),
    deleteInternOrder: jest.fn(),
  },
}))

const mockedService = internOrderService as jest.Mocked<
  typeof internOrderService
>

const ORDERS: InternOrder[] = [
  {
    id: 'o-1',
    orderName: 'Mehl nachbestellen',
    description: '50 kg Type 550',
    status: 'pending',
    assignedTo: 'Julia',
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
    quantity: 50,
  },
  {
    id: 'o-2',
    orderName: 'Putzmittel',
    description: 'Spülmittel und Schwämme',
    status: 'done',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-05T08:00:00.000Z',
    items: [{ itemName: 'Spülmittel', itemQuantity: 2, unit: 'Flaschen' }],
  },
]

describe('InternOrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedService.getAllInternOrders.mockResolvedValue([...ORDERS])
    mockedService.addInternOrder.mockImplementation(async (data) => ({
      ...data,
      id: 'o-new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    mockedService.updateInternOrder.mockImplementation(async (id, updates) => ({
      ...(ORDERS.find((o) => o.id === id) as InternOrder),
      ...updates,
      updatedAt: new Date().toISOString(),
    }))
  })

  it('shows a loading indicator and then the list of orders', async () => {
    render(<InternOrdersPage />)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    expect(await screen.findByText('Mehl nachbestellen')).toBeInTheDocument()
    expect(screen.getByText('Putzmittel')).toBeInTheDocument()
    expect(screen.getByText('Offen')).toBeInTheDocument()
    expect(screen.getByText('Erledigt')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Interne Bestellungen' })
    ).toBeInTheDocument()
  })

  it('shows an empty state when there are no orders', async () => {
    mockedService.getAllInternOrders.mockResolvedValue([])
    render(<InternOrdersPage />)

    expect(
      await screen.findByText('Keine internen Bestellungen vorhanden.')
    ).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedService.getAllInternOrders.mockRejectedValue(new Error('boom'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn())

    render(<InternOrdersPage />)

    expect(
      await screen.findByText(/konnten nicht geladen werden/i)
    ).toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('marks an order as done from the list', async () => {
    const user = userEvent.setup()
    render(<InternOrdersPage />)
    await screen.findByText('Mehl nachbestellen')

    await user.click(
      screen.getByRole('button', { name: 'Als erledigt markieren' })
    )

    await waitFor(() =>
      expect(mockedService.updateInternOrder).toHaveBeenCalledWith('o-1', {
        status: 'done',
      })
    )
    // list is refreshed afterwards
    expect(mockedService.getAllInternOrders).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByText('Bestellung als erledigt markiert')
    ).toBeInTheDocument()
  })

  it('creates a new order via the form including an item line', async () => {
    const user = userEvent.setup()
    render(<InternOrdersPage />)
    await screen.findByText('Mehl nachbestellen')

    await user.click(screen.getByRole('button', { name: 'Neue Bestellung' }))
    expect(
      screen.getByRole('heading', { name: 'Neue interne Bestellung' })
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Bezeichnung/), 'Backpapier')
    await user.type(
      screen.getByLabelText(/Beschreibung/),
      'Für die Bleche der Frühschicht'
    )
    await user.type(screen.getByLabelText(/Zuständig/), 'Jonas')

    // add an item line
    await user.type(screen.getByLabelText('Artikel'), 'Backpapier-Rolle')
    await user.type(screen.getByLabelText('Menge'), '3')
    await user.type(screen.getByLabelText('Einheit'), 'Rollen')
    await user.click(screen.getByRole('button', { name: 'Posten hinzufügen' }))
    expect(screen.getByText('Backpapier-Rolle')).toBeInTheDocument()
    expect(screen.getByText('Menge: 3 Rollen')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bestellung anlegen' }))

    await waitFor(() =>
      expect(mockedService.addInternOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderName: 'Backpapier',
          description: 'Für die Bleche der Frühschicht',
          assignedTo: 'Jonas',
          status: 'pending',
          items: [
            { itemName: 'Backpapier-Rolle', itemQuantity: 3, unit: 'Rollen' },
          ],
        })
      )
    )

    // back to the list
    expect(
      await screen.findByRole('heading', { name: 'Interne Bestellungen' })
    ).toBeInTheDocument()
    expect(screen.getByText('Bestellung angelegt')).toBeInTheDocument()
  })

  it('opens the edit form pre-filled and cancels back to the list', async () => {
    const user = userEvent.setup()
    render(<InternOrdersPage />)
    await screen.findByText('Mehl nachbestellen')

    const row = screen.getByText('Mehl nachbestellen').closest('tr')
    expect(row).not.toBeNull()
    await user.click(
      within(row as HTMLElement).getByRole('button', { name: 'Bearbeiten' })
    )

    expect(
      screen.getByRole('heading', { name: 'Interne Bestellung bearbeiten' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Bezeichnung/)).toHaveValue(
      'Mehl nachbestellen'
    )
    expect(screen.getByLabelText(/Zuständig/)).toHaveValue('Julia')

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(
      screen.getByRole('heading', { name: 'Interne Bestellungen' })
    ).toBeInTheDocument()
    expect(mockedService.updateInternOrder).not.toHaveBeenCalled()
  })
})
