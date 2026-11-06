/**
 * Erfundene Backzettel-Stammdaten fuer die Tests (Z1/Z2).
 *
 * Kein Wert stammt aus dem privaten `hq`-Repo: Produkt-IDs tragen das Praefix
 * `test-`, Mengen und Gewichte sind rund gewaehlt, damit man die Formeln im
 * Kopf nachrechnen kann.
 */

const PRODUCTS = [
  { id: 'test-zopf-gefuellt', numeric_id: 901 },
  { id: 'test-kranz-gefuellt', numeric_id: 902 },
  { id: 'test-kranz-gefuellt-viertel', numeric_id: 903 },
  { id: 'test-kranz', numeric_id: 904 },
  { id: 'test-kranz-viertel', numeric_id: 905 },
  { id: 'test-plunder', numeric_id: 906 },
  { id: 'test-weck', numeric_id: 907 },
  { id: 'test-kornbrot', numeric_id: 908 },
  { id: 'test-alt', numeric_id: 909, available: false },
]

/** Eine gueltige Konfiguration. Mi (3) ist schwaecher, Sa (6) ist Hefeteig-Tag. */
function config(overrides = {}) {
  return {
    version: 1,
    days: [2, 3, 4, 5, 6, 7],
    sections: [
      'vorbereitung',
      'brot',
      'broetchen',
      'kaffeestueckchen',
      'hefeteig',
    ],
    items: [
      {
        id: 'kornbrot',
        name: 'Kornbrot',
        section: 'brot',
        unit: 'Liter',
        products: [{ id: 'test-kornbrot', factor: 0.5 }],
        base: { 2: 4, 3: 4.5, 4: 4, 5: 4, 6: 2.25 },
        pieces_per_liter: 2,
      },
      {
        id: 'vollkorn',
        name: 'Vollkornbrot',
        section: 'brot',
        unit: 'Liter',
        base: { 3: 2 },
      },
      {
        id: 'weck',
        name: 'Weck',
        section: 'broetchen',
        products: [{ id: 'test-weck', factor: 1 }],
        base: { 2: 40, 3: 30, 4: 40, 5: 40, 6: 60, 7: 80 },
      },
      {
        id: 'plunder',
        name: 'Plunder',
        section: 'kaffeestueckchen',
        products: [{ id: 'test-plunder', factor: 1 }],
        plu: [906],
        tray: { no: [7, 8, 9], per_tray: 10 },
        base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 0 },
      },
      {
        id: 'schnecke',
        name: 'Schnecke',
        section: 'kaffeestueckchen',
        tray: { no: 3 },
        base: { 2: 6, 3: 5, 4: 6, 5: 6 },
      },
      {
        id: 'zopf-gefuellt',
        name: 'Zopf gefüllt',
        section: 'hefeteig',
        products: [{ id: 'test-zopf-gefuellt', factor: 1 }],
        variants: ['nuss', 'mohn'],
        dough: { id: 'hefeteig-test', piece_g: 500, pieces: 1 },
        filling_g: 400,
        base: { 6: { nuss: 4, mohn: 2 } },
      },
      {
        id: 'kranz-gefuellt',
        name: 'Kranz gefüllt',
        section: 'hefeteig',
        products: [
          { id: 'test-kranz-gefuellt', factor: 1 },
          { id: 'test-kranz-gefuellt-viertel', factor: 0.25 },
        ],
        variants: ['nuss', 'mohn'],
        // Q-B3: hier einstellbar (Testwert 2 × 600 g)
        dough: { id: 'hefeteig-test', piece_g: 600, pieces: 2 },
        filling_g: { nuss: 1000, mohn: 800 },
        base: { 6: { nuss: 3, mohn: 1 } },
      },
      {
        id: 'kranz',
        name: 'Kranz',
        section: 'hefeteig',
        products: [
          { id: 'test-kranz', factor: 1 },
          { id: 'test-kranz-viertel', factor: 0.25 },
        ],
        dough: { id: 'hefeteig-test', piece_g: 600, pieces: 3 },
        base: { 6: 2 },
      },
    ],
    doughs: [
      { id: 'hefeteig-test', name: 'Hefeteig (Test)', batch_max_kg: 10 },
    ],
    fillings: [
      {
        id: 'nuss',
        name: 'Nussfüllung',
        recipe: 'data/recipes/fillings/test.md',
        section: 'Nussfüllung',
      },
      {
        id: 'mohn',
        name: 'Mohnfüllung',
        recipe: 'data/recipes/fillings/test.md',
        section: 'Mohnfüllung',
      },
    ],
    prep: [
      {
        id: 'sauerteig',
        name: 'Sauerteig',
        by_weekday: { 3: 'buttermilch', 6: false, default: 'misch' },
      },
      { id: 'bruehstueck', name: 'Brühstück Vollkorn', when_item: 'vollkorn' },
      { id: 'wagen', name: 'Kaffeestückchen-Wagen', days: [2, 3, 4, 5] },
      {
        id: 'samstag-only',
        name: 'Hefeteig ansetzen',
        by_weekday: { 6: 'gross' },
        variant_labels: { gross: 'groß' },
      },
    ],
    ...overrides,
  }
}

/** Ein erfundenes Rezept im hq-Format (zwei Fuellungen in einer Datei). */
const RECIPE_MD = `# 🧁 Testfüllungen

### 🌰 Nussfüllung
| Zutat            | Menge    |
|------------------|----------|
| Nüsse (gemahlen) | 1.000 g  |
| Wasser           | 1.000 ml |

---

### Mohnfüllung
| Zutat        | Menge               |
|--------------|---------------------|
| Mohn         | 1,5 kg              |
| Zucker       | 400 g (nach Bedarf) |
| Bindemittel*** | 100 g             |

---

### Apfeltest
| Zutat      | Menge             |
|------------|-------------------|
| Äpfel      | 1 Dose (ca. 2 kg) |
| Zitrone    | 2–4 g             |
| Zucker     | 200 g             |
`

module.exports = { PRODUCTS, config, RECIPE_MD }
