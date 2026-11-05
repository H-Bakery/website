/**
 * B3 auth against the real API (createApp() on :memory: SQLite):
 * login, me, refresh rotation + reuse, logout, global guard, role guard,
 * rate limit, audit. Synthetic users only.
 */
import * as jwt from 'jsonwebtoken'
import request from 'supertest'

import { AuditLog, AuthSession, RefreshToken } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { TEST_PASSWORD, bearer, createUser, login } from '../helpers/auth'

jest.setTimeout(30000)

let api: TestApp
/** Injected clock: real time, moved forward where a test needs it. */
let clock = Date.now()

beforeAll(async () => {
  api = await createTestApp({
    seedPartners: true,
    app: { auth: { now: () => clock } },
  })
  await createUser({
    username: 'test.inhaber',
    role: 'inhaber',
    displayName: 'Test Inhaber',
  })
  await createUser({ username: 'test.verkauf', role: 'verkauf' })
  await createUser({ username: 'test.backstube', role: 'backstube' })
  await createUser({ username: 'test.inaktiv', role: 'verkauf', active: false })
})

afterAll(async () => {
  await api.close()
})

function expectErrorShape(body: Record<string, unknown>, error: string) {
  expect(body).toMatchObject({ success: false, error })
  expect(typeof body['message']).toBe('string')
  expect((body['message'] as string).length).toBeGreaterThan(0)
}

describe('POST /api/auth/login', () => {
  it('answers the mock contract shape plus sessionKind, without hashes', async () => {
    const res = await request(api.app)
      .post('/api/auth/login')
      .send({ username: 'Test.Inhaber', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const data = res.body.data
    expect(Object.keys(data).sort()).toEqual(
      ['expiresIn', 'refreshToken', 'sessionKind', 'token', 'user'].sort()
    )
    expect(data.sessionKind).toBe('personal')
    expect(data.expiresIn).toBe(3600)
    expect(data.refreshToken).toMatch(/^rt_/)
    expect(data.user).toMatchObject({
      username: 'test.inhaber',
      displayName: 'Test Inhaber',
      role: 'inhaber',
      active: true,
      isActive: true,
      sessionKind: 'personal',
    })
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash|pinHash/)

    const claims = jwt.decode(data.token) as Record<string, unknown>
    expect(claims).toMatchObject({
      sub: String(data.user.id),
      role: 'inhaber',
      displayName: 'Test Inhaber',
      sessionKind: 'personal',
      type: 'access',
    })
    expect(typeof claims['sid']).toBe('number')
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(3600)
  })

  it('accepts `email` as the login name like the mock', async () => {
    const res = await request(api.app)
      .post('/api/auth/login')
      .send({ email: 'test.verkauf', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('stores only the hash of the refresh token', async () => {
    const { refreshToken } = await login(api.app, 'test.verkauf')
    const rows = await RefreshToken.findAll()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.tokenHash).not.toBe(refreshToken)
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(row.sessionId).toEqual(expect.any(Number))
    }
  })

  it.each([
    ['wrong password', 'test.verkauf', 'falsch-falsch'],
    ['unknown user', 'gibt.es.nicht', TEST_PASSWORD],
    ['deactivated user', 'test.inaktiv', TEST_PASSWORD],
  ])('%s -> 401 with the German message', async (_case, username, password) => {
    const res = await request(api.app)
      .post('/api/auth/login')
      .send({ username, password })
    expect(res.status).toBe(401)
    expectErrorShape(res.body, 'invalid_credentials')
    expect(res.body.message).toBe('Benutzername oder Passwort falsch.')
  })

  it('missing fields -> 400', async () => {
    const res = await request(api.app)
      .post('/api/auth/login')
      .send({ username: 'test.verkauf' })
    expect(res.status).toBe(400)
    expectErrorShape(res.body, 'validation')
  })

  it('audits success and failure', async () => {
    const before = await AuditLog.count()
    await login(api.app, 'test.backstube')
    await request(api.app)
      .post('/api/auth/login')
      .send({ username: 'test.backstube', password: 'nicht-richtig' })
    const rows = await AuditLog.findAll({
      order: [['id', 'ASC']],
      offset: before,
    })
    expect(rows.map((r) => r.action)).toEqual(['login', 'login_failed'])
    expect(rows[0].userId).toEqual(expect.any(Number))
    expect(rows[0].entity).toBe('user')
    expect(rows[1].userId).toBeNull()
    expect(rows[1].data).toMatchObject({ username: 'test.backstube' })
    expect(JSON.stringify(rows[1].data)).not.toContain('nicht-richtig')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the user of the session', async () => {
    const { token } = await login(api.app, 'test.verkauf')
    const res = await request(api.app).get('/api/auth/me').set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      username: 'test.verkauf',
      role: 'verkauf',
      sessionKind: 'personal',
      stationId: null,
    })
    expect(res.body.data).not.toHaveProperty('passwordHash')
  })

  it.each([
    ['no header', undefined],
    ['garbage', 'Bearer abc.def.ghi'],
    [
      'wrong secret',
      `Bearer ${jwt.sign(
        { sub: '1', sid: 1, type: 'access' },
        'x'.repeat(40)
      )}`,
    ],
    [
      'alg none',
      `Bearer ${jwt.sign({ sub: '1', sid: 1, type: 'access' }, '', {
        algorithm: 'none',
      })}`,
    ],
  ])('401 with %s', async (_case, header) => {
    const call = request(api.app).get('/api/auth/me')
    const res = header ? await call.set('Authorization', header) : await call
    expect(res.status).toBe(401)
    expectErrorShape(res.body, 'unauthorized')
  })

  it('401 once the user is deactivated (checked on every request)', async () => {
    const user = await createUser({ username: 'test.bald.weg', role: 'fahrer' })
    const { token } = await login(api.app, 'test.bald.weg')
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(token))).status
    ).toBe(200)
    user.active = false
    await user.save()
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(token))).status
    ).toBe(401)
  })
})

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const first = await login(api.app, 'test.verkauf')
    const res = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toEqual(expect.any(String))
    expect(res.body.data.refreshToken).toMatch(/^rt_/)
    expect(res.body.data.refreshToken).not.toBe(first.refreshToken)
    expect(res.body.data.expiresIn).toBe(3600)
    expect(res.body.data.user.username).toBe('test.verkauf')

    // The old row is revoked and points at its successor.
    const sid = (jwt.decode(first.token) as { sid: number }).sid
    const rows = await RefreshToken.findAll({
      where: { sessionId: sid },
      order: [['id', 'ASC']],
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].revokedAt).not.toBeNull()
    expect(rows[0].replacedBy).toBe(rows[1].id)
    expect(rows[1].revokedAt).toBeNull()

    // The new pair works.
    const next = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: res.body.data.refreshToken })
    expect(next.status).toBe(200)
  })

  it('reuse of a rotated token revokes the whole chain', async () => {
    const first = await login(api.app, 'test.backstube')
    const rotated = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.refreshToken })
    expect(rotated.status).toBe(200)
    const current = rotated.body.data

    // An attacker replays the old token, after the grace window.
    clock += 11 * 1000
    const replay = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.refreshToken })
    expect(replay.status).toBe(401)
    expectErrorShape(replay.body, 'unauthorized')

    // The legitimate successor is dead too, and so are the access tokens.
    const afterReuse = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: current.refreshToken })
    expect(afterReuse.status).toBe(401)
    for (const token of [first.token, current.token]) {
      const me = await request(api.app).get('/api/auth/me').set(bearer(token))
      expect(me.status).toBe(401)
    }

    const sid = (jwt.decode(first.token) as { sid: number }).sid
    const session = await AuthSession.findByPk(sid)
    expect(session?.revokeReason).toBe('reuse')
    const audit = await AuditLog.findOne({
      where: { action: 'refresh_reuse', entityId: String(sid) },
    })
    expect(audit).not.toBeNull()
  })

  it.each([
    ['missing', {}],
    ['empty', { refreshToken: '' }],
    ['unknown', { refreshToken: 'rt_gibtesnicht' }],
    ['an access token', null],
  ])('401 for a %s refresh token', async (_case, body) => {
    let payload = body
    if (payload === null) {
      payload = { refreshToken: (await login(api.app, 'test.verkauf')).token }
    }
    const res = await request(api.app).post('/api/auth/refresh').send(payload)
    expect(res.status).toBe(401)
    expectErrorShape(res.body, 'unauthorized')
  })
})

describe('POST /api/auth/refresh - parallel refreshes (grace window)', () => {
  it('a parallel refresh loses with 409 and the session survives', async () => {
    const first = await login(api.app, 'test.verkauf')
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(api.app)
          .post('/api/auth/refresh')
          .send({ refreshToken: first.refreshToken })
      )
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409])
    for (const loser of results.filter((r) => r.status === 409)) {
      expectErrorShape(loser.body, 'refresh_superseded')
    }
    const winner = results.find((r) => r.status === 200)!.body.data
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(winner.token)))
        .status
    ).toBe(200)
    const next = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: winner.refreshToken })
    expect(next.status).toBe(200)
    const sid = (jwt.decode(first.token) as { sid: number }).sid
    expect((await AuthSession.findByPk(sid))?.revokedAt).toBeNull()
  })

  it('within the window, but the successor was already used: reuse', async () => {
    const first = await login(api.app, 'test.verkauf')
    const second = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.refreshToken })
    const third = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: second.body.data.refreshToken })
    expect(third.status).toBe(200)
    const replay = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.refreshToken })
    expect(replay.status).toBe(401)
    const sid = (jwt.decode(first.token) as { sid: number }).sid
    expect((await AuthSession.findByPk(sid))?.revokeReason).toBe('reuse')
  })
})

describe('POST /api/auth/logout', () => {
  it('ends this session: access and refresh token stop working', async () => {
    const other = await login(api.app, 'test.verkauf')
    const session = await login(api.app, 'test.verkauf')
    const res = await request(api.app)
      .post('/api/auth/logout')
      .set(bearer(session.token))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, message: 'Abgemeldet.' })

    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(session.token)))
        .status
    ).toBe(401)
    expect(
      (
        await request(api.app)
          .post('/api/auth/refresh')
          .send({ refreshToken: session.refreshToken })
      ).status
    ).toBe(401)
    // Another device of the same user stays logged in.
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(other.token)))
        .status
    ).toBe(200)
  })

  it('works with only the refresh token once the access token expired', async () => {
    const session = await login(api.app, 'test.verkauf')
    const start = clock
    clock += 2 * 60 * 60 * 1000 // access token (1 h) is gone
    try {
      expect(
        (await request(api.app).get('/api/auth/me').set(bearer(session.token)))
          .status
      ).toBe(401)
      const res = await request(api.app)
        .post('/api/auth/logout')
        .set(bearer(session.token))
        .send({ refreshToken: session.refreshToken })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, message: 'Abgemeldet.' })
      const refresh = await request(api.app)
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken })
      expect(refresh.status).toBe(401)
      const sid = (jwt.decode(session.token) as { sid: number }).sid
      expect((await AuthSession.findByPk(sid))?.revokeReason).toBe('logout')
      const audit = await AuditLog.findOne({
        where: { action: 'logout', entityId: String(session.user['id']) },
        order: [['id', 'DESC']],
      })
      expect(audit?.data).toMatchObject({ via: 'refresh' })
    } finally {
      clock = start
    }
  })

  it('without any token it is an idempotent no-op (as in the mock)', async () => {
    const before = await AuditLog.count({ where: { action: 'logout' } })
    for (const body of [{}, { refreshToken: 'rt_gibtesnicht' }]) {
      const res = await request(api.app).post('/api/auth/logout').send(body)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, message: 'Abgemeldet.' })
    }
    expect(await AuditLog.count({ where: { action: 'logout' } })).toBe(before)
  })
})

describe('global guard and role guard', () => {
  it('every /api route needs a session (partners too), health does not', async () => {
    for (const path of [
      '/api/partners',
      '/api/partners/1',
      '/api/users',
      '/api/gibt-es-nicht',
    ]) {
      const res = await request(api.app).get(path)
      expect(res.status).toBe(401)
      expectErrorShape(res.body, 'unauthorized')
    }
    expect((await request(api.app).get('/health')).status).toBe(200)
    expect((await request(api.app).get('/api/health')).status).toBe(200)
  })

  it('with a session: partners 200, unknown routes 404', async () => {
    const { token } = await login(api.app, 'test.backstube')
    expect(
      (await request(api.app).get('/api/partners').set(bearer(token))).status
    ).toBe(200)
    const unknown = await request(api.app)
      .get('/api/gibt-es-nicht')
      .set(bearer(token))
    expect(unknown.status).toBe(404)
    expectErrorShape(unknown.body, 'not_found')
  })

  it('the guard is not fooled by case or trailing slashes on public paths', async () => {
    for (const path of ['/api/auth/me/', '/API/AUTH/ME', '/api/auth//me']) {
      const res = await request(api.app).get(path)
      expect([401, 404]).toContain(res.status)
      expect(res.status).not.toBe(200)
    }
  })

  it('requireRole: 403 for other roles, inhaber passes', async () => {
    const verkauf = await login(api.app, 'test.verkauf')
    const res = await request(api.app)
      .get('/api/users')
      .set(bearer(verkauf.token))
    expect(res.status).toBe(403)
    expectErrorShape(res.body, 'forbidden')

    const inhaber = await login(api.app, 'test.inhaber')
    expect(
      (await request(api.app).get('/api/users').set(bearer(inhaber.token)))
        .status
    ).toBe(200)
  })

  it('partner visits are attributed to req.user', async () => {
    const { token, user } = await login(api.app, 'test.verkauf')
    const res = await request(api.app)
      .post('/api/partners/1/visits')
      .set(bearer(token))
      .send({
        businessDate: '2026-11-03',
        visitType: 'initial',
        items: [
          {
            productId: 9001,
            productSlug: 'testbrot',
            productName: 'Testbrot',
            unitPrice: 2.5,
            countedQty: null,
            deliveredQty: 10,
          },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.staffId).toBe(user['id'])
  })
})

describe('rate limit (5 failed attempts / 5 min per IP + username)', () => {
  it('answers 429 after five failures, even for the right password', async () => {
    await createUser({ username: 'test.limit', role: 'verkauf' })
    const attempt = (password: string, ip = '203.0.113.7') =>
      request(api.app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'test.limit', password })

    for (let i = 0; i < 5; i++) {
      expect((await attempt('falsch-falsch')).status).toBe(401)
    }
    const blocked = await attempt(TEST_PASSWORD)
    expect(blocked.status).toBe(429)
    expectErrorShape(blocked.body, 'too_many_requests')

    // Another IP and another username are not affected.
    expect((await attempt(TEST_PASSWORD, '203.0.113.8')).status).toBe(200)
    const other = await request(api.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.7')
      .send({ username: 'test.inhaber', password: TEST_PASSWORD })
    expect(other.status).toBe(200)
  })

  it('caps failures per IP across usernames (password spraying)', async () => {
    const ip = '203.0.113.60'
    for (let i = 0; i < 30; i++) {
      const res = await request(api.app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: `test.spray${i}`, password: 'falsch-falsch' })
      expect(res.status).toBe(401)
    }
    const blocked = await request(api.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'test.inhaber', password: TEST_PASSWORD })
    expect(blocked.status).toBe(429)
    expectErrorShape(blocked.body, 'too_many_requests')
  })

  it('successful logins do not count', async () => {
    await createUser({ username: 'test.oft', role: 'verkauf' })
    for (let i = 0; i < 7; i++) {
      const res = await request(api.app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.9')
        .send({ username: 'test.oft', password: TEST_PASSWORD })
      expect(res.status).toBe(200)
    }
  })
})
