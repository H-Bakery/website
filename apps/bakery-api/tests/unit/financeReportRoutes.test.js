/**
 * `/api/finance/year` und `/api/finance/month` (finance.routes.js) gegen eine
 * eigene Express-Instanz: synthetische Zusammenfassung und Kassenberichte in
 * Temp-Verzeichnissen, nichts aus `hq`.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const financeRoutes = require('../../src/routes/finance.routes')
const { testRoleGuards } = require('../helpers/roleGuards')
const { buildReportSummary } = require('../fixtures/finance-report.synthetic')
const {
  FAKE_IBANS,
  FAKE_NAMES,
} = require('../fixtures/finance-summary.synthetic')

const silentLog = { log() {}, warn() {}, error() {} }

/** Ein Kassentag: ein Bar-Bon über `cash`, ein Karten-Bon über `card`. */
function reportFile(date, cash, card) {
  const tx = (id, payment, total) => ({
    id,
    timestamp: `${date}T09:00:00+01:00`,
    type: 'sale',
    user: 'Kasse',
    payment,
    total,
    items: [
      {
        product: 'Testbrot',
        product_id: '101',
        quantity: 1,
        price: total,
        total,
      },
    ],
  })
  return {
    date,
    register_id: '4711',
    report_number: 1,
    company: 'Testbäckerei',
    transactions: [
      tx(`B-${date}`, 'Bar', cash),
      tx(`K-${date}`, 'Unbar', card),
    ],
  }
}

function buildApp({ summary } = {}) {
  const financeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finrep-fin-'))
  const reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finrep-rep-'))
  const raw = summary || buildReportSummary()
  // Rohdaten tragen Namen und IBANs - die dürfen nie in einer Antwort landen.
  raw.accounts = FAKE_IBANS
  raw.top_counterparties = [{ name: FAKE_NAMES[0], amount: -1, count: 1 }]
  raw.uncategorized = {
    count: 2,
    amount: -150,
    transactions: [{ counterparty: FAKE_NAMES[1], amount: -150 }],
  }
  fs.writeFileSync(
    path.join(financeDir, 'finance-summary.json'),
    JSON.stringify(raw)
  )
  const converted = path.join(reportsDir, 'converted')
  fs.mkdirSync(converted)
  // März 2026: zwei Kassentage, je 200 bar + 100 Karte.
  for (const date of ['2026-03-03', '2026-03-04']) {
    fs.writeFileSync(
      path.join(converted, `${date}_4711.json`),
      JSON.stringify(reportFile(date, 200, 100))
    )
  }
  const app = express()
  financeRoutes.install(app, testRoleGuards(), {
    financeDir,
    reportsDir,
    log: silentLog,
  })
  return app
}

const asOwner = (req) => req.set('Authorization', 'Bearer inhaber')

describe('finance.routes - Jahresabschluss und Monatsanalyse', () => {
  const app = buildApp()
  const urls = [
    '/api/finance/year',
    '/api/finance/year/2026',
    '/api/finance/month',
    '/api/finance/month/2026-03',
  ]

  it('nur für inhaber', async () => {
    for (const url of urls) {
      expect((await request(app).get(url)).status).toBe(401)
      const res = await request(app)
        .get(url)
        .set('Authorization', 'Bearer verkauf')
      expect(res.status).toBe(403)
      expect(JSON.stringify(res.body)).not.toContain('umsatz')
    }
  })

  it('keine Namen, keine IBANs, keine Einzelbuchungen', async () => {
    for (const url of urls) {
      const res = await asOwner(request(app).get(url))
      expect(res.status).toBe(200)
      const text = JSON.stringify(res.body)
      for (const secret of [...FAKE_IBANS, ...FAKE_NAMES]) {
        expect(text).not.toContain(secret)
      }
      expect(text).not.toContain('top_counterparties')
    }
  })

  it('ohne Jahr: das jüngste; mit Kassenabgleich', async () => {
    const res = await asOwner(request(app).get('/api/finance/year'))
    expect(res.body).toMatchObject({ success: true, status: 'ok' })
    expect(res.body.data).toMatchObject({ year: '2026', status: 'provisional' })
    expect(res.body.data.months[2].kasse).toMatchObject({
      revenue: 600,
      days: 2,
      cash: 400,
      card: 200,
    })
    expect(res.body.data.years).toEqual(['2026', '2025'])
  })

  it('ohne Monat: der jüngste vollständige', async () => {
    const res = await asOwner(request(app).get('/api/finance/month'))
    expect(res.body.data.month).toBe('2026-04')
  })

  it('Monat mit Kasse und Abgleich', async () => {
    const res = await asOwner(request(app).get('/api/finance/month/2026-03'))
    expect(res.body.data.kasse).toMatchObject({ revenue: 600, avg_day: 300 })
    expect(res.body.data.reconciliation).toMatchObject({
      bank_cash: 6000,
      kasse_cash: 400,
    })
    expect(res.body.data.highlights.length).toBeGreaterThan(0)
  })

  it('ungültige Eingaben: 400 mit message und error', async () => {
    for (const url of ['/api/finance/year/26', '/api/finance/month/2026-3']) {
      const res = await asOwner(request(app).get(url))
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ success: false, error: 'validation' })
      expect(res.body.message).toBeTruthy()
    }
  })

  it('Zeitraum ohne Daten: no-data, kein Fehler', async () => {
    for (const url of [
      '/api/finance/year/2019',
      '/api/finance/month/2019-01',
    ]) {
      const res = await asOwner(request(app).get(url))
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ status: 'no-data', data: null })
      expect(res.body.message).toContain('2019')
    }
  })

  it('ohne Finanzdatei: no-data', async () => {
    const app2 = express()
    financeRoutes.install(app2, testRoleGuards(), {
      financeDir: fs.mkdtempSync(path.join(os.tmpdir(), 'finrep-empty-')),
      reportsDir: fs.mkdtempSync(path.join(os.tmpdir(), 'finrep-empty-')),
      log: silentLog,
    })
    const res = await asOwner(request(app2).get('/api/finance/year'))
    expect(res.body.status).toBe('no-data')
  })
})
