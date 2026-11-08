# Backzettel API (Z3) and Grundmengen (Z4)

`/api/backzettel` (`apps/bakery-api/src/routes/backzettel.routes.ts` →
`src/services/backzettel.service.ts`), mounted below the global guard. Answers `{ success, data }`,
errors via `sendError`. The day is computed only by `backzettel.core.js` (Z2, see
[../domains/backzettel.md](../domains/backzettel.md)); `src/services/backzettel-day.core.js`
(dependency-free) translates between stored rows and the core: input parsing, preorder snapshot,
delta reconciliation, frozen lines, `deltaBakeExtras`. Master data: `backzettel-source.ts`.

## Day endpoints (Z3)

| Endpoint                                         | Who                | Body / answer                                                                                                    |
| ------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /config`                                    | any session        | `{ status: ok \| no-config, source, config, errors, warnings, recipesMissing, catalogSize }` (+ Z4 fields below) |
| `GET /:date`                                     | any session        | day (below); `{ date, status: 'no-config', reasons }` without master data                                        |
| `GET /:date/prep`                                | any session        | `{ date, weekday, weekdayName, status, prepDate (d−1), prepDateProvisional, prep[] }`                            |
| `PUT /:date/season`                              | inhaber, backstube | `{ factor, expectedFactor? }` (0 < f ≤ 5, 2 decimals, `"1,2"` ok) → day; draft only                              |
| `PUT /:date/lines/:itemId[/:variant]/correction` | inhaber, backstube | `{ correction, reason, expected? }`, reason required ≠ 0, 0 clears → day; draft only                             |
| `POST /:date/confirm`                            | inhaber, backstube | → confirmed day                                                                                                  |
| `POST /:date/reopen`                             | inhaber            | `{ reason? }` → draft day                                                                                        |
| `POST /:date/lines/:lineId/done` / `/undone`     | inhaber, backstube | `{ expectedTotal? }` → `{ id, date, itemId, variant, doneAt, doneBy }`; confirmed only                           |
| `POST /:date/deltas/:id/ack`                     | inhaber, backstube | → `{ id, …, acknowledgedAt, acknowledgedBy }`, idempotent                                                        |
| `POST /:date/deltas/ack`                         | inhaber, backstube | `{ ids: [...] }` (1-500), all or nothing                                                                         |

A correction `reason` or reopen `reason` with control characters is 400 `INVALID_TEXT`.

**Day** = `{ date, weekday, weekdayName, status: draft|confirmed, seasonFactor, confirmedBy {id,
displayName} | null, confirmedAt, sections[{ id, label, lines[] }], hefeteig, fillings, prep,
prepDate, prepDateProvisional, deltas[], deltaExtras, deltasPending, warnings[], configStatus,
configChangedSinceConfirm }` (`configChangedSinceConfirm` only on confirmed days: `true`/`false`,
`null` without valid master data). `prepDateProvisional` is `true` when d−1 is not a production
day (Tuesday after the Monday Ruhetag, Q-B2 open), `null` without master data. A line is the core
line plus `id` (row id, or null in a draft without a stored row), `correctionBy`, `doneAt`,
`doneBy`, `previouslyDone`, `delta { qty, open, count } | null`. `variant` is `null` for "none" in
JSON, `''` in the tables and in the URL (omit the segment).

**Errors:** 400 `invalid_date` / `validation` / `reason_required` / `date_out_of_range`, 404
`unknown_item` / `unknown_variant` / `not_found`, 409 `ruhetag` (weekday not in `config.days`),
`no_config` (with `reasons`), `confirmed`, `not_confirmed`, `season_changed`,
`correction_changed`, `line_changed`.

**Planning window:** season, correction and confirm only for today − 7 … today + 90 days (Berlin,
`PLANNING_DAYS_BACK` / `PLANNING_DAYS_AHEAD` in `backzettel.service.ts`), otherwise 400
`date_out_of_range` - a URL typo (`9999-12-31`) would otherwise confirm a day and commit its
snapshot to hq `main`. Reads, reopen, ticks and acks are not limited. Tests pin the clock with
`createApp({ backzettel: { now: () => … } })`.

**Two devices at once.** Every write that a stale screen could make wrong carries the value that
screen showed, and the server refuses instead of overwriting:

- `PUT …/season` takes `expectedFactor`, `PUT …/correction` takes `expected: { correction, reason }`
  (what the editor opened on). A different stored value is 409 `season_changed` /
  `correction_changed` with `current` (`{ correction, reason, by }`) and a German message naming
  the value and who set it; a save identical to the stored value is a no-op, not a conflict.
- `POST …/lines/:lineId/done` takes `{ expectedTotal }`: if the line now asks for **more** (owner
  re-confirmed with a correction), 409 `line_changed` with `total`/`expectedTotal`; fewer is fine
  (same rule as `tickStillValid`). The `line_done` audit row stores `total`.
- `POST /:date/deltas/ack` acknowledges several Nachträge in one transaction - 404 `not_found` if
  one is gone (re-confirmed).
- The fields are optional (older clients, scripts); the management app always sends them. A 404
  `not_found` on a tick or ack means the day was re-confirmed - the tablet reloads.

### What to know before changing it

- **Config path:** `HQ_BACKZETTEL_CONFIG`, else `${HQ_DIR}/config/backzettel.yaml`, `HQ_DIR`
  default `<cwd>/../hq`; catalogue `HQ_PRODUCTS_DIR` else `${HQ_DIR}/products`; recipes relative to
  `HQ_DIR`. `createApp({ backzettel: { hqDir, configPath, productsDir, cacheMs } })` overrides; an
  explicit `hqDir` option beats the env for the derived paths. Cached until the YAML/products mtime
  changes, at most 60 s. Missing/invalid → `no-config`, **never** invented numbers. The answer never
  carries the server path except inside a loader read error message.
- **Draft is live:** nothing is stored by reading a draft. Season factor lives in `backzettel_days`,
  corrections in `backzettel_lines` rows (only `correction*` is read in a draft). Preorders =
  `preorders.pickup_date = date`, status ≠ `storniert`, mapped through `item.products[]` factors by
  the core; CAP = active `PartnerDeliveryTemplates` of active partners for the ISO weekday, into
  the `cap` column (the baseline comment "upper limit" predates the plan). Quarters are pooled
  across all sources of a line before rounding up (`quartersPooled` / `subtotalExact` in the core).
- **Confirm** (serialised transaction): recomputes, upserts every line with a name/section/unit
  snapshot, deletes rows no longer computed, stores `preorder_snapshot` (flat
  `{preorderId, productId, variant, qty}`) and `computed_snapshot`
  (`{ hefeteig, fillings, prep, warnings, unsetKeys, preordersExact }` exactly as the core computed
  them; `unsetKeys` = line keys with `baseUnset`, which `frozenSections` restores so a confirmed
  line with an unset base still reads „offen", not 0), discards old deltas. Dough-day lines
  (draft and confirmed) carry `totalIsMinimum` (base open, no correction: `total` is only the
  known part - preorders, CAP); so do `bread` cells, `rolls` singles and Bruch `split` members. **Ticks** survive a
  re-confirm when the line's `base/seasonal/preorders/cap/total` are unchanged
  (`frozenQtyChanged`) or the new total is not larger (`tickStillValid`: baked 14, now 12 needed is
  done); otherwise `doneAt`/`doneBy` are cleared and listed as `clearedTicks` in the confirm audit
  row, and the open line carries `previouslyDone { qty, at, by }`. A draft after reopen already
  hides such stale ticks.
- **A confirmed day is served from what was stored**: lines from the rows, Hefeteig/fillings/prep/
  warnings from `computed_snapshot` - a later YAML or recipe change does not alter it (test).
  The current master data are only used for `configChangedSinceConfirm` (`snapshotDiffers`) and
  display-only fields (tray, PLU). With broken master data it stays fully readable
  (`configStatus: 'no-config'`). A day without `computed_snapshot` (confirmed before the column)
  falls back to recomputing from the frozen totals. Reopen clears the snapshot.
- **Deltas are recorded on the preorder write path**, not by reading. `app.ts` wires
  `preorders.service.onWrite(...)` to `backzettel.service.recordPreorderDeltas(dates, ctx)`: every
  preorder create, update (items, pickup date - old **and** new day -, status), status change,
  cancel and bulk status calls it **inside the preorder's own write transaction** with the touched
  pickup dates. For each date that is a confirmed Backzettel day, `reconcileDeltas` compares
  snapshot, current preorders and already recorded rows per preorder × item × variant and adds one
  row per change (`qty` = increment, `kind` added/changed/cancelled) - idempotent, so a no-op write
  or a second call records nothing. **Never merged into the frozen lines.** Audit `deltas_recorded`
  on `backzettel_day` with `data.via` = `preorder_create` / `preorder_update` / `preorder_status` /
  `preorder_cancel` / `preorder_bulk_status` and the writing user as `user_id`. A draft day records
  nothing. Per line, `delta.bake` = `roundUp(exact + delta) − roundUp(exact)` (`deltaBakeExtras`,
  `exact` from `computed_snapshot.preordersExact`; older confirmations use the rounded quantity -
  rather one unit too many than too few); `deltaExtras` on the day says what Hefeteig and fillings
  need additionally.
- **Reads write nothing.** `GET /:date` and `GET /prep` write nothing within the request; the
  confirmed view carries `deltasPending` (`true` = the current preorders differ from snapshot +
  recorded deltas; `null` without valid master data). When a read sees `true`, it starts a
  **background catch-up** for that date (`scheduleCatchUp`: `setImmediate`, own serialised
  transaction, audit `via: 'reconcile'`, user null, one run per date at a time; `service.idle()` /
  `app.locals.backzettelIdle()` for tests) - so a preorder written while the master data were
  broken, or by the CLI import, shows up with the tablet's next reload.
- **Reconciliation for writes without master data.** If `backzettel.yaml` is missing or invalid
  while a preorder changes, the hook cannot compute and records nothing (warned once per day and
  process; the preorder write still succeeds). `reconcileConfirmedDays({ from? })` catches up every
  confirmed day from `from` (default: Berlin yesterday), each in its own transaction, audit
  `via: 'reconcile'` with `user_id` null. It runs **once at server start** (background, after
  `listen`, logged as `[INFO] Backzettel: Deltas nachgetragen für …`), **after every confirm and
  reopen**, implicitly with the next preorder write to that day, and after a read that finds
  `deltasPending: true`. Tests call it through `app.locals.reconcileBackzettelDeltas`.
  `createBackzettel(options)` returns `{ router, service }` for this wiring;
  `createBackzettelRouter()` stays for callers that only need the router.
- **Reopen** (inhaber only, station sessions included - owner decision open whether it should need
  `requirePersonalSession`): back to draft, both snapshots cleared, deltas deleted (the audit row
  keeps them), corrections and ticks stay (see Confirm for stale ticks). Confirm and reopen also
  trigger the hq snapshot writer (see [hq-products.md](hq-products.md), Z9).
- **Audit** (`audit_log`): `season`, `correction`, `confirm`, `reopen`, `deltas_recorded` on
  `backzettel_day`/date; `line_done`/`line_undone` on `backzettel_line`; `delta_ack` on
  `backzettel_delta`. No-op writes (same value, already ticked/acked) are not audited.
- Migration `20261112000000-backzettel-z3.js` (additive): `backzettel_days.preorder_snapshot`,
  `backzettel_days.computed_snapshot`, `backzettel_lines.name/section/unit`,
  `backzettel_deltas.kind/acknowledged_at/acknowledged_by`.

Tests: `tests/unit/backzettelDay.test.js`, `tests/unit/backzettelCore.test.js`,
`tests/unit/backzettelConfig.test.js`, `tests/integration/backzettel.test.ts` (synthetic hq written
to a temp dir from `tests/fixtures/backzettel.synthetic.js`; preorders inserted via the models or,
for the delta tests, written through `POST/PATCH /api/preorders`, cancel and bulk-status - create/
edit/move/cancel after confirm, parallel GETs record nothing, idempotent reconcile, broken config →
reconcile after repair).

## Dough-day sheets and bake list (Z10, slice S3)

Consumers (S5/S6): the management app renders a `sheetVersion: 2` day as the one-page dough-day print
(`DoughDayPrint.tsx`) and `GET /:date/bake-list` as the bake-list print (`BakeListPrint.tsx`); both
show the server's numbers as they are (`null` stays "–", nothing is summed in the app). Rules:
[`docs/domains/backzettel.md`](../domains/backzettel.md), „Tagesplanung und Druck".

Design: [../backzettel-v2.md](../backzettel-v2.md) §5. A day is now the **sheet of a dough day D**
(`core.computeDoughDay`): the lead-0 lines baked on D plus the lines whose dough is made on D for a
later bake day (Saturday: Sunday's and Tuesday's rolls). With today's hq file (no `lead`, no
`dough_days`) every line has `bakeDate === date` and the answer is the v1 day plus additive fields.

| Endpoint                                           | Who                | Change                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /config`                                      | any session        | + `open` and `working.open`: open master data `[{ path, code, message }]` (explicit `null`s, §3)                                                                                                                                                                                                                                              |
| `GET /:date`                                       | any session        | + `sheetVersion` (2; 1 = confirmed before Z10), `isDoughDay`, `bakeDates[{ date, weekday, weekdayName, label, lineCount }]`, `plan`, `doughs`, `machine`, `bread`, `rolls`, `openMasterData`; lines + `bakeDate`, `doughDate`, `lead`, `variantKind`, `variantLabel`, `bruch?`; deltas + `bakeDate`; confirmed + `deltaMachine`, `deltaBruch` |
| `GET /:date/bake-list`                             | any session        | **new**: `{ date, weekday, weekdayName, status: ok \| no-config \| ruhetag, sources[{ doughDate, status: draft \| confirmed, confirmedAt, lineCount }], sections, rolls, deltas, deltasPending, warnings }` - no dough figures                                                                                                                |
| `PUT /:date/lines/:itemId[/:variant]/correction`   | inhaber, backstube | + optional `bakeDate` (default `date`): must be a bake day of the sheet on which the item is made from this sheet's dough → else 400 `invalid_bake_date`; a pair another confirmed sheet holds → 409 `owned_elsewhere` (`sheetDate`)                                                                                                          |
| `POST /:date/lines/:lineId/done`, `…/deltas/…/ack` | inhaber, backstube | answers + `bakeDate`; on a lead > 0 line "done" means **made** (no "baked" tick in Z10)                                                                                                                                                                                                                                                       |

- **Line keys:** `itemId|variant` when `bakeDate === date` (all v1 keys stay valid), else
  `itemId|variant@bakeDate`. Rows are looked up by (sheet date, bake date, item, variant).
- **Inputs per bake day:** preorders with `pickup_date` in `bakeDatesFor(D)` (status ≠ storniert;
  snapshot entries carry `pickupDate`), CAP templates of each bake day's weekday, D's season factor
  and the corrections with their `bakeDate`.
- **Confirm** freezes the rows per (bake date × item × variant), `computed_snapshot` v2
  (`sheetVersion: 2`, `plan`, `bakeDates`, `doughs`, `machine`, `bread`, `rolls`,
  `openMasterData` besides the v1 fields) and the preorder snapshot of the plan's bake days. Tick
  rules unchanged, per row.
- **Confirmed view:** v2 parts come from the snapshot. A snapshot **without `plan`** is a day
  confirmed before Z10: `sheetVersion: 1`, `plan = legacyPlan(date)` (every item of that date),
  no `doughs`/`machine`/`bread`/`rolls`, lines with `lead: 0` - the screens keep the v1 layout.
  `configChangedSinceConfirm` recomputes the way the day was computed (`sheetParts` for v2, v1
  `computeHefeteig` for old days). `deltaExtras` keeps its v1 shape; `deltaMachine` lists the
  machine boxes a Nachtrag changes (v2 only, `machineDeltaExtras`), `deltaBruch` the Bruch groups
  whose dough pieces change (`bruchDeltaExtras`: pieces, Brüche and free pieces before/after,
  `bruecheDelta` `null` while Stück je Bruch or a base is open) - "1 Bruch mehr" or "passt in die
  freien Stücke". Planning screen, tablet and print show both as one note under the Nachträge.
- **Ownership (§5.4):** a (bake date, item) pair belongs to the confirmed sheet whose frozen plan
  holds it (`ownedPairs`, confirmed sheets within ±14 days). A draft never recomputes such a pair
  (core warning `owned_elsewhere`); a correction on it is 409 `owned_elsewhere`. Reopen clears the
  plan, the pairs are free again. So a Tuesday confirmed before hq moves the rolls to `lead: 1`
  keeps them and the Saturday draft does not count them twice. A v2 plan also freezes
  `knownItems` (the item ids at confirm): an item added to hq later whose dough day is that sheet
  is covered by it (`planCovers`), so its preorders become Nachträge there, as in v1.
- **Orphans (transition, `core.transitionFor`):** a (bake date B, item) whose dough day per the
  current master data is a confirmed sheet that does not hold it, and that no other confirmed plan
  holds (`planCore.orphanedItems`), would be on no sheet - e.g. a legacy Tuesday reopened after
  Saturday's v2 confirm, or hq switched to `lead: 1` after Saturday was confirmed. **B's own
  draft adopts it**: the line stands on B's sheet with `doughDate = B`, `lead: 0`,
  `adopted: true`, warning `adopted_orphans` (names the dough-day sheet, says to reopen it if the
  dough should be made there); corrections stored on B count; confirming B freezes it into B's
  plan. The confirmed dough-day sheet says `moved_to_bake_day`. If B's sheet is confirmed too, the
  pair is on no sheet: `not_on_confirmed_sheet` on both sheets (`GET /:date`) and on the bake list.
  A stored correction for a pair the sheet no longer holds is warned (`correction_not_on_sheet`,
  „fällt beim Freigeben weg"), never dropped silently.
- **Deltas by dough day:** the preorder write hook records on every confirmed sheet whose frozen
  plan bakes on a touched pickup day (`confirmedSheetsFor`), each reconciled with **its own** plan
  (`reconcileDeltas({ plan })`, `legacyPlan` for old days, so an old Tuesday still sees its rolls).
  A Tuesday-roll preorder after Saturday's confirm is a delta row `date = Saturday`,
  `bake_date = Tuesday`, none on Tuesday's sheet; `preorderMovedTo` compares with the delta's bake
  day. `reconcileConfirmedDays({ from })` also covers sheets up to 14 days before `from` whose plan
  bakes on or after it. `deltasPending` and the background catch-up work per plan as before.
- **Bake list** (`getBakeList`): sources = confirmed sheets whose plan bakes on B (lines from the
  rows, with ticks = made and Nachträge) + the dough days of the current master data that are still
  drafts (live, without owned pairs; a draft without a line for B is not listed). Lines carry
  `doughDate`, `sheetStatus` and `madeOn` („Teig vom Samstag" / „Teig von heute"). Orphans
  (above) come from B's own draft, which is then a source even if no item is lead 0 on B; if B is
  confirmed too, warning `not_on_confirmed_sheet` - never silently dropped. Ruhetag answers
  `status: 'ruhetag'` (200) with empty lists. `configStatus: 'ok'`. **Without loadable master
  data** the bake list is built from the confirmed sheets whose frozen plan bakes on B (lines and
  frozen `rolls`), `configStatus: 'no-config'`, `deltasPending: null`, warning `no_config`
  („Was noch im Entwurf ist, fehlt hier"); with no such sheet it stays `status: 'no-config'`.
- **`getBakeLines(B, { light })`** (service only, for Rest am Abend, S4): the bake-list lines as one
  day view `{ date, status, sources, sections, deltas, deltaTotals }`; `status: 'confirmed'` only
  when every source with lines for B is confirmed; `deltaTotals` keyed `itemId|variant` (summed
  when two sheets hold Nachträge for the same item on B); `null` without master data or on a
  Ruhetag. Rest am Abend reads it since S4; `getBakeLinesRange(dates, { light })` does the same
  for many days with the confirmed sheets loaded once (summary, averages) and returns only days
  that some confirmed sheet bakes on. `getConfirmedLines` (the day's own sheet) is left for the
  case without master data.
- **Migration** `20270201000000-backzettel-dough-day.js`: `backzettel_lines.bake_date` and
  `backzettel_deltas.bake_date` (DATEONLY NOT NULL DEFAULT `''`, backfilled `= date`), unique index
  `backzettel_lines_date_bake_item_variant (date, bake_date, item_id, variant)` instead of
  `backzettel_lines_date_item_variant`, indexes on `bake_date`. `down()` restores the old index and
  refuses while a line has `bake_date <> date`. Models: `BackzettelLine.bakeDate`,
  `BackzettelDelta.bakeDate` (always written by the service).
- **Preorders:** `preorder-variants.ts` passes the size of a size product (`variants: []` +
  `size`); the entry form asks for no Sorte, the preorder stores `variant: ''`, the core puts it on
  its size.

Tests: `tests/integration/backzettelV2.test.ts` (synthetic hq from `configV2()`: Saturday sheet with
Sunday/Tuesday rolls, Sunday without dough, Monday 409, bake lists, corrections with `bakeDate`,
Tuesday-roll delta on Saturday shown on Tuesday's bake list, transition from a Tuesday and a
Saturday confirmed before Z10, roles, `getBakeLines`), `tests/migrations/pilotBaseline.test.ts`
(backfill, index, a v1-confirmed day reads as before, idempotent, down), `tests/unit/preorderVariants.test.ts`.

## Grundmengen (Z4): base write + reference

Two additions to `/api/backzettel` (registered **before** `/:date`, which would otherwise read
`reference` as a date). Both serve the management screen `/admin/backzettel/grundmengen`.

| Endpoint                          | Who                | Body / answer                                                                                                                                                                                          |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /config` (extended)          | any session        | Z3's answer (approved = what the day computes with) **plus** `pendingApproval`, `writable`, `writeIssue`, `working { status, config, errors, warnings }` (the write-worktree version a save builds on) |
| `PUT /config/base`                | inhaber, backstube | `{ itemId, weekday, value }` or `{ itemId, weekday, variants: { <slug>: n \| null } }` → the `/config` view + `pending`, `changed`                                                                     |
| `GET /reference?weekday=&weeks=6` | inhaber, backstube | `{ status, available, today, weeks, basis, weekdays: [{ weekday, weekdayName, weeks, dates, skippedDates, items: [{ itemId, plu, median, samples, status: ok \| no_plu \| no_data, converted }] }] }`  |

Errors (`sendError`): 400 `validation` (with `errors` for new config errors), `invalid_weekday`
(also a weekday not in `days`), `invalid_quantity` (negative, > 10000, not a number; `"1,5"` is
fine, `""` = `null`); 404 `unknown_item` / `unknown_variant`; 409 `no_config` /
`config_unreadable` / `config_layout_unsupported` / `config_edit_failed`; 500 `hq_commit_failed`;
503 `hq_write_unavailable` / `hq_write_wrong_branch` / `repo_locked`. Without a valid config the
reference answers `status: 'no-config'` with `reasons`, never numbers.

- **Semantics of a weekday value** (Z2): number = Grundmenge, `0` = not baked, `null` = not set yet,
  missing key = 0, object = per variant. `variants` edits only the named slugs: from `null` the
  others stay `null`; from a plain number the number is replaced by the map; from a missing key
  the others are absent (0). Station (PIN) sessions may edit - the Backstube tablet is the point.
- **Comment- and order-preserving edit** (`backzettel-config.editor.js`, `applyBaseEdit(text,
edit)`): `yaml.parseDocument` only to find node ranges, then a **splice** of the original text
  (replace a scalar, insert into a flow or block map sorted by weekday, turn a scalar into a flow
  map); padding per node, trailing comments of a block map stay where they were. The result is
  re-parsed with js-yaml `CORE_SCHEMA` (the loader's parser) and must deep-equal the intended
  object, else `config_edit_failed` and nothing is written. **Never re-serialise the whole
  document** (`toString()` changes flow padding everywhere). A no-op save returns `changed: false`,
  writes and commits nothing - **zero diff**. An inline item without `base` key is
  `config_layout_unsupported` (edit hq by hand).
- **Validation before the commit:** `validateBackzettelConfig` on before and after; only errors
  the edit **adds** (same path + message, `newErrors`) block - a config with an unrelated known
  error stays editable. To make that reachable from the UI, `working.config` is the normalised
  config **even with `status: 'no-config'`** as long as the YAML parses (`errors` say what is
  wrong); only an unparsable or missing file gives `config: null`. Rules in
  `backzettel-base.core.js` (`parseBaseEdit`, `nextDayValue`, `commitMessage`).
- **Write path = the products' one.** `backzettel-config-write.ts`: with `HQ_WRITE_DIR` the file is
  `${HQ_WRITE_DIR}/config/backzettel.yaml` (base text: that file, else the read clone's), branch
  guard, `withRepoLock`, commit `config: Grundmenge <Name> (<id>) <Wochentag> geändert` +
  `Co-authored-by: <displayName> <user-<id>@bakery.local>` with the pathspec, failure restores the
  file and unstages (500). Then `afterCommit` → `HqEditsSync.notifyCommitted()` (push + rolling
  PR). Without `HQ_WRITE_DIR` (development) it writes straight to the config path, no git;
  production without it is 503. `writable` in `/config` says whether a save can succeed: it runs
  the same checks as the save (dir exists, git repo, branch = `HQ_WRITE_BRANCH`; the branch lookup
  is cached 5 s per writer) and names the failing one in `writeIssue { error, message }` (the 503
  code a save would get), `null` when writable.
- **pendingApproval** = the write-worktree YAML differs from `origin/main`
  (`HqEditsSync.approvedTextFile('config/backzettel.yaml')`, read in `refreshApproved` with the
  products; `APPROVED_TEXT_FILES`), falling back to the read clone before the first read or when
  the sync is disabled. The Backzettel itself (day, reference, preorder variants) keeps computing
  with the **approved** read clone until the PR is merged.
- **Reference** (`backzettel-reference.core.js` + `backzettel-reference.ts`): per weekday the last
  `weeks` (default 6, 1-26) same weekdays **before today (Berlin)** that have a report in
  `HQ_REPORTS_DIR/converted` (`reports-files.core.js`); a day without a file is skipped and listed
  in `skippedDates` (looks back at most 26 weeks), **never counted as 0**. Sold = Σ net quantity
  over the item's `plu` list, cancelled receipts out, storno lines negative (as `reports.core`).
  Converted with **the same factor as the Backzettel** (`products[].factor`, PLU = `numeric_id` of
  the hq product: one piece Marmorkuchen = 0.25 cake): only when every PLU of the item maps to such
  a product is `converted: true` and the median (2 decimals) in the item's unit; otherwise it stays
  pieces sold at the register (`converted: false`, 1 decimal) and the UI says "St.". Info only:
  nothing ever writes it into the config.
- **Bundling:** `yaml` ^2 is a root `dependency` and external like every other runtime package;
  `build.mjs` fails when the hoisted `yaml` is not 2.x.
- The Z1 validator formats a fractional quantity with a decimal comma in its message
  (`Menge 12,5 muss bei der Einheit Stück ganzzahlig sein.`) - the message reaches the screen.

Tests: `tests/unit/backzettelBaseEdit.test.js` (parse rules, editor incl. comments, flow/block
maps, no-op zero diff), `tests/unit/backzettelReference.test.js` (synthetic converted reports),
`tests/integration/backzettelGrundmengen.test.ts` (dev mode, write worktree with temp git repo,
push + PR against a bare remote and the fake GitHub, merge clears `pendingApproval`, roles,
reference route). Fixture: `tests/fixtures/backzettel-grundmengen.synthetic.js`.
