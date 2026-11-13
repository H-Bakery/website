# Test-Fixtures

Synthetische Daten für Unit- und Playwright-Tests. **Alles hier ist erfunden** - Möbel als Kisten,
Produkte wie „Testbrot“, keine Preise. Das echte Modell (`twin.glb`), die daraus abgeleitete Belegung
und der echte Produkt-Snapshot gehören nicht ins Repo; die Sync-Skripte schreiben sie nach `public/`
(git-ignoriert). Den Katalog des Explorers (`catalogue.json`, mit Preisen) lädt die App gar nicht.

| Datei                            | Inhalt                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `twin.fixture.glb`               | Mini-Modell des Ladens (≈ 59 kB, 60 Knoten). Erzeugt, nicht von Hand ändern.  |
| `build-fixture.mjs`              | Generator des Mini-Modells (nur Node-Bordmittel, deterministisch).            |
| `products.snapshot.fixture.json` | 20 erfundene Produkte in der Form `ProduktSnapshot`.                          |
| `produkt.fixture.glb`            | Ein Produkt-Modell für die Nahansicht (≈ 15 kB): kantiger Laib. Erzeugt.      |
| `build-produkt-fixture.mjs`      | Generator dazu (nur Node-Bordmittel, deterministisch, ohne Winkelfunktionen). |
| `produkte-3d.fixture.json`       | Index der Nahansicht: nur `testbrot-500g` hat ein Modell.                     |
| `fixture-info.js`                | Liest die Dateien (GLB-Container, Plätze, erwartete Listen) - für die Tests.  |
| `testbackstube.fixture.glb`      | Mini-Modell eines zweiten, erfundenen Raums (≈ 13 kB, 11 Knoten). Erzeugt.    |
| `testraeume.ts`                  | Dessen Konfiguration (Blickpunkte, Tür) in der Form `Raum` der App.           |
| `raeume/testbackstube.yaml`      | Dessen synthetische Infopunkte, in der Form der Dateien in hq.                |
| `fixture.spec.ts`                | Prüft, was unten steht.                                                       |

Mit `DIGITALE_BAECKEREI_FIXTURE=1` nehmen `sync-model` und `sync-products` diese Dateien statt der
echten (`public/model/twin.glb`, `public/data/products.snapshot.json`, `public/data/belegung.json`).
So bauen die Playwright-Suite `apps/bakery-digitale-baeckerei-e2e` und CI (`ci.yml`, auch der
`build`-Job) - dort gibt es weder das echte Modell noch hq.

## Was das Mini-Modell nachahmt

Den Aufbau des echten Modells, damit dieselben Code-Pfade laufen:

- Alle Knoten sind Wurzeln der Szene mit `translation` und gleichmäßigem `scale`; die Namen sind
  Katalog-IDs (`theke/korpus`, `theke/vitrine/ebene-1`, `brotregal/korpus`, `dosenregal/korpus`,
  `getraenkekuehlschrank/korpus`, `gitterregal/korpus`, `wuerfelregal/korpus`, `fassade/wand`,
  `umgebung/boden`, `verkaufsraum/…`). Möbel tragen `extras { id, source, sigma_m, confidence }`.
- Positionen normalisierte int16 (`KHR_mesh_quantization`), `COLOR_0` normalisierte uint8, jedes
  Material `KHR_materials_unlit` mit `baseColorFactor`. **Ohne meshopt**, also ohne Decoder lesbar.
- Koordinaten im Rahmen des Explorers (x Ost, y Höhe 244,25-246,5 m, z −Nord). Möbel und Ware stehen
  grob an den echten Stellen (Theke und Brotregal um 20° gedreht, Kundenseite +x), damit die
  Blickpunkte aus `src/config/raeume.ts` sie sehen. Die Wand zur Straße (`fassade/wand`) hat eine
  offene Tür, und `umgebung/nachbarhaus` steht abseits: Der Flug zum Start (`intros` in `raeume.ts`)
  führt wie am echten Modell über die Straße und durch die Tür, ohne durch Geometrie zu fliegen.
- **Plätze** `produkt/<slot>` mit `extras { id: <slot>, product | ware, count, fills: ['morgens'] }`:

  | Möbel                | Plätze mit Produkt                                                                                                      | Neutrale Ware (`ware`)                    |
  | -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
  | Theke, Vitrine       | `theke/vitrine/ebene-1/platz-01…05`, `ebene-2/platz-01, 03, 04` (hinter Glas), `ebene-3/platz-01, 02` (auf der Vitrine) | -                                         |
  | Theke, Brezelständer | `theke/brezelstaender/platz-01, 02`                                                                                     | -                                         |
  | Brotregal            | `brotregal/ebene-1/platz-01…04`, `ebene-2/platz-01, 02`, `ebene-3/platz-01`, `koerbe/korb-1` und `korb-3` `/platz-01`   | -                                         |
  | Dosenregal           | `dosenregal/platz-03`                                                                                                   | `platz-01` und `-04` (dose), `-02` (glas) |
  | Getränkekühlschrank  | `getraenkekuehlschrank/platz-03` (hinter der Glastür)                                                                   | `platz-01`, `-04` (flasche)               |
  | Gitterregal          | `gitterregal/platz-03`                                                                                                  | `platz-01` (karton), `-04` (tuete)        |
  | Würfelregal          | `wuerfelregal/platz-05`                                                                                                 | `platz-02` (glas), `-06` (dose)           |

  Die genaue Liste: `node src/test/fixtures/build-fixture.mjs --list`.

- **Variante:** `produkt/theke/vitrine/ebene-1/platz-03@feierabend` (`fills: ['feierabend']`,
  anderes Produkt, grell und groß). Der Morgens-Filter blendet sie aus.
- **Produkt ohne Eintrag:** `theke/vitrine/ebene-3/platz-02` zeigt auf `phantomgebaeck` - diese ID
  fehlt im Snapshot absichtlich. Zu sehen, aber ohne Karte und nicht in der Liste. Der Platz steht
  auf der Vitrine links neben den „Testkeksen“, damit er am Blickpunkt „Theke“ auch im Hochformat
  (390 px) im Bild liegt.
- **Anders als das echte Modell** haben hier auch Dosenregal, Kühlschrank, Gitter- und Würfelregal
  je ein Produkt (im echten Modell tragen sie nur neutrale Ware) - so prüft die Suite Karten und
  Listen an allen drei Blickpunkten. Den leeren Bereich prüfen die jest-Specs der Komponenten.
- **Preiskarten:** `brotregal/ebene-1/platz-01…03` und `ebene-2/platz-01` sind Meshes aus vier
  Primitiven, zwei davon mit den Materialien `preiskarte` und `preisschrift`. Ihre Positionen liegen
  in einer eigenen BufferView vor den übrigen. `sync-model` nimmt sie vor dem Ausliefern heraus
  (`scripts/glb-bereinigen.js`) - das Fixture **behält** sie, damit dieser Weg in den Tests und der
  Playwright-Suite wirklich läuft. Die übrigen Brote haben ein Primitiv.
- **Glas:** Material `glas` (`alphaMode: BLEND`, doppelseitig): Frontscheibe, Glasboden und Deckel
  der Vitrine, Tür des Kühlschranks. Tippen muss hindurchgehen.

## Der zweite Raum: „Testbackstube“ (DB11)

Eine echte Backstube gibt es noch nicht als Modell - Raumwechsel, Infopunkte und Türen sind an
diesem erfundenen Raum gebaut und getestet. **Es gibt ihn nur mit `DIGITALE_BAECKEREI_FIXTURE=1`**:
`sync-model` und `sync-rauminfos` bauen dann nach `RAEUME` aus `fixture-info.js` (statt nach
`model.lock.json`), und nur dann lädt die App `testraeume.ts` (`src/lib/raeume/verfuegbar.ts`). Im
echten Export darf nichts davon auftauchen; der Wächter sucht danach (`TEST_SPUREN` in
`scripts/export-pruefung.js` - id und Name jedes Test-Raums müssen eine der Spuren enthalten).

- Ein Raum von 6 × 5 m im eigenen Rahmen (gleiche Höhenlage wie der Laden), Knoten `backstube/…`
  (Boden, Wand, Decke). **Keine Produkte**, keine `fills`.
- Blickpunkt „Ofen“: `ofen/korpus` + `ofen/tuer`, `kneter/korpus` + `kneter/kessel`, `spuele/becken`.
  Blickpunkt „Arbeitstisch“: `arbeitstisch/platte` + `arbeitstisch/gestell`, `tuer/blatt`.
- Infopunkte (`raeume/testbackstube.yaml`): `ofen` („Testofen“, mit langem Text), `kneter/`
  („Testkneter“, mit Schrägstrich am Ende - der fällt beim Lesen weg), `arbeitstisch`
  („Testtisch“). **Die Spüle hat absichtlich keinen** (Tipp ohne Karte), die Tür führt in den Laden
  (`tueren` in `testraeume.ts`). `STATIONEN` in `fixture-info.js` nennt sie für die Suite.
- Die Suite tippt auf die Mitte aller Stücke einer Station (`screenPos('ofen')`). Wer Kisten oder
  Blickpunkte verschiebt, schaut ins Bild: Im Hochformat liegen die Pfeile am Rand (42 % der Höhe)
  nah an Ofen und Tür.

```bash
node src/test/fixtures/build-fixture.mjs --raum testbackstube          # schreibt testbackstube.fixture.glb
node src/test/fixtures/build-fixture.mjs --raum testbackstube --list   # seine Knoten
```

Ohne `--raum` schreibt bzw. prüft (`--check`) der Generator beide Modelle; mit `--out` oder `--list`
allein gilt der Laden.

## Der Snapshot

`products.snapshot.fixture.json` enthält genau die Produkte, die im Mini-Modell liegen (außer
`phantomgebaeck`): die meisten mit `einheit`, drei Brötchen und vier Teilchen/Snacks ohne, die
„Musterkruste“ mit langem `text`, die „Testkekse“ mit `seite`. Kein Preisfeld.

## Das Produkt-Modell der Nahansicht

`produkt.fixture.glb` steht für die echten Modelle aus dem Daten-Repo `produkte-3d` (nur lokal, nie
hier): Meter in echter Größe, Y nach oben, steht auf y = 0, PBR-Material (beleuchtet, nicht unlit),
Vertex-Farben. Anders als die echten: ohne meshopt, Quantisierung und Textur. Die Form ist nicht
drehsymmetrisch (ein dunkles Ende, drei Einschnitte, eine Mehlseite), damit die Suite sieht, dass
Drehen das Bild ändert. `sync-produkte-3d` kopiert Modell und Index im Fixture-Modus Byte für Byte
nach `public/produkte-3d/testbrot-500g.glb` und `public/data/produkte-3d.json`; CI und der
e2e-Server prüfen, dass im Export genau das liegt. „Testbrot“ hat ein Modell, „Testkekse“ keines.

```bash
node src/test/fixtures/build-produkt-fixture.mjs           # schreibt produkt.fixture.glb
node src/test/fixtures/build-produkt-fixture.mjs --check   # Exit 1, wenn die Datei abweicht
```

Ändert sich die Größe der Datei, `bytes` in `produkte-3d.fixture.json` nachziehen.

## Neu erzeugen

```bash
cd apps/bakery-digitale-baeckerei
node src/test/fixtures/build-fixture.mjs           # schreibt twin.fixture.glb
node src/test/fixtures/build-fixture.mjs --check   # Exit 1, wenn die Datei vom Generator abweicht
```

Szene ändern = `build-fixture.mjs` ändern, neu erzeugen, `twin.fixture.glb` mit einchecken.
`fixture.spec.ts` schlägt fehl, wenn Datei und Generator auseinanderlaufen, wenn ein Produkt des
Modells im Snapshot fehlt (oder umgekehrt) oder wenn irgendwo etwas nach Preis aussieht. Wer Plätze
verschiebt oder die Blickpunkte in `src/config/raeume.ts` ändert, schaut danach ins Bild: Die
Playwright-Suite tippt Plätze an und bricht mit „Platz … ist an diesem Blickpunkt nicht im Bild“ ab,
wenn einer aus dem Bild gerutscht ist. Angetippt werden an der Theke `theke/vitrine/ebene-3/platz-01`
und `-02`, `ebene-1/platz-03` und `-04` (hinter Glas) und am Desktop `brotregal/ebene-3/platz-01`,
an den Regalen `dosenregal/platz-01`, `-03` und `-04`. Von schräg oben verdeckt dort das Fach
darüber die Mitte des unteren: Nur `platz-04` (oberstes Fach) wird sicher selbst getroffen.

Das Mini-Modell hat **keine Normalen** (wie ein unlit-Modell sie nicht braucht) - die Hervorhebung
berechnet sie sich dann selbst. `sync-products` kopiert den Fixture-Snapshot Byte für Byte; das Modell im
Export ist das bereinigte Fixture (`ausgeliefertesModell()` in `fixture-info.js`, Byte für Byte
herleitbar). Gegen beides prüfen CI und der e2e-Server den Export (`exportFehler()`) - ebenso gegen
das bereinigte Modell der Testbackstube und ihre Infopunkte (`rauminfosDatei()`), und dass in
`model/` sonst nichts liegt.
