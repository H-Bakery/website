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
  `restDays`, `baked` (+ `bakedIsMinimum`), `cap`, `shopBaked`, `sold`, `open`,
  `restShopBaked` / `restSold` (the base of `unexplained`: the days with a count), `rest`,
  `unexplained`, `ampel` (`ok` / `auffaellig` / `pruefen` / `null`; the worse of the counted days'
  `unexplained` and the uncounted days' negative `open`, never netted), `ampelBasis` (`mit_rest` /
  `ohne_rest`), `signal` (the difference behind the Ampel, sort key), `shortWithoutRest` /
  `shortDays` (sum of the negative `open` on days without a count, `null` without such a day - shown
  under the Ampel), `signalDays { pruefen,
auffaellig }`, `direction` (`fehlt` / `mehr_verkauft`), `rate`, `overproduction`, `gaps`
  (`noReport`, `restMissing`, `restPartial`, `baseOpen`, `notOnBackzettel`: sold but not on that
  day's Backzettel, not a counting gap), `foreignPlu` (PLUs another item lists in `plu` or that are
  another item's product id; a match only via the catalog `numeric_id` does not count), `variants[]`, `dayRows[]`. `status` comes from the item alone (PLUs,
  conversion), not from whether a report exists. `baked/cap/sold/open` sum the
  comparable days (report present, units convertible; without any, `baked/cap` sum all days), `rest/unexplained` the days with a
  complete count. `key` is `itemId`, or `itemId|sizeId` when the item is compared per loaf size.
- **`dayRows[]`:** `status` `ok` | `ohne_rest` | `grundmenge_offen` (a draft line with
  `totalIsMinimum`: `baked` is only a minimum, `bakedIsMinimum: true`, no `open`/`unexplained`/Ampel)
  | `kein_bericht` | `einheit` | `keine_plu`, `report`,
  `restStatus` `counted` | `partial` | `not_counted` | `not_on_backzettel`, per-Sorte `lines[]`.
- **`days[]`:** `status` `ok` | `no_backzettel` | `ruhetag` | `geschlossen` | `future`, `basis`,
  `report`, `restStatus`, `signals { pruefen, auffaellig }`, `baseOpen` (items with an open
  Grundmenge), `dayKind` when the calendar says something. A draft bake list without a single line
  is `no_backzettel`. `counts.baseOpen` = bake days with an open Grundmenge.
- **Thresholds** (provisional, constants in the core): `OK_SHARE` 5 %, `NOTICE_SHARE` 15 %,
  `MIN_TOLERANCE_PIECES` 1 (smallest product factor of the item), `OVERPRODUCTION_RATE` 10 %.
- `createApp({ abgleich: { today, reportsDir } })` pins clock and reports in tests (default
  `hq.today` / `hq.reportsDir`).

Tests: `tests/unit/abgleich.test.js` (confirmed vs planned, rest missing/partial, converted vs
not, no PLU, sizes, Sorten, closing day, missing report, CAP, thresholds, CSV),
`tests/integration/abgleich.test.ts` (roles incl. 403, range errors, planned → confirmed with a
rest count, CSV).

## Euro-Abgleich (TASK-043)

`GET /api/abgleich?from=&to=&folgetag=` ergänzt die JSON-Antwort um `data.euro`. Optional
akzeptiert `folgetag` die Abschnitts-IDs aus den Backzettel-Stammdaten als kommagetrennte Liste.
Ohne Parameter gilt die Vorgabe `brot,kuchen` für vorhandene Abschnitte. Ein leerer Wert
schaltet die Verrechnung für alle Abschnitte aus. Ungültige oder mehrfach übergebene Parameter
ergeben 400 `invalid_next_day_sections` mit deutscher Meldung.

- `euro.abschnitte[]` enthält `id`, `label` und die wirksame Auswahl `folgetag`. `sammelEur`
  ist die Summe erkannter Sammelpositionen über die vorhandenen Berichte im Zeitraum.
  `sammelAnteil` ist der Anteil am Kassenumsatz als Verhältniswert. Ohne auswertbaren
  Kassenumsatz bleibt der Anteil `null`.
- `euro.days[]` enthält je Backtag `date`, `basis`, `report`, `kasseEur`, `sammelEur`,
  `handelswareEur`, `abschnitte[]`, `items[]` und `nichtZuordenbar[]`. Die Handelsware ist
  separat vom Ist der Eigenproduktion. Tage ohne Backzettel können Kassenumsätze ausweisen;
  ihr Soll bleibt offen.
- `positionsMissing` kennzeichnet fehlende Kassenpositionen. Der Bonumsatz bleibt verfügbar.
  Ist, Differenz und Summen der Kassenpositionen bleiben für diesen Tag offen.
- `abschnitte[]` liefert `section`, `sectionLabel`, `sollEur`, `istEur`, `differenzEur`,
  `sammelEur`, `handelswareEur`, `preisOffen[]` (Postenschlüssel), `grundmengeOffen`, `restCounted` und
  `folgetagEur` (Übertrag mit Vorzeichen). `istEur` ist der Kassenbetrag des Tages.
  `differenzEur` ist Ist plus Übertrag minus Soll. Die API liest hierfür bei Bedarf
  auch den angrenzenden Kalendertag vor und nach dem ausgewählten Zeitraum.
  `zuordnungOffen` markiert Abschnitte, deren Ist und Differenz wegen nicht eindeutig
  zuordenbarer Kassenpositionen offen sind.
- `items[]` liefert `key`, `name`, `sizeLabel`, `section`, `sollEur`, `istEur` und
  `preisOffen`. `nichtZuordenbar[]` liefert `plu`, `name`, `section` (soweit zuordenbar),
  `sammel` und `istEur`. Geldbeträge sind Euro-Zahlen. Bei fehlenden Daten ist der Wert
  `null`. `0` ist ein berechneter oder berichteter Wert.
- Die Stückfelder und der Stück-CSV-Vertrag bleiben verfügbar. Die Euro-Berechnung steht in
  `abgleich.core.js`. Der Dienst liest für die Berechnung Preise aus dem hq-Katalog,
  Kassenpositionen samt optionaler Kassengruppe sowie Vorbestellpositionen zur Zahlungsart.
  Die Abgleich-Antwort enthält keine Kundenangaben oder Bestellkennungen.
