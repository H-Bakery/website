/**
 * `GET /api/backzettel/reference` (Z4): Median verkauft je Posten und
 * Wochentag aus den Kassenberichten (`hq/data/reports/converted`), über
 * die Kassennummern (`plu`) der Backzettel-Stammdaten. Nur Information -
 * nie in die Grundmenge übernommen. Die Regeln stehen in
 * `backzettel-reference.core.js`, das Lesen der Tagesdateien in
 * `reports-files.core.js` (dieselbe Schicht wie das Berichtsarchiv).
 *
 * Berichtsverzeichnis: `reportsDir` (createApp `hq.reportsDir`) →
 * `HQ_REPORTS_DIR` → `<cwd>/../hq/data/reports`.
 */
import * as path from 'path'

import { BackzettelSource } from './backzettel-source'
import { BackzettelError } from './backzettel.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const refCore = require('./backzettel-reference.core')
const files = require('./reports-files.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface BackzettelReferenceOptions {
  reportsDir?: string
  /** „Heute" (Tests); Default: Europa/Berlin. */
  today?: string | (() => string)
  log?: (...args: unknown[]) => void
}

export function createBackzettelReference(
  source: BackzettelSource,
  options: BackzettelReferenceOptions = {}
) {
  const reportsDir = path.resolve(
    options.reportsDir ??
      process.env['HQ_REPORTS_DIR'] ??
      path.join(process.cwd(), '..', 'hq', 'data', 'reports')
  )
  const today = () =>
    typeof options.today === 'function'
      ? options.today()
      : options.today || refCore.berlinToday()

  function get(query: Record<string, unknown>) {
    const loaded = source.load()
    if (!loaded.ok) {
      return {
        status: 'no-config' as const,
        reasons: loaded.reasons,
        available: false,
        weekdays: [],
      }
    }
    const weeks = refCore.parseWeeks(query['weeks'])
    if (!weeks.ok) throw new BackzettelError(400, 'validation', weeks.message)
    const weekdays = refCore.parseWeekdays(query['weekday'], loaded.config.days)
    if (!weekdays.ok) {
      throw new BackzettelError(400, 'invalid_weekday', weekdays.message)
    }
    const day = today()
    const available = files.reportsAvailable(reportsDir, options.log)
    const reportDates = new Set<string>(
      available ? files.listReportDates(reportsDir, options.log) : []
    )
    const cache = new Map<string, unknown>()
    const result = (weekdays.weekdays as number[]).map((weekday) => {
      const { dates, skipped } = refCore.referenceDates({
        weekday,
        today: day,
        weeks: weeks.weeks,
        hasReport: (d: string) => reportDates.has(d),
      })
      const reports: Record<string, unknown> = {}
      for (const d of dates) {
        if (!cache.has(d)) {
          cache.set(d, files.readDailyReport(reportsDir, d, options.log))
        }
        reports[d] = cache.get(d)
      }
      return refCore.computeWeekdayReference({
        config: loaded.config,
        weekday,
        weeks: weeks.weeks,
        dates,
        skipped,
        reports,
        catalog: loaded.catalog,
      })
    })
    return {
      status: 'ok' as const,
      available,
      today: day,
      weeks: weeks.weeks,
      basis:
        'Median verkauft (Kassennummern, mit dem Faktor des Backzettels in die Einheit des Postens umgerechnet), letzte gleiche Wochentage mit Kassenbericht; Tage ohne Bericht zählen nicht.',
      weekdays: result,
    }
  }

  return { get, reportsDir }
}
