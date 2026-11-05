/**
 * Parity: the real API answers like the mock server (D3). Example suite for
 * the parity runner; B6 extends it to all partner routes.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { Application } from 'express'

import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { compare, diffShapes, loadMockServer, shapeOf } from './parity'

let real: TestApp
let token: string
let mock: Application
let dataDir: string

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-parity-'))
  mock = loadMockServer(dataDir)
  real = await createTestApp({ seedPartners: true })
  // The real API needs a session (B3); the mock ignores the header.
  token = await sessionFor(real.app, 'test.inhaber', 'inhaber')
})

afterAll(async () => {
  await real.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('partners parity (mock vs. real API)', () => {
  it('GET /api/partners has the same status and shape', async () => {
    const result = await compare(
      { method: 'get', path: '/api/partners', headers: bearer(token) },
      { mock, real: real.app }
    )
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    // Not a vacuous pass: both lists contain the seeded partner.
    expect((result.mock.body as unknown[]).length).toBeGreaterThan(0)
    expect((result.real.body as unknown[]).length).toBeGreaterThan(0)
  })

  it('GET /api/partners/:id for an unknown id is a 404 with error + message on both', async () => {
    const result = await compare(
      { method: 'get', path: '/api/partners/999', headers: bearer(token) },
      { mock, real: real.app }
    )
    expect(result.mock.status).toBe(404)
    expect(result.differences).toEqual([])
  })

  it('kept the mock store out of the repo data dir', () => {
    expect(fs.existsSync(path.join(dataDir, 'partner-store.json'))).toBe(true)
  })
})

describe('diffShapes', () => {
  it('reports keys the real API lacks and type changes, tolerates null and extras', () => {
    const mockShape = shapeOf([{ id: 1, name: 'A', phone: null, days: [2] }])
    const realShape = shapeOf([{ id: '1', phone: '0', days: [], extra: true }])
    expect(diffShapes(mockShape, realShape)).toEqual([
      '[].id: mock number, real string',
      '[].name: missing on the real API',
    ])
    expect(diffShapes(mockShape, realShape, { strictKeys: true })).toContain(
      '[].extra: only on the real API'
    )
    expect(
      diffShapes(mockShape, realShape, { ignore: ['[].id', '[].name'] })
    ).toEqual([])
  })
})
