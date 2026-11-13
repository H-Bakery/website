/**
 * Rechnungs-PDF: ein hybrides PDF/A-3b mit eingebetteter `factur-x.xml`
 * (ZUGFeRD/Factur-X, Profil EN 16931), erzeugt im API-Prozess mit pdfkit -
 * ohne Headless-Browser.
 *
 * Was PDF/A-3 und Factur-X verlangen und wo es hier entsteht:
 *
 *   - PDF 1.7, Teilmenge `PDF/A-3b`: pdfkit schreibt den Output-Intent mit
 *     sRGB-Profil und `pdfaid:part 3 / conformance B` in die XMP-Metadaten.
 *   - Schriften eingebettet: Liberation Sans aus `assets/fonts` (OFL); die
 *     Standardschrift Helvetica wird nie geladen (`font:` im Konstruktor).
 *   - Die XML als eingebettete Datei `factur-x.xml`, `AFRelationship`
 *     `Alternative` (die XML sagt dasselbe wie das Bild), MIME `text/xml`,
 *     im Katalog unter `/AF` und im Namensbaum `EmbeddedFiles`.
 *   - XMP mit dem Factur-X-Erweiterungsschema (`pdfaExtension:schemas`) und
 *     den Eigenschaften `fx:DocumentType`, `fx:DocumentFileName`,
 *     `fx:Version`, `fx:ConformanceLevel`.
 *
 * Das Bild zeigt genau die festgeschriebenen Zahlen der Rechnung (`InvoiceDto`
 * aus `invoices.service.ts`); gerechnet wird hier nichts.
 */
import * as fs from 'fs'
import * as path from 'path'

import type { InvoiceDto } from './invoices.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./invoice.core')
// pdfkit bringt keine Typen mit; hier steht nur, was diese Datei benutzt.
const PDFDocument: new (
  options: Record<string, unknown>
) => PdfDoc = require('pdfkit')
/* eslint-enable @typescript-eslint/no-var-requires */

interface TextOptions {
  width?: number
  align?: 'left' | 'right' | 'center'
  lineBreak?: boolean
  lineGap?: number
  ellipsis?: boolean
}

interface PdfDoc {
  y: number
  page: { margins: { bottom: number } }
  on(event: 'data', listener: (chunk: Buffer) => void): this
  on(event: 'end', listener: () => void): this
  on(event: 'error', listener: (error: Error) => void): this
  registerFont(name: string, src: string): this
  font(name: string): this
  fontSize(size: number): this
  fillColor(color: string): this
  strokeColor(color: string): this
  lineWidth(width: number): this
  moveTo(x: number, y: number): this
  lineTo(x: number, y: number): this
  stroke(): this
  text(text: string, x?: number, y?: number, options?: TextOptions): this
  heightOfString(text: string, options?: TextOptions): number
  addPage(): this
  bufferedPageRange(): { start: number; count: number }
  switchToPage(index: number): this
  file(src: Buffer, options: Record<string, unknown>): unknown
  appendXML(xml: string): void
  end(): void
}

export interface RenderInvoiceOptions {
  invoice: InvoiceDto
  /** Die festgeschriebene Factur-X-XML. */
  xml: string
  /** Zeitstempel für die PDF-Metadaten (Ausstellzeitpunkt). */
  createdAt: Date
}

const FONT_FILES = {
  regular: 'LiberationSans-Regular.ttf',
  bold: 'LiberationSans-Bold.ttf',
}

/**
 * Die Schriften liegen im Repo unter `apps/bakery-api/assets/fonts`. Der
 * Server läuft als Bundle aus `dist/apps/bakery-api/bundle/` im selben
 * Arbeitsbaum (auch auf der Box: ein Release ist ein git-Worktree), Tests
 * laufen aus `src/services/`.
 */
export class InvoiceFontsError extends Error {
  constructor(readonly searched: string[]) {
    super(
      `Rechnungs-PDF: Schriften nicht gefunden (${Object.values(
        FONT_FILES
      ).join(', ')}; gesucht in ${searched.join(', ')})`
    )
  }
}

export function fontsDir(): string {
  const candidates = [
    process.env['INVOICE_FONTS_DIR'],
    path.join(__dirname, '../../assets/fonts'),
    path.join(__dirname, '../../../../apps/bakery-api/assets/fonts'),
    path.join(process.cwd(), 'apps/bakery-api/assets/fonts'),
  ].filter((dir): dir is string => !!dir)
  const found = candidates.find((dir) =>
    Object.values(FONT_FILES).every((file) =>
      fs.existsSync(path.join(dir, file))
    )
  )
  if (!found) throw new InvoiceFontsError(candidates)
  return found
}

/**
 * `null`, wenn die Schriften da sind, sonst der Grund - für den Hinweis beim
 * Start des Servers und in `GET /api/invoices/config`.
 */
export function fontsProblem(): string | null {
  try {
    fontsDir()
    return null
  } catch (error) {
    return (error as Error).message
  }
}

/** Factur-X-Eigenschaften und ihr PDF/A-Erweiterungsschema für die XMP. */
export function facturxXmp(): string {
  const property = (name: string, description: string) => `
              <rdf:li rdf:parseType="Resource">
                <pdfaProperty:name>${name}</pdfaProperty:name>
                <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                <pdfaProperty:category>external</pdfaProperty:category>
                <pdfaProperty:description>${description}</pdfaProperty:description>
              </rdf:li>`
  return `
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${core.FACTURX_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${
        core.FACTURX_CONFORMANCE_LEVEL
      }</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${property(
                'DocumentFileName',
                'The name of the embedded XML document'
              )}${property(
    'DocumentType',
    'The type of the hybrid document in capital letters, e.g. INVOICE or ORDER'
  )}${property(
    'Version',
    'The actual version of the standard applying to the embedded XML document'
  )}${property(
    'ConformanceLevel',
    'The conformance level of the embedded XML document'
  )}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>`
}

/** Text für Info-Dictionary und XMP (pdfkit schreibt ihn dort unmaskiert). */
function metaText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[<>&\u0000-\u001f]/g, ' ').trim()
}

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = { left: 62, right: 45, top: 48, bottom: 96 }
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right
const GREY = '#555555'
const LIGHT = '#bbbbbb'
const BLACK = '#000000'

interface Column {
  key: string
  label: string
  width: number
  align: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { key: 'position', label: 'Pos.', width: 26, align: 'left' },
  { key: 'name', label: 'Bezeichnung', width: 170, align: 'left' },
  { key: 'quantity', label: 'Menge', width: 42, align: 'right' },
  { key: 'unit', label: 'Einheit', width: 42, align: 'left' },
  { key: 'unitPrice', label: 'Einzelpreis\nbrutto', width: 58, align: 'right' },
  { key: 'vatRate', label: 'USt', width: 32, align: 'right' },
  { key: 'net', label: 'Netto', width: 58, align: 'right' },
  { key: 'gross', label: 'Brutto', width: 60.28, align: 'right' },
]

/** Erzeugt das PDF/A-3b mit eingebetteter XML als Buffer. */
export function renderInvoicePdf(
  options: RenderInvoiceOptions
): Promise<Buffer> {
  const { invoice, xml, createdAt } = options
  const fonts = fontsDir()
  const regular = path.join(fonts, FONT_FILES.regular)
  const bold = path.join(fonts, FONT_FILES.bold)
  const cancelled = invoice.status === core.STATUS.CANCELLED
  const seller = invoice.seller
  const title = metaText(`Rechnung ${invoice.number ?? ''}`)

  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: MARGIN.top,
      bottom: MARGIN.bottom,
      left: MARGIN.left,
      right: MARGIN.right,
    },
    pdfVersion: '1.7',
    subset: 'PDF/A-3b',
    // Nie Helvetica: Standardschriften werden nicht eingebettet.
    font: regular,
    bufferPages: true,
    autoFirstPage: true,
    lang: 'de-DE',
    displayTitle: true,
    info: {
      Title: title,
      Author: metaText(seller.name),
      Subject: metaText(
        `Rechnung ${invoice.number ?? ''} vom ${core.formatDate(
          invoice.invoiceDate
        )}`
      ),
      Creator: 'Bäckerei-Verwaltung',
      Producer: 'pdfkit',
      CreationDate: createdAt,
      ModDate: createdAt,
    },
  })
  doc.registerFont('regular', regular)
  doc.registerFont('bold', bold)

  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // --- eingebettete XML + XMP -------------------------------------------
  doc.file(Buffer.from(xml, 'utf8'), {
    name: core.FACTURX_FILENAME,
    type: 'text/xml',
    relationship: 'Alternative',
    description: 'Factur-X/ZUGFeRD-Rechnung (EN 16931)',
    creationDate: createdAt,
    modifiedDate: createdAt,
  })
  doc.appendXML(facturxXmp())

  // --- Kopf ---------------------------------------------------------------
  const right = PAGE.width - MARGIN.right
  // „Bäckerei X, Inh. Y“: Firmenname groß, der Inhaber in der Zeile darunter.
  const comma = seller.name.indexOf(',')
  const sellerShort = comma > 0 ? seller.name.slice(0, comma) : seller.name
  const sellerOwner = comma > 0 ? seller.name.slice(comma + 1).trim() : ''
  doc.font('bold').fontSize(15).fillColor(BLACK)
  doc.text(sellerShort, MARGIN.left, MARGIN.top, {
    width: CONTENT_WIDTH,
  })
  doc.font('regular').fontSize(8.5).fillColor(GREY)
  doc.text(
    [sellerOwner, seller.street, `${seller.postcode} ${seller.city}`]
      .filter(Boolean)
      .join(' · '),
    MARGIN.left,
    doc.y + 2,
    { width: CONTENT_WIDTH }
  )

  // Anschriftfeld (DIN 5008, Form B: 45 mm von oben)
  const addressTop = 128
  doc.fontSize(6.5).fillColor(GREY)
  doc.text(
    `${sellerShort} · ${seller.street} · ${seller.postcode} ${seller.city}`,
    MARGIN.left,
    addressTop,
    { lineBreak: false }
  )
  doc
    .moveTo(MARGIN.left, addressTop + 10)
    .lineTo(MARGIN.left + 240, addressTop + 10)
    .lineWidth(0.4)
    .strokeColor(LIGHT)
    .stroke()
  doc.font('regular').fontSize(10.5).fillColor(BLACK)
  const buyer = invoice.buyer
  const buyerLines = [
    buyer.name,
    buyer.careOf,
    buyer.street,
    `${buyer.postcode} ${buyer.city}`.trim(),
    buyer.countryCode && buyer.countryCode !== 'DE' ? buyer.countryCode : '',
  ].filter(Boolean)
  doc.text(buyerLines.join('\n'), MARGIN.left, addressTop + 18, {
    width: 240,
    lineGap: 2,
  })
  const addressBottom = doc.y

  // Angaben rechts
  const infoLeft = 360
  const infoRows: Array<[string, string]> = [
    ['Rechnungsnummer', invoice.number ?? ''],
    ['Rechnungsdatum', core.formatDate(invoice.invoiceDate)],
    ['Liefer-/Leistungsdatum', core.formatDate(invoice.deliveryDate)],
  ]
  if (invoice.preorderCode) infoRows.push(['Bestellung', invoice.preorderCode])
  let infoY = addressTop + 18
  for (const [label, value] of infoRows) {
    doc.font('regular').fontSize(8.5).fillColor(GREY)
    doc.text(label, infoLeft, infoY + 1, { width: 100 })
    doc.font('bold').fontSize(9.5).fillColor(BLACK)
    doc.text(value, infoLeft + 100, infoY, {
      width: right - infoLeft - 100,
      align: 'right',
    })
    infoY = Math.max(doc.y, infoY + 14) + 3
  }

  // --- Titel --------------------------------------------------------------
  let y = Math.max(addressBottom, infoY, 232) + 26
  doc.font('bold').fontSize(16).fillColor(BLACK)
  doc.text(`Rechnung ${invoice.number ?? ''}`, MARGIN.left, y, {
    width: CONTENT_WIDTH,
  })
  y = doc.y + 4
  if (cancelled) {
    doc.font('bold').fontSize(10).fillColor('#b00020')
    doc.text(
      `STORNIERT am ${formatDateTime(invoice.cancelledAt)}${
        invoice.cancelReason ? ` - ${invoice.cancelReason}` : ''
      }`,
      MARGIN.left,
      y,
      { width: CONTENT_WIDTH }
    )
    y = doc.y + 4
  }
  y += 10

  // --- Positionen ---------------------------------------------------------
  const pageBottom = PAGE.height - MARGIN.bottom
  const drawHeader = (top: number): number => {
    let x = MARGIN.left
    doc.font('bold').fontSize(8).fillColor(BLACK)
    for (const column of COLUMNS) {
      doc.text(column.label, x + 2, top, {
        width: column.width - 4,
        align: column.align,
      })
      x += column.width
    }
    const bottom = top + 22
    doc
      .moveTo(MARGIN.left, bottom)
      .lineTo(right, bottom)
      .lineWidth(0.8)
      .strokeColor(BLACK)
      .stroke()
    return bottom + 5
  }
  const ensureSpace = (needed: number, header: boolean) => {
    if (y + needed <= pageBottom) return
    doc.addPage()
    y = MARGIN.top
    if (header) y = drawHeader(y)
  }

  y = drawHeader(y)
  for (const line of invoice.lines) {
    const cells: Record<string, string> = {
      position: String(line.position),
      name: line.name,
      quantity: core.formatQuantity(line.quantity),
      unit: line.unit,
      unitPrice: core.formatEuro(line.unitPriceGrossCents),
      vatRate: `${formatRate(line.vatRate)} %`,
      net: core.formatEuro(line.netCents),
      gross: core.formatEuro(line.grossCents),
    }
    doc.font('regular').fontSize(9)
    const nameColumn = COLUMNS[1]
    const height = Math.max(
      doc.heightOfString(cells['name'], { width: nameColumn.width - 4 }),
      11
    )
    ensureSpace(height + 8, true)
    let x = MARGIN.left
    doc.font('regular').fontSize(9).fillColor(BLACK)
    for (const column of COLUMNS) {
      doc.text(cells[column.key], x + 2, y, {
        width: column.width - 4,
        align: column.align,
        lineBreak: column.key === 'name',
      })
      x += column.width
    }
    y += height + 4
    doc
      .moveTo(MARGIN.left, y)
      .lineTo(right, y)
      .lineWidth(0.3)
      .strokeColor(LIGHT)
      .stroke()
    y += 4
  }

  // --- Summen -------------------------------------------------------------
  const vat = invoice.vat as Array<{
    rate: number
    netCents: number
    vatCents: number
  }>
  const totals = invoice.totals as Record<string, number>
  const sumRows: Array<{ label: string; value: string; bold?: boolean }> = []
  for (const group of vat) {
    sumRows.push({
      label: `Netto (${formatRate(group.rate)} % USt)`,
      value: core.formatEuro(group.netCents),
    })
    sumRows.push({
      label: `zzgl. ${formatRate(group.rate)} % Umsatzsteuer`,
      value: core.formatEuro(group.vatCents),
    })
  }
  if (vat.length > 1) {
    sumRows.push({
      label: 'Summe netto',
      value: core.formatEuro(totals['netCents']),
    })
    sumRows.push({
      label: 'Summe Umsatzsteuer',
      value: core.formatEuro(totals['vatCents']),
    })
  }
  if (totals['roundingCents'] !== 0) {
    sumRows.push({
      label: 'Rechnungsbetrag (netto + USt)',
      value: core.formatEuro(totals['grandTotalCents']),
    })
    sumRows.push({
      label: 'Rundung',
      value: core.formatEuro(totals['roundingCents']),
    })
    sumRows.push({
      label: 'Zahlbetrag (brutto)',
      value: core.formatEuro(totals['dueCents']),
      bold: true,
    })
  } else {
    sumRows.push({
      label: 'Rechnungsbetrag (brutto)',
      value: core.formatEuro(totals['dueCents']),
      bold: true,
    })
  }
  if (invoice.paid === true) {
    sumRows.push({
      label: 'Bereits bezahlt',
      value: core.formatEuro(-totals['prepaidCents']),
    })
    sumRows.push({
      label: 'Noch zu zahlen',
      value: core.formatEuro(totals['payableCents']),
      bold: true,
    })
  }
  ensureSpace(sumRows.length * 15 + 24, false)
  y += 6
  const sumLeft = right - 250
  for (const row of sumRows) {
    if (row.bold) {
      doc
        .moveTo(sumLeft, y - 2)
        .lineTo(right, y - 2)
        .lineWidth(0.8)
        .strokeColor(BLACK)
        .stroke()
      y += 3
    }
    doc
      .font(row.bold ? 'bold' : 'regular')
      .fontSize(row.bold ? 11 : 9.5)
      .fillColor(BLACK)
    doc.text(row.label, sumLeft, y, { width: 160 })
    doc.text(row.value, sumLeft + 160, y, { width: 88, align: 'right' })
    y += row.bold ? 18 : 15
  }

  // --- Zahlung ------------------------------------------------------------
  const paid = invoice.paid === true
  const paymentLines = paid
    ? [invoice.paymentTerms]
    : [
        invoice.paymentTerms,
        `Bitte überweisen Sie ${core.formatEuro(
          totals['payableCents']
        )} unter Angabe der Rechnungsnummer ${
          invoice.number ?? ''
        } auf folgendes Konto:`,
      ]
  const bankLines = [
    `Kontoinhaber: ${seller.accountHolder}`,
    `IBAN: ${core.formatIban(seller.iban)}`,
    `BIC: ${seller.bic}${seller.bankName ? ` · ${seller.bankName}` : ''}`,
  ]
  ensureSpace(110, false)
  y += 14
  doc
    .font(paid ? 'bold' : 'regular')
    .fontSize(9.5)
    .fillColor(BLACK)
  doc.text(paymentLines.join('\n'), MARGIN.left, y, {
    width: CONTENT_WIDTH,
    lineGap: 2,
  })
  y = doc.y + 6
  if (!paid) {
    doc.font('bold').fontSize(9.5)
    doc.text(bankLines.join('\n'), MARGIN.left, y, {
      width: CONTENT_WIDTH,
      lineGap: 2,
    })
    y = doc.y
  }
  y += 12
  if (invoice.note) {
    doc.font('regular').fontSize(9.5)
    ensureSpace(
      doc.heightOfString(invoice.note, { width: CONTENT_WIDTH }),
      false
    )
    doc.text(invoice.note, MARGIN.left, y, { width: CONTENT_WIDTH, lineGap: 2 })
    y = doc.y + 12
  }
  doc.font('regular').fontSize(7.5).fillColor(GREY)
  ensureSpace(24, false)
  doc.text(
    'Die Positionspreise sind Bruttopreise. Die Nettobeträge je Position sind anteilig aus der Bruttosumme je Steuersatz berechnet. ' +
      'Diese PDF enthält die Rechnung zusätzlich als XML (ZUGFeRD/Factur-X, Profil EN 16931).',
    MARGIN.left,
    y,
    { width: CONTENT_WIDTH }
  )

  // --- Fuß auf jeder Seite ------------------------------------------------
  const range = doc.bufferedPageRange()
  const footerColumns = [
    [
      sellerShort,
      sellerOwner,
      seller.street,
      `${seller.postcode} ${seller.city}`,
    ],
    [
      seller.phone ? `Telefon ${seller.phone}` : '',
      seller.email,
      seller.vatId ? `USt-IdNr. ${seller.vatId}` : '',
    ],
    seller.iban
      ? [
          seller.bankName || 'Bankverbindung',
          `IBAN ${core.formatIban(seller.iban)}`,
          `BIC ${seller.bic}`,
        ]
      : [],
  ]
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index)
    // Unter dem unteren Rand schreiben, ohne dass pdfkit eine Seite anhängt.
    doc.page.margins.bottom = 0
    const top = PAGE.height - 78
    doc
      .moveTo(MARGIN.left, top - 6)
      .lineTo(right, top - 6)
      .lineWidth(0.4)
      .strokeColor(LIGHT)
      .stroke()
    doc.font('regular').fontSize(7.5).fillColor(GREY)
    const width = CONTENT_WIDTH / 3
    footerColumns.forEach((lines, column) => {
      doc.text(
        lines.filter(Boolean).join('\n'),
        MARGIN.left + column * width,
        top,
        { width: width - 8, lineGap: 1.5 }
      )
    })
    doc.text(
      `Rechnung ${invoice.number ?? ''} · Seite ${index + 1} von ${
        range.count
      }`,
      MARGIN.left,
      PAGE.height - 30,
      { width: CONTENT_WIDTH, align: 'right', lineBreak: false }
    )
  }

  doc.end()
  return done
}

function formatRate(rate: number): string {
  return String(rate).replace('.', ',')
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
