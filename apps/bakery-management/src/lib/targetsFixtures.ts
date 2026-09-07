/**
 * Synthetische Antworten der Tagesziel-Endpunkte für Tests. Alle Zahlen sind
 * erfunden und rund - nichts hiervon stammt aus dem privaten `hq`-Repo.
 * Nur in `*.spec.tsx` benutzen; die Seiten laden ihre Daten vom Server.
 */
import type {
  TargetDay,
  TargetEvaluation,
  TargetLevelKey,
  TargetPeriodResponse,
  TargetStatusResponse,
  TargetsResponse,
} from './targetsTypes'

const LABELS: Record<TargetEvaluation['status'], string> = {
  green: 'Ziel erreicht',
  amber: 'Knapp unter Ziel',
  red: 'Unter Ziel',
  open: 'Offen',
}

export function evaluation(
  actual: number | null,
  target: number | null,
  overrides: Partial<TargetEvaluation> = {}
): TargetEvaluation {
  if (actual === null || target === null) {
    return {
      status: 'open',
      label: 'Kein Bericht',
      reason: 'no-report',
      actual,
      target,
      ratio: null,
      diff: null,
      ...overrides,
    }
  }
  const ratio = actual / target
  const status = ratio >= 1 ? 'green' : ratio >= 0.9 ? 'amber' : 'red'
  return {
    status,
    label: LABELS[status],
    reason: null,
    actual,
    target,
    ratio: Math.round(ratio * 10000) / 10000,
    diff: Math.round((actual - target) * 100) / 100,
    ...overrides,
  }
}

function both(
  actual: number | null,
  target: number | null,
  overrides: Partial<TargetEvaluation> = {}
): Record<TargetLevelKey, TargetEvaluation> {
  return {
    breakeven: evaluation(actual, target, overrides),
    draw: evaluation(actual, target === null ? null : target * 1.25, overrides),
  }
}

const WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
]
const SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const FACTORS = [null, 0.9, 0.9, 1.0, 1.0, 1.5, 0.7]

export const CONFIG: TargetsResponse['config'] = {
  mode: 'derived',
  updated: '2026-05-01',
  age_months: 1,
  stale: false,
  stale_after_months: 6,
  business_days_per_month: 20,
  weekday_window_months: 3,
  cost_window_months: 3,
  thresholds: { green: 1, amber: 0.9 },
  closed_weekdays: [1],
  variable_categories: ['wareneinsatz'],
}

function level(
  key: TargetLevelKey,
  base: number
): TargetsResponse['levels'][TargetLevelKey] {
  return {
    key,
    label:
      key === 'breakeven'
        ? 'Betriebsergebnis ausgeglichen'
        : 'Inklusive Entnahme',
    assumed: key === 'draw',
    fixed_costs_monthly: key === 'breakeven' ? 4000 : 5000,
    breakeven_monthly: base * 20 + 2000,
    pos_target_monthly: base * 20,
    daily_base: base,
    average_ratio: 1.1,
    weekdays: FACTORS.map((factor, i) => {
      const target =
        factor === null ? null : Math.round(base * factor * 100) / 100
      const average = factor === null ? null : Math.round(base * factor * 1.1)
      return {
        iso: i + 1,
        label: WEEKDAYS[i],
        short: SHORT[i],
        closed: i === 0,
        factor,
        target,
        average_revenue: average,
        deviation:
          target === null || average === null
            ? null
            : Math.round((average - target) * 100) / 100,
        samples: factor === null ? 0 : 12,
      }
    }),
    ...(key === 'draw'
      ? { private_draw_monthly: 1000, private_draw_source: 'derived' as const }
      : {}),
  }
}

export function syntheticTargets(
  overrides: Partial<TargetsResponse> = {}
): TargetsResponse {
  return {
    today: '2026-06-03',
    last_evaluated_date: '2026-06-02',
    config: CONFIG,
    cost_base: {
      status: 'ok',
      mode: 'derived',
      window: { from: '2026-03', to: '2026-05', months: 3 },
      fixed_costs_monthly: 4000,
      variable_costs_monthly: 3000,
      revenue_monthly: 10000,
      pos_revenue_monthly: 8000,
      variable_cost_ratio: 0.3,
      contribution_ratio: 0.7,
      non_pos_revenue_monthly: 2000,
      non_pos_source: 'subcategories',
      private_draw_monthly: 1000,
      private_draw_source: 'derived',
      assumptions: ['Privatentnahme ist abgeleitet.'],
    },
    factors: {
      status: 'ok',
      window: { from: '2026-03-03', to: '2026-06-02', months: 3 },
      days_used: 72,
      mean_average_revenue: 200,
      weekdays: FACTORS.map((factor, i) => ({
        iso: i + 1,
        label: WEEKDAYS[i],
        short: SHORT[i],
        closed: i === 0,
        samples: factor === null ? 0 : 12,
        average_revenue: factor === null ? null : 200 * factor,
        factor,
      })),
    },
    levels: { breakeven: level('breakeven', 200), draw: level('draw', 250) },
    ...overrides,
  }
}

export function syntheticDay(
  date: string,
  actual: number | null,
  target: number | null,
  overrides: Partial<TargetEvaluation> = {}
): TargetDay {
  const iso = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1
  return {
    date,
    iso,
    weekday: WEEKDAYS[iso - 1],
    short: SHORT[iso - 1],
    has_report: actual !== null,
    actual,
    levels: both(actual, target, overrides),
  }
}

const LEVELS_META: TargetStatusResponse['levels_meta'] = {
  breakeven: {
    key: 'breakeven',
    label: 'Betriebsergebnis ausgeglichen',
    assumed: false,
  },
  draw: { key: 'draw', label: 'Inklusive Entnahme', assumed: true },
}

export function syntheticStatus(
  overrides: Partial<TargetStatusResponse> = {}
): TargetStatusResponse {
  const day = syntheticDay('2026-06-02', 190, 180)
  const periodLevels = (actual: number, target: number, days: number) => ({
    breakeven: { ...evaluation(actual, target), days_counted: days },
    draw: { ...evaluation(actual, target * 1.25), days_counted: days },
  })
  return {
    today: '2026-06-03',
    last_evaluated_date: '2026-06-02',
    config: CONFIG,
    thresholds: { green: 1, amber: 0.9 },
    levels_meta: LEVELS_META,
    day,
    week: {
      status: 'ok',
      from: '2026-06-01',
      to: '2026-06-02',
      today: '2026-06-03',
      last_evaluated_date: '2026-06-02',
      iso_week: '2026-W23',
      days: [syntheticDay('2026-06-01', null, null), day],
      levels: periodLevels(190, 180, 1),
    },
    month: {
      status: 'ok',
      month: '2026-06',
      month_end: '2026-06-30',
      from: '2026-06-01',
      to: '2026-06-02',
      today: '2026-06-03',
      last_evaluated_date: '2026-06-02',
      days: [syntheticDay('2026-06-01', null, null), day],
      levels: periodLevels(190, 180, 1),
      projection: {
        breakeven: {
          ...evaluation(4222, 4000),
          remaining_days: 24,
          remaining_target: 3820,
          month_target: 4000,
          projected_actual: 4222,
        },
        draw: {
          ...evaluation(4222, 5000),
          remaining_days: 24,
          remaining_target: 4775,
          month_target: 5000,
          projected_actual: 4222,
        },
      },
    },
    ...overrides,
  }
}

export function syntheticPeriod(
  overrides: Partial<TargetPeriodResponse> = {}
): TargetPeriodResponse {
  const days = [
    syntheticDay('2026-05-30', 330, 300),
    syntheticDay('2026-05-31', 120, 140),
    syntheticDay('2026-06-01', null, null, {
      reason: 'closed',
      label: 'Ruhetag',
    }),
    syntheticDay('2026-06-02', 190, 180),
    syntheticDay('2026-06-03', null, 180, {
      reason: 'today',
      label: 'Laufender Tag',
    }),
  ]
  return {
    status: 'ok',
    from: '2026-05-30',
    to: '2026-06-03',
    today: '2026-06-03',
    last_evaluated_date: '2026-06-02',
    days,
    levels: {
      breakeven: { ...evaluation(640, 620), days_counted: 3 },
      draw: { ...evaluation(640, 775), days_counted: 3 },
    },
    config: CONFIG,
    thresholds: { green: 1, amber: 0.9 },
    levels_meta: LEVELS_META,
    ...overrides,
  }
}
