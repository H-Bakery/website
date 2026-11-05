/**
 * Sessions, tokens and stations of the pilot auth (roadmap B3, D5, D12).
 *
 * - Access token: JWT (HS256), 1 hour, claims `sub`, `role`, `displayName`,
 *   `sessionKind` ('personal' | 'station'), `sid` (auth_sessions.id),
 *   `type: 'access'`. Every request re-checks the session and the user, so
 *   logout, deactivation and revocation take effect at once, and `req.user`
 *   carries the role from the database, not from the token.
 * - Refresh token: 32 random bytes (`rt_…`), only its SHA-256 is stored in
 *   `refresh_tokens`. Rotated on every refresh; presenting a rotated token
 *   again revokes its whole session (reuse = theft). 14 days, sliding.
 * - Station session: PIN at a registered station, ends hard 12 hours after the
 *   PIN; neither refresh nor access token outlives that.
 * - Station token: long-lived (`st_…`), SHA-256 in `stations`, revocable.
 *
 * Passwords and PINs are scrypt hashes (`auth-crypto.core.js`).
 */
import * as jwt from 'jsonwebtoken'
import { Op, Transaction } from 'sequelize'

import {
  AuthSession,
  RefreshToken,
  Station,
  User,
  getSequelize,
} from '../models'
import type { SessionKind } from '../models/AuthSession'
import { AuthError, AuthUser } from './types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60
export const STATION_SESSION_TTL_SECONDS = 12 * 60 * 60
export const MIN_JWT_SECRET_LENGTH = 32

export const REFRESH_TOKEN_PREFIX = 'rt_'
export const STATION_TOKEN_PREFIX = 'st_'

export interface AuthServiceOptions {
  /** Default `process.env.JWT_SECRET`; at least 32 characters. */
  jwtSecret?: string
  /** Clock in ms (tests). Default `Date.now`. */
  now?: () => number
}

/** User as the API returns it: never a hash. */
export interface PublicUser {
  id: number
  username: string
  displayName: string
  role: string
  active: boolean
  createdAt: Date
  updatedAt: Date
  sessionKind?: SessionKind
}

export interface IssuedSession {
  user: PublicUser
  token: string
  refreshToken: string
  expiresIn: number
  sessionKind: SessionKind
}

interface AccessClaims {
  sub: string
  role: string
  displayName: string
  sessionKind: SessionKind
  sid: number
  type: 'access'
  iat: number
  exp: number
}

const SESSION_EXPIRED = () =>
  new AuthError(
    401,
    'unauthorized',
    'Sitzung abgelaufen. Bitte melden Sie sich erneut an.'
  )

export function publicUser(user: User, kind?: SessionKind): PublicUser {
  const values = user.toJSON() as PublicUser
  const result: PublicUser = {
    id: values.id,
    username: values.username,
    displayName: values.displayName,
    role: values.role,
    active: Boolean(values.active),
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  }
  if (kind) result.sessionKind = kind
  return result
}

export type AuthService = ReturnType<typeof createAuthService>

export function createAuthService(options: AuthServiceOptions = {}) {
  const secret = options.jwtSecret ?? process.env['JWT_SECRET']
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or shorter than ${MIN_JWT_SECRET_LENGTH} characters.`
    )
  }
  const now = options.now ?? Date.now

  // ------------------------------------------------------------ access JWT

  function signAccessToken(
    user: User,
    session: AuthSession
  ): { token: string; expiresIn: number } {
    const nowSec = Math.floor(now() / 1000)
    const sessionEnd = Math.floor(session.expiresAt.getTime() / 1000)
    const exp = Math.max(
      nowSec + 1,
      Math.min(nowSec + ACCESS_TOKEN_TTL_SECONDS, sessionEnd)
    )
    const claims: AccessClaims = {
      sub: String(user.id),
      role: user.role,
      displayName: user.displayName,
      sessionKind: session.kind,
      sid: session.id,
      type: 'access',
      iat: nowSec,
      exp,
    }
    return {
      token: jwt.sign(claims, secret, { algorithm: 'HS256' }),
      expiresIn: exp - nowSec,
    }
  }

  /**
   * Verifies an access token and its session. `null` for every failure
   * (bad signature, expired, revoked or expired session, inactive user).
   */
  async function verifyAccessToken(
    token: string | null | undefined
  ): Promise<AuthUser | null> {
    if (!token) return null
    let claims: AccessClaims
    try {
      claims = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(now() / 1000),
      }) as AccessClaims
    } catch {
      return null
    }
    if (
      !claims ||
      claims.type !== 'access' ||
      !Number.isInteger(claims.sid) ||
      typeof claims.sub !== 'string'
    ) {
      return null
    }
    const session = await AuthSession.findByPk(claims.sid)
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now() ||
      String(session.userId) !== claims.sub
    ) {
      return null
    }
    const user = await User.findByPk(session.userId)
    if (!user || !user.active) return null
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      sessionKind: session.kind,
      sessionId: session.id,
      stationId: session.stationId ?? null,
    }
  }

  // -------------------------------------------------------------- sessions

  function refreshExpiry(session: AuthSession, nowMs: number): Date {
    return new Date(
      Math.min(
        nowMs + REFRESH_TOKEN_TTL_SECONDS * 1000,
        session.expiresAt.getTime()
      )
    )
  }

  async function createRefreshToken(
    session: AuthSession,
    nowMs: number,
    userAgent: string | null,
    transaction: Transaction
  ): Promise<{ raw: string; row: RefreshToken }> {
    const raw = authCrypto.generateToken(REFRESH_TOKEN_PREFIX) as string
    const row = await RefreshToken.create(
      {
        tokenHash: authCrypto.hashToken(raw),
        userId: session.userId,
        sessionId: session.id,
        expiresAt: refreshExpiry(session, nowMs),
        userAgent,
      },
      { transaction }
    )
    return { raw, row }
  }

  /** Starts a session for `user` (inside `transaction`). */
  async function issueSession(
    user: User,
    kind: SessionKind,
    extra: { stationId?: number | null; userAgent?: string | null },
    transaction: Transaction
  ): Promise<IssuedSession> {
    const nowMs = now()
    const ttl =
      kind === 'station'
        ? STATION_SESSION_TTL_SECONDS
        : REFRESH_TOKEN_TTL_SECONDS
    const session = await AuthSession.create(
      {
        userId: user.id,
        kind,
        stationId: extra.stationId ?? null,
        expiresAt: new Date(nowMs + ttl * 1000),
        userAgent: truncate(extra.userAgent),
      },
      { transaction }
    )
    const refresh = await createRefreshToken(
      session,
      nowMs,
      truncate(extra.userAgent),
      transaction
    )
    const access = signAccessToken(user, session)
    return {
      user: publicUser(user, kind),
      token: access.token,
      refreshToken: refresh.raw,
      expiresIn: access.expiresIn,
      sessionKind: kind,
    }
  }

  /** Revokes one session and every refresh token in it. */
  async function revokeSession(
    session: AuthSession,
    reason: string,
    transaction?: Transaction
  ): Promise<void> {
    const at = new Date(now())
    if (!session.revokedAt) {
      session.revokedAt = at
      session.revokeReason = reason
      await session.save({ transaction })
    }
    await RefreshToken.update(
      { revokedAt: at },
      { where: { sessionId: session.id, revokedAt: null }, transaction }
    )
  }

  /**
   * Revokes the user's open sessions (all, or one kind), except `exceptId`.
   * @returns number of sessions revoked
   */
  async function revokeUserSessions(
    userId: number,
    reason: string,
    options: {
      kind?: SessionKind
      exceptSessionId?: number | null
      transaction?: Transaction
    } = {}
  ): Promise<number> {
    const where: Record<string | symbol, unknown> = {
      userId,
      revokedAt: null,
    }
    if (options.kind) where['kind'] = options.kind
    if (options.exceptSessionId) {
      where['id'] = { [Op.ne]: options.exceptSessionId }
    }
    const sessions = await AuthSession.findAll({
      where,
      transaction: options.transaction,
    })
    for (const session of sessions) {
      await revokeSession(session, reason, options.transaction)
    }
    return sessions.length
  }

  /**
   * Rotates a refresh token. A token that was already rotated (or revoked)
   * revokes its whole session and fails with `reuse: true`.
   */
  async function rotateRefreshToken(
    raw: unknown,
    userAgent: string | null
  ): Promise<
    | { ok: true; issued: IssuedSession; userId: number; sessionId: number }
    | { ok: false; reuse: boolean; userId?: number; sessionId?: number }
  > {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) {
      return { ok: false, reuse: false }
    }
    const tokenHash = authCrypto.hashToken(raw) as string
    return getSequelize().transaction(async (transaction) => {
      const nowMs = now()
      const row = await RefreshToken.findOne({
        where: { tokenHash },
        transaction,
      })
      if (!row || !row.sessionId) return { ok: false as const, reuse: false }
      const session = await AuthSession.findByPk(row.sessionId, {
        transaction,
      })
      if (!session) return { ok: false as const, reuse: false }

      if (row.revokedAt) {
        // A rotated token came back: someone holds a copy. End the chain.
        const wasOpen = !session.revokedAt
        await revokeSession(session, 'reuse', transaction)
        return {
          ok: false as const,
          reuse: wasOpen,
          userId: session.userId,
          sessionId: session.id,
        }
      }
      if (
        row.expiresAt.getTime() <= nowMs ||
        session.revokedAt ||
        session.expiresAt.getTime() <= nowMs
      ) {
        return { ok: false as const, reuse: false }
      }
      const user = await User.findByPk(session.userId, { transaction })
      if (!user || !user.active) return { ok: false as const, reuse: false }

      if (session.kind === 'personal') {
        // Sliding: 14 days from the last refresh. Station sessions keep
        // their hard end (12 h after the PIN).
        session.expiresAt = new Date(nowMs + REFRESH_TOKEN_TTL_SECONDS * 1000)
        await session.save({ transaction })
      }
      const next = await createRefreshToken(
        session,
        nowMs,
        truncate(userAgent),
        transaction
      )
      row.revokedAt = new Date(nowMs)
      row.replacedBy = next.row.id
      await row.save({ transaction })

      const access = signAccessToken(user, session)
      return {
        ok: true as const,
        userId: user.id,
        sessionId: session.id,
        issued: {
          user: publicUser(user, session.kind),
          token: access.token,
          refreshToken: next.raw,
          expiresIn: access.expiresIn,
          sessionKind: session.kind,
        },
      }
    })
  }

  // ----------------------------------------------------------- credentials

  /** Password check; `null` for unknown, inactive or wrong (same timing). */
  async function checkPassword(
    username: unknown,
    password: unknown
  ): Promise<User | null> {
    const name = authCrypto.normalizeUsername(username) as string
    const user = name
      ? await User.scope('withSecrets').findOne({ where: { username: name } })
      : null
    const ok = await authCrypto.verifySecret(password, user?.passwordHash)
    return user && ok && user.active ? user : null
  }

  /** PIN check; `null` for unknown, inactive, no PIN or wrong PIN. */
  async function checkPin(userId: unknown, pin: unknown): Promise<User | null> {
    const id = Number(userId)
    const user =
      Number.isInteger(id) && id > 0
        ? await User.scope('withSecrets').findByPk(id)
        : null
    const wellFormed = authCrypto.validatePin(pin) === null
    const ok = await authCrypto.verifySecret(
      wellFormed ? pin : '',
      user?.pinHash
    )
    return user && wellFormed && ok && user.active && user.pinHash ? user : null
  }

  // -------------------------------------------------------------- stations

  async function registerStation(
    name: string,
    createdBy: number | null,
    transaction: Transaction
  ): Promise<{ station: Station; token: string }> {
    const token = authCrypto.generateToken(STATION_TOKEN_PREFIX) as string
    const station = await Station.create(
      { name, tokenHash: authCrypto.hashToken(token), createdBy },
      { transaction }
    )
    return { station, token }
  }

  async function findStationByToken(
    token: string | null | undefined
  ): Promise<Station | null> {
    if (!token || token.length > 200) return null
    return Station.findOne({
      where: { tokenHash: authCrypto.hashToken(token), revokedAt: null },
    })
  }

  /** Revokes a station and ends every session started at it. */
  async function revokeStation(
    station: Station,
    transaction: Transaction
  ): Promise<number> {
    if (!station.revokedAt) {
      station.revokedAt = new Date(now())
      await station.save({ transaction })
    }
    const sessions = await AuthSession.findAll({
      where: { stationId: station.id, revokedAt: null },
      transaction,
    })
    for (const session of sessions) {
      await revokeSession(session, 'station_revoked', transaction)
    }
    return sessions.length
  }

  return {
    now,
    signAccessToken,
    verifyAccessToken,
    issueSession,
    revokeSession,
    revokeUserSessions,
    rotateRefreshToken,
    checkPassword,
    checkPin,
    registerStation,
    findStationByToken,
    revokeStation,
  }
}

function truncate(value: string | null | undefined, max = 255): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value.length > max ? value.slice(0, max) : value
}
