# CLAUDE.md

Bäckerei Heusser: Nx monorepo with the landing page, the management app (Verwaltung), shop,
Fahrer-App and the API. Pilot plan in `docs/roadmap.md`: management app + TypeScript API run on the
Bäckerei-Box in the shop's LAN; shop and Fahrer-App are not in the pilot.

## Rules that always apply

- **This repo is public.** Code, tests, fixtures, snapshots, screenshots and commit messages use
  synthetic data only - never real amounts, customer or staff names, phone numbers or IBANs.
  Real data lives in the private sibling repo `../hq`.
- **German** for every customer- and staff-facing text.
- **One API: the TypeScript API** in `apps/bakery-api/src`, for management, shop and Fahrer-App.
  The mock server `simple-server.js` and the old JS layer are deleted (B12) - don't reintroduce a
  mock or a second server; the old contract lives on only as recorded answers in the contract tests.
- **Every business formula exists exactly once**, in dependency-free CommonJS
  `apps/bakery-api/src/services/*.core.js`, shared by the API, the management app's loaders and
  the tests. Never write a second implementation.
- **No invented data.** Missing `hq` data is `status: 'no-data'` / `no-config` / "offen", never a
  sample value or a 0. A day without a report or a count is a gap, not zero.
- **API errors carry `message` (German) and `error` (code).** `ApiClient` shows `message`.
- **`hq` writes are round-trip safe**: a no-op save is a zero-line git diff; writes go through the
  `app/edits` worktree, never the read clone.
- Roles and route access live once in `apps/bakery-management/src/lib/roles.ts` (`ROLE_ACCESS`);
  pilot visibility once in `src/lib/pilotMode.ts`. The API enforces access; the UI only guides.
- Dark mode: text on `*.main` uses `*.contrastText`, never `'white'`; no `grey.*` backgrounds -
  use `action.hover` / `action.selected`.

## Where things are documented

- `docs/README.md` - index. Start there.
- `docs/development.md` - install, run, test, build, CI. Local full system: `setup-dev` skill.
- `docs/domains/*.md` - rules per domain (Backzettel, Vorbestellungen, Anmeldung, Verwaltung,
  Verkaufspartner, Kassenberichte, Finanzen, Produkte, Liefertouren, Rest am Abend, Rezepte). Read
  the one you touch before changing it.
- `docs/api/*.md` - API internals; `docs/apps/*.md` - landing, shop, Fahrer-App,
  Partybrezel-Prototyp;
  `docs/known-issues.md` - failures that aren't regressions.
- `docs/roadmap.md` - the only plan and task list; `docs/runbook.md` - box operation.
