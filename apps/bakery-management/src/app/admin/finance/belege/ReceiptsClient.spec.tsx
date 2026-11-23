import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { apiClient, ApiError } from '@bakery/shared/data-access'

import ReceiptsClient from './ReceiptsClient'
import { BookingReceipts } from '../../../../components/receipts/BookingReceipts'
import { isPathAllowedForRole } from '../../../../lib/roles'

jest.mock('@bakery/shared/data-access', () => ({
  ...jest.requireActual('@bakery/shared/data-access'),
  apiClient: { get: jest.fn(), postFile: jest.fn() },
}))

const get = jest.mocked(apiClient.get)
const postFile = jest.mocked(apiClient.postFile)

beforeEach(() => {
  jest.clearAllMocks()
  get.mockResolvedValue({ success: true, data: { receipts: [] } })
})

it('beschränkt die Belegseiten auf den Inhaber mit persönlicher Sitzung', () => {
  expect(
    isPathAllowedForRole('/admin/finance/belege/1', 'inhaber', 'personal')
  ).toBe(true)
  expect(
    isPathAllowedForRole('/admin/finance/belege/1', 'verkauf', 'personal')
  ).toBe(false)
  expect(
    isPathAllowedForRole('/admin/finance/belege/1', 'inhaber', 'station')
  ).toBe(false)
})

it('bietet Umgebungskamera und PDF/XML an und bestätigt die Ablage sofort nach dem Upload', async () => {
  postFile.mockResolvedValue({ success: true, data: { id: 17, file_id: 1 } })
  renderWithTheme(<ReceiptsClient />)
  const photo = screen.getByLabelText('Beleg fotografieren', {
    selector: 'input',
  })
  expect(photo).toHaveAttribute('capture', 'environment')
  expect(photo).toHaveAttribute('accept', 'image/*')
  const fileInput = screen.getByLabelText('Datei wählen', { selector: 'input' })
  expect(fileInput).toHaveAttribute(
    'accept',
    expect.stringContaining('.pdf,.xml')
  )
  const file = new File(['Testbild'], 'test.jpg', { type: 'image/jpeg' })
  fireEvent.change(photo, { target: { files: [file] } })
  expect(
    await screen.findByText('Gespeichert - wird erkannt')
  ).toBeInTheDocument()
  expect(postFile).toHaveBeenCalledWith('/api/receipts', file, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  expect(screen.getByRole('link', { name: 'Beleg prüfen' })).toHaveAttribute(
    'href',
    '/admin/finance/belege/17'
  )
})

it('wechselt zwischen Monatslisten und unterscheidet fehlende Bankdaten von einer leeren Liste', async () => {
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.includes('without-receipt')
      ? { available: false, transactions: [] }
      : { receipts: [] }) as never,
  }))
  renderWithTheme(<ReceiptsClient />)
  await screen.findByText('Keine Belege zur Prüfung in diesem Monat.')
  fireEvent.change(screen.getByLabelText('Monat'), {
    target: { value: '2026-08' },
  })
  fireEvent.click(screen.getByRole('tab', { name: 'Ohne Buchung' }))
  expect(
    await screen.findByText('Keine Belege ohne Buchung in diesem Monat.')
  ).toBeInTheDocument()
  expect(get).toHaveBeenCalledWith('/api/receipts/without-booking', {
    monat: '2026-08',
  })
  fireEvent.click(screen.getByRole('tab', { name: 'Ausgaben ohne Beleg' }))
  expect(
    await screen.findByText(
      'Für diesen Monat sind keine Bankbuchungen verfügbar.'
    )
  ).toBeInTheDocument()
  expect(get).toHaveBeenCalledWith(
    '/api/finance/transactions/without-receipt',
    { monat: '2026-08' }
  )
})

it('verlinkt beim Duplikat zur vorhandenen Ablage', async () => {
  const error = new ApiError(
    'Diese Datei ist bereits als Beleg gespeichert.',
    409,
    'duplicate_receipt_file'
  )
  error.details = { receipt_id: 23 }
  postFile.mockRejectedValue(error)
  renderWithTheme(<ReceiptsClient />)
  fireEvent.change(
    screen.getByLabelText('Datei wählen', { selector: 'input' }),
    {
      target: {
        files: [
          new File(['Test-PDF'], 'test.pdf', { type: 'application/pdf' }),
        ],
      },
    }
  )
  expect(
    await screen.findByRole('link', { name: 'Vorhandenen Beleg öffnen' })
  ).toHaveAttribute('href', '/admin/finance/belege/23')
})

it('zeigt Belege an der Buchung und übergibt die Buchung beim Upload als Hinweis', async () => {
  get.mockResolvedValue({
    success: true,
    data: {
      proposals: [],
      links: [
        {
          id: 1,
          kind: 'receipt',
          target_id: 8,
          amount_cents: 678,
          target: { kind: 'receipt', target_id: 8, name: 'Beispiel-Mühle' },
        },
      ],
    },
  })
  postFile.mockResolvedValue({ success: true, data: { id: 22, file_id: 1 } })
  renderWithTheme(<BookingReceipts bookingId="abcd1234" />)
  expect(
    await screen.findByRole('link', { name: 'Beleg 8 · Beispiel-Mühle' })
  ).toHaveAttribute('href', '/admin/finance/belege/8')
  const file = new File(['Test-PDF'], 'test.pdf', { type: 'application/pdf' })
  fireEvent.change(
    screen.getByLabelText('Beleg hinzufügen', { selector: 'input' }),
    { target: { files: [file] } }
  )
  await waitFor(() =>
    expect(postFile).toHaveBeenCalledWith(
      '/api/receipts?buchung=abcd1234',
      file,
      expect.anything()
    )
  )
  expect(
    await screen.findByRole('link', { name: 'Beleg prüfen' })
  ).toHaveAttribute('href', '/admin/finance/belege/22')
})

it('zeigt in der Monatskontrolle den offenen Rest neben dem ursprünglichen Buchungsbetrag', async () => {
  get.mockImplementation(async (url) => ({
    success: true,
    data: (url.includes('without-receipt')
      ? {
          available: true,
          transactions: [
            {
              id: 'abcd1901',
              booking_date: '2026-11-19',
              amount: -50,
              remaining_cents: 1200,
              currency: 'EUR',
              status: 'gebucht',
              counterparty: 'Beispielgruppe GmbH',
              booking_text: null,
              purpose: null,
            },
          ],
        }
      : { receipts: [] }) as never,
  }))
  renderWithTheme(<ReceiptsClient />)
  await screen.findByText('Keine Belege zur Prüfung in diesem Monat.')
  fireEvent.click(screen.getByRole('tab', { name: 'Ausgaben ohne Beleg' }))
  const list = await screen.findByRole('table', { name: 'Ausgaben ohne Beleg' })
  expect(
    within(list).getByRole('columnheader', { name: 'Ohne Beleg' })
  ).toBeInTheDocument()
  expect(within(list).getByText(/12,00\s*€/)).toBeInTheDocument()
  expect(within(list).getByText(/-50,00\s*€/)).toBeInTheDocument()
})
