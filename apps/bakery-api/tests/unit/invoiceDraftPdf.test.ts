/**
 * Vorschau eines Rechnungsentwurfs („Entwurf als PDF“): dasselbe Bild wie die
 * Rechnung, aber unverkennbar keine - Aufdruck auf jeder Seite, keine XML,
 * kein PDF/A, fehlende Angaben als „offen“. Synthetische Daten
 * (tests/fixtures/invoice.synthetic.js).
 *
 * Mit `PDF_SAMPLE_OUT=<Ordner>` schreibt der Test die Beispiele zum Ansehen.
 */
import * as fs from 'fs'
import * as path from 'path'

import {
  DRAFT_MARK,
  renderInvoiceDraftPdf,
  renderInvoicePdf,
} from '../../src/services/invoice-pdf'
import { pdfText } from '../helpers/pdfText'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../../src/services/invoice.core')
const fixture = require('../fixtures/invoice.synthetic')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const CREATED = new Date('2026-11-15T09:30:00Z')
const SAMPLE_OUT = process.env['PDF_SAMPLE_OUT']

function save(name: string, pdf: Buffer): void {
  if (!SAMPLE_OUT) return
  fs.mkdirSync(SAMPLE_OUT, { recursive: true })
  fs.writeFileSync(path.join(SAMPLE_OUT, `${name}.pdf`), pdf)
}

/** Der Entwurf, wie die API ihn liefert (`status: entwurf`). */
function draftDto(invoice: any, overrides: Record<string, unknown> = {}) {
  return fixture.toDto(invoice, { status: core.STATUS.DRAFT, ...overrides })
}

async function draft(invoice: any, overrides: Record<string, unknown> = {}) {
  const pdf = await renderInvoiceDraftPdf({
    invoice: draftDto(invoice, overrides),
    createdAt: CREATED,
  })
  return { pdf, raw: pdf.toString('latin1'), ...pdfText(pdf) }
}

/** Ein Entwurf, in dem noch alles fehlt: keine Nummer, kein Empfänger, keine Bank. */
function emptyDraft() {
  return {
    number: '',
    invoiceDate: null,
    deliveryDate: null,
    dueDate: null,
    paymentText: 'Zahlbar per Überweisung',
    note: '',
    preorderCode: '',
    seller: {
      ...fixture.SELLER,
      iban: '',
      bic: '',
      accountHolder: '',
      bankName: '',
    },
    buyer: {
      name: '',
      careOf: '',
      street: '',
      postcode: '',
      city: '',
      countryCode: 'DE',
    },
    lines: [],
  }
}

describe('Rechnungsentwurf als PDF (Vorschau)', () => {
  it('zeigt die Rechnung mit dem Aufdruck „ENTWURF – keine Rechnung“', async () => {
    const { pdf, raw, text, pages } = await draft(fixture.mixedInvoice())
    save('entwurf-vollstaendig', pdf)

    expect(raw.startsWith('%PDF-1.7')).toBe(true)
    expect(pages).toBe(1)
    expect(text).toContain('Rechnungsentwurf TEST-2026-0042')
    // quer über der Seite, unter dem Titel und in der Fußzeile
    expect(text.split(DRAFT_MARK).length - 1).toBe(3)
    expect(text).toContain('kein Beleg')
    // derselbe Inhalt wie die Rechnung
    expect(text).toContain('Sportverein Beispiel e. V.')
    expect(text).toContain('Brezel')
    expect(text).toContain('Rechnungsbetrag (brutto)')
    expect(text).toContain('IBAN: DE02 1203 0000 0000 2020 51')
    // … aber nie als „Rechnung <Nummer>“ betitelt
    expect(text).not.toMatch(/(^|\n)Rechnung TEST-2026-0042/)
  })

  it('bettet keine XML ein und behauptet kein PDF/A', async () => {
    const { raw, text } = await draft(fixture.mixedInvoice())
    expect(raw).not.toContain('/EmbeddedFile')
    expect(raw).not.toContain('factur-x')
    expect(raw).not.toContain('/AFRelationship')
    expect(raw).not.toContain('pdfaid:part')
    expect(raw).not.toContain('fx:DocumentType')
    expect(raw).not.toContain('/OutputIntent')
    expect(text).not.toContain('zusätzlich als XML')
    expect(text).toContain('dieses PDF enthält keine XML')
    // weiterhin nur eingebettete Schriften
    const fonts = [...raw.matchAll(/\/BaseFont \/([^\s/]+)/g)].map((m) => m[1])
    expect(fonts.length).toBeGreaterThan(0)
    for (const font of fonts) expect(font).toMatch(/^[A-Z]{6}\+LiberationSans/)
  })

  it('geht ohne Nummer, Empfänger, Positionen und Bankverbindung - Fehlendes steht als „offen“ da', async () => {
    const { pdf, text, pages } = await draft(emptyDraft())
    save('entwurf-leer', pdf)

    expect(pages).toBe(1)
    expect(text).toContain(DRAFT_MARK)
    expect(text).toMatch(/(^|\n)Rechnungsentwurf(\n|$)/)
    expect(text).toContain('(offen: Name, Straße, PLZ/Ort)')
    expect(text).toContain('Positionen: offen')
    expect(text).toContain('Rechnungsnummer (offen)')
    expect(text).toContain('Kontoinhaber: offen')
    expect(text).toContain('IBAN: offen')
    expect(text).toContain('BIC: offen')
    // Nummer, Rechnungsdatum und Leistungsdatum rechts: je „offen“
    expect(text.split('\n').filter((line) => line === 'offen')).toHaveLength(3)
    // nichts Erfundenes, nichts Technisches
    expect(text).not.toMatch(/undefined|null|NaN/)
    expect(text).not.toContain('DE02')
    expect(text).toContain('0,00 €')
  })

  it('trägt den Aufdruck auf jeder Seite', async () => {
    const { pdf, pages, streams } = await draft(fixture.longInvoice())
    save('entwurf-lang', pdf)
    expect(pages).toBeGreaterThan(1)
    expect(streams).toHaveLength(pages)
    for (const page of streams) {
      // Aufdruck + Fußzeile (die erste Seite zusätzlich unter dem Titel)
      expect(page.split(DRAFT_MARK).length - 1).toBeGreaterThanOrEqual(2)
    }
  })

  it('lässt die bezahlte Rechnung ohne Konto und Zahlungsaufforderung', async () => {
    const { text } = await draft(fixture.paidInvoice())
    expect(text).toContain('Bereits bezahlt')
    expect(text).not.toContain('IBAN:')
    expect(text).not.toContain('Bitte überweisen')
  })

  it('ist für denselben Entwurf Byte für Byte gleich', async () => {
    const first = await draft(fixture.mixedInvoice())
    const second = await draft(fixture.mixedInvoice())
    expect(first.pdf.equals(second.pdf)).toBe(true)
  })

  it('die ausgestellte Rechnung trägt keinen Entwurfs-Aufdruck', async () => {
    const invoice = fixture.mixedInvoice()
    const pdf = await renderInvoicePdf({
      invoice: fixture.toDto(invoice),
      xml: core.buildCiiXml(invoice),
      createdAt: CREATED,
    })
    const { text } = pdfText(pdf)
    expect(text).toContain('Rechnung TEST-2026-0042')
    expect(text).not.toContain('ENTWURF')
    expect(text).not.toContain('Rechnungsentwurf')
    expect(text).not.toContain('offen')
    expect(text).toContain('die Rechnung zusätzlich als XML')
  })
})
