/**
 * Contract (B4, D3, B12): reports, analytics, finance and Tagesziel answer on
 * the real API exactly as the mock server did. The mock's answers on the
 * synthetic hq tree (`tests/fixtures/hq-data.synthetic.js`) are recorded in
 * `recorded/hq-data.json` (see recorded.ts) - including its own login
 * (`admin` role); the real API gets a B3 session of an `inhaber`.
 *
 * Both servers ran the same modules on the same files, so beyond the shape
 * check every success body must be deep-equal - a difference would mean the
 * mount (paths, options, dirs) is wrong, not the data. The recording was
 * made on RECORDED_ON; the real API runs with that "today", so the
 * Tagesziel answers without a date stay comparable.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { compare, loadRecordedMock } from './recorded'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { writeSyntheticHq } = require('../fixtures/hq-data.synthetic')

jest.setTimeout(30000)

const quiet = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
const SUITE = 'hq-data'
/** The day the mock's answers were recorded (Europe/Berlin). */
const RECORDED_ON = '2026-11-06'

let root: string
let mock: Application
let real: TestApp
let mockAdmin: Record<string, string>
let mockStaff: Record<string, string>
let realOwner: Record<string, string>
let realSales: Record<string, string>

async function mockToken(username: string, password: string): Promise<string> {
  const res = await request(mock)
    .post('/api/auth/login')
    .send({ username, password })
  if (res.status !== 200) throw new Error(`mock login ${res.status}`)
  return res.body.data.token
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b4-contract-'))
  const hq = writeSyntheticHq(root)

  mock = loadRecordedMock(SUITE)
  // The recorded mock logins (`admin` = test.chefin, `staff` = test.laden).
  mockAdmin = bearer(await mockToken('test.chefin', 'mock-pass-1'))
  mockStaff = bearer(await mockToken('test.laden', 'mock-pass-2'))

  // The real API gets the dirs explicitly (as server.ts passes the config).
  real = await createTestApp({
    app: {
      hq: {
        reportsDir: hq.reportsDir,
        financeDir: hq.financeDir,
        today: RECORDED_ON,
        log: quiet,
      },
    },
  })
  realOwner = bearer(await sessionFor(real.app, 'test.inhaber', 'inhaber'))
  realSales = bearer(await sessionFor(real.app, 'test.verkauf', 'verkauf'))
})

afterAll(async () => {
  await real?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

/** As the owner on both sides. */
function asOwner(p: string) {
  return compare(
    { method: 'get', path: p, mockHeaders: mockAdmin, realHeaders: realOwner },
    { mock, real: real.app }
  )
}

describe('reports + analytics contract (recorded mock vs. real API)', () => {
  it.each([
    '/api/reports/daily?from=2026-03-01&to=2026-03-08',
    '/api/reports/daily/2026-03-07',
    '/api/reports/daily/2026-03-05', // a gap: status no-data
    '/api/reports/monthly/2026-03',
    '/api/reports/monthly/2025-01', // no reports at all
    '/api/analytics/revenue-trends?startDate=2026-02-17&endDate=2026-03-31&granularity=weekly',
    '/api/analytics/revenue-trends?startDate=2026-03-01&endDate=2026-03-08',
    '/api/analytics/product-performance?startDate=2026-03-01&endDate=2026-03-31&limit=2',
    '/api/analytics/product-performance?startDate=2026-03-01&endDate=2026-03-31&type=bottom',
    '/api/analytics/payment-methods?startDate=2026-03-01&endDate=2026-03-31',
    '/api/analytics/summary?startDate=2026-03-01&endDate=2026-03-31',
    '/api/analytics/summary?startDate=2025-01-01&endDate=2025-01-31', // data: null
  ])('GET %s: same status and body', async (p) => {
    const result = await asOwner(p)
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
  })

  it('reads real data, not an empty fallback', async () => {
    const { real: side } = await asOwner('/api/reports/monthly/2026-03')
    const body = side.body as {
      status: string
      revenue: number
      days: unknown[]
    }
    expect(body.status).toBe('ok')
    expect(body.revenue).toBeGreaterThan(0)
    expect(body.days.length).toBeGreaterThan(20)
  })

  it.each([
    '/api/reports/daily?from=2026-03-08&to=2026-03-01', // invalid_range
    '/api/reports/daily?from=2020-01-01&to=2026-03-01', // range_too_large
    '/api/reports/daily/2026-02-30x',
    '/api/reports/monthly/2026-13',
    '/api/analytics/summary?startDate=x&endDate=y',
  ])('GET %s: same 400 with error + message', async (p) => {
    const result = await asOwner(p)
    expect(result.mock.status).toBe(400)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
    expect(result.real.body).toMatchObject({
      error: expect.any(String),
      message: expect.any(String),
    })
  })
})

describe('finance + Tagesziel contract (recorded mock vs. real API)', () => {
  it.each([
    '/api/finance/summary',
    '/api/finance/months',
    '/api/finance/months?from=2026-02&to=2026-03',
    '/api/finance/targets',
    '/api/finance/targets/status',
    '/api/finance/targets/status?date=2026-03-28',
    '/api/finance/targets/period?from=2026-03-01&to=2026-03-31',
  ])('GET %s: same status and body', async (p) => {
    const result = await asOwner(p)
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
    expect(result.real.body).toMatchObject({ success: true, status: 'ok' })
  })

  it.each([
    '/api/finance/months?from=2026-3',
    '/api/finance/months?from=2026-03&to=2026-01',
    '/api/finance/targets/status?date=gestern',
    '/api/finance/targets/period?from=2026-03-31&to=2026-03-01',
    '/api/finance/targets/period?from=2020-01-01&to=2026-03-01',
  ])('GET %s: same 400 with error + message', async (p) => {
    const result = await asOwner(p)
    expect(result.mock.status).toBe(400)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
  })

  it.each(['/api/finance/summary', '/api/finance/targets/status'])(
    'GET %s without a session: 401 on both, same shape',
    async (p) => {
      const result = await compare(
        { method: 'get', path: p },
        { mock, real: real.app }
      )
      expect(result.mock.status).toBe(401)
      expect(result.differences).toEqual([])
      expect(result.real.body).toMatchObject({
        success: false,
        error: 'unauthorized',
        message: expect.any(String),
      })
    }
  )

  it.each(['/api/finance/summary', '/api/finance/targets'])(
    'GET %s as staff (mock `staff`, real `verkauf`): 403 on both',
    async (p) => {
      const result = await compare(
        {
          method: 'get',
          path: p,
          mockHeaders: mockStaff,
          realHeaders: realSales,
        },
        { mock, real: real.app }
      )
      expect(result.mock.status).toBe(403)
      expect(result.differences).toEqual([])
      expect(result.real.body).toMatchObject({
        success: false,
        error: 'forbidden',
        message: expect.any(String),
      })
    }
  )
})
