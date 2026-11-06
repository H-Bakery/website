/**
 * Express app for the pilot API - no `listen`, no DB setup.
 *
 * `server.ts` opens the database, migrates, initialises the models and then
 * calls `createApp()`; integration tests (B1) do the same with `:memory:`
 * and drive the result through supertest.
 *
 * Mounted (roadmap §4): health, auth, users, partners (B6), the hq read-only
 * data (B4: reports, analytics, finance, targets), products (B5), preorders
 * (B7) and the Backzettel (Z3). The other pilot domains get their mount
 * points below as their tasks land.
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
  createBackzettelRouter,
  createHealthRouter,
  createPublicAuthRouter,
  createSessionAuthRouter,
  createUsersRouter,
  createPartnerRouter,
} from './routes'
import { createHqDataRouter, HqDataOptions } from './routes/hq-data.routes'
import { AuthRouterOptions } from './routes/auth.routes'
import { createHqProductsRouters } from './routes/hq-products.routes'
import { HqProductsOptions } from './services/hq-products.service'
import { createPreorderRouters } from './routes/preorders.routes'
import { PreordersOptions } from './services/preorders.service'
import { BackzettelRouterOptions } from './routes/backzettel.routes'
import { createHqSyncRouter } from './routes/hq-sync.routes'
import { HqEditsSync } from './services/hq-edits-sync.service'
import { HqSnapshotWriter } from './services/hq-snapshots.service'
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
  /**
   * hq read-only data (B4): `reportsDir`, `financeDir` (default
   * `HQ_REPORTS_DIR` / `HQ_FINANCE_DIR`), `today` and `log` for tests.
   */
  hq?: HqDataOptions
  /**
   * hq products (B5): read clone and write worktree. Default
   * `HQ_PRODUCTS_DIR` / `HQ_WRITE_DIR` (unset = write to the read dir, dev).
   */
  hqProducts?: HqProductsOptions
  /**
   * Preorders (B7): hq read clone for price snapshots (default: the
   * `hqProducts.productsDir`, else `HQ_PRODUCTS_DIR` …), the Backzettel
   * variants hook and the clock.
   */
  preorders?: PreordersOptions
  /**
   * Where the Backzettel master data lives (Z3). Default: `HQ_BACKZETTEL_CONFIG`,
   * `HQ_DIR`, `HQ_PRODUCTS_DIR`, else `<cwd>/../hq`.
   */
  backzettel?: BackzettelRouterOptions
  /**
   * B5b + Z9: the hq write-back (rolling PR of `app/edits`) and the snapshot
   * writer (`data/production/**` on `main`). `server.ts` builds them from the
   * environment and starts their retry timers; without them both are
   * disabled (`/api/hq-sync/status` says so) and product saves only commit
   * locally (B5).
   */
  hqSync?: { edits?: HqEditsSync; snapshots?: HqSnapshotWriter }
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
  // B5b/Z9: write-back to hq; disabled unless server.ts passes configured ones
  const edits =
    options.hqSync?.edits ??
    new HqEditsSync({
      writeDir: options.hqProducts?.writeDir ?? null,
      token: null,
    })
  const snapshots =
    options.hqSync?.snapshots ?? new HqSnapshotWriter({ snapshotDir: null })
  // B5: hq markdown; reads any session, writes inhaber (HQ_WRITE_DIR commit,
  // then B5b pushes it); "wartet auf Freigabe" is measured against origin/main
  const hqProducts = createHqProductsRouters({
    approvedFiles: () => edits.approvedProductFiles(),
    afterCommit: () => edits.notifyCommitted(),
    ...options.hqProducts,
  })
  edits.onWorktreeChanged(() => hqProducts.service.invalidate())
  // B6: reads any session, visits inhaber/verkauf/fahrer, master data
  // inhaber; products of a visit come from the same hq catalogue (read clone)
  app.use(
    '/api/partners',
    createPartnerRouter({ productsDir: hqProducts.service.productsDir })
  )
  // B4: /api/reports, /api/analytics (inhaber), /api/finance/* incl. targets
  // (inhaber, personal session) - the mock modules behind the auth adapter.
  // Absolute paths, so mounted at the root.
  app.use(createHqDataRouter(options.hq))
  app.use('/api/products', hqProducts.products)
  app.use('/api/hq-products', hqProducts.hqProducts)
  // B7: /api/preorders (+ /api/deliveries alias, shop POST /api/orders);
  // roles per route in routes/preorders.routes.ts
  const preorders = createPreorderRouters({
    productsDir: hqProducts.service.productsDir,
    ...options.preorders,
  })
  app.use('/api/preorders', preorders.preorders)
  app.use('/api/deliveries', preorders.deliveries)
  app.use('/api/orders', preorders.orders)
  // Z3; Z9 writes the confirmed day to hq data/production/backzettel/;
  // Z4 writes Grundmengen like the products (write worktree, B5b PR) and
  // reads the cash reports for the reference column
  app.use(
    '/api/backzettel',
    createBackzettelRouter({
      write: {
        writeDir: hqProducts.service.writeDir,
        writeBranch: hqProducts.service.writeBranch,
        production: hqProducts.service.production,
        afterCommit: () => edits.notifyCommitted(),
        approvedFile: (rel) => edits.approvedTextFile(rel),
      },
      reference: {
        reportsDir: options.hq?.reportsDir,
        today: options.hq?.today,
        log: options.hq?.log?.warn,
      },
      ...(snapshots.enabled
        ? {
            onConfirmed: (day, { role }) =>
              snapshots.backzettelConfirmed(day, role),
            onReopened: (date, { role }) =>
              snapshots.backzettelReopened(date, role),
          }
        : {}),
      ...options.backzettel,
    })
  )
  // B5b/Z9 status + retry, inhaber only
  app.use('/api/hq-sync', createHqSyncRouter({ edits, snapshots }))

  app.use(notFoundHandler)
  app.use(createErrorHandler())

  return app
}
