/**
 * Jahresabschluss (vorläufig) und Monatsanalyse aus der bereinigten
 * `finance-summary.json` plus den Monatssummen der Kasse.
 *
 * Dependency-freies CommonJS wie `finance.core.js`: dieselbe Datei rechnet für
 * die API (`src/routes/finance.routes.js`) und die Tests
 * (`tests/unit/financeReportCore.test.js`). Die Management-App rechnet nichts
 * nach - sie zeigt, was hier entsteht, auch die Hinweistexte.
 *
 * Grundsätze:
 *   - Eingabe ist **immer** die bereinigte Zusammenfassung
 *     (`finance.sanitizeSummary`) - hier gibt es keine Namen, IBANs oder
 *     Einzelbuchungen, und es entstehen auch keine.
 *   - Cashflow nach Buchungsdatum (Zuflussprinzip, wie eine
 *     Einnahmen-Überschuss-Rechnung), **keine** Bilanz und kein steuerlicher
 *     Abschluss. Was das heißt, steht als `notes` in jeder Antwort.
 *   - Ergebnis = Einnahmen + Ausgaben (Ausgaben inkl. „nicht zugeordnet“,
 *     wie im Export). Neutral (Privat, Geldtransit, Finanzierung) steht unter
 *     dem Strich und ändert das Ergebnis nicht.
 *   - Ein Monat ist nur „vollständig“, wenn die Bankdaten (`period`) ihn ganz
 *     abdecken. Unvollständige Monate fließen nie in Durchschnitte ein - sonst
 *     drückt der laufende Monat jeden Mittelwert.
 *   - Beträge in Euro, Abflüsse negativ; gerechnet wird in Cent.
 */

'use strict'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const YEAR_RE = /^\d{4}$/

/** Monate, über die Durchschnitte und Hochrechnung gebildet werden. */
const AVERAGE_WINDOW = 12

/** Ab hier gilt eine Ausgabenkategorie im Monat als auffällig (× Ø). */
const HIGHLIGHT_RATIO = 1.5
/** … und nur, wenn die Abweichung mindestens so viele Euro ausmacht. */
const HIGHLIGHT_MIN_EUR = 300

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function cents(value) {
  return Math.round(num(value) * 100)
}

function euro(c) {
  return Math.round(c) / 100
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function isValidMonth(value) {
  return MONTH_RE.test(String(value || ''))
}

function isValidYear(value) {
  return YEAR_RE.test(String(value || ''))
}

function isValidDate(value) {
  if (!DATE_RE.test(String(value || ''))) return false
  const [y, m, d] = value.split('-').map(Number)
  return d <= daysInMonth(`${y}-${String(m).padStart(2, '0')}`)
}

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function monthName(month) {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1]
}

function monthLabel(month) {
  return `${monthName(month)} ${month.slice(0, 4)}`
}

function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function formatDateDe(iso) {
  if (!isValidDate(iso)) return String(iso || '')
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function formatEuroDe(value) {
  const abs = Math.abs(value)
  const [int, dec] = abs.toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${value < 0 ? '−' : ''}${grouped},${dec} €`
}

// ============================================================================
// ABDECKUNG
// ============================================================================

/**
 * Wie weit die Bankdaten einen Monat abdecken.
 * `complete` | `partial` (Anfang oder Ende fehlt) | `missing`.
 */
function monthCoverage(month, period) {
  const total = daysInMonth(month)
  const first = `${month}-01`
  const last = `${month}-${String(total).padStart(2, '0')}`
  const from = period && isValidDate(period.from) ? period.from : null
  const to = period && isValidDate(period.to) ? period.to : null
  if (!from || !to || to < first || from > last) {
    return {
      status: 'missing',
      from: null,
      to: null,
      days: 0,
      days_in_month: total,
    }
  }
  const coveredFrom = from > first ? from : first
  const coveredTo = to < last ? to : last
  const days =
    Number(coveredTo.slice(8, 10)) - Number(coveredFrom.slice(8, 10)) + 1
  return {
    status: days === total ? 'complete' : 'partial',
    from: coveredFrom,
    to: coveredTo,
    days,
    days_in_month: total,
  }
}

function monthsOf(summary) {
  return (Array.isArray(summary && summary.months) ? summary.months : [])
    .filter((m) => isPlainObject(m) && isValidMonth(m.month))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** Die vollständigen Monate vor `beforeMonth` (exklusiv), höchstens `count`. */
function completeMonthsBefore(summary, beforeMonth, count = AVERAGE_WINDOW) {
  const period = summary.period || {}
  return monthsOf(summary)
    .filter((m) => m.month < beforeMonth)
    .filter((m) => monthCoverage(m.month, period).status === 'complete')
    .slice(-count)
}

/** Jahre mit Bankdaten, jüngstes zuerst. */
function availableYears(summary) {
  const years = new Set(monthsOf(summary).map((m) => m.month.slice(0, 4)))
  return [...years].sort((a, b) => b.localeCompare(a))
}

/** Der jüngste vollständige Monat, sonst der jüngste überhaupt (oder `null`). */
function latestCompleteMonth(summary) {
  const months = monthsOf(summary)
  const period = summary.period || {}
  const complete = months.filter(
    (m) => monthCoverage(m.month, period).status === 'complete'
  )
  const pick = complete.length ? complete : months
  return pick.length ? pick[pick.length - 1].month : null
}

/** Monate mit Bankdaten, jüngster zuerst. */
function availableMonths(summary) {
  return monthsOf(summary)
    .map((m) => m.month)
    .reverse()
}

// ============================================================================
// GLIEDERUNG
// ============================================================================

const SECTION_KINDS = {
  income: ['einnahme'],
  expense: ['ausgabe', 'offen'],
  neutral: ['neutral'],
}

/**
 * Summiert die Kategorien der Monate in `months` (Cent) und gliedert sie nach
 * Einnahmen, Ausgaben (inkl. offen) und Neutral, je mit Unterkategorien.
 */
function statementOf(summary, months) {
  const kinds = isPlainObject(summary.category_kinds)
    ? summary.category_kinds
    : {}
  const labels = isPlainObject(summary.category_labels)
    ? summary.category_labels
    : {}
  const subLabels = isPlainObject(summary.subcategory_labels)
    ? summary.subcategory_labels
    : {}

  const acc = new Map()
  for (const m of months) {
    if (!isPlainObject(m.categories)) continue
    for (const [slug, bucket] of Object.entries(m.categories)) {
      if (!isPlainObject(bucket)) continue
      const row = acc.get(slug) || {
        amount: 0,
        count: 0,
        income: 0,
        expense: 0,
        subs: new Map(),
      }
      row.amount += cents(bucket.amount)
      row.count += num(bucket.count)
      row.income += cents(bucket.income)
      row.expense += cents(bucket.expense)
      if (isPlainObject(bucket.subcategories)) {
        for (const [sub, value] of Object.entries(bucket.subcategories)) {
          row.subs.set(sub, (row.subs.get(sub) || 0) + cents(value))
        }
      }
      acc.set(slug, row)
    }
  }

  const section = (wanted) => {
    const rows = [...acc.entries()]
      .filter(([slug]) => wanted.includes(kinds[slug] || 'offen'))
      .map(([slug, row]) => ({
        category: slug,
        label: labels[slug] || slug,
        kind: kinds[slug] || 'offen',
        amount: euro(row.amount),
        count: row.count,
        income: euro(row.income),
        expense: euro(row.expense),
        subcategories: [...row.subs.entries()]
          .filter(([, value]) => value !== 0)
          .map(([key, value]) => ({
            key,
            label: subLabels[key] || (key === 'sonstige' ? 'Sonstige' : key),
            amount: euro(value),
          }))
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      }))
      .filter((row) => row.amount !== 0 || row.count > 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    const total = euro(rows.reduce((s, r) => s + cents(r.amount), 0))
    return { total, rows }
  }

  const income = section(SECTION_KINDS.income)
  const expense = section(SECTION_KINDS.expense)
  const neutral = section(SECTION_KINDS.neutral)
  const result = euro(cents(income.total) + cents(expense.total))
  const totalExpense = Math.abs(
    expense.rows.reduce((s, r) => s + Math.min(0, r.amount), 0)
  )
  for (const row of expense.rows) {
    row.share =
      totalExpense > 0 && row.amount < 0
        ? Math.round((-row.amount / totalExpense) * 1000) / 1000
        : 0
  }
  const totalIncome = income.rows.reduce((s, r) => s + Math.max(0, r.amount), 0)
  for (const row of income.rows) {
    row.share =
      totalIncome > 0 && row.amount > 0
        ? Math.round((row.amount / totalIncome) * 1000) / 1000
        : 0
  }
  const unassigned = expense.rows.find((r) => r.kind === 'offen')
  return {
    income,
    expense,
    result,
    neutral,
    net_change: euro(cents(result) + cents(neutral.total)),
    transactions: months.reduce((s, m) => s + num(m.transactions), 0),
    unassigned: unassigned
      ? { amount: unassigned.amount, count: unassigned.count }
      : { amount: 0, count: 0 },
  }
}

function totalsOf(month) {
  return {
    income: round2(num(month.operating_income)),
    expense: round2(num(month.operating_expense)),
    result: round2(num(month.operating_result)),
    neutral: round2(num(month.neutral)),
    net_change: round2(num(month.net_change)),
    transactions: num(month.transactions),
  }
}

function averageOf(months) {
  if (months.length === 0) return null
  const n = months.length
  const avg = (key) => euro(months.reduce((s, m) => s + cents(m[key]), 0) / n)
  return {
    months: n,
    from: months[0].month,
    to: months[n - 1].month,
    income: avg('operating_income'),
    expense: avg('operating_expense'),
    result: avg('operating_result'),
  }
}

/** Ø je Kategorie (Euro) über `months` - Netto (`amount`) oder nur Abfluss (`expense`). */
function categoryAverages(months, field = 'amount') {
  const sums = new Map()
  for (const m of months) {
    if (!isPlainObject(m.categories)) continue
    for (const [slug, bucket] of Object.entries(m.categories)) {
      sums.set(slug, (sums.get(slug) || 0) + cents(bucket && bucket[field]))
    }
  }
  const out = {}
  for (const [slug, sum] of sums) out[slug] = euro(sum / months.length)
  return out
}

/**
 * In wie vielen der `months` eine Kategorie nennenswert gebucht war (mindestens
 * ein Viertel ihres Durchschnitts) - so zählt eine 0-€-Gutschrift nicht als
 * „kam vor“.
 */
function categoryPresence(months, averages) {
  const out = {}
  for (const m of months) {
    if (!isPlainObject(m.categories)) continue
    for (const [slug, bucket] of Object.entries(m.categories)) {
      const avg = cents(averages[slug])
      const amount = cents(bucket && bucket.expense)
      if (avg !== 0 && amount / avg >= 0.25) out[slug] = (out[slug] || 0) + 1
    }
  }
  return out
}

// ============================================================================
// KASSE
// ============================================================================

/**
 * Monatssumme der Kasse (Ergebnis von `reports.core.aggregateMonth`) auf das
 * Nötige verkleinert. `null`, wenn es keinen Bericht gibt.
 */
function kasseOf(aggregate) {
  if (!isPlainObject(aggregate) || aggregate.status !== 'ok') return null
  const payments = isPlainObject(aggregate.payments) ? aggregate.payments : {}
  const amount = (key) => round2(num(payments[key] && payments[key].amount))
  return {
    revenue: round2(num(aggregate.revenue)),
    days: num(aggregate.dayCount),
    avg_day: round2(num(aggregate.avgDayRevenue)),
    receipts: num(aggregate.receiptCount),
    cash: amount('cash'),
    card: amount('card'),
    unpaid: amount('other'),
  }
}

/** Bank-Seite des Kassenabgleichs aus den Unterkategorien von `umsatz`. */
function bankPosOf(statement) {
  const umsatz = statement.income.rows.find((r) => r.category === 'umsatz')
  const sub = (keys) =>
    umsatz
      ? euro(
          umsatz.subcategories
            .filter((s) => keys.includes(s.key))
            .reduce((acc, s) => acc + cents(s.amount), 0)
        )
      : 0
  return { cash: sub(['bar']), card: sub(['karte', 'karte_elv']) }
}

function reconcile(kasse, statement) {
  if (!kasse) return null
  const bank = bankPosOf(statement)
  return {
    kasse_revenue: kasse.revenue,
    kasse_cash: kasse.cash,
    kasse_card: kasse.card,
    kasse_days: kasse.days,
    bank_cash: bank.cash,
    bank_card: bank.card,
    diff_cash: euro(cents(bank.cash) - cents(kasse.cash)),
    diff_card: euro(cents(bank.card) - cents(kasse.card)),
    kasse_total: euro(cents(kasse.cash) + cents(kasse.card)),
    bank_total: euro(cents(bank.cash) + cents(bank.card)),
    diff_total: euro(
      cents(bank.cash) +
        cents(bank.card) -
        cents(kasse.cash) -
        cents(kasse.card)
    ),
  }
}

function sumKasse(list) {
  const present = list.filter(Boolean)
  if (present.length === 0) return null
  const add = (key) => euro(present.reduce((s, k) => s + cents(k[key]), 0))
  const days = present.reduce((s, k) => s + k.days, 0)
  const revenue = add('revenue')
  return {
    revenue,
    days,
    avg_day: days > 0 ? euro(cents(revenue) / days) : 0,
    receipts: present.reduce((s, k) => s + k.receipts, 0),
    cash: add('cash'),
    card: add('card'),
    unpaid: add('unpaid'),
  }
}

// ============================================================================
// HINWEISE („Was nicht enthalten ist“)
// ============================================================================

function neutralAmount(statement, category, sign) {
  const row = statement.neutral.rows.find((r) => r.category === category)
  if (!row) return 0
  return sign < 0 ? row.expense : row.income
}

/**
 * Hinweise zu einem Zeitraum: fest (was die Sicht grundsätzlich nicht kann)
 * und aus den Daten (offene Buchungen, Geldtransit, Kassenabgleich …).
 * `severity`: `info` | `warning`.
 */
function buildNotes(statement, ctx) {
  const notes = []
  const add = (key, severity, text) => notes.push({ key, severity, text })

  if (ctx.startsLate) {
    add(
      'data_start',
      'warning',
      `Bankdaten gibt es erst ab ${formatDateDe(ctx.dataFrom)}` +
        (ctx.missingBefore ? ` – ${ctx.missingBefore}` : '') +
        '. Für dieses Jahr ist deshalb kein vollständiger Jahreswert möglich.'
    )
  }
  if (ctx.openUntil) {
    add(
      'year_open',
      'info',
      `Das Jahr ist noch nicht abgeschlossen: Bankdaten bis ${formatDateDe(
        ctx.openUntil
      )}. ` + 'Alle Werte sind vorläufig.'
    )
  }
  if (statement.unassigned.count > 0) {
    add(
      'unassigned',
      'warning',
      `${statement.unassigned.count} Buchung${
        statement.unassigned.count === 1 ? ' ist' : 'en sind'
      } ` +
        `keiner Kategorie zugeordnet (${formatEuroDe(
          statement.unassigned.amount
        )}). ` +
        'Sie stecken unter „Nicht zugeordnet“ in den Ausgaben und verändern das Ergebnis.'
    )
  }
  const transit = neutralAmount(statement, 'geldtransit', -1)
  if (transit < 0) {
    add(
      'transit',
      'warning',
      `${formatEuroDe(
        -transit
      )} gingen als Geldtransit vom Geschäftskonto weg (Verrechnungskonto, ` +
        'Wechselgeld). Was von dort aus bezahlt wurde, sieht diese Auswertung nicht – ' +
        'Kosten können also fehlen.'
    )
  }
  if (ctx.reconciliation) {
    const r = ctx.reconciliation
    add(
      'kasse_bank',
      Math.abs(r.diff_total) >
        Math.max(500, Math.abs(r.kasse_cash + r.kasse_card) * 0.05)
        ? 'warning'
        : 'info',
      `Kasse ${formatEuroDe(
        r.kasse_cash + r.kasse_card
      )} (bar + Karte), auf dem Konto angekommen ` +
        `${formatEuroDe(r.bank_cash + r.bank_card)} – Differenz ${formatEuroDe(
          r.diff_total
        )}. ` +
        'Gründe: Bargeld bleibt als Wechselgeld im Laden oder wird bar ausgegeben, ' +
        'Einzahlungen und Kartenabrechnungen kommen ein paar Tage später.'
    )
  }
  add(
    'cash_basis',
    'info',
    'Gezählt wird, was über das Konto ging, nach Buchungsdatum – keine Bilanz. Nicht enthalten: ' +
      'Abschreibungen (große Anschaffungen stehen voll im Monat der Zahlung), Warenbestand, ' +
      'offene Rechnungen, Ausgaben bar aus der Kasse und die Einkommensteuer der Gesellschafter.'
  )
  add(
    'gross',
    'info',
    'Umsätze sind brutto (mit Umsatzsteuer). Gezahlte und erstattete Umsatzsteuer steht unter „Steuern“.'
  )
  add(
    'neutral',
    'info',
    'Privatentnahmen, Darlehen und Umbuchungen stehen unter „Neutral“ – sie verändern den ' +
      'Kontostand, aber nicht das Ergebnis.'
  )
  return notes
}

// ============================================================================
// JAHR
// ============================================================================

/**
 * Hochrechnung aufs ganze Jahr. Je Monat:
 *   - vollständig            → Ist
 *   - laufend (unvollständig) → Ist + Schätzung × fehlender Tagesanteil
 *   - noch nicht begonnen    → Schätzung
 * Schätzung = derselbe Monat im Vorjahr, wenn er vollständig vorliegt, sonst
 * Ø der letzten 12 vollständigen Monate. Fehlen Monate **vor** Datenbeginn,
 * gibt es keine Hochrechnung (`null` + Grund).
 */
function projectYear(summary, year, byMonth) {
  const period = summary.period || {}
  const reference = completeMonthsBefore(summary, `${Number(year) + 1}-01`)
  const avg = averageOf(reference)
  const basis = []
  let income = 0
  let expense = 0
  for (let i = 1; i <= 12; i += 1) {
    const month = `${year}-${String(i).padStart(2, '0')}`
    const coverage = monthCoverage(month, period)
    const actual = byMonth.get(month)
    const prev = byMonth.get(addMonths(month, -12))
    const prevComplete =
      prev && monthCoverage(prev.month, period).status === 'complete'
    const estimate = prevComplete
      ? {
          source: 'previous_year',
          income: num(prev.operating_income),
          expense: num(prev.operating_expense),
        }
      : avg
      ? { source: 'average', income: avg.income, expense: avg.expense }
      : null

    if (coverage.status === 'complete') {
      income += cents(actual ? actual.operating_income : 0)
      expense += cents(actual ? actual.operating_expense : 0)
      basis.push({ month, source: 'actual', fraction: 1 })
      continue
    }
    if (
      period.from &&
      `${month}-01` < period.from &&
      coverage.status !== 'partial'
    ) {
      return {
        projection: null,
        reason:
          'Für Monate vor Beginn der Bankdaten gibt es keine Hochrechnung.',
      }
    }
    if (coverage.status === 'partial' && coverage.from > `${month}-01`) {
      return {
        projection: null,
        reason:
          'Der erste Monat der Bankdaten ist unvollständig - keine Hochrechnung.',
      }
    }
    if (!estimate) {
      return {
        projection: null,
        reason: 'Zu wenig vollständige Monate für eine Hochrechnung.',
      }
    }
    const fraction =
      coverage.status === 'partial'
        ? 1 - coverage.days / coverage.days_in_month
        : 1
    if (actual && coverage.status === 'partial') {
      income += cents(actual.operating_income)
      expense += cents(actual.operating_expense)
    }
    income += cents(estimate.income) * fraction
    expense += cents(estimate.expense) * fraction
    basis.push({
      month,
      source:
        coverage.status === 'partial'
          ? `partial_${estimate.source}`
          : estimate.source,
      fraction: round2(fraction),
    })
  }
  return {
    projection: {
      income: euro(income),
      expense: euro(expense),
      result: euro(income + expense),
      basis,
      average_window: avg
        ? { from: avg.from, to: avg.to, months: avg.months }
        : null,
      method:
        'Ist der abgeschlossenen Monate; für den Rest des Jahres derselbe Monat im Vorjahr, ' +
        `wo vorhanden, sonst der Durchschnitt der letzten ${AVERAGE_WINDOW} vollständigen Monate.`,
    },
    reason: null,
  }
}

/**
 * Jahresabschluss für `year` (`JJJJ`). `options.kasseByMonth`: `{ 'JJJJ-MM':
 * Ergebnis von reports.core.aggregateMonth }`; `options.today`: `JJJJ-MM-TT`.
 * Liefert `{ status: 'ok', data }` oder `{ status: 'no-data', reason }`.
 */
function buildYearReport(summary, year, options = {}) {
  if (!isValidYear(year))
    return { status: 'no-data', reason: 'Ungültiges Jahr.' }
  const period = summary.period || {}
  const all = monthsOf(summary)
  const months = all.filter((m) => m.month.startsWith(`${year}-`))
  if (months.length === 0) {
    return { status: 'no-data', reason: `Für ${year} gibt es keine Bankdaten.` }
  }
  const byMonth = new Map(all.map((m) => [m.month, m]))
  const kasseByMonth = isPlainObject(options.kasseByMonth)
    ? options.kasseByMonth
    : {}
  const today = isValidDate(options.today) ? options.today : null

  const rows = []
  const missingBefore = []
  let startsLate = false
  for (let i = 1; i <= 12; i += 1) {
    const month = `${year}-${String(i).padStart(2, '0')}`
    const coverage = monthCoverage(month, period)
    const data = byMonth.get(month)
    if (
      coverage.status === 'missing' &&
      period.from &&
      `${month}-01` < period.from
    ) {
      missingBefore.push(month)
    }
    if (coverage.status === 'partial' && coverage.from > `${month}-01`)
      startsLate = true
    rows.push({
      month,
      label: monthName(month),
      coverage: coverage.status,
      covered_to: coverage.to,
      ...(data
        ? totalsOf(data)
        : {
            income: 0,
            expense: 0,
            result: 0,
            neutral: 0,
            net_change: 0,
            transactions: 0,
          }),
      has_data: Boolean(data),
      kasse: kasseOf(kasseByMonth[month]),
    })
  }

  const statement = statementOf(summary, months)
  const yearEnd = `${year}-12-31`
  const open = !isValidDate(period.to) || period.to < yearEnd
  const status =
    missingBefore.length > 0 || startsLate
      ? 'incomplete'
      : open
      ? 'provisional'
      : 'final'

  // Kassenabgleich nur über Monate, die Bank *und* Kasse vollständig haben -
  // im laufenden Monat liegen Einzahlungen der letzten Tage noch nicht vor.
  const recMonths = rows.filter((r) => r.coverage === 'complete' && r.kasse)
  const recStatement = statementOf(
    summary,
    recMonths.map((r) => byMonth.get(r.month)).filter(Boolean)
  )
  const reconciliation = recMonths.length
    ? {
        ...reconcile(sumKasse(recMonths.map((r) => r.kasse)), recStatement),
        months: recMonths.length,
        from: recMonths[0].month,
        to: recMonths[recMonths.length - 1].month,
      }
    : null

  const projected =
    status === 'provisional' ? projectYear(summary, year, byMonth) : null

  const ctx = {
    startsLate: missingBefore.length > 0 || startsLate,
    missingBefore: missingBefore.length
      ? missingBefore.length === 1
        ? `${monthName(missingBefore[0])} fehlt`
        : `${monthName(missingBefore[0])} bis ${monthName(
            missingBefore[missingBefore.length - 1]
          )} fehlen`
      : null,
    dataFrom: period.from,
    openUntil: status === 'provisional' ? period.to : null,
    reconciliation,
  }

  const previousYear = String(Number(year) - 1)
  const nextYear = String(Number(year) + 1)
  return {
    status: 'ok',
    data: {
      year: String(year),
      status,
      as_of: period.to || null,
      generated_at: summary.generated_at || null,
      today,
      coverage: {
        from: months[0].month,
        to: months[months.length - 1].month,
        data_from: period.from || null,
        data_to: period.to || null,
        complete_months: rows.filter((r) => r.coverage === 'complete').length,
        missing_before: missingBefore,
      },
      statement,
      months: rows,
      kasse: sumKasse(rows.map((r) => r.kasse)),
      reconciliation,
      projection: projected ? projected.projection : null,
      projection_reason: projected ? projected.reason : null,
      notes: buildNotes(statement, ctx),
      years: availableYears(summary),
      previous_year: all.some((m) => m.month.startsWith(`${previousYear}-`))
        ? previousYear
        : null,
      next_year: all.some((m) => m.month.startsWith(`${nextYear}-`))
        ? nextYear
        : null,
    },
  }
}

// ============================================================================
// MONAT
// ============================================================================

function compareTo(month, current) {
  if (!month) return null
  const t = totalsOf(month)
  return {
    month: month.month,
    label: monthLabel(month.month),
    income: t.income,
    expense: t.expense,
    result: t.result,
    diff_income: euro(cents(current.income) - cents(t.income)),
    diff_expense: euro(cents(current.expense) - cents(t.expense)),
    diff_result: euro(cents(current.result) - cents(t.result)),
  }
}

/** Unter so vielen Vergleichsmonaten gibt es keine Auffälligkeiten. */
const HIGHLIGHT_MIN_MONTHS = 6

/**
 * Auffälligkeiten eines vollständigen Monats gegenüber den 12 vollständigen
 * Monaten davor. Ausgaben werden am **Abfluss** gemessen, nicht am Netto -
 * sonst ließe eine Steuererstattung „Steuern“ wie eine neue Ausgabe aussehen.
 *   - `expense_high`    Abfluss ≥ 1,5 × Ø und mindestens 300 € darüber
 *   - `expense_new`     ≥ 300 €, im Schnitt sonst unter 50 € im Monat
 *   - `expense_missing` regelmäßiger Posten (in fast jedem Monat gebucht,
 *                       Ø ≥ 300 €) fehlt ganz
 *   - `income_low|high` Einnahmen ±20 % gegenüber dem Ø
 * Erst ab 6 Vergleichsmonaten - davor wäre jeder Schnitt Zufall.
 */
function highlightsOf(statement, reference, avg, summary) {
  const out = []
  if (!avg || reference.length < HIGHLIGHT_MIN_MONTHS) return out
  const kinds = isPlainObject(summary.category_kinds)
    ? summary.category_kinds
    : {}
  const labels = isPlainObject(summary.category_labels)
    ? summary.category_labels
    : {}
  const outflow = categoryAverages(reference, 'expense')
  const presence = categoryPresence(reference, outflow)
  const n = reference.length

  for (const row of statement.expense.rows) {
    if (row.kind === 'offen') continue
    const spent = -row.expense
    const usual = -num(outflow[row.category])
    const base = {
      category: row.category,
      label: row.label,
      amount: round2(-spent),
      average: round2(-usual),
    }
    if (spent >= HIGHLIGHT_MIN_EUR && usual < 50) {
      out.push({
        ...base,
        kind: 'expense_new',
        text: `${row.label}: ${formatEuroDe(
          spent
        )} – in den ${n} Monaten davor kam das kaum vor (einmalige Ausgabe?).`,
      })
    } else if (
      usual >= 50 &&
      spent >= usual * HIGHLIGHT_RATIO &&
      spent - usual >= HIGHLIGHT_MIN_EUR
    ) {
      const ratio = round2(spent / usual)
      out.push({
        ...base,
        kind: 'expense_high',
        ratio,
        text: `${row.label}: ${formatEuroDe(spent)} statt üblich ${formatEuroDe(
          usual
        )} (${String(ratio).replace('.', ',')}× so viel).`,
      })
    }
  }
  for (const [slug, average] of Object.entries(outflow)) {
    if (kinds[slug] !== 'ausgabe' || -average < HIGHLIGHT_MIN_EUR) continue
    if ((presence[slug] || 0) < n - 1) continue
    const row = statement.expense.rows.find((r) => r.category === slug)
    if (row && row.expense < 0) continue
    const label = labels[slug] || slug
    out.push({
      kind: 'expense_missing',
      category: slug,
      label,
      amount: 0,
      average: round2(average),
      text: `${label}: diesen Monat keine Zahlung (sonst Ø ${formatEuroDe(
        -average
      )}) – kommt sie noch oder lief sie über ein anderes Konto?`,
    })
  }
  const income = statement.income.total
  if (avg.income > 0) {
    const ratio = income / avg.income
    if (ratio <= 0.8 || ratio >= 1.2) {
      out.push({
        kind: ratio < 1 ? 'income_low' : 'income_high',
        category: null,
        label: 'Einnahmen',
        amount: income,
        average: avg.income,
        ratio: round2(ratio),
        text: `Einnahmen ${formatEuroDe(income)} – ${Math.round(
          Math.abs(ratio - 1) * 100
        )} % ${ratio < 1 ? 'unter' : 'über'} dem Schnitt (${formatEuroDe(
          avg.income
        )}).`,
      })
    }
  }
  return out.sort(
    (x, y) => Math.abs(y.amount - y.average) - Math.abs(x.amount - x.average)
  )
}

/**
 * Monatsanalyse für `month` (`JJJJ-MM`). `options.kasse`: Ergebnis von
 * `reports.core.aggregateMonth` für diesen Monat; `options.kassePreviousYear`
 * dasselbe für den Vorjahresmonat.
 */
function buildMonthReport(summary, month, options = {}) {
  if (!isValidMonth(month))
    return { status: 'no-data', reason: 'Ungültiger Monat.' }
  const period = summary.period || {}
  const all = monthsOf(summary)
  const current = all.find((m) => m.month === month)
  if (!current) {
    return {
      status: 'no-data',
      reason: `Für ${monthLabel(month)} gibt es keine Bankdaten.`,
    }
  }
  const coverage = monthCoverage(month, period)
  const statement = statementOf(summary, [current])
  const totals = totalsOf(current)

  const reference = completeMonthsBefore(summary, month)
  const avg = averageOf(reference)
  // Ein angebrochener Monat wird nicht verglichen - halbe Monate gegen ganze
  // ergäben nur Scheinabweichungen. Dann stehen `average`/`diff` und die
  // Vergleiche auf `null`.
  const complete = coverage.status === 'complete'
  const averages =
    complete && reference.length ? categoryAverages(reference) : {}
  for (const row of [...statement.income.rows, ...statement.expense.rows]) {
    row.average =
      averages[row.category] !== undefined ? averages[row.category] : null
    row.diff =
      row.average !== null ? euro(cents(row.amount) - cents(row.average)) : null
  }
  const highlights = complete
    ? highlightsOf(statement, reference, avg, summary)
    : []
  // Warum die Liste leer sein kann: `partial` | `too_few_months` | null.
  const highlightsReason = !complete
    ? 'partial'
    : reference.length < HIGHLIGHT_MIN_MONTHS
    ? 'too_few_months'
    : null

  const kasse = kasseOf(options.kasse)
  const reconciliation =
    coverage.status === 'complete' ? reconcile(kasse, statement) : null
  const kassePrev = kasseOf(options.kassePreviousYear)

  const index = all.findIndex((m) => m.month === month)
  const previous = index > 0 ? all[index - 1] : null
  const lastYear = all.find((m) => m.month === addMonths(month, -12)) || null

  const notes = []
  if (coverage.status === 'partial') {
    notes.push({
      key: 'partial',
      severity: 'info',
      text:
        `Der Monat ist noch nicht vollständig: Bankdaten vom ${formatDateDe(
          coverage.from
        )} ` +
        `bis ${formatDateDe(
          coverage.to
        )}. Vergleiche und Auffälligkeiten gibt es erst, wenn er abgeschlossen ist.`,
    })
  }
  if (statement.unassigned.count > 0) {
    notes.push({
      key: 'unassigned',
      severity: 'warning',
      text: `${statement.unassigned.count} Buchung${
        statement.unassigned.count === 1 ? '' : 'en'
      } ohne Kategorie (${formatEuroDe(statement.unassigned.amount)}).`,
    })
  }
  if (reconciliation) {
    notes.push({
      key: 'kasse_bank',
      severity: 'info',
      text:
        `Kasse ${formatEuroDe(
          reconciliation.kasse_cash + reconciliation.kasse_card
        )} (bar + Karte), ` +
        `aufs Konto kamen ${formatEuroDe(
          reconciliation.bank_cash + reconciliation.bank_card
        )}. ` +
        'Einzahlungen und Kartenabrechnungen liegen oft ein paar Tage später – über einen Monat gleicht sich das meist aus.',
    })
  }

  return {
    status: 'ok',
    data: {
      month,
      label: monthLabel(month),
      coverage,
      generated_at: summary.generated_at || null,
      ...totals,
      statement,
      kasse,
      kasse_previous_year: kassePrev,
      reconciliation,
      comparison: complete
        ? {
            previous_month: compareTo(previous, totals),
            previous_year: compareTo(lastYear, totals),
            average: avg
              ? {
                  ...avg,
                  diff_income: euro(cents(totals.income) - cents(avg.income)),
                  diff_expense: euro(
                    cents(totals.expense) - cents(avg.expense)
                  ),
                  diff_result: euro(cents(totals.result) - cents(avg.result)),
                }
              : null,
          }
        : { previous_month: null, previous_year: null, average: null },
      highlights,
      highlights_reason: highlightsReason,
      highlights_min_months: HIGHLIGHT_MIN_MONTHS,
      notes,
      previous_month: previous ? previous.month : null,
      next_month:
        index >= 0 && index < all.length - 1 ? all[index + 1].month : null,
      months: availableMonths(summary),
    },
  }
}

module.exports = {
  AVERAGE_WINDOW,
  HIGHLIGHT_MIN_MONTHS,
  HIGHLIGHT_RATIO,
  HIGHLIGHT_MIN_EUR,
  isValidYear,
  isValidMonth,
  monthCoverage,
  completeMonthsBefore,
  availableYears,
  availableMonths,
  latestCompleteMonth,
  statementOf,
  projectYear,
  buildYearReport,
  buildMonthReport,
  addMonths,
}
