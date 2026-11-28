/**
 * Synthetische, schon bereinigte Finanz-Zusammenfassung über 17 Monate für
 * Jahresabschluss und Monatsanalyse. Alle Zahlen sind erfunden und rund, damit
 * man die Erwartungen im Kopf nachrechnen kann.
 *
 * Normalmonat: Umsatz 10000 (bar 6000, Karte 3000, Rechnung 1000),
 * Wareneinsatz −3000, Personal −4000, Energie −1000 → Ergebnis +2000;
 * neutral: Geldtransit −800, Privat −200.
 *
 * Abweichungen (für die Auffälligkeiten):
 *   2026-03  Energie −3000 (3×), Technik −1500 (neu)
 *   2026-04  Energie fehlt, Umsatz 7000 (−30 %)
 *   2026-05  läuft noch (Daten bis 10.05.): Umsatz 3000, Personal −1000
 */

'use strict'

const kalender = require('../../src/services/kalender.core')

function bucket(amount, subcategories = {}, extra = {}) {
  return {
    amount,
    count: extra.count !== undefined ? extra.count : 1,
    income: amount > 0 ? amount : 0,
    expense: amount < 0 ? amount : 0,
    subcategories,
    ...extra,
  }
}

function monthEntry(month, categories, kinds) {
  let income = 0
  let expense = 0
  let neutral = 0
  for (const [slug, b] of Object.entries(categories)) {
    const kind = kinds[slug]
    if (kind === 'einnahme') income += b.amount
    else if (kind === 'neutral') neutral += b.amount
    else expense += b.amount
  }
  return {
    month,
    transactions: Object.keys(categories).length,
    operating_income: income,
    operating_expense: expense,
    operating_result: income + expense,
    neutral,
    net_change: income + expense + neutral,
    categories,
  }
}

const KINDS = {
  umsatz: 'einnahme',
  wareneinsatz: 'ausgabe',
  personal: 'ausgabe',
  energie: 'ausgabe',
  technik_wartung: 'ausgabe',
  privat: 'neutral',
  geldtransit: 'neutral',
  unkategorisiert: 'offen',
}

function normalCategories(umsatz = 10000) {
  return {
    umsatz: bucket(umsatz, {
      bar: umsatz * 0.6,
      karte: umsatz * 0.3,
      rechnung: umsatz * 0.1,
    }),
    wareneinsatz: bucket(-3000, { mehl: -3000 }),
    personal: bucket(-4000, { loehne: -4000 }),
    energie: bucket(-1000),
    geldtransit: bucket(-800),
    privat: bucket(-200),
  }
}

function listMonths(from, to) {
  const out = []
  let [y, m] = from.split('-').map(Number)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key === to) return out
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
}

/** `period.from` lässt sich verschieben (z. B. Datenbeginn mitten im Jahr). */
function buildReportSummary({ from = '2025-01-01', to = '2026-05-10' } = {}) {
  const months = listMonths(from.slice(0, 7), to.slice(0, 7)).map((month) => {
    const c = normalCategories()
    if (month === '2026-03') {
      c.energie = bucket(-3000)
      c.technik_wartung = bucket(-1500)
    }
    if (month === '2026-04') {
      delete c.energie
      Object.assign(c, { umsatz: normalCategories(7000).umsatz })
      c.unkategorisiert = bucket(-150, {}, { count: 2 })
    }
    if (month === '2026-05') {
      return monthEntry(
        month,
        {
          umsatz: bucket(3000, { bar: 2000, karte: 1000 }),
          personal: bucket(-1000, { loehne: -1000 }),
        },
        KINDS
      )
    }
    return monthEntry(month, c, KINDS)
  })
  return {
    generated_at: '2026-05-11T08:00:00+02:00',
    schema_version: 1,
    period: { from, to },
    transaction_count: months.reduce((s, m) => s + m.transactions, 0),
    category_labels: {
      umsatz: 'Umsatzerlöse',
      wareneinsatz: 'Wareneinsatz',
      personal: 'Personal',
      energie: 'Energie & Wasser',
      technik_wartung: 'Technik & Wartung',
      privat: 'Privat',
      geldtransit: 'Geldtransit',
      unkategorisiert: 'Nicht zugeordnet',
    },
    category_kinds: KINDS,
    subcategory_labels: {
      bar: 'Bareinzahlung',
      karte: 'Kartenumsatz',
      rechnung: 'Rechnung',
      mehl: 'Mehl',
      loehne: 'Löhne',
    },
    totals: {},
    months,
    uncategorized: { count: 2, amount: -150 },
  }
}

/** Monatssumme der Kasse in der Form von `reports.core.aggregateMonth`. */
function kasseMonth({
  revenue = 9500,
  cash = 6400,
  card = 3100,
  days = 25,
} = {}) {
  return {
    status: 'ok',
    revenue,
    dayCount: days,
    avgDayRevenue: Math.round((revenue / days) * 100) / 100,
    receiptCount: days * 100,
    payments: {
      cash: { amount: cash, count: days * 80 },
      card: { amount: card, count: days * 20 },
      other: { amount: 0, count: 0 },
    },
  }
}

/** Alle Tage eines Monats `JJJJ-MM` als `JJJJ-MM-TT`. */
function datesOf(month) {
  const [y, m] = month.split('-').map(Number)
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from(
    { length: total },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`
  )
}

/**
 * Backzettel-Stammdaten, wie `backzettel-source.ts` sie liefert, nur mit dem,
 * was die Öffnungstage brauchen: Montag Ruhetag (`days` 2-7) und ein Kalender
 * mit den gesetzlichen Feiertagen der `years` plus eigenen `tage`.
 */
function calendarConfig({ years = [2025, 2026], tage = [] } = {}) {
  return {
    days: [2, 3, 4, 5, 6, 7],
    dough_days: [2, 3, 4, 5, 6, 7],
    calendar: kalender.normalizeKalender({
      version: 1,
      bundesland: 'saarland',
      feiertage: Object.fromEntries(
        years.map((y) => [
          y,
          kalender
            .holidaysSaarland(y)
            .map((h) => ({ datum: h.date, name: h.name })),
        ])
      ),
      tage,
    }),
  }
}

/** Öffnungstage laut `config` in `month`, wahlweise ab `from` / bis `to`. */
function openDates(config, month, { from = '', to = '9999', skip = [] } = {}) {
  return datesOf(month).filter(
    (d) =>
      d >= from &&
      d <= to &&
      !skip.includes(d) &&
      kalender.dayKind(config, d).open
  )
}

/**
 * Monatssumme der Kasse wie `kasseMonth`, aber mit Berichten genau an
 * `reportDates` (`missingDays` wie bei `reports.core.aggregateMonth`).
 */
function kasseMonthOn(month, reportDates, amounts = {}) {
  const have = new Set(reportDates)
  return {
    ...kasseMonth({ ...amounts, days: reportDates.length }),
    from: `${month}-01`,
    to: datesOf(month).slice(-1)[0],
    missingDays: datesOf(month).filter((d) => !have.has(d)),
  }
}

module.exports = {
  buildReportSummary,
  kasseMonth,
  kasseMonthOn,
  calendarConfig,
  openDates,
  datesOf,
  listMonths,
}
