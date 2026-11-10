/**
 * Erfundene Backzettel-Antworten für die Specs (Z5/Z6/Z7). Kein Wert stammt
 * aus `hq`: Namen tragen „Test“, Mengen sind rund, damit man sie nachrechnen
 * kann. Form = `GET /api/backzettel/:datum` der echten API (Z3).
 */

import type {
  BakeList,
  BackzettelConfigData,
  BackzettelConfigResponse,
  BackzettelDay,
  BackzettelDeltaEntry,
  BackzettelLine,
  BreadRow,
  BruchGroup,
  DoughSummary,
  MachineBox,
  MissingPart,
  RollsBlock,
  SingleRow,
} from './backzettelApi'

export const SAT = '2026-11-28'
export const TUE = '2026-11-24'

export function line(overrides: Partial<BackzettelLine>): BackzettelLine {
  const itemId = overrides.itemId ?? 'test-weck'
  const variant = overrides.variant ?? null
  return {
    id: null,
    key: `${itemId}|${variant ?? ''}`,
    itemId,
    name: 'Testweck',
    section: 'broetchen',
    unit: 'Stück',
    variant,
    base: 60,
    baseUnset: false,
    seasonal: 0,
    preorders: 0,
    cap: 0,
    correction: 0,
    correctionReason: null,
    correctionBy: null,
    total: 60,
    tray: null,
    plu: [],
    doneAt: null,
    doneBy: null,
    delta: null,
    ...overrides,
  }
}

export const TEST_CONFIG: BackzettelConfigData = {
  version: 1,
  days: [2, 3, 4, 5, 6, 7],
  sections: ['brot', 'broetchen', 'hefeteig'],
  items: [
    {
      id: 'test-kornbrot',
      name: 'Testkornbrot',
      section: 'brot',
      unit: 'Liter',
      variants: [],
    },
    {
      id: 'test-weck',
      name: 'Testweck',
      section: 'broetchen',
      unit: 'Stück',
      variants: [],
    },
    {
      id: 'test-zopf',
      name: 'Testzopf gefüllt',
      section: 'hefeteig',
      unit: 'Stück',
      variants: ['nuss', 'mohn'],
    },
  ],
  doughs: [{ id: 'test-hefeteig', name: 'Testhefeteig', batch_max_kg: 10 }],
  fillings: [
    { id: 'nuss', name: 'Testnussfüllung' },
    { id: 'mohn', name: 'Testmohnfüllung' },
  ],
  prep: [{ id: 'sauerteig', name: 'Testsauerteig' }],
}

export const CONFIG_RESPONSE: BackzettelConfigResponse = {
  status: 'ok',
  source: 'backzettel.yaml',
  loadedAt: '2026-11-27T10:00:00.000Z',
  config: TEST_CONFIG,
  errors: [],
  warnings: [],
  recipesMissing: [],
  catalogSize: 9,
}

/** Samstag-Entwurf mit Hefeteig, Füllungen, Vorbestellung mit Sorte. */
export function saturdayDraft(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  return {
    date: SAT,
    weekday: 6,
    weekdayName: 'Samstag',
    status: 'draft',
    seasonFactor: 1,
    confirmedBy: null,
    confirmedAt: null,
    sections: [
      {
        id: 'brot',
        label: 'Brot',
        lines: [
          line({
            itemId: 'test-kornbrot',
            name: 'Testkornbrot',
            section: 'brot',
            unit: 'Liter',
            base: 2.25,
            total: 2.25,
            loavesEstimate: 5,
          }),
        ],
      },
      {
        id: 'broetchen',
        label: 'Brötchen',
        lines: [
          line({
            base: 60,
            cap: 10,
            correction: -5,
            correctionReason: 'Testgrund',
            correctionBy: { id: 2, displayName: 'Test Backstube' },
            total: 65,
          }),
        ],
      },
      {
        id: 'hefeteig',
        label: 'Hefeteig',
        lines: [
          line({
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            section: 'hefeteig',
            variant: 'nuss',
            base: 4,
            preorders: 2,
            total: 6,
          }),
          line({
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            section: 'hefeteig',
            variant: 'mohn',
            base: 0,
            baseUnset: true,
            total: 0,
          }),
        ],
      },
    ],
    hefeteig: {
      doughs: [
        {
          id: 'test-hefeteig',
          name: 'Testhefeteig',
          batch_max_kg: 10,
          pieces: 6,
          dough_g: 3000,
          batches: 1,
          weighing: [
            {
              piece_g: 500,
              pieces: 6,
              items: [
                {
                  itemId: 'test-zopf',
                  name: 'Testzopf gefüllt',
                  products: 6,
                  piecesPerProduct: 1,
                  pieces: 6,
                },
              ],
            },
          ],
        },
      ],
      pieces: 6,
      dough_g: 3000,
    },
    fillings: [
      {
        id: 'nuss',
        name: 'Testnussfüllung',
        grams: 2400,
        missingFillingG: false,
        items: [
          {
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            pieces: 6,
            filling_g: 400,
            grams: 2400,
          },
        ],
        recipe: {
          title: 'Testnussfüllung',
          batch_g: 2000,
          grams: 2400,
          factor: 1.2,
          complete: true,
          ingredients: [
            {
              name: 'Testnüsse',
              g: 1000,
              unit: 'g',
              raw: '1.000 g',
              scaled_g: 1200,
            },
            {
              name: 'Testwasser',
              g: 1000,
              unit: 'g',
              raw: '1.000 ml',
              scaled_g: 1200,
            },
          ],
        },
        recipeMissing: false,
      },
    ],
    prep: [{ id: 'sauerteig', name: 'Testsauerteig', variant: 'misch' }],
    prepDate: '2026-11-27',
    prepDateProvisional: false,
    deltas: [],
    warnings: [
      {
        code: 'base_unset',
        message:
          'Grundmenge für Samstag noch nicht festgelegt: Testzopf gefüllt (mohn).',
      },
    ],
    configStatus: 'ok',
    ...overrides,
  }
}

/** Derselbe Samstag freigegeben, mit einem offenen und einem quittierten Nachtrag. */
export function saturdayConfirmed(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  const draft = saturdayDraft()
  return {
    ...draft,
    status: 'confirmed',
    confirmedBy: { id: 2, displayName: 'Test Backstube' },
    confirmedAt: '2026-11-27T13:00:00.000Z',
    // Eindeutige Zeilen-IDs ab 101 in Zettelreihenfolge (das Tablet hakt
    // über die ID ab).
    sections: draft.sections.map((s, si) => ({
      ...s,
      lines: s.lines.map((l, i) => ({
        ...l,
        id:
          101 +
          i +
          draft.sections
            .slice(0, si)
            .reduce((n, prev) => n + prev.lines.length, 0),
        delta:
          l.key === 'test-zopf|nuss' ? { qty: 2, open: 1, count: 2 } : null,
      })),
    })),
    deltas: [
      {
        id: 7,
        key: 'test-zopf|nuss',
        itemId: 'test-zopf',
        name: 'Testzopf gefüllt',
        unit: 'Stück',
        variant: 'nuss',
        qty: 1,
        kind: 'added',
        preorderId: 41,
        preorderCode: 'LA-2026-11-28-03',
        createdAt: '2026-11-27T15:00:00.000Z',
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
      {
        id: 8,
        key: 'test-zopf|nuss',
        itemId: 'test-zopf',
        name: 'Testzopf gefüllt',
        unit: 'Stück',
        variant: 'nuss',
        qty: 1,
        kind: 'changed',
        preorderId: 42,
        preorderCode: 'LA-2026-11-28-04',
        createdAt: '2026-11-27T15:30:00.000Z',
        acknowledgedAt: '2026-11-27T16:00:00.000Z',
        acknowledgedBy: { id: 2, displayName: 'Test Backstube' },
      },
    ],
    configChangedSinceConfirm: false,
    ...overrides,
  }
}

// ------------------------------------------------------------ Z10 (v2)
//
// Teigtag-Zettel nach docs/backzettel-v2.md §4.3, Form wie
// `GET /api/backzettel/:datum` der echten API seit S3. Erfundene Posten
// („Test…“) und runde Zahlen - nichts aus hq: Brot je Laibgröße (Testkorn +
// Testholz teilen eine Literzahl), Brötchen in Bruch für Sonntag und
// Dienstag (Teig am Samstag), Hefeteig. Offen (null) sind absichtlich: kg je
// Liter und Rundung des Testflit-Teigs, das Bruchgewicht von Testflitweck am
// Dienstag, die Stück je Testparty und die Füllungsgramm.

export const SUN = '2026-11-29'
export const V2_TUE = '2026-12-01'

export const TEST_CONFIG_V2: BackzettelConfigData = {
  version: 1,
  days: [2, 3, 4, 5, 6, 7],
  sections: ['brot', 'broetchen', 'kaffeestueckchen', 'hefeteig'],
  items: [
    {
      id: 'test-korn',
      name: 'Testkorn',
      section: 'brot',
      unit: 'Stück',
      variants: ['g500', 'g1000', 'kasten'],
      variantKind: 'size',
      sizes: [
        { id: 'g500', label: '500 g', dough_g: 600 },
        { id: 'g1000', label: '1 kg', dough_g: 1000 },
        { id: 'kasten', label: 'Kasten', dough_g: null },
      ],
    },
    {
      id: 'test-holz',
      name: 'Testholz',
      section: 'brot',
      unit: 'Stück',
      variants: ['g500'],
      variantKind: 'size',
      sizes: [{ id: 'g500', label: '500 g', dough_g: 600 }],
    },
    {
      id: 'test-hafer',
      name: 'Testhafer',
      section: 'brot',
      unit: 'Liter',
      variants: [],
    },
    {
      id: 'test-doppel',
      name: 'Testdoppel',
      section: 'broetchen',
      unit: 'Stück',
      variants: [],
    },
    {
      id: 'test-zopf',
      name: 'Testzopf gefüllt',
      section: 'hefeteig',
      unit: 'Stück',
      variants: ['nuss', 'mohn'],
      variantKind: 'filling',
    },
  ],
  doughs: [
    { id: 'test-korn-teig', name: 'Testkorn', batch_max_kg: null },
    { id: 'test-weck-teig', name: 'Testweck', batch_max_kg: 40 },
  ],
  fillings: [
    { id: 'nuss', name: 'Testnussfüllung' },
    { id: 'mohn', name: 'Testmohnfüllung' },
  ],
  prep: [{ id: 'sauerteig', name: 'Testsauerteig' }],
}

export const CONFIG_RESPONSE_V2: BackzettelConfigResponse = {
  ...CONFIG_RESPONSE,
  config: TEST_CONFIG_V2,
}

/** Eine Zeile eines Teigtag-Zettels; `bakeDate` ≠ `sheet` hängt `@Datum` an den Schlüssel. */
export function v2Line(
  overrides: Partial<BackzettelLine> & { itemId: string; name: string },
  sheet = SAT
): BackzettelLine {
  const bakeDate = overrides.bakeDate ?? sheet
  const variant = overrides.variant ?? null
  const total = overrides.total ?? overrides.base ?? 0
  return line({
    key: `${overrides.itemId}|${variant ?? ''}${
      bakeDate === sheet ? '' : `@${bakeDate}`
    }`,
    base: total,
    total,
    bakeDate,
    doughDate: sheet,
    lead: bakeDate === sheet ? 0 : 1,
    variantKind: null,
    variantLabel: null,
    // wie der Server: Grundmenge offen ohne Korrektur = Mindestmenge
    totalIsMinimum: Boolean(overrides.baseUnset) && !overrides.correction,
    ...overrides,
  })
}

function sizeLine(
  itemId: string,
  name: string,
  variant: string,
  label: string,
  total: number,
  extra: Partial<BackzettelLine> = {}
): BackzettelLine {
  return v2Line({
    itemId,
    name,
    section: 'brot',
    variant,
    variantKind: 'size',
    variantLabel: label,
    total,
    ...extra,
  })
}

const MISSING_FLITWECK_G = {
  itemId: 'test-flitweck',
  name: 'Testflitweck',
  field: 'bruch.g',
  code: 'bruch_g_unknown',
  message: '„Testflitweck“: Bruchgewicht für Dienstag ist noch offen.',
}
const MISSING_PARTY_PIECES = {
  itemId: 'test-party',
  name: 'Testparty',
  field: 'dough.pieces',
  code: 'pieces_unknown',
  message:
    '„Testparty“: Teigstücke je Produkt sind noch offen – das Teiggewicht bleibt unbekannt.',
}

/** Samstag als Teigtag (Entwurf): Brot, Brötchen für So + Di, Hefeteig. */
export function saturdayV2Draft(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  return {
    date: SAT,
    weekday: 6,
    weekdayName: 'Samstag',
    status: 'draft',
    seasonFactor: 1,
    confirmedBy: null,
    confirmedAt: null,
    sections: [
      {
        id: 'brot',
        label: 'Brot',
        lines: [
          sizeLine('test-korn', 'Testkorn', 'g500', '500 g', 8),
          sizeLine('test-korn', 'Testkorn', 'g1000', '1 kg', 3),
          sizeLine('test-korn', 'Testkorn', 'kasten', 'Kasten', 0, {
            baseUnset: true,
            base: 0,
          }),
          sizeLine('test-holz', 'Testholz', 'g500', '500 g', 6),
          v2Line({
            itemId: 'test-hafer',
            name: 'Testhafer',
            section: 'brot',
            unit: 'Liter',
            total: 1.5,
          }),
        ],
      },
      {
        id: 'broetchen',
        label: 'Brötchen',
        lines: [
          v2Line({
            itemId: 'test-doppel',
            name: 'Testdoppel',
            bakeDate: SUN,
            base: 60,
            cap: 6,
            total: 66,
            bruch: { group: 'test-doppel', perProduct: 2 },
          }),
          v2Line({
            itemId: 'test-stern',
            name: 'Teststern',
            bakeDate: SUN,
            total: 12,
            bruch: { group: 'test-gemischt', perProduct: 1 },
          }),
          v2Line({
            itemId: 'test-kaese',
            name: 'Testkäse',
            bakeDate: SUN,
            total: 8,
            bruch: { group: 'test-gemischt', perProduct: 1 },
          }),
          v2Line({
            itemId: 'test-flit-klein',
            name: 'Testflit klein',
            bakeDate: SUN,
            total: 10,
          }),
          v2Line({
            itemId: 'test-doppel',
            name: 'Testdoppel',
            bakeDate: V2_TUE,
            base: 40,
            preorders: 4,
            total: 44,
            bruch: { group: 'test-doppel', perProduct: 2 },
          }),
          v2Line({
            itemId: 'test-flitweck',
            name: 'Testflitweck',
            bakeDate: V2_TUE,
            total: 20,
            bruch: { group: 'test-flitweck', perProduct: 1 },
          }),
          v2Line({
            itemId: 'test-party',
            name: 'Testparty',
            bakeDate: V2_TUE,
            total: 5,
          }),
        ],
      },
      {
        id: 'kaffeestueckchen',
        label: 'Kaffeestückchen',
        lines: [
          v2Line({
            itemId: 'test-plunder',
            name: 'Testplunder',
            section: 'kaffeestueckchen',
            total: 20,
          }),
        ],
      },
      {
        id: 'hefeteig',
        label: 'Hefeteig',
        lines: [
          v2Line({
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            section: 'hefeteig',
            variant: 'nuss',
            variantKind: 'filling',
            variantLabel: 'Testnussfüllung',
            total: 4,
          }),
          v2Line({
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            section: 'hefeteig',
            variant: 'mohn',
            variantKind: 'filling',
            variantLabel: 'Testmohnfüllung',
            total: 2,
          }),
          v2Line({
            itemId: 'test-kranz',
            name: 'Testkranz',
            section: 'hefeteig',
            total: 3,
          }),
        ],
      },
    ],
    hefeteig: {
      doughs: [
        {
          id: 'test-hefe',
          name: 'Testhefe',
          batch_max_kg: null,
          pieces: 12,
          dough_g: 6600,
          batches: null,
          weighing: [
            {
              piece_g: 600,
              pieces: 6,
              items: [
                {
                  itemId: 'test-kranz',
                  name: 'Testkranz',
                  products: 3,
                  piecesPerProduct: 2,
                  pieces: 6,
                },
              ],
            },
            {
              piece_g: 500,
              pieces: 6,
              items: [
                {
                  itemId: 'test-zopf',
                  name: 'Testzopf gefüllt',
                  products: 6,
                  piecesPerProduct: 1,
                  pieces: 6,
                },
              ],
            },
          ],
          kg: 6.6,
          kgKnown: 6.6,
          complete: true,
          missing: [],
          liters: { exact: 1.32, rounded: 1, reason: null },
        },
      ],
      pieces: 12,
      dough_g: 6600,
      complete: true,
    },
    fillings: [
      {
        id: 'nuss',
        name: 'Testnussfüllung',
        grams: 0,
        missingFillingG: true,
        items: [
          {
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            pieces: 4,
            filling_g: null,
            grams: null,
          },
        ],
        recipe: null,
        recipeMissing: false,
      },
    ],
    prep: [{ id: 'sauerteig', name: 'Testsauerteig', variant: null }],
    prepDate: '2026-11-27',
    prepDateProvisional: false,
    deltas: [],
    warnings: [
      {
        code: 'base_unset',
        message:
          'Grundmenge für Samstag noch nicht festgelegt: Testkorn (Kasten).',
      },
    ],
    configStatus: 'ok',
    sheetVersion: 2,
    isDoughDay: true,
    bakeDates: [
      {
        date: SAT,
        weekday: 6,
        weekdayName: 'Samstag',
        label: 'heute',
        lineCount: 9,
      },
      {
        date: SUN,
        weekday: 7,
        weekdayName: 'Sonntag',
        label: 'für Sonntag',
        lineCount: 4,
      },
      {
        date: V2_TUE,
        weekday: 2,
        weekdayName: 'Dienstag',
        label: 'für Dienstag',
        lineCount: 3,
      },
    ],
    plan: {
      version: 2,
      doughDate: SAT,
      bakeDates: [
        {
          date: SAT,
          itemIds: [
            'test-korn',
            'test-holz',
            'test-hafer',
            'test-plunder',
            'test-zopf',
            'test-kranz',
          ],
        },
        {
          date: SUN,
          itemIds: [
            'test-doppel',
            'test-stern',
            'test-kaese',
            'test-flit-klein',
          ],
        },
        {
          date: V2_TUE,
          itemIds: ['test-doppel', 'test-flitweck', 'test-party'],
        },
      ],
    },
    doughs: [
      {
        id: 'test-korn-teig',
        name: 'Testkorn',
        kg: 7.8,
        kgKnown: 7.8,
        complete: true,
        missing: [],
        liters: { exact: 3.9, rounded: 4, reason: null },
        batches: null,
        batch_max_kg: null,
        addons: [],
        parts: [
          {
            kind: 'sizes',
            itemId: 'test-korn',
            name: 'Testkorn',
            bakeDate: SAT,
            kg: 7.8,
          },
        ],
        extras: [],
        combinedWith: null,
      },
      {
        id: 'test-holz-teig',
        name: 'Testholz',
        kg: 3.6,
        kgKnown: 3.6,
        complete: true,
        missing: [],
        liters: { exact: 1.8, rounded: 2, reason: null },
        batches: null,
        batch_max_kg: null,
        addons: [],
        parts: [
          {
            kind: 'sizes',
            itemId: 'test-holz',
            name: 'Testholz',
            bakeDate: SAT,
            kg: 3.6,
          },
        ],
        extras: [],
        combinedWith: 'test-korn-teig',
      },
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        kg: 17,
        kgKnown: 17,
        complete: true,
        missing: [],
        liters: { exact: 5.47, rounded: 5.5, reason: null },
        batches: 1,
        batch_max_kg: 40,
        addons: [],
        parts: [
          {
            kind: 'bruch',
            itemId: 'test-doppel',
            name: 'Testdoppel',
            bakeDate: SUN,
            kg: 8.75,
          },
          {
            kind: 'bruch',
            itemId: 'test-gemischt',
            name: 'Teststern + Testkäse',
            bakeDate: SUN,
            kg: 2,
          },
          {
            kind: 'bruch',
            itemId: 'test-doppel',
            name: 'Testdoppel',
            bakeDate: V2_TUE,
            kg: 6.25,
          },
        ],
        extras: [],
        combinedWith: null,
      },
      {
        id: 'test-flit-teig',
        name: 'Testflit',
        kg: null,
        kgKnown: 3,
        complete: false,
        missing: [MISSING_FLITWECK_G, MISSING_PARTY_PIECES],
        liters: { exact: null, rounded: null, reason: 'dough_incomplete' },
        batches: null,
        batch_max_kg: null,
        addons: [],
        parts: [
          {
            kind: 'pieces',
            itemId: 'test-flit-klein',
            name: 'Testflit klein',
            bakeDate: SUN,
            kg: 3,
          },
          {
            kind: 'bruch',
            itemId: 'test-flitweck',
            name: 'Testflitweck',
            bakeDate: V2_TUE,
            kg: null,
          },
          {
            kind: 'pieces',
            itemId: 'test-party',
            name: 'Testparty',
            bakeDate: V2_TUE,
            kg: null,
          },
        ],
        extras: [],
        combinedWith: null,
      },
      {
        id: 'test-hefe',
        name: 'Testhefe',
        kg: 6.6,
        kgKnown: 6.6,
        complete: true,
        missing: [],
        liters: { exact: 1.32, rounded: 1, reason: null },
        batches: null,
        batch_max_kg: null,
        addons: [],
        parts: [
          {
            kind: 'pieces',
            itemId: 'test-zopf',
            name: 'Testzopf gefüllt',
            bakeDate: SAT,
            kg: 3,
          },
          {
            kind: 'pieces',
            itemId: 'test-kranz',
            name: 'Testkranz',
            bakeDate: SAT,
            kg: 3.6,
          },
        ],
        extras: [],
        combinedWith: null,
      },
    ],
    machine: [
      {
        id: 'test-korn-teig',
        name: 'Korn + Holz',
        doughIds: ['test-korn-teig', 'test-holz-teig'],
        kg: 11.4,
        kgKnown: 11.4,
        complete: true,
        liters: { exact: 5.7, rounded: 6, reason: null },
        batches: null,
        batch_max_kg: null,
        addons: [
          {
            id: 'test-sauer',
            name: 'Testsauer',
            doughId: 'test-holz-teig',
            g_per_liter: 10,
            grams: { exact: 18, rounded: 20 },
            reason: null,
          },
        ],
        section: 'brot',
      },
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        doughIds: ['test-weck-teig'],
        kg: 17,
        kgKnown: 17,
        complete: true,
        liters: { exact: 5.47, rounded: 5.5, reason: null },
        batches: 1,
        batch_max_kg: 40,
        addons: [],
        section: 'broetchen',
      },
      {
        id: 'test-flit-teig',
        name: 'Testflit',
        doughIds: ['test-flit-teig'],
        kg: null,
        kgKnown: 3,
        complete: false,
        liters: { exact: null, rounded: null, reason: 'dough_incomplete' },
        batches: null,
        batch_max_kg: null,
        addons: [],
        section: 'broetchen',
      },
      {
        id: 'test-hefe',
        name: 'Testhefe',
        doughIds: ['test-hefe'],
        kg: 6.6,
        kgKnown: 6.6,
        complete: true,
        liters: { exact: 1.32, rounded: 1, reason: null },
        batches: null,
        batch_max_kg: null,
        addons: [],
        section: 'hefeteig',
      },
    ],
    bread: {
      sizes: [
        { id: 'g500', label: '500 g' },
        { id: 'g1000', label: '1 kg' },
        { id: 'kasten', label: 'Kasten' },
      ],
      rows: [
        {
          itemId: 'test-korn',
          name: 'Testkorn',
          bakeDate: SAT,
          doughId: 'test-korn-teig',
          unit: 'Stück',
          cells: {
            g500: {
              key: 'test-korn|g500',
              variant: 'g500',
              total: 8,
              baseUnset: false,
            },
            g1000: {
              key: 'test-korn|g1000',
              variant: 'g1000',
              total: 3,
              baseUnset: false,
            },
            kasten: {
              key: 'test-korn|kasten',
              variant: 'kasten',
              total: 0,
              baseUnset: true,
              totalIsMinimum: true,
            },
          },
          single: null,
          kg: 7.8,
          kgKnown: 7.8,
          complete: true,
          note: 'Gemeinsamer Teig: Korn + Holz',
        },
        {
          itemId: 'test-holz',
          name: 'Testholz',
          bakeDate: SAT,
          doughId: 'test-holz-teig',
          unit: 'Stück',
          cells: {
            g500: {
              key: 'test-holz|g500',
              variant: 'g500',
              total: 6,
              baseUnset: false,
            },
            g1000: null,
            kasten: null,
          },
          single: null,
          kg: 3.6,
          kgKnown: 3.6,
          complete: true,
          note: 'Gemeinsamer Teig: Korn + Holz',
        },
        {
          itemId: 'test-hafer',
          name: 'Testhafer',
          bakeDate: SAT,
          doughId: null,
          unit: 'Liter',
          cells: { g500: null, g1000: null, kasten: null },
          single: {
            key: 'test-hafer|',
            variant: null,
            total: 1.5,
            baseUnset: false,
            unit: 'Liter',
          },
          kg: null,
          kgKnown: 0,
          complete: true,
          note: null,
        },
      ],
    },
    rolls: [
      {
        bakeDate: SUN,
        label: 'für Sonntag',
        groups: [
          {
            key: `${SUN}|test-doppel`,
            group: 'test-doppel',
            name: 'Testdoppel',
            doughId: 'test-weck-teig',
            bakeDate: SUN,
            g: 1250,
            piecesPerBruch: 20,
            pieces: 132,
            brueche: 7,
            kg: 8.75,
            spare: 8,
            spareProducts: 4,
            perProduct: 2,
            piecesKnown: 132,
            bruecheKnown: 7,
            kgKnown: 8.75,
            split: [
              {
                key: `test-doppel|@${SUN}`,
                itemId: 'test-doppel',
                name: 'Testdoppel',
                variant: null,
                total: 66,
                perProduct: 2,
                doughPieces: 132,
              },
            ],
            complete: true,
            missing: [],
          },
          {
            key: `${SUN}|test-gemischt`,
            group: 'test-gemischt',
            name: 'Teststern + Testkäse',
            doughId: 'test-weck-teig',
            bakeDate: SUN,
            g: 2000,
            piecesPerBruch: 20,
            pieces: 20,
            brueche: 1,
            kg: 2,
            spare: 0,
            spareProducts: 0,
            perProduct: 1,
            piecesKnown: 20,
            bruecheKnown: 1,
            kgKnown: 2,
            split: [
              {
                key: `test-stern|@${SUN}`,
                itemId: 'test-stern',
                name: 'Teststern',
                variant: null,
                total: 12,
                perProduct: 1,
                doughPieces: 12,
              },
              {
                key: `test-kaese|@${SUN}`,
                itemId: 'test-kaese',
                name: 'Testkäse',
                variant: null,
                total: 8,
                perProduct: 1,
                doughPieces: 8,
              },
            ],
            complete: true,
            missing: [],
          },
        ],
        singles: [
          {
            key: `test-flit-klein|@${SUN}`,
            itemId: 'test-flit-klein',
            name: 'Testflit klein',
            variant: null,
            total: 10,
            baseUnset: false,
            piece_g: 300,
            pieces: 1,
            kg: 3,
          },
        ],
      },
      {
        bakeDate: V2_TUE,
        label: 'für Dienstag',
        groups: [
          {
            key: `${V2_TUE}|test-doppel`,
            group: 'test-doppel',
            name: 'Testdoppel',
            doughId: 'test-weck-teig',
            bakeDate: V2_TUE,
            g: 1250,
            piecesPerBruch: 20,
            pieces: 88,
            brueche: 5,
            kg: 6.25,
            spare: 12,
            spareProducts: 6,
            perProduct: 2,
            piecesKnown: 88,
            bruecheKnown: 5,
            kgKnown: 6.25,
            split: [
              {
                key: `test-doppel|@${V2_TUE}`,
                itemId: 'test-doppel',
                name: 'Testdoppel',
                variant: null,
                total: 44,
                perProduct: 2,
                doughPieces: 88,
              },
            ],
            complete: true,
            missing: [],
          },
          {
            key: `${V2_TUE}|test-flitweck`,
            group: 'test-flitweck',
            name: 'Testflitweck',
            doughId: 'test-flit-teig',
            bakeDate: V2_TUE,
            g: null,
            piecesPerBruch: 20,
            pieces: 20,
            brueche: 1,
            kg: null,
            spare: 0,
            split: [
              {
                key: `test-flitweck|@${V2_TUE}`,
                itemId: 'test-flitweck',
                name: 'Testflitweck',
                variant: null,
                total: 20,
                perProduct: 1,
                doughPieces: 20,
              },
            ],
            complete: false,
            missing: [MISSING_FLITWECK_G],
          },
        ],
        singles: [
          {
            key: `test-party|@${V2_TUE}`,
            itemId: 'test-party',
            name: 'Testparty',
            variant: null,
            total: 5,
            baseUnset: false,
            piece_g: 250,
            pieces: null,
            kg: null,
          },
        ],
      },
    ],
    openMasterData: [
      {
        path: 'doughs[0].batch_max_kg',
        code: 'batch_max_kg_unknown',
        message:
          'Teig „Testkorn“: Chargengröße ist noch offen – Chargen werden nicht berechnet.',
      },
      {
        path: 'doughs[3].kg_per_liter',
        code: 'kg_per_liter_unknown',
        message:
          'Teig „Testflit“: kg je Liter ist noch offen – der Zettel zeigt nur kg.',
      },
      {
        path: 'items[5].bruch.g.default',
        code: 'bruch_g_unknown',
        message: '„Testflitweck“: Bruchgewicht für Dienstag ist noch offen.',
      },
    ],
    ...overrides,
  }
}

/** Derselbe Samstag freigegeben: Zeilen-IDs ab 201, ein offener Nachtrag für Dienstag. */
export function saturdayV2Confirmed(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  const draft = saturdayV2Draft()
  let id = 201
  return {
    ...draft,
    status: 'confirmed',
    confirmedBy: { id: 2, displayName: 'Test Backstube' },
    confirmedAt: '2026-11-27T13:00:00.000Z',
    sections: draft.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => ({
        ...l,
        id: id++,
        delta:
          l.key === `test-doppel|@${V2_TUE}`
            ? { qty: 3, open: 1, count: 1, openQty: 3, bake: 3, bakeOpen: 3 }
            : null,
      })),
    })),
    deltas: [
      {
        id: 31,
        key: `test-doppel|@${V2_TUE}`,
        bakeDate: V2_TUE,
        itemId: 'test-doppel',
        name: 'Testdoppel',
        unit: 'Stück',
        variant: null,
        qty: 3,
        kind: 'added',
        preorderId: 51,
        preorderCode: 'LA-2026-12-01-01',
        createdAt: '2026-11-28T15:00:00.000Z',
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    ],
    configChangedSinceConfirm: false,
    deltasPending: false,
    ...overrides,
  }
}

/** Sonntag: kein Teigtag, der eigene Zettel ist leer (gebacken wird aus Samstagsteig). */
export function sundayV2Sheet(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  return {
    date: SUN,
    weekday: 7,
    weekdayName: 'Sonntag',
    status: 'draft',
    seasonFactor: 1,
    confirmedBy: null,
    confirmedAt: null,
    sections: [],
    hefeteig: { doughs: [], pieces: 0, dough_g: 0, complete: true },
    fillings: [],
    prep: [],
    prepDate: SAT,
    prepDateProvisional: false,
    deltas: [],
    warnings: [],
    configStatus: 'ok',
    sheetVersion: 2,
    isDoughDay: false,
    bakeDates: [
      {
        date: SUN,
        weekday: 7,
        weekdayName: 'Sonntag',
        label: 'heute',
        lineCount: 0,
      },
    ],
    plan: {
      version: 2,
      doughDate: SUN,
      bakeDates: [{ date: SUN, itemIds: [] }],
    },
    doughs: [],
    machine: [],
    bread: { sizes: [], rows: [] },
    rolls: [],
    openMasterData: [],
    ...overrides,
  }
}

function bakeListLine(
  overrides: Partial<BackzettelLine> & { itemId: string; name: string },
  bakeDate: string,
  doughDate: string,
  sheetStatus: 'draft' | 'confirmed',
  madeOn: string
): BackzettelLine {
  return {
    ...v2Line({ ...overrides, bakeDate }, doughDate),
    sheetStatus,
    madeOn,
  }
}

/**
 * Backliste Dienstag: Brot aus Dienstagsteig (Entwurf), Brötchen aus
 * Samstagsteig (freigegeben, mit offenem Nachtrag).
 */
/** Erfunden: was die Nachträge des Samstags für Teilmaschine und Teig heißen. */
export function v2DeltaDough(): Pick<
  BackzettelDay,
  'deltaBruch' | 'deltaMachine'
> {
  return {
    deltaBruch: [
      {
        key: `${V2_TUE}|test-doppel`,
        group: 'test-doppel',
        name: 'Testdoppel',
        bakeDate: V2_TUE,
        piecesBefore: 88,
        pieces: 102,
        piecesDelta: 14,
        bruecheBefore: 5,
        brueche: 6,
        bruecheDelta: 1,
        spareBefore: 12,
        spare: 18,
        spareProductsBefore: 6,
        spareProducts: 9,
        complete: true,
      },
      {
        key: `${SUN}|test-gemischt`,
        group: 'test-gemischt',
        name: 'Teststern + Testkäse',
        bakeDate: SUN,
        piecesBefore: 20,
        pieces: 18,
        piecesDelta: -2,
        bruecheBefore: 1,
        brueche: 1,
        bruecheDelta: 0,
        spareBefore: 0,
        spare: 2,
        spareProductsBefore: 0,
        spareProducts: 2,
        complete: true,
      },
    ],
    deltaMachine: [
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        doughIds: ['test-weck-teig'],
        kgBefore: 17,
        kg: 18.25,
        kgDelta: 1.25,
        complete: true,
        litersBefore: { exact: 5.47, rounded: 5.5, reason: null },
        liters: { exact: 5.87, rounded: 6, reason: null },
        batchesBefore: 1,
        batches: 1,
      },
    ],
  }
}

export function tuesdayBakeList(overrides: Partial<BakeList> = {}): BakeList {
  return {
    date: V2_TUE,
    weekday: 2,
    weekdayName: 'Dienstag',
    status: 'ok',
    sources: [
      {
        doughDate: SAT,
        weekday: 6,
        weekdayName: 'Samstag',
        status: 'confirmed',
        confirmedAt: '2026-11-28T13:00:00.000Z',
        lineCount: 3,
      },
      {
        doughDate: V2_TUE,
        weekday: 2,
        weekdayName: 'Dienstag',
        status: 'draft',
        confirmedAt: null,
        lineCount: 1,
      },
    ],
    sections: [
      {
        id: 'brot',
        label: 'Brot',
        lines: [
          bakeListLine(
            {
              itemId: 'test-korn',
              name: 'Testkorn',
              section: 'brot',
              variant: 'g500',
              variantKind: 'size',
              variantLabel: '500 g',
              total: 4,
            },
            V2_TUE,
            V2_TUE,
            'draft',
            'Teig von heute'
          ),
        ],
      },
      {
        id: 'broetchen',
        label: 'Brötchen',
        lines: [
          {
            ...bakeListLine(
              {
                itemId: 'test-doppel',
                name: 'Testdoppel',
                total: 44,
                id: 205,
                bruch: { group: 'test-doppel', perProduct: 2 },
              },
              V2_TUE,
              SAT,
              'confirmed',
              'Teig vom Samstag'
            ),
            delta: {
              qty: 3,
              open: 1,
              count: 1,
              openQty: 3,
              bake: 3,
              bakeOpen: 3,
            },
          },
          bakeListLine(
            {
              itemId: 'test-flitweck',
              name: 'Testflitweck',
              total: 20,
              id: 206,
              bruch: { group: 'test-flitweck', perProduct: 1 },
            },
            V2_TUE,
            SAT,
            'confirmed',
            'Teig vom Samstag'
          ),
          bakeListLine(
            { itemId: 'test-party', name: 'Testparty', total: 5, id: 207 },
            V2_TUE,
            SAT,
            'confirmed',
            'Teig vom Samstag'
          ),
        ],
      },
    ],
    rolls: (saturdayV2Draft().rolls ?? [])
      .slice(1, 2)
      .map((r) => ({ ...r, label: 'heute' })),
    deltas: [
      {
        id: 31,
        key: `test-doppel|@${V2_TUE}`,
        bakeDate: V2_TUE,
        doughDate: SAT,
        itemId: 'test-doppel',
        name: 'Testdoppel',
        unit: 'Stück',
        variant: null,
        qty: 3,
        kind: 'added',
        preorderId: 51,
        preorderCode: 'LA-2026-12-01-01',
        createdAt: '2026-11-28T15:00:00.000Z',
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    ],
    deltasPending: false,
    warnings: [],
    ...overrides,
  }
}

/** Backliste Sonntag: nur Brötchen aus Samstagsteig (Entwurf). */
export function sundayBakeList(overrides: Partial<BakeList> = {}): BakeList {
  const sat = saturdayV2Draft()
  const lines = sat.sections
    .flatMap((s) => s.lines)
    .filter((l) => l.bakeDate === SUN)
    .map((l) => ({
      ...l,
      sheetStatus: 'draft' as const,
      madeOn: 'Teig vom Samstag',
    }))
  return {
    date: SUN,
    weekday: 7,
    weekdayName: 'Sonntag',
    status: 'ok',
    sources: [
      {
        doughDate: SAT,
        weekday: 6,
        weekdayName: 'Samstag',
        status: 'draft',
        confirmedAt: null,
        lineCount: lines.length,
      },
    ],
    sections: [{ id: 'broetchen', label: 'Brötchen', lines }],
    rolls: (sat.rolls ?? []).slice(0, 1).map((r) => ({ ...r, label: 'heute' })),
    deltas: [],
    deltasPending: false,
    warnings: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------- voller Samstag

/*
 * Ein voller Samstag für den Einseiter (Z10, docs/backzettel-v2.md §9 Nr. 3):
 * 60 Zeilen - Brot in vier Größen, Brötchen in Bruch für Sonntag und
 * Dienstag, Ware für heute, Hefeteig, Laugen, Kaffeestückchen, Kuchen - sechs
 * Maschinen-Kästen, Hinweise und offene Stammdaten. Alle Namen tragen „Test“,
 * alle Zahlen sind erfunden; die Server-Felder (kg, Brüche, Liter) sind grob
 * stimmig, gerechnet wird hier nichts, was ein Spec prüft.
 */

const BUSY_SIZES = [
  { id: 'g420', label: '420 g' },
  { id: 'g820', label: '820 g' },
  { id: 'g1300', label: '1,3 kg' },
  { id: 'kasten', label: 'Kasten' },
]

/** Brot je Größe: Stück je Größe, `null` = Grundmenge offen. */
const BUSY_BREAD: {
  itemId: string
  name: string
  doughId: string
  sizes: Record<string, number | null>
  kg: number | null
  kgKnown: number
  note?: string
}[] = [
  {
    itemId: 'test-korn',
    name: 'Testkorn',
    doughId: 'test-korn-teig',
    sizes: { g420: 12, g820: 6, g1300: 2, kasten: 3 },
    kg: 16.4,
    kgKnown: 16.4,
    note: 'Gemeinsamer Teig: Korn + Holz',
  },
  {
    itemId: 'test-holz',
    name: 'Testholz',
    doughId: 'test-holz-teig',
    sizes: { g420: 8, g820: 4 },
    kg: 7.4,
    kgKnown: 7.4,
    note: 'Gemeinsamer Teig: Korn + Holz',
  },
  {
    itemId: 'test-misch',
    name: 'Testmisch',
    doughId: 'test-misch-teig',
    sizes: { g420: 10, g820: 8, g1300: 4, kasten: 2 },
    kg: 18.8,
    kgKnown: 18.8,
  },
  {
    itemId: 'test-kern',
    name: 'Testkern',
    doughId: 'test-misch-teig',
    sizes: { g1300: 5 },
    kg: 6.5,
    kgKnown: 6.5,
    note: 'Fester Anteil Testmisch, dazu Testkörner',
  },
  {
    itemId: 'test-dinkel',
    name: 'Testdinkel',
    doughId: 'test-dinkel-teig',
    sizes: { g420: 6, g820: 4 },
    kg: 6.3,
    kgKnown: 6.3,
  },
  {
    itemId: 'test-roggen',
    name: 'Testroggen',
    doughId: 'test-roggen-teig',
    sizes: { g820: 5, g1300: 3, kasten: null },
    kg: null,
    kgKnown: 7.9,
  },
  {
    itemId: 'test-vollkorn',
    name: 'Testvollkorn',
    doughId: 'test-roggen-teig',
    sizes: { g820: 4, kasten: 2 },
    kg: 5.6,
    kgKnown: 5.6,
  },
]

const busySizeLabel = (id: string) =>
  BUSY_SIZES.find((s) => s.id === id)?.label ?? id

function busyBreadLines(): BackzettelLine[] {
  const out: BackzettelLine[] = []
  for (const b of BUSY_BREAD) {
    for (const [size, total] of Object.entries(b.sizes)) {
      out.push(
        sizeLine(
          b.itemId,
          b.name,
          size,
          busySizeLabel(size),
          total ?? 0,
          total === null ? { baseUnset: true, base: 0 } : {}
        )
      )
    }
  }
  out.push(
    v2Line({
      itemId: 'test-hafer',
      name: 'Testhafer',
      section: 'brot',
      unit: 'Liter',
      total: 1.5,
    })
  )
  return out
}

function busyBreadRows(): BreadRow[] {
  const rows: BreadRow[] = BUSY_BREAD.map((b) => ({
    itemId: b.itemId,
    name: b.name,
    bakeDate: SAT,
    doughId: b.doughId,
    unit: 'Stück',
    cells: Object.fromEntries(
      BUSY_SIZES.map((sz) => {
        if (!(sz.id in b.sizes)) return [sz.id, null]
        const total = b.sizes[sz.id]
        return [
          sz.id,
          {
            key: `${b.itemId}|${sz.id}`,
            variant: sz.id,
            total: total ?? 0,
            baseUnset: total === null,
            ...(total === null ? { totalIsMinimum: true } : {}),
          },
        ]
      })
    ),
    single: null,
    kg: b.kg,
    kgKnown: b.kgKnown,
    complete: b.kg !== null,
    note: b.note ?? null,
  }))
  rows.push({
    itemId: 'test-hafer',
    name: 'Testhafer',
    bakeDate: SAT,
    doughId: null,
    unit: 'Liter',
    cells: Object.fromEntries(BUSY_SIZES.map((sz) => [sz.id, null])),
    single: {
      key: 'test-hafer|',
      variant: null,
      total: 1.5,
      baseUnset: false,
      unit: 'Liter',
    },
    kg: null,
    kgKnown: 0,
    complete: true,
    note: null,
  })
  return rows
}

/** Eine Bruch-Gruppe: Mitglieder [itemId, Name, Stück, Vorbestellt]. */
interface BusyGroup {
  group: string
  name: string
  doughId: string
  g: number | null
  perProduct: number
  members: [string, string, number, number?][]
}

const BUSY_PIECES_PER_BRUCH = 20

function busyGroupLines(bakeDate: string, g: BusyGroup): BackzettelLine[] {
  return g.members.map(([itemId, name, total, preorders = 0]) =>
    v2Line({
      itemId,
      name,
      bakeDate,
      base: total - preorders,
      preorders,
      total,
      bruch: { group: g.group, perProduct: g.perProduct },
    })
  )
}

function busyGroup(bakeDate: string, g: BusyGroup): BruchGroup {
  const pieces = g.members.reduce((n, m) => n + m[2] * g.perProduct, 0)
  const brueche = Math.ceil(pieces / BUSY_PIECES_PER_BRUCH)
  const spare = brueche * BUSY_PIECES_PER_BRUCH - pieces
  const kg = g.g === null ? null : (brueche * g.g) / 1000
  const missing: MissingPart[] =
    g.g === null
      ? [
          {
            itemId: g.members[0][0],
            name: g.name,
            field: 'bruch.g',
            code: 'bruch_g_unknown',
            message: `„${g.name}“: Bruchgewicht ist noch offen.`,
          },
        ]
      : []
  return {
    key: `${bakeDate}|${g.group}`,
    group: g.group,
    name: g.name,
    doughId: g.doughId,
    bakeDate,
    g: g.g,
    piecesPerBruch: BUSY_PIECES_PER_BRUCH,
    pieces,
    brueche,
    kg,
    spare,
    spareProducts: Math.floor(spare / g.perProduct),
    perProduct: g.perProduct,
    piecesKnown: pieces,
    bruecheKnown: brueche,
    kgKnown: kg,
    split: g.members.map(([itemId, name, total]) => ({
      key: `${itemId}|@${bakeDate}`,
      itemId,
      name,
      variant: null,
      total,
      perProduct: g.perProduct,
      doughPieces: total * g.perProduct,
    })),
    complete: g.g !== null,
    missing,
  }
}

/** Einzelstücke: [itemId, Name, Stück, g je Stück, Teigstücke je Produkt]. */
type BusySingle = [string, string, number, number | null, number | null]

function busySingle(bakeDate: string, s: BusySingle): SingleRow {
  const [itemId, name, total, pieceG, pieces] = s
  const kg =
    pieceG === null || pieces === null ? null : (total * pieceG * pieces) / 1000
  return {
    key: bakeDate === SAT ? `${itemId}|` : `${itemId}|@${bakeDate}`,
    itemId,
    name,
    variant: null,
    total,
    baseUnset: false,
    piece_g: pieceG,
    pieces,
    kg,
  }
}

const BUSY_ROLLS: {
  bakeDate: string
  label: string
  groups: BusyGroup[]
  singles: BusySingle[]
}[] = [
  {
    bakeDate: SUN,
    label: 'für Sonntag',
    groups: [
      {
        group: 'test-doppel',
        name: 'Testdoppel',
        doughId: 'test-weck-teig',
        g: 1250,
        perProduct: 2,
        members: [['test-doppel', 'Testdoppel', 70, 6]],
      },
      {
        group: 'test-gemischt',
        name: 'Teststern + Testkäse + Testmohn',
        doughId: 'test-weck-teig',
        g: 1300,
        perProduct: 1,
        members: [
          ['test-stern', 'Teststern', 16],
          ['test-kaese', 'Testkäse', 10, 2],
          ['test-mohn', 'Testmohn', 12],
        ],
      },
      {
        group: 'test-kornweck',
        name: 'Testkornweck',
        doughId: 'test-weck-teig',
        g: 1450,
        perProduct: 1,
        members: [['test-kornweck', 'Testkornweck', 30]],
      },
      {
        group: 'test-dinkelweck',
        name: 'Testdinkelweck',
        doughId: 'test-dinkelweck-teig',
        g: 1350,
        perProduct: 1,
        members: [['test-dinkelweck', 'Testdinkelweck', 24]],
      },
      {
        group: 'test-flitweck',
        name: 'Testflitweck',
        doughId: 'test-flit-teig',
        g: 1180,
        perProduct: 1,
        members: [['test-flitweck', 'Testflitweck', 18]],
      },
      {
        group: 'test-roggenweck',
        name: 'Testroggenweck',
        doughId: 'test-roggen-teig',
        g: 1550,
        perProduct: 1,
        members: [['test-roggenweck', 'Testroggenweck', 20]],
      },
    ],
    singles: [['test-flit-klein', 'Testflit klein', 10, 300, 1]],
  },
  {
    bakeDate: V2_TUE,
    label: 'für Dienstag',
    groups: [
      {
        group: 'test-doppel',
        name: 'Testdoppel',
        doughId: 'test-weck-teig',
        g: 1250,
        perProduct: 2,
        members: [['test-doppel', 'Testdoppel', 44, 4]],
      },
      {
        group: 'test-gemischt',
        name: 'Teststern + Testkäse',
        doughId: 'test-weck-teig',
        g: 1300,
        perProduct: 1,
        members: [
          ['test-stern', 'Teststern', 8],
          ['test-kaese', 'Testkäse', 6],
        ],
      },
      {
        group: 'test-kornweck',
        name: 'Testkornweck',
        doughId: 'test-weck-teig',
        g: 1450,
        perProduct: 1,
        members: [['test-kornweck', 'Testkornweck', 20]],
      },
      {
        group: 'test-flitweck',
        name: 'Testflitweck',
        doughId: 'test-flit-teig',
        g: null,
        perProduct: 1,
        members: [['test-flitweck', 'Testflitweck', 20]],
      },
    ],
    singles: [['test-party', 'Testparty', 5, 250, null]],
  },
  {
    bakeDate: SAT,
    label: 'heute',
    groups: [],
    singles: [
      ['test-weck-hell', 'Testweck hell', 20, 80, 1],
      ['test-stange', 'Teststange', 6, 250, 1],
    ],
  },
]

function busyRollLines(): BackzettelLine[] {
  const out: BackzettelLine[] = []
  for (const block of BUSY_ROLLS) {
    for (const g of block.groups) out.push(...busyGroupLines(block.bakeDate, g))
    for (const [itemId, name, total] of block.singles) {
      out.push(v2Line({ itemId, name, bakeDate: block.bakeDate, total }))
    }
  }
  return out
}

function busyRolls(): RollsBlock[] {
  return BUSY_ROLLS.map((block) => ({
    bakeDate: block.bakeDate,
    label: block.label,
    groups: block.groups.map((g) => busyGroup(block.bakeDate, g)),
    singles: block.singles.map((s) => busySingle(block.bakeDate, s)),
  }))
}

/** Übrige Abschnitte: [itemId, Name, Stück, Extras]. */
const BUSY_OTHERS: {
  id: string
  label: string
  lines: [string, string, number, Partial<BackzettelLine>?][]
}[] = [
  {
    id: 'laugen',
    label: 'Laugen',
    lines: [
      ['test-brezel', 'Testbrezel', 24, { preorders: 6, base: 18 }],
      ['test-laugenweck', 'Testlaugenweck', 14],
      ['test-laugenstange', 'Testlaugenstange', 10],
    ],
  },
  {
    // Mehr als KEEP_SECTION_LINES Zeilen: darf auf die zweite Spalte umbrechen.
    id: 'kaffeestueckchen',
    label: 'Kaffeestückchen',
    lines: [
      ['test-croissant', 'Testcroissant', 24, { tray: 'Blech 1-2' }],
      ['test-plunder', 'Testplunder', 20, { tray: 'Blech 3' }],
      ['test-plunder-vanille', 'Testplunder Vanille', 10],
      ['test-berliner', 'Testberliner', 20, { tray: 'Blech 4' }],
      ['test-schnecke-nuss', 'Testschnecke Nuss', 12],
      ['test-schnecke-rosine', 'Testschnecke Rosine', 10],
      ['test-tasche-quark', 'Testtasche Quark', 8],
      ['test-tasche-kirsch', 'Testtasche Kirsch', 8, { preorders: 3, base: 5 }],
      ['test-ecke', 'Testecke', 6],
    ],
  },
  {
    id: 'kuchen',
    label: 'Kuchen',
    lines: [
      ['test-marmor', 'Testmarmor', 3],
      ['test-apfel', 'Testapfel', 2, { unit: 'Blech' }],
      ['test-streusel', 'Teststreusel', 2, { unit: 'Blech' }],
      [
        'test-zwetschge',
        'Testzwetschge',
        0,
        { unit: 'Blech', baseUnset: true, base: 0 },
      ],
    ],
  },
]

function busyOtherSections(): BackzettelDay['sections'] {
  return BUSY_OTHERS.map((sec) => ({
    id: sec.id,
    label: sec.label,
    lines: sec.lines.map(([itemId, name, total, extra = {}]) =>
      v2Line({ itemId, name, section: sec.id, total, ...extra })
    ),
  }))
}

function busyHefeLine(
  itemId: string,
  name: string,
  total: number,
  extra: Partial<BackzettelLine> = {}
): BackzettelLine {
  return v2Line({ itemId, name, section: 'hefeteig', total, ...extra })
}

function busyFilled(
  itemId: string,
  name: string,
  variant: string,
  label: string,
  total: number,
  extra: Partial<BackzettelLine> = {}
): BackzettelLine {
  return busyHefeLine(itemId, name, total, {
    variant,
    variantKind: 'filling',
    variantLabel: label,
    ...extra,
  })
}

function busyHefeteigLines(): BackzettelLine[] {
  return [
    busyFilled('test-zopf', 'Testzopf gefüllt', 'nuss', 'Testnussfüllung', 4),
    busyFilled('test-zopf', 'Testzopf gefüllt', 'mohn', 'Testmohnfüllung', 2),
    busyFilled(
      'test-zopf',
      'Testzopf gefüllt',
      'apfel',
      'Testapfelfüllung',
      2,
      {
        baseUnset: true,
        base: 0,
        preorders: 2,
      }
    ),
    busyFilled(
      'test-kranz-gefuellt',
      'Testkranz gefüllt',
      'nuss',
      'Testnussfüllung',
      3
    ),
    busyFilled(
      'test-kranz-gefuellt',
      'Testkranz gefüllt',
      'mohn',
      'Testmohnfüllung',
      1
    ),
    busyHefeLine('test-kranz', 'Testkranz', 3),
    busyHefeLine('test-hefezopf', 'Testhefezopf', 4),
    busyHefeLine('test-schnecke-gross', 'Testschnecke groß', 6),
  ]
}

/** Ein Maschinen-Kasten; Teig-Zusammenfassung dazu über `busyDough`. */
function busyBox(
  id: string,
  name: string,
  kg: number | null,
  kgKnown: number,
  liters: {
    exact: number | null
    rounded: number | null
    reason: string | null
  },
  extra: Partial<MachineBox> = {}
): MachineBox {
  return {
    id,
    name,
    doughIds: [id],
    kg,
    kgKnown,
    complete: kg !== null,
    liters,
    batches: null,
    batch_max_kg: null,
    addons: [],
    section: 'brot',
    ...extra,
  }
}

function busyMachine(): MachineBox[] {
  return [
    busyBox(
      'test-korn-teig',
      'Korn + Holz',
      23.6,
      23.6,
      { exact: 11.8, rounded: 12, reason: null },
      {
        doughIds: ['test-korn-teig', 'test-holz-teig'],
        addons: [
          {
            id: 'test-sauer',
            name: 'Testsauer',
            doughId: 'test-holz-teig',
            g_per_liter: 10,
            grams: { exact: 36, rounded: 40 },
            reason: null,
          },
        ],
      }
    ),
    busyBox(
      'test-misch-teig',
      'Misch + Dinkel',
      31.5,
      31.5,
      { exact: 16.9, rounded: 17, reason: null },
      {
        doughIds: ['test-misch-teig', 'test-dinkel-teig'],
        addons: [
          {
            id: 'test-dunkel',
            name: 'Testdunkel',
            doughId: 'test-dinkel-teig',
            g_per_liter: null,
            grams: null,
            reason: 'g_per_liter_unknown',
          },
        ],
      }
    ),
    busyBox('test-roggen-teig', 'Testroggen', null, 44.5, {
      exact: null,
      rounded: null,
      reason: 'dough_incomplete',
    }),
    busyBox(
      'test-weck-teig',
      'Testweck',
      52.1,
      52.1,
      { exact: 30.65, rounded: null, reason: 'rounding_unknown' },
      {
        batches: 2,
        batch_max_kg: 40,
        section: 'broetchen',
      }
    ),
    busyBox(
      'test-flit-teig',
      'Testflit',
      null,
      9.7,
      { exact: null, rounded: null, reason: 'kg_per_liter_unknown' },
      {
        section: 'broetchen',
      }
    ),
    busyBox(
      'test-dinkelweck-teig',
      'Testdinkelweck',
      8.1,
      8.1,
      { exact: 4.5, rounded: 4.5, reason: null },
      {
        section: 'broetchen',
      }
    ),
    busyBox(
      'test-hefe',
      'Testhefe',
      13.8,
      13.8,
      { exact: 2.76, rounded: 3, reason: null },
      {
        batches: 2,
        batch_max_kg: 10,
        section: 'hefeteig',
      }
    ),
  ]
}

const BUSY_OPEN = [
  {
    path: 'doughs[2].batch_max_kg',
    code: 'batch_max_kg_unknown',
    message:
      'Teig „Testroggen“: Chargengröße ist noch offen – Chargen werden nicht berechnet.',
  },
  {
    path: 'doughs[4].kg_per_liter',
    code: 'kg_per_liter_unknown',
    message:
      'Teig „Testflit“: kg je Liter ist noch offen – der Zettel zeigt nur kg.',
  },
  {
    path: 'doughs[3].liter_rounding',
    code: 'rounding_unknown',
    message: 'Teig „Testweck“: Rundung der Liter ist noch offen.',
  },
  {
    path: 'doughs[1].addons[0].g_per_liter',
    code: 'g_per_liter_unknown',
    message: 'Teig „Testdinkel“: Testdunkel g je Liter ist noch offen.',
  },
  {
    path: 'items[20].bruch.g.2',
    code: 'bruch_g_unknown',
    message: '„Testflitweck“: Bruchgewicht für Dienstag ist noch offen.',
  },
]

/** Einzelstücke und Hefeteig-Posten: welcher Teig (Kasten) sie trägt. */
const BUSY_PIECE_DOUGH: Record<string, string> = {
  'test-flit-klein': 'test-flit-teig',
  'test-party': 'test-flit-teig',
  'test-weck-hell': 'test-weck-teig',
  'test-stange': 'test-weck-teig',
}

/**
 * Teile je Kasten wie vom Server (`doughs[].parts`): Brot, Bruch-Gruppen,
 * Einzelstücke und Hefeteig - der Druck ordnet darüber die Zeilen den Teigen
 * zu und nennt die Backtage je Teig.
 */
function busyParts(box: MachineBox): DoughSummary['parts'] {
  const parts: DoughSummary['parts'] = []
  for (const b of BUSY_BREAD) {
    if (!box.doughIds.includes(b.doughId)) continue
    parts.push({
      kind: 'sizes',
      itemId: b.itemId,
      name: b.name,
      bakeDate: SAT,
      kg: b.kg,
    })
  }
  for (const block of BUSY_ROLLS) {
    for (const g of block.groups) {
      if (!box.doughIds.includes(g.doughId)) continue
      parts.push({
        kind: 'bruch',
        itemId: g.group,
        name: g.name,
        bakeDate: block.bakeDate,
        kg: busyGroup(block.bakeDate, g).kg,
      })
    }
    for (const single of block.singles) {
      const [itemId, name] = single
      if (!box.doughIds.includes(BUSY_PIECE_DOUGH[itemId])) continue
      parts.push({
        kind: 'pieces',
        itemId,
        name,
        bakeDate: block.bakeDate,
        kg: busySingle(block.bakeDate, single).kg,
      })
    }
  }
  if (box.section === 'hefeteig') {
    const seen = new Set<string>()
    for (const l of busyHefeteigLines()) {
      if (seen.has(l.itemId)) continue
      seen.add(l.itemId)
      parts.push({
        kind: 'pieces',
        itemId: l.itemId,
        name: l.name,
        bakeDate: SAT,
        kg: null,
      })
    }
  }
  return parts
}

function busyDoughs(): DoughSummary[] {
  return busyMachine().map((box) => ({
    id: box.id,
    name: box.name,
    kg: box.kg,
    kgKnown: box.kgKnown,
    complete: box.complete,
    missing:
      box.id === 'test-roggen-teig'
        ? [
            {
              itemId: 'test-roggen',
              name: 'Testroggen',
              field: 'base',
              code: 'base_unset',
              message:
                '„Testroggen“ (Kasten): Grundmenge offen – Teig nur „mindestens“.',
            },
          ]
        : [],
    liters: box.liters,
    batches: box.batches,
    batch_max_kg: box.batch_max_kg,
    addons: box.addons,
    parts: busyParts(box),
    extras: [],
    combinedWith: null,
  }))
}

/**
 * Voller Samstag als Teigtag (Entwurf): 60 Zeilen (Brot 19, Brötchen 17,
 * Hefeteig 8, Laugen/Kaffeestückchen/Kuchen 16), sechs Teige an der Maschine.
 * Der größte Teigtag-Zettel der Specs - er muss auf eine A4-Seite passen.
 */
export function busySaturdayV2Draft(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  const base = saturdayV2Draft()
  const others = busyOtherSections()
  return {
    ...base,
    sections: [
      { id: 'brot', label: 'Brot', lines: busyBreadLines() },
      { id: 'broetchen', label: 'Brötchen', lines: busyRollLines() },
      ...others.slice(0, 1),
      ...others.slice(1),
      { id: 'hefeteig', label: 'Hefeteig', lines: busyHefeteigLines() },
    ],
    hefeteig: {
      ...base.hefeteig,
      doughs: (base.hefeteig?.doughs ?? []).map((d) => ({
        ...d,
        pieces: 31,
        dough_g: 13800,
        kg: 13.8,
        kgKnown: 13.8,
        batches: 2,
        batch_max_kg: 10,
        liters: { exact: 2.76, rounded: 3, reason: null },
      })),
      pieces: 31,
      dough_g: 13800,
      complete: true,
    },
    doughs: busyDoughs(),
    machine: busyMachine(),
    bread: { sizes: BUSY_SIZES, rows: busyBreadRows() },
    rolls: busyRolls(),
    warnings: [
      {
        code: 'base_unset',
        message:
          'Grundmenge für Samstag noch nicht festgelegt: Testroggen (Kasten), Testzwetschge, Testzopf gefüllt (Testapfelfüllung).',
      },
      {
        code: 'unmapped_product',
        message:
          'Vorbestelltes Produkt „Testtorte Probe“ (1 Stück) gehört zu keinem Backzettel-Posten.',
      },
    ],
    openMasterData: BUSY_OPEN,
    ...overrides,
  }
}

/** Erfundene Nachträge nach der Freigabe: [Schlüssel, Name, Backtag, Menge]. */
const BUSY_DELTAS: [string, string, string, number][] = [
  [`test-doppel|@${V2_TUE}`, 'Testdoppel', V2_TUE, 6],
  [`test-kornweck|@${V2_TUE}`, 'Testkornweck', V2_TUE, 4],
  [`test-stern|@${SUN}`, 'Teststern', SUN, 5],
  [`test-flit-klein|@${SUN}`, 'Testflit klein', SUN, -2],
  ['test-brezel|', 'Testbrezel', SAT, 8],
  ['test-tasche-kirsch|', 'Testtasche Kirsch', SAT, 3],
]

/**
 * Derselbe volle Samstag freigegeben, danach sechs Nachträge (Brötchen für
 * So + Di, Laugen, Kaffeestückchen) mit dem, was sie für Teig und
 * Teilmaschine heißen.
 */
export function busySaturdayV2Confirmed(
  overrides: Partial<BackzettelDay> = {}
): BackzettelDay {
  const draft = busySaturdayV2Draft()
  const byKey = new Map(BUSY_DELTAS.map((d) => [d[0], d[3]]))
  let id = 401
  const deltas: BackzettelDeltaEntry[] = BUSY_DELTAS.map(
    ([key, name, bakeDate, qty], i) => ({
      id: 61 + i,
      key,
      bakeDate,
      itemId: key.split('|')[0],
      name,
      unit: 'Stück',
      variant: null,
      qty,
      kind: qty > 0 ? 'added' : 'changed',
      preorderId: 71 + i,
      preorderCode: `LA-${bakeDate}-${String(i + 11).padStart(2, '0')}`,
      createdAt: '2026-11-28T15:00:00.000Z',
      acknowledgedAt: null,
      acknowledgedBy: null,
    })
  )
  return {
    ...draft,
    status: 'confirmed',
    confirmedBy: { id: 2, displayName: 'Test Backstube' },
    confirmedAt: '2026-11-27T13:00:00.000Z',
    sections: draft.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => {
        const qty = byKey.get(l.key)
        return {
          ...l,
          id: id++,
          delta:
            qty === undefined
              ? null
              : {
                  qty,
                  open: 1,
                  count: 1,
                  openQty: qty,
                  bake: qty,
                  bakeOpen: qty,
                },
        }
      }),
    })),
    deltas,
    deltaBruch: [
      {
        key: `${V2_TUE}|test-doppel`,
        group: 'test-doppel',
        name: 'Testdoppel',
        bakeDate: V2_TUE,
        piecesBefore: 88,
        pieces: 100,
        piecesDelta: 12,
        bruecheBefore: 5,
        brueche: 5,
        bruecheDelta: 0,
        spareBefore: 12,
        spare: 0,
        spareProductsBefore: 6,
        spareProducts: 0,
        complete: true,
      },
      {
        key: `${V2_TUE}|test-kornweck`,
        group: 'test-kornweck',
        name: 'Testkornweck',
        bakeDate: V2_TUE,
        piecesBefore: 20,
        pieces: 24,
        piecesDelta: 4,
        bruecheBefore: 1,
        brueche: 2,
        bruecheDelta: 1,
        spareBefore: 0,
        spare: 16,
        spareProductsBefore: 0,
        spareProducts: 16,
        complete: true,
      },
      {
        key: `${SUN}|test-gemischt`,
        group: 'test-gemischt',
        name: 'Teststern + Testkäse + Testmohn',
        bakeDate: SUN,
        piecesBefore: 38,
        pieces: 43,
        piecesDelta: 5,
        bruecheBefore: 2,
        brueche: 3,
        bruecheDelta: 1,
        spareBefore: 2,
        spare: 17,
        spareProductsBefore: 2,
        spareProducts: 17,
        complete: true,
      },
    ],
    deltaMachine: [
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        doughIds: ['test-weck-teig'],
        kgBefore: 52.1,
        kg: 54.9,
        kgDelta: 2.8,
        complete: true,
        litersBefore: {
          exact: 30.65,
          rounded: null,
          reason: 'rounding_unknown',
        },
        liters: { exact: 32.35, rounded: null, reason: 'rounding_unknown' },
        batchesBefore: 2,
        batches: 2,
      },
      {
        id: 'test-flit-teig',
        name: 'Testflit',
        doughIds: ['test-flit-teig'],
        kgBefore: null,
        kg: null,
        kgDelta: -0.6,
        complete: false,
        litersBefore: {
          exact: null,
          rounded: null,
          reason: 'kg_per_liter_unknown',
        },
        liters: { exact: null, rounded: null, reason: 'kg_per_liter_unknown' },
        batchesBefore: null,
        batches: null,
      },
    ],
    configChangedSinceConfirm: false,
    deltasPending: false,
    ...overrides,
  }
}
