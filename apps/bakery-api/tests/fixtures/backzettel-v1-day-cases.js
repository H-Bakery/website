/**
 * v1-Tagesrechnungen für den Regressionstest von Backzettel v2 (Z10, S2-R1):
 * die Ergebnisse dieser Fälle sind in `backzettel-v1-day.recorded.json` mit
 * dem Core **vor** Z10 aufgezeichnet (`computeDay`, `computePreorderDeltas`,
 * `variantsForProduct`/`variantsByProduct` und die Tages-Hilfen aus
 * `backzettel-day.core.js`). Eine Konfiguration ohne die neuen Schlüssel muss
 * dieselben Antworten geben - Byte für Byte (nach JSON).
 *
 * Nur erfundene Werte (Basis: `config()` aus `backzettel.synthetic.js`).
 * Neue Fälle hier nur zusammen mit einer neuen Aufnahme des alten Cores
 * ergänzen - sonst nimmt die Aufnahme das neue Verhalten auf.
 *
 * Bewusst nicht aufgenommen: ein gefüllter Posten, dem für eine Sorte das
 * Füllungsgramm fehlt. Dort skalierte v1 das Rezept auf die bekannten Gramm;
 * seit Z10 (Regel 7, docs/backzettel-v2.md §3) gibt es dann kein Rezept.
 */
const recipesCore = require('../../src/services/backzettel-recipes.core')
const { PRODUCTS, config, RECIPE_MD } = require('./backzettel.synthetic')

const MON = '2026-11-23'
const TUE = '2026-11-24'
const WED = '2026-11-25'
const THU = '2026-11-26'
const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'

const RECIPES = {
  nuss: recipesCore.parseFillingRecipe(RECIPE_MD, { section: 'Nussfüllung' }),
  mohn: recipesCore.parseFillingRecipe(RECIPE_MD, { section: 'Mohnfüllung' }),
}

const CAP = [
  {
    weekday: 2,
    active: true,
    items: [
      { productSlug: 'test-weck', productId: 907, quantity: 12 },
      { productSlug: 'test-kornbrot', quantity: 3 },
      { productSlug: 'fremd', quantity: 2 },
    ],
  },
  {
    weekday: 2,
    active: false,
    items: [{ productSlug: 'test-weck', quantity: 99 }],
  },
  {
    weekday: 6,
    active: true,
    items: [
      { productSlug: 'test-kranz-viertel', quantity: 1 },
      { productId: 906, quantity: 4 },
    ],
  },
]

function preorders(date) {
  return [
    { preorderId: 1, productId: 'test-weck', qty: 7, pickupDate: date },
    {
      preorderId: 2,
      productId: 'test-kranz-viertel',
      qty: 3,
      pickupDate: date,
    },
    {
      preorderId: 2,
      productId: 'test-kranz-gefuellt-viertel',
      variant: 'nuss',
      qty: 2,
      pickupDate: date,
    },
    {
      preorderId: 3,
      productId: 903,
      variant: 'mohn',
      qty: 1,
      pickupDate: date,
    },
    {
      preorderId: 4,
      productId: 'test-zopf-gefuellt',
      variant: 'marzipan',
      qty: 1,
      pickupDate: date,
    },
    {
      preorderId: 5,
      productId: 'test-zopf-gefuellt',
      qty: 2,
      pickupDate: date,
    },
    { preorderId: 6, productId: 'test-weck', variant: 'x', qty: 1, date },
    { preorderId: 7, productId: 'test-unbekannt', qty: 4, pickupDate: date },
    { preorderId: 8, productId: 909, qty: 1, pickupDate: date },
    {
      preorderId: 9,
      productId: 'test-weck',
      qty: 50,
      pickupDate: date,
      status: 'storniert',
    },
    { preorderId: 10, productId: 'test-weck', qty: 3, pickupDate: SUN },
    { preorderId: 11, productId: 'test-weck', qty: 'abc', pickupDate: date },
  ]
}

const CORRECTIONS = [
  { itemId: 'weck', qty: 5, reason: 'Markt' },
  { itemId: 'weck', qty: -2, reason: 'Regen' },
  { itemId: 'plunder', qty: -100, reason: 'zu viel' },
  { itemId: 'zopf-gefuellt', variant: 'nuss', qty: 1, reason: 'Fest' },
  { itemId: 'gibt-es-nicht', qty: 1 },
  { itemId: 'zopf-gefuellt', variant: 'marzipan', qty: 1 },
  { itemId: 'kornbrot', qty: 0.25, reason: 'Halbe' },
]

function full(date, extra = {}) {
  return {
    config: config(),
    date,
    preorderItems: preorders(date),
    capTemplate: CAP,
    corrections: CORRECTIONS,
    recipes: RECIPES,
    catalog: PRODUCTS,
    ...extra,
  }
}

function withItem(index, patch) {
  const cfg = config()
  cfg.items[index] = { ...cfg.items[index], ...patch }
  return cfg
}

/** `{ name: (cores) => Ergebnis }`; `cores = { core, day, configCore }`. */
const V1_DAY_CASES = {
  'woche-ohne-eingaben': ({ core }) =>
    [MON, TUE, WED, THU, FRI, SAT, SUN].map((date) =>
      core.computeDay({ config: config(), date })
    ),
  'woche-mit-allem': ({ core }) =>
    [MON, TUE, WED, SAT, SUN].map((date) => core.computeDay(full(date))),
  'samstag-saison-und-leer': ({ core }) => [
    core.computeDay(full(SAT, { seasonFactor: 1.1 })),
    core.computeDay(full(SAT, { seasonFactor: 0.8, includeEmpty: true })),
    core.computeDay(full(SAT, { seasonFactor: -1 })),
  ],
  'dienstag-liter-saison': ({ core }) =>
    core.computeDay(full(TUE, { seasonFactor: 1.15 })),
  'verschachtelte-vorbestellungen': ({ core }) =>
    core.computeDay({
      config: config(),
      date: SAT,
      preorderItems: [
        {
          id: 21,
          date: SAT,
          status: 'offen',
          items: [
            { productSlug: 'test-kranz', quantity: 2 },
            { productId: 'test-zopf-gefuellt', variant: 'mohn', qty: 1 },
          ],
        },
        {
          id: 22,
          pickupDate: SAT,
          status: 'cancelled',
          items: [{ productId: 'test-kranz', qty: 9 }],
        },
      ],
      recipes: RECIPES,
    }),
  'grundmenge-offen': ({ core }) => [
    core.computeDay({
      config: withItem(5, { base: { 6: null } }),
      date: SAT,
      recipes: RECIPES,
    }),
    core.computeDay({
      config: withItem(5, { base: { 6: { nuss: null, mohn: 2 } } }),
      date: SAT,
      preorderItems: [
        {
          productId: 'test-zopf-gefuellt',
          variant: 'nuss',
          qty: 2,
          pickupDate: SAT,
        },
      ],
    }),
    core.computeDay({
      config: withItem(2, { base: { 2: null, 3: 30 } }),
      date: TUE,
    }),
  ],
  'ohne-rezepte-und-ohne-charge': ({ core }) => {
    const cfg = config()
    delete cfg.doughs[0].batch_max_kg
    return core.computeDay({ config: cfg, date: SAT })
  },
  'hefeteig-und-fuellungen-direkt': ({ core, configCore }) => {
    const cfg = configCore.normalizeConfig(config())
    const r = core.computeDay(full(SAT))
    return {
      hefeteig: core.computeHefeteig(cfg, r.lines),
      fillings: core.computeFillings(cfg, r.lines, RECIPES, []),
      prep: core.computePrep(cfg, r.lines, 6),
    }
  },
  'preorder-deltas': ({ core }) => {
    const before = preorders(SAT).slice(0, 6)
    const after = [
      ...preorders(SAT).slice(1, 4),
      { preorderId: 1, productId: 'test-weck', qty: 9, pickupDate: SAT },
      {
        preorderId: 12,
        productId: 'test-kranz-viertel',
        qty: 1,
        pickupDate: SAT,
      },
    ]
    return [
      core.computePreorderDeltas({
        config: config(),
        date: SAT,
        before,
        after,
        catalog: PRODUCTS,
      }),
      core.computePreorderDeltas({
        config: config(),
        date: MON,
        before: [],
        after: preorders(MON),
      }),
      core.computePreorderDeltas({
        config: config(),
        date: '2026-02-30',
        before: [],
        after: [],
      }),
    ]
  },
  'zeilen-deltas': ({ core }) => {
    const a = core.computeDay(full(SAT))
    const b = core.computeDay(full(SAT, { preorderItems: [] }))
    return core.computeDeltas(a.lines, b.lines)
  },
  varianten: ({ core }) => ({
    single: [
      'test-kranz-gefuellt-viertel',
      'test-weck',
      907,
      'test-kornbrot',
      'gibt-es-nicht',
    ].map((id) => core.variantsForProduct(config(), id, PRODUCTS)),
    all: core.variantsByProduct(config()),
  }),
  'tag-schnappschuss-und-freigabe': ({ core, day, configCore }) => {
    const cfg = configCore.normalizeConfig(config())
    const r = core.computeDay(full(SAT, { config: cfg }))
    const rows = day
      .linesForConfirm(r.lines)
      .map((row, i) => ({ id: i + 1, ...row }))
      .reverse()
    const snapshot = day.computedSnapshot(r)
    const frozen = day.frozenSections(rows, cfg, snapshot.unsetKeys)
    const frozenLines = frozen.flatMap((s) => s.lines.map((l) => l.line))
    const deltaByKey = {
      'kranz|': { qty: 0.25 },
      'weck|': { qty: 3 },
      'zopf-gefuellt|mohn': { qty: 1 },
    }
    const extras = day.deltaBakeExtras(
      frozenLines,
      deltaByKey,
      snapshot.preordersExact,
      snapshot.subtotalExact
    )
    const withExtras = day.linesWithExtras(frozenLines, extras)
    return {
      snapshot,
      frozen: frozen.map((s) => ({
        id: s.id,
        label: s.label,
        lines: s.lines.map((l) => l.line),
      })),
      noConfig: day.frozenSections(rows, null),
      extras,
      diff: day.hefeteigFillingsDiff(
        { hefeteig: r.hefeteig, fillings: r.fillings },
        {
          hefeteig: core.computeHefeteig(cfg, withExtras),
          fillings: core.computeFillings(cfg, withExtras, RECIPES, []),
        }
      ),
      linesForDeltas: day.linesForDeltas(
        frozenLines,
        [{ key: 'schnecke|', itemId: 'schnecke', variant: '' }],
        cfg
      ),
    }
  },
  'tag-vorbestellungen-und-abgleich': ({ day, configCore }) => {
    const cfg = configCore.normalizeConfig(config())
    const snap = day.snapshotFromPreorders([
      {
        id: 2,
        status: 'offen',
        items: [
          { productId: 'test-weck', variant: '', quantity: 3 },
          { productId: 'test-zopf-gefuellt', variant: 'nuss', quantity: 1 },
          { productId: 'test-kranz-viertel', quantity: 1 },
        ],
      },
      {
        id: 1,
        status: 'abgeholt',
        items: [{ productId: 'test-weck', variant: null, quantity: 2 }],
      },
      {
        id: 3,
        status: 'storniert',
        items: [{ productId: 'test-weck', quantity: 50 }],
      },
    ])
    const current = [
      ...snap.slice(1),
      { preorderId: 4, productId: 'test-weck', variant: '', qty: 4 },
    ]
    return {
      snap,
      core: day.toCorePreorderItems(snap, SAT),
      reconcile: day.reconcileDeltas({
        config: cfg,
        date: SAT,
        snapshot: snap,
        current,
        recorded: [{ itemId: 'weck', variant: '', preorderId: 4, qty: 1 }],
        catalog: PRODUCTS,
        orders: { 1: 'abgeholt', 2: 'offen', 4: 'offen' },
      }),
    }
  },
}

module.exports = { V1_DAY_CASES, RECIPES, fullArgs: full }
