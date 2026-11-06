/**
 * Parity (D3, B5): the real API serves hq products like the mock server.
 * Both read the same synthetic fixture dir; the mock reads
 * `HQ_PRODUCTS_DIR` when it is loaded, so the variable is set first.
 *
 * Values are compared too, not only shapes: same files, same products.
 * The real API adds `pendingApproval` (D6) and, on the management view
 * `/api/hq-products[/:id]`, `rawDescription` (F4) - extra keys, allowed.
 * Writes are compared on two separate copies of the fixture dir, file by
 * file: the same request must leave the same bytes on disk.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'
import { compare, loadMockServer } from './parity'

let real: TestApp
let realApp: Application
let mock: Application
let auth: Record<string, string>
let dataDir: string
let mockDir: string
let realDir: string
const savedDir = process.env['HQ_PRODUCTS_DIR']

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-parity-'))
  mockDir = makeProductsDir()
  realDir = makeProductsDir()
  process.env['HQ_PRODUCTS_DIR'] = mockDir
  mock = loadMockServer(dataDir)
  real = await createTestApp()
  realApp = createApp({
    logRequests: false,
    sequelize: real.sequelize,
    hqProducts: { productsDir: realDir, writeDir: null },
  })
  auth = bearer(await sessionFor(real.app, 'test.inhaber', 'inhaber'))
})

afterAll(async () => {
  process.env['HQ_PRODUCTS_DIR'] = savedDir
  await real.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
  removeTempDirs()
})

const apps = () => ({ mock, real: realApp })

function withoutPending(body: unknown): unknown {
  return JSON.parse(JSON.stringify(body), (key, value) =>
    key === 'pendingApproval' || key === 'rawDescription' ? undefined : value
  )
}

describe('hq products parity (mock vs. real API)', () => {
  it.each(['/api/products', '/api/products?category=brot'])(
    'GET %s: same status, shape and products',
    async (url) => {
      const result = await compare(
        { method: 'get', path: url, headers: auth },
        apps()
      )
      expect(result.mock.status).toBe(200)
      expect(result.differences).toEqual([])
      expect((result.mock.body as { count: number }).count).toBeGreaterThan(0)
      expect(withoutPending(result.real.body)).toEqual(result.mock.body)
    }
  )

  it('GET /api/hq-products/:id: same product', async () => {
    const result = await compare(
      { method: 'get', path: '/api/hq-products/musterweck', headers: auth },
      apps()
    )
    expect(result.differences).toEqual([])
    expect(withoutPending(result.real.body)).toEqual(result.mock.body)
  })

  it('GET /api/hq-products/:id unknown: 404 with error + message on both', async () => {
    const result = await compare(
      { method: 'get', path: '/api/hq-products/gibt-es-nicht', headers: auth },
      apps()
    )
    expect(result.mock.status).toBe(404)
    expect(result.differences).toEqual([])
  })

  it('GET /api/hq-products (list) exists only on the real API', async () => {
    // Deliberate addition: the mock has no list route (the management app
    // reads the files itself). Same envelope as /api/products.
    const mockRes = await request(mock).get('/api/hq-products')
    expect(mockRes.status).toBe(404)
    const realRes = await request(realApp).get('/api/hq-products').set(auth)
    const shop = await request(mock).get('/api/products')
    expect(withoutPending(realRes.body)).toEqual(shop.body)
  })

  it.each([
    ['price', { price: '0.55' }],
    ['name only', { name: 'Musterweck neu' }],
    [
      'edit form',
      {
        name: 'Musterweck',
        category: 'broetchen',
        price: 0.5,
        short_description: 'Neuer Teaser.',
        description: 'Neuer Text.\n\nZweiter Absatz.',
        image: '',
        available: false,
        seasonal: true,
      },
    ],
  ])(
    'PUT (%s): same answer and the same bytes on disk',
    async (_label, body) => {
      const result = await compare(
        {
          method: 'put',
          path: '/api/hq-products/musterweck',
          headers: auth,
          body,
        },
        apps()
      )
      expect(result.mock.status).toBe(200)
      expect(result.differences).toEqual([])
      expect(withoutPending(result.real.body)).toEqual({
        ...(result.mock.body as object),
        pending: false,
      })
      expect(
        fs.readFileSync(path.join(realDir, '13-musterweck.md'), 'utf-8')
      ).toBe(fs.readFileSync(path.join(mockDir, '13-musterweck.md'), 'utf-8'))
    }
  )

  it('PUT invalid: 400 with message on both', async () => {
    const result = await compare(
      {
        method: 'put',
        path: '/api/hq-products/musterweck',
        headers: auth,
        body: { price: 'abc' },
      },
      apps()
    )
    expect(result.mock.status).toBe(400)
    expect(result.differences).toEqual([])
    expect((result.real.body as { message: string }).message).toBe(
      (result.mock.body as { message: string }).message
    )
  })

  it('POST: same answer and the same new file', async () => {
    const body = {
      name: 'Paritätsbrot',
      category: 'brot',
      price: 3.2,
      short_description: 'Synthetisch.',
      description: 'Nur für den Paritätstest.',
      image: '',
      available: true,
      seasonal: false,
    }
    const result = await compare(
      { method: 'post', path: '/api/hq-products', headers: auth, body },
      apps()
    )
    expect(result.mock.status).toBe(201)
    expect(result.differences).toEqual([])
    expect(withoutPending(result.real.body)).toEqual({
      ...(result.mock.body as object),
      pending: false,
    })
    const file = '22-paritaetsbrot.md'
    expect(fs.readFileSync(path.join(realDir, file), 'utf-8')).toBe(
      fs.readFileSync(path.join(mockDir, file), 'utf-8')
    )

    const dup = await compare(
      { method: 'post', path: '/api/hq-products', headers: auth, body },
      apps()
    )
    expect(dup.mock.status).toBe(409)
    expect(dup.differences).toEqual([])
  })

  it('POST without description: both answer an empty description, same file', async () => {
    const body = {
      name: 'Paritätsleer',
      category: 'brot',
      price: 2.1,
      short_description: 'Nur ein Teaser.',
      description: '',
      image: '',
      available: true,
      seasonal: false,
    }
    const result = await compare(
      { method: 'post', path: '/api/hq-products', headers: auth, body },
      apps()
    )
    expect(result.mock.status).toBe(201)
    expect(result.differences).toEqual([])
    expect(
      (result.mock.body as { data: { description: string } }).data.description
    ).toBe('')
    expect(withoutPending(result.real.body)).toEqual({
      ...(result.mock.body as object),
      pending: false,
    })
    const file = '23-paritaetsleer.md'
    expect(fs.readFileSync(path.join(realDir, file), 'utf-8')).toBe(
      fs.readFileSync(path.join(mockDir, file), 'utf-8')
    )
  })
})
