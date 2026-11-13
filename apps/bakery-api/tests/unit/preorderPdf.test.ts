/**
 * Bestellschein: eine Vorbestellung als PDF. Synthetische Daten - erfundener
 * Verkäufer (tests/fixtures/invoice.synthetic.js), erfundene Kundin, erfundene
 * Preise.
 *
 * Mit `PDF_SAMPLE_OUT=<Ordner>` schreibt der Test die Beispiele zum Ansehen.
 */
import * as fs from 'fs'
import * as path from 'path'

import {
  NOT_AN_INVOICE,
  preorderPdfFilename,
  renderPreorderPdf,
} from '../../src/services/preorder-pdf'
import { PreorderRecord, toDto } from '../../src/services/preorders.service'
import { pdfText } from '../helpers/pdfText'

/* eslint-disable @typescript-eslint/no-var-requires */
const fixture = require('../fixtures/invoice.synthetic')
const preorderCore = require('../../src/services/delivery-preorders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const CREATED = new Date('2026-11-12T09:00:00Z')
const SAMPLE_OUT = process.env['PDF_SAMPLE_OUT']

function save(name: string, pdf: Buffer): void {
  if (!SAMPLE_OUT) return
  fs.mkdirSync(SAMPLE_OUT, { recursive: true })
  fs.writeFileSync(path.join(SAMPLE_OUT, `${name}.pdf`), pdf)
}

const ITEMS = [
  { productId: 'musterweck', name: 'Musterweck', variant: '', quantity: 40 },
  {
    productId: 'musterkranz',
    name: 'Musterkranz gefüllt',
    variant: 'schoko-kirsch',
    quantity: 2,
  },
]
const PRICES: Record<string, number> = { musterweck: 0.45, musterkranz: 12.9 }

/** Eine Bestellung, wie der Service sie aus der Datenbank liest. */
function record(extra: Partial<PreorderRecord> = {}): PreorderRecord {
  const items = (extra.items ?? ITEMS).map((item) => {
    const unitPrice = PRICES[item.productId] ?? 1
    return {
      unit: 'Stück',
      unitPrice,
      // dieselbe Rechnung wie der Service
      lineTotal: preorderCore.lineTotal(item.quantity, unitPrice) as number,
      ...item,
    }
  })
  return {
    id: 7,
    code: 'LA-2026-11-17-03',
    channel: 'telefon',
    customerName: 'Petra Probekundin',
    customerPhone: '0170 000 0001',
    pickupDate: '2026-11-17',
    pickupTime: '08:30',
    pickupPointId: null,
    status: 'offen',
    paid: false,
    paidAmount: null,
    note: 'Bitte in zwei Tüten packen.',
    pickedUpAt: null,
    notCollectedAt: null,
    anonymizedAt: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    total: preorderCore.itemsTotal(items) as number,
    ...extra,
    items,
  }
}

async function render(
  extra: Partial<PreorderRecord> = {},
  point: Parameters<typeof toDto>[1] = null
) {
  const pdf = await renderPreorderPdf({
    preorder: toDto(record(extra), point, CREATED),
    seller: fixture.SELLER,
    createdAt: CREATED,
  })
  return { pdf, raw: pdf.toString('latin1'), ...pdfText(pdf) }
}

describe('Bestellschein (Vorbestellung als PDF)', () => {
  it('zeigt Briefkopf, Bestellung, Positionen und Summe auf einem Blatt', async () => {
    const { pdf, raw, text, pages } = await render()
    save('bestellschein', pdf)

    expect(raw.startsWith('%PDF-1.7')).toBe(true)
    expect(pages).toBe(1)
    expect(text).toContain('Musterbäckerei Beispiel')
    expect(text).toContain('Bestellschein LA-2026-11-17-03')
    expect(text).toContain(NOT_AN_INVOICE)
    expect(text).toContain('Petra Probekundin')
    expect(text).toContain('0170 000 0001')
    expect(text).toContain('Dienstag, 17.11.2026')
    expect(text).toContain('Laden')
    expect(text).toContain('08:30 Uhr')
    expect(text).toContain('Telefon')
    expect(text).toContain('Offen')
    expect(text).toContain('nicht bezahlt')
    expect(text).toContain('40 Stück')
    expect(text).toContain('Musterweck')
    expect(text).toContain('Musterkranz gefüllt (Schoko-Kirsch)')
    expect(text).toContain('0,45 €')
    expect(text).toContain('18,00 €')
    expect(text).toContain('12,90 €')
    expect(text).toContain('25,80 €')
    expect(text).toContain('Gesamt')
    expect(text).toContain('43,80 €')
    expect(text).toContain('Bitte in zwei Tüten packen.')
    expect(text).toContain('Stand 12.11.2026')
    expect(text).toContain('Seite 1 von 1')
    expect(text).not.toContain('STORNIERT')
    expect(text).not.toMatch(/undefined|null|NaN/)
  })

  it('ist keine Rechnung: kein Konto, keine XML, kein PDF/A', async () => {
    const { raw, text } = await render()
    expect(text).not.toContain('IBAN')
    expect(text).not.toContain('BIC')
    expect(text).not.toContain('Musterbank')
    expect(text).not.toMatch(/(^|\n)Rechnung/)
    expect(raw).not.toContain('/EmbeddedFile')
    expect(raw).not.toContain('pdfaid:part')
    const fonts = [...raw.matchAll(/\/BaseFont \/([^\s/]+)/g)].map((m) => m[1])
    for (const font of fonts) expect(font).toMatch(/^[A-Z]{6}\+LiberationSans/)
  })

  it('druckt „STORNIERT“ auf eine stornierte Bestellung', async () => {
    const { pdf, text } = await render({ status: 'storniert' })
    save('bestellschein-storniert', pdf)
    expect(text).toContain('STORNIERT')
    expect(text).toContain('Storniert')
    // unbezahlt und storniert: kein Bezahlstand
    expect(text).not.toContain('nicht bezahlt')
  })

  it('nennt Sammelstelle, Zeitfenster und den Bezahlstand samt Rest', async () => {
    const { pdf, text } = await render(
      {
        code: 'MO-2026-11-17-01',
        channel: 'sammelstelle',
        pickupPointId: 'kindergarten-musterdorf',
        pickupTime: null,
        status: 'bereit',
        paid: true,
        paidAmount: 40,
      },
      {
        id: 'kindergarten-musterdorf',
        name: 'Kindergarten Musterdorf',
        street: 'Beispielweg 2',
        zip: '12345',
        city: 'Musterdorf',
        weekday: 2,
        window: '09:00-09:30',
        orderDeadline: null,
        notes: null,
        active: true,
        lat: null,
        lon: null,
      } as Parameters<typeof toDto>[1]
    )
    save('bestellschein-sammelstelle', pdf)
    expect(text).toContain('Kindergarten Musterdorf')
    expect(text).toContain('09:00-09:30')
    expect(text).toContain('Sammelstelle')
    expect(text).toContain('Bereit')
    expect(text).toContain('bezahlt (40,00 €) - noch offen: 3,80 €')
    expect(text).not.toContain('Uhrzeit')
  })

  it('zeigt bei einer bezahlten, stornierten Bestellung, was zu erstatten ist', async () => {
    const { text } = await render({ status: 'storniert', paid: true })
    expect(text).toContain('bezahlt (43,80 €) - zu erstatten: 43,80 €')
  })

  it('verrät bei einer anonymisierten Bestellung weder Name noch Telefon noch Bemerkung', async () => {
    // So steht sie nach dem 90-Tage-Lauf in der Datenbank.
    const { pdf, text } = await render({
      customerName: preorderCore.ANONYMIZED_NAME,
      customerPhone: null,
      note: null,
      status: 'abgeholt',
      anonymizedAt: CREATED,
    })
    save('bestellschein-anonymisiert', pdf)
    expect(text).toContain('anonymisiert')
    expect(text).not.toContain('Petra')
    expect(text).not.toContain('0170')
    expect(text).not.toContain('Bemerkung')
    expect(text).not.toContain('Tüten')
    // Kontakt der Bäckerei in der Fußzeile bleibt
    expect(text).toContain('Telefon 01234 567890')
  })

  it('bricht eine sehr lange Bestellung um, statt etwas abzuschneiden', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      productId: `artikel-${index}`,
      name: `Testgebäck Nummer ${index + 1}`,
      variant: '',
      quantity: 1,
    }))
    const { pdf, text, pages } = await render({ items } as never)
    save('bestellschein-lang', pdf)
    expect(pages).toBeGreaterThan(1)
    expect(text).toContain('Testgebäck Nummer 50')
    expect(text).toContain('50,00 €')
    expect(text).toContain(`Seite ${pages} von ${pages}`)
  })

  it('baut den Dateinamen aus dem Bestellcode', () => {
    expect(preorderPdfFilename({ code: 'LA-2026-11-17-03', id: 7 })).toBe(
      'Bestellschein-LA-2026-11-17-03.pdf'
    )
    expect(preorderPdfFilename({ code: '"; x', id: 7 })).toBe(
      'Bestellschein-x.pdf'
    )
    expect(preorderPdfFilename({ code: '', id: 7 })).toBe('Bestellschein-7.pdf')
  })
})
