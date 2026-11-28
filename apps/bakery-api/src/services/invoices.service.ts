/**
 * Ausgangsrechnungen: lesen, als Entwurf anlegen und ändern, ausstellen,
 * stornieren. Alle Regeln und Formeln stehen in `invoice.core.js`; diese
 * Datei liest und schreibt nur (`invoices`, `invoice_lines`, `audit_log`).
 *
 * - Ein **Entwurf** braucht keine Nummer und darf unvollständig sein.
 * - **Ausstellen** verlangt Nummer, vollständige Empfängeranschrift, Datum,
 *   Positionen und die Bankverbindung der Bäckerei. Dabei werden Verkäufer,
 *   Summen, die Factur-X-XML **und das PDF** festgeschrieben (`invoices.pdf`
 *   mit SHA-256). Danach ändert nichts mehr die Rechnung; ausgeliefert werden
 *   genau die gespeicherten Bytes, nie ein neu erzeugtes PDF.
 * - **Stornieren** markiert eine ausgestellte Rechnung; die Korrektur ist
 *   eine neue Rechnung mit neuer Nummer. Das Original-PDF bleibt abrufbar,
 *   die Fassung mit Storno-Aufdruck liegt getrennt daneben (`cancel_pdf`).
 * - **Bereits bezahlt** (`paid`, Datum, bar/Karte): die Rechnung weist den
 *   vollen Betrag als gezahlt aus und verlangt keine Überweisung.
 *
 * Fehler sind `InvoiceError`s (Status, Code, deutsche Meldung); der Router
 * antwortet damit über `sendError`.
 */
import { createHash } from 'crypto'
import type { Request } from 'express'
import { Op, Transaction, UniqueConstraintError } from 'sequelize'

import { audit } from '../auth/audit'
import { getSequelize, Invoice, InvoiceLine } from '../models'
import { currentSeller, InvoiceSeller } from './invoice-seller'
import {
  fontsProblem,
  InvoiceFontsError,
  renderInvoiceDraftPdf,
  renderInvoicePdf,
} from './invoice-pdf'
import { isFailure, PreordersService } from './preorders.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./invoice.core')
const shopOrders = require('./shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface InvoicesOptions {
  /** Vorbestellungen, aus denen ein Entwurf vorbelegt wird. */
  preorders?: Pick<PreordersService, 'get'>
  /** Verkäufer samt Bankverbindung (Vorgabe: Impressum + Umgebung). */
  seller?: () => InvoiceSeller
  /** Uhr (Tests). */
  now?: () => Date
}

export class InvoiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

export interface FieldError {
  field: string
  message: string
}

interface LineInput {
  productId: string
  name: string
  unit: string
  quantity: string
  unitPriceGrossCents: number
  vatRate: number
}

interface DraftFields {
  number: string | null
  buyerName: string
  buyerCareOf: string
  buyerStreet: string
  buyerPostcode: string
  buyerCity: string
  buyerCountry: string
  invoiceDate: string | null
  deliveryDate: string | null
  paymentTermDays: number
  paymentText: string
  note: string
  paid: boolean
  paidOn: string | null
  paidMethod: string
}

/** Die PDF-Bytes werden nur für den Download geladen, nie für Listen. */
const WITHOUT_FILES = { exclude: ['pdf', 'cancelPdf'] }

const FONTS_MESSAGE =
  'Das Rechnungs-PDF kann nicht erzeugt werden: auf der Box fehlen die Schriftdateien (apps/bakery-api/assets/fonts). Es wurde nichts verändert - bitte den Betreuer verständigen.'

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

const TEXT_LIMITS: Record<string, number> = {
  buyerName: 200,
  buyerCareOf: 200,
  buyerStreet: 200,
  buyerPostcode: 16,
  buyerCity: 200,
  paymentText: 200,
  note: 1000,
}

const FIELD_LABELS: Record<string, string> = {
  buyerName: 'Der Name des Empfängers',
  buyerCareOf: 'Der Adresszusatz',
  buyerStreet: 'Die Straße',
  buyerPostcode: 'Die Postleitzahl',
  buyerCity: 'Der Ort',
  paymentText: 'Die Zahlungsbedingung',
  note: 'Die Bemerkung',
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function invalid(errors: FieldError[]): InvoiceError {
  return new InvoiceError(
    422,
    'validation_failed',
    errors[0]?.message ?? 'Die Eingaben sind unvollständig oder ungültig.',
    { fields: errors }
  )
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/** Positionen aus dem Request in die Form des Kerns (Cent, Text-Mengen). */
function parseLines(raw: unknown): {
  lines: LineInput[]
  errors: FieldError[]
} {
  if (!Array.isArray(raw)) {
    return {
      lines: [],
      errors: [{ field: 'lines', message: 'Die Positionen fehlen.' }],
    }
  }
  const lines: LineInput[] = raw.map((entry) => {
    const line = (entry ?? {}) as Record<string, unknown>
    const cents = has(line, 'unitPriceGrossCents')
      ? line['unitPriceGrossCents']
      : core.toCents(line['unitPriceGross'])
    const rate = has(line, 'vatRate')
      ? Number(line['vatRate'])
      : core.DEFAULT_VAT_RATE
    return {
      productId: asText(line['productId']).slice(0, 128),
      name: asText(line['name']),
      unit: asText(line['unit']) || 'Stück',
      quantity: asText(line['quantity']).replace(',', '.'),
      unitPriceGrossCents: cents as number,
      vatRate: rate,
    }
  })
  return { lines, errors: core.validateLines(lines) as FieldError[] }
}

/** `computeInvoice`, aber ein Zahlenfehler ist eine Eingabe (422), kein 500. */
function compute(lines: LineInput[]) {
  try {
    return core.computeInvoice(lines)
  } catch (error) {
    if (error instanceof RangeError) {
      throw invalid([
        {
          field: 'lines',
          message: `Die Positionen lassen sich nicht berechnen (${error.message}). Bitte Mengen und Preise prüfen.`,
        },
      ])
    }
    throw error
  }
}

function lineRows(invoiceId: number, lines: LineInput[]) {
  const computed = compute(lines)
  return {
    rows: computed.lines.map(
      (line: Record<string, unknown>, index: number) => ({
        invoiceId,
        position: index + 1,
        productId: line['productId'] as string,
        name: line['name'] as string,
        unit: line['unit'] as string,
        quantity: core.milliToDecimal(line['quantityMilli']) as string,
        unitPriceGrossCents: line['unitPriceGrossCents'] as number,
        vatRate: line['vatRate'] as number,
        grossCents: line['grossCents'] as number,
        netCents: line['netCents'] as number,
        netUnitPrice: line['netUnitPrice'] as string,
        netBasisQuantity: line['netBasisQuantity'] as string,
      })
    ),
    totals: { vat: computed.vat, totals: computed.totals },
  }
}

/** Positionen einer gespeicherten Rechnung in der Form des Kerns. */
function coreLines(invoice: Invoice): LineInput[] {
  return [...(invoice.lines ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      productId: line.productId,
      name: line.name,
      unit: line.unit,
      quantity: core.milliToDecimal(core.toMilli(Number(line.quantity))),
      unitPriceGrossCents: line.unitPriceGrossCents,
      vatRate: Number(line.vatRate),
    }))
}

export interface InvoiceSnapshot {
  number: string
  invoiceDate: string | null
  deliveryDate: string | null
  dueDate: string | null
  paymentText: string
  note: string
  paid: boolean
  paidOn: string | null
  paidMethod: string
  preorderCode: string
  seller: InvoiceSeller
  buyer: {
    name: string
    careOf: string
    street: string
    postcode: string
    city: string
    countryCode: string
  }
  lines: LineInput[]
}

export class InvoicesService {
  private readonly preorders: Pick<PreordersService, 'get'> | null
  private readonly sellerSource: () => InvoiceSeller
  private readonly clock: () => Date

  constructor(options: InvoicesOptions = {}) {
    this.preorders = options.preorders ?? null
    this.sellerSource = options.seller ?? (() => currentSeller())
    this.clock = options.now ?? (() => new Date())
  }

  /** Heute in Berlin (`YYYY-MM-DD`). */
  today(): string {
    return shopOrders.berlinToday(this.clock())
  }

  // --------------------------------------------------------------- lesen

  /** Vorgaben und Stand der Einrichtung für das Formular. */
  config() {
    const seller = this.sellerSource()
    const bank = core.bankErrors(seller) as FieldError[]
    return {
      vatRates: core.VAT_RATES as number[],
      defaultVatRate: core.DEFAULT_VAT_RATE as number,
      paymentTermDays: core.DEFAULT_PAYMENT_TERM_DAYS as number,
      paymentText: core.DEFAULT_PAYMENT_TEXT as string,
      today: this.today(),
      seller,
      bankConfigured: bank.length === 0,
      bankMessage: bank[0]?.message ?? null,
      paymentMethods: Object.entries(
        core.PAYMENT_METHODS as Record<string, { label: string }>
      ).map(([id, method]) => ({ id, label: method.label })),
      // Fehlen die Schriften, lässt sich nichts ausstellen (PDF/A).
      pdfReady: fontsProblem() === null,
      pdfMessage: fontsProblem() === null ? null : FONTS_MESSAGE,
    }
  }

  private async find(id: unknown, transaction?: Transaction): Promise<Invoice> {
    const key = Number(id)
    const row =
      Number.isSafeInteger(key) && key > 0
        ? await Invoice.findByPk(key, {
            attributes: WITHOUT_FILES,
            include: [{ model: InvoiceLine, as: 'lines' }],
            transaction,
          })
        : null
    if (!row) {
      throw new InvoiceError(
        404,
        'invoice_not_found',
        'Diese Rechnung gibt es nicht.'
      )
    }
    return row
  }

  /** Der vollständige Stand, wie Kern, XML und PDF ihn brauchen. */
  private snapshot(invoice: Invoice): InvoiceSnapshot {
    const frozen = invoice.status !== core.STATUS.DRAFT && invoice.seller
    return {
      number: invoice.number ?? '',
      invoiceDate: invoice.invoiceDate ?? null,
      deliveryDate: invoice.deliveryDate ?? null,
      dueDate: invoice.dueDate ?? null,
      paymentText: invoice.paymentText,
      note: invoice.note,
      paid: invoice.paid === true,
      paidOn: invoice.paidOn ?? null,
      paidMethod: invoice.paidMethod ?? '',
      preorderCode: invoice.preorderCode ?? '',
      seller: frozen
        ? (invoice.seller as unknown as InvoiceSeller)
        : this.sellerSource(),
      buyer: {
        name: invoice.buyerName,
        careOf: invoice.buyerCareOf,
        street: invoice.buyerStreet,
        postcode: invoice.buyerPostcode,
        city: invoice.buyerCity,
        countryCode: invoice.buyerCountry,
      },
      lines: coreLines(invoice),
    }
  }

  private toDto(invoice: Invoice) {
    const snapshot = this.snapshot(invoice)
    const draft = invoice.status === core.STATUS.DRAFT
    // Entwurf: frisch gerechnet. Ausgestellt: der festgeschriebene Stand.
    const stored = invoice.totals as {
      vat: unknown[]
      totals: Record<string, number>
    } | null
    const computed = draft || !stored ? compute(snapshot.lines) : stored
    // BT-113 / BT-115; bei älteren festgeschriebenen Summen nachgerechnet.
    const totals: Record<string, number> = {
      ...core.settlement(snapshot, computed.totals),
      ...computed.totals,
    }
    const missing = draft
      ? (core.validateForIssue(snapshot, {
          today: this.today(),
        }) as FieldError[])
      : []
    return {
      id: invoice.id,
      number: invoice.number ?? null,
      status: invoice.status,
      preorderId: invoice.preorderId ?? null,
      preorderCode: invoice.preorderCode ?? null,
      buyer: snapshot.buyer,
      invoiceDate: snapshot.invoiceDate,
      deliveryDate: snapshot.deliveryDate,
      paymentTermDays: invoice.paymentTermDays,
      paymentText: invoice.paymentText,
      dueDate: snapshot.dueDate,
      paymentTerms: core.paymentTermsText(snapshot) as string,
      note: invoice.note,
      seller: snapshot.seller,
      lines: [...(invoice.lines ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((line) => ({
          position: line.position,
          productId: line.productId,
          name: line.name,
          unit: line.unit,
          quantity: Number(line.quantity),
          unitPriceGrossCents: line.unitPriceGrossCents,
          vatRate: Number(line.vatRate),
          grossCents: line.grossCents,
          netCents: line.netCents,
          netUnitPrice: line.netUnitPrice,
          netBasisQuantity: line.netBasisQuantity,
        })),
      vat: computed.vat,
      totals,
      paid: snapshot.paid,
      paidOn: snapshot.paidOn,
      paidMethod: snapshot.paidMethod,
      preorderPaidCents: invoice.preorderPaidCents ?? null,
      warnings: draft ? paymentWarnings(invoice, totals['dueCents']) : [],
      issuable: draft && missing.length === 0,
      missing,
      pdfSha256: invoice.pdfSha256 ?? null,
      anonymizedAt: iso(invoice.anonymizedAt),
      issuedAt: iso(invoice.issuedAt),
      cancelledAt: iso(invoice.cancelledAt),
      cancelReason: invoice.cancelReason,
      createdAt: iso(invoice.createdAt),
      updatedAt: iso(invoice.updatedAt),
    }
  }

  async list(query: Record<string, unknown> = {}) {
    const where: Record<string, unknown> = {}
    const status = asText(query['status'])
    if (status) {
      if (!Object.values(core.STATUS).includes(status)) {
        throw new InvoiceError(
          400,
          'invalid_status',
          'Diesen Rechnungsstatus gibt es nicht.'
        )
      }
      where['status'] = status
    }
    if (has(query, 'preorderId')) {
      const preorderId = Number(query['preorderId'])
      if (!Number.isSafeInteger(preorderId) || preorderId <= 0) {
        throw new InvoiceError(
          400,
          'invalid_preorder',
          'Die Vorbestellung ist ungültig.'
        )
      }
      where['preorderId'] = preorderId
    }
    const rows = await Invoice.findAll({
      where,
      attributes: WITHOUT_FILES,
      include: [{ model: InvoiceLine, as: 'lines' }],
      order: [
        ['invoiceDate', 'DESC'],
        ['id', 'DESC'],
      ],
    })
    return rows.map((row) => {
      const dto = this.toDto(row)
      return {
        id: dto.id,
        number: dto.number,
        status: dto.status,
        preorderId: dto.preorderId,
        preorderCode: dto.preorderCode,
        buyerName: dto.buyer.name,
        invoiceDate: dto.invoiceDate,
        deliveryDate: dto.deliveryDate,
        dueDate: dto.dueDate,
        dueCents: dto.totals['dueCents'],
        paid: dto.paid,
        issuable: dto.issuable,
        issuedAt: dto.issuedAt,
        cancelledAt: dto.cancelledAt,
      }
    })
  }

  async get(id: unknown) {
    return this.toDto(await this.find(id))
  }

  // ----------------------------------------------------------- schreiben

  /** Liest die änderbaren Felder; fehlende behalten den Wert aus `base`. */
  private parseFields(
    body: Record<string, unknown>,
    base: DraftFields
  ): { fields: DraftFields; errors: FieldError[] } {
    const errors: FieldError[] = []
    const fields: DraftFields = { ...base }
    const buyer = (
      body['buyer'] && typeof body['buyer'] === 'object' ? body['buyer'] : {}
    ) as Record<string, unknown>

    const textField = (
      key: keyof typeof TEXT_LIMITS & keyof DraftFields,
      source: Record<string, unknown>,
      sourceKey: string,
      field: string
    ) => {
      if (!has(source, sourceKey)) return
      const value = asText(source[sourceKey])
      if (value.length > TEXT_LIMITS[key]) {
        errors.push({
          field,
          message: `${FIELD_LABELS[key]} ist zu lang (höchstens ${TEXT_LIMITS[key]} Zeichen).`,
        })
        return
      }
      // Die Bemerkung darf Zeilen haben; alles andere ist einzeilig: kein
      // Zeilenumbruch, kein Tabulator, keine unsichtbaren Zeichen.
      const unprintable =
        key === 'note'
          ? // eslint-disable-next-line no-control-regex
            /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)
          : (core.hasUnprintable(value) as boolean)
      if (unprintable) {
        errors.push({
          field,
          message: `${FIELD_LABELS[key]} enthält Zeilenumbrüche, Tabulatoren oder unsichtbare Zeichen.`,
        })
        return
      }
      ;(fields as unknown as Record<string, unknown>)[key] = value
    }
    textField('buyerName', buyer, 'name', 'buyer.name')
    textField('buyerCareOf', buyer, 'careOf', 'buyer.careOf')
    textField('buyerStreet', buyer, 'street', 'buyer.street')
    textField('buyerPostcode', buyer, 'postcode', 'buyer.postcode')
    textField('buyerCity', buyer, 'city', 'buyer.city')
    textField('paymentText', body, 'paymentText', 'paymentText')
    textField('note', body, 'note', 'note')

    if (has(buyer, 'countryCode')) {
      const country = asText(buyer['countryCode']).toUpperCase()
      if (!core.isCountryCode(country)) {
        errors.push({
          field: 'buyer.countryCode',
          message:
            'Das Land ist als gültiger zweistelliger Ländercode anzugeben (z. B. DE).',
        })
      } else {
        fields.buyerCountry = country
      }
    }

    if (has(body, 'number')) {
      const number = asText(body['number'])
      if (!number) {
        fields.number = null
      } else {
        // die rohe Eingabe prüfen: `asText` hätte ein geschütztes Leerzeichen
        // am Rand schon abgeschnitten
        const message = core.validateNumber(
          typeof body['number'] === 'string'
            ? body['number'].replace(/^ +| +$/g, '')
            : number
        ) as string | null
        if (message) errors.push({ field: 'number', message })
        else fields.number = number
      }
    }

    const dateField = (
      key: 'invoiceDate' | 'deliveryDate' | 'paidOn',
      message: string
    ) => {
      if (!has(body, key)) return
      const value = asText(body[key])
      if (!value) {
        fields[key] = null
      } else if (!core.isIsoDate(value)) {
        errors.push({ field: key, message })
      } else {
        fields[key] = value
      }
    }
    dateField('invoiceDate', 'Das Rechnungsdatum ist ungültig.')
    dateField('deliveryDate', 'Das Liefer- bzw. Leistungsdatum ist ungültig.')
    dateField('paidOn', 'Das Zahlungsdatum ist ungültig.')

    if (has(body, 'paid')) {
      if (typeof body['paid'] !== 'boolean') {
        errors.push({
          field: 'paid',
          message: 'Bitte wählen: per Überweisung oder bereits bezahlt.',
        })
      } else {
        fields.paid = body['paid']
      }
    }
    if (has(body, 'paidMethod')) {
      const method = asText(body['paidMethod'])
      if (method && !core.PAYMENT_METHODS[method]) {
        errors.push({
          field: 'paidMethod',
          message: 'Die Zahlart muss bar oder Karte sein.',
        })
      } else {
        fields.paidMethod = method
      }
    }
    // „Per Überweisung“ trägt weder Zahlungsdatum noch Zahlart.
    if (!fields.paid) {
      fields.paidOn = null
      fields.paidMethod = ''
    }

    if (has(body, 'paymentTermDays')) {
      const days = Number(body['paymentTermDays'])
      if (
        asText(body['paymentTermDays']) === '' ||
        !Number.isInteger(days) ||
        days < 0 ||
        days > 365
      ) {
        errors.push({
          field: 'paymentTermDays',
          message: 'Das Zahlungsziel muss zwischen 0 und 365 Tagen liegen.',
        })
      } else {
        fields.paymentTermDays = days
      }
    }
    return { fields, errors }
  }

  private async assertNumberFree(
    number: string | null,
    exceptId: number | null,
    transaction: Transaction
  ): Promise<void> {
    if (!number) return
    // Verglichen wird die Vergleichsform: „RE-7“, „re-7“ und „ＲＥ-7“ sind
    // dieselbe Nummer.
    const taken = await Invoice.findOne({
      attributes: ['id'],
      where: {
        numberKey: core.numberKey(number) as string,
        ...(exceptId !== null ? { id: { [Op.ne]: exceptId } } : {}),
      },
      transaction,
    })
    if (taken) throw numberTaken(number)
  }

  /**
   * Legt einen Entwurf an - leer oder aus einer Vorbestellung (`preorderId`):
   * Positionen mit den Preisen der Vorbestellung, Name des Kunden,
   * Leistungsdatum = Abholtag. Die Anschrift trägt der Inhaber nach.
   */
  async create(body: Record<string, unknown>, req: Request | null) {
    const input = body && typeof body === 'object' ? body : {}
    const base: DraftFields = {
      number: null,
      buyerName: '',
      buyerCareOf: '',
      buyerStreet: '',
      buyerPostcode: '',
      buyerCity: '',
      buyerCountry: 'DE',
      invoiceDate: this.today(),
      deliveryDate: null,
      paymentTermDays: core.DEFAULT_PAYMENT_TERM_DAYS,
      paymentText: core.DEFAULT_PAYMENT_TEXT,
      note: '',
      paid: false,
      paidOn: null,
      paidMethod: '',
    }
    let preorderId: number | null = null
    let preorderCode: string | null = null
    let preorderPaidCents: number | null = null
    let lines: LineInput[] = []

    if (has(input, 'preorderId') && input['preorderId'] !== null) {
      if (!this.preorders) {
        throw new InvoiceError(
          501,
          'preorders_unavailable',
          'Vorbestellungen sind hier nicht verfügbar.'
        )
      }
      const result = await this.preorders.get(input['preorderId'])
      if (isFailure(result)) {
        throw new InvoiceError(
          404,
          'preorder_not_found',
          'Diese Vorbestellung gibt es nicht.'
        )
      }
      const preorder = result.data
      if (preorder.status === 'storniert') {
        throw new InvoiceError(
          409,
          'preorder_cancelled',
          'Die Vorbestellung ist storniert - dafür wird keine Rechnung erstellt.'
        )
      }
      preorderId = preorder.id
      preorderCode = preorder.code
      // Nach 90 Tagen steht dort nur noch „anonymisiert“ - kein Name.
      base.buyerName = preorder.anonymizedAt ? '' : preorder.customerName ?? ''
      base.deliveryDate = preorder.pickupDate
      lines = preorder.items.map((item) => {
        const name = item.variant ? `${item.name} (${item.variant})` : item.name
        const cents = core.priceToCents(item.unitPrice) as number | null
        if (cents === null) {
          // z. B. 0,333 € aus einem Import: nicht stillschweigend runden.
          throw new InvoiceError(
            422,
            'preorder_price_invalid',
            `Der Preis von „${name}“ in der Vorbestellung (${String(
              item.unitPrice
            ).replace(
              '.',
              ','
            )} €) lässt sich nicht in ganzen Cent ausdrücken. Bitte die Rechnung leer anlegen und die Positionen von Hand eintragen.`,
            { productId: item.productId }
          )
        }
        return {
          productId: item.productId,
          name,
          unit: item.unit || 'Stück',
          quantity: String(item.quantity),
          unitPriceGrossCents: cents,
          vatRate: core.DEFAULT_VAT_RATE as number,
        }
      })
      // Schon bezahlt? Dann verlangt die Rechnung keine Überweisung: der
      // Entwurf startet als „bereits bezahlt“ (Datum und Zahlart trägt der
      // Inhaber ein - die Vorbestellung kennt beides nicht). Eine Teilzahlung
      // kann die Rechnung nicht ausweisen; sie bleibt „per Überweisung“ und
      // der Entwurf warnt.
      if (preorder.paid) {
        preorderPaidCents = core.priceToCents(
          preorder.paidAmount ?? preorder.total
        ) as number | null
        const linesValid =
          (core.validateLines(lines) as FieldError[]).length === 0
        base.paid =
          linesValid &&
          preorderPaidCents !== null &&
          preorderPaidCents === compute(lines).totals.dueCents
      }
    }

    const { fields, errors } = this.parseFields(input, base)
    if (has(input, 'lines')) {
      const parsed = parseLines(input['lines'])
      errors.push(...parsed.errors)
      lines = parsed.lines
    } else {
      errors.push(...(core.validateLines(lines) as FieldError[]))
    }
    if (errors.length > 0) throw invalid(errors)

    const id = await getSequelize()
      .transaction(async (transaction) => {
        if (preorderId !== null) {
          const existing = await Invoice.findOne({
            where: {
              preorderId,
              status: { [Op.ne]: core.STATUS.CANCELLED },
            },
            transaction,
          })
          if (existing) {
            throw new InvoiceError(
              409,
              'invoice_exists',
              existing.status === core.STATUS.DRAFT
                ? 'Für diese Vorbestellung gibt es schon einen Rechnungsentwurf.'
                : `Für diese Vorbestellung gibt es schon die Rechnung ${existing.number}.`,
              { invoiceId: existing.id }
            )
          }
        }
        await this.assertNumberFree(fields.number, null, transaction)
        const created = await Invoice.create(
          {
            ...fields,
            numberKey: keyOf(fields.number),
            dueDate: dueDate(fields),
            status: core.STATUS.DRAFT,
            preorderId,
            preorderCode,
            preorderPaidCents,
            createdBy: req?.user?.id ?? null,
            updatedBy: req?.user?.id ?? null,
          },
          { transaction }
        )
        const { rows, totals } = lineRows(created.id, lines)
        await InvoiceLine.bulkCreate(rows, { transaction })
        await created.update({ totals }, { transaction })
        await audit(
          req,
          'create',
          'invoice',
          created.id,
          { preorderId, lines: rows.length },
          { transaction }
        )
        return created.id
      })
      .catch(rethrowUnique)
    return this.get(id)
  }

  /** Ändert einen Entwurf. Eine ausgestellte Rechnung ist unveränderlich. */
  async update(
    id: unknown,
    body: Record<string, unknown>,
    req: Request | null
  ) {
    const input = body && typeof body === 'object' ? body : {}
    await getSequelize()
      .transaction(async (transaction) => {
        const invoice = await this.find(id, transaction)
        assertDraft(invoice)
        const { fields, errors } = this.parseFields(input, {
          number: invoice.number ?? null,
          buyerName: invoice.buyerName,
          buyerCareOf: invoice.buyerCareOf,
          buyerStreet: invoice.buyerStreet,
          buyerPostcode: invoice.buyerPostcode,
          buyerCity: invoice.buyerCity,
          buyerCountry: invoice.buyerCountry,
          invoiceDate: invoice.invoiceDate ?? null,
          deliveryDate: invoice.deliveryDate ?? null,
          paymentTermDays: invoice.paymentTermDays,
          paymentText: invoice.paymentText,
          note: invoice.note,
          paid: invoice.paid === true,
          paidOn: invoice.paidOn ?? null,
          paidMethod: invoice.paidMethod ?? '',
        })
        let lines: LineInput[] | null = null
        if (has(input, 'lines')) {
          const parsed = parseLines(input['lines'])
          errors.push(...parsed.errors)
          lines = parsed.lines
        }
        if (errors.length > 0) throw invalid(errors)
        await this.assertNumberFree(fields.number, invoice.id, transaction)

        const changes: Record<string, unknown> = {
          ...fields,
          numberKey: keyOf(fields.number),
          dueDate: dueDate(fields),
          // wer einen bereinigten Entwurf wieder ausfüllt, hat ihn in Arbeit
          anonymizedAt: null,
          updatedBy: req?.user?.id ?? null,
        }
        if (lines) {
          const { rows, totals } = lineRows(invoice.id, lines)
          await InvoiceLine.destroy({
            where: { invoiceId: invoice.id },
            transaction,
          })
          await InvoiceLine.bulkCreate(rows, { transaction })
          changes['totals'] = totals
        }
        await invoice.update(changes, { transaction })
        await audit(
          req,
          'update',
          'invoice',
          invoice.id,
          { lines: lines ? lines.length : null },
          { transaction }
        )
      })
      .catch(rethrowUnique)
    return this.get(id)
  }

  /** Löscht einen Entwurf. Ausgestellte Rechnungen werden nie gelöscht. */
  async remove(id: unknown, req: Request | null) {
    await getSequelize().transaction(async (transaction) => {
      const invoice = await this.find(id, transaction)
      assertDraft(invoice)
      await InvoiceLine.destroy({
        where: { invoiceId: invoice.id },
        transaction,
      })
      await invoice.destroy({ transaction })
      await audit(req, 'delete', 'invoice', invoice.id, null, { transaction })
    })
    return { deleted: true }
  }

  /**
   * Stellt einen Entwurf aus: prüft die Pflichtangaben, schreibt Verkäufer,
   * Summen, XML und das PDF fest. Ab hier ist die Rechnung unveränderlich.
   * Lässt sich das PDF nicht erzeugen, wird nichts ausgestellt (Rollback).
   */
  async issue(id: unknown, req: Request | null) {
    await getSequelize()
      .transaction(async (transaction) => {
        const invoice = await this.find(id, transaction)
        if (invoice.status !== core.STATUS.DRAFT) {
          throw new InvoiceError(
            409,
            'invoice_not_draft',
            'Diese Rechnung ist schon ausgestellt.'
          )
        }
        const snapshot = this.snapshot(invoice)
        // Die Bankverbindung braucht nur, wer überweisen soll.
        const bank = snapshot.paid
          ? []
          : (core.bankErrors(snapshot.seller) as FieldError[])
        if (bank.length > 0) {
          throw new InvoiceError(409, 'bank_not_configured', bank[0].message, {
            fields: bank,
          })
        }
        const errors = core.validateForIssue(snapshot, {
          today: this.today(),
        }) as FieldError[]
        if (errors.length > 0) {
          throw new InvoiceError(
            422,
            'invoice_incomplete',
            `Die Rechnung kann noch nicht ausgestellt werden: ${errors[0].message}`,
            { fields: errors }
          )
        }
        await this.assertNumberFree(invoice.number, invoice.id, transaction)

        const computed = compute(snapshot.lines)
        const { rows } = lineRows(invoice.id, snapshot.lines)
        await InvoiceLine.destroy({
          where: { invoiceId: invoice.id },
          transaction,
        })
        await InvoiceLine.bulkCreate(rows, { transaction })
        await invoice.update(
          {
            status: core.STATUS.ISSUED,
            numberKey: keyOf(invoice.number ?? null),
            seller: snapshot.seller as unknown as Record<string, unknown>,
            totals: {
              vat: computed.vat,
              totals: {
                ...computed.totals,
                ...core.settlement(snapshot, computed.totals),
              },
            },
            xml: core.buildCiiXml(snapshot) as string,
            issuedAt: this.clock(),
            issuedBy: req?.user?.id ?? null,
            updatedBy: req?.user?.id ?? null,
          },
          { transaction }
        )
        // Das PDF entsteht genau einmal, aus dem eben festgeschriebenen Stand.
        const pdf = await this.freezePdf(invoice.id, false, transaction)
        // Ohne Namen und Anschrift: das Audit-Log wird nie bereinigt.
        await audit(
          req,
          'issue',
          'invoice',
          invoice.id,
          {
            number: invoice.number,
            dueCents: computed.totals.dueCents,
            paid: snapshot.paid,
            pdfSha256: pdf.sha256,
          },
          { transaction }
        )
      })
      .catch(rethrowUnique)
    return this.get(id)
  }

  /**
   * Storniert eine ausgestellte Rechnung (Korrektur = neue Rechnung). Das
   * Original-PDF bleibt unverändert abrufbar; die Fassung mit Storno-Aufdruck
   * wird daneben festgeschrieben.
   */
  async cancel(
    id: unknown,
    body: Record<string, unknown>,
    req: Request | null
  ) {
    const reason = asText((body ?? {})['reason'])
    if (!reason || reason.length > 200 || core.hasUnprintable(reason)) {
      throw invalid([
        {
          field: 'reason',
          message:
            'Bitte einen kurzen Grund für die Stornierung eintragen (eine Zeile, höchstens 200 Zeichen).',
        },
      ])
    }
    await getSequelize().transaction(async (transaction) => {
      const invoice = await this.find(id, transaction)
      if (invoice.status === core.STATUS.DRAFT) {
        throw new InvoiceError(
          409,
          'invoice_not_issued',
          'Ein Entwurf wird nicht storniert, sondern gelöscht.'
        )
      }
      if (invoice.status === core.STATUS.CANCELLED) {
        throw new InvoiceError(
          409,
          'invoice_cancelled',
          'Diese Rechnung ist schon storniert.'
        )
      }
      // Vor dieser Fassung ausgestellt: erst das Original festschreiben.
      await this.freezePdf(invoice.id, false, transaction)
      await invoice.update(
        {
          status: core.STATUS.CANCELLED,
          cancelledAt: this.clock(),
          cancelledBy: req?.user?.id ?? null,
          cancelReason: reason,
        },
        { transaction }
      )
      const stamped = await this.freezePdf(invoice.id, true, transaction)
      await audit(
        req,
        'cancel',
        'invoice',
        invoice.id,
        { number: invoice.number, cancelPdfSha256: stamped.sha256 },
        { transaction }
      )
    })
    return this.get(id)
  }

  // ------------------------------------------------------------- Dateien

  private async issued(id: unknown): Promise<Invoice> {
    const invoice = await this.find(id)
    if (invoice.status === core.STATUS.DRAFT || !invoice.xml) {
      throw new InvoiceError(
        409,
        'invoice_not_issued',
        'PDF und XML gibt es erst, wenn die Rechnung ausgestellt ist.'
      )
    }
    return invoice
  }

  /** Die festgeschriebene Factur-X-XML. */
  async xml(id: unknown): Promise<{ filename: string; xml: string }> {
    const invoice = await this.issued(id)
    return {
      filename: `${fileStem(invoice.number)}.xml`,
      xml: invoice.xml as string,
    }
  }

  /**
   * Erzeugt das PDF aus dem festgeschriebenen Stand. `stamped` = mit
   * Storno-Aufdruck; sonst so, wie die Rechnung ausgestellt wurde - auch wenn
   * sie inzwischen storniert ist.
   */
  private async render(invoice: Invoice, stamped: boolean): Promise<Buffer> {
    const dto = this.toDto(invoice)
    const view = stamped
      ? dto
      : {
          ...dto,
          status: core.STATUS.ISSUED as typeof dto.status,
          cancelledAt: null,
          cancelReason: '',
        }
    try {
      return await renderInvoicePdf({
        invoice: view,
        xml: invoice.xml as string,
        createdAt: invoice.issuedAt ?? invoice.createdAt,
      })
    } catch (error) {
      if (error instanceof InvoiceFontsError) {
        console.error(`[ERROR] ${error.message}`)
        throw new InvoiceError(503, 'invoice_fonts_missing', FONTS_MESSAGE)
      }
      throw error
    }
  }

  /**
   * Vorschau eines Entwurfs als PDF („Entwurf als PDF“): dasselbe Bild wie
   * die Rechnung, aber mit dem Aufdruck „ENTWURF – keine Rechnung“, ohne XML
   * und ohne PDF/A. Geht auch, solange Nummer, Anschrift oder Bankverbindung
   * fehlen (steht dann als „offen“ da). Wird bei jedem Abruf neu erzeugt und
   * nie gespeichert; am Entwurf ändert sich nichts.
   */
  async preview(id: unknown): Promise<{ filename: string; pdf: Buffer }> {
    const invoice = await this.find(id)
    if (invoice.status !== core.STATUS.DRAFT) {
      throw new InvoiceError(
        409,
        'invoice_not_draft',
        'Die Vorschau gibt es nur für Entwürfe. Diese Rechnung ist kein Entwurf mehr - bitte ihr PDF laden.'
      )
    }
    try {
      const pdf = await renderInvoiceDraftPdf({
        invoice: this.toDto(invoice),
        createdAt: this.clock(),
      })
      return { filename: `${draftFileStem(invoice)}.pdf`, pdf }
    } catch (error) {
      if (error instanceof InvoiceFontsError) {
        console.error(`[ERROR] ${error.message}`)
        throw new InvoiceError(503, 'invoice_fonts_missing', FONTS_MESSAGE)
      }
      throw error
    }
  }

  /**
   * Liefert die festgeschriebenen Bytes des Originals bzw. der Storno-Fassung
   * und schreibt sie fest, falls sie noch fehlen. Sie fehlen nur bei
   * Rechnungen, die vor der Festschreibung ausgestellt wurden: dann wird das
   * PDF beim ersten Zugriff einmal erzeugt und ab da nie wieder.
   */
  private async freezePdf(
    id: number,
    stamped: boolean,
    transaction: Transaction
  ): Promise<{ pdf: Buffer; sha256: string; created: boolean }> {
    const column = stamped ? 'cancelPdf' : 'pdf'
    const hashColumn = stamped ? 'cancelPdfSha256' : 'pdfSha256'
    const stored = await Invoice.findByPk(id, {
      attributes: ['id', column, hashColumn],
      transaction,
    })
    const existing = stored?.[column]
    if (existing) {
      const pdf = Buffer.from(existing)
      return { pdf, sha256: stored[hashColumn] ?? sha256(pdf), created: false }
    }
    const invoice = await this.find(id, transaction)
    const pdf = await this.render(invoice, stamped)
    const hash = sha256(pdf)
    await invoice.update(
      stamped
        ? { cancelPdf: pdf, cancelPdfSha256: hash }
        : { pdf, pdfSha256: hash, pdfStoredAt: this.clock() },
      { transaction, silent: true }
    )
    return { pdf, sha256: hash, created: true }
  }

  /**
   * Das PDF/A-3 mit eingebetteter XML - genau die beim Ausstellen
   * festgeschriebenen Bytes. `variant: 'storniert'` liefert stattdessen die
   * Fassung mit Storno-Aufdruck (nur bei stornierten Rechnungen).
   */
  async pdf(
    id: unknown,
    variant: unknown = 'original',
    req: Request | null = null
  ): Promise<{ filename: string; pdf: Buffer; sha256: string }> {
    const wanted =
      variant === undefined || variant === '' ? 'original' : variant
    if (wanted !== 'original' && wanted !== 'storniert') {
      throw new InvoiceError(
        400,
        'invalid_variant',
        'Diese Fassung der Rechnung gibt es nicht.'
      )
    }
    const stamped = wanted === 'storniert'
    const invoice = await this.issued(id)
    if (stamped && invoice.status !== core.STATUS.CANCELLED) {
      throw new InvoiceError(
        409,
        'invoice_not_cancelled',
        'Die Storno-Fassung gibt es nur bei einer stornierten Rechnung.'
      )
    }
    const frozen = await getSequelize().transaction(async (transaction) => {
      const result = await this.freezePdf(invoice.id, stamped, transaction)
      if (result.created) {
        await audit(
          req,
          'pdf_freeze',
          'invoice',
          invoice.id,
          { number: invoice.number, stamped, sha256: result.sha256 },
          { transaction }
        )
      }
      return result
    })
    return {
      filename: `${fileStem(invoice.number)}${stamped ? '-storniert' : ''}.pdf`,
      pdf: frozen.pdf,
      sha256: frozen.sha256,
    }
  }
}

export type InvoiceDto = Awaited<ReturnType<InvoicesService['get']>>

function keyOf(number: string | null): string | null {
  return number ? (core.numberKey(number) as string) : null
}

function euro(cents: number): string {
  return core.formatEuro(cents) as string
}

/**
 * Hinweise am Entwurf, wenn die Vorbestellung (ganz oder teilweise) schon
 * bezahlt war und die Rechnung dazu nicht passt.
 */
function paymentWarnings(invoice: Invoice, dueCents: number): string[] {
  const paidCents = invoice.preorderPaidCents
  if (paidCents === null || paidCents === undefined) return []
  if (paidCents !== dueCents) {
    return [
      `Die Vorbestellung ist mit ${euro(
        paidCents
      )} als bezahlt vermerkt, die Rechnung lautet über ${euro(
        dueCents
      )}. Teilzahlungen und Differenzen weist die Rechnung nicht aus - bitte vor dem Ausstellen klären.`,
    ]
  }
  if (!invoice.paid) {
    return [
      `Die Vorbestellung ist als bezahlt vermerkt (${euro(
        paidCents
      )}), diese Rechnung verlangt aber eine Überweisung. Wenn schon bezahlt ist: unter „Zahlung“ „bereits bezahlt“ wählen.`,
    ]
  }
  return []
}

function dueDate(fields: DraftFields): string | null {
  return fields.invoiceDate
    ? (core.addDays(fields.invoiceDate, fields.paymentTermDays) as string)
    : null
}

function assertDraft(invoice: Invoice): void {
  if (invoice.status !== core.STATUS.DRAFT) {
    throw new InvoiceError(
      409,
      'invoice_immutable',
      'Eine ausgestellte Rechnung kann nicht mehr geändert werden. Zum Korrigieren stornieren und eine neue Rechnung ausstellen.'
    )
  }
}

function numberTaken(number: string): InvoiceError {
  return new InvoiceError(
    409,
    'number_taken',
    `Die Rechnungsnummer ${number} ist schon vergeben.`,
    {
      fields: [
        { field: 'number', message: 'Diese Nummer ist schon vergeben.' },
      ],
    }
  )
}

/** Zwei gleichzeitige Speicherungen derselben Nummer: der Index entscheidet. */
function rethrowUnique(error: unknown): never {
  if (error instanceof UniqueConstraintError) {
    throw new InvoiceError(
      409,
      'number_taken',
      'Diese Rechnungsnummer ist schon vergeben.',
      {
        fields: [
          { field: 'number', message: 'Diese Nummer ist schon vergeben.' },
        ],
      }
    )
  }
  throw error
}

/** Dateiname aus der Rechnungsnummer (nur unkritische Zeichen). */
function fileStem(number: string | null | undefined): string {
  const safe = String(number ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `Rechnung-${safe || 'ohne-Nummer'}`
}

/** Dateiname der Entwurfs-Vorschau: mit der eingetragenen Nummer, sonst der id. */
function draftFileStem(invoice: Invoice): string {
  const safe = String(invoice.number ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `Rechnungsentwurf-${safe || invoice.id}`
}
