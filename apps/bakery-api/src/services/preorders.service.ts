/**
 * Vorbestellungen (B7) - Datenbank-Schicht über `delivery-preorders.core.js`.
 *
 * Gerechnet und geprüft wird ausschließlich im Core (einzige Formelquelle,
 * auch für den Mock-Server); hier stehen Laden, Speichern, Code-Vergabe,
 * Audit und die Übersetzung in die drei Verträge:
 *
 *   - `/api/preorders`              neues Modell (`PreorderDto`)
 *   - `/api/deliveries/preorders`   Mock-Vertrag der Mörsbach-Maske (Alias)
 *   - `POST /api/orders`            Mock-Vertrag des Shops → Kanal `shop`
 *
 * Jede Schreiboperation läuft in einer verwalteten (serialisierten)
 * Transaktion und schreibt `audit_log` in derselben Transaktion. Ins Audit
 * kommen nie Name oder Telefon (P4 anonymisiert sie, das Audit bliebe sonst).
 */
import { Op, QueryTypes, Transaction, WhereOptions } from 'sequelize'
import type { Request } from 'express'

import { audit } from '../auth/audit'
import { getSequelize, PickupPoint, Preorder, PreorderItem } from '../models'
import { catalogueFor, defaultProductsDir } from './hq-catalogue'
import { createVariantsHook, VariantsForProduct } from './preorder-variants'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./delivery-preorders.core')
const tours = require('./delivery-tours.core')
const shopOrders = require('./shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface PreordersOptions {
  /** hq read clone for price snapshots (default `HQ_PRODUCTS_DIR` …). */
  productsDir?: string
  /** Varianten-Haken (default: `hq/config/backzettel.yaml`, s. preorder-variants.ts). */
  variantsForProduct?: VariantsForProduct
  /** Uhr (Tests). */
  now?: () => Date
}

export interface Failure {
  ok: false
  status: number
  error: string
  message: string
  extra?: Record<string, unknown>
}

export type Result<T> = { ok: true; status: number; data: T } | Failure

/**
 * Type guard - the bundle's tsconfig runs without `strictNullChecks`, where
 * `ok: true | false` does not narrow the union on its own.
 */
export function isFailure<T>(result: Result<T>): result is Failure {
  return result.ok === false
}

function failure<T>(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Result<T> {
  return { ok: false, status, error, message, extra }
}

/** Plain record as the core sees it. */
export interface PreorderRecord {
  id: number
  code: string
  channel: string
  customerName: string | null
  customerPhone: string | null
  pickupDate: string
  pickupTime: string | null
  pickupPointId: string | null
  status: string
  paid: boolean
  note: string | null
  pickedUpAt: Date | string | null
  notCollectedAt: Date | string | null
  anonymizedAt: Date | string | null
  createdBy: number | null
  updatedBy: number | null
  createdAt: Date | string
  updatedAt: Date | string
  items: Array<{
    productId: string
    name: string
    variant: string
    unit: string
    unitPrice: number
    quantity: number
    lineTotal: number
  }>
  total: number
}

export interface PickupPointDto {
  id: string
  name: string
  street: string
  zip: string
  city: string
  weekday: number
  window: string | null
  orderDeadline: { weekday: number; time: string } | null
  notes: string | null
  active: boolean
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  geocodePrecision: string | null
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function toPickupPointDto(point: PickupPoint): PickupPointDto {
  const p = point.get({ plain: true }) as PickupPoint
  let deadline = p.orderDeadline as unknown
  if (typeof deadline === 'string') {
    try {
      deadline = JSON.parse(deadline)
    } catch {
      deadline = null
    }
  }
  return {
    id: p.id,
    name: p.name,
    street: p.street ?? '',
    zip: p.zip ?? '',
    city: p.city ?? '',
    weekday: Number(p.weekday),
    window: p.window ?? null,
    orderDeadline: (deadline as PickupPointDto['orderDeadline']) ?? null,
    notes: p.notes ?? null,
    active: p.active !== false,
    lat: p.lat ?? null,
    lon: p.lon ?? null,
    geocodeSource: p.geocodeSource ?? null,
    geocodePrecision: p.geocodePrecision ?? null,
  }
}

export function toRecord(row: Preorder): PreorderRecord {
  const p = row.get({ plain: true }) as Preorder & {
    items?: Array<PreorderItem>
  }
  const items = (p.items ?? [])
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((item) => ({
      productId: item.productId,
      name: item.productName,
      variant: item.variant ?? '',
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      lineTotal: core.lineTotal(item.quantity, item.unitPrice),
    }))
  return {
    id: p.id,
    code: p.code,
    channel: p.channel,
    customerName: p.customerName,
    customerPhone: p.customerPhone ?? null,
    pickupDate: String(p.pickupDate),
    pickupTime: p.pickupTime ?? null,
    pickupPointId: p.pickupPointId ?? null,
    status: p.status,
    paid: !!p.paid,
    note: p.note ?? null,
    pickedUpAt: p.pickedUpAt ?? null,
    notCollectedAt: p.notCollectedAt ?? null,
    anonymizedAt: p.anonymizedAt ?? null,
    createdBy: p.createdBy ?? null,
    updatedBy: p.updatedBy ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    items,
    total: core.orderTotal(items),
  }
}

/** Antwortform von `/api/preorders`. */
export function toDto(
  record: PreorderRecord,
  point: PickupPointDto | null,
  now?: Date
) {
  const decorated = core.decoratePreorder(
    { date: record.pickupDate },
    point,
    now
  )
  return {
    id: record.id,
    code: record.code,
    channel: record.channel,
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    pickupDate: record.pickupDate,
    pickupTime: record.pickupTime,
    pickupPointId: record.pickupPointId,
    pickupPoint: point
      ? { id: point.id, name: point.name, window: point.window }
      : null,
    status: record.status,
    notCollected: !!record.notCollectedAt,
    notCollectedAt: iso(record.notCollectedAt),
    paid: record.paid,
    note: record.note,
    items: record.items,
    total: record.total,
    pickedUpAt: iso(record.pickedUpAt),
    anonymizedAt: iso(record.anonymizedAt),
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    deadline: decorated.deadline,
    afterDeadline: decorated.afterDeadline,
  }
}

export type PreorderDto = ReturnType<typeof toDto>

export interface ListFilters {
  date?: unknown
  from?: unknown
  to?: unknown
  status?: unknown
  channel?: unknown
  pickupPointId?: unknown
  q?: unknown
}

/** Fields that changed - for the audit; never the values of name/phone. */
function changedFields(
  before: PreorderRecord | null,
  after: Record<string, unknown>
): string[] {
  if (!before) return []
  const keys = [
    'channel',
    'customerName',
    'customerPhone',
    'pickupDate',
    'pickupTime',
    'pickupPointId',
    'status',
    'paid',
    'note',
    'notCollectedAt',
  ]
  const changed = keys.filter(
    (k) =>
      JSON.stringify(
        (before as unknown as Record<string, unknown>)[k] ?? null
      ) !== JSON.stringify(after[k] ?? null)
  )
  const itemsOf = (items: unknown) =>
    JSON.stringify(
      ((items as PreorderRecord['items']) ?? []).map((i) => [
        i.productId,
        i.variant,
        i.quantity,
      ])
    )
  if (
    after['items'] !== undefined &&
    itemsOf(before.items) !== itemsOf(after['items'])
  ) {
    changed.push('items')
  }
  return changed
}

function auditData(
  record: Pick<
    PreorderRecord,
    'code' | 'channel' | 'pickupDate' | 'pickupPointId' | 'status' | 'items'
  > & { paid?: boolean },
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    code: record.code,
    channel: record.channel,
    pickupDate: record.pickupDate,
    pickupPointId: record.pickupPointId,
    status: record.status,
    paid: record.paid,
    items: record.items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      quantity: i.quantity,
    })),
    ...extra,
  }
}

function singleString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  return value
}

/**
 * Next free pickup code of a day and place, registered in `preorder_codes`
 * in the same transaction. Codes are single-use: a preorder that moves to
 * another day or place keeps its old code in the registry, so the next
 * customer of that day never inherits it (an Abholzettel or a printed list
 * may still carry it). Cancelled preorders keep theirs anyway.
 */
export async function allocateCode(
  pickupPointId: string | null,
  pickupDate: string,
  transaction: Transaction
): Promise<string> {
  const prefix = core.codePrefixFor(pickupPointId)
  const like = `${prefix}-${pickupDate}-%`
  const sequelize = getSequelize()
  const [registered, current] = await Promise.all([
    sequelize.query<{ code: string }>(
      'SELECT code FROM preorder_codes WHERE code LIKE ?',
      { replacements: [like], type: QueryTypes.SELECT, transaction }
    ),
    Preorder.findAll({
      attributes: ['code'],
      where: { code: { [Op.like]: like } },
      transaction,
    }),
  ])
  const code: string = core.nextCode(
    [...registered.map((r) => r.code), ...current.map((r) => r.code)],
    prefix,
    pickupDate
  )
  await registerCode(code, transaction)
  return code
}

/** Records a code as handed out (idempotent). Import uses it for kept codes. */
export async function registerCode(
  code: string,
  transaction: Transaction
): Promise<void> {
  await getSequelize().query(
    'INSERT OR IGNORE INTO preorder_codes (code, created_at) VALUES (?, ?)',
    { replacements: [code, new Date().toISOString()], transaction }
  )
}

export class PreordersService {
  private readonly productsDir: string
  private readonly variants: VariantsForProduct
  private readonly clock: () => Date

  constructor(options: PreordersOptions = {}) {
    this.productsDir = options.productsDir ?? defaultProductsDir()
    this.variants = options.variantsForProduct ?? createVariantsHook()
    this.clock = options.now ?? (() => new Date())
  }

  now(): Date {
    return this.clock()
  }

  lookupProduct = (id: string) => catalogueFor(this.productsDir).get(id)

  /** Heute in Berlin (`YYYY-MM-DD`). */
  today(): string {
    return shopOrders.berlinToday(this.now())
  }

  // ------------------------------------------------------------- reading

  async pickupPoints(
    transaction?: Transaction
  ): Promise<Map<string, PickupPointDto>> {
    const rows = await PickupPoint.findAll({
      order: [['id', 'ASC']],
      transaction,
    })
    return new Map(rows.map((r) => [r.id, toPickupPointDto(r)]))
  }

  async listPickupPoints(): Promise<PickupPointDto[]> {
    return [...(await this.pickupPoints()).values()]
  }

  private async findRecords(
    where: WhereOptions,
    transaction?: Transaction
  ): Promise<PreorderRecord[]> {
    const rows = await Preorder.findAll({
      where,
      include: [{ model: PreorderItem, as: 'items' }],
      transaction,
    })
    return rows.map(toRecord).sort(core.comparePickup)
  }

  async findRecord(
    id: unknown,
    transaction?: Transaction
  ): Promise<PreorderRecord | null> {
    const n = typeof id === 'number' ? id : Number(id)
    if (!Number.isInteger(n) || n <= 0 || String(n) !== String(id).trim()) {
      return null
    }
    const row = await Preorder.findByPk(n, {
      include: [{ model: PreorderItem, as: 'items' }],
      transaction,
    })
    return row ? toRecord(row) : null
  }

  /** Validates list filters; `null` result = 400 already described. */
  parseFilters(
    query: ListFilters
  ): Result<{ where: WhereOptions; ladenOnly: boolean }> {
    const where: Record<string | symbol, unknown> = {}
    const date = singleString(query.date)
    const from = singleString(query.from)
    const to = singleString(query.to)
    for (const [value, label] of [
      [date, 'date'],
      [from, 'from'],
      [to, 'to'],
    ] as const) {
      if (
        value === null ||
        (value !== undefined && !tours.isBusinessDate(value))
      ) {
        return failure(
          400,
          'invalid_date',
          `Das Datum (${label}) muss im Format JJJJ-MM-TT angegeben werden.`
        )
      }
    }
    if (from && to && from > to) {
      return failure(
        400,
        'invalid_range',
        'Der Zeitraum ist ungültig: „von" liegt nach „bis".'
      )
    }
    if (date) where['pickupDate'] = date
    else if (from || to) {
      where['pickupDate'] = {
        ...(from ? { [Op.gte]: from } : {}),
        ...(to ? { [Op.lte]: to } : {}),
      }
    }

    const status = singleString(query.status)
    if (status !== undefined) {
      const list = status === null ? [] : status.split(',').map((s) => s.trim())
      if (list.length === 0 || list.some((s) => !core.STATUS.includes(s))) {
        return failure(
          400,
          'invalid_status',
          'Status muss „offen", „bereit", „abgeholt" oder „storniert" sein.'
        )
      }
      where['status'] = list.length === 1 ? list[0] : { [Op.in]: list }
    }
    const channel = singleString(query.channel)
    if (channel !== undefined) {
      if (channel === null || !core.CHANNELS.includes(channel)) {
        return failure(
          400,
          'invalid_channel',
          'Unbekannter Bestellweg (laden, telefon, whatsapp, shop, sammelstelle).'
        )
      }
      where['channel'] = channel
    }
    const point = singleString(query.pickupPointId)
    let ladenOnly = false
    if (point !== undefined) {
      if (point === null || point.trim() === '') {
        return failure(400, 'invalid_pickup_point', 'Ungültige Sammelstelle.')
      }
      if (point === core.LADEN_PICKUP) {
        where['pickupPointId'] = null
        ladenOnly = true
      } else where['pickupPointId'] = point
    }
    const q = singleString(query.q)
    if (q !== undefined) {
      if (q === null || q.length > 100) {
        return failure(400, 'invalid_query', 'Der Suchbegriff ist ungültig.')
      }
      // LIKE-Platzhalter fallen weg: SQLite kennt ohne ESCAPE keine Maskierung.
      const text = q.trim().replace(/[%_\\]/g, '')
      if (text) {
        const like = `%${text}%`
        const digits = text.replace(/\D/g, '')
        const or: unknown[] = [
          { customerName: { [Op.like]: like } },
          { code: { [Op.like]: like } },
        ]
        if (digits.length >= 3) {
          or.push({ customerPhone: { [Op.like]: `%${digits}%` } })
        }
        where[Op.or as unknown as string] = or
      }
    }
    return { ok: true, status: 200, data: { where, ladenOnly } }
  }

  async list(query: ListFilters): Promise<Result<PreorderDto[]>> {
    const filters = this.parseFilters(query)
    if (isFailure(filters)) return filters
    const [records, points] = await Promise.all([
      this.findRecords(filters.data.where),
      this.pickupPoints(),
    ])
    const now = this.now()
    return {
      ok: true,
      status: 200,
      data: records.map((r) =>
        toDto(
          r,
          r.pickupPointId ? points.get(r.pickupPointId) ?? null : null,
          now
        )
      ),
    }
  }

  async get(id: unknown): Promise<Result<PreorderDto>> {
    const record = await this.findRecord(id)
    if (!record) return notFound()
    const points = await this.pickupPoints()
    return {
      ok: true,
      status: 200,
      data: toDto(
        record,
        record.pickupPointId ? points.get(record.pickupPointId) ?? null : null,
        this.now()
      ),
    }
  }

  /** Summen je Produkt/Variante eines Abholtags (Backzettel). */
  async sums(query: { date?: unknown; pickupPointId?: unknown }) {
    const date = singleString(query.date)
    if (!date || !tours.isBusinessDate(date)) {
      return failure(
        400,
        'invalid_date',
        'Für die Summen wird ein Datum im Format JJJJ-MM-TT gebraucht.'
      )
    }
    const filters = this.parseFilters({
      date,
      pickupPointId: query.pickupPointId,
    })
    if (isFailure(filters)) return filters
    const records = await this.findRecords({
      ...(filters.data.where as object),
      status: { [Op.ne]: 'storniert' },
    })
    return {
      ok: true as const,
      status: 200,
      data: {
        date,
        pickupPointId:
          typeof query.pickupPointId === 'string' ? query.pickupPointId : null,
        preorderCount: records.length,
        items: core.sumByProductVariant(records),
      },
    }
  }

  /** Tagesübersicht: Kopfzahlen, Summen, Sammelstellen, Liste. */
  async day(query: { date?: unknown }) {
    const date = singleString(query.date)
    if (!date || !tours.isBusinessDate(date)) {
      return failure(
        400,
        'invalid_date',
        'Für die Tagesübersicht wird ein Datum im Format JJJJ-MM-TT gebraucht.'
      )
    }
    const [records, points] = await Promise.all([
      this.findRecords({ pickupDate: date }),
      this.pickupPoints(),
    ])
    const now = this.now()
    return {
      ok: true as const,
      status: 200,
      data: {
        date,
        summary: core.summarizeDay(records),
        sums: core.sumByProductVariant(records),
        pickupPoints: core
          .pickupPointsForDate([...points.values()], date)
          .map((p: PickupPointDto) => ({
            ...p,
            deadline: core.deadlineFor(date, p.orderDeadline),
            preorderCount: records.filter(
              (r) => r.pickupPointId === p.id && r.status !== 'storniert'
            ).length,
          })),
        preorders: records.map((r) =>
          toDto(
            r,
            r.pickupPointId ? points.get(r.pickupPointId) ?? null : null,
            now
          )
        ),
      },
    }
  }

  // ------------------------------------------------------------- writing

  private normalizeOptions(
    points: Map<string, PickupPointDto>,
    requireVariant: boolean
  ) {
    return {
      lookupProduct: this.lookupProduct,
      findPickupPoint: (id: string) => points.get(id) ?? null,
      variantsForProduct: this.variants,
      requireVariant,
      now: this.now(),
    }
  }

  private async writeItems(
    preorderId: number,
    items: PreorderRecord['items'],
    transaction: Transaction
  ): Promise<void> {
    await PreorderItem.destroy({ where: { preorderId }, transaction })
    await PreorderItem.bulkCreate(
      items.map((i) => ({
        preorderId,
        productId: i.productId,
        productName: i.name,
        unit: i.unit,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        variant: i.variant ?? '',
      })),
      { transaction }
    )
  }

  /**
   * Creates a preorder. `requireVariant: false` for the Mörsbach alias and
   * the shop (their forms cannot choose a Sorte).
   */
  async create(
    body: unknown,
    req: Request | null,
    options: { requireVariant?: boolean; auditAction?: string } = {}
  ): Promise<Result<PreorderRecord>> {
    return getSequelize().transaction(async (transaction) => {
      const points = await this.pickupPoints(transaction)
      const result = core.normalizeOrderInput(
        body,
        null,
        this.normalizeOptions(points, options.requireVariant !== false)
      )
      if (result.error) {
        return failure<PreorderRecord>(
          result.status,
          result.error,
          result.message
        )
      }
      const input = result.preorder
      const code = await allocateCode(
        input.pickupPointId,
        input.pickupDate,
        transaction
      )
      const userId = req?.user?.id ?? null
      const row = await Preorder.create(
        {
          code,
          channel: input.channel,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          pickupDate: input.pickupDate,
          pickupTime: input.pickupTime,
          pickupPointId: input.pickupPointId,
          status: input.status,
          paid: input.paid,
          note: input.note,
          pickedUpAt: input.pickedUpAt ? new Date(input.pickedUpAt) : null,
          notCollectedAt: input.notCollectedAt
            ? new Date(input.notCollectedAt)
            : null,
          createdBy: userId,
          updatedBy: userId,
        },
        { transaction }
      )
      await this.writeItems(row.id, input.items, transaction)
      const record = (await this.findRecord(
        row.id,
        transaction
      )) as PreorderRecord
      await audit(
        req,
        options.auditAction ?? 'create',
        'preorder',
        record.id,
        auditData(record),
        { transaction }
      )
      return { ok: true as const, status: 201, data: record }
    })
  }

  /**
   * Updates a preorder (fields, items, status). `guard` runs inside the
   * transaction on the current record and may refuse (alias rules).
   */
  async update(
    id: unknown,
    body: unknown,
    req: Request | null,
    options: {
      requireVariant?: boolean
      guard?: (current: PreorderRecord) => Result<never> | null
      mapBody?: (current: PreorderRecord) => unknown
    } = {}
  ): Promise<Result<PreorderRecord>> {
    return getSequelize().transaction(async (transaction) => {
      const current = await this.findRecord(id, transaction)
      if (!current) return notFound<PreorderRecord>()
      const refused = options.guard?.(current)
      if (refused) return refused
      const points = await this.pickupPoints(transaction)
      const input = options.mapBody ? options.mapBody(current) : body
      const result = core.normalizeOrderInput(
        input,
        current,
        this.normalizeOptions(points, options.requireVariant !== false)
      )
      if (result.error) {
        return failure<PreorderRecord>(
          result.status,
          result.error,
          result.message
        )
      }
      const next = result.preorder
      const changed = changedFields(current, next)
      if (changed.length === 0) {
        return { ok: true as const, status: 200, data: current }
      }
      const code = core.codeNeedsRenewal(
        current.code,
        next.pickupPointId,
        next.pickupDate
      )
        ? await allocateCode(next.pickupPointId, next.pickupDate, transaction)
        : current.code
      await Preorder.update(
        {
          code,
          channel: next.channel,
          customerName: next.customerName,
          customerPhone: next.customerPhone,
          pickupDate: next.pickupDate,
          pickupTime: next.pickupTime,
          pickupPointId: next.pickupPointId,
          status: next.status,
          paid: next.paid,
          note: next.note,
          pickedUpAt: next.pickedUpAt ? new Date(next.pickedUpAt) : null,
          notCollectedAt: next.notCollectedAt
            ? new Date(next.notCollectedAt)
            : null,
          updatedBy: req?.user?.id ?? null,
        },
        { where: { id: current.id }, transaction }
      )
      if (changed.includes('items')) {
        await this.writeItems(current.id, next.items, transaction)
      }
      const record = (await this.findRecord(
        current.id,
        transaction
      )) as PreorderRecord
      await audit(
        req,
        'update',
        'preorder',
        record.id,
        auditData(record, {
          changed,
          ...(code !== current.code ? { previousCode: current.code } : {}),
          ...(changed.includes('status') ? { from: current.status } : {}),
        }),
        { transaction }
      )
      return { ok: true as const, status: 200, data: record }
    })
  }

  /** Status / bezahlt / nicht abgeholt (`POST /:id/status`). */
  async changeStatus(
    id: unknown,
    body: unknown,
    req: Request | null,
    options: {
      allowedTargets?: string[]
      action?: string
      guard?: (current: PreorderRecord) => Result<never> | null
      mapBody?: (current: PreorderRecord) => unknown
    } = {}
  ): Promise<Result<PreorderRecord>> {
    return getSequelize().transaction(async (transaction) => {
      const current = await this.findRecord(id, transaction)
      if (!current) return notFound<PreorderRecord>()
      // Inside the transaction: no window between check and write.
      const refused = options.guard?.(current)
      if (refused) return refused
      const input = options.mapBody ? options.mapBody(current) : body
      const result = core.normalizeStatusChange(current, input, {
        allowedTargets: options.allowedTargets,
        now: this.now(),
      })
      if (result.error) {
        return failure<PreorderRecord>(
          result.status,
          result.error,
          result.message
        )
      }
      const changes = result.changes as Record<string, unknown>
      const changed = changedFields(current, { ...current, ...changes })
      if (changed.length === 0) {
        return { ok: true as const, status: 200, data: current }
      }
      await Preorder.update(
        {
          status: changes['status'] as Preorder['status'],
          pickedUpAt: changes['pickedUpAt']
            ? new Date(changes['pickedUpAt'] as string)
            : null,
          notCollectedAt: changes['notCollectedAt']
            ? new Date(changes['notCollectedAt'] as string)
            : null,
          ...(changes['paid'] !== undefined
            ? { paid: changes['paid'] as boolean }
            : {}),
          updatedBy: req?.user?.id ?? null,
        },
        { where: { id: current.id }, transaction }
      )
      const record = (await this.findRecord(
        current.id,
        transaction
      )) as PreorderRecord
      await audit(
        req,
        options.action ?? 'status',
        'preorder',
        record.id,
        auditData(record, { changed, from: current.status }),
        { transaction }
      )
      return { ok: true as const, status: 200, data: record }
    })
  }

  /** Stornieren - nie löschen. `guard` läuft in derselben Transaktion. */
  async cancel(
    id: unknown,
    req: Request | null,
    guard?: (current: PreorderRecord) => Result<never> | null
  ): Promise<Result<PreorderRecord>> {
    return this.changeStatus(id, { status: 'storniert' }, req, {
      action: 'cancel',
      guard,
    })
  }

  async updatePickupPoint(
    id: string,
    body: unknown,
    req: Request | null
  ): Promise<Result<PickupPointDto>> {
    return getSequelize().transaction(async (transaction) => {
      const row = await PickupPoint.findByPk(id, { transaction })
      if (!row) {
        return failure<PickupPointDto>(
          404,
          'Pickup point not found',
          'Diese Lieferstelle existiert nicht.'
        )
      }
      const before = toPickupPointDto(row)
      const result = core.normalizePickupPointInput(body, before)
      if (result.error) {
        return failure<PickupPointDto>(400, result.error, result.message)
      }
      const next = result.pickupPoint as PickupPointDto
      await row.update(
        {
          name: next.name,
          street: next.street,
          zip: next.zip,
          city: next.city,
          weekday: next.weekday,
          window: next.window,
          orderDeadline: next.orderDeadline,
          notes: next.notes,
          active: next.active,
          lat: next.lat ?? null,
          lon: next.lon ?? null,
          geocodeSource: next.geocodeSource ?? null,
          geocodePrecision: next.geocodePrecision ?? null,
        },
        { transaction }
      )
      const after = toPickupPointDto(row)
      const changed = (
        Object.keys(after) as Array<keyof PickupPointDto>
      ).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]))
      if (changed.length > 0) {
        await audit(
          req,
          'update',
          'pickup_point',
          id,
          { changed },
          {
            transaction,
          }
        )
      }
      return { ok: true as const, status: 200, data: after }
    })
  }
}

function notFound<T>(): Result<T> {
  return failure<T>(404, 'not_found', 'Diese Vorbestellung existiert nicht.')
}
