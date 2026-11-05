/**
 * Parity (B4, D3): reports, analytics, finance and Tagesziel answer on the
 * real API exactly as on the mock server. Both read the same synthetic hq
 * tree in a temp dir (`tests/fixtures/hq-data.synthetic.js`); the mock gets
 * its own login (`auth.mock.js`, role `admin`), the real API a B3 session of
 * an `inhaber`.
 *
 * Both servers run the same modules on the same files, so beyond the shape
 * check every success body must be deep-equal - a difference would mean the
 * mount (paths, options, dirs) is wrong, not the data.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { compare, loadMockServer } from './parity'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { writeSyntheticHq } = require('../fixtures/hq-data.synthetic')

jest.setTimeout(30000)

const quiet = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
const ENV_KEYS = [
  'HQ_REPORTS_DIR',
  'HQ_FINANCE_DIR',
  'MOCK_ADMIN_USER',
  'MOCK_ADMIN_PASSWORD',
  'MOCK_STAFF_USER',
  'MOCK_STAFF_PASSWORD',
] as const
const savedEnv: Record<string, string | undefined> = {}

let root: string
let dataDir: string
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
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b4-parity-'))
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b4-store-'))
  const hq = writeSyntheticHq(root)

  // The mock reads its dirs and users from the environment when loaded.
  process.env.HQ_REPORTS_DIR = hq.reportsDir
  process.env.HQ_FINANCE_DIR = hq.financeDir
  process.env.MOCK_ADMIN_USER = 'test.chefin'
  process.env.MOCK_ADMIN_PASSWORD = 'mock-pass-1'
  process.env.MOCK_STAFF_USER = 'test.laden'
  process.env.MOCK_STAFF_PASSWORD = 'mock-pass-2'
  const log = console.log
  const warn = console.warn
  console.log = () => undefined
  console.warn = () => undefined
  try {
    mock = loadMockServer(dataDir)
  } finally {
    console.log = log
    console.warn = warn
  }
  mockAdmin = bearer(await mockToken('test.chefin', 'mock-pass-1'))
  mockStaff = bearer(await mockToken('test.laden', 'mock-pass-2'))

  // The real API gets the dirs explicitly (as server.ts passes the config).
  real = await createTestApp({
    app: {
      hq: { reportsDir: hq.reportsDir, financeDir: hq.financeDir, log: quiet },
    },
  })
  realOwner = bearer(await sessionFor(real.app, 'test.inhaber', 'inhaber'))
  realSales = bearer(await sessionFor(real.app, 'test.verkauf', 'verkauf'))
})

afterAll(async () => {
  await real?.close()
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(dataDir, { recursive: true, force: true })
})

/** As the owner on both sides. */
function asOwner(p: string) {
  return compare(
    { method: 'get', path: p, mockHeaders: mockAdmin, realHeaders: realOwner },
    { mock, real: real.app }
  )
}

describe('reports + analytics parity (mock vs. real API)', () => {
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

describe('finance + Tagesziel parity (mock vs. real API)', () => {
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
