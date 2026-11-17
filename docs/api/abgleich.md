# Abgleich Produktion ↔ Kasse

Owner-only control tool: per bake day and Backzettel item, baked − CAP − sold (cash register) −
rest (counted). Rules as seen from outside: [domains/abgleich.md](../domains/abgleich.md). Code in
`apps/bakery-api/`; the formula **once** in `src/services/abgleich.core.js` (dependency-free, on top
of `rest-am-abend.core.js` and `backzettel-reference.core.js`; `tests/unit/abgleich.test.js`);
reading in `abgleich.service.ts`; routes in `routes/abgleich.routes.ts`
(`createAbgleichRouter(source, backzettel, options)`, mounted by `app.ts` at `/api/abgleich` after
`/api/rest`).

| Endpoint                      | Who     | Answer                                                                                               |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `GET /api/abgleich?from=&to=` | inhaber | `{ from, to, today, basis, explanation, thresholds, counts, signals, items[], unmatched[], days[] }` |
| `GET /api/abgleich/csv`       | inhaber | same as CSV (`;`, decimal comma, `csvCell`, BOM, `abgleich-produktion-kasse-<from>-bis-<to>.csv`)    |

Every other role gets 403 `forbidden`. Errors via `sendError`: 400 `invalid_date` /
`invalid_range` / `range_too_large` (German `message`).

- **Range:** default the last 7 bake days before today (Berlin; calendar via `countDayStatus`,
  lookback ≤ 31 days); only `to` → the 7 bake days up to `to`; at most 62 days.
- **Reads:** `BackzettelService.getBakeLines(date, { light: true })` for every day up to today -
  confirmed **or draft** (a draft day counts with `planned` and carries `basis: 'geplant'`);
  `rest_counts` read through `loadRows` of the Rest service (names are never passed on);
  cash reports through `reports-files.core.js` `readDailyReportsInRange`.
- **`items[]`** (comparable, sorted by Ampel then size of the signal) and **`unmatched[]`**
  (`status` `keine_plu` / `einheit`): per item `key`, `name`, `sizeLabel`, `unit`, `plu`,
  `converted`, `soldBasis` (`umgerechnet` via product factor / `stueck`: a Stück item whose
  products are one piece each, compared piece for piece, provisional), `tolerance`, `basis` (`freigegeben` / `geplant` / `gemischt`), `comparableDays`,
  `restDays`, `baked`, `cap`, `shopBaked`, `sold`, `open`, `rest`, `unexplained`, `ampel`
  (`ok` / `auffaellig` / `pruefen` / `null`), `ampelBasis` (`mit_rest` / `ohne_rest`),
  `direction` (`fehlt` / `mehr_verkauft`), `rate`, `overproduction`, `gaps` (`noReport`,
  `restMissing`, `restPartial`), `variants[]`, `dayRows[]`. `baked/cap/sold/open` sum the
  comparable days (report present, units convertible; without any, `baked/cap` sum all days), `rest/unexplained` the days with a
  complete count. `key` is `itemId`, or `itemId|sizeId` when the item is compared per loaf size.
- **`dayRows[]`:** `status` `ok` | `ohne_rest` | `kein_bericht` | `einheit` | `keine_plu`,
  `restStatus` `counted` | `partial` | `not_counted` | `not_on_backzettel`, per-Sorte `lines[]`.
- **`days[]`:** `status` `ok` | `no_backzettel` | `ruhetag` | `geschlossen` | `future`, `basis`,
  `report`, `restStatus`, `signals { pruefen, auffaellig }`, `dayKind` when the calendar says
  something.
- **Thresholds** (provisional, constants in the core): `OK_SHARE` 5 %, `NOTICE_SHARE` 15 %,
  `MIN_TOLERANCE_PIECES` 1 (smallest product factor of the item), `OVERPRODUCTION_RATE` 10 %.
- `createApp({ abgleich: { today, reportsDir } })` pins clock and reports in tests (default
  `hq.today` / `hq.reportsDir`).

Tests: `tests/unit/abgleich.test.js` (confirmed vs planned, rest missing/partial, converted vs
not, no PLU, sizes, Sorten, closing day, missing report, CAP, thresholds, CSV),
`tests/integration/abgleich.test.ts` (roles incl. 403, range errors, planned → confirmed with a
rest count, CSV).
