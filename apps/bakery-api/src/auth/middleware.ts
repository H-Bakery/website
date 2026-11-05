/**
 * Guards of the pilot API (B3, D5).
 *
 *   requireAuth(service)     global on /api (app.ts): Bearer access token ->
 *                            `req.user`, else 401
 *   requireRole(...roles)    403 unless `req.user.role` is one of `roles`;
 *                            `inhaber` passes every check; 401 without a user
 *   requireStation(service)  header `X-Station-Token` -> `req.station`, else 403
 *   loginRateLimit(...)      5 failed attempts / 5 min per IP + login name -> 429
 *
 * Routers mounted after the global guard need only `requireRole`.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import { sendError } from '../utils/http-error'
import type { AuthService } from './auth.service'
import { AuthError, UserRole } from './types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')

export const STATION_TOKEN_HEADER = 'x-station-token'

export const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
export const LOGIN_RATE_LIMIT_MAX = 5

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

/**
 * Brute-force brake for login and PIN: `max` failed attempts per window and
 * per IP + login name (username or user id). Successful logins do not count.
 * Each `createApp()` gets its own in-memory store.
 */
export function loginRateLimit(options: {
  /** Which body field names the account (`username` or `userId`). */
  keyOf: (req: Request) => string
  windowMs?: number
  max?: number
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: options.max ?? LOGIN_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? 'unknown')}|${options.keyOf(req)}`,
    handler: (_req, res) => {
      sendError(
        res,
        429,
        'too_many_requests',
        'Zu viele Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.'
      )
    },
  })
}
