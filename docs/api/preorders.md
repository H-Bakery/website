# Preorders (B7) and anonymisation (P4)

Vorbestellungen for every channel in one table (`preorders` + `preorder_items`). Rules **once** in
`apps/bakery-api/src/services/delivery-preorders.core.js` (dependency-free CommonJS; until B12 the
mock's Mörsbach routes used the same file): channels, statuses, transitions, input normalisation, codes,
sums, day summary, payment balance, the mapping to/from the mock shape and the anonymisation cutoff.
DB + transactions + audit in `src/services/preorders.service.ts`, routes in
`src/routes/preorders.routes.ts`, import/anonymise in `src/services/preorders-maintenance.ts`,
the Backzettel-variant hook in `src/services/preorder-variants.ts`.

| Endpoint                               | Who                                                | Answer                                                                                                              |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/preorders`                   | verkauf, fahrer                                    | `{ success, data: Preorder[], count }`; filters below                                                               |
| `GET /api/preorders/sums?date=`        | verkauf, fahrer, backstube                         | `{ success, data: { date, pickupPointId, preorderCount, items, summary } }`; optional `&pickupPointId=`             |
| `GET /api/preorders/day?date=`         | verkauf, fahrer                                    | `{ success, data: { date, pickupPointId, summary, sums, pickupPoints, preorders } }`; optional `&pickupPointId=`    |
| `GET /api/preorders/pickup-points`     | verkauf, fahrer                                    | `{ success, data: (PickupPoint + updatedAt)[], count, pickupDays }` (closed pickup days, see below)                 |
| `PUT /api/preorders/pickup-points/:id` | inhaber                                            | `{ success, data: PickupPoint + updatedAt }`; 400 `invalid_window` / `Text too long`, 404, 409 `stale_pickup_point` |
| `POST /api/preorders/bulk-status`      | verkauf; fahrer only `abgeholt` / `nicht_abgeholt` | `{ ids, status?, notCollected?, paid?, expectedUpdatedAt? }` → `{ success, data: { counts, results } }`             |
| `GET /api/preorders/variants`          | verkauf, fahrer                                    | `{ success, data: { [productId]: string[] }, configured, count }`                                                   |
| `GET /api/preorders/:id`               | verkauf, fahrer                                    | `{ success, data }`; 404 `not_found`                                                                                |
| `POST /api/preorders`                  | verkauf                                            | 201 `{ success, data }`; optional `requestId` (a retry returns the earlier order, 200)                              |
| `PATCH /api/preorders/:id`             | verkauf                                            | `{ success, data }`; partial; a date/place change renews the code; optional `expectedUpdatedAt`                     |
| `POST /api/preorders/:id/status`       | verkauf; fahrer only `abgeholt` / `nicht_abgeholt` | `{ status?, notCollected?, paid?, expectedUpdatedAt? }` → `{ success, data }`                                       |
| `POST /api/preorders/:id/cancel`       | verkauf                                            | `{ expectedUpdatedAt? }` → `{ success, data }` (status `storniert`; nothing is ever deleted)                        |

`inhaber` passes every check.

- **`sums`** items = `[{ productId, variant, name, unit, quantity, preorders }]`, everything except
  `storniert`; `summary` is the same `core.summarizeDay()` as `/day` - **no names or phones**, so
  the Backliste reads `/sums` instead of `/day`. The role `backstube` gets `/sums` **without
  `summary`** (no amounts, no paid state; it may not read `/day` either).
- **`summary`** (`summarizeDay`): counts, totals, `byStatus` incl. `storniert`, `byChannel`;
  `unpaidTotal` = unpaid and not yet handed over **plus** top-ups of paid orders that became more
  expensive (`topUpCount`/`topUpTotal`); `refundCount`/`refundTotal` = paid and cancelled or
  cheaper - cancelled ones included, otherwise prepaid money would be in no total;
  `handedOverUnpaid`/`handedOverUnpaidTotal` = handed over "Ohne Zahlung" - kept apart so that
  money never drops out of every total.
- **List filters:** `date` or `from`/`to`, `status` (comma list), `channel`, `pickupPointId`
  (`laden` = no point), `q` (name/code as a case-insensitive `GLOB` - `caseInsensitiveGlob()`,
  because SQLite `LIKE` folds ASCII only, „öztürk" did not find „Öztürk"; `%`/`_`/`*`/`?`/`[` match
  literally; phone digits from 3 on).
- **`Preorder`** = `{ id, code, channel, customerName, customerPhone, pickupDate, pickupTime,
pickupPointId, pickupPoint { id, name, window } | null, status, notCollected, notCollectedAt,
paid, paidAmount, paymentBalance, note, items [{ productId, name, variant, unit, unitPrice,
quantity, lineTotal }], total, pickedUpAt, anonymizedAt, createdBy, updatedBy, createdAt,
updatedAt, deadline, afterDeadline }`.
- **Errors** via `sendError`: 400 `invalid_*` / `unknown_product` / `unknown_pickup_point` /
  `variant_required` / `invalid_delivery_day` / `invalid_quantity` / `invalid_expected_updated_at`
  / `invalid_request_id` / `date_out_of_range` / `ruhetag` / `geschlossen` (the pickup-point `PUT` keeps the mock's
  codes: control characters in name, address or window are 400 `Invalid text`, notes keep
  newlines), 403 `forbidden` / `paid_undo_forbidden` / `handover_undo_forbidden`, 404 `not_found`,
  409 `already_picked_up` / `cancelled` / `anonymized` / `has_variants` / `stale_preorder` /
  `not_collected_too_early` / `request_id_conflict` / `request_id_changed`.

## What to know before changing it

- **Channels** `laden | telefon | whatsapp | shop | sammelstelle`. Pickup is either the Laden
  (`pickupPointId: null`, date + optional `HH:MM`) or a pickup point (date must be its weekday, no
  time - the window applies; `sammelstelle` requires a point; inactive points are refused).
- **Statuses** `offen → bereit → abgeholt | storniert`; `abgeholt ↔ storniert` is locked (409), so
  a paid handover cannot fall out of the accounts and a late handover from a dead spot cannot
  revive a cancelled one. **`abgeholt` is history**: while a preorder is `abgeholt`, a PATCH that
  changes its items, pickup date or place is 409 `already_picked_up` (sums and day totals would
  change after the fact); plain fields (note, paid, …) stay editable, and the same PATCH with
  `status: 'offen'` goes through. **"nicht abgeholt" is not a status**: it is `bereit` +
  `not_collected_at` (migration `20261113000000-preorders-b7.js`, which also seeds the Mörsbach
  point), set with `{ notCollected: true }` (fahrer: target `nicht_abgeholt`), cleared by any
  other status.
- **`storniert` is locked on `/api/preorders` (not on the alias).** A PATCH that keeps the status
  `storniert` but changes items, pickup date, place, time or channel is 409 `cancelled`; name,
  phone, note and paid stay editable, and the same PATCH with `status: 'offen'` goes through
  (core option `lockCancelled`, mirrors the `abgeholt` lock). The Mörsbach alias does not pass the
  option - the mock let a cancelled preorder be edited and the contract test keeps that.
- **Fahrer rules:** may set „bezahlt" but never take it back (403 `paid_undo_forbidden`, also via
  bulk), and may not move an `abgeholt` order anywhere else (403 `handover_undo_forbidden` - status
  endpoint, bulk and the Mörsbach alias). Only Verkauf can undo a handover.
- **Undoing a handover restores the payment.** A status change _into_ `abgeholt` writes
  `payment: { before, after }` (paid + paidAmount) into its `audit_log` row. Leaving `abgeholt`
  again (menu „Übergabe zurücknehmen", toast „Rückgängig", bulk) puts `before` back - „Bezahlt und
  übergeben" on an unpaid order is unpaid again, a part payment keeps its amount - unless the
  payment changed since the handover or the request asks for a different `paid`. The Mörsbach alias
  keeps the payment (mock contract, `keepPaymentOnUndo`).
- **Paid amount** (`paid_amount`, migration `20261114000000-preorders-paid-amount.js`): set to the
  total when payment is recorded (create with `paid`, `paid` false → true, an explicit `paid: true`
  on the status endpoint = „Rest kassiert"), kept on edit, cleared with `paid: false`.
  `paymentBalance` (core): > 0 still to collect, < 0 to refund; cancelled + paid = −paid. A NULL
  `paid_amount` with `paid` means "fully paid" (old rows, imports).
- **Retried create (`requestId`)** (migration `20261116000000-preorders-request-id.js`, unique,
  nullable): the entry form sends one id (8-64 of `[A-Za-z0-9_-]`, else 400 `invalid_request_id`)
  per order it is saving and keeps it across retries. A save whose answer was lost (Wi-Fi drop)
  used to create the same order twice with two codes; now a repeat with the same id returns the
  earlier order with 200. The id belongs to its creator (another user → 409 `request_id_conflict`),
  and only an **unchanged** retry is the same save (`sameOrderInput`, prices excluded): a form
  edited after the unclear attempt gets 409 `request_id_changed` naming the stored order, so the
  edit is never silently dropped.
- **Bulk status.** `POST /bulk-status` changes many preorders in **one** serialised write
  transaction (Abholliste: „alle bereit", Tagesabschluss „nicht abgeholt"). Body: `ids` (1-200
  positive integers or canonical digit strings like `"7"`, duplicates merged; else 400
  `invalid_ids`), the same change fields as `/:id/status` (at least one, else 400
  `invalid_status`; values that are wrong for every preorder - unknown `status`, non-boolean
  `paid`/`notCollected`, `notCollected` with a status other than `bereit` - are one top-level 400
  `invalid_status` / `invalid_paid` / `invalid_not_collected`, not `refused` per id), optional
  `expectedUpdatedAt` as a map `{ "<id>": "<ISO>" }` (not an object → 400
  `invalid_expected_updated_at`; an id without entry is not checked). Each id runs through the same
  `changeStatusIn()` as the single route and gets one result: `ok` (with the new `data`),
  `conflict` (`stale_preorder`, `already_picked_up`, `cancelled`; with the current `data`),
  `anonymized`, `not_found`, `refused` (any other rule, with `error` + German `message`). `counts`
  per outcome. One failing id never rolls back the others; a thrown error rolls back all. Audit
  rows as for single changes plus `bulk: true`.
- **„Nicht abgeholt" only from the pickup day on.** `/:id/status`, `/bulk-status` and create/edit
  refuse `notCollected: true` before the pickup date (Berlin today) with 409
  `not_collected_too_early` - until then the customer can still come. Core option
  `notCollectedFrom` of `normalizeStatusChange`; the Mörsbach alias does not pass it (mock
  contract, contract test).
- **Plausible input on `POST`/`PATCH /api/preorders`.** Option `strictPickup` of
  `create()`/`update()` passes `pickupRules` + `notCollectedFrom` to `core.normalizeOrderInput`: a
  **new** pickup day must lie within 30 days back and 366 ahead of Berlin today (400
  `date_out_of_range`), a Laden pickup (no pickup point) not on a closed weekday
  (`PREORDER_CLOSED_WEEKDAYS` = Monday, 400 `ruhetag`), and - in the shop and at a pickup point -
  not on a day the calendar closes (`kalender.yaml` via the Backzettel source,
  `service.useCalendar()` in `app.ts`; `geschlossen`, statutory holiday or `teigtag` → 400
  `geschlossen`; a `sonderoeffnung` / `wie-sonntag` entry lifts the Monday rule; without a valid
  calendar only the Monday rule applies). An unchanged day is never re-checked, and
  the lock errors (`already_picked_up`, `cancelled`) win. The Mörsbach alias does not get the day
  rules (mock contract). For **every** caller (alias and shop too): `customerName` with C0/C1, DEL
  or bidi control characters is 400 `invalid_customer`, a note with them (newline/tab allowed) 400
  `invalid_note`, and a non-empty `customerPhone` that `normalizePhone` cannot keep (fewer than 5
  digits) is 400 `invalid_phone` instead of being dropped silently.
- **Stale writes.** `PATCH /:id`, `POST /:id/status` and `POST /:id/cancel` take an optional
  `expectedUpdatedAt` (the `updatedAt` of the copy the client loaded, ISO). If the preorder changed
  since, the answer is 409 `stale_preorder` with `message` and the current `updatedAt`, and nothing
  is written - checked by `expectedVersionGuard()` inside the write transaction. Without the field
  there is no check (alias, import, old clients: last writer wins). The management app always sends
  it and its edit form PATCHes only changed fields, so an open edit form cannot reset `paid` after
  a driver handed the order over elsewhere.
- **Per-place day.** `GET /day?date=&pickupPointId=` narrows `preorders`, `summary` and `sums` to
  one place (`laden` = no point, otherwise a point id; parsed like the list filter, an empty value
  is 400 `invalid_pickup_point`) and echoes `pickupPointId` (`null` without the filter).
  `pickupPoints[].preorderCount` still counts the whole day. This is what the Abholliste and the
  Mörsbach screens read - one request, totals from the server.
- **Closed pickup days (Z14).** `GET /pickup-points` also answers
  `pickupDays: { from, to, calendar, closed: [{ date, code, reason, message, shopOnly }] }` for the
  window a new pickup date may lie in (30 days back, 366 ahead). `core.closedPickupDays()` asks
  `pickupDayClosed()` for every day, so the list is exactly what `POST`/`PATCH` reject: `code`
  `geschlossen` (calendar; `reason` = note or holiday name) or `ruhetag` (`shopOnly: true` - a
  Sammelstelle may take it). `calendar: false` = no valid `kalender.yaml`, only the Monday rule.
  The preorder form reads it to not offer those days.
- **Pickup points.** `PUT /pickup-points/:id` (only `inhaber`) takes the mock's Lieferstelle body
  (`name`, `street`, `zip`, `city`, `weekday`, `window`, `orderDeadline`, `notes`, `active`) via
  `service.updatePickupPoint`, the same function the Mörsbach alias
  `PUT /api/deliveries/preorders/pickup-points/:id` uses; audited. Texts are limited in
  `core.normalizePickupPointInput` and therefore on both routes
  (`PICKUP_POINT_LIMITS`: name 100, street 200, zip 10, city 100, notes 2000 characters, trimmed) →
  400 `Text too long`. The `PUT` on `/api/preorders` additionally takes `expectedUpdatedAt` (from
  `GET /pickup-points`): changed meanwhile → 409 `stale_pickup_point` with the current
  `updatedAt`, nothing written; malformed → 400 `invalid_expected_updated_at`. The alias answers
  without `updatedAt` (deep-equal to the mock).
- **Items** carry a **price/name/unit snapshot** from the approved hq catalogue (`getProduct`);
  duplicates of product + variant are merged; a product without a price is 400. **Quantities** are
  whole numbers (number or digit string, `core.parseQuantity`); `"abc"`, `2.7`, negatives, `null`
  or a missing quantity are 400 `invalid_quantity` - nothing is truncated or dropped silently, only
  an explicit `0` removes a line (same rule as partner visits). The mock's
  `normalizePreorderInput` (still in the core) coerced; the alias therefore rejects what the mock
  would have dropped.
- **Variant** `''` = none (never null). If `hq/config/backzettel.yaml` exists (found like the
  Backzettel loader: `HQ_BACKZETTEL_CONFIG`, `${HQ_DIR}/config/backzettel.yaml`, next to the
  products dir), a product of a Backzettel item with Sorten **must** name one of them (400
  `variant_required` / `invalid_variant`) and a product without Sorten must not; a product not in
  the config, or no config at all, accepts any slug. Cached 60 s + mtime; an invalid config is
  warned once and ignored. `createApp({ preorders: { variantsForProduct } })` overrides the hook.
- **`GET /variants`** lists, from the same `backzettel.yaml`, every product that **must** name a
  Sorte: `{ mustersemmel: ['nuss', 'schoko'] }` (products without Sorten are absent;
  `backzettel.core.js` `variantsByProduct`, `createVariantsHook().all()`). `configured: false` and
  `{}` without a valid config - the API then accepts any slug and the entry form offers none.
  `createApp({ preorders: { variantsMap } })` overrides it; a test that passes only
  `variantsForProduct` gets `configured: false`. Mounted before `/:id`.
- **Codes** `<PREFIX>-<YYYY-MM-DD>-<nn>`: the pickup point's prefix (`MO` for Mörsbach) or `LA`
  for the Laden. **Single-use**: every code ever handed out is registered in `preorder_codes` in the
  same transaction, and `allocateCode()` numbers over the registry plus the table. So neither a
  cancelled code nor the old code of a preorder that moved to another date or place (which renews
  its code, audited with `previousCode`) ever goes to another customer - an Abholzettel or a printed
  list may still carry it. Moving back gets a fresh number, too. The import registers the references
  it keeps.
- **Audit**: every write (`create`, `update` with `changed`, `status`, `cancel`, `import`,
  `anonymize`, pickup point `update`) in the write's transaction; a no-op update writes nothing.
  Audit data never holds customer names, phones or notes - otherwise P4 would have to scrub
  `audit_log` as well. Every preorder write also records Backzettel deltas in the same transaction
  (see [backzettel.md](backzettel.md)).
- **Mock mapping** (alias and import): `open → offen` (an incoming `open` on a `bereit` preorder
  keeps `bereit`), `handed_over → abgeholt`, `not_collected → bereit + notCollectedAt`,
  `cancelled → storniert`; back: `offen`/`bereit` → `open` unless `notCollectedAt` is set.
  **Handover means paid** on both mock paths: the import and an alias `handed_over` (from any other
  status) set `paid: true` - Mörsbach collects at the handover and the old form has no paid switch.
  Reopening does not clear it. Since the final `next` verification this applies only to an
  **unpaid** order: a prepaid one keeps `paidAmount`, so an open rest stays "noch zu kassieren" and
  an open refund stays "zu erstatten" instead of being booked silently. The driver confirms them
  with `{ status: 'handed_over', paid: true }` (Fahrer-App: "Rest kassiert und übergeben" /
  "Erstattet und übergeben").
- **Mörsbach alias `/api/deliveries/*`** keeps the mock contract (contract test): `GET
/pickup-points`, `PUT /pickup-points/:id` (inhaber), `GET /preorders[?date&status&pickupPointId]`,
  `GET /preorders/summary?date=`, `GET/PATCH/DELETE /preorders/:id`, `POST /preorders`. Deliberate
  differences: `hasPickupStop` means "the point is served that weekday" (not read from the B8
  tours yet - follow-up); the PUT
  does no geocoding (an address change clears the coordinates); Laden preorders are invisible there
  (404); a PATCH with `items` on a preorder that has variants is 409 `has_variants` (the old form
  cannot show them and would drop them); fahrer may PATCH only `{ status: handed_over |
not_collected }` (plus `paid: true` with `handed_over`), and not away from a handed-over order (403
  `handover_undo_forbidden`). A PATCH whose body is **only** `{ status[, paid] }` goes through
  `changeStatus` (no re-validation of weekday, items …), so a preorder
  stays hand-over-able after the inhaber changed the point's weekday; a full form save still
  re-validates. The alias guards (Laden → 404, legacy transition locks) run inside the write's
  transaction, also for DELETE. Answers carry `code`, `channel`, `paid`, `paidAmount`, `paymentBalance` (and `variant` per item;
  the item name shows the Sorte capitalised, `Zopf (Nuss)`, as in management) in addition. Changing
  a pickup point (here or `PUT /api/preorders/pickup-points/:id`) also moves the address of its B8
  tour stops (see [deliveries.md](deliveries.md)).
- **Shop `POST /api/orders`** (verkauf) validates with `shop-orders.core.js` and creates a `shop`
  preorder for the Laden; it answers in the mock's shape with `id` = code and `orderNumber` =
  preorder id. **It stays behind the global auth guard** - the public shop cannot order until a
  public order endpoint is designed (rate limit, spam, owner decision). The e-mail address is not
  stored.
- **P4 anonymisation**: `anonymizePreorders({ today, days = 90, dryRun })` sets
  `customer_name = 'anonymisiert'`, clears phone **and note** (free text often holds personal
  data), sets `anonymized_at` and writes one `anonymize` audit row each (code, date, status - no
  names) - for **every** preorder whose pickup date lies more than 90 days before `today`
  (Berlin), **whatever its status** (a handover nobody ticked off must not keep a name forever).
  The report lists `anonymized[{ id, code, pickupDate, status }]` and `unfinished` = how many were
  still `offen` / plain `bereit` (a hint that handovers are not being ticked off). An anonymised
  preorder can no longer be edited or change status (409 `anonymized`). Backups keep the names
  until they rotate out (runbook §5.1). The same nightly run anonymises old delivery stops (B8,
  report field `deliveryStops`, see [deliveries.md](deliveries.md#dsgvo-p4-rule-for-stops)).

## CLI

`dist/apps/bakery-api/bundle/cli.js`, same `.env`/`DB_PATH` rules as `create-user`; JSON report on
stdout, a summary on stderr:

```bash
node dist/apps/bakery-api/bundle/cli.js import-preorders --file apps/bakery-api/data/delivery-store.json --dry-run
node dist/apps/bakery-api/bundle/cli.js anonymize-preorders [--dry-run] [--days 90] [--today YYYY-MM-DD]
```

- `import-preorders` reads the former mock's `delivery-store.json` (pickup points + preorders; the
  tours of the same file go through `import-deliveries`, see [deliveries.md](deliveries.md)), creates
  missing points, maps statuses as above (`handed_over` ⇒ paid), keeps references as codes (a taken
  code gets the next free number) and `createdAt`. **Idempotent** through the audit rows
  (`action: 'import'`, `data.sourceReference`); `--dry-run` does the same work in a rolled-back
  transaction. It migrates first (runbook §3.9).
- `anonymize-preorders` runs nightly from `deploy/systemd/bakery-anonymize.timer` (23:45
  Europe/Berlin, after the 23:30 backup). **It never migrates**: with pending migrations it exits 1
  and names them (`pendingMigrations()` in `db/migrate.ts`), so a deploy whose API restart failed
  does not get its schema changed under the old process at night.

Tests: `tests/unit/preordersModel.test.js` and `tests/unit/deliveryPreorders.test.js` (core),
`tests/unit/preorderVariants.test.ts`, `tests/unit/shopOrders.test.js`,
`tests/integration/preorders.test.ts` (every route incl. roles),
`tests/integration/preordersMaintenance.test.ts` (import, anonymise, CLI),
`tests/contract/preorders.contract.test.ts` (alias vs. the recorded mock), and the migrations in
`tests/migrations/pilotBaseline.test.ts`.
