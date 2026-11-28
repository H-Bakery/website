/**
 * Erfundene Rechnungen für die Specs - ausgedachter Verkäufer, Empfänger und
 * Beträge. Die IBAN ist die bekannte Beispiel-IBAN (gültige Prüfziffer, kein
 * echtes Konto).
 */
import type { Invoice, InvoiceConfig, InvoiceListItem } from '../invoicesApi'

export const SELLER = {
  name: 'Musterbäckerei Beispiel, Inh. Erika Mustermann',
  street: 'Beispielweg 1',
  postcode: '12345',
  city: 'Musterstadt',
  countryCode: 'DE',
  vatId: 'DE123456789',
  phone: '01234 567890',
  email: 'rechnung@musterbaeckerei.example',
  iban: 'DE02120300000000202051',
  bic: 'BYLADEM1001',
  accountHolder: 'Erika Mustermann',
  bankName: 'Musterbank',
}

export const CONFIG: InvoiceConfig = {
  vatRates: [7, 19],
  defaultVatRate: 7,
  paymentTermDays: 14,
  paymentText: 'Zahlbar per Überweisung',
  today: '2026-11-15',
  seller: SELLER,
  bankConfigured: true,
  bankMessage: null,
  paymentMethods: [
    { id: 'bar', label: 'bar' },
    { id: 'karte', label: 'Karte' },
  ],
  pdfReady: true,
  pdfMessage: null,
}

/** Ausgestellte Rechnung mit zwei Steuersätzen, ohne Rundung. */
export function issuedInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 12,
    number: 'TEST-2026-0042',
    status: 'ausgestellt',
    preorderId: 7,
    preorderCode: 'LA-2026-11-15-03',
    buyer: {
      name: 'Sportverein Beispiel e. V.',
      careOf: 'z. Hd. Max Muster',
      street: 'Testgasse 7',
      postcode: '54321',
      city: 'Probedorf',
      countryCode: 'DE',
    },
    invoiceDate: '2026-11-15',
    deliveryDate: '2026-11-14',
    paymentTermDays: 14,
    paymentText: 'Zahlbar per Überweisung',
    dueDate: '2026-11-29',
    paymentTerms: 'Zahlbar per Überweisung bis 29.11.2026 ohne Abzug.',
    note: '',
    seller: SELLER,
    lines: [
      {
        position: 1,
        productId: 'mustersemmel',
        name: 'Mustersemmel',
        unit: 'Stück',
        quantity: 100,
        unitPriceGrossCents: 107,
        vatRate: 7,
        grossCents: 10700,
        netCents: 10000,
        netUnitPrice: '1.0000',
        netBasisQuantity: '1',
      },
      {
        position: 2,
        productId: '',
        name: 'Testschorle 0,5 l',
        unit: 'Stück',
        quantity: 10,
        unitPriceGrossCents: 119,
        vatRate: 19,
        grossCents: 1190,
        netCents: 1000,
        netUnitPrice: '1.0000',
        netBasisQuantity: '1',
      },
    ],
    vat: [
      {
        rate: 7,
        netCents: 10000,
        vatCents: 700,
        grossCents: 10700,
        roundingCents: 0,
      },
      {
        rate: 19,
        netCents: 1000,
        vatCents: 190,
        grossCents: 1190,
        roundingCents: 0,
      },
    ],
    totals: {
      netCents: 11000,
      vatCents: 890,
      grandTotalCents: 11890,
      roundingCents: 0,
      dueCents: 11890,
      grossCents: 11890,
      prepaidCents: 0,
      payableCents: 11890,
    },
    paid: false,
    paidOn: null,
    paidMethod: '',
    preorderPaidCents: null,
    warnings: [],
    pdfSha256: null,
    anonymizedAt: null,
    issuable: false,
    missing: [],
    issuedAt: '2026-11-15T09:30:00.000Z',
    cancelledAt: null,
    cancelReason: '',
    createdAt: '2026-11-15T09:00:00.000Z',
    updatedAt: '2026-11-15T09:30:00.000Z',
    ...overrides,
  }
}

/** Entwurf aus einer Vorbestellung: Anschrift und Nummer fehlen noch. */
export function draftInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const issued = issuedInvoice()
  return {
    ...issued,
    number: null,
    status: 'entwurf',
    buyer: { ...issued.buyer, careOf: '', street: '', postcode: '', city: '' },
    issuable: false,
    missing: [
      { field: 'number', message: 'Bitte eine Rechnungsnummer eintragen.' },
      {
        field: 'buyer.street',
        message: 'Bitte Straße und Hausnummer des Empfängers eintragen.',
      },
    ],
    issuedAt: null,
    ...overrides,
  }
}

export function listItem(
  overrides: Partial<InvoiceListItem> = {}
): InvoiceListItem {
  return {
    id: 12,
    number: 'TEST-2026-0042',
    status: 'ausgestellt',
    preorderId: 7,
    preorderCode: 'LA-2026-11-15-03',
    buyerName: 'Sportverein Beispiel e. V.',
    invoiceDate: '2026-11-15',
    deliveryDate: '2026-11-14',
    dueDate: '2026-11-29',
    dueCents: 11890,
    issuable: false,
    issuedAt: '2026-11-15T09:30:00.000Z',
    cancelledAt: null,
    ...overrides,
  }
}
