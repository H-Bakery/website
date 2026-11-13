import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import InvoiceFromPreorderButton from './InvoiceFromPreorderButton'
import { createInvoice } from '../../lib/invoicesApi'
import { draftInvoice } from '../../lib/testing/invoiceFixtures'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('../../lib/invoicesApi', () => ({
  ...jest.requireActual('../../lib/invoicesApi'),
  createInvoice: jest.fn(),
}))

const mockCreate = createInvoice as jest.MockedFunction<typeof createInvoice>

beforeEach(() => jest.clearAllMocks())

describe('InvoiceFromPreorderButton', () => {
  it('legt einen Entwurf aus der Vorbestellung an und öffnet ihn', async () => {
    mockCreate.mockResolvedValue(draftInvoice({ id: 21 }))
    renderWithTheme(<InvoiceFromPreorderButton preorderId={7} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Rechnung erstellen' })
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/rechnungen/21')
    )
    expect(mockCreate).toHaveBeenCalledWith({ preorderId: 7 })
  })

  it('öffnet die vorhandene Rechnung, wenn es schon eine gibt (409)', async () => {
    mockCreate.mockRejectedValue(
      Object.assign(
        new Error(
          'Für diese Vorbestellung gibt es schon einen Rechnungsentwurf.'
        ),
        { code: 'invoice_exists', details: { invoiceId: 12 } }
      )
    )
    renderWithTheme(<InvoiceFromPreorderButton preorderId={7} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Rechnung erstellen' })
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/rechnungen/12')
    )
  })

  it('zeigt die Meldung der API bei anderen Fehlern', async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error('Diese Vorbestellung gibt es nicht.'), {
        code: 'preorder_not_found',
      })
    )
    renderWithTheme(<InvoiceFromPreorderButton preorderId={7} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Rechnung erstellen' })
    )
    expect(
      await screen.findByText('Diese Vorbestellung gibt es nicht.')
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
