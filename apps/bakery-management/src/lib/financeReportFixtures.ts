/**
 * Erfundene Antworten von `/api/finance/year` und `/api/finance/month` für
 * Specs. Das Repo ist öffentlich: hier steht nie ein echter Betrag - alle
 * Zahlen sind runde Phantasiewerte, die nur in sich ungefähr aufgehen.
 */
import type {
  FinanceKasse,
  FinanceMonthReport,
  FinanceStatement,
  FinanceYearMonthRow,
  FinanceYearReport,
} from './financeTypes'

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function kasse(revenue: number, days: number): FinanceKasse {
  return {
    revenue,
    days,
    avg_day: Math.round((revenue / days) * 100) / 100,
    receipts: days * 90,
    cash: Math.round(revenue * 0.6),
    card: Math.round(revenue * 0.4),
    unpaid: 0,
  }
}

function yearStatement(): FinanceStatement {
  return {
    income: {
      total: 96000,
      rows: [
        {
          category: 'umsatz',
          label: 'Umsatz',
          kind: 'einnahme',
          amount: 90000,
          count: 400,
          income: 90000,
          expense: 0,
          share: 0.938,
          subcategories: [
            { key: 'bar', label: 'Bareinzahlungen', amount: 50000 },
            { key: 'karte', label: 'Kartenzahlungen', amount: 38000 },
            { key: 'sonstige', label: 'Sonstige', amount: 2000 },
          ],
        },
        {
          category: 'partner',
          label: 'Verkaufspartner',
          kind: 'einnahme',
          amount: 6000,
          count: 9,
          income: 6000,
          expense: 0,
          share: 0.062,
          subcategories: [],
        },
      ],
    },
    expense: {
      total: -80000,
      rows: [
        {
          category: 'wareneinkauf',
          label: 'Wareneinkauf',
          kind: 'ausgabe',
          amount: -40000,
          count: 120,
          income: 0,
          expense: -40000,
          share: 0.5,
          subcategories: [
            { key: 'mehl', label: 'Mehl und Getreide', amount: -25000 },
            { key: 'sonstige', label: 'Sonstige', amount: -15000 },
          ],
        },
        {
          category: 'personal',
          label: 'Personal',
          kind: 'ausgabe',
          amount: -24000,
          count: 40,
          income: 0,
          expense: -24000,
          share: 0.3,
          subcategories: [],
        },
        {
          category: 'miete',
          label: 'Miete',
          kind: 'ausgabe',
          amount: -9600,
          count: 12,
          income: 0,
          expense: -9600,
          share: 0.12,
          subcategories: [],
        },
        {
          category: 'nicht_zugeordnet',
          label: 'Nicht zugeordnet',
          kind: 'offen',
          amount: -6400,
          count: 5,
          income: 0,
          expense: -6400,
          share: 0.08,
          subcategories: [],
        },
      ],
    },
    result: 16000,
    neutral: {
      total: -9000,
      rows: [
        {
          category: 'privat',
          label: 'Privat',
          kind: 'neutral',
          amount: -6000,
          count: 10,
          income: 0,
          expense: -6000,
          share: 0,
          subcategories: [],
        },
        {
          category: 'geldtransit',
          label: 'Geldtransit',
          kind: 'neutral',
          amount: -3000,
          count: 6,
          income: 0,
          expense: -3000,
          share: 0,
          subcategories: [],
        },
      ],
    },
    net_change: 7000,
    transactions: 602,
    unassigned: { amount: -6400, count: 5 },
  }
}

function yearMonths(year: string): FinanceYearMonthRow[] {
  return MONTH_NAMES.map((label, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`
    if (index < 9) {
      return {
        month,
        label,
        coverage: 'complete',
        covered_to: `${month}-28`,
        income: 10000,
        expense: -8400,
        result: 1600,
        neutral: -900,
        net_change: 700,
        transactions: 60,
        has_data: true,
        // März ohne Kassenberichte - die Spalte zeigt dann einen Strich.
        kasse: index === 2 ? null : kasse(9500, 22),
      }
    }
    if (index === 9) {
      return {
        month,
        label,
        coverage: 'partial',
        covered_to: `${month}-15`,
        income: 6000,
        expense: -4400,
        result: 1600,
        neutral: -900,
        net_change: 700,
        transactions: 62,
        has_data: true,
        kasse: kasse(4200, 11),
      }
    }
    return {
      month,
      label,
      coverage: 'missing',
      covered_to: null,
      income: 0,
      expense: 0,
      result: 0,
      neutral: 0,
      net_change: 0,
      transactions: 0,
      has_data: false,
      kasse: null,
    }
  })
}

/** Laufendes Jahr: vorläufig, Bankdaten bis Mitte Oktober, mit Hochrechnung. */
export function provisionalYearFixture(): FinanceYearReport {
  return {
    year: '2026',
    status: 'provisional',
    as_of: '2026-10-15',
    generated_at: '2026-10-16T06:00:00.000Z',
    today: null,
    coverage: {
      from: '2026-01',
      to: '2026-10',
      data_from: '2025-01-01',
      data_to: '2026-10-15',
      complete_months: 9,
      missing_before: [],
    },
    statement: yearStatement(),
    months: yearMonths('2026'),
    kasse: kasse(80200, 187),
    reconciliation: {
      kasse_revenue: 76000,
      kasse_cash: 44800,
      kasse_card: 31200,
      kasse_days: 176,
      bank_cash: 44000,
      bank_card: 31000,
      diff_cash: -800,
      diff_card: -200,
      diff_total: -1000,
      kasse_total: 76000,
      bank_total: 75000,
      months: 8,
      from: '2026-01',
      to: '2026-09',
    },
    projection: {
      income: 118000,
      expense: -98000,
      result: 20000,
      basis: [],
      average_window: { from: '2025-10', to: '2026-09', months: 12 },
      method:
        'Ist der abgeschlossenen Monate; für den Rest des Jahres derselbe Monat im Vorjahr, wo vorhanden, sonst der Durchschnitt der letzten 12 vollständigen Monate.',
    },
    projection_reason: null,
    notes: [
      {
        key: 'year_open',
        severity: 'info',
        text: 'Das Jahr ist noch nicht abgeschlossen: Bankdaten bis 15.10.2026. Alle Werte sind vorläufig.',
      },
      {
        key: 'unassigned',
        severity: 'warning',
        text: '5 Buchungen sind keiner Kategorie zugeordnet (−6.400,00 €).',
      },
      {
        key: 'cash_basis',
        severity: 'info',
        text: 'Gezählt wird, was über das Konto ging, nach Buchungsdatum – keine Bilanz.',
      },
    ],
    years: ['2026', '2025'],
    previous_year: '2025',
    next_year: null,
  }
}

/** Abgeschlossenes Vorjahr: alle zwölf Monate vollständig, keine Hochrechnung. */
export function finalYearFixture(): FinanceYearReport {
  const base = provisionalYearFixture()
  return {
    ...base,
    year: '2025',
    status: 'final',
    as_of: '2026-10-15',
    coverage: { ...base.coverage, from: '2025-01', to: '2025-12' },
    months: yearMonths('2025').map((row) => ({
      ...row,
      coverage: 'complete',
      covered_to: `${row.month}-28`,
      income: 9000,
      expense: -7500,
      result: 1500,
      has_data: true,
      kasse: kasse(8800, 22),
    })),
    statement: { ...yearStatement(), result: 18000 },
    projection: null,
    projection_reason: null,
    notes: [
      {
        key: 'cash_basis',
        severity: 'info',
        text: 'Gezählt wird, was über das Konto ging, nach Buchungsdatum – keine Bilanz.',
      },
    ],
    previous_year: null,
    next_year: '2026',
  }
}

/** Vollständiger Monat mit Auffälligkeiten und Vergleich. */
export function completeMonthFixture(): FinanceMonthReport {
  return {
    month: '2026-09',
    label: 'September 2026',
    coverage: {
      status: 'complete',
      from: '2026-09-01',
      to: '2026-09-30',
      days: 30,
      days_in_month: 30,
    },
    generated_at: '2026-10-16T06:00:00.000Z',
    income: 10000,
    expense: -8400,
    result: 1600,
    neutral: -1000,
    net_change: 600,
    transactions: 120,
    statement: {
      income: {
        total: 10000,
        rows: [
          {
            category: 'umsatz',
            label: 'Umsatz',
            kind: 'einnahme',
            amount: 9400,
            count: 40,
            income: 9400,
            expense: 0,
            share: 0.94,
            average: 9000,
            diff: 400,
            subcategories: [
              { key: 'bar', label: 'Bareinzahlungen', amount: 5200 },
              { key: 'karte', label: 'Kartenzahlungen', amount: 4100 },
              { key: 'sonstige', label: 'Sonstige', amount: 100 },
            ],
          },
          {
            category: 'partner',
            label: 'Verkaufspartner',
            kind: 'einnahme',
            amount: 600,
            count: 1,
            income: 600,
            expense: 0,
            share: 0.06,
            average: 650,
            diff: -50,
            subcategories: [],
          },
        ],
      },
      expense: {
        total: -8400,
        rows: [
          {
            category: 'wareneinkauf',
            label: 'Wareneinkauf',
            kind: 'ausgabe',
            amount: -4300,
            count: 14,
            income: 0,
            expense: -4300,
            share: 0.512,
            average: -4100,
            diff: -200,
            subcategories: [],
          },
          {
            category: 'personal',
            label: 'Personal',
            kind: 'ausgabe',
            amount: -2700,
            count: 4,
            income: 0,
            expense: -2700,
            share: 0.321,
            average: -2700,
            diff: 0,
            subcategories: [],
          },
          {
            category: 'reparatur',
            label: 'Reparaturen',
            kind: 'ausgabe',
            amount: -1000,
            count: 1,
            income: 0,
            expense: -1000,
            share: 0.119,
            average: -50,
            diff: -950,
            subcategories: [],
          },
          {
            category: 'nicht_zugeordnet',
            label: 'Nicht zugeordnet',
            kind: 'offen',
            amount: -400,
            count: 2,
            income: 0,
            expense: -400,
            share: 0.048,
            average: -300,
            diff: -100,
            subcategories: [],
          },
        ],
      },
      result: 1600,
      neutral: {
        total: -1000,
        rows: [
          {
            category: 'privat',
            label: 'Privat',
            kind: 'neutral',
            amount: -1000,
            count: 1,
            income: 0,
            expense: -1000,
            subcategories: [],
          },
        ],
      },
      net_change: 600,
      transactions: 120,
      unassigned: { amount: -400, count: 2 },
    },
    kasse: kasse(9600, 22),
    kasse_previous_year: kasse(9100, 21),
    reconciliation: {
      kasse_revenue: 9600,
      kasse_cash: 5400,
      kasse_card: 4200,
      kasse_days: 22,
      bank_cash: 5200,
      bank_card: 4100,
      diff_cash: -200,
      diff_card: -100,
      diff_total: -300,
      kasse_total: 9600,
      bank_total: 9300,
    },
    comparison: {
      previous_month: {
        month: '2026-08',
        label: 'August 2026',
        income: 9800,
        expense: -8100,
        result: 1700,
        diff_income: 200,
        diff_expense: -300,
        diff_result: -100,
      },
      previous_year: {
        month: '2025-09',
        label: 'September 2025',
        income: 9500,
        expense: -8000,
        result: 1500,
        diff_income: 500,
        diff_expense: -400,
        diff_result: 100,
      },
      average: {
        months: 12,
        from: '2025-09',
        to: '2026-08',
        income: 9700,
        expense: -8200,
        result: 1500,
        diff_income: 300,
        diff_expense: -200,
        diff_result: 100,
      },
    },
    highlights: [
      {
        kind: 'expense_new',
        category: 'reparatur',
        label: 'Reparaturen',
        amount: -1000,
        average: -50,
        text: 'Reparaturen: 1.000,00 € – in den 12 Monaten davor kam das kaum vor (einmalige Ausgabe?).',
      },
      {
        kind: 'expense_missing',
        category: 'miete',
        label: 'Miete',
        amount: 0,
        average: -800,
        text: 'Miete: diesen Monat keine Zahlung (sonst Ø 800,00 €) – kommt sie noch oder lief sie über ein anderes Konto?',
      },
    ],
    highlights_reason: null,
    highlights_min_months: 6,
    notes: [
      {
        key: 'unassigned',
        severity: 'warning',
        text: '2 Buchungen ohne Kategorie (−400,00 €).',
      },
    ],
    previous_month: '2026-08',
    next_month: '2026-10',
    months: ['2026-10', '2026-09', '2026-08', '2026-07'],
  }
}

/** Angebrochene Monate vergleicht der Server nicht: Ø und Abweichung `null`. */
function withoutAverages(statement: FinanceStatement): FinanceStatement {
  const strip = (rows: FinanceStatement['income']['rows']) =>
    rows.map((row) => ({ ...row, average: null, diff: null }))
  return {
    ...statement,
    income: { ...statement.income, rows: strip(statement.income.rows) },
    expense: { ...statement.expense, rows: strip(statement.expense.rows) },
  }
}

/** Laufender Monat: Bankdaten erst bis zur Monatsmitte. */
export function partialMonthFixture(): FinanceMonthReport {
  const base = completeMonthFixture()
  return {
    ...base,
    month: '2026-10',
    label: 'Oktober 2026',
    coverage: {
      status: 'partial',
      from: '2026-10-01',
      to: '2026-10-15',
      days: 15,
      days_in_month: 31,
    },
    statement: withoutAverages(base.statement),
    reconciliation: null,
    comparison: { previous_month: null, previous_year: null, average: null },
    highlights: [],
    highlights_reason: 'partial',
    notes: [
      {
        key: 'partial',
        severity: 'info',
        text: 'Der Monat ist noch nicht vollständig: Bankdaten vom 01.10.2026 bis 15.10.2026. Vergleiche und Auffälligkeiten gibt es erst, wenn er abgeschlossen ist.',
      },
    ],
    previous_month: '2026-09',
    next_month: null,
  }
}
