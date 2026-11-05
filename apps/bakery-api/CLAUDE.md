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
   `/data/`); in production it is **required and must be absolute** - the server refuses to start
   otherwise.
3. `db/database.ts` → `openDatabase()`: Sequelize SQLite, `PRAGMA journal_mode = WAL` (persistent),
   `busy_timeout` on **every** connection. Sequelize's SQLite dialect opens one connection per
   transaction and does not run `afterConnect` hooks, so the timeout is set by wrapping
   `connectionManager.getConnection` - don't replace that with a one-off `PRAGMA` query.
4. `db/migrate.ts` → `runMigrations()`: Umzug in-process over the **static list** in
   `db/migrations.ts` (each file `require`d by literal, so esbuild bundles it). Bookkeeping in
   `SequelizeMeta` with the `.js` names, compatible with databases migrated by `sequelize-cli`.
   No glob, no shell-out, **no `sequelize.sync()` at runtime**. A new migration = one new line.
   The 17 legacy migrations still run; B2 replaces them with a pilot baseline.
5. `initializeModels(sequelize)` - after the migrations, never before.
6. `runPartnerSeeder()` - idempotent (by slug), creates the first sales partner.
7. `createApp({ sequelize, corsOrigins })` + `listen`. SIGTERM/SIGINT close the server and the DB.

## App (`src/app.ts`)

`createApp(options)` builds the Express app without `listen` and without DB setup, for the server
and for supertest (B1). Mounted for the pilot:

| Path                     | Router                     | Note                                          |
| ------------------------ | -------------------------- | --------------------------------------------- |
| `/health`, `/api/health` | `routes/health.routes.ts`  | no session; `SELECT 1` if a DB was passed     |
| `/api/auth`              | `libs/api/auth`            | in-memory users (admin/admin123); B3 rewrites |
| `/api/partners`          | `routes/partner.routes.ts` | Backschrank; B6 adds guards                   |

Mount points for B4 (reports/analytics/finance/targets), B5 (products/hq-products), B7 (preorders)
and Z\* (Backzettel) are marked in `app.ts`. Everything else is unmounted: recipes, inventory, cash,
chat, dashboard, staff, notifications, templates, preferences, import, sales-analytics, unsold,
orders, production, baking-list, deliveries, workflows, email, monitoring/metrics, Swagger.

## Errors

Every error body carries `error` (code) **and** `message` (German) - `ApiClient` throws
`new Error(data.message)`. Use `sendError(res, status, error, message)` from
`src/utils/http-error.ts`. Unknown routes get a JSON 404 (`not_found`), bad JSON 400
(`invalid_json`), bodies over 200 kB 413 (`payload_too_large`), anything unhandled 500
(`internal_error`, no internals in the body; the stack goes to the log).

## Tests

`jest.config.js` runs only plain-JS tests under `tests/**/*.test.js` (the `*.core.js` business
rules): `npx jest -c apps/bakery-api/jest.config.js`. Three legacy suites need `express-rate-limit`,
which is declared in the root `package.json` but only present after `npm ci`. The TS specs under
`src/**/__tests__/` never run; B1 adds a TS jest project and supertest tests against `createApp()`.

## Known state

- Auth is still the in-memory `libs/api/auth` (users lost on restart, `/refresh` → 501). B3.
- The 17 legacy migrations create many tables the pilot does not use; models and migrations drift
  outside the partner tables. B2.
- The legacy JavaScript layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
  `middleware/`) is not part of the bundle; useful only as domain reference.
