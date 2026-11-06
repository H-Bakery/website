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
 *              reading the day records new preorder changes as
 *              backzettel_deltas (audited as a system action)
 *   reopen     (inhaber) back to draft; deltas are folded into the live
 *              draft and discarded, the audit log keeps them. A re-confirm
 *              that changes a line's quantity clears its tick.
 */
import type { Request } from 'express'
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import {
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

const CONFIRMED_MESSAGE =
  'Der Backzettel ist schon freigegeben. Änderungen nur nach „Wieder öffnen“ durch den Inhaber.'

function toNumber(x: unknown): number {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
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

async function usersById(ids: unknown[]): Promise<Map<number, UserRef>> {
  const wanted = [
    ...new Set(ids.filter((id): id is number => Number.isInteger(id))),
  ]
  if (wanted.length === 0) return new Map()
  const rows = await User.findAll({
    where: { id: wanted },
    attributes: ['id', 'displayName'],
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
    rows: BackzettelLine[]
    seasonFactor: number
  }
) {
  const result = core.computeDay({
    config: loaded.config,
    date,
    preorderItems: dayCore.toCorePreorderItems(inputs.snapshot, date),
    capTemplate: inputs.templates,
    corrections: dayCore.correctionsFromRows(
      inputs.rows.map((r) => r.get({ plain: true }))
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

export interface GetDayOptions {
  /** Persist new preorder deltas of a confirmed day (default true). */
  recordDeltas?: boolean
  req?: Request | null
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
        !!row && row.doneAt !== null && !dayCore.frozenQtyChanged(row, line)
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
    const [rows, deltaRows] = await Promise.all([
      BackzettelLine.findAll({ where: { date }, order: [['id', 'ASC']] }),
      BackzettelDelta.findAll({ where: { date }, order: [['id', 'ASC']] }),
    ])
    const users = await usersById([
      day.confirmedBy,
      ...rows.flatMap((r) => [r.correctionBy, r.doneBy]),
      ...deltaRows.map((d) => d.acknowledgedBy),
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
              attributes: ['id', 'code'],
            })
          ).map((p) => [p.id, p.code])
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
          d.preorderId === null ? null : codes.get(d.preorderId) ?? null,
        createdAt: d.createdAt,
        acknowledgedAt: d.acknowledgedAt,
        acknowledgedBy: userRef(users, d.acknowledgedBy),
      }
    })
    const deltaByKey = new Map<
      string,
      { qty: number; open: number; count: number }
    >()
    for (const d of deltas) {
      const e = deltaByKey.get(d.key) || { qty: 0, open: 0, count: 0 }
      e.qty = Math.round((e.qty + d.qty) * 100) / 100
      e.count += 1
      if (!d.acknowledgedAt) e.open += 1
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
      warnings,
      configStatus: loaded.ok ? ('ok' as const) : ('no-config' as const),
      configChangedSinceConfirm,
      ...(loaded.ok ? {} : { configReasons: loaded.reasons }),
    }
  }

  /**
   * Records preorder changes since confirmation as delta rows. The cheap
   * check runs outside the write queue; the real one is repeated inside the
   * serialised transaction (preorders and recorded deltas read there), so two
   * readers at once cannot record the same change twice.
   */
  async function syncDeltas(
    date: string,
    day: BackzettelDay,
    loaded: Loaded,
    req: Request | null
  ): Promise<void> {
    const reconcile = (
      current: PreorderSnapshotItem[],
      recorded: BackzettelDelta[],
      snapshot: unknown
    ) =>
      dayCore.reconcileDeltas({
        config: loaded.config,
        date,
        snapshot,
        current,
        recorded: recorded.map((r) => ({
          itemId: r.itemId,
          variant: r.variant,
          preorderId: r.preorderId,
          qty: toNumber(r.qty),
        })),
        catalog: loaded.catalog,
      })
    const quick = reconcile(
      await loadPreorderSnapshot(date),
      await BackzettelDelta.findAll({ where: { date } }),
      day.preorderSnapshot || []
    )
    if (quick.length === 0) return

    await getSequelize().transaction(async (transaction) => {
      const fresh = await BackzettelDay.findByPk(date, { transaction })
      if (!fresh || fresh.status !== 'confirmed') return
      const rows = reconcile(
        await loadPreorderSnapshot(date, transaction),
        await BackzettelDelta.findAll({ where: { date }, transaction }),
        fresh.preorderSnapshot || []
      )
      if (rows.length === 0) return
      const created = await BackzettelDelta.bulkCreate(
        rows.map((r: any) => ({ date, ...r })),
        { transaction }
      )
      // A system action: the reader only triggered the detection, the
      // change itself came from the preorder. createdAt = detected at.
      await audit(
        req,
        'deltas_recorded',
        'backzettel_day',
        date,
        {
          via: 'read',
          readerId: req?.user?.id ?? null,
          deltas: rows,
          ids: created.map((d) => d.id),
        },
        { transaction, userId: null }
      )
    })
  }

  // ------------------------------------------------------------- reads

  async function getDay(date: string, options: GetDayOptions = {}) {
    assertDate(date)
    const loaded = source.load()
    let day = await BackzettelDay.findByPk(date)
    if (day && day.status === 'confirmed') {
      if (loaded.ok && options.recordDeltas !== false) {
        await syncDeltas(date, day, loaded, options.req ?? null)
        day = (await BackzettelDay.findByPk(date)) ?? day
      }
      if (day.status === 'confirmed') return confirmedView(date, day, loaded)
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
    const day: any = await getDay(date, { recordDeltas: false })
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
    await writeDraft(date, async (day, _loaded, transaction) => {
      const from = toNumber(day.seasonFactor) || 1
      if (from === parsed.value) return
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
    return getDay(date, { recordDeltas: false })
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
    await writeDraft(date, async (_day, _loaded, transaction) => {
      const where = { date, itemId, variant: line.variant }
      const row = await BackzettelLine.findOne({ where, transaction })
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
    return getDay(date, { recordDeltas: false })
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
          // A tick from the previous confirmation only stands if the line
          // still asks for the same quantity.
          const untick =
            row.doneAt !== null && dayCore.frozenQtyChanged(row, values)
          if (untick) {
            clearedTicks.push({
              itemId: row.itemId,
              variant: row.variant,
              doneBy: row.doneBy,
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
    const confirmed = await getDay(date, { recordDeltas: false })
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
    if (hooks.onReopened) {
      try {
        hooks.onReopened(date, { role: req.user?.role ?? null })
      } catch (error) {
        console.error('[backzettel] onReopened hook failed:', error)
      }
    }
    return getDay(date, { recordDeltas: false })
  }

  async function setDone(
    date: string,
    lineIdRaw: string,
    done: boolean,
    req: Request
  ) {
    assertDate(date)
    const lineId = Number(lineIdRaw)
    if (!/^[1-9]\d*$/.test(lineIdRaw) || !Number.isSafeInteger(lineId)) {
      throw new BackzettelError(400, 'validation', 'Ungültige Zeilen-ID.')
    }
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
        throw new BackzettelError(404, 'not_found', 'Zeile nicht gefunden.')
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
        { date, itemId: line.itemId, variant: line.variant },
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
        throw new BackzettelError(404, 'not_found', 'Änderung nicht gefunden.')
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
  }
}

export type BackzettelService = ReturnType<typeof createBackzettelService>
