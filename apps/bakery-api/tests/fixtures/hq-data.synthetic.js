/**
 * A synthetic `hq/data` tree for reports, analytics, finance and Tagesziel
 * (B4): `<root>/reports/converted/*.json`, `<root>/finance/finance-summary.json`
 * and `<root>/finance/config/targets.json`. Every product, amount and name is
 * invented - nothing here comes from the private `hq` repo.
 *
 *   const { writeSyntheticHq } = require('../fixtures/hq-data.synthetic')
 *   const { reportsDir, financeDir } = writeSyntheticHq(fs.mkdtempSync(...))
 *
 * Six weeks of trading days (2026-02-17 … 2026-03-31, Mondays closed) with
 * cash, card (`Unbar`) and voucher (`Keine`) Bons, a cancelled receipt, a
 * second closing on Saturdays and one missing Thursday (a gap, not 0 €).
 */

'use strict'

const fs = require('fs')
const path = require('path')

const { buildSyntheticSummary } = require('./finance-summary.synthetic')

const FIRST_DAY = '2026-02-17'
const LAST_DAY = '2026-03-31'
/** A trading day without a report file. */
const MISSING_DAY = '2026-03-05'

const PRODUCTS = [
  { product: 'Testbrot', product_id: '901', price: 4 },
  { product: 'Testbrötchen', product_id: '902', price: 0.5 },
  { product: 'Testkuchen', product_id: '903', price: 2.5 },
]

function listDates(from, to) {
  const out = []
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** ISO weekday, 1 = Monday. */
function isoWeekday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

function item(product, quantity) {
  return {
    product: product.product,
    product_id: product.product_id,
    quantity,
    price: product.price,
    total: Math.round(product.price * quantity * 100) / 100,
  }
}

function bon(date, n, payment, items, type = 'sale') {
  return {
    id: `T-${date}-${n}`,
    timestamp: `${date}T0${7 + (n % 3)}:1${n % 10}:00+01:00`,
    type,
    user: 'Kasse',
    payment,
    total: Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100,
    items,
  }
}

function closing(date, registerId, transactions) {
  return {
    date,
    register_id: registerId,
    report_number: 1,
    company: 'Testbäckerei',
    transactions,
  }
}

/** The day's Bons; the day of month varies the quantities a little. */
function transactionsFor(date) {
  const k = Number(date.slice(8, 10)) % 4
  const [brot, broetchen, kuchen] = PRODUCTS
  return [
    bon(date, 1, 'Bar', [item(brot, 1), item(broetchen, 4 + k)]),
    bon(date, 2, 'Unbar', [item(kuchen, 2), item(brot, 1)]),
    bon(date, 3, 'Bar', [item(broetchen, 6)]),
    bon(date, 4, 'Keine', [item(kuchen, 1)]),
    bon(date, 5, 'Bar', [item(brot, 2)], 'cancelled'),
  ]
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

/** Tagesziel config in `mode: 'derived'` (cost base from the summary). */
function syntheticTargetsConfig() {
  return {
    schema_version: 1,
    updated: '2026-03-01',
    mode: 'derived',
    cost_window_months: 3,
    variable_categories: ['wareneinsatz'],
    non_pos_revenue_monthly: null,
    private_draw_monthly: null,
    business_days_per_month: 24,
    weekday_window_months: 2,
    thresholds: { green: 1.0, amber: 0.9 },
    closed_weekdays: [1],
  }
}

/**
 * Writes the tree under `root` and returns its directories plus the day
 * range, so tests can ask for dates that exist.
 */
function writeSyntheticHq(root) {
  const reportsDir = path.join(root, 'reports')
  const financeDir = path.join(root, 'finance')
  const converted = path.join(reportsDir, 'converted')
  fs.mkdirSync(converted, { recursive: true })

  for (const date of listDates(FIRST_DAY, LAST_DAY)) {
    const iso = isoWeekday(date)
    if (iso === 1 || date === MISSING_DAY) continue
    writeJson(
      path.join(converted, `${date}_4711.json`),
      closing(date, '4711', transactionsFor(date))
    )
    if (iso === 6) {
      // Saturday: a second closing of the same register.
      writeJson(
        path.join(converted, `${date}_4711_2.json`),
        closing(date, '4711', [bon(date, 9, 'Unbar', [item(PRODUCTS[2], 4)])])
      )
    }
  }

  writeJson(
    path.join(financeDir, 'finance-summary.json'),
    buildSyntheticSummary()
  )
  writeJson(
    path.join(financeDir, 'config', 'targets.json'),
    syntheticTargetsConfig()
  )
  return {
    reportsDir,
    financeDir,
    firstDay: FIRST_DAY,
    lastDay: LAST_DAY,
    missingDay: MISSING_DAY,
  }
}

module.exports = { writeSyntheticHq, syntheticTargetsConfig, PRODUCTS }
