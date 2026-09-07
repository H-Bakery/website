/**
 * Endpunkte der Tagesziel-Ampel (`targets.mock.js`) gegen eine eigene
 * Express-Instanz. Config, Finanz-Zusammenfassung und Kassenberichte liegen
 * als synthetische Dateien in einem Temp-Verzeichnis - es wird nichts aus
 * `hq` gelesen, und kein Wert hier ist echt.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const { createAuth } = require('../../src/routes/auth.mock')
const financeRoutes = require('../../src/routes/finance.mock')
const targetsRoutes = require('../../src/routes/targets.mock')
const core = require('../../src/services/targets.core')
const {
  buildSyntheticSummary,
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

/** Heute für alle Tests: ein Mittwoch. Der jüngste Bericht ist von Dienstag. */
const TODAY = '2026-04-01'

function syntheticConfig(overrides = {}) {
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
    ...overrides,
  }
}

/** Ein Tagesfile der Kasse mit genau einem Bon über `total` (synthetisch). */
function reportFile(date, total) {
  return {
    date,
    register_id: '4711',
    report_number: 1,
    company: 'Testbäckerei',
    transactions: [
      {
        id: `T-${date}`,
        timestamp: `${date}T09:00:00+02:00`,
        type: 'sale',
        user: 'Kasse',
        payment: 'Bar',
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
      },
    ],
  }
}

/** Sechs Wochen Berichte bis Di 31.03.: Sa 200, So 50, sonst 100. Montags nichts. */
const REVENUE_BY_ISO = { 2: 100, 3: 100, 4: 100, 5: 100, 6: 200, 7: 50 }

function writeReports(dir, overrides = {}) {
  const converted = path.join(dir, 'converted')
  fs.mkdirSync(converted, { recursive: true })
  for (const date of core.listDates('2026-02-17', '2026-03-31')) {
    const iso = core.isoWeekday(date)
    if (iso === 1 || overrides[date] === 'missing') continue
    const total =
      overrides[date] !== undefined ? overrides[date] : REVENUE_BY_ISO[iso]
    fs.writeFileSync(
      path.join(converted, `${date}_4711.json`),
      JSON.stringify(reportFile(date, total))
    )
  }
}

function buildApp({
  config = syntheticConfig(),
  summary = buildSyntheticSummary(),
  reports = true,
  today = TODAY,
} = {}) {
  const financeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'targets-fin-'))
  const reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'targets-rep-'))
  if (config !== null) {
    fs.mkdirSync(path.join(financeDir, 'config'), { recursive: true })
    fs.writeFileSync(
      path.join(financeDir, 'config', 'targets.json'),
      typeof config === 'string' ? config : JSON.stringify(config)
    )
  }
  if (summary !== null) {
    fs.writeFileSync(
      path.join(financeDir, 'finance-summary.json'),
      JSON.stringify(summary)
    )
  }
  if (reports) writeReports(reportsDir)

  const app = express()
  app.use(express.json())
  const auth = createAuth({
    users: USERS,
    secret: 'test-secret',
    log: silentLog,
  })
  auth.install(app)
  financeRoutes.install(app, auth, { financeDir, log: silentLog })
  targetsRoutes.install(app, auth, {
    financeDir,
    reportsDir,
    today,
    log: silentLog,
  })
  return { app, financeDir, reportsDir }
}

async function tokenFor(app, username, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: username, password })
  return res.body.data.token
}

async function get(app, url, token) {
  const req = request(app).get(url)
  if (token) req.set('Authorization', `Bearer ${token}`)
  return req
}

describe('targets.mock - Zugriffsschutz', () => {
  let app
  beforeAll(() => {
    ;({ app } = buildApp())
  })

  it.each([
    '/api/finance/targets',
    '/api/finance/targets/status',
    '/api/finance/targets/period?from=2026-03-01&to=2026-03-31',
  ])('%s: 401 ohne Token, 403 als Mitarbeiter', async (url) => {
    const anonymous = await get(app, url)
    expect(anonymous.status).toBe(401)
    expect(anonymous.body).toMatchObject({
      success: false,
      error: 'unauthorized',
    })
    expect(anonymous.body.message).toBeTruthy()

    const staff = await get(
      app,
      url,
      await tokenFor(app, 'verkauf', 'geheim-2')
    )
    expect(staff.status).toBe(403)
    expect(staff.body).toMatchObject({ success: false, error: 'forbidden' })
    expect(staff.body.message).toBeTruthy()
  })
})

describe('targets.mock - GET /api/finance/targets', () => {
  it('liefert Zielwerte je Wochentag, beide Stufen, Faktoren und Stand', async () => {
    const { app } = buildApp()
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, status: 'ok' })
    const data = res.body.data
    expect(data.today).toBe(TODAY)
    expect(data.last_evaluated_date).toBe('2026-03-31')
    expect(data.config).toMatchObject({
      mode: 'derived',
      updated: '2026-03-01',
      stale: false,
      thresholds: { green: 1, amber: 0.9 },
      closed_weekdays: [1],
    })
    expect(data.cost_base.status).toBe('ok')
    expect(data.cost_base.variable_cost_ratio).toBeGreaterThan(0)
    expect(data.cost_base.variable_cost_ratio).toBeLessThan(1)
    expect(data.factors.weekdays).toHaveLength(7)
    expect(data.factors.weekdays[0]).toMatchObject({
      closed: true,
      factor: null,
    })
    expect(data.factors.weekdays[5].factor).toBeGreaterThan(
      data.factors.weekdays[6].factor
    )
    expect(data.levels.breakeven.assumed).toBe(false)
    expect(data.levels.draw.assumed).toBe(true)
    expect(data.levels.draw.daily_base).toBeGreaterThan(
      data.levels.breakeven.daily_base
    )
    expect(data.levels.breakeven.weekdays[5].target).toBeGreaterThan(0)
  })

  it('kennzeichnet eine Kostenbasis, die älter als sechs Monate ist', async () => {
    const { app } = buildApp({ today: '2026-10-15' })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    // Das Faktorenfenster endet am jüngsten ausgewerteten Tag, nicht heute -
    // das Ziel gibt es also noch, aber mit Warnung zur Kostenbasis.
    expect(res.body.status).toBe('ok')
    expect(res.body.data.config).toMatchObject({ stale: true, age_months: 7 })
  })

  it('ohne Config: kein Ziel, kein geschätzter Wert', async () => {
    const { app } = buildApp({ config: null })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      status: 'no-target',
      data: null,
    })
    expect(res.body.message).toMatch(/targets\.json/)
  })

  it('unplausible Config: kein Ziel mit Grund', async () => {
    const { app } = buildApp({
      config: syntheticConfig({ thresholds: { green: 0.5, amber: 0.9 } }),
    })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.body.status).toBe('no-target')
    expect(res.body.message).toMatch(/thresholds/)
  })

  it('kaputtes JSON in der Config: kein Ziel', async () => {
    const { app } = buildApp({ config: '{ "schema_version": ' })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.body.status).toBe('no-target')
    expect(res.body.message).toMatch(/nicht lesbar/)
  })

  it('derived ohne Finanzdaten: kein Ziel', async () => {
    const { app } = buildApp({ summary: null })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.body.status).toBe('no-target')
    expect(res.body.message).toMatch(/Kostenbasis nicht ableitbar/)
  })

  it('manual braucht die Finanzdaten nicht und überschreibt die Ableitung', async () => {
    const { app } = buildApp({
      summary: null,
      config: syntheticConfig({
        mode: 'manual',
        fixed_costs_monthly: 6000,
        variable_cost_ratio: 0.25,
        private_draw_monthly: 1500,
        cost_window_months: undefined,
        variable_categories: undefined,
      }),
    })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.body.status).toBe('ok')
    expect(res.body.data.cost_base).toMatchObject({
      mode: 'manual',
      fixed_costs_monthly: 6000,
      variable_cost_ratio: 0.25,
      private_draw_source: 'config',
    })
    expect(res.body.data.levels.draw.assumed).toBe(false)
    // 6000 / 0.75 = 8000 → 8000 / 24 Geschäftstage
    expect(res.body.data.levels.breakeven.breakeven_monthly).toBeCloseTo(
      8000,
      2
    )
    expect(res.body.data.levels.breakeven.daily_base).toBeCloseTo(333.33, 2)
  })

  it('ohne Kassenberichte: kein Ziel, aber Kostenbasis', async () => {
    const { app } = buildApp({ reports: false })
    const res = await get(
      app,
      '/api/finance/targets',
      await tokenFor(app, 'chefin', 'geheim-1')
    )
    expect(res.body.status).toBe('no-target')
    expect(res.body.data.cost_base.status).toBe('ok')
    expect(res.body.data.last_evaluated_date).toBeNull()
  })
})

describe('targets.mock - GET /api/finance/targets/status', () => {
  let app
  let token
  beforeAll(async () => {
    ;({ app } = buildApp())
    token = await tokenFor(app, 'chefin', 'geheim-1')
  })

  it('ohne Datum: der jüngste ausgewertete Tag mit Woche und Monat', async () => {
    const res = await get(app, '/api/finance/targets/status', token)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    const data = res.body.data
    expect(data.day.date).toBe('2026-03-31')
    expect(data.day.weekday).toBe('Dienstag')
    expect(data.day.actual).toBe(100)
    expect(['green', 'amber', 'red']).toContain(
      data.day.levels.breakeven.status
    )
    expect(data.day.levels.breakeven.label).toBeTruthy()
    expect(data.day.levels.breakeven.target).toBeGreaterThan(0)
    expect(data.levels_meta.draw.assumed).toBe(true)

    expect(data.week.from).toBe('2026-03-30')
    expect(data.week.to).toBe('2026-03-31')
    expect(data.week.iso_week).toBe('2026-W14')
    expect(data.week.levels.breakeven.days_counted).toBe(1)

    expect(data.month.month).toBe('2026-03')
    expect(data.month.levels.breakeven.days_counted).toBe(26)
    expect(data.month.projection.breakeven.remaining_days).toBe(0)
    expect(data.month.projection.breakeven.projected_actual).toBe(
      data.month.levels.breakeven.actual
    )
  })

  it('mit Datum: ein Tag mitten im Monat inkl. Hochrechnung', async () => {
    const res = await get(
      app,
      '/api/finance/targets/status?date=2026-03-14',
      token
    )
    expect(res.body.status).toBe('ok')
    const data = res.body.data
    expect(data.day).toMatchObject({
      date: '2026-03-14',
      weekday: 'Samstag',
      actual: 200,
    })
    expect(data.month.to).toBe('2026-03-14')
    const proj = data.month.projection.breakeven
    // 15.–31.03. ohne die Montage 16., 23., 30. → 14 Resttage
    expect(proj.remaining_days).toBe(14)
    expect(proj.month_target).toBeGreaterThan(
      data.month.levels.breakeven.target
    )
    expect(proj.projected_actual).toBeGreaterThan(0)
  })

  it('heute ist offen, nicht rot', async () => {
    const res = await get(
      app,
      `/api/finance/targets/status?date=${TODAY}`,
      token
    )
    expect(res.body.data.day.levels.breakeven).toMatchObject({
      status: 'open',
      reason: 'today',
      label: 'Laufender Tag',
    })
  })

  it('ein Ruhetag ist offen mit Grund Ruhetag', async () => {
    const res = await get(
      app,
      '/api/finance/targets/status?date=2026-03-30',
      token
    )
    expect(res.body.data.day.levels.breakeven).toMatchObject({
      status: 'open',
      reason: 'closed',
      label: 'Ruhetag',
    })
  })

  it('lehnt ein kaputtes Datum mit 400 ab', async () => {
    const res = await get(
      app,
      '/api/finance/targets/status?date=31.03.2026',
      token
    )
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, error: 'validation' })
    expect(res.body.message).toMatch(/JJJJ-MM-TT/)
  })

  it('ohne Ziel antwortet auch der Status mit no-target', async () => {
    const { app: bare } = buildApp({ config: null })
    const res = await get(
      bare,
      '/api/finance/targets/status',
      await tokenFor(bare, 'chefin', 'geheim-1')
    )
    expect(res.body).toMatchObject({ success: true, status: 'no-target' })
  })
})

describe('targets.mock - GET /api/finance/targets/period', () => {
  let app
  let token
  beforeAll(async () => {
    ;({ app } = buildApp())
    token = await tokenFor(app, 'chefin', 'geheim-1')
  })

  it('liefert die Tagesreihe mit Ampel je Tag und Summen je Stufe', async () => {
    const res = await get(
      app,
      '/api/finance/targets/period?from=2026-03-23&to=2026-04-02',
      token
    )
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    const data = res.body.data
    expect(data.days).toHaveLength(11)
    const byDate = Object.fromEntries(data.days.map((d) => [d.date, d]))
    expect(byDate['2026-03-23'].levels.breakeven.reason).toBe('closed')
    expect(byDate['2026-03-28'].actual).toBe(200)
    expect(byDate['2026-04-01'].levels.breakeven.reason).toBe('today')
    expect(byDate['2026-04-02'].levels.breakeven.reason).toBe('future')
    for (const d of data.days) {
      for (const key of ['breakeven', 'draw']) {
        expect(core.STATUSES).toContain(d.levels[key].status)
        expect(typeof d.levels[key].label).toBe('string')
      }
    }
    // Di–So der Vorwoche plus Di 31.03.; Mo 30.03. ist Ruhetag, 01./02.04. offen
    expect(data.levels.breakeven.days_counted).toBe(7)
    expect(data.levels.breakeven.actual).toBe(100 * 5 + 200 + 50)
    expect(data.last_evaluated_date).toBe('2026-03-31')
    expect(data.levels_meta.breakeven.label).toBe(core.LEVEL_LABELS.breakeven)
  })

  it.each([
    ['fehlende Parameter', '/api/finance/targets/period', 'validation'],
    [
      'falsches Format',
      '/api/finance/targets/period?from=2026-3-1&to=2026-03-31',
      'validation',
    ],
    [
      'Start nach Ende',
      '/api/finance/targets/period?from=2026-03-31&to=2026-03-01',
      'validation',
    ],
    [
      'zu lang',
      '/api/finance/targets/period?from=2020-01-01&to=2026-03-31',
      'range_too_large',
    ],
  ])('400 bei %s', async (_label, url, error) => {
    const res = await get(app, url, token)
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, error })
    expect(res.body.message).toBeTruthy()
  })
})

describe('targets.mock - Datenschutz', () => {
  it('die Antworten enthalten keine Kontonummern oder Klarnamen', async () => {
    const { app } = buildApp()
    const token = await tokenFor(app, 'chefin', 'geheim-1')
    const {
      FAKE_IBANS,
      FAKE_NAMES,
    } = require('../fixtures/finance-summary.synthetic')
    for (const url of [
      '/api/finance/targets',
      '/api/finance/targets/status',
      '/api/finance/targets/period?from=2026-03-01&to=2026-03-31',
    ]) {
      const res = await get(app, url, token)
      const text = JSON.stringify(res.body)
      for (const iban of FAKE_IBANS) expect(text).not.toContain(iban)
      for (const name of FAKE_NAMES) expect(text).not.toContain(name)
    }
  })
})
