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
  BackzettelLine,
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
