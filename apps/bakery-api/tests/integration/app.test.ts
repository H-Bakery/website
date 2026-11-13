/**
 * Integration tests against the real pilot API: `createApp()` on an
 * in-memory SQLite with the baseline migration (roadmap B1).
 * Synthetic data only.
 */
import request from 'supertest'

import { MIGRATIONS } from '../../src/db/migrations'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'

let api: TestApp
let token: string

beforeAll(async () => {
  api = await createTestApp({
    seedPartners: true,
    // Partner visits need products from the (synthetic) hq catalogue (B6).
    app: { hqProducts: { productsDir: makeProductsDir(), writeDir: null } },
  })
  // Every /api route needs a session since B3.
  token = await sessionFor(api.app, 'test.inhaber', 'inhaber')
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

/** supertest with the session of a synthetic inhaber. */
function authed() {
  const agent = request(api.app)
  return {
    get: (path: string) => agent.get(path).set(bearer(token)),
    post: (path: string) => agent.post(path).set(bearer(token)),
    put: (path: string) => agent.put(path).set(bearer(token)),
    patch: (path: string) => agent.patch(path).set(bearer(token)),
    delete: (path: string) => agent.delete(path).set(bearer(token)),
  }
}

describe('createTestApp', () => {
  it('runs the static migration list (pilot baseline + B3 auth + Z3 + B7 preorders + M4 rest + B8 tours + Z10 + O5 + Dienstplan + Rechnungen)', () => {
    expect(api.migrations).toEqual(MIGRATIONS.map((m) => m.name))
    expect(api.migrations).toEqual([
      '20261105000000-pilot-baseline.js',
      '20261106000000-auth-sessions-stations.js',
      '20261112000000-backzettel-z3.js',
      '20261113000000-preorders-b7.js',
      '20261114000000-preorders-paid-amount.js',
      '20261116000000-preorders-request-id.js',
      '20261201000000-rest-am-abend.js',
      '20270105000000-delivery-tours-b8.js',
      '20270106000000-rest-count-line-rows.js',
      '20270201000000-backzettel-dough-day.js',
      '20270210000000-backzettel-baked.js',
      '20270301000000-dienstplan.js',
      '20270310000000-backzettel-none-today.js',
      '20270320000000-invoices.js',
    ])
  })
})

describe('health', () => {
  it.each(['/health', '/api/health'])(
    '%s answers 200 with the database ok',
    async (path) => {
      const res = await request(api.app).get(path)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ status: 'ok', database: 'ok' })
    }
  )
})

describe('error shape', () => {
  it('answers unknown routes with a JSON 404 carrying error and message', async () => {
    const res = await authed().get('/api/gibt-es-nicht')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toMatchObject({ success: false, error: 'not_found' })
    expect(typeof res.body.message).toBe('string')
    expect(res.body.message.length).toBeGreaterThan(0)
  })

  it('answers broken JSON with 400 invalid_json', async () => {
    const res = await request(api.app)
      .post('/api/partners')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'invalid_json' })
    expect(typeof res.body.message).toBe('string')
  })

  it('does not reveal the framework', async () => {
    const res = await request(api.app).get('/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('no HTTP caching of API answers (W4-verify r2)', () => {
  it('sends Cache-Control: no-store on /api, also on 401 and with a session', async () => {
    const anon = await request(api.app).get('/api/partners')
    expect(anon.status).toBe(401)
    expect(anon.headers['cache-control']).toBe('no-store')
    const res = await authed().get('/api/partners')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const login = await request(api.app)
      .post('/api/auth/login')
      .send({ username: 'x', password: 'y' })
    expect(login.headers['cache-control']).toBe('no-store')
  })
})

describe('partners CRUD smoke', () => {
  it('lists the seeded partner', async () => {
    const res = await authed().get('/api/partners')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, slug: 'cap-markt-homburg-kirrberg' }),
      ])
    )
  })

  it('creates, reads, updates a partner and rejects a duplicate slug', async () => {
    const created = await authed()
      .post('/api/partners')
      .send({
        name: 'Testmarkt Musterstadt',
        city: 'Musterstadt',
        deliveryDays: [2, 4, 6],
      })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'Testmarkt Musterstadt',
      slug: 'testmarkt-musterstadt',
      deliveryDays: [2, 4, 6],
      settlementModel: 'commission',
      active: true,
    })
    const id = created.body.id

    const read = await authed().get(`/api/partners/${id}`)
    expect(read.status).toBe(200)
    expect(read.body.city).toBe('Musterstadt')

    const updated = await authed()
      .put(`/api/partners/${id}`)
      .send({ active: false, notes: 'Nur zum Testen.' })
    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({
      active: false,
      notes: 'Nur zum Testen.',
    })

    const duplicate = await authed()
      .post('/api/partners')
      .send({ name: 'Testmarkt Musterstadt' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.any(String),
      })
    )
  })

  it('records visits and derives the day from them', async () => {
    const item = {
      productId: 1,
      productSlug: 'kornbrot-500g',
      unitPrice: 2.5,
    }
    const initial = await authed()
      .post('/api/partners/1/visits')
      .send({
        businessDate: '2026-11-03',
        visitType: 'initial',
        items: [{ ...item, countedQty: null, deliveredQty: 10 }],
      })
    expect(initial.status).toBe(201)
    expect(initial.body).toMatchObject({ sequence: 1, visitType: 'initial' })

    const pickup = await authed()
      .post('/api/partners/1/visits')
      .send({
        businessDate: '2026-11-03',
        visitType: 'pickup',
        items: [{ ...item, countedQty: 4, deliveredQty: 0 }],
      })
    expect(pickup.status).toBe(201)
    expect(pickup.body.sequence).toBe(2)

    const list = await authed().get(
      '/api/partners/1/visits?from=2026-11-03&to=2026-11-03'
    )
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body)).toContain('kornbrot-500g')
  })

  it('links a visit to a user of the pilot users table', async () => {
    const { PartnerVisit, User } = await import('../../src/models')
    const staff = await User.create({
      username: 'test.verkauf',
      displayName: 'Test Verkauf',
      role: 'verkauf',
      passwordHash: 'scrypt$synthetic',
    })
    // Loaded users never carry the hashes (default scope); login uses
    // the `withSecrets` scope.
    const loaded = await User.findByPk(staff.id)
    expect(loaded?.toJSON()).not.toHaveProperty('passwordHash')
    expect(loaded?.toJSON()).not.toHaveProperty('pinHash')
    const withSecrets = await User.scope('withSecrets').findByPk(staff.id)
    expect(withSecrets?.passwordHash).toBe('scrypt$synthetic')

    const visit = await PartnerVisit.create({
      partnerId: 1,
      businessDate: '2026-11-04',
      visitType: 'refill',
      staffId: staff.id,
    })
    const withStaff = await PartnerVisit.findByPk(visit.id, {
      include: [{ model: User, as: 'staff' }],
    })
    expect(withStaff?.staff?.displayName).toBe('Test Verkauf')

    // The foreign key is enforced: no visit for a user that does not exist.
    await expect(
      PartnerVisit.create({
        partnerId: 1,
        businessDate: '2026-11-04',
        visitType: 'refill',
        staffId: 4242,
      })
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('answers an unknown partner with 404 and a German message', async () => {
    const res = await authed().get('/api/partners/999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.any(String),
      })
    )
  })
})
