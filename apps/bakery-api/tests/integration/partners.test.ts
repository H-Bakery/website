/**
 * B6: partners on the real API - role guards, hq catalogue lookup for visit
 * items, the duplicate check for an initial visit inside the transaction,
 * audit. createApp() on :memory: SQLite, synthetic catalogue
 * (`tools/e2e/hq-products`) and synthetic users only.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'

import { createApp } from '../../src/app'
import { AuditLog, PartnerVisit } from '../../src/models'
import { invalidateCatalogue } from '../../src/services/hq-catalogue'
import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs, tempDir } from '../helpers/hqProducts'

jest.setTimeout(30000)

let api: TestApp
let productsDir: string
const tokens: Record<string, string> = {}
const ROLES = ['inhaber', 'verkauf', 'backstube', 'fahrer'] as const
type Role = (typeof ROLES)[number]

beforeAll(async () => {
  productsDir = makeProductsDir()
  api = await createTestApp({
    seedPartners: true,
    app: { hqProducts: { productsDir, writeDir: null } },
  })
  for (const role of ROLES) {
    await createUser({
      username: `test.${role}`,
      role,
      displayName: `Test ${role}`,
    })
    tokens[role] = (await login(api.app, `test.${role}`)).token
  }
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

const as = (role: Role) => {
  const agent = request(api.app)
  const auth = bearer(tokens[role])
  return {
    get: (url: string) => agent.get(url).set(auth),
    post: (url: string) => agent.post(url).set(auth),
    put: (url: string) => agent.put(url).set(auth),
    patch: (url: string) => agent.patch(url).set(auth),
    delete: (url: string) => agent.delete(url).set(auth),
  }
}

/** Synthetic catalogue product (fixture `1-kornbrot-500g.md`, 2.50 EUR). */
const KORNBROT = { productId: 1, productSlug: 'kornbrot-500g' }
/** Fixture `13-musterweck.md`, 0.45 EUR. */
const MUSTERWECK = { productId: 13, productSlug: 'musterweck' }

let dayCounter = 0
/** A fresh business day per test, so tests do not see each other's visits. */
function freshDay(): string {
  dayCounter += 1
  const d = new Date(Date.UTC(2026, 0, 1 + dayCounter))
  return d.toISOString().slice(0, 10)
}

function expectError(res: request.Response, status: number, error: string) {
  expect(res.status).toBe(status)
  expect(res.body).toMatchObject({ success: false, error })
  expect(typeof res.body.message).toBe('string')
  expect(res.body.message.length).toBeGreaterThan(0)
}

describe('role guards (B6)', () => {
  let visitId: number

  beforeAll(async () => {
    const res = await as('inhaber')
      .post('/api/partners/1/visits')
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        items: [{ ...KORNBROT, deliveredQty: 3 }],
      })
    expect(res.status).toBe(201)
    visitId = res.body.id
  })

  const reads = [
    '/api/partners',
    '/api/partners/1',
    '/api/partners/1/templates',
    '/api/partners/1/visits',
    '/api/partners/1/visits/today?date=2026-01-02',
    '/api/partners/1/stats',
    '/api/partners/1/report',
    '/api/partners/1/report.csv',
  ]

  it.each(reads)('GET %s: 401 without a session', async (url) => {
    const res = await request(api.app).get(url)
    expectError(res, 401, 'unauthorized')
  })

  it.each(reads)('GET %s: every role may read', async (url) => {
    for (const role of ROLES) {
      expect((await as(role).get(url)).status).toBe(200)
    }
  })

  it('visits: inhaber, verkauf and fahrer write, backstube gets 403', async () => {
    for (const role of ['inhaber', 'verkauf', 'fahrer'] as const) {
      const day = freshDay()
      const created = await as(role)
        .post('/api/partners/1/visits')
        .send({
          businessDate: day,
          visitType: 'initial',
          items: [{ ...KORNBROT, deliveredQty: 4 }],
        })
      expect(created.status).toBe(201)
      const id = created.body.id
      const patched = await as(role)
        .patch(`/api/partners/1/visits/${id}`)
        .send({ note: `von ${role}` })
      expect(patched.status).toBe(200)
      const deleted = await as(role).delete(`/api/partners/1/visits/${id}`)
      expect(deleted.status).toBe(200)
    }

    const post = await as('backstube')
      .post('/api/partners/1/visits')
      .send({ businessDate: freshDay(), visitType: 'refill', items: [] })
    expectError(post, 403, 'forbidden')
    expectError(
      await as('backstube')
        .patch(`/api/partners/1/visits/${visitId}`)
        .send({ note: 'x' }),
      403,
      'forbidden'
    )
    expectError(
      await as('backstube').delete(`/api/partners/1/visits/${visitId}`),
      403,
      'forbidden'
    )
    // Nothing happened to the visit.
    expect((await PartnerVisit.findByPk(visitId))?.note).toBeNull()
  })

  it('master data and templates: only inhaber', async () => {
    for (const role of ['verkauf', 'backstube', 'fahrer'] as const) {
      expectError(
        await as(role)
          .post('/api/partners')
          .send({ name: `Markt ${role}` }),
        403,
        'forbidden'
      )
      expectError(
        await as(role).put('/api/partners/1').send({ notes: 'x' }),
        403,
        'forbidden'
      )
      expectError(
        await as(role)
          .put('/api/partners/1/templates/2')
          .send({ items: [{ ...KORNBROT, quantity: 1 }] }),
        403,
        'forbidden'
      )
    }
    const created = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Rollen' })
    expect(created.status).toBe(201)
    expect(
      (
        await as('inhaber')
          .put(`/api/partners/${created.body.id}`)
          .send({ notes: 'Notiz' })
      ).status
    ).toBe(200)
    expect(
      (
        await as('inhaber')
          .put(`/api/partners/${created.body.id}/templates/3`)
          .send({ items: [{ ...KORNBROT, quantity: 2 }] })
      ).status
    ).toBe(200)
  })

  it('the role check runs before the 404 (no partner enumeration for backstube)', async () => {
    expectError(
      await as('backstube').post('/api/partners/999/visits').send({}),
      403,
      'forbidden'
    )
  })
})

describe('hq catalogue lookup for visit items (B6)', () => {
  it('takes name, ids and price from the catalogue', async () => {
    const res = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({
        businessDate: freshDay(),
        visitType: 'initial',
        items: [
          // productName/unitPrice from the client are not needed …
          { productSlug: 'kornbrot-500g', deliveredQty: 5 },
          // … and a numeric id alone is enough.
          { productId: 13, countedQty: 2, deliveredQty: 1 },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.items).toEqual([
      expect.objectContaining({
        productId: 1,
        productSlug: 'kornbrot-500g',
        productName: 'Kornbrot 500g',
        unitPrice: 2.5,
        countedQty: null,
        deliveredQty: 5,
      }),
      expect.objectContaining({
        productId: 13,
        productSlug: 'musterweck',
        productName: 'Musterweck',
        unitPrice: 0.45,
        countedQty: 2,
        deliveredQty: 1,
      }),
    ])
  })

  it('a client name is overruled by the catalogue, a client price is kept (as in the mock)', async () => {
    const res = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        items: [
          {
            ...KORNBROT,
            productName: 'Falscher Name',
            unitPrice: 2.2,
            deliveredQty: 1,
          },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.items[0]).toMatchObject({
      productName: 'Kornbrot 500g',
      unitPrice: 2.2,
    })
  })

  it('rejects a product outside the catalogue with 400 and a German message', async () => {
    const res = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        items: [
          { productId: 9001, productSlug: 'gibt-es-nicht', deliveredQty: 1 },
        ],
      })
    expectError(res, 400, 'INVALID_ITEMS')
    expect(res.body.message).toContain('Unbekanntes Produkt')
  })

  it('keeps the snapshot correctable after the product left the catalogue', async () => {
    const dir = path.join(tempDir('hq-partner-'), 'products')
    fs.mkdirSync(dir)
    fs.copyFileSync(
      path.join(productsDir, '13-musterweck.md'),
      path.join(dir, '13-musterweck.md')
    )
    const own = createApp({
      logRequests: false,
      sequelize: api.sequelize,
      hqProducts: { productsDir: dir, writeDir: null },
    })
    const auth = bearer(tokens['verkauf'])
    const created = await request(own)
      .post('/api/partners/1/visits')
      .set(auth)
      .send({
        businessDate: freshDay(),
        visitType: 'initial',
        items: [{ ...MUSTERWECK, deliveredQty: 6 }],
      })
    expect(created.status).toBe(201)

    // The product file goes away (renamed/deleted in hq).
    fs.rmSync(path.join(dir, '13-musterweck.md'))
    invalidateCatalogue(dir)

    const corrected = await request(own)
      .patch(`/api/partners/1/visits/${created.body.id}`)
      .set(auth)
      .send({ items: [{ ...MUSTERWECK, deliveredQty: 8 }] })
    expect(corrected.status).toBe(200)
    expect(corrected.body.items[0]).toMatchObject({
      productSlug: 'musterweck',
      productName: 'Musterweck',
      unitPrice: 0.45,
      deliveredQty: 8,
    })

    // A new visit gets no snapshot fallback.
    const fresh = await request(own)
      .post('/api/partners/1/visits')
      .set(auth)
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        items: [{ ...MUSTERWECK, deliveredQty: 1 }],
      })
    expectError(fresh, 400, 'INVALID_ITEMS')
  })

  it('answers 503 hq_unavailable when the hq directory is missing', async () => {
    const own = createApp({
      logRequests: false,
      sequelize: api.sequelize,
      hqProducts: {
        productsDir: path.join(tempDir('hq-gone-'), 'products'),
        writeDir: null,
      },
    })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await request(own)
      .post('/api/partners/1/visits')
      .set(bearer(tokens['verkauf']))
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        items: [{ ...KORNBROT, deliveredQty: 1 }],
      })
    warn.mockRestore()
    expectError(res, 503, 'hq_unavailable')
    // A visit without items needs no catalogue.
    const empty = await request(own)
      .post('/api/partners/1/visits')
      .set(bearer(tokens['verkauf']))
      .send({ businessDate: freshDay(), visitType: 'refill', items: [] })
    expect(empty.status).toBe(201)
  })

  it('keeps countedQty null (not counted) apart from 0 (empty cabinet)', async () => {
    const res = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({
        businessDate: freshDay(),
        visitType: 'pickup',
        items: [
          { ...KORNBROT, countedQty: null, deliveredQty: 1 },
          { ...MUSTERWECK, countedQty: 0 },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.items.map((i: any) => i.countedQty)).toEqual([null, 0])
  })
})

describe('one initial visit per day - checked inside the transaction (B6)', () => {
  it('parallel initial visits for the same day: exactly one wins', async () => {
    const day = freshDay()
    const send = () =>
      as('verkauf')
        .post('/api/partners/1/visits')
        .send({
          businessDate: day,
          visitType: 'initial',
          items: [{ ...KORNBROT, deliveredQty: 2 }],
        })
    const results = await Promise.all([send(), send(), send(), send()])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409, 409])
    for (const r of results.filter((x) => x.status === 409)) {
      expectError(r, 409, 'DUPLICATE_INITIAL_VISIT')
    }
    const initials = await PartnerVisit.count({
      where: { partnerId: 1, businessDate: day, visitType: 'initial' },
    })
    expect(initials).toBe(1)
    // Sequences stay unique.
    const rows = await PartnerVisit.findAll({
      where: { partnerId: 1, businessDate: day },
    })
    expect(rows.map((r) => r.sequence)).toEqual([1])
  })

  it('a PATCH to initial racing a POST initial: exactly one wins', async () => {
    const day = freshDay()
    const refill = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({ businessDate: day, visitType: 'refill', items: [] })
    expect(refill.status).toBe(201)
    const [patched, posted] = await Promise.all([
      as('verkauf')
        .patch(`/api/partners/1/visits/${refill.body.id}`)
        .send({ visitType: 'initial' }),
      as('verkauf')
        .post('/api/partners/1/visits')
        .send({ businessDate: day, visitType: 'initial', items: [] }),
    ])
    // Whichever transaction runs first wins; the other one is a 409.
    const outcome = [patched.status, posted.status]
    expect(
      outcome.filter((status) => status === 200 || status === 201)
    ).toHaveLength(1)
    expect(outcome.filter((status) => status === 409)).toHaveLength(1)
    expect(
      await PartnerVisit.count({
        where: { partnerId: 1, businessDate: day, visitType: 'initial' },
      })
    ).toBe(1)
  })

  it('moving a visit onto a day with an initial is a 409; moving re-sequences', async () => {
    const dayA = freshDay()
    const dayB = freshDay()
    const a1 = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({ businessDate: dayA, visitType: 'initial', items: [] })
    const b1 = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({ businessDate: dayB, visitType: 'initial', items: [] })
    const b2 = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({ businessDate: dayB, visitType: 'refill', items: [] })
    expect([a1.status, b1.status, b2.status]).toEqual([201, 201, 201])

    expectError(
      await as('verkauf')
        .patch(`/api/partners/1/visits/${b1.body.id}`)
        .send({ businessDate: dayA }),
      409,
      'DUPLICATE_INITIAL_VISIT'
    )

    const moved = await as('verkauf')
      .patch(`/api/partners/1/visits/${b2.body.id}`)
      .send({ businessDate: dayA })
    expect(moved.status).toBe(200)
    expect(moved.body).toMatchObject({ businessDate: dayA, sequence: 2 })
  })

  it('a visitAt correction alone keeps the business day (deliberate)', async () => {
    const day = freshDay()
    const v = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({
        businessDate: day,
        visitAt: `${day}T08:00:00.000Z`,
        visitType: 'refill',
        items: [],
      })
    const next = new Date(Date.parse(`${day}T08:00:00.000Z`) + 86400000)
    const res = await as('verkauf')
      .patch(`/api/partners/1/visits/${v.body.id}`)
      .send({ visitAt: next.toISOString() })
    expect(res.status).toBe(200)
    expect(res.body.businessDate).toBe(day)
  })
})

describe('mock contract details (D3)', () => {
  it('GET /api/partners?active= filters like the mock', async () => {
    const created = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Inaktiv', active: false })
    expect(created.status).toBe(201)
    const active = await as('verkauf').get('/api/partners?active=true')
    const inactive = await as('verkauf').get('/api/partners?active=false')
    expect(active.body.every((p: any) => p.active === true)).toBe(true)
    expect(inactive.body.map((p: any) => p.slug)).toContain('testmarkt-inaktiv')
    expect(inactive.body.every((p: any) => p.active === false)).toBe(true)
  })

  it('a new partner without delivery days delivers Tue-Sat, as in the mock', async () => {
    const res = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Standard' })
    expect(res.status).toBe(201)
    expect(res.body.deliveryDays).toEqual([2, 3, 4, 5, 6])
    const none = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Ohne', deliveryDays: [] })
    expect(none.body.deliveryDays).toEqual([])
  })

  it('a non-string name is a 400', async () => {
    expectError(
      await as('inhaber').post('/api/partners').send({ name: 42 }),
      400,
      'INVALID_NAME'
    )
  })

  it('template PUT: 200 on create and update, catalogue ids, quantity 0 dropped, active kept', async () => {
    const partner = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Vorlage' })
    const url = `/api/partners/${partner.body.id}/templates/4`
    const created = await as('inhaber')
      .put(url)
      .send({
        items: [
          { productSlug: 'kornbrot-500g', quantity: 3 },
          { productId: 13, quantity: 2 },
          { ...KORNBROT, quantity: 0 },
          { productSlug: '', quantity: 5 },
        ],
      })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({
      partnerId: partner.body.id,
      weekday: 4,
      active: true,
      items: [
        { productId: 1, productSlug: 'kornbrot-500g', quantity: 3 },
        { productId: 13, productSlug: 'musterweck', quantity: 2 },
      ],
    })

    const off = await as('inhaber').put(url).send({ items: [], active: false })
    expect(off.body).toMatchObject({ active: false, items: [] })
    // Without `active` the flag stays (before B6 a PUT re-activated it).
    const again = await as('inhaber')
      .put(url)
      .send({ items: [{ ...KORNBROT, quantity: 1 }] })
    expect(again.status).toBe(200)
    expect(again.body.active).toBe(false)
    expect(again.body.id).toBe(created.body.id)
  })

  it('DELETE answers 200 { id, deleted, message } like the mock', async () => {
    const v = await as('verkauf')
      .post('/api/partners/1/visits')
      .send({ businessDate: freshDay(), visitType: 'refill', items: [] })
    const res = await as('verkauf').delete(
      `/api/partners/1/visits/${v.body.id}`
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: v.body.id,
      deleted: true,
      message: 'Besuch gelöscht.',
    })
    expectError(
      await as('verkauf').delete(`/api/partners/1/visits/${v.body.id}`),
      404,
      'VISIT_NOT_FOUND'
    )
  })

  it('attributes a visit to the session: staffId always, staffName by default', async () => {
    const me = await login(api.app, 'test.fahrer')
    const res = await request(api.app)
      .post('/api/partners/1/visits')
      .set(bearer(me.token))
      .send({
        businessDate: freshDay(),
        visitType: 'refill',
        staffId: 999, // ignored: the session decides
        items: [],
      })
    expect(res.status).toBe(201)
    expect(res.body.staffId).toBe(me.user['id'])
    expect(res.body.staffName).toBe('Test fahrer')
    const named = await as('fahrer').post('/api/partners/1/visits').send({
      businessDate: freshDay(),
      visitType: 'refill',
      staffName: 'Aushilfe',
      items: [],
    })
    expect(named.body.staffName).toBe('Aushilfe')
  })
})

describe('audit (D5)', () => {
  it('logs partner, template and visit writes with the acting user', async () => {
    const before = await AuditLog.count()
    const partner = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Audit' })
    await as('inhaber')
      .put(`/api/partners/${partner.body.id}`)
      .send({ phone: '0000 000000' })
    await as('inhaber')
      .put(`/api/partners/${partner.body.id}/templates/2`)
      .send({ items: [{ ...KORNBROT, quantity: 1 }] })
    const visit = await as('verkauf')
      .post(`/api/partners/${partner.body.id}/visits`)
      .send({
        businessDate: freshDay(),
        visitType: 'initial',
        items: [{ ...KORNBROT, deliveredQty: 2 }],
      })
    await as('verkauf')
      .patch(`/api/partners/${partner.body.id}/visits/${visit.body.id}`)
      .send({ note: 'korrigiert' })
    await as('verkauf').delete(
      `/api/partners/${partner.body.id}/visits/${visit.body.id}`
    )

    const rows = await AuditLog.findAll({ order: [['id', 'ASC']] })
    const mine = rows.slice(before).map((r) => ({
      action: r.action,
      entity: r.entity,
      userId: r.userId,
    }))
    const { User } = await import('../../src/models')
    const owner = await User.findOne({ where: { username: 'test.inhaber' } })
    const seller = await User.findOne({ where: { username: 'test.verkauf' } })
    expect(mine).toEqual([
      { action: 'create', entity: 'partner', userId: owner!.id },
      { action: 'update', entity: 'partner', userId: owner!.id },
      { action: 'create', entity: 'partner_template', userId: owner!.id },
      { action: 'create', entity: 'partner_visit', userId: seller!.id },
      { action: 'update', entity: 'partner_visit', userId: seller!.id },
      { action: 'delete', entity: 'partner_visit', userId: seller!.id },
    ])
    // The partner update logs field names only, never the phone number.
    expect(JSON.stringify(rows.slice(before)[1].data)).not.toContain('0000')
    // The deleted visit can be reconstructed from the log.
    expect(rows[rows.length - 1].data).toMatchObject({
      visitType: 'initial',
      items: [{ productSlug: 'kornbrot-500g', deliveredQty: 2 }],
    })
  })
})

describe('error shape', () => {
  it('every partner error carries success:false, error and a German message', async () => {
    const cases: Array<[request.Test, number, string]> = [
      [as('inhaber').get('/api/partners/abc'), 404, 'PARTNER_NOT_FOUND'],
      [as('inhaber').get('/api/partners/999'), 404, 'PARTNER_NOT_FOUND'],
      [
        as('inhaber').get('/api/partners/1/visits?from=2026-02-30'),
        400,
        'INVALID_RANGE',
      ],
      [
        as('inhaber').get('/api/partners/1/visits/today?date=2026-13-01'),
        400,
        'INVALID_BUSINESS_DATE',
      ],
      [
        as('verkauf')
          .post('/api/partners/1/visits')
          .send({ visitType: 'besuch' }),
        400,
        'INVALID_VISIT_TYPE',
      ],
      [
        as('verkauf')
          .post('/api/partners/1/visits')
          .send({ visitType: 'refill', businessDate: '2026-02-30' }),
        400,
        'INVALID_BUSINESS_DATE',
      ],
      [
        as('verkauf')
          .post('/api/partners/1/visits')
          .send({
            visitType: 'refill',
            businessDate: '2026-03-03',
            items: [{ ...KORNBROT, countedQty: 'abc' }],
          }),
        400,
        'INVALID_ITEMS',
      ],
      [
        as('verkauf').patch('/api/partners/1/visits/999999').send({}),
        404,
        'VISIT_NOT_FOUND',
      ],
      [
        as('inhaber').put('/api/partners/1/templates/8').send({ items: [] }),
        400,
        'INVALID_WEEKDAY',
      ],
      [
        as('inhaber').put('/api/partners/1').send({ active: 'false' }),
        400,
        'INVALID_ACTIVE',
      ],
    ]
    for (const [call, status, error] of cases) {
      expectError(await call, status, error)
    }
  })

  it('a duplicate slug is a 409, also on PUT', async () => {
    const a = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Slug A' })
    const b = await as('inhaber')
      .post('/api/partners')
      .send({ name: 'Testmarkt Slug B' })
    expectError(
      await as('inhaber')
        .post('/api/partners')
        .send({ name: 'Testmarkt Slug A' }),
      409,
      'PARTNER_SLUG_TAKEN'
    )
    expectError(
      await as('inhaber')
        .put(`/api/partners/${b.body.id}`)
        .send({ slug: a.body.slug }),
      409,
      'PARTNER_SLUG_TAKEN'
    )
  })
})
