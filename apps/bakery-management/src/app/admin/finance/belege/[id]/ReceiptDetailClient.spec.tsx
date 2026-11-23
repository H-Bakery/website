import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { apiClient } from '@bakery/shared/data-access'

import ReceiptDetailClient from './ReceiptDetailClient'
import { BookingReceipts } from '../../../../../components/receipts/BookingReceipts'
import type {
  ReceiptDetail,
  ReceiptMatch,
  ReceiptMatches,
} from '../../../../../lib/receiptsApi'

jest.mock('@bakery/shared/data-access', () => ({
  ...jest.requireActual('@bakery/shared/data-access'),
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    postFile: jest.fn(),
    getBlob: jest.fn(),
  },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const get = jest.mocked(apiClient.get)
const patch = jest.mocked(apiClient.patch)
const post = jest.mocked(apiClient.post)
const postFile = jest.mocked(apiClient.postFile)
const receipt: ReceiptDetail = {
  id: 17,
  status: 'erkannt',
  kind: 'eingangsrechnung',
  supplier_name: 'Beispiel-Mühle GmbH',
  invoice_number: 'BM-0815',
  invoice_date: '2026-11-12',
  due_date: null,
  gross_cents: 12345,
  currency: 'EUR',
  payment: 'offen',
  skonto_rate: null,
  skonto_due_date: null,
  vat_lines: [{ rate: 7, net_cents: 10000, vat_cents: 700 }],
  created_at: '2026-11-15T06:00:00Z',
  field_flags: { vat_lines: 'Netto plus Umsatzsteuer weicht ab.' },
  files: [{ id: 1, page: 1, mime: 'application/pdf', size: 10 }],
  supplier_iban_masked: null,
  extraction_pending: false,
  extraction_errors: [],
  booking_hint: null,
  duplicates: [],
}
const first: ReceiptMatch = {
  id: 'test-vorschlag-1',
  type: 'betrag',
  ambiguous: true,
  parts: [
    {
      amount_cents: 12345,
      target: {
        target_id: 17,
        kind: 'receipt',
        name: receipt.supplier_name,
        invoice_number: receipt.invoice_number,
      },
      booking: {
        id: 'abca0001',
        amount: -123.45,
        currency: 'EUR',
        status: 'vorgemerkt',
        booking_date: '2026-11-19',
        counterparty: 'Beispiel-Mühle GmbH',
        purpose: 'Testzahlung',
        booking_text: null,
      },
    },
  ],
}
const matches: ReceiptMatches = {
  available: true,
  links: [],
  proposals: [
    first,
    {
      ...first,
      id: 'test-vorschlag-2',
      parts: [
        {
          ...first.parts[0],
          booking: {
            ...first.parts[0].booking,
            id: 'abca0002',
            booking_date: '2026-11-20',
            status: 'gebucht',
          },
        },
      ],
    },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.endsWith('/matches') ? matches : receipt) as never,
  }))
  post.mockResolvedValue({ success: true })
  patch.mockResolvedValue({ success: true })
})

it('zeigt Warntexte und alle ähnlichen Treffer und verknüpft erst auf ausdrückliche Auswahl', async () => {
  renderWithTheme(<ReceiptDetailClient id={17} />)
  expect(
    await screen.findByText(/bitte prüfen – Netto plus Umsatzsteuer weicht ab/)
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'PDF 1 laden' })
  ).toBeInTheDocument()
  expect(screen.getByText(/vorgemerkt/)).toBeInTheDocument()
  expect(
    screen.getAllByText(/es gibt ähnlich passende Vorschläge/)
  ).toHaveLength(2)
  expect(post).not.toHaveBeenCalled()
  const cards = screen.getAllByText(/Passt zu:/)
  fireEvent.click(
    within(cards[1].parentElement as HTMLElement).getByRole('button', {
      name: 'Ja, verknüpfen',
    })
  )
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/transaction-links', {
      proposal_id: 'test-vorschlag-2',
    })
  )
  expect(post).toHaveBeenCalledTimes(1)
})

it('speichert die manuelle Zahlungsart und die Korrektur vor der Belegbestätigung', async () => {
  renderWithTheme(<ReceiptDetailClient id={17} />)
  const gross = await screen.findByRole('textbox', { name: 'Brutto' })
  fireEvent.change(gross, { target: { value: '123,46' } })
  fireEvent.click(screen.getByRole('button', { name: 'Bar bezahlt' }))
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
  expect(await screen.findByText('Beleg bestätigt.')).toBeInTheDocument()
  expect(patch).toHaveBeenCalledWith('/api/receipts/17', {
    gross_cents: 12346,
    payment: 'bar',
  })
  expect(post).toHaveBeenCalledWith('/api/receipts/17/confirm')
  expect(patch.mock.invocationCallOrder[0]).toBeLessThan(
    post.mock.invocationCallOrder[0]
  )
})

it('fügt eine Seite an denselben Beleg an', async () => {
  postFile.mockResolvedValue({ success: true, data: { id: 17, file_id: 2 } })
  renderWithTheme(<ReceiptDetailClient id={17} />)
  const input = await screen.findByLabelText('Seite hinzufügen', {
    selector: 'input',
  })
  const file = new File(['Testseite'], 'test.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  expect(
    await screen.findByText('Gespeichert - wird erkannt')
  ).toBeInTheDocument()
  expect(postFile).toHaveBeenCalledWith(
    '/api/receipts/17/files',
    file,
    expect.anything()
  )
})

it('kennzeichnet geschätztes Skonto und wartet auf ausdrückliche Bestätigung', async () => {
  const estimated = {
    ...first,
    type: 'skonto',
    estimated_skonto_rate: 3,
    ambiguous: false,
  }
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.endsWith('/matches')
      ? { ...matches, proposals: [estimated] }
      : receipt) as never,
  }))
  renderWithTheme(<ReceiptDetailClient id={17} />)
  expect(await screen.findByText(/3 % Skonto geschätzt/)).toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Ja, verknüpfen' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/transaction-links', {
      proposal_id: first.id,
    })
  )
})

it('zeigt nach dem Upload aus der Buchung den Teilbetrag und Rest vor der Bestätigung', async () => {
  const booking = { ...first.parts[0].booking, id: 'abcd0192', amount: -150 }
  const fromBooking = {
    ...receipt,
    gross_cents: 10000,
    booking_hint: {
      ...booking,
      allocation: {
        max_cents: 10000,
        booking_open_cents: 15000,
        receipt_open_cents: 10000,
      },
    },
  }
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.endsWith('/matches')
      ? { ...matches, proposals: [] }
      : fromBooking) as never,
  }))
  postFile.mockResolvedValue({ success: true, data: { id: 17, file_id: 1 } })
  const { rerender } = renderWithTheme(
    <BookingReceipts bookingId={booking.id} />
  )
  const upload = screen.getByLabelText('Beleg hinzufügen', {
    selector: 'input',
  })
  const file = new File(['Test-PDF'], 'test.pdf', { type: 'application/pdf' })
  fireEvent.change(upload, { target: { files: [file] } })
  const link = await screen.findByRole('link', { name: 'Beleg prüfen' })
  expect(link).toHaveAttribute('href', '/admin/finance/belege/17')
  expect(postFile).toHaveBeenCalledWith(
    '/api/receipts?buchung=abcd0192',
    file,
    expect.anything()
  )
  rerender(<ReceiptDetailClient id={17} />)

  expect(
    await screen.findByText(/Höchstens zuordnen.*100,00/)
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Danach offen auf der Buchung.*50,00/)
  ).toBeInTheDocument()
  const confirm = screen.getByRole('button', { name: 'Ja, verknüpfen' })
  expect(confirm).toBeDisabled()
  const input = screen.getByRole('textbox', { name: 'Teilbetrag in Euro' })
  fireEvent.change(input, { target: { value: '110,00' } })
  expect(confirm).toBeDisabled()
  expect(post).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: '90,00' } })
  expect(screen.getByText(/Zuordnungsbetrag.*90,00/)).toBeInTheDocument()
  expect(
    screen.getByText(/Danach offen auf der Buchung.*60,00/)
  ).toBeInTheDocument()
  expect(
    screen.getByText(/Danach offen auf dem Beleg.*10,00/)
  ).toBeInTheDocument()
  fireEvent.click(confirm)
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/transaction-links', {
      transaction_id: booking.id,
      kind: 'receipt',
      target_id: 17,
      amount_cents: 9000,
    })
  )
})

it('zeigt für ein Foto ohne Währung ein leeres Eingabefeld mit Prüfhinweis', async () => {
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.endsWith('/matches')
      ? { ...matches, proposals: [] }
      : {
          ...receipt,
          status: 'neu',
          currency: 'XXX',
          field_flags: { currency: 'Währung fehlt oder ist unklar.' },
        }) as never,
  }))
  renderWithTheme(<ReceiptDetailClient id={17} />)
  expect(await screen.findByRole('textbox', { name: 'Währung' })).toHaveValue(
    ''
  )
  expect(screen.getByText(/bitte prüfen.*Währung fehlt/)).toBeInTheDocument()
})
