/**
 * B7 Vorbestellungen on the real API: `/api/preorders`, the Mörsbach alias
 * `/api/deliveries/*`, shop `POST /api/orders`, roles and audit.
 * Synthetic catalogue (`tools/e2e/hq-products`), synthetic customers.
 */
import request from 'supertest'

import { AuditLog, Preorder } from '../../src/models'
import { PreordersService } from '../../src/services/preorders.service'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'

let api: TestApp
const tokens: Record<string, Record<string, string>> = {}

// Thursday 2026-11-12 10:00 Berlin; Tue 17.11., Sat 21.11.
const NOW = new Date('2026-11-12T09:00:00.000Z')
/** The service clock; a test that needs "on the pickup day" moves it back after. */
let clock = NOW
const TUESDAY = '2026-11-17'
const SATURDAY = '2026-11-21'
const MOERSBACH = 'kindergarten-moersbach'

const variantsForProduct = (id: string) =>
  id === 'mustersemmel'
    ? { itemId: 'semmel-gefuellt', variants: ['nuss', 'schoko'] }
    : id === 'musterweck'
    ? { itemId: 'weck', variants: [] }
    : null

const variantsMap = () => ({ mustersemmel: ['nuss', 'schoko'] })

beforeAll(async () => {
  const productsDir = makeProductsDir()
  api = await createTestApp({
    app: {
      hqProducts: { productsDir, writeDir: null },
      preorders: {
        productsDir,
        variantsForProduct,
        variantsMap,
        now: () => clock,
      },
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
    ['get', '/api/preorders/variants'],
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
    const sums = await request(api.app)
      .get(`/api/preorders/sums?date=${TUESDAY}`)
      .set(tokens['backstube'])
    expect(sums.status).toBe(200)
    // quantities only: no `summary` (amounts, paid state) for the Backstube
    expect(sums.body.data).toEqual(
      expect.objectContaining({ items: expect.any(Array) })
    )
    expect(sums.body.data).not.toHaveProperty('summary')
    expect(JSON.stringify(sums.body)).not.toMatch(/total|paid/i)
    const forSale = await request(api.app)
      .get(`/api/preorders/sums?date=${TUESDAY}`)
      .set(tokens['verkauf'])
    expect(forSale.body.data.summary).toEqual(
      expect.objectContaining({ total: expect.any(Number) })
    )
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

describe('GET /api/preorders/variants (P1 variant chips)', () => {
  it('lists the Sorten per product for verkauf, fahrer and inhaber', async () => {
    for (const role of ['verkauf', 'fahrer', 'inhaber']) {
      const res = await request(api.app)
        .get('/api/preorders/variants')
        .set(tokens[role])
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        data: { mustersemmel: ['nuss', 'schoko'] },
        configured: true,
        count: 1,
      })
    }
  })

  it('is not for the Backstube (403 with message)', async () => {
    const res = await request(api.app)
      .get('/api/preorders/variants')
      .set(tokens['backstube'])
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('forbidden')
    expect(typeof res.body.message).toBe('string')
  })

  it('is not swallowed by /:id', async () => {
    const res = await request(api.app)
      .get('/api/preorders/variants')
      .set(tokens['verkauf'])
    expect(res.body.data).not.toHaveProperty('code')
  })

  it('says configured: false when only a per-product hook exists', () => {
    const service = new PreordersService({ variantsForProduct })
    expect(service.variantsByProduct()).toEqual({
      configured: false,
      products: {},
    })
  })

  it('matches the product a variant is required for', async () => {
    const res = await create(
      laden({ items: [{ productId: 'mustersemmel', quantity: 1 }] })
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('variant_required')
    const ok = await create(
      laden({
        items: [{ productId: 'mustersemmel', variant: 'nuss', quantity: 1 }],
      })
    )
    expect(ok.status).toBe(201)
    expect(ok.body.data.items[0]).toMatchObject({ variant: 'nuss' })
  })
})

describe('input plausibility on /api/preorders (W4-verify)', () => {
  it('refuses a Monday in the shop, far dates and „nicht abgeholt“ before the day', async () => {
    const monday = await create(laden({ pickupDate: '2026-11-16' }))
    expect(monday.status).toBe(400)
    expect(monday.body).toMatchObject({ error: 'ruhetag' })
    expect(monday.body.message).toMatch(/Ruhetag/)

    const far = await create(laden({ pickupDate: '9999-12-31' }))
    expect(far.status).toBe(400)
    expect(far.body).toMatchObject({ error: 'date_out_of_range' })
    const old = await create(laden({ pickupDate: '2026-01-02' }))
    expect(old.status).toBe(400)
    expect(old.body).toMatchObject({ error: 'date_out_of_range' })

    const early = await create(laden({ status: 'bereit', notCollected: true }))
    expect(early.status).toBe(409)
    expect(early.body).toMatchObject({ error: 'not_collected_too_early' })
  })

  it('refuses control characters in the name and a phone number it cannot keep', async () => {
    for (const customerName of [
      'Erika\u0000Beispiel',
      'Erika \u202eleipsieB',
    ]) {
      const res = await create(laden({ customerName }))
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'invalid_customer' })
      expect(res.body.message).toMatch(/Steuerzeichen/)
    }
    const phone = await create(laden({ customerPhone: '<b>abc</b>' }))
    expect(phone.status).toBe(400)
    expect(phone.body).toMatchObject({ error: 'invalid_phone' })
    // an empty field is still „no phone“, umlauts and emoji stay allowed
    const ok = await create(
      laden({ customerName: 'Zoë Müller 🥨', customerPhone: '' })
    )
    expect(ok.status).toBe(201)
    expect(ok.body.data).toMatchObject({
      customerName: 'Zoë Müller 🥨',
      customerPhone: null,
    })
  })

  it('keeps an existing order editable without re-checking its day', async () => {
    const p = (await create(laden())).body.data
    clock = new Date('2027-01-20T09:00:00.000Z')
    try {
      const res = await request(api.app)
        .patch(`/api/preorders/${p.id}`)
        .set(tokens['verkauf'])
        .send({ note: 'Bitte klingeln' })
      expect(res.status).toBe(200)
    } finally {
      clock = NOW
    }
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

  it('never gives a code out twice, not even after the holder moved away', async () => {
    const first = (await create(laden({ pickupDate: '2026-12-08' }))).body.data
    expect(first.code).toBe('LA-2026-12-08-01')
    const moved = await request(api.app)
      .patch(`/api/preorders/${first.id}`)
      .set(tokens['verkauf'])
      .send({
        channel: 'sammelstelle',
        pickupDate: '2026-12-12',
        pickupTime: null,
        pickupPointId: MOERSBACH,
      })
    expect(moved.status).toBe(200)
    expect(moved.body.data.code).toMatch(/^MO-2026-12-12-\d{2}$/)
    // the old slip still says LA-2026-12-08-01: the next customer gets -02
    const next = (await create(laden({ pickupDate: '2026-12-08' }))).body.data
    expect(next.code).toBe('LA-2026-12-08-02')
    // moving back does not revive the old code either
    const back = await request(api.app)
      .patch(`/api/preorders/${first.id}`)
      .set(tokens['verkauf'])
      .send({
        channel: 'telefon',
        pickupDate: '2026-12-08',
        pickupPointId: null,
      })
    expect(back.body.data.code).toBe('LA-2026-12-08-03')
  })

  it('rejects non-integer quantities with 400 invalid_quantity, drops explicit 0', async () => {
    for (const quantity of ['abc', 2.7, -1, null, '', true]) {
      const res = await create(
        laden({ items: [{ productId: 'kornbrot-500g', quantity }] })
      )
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        success: false,
        error: 'invalid_quantity',
        message: expect.stringContaining('ganze Zahl'),
      })
    }
    const ok = await create(
      laden({
        pickupDate: '2026-12-09',
        items: [
          { productId: 'kornbrot-500g', quantity: '3' },
          { productId: 'musterweck', quantity: 0 },
        ],
      })
    )
    expect(ok.status).toBe(201)
    expect(
      ok.body.data.items.map((i: { productId: string; quantity: number }) => [
        i.productId,
        i.quantity,
      ])
    ).toEqual([['kornbrot-500g', 3]])
  })

  it('keeps items, day and place of an abgeholt preorder (409 until reset)', async () => {
    const p = (await create(laden({ pickupDate: '2026-12-10' }))).body.data
    await request(api.app)
      .post(`/api/preorders/${p.id}/status`)
      .set(tokens['verkauf'])
      .send({ status: 'abgeholt', paid: true })
      .expect(200)
    const patch = (b: Record<string, unknown>) =>
      request(api.app)
        .patch(`/api/preorders/${p.id}`)
        .set(tokens['verkauf'])
        .send(b)
    for (const change of [
      { pickupDate: '2026-12-14' },
      {
        channel: 'sammelstelle',
        pickupDate: '2026-12-12',
        pickupTime: null,
        pickupPointId: MOERSBACH,
      },
      { items: [{ productId: 'kornbrot-500g', quantity: 5 }] },
    ]) {
      const res = await patch(change)
      expect(res.status).toBe(409)
      expect(res.body).toMatchObject({ error: 'already_picked_up' })
    }
    // the same items again and plain fields are fine
    expect(
      (await patch({ items: [{ productId: 'kornbrot-500g', quantity: 2 }] }))
        .status
    ).toBe(200)
    expect((await patch({ note: 'Beleg nachgereicht' })).status).toBe(200)
    // with a reset to offen in the same request the change goes through
    const reset = await patch({
      status: 'offen',
      items: [{ productId: 'kornbrot-500g', quantity: 5 }],
    })
    expect(reset.status).toBe(200)
    expect(reset.body.data).toMatchObject({
      status: 'offen',
      pickedUpAt: null,
      total: expect.any(Number),
    })
    expect(reset.body.data.items[0].quantity).toBe(5)
  })

  it('walks offen → bereit → abgeholt and locks abgeholt ↔ storniert', async () => {
    const p = (await create(laden())).body.data
    const status = (body: Record<string, unknown>) =>
      request(api.app)
        .post(`/api/preorders/${p.id}/status`)
        .set(tokens['verkauf'])
        .send(body)

    expect((await status({ status: 'bereit' })).body.data.status).toBe('bereit')
    // „nicht abgeholt" only on/after the pickup day (W4)
    const early = await status({ notCollected: true })
    expect(early.status).toBe(409)
    expect(early.body).toMatchObject({ error: 'not_collected_too_early' })
    expect(early.body.message).toMatch(/erst ab dem Abholtag \(17\.11\.2026\)/)
    clock = new Date(`${TUESDAY}T15:00:00.000Z`)
    let nc
    try {
      nc = (await status({ notCollected: true })).body.data
    } finally {
      clock = NOW
    }
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

describe('stale writes (P1/P3 expectedUpdatedAt) and cancelled lock', () => {
  // updatedAt has millisecond resolution - keep consecutive writes apart.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

  it('refuses a stale edit after a handover on another device (409 stale_preorder)', async () => {
    const p = (await create(laden({ pickupDate: '2026-12-15' }))).body.data
    const loaded = p.updatedAt
    await tick()
    // the driver hands it over and takes the money
    const handover = await request(api.app)
      .post(`/api/preorders/${p.id}/status`)
      .set(tokens['fahrer'])
      .send({ status: 'abgeholt', paid: true, expectedUpdatedAt: loaded })
    expect(handover.status).toBe(200)
    await tick()

    // the shop still has the old copy open and adds a note
    const stale = await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ note: 'Bitte schneiden', paid: false, expectedUpdatedAt: loaded })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({
      success: false,
      error: 'stale_preorder',
      message: expect.stringContaining('inzwischen'),
      updatedAt: handover.body.data.updatedAt,
    })
    const after = (
      await request(api.app)
        .get(`/api/preorders/${p.id}`)
        .set(tokens['verkauf'])
    ).body.data
    expect(after).toMatchObject({ status: 'abgeholt', paid: true, note: null })

    // with the current version the same edit goes through
    const fresh = await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ note: 'Bitte schneiden', expectedUpdatedAt: after.updatedAt })
    expect(fresh.status).toBe(200)
    expect(fresh.body.data).toMatchObject({
      status: 'abgeholt',
      paid: true,
      note: 'Bitte schneiden',
    })
  })

  it('checks status and cancel too, and only when the field is sent', async () => {
    const p = (await create(laden({ pickupDate: '2026-12-16' }))).body.data
    await tick()
    await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ note: 'geändert' })
      .expect(200)

    const status = await request(api.app)
      .post(`/api/preorders/${p.id}/status`)
      .set(tokens['verkauf'])
      .send({ paid: true, expectedUpdatedAt: p.updatedAt })
    expect(status.status).toBe(409)
    expect(status.body.error).toBe('stale_preorder')

    const cancel = await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
      .send({ expectedUpdatedAt: p.updatedAt })
    expect(cancel.status).toBe(409)
    expect(cancel.body.error).toBe('stale_preorder')

    const bad = await request(api.app)
      .patch(`/api/preorders/${p.id}`)
      .set(tokens['verkauf'])
      .send({ note: 'x', expectedUpdatedAt: 'gestern' })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({
      error: 'invalid_expected_updated_at',
      message: expect.any(String),
    })

    // without the field: last writer wins, as before (alias, old clients)
    const unchecked = await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
    expect(unchecked.status).toBe(200)
    expect(unchecked.body.data.status).toBe('storniert')
  })

  it('locks items, day and place of a cancelled preorder until it is reopened', async () => {
    const p = (await create(laden({ pickupDate: '2026-12-17' }))).body.data
    await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
      .expect(200)
    const patch = (b: Record<string, unknown>) =>
      request(api.app)
        .patch(`/api/preorders/${p.id}`)
        .set(tokens['verkauf'])
        .send(b)
    for (const change of [
      { pickupDate: '2026-12-18' },
      { pickupTime: '11:00' },
      { channel: 'laden' },
      { items: [{ productId: 'kornbrot-500g', quantity: 4 }] },
    ]) {
      const res = await patch(change)
      expect(res.status).toBe(409)
      expect(res.body).toMatchObject({
        error: 'cancelled',
        message: expect.stringContaining('storniert'),
      })
    }
    // note and the same items are fine
    expect((await patch({ note: 'Kunde hat abgesagt' })).status).toBe(200)
    expect(
      (await patch({ items: [{ productId: 'kornbrot-500g', quantity: 2 }] }))
        .status
    ).toBe(200)
    // reopening in the same request lets the change through
    const reopened = await patch({
      status: 'offen',
      items: [{ productId: 'kornbrot-500g', quantity: 4 }],
    })
    expect(reopened.status).toBe(200)
    expect(reopened.body.data).toMatchObject({ status: 'offen' })
    expect(reopened.body.data.items[0].quantity).toBe(4)
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
    // verkauf (Backliste) gets the summary; backstube the same without it
    const res = await request(api.app)
      .get('/api/preorders/sums?date=2026-11-28')
      .set(tokens['verkauf'])
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
      // W4: the Backliste's head figures, same as /day (cancelled counted
      // only in byStatus)
      summary: expect.objectContaining({
        count: 2,
        byStatus: { offen: 2, bereit: 0, abgeholt: 0, storniert: 1 },
        total: expect.any(Number),
        unpaidTotal: expect.any(Number),
      }),
    })
    // no customer data in /sums
    const raw = JSON.stringify(res.body)
    expect(raw).not.toMatch(/customerName|customerPhone|Erika|0170/)
    const day = await request(api.app)
      .get('/api/preorders/day?date=2026-11-28')
      .set(tokens['verkauf'])
    expect(res.body.data.summary).toEqual(day.body.data.summary)
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
    expect(data.pickupPointId).toBeNull()
  })

  it('narrows the day to one place for the Abholliste (P2)', async () => {
    const get = (query: string, role = 'fahrer') =>
      request(api.app).get(`/api/preorders/day?${query}`).set(tokens[role])
    const point = await get(`date=2026-11-28&pickupPointId=${MOERSBACH}`)
    expect(point.status).toBe(200)
    expect(point.body.data.pickupPointId).toBe(MOERSBACH)
    expect(point.body.data.summary).toMatchObject({
      count: 2,
      byStatus: { offen: 2, storniert: 0 },
      byChannel: { sammelstelle: 1, whatsapp: 1 },
    })
    expect(point.body.data.preorders.map((p: { id: number }) => p.id)).toEqual(
      saturdayIds.slice(0, 2)
    )
    expect(point.body.data.sums).toHaveLength(3)
    // Sammelstellen des Tages bleiben vollständig (Bestellschluss).
    expect(point.body.data.pickupPoints).toEqual([
      expect.objectContaining({ id: MOERSBACH, preorderCount: 2 }),
    ])

    const laden = await get('date=2026-11-28&pickupPointId=laden')
    expect(laden.body.data.summary).toMatchObject({
      count: 0,
      byStatus: { storniert: 1 },
    })
    expect(laden.body.data.preorders.map((p: { id: number }) => p.id)).toEqual([
      saturdayIds[2],
    ])
    expect(laden.body.data.sums).toEqual([])
    expect(laden.body.data.pickupPoints[0].preorderCount).toBe(2)

    const unknown = await get('date=2026-11-28&pickupPointId=nirgendwo')
    expect(unknown.status).toBe(200)
    expect(unknown.body.data.preorders).toEqual([])
    const bad = await get('date=2026-11-28&pickupPointId=')
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'invalid_pickup_point' })
    expect(typeof bad.body.message).toBe('string')
    expect(
      (await get(`date=2026-11-28&pickupPointId=${MOERSBACH}`, 'backstube'))
        .status
    ).toBe(403)
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

  it('hands over by status alone after the weekday changed, and handover means paid', async () => {
    const p = (
      await request(api.app)
        .post('/api/deliveries/preorders')
        .set(tokens['verkauf'])
        .send({ ...body, date: '2026-12-05' })
    ).body
    expect(p.paid).toBe(false)
    const point = `/api/deliveries/pickup-points/${MOERSBACH}`
    await request(api.app)
      .put(point)
      .set(tokens['inhaber'])
      .send({ weekday: 5, orderDeadline: { weekday: 4, time: '12:00' } })
      .expect(200)
    try {
      const patch = (b: Record<string, unknown>, role = 'verkauf') =>
        request(api.app)
          .patch(`/api/deliveries/preorders/${p.id}`)
          .set(tokens[role])
          .send(b)
      // a form save re-validates the day and fails ...
      const form = await patch({ status: 'handed_over', customer: 'X Y' })
      expect(form.status).toBe(400)
      expect(form.body.error).toBe('invalid_delivery_day')
      // ... plain ticking off does not
      const handed = await patch({ status: 'handed_over' }, 'fahrer')
      expect(handed.status).toBe(200)
      expect(handed.body).toMatchObject({
        status: 'handed_over',
        paid: true,
        handedOverAt: NOW.toISOString(),
      })
      const row = await Preorder.findByPk(p.id)
      expect(row).toMatchObject({ status: 'abgeholt', paid: true })
      // reopening through the alias keeps paid (nothing was refunded)
      const reopened = await patch({ status: 'open' })
      expect(reopened.body).toMatchObject({ status: 'open', paid: true })
      // cancelling a Laden preorder through the alias stays a 404
      const shopLike = (await create(laden({ pickupDate: '2026-12-01' }))).body
        .data
      const del = await request(api.app)
        .delete(`/api/deliveries/preorders/${shopLike.id}`)
        .set(tokens['verkauf'])
      expect(del.status).toBe(404)
      expect((await Preorder.findByPk(shopLike.id))?.status).toBe('offen')
    } finally {
      await request(api.app)
        .put(point)
        .set(tokens['inhaber'])
        .send({ weekday: 6, orderDeadline: { weekday: 5, time: '12:00' } })
        .expect(200)
    }
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

describe('PUT /api/preorders/pickup-points/:id (P2 Lieferstelle)', () => {
  it('edits master data for the inhaber in the /api/preorders envelope', async () => {
    const before = (
      await request(api.app)
        .get('/api/preorders/pickup-points')
        .set(tokens['inhaber'])
    ).body.data.find((p: { id: string }) => p.id === MOERSBACH)
    for (const role of ['verkauf', 'fahrer', 'backstube']) {
      const res = await request(api.app)
        .put(`/api/preorders/pickup-points/${MOERSBACH}`)
        .set(tokens[role])
        .send({ window: '09:00-10:00' })
      expect(res.status).toBe(403)
      expect(typeof res.body.message).toBe('string')
    }
    const res = await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: 'Klingel am Tor' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      data: { id: MOERSBACH, notes: 'Klingel am Tor', window: before.window },
    })
    const bad = await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ window: '9 Uhr' })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ success: false, error: 'invalid_window' })
    expect(bad.body.message).toMatch(/\S/)
    const missing = await request(api.app)
      .put('/api/preorders/pickup-points/nirgendwo')
      .set(tokens['inhaber'])
      .send({})
    expect(missing.status).toBe(404)
    expect(missing.body.error).toBe('pickup_point_not_found')
    await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: before.notes })
      .expect(200)
  })

  it('limits the text fields (W4), also on the Mörsbach alias', async () => {
    const put = (path: string, body: Record<string, unknown>) =>
      request(api.app).put(path).set(tokens['inhaber']).send(body)
    const notes = await put(`/api/preorders/pickup-points/${MOERSBACH}`, {
      notes: 'x'.repeat(2001),
    })
    expect(notes.status).toBe(400)
    expect(notes.body).toMatchObject({
      success: false,
      error: 'text_too_long',
      message: 'Die Notizen dürfen höchstens 2000 Zeichen lang sein.',
    })
    const name = await put(`/api/deliveries/pickup-points/${MOERSBACH}`, {
      name: 'N'.repeat(101),
    })
    expect(name.status).toBe(400)
    expect(name.body).toMatchObject({
      error: 'Text too long',
      message: 'Der Name darf höchstens 100 Zeichen lang sein.',
    })
    for (const [field, max] of [
      ['street', 200],
      ['zip', 10],
      ['city', 100],
    ] as const) {
      const res = await put(`/api/preorders/pickup-points/${MOERSBACH}`, {
        [field]: 'a'.repeat(max + 1),
      })
      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(`höchstens ${max} Zeichen`)
    }
    const ok = await put(`/api/preorders/pickup-points/${MOERSBACH}`, {
      notes: 'x'.repeat(2000),
    })
    expect(ok.status).toBe(200)
    await put(`/api/preorders/pickup-points/${MOERSBACH}`, {
      notes: null,
    }).expect(200)
  })

  it('expectedUpdatedAt: 409 stale_pickup_point instead of a silent overwrite (W4)', async () => {
    const list = await request(api.app)
      .get('/api/preorders/pickup-points')
      .set(tokens['verkauf'])
    const loaded = list.body.data.find(
      (p: { id: string }) => p.id === MOERSBACH
    )
    expect(loaded.updatedAt).toEqual(expect.any(String))

    const first = await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: 'Erster Stand', expectedUpdatedAt: loaded.updatedAt })
    expect(first.status).toBe(200)
    expect(first.body.data.updatedAt).toEqual(expect.any(String))
    expect(first.body.data.updatedAt).not.toBe(loaded.updatedAt)

    // the second form still holds the old version
    const second = await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: 'Zweiter Stand', expectedUpdatedAt: loaded.updatedAt })
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({
      success: false,
      error: 'stale_pickup_point',
      updatedAt: first.body.data.updatedAt,
    })
    expect(second.body.message).toMatch(/inzwischen/)
    const bad = await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: 'x', expectedUpdatedAt: 'gestern' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('invalid_expected_updated_at')

    const after = (
      await request(api.app)
        .get('/api/preorders/pickup-points')
        .set(tokens['verkauf'])
    ).body.data.find((p: { id: string }) => p.id === MOERSBACH)
    expect(after.notes).toBe('Erster Stand')
    // the alias keeps the mock shape: no updatedAt
    const alias = await request(api.app)
      .get('/api/deliveries/pickup-points')
      .set(tokens['verkauf'])
    expect(alias.body[0]).not.toHaveProperty('updatedAt')
    await request(api.app)
      .put(`/api/preorders/pickup-points/${MOERSBACH}`)
      .set(tokens['inhaber'])
      .send({ notes: null })
      .expect(200)
  })
})

describe('POST /api/preorders/bulk-status (W4)', () => {
  const bulk = (body: Record<string, unknown>, role = 'verkauf') =>
    request(api.app)
      .post('/api/preorders/bulk-status')
      .set(tokens[role])
      .send(body)
  const fresh = async () => (await create(laden())).body.data

  it('validates the body; backstube may not', async () => {
    const p = await fresh()
    expect(
      (await bulk({ ids: [p.id], status: 'bereit' }, 'backstube')).status
    ).toBe(403)
    for (const ids of [
      undefined,
      [],
      ['01'],
      ['x'],
      [0],
      [1.5],
      new Array(201).fill(1),
    ]) {
      const res = await bulk({ ids, status: 'bereit' })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'invalid_ids' })
      expect(res.body.message).toMatch(/\S/)
    }
    const nothing = await bulk({ ids: [p.id] })
    expect(nothing.status).toBe(400)
    expect(nothing.body.error).toBe('invalid_status')
    // values wrong for every preorder: one 400, not `refused` per id
    for (const [body, error] of [
      [{ status: 'quatsch' }, 'invalid_status'],
      [{ paid: 'ja' }, 'invalid_paid'],
      [{ notCollected: 'ja' }, 'invalid_not_collected'],
      [{ status: 'offen', notCollected: true }, 'invalid_not_collected'],
    ] as const) {
      const res = await bulk({ ids: [p.id], ...body })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error })
      expect(res.body.message).toMatch(/\S/)
    }
    // ids as digit strings, like `/:id`
    const asString = await bulk({ ids: [String(p.id)], status: 'bereit' })
    expect(asString.status).toBe(200)
    expect(asString.body.data.results).toEqual([
      expect.objectContaining({ id: p.id, result: 'ok' }),
    ])
    const badMap = await bulk({
      ids: [p.id],
      status: 'bereit',
      expectedUpdatedAt: 'gestern',
    })
    expect(badMap.status).toBe(400)
    expect(badMap.body.error).toBe('invalid_expected_updated_at')
  })

  it('answers per id: ok / conflict / anonymized / not_found / refused, with audit lines', async () => {
    const ok = await fresh()
    const stale = await fresh()
    const cancelled = await fresh()
    await request(api.app)
      .post(`/api/preorders/${cancelled.id}/cancel`)
      .set(tokens['verkauf'])
      .expect(200)
    const anon = await fresh()
    await Preorder.update(
      { anonymizedAt: new Date(), customerName: 'anonymisiert' },
      { where: { id: anon.id } }
    )
    // someone else touched `stale` after the list was loaded
    await request(api.app)
      .post(`/api/preorders/${stale.id}/status`)
      .set(tokens['verkauf'])
      .send({ paid: true })
      .expect(200)

    const res = await bulk({
      ids: [ok.id, stale.id, cancelled.id, anon.id, 999999, ok.id],
      status: 'bereit',
      expectedUpdatedAt: {
        [ok.id]: ok.updatedAt,
        [stale.id]: stale.updatedAt,
      },
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const byId = Object.fromEntries(
      res.body.data.results.map((r: { id: number }) => [r.id, r])
    )
    expect(res.body.data.results).toHaveLength(5) // duplicates once
    expect(byId[ok.id]).toMatchObject({
      result: 'ok',
      data: { id: ok.id, status: 'bereit' },
    })
    expect(byId[stale.id]).toMatchObject({
      result: 'conflict',
      error: 'stale_preorder',
      data: { id: stale.id, status: 'offen', paid: true },
    })
    expect(byId[stale.id].message).toMatch(/inzwischen/)
    expect(byId[cancelled.id]).toMatchObject({
      result: 'conflict',
      error: 'cancelled',
    })
    expect(byId[anon.id]).toMatchObject({
      result: 'anonymized',
      error: 'anonymized',
    })
    expect(byId[999999]).toMatchObject({
      result: 'not_found',
      error: 'not_found',
    })
    expect(res.body.data.counts).toEqual({
      ok: 1,
      conflict: 2,
      anonymized: 1,
      not_found: 1,
      refused: 0,
    })
    // no customer data of refused ids leaks beyond what the list shows
    expect(byId[anon.id].data).toBeUndefined()

    const audit = await AuditLog.findAll({
      where: { entity: 'preorder', entityId: String(ok.id), action: 'status' },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].data).toMatchObject({ bulk: true, status: 'bereit' })
    expect(
      await AuditLog.count({
        where: {
          entity: 'preorder',
          entityId: String(stale.id),
          action: 'status',
        },
      })
    ).toBe(1) // only the earlier single change
  })

  it('same role rules as a single change: fahrer only hands over', async () => {
    const a = await fresh()
    const b = await fresh()
    const ready = await bulk({ ids: [a.id], status: 'bereit' }, 'fahrer')
    expect(ready.status).toBe(200)
    expect(ready.body.data.results[0]).toMatchObject({
      result: 'refused',
      error: 'forbidden',
    })
    const handed = await bulk(
      { ids: [a.id, b.id], status: 'abgeholt' },
      'fahrer'
    )
    expect(handed.body.data.counts.ok).toBe(2)
    expect((await Preorder.findByPk(b.id))?.status).toBe('abgeholt')
  })

  it('„nicht abgeholt" only from the pickup day on', async () => {
    const a = await fresh()
    const early = await bulk({ ids: [a.id], notCollected: true })
    expect(early.body.data.results[0]).toMatchObject({
      result: 'refused',
      error: 'not_collected_too_early',
    })
    expect(early.body.data.results[0].message).toMatch(/Abholtag/)
    clock = new Date(`${TUESDAY}T12:00:00.000Z`)
    try {
      const onDay = await bulk({ ids: [a.id], notCollected: true }, 'fahrer')
      expect(onDay.body.data.results[0]).toMatchObject({
        result: 'ok',
        data: { status: 'bereit', notCollected: true },
      })
    } finally {
      clock = NOW
    }
  })

  it('runs serialised: two parallel bulk calls with the same versions → one wins per id', async () => {
    const list = [await fresh(), await fresh(), await fresh()]
    const body = (status: string) => ({
      ids: list.map((p) => p.id),
      status,
      expectedUpdatedAt: Object.fromEntries(
        list.map((p) => [p.id, p.updatedAt])
      ),
    })
    const [one, two] = await Promise.all([
      bulk(body('bereit')),
      bulk(body('abgeholt')),
    ])
    const counts = [one.body.data.counts, two.body.data.counts]
    // the first transaction takes all three, the second finds them changed
    expect(counts.map((c) => c.ok).sort()).toEqual([0, 3])
    expect(counts.map((c) => c.conflict).sort()).toEqual([0, 3])
  })
})
