/**
 * „Abgleich Produktion ↔ Kasse“ (inhaber): gebacken − CAP − verkauft − Rest
 * je Backtag und Posten. All rules and formulas are in `abgleich.core.js`
 * (on top of `rest-am-abend.core.js` and the Z4 helpers); this file only
 * reads:
 *
 *   - the bake list of every bake day (`getBakeLines`, light) - confirmed
 *     or draft: a draft day counts with its planned values, marked
 *     „geplant“,
 *   - the Rest am Abend counts (`rest_counts`, read only),
 *   - the cash-register reports through `reports-files.core.js`.
 *
 * Errors are `BackzettelError`s (status, code, German message).
 */
import * as path from 'path'
import { Op } from 'sequelize'

import { mixedPaymentAttribute, Preorder } from '../models/Preorder'
import { PreorderItem } from '../models/PreorderItem'
import { BackzettelSource } from './backzettel-source'
import { BackzettelError, BackzettelService } from './backzettel.service'
import { loadRows, RestOptions } from './rest-am-abend.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./abgleich.core')
const files = require('./reports-files.core')
const dayCore = require('./backzettel-day.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export type AbgleichOptions = Pick<
  RestOptions,
  'reportsDir' | 'today' | 'now' | 'log'
>

// The core is plain JS; its answers are passed through as they are.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Abgleich = any

export function createAbgleichService(
  source: BackzettelSource,
  backzettel: BackzettelService,
  options: AbgleichOptions = {}
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

  /** The bake list of `date` (confirmed or draft), `null` if there is none. */
  async function bakeLines(date: string): Promise<Abgleich | null> {
    try {
      return await backzettel.getBakeLines(date, {
        light: true,
        includePreorderSources: true,
      })
    } catch (error) {
      if (error instanceof BackzettelError) return null
      throw error
    }
  }

  /** `GET /api/abgleich?from=&to=` (inhaber). */
  async function reconcile(query: Record<string, unknown>): Promise<Abgleich> {
    const day = today()
    const loaded = source.load()
    const config = loaded.ok ? loaded.config : null
    const range = core.parseRange(query, day, config)
    if (!range.ok) {
      throw new BackzettelError(range.status, range.error, range.message)
    }
    const choice = core.parseNextDaySections(query, config)
    if (!choice.ok) {
      throw new BackzettelError(choice.status, choice.error, choice.message)
    }
    const from = choice.sections.length
      ? core.addDays(range.from, -1)
      : range.from
    const end = choice.sections.length ? core.addDays(range.to, 1) : range.to
    const to = end < day ? end : day
    const dates: string[] = from <= to ? core.listDates(from, to) : []
    const rows = await loadRows({ businessDate: { [Op.between]: [from, to] } })
    const preorders =
      config && dates.length
        ? await Preorder.findAll({
            where: {
              pickupDate: { [Op.between]: [from, to] },
              status: { [Op.ne]: 'storniert' },
              externalPayment: true,
              notCollectedAt: null,
            },
            attributes: ['id', 'status', 'pickupDate', mixedPaymentAttribute],
            include: [
              {
                model: PreorderItem,
                as: 'items',
                attributes: ['productId', 'variant', 'quantity'],
              },
            ],
          })
        : []
    const mixedIds = new Set(
      preorders.filter((p) => p.get('mixedPayment')).map((p) => p.id)
    )
    const externalByDate = new Map<string, unknown[]>()
    for (const item of dayCore.snapshotFromPreorders(
      preorders.map((p) => p.get({ plain: true }))
    )) {
      const list = externalByDate.get(item.pickupDate) || []
      list.push({ ...item, mixedPayment: mixedIds.has(item.preorderId) })
      externalByDate.set(item.pickupDate, list)
    }
    const available = files.reportsAvailable(reportsDir, options.log)
    const reports: Record<string, unknown> = {}
    if (available) {
      for (const r of files.readDailyReportsInRange(
        reportsDir,
        from,
        to,
        options.log,
        { includeProductGroups: true }
      )) {
        reports[r.date] = r
      }
    }
    const days: Record<
      string,
      {
        backzettel: unknown
        rows: unknown[]
        report: unknown
        externalPreorders: unknown[]
      }
    > = {}
    for (const date of dates) {
      days[date] = {
        backzettel: config ? await bakeLines(date) : null,
        rows: [],
        report: reports[date] ?? null,
        externalPreorders: externalByDate.get(date) ?? [],
      }
    }
    for (const r of rows) days[r.businessDate]?.rows.push(r)
    return core.reconcile({
      from: range.from,
      to: range.to,
      today: day,
      config,
      catalog: loaded.catalog,
      days,
      reportsAvailable: available,
      folgetag: choice.sections,
    })
  }

  /** `GET /api/abgleich/csv` - the same, as CSV. */
  async function csv(query: Record<string, unknown>) {
    const s = await reconcile(query)
    return {
      csv: core.abgleichCsv(s) as string,
      filename: `abgleich-produktion-kasse-${s.from}-bis-${s.to}.csv`,
    }
  }

  return { reconcile, csv, reportsDir }
}

export type AbgleichService = ReturnType<typeof createAbgleichService>
