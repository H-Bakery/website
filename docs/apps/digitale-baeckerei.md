# Digitale Bäckerei (`apps/bakery-digitale-baeckerei`) - Plan

Status: **P0 und P1 gemergt** (#132, #134, 2026-11-12); **P2 vorbereitet, wartet auf den Inhaber**.
Dieses Dokument ist der Auftrag für die Umsetzung.

Besucher schauen sich die Bäckerei Heusser in 3D an: die Theke mit Vitrine, das Brotregal und die
Regale, voll mit den echten Produkten. Tippen auf ein Produkt zeigt Name und Kurztext (vorerst
ohne Preis, DB8).
**Man läuft nicht herum**: Es gibt feste Blickpunkte, an denen man sich nur leicht umschauen und
zoomen kann. Das Handy ist das Hauptgerät. Später kommen weitere Räume dazu, z. B. die Backstube.

Öffentlich, statisch, unter `https://bäckerei-heusser.de/digitale-baeckerei/` (Unterpfad der
Landingpage auf GitHub Pages). Nicht im Pilot, nicht auf der Box.

## Entscheidungen (mit dem Inhaber, 2026-11-12)

| #   | Entscheidung                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB1 | Name **„Digitale Bäckerei“**, Pfad `/digitale-baeckerei/`, App `bakery-digitale-baeckerei`.                                                                                                                                                                                                            |
| DB2 | **Modell zuerst übernehmen, später vielleicht umziehen.** Quelle ist der fertige Zwilling aus dem Saar LiDAR Explorer. Der Generator bleibt dort, und Verbesserungen am Modell passieren dort. Ob er in die Bäckerei-Repos umzieht, entscheiden wir erst, wenn wir oft am Modell arbeiten (→ Phase 3). |
| DB3 | Drei Blickpunkte: **Theke + Vitrine**, **Brotregal**, **Regale + Kühlschrank**.                                                                                                                                                                                                                        |
| DB4 | Kamera: **fester Standort, leicht umschauen (≈ ±20°) und zoomen**. Kein Laufen, kein freier Orbit.                                                                                                                                                                                                     |
| DB5 | **Start direkt an der Theke**, ohne Fassade: Straße und Nachbarhäuser fehlen im Modell noch. Ein Intro „Blick vom Kreisel“ kommt später (P3).                                                                                                                                                          |
| DB6 | **Echte, aktuelle Produktdaten aus `hq/products`** (Name, Preis, Einheit, Text) statt des Standes im Modell. Die Texte werden vorher in hq überarbeitet (Gesundheitsversprechen).                                                                                                                      |
| DB7 | Später bekommt jedes Produkt ein **eigenes, teilrealistisches 3D-Modell**, das auch die Landingpage nutzen kann (P4).                                                                                                                                                                                  |
| DB8 | **Vorerst keine Preise**, weder auf der Karte noch in der Liste noch im Bild. Produktdaten kommen als Snapshot aus hq, der beim Build entsteht. Der Deploy-Workflow darf hq dafür lesen.                                                                                                               |
| DB9 | Die 3D-Produkte (P4) kommen in ein **eigenes Daten-Repo**, zuerst **nur lokal**: `../produkte-3d` neben `website` und `hq`, ohne Remote.                                                                                                                                                               |

## Quelle: der Zwilling im Explorer

- Code (MIT): `github.com/Open-Kirrberg/saar-lidar-explorer`, Ordner `zones/baeckerei-heusser/`.
  Lokal liegt er unter `../../experiements/saar-lidar-explorer-v2`. Zuerst `README.md`,
  `CLAUDE.md`, `docs/style.md` und `build/README.md` dort lesen.
- Veröffentlichtes Paket: `https://open-kirrberg.github.io/saar-lidar-data/zones/baeckerei-heusser/`
  mit `zone.json`, `built/twin.glb` (≈ 3,2 MB, 230 Knoten, ≈ 152 k Dreiecke) und
  `built/catalogue.json`.
- GLB-Format: `EXT_meshopt_compression`, `KHR_mesh_quantization`, `KHR_materials_unlit`. Das Licht
  steckt fest in den Vertex-Farben (`COLOR_0`), die Szene braucht also **keine Lichter**.
  Renderer-Einstellungen (Farbraum, Tone-Mapping) 1:1 aus dem Explorer übernehmen
  (`app/src/zones/runtime/gltfZone.ts`), sonst stimmen die Farben nicht.
- Koordinaten: Zonen-Rahmen des Explorers, `x` = Ost, `y` = Höhe in m ü. NHN (≈ 244 im Laden),
  `z` = −Nord. Werte so übernehmen, nicht umrechnen.
- Knotennamen sind Katalog-IDs: `theke/vitrine/ebene-1`, `brotregal/ebene-3`,
  `gitterregal/…`, `getraenkekuehlschrank/…`, `fassade/…`, `umgebung/…`.
- **Produkte:** Jeder belegte Platz ist ein Knoten `produkt/<slot>` mit `extras.product` (die
  hq-Produkt-ID ohne Nummer, z. B. `kornbrot-500g`) und `extras.fills`. Ein Knoten
  `produkt/<slot>@<fill>` ist die Variante für einen anderen Zustand. Knoten mit `extras.ware`
  sind neutrale Waren (Gläser, Dosen) ohne eigene Karte. Im MVP öffnet ein Tipp darauf **keine**
  Karte (auch keine „Regal-Karte“ - ob es die geben soll, ist eine offene Frage an den Inhaber).
  `catalogue.json` → `products[<id>]` liefert `name_de`, `short_de`, `info_de`, `category`,
  `price_eur`, `sale_unit` mit dem Stand des letzten Imports im Explorer. **Die App lädt
  `catalogue.json` nicht** (er trägt Preise): Die Zuordnung Platz → Produkt (die Belegung) liest
  `sync-model` direkt aus den `extras` des GLB, die Texte kommen aus hq (DB6, Abschnitt
  Produktdaten).
- **Stand des Modells am gesperrten Commit:** hq-Produkte liegen nur auf der Theke (Vitrine,
  Brezelständer) und im Brotregal. Dosenregal, Getränkekühlschrank, Gitterregal und Würfelregal
  tragen ausschließlich neutrale Ware (`extras.ware`) - der Blickpunkt „Regale“ hat darum keine
  Produktkarten, und seine Liste „Alles hier“ sagt das ehrlich („Für diesen Bereich gibt es noch
  keine Produktinfos.“).
- Zustände: `fills.default = "morgens"` (volle Auslage) und `feierabend` (leer). Die App zeigt
  nur **Morgens**: Knoten ausblenden, deren `extras.fills` `morgens` nicht enthält.
- Die Führung des Explorers (`catalogue/tour.json`) lieferte nur Startwerte für die Kamera; ihr
  Theke-Standort liegt hinter der Schaufensterscheibe. Die gültigen Werte aller drei Blickpunkte
  sind am echten Modell bestimmt und stehen in `src/config/raeume.ts` (Standorte im Kundenbereich
  vor der Theke). Gitterregal und Würfelregal stehen nicht bei den anderen Regalen: Das Gitterregal
  gehört zum Blickpunkt „Theke“, das Würfelregal zu „Brotregal“.
- Übernehmbarer Code (MIT, gleicher Urheber, Herkunft im Dateikopf nennen):
  `app/src/zones/runtime/twinPick.ts` (Picking, ≈ 44-px-Proxies für kleine Produkte auf Touch),
  `twinInteract.ts` (Hover/Tap-Highlight), `twinUi.ts` (Infokarte).

### Rechte und Datenschutz

- Name, Schriftzug, Produkttexte und Preise im Modell gehören der Bäckerei. Sie sind dort mit
  Zustimmung der Inhaber gezeigt (ADR 0044 im Explorer) und **nicht** MIT-lizenziert. Gelände und
  Gebäude außen: © GeoBasis-DE/LVGL-SL (2026), dl-de/by-2-0. Straßen: © OpenStreetMap-Mitwirkende,
  ODbL. Diese Quellen nennt die App unter „Quellen“, solange durch die Fenster etwas vom Außenraum
  zu sehen ist.
- **Das Modell wird nicht in dieses öffentliche Repo eingecheckt**, `catalogue.json` gar nicht
  erst geladen. Echte Preise gehören nicht in `website`. `sync-model` lädt das GLB beim Bauen
  (Ordner ist git-ignoriert) und löscht dort alles, was nicht im Lock steht. Tests, e2e und CI
  nutzen ein **synthetisches** Mini-GLB und einen synthetischen Produkt-Snapshot mit erfundenen
  Produkten (`DIGITALE_BAECKEREI_FIXTURE=1`).
- Kein Tracking, keine Cookies, kein Gerätespeicher (`localStorage`), keine Fremd-Fonts. Keine
  Personen, keine Fotos von Dritten.

## Produktdaten (DB6)

- **Snapshot (DB8):** Das Skript `sync-products` liest beim Build `hq/products/*.md`
  (`HQ_PRODUCTS_DIR`) und schreibt die nötigen Felder **ohne Preise** (ID, Name, Kategorie, Einheit,
  Kurztext, Text) nach `public/data/products.snapshot.json` (git-ignoriert) - nur für Produkte, die
  im Modell auf einem Platz liegen (heute 48 von 103). Die App liest nur diesen Snapshot.
- Der Leser für `hq/products/*.md` steht einmal in der Lib `libs/shared/hq-products`
  (`@bakery/shared/hq-products`); Landingpage (`src/lib/products.ts`, `scripts/generate-sitemap.js`)
  und `sync-products` nutzen ihn.
- **Einheit** = das hq-Feld `weight` (`750g` → „750 g“). Heute hat kein hq-Produkt dieses Feld,
  die Karten zeigen also keine Einheit - sie wird nicht erfunden.
- Zuordnung: `extras.product` im Modell = die hq-ID ohne Nummer (`1-kornbrot-500g.md` →
  `kornbrot-500g`). Zeigt das Modell ein Produkt, das es in hq nicht (mehr) gibt, bleibt es
  sichtbar, aber ohne Karte, und der Build meldet es.
- **Preisschilder im Modell:** Auf den zwei unteren Brotebenen sind Preiskarten mit dem alten
  Preisstand ins Modell gebacken (Materialien `preiskarte` / `preisschrift` in den
  `produkt/*`-Knoten, 56 Primitive mit 7 669 Eckpunkten). Vorerst gibt es keine Preise (DB8), also
  **nimmt `sync-model` sie aus der Datei, bevor sie ausgeliefert wird** (`scripts/glb-bereinigen.js`,
  nur Node-Bordmittel): Die Primitive fliegen aus den Meshes; Accessors, BufferViews und Materialien,
  die danach niemand mehr braucht, werden entfernt und neu durchgezählt, ihre (meshopt-komprimierten)
  Bytes aus dem BIN-Teil geschnitten. Was übrig bleibt, ist dekodiert Byte für Byte dieselbe
  Geometrie. Dazu fallen die `extras` weg, die nur der Generator braucht (`source`, `sigma_m`,
  `confidence`). `model.lock.json` trägt dafür zwei Prüfsummen: die der Quelle und unter
  `ausgeliefert` die der bereinigten Datei (3 237 272 → 3 127 052 Bytes) - so lässt sich belegen, was
  der Deploy ausliefert. `preiskarten.ts` in der App bleibt als zweite Sicherung.
  Rest: Die Dreiecks-Indizes aller Primitive liegen in **einer** gemeinsamen komprimierten
  BufferView; die Indizes der Preisschrift stehen dort weiter als Zahlenfolge, aber ohne Eckpunkte -
  daraus lässt sich keine Schrift mehr bilden.
- **CI (`ci.yml`)** baut und testet diese App nur mit dem synthetischen Fixture
  (`DIGITALE_BAECKEREI_FIXTURE=1`): kein Download, kein hq, das echte Modell landet in keinem
  Artefakt.
- **Deploy:** Der Deploy-Workflow liest `hq/products` mit einem Deploy-Key, der nur lesen darf
  (Zustimmung des Inhabers 2026-11-12; Abschnitt „Deploy“). Ohne hq bricht der Build dieser App ab,
  statt Mocks zu zeigen. Die Landingpage baut dort weiter aus ihren Mock-Produkten.
- Welches Produkt wo liegt (die Belegung), kommt weiter aus dem Explorer: `sync-model` leitet
  `public/data/belegung.json` (git-ignoriert) aus dem geprüften GLB ab. Neue Produkte erscheinen
  im Regal erst mit einer neuen Belegung dort oder mit P4.

## Aufbau

Eine eigenständige statische Next-App, aufgebaut wie `apps/bakery-partybrezel`: Next App Router,
`output: 'export'`, React 18, MUI 5, kein `withNx()`, keine `@bakery/*`-Libs außer bei echtem
Bedarf. Die 3D-Szene benutzt direkt `three` (im Repo schon vorhanden, siehe Partybrezel), ohne
react-three-fiber (das bräuchte React 19). Sie läuft in einer Client-Komponente, die per
`dynamic(..., { ssr: false })` geladen wird. Den Meshopt-Decoder liefert `three`
(`three/examples/jsm/libs/meshopt_decoder.module.js`).

```
apps/bakery-digitale-baeckerei/
  scripts/sync-model.mjs     GLB laden, prüfen, Preisschilder entfernen, nach public/model/; Belegung nach public/data/
  scripts/sync-products.mjs  hq lesen, Snapshot ohne Preise nach public/data/ (beides git-ignoriert)
  model.lock.json            Quelle (Commit des Daten-Repos), sha256 der Quelle und der ausgelieferten Datei, Abrufdatum
  src/config/raeume.ts       Räume → Blickpunkte (eye, look, Grenzen, Hoch-/Querformat, Möbel)
  src/lib/scene/             Laden, Morgens-Filter, Kamera-Rig, Picking, Hervorhebung (aus dem Explorer)
  src/lib/produkte/          Typen, Zuordnung Platz → Produkt, Laden von Snapshot und Belegung
  src/components/            Viewer, Blickpunkt-Leiste, Produkt-Sheet, Liste, Ladebild, Ersatz ohne WebGL
  src/test/fixtures/         synthetisches Mini-GLB + Produkt-Snapshot, Generator
apps/bakery-digitale-baeckerei-e2e/   Playwright (390×844 und Desktop), nur mit dem Fixture
```

- **Sync:** `sync-model.mjs` lädt `twin.glb` an einem **festen Commit** von
  `raw.githubusercontent.com/Open-Kirrberg/saar-lidar-data/<sha>/zones/baeckerei-heusser/built/`,
  prüft die sha256 aus `model.lock.json`, nimmt die Preisschilder heraus, prüft das Ergebnis gegen
  `ausgeliefert` im Lock und bricht bei jeder Abweichung ab. Ein neues Modell übernimmt man bewusst:
  Commit und beide Prüfsummen in `model.lock.json` ändern, das Modell ansehen, dann PR.
  Die Nx-Targets `build` und `serve` hängen von `sync-model` und `sync-products` ab. CI lädt
  nichts herunter, sondern baut mit dem Fixture.
- **Räume als Datenmodell:** `raeume.ts` = `[{ id: 'laden', name, blickpunkte: [...] }]`. Die
  Backstube ist später nur ein weiterer Eintrag mit eigenem Modell, Blickpunkte und UI bleiben.
- **Blickpunkt:** `{ id, name, eye, look, yawDeg: 20, pitchDeg: 12, fovMin, fovMax, portrait?:
{ eye, look, fov, grenzenUm?, yawDeg?, pitchDeg? } }`. Hochformat bekommt eigene Werte, damit
  das ganze Regal ins Bild passt - auch eigene Grenzen um einen anderen Punkt als das Startbild
  (`grenzenUm`): An der Theke darf man im schmalen Bild rund 60° nach rechts schwenken (bis zum
  türseitigen Ende der Vitrine), nach links bleibt es bei rund 20°.
- **Kamera-Rig:** Die Position bleibt fest. Ziehen dreht innerhalb der Grenzen und federt an den
  Rändern weich zurück. Pinch/Mausrad verändert die Brennweite (FOV) statt der Position, sonst
  fliegt man in die Regale. Doppeltipp auf ein Produkt zoomt dorthin, der nächste Doppeltipp
  zoomt zurück zur Startweite. Ein Wechsel des Blickpunkts gleitet ≈ 0,8 s; bei
  `prefers-reduced-motion` wird geschnitten.
- **Leistung:** Pixel-Ratio höchstens 2, Rendern nur bei Bewegung oder Änderung (kein
  Dauer-Loop), Außenraum (`fassade/*`, `umgebung/*`) ausblenden, wo man ihn nicht sieht. Erst
  messen; wenn die Ladezeit über 4G zu lang ist, schneidet das Sync-Skript den Außenraum aus dem
  GLB heraus (gltf-transform mit meshopt).

## Bedienung (Handy zuerst)

- **Laden:** Das Modell steht als `<link rel="preload" as="fetch">` im HTML und lädt parallel zum
  JavaScript. Scheitert das Nachladen des 3D-Codes oder des Modells, zeigt die App den Ladefehler
  auf Deutsch mit „Noch einmal versuchen“ und - wenn die Produktdaten da sind - die Listen aller
  Blickpunkte.
- **Start:** Ein Ladebild (eine gezeichnete Theke als SVG in den Markenfarben - kein Standbild
  des echten Modells, das gehört nicht ins Repo) mit Fortschritt, danach der Flug von der Straße
  zum Blickpunkt „Theke“ (überspringbar, siehe „Stand P3“). Ein kurzer Hinweis „Ziehen zum Umschauen · Tippen für Infos“ verschwindet nach der
  ersten Geste.
- **Blickpunkt-Leiste** unten in Daumenreichweite mit den Chips _Theke_ · _Brotregal_ ·
  _Regale_. Zusätzlich Wischen mit zwei Fingern oder Pfeile am Rand. Auf dem Desktop: Pfeiltasten.
- **Produkt antippen:** Das Produkt wird hervorgehoben, dazu ein Bottom-Sheet (Querformat und
  Desktop: Karte rechts oben) mit Name, Einheit und Kurztext, aufklappbar der lange Text. Die Szene
  bleibt dabei bedienbar: Ein Tipp auf ein anderes Produkt wechselt die Karte, ein Tipp daneben
  (auch auf neutrale Ware oder Möbel) schließt sie; neutrale Ware leuchtet dabei kurz auf. Läge
  das Produkt unter der Karte, dreht der Blick es in den freien Teil des Bildes - in den Grenzen
  des Umschauens, auch nach „Mehr lesen“ und nach dem Drehen des Geräts. Geht das von diesem
  Blickpunkt nicht, sagt die Karte „Von hier aus gerade nicht im Bild.“ Nach einem Tipp bleibt
  der Fokus in der Szene (Pfeiltasten, +/-); aus der Liste geöffnet, bekommt ihn die Karte.
- **Blickpunkt ohne Produktinfos** (heute „Regale“): Bei der Ankunft sagt der Hinweis einmal
  „Hier gibt es noch keine Infos zum Antippen – schau dich einfach um.“ Keine Preise (DB8). **Keine Allergene**, solange die Liste nicht vollständig
  bestätigt ist. Ein Link „Mehr auf der Website“ führt zur Produktseite der Landingpage, falls es
  sie gibt.
- **Liste „Alles hier“** je Blickpunkt: alle Produkte dieses Blickpunkts als Liste (Name, Einheit).
  Tippen in der Liste hebt das Produkt im Bild hervor und öffnet seine Karte. Dieselbe Liste dient
  als **Ersatz ohne WebGL** (alle Blickpunkte untereinander) und steht für Screenreader unsichtbar
  neben der laufenden 3D-Ansicht.
- Deutsch in der Du-Form wie die Texte im Modell. Die Farben stammen aus der Markenpalette
  (`docs/brand-identity.md`). Dark Mode gilt nur für die Bedienelemente, die Szene bleibt hell.

## Bekannte Schwächen nach P1

Bewusst nicht in P1 behoben (Stand nach dem Review von PR #134). Erledigt seither: Die Preisschilder
stecken nicht mehr als Geometrie in der ausgelieferten `twin.glb` (P2, siehe „Preisschilder im
Modell“).

- **Brotregal:** Die unterste Brotreihe und die Körbe sind von der Kundenseite teils von Kasse,
  Tüten und Aufstellern verdeckt; diese Produkte erreicht man über die Liste „Alles hier“.
- **Karte verdeckt die Leiste:** Im Hochformat liegen Chips, „Alles hier“ und „Quellen“ unter der
  offenen Karte (die Pfeile bleiben frei), im Querformat der rechte Pfeil und „Alles hier“.
- **Pfeile und Hinweis liegen über Produkten:** Die Pfeile am Rand und der Hinweis beim Start
  verdecken einzelne Produkte, bis man schwenkt bzw. das erste Mal zieht.
- **Karte schließt per Wischen nur am Griff** oben, nicht auf dem Text.
- **Ersatz ohne WebGL** zeigt Name und Kurztext, aber weder den langen Text noch den Link zur
  Produktseite.
- **Die Regel „Knotenname → Platz“ steht dreimal** (`scripts/belegung.js`, `treffer.ts`,
  `createViewer.ts`) mit unterschiedlichem Vorrang von Name und `extras.id`; heute sind beide gleich.
- **Schwenk zur Auswahl** wird aus der Pose mitten in einer laufenden Fahrt berechnet; er führt
  danach nach, kann aber einen Umweg machen.
- **Unter etwa 16 Bildern/s** laufen die Fahrten in Zeitlupe (längster Zeitschritt 64 ms) und
  sperren so lange das Umschauen.
- **Links „Mehr auf der Website“** stimmen nur, solange die Landingpage dieselben Produktnummern
  baut wie hq (heute aus Mocks mit denselben Nummern); nichts erzwingt das.
- **Echtes Handy ungeprüft:** Pinch, Zwei-Finger-Wischen, die Zurück-Geste von iOS am Bildrand,
  Safari überhaupt - alles nur in Chromium emuliert.
- **Das Modell wird auch ohne WebGL 2 vorgeladen:** Das `<link rel="preload">` steht fest im HTML
  und weiß nichts vom Gerät. Wer den Ersatz ohne 3D sieht, lädt die ≈ 3,1 MB trotzdem.
- **Die Tür des Getränkekühlschranks ist undurchsichtig** (Modell); die Flaschen dahinter sieht
  man nicht.
- **Der Fortschrittsbalken** rechnet mit der Größe des echten Modells aus `model.lock.json`; im
  Fixture-Modus springt er darum von knapp 2 % auf fertig.

## Deploy

`deploy-to-github-pages.yml` (Push auf `main` oder von Hand) veröffentlicht Landingpage und diese App
zusammen. **Im Workflow selbst ungetestet**, bis das Secret angelegt ist - lokal sind dieselben
Befehle in derselben Reihenfolge gelaufen (ohne Secret und ohne den hq-Checkout).

1. **Secret da?** Fehlt `HQ_DEPLOY_KEY` oder ist es leer, bricht der Lauf als Erstes mit einer
   deutschen Meldung ab. Es gibt keinen Rückfall auf Mocks und keinen Deploy ohne den Unterpfad.
2. **Landingpage bauen** wie bisher - hq ist in diesem Schritt noch nicht ausgecheckt, sie baut also
   aus `src/mocks/products` (siehe unten).
3. **hq auschecken:** `H-Bakery/hq` nach `hq/`, nur der Ordner `products/` (Sparse-Checkout ohne
   Cone-Modus, also auch keine Dateien aus der Wurzel), `fetch-depth: 1`,
   `persist-credentials: false`, mit dem Deploy-Key aus dem Environment `pages-deploy` (nur Branch
   `main`). Ein Schritt danach bricht ab, wenn in `hq/` mehr als `products/` liegt. Ins Log kommt nur
   die Anzahl der Dateien.
4. **App bauen:** `HQ_PRODUCTS_DIR=$GITHUB_WORKSPACE/hq/products`,
   `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei`, ohne Nx-Cache, nie mit
   `DIGITALE_BAECKEREI_FIXTURE` (eigener Schritt, der sonst abbricht).
5. **Wächter** `scripts/pruefe-export.mjs` (Logik und Specs: `export-pruefung.js`): bricht ab, wenn
   `out/model/twin.glb` nicht genau die bereinigte Datei aus dem Lock ist (`ausgeliefert.sha256`),
   wenn noch ein Preisschild darin steckt, wenn in `model/` oder `data/` etwas Fremdes liegt, wenn der
   Snapshot ein Feld außerhalb des Vertrags hat oder ein Produkt nennt, das nicht im Modell liegt,
   wenn irgendwo im Export ein „€“ steht, wenn der Export nicht für den Unterpfad gebaut ist oder der
   Fixture-Schalter gesetzt ist. Gemeldet werden nur Dateinamen und Zahlen.
6. `hq/` löschen, `out/` nach `apps/bakery-landing/out/digitale-baeckerei/` kopieren, dann der Upload
   wie bisher (CNAME, `.nojekyll`). Kein Artefakt mit `hq/` oder `public/data`.

Die Actions dieses Jobs sind auf Commit-SHAs festgelegt (`actions/checkout`, `actions/setup-node`,
`peaceiris/actions-gh-pages`).

- **Die Landingpage bleibt auf den Mock-Produkten.** Mit hq gebaut änderte sich dort Sichtbares
  (lokal verglichen, 117 Seiten): Alle 103 Produktseiten zeigten den echten Produkttext aus hq statt
  des heutigen Standardsatzes (auch als Meta-Beschreibung), die Produktliste bekäme je Karte den
  Kurztext, die Startseite zeigte bei den ausgewählten Produkten den Kurztext statt der Kategorie
  und ein achtes Produkt, und acht Tortenseiten wechselten ein Platzhalterbild. Gleich blieben
  Seiten, Titel, Namen und **Preise** (die stehen heute schon dort, mit denselben Werten).
  Das wären 55 Texte mehr, als die Digitale Bäckerei zeigt, darunter solche, die noch auf
  Gesundheitsversprechen durchgesehen werden - also eine eigene Entscheidung des Inhabers.
- **Links „Mehr auf der Website“:** Im lokalen Gesamt-Export führen alle 48 auf eine vorhandene
  Produktseite mit demselben Produktnamen. Das hält, solange Mock-Produkte und hq dieselben Nummern
  tragen.
- **Statischer Host:** Die App hat nur die eine Seite `/digitale-baeckerei/`; neu laden geht.
  `/digitale-baeckerei` ohne Schrägstrich leitet GitHub Pages um. Ein unbekannter Pfad darunter
  zeigt die 404-Seite der Landingpage.
- **`noindex, nofollow` bleibt**, kein Link von der Landingpage, kein Eintrag in der Sitemap - bis
  zur Abnahme durch den Inhaber am Handy.
- **Service Worker der Landingpage:** `apps/bakery-landing/public/service-worker.js` wird heute
  nirgends registriert. Wer ihn je einschaltet, muss `/digitale-baeckerei/` ausnehmen - sonst legt er
  Modell und Produktdaten auf dem Gerät ab und zeigt alte Texte.

## Anleitung: hq-Lesezugriff für den Deploy

Der Deploy baut die Digitale Bäckerei aus `hq/products`. Dafür braucht er einen Schlüssel, der in hq **nur lesen** darf. Das dauert etwa zehn Minuten. **Erst einrichten, dann den Deploy-PR mergen** - sonst bricht jeder Deploy ab.

1. **Schlüsselpaar erzeugen** - im Terminal, in einem leeren Ordner außerhalb der Repos:

   ```bash
   ssh-keygen -t ed25519 -C "website-deploy-hq-readonly" -f hq_deploy_key -N ""
   ```

   Es entstehen zwei Dateien: `hq_deploy_key` (privat) und `hq_deploy_key.pub` (öffentlich).

2. **Öffentlichen Schlüssel in hq hinterlegen:** GitHub → `H-Bakery/hq` → Settings → Deploy keys → „Add deploy key“. Titel `website-deploy-hq-readonly`, als Key den Inhalt von `hq_deploy_key.pub`. **„Allow write access“ nicht ankreuzen.**
3. **Environment anlegen:** GitHub → `H-Bakery/website` → Settings → Environments → „New environment“ → Name `pages-deploy`. Bei „Deployment branches and tags“ auf „Selected branches and tags“ stellen und nur `main` eintragen.
4. **Privaten Schlüssel als Secret speichern:** in diesem Environment → „Add environment secret“ → Name `HQ_DEPLOY_KEY`, Wert: der ganze Inhalt von `hq_deploy_key`, mit der ersten und der letzten Zeile (`-----BEGIN …` / `-----END …`). Nicht unter „Repository secrets“ ablegen.
5. **Beide Dateien löschen** (`rm hq_deploy_key hq_deploy_key.pub`). Der private Schlüssel liegt dann nur noch bei GitHub. Er gehört in kein Repo, keinen Chat und keine Mail.
6. **Testen** (nach dem Merge des Deploy-PRs): GitHub → `H-Bakery/website` → Actions → „Deploy to GitHub Pages“ → „Run workflow“ auf `main`. Ein paar Minuten später am Handy öffnen: `https://bäckerei-heusser.de/digitale-baeckerei/`.

Gut zu wissen:

- **Warum nur lesend?** Das Secret liegt beim öffentlichen Repo `website`. Ein Deploy-Key ohne Schreibrecht kann in hq nichts ändern und gilt nur für hq, für kein anderes Repo. Der private Schlüssel der vorhandenen GitHub App gehört deshalb **nicht** hierher: Mit ihm ließe sich alles tun, was die App darf.
- **Warum nur `products/`?** Der Deploy holt nur diesen Ordner. Finanzen, Kassenberichte, Rezepte und HACCP kommen nie auf die Build-Maschine. Der Schlüssel selbst könnte ganz hq lesen - darum gilt das Environment nur für `main`.
- **Was ist danach öffentlich?** Aus hq nur Name, Kategorie, Kurztext und Text der 48 Produkte, die im Modell liegen - ohne Preise, ohne Allergene. Dazu das 3D-Modell ohne Preisschilder. Sonst nichts aus hq. Die Landingpage bleibt, wie sie ist.
- **Noch nicht verlinkt:** Die Seite steht auf `noindex` und ist von der Landingpage aus nicht verlinkt. Wer die Adresse kennt, kann sie aber öffnen.
- **Schlüssel tauschen** (bei Verdacht, sonst etwa einmal im Jahr): Schritte 1, 2, 4 und 5 mit einem neuen Paar, dann den alten Deploy-Key in hq löschen und Schritt 6.
- **Wenn das Secret fehlt** (oder der Deploy-Key in hq gelöscht ist): Der Deploy bricht mit einer deutschen Meldung ab und veröffentlicht nichts. Die Seite bleibt auf dem letzten Stand - auch Änderungen an der Landingpage gehen dann erst wieder live, wenn der Schlüssel da ist.

## Phasen

Jede Phase endet mit einem grünen PR. Bei sichtbaren Änderungen kommen Screenshots bei 390 px
und Desktop dazu (lokal, nicht eingecheckt).

| Phase         | Inhalt                                                                                                                                                                                                | Fertig, wenn                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Spike**  | App-Gerüst, `sync-model` + `model.lock.json`, Modell laden, Morgens-Filter, ein Blickpunkt (Theke)                                                                                                    | Die Theke sieht auf dem Handy aus wie im Explorer. Ladezeit und FPS auf einem echten Handy sind im PR notiert. **Erledigt** (PR #132). Ladezeit und FPS sind nur in der Emulation gemessen (4G + CPU 4×: ≈ 4,9 s bis zum ersten Bild, lokal und unkomprimiert; ≈ 26 FPS mit Software-GPU) - auf echtem Handy ungeprüft                                                                                                                              |
| **P1 MVP**    | Produktdaten aus hq, Preisschilder im Modell ausgeblendet, 3 Blickpunkte inkl. Hochformat-Werte, Kamera-Rig, Picking + Bottom-Sheet, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen-Hinweis | Unit-Tests (Blickpunkt-Grenzen, Produkt-Zuordnung, Morgens-Filter) und Playwright bei 390 px (laden, wechseln, antippen → Sheet) mit dem synthetischen Fixture grün. **Erledigt** (PR #134). Geprüft: Unit-Tests und Playwright bei 390 px und Desktop mit dem Fixture. Am echten Modell nur in der Emulation angesehen und gemessen (4G + CPU 4×: ≈ 4,4 s bis zum ersten Bild des Modells; ≈ 26 FPS mit Software-GPU) - auf echtem Handy ungeprüft |
| **P2 Live**   | Produkttexte in hq überarbeitet, hq-Zugriff im Deploy (falls entschieden), Deploy unter `/digitale-baeckerei/`, Abnahme durch den Inhaber am Handy, danach der Link von der Landingpage               | Die Seite ist öffentlich erreichbar, und der Inhaber hat zugestimmt                                                                                                                                                                                                                                                                                                                                                                                 |
| **P3 später** | Intro „Blick vom Kreisel“, Außenraum aus dem GLB schneiden, Backstube als zweiter Raum, Umzug des Generators (DB2), evtl. Feierabend-Umschalter oder „entdeckt x/y“                                   | einzeln entscheiden                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **P4 später** | Echte 3D-Produkte (DB7), zuerst ein Test mit 3 Produkten                                                                                                                                              | eigener Plan, wenn es losgeht                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Stand P3

Gebaut (App-Seite, mit dem heute gesperrten Modell):

- **Flug zum Start „Von der Straße zur Theke“:** Nach dem Laden fliegt die Kamera einmal je
  Seitenaufruf die Straße am Haus entlang, die Stufen hinauf und durch die offene Tür bis genau in
  die Ruhelage des Blickpunkts „Theke“ (7,5 s, ≈ 23 m); dort übernimmt das Rig. Weg und Zeitplan
  stehen je Raum in `raeume.ts` (`intros`), die Rechnung in `src/lib/scene/intro.ts`. Der im
  Explorer geprüfte Weg ist **vorn gekürzt** statt beschleunigt: Sein erstes Stück (20 m in 2,2 s
  knapp über der Straße, dazu ein Schwenk bis ≈ 77°/s) ist am Handy zu hastig - der Flug steigt
  später ein (das erste Bild zeigt schon die Ladenfront) und fliegt das Stück mit ≈ 5 m/s.
- **Überspringen:** Knopf „Überspringen“ unten, jeder Tipp oder Klick ins Bild, Escape, Enter oder
  Leertaste - sofort an die Theke. `?intro=0` startet ohne Flug. Bei `prefers-reduced-motion` gibt
  es ihn gar nicht. Unter „Quellen“ lässt er sich noch einmal ansehen. Unterwegs gibt es weder
  Leiste noch Antippen; der Hinweis „Ziehen zum Umschauen“ kommt erst nach der Ankunft.
- **Leistung:** Der Takt läuft nur während des Flugs, danach wieder 0 Bilder in Ruhe. Schafft das
  Gerät in der ersten Sekunde im Mittel keine 12 Bilder/s, oder wandert der Tab in den Hintergrund,
  schneidet die App an die Theke. Gemessen in der Emulation (Pixel 7, 4G + CPU 4×, Software-GPU;
  **auf echtem Handy ungeprüft**): erstes Bild nach ≈ 4,3 s mit wie ohne Flug, ≈ 28 Bilder/s im
  Flug und ≈ 29 an der Theke (die Software-GPU begrenzt beides). Im Querformat und am Desktop
  schafft die Software-GPU draußen nur ≈ 10 Bilder/s - dort schneidet die App nach der ersten
  Sekunde wie vorgesehen an die Theke.
- **„Entdeckt x von y“:** Die Liste „Alles hier“ nennt unter der Überschrift, wie viele Produkte
  des Ladens schon als Karte offen waren, und setzt einen Haken an diese Zeilen. Nur im
  Arbeitsspeicher - nach dem Neuladen zählt es von vorn.

Nicht gebaut, und warum:

- **Nur beim ersten Besuch zeigen:** Dafür müsste die App sich etwas merken, und sie speichert
  nichts auf dem Gerät. Der Flug läuft darum bei jedem Seitenaufruf und lässt sich überspringen.
  Ob sie sich das merken darf, entscheidet der Inhaber.
- **Langer Flug vom Kreisel:** Im Explorer gebaut, auf dem lokalen Zweig `feat/bh-intro-kreisel`
  (nicht gepusht, nicht veröffentlicht). Sein Weg steht schon in `raeume.ts` (12 s, 84 m); die App
  bietet ihn von selbst an, sobald ein Modell gesperrt ist, das Knoten `umgebung/kreisel/*`
  enthält - vorher fliegt sie den kurzen. Dann die Bilder neu ansehen.
- **Feierabend-Umschalter:** Das gesperrte Modell hat keine `@feierabend`-Varianten - es gäbe
  nichts umzuschalten. Der Filter bleibt `morgens`.
- **Außenraum aus dem GLB schneiden:** Nach den Messungen nicht nötig, und der Flug braucht den
  Außenraum.
- **Backstube als zweiter Raum:** Das Datenmodell ist bereit (`raeume.ts` ist eine Liste), ein
  Modell der Backstube gibt es noch nicht.
- **Umzug des Generators (DB2):** Entscheidung des Inhabers, nicht begonnen.

Schwächen des Flugs: Nur in Chromium mit Software-GPU angesehen (Standbilder bei 390×844, 844×390
und 1440×900), nie als Bewegung auf einem echten Handy. Der Türrahmen zieht beim Eintreten sehr
nah am linken Bildrand vorbei. Der Himmel ist eine Fläche in der Horizontfarbe. Der Flug vom
Kreisel ist in der App an keinem Modell geprüft.

## Später: Intro „Blick vom Kreisel“ (P3)

Ein kurzer, automatischer Kameraflug: Er beginnt am Kreisel, führt die Eckstraße entlang und durch
die Tür bis zum Blickpunkt „Theke“. Er lässt sich überspringen und wird nur beim ersten Besuch
gezeigt. Laufen gibt es auch hier nicht. Dafür muss das Modell im Explorer wachsen: Kreisel und
Straße, die Nachbarhäuser stilisiert auf den LoD2-Grundformen (keine Details privater Häuser), dazu
evtl. neues Video. Google Maps und Street View dienen **nur als Vorlage** zum Nachmodellieren. Weder
Texturen noch 3D-Daten von dort übernehmen (Nutzungsbedingungen, Regel des Explorers). Keine
Personen, keine Kennzeichen.

## Später: echte 3D-Produkte (P4)

Ziel: je Produkt ein teilrealistisches Modell, das man in der Digitalen Bäckerei aus der Nähe drehen
kann (im Produkt-Sheet) und das auch die Produktseiten der Landingpage zeigen.

- **Empfohlener Weg:** Fotogrammetrie der echten Ware, z. B. Object Capture auf dem iPhone, wie
  schon beim Laden. In Blender säubern und auf ≈ 10–30 k Dreiecke und eine 1–2-K-Textur (KTX2 oder
  WebP) reduzieren. Für Torten und Teilchen, die sich schlecht scannen lassen: in Blender modellieren.
  Die stilisierten Formen aus dem Explorer (`products/shapes.py`) bleiben für die vielen Stücke im
  Regal (≈ 570 Stück, Leistung).
- **Zwei Detailstufen:** Im Regal liegen leichte Modelle, in der Nahansicht das Scan-Modell. Ob
  teilrealistische Produkte neben dem stilisierten Laden passen, zuerst mit 3 Produkten testen
  (Brezel, Kornbrot, ein Teilchen).
- **Ablage (DB9):** ≈ 100 Modelle zu je 1–3 MB gehören nicht in `website` oder `hq`, sondern in ein
  eigenes Daten-Repo `../produkte-3d`, vorerst nur lokal und ohne Remote. Wird veröffentlicht,
  bekommt es ein Remote (GitHub, ggf. LFS), und die App lädt die Modelle wie das Laden-Modell über
  einen festen Stand mit Prüfsumme. Rohfotos bleiben außerhalb aller Repos.
  Die Fotos der eigenen Ware gehören der Bäckerei und dürfen veröffentlicht werden.

### Gebaut: Nahansicht in der Karte (nur lokal)

- **Bedienung:** Hat das gewählte Produkt ein Modell, zeigt die Karte den Knopf „In 3D ansehen“. Er
  öffnet die Nahansicht - auf dem Handy bildfüllend, auf dem Desktop als Dialog: das Modell auf
  einem Drehteller (Ziehen dreht, nie von unten; zwei Finger, Mausrad oder +/- zoomen in Grenzen),
  eine langsame Runde beim Öffnen (nicht bei `prefers-reduced-motion`), „Zurück“ oder Escape
  schließt nur die Nahansicht. Kein Modell → kein Knopf, kein Ersatzmodell.
- **Licht:** eigener Renderer mit den Einstellungen der Vorschau des Daten-Repos (`RoomEnvironment`
  0,75 + ein Richtungslicht, sRGB, `NeutralToneMapping`, weicher Kontaktschatten) auf heller
  Bühne - die Modelle sind beleuchtetes PBR, der Laden bleibt unlit. Der Laden behält seinen
  WebGL-Kontext; die Nahansicht legt ihren erst beim Öffnen an (Code und Modell werden erst dann
  geladen) und gibt beim Schließen alles frei.
- **Daten:** `scripts/sync-produkte-3d.mjs` liest beim Bauen genau den Commit aus
  `produkte-3d.lock.json` (`quelle`, `commit`, je Modell `sha256` und `bytes`) mit `git show` aus
  `../produkte-3d` (`PRODUKTE_3D_DIR`), prüft jede Datei und schreibt `public/produkte-3d/<id>.glb`
  und `public/data/produkte-3d.json` (beides git-ignoriert). **Gibt es das Daten-Repo nicht - CI,
  Deploy, andere Rechner -, entsteht ein leerer Index, und die App bietet keine Nahansicht an.** Die
  veröffentlichte Seite hat sie also erst, wenn das Daten-Repo ein Remote bekommt (dann wechselt nur
  die Quelle von `git show` auf eine Adresse mit dem Commit im Pfad). CI und die Playwright-Suite
  bauen mit einem synthetischen Laib für „Testbrot“ und prüfen, dass im Export nur der liegt.
- **Ein neues Modell** kommt so hinein: im Daten-Repo verarbeiten und committen (`npm run process`,
  `check`) → in `produkte-3d.lock.json` `commit` und für jedes Modell `sha256` und `bytes` aus dem
  Manifest eintragen → PR. Die ID ist die hq-ID ohne Nummer; erreichbar ist die Nahansicht nur für
  Produkte, die im Laden-Modell auf einem Platz liegen.
- **Stand des 3-Produkte-Tests** (Commit `a97ed9d` des Daten-Repos, prozedural erzeugte
  Testmodelle, keine Scans): Brezel (Brezelständer), Croissant (Vitrine) und Kornbrot 500 g
  (Brotregal) liegen alle im Laden und sind über ihre Karte erreichbar. Gemessen in der Emulation
  (Pixel 7, 4G + CPU 4×, Software-GPU; **auf echtem Handy ungeprüft**): vom Tipp bis zum ersten Bild
  ≈ 1,4-1,6 s, dabei ≈ 13 kB Code und 214-350 kB Modell; in Ruhe 0 Bilder, nach dem Schließen kein
  zusätzlicher WebGL-Kontext.
- **Passt teilrealistisch neben stilisiert?** Als eigene Ansicht ja: Die Nahansicht steht auf einer
  neutralen Bühne und liest sich wie ein Produktfoto zur Karte. Im Regal nebeneinander nicht - die
  flächigen Produkte des Ladens und die texturierten Modelle sind zwei Bildsprachen, und die Farben
  weichen sichtbar ab (das Croissant im Laden blass, in der Nahansicht kräftig goldbraun). Die zwei
  Detailstufen bleiben also getrennt. Offen bleibt das Urteil an echten Scans - sie bringen ihr
  eigenes, eingebackenes Licht mit.

## Offen (Inhaber)

- Das Secret für den hq-Lesezugriff anlegen: Abschnitt „Anleitung: hq-Lesezugriff für den Deploy“.
  Erst danach den Deploy-PR mergen.
- Soll auch die Landingpage aus hq bauen (echte Produkttexte auf allen 103 Produktseiten)? Heute
  baut sie im Deploy aus den Mock-Produkten.
- Abnahme am Handy vor dem öffentlichen Deploy (P2) und vor dem Link von der Landingpage.
- P4: die echten Produkte für den 3-Produkte-Test fotografieren bzw. scannen.
- Preise: später wieder aufnehmen?
