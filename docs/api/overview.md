# Bakery API - overview

Express + TypeScript backend for the bakery pilot (roadmap `docs/roadmap.md`, D2: the real backend),
Sequelize on SQLite, bundled by esbuild into one file and run with plain `node`. Code in
`apps/bakery-api/src/`.

- **Port:** `PORT`, default 5000
- **Entry:** `src/main.ts` → `src/server.ts` → `src/app.ts`
- **Bundle:** `dist/apps/bakery-api/bundle/main.js` (+ source map); operator CLI
  `dist/apps/bakery-api/bundle/cli.js` with `create-user`, `import-partners`, `import-preorders`,
  `import-deliveries`, `anonymize-preorders`, `snapshot-preorders`

**This is the only API.** Every frontend - management, shop, Fahrer-App - talks to it. The mock
server `simple-server.js` (`npm run serve:api:simple`) was deleted at the cutover (B12), together
with the legacy JS layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
`middleware/`, Dockerfiles), the unmounted legacy code under `src/` and `libs/api/*`. The mock's
contracts still win (D3) unless a deviation is documented; they are pinned by the recorded-mock
contract tests in `tests/contract/` (see [Tests](#tests)).

Domain docs: [auth](auth.md), [hq data](hq-data.md), [hq products + write-back](hq-products.md),
[partners](partners.md), [preorders](preorders.md), [Backzettel](backzettel.md),
[delivery tours](deliveries.md), [Rest am Abend](rest.md).

## Build and run

All from `website/`:

```bash
npm run serve:api                       # nx serve bakery-api: bundle, then run
npm run build:api                       # = npx nx run bakery-api:bundle
NX_DAEMON=false npx nx build bakery-api # typecheck (pilot graph) + bundle, used by CI
npx nx run bakery-api:typecheck         # tsc --noEmit -p apps/bakery-api/tsconfig.bundle.json (+ tsconfig.spec.json)
node apps/bakery-api/build.mjs --watch  # rebuild on change (restart node yourself)
node --enable-source-maps dist/apps/bakery-api/bundle/main.js
```

- `build.mjs`: esbuild, `platform: node`, `target: node20`, CommonJS. `@bakery/*` tsconfig aliases
  are **bundled** (they are source); every other bare import stays external and resolves from the
  root `node_modules` (`BUNDLED_PACKAGES` is empty). The build prints the external package list - it
  must not contain `pg`, `winston`, `prom-client` or `swagger-*`. It fails when the hoisted `yaml`
  is not 2.x (several packages pin 1.x, which lacks `isScalar`/`isMap`/`isSeq`).
- `tsconfig.bundle.json`: `useDefineForClassFields: false` + `experimentalDecorators`. With define
  semantics, class fields would shadow the attribute getters Sequelize installs on models.
- `typecheck` checks exactly the graph reachable from `main.ts` and `cli.ts`
  (`tsconfig.bundle.json`) plus the tests (`tsconfig.spec.json`). Since B12 that is all of `src/`.
- Runtime packages the bundle loads (`express`, `cors`, `helmet`, `sequelize`, `sqlite3`, `umzug`,
  `jsonwebtoken`, `express-rate-limit`, `gray-matter`, `js-yaml`, `yaml`) are root `dependencies`,
  so `npm ci --omit=dev` keeps them. No `bcrypt` (scrypt from `node:crypto`, D12). Building needs
  dev dependencies (esbuild, typescript).

## Startup (`src/server.ts`)

1. `config/load-env.ts` (first import of `main.ts`): loads `.env` from the working directory via
   `process.loadEnvFile` (already-set variables win). `JWT_SECRET` must be ≥ 32 characters; in
   production it is required, in development a fixed default is used with a warning.
2. `config/env.ts` → `loadConfig()`: `PORT`, `HOST` (interface for `listen`; unset = all, the box
   sets `127.0.0.1`), `DB_PATH`, `DB_BUSY_TIMEOUT_MS` (5000), `DB_LOG_SQL`, `CORS_ORIGIN`
   (comma-separated; default `DEFAULT_CORS_ORIGINS` = the local dev ports 4201, 4200, 3000 and -
   since B8 - 4300), `PUBLIC_CATALOGUE` (B12, see [App](#app-srcappts)), `TRUST_PROXY` (default
   `loopback` = Caddy on the
   same box; `false`/`0`, a hop count or an Express trust list; `true` is refused because every
   client could then fake its IP and dodge the login rate limit).
   **`DB_PATH`**: default `./data/bakery.db` relative to the working directory (gitignored as
   `/data/`); in production it is **required, absolute, not `:memory:`, and its directory must
   already exist** - the server refuses to start otherwise (Sequelize would silently create a
   fresh empty database at a mistyped path). `loadHqConfig()` / `loadHqSyncConfig()` read the hq
   paths (see [hq-products.md](hq-products.md)) before the database is opened.
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
   No glob, no shell-out, **no `sequelize.sync()` at runtime**. A new migration = one new line; the
   list order is the execution order. Current list: `20261105000000-pilot-baseline.js` (see
   "Schema"), `20261106000000-auth-sessions-stations.js`, `20261112000000-backzettel-z3.js`,
   `20261113000000-preorders-b7.js`, `20261114000000-preorders-paid-amount.js`,
   `20261116000000-preorders-request-id.js`, `20261201000000-rest-am-abend.js` (M4),
   `20270105000000-delivery-tours-b8.js` (B8), `20270106000000-rest-count-line-rows.js` (M4). The
   17 legacy migrations are archived in
   `migrations/archive/` and never loaded (`sequelize-cli` does not read subdirectories either).
5. `initializeModels(sequelize)` - after the migrations, never before.
6. `runPartnerSeeder()` - idempotent (by slug), creates the first sales partner. Then
   `bootstrapAdmin()`: only outside production and only with `BOOTSTRAP_ADMIN_USER` +
   `BOOTSTRAP_ADMIN_PASSWORD` set, creates that `inhaber` if the name is free. There is no
   default account.
7. `createApp(...)` + `listen`. After `listen`: hq sync timers start, and the Backzettel delta
   catch-up runs once in the background (`app.locals.reconcileBackzettelDeltas`). SIGTERM/SIGINT
   close the server (idle keep-alive sockets at once, open requests after `SHUTDOWN_DEADLINE_MS` =
   10 s), stop the timers and then close the DB.

## App (`src/app.ts`)

`createApp(options)` builds the Express app without `listen` and without DB setup, for the server
and for supertest. Every `/api` answer gets `Cache-Control: no-store` (answers carry names, phone
numbers and money; Chrome otherwise kept them in its disk cache on the shared tablet after logout).
Mounted:

| Path                                             | Router                                   | Note                                                             |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| `/health`, `/api/health`                         | `routes/health.routes.ts`                | no session; `SELECT 1` if a DB was passed                        |
| `/api/auth` (public)                             | `routes/auth.routes.ts` (public router)  | login, refresh, pin, station/users, logout                       |
| `/api` (guard)                                   | `auth/middleware.ts` `requireAuth`       | **everything below needs a session (401)**                       |
| `/api/auth` (session)                            | `routes/auth.routes.ts` (session router) | me, stations                                                     |
| `/api/users`                                     | `routes/users.routes.ts`                 | user admin, `inhaber` only                                       |
| `/api/partners`                                  | `routes/partner.routes.ts`               | Backschrank, see [partners.md](partners.md)                      |
| `/api/reports`, `/api/analytics`, `/api/finance` | `routes/hq-data.routes.ts`               | hq read-only data, see [hq-data.md](hq-data.md)                  |
| `/api/products`, `/api/hq-products`              | `routes/hq-products.routes.ts`           | hq catalogue, see [hq-products.md](hq-products.md)               |
| `/api/preorders`                                 | `routes/preorders.routes.ts`             | Vorbestellungen, see [preorders.md](preorders.md)                |
| `/api/deliveries`                                | `routes/preorders.routes.ts` (alias)     | the Mörsbach mock contract (pickup points, preorders)            |
| `/api/deliveries`                                | `routes/delivery-tours.routes.ts`        | tours, stops, drivers, depot, see [deliveries.md](deliveries.md) |
| `/api/orders` (POST only)                        | `routes/preorders.routes.ts` (shop)      | shop order → preorder with channel `shop`, behind auth           |
| `/api/backzettel`                                | `routes/backzettel.routes.ts`            | see [backzettel.md](backzettel.md)                               |
| `/api/rest`                                      | `routes/rest.routes.ts`                  | Rest am Abend (M4), see [rest.md](rest.md)                       |
| `/api/hq-sync`                                   | `routes/hq-sync.routes.ts`               | write-back status + retry, `inhaber`                             |

New domains are mounted in `app.ts` **below the global guard** - mount them there and add
`requireRole(...)`. **One exception (B12):** with `PUBLIC_CATALOGUE=1`
(`createApp({ publicCatalogue: true })`, logged at start) `GET /api/products` is mounted **above**
the guard, so the customer shop can read the approved catalogue without a session; every other
route still answers 401. Default off - whether the box turns it on is the owner's call, together
with a public order path.

Nothing else exists: recipes, inventory, cash, chat, dashboard, staff, notifications, templates,
preferences, import, sales-analytics, unsold, the rest of orders (only the shop's
`POST /api/orders`), production, baking-list, workflows, email, monitoring/metrics and Swagger
were deleted with the legacy code in B12.

## Errors

Every error body carries `error` (code) **and** `message` (German) - `ApiClient` throws
`new Error(data.message)`. Use `sendError(res, status, error, message)` from
`src/utils/http-error.ts`. Unknown routes get a JSON 404 (`not_found`), bad JSON 400
(`invalid_json`), bodies over 200 kB 413 (`payload_too_large`), anything unhandled 500
(`internal_error`, no internals in the body; the stack goes to the log). An error passed to
`next()` with a 4xx `status` keeps its meaning: code and German text come from `STATUS_ERRORS`
(401 `unauthorized`, 403 `forbidden`, 429 `too_many_requests`, …; unknown 4xx → `bad_request`).
Every router answers through `sendError`; the old safety net `ensureErrorShape` went with the legacy
routers in B12.

## Schema

One baseline migration creates the whole pilot schema: `users`, `refresh_tokens`, `audit_log`,
the four partner tables (`Partners`, `PartnerDeliveryTemplates`, `PartnerVisits`,
`PartnerVisitItems` - legacy names and camelCase columns, `staffId` → `users`), `pickup_points`,
`preorders`, `preorder_items` and the Backzettel tables `backzettel_days`, `backzettel_lines`,
`backzettel_deltas`. Later migrations add columns/tables (see Startup) - among them the delivery
tables (`delivery_depot`, `delivery_drivers`, `delivery_tours`, `delivery_stops`,
`delivery_geocache`, B8) and `rest_counts` (M4). New tables are snake_case;
their models use `underscored: true` and camelCase attributes.

- **Idempotent.** Each table is created only if missing (case-insensitive - SQLite treats `Users`
  and `users` as one table). A database that ran the legacy list keeps those names in
  `SequelizeMeta`, runs the baseline once, keeps its partner data, and keeps the legacy tables it
  no longer reads (Products, Orders, ...; harmless - delete an old dev database for a clean schema).
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
  expression index would break Sequelize's `describeTable`) and lets the Backzettel and the preorder
  sums join and group the three tables without `COALESCE`. Write `''`, not null.
- Weekdays: partners ISO (1 = Monday); `pickup_points.weekday` / `order_deadline.weekday` are JS
  (0 = Sunday), as in `delivery-preorders.core.js`.
- `initializeModels()` initialises the pilot models (`PILOT_MODELS`). The legacy models (Cash,
  Chat, Product, Order, Inventory, Recipe, Notification\*, Production\*, ...) were deleted in B12.
  `User` keeps `passwordHash`/`pinHash` out twice: the default scope drops them from finder
  queries (login reads them through `User.scope('withSecrets')`), and `toJSON()` always deletes
  them - the scope alone does not cover the instance `User.create()` returns or
  `findAll({ attributes: [...] })`. Never serialise a user by hand around `toJSON()`.

## Tests

Three jest projects in `apps/bakery-api/jest.config.js`, all run by
`npx jest -c apps/bakery-api/jest.config.js` and `npx nx test bakery-api`
(`--selectProjects js|ts|contract-later`). The config pins `TZ=Europe/Berlin` (the box's zone;
business days and delivery time windows are local times, CI runners are UTC).

- `js`: plain-JS tests under `tests/**/*.test.js` (the `*.core.js` business rules, the
  `*.routes.js` modules). TS sources can be pulled in with `tests/helpers/loadTs.js` (esbuild, same
  settings as `build.mjs`); `tests/unit/apiPlatform.test.js` uses it.
- `ts`: `src/**/*.spec.ts`, `tests/**/*.test.ts` through ts-jest (transpile-only,
  `tsconfig.spec.json`, `@bakery/*` from the base paths). Integration tests use
  `tests/helpers/createTestApp.ts` (`createApp()` on `:memory:` + migrations) with supertest. Type
  errors in tests are caught by `nx run bakery-api:typecheck`.
- **Contract tests** (`tests/contract/`, B12, formerly `tests/parity/`). The mock server is
  deleted; its answers to five scenarios (partners, hq products, hq data, preorders + Mörsbach
  alias, deliveries) are recorded in `tests/contract/recorded/<suite>.json`.
  `loadRecordedMock(suite)` replays them, `compare()` checks status, shape and mostly values
  against the real API; an unrecorded request answers 599 `not_recorded`. Changing a scenario means
  editing the recording by hand (say so in the commit) - there is no mock left to re-record from.
  The real side's clocks are pinned to the recording moment (`now` of preorders and deliveries,
  `today` of hq data, `RECORDED_AT`); the third jest project `contract-later` reruns all five
  suites with the wall clock in 2028 (`tests/helpers/shiftedClock.js`), so a suite that depends on
  the wall clock fails today instead of on the day its scenario dates pass.
- Integration tests of other domains need a session: `sessionFor(app, 'test.x', 'inhaber')` and
  `bearer(token)` from `tests/helpers/auth.ts`.
- `tests/setup-ts.js` points every hq path (`HQ_DIR`, `HQ_PRODUCTS_DIR`, `HQ_REPORTS_DIR`,
  `HQ_FINANCE_DIR`, `HQ_BACKZETTEL_CONFIG`) nowhere, unsets `HQ_WRITE_DIR`, `HQ_WRITE_BRANCH`,
  `HQ_SNAPSHOT_DIR`, `HQ_GITHUB_TOKEN`, `GITHUB_TOKEN`, `GITHUB_API_URL`, `HQ_GITHUB_REPO`, and
  points `NOMINATIM_URL`/`OSRM_URL` at a closed port, so tests stay hermetic. Fixtures are synthetic (`tests/fixtures/*.synthetic.*`) - the repo is public.
- See also `apps/bakery-api/tests/README.md`.
- `scripts/boot-smoke.sh`: bundle → `cli.js create-user` twice (create, idempotent reset) on a
  fresh SQLite → start (production mode) → `/health` → 401 without session → login → `/me`,
  `/api/partners`, JSON 404, `/api/reports/daily` and `/api/finance/targets/status` against
  `tests/fixtures/hq-data.synthetic.js` → restart without re-running migrations → login. Runs in
  CI in the `build (bakery-api)` job; no default account involved.

The legacy suites (controllers, legacy integration and security suites, the mock-server hardening
tests) were deleted with their code in B12.

## Known state

- An old development database keeps the legacy tables after the baseline ran (harmless, unread);
  delete the file for a clean schema.
- The archived migrations in `migrations/archive/` stay for the baseline upgrade test.
- `docker-compose*.yml`, `.github/workflows/deploy-old.yml` and `deployment/` still name the
  Dockerfiles deleted in B12 - the pilot runs on the box (`deploy/`), not in Docker.
