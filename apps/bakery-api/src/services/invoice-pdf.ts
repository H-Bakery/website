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
 *     Standardschrift Helvetica wird nie geladen (`openDocument` in
 *     `pdf-kit.ts`, dort auch Briefkopf und Fußzeile).
 *   - Die XML als eingebettete Datei `factur-x.xml`, `AFRelationship`
 *     `Alternative` (die XML sagt dasselbe wie das Bild), MIME `text/xml`,
 *     im Katalog unter `/AF` und im Namensbaum `EmbeddedFiles`.
 *   - XMP mit dem Factur-X-Erweiterungsschema (`pdfaExtension:schemas`) und
 *     den Eigenschaften `fx:DocumentType`, `fx:DocumentFileName`,
 *     `fx:Version`, `fx:ConformanceLevel`.
 *
 * Das Bild zeigt genau die festgeschriebenen Zahlen der Rechnung (`InvoiceDto`
 * aus `invoices.service.ts`); gerechnet wird hier nichts.
 *
 * `renderInvoiceDraftPdf()` zeichnet dasselbe Bild für einen Entwurf - als
 * Vorschau, die ausdrücklich keine Rechnung ist (kein PDF/A, keine XML).
 */
import type { InvoiceDto } from './invoices.service'
import {
  BLACK,
  CONTENT_WIDTH,
  GREY,
  LIGHT,
  MARGIN,
  PAGE_BOTTOM,
  RED,
  RIGHT,
  drawFooters,
  drawLetterhead,
  drawWatermark,
  footerColumns,
  formatBerlinDate,
  metaText,
  openDocument,
  sellerNameParts,
} from './pdf-kit'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./invoice.core')

// Die Schriften teilt sich die Rechnung mit den anderen PDFs (`pdf-kit.ts`).
export {
  PdfFontsError as InvoiceFontsError,
  fontsDir,
  fontsProblem,
} from './pdf-kit'

export interface RenderInvoiceOptions {
  invoice: InvoiceDto
  /** Die festgeschriebene Factur-X-XML. */
  xml: string
  /** Zeitstempel für die PDF-Metadaten (Ausstellzeitpunkt). */
  createdAt: Date
}

export interface RenderInvoiceDraftOptions {
  /** Der Entwurf, wie `GET /api/invoices/:id` ihn liefert. */
  invoice: InvoiceDto
  /** Zeitpunkt der Vorschau (PDF-Metadaten). */
  createdAt: Date
}

/** Steht quer über jeder Seite der Vorschau und in ihrem Titel. */
export const DRAFT_MARK = 'ENTWURF – keine Rechnung'
/** Platzhalter für eine Angabe, die im Entwurf noch fehlt. */
const OPEN = 'offen'

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
  return render(options.invoice, options.createdAt, options.xml)
}

/**
 * Vorschau eines Entwurfs: dasselbe Bild wie die Rechnung, aber **keine
 * Rechnung** - Aufdruck `DRAFT_MARK` quer über jeder Seite, Titel
 * „Rechnungsentwurf“, keine eingebettete XML, kein PDF/A. Was dem Entwurf
 * noch fehlt (Nummer, Datum, Anschrift, Bankverbindung), steht als „offen“
 * da - nichts wird erfunden. Wird nie gespeichert.
 */
export function renderInvoiceDraftPdf(
  options: RenderInvoiceDraftOptions
): Promise<Buffer> {
  return render(options.invoice, options.createdAt, null)
}

/** `xml === null`: Entwurfs-Vorschau, sonst die Rechnung. */
function render(
  invoice: InvoiceDto,
  createdAt: Date,
  xml: string | null
): Promise<Buffer> {
  const draft = xml === null
  const cancelled = !draft && invoice.status === core.STATUS.CANCELLED
  const seller = invoice.seller
  const number = invoice.number ?? ''
  /** Im Entwurf steht für eine fehlende Angabe „offen“. */
  const orOpen = (value: string): string => (draft && !value ? OPEN : value)
  const heading = draft
    ? `Rechnungsentwurf${number ? ` ${number}` : ''}`
    : `Rechnung ${number}`

  const { doc, done } = openDocument({
    ...(draft ? {} : { subset: 'PDF/A-3b' }),
    info: {
      Title: metaText(draft ? `${heading} (${DRAFT_MARK})` : heading),
      Author: metaText(seller.name),
      Subject: metaText(
        draft
          ? DRAFT_MARK
          : `Rechnung ${number} vom ${core.formatDate(invoice.invoiceDate)}`
      ),
      Creator: 'Bäckerei-Verwaltung',
      Producer: 'pdfkit',
      CreationDate: createdAt,
      ModDate: createdAt,
    },
  })

  // --- eingebettete XML + XMP (nur die Rechnung) --------------------------
  if (xml !== null) {
    doc.file(Buffer.from(xml, 'utf8'), {
      name: core.FACTURX_FILENAME,
      type: 'text/xml',
      relationship: 'Alternative',
      description: 'Factur-X/ZUGFeRD-Rechnung (EN 16931)',
      creationDate: createdAt,
      modifiedDate: createdAt,
    })
    doc.appendXML(facturxXmp())
  }

  // --- Kopf ---------------------------------------------------------------
  const right = RIGHT
  const sellerShort = sellerNameParts(seller).short
  drawLetterhead(doc, seller)

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
  if (draft) {
    // Was an der Anschrift noch fehlt, steht da - nicht einfach eine Lücke.
    const missing = [
      buyer.name ? '' : 'Name',
      buyer.street ? '' : 'Straße',
      buyer.postcode && buyer.city ? '' : 'PLZ/Ort',
    ].filter(Boolean)
    if (missing.length > 0) {
      buyerLines.push(`(${OPEN}: ${missing.join(', ')})`)
    }
  }
  doc.text(buyerLines.join('\n'), MARGIN.left, addressTop + 18, {
    width: 240,
    lineGap: 2,
  })
  const addressBottom = doc.y

  // Angaben rechts
  const infoLeft = 360
  const infoRows: Array<[string, string]> = [
    ['Rechnungsnummer', orOpen(number)],
    ['Rechnungsdatum', orOpen(core.formatDate(invoice.invoiceDate))],
    ['Liefer-/Leistungsdatum', orOpen(core.formatDate(invoice.deliveryDate))],
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
  doc.text(heading, MARGIN.left, y, {
    width: CONTENT_WIDTH,
  })
  y = doc.y + 4
  if (draft) {
    doc.font('bold').fontSize(10).fillColor(RED)
    doc.text(
      `${DRAFT_MARK}. Dieses Dokument ist eine Vorschau und kein Beleg.`,
      MARGIN.left,
      y,
      { width: CONTENT_WIDTH }
    )
    y = doc.y + 4
  }
  if (cancelled) {
    doc.font('bold').fontSize(10).fillColor(RED)
    doc.text(
      `STORNIERT am ${formatBerlinDate(invoice.cancelledAt)}${
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
  const pageBottom = PAGE_BOTTOM
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
  if (draft && invoice.lines.length === 0) {
    doc.font('regular').fontSize(9).fillColor(GREY)
    doc.text(`Positionen: ${OPEN}`, MARGIN.left + 2, y, {
      width: CONTENT_WIDTH,
    })
    y = doc.y + 8
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
          draft && !number ? `(${OPEN})` : number
        } auf folgendes Konto:`,
      ]
  const bankLines = [
    `Kontoinhaber: ${orOpen(seller.accountHolder)}`,
    `IBAN: ${orOpen(core.formatIban(seller.iban))}`,
    `BIC: ${orOpen(seller.bic)}${
      seller.bankName ? ` · ${seller.bankName}` : ''
    }`,
  ]
  ensureSpace(110, false)
  y += 14
  doc
    .font(paid ? 'bold' : 'regular')
    .fontSize(9.5)
    .fillColor(BLACK)
  doc.text(
    paymentLines.filter((line) => !draft || line).join('\n'),
    MARGIN.left,
    y,
    {
      width: CONTENT_WIDTH,
      lineGap: 2,
    }
  )
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
      (draft
        ? 'Entwurf: Beträge und Angaben können sich bis zum Ausstellen ändern; dieses PDF enthält keine XML (ZUGFeRD/Factur-X).'
        : 'Diese PDF enthält die Rechnung zusätzlich als XML (ZUGFeRD/Factur-X, Profil EN 16931).'),
    MARGIN.left,
    y,
    { width: CONTENT_WIDTH }
  )

  // --- Fuß auf jeder Seite ------------------------------------------------
  drawFooters(
    doc,
    footerColumns(seller, core.formatIban),
    (page, count) =>
      draft
        ? `${DRAFT_MARK} · Seite ${page} von ${count}`
        : `Rechnung ${number} · Seite ${page} von ${count}`,
    draft ? () => drawWatermark(doc, DRAFT_MARK) : undefined
  )

  doc.end()
  return done
}

function formatRate(rate: number): string {
  return String(rate).replace('.', ',')
}
