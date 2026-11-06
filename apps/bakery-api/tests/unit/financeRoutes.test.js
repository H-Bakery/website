/**
 * Finanz-Endpunkte (`finance.routes.js`) gegen eine eigene Express-Instanz
 * mit synthetischen Daten, hinter der Test-Wache (`tests/helpers/roleGuards.js`).
 * Es wird nichts aus `hq` gelesen: die Datei liegt in einem Temp-Verzeichnis.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const financeRoutes = require('../../src/routes/finance.routes')
const { testRoleGuards } = require('../helpers/roleGuards')
const {
  buildSyntheticSummary,
  FAKE_IBANS,
  FAKE_NAMES,
} = require('../fixtures/finance-summary.synthetic')

const silentLog = { log() {}, warn: jest.fn(), error() {} }

function buildApp({ financeDir, summary } = {}) {
  const dir =
    financeDir || fs.mkdtempSync(path.join(os.tmpdir(), 'finance-test-'))
  if (summary !== null) {
    fs.writeFileSync(
      path.join(dir, 'finance-summary.json'),
      JSON.stringify(summary || buildSyntheticSummary())
    )
  }
  const app = express()
  app.use(express.json())
  const auth = testRoleGuards()
  financeRoutes.install(app, auth, { financeDir: dir, log: silentLog })
  return { app, dir, auth }
}

/** Das „Token“ der Test-Wache ist die Rolle (tests/helpers/roleGuards.js). */
const ROLE_OF = { chefin: 'inhaber', verkauf: 'verkauf' }
async function login(_app, username) {
  return { body: { data: { token: ROLE_OF[username] } } }
}

describe('finance.routes - Rollenschutz', () => {
  let app
  beforeAll(() => {
    ;({ app } = buildApp())
  })

  it('ohne Token 401', async () => {
    for (const url of ['/api/finance/summary', '/api/finance/months']) {
      const res = await request(app).get(url)
      expect(res.status).toBe(401)
      expect(res.body).toMatchObject({ success: false, error: 'unauthorized' })
      expect(res.body.message).toBeTruthy()
      expect(res.body).not.toHaveProperty('data')
    }
  })

  it('als verkauf 403', async () => {
    const { body } = await login(app, 'verkauf', 'geheim-2')
    for (const url of ['/api/finance/summary', '/api/finance/months']) {
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${body.data.token}`)
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ success: false, error: 'forbidden' })
      expect(res.body.message).toMatch(/Berechtigung/)
      expect(JSON.stringify(res.body)).not.toContain('umsatz')
    }
  })

  it('als inhaber 200', async () => {
    const { body } = await login(app, 'chefin', 'geheim-1')
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.data.months).toHaveLength(3)
  })
})

describe('finance.routes - Inhalt', () => {
  let app
  let token
  beforeAll(async () => {
    ;({ app } = buildApp())
    const { body } = await login(app, 'chefin', 'geheim-1')
    token = body.data.token
  })

  it('liefert die Zusammenfassung ohne IBANs, Namen und Einzelbuchungen', async () => {
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data).not.toHaveProperty('accounts')
    expect(data).not.toHaveProperty('top_counterparties')
    expect(data.uncategorized).toEqual({ count: 3, amount: -500 })
    const text = res.text
    for (const iban of FAKE_IBANS) expect(text).not.toContain(iban)
    for (const name of FAKE_NAMES) expect(text).not.toContain(name)
    expect(data.derived.overview.net_change).toBe(7200)
    expect(data.derived.invariant.ok).toBe(true)
    expect(data.derived.cost_structure[0].category).toBe('wareneinsatz')
    expect(data.generated_at).toBe('2026-04-01T08:00:00+02:00')
  })

  it('liefert die Monatsreihe, optional eingeschränkt', async () => {
    const all = await request(app)
      .get('/api/finance/months')
      .set('Authorization', `Bearer ${token}`)
    expect(all.status).toBe(200)
    expect(all.body.data.months.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
    expect(all.body.data.months[0]).toMatchObject({
      income: 10000,
      expense: -7000,
      result: 3000,
      neutral: -500,
      net_change: 2500,
    })

    const ranged = await request(app)
      .get('/api/finance/months?from=2026-02&to=2026-02')
      .set('Authorization', `Bearer ${token}`)
    expect(ranged.body.data.months).toHaveLength(1)
    expect(ranged.body.data.overview.months).toBe(1)
    expect(ranged.body.data.from).toBe('2026-02')
  })

  it('weist kaputte Zeitraum-Parameter mit 400 und deutschem Text ab', async () => {
    const bad = await request(app)
      .get('/api/finance/months?from=2026-2')
      .set('Authorization', `Bearer ${token}`)
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ success: false, error: 'validation' })
    expect(bad.body.message).toMatch(/JJJJ-MM/)

    const reversed = await request(app)
      .get('/api/finance/months?from=2026-03&to=2026-01')
      .set('Authorization', `Bearer ${token}`)
    expect(reversed.status).toBe(400)
  })
})

describe('finance.routes - fehlende oder kaputte Daten', () => {
  it('fehlendes Verzeichnis: no-data ohne Absturz, mit Hinweis im Log', async () => {
    const missing = path.join(
      os.tmpdir(),
      'finance-gibt-es-nicht-' + Date.now()
    )
    const app = express()
    app.use(express.json())
    const log = { log() {}, warn: jest.fn(), error() {} }
    const auth = testRoleGuards()
    financeRoutes.install(app, auth, { financeDir: missing, log })
    const { body } = await login(app, 'chefin', 'geheim-1')

    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      status: 'no-data',
      data: null,
    })
    expect(res.body.message).toMatch(/nicht gefunden/)
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('HQ finance summary not found')
    )

    const months = await request(app)
      .get('/api/finance/months')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(months.body.status).toBe('no-data')
  })

  it('falsche schema_version: no-data, keine Beispieldaten', async () => {
    const raw = buildSyntheticSummary()
    raw.schema_version = 99
    const { app } = buildApp({ summary: raw })
    const { body } = await login(app, 'chefin', 'geheim-1')
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('no-data')
    expect(res.body.data).toBeNull()
    expect(res.body.message).toMatch(/schema_version/)
  })

  it('kaputtes JSON: no-data', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-test-'))
    fs.writeFileSync(path.join(dir, 'finance-summary.json'), '{ kaputt')
    const { app } = buildApp({ financeDir: dir, summary: null })
    const { body } = await login(app, 'chefin', 'geheim-1')
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.body.status).toBe('no-data')
  })

  it('auch ohne Daten bleibt der Rollenschutz: 401 ohne Token', async () => {
    const { app } = buildApp({ summary: null })
    const res = await request(app).get('/api/finance/summary')
    expect(res.status).toBe(401)
  })
})
