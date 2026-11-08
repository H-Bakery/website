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

/**
 * Erfundene Produkte fuer `configV2()` (Backzettel v2, Z10). Kein Wert aus hq.
 */
const PRODUCTS_V2 = [
  { id: 'test-korn-500', numeric_id: 951 },
  { id: 'test-korn-1000', numeric_id: 952 },
  { id: 'test-holz-500', numeric_id: 953 },
  { id: 'test-misch-1000', numeric_id: 954 },
  { id: 'test-kerb-500', numeric_id: 955 },
  { id: 'test-doppel', numeric_id: 956 },
  { id: 'test-stern', numeric_id: 957 },
  { id: 'test-kaese', numeric_id: 958 },
  { id: 'test-flitweck', numeric_id: 959 },
  { id: 'test-plunder-v2', numeric_id: 960 },
  { id: 'test-zopf-v2', numeric_id: 961 },
]

/**
 * Backzettel v2 (docs/backzettel-v2.md §2, §6): Teigtage Di-Sa (Sonntag wird
 * nur gebacken), 20 Stück je Bruch, kg je Liter 2/3/5.
 *
 * - Brot je Laibgroesse: Testkorn (eine Groesse ohne Teiggewicht) und Testholz
 *   teilen sich eine Literzahl (`combined_with`), Testholz mit Testsauer;
 *   Testmisch und Testkerb (fester Anteil Mischteig + Körner).
 * - Brötchen in Bruch, Teig am Teigtag davor: Testdoppel (2 Teigstücke je
 *   Brötchen), Teststern + Testkäse in einer Gruppe, Testflitweck mit Gewicht
 *   je Backtag (Samstag zwei Teigtage voraus, übrige Tage ohne Gewicht),
 *   dazu Einzelstücke (Testparty ohne bekannte Stückzahl).
 * - Hefeteig wie v1, der gefüllte Zopf mit `filling_g: null` (Gramm offen).
 * - Ein altes Liter-Brot (Testhafer) bleibt, wie es ist.
 *
 * Erwartete offene Stammdaten: siehe `OPEN_V2`.
 */
function configV2(overrides = {}) {
  return {
    version: 1,
    days: [2, 3, 4, 5, 6, 7],
    dough_days: [2, 3, 4, 5, 6],
    bruch_pieces: 20,
    sections: [
      'vorbereitung',
      'brot',
      'broetchen',
      'kaffeestueckchen',
      'hefeteig',
    ],
    items: [
      {
        id: 'test-korn',
        name: 'Testkorn',
        section: 'brot',
        dough: { id: 'test-korn-teig' },
        sizes: [
          { id: 'g500', label: '500 g', dough_g: 600 },
          { id: 'g1000', label: '1 kg', dough_g: 1000 },
          { id: 'kasten', label: 'Kasten', dough_g: null },
        ],
        products: [
          { id: 'test-korn-500', size: 'g500' },
          { id: 'test-korn-1000', size: 'g1000' },
        ],
        base: {
          2: { g500: 4, g1000: 2, kasten: null },
          6: { g500: 8, g1000: 3 },
        },
      },
      {
        id: 'test-holz',
        name: 'Testholz',
        section: 'brot',
        dough: { id: 'test-holz-teig' },
        sizes: [{ id: 'g500', label: '500 g', dough_g: 600 }],
        products: [{ id: 'test-holz-500', size: 'g500' }],
        base: { 2: { g500: 2 }, 6: { g500: 6 } },
      },
      {
        id: 'test-misch',
        name: 'Testmisch',
        section: 'brot',
        dough: { id: 'test-misch-teig' },
        sizes: [{ id: 'g1000', label: '1 kg', dough_g: 1000 }],
        products: [{ id: 'test-misch-1000', size: 'g1000' }],
        base: { 6: { g1000: 4 } },
      },
      {
        id: 'test-kerb',
        name: 'Testkerb',
        section: 'brot',
        dough: { id: 'test-misch-teig' },
        sizes: [{ id: 'g500', label: '500 g', dough_g: 600 }],
        products: [{ id: 'test-kerb-500', size: 'g500' }],
        from_dough: {
          id: 'test-misch-teig',
          mode: 'fixed',
          dough_kg: 5,
          extras: [{ name: 'Körner', kg: 1 }],
        },
        base: { 6: { g500: 10 } },
      },
      {
        id: 'test-hafer',
        name: 'Testhafer',
        section: 'brot',
        unit: 'Liter',
        base: { 3: 1.5 },
        pieces_per_liter: 2,
      },
      {
        id: 'test-doppel',
        name: 'Testdoppel',
        section: 'broetchen',
        products: [{ id: 'test-doppel' }],
        lead: 1,
        dough: { id: 'test-weck-teig' },
        bruch: { g: 1200, per_product: 2 },
        base: { 2: 40, 7: 60 },
      },
      {
        id: 'test-stern',
        name: 'Teststern',
        section: 'broetchen',
        products: [{ id: 'test-stern' }],
        lead: 1,
        dough: { id: 'test-weck-teig' },
        bruch: { g: 2000, group: 'test-gemischt' },
        base: { 2: 12, 7: 12 },
      },
      {
        id: 'test-kaese',
        name: 'Testkäse',
        section: 'broetchen',
        products: [{ id: 'test-kaese' }],
        lead: 1,
        dough: { id: 'test-weck-teig' },
        bruch: { g: 2000, group: 'test-gemischt' },
        base: { 2: 8, 7: 8 },
      },
      {
        id: 'test-flitweck',
        name: 'Testflitweck',
        section: 'broetchen',
        products: [{ id: 'test-flitweck' }],
        lead: { default: 1, 6: 2 },
        dough: { id: 'test-flit-teig' },
        bruch: { g: { 7: 1000, 2: 1200, default: null } },
        base: { 2: 20, 6: 20, 7: 40 },
      },
      {
        id: 'test-flit-klein',
        name: 'Testflit klein',
        section: 'broetchen',
        lead: 1,
        dough: { id: 'test-flit-teig', piece_g: 300 },
        base: { 7: 10 },
      },
      {
        id: 'test-party',
        name: 'Testparty',
        section: 'broetchen',
        lead: 1,
        dough: { id: 'test-flit-teig', piece_g: 250, pieces: null },
        base: { 6: 5 },
      },
      {
        id: 'test-plunder',
        name: 'Testplunder',
        section: 'kaffeestueckchen',
        products: [{ id: 'test-plunder-v2', factor: 1 }],
        tray: { no: [1, 2], per_tray: 10 },
        base: { 2: 10, 6: 20 },
      },
      {
        id: 'test-zopf',
        name: 'Testzopf gefüllt',
        section: 'hefeteig',
        products: [{ id: 'test-zopf-v2', factor: 1 }],
        variants: ['nuss', 'mohn'],
        dough: { id: 'test-hefe', piece_g: 500 },
        filling_g: null,
        base: { 6: { nuss: 4, mohn: 2 } },
      },
      {
        id: 'test-kranz',
        name: 'Testkranz',
        section: 'hefeteig',
        dough: { id: 'test-hefe', piece_g: 600, pieces: 2 },
        base: { 6: 3 },
      },
    ],
    doughs: [
      {
        id: 'test-korn-teig',
        name: 'Testkorn',
        kg_per_liter: 2,
        liter_rounding: { step: 0.5, mode: 'up' },
        batch_max_kg: null,
        combined_name: 'Korn + Holz',
      },
      {
        id: 'test-holz-teig',
        name: 'Testholz',
        kg_per_liter: 2,
        batch_max_kg: null,
        combined_with: 'test-korn-teig',
        addons: [
          {
            id: 'test-sauer',
            name: 'Testsauer',
            g_per_liter: 10,
            rounding: { step: 5, mode: 'nearest' },
          },
        ],
      },
      {
        id: 'test-misch-teig',
        name: 'Testmisch',
        kg_per_liter: 3,
        liter_rounding: { step: 0.1, mode: 'up' },
        batch_max_kg: null,
      },
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        kg_per_liter: 3,
        liter_rounding: { step: 0.5, mode: 'nearest' },
        batch_max_kg: 40,
      },
      {
        id: 'test-flit-teig',
        name: 'Testflit',
        kg_per_liter: null,
        liter_rounding: null,
        batch_max_kg: null,
      },
      {
        id: 'test-hefe',
        name: 'Testhefe',
        kg_per_liter: 5,
        liter_rounding: { step: 1, mode: 'nearest' },
        batch_max_kg: null,
      },
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
      { id: 'test-sauerteig', name: 'Testsauerteig', days: [2, 3, 4, 5, 6] },
    ],
    ...overrides,
  }
}

/** Die offenen Stammdaten von `configV2()` (Pfad, Code) in der Reihenfolge des Validators. */
const OPEN_V2 = [
  ['doughs[0].batch_max_kg', 'batch_max_kg_unknown'],
  ['doughs[1].batch_max_kg', 'batch_max_kg_unknown'],
  ['doughs[2].batch_max_kg', 'batch_max_kg_unknown'],
  ['doughs[4].batch_max_kg', 'batch_max_kg_unknown'],
  ['doughs[5].batch_max_kg', 'batch_max_kg_unknown'],
  ['doughs[4].kg_per_liter', 'kg_per_liter_unknown'],
  ['doughs[4].liter_rounding', 'liter_rounding_unknown'],
  ['items[0].sizes[2].dough_g', 'dough_g_unknown'],
  ['items[8].bruch.g.default', 'bruch_g_unknown'],
  ['items[10].dough.pieces', 'pieces_unknown'],
  ['items[12].filling_g', 'filling_g_unknown'],
]

module.exports = {
  PRODUCTS,
  config,
  RECIPE_MD,
  PRODUCTS_V2,
  configV2,
  OPEN_V2,
}
