/**
 * The fifth role `backstubenleiter` (Backstubenleitung): user administration
 * accepts it, the database stores it, and it may do exactly what `backstube`
 * may - plus recipes (see `recipes.test.ts`). Synthetic users only.
 */
import request from 'supertest'

import { AuditLog, User } from '../../src/models'
import { STATION_TOKEN_HEADER } from '../../src/auth/middleware'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

jest.setTimeout(30000)

let api: TestApp
let owner: Record<string, string>
let lead: Record<string, string>
let baker: Record<string, string>

beforeAll(async () => {
  api = await createTestApp()
  owner = bearer(await sessionFor(api.app, 'test.inhaber', 'inhaber'))
  lead = bearer(await sessionFor(api.app, 'test.leitung', 'backstubenleiter'))
  baker = bearer(await sessionFor(api.app, 'test.backstube', 'backstube'))
})

afterAll(async () => {
  await api.close()
})

describe('user administration', () => {
  it('creates a backstubenleiter; the migrated database stores the role', async () => {
    const res = await request(api.app).post('/api/users').set(owner).send({
      username: 'test.neueleitung',
      displayName: 'Nele Neuleitung',
      role: 'backstubenleiter',
      password: 'Anfang-2026!',
      pin: '4682',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      username: 'test.neueleitung',
      role: 'backstubenleiter',
      active: true,
      hasPin: true,
    })
    const [rows] = await api.sequelize.query(
      "SELECT role FROM users WHERE username = 'test.neueleitung'"
    )
    expect(rows).toEqual([{ role: 'backstubenleiter' }])
    const session = await login(api.app, 'test.neueleitung', 'Anfang-2026!')
    expect(session.user).toMatchObject({ role: 'backstubenleiter' })
    const me = await request(api.app)
      .get('/api/auth/me')
      .set(bearer(session.token))
    expect(me.body.data).toMatchObject({ role: 'backstubenleiter' })
    const list = await request(api.app).get('/api/users').set(owner)
    expect(
      list.body.data.find(
        (u: { username: string }) => u.username === 'test.neueleitung'
      )
    ).toMatchObject({ role: 'backstubenleiter' })
  })

  it('changes a role to and from backstubenleiter and audits it', async () => {
    const user = await createUser({
      username: 'test.aufstieg',
      role: 'backstube',
    })
    const up = await request(api.app)
      .patch(`/api/users/${user.id}`)
      .set(owner)
      .send({ role: 'backstubenleiter' })
    expect(up.status).toBe(200)
    expect(up.body.data).toMatchObject({ role: 'backstubenleiter' })
    expect((await User.findByPk(user.id))?.role).toBe('backstubenleiter')
    const row = await AuditLog.findOne({
      where: { entity: 'user', entityId: String(user.id), action: 'update' },
      order: [['id', 'DESC']],
    })
    expect(row?.data).toMatchObject({
      changes: { role: { from: 'backstube', to: 'backstubenleiter' } },
    })
    const down = await request(api.app)
      .patch(`/api/users/${user.id}`)
      .set(owner)
      .send({ role: 'backstube' })
    expect(down.body.data).toMatchObject({ role: 'backstube' })
  })

  it('names the role among the allowed ones when the role is unknown', async () => {
    const res = await request(api.app).post('/api/users').set(owner).send({
      username: 'test.unbekannt',
      displayName: 'Unbekannt',
      role: 'backstubenleitung',
      password: 'Anfang-2026!',
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(
      /Erlaubt: inhaber, verkauf, backstube, backstubenleiter, fahrer/
    )
  })

  it('is not an administrator: user administration stays inhaber only', async () => {
    for (const res of [
      await request(api.app).get('/api/users').set(lead),
      await request(api.app).post('/api/users').set(lead).send({}),
    ]) {
      expect(res.status).toBe(403)
    }
  })

  it('switches in at a station by PIN like everyone else', async () => {
    const station = await request(api.app)
      .post('/api/auth/stations')
      .set(owner)
      .send({ name: 'Backstube-Tablet (Test)' })
    expect(station.status).toBe(201)
    const header = { [STATION_TOKEN_HEADER]: station.body.data.token }
    const users = await request(api.app)
      .get('/api/auth/station/users')
      .set(header)
    const nele = users.body.data.find(
      (u: { displayName: string }) => u.displayName === 'Nele Neuleitung'
    )
    expect(nele).toMatchObject({ role: 'backstubenleiter' })
    const pin = await request(api.app)
      .post('/api/auth/pin')
      .set(header)
      .send({ userId: nele.id, pin: '4682' })
    expect(pin.status).toBe(200)
    const me = await request(api.app)
      .get('/api/auth/me')
      .set(bearer(pin.body.data.token))
    expect(me.body.data).toMatchObject({ role: 'backstubenleiter' })
    // recipes may be written from the Backstube tablet (no password session needed)
    const recipes = await request(api.app)
      .get('/api/recipes')
      .set(bearer(pin.body.data.token))
    expect(recipes.status).toBe(200)
  })
})

describe('everything backstube may - and nothing else', () => {
  const DAY = '2026-11-20'
  type Call = ['get' | 'post' | 'put' | 'patch' | 'delete', string]

  // Where `backstube` is let in by name (requireRole lists), read by any
  // session, or refused: the Backstubenleitung gets the same answer.
  const CALLS: Call[] = [
    // Backzettel: planners (inhaber, backstube)
    ['get', '/api/backzettel/config'],
    ['put', '/api/backzettel/config/base'],
    ['get', '/api/backzettel/reference?weekday=5'],
    ['get', `/api/backzettel/${DAY}`],
    ['get', `/api/backzettel/${DAY}/bake-list`],
    ['get', `/api/backzettel/${DAY}/prep`],
    ['put', `/api/backzettel/${DAY}/season`],
    ['put', `/api/backzettel/${DAY}/lines/weck/correction`],
    ['post', `/api/backzettel/${DAY}/confirm`],
    ['post', `/api/backzettel/${DAY}/lines/1/done`],
    ['post', `/api/backzettel/${DAY}/lines/1/undone`],
    ['post', `/api/backzettel/${DAY}/deltas/ack`],
    ['post', `/api/backzettel/${DAY}/deltas/1/ack`],
    ['post', `/api/backzettel/${DAY}/bake/1/baked`],
    ['post', `/api/backzettel/${DAY}/bake/deltas/baked`],
    // inhaber only
    ['post', `/api/backzettel/${DAY}/reopen`],
    // Rest am Abend
    ['get', `/api/rest?date=${DAY}`],
    ['get', '/api/rest/averages?weeks=6'],
    ['put', `/api/rest/${DAY}`],
    ['get', '/api/rest/evaluation'],
    // Vorbestellungen: only the sums
    ['get', `/api/preorders/sums?date=${DAY}`],
    ['get', '/api/preorders'],
    ['get', `/api/preorders/day?date=${DAY}`],
    ['post', '/api/preorders'],
    ['get', '/api/preorders/pickup-points'],
    // any session
    ['get', '/api/products'],
    ['get', '/api/hq-products'],
    ['get', '/api/partners'],
    ['get', '/api/recipes'],
    // refused for backstube
    ['put', '/api/hq-products/kornbrot-500g'],
    ['post', '/api/hq-products'],
    ['get', '/api/users'],
    ['get', '/api/reports/daily'],
    ['get', '/api/analytics/summary'],
    ['get', '/api/finance/summary'],
    ['get', '/api/finance/targets'],
    ['get', '/api/deliveries/tours'],
    ['get', '/api/deliveries/drivers'],
    ['get', '/api/dienstplan/employees'],
    ['get', '/api/hq-sync/status'],
    ['post', '/api/hq-sync/retry'],
    ['post', '/api/auth/stations'],
    ['post', '/api/partners'],
  ]

  it.each(CALLS)(
    '%s %s answers the Backstubenleitung like the Backstube',
    async (method, url) => {
      const asBaker = await request(api.app)[method](url).set(baker).send({})
      const asLead = await request(api.app)[method](url).set(lead).send({})
      expect(asLead.status).toBe(asBaker.status)
      expect(asLead.body.error).toBe(asBaker.body.error)
    }
  )

  it('the list really covers allowed and refused routes', async () => {
    const statuses = new Map<string, number>()
    for (const [method, url] of CALLS) {
      const res = await request(api.app)[method](url).set(baker).send({})
      statuses.set(`${method} ${url}`, res.status)
    }
    const forbidden = [...statuses]
      .filter(([, status]) => status === 403)
      .map(([k]) => k)
    const allowed = [...statuses]
      .filter(([, status]) => status !== 403)
      .map(([k]) => k)
    expect(forbidden).toEqual(
      expect.arrayContaining([
        `post /api/backzettel/${DAY}/reopen`,
        'get /api/users',
        'get /api/reports/daily',
        'get /api/deliveries/tours',
        'put /api/hq-products/kornbrot-500g',
      ])
    )
    expect(allowed).toEqual(
      expect.arrayContaining([
        'put /api/backzettel/config/base',
        `post /api/backzettel/${DAY}/confirm`,
        `get /api/preorders/sums?date=${DAY}`,
        'get /api/rest/averages?weeks=6',
        'get /api/recipes',
      ])
    )
    expect(statuses.get('get /api/backzettel/config')).toBe(200)
  })

  it('sums for the Backstubenleitung carry quantities, no amounts - as for the Backstube', async () => {
    const asLead = await request(api.app)
      .get(`/api/preorders/sums?date=${DAY}`)
      .set(lead)
    const asOwner = await request(api.app)
      .get(`/api/preorders/sums?date=${DAY}`)
      .set(owner)
    expect(asLead.status).toBe(200)
    expect(asOwner.body.data).toHaveProperty('summary')
    expect(asLead.body.data).not.toHaveProperty('summary')
  })

  it('recipes are where the two differ', async () => {
    const body = { title: 'Rollenprobe', category: 'cakes' }
    const asBaker = await request(api.app)
      .post('/api/recipes')
      .set(baker)
      .send(body)
    const asLead = await request(api.app)
      .post('/api/recipes')
      .set(lead)
      .send(body)
    expect(asBaker.status).toBe(403)
    // let through by the role guard; without hq there is nowhere to write
    expect(asLead.status).toBe(503)
    expect(asLead.body).toMatchObject({ error: 'hq_unavailable' })
  })
})
