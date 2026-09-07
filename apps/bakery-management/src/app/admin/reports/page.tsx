import React from 'react'
import {
  clampReportRange,
  isValidReportDate,
  listDailyReports,
  listReportDates,
  maxReportRangeDays,
  shiftDate,
} from '../../../lib/reports'
import { todayIso } from '../../../lib/reportFormat'
import ReportsArchiveClient from './ReportsArchiveClient'

/**
 * Berichtsarchiv: die Kassenberichte aus `hq/data/reports/converted`.
 *
 * Server-Komponente - liest über `lib/reports.ts` das Dateisystem und reicht
 * das Ergebnis an die Client-Komponente weiter. Der Zeitraum steht in der URL
 * (`?from=&to=`), damit die Liste verlinkbar bleibt und der Server bei jedem
 * Wechsel neu liest; ohne Parameter: die letzten 30 Tage bis zum jüngsten
 * Tag mit Bericht. Länger als `MAX_RANGE_DAYS` (Core) wird der Zeitraum nie -
 * die URL ist frei tippbar, und ein Tippfehler im Jahr würde sonst jedes
 * Tagesfile lesen und tausende Zeilen rendern.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value

  const dates = listReportDates()
  const latest = dates.length > 0 ? dates[dates.length - 1] : todayIso()

  const toParam = first(query['to'])
  const fromParam = first(query['from'])
  let to = isValidReportDate(toParam) ? toParam : latest
  let from = isValidReportDate(fromParam) ? fromParam : shiftDate(to, -29)
  if (from > to) [from, to] = [to, from]
  const range = clampReportRange(from, to)

  const list = listDailyReports(range.from, range.to)

  return (
    <ReportsArchiveClient
      list={list}
      latestDate={dates.length > 0 ? latest : null}
      earliestDate={dates.length > 0 ? dates[0] : null}
      requestedFrom={range.truncated ? from : null}
      maxRangeDays={maxReportRangeDays()}
    />
  )
}
