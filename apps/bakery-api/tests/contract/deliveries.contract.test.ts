/**
 * Contract (D3, B8, B12): the tour endpoints `/api/deliveries/{depot,drivers,
 * tours,geocode}` of the real API answer like the mock server did (its
 * answers are recorded in `recorded/deliveries.json`, see recorded.ts). One
 * scenario -
 * drivers, a Saturday tour with the Sammelstelle and its handover list,
 * stops, reorder, ticks, recalculation without OSRM, position, delete - runs
 * against both, from the same starting state (depot, Mörsbach point, two
 * drivers, no tours). Status and shape must match, and the values the driver
 * app shows must be equal after normalisation:
 *
 * - **stop ids**: the mock numbers stops per tour (1, 2, …), the real API
 *   globally - ids are mapped to their creation order, and requests that
 *   name a stop use `mockPath`/`realPath`;
 * - **server clocks** (`startedAt`, `finishedAt`, `routedAt`,
 *   `lastPosition.at`, preorder timestamps) are compared as "set / not set";
 * - **extra keys** of the real API are dropped before comparing values
 *   (`success: false` on errors, a driver's `userId`, the depot's
 *   `geocodeSource: 'manual'`).
 *
 * Deliberate differences, asserted as such at the end: text limits and
 * control characters (400 on the real API, the mock stores anything), an
 * unknown `pickupPointId` on a stop (400 vs. stored), an invalid
 * `completedAt` (400 vs. stored).
 *
 * No network: the mock was recorded without Nominatim/OSRM (closed local
 * port), the real API gets an offline geo stub.
 *
 * The real API's clocks (tours and preorders) are pinned to the recording
 * moment (`RECORDED_AT`): arrival estimates never start before "now" and the
 * handover list carries `afterDeadline`, so on the wall clock the Saturday
 * tour's ETAs, time-window flags and deadlines would drift away from the
 * recording once that week comes (there is no mock left to re-record from).
 * The jest project `contract-later` runs this suite with the clock in 2028.
 */
import type { Application } from 'express'
import request from 'supertest'

import { createApp } from '../../src/app'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, OFFLINE_GEO, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'
import {
  compare,
  loadRecordedMock,
  ParityRequest,
  ParityResult,
} from './recorded'

let real: TestApp
let realApp: Application
let mock: Application
let auth: Record<string, string>
const SUITE = 'deliveries'
const SATURDAY = '2027-01-09'
const MOERSBACH = 'kindergarten-moersbach'
const QUIET = { warn: () => undefined }
/** When the mock's answers were recorded (first server stamp in the file). */
const RECORDED_AT = new Date('2026-11-06T12:47:47.500Z')

beforeAll(async () => {
  const productsDir = makeProductsDir()
  real = await createTestApp()
  realApp = createApp({
    logRequests: false,
    sequelize: real.sequelize,
    hqProducts: { productsDir, writeDir: null },
    preorders: {
      productsDir,
      variantsForProduct: () => null,
      now: () => new Date(RECORDED_AT),
    },
    deliveries: {
      geo: OFFLINE_GEO,
      log: QUIET,
      now: () => new Date(RECORDED_AT),
    },
  })
  auth = bearer(await sessionFor(real.app, 'test.inhaber', 'inhaber'))

  // Same starting state as the recorded mock: the real seed (depot,
  // Mörsbach) and the mock's two seed drivers; no tours.
  for (const name of ['Fahrer 1', 'Fahrer 2']) {
    await request(realApp)
      .post('/api/deliveries/drivers')
      .set(auth)
      .send({ name })
  }
  mock = loadRecordedMock(SUITE)
})

afterAll(async () => {
  await real.close()
  removeTempDirs()
})

const send = (req: Omit<ParityRequest, 'headers'>) =>
  compare({ ...req, headers: auth }, { mock, real: realApp })

// ---------------------------------------------------------- normalisation

type Json = unknown

/** The real value restricted to the keys the mock has (recursively). */
function projectOnto(mockValue: Json, realValue: Json): Json {
  if (Array.isArray(mockValue) && Array.isArray(realValue)) {
    return realValue.map((item, i) =>
      projectOnto(mockValue[Math.min(i, mockValue.length - 1)], item)
    )
  }
  if (
    mockValue &&
    realValue &&
    typeof mockValue === 'object' &&
    typeof realValue === 'object' &&
    !Array.isArray(mockValue)
  ) {
    const out: Record<string, Json> = {}
    for (const key of Object.keys(realValue as object)) {
      if (!(key in (mockValue as object))) continue
      out[key] = projectOnto(
        (mockValue as Record<string, Json>)[key],
        (realValue as Record<string, Json>)[key]
      )
    }
    return out
  }
  return realValue
}

const CLOCK_KEYS = new Set([
  'startedAt',
  'finishedAt',
  'routedAt',
  'createdAt',
  'updatedAt',
  'handedOverAt',
  'at',
])

/** Stop ids → creation order; server clocks → "set". */
function normalise(value: Json, ids?: Map<number, number>): Json {
  if (Array.isArray(value)) return value.map((v) => normalise(v, ids))
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, Json>
  let map = ids
  if (Array.isArray(object['stops'])) {
    const stopIds = (object['stops'] as Array<{ id: number }>)
      .map((s) => s.id)
      .sort((a, b) => a - b)
    map = new Map(stopIds.map((id, i) => [id, i + 1]))
  }
  const out: Record<string, Json> = {}
  for (const [key, v] of Object.entries(object)) {
    if (CLOCK_KEYS.has(key)) out[key] = v === null ? null : 'set'
    else if (key === 'nextStopId' && map && typeof v === 'number')
      out[key] = map.get(v)
    else if (key === 'stops' && map && Array.isArray(v))
      out[key] = (v as Array<Record<string, Json>>).map((s) => ({
        ...(normalise(s, map) as object),
        id: map?.get(s['id'] as number),
      }))
    else out[key] = normalise(v, map)
  }
  return out
}

function expectSame(result: ParityResult, status: number): void {
  expect(result.mock.status).toBe(status)
  expect(result.differences).toEqual([])
  expect(normalise(projectOnto(result.mock.body, result.real.body))).toEqual(
    normalise(result.mock.body)
  )
}

type TourBody = { id: number; stops: Array<{ id: number }> }

/** Stop id of the n-th created stop (1-based) on each side. */
function stopIds(
  result: ParityResult,
  n: number
): { mock: number; real: number } {
  const nth = (body: Json) =>
    (body as TourBody).stops.map((s) => s.id).sort((a, b) => a - b)[n - 1]
  return { mock: nth(result.mock.body), real: nth(result.real.body) }
}

// --------------------------------------------------------------- scenario

describe('delivery tours contract (recorded mock vs. real API)', () => {
  let tour = 0
  let latest: ParityResult

  it('GET /depot and /drivers: same data', async () => {
    expectSame(
      await send({ method: 'get', path: '/api/deliveries/depot' }),
      200
    )
    expectSame(
      await send({ method: 'get', path: '/api/deliveries/drivers' }),
      200
    )
  })

  it('POST, PUT and filter drivers', async () => {
    expectSame(
      await send({
        method: 'post',
        path: '/api/deliveries/drivers',
        body: { name: ' Fahrer 3 ', phone: '0170 / 123 45', vehicle: 'bike' },
      }),
      201
    )
    expectSame(
      await send({
        method: 'put',
        path: '/api/deliveries/drivers/3',
        body: { active: false, vehicle: 'boat' },
      }),
      200
    )
    expectSame(
      await send({
        method: 'get',
        path: '/api/deliveries/drivers?active=true',
      }),
      200
    )
    expectSame(
      await send({
        method: 'post',
        path: '/api/deliveries/drivers',
        body: { name: '' },
      }),
      400
    )
    expectSame(
      await send({
        method: 'put',
        path: '/api/deliveries/drivers/99',
        body: { name: 'X' },
      }),
      404
    )
  })

  it('a preorder for the Sammelstelle (alias, both sides)', async () => {
    const result = await send({
      method: 'post',
      path: '/api/deliveries/preorders',
      body: {
        date: SATURDAY,
        customer: 'Erika Beispiel',
        phone: '0170 1112223',
        items: [{ productId: 'musterweck', qty: 3 }],
      },
    })
    expect(result.mock.status).toBe(201)
    expect(result.real.status).toBe(201)
  })

  it('POST /tours on a Saturday: Sammelstelle stop with its handover list', async () => {
    latest = await send({
      method: 'post',
      path: '/api/deliveries/tours',
      body: { date: SATURDAY, driverId: 1, name: 'Samstagstour' },
    })
    expectSame(latest, 201)
    tour = (latest.mock.body as TourBody).id
    expect((latest.real.body as TourBody).id).toBe(tour)
    const stop = (latest.mock.body as TourBody).stops[0] as unknown as {
      pickupPointId: string
      preorders: unknown[]
    }
    expect(stop.pickupPointId).toBe(MOERSBACH)
    expect(stop.preorders).toHaveLength(1)
  })

  it('a second tour that day gets no Sammelstelle; errors match', async () => {
    expectSame(
      await send({
        method: 'post',
        path: '/api/deliveries/tours',
        body: { date: SATURDAY, driverId: 2, plannedStart: '07:00' },
      }),
      201
    )
    for (const body of [
      { date: '2027-02-30' },
      { date: SATURDAY, plannedStart: '24:00' },
      { date: SATURDAY, driverId: 42 },
    ]) {
      expectSame(
        await send({ method: 'post', path: '/api/deliveries/tours', body }),
        400
      )
    }
  })

  it('POST stops (manual coordinates): same tour, same arrival estimates', async () => {
    expectSame(
      await send({
        method: 'post',
        path: `/api/deliveries/tours/${tour}/stops`,
        body: {
          customer: 'Kundin Eins',
          street: 'Musterweg 1',
          zip: '66424',
          city: 'Homburg',
          phone: '06841 000',
          items: [{ name: 'Testbrot', qty: '2', unit: 'Stk' }],
          lat: 49.33,
          lon: 7.33,
        },
      }),
      201
    )
    latest = await send({
      method: 'post',
      path: `/api/deliveries/tours/${tour}/stops`,
      body: {
        customer: 'Kunde Zwei',
        street: 'Beispielgasse 7',
        city: 'Homburg',
        timeWindow: 'bis 08:00',
        notes: 'Hintereingang',
        lat: 49.31,
        lon: 7.36,
      },
    })
    expectSame(latest, 201)
    expectSame(
      await send({
        method: 'post',
        path: `/api/deliveries/tours/${tour}/stops`,
        body: { street: 'Ohne Namen 1' },
      }),
      400
    )
  })

  it('PATCH /tours/:id reorders by stop ids and validates', async () => {
    const one = stopIds(latest, 2)
    const two = stopIds(latest, 3)
    const pickup = stopIds(latest, 1)
    expectSame(
      await send({
        method: 'patch',
        path: `/api/deliveries/tours/${tour}`,
        mockBody: { stopOrder: [two.mock, one.mock, pickup.mock] },
        realBody: { stopOrder: [two.real, one.real, pickup.real] },
      }),
      200
    )
    expectSame(
      await send({
        method: 'patch',
        path: `/api/deliveries/tours/${tour}`,
        body: { name: 'Tour Nord', vehicleType: 'van', plannedStart: '06:45' },
      }),
      200
    )
    for (const body of [{ status: 'gone' }, { plannedStart: 'früh' }]) {
      expectSame(
        await send({
          method: 'patch',
          path: `/api/deliveries/tours/${tour}`,
          body,
        }),
        400
      )
    }
  })

  it('POST /optimize without OSRM: same order and estimate', async () => {
    latest = await send({
      method: 'post',
      path: `/api/deliveries/tours/${tour}/optimize`,
      body: { optimize: true },
    })
    expectSame(latest, 200)
    expect((latest.real.body as { isEstimate: boolean }).isEstimate).toBe(true)
  })

  it('ticking stops starts and finishes the tour on both', async () => {
    const at = '2027-01-09T06:40:00.000Z'
    for (const [n, body] of [
      [2, { status: 'done', completedAt: at }],
      [
        3,
        {
          status: 'failed',
          failureReason: 'Nicht angetroffen',
          goodsDisposition: 'taken_back',
          completedAt: at,
        },
      ],
    ] as const) {
      const ids = stopIds(latest, n)
      latest = await send({
        method: 'patch',
        path: '',
        mockPath: `/api/deliveries/tours/${tour}/stops/${ids.mock}`,
        realPath: `/api/deliveries/tours/${tour}/stops/${ids.real}`,
        body,
      })
      expectSame(latest, 200)
    }
    expect((latest.real.body as { status: string }).status).toBe('active')
    const pickup = stopIds(latest, 1)
    latest = await send({
      method: 'patch',
      path: '',
      mockPath: `/api/deliveries/tours/${tour}/stops/${pickup.mock}`,
      realPath: `/api/deliveries/tours/${tour}/stops/${pickup.real}`,
      body: { status: 'done', completedAt: at },
    })
    expectSame(latest, 200)
    expect((latest.real.body as { status: string }).status).toBe('done')
    expectSame(
      await send({
        method: 'patch',
        path: `/api/deliveries/tours/${tour}/stops/999999`,
        body: { status: 'done' },
      }),
      404
    )
    expectSame(
      await send({
        method: 'patch',
        path: '',
        mockPath: `/api/deliveries/tours/${tour}/stops/${pickup.mock}`,
        realPath: `/api/deliveries/tours/${tour}/stops/${pickup.real}`,
        body: { status: 'lost' },
      }),
      400
    )
  })

  it('POST /position: same position; invalid coordinates 400', async () => {
    expectSame(
      await send({
        method: 'post',
        path: `/api/deliveries/tours/${tour}/position`,
        body: { lat: 49.31, lon: 7.35, accuracy: 8, speed: 'fast' },
      }),
      200
    )
    for (const body of [
      { lat: null, lon: 7 },
      { lat: 91, lon: 7 },
      { lat: 0, lon: 0 },
    ]) {
      expectSame(
        await send({
          method: 'post',
          path: `/api/deliveries/tours/${tour}/position`,
          body,
        }),
        400
      )
    }
  })

  it('GET /tours with filters and GET /tours/:id', async () => {
    expectSame(
      await send({
        method: 'get',
        path: `/api/deliveries/tours?date=${SATURDAY}`,
      }),
      200
    )
    expectSame(
      await send({
        method: 'get',
        path: `/api/deliveries/tours?date=${SATURDAY}&driverId=2&status=planned`,
      }),
      200
    )
    expectSame(
      await send({ method: 'get', path: '/api/deliveries/tours?date=heute' }),
      400
    )
    expectSame(
      await send({ method: 'get', path: `/api/deliveries/tours/${tour}` }),
      200
    )
    expectSame(
      await send({ method: 'get', path: '/api/deliveries/tours/404' }),
      404
    )
  })

  it('DELETE a stop, then the tour', async () => {
    const ids = stopIds(latest, 2)
    expectSame(
      await send({
        method: 'delete',
        path: '',
        mockPath: `/api/deliveries/tours/${tour}/stops/${ids.mock}`,
        realPath: `/api/deliveries/tours/${tour}/stops/${ids.real}`,
      }),
      200
    )
    expectSame(
      await send({ method: 'delete', path: `/api/deliveries/tours/${tour}` }),
      200
    )
    expectSame(
      await send({ method: 'get', path: `/api/deliveries/tours/${tour}` }),
      404
    )
  })

  it('PUT /depot: manual coordinates, unknown new address 422', async () => {
    expectSame(
      await send({
        method: 'put',
        path: '/api/deliveries/depot',
        body: { phone: '06841 2229', lat: 49.3016, lon: 7.3696 },
      }),
      200
    )
    expectSame(
      await send({
        method: 'put',
        path: '/api/deliveries/depot',
        body: { lat: 'x', lon: 7 },
      }),
      400
    )
    expectSame(
      await send({
        method: 'put',
        path: '/api/deliveries/depot',
        body: { street: 'Unbekannte Straße 1' },
      }),
      422
    )
  })

  it('POST /geocode: 400 without address, 404 without a hit', async () => {
    expectSame(
      await send({ method: 'post', path: '/api/deliveries/geocode', body: {} }),
      400
    )
    expectSame(
      await send({
        method: 'post',
        path: '/api/deliveries/geocode',
        body: { address: 'Nirgendwo 1, 99999 Irgendwo' },
      }),
      404
    )
  })
})

describe('deliberate differences (B8)', () => {
  let tour = 0
  beforeAll(async () => {
    const result = await send({
      method: 'post',
      path: '/api/deliveries/tours',
      body: { date: '2027-01-15' },
    })
    tour = (result.mock.body as TourBody).id
    expect((result.real.body as TourBody).id).toBe(tour)
  })

  const stop = (extra: Record<string, unknown>) => ({
    customer: 'Kundin',
    street: 'Musterweg 1',
    city: 'Homburg',
    lat: 49.3,
    lon: 7.3,
    ...extra,
  })

  it.each([
    ['a 201-character name', { customer: 'x'.repeat(201) }, 'Text too long'],
    ['a bidi control character', { customer: 'Kundin‮' }, 'Invalid text'],
    [
      'an unknown pickup point',
      { pickupPointId: 'gibt-es-nicht' },
      'Pickup point not found',
    ],
  ])(
    'the mock stores %s, the real API answers 400',
    async (_label, extra, error) => {
      const result = await send({
        method: 'post',
        path: `/api/deliveries/tours/${tour}/stops`,
        body: stop(extra),
      })
      expect(result.mock.status).toBe(201)
      expect(result.real.status).toBe(400)
      expect(result.real.body).toMatchObject({
        success: false,
        error,
        message: expect.any(String),
      })
    }
  )

  it('an invalid completedAt is stored by the mock, 400 on the real API', async () => {
    const added = await send({
      method: 'post',
      path: `/api/deliveries/tours/${tour}/stops`,
      body: stop({}),
    })
    const created = (b: Json) =>
      (b as TourBody).stops.map((s) => s.id).sort((a, b2) => b2 - a)[0]
    const result = await send({
      method: 'patch',
      path: '',
      mockPath: `/api/deliveries/tours/${tour}/stops/${created(
        added.mock.body
      )}`,
      realPath: `/api/deliveries/tours/${tour}/stops/${created(
        added.real.body
      )}`,
      body: { status: 'done', completedAt: 'gestern' },
    })
    expect(result.mock.status).toBe(200)
    expect(result.real.status).toBe(400)
    expect(result.real.body).toMatchObject({ error: 'Invalid completedAt' })
  })

  it('error bodies carry success: false in addition', async () => {
    const result = await send({
      method: 'get',
      path: '/api/deliveries/tours/987654',
    })
    expect(result.mock.body).toEqual({
      error: 'Tour not found',
      message: 'Diese Tour existiert nicht.',
    })
    expect(result.real.body).toEqual({
      success: false,
      ...(result.mock.body as object),
    })
  })
})
