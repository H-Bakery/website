/**
 * Erfundene Backzettel-Antworten für die Specs (Z5/Z6/Z7). Kein Wert stammt
 * aus `hq`: Namen tragen „Test", Mengen sind rund, damit man sie nachrechnen
 * kann. Form = `GET /api/backzettel/:datum` der echten API (Z3).
 */

import type {
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
    sections: draft.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l, i) => ({
        ...l,
        id: 100 + i + s.id.length,
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
