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
