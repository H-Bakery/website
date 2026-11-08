/**
 * Datenaufbereitung für die Diagramme in Jahresabschluss und Monatsanalyse.
 *
 * Gerechnet wird hier nichts Neues: jede Zahl steht so in der API-Antwort
 * (`finance-report.core.js`). Diese Funktionen ordnen nur um - welcher Wert
 * auf welchen Balken, welche Beschriftung, was zusammengefasst wird -, damit
 * die Komponenten in `components/finance/FinanceCharts.tsx` nur zeichnen.
 */
import type {
  FinanceMonthReport,
  FinanceReportRow,
  FinanceStatement,
  FinanceYearReport,
} from './financeTypes'
import { formatEuro, formatMonth } from './reportFormat'

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
]

/** `2026-10` → `Okt` */
export function shortMonth(month: string): string {
  return SHORT_MONTHS[Number(month.slice(5, 7)) - 1] ?? month
}

/** `2026-10-15` → `15.10.` */
function dayMonth(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

export interface FlowTooltipLine {
  label: string
  value: string
  /** gedämpft darunter, z. B. „davon geschätzt 4.000,00 €“ */
  hint?: string
}

/** Ein Monat im Säulendiagramm Einnahmen/Ausgaben/Ergebnis. */
export interface FlowPoint {
  /** `JJJJ-MM` - eindeutig, Schlüssel der x-Achse */
  key: string
  /** Achse: Monatskürzel */
  label: string
  /** Achse, zweite Zeile: Jahr (nur im Januar und am Anfang) */
  sublabel?: string
  /** Tooltip-Überschrift */
  title: string
  /** Ist (bzw. Ist bis zum Stichtag); `null` = keine Bankdaten */
  income: number | null
  expense: number | null
  /** Geschätzter Teil (Hochrechnung), sonst 0 */
  estIncome: number
  estExpense: number
  /** Ergebnis eines abgeschlossenen Monats (durchgezogene Linie) */
  result: number | null
  /** Ergebnis eines offenen Monats - angebrochen oder geschätzt (gestrichelt) */
  openResult: number | null
  /** Monat ist angebrochen oder (teils) geschätzt */
  open: boolean
  tooltip: FlowTooltipLine[]
}

function lines(
  income: number,
  expense: number,
  estIncome: number,
  estExpense: number,
  resultLabel: string
): FlowTooltipLine[] {
  const est = (value: number) =>
    Math.abs(value) >= 0.005
      ? `davon geschätzt ${formatEuro(value)}`
      : undefined
  return [
    { label: 'Einnahmen', value: formatEuro(income), hint: est(estIncome) },
    { label: 'Ausgaben', value: formatEuro(expense), hint: est(estExpense) },
    { label: resultLabel, value: formatEuro(income + expense) },
  ]
}

/**
 * Jahresabschluss: zwölf Monate. Mit Hochrechnung tragen angebrochene und
 * künftige Monate den geschätzten Teil (schraffiert) und ein gestricheltes
 * Ergebnis; ohne Hochrechnung bleiben künftige Monate leer.
 */
export function yearFlowPoints(report: FinanceYearReport): FlowPoint[] {
  const basis = new Map(
    (report.projection?.basis ?? []).map((entry) => [entry.month, entry])
  )
  const points: FlowPoint[] = report.months.map((row, index) => {
    const base = {
      key: row.month,
      label: shortMonth(row.month),
      sublabel: index === 0 ? report.year : undefined,
      title: formatMonth(row.month),
    }
    const projected = basis.get(row.month)
    if (projected && projected.source !== 'actual') {
      const actualIncome = row.coverage === 'partial' ? row.income : 0
      const actualExpense = row.coverage === 'partial' ? row.expense : 0
      return {
        ...base,
        title:
          row.coverage === 'partial'
            ? `${base.title} · Ist bis ${dayMonth(
                row.covered_to
              )}, Rest geschätzt`
            : `${base.title} · geschätzt`,
        income: row.coverage === 'partial' ? actualIncome : null,
        expense: row.coverage === 'partial' ? actualExpense : null,
        estIncome: projected.estimate_income,
        estExpense: projected.estimate_expense,
        result: null,
        openResult: projected.result,
        open: true,
        tooltip: lines(
          projected.income,
          projected.expense,
          projected.estimate_income,
          projected.estimate_expense,
          'Ergebnis (hochgerechnet)'
        ),
      }
    }
    if (row.coverage === 'missing') {
      return {
        ...base,
        income: null,
        expense: null,
        estIncome: 0,
        estExpense: 0,
        result: null,
        openResult: null,
        open: false,
        tooltip: [{ label: 'Keine Bankdaten', value: '' }],
      }
    }
    const partial = row.coverage === 'partial'
    return {
      ...base,
      title: partial
        ? `${base.title} · bis ${dayMonth(row.covered_to)}`
        : base.title,
      income: row.income,
      expense: row.expense,
      estIncome: 0,
      estExpense: 0,
      result: partial ? null : row.result,
      openResult: partial ? row.result : null,
      open: partial,
      tooltip: lines(
        row.income,
        row.expense,
        0,
        0,
        partial ? 'Ergebnis bisher' : 'Ergebnis'
      ),
    }
  })
  return connectOpenLine(points)
}

/** Monatsanalyse: dieser Monat und bis zu zwölf davor. */
export function trendFlowPoints(report: FinanceMonthReport): FlowPoint[] {
  const points: FlowPoint[] = report.trend.map((row, index) => {
    const partial = row.coverage === 'partial'
    const firstOfYear = row.month.endsWith('-01')
    return {
      key: row.month,
      label: shortMonth(row.month),
      sublabel: index === 0 || firstOfYear ? row.month.slice(0, 4) : undefined,
      title: partial
        ? `${formatMonth(row.month)} · bis ${dayMonth(row.covered_to)}`
        : formatMonth(row.month),
      income: row.income,
      expense: row.expense,
      estIncome: 0,
      estExpense: 0,
      result: partial ? null : row.result,
      openResult: partial ? row.result : null,
      open: partial,
      tooltip: lines(
        row.income,
        row.expense,
        0,
        0,
        partial ? 'Ergebnis bisher' : 'Ergebnis'
      ),
    }
  })
  return connectOpenLine(points)
}

/**
 * Die gestrichelte Linie beginnt am letzten abgeschlossenen Monat, damit sie
 * an die durchgezogene anschließt statt frei im Raum zu beginnen.
 */
function connectOpenLine(points: FlowPoint[]): FlowPoint[] {
  const firstOpen = points.findIndex((p) => p.openResult !== null)
  if (firstOpen > 0 && points[firstOpen - 1].result !== null) {
    points[firstOpen - 1] = {
      ...points[firstOpen - 1],
      openResult: points[firstOpen - 1].result,
    }
  }
  return points
}

/** Gibt es geschätzte Anteile (für die Legende)? */
export function hasEstimates(points: FlowPoint[]): boolean {
  return points.some((p) => p.estIncome !== 0 || p.estExpense !== 0)
}

/** Ein Punkt der Kurve „Ergebnis seit Jahresbeginn“. */
export interface CumulativePoint {
  key: string
  label: string
  title: string
  /** Ist, aufgelaufen bis Monatsende (bzw. Stichtag) */
  actual: number | null
  /** Hochrechnung, aufgelaufen - ab dem letzten abgeschlossenen Monat */
  projected: number | null
}

/**
 * Jahresabschluss: aufgelaufenes Ergebnis. Die Hochrechnung setzt am letzten
 * abgeschlossenen Monat an; der angebrochene Monat steht in der Ist-Linie mit
 * seinem Stand bis zum Stichtag.
 */
export function cumulativePoints(report: FinanceYearReport): CumulativePoint[] {
  const basis = new Map(
    (report.projection?.basis ?? []).map((entry) => [entry.month, entry])
  )
  const lastComplete = [...report.months]
    .reverse()
    .find((row) => row.coverage === 'complete')?.month
  return report.months.map((row) => {
    const projected = basis.get(row.month)
    const fromHere = Boolean(
      projected && (projected.source !== 'actual' || row.month === lastComplete)
    )
    return {
      key: row.month,
      label: shortMonth(row.month),
      title:
        row.coverage === 'partial'
          ? `${formatMonth(row.month)} · bis ${dayMonth(row.covered_to)}`
          : formatMonth(row.month),
      actual: row.cumulative_result,
      projected: fromHere && projected ? projected.cumulative_result : null,
    }
  })
}

/** Ein Balken der Rangliste „Wohin das Geld ging“. */
export interface CategoryBar {
  key: string
  label: string
  /** Betrag als positive Größe (Ausgabe 1.200 € → 1200) */
  value: number
  /** Anteil an der Summe, 0..1 */
  share: number
  /** Ø der Vergleichsmonate als positive Größe, `null` = keiner */
  average: number | null
  /** Netto eine Erstattung (Ausgabenposten mit Plus) */
  refund: boolean
}

export const CATEGORY_BAR_LIMIT = 7

/**
 * Ausgabenposten als Rangliste: die größten `limit`, der Rest als „Übrige“.
 * Beträge positiv, damit die Balken nach rechts wachsen; ein Posten, der
 * netto ins Plus geht (Erstattung), hat Balken 0 und `refund: true`.
 */
export function expenseBars(
  statement: FinanceStatement,
  limit = CATEGORY_BAR_LIMIT
): CategoryBar[] {
  const toBar = (row: FinanceReportRow): CategoryBar => ({
    key: row.category,
    label: row.label,
    value: Math.max(0, -row.amount),
    share: row.share ?? 0,
    average:
      row.average === undefined || row.average === null
        ? null
        : Math.max(0, -row.average),
    refund: row.amount > 0,
  })
  const rows = [...statement.expense.rows].sort((a, b) => a.amount - b.amount)
  if (rows.length <= limit + 1) return rows.map(toBar)
  const head = rows.slice(0, limit).map(toBar)
  const tail = rows.slice(limit).map(toBar)
  const withAverage = tail.filter((bar) => bar.average !== null)
  head.push({
    key: 'uebrige',
    label: `Übrige (${tail.length} Posten)`,
    value: tail.reduce((sum, bar) => sum + bar.value, 0),
    share: tail.reduce((sum, bar) => sum + bar.share, 0),
    average: withAverage.length
      ? withAverage.reduce((sum, bar) => sum + (bar.average ?? 0), 0)
      : null,
    refund: false,
  })
  return head
}

/** Ein Teil des Balkens „Woher das Geld kam“. */
export interface IncomePart {
  key: string
  label: string
  value: number
  share: number
}

export const INCOME_PART_LIMIT = 4

/**
 * Einnahmen nach Herkunft: Posten mit Unterkategorien (Umsatz → bar, Karte,
 * Rechnung) werden aufgeteilt, wenn die Unterkategorien den Posten ganz
 * erklären; höchstens `limit` Teile, der Rest als „Übrige“. Nur Zuflüsse
 * (positive Beträge) - ein Teil ist ein Anteil am Ganzen.
 */
export function incomeParts(
  statement: FinanceStatement,
  limit = INCOME_PART_LIMIT
): IncomePart[] {
  const parts: { key: string; label: string; value: number }[] = []
  for (const row of statement.income.rows) {
    const subs = row.subcategories.filter((sub) => sub.amount > 0)
    const subSum = subs.reduce((sum, sub) => sum + sub.amount, 0)
    if (
      subs.length > 1 &&
      Math.abs(subSum - row.amount) < 1 &&
      row.subcategories.every((sub) => sub.amount >= 0)
    ) {
      for (const sub of subs) {
        parts.push({
          key: `${row.category}.${sub.key}`,
          label: sub.label,
          value: sub.amount,
        })
      }
    } else if (row.amount > 0) {
      parts.push({ key: row.category, label: row.label, value: row.amount })
    }
  }
  parts.sort((a, b) => b.value - a.value)
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  if (total <= 0) return []
  const kept =
    parts.length > limit
      ? [
          ...parts.slice(0, limit - 1),
          {
            key: 'uebrige',
            label: `Übrige (${parts.length - limit + 1})`,
            value: parts
              .slice(limit - 1)
              .reduce((sum, part) => sum + part.value, 0),
          },
        ]
      : parts
  return kept.map((part) => ({ ...part, share: part.value / total }))
}

/** Bester und schwächster abgeschlossener Monat - für den Satz unter dem Diagramm. */
export function flowExtremes(
  points: FlowPoint[]
): { best: FlowPoint; worst: FlowPoint } | null {
  const complete = points.filter((p) => p.result !== null && !p.open)
  if (complete.length < 2) return null
  let best = complete[0]
  let worst = complete[0]
  for (const p of complete) {
    if ((p.result ?? 0) > (best.result ?? 0)) best = p
    if ((p.result ?? 0) < (worst.result ?? 0)) worst = p
  }
  return best === worst ? null : { best, worst }
}
