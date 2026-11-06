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
import type { PreorderSnapshotItem } from '../models/BackzettelDay'
import type {
  BackzettelSource,
  LoadedBackzettelConfig,
} from './backzettel-source'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./backzettel.core')
const dayCore = require('./backzettel-day.core')
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

function assertProductionDay(loaded: Loaded, date: string): void {
  const weekday = core.isoWeekday(date)
  if (!loaded.config.days.includes(weekday)) {
    throw new BackzettelError(
      409,
      'ruhetag',
      `${WEEKDAY_NAMES[weekday]} ist Ruhetag - an diesem Tag gibt es keinen Backzettel.`,
      { weekday }
    )
  }
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

/** Not cancelled preorder positions with pickup on `date` (snapshot form). */
async function loadPreorderSnapshot(
  date: string,
  transaction?: Transaction
): Promise<PreorderSnapshotItem[]> {
  const preorders = await Preorder.findAll({
    where: { pickupDate: date, status: { [Op.ne]: 'storniert' } },
    attributes: ['id', 'status'],
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
 * Status of every preorder that is on `date` now, cancelled ones included -
 * tells a cancelled order from a removed line or an order moved to another
 * day (`reconcileDeltas`, W4-verify r5).
 */
async function loadDayOrderStates(
  date: string,
  transaction?: Transaction
): Promise<Record<string, string>> {
  const rows = await Preorder.findAll({
    where: { pickupDate: date },
    attributes: ['id', 'status'],
    transaction,
  })
  return Object.fromEntries(rows.map((p) => [String(p.id), p.status]))
}

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

function computeDraft(
  loaded: Loaded,
  date: string,
  inputs: {
    snapshot: PreorderSnapshotItem[]
    templates: unknown[]
    rows: Array<BackzettelLine | Record<string, unknown>>
    seasonFactor: number
  }
) {
  const result = core.computeDay({
    config: loaded.config,
    date,
    preorderItems: dayCore.toCorePreorderItems(inputs.snapshot, date),
    capTemplate: inputs.templates,
    corrections: dayCore.correctionsFromRows(
      inputs.rows.map((r) =>
        r instanceof BackzettelLine ? r.get({ plain: true }) : r
      )
    ),
    seasonFactor: inputs.seasonFactor,
    recipes: loaded.recipes,
    catalog: loaded.catalog,
  })
  if (result.error) {
    throw new BackzettelError(400, result.error, result.message)
  }
  return result
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

  async function draftView(
    date: string,
    day: BackzettelDay | null,
    loaded: Loaded
  ) {
    const weekday = core.isoWeekday(date)
    const [snapshot, templates, rows] = await Promise.all([
      loadPreorderSnapshot(date),
      loadCapTemplates(weekday),
      BackzettelLine.findAll({ where: { date } }),
    ])
    const seasonFactor = day ? toNumber(day.seasonFactor) || 1 : 1
    const result = computeDraft(loaded, date, {
      snapshot,
      templates,
      rows,
      seasonFactor,
    })
    const rowsByKey = new Map(
      rows.map((r) => [
        core.lineKey(r.itemId, dayCore.apiVariant(r.variant)),
        r,
      ])
    )
    const users = await usersById(
      rows.flatMap((r) => [r.correctionBy, r.doneBy])
    )
    const lineView = (line: any) => {
      const row = rowsByKey.get(line.key)
      // After a reopen a tick only shows while the line still asks for the
      // quantity it was ticked for; confirm clears it otherwise.
      const ticked =
        !!row && row.doneAt !== null && dayCore.tickStillValid(row, line)
      return {
        id: row ? row.id : null,
        ...line,
        correctionBy:
          row && toNumber(row.correction) !== 0
            ? userRef(users, row.correctionBy)
            : null,
        doneAt: ticked ? row.doneAt : null,
        doneBy: ticked ? userRef(users, row.doneBy) : null,
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
      ...dayCore.prepDateFor(date, loaded.config.days),
      deltas: [],
      warnings: result.warnings,
      configStatus: 'ok' as const,
    }
  }

  async function confirmedView(
    date: string,
    day: BackzettelDay,
    loaded: Loaded
  ) {
    const weekday = core.isoWeekday(date)
    const config = loaded.ok ? loaded.config : null
    const [rows, deltaRows, confirmAudits] = await Promise.all([
      BackzettelLine.findAll({ where: { date }, order: [['id', 'ASC']] }),
      BackzettelDelta.findAll({ where: { date }, order: [['id', 'ASC']] }),
      AuditLog.findAll({
        where: { action: 'confirm', entity: 'backzettel_day', entityId: date },
        order: [['id', 'ASC']],
        attributes: ['data'],
      }),
    ])
    // W4 verification round 2: a re-confirm that changed a line dropped its
    // tick (`clearedTicks` in the audit). Without a trace the Backstube saw
    // "78, open" after baking 70 - so the latest cleared tick per line comes
    // back as `previouslyDone` while the line is still unticked.
    const cleared = new Map<
      string,
      { qty: number; doneBy: number | null; doneAt: string | null }
    >()
    for (const a of confirmAudits) {
      const list = (a.data as { clearedTicks?: unknown } | null)?.clearedTicks
      for (const t of Array.isArray(list) ? list : []) {
        const tick = t as Record<string, unknown>
        if (typeof tick['itemId'] !== 'string') continue
        cleared.set(
          core.lineKey(
            tick['itemId'],
            dayCore.apiVariant(tick['variant'] as string | null)
          ),
          {
            qty: toNumber(tick['from'] as number),
            doneBy: typeof tick['doneBy'] === 'number' ? tick['doneBy'] : null,
            doneAt: typeof tick['doneAt'] === 'string' ? tick['doneAt'] : null,
          }
        )
      }
    }
    const users = await usersById([
      day.confirmedBy,
      ...rows.flatMap((r) => [r.correctionBy, r.doneBy]),
      ...deltaRows.map((d) => d.acknowledgedBy),
      ...[...cleared.values()].map((c) => c.doneBy),
    ])
    const preorderIds = [
      ...new Set(
        deltaRows
          .map((d) => d.preorderId)
          .filter((id): id is number => Number.isInteger(id))
      ),
    ]
    const codes = new Map(
      preorderIds.length
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
      return {
        id: d.id,
        key: core.lineKey(d.itemId, dayCore.apiVariant(d.variant)),
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
          return now && now.pickupDate !== date ? now.pickupDate : null
        })(),
        createdAt: d.createdAt,
        acknowledgedAt: d.acknowledgedAt,
        acknowledgedBy: userRef(users, d.acknowledgedBy),
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
      }
    >()
    for (const d of deltas) {
      const e = deltaByKey.get(d.key) || {
        qty: 0,
        open: 0,
        count: 0,
        openQty: 0,
      }
      e.qty = Math.round((e.qty + d.qty) * 100) / 100
      e.count += 1
      if (!d.acknowledgedAt) {
        e.open += 1
        e.openQty = Math.round((e.openQty + d.qty) * 100) / 100
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
        lines.push(line)
        return {
          id: row.id,
          ...line,
          preordersExact: line.preorders,
          preorderIds: [],
          correctionBy:
            toNumber(row.correction) !== 0
              ? userRef(users, row.correctionBy)
              : null,
          doneAt: row.doneAt,
          doneBy: userRef(users, row.doneBy),
          previouslyDone:
            row.doneAt === null && cleared.has(line.key)
              ? (() => {
                  const c = cleared.get(line.key)!
                  return {
                    qty: c.qty,
                    at: c.doneAt,
                    by: userRef(users, c.doneBy),
                  }
                })()
              : null,
          delta: deltaByKey.get(line.key) ?? null,
        }
      }),
    }))

    // Frozen at confirm; the current master data only says whether it would
    // now compute something else (`configChangedSinceConfirm`). Days
    // confirmed before the snapshot column existed fall back to recomputing.
    const recomputed = config
      ? (() => {
          const w: unknown[] = []
          return {
            hefeteig: core.computeHefeteig(config, lines),
            fillings: core.computeFillings(
              config,
              lines,
              loaded.recipes || {},
              w
            ),
            prep: core.computePrep(config, lines, weekday),
            warnings: w,
          }
        })()
      : null
    const snap = day.computedSnapshot
    const frozen = snap ?? recomputed
    const hefeteig = frozen ? frozen.hefeteig : null
    const fillings = frozen ? frozen.fillings : null
    const prep = frozen ? frozen.prep : null
    const warnings =
      frozen && Array.isArray(frozen.warnings) ? frozen.warnings : []
    const configChangedSinceConfirm =
      snap && recomputed ? dayCore.snapshotDiffers(snap, recomputed) : null

    // W4 verification: what the Nachträge mean for the oven, the dough and
    // the fillings. `delta.bake` per line (after rounding), `deltaExtras`
    // the change in Hefeteig/Füllungen - the frozen figures stay as they are.
    let deltaExtras: unknown = null
    if (deltaByKey.size > 0) {
      const extras = dayCore.deltaBakeExtras(
        lines,
        Object.fromEntries(deltaByKey),
        snap?.preordersExact ?? null,
        snap?.subtotalExact ?? null
      )
      for (const [key, entry] of deltaByKey) entry.bake = extras[key] ?? 0
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
        lines,
        ackedByKey,
        snap?.preordersExact ?? null,
        snap?.subtotalExact ?? null
      )
      for (const [key, entry] of deltaByKey) {
        entry.bakeOpen =
          Math.round(((entry.bake ?? 0) - (ackedExtras[key] ?? 0)) * 100) / 100
      }
      if (config && recomputed) {
        const adjusted = dayCore.linesWithExtras(lines, extras)
        deltaExtras = dayCore.hefeteigFillingsDiff(recomputed, {
          hefeteig: core.computeHefeteig(config, adjusted),
          fillings: core.computeFillings(
            config,
            adjusted,
            loaded.recipes || {},
            []
          ),
        })
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
      ...dayCore.prepDateFor(date, config ? config.days : null),
      deltas,
      deltaExtras,
      warnings,
      configStatus: loaded.ok ? ('ok' as const) : ('no-config' as const),
      configChangedSinceConfirm,
      ...(loaded.ok ? {} : { configReasons: loaded.reasons }),
    }
  }

  /** Delta rows that are not recorded yet (pure; `dayCore.reconcileDeltas`). */
  function unrecordedDeltas(
    loaded: Loaded,
    date: string,
    current: PreorderSnapshotItem[],
    recorded: BackzettelDelta[],
    snapshot: unknown,
    orders?: Record<string, string>
  ) {
    return dayCore.reconcileDeltas({
      config: loaded.config,
      date,
      snapshot,
      current,
      orders,
      recorded: recorded.map((r) => ({
        itemId: r.itemId,
        variant: r.variant,
        preorderId: r.preorderId,
        qty: toNumber(r.qty),
      })),
      catalog: loaded.catalog,
    })
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
    const rows = unrecordedDeltas(
      loaded,
      date,
      await loadPreorderSnapshot(date, transaction),
      await BackzettelDelta.findAll({ where: { date }, transaction }),
      day.preorderSnapshot || [],
      await loadDayOrderStates(date, transaction)
    )
    if (rows.length === 0) return 0
    const created = await BackzettelDelta.bulkCreate(
      rows.map((r: any) => ({ date, ...r })),
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
   * deltas of every touched confirmed day in the preorder's transaction.
   */
  async function recordPreorderDeltas(
    dates: string[],
    context: { transaction: Transaction; req: Request | null; via: string }
  ): Promise<void> {
    for (const date of dates) {
      if (!core.isValidDate(date)) continue
      await recordDeltasIn(
        date,
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
    const days = await BackzettelDay.findAll({
      where: { status: 'confirmed', date: { [Op.gte]: from } },
      attributes: ['date'],
      order: [['date', 'ASC']],
    })
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
      const deltasPending = loaded.ok
        ? unrecordedDeltas(
            loaded,
            date,
            await loadPreorderSnapshot(date),
            await BackzettelDelta.findAll({ where: { date } }),
            day.preorderSnapshot || []
          ).length > 0
        : null
      if (deltasPending === true) scheduleCatchUp(date)
      return { ...view, deltasPending }
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
      correction: number
      reason: string | null
    },
    transaction: Transaction
  ) {
    const weekday = core.isoWeekday(date)
    const [snapshot, templates, rows] = await Promise.all([
      loadPreorderSnapshot(date, transaction),
      loadCapTemplates(weekday, transaction),
      BackzettelLine.findAll({ where: { date }, transaction }),
    ])
    const plain: Record<string, unknown>[] = rows
      .map((r) => r.get({ plain: true }) as Record<string, unknown>)
      .filter(
        (r) =>
          !(
            r.itemId === next.itemId &&
            dayCore.apiVariant(r.variant) === dayCore.apiVariant(next.variant)
          )
      )
    plain.push({
      itemId: next.itemId,
      variant: next.variant,
      correction: next.correction,
      correctionReason: next.reason,
    })
    const result = computeDraft(loaded, date, {
      snapshot,
      templates,
      rows: plain,
      seasonFactor: toNumber(day.seasonFactor) || 1,
    })
    const key = core.lineKey(next.itemId, dayCore.apiVariant(next.variant))
    const hit = (result.lines as Array<Record<string, unknown>>).find(
      (l) => l.key === key
    )
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

  /** `expected: { correction, reason }` - what the editor was opened on. */
  function parseExpectedCorrection(
    body: unknown
  ): { correction: number; reason: string | null } | null {
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['expected']
        : undefined
    if (raw === undefined || raw === null) return null
    if (typeof raw !== 'object') {
      throw new BackzettelError(
        400,
        'validation',
        'expected muss { correction, reason } sein.'
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
    return { correction, reason }
  }

  /**
   * W4-verify r4 (lost update): the PC opened the editor on „–“, the tablet
   * saved +5 meanwhile; the PC's +2 replaced it without a word. Now the
   * stored value must still be what the editor showed, else 409 with the
   * current value and who set it.
   */
  async function assertCorrectionUnchanged(
    row: BackzettelLine | null,
    expected: { correction: number; reason: string | null },
    transaction: Transaction
  ) {
    const current = row ? toNumber(row.correction) : 0
    const currentReason =
      row && current !== 0 && row.correctionReason ? row.correctionReason : null
    const same =
      sameQty(current, expected.correction) &&
      (current === 0 || currentReason === expected.reason)
    if (same) return
    const users = await usersById([row?.correctionBy], transaction)
    const by = row ? userRef(users, row.correctionBy) : null
    const now =
      current === 0
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
          by,
        },
      }
    )
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
    await writeDraft(date, async (day, loadedNow, transaction) => {
      const where = { date, itemId, variant: line.variant }
      const row = await BackzettelLine.findOne({ where, transaction })
      if (parsed.value.correction < 0) {
        await assertCorrectionFits(
          date,
          day,
          loadedNow,
          { itemId, variant: line.variant, ...parsed.value },
          transaction
        )
      }
      const from = row
        ? {
            correction: toNumber(row.correction),
            reason: row.correctionReason,
          }
        : { correction: 0, reason: null }
      const to = {
        correction: parsed.value.correction,
        reason: parsed.value.reason,
      }
      if (from.correction === to.correction && from.reason === to.reason) return
      if (expected) await assertCorrectionUnchanged(row, expected, transaction)
      const values = {
        correction: to.correction,
        correctionReason: to.reason,
        correctionBy: to.correction === 0 ? null : req.user?.id ?? null,
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
        { itemId, variant: line.variant, from, to },
        { transaction }
      )
    })
    return getDay(date)
  }

  async function confirm(date: string, req: Request) {
    await writeDraft(date, async (day, loaded, transaction) => {
      const weekday = core.isoWeekday(date)
      const [snapshot, templates, rows] = await Promise.all([
        loadPreorderSnapshot(date, transaction),
        loadCapTemplates(weekday, transaction),
        BackzettelLine.findAll({ where: { date }, transaction }),
      ])
      const result = computeDraft(loaded, date, {
        snapshot,
        templates,
        rows,
        seasonFactor: toNumber(day.seasonFactor) || 1,
      })
      const rowsByKey = new Map(
        rows.map((r) => [
          core.lineKey(r.itemId, dayCore.apiVariant(r.variant)),
          r,
        ])
      )
      const keep = new Set<number>()
      const clearedTicks: Record<string, unknown>[] = []
      for (const values of dayCore.linesForConfirm(result.lines)) {
        const key = core.lineKey(
          values.itemId,
          dayCore.apiVariant(values.variant)
        )
        const row = rowsByKey.get(key)
        if (row) {
          // A tick from the previous confirmation stands if the line still
          // asks for the same quantity or less (W4-verify r3: baked 14, now
          // 12 needed - done); more needed clears it.
          const untick =
            row.doneAt !== null && !dayCore.tickStillValid(row, values)
          if (untick) {
            clearedTicks.push({
              itemId: row.itemId,
              variant: row.variant,
              doneBy: row.doneBy,
              doneAt:
                row.doneAt instanceof Date
                  ? row.doneAt.toISOString()
                  : row.doneAt ?? null,
              from: toNumber(row.total),
              to: values.total,
            })
          }
          await row.update(
            {
              ...values,
              correctionBy: values.correction === 0 ? null : row.correctionBy,
              ...(untick ? { doneAt: null, doneBy: null } : {}),
            },
            { transaction }
          )
          keep.add(row.id)
        } else {
          const created = await BackzettelLine.create(
            { date, ...values, correctionBy: null },
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
            total: l.total,
          })),
          preorderPositions: snapshot.length,
          removedLines: removed.map((r) => ({
            itemId: r.itemId,
            variant: r.variant,
          })),
          discardedDeltas: discarded,
          clearedTicks,
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
            preorderId: d.preorderId,
            qty: toNumber(d.qty),
            kind: d.kind,
            acknowledged: d.acknowledgedAt !== null,
          })),
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
        { date, itemId: line.itemId, variant: line.variant, total },
        { transaction }
      )
      return line
    })
    const users = await usersById([row.doneBy])
    return {
      id: row.id,
      date: row.date,
      itemId: row.itemId,
      variant: dayCore.apiVariant(row.variant),
      doneAt: row.doneAt,
      doneBy: userRef(users, row.doneBy),
    }
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
    getPrep,
    getConfig,
    setSeasonFactor,
    setCorrection,
    confirm,
    reopen,
    setDone,
    acknowledgeDelta,
    acknowledgeDeltas,
    recordPreorderDeltas,
    reconcileConfirmedDays,
    idle,
  }
}

export type BackzettelService = ReturnType<typeof createBackzettelService>
