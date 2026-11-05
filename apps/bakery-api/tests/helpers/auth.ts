/**
 * Accounts and sessions for integration tests (B3). Synthetic users only.
 *
 *   const owner = await createUser({ username: 'test.inhaber', role: 'inhaber' })
 *   const { token } = await login(api.app, 'test.inhaber')
 *   await request(api.app).get('/api/partners').set(bearer(token))
 *
 * Every `/api` route except login/refresh/pin/station-users needs a session,
 * so tests of other domains log in first.
 */
import type { Application } from 'express'
import request from 'supertest'

import { User } from '../../src/models'
import type { UserRole } from '../../src/models/User'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../../src/services/auth-crypto.core')

export const TEST_PASSWORD = 'Test-Passwort-2026'

export async function createUser(options: {
  username: string
  role: UserRole
  displayName?: string
  password?: string
  pin?: string | null
  active?: boolean
}): Promise<User> {
  return User.create({
    username: options.username,
    displayName: options.displayName ?? `Test ${options.username}`,
    role: options.role,
    passwordHash: await authCrypto.hashSecret(
      options.password ?? TEST_PASSWORD
    ),
    pinHash: options.pin ? await authCrypto.hashSecret(options.pin) : null,
    active: options.active ?? true,
  })
}

export interface LoggedIn {
  token: string
  refreshToken: string
  expiresIn: number
  user: Record<string, unknown>
}

export async function login(
  app: Application,
  username: string,
  password: string = TEST_PASSWORD
): Promise<LoggedIn> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password })
  if (res.status !== 200) {
    throw new Error(`login ${username} failed: ${res.status} ${res.text}`)
  }
  return res.body.data as LoggedIn
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/** Creates a user and logs in; returns the access token. */
export async function sessionFor(
  app: Application,
  username: string,
  role: UserRole
): Promise<string> {
  await createUser({ username, role })
  return (await login(app, username)).token
}
