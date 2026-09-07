/**
 * Rechenlogik für die Kassenberichte aus `hq/data/reports/converted`.
 *
 * Bewusst dependency-freies CommonJS: dieselbe Datei wird vom Mock-Server
 * (`src/routes/reports.mock.js`), vom Loader der Management-App
 * (`apps/bakery-management/src/lib/reports.ts`) und von den Tests
 * (`tests/unit/reportsCore.test.js`) benutzt. Es gibt damit genau *eine*
 * Implementierung der Formeln - keine Kopie, die auseinanderlaufen kann.
 * Dateien lesen die Aufrufer selbst; hier kommen nur geparste Tagesdateien an.
 *
 * Ein Tagesfile (`YYYY-MM-DD_<Kasse>[_N].json`) enthält die Bons eines
 * Kassenabschlusses. Ein zweiter Abschluss am selben Tag (`_2.json`) wird zum
 * Tag addiert, er ist kein eigener Tag.
 *
 *   Umsatz     = Σ Bon-Total aller gezählten Bons (Stornos negativ, sie
 *                neutralisieren so ihre Fehlbuchung)
 *   Bons       = Anzahl Verkaufsbons (ohne Storno-Gegenbuchungen und ohne
 *                abgebrochene Belege)
 *   Ø Bon      = Umsatz / Bons
 *   Zahlungsmix: `Bar` = Bargeld, `Unbar` = Karte, `Keine` = ohne Zahlung
 *                (Gutscheineinlösung, 0-Euro-Bons)
 *
 * Abgebrochene Belege (`type: 'cancelled'`, Kasse: „AV-Belegabbruch") tragen
 * einen Betrag, sind aber nie kassiert worden - sie zählen weder zum Umsatz
 * noch zu den Bons. Genau mit dieser Regel stimmt die Summe mit dem
 * Kassenabschluss (`daily_summary.total_revenue`) der Tagesfiles überein.
 *
 * Positionsmengen sind je Tag mit Vorsicht zu lesen: Fehleingaben werden an
 * der Kasse durch eine negative Gegenbuchung ausgeglichen, die auch am
 * Folgetag liegen kann. Die Tagessumme stimmt dadurch, die Menge eines
 * einzelnen Produkts an einem einzelnen Tag nicht immer. Produkte mit
 * negativer Nettomenge bleiben deshalb sichtbar (`quantity < 0`) statt
 * stillschweigend zu verschwinden.
 */

'use strict'

/** Bon-Typen, die der Konverter vergibt. */
const TRANSACTION_TYPES = [
  'sale',
  'storno',
  'cancelled',
  'voucher_sale',
  'voucher_redemption',
]

/** Zahlungsarten, wie sie in den Tagesfiles stehen, mit Anzeigename. */
const PAYMENT_LABELS = {
  Bar: 'Bar',
  Unbar: 'Karte',
  Keine: 'Ohne Zahlung',
}

const WEEKDAY_LABELS = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const MONTH_LABELS = [
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/
const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})_([^_.]+)(?:_(\d+))?\.json$/

/** Geldbeträge werden intern in ganzen Cent gerechnet, um Float-Drift zu vermeiden. */
function toCents(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function fromCents(cents) {
  return Math.round(cents) / 100
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function isValidMonth(value) {
  return (
    typeof value === 'string' &&
    MONTH_RE.test(value) &&
    isValidDate(`${value}-01`)
  )
}

/** Wochentag (0 = Sonntag … 6 = Samstag) eines `YYYY-MM-DD`, zeitzonenfrei. */
function weekdayIndex(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function weekdayLabel(date) {
  return WEEKDAY_LABELS[weekdayIndex(date)]
}

function weekdayShort(date) {
  return WEEKDAY_SHORT[weekdayIndex(date)]
}

function monthLabel(month) {
  const [year, m] = month.split('-')
  return `${MONTH_LABELS[Number(m) - 1]} ${year}`
}

/** `YYYY-MM-DD` um n Tage verschieben. */
function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Alle Kalendertage von `from` bis `to` (beide inklusive). */
function listDates(from, to) {
  const dates = []
  if (!isValidDate(from) || !isValidDate(to) || from > to) return dates
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d)
  return dates
}

/** Erster und letzter Tag eines Monats `YYYY-MM`. */
function monthBounds(month) {
  const [year, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  }
}

/**
 * ISO-Woche eines Tages als `YYYY-Www` (Montag ist Wochenanfang, die Woche
 * gehört zum Jahr ihres Donnerstags).
 */
function isoWeek(date) {
  const d = new Date(`${date}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Montag der ISO-Woche, in der `date` liegt. */
function isoWeekStart(date) {
  const day = weekdayIndex(date) || 7
  return addDays(date, 1 - day)
}

/**
 * Dateiname eines Tagesfiles zerlegen. `null`, wenn er nicht dem Muster
 * `YYYY-MM-DD_<Kasse>[_N].json` folgt.
 */
function parseReportFilename(filename) {
  const m = FILENAME_RE.exec(String(filename || ''))
  if (!m || !isValidDate(m[1])) return null
  return {
    filename,
    date: m[1],
    registerId: m[2],
    closing: m[3] ? Number(m[3]) : 1,
  }
}

function emptyPayments() {
  return {
    cash: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  }
}

function paymentBucket(payment) {
  if (payment === 'Bar') return 'cash'
  if (payment === 'Unbar') return 'card'
  return 'other'
}

function share(part, whole) {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

/**
 * Bons eines oder mehrerer Abschlüsse zu einem Tag verdichten.
 *
 * `closings` ist eine Liste geparster Tagesfiles (`{ filename?, data }`);
 * mehrere Einträge sind der zweite Abschluss desselben Tages. Ohne Einträge
 * kommt `{ status: 'no-data' }` zurück - der Unterschied zwischen „kein
 * Bericht" und „Umsatz 0" muss bis in die Oberfläche erhalten bleiben.
 */
function aggregateDay(date, closings) {
  const list = Array.isArray(closings) ? closings.filter(Boolean) : []
  if (!isValidDate(date) || list.length === 0) {
    return {
      status: 'no-data',
      date,
      weekday: isValidDate(date) ? weekdayLabel(date) : null,
    }
  }

  const acc = {
    revenue: 0,
    receiptCount: 0,
    stornoCount: 0,
    stornoAmount: 0,
    cancelledCount: 0,
    payments: emptyPayments(),
    products: new Map(),
    hours: new Map(),
    firstReceipt: null,
    lastReceipt: null,
  }
  const closingInfos = []

  for (const entry of list) {
    const data = entry && entry.data ? entry.data : entry
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : []
    closingInfos.push({
      filename: entry.filename || null,
      registerId: data.register_id != null ? String(data.register_id) : null,
      reportNumber: data.report_number != null ? data.report_number : null,
      transactionCount: transactions.length,
    })

    for (const tx of transactions) {
      if (!tx || typeof tx !== 'object') continue
      if (tx.type === 'cancelled') {
        acc.cancelledCount += 1
        continue
      }
      const total = toCents(tx.total)
      acc.revenue += total
      if (tx.type === 'storno') {
        acc.stornoCount += 1
        acc.stornoAmount += total
      } else {
        acc.receiptCount += 1
      }

      const bucket = acc.payments[paymentBucket(tx.payment)]
      bucket.amount += total
      bucket.count += 1

      const time = receiptTime(tx.timestamp)
      if (time) {
        if (!acc.firstReceipt || time < acc.firstReceipt)
          acc.firstReceipt = time
        if (!acc.lastReceipt || time > acc.lastReceipt) acc.lastReceipt = time
        const hour = time.slice(0, 2)
        const h = acc.hours.get(hour) || { hour, revenue: 0, receiptCount: 0 }
        h.revenue += total
        if (tx.type !== 'storno') h.receiptCount += 1
        acc.hours.set(hour, h)
      }

      for (const item of Array.isArray(tx.items) ? tx.items : []) {
        if (!item || typeof item !== 'object') continue
        const key =
          item.product_id != null && item.product_id !== ''
            ? String(item.product_id)
            : `name:${item.product || ''}`
        const p = acc.products.get(key) || {
          productId: item.product_id != null ? String(item.product_id) : null,
          productName: item.product || '',
          quantity: 0,
          revenue: 0,
        }
        const qty = Number(item.quantity)
        p.quantity += Number.isFinite(qty) ? qty : 0
        p.revenue += toCents(item.total)
        acc.products.set(key, p)
      }
    }
  }

  const products = [...acc.products.values()]
    .map((p) => ({ ...p, revenue: fromCents(p.revenue) }))
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.quantity - a.quantity ||
        a.productName.localeCompare(b.productName, 'de')
    )

  const hours = [...acc.hours.values()]
    .map((h) => ({ ...h, revenue: fromCents(h.revenue) }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  return {
    status: 'ok',
    date,
    weekday: weekdayLabel(date),
    closings: closingInfos,
    closingCount: closingInfos.length,
    revenue: fromCents(acc.revenue),
    receiptCount: acc.receiptCount,
    avgReceipt:
      acc.receiptCount > 0 ? fromCents(acc.revenue / acc.receiptCount) : 0,
    stornoCount: acc.stornoCount,
    stornoAmount: fromCents(acc.stornoAmount),
    cancelledCount: acc.cancelledCount,
    payments: finalizePayments(acc.payments),
    cashShare: share(acc.payments.cash.amount, acc.revenue),
    cardShare: share(acc.payments.card.amount, acc.revenue),
    firstReceipt: acc.firstReceipt,
    lastReceipt: acc.lastReceipt,
    products,
    hours,
  }
}

/** `HH:MM` aus einem ISO-Zeitstempel, ohne Zeitzonenumrechnung (Kassenzeit). */
function receiptTime(timestamp) {
  const m = /T(\d{2}):(\d{2})/.exec(String(timestamp || ''))
  return m ? `${m[1]}:${m[2]}` : null
}

function finalizePayments(p) {
  return {
    cash: { amount: fromCents(p.cash.amount), count: p.cash.count },
    card: { amount: fromCents(p.card.amount), count: p.card.count },
    other: { amount: fromCents(p.other.amount), count: p.other.count },
  }
}

/** Listeneintrag ohne Positionen und Stundenverlauf. */
function toDailySummary(report) {
  if (!report || report.status !== 'ok') return report
  // eslint-disable-next-line no-unused-vars
  const { products, hours, ...summary } = report
  return summary
}

/**
 * Mehrere Tage zu einem Zeitraum verdichten. `reports` sind Ergebnisse von
 * `aggregateDay`; Einträge mit `status: 'no-data'` werden übersprungen, aber
 * als Lücke gezählt.
 */
function aggregateRange(from, to, reports) {
  const days = (Array.isArray(reports) ? reports : [])
    .filter((r) => r && r.status === 'ok')
    .sort((a, b) => a.date.localeCompare(b.date))

  const base = {
    from,
    to,
    dayCount: days.length,
    missingDays: listDates(from, to).filter(
      (d) => !days.some((r) => r.date === d)
    ),
  }
  if (days.length === 0) return { status: 'no-data', ...base }

  let revenue = 0
  let receiptCount = 0
  let stornoCount = 0
  let cancelledCount = 0
  const payments = emptyPayments()
  const products = new Map()
  const weekdays = new Map()
  let best = null
  let weakest = null

  for (const day of days) {
    const dayRevenue = toCents(day.revenue)
    revenue += dayRevenue
    receiptCount += day.receiptCount
    stornoCount += day.stornoCount
    cancelledCount += day.cancelledCount
    for (const key of ['cash', 'card', 'other']) {
      payments[key].amount += toCents(day.payments[key].amount)
      payments[key].count += day.payments[key].count
    }
    for (const p of Array.isArray(day.products) ? day.products : []) {
      const key = p.productId != null ? p.productId : `name:${p.productName}`
      const acc = products.get(key) || {
        productId: p.productId,
        productName: p.productName,
        quantity: 0,
        revenue: 0,
      }
      acc.quantity += p.quantity
      acc.revenue += toCents(p.revenue)
      products.set(key, acc)
    }
    const wd = weekdayIndex(day.date)
    const w = weekdays.get(wd) || {
      weekday: WEEKDAY_LABELS[wd],
      dayCount: 0,
      revenue: 0,
      receiptCount: 0,
    }
    w.dayCount += 1
    w.revenue += dayRevenue
    w.receiptCount += day.receiptCount
    weekdays.set(wd, w)

    if (!best || dayRevenue > toCents(best.revenue)) best = day
    if (!weakest || dayRevenue < toCents(weakest.revenue)) weakest = day
  }

  const dayRef = (d) => ({
    date: d.date,
    weekday: d.weekday,
    revenue: d.revenue,
    receiptCount: d.receiptCount,
  })

  return {
    status: 'ok',
    ...base,
    revenue: fromCents(revenue),
    receiptCount,
    avgReceipt: receiptCount > 0 ? fromCents(revenue / receiptCount) : 0,
    avgDayRevenue: fromCents(revenue / days.length),
    stornoCount,
    cancelledCount,
    payments: finalizePayments(payments),
    cashShare: share(payments.cash.amount, revenue),
    cardShare: share(payments.card.amount, revenue),
    bestDay: dayRef(best),
    weakestDay: dayRef(weakest),
    weekdays: [...weekdays.entries()]
      // Montag zuerst, Sonntag zuletzt
      .sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7))
      .map(([, w]) => ({
        ...w,
        revenue: fromCents(w.revenue),
        avgRevenue: fromCents(w.revenue / w.dayCount),
      })),
    products: [...products.values()]
      .map((p) => ({ ...p, revenue: fromCents(p.revenue) }))
      .sort(
        (a, b) =>
          b.revenue - a.revenue ||
          b.quantity - a.quantity ||
          a.productName.localeCompare(b.productName, 'de')
      ),
  }
}

/** Monatsaggregat: `aggregateRange` über die Monatsgrenzen plus Anzeigename. */
function aggregateMonth(month, reports) {
  if (!isValidMonth(month)) {
    return { status: 'no-data', month, label: null, dayCount: 0 }
  }
  const { from, to } = monthBounds(month)
  const range = aggregateRange(
    from,
    to,
    (Array.isArray(reports) ? reports : []).filter(
      (r) => r && typeof r.date === 'string' && r.date.startsWith(`${month}-`)
    )
  )
  return { ...range, month, label: monthLabel(month) }
}

/**
 * Tagesberichte zu einer Umsatzreihe bündeln (`daily` | `weekly` | `monthly`).
 * Jeder Punkt trägt Datum des Periodenanfangs, Umsatz, Bons und die Zahl der
 * ausgewerteten Tage - Perioden ohne Bericht fehlen, sie sind nicht 0.
 */
function groupByPeriod(reports, granularity) {
  const days = (Array.isArray(reports) ? reports : [])
    .filter((r) => r && r.status === 'ok')
    .sort((a, b) => a.date.localeCompare(b.date))
  const keyOf = (date) => {
    if (granularity === 'weekly') return isoWeekStart(date)
    if (granularity === 'monthly') return `${date.slice(0, 7)}-01`
    return date
  }
  const groups = new Map()
  for (const day of days) {
    const key = keyOf(day.date)
    const g = groups.get(key) || {
      date: key,
      revenue: 0,
      transactionCount: 0,
      dayCount: 0,
    }
    g.revenue += toCents(day.revenue)
    g.transactionCount += day.receiptCount
    g.dayCount += 1
    groups.set(key, g)
  }
  return [...groups.values()].map((g) => ({
    ...g,
    revenue: fromCents(g.revenue),
    ...(granularity === 'weekly' ? { week: isoWeek(g.date) } : {}),
  }))
}

module.exports = {
  TRANSACTION_TYPES,
  PAYMENT_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  MONTH_LABELS,
  toCents,
  fromCents,
  isValidDate,
  isValidMonth,
  weekdayIndex,
  weekdayLabel,
  weekdayShort,
  monthLabel,
  addDays,
  listDates,
  monthBounds,
  isoWeek,
  isoWeekStart,
  parseReportFilename,
  aggregateDay,
  toDailySummary,
  aggregateRange,
  aggregateMonth,
  groupByPeriod,
}
