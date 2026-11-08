/**
 * Erfundene Antworten der Grundmengen-Endpunkte für die Specs (Z4). Keine
 * Werte aus hq - Posten, Mengen und Kassennummern sind ausgedacht.
 */
import type {
  BackzettelConfigView,
  GrundmengenConfig,
  ReferenceResponse,
} from './grundmengenApi'

export function syntheticConfig(
  overrides: Partial<GrundmengenConfig> = {}
): GrundmengenConfig {
  return {
    days: [2, 3, 4, 5, 6, 7],
    sections: ['brot', 'broetchen', 'hefeteig'],
    items: [
      {
        id: 'testbrot',
        name: 'Testbrot',
        section: 'brot',
        unit: 'Liter',
        variants: [],
        plu: [901],
        base: { 2: 4, 3: 4.5, 6: null },
      },
      {
        id: 'testweck',
        name: 'Testweck',
        section: 'broetchen',
        unit: 'Stück',
        variants: [],
        plu: [903],
        base: { 2: 40, 3: 30, 6: 60 },
      },
      {
        id: 'testzopf',
        name: 'Testzopf gefüllt',
        section: 'hefeteig',
        unit: 'Stück',
        variants: ['nuss', 'mohn'],
        plu: [905],
        base: { 6: { nuss: 4, mohn: null } },
      },
    ],
    fillings: [
      { id: 'nuss', name: 'Nussfüllung' },
      { id: 'mohn', name: 'Mohnfüllung' },
    ],
    ...overrides,
  }
}

export function syntheticView(
  overrides: Partial<BackzettelConfigView> = {}
): BackzettelConfigView {
  const config = syntheticConfig()
  return {
    status: 'ok',
    config,
    errors: [],
    warnings: [],
    pendingApproval: false,
    writable: true,
    working: { status: 'ok', config, errors: [], warnings: [] },
    ...overrides,
  }
}

export function syntheticReference(): ReferenceResponse {
  const day = (weekday: number, weekdayName: string, weck: number | null) => ({
    weekday,
    weekdayName,
    weeks: 6,
    dates: weck === null ? [] : ['2026-11-28', '2026-11-21'],
    skippedDates: [],
    items: [
      {
        itemId: 'testbrot',
        plu: [901],
        median: weck === null ? null : 7,
        samples: weck === null ? [] : [6, 8],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
      {
        itemId: 'testweck',
        plu: [903],
        median: weck,
        samples: weck === null ? [] : [weck - 2, weck + 2],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
      {
        itemId: 'testzopf',
        plu: [905],
        median: weck === null ? null : 5,
        samples: weck === null ? [] : [4, 6],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
    ],
  })
  return {
    status: 'ok',
    available: true,
    today: '2026-12-02',
    weeks: 6,
    weekdays: [
      day(2, 'Dienstag', 38),
      day(3, 'Mittwoch', 27),
      day(4, 'Donnerstag', null),
      day(5, 'Freitag', null),
      day(6, 'Samstag', 58),
      day(7, 'Sonntag', null),
    ],
  }
}

/**
 * Z10: Laibgrößen, Bruch-Posten (Stück am Backtag, Teig am Vortag) und
 * offene Stammdaten - erfunden wie oben.
 */
export function syntheticConfigV2(
  overrides: Partial<GrundmengenConfig> = {}
): GrundmengenConfig {
  return {
    days: [2, 3, 4, 5, 6, 7],
    sections: ['brot', 'broetchen'],
    items: [
      {
        id: 'testkorn',
        name: 'Testkorn',
        section: 'brot',
        unit: 'Laib',
        variants: ['g500', 'g1000'],
        variantKind: 'size',
        sizes: [
          { id: 'g500', label: '500 g', dough_g: null },
          { id: 'g1000', label: '1 kg', dough_g: null },
        ],
        plu: [981],
        base: { 6: { g500: 8, g1000: null } },
      },
      {
        id: 'testdoppel',
        name: 'Testdoppel',
        section: 'broetchen',
        unit: 'Stück',
        variants: [],
        plu: [913],
        base: { 2: 30, 6: 25, 7: null },
        bruch: { per_product: 2, group: 'testdoppel', piecesPerBruch: 20 },
        lead: { default: 1 },
      },
      {
        id: 'testflitweck',
        name: 'Testflitweck',
        section: 'broetchen',
        unit: 'Stück',
        variants: [],
        plu: [915],
        base: { 2: 20 },
        bruch: { per_product: 1, group: 'testflitweck', piecesPerBruch: null },
        lead: { default: 1 },
      },
    ],
    fillings: [],
    ...overrides,
  }
}

/**
 * Z10 §9 Punkt 10: Referenz zu `syntheticConfigV2` - Testkorn mit Median je
 * Laibgröße (500 g über PLU 981, 1 kg ohne eigene Kassennummer = unbekannt).
 */
export function syntheticReferenceV2(): ReferenceResponse {
  return {
    status: 'ok',
    available: true,
    today: '2026-12-02',
    weeks: 6,
    weekdays: [
      {
        weekday: 6,
        weekdayName: 'Samstag',
        weeks: 6,
        dates: ['2026-11-28', '2026-11-21'],
        skippedDates: [],
        items: [
          {
            itemId: 'testkorn',
            plu: [981, 982],
            median: 9,
            samples: [8, 10],
            status: 'ok',
            converted: false,
            sizes: [
              {
                sizeId: 'g500',
                plu: [981],
                median: 6,
                samples: [5, 7],
                status: 'ok',
                converted: false,
              },
              {
                sizeId: 'g1000',
                plu: [],
                median: null,
                samples: [],
                status: 'unknown',
                converted: false,
              },
            ],
          },
        ],
      },
    ],
  }
}

export function syntheticViewV2(
  overrides: Partial<BackzettelConfigView> = {}
): BackzettelConfigView {
  const config = syntheticConfigV2()
  const open = [
    {
      path: 'items[2].bruch.pieces',
      code: 'bruch_pieces_unknown',
      message: '„Testflitweck“: Stück je Bruch sind noch offen.',
    },
    {
      path: 'doughs[0].kg_per_liter',
      code: 'kg_per_liter_unknown',
      message: 'Teig „Testkorn“: kg je Liter ist noch offen.',
    },
  ]
  return {
    status: 'ok',
    config,
    errors: [],
    warnings: [],
    pendingApproval: false,
    writable: true,
    open,
    working: { status: 'ok', config, errors: [], warnings: [], open },
    ...overrides,
  }
}
