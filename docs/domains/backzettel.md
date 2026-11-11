# Backzettel

Was die Backstube an einem Produktionstag backt: Grundmenge × Saisonfaktor + Vorbestellungen +
CAP-Vorlage + Korrektur, je Posten und Sorte, dazu Hefeteig, Füllungen und Vorbereitung. Stammdaten
in `hq/config/backzettel.yaml` (privat), Rechnung hier. Plan und offene Fragen: `docs/roadmap.md` §5;
die Überarbeitung „Backzettel v2" (Z10) ist dort geplant - dieses Dokument beschreibt den heutigen Stand.

**Code:** Rechnung `apps/bakery-api/src/services/backzettel.core.js`, `backzettel-day.core.js`,
`backzettel-config.core.js`, `backzettel-recipes.core.js`, `backzettel-config.loader.js`,
`backzettel-config.editor.js`, `backzettel-reference.core.js`, `kalender.core.js` +
`kalender.loader.js` (U9); API `src/routes/backzettel.routes.ts`,
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
  Stück/Blech ganzzahlig, Liter/kg/Charge auf 0,01.
- **Einheit `Charge`** (Spezialbrote wie Haferbrot, Hildegard): die Zahl ist ein Chargen-Faktor
  (Anzahl Rezept-Ansätze, „1,12 Charge“), kein Liter. Bruchteile erlaubt wie bei Liter; Bildschirm
  und Druck schreiben „1,12 Charge“. `pieces_per_liter` wirkt dort nicht.
- **Zukauf und Hinweise (`purchased`, `note` je Posten):** `purchased: true` heißt zugekauft
  (Laugenbrezeln, Laugenstangen als Basis der Käsestangen): der Posten bleibt auf dem Zettel, weil
  er aufgelegt bzw. fertig gebacken wird, hat aber keinen Teig (`dough`/`from_dough` dazu lehnt der
  Validator ab). `configCore.itemHint` formuliert den Hinweis einmal („Zukauf – auflegen · mit Käse
  bestreuen“ = Zukauf + `note`); jede Zeile trägt ihn als `hint` (dazu `purchased`, `note`; fehlen
  ohne), die Brot-Tabelle vorn in `row.note`. Planung, Tablet (Zettel, Backliste) und Druck
  (Teigtag-Zettel, Backliste, alter Druck) zeigen ihn fett an der Zeile. Wie Blech/PLU reine
  Anzeige: eine freigegebene Zeile nimmt ihn aus den aktuellen Stammdaten.
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

## Kalender: Feiertage und Schließtage (U9)

Stammdaten in `hq/config/kalender.yaml` (privat), Regeln einmal in `kalender.core.js`
(`dayKind(cfg, date)`); die Quelle hängt den Kalender als `config.calendar` an die Stammdaten, die
Kerne behalten ihre Signaturen. Plan-Kern, Tagesrechnung, API und Druck fragen `isBakeDay` /
`isDoughDay` / `dayKind`, nie mehr `days.includes(Wochentag)`.

- **Grundregel:** gesetzlicher Feiertag (Saarland, `holidaysSaarland` - die Formel steht nur hier,
  `vacation.core.js` nimmt sie von dort) = geschlossen, kein Back- und kein Teigtag. Gilt nur für
  die Jahre, die die Datei unter `feiertage` aufführt; die Liste muss der Formel entsprechen (der
  Validator rechnet nach). Sonst nur, was abweicht (`tage`): `geschlossen`, `wie-sonntag`
  (Grundmengen von Sonntag), `sonderoeffnung` mit `wie` (Grundmengen dieses Wochentags), `teigtag`
  (Laden zu, nur Teig). `datum` oder `von`/`bis` (+ `wochentage`), `notiz` Pflicht, späterer
  Eintrag gewinnt.
- **Kein Kalender, ungültiger Kalender oder ein Jahr ohne Feiertagsliste = der Wochenplan wie vor
  U9** (ein Feiertag ist dann ein normaler Tag) - nie ein erfundener Schließtag. Die API sagt es
  mit `calendarHint` (`calendar_missing`, `calendar_invalid`, `calendar_year_missing`); die
  Planungsseite zeigt den Hinweis.
- **Teigtage überspringen Schließtage:** `resolveDoughDate` zählt nur Tage mit `doughDay`. Fallen
  Fr + Sa aus, macht der Do den Teig für So und Di (Blöcke je Backtag). Liegt der Teig dadurch
  mehr als 3 Tage vor dem Backtag (normal höchstens Sa → Di), warnt der Zettel `dough_day_far`
  („Froster? Sonst im Kalender einen Teigtag eintragen“) - nur wenn der Kalender den Teig
  verschoben hat.
- **Tagestyp `before`** (abgeleitet): letzter offener Teigtag vor einem `geschlossen`en Tag (nicht
  der Ruhetag). `samstag_ersatz`, wenn ein geschlossener Samstag folgt und danach noch ein offener
  Backtag (So) vor dem nächsten Teigtag; sonst `vor_feiertag`, wenn gleich der nächste Tag zu ist.
  Grundmenge dann aus der Spalte `base.vor_feiertag` bzw. `base.samstag_ersatz` des Postens
  (normalisiert als `item.baseSpecial`, nie unter den Wochentagen), sonst die eigene; hat kein
  Posten die Spalte, Warnung `special_base_missing`. Spezialbrot des Ausfalltags (Grundmenge > 0
  nur an dessen Wochentag) steht als Hinweis `closed_day_specials` da - verteilt wird nicht
  automatisch. Ein Posten, der die Spalte des Tages hat (`base.samstag_ersatz` am
  Samstags-Satz-Tag), steht schon mit dieser Menge auf dem Zettel und fehlt im Hinweis
  (vorläufig, Z14: sonst fragte ein gepflegter Samstags-Satz bei jedem Posten „heute oder später
  backen?“).
- **Vorbestellungen an einem geschlossenen Tag** fallen nie still weg: der Zettel des Teigtags davor
  meldet sie (`preorders_on_closed_day` mit Datum und Feiertag). Sonderproduktion (der Tag wird
  Backtag nur mit den Aufträgen) ist geplant, aber noch nicht gebaut (offene Inhaber-Frage).
- **CAP:** Liefervorlage nach dem echten Wochentag, an einem gesetzlichen Feiertag keine (der Markt
  hat zu), auch wenn die Bäckerei offen ist (vorläufig).
- **Anzeige:** `dayKind` an jedem Teigtag-Zettel (`label` „Samstags-Satz“, „Vor Feiertag“, „Wie
  Sonntag“, „Nur Teig (Laden geschlossen)“, `detail` mit Notiz und den geschlossenen Tagen);
  Planungsseite und Tablet als Hinweis über dem Zettel, der Druck im Tagestyp-Rahmen unter dem
  Datum: `label` so groß wie der Rahmen, `detail` dahinter in der Grundschrift (siehe „Druck eines
  Teigtag-Zettels“).
  `computeDay` (v1) trägt `dayKind` nur mit Kalender, damit die v1-Aufnahmen gleich bleiben.
- **Prüfung:** `node apps/bakery-api/scripts/validate-kalender.js <kalender.yaml> [backzettel.yaml]`,
  im hq-CI vendored (`sync-from-website.sh`). Fehlt die Datei, die es auf `main` gab, ist das im
  hq-CI ein Fehler.

## Tagesablauf auf der API (Z3)

- **Stammdaten:** `HQ_BACKZETTEL_CONFIG`, sonst `${HQ_DIR}/config/backzettel.yaml`. Fehlen sie oder
  sind sie ungültig, antwortet `GET /api/backzettel/:datum` mit `status: 'no-config'` und `reasons`,
  Schreibversuche mit 409 `no_config` - **nie** mit geschätzten Mengen. Ein schon freigegebener Tag
  bleibt lesbar. Montag (allgemein: Wochentag nicht in `days`) ist 409 `ruhetag`, ein Feiertag
  oder Schließtag laut Kalender 409 `geschlossen` mit Grund (U9); ein `teigtag` hat einen Zettel.
- **Entwurf wird live gerechnet.** Gespeichert werden nur Saisonfaktor und Korrekturen; eine Korrektur
  ≠ 0 braucht einen Grund. Saisonfaktor- und Korrektur-`PUT` schicken den Wert, auf dem der Editor
  begann (`expectedFactor`, `expected`); weicht der gespeicherte ab, 409 `season_changed` /
  `correction_changed` statt Überschreiben.
- **Freigeben friert ein:** Zeilen, Vorbestellungs-Schnappschuss und - in `computed_snapshot` -
  Hefeteig, Füllungen, Vorbereitung und Hinweise. Eine spätere Änderung an YAML oder Rezepten ändert
  einen freigegebenen Zettel nicht; `configChangedSinceConfirm: true` sagt nur, dass die aktuellen
  Stammdaten jetzt etwas anderes ergäben - beim Teigtag-Zettel (Z10) auch für Teige,
  Maschinen-Streifen, Brot, Brötchen (Bruch) und den Plan (`lead`, `dough_days`: Backtage, Posten,
  die wegziehen, und Posten, die neu auf den Teigtag fallen - außer ein anderer freigegebener Zettel
  trägt sie). Nach jeder Freigabe schreibt die API einen Schnappschuss nach
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
- `prepDate` ist der Kalender-Vortag; ist der selbst Ruhetag (Dienstag) oder laut Kalender
  geschlossen, steht `prepDateProvisional: true` (geschlossen: mit `prepDateReason`) - wer dann
  vorbereitet, ist offen (Q-B2).
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
- **Zwei Haken (Inhaber-Entscheidung O5, 2026-11-08):** „erledigt" auf dem Zettel des Teigtags
  heißt bei Teig für einen späteren Backtag **gemacht**; **gebacken** ist ein eigener Haken je Zeile
  der Backliste (`POST /:backtag/bake/:zeilenId/baked|unbaked`, `inhaber` + `backstube`). Beide sind
  unabhängig - wer bäckt, muss nicht vorher „gemacht" getippt haben. Gebacken geht nur, wenn der
  Zettel der Zeile freigegeben ist (409 `not_confirmed`, wie Abhaken); eine Zeile eines anderen
  Backtags ist 404 `not_on_bake_list`. Für den gebacken-Haken gelten dieselben Regeln wie für
  „erledigt", je Zeile: braucht eine erneute Freigabe mehr, fällt er weg (`clearedBakedTicks`,
  danach `previouslyBaked` „bereits 66 gebacken - noch +5"), weniger oder gleich lässt ihn stehen
  (`ticksAfterConfirm` im Tages-Kern). **Ein Nachtrag wird für sich abgehakt**, nie über seine Zeile
  (`POST /:backtag/bake/deltas/baked { ids }`); gebacken heißt auch gesehen (`deltaBakedUpdate`),
  zurücknehmen lässt „Gesehen" stehen. Wieder öffnen und neu freigeben verwirft die Nachträge (sie
  stehen dann in den Zeilen) - **was davon gebacken war, zählt weiter als gebacken**: Wieder öffnen
  hält die Ofenzahl der gebackenen Nachträge fest (`bakedDeltas`), Entwurf und neue Freigabe
  rechnen sie zur gebackenen Menge der Zeile (`bakedAfterConfirm` im Tages-Kern). Deckt das die
  Zeile, steht der Haken (bleibt bzw. wird gesetzt); sonst „bereits 8 gebacken - noch +70"
  (`previouslyBaked`). Auf dem Tablet bleibt ein gebackener Nachtrag abgehakt und zurücknehmbar,
  wenn danach eine Abbestellung kommt („+8 schon gebacken · nichts zusätzlich zu backen").
  Der Z9-Schnappschuss trägt keinen der Haken.
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
  Samstag nach dem Deploy braucht, trägt vorher die Grundmengen in hq ein. Auch die
  **Abwiegeliste** sagt das: Gewichtsstufe und Posten mit offener Grundmenge tragen
  `isMinimum` („≥ 15 × 500 g", „Zopf gefüllt ≥ 15", ohne bekannte Stück „offen"), ebenso ein
  Einzelstück (`singles[].kgKnown`, „Teig: ≥ 1,25 kg") - dieselben kg, die im `kgKnown` des Teigs
  stecken.
- **Zugabe je Bruch (U3, `bruch.addons: [{ name, g }]`):** Gramm, die je Bruch **auf** das
  Bruchgewicht kommen (Körner zum Vital-/4-Saat-Weckteig: `bruch: { g: 1800, addons: [{ name:
Körnermischung, g: 600 }] }`). Der Kern (`bruchGroups`) rechnet `addons[].g` = Brüche × g je
  Bruch (`gKnown` mit den bekannten Brüchen, „≥“); sie zählen **nicht** zu kg, Liter oder Chargen
  des Teigs - `doughs[].addons` (g je Liter) träfen den ganzen Weckteig. Brüche oder Gramm offen →
  `null` („Menge offen“, nie 0); `g: null` ist eine Lücke (`bruch_addon_g_unknown`), der Teig bleibt
  vollständig. Mitglieder einer Bruch-Gruppe brauchen dieselben Zugaben. Bildschirm, Tablet und
  Druck zeigen `bruchAddonsText`: „2 Bruch × 1.800 g **+ 1,2 kg Körnermischung** – …“ (im Druck
  fett), der hq-Schnappschuss dasselbe in der Brötchen-Zeile.
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
- **Sonderspalten „Vor FT“ / „Sa-Satz“ (Z14)** nach So: `base.vor_feiertag` /
  `base.samstag_ersatz` (Tagestyp `before`, siehe „Kalender“). Hier heißt **kein Eintrag „nicht
  gesetzt“** (Feld leer, Platzhalter „–“; der Zettel nimmt die Wochentags-Menge), nicht 0. Leeren
  entfernt den Schlüssel in hq (`PUT /config/base` mit `weekday: 'vor_feiertag'`, `value: null`); eine
  neue Sorten-Spalte beginnt mit den übrigen Sorten offen (`null`), nie 0, und sind alle Sorten leer,
  verschwindet die Spalte. Keine Referenz, kein Bruch-Hinweis. Im Druckbild stehen beide Spalten
  nach So (immer, auch leer - zum Eintragen von Hand): gesetzt = Zahl, **nicht gesetzt = leeres
  Feld, nie 0**, offene Sorte „offen“, Postenzeile mit Sorten „je Sorte“; eine wartende Änderung
  „7 \* (–)“ (vorher nicht gesetzt) bzw. „\* (6)“ (Eintrag entfernt). Die Kopfzeile erklärt die
  Kürzel („Vor FT = Vor Feiertag, Sa-Satz = Samstags-Satz: leer = nicht gesetzt, es gilt die Menge
  des Wochentags“).
- **Referenzwert grau neben jeder Zelle:** Median der verkauften Stück an den letzten 6 gleichen
  Wochentagen **mit Kassenbericht**, über die `plu`-Liste des Postens. Tage ohne Bericht sind Lücken,
  nicht 0. Er wird **nie** übernommen - nur Information. Umgerechnet mit **demselben Faktor wie der
  Backzettel** (`products[].factor`, Kassennummer = `numeric_id` des hq-Produkts): 1 Stück
  Marmorkuchen = ¼ Kuchen, ein 500-g-Laib = 0,5 l - dann `converted: true` und der Wert steht in der
  Einheit des Postens. Ist eine Kassennummer keinem Produkt des Postens zugeordnet, bleibt es „St."
  (Stück laut Kasse), der Tooltip sagt das. **Brot je Laibgröße:** die Postenzeile zeigt den
  Median des ganzen Postens, jede Größen-Zeile den Median über die Kassennummern der Größe
  (`sizes[].plu`, ein Teil der `plu` des Postens, jede Kassennummer bei genau einer Größe). Ohne
  Kassennummer der Größe (fehlt oder `null` = offen) steht „unbekannt“ - nie 0, nie ein Anteil;
  hat der Posten selbst keine `plu`, bleiben auch die Größen-Zeilen leer. Im Hinweis steht zusätzlich „Rest am Abend Ø"
  (`GET /api/rest/averages`, nur Information, siehe [rest-am-abend.md](rest-am-abend.md)).
- **Drucken:** eigenes Druckbild (`GrundmengenPrint.tsx`, A4 quer, schwarz auf weiß, alle Tage Di–So
  und die Sonderspalten „Vor FT“ / „Sa-Satz“,
  geänderte Werte mit `*` und dem freigegebenen in Klammern, Referenz „≈ n“ klein unter dem Wert,
  bei einer Größe ohne eigene Kassennummer „≈ unbekannt“ wie am Bildschirm, nie leer); das Bildschirm-Raster
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
- **Druck eines Teigtag-Zettels (Z10 S6, überarbeitet U8/Z13, `sheetVersion: 2`):**
  `components/backzettel/DoughDayPrint.tsx`, A4 hoch, schwarz auf weiß (nur Striche und
  Schriftstärke, keine Flächen). Muss **nicht** wie der alte Papierzettel aussehen (Inhaber,
  10.11.); übernommen ist, was dort funktionierte: je Teig ein Block mit der Literzahl, Brötchen
  „für So“ / „für Di“ darunter, ein voller Samstag auf mehreren Blättern. Aufbau:
  1. **Kopf:** Wochentag groß (30 pt), Datum, Stempel „FREIGEGEBEN“ bzw. „ENTWURF – noch nicht
     freigegeben“; darunter gerahmt der **Tagestyp** (`sheetDayTypeText`: „Heute backen + Teig
     für So 29.11. und Di 01.12.“, „Nur Teig für …“, „Backtag ohne Teig“). Der Kalender (U9)
     stellt seinen Tagestyp als eigene Zeile davor (`.dd-daykind`): der Name („Samstags-Satz“,
     „Vor Feiertag“ …) fett in der Größe des Rahmens, dahinter in der Grundschrift die Angaben
     („– danach geschlossen: Fr 25.12. …, Sa 26.12. …“) - nicht mehr in der kleinen Schrift, die
     in der dichtesten Stufe unter 9 pt läge (Z14, vorläufig bis die Bäcker es benutzt haben).
     `firstHeaderMm(s, day)` zählt diese Zeile(n) mit (`dayKindHeadLines`, eine lange Liste von
     Schließtagen bricht um). Darunter Freigabe, Saisonfaktor, „Blatt 1 von n“.
  2. **„Teige heute“ – Liter zuerst:** eine Zeile je Maschinen-Kasten, die Liter groß (24 pt),
     kg, Chargen, Zugaben, für welche Backtage („heute + So + Di“, `boxBakeDaysText`) und ein
     Kästchen „angesetzt“. Hefeteig: „Wasser … L“.
  3. **Je Teig ein Block** in der Reihenfolge der Kästen vom Server, also der Reihenfolge unter
     `doughs:` in hq `config/backzettel.yaml` - **die Arbeitsreihenfolge stellt der Inhaber dort
     ein**. Kopf: Teigname und „12 L · 23,6 kg“ (Liter unbekannt: nur kg). Darunter Brot nach
     Größe (nur die Größen des Blocks als Spalten, Teig-kg klein), Brötchen je Backtag
     chronologisch (`n Bruch` groß, `× g`, Name, Aufteilung mit „+n frei“), Einzelstücke
     („10 je 300 g Flit klein“), Hefeteig-Posten mit einer Zeile **je Sorte** (gefüllter Kranz:
     Name, darunter „3 Nuss“, „1 Mohn“, je mit Kästchen) in zwei Spalten. Zugeordnet wird
     in `doughPrintBlocks` (`dayPrintLayout.ts`) über die Teig-ID der Zeile bzw. die Teile der
     Teige (`doughs[].parts`, auch `from_dough`); was keinem Kasten gehört, steht in einem
     Sammelblock („Weiteres Brot“ - Spezialbrot nach Liter/Charge -, „Weitere Brötchen“,
     „Hefeteig“), nie weggelassen.
  4. **Übrige Abschnitte** (Laugen, Kaffeestückchen, Kuchen …, Reihenfolge `sections:`): Menge
     groß links, Name fett, Hinweis fett darunter, Angaben klein (Vorbestellt, CAP, Blech,
     Korrektur, Nachtrag); ab 6 Zeilen in zwei Spalten unter einer Überschrift.
  5. **Schluss:** Nachträge seit der Freigabe (nie in den Mengen, was sie für Teig und
     Teilmaschine heißen), „Hinweise“, „Offen: …“ (offene Stammdaten und fehlende Teig-Angaben,
     je einmal), Notizzeilen auf dem letzten Blatt (bis zu vier, so viele wie Platz ist).
     Jede Zeile hat ein **Kästchen**; abgehakte Zeilen (`doneAt`) stehen mit ✓ und Kürzel. **Hinweise**
     der Posten („Zukauf – auflegen · mit Käse bestreuen“, `line.hint`) stehen fett an der Zeile -
     in Abschnitten, beim Brot und an Bruch-Gruppen. **Unbekanntes bleibt unbekannt:** Liter ohne
     `kg_per_liter` sind „–" mit Grund („Liter unbekannt (kg je Liter offen)"), ohne Rundung stehen
     die genauen Liter mit „Rundung offen", kg mit fehlendem Teil „≥ n kg", ganz unbekannt „– kg";
     die Seite summiert nichts (`printLiters`, `printKg`). **Wörter überall gleich** (Leiste, Karten,
     Tablet, Druck): eine Stammdaten-Angabe, die fehlt, ist „offen" („Chargengröße offen", „kg je
     Liter offen"); was sich daraus nicht rechnen lässt, ist „unbekannt".
     **Blätter und Dichte:** `dayPrintLayout` schätzt die Höhe je Block in mm (eher zu groß,
     nachgemessen mit `page.pdf()`: 5-10 % über der echten Höhe) und verteilt die Blöcke der Reihe
     nach auf Blätter (`packSheets`, 268 mm nutzbar, Rand 10 mm). **Ein Block wird nie über zwei
     Blätter geteilt** (`break-inside: avoid`, die Grenze liegt zwischen zwei Teigen); nur ein
     Abschnitt, der allein höher als ein Blatt ist, geht unter „… (Forts.)“ weiter, jedes Stück mit
     mindestens 3 Zeilen. Drei Stufen (`SHEET_STEPS`: 11/10/9 pt, Mengen 16/14,5/13 pt, Liter
     24/21/18 pt) - **nie kleiner als 9 pt**, lieber ein Blatt mehr. Gewählt wird die Stufe mit den
     wenigsten Blättern, bei gleicher Zahl die luftigste. Ab Blatt 2 steht oben „Samstag,
     28.11.2026 – Blatt 2 von 3“ (beim Entwurf mit „ENTWURF“). Folge (vorläufig, U8): ein Werktag
     mit vier, fünf Teigen braucht meist zwei Blätter (wie der alte Zettel: Arbeitsblatt + „Weck und
     Flit“), ein voller Samstag drei (grob: Teige + Brot · Brötchen · übrige Abschnitte; wo die Grenzen
     liegen, folgt aus der Reihenfolge der Teige).
     Stufe und Blattzahl stehen als `data-print-step` / `data-print-sheets` am Druckbild, die
     Schätzung je Blatt als `data-print-estimate`. **Platz für später:** Zusatzzeilen je Bruch
     (U3, z. B. Körner je Bruch) gehören als weitere kleine Zeile (`.dd-sub`) unter die Bruch-Zeile
     in `RollsTable` und als eine Zeile mehr in `rollRowsMm`; eine Zugabe je Teig steht schon unter
     dem Teignamen bei „Teige heute“.
     **Abwiegeliste, skalierte Rezepte und Vorbereitung** stehen in `BackzettelPrintExtras.tsx` und
     kommen nur mit Haken bei „Abwiegeliste & Rezepte mitdrucken"
     (`localStorage` `bakery-backzettel-print-extras`, Vorgabe aus, O8) auf eigene Blätter. Mit der
     heutigen hq-Datei (ohne `lead`) liefert die API für Entwürfe und neue Freigaben schon
     `sheetVersion: 2` - gedruckt wird also ab jetzt dieses Druckbild.
- **Druck der Backliste (Z10 S6):** `components/backzettel/BakeListPrint.tsx` auf
  `/admin/backzettel/[datum]/backen`, eine Seite je Backtag: Posten, Stück, aus welchem Teig, Kästchen;
  Banner, wenn eine Quelle noch Entwurf ist; Nachträge getrennt unten (an der Zeile nur „Nachtrag +n
  (unten, nicht in der Zahl)"); **keine Teigzahlen**. Lange Listen gehen auf zwei Spalten
  (`bakeListPrintLayout`), nicht auf ein zweites Blatt.
- **Geprüft wird mit `page.pdf()`, nie mit einem Screenshot:** Seite im Browser laden,
  `emulateMedia({ media: 'print' })` nur zum Messen, vor `page.pdf({ format: 'A4' })` mit
  `media: null` zurücksetzen, Seiten zählen. Jedes Blatt trägt `data-print-estimate` (geschätzte mm),
  die Wurzel `data-print-step` und `data-print-sheets`; die gedruckte Seitenzahl muss gleich
  `data-print-sheets` sein. Stand U8 (Z13), synthetische Instanz aus `make-hq.js --busy-saturday`:
  voller Samstag (47 Zeilen) 3 Seiten in Stufe 0, Mittwoch bis Freitag und Sonntag je 2 Seiten in
  Stufe 0; überall Seiten = geschätzte Blätter, die Schätzung liegt 5-10 % über der gemessenen Höhe.
  **Samstags-Satz (Z14, Tagestyp `before` / `samstag_ersatz`):** druckt wie ein voller Samstag -
  drei Blätter, Tagestyp gerahmt auf Blatt 1, kein Block geteilt. Nachgemessen mit
  `MAKE_HQ_FLAGS=--samstag-ersatz` (`start.sh`; `make-hq.js` schreibt dann die Spalte
  `samstag_ersatz` an jeden Samstags-Posten und einen Kalender mit einem geschlossenen Samstag,
  das Datum des Samstags-Satz-Tags steht als `samstagErsatz` in `hq-info.json`): Fr vor dem
  geschlossenen Sa und Do 24.12.2026 (Fr + Sa Feiertag) je 3 Seiten in Stufe 0 (11 pt), Seiten =
  geschätzte Blätter, Kopf mit Tagestyp 6,5 mm höher als ohne (geschätzt 6,5 mm). Spec-Fixture:
  `samstagsSatzV2Draft` (der volle Samstag am Freitag davor).
  In den Specs: `busySaturdayV2Draft/Confirmed` (`backzettelFixtures.ts`) ist der größte
  Teigtag-Zettel; `dayPrintLayout.spec.ts` prüft Blöcke, Blattaufteilung, „(Forts.)"-Teilung und
  dass kein Blatt über die Seitenhöhe geschätzt wird.
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
- **Reiter „Backen" (O5):** je Zeile eines freigegebenen Zettels ein eigener 72-px-Haken
  **gebacken** (`BackstubeBakeList.tsx`), getrennt von „erledigt" im Reiter „Zettel"; Zeilen eines
  Entwurfs-Zettels (gestrichelt) haben keinen. Darunter „Nachträge (nicht in den Zahlen oben)" je
  Zeile mit eigenem Haken (`bakeDeltaGroups` in `src/lib/backstubeBake.ts`: die große Zahl ist
  `delta.bake` bzw. bei einem später gekommenen Nachtrag `delta.bakeUnbaked`; ein Tippen hakt die
  noch offenen ab bzw. nimmt alle zurück; bei „−3"/„±0" kein Haken). Wie auf dem Zettel sofort
  gesetzt und bei Fehler zurückgenommen; 409/404 laden die Backliste neu, ein Neuladen während
  eines laufenden Hakens wird verworfen. Der **Ausdruck** der Backliste bleibt Papier: ein leeres
  Kästchen je Zeile, unverändert (eine Seite).
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
