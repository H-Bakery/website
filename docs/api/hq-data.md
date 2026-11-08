# hq data (B4): reports, analytics, finance, Tagesziel

`apps/bakery-api/src/routes/hq-data.routes.ts` → `createHqDataRouter(options.hq)`, mounted at the
root **below** the global guard (its paths are absolute `/api/...`). It mounts three CommonJS
route modules - until B12 they also served the mock server (then `*.mock.js`, renamed at the
cutover); don't fork them:

| Module                     | Endpoints                                                                                                      | Access                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `routes/reports.routes.js` | `GET /api/reports/daily?from=&to=`, `/daily/:date`, `/monthly/:month`                                          | `inhaber` (also at a PIN station)    |
|                            | `GET /api/analytics/{revenue-trends,product-performance,payment-methods,summary}?startDate=&endDate=`          | `inhaber` (also at a PIN station)    |
| `routes/finance.routes.js` | `GET /api/finance/summary`, `/months?from=&to=`, `/year[/:year]`, `/month[/:month]` (`finance-report.core.js`) | `inhaber`, **personal session only** |
| `routes/targets.routes.js` | `GET /api/finance/targets`, `/targets/status?date=`, `/targets/period?from=&to=`                               | `inhaber`, **personal session only** |

The formulas live in `src/services/{reports,reports-files,finance,finance-report,targets}.core.js`. Shapes are
exactly the mock's (deep-equal bodies, pinned by the contract suite), including the module-local
error bodies (`{ error, message }` for reports, `{ success: false, error, message }` for
finance/targets); 401/403 come from the auth guards via `sendError`.

- **Role guards.** finance/targets call `auth.requireRole('inhaber')` (`ownerOnly`).
  `createRoleGuards()` hands them the real `requireRole` plus `requirePersonalSession`
  (`FINANCE_PERSONAL_SESSION_ONLY = true`); a role outside `PILOT_ROLES` throws at mount time.
  Their unit tests use `tests/helpers/roleGuards.js` (the Bearer token is the role).
  reports.routes has no guard of its own; the router puts `requireRole('inhaber')` on
  the prefixes `/api/reports` and `/api/analytics` only (so an unknown path there is 403 for a
  non-owner, 404 for the owner, and other routes are untouched).
- **Pilot decision:** reports and analytics are **owner only** (Verkauf has no screen for them;
  widen `REPORTS_ROLES` when it does). Finance and Tagesziel additionally need a **password
  session**: the targets are derived from staff costs, and a 4-digit PIN on a shared tablet should
  not open them. Flip `FINANCE_PERSONAL_SESSION_ONLY` if the owner wants them at the station (the
  dashboard tile then shows its "Anmeldung erforderlich" state on the tablet).
- **Paths.** `HQ_REPORTS_DIR` (holds `converted/`) and `HQ_FINANCE_DIR` (holds
  `finance-summary.json`, `config/targets.json`) are read by `loadConfig()` (resolved against the
  working directory) and passed through `createApp({ hq: { reportsDir, financeDir } })`. Unset,
  the modules fall back to `<website>/../hq/data/...` via `__dirname` - which in the bundle is
  `dist/apps/bakery-api/bundle/`, by luck the same depth as `src/routes/`. Don't rely on it: on the
  box set both (see `deploy/bakery.env.example`); production logs a `[WARN]` when they are unset.
- **Missing data is never an error and never sample data:** reports answer gaps /
  `available: false`, finance `status: 'no-data'`, targets `status: 'no-target'`.
- **`/api/finance/year|month`** also read the cash-register reports (`HQ_REPORTS_DIR`, passed as
  `reportsDir` by `hq-data.routes.ts`) for the monthly Kasse totals of the Kassenabgleich; a month
  without reports has no `kasse` (`null`), never zeros.
- **Bundling.** The modules are `require`d by literal from TS, so esbuild bundles them and the
  `*.core.js` files they pull in; `scripts/boot-smoke.sh` checks `/api/reports/daily` and
  `/api/finance/targets/status` from the bundle against `tests/fixtures/hq-data.synthetic.js`.
- `createTestApp()` silences the modules' startup log (`hq.log`).
- The old `routes/reports.routes.ts` (hardcoded fake numbers, never mounted since B0) was deleted
  before `reports.mock.js` took over its name in B12.

Tests: `tests/integration/hqData.test.ts` (roles, station session, no-hq answers, mount scope),
`tests/contract/hq-data.contract.test.ts` (recorded mock vs. real on a synthetic hq tree, recorded
mock login vs. real session - the runner takes `mockHeaders`/`realHeaders` for that), and the cores'
own suites
`tests/unit/{reportsCore,financeCore,financeRoutes,financeReportCore,financeReportRoutes,targetsCore,targetsRoutes}.test.js`.
