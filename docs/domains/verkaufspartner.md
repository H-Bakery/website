# Verkaufspartner (Backschrank CAP-Markt)

Erfasst wird ein **Besuch** am Backschrank, nicht eine Lieferung. Jeder Besuch hält fest, was noch
dalag (`countedQty`) und was neu eingeräumt wurde (`deliveredQty`); Verkaufszahlen werden daraus
**berechnet** und nie eingegeben.

**Code:** Formeln `apps/bakery-api/src/services/partner-stats.core.js` · Routen der echten API
`apps/bakery-api/src/routes/partner.routes.ts` (`createPartnerRouter()`) · typisierter Wrapper
`partner-stats.service.ts` · Import
`partner-import.core.js` + `partner-import.service.ts` · Frontend
`apps/bakery-management/src/lib/partnerApi.ts`, `src/app/admin/partners/**`.
API-Details (Endpunkte, Fehlercodes): [`docs/api/partners.md`](../api/partners.md).

## Rechenregeln

- **Alle Formeln stehen genau einmal**, in `partner-stats.core.js` - dependency-freies CommonJS.
  Es benutzen sie die echte API (`partner-stats.service.ts`, nur ein typisierter Wrapper) und die
  Tests (bis B12 auch der Mock-Server). Keine zweite Implementierung anlegen. esbuild (`apps/bakery-api/build.mjs`) bündelt die
  `*.core.js`-Dateien mit ins API-Bundle.
- **Bestands-Automat statt Tagesformel.** Die Formel `Σ Geliefert − Rest bei der Abholung` stimmt
  nur, wenn der letzte Besuch eine Abholung ohne Lieferung ist. Der Core rechnet je Produkt
  `sold += Bestand − gezählt; Bestand = gezählt + geliefert` - das ergibt auf abgeschlossenen Tagen
  dasselbe und bleibt auf offenen Tagen richtig.
- **Ein Geschäftstag ohne `pickup`-Besuch ist offen.** Verkauf und Umsatz sind dann vorläufig
  (`stats.isProvisional`, `openDates`). Ohne diese Kennzeichnung liest sich ein unvollständiger Tag
  im Report als 100 % Abverkauf. Detail-Seite und Report markieren das; nicht wegoptimieren.
  Abverkaufs- und Retourenquote rechnen nur über Tage mit Abholung, wie die Wochentagstabelle; was
  an offenen Tagen noch im Schrank liegt, steht als `openQty` („Offen“, Spalte im CSV), sodass
  Geliefert = Verkauft + Retoure + Offen aufgeht.
- **Eine Abholung, die nicht jedes Produkt mit Bestand zählt, ist unvollständig.** Der Tag ist dann
  zwar nicht mehr offen, aber `day.isComplete` ist `false`, die ungezählten Stücke stehen in
  `uncountedQty`/`uncountedProducts`, und `stats.isProvisional` bleibt gesetzt
  (`incompleteDates`). Sonst verschwinden diese Stücke lautlos aus der Abrechnung - weder verkauft
  noch Retoure. Die Erfassungsmaske lässt so eine Abholung nicht ohne Rückfrage speichern.
- **`countedQty: null` heißt „nicht gezählt“, `0` heißt „Schrank war leer“.** Der Unterschied
  ändert die Verkaufszahlen. Die Erfassungsmaske hält ihn auseinander, ein Test sichert das ab.
- **Serverseitige Prüfung jeder Position:** `validateVisitItems(items, lookup)` im Core - ein
  nicht-numerischer Rest wie `"abc"` wird mit 400 abgelehnt statt zu `0` zu werden, Mengen sind
  ganzzahlig und auf 0…10000 begrenzt (`MAX_ITEM_QTY`), negative Preise und Produkte außerhalb des
  Katalogs fliegen raus, Name und Kennungen kommen aus dem Katalog. Erfassung und Import rufen
  diese eine Funktion; `isBusinessDate()` daneben lehnt kalendarisch unmögliche Tage (`2026-02-30`) ab.
- **Mehr gezählt als möglich ist Abweichung, nie Retoure.** Liegt ein gezählter Rest über dem
  errechneten Bestand, bucht der Core den Überschuss als `discrepancyQty`; die Retoure einer
  Abholung ist höchstens der Bestand. Tageskarte und Report zeigen die Abweichung, die
  Erfassungsmaske fragt vorher nach, das CSV hat eine Spalte `Abweichung`.
- **Preisspanne.** Ändert sich ein Preis im Zeitraum, trägt `byProduct` `unitPriceMin`/`unitPriceMax`
  und der Report zeigt die Spanne (`1,60–1,80 €`) - sonst ergäbe Einzelpreis × Verkauft nicht den
  Umsatz.
- **Preise und Produktnamen sind ein Snapshot** auf `PartnerVisitItem`, damit eine spätere
  hq-Preisänderung alte Abrechnungen nicht rückwirkend verändert.
- **`csvCell()` maskiert Formelzellen.** Partner- und Produktnamen landen im CSV-Report; eine Zelle,
  die mit `=`, `+`, `-`, `@`, Tab oder CR beginnt, bekommt ein Apostroph voran und wird eingefasst,
  sonst führt Excel sie aus. Schlichte Zahlen (`-5`) bleiben Zahlen.

## Erfassungsmaske

- **Die Wochentags-Vorlage füllt „Neu“ nur bei der Erstbestückung.** Die Maske merkt sich, welche
  Mengen aus der Vorlage stammen, und nimmt die unveränderten wieder heraus, sobald die Art auf
  Nachlieferung oder Abholung wechselt; hat der Tag schon eine Erstbestückung, startet die Maske als
  Nachlieferung. Sonst bucht eine Abholung die Vorlage ein zweites Mal als geliefert.
- Die Maske schickt `businessDate` immer mit.
- Die Vorlagen-Seite sperrt die Felder für alle außer dem Inhaber und lehnt mehr als 10.000 Stück je
  Position schon vor dem Speichern ab.
- **CSV-Export:** `downloadReportCsv()` in `partnerApi.ts` holt den Report über
  `apiClient.getBlob()` (Bearer, 401 → Refresh) und speichert ihn als Blob. Kein schlichter Link -
  ohne Token antwortet die API 401.

## Echte API (B6)

14 Routen unter `/api/partners`. Von außen wichtig:

- **Rollen.** Lesen: jede Sitzung. Besuche erfassen, korrigieren, löschen: `inhaber`, `verkauf`,
  `fahrer` (`backstube` → 403). Partner-Stammdaten (`POST`/`PUT /api/partners[/:id]`) und
  Standard-Bestückung (`PUT …/templates/:weekday`): nur `inhaber`. Jeder Schreibzugriff steht mit
  Benutzer im `audit_log`; `staffId` eines Besuchs kommt aus der Sitzung, nie aus dem Body,
  `staffName` ist ohne Angabe der Anzeigename.
- **Produkte aus dem hq-Katalog** (`hq-catalogue.ts`, freigegebener Stand, dasselbe Verzeichnis wie
  `/api/products`): Name und Kennungen aus hq, Preis aus hq, wenn der Request keinen schickt, ein
  Produkt außerhalb des Katalogs 400 `INVALID_ITEMS`. Beim Korrigieren gilt der gespeicherte
  Snapshot zusätzlich (ein inzwischen gelöschtes Produkt bleibt korrigierbar). Fehlt das
  hq-Verzeichnis ganz, antwortet die API 503 `hq_unavailable` statt „Unbekanntes Produkt“.
- **Eine Erstbestückung je Tag - geprüft in der Transaktion.** Die Doppelprüfung (POST und PATCH)
  läuft in der serialisierten Schreib-Transaktion; zwei gleichzeitige Erfassungen ergeben genau ein
  201 und ein 409 `DUPLICATE_INITIAL_VISIT`. Wandert ein Besuch per PATCH auf einen anderen Tag,
  bekommt er dort die nächste laufende Nummer.
- **Wie der frühere Mock (D3):** `GET /api/partners?active=true|false`; neuer Partner ohne `deliveryDays` =
  Di-Sa; Vorlagen-`PUT` antwortet 200 (auch beim Anlegen), ergänzt Kennungen aus hq, lässt Menge 0
  weg und lässt `active` stehen, wenn der Request es nicht nennt (sonst setzte jedes Speichern die
  Vorlage wieder aktiv); ohne `items` (z. B. nur `{ active: false }`) bleiben die Posten stehen -
  nur ein gesendetes `items`-Array ersetzt sie; `DELETE` eines Besuchs antwortet 200 `{ id, deleted: true, message }`.
- **Bewusst anders als der Mock:**
  - eigene Fehlercodes (`INVALID_ITEMS` statt `Invalid items`, plus `success: false` - das Frontend
    liest nur `message`);
  - `GET …/templates` legt beim Lesen keine leeren Vorlagen an; `from > to` ist 400;
  - ein PATCH nur mit `visitAt` verschiebt den Geschäftstag nicht; ein ausdrücklicher `visitAt` muss
    höchstens einen Tag neben dem Geschäftstag liegen, sonst 400 `INVALID_VISIT_AT`;
  - Steuer-, Bidi- und unsichtbare Format-/Füllzeichen in Stammdaten, `staffName` und Notiz sind
    400 `INVALID_TEXT`. Die Regel steht einmal in `src/services/control-chars.core.js` und gilt auch
    für Vorbestellungen, Sammelstellen, Stationsnamen, Backzettel-Gründe, hq-Produkte und
    Anzeigenamen (BOM, U+2028/U+2029, U+061C, weiches Trennzeichen, Null-Breiten-Leerzeichen,
    Hangul-Füller, Tag-Zeichen; ZWJ bleibt für Emoji erlaubt);
  - ungültiges `settlementModel` ist 400 statt stillschweigend `commission`;
  - die Vorlage prüft ihre Positionen wie ein Besuch (Menge ganzzahlig 0…10000, Produkt im Katalog
    oder schon in der Vorlage, sonst 400 `INVALID_ITEMS`);
  - Freitexte haben Längengrenzen (400 `TEXT_TOO_LONG`); der Geschäftstag eines Besuchs liegt
    zwischen 2020-01-01 und heute + 7 Tage.
- **Vertrag:** `apps/bakery-api/tests/contract/partners.contract.test.ts` spielt dasselbe Szenario
  (Partner, Vorlage, Besuche, Korrektur, Tageswechsel, Löschen, Kennzahlen, Report, CSV) gegen die
  aufgezeichneten Antworten des Mocks und die echte API und vergleicht Status, Form und - wo beide
  dieselben Daten halten - die Werte; das CSV byte-genau. Die Abweichungen oben sind dort als
  Erwartung festgeschrieben.

## Import des früheren Mock-Stores (`partner-store.json` → SQLite)

Der frühere Mock-Server hielt die Besuche in `apps/bakery-api/data/partner-store.json`
(gitignored). Mock-Server und `json-store.core.js` sind seit B12 gelöscht; eine solche Datei ist
nur noch Eingabe für `import-partners` (ebenso `delivery-store.json` für `import-preorders` /
`import-deliveries`). Idempotent, in einer Transaktion:

```bash
npm run build:api
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- \
  --file apps/bakery-api/data/partner-store.json --dry-run      # erst durchrechnen
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- \
  --file apps/bakery-api/data/partner-store.json                # dann übernehmen
# = node dist/apps/bakery-api/bundle/cli.js import-partners --file … [--dry-run] [--update-partners]
```

- Partner werden über den Slug wiedererkannt (der geseedete CAP-Markt bleibt, wie er ist; mit
  `--update-partners` bekommen vorhandene Partner und Vorlagen die Stammdaten aus der Datei),
  Vorlagen über Partner + Wochentag, Besuche über Partner + Geschäftstag + Typ + Zeitpunkt - ein
  zweiter Lauf legt nichts doppelt an.
- Positionen behalten ihren **Preis- und Namens-Snapshot** aus der Datei (kein Nachschlagen in hq).
  `staffId` des Mocks wird nicht übernommen (zeigt auf keinen Benutzer), `staffName` schon.
- Geprüft wird mit den Regeln der Erfassung; was nicht passt (ungültiger Tag, zweite
  Erstbestückung, auch gegen schon erfasste Besuche in der Datenbank), wird übersprungen und
  aufgelistet.
- Exit-Code 0 = alles übernommen, 2 = Einträge ausgelassen, 1 = unbrauchbare Datei (dann wird die
  Datenbank gar nicht geöffnet). `--dry-run` rechnet den ganzen Import in der Transaktion durch und
  rollt zurück.

## Tests

- Rechenlogik: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/partnerStats.test.js`
- Import: `tests/unit/partnerImportCore.test.js`, `tests/integration/partnerImport.test.ts`,
  `tests/integration/partnerImportCli.test.ts`; synthetische Vorlage
  `tests/fixtures/partner-store.synthetic.json`
- Echte API: `tests/integration/partners.test.ts`; Vertrag: `tests/contract/partners.contract.test.ts`
- Management-App: `src/lib/partnerApi.spec.ts`, `admin/partners/**/*.spec.tsx`

Die echte API wird über `tests/helpers/createTestApp.ts` (`createApp()` auf `:memory:` mit der
Pilot-Baseline) getestet, der Vertrag des gelöschten Mocks über `tests/contract/` - Jest-Projekte
und Details in [`docs/api/overview.md`](../api/overview.md#tests) und
`apps/bakery-api/tests/README.md`.
