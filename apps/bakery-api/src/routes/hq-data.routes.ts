/**
 * hq read-only data on the real API (B4, roadmap §4, D9): cash-register
 * reports, analytics, finance and the Tagesziel. The routes are the mock
 * server's modules, mounted unchanged - one implementation for both servers
 * until cutover (D3); B12 renames them.
 *
 *   src/routes/reports.mock.js   register(app, { reportsDir })
 *     GET /api/reports/daily?from=&to=, /api/reports/daily/:date,
 *         /api/reports/monthly/:month
 *     GET /api/analytics/{revenue-trends,product-performance,payment-methods,summary}
 *   src/routes/finance.mock.js   install(app, auth, { financeDir })
 *     GET /api/finance/summary, /api/finance/months?from=&to=
 *   src/routes/targets.mock.js   install(app, auth, { financeDir, reportsDir })
 *     GET /api/finance/targets, /targets/status?date=, /targets/period?from=&to=
 *
 * Access (pilot decision, see apps/bakery-api/CLAUDE.md "hq data (B4)"):
 *   - everything needs a session (global guard in `app.ts`);
 *   - reports + analytics: `inhaber` only;
 *   - finance + targets: `inhaber` only **and a personal session** - a PIN on
 *     a shared tablet does not unlock figures derived from staff costs.
 *
 * The finance/targets modules ask for `auth.requireRole('admin')` (the mock's
 * role). `createMockAuthAdapter()` hands them the B3 guards instead and maps
 * mock roles to pilot roles; an unmapped role fails at mount time, never
 * silently open.
 */
import { RequestHandler, Router } from 'express'

import { requirePersonalSession, requireRole } from '../auth/middleware'
import type { UserRole } from '../auth/types'

/* eslint-disable @typescript-eslint/no-var-requires */
// CommonJS modules shared with simple-server.js; literal requires so esbuild
// bundles them (and the *.core.js files they require).
const registerReportsRoutes = require('./reports.mock')
const financeRoutes = require('./finance.mock')
const targetsRoutes = require('./targets.mock')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Mock role → pilot role (D5). */
export const MOCK_ROLE_MAP: Readonly<Record<string, UserRole>> = {
  admin: 'inhaber',
}

/** Roles that may read reports and analytics. `inhaber` passes every check anyway. */
export const REPORTS_ROLES: readonly UserRole[] = ['inhaber']

/**
 * Finance and Tagesziel only from a personal (password) session. Flip to
 * `false` if the owner wants them on the PIN station too (B3 open question).
 */
export const FINANCE_PERSONAL_SESSION_ONLY = true

export interface MockAuthAdapter {
  requireRole: (...mockRoles: string[]) => RequestHandler
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
 * The `auth` object the mock modules expect (`createAuth()` of
 * `auth.mock.js`), backed by the B3 guards. Only `requireRole` is used by
 * them; login etc. are B3's own routes.
 */
export function createMockAuthAdapter(
  options: { personalSessionOnly?: boolean } = {}
): MockAuthAdapter {
  return {
    requireRole: (...mockRoles: string[]) => {
      const roles = mockRoles.map((role) => {
        const mapped = MOCK_ROLE_MAP[role]
        if (!mapped) {
          throw new Error(
            `hq-data: mock role "${role}" has no pilot role mapping (MOCK_ROLE_MAP).`
          )
        }
        return mapped
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

  const auth = createMockAuthAdapter({
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
