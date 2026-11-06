/**
 * B8 Liefertouren on the real API: `/api/deliveries/{depot,drivers,tours,
 * geocode}` - roles (fahrer = own tours only), the Sammelstelle stop with its
 * handover list from `/api/preorders`, the pickup-point hook, the 2.5 s read
 * budget, the negative geocode cache, serialised writes and audit.
 * Synthetic catalogue, invented customers and addresses; no network (the geo
 * services are a stub this file controls).
 */
import request from 'supertest'

import { AuditLog, DeliveryGeocache, DeliveryStop } from '../../src/models'
import type {
  GeoHit,
  GeoServices,
  RoutedTour,
} from '../../src/services/delivery-tours.service'
import { anonymizePreorders } from '../../src/services/preorders-maintenance'
import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'

let api: TestApp
const tokens: Record<string, Record<string, string>> = {}
const userIds: Record<string, number> = {}

const NOW = new Date('2026-11-12T09:00:00.000Z') // Thursday
const SATURDAY = '2026-11-21'
const FRIDAY = '2026-11-20'
const MOERSBACH = 'kindergarten-moersbach'

/** What the stub answers; tests swap the functions. */
const geoState: {
  geocode: (address: string) => Promise<GeoHit | null>
  route: GeoServices['routeTour']
  geocodeCalls: string[]
} = {
  geocode: async () => null,
  route: async () => null,
  geocodeCalls: [],
}
const geo: GeoServices = {
  geocodeAddress: (address) => {
    geoState.geocodeCalls.push(address)
    return geoState.geocode(address)
  },
  routeTour: (depot, stops, options) => geoState.route(depot, stops, options),
}

function resetGeo(): void {
  geoState.geocode = async () => null
  geoState.route = async () => null
  geoState.geocodeCalls = []
}

const idle = () => (api.app.locals['deliveriesIdle'] as () => Promise<void>)()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  const productsDir = makeProductsDir()
  api = await createTestApp({
    app: {
      hqProducts: { productsDir, writeDir: null },
      preorders: { productsDir, now: () => NOW },
      deliveries: { geo, hydrateBudgetMs: 300, geocodeRetryMs: 60_000 },
    },
  })
  for (const role of ['inhaber', 'verkauf', 'backstube'] as const) {
    const user = await createUser({ username: `test.${role}`, role })
    userIds[role] = user.id
    tokens[role] = bearer((await login(api.app, `test.${role}`)).token)
  }
  for (const name of ['fahrer', 'fahrer2'] as const) {
    const user = await createUser({ username: `test.${name}`, role: 'fahrer' })
    userIds[name] = user.id
    tokens[name] = bearer((await login(api.app, `test.${name}`)).token)
  }
})

afterEach(async () => {
  await idle()
  resetGeo()
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

const as = (role: string) => ({
  get: (path: string) => request(api.app).get(path).set(tokens[role]),
  post: (path: string, body: unknown = {}) =>
    request(api.app)
      .post(path)
      .set(tokens[role])
      .send(body as object),
  put: (path: string, body: unknown = {}) =>
    request(api.app)
      .put(path)
      .set(tokens[role])
      .send(body as object),
  patch: (path: string, body: unknown = {}) =>
    request(api.app)
      .patch(path)
      .set(tokens[role])
      .send(body as object),
  delete: (path: string) => request(api.app).delete(path).set(tokens[role]),
})

const stopAt = (customer: string, lat: number, lon: number) => ({
  customer,
  street: 'Musterweg 1',
  zip: '66424',
  city: 'Homburg',
  items: [{ name: 'Testbrot', qty: 2, unit: 'Stk' }],
  lat,
  lon,
})

async function newTour(body: Record<string, unknown>) {
  const res = await as('inhaber').post('/api/deliveries/tours', body)
  expect(res.status).toBe(201)
  return res.body as {
    id: number
    stops: Array<Record<string, unknown> & { id: number }>
  }
}

// ------------------------------------------------------------------ setup

let driverA = 0 // linked to test.fahrer
let driverB = 0 // linked to test.fahrer2

describe('drivers', () => {
  it('inhaber creates drivers linked to fahrer accounts', async () => {
    const a = await as('inhaber').post('/api/deliveries/drivers', {
      name: 'Fahrer Alpha',
      phone: '0170 000 0009',
      vehicle: 'van',
      userId: userIds['fahrer'],
    })
    expect(a.status).toBe(201)
    driverA = a.body.id
    expect(a.body).toEqual({
      id: expect.any(Number),
      name: 'Fahrer Alpha',
      phone: '01700000009',
      vehicle: 'van',
      active: true,
      userId: userIds['fahrer'],
    })
    const b = await as('inhaber').post('/api/deliveries/drivers', {
      name: 'Fahrer Beta',
    })
    expect(b.status).toBe(201)
    expect(b.body).toMatchObject({ vehicle: 'car', userId: null })
    driverB = b.body.id
    const linked = await as('inhaber').put(
      `/api/deliveries/drivers/${driverB}`,
      {
        userId: String(userIds['fahrer2']),
      }
    )
    expect(linked.status).toBe(200)
    expect(linked.body.userId).toBe(userIds['fahrer2'])
  })

  it('refuses an unknown or already linked account and an empty name', async () => {
    const unknown = await as('inhaber').post('/api/deliveries/drivers', {
      name: 'X',
      userId: 99999,
    })
    expect(unknown.status).toBe(400)
    expect(unknown.body).toMatchObject({ error: 'User not found' })
    const taken = await as('inhaber').put(
      `/api/deliveries/drivers/${driverB}`,
      {
        userId: userIds['fahrer'],
      }
    )
    expect(taken.status).toBe(409)
    expect(taken.body.error).toBe('Driver user taken')
    const empty = await as('inhaber').post('/api/deliveries/drivers', {
      name: '  ',
    })
    expect(empty.status).toBe(400)
    expect(empty.body).toMatchObject({
      error: 'Name is required',
      message: 'Der Name des Fahrers ist erforderlich.',
    })
    // only a fahrer account is restricted by the link - anything else
    // would look done and do nothing
    const notFahrer = await as('inhaber').post('/api/deliveries/drivers', {
      name: 'X',
      userId: userIds['verkauf'],
    })
    expect(notFahrer.status).toBe(400)
    expect(notFahrer.body).toMatchObject({
      error: 'Driver user not fahrer',
      message: expect.stringContaining('Fahrer'),
    })
    const longPhone = await as('inhaber').post('/api/deliveries/drivers', {
      name: 'X',
      phone: '1'.repeat(41),
    })
    expect(longPhone.status).toBe(400)
    expect(longPhone.body.error).toBe('Text too long')
    const longPhonePut = await as('inhaber').put(
      `/api/deliveries/drivers/${driverB}`,
      { phone: '1'.repeat(300) }
    )
    expect(longPhonePut.status).toBe(400)
    const missing = await as('inhaber').put('/api/deliveries/drivers/999', {
      name: 'Y',
    })
    expect(missing.status).toBe(404)
    expect(missing.body.error).toBe('Driver not found')
  })

  it('lists drivers for verkauf and fahrer, filtered by active', async () => {
    await as('inhaber').put(`/api/deliveries/drivers/${driverB}`, {
      active: false,
    })
    const all = await as('verkauf').get('/api/deliveries/drivers')
    expect(all.status).toBe(200)
    expect(all.body.map((d: { id: number }) => d.id)).toEqual([
      driverA,
      driverB,
    ])
    // a fahrer sees only himself - not his colleagues' phones and accounts
    const own = await as('fahrer').get('/api/deliveries/drivers')
    expect(own.status).toBe(200)
    expect(own.body.map((d: { id: number }) => d.id)).toEqual([driverA])
    expect(
      (await as('fahrer2').get('/api/deliveries/drivers')).body.map(
        (d: { id: number }) => d.id
      )
    ).toEqual([driverB])
    const active = await as('verkauf').get(
      '/api/deliveries/drivers?active=true'
    )
    expect(active.body.map((d: { id: number }) => d.id)).toEqual([driverA])
    await as('inhaber').put(`/api/deliveries/drivers/${driverB}`, {
      active: true,
    })
  })

  it('backstube gets 403, verkauf may not write', async () => {
    expect((await as('backstube').get('/api/deliveries/drivers')).status).toBe(
      403
    )
    expect(
      (await as('verkauf').post('/api/deliveries/drivers', { name: 'Z' }))
        .status
    ).toBe(403)
  })
})

describe('depot', () => {
  it('reads the seeded depot in the mock shape', async () => {
    const res = await as('verkauf').get('/api/deliveries/depot')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      name: expect.any(String),
      street: expect.any(String),
      zip: expect.any(String),
      city: expect.any(String),
      phone: expect.any(String),
      lat: expect.any(Number),
      lon: expect.any(Number),
    })
  })

  it('a new address that is not found is 422 and keeps the old one', async () => {
    const before = (await as('inhaber').get('/api/deliveries/depot')).body
    const res = await as('inhaber').put('/api/deliveries/depot', {
      street: 'Nirgendwo 99',
    })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('Address not found')
    expect((await as('inhaber').get('/api/deliveries/depot')).body).toEqual(
      before
    )
  })

  it('takes manual coordinates and validates them', async () => {
    const bad = await as('inhaber').put('/api/deliveries/depot', {
      lat: 0,
      lon: 0,
    })
    expect(bad.status).toBe(400)
    const before = (await as('inhaber').get('/api/deliveries/depot')).body
    const ok = await as('inhaber').put('/api/deliveries/depot', {
      lat: before.lat,
      lon: before.lon,
    })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ geocodeSource: 'manual' })
    expect((await as('verkauf').put('/api/deliveries/depot', {})).status).toBe(
      403
    )
  })

  it('changes only the fields a request names, limits the phone', async () => {
    const before = (await as('inhaber').get('/api/deliveries/depot')).body
    const phone = await as('inhaber').put('/api/deliveries/depot', {
      phone: '06841 000 000',
    })
    expect(phone.status).toBe(200)
    expect(phone.body).toEqual({ ...before, phone: '06841000000' })
    const name = await as('inhaber').put('/api/deliveries/depot', {
      name: 'Backstube Test',
    })
    // the phone of the first request survives the second
    expect(name.body).toEqual({
      ...before,
      name: 'Backstube Test',
      phone: '06841000000',
    })
    const long = await as('inhaber').put('/api/deliveries/depot', {
      phone: '1'.repeat(41),
    })
    expect(long.status).toBe(400)
    expect(long.body.error).toBe('Text too long')
    const control = await as('inhaber').put('/api/deliveries/depot', {
      city: 'Ort\u0007',
    })
    expect(control.status).toBe(400)
    expect(control.body.error).toBe('Invalid text')
    await as('inhaber').put('/api/deliveries/depot', {
      name: before.name,
      phone: before.phone,
    })
    // a phone that is sent is normalised (digits and +), like the mock
    expect((await as('inhaber').get('/api/deliveries/depot')).body).toEqual({
      ...before,
      phone: String(before.phone).replace(/[^\d+]/g, ''),
    })
  })

  it('two overlapping changes keep both (read inside the transaction)', async () => {
    const before = (await as('inhaber').get('/api/deliveries/depot')).body
    const [a, b] = await Promise.all([
      as('inhaber').put('/api/deliveries/depot', { name: 'Parallel A' }),
      as('inhaber').put('/api/deliveries/depot', { phone: '0000 12345' }),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    const after = (await as('inhaber').get('/api/deliveries/depot')).body
    expect(after).toMatchObject({ name: 'Parallel A', phone: '000012345' })
    await as('inhaber').put('/api/deliveries/depot', {
      name: before.name,
      phone: before.phone,
    })
  })
})

// ------------------------------------------------------------------ tours

describe('tours', () => {
  it('a Saturday tour gets the Mörsbach stop, only the first one of the day', async () => {
    const first = await newTour({ date: SATURDAY, driverId: driverA })
    expect(first.stops).toHaveLength(1)
    expect(first.stops[0]).toMatchObject({
      pickupPointId: MOERSBACH,
      status: 'open',
      timeWindow: '09:00-09:30',
      preorders: [],
      preorderSummary: expect.objectContaining({ count: 0 }),
      pickupPoint: expect.objectContaining({ id: MOERSBACH }),
    })
    const second = await newTour({ date: SATURDAY, driverId: driverB })
    expect(second.stops).toHaveLength(0)
    const friday = await newTour({ date: FRIDAY })
    expect(friday.stops).toEqual([])
    expect(friday).toMatchObject({
      status: 'planned',
      plannedStart: '06:30',
      vehicleType: 'car',
      isEstimate: true,
      driver: null,
      progress: { total: 0, done: 0, failed: 0, open: 0, isComplete: false },
      depot: expect.objectContaining({ lat: expect.any(Number) }),
    })
  })

  it('two tours created at once never both get the Sammelstelle', async () => {
    const DAY = '2026-11-28'
    const [a, b] = await Promise.all([
      as('inhaber').post('/api/deliveries/tours', { date: DAY }),
      as('inhaber').post('/api/deliveries/tours', { date: DAY }),
    ])
    expect([a.status, b.status]).toEqual([201, 201])
    expect(a.body.stops.length + b.body.stops.length).toBe(1)
  })

  it('validates date, plannedStart, driver and name', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ date: '2026-02-30' }, 'Invalid date'],
      [{ date: SATURDAY, plannedStart: '25:61' }, 'Invalid plannedStart'],
      [{ date: SATURDAY, driverId: 999 }, 'Driver not found'],
      [{ date: SATURDAY, name: 'x'.repeat(121) }, 'Text too long'],
      [{ date: SATURDAY, name: 'Tour\u202eX\u0007' }, 'Invalid text'],
    ]
    for (const [body, error] of cases) {
      const res = await as('inhaber').post('/api/deliveries/tours', body)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error, message: expect.any(String) })
    }
    const tour = await newTour({ date: FRIDAY })
    const renamed = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}`,
      { name: 'Tour\u202eX' }
    )
    expect(renamed.status).toBe(400)
    expect(renamed.body.error).toBe('Invalid text')
    await as('inhaber').delete(`/api/deliveries/tours/${tour.id}`)
    const query = await as('verkauf').get('/api/deliveries/tours?date=morgen')
    expect(query.status).toBe(400)
    expect(query.body.error).toBe('Invalid date')
  })

  it('adds, reorders, ticks and removes stops; status follows the stops', async () => {
    const tour = await newTour({ date: FRIDAY, driverId: driverA })
    const one = await as('inhaber').post(
      `/api/deliveries/tours/${tour.id}/stops`,
      stopAt('Kundin Eins', 49.33, 7.33)
    )
    expect(one.status).toBe(201)
    const two = await as('inhaber').post(
      `/api/deliveries/tours/${tour.id}/stops`,
      { ...stopAt('Kunde Zwei', 49.32, 7.34), timeWindow: 'ab 08:00' }
    )
    const [s1, s2] = two.body.stops
    expect(s1).toMatchObject({
      customer: 'Kundin Eins',
      address: 'Musterweg 1, 66424 Homburg',
      geocodeSource: 'manual',
      estimatedArrival: expect.any(String),
    })
    expect(s2.timeWindow).toBe('ab 08:00')

    const reordered = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}`,
      { stopOrder: [s2.id, s1.id], plannedStart: '07:15' }
    )
    expect(reordered.status).toBe(200)
    expect(reordered.body.stops.map((s: { id: number }) => s.id)).toEqual([
      s2.id,
      s1.id,
    ])
    expect(reordered.body.plannedStart).toBe('07:15')
    expect(reordered.body.nextStopId).toBe(s2.id)

    const done = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}/stops/${s2.id}`,
      { status: 'done' }
    )
    expect(done.body.status).toBe('active')
    expect(done.body.startedAt).toEqual(expect.any(String))
    const failed = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}/stops/${s1.id}`,
      {
        status: 'failed',
        failureReason: 'Nicht angetroffen',
        goodsDisposition: 'taken_back',
      }
    )
    expect(failed.body.status).toBe('done')
    expect(failed.body.progress).toMatchObject({ done: 1, failed: 1, open: 0 })

    const removed = await as('inhaber').delete(
      `/api/deliveries/tours/${tour.id}/stops/${s1.id}`
    )
    expect(removed.status).toBe(200)
    expect(removed.body.stops).toHaveLength(1)
    const gone = await as('inhaber').delete(
      `/api/deliveries/tours/${tour.id}/stops/${s1.id}`
    )
    expect(gone.status).toBe(404)
    expect(gone.body.error).toBe('Stop not found')
  })

  it('refuses invalid stops (mock rules plus the B8 text limits)', async () => {
    const tour = await newTour({ date: FRIDAY })
    const path = `/api/deliveries/tours/${tour.id}/stops`
    expect((await as('inhaber').post(path, { street: 'X 1' })).status).toBe(400)
    const long = await as('inhaber').post(path, {
      ...stopAt('A', 49.3, 7.3),
      customer: 'x'.repeat(201),
    })
    expect(long.status).toBe(400)
    expect(long.body.error).toBe('Text too long')
    const control = await as('inhaber').post(path, {
      ...stopAt('A‮', 49.3, 7.3),
    })
    expect(control.status).toBe(400)
    expect(control.body.error).toBe('Invalid text')
    const phone = await as('inhaber').post(path, {
      ...stopAt('A', 49.3, 7.3),
      phone: '1'.repeat(41),
    })
    expect(phone.status).toBe(400)
    expect(phone.body.error).toBe('Text too long')
    const point = await as('inhaber').post(path, {
      ...stopAt('A', 49.3, 7.3),
      pickupPointId: 'gibt-es-nicht',
    })
    expect(point.status).toBe(400)
    expect(point.body.error).toBe('Pickup point not found')
    const coords = await as('inhaber').post(path, {
      ...stopAt('A', 0, 0),
    })
    expect(coords.status).toBe(400)
    const stamp = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}/stops/1`,
      { completedAt: 'gestern' }
    )
    expect(stamp.status).toBe(400)
    expect(stamp.body.error).toBe('Invalid completedAt')
  })

  it('answers 404 for unknown and malformed ids, deletes with the mock body', async () => {
    expect((await as('verkauf').get('/api/deliveries/tours/abc')).status).toBe(
      404
    )
    expect(
      (await as('verkauf').get('/api/deliveries/tours/9999')).body
    ).toEqual({
      success: false,
      error: 'Tour not found',
      message: 'Diese Tour existiert nicht.',
    })
    const tour = await newTour({ date: FRIDAY })
    const res = await as('inhaber').delete(`/api/deliveries/tours/${tour.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, message: 'Tour gelöscht.' })
    expect(
      (await as('inhaber').delete(`/api/deliveries/tours/${tour.id}`)).status
    ).toBe(404)
    expect(await DeliveryStop.count({ where: { tourId: tour.id } })).toBe(0)
  })

  it('PATCH validates status and plannedStart and resets times on planned', async () => {
    const tour = await newTour({ date: FRIDAY })
    const path = `/api/deliveries/tours/${tour.id}`
    expect((await as('inhaber').patch(path, { status: 'x' })).body.error).toBe(
      'Invalid status'
    )
    expect(
      (await as('inhaber').patch(path, { plannedStart: '7 Uhr' })).body.error
    ).toBe('Invalid plannedStart')
    const active = await as('inhaber').patch(path, { status: 'active' })
    expect(active.body.startedAt).toEqual(expect.any(String))
    const planned = await as('inhaber').patch(path, { status: 'planned' })
    expect(planned.body).toMatchObject({ startedAt: null, finishedAt: null })
  })
})

// ------------------------------------------------------------------ roles

describe('fahrer: own tours only', () => {
  let own = 0
  let foreign = 0
  let ownStop = 0
  let foreignStop = 0

  beforeAll(async () => {
    const a = await newTour({ date: '2026-12-04', driverId: driverA })
    const b = await newTour({ date: '2026-12-04', driverId: driverB })
    own = a.id
    foreign = b.id
    ownStop = (
      await as('inhaber').post(
        `/api/deliveries/tours/${own}/stops`,
        stopAt('Eigen', 49.3, 7.3)
      )
    ).body.stops[0].id
    foreignStop = (
      await as('inhaber').post(
        `/api/deliveries/tours/${foreign}/stops`,
        stopAt('Fremd', 49.31, 7.31)
      )
    ).body.stops[0].id
  })

  it('lists only the own tours, also with a foreign driverId', async () => {
    const list = await as('fahrer').get('/api/deliveries/tours?date=2026-12-04')
    expect(list.body.map((t: { id: number }) => t.id)).toEqual([own])
    const asked = await as('fahrer').get(
      `/api/deliveries/tours?date=2026-12-04&driverId=${driverB}`
    )
    expect(asked.body).toEqual([])
    const seller = await as('verkauf').get(
      '/api/deliveries/tours?date=2026-12-04'
    )
    expect(seller.body).toHaveLength(2)
  })

  it('a foreign tour is 403, read and write', async () => {
    expect(
      (await as('fahrer').get(`/api/deliveries/tours/${foreign}`)).body.error
    ).toBe('not_own_tour')
    const tick = await as('fahrer').patch(
      `/api/deliveries/tours/${foreign}/stops/${foreignStop}`,
      { status: 'done' }
    )
    expect(tick.status).toBe(403)
    expect(tick.body.error).toBe('not_own_tour')
    const pos = await as('fahrer').post(
      `/api/deliveries/tours/${foreign}/position`,
      { lat: 49.3, lon: 7.3 }
    )
    expect(pos.status).toBe(403)
    expect(
      (await as('fahrer').post(`/api/deliveries/tours/${foreign}/optimize`))
        .status
    ).toBe(403)
    expect((await DeliveryStop.findByPk(foreignStop))?.status).toBe('open')
  })

  it('ticks own stops, reports position, recalculates; nothing else', async () => {
    const tick = await as('fahrer').patch(
      `/api/deliveries/tours/${own}/stops/${ownStop}`,
      { status: 'done', completedAt: '2026-12-04T07:10:00.000Z' }
    )
    expect(tick.status).toBe(200)
    expect(tick.body.stops[0]).toMatchObject({
      status: 'done',
      completedAt: '2026-12-04T07:10:00.000Z',
    })
    const edit = await as('fahrer').patch(
      `/api/deliveries/tours/${own}/stops/${ownStop}`,
      { status: 'open', customer: 'Anders' }
    )
    expect(edit.status).toBe(403)
    expect(edit.body).toMatchObject({
      error: 'forbidden_fields',
      fields: ['customer'],
    })
    const pos = await as('fahrer').post(
      `/api/deliveries/tours/${own}/position`,
      {
        lat: 49.3,
        lon: 7.31,
        accuracy: 12,
      }
    )
    expect(pos.status).toBe(200)
    expect(pos.body).toMatchObject({ lat: 49.3, lon: 7.31, accuracy: 12 })
    const badPos = await as('fahrer').post(
      `/api/deliveries/tours/${own}/position`,
      { lat: null, lon: 7 }
    )
    expect(badPos.status).toBe(400)
    const opt = await as('fahrer').post(`/api/deliveries/tours/${own}/optimize`)
    expect(opt.status).toBe(200)
    expect(opt.body.isEstimate).toBe(true)
    for (const [method, path] of [
      ['post', '/api/deliveries/tours'],
      ['patch', `/api/deliveries/tours/${own}`],
      ['delete', `/api/deliveries/tours/${own}`],
      ['post', `/api/deliveries/tours/${own}/stops`],
      ['delete', `/api/deliveries/tours/${own}/stops/${ownStop}`],
      ['put', '/api/deliveries/depot'],
      ['post', '/api/deliveries/geocode'],
    ] as const) {
      expect((await as('fahrer')[method](path)).status).toBe(403)
    }
  })

  it('a fahrer without a linked driver sees no tours', async () => {
    await createUser({ username: 'test.fahrer3', role: 'fahrer' })
    const token = bearer((await login(api.app, 'test.fahrer3')).token)
    const res = await request(api.app)
      .get('/api/deliveries/tours?date=2026-12-04')
      .set(token)
    expect(res.body).toEqual([])
  })

  it('verkauf reads but does not tick; backstube is out', async () => {
    expect(
      (await as('verkauf').get(`/api/deliveries/tours/${own}`)).status
    ).toBe(200)
    expect(
      (
        await as('verkauf').patch(
          `/api/deliveries/tours/${own}/stops/${ownStop}`,
          { status: 'open' }
        )
      ).status
    ).toBe(403)
    expect((await as('backstube').get('/api/deliveries/tours')).status).toBe(
      403
    )
    expect((await request(api.app).get('/api/deliveries/tours')).status).toBe(
      401
    )
  })
})

// ------------------------------------------------------------ Sammelstelle

describe('Sammelstelle: handover list from /api/preorders', () => {
  const DAY = '2026-12-05' // Saturday
  let tourId = 0

  beforeAll(async () => {
    tourId = (await newTour({ date: DAY, driverId: driverA })).id
  })

  it("carries the day's preorders of the point in the mock shape, without cancelled", async () => {
    const make = (name: string) =>
      as('verkauf').post('/api/preorders', {
        channel: 'sammelstelle',
        customerName: name,
        customerPhone: '0170 000 0002',
        pickupDate: DAY,
        pickupPointId: MOERSBACH,
        items: [{ productId: 'kornbrot-500g', quantity: 2 }],
      })
    const kept = await make('Kundin Sammel')
    expect(kept.status).toBe(201)
    const cancelled = await make('Kunde Storno')
    await as('verkauf').post(`/api/preorders/${cancelled.body.data.id}/cancel`)

    const res = await as('fahrer').get(`/api/deliveries/tours/${tourId}`)
    const stop = res.body.stops.find(
      (s: { pickupPointId?: string }) => s.pickupPointId === MOERSBACH
    )
    expect(stop.preorders).toHaveLength(1)
    expect(stop.preorders[0]).toMatchObject({
      id: kept.body.data.id,
      reference: kept.body.data.code,
      customer: 'Kundin Sammel',
      status: 'open',
      date: DAY,
      items: [expect.objectContaining({ productId: 'kornbrot-500g', qty: 2 })],
    })
    expect(stop.preorderSummary).toMatchObject({ count: 1, open: 1 })

    // The driver hands it over through the alias, the tour shows it.
    const handed = await as('fahrer').patch(
      `/api/deliveries/preorders/${kept.body.data.id}`,
      { status: 'handed_over' }
    )
    expect(handed.status).toBe(200)
    const after = await as('fahrer').get(`/api/deliveries/tours/${tourId}`)
    const stopAfter = after.body.stops.find(
      (s: { pickupPointId?: string }) => s.pickupPointId === MOERSBACH
    )
    expect(stopAfter.preorderSummary).toMatchObject({ handedOver: 1 })
  })

  it('an address change of the point moves into its stops and clears the coordinates', async () => {
    const points = await as('inhaber').get('/api/preorders/pickup-points')
    const point = points.body.data.find(
      (p: { id: string }) => p.id === MOERSBACH
    )
    await DeliveryStop.update(
      { lat: 49.2, lon: 7.4, geocodeSource: 'manual' },
      { where: { pickupPointId: MOERSBACH } }
    )
    const res = await as('inhaber').put(
      `/api/preorders/pickup-points/${MOERSBACH}`,
      { ...point, street: 'Teststraße 5' }
    )
    expect(res.status).toBe(200)
    const stops = await DeliveryStop.findAll({
      where: { pickupPointId: MOERSBACH },
    })
    expect(stops.length).toBeGreaterThan(0)
    for (const stop of stops) {
      expect(stop.street).toBe('Teststraße 5')
      expect(stop.lat).toBeNull()
    }
    await as('inhaber').put(`/api/preorders/pickup-points/${MOERSBACH}`, point)
  })
})

describe('Sammelstelle: payment on the handover list (Abschluss-Verifikation next)', () => {
  const DAY = '2026-12-12' // Saturday
  let tourId = 0

  beforeAll(async () => {
    tourId = (await newTour({ date: DAY, driverId: driverA })).id
  })

  const order = async (name: string, quantity: number, paid: boolean) => {
    const res = await as('verkauf').post('/api/preorders', {
      channel: 'sammelstelle',
      customerName: name,
      pickupDate: DAY,
      pickupPointId: MOERSBACH,
      paid,
      items: [{ productId: 'kornbrot-500g', quantity }],
    })
    expect(res.status).toBe(201)
    return res.body.data as { id: number; total: number }
  }
  const setQty = (id: number, quantity: number) =>
    as('verkauf').patch(`/api/preorders/${id}`, {
      items: [{ productId: 'kornbrot-500g', quantity }],
    })
  const handover = async () => {
    const res = await as('fahrer').get(`/api/deliveries/tours/${tourId}`)
    expect(res.status).toBe(200)
    return res.body.stops.find(
      (s: { pickupPointId?: string }) => s.pickupPointId === MOERSBACH
    ) as {
      preorders: Array<Record<string, unknown> & { id: number }>
      preorderSummary: { count: number; cancelled: number }
    }
  }
  const stored = async (id: number) =>
    (await as('verkauf').get(`/api/preorders/${id}`)).body.data as {
      paid: boolean
      paidAmount: number | null
      paymentBalance: number
      total: number
      status: string
    }

  it('carries paidAmount and paymentBalance, and a paid cancelled order as a refund', async () => {
    const prepaid = await order('Testkundin Vorkasse', 2, true)
    const topUp = await order('Testkunde Nachzahlung', 2, true)
    expect((await setQty(topUp.id, 4)).status).toBe(200)
    const refund = await order('Testkundin Erstattung', 4, true)
    expect((await setQty(refund.id, 1)).status).toBe(200)
    const cancelled = await order('Testkunde Storno bezahlt', 2, true)
    await as('verkauf').post(`/api/preorders/${cancelled.id}/cancel`)
    const unpaidCancelled = await order('Testkunde Storno offen', 1, false)
    await as('verkauf').post(`/api/preorders/${unpaidCancelled.id}/cancel`)

    const stop = await handover()
    const byId = new Map(stop.preorders.map((p) => [p.id, p]))
    expect(byId.get(prepaid.id)).toMatchObject({
      paid: true,
      paidAmount: prepaid.total,
      paymentBalance: 0,
    })
    expect(Number(byId.get(topUp.id)?.['paymentBalance'])).toBeGreaterThan(0)
    expect(Number(byId.get(refund.id)?.['paymentBalance'])).toBeLessThan(0)
    expect(byId.get(cancelled.id)).toMatchObject({
      status: 'cancelled',
      paymentBalance: -cancelled.total,
    })
    // A cancelled order without money to give back stays off the list.
    expect(byId.has(unpaidCancelled.id)).toBe(false)
    expect(stop.preorderSummary.count).toBe(3)
  })

  it('a handover keeps an open rest or refund unless the driver confirms it', async () => {
    const topUp = await order('Testkunde Rest', 1, true)
    expect((await setQty(topUp.id, 3)).status).toBe(200)
    const refund = await order('Testkundin Zurück', 3, true)
    expect((await setQty(refund.id, 1)).status).toBe(200)
    const restBefore = await stored(topUp.id)
    const refundBefore = await stored(refund.id)
    expect(restBefore.paymentBalance).toBeGreaterThan(0)
    expect(refundBefore.paymentBalance).toBeLessThan(0)

    for (const id of [topUp.id, refund.id]) {
      const res = await as('fahrer').patch(`/api/deliveries/preorders/${id}`, {
        status: 'handed_over',
      })
      expect(res.status).toBe(200)
    }
    expect(await stored(topUp.id)).toMatchObject({
      status: 'abgeholt',
      paid: true,
      paidAmount: restBefore.paidAmount,
      paymentBalance: restBefore.paymentBalance,
    })
    expect(await stored(refund.id)).toMatchObject({
      status: 'abgeholt',
      paidAmount: refundBefore.paidAmount,
      paymentBalance: refundBefore.paymentBalance,
    })

    // "Rest kassiert": the driver confirms with paid: true.
    const confirmed = await as('fahrer').patch(
      `/api/deliveries/preorders/${topUp.id}`,
      { status: 'handed_over', paid: true }
    )
    expect(confirmed.status).toBe(200)
    expect(confirmed.body).toMatchObject({ paymentBalance: 0 })
    expect(await stored(topUp.id)).toMatchObject({ paymentBalance: 0 })
    // He never takes a payment back.
    const undo = await as('fahrer').patch(
      `/api/deliveries/preorders/${refund.id}`,
      { status: 'handed_over', paid: false }
    )
    expect(undo.status).toBe(403)
  })

  it('an unpaid order is still paid in full at the handover (Mörsbach collects there)', async () => {
    const unpaid = await order('Testkunde bar', 2, false)
    const res = await as('fahrer').patch(
      `/api/deliveries/preorders/${unpaid.id}`,
      { status: 'handed_over' }
    )
    expect(res.status).toBe(200)
    expect(await stored(unpaid.id)).toMatchObject({
      paid: true,
      paidAmount: unpaid.total,
      paymentBalance: 0,
    })
  })

  it('names a Sorte like the management screens', () => {
    const core = require('../../src/services/delivery-preorders.core')
    const legacy = core.toLegacyPreorder(
      {
        id: 1,
        code: 'MO-1',
        items: [
          {
            productId: 'x',
            name: 'Probekuchen',
            variant: 'schoko-kirsch',
            quantity: 1,
            unitPrice: 1,
          },
        ],
        total: 1,
      },
      null,
      new Date()
    )
    expect(legacy.items[0].name).toBe('Probekuchen (Schoko-Kirsch)')
  })
})

describe('stop and tour input checks (Abschluss-Verifikation next)', () => {
  let tourId = 0
  let stopId = 0

  beforeAll(async () => {
    const tour = await newTour({ date: '2026-12-15', driverId: driverA })
    tourId = tour.id
    const added = await as('inhaber').post(
      `/api/deliveries/tours/${tourId}/stops`,
      stopAt('Testkundin Prüfung', 49.31, 7.35)
    )
    expect(added.status).toBe(201)
    stopId = added.body.stops[added.body.stops.length - 1].id
  })

  it('refuses control, bidi and invisible characters in failureReason', async () => {
    for (const reason of [
      'Kunde nicht da ‮redot‬',
      'a\u0000b',
      'a\u0007c',
      'x​y',
    ]) {
      const res = await as('fahrer').patch(
        `/api/deliveries/tours/${tourId}/stops/${stopId}`,
        {
          status: 'failed',
          failureReason: reason,
          goodsDisposition: 'taken_back',
        }
      )
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'Invalid text' })
    }
    const ok = await as('fahrer').patch(
      `/api/deliveries/tours/${tourId}/stops/${stopId}`,
      {
        status: 'failed',
        failureReason: 'Annahme verweigert',
        goodsDisposition: 'taken_back',
      }
    )
    expect(ok.status).toBe(200)
  })

  it('takes a completedAt only around the tour date', async () => {
    for (const at of ['9999-12-31T00:00:00Z', '1970-01-01T00:00:00Z']) {
      const res = await as('fahrer').patch(
        `/api/deliveries/tours/${tourId}/stops/${stopId}`,
        { status: 'done', completedAt: at }
      )
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'Invalid completedAt' })
    }
    const res = await as('fahrer').patch(
      `/api/deliveries/tours/${tourId}/stops/${stopId}`,
      { status: 'done', completedAt: '2026-12-15T08:12:00.000Z' }
    )
    expect(res.status).toBe(200)
    expect(
      res.body.stops.find((s: { id: number }) => s.id === stopId).completedAt
    ).toBe('2026-12-15T08:12:00.000Z')
  })

  it('refuses invented item quantities instead of coercing them', async () => {
    for (const qty of ['abc', -5, 1.5, '1e3x']) {
      const res = await as('inhaber').post(
        `/api/deliveries/tours/${tourId}/stops`,
        {
          ...stopAt('Testkunde Menge', 49.31, 7.35),
          items: [{ name: 'W', qty, unit: 'St' }],
        }
      )
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'Invalid quantity' })
    }
    const raw = await request(api.app)
      .post(`/api/deliveries/tours/${tourId}/stops`)
      .set(tokens['inhaber'])
      .set('Content-Type', 'application/json')
      .send(
        '{"customer":"Testkunde Riesig","street":"Musterweg 1","items":[{"name":"W","qty":1e309}]}'
      )
    expect(raw.status).toBe(400)
    const ok = await as('inhaber').post(
      `/api/deliveries/tours/${tourId}/stops`,
      {
        ...stopAt('Testkunde Ohne Menge', 49.31, 7.35),
        items: [{ name: 'W' }, { name: 'V', qty: '3' }],
      }
    )
    expect(ok.status).toBe(201)
    expect(ok.body.stops[ok.body.stops.length - 1].items).toEqual([
      { name: 'W', qty: 1, unit: 'Stück' },
      { name: 'V', qty: 3, unit: 'Stück' },
    ])
  })

  it('refuses a malformed driverId and a tour date far in the future', async () => {
    const bad = await as('inhaber').post('/api/deliveries/tours', {
      date: '2026-12-16',
      driverId: '1abc',
    })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'Invalid driverId' })
    const far = await as('inhaber').post('/api/deliveries/tours', {
      date: '9999-12-31',
    })
    expect(far.status).toBe(400)
    expect(far.body).toMatchObject({ error: 'Invalid date' })
    const patch = await as('inhaber').patch(`/api/deliveries/tours/${tourId}`, {
      driverId: 'x',
    })
    expect(patch.status).toBe(400)
    const text = await as('inhaber').patch(`/api/deliveries/tours/${tourId}`, {
      driverId: String(driverB),
    })
    expect(text.status).toBe(200)
    expect(text.body.driverId).toBe(driverB)
  })
})

// ------------------------------------------------------------ geo services

describe('address search and routing', () => {
  it('a read waits at most the budget; the late hit is stored for the next read', async () => {
    const tour = await newTour({ date: '2026-12-11' })
    const added = await as('inhaber').post(
      `/api/deliveries/tours/${tour.id}/stops`,
      {
        customer: 'Spät',
        street: 'Langsamweg 3',
        zip: '66424',
        city: 'Homburg',
      }
    )
    expect(added.status).toBe(201)
    expect(added.body.stops[0].lat).toBeNull()
    await idle()
    resetGeo()

    geoState.geocode = async () => {
      await sleep(800)
      return { lat: 49.35, lon: 7.35, precision: 'house', displayName: 'Test' }
    }
    // the miss of the add is cached for a minute - a read does not retry it
    const cached = await as('verkauf').get(`/api/deliveries/tours/${tour.id}`)
    expect(cached.body.stops[0].lat).toBeNull()
    expect(geoState.geocodeCalls).toEqual([])

    // an explicit search (force) does; the read after the budget sees it
    const started = Date.now()
    const forced = await as('inhaber').patch(
      `/api/deliveries/tours/${tour.id}/stops/${added.body.stops[0].id}`,
      { street: 'Langsamweg 4' }
    )
    expect(Date.now() - started).toBeLessThan(800)
    expect(forced.body.stops[0].lat).toBeNull()
    await idle()
    const later = await as('verkauf').get(`/api/deliveries/tours/${tour.id}`)
    expect(later.body.stops[0]).toMatchObject({
      lat: 49.35,
      lon: 7.35,
      geocodeSource: 'nominatim',
      geocodePrecision: 'house',
    })
    expect(await DeliveryGeocache.count()).toBeGreaterThan(0)
  })

  it('a hit from the cache costs no search', async () => {
    const tour = await newTour({ date: '2026-12-11' })
    const res = await as('inhaber').post(
      `/api/deliveries/tours/${tour.id}/stops`,
      {
        customer: 'Zweiter',
        street: 'Langsamweg 4',
        zip: '66424',
        city: 'Homburg',
      }
    )
    expect(res.body.stops[0]).toMatchObject({
      lat: 49.35,
      geocodeSource: 'cache',
    })
    expect(geoState.geocodeCalls).toEqual([])
  })

  it('POST /geocode answers the hit or 404', async () => {
    expect(
      (await as('inhaber').post('/api/deliveries/geocode', {})).body.error
    ).toBe('Address is required')
    const miss = await as('inhaber').post('/api/deliveries/geocode', {
      address: 'Unbekannt 1, Nirgendwo',
    })
    expect(miss.status).toBe(404)
    geoState.geocode = async () => ({
      lat: 49.1,
      lon: 7.1,
      precision: 'street',
    })
    const hit = await as('inhaber').post('/api/deliveries/geocode', {
      street: 'Neuweg 1',
      city: 'Homburg',
    })
    expect(hit.status).toBe(200)
    expect(hit.body).toMatchObject({ lat: 49.1, lon: 7.1 })
  })

  it('optimize uses OSRM when it answers and keeps a tick made meanwhile', async () => {
    const tour = await newTour({ date: '2026-12-18' })
    const path = `/api/deliveries/tours/${tour.id}`
    await as('inhaber').post(`${path}/stops`, stopAt('A', 49.3, 7.3))
    await as('inhaber').post(`${path}/stops`, stopAt('B', 49.4, 7.4))
    const added = await as('inhaber').post(
      `${path}/stops`,
      stopAt('C', 49.35, 7.35)
    )
    const [a, b, c] = added.body.stops.map((s: { id: number }) => s.id)
    let routed = 0
    geoState.route = async (_depot, stops): Promise<RoutedTour> => {
      routed++
      await sleep(200)
      const ids = stops.map((s) => s.id)
      return {
        order: [...ids].reverse(),
        distance: 12345,
        duration: 1800,
        geometry: [
          [7.3, 49.3],
          [7.4, 49.4],
        ],
      }
    }
    // supertest sends on then(), not on creation
    const optimizing = as('inhaber')
      .post(`${path}/optimize`, {})
      .then((r) => r)
    await sleep(50)
    const tick = await as('inhaber').patch(`${path}/stops/${a}`, {
      status: 'done',
    })
    expect(tick.status).toBe(200)
    const res = await optimizing
    expect(res.status).toBe(200)
    expect(routed).toBe(2) // first result was stale, recomputed once
    expect(res.body).toMatchObject({ isEstimate: false, distance: 12345 })
    const byId = new Map(
      res.body.stops.map((s: { id: number; status: string }) => [
        s.id,
        s.status,
      ])
    )
    expect(byId.get(a)).toBe('done')
    expect(res.body.stops.map((s: { id: number }) => s.id)).toEqual([a, c, b])
  })

  it('without OSRM it falls back to the estimate', async () => {
    const tour = await newTour({ date: '2026-12-18' })
    const path = `/api/deliveries/tours/${tour.id}`
    await as('inhaber').post(`${path}/stops`, stopAt('A', 49.3, 7.3))
    const res = await as('inhaber').post(`${path}/optimize`, {
      optimize: false,
    })
    expect(res.body).toMatchObject({
      isEstimate: true,
      geometry: null,
      distance: expect.any(Number),
      routedAt: expect.any(String),
    })
  })
})

// ------------------------------------------------------------------ audit

describe('audit', () => {
  it('records writes without customer names or addresses', async () => {
    const tour = await newTour({ date: '2026-12-19', driverId: driverA })
    const added = await as('inhaber').post(
      `/api/deliveries/tours/${tour.id}/stops`,
      stopAt('Geheime Kundin', 49.3, 7.3)
    )
    const stopId = added.body.stops.find(
      (s: { customer: string }) => s.customer === 'Geheime Kundin'
    ).id
    await as('fahrer').patch(
      `/api/deliveries/tours/${tour.id}/stops/${stopId}`,
      {
        status: 'done',
      }
    )
    await as('fahrer').post(`/api/deliveries/tours/${tour.id}/position`, {
      lat: 49.3,
      lon: 7.3,
    })
    await as('inhaber').delete(`/api/deliveries/tours/${tour.id}`)
    const rows = await AuditLog.findAll({
      where: { entity: 'delivery_tour', entityId: String(tour.id) },
      order: [['id', 'ASC']],
    })
    expect(rows.map((r) => r.action)).toEqual([
      'create',
      'add_stop',
      'update_stop',
      'delete',
    ])
    expect(rows[2].userId).toBe(userIds['fahrer'])
    const text = JSON.stringify(rows.map((r) => r.data))
    expect(text).not.toContain('Geheime')
    expect(text).not.toContain('Musterweg')
  })
})

// ------------------------------------------------------------- DSGVO (P4)

describe('anonymisation 90 days after the tour (P4 rule, nightly run)', () => {
  it('clears name, phone, notes, street and coordinates of old stops only', async () => {
    const OLD = '2026-07-04' // Saturday: gets the Mörsbach stop
    const old = await newTour({ date: OLD, driverId: driverA })
    const oldStop = await as('inhaber').post(
      `/api/deliveries/tours/${old.id}/stops`,
      {
        ...stopAt('Testkundin Alt', 49.31, 7.31),
        street: 'Altweg 3',
        phone: '0000 55555',
        notes: 'Hund im Hof',
      }
    )
    expect(oldStop.status).toBe(201)
    const shared = await as('inhaber').post(
      `/api/deliveries/tours/${old.id}/stops`,
      { ...stopAt('Testkunde Geteilt', 49.32, 7.32), street: 'Neuweg 9' }
    )
    expect(shared.status).toBe(201)
    // a newer tour still drives to Neuweg 9: its cache entry must stay
    const recent = await newTour({ date: FRIDAY })
    await as('inhaber').post(`/api/deliveries/tours/${recent.id}/stops`, {
      ...stopAt('Testkunde Neu', 49.32, 7.32),
      street: 'Neuweg 9',
    })
    const keyOf = (street: string) =>
      `${street} 66424 homburg`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    await DeliveryGeocache.bulkCreate([
      { key: keyOf('Altweg 3'), lat: 49.31, lon: 7.31 },
      { key: keyOf('Neuweg 9'), lat: 49.32, lon: 7.32 },
    ])

    // today 2026-11-12 → cutoff 2026-08-14
    const dry = await anonymizePreorders({ today: '2026-11-12', dryRun: true })
    expect(dry.deliveryStops.stops).toHaveLength(2)
    expect(
      await DeliveryStop.count({ where: { customer: 'Testkundin Alt' } })
    ).toBe(1)

    const report = await anonymizePreorders({ today: '2026-11-12' })
    expect(report.deliveryStops).toMatchObject({ geocacheRemoved: 1 })
    expect(report.deliveryStops.stops.map((s) => s.date)).toEqual([OLD, OLD])

    const tour = (await as('inhaber').get(`/api/deliveries/tours/${old.id}`))
      .body
    const customers = tour.stops.filter(
      (s: { pickupPointId?: string }) => !s.pickupPointId
    )
    for (const stop of customers) {
      expect(stop).toMatchObject({
        customer: 'anonymisiert',
        phone: null,
        notes: null,
        street: '',
        zip: '66424',
        city: 'Homburg',
        lat: null,
        lon: null,
        items: [{ name: 'Testbrot', qty: 2, unit: 'Stk' }],
      })
    }
    // the Sammelstelle stop holds only the public address
    expect(
      tour.stops.find((s: { pickupPointId?: string }) => s.pickupPointId)
    ).toMatchObject({ customer: expect.stringContaining('Mörsbach') })
    // the newer tour is untouched, and so is its cache entry
    const fresh = (
      await as('inhaber').get(`/api/deliveries/tours/${recent.id}`)
    ).body
    expect(fresh.stops[0]).toMatchObject({
      customer: 'Testkunde Neu',
      street: 'Neuweg 9',
    })
    expect(await DeliveryGeocache.findByPk(keyOf('Altweg 3'))).toBeNull()
    expect(await DeliveryGeocache.findByPk(keyOf('Neuweg 9'))).not.toBeNull()

    const rows = await AuditLog.findAll({
      where: { action: 'anonymize', entity: 'delivery_stop' },
    })
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows[0].data)).not.toMatch(/Testkund|Altweg|55555/)

    // idempotent: a second night finds nothing and writes no audit row
    const again = await anonymizePreorders({ today: '2026-11-12' })
    expect(again.deliveryStops).toEqual({ stops: [], geocacheRemoved: 0 })
    expect(
      await AuditLog.count({
        where: { action: 'anonymize', entity: 'delivery_stop' },
      })
    ).toBe(1)
  })
})
