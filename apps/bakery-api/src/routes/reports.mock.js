/**
 * Kassenberichte für den Mock-Server (`simple-server.js`).
 *
 * Liest die Tagesfiles aus `hq/data/reports/converted` (Pfad über
 * `HQ_REPORTS_DIR` oder `<website>/../hq/data/reports`) und rechnet mit
 * `services/reports.core.js` - derselben Datei, die auch der Loader der
 * Management-App benutzt. Fehlt das Verzeichnis, antworten die Endpunkte
 * mit leeren Listen bzw. `status: 'no-data'`, nie mit einem Absturz.
 *
 *   GET /api/reports/daily?from=&to=      Tage im Zeitraum (ohne Positionen)
 *   GET /api/reports/daily/:date          ein Tag im Detail
 *   GET /api/reports/monthly/:month       Monatsaggregat
 *
 * Dazu die Analyse-Endpunkte, die `analyticsService` im Frontend erwartet,
 * ebenfalls aus den echten Tagesfiles:
 *
 *   GET /api/analytics/revenue-trends?startDate=&endDate=&granularity=
 *   GET /api/analytics/product-performance?startDate=&endDate=&type=&limit=
 *   GET /api/analytics/payment-methods?startDate=&endDate=
 *   GET /api/analytics/summary?startDate=&endDate=
 *
 * Fehlerantworten setzen `message` zusätzlich zu `error`, weil der
 * `ApiClient` `new Error(data.message)` wirft.
 */

'use strict'

const path = require('path')
const core = require('../services/reports.core')
const files = require('../services/reports-files.core')

/** Zeitraum-Obergrenze: eine Anfrage über Jahre liest sonst hunderte Dateien. */
const MAX_RANGE_DAYS = 400

function fail(res, status, error, message) {
  return res.status(status).json({ error, message })
}

function parseRange(query, fromKey, toKey) {
  const from = String(query[fromKey] || '')
  const to = String(query[toKey] || '')
  if (!core.isValidDate(from) || !core.isValidDate(to)) {
    return {
      error: 'invalid_range',
      message: `Bitte ${fromKey} und ${toKey} als YYYY-MM-DD angeben.`,
    }
  }
  if (from > to) {
    return {
      error: 'invalid_range',
      message: 'Das Startdatum liegt nach dem Enddatum.',
    }
  }
  if (core.listDates(from, to).length > MAX_RANGE_DAYS) {
    return {
      error: 'range_too_large',
      message: `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen.`,
    }
  }
  return { from, to }
}

function registerReportsRoutes(app, options) {
  const opts = options || {}
  const reportsDir =
    opts.reportsDir ||
    files.resolveReportsDir(path.join(__dirname, '..', '..', '..', '..'))

  const readRange = (from, to) =>
    files.readDailyReportsInRange(reportsDir, from, to)

  // --- Kassenberichte ------------------------------------------------------

  app.get('/api/reports/daily', (req, res) => {
    const range = parseRange(req.query, 'from', 'to')
    if (range.error) return fail(res, 400, range.error, range.message)

    const reports = readRange(range.from, range.to)
    const byDate = new Map(reports.map((r) => [r.date, r]))
    const days = core
      .listDates(range.from, range.to)
      .map((date) =>
        byDate.has(date)
          ? core.toDailySummary(byDate.get(date))
          : { status: 'no-data', date, weekday: core.weekdayLabel(date) }
      )
    res.json({
      from: range.from,
      to: range.to,
      available: files.reportsAvailable(reportsDir),
      days,
      summary: core.aggregateRange(range.from, range.to, reports),
    })
  })

  app.get('/api/reports/daily/:date', (req, res) => {
    const date = String(req.params.date || '')
    if (!core.isValidDate(date)) {
      return fail(
        res,
        400,
        'invalid_date',
        'Bitte das Datum als YYYY-MM-DD angeben.'
      )
    }
    res.json(files.readDailyReport(reportsDir, date))
  })

  app.get('/api/reports/monthly/:month', (req, res) => {
    const month = String(req.params.month || '')
    if (!core.isValidMonth(month)) {
      return fail(
        res,
        400,
        'invalid_month',
        'Bitte den Monat als YYYY-MM angeben.'
      )
    }
    const { from, to } = core.monthBounds(month)
    const reports = readRange(from, to)
    res.json({
      ...core.aggregateMonth(month, reports),
      days: reports.map(core.toDailySummary),
    })
  })

  // --- Analysen (Vertrag von `analyticsService`) -------------------------

  app.get('/api/analytics/revenue-trends', (req, res) => {
    const range = parseRange(req.query, 'startDate', 'endDate')
    if (range.error) return fail(res, 400, range.error, range.message)
    const granularity = ['daily', 'weekly', 'monthly'].includes(
      req.query.granularity
    )
      ? req.query.granularity
      : 'daily'
    res.json({
      data: core.groupByPeriod(readRange(range.from, range.to), granularity),
    })
  })

  app.get('/api/analytics/product-performance', (req, res) => {
    const range = parseRange(req.query, 'startDate', 'endDate')
    if (range.error) return fail(res, 400, range.error, range.message)
    const limit = Math.max(
      1,
      Math.min(200, Number.parseInt(req.query.limit, 10) || 10)
    )
    const summary = core.aggregateRange(
      range.from,
      range.to,
      readRange(range.from, range.to)
    )
    let products = summary.status === 'ok' ? summary.products : []
    if (req.query.type === 'bottom') {
      // Schwache Produkte: nur, was überhaupt verkauft wurde - ein Produkt
      // mit Nettomenge <= 0 ist ein Storno-Rest, kein Ladenhüter.
      products = products
        .filter((p) => p.quantity > 0)
        .slice()
        .reverse()
    }
    res.json({
      data: products.slice(0, limit).map((p, i) => ({
        productId: p.productId || p.productName,
        productName: p.productName,
        quantitySold: p.quantity,
        revenue: p.revenue,
        rank: i + 1,
      })),
    })
  })

  app.get('/api/analytics/payment-methods', (req, res) => {
    const range = parseRange(req.query, 'startDate', 'endDate')
    if (range.error) return fail(res, 400, range.error, range.message)
    const summary = core.aggregateRange(
      range.from,
      range.to,
      readRange(range.from, range.to)
    )
    if (summary.status !== 'ok') return res.json({ data: [] })
    const total = summary.revenue
    const entry = (method, bucket) => ({
      method,
      count: bucket.count,
      amount: bucket.amount,
      percentage:
        total > 0 ? Math.round((bucket.amount / total) * 1000) / 10 : 0,
    })
    res.json({
      data: [
        entry(core.PAYMENT_LABELS.Bar, summary.payments.cash),
        entry(core.PAYMENT_LABELS.Unbar, summary.payments.card),
        entry(core.PAYMENT_LABELS.Keine, summary.payments.other),
      ].filter((e) => e.count > 0),
    })
  })

  app.get('/api/analytics/summary', (req, res) => {
    const range = parseRange(req.query, 'startDate', 'endDate')
    if (range.error) return fail(res, 400, range.error, range.message)
    const summary = core.aggregateRange(
      range.from,
      range.to,
      readRange(range.from, range.to)
    )
    if (summary.status !== 'ok') return res.json({ data: null })
    // „Meistverkauft" heißt Stückzahl, nicht Umsatz.
    const top = [...summary.products]
      .filter((p) => p.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)[0]
    res.json({
      data: {
        totalRevenue: summary.revenue,
        totalTransactions: summary.receiptCount,
        avgTransactionValue: summary.avgReceipt,
        cashPercentage: summary.cashShare,
        topSellingProduct: top
          ? {
              productId: top.productId || top.productName,
              productName: top.productName,
              quantitySold: top.quantity,
              revenue: top.revenue,
            }
          : undefined,
        busiestDay: summary.bestDay.date,
        dayCount: summary.dayCount,
      },
    })
  })

  return { reportsDir }
}

module.exports = registerReportsRoutes
