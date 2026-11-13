/**
 * Ausgangsrechnungen: lesen, als Entwurf anlegen und ändern, ausstellen,
 * stornieren. Alle Regeln und Formeln stehen in `invoice.core.js`; diese
 * Datei liest und schreibt nur (`invoices`, `invoice_lines`, `audit_log`).
 *
 * - Ein **Entwurf** braucht keine Nummer und darf unvollständig sein.
 * - **Ausstellen** verlangt Nummer, vollständige Empfängeranschrift, Datum,
 *   Positionen und die Bankverbindung der Bäckerei. Dabei werden Verkäufer,
 *   Summen und die Factur-X-XML festgeschrieben. Danach ändert nichts mehr
 *   die Rechnung; PDF und XML kommen aus dem festgeschriebenen Stand.
 * - **Stornieren** markiert eine ausgestellte Rechnung; die Korrektur ist
 *   eine neue Rechnung mit neuer Nummer.
 *
 * Fehler sind `InvoiceError`s (Status, Code, deutsche Meldung); der Router
 * antwortet damit über `sendError`.
 */
import type { Request } from 'express'
import { Op, Transaction, UniqueConstraintError } from 'sequelize'

import { audit } from '../auth/audit'
import { getSequelize, Invoice, InvoiceLine } from '../models'
import { currentSeller, InvoiceSeller } from './invoice-seller'
import { renderInvoicePdf } from './invoice-pdf'
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

function lineRows(invoiceId: number, lines: LineInput[]) {
  const computed = core.computeInvoice(lines)
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
    }
  }

  private async find(id: unknown, transaction?: Transaction): Promise<Invoice> {
    const key = Number(id)
    const row =
      Number.isSafeInteger(key) && key > 0
        ? await Invoice.findByPk(key, {
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
    const computed =
      draft || !stored ? core.computeInvoice(snapshot.lines) : stored
    const missing = draft
      ? (core.validateForIssue(snapshot) as FieldError[])
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
      totals: computed.totals,
      issuable: draft && missing.length === 0,
      missing,
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
      // eslint-disable-next-line no-control-regex
      if (
        value.length > TEXT_LIMITS[key] ||
        /[\u0000-\u0008\u000b-\u001f]/.test(value)
      ) {
        errors.push({
          field,
          message: `${FIELD_LABELS[key]} ist zu lang oder enthält Steuerzeichen.`,
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
      if (!/^[A-Z]{2}$/.test(country)) {
        errors.push({
          field: 'buyer.countryCode',
          message: 'Das Land ist als zweistelliger Code anzugeben (z. B. DE).',
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
        const message = core.validateNumber(number) as string | null
        if (message) errors.push({ field: 'number', message })
        else fields.number = number
      }
    }

    const dateField = (
      key: 'invoiceDate' | 'deliveryDate',
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
    const taken = await Invoice.findOne({
      where: {
        number,
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
    }
    let preorderId: number | null = null
    let preorderCode: string | null = null
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
      lines = preorder.items.map((item) => ({
        productId: item.productId,
        name: item.variant ? `${item.name} (${item.variant})` : item.name,
        unit: item.unit || 'Stück',
        quantity: String(item.quantity),
        unitPriceGrossCents: core.toCents(item.unitPrice) as number,
        vatRate: core.DEFAULT_VAT_RATE as number,
      }))
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
            dueDate: dueDate(fields),
            status: core.STATUS.DRAFT,
            preorderId,
            preorderCode,
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
          dueDate: dueDate(fields),
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
   * Summen und XML fest. Ab hier ist die Rechnung unveränderlich.
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
        const bank = core.bankErrors(snapshot.seller) as FieldError[]
        if (bank.length > 0) {
          throw new InvoiceError(409, 'bank_not_configured', bank[0].message, {
            fields: bank,
          })
        }
        const errors = core.validateForIssue(snapshot) as FieldError[]
        if (errors.length > 0) {
          throw new InvoiceError(
            422,
            'invoice_incomplete',
            `Die Rechnung kann noch nicht ausgestellt werden: ${errors[0].message}`,
            { fields: errors }
          )
        }
        await this.assertNumberFree(invoice.number, invoice.id, transaction)

        const computed = core.computeInvoice(snapshot.lines)
        const { rows } = lineRows(invoice.id, snapshot.lines)
        await InvoiceLine.destroy({
          where: { invoiceId: invoice.id },
          transaction,
        })
        await InvoiceLine.bulkCreate(rows, { transaction })
        await invoice.update(
          {
            status: core.STATUS.ISSUED,
            seller: snapshot.seller as unknown as Record<string, unknown>,
            totals: { vat: computed.vat, totals: computed.totals },
            xml: core.buildCiiXml(snapshot) as string,
            issuedAt: this.clock(),
            issuedBy: req?.user?.id ?? null,
            updatedBy: req?.user?.id ?? null,
          },
          { transaction }
        )
        // Ohne Namen und Anschrift: das Audit-Log wird nie bereinigt.
        await audit(
          req,
          'issue',
          'invoice',
          invoice.id,
          { number: invoice.number, dueCents: computed.totals.dueCents },
          { transaction }
        )
      })
      .catch(rethrowUnique)
    return this.get(id)
  }

  /** Storniert eine ausgestellte Rechnung (Korrektur = neue Rechnung). */
  async cancel(
    id: unknown,
    body: Record<string, unknown>,
    req: Request | null
  ) {
    const reason = asText((body ?? {})['reason'])
    if (!reason || reason.length > 200) {
      throw invalid([
        {
          field: 'reason',
          message: 'Bitte einen kurzen Grund für die Stornierung eintragen.',
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
      await invoice.update(
        {
          status: core.STATUS.CANCELLED,
          cancelledAt: this.clock(),
          cancelledBy: req?.user?.id ?? null,
          cancelReason: reason,
        },
        { transaction }
      )
      await audit(
        req,
        'cancel',
        'invoice',
        invoice.id,
        { number: invoice.number },
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

  /** Das PDF/A-3 mit eingebetteter XML, aus dem festgeschriebenen Stand. */
  async pdf(id: unknown): Promise<{ filename: string; pdf: Buffer }> {
    const invoice = await this.issued(id)
    const dto = this.toDto(invoice)
    const pdf = await renderInvoicePdf({
      invoice: dto,
      xml: invoice.xml as string,
      createdAt: invoice.issuedAt ?? invoice.createdAt,
    })
    return { filename: `${fileStem(invoice.number)}.pdf`, pdf }
  }
}

export type InvoiceDto = Awaited<ReturnType<InvoicesService['get']>>

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
