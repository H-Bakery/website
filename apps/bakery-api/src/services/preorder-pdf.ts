/**
 * Bestellschein: eine Vorbestellung als PDF zum Ausdrucken („Als PDF
 * drucken“ auf der Detailseite). Ein Blatt A4 mit dem Briefkopf der Bäckerei
 * (dieselben Bausteine wie die Rechnung, `pdf-kit.ts`).
 *
 * **Keine Rechnung** - das steht auf dem Blatt. Kein PDF/A, keine XML, nichts
 * wird gespeichert. Gezeichnet wird genau, was `GET /api/preorders/:id`
 * antwortet (`PreorderDto`): eine anonymisierte Bestellung zeigt deshalb auch
 * hier weder Name noch Telefon noch Bemerkung. Gerechnet wird nichts -
 * Zeilensummen, Gesamtbetrag und offener Betrag kommen aus der Bestellung
 * (`delivery-preorders.core.js`), die Euro-Darstellung aus `invoice.core.js`.
 */
import type { PreorderDto } from './preorders.service'
import {
  BLACK,
  CONTENT_WIDTH,
  GREY,
  LIGHT,
  LetterheadSeller,
  MARGIN,
  PAGE_BOTTOM,
  RED,
  RIGHT,
  drawFooters,
  drawLetterhead,
  footerColumns,
  formatBerlinDate,
  metaText,
  openDocument,
} from './pdf-kit'

/* eslint-disable @typescript-eslint/no-var-requires */
const invoiceCore = require('./invoice.core')
const preorderCore = require('./delivery-preorders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface RenderPreorderOptions {
  preorder: PreorderDto
  /** Briefkopf: die Impressumsangaben (`currentSeller()`); ohne Bank. */
  seller: LetterheadSeller
  /** Zeitpunkt des Ausdrucks („Stand“ in der Fußzeile, PDF-Metadaten). */
  createdAt: Date
}

/** Steht unter dem Titel und in den PDF-Metadaten. */
export const NOT_AN_INVOICE = 'Dieser Bestellschein ist keine Rechnung.'

interface Column {
  key: 'quantity' | 'name' | 'unitPrice' | 'lineTotal'
  label: string
  width: number
  align: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { key: 'quantity', label: 'Menge', width: 70, align: 'right' },
  { key: 'name', label: 'Artikel', width: 238.28, align: 'left' },
  { key: 'unitPrice', label: 'Einzelpreis', width: 85, align: 'right' },
  { key: 'lineTotal', label: 'Summe', width: 95, align: 'right' },
]

/** Euro-Betrag der Bestellung (`12.5`) als `12,50 €`; „–“, wenn er nicht auf Cent passt. */
function euro(value: unknown): string {
  const cents = invoiceCore.priceToCents(value)
  return cents === null ? '–' : (invoiceCore.formatEuro(cents) as string)
}

/** „Samstag, 21.11.2026“. */
function pickupDay(date: string): string {
  const weekday = preorderCore.weekdayOf(date)
  const label = weekday === null ? '' : preorderCore.WEEKDAY_LABELS[weekday]
  return `${label ? `${label}, ` : ''}${preorderCore.formatGermanDate(date)}`
}

/** „Brezel (Nuss)“ - wie die Abholliste. */
function itemName(item: { name: string; variant?: string }): string {
  return preorderCore.itemLabel(item) as string
}

/** Bezahlstand in Worten; `null`, wenn es nichts zu sagen gibt. */
function paymentText(preorder: PreorderDto): string | null {
  const balance = Number(preorder.paymentBalance) || 0
  if (!preorder.paid) {
    return preorder.status === 'storniert' ? null : 'nicht bezahlt'
  }
  const paid = `bezahlt (${euro(preorder.paidAmount ?? preorder.total)})`
  if (balance > 0) return `${paid} - noch offen: ${euro(balance)}`
  if (balance < 0) return `${paid} - zu erstatten: ${euro(-balance)}`
  return paid
}

/** Dateiname aus dem Bestellcode (nur unkritische Zeichen). */
export function preorderPdfFilename(preorder: {
  code: string
  id: number
}): string {
  const safe = String(preorder.code ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `Bestellschein-${safe || preorder.id}.pdf`
}

/** Erzeugt den Bestellschein als Buffer. Wirft `PdfFontsError` ohne Schriften. */
export function renderPreorderPdf(
  options: RenderPreorderOptions
): Promise<Buffer> {
  const { preorder, createdAt } = options
  // Der Bestellschein nennt kein Konto: bezahlt wird im Laden.
  const seller: LetterheadSeller = { ...options.seller, iban: '', bic: '' }
  const cancelled = preorder.status === 'storniert'
  const heading = `Bestellschein ${preorder.code}`

  const { doc, done } = openDocument({
    info: {
      Title: metaText(heading),
      Author: metaText(seller.name),
      Subject: metaText(`${heading} - keine Rechnung`),
      Creator: 'Bäckerei-Verwaltung',
      Producer: 'pdfkit',
      CreationDate: createdAt,
      ModDate: createdAt,
    },
  })

  drawLetterhead(doc, seller)

  // --- Titel --------------------------------------------------------------
  let y = 118
  doc.font('bold').fontSize(16).fillColor(BLACK)
  doc.text(heading, MARGIN.left, y, { width: CONTENT_WIDTH })
  y = doc.y + 3
  doc.font('regular').fontSize(9).fillColor(GREY)
  doc.text(NOT_AN_INVOICE, MARGIN.left, y, { width: CONTENT_WIDTH })
  y = doc.y + 6
  if (cancelled) {
    doc.font('bold').fontSize(14).fillColor(RED)
    doc.text('STORNIERT', MARGIN.left, y, { width: CONTENT_WIDTH })
    y = doc.y + 6
  }
  y += 8

  // --- Angaben ------------------------------------------------------------
  const point = preorder.pickupPoint
  const status = preorder.notCollected
    ? 'Nicht abgeholt'
    : preorderCore.STATUS_LABELS[preorder.status] ?? preorder.status
  const rows: Array<[string, string | null]> = [
    ['Kunde', preorder.customerName || null],
    ['Telefon', preorder.customerPhone || null],
    ['Abholtag', pickupDay(preorder.pickupDate)],
    ['Abholort', point ? point.name : 'Laden'],
    [
      point ? 'Zeitfenster' : 'Uhrzeit',
      point
        ? point.window || null
        : preorder.pickupTime
        ? `${preorder.pickupTime} Uhr`
        : null,
    ],
    [
      'Bestellweg',
      preorderCore.CHANNEL_LABELS[preorder.channel] ?? preorder.channel,
    ],
    ['Status', status],
    ['Zahlung', paymentText(preorder)],
  ]
  const labelWidth = 92
  for (const [label, value] of rows) {
    if (!value) continue
    doc.font('regular').fontSize(9).fillColor(GREY)
    doc.text(label, MARGIN.left, y + 1, { width: labelWidth })
    doc.font('bold').fontSize(10.5).fillColor(BLACK)
    doc.text(value, MARGIN.left + labelWidth, y, {
      width: CONTENT_WIDTH - labelWidth,
    })
    y = Math.max(doc.y, y + 14) + 4
  }
  y += 14

  // --- Positionen ---------------------------------------------------------
  const drawHeader = (top: number): number => {
    let x = MARGIN.left
    doc.font('bold').fontSize(8.5).fillColor(BLACK)
    for (const column of COLUMNS) {
      doc.text(column.label, x + 2, top, {
        width: column.width - 4,
        align: column.align,
      })
      x += column.width
    }
    const bottom = top + 13
    doc
      .moveTo(MARGIN.left, bottom)
      .lineTo(RIGHT, bottom)
      .lineWidth(0.8)
      .strokeColor(BLACK)
      .stroke()
    return bottom + 5
  }
  const ensureSpace = (needed: number, header: boolean) => {
    if (y + needed <= PAGE_BOTTOM) return
    doc.addPage()
    y = MARGIN.top
    if (header) y = drawHeader(y)
  }

  y = drawHeader(y)
  const nameColumn = COLUMNS[1]
  for (const item of preorder.items) {
    const quantity =
      (invoiceCore.formatQuantity(item.quantity) as string) ||
      String(item.quantity)
    const cells: Record<Column['key'], string> = {
      quantity: item.unit ? `${quantity} ${item.unit}` : quantity,
      name: itemName(item),
      unitPrice: euro(item.unitPrice),
      lineTotal: euro(item.lineTotal),
    }
    doc.font('regular').fontSize(10)
    const height = Math.max(
      doc.heightOfString(cells.name, { width: nameColumn.width - 12 }),
      12
    )
    ensureSpace(height + 9, true)
    let x = MARGIN.left
    doc.font('regular').fontSize(10).fillColor(BLACK)
    for (const column of COLUMNS) {
      const pad = column.key === 'name' ? 10 : 2
      doc.text(cells[column.key], x + pad, y, {
        width: column.width - pad - 2,
        align: column.align,
        lineBreak: column.key === 'name',
      })
      x += column.width
    }
    y += height + 4
    doc
      .moveTo(MARGIN.left, y)
      .lineTo(RIGHT, y)
      .lineWidth(0.3)
      .strokeColor(LIGHT)
      .stroke()
    y += 5
  }

  // --- Summe --------------------------------------------------------------
  ensureSpace(40, false)
  y += 4
  const sumLeft = RIGHT - 250
  doc
    .moveTo(sumLeft, y - 2)
    .lineTo(RIGHT, y - 2)
    .lineWidth(0.8)
    .strokeColor(BLACK)
    .stroke()
  y += 3
  doc.font('bold').fontSize(11.5).fillColor(BLACK)
  doc.text('Gesamt', sumLeft, y, { width: 150 })
  doc.text(euro(preorder.total), sumLeft + 150, y, {
    width: 98,
    align: 'right',
  })
  y += 18
  doc.font('regular').fontSize(8).fillColor(GREY)
  doc.text('Preise inkl. Umsatzsteuer.', sumLeft, y, {
    width: 248,
    align: 'right',
  })
  y = doc.y + 16

  // --- Bemerkung ----------------------------------------------------------
  if (preorder.note) {
    doc.font('regular').fontSize(10)
    ensureSpace(
      doc.heightOfString(preorder.note, { width: CONTENT_WIDTH }) + 16,
      false
    )
    doc.font('regular').fontSize(9).fillColor(GREY)
    doc.text('Bemerkung', MARGIN.left, y, { width: CONTENT_WIDTH })
    y = doc.y + 2
    doc.font('regular').fontSize(10).fillColor(BLACK)
    doc.text(preorder.note, MARGIN.left, y, {
      width: CONTENT_WIDTH,
      lineGap: 2,
    })
  }

  // --- Fuß auf jeder Seite ------------------------------------------------
  const printed = formatBerlinDate(createdAt)
  drawFooters(
    doc,
    footerColumns(seller, invoiceCore.formatIban),
    (page, count) =>
      `${heading} · Stand ${printed} · keine Rechnung · Seite ${page} von ${count}`
  )

  doc.end()
  return done
}
