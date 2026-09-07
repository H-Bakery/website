/**
 * Anmeldung (`auth.mock.js`) und Finanz-Endpunkte (`finance.mock.js`) des
 * Mock-Servers, gegen eine eigene Express-Instanz mit synthetischen Daten.
 * Es wird nichts aus `hq` gelesen: die Datei liegt in einem Temp-Verzeichnis.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const { createAuth } = require('../../src/routes/auth.mock')
const financeRoutes = require('../../src/routes/finance.mock')
const {
  buildSyntheticSummary,
  FAKE_IBANS,
  FAKE_NAMES,
} = require('../fixtures/finance-summary.synthetic')

const USERS = [
  {
    id: 1,
    username: 'chefin',
    email: 'chefin@test.local',
    password: 'geheim-1',
    firstName: 'Test',
    lastName: 'Inhaberin',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    username: 'verkauf',
    email: 'verkauf@test.local',
    password: 'geheim-2',
    firstName: 'Test',
    lastName: 'Verkauf',
    role: 'staff',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

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
  const auth = createAuth({
    users: USERS,
    secret: 'test-secret',
    log: silentLog,
  })
  auth.install(app)
  financeRoutes.install(app, auth, { financeDir: dir, log: silentLog })
  return { app, dir, auth }
}

async function login(app, username, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: username, password })
  return res
}

describe('auth.mock - Anmeldung', () => {
  let app
  beforeAll(() => {
    ;({ app } = buildApp())
  })

  it('meldet den Admin an und liefert User, Token und Refresh-Token', async () => {
    const res = await login(app, 'chefin', 'geheim-1')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toMatchObject({
      id: 1,
      email: 'chefin@test.local',
      role: 'admin',
      isActive: true,
    })
    expect(res.body.data.user).not.toHaveProperty('password')
    expect(typeof res.body.data.token).toBe('string')
    expect(typeof res.body.data.refreshToken).toBe('string')
    expect(res.body.data.expiresIn).toBeGreaterThan(0)
  })

  it('akzeptiert auch `username` und Groß-/Kleinschreibung', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'CHEFIN', password: 'geheim-1' })
    expect(res.status).toBe(200)
  })

  it('lehnt falsches Passwort und unbekannten Benutzer mit 401 ab', async () => {
    const wrong = await login(app, 'chefin', 'falsch')
    expect(wrong.status).toBe(401)
    expect(wrong.body).toMatchObject({
      success: false,
      error: 'invalid_credentials',
    })
    expect(wrong.body.message).toMatch(/falsch/)

    const unknown = await login(app, 'niemand', 'geheim-1')
    expect(unknown.status).toBe(401)
  })

  it('verlangt Benutzername und Passwort (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toBeTruthy()
    expect(res.body.error).toBeTruthy()
  })

  it('GET /me liefert den Benutzer zum Token und 401 ohne Token', async () => {
    const { body } = await login(app, 'verkauf', 'geheim-2')
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(me.status).toBe(200)
    expect(me.body.data).toMatchObject({ id: 2, role: 'staff' })

    const anonymous = await request(app).get('/api/auth/me')
    expect(anonymous.status).toBe(401)
    expect(anonymous.body).toMatchObject({
      success: false,
      error: 'unauthorized',
    })
    expect(anonymous.body.message).toMatch(/Anmeldung/)

    const garbage = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer nicht.ein.token')
    expect(garbage.status).toBe(401)
  })

  it('refresh: mit Refresh-Token oder gültigem Access-Token, sonst 401', async () => {
    const { body } = await login(app, 'chefin', 'geheim-1')

    const viaRefresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: body.data.refreshToken })
    expect(viaRefresh.status).toBe(200)
    expect(typeof viaRefresh.body.data.token).toBe('string')

    const viaBearer = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${body.data.token}`)
      .send({ refreshToken: '' })
    expect(viaBearer.status).toBe(200)

    const none = await request(app).post('/api/auth/refresh').send({})
    expect(none.status).toBe(401)

    // Ein Refresh-Token ist kein Access-Token.
    const swapped = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.refreshToken}`)
    expect(swapped.status).toBe(401)
  })

  it('logout antwortet mit success', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('Tokens eines anderen Geheimnisses gelten nicht', async () => {
    const other = buildApp()
    const { body } = await login(other.app, 'chefin', 'geheim-1')
    const foreign = createAuth({
      users: USERS,
      secret: 'anderes',
      log: silentLog,
    })
    const app2 = express()
    foreign.install(app2)
    const res = await request(app2)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.status).toBe(401)
  })

  it('warnt beim Standardzugang aus der Umgebung', () => {
    const log = { log() {}, warn: jest.fn(), error() {} }
    const auth = createAuth({ env: {}, log })
    expect(auth.users).toHaveLength(1)
    expect(auth.users[0].role).toBe('admin')
    const warnings = log.warn.mock.calls.map((c) => c[0]).join('\n')
    expect(warnings).toMatch(/admin\/admin/)
    expect(warnings).toMatch(/JWT_SECRET/)
  })

  it('legt den Staff-Benutzer nur mit beiden Variablen an', () => {
    const log = { log() {}, warn() {}, error() {} }
    const withStaff = createAuth({
      env: {
        MOCK_ADMIN_USER: 'a',
        MOCK_ADMIN_PASSWORD: 'b',
        MOCK_STAFF_USER: 's',
        MOCK_STAFF_PASSWORD: 't',
        JWT_SECRET: 'x',
      },
      log,
    })
    expect(withStaff.users.map((u) => u.role)).toEqual(['admin', 'staff'])
    const withoutStaff = createAuth({
      env: {
        MOCK_ADMIN_USER: 'a',
        MOCK_ADMIN_PASSWORD: 'b',
        MOCK_STAFF_USER: 's',
      },
      log,
    })
    expect(withoutStaff.users).toHaveLength(1)
  })
})

describe('finance.mock - Rollenschutz', () => {
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

  it('als staff 403', async () => {
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

  it('als admin 200', async () => {
    const { body } = await login(app, 'chefin', 'geheim-1')
    const res = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${body.data.token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.data.months).toHaveLength(3)
  })
})

describe('finance.mock - Inhalt', () => {
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

describe('finance.mock - fehlende oder kaputte Daten', () => {
  it('fehlendes Verzeichnis: no-data ohne Absturz, mit Hinweis im Log', async () => {
    const missing = path.join(
      os.tmpdir(),
      'finance-gibt-es-nicht-' + Date.now()
    )
    const app = express()
    app.use(express.json())
    const log = { log() {}, warn: jest.fn(), error() {} }
    const auth = createAuth({ users: USERS, secret: 's', log })
    auth.install(app)
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
