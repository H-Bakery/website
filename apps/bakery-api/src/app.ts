/**
 * Express app for the pilot API - no `listen`, no DB setup.
 *
 * `server.ts` opens the database, migrates, initialises the models and then
 * calls `createApp()`; integration tests (B1) do the same with `:memory:`
 * and drive the result through supertest.
 *
 * Mounted (roadmap §4): health, auth, partners. The other pilot domains get
 * their mount points below as their tasks land.
 */
import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Sequelize } from 'sequelize'

import { loggerMiddleware } from './middleware/logger.middleware'
import { authRoutes, createHealthRouter, partnerRoutes } from './routes'
import {
  createErrorHandler,
  ensureErrorShape,
  notFoundHandler,
} from './utils/http-error'

export interface CreateAppOptions {
  /** Used by the health check only; models are initialised by the caller. */
  sequelize?: Sequelize
  /** Allowed CORS origins. Default: none (same-origin through the proxy). */
  corsOrigins?: string[]
  /** Log every request (default true; tests turn it off). */
  logRequests?: boolean
  /** Request body limit for JSON, as in the mock server. */
  jsonLimit?: string
}

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express()
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(
    cors({
      origin: options.corsOrigins ?? false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
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

  // --- Auth (B3 rewrites this on Sequelize: login/me/refresh/logout/pin) ---
  // ensureErrorShape: the lib answers errors in English and partly without
  // `message`; this fills in `error` + German `message` until B3.
  app.use('/api/auth', ensureErrorShape, authRoutes)

  // --- Pilot domains -------------------------------------------------------
  app.use('/api/partners', partnerRoutes) // B6 adds guards + hq catalogue
  // B4: reports, analytics, finance, targets   (mock modules + auth adapter)
  // B5: /api/products, /api/hq-products        (hq markdown, worktree writes)
  // B7: /api/preorders (+ /api/deliveries/preorders alias, shop POST /api/orders)
  // Z*: /api/backzettel

  app.use(notFoundHandler)
  app.use(createErrorHandler())

  return app
}
