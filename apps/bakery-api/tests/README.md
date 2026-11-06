# Bakery API tests

`apps/bakery-api/jest.config.js` has two jest projects; both run with
`npx jest -c apps/bakery-api/jest.config.js` and `npx nx test bakery-api`
(`--selectProjects js` or `ts` picks one):

| Project | Files                                    | Transform                                      |
| ------- | ---------------------------------------- | ---------------------------------------------- |
| `js`    | `tests/**/*.test.js` (`*.core.js` rules) | none                                           |
| `ts`    | `src/**/*.spec.ts`, `tests/**/*.test.ts` | ts-jest, transpile-only (`tsconfig.spec.json`) |

The `ts` project resolves `@bakery/*` through the `tsconfig.base.json` paths and runs
`tests/setup-ts.js` first: `NODE_ENV=test`, a synthetic `JWT_SECRET`, `HQ_*` pointing at a
directory that does not exist (no test ever reads the private `hq` repo), and Nominatim/OSRM at a
closed port. ts-jest does not type-check; `npx nx run bakery-api:typecheck` checks the bundle graph
**and** `tsconfig.spec.json` (all TS tests).

All test data is synthetic (the repo is public): `fixtures/*.synthetic.*`, the product catalogue
in `tools/e2e/hq-products`, temp dirs per test.

```
tests/
├── contract/      recorded mock answers vs. the real API (D3, B12)
├── fixtures/      synthetic hq trees, mock stores for the import CLIs
├── helpers/       createTestApp, auth, hqProducts, hqRemote, loadTs, roleGuards
├── integration/   supertest against createApp() on :memory: SQLite
├── migrations/    pilot baseline + every later migration
└── unit/          the *.core.js business rules, platform (DB, config)
```

- **`helpers/createTestApp.ts`** - `createApp()` on `:memory:` SQLite, migrated with the static
  migration list, models initialised, optionally the partner seed. One per test file (models are
  module singletons; jest isolates files). Options go to `createApp()` via `app: { … }`.
- **`helpers/auth.ts`** - `createUser()`, `login()`, `bearer()`, `sessionFor()`: every `/api`
  route except login/refresh/pin/station-users (and, with `PUBLIC_CATALOGUE`, `GET /api/products`)
  needs a session.
- **`helpers/roleGuards.js`** - a stand-in for `createRoleGuards()` in the unit tests of
  `finance.routes.js` / `targets.routes.js` (the "token" is the role, no database).
- **`contract/`** (B12, before: `parity/`) - the mock server (`simple-server.js`) is deleted. Its
  answers to five scenarios (partners, hq products, hq data, preorders + Mörsbach alias,
  deliveries) were recorded once into `contract/recorded/<suite>.json`; `loadRecordedMock(suite)`
  replays them as an Express app and `compare(request, { mock, real })` checks status and shape
  (missing keys and type changes count; extra keys on the real API and `null` are tolerated unless
  `strictKeys`), most tests also the values. A request that was never recorded answers 599
  `not_recorded`, so a changed scenario fails loudly instead of comparing against nothing. The
  hq-data suite pins `today`, the preorders suite `now` to the recording day. **Changing a
  scenario means changing the contract**: there is no mock left to re-record from - edit the
  recording by hand and say so in the commit.
- **`migrations/pilotBaseline.test.ts`** - fresh schema, every model attribute has its column,
  idempotent re-run, upgrade of a database that ran the 17 archived migrations
  (`migrations/archive/`), every later migration.
- **`../scripts/boot-smoke.sh`** - bundle → `cli.js create-user` twice on a fresh SQLite file →
  start in production mode → `/health`, 401 without a session, login, `/me`, `/api/partners`,
  JSON 404 → restart without re-running migrations → login. CI runs it in the
  `build (bakery-api)` job.
