# Bakery API - Backend Service

## Overview

Express + TypeScript backend for the bakery pilot (roadmap `docs/roadmap.md`, D2: the real backend).
Sequelize on SQLite. Built by esbuild into a single file and run with plain `node`.

- **Port:** `PORT`, default 5000
- **Entry:** `src/main.ts` → `src/server.ts` → `src/app.ts`
- **Bundle:** `dist/apps/bakery-api/bundle/main.js` (+ source map)

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
2. `config/env.ts` → `loadConfig()`: `PORT`, `DB_PATH`, `DB_BUSY_TIMEOUT_MS` (5000), `DB_LOG_SQL`,
   `CORS_ORIGIN` (comma-separated; default the local dev ports).
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
6. `runPartnerSeeder()` - idempotent (by slug), creates the first sales partner.
7. `createApp({ sequelize, corsOrigins })` + `listen`. SIGTERM/SIGINT close the server (idle
   keep-alive sockets at once, open requests after `SHUTDOWN_DEADLINE_MS` = 10 s) and then the DB.
   In production the server logs a warning that auth and partner guards are not done yet: **do not
   deploy B0 before B3 (auth) and B6 (guards)** - it still accepts `admin`/`admin123`.

## App (`src/app.ts`)

`createApp(options)` builds the Express app without `listen` and without DB setup, for the server
and for supertest (B1). Mounted for the pilot:

| Path                     | Router                     | Note                                                                         |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------- |
| `/health`, `/api/health` | `routes/health.routes.ts`  | no session; `SELECT 1` if a DB was passed                                    |
| `/api/auth`              | `libs/api/auth`            | in-memory users (admin/admin123); B3 rewrites; errors via `ensureErrorShape` |
| `/api/partners`          | `routes/partner.routes.ts` | Backschrank; B6 adds guards                                                  |

Mount points for B4 (reports/analytics/finance/targets), B5 (products/hq-products), B7 (preorders)
and Z\* (Backzettel) are marked in `app.ts`. Everything else is unmounted: recipes, inventory, cash,
chat, dashboard, staff, notifications, templates, preferences, import, sales-analytics, unsold,
orders, production, baking-list, deliveries, workflows, email, monitoring/metrics, Swagger.

## Errors

Every error body carries `error` (code) **and** `message` (German) - `ApiClient` throws
`new Error(data.message)`. Use `sendError(res, status, error, message)` from
`src/utils/http-error.ts`. Unknown routes get a JSON 404 (`not_found`), bad JSON 400
(`invalid_json`), bodies over 200 kB 413 (`payload_too_large`), anything unhandled 500
(`internal_error`, no internals in the body; the stack goes to the log). An error passed to
`next()` with a 4xx `status` keeps its meaning: code and German text come from `STATUS_ERRORS`
(401 `unauthorized`, 403 `forbidden`, 429 `too_many_requests`, …; unknown 4xx → `bad_request`).

`libs/api/auth` does not follow this (English, partly no `message`, `{ errors: [...] }` from the
validators). Until B3 rewrites it on `sendError`, `/api/auth` is mounted behind
`ensureErrorShape`, which fills in `error` + German `message` from the status and keeps the lib's
English text as `detail`. Its 401 text is the generic „Bitte melden Sie sich an." - also for a
wrong password.

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
- `backzettel_lines.variant` is `NOT NULL DEFAULT ''` (`''` = no variant) so the unique index
  `(date, item_id, variant)` holds; an expression index would break Sequelize's `describeTable`.
- Weekdays: partners ISO (1 = Monday); `pickup_points.weekday` / `order_deadline.weekday` are JS
  (0 = Sunday), as in `delivery-preorders.core.js`.
- `initializeModels()` initialises only the pilot models (`PILOT_MODELS`). The legacy models
  (Cash, Chat, Product, Order, Inventory, Recipe, Notification\*, Production\*, ...) are still
  exported so unmounted code compiles, carry `@deprecated`, are **not initialised** and have no
  table. `User` hides `passwordHash`/`pinHash` in its default scope; login reads them through
  `User.scope('withSecrets')`.

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
- `scripts/boot-smoke.sh`: bundle → start (production mode, fresh SQLite) → `/health` → restart
  without re-running migrations. Runs in CI in the `build (bakery-api)` job.

Three legacy JS suites need `express-rate-limit`, which is declared in the root `package.json` but
only present after `npm ci`.

## Known state

- Runtime packages the bundle loads (`express`, `cors`, `helmet`, `sequelize`, `sqlite3`, `umzug`,
  `jsonwebtoken`, `bcrypt`) are root `dependencies`, so `npm ci --omit=dev` keeps them. Building
  still needs dev dependencies (esbuild, typescript).
- Auth is still the in-memory `libs/api/auth` (users lost on restart, `/refresh` → 501). B3.
- An old development database keeps the legacy tables after the baseline ran (harmless, unread);
  delete the file for a clean schema.
- The legacy JavaScript layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
  `middleware/`) is not part of the bundle; useful only as domain reference.
