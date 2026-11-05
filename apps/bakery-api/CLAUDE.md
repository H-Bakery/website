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

| Path                                | Router                                   | Note                                                       |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `/health`, `/api/health`            | `routes/health.routes.ts`                | no session; `SELECT 1` if a DB was passed                  |
| `/api/auth` (public)                | `routes/auth.routes.ts` (public router)  | login, refresh, pin, station/users - see B3                |
| `/api` (guard)                      | `auth/middleware.ts` `requireAuth`       | **everything below needs a session (401)**                 |
| `/api/auth` (session)               | `routes/auth.routes.ts` (session router) | me, logout, stations                                       |
| `/api/users`                        | `routes/users.routes.ts`                 | user admin, `inhaber` only                                 |
| `/api/partners`                     | `routes/partner.routes.ts`               | Backschrank; session required; B6: roles + hq              |
| `/api/products`, `/api/hq-products` | `routes/hq-products.routes.ts`           | hq catalogue; reads any session, writes `inhaber` - see B5 |
| `/api/preorders`                    | `routes/preorders.routes.ts`             | Vorbestellungen; verkauf, fahrer read + handover - see B7  |
| `/api/deliveries`                   | `routes/preorders.routes.ts` (alias)     | only the Mörsbach mock contract (pickup points, preorders) |
| `/api/orders` (POST only)           | `routes/preorders.routes.ts` (shop)      | shop order → preorder with channel `shop`, behind auth     |

Mount points for B4 (reports/analytics/finance/targets) and Z\* (Backzettel) are marked in
`app.ts` **below the global guard** - mount new domains there and add `requireRole(...)`.
`libs/api/auth` is no longer mounted (the lib stays until B12).
Everything else is unmounted: recipes, inventory, cash, chat, dashboard, staff, notifications,
templates, preferences, import, sales-analytics, unsold, the rest of orders (only the shop's
`POST /api/orders` exists, B7), production, baking-list, the rest of deliveries (tours, stops,
drivers - D11; only the Mörsbach alias exists), workflows, email, monitoring/metrics, Swagger.

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
  shared tablet must not unlock user/station admin. Open question for the owner whether finance
  (B4) gets the same guard.
- **Logout is public**: Bearer access token, else `{ refreshToken }` (also a rotated or expired
  one) names the session; it is revoked and audited (`via: 'access' | 'refresh'`). Nothing valid
  → still 200, as in the mock.
- **Rate limit** (`loginRateLimit`, express-rate-limit, per `createApp()` in memory), **failed**
  attempts per 5 min → 429: 5 per IP + username (login) or IP + userId (PIN); 30 per IP across all
  accounts (`LOGIN_RATE_LIMIT_IP_MAX`, password spraying); for the PIN also 10 per user across all
  IPs (`PIN_RATE_LIMIT_USER_MAX`; the side effect - anyone at a station can lock a user's PIN
  login for 5 min - is accepted, password login still works). Successful logins do not count.
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

- **Two write modes.** `HQ_WRITE_DIR` set (the box): the file goes to
  `${HQ_WRITE_DIR}/products` (worktree on `app/edits`), then `git add` + `git commit -- <file>`
  there, author and committer `Verwaltung (App) <verwaltung@bakery.local>`, message
  `products: <Name> (<id>) geändert|angelegt` + `Co-authored-by: <displayName> <username@bakery.local>`.
  git runs through `execFile` with argument arrays, never a shell string. Only the product path is
  committed - whatever else sits in the index stays. Push + PR is **B5b**; until then the commits
  are local. `HQ_WRITE_DIR` unset (development): written straight into `HQ_PRODUCTS_DIR`, no git,
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

## Preorders (B7) and anonymisation (P4)

Vorbestellungen for every channel in one table (`preorders` + `preorder_items`, baseline schema).
Rules **once** in `src/services/delivery-preorders.core.js` (dependency-free CommonJS; the mock's
Mörsbach routes keep using the same file): channels, statuses, transitions, input normalisation,
codes, sums, day summary, the mapping to/from the mock shape and the anonymisation cutoff.
DB + transactions + audit in `src/services/preorders.service.ts`, routes in
`src/routes/preorders.routes.ts`, import/anonymise in `src/services/preorders-maintenance.ts`,
the Backzettel-variant hook in `src/services/preorder-variants.ts`.

| Endpoint                           | Who                                                | Answer                                                                |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /api/preorders`               | verkauf, fahrer                                    | `{ success, data: Preorder[], count }`; filters below                 |
| `GET /api/preorders/sums?date=`    | verkauf, fahrer, backstube                         | `{ success, data: { date, pickupPointId, preorderCount, items } }`    |
| `GET /api/preorders/day?date=`     | verkauf, fahrer                                    | `{ success, data: { date, summary, sums, pickupPoints, preorders } }` |
| `GET /api/preorders/pickup-points` | verkauf, fahrer                                    | `{ success, data: PickupPoint[] }`                                    |
| `GET /api/preorders/:id`           | verkauf, fahrer                                    | `{ success, data }`; 404 `not_found`                                  |
| `POST /api/preorders`              | verkauf                                            | 201 `{ success, data }`                                               |
| `PATCH /api/preorders/:id`         | verkauf                                            | `{ success, data }`; partial; a date/place change renews the code     |
| `POST /api/preorders/:id/status`   | verkauf; fahrer only `abgeholt` / `nicht_abgeholt` | `{ status?, notCollected?, paid? }` → `{ success, data }`             |
| `POST /api/preorders/:id/cancel`   | verkauf                                            | `{ success, data }` (status `storniert`; nothing is ever deleted)     |

`inhaber` passes every check. `sums` items = `[{ productId, variant, name, unit, quantity,
preorders }]`, everything except `storniert`, optionally `&pickupPointId=`. List filters: `date`
or `from`/`to`, `status` (comma list), `channel`, `pickupPointId` (`laden` = no point), `q`
(name/code; phone digits from 3 on; LIKE wildcards stripped). `Preorder` = `{ id, code, channel,
customerName, customerPhone, pickupDate, pickupTime, pickupPointId, pickupPoint
{ id, name, window } | null, status, notCollected, notCollectedAt, paid, note, items [{ productId,
name, variant, unit, unitPrice, quantity, lineTotal }], total, pickedUpAt, anonymizedAt,
createdBy, updatedBy, createdAt, updatedAt, deadline, afterDeadline }`. Errors via `sendError`:
400 `invalid_*` / `unknown_product` / `unknown_pickup_point` / `variant_required` /
`invalid_delivery_day`, 403 `forbidden`, 404 `not_found`, 409 `already_picked_up` / `cancelled` /
`anonymized` / `has_variants`.

- **Channels** `laden | telefon | whatsapp | shop | sammelstelle`. Pickup is either the Laden
  (`pickupPointId: null`, date + optional `HH:MM`) or a pickup point (date must be its weekday, no
  time - the window applies; `sammelstelle` requires a point; inactive points are refused).
- **Statuses** `offen → bereit → abgeholt | storniert`; `abgeholt ↔ storniert` is locked (409), so
  a paid handover cannot fall out of the accounts and a late handover from a dead spot cannot
  revive a cancelled one. **"nicht abgeholt" is not a status**: it is `bereit` +
  `not_collected_at` (migration `20261113000000-preorders-b7.js`, which also seeds the Mörsbach
  point), set with `{ notCollected: true }` (fahrer: target `nicht_abgeholt`), cleared by any
  other status.
- **Mock mapping** (alias and import): `open → offen` (an incoming `open` on a `bereit` preorder
  keeps `bereit`), `handed_over → abgeholt`, `not_collected → bereit + notCollectedAt`,
  `cancelled → storniert`; back: `offen`/`bereit` → `open` unless `notCollectedAt` is set.
- **Items** carry a **price/name/unit snapshot** from the approved hq catalogue (`getProduct`);
  duplicates of product + variant are merged; a product without a price is 400. **Variant** `''`
  = none (never null). If `hq/config/backzettel.yaml` exists (found like Z3's loader:
  `HQ_BACKZETTEL_CONFIG`, `${HQ_DIR}/config/backzettel.yaml`, next to the products dir), a product
  of a Backzettel item with Sorten **must** name one of them (400 `variant_required` /
  `invalid_variant`) and a product without Sorten must not; a product not in the config, or no
  config at all, accepts any slug. Cached 60 s + mtime; an invalid config is warned once and
  ignored. `createApp({ preorders: { variantsForProduct } })` overrides the hook (tests;
  `tests/setup-ts.js` points `HQ_BACKZETTEL_CONFIG` at a missing file).
- **Codes** `<PREFIX>-<YYYY-MM-DD>-<nn>`: the pickup point's prefix (`MO` for Mörsbach, as in the
  mock) or `LA` for the Laden; numbered over every code of that prefix + date **including
  cancelled ones**, so a cancelled code is never handed out again. A change of date or place
  renews the code (audited with `previousCode`).
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
  drop them); fahrer may PATCH only `{ status: handed_over | not_collected }`. Answers carry
  `code`, `channel`, `paid` (and `variant` per item) in addition.
- **Shop `POST /api/orders`** (verkauf) validates with `shop-orders.core.js` and creates a `shop`
  preorder for the Laden; it answers in the mock's shape with `id` = code and `orderNumber` =
  preorder id. **It stays behind the global auth guard** - the public shop cannot order until a
  public order endpoint is designed (rate limit, spam, owner decision). The e-mail address is not
  stored (no column, not needed for pickup).
- **P4 anonymisation**: `anonymizePreorders({ today, days = 90, dryRun })` sets
  `customer_name = 'anonymisiert'`, clears phone **and note** (free text often holds personal
  data), sets `anonymized_at` and writes one `anonymize` audit row each - for preorders whose
  pickup date lies more than 90 days before `today` (Berlin) and that are `abgeholt`, `storniert`
  or `bereit` + not collected. `offen` and plain `bereit` are left alone and counted in
  `stillOpen`. An anonymised preorder can no longer be edited or change status (409
  `anonymized`). Backups keep the names until they rotate out (runbook §5.1).

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
(23:45 Europe/Berlin, after the 23:30 backup).

Tests: `tests/unit/preordersModel.test.js` (core), `tests/unit/preorderVariants.test.ts`,
`tests/integration/preorders.test.ts` (every route incl. roles),
`tests/integration/preordersMaintenance.test.ts` (import, anonymise, CLI),
`tests/parity/preorders.parity.test.ts` (alias vs. `simple-server.js`), and the B7 migration in
`tests/migrations/pilotBaseline.test.ts`.

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
State on `feat/B7-preorders` 2026-11-05: 73 suites pass (1583 tests), 6 skipped, 0 failing.

## Known state

- Runtime packages the bundle loads (`express`, `cors`, `helmet`, `sequelize`, `sqlite3`, `umzug`,
  `jsonwebtoken`, `express-rate-limit`) are root `dependencies`, so `npm ci --omit=dev` keeps
  them. Since B3 the bundle no longer loads `bcrypt` (scrypt from `node:crypto`, D12). Building
  still needs dev dependencies (esbuild, typescript).
- An old development database keeps the legacy tables after the baseline ran (harmless, unread);
  delete the file for a clean schema.
- The legacy JavaScript layer at the app root (`index.js`, `controllers/`, `models/`, `routes/`,
  `middleware/`) is not part of the bundle; useful only as domain reference.
