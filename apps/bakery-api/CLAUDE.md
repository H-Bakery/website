# bakery-api

Express + TypeScript + Sequelize/SQLite, bundled by esbuild. **`src/` is the only backend** (roadmap
D2): management app, shop and Fahrer-App all talk to it. Since the cutover (B12) the mock server
`simple-server.js` and the old JS layer at the app root are deleted - don't reintroduce a mock or a
second server. The old mock contract survives only as recorded answers in `tests/contract/`.

Invariants:

- **Business formulas exist exactly once**, in dependency-free CommonJS `src/services/*.core.js`,
  shared by the API, the management app's loaders and the tests. No second implementation.
- **Every `/api` route sits behind the session guard** in `src/app.ts` (public auth router →
  `app.use('/api', requireAuth)` → everything else). Mount new routers below it and check roles
  with `requireRole(...)`; user/station admin and finance also need `requirePersonalSession`. The
  only exception is the shop catalogue (`GET /api/products` with `PUBLIC_CATALOGUE=1`).
- **Error bodies carry `error` (code) and `message` (German)** - use `sendError()` from
  `src/utils/http-error.ts`; the frontend shows `message`.
- **`DB_PATH` is absolute in production** (required; the server refuses otherwise). Write through
  the managed `sequelize.transaction(async (t) => …)` - writes are serialised in-process.
- **Migrations are a static list** in `src/db/migrations.ts` (one `require` line each, no glob, no
  `sync()` at runtime). Write `''` for "no variant", never NULL.
- **hq is read, never invented:** missing hq data answers `no-data` / `no-config`, never samples
  or estimates. Writes go to the `app/edits` worktree with a pathspec commit, never the read clone.
- **Personal data expires:** names, phones and notes of preorders and delivery stops are wiped 90
  days after the date (`anonymize-preorders`, P4); the audit log never holds them.
- **Tests use synthetic fixtures only** - this repo is public; never copy real reports, finance
  data, names or prices from `hq` into tests, fixtures, snapshots or commit messages.

Details in `website/docs/api/`: [overview](../../docs/api/overview.md) (build, startup, schema,
tests) · [auth](../../docs/api/auth.md) · [hq-data](../../docs/api/hq-data.md) ·
[hq-products](../../docs/api/hq-products.md) · [partners](../../docs/api/partners.md) ·
[preorders](../../docs/api/preorders.md) · [deliveries](../../docs/api/deliveries.md) ·
[backzettel](../../docs/api/backzettel.md) · [rest](../../docs/api/rest.md).
