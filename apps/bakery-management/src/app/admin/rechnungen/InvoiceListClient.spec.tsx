import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import InvoiceListClient from './InvoiceListClient'
import { createInvoice, listInvoices } from '../../../lib/invoicesApi'
import { draftInvoice, listItem } from '../../../lib/testing/invoiceFixtures'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/rechnungen',
}))
jest.mock('../../../lib/invoicesApi', () => ({
  ...jest.requireActual('../../../lib/invoicesApi'),
  listInvoices: jest.fn(),
  createInvoice: jest.fn(),
}))

const mockList = listInvoices as jest.MockedFunction<typeof listInvoices>
const mockCreate = createInvoice as jest.MockedFunction<typeof createInvoice>

beforeEach(() => jest.clearAllMocks())

describe('InvoiceListClient', () => {
  it('zeigt Nummer, Datum, Empfänger, Betrag und Status je Rechnung', async () => {
    mockList.mockResolvedValue([
      listItem(),
      listItem({
        id: 13,
        number: null,
        status: 'entwurf',
        buyerName: 'Testkundin Beispiel',
        dueCents: 481,
      }),
    ])
    renderWithTheme(<InvoiceListClient />)

    const link = await screen.findByRole('link', { name: 'TEST-2026-0042' })
    expect(link).toHaveAttribute('href', '/admin/rechnungen/12')
    const row = link.closest('tr') as HTMLElement
    expect(within(row).getByText('15.11.2026')).toBeInTheDocument()
    expect(
      within(row).getByText('Sportverein Beispiel e. V.')
    ).toBeInTheDocument()
    expect(within(row).getByText('118,90 €')).toBeInTheDocument()
    expect(within(row).getByText('Ausgestellt')).toBeInTheDocument()

    const draft = screen.getByRole('link', { name: 'ohne Nummer' })
    expect(draft).toHaveAttribute('href', '/admin/rechnungen/13')
    expect(
      within(draft.closest('tr') as HTMLElement).getByText('Entwurf')
    ).toBeInTheDocument()
  })

  it('sagt, wenn es noch keine Rechnungen gibt', async () => {
    mockList.mockResolvedValue([])
    renderWithTheme(<InvoiceListClient />)
    expect(
      await screen.findByText('Noch keine Rechnungen.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('„Neue Rechnung“ legt einen leeren Entwurf an und öffnet ihn', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(draftInvoice({ id: 31 }))
    renderWithTheme(<InvoiceListClient />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Neue Rechnung' })
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/rechnungen/31')
    )
    expect(mockCreate).toHaveBeenCalledWith()
  })

  it('zeigt die Meldung der API, wenn das Laden scheitert', async () => {
    mockList.mockRejectedValue(
      new Error('Für diese Aktion fehlt die Berechtigung.')
    )
    renderWithTheme(<InvoiceListClient />)
    expect(
      await screen.findByText('Für diese Aktion fehlt die Berechtigung.')
    ).toBeInTheDocument()
  })
})
