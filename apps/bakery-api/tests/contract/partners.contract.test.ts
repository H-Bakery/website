/**
 * Contract (D3, B6, B12): every partner route of the real API answers like
 * the mock server did, with sessions. The mock's answers are recorded in
 * `recorded/partners.json` (see recorded.ts).
 *
 * Both servers start from their seed (the CAP-Markt as partner 1) and read
 * the same synthetic hq catalogue. The same scenario runs on both: a new partner, its master data,
 * a template, visits (initial, refill, pickup, a correction, a move to
 * another day, a deletion), stats, report and CSV. Every step compares
 * status and shape (`compare`), and - where both servers hold the same data -
 * the values too (`same`), ids included: both number partners, templates
 * and visits from 1 in creation order.
 *
 * Sessions: the real API needs one (B3/B6); the mock ignored the header.
 * Master data runs as `inhaber`, visits as `verkauf`.
 *
 * Deliberate deviations, asserted below so they stay visible:
 *   - error bodies: same status and `message` field; the real API adds
 *     `success: false` and has its own `error` codes (`INVALID_ITEMS` vs.
 *     `Invalid items`) - the frontend reads `message` only;
 *   - GET templates: the mock creates an empty template per delivery day on
 *     read, the real API lists saved templates only;
 *   - `staffId` comes from the session on the real API (D5), from the body
 *     on the mock; `staffName` defaults to the session's display name;
 *   - a range with `from > to` is a 400 on the real API (the mock answers
 *     an empty result);
 *   - PATCH with `visitAt` alone keeps the business day on the real API
 *     (the mock moves it; the visit form always sends `businessDate`).
 */
import request from 'supertest'
import type { Application } from 'express'

import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'
import {
  ParityRequest,
  ParityResult,
  compare,
  diffShapes,
  loadRecordedMock,
  shapeOf,
} from './recorded'

let real: TestApp
let mock: Application
const SUITE = 'partners'
let owner: Record<string, string>
let seller: Record<string, string>

beforeAll(async () => {
  const productsDir = makeProductsDir()
  mock = loadRecordedMock(SUITE)
  real = await createTestApp({
    seedPartners: true,
    app: { hqProducts: { productsDir, writeDir: null } },
  })
  await createUser({
    username: 'test.inhaber',
    role: 'inhaber',
    displayName: 'Test Inhaber',
  })
  await createUser({
    username: 'test.verkauf',
    role: 'verkauf',
    displayName: 'Test Verkauf',
  })
  owner = bearer((await login(real.app, 'test.inhaber')).token)
  seller = bearer((await login(real.app, 'test.verkauf')).token)
})

afterAll(async () => {
  await real.close()
  removeTempDirs()
})

const apps = () => ({ mock, real: real.app })

/** Same status and shape on both servers; returns both answers. */
async function parity(
  req: ParityRequest,
  status: number
): Promise<ParityResult> {
  const result = await compare(req, apps())
  expect(result.differences).toEqual([])
  expect(result.mock.status).toBe(status)
  return result
}

/** An error: same status, `message` on both, German text on the real API. */
async function parityError(req: ParityRequest, status: number) {
  const result = await parity(req, status)
  for (const side of [result.mock, result.real]) {
    const body = side.body as Record<string, unknown>
    expect(typeof body['error']).toBe('string')
    expect(typeof body['message']).toBe('string')
  }
  expect((result.real.body as Record<string, unknown>)['success']).toBe(false)
  return result
}

/**
 * Keys whose values legitimately differ between the two servers: timestamps,
 * `staffId` (session vs. body) and `success` (only the real API's error
 * bodies carry it).
 */
const VOLATILE = new Set([
  'createdAt',
  'updatedAt',
  'generatedAt',
  'staffId',
  'success',
])

/**
 * Drops the volatile keys and the ids of visit items: the mock numbers the
 * items of each visit from 1, the database numbers them globally.
 */
function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value), function (key, v) {
    if (VOLATILE.has(key)) return undefined
    if (key === 'id' && typeof this === 'object' && 'productSlug' in this) {
      return undefined
    }
    return v
  })
}

/** Values equal on both sides (after dropping the volatile keys). */
function same(result: ParityResult) {
  expect(normalize(result.real.body)).toEqual(normalize(result.mock.body))
}

const get = (url: string, auth = seller): ParityRequest => ({
  method: 'get',
  path: url,
  headers: auth,
})
const send = (
  method: ParityRequest['method'],
  url: string,
  body: unknown,
  auth = seller
): ParityRequest => ({ method, path: url, body, headers: auth })

/** The partner the scenario creates - id 2 on both (1 is the seed). */
const P = '/api/partners/2'
const DAY = '2026-03-03' // a Tuesday
const NEXT_DAY = '2026-03-04'

describe('partners parity: master data (inhaber)', () => {
  it('GET /api/partners lists the seeded partner on both', async () => {
    const result = await parity(get('/api/partners'), 200)
    expect((result.mock.body as unknown[]).length).toBe(1)
    expect((result.real.body as unknown[]).length).toBe(1)
  })

  it('GET /api/partners?active=true|false filters on both', async () => {
    const active = await parity(get('/api/partners?active=true'), 200)
    expect((active.real.body as unknown[]).length).toBe(1)
    const inactive = await parity(get('/api/partners?active=false'), 200)
    same(inactive)
    expect(inactive.real.body).toEqual([])
  })

  it('GET /api/partners/:id: seeded partner, unknown and non-numeric ids', async () => {
    await parity(get('/api/partners/1'), 200)
    same(await parityError(get('/api/partners/999'), 404))
    await parityError(get('/api/partners/abc'), 404)
  })

  it('POST /api/partners creates the same partner', async () => {
    const result = await parity(
      send(
        'post',
        '/api/partners',
        {
          name: 'Testmarkt Parität',
          street: 'Musterstraße 1',
          zip: '00000',
          city: 'Musterstadt',
          contactName: 'Test Kontakt',
          deliveryDays: [2, 4, 6],
          settlementModel: 'firm_sale',
          notes: 'Synthetischer Partner für den Abgleich.',
        },
        owner
      ),
      201
    )
    same(result)
    expect(result.real.body).toMatchObject({
      id: 2,
      slug: 'testmarkt-paritaet',
      deliveryDays: [2, 4, 6],
    })
  })

  it('POST /api/partners rejects a duplicate slug, a missing name and a text "active"', async () => {
    await parityError(
      send('post', '/api/partners', { name: 'Testmarkt Parität' }, owner),
      409
    )
    await parityError(send('post', '/api/partners', {}, owner), 400)
    await parityError(send('post', '/api/partners', { name: 7 }, owner), 400)
    await parityError(
      send('post', '/api/partners', { name: 'X', active: 'ja' }, owner),
      400
    )
  })

  it('PUT /api/partners/:id updates the same fields', async () => {
    same(
      await parity(
        send(
          'put',
          P,
          { city: 'Teststadt', phone: '0000 000000', notes: 'Geändert.' },
          owner
        ),
        200
      )
    )
    same(await parity(send('put', P, { active: false }, owner), 200))
    same(await parity(send('put', P, { active: true }, owner), 200))
  })

  it('PUT /api/partners/:id errors: empty name, taken slug, text "active", unknown partner', async () => {
    await parityError(send('put', P, { name: '  ' }, owner), 400)
    await parityError(
      send('put', P, { slug: 'cap-markt-homburg-kirrberg' }, owner),
      409
    )
    await parityError(send('put', P, { active: 'false' }, owner), 400)
    await parityError(
      send('put', '/api/partners/999', { name: 'X' }, owner),
      404
    )
  })
})

describe('partners parity: templates (inhaber)', () => {
  it('GET templates: same shape; the mock fills empty delivery days on read (deviation)', async () => {
    const result = await parity(get(`${P}/templates`), 200)
    expect((result.mock.body as unknown[]).length).toBe(3)
    expect(result.real.body).toEqual([])
  })

  it('PUT templates/:weekday saves the same items (catalogue ids, quantity 0 dropped)', async () => {
    const result = await parity(
      send(
        'put',
        `${P}/templates/4`,
        {
          items: [
            { productSlug: 'kornbrot-500g', quantity: 3 },
            { productId: 13, quantity: 2 },
            { productSlug: 'mustersemmel', quantity: 0 },
          ],
        },
        owner
      ),
      200
    )
    // Ids differ: the mock numbered the templates it created on read.
    const { id: _m, ...mockBody } = result.mock.body as Record<string, unknown>
    const { id: _r, ...realBody } = result.real.body as Record<string, unknown>
    expect(realBody).toEqual(mockBody)
    expect(realBody['items']).toEqual([
      { productId: 1, productSlug: 'kornbrot-500g', quantity: 3 },
      { productId: 13, productSlug: 'musterweck', quantity: 2 },
    ])
  })

  it('PUT templates keeps "active" when the request does not name it', async () => {
    await parity(send('put', `${P}/templates/4`, { active: false }, owner), 200)
    const kept = await parity(
      send(
        'put',
        `${P}/templates/4`,
        { items: [{ productSlug: 'kornbrot-500g', quantity: 1 }] },
        owner
      ),
      200
    )
    expect((kept.mock.body as Record<string, unknown>)['active']).toBe(false)
    expect((kept.real.body as Record<string, unknown>)['active']).toBe(false)
  })

  it('GET templates afterwards lists the saved template on both', async () => {
    const result = await parity(get(`${P}/templates`), 200)
    const saved = (rows: unknown) =>
      (rows as Array<Record<string, unknown>>)
        .filter((t) => t['weekday'] === 4)
        .map(({ id: _id, ...rest }) => rest)
    expect(saved(result.real.body)).toEqual(saved(result.mock.body))
  })

  it('PUT templates errors: weekday, items not a list, text "active", unknown partner', async () => {
    await parityError(
      send('put', `${P}/templates/8`, { items: [] }, owner),
      400
    )
    await parityError(
      send('put', `${P}/templates/0`, { items: [] }, owner),
      400
    )
    await parityError(
      send('put', `${P}/templates/4`, { items: 'kornbrot' }, owner),
      400
    )
    await parityError(
      send('put', `${P}/templates/4`, { items: [], active: 1 }, owner),
      400
    )
    await parityError(
      send('put', '/api/partners/999/templates/4', { items: [] }, owner),
      404
    )
  })
})

const initial = {
  businessDate: DAY,
  visitAt: `${DAY}T05:30:00.000Z`,
  visitType: 'initial',
  staffName: 'Test Fahrer',
  items: [
    { productId: 1, productSlug: 'kornbrot-500g', deliveredQty: 10 },
    { productId: 13, productSlug: 'musterweck', deliveredQty: 20 },
  ],
}
const refill = {
  businessDate: DAY,
  visitAt: `${DAY}T10:00:00.000Z`,
  visitType: 'refill',
  staffName: 'Test Fahrer',
  note: 'Nachschub',
  items: [
    {
      productId: 1,
      productSlug: 'kornbrot-500g',
      countedQty: 3,
      deliveredQty: 5,
    },
    {
      productId: 13,
      productSlug: 'musterweck',
      countedQty: 0,
      deliveredQty: 10,
    },
  ],
}
const pickup = {
  businessDate: DAY,
  visitAt: `${DAY}T18:00:00.000Z`,
  visitType: 'pickup',
  staffName: 'Test Fahrer',
  items: [
    { productId: 1, productSlug: 'kornbrot-500g', countedQty: 2 },
    // Musterweck not counted: the pickup is incomplete on both servers.
  ],
}

describe('partners parity: visits (verkauf)', () => {
  it('POST visits: initial, refill and pickup are stored alike', async () => {
    for (const [body, id, sequence] of [
      [initial, 1, 1],
      [refill, 2, 2],
      [pickup, 3, 3],
    ] as const) {
      const result = await parity(send('post', `${P}/visits`, body), 201)
      same(result)
      expect(result.real.body).toMatchObject({ id, sequence, partnerId: 2 })
    }
  })

  it('POST visits takes names and prices from the hq catalogue on both', async () => {
    const result = await parity(get(`${P}/visits?from=${DAY}&to=${DAY}`), 200)
    same(result)
    const first = (result.real.body as Array<Record<string, any>>)[0]
    expect(first['items'][0]).toMatchObject({
      productName: 'Kornbrot 500g',
      unitPrice: 2.5,
    })
  })

  it('POST visits errors: second initial, unknown product, bad input, unknown partner', async () => {
    await parityError(send('post', `${P}/visits`, initial), 409)
    await parityError(
      send('post', `${P}/visits`, {
        ...refill,
        items: [{ productSlug: 'gibt-es-nicht', deliveredQty: 1 }],
      }),
      400
    )
    await parityError(
      send('post', `${P}/visits`, { ...refill, visitType: 'besuch' }),
      400
    )
    await parityError(
      send('post', `${P}/visits`, { ...refill, businessDate: '2026-02-30' }),
      400
    )
    await parityError(
      send('post', `${P}/visits`, { ...refill, visitAt: 'gestern' }),
      400
    )
    await parityError(
      send('post', `${P}/visits`, {
        ...refill,
        items: [{ productSlug: 'kornbrot-500g', countedQty: 'abc' }],
      }),
      400
    )
    await parityError(
      send('post', `${P}/visits`, {
        ...refill,
        items: [{ productSlug: 'kornbrot-500g', unitPrice: -1 }],
      }),
      400
    )
    await parityError(send('post', '/api/partners/999/visits', refill), 404)
  })

  it('GET visits: range filter and range errors', async () => {
    same(await parity(get(`${P}/visits`), 200))
    same(await parity(get(`${P}/visits?from=${NEXT_DAY}`), 200))
    same(await parity(get(`${P}/visits?to=${DAY}`), 200))
    await parityError(get(`${P}/visits?from=2026-02-30`), 400)
    await parityError(get(`${P}/visits?to=03.03.2026`), 400)
    await parityError(get('/api/partners/999/visits'), 404)
  })

  it('GET visits/today: same day detail (timeline, totals, incomplete pickup)', async () => {
    const result = await parity(get(`${P}/visits/today?date=${DAY}`), 200)
    same(result)
    expect(result.real.body).toMatchObject({
      businessDate: DAY,
      isOpen: false,
      isComplete: false,
    })
    same(await parity(get(`${P}/visits/today?date=${NEXT_DAY}`), 200))
    // Without ?date= both use today - an empty day on both.
    await parity(get(`${P}/visits/today`), 200)
    await parityError(get(`${P}/visits/today?date=2026-02-30`), 400)
  })

  it('PATCH visits: items and note corrected alike', async () => {
    same(
      await parity(
        send('patch', `${P}/visits/3`, {
          note: 'Nachgezählt',
          items: [
            { productId: 1, productSlug: 'kornbrot-500g', countedQty: 2 },
            { productId: 13, productSlug: 'musterweck', countedQty: 4 },
          ],
        }),
        200
      )
    )
  })

  it('PATCH visits: moving to another day re-sequences on both', async () => {
    const moved = await parity(
      send('patch', `${P}/visits/2`, { businessDate: NEXT_DAY }),
      200
    )
    same(moved)
    expect(moved.real.body).toMatchObject({
      businessDate: NEXT_DAY,
      sequence: 1,
    })
    const back = await parity(
      send('patch', `${P}/visits/2`, { businessDate: DAY }),
      200
    )
    same(back)
    expect(back.real.body).toMatchObject({ businessDate: DAY, sequence: 4 })
  })

  it('PATCH visits errors: second initial, bad input, unknown visit or partner', async () => {
    await parityError(
      send('patch', `${P}/visits/2`, { visitType: 'initial' }),
      409
    )
    await parityError(
      send('patch', `${P}/visits/2`, { visitType: 'besuch' }),
      400
    )
    await parityError(
      send('patch', `${P}/visits/2`, { businessDate: '2026-02-30' }),
      400
    )
    await parityError(send('patch', `${P}/visits/2`, { visitAt: 'nie' }), 400)
    await parityError(
      send('patch', `${P}/visits/2`, {
        items: [{ productSlug: 'gibt-es-nicht', deliveredQty: 1 }],
      }),
      400
    )
    same(await parityError(send('patch', `${P}/visits/999`, {}), 404))
    await parityError(send('patch', `${P}/visits/abc`, {}), 404)
    await parityError(send('patch', '/api/partners/1/visits/2', {}), 404)
    await parityError(send('patch', '/api/partners/999/visits/2', {}), 404)
  })
})

describe('partners parity: stats and report', () => {
  const range = `from=${DAY}&to=${NEXT_DAY}`

  it('GET stats: identical figures', async () => {
    const result = await parity(get(`${P}/stats?${range}`), 200)
    same(result)
    // The correction counted every product: the day is complete on both.
    expect(result.real.body).toMatchObject({
      isProvisional: false,
      incompleteDates: [],
    })
    same(await parity(get(`${P}/stats`), 200))
    await parityError(get(`${P}/stats?from=2026-13-01`), 400)
    await parityError(get('/api/partners/999/stats'), 404)
  })

  it('GET report: same partner and stats', async () => {
    same(await parity(get(`${P}/report?${range}`), 200))
    await parityError(get(`${P}/report?to=2026-02-30`), 400)
    await parityError(get('/api/partners/999/report'), 404)
  })

  it('GET report.csv: the same bytes and headers', async () => {
    const [m, r] = await Promise.all([
      request(mock).get(`${P}/report.csv?${range}`),
      request(real.app).get(`${P}/report.csv?${range}`).set(seller),
    ])
    expect(r.status).toBe(200)
    expect(m.status).toBe(200)
    expect(r.headers['content-type']).toBe(m.headers['content-type'])
    expect(r.headers['content-disposition']).toBe(
      m.headers['content-disposition']
    )
    expect(r.text).toBe(m.text)
    expect(r.text.charCodeAt(0)).toBe(0xfeff)
    await parityError(get(`${P}/report.csv?from=gestern`), 400)
    await parityError(get('/api/partners/999/report.csv'), 404)
  })
})

describe('partners parity: delete (verkauf)', () => {
  it('DELETE visits: same answer, then 404 on both', async () => {
    same(await parity(send('delete', `${P}/visits/2`, undefined), 200))
    same(await parityError(send('delete', `${P}/visits/2`, undefined), 404))
    await parityError(send('delete', `${P}/visits/abc`, undefined), 404)
  })

  it('stats after the deletion are identical', async () => {
    same(await parity(get(`${P}/stats?from=${DAY}&to=${DAY}`), 200))
  })
})

describe('partners parity: sessions', () => {
  it('the real API refuses every partner route without a session; the mock does not check', async () => {
    const routes: ParityRequest[] = [
      { method: 'get', path: '/api/partners' },
      { method: 'post', path: '/api/partners', body: { name: 'X' } },
      { method: 'get', path: P },
      { method: 'put', path: P, body: {} },
      { method: 'get', path: `${P}/templates` },
      { method: 'put', path: `${P}/templates/2`, body: { items: [] } },
      { method: 'get', path: `${P}/visits` },
      { method: 'get', path: `${P}/visits/today` },
      { method: 'post', path: `${P}/visits`, body: refill },
      { method: 'patch', path: `${P}/visits/1`, body: {} },
      { method: 'delete', path: `${P}/visits/1` },
      { method: 'get', path: `${P}/stats` },
      { method: 'get', path: `${P}/report` },
      { method: 'get', path: `${P}/report.csv` },
    ]
    for (const route of routes) {
      let call = request(real.app)[route.method](route.path)
      if (route.body !== undefined) call = call.send(route.body as object)
      const res = await call
      expect(res.status).toBe(401)
      expect(res.body).toMatchObject({ error: 'unauthorized' })
    }
  })

  it('master data needs inhaber on the real API (verkauf: 403)', async () => {
    const res = await request(real.app)
      .put(P)
      .set(seller)
      .send({ notes: 'nicht erlaubt' })
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'forbidden' })
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
