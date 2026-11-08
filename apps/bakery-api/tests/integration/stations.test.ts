/**
 * B3 stations (D5): an inhaber registers a shared device, staff switch in
 * there by PIN. Station sessions end 12 hours after the PIN. The clock is
 * injected through `createApp({ auth: { now } })`. Synthetic users only.
 */
import * as jwt from 'jsonwebtoken'
import request from 'supertest'

import { AuditLog, Station } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, createUser, login } from '../helpers/auth'

jest.setTimeout(30000)

const HOUR = 60 * 60 * 1000
let clock = Date.now()
let api: TestApp
let ownerToken: string
let stationToken: string
let stationId: number
const ids: Record<string, number> = {}

beforeAll(async () => {
  api = await createTestApp({ app: { auth: { now: () => clock } } })
  ids['inhaber'] = (
    await createUser({ username: 'test.inhaber', role: 'inhaber', pin: '9999' })
  ).id
  ids['laden'] = (
    await createUser({
      username: 'test.laden',
      role: 'verkauf',
      displayName: 'Laden Test',
      pin: '0420',
    })
  ).id
  ids['ohnepin'] = (
    await createUser({ username: 'test.ohnepin', role: 'backstube' })
  ).id
  ids['inaktiv'] = (
    await createUser({
      username: 'test.inaktiv',
      role: 'verkauf',
      pin: '1111',
      active: false,
    })
  ).id
  ownerToken = (await login(api.app, 'test.inhaber')).token
})

afterAll(async () => {
  await api.close()
})

describe('registering stations', () => {
  it('an inhaber registers a station and gets its token once', async () => {
    const res = await request(api.app)
      .post('/api/auth/stations')
      .set(bearer(ownerToken))
      .send({ name: '  Laden-Tablet ' })
    expect(res.status).toBe(201)
    expect(res.body.data.token).toMatch(/^st_[A-Za-z0-9_-]{43}$/)
    expect(res.body.data.station).toMatchObject({
      name: 'Laden-Tablet',
      revokedAt: null,
      createdBy: ids['inhaber'],
    })
    expect(res.body.data.station).not.toHaveProperty('tokenHash')
    stationToken = res.body.data.token
    stationId = res.body.data.station.id

    const row = await Station.findByPk(stationId)
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.tokenHash).not.toBe(stationToken)
    expect(
      await AuditLog.count({ where: { action: 'register', entity: 'station' } })
    ).toBe(1)
  })

  it('lists stations without token hashes', async () => {
    const res = await request(api.app)
      .get('/api/auth/stations')
      .set(bearer(ownerToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toMatch(/tokenHash|token_hash/)
  })

  it('other roles get 403, no session 401, no name 400', async () => {
    const verkauf = await login(api.app, 'test.laden')
    const forbidden = await request(api.app)
      .post('/api/auth/stations')
      .set(bearer(verkauf.token))
      .send({ name: 'Mein Handy' })
    expect(forbidden.status).toBe(403)
    expect(
      (await request(api.app).post('/api/auth/stations').send({ name: 'x' }))
        .status
    ).toBe(401)
    const bad = await request(api.app)
      .post('/api/auth/stations')
      .set(bearer(ownerToken))
      .send({ name: '   ' })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'validation' })
    // W4-verify r3: control and bidi characters, like display names
    for (const name of ['Nul\u0000Station\u0007', 'Teststation\u202e']) {
      const res = await request(api.app)
        .post('/api/auth/stations')
        .set(bearer(ownerToken))
        .send({ name })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        error: 'INVALID_TEXT',
        message: 'Der Name der Station enthält unzulässige Steuerzeichen.',
      })
    }
  })
})

describe('GET /api/auth/station/users', () => {
  it('needs a valid station token (403 otherwise)', async () => {
    for (const header of [undefined, 'st_falsch', ownerToken]) {
      const call = request(api.app).get('/api/auth/station/users')
      const res = header
        ? await call.set('X-Station-Token', header)
        : await call
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'station_required' })
      expect(typeof res.body.message).toBe('string')
    }
  })

  it('lists active users with a PIN: id, displayName, role only', async () => {
    const res = await request(api.app)
      .get('/api/auth/station/users')
      .set('X-Station-Token', stationToken)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      { id: ids['laden'], displayName: 'Laden Test', role: 'verkauf' },
      { id: ids['inhaber'], displayName: 'Test test.inhaber', role: 'inhaber' },
    ])
  })
})

describe('POST /api/auth/pin', () => {
  it('without a station token -> 403', async () => {
    const res = await request(api.app)
      .post('/api/auth/pin')
      .send({ userId: ids['laden'], pin: '0420' })
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'station_required' })
  })

  it.each([
    ['wrong PIN', () => ids['laden'], '0421'],
    ['user without PIN', () => ids['ohnepin'], '0420'],
    ['deactivated user', () => ids['inaktiv'], '1111'],
    ['unknown user', () => 4242, '0420'],
    ['malformed PIN', () => ids['laden'], '42'],
  ])('%s -> 401', async (_case, userId, pin) => {
    const res = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200)}`)
      .send({ userId: userId(), pin })
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'invalid_pin' })
    expect(typeof res.body.message).toBe('string')
  })

  it('a PIN given as a number is a 400 (leading zeros would be lost)', async () => {
    const res = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .send({ userId: ids['laden'], pin: 420 })
    expect(res.status).toBe(400)
  })

  it('a userId in any other spelling than the canonical one is a 400', async () => {
    const id = ids['laden']
    for (const userId of [
      `0${id}`,
      `00${id}`,
      ` ${id}`,
      `${id}.0`,
      `${id}e0`,
      `0x${id.toString(16)}`,
      id + 0.5,
      0,
      null,
      undefined,
      [id],
    ]) {
      const res = await request(api.app)
        .post('/api/auth/pin')
        .set('X-Station-Token', stationToken)
        .send({ userId, pin: '0420' })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'validation' })
      expect(typeof res.body.message).toBe('string')
    }
    // The canonical string form is accepted.
    const ok = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .send({ userId: String(id), pin: '0420' })
    expect(ok.status).toBe(200)
  })

  it('a PIN session cannot administer users or stations, even as inhaber', async () => {
    const pin = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .send({ userId: ids['inhaber'], pin: '9999' })
    expect(pin.status).toBe(200)
    const token = pin.body.data.token
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(token))).status
    ).toBe(200)
    for (const call of [
      request(api.app).get('/api/users'),
      request(api.app).get('/api/auth/stations'),
      request(api.app).post('/api/auth/stations').send({ name: 'Heimlich' }),
      request(api.app).delete(`/api/auth/stations/${stationId}`),
    ]) {
      const res = await call.set(bearer(token))
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'personal_session_required' })
      expect(typeof res.body.message).toBe('string')
    }
    expect((await Station.findByPk(stationId))?.revokedAt).toBeNull()
  })

  it('opens a station session that ends 12 h after the PIN', async () => {
    const start = clock
    const res = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .send({ userId: ids['laden'], pin: '0420' })
    expect(res.status).toBe(200)
    expect(res.body.data.sessionKind).toBe('station')
    expect(res.body.data.user).toMatchObject({
      id: ids['laden'],
      sessionKind: 'station',
    })
    const claims = jwt.decode(res.body.data.token) as Record<string, number>
    expect(claims['sessionKind']).toBe('station')

    const me = await request(api.app)
      .get('/api/auth/me')
      .set(bearer(res.body.data.token))
    expect(me.body.data).toMatchObject({
      sessionKind: 'station',
      stationId,
    })
    expect((await Station.findByPk(stationId))?.lastUsedAt).not.toBeNull()

    // 11.5 h later: refresh works, but the new access token ends with the
    // session (30 min left), not one hour later.
    clock = start + 11.5 * HOUR
    const refreshed = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: res.body.data.refreshToken })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.data.expiresIn).toBeLessThanOrEqual(30 * 60)
    expect(refreshed.body.data.expiresIn).toBeGreaterThan(29 * 60)

    // 12 h after the PIN: everything is over.
    clock = start + 12 * HOUR + 1000
    const late = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshed.body.data.refreshToken })
    expect(late.status).toBe(401)
    expect(
      (
        await request(api.app)
          .get('/api/auth/me')
          .set(bearer(refreshed.body.data.token))
      ).status
    ).toBe(401)
    clock = start
  })

  it('personal sessions keep sliding past 12 h', async () => {
    const start = clock
    const personal = await login(api.app, 'test.laden')
    clock = start + 13 * HOUR
    const res = await request(api.app)
      .post('/api/auth/refresh')
      .send({ refreshToken: personal.refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.data.expiresIn).toBe(3600)
    clock = start
  })

  it('rate limit: 5 wrong PINs per IP + user -> 429', async () => {
    const attempt = (pin: string) =>
      request(api.app)
        .post('/api/auth/pin')
        .set('X-Station-Token', stationToken)
        .set('X-Forwarded-For', '198.51.100.250')
        .send({ userId: ids['inhaber'], pin })
    for (let i = 0; i < 5; i++) {
      expect((await attempt('0000')).status).toBe(401)
    }
    const blocked = await attempt('9999')
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ error: 'too_many_requests' })
    expect(typeof blocked.body.message).toBe('string')

    // Another spelling of the same id opens no fresh counter: the canonical
    // string shares the key, everything else is refused before the limiter.
    const id = ids['inhaber']
    const spell = (userId: unknown) =>
      request(api.app)
        .post('/api/auth/pin')
        .set('X-Station-Token', stationToken)
        .set('X-Forwarded-For', '198.51.100.250')
        .send({ userId, pin: '9999' })
    expect((await spell(String(id))).status).toBe(429)
    for (const userId of [
      `0${id}`,
      `000${id}`,
      ` ${id}`,
      `${id}.0`,
      `${id}e0`,
    ]) {
      expect((await spell(userId)).status).toBe(400)
    }
  })

  it('rate limit: 10 wrong PINs per user from any IPs -> 429', async () => {
    const target = await createUser({
      username: 'test.pinziel',
      role: 'verkauf',
      pin: '5555',
    })
    const attempt = (pin: string, ip: string) =>
      request(api.app)
        .post('/api/auth/pin')
        .set('X-Station-Token', stationToken)
        .set('X-Forwarded-For', ip)
        .send({ userId: target.id, pin })
    for (let i = 0; i < 10; i++) {
      expect((await attempt('0000', `192.0.2.${i + 1}`)).status).toBe(401)
    }
    const blocked = await attempt('5555', '192.0.2.99')
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ error: 'too_many_requests' })
    // Other users at the station are not affected.
    const other = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .set('X-Forwarded-For', '192.0.2.99')
      .send({ userId: ids['laden'], pin: '0420' })
    expect(other.status).toBe(200)
  })
})

describe('revoking a station', () => {
  it('ends its sessions and refuses its token', async () => {
    const pin = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', stationToken)
      .send({ userId: ids['laden'], pin: '0420' })
    expect(pin.status).toBe(200)

    const res = await request(api.app)
      .delete(`/api/auth/stations/${stationId}`)
      .set(bearer(ownerToken))
    expect(res.status).toBe(200)
    expect(res.body.data.revokedAt).not.toBeNull()

    expect(
      (
        await request(api.app)
          .get('/api/auth/me')
          .set(bearer(pin.body.data.token))
      ).status
    ).toBe(401)
    expect(
      (
        await request(api.app)
          .get('/api/auth/station/users')
          .set('X-Station-Token', stationToken)
      ).status
    ).toBe(403)
    // The owner's personal session is untouched.
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(ownerToken)))
        .status
    ).toBe(200)
  })

  it('unknown station -> 404', async () => {
    const res = await request(api.app)
      .delete('/api/auth/stations/999')
      .set(bearer(ownerToken))
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'not_found' })
  })
})
