# Bakery API - Backend Service

## Overview

Express + TypeScript backend for the bakery pilot (roadmap `docs/roadmap.md`, D2: the real backend).
Sequelize on SQLite. Built by esbuild into a single file and run with plain `node`.

- **Port:** `PORT`, default 5000
- **Entry:** `src/main.ts` → `src/server.ts` → `src/app.ts`
- **Bundle:** `dist/apps/bakery-api/bundle/main.js` (+ source map); operator CLI
  `dist/apps/bakery-api/bundle/cli.js` (B3, `create-user`)

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

| Path                     | Router                                   | Note                                          |
| ------------------------ | ---------------------------------------- | --------------------------------------------- |
| `/health`, `/api/health` | `routes/health.routes.ts`                | no session; `SELECT 1` if a DB was passed     |
| `/api/auth` (public)     | `routes/auth.routes.ts` (public router)  | login, refresh, pin, station/users - see B3   |
| `/api` (guard)           | `auth/middleware.ts` `requireAuth`       | **everything below needs a session (401)**    |
| `/api/auth` (session)    | `routes/auth.routes.ts` (session router) | me, logout, stations                          |
| `/api/users`             | `routes/users.routes.ts`                 | user admin, `inhaber` only                    |
| `/api/partners`          | `routes/partner.routes.ts`               | Backschrank; session required; B6: roles + hq |

Mount points for B4 (reports/analytics/finance/targets), B5 (products/hq-products), B7 (preorders)
and Z\* (Backzettel) are marked in `app.ts` **below the global guard** - mount new domains there
and add `requireRole(...)`. `libs/api/auth` is no longer mounted (the lib stays until B12).
Everything else is unmounted: recipes, inventory, cash, chat, dashboard, staff, notifications,
templates, preferences, import, sales-analytics, unsold, orders, production, baking-list,
deliveries, workflows, email, monitoring/metrics, Swagger.

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
`tests/unit/authCrypto.test.js`). Contract = the mock's `auth.mock.js` shapes, plus PIN/stations:

| Endpoint                                                                                                 | Who                             | Body / answer                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                                                                                   | public, rate-limited            | `{ username \| email, password }` → `{ success, data: { user, token, refreshToken, expiresIn, sessionKind } }` |
| `POST /api/auth/refresh`                                                                                 | public                          | `{ refreshToken }` → same `data` shape, **new** `refreshToken`                                                 |
| `POST /api/auth/pin`                                                                                     | `X-Station-Token`, rate-limited | `{ userId, pin: "0420" }` → same `data` shape, `sessionKind: 'station'`                                        |
| `GET /api/auth/station/users`                                                                            | `X-Station-Token`               | `{ success, data: [{ id, displayName, role }] }` (active users with a PIN)                                     |
| `GET /api/auth/me`                                                                                       | session                         | `{ success, data: user + sessionKind + stationId }`                                                            |
| `POST /api/auth/logout`                                                                                  | session                         | ends **this** session → `{ success, message: 'Abgemeldet.' }`                                                  |
| `GET/POST /api/auth/stations`, `DELETE /api/auth/stations/:id`                                           | `inhaber`                       | register `{ name }` → 201 `{ station, token }` (token shown once); revoke ends its sessions                    |
| `GET/POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/password`, `POST /api/users/:id/pin` | `inhaber`                       | `AdminUser` = user + `hasPin`, never a hash                                                                    |

`user` = `{ id, username, displayName, role, active, createdAt, updatedAt, sessionKind }`. Roles
`inhaber | verkauf | backstube | fahrer`. Errors via `sendError`: 400 `validation`, 401
`invalid_credentials` („Benutzername oder Passwort falsch.") / `invalid_pin` / `unauthorized`,
403 `forbidden` / `station_required`, 404 `not_found`, 409 `username_taken` / `last_inhaber`, 429
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
  (`revoke_reason = 'reuse'`, audited as `refresh_reuse`). Personal sessions slide to 14 days on
  each refresh; **station sessions end 12 h after the PIN** - neither refresh nor access token
  outlives that (`expiresIn` shrinks towards the end). Unlike the mock, a bare access token is
  **not** accepted at `/refresh`: the client must keep the refresh token (F1).
- **Global guard is structural** (`app.ts`): public auth router → `app.use('/api', requireAuth)` →
  everything else. No path allow-list to get wrong; an unknown `/api` path without a session is a
  401, with a session a 404. `requireRole(...roles)` needs no service; `inhaber` passes every check.
- **Stations:** `X-Station-Token` (`st_…`, SHA-256 in `stations`). PIN login without a valid, not
  revoked station token is 403. PINs are 4-6 digits **as a string** (a number would lose leading
  zeros → 400).
- **Rate limit** (`loginRateLimit`, express-rate-limit, per `createApp()` in memory): 5 **failed**
  attempts per 5 min per IP + username (login) or IP + userId (PIN) → 429. Successful logins do
  not count. `req.ip` depends on `TRUST_PROXY` (default `loopback`, Caddy).
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

## Schema (B2)

One baseline migration creates the whole pilot schema: `users`, `refresh_tokens`, `audit_log`,
the four partner tables (`Partners`, `PartnerDeliveryTemplates`, `PartnerVisits`,
`PartnerVisitItems` - names and camelCase columns exactly as before, `staffId` → `users`),
`pickup_points`, `preorders`, `preorder_items` and the Backzettel tables `backzettel_days`,
`backzettel_lines`, `backzettel_deltas` (§5.3, models come with Z3). New tables are snake_case;
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
State on `feat/B3-auth` 2026-11-05: 64 suites pass (1305 tests), 6 skipped, 0 failing.

## Known state

- Runtime packages the bundle loads (`express`, `cors`, `helmet`, `sequelize`, `sqlite3`, `umzug`,
  `jsonwebtoken`, `express-rate-limit`) are root `dependencies`, so `npm ci --omit=dev` keeps
  them. Since B3 the bundle no longer loads `bcrypt` (scrypt from `node:crypto`, D12). Building
  still needs dev dependencies (esbuild, typescript).
- An old development database keeps the legacy tables after the baseline ran (harmless, unread);
  delete the file for a clean schema.
- The legacy JavaScript layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
  `middleware/`) is not part of the bundle; useful only as domain reference.
