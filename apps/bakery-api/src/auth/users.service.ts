/**
 * User accounts outside the HTTP layer (B3): the `create-user` CLI, the
 * development bootstrap admin, and the admin view of a user.
 *
 * Users are deactivated, never deleted (preorders, visits and the audit log
 * point at them). Hashes never leave this module: `adminUser()` returns
 * `hasPin` instead of the PIN hash.
 */
import { Transaction } from 'sequelize'

import { AuthSession, RefreshToken, User, getSequelize } from '../models'
import type { UserRole } from '../models/User'
import { audit } from './audit'
import { PublicUser, publicUser } from './auth.service'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')

export interface AdminUser extends PublicUser {
  hasPin: boolean
}

/** A user as the admin endpoints return it. Needs a `withSecrets` row for `hasPin`. */
export function adminUser(user: User): AdminUser {
  return { ...publicUser(user), hasPin: Boolean(user.pinHash) }
}

export class UserInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserInputError'
  }
}

export interface UpsertUserInput {
  username: string
  displayName: string
  role: string
  password: string
  /** Optional station PIN (4-6 digits); undefined = leave as is. */
  pin?: string
}

/** Validates the input; throws `UserInputError` with a German message. */
export function validateUserInput(input: UpsertUserInput): void {
  const errors = [
    authCrypto.validateUsername(input.username),
    authCrypto.validateDisplayName(input.displayName),
    authCrypto.validateRole(input.role),
    authCrypto.validatePassword(input.password),
    input.pin === undefined ? null : authCrypto.validatePin(input.pin),
  ].filter(Boolean)
  if (errors.length > 0) throw new UserInputError(errors.join(' '))
}

/**
 * Revokes every open session of a user directly on the tables (for the CLI,
 * which has no auth service / JWT secret).
 */
async function revokeAllSessions(
  userId: number,
  reason: string,
  transaction: Transaction
): Promise<void> {
  const at = new Date()
  const sessions = await AuthSession.findAll({
    where: { userId, revokedAt: null },
    transaction,
  })
  for (const session of sessions) {
    session.revokedAt = at
    session.revokeReason = reason
    await session.save({ transaction })
    await RefreshToken.update(
      { revokedAt: at },
      { where: { sessionId: session.id, revokedAt: null }, transaction }
    )
  }
}

/**
 * Idempotent create-or-reset (CLI `create-user`): a new user is created; an
 * existing one (active or deactivated) gets the given display name, role and
 * password, is reactivated and loses its open sessions. Audited with
 * `userId = null` (`cli_create` / `cli_reset`).
 */
export async function upsertUser(
  input: UpsertUserInput,
  options: { origin?: 'cli' | 'bootstrap' } = {}
): Promise<{ user: AdminUser; created: boolean }> {
  validateUserInput(input)
  const origin = options.origin ?? 'cli'
  const username = authCrypto.normalizeUsername(input.username) as string
  const displayName = authCrypto.normalizeDisplayName(
    input.displayName
  ) as string
  const role = input.role as UserRole
  const passwordHash = (await authCrypto.hashSecret(input.password)) as string
  const pinHash =
    input.pin === undefined
      ? undefined
      : ((await authCrypto.hashSecret(input.pin)) as string)

  return getSequelize().transaction(async (transaction) => {
    const existing = await User.scope('withSecrets').findOne({
      where: { username },
      transaction,
    })
    if (existing) {
      existing.displayName = displayName
      existing.role = role
      existing.passwordHash = passwordHash
      if (pinHash !== undefined) existing.pinHash = pinHash
      existing.active = true
      await existing.save({ transaction })
      await revokeAllSessions(existing.id, 'password', transaction)
      await audit(
        null,
        `${origin}_reset`,
        'user',
        existing.id,
        { role, pinSet: pinHash !== undefined },
        { userId: null, transaction }
      )
      return { user: adminUser(existing), created: false }
    }
    const user = await User.create(
      {
        username,
        displayName,
        role,
        passwordHash,
        pinHash: pinHash ?? null,
        active: true,
      },
      { transaction }
    )
    await audit(
      null,
      `${origin}_create`,
      'user',
      user.id,
      { role, pinSet: pinHash !== undefined },
      { userId: null, transaction }
    )
    // `User.create()` returns the instance with the hashes set.
    return { user: adminUser(user), created: true }
  })
}

/**
 * Development convenience: with `NODE_ENV !== 'production'` and both
 * `BOOTSTRAP_ADMIN_USER` / `BOOTSTRAP_ADMIN_PASSWORD` set, creates that
 * `inhaber` if no user of that name exists. Never resets an existing user,
 * never runs in production.
 */
export async function bootstrapAdmin(
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Console, 'log' | 'warn'> = console
): Promise<'created' | 'exists' | 'skipped'> {
  const username = env['BOOTSTRAP_ADMIN_USER']
  const password = env['BOOTSTRAP_ADMIN_PASSWORD']
  if (!username && !password) return 'skipped'
  if (env['NODE_ENV'] === 'production') {
    log.warn(
      '[WARN] BOOTSTRAP_ADMIN_* is ignored in production - create accounts with the create-user CLI.'
    )
    return 'skipped'
  }
  if (!username || !password) {
    log.warn(
      '[WARN] BOOTSTRAP_ADMIN_USER and BOOTSTRAP_ADMIN_PASSWORD must both be set; no bootstrap admin created.'
    )
    return 'skipped'
  }
  const name = authCrypto.normalizeUsername(username) as string
  const existing = await User.findOne({ where: { username: name } })
  if (existing) return 'exists'
  const input: UpsertUserInput = {
    username: name,
    displayName: 'Inhaber (Entwicklung)',
    role: 'inhaber',
    password,
  }
  try {
    validateUserInput(input)
  } catch (error) {
    log.warn(`[WARN] Bootstrap admin not created: ${(error as Error).message}`)
    return 'skipped'
  }
  await upsertUser(input, { origin: 'bootstrap' })
  log.log(`[INFO] Bootstrap admin "${name}" created (development only).`)
  return 'created'
}
