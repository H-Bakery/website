/**
 * B3 user administration (`/api/users`, inhaber only). Synthetic users only.
 */
import request from 'supertest'

import { AuditLog, User } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { TEST_PASSWORD, bearer, createUser, login } from '../helpers/auth'

jest.setTimeout(30000)

let api: TestApp
let owner: { token: string; id: number }

beforeAll(async () => {
  api = await createTestApp()
  const user = await createUser({ username: 'test.inhaber', role: 'inhaber' })
  owner = { token: (await login(api.app, 'test.inhaber')).token, id: user.id }
})

afterAll(async () => {
  await api.close()
})

const asOwner = {
  get: (path: string) => request(api.app).get(path).set(bearer(owner.token)),
  post: (path: string) => request(api.app).post(path).set(bearer(owner.token)),
  patch: (path: string) =>
    request(api.app).patch(path).set(bearer(owner.token)),
}

function expectNoSecrets(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(
    /passwordHash|pinHash|password_hash|pin_hash|scrypt\$/
  )
}

describe('POST /api/users', () => {
  it('creates a user, with optional PIN, never returning hashes', async () => {
    const res = await asOwner.post('/api/users').send({
      username: 'Test.Neu',
      displayName: '  Neue  Kraft ',
      role: 'verkauf',
      password: 'Anfang-2026!',
      pin: '0815',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      username: 'test.neu',
      displayName: 'Neue Kraft',
      role: 'verkauf',
      active: true,
      hasPin: true,
    })
    expectNoSecrets(res.body)
    expect((await login(api.app, 'test.neu', 'Anfang-2026!')).token).toEqual(
      expect.any(String)
    )
    const row = await AuditLog.findOne({
      where: {
        action: 'create',
        entity: 'user',
        entityId: String(res.body.data.id),
      },
    })
    expect(row?.userId).toBe(owner.id)
    expectNoSecrets(row?.data)
  })

  it('400 for control or bidi characters in the display name (W4-verify r2)', async () => {
    for (const displayName of ['Vera\u0000', 'Vera\u202eX']) {
      const res = await asOwner.post('/api/users').send({
        username: 'test.steuer',
        displayName,
        role: 'verkauf',
        password: 'Anfang-2026!',
      })
      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/Steuerzeichen/)
    }
  })

  it('409 for an existing username (case-insensitive)', async () => {
    const res = await asOwner.post('/api/users').send({
      username: 'TEST.NEU',
      displayName: 'Doppelt',
      role: 'verkauf',
      password: 'Anfang-2026!',
    })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'username_taken' })
    expect(typeof res.body.message).toBe('string')
  })

  it.each([
    [
      {
        username: 'x',
        displayName: 'X',
        role: 'verkauf',
        password: 'Anfang-2026!',
      },
    ],
    [
      {
        username: 'test.a',
        displayName: '',
        role: 'verkauf',
        password: 'Anfang-2026!',
      },
    ],
    [
      {
        username: 'test.a',
        displayName: 'A',
        role: 'admin',
        password: 'Anfang-2026!',
      },
    ],
    [
      {
        username: 'test.a',
        displayName: 'A',
        role: 'verkauf',
        password: 'kurz',
      },
    ],
    [
      {
        username: 'test.a',
        displayName: 'A',
        role: 'verkauf',
        password: 'Anfang-2026!',
        pin: '12',
      },
    ],
    [
      {
        username: 'test.a',
        displayName: 'A',
        role: 'verkauf',
        password: 'Anfang-2026!',
        pin: 1234,
      },
    ],
  ])('400 for invalid input %#', async (body) => {
    const res = await asOwner.post('/api/users').send(body)
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'validation' })
    expect(typeof res.body.message).toBe('string')
  })
})

describe('GET /api/users', () => {
  it('lists users with hasPin, without hashes', async () => {
    const res = await asOwner.get('/api/users')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        username: expect.any(String),
        displayName: expect.any(String),
        role: expect.any(String),
        active: expect.any(Boolean),
        hasPin: expect.any(Boolean),
      })
    )
    expectNoSecrets(res.body)
  })

  it.each(['verkauf', 'backstube', 'fahrer'] as const)(
    '%s gets 403',
    async (role) => {
      await createUser({ username: `test.rolle.${role}`, role })
      const { token } = await login(api.app, `test.rolle.${role}`)
      const res = await request(api.app).get('/api/users').set(bearer(token))
      expect(res.status).toBe(403)
      const post = await request(api.app)
        .post('/api/users')
        .set(bearer(token))
        .send({})
      expect(post.status).toBe(403)
    }
  )
})

describe('PATCH /api/users/:id', () => {
  it('changes displayName and role and audits the diff', async () => {
    const user = await createUser({ username: 'test.patch', role: 'verkauf' })
    const res = await asOwner
      .patch(`/api/users/${user.id}`)
      .send({ displayName: 'Neu Benannt', role: 'backstube' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      displayName: 'Neu Benannt',
      role: 'backstube',
    })
    const row = await AuditLog.findOne({
      where: { action: 'update', entityId: String(user.id) },
    })
    expect(row?.data).toEqual({
      changes: {
        displayName: { from: 'Test test.patch', to: 'Neu Benannt' },
        role: { from: 'verkauf', to: 'backstube' },
      },
    })
  })

  it('deactivating ends the sessions; reactivating allows login again; the row stays', async () => {
    const user = await createUser({ username: 'test.weg', role: 'fahrer' })
    const session = await login(api.app, 'test.weg')
    const res = await asOwner
      .patch(`/api/users/${user.id}`)
      .send({ active: false })
    expect(res.status).toBe(200)
    expect(res.body.data.active).toBe(false)
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
    expect(
      (
        await request(api.app)
          .post('/api/auth/login')
          .send({ username: 'test.weg', password: TEST_PASSWORD })
      ).status
    ).toBe(401)
    expect(await User.findByPk(user.id)).not.toBeNull()

    await asOwner.patch(`/api/users/${user.id}`).send({ active: true })
    expect((await login(api.app, 'test.weg')).token).toEqual(expect.any(String))
  })

  it('refuses to deactivate the own account', async () => {
    const res = await asOwner
      .patch(`/api/users/${owner.id}`)
      .send({ active: false })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'validation' })
  })

  it('keeps at least one active inhaber', async () => {
    const res = await asOwner
      .patch(`/api/users/${owner.id}`)
      .send({ role: 'verkauf' })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'last_inhaber' })
    expect(typeof res.body.message).toBe('string')

    // With a second inhaber the demotion of the first one is allowed.
    const second = await createUser({
      username: 'test.inhaber2',
      role: 'inhaber',
    })
    const demote = await asOwner
      .patch(`/api/users/${second.id}`)
      .send({ role: 'verkauf' })
    expect(demote.status).toBe(200)
  })

  it('400 for nothing to change or bad values, 404 for unknown ids', async () => {
    expect(
      (await asOwner.patch(`/api/users/${owner.id}`).send({})).status
    ).toBe(400)
    expect(
      (await asOwner.patch(`/api/users/${owner.id}`).send({ active: 'ja' }))
        .status
    ).toBe(400)
    expect(
      (await asOwner.patch(`/api/users/${owner.id}`).send({ role: 'chef' }))
        .status
    ).toBe(400)
    const missing = await asOwner
      .patch('/api/users/9999')
      .send({ active: true })
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ error: 'not_found' })
    expect(
      (await asOwner.patch('/api/users/abc').send({ active: true })).status
    ).toBe(404)
  })

  it('never deletes users', async () => {
    const user = await createUser({ username: 'test.bleibt', role: 'verkauf' })
    const res = await request(api.app)
      .delete(`/api/users/${user.id}`)
      .set(bearer(owner.token))
    expect(res.status).toBe(404)
    expect(await User.findByPk(user.id)).not.toBeNull()
  })
})

describe('POST /api/users/:id/password', () => {
  it('sets a new password and ends the user’s other sessions', async () => {
    const user = await createUser({ username: 'test.pw', role: 'verkauf' })
    const old = await login(api.app, 'test.pw')
    const res = await asOwner
      .post(`/api/users/${user.id}/password`)
      .send({ password: 'Ganz-Neu-2026' })
    expect(res.status).toBe(200)
    expectNoSecrets(res.body)
    expect(
      (await request(api.app).get('/api/auth/me').set(bearer(old.token))).status
    ).toBe(401)
    expect(
      (
        await request(api.app)
          .post('/api/auth/login')
          .send({ username: 'test.pw', password: TEST_PASSWORD })
      ).status
    ).toBe(401)
    expect((await login(api.app, 'test.pw', 'Ganz-Neu-2026')).token).toEqual(
      expect.any(String)
    )
    expect(
      await AuditLog.count({
        where: { action: 'set_password', entityId: String(user.id) },
      })
    ).toBe(1)
  })

  it('an inhaber changing the own password keeps the current session', async () => {
    const res = await asOwner
      .post(`/api/users/${owner.id}/password`)
      .send({ password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect((await asOwner.get('/api/auth/me')).status).toBe(200)
  })

  it('400 for a short password', async () => {
    const res = await asOwner
      .post(`/api/users/${owner.id}/password`)
      .send({ password: '123' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'validation' })
  })
})

describe('POST /api/users/:id/pin', () => {
  it('sets and clears the PIN', async () => {
    const user = await createUser({ username: 'test.pin', role: 'backstube' })
    const set = await asOwner
      .post(`/api/users/${user.id}/pin`)
      .send({ pin: '004711' })
    expect(set.status).toBe(200)
    expect(set.body.data.hasPin).toBe(true)
    expectNoSecrets(set.body)
    const row = await User.scope('withSecrets').findByPk(user.id)
    expect(row?.pinHash).toMatch(/^scrypt\$/)

    const clear = await asOwner
      .post(`/api/users/${user.id}/pin`)
      .send({ pin: null })
    expect(clear.status).toBe(200)
    expect(clear.body.data.hasPin).toBe(false)
    const actions = (
      await AuditLog.findAll({
        where: { entityId: String(user.id) },
        order: [['id', 'ASC']],
      })
    ).map((r) => r.action)
    expect(actions).toEqual(['set_pin', 'clear_pin'])
  })

  it('400 for a malformed or missing PIN', async () => {
    for (const body of [{ pin: '12' }, { pin: 1234 }, {}]) {
      const res = await asOwner.post(`/api/users/${owner.id}/pin`).send(body)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'validation' })
    }
  })
})
