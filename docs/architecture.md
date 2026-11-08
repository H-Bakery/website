# Architecture

State of the pilot (roadmap phase "Pilot", 2026-11). The plan and the decisions (D1…) are in
[`roadmap.md`](./roadmap.md); per-domain rules in [`domains/`](./domains/); API internals in
[`api/`](./api/).

## Apps

| App                 | Stack                        | Runs where                                     | Backend                    |
| ------------------- | ---------------------------- | ---------------------------------------------- | -------------------------- |
| `bakery-landing`    | Next.js, static export       | GitHub Pages (xn--bckerei-heusser-0kb.de)      | none (reads `hq` at build) |
| `bakery-management` | Next.js (App Router), MUI 5  | Bäckerei-Box in the LAN (systemd + Caddy), PWA | real TS API                |
| `bakery-api`        | Express + Sequelize + SQLite | Bäckerei-Box                                   | –                          |
| `bakery-shop`       | Next.js, MUI 5               | not in the pilot                               | real TS API (catalogue)    |
| `bakery-delivery`   | Next.js, CSS variables       | not in the pilot (D11, remote access Q8)       | real TS API (B8)           |

Next.js 16, React 18, Material UI 5, Nx 21. Customer-facing and staff-facing copy is German.

## Content: the private `hq` repo

`hq` (sibling checkout) is the source of truth for products (`products/*.md`), recipes, the
Backzettel master data (`config/backzettel.yaml`), cash-register reports
(`data/reports/converted/`) and finance aggregates (`data/finance/`). The apps read it from disk.

Writes from the management app (products, Grundmengen) never touch the read clone: the API commits
into a write worktree on branch `app/edits`, pushes it and keeps a rolling PR; until the PR is
merged, the rest of the system uses the approved state and the UI shows "wartet auf Freigabe".
Details: [`api/hq-products.md`](./api/hq-products.md).

## Backend

- **Real API** (`apps/bakery-api/src`): esbuild bundle (`build.mjs`) → `main.js` + `cli.js`,
  SQLite at `DB_PATH` (WAL, `busy_timeout`), Umzug migrations from a static list
  (`src/db/migrations.ts`), `createApp()` in `src/app.ts`. Mounted: health, auth, users, partners,
  products / hq-products, preorders (+ the `/api/deliveries/preorders*` alias and the shop's
  `POST /api/orders`), delivery tours (`/api/deliveries`, B8), Backzettel, Rest am Abend
  (`/api/rest`, M4), hq-sync, and reports / analytics / finance / targets. Everything under `/api`
  except login, refresh, PIN and the station user list sits behind the session guard - and, with
  `PUBLIC_CATALOGUE=1`, `GET /api/products` for the shop; roles via `requireRole`.
- **One API.** Since B12 (cutover) the mock server `simple-server.js`, the pre-TypeScript JS layer
  and the `libs/api/*` libraries are deleted. The old mock contract survives only as recorded
  answers for the contract tests (`apps/bakery-api/tests/contract/`). Do not reintroduce a second
  server.
- **Formulas exactly once**: every business calculation lives in dependency-free CommonJS
  `apps/bakery-api/src/services/*.core.js`, used by the API, the management app's server-side
  loaders (via runtime `require`, because the module-boundary lint forbids importing an app) and
  the tests.

## Frontend → backend

- Management: `ApiClient` from `libs/shared/data-access` with base `''` - the browser calls
  `/api/...` on its own origin; Caddy (box) or `src/proxy.ts` (local) forwards to `API_URL`.
  Session handling in `src/lib/session.tsx`; the proxy also guards server-rendered pages.
- Shop: `shop-products.ts` / `shop-orders.ts` in `libs/shared/data-access` against
  `NEXT_PUBLIC_API_URL` (the API directly, so the shop's origin must be in `CORS_ORIGIN`).
- `bakeryAPI` (`libs/shared/data-access/.../bakeryAPI.ts`) is a mock over local data. Only
  `EmailSettings` in `feature-settings` still imports it, and no page renders that component - do
  not wire a screen to it.

## Libraries

```
libs/
├── shared/*                     types, utils, ui, contexts, data-access, data-mocks, test-utils
├── bakery-management/feature-*  analytics, settings (the other feature libs went with B12)
├── bakery-shop/feature-*        cart, catalog
└── bakery-delivery-{routing,tracking}
```

Import across projects only via `@bakery/*` aliases (`tsconfig.base.json`).

## Operation

The box: systemd units, Caddy (LAN HTTPS via DNS-01), env files `/etc/bakery/{bakery,ops}.env`,
pull-deploy, hq sync, backup/restore, health check - `deploy/` and [`runbook.md`](./runbook.md).
