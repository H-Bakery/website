# Development

How to install, run, test and build this monorepo. Domain rules live in [`docs/domains/`](./domains/),
API internals in [`docs/api/`](./api/), the pilot plan in [`roadmap.md`](./roadmap.md), box operation
in [`runbook.md`](./runbook.md).

## Workspace

This repo (`website/`) is one of two sibling checkouts:

```
bakery/
├── website/   this repo (public) – all application code, Nx monorepo
└── hq/        private content repo – products, recipes, Backzettel config, cash reports, finance
```

`git` runs inside one of the two, never from `bakery/`. All `npm` / `npx nx` commands run from
`website/`. The apps read `hq` at build or run time; see [hq paths](#hq-paths).

Prerequisites: Node ≥ 20.9 locally (the box runs Node 22 LTS). `.npmrc` sets
`legacy-peer-deps=true`, so install with plain `npm ci`. A husky `pre-commit` hook runs
`lint-staged` (prettier + `eslint --fix`).

## Run

| What                    | Command                          | Port |
| ----------------------- | -------------------------------- | ---- |
| Landing page            | `npm run dev:landing`            | 3000 |
| Shop                    | `npm run serve:shop`             | 4200 |
| Management (Verwaltung) | `npm run serve:management`       | 4201 |
| Fahrer-App (delivery)   | `npm run serve:delivery`         | 4300 |
| TypeScript API          | `npm run serve:api`              | 5000 |
| Partybrezel-Prototyp    | `npm run dev:partybrezel`        | 4221 |
| Digitale Bäckerei (3D)  | `npm run dev:digitale-baeckerei` | 4222 |

The Digitale Bäckerei needs its 3D model and product data, neither of which is in this repo: `dev:` /
`build:digitale-baeckerei` first run two Nx targets. `sync-model` downloads `twin.glb` (public, at the
commit pinned in `apps/bakery-digitale-baeckerei/model.lock.json`, sha256-checked) into the git-ignored
`public/model/` and derives `public/data/belegung.json` (which product sits on which slot) from it.
`sync-products` reads `hq/products/*.md` (`HQ_PRODUCTS_DIR`, else `../hq/products`) through
`libs/shared/hq-products` and writes `public/data/products.snapshot.json` **without prices**; it aborts
when there is no hq - there are no mock products. Without hq (or offline), set
`DIGITALE_BAECKEREI_FIXTURE=1`: both targets then use the synthetic mini model and snapshot from
`src/test/fixtures/` and download nothing. `npm run serve:digitale-baeckerei` serves the static export
on 4232, `npm run test:unit:digitale-baeckerei` runs its jest specs (no network, synthetic data).
Subpath build: `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei`. See
[apps/digitale-baeckerei.md](./apps/digitale-baeckerei.md) and the app's `CLAUDE.md`.

`npm run test:e2e:digitale-baeckerei` runs its Playwright suite (`apps/bakery-digitale-baeckerei-e2e`,
Chromium with SwiftShader, projects `phone` 390×844 and `desktop` 1440×900) against the static export
under `/digitale-baeckerei` on port 4236. It never uses the real model: the suite's server
(`serve-fixture.js`) builds with `DIGITALE_BAECKEREI_FIXTURE=1` - the synthetic mini model and product
snapshot from `apps/bakery-digitale-baeckerei/src/test/fixtures/` (see the README there) - and refuses
to start on any other export. With `E2E_BUILT=1` (or in CI) it serves the export that is already built;
`BASE_URL=http://localhost:<port>` moves the port.

Ports come from each app's `project.json`. There is one API: since B12 the mock server
(`serve:api:simple`) is deleted, and management, shop and Fahrer-App all talk to the TypeScript
API. The shop needs `PUBLIC_CATALOGUE=1` on the API (anonymous `GET /api/products`); shop and
Fahrer-App call the API directly, so their origins must be in `CORS_ORIGIN` (4200 and 4300 are in
the default list).

**The whole system at once** (real API + management in full and pilot mode + Fahrer-App + shop,
synthetic or real hq data): the `setup-dev` skill in `.claude/skills/setup-dev/` (`up.sh` with
synthetic seed data from any ref, `real.sh` with the real hq and a persistent DB). Prefer it over
starting servers by hand.

### Real API

`npm run serve:api` bundles the API with esbuild (`apps/bakery-api/build.mjs` →
`dist/apps/bakery-api/bundle/main.js` + `cli.js`), opens SQLite at `DB_PATH` (default
`./data/bakery.db`, gitignored; absolute and required in production), runs the migrations and
listens. `npm run build:api` bundles only. There is no default account: in development
`BOOTSTRAP_ADMIN_USER` / `BOOTSTRAP_ADMIN_PASSWORD` create an Inhaber at start; otherwise use the
CLI (after `build:api`):

```bash
CREATE_USER_PASSWORD=… npm run api:create-user -- --username anna --display-name "Anna" --role verkauf
npm run api:import-partners -- --file apps/bakery-api/data/partner-store.json --dry-run
npm run api:import-deliveries -- --file apps/bakery-api/data/delivery-store.json --dry-run
```

The two imports move the old mock server's JSON stores into SQLite (idempotent); see
[`api/partners.md`](./api/partners.md) and [`api/deliveries.md`](./api/deliveries.md).

More in [`api/overview.md`](./api/overview.md).

### hq paths

| Env var                | Default                                 | Used by                                |
| ---------------------- | --------------------------------------- | -------------------------------------- |
| `HQ_DIR`               | `<website>/../hq`                       | real API (base for the rest)           |
| `HQ_PRODUCTS_DIR`      | `<website>/../hq/products`              | landing, management, API               |
| `HQ_REPORTS_DIR`       | `<website>/../hq/data/reports`          | reports, analytics, Tagesziel          |
| `HQ_FINANCE_DIR`       | `<website>/../hq/data/finance`          | finance, Tagesziel config              |
| `HQ_BACKZETTEL_CONFIG` | `${HQ_DIR}/config/backzettel.yaml`      | Backzettel                             |
| `HQ_RECIPES_DIR`       | `${HQ_DIR}/data/recipes`                | recipes (`/api/recipes`)               |
| `HQ_WRITE_DIR`         | – (dev: write straight to the read dir) | real API write-back (box: `app/edits`) |

A missing `hq` is not an error: reports/finance answer `status: 'no-data'`, the landing page falls
back to bundled JSON in `src/mocks/products/` and logs `HQ products directory not found`. If a
product edit "doesn't show up", look for that log before suspecting a cache.

## Nx

Project names often differ from directory names - check with `npx nx show projects`. The shared
libs are `ui`, `contexts`, `test-utils`, `data-mocks` (unprefixed) next to `shared-types`,
`shared-utils`, `shared-data-access`. Import across projects only via the `@bakery/*` aliases in
`tsconfig.base.json`.

## Test

```bash
npx nx test <project>                 # one project, e.g. npx nx test bakery-management
npx nx test <project> -- -t "name"    # one test case
npm run test:unit                     # all projects
NX_DAEMON=false npx nx run-many --target=test --all   # what the known-issues numbers come from
npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/<file>.test.js   # API core
npm run test:e2e:management           # Playwright (…:shop, …:landing, …:delivery, …:digitale-baeckerei)
npm run lint:all  |  npm run format:check  |  npm run type-check
```

- `apps/bakery-api/jest.config.js` has three projects: `js` (`tests/**/*.test.js`), `ts`
  (`src/**/*.spec.ts`, `tests/**/*.test.ts`, ts-jest, transpile-only) and `contract-later` (the
  contract suites in `tests/contract/` once more with the clock shifted to 2028). The contract
  suites compare the API with answers recorded from the deleted mock server
  (`tests/contract/recorded/`). See `apps/bakery-api/tests/README.md`.
- jest passes specs that have type errors - run `npm run type-check` before merging.
- E2E suites and the synthetic product catalogue: [`testing/e2e.md`](./testing/e2e.md).
- Tests use **synthetic fixtures only** - the repo is public.
- Failing suites that are known: [`known-issues.md`](./known-issues.md).

## Build

```bash
npx nx build <project>
NX_ISOLATE_PLUGINS=false NODE_ENV=production npx nx build bakery-management   # Next apps, see below
npm run affected:build | affected:test | affected:lint
npm run clean            # nx reset + rm dist tmp coverage .nx
```

**Next apps need `NX_ISOLATE_PLUGINS=false` and `NODE_ENV=production`** (ci.yml sets both). With
plugins in-process, `@nx/vite/plugin` calls Vite's `resolveConfig()` on a cold graph cache, which
sets `NODE_ENV=development` inside the Nx process; `next build` inherits it and dies in prerender
with `Cannot read properties of null (reading 'useState')`. With isolated plugins, `withNx()`'s
nested project graph crashes the IPC layer (`Could not create project graph`). A warm
`.nx/workspace-data` hides both - after `npm run clean` you need the variables. TypeScript errors
printed inside `##[group]` blocks of _succeeded_ tasks (vite's dts plugin) are not the cause.

`NEXT_PUBLIC_*` variables are baked in at `next build`, not read at `next start`.

### Landing page (static export → GitHub Pages)

```bash
rm -rf apps/bakery-landing/.next      # a stale dev cache breaks the export
NODE_ENV=production npx nx build-static-standalone bakery-landing   # → apps/bakery-landing/out/
```

`build-static-standalone` runs `generate-sitemap.js`, then `next build` with
`NX_STANDALONE_BUILD=1`, bypassing the Nx graph; the Pages workflow does the same, and the
`build` target of `bakery-landing` is the same export. `npm run build:landing:standalone` is the
plain `next build` without the sitemap. `<Html> should not be imported outside of pages/_document`
or `Cannot find module for page` = stale `.next`.

### API type-check

`npx nx run bakery-api:typecheck` (`tsc --noEmit` over `tsconfig.bundle.json` and
`tsconfig.spec.json`; `nx build bakery-api` depends on it). `tsconfig.app.json` is not what the
build checks - `tsc -p` on it reports a spurious error.

## CI

`.github/workflows/ci.yml` filters by changed paths, then runs `format:check`, `lint:affected`,
`type-check` and tests (`test-unit` in three shards, four `test-e2e-*` jobs, aggregate
`ci-status`). E2E runs against the built apps plus an API on a synthetic catalogue
(`tools/e2e/`), so no private `hq` is needed. The 3D app is built with `DIGITALE_BAECKEREI_FIXTURE=1`
in both the `build` matrix and `test-e2e-digitale-baeckerei` (there for the sub-path
`/digitale-baeckerei`) - synthetic mini model and snapshot, no download of the real model, no hq.

- **Coverage thresholds and `--shard` don't mix**: a shard runs a third of the tests but measures
  all sources. The configs with thresholds drop them when `JEST_SHARDED=true` (set by the shard
  step); Codecov merges the uploads, and a full `npm run test:coverage` is what is judged.
- `deploy-to-github-pages.yml` publishes the landing export on every push to `main`.
  `deploy-old.yml` (Vercel + Cloud Run) is manual-only and has no configured secrets - unused.

## Task tracking

Dev tasks: markdown with YAML frontmatter in `.mc/tasks/{todo,done}/` (MissionControl). The `mc`
CLI is **not installed** - edit the files directly. The pilot plan and its task list live only in
[`roadmap.md`](./roadmap.md).
