# Rest am Abend (M4)

Roadmap §6 M4 (im Pilot freigegeben, Entscheidung 2026-11-08). Verkauf counts what is left at closing; the owner sees baked /
sold / rest / waste rate. Screens and rules as seen from outside:
[domains/rest-am-abend.md](../domains/rest-am-abend.md). Code in `apps/bakery-api/`; rules
**once** in `src/services/rest-am-abend.core.js` (dependency-free,
`tests/unit/restAmAbend.test.js`); DB + transaction + audit in `rest-am-abend.service.ts`; routes
in `routes/rest.routes.ts` (`createRestRouter(source, backzettel, options)`, mounted by `app.ts`
after `/api/backzettel` with the Backzettel source and service from `createBackzettel()`).

| Endpoint                          | Who                | Answer                                                                                                                                                              |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/rest?date=`             | verkauf, backstube | day view (default today, Berlin): `{ date, status ok\|no-config\|ruhetag\|geschlossen, dayKind?, backzettelStatus, window, editable, editIssue, lines[], summary }` |
| `PUT /api/rest/:date`             | verkauf            | `{ items: [{ itemId, variant?, productId?, qty \| null, expected? }] }` → day view + `changed`                                                                      |
| `GET /api/rest/summary?from=&to=` | inhaber            | `{ counts, totals[] per unit, items[] (baked, cap, shopBaked, sold, rest, rate, variants, weeks), days[] }`                                                         |
| `GET /api/rest/summary.csv`       | inhaber            | same as CSV (`;`, decimal comma, `csvCell`, BOM, `rest-am-abend-<from>-bis-<to>.csv`)                                                                               |
| `GET /api/rest/averages?weeks=6`  | backstube          | Rest Ø per weekday and item (Grundmengen, info only); `weeks` 1-26                                                                                                  |

`inhaber` passes every check, `fahrer` gets 403. Station (PIN) sessions are fine - the shop tablet
is where Verkauf counts. Errors via `sendError`: 400 `invalid_date` / `date_out_of_range` /
`validation` / `unknown_item` / `not_countable` / `unknown_variant` / `variant_required` /
`unknown_product` /
`duplicate_item` / `invalid_quantity` / `invalid_range` / `range_too_large`, 409 `ruhetag` /
`geschlossen` / `no_config` / `rest_changed` (with `current`).

- **Calendar (Z14):** the day is classified once, by `countDayStatus` (`rest-am-abend.core.js`)
  from `kalender.core.js` `dayKind`: `ok` (bake day, also Sonderöffnung / wie-sonntag), `ruhetag`
  (weekly plan) or `geschlossen` (holiday, closing day, dough-only day - with the reason in
  `editIssue` / the 409 `message`). `dayKind { kind, label, detail, note, holidayName,
baseWeekday, openUntil }` is part of the day view and of `summary.days[]` (there only when the
  calendar has something to say) - only when a calendar is loaded. `summary.counts.geschlossen`
  counts closing days apart from `ruhetag` and from `notCounted`. Without a calendar: weekly plan
  as before, no `dayKind`.

- **Table `rest_counts`** (migration `20261201000000-rest-am-abend.js`, additive, model
  `RestCount`): one row per `business_date` × `item_id` × `variant` (`''` = none) × `product_id`
  (`''` = counted in the item's own unit), unique index. Snapshots of `name`, `item_name`,
  `unit`, `item_unit`, `factor` (conversion into the item unit, as it was when counted), `qty`,
  `revision`, `counted_by` → users. `qty: null` in a PUT deletes the row.
- **Count lines** come from `backzettel.yaml` (`countRowsForItem`): an item with `products` is
  counted per product in Stück with that product's `factor`; a Liter item without products but
  with `pieces_per_liter` in Stück with factor 1/ppl; otherwise in its own unit (`Liter`/`kg`
  allow 2 decimals, step 0.5). Section `vorbereitung` is not countable. Quantities 0…10000,
  ≤ 500 entries per PUT, an item twice is 400. An item with `variants` is counted per variant,
  as preorders (B7) require: a count without one is 400 `variant_required`, unless the day's
  Backzettel itself has a line without variant (filled goods without a Sorte; the service reads
  the day only when the request has such an entry). Deleting (`qty: null`) always works.
- **All or nothing.** The PUT runs in one serialised write transaction; each entry may carry
  `expected` (the value the screen showed, `null` = not counted). Any mismatch → 409
  `rest_changed`, `current` lists the stored values with `countedBy`, nothing is written. A save
  of unchanged values writes and audits nothing. One `audit_log` row per save (`rest_count` on
  `rest_day`/date, `data.changes [{ itemId, variant, productId, from, to, correction? }]`).
- **Window:** writes only today − 7 … today (Berlin, `COUNT_DAYS_BACK`), never on a weekday not
  in `config.days` (409 `ruhetag`) or a closing day of the calendar (409 `geschlossen`), never without valid master data (409 `no_config`). Reads are
  not limited. `createApp({ hq: { today } })` / `rest: { today, now }` pin the clock in tests.
- **Baked** = the confirmed Backzettel's frozen `total` plus acknowledged deltas (`bake −
bakeOpen`, fallback `qty − openQty`) - unacknowledged Nachträge are not counted as baked. A
  draft day gives `planned` only, `baked: null`. **Since Z10 (Backzettel v2)** a business day
  is a **bake day**: its lines come from `BackzettelService.getBakeLines(date, { light: true })` -
  every sheet that makes dough for that day (Tuesday's rolls from Saturday's sheet, Tuesday's
  bread from Tuesday's own). `backzettelStatus` is `confirmed` only when every such sheet with
  lines for the day is confirmed, else `draft` (planned only). The same item × variant on two
  sheets (transition only; the bake list warns `duplicate_bake_line`) is added up, its Nachträge
  counted once (`deltaTotals` summed over the sheets). Spare pieces of a rounded-up Bruch ("+n
  frei", O2) are never "baked". Without loadable master data there is no plan: the day's own
  confirmed sheet is read as before (`getConfirmedLines`). **Rate** = rest ÷ (baked − cap), because CAP
  goods leave the shop. The summary evaluates only confirmed days whose item is counted
  completely (`lineComplete` over `evaluatedLineKeys`: every line that was counted or baked
  `> 0`, every count line of it); others are listed as gaps
  (`uncountedDates`, day status `partial` / `not_counted` / `no_backzettel` /
  `counted_without_backzettel`), never as 0. **Sold** = Z4's `soldOnDay` over the item's PLUs on
  the same evaluated days, from `HQ_REPORTS_DIR` (`soldStatus ok|partial|no_plu|no_report`).
  Range default the last 28 days, at most 400. A rest above `baked − cap` is flagged, not
  dropped: `restExceedsShop` on the day line, `restExceedsDates` on the summary item (almost
  always a miscount; the screens say "bitte nachzählen" / "Zählung prüfen").
- **Bread by size (Z10):** an item with `sizes` (`variantKind: 'size'`) is counted per size,
  with only the products whose `products[].size` is that size (`productsForVariant`); a size
  without a product of its own is counted in the item's unit. A product of another size is 400
  `unknown_product`. `variantLabel` of a size line is the size label ("500 g").
- **Light Backzettel view:** the summary and the averages read each confirmed bake day through
  `BackzettelService.getBakeLinesRange(dates, { light: true })` (Z10: the confirmed sheets are
  loaded once for the range; only days that at least one confirmed sheet bakes on are read; each
  feeding sheet through `confirmedView(..., { light: true })`, before Z10 `getConfirmedLines`): frozen
  lines, deltas and their oven figures (`bake`/`bakeOpen`, `deltaTotals`) exactly as the full
  view, without confirm audits, user names, preorder codes, the Hefeteig/Füllungen recompute and
  the `deltasPending` catch-up (an unrecorded delta is never acknowledged, so it cannot change
  "baked"). A year's summary is then ~340 light reads, not ~340 screen views. An integration
  test checks that summary and day view agree on "baked" with an acknowledged Nachtrag.
- **Averages** (`weekdayRestAverages`) use the same completeness rule as the summary and only
  days with a confirmed Backzettel (`backzettelByDate`): a Sorte baked but not counted makes the
  day unusable instead of lowering the mean. A day whose rest exceeds `baked − cap` (the
  "Zählung prüfen" case) is left out of the mean too and listed in `excludedDates`; the summary
  keeps such days but marks them (`restExceedsDates` per item, `restExceedsItems` per day and per
  unit total, CSV column `Zählung prüfen` on item and day rows).
- **Count lines as they were** (`rest_counts.line_rows`, migration
  `20270106000000-rest-count-line-rows.js`): every save writes the line's product ids from the
  config of that moment onto all rows of the touched Posten × Sorte; completeness
  (`expectedRowsForLine`) and the day view's rows follow that snapshot, not today's YAML. Without
  it, adding a product to a Posten turned every earlier fully counted day into `partial` and
  dropped its history out of summary and Rest Ø. Rows from before the column (`NULL`) fall back
  to the current config.
- **Z9 snapshot:** with `HQ_SNAPSHOT_DIR` set, every save with changes calls
  `snapshots.restCounted(view)` in the background → `data/production/rest/<date>.json`
  (`restSnapshot` in `hq-snapshots.core.js`: baked, cap, rest and counts per line - no user, no
  times; commit `chore(production): Rest am Abend <date> (App)`).
- The management screens (`/admin/rest`, `/admin/rest/auswertung`) are in the pilot's route list
  (im Pilot freigegeben, Entscheidung 2026-11-08); the summary stays inhaber-only (see
  [domains/rest-am-abend.md](../domains/rest-am-abend.md)).

Tests: `tests/unit/restAmAbend.test.js` (core), `tests/integration/rest.test.ts` (roles incl.
PIN station, PUT rules, `variant_required`, parallel PUTs on one row = one 200 + 409s, window,
409, audit, summary with a synthetic cash report and the light view, CSV, averages),
`tests/unit/hqSnapshotsCore.test.js` (snapshot whitelist), `tests/integration/hqSnapshots.test.ts`
(`writeRest` against a bare remote: path, commit message, no names/times, no second commit), migration in
`tests/migrations/pilotBaseline.test.ts`.
