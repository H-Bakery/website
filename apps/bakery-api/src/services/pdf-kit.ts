/**
 * Gemeinsame Bausteine der PDFs, die im API-Prozess mit pdfkit entstehen
 * (Rechnung, Rechnungsentwurf, Bestellschein): Schriften, Seitenmaße,
 * Briefkopf und Fußzeile. Kein Headless-Browser.
 *
 * Die ausgestellte Rechnung (`invoice-pdf.ts`) entsteht aus denselben
 * Bausteinen: wer hier Reihenfolge oder Maße der Zeichenbefehle ändert, ändert
 * das Bild jeder künftig ausgestellten Rechnung (bereits ausgestellte liegen
 * als Bytes in der Datenbank und bleiben, wie sie sind).
 */
import * as fs from 'fs'
import * as path from 'path'

// pdfkit bringt keine Typen mit; hier steht nur, was die PDF-Dateien benutzen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument: new (
  options: Record<string, unknown>
) => PdfDoc = require('pdfkit')

export interface TextOptions {
  width?: number
  align?: 'left' | 'right' | 'center'
  lineBreak?: boolean
  lineGap?: number
  ellipsis?: boolean
}

export interface PdfDoc {
  y: number
  page: { margins: { bottom: number } }
  on(event: 'data', listener: (chunk: Buffer) => void): this
  on(event: 'end', listener: () => void): this
  on(event: 'error', listener: (error: Error) => void): this
  registerFont(name: string, src: string): this
  font(name: string): this
  fontSize(size: number): this
  fillColor(color: string): this
  fillOpacity(opacity: number): this
  strokeColor(color: string): this
  lineWidth(width: number): this
  moveTo(x: number, y: number): this
  lineTo(x: number, y: number): this
  stroke(): this
  save(): this
  restore(): this
  rotate(angle: number, options?: { origin?: [number, number] }): this
  text(text: string, x?: number, y?: number, options?: TextOptions): this
  heightOfString(text: string, options?: TextOptions): number
  widthOfString(text: string, options?: TextOptions): number
  addPage(): this
  bufferedPageRange(): { start: number; count: number }
  switchToPage(index: number): this
  file(src: Buffer, options: Record<string, unknown>): unknown
  appendXML(xml: string): void
  end(): void
}

/** Was Briefkopf und Fußzeile vom Verkäufer brauchen. */
export interface LetterheadSeller {
  name: string
  street: string
  postcode: string
  city: string
  vatId?: string
  phone?: string
  email?: string
  iban?: string
  bic?: string
  bankName?: string
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
export class PdfFontsError extends Error {
  constructor(readonly searched: string[]) {
    super(
      `PDF: Schriften nicht gefunden (${Object.values(FONT_FILES).join(
        ', '
      )}; gesucht in ${searched.join(', ')})`
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
  if (!found) throw new PdfFontsError(candidates)
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

/** Text für Info-Dictionary und XMP (pdfkit schreibt ihn dort unmaskiert). */
export function metaText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[<>&\u0000-\u001f]/g, ' ').trim()
}

export const PAGE = { width: 595.28, height: 841.89 }
export const MARGIN = { left: 62, right: 45, top: 48, bottom: 96 }
export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right
export const RIGHT = PAGE.width - MARGIN.right
export const PAGE_BOTTOM = PAGE.height - MARGIN.bottom
export const GREY = '#555555'
export const LIGHT = '#bbbbbb'
export const BLACK = '#000000'
export const RED = '#b00020'

export interface OpenDocumentOptions {
  /** Info-Dictionary (Title, Author, Subject, CreationDate …). */
  info: Record<string, unknown>
  /** Nur die ausgestellte Rechnung: `PDF/A-3b`. */
  subset?: string
}

/**
 * Ein A4-Dokument mit den eingebetteten Schriften `regular` und `bold`; das
 * Ergebnis kommt als Buffer aus `done`, sobald `doc.end()` gerufen wurde.
 * Wirft `PdfFontsError`, wenn die Schriftdateien fehlen.
 */
export function openDocument(options: OpenDocumentOptions): {
  doc: PdfDoc
  done: Promise<Buffer>
} {
  const fonts = fontsDir()
  const regular = path.join(fonts, FONT_FILES.regular)
  const bold = path.join(fonts, FONT_FILES.bold)
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: MARGIN.top,
      bottom: MARGIN.bottom,
      left: MARGIN.left,
      right: MARGIN.right,
    },
    pdfVersion: '1.7',
    ...(options.subset ? { subset: options.subset } : {}),
    // Nie Helvetica: Standardschriften werden nicht eingebettet.
    font: regular,
    bufferPages: true,
    autoFirstPage: true,
    lang: 'de-DE',
    displayTitle: true,
    info: options.info,
  })
  doc.registerFont('regular', regular)
  doc.registerFont('bold', bold)

  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  return { doc, done }
}

/** „Bäckerei X, Inh. Y“: Firmenname und der Inhaber getrennt. */
export function sellerNameParts(seller: LetterheadSeller): {
  short: string
  owner: string
} {
  const comma = seller.name.indexOf(',')
  return {
    short: comma > 0 ? seller.name.slice(0, comma) : seller.name,
    owner: comma > 0 ? seller.name.slice(comma + 1).trim() : '',
  }
}

/** Kopf der ersten Seite: Firmenname groß, Inhaber und Anschrift darunter. */
export function drawLetterhead(doc: PdfDoc, seller: LetterheadSeller): void {
  const { short, owner } = sellerNameParts(seller)
  doc.font('bold').fontSize(15).fillColor(BLACK)
  doc.text(short, MARGIN.left, MARGIN.top, {
    width: CONTENT_WIDTH,
  })
  doc.font('regular').fontSize(8.5).fillColor(GREY)
  doc.text(
    [owner, seller.street, `${seller.postcode} ${seller.city}`]
      .filter(Boolean)
      .join(' · '),
    MARGIN.left,
    doc.y + 2,
    { width: CONTENT_WIDTH }
  )
}

/**
 * Die drei Spalten der Fußzeile: Anschrift, Kontakt + USt-IdNr., Bank. Die
 * Bankspalte bleibt leer, wenn keine IBAN übergeben wird.
 */
export function footerColumns(
  seller: LetterheadSeller,
  formatIban: (iban: string) => string
): string[][] {
  const { short, owner } = sellerNameParts(seller)
  return [
    [short, owner, seller.street, `${seller.postcode} ${seller.city}`],
    [
      seller.phone ? `Telefon ${seller.phone}` : '',
      seller.email ?? '',
      seller.vatId ? `USt-IdNr. ${seller.vatId}` : '',
    ],
    seller.iban
      ? [
          seller.bankName || 'Bankverbindung',
          `IBAN ${formatIban(seller.iban)}`,
          `BIC ${seller.bic ?? ''}`,
        ]
      : [],
  ]
}

/**
 * Fuß auf jeder Seite (nach dem Inhalt aufrufen): Linie, drei Spalten und
 * rechts unten `label(Seite, Seiten)`. `eachPage` zeichnet davor etwas auf
 * jede Seite (Entwurfs-Aufdruck).
 */
export function drawFooters(
  doc: PdfDoc,
  columns: string[][],
  label: (page: number, count: number) => string,
  eachPage?: () => void
): void {
  const range = doc.bufferedPageRange()
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index)
    // Unter dem unteren Rand schreiben, ohne dass pdfkit eine Seite anhängt.
    doc.page.margins.bottom = 0
    if (eachPage) eachPage()
    const top = PAGE.height - 78
    doc
      .moveTo(MARGIN.left, top - 6)
      .lineTo(RIGHT, top - 6)
      .lineWidth(0.4)
      .strokeColor(LIGHT)
      .stroke()
    doc.font('regular').fontSize(7.5).fillColor(GREY)
    const width = CONTENT_WIDTH / 3
    columns.forEach((lines, column) => {
      doc.text(
        lines.filter(Boolean).join('\n'),
        MARGIN.left + column * width,
        top,
        { width: width - 8, lineGap: 1.5 }
      )
    })
    doc.text(label(index + 1, range.count), MARGIN.left, PAGE.height - 30, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    })
  }
}

/**
 * Schräger, blasser Aufdruck quer über die Seite (z. B. „ENTWURF – keine
 * Rechnung“). Liegt über dem Inhalt, lässt ihn aber lesbar.
 */
export function drawWatermark(doc: PdfDoc, text: string): void {
  const centerX = PAGE.width / 2
  const centerY = PAGE.height / 2
  doc.save()
  doc.rotate(-52, { origin: [centerX, centerY] })
  doc.font('bold').fontSize(50).fillColor(RED).fillOpacity(0.16)
  const width = doc.widthOfString(text)
  doc.text(text, centerX - width / 2, centerY - 25, { lineBreak: false })
  doc.fillOpacity(1)
  doc.restore()
}

/** `TT.MM.JJJJ` in Berlin; leer ohne Wert. */
export function formatBerlinDate(value: string | Date | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
