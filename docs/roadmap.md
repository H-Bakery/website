# Pilot plan: management system in the bakery

_Single working document. Created 2026-11-05 (KW 45), owner huhn511. Supersedes
[prd.md](prd.md), [ai-prd.md](ai-prd.md), [deployment.md](deployment.md),
[pi-cicd-guide.md](pi-cicd-guide.md)._

**Goal.** Staff of Bäckerei Heusser use the system in daily work, on the **real** backend:

- From **Tue 17.11.2026 (KW 47)** every Vorbestellung is taken in the app.
- From **Tue 24.11.2026 (KW 48)** the Backstube bakes from a digital **Backzettel**, Saturday's
  Hefeteig production included.
- Everything runs on a server in the bakery, reachable on the bakery Wi-Fi from staff phones, a
  shop tablet, a Backstube tablet and the office PC.
- Christmas is the stress test; January 2027 is the review.

---

## 0. How to work with this document

**Current status (2026-11-06, after wave 4a).**

- **Merged on `pilot` (website, not pushed):** wave 1 (B0, B1, B2, F2, O1–O4 software, Z1/Z2
  core), wave 2 (B3, F3, B4, B5, B6, B7 + P4, Z3, F1) and wave 3: B5b + Z9
  (`feat/B5b-Z9-hq-writeback`), Z4 (`feat/Z4-grundmengen`), F4 (`feat/F4-real-api-wiring`),
  P1/P3 + P2 (`feat/P1-P3-preorder-screens`, `feat/P2-abholliste`), Z5/Z7 + Z6
  (`feat/Z5-Z7-backzettel-day`, `feat/Z6-backstube-tablet`), each after review + fix. Wave 4a:
  the W4 hardening of the wave-3 follow-ups (`feat/W4-hardening`) and P6 onboarding
  (`feat/P6-onboarding`).
- **What now exists end to end:** the management app talks to the real API on the same origin
  (`/api` via Caddy on the box, `src/proxy.ts` locally; `API_URL` read at start). Pilot screens:
  dashboard, products (with "wartet auf Freigabe"), partners, reports/analytics/finance/Tagesziel,
  Vorbestellungen (entry, list, detail, day view, version check `expectedUpdatedAt`), Abholliste
  per day and pickup point (handover, A4), Mörsbach on `/api/preorders`, Backzettel overview + day
  planning + Freigeben + 3-page print, Grundmengen (writes `config/backzettel.yaml` via the
  `app/edits` worktree, sales reference), Backstube tablet (ticks, deltas, prep, 12 h idle for
  `backstube` at the station). The API pushes product/config edits as a rolling `app/edits` PR
  (B5b) and production snapshots to hq `main` (Z9) - both switched off until the box has
  `HQ_WRITE_DIR`/`HQ_SNAPSHOT_DIR` and a token (Q3). The management E2E runs against the real API
  bundle.
- **W4 hardening (wave 4a):** `POST /api/preorders/bulk-status` (one serialised transaction,
  per-id `ok`/`conflict`/`anonymized`/`not_found`/`refused`, top-level 400 for a value wrong for
  every order) drives the Abholliste bulk actions, with separate German messages for conflict,
  offline and server error and a "Stand von HH:MM" banner when a silent reload fails; "Nicht
  abgeholt" only from the pickup day (409 `not_collected_too_early`, not on the Mörsbach alias);
  pickup points read-only except inhaber, field limits and 409 `stale`; Backliste reads `/sums`
  (no names; `summary` with money figures not for `backstube`); Backzettel deltas are recorded in
  the preorder write transaction, `GET /api/backzettel/:datum` writes nothing itself but starts a
  background catch-up when `deltasPending`, which `/backstube` and the planning page now show;
  login rate limit counts only failed attempts, aborted waiters free their slot, waiting capped at
  5 s; `/api/notifications` 404/501 stops polling outside pilot mode; 12 h idle on `/backstube`
  for every role, leaving it after > 10 min idle logs a non-`backstube` session out; `yaml` ^2 is a
  root dependency (external in the bundle). New E2E `management-preorders.spec.ts` (Mörsbach +
  Abholliste handover against the real API).
- **P6 (wave 4a):** `/admin/hilfe` for every role (cheat sheet per role, own role first, each
  sheet prints as one A4 page), Papierbetrieb section (wall notice, Vorbestellschein 2/4 per page,
  Backzettel-Notfallblatt from `GET /api/backzettel/config`), `docs/onboarding.md` and runbook §9.
- **Verified on `pilot` (2026-11-06, after wave 4a):** `npm run type-check` ok;
  `bakery-api:typecheck` ok; API jest 91 suites / 2128 tests green (6 suites, 62 tests skipped);
  `nx test bakery-management` 81 suites / 799 tests green; bundle builds; `boot-smoke.sh` ok;
  `deploy/tests/run-tests.sh` 157 ok; `npm run lint:all` 9 projects, 0 errors; management E2E
  (built app, pilot mode, real API) 30 passed / 14 skipped. Wave 3's cross-feature smoke (40/40)
  was not re-run on the combined build.
- **`hq` branches, committed but unpushed** (worktrees in the session scratchpad):
  `feat/H1-pipeline-hardening` (H1, needs the on-Pi test), `feat/Z1-backzettel-config` (draft
  `config/backzettel.yaml`, open values `null`, needs Z0), `feat/H2-hq-ci` (H2, needs a push,
  actionlint and one throwaway `app/edits` PR; check Actions write permission),
  `feat/H3-pipeline-fixes` (H3 on top of H1, GNU `date` branch needs a run on the Pi),
  `feat/H5-docs` (H5 on top of H2; its docs are only true once H3 is merged and B5b is live).
- **Next (wave 4b):** a verification loop across all pilot screens (every role × phone/tablet/PC ×
  light/dark against the real API on one combined build, fixing what it finds, including the P6
  help texts against the screens), and the owner-dependent items: Z0 baker session + Z1 values, Z8
  CAP templates, P5 Christmas products, Q3 token, the box (O1 hardware, first `deploy.sh` with an
  empty `NEXT_PUBLIC_API_URL` behind Caddy, `create-user` per person, `import-partners` /
  `import-preorders` dry run then real, restore drill), pushing H1/H2/Z1. Owner decisions waiting:
  see §11 (wave 2, 3 and 4a entries).

- **Source of truth.** This file is the plan, the decisions and the progress log in one place.
  Nothing else in `.mc/proposals` or `.mc/research` holds pilot decisions.
- **Status.** Tasks use checkboxes. `[ ]` open, `[~]` in progress (add branch/PR), `[x]` done
  (add PR number). Update the checkbox in the same PR that does the work.
- **Task IDs** are stable. Use them in branch names and commits (`feat(api): B3 auth …`).
  - `B` backend
  - `F` frontend shell
  - `O` operations
  - `P` Vorbestellungen
  - `Z` Backzettel
  - `H` hq repo (pipeline, CI)
  - `Q` questions/owner
- **Changing a decision.** Edit its row in §2, add a line to the log in §11, and never silently
  rewrite history.
- **After a context compact,** read §1–§2 and §6. The next open task in the current milestone is
  where to continue.

## 1. Key dates and constraints

| Date         | What                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| Fri 14.11.   | **M0 Foundation** done: real API on the box, login, products, reports, partners, backup |
| Tue 17.11.   | **M1 Vorbestellungen** live (KW 47, Stollen starts)                                     |
| Tue 24.11.   | **M2 Backzettel** live (KW 48, Advent)                                                  |
| Fri 27.11.   | Feature freeze → **M3** run through Christmas                                           |
| Jan 2027     | **M4** review and v2                                                                    |
| Feb–Mar 2027 | **M5** next workflows                                                                   |

**Opening hours and production days:**

- Shop: Tue–Sat until about 13:00, **Sunday 7–11**, **Monday Ruhetag**.
- Production days: **Tue–Sun**. Baking starts at 02:00; prep runs 14–15 h the afternoon before.
- Go-live days are Tuesdays.

**Hard constraints:**

- The Vectron register with TSE is the only fiscal record. The app never takes payments; it records
  "bezahlt ja/nein" only.
- The website repo is public, so only synthetic data goes into code, tests, fixtures and commits.
- Customer data never goes into `hq` git.

---

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | **Own bakery first.** Build for Heusser's real workflows. The old multi-bakery OSS PRD (≥ 50 bakeries, personas, POS) is superseded.                                                                                                                                                                                                                                                                                                                       | accepted |
| D2  | **Real backend: the TypeScript API** (`apps/bakery-api/src` + `libs/api/*`, Express + Sequelize + SQLite). No hardening of the mock server. See §4.                                                                                                                                                                                                                                                                                                        | accepted |
| D3  | **The mock contracts win.** The frontend is built and tested against `simple-server.js`, so the real API implements those shapes. `simple-server.js` stays only as a parity reference until cutover, then is deleted.                                                                                                                                                                                                                                      | accepted |
| D4  | **Host: a dedicated box in the bakery** (Pi 5 8 GB + SSD or a mini-PC), separate from the agents' Pi `robot0`. **Local Wi-Fi only.** LAN HTTPS via `intern.<domain>` → LAN IP, Caddy with a Let's Encrypt DNS-01 certificate. Nightly off-site backup. Pull-based deploy, no self-hosted GitHub runner.                                                                                                                                                    | accepted |
| D5  | **Identity: personal accounts.** Shared tablets (Laden, Backstube) are _stations_ where staff switch user by PIN. Roles: `inhaber`, `verkauf`, `backstube`, `fahrer`. Every API route needs a session except `/health` and login. Every write is attributed to a user.                                                                                                                                                                                     | accepted |
| D6  | **hq write-back: one rolling PR, auto-merged on green CI.** Product and config edits go to a second worktree on branch `app/edits` (rebased on `origin/main` before each push), committed as `Verwaltung (App)` with the editor as `Co-authored-by`, pushed to one open PR. A workflow in `hq` validates the schema and merges the PR if it is green (§4a). The read clone on `main` is never written to. Until merge the app shows "wartet auf Freigabe". | accepted |
| D7  | **Pilot scope: Vorbestellungen + Backzettel.** Plus what is already real: products, reports, analytics, finance, Tagesziel, Backschrank. All demo pages are hidden by `PILOT_MODE` (§3). One responsive PWA for all devices; every pilot screen can be printed on A4.                                                                                                                                                                                      | accepted |
| D8  | **The Backzettel is essential.** Model in §5: master data in `hq/config/backzettel.yaml`, daily plans in SQLite, calculation once in `backzettel.core.js`. Saturday Hefeteig (doughs, pieces, fillings) is first-class.                                                                                                                                                                                                                                    | accepted |
| D9  | **Where data lives.** Master data in `hq` (products, Backzettel config, recipes): versioned, reviewed. Operational data in SQLite: users, sessions, preorders, Backzettel days, partner visits, audit. Read-only from `hq`: cash reports, finance, targets.                                                                                                                                                                                                | accepted |
| D10 | **Seasonal factor defaults to 1.0**, with manual corrections. `hq/data/production/planning/seasonal-calendar.md` is a generic template (KW 45 = 200 %) and must **not** be imported.                                                                                                                                                                                                                                                                       | accepted |
| D11 | **Out of the pilot:** the delivery app for drivers (they can't reach a LAN-only server on the road; the Mörsbach list is printed), the Automat/vending view, HACCP, inventory, Einkauf, Dienstplan.                                                                                                                                                                                                                                                        | accepted |
| D12 | **Password and PIN hashes use `node:crypto` scrypt.** This avoids native `bcrypt` builds on the box. The `sqlite3` native module needs an arm64/x64 prebuild, which must be checked in O1.                                                                                                                                                                                                                                                                 | accepted |
| D13 | **`hq` is the shared living document** of people, agents and the app, with one owner per path (§4a). Personal data (customer names, phones, logins) never enters `hq`.                                                                                                                                                                                                                                                                                     | accepted |
| D14 | **The app writes daily snapshots to `hq` directly** (confirmed Backzettel, preorder sums per product, no personal data) into its own path `data/production/`, pushed to `main` like the pipeline's reports. Agents (Anna) and people can read what the app did. This requires the minimal pipeline hardening (H1) first.                                                                                                                                   | accepted |
| D15 | **`hq` work in the pilot is minimal:** pipeline hardening (H1) and schema CI + auto-merge (H2). Pipeline bug fixes, docs, a separate GitHub App identity and Anna's skill updates come after Christmas (M4).                                                                                                                                                                                                                                               | accepted |

---

## 3. Where we stand (research 2026-11-05)

**Repo activity:**

- Nothing has been committed since PR #104 (2026-09-07), and `.mc/tasks/todo` is empty.
- 18 tasks were cancelled on 2026-03-11 because "backend must compile first": orders UI, staff,
  recipes, production, inventory, user management.
- The uncommitted Automat feature (`admin/automat`, `src/lib/vending.ts`) is out of pilot scope.
- The local `hq` copy is 58 commits behind (automatic report commits). Run `git pull` before demos.

**Management app, route by route:**

| Keep (real data)                                                                                                                                                        | Hide with `PILOT_MODE` (invented data or stubs)                                                                                                                                            | Replace with the Backzettel                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| dashboard (Kasse tile), products, delivery/preorders (Mörsbach), partners (Backschrank), reports, analytics, finance, Tagesziel, social-media (owner), settings (theme) | cash (`Math.random()`, saves nothing), staff, intern-orders, unsold-products, inventory, production, orders, delivery (order-based), notifications, chat, recipes/processes stubs, automat | baking-list (`Math.random()` quantities), bakery/daily-prep (hardcoded, localStorage), bakery/saturday-production (localStorage) |

**Real TS API (verified by bundling and starting it in a scratch dir):**

- It can start: esbuild found exactly 14 blockers.
  - 9 npm packages not installed: swagger-ui-express, swagger-jsdoc, express-rate-limit, winston,
    winston-daily-rotate-file, prom-client, csv-parse, xlsx, multer.
  - 4 missing aliases: `@bakery/api/{chat,dashboard,staff}` and
    `@bakery/api/import-service/sales-analytics`.
  - 1 missing file: `services/notification-archival.service`.
  - Behind those: `pg`, pulled in by legacy middleware.
- With these pruned, all 17 migrations run through Umzug on SQLite, and it served `/health`, login
  and partners.

| Domain                                                                                                                   | State                                                                                                                                                                                                         | Action                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Auth/users                                                                                                               | `libs/api/auth` keeps users in an in-memory Map (admin/admin123 per start). `/refresh` returns 501. `User` model has no password column; the migration requires one. `requireRole` exists but is barely used. | rewrite on Sequelize (B3)                                |
| Partners                                                                                                                 | **Clean.** Models match migration `20260830120000`; 14-endpoint TS router → `partner-stats.core.js`. No auth.                                                                                                 | keep, add guards (B6)                                    |
| Products                                                                                                                 | 10 hardcoded in-memory products; model drifts from its migration; CSV seeder path broken                                                                                                                      | serve hq markdown; port from mock (B5)                   |
| Orders                                                                                                                   | stub router; `order_items` table missing; model/migration drift                                                                                                                                               | dead → replaced by Preorder (B7)                         |
| Preorders                                                                                                                | not present; only `delivery-preorders.core.js` + mock routes + `delivery-store.json`                                                                                                                          | new (B7)                                                 |
| Production / baking-list                                                                                                 | ~3,900 lines; 500 at runtime (associations, column drift); models workflow tracking, not quantities                                                                                                           | dead → Backzettel new (Z\*)                              |
| Reports                                                                                                                  | TS route returns hardcoded fake data                                                                                                                                                                          | mount `reports.mock.js` (B4)                             |
| Finance / targets                                                                                                        | only in the mock modules (`install(app, auth)`)                                                                                                                                                               | mount via auth adapter (B4)                              |
| Deliveries/tours                                                                                                         | `libs/api/delivery` in-memory with another contract; the mock has 25 inline endpoints in `simple-server.js` (~1870–3300)                                                                                      | port after Christmas (D11)                               |
| Recipes, inventory, cash, chat, dashboard, staff, notifications, templates, preferences, import, sales-analytics, unsold | in-memory, 500, 401 on valid tokens, or broken imports                                                                                                                                                        | unmount for the pilot                                    |
| DB/migrations                                                                                                            | path hardcoded (`libs/api/database/src/lib/connection.ts`); the runner shells out to `npx sequelize-cli`; `syncDatabase()` runs before `initializeModels()`; 8 of 20 models drift; 2 tables missing           | `DB_PATH` env, Umzug in-process, fresh baseline (B0, B2) |
| Monitoring                                                                                                               | registered after the 404 catch-all, so `/metrics` returns 404                                                                                                                                                 | drop for the pilot (journald + `/health`)                |

**Mock-only capabilities to bring over:**

- The `*.core.js` business rules have ~450 test declarations in `tests/**/*.test.js`. They are
  `require`d from TS, as `partner-stats.service.ts` already does, and get bundled by esbuild.
- Finance and targets mount through an auth adapter that maps `admin` → `inhaber`.
- Reports mount via `register(app)`.
- hq-products, preorders and shop `POST /api/orders` must be extracted from `simple-server.js`.

**What the bakery needs (from `hq`):**

- Biggest documented loss: 5–15 % of goods unsold, against a target under 5 %.
- Preorders come by phone and WhatsApp with no system; Christmas is the peak.
- Anna (the Telegram agent) already serves the owner with revenue summaries, so the app's job is
  the staff screens.
- Several `hq` files are AI-written templates that contradict reality and must not feed the system:
  - `notes/procedures/production-planning-cycle.md`
  - `data/production/planning/{seasonal-calendar,batch-calculator}.md`
  - `data/inventory/suppliers/*`
  - the HACCP concept's placeholders
- Scale: about 80 Bons per trading day, 103 catalog products, a team of about 4–6 people
  (owner, 1 baker, 2 sales staff, 1–2 Saturday drivers).

---

## 4. Target architecture

```
 staff phone ─┐
 shop tablet ─┤  bakery Wi-Fi   ┌──────────── bakery box (Node 20, systemd) ─────────────┐
 Backstube  ──┼── HTTPS ──────► │ Caddy (intern.<domain>, LE DNS-01)                      │
 office PC  ──┘                 │   ├─ bakery-management  (next start, :4201, PWA)        │
                                │   └─ /api → bakery-api  (esbuild bundle main.js, :5000) │
                                │          ├─ SQLite  DB_PATH=/var/lib/bakery/bakery.db   │
                                │          ├─ hq read clone  (main, pulled after 14:30/17:30 pipeline) │
                                │          └─ hq worktree    (app/edits → rolling PR)     │
                                │   restic nightly → off-site · health → Telegram alert   │
                                └─────────────────────────────────────────────────────────┘
```

**Backend build and runtime:**

- `apps/bakery-api/build.mjs` uses esbuild with `--bundle --packages=external --platform=node
--target=node20` and `useDefineForClassFields: false`. It is wrapped as an `nx:run-commands`
  target, with esbuild pinned as a devDependency.
- One `main.js` runs under systemd against the root `node_modules`.
- Startup order: Umzug migrations in-process with a static list → `initializeModels()` → listen.
- SQLite runs in WAL mode with `busy_timeout`.
- `app.ts` exports `createApp()`; `server.ts` calls listen.
- Errors always carry `message` + `error`, because `ApiClient` throws `new Error(data.message)`.

**Mounted for the pilot:** health, auth, products (hq), partners, preorders, backzettel, reports,
analytics, finance, targets. Everything else is unmounted.

**Contracts (D3):**

| Endpoint                                               | Pilot contract                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/*`                                          | `auth.mock.js` shape: `login`, `me`, `refresh`, `logout`, plus new `POST /api/auth/pin`. Refresh tokens rotate and are stored server-side.           |
| `/api/products`, `/api/hq-products`                    | hq catalogue with slug ids (`HQProduct[]`); writes go to the worktree (D6)                                                                           |
| `/api/preorders`                                       | new, generalised; `/api/deliveries/preorders` stays as an alias for the Mörsbach UI; shop `POST /api/orders` creates a Preorder with `channel: shop` |
| `/api/partners/*`                                      | already identical; proven by a parity suite                                                                                                          |
| `/api/reports/*`, `/api/analytics/*`, `/api/finance/*` | hq-file contracts from the mock modules                                                                                                              |
| `/api/backzettel/*`                                    | new (§5)                                                                                                                                             |

**Tests:**

- Keep `tests/**/*.test.js` for the cores.
- Add a second jest project for TS (`src/**/*.spec.ts`, `tests/**/*.test.ts`) with
  `moduleNameMapper` from the tsconfig paths. There are 31 TS specs that never run today.
- Integration tests use supertest against `createApp()` with `:memory:` SQLite and the migrations.
- Parity suites run against both servers until cutover.
- CI boot smoke test: bundle → start → `curl /health` + login.

---

## 4a. `hq` as a shared living document

### How `hq` is written today (2026-11-05)

- **Only one writer in practice:** `hq/data/reports/scripts/daily_pipeline.sh`, an OpenClaw cron on
  `robot0`.
  - 14:30 `kassenbericht`: an agent job; Anna relays the summary to Telegram.
  - 17:30 `kassenbericht-nachlauf`: a command job that stays silent when there is nothing new.
  - All 65 "Anna (Bäckerei-Agent)" commits since 2026-09-02 come from it.
- **Push mechanics:** it pushes straight to `main` through the HainrichHeusserBot GitHub App
  (short-lived token via a credential helper). The author string "Anna" is cosmetic.
- **Anna's content path is defined but unused:** `edit/<slug>` branch → PR → a human merges, per
  `agent/fleet/skills/bakery-base/SKILL.md`. PR #1 is the only PR ever. Robin does not touch `hq`.
- **No guardrails:** `main` is not protected (needs GitHub Pro for a private repo), there is no CI
  and no validation, and every writer shares one GitHub identity.
- **Notifications:** Telegram, through Anna's bot account `bakery`, to the owner only.

**Risks once the app writes too:**

1. A push to `main` during the pipeline's ~20-minute window gets the pipeline's push rejected.
   - The commit is stranded on the Pi.
   - Every later run fails at `git pull --ff-only` (a ❌ every day until fixed by SSH).
2. The pipeline commits the whole index (`git commit` without a pathspec, :237) and runs
   `git switch main` in Anna's working copy.
3. Two pipeline bugs:
   - The weekly report is one week late (`date -d 'last monday -1 day'`, :208): on 2026-11-02 it
     produced W43, not W44.
   - Monday 17:30 makes a timestamp-only commit (the footer regex at :200 misses
     "Wochenbericht generiert am").
4. Stale docs: `hq/CLAUDE.md:80-86` and `README.md` say the API reads `products.csv`;
   `products/_template.md` has the wrong categories and no `numeric_id`.

### The cash-register data (what the app reads)

| Path                                                | Content                                                                                                                                                | Use in the app                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `data/reports/raw/*taxonomie*.json`                 | myVectron DSFinV-K export with TSE; lines carry `item.number` (PLU), `item.group_name` (`## Brötchen`, `## Kaffeestückchen`, `## Brot`, `## Kuchen` …) | not directly                                                                                    |
| `data/reports/converted/YYYY-MM-DD_<register>.json` | one file per day: transactions → items (`product`, `product_id` = PLU, `quantity`, `price`, `total`), `daily_summary`. **Drops `group_name`**          | reports, analytics, Tagesziel (exists); Backzettel reference column (Z4) and v2 suggestion (M4) |
| `data/reports/daily-reports/*.md`                   | Anna's Markdown day report (top/flop 10, hours, categories, staff)                                                                                     | optional: show it instead of recomputing (M4)                                                   |
| `weekly-reports/`, `monthly-reports/`               | Markdown                                                                                                                                               | –                                                                                               |

As of 2026-11-05 the data is complete since 2026-09-07, except Saturdays 03.10. (holiday), 10.10.
and 31.10. (check). It is updated daily around 14:30 and 17:30.

### Who owns which path (D13)

| Writer                         | Paths                                                                                                                                     | How changes land                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Pipeline                       | `data/reports/{raw,converted,daily-reports,weekly-reports,monthly-reports}`                                                               | push to `main`, only these paths (H1)                                   |
| App: snapshots (D14)           | `data/production/backzettel/YYYY-MM-DD.{md,json}`, `data/production/vorbestellungen/YYYY-MM-DD.json` (sums per product/variant, no names) | push to `main`, only these paths, rebase + retry                        |
| App, Anna, people: master data | `products/`, `config/backzettel.yaml`, `data/recipes/`                                                                                    | PR (app: rolling `app/edits`; Anna: `edit/<slug>`) → H2 CI → auto-merge |
| Owner                          | `data/finance/**`                                                                                                                         | as now (private export from the Mac)                                    |
| People + Anna                  | `notes/`, `meetings/`, `projects/`, `customers/`, `templates/`                                                                            | Anna via PR; people directly                                            |
| Nobody by hand                 | `raw/`, `converted/`, `*-reports/*.md`                                                                                                    | –                                                                       |
| Never in `hq`                  | customer names and phones, logins, PINs, audit log                                                                                        | SQLite on the box only                                                  |

### How the app syncs

- **Read clone** on `main` (`/var/lib/bakery/hq`):
  - Refreshed with `git fetch` + `git reset --hard origin/main` every 10 minutes and at 14:50 and
    17:50 after the pipeline.
  - Never written to; never shared with Anna's clone on the Pi.
- **Write worktree** on `app/edits` for master data:
  - Rebase on `origin/main`, commit as `Verwaltung (App)` with `Co-authored-by: <editor>`.
  - `push --force-with-lease`, then open or append the one rolling PR.
- **Snapshot writer** in a second worktree on `main`:
  - Commits only `data/production/**`, `pull --rebase` + one retry on a rejected push.
  - Runs after confirm (Backzettel) and nightly (preorder sums).
- **Offline:** commits queue locally; push retries every 15 minutes.
- **Auth:** the existing HainrichHeusserBot App or a fine-grained token for `H-Bakery/hq`
  (contents + PRs), in the box's `.env` (Q3). A separate App identity follows in M4.

### Auto-merge without branch protection

GitHub's built-in auto-merge needs branch protection, which the private repo's plan lacks. Instead
`hq/.github/workflows/validate.yml` runs on every PR:

1. Validate product frontmatter: required keys, category enum, unique `id`/`numeric_id`,
   filename `{numeric_id}-{id}.md`, `price` numeric.
2. Validate `config/backzettel.yaml`, using the same validator as Z1, published as a small script.
3. Path guard: PRs from `app/edits` may touch only the master-data paths.
4. If all are green and the branch is `app/edits` (later also `edit/*`), merge with `gh pr merge`
   using the workflow token.

A failed check leaves the PR open and notifies the owner through Telegram (M4) or GitHub e-mail
(pilot).

---

## 5. Backzettel design

### 5.1 What exists and what happens to it

| Asset                                                                                                        | Real?                                                                                                                                                     | Fate                                               |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `hq/data/production/dough-specs/Teigstücke-Hefeteig.md` (9 Hefeteig pieces, weight × count)                  | **real**: the baker's note; the register's PLUs 402–409 match it item by item                                                                             | master data → `backzettel.yaml`                    |
| `hq/data/recipes/fillings/{Gefüllte-Kränze,Apfelfüllung}.md` (Nuss, Marzipan, Schoko, Pudding, Quark, Apfel) | real batch recipes; no grams per piece                                                                                                                    | filling scaling                                    |
| `hq/config/prep-tasks/standard-prep-config.yaml`                                                             | **real**: one handwritten sheet, June 2025 (Kaffeestückchen-Wagen, 15 items with Blech numbers; Sauerteig, Brühstück, Fleischkäse, cakes, bread in Liter) | seed for weekday base quantities + prep            |
| `hq/data/production/prep-tasks/daily/2025-06-10-…`, `notes/procedures/wednesday-variations.md`               | real, but one sample                                                                                                                                      | Wednesday seed                                     |
| `hq/data/recipes/{breads,rolls,snacks,baguettes}` (40)                                                       | AI-normalised, household scale; no Hefeteig/Plunder/Streusel recipe                                                                                       | `yield` field only, unverified                     |
| `hq/data/reports/converted/*.json`                                                                           | real; sale lines carry `product_id` (PLU) + `quantity`                                                                                                    | v2 suggestions and plausibility checks             |
| `hq/data/reports/scripts/create_baking_plan.py`                                                              | real data, but **buggy** (`days += 1` per sale line)                                                                                                      | not used                                           |
| `apps/bakery-management/src/features/production/*` (`HefezopfCalculator`, `productionCalculator.spec.ts`)    | real logic from June 2025; product names match neither hq nor the PLUs                                                                                    | **port** into `backzettel.core.js`, data from YAML |
| `feature-daily-prep/.../utils/trayInfo.ts` + spec                                                            | real Blech formatting                                                                                                                                     | keep                                               |
| `delivery-preorders.core.js` `summarizePreorders().byProduct`                                                | real                                                                                                                                                      | reuse for preorder sums                            |
| CAP partner delivery templates (per weekday Tue–Sat)                                                         | real code; all templates **empty**                                                                                                                        | input; fill in M2                                  |
| `feature-daily-prep` rest, `prepTaskLoader.ts` (invented rules, Monday production)                           | demo                                                                                                                                                      | delete after go-live                               |
| `libs/bakery-management/feature-inventory/src/lib/production/*`                                              | old duplicate                                                                                                                                             | delete                                             |
| `libs/bakery-management/feature-saturday-production`                                                         | empty shell, broken exports                                                                                                                               | delete with its tsconfig path                      |
| `admin/baking-list`, `/api/baking-list` (mock), `libs/api/baking-list` (TS, not runnable)                    | demo                                                                                                                                                      | delete; redirect to the Backzettel                 |

**Known data conflict.** The existing code makes the filled Kranz 3 × 600 g; `hq` says 1 × 1200 g.
The code was changed in commit 0a613ad9 (2025-07-28) and a spec locks in its value. The baker
decides (Q-B3).

### 5.2 What the days look like (from the data)

**Weekday (Tue–Fri):**

- **Prep, 14–15 h the day before:**
  - Kaffeestückchen-Wagen from the freezer: 15 items with Blech numbers, from Schokocroissant 10
    on Blech 1 to Nougatplunder 3 × 12 on Blech 15–17. Then into the retarder on program A.
  - Sauerteig (Mischbrot; Buttermilch on Wednesday), Brühstück for Vollgut, Fleischkäse at 105 °C.
- **Cakes:** Marmor 3, Rahm 3, Käse-Mandarine 2, Kirschstreusel 2.
- **Bread in Liter (water):** Korn 6, Holzluken 6, Misch 3, Hafer 1.24. On Wednesday add
  Vollgut 2 and Buttermilch 3. The register suggests a rotation: Spezialbrot Tue/Thu, Dinkel/Urkorn
  Thu/Fri, Körnerbrot Saturday.
- **Rolls, Laugen, Snacks:** no written quantities exist anywhere. Register averages per day:
  Doppelweck 34–52, Flitweck 24–35, Brezel 16–25, Käseweck 11–16.
- **Wednesday:** pastry 1–2 pieces fewer per item. The register agrees (Plunder Wednesday ~22 vs.
  Thursday ~36).

**Saturday: a different assortment, Hefeteig and cake.**

- Plunder, Taschen, Hefeteig-Kaffeestückchen, Einback and Schoko-/Rosinenbrötchen drop to about 0.
- Saturday-only rolls: Elsässer ~28, Samstagsweck ~9–11, Hörnchen ~4–5. Sternweck rises to 17–23
  and Croissants double.
- **The Hefeteig family**, from the Teigstückübersicht and PLUs 402–409:

  | Product                         | Teigstück (from hq)          | Fillings                                 |
  | ------------------------------- | ---------------------------- | ---------------------------------------- |
  | Hefezopf groß (402)             | 300 g × 3                    | –                                        |
  | Hefezopf klein (403)            | 300 g × 2                    | –                                        |
  | Kranzkuchen (404)               | 600 g × 3                    | –                                        |
  | Rosinenbrot (405)               | 600 g × 1                    | –                                        |
  | Streusel groß / klein (406/407) | 900 g / 500 g × 1            | –                                        |
  | Zopf gefüllt (408)              | 500 g × 1                    | Nuss, Schoko, Quark, Pudding             |
  | Kranz gefüllt (409)             | 1200 g × 1 (code: 3 × 600 g) | Nuss, Schoko, Quark, Pudding (Marzipan?) |
  | Teig, ausgerollt                | 500 g × 1                    |                                          |

- "Kuchen, sonstige" sells 25–39 on Saturday vs. 3–10 on weekdays. Since June 2026 staff ring
  Saturday cakes up as "Kuchen, sonstige", so **Saturday quantities per variant cannot be derived
  from the register**. The baker has to set them.
- Mörsbach collection point: Saturday, orders close **Friday 12:00**, before the Friday 14 h freeze.
- CAP is delivered Tue–Sat.

**Sunday:**

- Sonntagsbrötchen ~56, Knusperweck ~60, Roggenweck ~40, Käsezwilling ~18, Zwilling mit Topping ~13.
- Missing from `hq/products`: Sonntagsbrötchen, the Zwillinge, Mehrkornweck, 4-Saat,
  Vitalbrötchen, Nougatplunder, Franzbrötchen. They are needed as Backzettel items (preorderable
  or not).

### 5.3 Model

**A Backzettel item is a production item, not a sales product.** It maps to one or more hq
products with a factor; a quarter is 0.25 of a whole. It optionally has PLUs, variants (fillings),
a dough piece, filling grams, a Blech position and base quantities per weekday.

**Master data `hq/config/backzettel.yaml`** (edited in the app → rolling PR, D6):

```yaml
version: 1
days: [2, 3, 4, 5, 6, 7] # ISO weekday; 1 = Ruhetag
sections:
  [vorbereitung, brot, broetchen, laugen, kaffeestueckchen, kuchen, hefeteig]
items:
  - id: zopf-gefuellt
    section: hefeteig
    unit: Stück
    products: [{ id: zopf-gefuellt-nuss-schoko-quark-oder-pudding, factor: 1 }]
    plu: [408]
    variants: [nuss, schoko, quark, pudding]
    dough: { id: hefeteig-suess, piece_g: 500, pieces: 1 }
    filling_g: 450 # to confirm (Q-B4)
    base: { 6: { nuss: 4, schoko: 3, quark: 2, pudding: 1 } }
  - id: kranz-ungefuellt
    section: hefeteig
    products:
      [
        { id: kranzkuchen-ungefuellt, factor: 1 },
        { id: kranzkuchen-ungefuellt-1-4-stueck, factor: 0.25 },
      ]
    dough: { id: hefeteig-suess, piece_g: 600, pieces: 3 }
  - id: kornbrot
    section: brot
    unit: Liter
    base: { 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 }
    pieces_per_liter: null # unknown → no loaf count shown
  - id: schokocroissant
    section: kaffeestueckchen
    tray: { no: 1 }
    base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 0 }
doughs: [{ id: hefeteig-suess, batch_max_kg: 40 }] # batch size to confirm (Q-B5)
fillings: [{ id: nuss, recipe: data/recipes/fillings/Gefüllte-Kränze.md }]
prep:
  - { id: sauerteig, by_weekday: { 3: buttermilch, default: misch } }
  - { id: bruehstueck-vollgut, when_item: vollgut }
  - { id: fleischkaese }
```

**Operational data (SQLite):**

- `backzettel_days`: date, status `draft → confirmed`, season_factor (default 1.0),
  confirmed_by/at.
- `backzettel_lines`: date, item_id, variant, base, seasonal, preorders, cap, correction,
  correction_reason, correction_by, total, done_at/by.
- `backzettel_deltas`: date, item_id, variant, qty, preorder_id, created_at. These are preorders
  that arrived after confirmation.
- The audit log is shared with preorders.
- **`preorder_items.variant`** must exist from M1, validated against the item's `variants`.
  Without it, a preorder cannot say which filling it wants.

### 5.4 Calculation (once, in `apps/bakery-api/src/services/backzettel.core.js`, dependency-free CommonJS)

```
line(item, variant, d) = max(0,
    ceil(base(item, weekday(d), variant) × season(d))
  + Σ preorders(products of item × factor, variant, pickup = d)   -- quarters summed, then ceil
  + capTemplate(item, weekday(d))
  + correction(item, variant, d))
```

**Hefeteig (Saturday first):**

- pieces = Σ line × pieces per product
- dough g = Σ pieces × piece_g per dough
- batches = ceil(dough / batch_max)
- A **weighing list** per piece weight.

**Fillings:**

- grams per filling = Σ line(variant) × filling_g.
- The batch recipe is scaled by grams ÷ batch weight, ingredients rounded to 10 g.
- This is the ported `HefezopfCalculator` / `FillingPreparation` logic.

**Other sections:**

- **Kaffeestückchen:** Blech layout via `formatTrayInfo`.
- **Bread:** in Liter, exactly as the baker writes it. A loaf estimate is shown only when
  `pieces_per_liter` is set.
- **Prep:** tasks for day d appear on d's Backzettel and in a "Vorbereitung heute" view for 14 h on
  d−1.

**Freeze:**

- d−1 at 14 h: Saturday's sheet on Friday after the Mörsbach deadline, Sunday's on Saturday
  afternoon, Tuesday's when the baker decides (Q-B2).
- After confirmation, new or changed preorders create **deltas**, highlighted and never silently
  merged.

**v2 (M4):** a suggestion next to Basis, the median of the same weekday over the last 6 trading
weeks via `plu` plus "Rest am Abend". It never overwrites Basis.

### 5.5 Screens

1. `/admin/backzettel/grundmengen` (PC, `inhaber`/`backstube`): a grid of items × Tue–Sun, with
   variant sub-rows for Hefeteig. Saving goes to the rolling hq PR.
2. `/admin/backzettel/[datum]` (PC/phone): columns Basis | Saison | Vorbestellt | CAP | Korrektur
   (with reason) | Gesamt. On Saturday, a Hefeteig & Füllungen card. A **Freigeben** button.
3. `/backstube` (tablet station view): the next production day, large type, high contrast, one tick
   per line, a badge on deltas. On Saturday the Hefeteig card comes first. A "Vorbereitung heute"
   tab.
4. **A4 print** via `@media print`:
   - p. 1 the Backzettel
   - p. 2 (Saturday) the weighing list + scaled filling recipes
   - p. 3 the Vorbereitung

---

## 6. Milestones and tasks

Sizes: S ≤ 0.5 d, M 1–2 d, L 3–5 d. "→" means "depends on".

### M0 Foundation (→ Fri 14.11.)

Exit criteria:

- Every staff member can log in on the box over the bakery Wi-Fi; the shop tablet switches users
  by PIN.
- Unauthenticated `/api/preorders` returns 401.
- Restart and reboot lose nothing.
- A backup has been restored on another machine.
- Products, reports, finance, Tagesziel and partners work against the real API.

**Backend**

- [x] **B0** Make the TS API start (M, `feat/B0-api-start`): esbuild `build.mjs` + nx target;
      prune `main.ts`/`routes/index.ts` to the pilot mounts; `DB_PATH`; Umzug in-process with a static list; migrations →
      `initializeModels`; WAL + busy_timeout; `app.ts`/`server.ts` split; `sendError` (message +
      error) + global handler; trim `src/types/ambient.d.ts` to `express-validator`; install
      `express-rate-limit` only.
- [x] **B1** Test harness (M, → B0, `feat/B2-baseline-and-B1-harness`): TS jest project;
      `:memory:` integration with migrations; parity runner against `simple-server.js`; CI boot
      smoke.
- [x] **B2** Pilot baseline migration (S, → B0, `feat/B2-baseline-and-B1-harness`): users,
      refresh_tokens, audit_log, partners\*, preorders, preorder_items (with `variant`),
      pickup_points. The old 17 migrations are archived.
- [x] **B3** Auth (M, → B2, `feat/B3-auth`): User/RefreshToken models; scrypt for password + PIN;
      `login/me/refresh/logout/pin`; role guards; rate limit 5 / 5 min; idempotent `create-user`
      CLI; user admin endpoints (`inhaber`). The server refuses to start in production without a
      stable `JWT_SECRET`.
- [x] **B4** Mount reports/analytics/finance/targets modules with the auth adapter (S, → B3,
      `feat/B4-reports-finance-mount`).
- [x] **B5** hq products router, read + write to the worktree (S–M, → B0), extracted from
      `simple-server.js` using `product-file.core.js`/`product-input.core.js`. A local commit only
      until B5b. (`feat/B5-hq-products`)
- [x] **B6** Partners: guards, hq catalogue lookup, parity test, `partner-store.json` import (S, → B3, B5,
      `feat/B6-partners-hardening`).

**Frontend shell**

- [x] **F1** (`feat/F1-login-station-roles`) Login against the real contract; PIN station screen (tap name → PIN, auto-logout at
      closing / 12 h idle); `middleware.ts` route guard; role-filtered navigation and start page;
      user management screen (M, → B3). The guard is Next 16's `src/proxy.ts` (cookie copy of the
      access token, checked against `/api/auth/me`); closing-time logout is optional
      (`NEXT_PUBLIC_STATION_LOGOUT_AT`, time open).
- [x] **F2** `PILOT_MODE`: hide the demo routes and navigation listed in §3 (S, `feat/F2-pilot-mode`).
- [x] **F3** PWA manifest + service worker (app shell only); check the layout on phone, tablet
      and PC (S, `feat/F3-pwa`).
- [x] **F4** (`feat/F4-real-api-wiring`) Point `API_URL` and the `next.config.js` proxy at the real API; remove `bakeryAPI`
      mock paths from pilot screens (S, → B4–B6).

**Operations**

- [~] **O1** Box: hardware, OS, Node 20, check `sqlite3` prebuild, systemd units (api,
  management), Caddy LAN HTTPS (DNS-01), fixed IP, hq read clone with fetch + `reset --hard`
  every 10 min and at 14:50/17:50 (§4a), `.env` (S–M, → Q1, Q2).
  `feat/O1-O4-ops` (merged on `pilot`): software in `deploy/` + [runbook](runbook.md); hardware,
  Q1, Q2 open.

**hq (minimal set, D15)**

- [~] **H1** Harden `hq/data/reports/scripts/daily_pipeline.sh` (S). Must land before the app
  pushes anything (B5b, Z9). `hq` branch `feat/H1-pipeline-hardening` (unpushed): own paths only,
  replay in a throwaway worktree + one retry, 66/66 local test checks; the on-Pi run is open:
  - `git commit -- "${DATA_PATHS[@]}"` (only its paths).
  - On a rejected push, `git pull --rebase` + one retry.
  - Tested on the Pi with a deliberately conflicting push.
- [~] **O2** Backup: nightly SQLite `.backup` + restic off-site, restore drill; health check every
  5 min → Telegram alert (S, → O1, Q4). `feat/O1-O4-ops`: scripts + timers; Q4, drill open.
- [~] **O3** Pull-based deploy script (`git pull`, `npm ci`, build, restart) + `docs/runbook.md` (S).
  `feat/O1-O4-ops` (merged on `pilot`): B0's `bakery-api:bundle` exists; first real run needs
  the box.
- [~] **O4** Remote maintenance path for the developer, e.g. Tailscale on the box only (S, → Q8).
  `feat/O1-O4-ops`: Tailscale steps in runbook §7; Q8 open.

### M1 Vorbestellungen (build 09.–16.11., live Tue 17.11.)

Exit criteria:

- For all of KW 47, every preorder (Theke, Telefon, WhatsApp, Mörsbach, Weihnachten) is in the app.
- Handover works from the Abholliste and nothing is lost.
- Staff rate entry "not slower than paper".

- [x] **B7** Preorders (M–L, → B3, B5, `feat/B7-preorders`):
  - Models Preorder/PreorderItem/PickupPoint.
  - Generalise `delivery-preorders.core.js`: `channel` (laden, telefon, whatsapp, shop,
    sammelstelle); pickup at the Laden (date + time) **or** a pickup point.
  - Items carry an hq price snapshot + `variant`. Status `offen → bereit → abgeholt` / `storniert`
    (cancel, never delete; `abgeholt ↔ storniert` locked). Paid yes/no.
  - `/api/preorders` + `/api/deliveries/preorders` alias; shop `POST /api/orders` →
    Preorder; `delivery-store.json` import; audit.
  - `GET /api/preorders/sums?date=` per product/variant, for Z2.
- [x] **P1** (`feat/P1-P3-preorder-screens`) Fast entry form, touch (M, → B7): product search, numeric keypad, variant chips for
      filled products, under 30 s per order.
- [x] **P2** (`feat/P2-abholliste`) Abholliste per day and pickup point: tick-off at handover, A4 print (S, → B7). The
      Mörsbach screens move onto the new API.
- [x] **P3** (`feat/P1-P3-preorder-screens`) List, search, edit, cancel; day overview with sums per product (S, → B7).
- [x] **P4** GDPR: anonymise customer name and phone 90 days after pickup (nightly job) (S,
      `feat/B7-preorders`: every status, also the note; `bakery-anonymize.timer` 23:45).
- [ ] **P5** Products: Christmas items (Stollen, Plätzchen) with prices in `hq/products`; add the
      missing Sunday/weekday items (§5.2) via PR (S, owner + agent).
- [x] **P6** (`feat/P6-onboarding`) Onboarding: 15 min per person, a one-page cheat sheet
      (German), a paper fallback form (S). `/admin/hilfe`, `docs/onboarding.md`, runbook §9.

### M2 Backzettel (build 12.–23.11., live Tue 24.11.)

Exit criteria:

- Every production day of KW 48 (Tue–Sun) was confirmed in the app and baked from it, on the
  tablet or printed.
- Saturday 28.11. shows the Hefeteig card with dough and filling quantities the baker accepts.
- Preorders arrive without anyone retyping them.

- [ ] **Z0** Baker session before 12.11. (owner): photo of today's Backzettel; answers to Q-B1…Q-B11 (§7).
- [~] **Z1** `hq/config/backzettel.yaml`: schema, loader and validation, seeded from
  `standard-prep-config.yaml`, `Teigstücke-Hefeteig.md` and Z0 answers; via PR (S–M, → Z0).
  Validator/loader/CLI on `pilot` (`feat/Z1-Z2-backzettel-core`); draft YAML on `hq` branch
  `feat/Z1-backzettel-config` (unpushed), open values `null` until Z0.
- [~] **Z2** `backzettel.core.js` + tests (M, → Z1, B7 sums): port `HefezopfCalculator`/filling
  scaling and its spec (filled Kranz per Q-B3), quarters, CAP template, deltas, prep by
  weekday; `trayInfo` reused. Core + 117 tests on `pilot` (`feat/Z1-Z2-backzettel-core`),
  per-preorder deltas. B7 landed (and fixed the `storniert` filter in the core); waits for the
  Q-B answers.
- [x] **Z3** Models `backzettel_days/lines/deltas` + `/api/backzettel` (get day, recompute draft,
      correction, confirm, tick line, deltas) + audit (M, → B2, Z2, `feat/Z3-backzettel-api`).
      A confirmed day is frozen (`computed_snapshot`); deltas are recorded on read until B7's
      write path records them.
- [x] **Z4** (`feat/Z4-grundmengen`) Grundmengen screen (S–M, → Z3, B5b). Shows next to each Basis a read-only reference:
      median sold on that weekday over the last 6 trading weeks via `plu` from `converted/`
      (info only, never applied automatically).
- [x] **Z5** (`feat/Z5-Z7-backzettel-day`) Day planning screen + Freigeben (M, → Z3).
- [x] **Z6** (`feat/Z6-backstube-tablet`) Backstube tablet view (M, → Z3).
- [x] **Z7** (`feat/Z5-Z7-backzettel-day`) Print, 3 pages (S, → Z5).
- [ ] **Z8** Fill the CAP delivery templates Tue–Sat (S, owner).
- [ ] **Z10** Backzettel v2 - the sheet the bakers actually work from (L, → Z1-Z7, Q-L answers).
      Domain reference (private, with real reference values): `hq/notes/procedures/backliste.md`;
      baker questionnaire `hq/notes/procedures/backliste-fragebogen.md`. Scope:
  - **Doughs as master data** (`doughs[]`: `kg_per_liter` - the bakers' "Liter" is the recipe
    unit, 1 L water + flour + rest -, `liter_rounding`, `batch_max_kg`, shared doughs, add-ons
    such as Dunkelsauer per litre). Litres are computed, never estimated: without `kg_per_liter`
    the sheet shows kg only.
  - **Bread by loaf size** (dough weight per size) instead of `unit: Liter`; a dough may feed
    another item with a fixed extra (Kerbricher from Mischteig + Körner).
  - **Brötchen in Bruch** (one divider press = 30 pieces; weight per Bruch, pieces per product,
    a Bruch split across products).
  - **Dough day ≠ bake day**: Brötchen are made the day before baking; Saturday makes Sunday's
    and Tuesday's, Sunday only bakes. The dough-day sheet collects base + preorders + CAP of its
    bake days; freeze and deltas follow the dough day; a slim bake list per bake day.
  - **One A4 page per dough day** (kneader strip, Brot, Brötchen per bake day, Hefeteig, notes)
    replaces the 3-page print for the bakers; weighing list and recipes stay optional.
  - Hefeteig: one batch (kneader ~90 kg), water = dough ÷ 4, Kranz/Zopf variants Marzipan,
    Mohn, Spezial. The current core already reproduces the paper Hefeteig totals.
  - Tests with invented quantities only; the real reference values stay in hq.
- [~] **B5b** (`feat/B5b-Z9-hq-writeback`, merged; live push needs the Q3 token, H1/H2 merged and the `install.sh` write-clone step run on the box) hq write-back as a rolling PR per §4a: worktree `app/edits`, rebase, commit as
  `Verwaltung (App)` + `Co-authored-by`, push with lease, open/append the PR, offline retry,
  "wartet auf Freigabe" badge until merged (M, → B5, H1, Q3).
- [~] **H2** (`hq` branch `feat/H2-hq-ci`, committed, **unpushed**; never run on GitHub, no actionlint yet; merges with merge commits, not squash, for B5b) `hq` CI (S–M, → Z1):
  - `.github/workflows/validate.yml` with the product frontmatter schema, the `backzettel.yaml`
    schema (Z1's validator) and the path guard.
  - Auto-merge of green `app/edits` PRs via `gh pr merge`.
  - Run once against all 103 products and fix what it finds via PR.
- [~] **Z9** (`feat/B5b-Z9-hq-writeback`, merged; needs `HQ_SNAPSHOT_DIR` on the box + the `bakery-snapshot-preorders.timer`, push credentials per Q3) Snapshots to `hq` (D14) (S, → Z3, B7, H1):
  - On confirm, write `data/production/backzettel/YYYY-MM-DD.{md,json}` (German Markdown, readable
    by Anna and people).
  - Nightly, write `data/production/vorbestellungen/YYYY-MM-DD.json` (sums per product/variant
    only).
  - Push to `main`, only those paths, rebase + retry.

### M3 Run through Christmas (27.11. – 24.12.): freeze

Only bug fixes, data fixes and changes that make the shop or Backstube faster.

- [ ] Daily 5-minute check: health alerts, backup log, open bugs.
- [ ] Weekly feedback note in `.mc/meetings/` (what annoyed staff, what they worked around).
- [ ] Usage numbers: preorders in the app vs. on paper; Backzettel confirmed per production day.
- [ ] Paper fallback ready. Switch to paper if the app blocks work for more than 10 minutes.

Exit criterion: the Christmas preorders were handed over from the app and no data was lost.

### M4 Review and v2 (January 2027)

- [ ] Retrospective with all staff → `hq/meetings/`.
- [~] **H3** (`feat/H3-pipeline-fixes`, hq branch, unpushed; pulled forward from M4, also the
  Monday-to-Sunday weekly report, converter exit 1 on failure and `create_baking_plan.py` per
  opening day) Pipeline bug fixes: weekly report week (`last monday -1 day` → the week just ended);
  Monday footer regex ("Wochenbericht generiert am").
- [ ] **H4** Pipeline runs in its own clone or worktree on the Pi, not in Anna's chat workspace.
- [~] **H5** (`feat/H5-docs`, hq branch, unpushed; `group_name` is in H3) Update `hq/CLAUDE.md` + `README.md` (remove the `products.csv` claims, document §4a
  ownership), fix `products/_template.md` (categories, `numeric_id`, allergens), keep the
  `group_name` in `convert_reports.js`.
- [ ] **H6** Separate GitHub App (or at least committer) for the app; Telegram notice to the
      owner on failed `hq` CI or a pending PR.
- [ ] **H7** Anna skill update (`agent/fleet/skills/bakery-hq`): she reads
      `data/production/backzettel/` and `vorbestellungen/` and can answer "Was steht morgen auf
      dem Backzettel?"; she knows the ownership table and the auto-merge.
- [~] **B12** (branch `next`) Cutover cleanup: delete `simple-server.js`, the legacy root JS layer (`index.js`,
  `controllers/`, `models/`, `routes/`, `middleware/`, `config/`, …) and its 36 tests, the
  unmounted `libs/api/*`, the old pages listed in §5.1, and the `ambient.d.ts` stubs.
- [~] **B8** (branch `next`) Deliveries/tours router on the real API + remote access for drivers (revisit D4/D11).
- [~] "Rest am Abend" (branch `next`): unsold count per product at closing. This measures the waste target.
- [ ] Backzettel v2 suggestions (§5.4).
- [ ] Fix the `group_name` loss in `hq` `convert_reports.js`; fix `create_baking_plan.py`.

### M5 Next workflows (Feb–Mar 2027, prioritise in M4)

| Candidate                                                        | Why                                     | Needs                              |
| ---------------------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| HACCP log + allergens for the 51 products without data           | legal duty (LMIV, HACCP retention)      | real HACCP concept in `hq`         |
| CAP monthly settlement                                           | Ziel 1 (Retourenquote, Deckungsbeitrag) | Steuerberater on invoice numbering |
| Recipes from `hq/data/recipes` → dough and ingredient quantities | Ziel 2 (no Fertigmischungen)            | recipes verified at bakery scale   |
| Einkauf / Bestellliste                                           | duplicate orders, overstock             | real ingredient data               |
| Dienstplan                                                       | Ziel 3                                  | owner priority                     |
| Automat view                                                     | vending-retrofit                        | hardware proven                    |

---

## 7. Owner to-dos and open questions

**Owner to-dos (blocking):**

| ID  | Item                                                                          | Needed by | For    |
| --- | ----------------------------------------------------------------------------- | --------- | ------ |
| Q1  | Buy the box (Pi 5 8 GB + NVMe or a mini-PC). Fallback: the office PC.         | 09.11.    | O1     |
| Q2  | Router: fixed IP; DNS API token for `intern.<domain>`                         | 11.11.    | O1     |
| Q3  | GitHub App or fine-grained token for `H-Bakery/hq` (contents + pull requests) | 11.11.    | B5b    |
| Q4  | Backup target (RustFS bucket and/or cloud) + credentials                      | 12.11.    | O2     |
| Q5  | Staff list: name, role, device                                                | 12.11.    | B3, F1 |
| Q6  | Photo of today's Backzettel + 30 min with the baker                           | 12.11.    | Z0     |
| Q7  | Tablets for the shop and the Backstube + a mount for the Backstube            | 16.11.    | M1, M2 |
| Q8  | Remote maintenance: Tailscale on the box only?                                | 13.11.    | O4     |

**Questions for the baker (Z0):**

- **Q-B1** What does today's paper Backzettel look like? Who writes it, when, and in what order are
  the sections?
- **Q-B2** Who preps Tuesday (Monday is Ruhetag)? When is Sunday prepped?
- **Q-B3** In the Teigstückübersicht, does "Anzahl" mean strands per product? Is a filled Kranz
  1 × 1200 g or 3 × 600 g?
- **Q-B4** How many grams of filling go into a Kranz and into a Zopf? Is Marzipan offered? Mohn?
- **Q-B5** What is the Hefeteig batch size (kneader limit) and the recipe?
- **Q-B6** What are the usual Saturday quantities per Zopf/Kranz variant? Which are also made Tue–Fri?
- **Q-B7** What are the base quantities per weekday for rolls, Laugen and Kaffeestückchen? Is the
  June 2025 sheet still current?
- **Q-B8** How many loaves come out of one Liter, per bread?
- **Q-B9** What is different on Sunday: which rolls, any cake?
- **Q-B10** Which products can be preordered, and which with a filling choice?
- **Q-B11** For Advent, is a factor of 1.0 + corrections enough, or a factor per week?

Partly answered on 2026-11-08 from two Saturday paper sheets and the owner (Q-B1, Q-B2, Q-B3
1 × 1200 g, Q-B4 Marzipan yes, Q-B5 one batch ~90 kg, Q-B6, Q-B8 loaves per size, Q-B9 in part).
Details, the follow-up questions Q-L1…Q-L11 and the printed questionnaire live in
`hq/notes/procedures/backliste.md` (private); answers are recorded there.

**Open business questions:**

- How do Mörsbach and Retter-Schrank cash reach the register and the books? Has the Steuerberater
  agreed?
- Which `hq` templates should be replaced by real data?
- Is the online shop still a goal?
- Should Anna serve staff too, e.g. "Backzettel für morgen"?

---

## 8. Risks

| Risk                                                                           | Mitigation                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Real backend: B0→B2→B3→B7 is about 11–12 dev-days vs. 8 working days to 17.11. | Parallel lanes (§9); B1, F*, O* off the critical path; if B7 slips, Vorbestellungen go live Thu 19.11. |
| Go-live in peak season overloads staff                                         | Vorbestellungen first, Backzettel a week later; print everything; freeze 27.11.                        |
| Backzettel master data missing (rolls, Saturday variants, Sunday)              | Z0 before 12.11.; v1 starts with what the baker confirms, lines may be added in the grid               |
| Hardware late                                                                  | Run on the office PC with the same systemd/Caddy setup, move later                                     |
| Weak Wi-Fi in the Backstube                                                    | Test in O1; access point or the printed Backzettel                                                     |
| Data loss on a single box                                                      | SSD, WAL, nightly off-site backup, restore drill before go-live                                        |
| Native modules (`sqlite3`) on the box                                          | Check prebuilds in O1; scrypt instead of bcrypt (D12)                                                  |
| Template data in `hq` leaks into quantities                                    | D10; the baker reviews Grundmengen before go-live                                                      |
| App push wedges the cash pipeline on the Pi                                    | H1 before any app push; snapshot writer touches only `data/production/**` and retries                  |
| Parallel agent merges break `main`                                             | `npm run type-check` + full test run on `main` after every merge batch                                 |

---

## 9. Execution rules (subagent workflows and loops)

**Lanes:** one workflow per milestone, lanes in separate git worktrees, merged one at a time.

| Lane                     | Tasks                         |
| ------------------------ | ----------------------------- |
| Critical path            | B0 → B2 → B3 → B7 → Z2/Z3     |
| Test harness             | B1                            |
| Frontend shell           | F1–F4 (against B3 contract)   |
| Operations               | O1–O4                         |
| Products / hq write-back | B5 → B5b                      |
| Backzettel core          | Z1 → Z2, starts on Z0 answers |
| hq repo (works in `hq/`) | H1 → H2 (→ Z1 validator)      |

**Definition of done for every task:**

- Unit tests for every `*.core.js`, synthetic fixtures only.
- Integration tests via supertest against `createApp()`.
- Lint + `npm run type-check` + affected tests green.
- A Playwright smoke test for each new pilot screen.
- Errors carry `message` + `error`.
- German UI copy.
- The checkbox in §6 updated and the CLAUDE.md section touched where behaviour changed.

**Worktree builds:** use `--webpack`, `NX_DAEMON=false`, private ports and `HQ_PRODUCTS_DIR`.
Symlinked `node_modules` breaks Turbopack.

**After each merge batch:** `npm run type-check` and the full test run on `main`. Jest passes specs
that have type errors.

**Verification loop after each milestone:** an agent walks the pilot screens at phone, tablet and
PC width, in light and dark. It checks role filtering, 401s without a session, and the print layouts.

**Branches:** `feat/<task-id>-<slug>`. Commit or PR only when the owner says so.

---

## 10. Reference: key paths

| What                       | Path                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Real API entry             | `apps/bakery-api/src/main.ts` → `server.ts` → `app.ts`; bundle `apps/bakery-api/build.mjs`                                             |
| DB connection / migrations | `apps/bakery-api/src/db/{database,migrate,migrations}.ts`; baseline `migrations/20261105000000-pilot-baseline.js`                      |
| Auth (to rewrite)          | `libs/api/auth`, `src/models/User.ts`; contract `src/routes/auth.mock.js`                                                              |
| Business cores             | `apps/bakery-api/src/services/*.core.js`; tests `apps/bakery-api/tests/unit/*.test.js`                                                 |
| Mock server (reference)    | `apps/bakery-api/simple-server.js` (preorders ~1870–3300, baking-list ~1059)                                                           |
| Partners (clean TS)        | `src/routes/partner.routes.ts`, `partner-stats.service.ts`                                                                             |
| Frontend API client        | `libs/shared/data-access/src/lib/api-client.ts`, `apps/bakery-management/next.config.js`                                               |
| Saturday calculator        | `apps/bakery-management/src/features/production/*`                                                                                     |
| Blech formatting           | `libs/bakery-management/feature-daily-prep/.../utils/trayInfo.ts`                                                                      |
| Backzettel seed data       | `hq/config/prep-tasks/standard-prep-config.yaml`, `hq/data/production/dough-specs/Teigstücke-Hefeteig.md`, `hq/data/recipes/fillings/` |
| Opening days               | `hq/data/finance/config/targets.json` (`closed_weekdays: [1]`)                                                                         |
| Box operations (O1–O4)     | [runbook.md](runbook.md); `deploy/` (systemd, Caddy, env templates, scripts, `deploy/tests/run-tests.sh`)                              |

---

## 11. Log

| Date       | Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-05 | Research by 6 read-only agents (management app, backend, real TS API, hq business needs, backlog, Backzettel/Saturday).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-05 | Owner decisions:<br>• own bakery first<br>• pilot ASAP<br>• Vorbestellungen + Backzettel<br>• all four device types<br>• dedicated box in the bakery, Wi-Fi only<br>• personal accounts + tablet PIN<br>• hq edits via PR<br>• **real TS backend, not the mock server**<br>• Backzettel essential, Saturday Hefeteig first-class                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-05 | `hq` pulled to `244c6d9`. Agent research on how `hq` is written (§4a). Owner decisions D13–D15: `hq` is the shared living document with one owner per path; the app pushes non-personal daily snapshots directly; master-data PRs auto-merge on green `hq` CI; only H1 + H2 in the pilot, rest in M4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-05 | Draft RES-001/PROP-001…007 folded into this file and removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-05 | Wave 1 merged into `pilot` (`--no-ff`): O1–O4, F2, Z1/Z2, B0+B1+B2. Conflicts: `CLAUDE.md` (kept both the F2 and Z sections); `apps/bakery-api/project.json` (old `@nx/js:tsc` build with Z1's `*.loader.js` asset glob dropped, B0 bundles with esbuild). Integration fixes: `js-yaml` ^4 root dependency, `HOST` → `listen()`, `marked` jest stub. All API/management tests, lint, type-check, bundle start, boot smoke and deploy tests green. H1 and the Z1 YAML stay on unpushed `hq` branches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-05 | Wave 2 merged into `pilot` (`--no-ff`, in this order): B3, F3, B4, B5, B6, B7 (+P4), Z3, F1. Conflicts: `apps/bakery-api/src/app.ts` (all mounts below the guard: partners with B5's catalogue dir, hq-data, products, preorders with the same dir, Backzettel), `server.ts`/`config/env.ts` (B4 dirs + B5 `loadHqConfig`), `cli.ts` (import-partners + import-/anonymize-preorders, generic `withDatabase<T>(work, { migrate })`), `db/migrations.ts` + expected lists in two tests (Z3 `20261112` before B7 `20261113`), `boot-smoke.sh` (all four `HQ_*`), `admin/layout.tsx` (F3 label style + F1 hidden on xs), `.env.example`, both `CLAUDE.md`. No integration fixes needed. Green: type-check, API jest 81/1902, management 55/477, bundle, boot smoke, deploy tests 157, lint 9 projects, API smoke 19/19. Owner decisions open: finance/Tagesziel only with a password session (`FINANCE_PERSONAL_SESSION_ONLY`, default on); product writes, Backzettel reopen and visit DELETE from a PIN station / by verkauf+fahrer; closing time for station logout; public shop order endpoint (rate limit, spam).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-06 | Wave 3 merged into `pilot` (`--no-ff`, in this order): Z4 (with B5b/Z9), F4, P2 (with P1/P3), Z6 (with Z5/Z7). Conflicts: `admin/layout.tsx` breadcrumb map (Grundmengen + Vorbestellungen labels), `roles.ts` (both lanes added the `except` route rule - one definition kept; verkauf reads Backzettel without Grundmengen, fahrer reads Vorbestellungen without `/neu`), `roles.spec.ts` (fahrer start Abholliste + backstube start `/backstube`; nav lists combined), `admin/backzettel/page.tsx` (Z5's overview replaces Z4's redirect), `CLAUDE.md` (F2/F1 paragraphs merged, Z4 + Z5/Z7 + Z6 sections all kept). Integration fix: the Z5 overview links "Grundmengen" for roles allowed to open it (+ spec). No dependency changes. Green: type-check, API typecheck, API jest 90/2100, management 77/726, bundle, boot smoke, deploy tests 157, lint 9 projects, management E2E 28/14 skipped, cross-feature smoke 40/40. Owner decisions open: fahrer read-only on Vorbestellungen (P1/P3) and undoing a handover (needs an API role change); long idle only for `backstube` accounts at the tablet (an owner baking by PIN as inhaber keeps 10 min); PIN sessions may edit Grundmengen; reading a confirmed day records deltas every 60 s from the tablet (move to the preorder write path?). Follow-ups: `yaml` ^2 into root `dependencies` (lockfile), login limit counts parallel successful logins, settings outside pilot mode still call `/api/notifications`, bulk Abholliste actions are one request per order, `install.sh` write-clone step untested on the box.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-06 | Wave 4a merged into `pilot` (`--no-ff`, in this order): W4 hardening (`feat/W4-hardening`, the wave-3 follow-ups: bulk-status, `not_collected_too_early`, pickup-point limits + `stale`, Backliste on `/sums`, Backzettel deltas in the preorder write path with background catch-up and a `deltasPending` notice, login limit counts only failures and frees aborted waiters, notifications 404/501 outside pilot mode, Backstube idle, `yaml` ^2 root dependency), P6 onboarding (`feat/P6-onboarding`, `/admin/hilfe`, paper forms, `docs/onboarding.md`). No conflicts; `npm install` once for `yaml` (resolves 2.8.1). No integration fixes needed. Green: type-check, API typecheck, API jest 91/2128, management 81/799, bundle, boot smoke, deploy tests 157, lint 9 projects, management E2E 30/14 skipped. hq: `feat/H3-pipeline-fixes` (on H1) and `feat/H5-docs` (on H2) committed, unpushed. Owner decisions open: 12 h idle for an inhaber PIN session on `/backstube` (kept, but leaving `/backstube` after > 10 min idle now logs out); fahrer read-only on Vorbestellungen; PIN sessions may edit Grundmengen. Follow-ups: login rate-limit test flaked once under full-suite load (not reproduced, assertion now reports status + code); Mörsbach screen could use bulk-status instead of the alias; P6 low findings (Notfallblatt without units, slip says „Anmerkung“ vs. form „Notiz“, Fahrer sheet ticks a printed „bezahlt“ text, Verkauf script order of „Übergabe zurücknehmen“/„Auf „Offen“ zurück“, print selection relies on `afterprint` (iPad untested), Backstube sheet points to a menu `/backstube` lacks); hq: H3 suites not in `validate.yml`, template hints should be YAML comments, recovery how-to for a failed conversion, register groups (Speisen, Zeitungen, Pfand, Kuchen/Torten Stücke) still fall into Sonstiges, Z9 pathspec should narrow to `data/production/{backzettel,vorbestellungen}`, website `reports.core.js` has no category breakdown for `group_name` yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-06 | W4 verification round 1 (`fix/W4-verify-r1`, merged `--no-ff` into `pilot`): 38 findings (4 high, 8 medium, 26 low; several overlap across testers), 37 fixed in 17 commits, 0 rejected, 1 deferred (Sunday „Vorbereitung heute“ shows Monday's prep - waits for Q-B2). Highlights: Backschrank Abholung no longer re-books the template, reload keeps the unattended-tablet logout, Abholliste errors at the tap point and lost-response detection, Nachträge carry unit/bake count/Teig+Füllung (screen + print), Backzettel planning window 7 back/90 ahead, template/partner/preorder/hq-product input limits, 4.5:1 chips, 44 px touch targets, German 404/DataGrid/analytics. Additive contract fields: `deltas[].bake`, `deltaExtras`, `summary.handedOverUnpaid[Total]`; new 400s `date_out_of_range`, `ruhetag`, `TEXT_TOO_LONG`, `INVALID_BUSINESS_DATE`. Checks on `pilot`: type-check, API typecheck, API jest 2150, management jest 832, bundle + boot-smoke green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-06 | W4 verification round 2 (`fix/W4-verify-r2`, merged `--no-ff` into `pilot`): 35 findings (13 medium, 22 low), 35 fixed in 25 commits, 0 rejected, 0 deferred. Highlights: a negative correction larger than the line is 400 `correction_exceeds_line` (the core flags `correctionClamped` instead of silently capping), Backschrank over-count is `discrepancyQty` not Retoure and mixed prices show as a range (CSV gets `Abweichung`), preorders keep `paidAmount` with `paymentBalance` (top-up/refund on screen and in the day summary) and the fahrer cannot undo a payment (403 `paid_undo_forbidden`), re-confirm shows `previouslyDone` ("bereits 30 erledigt - noch +10"), Nachträge name extra Chargen and the scaled filling recipe (incomplete recipes are not scaled), confirmed Saturday prints on 3 pages, API `Cache-Control: no-store`, no Google Fonts, `?next=` checked by `isSafeInternalPath`, lost handovers survive the session end, `login_failed` stores no unknown username, one control-char rule (`control-chars.core.js`) for users and partners too, `visitAt` must sit on the business day, finance/Tagesziel hidden at PIN stations, prep `variant_labels`, 44 px inputs/switches on touch. Migration `20261114000000-preorders-paid-amount`. Checks on `pilot`: type-check, API typecheck, API jest 2161 (one stations test timed out once under full-suite load, green on rerun), management jest 868, bundle + boot-smoke green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-06 | W4 verification round 3 (`fix/W4-verify-r3`, merged `--no-ff` into `pilot`): 28 findings (3 high, 7 medium, 18 low; several overlap across testers), 28 fixed in 16 fix commits + 2 doc commits, 0 rejected, 0 deferred. Highlights: refunds and rests are visible where the money changes hands - Abholliste chips „Rest X offen“ / „Erstattung X offen“ (also on cancelled paid orders), no one-tap handover unless fully paid, dialog with „Erstattet und übergeben“, „Erstattet“ per row, tile „Zu erstatten“, print group „Storniert - Geld zurückgeben“ and „☐ Rest X“ / „☐ X zurück“, `PaymentNote` in the lists, Sammelstelle/Backliste name `handedOverUnpaidTotal`; several unclear offline taps are tracked and resolved per order, the toast no longer covers the last buttons; fahrer cannot undo a handover (403 `handover_undo_forbidden`, status, bulk and Mörsbach alias); `?q=` is a case-insensitive `GLOB` (umlauts fold, `%`/`_` literal); control/bidi chars rejected in station names, pickup points and Backzettel reasons (rule now also covers BOM, U+2028/U+2029); tray text follows the line total („4 Bleche à 12 (Bleche 1, 2 + 2 weitere)“); re-confirm keeps the tick of a line that got smaller; Nachträge say „weniger abwiegen“ and „±0 · nichts ändern“; MUI `deDE`, German breadcrumbs for Analysen/report days, „Ansehen“ instead of „Planen“, Grundmengen messages, PIN key and quick buttons fit, Sammelstelle as cards on the phone, „…“ quotes in the management UI. No migration. Checks on `pilot`: type-check, API typecheck, API jest 2174 (the preorders suite hit one socket `ETIMEDOUT` under full-suite load once, green on rerun), management jest 887, bundle + boot-smoke green; Playwright smoke 60/60 at 390/820/1440 light+dark. Follow-ups: API error messages still use „…" quotes; the Mörsbach detail page cannot record a refund on a cancelled order for the fahrer (by design, hint shown); husky hook missing in worktrees.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-11-06 | W4 verification round 4 (`fix/W4-verify-r4`, merged `--no-ff` into `pilot`): 35 findings from 6 personas (4 high, 11 medium, 20 low), 32 fixed in 24 commits, 0 rejected, 3 deferred. Backzettel: no silent overwrites between tablet and PC - tick carries `expectedTotal` (409 `line_changed`), correction `expected` (409 `correction_changed`, input kept), season `expectedFactor` (409 `season_changed`), stale 404 reloads; Nachträge grouped per line with bulk `POST /:date/deltas/ack` („Alle gesehen“); quarters pooled over Basis+Saison+Vorbestellt+CAP before rounding up (`quartersPooled`); unmapped products named, not slugged; Hefeteig/Füllung Nachtrag amounts big on the tablet; Nachträge print repeats its heading, Kurzanleitung without fixed page numbers; Notfallblatt repeats the section name per column. Auth: a lost refresh answer (10 s-15 min, successor unused) reissues instead of ending the session (trade-off: a stolen predecessor is caught only after 15 min). Preorders: idempotent create via `requestId` (migration `20261116000000-preorders-request-id`), per-user draft in sessionStorage, German offline text instead of „Failed to fetch“, station names lost handovers and returns to the page after the PIN; „Übergabe zurücknehmen“ restores the payment from before the handover (audit `payment.before/after`; Mörsbach alias keeps the mock contract); edit conflict says „NICHT gespeichert“ and lists the typed input; „Zahlung NICHT erfasst“ shown once on top + toast; deactivated pickup point with bookings stays in `/day` and the Abholliste („(inaktiv)“), saving warns with count and days; Sammelstelle tile „Warten noch“. Print: Abholliste `table-layout: fixed` with a 186 mm column budget (Unterschrift on the sheet), day overview fixed columns (Sa 13 → 6 pages) and refund no longer struck through. Numbers: „Schwache Produkte“ by pieces (`bottomProducts`), tile „Umsatzstärkstes Produkt“; Tagesziel ratio to 6 places and never „100 %“ below target; Backschrank open-day text matches the tiles, weekday averages over closed days only. A11y/text: light-mode text/outlined buttons in `primary.dark`, „–“ placeholder not `text.disabled`, partner link 44 px; U+061C and invisible format/filler chars refused (ZWJ kept for emoji). Deferred (owner): #9 late Backschrank visit priced at today's hq price - keep a price history per product or ask the price when entering a past day?; #19/#25 several pickup points on one Saturday - which point should the fahrer open by default (last used on the device, a per-fahrer setting, or always choose) and should „Sammelstelle Mörsbach“ in nav/breadcrumb become generic? Checks on `pilot`: type-check, API typecheck, API jest 2202 (legacy `orderAPI.test.js` failed once under full-suite load in the worktree, green alone and on `pilot`), management jest 911, bundle + boot-smoke, deploy tests 157/157; Playwright smoke at 390/820/1440 light+dark without horizontal scroll, print at 703 px: Abholliste 702 px, Tag 703 px, Sa day print 6 pages, no page errors. |
| 2026-11-06 | W4 verification round 5 (`fix/W4-verify-r5`, merged `--no-ff` into `pilot`): 20 findings from 6 personas (5 high, 6 medium, 9 low; #1/#4/#9 are the same defect), 20 fixed in 17 commits, 0 rejected, 0 deferred. Preorders: a retry with the same `requestId` but a changed body is 409 `request_id_changed` (with the earlier order's code, name and items) instead of 200 with the old order - the form offers „Änderungen in <Code> übernehmen“ (PATCH with its `updatedAt`) or „Als neue Vorbestellung speichern“; `ApiError.details` carries the error body; the restore banner says an unanswered save may have arrived; drafts are kept per user (`bakery-management-preorder-draft:<id>`, legacy key read once); catalogue/points load retries every 15 s and on `online`, with „Erneut laden“. Box: `bakery-management.service` runs `next start --hostname localhost` with `node --dns-result-order=ipv4first` - with `127.0.0.1` Next 16 treated its own session-check rewrite as an external proxy and answered 500 „Internal Server Error“ (deploy tests check the unit). Auth: a lost-answer reissue revokes the unused successor and links the presented row to the new one, so replaying an old token is reuse again (no ping-pong between two devices). Abholliste: a stale handover names „STORNIERT - nicht übergeben, Geld zurückgeben“ or the new amount and the difference to collect; failed handovers stay listed one per order; print merges Code/Name into one 34 mm column (Artikel ~59 mm, word wrap with `hyphens`, Sa Laden 38 orders 6 pages instead of 10) and marks an inactive point „(inaktiv)“. Backschrank: Abverkaufs-/Retourenquote over days with pickup only, open days' stock as `openQty` (tile „Offen (ohne Abholung)“, CSV column „Offen“). Backzettel: tablet Nachträge panel shows the bake amount big (`bakeOpen`, quarters as a note); deltas `removed`/`moved` instead of „storniert“, moved orders as „CODE (jetzt Di 10.11.)“; print groups Nachträge per line with the bake amount and one tick box; ENTWURF also on the Vorbereitung page; Notfallblatt `<colgroup>` keeps Posten names readable. Day overview: „Bestellweg: …“ apart from „Abholung: Laden: N · <Stelle>: n“, inactive points marked. Kurzanleitung Verkauf: every Sammelstelle has its own code prefix. Control chars: `\p{Cf}` + `Default_Ignorable_Code_Point` + U+FFFC instead of a list (ZWJ and U+FE0E/FE0F kept), more than 4 stacked combining marks refused. Checks on `pilot`: type-check, API typecheck, API jest 2217 (legacy `securityIntegration.test.js` hit one `ETIMEDOUT` under full-suite load, green alone and in the worktree), management jest 931, shared-data-access 89, bundle + boot-smoke, deploy tests 159/159, lint 0 errors; Playwright smoke at 390/820/1440 light+dark on 8 changed screens without horizontal scroll or page errors, open-day partner report, PDF Backzettel draft page 3 with ENTWURF.                                                                                                                                                              |
| 2026-11-06 | W4 verification round 6 (`fix/W4-verify-r6`, merged `--no-ff` into `pilot`): 17 findings from 6 personas (2 high, 10 medium, 5 low; #7/#16 are the same defect). 17 fixed in 14 fix commits plus 1 spec-typing commit, 0 rejected, 0 deferred. Abholliste: a handover refused with 409 `stale_preorder` reloads once and retries when only the status moved `offen`↔`bereit` and the amount, payment, day, place and items are unchanged (`handoverStillMatches`). Otherwise it says that the handover was NOT saved and that the money was NOT recorded, and keeps the warning. After reconnecting from offline, `lostActionText` names a cancelled order, a handover made somewhere else, or a new price. The toast is hidden while a dialog is open, and the handover dialog shows earlier failures for that order. Print keeps each group header with its first order (`tbody.keep`). Preorders: „Änderungen in <Code> übernehmen“ with „Bezahlt“ now also records the new total as paid. Edits survive the end of a session (per-user edit draft, the detail page reopens editing, the station returns to the order). A typed channel stays when a Sammelstelle is picked. Session: an expired token at start whose refresh fails on the network (502 or lost answer) keeps the session. Backzettel: a Nachtrag for an item with no frozen line gets its bake amount, dough and filling (`linesForDeltas`, `deltaTotals`) and brings its prep task (`prepWithDeltas`, „Neu durch einen Nachtrag“). The tray text adds „· mit Nachträgen: …“. Print shows fully seen Nachträge with a ✓ and partly seen ones with only the open part („noch offen - von +16, 10 schon gesehen“). The Grundmengen reference converts PLU sales by the Backzettel factor when every PLU maps (`converted`, no „St.“). Notfallblatt and Kurzanleitung print their right border in full (1pt inset). Cheat sheets cover collecting the rest and refunds at the handover. Control chars: ZWJ is allowed only between emoji, and stacked marks count across ZWJ and selectors. No migration. Checks on `pilot`: type-check, API typecheck, API jest 2224 (92 suites, 6 skipped), management jest 945 (87 suites), bundle + boot-smoke, deploy tests 159/159, lint 0 errors. Playwright smoke on 7 changed screens at 390/820/1440 light+dark: no horizontal scroll and no page errors. Live: the handover succeeds after another device set „bereit“, the edit draft is restored after reload, the Grundmengen reference shows 90 hints, the Sa Laden Abholliste has 15 kept groups on 6 pages, and the acknowledged Nachtrag prints with a ✓. In the Notfallblatt PDF, the right-border rows went from 20 to 631.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-06 | Branch `next` holds post-pilot work (B8, Rest am Abend, B12) — merge after the freeze. B12 (`feat/B12-cutover-cleanup`, merged `--no-ff` into `next` as `36258621`): `simple-server.js`, the legacy root JS layer, `libs/api/*`, 15 unused management feature libs and the demo pages deleted (old bookmarks redirect via `OLD_PAGE_REDIRECTS`, other deleted routes are 404); parity suites became contract tests against recorded mock answers (pinned clocks, `contract-later` reruns them in 2028); `PUBLIC_CATALOGUE` for the shop; shop and driver-app E2E on the real API. Checks on `next`: type-check, API jest 1,884, management 967, all E2E green; `contexts` still 34 red (known).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-06 | Abschluss-Verifikation next (`fix/next-verify`, merged `--no-ff` into `next` as `0a393014`): 23 findings from 5 personas (3 high, 11 medium, 9 low; L13/M14/L23 are the same defect). 21 fixed in 8 commits, 0 rejected, 2 deferred. Sammelstelle: the driver app's handover list shows paid/rest/refund per order (`paidAmount`, `paymentBalance` on the alias) and no longer collects prepaid orders twice; a handover sets `paid` only for unpaid orders; `flushQueue` no longer loses a tick queued during a flush; taps carry their own `completedAt` (tour day −1…+3); the inhaber assigns drivers, sorts stops and deletes tours; offline copies are cleared at the login form; stop input checked (quantity, `driverId`, tour date, bidi in `failureReason`). Rest am Abend: `rest_counts.line_rows` keeps the count rows of the day (a later YAML product no longer turns old days "partial"); miscounts flagged on the unit tile and CSV and excluded from Rest Ø; German errors, conflict value at the line and in the save bar, "Meine Zahlen speichern", other-day drafts listed, logout warns. Notifications load only with a session (no 401 console error, no permission prompt). Shop: no "Danke" for an unverifiable code, unavailable items leave the total and block checkout, 44-px touch targets. Deferred: M5 service worker for the driver app (needs the HTTPS/hosting decision, Q8) and L15 unknown `/admin` URLs (owner: 404 for every role, revealing which routes exist, or keep "Kein Zugriff"?). Checks on the merge: type-check, API jest 1,897, management 979, delivery 116, bundle, boot-smoke, deploy tests 159 ok.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
