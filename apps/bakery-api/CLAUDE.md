# Bakery API - Backend Service

## Overview

Express + TypeScript backend for the bakery pilot (roadmap `docs/roadmap.md`, D2: the real backend).
Sequelize on SQLite. Built by esbuild into a single file and run with plain `node`.

- **Port:** `PORT`, default 5000
- **Entry:** `src/main.ts` → `src/server.ts` → `src/app.ts`
- **Bundle:** `dist/apps/bakery-api/bundle/main.js` (+ source map); operator CLI
  `dist/apps/bakery-api/bundle/cli.js` (B3 `create-user`, B6 `import-partners`, B7
  `import-preorders`/`anonymize-preorders`, Z9 `snapshot-preorders`)

`simple-server.js` (mock API, `npm run serve:api:simple`) is still what the frontends use; it stays as
the parity reference until cutover (D3) and is then deleted. Its contracts win.

## Build and run

All from `website/`:

```bash
npm run serve:api                       # nx serve bakery-api: bundle, then run
npm run build:api                       # = npx nx run bakery-api:bundle
NX_DAEMON=false npx nx build bakery-api # typecheck (pilot graph) + bundle, used by CI
npx nx run bakery-api:typecheck         # tsc --noEmit -p apps/bakery-api/tsconfig.bundle.json
node apps/bakery-api/build.mjs --watch  # rebuild on change (restart node yourself)
node --enable-source-maps dist/apps/bakery-api/bundle/main.js
```

- `build.mjs`: esbuild, `platform: node`, `target: node20`, CommonJS. `@bakery/*` tsconfig aliases
  are **bundled** (they are source); every other bare import stays external and resolves from the
  root `node_modules`. The build prints the external package list - it must not contain `pg`,
  `winston`, `prom-client` or `swagger-*`.
- `tsconfig.bundle.json`: `useDefineForClassFields: false` + `experimentalDecorators`. With define
  semantics, class fields would shadow the attribute getters Sequelize installs on models.
- `typecheck` checks exactly the graph reachable from `main.ts`. The unmounted legacy code under
  `src/` and `libs/api/*` is not checked (and not in the bundle); B12 deletes it.
- The old `@nx/js:tsc` build is gone: its `dist/.../src/main.js` could never resolve `@bakery/*`.

## Startup (`src/server.ts`)

1. `config/load-env.ts` (first import of `main.ts`): loads `.env` from the working directory via
   `process.loadEnvFile` (already-set variables win), enforces `JWT_SECRET` (production: required,
   ≥ 32 chars; development: fixed default with a warning).
2. `config/env.ts` → `loadConfig()`: `PORT`, `HOST` (interface for `listen`; unset = all, the box
   sets `127.0.0.1`), `DB_PATH`, `DB_BUSY_TIMEOUT_MS` (5000), `DB_LOG_SQL`,
   `CORS_ORIGIN` (comma-separated; default the local dev ports), `TRUST_PROXY` (B3; default
   `loopback` = Caddy on the same box; `false`/`0`, a hop count or an Express trust list; `true`
   is refused because every client could then fake its IP and dodge the login rate limit).
   `JWT_SECRET` must be at least 32 characters in every environment (B3).
   **`DB_PATH`**: default `./data/bakery.db` relative to the working directory (gitignored as
   `/data/`); in production it is **required, absolute, not `:memory:`, and its directory must
   already exist** - the server refuses to start otherwise (Sequelize would silently create a
   fresh empty database at a mistyped path).
3. `db/database.ts` → `openDatabase()`: Sequelize SQLite, `PRAGMA journal_mode = WAL` (persistent),
   `busy_timeout` on **every** connection. Sequelize's SQLite dialect opens one connection per
   transaction and does not run `afterConnect` hooks, so the timeout is set by wrapping
   `connectionManager.getConnection` - don't replace that with a one-off `PRAGMA` query.
   **Write transactions are serialised in-process** (`serializeTransactions`, FIFO, one at a time)
   and start as `BEGIN IMMEDIATE`. busy_timeout alone does not prevent `SQLITE_BUSY`: a DEFERRED
   transaction that reads then writes fails at once on the lock upgrade, and many IMMEDIATE
   transactions busy-waiting together starve node-sqlite3's 4-thread libuv pool. Use the
   **managed** form `sequelize.transaction(async (t) => …)`; an unmanaged `await transaction()`
   holds the queue until `commit()`/`rollback()`. A nested `transaction()` call inside a managed
   callback bypasses the queue - pass `{ transaction: t }` to get a savepoint. Regression test:
   `tests/unit/apiPlatform.test.js` (20 parallel read-then-write transactions).
4. `db/migrate.ts` → `runMigrations()`: Umzug in-process over the **static list** in
   `db/migrations.ts` (each file `require`d by literal, so esbuild bundles it). Bookkeeping in
   `SequelizeMeta` with the `.js` names, compatible with databases migrated by `sequelize-cli`.
   No glob, no shell-out, **no `sequelize.sync()` at runtime**. A new migration = one new line.
   Since B2 the list holds **one pilot baseline**, `migrations/20261105000000-pilot-baseline.js`
   (see "Schema" below); the 17 legacy migrations are archived in `migrations/archive/` and never
   loaded (`sequelize-cli` does not read subdirectories either).
5. `initializeModels(sequelize)` - after the migrations, never before.
6. `runPartnerSeeder()` - idempotent (by slug), creates the first sales partner. Then
   `bootstrapAdmin()` (B3): only outside production and only with `BOOTSTRAP_ADMIN_USER` +
   `BOOTSTRAP_ADMIN_PASSWORD` set, creates that `inhaber` if the name is free. There is no
   default account.
7. `createApp({ sequelize, corsOrigins, trustProxy })` + `listen`. SIGTERM/SIGINT close the
   server (idle keep-alive sockets at once, open requests after `SHUTDOWN_DEADLINE_MS` = 10 s)
   and then the DB.

## App (`src/app.ts`)

`createApp(options)` builds the Express app without `listen` and without DB setup, for the server
and for supertest (B1). Mounted for the pilot:

| Path                                             | Router                                   | Note                                                        |
| ------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| `/health`, `/api/health`                         | `routes/health.routes.ts`                | no session; `SELECT 1` if a DB was passed                   |
| `/api/auth` (public)                             | `routes/auth.routes.ts` (public router)  | login, refresh, pin, station/users - see B3                 |
| `/api` (guard)                                   | `auth/middleware.ts` `requireAuth`       | **everything below needs a session (401)**                  |
| `/api/auth` (session)                            | `routes/auth.routes.ts` (session router) | me, logout, stations                                        |
| `/api/users`                                     | `routes/users.routes.ts`                 | user admin, `inhaber` only                                  |
| `/api/partners`                                  | `routes/partner.routes.ts`               | Backschrank; reads any session, roles per write - see B6    |
| `/api/reports`, `/api/analytics`, `/api/finance` | `routes/hq-data.routes.ts` (B4)          | hq read-only data via the mock modules - see "hq data (B4)" |
| `/api/products`, `/api/hq-products`              | `routes/hq-products.routes.ts`           | hq catalogue; reads any session, writes `inhaber` - see B5  |
| `/api/preorders`                                 | `routes/preorders.routes.ts`             | Vorbestellungen; verkauf, fahrer read + handover - see B7   |
| `/api/deliveries`                                | `routes/preorders.routes.ts` (alias)     | only the Mörsbach mock contract (pickup points, preorders)  |
| `/api/orders` (POST only)                        | `routes/preorders.routes.ts` (shop)      | shop order → preorder with channel `shop`, behind auth      |
| `/api/backzettel`                                | `routes/backzettel.routes.ts`            | Z3, see "Backzettel API (Z3)"                               |
| `/api/hq-sync`                                   | `routes/hq-sync.routes.ts`               | B5b/Z9 status + retry, `inhaber` - see "hq write-back"      |

New domains are mounted in `app.ts` **below the global guard** - mount them there and add
`requireRole(...)`. `libs/api/auth` is no longer mounted (the lib stays until B12).
Everything else is unmounted: recipes, inventory, cash, chat, dashboard, staff, notifications,
templates, preferences, import, sales-analytics, unsold, the rest of orders (only the shop's
`POST /api/orders` exists, B7), production, baking-list, the rest of deliveries (tours, stops,
drivers - D11; only the Mörsbach alias exists), workflows, email, monitoring/metrics, Swagger.

## hq data (B4): reports, analytics, finance, Tagesziel

`routes/hq-data.routes.ts` → `createHqDataRouter(options.hq)`, mounted at the root **below** the
global guard (its paths are absolute `/api/...`). It mounts the mock server's modules unchanged -
one implementation for both servers until cutover (D3); B12 renames them, don't fork them:

| Module                   | Endpoints                                                                                             | Access                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `routes/reports.mock.js` | `GET /api/reports/daily?from=&to=`, `/daily/:date`, `/monthly/:month`                                 | `inhaber` (also at a PIN station)    |
|                          | `GET /api/analytics/{revenue-trends,product-performance,payment-methods,summary}?startDate=&endDate=` | `inhaber` (also at a PIN station)    |
| `routes/finance.mock.js` | `GET /api/finance/summary`, `/api/finance/months?from=&to=`                                           | `inhaber`, **personal session only** |
| `routes/targets.mock.js` | `GET /api/finance/targets`, `/targets/status?date=`, `/targets/period?from=&to=`                      | `inhaber`, **personal session only** |

Shapes are exactly the mock's (proven by `tests/parity/hq-data.parity.test.ts`, deep-equal bodies),
including the module-local error bodies (`{ error, message }` for reports, `{ success: false,
error, message }` for finance/targets); 401/403 come from the B3 guards via `sendError`.

- **Auth adapter.** finance/targets call `auth.requireRole('admin')`. `createMockAuthAdapter()`
  hands them the B3 `requireRole` with `MOCK_ROLE_MAP` (`admin` → `inhaber`) plus
  `requirePersonalSession` (`FINANCE_PERSONAL_SESSION_ONLY = true`). An unmapped mock role throws
  at mount time. reports.mock has no guard of its own; the router puts `requireRole('inhaber')` on
  the prefixes `/api/reports` and `/api/analytics` only (so an unknown path there is 403 for a
  non-owner, 404 for the owner, and other routes are untouched).
- **Pilot decision (B4):** reports and analytics are **owner only** in the pilot (Verkauf has no
  screen for them yet; widen `REPORTS_ROLES` when it does). Finance and Tagesziel additionally
  need a **password session**: the targets are derived from staff costs, and a 4-digit PIN on a
  shared tablet should not open them. This answers B3's open question conservatively - flip
  `FINANCE_PERSONAL_SESSION_ONLY` if the owner wants them at the station (the dashboard tile then
  shows its "Anmeldung erforderlich" state on the tablet).
- **Paths.** `HQ_REPORTS_DIR` (holds `converted/`) and `HQ_FINANCE_DIR` (holds
  `finance-summary.json`, `config/targets.json`) are read by `loadConfig()` (resolved against the
  working directory) and passed through `createApp({ hq: { reportsDir, financeDir } })`. Unset,
  the modules fall back to `<website>/../hq/data/...` via `__dirname` - which in the bundle is
  `dist/apps/bakery-api/bundle/`, by luck the same depth as `src/routes/`. Don't rely on it: on the
  box set both (see `deploy/bakery.env.example`); production logs a `[WARN]` when they are unset.
  Missing data is never an error: reports answer gaps / `available: false`, finance `status:
'no-data'`, targets `status: 'no-target'` (no sample data, by design).
- **Bundling.** The modules are `require`d by literal from TS, so esbuild bundles them and the
  `*.core.js` files they pull in; `scripts/boot-smoke.sh` checks `/api/reports/daily` and
  `/api/finance/targets/status` from the bundle against `tests/fixtures/hq-data.synthetic.js`.
- The old `routes/reports.routes.ts` (hardcoded fake numbers, never mounted since B0) is deleted.
- Tests: `tests/integration/hqData.test.ts` (roles, station session, no-hq answers, mount scope),
  `tests/parity/hq-data.parity.test.ts` (mock vs. real, mock login vs. B3 session - the parity
  runner takes `mockHeaders`/`realHeaders` for that), the cores' own suites
  (`reportsCore`, `financeCore`, `financeRoutes`, `targetsCore`, `targetsRoutes`).
  `createTestApp()` silences the modules' startup log (`hq.log`).

## Errors

Every error body carries `error` (code) **and** `message` (German) - `ApiClient` throws
`new Error(data.message)`. Use `sendError(res, status, error, message)` from
`src/utils/http-error.ts`. Unknown routes get a JSON 404 (`not_found`), bad JSON 400
(`invalid_json`), bodies over 200 kB 413 (`payload_too_large`), anything unhandled 500
(`internal_error`, no internals in the body; the stack goes to the log). An error passed to
`next()` with a 4xx `status` keeps its meaning: code and German text come from `STATUS_ERRORS`
(401 `unauthorized`, 403 `forbidden`, 429 `too_many_requests`, …; unknown 4xx → `bad_request`).

`ensureErrorShape` (fills in `error` + German `message` for routers that answer otherwise) is no
longer mounted: B3's auth routes use `sendError` directly. It stays exported for a legacy router
that has to be mounted before it is rewritten.

## Auth (B3)

Personal accounts plus PIN stations (roadmap D5, D12). Code in `src/auth/` (service, middleware,
`audit()`, users service), routes in `src/routes/auth.routes.ts` and `users.routes.ts`, hashing
and validation in `src/services/auth-crypto.core.js` (dependency-free CommonJS, tested in
`tests/unit/authCrypto.test.js`). Endpoints and envelope = the mock's `auth.mock.js`, plus
PIN/stations; the `user` object deliberately deviates (see below the table):

| Endpoint                                                                                                 | Who                             | Body / answer                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                                                                                   | public, rate-limited            | `{ username \| email, password }` → `{ success, data: { user, token, refreshToken, expiresIn, sessionKind } }` |
| `POST /api/auth/refresh`                                                                                 | public                          | `{ refreshToken }` → same `data` shape, **new** `refreshToken`; 409 `refresh_superseded` (parallel refresh)    |
| `POST /api/auth/pin`                                                                                     | `X-Station-Token`, rate-limited | `{ userId, pin: "0420" }` → same `data` shape, `sessionKind: 'station'`                                        |
| `GET /api/auth/station/users`                                                                            | `X-Station-Token`               | `{ success, data: [{ id, displayName, role }] }` (active users with a PIN)                                     |
| `GET /api/auth/me`                                                                                       | session                         | `{ success, data: user + sessionKind + stationId }`                                                            |
| `POST /api/auth/logout`                                                                                  | public                          | Bearer and/or `{ refreshToken }` → ends **that** session; always `{ success, message: 'Abgemeldet.' }`         |
| `GET/POST /api/auth/stations`, `DELETE /api/auth/stations/:id`                                           | `inhaber`, personal session     | register `{ name }` → 201 `{ station, token }` (token shown once); revoke ends its sessions                    |
| `GET/POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/password`, `POST /api/users/:id/pin` | `inhaber`, personal session     | `AdminUser` = user + `hasPin`, never a hash                                                                    |

`user` = `{ id, username, displayName, role, active, isActive, createdAt, updatedAt, sessionKind }`.
Roles `inhaber | verkauf | backstube | fahrer`. **D3 deviation, deliberate:** the mock's `email`,
`firstName`, `lastName`, `lastLogin` do not exist (the pilot `users` table has no such columns and
the API does not invent them); `isActive` mirrors `active` for the shared `User` type. F1 must read
`displayName`/`username` where the management app reads `user.email` today
(`admin/login/page.tsx`, `admin/chat/page.tsx`). Errors via `sendError`: 400 `validation`, 401
`invalid_credentials` („Benutzername oder Passwort falsch.") / `invalid_pin` / `unauthorized`,
403 `forbidden` / `station_required` / `personal_session_required`, 404 `not_found`, 409 `username_taken` / `last_inhaber` / `refresh_superseded`, 429
`too_many_requests`.

What to know before changing it:

- **Sessions live in `auth_sessions`** (migration `20261106000000-auth-sessions-stations.js`, which
  also adds `stations` and `refresh_tokens.session_id`). The access JWT (HS256, 1 h, claims `sub`,
  `role`, `displayName`, `sessionKind`, `sid`, `type: 'access'`) is checked against its session
  **and** the user on every request, so logout, deactivation, a new password/PIN and a revoked
  station take effect at once. `req.user` (`id`, `username`, `displayName`, `role`,
  `sessionKind`, `sessionId`, `stationId`) comes from the database, not from the token claims.
- **Refresh tokens** (`rt_…`, 32 random bytes) are stored as SHA-256 only, rotated on every
  refresh (`revokedAt` + `replacedBy`). A rotated token presented again revokes the whole session
  (`revoke_reason = 'reuse'`, audited as `refresh_reuse`) - **except** within
  `REFRESH_REUSE_GRACE_MS` (10 s) of the rotation while the successor is unused: that is a
  parallel refresh (two tabs, a retry) and gets 409 `refresh_superseded` without ending the
  session. A thief who wins such a race is caught on the client's next refresh. Personal sessions slide to 14 days on
  each refresh; **station sessions end 12 h after the PIN** - neither refresh nor access token
  outlives that (`expiresIn` shrinks towards the end). Unlike the mock, a bare access token is
  **not** accepted at `/refresh`: the client must keep the refresh token (F1).
- **Global guard is structural** (`app.ts`): public auth router → `app.use('/api', requireAuth)` →
  everything else. No path allow-list to get wrong; an unknown `/api` path without a session is a
  401, with a session a 404. `requireRole(...roles)` needs no service; `inhaber` passes every check.
- **Stations:** `X-Station-Token` (`st_…`, SHA-256 in `stations`). PIN login without a valid, not
  revoked station token is 403. PINs are 4-6 digits **as a string** (a number would lose leading
  zeros → 400). `userId` must be canonical (`parseUserId`: JSON integer > 0 or `"7"`); `"07"`,
  `" 7"`, `"7.0"`, `"0x7"` are 400 **before** the rate limiter - otherwise each spelling of one id
  had its own counter and a PIN could be brute-forced without limit.
- **Station sessions carry the user's full role but cannot administer** (`requirePersonalSession`
  on `/api/users` and `/api/auth/stations`, 403 `personal_session_required`): a 4-digit PIN on a
  shared tablet must not unlock user/station admin. B4 gives finance and Tagesziel the same guard
  (default chosen there; owner may still decide otherwise - see "hq data (B4)").
- **Logout is public**: Bearer access token, else `{ refreshToken }` (also a rotated or expired
  one) names the session; it is revoked and audited (`via: 'access' | 'refresh'`). Nothing valid
  → still 200, as in the mock.
- **Rate limit** (`loginRateLimit` in `auth/middleware.ts`, own in-memory limiter per
  `createApp()`; only `ipKeyGenerator` comes from express-rate-limit), **failed** attempts per
  5 min → 429 with `Retry-After`: 5 per IP + username (login) or IP + userId (PIN); 30 per IP
  across all accounts (`LOGIN_RATE_LIMIT_IP_MAX`, password spraying); for the PIN also 10 per
  user across all IPs (`PIN_RATE_LIMIT_USER_MAX`; the side effect - anyone at a station can lock
  a user's PIN login for 5 min - is accepted, password login still works). **Only failures
  count (W4)**: a request is settled when its handler answers (`res.end`, also on a dead
  socket) - status ≥ 400 except 429 is a failure, anything else costs nothing, so any number of **parallel successful** logins pass (before W4
  express-rate-limit counted every request on arrival and the sixth parallel login got a 429
  that then counted as a failure). While requests are in flight they are reserved: a request
  that could push `failures + pending` over the limit **waits** for one of them to settle instead
  of being rejected or let through - so a burst of wrong guesses cannot get past the limit
  either (test: 12 parallel wrong guesses → exactly 5 × 401, 7 × 429). **Aborted requests
  (W4 fixup):** a waiter whose client hangs up leaves the queue and releases the slots the outer
  limiters of the stack gave it (no failure - it never reached a password check); a woken waiter
  whose client is gone is never handed on; an admitted attempt whose client hangs up still
  settles when the handler answers (an aborted wrong guess counts, an aborted correct login does
  not), or as a failure after `LOGIN_ABORT_GRACE_MS` (30 s) if the handler never answers. Nobody
  waits longer than `LOGIN_WAIT_MAX_MS` (5 s) → 429 with `Retry-After`. Before this fix three
  aborted waiters could wedge an IP + account until restart. Tests:
  `tests/integration/loginRateLimit.abort.test.ts` (real HTTP, clients that hang up). The window
  starts at the first failure; idle keys are swept above 10 000 entries.
  `req.ip` depends on `TRUST_PROXY` (default `loopback`, Caddy).
  Tests override via `createApp({ auth: { rateLimit: { max, ipMax, pinUserMax, windowMs } } })`.
- **Usernames are lower-case.** Login and the CLI normalise (`trim().toLowerCase()`) and look up
  with SQLite's case-sensitive `=`; the B3 migration lower-cases legacy names from the B2 rebuild
  unless the lower-case name is taken (then it warns and leaves the row for a manual fix).
- **scrypt** (`node:crypto`, N=2^14, r=8, p=1, 16-byte salt): `scrypt$N$r$p$salt$hash`
  (base64url). `verifySecret` runs one scrypt even for unknown users, users without PIN and the
  legacy marker `!legacy-user-disabled`, and refuses parameters outside bounds.
- **`audit(req, action, entity, entityId, data, { transaction, userId })`** in `src/auth/audit.ts`
  writes `audit_log`; pass the write's transaction. Logged: `login`, `login_failed` (userId null,
  username + IP, never the password), `logout`, `refresh_reuse`, user `create`/`update` (diff)/
  `set_password`/`set_pin`/`clear_pin`, station `register`/`revoke`, `cli_create`/`cli_reset`,
  `bootstrap_create`.
- **User admin rails:** users are deactivated (`active: false`), never deleted; nobody can
  deactivate themselves; the last active `inhaber` cannot be demoted or deactivated (409, checked
  inside the serialised transaction). A new password ends the user's other sessions (the admin's
  own stays); a new PIN ends their station sessions.
- **No default account.** `admin`/`admin123` is gone (user seeder deleted, `libs/api/auth` seed
  removed and the lib unmounted). Accounts: `create-user` CLI, in development optionally
  `BOOTSTRAP_ADMIN_USER`/`BOOTSTRAP_ADMIN_PASSWORD` (ignored in production).

### `create-user` CLI

```bash
npm run build:api
npm run api:create-user -- --username anna --display-name "Anna" --role verkauf
# = node dist/apps/bakery-api/bundle/cli.js create-user ...
```

Password from `CREATE_USER_PASSWORD`, else stdin (piped: first line; terminal: asked twice without
echo); optional PIN from `CREATE_USER_PIN`. Reads `.env` in the working directory, uses `DB_PATH`
with the server's rules (production: absolute, directory must exist) and runs pending migrations.
Idempotent: an existing user - also a deactivated one - gets the given name, role and password,
is reactivated and loses its open sessions. Input is validated before the database is opened.
Needs no `JWT_SECRET`. Tests: `tests/integration/cli.test.ts`.

Tests: `tests/unit/authCrypto.test.js`, `tests/integration/{auth,stations,users,cli}.test.ts`
(helpers in `tests/helpers/auth.ts`); `scripts/boot-smoke.sh` creates its account with the
bundled CLI.

## hq products (B5)

Products are the markdown files in `hq/products` (D9), served with the mock's contract (D3).
Code: rules in `src/services/hq-products.core.js` (dependency-free; field rules, slug, next
`numeric_id`, commit message), validation in `product-input.core.js`, serialisation in
`product-file.core.js` (`serializeProductFile` - key order and quoting, **zero-diff round trip**),
cache in `src/services/hq-catalogue.ts`, file I/O + git in `src/services/hq-products.service.ts`,
routes in `src/routes/hq-products.routes.ts`.

| Endpoint                           | Who       | Answer                                                                                                                |
| ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET /api/products[?category=]`    | session   | `{ success, data: HQProduct[], count }` - read clone only                                                             |
| `GET /api/hq-products[?category=]` | session   | same envelope, **write-worktree version** (incl. new products); pending ones carry `approved`                         |
| `GET /api/hq-products/:id`         | session   | `{ success, data }`; write-worktree version, else read clone; pending ones carry `approved`; 404 `not_found`          |
| `PUT /api/hq-products/:id`         | `inhaber` | `{ success, data, pending }`; 400 `validation` / `invalid_product_file`, 404, 500 `hq_commit_failed`, 503 (see below) |
| `POST /api/hq-products`            | `inhaber` | 201 `{ success, data, pending }`; 400 `validation` / `invalid_id` / `invalid_product_file`, 409 `product_exists`, 503 |

503 codes: `hq_unavailable` (no read dir, development), `hq_write_unavailable` (write dir missing,
not a git repo, or production without `HQ_WRITE_DIR`), `hq_write_wrong_branch` (worktree not on
`HQ_WRITE_BRANCH`, default `app/edits`; also a detached HEAD). `?category=` given twice (an
array) matches nothing, as in the mock.

`HQProduct` = the mock's `loadHQProducts()` shape (`id, numeric_id, name, category, price, available,
seasonal, image, short_description, allergens, allergens_source, allergen_recipe, description`)
**plus `pendingApproval`**. Write answers are the mock's (`frontmatter + description`) plus
`data.pendingApproval` and top-level `pending`. No DELETE (deleting a product = deleting a file in hq).
The management view (`/api/hq-products[/:id]`) additionally carries **`rawDescription`** (F4): the
body without its heading and **without** the `short_description` fallback that `description` has
for the shop (`managedFields()` in `hq-products.core.js`). The edit form must send that back, or an
unchanged save of a file without description writes the teaser into its body. `stripHeading()`
also empties a body that is only the heading (POST without description answers `description: ''`
on both servers; parity-tested).

- **Two write modes.** `HQ_WRITE_DIR` set (the box): the file goes to
  `${HQ_WRITE_DIR}/products` (worktree on `app/edits`), then `git add` + `git commit -- <file>`
  there, author and committer `Verwaltung (App) <verwaltung@bakery.local>`, message
  `products: <Name> (<id>) geändert|angelegt` + `Co-authored-by: <displayName> <user-<id>@bakery.local>`
  (the user **id**, never the login - since B5b these commits reach GitHub, and D13 keeps logins
  out of hq; no display name → `unbekannt`, never the login).
  git runs through `execFile` with argument arrays, never a shell string. Only the product path is
  committed - whatever else sits in the index stays. Push + PR is **B5b** (see "hq
  write-back"; without a token the commits stay local). `HQ_WRITE_DIR` unset (development): written straight into `HQ_PRODUCTS_DIR`, no git,
  like the mock. The read clone is never written when `HQ_WRITE_DIR` is set.
- **"wartet auf Freigabe"**: a product is `pendingApproval: true` when its file in the write worktree
  differs byte-wise from the read clone's (or exists only there). **Two views, deliberately:**
  `/api/products` (shop, and `getCatalogue()`) serves the **approved** version (read clone) with
  the flag; `/api/hq-products[/:id]` (management) serves the **write-worktree** version - the one
  a PUT builds on - plus `approved` (read-clone product, `null` for a new one) when pending. Do not
  point the management GETs back at the read clone: the edit form sends every field, so its second
  save would write the approved values over the pending edit (lost update, B5 review; regression
  test "saving the full edit form of a pending product keeps the pending edit"). Caveat: a write
  worktree that lags behind `origin/main` makes files look pending until B5b rebases it.
  **Since B5b** "pending" is measured against `origin/main` of the write clone (see "hq
  write-back"), the read clone is the fallback before the first fetch **and whenever the sync is
  disabled** (no token: the write clone's `origin/main` is never fetched and would go stale).
- **Branch guard**: before writing, `git rev-parse --abbrev-ref HEAD` in `HQ_WRITE_DIR` must equal
  `HQ_WRITE_BRANCH` (default `app/edits`), else 503 `hq_write_wrong_branch` and nothing is written.
- **Round-trip check**: `serializeProductFile` quotes everything YAML 1.1 would read as something
  else (leading quote/`?`/`:`, trailing `:`, numbers in hex/octal/binary/exponent/`_`/sexagesimal
  form, `.inf`/`.nan`, dates, `y`/`n`/`null`, control characters). In addition the service parses
  the finished file with gray-matter and compares it with the intended frontmatter + body
  (`roundTripsAs` in `hq-products.core.js`); a mismatch is 400 `invalid_product_file` and nothing
  is written. Without this a name like `Brot:` was committed as an unparseable file, vanished from
  every list and would have blocked the rolling PR (H2).
- **No-op saves write and commit nothing** (identical bytes) - tested for every sample file with the
  body the edit form sends. A file that was dirty on disk and is saved back to the committed state
  is also a no-op (nothing staged → no commit, 200). A failed commit (e.g. a rejecting pre-commit
  hook) restores the file (or removes a new one), unstages it and answers 500. Writes are
  serialised in-process (read-modify-write + git index).
- **Catalogue for other domains** (B6 partners, B7 preorders): `getCatalogue()` / `getProduct(slug |
numeric_id)` from `hq-catalogue.ts` - read clone only (approved prices for snapshots), frozen
  objects, one cache per directory, re-read when the directory mtime changes (git re-creates files
  on checkout/reset) or after 60 s (`CATALOGUE_TTL_MS`; an in-place edit does not touch the
  directory mtime), and invalidated by our own writes. Missing directory: empty catalogue, logged
  once (`HQ products directory not found`), writes 503.
- **Configuration** (`loadHqConfig()` in `config/env.ts`, called by `startServer()` before the
  database is opened): read dir = `HQ_PRODUCTS_DIR`, else `${HQ_DIR}/products`, else (development
  only) `<website>/../hq/products` (found via `nx.json` from cwd; `defaultProductsDir()` uses the
  same order, as Z3's Backzettel loader does). **Production refuses to start** without an absolute
  read dir and an absolute `HQ_WRITE_DIR` - otherwise edits would go into the read clone, which
  `hq-sync.sh` resets every 10 minutes, after a 200. In every environment `HQ_WRITE_DIR` must not
  be inside or around the read clone (`HQ_DIR`, in production also the parent of the products
  dir). The service additionally answers 503 to writes when `NODE_ENV=production` and no write dir
  is set (`createApp` without config). The server logs both directories at start.
  `createApp({ hqProducts: { productsDir, writeDir, writeBranch, production } })` overrides them
  (tests). `tests/setup-ts.js` unsets `HQ_WRITE_DIR` and `HQ_WRITE_BRANCH`; `scripts/boot-smoke.sh`
  passes (non-existent) temp dirs for both.

Tests: `tests/unit/hqProductsCore.test.js`, `tests/unit/hqCatalogue.test.ts`,
`tests/integration/hqProducts.test.ts` (temp copies of `tools/e2e/hq-products`, a temp git repo as
`HQ_WRITE_DIR`), `tests/parity/hqProducts.parity.test.ts` (same answers **and the same bytes on
disk** as `simple-server.js` for GET/PUT/POST).

## hq write-back (B5b) and snapshots (Z9)

Roadmap D6, D13, D14, §4a "How the app syncs". Three pieces, all git through
`src/services/hq-git.ts`:

| File                                                    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/hq-git.ts`                                    | `runHqGit(cwd, args, { token, timeoutMs })`: `execFile` with an argument array, timeout (60 s; network calls 120 s, `SIGKILL`), identity `Verwaltung (App) <verwaltung@bakery.local>` as author **and** committer, `HqGitError.code` (`git_missing`, `git_timeout`, `not_a_repo`, `network`, `push_rejected`, `rebase_conflict`, `repo_locked`, `git_failed`; classification in `hq-writeback.core.js`). The token goes in only as an env var read by a one-call credential helper (like `hq-sync.sh`), never in args/URL/config. **Two locks** per **common git dir** (so the `app/edits` worktree and the `main` snapshot worktree share them), each an in-process FIFO queue plus a lock file against other processes (the CLI): `withRepoLock` (`bakery-app.lock`, wait 60 s) for worktree steps - commit, rebase, reset, cherry-pick, fast-forward - seconds only, what a product save waits for; `withNetworkLock` (`bakery-app-net.lock`, wait 9 min > worst network job) for fetch, push and `update-ref refs/remotes/*` (two fetches at once fail on the ref lock). **Never do network I/O under the local lock**, and never take the network lock inside the local one (a network job may take the local lock inside - no deadlock). Stale lock (pid dead or > 10 min) is taken over via a `<lock>.takeover` guard that re-reads the file, so two waiters cannot both delete. Never written into a non-repo. `readBlobs` (`cat-file --batch`) |
| `services/hq-edits-sync.service.ts` (`HqEditsSync`)     | B5b: push `app/edits` + one rolling PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `services/hq-snapshots.service.ts` (`HqSnapshotWriter`) | Z9: `data/production/**` to `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `services/github-pr.ts`                                 | find/open the PR via `fetch` (REST, `GITHUB_API_URL`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `services/hq-writeback.core.js`, `hq-snapshots.core.js` | pure rules: error classes, PR body, editors from trailers; snapshot whitelists + German Markdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**B5b flow** (`HqEditsSync.sync()`, after every B5 commit via `afterCommit`, every
`HQ_SYNC_RETRY_MS` = 15 min via an unref'd timer, `POST /api/hq-sync/retry`; concurrent calls
coalesce into one rerun; never rejects - failures go to `lastError`). fetch and push run under
the network lock; steps 2-5 under the local lock (the products service takes that lock for its
write + commit, so a rebase never meets a half commit, and a save never waits for GitHub -
test "a product save does not wait for a slow fetch"); the GitHub API with no lock held:

1. branch must be `app/edits` (`wrong_branch`); `fetch --prune origin main` + `app/*` (a glob, so a
   missing remote `app/edits` is no error); re-read the approved products from `origin/main`.
2. tracked changes in the worktree → `worktree_dirty`, stop.
3. nothing of ours above `origin/main` → `merge --ff-only` (the PR was merged; `mergedSince` set,
   `prUrl` cleared). **Squash merge, by content** (`mergedPrefix`, only when main moved past our
   fork point): the newest of our commits C such that every file changed between the fork point
   and C has the same content in C and on `origin/main` - commits up to C are merged. All of them
   → `reset --keep origin/main`; some → `rebase --onto origin/main C` replays only the newer ones.
   Works when main moved on with other paths (the daily reports) and when one product was edited
   twice in the PR (a whole-tree compare would not, and the plain rebase would conflict forever).
4. else `rebase origin/main` (skipped when already on top). Conflict → `conflictedFiles`,
   `rebase --abort`, `lastError { code: 'rebase_conflict', files }`; local commits stay, nothing is
   pushed.
5. **Foreign commits on `origin/app/edits`** (someone fixed the PR by hand: non-merge commits not
   on main, not committed as the app, not patch-equal to ours) are cherry-picked onto HEAD, so the
   force-push keeps them; an already-applied pick is skipped. A conflicting pick rolls all picks
   back, `lastError { code: 'foreign_conflict', files }`, **nothing is pushed** (never overwrites
   a person's commit). Merge commits ("Update branch", resolutions made in the GitHub UI) are not
   adopted - main is rebased in anyway; a conflict resolved in a GitHub merge commit is lost.
6. `push --force-with-lease=refs/heads/app/edits:<remote value just fetched, '' = must not exist>
origin <sha>:refs/heads/app/edits` - the sha prepared under the local lock; a save committed
   meanwhile goes with the next run. Rejected lease → fetch, prepare again, push once more.
7. `ensurePullRequest`: `GET /repos/{repo}/pulls?state=open&head={owner}:app/edits&base=main`,
   `POST` only if none (a 422 "already exists" race looks again). Title "Stammdaten aus der
   Verwaltung", German body with the changed files and the editors' **names** from the
   `Co-authored-by` trailers (no mail). The body is written at opening only; later pushes update
   the PR by themselves. Called after every push and while `prUrl` is unknown (a failed attempt
   is retried; `github_failed` keeps the push).

**Disabled** without `HQ_WRITE_DIR` or without a token (`HQ_GITHUB_TOKEN`, fallback
`GITHUB_TOKEN` - the box's env already uses `HQ_GITHUB_TOKEN`): saves still commit locally (B5),
the status says why. `createApp()` without `hqSync` builds disabled instances (tests stay
hermetic); `server.ts` builds the real ones from `loadHqSyncConfig()` (`HQ_GITHUB_REPO` default
`H-Bakery/hq`, `GITHUB_API_URL`, `HQ_SYNC_RETRY_MS` ≥ 1000), calls `edits.init()` (reads
`origin/main` without fetching), starts both timers after `listen` and stops them on close.

**pendingApproval against `origin/main`.** `HqProductsService` takes `approvedFiles()` (file name
→ raw content of `products/*.md` on `origin/main`, refreshed after every fetch) and compares the
write worktree with it; `approved` (the management view) is parsed from the same content. Only
before the first read (no write dir, no `origin/main`) does it fall back to the read clone, which
lags up to 10 min behind `main`. Rebase/fast-forward call `onWorktreeChanged` → the products
cache is invalidated.

**Status** `GET /api/hq-sync/status` (`inhaber`, any session kind) → `{ success, data: { enabled,
reason, branch, baseBranch, repo, pendingCommits (not on GitHub: neither on origin/app/edits nor
merged), unmergedCommits (waiting for approval), lastPushAt, lastAttemptAt, lastError { code,
message (German), detail (git stderr ≤ 500 chars), files?, at }, prUrl, mergedSince (first time
nothing waited; null while something waits), running, snapshots: { enabled, reason, branch,
pendingCommits, lastCommitAt, lastPushAt, lastAttemptAt, lastError } } }`. `POST /retry` runs both
syncs and answers the same. `lastError.code` adds `wrong_branch`, `worktree_dirty`,
`github_failed`, `write_failed` to the git codes.

**Z9 snapshots** (`HqSnapshotWriter`, `HQ_SNAPSHOT_DIR` = a second worktree of the write clone on
`main`; must not be inside/around the read clone or `HQ_WRITE_DIR`, absolute in production;
unset = off):

- **Backzettel:** the Z3 service got hooks `createBackzettelService(source, { onConfirmed,
onReopened })` (router options of the same name); `onConfirmed` is called after the confirm transaction with the confirmed day view
  and `req.user.role`; `app.ts` wires it to `snapshots.backzettelConfirmed()`, which runs in the
  background (`idle()` for tests) - **a confirm never waits for or fails because of hq**. Writes
  `data/production/backzettel/<date>.json` (schema 1: sections/lines with base, seasonal,
  preorders, cap, correction, total, tray, plu; Hefeteig with weighing list; fillings with scaled
  recipe; prep; warnings `{code, message}`; `confirmed { at, role }`) and `.md` (German:
  "# Backzettel Samstag, 28.11.2026", "Freigegeben (Backstube) am … um … Uhr.", tables per
  section, Hefeteig/Wiegeliste, Füllungen, Vorbereitung, Hinweise). The JSON carries
  `status: 'confirmed'`. **Reopen** (`onReopened(date, { role })` → `backzettelReopened()`)
  replaces both files with a note: JSON `{ status: 'reopened', date, reopened: { at, role } }`
  (no sections - the released version no longer holds), `.md` "# Backzettel 28.11.2026: wieder
  geöffnet", commit `chore(production): Backzettel <date> wieder geöffnet (App)`; the reopen reason
  (free text) stays out. The next confirm writes the full Backzettel again.
- **Vorbestellungen:** `cli.js snapshot-preorders [--date YYYY-MM-DD]` (default today, Berlin -
  the day that just ended at 22:15; never migrates; waits up to 5 min for the local lock and 9 min
  for the network lock if the server holds them; exit 0 whenever the file is written and committed
  (`outcome.written`) even if the push must wait - the server's 15-min timer pushes it; 1 on bad
  input / missing `HQ_SNAPSHOT_DIR` / nothing written) from
  `deploy/systemd/bakery-snapshot-preorders.{service,timer}` (22:15). Uses
  `PreordersService.day()`; writes `data/production/vorbestellungen/<date>.json` with
  `preorderCount`, `items [{productId, variant, name, unit, quantity, preorders}]` (`variant`
  only if it is one of the product's variants in `backzettel.yaml` - a product without master data
  takes any slug, and a slug is free text; others are merged into `variant: null`), `channels`
  (all five, zeros included), `pickupPoints [{id, name, count}]` (`laden` first). Cancelled ones
  are not counted. **No timestamp**, so a rerun on unchanged data commits nothing.
- **No personal data (D13), by whitelist** in `hq-snapshots.core.js`: no confirmer/corrector/
  ticker names or ids (only the confirming role), no free-text correction reasons (they may name
  a customer), no deltas, preorder ids or codes, no customer names, phones, notes, no money, no
  unconfigured variant slugs; warnings that quote a raw slug (`variant_ignored`,
  `unknown_variant`, `unknown_correction`) get a fixed text with the item id only. A new field in
  the day view stays out until added there on purpose.
- git: write files atomically, `add -A -- data/production`, commit **with the pathspec
  `data/production`** (a foreign file staged in the worktree stays staged, uncommitted - test),
  message `chore(production): Backzettel <date> (App)` / `Vorbestellungen <date> (App)`, no
  `Co-authored-by` (no names) - write + commit under the local lock, then, released, the push
  under the network lock: `origin <sha>:refs/heads/main`; rejected → fetch, `rebase --autostash`
  onto `origin/main` (local lock) + one retry; conflict → `rebase --abort`, `rebase_conflict` with
  files, commit kept; offline or network lock busy (`network`, `repo_locked`) → commit kept,
  pushed by the 15-min timer or `/retry`. `SnapshotOutcome.written` says the snapshot is on disk
  and committed regardless of the push.

Tests: `tests/unit/hqWritebackCore.test.js`, `tests/unit/hqSnapshotsCore.test.js` (planted
"personal" markers must not come out), `tests/integration/hqGit.test.ts` (queue across worktrees,
lock file across processes, timeout/error codes, token never in args),
`tests/integration/hqEditsSync.test.ts` (push + one PR, merge and squash merge detected,
pendingApproval vs. a stale read clone, rebase, conflict, rejected lease → retry, offline + timer,
GitHub 500, parallel saves), `tests/integration/hqSnapshots.test.ts` (confirm → origin main,
pathspec, rejected push → rebase → retry, offline, parallel, no-op, conflict, wrong branch),
`tests/integration/hqSnapshotsCli.test.ts`. All against temp **bare repos as origin**
(`tests/helpers/hqRemote.ts`). Fixup tests: squash merge after main moved (same product twice,
and with a newer local edit), foreign commit adopted / conflicting foreign commit never
overwritten, slow fetch does not block a save, disabled sync falls back to the read clone,
network-lock queue + stale takeover guard (`hqGit`), reopen note and push waiting on another
process's network lock (`hqSnapshots`), CLI waiting for the server's locks (`hqSnapshotsCli`) and a local fake of the GitHub pulls API (`startFakeGitHub`) -
never GitHub. `tests/setup-ts.js` unsets `HQ_SNAPSHOT_DIR`, `HQ_GITHUB_TOKEN`, `GITHUB_TOKEN`,
`GITHUB_API_URL`, `HQ_GITHUB_REPO`.

Box: `install.sh` creates the write clone (`bakery.role=write-clone`, branch `app/edits`) and
`git worktree add $HQ_SNAPSHOT_DIR main`; runbook §6.1. Before the first push H1 must be merged
(the pipeline's push to `main` would otherwise commit without pathspec and get rejected by ours),
H2 for the auto-merge.

## Partners (B6)

Backschrank partners (CAP-Markt). Formulas once in `src/services/partner-stats.core.js` (see the
"Verkaufspartner" section of the website `CLAUDE.md`); routes in `src/routes/partner.routes.ts`,
`createPartnerRouter({ productsDir })` - `app.ts` passes the hq products dir of B5, so products and
partners read the same catalogue. Slug and weekday rules live in `partner-import.core.js` and are
shared by the routes and the import.

| Endpoint                                                                                                                                                         | Who                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `GET /api/partners[?active=]`, `GET /:id`, `/:id/templates`, `/:id/visits[?from&to]`, `/:id/visits/today[?date]`, `/:id/stats`, `/:id/report`, `/:id/report.csv` | any session                    |
| `POST /:id/visits`, `PATCH /:id/visits/:visitId`, `DELETE /:id/visits/:visitId`                                                                                  | `inhaber`, `verkauf`, `fahrer` |
| `POST /api/partners`, `PUT /:id`, `PUT /:id/templates/:weekday`                                                                                                  | `inhaber`                      |

Shapes are the mock's (D3; `tests/parity/partners.parity.test.ts` covers all 14 routes): partner
and template objects as before, visits as `PlainVisit`, `DELETE` → 200
`{ id, deleted: true, message: 'Besuch gelöscht.' }`, template `PUT` → 200 (also on create).
Errors via `sendError` (`success: false`, `error`, German `message`): 400 `INVALID_NAME` /
`INVALID_SLUG` / `INVALID_ACTIVE` / `INVALID_SETTLEMENT_MODEL` / `INVALID_WEEKDAY` /
`INVALID_ITEMS` / `INVALID_VISIT_TYPE` / `INVALID_VISIT_AT` / `INVALID_BUSINESS_DATE` /
`INVALID_RANGE` / `TEXT_TOO_LONG`, 401 `unauthorized`, 403 `forbidden` (the role check runs before the 404), 404
`PARTNER_NOT_FOUND` / `VISIT_NOT_FOUND`, 409 `PARTNER_SLUG_TAKEN` / `DUPLICATE_INITIAL_VISIT`,
503 `hq_unavailable`, 500 `*_FAILED`.

What to know before changing it:

- **Visit items are resolved against the hq catalogue** (`catalogueFor(productsDir)`, read clone =
  approved prices): by slug, else by `numeric_id` (the mock's `findHQProduct` order), through
  `validateVisitItems(items, lookup)`. Name and ids come from hq; the price from hq unless the
  request sends one (mock rule). PATCH adds the stored snapshot as a fallback
  (`snapshotLookup`), so a product removed from hq stays correctable; POST does not. An unknown
  product while the catalogue directory is missing is 503 `hq_unavailable`, not a 400.
  Integration tests that post visits with items need a synthetic catalogue:
  `createTestApp({ app: { hqProducts: { productsDir: makeProductsDir(), writeDir: null } } })`.
- **The duplicate-initial check (POST and PATCH) and the slug check run inside the write
  transaction** (`assertNoOtherInitial` / `assertSlugFree` throw a `RouteError` that rolls back and
  is answered with its code). Write transactions are serialised (see Startup), so this
  check-then-insert cannot race; `tests/integration/partners.test.ts` fires parallel requests.
  A PATCH that moves a visit to another day gives it the next `sequence` there.
- **Attribution (D5):** `staffId` = `req.user.id` (a body `staffId` is ignored), `staffName`
  defaults to `req.user.displayName`. `audit()` in the write's transaction: `partner`
  create/update (field names only, no contact data), `partner_template` create/update,
  `partner_visit` create/update/delete (delete stores the whole visit, so a mistaken delete can be
  reconstructed).
- **Template `PUT`** fills `productId`/`productSlug` from hq, drops quantity 0, keeps `active`
  when the body does not name it (before B6 every save re-activated the template). Since the W4
  verification it validates like visits (`validateTemplateItems` in the core): quantity an integer
  0…10000 (`2.5`, `-3`, `1e9` are 400 `INVALID_ITEMS`, no longer truncated or dropped), the
  product must be in hq **or already in the stored template** (so a product removed from hq does
  not block saving), no duplicates; hq missing → 503. The quantity flows unchecked into the
  Backzettel CAP column, so this is the only gate.
- **Limits (W4 verification):** partner text fields (`name` 120, `slug` 80, `street`/`city`/
  `contactName` 120, `zip` 16, `phone` 40, `email` 200, `notes` 2000) and visit `staffName` 120 /
  `note` 2000 → 400 `TEXT_TOO_LONG`; a visit's business day must lie between 2020-01-01 and
  today + 7 days (POST and PATCH) → 400 `INVALID_BUSINESS_DATE`.
- Deliberate deviations from the mock: error codes; `GET …/templates` does not create empty
  templates on read; `from > to` is 400; PATCH with `visitAt` alone keeps the business day;
  an unknown `settlementModel` is 400; the template item checks and the limits above (the mock
  truncates/drops and has no limits - the parity suite only sends valid input there).
- The management app downloads the CSV through `apiClient.getBlob()` with the Bearer token
  (`downloadReportCsv()` in `partnerApi.ts`, F4); the old plain link is gone.

### `import-partners` CLI

```bash
npm run build:api
npm run api:import-partners -- --file apps/bakery-api/data/partner-store.json --dry-run
npm run api:import-partners -- --file apps/bakery-api/data/partner-store.json [--update-partners]
```

Copies the mock's `partner-store.json` into SQLite (`DB_PATH`, server rules, runs migrations).
Rules in `src/services/partner-import.core.js` (`planImport`: normalise, natural keys, problems),
writes in `partner-import.service.ts` (`importPartnerStore`): **one** serialised transaction,
all or nothing. Idempotent: partners by slug (existing ones untouched unless
`--update-partners`), templates by partner + weekday (same), visits by partner slug + business
day + type + `visitAt` (existing ones skipped, never changed). Items keep their price/name
snapshot from the file (no hq lookup) but must pass `validateVisitItems`; the mock's `staffId` is
dropped (it points at no user), `staffName` stays. A visit that fails the rules, or an initial
visit on a day that already has another one in the database, is skipped and listed. `--dry-run`
runs the same transaction and rolls it back (it still migrates a fresh `DB_PATH`). One
`audit_log` row (`import`, `partner_store`). Exit 0 = all imported or already there, 2 = entries
skipped (listed), 1 = unusable file (checked before the database is opened) or error. Tests:
`tests/unit/partnerImportCore.test.js`, `tests/integration/partnerImport.test.ts`,
`tests/integration/partnerImportCli.test.ts`; fixture `tests/fixtures/partner-store.synthetic.json`.

## Preorders (B7) and anonymisation (P4)

Vorbestellungen for every channel in one table (`preorders` + `preorder_items`, baseline schema).
Rules **once** in `src/services/delivery-preorders.core.js` (dependency-free CommonJS; the mock's
Mörsbach routes keep using the same file): channels, statuses, transitions, input normalisation,
codes, sums, day summary, the mapping to/from the mock shape and the anonymisation cutoff.
DB + transactions + audit in `src/services/preorders.service.ts`, routes in
`src/routes/preorders.routes.ts`, import/anonymise in `src/services/preorders-maintenance.ts`,
the Backzettel-variant hook in `src/services/preorder-variants.ts`.

| Endpoint                               | Who                                                | Answer                                                                                                                   |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/preorders`                   | verkauf, fahrer                                    | `{ success, data: Preorder[], count }`; filters below                                                                    |
| `GET /api/preorders/sums?date=`        | verkauf, fahrer, backstube                         | `{ success, data: { date, pickupPointId, preorderCount, items, summary } }` (`summary` since W4)                         |
| `GET /api/preorders/day?date=`         | verkauf, fahrer                                    | `{ success, data: { date, pickupPointId, summary, sums, pickupPoints, preorders } }`; optional `&pickupPointId=` (P2)    |
| `GET /api/preorders/pickup-points`     | verkauf, fahrer                                    | `{ success, data: (PickupPoint + updatedAt)[] }`                                                                         |
| `PUT /api/preorders/pickup-points/:id` | inhaber                                            | `{ success, data: PickupPoint + updatedAt }` (P2); 400 `invalid_window` / `Text too long`, 404, 409 `stale_pickup_point` |
| `POST /api/preorders/bulk-status`      | verkauf; fahrer only `abgeholt` / `nicht_abgeholt` | `{ ids, status?, notCollected?, paid?, expectedUpdatedAt? }` → `{ success, data: { counts, results } }` (W4)             |
| `GET /api/preorders/variants`          | verkauf, fahrer                                    | `{ success, data: { [productId]: string[] }, configured, count }` (P1)                                                   |
| `GET /api/preorders/:id`               | verkauf, fahrer                                    | `{ success, data }`; 404 `not_found`                                                                                     |
| `POST /api/preorders`                  | verkauf                                            | 201 `{ success, data }`                                                                                                  |
| `PATCH /api/preorders/:id`             | verkauf                                            | `{ success, data }`; partial; a date/place change renews the code; optional `expectedUpdatedAt`                          |
| `POST /api/preorders/:id/status`       | verkauf; fahrer only `abgeholt` / `nicht_abgeholt` | `{ status?, notCollected?, paid?, expectedUpdatedAt? }` → `{ success, data }`                                            |
| `POST /api/preorders/:id/cancel`       | verkauf                                            | `{ expectedUpdatedAt? }` → `{ success, data }` (status `storniert`; nothing is ever deleted)                             |

`inhaber` passes every check. `sums` items = `[{ productId, variant, name, unit, quantity,
preorders }]`, everything except `storniert`, optionally `&pickupPointId=`; `summary` is the same
`core.summarizeDay()` as `/day` (counts, totals, `byStatus` incl. `storniert`) - **no names or
phones**, so the Backliste reads `/sums` instead of `/day` (W4). The role `backstube` gets `/sums`
**without `summary`** (no amounts, no paid state - it may not read `/day` either; its screens do
not use it). List filters: `date`
or `from`/`to`, `status` (comma list), `channel`, `pickupPointId` (`laden` = no point), `q`
(name/code; phone digits from 3 on; LIKE wildcards stripped). `Preorder` = `{ id, code, channel,
customerName, customerPhone, pickupDate, pickupTime, pickupPointId, pickupPoint
{ id, name, window } | null, status, notCollected, notCollectedAt, paid, note, items [{ productId,
name, variant, unit, unitPrice, quantity, lineTotal }], total, pickedUpAt, anonymizedAt,
createdBy, updatedBy, createdAt, updatedAt, deadline, afterDeadline }`. Errors via `sendError`:
400 `invalid_*` / `unknown_product` / `unknown_pickup_point` / `variant_required` /
`invalid_delivery_day` / `invalid_quantity` / `invalid_expected_updated_at`, 403 `forbidden`,
404 `not_found`, 409 `already_picked_up` / `cancelled` / `anonymized` / `has_variants` /
`stale_preorder` / `not_collected_too_early`.

- **Bulk status (W4).** `POST /bulk-status` changes many preorders in **one** serialised write
  transaction (Abholliste: „alle bereit", Tagesabschluss „nicht abgeholt"). Body: `ids` (1-200
  positive integers or canonical digit strings like `"7"`, duplicates merged; else 400
  `invalid_ids`), the same change fields as `/:id/status` (at least one, else 400
  `invalid_status`; values that are wrong for every preorder - unknown `status`, non-boolean
  `paid`/`notCollected`, `notCollected` with a status other than `bereit` - are one top-level
  400 `invalid_status` / `invalid_paid` / `invalid_not_collected`, not `refused` per id), optional `expectedUpdatedAt` as a map
  `{ "<id>": "<ISO>" }` (not an object → 400 `invalid_expected_updated_at`; an id without entry
  is not checked). Each id runs through the same `changeStatusIn()` as the single route - same
  rules, same fahrer targets, same `not_collected_too_early` - and gets one result:
  `ok` (with the new `data`), `conflict` (`stale_preorder`, `already_picked_up`, `cancelled`;
  with the current `data`), `anonymized`, `not_found`, `refused` (any other rule, with `error` +
  German `message`). `counts` per outcome. One failing id never rolls back the others; a thrown
  error rolls back all. Audit rows as for single changes plus `bulk: true`.
- **„Nicht abgeholt" only from the pickup day on (W4).** `/:id/status` and `/bulk-status` refuse
  `notCollected: true` before the pickup date (Berlin today) with 409 `not_collected_too_early`
  - until then the customer can still come. Core option `notCollectedFrom` of
    `normalizeStatusChange`; the Mörsbach alias does not pass it (mock contract, parity).
- **Pickup point texts are limited (W4)**, in `core.normalizePickupPointInput` and therefore on
  both servers and the alias (`PICKUP_POINT_LIMITS`): name 100, street 200, zip 10, city 100,
  notes 2000 characters (trimmed) → 400 `Text too long` with a German message. The `PUT` on
  `/api/preorders` additionally takes `expectedUpdatedAt` (the `updatedAt` from
  `GET /pickup-points`): changed meanwhile → 409 `stale_pickup_point` with the current
  `updatedAt`, nothing written; malformed → 400 `invalid_expected_updated_at`. The alias answers
  without `updatedAt` (deep-equal to the mock).

- **Per-place day (P2).** `GET /day?date=&pickupPointId=` narrows `preorders`, `summary` and
  `sums` to one place (`laden` = no point, otherwise a point id; parsed like the list filter, an
  empty value is 400 `invalid_pickup_point`) and echoes `pickupPointId` (`null` without the
  filter). `pickupPoints[].preorderCount` still counts the whole day. This is what the
  Abholliste and the Mörsbach screens read - one request, totals from the server.
- **Editing a pickup point (P2).** `PUT /pickup-points/:id` (only `inhaber`) takes the mock's
  Lieferstelle body (`name`, `street`, `zip`, `city`, `weekday`, `window`, `orderDeadline`,
  `notes`, `active`) via `service.updatePickupPoint`, the same function the Mörsbach alias
  `PUT /api/deliveries/preorders/pickup-points/:id` uses; audited.
- **Stale writes (P1/P3 fixup).** `PATCH /:id`, `POST /:id/status` and `POST /:id/cancel` take an
  optional `expectedUpdatedAt` (the `updatedAt` of the copy the client loaded, ISO). If the
  preorder changed since, the answer is 409 `stale_preorder` with `message` and the current
  `updatedAt`, and nothing is written - checked by `expectedVersionGuard()` inside the write
  transaction. Without the field there is no check (alias, import, old clients: last writer
  wins). The management app always sends it and its edit form PATCHes only changed fields, so an
  open edit form cannot reset `paid` after a driver handed the order over elsewhere.
- **`storniert` is locked on `/api/preorders` (not on the alias).** A PATCH that keeps the status
  `storniert` but changes items, pickup date, place, time or channel is 409 `cancelled`; name,
  phone, note and paid stay editable, and the same PATCH with `status: 'offen'` goes through
  (core option `lockCancelled`, mirrors the `abgeholt` lock). The Mörsbach alias does not pass the
  option - the mock lets a cancelled preorder be edited and the parity test keeps that.

- **Channels** `laden | telefon | whatsapp | shop | sammelstelle`. Pickup is either the Laden
  (`pickupPointId: null`, date + optional `HH:MM`) or a pickup point (date must be its weekday, no
  time - the window applies; `sammelstelle` requires a point; inactive points are refused).
- **Statuses** `offen → bereit → abgeholt | storniert`; `abgeholt ↔ storniert` is locked (409), so
  a paid handover cannot fall out of the accounts and a late handover from a dead spot cannot
  revive a cancelled one. **`abgeholt` is history**: while a preorder is `abgeholt`, a PATCH that
  changes its items, pickup date or place is 409 `already_picked_up` (sums and day totals would
  change after the fact); plain fields (note, paid, …) stay editable, and the same PATCH with
  `status: 'offen'` goes through. **"nicht abgeholt" is not a status**: it is `bereit` +
  `not_collected_at` (migration `20261113000000-preorders-b7.js`, which also seeds the Mörsbach
  point), set with `{ notCollected: true }` (fahrer: target `nicht_abgeholt`), cleared by any
  other status.
- **Mock mapping** (alias and import): `open → offen` (an incoming `open` on a `bereit` preorder
  keeps `bereit`), `handed_over → abgeholt`, `not_collected → bereit + notCollectedAt`,
  `cancelled → storniert`; back: `offen`/`bereit` → `open` unless `notCollectedAt` is set.
  **Handover means paid** on both mock paths: the import and an alias `handed_over` (from any
  other status) set `paid: true` - Mörsbach collects at the handover and the old form has no
  paid switch. Reopening does not clear it.
- **Items** carry a **price/name/unit snapshot** from the approved hq catalogue (`getProduct`);
  duplicates of product + variant are merged; a product without a price is 400. **Quantities**
  are whole numbers (number or digit string, `core.parseQuantity`); `"abc"`, `2.7`, negatives,
  `null` or a missing quantity are 400 `invalid_quantity` - nothing is truncated or dropped
  silently, only an explicit `0` removes a line (same rule as the partner visits). The mock's
  `normalizePreorderInput` still coerces; the alias therefore rejects what the mock would drop.
  **Variant** `''`
  = none (never null). If `hq/config/backzettel.yaml` exists (found like Z3's loader:
  `HQ_BACKZETTEL_CONFIG`, `${HQ_DIR}/config/backzettel.yaml`, next to the products dir), a product
  of a Backzettel item with Sorten **must** name one of them (400 `variant_required` /
  `invalid_variant`) and a product without Sorten must not; a product not in the config, or no
  config at all, accepts any slug. Cached 60 s + mtime; an invalid config is warned once and
  ignored. `createApp({ preorders: { variantsForProduct } })` overrides the hook (tests;
  `tests/setup-ts.js` points `HQ_BACKZETTEL_CONFIG` at a missing file).
- **`GET /variants` (P1)** lists, from the same `backzettel.yaml` as the check above, every
  product that **must** name a Sorte: `{ mustersemmel: ['nuss', 'schoko'] }` (products without
  Sorten are absent; `backzettel.core.js` `variantsByProduct`, `createVariantsHook().all()`).
  `configured: false` and `{}` without a valid config - the API then accepts any slug and the
  entry form offers none. `createApp({ preorders: { variantsMap } })` overrides it; a test that
  passes only `variantsForProduct` gets `configured: false`. Mounted before `/:id`.
- **Codes** `<PREFIX>-<YYYY-MM-DD>-<nn>`: the pickup point's prefix (`MO` for Mörsbach, as in the
  mock) or `LA` for the Laden. **Single-use**: every code ever handed out is registered in
  `preorder_codes` (B7 migration, backfilled from `preorders.code`) in the same transaction, and
  `allocateCode()` numbers over the registry plus the table. So neither a cancelled code nor the
  old code of a preorder that moved to another date or place (which renews its code, audited with
  `previousCode`) ever goes to another customer - an Abholzettel or a printed list may still
  carry it. Moving back gets a fresh number, too. The import registers the references it keeps.
- **Audit**: every write (`create`, `update` with `changed`, `status`, `cancel`, `import`,
  `anonymize`, pickup point `update`) in the write's transaction; a no-op update writes nothing.
  Audit data never holds customer names, phones or notes - otherwise P4 would have to scrub
  `audit_log` as well.
- **Mörsbach alias `/api/deliveries/*`** keeps the mock contract where the screens look (parity
  test): `GET /pickup-points`, `PUT /pickup-points/:id` (inhaber),
  `GET /preorders[?date&status&pickupPointId]`, `GET /preorders/summary?date=`,
  `GET/PATCH/DELETE /preorders/:id`, `POST /preorders`. Deliberate differences: `hasPickupStop`
  means "the point is served that weekday" (no tours, D11); the PUT does no geocoding (an address
  change clears the coordinates); Laden preorders are invisible there (404); a PATCH with `items`
  on a preorder that has variants is 409 `has_variants` (the old form cannot show them and would
  drop them); fahrer may PATCH only `{ status: handed_over | not_collected }`. A PATCH whose
  body is **only** `{ status }` goes through `changeStatus` (no re-validation of weekday, items
  …), so a preorder stays hand-over-able after the inhaber changed the point's weekday; a full
  form save still re-validates. The alias guards (Laden → 404, legacy transition locks) run
  inside the write's transaction, also for DELETE. Answers carry
  `code`, `channel`, `paid` (and `variant` per item) in addition.
- **Shop `POST /api/orders`** (verkauf) validates with `shop-orders.core.js` and creates a `shop`
  preorder for the Laden; it answers in the mock's shape with `id` = code and `orderNumber` =
  preorder id. **It stays behind the global auth guard** - the public shop cannot order until a
  public order endpoint is designed (rate limit, spam, owner decision). The e-mail address is not
  stored (no column, not needed for pickup).
- **P4 anonymisation**: `anonymizePreorders({ today, days = 90, dryRun })` sets
  `customer_name = 'anonymisiert'`, clears phone **and note** (free text often holds personal
  data), sets `anonymized_at` and writes one `anonymize` audit row each (code, date, status - no
  names) - for **every** preorder whose pickup date lies more than 90 days before `today`
  (Berlin), **whatever its status** (roadmap P4 has no status condition; a handover nobody ticked
  off must not keep a name forever). The report lists `anonymized[{ id, code, pickupDate,
status }]` and `unfinished` = how many of them were still `offen` / plain `bereit` (a hint that
  handovers are not being ticked off). An anonymised preorder can no longer be edited or change
  status (409 `anonymized`). Backups keep the names until they rotate out (runbook §5.1).

CLI (`dist/apps/bakery-api/bundle/cli.js`, same `.env`/`DB_PATH` rules as `create-user`; JSON
report on stdout, a summary on stderr):

```bash
node dist/apps/bakery-api/bundle/cli.js import-preorders --file apps/bakery-api/data/delivery-store.json --dry-run
node dist/apps/bakery-api/bundle/cli.js anonymize-preorders [--dry-run] [--days 90] [--today YYYY-MM-DD]
```

`import-preorders` reads the mock's `delivery-store.json` (pickup points + preorders), creates
missing points, maps statuses as above (`handed_over` ⇒ paid), keeps references as codes (a taken
code gets the next free number) and `createdAt`. **Idempotent** through the audit rows
(`action: 'import'`, `data.sourceReference`); `--dry-run` does the same work in a rolled-back
transaction. `anonymize-preorders` runs nightly from `deploy/systemd/bakery-anonymize.timer`
(23:45 Europe/Berlin, after the 23:30 backup). **It never migrates**: with pending migrations it
exits 1 and names them (`pendingMigrations()` in `db/migrate.ts`), so a deploy whose API restart
failed does not get its schema changed under the old process at night. `import-preorders` and
`create-user` (run by hand) still migrate first.

Tests: `tests/unit/preordersModel.test.js` (core), `tests/unit/preorderVariants.test.ts`,
`tests/integration/preorders.test.ts` (every route incl. roles),
`tests/integration/preordersMaintenance.test.ts` (import, anonymise, CLI),
`tests/parity/preorders.parity.test.ts` (alias vs. `simple-server.js`), and the B7 migration in
`tests/migrations/pilotBaseline.test.ts`.

## Backzettel API (Z3)

`/api/backzettel` (`src/routes/backzettel.routes.ts` → `src/services/backzettel.service.ts`),
mounted below the global guard. Answers `{ success, data }`, errors via `sendError`. The day is
computed only by `backzettel.core.js` (Z2); `src/services/backzettel-day.core.js` (dependency-free,
`tests/unit/backzettelDay.test.js`) translates between stored rows and the core: input parsing,
preorder snapshot, delta reconciliation, frozen lines. Master data: `backzettel-source.ts`.

| Endpoint                                         | Who                | Body / answer                                                                                |
| ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------- |
| `GET /config`                                    | any session        | `{ status: ok \| no-config, source, config, errors, warnings, recipesMissing, catalogSize }` |
| `GET /:date`                                     | any session        | day (below); `{ date, status: 'no-config', reasons }` without master data                    |
| `GET /:date/prep`                                | any session        | `{ date, weekday, weekdayName, status, prepDate (d−1), prepDateProvisional, prep[] }`        |
| `PUT /:date/season`                              | inhaber, backstube | `{ factor }` (0 < f ≤ 5, 2 decimals, `"1,2"` ok) → day; draft only                           |
| `PUT /:date/lines/:itemId[/:variant]/correction` | inhaber, backstube | `{ correction, reason }`, reason required ≠ 0, 0 clears → day; draft only                    |
| `POST /:date/confirm`                            | inhaber, backstube | → confirmed day                                                                              |
| `POST /:date/reopen`                             | inhaber            | `{ reason? }` → draft day                                                                    |
| `POST /:date/lines/:lineId/done` / `/undone`     | inhaber, backstube | → `{ id, date, itemId, variant, doneAt, doneBy }`; confirmed only                            |
| `POST /:date/deltas/:id/ack`                     | inhaber, backstube | → `{ id, …, acknowledgedAt, acknowledgedBy }`, idempotent                                    |

Day: `{ date, weekday, weekdayName, status: draft|confirmed, seasonFactor, confirmedBy {id,
displayName} | null, confirmedAt, sections[{ id, label, lines[] }], hefeteig, fillings, prep,
prepDate, prepDateProvisional, deltas[], warnings[], configStatus, configChangedSinceConfirm }`
(the last only on confirmed days: `true`/`false`, `null` without valid master data).
`prepDateProvisional` is `true` when d−1 is not a production day (Tuesday after the Monday
Ruhetag, Q-B2 open), `null` without master data. A line is the core line plus `id` (row id or
null in a draft without a stored row), `correctionBy`, `doneAt`, `doneBy`, `delta { qty, open,
count } | null`. `variant` is `null` for "none" in JSON, `''` in the tables and in the URL (omit
the segment). Errors: 400 `invalid_date` / `validation` / `reason_required`, 404 `unknown_item` /
`unknown_variant` / `not_found`, 409 `ruhetag` (weekday not in `config.days`), `no_config` (with
`reasons`), `confirmed`, `not_confirmed`. **Planning window (W4 verification):** season,
correction and confirm only for today − 7 … today + 90 days (Berlin, `PLANNING_DAYS_BACK` /
`PLANNING_DAYS_AHEAD` in `backzettel.service.ts`), otherwise 400 `date_out_of_range` - a URL typo
(`9999-12-31`) used to confirm a day and commit its snapshot to hq `main`. Reads, reopen, ticks and
acks are not limited. Tests pin the clock with `createApp({ backzettel: { now: () => … } })`.

What to know before changing it:

- **Config path:** `HQ_BACKZETTEL_CONFIG`, else `${HQ_DIR}/config/backzettel.yaml`, `HQ_DIR`
  default `<cwd>/../hq`; catalogue `HQ_PRODUCTS_DIR` else `${HQ_DIR}/products`; recipes relative to
  `HQ_DIR`. `createApp({ backzettel: { hqDir, configPath, productsDir, cacheMs } })` overrides; an
  explicit `hqDir` option beats the env for the derived paths. Cached until the YAML/products mtime
  changes, at most 60 s. Missing/invalid → `no-config`, **never** invented numbers. The answer never
  carries the server path except inside a loader read error message.
- **Draft is live:** nothing is stored by reading a draft. Season factor lives in `backzettel_days`,
  corrections in `backzettel_lines` rows (only `correction*` is read in a draft). Preorders =
  `preorders.pickup_date = date`, status ≠ `storniert`, mapped through `item.products[]` factors by
  the core; CAP = active `PartnerDeliveryTemplates` of active partners for the ISO weekday, into
  the `cap` column (the baseline comment "upper limit" predates the plan).
- **Confirm** (serialised transaction): recomputes, upserts every line with a name/section/unit
  snapshot, deletes rows no longer computed, stores `preorder_snapshot` (flat
  `{preorderId, productId, variant, qty}`) and `computed_snapshot`
  (`{ hefeteig, fillings, prep, warnings, unsetKeys }` exactly as the core computed them;
  `unsetKeys` = line keys with `baseUnset`, which `frozenSections` restores so a confirmed line with
  an unset base still reads „offen", not 0), discards old deltas. **Ticks** survive a
  re-confirm only when the line's `base/seasonal/preorders/cap/total` are unchanged
  (`frozenQtyChanged`); otherwise `doneAt`/`doneBy` are cleared and listed as `clearedTicks` in the
  confirm audit row. A draft after reopen already hides such stale ticks.
- **A confirmed day is served from what was stored**: lines from the rows, Hefeteig/fillings/prep/
  warnings from `computed_snapshot` - a later YAML or recipe change does not alter it (test).
  The current master data are only used for `configChangedSinceConfirm` (`snapshotDiffers`) and
  display-only fields (tray, PLU). With broken master data it stays fully readable
  (`configStatus: 'no-config'`). A day without `computed_snapshot` (confirmed before the column)
  falls back to recomputing from the frozen totals. Reopen clears the snapshot.
- **Deltas are recorded on the preorder write path (W4)**, not by reading. `app.ts` wires
  `preorders.service.onWrite(...)` to `backzettel.service.recordPreorderDeltas(dates, ctx)`: every
  preorder create, update (items, pickup date - old **and** new day -, status), status change,
  cancel and bulk status calls it **inside the preorder's own write transaction** with the touched
  pickup dates. For each date that is a confirmed Backzettel day, `reconcileDeltas` compares
  snapshot, current preorders and already recorded rows per preorder × item × variant and adds
  one row per change (`qty` = increment, `kind` added/changed/cancelled) - idempotent, so a no-op
  write or a second call records nothing. Never merged into the frozen lines. Audit
  `deltas_recorded` on `backzettel_day` with `data.via` = `preorder_create` / `preorder_update`
  / `preorder_status` / `preorder_cancel` / `preorder_bulk_status` and the writing user as
  `user_id`; a delta's `createdAt` is now the moment of the preorder change. A draft day records
  nothing. **`GET /:date` and `GET /prep` write nothing within the request**; the confirmed view
  carries `deltasPending` (`true` = the current preorders differ from snapshot + recorded deltas,
  i.e. a reconciliation is due; `null` without valid master data). When a read sees `true`, it
  starts a **background catch-up** for that date (`scheduleCatchUp`: `setImmediate`, own
  serialised transaction, audit `via: 'reconcile'`, user null, one run per date at a time;
  `service.idle()` / `app.locals.backzettelIdle()` for tests) - so a preorder written while the
  master data were broken, or by the CLI import, shows up with the tablet's next reload instead
  of waiting for another write or a restart. The screens show `deltasPending` as a notice and
  reload after 5 s (`DELTAS_PENDING_RELOAD_MS`, at most 6 times).
- **Reconciliation for writes without master data.** If `backzettel.yaml` is missing or invalid
  while a preorder changes, the hook cannot compute and records nothing (warned once per day and
  process, the preorder write still succeeds). Those changes are caught up by
  `reconcileConfirmedDays({ from? })` - every confirmed day from `from` (default: Berlin
  yesterday) on, each in its own transaction, audit `via: 'reconcile'` with `user_id` null
  (system). It runs **once at server start** (in the background after `listen`, logged as
  `[INFO] Backzettel: Deltas nachgetragen für …`), **after every confirm and reopen**,
  implicitly with the next preorder write to that day, and in the background after a read that
  finds `deltasPending: true` (above). Tests call it through
  `app.locals.reconcileBackzettelDeltas`. `createBackzettel(options)` (routes) returns
  `{ router, service }` for this wiring; `createBackzettelRouter()` stays for callers that only
  need the router.
- **Reopen** (inhaber only, station sessions included - owner decision open whether it should
  need `requirePersonalSession` like user admin): back to draft, both snapshots cleared, deltas
  deleted (the audit row keeps them), corrections and ticks stay (see Confirm for stale ticks).
- **Audit** (`audit_log`): `season`, `correction`, `confirm`, `reopen`, `deltas_recorded` on
  `backzettel_day`/date; `line_done`/`line_undone` on `backzettel_line`; `delta_ack` on
  `backzettel_delta`. No-op writes (same value, already ticked/acked) are not audited.
- Migration `20261112000000-backzettel-z3.js` (additive): `backzettel_days.preorder_snapshot`,
  `backzettel_days.computed_snapshot`,
  `backzettel_lines.name/section/unit`, `backzettel_deltas.kind/acknowledged_at/acknowledged_by`.

Tests: `tests/unit/backzettelDay.test.js` (46), `tests/integration/backzettel.test.ts` (28; synthetic
hq written to a temp dir from `tests/fixtures/backzettel.synthetic.js`; preorders inserted via the
models or, for the W4 delta tests, written through `POST/PATCH /api/preorders`, cancel and
bulk-status - create/edit/move/cancel after confirm, parallel GETs record nothing, idempotent
reconcile, broken config → reconcile after repair). `tests/setup-ts.js` points `HQ_DIR`/`HQ_BACKZETTEL_CONFIG` nowhere, like the other hq paths.

## Grundmengen (Z4): base write + reference

Two additions to `/api/backzettel` (registered **before** `/:date`, which would otherwise read
`reference` as a date). Both serve the management screen `/admin/backzettel/grundmengen`.

| Endpoint                          | Who                | Body / answer                                                                                                                                                                                          |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /config` (extended)          | any session        | Z3's answer (approved = what the day computes with) **plus** `pendingApproval`, `writable`, `writeIssue`, `working { status, config, errors, warnings }` (the write-worktree version a save builds on) |
| `PUT /config/base`                | inhaber, backstube | `{ itemId, weekday, value }` or `{ itemId, weekday, variants: { <slug>: n \| null } }` → the `/config` view + `pending`, `changed`                                                                     |
| `GET /reference?weekday=&weeks=6` | inhaber, backstube | `{ status, available, today, weeks, basis, weekdays: [{ weekday, weekdayName, weeks, dates, skippedDates, items: [{ itemId, plu, median, samples, status: ok \| no_plu \| no_data }] }] }`             |

Errors (`sendError`): 400 `validation` (with `errors` for new config errors), `invalid_weekday`
(also a weekday not in `days`), `invalid_quantity` (negative, > 10000, not a number; `"1,5"` is
fine, `""` = `null`); 404 `unknown_item` / `unknown_variant`; 409 `no_config` /
`config_unreadable` / `config_layout_unsupported` / `config_edit_failed`; 500 `hq_commit_failed`;
503 `hq_write_unavailable` / `hq_write_wrong_branch` / `repo_locked`. Without a valid config the
reference answers `status: 'no-config'` with `reasons`, never numbers.

- **Semantics of a weekday value** (Z2): number = Grundmenge, `0` = not baked, `null` = not set yet,
  missing key = 0, object = per variant. `variants` edits only the named slugs: from `null` the
  others stay `null`; from a plain number the number is replaced by the map; from a missing key
  the others are absent (0). Station (PIN) sessions may edit - the Backstube tablet is the point.
- **Comment- and order-preserving edit** (`backzettel-config.editor.js`, `applyBaseEdit(text,
edit)`): `yaml.parseDocument` only to find node ranges, then a **splice** of the original text
  (replace a scalar, insert into a flow or block map sorted by weekday, turn a scalar into a flow
  map); padding per node, trailing comments of a block map stay where they were. The result is
  re-parsed with js-yaml `CORE_SCHEMA` (the loader's parser) and must deep-equal the intended
  object, else `config_edit_failed` and nothing is written. Never re-serialise the whole document
  (`toString()` changes flow padding everywhere). A no-op save returns `changed: false`, writes
  and commits nothing - **zero diff**. An inline item without `base` key is
  `config_layout_unsupported` (edit hq by hand).
- **Validation before the commit:** `validateBackzettelConfig` on before and after; only errors
  the edit **adds** (same path + message, `newErrors`) block - a config with an unrelated known
  error stays editable. To make that reachable from the UI, `working.config` is the normalised
  config **even with `status: 'no-config'`** as long as the YAML parses (`errors` say what is
  wrong); only an unparsable or missing file gives `config: null`. Rules in `backzettel-base.core.js` (`parseBaseEdit`, `nextDayValue`,
  `commitMessage`).
- **Write path = B5's.** `backzettel-config-write.ts`: with `HQ_WRITE_DIR` the file is
  `${HQ_WRITE_DIR}/config/backzettel.yaml` (base text: that file, else the read clone's), branch
  guard, `withRepoLock`, commit `config: Grundmenge <Name> (<id>) <Wochentag> geändert` +
  `Co-authored-by: <displayName> <user-<id>@bakery.local>` with the pathspec, failure restores the
  file and unstages (500). Then `afterCommit` → `HqEditsSync.notifyCommitted()` (push + rolling
  PR, B5b). Without `HQ_WRITE_DIR` (development) it writes straight to the config path, no git;
  production without it is 503. `writable` in `/config` says whether a save can succeed: it runs
  the same checks as the save (dir exists, git repo, branch = `HQ_WRITE_BRANCH`; the branch lookup
  is cached 5 s per writer) and names the failing one in `writeIssue { error, message }` (the 503
  code a save would get), `null` when writable.
- **pendingApproval** = the write-worktree YAML differs from `origin/main`
  (`HqEditsSync.approvedTextFile('config/backzettel.yaml')`, read in `refreshApproved` with the
  products; `APPROVED_TEXT_FILES`), falling back to the read clone before the first read or when
  the sync is disabled. The Backzettel itself (Z3, reference, preorder variants) keeps computing
  with the **approved** read clone until the PR is merged.
- **Reference** (`backzettel-reference.core.js` + `backzettel-reference.ts`): per weekday the
  last `weeks` (default 6, 1-26) same weekdays **before today (Berlin)** that have a report in
  `HQ_REPORTS_DIR/converted` (`reports-files.core.js`); a day without a file is skipped and listed
  in `skippedDates` (looks back at most 26 weeks), never counted as 0. Sold = Σ quantity over the
  item's `plu` list, cancelled receipts out, storno lines negative (as `reports.core`); median to
  one decimal. It counts **pieces sold at the register**, also for Liter/Blech items - the UI says
  "St.". Info only: nothing ever writes it into the config.
- **Bundling:** `yaml` ^2 is a root `dependency` since W4 (before it was only transitive dev, so
  `npm ci --omit=dev` would not have installed it and `build.mjs` bundled it). It is external now
  like every other runtime package; `BUNDLED_PACKAGES` is empty. `build.mjs` still fails when the
  hoisted `yaml` is not 2.x (several packages pin 1.x, which lacks `isScalar`/`isMap`/`isSeq`).
- The Z1 validator formats a fractional quantity with a decimal comma in its message
  (`Menge 12,5 muss bei der Einheit Stück ganzzahlig sein.`) - the message reaches the screen.

Tests: `tests/unit/backzettelBaseEdit.test.js` (parse rules, editor incl. comments, flow/block
maps, no-op zero diff), `tests/unit/backzettelReference.test.js` (synthetic converted reports),
`tests/integration/backzettelGrundmengen.test.ts` (dev mode, write worktree with temp git repo,
B5b push + PR against a bare remote and the fake GitHub, merge clears `pendingApproval`, roles,
reference route). Fixture: `tests/fixtures/backzettel-grundmengen.synthetic.js`.

## Schema (B2)

One baseline migration creates the whole pilot schema: `users`, `refresh_tokens`, `audit_log`,
the four partner tables (`Partners`, `PartnerDeliveryTemplates`, `PartnerVisits`,
`PartnerVisitItems` - names and camelCase columns exactly as before, `staffId` → `users`),
`pickup_points`, `preorders`, `preorder_items` and the Backzettel tables `backzettel_days`,
`backzettel_lines`, `backzettel_deltas` (§5.3; models and extra columns since Z3). New tables are snake_case;
their models use `underscored: true` and camelCase attributes.

- **Idempotent.** Each table is created only if missing (case-insensitive - SQLite treats `Users`
  and `users` as one table). A database that ran the legacy list keeps those names in
  `SequelizeMeta`, runs the baseline once, keeps its partner data, and keeps the legacy tables it
  no longer reads (Products, Orders, ...).
- **Legacy users are rebuilt, not dropped.** A users table without `password_hash` is copied into
  the pilot shape with its ids (so `PartnerVisits.staffId` stays valid): `display_name` from
  first/last name, `admin` → `inhaber`, else `verkauf`, `active = 0`, password hash
  `LEGACY_PASSWORD_HASH` (never a valid scrypt hash). Old bcrypt hashes are not carried over.
  The rebuild is atomic: `PRAGMA foreign_keys = OFF` outside, then create/copy/drop/rename in one
  `BEGIN IMMEDIATE … COMMIT` on the default connection (not `sequelize.transaction()`, which opens
  its own connection with foreign keys on, so the DROP would cascade), and a `foreign_key_check`
  on references to `users` before the commit. A failed copy rolls back to the old table.
- **"No variant" is `''`, never NULL** - `preorder_items.variant`, `backzettel_lines.variant` and
  `backzettel_deltas.variant` are all `NOT NULL DEFAULT ''` (`variantColumn()`). That keeps the
  unique index `(date, item_id, variant)` on `backzettel_lines` sound (NULLs are distinct; an
  expression index would break Sequelize's `describeTable`) and lets Z2 and the preorder sums
  (B7) join and group the three tables without `COALESCE`. Write `''`, not null.
- Weekdays: partners ISO (1 = Monday); `pickup_points.weekday` / `order_deadline.weekday` are JS
  (0 = Sunday), as in `delivery-preorders.core.js`.
- `initializeModels()` initialises only the pilot models (`PILOT_MODELS`). The legacy models
  (Cash, Chat, Product, Order, Inventory, Recipe, Notification\*, Production\*, ...) are still
  exported so unmounted code compiles, carry `@deprecated`, are **not initialised** and have no
  table. `User` keeps `passwordHash`/`pinHash` out twice: the default scope drops them from finder
  queries (login reads them through `User.scope('withSecrets')`), and `toJSON()` always deletes
  them - the scope alone does not cover the instance `User.create()` returns or
  `findAll({ attributes: [...] })`. Never serialise a user by hand around `toJSON()`.

## Tests

Two jest projects in `jest.config.js`, both run by `npx jest -c apps/bakery-api/jest.config.js`
and `npx nx test bakery-api` (`--selectProjects js|ts`):

- `js`: plain-JS tests under `tests/**/*.test.js` (the `*.core.js` business rules, mock server).
  TS sources can be pulled in with `tests/helpers/loadTs.js` (esbuild, same settings as
  `build.mjs`); `tests/unit/apiPlatform.test.js` uses it.
- `ts`: `src/**/*.spec.ts`, `src/**/__tests__/**/*.test.ts`, `tests/**/*.test.ts` through
  ts-jest (transpile-only, `tsconfig.spec.json`, `@bakery/*` from the base paths). Integration
  tests use `tests/helpers/createTestApp.ts` (`createApp()` on `:memory:` + baseline) with
  supertest; `tests/parity/parity.ts` compares the real API with `simple-server.js` (its JSON
  stores redirected to a temp dir). Type errors in tests are caught by
  `nx run bakery-api:typecheck`, which also checks `tsconfig.spec.json`.
- Three TS tests for unmounted domains (inventory, email) are excluded in `EXCLUDED_TS_TESTS`;
  the rest of the roadmap's "31" are `libs/api/*` specs that run in their own nx projects. See
  `tests/README.md`.
- `scripts/boot-smoke.sh`: bundle → `cli.js create-user` twice (create, idempotent reset) on a
  fresh SQLite → start (production mode) → `/health` → 401 without session → login → `/me`,
  `/api/partners`, JSON 404 → restart without re-running migrations → login. Runs in CI in the
  `build (bakery-api)` job; no default account involved.
- Integration tests of other domains need a session: `sessionFor(app, 'test.x', 'inhaber')` and
  `bearer(token)` from `tests/helpers/auth.ts`.

The legacy suites that load `index.js` (`healthAPI`, `securityIntegration`) need
`express-rate-limit` (root dependency, run `npm ci`) and reach `marked`@16, which is ESM-only; the
`js` project maps `marked` to `tests/helpers/markedStub.js`. Both go with the legacy layer in B12.
State on `pilot` after the wave-2 merges: see the integrator's log in `docs/roadmap.md` §11.

## Known state

- Runtime packages the bundle loads (`express`, `cors`, `helmet`, `sequelize`, `sqlite3`, `umzug`,
  `jsonwebtoken`, `express-rate-limit`, `gray-matter`, `js-yaml`, `yaml`) are root
  `dependencies`, so `npm ci --omit=dev` keeps
  them. Since B3 the bundle no longer loads `bcrypt` (scrypt from `node:crypto`, D12). Building
  still needs dev dependencies (esbuild, typescript).
- An old development database keeps the legacy tables after the baseline ran (harmless, unread);
  delete the file for a clean schema.
- The legacy JavaScript layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
  `middleware/`) is not part of the bundle; useful only as domain reference.
