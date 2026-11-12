# Digitale Bäckerei (`apps/bakery-digitale-baeckerei`) - Plan

Status: **P0 gemergt** (PR #132, 2026-11-12), **P1 in Arbeit**. Dieses Dokument ist der Auftrag für die
Umsetzung.

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
  `produkt/*`-Knoten). Diese Teile ausblenden, denn vorerst gibt es keine Preise (DB8).
- **CI (`ci.yml`)** baut und testet diese App nur mit dem synthetischen Fixture
  (`DIGITALE_BAECKEREI_FIXTURE=1`): kein Download, kein hq, das echte Modell landet in keinem
  Artefakt.
- **Deploy:** Der Deploy-Workflow hat heute keinen Zugriff auf hq, deshalb fällt die Landingpage dort
  auf Mock-Daten zurück. Der Inhaber hat dem Lesezugriff zugestimmt (2026-11-12). Der Workflow
  checkt `hq` mit einem Secret aus (Deploy-Key oder Token der vorhandenen GitHub App, nur lesend).
  Das Secret legt **der Inhaber** an; der Agent bereitet Workflow und Anleitung vor. Die Landingpage
  kann denselben Checkout nutzen. Ohne hq bricht der Build dieser App ab, statt Mocks zu zeigen.
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
  scripts/sync-model.mjs     GLB laden, Prüfsumme prüfen, nach public/model/; Belegung nach public/data/
  scripts/sync-products.mjs  hq lesen, Snapshot ohne Preise nach public/data/ (beides git-ignoriert)
  model.lock.json            Quelle (Commit des Daten-Repos), sha256 je Datei, Abrufdatum
  src/config/raeume.ts       Räume → Blickpunkte (eye, look, Grenzen, Hoch-/Querformat, Möbel)
  src/lib/scene/             Laden, Morgens-Filter, Kamera-Rig, Picking, Hervorhebung (aus dem Explorer)
  src/lib/produkte/          Typen, Zuordnung Platz → Produkt, Laden von Snapshot und Belegung
  src/components/            Viewer, Blickpunkt-Leiste, Produkt-Sheet, Liste, Ladebild, Ersatz ohne WebGL
  src/test/fixtures/         synthetisches Mini-GLB + Produkt-Snapshot, Generator
apps/bakery-digitale-baeckerei-e2e/   Playwright (390×844 und Desktop), nur mit dem Fixture
```

- **Sync:** `sync-model.mjs` lädt `twin.glb` an einem **festen Commit** von
  `raw.githubusercontent.com/Open-Kirrberg/saar-lidar-data/<sha>/zones/baeckerei-heusser/built/`,
  prüft die sha256 aus `model.lock.json` und bricht bei einer Abweichung ab. Ein neues Modell
  übernimmt man bewusst: Commit und Prüfsummen in `model.lock.json` ändern, dann PR.
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
  des echten Modells, das gehört nicht ins Repo) mit Fortschritt, danach Blickpunkt „Theke“. Ein kurzer Hinweis „Ziehen zum Umschauen · Tippen für Infos“ verschwindet nach der
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

Bewusst nicht in P1 behoben (Stand nach dem Review von PR #134):

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
- **Preisschilder stecken weiter als Geometrie in `twin.glb`** (im Bild ausgeblendet, in der Datei
  lesbar) → P2.
- **Die Tür des Getränkekühlschranks ist undurchsichtig** (Modell); die Flaschen dahinter sieht
  man nicht.
- **Der Fortschrittsbalken** rechnet mit der Größe des echten Modells aus `model.lock.json`; im
  Fixture-Modus springt er darum von knapp 2 % auf fertig.

## Deploy

`deploy-to-github-pages.yml` baut nach der Landingpage zusätzlich diese App mit
`basePath: '/digitale-baeckerei'` und kopiert deren `out/` nach
`apps/bakery-landing/out/digitale-baeckerei/`. Danach läuft der Upload wie bisher (CNAME,
`.nojekyll`). Ein Link von der Landingpage kommt erst **nach der Abnahme** durch den Inhaber am
Handy.

## Phasen

Jede Phase endet mit einem grünen PR. Bei sichtbaren Änderungen kommen Screenshots bei 390 px
und Desktop dazu (lokal, nicht eingecheckt).

| Phase         | Inhalt                                                                                                                                                                                                | Fertig, wenn                                                                                                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Spike**  | App-Gerüst, `sync-model` + `model.lock.json`, Modell laden, Morgens-Filter, ein Blickpunkt (Theke)                                                                                                    | Die Theke sieht auf dem Handy aus wie im Explorer. Ladezeit und FPS auf einem echten Handy sind im PR notiert. **Erledigt** (PR #132). Ladezeit und FPS sind nur in der Emulation gemessen (4G + CPU 4×: ≈ 4,9 s bis zum ersten Bild, lokal und unkomprimiert; ≈ 26 FPS mit Software-GPU) - auf echtem Handy ungeprüft |
| **P1 MVP**    | Produktdaten aus hq, Preisschilder im Modell ausgeblendet, 3 Blickpunkte inkl. Hochformat-Werte, Kamera-Rig, Picking + Bottom-Sheet, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen-Hinweis | Unit-Tests (Blickpunkt-Grenzen, Produkt-Zuordnung, Morgens-Filter) und Playwright bei 390 px (laden, wechseln, antippen → Sheet) mit dem synthetischen Fixture grün                                                                                                                                                    |
| **P2 Live**   | Produkttexte in hq überarbeitet, hq-Zugriff im Deploy (falls entschieden), Deploy unter `/digitale-baeckerei/`, Abnahme durch den Inhaber am Handy, danach der Link von der Landingpage               | Die Seite ist öffentlich erreichbar, und der Inhaber hat zugestimmt                                                                                                                                                                                                                                                    |
| **P3 später** | Intro „Blick vom Kreisel“, Außenraum aus dem GLB schneiden, Backstube als zweiter Raum, Umzug des Generators (DB2), evtl. Feierabend-Umschalter oder „entdeckt x/y“                                   | einzeln entscheiden                                                                                                                                                                                                                                                                                                    |
| **P4 später** | Echte 3D-Produkte (DB7), zuerst ein Test mit 3 Produkten                                                                                                                                              | eigener Plan, wenn es losgeht                                                                                                                                                                                                                                                                                          |

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

## Offen (Inhaber)

- Das Secret für den hq-Lesezugriff im Deploy-Workflow anlegen (Anleitung liefert der Agent).
- Abnahme am Handy vor dem öffentlichen Deploy (P2) und vor dem Link von der Landingpage.
- P4: die echten Produkte für den 3-Produkte-Test fotografieren bzw. scannen.
- Preise: später wieder aufnehmen?
