'use strict'

/**
 * Synthetische Rechnungen für Tests - erfundener Verkäufer, erfundene Kunden,
 * erfundene Beträge. Die IBAN ist die bekannte Beispiel-IBAN aus der
 * Bundesbank-Dokumentation (gültige Prüfziffer, kein echtes Kundenkonto).
 */
const core = require('../../src/services/invoice.core')

const SELLER = {
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

const BUYER = {
  name: 'Sportverein Beispiel e. V.',
  careOf: 'z. Hd. Max Muster',
  street: 'Testgasse 7',
  postcode: '54321',
  city: 'Probedorf',
  countryCode: 'DE',
}

/** Zwei Steuersätze, große Menge, Dezimalmenge, Sonderzeichen. */
function mixedInvoice() {
  return {
    number: 'TEST-2026-0042',
    invoiceDate: '2026-11-15',
    deliveryDate: '2026-11-15',
    dueDate: '2026-11-29',
    paymentText: 'Zahlbar per Überweisung',
    note: '',
    preorderCode: 'LA-2026-11-15-03',
    seller: { ...SELLER },
    buyer: { ...BUYER },
    lines: [
      {
        productId: 'brezel',
        name: 'Brezel',
        unit: 'Stück',
        quantity: '120',
        unitPriceGrossCents: 95,
        vatRate: 7,
      },
      {
        productId: 'partybrezel',
        name: 'Partybrezel groß & belegt <Käse>',
        unit: 'Stück',
        quantity: '3',
        unitPriceGrossCents: 3333,
        vatRate: 7,
      },
      {
        productId: '',
        name: 'Apfelschorle 0,5 l',
        unit: 'Stück',
        quantity: '7',
        unitPriceGrossCents: 199,
        vatRate: 19,
      },
      {
        productId: 'hefezopf',
        name: 'Hefezopf',
        unit: 'kg',
        quantity: '1.25',
        unitPriceGrossCents: 1290,
        vatRate: 7,
      },
    ],
  }
}

/** Ein Bruttobetrag, der bei 7 % nicht darstellbar ist (Rundung BT-114). */
function roundingInvoice() {
  return {
    ...mixedInvoice(),
    number: 'TEST-2026-0043',
    preorderCode: '',
    buyer: { ...BUYER, careOf: '' },
    lines: [
      {
        productId: 'brot',
        name: 'Bauernbrot 1000 g',
        unit: 'Stück',
        quantity: '1',
        unitPriceGrossCents: 481,
        vatRate: 7,
      },
    ],
  }
}

/** So viele Positionen, dass die PDF mehrere Seiten braucht. */
function longInvoice() {
  const lines = []
  for (let i = 1; i <= 70; i += 1) {
    lines.push({
      productId: `artikel-${i}`,
      name:
        i % 9 === 0
          ? `Testartikel ${i} mit einer langen Bezeichnung, die im Druck umbrechen muss`
          : `Testartikel ${i}`,
      unit: 'Stück',
      quantity: String((i % 12) + 1),
      unitPriceGrossCents: 35 + ((i * 37) % 400),
      vatRate: i % 10 === 0 ? 19 : 7,
    })
  }
  return { ...mixedInvoice(), number: 'TEST-2026-0044', lines }
}

/** Die Antwortform der API (`InvoiceDto`), wie die PDF sie bekommt. */
function toDto(invoice, overrides = {}) {
  const computed = core.computeInvoice(invoice.lines)
  return {
    id: 1,
    number: invoice.number,
    status: core.STATUS.ISSUED,
    preorderId: null,
    preorderCode: invoice.preorderCode || null,
    buyer: invoice.buyer,
    invoiceDate: invoice.invoiceDate,
    deliveryDate: invoice.deliveryDate,
    paymentTermDays: 14,
    paymentText: invoice.paymentText,
    dueDate: invoice.dueDate,
    paymentTerms: core.paymentTermsText(invoice),
    note: invoice.note,
    seller: invoice.seller,
    lines: computed.lines.map((line, index) => ({
      position: index + 1,
      productId: line.productId,
      name: line.name,
      unit: line.unit,
      quantity: Number(line.quantity),
      unitPriceGrossCents: line.unitPriceGrossCents,
      vatRate: line.vatRate,
      grossCents: line.grossCents,
      netCents: line.netCents,
      netUnitPrice: line.netUnitPrice,
      netBasisQuantity: line.netBasisQuantity,
    })),
    vat: computed.vat,
    totals: computed.totals,
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

module.exports = {
  SELLER,
  BUYER,
  mixedInvoice,
  roundingInvoice,
  longInvoice,
  toDto,
}
