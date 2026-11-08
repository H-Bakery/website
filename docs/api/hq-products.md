# hq products (B5), write-back (B5b) and snapshots (Z9)

## hq products (B5)

Products are the markdown files in `hq/products` (D9), served with the former mock's contract (D3).
Code in `apps/bakery-api/src/`: rules in `services/hq-products.core.js` (dependency-free; field
rules, slug, next `numeric_id`, commit message), validation in `product-input.core.js`,
serialisation in `product-file.core.js` (`serializeProductFile` - key order and quoting,
**zero-diff round trip**), cache in `services/hq-catalogue.ts`, file I/O + git in
`services/hq-products.service.ts`, routes in `routes/hq-products.routes.ts`.

| Endpoint                           | Who       | Answer                                                                                                                |
| ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET /api/products[?category=]`    | session\* | `{ success, data: HQProduct[], count }` - approved version only                                                       |
| `GET /api/hq-products[?category=]` | session   | same envelope, **write-worktree version** (incl. new products); pending ones carry `approved`                         |
| `GET /api/hq-products/:id`         | session   | `{ success, data }`; write-worktree version, else read clone; pending ones carry `approved`; 404 `not_found`          |
| `PUT /api/hq-products/:id`         | `inhaber` | `{ success, data, pending }`; 400 `validation` / `invalid_product_file`, 404, 500 `hq_commit_failed`, 503 (see below) |
| `POST /api/hq-products`            | `inhaber` | 201 `{ success, data, pending }`; 400 `validation` / `invalid_id` / `invalid_product_file`, 409 `product_exists`, 503 |

503 codes: `hq_unavailable` (no read dir, development), `hq_write_unavailable` (write dir missing,
not a git repo, or production without `HQ_WRITE_DIR`), `hq_write_wrong_branch` (worktree not on
`HQ_WRITE_BRANCH`, default `app/edits`; also a detached HEAD). `?category=` given twice (an
array) matches nothing, as in the mock.

\* With `PUBLIC_CATALOGUE=1` (B12) `GET /api/products` is mounted above the session guard and
answers without a session - the customer shop reads it from the browser. Off by default; see
[overview.md](overview.md#app-srcappts).

`HQProduct` = the mock's `loadHQProducts()` shape (`id, numeric_id, name, category, price, available,
seasonal, image, short_description, allergens, allergens_source, allergen_recipe, description`)
**plus `pendingApproval`**. Write answers are the mock's (`frontmatter + description`) plus
`data.pendingApproval` and top-level `pending`. **No DELETE** (deleting a product = deleting a file
in hq). The management view (`/api/hq-products[/:id]`) additionally carries **`rawDescription`**:
the body without its heading and **without** the `short_description` fallback that `description`
has for the shop (`managedFields()` in `hq-products.core.js`). The edit form must send that back,
or an unchanged save of a file without description writes the teaser into its body.
`stripHeading()` also empties a body that is only the heading (POST without description answers
`description: ''`, as the mock did; contract-tested).

- **Two write modes.** `HQ_WRITE_DIR` set (the box): the file goes to
  `${HQ_WRITE_DIR}/products` (worktree on `app/edits`), then `git add` + `git commit -- <file>`
  there, author and committer `Verwaltung (App) <verwaltung@bakery.local>`, message
  `products: <Name> (<id>) geändert|angelegt` + `Co-authored-by: <displayName> <user-<id>@bakery.local>`
  (the user **id**, never the login - these commits reach GitHub, and D13 keeps logins out of hq;
  no display name → `unbekannt`). git runs through `execFile` with argument arrays, never a shell
  string. Only the product path is committed - whatever else sits in the index stays. Push + PR:
  see "Write-back" below. `HQ_WRITE_DIR` unset (development): written straight into
  `HQ_PRODUCTS_DIR`, no git, as the mock did. The read clone is never written when `HQ_WRITE_DIR` is
  set.
- **"wartet auf Freigabe"**: `pendingApproval: true` when the product's file in the write worktree
  differs byte-wise from the approved version (or exists only there). Approved = `origin/main` of
  the write clone (see "pendingApproval against `origin/main`"), falling back to the read clone.
  **Two views, deliberately:** `/api/products` (shop, and `getCatalogue()`) serves the
  **approved** version with the flag; `/api/hq-products[/:id]` (management) serves the
  **write-worktree** version - the one a PUT builds on - plus `approved` (approved product, `null`
  for a new one) when pending. Do not point the management GETs back at the approved version: the
  edit form sends every field, so its second save would write the approved values over the pending
  edit (lost update; regression test "saving the full edit form of a pending product keeps the
  pending edit").
- **Branch guard**: before writing, `git rev-parse --abbrev-ref HEAD` in `HQ_WRITE_DIR` must equal
  `HQ_WRITE_BRANCH` (default `app/edits`), else 503 `hq_write_wrong_branch` and nothing is written.
- **Round-trip check**: `serializeProductFile` quotes everything YAML 1.1 would read as something
  else (leading quote/`?`/`:`, trailing `:`, numbers in hex/octal/binary/exponent/`_`/sexagesimal
  form, `.inf`/`.nan`, dates, `y`/`n`/`null`, control characters). In addition the service parses
  the finished file with gray-matter and compares it with the intended frontmatter + body
  (`roundTripsAs` in `hq-products.core.js`); a mismatch is 400 `invalid_product_file` and nothing
  is written. Without this a name like `Brot:` was committed as an unparseable file, vanished from
  every list and would have blocked the rolling PR.
- **Limits before any write**, in `product-input.core.js` (`PRODUCT_LIMITS`):
  name ≤ 120 characters and free of C0/C1/bidi control characters (a NUL broke the git commit, a
  5000-character name the file name → `ENAMETOOLONG`), price 0…10000 € with at most two decimals,
  `short_description`/`image` ≤ 500, body ≤ 20000 (newline/tab allowed, other control characters
  not). All 400 `validation` with a German `message`.
- **No-op saves write and commit nothing** (identical bytes) - tested for every sample file with the
  body the edit form sends. A file that was dirty on disk and is saved back to the committed state
  is also a no-op (nothing staged → no commit, 200). A failed commit (e.g. a rejecting pre-commit
  hook) restores the file (or removes a new one), unstages it and answers 500. Writes are
  serialised in-process (read-modify-write + git index).
- **Catalogue for other domains** (partners, preorders): `getCatalogue()` /
  `getProduct(slug | numeric_id)` from `hq-catalogue.ts` - read clone only (approved prices for
  snapshots), frozen objects, one cache per directory, re-read when the directory mtime changes
  (git re-creates files on checkout/reset) or after 60 s (`CATALOGUE_TTL_MS`; an in-place edit does
  not touch the directory mtime), and invalidated by our own writes. Missing directory: empty
  catalogue, logged once (`HQ products directory not found`), writes 503. Never read product files
  directly from another domain.
- **Configuration** (`loadHqConfig()` in `config/env.ts`, called by `startServer()` before the
  database is opened): read dir = `HQ_PRODUCTS_DIR`, else `${HQ_DIR}/products`, else (development
  only) `<website>/../hq/products` (found via `nx.json` from cwd; `defaultProductsDir()` uses the
  same order, as the Backzettel loader does). **Production refuses to start** without an absolute
  read dir and an absolute `HQ_WRITE_DIR` - otherwise edits would go into the read clone, which
  `deploy/scripts/hq-sync.sh` resets every 10 minutes, after a 200. In every environment
  `HQ_WRITE_DIR` must not be inside or around the read clone (`HQ_DIR`, in production also the
  parent of the products dir). The service additionally answers 503 to writes when
  `NODE_ENV=production` and no write dir is set. The server logs both directories at start.
  `createApp({ hqProducts: { productsDir, writeDir, writeBranch, production } })` overrides them
  (tests).

Tests: `tests/unit/hqProductsCore.test.js`, `tests/unit/hqCatalogue.test.ts`,
`tests/unit/productFileSerializer.test.js`, `tests/unit/productInputValidation.test.js`,
`tests/integration/hqProducts.test.ts` (temp copies of `tools/e2e/hq-products`, a temp git repo as
`HQ_WRITE_DIR`; also `PUBLIC_CATALOGUE`), `tests/contract/hqProducts.contract.test.ts` (same
answers **and the same bytes on disk** as the recorded mock for GET/PUT/POST).

## Write-back (B5b) and snapshots (Z9)

Roadmap D6, D13, D14, §4a. All git goes through `src/services/hq-git.ts`:

| File                                                    | What                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `services/hq-git.ts`                                    | `runHqGit`, error codes, the two locks, `readBlobs` (below)                                      |
| `services/hq-edits-sync.service.ts` (`HqEditsSync`)     | B5b: push `app/edits` + one rolling PR                                                           |
| `services/hq-snapshots.service.ts` (`HqSnapshotWriter`) | Z9: `data/production/**` to `main`                                                               |
| `services/github-pr.ts`                                 | find/open the PR via `fetch` (REST, `GITHUB_API_URL`)                                            |
| `services/hq-writeback.core.js`, `hq-snapshots.core.js` | pure rules: error classes, PR body, editors from trailers; snapshot whitelists + German Markdown |

**`hq-git.ts`:**

- `runHqGit(cwd, args, { token, timeoutMs })`: `execFile` with an argument array, timeout (60 s;
  network calls 120 s, `SIGKILL`), identity `Verwaltung (App) <verwaltung@bakery.local>` as author
  **and** committer. `HqGitError.code`: `git_missing`, `git_timeout`, `not_a_repo`, `network`,
  `push_rejected`, `rebase_conflict`, `repo_locked`, `git_failed` (classification in
  `hq-writeback.core.js`). The token goes in only as an env var read by a one-call credential helper
  (like `hq-sync.sh`), **never in args/URL/config**. Never writes into a non-repo.
- **Two locks** per **common git dir** (so the `app/edits` worktree and the `main` snapshot
  worktree share them), each an in-process FIFO queue plus a lock file against other processes
  (the CLI): `withRepoLock` (`bakery-app.lock`, wait 60 s) for worktree steps - commit, rebase,
  reset, cherry-pick, fast-forward - seconds only, what a product save waits for; `withNetworkLock`
  (`bakery-app-net.lock`, wait 9 min > worst network job) for fetch, push and
  `update-ref refs/remotes/*` (two fetches at once fail on the ref lock). **Never do network I/O
  under the local lock**, and never take the network lock inside the local one (a network job may
  take the local lock inside - no deadlock). A stale lock (pid dead or > 10 min) is taken over via
  a `<lock>.takeover` guard that re-reads the file, so two waiters cannot both delete it.

**B5b flow** (`HqEditsSync.sync()`, after every product/Grundmengen commit via `afterCommit`, every
`HQ_SYNC_RETRY_MS` = 15 min via an unref'd timer, and `POST /api/hq-sync/retry`; concurrent calls
coalesce into one rerun; never rejects - failures go to `lastError`). fetch and push run under the
network lock; steps 2-5 under the local lock (the products service takes that lock for its write +
commit, so a rebase never meets a half commit, and a save never waits for GitHub); the GitHub API
with no lock held:

1. branch must be `app/edits` (`wrong_branch`); `fetch --prune origin main` + `app/*` (a glob, so a
   missing remote `app/edits` is no error); re-read the approved files from `origin/main`.
2. tracked changes in the worktree → `worktree_dirty`, stop.
3. nothing of ours above `origin/main` → `merge --ff-only` (the PR was merged; `mergedSince` set,
   `prUrl` cleared). **Squash merge, by content** (`mergedPrefix`, only when main moved past our
   fork point): the newest of our commits C such that every file changed between the fork point
   and C has the same content in C and on `origin/main` - commits up to C are merged. All of them
   → `reset --keep origin/main`; some → `rebase --onto origin/main C` replays only the newer ones.
   This works when main moved on with other paths (the daily reports) and when one product was
   edited twice in the PR (a whole-tree compare would not, and a plain rebase would conflict
   forever).
4. else `rebase origin/main` (skipped when already on top). Conflict → `conflictedFiles`,
   `rebase --abort`, `lastError { code: 'rebase_conflict', files }`; local commits stay, nothing is
   pushed.
5. **Foreign commits on `origin/app/edits`** (someone fixed the PR by hand: non-merge commits not
   on main, not committed as the app, not patch-equal to ours) are cherry-picked onto HEAD, so the
   force-push keeps them; an already-applied pick is skipped. A conflicting pick rolls all picks
   back, `lastError { code: 'foreign_conflict', files }`, **nothing is pushed** (never overwrites
   a person's commit). Merge commits ("Update branch", resolutions in the GitHub UI) are not
   adopted - main is rebased in anyway; a conflict resolved in a GitHub merge commit is lost.
6. `push --force-with-lease=refs/heads/app/edits:<remote value just fetched, '' = must not exist>
origin <sha>:refs/heads/app/edits` - the sha prepared under the local lock; a save committed
   meanwhile goes with the next run. Rejected lease → fetch, prepare again, push once more.
7. `ensurePullRequest`: `GET /repos/{repo}/pulls?state=open&head={owner}:app/edits&base=main`,
   `POST` only if none (a 422 "already exists" race looks again). Title "Stammdaten aus der
   Verwaltung", German body with the changed files and the editors' **names** from the
   `Co-authored-by` trailers (no mail). The body is written at opening only. Called after every
   push and while `prUrl` is unknown (`github_failed` keeps the push).

**Disabled** without `HQ_WRITE_DIR` or without a token (`HQ_GITHUB_TOKEN`, fallback
`GITHUB_TOKEN`): saves still commit locally, the status says why. `createApp()` without `hqSync`
builds disabled instances (tests stay hermetic); `server.ts` builds the real ones from
`loadHqSyncConfig()` (`HQ_GITHUB_REPO` default `H-Bakery/hq`, `GITHUB_API_URL`,
`HQ_SYNC_RETRY_MS` ≥ 1000), calls `edits.init()` (reads `origin/main` without fetching), starts both
timers after `listen` and stops them on close.

**pendingApproval against `origin/main`.** `HqProductsService` takes `approvedFiles()` (file name
→ raw content of `products/*.md` on `origin/main`, refreshed after every fetch) and compares the
write worktree with it; `approved` (the management view) is parsed from the same content. Before
the first read (no write dir, no `origin/main`) **and whenever the sync is disabled** (no token:
`origin/main` would go stale) it falls back to the read clone, which lags up to 10 min behind
`main`. Rebase/fast-forward call `onWorktreeChanged` → the products cache is invalidated.

**Status** `GET /api/hq-sync/status` (`inhaber`, any session kind) → `{ success, data: { enabled,
reason, branch, baseBranch, repo, pendingCommits (not on GitHub: neither on origin/app/edits nor
merged), unmergedCommits (waiting for approval), lastPushAt, lastAttemptAt, lastError { code,
message (German), detail (git stderr ≤ 500 chars), files?, at }, prUrl, mergedSince (first time
nothing waited; null while something waits), running, snapshots: { enabled, reason, branch,
pendingCommits, lastCommitAt, lastPushAt, lastAttemptAt, lastError } } }`. `POST /retry` runs both
syncs and answers the same. `lastError.code` adds `wrong_branch`, `worktree_dirty`,
`github_failed`, `write_failed`, `foreign_conflict` to the git codes.

**Z9 snapshots** (`HqSnapshotWriter`; `HQ_SNAPSHOT_DIR` = a second worktree of the write clone on
`main`; must not be inside/around the read clone or `HQ_WRITE_DIR`, absolute in production;
unset = off):

- **Backzettel:** the Backzettel service has hooks `createBackzettelService(source, { onConfirmed,
onReopened })` (router options of the same name); `onConfirmed` is called after the confirm
  transaction with the confirmed day view and `req.user.role`; `app.ts` wires it to
  `snapshots.backzettelConfirmed()`, which runs in the background (`idle()` for tests) - **a
  confirm never waits for or fails because of hq**. Writes `data/production/backzettel/<date>.json`
  (schema 1, `status: 'confirmed'`: sections/lines with base, seasonal, preorders, cap, correction,
  total, tray, plu; Hefeteig with weighing list; fillings with scaled recipe; prep; warnings
  `{code, message}`; `confirmed { at, role }`) and a German `.md`. **Reopen**
  (`onReopened(date, { role })` → `backzettelReopened()`) replaces both files with a note: JSON
  `{ status: 'reopened', date, reopened: { at, role } }` (no sections - the released version no
  longer holds), commit `chore(production): Backzettel <date> wieder geöffnet (App)`; the reopen
  reason (free text) stays out. The next confirm writes the full Backzettel again.
- **Vorbestellungen:** `cli.js snapshot-preorders [--date YYYY-MM-DD]` from
  `deploy/systemd/bakery-snapshot-preorders.{service,timer}` (22:15). Default date: today, Berlin.
  Never migrates; waits up to 5 min for the local lock and 9 min for the network lock if the server
  holds them; exit 0 whenever the file is written and committed (`outcome.written`) even if the push
  must wait (the server's 15-min timer pushes it); 1 on bad input / missing `HQ_SNAPSHOT_DIR` /
  nothing written. Uses `PreordersService.day()`; writes `data/production/vorbestellungen/<date>.json`
  with `preorderCount`, `items [{productId, variant, name, unit, quantity, preorders}]` (`variant`
  only if it is one of the product's variants in `backzettel.yaml` - a slug is free text; others
  are merged into `variant: null`), `channels` (all five, zeros included),
  `pickupPoints [{id, name, count}]` (`laden` first). Cancelled ones are not counted. **No
  timestamp**, so a rerun on unchanged data commits nothing.
- **Rest am Abend (M4):** after every count save with changes, `snapshots.restCounted(view)` writes
  `data/production/rest/<date>.json` in the background (`restSnapshot` in `hq-snapshots.core.js`:
  baked, cap, rest and counts per line - no user, no times), commit
  `chore(production): Rest am Abend <date> (App)`, same write path as the Backzettel. See
  [rest.md](rest.md).
- **No personal data (D13), by whitelist** in `hq-snapshots.core.js`: no confirmer/corrector/
  ticker names or ids (only the confirming role), no free-text correction reasons (they may name
  a customer), no deltas, preorder ids or codes, no customer names, phones, notes, no money, no
  unconfigured variant slugs; warnings that quote a raw slug (`variant_ignored`,
  `unknown_variant`, `unknown_correction`) get a fixed text with the item id only. A new field in
  the day view stays out until added there on purpose.
- git: write files atomically, `add -A -- data/production`, commit **with the pathspec
  `data/production`** (a foreign file staged in the worktree stays staged, uncommitted), message
  `chore(production): Backzettel <date> (App)` / `Vorbestellungen <date> (App)`, no
  `Co-authored-by` (no names). Write + commit under the local lock, then, released, the push under
  the network lock: `origin <sha>:refs/heads/main`; rejected → fetch, `rebase --autostash` onto
  `origin/main` (local lock) + one retry; conflict → `rebase --abort`, `rebase_conflict` with files,
  commit kept; offline or network lock busy (`network`, `repo_locked`) → commit kept, pushed by the
  15-min timer or `/retry`. `SnapshotOutcome.written` says the snapshot is on disk and committed
  regardless of the push.

Box: `deploy/scripts/install.sh` creates the write clone (`bakery.role=write-clone`, branch
`app/edits`) and `git worktree add $HQ_SNAPSHOT_DIR main`; runbook §6.1. Before the first snapshot
push, hq task H1 must be merged (the cash pipeline's push to `main` would otherwise commit without
a pathspec and be rejected once the app has pushed); H2 provides the auto-merge of the rolling PR.

Tests (all against temp **bare repos as origin**, `tests/helpers/hqRemote.ts`, and a local fake of
the GitHub pulls API, `startFakeGitHub` - never GitHub): `tests/unit/hqWritebackCore.test.js`,
`tests/unit/hqSnapshotsCore.test.js` (planted "personal" markers must not come out),
`tests/integration/hqGit.test.ts` (queue across worktrees, lock file across processes,
timeout/error codes, token never in args, stale takeover guard), `tests/integration/hqEditsSync.test.ts`
(push + one PR, merge and squash merge detected, pendingApproval vs. a stale read clone, rebase,
conflict, foreign commits, rejected lease → retry, offline + timer, GitHub 500, parallel saves, a
slow fetch does not block a save), `tests/integration/hqSnapshots.test.ts` (confirm → origin main,
pathspec, rejected push → rebase → retry, offline, parallel, no-op, conflict, wrong branch, reopen
note), `tests/integration/hqSnapshotsCli.test.ts` (CLI waiting for the server's locks).
