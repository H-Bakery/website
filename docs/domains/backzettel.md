# Backzettel

Was die Backstube an einem Produktionstag backt: Grundmenge × Saisonfaktor + Vorbestellungen +
CAP-Vorlage + Korrektur, je Posten und Sorte, dazu Hefeteig, Füllungen und Vorbereitung. Stammdaten
in `hq/config/backzettel.yaml` (privat), Rechnung hier. Plan und offene Fragen: `docs/roadmap.md` §5;
die Überarbeitung „Backzettel v2" (Z10) ist dort geplant - dieses Dokument beschreibt den heutigen Stand.

**Code:** Rechnung `apps/bakery-api/src/services/backzettel.core.js`, `backzettel-day.core.js`,
`backzettel-config.core.js`, `backzettel-recipes.core.js`, `backzettel-config.loader.js`,
`backzettel-config.editor.js`, `backzettel-reference.core.js`; API `src/routes/backzettel.routes.ts`,
`src/services/backzettel.service.ts`; Verwaltung `apps/bakery-management/src/lib/backzettelApi.ts`,
`backzettelFormat.ts`, `grundmengenApi.ts`, `backstubeDay.ts`, `backstubeErrors.ts`,
`src/app/admin/backzettel/**`, `src/app/backstube/`, `src/components/backzettel/`,
`src/components/backstube/`. Endpunkte, Rollen und Antwortform: [`docs/api/backzettel.md`](../api/backzettel.md).

## Rechnung (Kern)

- **Die Rechnung steht genau einmal**, in `backzettel.core.js` (dependency-freies CommonJS):
  `computeDay({ config, date, preorderItems, capTemplate, corrections, seasonFactor, recipes, catalog })`
  liefert Zeilen (Basis | Saison | Vorbestellt | CAP | Korrektur | Gesamt) je Posten/Variante, die
  Hefeteig-Zusammenfassung (Teigstücke, Teig g, Chargen, Abwiegeliste), den Füllungsbedarf mit
  skaliertem Rezept und die Vorbereitungen. `computePreorderDeltas({ config, date, before, after })`
  liefert die Deltas **je Vorbestellung** (passt 1:1 auf `backzettel_deltas`), `computeDeltas`
  vergleicht zusätzlich die Zeilen. **Nie nur Summen vergleichen:** ein Viertel verschwindet in der
  Aufrundung, Neu + Storno heben sich auf. `variantsForProduct` / `variantsByProduct` sagen, welche
  Varianten ein Produkt annimmt (für die Vorbestellungen). Freigabe, Schnappschuss und Nachträge
  rechnet `backzettel-day.core.js` (`computedSnapshot`, `frozenSections`, `deltaBakeExtras`,
  `tickStillValid`). Schema-Prüfung: `backzettel-config.core.js` (`validateBackzettelConfig`,
  `normalizeConfig`), Rezepte: `backzettel-recipes.core.js`, Datei-Lesen (js-yaml):
  `backzettel-config.loader.js`.
- **Viertel erst summieren, dann aufrunden** - je Zeile (Posten × Variante) über alle Quellen:
  Basis × Saison + Vorbestellt + CAP (2 + 0,75 + 0,25 = 3, nicht 2 + 1 + 1). Haben mehrere Quellen
  Bruchteile, stehen Saison/Vorbestellt/CAP genau da (`quartersPooled`), damit sich die Spalten zur
  Summe vor dem Aufrunden addieren; der Schnappschuss hält `subtotalExact` für die Nachträge fest.
  Aufgerundet wird mit Toleranz (`roundUp`), sonst wird aus 10 × 1,1 = 11,000…02 eine 12.
  Stück/Blech ganzzahlig, Liter/kg auf 0,01.
- **Teigstücke und Füllungsgramm kommen aus der YAML**, nicht aus Code. Der gefüllte Kranz ist eine
  offene Frage (Q-B3 in der Roadmap) und nur dort einzustellen.
- **`null` als Grundmenge heißt „noch nicht festgelegt", `0` heißt „wird nicht gebacken".** Eine
  `null`-Zeile erscheint mit `baseUnset: true` (Warnung `base_unset`); nicht zu 0 zusammenlegen.
  Gefüllte Posten (`filling_g`) brauchen die Grundmenge je Variante, sonst fehlt sie im
  Füllungsbedarf (der Validator lehnt eine bloße Zahl ab).
- **Variante = Füllungs-ID.** Gefüllte Ware ohne Variante zählt im Teig, aber nicht in der Füllung
  (`filling_unassigned`); unbekannte Produkte/Varianten werden als Warnung gemeldet, nie verschluckt.
- **Vorbereitungen mit Variante** (`by_weekday: { 6: gross }`) zeigen die ID nur als Notbehelf
  („Gross"); den deutschen Namen trägt `variant_labels: { gross: groß }` an der Aufgabe, die API
  liefert ihn als `variantLabel`.
- **Rezeptpfade nur relativ unter `data/recipes/` und `.md`** - Validator und Loader prüfen das beide.
- **Ein unvollständiges Rezept wird nicht hochgerechnet:** hat eine Zutat keine Grammangabe
  (`1 Dose (ca. 2 kg)`, `2–4 g`), liefert `scaleRecipe` `factor: null`, `batch_g: null` und keine
  skalierten Mengen; Tablet, Planung und Druck zeigen das Grundrezept mit Hinweis. Sonst entstünde aus
  der Summe der lesbaren Zutaten ein falscher Faktor.
- **Eine Korrektur darf die Zeile nicht unter 0 drücken** (400 `correction_exceeds_line`). Wird eine
  Zeile später kleiner (Grundmenge, Storno), steht sie mit `correctionClamped` und der Warnung
  `correction_exceeds_line` da - nie still auf 0.
- **Bleche zählen nach der Menge der Zeile** (`trayText(tray, total, unit)`): `per_tray` ist Stück je
  Blech, bei 40 Croissants à 12 heißt es „4 Bleche à 12 (Bleche 1, 2 + 2 weitere)", nicht „2 Bleche
  à 12". Ohne `per_tray`, ohne Menge oder bei Litern bleibt die reine Blechliste aus der YAML.
  `formatTrayInfo` gibt es seit B12 nur noch in `backzettel.core.js` (die Kopie in
  `feature-daily-prep` ist mit der Lib gelöscht, ihre Tests stehen in `backzettelCore.test.js`).
- CLI für das hq-CI: `node apps/bakery-api/scripts/validate-backzettel.js <yaml> [productsDir] [--json]`,
  Exit 1 bei Fehlern. Der Loader braucht `js-yaml` ^4 (Root-`dependencies`); das hq-CI muss es selbst
  installieren. Im API-Bundle bleiben `js-yaml` und `yaml` extern (esbuild, `apps/bakery-api/build.mjs`).

## Tagesablauf auf der API (Z3)

- **Stammdaten:** `HQ_BACKZETTEL_CONFIG`, sonst `${HQ_DIR}/config/backzettel.yaml`. Fehlen sie oder
  sind sie ungültig, antwortet `GET /api/backzettel/:datum` mit `status: 'no-config'` und `reasons`,
  Schreibversuche mit 409 `no_config` - **nie** mit geschätzten Mengen. Ein schon freigegebener Tag
  bleibt lesbar. Montag (allgemein: Wochentag nicht in `days`) ist 409 `ruhetag`.
- **Entwurf wird live gerechnet.** Gespeichert werden nur Saisonfaktor und Korrekturen; eine Korrektur
  ≠ 0 braucht einen Grund. Saisonfaktor- und Korrektur-`PUT` schicken den Wert, auf dem der Editor
  begann (`expectedFactor`, `expected`); weicht der gespeicherte ab, 409 `season_changed` /
  `correction_changed` statt Überschreiben.
- **Freigeben friert ein:** Zeilen, Vorbestellungs-Schnappschuss und - in `computed_snapshot` -
  Hefeteig, Füllungen, Vorbereitung und Hinweise. Eine spätere Änderung an YAML oder Rezepten ändert
  einen freigegebenen Zettel nicht; `configChangedSinceConfirm: true` sagt nur, dass die aktuellen
  Stammdaten jetzt etwas anderes ergäben. Nach jeder Freigabe schreibt die API einen Schnappschuss nach
  hq `data/production/backzettel/` (Z9, `hq-snapshots.service.ts`, ohne Personendaten). Ein
  Teigtag-Zettel (Z10, `sheetVersion: 2`) wird mit `schema_version: 2` geschrieben - zusätzlich
  `bakeDate`/`doughDate`/`variantLabel` je Zeile, `bakeDates`, `doughs`, `machine`, `rolls`
  (Brüche) und `openMasterData`; Unbekanntes bleibt `null`, nie 0. Das Markdown gruppiert die
  Brötchen nach Backtag. Tage von vor Z10 bleiben Schema 1.
- **Offene Grundmenge bleibt offen nach der Freigabe:** `computed_snapshot.unsetKeys` hält die Zeilen
  mit `baseUnset`, `frozenSections(rows, config, unsetKeys)` setzt sie wieder - sonst stünde auf dem
  freigegebenen Zettel „Basis 0" statt „offen". Ältere Freigaben ohne das Feld zeigen 0.
- **Spätere Vorbestellungen kommen als Deltas dazu** - je Vorbestellung und Änderung eine Zeile,
  hervorgehoben, von der Backstube quittiert (`ack`), nie still in die Zeilen gemischt. **Sie schreibt
  der Schreibweg der Vorbestellung** (Anlegen, Ändern, Status, Storno, Sammelaktion - in derselben
  Transaktion), nicht das Lesen: `GET /api/backzettel/:datum` schreibt nichts und sagt mit
  `deltasPending`, ob noch etwas nachzutragen ist. Was geschrieben wurde, während die Stammdaten
  fehlten (oder per CLI-Import), trägt ein Abgleich nach (Serverstart, Freigabe, Wiederöffnen, nächste
  Änderung des Tages, und im Hintergrund, sobald ein Lesen `deltasPending: true` findet). Tablet und
  Planungsseite zeigen `deltasPending` als Hinweis und laden nach 5 s nach (höchstens 6-mal,
  `DELTAS_PENDING_*` in `backzettelApi.ts`); fehlen die Stammdaten an einem freigegebenen Tag, sagt
  das Tablet, dass Nachträge fehlen können - nie still.
- **Was Nachträge für Ofen, Teig und Füllung heißen:** je Zeile `delta.bake` =
  `roundUp(exakt + Nachtrag) − roundUp(exakt)` (`deltaBakeExtras`; `exakt` = Vorbestellungen vor dem
  Aufrunden, im `computed_snapshot` als `preordersExact`; ältere Freigaben rechnen mit der gerundeten
  Menge - eher eine Einheit zu viel als zu wenig). Abzeichen sagen das mit Einheit („Nachtrag +1 L",
  „Nachtrag +0,25 · 1 mehr backen"). `deltaExtras` am Tag nennt, was Hefeteig und Füllungen dadurch
  zusätzlich brauchen (`doughs[].batchesBefore` + `batch_max_kg`, `fillings[].recipe`); der Hinweis
  nennt „jetzt 4 Chargen statt 3" und, wenn der Zusatzteig größer als eine Charge ist, wie viele
  Chargen er braucht. Der freigegebene Stand darunter bleibt eingefroren.
- **Abhaken** (`done`/`undone`) nur an freigegebenen Tagen. `done` schickt `expectedTotal`; ist jetzt
  mehr fällig, 409 `line_changed`. **Braucht eine erneute Freigabe mehr von einer Zeile, fällt ihr
  Haken weg** (steht als `clearedTicks` im Audit) - sonst sähe die Backstube eine erledigte Zeile und
  übersähe die zusätzlichen Stücke. Wird sie kleiner, bleibt der Haken (`tickStillValid`: 14 gebacken,
  12 nötig = fertig). Was damals schon gebacken war, steht danach als `previouslyDone: { qty, at, by }`
  an der offenen Zeile, bis sie wieder abgehakt ist; Tablet, Planung und Druck zeigen „bereits 30
  erledigt … - noch +10".
- **Wieder öffnen** kann nur der Inhaber.
- `prepDate` ist der Kalender-Vortag; ist der selbst Ruhetag (Dienstag), steht
  `prepDateProvisional: true` - wer dann vorbereitet, ist offen (Q-B2).
- **Planen und Freigeben nur von heute − 7 bis heute + 90 Tage** (Berlin; 400 `date_out_of_range`) -
  ein Tippfehler in der URL committete sonst einen Backzettel für 9999-12-31 nach hq `main`.
- **Rollen:** lesen jede Sitzung; planen, freigeben, abhaken, quittieren `inhaber` + `backstube`.
  Jede Änderung steht im `audit_log`.

## Teigtag ≠ Backtag auf der API (Z10)

Entwurf: [`docs/backzettel-v2.md`](../backzettel-v2.md); Endpunkte: [`docs/api/backzettel.md`](../api/backzettel.md),
Abschnitt „Dough-day sheets and bake list". Stand: Stammdaten-Prüfung (S1), Kern (S2), API (S3),
Rest am Abend/Schnappschuss (S4), Bildschirme (S5) und Druck (S6) sind auf dem Zweig
`feat/Z10-backzettel-v2` gebaut; die neue hq-Datei kommt erst, wenn der Zweig auf der Box läuft.

- **Ein Tag ist der Zettel eines Teigtags** (`computeDoughDay`): was an D gebacken wird (`lead` 0)
  und was an D für einen späteren Backtag angesetzt wird (`lead` ≥ 1 - Samstag macht die Brötchen
  für Sonntag und Dienstag). Mit der heutigen hq-Datei (ohne `lead`) ist jeder Zettel der v1-Tag
  plus zusätzliche Felder. Die Grundmenge steht beim **Backtag**.
- **`GET /api/backzettel/:datum/bake-list`** ist die Backliste für die Person, die nur backt
  (Sonntag): je Backtag die Zeilen aller Zettel, mit „Teig vom Samstag", ohne Teigzahlen.
- **Freigeben friert den Plan ein** (welche Backtage × Posten der Zettel trägt). Was ein
  freigegebener Zettel trägt, rechnet kein anderer Entwurf noch einmal (`owned_elsewhere`).
  Ein vor Z10 freigegebener Tag trägt alle Posten seines Datums (`legacyPlan`) und zeigt die
  v1-Ansicht (`sheetVersion: 1`).
- **Nachträge landen beim Teigtag:** eine Vorbestellung für Dienstags-Brötchen nach der Freigabe
  am Samstag ist ein Nachtrag auf dem Samstags-Zettel (`bakeDate` Dienstag) und steht auf der
  Dienstags-Backliste - nicht auf dem Dienstags-Zettel.
- **Korrekturen** nennen den Backtag (`bakeDate`); einer, der nicht auf dem Zettel steht, ist
  400 `invalid_bake_date`.
- **Umstellung in hq:** erst wenn S1-S3 auf der Box laufen. Ein Samstag, der **vor** der Umstellung
  freigegeben wurde, trägt die Dienstags-Brötchen nicht. Dann nimmt sie der Entwurf des Dienstags
  auf (`adopted_orphans`, „steht hier, weil der Zettel vom Samstag schon freigegeben ist"; der
  Samstag sagt `moved_to_bake_day`) - nichts fällt weg, auch nicht nach „Wieder öffnen" eines alten
  Dienstags. Ist auch der Dienstag schon freigegeben, warnen beide Zettel und die Backliste
  (`not_on_confirmed_sheet`); dann einen der Zettel wieder öffnen und neu freigeben. Ein nach dem
  Freigeben in hq ergänzter Posten bleibt beim Zettel seines Teigtags (`plan.knownItems`), seine
  Vorbestellungen werden dort Nachträge.
- **Ohne Stammdaten** bleibt die Backliste lesbar, soweit freigegebene Zettel den Tag tragen
  (`configStatus: 'no-config'`, Hinweis, dass Entwürfe fehlen) - der Sonntag sieht die Brötchen
  vom Samstag.
- **Grundmenge offen heißt Mindestmenge, nicht fertige Zahl** (Review Z10 Runde 2): eine Zeile
  ohne Grundmenge und ohne Korrektur trägt `totalIsMinimum: true` - `total` ist nur das Bekannte
  (Vorbestellt, CAP). Dasselbe Feld steht an Brot-Zellen, Einzelstücken und Bruch-Mitgliedern
  (`split[].total` bleibt die bekannte Zahl, nie `null`, nie 0 statt 7). Bildschirm, Tablet,
  Backliste, Druck und Z9-Schnappschuss zeigen „≥ 4" bzw. „offen", wenn nichts bekannt ist
  (`minQtyText` in `backzettelFormat.ts`, eine Regel). Gefüllte Posten ohne Grundmenge machen den
  Füllungsbedarf unvollständig (`fillings[].baseUnset`, `openItems`; auch mit 0 Stück, kein
  hochgerechnetes Rezept); ein Hefeteig-Nachtrag auf einen unvollständigen Teig nennt den
  Zusatzteig aus Stück × Gramm und das Gesamt nur als Mindestmenge (`totalPiecesComplete`,
  `totalDoughKnown_g`) - nie „+0 g".
- **Folge für die heutige hq-Datei:** solange Grundmengen offen sind (z. B. Hefeteig am Samstag),
  sind Hefeteig-kg, Liter und Chargen unbekannt („≥ kgKnown", „Chargen: unbekannt") - der alte
  Zettel zeigte dort eine Zahl, die die offenen Posten als 0 zählte. Wer die Zahl am ersten
  Samstag nach dem Deploy braucht, trägt vorher die Grundmengen in hq ein.
- **Unbekannt bleibt unbekannt, auch beim Bruch:** hat ein Mitglied einer Bruch-Gruppe keine
  Grundmenge, sind Brüche, kg und „frei“ `null`; `bruecheKnown`/`kgKnown` zählen nur die bekannten
  Mitglieder („≥ 1 Bruch“). „+n frei“ steht in Produkten (`spareProducts`, bei zwei Teigstücken je
  Doppelweck die Hälfte), `spare` in Teigstücken. Liter werden vom ungerundeten Quotienten
  gerundet (6,01 kg ÷ 3 = 2,003 L → auf 0,5 L aufgerundet 2,5). Die Hefeteig-Karte nimmt kg, Liter
  und Chargen aus der Teigsumme des Zettels - dieselbe Zahl wie die Maschinenleiste.

## Grundmengen (Z4, `/admin/backzettel/grundmengen`)

Tabelle Posten × Di–So (nach Abschnitt, Hefeteig-Posten mit Sorten-Zeilen) zum Pflegen der
Grundmengen in `hq/config/backzettel.yaml`; PC zuerst, Inhaber und Backstube schreiben, alle anderen
sehen nur Werte. API: `PUT /api/backzettel/config/base`, `GET /api/backzettel/reference`,
erweitertes `GET /api/backzettel/config`.

- **Geschrieben wird wie bei den Produkten:** Schreib-Worktree `app/edits`, ein Commit je Zelle, Push
  - rollende PR (siehe [`docs/api/hq-products.md`](../api/hq-products.md)). Bis zum Merge rechnet der
    Backzettel mit dem **freigegebenen** Stand; die Seite zeigt den Arbeitsstand, ein Banner „Wartet auf
    Freigabe" und je geänderter Zelle den freigegebenen Wert im Tooltip. Ohne Schreibziel
    (`writable: false`, Grund in `writeIssue` - auch ein Worktree, der nicht auf `app/edits` steht oder
    kein git-Repo ist) ist die Seite nur lesbar; ebenso nach einer 503 `hq_write_*` beim Speichern.
- **Kommentare und Reihenfolge der YAML bleiben**; die API ändert nur die eine Stelle
  (`backzettel-config.editor.js`, braucht `yaml@2` - `build.mjs` bricht ab, wenn im Root eine andere
  Hauptversion liegt), ein Speichern ohne Änderung ist ein Null-Diff. Geprüft wird vor dem Commit mit
  `validateBackzettelConfig`; nur Fehler, die die Änderung **neu** einführt, lehnen ab (400 mit
  `errors`, die Seite zeigt sie an der Zelle). Deshalb liefert `working.config` die normalisierte
  Config auch bei `status: 'no-config'`, solange die YAML lesbar ist: ein fremder Fehler (z. B. ein in
  hq gelöschtes Produkt) zeigt eine Warnung über der Tabelle, sperrt sie aber nicht.
- **Zellen:** leer = `null` („noch nicht festgelegt"), `0` = wird nicht gebacken, kein Eintrag zeigt
  „0". Komma geht. Gespeichert wird bei Enter/Verlassen nur, wenn sich der Wert geändert hat; Escape
  verwirft.
- **Referenzwert grau neben jeder Zelle:** Median der verkauften Stück an den letzten 6 gleichen
  Wochentagen **mit Kassenbericht**, über die `plu`-Liste des Postens. Tage ohne Bericht sind Lücken,
  nicht 0. Er wird **nie** übernommen - nur Information. Umgerechnet mit **demselben Faktor wie der
  Backzettel** (`products[].factor`, Kassennummer = `numeric_id` des hq-Produkts): 1 Stück
  Marmorkuchen = ¼ Kuchen, ein 500-g-Laib = 0,5 l - dann `converted: true` und der Wert steht in der
  Einheit des Postens. Ist eine Kassennummer keinem Produkt des Postens zugeordnet, bleibt es „St."
  (Stück laut Kasse), der Tooltip sagt das. Im Hinweis steht zusätzlich „Rest am Abend Ø"
  (`GET /api/rest/averages`, nur Information, siehe [rest-am-abend.md](rest-am-abend.md)).
- **Drucken:** eigenes Druckbild (`GrundmengenPrint.tsx`, A4 quer, schwarz auf weiß, alle Tage Di–So,
  geänderte Werte mit `*` und dem freigegebenen in Klammern); das Bildschirm-Raster
  (`grundmengen-screen-only`) und die App-Hülle fallen im Druck weg. Mit `page.pdf()` prüfen, nicht mit
  einem Screenshot.
- **Client:** `src/lib/grundmengenApi.ts` (getrennt von `backzettelApi.ts`), Fixtures
  `grundmengenFixtures.ts` (erfunden). Die Übersicht `/admin/backzettel` verlinkt „Grundmengen" nur für
  Rollen, die die Seite öffnen dürfen.

## Tagesplanung und Druck (Z5/Z7, `/admin/backzettel[/datum]`)

- **Ein Client, kein Rechnen:** `src/lib/backzettelApi.ts` (Typen + alle Endpunkte, auch Abhaken) und
  `src/lib/backzettelFormat.ts` (Kalender, deutsche Zahlen, Sortennamen aus `config.fillings`). Jede
  Menge auf dem Bildschirm und im Druck kommt vom Server; die Seite rechnet nichts nach. Die 409
  `ruhetag` liefert `fetchBackzettelDay` als Zustand `status: 'ruhetag'`, nicht als Fehler; `no-config`
  zeigt eine Erklärung **ohne Zahlen**. Entwurfszeilen haben `id: null` - Korrekturen gehen über
  `itemId`/`variant` (`correctionPath`), Zeilen werden über `key` gefunden.
- **Rollen:** planen (Saisonfaktor, Korrektur mit Pflichtgrund ≠ 0, Freigeben mit Rückfrage)
  `inhaber` + `backstube`; „Wieder öffnen" nur `inhaber`; alle anderen sehen „Nur Ansicht". Verkauf
  darf die Seiten lesen (im Laden sieht man, was gebacken wird) - **außer** den Grundmengen: die Regel
  in `ROLE_ACCESS` ist `{ path: '/admin/backzettel', except: ['/admin/backzettel/grundmengen'] }`.
- **Ein anderes Gerät war schneller:** antwortet Freigeben, Wieder öffnen, Saisonfaktor oder Korrektur
  mit 409 `confirmed`/`not_confirmed`/`no_config`/`ruhetag`/`season_changed` (`STALE_CODES` in
  `BackzettelDayClient.tsx`), lädt die Seite den Tag neu und hängt „Der Backzettel wurde neu geladen."
  an - kein Entwurf mit aktiven Knöpfen über einem schon freigegebenen Tag. Bei
  `correction_changed` bleibt der Editor mit der eigenen Eingabe offen und nennt den neuen Wert; erst
  ein zweites Speichern ersetzt ihn. Freigegeben wird, was der Server **jetzt** rechnet; weicht ein
  Gesamt von der Anzeige vor dem Klick ab, nennt ein Hinweis die Zeilen (`changedTotals`, vergleicht
  nur Server-Zahlen).
- **Negative Korrekturen am iPhone:** die Ziffernblöcke (`inputMode` numeric/decimal) haben auf iOS
  kein Minus. Darum hat das Feld einen ±-Knopf (44 px, `toggleSign`); `parseDecimal` nimmt auch das
  typografische Minus (U+2212). Nicht auf `inputMode: 'text'` „vereinfachen" und den Knopf nicht
  entfernen.
- **Übersicht:** die nächsten 7 Kalendertage ab heute, nur `config.days` (ohne Stammdaten Di–So),
  Untertitel aus `config.days` (`describeProductionDays`); oben groß der **nächste Produktionstag = der
  erste nach heute** (heute wird schon gebacken). Je Tag ein `GET /api/backzettel/:datum` (ohne
  Nebenwirkung) und „Vorbestellungen in N Zeilen" statt einer Stücksumme (Zeilen stehen in
  Produktionseinheiten, Viertel aufgerundet).
- **Bildschirm:** ab `md` eine Tabelle je Abschnitt (feste Spaltenbreiten), darunter Karten; beide
  stehen im DOM und werden per CSS umgeschaltet (Specs greifen über `table-<abschnitt>` /
  `line-card-<key>`). Offene Nachträge: Zeile mit Warnrand + Chip, Karte „Nachträge seit der Freigabe"
  mit „Gesehen". `configChangedSinceConfirm` und `prepDateProvisional` stehen als Hinweise da.
  Bedienelemente ≥ 44 px.
- **Druck eines Teigtag-Zettels (Z10 S6, `sheetVersion: 2`):** `components/backzettel/DoughDayPrint.tsx`,
  **eine A4-Seite** je Teigtag, schwarz auf weiß: Kopf mit Stempel „FREIGEGEBEN" bzw. „ENTWURF – noch
  nicht freigegeben" und „Teige heute", Maschinen-Leiste (Liter groß, kg, Chargen, Zugaben), Brot
  (Größen als Spalten), Brötchen je Backtag (spätere Backtage zuerst, `n Bruch × g – Aufteilung`,
  „+n frei" nur als Hinweis), Hefeteig (gefüllte Posten in einer Zeile mit den Sorten), die übrigen
  Abschnitte knapp in zwei Spalten (Basis/Saison/Vorb./CAP stehen nur als Text dabei, wenn sie etwas
  sagen), Nachträge (nie in den Mengen), „Hinweise", „Offen: …" (offene Stammdaten und fehlende
  Teig-Angaben, je einmal) und vier Notizzeilen. **Unbekanntes bleibt unbekannt:** Liter ohne
  `kg_per_liter` sind „–" mit Grund („Liter unbekannt (kg je Liter fehlt)"), ohne Rundung stehen die
  genauen Liter mit „Rundung offen", kg mit fehlendem Teil „≥ n kg", ganz unbekannt „– kg"; die
  Seite summiert nichts (`printLiters`, `printKg`).
  **Dichte:** `src/lib/dayPrintLayout.ts` schätzt die Höhe je Block in mm (wie `notfallLayout`) und
  wählt die erste von fünf Stufen (10 pt … 7 pt, `DAY_PRINT_STEPS`), die auf 268 mm passt (A4, Rand
  10 mm). Passt auch die dichteste nicht, werden zuerst die Notizzeilen gekürzt (bis keine,
  `noteLines`); erst danach kommen die **übrigen Abschnitte auf Blatt 2** mit Hinweis
  „Weitere Posten auf Blatt 2 (…)" auf Seite 1 - weggelassen wird nie etwas. Die Stufe steht als
  `data-print-step` am Druckbild. **Abwiegeliste, skalierte Rezepte und Vorbereitung** stehen in
  `BackzettelPrintExtras.tsx` und kommen nur mit Haken bei „Abwiegeliste & Rezepte mitdrucken"
  (`localStorage` `bakery-backzettel-print-extras`, Vorgabe aus, O8) auf eigene Blätter. Mit der
  heutigen hq-Datei (ohne `lead`) liefert die API für Entwürfe und neue Freigaben schon
  `sheetVersion: 2` - gedruckt wird also ab jetzt der Einseiter; alles außer Brot-Litern und Hefeteig
  steht dann bei den übrigen Abschnitten.
- **Druck der Backliste (Z10 S6):** `components/backzettel/BakeListPrint.tsx` auf
  `/admin/backzettel/[datum]/backen`, eine Seite je Backtag: Posten, Stück, aus welchem Teig, Kästchen;
  Banner, wenn eine Quelle noch Entwurf ist; Nachträge getrennt unten (an der Zeile nur „Nachtrag +n
  (unten, nicht in der Zahl)"); **keine Teigzahlen**. Lange Listen gehen auf zwei Spalten
  (`bakeListPrintLayout`), nicht auf ein zweites Blatt.
- **Geprüft wird mit `page.pdf()`, nie mit einem Screenshot:** Seite im Browser laden,
  `emulateMedia({ media: 'print' })` nur zum Messen, vor `page.pdf({ format: 'A4' })` mit
  `media: null` zurücksetzen, Seiten zählen. Stand S6 (erfundener voller Samstag: 56 Zeilen, 40
  Vorbestellungen, nach der Freigabe 6 Nachträge): Entwurf und freigegebener Zettel mit Nachträgen je
  1 Seite (Stufe 3 bzw. 4), Backliste Sonntag/Dienstag/Samstag je 1 Seite; mit Abwiegeliste 4 Blätter.
- **Druck eines Tages von vor Z10 (Z7, `sheetVersion: 1`):** `components/backzettel/BackzettelPrint.tsx`, eigenes schlichtes HTML, auf dem
  Bildschirm unsichtbar; im Druck verschwinden `.bz-screen` und die App-Hülle. S. 1 Backzettel (alle
  Abschnitte, Gesamt groß, Kästchen, Nachträge, Hinweise; Entwurf mit Banner; knapp gesetzt, bricht nur
  zwischen Abschnitten um - `.bz-section`), S. 2 nur mit Hefeteig/Füllungen (Abwiegeliste + skalierte
  Rezepte, Nachträge über dem freigegebenen Stand), S. 3 nur mit Vorbereitungen. Abgehakte Zeilen
  (`doneAt`) stehen mit ✓ im Kästchen und Namen. **Die Druckregeln schalten Animationen ab** -
  `global.css` blendet `body` und jedes `<section>` ein; ohne `animation: none` startete die beim
  Umschalten auf `display: block` neu und das Blatt käme blass aus dem Drucker.

## Backstube-Tablet (Z6, `/backstube`)

Die Stationsansicht der Backstube, Startseite der Rolle `backstube` nach der PIN. Liegt außerhalb
`/admin` - keine Seitenleiste, deshalb mit eigenem „Abmelden" (`LogoutButton`, auf der Station zurück
zu den Namenskacheln). Rolle prüfen Proxy und RouteGuard (`ROLE_ACCESS`: Inhaber, Backstube).

- **Welcher Tag:** `src/lib/backstubeDay.ts` (rein, getestet). Vor **12 Uhr** (Ortszeit des Tablets,
  `BACKSTUBE_SWITCH_HOUR`) heute - die Schicht ab 2 Uhr läuft -, ab 12 Uhr der nächste
  Produktionstag; ist heute kein Produktionstag, immer der nächste. Der Umschalter „Heute"/„Morgen"
  zeigt den anderen; liegt der nächste Backtag nicht auf morgen (So → Di), heißt der Knopf wie der Tag.
  Springt die Regel um (12 Uhr, Mitternacht), folgt die Ansicht ihr wieder: eine Wahl gilt nur für die
  Regel-Lage, in der sie getroffen wurde - abgeleitet im Render, nicht per Effekt, damit nicht erst der
  alte Tag (am Montag der Ruhetag) geladen wird.
- **Leerlauf: das Tablet bleibt angemeldet.** Eine Stationssitzung auf `/backstube` endet nicht nach
  den 10 min der Station (mit Teig an den Händen tippt niemand), sondern nach
  `NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES` (Vorgabe 720 = 12 h; `idleLimitMs(kind, env, { role, path })` in
  `sessionPolicy.ts`, Pfad bei jeder Prüfung aus `window.location.pathname`) - praktisch also mit der
  12-h-Grenze nach der PIN oder `NEXT_PUBLIC_STATION_LOGOUT_AT`. Das gilt **für jede Rolle**, auch den
  Inhaber per PIN. Jede andere Seite an der Station behält die 10 min.
  **Damit niemand die Inhaber-Rechte eines liegen gelassenen Tablets erbt:** lag `/backstube` in einer
  Stationssitzung, die nicht der Rolle `backstube` gehört, länger als die Stations-Grenze unberührt,
  markiert die nächste Berührung die Sitzung (`unattendedAtBackstube` in `session.tsx`); auf
  `/backstube` geht es weiter, beim Verlassen meldet der `RouteGuard` wegen Inaktivität ab
  (`endUnattended`). **Ein Neuladen ist keine Bedienung:** der Leerlauf-Effekt übernimmt die
  gespeicherte letzte Bedienung, ein Neuladen nach langer Ruhe markiert selbst, und die Markierung steht
  in `localStorage` (`bakery-management-unattended`, Wert = `startedAt` der Sitzung;
  `clearSession()`/neue Anmeldung löschen sie) - sonst setzte ein Wischen zum Aktualisieren alles
  zurück. Ob der Inhaber am Tablet die lange Grenze bekommt, bleibt Owner-Entscheidung.
- **Abhaken** nur an freigegebenen Tagen und nur `inhaber`/`backstube`: ein 72-px-Haken je Zeile,
  sofort gesetzt, bei einem Fehler zurückgenommen mit „Nicht gespeichert: …"; 409
  `not_confirmed`/`confirmed`/`no_config`/`ruhetag`/`line_changed` lädt den Tag neu. Ein Neuladen, das
  während eines laufenden Hakens zurückkommt, wird verworfen (`mutationSeq`) - sonst spränge der Haken
  kurz zurück.
- **Entwurf:** großes Banner „Noch nicht freigegeben", Zahlen grau, gestrichelte Zeilen, keine Haken.
- **Nachträge:** Karte oben mit je einem großen „Gesehen", an der Zeile ein Badge „Nachtrag +N" (offen
  farbig, quittiert „· gesehen"). Nachträge stehen nie im Gesamt.
- **Samstag:** Hefeteig & Füllungen (`components/backstube/BackstubeHefeteig.tsx`) **vor** den Zeilen,
  sonst danach. Dieselben Server-Zahlen wie die Tagesplanung, nur groß.
- **„Vorbereitung heute":** `GET /api/backzettel/:datum/prep` für den nächsten Produktionstag nach
  heute (vorbereitet am Kalender-Vortag ab 14 Uhr); ist der Vortag Ruhetag, steht der Hinweis aus
  `prepDateProvisional` da. Kein Umschalter - die Vorbereitung gilt immer dem nächsten Backtag.
- **Neu geladen** wird alle 60 s (`BACKSTUBE_REFRESH_MS`), bei `focus` und `visibilitychange`.
  Scheitert ein Neuladen, bleibt der letzte Stand stehen mit Hinweis und „Stand von HH:MM".
  **Fehlertexte** über `describeBackstubeError` (`src/lib/backstubeErrors.ts`): kein Server erreicht
  (fetch-Fehler, Zeitüberschreitung, 502-504 ohne JSON-Kennung von Caddy) → „Keine Verbindung zum
  Server – bitte WLAN prüfen."; 4xx mit deutscher API-`message` → diese; sonst ein deutscher Text mit
  Statuscode. `Failed to fetch` oder `HTTP 502: Bad Gateway` erscheinen nie.
- **Kontrast:** feste Farbpaare je Modus in `components/backstube/backstubeColors.ts` (Banner,
  Nachtrag, Haken ≥ 7:1), keine MUI-`*.main`-Texte. Die Seite schaltet das `section`-Einblenden aus
  `global.css` ab, sonst stünde der Zettel nach jedem Tageswechsel 0,8 s blass da.
- **Kein eigener Druck:** gedruckt wird über „Planung & Druck" (`/admin/backzettel/[datum]`, dort
  „Backliste" für die Backliste). Strg+P
  blendet Umschalter, Knöpfe und Reiter (`data-print="hide"`) aus und druckt schwarz auf weiß.
- **„Zur Verwaltung"** (→ `/admin`) nur mit persönlicher Sitzung; das Tablet an der Station braucht ihn
  nicht.

## Tests

- API-Rechnung: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/backzettel`
  (`backzettelCore`, `backzettelDay`, `backzettelConfig`, `backzettelBaseEdit`, `backzettelReference`;
  synthetische Fixtures in `tests/fixtures/backzettel.synthetic.js` und
  `backzettel-grundmengen.synthetic.js`).
- API-Integration: `tests/integration/backzettel.test.ts`, `backzettelGrundmengen.test.ts`.
- Verwaltung: `src/lib/backzettel{Api,Format}.spec.ts`, `src/lib/grundmengenApi.spec.ts`,
  `src/lib/backstubeDay.spec.ts`, `src/lib/backstubeErrors.spec.ts`,
  `src/lib/sessionPolicy.spec.ts` + `src/lib/session.spec.tsx` (Leerlauf am Tablet),
  `admin/backzettel/BackzettelOverviewClient.spec.tsx`,
  `admin/backzettel/[datum]/BackzettelDayClient.spec.tsx`,
  `admin/backzettel/grundmengen/GrundmengenClient.spec.tsx`,
  `components/backzettel/BackzettelPrint.spec.tsx`, Z10-Druck: `src/lib/dayPrintLayout.spec.ts`,
  `components/backzettel/{DoughDayPrint,BakeListPrint}.spec.tsx`, Druck-Auswahl in
  `admin/backzettel/[datum]/BackzettelDayClient.v2.spec.tsx`; `app/backstube/BackstubeClient.spec.tsx`,
  `components/backstube/backstubeColors.spec.ts`. Fixtures erfunden: `src/lib/backzettelFixtures.ts`
  (eindeutige Zeilen-IDs je Zeile), `src/lib/grundmengenFixtures.ts`.
