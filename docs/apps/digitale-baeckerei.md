# Digitale Bäckerei (`apps/bakery-digitale-baeckerei`) - Plan

Status: **Plan, nicht gebaut** (2026-11-12). Dieses Dokument ist der Auftrag für die Umsetzung.

Besucher schauen sich die Bäckerei Heusser in 3D an: die Theke mit Vitrine, das Brotregal und die
Regale, voll mit den echten Produkten. Tippen auf ein Produkt zeigt Name, Preis und Kurztext.
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
  sind neutrale Waren (Gläser, Dosen) ohne eigene Karte; ein Tipp darauf zeigt die Karte des
  Regals. `catalogue.json` → `products[<id>]` liefert `name_de`, `short_de`, `info_de`,
  `category`, `price_eur`, `sale_unit`. Die Daten stammen aus `hq/products` (Import im Explorer).
- Zustände: `fills.default = "morgens"` (volle Auslage) und `feierabend` (leer). Die App zeigt
  nur **Morgens**: Knoten ausblenden, deren `extras.fills` `morgens` nicht enthält.
- Startwerte für die Kamera aus der Führung des Explorers (`catalogue/tour.json`, `eye` → `look`):
  `theke` [6.0, 245.9, −0.6] → [3.9, 245.0, −1.8] und `brotregal` [5.6, 245.9, −1.0] →
  [2.3, 245.7, −1.1]. Den Blickpunkt für die Regale neu bestimmen.
- Übernehmbarer Code (MIT, gleicher Urheber, Herkunft im Dateikopf nennen):
  `app/src/zones/runtime/twinPick.ts` (Picking, ≈ 44-px-Proxies für kleine Produkte auf Touch),
  `twinInteract.ts` (Hover/Tap-Highlight), `twinUi.ts` (Infokarte).

### Rechte und Datenschutz

- Name, Schriftzug, Produkttexte und Preise im Modell gehören der Bäckerei. Sie sind dort mit
  Zustimmung der Inhaber gezeigt (ADR 0044 im Explorer) und **nicht** MIT-lizenziert. Gelände und
  Gebäude außen: © GeoBasis-DE/LVGL-SL (2026), dl-de/by-2-0. Straßen: © OpenStreetMap-Mitwirkende,
  ODbL. Diese Quellen nennt die App unter „Quellen“, solange durch die Fenster etwas vom Außenraum
  zu sehen ist.
- **Das Modell und `catalogue.json` werden nicht in dieses öffentliche Repo eingecheckt.** Echte
  Preise gehören nicht in `website`. Ein Sync-Skript lädt beides beim Bauen (Ordner ist
  git-ignoriert). Tests und e2e nutzen ein **synthetisches** Mini-GLB und einen synthetischen
  Katalog mit erfundenen Produkten.
- Kein Tracking, keine Cookies, keine Fremd-Fonts. Keine Personen, keine Fotos von Dritten.

## Aufbau

Eine eigenständige statische Next-App, aufgebaut wie `apps/bakery-partybrezel`: Next App Router,
`output: 'export'`, React 18, MUI 5, kein `withNx()`, keine `@bakery/*`-Libs außer bei echtem
Bedarf. Die 3D-Szene benutzt direkt `three` (im Repo schon vorhanden, siehe Partybrezel), ohne
react-three-fiber (das bräuchte React 19). Sie läuft in einer Client-Komponente, die per
`dynamic(..., { ssr: false })` geladen wird. Den Meshopt-Decoder liefert `three`
(`three/examples/jsm/libs/meshopt_decoder.module.js`).

```
apps/bakery-digitale-baeckerei/
  scripts/sync-model.mjs     Paket laden, Prüfsumme prüfen, nach public/model/ (git-ignoriert)
  model.lock.json            Quelle (Commit des Daten-Repos), sha256 je Datei, Abrufdatum
  src/config/raeume.ts       Räume → Blickpunkte (eye, look, Grenzen, Hoch-/Querformat)
  src/lib/scene/             Laden, Morgens-Filter, Kamera-Rig, Picking (aus dem Explorer)
  src/components/            Viewer, Blickpunkt-Leiste, Produkt-Sheet, Liste, Ladebild
  src/test/fixtures/         synthetisches Mini-GLB + Katalog
```

- **Sync:** `sync-model.mjs` lädt `twin.glb` und `catalogue.json` an einem **festen Commit** von
  `raw.githubusercontent.com/Open-Kirrberg/saar-lidar-data/<sha>/zones/baeckerei-heusser/built/`,
  prüft die sha256 aus `model.lock.json` und bricht bei einer Abweichung ab. Ein neues Modell
  übernimmt man bewusst: Commit und Prüfsummen in `model.lock.json` ändern, dann PR.
  Das Nx-Target `build` hängt von `sync-model` ab. CI darf den öffentlichen Download machen.
- **Räume als Datenmodell:** `raeume.ts` = `[{ id: 'laden', name, blickpunkte: [...] }]`. Die
  Backstube ist später nur ein weiterer Eintrag mit eigenem Modell, Blickpunkte und UI bleiben.
- **Blickpunkt:** `{ id, name, eye, look, yawDeg: 20, pitchDeg: 12, fovMin, fovMax, portrait?:
{ eye, look, fov } }`. Hochformat bekommt eigene Werte, damit das ganze Regal ins Bild passt.
- **Kamera-Rig:** Die Position bleibt fest. Ziehen dreht innerhalb der Grenzen und federt an den
  Rändern weich zurück. Pinch/Mausrad verändert die Brennweite (FOV) statt der Position, sonst
  fliegt man in die Regale. Doppeltipp auf ein Produkt zoomt dorthin. Ein Wechsel des Blickpunkts
  gleitet ≈ 0,8 s; bei `prefers-reduced-motion` wird geschnitten.
- **Leistung:** Pixel-Ratio höchstens 2, Rendern nur bei Bewegung oder Änderung (kein
  Dauer-Loop), Außenraum (`fassade/*`, `umgebung/*`) ausblenden, wo man ihn nicht sieht. Erst
  messen; wenn die Ladezeit über 4G zu lang ist, schneidet das Sync-Skript den Außenraum aus dem
  GLB heraus (gltf-transform mit meshopt).

## Bedienung (Handy zuerst)

- **Start:** Ein Ladebild (statisches Standbild der Theke) mit Fortschritt, danach Blickpunkt
  „Theke“. Ein kurzer Hinweis „Ziehen zum Umschauen · Tippen für Infos“ verschwindet nach der
  ersten Geste.
- **Blickpunkt-Leiste** unten in Daumenreichweite mit den Chips _Theke_ · _Brotregal_ ·
  _Regale_. Zusätzlich Wischen mit zwei Fingern oder Pfeile am Rand. Auf dem Desktop: Pfeiltasten.
- **Produkt antippen:** kurzes Aufleuchten, dann ein Bottom-Sheet mit Name, Preis + Einheit
  („2,50 € / Laib“), Kurztext, aufklappbar der lange Text. Dazu „Stand der Preise: <Monat Jahr>“
  (Abrufdatum aus `model.lock.json`). **Keine Allergene**, solange die Liste nicht vollständig
  bestätigt ist. Ein Link „Mehr auf der Website“ führt zur Produktseite der Landingpage, falls es
  sie gibt.
- **Liste „Alles hier“** je Blickpunkt: alle Produkte dieses Blickpunkts als Liste (Name, Preis).
  Tippen in der Liste hebt das Produkt im Bild hervor. Dieselbe Liste dient als **Ersatz ohne
  WebGL** und für Screenreader.
- Deutsch in der Du-Form wie die Texte im Modell. Die Farben stammen aus der Markenpalette
  (`docs/brand-identity.md`). Dark Mode gilt nur für die Bedienelemente, die Szene bleibt hell.

## Deploy

`deploy-to-github-pages.yml` baut nach der Landingpage zusätzlich diese App mit
`basePath: '/digitale-baeckerei'` und kopiert deren `out/` nach
`apps/bakery-landing/out/digitale-baeckerei/`. Danach läuft der Upload wie bisher (CNAME,
`.nojekyll`). Ein Link von der Landingpage kommt erst **nach der Abnahme** durch den Inhaber am
Handy.

## Phasen

Jede Phase endet mit einem grünen PR. Bei sichtbaren Änderungen kommen Screenshots bei 390 px
und Desktop dazu (lokal, nicht eingecheckt).

| Phase         | Inhalt                                                                                                                                     | Fertig, wenn                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 Spike**  | App-Gerüst, `sync-model` + `model.lock.json`, Modell laden, Morgens-Filter, ein Blickpunkt (Theke)                                         | Die Theke sieht auf dem Handy aus wie im Explorer. Ladezeit und FPS auf einem echten Handy sind im PR notiert                                                       |
| **P1 MVP**    | 3 Blickpunkte inkl. Hochformat-Werte, Kamera-Rig, Picking + Bottom-Sheet, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen-Hinweis | Unit-Tests (Blickpunkt-Grenzen, Produkt-Zuordnung, Morgens-Filter) und Playwright bei 390 px (laden, wechseln, antippen → Sheet) mit dem synthetischen Fixture grün |
| **P2 Live**   | Deploy unter `/digitale-baeckerei/`, Abnahme durch den Inhaber am Handy, danach der Link von der Landingpage                               | Die Seite ist öffentlich erreichbar, und der Inhaber hat zugestimmt                                                                                                 |
| **P3 später** | Außenraum aus dem GLB schneiden, Backstube als zweiter Raum, Umzug des Generators (DB2), evtl. Feierabend-Umschalter oder „entdeckt x/y“   | einzeln entscheiden                                                                                                                                                 |

## Offen (Inhaber)

- Die Produkttexte enthalten zum Teil Gesundheitsversprechen (_gesund_, _reich an
  Ballaststoffen_). Vor P2 prüfen; korrigiert wird in `hq/products`, danach Re-Import im Explorer.
- Preise: Das Modell hat den Stand des letzten Imports. Sollen Preise überhaupt erscheinen, und ist
  der Hinweis „Stand der Preise“ so in Ordnung?
- Startbild: Soll vor dem Laden die Fassade gezeigt werden (Wiedererkennung), oder geht es direkt an
  die Theke?
