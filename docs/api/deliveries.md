# Delivery tours (B8): depot, drivers, tours, stops

The Saturday delivery tour (roadmap §6 M4) on the real API, with the former mock's contract (D3).
Client: the Fahrer-App ([apps/delivery.md](../apps/delivery.md)); rules as seen from outside:
[domains/liefertouren.md](../domains/liefertouren.md). Paths below are under `apps/bakery-api/src/`.

`routes/delivery-tours.routes.ts` → `createDeliveryToursRouter(service)`, mounted at
`/api/deliveries` **after** the Mörsbach alias (the alias owns `pickup-points` and `preorders*`).
Service `services/delivery-tours.service.ts` (`DeliveryToursService`), models `DeliveryDepot`
(one row, id 1), `DeliveryDriver`, `DeliveryTour`, `DeliveryStop`, `DeliveryGeocache`; migration
`20270105000000-delivery-tours-b8.js` (tables `delivery_depot` seeded with the Backstube,
`delivery_drivers`, `delivery_tours`, `delivery_stops`, `delivery_geocache`). Answers are bare
objects like the mock's (no `{ success, data }`); errors via `sendError`, so they carry
`success: false` besides the mock's `error` codes (`Tour not found`, `Stop not found`,
`Driver not found`, `Invalid coordinates`, …) and a German `message`.

| Endpoint                                                   | Who                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /depot`, `GET /drivers[?active=]`                     | verkauf, fahrer (`/drivers`: only his own row)                  |
| `PUT /depot`, `POST /drivers`, `PUT /drivers/:id`          | inhaber                                                         |
| `GET /tours?date=&driverId=`                               | verkauf; **fahrer silently gets only his own tours**            |
| `GET /tours/:id`                                           | verkauf; fahrer own only, else 403 `not_own_tour`               |
| `POST /tours`, `PATCH`/`DELETE /tours/:id`                 | inhaber                                                         |
| `POST /tours/:id/stops`, `DELETE /tours/:id/stops/:stopId` | inhaber                                                         |
| `PATCH /tours/:id/stops/:stopId`                           | inhaber; fahrer own tour, only `FAHRER_STOP_FIELDS` (see below) |
| `POST /tours/:id/optimize`, `POST /tours/:id/position`     | inhaber; fahrer own tour                                        |
| `POST /geocode`                                            | inhaber                                                         |

`inhaber` passes every check; `backstube` gets 403 everywhere. Role checks run before the 404.

- **Formulas once.** Geometry, ordering, ETAs, time windows, tour status, input normalisation:
  `delivery-tours.core.js`; Nominatim/OSRM: `delivery-geo.core.js` - both unchanged, `require`d
  from TS (bundled by esbuild). Same rules as the mock: `hasCoordinates()` /
  `validateCoordinates()` (never `Number(x)`), `isClockTime()`, `applyOpenStopOrder()`,
  `syncTourStatus()`, estimates carry `isEstimate: true`.
- **Reads never hang on Nominatim.** `GET /tours[/:id]` geocodes missing stops for at most
  `HYDRATE_BUDGET_MS` (2.5 s), then answers without them and keeps searching in the background
  (results land in `delivery_geocache` and on the stop); misses are not retried for
  `GEOCODE_RETRY_MS` (5 min); concurrent searches for one address share one lookup. Explicit
  actions (create stop, address change, optimize, depot change, `/geocode`) search with `force`.
  Options `createApp({ deliveries: { geo, hydrateBudgetMs, geocodeRetryMs, log, now } })`
  (`now`: the clock for ETAs, time windows, the default tour date and the
  `startedAt`/`finishedAt`/`completedAt`/`routedAt`/position stamps - tests pin it; the geocode
  negative cache keeps the wall clock);
  `createTestApp()` passes `OFFLINE_GEO` (no network) and `tests/setup-ts.js` points
  `NOMINATIM_URL`/`OSRM_URL` at a closed port.
- **Fahrer = own tours.** A driver row may name its account (`delivery_drivers.user_id`, unique:
  409 `Driver user taken`; unknown user 400 `User not found`; an account whose role is not
  `fahrer` 400 `Driver user not fahrer` - the link restricts only fahrer, so it would do nothing).
  `GET /drivers` answers a fahrer with his own row only (no colleagues' phones or accounts). A fahrer sees and touches only
  tours whose `driver_id` is one of his driver rows (`ownDriverIds`); a fahrer without a row sees
  no tours. On a stop he may send only `status`, `failureReason`, `goodsDisposition`,
  `completedAt` - anything else is 403 `forbidden_fields` with `fields`. He may run
  "Route berechnen" (`optimize`) on his own tour (operational, not planning) and report his
  position. Drivers carry `userId` in addition to the mock's fields.
- **Writes are serialised and audited.** Every write runs in the managed transaction
  (BEGIN IMMEDIATE, `mutateTour()`), with one `audit_log` row: `delivery_tour` (`create`,
  `update`, `delete`, `add_stop`, `update_stop`, `remove_stop`, `optimize`), `delivery_driver`
  (`create`/`update`), `delivery_depot` (`update`). Audit data holds ids, statuses and changed
  field names - **no customer names, addresses or phones**. Position reports are not audited
  (every 30 s). **Optimize** routes outside the transaction (OSRM may take seconds) and commits
  only if the tour's stops (id, status, coordinates) are unchanged; otherwise it routes once more,
  then falls back to the offline estimate.
- **Mörsbach.** `POST /tours` on a pickup point's weekday attaches that point's stop **only to
  the first tour of the day** (checked in the transaction). The stop's handover list is read from
  the B7 preorders (`PreordersService.legacyList()`, the alias shape), not stored on the stop -
  so `GET /tours` shows the same preorders as `/api/preorders`. Cancelled ones are left out,
  except a paid one with money to give back (`paymentBalance < 0`): the driver sees it as a
  refund (`preorderSummary` still counts only active ones). Changing a pickup point
  (`PUT /api/deliveries/preorders/pickup-points/:id`, `PUT /api/preorders/pickup-points/:id`)
  copies the new address onto every stop of that point and clears its coordinates, so the next
  read searches it again (`pickupPointChanged`, inside the pickup point's transaction).
- **Depot `PUT`** applies only the fields the request names, onto the row read **inside** the
  transaction (two overlapping changes keep both). The address search runs before, outside the
  transaction; if the address changed meanwhile, its hit does not apply: 409 `Depot changed`.
- **Deliberate deviations from the mock:** text limits (`DELIVERY_LIMITS`: customer/street 200,
  city 120, zip 16, time window 64, notes 2000, ≤ 100 items, phone 40 after `normalizePhone` -
  stops, drivers, depot) → 400 `Text too long`; control and bidi characters (stops, drivers,
  depot, tour names on POST and PATCH, a stop's `failureReason`) → 400 `Invalid text`; an item
  quantity that is not a whole number ≥ 0 (`"abc"`, `-5`, `1.5`, `1e309`; missing = 1) → 400
  `Invalid quantity` (the mock coerced it); `driverId` other than empty/0/a whole number → 400
  `Invalid driverId`; a tour date outside 2020-01-01 … today + 366 → 400 `Invalid date`; an
  explicit `completedAt` outside the tour date − 1 … + 3 days → 400 `Invalid completedAt`; an unknown `pickupPointId` on a stop is 400
  `Pickup point not found` (the mock stores it); an invalid `completedAt` is 400 (the mock stores
  it); errors carry `success: false`; drivers carry `userId`; a depot with manual coordinates
  answers `geocodeSource: 'manual'`; the fahrer restriction above. The alias' `hasPickupStop`
  still means "the point is served that weekday" (follow-up: read it from the tours).
- **Contract:** `tests/contract/deliveries.contract.test.ts` plays depot, drivers, tours, stops,
  optimize, position, status sync, Mörsbach stop and deletion against the recorded mock (recorded
  with offline geo) and compares status, shape and values after normalising ids and clock fields; the
  deviations are pinned there as expectations.

## `import-deliveries` CLI

```bash
npm run build:api
npm run api:import-deliveries -- --file apps/bakery-api/data/delivery-store.json --dry-run
npm run api:import-deliveries -- --file apps/bakery-api/data/delivery-store.json [--update-depot]
```

Copies drivers, tours with stops and the geocache of the mock's `delivery-store.json` into SQLite
(the pickup points and preorders of the same file go through `import-preorders`, B7 - **run that
first**, otherwise a Sammelstelle stop is imported without its link and listed as a hint). Rules in
`services/delivery-import.core.js` (`planDeliveryImport`: keys `mock:driver:<id>`,
`mock:tour:<id>:<date>`, `…:stop:<id>`; coordinates scrubbed like the mock's loader), writes in
`delivery-import.service.ts`: **one** transaction, idempotent through `import_key` columns
(existing rows are skipped, never changed). A stop whose pickup point is unknown, or already
served by another tour that day, is imported without the link and listed. A stop that fails the
text rules (`checkStopText`) holds back its **whole tour** (listed, `tours.skipped`, exit 2):
created, the tour would carry its `import_key` and a re-run with a corrected file could never add
the stop. Stops older than the P4 period (tour date before today − 90 days, `--today` pins the
date) are anonymised in the same transaction (`anonymized`, `geocache.removed` in the report), so
history from the mock store never lands in clear text. The depot stays
unless `--update-depot` (the report says `unchanged`/`differs`/`updated`). One `audit_log` row
(`import`, `delivery_store`, counts only). Exit 0 clean, 2 entries listed, 1 unusable file
(checked before the database is opened) or error. Tests:
`tests/integration/deliveryImport.test.ts`; fixture `tests/fixtures/delivery-store.synthetic.json`.

## DSGVO (P4 rule) for stops

`anonymizeDeliveryStops(transaction, { cutoff })` in `services/delivery-anonymize.ts`: stops of
tours dated before the P4 cutoff (`delivery-preorders.core.js` `anonymizeCutoff`, 90 days) and
without `pickup_point_id` get `customer = 'anonymisiert'`, phone, notes, failure reason, street,
coordinates and geocode source cleared, `anonymized_at` set (column in the B8 migration); zip, city,
time window, items, status, `completed_at` and goods disposition stay for statistics. Sammelstelle
stops carry only the public address and stay. Cache entries of the cleared addresses are deleted
unless a not-anonymised stop, a pickup point or the depot still has that address. One `anonymize`
audit row per run on `delivery_stop` (ids only), none when nothing changed. Runs **inside**
`anonymizePreorders()` (the nightly `cli.js anonymize-preorders`, report field `deliveryStops {
stops, geocacheRemoved }`) and at the end of `import-deliveries`. An anonymised stop is not locked
against edits (a 90-day-old tour has no screen); backups keep the data until they rotate out, as for
preorders.

Tests: `tests/integration/deliveryTours.test.ts` (roles, own tours, fahrer fields, budget and
negative cache with a stub geo, optimize race, Mörsbach first tour, audit, limits, depot partial
update, nightly anonymisation),
`tests/contract/deliveries.contract.test.ts`, the B8 block in `tests/migrations/pilotBaseline.test.ts`.
