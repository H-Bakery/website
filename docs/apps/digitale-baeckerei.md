# Digitale Bäckerei (`apps/bakery-digitale-baeckerei`) - Plan

Status: **P0–P4 gemergt und live** unter `/digitale-baeckerei/` (Deploy #137, 2026-11-13; `noindex`,
nicht verlinkt). **Ausbau P5–P8 gemergt** (2026-11-13): weitere Räume (#148, #150), 3D-Bilder für die
Landingpage (#146), Einrichtung des Verkaufsraums (#151); Produktmodelle im Stil DB10 für alle
106 hq-Produkte. **Seit 2026-11-13 veröffentlicht (DB14):** Die Produktmodelle liegen im Laden, die
Landingpage baut aus hq und zeigt die gerenderten Bilder - Quelle ist der Export `hq/produkte-3d/`.
Eine Einrichtung gibt es in hq noch nicht. **Offen beim Inhaber:** siehe „Offen (Inhaber)“.
Dieses Dokument ist der Auftrag für die Umsetzung.

Besucher schauen sich die Bäckerei Heusser in 3D an: die Theke mit Vitrine, das Brotregal und die
Regale, voll mit den echten Produkten. Tippen auf ein Produkt zeigt Name und Kurztext (vorerst
ohne Preis, DB8).
**Man läuft nicht herum**: Es gibt feste Blickpunkte, an denen man sich nur leicht umschauen und
zoomen kann. Das Handy ist das Hauptgerät. Später kommen weitere Räume dazu, z. B. die Backstube.

Öffentlich, statisch, unter `https://bäckerei-heusser.de/digitale-baeckerei/` (Unterpfad der
Landingpage auf GitHub Pages). Nicht im Pilot, nicht auf der Box.

## Entscheidungen (mit dem Inhaber, 2026-11-12)

| #    | Entscheidung                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB1  | Name **„Digitale Bäckerei“**, Pfad `/digitale-baeckerei/`, App `bakery-digitale-baeckerei`.                                                                                                                                                                                                                                                                                                                        |
| DB2  | **Modell zuerst übernehmen, später vielleicht umziehen.** Quelle ist der fertige Zwilling aus dem Saar LiDAR Explorer. Der Generator bleibt dort, und Verbesserungen am Modell passieren dort. Ob er in die Bäckerei-Repos umzieht, entscheiden wir erst, wenn wir oft am Modell arbeiten (→ Phase 3).                                                                                                             |
| DB3  | Drei Blickpunkte: **Theke + Vitrine**, **Brotregal**, **Regale + Kühlschrank**.                                                                                                                                                                                                                                                                                                                                    |
| DB4  | Kamera: **fester Standort, leicht umschauen (≈ ±20°) und zoomen**. Kein Laufen, kein freier Orbit.                                                                                                                                                                                                                                                                                                                 |
| DB5  | **Start direkt an der Theke**, ohne Fassade: Straße und Nachbarhäuser fehlen im Modell noch. Ein Intro „Blick vom Kreisel“ kommt später (P3).                                                                                                                                                                                                                                                                      |
| DB6  | **Echte, aktuelle Produktdaten aus `hq/products`** (Name, Preis, Einheit, Text) statt des Standes im Modell. Die Texte werden vorher in hq überarbeitet (Gesundheitsversprechen).                                                                                                                                                                                                                                  |
| DB7  | Später bekommt jedes Produkt ein **eigenes, teilrealistisches 3D-Modell**, das auch die Landingpage nutzen kann (P4).                                                                                                                                                                                                                                                                                              |
| DB8  | **Vorerst keine Preise**, weder auf der Karte noch in der Liste noch im Bild. Produktdaten kommen als Snapshot aus hq, der beim Build entsteht. Der Deploy-Workflow darf hq dafür lesen.                                                                                                                                                                                                                           |
| DB9  | Die 3D-Produkte (P4) kommen in ein **eigenes Daten-Repo**, zuerst **nur lokal**: `../produkte-3d` neben `website` und `hq`, ohne Remote.                                                                                                                                                                                                                                                                           |
| DB14 | **Veröffentlicht (2026-11-13):** Die Produktmodelle (noch nicht einzeln abgenommen) gehen live - im Laden die der ausgelegten Produkte, auf der Landingpage die Bilder aller 106. Die fertigen Dateien liegen als Export in `hq/produkte-3d/` (kein eigenes Remote für das Daten-Repo); die Landingpage baut aus `hq/products` - mit den Preisen aus hq. DB8 (keine Preise in der Digitalen Bäckerei) gilt weiter. |
| DB10 | **Produkt-Modelle sind prozedural, nicht gescannt** (2026-11-13). Stil „teilrealistisch-digital“: der heutige Comic-Look, etwas realistischer, aber klar als digitale Zeichnung zu erkennen. Scans sind vorerst vom Tisch.                                                                                                                                                                                         |
| DB11 | **Weitere Räume** (2026-11-13). Die App ist für weitere Räume bereit, zuerst die Backstube. Ein Modell der Backstube gibt es noch nicht; gebaut und getestet ist alles an einem synthetischen zweiten Raum. Abschnitt „Weitere Räume (Backstube)“.                                                                                                                                                                 |
| DB12 | **Der Laden ist „einrichtbar“** (2026-11-13). Was in Theke, Brotregal und Regalen liegt, ist Konfiguration und nicht ins Modell gebacken. Die App legt leichte Produkt-Modelle selbst auf die Plätze.                                                                                                                                                                                                              |
| DB13 | **Die Landingpage nutzt Bilder, die aus den 3D-Produkt-Modellen gerendert sind** (2026-11-13).                                                                                                                                                                                                                                                                                                                     |

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
  hq-Produkt-ID ohne Nummer, z. B. `testbrot-500g`) und `extras.fills`. Ein Knoten
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
- Zuordnung: `extras.product` im Modell = die hq-ID ohne Nummer (`1-testbrot-500g.md` →
  `testbrot-500g`). Zeigt das Modell ein Produkt, das es in hq nicht (mehr) gibt, bleibt es
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
  statt Mocks zu zeigen. Die Landingpage baut dort seit DB14 ebenfalls aus hq.
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
  scripts/sync-model.mjs     je Raum: GLB laden, prüfen, Preisschilder entfernen, nach public/model/; Belegung nach public/data/
  scripts/sync-products.mjs  hq lesen, Snapshot ohne Preise nach public/data/ (beides git-ignoriert)
  scripts/sync-rauminfos.mjs Infopunkte der Räume aus hq nach public/data/rauminfos.json (git-ignoriert)
  model.lock.json            je Raum: Quelle (Commit des Daten-Repos), sha256 der Quelle und der ausgelieferten Datei, Abrufdatum
  src/config/raeume.ts       Räume → Blickpunkte (eye, look, Grenzen, Hoch-/Querformat, Möbel), Flüge, Türen
  src/lib/raeume/            welche Räume es gibt (Lock), Raum in der Adresse, Infopunkte
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
- **Räume als Datenmodell:** `raeume.ts` = `[{ id: 'laden', name, modell, blickpunkte: [...] }]`. Die
  Backstube ist später nur ein weiterer Eintrag mit eigenem Modell, Blickpunkte und UI bleiben -
  siehe „Weitere Räume (Backstube)“.
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
  baut wie hq (seit DB14 baut der Deploy beide aus `hq/products`).
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
zusammen.

1. **Secret da?** Fehlt `HQ_DEPLOY_KEY` oder ist es leer, bricht der Lauf als Erstes mit einer
   deutschen Meldung ab. Es gibt keinen Rückfall auf Mocks und keinen Deploy ohne den Unterpfad.
2. **hq auschecken:** `H-Bakery/hq` nach `hq/`, nur die Ordner `products/` und `produkte-3d/`
   (Sparse-Checkout ohne Cone-Modus, also auch keine Dateien aus der Wurzel), `fetch-depth: 1`,
   `persist-credentials: false`, mit dem Deploy-Key aus dem Environment `pages-deploy` (nur Branch
   `main`). Ein Schritt danach bricht ab, wenn in `hq/` mehr liegt oder `hq/produkte-3d` kein Export
   ist (`STAND.json`, `manifest.json`). Ins Log kommt nur die Anzahl der Dateien.
3. **Landingpage bauen** aus `hq/products` (`HQ_PRODUCTS_DIR`) mit den gerenderten Bildern aus dem
   Export (`PRODUKTE_3D_DIR=$GITHUB_WORKSPACE/hq/produkte-3d`). Ein Wächter bricht ab, wenn sie
   still auf die gebündelten Beispielprodukte oder auf „keine Bilder“ zurückgefallen ist.
4. **App bauen:** `HQ_PRODUCTS_DIR=$GITHUB_WORKSPACE/hq/products`,
   `PRODUKTE_3D_DIR=$GITHUB_WORKSPACE/hq/produkte-3d`,
   `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei`, ohne Nx-Cache, nie mit
   `DIGITALE_BAECKEREI_FIXTURE` (eigener Schritt, der sonst abbricht).
5. **Wächter** `scripts/pruefe-export.mjs` (Logik und Specs: `export-pruefung.js`): bricht ab, wenn
   das Modell eines Raums (`out/model/twin.glb`) nicht genau die bereinigte Datei aus dem Lock ist
   (`ausgeliefert.sha256`),
   wenn noch ein Preisschild darin steckt, wenn in `model/` oder `data/` etwas Fremdes liegt, wenn der
   Snapshot ein Feld außerhalb des Vertrags hat oder ein Produkt nennt, das nicht im Modell liegt,
   wenn Belegung oder Infopunkte einen Raum nennen, der nicht im Lock steht, wenn die Infopunkte
   ihren Vertrag nicht einhalten, wenn irgendwo eine Spur der synthetischen Test-Räume liegt,
   wenn irgendwo im Export ein „€“ steht, wenn der Export nicht für den Unterpfad gebaut ist oder der
   Fixture-Schalter gesetzt ist. Er läuft mit `--mit-produkte-3d`: Die 3D-Modelle einzelner Produkte
   müssen zum Index passen und zu Produkten gehören, die in einem Raum liegen; fehlt
   `produkte-3d/_regal.glb`, bricht der Schritt ab. Gemeldet werden nur Dateinamen und Zahlen.
6. `hq/` löschen, `out/` nach `apps/bakery-landing/out/digitale-baeckerei/` kopieren, dann der Upload
   wie bisher (CNAME, `.nojekyll`). Kein Artefakt mit `hq/` oder `public/data`.

Die Actions dieses Jobs sind auf Commit-SHAs festgelegt (`actions/checkout`, `actions/setup-node`,
`peaceiris/actions-gh-pages`).

- **Die Landingpage baut aus hq** (DB14): alle Produkte mit Namen, Texten und Preisen aus
  `hq/products`, für Produkte ohne Foto das gerenderte Bild. Darunter sind Texte, die noch auf
  Gesundheitsversprechen durchgesehen werden (siehe „Offen (Inhaber)“).
- **Links „Mehr auf der Website“** führen auf die Produktseite mit der hq-Nummer; Landingpage und
  App lesen dieselben Dateien.
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

## Weitere Räume (Backstube)

Seit DB11 ist die App für mehrere Räume gebaut. **Heute gibt es nur den Verkaufsraum** - mit nur
ihm im Lock sieht und verhält sich die Seite wie vorher (kein Raumwechsel in der Leiste, dasselbe
HTML). Alles Weitere ist an einem erfundenen zweiten Raum gebaut und getestet (der „Testbackstube“
des Fixtures, vier Kisten als Stationen); eine echte Backstube hat die App noch nie gezeigt.

### Was die App kann

- **Ein Raum = ein Modell.** `model.lock.json` nennt je Raum eine Datei mit eigener Quelle und
  beiden Prüfsummen (Format `bakery-model-lock-v2`, Schlüssel = id des Raums; das alte Format mit
  einem Modell wird weiter gelesen). `sync-model` lädt und bereinigt alle, der Wächter prüft jedes.
  **Ein Raum, der in `raeume.ts` steht, aber nicht im Lock, wird nicht gebaut und nicht gezeigt** -
  es gibt keinen Platzhalter.
- **Raum wechseln:** Gibt es mehr als einen Raum, steht unten in der Leiste ein Knopf („In die
  Backstube“ / „In den Laden“; ab drei Räumen „Raum wechseln“ mit Auswahl). Das Modell des anderen
  Raums wird erst dann geladen (mit Ladebild und Fortschritt), die Szene des alten Raums wird ganz
  abgebaut, man steht am Start-Blickpunkt des neuen. Karte, Liste und Nahansicht gehen zu.
- **Link und „Zurück“:** `…/digitale-baeckerei/?raum=<id>` öffnet einen Raum direkt (der Laden steht
  ohne Parameter da; eine unbekannte id landet im Laden). Jeder Wechsel ist ein Schritt im Verlauf
  des Browsers, „Zurück“ führt in den vorigen Raum. Gespeichert wird nichts.
- **Infopunkte statt Produkte:** Eine Backstube hat Stationen (Ofen, Kneter …). Ein Tipp auf eine
  Station mit Infopunkt öffnet dieselbe Karte wie bei einem Produkt (Titel, Kurztext, „Mehr
  lesen“), die Station wird hervorgehoben; sie steht in „Alles hier“ und im Ersatz ohne WebGL (dort
  stehen alle Räume untereinander). Die Texte kommen aus hq (unten). Ohne Datei gibt es keine
  Infopunkte - erfunden wird nichts.
- **Türen:** Ein Stück des Modells kann in einen anderen Raum führen (`tueren` in `raeume.ts`). Gibt
  es den Zielraum nicht, bleibt die Tür ein Stück Wand.
- **Flug zum Start** gibt es nur in Räumen, die einen haben (`intros`), je Raum einmal je
  Seitenaufruf.

Wie die Daten je Raum fließen (hier hängt sich später DB12, „einrichtbar“, ein):

| Was                 | Quelle                                                             | Datei im Export                       | In der App                                         |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------- |
| Modell              | `model.lock.json` → `raeume.<id>`                                  | `model/<datei>`                       | `raum.modell`, `src/lib/raeume/verfuegbar.ts`      |
| Belegung (Produkte) | `extras` im GLB des Raums (`sync-model`)                           | `data/belegung.json` → `raeume.<id>`  | `belegungVon()` in `src/lib/produkte/zuordnung.ts` |
| Produkttexte        | `hq/products` (`sync-products`), alle Räume zusammen               | `data/products.snapshot.json`         | `eintraegeFuer()`                                  |
| Infopunkte          | `hq/config/digitale-baeckerei/raeume/<id>.yaml` (`sync-rauminfos`) | `data/rauminfos.json` → `raeume.<id>` | `src/lib/raeume/rauminfos.ts`                      |

`DigitaleBaeckerei.tsx` setzt daraus je Raum **eine** Liste je Blickpunkt zusammen (`listen`: erst
die Produkte, dann die Infopunkte, zugeordnet über `moebel` des Blickpunkts). Karte, „Alles hier“,
Ersatz ohne WebGL und der Tipp ins Bild leben alle von dieser einen Stelle.

### Einen Raum ergänzen

Kein Code - drei Einträge, in dieser Reihenfolge:

1. **Modell sperren:** in `model.lock.json` unter `raeume` einen Eintrag mit der id des Raums:

   ```json
   "backstube": {
     "datei": "backstube.glb",
     "source": { "repo": "Open-Kirrberg/saar-lidar-data", "commit": "<40 Hex-Zeichen>",
                 "path": "zones/<zone>/built", "datei": "twin.glb" },
     "fetched": "JJJJ-MM-TT",
     "sha256": "…", "bytes": 0,
     "ausgeliefert": { "sha256": "…", "bytes": 0 }
   }
   ```

   `datei` ist der Name unter `public/model/` (je Raum ein anderer), `source.datei` der Name an der
   Quelle (weglassen, wenn gleich). `sync-model` nennt die Ist-Werte für `ausgeliefert`, wenn sie
   nicht passen. Kennt die Bereinigung den Aufbau des Modells nicht (Texturen, fremde Extensions),
   bricht sie ab.

2. **Raum konfigurieren:** in `src/config/raeume.ts` einen Eintrag in `raeume`: `id` (wie im Lock),
   `name`, `wechsel` („In die Backstube“), `modell` (= `datei` aus dem Lock), `produkte: false`,
   `start` und die `blickpunkte` (Standort, Blickziel, Grenzen, `moebel` = Anfang der Knoten-IDs der
   Stationen, die man von dort sieht). Optional `tueren` und `intros`. Die Kamerawerte am echten
   Modell bestimmen und in allen drei Formaten ansehen (390×844, 844×390, 1440×900). Soll eine Tür
   aus dem Laden in die Backstube führen, bekommt der Laden `tueren: [{ knoten, ziel }]`.

3. **Infopunkte (optional):** in hq die Datei `config/digitale-baeckerei/raeume/<id>.yaml`:

   ```yaml
   infopunkte:
     - knoten: ofen # Anfang der Knoten-ID im Modell: trifft „ofen“ und „ofen/…“
       titel: Der Ofen
       kurz: Ein, zwei Sätze für die Karte.
       text: | # optional - der lange Text hinter „Mehr lesen“
         Mehr dazu, auch in mehreren Absätzen.
   ```

   Erlaubt sind genau diese Felder. `titel` höchstens 80 Zeichen, `kurz` 400, `text` 4000; keine
   Preise („€“ bricht den Build ab). Ein Infopunkt gehört zu dem Blickpunkt, dessen `moebel` zu
   seinem `knoten` passt. Passen zwei Infopunkte auf ein Stück, gewinnt der genauere (`ofen/tuer`
   vor `ofen`). Eine Datei außerhalb des Vertrags bricht den Build ab; die Meldung nennt Datei,
   Stelle und Feld, nie den Text. Gelesen werden nur Dateien von Räumen, die im Lock stehen.
   Der Ordner kommt aus `HQ_DIGITALE_BAECKEREI_DIR`, sonst liegt er neben `HQ_PRODUCTS_DIR`
   (`<hq>/config/digitale-baeckerei`). Auch der Laden kann so Infopunkte bekommen (z. B. für die
   Regale mit neutraler Ware); ein Produkt auf demselben Platz hat Vorrang.

Danach `npx nx build bakery-digitale-baeckerei`, ansehen, PR.

**Für den Deploy fehlt dann noch ein Schritt** (bewusst nicht gebaut, solange es keinen zweiten Raum
gibt): `deploy-to-github-pages.yml` holt aus hq nur `products/` und `produkte-3d/` und bricht ab, wenn mehr da ist. Mit
Infopunkten muss der Sparse-Checkout `config/digitale-baeckerei/raeume/` mitnehmen und der Schritt
danach das erlauben - sonst geht der Raum ohne Infopunkte live (kein Fehler, aber leere Karten gibt
es nicht: Stationen wären dann nicht antippbar).

### Was noch nicht geht

- „Entdeckt x von y“ sagt „im Laden“ - richtig, solange nur der Laden Produkte hat.
- Doppeltipp zoomt nur auf Produkte und Ware, nicht auf Stationen.
- Der Fortschrittsbalken kennt die Größe eines Modells nur aus dem Lock.
- Die Blickpunkte eines neuen Raums stehen in `raeume.ts` - ein Raum ganz ohne PR geht also nicht.
- Auf einem echten Handy ist der Raumwechsel ungeprüft (wie alles andere: nur Chromium, emuliert).

### Was der Inhaber für die Backstube liefern muss

**So ist der Laden entstanden** (nachgesehen im Explorer-Repo, `tools/capture/zones/baeckerei-heusser.toml`
und `zones/baeckerei-heusser/plan/`): nicht aus einem LiDAR-Scan, sondern aus **einem Video** - ein
Rundgang mit der Action-Cam, knapp zwei Minuten, von der Straße durch den Laden. Daraus wurden
Einzelbilder gezogen, Personen und Kennzeichen unkenntlich gemacht und ein grobes 3D-Abbild
gerechnet. Dieses Abbild sieht kein Besucher: Es dient nur zum Abmessen. Der Laden, den man sieht,
ist danach **von Hand im Code nachgebaut** - aus einem Grundriss mit Maßen und einer Liste der Möbel
mit Größe und Standort, dazu Fotos für Farben und Aussehen. Weil ein Video keinen Maßstab hat,
stimmen die Maße des Ladens bisher nur auf etwa ± 11 %; die Messliste mit zehn Bandmaß-Messungen
(`plan/messliste.md`) ist noch offen.

Für die Backstube dasselbe, mit einem Maß von Anfang an:

1. **Zustimmung.** Die Einwilligung der Inhaber gilt bisher für den Laden und außen. Für die
   Backstube braucht es ein kurzes schriftliches Ja (wer, was, ab wann öffentlich).
2. **Ein Video, ein Rundgang** (2-3 Minuten, Handy quer oder Action-Cam, höchste Auflösung):
   langsam und ohne Schwenk-Hektik einmal an den Wänden entlang, jede Station von vorn und schräg
   von beiden Seiten, einmal Boden bis Decke, und der Weg von der Tür zum Laden. Alle Lampen an,
   kein Gegenlicht aus dem Fenster. Am besten nach dem Putzen, wenn niemand arbeitet.
3. **Fotos:** je Station eines von vorn und eines schräg (ganze Station im Bild), dazu je eine
   Aufnahme jeder Wand.
4. **Maße** (Bandmaß, 15 Minuten): Länge, Breite und Höhe des Raums; Türen und Fenster (Breite,
   Höhe, Abstand zur Ecke); je Station Breite × Tiefe × Höhe und der Abstand zu zwei Wänden.
   **Eine lange Strecke genügt für den Maßstab** - sie fehlt beim Laden bis heute.
5. **Stationen benennen:** eine Liste, was gezeigt werden soll, mit ein bis zwei Sätzen je Station
   (das werden die Karten), z. B. Ofen, Kneter, Teigteiler/Ausrollmaschine, Gärschrank, Arbeitstisch,
   Kühlung, Mehllager, Spüle. Was nicht auf der Liste steht, wird Kulisse ohne Karte.

**Datenschutz - vor dem Filmen prüfen:**

- **Keine Personen**, auch nicht gespiegelt (Ofentür, Edelstahl, Fenster).
- **Nichts Lesbares:** keine Rezepte, Zettel, Backzettel, Bestell- oder Lieferscheine, Dienstpläne,
  Telefonlisten, Kalender; keine Lieferantennamen auf Säcken, Kartons und Eimern (wegdrehen oder
  wegräumen); Bildschirme und Displays aus.
- **Aufgeräumte Flächen:** Was auf dem Tisch liegt, landet im Bild - nur stehen lassen, was man
  zeigen möchte. Keine privaten Sachen (Jacken, Taschen, Handys).
- Video, Fotos und Maße **nicht in ein Repo und nicht in einen Chat** legen, sondern wie beim Laden
  in den privaten Ordner neben dem Explorer. Öffentlich wird nur das nachgebaute Modell.

Danach, im Explorer: Der Generator baut heute nur den Verkaufsraum (und außen den Eingang der
Backstube mit geschlossener Tür). Für die Backstube braucht er dort neuen Code und einen neuen Stand
des Modells; erst dann folgen hier die drei Schritte aus „Einen Raum ergänzen“.

## Einrichtung des Verkaufsraums

Seit DB12 ist der Laden „einrichtbar“: Was in Theke, Brotregal und Regalen liegt, steht in einer
Datei in hq, und die App legt leichte Produkt-Modelle selbst auf die Plätze. **Live ändert sich
damit noch nichts** - der Deploy hat weder die Datei noch die Regal-Modelle und zeigt weiter die
Ware, die im Modell des Ladens steckt (unten: „Was das Veröffentlichen braucht“).

### Die Datei

`hq/config/digitale-baeckerei/einrichtung.yaml` (der Ordner kommt aus `HQ_DIGITALE_BAECKEREI_DIR`,
sonst liegt er neben `HQ_PRODUCTS_DIR` - wie bei den Infopunkten):

```yaml
raeume:
  laden: # id des Raums
    brotregal/ebene-1/platz-01: # Platz: Name des Knotens im Modell ohne „produkt/“
      produkt: testbrot-500g # hq-ID ohne Nummer
      anzahl: 2
    theke/vitrine/ebene-1/platz-02: leer
```

- Ein Platz, der **nicht** in der Datei steht, bleibt wie im Modell. Ohne Datei gilt überall das
  Modell - genau wie vorher.
- `leer`: Der Platz zeigt nichts und steht in keiner Liste.
- Auch Plätze mit neutraler Ware (Dosen, Gläser, Flaschen) lassen sich belegen oder leeren. Plätze,
  die im Modell leer sind, kennt die App nicht.
- Erlaubt sind genau diese Felder; `anzahl` ist eine ganze Zahl von 1 bis 500. Keine Preise, keine
  Texte. Kommentare sind erlaubt und bleiben beim Einrichten erhalten.
- **Ein unbekannter Raum, Platz oder ein Produkt, das es in hq nicht gibt (oder das nicht verfügbar
  ist), bricht den Build ab** - die Meldung nennt Raum, Platz und ID.

### Wie die Daten fließen

1. `sync-model` leitet aus dem GLB die Belegung ab (wie bisher) und aus der Geometrie der Ware den
   **Rahmen jedes Platzes** (`scripts/plaetze.js`): Mitte der Standfläche, rechts/oben/vorn, Breite,
   Tiefe, lichte Höhe. Das Modell bringt diese Rahmen nicht mit (die Plätze des Explorers sind nicht
   veröffentlicht); am echten Modell treffen sie die Plätze des Explorers auf ≈ 0,1° in der Richtung,
   ≈ 0,3° in der Neigung und wenige Millimeter im Brotregal. Dann legt es die Einrichtung darüber
   (`scripts/einrichtung.js`, der eine Leser und Schreiber). Ergebnis ist **`data/belegung.json`
   (Version 3)** - weiter das Einzige, was die App zur Belegung liest:
   `slots` (Modell + Einrichtung; eingerichtete tragen `quelle: "einrichtung"`), `leer`, `plaetze`.
2. `sync-products` schreibt den Snapshot für die Produkte dieser Belegung.
3. `sync-produkte-3d` liest das Manifest des Daten-Repos (Version 1 oder 2) am Commit aus
   `produkte-3d.lock.json` und holt **nur für Produkte, die in einem Raum liegen** die Nahansicht
   und das Regal-Modell (`regal.glb`: ≤ 250 Dreiecke, unlit, Vertex-Farben; geprüft gegen die
   Prüfsumme im Manifest und gegen den Vertrag). **Das Lock nennt kein Produkt** (dieses Repo ist
   öffentlich): nur `quelle`, `commit` und die Prüfsumme von `manifest.json`; die Prüfsummen der
   einzelnen Dateien stehen im Manifest und werden beim Sync dagegen geprüft. Alle Regal-Modelle
   kommen in **eine** Datei
   `produkte-3d/_regal.glb` (48 Modelle ≈ 210 kB, gzip ≈ 140 kB - eine Anfrage statt 48); der Index
   `data/produkte-3d.json` nennt sie unter `regal`. Ohne Daten-Repo: der leere Index von vorher.
   Das Skript meldet, wo eine Stückzahl nicht passt („nur 10 von 12 passen“, „zu groß für den
   Platz“) und wo ein eingerichtetes Produkt kein Regal-Modell hat.
4. Die Szene (`src/lib/scene/einrichtung.ts`) lädt das Paket zusammen mit dem Modell des Raums und
   richtet vor dem ersten Bild ein - es springt nichts um. **Das erste Bild wartet darauf aber nicht
   beliebig:** Ist das Modell da, bekommen Belegung und Paket noch 1,5 s (`EINRICHTUNG_FRIST_MS`);
   danach steht der Laden mit der Ware seines Modells und wird eingerichtet, sobald die Daten
   kommen. Eine Anfrage, die hängt, gilt nach 8 s als gescheitert (`DATEN_ZEIT_MS`,
   `MODELL_INDEX_ZEIT_MS`) - mit denselben Meldungen wie ein Netzfehler.

### Was man sieht

- **Gibt es Regal-Modelle, liegen sie auf allen Plätzen ihres Produkts** - nicht nur auf den
  geänderten. Entschieden an Bildern des echten Ladens (drei Blickpunkte, Hoch-, Querformat,
  Desktop): Die Regal-Modelle sind anders geformt als die Formen des Modells; gemischt stünden zwei
  Bildsprachen im selben Regal. Größen und Lagen passen: Die Stücke liegen an den Stellen der
  bisherigen Ware, nichts schwebt oder steckt im Regal. Die Farben sind seit dem Stand `a57b2cd`
  des Daten-Repos warm und passen zum Laden. **Offen für die Abnahme der Modelle im Daten-Repo:**
  Gebäck hinter dem Vitrinenglas ist noch blass, und die Torten zeigen in der Mitte einen
  graubraunen Fleck. Beides steckt in den Regal-Modellen (ihr Licht ist eingebacken), nicht in der
  App.
- **Wie die Stücke liegen** (`scripts/auslage.js`, nach `fill.layout` und `auslage.py` des
  Explorers; dieselbe Rechnung für Szene, Build-Meldung und Werkzeug): in Reihen von vorn, je Reihe
  gleichmäßig verteilt; passt ein Stück nur längs, wird es gedreht (Baguettes stehen im schmalen
  Fach nebeneinander); ein einzelnes Brot rutscht auf dem geneigten Boden nach vorn; in den Körben
  gehäuft in bis zu drei Lagen (dort bis 10 % kleiner); am Brezelständer hängt je Haken ein Stück.
  Jedes Stück weicht ein wenig in Lage und Drehung ab - fest aus dem Namen des Platzes, nie aus dem
  Zufall. Tabletts aus dem Modell bleiben liegen.
- **Passt die Stückzahl nicht, liegen so viele wie passen** - der Build meldet es. Skaliert wird
  nicht (außer in den Körben).
- **Hat das Produkt kein Regal-Modell** (oder passt kein einziges Stück): Liegt es im Modell auf
  diesem Platz, bleibt die Ware des Modells. Sonst bleibt der Platz **im Bild leer**; das Produkt
  steht in „Alles hier“ und lässt sich von dort öffnen. Nie die Form eines anderen Produkts.
- Antippen, Hervorheben, „Alles hier“, „entdeckt“, Doppeltipp und der Ersatz ohne WebGL gehen für
  gelegte Plätze wie bisher; auch ein Tipp zwischen zwei Stücke desselben Platzes trifft ihn.

### Einrichten-Modus (für den Inhaber, nur lokal)

```bash
npx nx run bakery-digitale-baeckerei:einrichten   # http://localhost:4223
```

Der Lauf füllt die App mit allen Produkten aus hq und den Regal-Modellen aller Produkte und startet
sie mit dem Werkzeug „Einrichten“ (oben rechts):

1. **Platz wählen:** im Bild antippen oder unter „Plätze“ aus der Liste (dort stehen auch Plätze,
   die gerade leer sind).
2. **Belegen:** Produkt suchen und antippen (die Zeile sagt, ob es ein Regal-Modell gibt), Stückzahl
   mit − und + einstellen (1 bis 500), oder „Leer“, oder „Wie im Modell“. Das Bild zeigt jede
   Änderung sofort. Ein neu gewähltes Produkt übernimmt die bisherige Stückzahl nur, soweit sie
   passt - sonst setzt das Werkzeug sie auf das, was passt, und sagt es. Wer danach mehr einstellt,
   liest den Hinweis „nur n von m passen“. Eine Eingabe, die nicht gilt, wird gemeldet; der Entwurf
   bleibt dabei erhalten.
3. **Änderungen ansehen:** „Änderungen (n)“ listet sie, jede lässt sich zurücknehmen.
4. **Datei holen:** „Einrichtung herunterladen“ oder „Kopieren“ liefert die **vollständige**
   `einrichtung.yaml`. Sie gehört nach `hq/config/digitale-baeckerei/einrichtung.yaml` (committen
   wie jede Änderung in hq). Beim nächsten Build gilt sie.

- Der Entwurf beginnt mit der Datei, die in hq liegt. **Ohne Änderung kommt sie Zeichen für Zeichen
  wieder heraus**. Mit Änderung ändern sich nur die Zeichen des betroffenen Eintrags: Kommentare
  (auch die des geänderten Eintrags), Reihenfolge, Leerzeilen, Zeilenenden (auch CRLF) und alle
  anderen Zeilen bleiben; ändern und zurückändern ergibt wieder dieselbe Datei. Wird ein Eintrag
  gelöscht, gehen die Kommentarzeilen direkt über ihm mit. Nur wo das nicht geht (Schreibweise in
  geschweiften Klammern, ein neuer oder leer gewordener Raum, uneinheitliche Einrückung), schreibt
  das Werkzeug die Datei über den YAML-Baum neu - Inhalt und Kommentare bleiben, Abstände können
  sich ändern (`scripts/einrichtung.js`, dort steht die Zusage genau). „Datei laden“ nimmt eine
  andere Datei als Ausgangspunkt.
- **Der Entwurf lebt nur im Arbeitsspeicher des Tabs.** Gespeichert wird nichts, weder auf dem
  Gerät noch in hq - neu laden heißt neu anfangen. Erst herunterladen, dann schließen.
- Am Handy im selben WLAN: die Adresse des Rechners mit Port 4223 öffnen.
- **Nie öffentlich:** Das Werkzeug steckt nur in diesem Lauf. Ein Export lässt sich mit dem Schalter
  nicht bauen, und der Wächter weist ihn, das Werkzeug im Code und seine Daten ab. Ein normaler
  Build danach räumt `public/` wieder auf.

### Leistung

Gemessen am echten Modell mit den 48 Regal-Modellen auf allen 84 Plätzen (324 Stück), in der
Emulation (Pixel 7, 4G + CPU 4×, Software-GPU; **auf echtem Handy ungeprüft**):

|                                   | vorher (Ware des Modells) | mit Regal-Modellen |
| --------------------------------- | ------------------------- | ------------------ |
| Dreiecke, sichtbar (ganzer Laden) | 144 976                   | 156 510            |
| Dreiecke im Bild, Theke hoch      | ≈ 82 000                  | ≈ 87 000           |
| Zeichenaufrufe, Theke hoch        | 287                       | 214                |
| Zeichenaufrufe, Theke Desktop     | 401                       | 276                |
| erstes Bild                       | ≈ 4,3 s                   | ≈ 4,6 s            |
| Bilder/s beim Schwenken           | ≈ 28                      | ≈ 25               |
| Bilder in Ruhe                    | 0                         | 0                  |
| übertragen                        | 4,50 MB                   | 4,76 MB            |

- Je Platz ein `InstancedMesh` am Knoten des Platzes: eine Geometrie je Produkt, ein Material für
  alle, ein Aufruf je Platz - weniger Aufrufe als die Ware des Modells (ein Aufruf je Material je
  Platz), und ein Platz außerhalb des Bildes wird weiter nicht gezeichnet. Ein `InstancedMesh` je
  Produkt für den ganzen Raum sparte noch einmal ≈ 35 Aufrufe, nähme aber dem Antippen, Hervorheben
  und Ausblenden den Platz als Einheit.
- Etwas mehr Dreiecke: Ein Regal-Modell hat höchstens 250 (im Mittel ≈ 230 je gelegtem Stück), die
  bisherige Form im Mittel ≈ 195 je Stück. Die Software-GPU der Messung hängt an den Dreiecken,
  darum die etwas niedrigere Bildrate; ob ein echtes Handy das merkt, ist offen.
- Das Paket lädt **mit** dem Modell, nicht danach: ≈ 0,3 s später das erste Bild, dafür kein
  sichtbares Umspringen der ganzen Auslage. Die Rahmen der Plätze kosten 30 kB in `belegung.json`
  (gzip ≈ 4 kB).

### Grenzen

- **Die App kennt nur so viel Platz, wie die Ware des Modells einnimmt.** Wo im Modell nur vorn eine
  Reihe steht (Dosenregal, Getränkekühlschrank, Gitter- und Würfelregal), ist der Platz für die App
  so tief wie diese Reihe - ein Brot ist dort „zu groß“. Theke, Brotregal und Körbe sind voll belegt
  und darum genau.
- Die App kennt die Möbel nicht: Trennwände zwischen Fächern und das Glas der Vitrine sieht sie nur
  als Lücke zwischen der Ware. In Fächern ohne Raster (Vitrine) kann ein Platz bis ≈ 5 cm breiter
  geschätzt sein, als er ist.
- Plätze, die im Modell leer sind (die Ablage auf der Theke, freie Stellen auf der Vitrine), lassen
  sich nicht belegen - dafür muss der Platz im Explorer belegt sein.
- Die Art eines Platzes folgt seinem Namen wie im Explorer (`brezelstaender` → Haken, `koerbe` →
  gehäuft, sonst Reihen).
- Wo „vorn“ ist, leitet der Sync aus der Ware ab (Gefälle; gefüllt wird von vorn); die App richtet
  es am Standort des Blickpunkts aus, zu dem das Möbel gehört.
- Das Werkzeug ist nur in Chromium ausprobiert (Handy emuliert), nicht auf einem echten Handy.

### Was das Veröffentlichen braucht

Die Regal-Modelle erreicht der Deploy seit DB14 (Export `hq/produkte-3d/`, siehe „Veröffentlichen
der Produktmodelle“). Für eine **Einrichtung** fehlt noch: `config/digitale-baeckerei/` im
Sparse-Checkout von hq (und der Schritt danach muss den Ordner erlauben). Solange es die Datei nicht
gibt, liegt in jedem Platz das Produkt, das der Zwilling dort nennt - jetzt als Regal-Modell.

## Phasen

Jede Phase endet mit einem grünen PR. Bei sichtbaren Änderungen kommen Screenshots bei 390 px
und Desktop dazu (lokal, nicht eingecheckt).

| Phase         | Inhalt                                                                                                                                                                                                | Fertig, wenn                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Spike**  | App-Gerüst, `sync-model` + `model.lock.json`, Modell laden, Morgens-Filter, ein Blickpunkt (Theke)                                                                                                    | Die Theke sieht auf dem Handy aus wie im Explorer. Ladezeit und FPS auf einem echten Handy sind im PR notiert. **Erledigt** (PR #132). Ladezeit und FPS sind nur in der Emulation gemessen (4G + CPU 4×: ≈ 4,9 s bis zum ersten Bild, lokal und unkomprimiert; ≈ 26 FPS mit Software-GPU) - auf echtem Handy ungeprüft                                                                                                                              |
| **P1 MVP**    | Produktdaten aus hq, Preisschilder im Modell ausgeblendet, 3 Blickpunkte inkl. Hochformat-Werte, Kamera-Rig, Picking + Bottom-Sheet, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen-Hinweis | Unit-Tests (Blickpunkt-Grenzen, Produkt-Zuordnung, Morgens-Filter) und Playwright bei 390 px (laden, wechseln, antippen → Sheet) mit dem synthetischen Fixture grün. **Erledigt** (PR #134). Geprüft: Unit-Tests und Playwright bei 390 px und Desktop mit dem Fixture. Am echten Modell nur in der Emulation angesehen und gemessen (4G + CPU 4×: ≈ 4,4 s bis zum ersten Bild des Modells; ≈ 26 FPS mit Software-GPU) - auf echtem Handy ungeprüft |
| **P2 Live**   | Produkttexte in hq überarbeitet, hq-Zugriff im Deploy (falls entschieden), Deploy unter `/digitale-baeckerei/`, Abnahme durch den Inhaber am Handy, danach der Link von der Landingpage               | Die Seite ist öffentlich erreichbar, und der Inhaber hat zugestimmt. **Live** (#137, Deploy 2026-11-13). Offen: Abnahme am Handy, danach der Link (#138)                                                                                                                                                                                                                                                                                            |
| **P3 später** | Intro „Blick vom Kreisel“, Außenraum aus dem GLB schneiden, Backstube als zweiter Raum, Umzug des Generators (DB2), evtl. Feierabend-Umschalter oder „entdeckt x/y“                                   | einzeln entscheiden. **Gebaut** (#140): Flug „Von der Straße zur Theke“ mit Überspringen, „entdeckt x von y“. **Nicht gebaut:** Flug vom Kreisel, „nur beim ersten Besuch“, Feierabend-Umschalter, Backstube, Umzug des Generators - siehe „Stand P3“                                                                                                                                                                                               |
| **P4 später** | Echte 3D-Produkte (DB7), zuerst ein Test mit 3 Produkten                                                                                                                                              | **Pipeline + Nahansicht gebaut** (#139), Test mit 3 prozeduralen Produkten; Scans entfallen (DB10): alle 106 Produkte prozedural, siehe „Stand P5–P8“                                                                                                                                                                                                                                                                                               |

### Stand P5–P8 (2026-11-13)

| Paket                        | Stand                                                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P5 Produktmodelle (DB10)** | Lokal in `../produkte-3d`: 27 Generator-Familien, alle 106 hq-Produkte mit Nahansicht (`model.glb`) und Regal-Modell (`regal.glb`, ≤ 250 Dreiecke), Manifest Version 2. Aussehen aus hq-Texten und Explorer-Formen abgeleitet, **keines abgenommen**. |
| **P6 Bilder (DB13)**         | `npm run render` in `../produkte-3d`: freigestellte Bilder 400/800 px je Produkt. Die Landingpage zeigt sie, sobald ein Stand in `apps/bakery-landing/produkte-3d-bilder.lock.json` steht (#146); seit DB14 gesetzt.                                  |
| **P7 Weitere Räume (DB11)**  | App-Seite fertig (#148, #150): Raumwechsel, Modell je Raum, Infopunkte, Türen. Geprüft mit einem erfundenen Test-Raum. Ein Modell der Backstube gibt es nicht.                                                                                        |
| **P8 Einrichtung (DB12)**    | Fertig (#151): `einrichtung.yaml` aus hq, die App legt Regal-Modelle in die Plätze, Einrichten-Modus lokal. Am echten Modell nur lokal und in der Emulation angesehen - **auf echtem Handy ungeprüft**.                                               |

**Veröffentlicht seit 2026-11-13 (DB14):** P5 und P6 über den Export `hq/produkte-3d/`. P7 und P8
sind live im Code, aber ohne Inhalt: kein zweiter Raum, keine `einrichtung.yaml`.

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

> **Überholt durch DB10 (2026-11-13):** Die Produkte werden nicht gescannt, sondern prozedural im
> Stil „teilrealistisch-digital“ erzeugt. Der Abschnitt bleibt als Herleitung stehen; der Stand
> steht unter „Stand P5–P8“.

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
  eigenes Daten-Repo `../produkte-3d`, vorerst nur lokal und ohne Remote (veröffentlicht wird seit DB14 über einen Export in hq, siehe
  „Veröffentlichen der Produktmodelle“). Wird veröffentlicht,
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
  `produkte-3d.lock.json` (`quelle`, `commit`, Prüfsumme von `manifest.json` - **keine
  Produkt-IDs**, die Prüfsummen der Dateien stehen im Manifest) mit `git show` aus
  `../produkte-3d` (`PRODUKTE_3D_DIR`), prüft jede Datei gegen das Manifest und schreibt `public/produkte-3d/<id>.glb`
  und `public/data/produkte-3d.json` (beides git-ignoriert). **Gibt es das Daten-Repo nicht - CI,
  andere Rechner -, entsteht ein leerer Index, und die App bietet keine Nahansicht an.** Der Deploy
  liest seit DB14 den Export `hq/produkte-3d/`. CI und die Playwright-Suite
  bauen mit einem synthetischen Laib für „Testbrot“ und prüfen, dass im Export nur der liegt.
- **Ein neues Modell** kommt so hinein: im Daten-Repo verarbeiten und committen (`npm run process`,
  `check`) → in `produkte-3d.lock.json` `commit` und `manifest.sha256` (Prüfsumme von
  `manifest.json` an diesem Commit) eintragen → PR. Die ID ist die hq-ID ohne Nummer; erreichbar ist die Nahansicht nur für
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

### Bilder für die Landingpage (DB13)

Aus denselben Modellen rendert das Daten-Repo je Produkt ein Bild (`bilder/<id>/haupt-800.webp`,
`haupt-400.webp`, `bilder/index.json`). Die Landingpage holt sie beim Bauen wie diese App die
Modelle - fester Commit in `apps/bakery-landing/produkte-3d-bilder.lock.json`, geprüft, nach
`public/` kopiert, git-ignoriert; ohne Daten-Repo bleibt sie, wie sie ist. Modell-ID, Commit-Prüfung
und `git show` stehen für beide Apps einmal in `libs/shared/produkte-3d`. Ablauf, Vorrang gegenüber
Fotos aus hq: [landing.md](./landing.md#product-images-from-the-3d-models).

### Veröffentlichen der Produktmodelle (DB14)

Der Deploy hat kein Daten-Repo. Er liest einen **Export** in hq: `hq/produkte-3d/` mit
`STAND.json` (`commit` = der Commit in `../produkte-3d`, an dem exportiert wurde), `manifest.json`,
`models/` und `bilder/`. `liesAusCommit` (`libs/shared/produkte-3d`) erkennt den Export an
`STAND.json`, liest die Dateien direkt und bricht ab, wenn der Export nicht am Commit aus dem Lock
gezogen wurde; alle weiteren Prüfungen (Manifest-Prüfsumme, sha256 je Modell, `modellSha256` der
Bilder) sind dieselben wie lokal.

Einen neuen Stand veröffentlichen - drei Schritte, in dieser Reihenfolge:

1. In `../produkte-3d` erzeugen, prüfen, rendern, committen (`npm run check`, `npm run render`).
2. Export nach hq, als Ganzes ersetzen (PR in hq):
   `rm -rf hq/produkte-3d/{manifest.json,models,bilder}` ·
   `git -C ../produkte-3d archive <commit> manifest.json models bilder | tar -x -C hq/produkte-3d` ·
   `STAND.json` auf `<commit>` setzen.
3. In `website` beide Locks auf `<commit>` setzen (`produkte-3d.lock.json` mit `manifest.sha256`,
   `apps/bakery-landing/produkte-3d-bilder.lock.json`) und mergen.

Zwischen Schritt 2 und 3 passt der Export nicht zum Lock: Ein Deploy in dieser Zeit **bricht ab**
und veröffentlicht nichts (die Seite bleibt, wie sie ist). Darum Schritt 3 gleich nach Schritt 2.

## Offen (Inhaber)

- **Produkttexte in hq:** Texte mit Formulierungen, die wie Gesundheitsversprechen klingen, vor dem
  Go-live überarbeiten.
- **Preise in hq prüfen:** Die Landingpage zeigt seit DB14 das Feld `price` aus `hq/products`.
- **Abnahme am Handy** nach dem Deploy, danach der Link von der Landingpage (#138).
- **Produktmodelle abnehmen (DB10):** Abnahmeblatt in `../produkte-3d` ansehen und je Produkt
  bestätigen oder Änderungen nennen (`../produkte-3d/docs/abnahme.md`). Offen sind u. a. die Sorte
  bei Schnecke, Kranz, Zopf, Blechkuchen und Muffin, die Größen von Flit und Brezel und die
  Unterscheidung ähnlicher Brötchen und Laibe.
- **Einrichtung veröffentlichen:** sobald es `config/digitale-baeckerei/einrichtung.yaml` in hq
  gibt, den Ordner im Deploy freigeben (siehe „Was das Veröffentlichen braucht“).
- **Einrichtung:** Sollen im Modell leere Plätze (Thekenplatte, freie Vitrinenplätze) einrichtbar
  werden? Dafür müsste der Explorer die Platz-Posen mitliefern.
- **Landingpage:** Wortlaut „Digitale Darstellung – kein Foto“, auch auf den Karten im Sortiment?
- **Flug:** Aussehen der Kreisel-Insel, Tempo des Flugs, Freigabe des Explorer-Stands
  (`feat/bh-intro-kreisel`, lokal).
- **Flug „nur beim ersten Besuch“:** bräuchte Speicher auf dem Gerät - erlaubt?
- **Texte der Regal-Karten** für die neutrale Ware (ohne hq-Produkt).
- **Backstube (DB11):** Zustimmung, Video, Fotos, Maße und die Liste der Stationen mit Texten -
  siehe „Was der Inhaber für die Backstube liefern muss“. Soll eine Tür im Laden in die Backstube
  führen, und soll die Backstube als eigener Raum oder im selben Modell wie der Laden entstehen
  (Entscheidung im Explorer)?
- **Preise:** später wieder aufnehmen?
