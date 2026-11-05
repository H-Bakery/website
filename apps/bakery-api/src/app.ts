/**
 * Express app for the pilot API - no `listen`, no DB setup.
 *
 * `server.ts` opens the database, migrates, initialises the models and then
 * calls `createApp()`; integration tests (B1) do the same with `:memory:`
 * and drive the result through supertest.
 *
 * Mounted (roadmap §4): health, auth, users, partners. The other pilot
 * domains get their mount points below as their tasks land.
 *
 * Every `/api` route needs a session (D5, B3) except the public auth
 * endpoints and health. That is structural, not an allow-list: the public
 * routers are mounted first, then the global guard, then everything else. A
 * router mounted below the guard is protected automatically - mount new
 * domains there and use `requireRole(...)` for role checks.
 */
import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Sequelize } from 'sequelize'

import { AuthServiceOptions, createAuthService } from './auth/auth.service'
import { STATION_TOKEN_HEADER, requireAuth } from './auth/middleware'
import { loggerMiddleware } from './middleware/logger.middleware'
import {
  createHealthRouter,
  createPublicAuthRouter,
  createSessionAuthRouter,
  createUsersRouter,
  partnerRoutes,
} from './routes'
import { AuthRouterOptions } from './routes/auth.routes'
import { createErrorHandler, notFoundHandler } from './utils/http-error'

export interface CreateAppOptions {
  /** Used by the health check only; models are initialised by the caller. */
  sequelize?: Sequelize
  /** Allowed CORS origins. Default: none (same-origin through the proxy). */
  corsOrigins?: string[]
  /** Log every request (default true; tests turn it off). */
  logRequests?: boolean
  /** Request body limit for JSON, as in the mock server. */
  jsonLimit?: string
  /** JWT secret and clock (default `JWT_SECRET`, `Date.now`). */
  auth?: AuthServiceOptions & AuthRouterOptions
  /**
   * Express `trust proxy` (default `'loopback'`: on the box Caddy forwards
   * from 127.0.0.1, so `req.ip` - and the login rate limit - see the client).
   */
  trustProxy?: boolean | number | string
}

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', options.trustProxy ?? 'loopback')

  const auth = createAuthService(options.auth)

  app.use(helmet())
  app.use(
    cors({
      origin: options.corsOrigins ?? false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', STATION_TOKEN_HEADER],
    })
  )
  app.use(express.json({ limit: options.jsonLimit ?? '200kb' }))
  if (options.logRequests !== false) {
    app.use(loggerMiddleware)
  }

  // --- No session required (D5) -------------------------------------------
  const health = createHealthRouter({ sequelize: options.sequelize })
  app.use('/health', health)
  app.use('/api/health', health)
  // login, refresh, pin, station/users
  app.use(
    '/api/auth',
    createPublicAuthRouter(auth, { rateLimit: options.auth?.rateLimit })
  )

  // --- Global guard: everything below needs a session (401) ---------------
  app.use('/api', requireAuth(auth))

  app.use('/api/auth', createSessionAuthRouter(auth)) // me, logout, stations
  app.use('/api/users', createUsersRouter(auth)) // inhaber only

  // --- Pilot domains -------------------------------------------------------
  app.use('/api/partners', partnerRoutes) // B6: roles + hq catalogue
  // B4: reports, analytics, finance, targets   (mock modules + auth adapter)
  // B5: /api/products, /api/hq-products        (hq markdown, worktree writes)
  // B7: /api/preorders (+ /api/deliveries/preorders alias, shop POST /api/orders)
  // Z*: /api/backzettel

  app.use(notFoundHandler)
  app.use(createErrorHandler())

  return app
}
