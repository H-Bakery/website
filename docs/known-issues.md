# Known issues

Things that look broken but are known - don't mistake them for regressions. Checked 2026-11-08 on
the release branch (`release/2026-11` + `pilot`).

## Unit tests: all 17 `test` projects green

`NX_DAEMON=false npx nx run-many --target=test --all` → 17 projects, all green on a rerun. B12
deleted the six pre-pilot libraries whose specs used to fail (`feature-inventory`,
`feature-orders`, `feature-recipes`, `api-sales-analytics`, `api-import-service` and the rest of
`libs/api/*`); `contexts` is green since its auth and notification specs describe the real implementation.

| Project                                    | Suites | Tests                   |
| ------------------------------------------ | ------ | ----------------------- |
| `bakery-api` (js, ts, contract-later)      | 61     | 1897                    |
| `bakery-management`                        | 83     | 979                     |
| `ui`                                       | 9      | 232                     |
| `feature-cart`                             | 7      | 158                     |
| `bakery-landing`                           | 18     | 126                     |
| `bakery-delivery`                          | 9      | 116                     |
| `contexts`                                 | 5      | 114                     |
| `feature-catalog`                          | 5      | 96                      |
| `shared-data-access`                       | 7      | 92                      |
| `bakery-shop`                              | 11     | 76                      |
| `delivery-routing`                         | 3      | 61                      |
| `shared-utils`                             | 2      | 43                      |
| `delivery-tracking`                        | 1      | 7                       |
| `bakery-management-feature-analytics`      | 1      | 3                       |
| `shared-types`, `test-utils`, `data-mocks` | 0      | none (exit 0, no specs) |

- **One flaky API test.** Once, under `run-many` parallel load, `deliveryTours.test.ts` › „carries
  the day's preorders of the point in the mock shape, without cancelled" failed because the second
  `POST /api/preorders` of the test returned no `data`; alone and in a full rerun it passed. Not
  investigated further - if it recurs, look at that test first.
- `bakery-management` has been seen failing under `run-many` parallel load and passing alone.

## Not wired / stale

- **Phantom Nx projects:** `apps` (`apps/project.json`, `apps/src/app`, `apps/next.config.js`) and
  `apps-e2e` (`apps-e2e/`) are leftovers of an early generator run with empty targets; the root
  `package.json` shows up as the inert `bakery-website`. They do no harm; delete them in a clean-up
  of their own.
- Stale npm scripts: `dev`, `build`, `start`, `lint` (plain `next …` at the repo root, no app
  there), `serve:backend` / `build:backend` (no `backend` project).
- `bakeryAPI` in `libs/shared/data-access` is a mock over local data; only `EmailSettings` in
  `feature-settings` imports it, and no page renders that component.

## Tooling

- `npx tsc --noEmit -p apps/bakery-api/tsconfig.app.json` reports a spurious error (TS4058 in
  `backzettel.service.ts`) - that config is not what the build checks. Use
  `npx nx run bakery-api:typecheck` ([development.md](./development.md#api-type-check)).
- `nx build` of a Next app on a cold cache needs `NX_ISOLATE_PLUGINS=false NODE_ENV=production`
  ([development.md](./development.md#build)).
- `deploy-old.yml` (Vercel + Cloud Run) is manual-only and its secrets are not configured.
- The generated E2E suites `landing-page.spec.ts` and `management-workflows.spec.ts` are skipped
  on purpose ([testing/e2e.md](./testing/e2e.md)).
