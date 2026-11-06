/**
 * Vorbestellungen (B7) - Datenbank-Schicht über `delivery-preorders.core.js`.
 *
 * Gerechnet und geprüft wird ausschließlich im Core (einzige
 * Formelquelle); hier stehen Laden, Speichern, Code-Vergabe,
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
import {
  AuditLog,
  getSequelize,
  PickupPoint,
  Preorder,
  PreorderItem,
} from '../models'
import { catalogueFor, defaultProductsDir } from './hq-catalogue'
import {
  createVariantsHook,
  VariantsForProduct,
  VariantsMap,
} from './preorder-variants'

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
  /**
   * Alle Produkte mit Sorten (`GET /variants`); default: `all()` des
   * Standard-Hakens. Wer nur `variantsForProduct` übergibt, bekommt `null`
   * (keine Liste, Sorten-Chips bleiben aus).
   */
  variantsMap?: () => VariantsMap | null
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
/** Client id of one save (`requestId`), e.g. a UUID. */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/

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
  /** Amount recorded as paid; `null` with `paid` = paid in full (legacy). */
  paidAmount: number | null
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

interface ComparableInput {
  channel: string
  customerName: string | null
  customerPhone: string | null
  pickupDate: string
  pickupTime: string | null
  pickupPointId: string | null
  paid: boolean
  note: string | null
  items: Array<{ productId: string; variant?: string | null; quantity: number }>
}

function itemKeys(items: ComparableInput['items']): string {
  return items
    .map((i) => `${i.productId}|${i.variant ?? ''}|${Number(i.quantity)}`)
    .sort()
    .join(',')
}

/**
 * Does a retried create (same `requestId`) carry what the stored order
 * holds? Prices are left out: they are the server's snapshot, not input.
 */
export function sameOrderInput(
  input: ComparableInput,
  record: PreorderRecord
): boolean {
  return (
    input.channel === record.channel &&
    (input.customerName ?? null) === (record.customerName ?? null) &&
    (input.customerPhone ?? null) === (record.customerPhone ?? null) &&
    input.pickupDate === record.pickupDate &&
    (input.pickupTime ?? null) === (record.pickupTime ?? null) &&
    (input.pickupPointId ?? null) === (record.pickupPointId ?? null) &&
    Boolean(input.paid) === Boolean(record.paid) &&
    (input.note ?? null) === (record.note ?? null) &&
    itemKeys(input.items) === itemKeys(record.items)
  )
}

function itemsSummary(items: PreorderRecord['items']): string {
  if (items.length === 0) return 'ohne Artikel'
  return items
    .map(
      (i) =>
        `${String(i.quantity).replace('.', ',')} × ${i.name}${
          i.variant ? ` (${i.variant})` : ''
        }`
    )
    .join(', ')
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
    paidAmount:
      p.paid && p.paidAmount != null && p.paidAmount !== ''
        ? Number(p.paidAmount)
        : null,
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
    // W4 verification round 2: what was paid, and what is still owed (> 0)
    // or must be refunded (< 0) - after an edit or a cancellation.
    paidAmount: record.paid ? record.paidAmount ?? record.total : null,
    paymentBalance: core.paymentBalance(record),
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
    'paidAmount',
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

/**
 * Sammelstellen eines Tages: die, die an diesem Wochentag aktiv beliefert
 * werden, plus jede Stelle, die an dem Tag noch Bestellungen hat - auch wenn
 * sie inzwischen deaktiviert ist oder den Wochentag gewechselt hat
 * (W4-verify r4). Sonst verschwänden schon gebuchte Bestellungen aus der
 * Abholliste.
 */
function dayPickupPoints(
  points: Map<string, PickupPointDto>,
  records: readonly PreorderRecord[],
  date: string
): PickupPointDto[] {
  const served: PickupPointDto[] = core.pickupPointsForDate(
    [...points.values()],
    date
  )
  const ids = new Set(served.map((p) => p.id))
  const booked = new Set(
    records
      .filter((r) => r.pickupPointId && r.status !== 'storniert')
      .map((r) => r.pickupPointId as string)
  )
  const extra = [...points.values()].filter(
    (p) => booked.has(p.id) && !ids.has(p.id)
  )
  return [...served, ...extra]
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

/**
 * Called inside the write transaction of every preorder write that can change
 * what is baked (create, edit, status, cancel, bulk) with the pickup dates it
 * touched (before and after). The Backzettel (Z3) records its deltas here
 * (W4) - in the same transaction, so a preorder write and its delta commit or
 * roll back together. Must not throw for a missing config (it remembers the
 * day instead); a database error rolls the preorder write back.
 */
export type PreorderWriteHook = (
  dates: string[],
  context: { transaction: Transaction; req: Request | null; via: string }
) => Promise<void>

/**
 * Called inside the write transaction of a pickup point update that changed
 * something (B8): the delivery tours copy a new address into the stops of
 * that point, so the driver is not sent to the old one.
 */
export type PickupPointChangeHook = (
  before: PickupPointDto,
  after: PickupPointDto,
  context: { transaction: Transaction; req: Request | null }
) => Promise<void>

/** Filters of the Mörsbach alias list (`GET /api/deliveries/preorders`). */
export interface LegacyListQuery {
  date?: unknown
  pickupPointId?: unknown
  status?: unknown
}

/** Per-id outcome of `POST /api/preorders/bulk-status` (W4). */
export type BulkStatusOutcome =
  | 'ok'
  | 'conflict'
  | 'anonymized'
  | 'not_found'
  | 'refused'

export interface BulkStatusResult {
  id: number
  result: BulkStatusOutcome
  /** Machine code of a failure (`stale_preorder`, `forbidden`, …). */
  error?: string
  message?: string
  /** The preorder after the write (`ok`) or as it stands now (conflict). */
  data?: PreorderRecord
}

export type BulkCounts = Record<BulkStatusOutcome, number>

export interface StatusChangeOptions {
  /** fahrer: only these targets (`abgeholt`, `nicht_abgeholt`). */
  allowedTargets?: string[]
  /** Today (Berlin): „nicht abgeholt" is refused before the pickup day (W4). */
  notCollectedFrom?: string
  action?: string
  guard?: (current: PreorderRecord) => Result<never> | null
  mapBody?: (current: PreorderRecord) => unknown
  /**
   * Mörsbach alias (D3): leaving „abgeholt" keeps the payment, as the mock
   * does. `/api/preorders` restores the payment from before the handover.
   */
  keepPaymentOnUndo?: boolean
}

/** Codes that mean "the copy the client loaded is out of date". */
const CONFLICT_CODES = new Set([
  'stale_preorder',
  'already_picked_up',
  'cancelled',
])

export const BULK_STATUS_MAX_IDS = 200

/** Ruhetage des Ladens nach `Date.getDay()` (1 = Montag). */
export const PREORDER_CLOSED_WEEKDAYS = [1]
/** Vorbestellungen höchstens so viele Tage im Voraus … */
export const PREORDER_MAX_DAYS_AHEAD = 366
/** … und nachgetragen höchstens so weit zurück (P4 anonymisiert nach 90 Tagen). */
export const PREORDER_MAX_DAYS_BACK = 30

/**
 * `*[öÖ][zZ]…*` - a GLOB pattern that finds `text` anywhere, ignoring case
 * for every letter with a one-character upper/lower pair (SQLite's LIKE and
 * lower() only fold ASCII). `*`, `?` and `[` are matched literally.
 */
export function caseInsensitiveGlob(text: string): string {
  let out = ''
  for (const ch of text) {
    if (ch === '*' || ch === '?' || ch === '[') {
      out += `[${ch}]`
      continue
    }
    const lower = ch.toLocaleLowerCase('de-DE')
    const upper = ch.toLocaleUpperCase('de-DE')
    out +=
      lower !== upper && [...lower].length === 1 && [...upper].length === 1
        ? `[${lower}${upper}]`
        : ch
  }
  return `*${out}*`
}

export class PreordersService {
  private readonly productsDir: string
  private readonly variants: VariantsForProduct
  private readonly allVariants: () => VariantsMap | null
  private readonly clock: () => Date
  private writeHook: PreorderWriteHook | null = null
  private pickupPointHook: PickupPointChangeHook | null = null

  /** Registers the Backzettel delta recorder (app.ts, W4). */
  onWrite(hook: PreorderWriteHook | null): void {
    this.writeHook = hook
  }

  /** Registers the delivery tours' stop sync (app.ts, B8). */
  onPickupPointChanged(hook: PickupPointChangeHook | null): void {
    this.pickupPointHook = hook
  }

  private async notifyWrite(
    dates: Array<string | null | undefined>,
    transaction: Transaction,
    req: Request | null,
    via: string
  ): Promise<void> {
    if (!this.writeHook) return
    const unique = [
      ...new Set(dates.filter((d): d is string => typeof d === 'string')),
    ].sort()
    if (unique.length === 0) return
    await this.writeHook(unique, { transaction, req, via })
  }

  constructor(options: PreordersOptions = {}) {
    this.productsDir = options.productsDir ?? defaultProductsDir()
    if (options.variantsForProduct) {
      this.variants = options.variantsForProduct
      this.allVariants = options.variantsMap ?? (() => null)
    } else {
      const hook = createVariantsHook()
      this.variants = hook
      this.allVariants = options.variantsMap ?? hook.all
    }
    this.clock = options.now ?? (() => new Date())
  }

  /**
   * Sorten je Produkt aus den Backzettel-Stammdaten (P1). `configured: false`
   * heißt: keine gültige `backzettel.yaml` - dann nimmt die API jede Sorte an
   * und die Maske bietet keine an.
   */
  variantsByProduct(): { configured: boolean; products: VariantsMap } {
    const map = this.allVariants()
    return map
      ? { configured: true, products: map }
      : { configured: false, products: {} }
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
      // W4-verify r3: SQLite's LIKE ignores case for A-Z only - „öztürk“
      // did not find „Öztürk“. GLOB with a [xX] set per letter ignores case
      // for every letter (Ä/ä, Ö/ö, Ü/ü …) and has no `%`/`_` wildcards, so
      // „%“ searches for a literal percent sign instead of matching all.
      const text = q.trim()
      if (text) {
        const pattern = caseInsensitiveGlob(text)
        const digits = text.replace(/\D/g, '')
        const or: unknown[] = [
          getSequelize().where(
            getSequelize().col('Preorder.customer_name'),
            'GLOB',
            pattern
          ),
          getSequelize().where(
            getSequelize().col('Preorder.code'),
            'GLOB',
            pattern
          ),
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

  /**
   * Sammelstellen-Bestellungen in der Mock-Form (`toLegacyPreorder`),
   * gefiltert und sortiert wie im Mock: der Mörsbach-Alias
   * (`GET /api/deliveries/preorders`) und die Übergabeliste eines
   * Sammelstellen-Stopps der Touren (B8) lesen beide hier. Laden-Bestellungen
   * fehlen; ungültige Filter ergeben eine leere Liste (die Route prüft vorher).
   */
  async legacyList(query: LegacyListQuery): Promise<Record<string, unknown>[]> {
    const filters: ListFilters = {}
    if (typeof query.date === 'string') filters.date = query.date
    if (query.pickupPointId !== undefined) {
      filters.pickupPointId = String(query.pickupPointId)
    }
    const result = await this.list(filters)
    if (isFailure(result)) return []
    const points = await this.pickupPoints()
    const now = this.now()
    return result.data
      .filter((p) => p.pickupPointId !== null)
      .map((p) =>
        core.toLegacyPreorder(
          { ...p, items: p.items },
          points.get(p.pickupPointId as string) ?? null,
          now
        )
      )
      .filter(
        (p: { status: string }) =>
          query.status === undefined || p.status === query.status
      )
      .sort(
        (a: { date: string; reference: string }, b: typeof a) =>
          a.date.localeCompare(b.date) ||
          String(a.reference).localeCompare(String(b.reference))
      )
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
    const all = await this.findRecords(filters.data.where)
    const records = all.filter((r) => r.status !== 'storniert')
    return {
      ok: true as const,
      status: 200,
      data: {
        date,
        pickupPointId:
          typeof query.pickupPointId === 'string' ? query.pickupPointId : null,
        preorderCount: records.length,
        items: core.sumByProductVariant(records),
        // Kopfzahlen der Backliste (W4) - dieselben wie `/day`, aber ohne
        // Namen und Telefonnummern: die Backliste braucht keine Kundendaten.
        summary: core.summarizeDay(all),
      },
    }
  }

  /**
   * Tagesübersicht: Kopfzahlen, Summen, Sammelstellen, Liste.
   *
   * Mit `pickupPointId` (eine Sammelstelle oder `laden`, P2 Abholliste)
   * gelten Kopfzahlen, Summen und Liste nur für diesen Abholort; die
   * Sammelstellen des Tages (Bestellschluss, Anzahl) bleiben vollständig.
   */
  async day(query: { date?: unknown; pickupPointId?: unknown }) {
    const date = singleString(query.date)
    if (!date || !tours.isBusinessDate(date)) {
      return failure(
        400,
        'invalid_date',
        'Für die Tagesübersicht wird ein Datum im Format JJJJ-MM-TT gebraucht.'
      )
    }
    const filters = this.parseFilters({
      date,
      pickupPointId: query.pickupPointId,
    })
    if (isFailure(filters)) return filters
    const [all, points] = await Promise.all([
      this.findRecords({ pickupDate: date }),
      this.pickupPoints(),
    ])
    const place = singleString(query.pickupPointId)
    const records =
      place === undefined || place === null
        ? all
        : all.filter((r) =>
            place === core.LADEN_PICKUP
              ? r.pickupPointId === null
              : r.pickupPointId === place
          )
    const now = this.now()
    return {
      ok: true as const,
      status: 200,
      data: {
        date,
        pickupPointId: place ?? null,
        summary: core.summarizeDay(records),
        sums: core.sumByProductVariant(records),
        pickupPoints: dayPickupPoints(points, all, date).map(
          (p: PickupPointDto) => ({
            ...p,
            deadline: core.deadlineFor(date, p.orderDeadline),
            preorderCount: all.filter(
              (r) => r.pickupPointId === p.id && r.status !== 'storniert'
            ).length,
          })
        ),
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
    requireVariant: boolean,
    lockCancelled = false,
    strictPickup = false
  ) {
    return {
      lookupProduct: this.lookupProduct,
      findPickupPoint: (id: string) => points.get(id) ?? null,
      variantsForProduct: this.variants,
      requireVariant,
      lockCancelled,
      now: this.now(),
      // `/api/preorders` (W4-Verifikation): Abholtag im Zeitfenster, kein
      // Ruhetag im Laden, „nicht abgeholt“ erst ab dem Abholtag. Der
      // Mörsbach-Alias hält den Mock-Vertrag und lässt das weg.
      ...(strictPickup
        ? {
            pickupRules: {
              today: this.today(),
              closedWeekdays: PREORDER_CLOSED_WEEKDAYS,
              maxDaysAhead: PREORDER_MAX_DAYS_AHEAD,
              maxDaysBack: PREORDER_MAX_DAYS_BACK,
            },
            notCollectedFrom: this.today(),
          }
        : {}),
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
    options: {
      requireVariant?: boolean
      auditAction?: string
      /** Abholtag-Regeln von `/api/preorders` (siehe `normalizeOptions`). */
      strictPickup?: boolean
    } = {}
  ): Promise<Result<PreorderRecord>> {
    // W4-verify r4: the entry form's id for this save, kept across retries.
    const rawRequestId =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['requestId']
        : undefined
    if (
      rawRequestId !== undefined &&
      rawRequestId !== null &&
      (typeof rawRequestId !== 'string' || !REQUEST_ID.test(rawRequestId))
    ) {
      return failure<PreorderRecord>(
        400,
        'invalid_request_id',
        'requestId muss 8 bis 64 Zeichen aus Buchstaben, Ziffern, „-“ und „_“ sein.'
      )
    }
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : null
    return getSequelize().transaction(async (transaction) => {
      if (requestId) {
        // Same save again (its answer was lost): the order it created, not
        // a second one with a second code.
        const earlier = await Preorder.findOne({
          where: { requestId },
          transaction,
        })
        if (earlier) {
          if (earlier.createdBy !== (req?.user?.id ?? null)) {
            return failure<PreorderRecord>(
              409,
              'request_id_conflict',
              'Diese Anfrage-ID gehört zu einer anderen Vorbestellung.'
            )
          }
          const record = (await this.findRecord(
            earlier.id,
            transaction
          )) as PreorderRecord
          // W4-verify r5: only an unchanged retry is the same save. A form
          // edited after the unclear attempt (more items, a name fix,
          // „bezahlt“, or the next customer typed over a restored draft)
          // must not be answered with the old order as if it were saved.
          // Compared on the normalised input without the pickup-day window,
          // so a retry after the Bestellschluss still finds its order.
          const points = await this.pickupPoints(transaction)
          const replay = core.normalizeOrderInput(
            body,
            null,
            this.normalizeOptions(
              points,
              options.requireVariant !== false,
              false,
              false
            )
          )
          if (replay.error) {
            return failure<PreorderRecord>(
              replay.status,
              replay.error,
              replay.message
            )
          }
          if (!sameOrderInput(replay.preorder, record)) {
            return failure<PreorderRecord>(
              409,
              'request_id_changed',
              `Diese Vorbestellung ist beim ersten Versuch schon angekommen: ${
                record.code
              } · ${record.customerName ?? 'ohne Namen'} · ${itemsSummary(
                record.items
              )} - mit den Angaben von damals. Was seitdem geändert wurde, ist NICHT gespeichert.`,
              {
                preorder: {
                  id: record.id,
                  code: record.code,
                  updatedAt: iso(record.updatedAt),
                },
              }
            )
          }
          return { ok: true as const, status: 200, data: record }
        }
      }
      const points = await this.pickupPoints(transaction)
      const result = core.normalizeOrderInput(
        body,
        null,
        this.normalizeOptions(
          points,
          options.requireVariant !== false,
          false,
          options.strictPickup === true
        )
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
          paidAmount: input.paid ? core.itemsTotal(input.items) : null,
          note: input.note,
          pickedUpAt: input.pickedUpAt ? new Date(input.pickedUpAt) : null,
          notCollectedAt: input.notCollectedAt
            ? new Date(input.notCollectedAt)
            : null,
          createdBy: userId,
          updatedBy: userId,
          requestId,
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
      await this.notifyWrite([record.pickupDate], transaction, req, 'create')
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
      /** Stornierte Bestellungen: Positionen/Tag/Ort gesperrt (409 `cancelled`). */
      lockCancelled?: boolean
      /** Abholtag-Regeln von `/api/preorders` (siehe `normalizeOptions`). */
      strictPickup?: boolean
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
        this.normalizeOptions(
          points,
          options.requireVariant !== false,
          options.lockCancelled === true,
          options.strictPickup === true
        )
      )
      if (result.error) {
        return failure<PreorderRecord>(
          result.status,
          result.error,
          result.message
        )
      }
      const next = result.preorder
      // Paid amount: recorded when payment is first recorded, kept while the
      // order stays paid (an edit then shows a balance), cleared with `paid`.
      const itemsChanged = changedFields(current, next).includes('items')
      const paidAmount = !next.paid
        ? null
        : current.paid
        ? current.paidAmount ?? (itemsChanged ? current.total : null)
        : core.itemsTotal(next.items ?? current.items)
      const changed = changedFields(current, { ...next, paidAmount })
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
          paidAmount,
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
      if (changed.some((k) => ['items', 'pickupDate', 'status'].includes(k))) {
        await this.notifyWrite(
          [current.pickupDate, record.pickupDate],
          transaction,
          req,
          'update'
        )
      }
      return { ok: true as const, status: 200, data: record }
    })
  }

  /** Status / bezahlt / nicht abgeholt (`POST /:id/status`). */
  async changeStatus(
    id: unknown,
    body: unknown,
    req: Request | null,
    options: StatusChangeOptions = {}
  ): Promise<Result<PreorderRecord>> {
    return getSequelize().transaction(async (transaction) => {
      const result = await this.changeStatusIn(
        transaction,
        id,
        body,
        req,
        options
      )
      if (result.ok && result.changed) {
        await this.notifyWrite(
          [result.data.pickupDate],
          transaction,
          req,
          options.action ?? 'status'
        )
      }
      return result
    })
  }

  /**
   * One status change inside a running transaction. `changed` says whether
   * the status itself moved (the caller notifies the Backzettel then).
   */
  private async changeStatusIn(
    transaction: Transaction,
    id: unknown,
    body: unknown,
    req: Request | null,
    options: StatusChangeOptions & { auditExtra?: Record<string, unknown> }
  ): Promise<
    | { ok: true; status: number; data: PreorderRecord; changed: boolean }
    | Failure
  > {
    const current = await this.findRecord(id, transaction)
    if (!current) return notFound<PreorderRecord>() as Failure
    // Inside the transaction: no window between check and write.
    const refused = options.guard?.(current)
    if (refused) return refused as Failure
    const input = options.mapBody ? options.mapBody(current) : body
    const result = core.normalizeStatusChange(current, input, {
      allowedTargets: options.allowedTargets,
      notCollectedFrom: options.notCollectedFrom,
      now: this.now(),
    })
    if (result.error) {
      return failure<PreorderRecord>(
        result.status,
        result.error,
        result.message
      ) as Failure
    }
    const changes = result.changes as Record<string, unknown>
    // An explicit `paid: true` means the full current total was collected -
    // also on an order already paid with a balance left (W4-verify r2).
    const explicitPaid =
      input && typeof input === 'object'
        ? (input as Record<string, unknown>)['paid']
        : undefined
    let paidAfter =
      changes['paid'] !== undefined ? !!changes['paid'] : current.paid
    let paidAmount = !paidAfter
      ? null
      : explicitPaid === true || !current.paid
      ? current.total
      : current.paidAmount
    // Übergabe zurücknehmen (W4-verify r4): die Zahlung von vor der Übergabe
    // kommt zurück - sonst stünde „Bezahlt und übergeben“ als kassiert da,
    // obwohl das Geld nie genommen wurde, und die nächste Übergabe fragte
    // nicht mehr danach. Nur wenn seit der Übergabe niemand die Zahlung
    // geändert hat und der Request keine andere Zahlung verlangt.
    const leavesHandover =
      current.status === 'abgeholt' && changes['status'] !== 'abgeholt'
    if (leavesHandover && !options.keepPaymentOnUndo) {
      const before = await this.paymentBeforeHandover(current, transaction)
      if (
        before &&
        (explicitPaid === undefined || explicitPaid === before.paid)
      ) {
        changes['paid'] = before.paid
        paidAfter = before.paid
        paidAmount = before.paid ? before.paidAmount : null
      }
    }
    const handover =
      current.status !== 'abgeholt' && changes['status'] === 'abgeholt'
    const changed = changedFields(current, {
      ...current,
      ...changes,
      paidAmount,
    })
    if (changed.length === 0) {
      return { ok: true, status: 200, data: current, changed: false }
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
        paidAmount,
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
      auditData(record, {
        changed,
        from: current.status,
        ...(handover
          ? {
              payment: {
                before: { paid: current.paid, paidAmount: current.paidAmount },
                after: { paid: record.paid, paidAmount: record.paidAmount },
              },
            }
          : {}),
        ...(options.auditExtra ?? {}),
      }),
      { transaction }
    )
    return {
      ok: true,
      status: 200,
      data: record,
      changed: changed.includes('status'),
    }
  }

  /**
   * Zahlung vor der letzten Übergabe, aus deren Audit-Zeile (`payment`).
   * `null`, wenn es keine solche Zeile gibt oder die Zahlung seither
   * geändert wurde (dann gilt, was jetzt gespeichert ist).
   */
  private async paymentBeforeHandover(
    current: PreorderRecord,
    transaction: Transaction
  ): Promise<{ paid: boolean; paidAmount: number | null } | null> {
    const rows = await AuditLog.findAll({
      where: { entity: 'preorder', entityId: String(current.id) },
      order: [['id', 'DESC']],
      limit: 20,
      transaction,
    })
    for (const row of rows) {
      const data = (
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      ) as Record<string, unknown> | null
      const payment = data?.['payment'] as
        | {
            before?: { paid?: unknown; paidAmount?: unknown }
            after?: { paid?: unknown; paidAmount?: unknown }
          }
        | undefined
      if (!payment || !payment.before || !payment.after) continue
      const amount = (v: unknown) =>
        v === null || v === undefined || v === '' ? null : Number(v)
      const after = {
        paid: !!payment.after.paid,
        paidAmount: payment.after.paid
          ? amount(payment.after.paidAmount)
          : null,
      }
      if (
        after.paid !== current.paid ||
        (after.paid && after.paidAmount !== current.paidAmount)
      ) {
        return null
      }
      const paid = !!payment.before.paid
      return {
        paid,
        paidAmount: paid ? amount(payment.before.paidAmount) : null,
      }
    }
    return null
  }

  /**
   * `POST /api/preorders/bulk-status` (W4): one status change for many
   * preorders in **one** serialised write transaction - the Abholliste's
   * "alle bereit" and "Tagesabschluss". Each id is checked like a single
   * `POST /:id/status` (same core rules, same role targets, its own
   * `expectedUpdatedAt` from the map) and answered on its own; a refused id
   * never stops the others. Only an unexpected error rolls everything back.
   * Each change writes its own `status` audit row (`bulk: true`).
   */
  async bulkStatus(
    body: unknown,
    req: Request | null,
    options: Pick<StatusChangeOptions, 'allowedTargets' | 'notCollectedFrom'>
  ): Promise<Result<{ results: BulkStatusResult[]; counts: BulkCounts }>> {
    const b =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {}
    // Integers or canonical digit strings ("7"), like the single routes'
    // `/:id` parameter; anything else ("07", 2.5, "x") makes the list invalid.
    const rawIds = b['ids']
    const ids = Array.isArray(rawIds)
      ? rawIds.map((id) =>
          typeof id === 'string' && /^[1-9][0-9]{0,15}$/.test(id)
            ? Number(id)
            : id
        )
      : null
    if (
      !ids ||
      ids.length === 0 ||
      ids.length > BULK_STATUS_MAX_IDS ||
      ids.some((id) => !Number.isSafeInteger(id) || (id as number) <= 0)
    ) {
      return failure(
        400,
        'invalid_ids',
        `„ids" muss eine Liste von 1 bis ${BULK_STATUS_MAX_IDS} Bestellnummern (ganze Zahlen) sein.`
      )
    }
    const unique = [...new Set(ids as number[])]
    const expected = b['expectedUpdatedAt']
    if (
      expected !== undefined &&
      expected !== null &&
      (typeof expected !== 'object' || Array.isArray(expected))
    ) {
      return failure(
        400,
        'invalid_expected_updated_at',
        '„expectedUpdatedAt" muss eine Zuordnung Bestellnummer → Zeitstempel sein.'
      )
    }
    const versions = (expected ?? {}) as Record<string, unknown>
    const change: Record<string, unknown> = {}
    for (const key of ['status', 'notCollected', 'paid']) {
      if (b[key] !== undefined) change[key] = b[key]
    }
    if (Object.keys(change).length === 0) {
      return failure(
        400,
        'invalid_status',
        'Es fehlt, was geändert werden soll (status, notCollected oder paid).'
      )
    }
    // Values that are wrong for every preorder (unknown status, paid not a
    // boolean, "nicht abgeholt" with another status) are one 400 for the
    // request, not a `refused` per id. Checked against a neutral open
    // preorder; record-dependent rules stay per id.
    const shape = core.normalizeStatusChange({ status: 'offen' }, change, {})
    if (
      shape.error &&
      ['invalid_status', 'invalid_not_collected', 'invalid_paid'].includes(
        shape.error
      )
    ) {
      return failure(400, shape.error, shape.message)
    }

    return getSequelize().transaction(async (transaction) => {
      const results: BulkStatusResult[] = []
      const dates: string[] = []
      for (const id of unique) {
        const result = await this.changeStatusIn(transaction, id, change, req, {
          ...options,
          guard: expectedVersionGuard({
            expectedUpdatedAt: versions[String(id)],
          }),
          auditExtra: { bulk: true },
        })
        if (result.ok) {
          if (result.changed) dates.push(result.data.pickupDate)
          results.push({ id, result: 'ok', data: result.data })
          continue
        }
        const refused = result as Failure
        const outcome: BulkStatusOutcome =
          refused.status === 404
            ? 'not_found'
            : refused.error === 'anonymized'
            ? 'anonymized'
            : CONFLICT_CODES.has(refused.error)
            ? 'conflict'
            : 'refused'
        const now =
          outcome === 'conflict' ? await this.findRecord(id, transaction) : null
        results.push({
          id,
          result: outcome,
          error: refused.error,
          message: refused.message,
          ...(now ? { data: now } : {}),
        })
      }
      await this.notifyWrite(dates, transaction, req, 'bulk_status')
      const counts: BulkCounts = {
        ok: 0,
        conflict: 0,
        anonymized: 0,
        not_found: 0,
        refused: 0,
      }
      for (const r of results) counts[r.result] += 1
      return { ok: true as const, status: 200, data: { results, counts } }
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
      // Optimistische Sperre wie bei den Vorbestellungen (W4): zwei offene
      // Formulare überschreiben sich nicht still. Ohne das Feld keine Prüfung
      // (Mock-Alias, Altclients).
      const stale = pickupPointVersionGuard(body, row.updatedAt)
      if (stale) return stale
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
        if (this.pickupPointHook) {
          await this.pickupPointHook(before, after, { transaction, req })
        }
      }
      return { ok: true as const, status: 200, data: after }
    })
  }

  /**
   * Sammelstellen mit `updatedAt` - nur für `/api/preorders` (P2-Formular,
   * `expectedUpdatedAt`). Der Mörsbach-Alias bleibt beim Mock-Vertrag ohne
   * das Feld (Parity).
   */
  async listPickupPointsVersioned(): Promise<
    Array<PickupPointDto & { updatedAt: string | null }>
  > {
    const rows = await PickupPoint.findAll({ order: [['id', 'ASC']] })
    return rows.map((r) => ({
      ...toPickupPointDto(r),
      updatedAt: iso(r.updatedAt),
    }))
  }

  async pickupPointVersion(id: string): Promise<string | null> {
    const row = await PickupPoint.findByPk(id, { attributes: ['updatedAt'] })
    return row ? iso(row.updatedAt) : null
  }
}

/** 409 `stale_pickup_point`, wenn `expectedUpdatedAt` nicht mehr passt. */
function pickupPointVersionGuard(
  body: unknown,
  updatedAt: Date | string | null | undefined
): Failure | null {
  const expected =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)['expectedUpdatedAt']
      : undefined
  if (expected === undefined || expected === null) return null
  const wanted =
    typeof expected === 'string' ? new Date(expected).getTime() : NaN
  if (!Number.isFinite(wanted)) {
    return failure<never>(
      400,
      'invalid_expected_updated_at',
      '„expectedUpdatedAt" muss ein Zeitstempel (ISO 8601) sein.'
    ) as Failure
  }
  const actual = updatedAt ? new Date(updatedAt).getTime() : NaN
  if (actual !== wanted) {
    return failure<never>(
      409,
      'stale_pickup_point',
      'Die Sammelstelle wurde inzwischen an anderer Stelle geändert. Bitte neu laden und die Änderung dann erneut speichern.',
      { updatedAt: iso(updatedAt) }
    ) as Failure
  }
  return null
}

/**
 * Optimistische Sperre (P1/P3): Schickt der Client `expectedUpdatedAt` - den
 * `updatedAt` der Fassung, die er geladen hat -, wird nur geschrieben, wenn
 * die Bestellung seither unverändert ist. Sonst 409 `stale_preorder`: ein
 * anderes Gerät hat sie inzwischen übergeben, storniert oder geändert, und
 * ein Speichern aus der alten Fassung würde das still überschreiben (z. B.
 * `paid` wieder auf `false`). Ohne das Feld keine Prüfung (Alias, Altclients).
 * Läuft als `guard` in der Schreib-Transaktion - kein Fenster zwischen
 * Prüfen und Schreiben.
 */
export function expectedVersionGuard(
  body: unknown
): (current: PreorderRecord) => Result<never> | null {
  const expected =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)['expectedUpdatedAt']
      : undefined
  return (current) => {
    if (expected === undefined || expected === null) return null
    const wanted =
      typeof expected === 'string' ? new Date(expected).getTime() : NaN
    if (!Number.isFinite(wanted)) {
      return failure<never>(
        400,
        'invalid_expected_updated_at',
        '„expectedUpdatedAt" muss ein Zeitstempel (ISO 8601) sein.'
      )
    }
    const actual = new Date(current.updatedAt as Date | string).getTime()
    if (actual !== wanted) {
      return failure<never>(
        409,
        'stale_preorder',
        'Diese Vorbestellung wurde inzwischen an anderer Stelle geändert. Bitte die aktuelle Fassung prüfen und dann erneut speichern.',
        { updatedAt: iso(current.updatedAt) }
      )
    }
    return null
  }
}

function notFound<T>(): Result<T> {
  return failure<T>(404, 'not_found', 'Diese Vorbestellung existiert nicht.')
}
