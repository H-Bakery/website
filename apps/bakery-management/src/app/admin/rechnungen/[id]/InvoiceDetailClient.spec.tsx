import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import InvoiceDetailClient from './InvoiceDetailClient'
import {
  cancelInvoice,
  deleteInvoice,
  downloadInvoiceDraftPdf,
  downloadInvoiceFile,
  fetchInvoiceConfig,
  getInvoice,
  issueInvoice,
  updateInvoice,
} from '../../../../lib/invoicesApi'
import {
  CONFIG,
  draftInvoice,
  issuedInvoice,
} from '../../../../lib/testing/invoiceFixtures'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/rechnungen/12',
}))
jest.mock('../../../../lib/invoicesApi', () => ({
  ...jest.requireActual('../../../../lib/invoicesApi'),
  cancelInvoice: jest.fn(),
  deleteInvoice: jest.fn(),
  downloadInvoiceDraftPdf: jest.fn(),
  downloadInvoiceFile: jest.fn(),
  fetchInvoiceConfig: jest.fn(),
  getInvoice: jest.fn(),
  issueInvoice: jest.fn(),
  updateInvoice: jest.fn(),
}))

const mockGet = getInvoice as jest.MockedFunction<typeof getInvoice>
const mockConfig = fetchInvoiceConfig as jest.MockedFunction<
  typeof fetchInvoiceConfig
>
const mockUpdate = updateInvoice as jest.MockedFunction<typeof updateInvoice>
const mockIssue = issueInvoice as jest.MockedFunction<typeof issueInvoice>
const mockCancel = cancelInvoice as jest.MockedFunction<typeof cancelInvoice>
const mockDelete = deleteInvoice as jest.MockedFunction<typeof deleteInvoice>
const mockDraftPdf = downloadInvoiceDraftPdf as jest.MockedFunction<
  typeof downloadInvoiceDraftPdf
>
const mockDownload = downloadInvoiceFile as jest.MockedFunction<
  typeof downloadInvoiceFile
>

beforeEach(() => {
  jest.clearAllMocks()
  mockConfig.mockResolvedValue(CONFIG)
})

describe('InvoiceDetailClient - Entwurf', () => {
  it('zeigt das Formular und was zum Ausstellen noch fehlt', async () => {
    mockGet.mockResolvedValue(draftInvoice())
    renderWithTheme(<InvoiceDetailClient id={12} />)

    const missing = await screen.findByTestId('invoice-missing')
    expect(
      within(missing).getByText('Bitte eine Rechnungsnummer eintragen.')
    ).toBeInTheDocument()
    expect(
      within(missing).getByText(
        'Bitte Straße und Hausnummer des Empfängers eintragen.'
      )
    ).toBeInTheDocument()

    expect(screen.getByLabelText('Rechnungsnummer')).toHaveValue('')
    expect(screen.getByLabelText('Rechnungsdatum')).toHaveValue('2026-11-15')
    expect(screen.getByLabelText('Liefer-/Leistungsdatum')).toHaveValue(
      '2026-11-14'
    )
    expect(screen.getByLabelText('Zahlungsziel (Tage)')).toHaveValue('14')
    expect(screen.getByLabelText('Name')).toHaveValue(
      'Sportverein Beispiel e. V.'
    )
    // Positionen aus der Vorbestellung, Preis brutto, Steuersatz je Position
    const first = screen.getByRole('group', { name: 'Position 1' })
    expect(within(first).getByLabelText('Bezeichnung')).toHaveValue(
      'Mustersemmel'
    )
    expect(within(first).getByLabelText('Einzelpreis brutto (€)')).toHaveValue(
      '1,07'
    )
    expect(
      screen.getByText(/7 % ist die Vorgabe für Backwaren/)
    ).toBeInTheDocument()
    // Kein Download vor dem Ausstellen
    expect(
      screen.queryByRole('button', { name: 'PDF (ZUGFeRD)' })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('invoice-bank-warning')).not.toBeInTheDocument()
  })

  it('warnt, wenn die Bankverbindung auf der Box fehlt', async () => {
    mockGet.mockResolvedValue(draftInvoice())
    mockConfig.mockResolvedValue({
      ...CONFIG,
      bankConfigured: false,
      bankMessage: 'Die Bankverbindung der Bäckerei ist nicht eingerichtet.',
    })
    renderWithTheme(<InvoiceDetailClient id={12} />)
    expect(await screen.findByTestId('invoice-bank-warning')).toHaveTextContent(
      'Die Bankverbindung der Bäckerei ist nicht eingerichtet.'
    )
  })

  it('speichert die Eingaben mit Empfänger und Positionen', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockUpdate.mockResolvedValue(draftInvoice({ number: 'TEST-7' }))
    renderWithTheme(<InvoiceDetailClient id={12} />)

    await user.type(await screen.findByLabelText('Rechnungsnummer'), 'TEST-7')
    await user.type(
      screen.getByLabelText('Straße und Hausnummer'),
      'Testgasse 7'
    )
    await user.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    const [id, body] = mockUpdate.mock.calls[0]
    expect(id).toBe(12)
    expect(body.number).toBe('TEST-7')
    expect(body.buyer).toMatchObject({
      name: 'Sportverein Beispiel e. V.',
      street: 'Testgasse 7',
      countryCode: 'DE',
    })
    expect(body.lines).toHaveLength(2)
    expect(body.lines?.[0]).toMatchObject({
      name: 'Mustersemmel',
      quantity: '100',
      unitPriceGross: '1,07',
      vatRate: 7,
    })
  })

  it('stellt erst nach Rückfrage aus: speichern, dann ausstellen', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice({ number: 'TEST-7', missing: [] }))
    mockUpdate.mockResolvedValue(
      draftInvoice({ number: 'TEST-7', missing: [] })
    )
    mockIssue.mockResolvedValue(issuedInvoice({ number: 'TEST-7' }))
    renderWithTheme(<InvoiceDetailClient id={12} />)

    await user.click(await screen.findByRole('button', { name: 'Ausstellen' }))
    expect(mockIssue).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('nicht mehr ändern')
    await user.click(
      within(dialog).getByRole('button', { name: 'Jetzt ausstellen' })
    )

    await waitFor(() => expect(mockIssue).toHaveBeenCalledWith(12))
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    // Danach die Lese-Ansicht mit Download, kein Formular mehr
    expect(
      await screen.findByRole('button', { name: 'PDF (ZUGFeRD)' })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Rechnungsnummer')).not.toBeInTheDocument()
  })

  it('„Entwurf als PDF“ speichert erst und lädt dann die Vorschau - ohne auszustellen', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockUpdate.mockResolvedValue(draftInvoice({ number: 'TEST-7' }))
    mockDraftPdf.mockResolvedValue(undefined)
    renderWithTheme(<InvoiceDetailClient id={12} />)

    await user.type(await screen.findByLabelText('Rechnungsnummer'), 'TEST-7')
    await user.click(screen.getByRole('button', { name: 'Entwurf als PDF' }))

    await waitFor(() => expect(mockDraftPdf).toHaveBeenCalledTimes(1))
    // das PDF zeigt, was auf dem Bildschirm steht
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate.mock.calls[0][1].number).toBe('TEST-7')
    expect(mockDraftPdf.mock.calls[0][0]).toMatchObject({
      id: 12,
      number: 'TEST-7',
    })
    expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockDraftPdf.mock.invocationCallOrder[0]
    )
    expect(mockIssue).not.toHaveBeenCalled()
    expect(mockDownload).not.toHaveBeenCalled()
    // weiterhin ein Entwurf
    expect(screen.getByLabelText('Rechnungsnummer')).toBeInTheDocument()
  })

  it('lädt keine Vorschau, wenn das Speichern scheitert, und zeigt die Meldung', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockUpdate.mockRejectedValue(
      Object.assign(new Error('Diese Rechnungsnummer ist schon vergeben.'), {
        status: 409,
        code: 'number_taken',
      })
    )
    renderWithTheme(<InvoiceDetailClient id={12} />)
    await user.click(
      await screen.findByRole('button', { name: 'Entwurf als PDF' })
    )
    expect(
      await screen.findByText('Diese Rechnungsnummer ist schon vergeben.')
    ).toBeInTheDocument()
    expect(mockDraftPdf).not.toHaveBeenCalled()
  })

  it('zeigt Feldfehler der API am Feld', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockUpdate.mockRejectedValue(
      Object.assign(
        new Error('Die Rechnungsnummer TEST-1 ist schon vergeben.'),
        {
          code: 'number_taken',
          details: {
            fields: [
              { field: 'number', message: 'Diese Nummer ist schon vergeben.' },
            ],
          },
        }
      )
    )
    renderWithTheme(<InvoiceDetailClient id={12} />)
    await user.click(
      (
        await screen.findAllByRole('button', { name: 'Speichern' })
      )[0]
    )
    expect(await screen.findByTestId('invoice-error')).toHaveTextContent(
      'Die Rechnungsnummer TEST-1 ist schon vergeben.'
    )
    expect(
      screen.getByText('Diese Nummer ist schon vergeben.')
    ).toBeInTheDocument()
  })

  it('löscht einen Entwurf nach Rückfrage und geht zur Liste', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockDelete.mockResolvedValue(undefined)
    renderWithTheme(<InvoiceDetailClient id={12} />)
    await user.click(
      await screen.findByRole('button', { name: 'Entwurf löschen' })
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Löschen',
      })
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/rechnungen')
    )
    expect(mockDelete).toHaveBeenCalledWith(12)
  })
})

describe('InvoiceDetailClient - ausgestellt', () => {
  it('zeigt alle Angaben nach § 14 UStG und kein Formular', async () => {
    mockGet.mockResolvedValue(issuedInvoice())
    renderWithTheme(<InvoiceDetailClient id={12} />)

    expect(
      await screen.findByRole('heading', { name: 'Rechnung TEST-2026-0042' })
    ).toBeInTheDocument()
    const seller = screen.getByTestId('invoice-seller')
    expect(seller).toHaveTextContent(
      'Musterbäckerei Beispiel, Inh. Erika Mustermann'
    )
    expect(seller).toHaveTextContent('Beispielweg 1')
    expect(seller).toHaveTextContent('12345 Musterstadt')
    expect(seller).toHaveTextContent('USt-IdNr. DE123456789')
    const buyer = screen.getByTestId('invoice-buyer')
    expect(buyer).toHaveTextContent('Sportverein Beispiel e. V.')
    expect(buyer).toHaveTextContent('z. Hd. Max Muster')
    expect(buyer).toHaveTextContent('Testgasse 7')
    expect(buyer).toHaveTextContent('54321 Probedorf')
    const meta = screen.getByTestId('invoice-meta')
    expect(meta).toHaveTextContent('RechnungsnummerTEST-2026-0042')
    expect(meta).toHaveTextContent('Rechnungsdatum15.11.2026')
    expect(meta).toHaveTextContent('Liefer-/Leistungsdatum14.11.2026')

    const lines = screen.getByRole('table', { name: 'Positionen' })
    const row = within(lines)
      .getByText('Mustersemmel')
      .closest('tr') as HTMLElement
    expect(row).toHaveTextContent('100')
    expect(row).toHaveTextContent('1,07 €')
    expect(row).toHaveTextContent('7 %')
    expect(row).toHaveTextContent('100,00 €')
    expect(row).toHaveTextContent('107,00 €')

    const totals = screen.getByTestId('invoice-totals')
    expect(totals).toHaveTextContent('Netto (7 % USt)100,00 €')
    expect(totals).toHaveTextContent('zzgl. 7 % Umsatzsteuer7,00 €')
    expect(totals).toHaveTextContent('Netto (19 % USt)10,00 €')
    expect(totals).toHaveTextContent('zzgl. 19 % Umsatzsteuer1,90 €')
    expect(screen.getByTestId('invoice-due')).toHaveTextContent(
      'Rechnungsbetrag (brutto)118,90 €'
    )
    // Ohne Rundung keine Rundungszeile
    expect(screen.queryByTestId('invoice-rounding')).not.toBeInTheDocument()

    const payment = screen.getByTestId('invoice-payment')
    expect(payment).toHaveTextContent(
      'Zahlbar per Überweisung bis 29.11.2026 ohne Abzug.'
    )
    expect(payment).toHaveTextContent('IBAN: DE02 1203 0000 0000 2020 51')
    expect(payment).toHaveTextContent('BIC: BYLADEM1001')
    expect(payment).toHaveTextContent('Kontoinhaber: Erika Mustermann')

    expect(screen.queryByLabelText('Rechnungsnummer')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Speichern' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeInTheDocument()
  })

  it('zeigt die Rundungszeile nur, wenn die API eine Rundung liefert', async () => {
    const base = issuedInvoice()
    mockGet.mockResolvedValue(
      issuedInvoice({
        lines: [
          {
            ...base.lines[0],
            quantity: 1,
            unitPriceGrossCents: 481,
            grossCents: 481,
            netCents: 450,
          },
        ],
        vat: [
          {
            rate: 7,
            netCents: 450,
            vatCents: 32,
            grossCents: 481,
            roundingCents: -1,
          },
        ],
        totals: {
          netCents: 450,
          vatCents: 32,
          grandTotalCents: 482,
          roundingCents: -1,
          dueCents: 481,
          grossCents: 481,
          prepaidCents: 0,
          payableCents: 481,
        },
      })
    )
    renderWithTheme(<InvoiceDetailClient id={12} />)
    expect(await screen.findByTestId('invoice-rounding')).toHaveTextContent(
      'Rundung−0,01 €'
    )
    expect(screen.getByTestId('invoice-due')).toHaveTextContent(
      'Zahlbetrag (brutto)4,81 €'
    )
  })

  it('lädt PDF und XML über die API und druckt', async () => {
    const user = userEvent.setup()
    const print = jest
      .spyOn(window, 'print')
      .mockImplementation(() => undefined)
    mockGet.mockResolvedValue(issuedInvoice())
    mockDownload.mockResolvedValue(undefined)
    renderWithTheme(<InvoiceDetailClient id={12} />)

    await user.click(
      await screen.findByRole('button', { name: 'PDF (ZUGFeRD)' })
    )
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12 }),
        'pdf'
      )
    )
    await user.click(screen.getByRole('button', { name: 'XML' }))
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12 }),
        'xml'
      )
    )
    await user.click(screen.getByRole('button', { name: 'Drucken' }))
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })

  it('storniert nur mit Grund und zeigt danach den Storno-Hinweis', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(issuedInvoice())
    mockCancel.mockResolvedValue(
      issuedInvoice({
        status: 'storniert',
        cancelledAt: '2026-11-16T08:00:00.000Z',
        cancelReason: 'Falsche Anschrift',
      })
    )
    renderWithTheme(<InvoiceDetailClient id={12} />)

    await user.click(await screen.findByRole('button', { name: 'Stornieren' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Stornieren' })
    expect(confirm).toBeDisabled()
    await user.type(
      within(dialog).getByLabelText('Grund der Stornierung'),
      'Falsche Anschrift'
    )
    await user.click(confirm)

    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith(12, 'Falsche Anschrift')
    )
    const banner = await screen.findByTestId('invoice-cancelled')
    expect(banner).toHaveTextContent('Storniert am 16.11.2026')
    expect(banner).toHaveTextContent('Grund: Falsche Anschrift')
    // Eine stornierte Rechnung wird nicht noch einmal storniert
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Stornieren' })
      ).not.toBeInTheDocument()
    )
    // Das Original bleibt abrufbar, die Storno-Fassung liegt daneben
    await user.click(
      screen.getByRole('button', { name: 'Original-PDF (ZUGFeRD)' })
    )
    await waitFor(() =>
      expect(mockDownload).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 12 }),
        'pdf'
      )
    )
    await user.click(
      screen.getByRole('button', { name: 'PDF mit Storno-Vermerk' })
    )
    await waitFor(() =>
      expect(mockDownload).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 12 }),
        'pdf-storniert'
      )
    )
    expect(banner).toHaveTextContent('Original-PDF bleibt')
  })

  it('zeigt eine bezahlte Rechnung ohne Zahlungsaufforderung und Konto', async () => {
    mockGet.mockResolvedValue(
      issuedInvoice({
        paid: true,
        paidOn: '2026-11-15',
        paidMethod: 'bar',
        paymentTerms: 'Betrag bereits bezahlt am 15.11.2026 (bar).',
        totals: {
          ...issuedInvoice().totals,
          prepaidCents: 11890,
          payableCents: 0,
        },
      })
    )
    renderWithTheme(<InvoiceDetailClient id={12} />)
    expect(await screen.findByTestId('invoice-prepaid')).toHaveTextContent(
      'Bereits bezahlt−118,90 €'
    )
    expect(screen.getByTestId('invoice-payable')).toHaveTextContent(
      'Noch zu zahlen0,00 €'
    )
    const payment = screen.getByTestId('invoice-payment')
    expect(payment).toHaveTextContent(
      'Betrag bereits bezahlt am 15.11.2026 (bar).'
    )
    expect(payment).not.toHaveTextContent('IBAN')
    expect(payment).not.toHaveTextContent('Bankverbindung')
  })
})

describe('InvoiceDetailClient - Zahlung und Hinweise am Entwurf', () => {
  it('warnt bei einer bezahlten Vorbestellung und speichert „bereits bezahlt“', async () => {
    const user = userEvent.setup()
    const draft = draftInvoice({
      paid: true,
      preorderPaidCents: 11890,
      warnings: [
        'Die Vorbestellung ist mit 20,00 € als bezahlt vermerkt, die Rechnung lautet über 118,90 €.',
      ],
    })
    mockGet.mockResolvedValue(draft)
    mockUpdate.mockResolvedValue(draft)
    renderWithTheme(<InvoiceDetailClient id={12} />)

    expect(await screen.findByTestId('invoice-warnings')).toHaveTextContent(
      'als bezahlt vermerkt'
    )
    // bezahlt: Datum und Zahlart statt Zahlungsziel
    expect(
      screen.queryByLabelText('Zahlungsziel (Tage)')
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Bezahlt am'), {
      target: { value: '2026-11-15' },
    })
    await user.click(screen.getByLabelText('Zahlart'))
    await user.click(await screen.findByRole('option', { name: 'bar' }))
    await user.click(screen.getAllByRole('button', { name: 'Speichern' })[0])
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          paid: true,
          paidOn: '2026-11-15',
          paidMethod: 'bar',
        })
      )
    )
  })

  it('schickt bei „Per Überweisung“ weder Zahlungsdatum noch Zahlart', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(draftInvoice())
    mockUpdate.mockResolvedValue(draftInvoice())
    renderWithTheme(<InvoiceDetailClient id={12} />)
    expect(await screen.findByLabelText('Zahlungsziel (Tage)')).toHaveValue(
      '14'
    )
    expect(screen.queryByTestId('invoice-warnings')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Speichern' })[0])
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ paid: false, paidOn: '', paidMethod: '' })
      )
    )
  })

  it('sagt, wenn die Schriften fehlen oder der Entwurf bereinigt wurde', async () => {
    mockGet.mockResolvedValue(
      draftInvoice({ anonymizedAt: '2026-11-15T22:45:00.000Z' })
    )
    mockConfig.mockResolvedValue({
      ...CONFIG,
      pdfReady: false,
      pdfMessage: 'Das Rechnungs-PDF kann nicht erzeugt werden.',
    })
    renderWithTheme(<InvoiceDetailClient id={12} />)
    expect(await screen.findByTestId('invoice-pdf-warning')).toHaveTextContent(
      'kann nicht erzeugt werden'
    )
    expect(screen.getByTestId('invoice-anonymized')).toHaveTextContent(
      'länger als 90 Tage'
    )
  })
})
