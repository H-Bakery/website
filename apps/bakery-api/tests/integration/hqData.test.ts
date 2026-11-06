/**
 * B4: reports, analytics, finance and Tagesziel on the real API - who may
 * read what (D5), the "no data" answers without hq, and that the mount does
 * not leak its guards onto other routes. Contracts are covered by the parity
 * suite (`tests/parity/hq-data.parity.test.ts`). Synthetic data only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import express from 'express'
import request from 'supertest'

import {
  createHqDataRouter,
  createRoleGuards,
} from '../../src/routes/hq-data.routes'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { writeSyntheticHq } = require('../fixtures/hq-data.synthetic')

jest.setTimeout(30000)

const REPORT_PATHS = [
  '/api/reports/daily?from=2026-03-01&to=2026-03-08',
  '/api/reports/daily/2026-03-07',
  '/api/reports/monthly/2026-03',
  '/api/analytics/revenue-trends?startDate=2026-03-01&endDate=2026-03-31',
  '/api/analytics/product-performance?startDate=2026-03-01&endDate=2026-03-31',
  '/api/analytics/payment-methods?startDate=2026-03-01&endDate=2026-03-31',
  '/api/analytics/summary?startDate=2026-03-01&endDate=2026-03-31',
]
const FINANCE_PATHS = [
  '/api/finance/summary',
  '/api/finance/months?from=2026-01&to=2026-03',
  '/api/finance/targets',
  '/api/finance/targets/status',
  '/api/finance/targets/period?from=2026-03-01&to=2026-03-31',
]
const ALL_PATHS = [...REPORT_PATHS, ...FINANCE_PATHS]

let root: string
let api: TestApp
let owner: Record<string, string>
const tokens: Record<string, Record<string, string>> = {}
let ownerStation: Record<string, string>
let ownerId: number

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b4-hq-'))
  const hq = writeSyntheticHq(root)
  api = await createTestApp({
    app: { hq: { reportsDir: hq.reportsDir, financeDir: hq.financeDir } },
  })
  ownerId = (
    await createUser({ username: 'test.inhaber', role: 'inhaber', pin: '4242' })
  ).id
  owner = bearer((await login(api.app, 'test.inhaber')).token)
  for (const role of ['verkauf', 'backstube', 'fahrer'] as const) {
    tokens[role] = bearer(await sessionFor(api.app, `test.${role}`, role))
  }

  // The owner at a PIN station (shared tablet).
  const station = await request(api.app)
    .post('/api/auth/stations')
    .set(owner)
    .send({ name: 'Laden-Tablet' })
  expect(station.status).toBe(201)
  const pin = await request(api.app)
    .post('/api/auth/pin')
    .set('X-Station-Token', station.body.data.token)
    .send({ userId: ownerId, pin: '4242' })
  expect(pin.status).toBe(200)
  expect(pin.body.data.sessionKind).toBe('station')
  ownerStation = bearer(pin.body.data.token)
})

afterAll(async () => {
  await api.close()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('access (D5): inhaber only', () => {
  it.each(ALL_PATHS)('%s without a session: 401', async (p) => {
    const res = await request(api.app).get(p)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({
      success: false,
      error: 'unauthorized',
      message: expect.any(String),
    })
  })

  it.each(
    ALL_PATHS.flatMap((p) =>
      ['verkauf', 'backstube', 'fahrer'].map((role) => [p, role])
    )
  )('%s as %s: 403', async (p, role) => {
    const res = await request(api.app).get(p).set(tokens[role])
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({
      success: false,
      error: 'forbidden',
      message: expect.any(String),
    })
  })

  it.each(ALL_PATHS)('%s as inhaber (personal session): 200', async (p) => {
    const res = await request(api.app).get(p).set(owner)
    expect(res.status).toBe(200)
  })

  it.each(REPORT_PATHS)('%s as inhaber at a PIN station: 200', async (p) => {
    const res = await request(api.app).get(p).set(ownerStation)
    expect(res.status).toBe(200)
  })

  it.each(FINANCE_PATHS)(
    '%s as inhaber at a PIN station: 403 personal_session_required',
    async (p) => {
      const res = await request(api.app).get(p).set(ownerStation)
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({
        success: false,
        error: 'personal_session_required',
        message: expect.any(String),
      })
    }
  )
})

describe('answers from the synthetic hq tree', () => {
  it('reports: a day with revenue, a gap as no-data', async () => {
    const res = await request(api.app)
      .get('/api/reports/daily?from=2026-03-04&to=2026-03-06')
      .set(owner)
    expect(res.body.available).toBe(true)
    expect(res.body.days.map((d: { status: string }) => d.status)).toEqual([
      'ok',
      'no-data',
      'ok',
    ])
    expect(res.body.summary.revenue).toBeGreaterThan(0)
  })

  it('finance: sanitised summary (no IBANs, no counterparties)', async () => {
    const res = await request(api.app).get('/api/finance/summary').set(owner)
    expect(res.body).toMatchObject({ success: true, status: 'ok' })
    expect(JSON.stringify(res.body)).not.toMatch(/DE0000000000/)
    expect(res.body.data).not.toHaveProperty('accounts')
    expect(res.body.data).not.toHaveProperty('top_counterparties')
  })

  it('Tagesziel: targets built from config, summary and reports', async () => {
    const res = await request(api.app).get('/api/finance/targets').set(owner)
    expect(res.body).toMatchObject({ success: true, status: 'ok' })
    expect(res.body.data.last_evaluated_date).toBe('2026-03-31')
  })

  it('errors carry error + message', async () => {
    const res = await request(api.app)
      .get('/api/reports/monthly/2026-13')
      .set(owner)
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'invalid_month',
      message: expect.any(String),
    })
  })
})

describe('without hq (CI, missing clone)', () => {
  // A second createTestApp() would rebind the model singletons to another
  // database, so this mounts the router alone on a bare Express app with a
  // signed-in inhaber - the "no data" answers need no database.
  const bare = express()
  beforeAll(() => {
    const empty = path.join(root, 'nowhere')
    bare.use((req, _res, next) => {
      req.user = {
        id: 1,
        username: 'test.inhaber',
        displayName: 'Test',
        role: 'inhaber',
        sessionKind: 'personal',
        sessionId: 1,
        stationId: null,
      }
      next()
    })
    bare.use(
      createHqDataRouter({
        reportsDir: path.join(empty, 'reports'),
        financeDir: path.join(empty, 'finance'),
        log: {
          log: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
      })
    )
  })

  it('reports answer with gaps, never with sample data', async () => {
    const res = await request(bare).get(
      '/api/reports/daily?from=2026-03-01&to=2026-03-02'
    )
    expect(res.status).toBe(200)
    expect(res.body.available).toBe(false)
    expect(
      res.body.days.every((d: { status: string }) => d.status === 'no-data')
    ).toBe(true)
    const summary = await request(bare).get(
      '/api/analytics/summary?startDate=2026-03-01&endDate=2026-03-31'
    )
    expect(summary.body).toEqual({ data: null })
  })

  it('finance answers no-data, Tagesziel no-target', async () => {
    const fin = await request(bare).get('/api/finance/summary')
    expect(fin.status).toBe(200)
    expect(fin.body).toMatchObject({ status: 'no-data', data: null })
    const tgt = await request(bare).get('/api/finance/targets')
    expect(tgt.status).toBe(200)
    expect(tgt.body).toMatchObject({ status: 'no-target' })
  })
})

describe('the mount stays in its lane', () => {
  it('does not put its role guard on other routes', async () => {
    // partners has no role guard yet (B6): verkauf still gets through.
    const res = await request(api.app)
      .get('/api/partners')
      .set(tokens['verkauf'])
    expect(res.status).toBe(200)
  })

  it('an unknown path below /api/reports: 404 for the owner, 403 for others', async () => {
    const asOwner = await request(api.app).get('/api/reports/nope').set(owner)
    expect(asOwner.status).toBe(404)
    expect(asOwner.body).toMatchObject({ error: 'not_found' })
    const asSales = await request(api.app)
      .get('/api/reports/nope')
      .set(tokens['verkauf'])
    expect(asSales.status).toBe(403)
  })

  it('the old TS reports route with invented numbers is gone', () => {
    expect(
      fs.existsSync(path.join(__dirname, '../../src/routes/reports.routes.ts'))
    ).toBe(false)
  })
})

describe('createRoleGuards', () => {
  it('accepts pilot roles and refuses anything else at mount time', () => {
    const guards = createRoleGuards()
    expect(typeof guards.requireRole('inhaber')).toBe('function')
    expect(() => guards.requireRole('admin')).toThrow(/not a pilot role/)
    expect(() => guards.requireRole('staff')).toThrow(/not a pilot role/)
  })

  it('createHqDataRouter builds without options (env defaults)', () => {
    const quiet = { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    expect(() => createHqDataRouter({ log: quiet })).not.toThrow()
    expect(quiet.log).toHaveBeenCalled()
  })
})
