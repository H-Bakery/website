# Test-Fixtures

Synthetische Daten für Unit- und Playwright-Tests. **Alles hier ist erfunden** - Möbel als Kisten,
Produkte wie „Testbrot“, keine Preise. Das echte Modell (`twin.glb`, `catalogue.json`) und der echte
Produkt-Snapshot gehören nicht ins Repo; die Sync-Skripte schreiben sie nach `public/`
(git-ignoriert).

| Datei                            | Inhalt                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `twin.fixture.glb`               | Mini-Modell des Ladens (≈ 59 kB, 60 Knoten). Erzeugt, nicht von Hand ändern.   |
| `build-fixture.mjs`              | Generator des Mini-Modells (nur Node-Bordmittel, deterministisch).             |
| `products.snapshot.fixture.json` | 20 erfundene Produkte in der Form `ProduktSnapshot`.                           |
| `fixture-info.js`                | Liest beide Dateien (GLB-Container, Plätze, erwartete Listen) - für die Tests. |
| `fixture.spec.ts`                | Prüft, was unten steht.                                                        |

Mit `DIGITALE_BAECKEREI_FIXTURE=1` nehmen `sync-model` und `sync-products` diese Dateien statt der
echten (`public/model/twin.glb`, `public/data/products.snapshot.json`, `public/data/belegung.json`).
So baut die Playwright-Suite `apps/bakery-digitale-baeckerei-e2e`.

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
  Blickpunkte aus `src/config/raeume.ts` sie sehen.
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
  fehlt im Snapshot absichtlich. Zu sehen, aber ohne Karte und nicht in der Liste.
- **Preiskarten:** `brotregal/ebene-1/platz-01…03` und `ebene-2/platz-01` sind Meshes aus vier
  Primitiven, zwei davon mit den Materialien `preiskarte` und `preisschrift` (die App blendet sie
  aus). Die übrigen Brote haben ein Primitiv.
- **Glas:** Material `glas` (`alphaMode: BLEND`, doppelseitig): Frontscheibe, Glasboden und Deckel
  der Vitrine, Tür des Kühlschranks. Tippen muss hindurchgehen.

## Der Snapshot

`products.snapshot.fixture.json` enthält genau die Produkte, die im Mini-Modell liegen (außer
`phantomgebaeck`): die meisten mit `einheit`, drei Brötchen und vier Teilchen/Snacks ohne, die
„Musterkruste“ mit langem `text`, die „Testkekse“ mit `seite`. Kein Preisfeld.

## Neu erzeugen

```bash
cd apps/bakery-digitale-baeckerei
node src/test/fixtures/build-fixture.mjs           # schreibt twin.fixture.glb
node src/test/fixtures/build-fixture.mjs --check   # Exit 1, wenn die Datei vom Generator abweicht
```

Szene ändern = `build-fixture.mjs` ändern, neu erzeugen, `twin.fixture.glb` mit einchecken.
`fixture.spec.ts` schlägt fehl, wenn Datei und Generator auseinanderlaufen, wenn ein Produkt des
Modells im Snapshot fehlt (oder umgekehrt) oder wenn irgendwo etwas nach Preis aussieht. Wer Plätze
verschiebt, schaut danach ins Bild: die Playwright-Suite tippt Plätze an.
