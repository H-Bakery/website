/**
 * Kassenberichte aus `hq/data/reports/converted` für die Management-App.
 *
 * Server-only (liest das Dateisystem) - Seiten laden die Berichte als
 * Server-Komponente und reichen sie an die Client-Komponenten weiter, wie
 * `admin/products/page.tsx` mit `products.ts`.
 *
 * Pfad: `HQ_REPORTS_DIR` oder `<website>/../hq/data/reports`. Fehlt das
 * Verzeichnis (CI), wird einmal protokolliert und leer geantwortet - es gibt
 * bewusst keinen Fallback auf Beispieldaten: lieber „kein Bericht" als
 * erfundene Umsätze.
 *
 * Gerechnet wird **nicht** hier, sondern in
 * `apps/bakery-api/src/services/reports.core.js` (dependency-freies CommonJS),
 * derselben Datei, die der Mock-Server benutzt. Die Datei liegt in einer
 * anderen Nx-App; ein statischer Import wäre vom Modul-Grenzen-Lint verboten
 * (`Imports of apps are forbidden`) und würde von webpack gebündelt. Deshalb
 * wird sie zur Laufzeit über Nodes eigenes `require` geladen - genauso wie die
 * Tests in `libs/bakery-delivery-routing` den Tour-Core laden. Die Typen hier
 * beschreiben nur die Rückgaben; wer eine Formel ändert, ändert den Core.
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'node:module'

// --- Typen ---------------------------------------------------------------------

export interface PaymentBucket {
  amount: number
  count: number
}

export interface PaymentMix {
  /** `payment: 'Bar'` */
  cash: PaymentBucket
  /** `payment: 'Unbar'` - die Kasse nennt Kartenzahlung so. */
  card: PaymentBucket
  /** `payment: 'Keine'` - Gutscheineinlösung, 0-Euro-Bons */
  other: PaymentBucket
}

export interface ReportProduct {
  productId: string | null
  productName: string
  /** Nettomenge - kann durch Storno-Gegenbuchungen negativ sein. */
  quantity: number
  revenue: number
}

export interface ReportHour {
  hour: string
  revenue: number
  receiptCount: number
}

export interface ReportClosing {
  filename: string | null
  registerId: string | null
  reportNumber: number | null
  transactionCount: number
}

export interface DailyReportMissing {
  status: 'no-data'
  date: string
  weekday: string | null
}

export interface DailyReportSummary {
  status: 'ok'
  date: string
  weekday: string
  closings: ReportClosing[]
  closingCount: number
  revenue: number
  receiptCount: number
  avgReceipt: number
  stornoCount: number
  stornoAmount: number
  cancelledCount: number
  payments: PaymentMix
  cashShare: number
  cardShare: number
  firstReceipt: string | null
  lastReceipt: string | null
}

export interface DailyReport extends DailyReportSummary {
  products: ReportProduct[]
  hours: ReportHour[]
}

export type DailyReportResult = DailyReport | DailyReportMissing
export type DailyReportListEntry = DailyReportSummary | DailyReportMissing

export interface DayRef {
  date: string
  weekday: string
  revenue: number
  receiptCount: number
}

export interface WeekdayStats {
  weekday: string
  dayCount: number
  revenue: number
  receiptCount: number
  avgRevenue: number
}

export interface RangeReportMissing {
  status: 'no-data'
  from: string
  to: string
  dayCount: 0
  missingDays: string[]
}

export interface RangeReport {
  status: 'ok'
  from: string
  to: string
  dayCount: number
  missingDays: string[]
  revenue: number
  receiptCount: number
  avgReceipt: number
  avgDayRevenue: number
  stornoCount: number
  cancelledCount: number
  payments: PaymentMix
  cashShare: number
  cardShare: number
  bestDay: DayRef
  weakestDay: DayRef
  weekdays: WeekdayStats[]
  products: ReportProduct[]
}

export type RangeReportResult = RangeReport | RangeReportMissing

export type MonthlyReportResult = RangeReportResult & {
  month: string
  label: string | null
}

export interface DailyReportList {
  from: string
  to: string
  /** false, wenn das Berichtsverzeichnis fehlt - dann sind alle Tage Lücken. */
  available: boolean
  days: DailyReportListEntry[]
  summary: RangeReportResult
}

interface ReportsCore {
  isValidDate(value: unknown): boolean
  isValidMonth(value: unknown): boolean
  weekdayLabel(date: string): string
  listDates(from: string, to: string): string[]
  monthBounds(month: string): { from: string; to: string }
  addDays(date: string, n: number): string
  toDailySummary(report: DailyReportResult): DailyReportListEntry
  aggregateRange(
    from: string,
    to: string,
    reports: DailyReportResult[]
  ): RangeReportResult
  aggregateMonth(
    month: string,
    reports: DailyReportResult[]
  ): MonthlyReportResult
}

interface ReportsFiles {
  resolveReportsDir(monorepoRoot: string, env?: NodeJS.ProcessEnv): string
  reportsAvailable(reportsDir: string): boolean
  listReportDates(reportsDir: string): string[]
  readDailyReport(reportsDir: string, date: string): DailyReportResult
  readDailyReportsInRange(
    reportsDir: string,
    from: string,
    to: string
  ): DailyReport[]
}

// --- Core laden ------------------------------------------------------------------

function findMonorepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

const CORE_DIR = ['apps', 'bakery-api', 'src', 'services']

/** Von webpack bereitgestellt: Nodes echtes `require` statt des gebündelten. */
declare const __non_webpack_require__: NodeRequire | undefined

/**
 * Nodes eigenes `require`, nicht das von webpack: die Core-Dateien werden
 * nicht gebündelt, sondern zur Laufzeit aus dem Monorepo gelesen.
 *
 * Unter Next (webpack) heißt das `__non_webpack_require__`; ein
 * `createRequire(...)`-Aufruf würde webpack erkennen und seine Rückgabe durch
 * das gebündelte require ersetzen - genau das ist beim ersten Anlauf passiert.
 * Ohne Bundler (Jest, plain Node) tut es `createRequire`.
 */
function nativeRequire(root: string): NodeRequire {
  if (typeof __non_webpack_require__ === 'function') {
    return __non_webpack_require__
  }
  return createRequire(path.join(root, 'package.json'))
}

let loaded: { core: ReportsCore; files: ReportsFiles } | null = null

function loadCore() {
  if (loaded) return loaded
  const root = findMonorepoRoot()
  const nodeRequire = nativeRequire(root)
  const dir = path.join(root, ...CORE_DIR)
  loaded = {
    core: nodeRequire(path.join(dir, 'reports.core.js')) as ReportsCore,
    files: nodeRequire(path.join(dir, 'reports-files.core.js')) as ReportsFiles,
  }
  return loaded
}

export function getHQReportsDir(): string {
  return loadCore().files.resolveReportsDir(findMonorepoRoot())
}

// --- Loader ---------------------------------------------------------------------

/** Liegt das Berichtsverzeichnis vor? (Loggt beim ersten Fehlen.) */
export function reportsAvailable(): boolean {
  return loadCore().files.reportsAvailable(getHQReportsDir())
}

/** Ein Tag im Detail (`status: 'ok' | 'no-data'`), Positionen nach Produkt. */
export function getDailyReport(date: string): DailyReportResult {
  const { core, files } = loadCore()
  if (!core.isValidDate(date)) {
    return { status: 'no-data', date, weekday: null }
  }
  return files.readDailyReport(getHQReportsDir(), date)
}

/**
 * Alle Kalendertage von `from` bis `to`: Tage mit Bericht als Kennzahlen,
 * Tage ohne als `no-data` - eine Lücke, kein Umsatz 0.
 */
export function listDailyReports(from: string, to: string): DailyReportList {
  const { core, files } = loadCore()
  const dir = getHQReportsDir()
  const valid = core.isValidDate(from) && core.isValidDate(to) && from <= to
  const reports = valid ? files.readDailyReportsInRange(dir, from, to) : []
  const byDate = new Map(reports.map((r) => [r.date, r]))
  const days: DailyReportListEntry[] = valid
    ? core.listDates(from, to).map((date) => {
        const report = byDate.get(date)
        return report
          ? core.toDailySummary(report)
          : { status: 'no-data', date, weekday: core.weekdayLabel(date) }
      })
    : []
  return {
    from,
    to,
    available: files.reportsAvailable(dir),
    days,
    summary: core.aggregateRange(from, to, reports),
  }
}

/** Monatsaggregat samt den Tagen des Monats. */
export function getMonthlyReport(
  month: string
): MonthlyReportResult & { days: DailyReportListEntry[] } {
  const { core, files } = loadCore()
  if (!core.isValidMonth(month)) {
    return {
      status: 'no-data',
      month,
      label: null,
      from: '',
      to: '',
      dayCount: 0,
      missingDays: [],
      days: [],
    }
  }
  const { from, to } = core.monthBounds(month)
  const reports = files.readDailyReportsInRange(getHQReportsDir(), from, to)
  return {
    ...core.aggregateMonth(month, reports),
    days: reports.map((r) => core.toDailySummary(r)),
  }
}

/** Sortierte Liste aller Tage mit Bericht (leer ohne Verzeichnis). */
export function listReportDates(): string[] {
  return loadCore().files.listReportDates(getHQReportsDir())
}

/** Der jüngste Tag mit Bericht - für „Stand: <Tag>" auf dem Dashboard. */
export function getLatestDailyReport(): DailyReportResult | null {
  const dates = listReportDates()
  if (dates.length === 0) return null
  return getDailyReport(dates[dates.length - 1])
}

/** Datum um n Tage verschieben (für Vorgabe-Zeiträume in Seiten). */
export function shiftDate(date: string, days: number): string {
  return loadCore().core.addDays(date, days)
}

export function isValidReportDate(value: unknown): value is string {
  return loadCore().core.isValidDate(value)
}
