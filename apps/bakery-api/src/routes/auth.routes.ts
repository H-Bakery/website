/**
 * `/api/auth` of the pilot API (B3). Shapes follow the former mock contract
 * (D3) plus the PIN/station additions.
 *
 * Two routers, because the global guard sits between them (app.ts):
 *
 * public (before the guard)
 *   POST /login           { username | email, password }
 *                         -> { success, data: { user, token, refreshToken, expiresIn, sessionKind } }
 *   POST /refresh         { refreshToken } -> { success, data: { user, token, refreshToken, expiresIn, sessionKind } }
 *                         409 refresh_superseded: a parallel refresh won (< 10 s ago);
 *                         a predecessor whose successor was never presented (lost answer)
 *                         gets a new successor up to 15 min later (audit refresh_reissued;
 *                         the unused successor then counts as reuse, W4-verify r5)
 *   POST /pin             X-Station-Token, { userId, pin } -> as /login, sessionKind 'station'
 *   GET  /station/users   X-Station-Token -> { success, data: [{ id, displayName, role }] }
 *   POST /logout          Bearer access token and/or { refreshToken }
 *                         -> { success, message }   (revokes that session; also
 *                         works with an expired access token, as in the mock)
 *
 * session (after the guard)
 *   GET    /me            -> { success, data: user (+ sessionKind) }
 *   GET    /stations      inhaber, personal session -> { success, data: Station[] }
 *   POST   /stations      inhaber, personal session, { name } -> 201 { success, data: { station, token } }
 *   DELETE /stations/:id  inhaber, personal session -> { success, data: station }  (revoke)
 */
import { Request, Router } from 'express'

import { audit, auditQuietly } from '../auth/audit'
import type { AuthService } from '../auth/auth.service'
import { publicUser } from '../auth/auth.service'
import {
  LOGIN_RATE_LIMIT_IP_MAX,
  PIN_RATE_LIMIT_USER_MAX,
  asyncHandler,
  bearerToken,
  loginRateLimit,
  requirePersonalSession,
  requireRole,
  requireStation,
} from '../auth/middleware'
import { AuthSession, Station, User, getSequelize } from '../models'
import { sendError } from '../utils/http-error'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const controlChars = require('../services/control-chars.core')

const INVALID_CREDENTIALS = 'Benutzername oder Passwort falsch.'
const INVALID_PIN =
  'PIN falsch oder Benutzer an dieser Station nicht verfügbar.'
const SESSION_EXPIRED = 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.'
const STATION_NAME_MAX = 80

export interface AuthRouterOptions {
  /**
   * Rate limits for login and PIN, failed attempts per window (default
   * 5 minutes): `max` per IP + account (5), `ipMax` per IP (30),
   * `pinUserMax` per PIN user across all IPs (10).
   */
  rateLimit?: {
    windowMs?: number
    max?: number
    ipMax?: number
    pinUserMax?: number
  }
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
  const limits = options.rateLimit ?? {}
  const windowMs = limits.windowMs
  // Per IP across all accounts: one IP may not spray passwords or PINs.
  const perIp = loginRateLimit({
    windowMs,
    max: limits.ipMax ?? LOGIN_RATE_LIMIT_IP_MAX,
  })

  router.post(
    '/login',
    perIp,
    loginRateLimit({
      keyOf: (req) => `u:${loginName(req)}`,
      windowMs,
      max: limits.max,
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
        // W4-verify r2: wer sein Passwort ins Benutzerfeld tippt, soll es
        // nicht im audit_log (und in jedem Backup) wiederfinden. Den Namen
        // behalten wir nur, wenn es ein vorhandenes Konto ist.
        const known = await User.findOne({
          where: { username },
          attributes: ['id', 'username'],
        })
        await auditQuietly(
          req,
          'login_failed',
          'user',
          known ? known.id : null,
          known
            ? { username: known.username, ip: req.ip, kind: 'personal' }
            : { unknownUser: true, ip: req.ip, kind: 'personal' },
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
        if (result.superseded) {
          sendError(
            res,
            409,
            'refresh_superseded',
            'Die Sitzung wurde gerade schon erneuert (anderes Fenster). Bitte das neue Token verwenden.'
          )
          return
        }
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
      if (result.reissued) {
        // W4-verify r4: the client lost the answer of its last refresh.
        await auditQuietly(
          req,
          'refresh_reissued',
          'auth_session',
          result.sessionId,
          { ip: req.ip },
          { userId: result.userId ?? null }
        )
      }
      res.json({ success: true, data: result.issued })
    })
  )

  // The PIN limits key on the canonical user id; any other spelling of an id
  // ("02", " 2", "2.0") is a 400 before the limiters, so it cannot open a
  // fresh counter for the same user.
  const pinUserId = (req: Request): number | null =>
    authCrypto.parseUserId(bodyOf(req)['userId'])
  const pinUserKey = (req: Request) => `pin:${pinUserId(req)}`

  router.post(
    '/pin',
    requireStation(service),
    (req, res, next) => {
      if (pinUserId(req) === null) {
        sendError(
          res,
          400,
          'validation',
          'Bitte einen Benutzer auswählen (userId als ganze Zahl).'
        )
        return
      }
      next()
    },
    perIp,
    loginRateLimit({ keyOf: pinUserKey, windowMs, max: limits.max }),
    loginRateLimit({
      keyOf: pinUserKey,
      perIp: false,
      windowMs,
      max: limits.pinUserMax ?? PIN_RATE_LIMIT_USER_MAX,
    }),
    asyncHandler(async (req, res) => {
      const body = bodyOf(req)
      const station = req.station as Station
      const userId = pinUserId(req) as number
      if (typeof body['pin'] !== 'string') {
        sendError(res, 400, 'validation', 'Benutzer und PIN sind erforderlich.')
        return
      }
      const user = await service.checkPin(userId, body['pin'])
      if (!user) {
        await auditQuietly(
          req,
          'login_failed',
          'user',
          userId,
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

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      // Ends one session (this device) with all its refresh tokens. Public,
      // because the access token lives only 1 h: a tablet idle for longer
      // must still be able to end its session with the refresh token.
      // Nothing to end (no or unknown token) is still a success, as in the
      // mock - the client forgets its tokens either way.
      const viaAccess = await service.verifyAccessToken(bearerToken(req))
      const session = viaAccess
        ? await AuthSession.findByPk(viaAccess.sessionId)
        : await service.findSessionByRefreshToken(bodyOf(req)['refreshToken'])
      if (session && !session.revokedAt) {
        await getSequelize().transaction(async (transaction) => {
          await service.revokeSession(session, 'logout', transaction)
          await audit(
            req,
            'logout',
            'user',
            session.userId,
            {
              sessionKind: session.kind,
              via: viaAccess ? 'access' : 'refresh',
            },
            { userId: session.userId, transaction }
          )
        })
      }
      res.json({ success: true, message: 'Abgemeldet.' })
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

  router.get(
    '/stations',
    requireRole('inhaber'),
    requirePersonalSession,
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
    requirePersonalSession,
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
      // W4-verify r3: like display names - a station name shows on the
      // station header and in /admin/users; NUL/BEL/RLO have no place there.
      if (controlChars.hasNameControlChars(name)) {
        sendError(
          res,
          400,
          'INVALID_TEXT',
          'Der Name der Station enthält unzulässige Steuerzeichen.'
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
    requirePersonalSession,
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
