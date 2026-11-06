/**
 * hq read-only data on the real API (B4, roadmap §4, D9): cash-register
 * reports, analytics, finance and the Tagesziel. The routes are plain
 * CommonJS modules (until B12 they also ran in the mock server):
 *
 *   src/routes/reports.routes.js   register(app, { reportsDir })
 *     GET /api/reports/daily?from=&to=, /api/reports/daily/:date,
 *         /api/reports/monthly/:month
 *     GET /api/analytics/{revenue-trends,product-performance,payment-methods,summary}
 *   src/routes/finance.routes.js   install(app, auth, { financeDir })
 *     GET /api/finance/summary, /api/finance/months?from=&to=
 *   src/routes/targets.routes.js   install(app, auth, { financeDir, reportsDir })
 *     GET /api/finance/targets, /targets/status?date=, /targets/period?from=&to=
 *
 * Access (pilot decision, see apps/bakery-api/CLAUDE.md "hq data (B4)"):
 *   - everything needs a session (global guard in `app.ts`);
 *   - reports + analytics: `inhaber` only;
 *   - finance + targets: `inhaber` only **and a personal session** - a PIN on
 *     a shared tablet does not unlock figures derived from staff costs.
 *
 * The finance/targets modules ask for `auth.requireRole('inhaber')`.
 * `createRoleGuards()` hands them the B3 guards (plus the personal-session
 * check); a role that is not a pilot role fails at mount time, never
 * silently open.
 */
import { RequestHandler, Router } from 'express'

import { requirePersonalSession, requireRole } from '../auth/middleware'
import type { UserRole } from '../auth/types'

/* eslint-disable @typescript-eslint/no-var-requires */
// CommonJS modules; literal requires so esbuild bundles them (and the
// *.core.js files they require).
const registerReportsRoutes = require('./reports.routes')
const financeRoutes = require('./finance.routes')
const targetsRoutes = require('./targets.routes')
/* eslint-enable @typescript-eslint/no-var-requires */

/** The pilot roles (D5) a module may ask for. */
const PILOT_ROLES: readonly UserRole[] = [
  'inhaber',
  'verkauf',
  'backstube',
  'fahrer',
]

/** Roles that may read reports and analytics. `inhaber` passes every check anyway. */
export const REPORTS_ROLES: readonly UserRole[] = ['inhaber']

/**
 * Finance and Tagesziel only from a personal (password) session. Flip to
 * `false` if the owner wants them on the PIN station too (B3 open question).
 */
export const FINANCE_PERSONAL_SESSION_ONLY = true

export interface RoleGuards {
  requireRole: (...roles: string[]) => RequestHandler
}

/** Chains handlers into one middleware (each must call `next()` to go on). */
function chain(handlers: RequestHandler[]): RequestHandler {
  return (req, res, next) => {
    let i = 0
    const step = (err?: unknown) => {
      if (err) return next(err)
      const handler = handlers[i++]
      if (!handler) return next()
      try {
        handler(req, res, step)
      } catch (error) {
        next(error)
      }
    }
    step()
  }
}

/**
 * The `auth` object the route modules expect, backed by the B3 guards. Only
 * `requireRole` is used by them; login etc. are B3's own routes.
 */
export function createRoleGuards(
  options: { personalSessionOnly?: boolean } = {}
): RoleGuards {
  return {
    requireRole: (...requested: string[]) => {
      const roles = requested.map((role) => {
        if (!PILOT_ROLES.includes(role as UserRole)) {
          throw new Error(`hq-data: "${role}" is not a pilot role (D5).`)
        }
        return role as UserRole
      })
      const guards = [requireRole(...roles)]
      if (options.personalSessionOnly) guards.push(requirePersonalSession)
      return chain(guards)
    },
  }
}

interface Log {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export interface HqDataOptions {
  /** `hq/data/reports` (contains `converted/`). Default: `HQ_REPORTS_DIR`, else `<website>/../hq/data/reports`. */
  reportsDir?: string
  /** `hq/data/finance`. Default: `HQ_FINANCE_DIR`, else `<website>/../hq/data/finance`. */
  financeDir?: string
  /** Tagesziel "today" (tests). Default: the real date. */
  today?: string | (() => string)
  /** Logger for the modules' startup and "no data" lines (default `console`). */
  log?: Log
}

/**
 * Router with all hq read-only routes. The paths are absolute (`/api/...`),
 * so mount it at the root, **below** the global session guard.
 */
export function createHqDataRouter(options: HqDataOptions = {}): Router {
  const router = Router()
  const log = options.log ?? console

  // Reports/analytics bring no guard of their own; scoped to their prefixes
  // so the router does not affect any other path.
  router.use(['/api/reports', '/api/analytics'], requireRole(...REPORTS_ROLES))
  registerReportsRoutes(router, { reportsDir: options.reportsDir })

  const auth = createRoleGuards({
    personalSessionOnly: FINANCE_PERSONAL_SESSION_ONLY,
  })
  financeRoutes.install(router, auth, {
    financeDir: options.financeDir,
    log,
  })
  targetsRoutes.install(router, auth, {
    financeDir: options.financeDir,
    reportsDir: options.reportsDir,
    today: options.today,
    log,
  })
  return router
}
