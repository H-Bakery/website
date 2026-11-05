/**
 * `/api/auth` of the pilot API (B3). Shapes follow the mock contract
 * (`auth.mock.js`, D3) plus the PIN/station additions.
 *
 * Two routers, because the global guard sits between them (app.ts):
 *
 * public (before the guard)
 *   POST /login           { username | email, password }
 *                         -> { success, data: { user, token, refreshToken, expiresIn, sessionKind } }
 *   POST /refresh         { refreshToken } -> { success, data: { user, token, refreshToken, expiresIn, sessionKind } }
 *   POST /pin             X-Station-Token, { userId, pin } -> as /login, sessionKind 'station'
 *   GET  /station/users   X-Station-Token -> { success, data: [{ id, displayName, role }] }
 *
 * session (after the guard)
 *   GET    /me            -> { success, data: user (+ sessionKind) }
 *   POST   /logout        -> { success, message }   (revokes the session)
 *   GET    /stations      inhaber -> { success, data: Station[] }
 *   POST   /stations      inhaber, { name } -> 201 { success, data: { station, token } }
 *   DELETE /stations/:id  inhaber -> { success, data: station }  (revoke)
 */
import { Request, Router } from 'express'

import { audit, auditQuietly } from '../auth/audit'
import type { AuthService } from '../auth/auth.service'
import { publicUser } from '../auth/auth.service'
import {
  asyncHandler,
  loginRateLimit,
  requireRole,
  requireStation,
} from '../auth/middleware'
import { AuthSession, Station, User, getSequelize } from '../models'
import { sendError } from '../utils/http-error'

const INVALID_CREDENTIALS = 'Benutzername oder Passwort falsch.'
const INVALID_PIN =
  'PIN falsch oder Benutzer an dieser Station nicht verfügbar.'
const SESSION_EXPIRED = 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.'
const STATION_NAME_MAX = 80

export interface AuthRouterOptions {
  /** Rate limit for login and PIN (default 5 per 5 minutes). */
  rateLimit?: { windowMs?: number; max?: number }
}

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {}
}

function loginName(req: Request): string {
  const body = bodyOf(req)
  const value = body['username'] ?? body['email']
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function userAgent(req: Request): string | null {
  const ua = req.headers['user-agent']
  return typeof ua === 'string' ? ua : null
}

export function createPublicAuthRouter(
  service: AuthService,
  options: AuthRouterOptions = {}
): Router {
  const router = Router()

  router.post(
    '/login',
    loginRateLimit({
      keyOf: (req) => `u:${loginName(req)}`,
      ...options.rateLimit,
    }),
    asyncHandler(async (req, res) => {
      const body = bodyOf(req)
      const username = loginName(req)
      const password = body['password']
      if (!username || typeof password !== 'string' || password === '') {
        sendError(
          res,
          400,
          'validation',
          'Benutzername und Passwort sind erforderlich.'
        )
        return
      }
      const user = await service.checkPassword(username, password)
      if (!user) {
        await auditQuietly(
          req,
          'login_failed',
          'user',
          null,
          { username: username.slice(0, 64), ip: req.ip, kind: 'personal' },
          { userId: null }
        )
        sendError(res, 401, 'invalid_credentials', INVALID_CREDENTIALS)
        return
      }
      const issued = await getSequelize().transaction(async (transaction) => {
        const result = await service.issueSession(
          user,
          'personal',
          { userAgent: userAgent(req) },
          transaction
        )
        await audit(
          req,
          'login',
          'user',
          user.id,
          { sessionKind: 'personal', ip: req.ip },
          { userId: user.id, transaction }
        )
        return result
      })
      res.json({ success: true, data: issued })
    })
  )

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const result = await service.rotateRefreshToken(
        bodyOf(req)['refreshToken'],
        userAgent(req)
      )
      // `in` narrowing: the project compiles without strictNullChecks, where
      // a boolean discriminant does not narrow.
      if (!('issued' in result)) {
        if (result.reuse) {
          await auditQuietly(
            req,
            'refresh_reuse',
            'auth_session',
            result.sessionId,
            { ip: req.ip },
            { userId: result.userId ?? null }
          )
        }
        sendError(res, 401, 'unauthorized', SESSION_EXPIRED)
        return
      }
      res.json({ success: true, data: result.issued })
    })
  )

  router.post(
    '/pin',
    requireStation(service),
    loginRateLimit({
      keyOf: (req) => `pin:${String(bodyOf(req)['userId'] ?? '')}`,
      ...options.rateLimit,
    }),
    asyncHandler(async (req, res) => {
      const body = bodyOf(req)
      const station = req.station as Station
      if (
        body['userId'] === undefined ||
        body['userId'] === null ||
        typeof body['pin'] !== 'string'
      ) {
        sendError(res, 400, 'validation', 'Benutzer und PIN sind erforderlich.')
        return
      }
      const user = await service.checkPin(body['userId'], body['pin'])
      if (!user) {
        await auditQuietly(
          req,
          'login_failed',
          'user',
          typeof body['userId'] === 'number' ||
            typeof body['userId'] === 'string'
            ? String(body['userId']).slice(0, 64)
            : null,
          { ip: req.ip, kind: 'station', stationId: station.id },
          { userId: null }
        )
        sendError(res, 401, 'invalid_pin', INVALID_PIN)
        return
      }
      const issued = await getSequelize().transaction(async (transaction) => {
        const result = await service.issueSession(
          user,
          'station',
          { stationId: station.id, userAgent: userAgent(req) },
          transaction
        )
        station.lastUsedAt = new Date(service.now())
        await station.save({ transaction })
        await audit(
          req,
          'login',
          'user',
          user.id,
          { sessionKind: 'station', stationId: station.id, ip: req.ip },
          { userId: user.id, transaction }
        )
        return result
      })
      res.json({ success: true, data: issued })
    })
  )

  router.get(
    '/station/users',
    requireStation(service),
    asyncHandler(async (_req, res) => {
      const users = await User.scope('withSecrets').findAll({
        where: { active: true },
        order: [
          ['displayName', 'ASC'],
          ['id', 'ASC'],
        ],
      })
      res.json({
        success: true,
        data: users
          .filter((u) => Boolean(u.pinHash))
          .map((u) => ({ id: u.id, displayName: u.displayName, role: u.role })),
      })
    })
  )

  return router
}

export function createSessionAuthRouter(service: AuthService): Router {
  const router = Router()

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const user = await User.findByPk(req.user!.id)
      if (!user) {
        sendError(res, 401, 'unauthorized', SESSION_EXPIRED)
        return
      }
      res.json({
        success: true,
        data: {
          ...publicUser(user, req.user!.sessionKind),
          stationId: req.user!.stationId,
        },
      })
    })
  )

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      // Ends this session (this device) only, with all its refresh tokens.
      await getSequelize().transaction(async (transaction) => {
        const session = await AuthSession.findByPk(req.user!.sessionId, {
          transaction,
        })
        if (session) {
          await service.revokeSession(session, 'logout', transaction)
          await audit(
            req,
            'logout',
            'user',
            req.user!.id,
            { sessionKind: session.kind },
            { transaction }
          )
        }
      })
      res.json({ success: true, message: 'Abgemeldet.' })
    })
  )

  router.get(
    '/stations',
    requireRole('inhaber'),
    asyncHandler(async (_req, res) => {
      const stations = await Station.findAll({
        order: [
          ['revokedAt', 'ASC'],
          ['name', 'ASC'],
        ],
      })
      res.json({ success: true, data: stations.map((s) => s.toJSON()) })
    })
  )

  router.post(
    '/stations',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const raw = bodyOf(req)['name']
      const name =
        typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
      if (!name || name.length > STATION_NAME_MAX) {
        sendError(
          res,
          400,
          'validation',
          `Bitte einen Namen für die Station angeben (höchstens ${STATION_NAME_MAX} Zeichen).`
        )
        return
      }
      const result = await getSequelize().transaction(async (transaction) => {
        const created = await service.registerStation(
          name,
          req.user!.id,
          transaction
        )
        await audit(
          req,
          'register',
          'station',
          created.station.id,
          { name },
          { transaction }
        )
        return created
      })
      res.status(201).json({
        success: true,
        data: { station: result.station.toJSON(), token: result.token },
      })
    })
  )

  router.delete(
    '/stations/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const id = Number(req.params['id'])
      const station =
        Number.isInteger(id) && id > 0 ? await Station.findByPk(id) : null
      if (!station) {
        sendError(res, 404, 'not_found', 'Station nicht gefunden.')
        return
      }
      await getSequelize().transaction(async (transaction) => {
        const ended = await service.revokeStation(station, transaction)
        await audit(
          req,
          'revoke',
          'station',
          station.id,
          { name: station.name, sessionsEnded: ended },
          { transaction }
        )
      })
      res.json({ success: true, data: station.toJSON() })
    })
  )

  return router
}
