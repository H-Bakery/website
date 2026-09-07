/**
 * Typen der Tagesziel-Ampel (TASK-039), so wie sie die Endpunkte
 * `/api/finance/targets*` liefern.
 *
 * Spiegel von `apps/bakery-api/src/services/targets.core.js` - dort steht
 * die einzige Implementierung der Rechnung und der Ampel-Logik. Hier wird
 * nur beschrieben und angezeigt, nie gerechnet.
 */

export type TargetStatus = 'green' | 'amber' | 'red' | 'open'

export type OpenReason =
  | 'today'
  | 'future'
  | 'closed'
  | 'no-report'
  | 'no-days'
  | 'no-target'

export type TargetLevelKey = 'breakeven' | 'draw'

/** Ergebnis von `evaluateDay`: immer Zahl **und** Textlabel. */
export interface TargetEvaluation {
  status: TargetStatus
  label: string
  reason: OpenReason | null
  actual: number | null
  target: number | null
  /** Ist / Ziel, `null` wenn offen oder Ziel 0. */
  ratio: number | null
  diff: number | null
}

export interface TargetPeriodEvaluation extends TargetEvaluation {
  days_counted: number
}

export interface TargetProjection extends TargetEvaluation {
  remaining_days: number
  remaining_target: number
  month_target: number | null
  projected_actual: number | null
}

export interface TargetWeekday {
  /** ISO-Wochentag 1 = Montag … 7 = Sonntag */
  iso: number
  label: string
  short: string
  closed: boolean
  factor: number | null
  target: number | null
  average_revenue: number | null
  /** Ø Ist − Ziel, vom Server gerechnet; `null` ohne Ziel oder ohne Daten. */
  deviation: number | null
  samples: number
}

export interface TargetLevel {
  key: TargetLevelKey
  label: string
  /** true: die Stufe beruht auf einer nicht geklärten Annahme (Entnahme). */
  assumed: boolean
  fixed_costs_monthly: number
  breakeven_monthly: number
  pos_target_monthly: number
  daily_base: number
  /**
   * Ø Ist / Ziel - an allen Wochentagen derselbe Wert (Faktoren sind auf die
   * Wochentagsmittel normiert), deshalb einmal je Stufe statt je Zeile.
   */
  average_ratio: number | null
  weekdays: TargetWeekday[]
  private_draw_monthly?: number
  private_draw_source?: 'config' | 'derived' | 'none'
}

export interface TargetCostBase {
  status: 'ok' | 'no-target'
  reason?: string
  mode?: 'derived' | 'manual'
  window?: { from: string | null; to: string | null; months: number }
  fixed_costs_monthly?: number
  variable_costs_monthly?: number | null
  revenue_monthly?: number | null
  pos_revenue_monthly?: number | null
  variable_cost_ratio?: number
  contribution_ratio?: number
  non_pos_revenue_monthly?: number
  non_pos_source?: 'config' | 'subcategories' | 'none'
  private_draw_monthly?: number
  private_draw_source?: 'config' | 'derived' | 'none'
  assumptions?: string[]
}

export interface TargetFactors {
  status: 'ok' | 'no-target'
  reason?: string
  window?: { from: string; to: string; months: number }
  days_used?: number
  /** Mittel der Wochentagsmittel (Normierungsbasis der Faktoren). */
  mean_average_revenue?: number
  weekdays?: Array<{
    iso: number
    label: string
    short: string
    closed: boolean
    samples: number
    average_revenue: number | null
    factor: number | null
  }>
}

export interface TargetConfigInfo {
  mode: 'derived' | 'manual'
  /** Stand der Kostenbasis, `YYYY-MM-DD` */
  updated: string
  age_months: number
  stale: boolean
  stale_after_months: number
  business_days_per_month: number
  weekday_window_months: number
  cost_window_months: number | null
  thresholds: { green: number; amber: number }
  closed_weekdays: number[]
  variable_categories: string[]
}

/** `GET /api/finance/targets` */
export interface TargetsResponse {
  today: string
  last_evaluated_date: string | null
  config: TargetConfigInfo
  cost_base: TargetCostBase
  factors: TargetFactors
  levels: Record<TargetLevelKey, TargetLevel>
}

export interface TargetDay {
  date: string
  iso: number
  weekday: string
  short: string
  has_report: boolean
  actual: number | null
  levels: Record<TargetLevelKey, TargetEvaluation>
}

export interface TargetPeriod {
  status: 'ok'
  from: string
  to: string
  today: string
  last_evaluated_date: string | null
  days: TargetDay[]
  levels: Record<TargetLevelKey, TargetPeriodEvaluation>
}

export interface TargetWeek extends TargetPeriod {
  iso_week: string
}

export interface TargetMonth extends TargetPeriod {
  month: string
  month_end: string
  projection: Record<TargetLevelKey, TargetProjection>
}

export type TargetLevelsMeta = Record<
  TargetLevelKey,
  { key: TargetLevelKey; label: string; assumed: boolean }
>

/** `GET /api/finance/targets/status?date=` */
export interface TargetStatusResponse {
  today: string
  last_evaluated_date: string | null
  config: TargetConfigInfo
  thresholds: { green: number; amber: number }
  levels_meta: TargetLevelsMeta
  day: TargetDay
  week: TargetWeek
  month: TargetMonth
}

/** `GET /api/finance/targets/period?from=&to=` */
export interface TargetPeriodResponse extends TargetPeriod {
  config: TargetConfigInfo
  thresholds: { green: number; amber: number }
  levels_meta: TargetLevelsMeta
}

/** Ergebnis eines Aufrufs: Daten oder ehrlich "kein Ziel" - nie ein Schätzwert. */
export type TargetResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'no-target'; reason: string; partial?: Partial<TargetsResponse> }
