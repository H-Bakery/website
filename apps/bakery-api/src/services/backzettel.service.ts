/**
 * Backzettel days on the database (Z3, roadmap §5.3–5.4).
 *
 * No formula lives here: the day is computed by `backzettel.core.js`, the
 * translation between stored rows and the core by `backzettel-day.core.js`.
 * This file reads the inputs (preorders, CAP templates, stored corrections),
 * writes the outputs (confirmed lines, snapshot, deltas, ticks) inside the
 * serialised write transactions of `db/database.ts`, and audits every write.
 *
 *   draft      computed live; only season factor and corrections are stored
 *   confirmed  lines frozen in backzettel_lines, Hefeteig/fillings/prep/
 *              warnings frozen in computed_snapshot, preorder snapshot;
 *              every preorder write of that day records its changes as
 *              backzettel_deltas in the same transaction (W4,
 *              `recordPreorderDeltas`); reading never writes
 *   reopen     (inhaber) back to draft; deltas are folded into the live
 *              draft and discarded, the audit log keeps them. A re-confirm
 *              that changes a line's quantity clears its tick.
 *
 * Z10 (docs/backzettel-v2.md §5): a day is the sheet of a **dough day** D
 * (`computeDoughDay`): the lead-0 lines baked on D and the lines whose dough
 * is made on D for a later bake day (Saturday: Sunday's and Tuesday's
 * rolls). Rows are per (bake date × item × variant); the frozen plan in
 * `computed_snapshot.plan` says which pairs the sheet holds - a draft never
 * recomputes a pair another confirmed sheet holds (`ownedPairs`), deltas are
 * reconciled per frozen plan and recorded on the sheet that bakes the
 * pickup day. A day confirmed before Z10 has no plan: `legacyPlan(date)`,
 * `sheetVersion: 1`, its v1 layout. `getBakeList` collects one bake day
 * from all its sheets.
 */
import type { Request } from 'express'
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import {
  AuditLog,
  BackzettelDay,
  BackzettelDelta,
  BackzettelLine,
  Partner,
  PartnerDeliveryTemplate,
  Preorder,
  PreorderItem,
  User,
  getSequelize,
} from '../models'
import type {
  BackzettelPlan,
  PreorderSnapshotItem,
} from '../models/BackzettelDay'
import type {
  BackzettelSource,
  LoadedBackzettelConfig,
} from './backzettel-source'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./backzettel.core')
const dayCore = require('./backzettel-day.core')
const planCore = require('./backzettel-plan.core')
const kalender = require('./kalender.core')
const { WEEKDAY_NAMES } = require('./backzettel-config.core')
const shopOrders = require('./shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/** An expected failure: answered with `status`, `error`, German `message`. */
export class BackzettelError extends Error {
  readonly status: number
  readonly code: string
  readonly extra: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'BackzettelError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export interface UserRef {
  id: number
  displayName: string
}

type Loaded = LoadedBackzettelConfig

const DELTA_GONE_MESSAGE =
  'Dieser Nachtrag ist nicht mehr offen - der Backzettel wurde inzwischen neu freigegeben (oder wieder geöffnet) und rechnet ihn schon mit ein.'

/** Höchstens so viele Nachträge in einem „Gesehen“ (Sammel-Quittung). */
const MAX_ACK_IDS = 500

const CONFIRMED_MESSAGE =
  'Der Backzettel ist schon freigegeben. Änderungen nur nach „Wieder öffnen“ durch den Inhaber.'

function toNumber(x: unknown): number {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

/** Deutsche Zahl für Meldungen: 1.5 -> „1,5“, Vorzeichen mit „+“/„−“. */
function fmtSigned(n: number): string {
  const text = String(Math.abs(n)).replace('.', ',')
  return n > 0 ? `+${text}` : n < 0 ? `−${text}` : '0'
}

/**
 * W4-verify r4: the value the client showed when it started editing
 * (`expected` in the body). Absent = no check (older clients, scripts).
 * Present but malformed is a 400 - a client that sends it wants the check.
 */
function optionalExpectedNumber(
  raw: unknown,
  field: string
): number | undefined {
  if (raw === undefined || raw === null) return undefined
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new BackzettelError(
      400,
      'validation',
      `${field} muss eine Zahl sein.`
    )
  }
  return n
}

function sameQty(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

function assertDate(date: string): void {
  if (!core.isValidDate(date)) {
    throw new BackzettelError(
      400,
      'invalid_date',
      `Ungültiges Datum „${date}“; erwartet wird JJJJ-MM-TT.`
    )
  }
}

function requireConfig(loaded: Loaded): void {
  if (!loaded.ok) {
    throw new BackzettelError(
      409,
      'no_config',
      'Die Backzettel-Stammdaten fehlen oder sind ungültig; ohne sie wird nichts gerechnet.',
      { reasons: loaded.reasons }
    )
  }
}

/**
 * A sheet exists on a bake day or a dough day (U9: weekly plan + calendar).
 * Otherwise 409 `ruhetag` (weekly plan) or `geschlossen` (calendar, holiday)
 * with the reason.
 */
function assertProductionDay(loaded: Loaded, date: string): void {
  const reason = kalender.closedReason(loaded.config, date)
  if (reason) {
    const weekday = core.isoWeekday(date)
    throw new BackzettelError(
      409,
      reason.code,
      reason.message,
      reason.code === 'geschlossen'
        ? { weekday, note: reason.note }
        : { weekday }
    )
  }
}

/**
 * U9: the calendar hint of a sheet - missing or invalid `kalender.yaml`, or
 * a year the file does not list. `null` when the calendar applies.
 */
function calendarWarning(loaded: Loaded, date: string) {
  const state = loaded.calendar
  if (!state) return null
  if (state.status === 'invalid') {
    return {
      code: 'calendar_invalid',
      message: `Der Kalender (${
        state.source
      }) ist ungültig und wird nicht benutzt - Feiertage und Schließtage fehlen auf dem Zettel. ${state.errors
        .slice(0, 3)
        .map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`)
        .join(' ')}`,
    }
  }
  if (state.status === 'missing') {
    return {
      code: 'calendar_missing',
      message: `Kalender fehlt (${state.source}) - Feiertage und Schließtage werden nicht berücksichtigt, es gilt der Wochenplan.`,
    }
  }
  const year = date.slice(0, 4)
  if (kalender.dayKind(loaded.config, date).calendar === 'year-missing') {
    return {
      code: 'calendar_year_missing',
      message: `Kalender für ${year} fehlt (${state.source}) - Feiertage ${year} werden nicht berücksichtigt.`,
    }
  }
  return null
}

async function usersById(
  ids: unknown[],
  transaction?: Transaction
): Promise<Map<number, UserRef>> {
  const wanted = [
    ...new Set(ids.filter((id): id is number => Number.isInteger(id))),
  ]
  if (wanted.length === 0) return new Map()
  const rows = await User.findAll({
    where: { id: wanted },
    attributes: ['id', 'displayName'],
    transaction,
  })
  return new Map(
    rows.map((u) => [u.id, { id: u.id, displayName: u.displayName }])
  )
}

function userRef(map: Map<number, UserRef>, id: number | null | undefined) {
  if (id === null || id === undefined) return null
  return map.get(id) ?? { id, displayName: `#${id}` }
}

/**
 * Not cancelled preorder positions with pickup on one of `dates` (snapshot
 * form). Z10: every entry carries its `pickupDate` - a sheet collects the
 * bake days of its plan (Saturday: Sunday's and Tuesday's rolls).
 */
async function loadPreorderSnapshot(
  dates: string[],
  transaction?: Transaction
): Promise<PreorderSnapshotItem[]> {
  if (dates.length === 0) return []
  const preorders = await Preorder.findAll({
    where: { pickupDate: dates, status: { [Op.ne]: 'storniert' } },
    attributes: ['id', 'status', 'pickupDate'],
    include: [
      {
        model: PreorderItem,
        as: 'items',
        attributes: ['productId', 'variant', 'quantity'],
      },
    ],
    transaction,
  })
  return dayCore.snapshotFromPreorders(
    preorders.map((p) => p.get({ plain: true }))
  )
}

/**
 * Status of every preorder that is on one of `dates` now, cancelled ones
 * included - tells a cancelled order from a removed line or an order moved
 * to another day (`reconcileDeltas`, W4-verify r5).
 */
async function loadDayOrderStates(
  dates: string[],
  transaction?: Transaction
): Promise<Record<string, OrderState>> {
  if (dates.length === 0) return {}
  const rows = await Preorder.findAll({
    where: { pickupDate: dates },
    attributes: ['id', 'status', 'pickupDate'],
    transaction,
  })
  // Z10: with the pickup day, so a move between two bake days of one sheet
  // reads as „verschoben“, not „entfernt“ (`goneKind`).
  return Object.fromEntries(
    rows.map((p) => [
      String(p.id),
      { status: p.status, pickupDate: p.pickupDate },
    ])
  )
}

/** Status and pickup day of a preorder that lies on a sheet's bake days. */
type OrderState = { status: string; pickupDate: string }

/** Active delivery templates of active sales partners for an ISO weekday. */
async function loadCapTemplates(
  weekday: number,
  transaction?: Transaction
): Promise<{ weekday: number; active: boolean; items: unknown[] }[]> {
  const templates = await PartnerDeliveryTemplate.findAll({
    where: { weekday, active: true },
    include: [
      {
        model: Partner,
        as: 'partner',
        where: { active: true },
        attributes: [],
      },
    ],
    transaction,
  })
  return templates.map((t) => ({
    weekday: t.weekday,
    active: t.active,
    items: Array.isArray(t.items) ? t.items : [],
  }))
}

/** Z10: a frozen or live plan of a sheet (`backzettel-plan.core.js`). */
type Plan = BackzettelPlan

/** Everything a sheet (dough day) is computed from, read in one go. */
interface SheetInputs {
  /** `${bakeDate}|${itemId}` → date of the confirmed sheet that holds it (§5.4). */
  owned: Map<string, string>
  /** Items of this bake day no other sheet holds (`core.transitionFor`). */
  adopted: { itemId: string; doughDate: string }[]
  /** The sheet day plus every bake day it may collect. */
  dates: string[]
  snapshot: PreorderSnapshotItem[]
  templatesByDate: Record<string, unknown[]>
  rows: BackzettelLine[]
}

/** The key of a stored row - as the core keys the line (`lineKey`). */
function rowKey(
  row: { itemId: string; variant: string | null; bakeDate?: string | null },
  sheetDate: string
): string {
  return core.lineKey(
    row.itemId,
    dayCore.apiVariant(row.variant),
    row.bakeDate || sheetDate,
    sheetDate
  )
}

/** A confirmed sheet and its frozen plan (Z10, §5.4). */
interface ConfirmedPlan {
  date: string
  plan: Plan
}

/**
 * Confirmed sheets in [date − 14, date + 14] with their frozen plans (a day
 * confirmed before Z10 has `legacyPlan`): what ownership (§5.4) and the
 * transition check (`core.transitionFor`) look at.
 */
async function confirmedAround(
  date: string,
  transaction?: Transaction
): Promise<ConfirmedPlan[]> {
  const range = planCore.LOOKAHEAD_DAYS
  const days = await BackzettelDay.findAll({
    where: {
      status: 'confirmed',
      date: {
        [Op.between]: [
          planCore.addDays(date, -range),
          planCore.addDays(date, range),
        ],
      },
    },
    attributes: ['date', 'computedSnapshot'],
    order: [['date', 'ASC']],
    transaction,
  })
  return days.map((d) => ({
    date: d.date,
    plan: dayCore.planOfSnapshot(d.computedSnapshot, d.date) as Plan,
  }))
}

/**
 * The (bake date × item) pairs held by **other** confirmed sheets (§5.4): a
 * draft never recomputes them, so nothing is counted twice while hq switches
 * an item to `lead: 1` (an old Tuesday sheet keeps its rolls). A day
 * confirmed before Z10 holds every item of its own date (`legacyPlan`); a v2
 * sheet also the items added to hq after it was confirmed (`planCovers`).
 */
function ownedPairs(
  config: any,
  date: string,
  confirmed: ConfirmedPlan[]
): Map<string, string> {
  const out = new Map<string, string>()
  for (const d of confirmed) {
    if (d.date === date) continue
    for (const b of d.plan.bakeDates) {
      for (const item of config.items) {
        if (planCore.planCovers(config, d.plan, b.date, item)) {
          out.set(planCore.ownedKey(b.date, item.id), d.date)
        }
      }
    }
  }
  return out
}

async function loadSheetInputs(
  loaded: Loaded,
  date: string,
  transaction?: Transaction
): Promise<SheetInputs> {
  const bakeDates: string[] = planCore.bakeDatesFor(loaded.config, date)
  // U9: closed days up to the next dough day - their preorders are reported
  // on this sheet (`preorders_on_closed_day`), never silently dropped.
  const closedAfter: string[] = kalender.closedDaysAfter(loaded.config, date)
  const dates = [
    ...new Set([
      ...(bakeDates.includes(date) ? bakeDates : [date, ...bakeDates]),
      ...closedAfter,
    ]),
  ]
  const [confirmed, snapshot, rows, templates] = await Promise.all([
    confirmedAround(date, transaction),
    loadPreorderSnapshot(dates, transaction),
    BackzettelLine.findAll({ where: { date }, transaction }),
    Promise.all(
      dates.map((b) => loadCapTemplates(core.isoWeekday(b), transaction))
    ),
  ])
  // Items of this bake day that no sheet would hold otherwise (transition,
  // §5.4): the draft of their bake day takes them.
  const others = confirmed.filter((c) => c.date !== date)
  const transition = core.transitionFor(loaded.config, date, others)
  return {
    owned: ownedPairs(loaded.config, date, confirmed),
    adopted: transition.adopted,
    dates,
    snapshot,
    rows,
    templatesByDate: Object.fromEntries(dates.map((b, i) => [b, templates[i]])),
  }
}

/** The sheet of dough day `date` (`computeDoughDay`), live. */
function computeSheet(
  loaded: Loaded,
  date: string,
  inputs: SheetInputs,
  seasonFactor: number,
  rows: Array<BackzettelLine | Record<string, unknown>> = inputs.rows
) {
  const preorderItems = dayCore.toCorePreorderItems(inputs.snapshot, date)
  const result = core.computeDoughDay({
    config: loaded.config,
    date,
    seasonFactor,
    bakeInputs: Object.fromEntries(
      inputs.dates.map((b) => [
        b,
        { preorderItems, capTemplate: inputs.templatesByDate[b] ?? [] },
      ])
    ),
    corrections: dayCore.correctionsFromRows(
      rows.map((r) =>
        r instanceof BackzettelLine ? r.get({ plain: true }) : r
      )
    ),
    owned: [...inputs.owned.keys()],
    adopted: inputs.adopted,
    recipes: loaded.recipes,
    catalog: loaded.catalog,
  })
  if (result.error) {
    throw new BackzettelError(400, result.error, result.message)
  }
  return result
}

/** The positions of a snapshot that a plan covers (by pickup day). */
function snapshotForPlan(
  snapshot: PreorderSnapshotItem[],
  plan: Plan,
  date: string
): PreorderSnapshotItem[] {
  const dates: string[] = planCore.planBakeDates(plan)
  return snapshot.filter((s) => dates.includes(s.pickupDate || date))
}

/** The Z10 fields of a sheet (`computeDoughDay` or a v2 `computed_snapshot`). */
function sheetFields(
  source: Record<string, any>,
  isDoughDay: boolean | null
): Record<string, unknown> {
  return {
    sheetVersion: 2,
    isDoughDay,
    bakeDates: source['bakeDates'] ?? [],
    plan: source['plan'] ?? null,
    doughs: source['doughs'] ?? [],
    machine: source['machine'] ?? [],
    bread: source['bread'] ?? null,
    rolls: source['rolls'] ?? [],
    openMasterData: source['openMasterData'] ?? [],
  }
}

/**
 * Two `deltaTotals` entries of one item and bake day from different sheets,
 * added field by field (counts and quantities; `bake`/`bakeOpen` are the
 * oven figures of each sheet, so they add up as well).
 */
function sumDeltaTotals(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = Number(a[k] ?? 0)
    const y = Number(b[k] ?? 0)
    out[k] =
      Math.round(
        ((Number.isFinite(x) ? x : 0) + (Number.isFinite(y) ? y : 0)) * 100
      ) / 100
  }
  return out
}

/** German short date: `2026-11-28` → „Samstag, 28.11.“. */
function dayText(date: string): string {
  const [, m, d] = date.split('-')
  return `${WEEKDAY_NAMES[core.isoWeekday(date)]}, ${d}.${m}.`
}

/** `YYYY-MM-DD` shifted by `days` calendar days. */
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * W4 verification: planning writes (season, correction, confirm) only for a
 * plausible production window around today (Berlin). A typo in the URL
 * (`9999-12-31`, `1970-01-03`) otherwise confirmed a day and committed its
 * snapshot to hq `main`. Reads, reopen, ticks and acks are not limited -
 * they only touch days that already exist.
 */
export const PLANNING_DAYS_BACK = 7
export const PLANNING_DAYS_AHEAD = 90

function assertPlanningWindow(date: string, now: Date): void {
  const today: string = shopOrders.berlinToday(now)
  const earliest = shiftDay(today, -PLANNING_DAYS_BACK)
  const latest = shiftDay(today, PLANNING_DAYS_AHEAD)
  if (date < earliest || date > latest) {
    const de = (d: string) => d.split('-').reverse().join('.')
    throw new BackzettelError(
      400,
      'date_out_of_range',
      `Der ${de(date)} liegt außerhalb des Planungszeitraums (${de(
        earliest
      )} bis ${de(latest)}) - bitte das Datum prüfen.`
    )
  }
}

/** Berlin calendar day before today (`YYYY-MM-DD`). */
function berlinYesterday(now: Date): string {
  const today: string = shopOrders.berlinToday(now)
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export interface BackzettelHooks {
  /**
   * Z9: after a confirm committed, with the confirmed day view and the role
   * of whoever confirmed (never the name - D13). Must not throw; it is not
   * awaited, so a slow or offline hq never delays the confirm.
   */
  onConfirmed?: (day: unknown, context: { role: string | null }) => void
  /**
   * Z9: after a reopen committed (date, role of whoever reopened). Same
   * rules as `onConfirmed`: must not throw, not awaited.
   */
  onReopened?: (date: string, context: { role: string | null }) => void
  /** Clock for the planning window (tests pin it); default `new Date()`. */
  now?: () => Date
}

export function createBackzettelService(
  source: BackzettelSource,
  hooks: BackzettelHooks = {}
) {
  // ------------------------------------------------------------- views

  /**
   * Z10 O5 (Review): the oven figure of the Nachträge ticked „gebacken“, per
   * line - what the tablet showed as baked (`deltaBakeExtras` of the baked
   * quantity, like `bake - bakeUnbaked` in the confirmed view), never below
   * 0. Reopen discards the Nachträge and keeps this in its audit
   * (`bakedDeltas`), so the next confirm counts it as baked.
   */
  function bakedDeltaFigures(
    date: string,
    day: BackzettelDay,
    rows: BackzettelLine[],
    deltaRows: BackzettelDelta[],
    config: any
  ): Record<string, unknown>[] {
    const baked = deltaRows.filter((d) => d.bakedAt)
    if (baked.length === 0) return []
    const snap = day.computedSnapshot
    const lines = dayCore
      .frozenSections(
        rows.map((r) => r.get({ plain: true })),
        config,
        snap?.unsetKeys
      )
      .flatMap((s: any) => s.lines.map(({ line }: any) => line))
    const later = (a: BackzettelDelta, b: BackzettelDelta) =>
      new Date(b.bakedAt as Date).getTime() >
      new Date(a.bakedAt as Date).getTime()
        ? b
        : a
    const byKey = new Map<string, { qty: number; last: BackzettelDelta }>()
    for (const d of baked) {
      const key = rowKey(d, date)
      const e = byKey.get(key)
      byKey.set(key, {
        qty: Math.round(((e?.qty ?? 0) + toNumber(d.qty)) * 100) / 100,
        last: e ? later(e.last, d) : d,
      })
    }
    const figures = dayCore.deltaBakeExtras(
      dayCore.linesForDeltas(
        lines,
        baked.map((d) => ({
          key: rowKey(d, date),
          itemId: d.itemId,
          variant: dayCore.apiVariant(d.variant),
          bakeDate: d.bakeDate || date,
        })),
        config,
        date
      ),
      Object.fromEntries([...byKey].map(([k, e]) => [k, { qty: e.qty }])),
      snap?.preordersExact ?? null,
      snap?.subtotalExact ?? null
    )
    const out: Record<string, unknown>[] = []
    for (const [key, { last }] of byKey) {
      const qty = Math.max(0, toNumber(figures[key] ?? 0))
      if (qty <= 0) continue
      out.push({
        itemId: last.itemId,
        variant: last.variant,
        ...(last.bakeDate && last.bakeDate !== date
          ? { bakeDate: last.bakeDate }
          : {}),
        qty,
        bakedBy: last.bakedBy,
        bakedAt: new Date(last.bakedAt as Date).toISOString(),
      })
    }
    return out
  }

  type BakedFromReopen = { qty: number; at: string | null; by: number | null }

  /**
   * The baked Nachträge the reopen that made `date` a draft discarded
   * (`bakedDeltas` in its audit), per line key. A draft day's latest reopen
   * is always the one that made it a draft.
   */
  async function bakedDeltasFromReopen(
    date: string,
    transaction?: Transaction
  ): Promise<Map<string, BakedFromReopen>> {
    const out = new Map<string, BakedFromReopen>()
    const last = await AuditLog.findOne({
      where: { action: 'reopen', entity: 'backzettel_day', entityId: date },
      order: [['id', 'DESC']],
      attributes: ['data'],
      ...(transaction ? { transaction } : {}),
    })
    const list = (last?.data as Record<string, unknown> | null)?.['bakedDeltas']
    for (const t of Array.isArray(list) ? list : []) {
      const e = t as Record<string, unknown>
      if (typeof e['itemId'] !== 'string') continue
      const qty = toNumber(e['qty'] as number)
      if (!(qty > 0)) continue
      out.set(
        rowKey(
          {
            itemId: e['itemId'],
            variant: e['variant'] as string | null,
            bakeDate: typeof e['bakeDate'] === 'string' ? e['bakeDate'] : null,
          },
          date
        ),
        {
          qty,
          at: typeof e['bakedAt'] === 'string' ? e['bakedAt'] : null,
          by: typeof e['bakedBy'] === 'number' ? e['bakedBy'] : null,
        }
      )
    }
    return out
  }

  /**
   * The draft sheet of dough day `date`: computed live (`computeDoughDay`),
   * stored rows only for corrections and ticks. Lines carry `bakeDate`; a
   * row is found by (bake date, item, variant) - the line key.
   */
  async function draftView(
    date: string,
    day: BackzettelDay | null,
    loaded: Loaded
  ) {
    const weekday = core.isoWeekday(date)
    const inputs = await loadSheetInputs(loaded, date)
    const rows = inputs.rows
    const seasonFactor = day ? toNumber(day.seasonFactor) || 1 : 1
    const result = computeSheet(loaded, date, inputs, seasonFactor)
    const rowsByKey = new Map(rows.map((r) => [rowKey(r, date), r]))
    // Z10 O5 (Review): what the reopen discarded as baked Nachträge counts
    // as baked, as the next confirm will count it.
    const fromReopen = day
      ? await bakedDeltasFromReopen(date)
      : new Map<string, BakedFromReopen>()
    const users = await usersById([
      ...rows.flatMap((r) => [r.correctionBy, r.doneBy, r.bakedBy]),
      ...[...fromReopen.values()].map((e) => e.by),
    ])
    const lineView = (line: any) => {
      const row = rowsByKey.get(line.key)
      const extra = fromReopen.get(line.key)
      // After a reopen a tick only shows while the line still asks for the
      // quantity it was ticked for; confirm clears it otherwise. Same for
      // the bake-list tick (O5), with the baked Nachträge counted in.
      const ticks =
        row || extra
          ? dayCore.ticksAfterConfirm(row ?? null, line, extra?.qty)
          : { done: null, baked: null }
      const ticked = ticks.done === true
      const baked = ticks.baked === true
      const lineBaked = !!row && row.bakedAt !== null
      const bakedAt: Date | string | null = lineBaked
        ? (row.bakedAt as Date)
        : extra
        ? extra.at
        : null
      const bakedBy: number | null = lineBaked
        ? (row.bakedBy as number | null)
        : extra
        ? extra.by
        : null
      return {
        id: row ? row.id : null,
        ...line,
        // „Heute keine“ zählt nur, solange es gilt (Grundmenge noch offen) -
        // ein überholtes Kennzeichen ist keine Korrektur
        correctionBy:
          row && (toNumber(row.correction) !== 0 || line.noneToday === true)
            ? userRef(users, row.correctionBy)
            : null,
        doneAt: ticked && row ? (row.doneAt as Date | null) : null,
        doneBy: ticked && row ? userRef(users, row.doneBy) : null,
        bakedAt: baked ? bakedAt : null,
        bakedBy: baked ? userRef(users, bakedBy) : null,
        previouslyBaked:
          ticks.baked === false
            ? {
                qty: dayCore.bakedAfterConfirm(row ?? null, line, extra?.qty)
                  .qty,
                at: bakedAt,
                by: userRef(users, bakedBy),
              }
            : null,
        delta: null,
      }
    }
    return {
      date,
      weekday,
      weekdayName: result.weekdayName,
      status: 'draft' as const,
      seasonFactor: result.seasonFactor,
      confirmedBy: null,
      confirmedAt: null,
      sections: result.sections.map((s: any) => ({
        ...s,
        lines: s.lines.map(lineView),
      })),
      hefeteig: result.hefeteig,
      fillings: result.fillings,
      prep: result.prep,
      ...dayCore.prepDateFor(date, loaded.config),
      deltas: [],
      warnings: result.warnings,
      configStatus: 'ok' as const,
      dayKind: result.dayKind,
      calendarHint: calendarWarning(loaded, date),
      ...sheetFields(result, result.isDoughDay),
      // Posten ohne jede Menge (Grundmenge 0): nicht auf dem Zettel, aber
      // per Korrektur aufnehmbar („Weiteren Posten aufnehmen“).
      addable: (result.addable ?? []).map((s: any) => ({
        ...s,
        lines: s.lines.map(lineView),
      })),
    }
  }

  /**
   * The confirmed day. `light` (evaluations such as Rest am Abend, which
   * read many days at once) keeps the lines, the deltas and their oven
   * figures (`delta.bake` / `bakeOpen`, `deltaTotals`) exactly as the full
   * view has them, and skips what only the screens need: the confirm audits
   * (`previouslyDone`), user names, preorder codes and the recompute of
   * Hefeteig/Füllungen (`configChangedSinceConfirm`, `deltaExtras` are
   * `null`).
   */
  async function confirmedView(
    date: string,
    day: BackzettelDay,
    loaded: Loaded,
    { light = false }: { light?: boolean } = {}
  ) {
    const weekday = core.isoWeekday(date)
    const config = loaded.ok ? loaded.config : null
    const snap = day.computedSnapshot
    // Z10: a snapshot with a plan is a dough-day sheet (v2); without, a day
    // confirmed before Z10 - its v1 layout stays (`sheetVersion: 1`).
    const v2 = dayCore.isSheetSnapshot(snap)
    const [rows, deltaRows, confirmAudits] = await Promise.all([
      BackzettelLine.findAll({ where: { date }, order: [['id', 'ASC']] }),
      BackzettelDelta.findAll({ where: { date }, order: [['id', 'ASC']] }),
      light
        ? Promise.resolve([] as AuditLog[])
        : AuditLog.findAll({
            where: {
              action: 'confirm',
              entity: 'backzettel_day',
              entityId: date,
            },
            order: [['id', 'ASC']],
            attributes: ['data'],
          }),
    ])
    // W4 verification round 2: a re-confirm that changed a line dropped its
    // tick (`clearedTicks` in the audit). Without a trace the Backstube saw
    // "78, open" after baking 70 - so the latest cleared tick per line comes
    // back as `previouslyDone` while the line is still unticked.
    // Z10 O5: the same for the bake-list tick (`clearedBakedTicks`,
    // `previouslyBaked`).
    type ClearedTick = { qty: number; by: number | null; at: string | null }
    const clearedFrom = (field: 'clearedTicks' | 'clearedBakedTicks') => {
      const out = new Map<string, ClearedTick>()
      const [byField, atField] =
        field === 'clearedTicks' ? ['doneBy', 'doneAt'] : ['bakedBy', 'bakedAt']
      for (const a of confirmAudits) {
        const list = (a.data as Record<string, unknown> | null)?.[field]
        for (const t of Array.isArray(list) ? list : []) {
          const tick = t as Record<string, unknown>
          if (typeof tick['itemId'] !== 'string') continue
          out.set(
            rowKey(
              {
                itemId: tick['itemId'],
                variant: tick['variant'] as string | null,
                bakeDate:
                  typeof tick['bakeDate'] === 'string'
                    ? tick['bakeDate']
                    : null,
              },
              date
            ),
            {
              qty: toNumber(tick['from'] as number),
              by: typeof tick[byField] === 'number' ? tick[byField] : null,
              at: typeof tick[atField] === 'string' ? tick[atField] : null,
            } as ClearedTick
          )
        }
      }
      return out
    }
    const cleared = clearedFrom('clearedTicks')
    const clearedBaked = clearedFrom('clearedBakedTicks')
    const previously = (
      map: Map<string, ClearedTick>,
      key: string,
      at: Date | null
    ) => {
      const c = at === null ? map.get(key) : undefined
      return c ? { qty: c.qty, at: c.at, by: userRef(users, c.by) } : null
    }
    const users = light
      ? new Map<number, UserRef>()
      : await usersById([
          day.confirmedBy,
          ...rows.flatMap((r) => [r.correctionBy, r.doneBy, r.bakedBy]),
          ...deltaRows.flatMap((d) => [d.acknowledgedBy, d.bakedBy]),
          ...[...cleared.values(), ...clearedBaked.values()].map((c) => c.by),
        ])
    const preorderIds = [
      ...new Set(
        deltaRows
          .map((d) => d.preorderId)
          .filter((id): id is number => Number.isInteger(id))
      ),
    ]
    const codes = new Map(
      preorderIds.length && !light
        ? (
            await Preorder.findAll({
              where: { id: preorderIds },
              attributes: ['id', 'code', 'pickupDate'],
            })
          ).map((p) => [p.id, { code: p.code, pickupDate: p.pickupDate }])
        : []
    )

    const itemsById = new Map<string, any>(
      (config ? config.items : []).map((i: any) => [i.id, i])
    )
    const deltas = deltaRows.map((d) => {
      const item = itemsById.get(d.itemId)
      const bakeDate = d.bakeDate || date
      return {
        id: d.id,
        key: rowKey(d, date),
        bakeDate,
        itemId: d.itemId,
        name: item ? item.name : d.itemId,
        unit: item ? item.unit : null,
        variant: dayCore.apiVariant(d.variant),
        qty: toNumber(d.qty),
        kind: d.kind,
        preorderId: d.preorderId,
        preorderCode:
          d.preorderId === null ? null : codes.get(d.preorderId)?.code ?? null,
        // Codes are not kept per day: an order moved on carries its new
        // code. Say so, instead of a Tuesday code on Sunday's sheet as if
        // it were still here (W4-verify r5).
        preorderMovedTo: (() => {
          const now =
            d.preorderId === null ? null : codes.get(d.preorderId) ?? null
          return now && now.pickupDate !== bakeDate ? now.pickupDate : null
        })(),
        createdAt: d.createdAt,
        acknowledgedAt: d.acknowledgedAt,
        acknowledgedBy: userRef(users, d.acknowledgedBy),
        // Z10 O5: a Nachtrag is ticked „gebacken“ on its own.
        bakedAt: d.bakedAt,
        bakedBy: userRef(users, d.bakedBy),
      }
    })
    const deltaByKey = new Map<
      string,
      {
        qty: number
        open: number
        count: number
        bake?: number
        /** Summe der noch nicht quittierten Nachträge. */
        openQty: number
        /** Was die noch nicht quittierten zusätzlich zu backen heißen. */
        bakeOpen?: number
        /** Z10 O5: so viele Nachträge sind als gebacken abgehakt. */
        baked: number
        /** Summe der gebacken abgehakten Nachträge. */
        bakedQty: number
        /** Was die noch nicht gebackenen zusätzlich zu backen heißen. */
        bakeUnbaked?: number
      }
    >()
    for (const d of deltas) {
      const e = deltaByKey.get(d.key) || {
        qty: 0,
        open: 0,
        count: 0,
        openQty: 0,
        baked: 0,
        bakedQty: 0,
      }
      e.qty = Math.round((e.qty + d.qty) * 100) / 100
      e.count += 1
      if (!d.acknowledgedAt) {
        e.open += 1
        e.openQty = Math.round((e.openQty + d.qty) * 100) / 100
      }
      if (d.bakedAt) {
        e.baked += 1
        e.bakedQty = Math.round((e.bakedQty + d.qty) * 100) / 100
      }
      deltaByKey.set(d.key, e)
    }

    const sections = dayCore.frozenSections(
      rows.map((r) => r.get({ plain: true })),
      config,
      day.computedSnapshot?.unsetKeys
    )
    const lines: any[] = []
    const viewSections = sections.map((s: any) => ({
      id: s.id,
      label: s.label,
      lines: s.lines.map(({ row, line }: any) => {
        // A day confirmed before Z10 was made on its own date.
        if (!v2 && line.bakeDate) line.lead = 0
        lines.push(line)
        return {
          id: row.id,
          ...line,
          preordersExact: line.preorders,
          preorderIds: [],
          correctionBy:
            toNumber(row.correction) !== 0 || line.noneToday === true
              ? userRef(users, row.correctionBy)
              : null,
          doneAt: row.doneAt,
          doneBy: userRef(users, row.doneBy),
          previouslyDone: previously(cleared, line.key, row.doneAt),
          bakedAt: row.bakedAt,
          bakedBy: userRef(users, row.bakedBy),
          previouslyBaked: previously(clearedBaked, line.key, row.bakedAt),
          delta: deltaByKey.get(line.key) ?? null,
        }
      }),
    }))

    // Frozen at confirm; the current master data only says whether it would
    // now compute something else (`configChangedSinceConfirm`). Days
    // confirmed before the snapshot column existed fall back to recomputing.
    // Z10: a v2 sheet computes all its parts like `computeDoughDay`
    // (`sheetParts`: Hefeteig with litres, fillings, doughs, machine strip,
    // bread, rolls, open master data) and checks its plan (`planDrift`: pairs
    // moved away and pairs newly on this dough day); an
    // old day computes Hefeteig and fillings like v1 `computeDay`.
    const partsOf = (cfg: any, list: any[], w: unknown[]) =>
      v2
        ? core.sheetParts(cfg, list, date, loaded.recipes || {}, w)
        : {
            hefeteig: core.computeHefeteig(cfg, list),
            fillings: core.computeFillings(cfg, list, loaded.recipes || {}, w),
          }
    const hefeteigAndFillings = (cfg: any, list: any[], w: unknown[]) => {
      const parts = partsOf(cfg, list, w)
      return { hefeteig: parts.hefeteig, fillings: parts.fillings }
    }
    // Pairs other confirmed sheets hold stay there on a recompute (§5.4):
    // only what the master data newly put on this sheet counts (`planDrift`).
    const ownedByOthers =
      v2 && config && !light
        ? ownedPairs(config, date, await confirmedAround(date))
        : null
    const recomputed =
      config && !light
        ? (() => {
            const w: unknown[] = []
            return {
              ...partsOf(config, lines, w),
              prep: core.computePrep(config, lines, weekday),
              warnings: w,
              ...(v2
                ? {
                    planDrift: dayCore.planDrift(
                      config,
                      snap.plan,
                      snap.warnings,
                      ownedByOthers
                    ),
                  }
                : {}),
            }
          })()
        : null
    const frozen = snap ?? recomputed
    const hefeteig = frozen ? frozen.hefeteig : null
    const fillings = frozen ? frozen.fillings : null
    let prep = frozen ? frozen.prep : null
    const warnings =
      frozen && Array.isArray(frozen.warnings) ? frozen.warnings : []
    const configChangedSinceConfirm =
      snap && recomputed ? dayCore.snapshotDiffers(snap, recomputed) : null

    // W4 verification: what the Nachträge mean for the oven, the dough and
    // the fillings. `delta.bake` per line (after rounding), `deltaExtras`
    // the change in Hefeteig/Füllungen - the frozen figures stay as they are.
    let deltaExtras: unknown = null
    let deltaMachine: unknown[] = []
    let deltaBruch: unknown[] = []
    if (deltaByKey.size > 0) {
      // W4-verify r6: a Nachtrag for an item/variant not baked at confirm
      // time has no frozen line - give it an empty one, so it gets an oven
      // figure and reaches Hefeteig and Füllungen.
      const deltaLines = dayCore.linesForDeltas(lines, deltas, config, date)
      const extras = dayCore.deltaBakeExtras(
        deltaLines,
        Object.fromEntries(deltaByKey),
        snap?.preordersExact ?? null,
        snap?.subtotalExact ?? null
      )
      for (const [key, entry] of deltaByKey) entry.bake = extras[key] ?? 0
      // W4-verify r6: the tray hint follows what is now to bake - 24 + 4
      // croissants do not fit on „2 Bleche à 12“.
      for (const section of viewSections) {
        for (const l of section.lines) {
          const extra = extras[l.key]
          const item = extra ? itemsById.get(l.itemId) : null
          if (!item || !l.tray) continue
          const after = core.trayText(
            item.tray,
            Math.max(0, l.total + extra),
            l.unit
          )
          if (after && after !== l.tray) {
            l.tray = `${l.tray} · mit Nachträgen: ${after}`
          }
        }
      }
      // W4-verify r5: the Backstube panel lists only the open Nachträge and
      // needs *their* oven figure, not the raw quarter sum (+6,5 Kranz is 7
      // to bake). Open = all − already acknowledged, both after rounding.
      const ackedByKey = Object.fromEntries(
        [...deltaByKey].map(([key, e]) => [
          key,
          { qty: Math.round((e.qty - e.openQty) * 100) / 100 },
        ])
      )
      const ackedExtras = dayCore.deltaBakeExtras(
        deltaLines,
        ackedByKey,
        snap?.preordersExact ?? null,
        snap?.subtotalExact ?? null
      )
      for (const [key, entry] of deltaByKey) {
        entry.bakeOpen =
          Math.round(((entry.bake ?? 0) - (ackedExtras[key] ?? 0)) * 100) / 100
      }
      // Z10 O5: the same for the Nachträge not yet ticked „gebacken“ - the
      // figure next to the bake list's Nachtrag tick.
      const bakedExtras = dayCore.deltaBakeExtras(
        deltaLines,
        Object.fromEntries(
          [...deltaByKey].map(([key, e]) => [key, { qty: e.bakedQty }])
        ),
        snap?.preordersExact ?? null,
        snap?.subtotalExact ?? null
      )
      for (const [key, entry] of deltaByKey) {
        entry.bakeUnbaked =
          Math.round(((entry.bake ?? 0) - (bakedExtras[key] ?? 0)) * 100) / 100
      }
      if (config && recomputed) {
        const adjusted = dayCore.linesWithExtras(deltaLines, extras)
        // W4-verify r6: a Nachtrag that brings an item onto the day brings
        // its prep task (Brühstück for Vollkorn) - added, marked, never
        // removed from the frozen list.
        if (Array.isArray(prep)) {
          prep = dayCore.prepWithDeltas(
            prep,
            core.computePrep(config, adjusted, weekday)
          )
        }
        deltaExtras = dayCore.hefeteigFillingsDiff(
          recomputed,
          hefeteigAndFillings(config, adjusted, [])
        )
        // Z10: what the Nachträge mean at the machine (kg, litres, batches
        // per dough box) - the frozen machine strip stays as confirmed.
        if (v2) {
          deltaMachine = dayCore.machineDeltaExtras(
            config,
            deltaLines,
            extras,
            date
          )
          // Review Z10 r1: what they mean per Bruch group - „+1 Bruch“ or
          // „passt in die freien Stücke“.
          deltaBruch = dayCore.bruchDeltaExtras(
            config,
            deltaLines,
            extras,
            date
          )
        }
      }
    }

    return {
      date,
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday],
      status: 'confirmed' as const,
      seasonFactor: toNumber(day.seasonFactor) || 1,
      confirmedBy: userRef(users, day.confirmedBy),
      confirmedAt: day.confirmedAt,
      sections: viewSections,
      hefeteig,
      fillings,
      prep,
      ...dayCore.prepDateFor(date, config),
      deltas,
      deltaExtras,
      // Z10: per machine box, only boxes that change (v2 sheets).
      deltaMachine,
      // Z10: per Bruch group, only groups whose dough pieces change.
      deltaBruch,
      // W4-verify r6: per key incl. items without a frozen line.
      deltaTotals: Object.fromEntries(deltaByKey),
      warnings,
      configStatus: loaded.ok ? ('ok' as const) : ('no-config' as const),
      // U9: the day type from the current calendar (not frozen)
      dayKind: config ? kalender.dayKind(config, date) : null,
      calendarHint: loaded.ok ? calendarWarning(loaded, date) : null,
      configChangedSinceConfirm,
      ...(loaded.ok ? {} : { configReasons: loaded.reasons }),
      ...(v2 && snap
        ? sheetFields(snap, config ? planCore.isDoughDay(config, date) : null)
        : { sheetVersion: 1, plan: planCore.legacyPlan(date) }),
    }
  }

  /**
   * Delta rows that are not recorded yet (pure; `dayCore.reconcileDeltas`),
   * per bake day of the sheet's frozen `plan` (Z10; `legacyPlan` for a day
   * confirmed before Z10, so its old preorders still count).
   */
  function unrecordedDeltas(
    loaded: Loaded,
    date: string,
    plan: Plan,
    current: PreorderSnapshotItem[],
    recorded: BackzettelDelta[],
    snapshot: unknown,
    orders?: Record<string, OrderState>
  ) {
    return dayCore.reconcileDeltas({
      config: loaded.config,
      date,
      plan,
      snapshot,
      current,
      orders,
      recorded: recorded.map((r) => ({
        itemId: r.itemId,
        variant: r.variant,
        preorderId: r.preorderId,
        qty: toNumber(r.qty),
        bakeDate: r.bakeDate || date,
      })),
      catalog: loaded.catalog,
    })
  }

  /** Does a confirmed sheet's preorder state differ from its deltas? */
  async function pendingFor(loaded: Loaded, day: BackzettelDay) {
    const plan: Plan = dayCore.planOfSnapshot(day.computedSnapshot, day.date)
    return (
      unrecordedDeltas(
        loaded,
        day.date,
        plan,
        await loadPreorderSnapshot(planCore.planBakeDates(plan)),
        await BackzettelDelta.findAll({ where: { date: day.date } }),
        day.preorderSnapshot || []
      ).length > 0
    )
  }

  /**
   * Confirmed sheets whose frozen plan bakes on one of `bakeDates` (a sheet
   * is at most `LOOKAHEAD_DAYS` before its bake days), ascending.
   */
  async function confirmedSheetsFor(
    bakeDates: string[],
    transaction?: Transaction
  ): Promise<BackzettelDay[]> {
    const valid = [...new Set(bakeDates.filter((d) => core.isValidDate(d)))]
    if (valid.length === 0) return []
    valid.sort()
    const days = await BackzettelDay.findAll({
      where: {
        status: 'confirmed',
        date: {
          [Op.between]: [
            planCore.addDays(valid[0], -planCore.LOOKAHEAD_DAYS),
            valid[valid.length - 1],
          ],
        },
      },
      order: [['date', 'ASC']],
      transaction,
    })
    return days.filter((d) => valid.some((b) => feedsBakeDate(d, b)))
  }

  /** Does confirmed sheet `day` bake on `bakeDate` (its frozen plan)? */
  function feedsBakeDate(day: BackzettelDay, bakeDate: string): boolean {
    if (
      day.date > bakeDate ||
      day.date < planCore.addDays(bakeDate, -planCore.LOOKAHEAD_DAYS)
    ) {
      return false
    }
    const dates: string[] = planCore.planBakeDates(
      dayCore.planOfSnapshot(day.computedSnapshot, day.date)
    )
    return dates.includes(bakeDate)
  }

  /** Days whose deltas could not be recorded (no master data) - logged once. */
  const warnedPending = new Set<string>()

  /**
   * Records the preorder changes of a confirmed day as delta rows, inside the
   * caller's write transaction (W4). Since the write transactions are
   * serialised, two writes cannot record the same change twice, and the
   * comparison is a full diff (snapshot + recorded rows vs. the preorders
   * now), so a run after a missed one catches up everything.
   *
   * Returns the number of new rows, or `null` when the day is confirmed but
   * the master data cannot be loaded (nothing recorded; the next write of
   * that day, a confirm/reopen or a server start reconciles it).
   */
  async function recordDeltasIn(
    date: string,
    transaction: Transaction,
    req: Request | null,
    via: string,
    system: boolean
  ): Promise<number | null> {
    const day = await BackzettelDay.findByPk(date, { transaction })
    if (!day || day.status !== 'confirmed') return 0
    const loaded = source.load()
    if (!loaded.ok) {
      if (!warnedPending.has(date)) {
        warnedPending.add(date)
        console.warn(
          `[backzettel] ${date}: Änderungen an Vorbestellungen nicht als Delta erfasst - Stammdaten fehlen (${loaded.reasons
            .map((r: unknown) =>
              typeof r === 'string'
                ? r
                : (r as { message?: string } | null)?.message ?? String(r)
            )
            .join(
              '; '
            )}). Nachgeholt beim nächsten Lesen mit Stammdaten, Schreiben, Freigeben/Öffnen oder Neustart.`
        )
      }
      return null
    }
    warnedPending.delete(date)
    const plan: Plan = dayCore.planOfSnapshot(day.computedSnapshot, date)
    const dates: string[] = planCore.planBakeDates(plan)
    const rows = unrecordedDeltas(
      loaded,
      date,
      plan,
      await loadPreorderSnapshot(dates, transaction),
      await BackzettelDelta.findAll({ where: { date }, transaction }),
      day.preorderSnapshot || [],
      await loadDayOrderStates(dates, transaction)
    )
    if (rows.length === 0) return 0
    const created = await BackzettelDelta.bulkCreate(
      rows.map((r: any) => ({ date, ...r, bakeDate: r.bakeDate || date })),
      { transaction }
    )
    // A preorder write is attributed to its writer; the reconciliation sweep
    // is a system action (user null). createdAt = recorded at.
    await audit(
      req,
      'deltas_recorded',
      'backzettel_day',
      date,
      {
        via,
        deltas: rows,
        ids: created.map((d) => d.id),
      },
      system ? { transaction, userId: null } : { transaction }
    )
    return rows.length
  }

  /**
   * Preorder write hook (`PreordersService.onWrite`, app.ts): records the
   * deltas of every confirmed sheet that bakes on a touched pickup day, in
   * the preorder's transaction. Z10: that is the sheet of the dough day, not
   * only the pickup day itself - a Tuesday-roll preorder after Saturday's
   * confirm is a delta on Saturday (bake date Tuesday).
   */
  async function recordPreorderDeltas(
    dates: string[],
    context: { transaction: Transaction; req: Request | null; via: string }
  ): Promise<void> {
    const sheets = await confirmedSheetsFor(dates, context.transaction)
    for (const sheet of sheets) {
      await recordDeltasIn(
        sheet.date,
        context.transaction,
        context.req,
        `preorder_${context.via}`,
        false
      )
    }
  }

  /**
   * One-shot reconciliation (W4): every confirmed day from `from` on gets
   * its missed deltas recorded, each day in its own serialised transaction.
   * Catches preorders written while the master data could not be loaded, or
   * written by a path without the hook (CLI import). Called at server start
   * and after every confirm/reopen; never by a GET.
   */
  async function reconcileConfirmedDays(
    options: { from?: string; req?: Request | null } = {}
  ): Promise<{ date: string; recorded: number | null }[]> {
    const from = options.from ?? berlinYesterday(new Date())
    // Z10: a sheet before `from` still counts while it bakes on or after it
    // (Saturday's sheet holds Tuesday's rolls).
    const candidates = await BackzettelDay.findAll({
      where: {
        status: 'confirmed',
        date: { [Op.gte]: planCore.addDays(from, -planCore.LOOKAHEAD_DAYS) },
      },
      attributes: ['date', 'computedSnapshot'],
      order: [['date', 'ASC']],
    })
    const days = candidates.filter((d) =>
      (
        planCore.planBakeDates(
          dayCore.planOfSnapshot(d.computedSnapshot, d.date)
        ) as string[]
      ).some((b) => b >= from)
    )
    const out: { date: string; recorded: number | null }[] = []
    for (const d of days) {
      const recorded = await getSequelize().transaction((transaction) =>
        recordDeltasIn(
          d.date,
          transaction,
          options.req ?? null,
          'reconcile',
          true
        )
      )
      out.push({ date: d.date, recorded })
    }
    return out
  }

  /** After confirm/reopen: the sweep must never fail the request. */
  async function reconcileQuietly(req: Request): Promise<void> {
    try {
      await reconcileConfirmedDays({ req })
    } catch (error) {
      console.error('[backzettel] Delta-Abgleich fehlgeschlagen:', error)
    }
  }

  /** Background catch-ups started by a read, per date (W4 fixup). */
  const catchUps = new Map<string, Promise<void>>()

  /**
   * A read found unrecorded deltas while the master data load again (the
   * preorder was written while they did not, or by the CLI import): record
   * them in the background, in their own serialised transaction - the GET
   * itself stays free of writes, and the tablet's next reload (60 s, or the
   * short follow-up the screens do while `deltasPending`) shows them. One
   * run per date at a time.
   */
  function scheduleCatchUp(date: string): void {
    if (catchUps.has(date)) return
    const run = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() =>
        getSequelize().transaction((transaction) =>
          recordDeltasIn(date, transaction, null, 'reconcile', true)
        )
      )
      .then(
        () => undefined,
        (error) => {
          console.error(
            `[backzettel] ${date}: Delta-Nachtrag fehlgeschlagen:`,
            error
          )
        }
      )
      .finally(() => catchUps.delete(date))
    catchUps.set(date, run)
  }

  /** Tests: wait for every background catch-up started so far. */
  async function idle(): Promise<void> {
    while (catchUps.size > 0) await Promise.all([...catchUps.values()])
  }

  // ------------------------------------------------------------- reads

  /**
   * Free of writes in the request (W4): reading never records deltas itself.
   * `deltasPending` says whether preorder changes exist that are not
   * recorded yet (only after a write without loadable master data, or an
   * import) - `null` without master data. When it is `true`, a background
   * catch-up is started (`scheduleCatchUp`), so nothing stays unrecorded
   * until the next preorder write or a restart.
   */
  async function getDay(date: string) {
    assertDate(date)
    const loaded = source.load()
    const day = await BackzettelDay.findByPk(date)
    if (day && day.status === 'confirmed') {
      const view = await confirmedView(date, day, loaded)
      const deltasPending = loaded.ok ? await pendingFor(loaded, day) : null
      if (deltasPending === true) scheduleCatchUp(date)
      // Transition (§5.4): items of this sheet's days that no sheet holds,
      // or that moved to their bake day's draft - said on the sheet itself.
      const transition = loaded.ok
        ? core.transitionFor(loaded.config, date, await confirmedAround(date))
            .warnings
        : []
      return {
        ...view,
        warnings: [...view.warnings, ...transition],
        deltasPending,
      }
    }
    if (!loaded.ok) {
      return {
        date,
        status: 'no-config' as const,
        reasons: loaded.reasons,
        warnings: loaded.warnings,
      }
    }
    assertProductionDay(loaded, date)
    return draftView(date, day, loaded)
  }

  /**
   * The confirmed day for evaluations over many days (Rest am Abend):
   * `confirmedView` in `light` mode, `null` unless the day is confirmed. No
   * `deltasPending` check and no background catch-up - an unrecorded delta
   * is never acknowledged, so it cannot change „gebacken“.
   */
  async function getConfirmedLines(date: string) {
    assertDate(date)
    const day = await BackzettelDay.findByPk(date)
    if (!day || day.status !== 'confirmed') return null
    return confirmedView(date, day, source.load(), { light: true })
  }

  /**
   * Z10: the sheets that feed bake day `date` (§5.3): every confirmed sheet
   * whose frozen plan bakes on it (lines from the stored rows), plus the
   * dough days of the current master data that are still drafts (computed
   * live, without the pairs a confirmed sheet holds). Each with its lines
   * for this bake day and its Nachträge.
   */
  async function bakeSources(
    loaded: Loaded,
    date: string,
    {
      light = false,
      pool,
    }: {
      light?: boolean
      /** Confirmed sheets loaded once for many bake days (`getBakeLinesRange`). */
      pool?: BackzettelDay[]
    } = {}
  ) {
    const config = loaded.config
    const confirmed = pool
      ? pool.filter((d) => feedsBakeDate(d, date))
      : await confirmedSheetsFor([date])
    const confirmedDates = new Set(confirmed.map((d) => d.date))
    const warnings: Record<string, unknown>[] = []
    const sources: {
      doughDate: string
      status: 'draft' | 'confirmed'
      confirmedAt: Date | null
      view: any
      lines: any[]
    }[] = []
    for (const day of confirmed) {
      const view = await confirmedView(day.date, day, loaded, { light })
      sources.push({
        doughDate: day.date,
        status: 'confirmed',
        confirmedAt: day.confirmedAt,
        view,
        lines: [],
      })
    }
    // Transition (§5.4): items of this bake day whose dough-day sheet was
    // confirmed without them. The bake day's own draft takes them; if that
    // is confirmed too, they stand on no sheet - say so, never drop them.
    const transition = core.transitionFor(
      config,
      date,
      pool
        ? pool
            .filter(
              (d) =>
                d.date >= planCore.addDays(date, -planCore.LOOKAHEAD_DAYS) &&
                d.date <= planCore.addDays(date, planCore.LOOKAHEAD_DAYS)
            )
            .map((d) => ({
              date: d.date,
              plan: dayCore.planOfSnapshot(d.computedSnapshot, d.date) as Plan,
            }))
        : await confirmedAround(date)
    )
    if (transition.lostOwn.length > 0) {
      const byDough = new Map<string, any[]>()
      for (const o of transition.lostOwn) {
        if (!byDough.has(o.doughDate)) byDough.set(o.doughDate, [])
        byDough.get(o.doughDate)!.push(o)
      }
      for (const [d, lost] of byDough) {
        warnings.push({
          code: 'not_on_confirmed_sheet',
          doughDate: d,
          items: lost.map((i: any) => i.itemId),
          message: `${lost.map((i: any) => i.name).join(', ')} für ${dayText(
            date
          )} stehen auf keinem Zettel: der Zettel vom ${dayText(
            d
          )} wurde vor der Umstellung freigegeben. Bitte dort „Wieder öffnen“ und neu freigeben.`,
        })
      }
    }
    const doughDates: string[] = planCore.doughDatesFor(config, date)
    if (transition.adopted.length > 0 && !doughDates.includes(date)) {
      doughDates.push(date)
      doughDates.sort()
    }
    for (const d of doughDates) {
      if (confirmedDates.has(d)) continue
      const day = await BackzettelDay.findByPk(d)
      if (day && day.status === 'confirmed') continue
      if (!kalender.isSheetDay(config, d)) continue
      sources.push({
        doughDate: d,
        status: 'draft',
        confirmedAt: null,
        view: await draftView(d, day, loaded),
        lines: [],
      })
    }
    sources.sort((a, b) => a.doughDate.localeCompare(b.doughDate))
    for (const src of sources) {
      src.lines = src.view.sections
        .flatMap((s: any) => s.lines)
        .filter((l: any) => (l.bakeDate || src.doughDate) === date)
    }
    // A draft without a line for this day adds nothing (Sunday's own,
    // empty sheet); a confirmed sheet stays listed - it may carry Nachträge.
    return {
      sources: sources.filter(
        (s) => s.status === 'confirmed' || s.lines.length > 0
      ),
      confirmed,
      warnings,
    }
  }

  /**
   * `GET /:date/bake-list` (Z10, §4.4): what is baked on `date`, from every
   * sheet that makes dough for it - no dough figures. For the person who
   * only bakes (Sunday). Reads write nothing; like `getDay`, unrecorded
   * deltas of a feeding confirmed sheet start a background catch-up.
   */
  async function getBakeList(date: string) {
    assertDate(date)
    const loaded = source.load()
    if (!loaded.ok) {
      // Like a confirmed day (Z3), the frozen sheets stay readable without
      // master data: the Sunday baker still sees Saturday's rolls. Drafts
      // and the other sources are missing - `configStatus` says so.
      const confirmed = await confirmedSheetsFor([date])
      if (confirmed.length === 0) {
        return {
          date,
          status: 'no-config' as const,
          reasons: loaded.reasons,
          warnings: loaded.warnings,
        }
      }
      const weekday = core.isoWeekday(date)
      const sources = []
      for (const day of confirmed) {
        const view = await confirmedView(day.date, day, loaded)
        sources.push({
          day,
          view,
          lines: view.sections
            .flatMap((s: any) => s.lines)
            .filter((l: any) => (l.bakeDate || day.date) === date),
        })
      }
      const list = core.bakeListFromLines(
        null,
        date,
        sources.map((s) => ({
          doughDate: s.day.date,
          status: 'confirmed',
          lines: s.lines,
          deltas: s.view.deltas,
          rolls: s.view.rolls ?? [],
        }))
      )
      return {
        date,
        weekday,
        weekdayName: WEEKDAY_NAMES[weekday],
        status: 'ok' as const,
        configStatus: 'no-config' as const,
        configReasons: loaded.reasons,
        sources: sources.map((s) => ({
          doughDate: s.day.date,
          weekday: core.isoWeekday(s.day.date),
          weekdayName: WEEKDAY_NAMES[core.isoWeekday(s.day.date)],
          status: 'confirmed' as const,
          confirmedAt: s.day.confirmedAt,
          lineCount: s.lines.length,
        })),
        sections: list.sections,
        rolls: list.rolls,
        deltas: list.deltas,
        deltasPending: null,
        warnings: [
          {
            code: 'no_config',
            message:
              'Stammdaten fehlen - die Backliste zeigt nur die freigegebenen Zettel. Was noch im Entwurf ist, fehlt hier.',
          },
          ...list.warnings,
        ],
      }
    }
    const weekday = core.isoWeekday(date)
    const head = { date, weekday, weekdayName: WEEKDAY_NAMES[weekday] }
    if (!kalender.isBakeDay(loaded.config, date)) {
      // U9: closed by the calendar (holiday, Betriebsferien) or a dough-only
      // day - no bake list, with the reason.
      const info = kalender.dayKind(loaded.config, date)
      const closed = info.kind === 'geschlossen'
      return {
        ...head,
        status: closed ? ('geschlossen' as const) : ('ruhetag' as const),
        dayKind: info,
        ...(closed ? { note: info.note } : {}),
        message: closed
          ? `${dayText(date)}${
              info.note ? ` ${info.note}` : ''
            } - geschlossen, an diesem Tag wird nicht gebacken.`
          : info.kind === 'teigtag'
          ? `${dayText(date)}${
              info.note ? ` ${info.note}` : ''
            } - nur Teig, an diesem Tag wird nicht gebacken.`
          : `${WEEKDAY_NAMES[weekday]} ist Ruhetag - an diesem Tag wird nicht gebacken.`,
        sources: [],
        sections: [],
        rolls: [],
        deltas: [],
        deltasPending: false,
        warnings: [],
      }
    }
    const { sources, confirmed, warnings } = await bakeSources(loaded, date)
    const list = core.bakeListFromLines(
      loaded.config,
      date,
      sources.map((s) => ({
        doughDate: s.doughDate,
        status: s.status,
        lines: s.lines,
        deltas: s.view.deltas,
      }))
    )
    let deltasPending = false
    for (const day of confirmed) {
      if (await pendingFor(loaded, day)) {
        deltasPending = true
        scheduleCatchUp(day.date)
      }
    }
    return {
      ...head,
      status: 'ok' as const,
      configStatus: 'ok' as const,
      sources: sources.map((s) => ({
        doughDate: s.doughDate,
        weekday: core.isoWeekday(s.doughDate),
        weekdayName: WEEKDAY_NAMES[core.isoWeekday(s.doughDate)],
        status: s.status,
        confirmedAt: s.confirmedAt,
        lineCount: s.lines.length,
      })),
      sections: list.sections,
      rolls: list.rolls,
      deltas: list.deltas,
      deltasPending,
      warnings: [...warnings, ...list.warnings],
    }
  }

  /**
   * Z10, for evaluations per bake day (Rest am Abend, §5.5): the lines baked
   * on `date` from every feeding sheet, as one day view - `status`
   * `confirmed` only when every sheet with lines for this day is confirmed,
   * else `draft` (planned only). `deltaTotals` are keyed `itemId|variant`
   * like a same-day sheet. `null` without master data or on a Ruhetag.
   * `light` as in `getConfirmedLines`.
   */
  async function getBakeLines(
    date: string,
    { light = true, pool }: { light?: boolean; pool?: BackzettelDay[] } = {}
  ) {
    assertDate(date)
    const loaded = source.load()
    if (!loaded.ok) return null
    const weekday = core.isoWeekday(date)
    if (!kalender.isBakeDay(loaded.config, date)) return null
    const { sources } = await bakeSources(loaded, date, { light, pool })
    const withLines = sources.filter((s) => s.lines.length > 0)
    const allConfirmed =
      sources.length > 0 &&
      (withLines.length > 0 ? withLines : sources).every(
        (s) => s.status === 'confirmed'
      )
    const deltas: any[] = []
    const deltaTotals: Record<string, any> = {}
    for (const src of sources) {
      if (src.status !== 'confirmed') continue
      const keyBake = new Map<string, string>()
      for (const d of src.view.deltas as any[]) {
        keyBake.set(d.key, d.bakeDate || src.doughDate)
        if ((d.bakeDate || src.doughDate) === date) deltas.push(d)
      }
      for (const [key, entry] of Object.entries(
        (src.view.deltaTotals ?? {}) as Record<string, any>
      )) {
        if ((keyBake.get(key) ?? src.doughDate) !== date) continue
        // Two sheets with Nachträge for the same item on this day (only in
        // the transition): add them up, never let one replace the other.
        const k = key.split('@')[0]
        deltaTotals[k] = deltaTotals[k]
          ? sumDeltaTotals(deltaTotals[k], entry)
          : entry
      }
    }
    const list = core.bakeListFromLines(
      loaded.config,
      date,
      sources.map((s) => ({
        doughDate: s.doughDate,
        status: s.status,
        lines: s.lines,
      }))
    )
    return {
      date,
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday],
      status: allConfirmed ? ('confirmed' as const) : ('draft' as const),
      sources: sources.map((s) => ({
        doughDate: s.doughDate,
        status: s.status,
        lineCount: s.lines.length,
      })),
      sections: list.sections,
      deltas,
      deltaTotals,
    }
  }

  /**
   * `getBakeLines` for many bake days at once (Rest am Abend summary and
   * averages): the confirmed sheets are read once for the whole range.
   * Only days that at least one confirmed sheet bakes on are returned - a
   * day without any is not confirmed and does not count anyway. `{}`
   * without master data (the caller falls back to `getConfirmedLines`).
   */
  async function getBakeLinesRange(
    dates: string[],
    { light = true }: { light?: boolean } = {}
  ) {
    const out: Record<string, any> = {}
    const loaded = source.load()
    if (!loaded.ok) return out
    const valid = [
      ...new Set(
        dates.filter(
          (d) => core.isValidDate(d) && kalender.isBakeDay(loaded.config, d)
        )
      ),
    ].sort()
    const pool = await confirmedSheetsFor(valid)
    for (const date of valid) {
      if (!pool.some((d) => feedsBakeDate(d, date))) continue
      const lines = await getBakeLines(date, { light, pool })
      if (lines) out[date] = lines
    }
    return out
  }

  async function getPrep(date: string) {
    const day: any = await getDay(date)
    if (day.status === 'no-config') return day
    return {
      date: day.date,
      weekday: day.weekday,
      weekdayName: day.weekdayName,
      status: day.status,
      prepDate: day.prepDate,
      prepDateProvisional: day.prepDateProvisional,
      prep: day.prep,
      configStatus: day.configStatus,
    }
  }

  function getConfig() {
    const loaded = source.load()
    return {
      status: loaded.ok ? ('ok' as const) : ('no-config' as const),
      source: loaded.source,
      loadedAt: loaded.loadedAt,
      config: loaded.config,
      errors: loaded.reasons,
      warnings: loaded.warnings,
      open: loaded.open,
      recipesMissing: loaded.recipesMissing,
      catalogSize: loaded.catalog ? loaded.catalog.length : null,
    }
  }

  // ------------------------------------------------------------- writes

  /** Loads config, checks date + production day, opens the write queue. */
  async function writeDraft<T>(
    date: string,
    fn: (
      day: BackzettelDay,
      loaded: Loaded,
      transaction: Transaction
    ) => Promise<T>
  ): Promise<T> {
    assertDate(date)
    assertPlanningWindow(date, hooks.now ? hooks.now() : new Date())
    const loaded = source.load()
    requireConfig(loaded)
    assertProductionDay(loaded, date)
    return getSequelize().transaction(async (transaction) => {
      const day =
        (await BackzettelDay.findByPk(date, { transaction })) ??
        (await BackzettelDay.create({ date }, { transaction }))
      if (day.status === 'confirmed') {
        throw new BackzettelError(409, 'confirmed', CONFIRMED_MESSAGE)
      }
      return fn(day, loaded, transaction)
    })
  }

  async function setSeasonFactor(date: string, body: unknown, req: Request) {
    const parsed = dayCore.parseSeasonFactor(body)
    if (!parsed.ok) throw new BackzettelError(400, parsed.error, parsed.message)
    const expected = optionalExpectedNumber(
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['expectedFactor']
        : undefined,
      'expectedFactor'
    )
    await writeDraft(date, async (day, _loaded, transaction) => {
      const from = toNumber(day.seasonFactor) || 1
      if (from === parsed.value) return
      // W4-verify r4: a second device saved in between - no silent overwrite.
      if (expected !== undefined && !sameQty(expected, from)) {
        throw new BackzettelError(
          409,
          'season_changed',
          `Der Saisonfaktor wurde inzwischen auf ${String(from).replace(
            '.',
            ','
          )} geändert. Deine Eingabe wurde nicht gespeichert - bitte prüfen und erneut speichern.`,
          { current: from }
        )
      }
      await day.update({ seasonFactor: parsed.value }, { transaction })
      await audit(
        req,
        'season',
        'backzettel_day',
        date,
        { from, to: parsed.value },
        { transaction }
      )
    })
    return getDay(date)
  }

  /**
   * W4 verification round 2: a correction that pushes its line below 0 is
   * refused. Stored, it clamped the line to 0 without a word, and every later
   * Vorbestellung on that line vanished in the negative remainder.
   */
  async function assertCorrectionFits(
    date: string,
    day: BackzettelDay,
    loaded: Loaded,
    next: {
      itemId: string
      variant: string | null
      bakeDate: string
      correction: number
      reason: string | null
      noneToday: boolean
    },
    itemName: string,
    transaction: Transaction
  ) {
    const inputs = await loadSheetInputs(loaded, date, transaction)
    const key = rowKey(next, date)
    const plain: Record<string, unknown>[] = inputs.rows
      .filter((r) => rowKey(r, date) !== key)
      .map((r) => r.get({ plain: true }) as Record<string, unknown>)
    plain.push({
      itemId: next.itemId,
      variant: next.variant,
      bakeDate: next.bakeDate,
      correction: next.correction,
      correctionReason: next.reason,
      noneToday: next.noneToday,
    })
    const result = computeSheet(
      loaded,
      date,
      inputs,
      toNumber(day.seasonFactor) || 1,
      plain
    )
    const hit = (result.lines as Array<Record<string, unknown>>).find(
      (l) => l.key === key
    )
    // „Heute keine“ ist die Entscheidung des Tages für eine OFFENE
    // Grundmenge. Steht dort eine Zahl (auch 0), ist die Korrektur der Weg -
    // sonst läse sich ein Posten mit Grundmenge still als „keine“.
    if (next.noneToday && !(hit && hit.baseUnset === true)) {
      throw new BackzettelError(
        400,
        'base_not_open',
        `„${itemName}“ hat für diesen Tag eine Grundmenge - „Heute keine“ gibt es nur, solange die Grundmenge offen ist. Bitte die Menge mit einer Korrektur anpassen.`
      )
    }
    if (hit && hit.correctionClamped) {
      // Viertel aller Quellen erst summiert, dann aufgerundet (Runde 4).
      const without = core.roundUp(Number(hit.subtotalExact) || 0, hit.unit)
      const fmt = (n: number) => String(n).replace('.', ',')
      throw new BackzettelError(
        400,
        'correction_exceeds_line',
        `Die Korrektur (${fmt(next.correction).replace(
          '-',
          '−'
        )}) ist größer als die geplante Menge (${fmt(
          without
        )}). Höchstens −${fmt(
          without
        )} - sonst stünde 0 auf dem Backzettel, und spätere Vorbestellungen fielen weg.`
      )
    }
  }

  /**
   * `expected: { correction, reason, noneToday? }` - what the editor was
   * opened on.
   */
  function parseExpectedCorrection(
    body: unknown
  ): { correction: number; reason: string | null; noneToday: boolean } | null {
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['expected']
        : undefined
    if (raw === undefined || raw === null) return null
    if (typeof raw !== 'object') {
      throw new BackzettelError(
        400,
        'validation',
        'expected muss { correction, reason, noneToday? } sein.'
      )
    }
    const e = raw as Record<string, unknown>
    const correction =
      optionalExpectedNumber(e['correction'], 'expected.correction') ?? 0
    if (
      e['reason'] !== undefined &&
      e['reason'] !== null &&
      typeof e['reason'] !== 'string'
    ) {
      throw new BackzettelError(
        400,
        'validation',
        'expected.reason muss ein Text sein.'
      )
    }
    const reason =
      typeof e['reason'] === 'string' && e['reason'].trim()
        ? e['reason'].trim()
        : null
    if (
      e['noneToday'] !== undefined &&
      e['noneToday'] !== null &&
      typeof e['noneToday'] !== 'boolean'
    ) {
      throw new BackzettelError(
        400,
        'validation',
        'expected.noneToday muss true oder false sein.'
      )
    }
    return { correction, reason, noneToday: e['noneToday'] === true }
  }

  /**
   * W4-verify r4 (lost update): the PC opened the editor on „–“, the tablet
   * saved +5 meanwhile; the PC's +2 replaced it without a word. Now the
   * stored value must still be what the editor showed, else 409 with the
   * current value and who set it.
   */
  async function assertCorrectionUnchanged(
    row: BackzettelLine | null,
    expected: { correction: number; reason: string | null; noneToday: boolean },
    transaction: Transaction,
    // false: a stored „Heute keine“ that no longer applies (the line has a
    // base meanwhile) - the screen shows a line without it, so it is no
    // conflict (review PR #129: every correction ran into a 409).
    noneApplies = true
  ) {
    const current = row ? toNumber(row.correction) : 0
    const currentNone = noneApplies && current === 0 && dayCore.isNoneToday(row)
    const active = current !== 0 || currentNone
    const currentReason =
      row && active && row.correctionReason ? row.correctionReason : null
    const same =
      sameQty(current, expected.correction) &&
      currentNone === expected.noneToday &&
      (!active || currentReason === expected.reason)
    if (same) return
    const users = await usersById([row?.correctionBy], transaction)
    const by = row ? userRef(users, row.correctionBy) : null
    const now = currentNone
      ? `inzwischen auf „Heute keine“ gesetzt${
          by ? ` von ${by.displayName}` : ''
        }`
      : current === 0
      ? 'inzwischen entfernt'
      : `inzwischen auf ${fmtSigned(current)}${
          currentReason ? ` („${currentReason}“)` : ''
        } gesetzt${by ? ` von ${by.displayName}` : ''}`
    throw new BackzettelError(
      409,
      'correction_changed',
      `Die Korrektur dieser Zeile wurde ${now}. Deine Eingabe wurde nicht gespeichert - bitte prüfen und erneut speichern.`,
      {
        current: {
          correction: current,
          reason: currentReason,
          noneToday: currentNone,
          by,
        },
      }
    )
  }

  /**
   * Z10: `bakeDate` in the correction body (default: the sheet day). It must
   * be a bake day of this sheet on which the item is made from this sheet's
   * dough - else 400 `invalid_bake_date`; a pair a confirmed sheet holds is
   * 409 `owned_elsewhere` (correct it there, after „Wieder öffnen“).
   */
  function parseBakeDate(body: unknown, date: string): string {
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['bakeDate']
        : undefined
    if (raw === undefined || raw === null || raw === '') return date
    if (typeof raw !== 'string' || !core.isValidDate(raw)) {
      throw new BackzettelError(
        400,
        'invalid_bake_date',
        `Ungültiger Backtag „${String(raw)}“; erwartet wird JJJJ-MM-TT.`
      )
    }
    return raw
  }

  async function assertBakeDateOfSheet(
    loaded: Loaded,
    date: string,
    bakeDate: string,
    item: { id: string; name: string },
    transaction: Transaction
  ): Promise<void> {
    const confirmed = await confirmedAround(date, transaction)
    const adopted = core.transitionFor(
      loaded.config,
      date,
      confirmed.filter((c) => c.date !== date)
    ).adopted
    const plan: Plan = planCore.planForSheet(
      loaded.config,
      date,
      undefined,
      adopted
    )
    if (!planCore.planBakeDates(plan).includes(bakeDate)) {
      throw new BackzettelError(
        400,
        'invalid_bake_date',
        `${dayText(bakeDate)} ist kein Backtag des Zettels vom ${dayText(
          date
        )}.`,
        { bakeDates: planCore.planBakeDates(plan) }
      )
    }
    if (!planCore.planIncludes(plan, bakeDate, item.id)) {
      const doughDate = planCore.doughDateFor(loaded.config, item, bakeDate)
      throw new BackzettelError(
        400,
        'invalid_bake_date',
        `„${item.name}“ für ${dayText(
          bakeDate
        )} wird nicht an diesem Teigtag gemacht, sondern am ${dayText(
          doughDate
        )} - bitte dort korrigieren.`,
        { doughDate }
      )
    }
    const owner = ownedPairs(loaded.config, date, confirmed).get(
      planCore.ownedKey(bakeDate, item.id)
    )
    if (owner) {
      throw new BackzettelError(
        409,
        'owned_elsewhere',
        `„${item.name}“ für ${dayText(
          bakeDate
        )} steht schon auf dem freigegebenen Zettel vom ${dayText(
          owner
        )}. Änderungen dort nach „Wieder öffnen“.`,
        { sheetDate: owner }
      )
    }
  }

  /**
   * Does the stored „Heute keine“ of this line still apply - is its
   * Grundmenge still open on the sheet as computed now? When hq got a base
   * for the day meanwhile, the flag is stale: the line shows its base (and
   * the warning `none_today_obsolete`), or, with a base of 0, is an item to
   * add. Only computed for rows that carry the flag.
   */
  async function storedNoneApplies(
    date: string,
    day: BackzettelDay,
    loaded: Loaded,
    row: BackzettelLine | null,
    transaction: Transaction
  ): Promise<boolean> {
    if (!row || !dayCore.isNoneToday(row) || toNumber(row.correction) !== 0)
      return false
    const inputs = await loadSheetInputs(loaded, date, transaction)
    const result = computeSheet(
      loaded,
      date,
      inputs,
      toNumber(day.seasonFactor) || 1
    )
    const key = rowKey(row, date)
    const hit = (result.lines as Array<Record<string, unknown>>).find(
      (l) => l.key === key
    )
    return !!hit && hit.baseUnset === true
  }

  async function setCorrection(
    date: string,
    itemId: string,
    variant: string | undefined,
    body: unknown,
    req: Request
  ) {
    assertDate(date)
    const loaded = source.load()
    requireConfig(loaded)
    const line = dayCore.resolveLine(loaded.config, itemId, variant)
    if (!line.ok) throw new BackzettelError(404, line.error, line.message)
    const parsed = dayCore.parseCorrection(body, line.item)
    if (!parsed.ok) throw new BackzettelError(400, parsed.error, parsed.message)
    const expected = parseExpectedCorrection(body)
    const bakeDate = parseBakeDate(body, date)
    await writeDraft(date, async (day, loadedNow, transaction) => {
      await assertBakeDateOfSheet(
        loadedNow,
        date,
        bakeDate,
        line.item,
        transaction
      )
      const where = { date, bakeDate, itemId, variant: line.variant }
      const row = await BackzettelLine.findOne({ where, transaction })
      const noneToday = parsed.value.noneToday === true
      if (parsed.value.correction < 0 || noneToday) {
        await assertCorrectionFits(
          date,
          day,
          loadedNow,
          {
            itemId,
            variant: line.variant,
            bakeDate,
            ...parsed.value,
            noneToday,
          },
          line.item.name,
          transaction
        )
      }
      // The audit says what was stored; a „Heute keine“ that no longer
      // applied (base set in hq meanwhile) is marked as such.
      const storedNone = dayCore.isNoneToday(row)
      const noneApplies = await storedNoneApplies(
        date,
        day,
        loadedNow,
        row,
        transaction
      )
      const from = row
        ? {
            correction: toNumber(row.correction),
            reason: row.correctionReason,
            noneToday: storedNone,
            ...(storedNone && !noneApplies ? { noneTodayObsolete: true } : {}),
          }
        : { correction: 0, reason: null, noneToday: false }
      const to = {
        correction: parsed.value.correction,
        reason: parsed.value.reason,
        noneToday,
      }
      if (
        from.correction === to.correction &&
        from.reason === to.reason &&
        from.noneToday === to.noneToday
      )
        return
      if (expected)
        await assertCorrectionUnchanged(row, expected, transaction, noneApplies)
      const values = {
        correction: to.correction,
        correctionReason: to.reason,
        noneToday: to.noneToday,
        correctionBy:
          to.correction === 0 && !to.noneToday ? null : req.user?.id ?? null,
      }
      if (row) await row.update(values, { transaction })
      else
        await BackzettelLine.create(
          {
            ...where,
            ...values,
            name: line.item.name,
            section: line.item.section,
            unit: line.item.unit,
          },
          { transaction }
        )
      await audit(
        req,
        'correction',
        'backzettel_day',
        date,
        {
          itemId,
          variant: line.variant,
          ...(bakeDate !== date ? { bakeDate } : {}),
          from,
          to,
        },
        { transaction }
      )
    })
    return getDay(date)
  }

  async function confirm(date: string, req: Request) {
    await writeDraft(date, async (day, loaded, transaction) => {
      const inputs = await loadSheetInputs(loaded, date, transaction)
      const rows = inputs.rows
      const result = computeSheet(
        loaded,
        date,
        inputs,
        toNumber(day.seasonFactor) || 1
      )
      // Z10: what this sheet covers is frozen with it (`computed_snapshot.plan`);
      // its preorder snapshot holds the positions of those bake days.
      const snapshot = snapshotForPlan(inputs.snapshot, result.plan, date)
      const rowsByKey = new Map(rows.map((r) => [rowKey(r, date), r]))
      const keep = new Set<number>()
      const clearedTicks: Record<string, unknown>[] = []
      const clearedBakedTicks: Record<string, unknown>[] = []
      const bakedFromDeltas: Record<string, unknown>[] = []
      const iso = (at: Date | string | null | undefined) =>
        at instanceof Date ? at.toISOString() : at ?? null
      // Z10 O5 (Review): Nachträge ticked „gebacken“ that the reopen
      // discarded still count as baked - the Backstube must not bake them
      // twice.
      const fromReopen = await bakedDeltasFromReopen(date, transaction)
      /**
       * The baked tick of a line after this confirm (`dayCore.bakedAfterConfirm`):
       * the row's own tick plus the baked Nachträge. Stays, is set from the
       * Nachträge when they cover the line, or is cleared and listed
       * (`clearedBakedTicks` → `previouslyBaked`) when more is needed.
       */
      const bakedTick = (
        row: BackzettelLine | null,
        values: any,
        where: Record<string, unknown>
      ) => {
        const extra = fromReopen.get(rowKey(values, date))
        const state = dayCore.bakedAfterConfirm(row, values, extra?.qty)
        const lineBaked = !!row && row.bakedAt !== null
        const by: number | null =
          row && lineBaked ? row.bakedBy : extra?.by ?? null
        const at: string | null =
          row && lineBaked ? iso(row.bakedAt) : extra?.at ?? null
        if (state.baked === false) {
          clearedBakedTicks.push({
            ...where,
            bakedBy: by,
            bakedAt: at,
            from: state.qty,
            to: values.total,
            ...(extra ? { fromDeltas: extra.qty } : {}),
          })
          return lineBaked ? { bakedAt: null, bakedBy: null } : {}
        }
        if (state.baked === true && !lineBaked) {
          bakedFromDeltas.push({
            ...where,
            bakedBy: by,
            bakedAt: at,
            qty: state.qty,
            to: values.total,
          })
          return { bakedAt: at ? new Date(at) : new Date(), bakedBy: by }
        }
        return {}
      }
      for (const raw of dayCore.linesForConfirm(result.lines)) {
        const values = {
          ...raw,
          bakeDate: raw.bakeDate || date,
          noneToday: raw.noneToday === true,
        }
        const key = rowKey(values, date)
        const row = rowsByKey.get(key)
        if (row) {
          // A tick from the previous confirmation stands if the line still
          // asks for the same quantity or less (W4-verify r3: baked 14, now
          // 12 needed - done); more needed clears it. The bake-list tick
          // (O5) follows the same rule, on its own.
          const ticks = dayCore.ticksAfterConfirm(row, values)
          const untick = ticks.done === false
          const where = {
            itemId: row.itemId,
            variant: row.variant,
            ...(row.bakeDate && row.bakeDate !== date
              ? { bakeDate: row.bakeDate }
              : {}),
          }
          if (untick) {
            clearedTicks.push({
              ...where,
              doneBy: row.doneBy,
              doneAt: iso(row.doneAt),
              from: toNumber(row.total),
              to: values.total,
            })
          }
          const baked = bakedTick(row, values, where)
          await row.update(
            {
              ...values,
              correctionBy:
                values.correction === 0 && !values.noneToday
                  ? null
                  : row.correctionBy,
              ...(untick ? { doneAt: null, doneBy: null } : {}),
              ...baked,
            },
            { transaction }
          )
          keep.add(row.id)
        } else {
          const baked = bakedTick(null, values, {
            itemId: values.itemId,
            variant: values.variant,
            ...(values.bakeDate !== date ? { bakeDate: values.bakeDate } : {}),
          })
          const created = await BackzettelLine.create(
            { date, ...values, correctionBy: null, ...baked },
            { transaction }
          )
          keep.add(created.id)
        }
      }
      const removed = rows.filter((r) => !keep.has(r.id))
      if (removed.length) {
        await BackzettelLine.destroy({
          where: { id: removed.map((r) => r.id) },
          transaction,
        })
      }
      const discarded = await BackzettelDelta.destroy({
        where: { date },
        transaction,
      })
      await day.update(
        {
          status: 'confirmed',
          confirmedBy: req.user?.id ?? null,
          confirmedAt: new Date(),
          preorderSnapshot: snapshot,
          computedSnapshot: dayCore.computedSnapshot(result),
        },
        { transaction }
      )
      await audit(
        req,
        'confirm',
        'backzettel_day',
        date,
        {
          seasonFactor: result.seasonFactor,
          lines: result.lines.map((l: any) => ({
            itemId: l.itemId,
            variant: l.variant,
            ...(l.bakeDate && l.bakeDate !== date
              ? { bakeDate: l.bakeDate }
              : {}),
            total: l.total,
          })),
          preorderPositions: snapshot.length,
          removedLines: removed.map((r) => ({
            itemId: r.itemId,
            variant: r.variant,
            ...(r.bakeDate && r.bakeDate !== date
              ? { bakeDate: r.bakeDate }
              : {}),
          })),
          discardedDeltas: discarded,
          clearedTicks,
          clearedBakedTicks,
          ...(bakedFromDeltas.length ? { bakedFromDeltas } : {}),
          warnings: result.warnings.map((w: any) => w.code),
        },
        { transaction }
      )
    })
    // One-shot catch-up of the other confirmed days (W4, see
    // reconcileConfirmedDays); this day's snapshot is fresh anyway.
    await reconcileQuietly(req)
    const confirmed = await getDay(date)
    if (hooks.onConfirmed) {
      try {
        hooks.onConfirmed(confirmed, { role: req.user?.role ?? null })
      } catch (error) {
        console.error('[backzettel] onConfirmed hook failed:', error)
      }
    }
    return confirmed
  }

  async function reopen(date: string, body: unknown, req: Request) {
    assertDate(date)
    const b = body && typeof body === 'object' ? (body as any) : {}
    if (
      b.reason !== undefined &&
      b.reason !== null &&
      typeof b.reason !== 'string'
    ) {
      throw new BackzettelError(
        400,
        'validation',
        'Der Grund muss ein Text sein.'
      )
    }
    const reason = typeof b.reason === 'string' ? b.reason.trim() : ''
    if (reason.length > dayCore.MAX_REASON_LENGTH) {
      throw new BackzettelError(
        400,
        'validation',
        `Der Grund darf höchstens ${dayCore.MAX_REASON_LENGTH} Zeichen lang sein.`
      )
    }
    if (dayCore.hasNameControlChars(reason)) {
      throw new BackzettelError(
        400,
        'INVALID_TEXT',
        dayCore.REASON_CONTROL_MESSAGE
      )
    }
    await getSequelize().transaction(async (transaction) => {
      const day = await BackzettelDay.findByPk(date, { transaction })
      if (!day || day.status !== 'confirmed') {
        throw new BackzettelError(
          409,
          'not_confirmed',
          'Der Backzettel ist nicht freigegeben.'
        )
      }
      const deltas = await BackzettelDelta.findAll({
        where: { date },
        transaction,
      })
      // Z10 O5 (Review): what of the Nachträge was baked is kept, so the
      // next confirm counts it (`bakedDeltasFromReopen`).
      const bakedDeltas = deltas.some((d) => d.bakedAt)
        ? bakedDeltaFigures(
            date,
            day,
            await BackzettelLine.findAll({
              where: { date },
              order: [['id', 'ASC']],
              transaction,
            }),
            deltas,
            (() => {
              const loaded = source.load()
              return loaded.ok ? loaded.config : null
            })()
          )
        : []
      const previous = {
        confirmedBy: day.confirmedBy,
        confirmedAt: day.confirmedAt,
      }
      await BackzettelDelta.destroy({ where: { date }, transaction })
      await day.update(
        {
          status: 'draft',
          confirmedBy: null,
          confirmedAt: null,
          preorderSnapshot: null,
          computedSnapshot: null,
        },
        { transaction }
      )
      await audit(
        req,
        'reopen',
        'backzettel_day',
        date,
        {
          reason: reason || null,
          previous,
          discardedDeltas: deltas.map((d) => ({
            id: d.id,
            itemId: d.itemId,
            variant: d.variant,
            ...(d.bakeDate && d.bakeDate !== date
              ? { bakeDate: d.bakeDate }
              : {}),
            preorderId: d.preorderId,
            qty: toNumber(d.qty),
            kind: d.kind,
            acknowledged: d.acknowledgedAt !== null,
            baked: d.bakedAt !== null,
          })),
          bakedDeltas,
        },
        { transaction }
      )
    })
    await reconcileQuietly(req)
    if (hooks.onReopened) {
      try {
        hooks.onReopened(date, { role: req.user?.role ?? null })
      } catch (error) {
        console.error('[backzettel] onReopened hook failed:', error)
      }
    }
    return getDay(date)
  }

  async function setDone(
    date: string,
    lineIdRaw: string,
    done: boolean,
    req: Request,
    body: unknown = undefined
  ) {
    assertDate(date)
    const lineId = Number(lineIdRaw)
    if (!/^[1-9]\d*$/.test(lineIdRaw) || !Number.isSafeInteger(lineId)) {
      throw new BackzettelError(400, 'validation', 'Ungültige Zeilen-ID.')
    }
    // W4-verify r4: the total the tablet showed. A tick from a stale view
    // (owner re-confirmed with more pieces meanwhile) must not mark the new,
    // larger total as baked.
    const expectedTotal = optionalExpectedNumber(
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['expectedTotal']
        : undefined,
      'expectedTotal'
    )
    const row = await getSequelize().transaction(async (transaction) => {
      const day = await BackzettelDay.findByPk(date, { transaction })
      if (!day || day.status !== 'confirmed') {
        throw new BackzettelError(
          409,
          'not_confirmed',
          'Abhaken geht erst, wenn der Backzettel freigegeben ist.'
        )
      }
      const line = await BackzettelLine.findOne({
        where: { id: lineId, date },
        transaction,
      })
      if (!line) {
        throw new BackzettelError(
          404,
          'not_found',
          'Diese Zeile gibt es so nicht mehr - der Backzettel wurde inzwischen neu freigegeben.'
        )
      }
      const total = toNumber(line.total)
      if (done && expectedTotal !== undefined && total > expectedTotal + 1e-9) {
        throw new BackzettelError(
          409,
          'line_changed',
          `Menge geändert: jetzt ${String(total).replace(
            '.',
            ','
          )} statt ${String(expectedTotal).replace(
            '.',
            ','
          )}. Der Haken wurde nicht gesetzt.`,
          { total, expectedTotal }
        )
      }
      const isDone = line.doneAt !== null
      if (isDone === done) return line
      await line.update(
        done
          ? { doneAt: new Date(), doneBy: req.user?.id ?? null }
          : { doneAt: null, doneBy: null },
        { transaction }
      )
      await audit(
        req,
        done ? 'line_done' : 'line_undone',
        'backzettel_line',
        line.id,
        {
          date,
          ...(line.bakeDate && line.bakeDate !== date
            ? { bakeDate: line.bakeDate }
            : {}),
          itemId: line.itemId,
          variant: line.variant,
          total,
        },
        { transaction }
      )
      return line
    })
    const users = await usersById([row.doneBy])
    return {
      id: row.id,
      date: row.date,
      bakeDate: row.bakeDate || row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      doneAt: row.doneAt,
      doneBy: userRef(users, row.doneBy),
    }
  }

  /**
   * Z10, owner decision O5 (2026-11-08): „gebacken“ on the bake list of
   * `bakeDate` for one row, separate from „done“ on the dough-day sheet
   * (`setDone`, on a lead > 0 line = made). The row is addressed by its id
   * like a done tick; it must be baked on `bakeDate` (else 404
   * `not_on_bake_list`) and its sheet - the dough day - must be confirmed
   * (409 `not_confirmed`, a draft line can still change). `expectedTotal` as
   * for done: more due now is 409 `line_changed`. Independent of done.
   */
  async function setBaked(
    bakeDate: string,
    lineIdRaw: string,
    baked: boolean,
    req: Request,
    body: unknown = undefined
  ) {
    assertDate(bakeDate)
    const lineId = Number(lineIdRaw)
    if (!/^[1-9]\d*$/.test(lineIdRaw) || !Number.isSafeInteger(lineId)) {
      throw new BackzettelError(400, 'validation', 'Ungültige Zeilen-ID.')
    }
    const expectedTotal = optionalExpectedNumber(
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['expectedTotal']
        : undefined,
      'expectedTotal'
    )
    const row = await getSequelize().transaction(async (transaction) => {
      const line = await BackzettelLine.findOne({
        where: { id: lineId },
        transaction,
      })
      if (!line) {
        throw new BackzettelError(
          404,
          'not_found',
          'Diese Zeile gibt es so nicht mehr - der Backzettel wurde inzwischen neu freigegeben.'
        )
      }
      const lineBakeDate = line.bakeDate || line.date
      if (lineBakeDate !== bakeDate) {
        throw new BackzettelError(
          404,
          'not_on_bake_list',
          `Diese Zeile steht nicht auf der Backliste vom ${dayText(
            bakeDate
          )} - sie wird am ${dayText(lineBakeDate)} gebacken.`,
          { bakeDate: lineBakeDate }
        )
      }
      const day = await BackzettelDay.findByPk(line.date, { transaction })
      if (!day || day.status !== 'confirmed') {
        throw new BackzettelError(
          409,
          'not_confirmed',
          `Abhaken geht erst, wenn der Backzettel vom ${dayText(
            line.date
          )} freigegeben ist.`,
          { doughDate: line.date }
        )
      }
      const total = toNumber(line.total)
      if (
        baked &&
        expectedTotal !== undefined &&
        total > expectedTotal + 1e-9
      ) {
        throw new BackzettelError(
          409,
          'line_changed',
          `Menge geändert: jetzt ${String(total).replace(
            '.',
            ','
          )} statt ${String(expectedTotal).replace(
            '.',
            ','
          )}. Der Haken wurde nicht gesetzt.`,
          { total, expectedTotal }
        )
      }
      const isBaked = line.bakedAt !== null
      if (isBaked === baked) return line
      await line.update(
        baked
          ? { bakedAt: new Date(), bakedBy: req.user?.id ?? null }
          : { bakedAt: null, bakedBy: null },
        { transaction }
      )
      await audit(
        req,
        baked ? 'line_baked' : 'line_unbaked',
        'backzettel_line',
        line.id,
        {
          date: line.date,
          bakeDate: lineBakeDate,
          itemId: line.itemId,
          variant: line.variant,
          total,
        },
        { transaction }
      )
      return line
    })
    const users = await usersById([row.bakedBy])
    return {
      id: row.id,
      date: row.date,
      bakeDate: row.bakeDate || row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      bakedAt: row.bakedAt,
      bakedBy: userRef(users, row.bakedBy),
    }
  }

  /**
   * Z10 O5: „gebacken“ for Nachträge on the bake list of `bakeDate` - each
   * Nachtrag on its own (`{ ids }`, the tablet sends one line's at once),
   * never through its line. All or nothing like the bulk ack: a Nachtrag
   * that is gone (re-confirmed, reopened) is 404 `not_found`, one for
   * another bake day 404 `not_on_bake_list`. Baked implies seen
   * (`dayCore.deltaBakedUpdate`); unticking keeps „Gesehen“. Nachträge only
   * exist on confirmed sheets, so there is no draft case.
   */
  async function setDeltasBaked(
    bakeDate: string,
    body: unknown,
    baked: boolean,
    req: Request
  ) {
    assertDate(bakeDate)
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['ids']
        : undefined
    if (
      !Array.isArray(raw) ||
      raw.length === 0 ||
      raw.length > MAX_ACK_IDS ||
      !raw.every((x) => Number.isSafeInteger(x) && (x as number) > 0)
    ) {
      throw new BackzettelError(
        400,
        'validation',
        `ids muss eine Liste von 1 bis ${MAX_ACK_IDS} Nachtrag-IDs sein.`
      )
    }
    const ids = [...new Set(raw as number[])]
    const rows = await getSequelize().transaction(async (transaction) => {
      const deltas = await BackzettelDelta.findAll({
        where: { id: ids },
        order: [['id', 'ASC']],
        transaction,
      })
      if (deltas.length !== ids.length) {
        throw new BackzettelError(404, 'not_found', DELTA_GONE_MESSAGE)
      }
      const elsewhere = deltas.find((d) => (d.bakeDate || d.date) !== bakeDate)
      if (elsewhere) {
        const other = elsewhere.bakeDate || elsewhere.date
        throw new BackzettelError(
          404,
          'not_on_bake_list',
          `Dieser Nachtrag steht nicht auf der Backliste vom ${dayText(
            bakeDate
          )} - er wird am ${dayText(other)} gebacken.`,
          { bakeDate: other }
        )
      }
      const at = new Date()
      for (const delta of deltas) {
        const change = dayCore.deltaBakedUpdate(
          delta,
          baked,
          at,
          req.user?.id ?? null
        )
        if (!change) continue
        await delta.update(change, { transaction })
        await audit(
          req,
          baked ? 'delta_baked' : 'delta_unbaked',
          'backzettel_delta',
          delta.id,
          {
            date: delta.date,
            bakeDate,
            itemId: delta.itemId,
            variant: delta.variant,
            qty: toNumber(delta.qty),
            ...('acknowledgedAt' in change ? { acknowledged: true } : {}),
          },
          { transaction }
        )
      }
      return deltas
    })
    const users = await usersById(
      rows.flatMap((r) => [r.acknowledgedBy, r.bakedBy])
    )
    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      bakeDate: row.bakeDate || row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      qty: toNumber(row.qty),
      kind: row.kind,
      preorderId: row.preorderId,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: userRef(users, row.acknowledgedBy),
      bakedAt: row.bakedAt,
      bakedBy: userRef(users, row.bakedBy),
    }))
  }

  async function acknowledgeDelta(date: string, idRaw: string, req: Request) {
    assertDate(date)
    const id = Number(idRaw)
    if (!/^[1-9]\d*$/.test(idRaw) || !Number.isSafeInteger(id)) {
      throw new BackzettelError(400, 'validation', 'Ungültige Delta-ID.')
    }
    const row = await getSequelize().transaction(async (transaction) => {
      const delta = await BackzettelDelta.findOne({
        where: { id, date },
        transaction,
      })
      if (!delta) {
        throw new BackzettelError(404, 'not_found', DELTA_GONE_MESSAGE)
      }
      if (delta.acknowledgedAt !== null) return delta
      await delta.update(
        { acknowledgedAt: new Date(), acknowledgedBy: req.user?.id ?? null },
        { transaction }
      )
      await audit(
        req,
        'delta_ack',
        'backzettel_delta',
        delta.id,
        {
          date,
          itemId: delta.itemId,
          variant: delta.variant,
          qty: toNumber(delta.qty),
        },
        { transaction }
      )
      return delta
    })
    const users = await usersById([row.acknowledgedBy])
    return {
      id: row.id,
      date: row.date,
      bakeDate: row.bakeDate || row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      qty: toNumber(row.qty),
      kind: row.kind,
      preorderId: row.preorderId,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: userRef(users, row.acknowledgedBy),
    }
  }

  /**
   * W4-verify r4: „Gesehen“ for several Nachträge at once (one tap per
   * Backzettel line on the tablet instead of one per preorder item). All or
   * nothing: if one of them is gone (re-confirmed), 404 and nothing changes.
   */
  async function acknowledgeDeltas(date: string, body: unknown, req: Request) {
    assertDate(date)
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['ids']
        : undefined
    if (
      !Array.isArray(raw) ||
      raw.length === 0 ||
      raw.length > MAX_ACK_IDS ||
      !raw.every((x) => Number.isSafeInteger(x) && (x as number) > 0)
    ) {
      throw new BackzettelError(
        400,
        'validation',
        `ids muss eine Liste von 1 bis ${MAX_ACK_IDS} Nachtrag-IDs sein.`
      )
    }
    const ids = [...new Set(raw as number[])]
    const rows = await getSequelize().transaction(async (transaction) => {
      const deltas = await BackzettelDelta.findAll({
        where: { id: ids, date },
        transaction,
      })
      if (deltas.length !== ids.length) {
        throw new BackzettelError(404, 'not_found', DELTA_GONE_MESSAGE)
      }
      const at = new Date()
      for (const delta of deltas) {
        if (delta.acknowledgedAt !== null) continue
        await delta.update(
          { acknowledgedAt: at, acknowledgedBy: req.user?.id ?? null },
          { transaction }
        )
        await audit(
          req,
          'delta_ack',
          'backzettel_delta',
          delta.id,
          {
            date,
            itemId: delta.itemId,
            variant: delta.variant,
            qty: toNumber(delta.qty),
          },
          { transaction }
        )
      }
      return deltas
    })
    const users = await usersById(rows.map((r) => r.acknowledgedBy))
    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      bakeDate: row.bakeDate || row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      qty: toNumber(row.qty),
      kind: row.kind,
      preorderId: row.preorderId,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedBy: userRef(users, row.acknowledgedBy),
    }))
  }

  return {
    getDay,
    getConfirmedLines,
    getBakeList,
    getBakeLines,
    getBakeLinesRange,
    getPrep,
    getConfig,
    setSeasonFactor,
    setCorrection,
    confirm,
    reopen,
    setDone,
    setBaked,
    setDeltasBaked,
    acknowledgeDelta,
    acknowledgeDeltas,
    recordPreorderDeltas,
    reconcileConfirmedDays,
    idle,
  }
}

export type BackzettelService = ReturnType<typeof createBackzettelService>
