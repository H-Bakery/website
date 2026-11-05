/**
 * B7 Vorbestellungen on the real API: `/api/preorders`, the Mörsbach alias
 * `/api/deliveries/*`, shop `POST /api/orders`, roles and audit.
 * Synthetic catalogue (`tools/e2e/hq-products`), synthetic customers.
 */
import request from 'supertest'

import { AuditLog, Preorder } from '../../src/models'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'

let api: TestApp
const tokens: Record<string, Record<string, string>> = {}

// Thursday 2026-11-12 10:00 Berlin; Tue 17.11., Sat 21.11.
const NOW = new Date('2026-11-12T09:00:00.000Z')
const TUESDAY = '2026-11-17'
const SATURDAY = '2026-11-21'
const MOERSBACH = 'kindergarten-moersbach'

const variantsForProduct = (id: string) =>
  id === 'mustersemmel'
    ? { itemId: 'semmel-gefuellt', variants: ['nuss', 'schoko'] }
    : id === 'musterweck'
    ? { itemId: 'weck', variants: [] }
    : null

beforeAll(async () => {
  const productsDir = makeProductsDir()
  api = await createTestApp({
    app: {
      hqProducts: { productsDir, writeDir: null },
      preorders: { productsDir, variantsForProduct, now: () => NOW },
    },
  })
  for (const role of ['inhaber', 'verkauf', 'backstube', 'fahrer'] as const) {
    tokens[role] = bearer(await sessionFor(api.app, `test.${role}`, role))
  }
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

const laden = (extra: Record<string, unknown> = {}) => ({
  channel: 'telefon',
  customerName: 'Erika Beispiel',
  customerPhone: '0170 000 0001',
  pickupDate: TUESDAY,
  pickupTime: '08:30',
  items: [{ productId: 'kornbrot-500g', quantity: 2 }],
  ...extra,
})

async function create(body: Record<string, unknown>, role = 'verkauf') {
  return request(api.app).post('/api/preorders').set(tokens[role]).send(body)
}

describe('session and roles', () => {
  it.each([
    ['get', '/api/preorders'],
    ['get', '/api/preorders/sums?date=2026-11-17'],
    ['post', '/api/preorders'],
    ['get', '/api/deliveries/preorders'],
    ['get', '/api/deliveries/pickup-points'],
    ['post', '/api/orders'],
  ] as const)('%s %s without session is 401', async (method, path) => {
    const res = await request(api.app)[method](path)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
    expect(typeof res.body.message).toBe('string')
  })

  it('backstube reads only the sums (no customer data)', async () => {
    expect(
      (await request(api.app).get('/api/preorders').set(tokens['backstube']))
        .status
    ).toBe(403)
    expect(
      (
        await request(api.app)
          .get(`/api/preorders/day?date=${TUESDAY}`)
          .set(tokens['backstube'])
      ).status
    ).toBe(403)
    expect(
      (
        await request(api.app)
          .get(`/api/preorders/sums?date=${TUESDAY}`)
          .set(tokens['backstube'])
      ).status
    ).toBe(200)
    expect((await create(laden(), 'backstube')).status).toBe(403)
  })

  it('fahrer reads and hands over, nothing else', async () => {
    const created = (await create(laden())).body.data
    expect(
      (await request(api.app).get('/api/preorders').set(tokens['fahrer']))
        .status
    ).toBe(200)
    expect((await create(laden(), 'fahrer')).status).toBe(403)
    expect(
      (
        await request(api.app)
          .patch(`/api/preorders/${created.id}`)
          .set(tokens['fahrer'])
          .send({ note: 'x' })
      ).status
    ).toBe(403)
    expect(
      (
        await request(api.app)
          .post(`/api/preorders/${created.id}/cancel`)
          .set(tokens['fahrer'])
      ).status
    ).toBe(403)
    const cancel = await request(api.app)
      .post(`/api/preorders/${created.id}/status`)
      .set(tokens['fahrer'])
      .send({ status: 'storniert' })
    expect(cancel.status).toBe(403)
    expect(cancel.body.error).toBe('forbidden')
    const handover = await request(api.app)
      .post(`/api/preorders/${created.id}/status`)
      .set(tokens['fahrer'])
      .send({ status: 'abgeholt', paid: true })
    expect(handover.status).toBe(200)
    expect(handover.body.data).toMatchObject({ status: 'abgeholt', paid: true })
  })
})

describe('pickup points', () => {
  it('has the Mörsbach Sammelstelle from the migration', async () => {
    const res = await request(api.app)
      .get('/api/preorders/pickup-points')
      .set(tokens['verkauf'])
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: MOERSBACH,
        name: 'Kindergarten Mörsbach',
        street: 'Höhenstraße 24',
        zip: '66482',
        weekday: 6,
        window: '09:00-09:30',
        orderDeadline: { weekday: 5, time: '12:00' },
        active: true,
      }),
    ])
  })
})

describe('/api/preorders CRUD', () => {
  it('creates a Laden preorder with code, hq snapshot, creator and audit', async () => {
    const res = await create(laden({ note: 'bitte geschnitten', paid: true }))
    expect(res.status).toBe(201)
    const p = res.body.data
    expect(p).toMatchObject({
      code: expect.stringMatching(/^LA-2026-11-17-\d{2}$/),
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      customerPhone: '01700000001',
      pickupDate: TUESDAY,
      pickupTime: '08:30',
      pickupPointId: null,
      pickupPoint: null,
      status: 'offen',
      notCollected: false,
      paid: true,
      note: 'bitte geschnitten',
      total: 5,
      deadline: null,
      afterDeadline: false,
      items: [
        {
          productId: 'kornbrot-500g',
          name: 'Kornbrot 500g',
          variant: '',
          quantity: 2,
          unit: 'Stück',
          unitPrice: 2.5,
          lineTotal: 5,
        },
      ],
    })
    expect(p.createdBy).toEqual(expect.any(Number))

    const rows = await AuditLog.findAll({
      where: { entity: 'preorder', entityId: String(p.id) },
    })
    expect(rows.map((r) => r.action)).toEqual(['create'])
    const data = JSON.stringify(rows[0].data)
    expect(data).toContain('kornbrot-500g')
    expect(data).not.toContain('Erika')
    expect(data).not.toContain('0170')
  })

  it('numbers codes per day and place, cancelled ones included', async () => {
    const a = (await create(laden({ pickupDate: '2026-11-18' }))).body.data
    await request(api.app)
      .post(`/api/preorders/${a.id}/cancel`)
      .set(tokens['verkauf'])
      .expect(200)
    const b = (await create(laden({ pickupDate: '2026-11-18' }))).body.data
    expect(a.code).toBe('LA-2026-11-18-01')
    expect(b.code).toBe('LA-2026-11-18-02')
    const point = (
      await create(
        laden({
          channel: 'sammelstelle',
          pickupDate: SATURDAY,
          pickupTime: null,
          pickupPointId: MOERSBACH,
        })
      )
    ).body.data
    expect(point.code).toMatch(/^MO-2026-11-21-\d{2}$/)
    expect(point.pickupPoint).toEqual({
      id: MOERSBACH,
      name: 'Kindergarten Mörsbach',
      window: '09:00-09:30',
    })
    expect(point.deadline).toEqual(expect.any(String))
    expect(point.afterDeadline).toBe(false)
  })

  it('validates with message + error', async () => {
    const res = await create(laden({ pickupDate: '2026-11-31' }))
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      success: false,
      error: 'invalid_date',
      message: 'Das Abholdatum muss im Format JJJJ-MM-TT angegeben werden.',
    })
    const day = await create(
      laden({ pickupDate: TUESDAY, pickupTime: null, pickupPointId: MOERSBACH })
    )
    expect(day.body.error).toBe('invalid_delivery_day')
    const unknown = await create(
      laden({ items: [{ productId: 'gibt-es-nicht', quantity: 1 }] })
    )
    expect(unknown.body).toMatchObject({ error: 'unknown_product' })
  })

  it('validates variants against the Backzettel hook', async () => {
    const missing = await create(
      laden({ items: [{ productId: 'mustersemmel', quantity: 1 }] })
    )
    expect(missing.status).toBe(400)
    expect(missing.body.error).toBe('variant_required')
    const wrong = await create(
      laden({
        items: [{ productId: 'musterweck', quantity: 1, variant: 'nuss' }],
      })
    )
    expect(wrong.body.error).toBe('invalid_variant')
    const ok = await create(
      laden({
        pickupDate: '2026-11-19',
        items: [
          { productId: 'mustersemmel', quantity: 3, variant: 'nuss' },
          { productId: 'mustersemmel', quantity: 1, variant: 'schoko' },
          {
            productId: 'kornbrot-500g',
            quantity: 1,
            variant: 'egal-ohne-config',
          },
        ],
      })
    )
    expect(ok.status).toBe(201)
    expect(
      ok.body.data.items.map((i: { variant: string }) => i.variant)
    ).toEqual(['nuss', 'schoko', 'egal-ohne-config'])
  })

  it('GET /:id answers 404 for unknown and malformed ids', async () => {
    for (const id of ['99999', 'abc', '1.0', '-1']) {
      const res = await request(api.app)
        .get(`/api/preorders/${id}`)
        .set(tokens['verkauf'])
      expect(res.status).toBe(404)
      expect(res.body).toMatchObject({ error: 'not_found' })
    }
  })

  it('PATCH edits fields and items, renews the code on a new day, audits the change', async () => {
    const p = (await create(laden({ pickupDate: '2026-11-20' }))).body.data
    const res = await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({
        pickupDate: '2026-11-25',
        items: [
          { productId: 'kornbrot-500g', quantity: 1 },
          { productId: 'musterweck', quantity: 4 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      code: 'LA-2026-11-25-01',
      pickupDate: '2026-11-25',
      total: 4.3,
      customerName: 'Erika Beispiel',
    })
    const audit = await AuditLog.findAll({
      where: { entity: 'preorder', entityId: String(p.id), action: 'update' },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].data).toMatchObject({
      changed: ['pickupDate', 'items'],
      previousCode: p.code,
    })
    // unchanged PATCH writes nothing
    await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ note: null })
      .expect(200)
    expect(
      await AuditLog.count({
        where: { entity: 'preorder', entityId: String(p.id), action: 'update' },
      })
    ).toBe(1)
  })

  it('walks offen → bereit → abgeholt and locks abgeholt ↔ storniert', async () => {
    const p = (await create(laden())).body.data
    const status = (body: Record<string, unknown>) =>
      request(api.app)
        .post(`/api/preorders/${p.id}/status`)
        .set(tokens['verkauf'])
        .send(body)

    expect((await status({ status: 'bereit' })).body.data.status).toBe('bereit')
    const nc = (await status({ notCollected: true })).body.data
    expect(nc).toMatchObject({ status: 'bereit', notCollected: true })
    const picked = (await status({ status: 'abgeholt', paid: true })).body.data
    expect(picked).toMatchObject({
      status: 'abgeholt',
      notCollected: false,
      paid: true,
      pickedUpAt: NOW.toISOString(),
    })

    const cancel = await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
    expect(cancel.status).toBe(409)
    expect(cancel.body).toMatchObject({ error: 'already_picked_up' })

    expect((await status({ status: 'offen' })).body.data.pickedUpAt).toBeNull()
    await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
      .expect(200)
    const revive = await status({ status: 'abgeholt' })
    expect(revive.status).toBe(409)
    expect(revive.body.error).toBe('cancelled')
    const invalid = await status({ status: 'weg' })
    expect(invalid.status).toBe(400)

    // never deleted
    expect(await Preorder.findByPk(p.id)).not.toBeNull()
    const actions = (
      await AuditLog.findAll({
        where: { entity: 'preorder', entityId: String(p.id) },
        order: [['id', 'ASC']],
      })
    ).map((r) => r.action)
    expect(actions).toEqual([
      'create',
      'status',
      'status',
      'status',
      'status',
      'cancel',
    ])
  })
})

describe('list, sums, day', () => {
  let saturdayIds: number[] = []

  beforeAll(async () => {
    const day = '2026-11-28'
    const mk = (extra: Record<string, unknown>) =>
      create({
        channel: 'sammelstelle',
        customerName: 'Max Muster',
        customerPhone: '06841 555 123',
        pickupDate: day,
        pickupPointId: MOERSBACH,
        items: [{ productId: 'mustersemmel', quantity: 2, variant: 'nuss' }],
        ...extra,
      })
    const a = (await mk({})).body.data
    const b = (
      await mk({
        channel: 'whatsapp',
        customerName: 'Erika Beispiel',
        customerPhone: null,
        items: [
          { productId: 'mustersemmel', quantity: 1, variant: 'nuss' },
          { productId: 'mustersemmel', quantity: 1, variant: 'schoko' },
          { productId: 'kornbrot-500g', quantity: 1 },
        ],
      })
    ).body.data
    const c = (
      await create({
        channel: 'laden',
        customerName: 'Paula Probe',
        pickupDate: day,
        pickupTime: '10:00',
        items: [{ productId: 'mustersemmel', quantity: 5, variant: 'nuss' }],
      })
    ).body.data
    await request(api.app)
      .post(`/api/preorders/${c.id}/cancel`)
      .set(tokens['verkauf'])
      .expect(200)
    saturdayIds = [a.id, b.id, c.id]
  })

  it('filters by date, status, channel, place and search text', async () => {
    const get = async (query: string) =>
      (
        await request(api.app)
          .get(`/api/preorders?${query}`)
          .set(tokens['verkauf'])
      ).body
    expect((await get('date=2026-11-28')).count).toBe(3)
    expect(
      (await get('date=2026-11-28&status=offen')).data.map(
        (p: { id: number }) => p.id
      )
    ).toEqual(saturdayIds.slice(0, 2))
    expect((await get('date=2026-11-28&status=offen,storniert')).count).toBe(3)
    expect((await get('date=2026-11-28&channel=whatsapp')).count).toBe(1)
    expect((await get('date=2026-11-28&pickupPointId=laden')).count).toBe(1)
    expect(
      (await get(`date=2026-11-28&pickupPointId=${MOERSBACH}`)).count
    ).toBe(2)
    expect((await get('from=2026-11-27&to=2026-11-29')).count).toBe(3)
    expect((await get('q=muster&date=2026-11-28')).count).toBe(1)
    expect((await get('q=555123')).count).toBe(1)
    expect((await get('q=MO-2026-11-28')).count).toBe(2)
    expect((await get('q=%25')).count).toBeGreaterThan(3) // wildcard stripped
  })

  it.each([
    ['date=2026-13-01', 'invalid_date'],
    ['from=2026-11-30&to=2026-11-01', 'invalid_range'],
    ['status=weg', 'invalid_status'],
    ['channel=fax', 'invalid_channel'],
    ['status=offen&status=bereit', 'invalid_status'],
  ])('rejects ?%s with %s', async (query, error) => {
    const res = await request(api.app)
      .get(`/api/preorders?${query}`)
      .set(tokens['verkauf'])
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(error)
  })

  it('sums per product and variant without cancelled preorders', async () => {
    const res = await request(api.app)
      .get('/api/preorders/sums?date=2026-11-28')
      .set(tokens['backstube'])
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      date: '2026-11-28',
      pickupPointId: null,
      preorderCount: 2,
      items: [
        expect.objectContaining({
          productId: 'kornbrot-500g',
          variant: '',
          quantity: 1,
          preorders: 1,
        }),
        expect.objectContaining({
          productId: 'mustersemmel',
          variant: 'nuss',
          quantity: 3,
          preorders: 2,
        }),
        expect.objectContaining({
          productId: 'mustersemmel',
          variant: 'schoko',
          quantity: 1,
          preorders: 1,
        }),
      ],
    })
    expect(
      (
        await request(api.app)
          .get('/api/preorders/sums')
          .set(tokens['backstube'])
      ).body.error
    ).toBe('invalid_date')
    const laden = await request(api.app)
      .get('/api/preorders/sums?date=2026-11-28&pickupPointId=laden')
      .set(tokens['backstube'])
    expect(laden.body.data.preorderCount).toBe(0)
  })

  it('gives the day overview', async () => {
    const res = await request(api.app)
      .get('/api/preorders/day?date=2026-11-28')
      .set(tokens['verkauf'])
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data.summary).toMatchObject({
      count: 2,
      byStatus: { offen: 2, bereit: 0, abgeholt: 0, storniert: 1 },
      byChannel: { sammelstelle: 1, whatsapp: 1 },
    })
    expect(data.sums).toHaveLength(3)
    expect(data.preorders).toHaveLength(3)
    expect(data.pickupPoints).toEqual([
      expect.objectContaining({
        id: MOERSBACH,
        preorderCount: 2,
        deadline: expect.any(String),
      }),
    ])
  })
})

describe('/api/deliveries alias (Mörsbach mock contract)', () => {
  const body = {
    date: SATURDAY,
    customer: 'Erika Beispiel',
    phone: '0170 1112223',
    items: [{ productId: 'musterweck', qty: 3 }],
  }

  it('creates in the mock shape and stores channel sammelstelle', async () => {
    const res = await request(api.app)
      .post('/api/deliveries/preorders')
      .set(tokens['verkauf'])
      .send(body)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      reference: expect.stringMatching(/^MO-2026-11-21-\d{2}$/),
      pickupPointId: MOERSBACH,
      date: SATURDAY,
      customer: 'Erika Beispiel',
      phone: '01701112223',
      items: [
        {
          productId: 'musterweck',
          name: 'Musterweck',
          qty: 3,
          unit: 'Stück',
          unitPrice: 0.45,
          lineTotal: 1.35,
        },
      ],
      total: 1.35,
      status: 'open',
      handedOverAt: null,
      afterDeadline: false,
    })
    expect(res.body.success).toBeUndefined()
    const row = await Preorder.findByPk(res.body.id)
    expect(row?.channel).toBe('sammelstelle')
  })

  it('round-trips not_collected and keeps bereit on open', async () => {
    const p = (
      await request(api.app)
        .post('/api/deliveries/preorders')
        .set(tokens['verkauf'])
        .send(body)
    ).body
    const patch = (b: Record<string, unknown>, role = 'verkauf') =>
      request(api.app)
        .patch(`/api/deliveries/preorders/${p.id}`)
        .set(tokens[role])
        .send(b)
    expect(
      (await patch({ status: 'not_collected' }, 'fahrer')).body.status
    ).toBe('not_collected')
    expect((await Preorder.findByPk(p.id))?.status).toBe('bereit')
    expect((await patch({ status: 'open' })).body.status).toBe('open')
    expect((await Preorder.findByPk(p.id))?.status).toBe('bereit')
    const handed = (await patch({ status: 'handed_over' }, 'fahrer')).body
    expect(handed).toMatchObject({
      status: 'handed_over',
      handedOverAt: NOW.toISOString(),
    })

    const cancel = await request(api.app)
      .delete(`/api/deliveries/preorders/${p.id}`)
      .set(tokens['verkauf'])
    expect(cancel.status).toBe(409)
    expect(cancel.body).toMatchObject({
      error: 'Preorder already handed over',
      message:
        'Diese Vorbestellung wurde bereits übergeben und kann nicht storniert werden — bitte zuerst auf „Offen" zurücksetzen.',
    })
    // fahrer may only hand over
    expect((await patch({ note: 'x' }, 'fahrer')).status).toBe(403)
    expect((await patch({ status: 'open' }, 'fahrer')).status).toBe(403)
    expect((await patch({ status: 'fertig' })).status).toBe(400)
  })

  it('DELETE cancels (never deletes) and cancelled cannot be handed over', async () => {
    const p = (
      await request(api.app)
        .post('/api/deliveries/preorders')
        .set(tokens['verkauf'])
        .send(body)
    ).body
    const res = await request(api.app)
      .delete(`/api/deliveries/preorders/${p.id}`)
      .set(tokens['verkauf'])
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    const revive = await request(api.app)
      .patch(`/api/deliveries/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ status: 'handed_over' })
    expect(revive.status).toBe(409)
    expect(revive.body.error).toBe('Preorder cancelled')
    expect(await Preorder.findByPk(p.id)).not.toBeNull()
  })

  it('lists only pickup-point preorders and hides Laden ones', async () => {
    const ladenOrder = (await create(laden({ pickupDate: SATURDAY }))).body.data
    const list = await request(api.app)
      .get(`/api/deliveries/preorders?date=${SATURDAY}`)
      .set(tokens['verkauf'])
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body)).toBe(true)
    expect(list.body.length).toBeGreaterThan(0)
    expect(
      list.body.every(
        (p: { pickupPointId: string }) => p.pickupPointId === MOERSBACH
      )
    ).toBe(true)
    const hidden = await request(api.app)
      .get(`/api/deliveries/preorders/${ladenOrder.id}`)
      .set(tokens['verkauf'])
    expect(hidden.status).toBe(404)
    expect(hidden.body).toMatchObject({
      error: 'Preorder not found',
      message: 'Diese Vorbestellung existiert nicht.',
    })
    const cancelled = await request(api.app)
      .get(`/api/deliveries/preorders?date=${SATURDAY}&status=cancelled`)
      .set(tokens['verkauf'])
    expect(
      cancelled.body.every((p: { status: string }) => p.status === 'cancelled')
    ).toBe(true)
    expect(
      (
        await request(api.app)
          .get('/api/deliveries/preorders?status=weg')
          .set(tokens['verkauf'])
      ).status
    ).toBe(400)
  })

  it('summarises the day like the mock', async () => {
    const res = await request(api.app)
      .get(`/api/deliveries/preorders/summary?date=${SATURDAY}`)
      .set(tokens['verkauf'])
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      date: SATURDAY,
      pickupPointId: null,
      deadline: expect.any(String),
      hasPickupStop: true,
      count: expect.any(Number),
      cancelled: expect.any(Number),
      byProduct: expect.any(Array),
    })
    const friday = await request(api.app)
      .get('/api/deliveries/preorders/summary?date=2026-11-20')
      .set(tokens['verkauf'])
    expect(friday.body.hasPickupStop).toBe(false)
    const noDate = await request(api.app)
      .get('/api/deliveries/preorders/summary')
      .set(tokens['verkauf'])
    expect(noDate.status).toBe(400)
    expect(noDate.body.error).toBe('Invalid date')
  })

  it('refuses old-form edits that would drop variants', async () => {
    const p = (
      await create({
        channel: 'telefon',
        customerName: 'Erika Beispiel',
        pickupDate: SATURDAY,
        pickupPointId: MOERSBACH,
        items: [{ productId: 'mustersemmel', quantity: 2, variant: 'schoko' }],
      })
    ).body.data
    const legacy = (
      await request(api.app)
        .get(`/api/deliveries/preorders/${p.id}`)
        .set(tokens['verkauf'])
    ).body
    expect(legacy.items[0]).toMatchObject({
      name: 'Mustersemmel (schoko)',
      variant: 'schoko',
    })
    const res = await request(api.app)
      .patch(`/api/deliveries/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ items: [{ productId: 'mustersemmel', qty: 3 }] })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('has_variants')
    // a status change from the old list still works
    const status = await request(api.app)
      .patch(`/api/deliveries/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ status: 'handed_over' })
    expect(status.body.status).toBe('handed_over')
  })

  it('pickup points: read for staff, edit inhaber only, no geocoding', async () => {
    const list = await request(api.app)
      .get('/api/deliveries/pickup-points')
      .set(tokens['fahrer'])
    expect(list.status).toBe(200)
    expect(list.body[0]).toMatchObject({ id: MOERSBACH, lat: 49.302619 })
    expect(
      (
        await request(api.app)
          .put(`/api/deliveries/pickup-points/${MOERSBACH}`)
          .set(tokens['verkauf'])
          .send({ window: '09:00-10:00' })
      ).status
    ).toBe(403)
    const res = await request(api.app)
      .put(`/api/deliveries/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ window: '09:00-10:00' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ window: '09:00-10:00', lat: 49.302619 })
    const bad = await request(api.app)
      .put(`/api/deliveries/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ window: '9 Uhr' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('Invalid window')
    const missing = await request(api.app)
      .put('/api/deliveries/pickup-points/nirgendwo')
      .set(tokens['inhaber'])
      .send({})
    expect(missing.status).toBe(404)
    const moved = await request(api.app)
      .put(`/api/deliveries/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ street: 'Teststraße 1', window: '09:00-09:30' })
    expect(moved.body).toMatchObject({ lat: null, lon: null })
    expect(
      await AuditLog.count({
        where: { entity: 'pickup_point', action: 'update' },
      })
    ).toBe(2)
  })
})

describe('shop POST /api/orders', () => {
  const order = {
    customerName: 'Erika Beispiel',
    phone: '0170 1234567',
    email: 'erika@example.invalid',
    pickupDate: TUESDAY,
    pickupTime: '09:15',
    notes: 'Bitte einpacken',
    items: [{ productId: 'kornbrot-1000g', quantity: 1, price: 0.01 }],
  }

  it('creates a preorder with channel shop and answers in the mock shape', async () => {
    const res = await request(api.app)
      .post('/api/orders')
      .set(tokens['verkauf'])
      .send(order)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      success: true,
      data: {
        customerName: 'Erika Beispiel',
        phone: '01701234567',
        pickupDate: TUESDAY,
        pickupTime: '09:15',
        items: [
          {
            productId: 'kornbrot-1000g',
            name: 'Kornbrot 1000g',
            quantity: 1,
            price: 4.4,
          },
        ],
        total: 4.4,
        notes: 'Bitte einpacken',
        id: expect.stringMatching(/^LA-2026-11-17-\d{2}$/),
        orderNumber: expect.any(Number),
        status: 'pending',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    })
    const row = await Preorder.findByPk(res.body.data.orderNumber)
    expect(row?.channel).toBe('shop')
  })

  it('rejects like the mock: 400 invalid_order with field and German message', async () => {
    const res = await request(api.app)
      .post('/api/orders')
      .set(tokens['verkauf'])
      .send({ ...order, pickupDate: '2026-11-01' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      success: false,
      error: 'invalid_order',
      field: 'pickupDate',
      message: 'Das Abholdatum darf nicht in der Vergangenheit liegen.',
    })
  })

  it('is not open to the driver or the bakery', async () => {
    for (const role of ['fahrer', 'backstube']) {
      expect(
        (
          await request(api.app)
            .post('/api/orders')
            .set(tokens[role])
            .send(order)
        ).status
      ).toBe(403)
    }
  })
})
