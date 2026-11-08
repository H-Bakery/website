/**
 * Contract (D3, B7, B12): the Mörsbach alias `/api/deliveries/*` of the real
 * API answers like the mock server did. The mock's answers on the same
 * synthetic catalogue are recorded in `recorded/preorders.json` (see
 * recorded.ts); the same request sequence runs against the real API, whose
 * clock is pinned to the recording moment (`RECORDED_AT`) so deadlines and
 * date windows stay comparable. Status, shape and the
 * values the Mörsbach screens show (reference, items, totals, status,
 * deadline, error texts) must match.
 *
 * Known, deliberate difference: `hasPickupStop` in the summary. The mock
 * looks for a tour stop (its seed tour is on the *next* Saturday); the real
 * API has no tours (D11) and answers "the point is served on that day".
 */
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'
import { compare, loadRecordedMock, ParityRequest } from './recorded'

let real: TestApp
let realApp: Application
let mock: Application
let auth: Record<string, string>
const SUITE = 'preorders'
/** When the mock's answers were recorded. */
const RECORDED_AT = new Date('2026-11-06T13:45:00+01:00')

// A Saturday far enough ahead that the Friday-12:00 deadline has not passed.
const SATURDAY = '2027-01-09'
const FRIDAY = '2027-01-08'

beforeAll(async () => {
  const productsDir = makeProductsDir()
  mock = loadRecordedMock(SUITE)
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
  })
  auth = bearer(await sessionFor(real.app, 'test.inhaber', 'inhaber'))
})

afterAll(async () => {
  await real.close()
  removeTempDirs()
})

const apps = () => ({ mock, real: realApp })
const send = (req: Omit<ParityRequest, 'headers'>) =>
  compare({ ...req, headers: auth }, apps())

type Legacy = Record<string, unknown> & {
  id: number
  items: Array<Record<string, unknown>>
}

/** The fields the Mörsbach screens show. */
function visible(p: Legacy) {
  return {
    reference: p['reference'],
    pickupPointId: p['pickupPointId'],
    date: p['date'],
    customer: p['customer'],
    phone: p['phone'],
    items: p.items.map((i) => ({
      productId: i['productId'],
      name: i['name'],
      qty: i['qty'],
      unit: i['unit'],
      unitPrice: i['unitPrice'],
      lineTotal: i['lineTotal'],
    })),
    total: p['total'],
    note: p['note'],
    status: p['status'],
    handedOverAt: p['handedOverAt'] === null ? null : 'set',
    deadline: p['deadline'],
    afterDeadline: p['afterDeadline'],
  }
}

const ORDER = {
  date: SATURDAY,
  customer: 'Erika Beispiel',
  phone: '0170 1112223',
  note: 'Bitte klingeln',
  items: [
    { productId: 'musterweck', qty: 3 },
    { productId: 'kornbrot-500g', qty: 1, unitPrice: 0.01 },
  ],
}

describe('Mörsbach alias contract (recorded mock vs. real API)', () => {
  it('GET /api/deliveries/pickup-points: same point', async () => {
    const result = await send({
      method: 'get',
      path: '/api/deliveries/pickup-points',
    })
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
  })

  it('PUT /api/deliveries/pickup-points/:id (window): same point', async () => {
    const result = await send({
      method: 'put',
      path: '/api/deliveries/pickup-points/kindergarten-moersbach',
      body: { window: '09:00-09:45' },
    })
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect(result.real.body).toEqual(result.mock.body)
    const back = await send({
      method: 'put',
      path: '/api/deliveries/pickup-points/kindergarten-moersbach',
      body: { window: '09:00-09:30' },
    })
    expect(back.real.body).toEqual(back.mock.body)
  })

  let id: number

  it('POST /api/deliveries/preorders: same preorder', async () => {
    const result = await send({
      method: 'post',
      path: '/api/deliveries/preorders',
      body: ORDER,
    })
    expect(result.mock.status).toBe(201)
    expect(result.differences).toEqual([])
    const m = result.mock.body as Legacy
    const r = result.real.body as Legacy
    expect(visible(r)).toEqual(visible(m))
    expect(m.reference).toBe('MO-2027-01-09-01')
    expect(m.total).toBe(3.85)
    expect(r.id).toBe(m.id)
    id = m.id
  })

  it.each([
    ['list', `/api/deliveries/preorders?date=${SATURDAY}`],
    [
      'list by point',
      '/api/deliveries/preorders?pickupPointId=kindergarten-moersbach',
    ],
    ['list by status', '/api/deliveries/preorders?status=open'],
    ['list unknown point', '/api/deliveries/preorders?pickupPointId=nirgendwo'],
  ])('GET %s: same preorders', async (_label, url) => {
    const result = await send({ method: 'get', path: url })
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect((result.real.body as Legacy[]).map(visible)).toEqual(
      (result.mock.body as Legacy[]).map(visible)
    )
  })

  it('GET /api/deliveries/preorders/:id: same preorder', async () => {
    const result = await send({
      method: 'get',
      path: `/api/deliveries/preorders/${id}`,
    })
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    expect(visible(result.real.body as Legacy)).toEqual(
      visible(result.mock.body as Legacy)
    )
  })

  it('GET /api/deliveries/preorders/summary: same Backliste', async () => {
    const result = await send({
      method: 'get',
      path: `/api/deliveries/preorders/summary?date=${SATURDAY}`,
    })
    expect(result.mock.status).toBe(200)
    expect(result.differences).toEqual([])
    const strip = (b: unknown) => ({
      ...(b as Record<string, unknown>),
      hasPickupStop: 'see header',
    })
    expect(strip(result.real.body)).toEqual(strip(result.mock.body))
    expect((result.real.body as { hasPickupStop: boolean }).hasPickupStop).toBe(
      true
    )
  })

  it('PATCH items and status walk the same way', async () => {
    const steps: Array<Record<string, unknown>> = [
      {
        items: [
          { productId: 'musterweck', qty: 5 },
          { productId: 'mustersemmel', qty: 2 },
        ],
      },
      { status: 'not_collected' },
      { status: 'open' },
      { status: 'handed_over' },
      { customer: 'Erika B.', phone: '' },
    ]
    for (const body of steps) {
      const result = await send({
        method: 'patch',
        path: `/api/deliveries/preorders/${id}`,
        body,
      })
      expect(result.mock.status).toBe(200)
      expect(result.differences).toEqual([])
      expect(visible(result.real.body as Legacy)).toEqual(
        visible(result.mock.body as Legacy)
      )
    }
  })

  it('DELETE of a handed-over preorder: same 409', async () => {
    const result = await send({
      method: 'delete',
      path: `/api/deliveries/preorders/${id}`,
    })
    expect(result.mock.status).toBe(409)
    expect(result.differences).toEqual([])
    const pick = (b: unknown) => {
      const { error, message } = b as { error: string; message: string }
      return { error, message }
    }
    expect(pick(result.real.body)).toEqual(pick(result.mock.body))
  })

  it('cancel and a late handover: same answers', async () => {
    const created = await send({
      method: 'post',
      path: '/api/deliveries/preorders',
      body: { ...ORDER, customer: 'Max Muster' },
    })
    const other = (created.mock.body as Legacy).id
    expect((created.real.body as Legacy).id).toBe(other)
    expect((created.real.body as Legacy)['reference']).toBe('MO-2027-01-09-02')

    const cancel = await send({
      method: 'delete',
      path: `/api/deliveries/preorders/${other}`,
    })
    expect(cancel.mock.status).toBe(200)
    expect(cancel.differences).toEqual([])
    expect(visible(cancel.real.body as Legacy)).toEqual(
      visible(cancel.mock.body as Legacy)
    )
    const late = await send({
      method: 'patch',
      path: `/api/deliveries/preorders/${other}`,
      body: { status: 'handed_over' },
    })
    expect(late.mock.status).toBe(409)
    expect(late.differences).toEqual([])
    expect((late.real.body as { message: string }).message).toBe(
      (late.mock.body as { message: string }).message
    )
    // a cancelled reference is not given out again
    const third = await send({
      method: 'post',
      path: '/api/deliveries/preorders',
      body: { ...ORDER, customer: 'Paula Probe' },
    })
    expect((third.real.body as Legacy)['reference']).toBe('MO-2027-01-09-03')
    expect((third.mock.body as Legacy)['reference']).toBe('MO-2027-01-09-03')

    const summary = await send({
      method: 'get',
      path: `/api/deliveries/preorders/summary?date=${SATURDAY}`,
    })
    const strip = (b: unknown) => ({
      ...(b as Record<string, unknown>),
      hasPickupStop: null,
    })
    expect(strip(summary.real.body)).toEqual(strip(summary.mock.body))
  })

  it.each<[string, Omit<ParityRequest, 'headers'>, number]>([
    [
      'wrong weekday',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, date: FRIDAY },
      },
      400,
    ],
    [
      'no customer',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, customer: ' ' },
      },
      400,
    ],
    [
      'no items',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, items: [] },
      },
      400,
    ],
    [
      'unknown product',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, items: [{ productId: 'gibt-es-nicht', qty: 1 }] },
      },
      400,
    ],
    [
      'bad status',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, status: 'weg' },
      },
      400,
    ],
    [
      'unknown point',
      {
        method: 'post',
        path: '/api/deliveries/preorders',
        body: { ...ORDER, pickupPointId: 'nirgendwo' },
      },
      400,
    ],
    [
      'bad list date',
      { method: 'get', path: '/api/deliveries/preorders?date=2027-02-30' },
      400,
    ],
    [
      'bad list status',
      { method: 'get', path: '/api/deliveries/preorders?status=weg' },
      400,
    ],
    [
      'summary without date',
      { method: 'get', path: '/api/deliveries/preorders/summary' },
      400,
    ],
    [
      'unknown id',
      { method: 'get', path: '/api/deliveries/preorders/999' },
      404,
    ],
    [
      'patch unknown id',
      {
        method: 'patch',
        path: '/api/deliveries/preorders/999',
        body: { status: 'open' },
      },
      404,
    ],
    [
      'delete unknown id',
      { method: 'delete', path: '/api/deliveries/preorders/999' },
      404,
    ],
    [
      'unknown pickup point',
      {
        method: 'put',
        path: '/api/deliveries/pickup-points/nirgendwo',
        body: {},
      },
      404,
    ],
    [
      'bad window',
      {
        method: 'put',
        path: '/api/deliveries/pickup-points/kindergarten-moersbach',
        body: { window: '9 Uhr' },
      },
      400,
    ],
    [
      'notes too long (W4)',
      {
        method: 'put',
        path: '/api/deliveries/pickup-points/kindergarten-moersbach',
        body: { notes: 'x'.repeat(2001) },
      },
      400,
    ],
  ])('%s: same status and German message', async (_label, req, status) => {
    const result = await send(req)
    expect(result.mock.status).toBe(status)
    expect(result.differences).toEqual([])
    const message = (b: unknown) => (b as { message: string }).message
    expect(message(result.real.body)).toBe(message(result.mock.body))
  })
})
