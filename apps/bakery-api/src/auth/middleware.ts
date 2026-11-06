/**
 * Guards of the pilot API (B3, D5).
 *
 *   requireAuth(service)     global on /api (app.ts): Bearer access token ->
 *                            `req.user`, else 401
 *   requireRole(...roles)    403 unless `req.user.role` is one of `roles`;
 *                            `inhaber` passes every check; 401 without a user
 *   requireStation(service)  header `X-Station-Token` -> `req.station`, else 403
 *   loginRateLimit(...)      failed attempts / 5 min per IP + account, per IP,
 *                            per account -> 429
 *   requirePersonalSession   403 for station (PIN) sessions
 *
 * Routers mounted after the global guard need only `requireRole`.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ipKeyGenerator } from 'express-rate-limit'

import { sendError } from '../utils/http-error'
import type { AuthService } from './auth.service'
import { AuthError, UserRole } from './types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')

export const STATION_TOKEN_HEADER = 'x-station-token'

export const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
export const LOGIN_RATE_LIMIT_MAX = 5
/** Failed attempts per IP across all accounts (password spraying). */
export const LOGIN_RATE_LIMIT_IP_MAX = 30
/** Failed PIN attempts per user across all IPs. */
export const PIN_RATE_LIMIT_USER_MAX = 10

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  return match ? match[1] : null
}

export function sendUnauthorized(res: Response): Response {
  return sendError(res, 401, 'unauthorized', 'Bitte melden Sie sich an.')
}

/** Express 4 does not catch rejected promises; this forwards them. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((error) => {
      if (error instanceof AuthError) {
        sendError(res, error.status, error.code, error.message)
        return
      }
      next(error)
    })
  }
}

export function requireAuth(service: AuthService): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const user = await service.verifyAccessToken(bearerToken(req))
    if (!user) {
      sendUnauthorized(res)
      return
    }
    req.user = user
    next()
  })
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      sendUnauthorized(res)
      return
    }
    if (!authCrypto.roleAllows(req.user.role, roles)) {
      sendError(
        res,
        403,
        'forbidden',
        'Für diese Aktion fehlt die Berechtigung.'
      )
      return
    }
    next()
  }
}

/**
 * Administration (users, stations) needs a personal session: a PIN on a
 * shared tablet must not unlock it, even for an `inhaber`.
 */
export const requirePersonalSession: RequestHandler = (req, res, next) => {
  if (!req.user) {
    sendUnauthorized(res)
    return
  }
  if (req.user.sessionKind !== 'personal') {
    sendError(
      res,
      403,
      'personal_session_required',
      'Diese Verwaltung ist an einer Station nicht verfügbar. Bitte mit Benutzername und Passwort anmelden.'
    )
    return
  }
  next()
}

export function requireStation(service: AuthService): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const raw = req.headers[STATION_TOKEN_HEADER]
    const token = typeof raw === 'string' ? raw.trim() : null
    const station = await service.findStationByToken(token)
    if (!station) {
      sendError(
        res,
        403,
        'station_required',
        'Dieses Gerät ist nicht als Station eingerichtet. Bitte mit Benutzername und Passwort anmelden.'
      )
      return
    }
    req.station = station
    next()
  })
}

interface LimitEntry {
  /** Failed attempts in the current window. */
  failures: number
  /** End of the window (ms); starts with the first failure. */
  resetAt: number
  /** Attempts admitted but not answered yet. */
  pending: number
  /** Requests waiting until a pending attempt is answered. */
  waiters: Array<() => void>
}

/** Longest a login waits for a slot before it gets a 429 (W4). */
export const LOGIN_WAIT_MAX_MS = 5000
/** An aborted attempt whose handler never answers counts as failed after this. */
export const LOGIN_ABORT_GRACE_MS = 30_000

const RELEASES = Symbol('loginRateLimitReleases')

/** Per request: how the outer limiters of a stack free their slot. */
function releasesOf(req: Request): Array<() => void> {
  const holder = req as unknown as Record<symbol, Array<() => void>>
  if (!holder[RELEASES]) holder[RELEASES] = []
  return holder[RELEASES]
}

/** Above this many keys, expired idle entries are swept on the next hit. */
const LIMIT_SWEEP_AT = 10_000

/**
 * Brute-force brake for login and PIN: `max` **failed** attempts per window.
 * The counter key is `keyOf(req)` (the account: username or canonical user
 * id), prefixed with the client IP unless `perIp: false`; without `keyOf`
 * the limit is per IP alone. Each `createApp()` gets its own in-memory store.
 *
 * Only failures count (W4). express-rate-limit's `skipSuccessfulRequests`
 * counted every attempt on arrival and took successful ones back only after
 * the answer, so parallel *successful* logins (a few tablets, the E2E
 * workers) ran into 429 - and each 429 then counted as a failure. Here an
 * attempt is admitted while `failures + pending < max`; otherwise it waits
 * until a pending one is answered (scrypt: tens of ms) and is checked again.
 * So in-flight attempts can never push the failures past `max` (no burst of
 * parallel guesses), and successful ones never block anyone. An answer with
 * status ≥ 400 counts as a failure, except a 429 from another limiter of the
 * stack - that request never tried a password.
 *
 * Aborted requests never wedge a key: a waiting request whose client goes
 * away leaves the queue and frees the slots the outer limiters gave it
 * (no failure - it never reached a password check); a woken request whose
 * client is gone is never handed on. An admitted attempt settles when the
 * handler answers (`res.end`, even on a dead socket), so an aborted wrong
 * guess still counts. Nobody waits longer than `LOGIN_WAIT_MAX_MS` (then 429
 * with Retry-After).
 *
 * The routes stack several of these (see `auth.routes.ts`): per IP + account
 * (5), per IP across all accounts (30, against password spraying) and, for
 * the PIN, per account across all IPs (10 - a 4-digit PIN space is tiny).
 */
export function loginRateLimit(options: {
  /** Which account the attempt names; omitted = per IP only. */
  keyOf?: (req: Request) => string
  /** Prefix the key with the client IP (default true). */
  perIp?: boolean
  windowMs?: number
  max?: number
  /** Tests only: LOGIN_WAIT_MAX_MS / LOGIN_ABORT_GRACE_MS. */
  waitMs?: number
  abortGraceMs?: number
}): RequestHandler {
  const waitMs = options.waitMs ?? LOGIN_WAIT_MAX_MS
  const abortGraceMs = options.abortGraceMs ?? LOGIN_ABORT_GRACE_MS
  const perIp = options.perIp !== false
  const windowMs = options.windowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS
  const max = options.max ?? LOGIN_RATE_LIMIT_MAX
  const entries = new Map<string, LimitEntry>()

  const keyFor = (req: Request) =>
    [
      perIp ? `ip:${ipKeyGenerator(req.ip ?? 'unknown')}` : '',
      options.keyOf ? options.keyOf(req) : '',
    ]
      .filter(Boolean)
      .join('|')

  const idle = (e: LimitEntry, now: number) =>
    e.pending === 0 &&
    e.waiters.length === 0 &&
    (e.failures === 0 || e.resetAt <= now)

  const entryFor = (key: string, now: number): LimitEntry => {
    if (entries.size > LIMIT_SWEEP_AT) {
      for (const [k, e] of entries) if (idle(e, now)) entries.delete(k)
    }
    let e = entries.get(key)
    if (!e) {
      e = { failures: 0, resetAt: 0, pending: 0, waiters: [] }
      entries.set(key, e)
    }
    if (e.failures > 0 && e.resetAt <= now) e.failures = 0
    return e
  }

  const settle = (key: string, e: LimitEntry, failed: boolean) => {
    const now = Date.now()
    e.pending -= 1
    if (failed) {
      if (e.failures === 0 || e.resetAt <= now) {
        e.failures = 1
        e.resetAt = now + windowMs
      } else {
        e.failures += 1
      }
    }
    const waiters = e.waiters.splice(0)
    for (const wake of waiters) wake()
    if (idle(e, now) && entries.get(key) === e) entries.delete(key)
  }

  return (req, res, next) => {
    const key = keyFor(req)
    /** The client went away (aborted) - never hand such a request on. */
    let gone = false
    /** Where this request waits, if it does. */
    let queued: { e: LimitEntry; wake: () => void } | null = null
    let waitTimer: ReturnType<typeof setTimeout> | null = null

    /**
     * This limiter drops a request it never handed on (client gone): the
     * outer limiters of the stack admitted it, and must free their slot
     * without counting a failure - no password was checked.
     */
    const drop = () => {
      const releases = releasesOf(req).splice(0)
      for (const release of releases) release()
    }
    const unqueue = () => {
      if (queued) {
        const i = queued.e.waiters.indexOf(queued.wake)
        if (i >= 0) queued.e.waiters.splice(i, 1)
        const { e } = queued
        queued = null
        if (idle(e, Date.now()) && entries.get(key) === e) entries.delete(key)
      }
      if (waitTimer) clearTimeout(waitTimer)
      waitTimer = null
    }
    const isGone = () => gone || res.destroyed || res.writableEnded

    res.once('close', () => {
      gone = true
      if (queued || waitTimer) drop()
      unqueue()
    })

    const attempt = (): void => {
      queued = null
      if (isGone()) {
        unqueue()
        drop()
        return
      }
      const now = Date.now()
      const e = entryFor(key, now)
      if (e.failures >= max) {
        unqueue()
        res.setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil((e.resetAt - now) / 1000)))
        )
        sendError(
          res,
          429,
          'too_many_requests',
          'Zu viele Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.'
        )
        return
      }
      if (e.failures + e.pending >= max) {
        // Wait for an answer instead of guessing its outcome - but not
        // forever: after LOGIN_WAIT_MAX_MS a 429 with Retry-After.
        queued = { e, wake: attempt }
        e.waiters.push(attempt)
        if (!waitTimer) {
          waitTimer = setTimeout(() => {
            waitTimer = null
            unqueue()
            if (isGone()) {
              drop()
              return
            }
            res.setHeader('Retry-After', String(Math.ceil(waitMs / 1000)))
            sendError(
              res,
              429,
              'too_many_requests',
              'Gerade laufen zu viele Anmeldeversuche. Bitte gleich erneut versuchen.'
            )
          }, waitMs)
          waitTimer.unref?.()
        }
        return
      }
      unqueue()
      admit(e)
    }

    /**
     * Settles when the handler answers (`res.end`), whatever happened to the
     * socket - so an aborted wrong guess still counts as a failure and an
     * aborted correct login as a success. 'finish' alone never fires on a
     * destroyed socket. If the client is gone and the handler does not answer
     * within LOGIN_ABORT_GRACE_MS, the attempt counts as failed (it may have
     * checked a password) and frees its slot.
     */
    const admit = (e: LimitEntry) => {
      e.pending += 1
      let settled = false
      let graceTimer: ReturnType<typeof setTimeout> | null = null
      const settleOnce = (failed: boolean) => {
        if (settled) return
        settled = true
        if (graceTimer) clearTimeout(graceTimer)
        settle(key, e, failed)
      }
      const isFailure = (status: number) => status >= 400 && status !== 429
      const end = res.end
      res.end = function (this: typeof res, ...args: unknown[]) {
        settleOnce(isFailure(res.statusCode))
        return (end as (...a: unknown[]) => typeof res).apply(this, args)
      } as typeof res.end
      res.once('finish', () => settleOnce(isFailure(res.statusCode)))
      res.once('close', () => {
        if (settled) return
        graceTimer = setTimeout(() => settleOnce(true), abortGraceMs)
        graceTimer.unref?.()
      })
      releasesOf(req).push(() => settleOnce(false))
      next()
    }

    attempt()
  }
}
