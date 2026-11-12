---
name: setup-dev
description: Start (or stop) the whole bakery system locally for hands-on testing - real TypeScript API, management app (full and pilot mode), Fahrer-App and shop. Two modes - up.sh with synthetic seed data (fresh DB every start, any branch) and real.sh with the bakery's real hq data and a persistent DB for owner/staff testing, Backzettel/Grundmengen tuning and feedback rounds. Use when the user wants to run, try, click through or demo the system locally, test a branch in the browser, test with real data, review what testers changed, or stop/clean up the local servers.
---

# setup-dev: the bakery system locally, with test data

Everything runs from **committed code of one ref** in a separate worktree, never from the user's
checkout, so it works for any branch without touching what is checked out. All data is
**synthetic** (the website repo is public): a generated hq tree, invented customers and numbers.
The real `../hq` is never read or written.

## Start

```bash
.claude/skills/setup-dev/scripts/up.sh [<ref>] [--rebuild]     # from website/
```

- `<ref>` defaults to the branch checked out in the main repo. Use `next` for the post-pilot
  system (tours, Rest am Abend), `pilot` for go-live.
- The first run of a commit builds API bundle + management (full and pilot) + on `next` also
  Fahrer-App and shop: **10-15 min**, so run it in the background and tell the user. A commit
  that was already built starts in about a minute. `--rebuild` forces a build.
- `up.sh` stops a running instance first, then starts and seeds a fresh one (the DB is new on
  every start).
- Uncommitted changes are **not** included. For live editing use `nx serve` instead (see
  `docs/development.md`); this skill is for testing a finished state like staff would see it.

When it is up, give the user the addresses and logins that `up.sh` prints:

| App                                                | URL                               |
| -------------------------------------------------- | --------------------------------- |
| Management, full (everything, incl. Rest am Abend) | http://localhost:4201/admin/login |
| Management, pilot mode (what staff see at go-live) | http://localhost:4202/admin/login |
| Fahrer-App (only on `next`)                        | http://localhost:4300             |
| Shop (only on `next`)                              | http://localhost:4200             |
| API                                                | http://127.0.0.1:5100/health      |

| Role                   | User               | Password                | PIN  |
| ---------------------- | ------------------ | ----------------------- | ---- |
| Inhaber                | `verify.inhaber`   | `Verify-Inhaber-2026`   | 1357 |
| Verkauf                | `verify.verkauf`   | `Verify-Verkauf-2026`   | 2468 |
| Backstube              | `verify.backstube` | `Verify-Backstube-2026` | 0420 |
| Backstubenleitung      | `verify.leitung`   | `Verify-Leitung-2026`   | 4682 |
| Fahrer (Mörsbach tour) | `verify.fahrer`    | `Verify-Fahrer-2026`    | 9753 |
| Fahrer 2               | `verify.fahrer2`   | `Verify-Fahrer2-2026`   | 8531 |

Worth telling the user:

- PIN login needs a set-up station: log in as inhaber with the password, open `/station`, set
  the browser up as a tablet; then name tiles + PIN work.
- Address search and routing (Nominatim/OSRM) are switched off on purpose - distances show
  "(geschätzt)".
- Product, Grundmengen and recipe edits go to a synthetic hq with a fake GitHub;
  `scripts/hq-merge.sh dev` simulates "the PR was merged".
- Recipes (`/admin/rezepte`): invented files in every hq format (`tools/e2e/hq-recipes`) plus the
  fillings the Backzettel uses (`fillings/test.md`: editable, not deletable). `verify.leitung` and
  `verify.inhaber` may write, `verify.backstube` reads. Deleting is switched on here
  (`HQ_RECIPES_ALLOW_DELETE=1`); on the box it stays off until hq's path guard allows it.
- `$STATE/dev/world.json` describes every seeded case (which preorder is paid, refunded,
  cancelled, which day has a Nachtrag, ...) - read it when the user asks "where can I see X".

Ports can be changed with `DEV_MGMT_PORT`, `DEV_PILOT_PORT`, `DEV_DELIVERY_PORT`,
`DEV_SHOP_PORT`, `DEV_API_PORT`. Port 5000 is left alone (macOS AirPlay).

## Real data (`real.sh`) - testing the real thing on this Mac

For the owner and staff trying the system with the bakery's **real** hq (products, recipes,
cash reports, finance, `config/backzettel.yaml`) and entering real preorders, counts and
Grundmengen. Instance `real`, same ports as above (each script stops the other instance).

```bash
.claude/skills/setup-dev/scripts/real.sh up [<ref>] [--rebuild] [--geo]   # default ref release/2026-11
.claude/skills/setup-dev/scripts/real.sh status | down | backup
.claude/skills/setup-dev/scripts/real.sh edits      # what testers changed in hq
.claude/skills/setup-dev/scripts/real.sh approve    # let the Backzettel use those changes now
.claude/skills/setup-dev/scripts/real.sh export     # edits -> branch app-test/edits-<date> in ../hq
.claude/skills/setup-dev/scripts/real.sh hq-pull [<hq-ref>]  # newer ../hq data into the local copy
```

- **Stays on this Mac.** hq is a local bare copy of `../hq` (branch `HQ_REF`, default
  `release/2026-11`, else `main`), made once; the app's "GitHub" is fake; nothing is pushed.
  `../hq` itself is only touched by `export` (adds a branch, never pushes).
- **The database persists** (`$STATE/real/db/bakery.db`) and is backed up on every `up` (last
  20 in `$STATE/real/backups/`). `reset --yes` starts over (backups are kept).
- **Login:** the first `up` creates the account `inhaber` with a random password and PIN in
  `$STATE/real/credentials.txt` (0600). Tell the user the path, not the password, unless they
  ask. Further accounts for testers: in the app under Benutzer (`/admin/users`).
- **Grundmengen/product edits** land on the local `app/edits` branch and show "Wartet auf
  Freigabe"; the Backzettel only uses them after `approve` (simulated merge). After a test
  round: `edits` to review, `export`, then open an hq PR from that branch - with the user's OK.
- **Real customer data** (names, phone numbers) lives only in this local DB - never copy it
  into the website repo, tests, screenshots or commit messages. Address search is off unless
  `--geo` (then tour addresses go to the public OSM servers).
- Cash reports and bank data are as of the hq copy. Newer data from `../hq` (a new cash day, an
  imported bank statement): `real.sh hq-pull [<hq-ref>]` merges that branch (default: the one
  checked out in `../hq`) into the local copy - DB and tester edits stay, no restart needed. A
  conflict with tester edits aborts without changing anything.

## Stop

```bash
.claude/skills/setup-dev/scripts/down.sh            # stop all servers
.claude/skills/setup-dev/scripts/down.sh --purge    # also delete builds, worktree and data
```

Only processes from the instance's own pid files are stopped - never `pkill`.

## Where things are

- State: `~/.cache/bakery-dev` (override `BAKERY_DEV_HOME`): `tree/` (worktree of the ref,
  `node_modules` symlinked to the main checkout), `dev/` (instance: `logs/`, `db/bakery.db`,
  `env.sh`, `world.json`, synthetic hq clones), `build-logs/`, `build.sha`.
- API CLI against the instance: `source ~/.cache/bakery-dev/dev/env.sh && (cd $W_INSTANCE &&
node ~/.cache/bakery-dev/tree/dist/apps/bakery-api/bundle/cli.js <command>)`.
- Lower-level scripts (used by `up.sh`, also for parallel test instances on other ports, e.g.
  by verification agents): `build.sh`, `start.sh <name> <mgmt> <second> <api> [--mode
pilot|full] [--second delivery|shop|landing|none] [--public-catalogue]`, `extra.sh`,
  `second.sh`, `stop.sh <name>`, `lib/check.cjs` (quick Playwright check of an instance).
- `MAKE_HQ_FLAGS=--samstag-ersatz start.sh …` (or `lib/make-hq.js <dir> [today] --samstag-ersatz`)
  adds the busy Saturday, the column `base.samstag_ersatz` and a `config/kalender.yaml` with one
  closed Saturday at least two weeks ahead: the Friday before it (`samstagErsatz` in
  `hq-info.json`) is a Samstags-Satz day - for the 3-sheet print check (Z14).
- `lib/make-hq.js <dir> [today] --busy-saturday` writes the synthetic hq with about 60 lines on
  the Saturday sheet - for the one-page print check of a full Saturday (`up.sh` does not pass it).

## When it fails

- Build failed: the tail of the log is printed; full logs in `~/.cache/bakery-dev/build-logs/`.
  Builds use webpack (`IS_WEBPACK_TEST=1`) because Turbopack refuses the symlinked
  `node_modules`. If the ref's `package-lock.json` differs from the checkout, `up.sh` warns -
  run `npm ci` in the main checkout on a matching branch first.
- "port N is in use": something else is listening; `lsof -nP -iTCP:N -sTCP:LISTEN`, then stop
  that or pick other ports via the env variables.
- Seed failed: `~/.cache/bakery-dev/dev/logs/seed.log`; API errors in `logs/api.log`.
- The worktree is missing or broken: `down.sh --purge`, then `up.sh` again.
