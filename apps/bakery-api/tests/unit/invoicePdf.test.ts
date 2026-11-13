/**
 * Rechnungs-PDF: Aufbau des hybriden PDF/A-3 mit eingebetteter Factur-X-XML.
 * Synthetische Daten (tests/fixtures/invoice.synthetic.js).
 *
 * Geprüft wird die Struktur, die sich aus den Bytes lesen lässt (Anhang,
 * `AFRelationship`, XMP-Marker, Output-Intent, eingebettete Schriften). Die
 * vollständige PDF/A-3-Konformität prüft Mustang/veraPDF in der CI
 * (`.github/workflows/invoice-conformance.yml`): mit `INVOICE_SAMPLE_OUT`
 * schreibt dieser Test dafür die Beispielrechnungen in einen Ordner.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

import { facturxXmp, renderInvoicePdf } from '../../src/services/invoice-pdf'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../../src/services/invoice.core')
const fixture = require('../fixtures/invoice.synthetic')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const CREATED = new Date('2026-11-15T09:30:00Z')
const SAMPLE_OUT = process.env['INVOICE_SAMPLE_OUT']

async function render(invoice: any, overrides: Record<string, unknown> = {}) {
  const xml = core.buildCiiXml(invoice) as string
  const pdf = await renderInvoicePdf({
    invoice: fixture.toDto(invoice, overrides),
    xml,
    createdAt: CREATED,
  })
  return { pdf, xml, text: pdf.toString('latin1') }
}

/** Alle Streams des PDFs, entpackt, wo sie mit Flate gepackt sind. */
function streams(pdf: Buffer): Buffer[] {
  const out: Buffer[] = []
  let from = 0
  for (;;) {
    const start = pdf.indexOf('stream\n', from, 'latin1')
    if (start < 0) break
    const end = pdf.indexOf('\nendstream', start, 'latin1')
    const raw = pdf.subarray(start + 7, end)
    try {
      out.push(zlib.inflateSync(raw))
    } catch {
      out.push(raw)
    }
    from = end + 10
  }
  return out
}

function save(name: string, pdf: Buffer, xml: string): void {
  if (!SAMPLE_OUT) return
  fs.mkdirSync(SAMPLE_OUT, { recursive: true })
  fs.writeFileSync(path.join(SAMPLE_OUT, `${name}.pdf`), pdf)
  fs.writeFileSync(path.join(SAMPLE_OUT, `${name}.xml`), xml)
}

describe('Rechnungs-PDF (PDF/A-3 + Factur-X)', () => {
  it('ist ein PDF 1.7 und bettet die XML unverändert als factur-x.xml ein', async () => {
    const { pdf, xml, text } = await render(fixture.mixedInvoice())
    save('rechnung-gemischt', pdf, xml)

    expect(text.startsWith('%PDF-1.7')).toBe(true)
    expect(text).toContain('/Type /EmbeddedFile')
    expect(text).toContain('/Subtype /text#2Fxml')
    expect(text).toContain('/Type /Filespec')
    expect(text).toMatch(/\/F \(factur-x\.xml\)/)
    expect(text).toMatch(/\/UF \(factur-x\.xml\)/)
    expect(text).toContain('/AFRelationship /Alternative')
    // Im Katalog verankert (PDF/A-3) und im Namensbaum auffindbar
    expect(text).toMatch(/\/AF \[\d+ 0 R\]/)
    expect(text).toContain('/EmbeddedFiles')

    const embedded = streams(pdf).find((s) =>
      s.toString('utf8').includes('<rsm:CrossIndustryInvoice')
    )
    expect(embedded?.toString('utf8')).toBe(xml)
  })

  it('trägt die XMP-Marker für PDF/A-3b und Factur-X EN 16931', async () => {
    const { text } = await render(fixture.mixedInvoice())
    expect(text).toContain('/Type /Metadata')
    expect(text).toContain('<pdfaid:part>3</pdfaid:part>')
    expect(text).toContain('<pdfaid:conformance>B</pdfaid:conformance>')
    expect(text).toContain(
      'xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"'
    )
    expect(text).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>')
    expect(text).toContain(
      '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>'
    )
    expect(text).toContain('<fx:Version>1.0</fx:Version>')
    expect(text).toContain(
      '<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>'
    )
    expect(text).toContain('<pdfaExtension:schemas>')
    expect(text).toContain(
      '<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>'
    )
    // Titel in XMP und Info-Dictionary
    expect(text).toContain('Rechnung TEST-2026-0042')
  })

  it('beschreibt im Erweiterungsschema genau die vier fx-Eigenschaften', () => {
    const names = [
      ...facturxXmp().matchAll(
        /<pdfaProperty:name>(\w+)<\/pdfaProperty:name>/g
      ),
    ].map((m) => m[1])
    expect(names.sort()).toEqual([
      'ConformanceLevel',
      'DocumentFileName',
      'DocumentType',
      'Version',
    ])
  })

  it('hat einen Output-Intent mit ICC-Profil und nur eingebettete Schriften', async () => {
    const { text } = await render(fixture.mixedInvoice())
    expect(text).toContain('/Type /OutputIntent')
    expect(text).toContain('/S /GTS_PDFA1')
    expect(text).toContain('/DestOutputProfile')
    // Jede Schrift ist eine eingebettete TrueType-Teilmenge …
    const fonts = [...text.matchAll(/\/BaseFont \/([^\s/]+)/g)].map((m) => m[1])
    expect(fonts.length).toBeGreaterThan(0)
    for (const font of fonts) expect(font).toMatch(/^[A-Z]{6}\+LiberationSans/)
    expect(text).toContain('/FontFile2')
    // … und keine der 14 Standardschriften kommt vor.
    expect(text).not.toMatch(/\/BaseFont \/(Helvetica|Times|Courier)/)
    // Keine Verschlüsselung (in PDF/A verboten)
    expect(text).not.toContain('/Encrypt')
  })

  it('ist für dieselbe Rechnung Byte für Byte gleich', async () => {
    const first = await render(fixture.mixedInvoice())
    const second = await render(fixture.mixedInvoice())
    expect(first.pdf.equals(second.pdf)).toBe(true)
  })

  it('bricht lange Rechnungen auf mehrere Seiten um', async () => {
    const { pdf, xml, text } = await render(fixture.longInvoice())
    save('rechnung-lang', pdf, xml)
    const pages = text.match(/\/Type \/Page\b/g) ?? []
    expect(pages.length).toBeGreaterThan(1)
  })

  it('rendert den Rundungsfall, die bezahlte und die stornierte Rechnung', async () => {
    const rounding = await render(fixture.roundingInvoice())
    save('rechnung-rundung', rounding.pdf, rounding.xml)
    expect(rounding.xml).toContain('<ram:RoundingAmount>')

    const paid = await render(fixture.paidInvoice())
    save('rechnung-bezahlt', paid.pdf, paid.xml)
    expect(paid.xml).toContain(
      '<ram:TotalPrepaidAmount>4.81</ram:TotalPrepaidAmount>' +
        '<ram:DuePayableAmount>0.00</ram:DuePayableAmount>'
    )
    // keine Zahlungsaufforderung und kein Konto in einer bezahlten Rechnung
    const paidText = streams(paid.pdf)
      .map((s) => s.toString('latin1'))
      .join('\n')
    expect(paid.xml).not.toContain('IBANID')
    expect(paidText).not.toContain('IBAN')

    const cancelled = await render(fixture.mixedInvoice(), {
      status: 'storniert',
      cancelledAt: '2026-11-16T08:00:00.000Z',
      cancelReason: 'Falsche Anschrift',
    })
    save('rechnung-storniert', cancelled.pdf, cancelled.xml)
    expect(cancelled.pdf.length).toBeGreaterThan(1000)
  })
})
