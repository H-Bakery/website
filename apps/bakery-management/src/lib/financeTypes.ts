/**
 * Typen der Finanzdaten, so wie sie **bereinigt** den Server verlassen.
 *
 * Spiegel von `apps/bakery-api/src/services/finance.core.js` - dort steht die
 * einzige Implementierung des Sanitizers und der Formeln. Was hier nicht
 * steht (`accounts`, `top_counterparties`, `uncategorized.transactions`), gibt
 * es absichtlich nicht: Kontonummern, Klarnamen und Einzelbuchungen bleiben im
 * privaten `hq`-Repo.
 *
 * Beträge sind Euro als `number`, Abflüsse negativ. Das Vorzeichen wird in der
 * Oberfläche nie gedreht.
 */

export type CategoryKind = 'einnahme' | 'ausgabe' | 'neutral' | 'offen'

export interface FinanceBucket {
  /** Netto (income + expense). */
  amount: number
  count: number
  /** Summe der Zuflüsse. */
  income: number
  /** Summe der Abflüsse (negativ). */
  expense: number
}

export interface FinanceMonth {
  /** `YYYY-MM` */
  month: string
  transactions: number
  operating_income: number
  /** negativ */
  operating_expense: number
  operating_result: number
  /** Geldtransit, Darlehen, Privat */
  neutral: number
  /** Kontoveränderung im Monat */
  net_change: number
  categories: Record<
    string,
    FinanceBucket & { subcategories: Record<string, number> }
  >
}

/** Bereinigtes `finance-summary.json`. */
export interface FinanceSummary {
  generated_at: string | null
  schema_version: 1
  period: { from: string | null; to: string | null }
  transaction_count: number
  category_labels: Record<string, string>
  category_kinds: Record<string, CategoryKind | string>
  subcategory_labels: Record<string, string>
  totals: Record<string, FinanceBucket>
  months: FinanceMonth[]
  /** Nur Anzahl und Betrag - die Buchungen selbst bleiben in `hq`. */
  uncategorized: { count: number; amount: number }
}

/** Ein Punkt der Monatsreihe (`GET /api/finance/months`). */
export interface FinanceMonthPoint {
  month: string
  transactions: number
  income: number
  /** negativ */
  expense: number
  result: number
  neutral: number
  net_change: number
}

export interface FinanceOverview {
  months: number
  from: string | null
  to: string | null
  transactions: number
  income: number
  expense: number
  result: number
  neutral: number
  net_change: number
}

export interface FinanceStructureRow extends FinanceBucket {
  category: string
  label: string
  kind: CategoryKind | string
  /** Anteil 0..1 am Gesamtabfluss bzw. -zufluss. */
  share: number
}

export interface FinanceInvariantViolation {
  month: string | null
  rule: string
  expected: number
  actual: number
  diff: number
}

export interface FinanceInvariant {
  ok: boolean
  violations: FinanceInvariantViolation[]
}

/** Antwort von `GET /api/finance/summary`: Zusammenfassung plus Ableitungen. */
export interface FinanceSummaryResponse extends FinanceSummary {
  derived: {
    overview: FinanceOverview
    series: FinanceMonthPoint[]
    cost_structure: FinanceStructureRow[]
    income_structure: FinanceStructureRow[]
    invariant: FinanceInvariant
  }
}

/** Antwort von `GET /api/finance/months`. */
export interface FinanceMonthsResponse {
  from: string | null
  to: string | null
  generated_at: string | null
  months: FinanceMonthPoint[]
  overview: FinanceOverview
  cost_structure: FinanceStructureRow[]
  income_structure: FinanceStructureRow[]
}

/** Ergebnis eines Loaders: Daten oder ehrlich "keine Daten" - nie Beispielwerte. */
export type FinanceResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'no-data'; reason: string }

// ---------------------------------------------------------------------------
// Jahresabschluss und Monatsanalyse (`GET /api/finance/year[/:year]`,
// `GET /api/finance/month[/:month]`). Spiegel von `buildYearReport()` und
// `buildMonthReport()` in `apps/bakery-api/src/services/finance-report.core.js`
// - dort steht jede Formel und jeder Hinweistext; die App zeigt nur an.
// ---------------------------------------------------------------------------

export interface FinanceReportSubcategory {
  key: string
  label: string
  amount: number
}

export interface FinanceReportRow extends FinanceBucket {
  category: string
  label: string
  kind: CategoryKind | string
  /** Anteil 0..1 an allen Zuflüssen (Einnahmen) bzw. Abflüssen (Ausgaben). */
  share?: number
  subcategories: FinanceReportSubcategory[]
  /** Nur Monatsanalyse: Ø der vollständigen Monate davor (`null` = keiner). */
  average?: number | null
  /** Nur Monatsanalyse: `amount - average` (`null` ohne Ø). */
  diff?: number | null
}

export interface FinanceReportSection {
  total: number
  rows: FinanceReportRow[]
}

/** Einnahmen-Überschuss-Gliederung eines Zeitraums. */
export interface FinanceStatement {
  income: FinanceReportSection
  /** inkl. „nicht zugeordnet“ (kind `offen`) */
  expense: FinanceReportSection
  result: number
  neutral: FinanceReportSection
  net_change: number
  transactions: number
  unassigned: { amount: number; count: number }
}

/** Monats- bzw. Jahressumme der Kasse (Tagesabschlüsse). */
export interface FinanceKasse {
  revenue: number
  /** Tage mit Kassenbericht (Öffnungstage) */
  days: number
  avg_day: number
  receipts: number
  cash: number
  card: number
  unpaid: number
}

/** Kasse gegen Konto (bar und Karte). */
export interface FinanceReconciliation {
  kasse_revenue: number
  kasse_cash: number
  kasse_card: number
  kasse_days: number
  bank_cash: number
  bank_card: number
  diff_cash: number
  diff_card: number
  diff_total: number
  /** Kasse bar + Karte */
  kasse_total: number
  /** Konto bar + Karte */
  bank_total: number
  /** Nur im Jahresabschluss: über welche vollständigen Monate verglichen wurde. */
  months?: number
  from?: string
  to?: string
}

export interface FinanceReportNote {
  key: string
  severity: 'info' | 'warning'
  text: string
}

export type FinanceMonthCoverageStatus = 'complete' | 'partial' | 'missing'

export interface FinanceYearMonthRow {
  /** `JJJJ-MM` */
  month: string
  /** Monatsname, z. B. „Oktober“ */
  label: string
  coverage: FinanceMonthCoverageStatus
  /** Letzter Tag mit Bankdaten in diesem Monat (`null` bei `missing`). */
  covered_to: string | null
  income: number
  expense: number
  result: number
  neutral: number
  net_change: number
  transactions: number
  has_data: boolean
  kasse: FinanceKasse | null
}

export interface FinanceProjection {
  income: number
  expense: number
  result: number
  basis: { month: string; source: string; fraction: number }[]
  average_window: { from: string; to: string; months: number } | null
  /** Rechenweg als Satz (deutsch, vom Server). */
  method: string
}

export type FinanceYearStatus = 'final' | 'provisional' | 'incomplete'

/** Antwort von `GET /api/finance/year[/:year]` (`data`). */
export interface FinanceYearReport {
  year: string
  status: FinanceYearStatus
  /** Letzter Tag mit Bankdaten (`JJJJ-MM-TT`). */
  as_of: string | null
  generated_at: string | null
  today: string | null
  coverage: {
    from: string
    to: string
    data_from: string | null
    data_to: string | null
    complete_months: number
    missing_before: string[]
  }
  statement: FinanceStatement
  /** Immer 12 Zeilen, Januar bis Dezember. */
  months: FinanceYearMonthRow[]
  kasse: FinanceKasse | null
  reconciliation: FinanceReconciliation | null
  projection: FinanceProjection | null
  projection_reason: string | null
  notes: FinanceReportNote[]
  /** Jahre mit Bankdaten, jüngstes zuerst. */
  years: string[]
  previous_year: string | null
  next_year: string | null
}

export interface FinanceMonthCoverage {
  status: FinanceMonthCoverageStatus
  from: string | null
  to: string | null
  days: number
  days_in_month: number
}

export interface FinanceMonthComparison {
  month: string
  label: string
  income: number
  expense: number
  result: number
  /** jetziger Monat minus Vergleichsmonat */
  diff_income: number
  diff_expense: number
  diff_result: number
}

export interface FinanceMonthAverage {
  months: number
  from: string
  to: string
  income: number
  expense: number
  result: number
  /** jetziger Monat minus Ø */
  diff_income: number
  diff_expense: number
  diff_result: number
}

/**
 * Warum `highlights` leer sein kann: `partial` (Monat angebrochen),
 * `too_few_months` (weniger als `highlights_min_months` volle Monate davor),
 * `null` (verglichen, nichts gefunden).
 */
export type FinanceHighlightsReason = 'partial' | 'too_few_months' | null

export type FinanceHighlightKind =
  | 'expense_high'
  | 'expense_new'
  | 'expense_missing'
  | 'income_low'
  | 'income_high'

export interface FinanceHighlight {
  kind: FinanceHighlightKind | string
  category: string | null
  label: string
  amount: number
  average: number
  ratio?: number
  /** Fertiger deutscher Satz vom Server. */
  text: string
}

/** Antwort von `GET /api/finance/month[/:month]` (`data`). */
export interface FinanceMonthReport {
  month: string
  /** „Oktober 2026“ */
  label: string
  coverage: FinanceMonthCoverage
  generated_at: string | null
  income: number
  expense: number
  result: number
  neutral: number
  net_change: number
  transactions: number
  statement: FinanceStatement
  kasse: FinanceKasse | null
  kasse_previous_year: FinanceKasse | null
  /** Nur für vollständige Monate. */
  reconciliation: FinanceReconciliation | null
  /** Bei angebrochenen Monaten alle drei `null`. */
  comparison: {
    previous_month: FinanceMonthComparison | null
    previous_year: FinanceMonthComparison | null
    average: FinanceMonthAverage | null
  }
  highlights: FinanceHighlight[]
  highlights_reason: FinanceHighlightsReason
  /** Ab so vielen vollen Vergleichsmonaten gibt es Auffälligkeiten. */
  highlights_min_months: number
  notes: FinanceReportNote[]
  previous_month: string | null
  next_month: string | null
  /** Monate mit Bankdaten, jüngster zuerst. */
  months: string[]
}
