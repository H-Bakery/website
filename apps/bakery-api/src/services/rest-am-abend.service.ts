/**
 * „Rest am Abend“ (roadmap §6 M4): count what is left at closing, and the
 * owner's evaluation. All rules and formulas are in
 * `rest-am-abend.core.js`; this file only reads and writes:
 *
 *   - the counts (`rest_counts`, serialised write transaction, `audit_log`),
 *   - the Backzettel day through the Z3 service (`getDay` - the same view the
 *     screens show, so „gebacken“ is exactly the frozen Gesamt plus the
 *     acknowledged Nachträge),
 *   - the cash-register reports through `reports-files.core.js` (the same
 *     reader as the archive and the Z4 reference).
 *
 * Errors are `BackzettelError`s (status, code, German message), answered by
 * the router with `sendError`.
 */
import type { Request } from 'express'
import * as path from 'path'
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { getSequelize, BackzettelDay, RestCount, User } from '../models'
import { BackzettelSource } from './backzettel-source'
import { BackzettelError, BackzettelService } from './backzettel.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./rest-am-abend.core')
const files = require('./reports-files.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface RestOptions {
  /** Cash-register reports (holds `converted/`); default `HQ_REPORTS_DIR`. */
  reportsDir?: string
  /** „Heute“ (Berlin) for tests; default from `now()`. */
  today?: string | (() => string)
  now?: () => Date
  log?: (...args: unknown[]) => void
  /**
   * After a save that changed something, with the new day view - `app.ts`
   * hands it to the hq snapshot writer (Z9 style, background, never fails
   * the save).
   */
  onCounted?: (view: RestDayView) => void
}

export interface UserRef {
  id: number
  displayName: string
}

// The core is plain JS; its answers are passed through as they are.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RestDayView = any

function toNumber(x: unknown): number {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
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

/** Stored counts as the core reads them (plain, numbers, user refs). */
async function loadRows(
  where: Record<string, unknown>,
  transaction?: Transaction
) {
  const rows = await RestCount.findAll({
    where,
    order: [['id', 'ASC']],
    transaction,
  })
  const users = await usersById(
    rows.map((r) => r.countedBy),
    transaction
  )
  return rows.map((r) => ({
    id: r.id,
    businessDate: r.businessDate,
    itemId: r.itemId,
    variant: r.variant || '',
    productId: r.productId || '',
    name: r.name,
    itemName: r.itemName,
    unit: r.unit,
    itemUnit: r.itemUnit,
    factor: toNumber(r.factor),
    qty: toNumber(r.qty),
    revision: r.revision,
    countedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    countedBy:
      r.countedBy === null || r.countedBy === undefined
        ? null
        : users.get(r.countedBy) ?? {
            id: r.countedBy,
            displayName: `#${r.countedBy}`,
          },
  }))
}

export function createRestService(
  source: BackzettelSource,
  backzettel: BackzettelService,
  options: RestOptions = {}
) {
  const reportsDir = path.resolve(
    options.reportsDir ??
      process.env['HQ_REPORTS_DIR'] ??
      path.join(process.cwd(), '..', 'hq', 'data', 'reports')
  )
  const now = options.now ?? (() => new Date())
  const today = (): string =>
    typeof options.today === 'function'
      ? options.today()
      : options.today || core.berlinToday(now())

  function assertDate(date: unknown): string {
    if (typeof date !== 'string' || !core.isCalendarDate(date)) {
      throw new BackzettelError(
        400,
        'invalid_date',
        `Ungültiges Datum „${String(date)}“; erwartet wird JJJJ-MM-TT.`
      )
    }
    return date
  }

  /** The Backzettel day view, or `null` (Ruhetag, no master data). */
  async function backzettelDay(date: string): Promise<RestDayView | null> {
    try {
      const day = await backzettel.getDay(date)
      return day && (day.status === 'confirmed' || day.status === 'draft')
        ? day
        : null
    } catch (error) {
      if (error instanceof BackzettelError) return null
      throw error
    }
  }

  /**
   * The confirmed Backzettel day in the light form (lines, deltas and their
   * oven figures only) - for evaluations over many days, where the full
   * screen view per day would be ~340 heavy reads for a year.
   */
  async function confirmedLines(date: string): Promise<RestDayView | null> {
    try {
      return await backzettel.getConfirmedLines(date)
    } catch (error) {
      if (error instanceof BackzettelError) return null
      throw error
    }
  }

  async function view(date: string): Promise<RestDayView> {
    const loaded = source.load()
    const rows = await loadRows({ businessDate: date })
    return core.buildDayView({
      date,
      today: today(),
      config: loaded.ok ? loaded.config : null,
      reasons: loaded.ok ? undefined : loaded.reasons,
      catalog: loaded.catalog,
      backzettel: await backzettelDay(date),
      rows,
    })
  }

  /** `GET /api/rest?date=` - default today (Berlin). */
  async function getDay(query: Record<string, unknown>) {
    const raw = query['date']
    if (Array.isArray(raw)) {
      throw new BackzettelError(
        400,
        'invalid_date',
        'date bitte nur einmal angeben.'
      )
    }
    const date =
      raw === undefined || raw === '' ? today() : assertDate(String(raw))
    return view(date)
  }

  /**
   * `PUT /api/rest/:date` - a batch of counts for one day. All or nothing:
   * a stale `expected` anywhere is 409 `rest_changed` and nothing is saved.
   */
  async function saveDay(dateParam: string, body: unknown, req: Request) {
    const date = assertDate(dateParam)
    const loaded = source.load()
    if (!loaded.ok) {
      throw new BackzettelError(
        409,
        'no_config',
        'Die Backzettel-Stammdaten fehlen oder sind ungültig; ohne sie gibt es keine Zählliste.',
        { reasons: loaded.reasons }
      )
    }
    const day = today()
    const from = core.addDays(day, -core.COUNT_DAYS_BACK)
    if (date > day) {
      throw new BackzettelError(
        400,
        'date_out_of_range',
        'Dieser Tag liegt in der Zukunft - gezählt wird bei Ladenschluss.'
      )
    }
    if (date < from) {
      throw new BackzettelError(
        400,
        'date_out_of_range',
        `Zählungen lassen sich nur bis ${core.COUNT_DAYS_BACK} Tage zurück erfassen oder korrigieren.`
      )
    }
    const weekday = core.isoWeekday(date)
    if (!loaded.config.days.includes(weekday)) {
      throw new BackzettelError(
        409,
        'ruhetag',
        'An einem Ruhetag gibt es keinen Rest zu zählen.',
        { weekday }
      )
    }
    // A Posten with Sorten counted without one is only valid when the day's
    // Backzettel itself has such a line - read it only in that case.
    const candidates: Set<string> = core.emptyVariantCandidates(
      body,
      loaded.config
    )
    const emptyVariantItems =
      candidates.size > 0
        ? core.emptyVariantLines(await backzettelDay(date), loaded.config)
        : undefined
    const parsed = core.validateBatch(body, {
      config: loaded.config,
      catalog: loaded.catalog,
      emptyVariantItems,
    })
    if (!parsed.ok) {
      throw new BackzettelError(parsed.status, parsed.error, parsed.message)
    }
    const userId = req.user?.id ?? null
    const result = await getSequelize().transaction(async (transaction) => {
      const stored = await loadRows({ businessDate: date }, transaction)
      const plan = core.planBatch(parsed.entries, stored)
      if (plan.conflicts.length > 0) {
        const current = plan.conflicts.map((c: any) => ({
          itemId: c.entry.itemId,
          variant: c.entry.variant || null,
          productId: c.entry.productId || null,
          name: c.entry.name,
          qty: c.current ? c.current.qty : null,
          countedBy: c.current ? c.current.countedBy : null,
          countedAt: c.current ? c.current.countedAt : null,
        }))
        const first = current[0]
        const who = first.countedBy ? ` von ${first.countedBy.displayName}` : ''
        throw new BackzettelError(
          409,
          'rest_changed',
          `„${first.name}“ wurde inzwischen${who} ${
            first.qty === null
              ? 'gelöscht'
              : `auf ${String(first.qty).replace('.', ',')} gesetzt`
          }${
            current.length > 1 ? ` (und ${current.length - 1} weitere)` : ''
          }. Nichts wurde gespeichert - bitte prüfen und erneut speichern.`,
          { current }
        )
      }
      const changes: unknown[] = []
      for (const change of plan.changes) {
        const e = change.entry
        const where = {
          businessDate: date,
          itemId: e.itemId,
          variant: e.variant,
          productId: e.productId,
        }
        if (e.qty === null) {
          await RestCount.destroy({ where, transaction })
        } else if (change.current) {
          await RestCount.update(
            {
              qty: e.qty,
              name: e.name,
              itemName: e.itemName,
              unit: e.unit,
              itemUnit: e.itemUnit,
              factor: e.factor,
              revision: (change.current.revision || 1) + 1,
              countedBy: userId,
            },
            { where, transaction }
          )
        } else {
          await RestCount.create(
            {
              ...where,
              qty: e.qty,
              name: e.name,
              itemName: e.itemName,
              unit: e.unit,
              itemUnit: e.itemUnit,
              factor: e.factor,
              countedBy: userId,
            },
            { transaction }
          )
        }
        changes.push({
          itemId: e.itemId,
          variant: e.variant,
          productId: e.productId,
          from: change.from,
          to: e.qty,
          ...(change.from !== null ? { correction: true } : {}),
        })
      }
      if (changes.length > 0) {
        await audit(
          req,
          'rest_count',
          'rest_day',
          date,
          { changes },
          { transaction }
        )
      }
      return { changed: changes.length }
    })
    const next = await view(date)
    if (result.changed > 0 && options.onCounted) {
      try {
        options.onCounted(next)
      } catch (error) {
        options.log?.('Rest-Schnappschuss nicht gestartet:', error)
      }
    }
    return { ...next, changed: result.changed }
  }

  /** `GET /api/rest/summary?from=&to=` (inhaber). */
  async function summary(query: Record<string, unknown>) {
    const day = today()
    const range = core.parseRange(query, day)
    if (!range.ok) {
      throw new BackzettelError(range.status, range.error, range.message)
    }
    const loaded = source.load()
    const rows = await loadRows({
      businessDate: { [Op.between]: [range.from, range.to] },
    })
    const confirmed = await BackzettelDay.findAll({
      where: {
        date: { [Op.between]: [range.from, range.to] },
        status: 'confirmed',
      },
      attributes: ['date'],
    })
    const available = files.reportsAvailable(reportsDir, options.log)
    const reportDates = new Set<string>(
      available ? files.listReportDates(reportsDir, options.log) : []
    )
    const days: Record<
      string,
      { backzettel: unknown; rows: unknown[]; report: unknown }
    > = {}
    const ensure = (date: string) => {
      if (!days[date]) days[date] = { backzettel: null, rows: [], report: null }
      return days[date]
    }
    for (const r of rows) ensure(r.businessDate).rows.push(r)
    for (const d of confirmed) {
      const entry = ensure(d.date)
      entry.backzettel = await confirmedLines(d.date)
      if (reportDates.has(d.date)) {
        entry.report = files.readDailyReport(reportsDir, d.date, options.log)
      }
    }
    return core.summarize({
      from: range.from,
      to: range.to,
      today: day,
      config: loaded.ok ? loaded.config : null,
      catalog: loaded.catalog,
      days,
      reportsAvailable: available,
    })
  }

  /** `GET /api/rest/summary.csv` - the same, as CSV. */
  async function summaryCsv(query: Record<string, unknown>) {
    const s = await summary(query)
    return {
      csv: core.summaryCsv(s),
      filename: `rest-am-abend-${s.from}-bis-${s.to}.csv`,
    }
  }

  /**
   * `GET /api/rest/averages?weeks=6` (inhaber, backstube): Rest Ø per item
   * and weekday next to the Z4 reference - information only.
   */
  async function averages(query: Record<string, unknown>) {
    const loaded = source.load()
    if (!loaded.ok) {
      return { status: 'no-config', reasons: loaded.reasons, weekdays: [] }
    }
    const raw = query['weeks']
    const text = raw === undefined || raw === '' ? '6' : String(raw).trim()
    const weeks = Number(text)
    if (!/^\d+$/.test(text) || weeks < 1 || weeks > 26) {
      throw new BackzettelError(
        400,
        'validation',
        'weeks muss eine ganze Zahl von 1 bis 26 sein.'
      )
    }
    const day = today()
    const from = core.addDays(day, -7 * 27)
    const rows = await loadRows({
      businessDate: { [Op.between]: [from, core.addDays(day, -1)] },
    })
    const rowsByDate: Record<string, unknown[]> = {}
    for (const r of rows) (rowsByDate[r.businessDate] ||= []).push(r)
    // Only days with a confirmed Backzettel count (as in the evaluation);
    // only days with counts need reading.
    const confirmed = await BackzettelDay.findAll({
      where: {
        date: { [Op.in]: Object.keys(rowsByDate) },
        status: 'confirmed',
      },
      attributes: ['date'],
    })
    const backzettelByDate: Record<string, unknown> = {}
    for (const d of confirmed) {
      backzettelByDate[d.date] = await confirmedLines(d.date)
    }
    return {
      status: 'ok',
      today: day,
      weeks,
      basis:
        'Mittlerer Rest am Abend in der Einheit des Postens, letzte gleiche Wochentage mit freigegebenem Backzettel und vollständiger Zählung; Tage ohne Zählung zählen nicht.',
      weekdays: core.weekdayRestAverages({
        config: loaded.config,
        catalog: loaded.catalog,
        today: day,
        weeks,
        weekdays: loaded.config.days,
        rowsByDate,
        backzettelByDate,
      }),
    }
  }

  return { getDay, saveDay, summary, summaryCsv, averages, view, reportsDir }
}

export type RestService = ReturnType<typeof createRestService>
