import {
  parseReceiptXml,
  readReceiptFile,
} from '../../src/services/receipt-extractors'
import { detectExtension } from '../../src/services/receipt-files'
import { cii, EXAMPLE_IBAN, ubl } from '../fixtures/receipt.synthetic'

import * as core from '../../src/services/receipt-extract.core'
const today = '2026-11-23'

it('liest UBL einschließlich des Bruttos vor Teilzahlungen und mehrerer Steuersätze', () => {
  const result = core.extractXml(parseReceiptXml(ubl()), today)
  expect(result).toMatchObject({
    extracted_by: 'xml',
    confidence: 1,
    field_flags: {},
    fields: {
      kind: 'eingangsrechnung',
      supplier_name: 'Beispiel-Mühle & Co.',
      supplier_iban: EXAMPLE_IBAN,
      supplier_vat_id: 'DE000000000',
      invoice_number: 'BM-0815',
      invoice_date: '2026-11-12',
      due_date: '2026-11-22',
      gross_cents: 11890,
      currency: 'EUR',
      payment: 'lastschrift',
      vat_lines: [
        { rate: 7, net_cents: 10000, vat_cents: 700 },
        { rate: 19, net_cents: 1000, vat_cents: 190 },
      ],
    },
  })
})

it('liest CII-Gutschriften mit dem strukturierten Datum und der Zahlungsart', () => {
  expect(core.extractXml(parseReceiptXml(cii), today)).toMatchObject({
    extracted_by: 'xml',
    field_flags: {},
    fields: {
      kind: 'gutschrift',
      supplier_name: 'Beispiel-Mühle GmbH',
      invoice_date: '2026-11-14',
      due_date: '2026-11-27',
      gross_cents: 10700,
      payment: 'ueberweisung',
      vat_lines: [{ rate: 7, net_cents: 10000, vat_cents: 700 }],
    },
  })
})

it('lässt nur vordefinierte XML- und Zeichenreferenzen zu', () => {
  expect(() =>
    parseReceiptXml(
      '<!DOCTYPE Invoice [<!ENTITY beispiel "Test">]><Invoice>&beispiel;</Invoice>'
    )
  ).toThrow(/DOCTYPE/)
  expect(() => parseReceiptXml('<Invoice>&beispiel;</Invoice>')).toThrow()
  expect(() => parseReceiptXml('<Invoice><x></Invoice>')).toThrow()
  expect(() =>
    parseReceiptXml(
      '<Invoice>' + '<x>'.repeat(65) + '</x>'.repeat(65) + '</Invoice>'
    )
  ).toThrow(/komplex/)
  expect(parseReceiptXml('<Invoice>&#x41;&amp;</Invoice>').text).toBe('A&')
})

it('erkennt deutsch formatierte Textfelder, vollständiges Skonto und USt-Zeilen', () => {
  const text = [
    'Lieferant: Beispiel-Mühle GmbH',
    'Rechnungs-Nr.: BM-0815',
    'Rechnungsdatum: 12.11.2026',
    'Fällig am 22.11.2026',
    '2 % Skonto bis 18.11.2026',
    'USt-IdNr.: DE000000000',
    'IBAN: DE89 3704 0044 0532 0130 00',
    'Gesamtbetrag brutto: 1.070,00 €',
    '7 % 1.000,00 70,00 1.070,00',
  ].join('\n')
  const result = core.extractText(text, today)
  expect(result.fields).toMatchObject({
    supplier_name: 'Beispiel-Mühle GmbH',
    invoice_number: 'BM-0815',
    invoice_date: '2026-11-12',
    due_date: '2026-11-22',
    supplier_iban: EXAMPLE_IBAN,
    supplier_vat_id: 'DE000000000',
    gross_cents: 107000,
    skonto_rate: 2,
    skonto_due_date: '2026-11-18',
    vat_lines: [{ rate: 7, net_cents: 100000, vat_cents: 7000 }],
  })
  expect(result.field_flags).toEqual({})
  const bad = core.extractText(
    text
      .replace('12.11.2026', '24.11.2026')
      .replace('0130 00', '0130 01')
      .replaceAll('1.070,00', '1.071,00'),
    today
  )
  expect(Object.keys(bad.field_flags)).toEqual(
    expect.arrayContaining([
      'invoice_date',
      'supplier_iban',
      'due_date',
      'vat_lines',
    ])
  )
  expect(bad.confidence).toBeLessThan(result.confidence)
  expect(core.date('31.02.2026')).toBeNull()
  expect(core.cents('12.500', true)).toBe(1250000)
})

it('prüft Dateitypen am Beginn der Datei und erkennt HEIC über die ftyp-Marken', () => {
  const heic = Buffer.alloc(20)
  heic.writeUInt32BE(20)
  heic.write('ftypmif1', 4)
  heic.write('heic', 16)
  expect(detectExtension(heic)).toBe('heic')
  expect(detectExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
  expect(detectExtension(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('png')
  expect(detectExtension(Buffer.from('%PDF-1.7\n'))).toBe('pdf')
  expect(detectExtension(Buffer.from(ubl()))).toBe('xml')
  expect(detectExtension(Buffer.from('nur Text'))).toBeNull()
})

it('lässt ein PDF bei fehlendem pdftotext für die manuelle Erfassung offen', async () => {
  const attempt = await readReceiptFile(
    {
      id: 1,
      receipt_id: 1,
      page: 1,
      role: 'original',
      path: 'test.pdf',
      mime: 'application/pdf',
      size: 5,
      sha256: '0'.repeat(64),
    },
    'test.pdf',
    today,
    './test-belege-programm-existiert-nicht/pdftotext'
  )
  expect(attempt).toMatchObject({ engine: 'textlayer', version: '1' })
  expect(attempt).not.toHaveProperty('result')
  expect(attempt).not.toHaveProperty('error')
})

it.each([
  ['Summe: 10,00 €\nSumme: 25,00 €'],
  ['Gesamtbetrag: 25,00 €\nBrutto: 26,00 €'],
])('markiert widersprüchliche Summen zur Prüfung (%s)', (text) => {
  const result = core.extractText(text, today)
  expect(result.fields.gross_cents).toBeNull()
  expect(result.field_flags.gross_cents).toMatch(
    /Mehrere unterschiedliche Summen/
  )
})

it('behält eine erkannte Skontofrist auch ohne Satz', () => {
  const result = core.extractText(
    'Gesamtbetrag: 97,00 €\nSkonto bis 23.11.2026',
    today
  )
  expect(result.fields).toMatchObject({
    skonto_rate: null,
    skonto_due_date: '2026-11-23',
  })
})
