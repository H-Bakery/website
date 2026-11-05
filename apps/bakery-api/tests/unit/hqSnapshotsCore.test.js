/**
 * Z9 snapshot content (`hq-snapshots.core.js`): whitelists (no personal data,
 * D13), German Markdown, preorder sums. All data synthetic; the "personal"
 * values are planted markers that must never come out.
 */
const core = require('../../src/services/hq-snapshots.core')

const MARKERS = [
  'Erika Geheim', // confirmedBy / doneBy / correctionBy display name
  'erika.geheim',
  'Frau Beispielkundin', // free-text correction reason
  'LA-2026-11-28-07', // preorder code
  '0170 1234567',
]

function day(overrides = {}) {
  return {
    date: '2026-11-28',
    weekday: 6,
    weekdayName: 'Samstag',
    status: 'confirmed',
    seasonFactor: 1.2,
    confirmedBy: { id: 3, displayName: 'Erika Geheim' },
    confirmedAt: '2026-11-27T13:05:00.000Z',
    prepDate: '2026-11-27',
    prepDateProvisional: false,
    sections: [
      {
        id: 'broetchen',
        label: 'Brötchen',
        lines: [
          {
            id: 11,
            key: 'weck',
            itemId: 'weck',
            name: 'Weck',
            section: 'broetchen',
            unit: 'Stück',
            variant: null,
            base: 60,
            baseUnset: false,
            seasonal: 12,
            preorders: 10,
            preordersExact: 10,
            preorderIds: [41, 42],
            cap: 5,
            correction: -2,
            correctionReason: 'für Frau Beispielkundin weniger',
            correctionBy: { id: 3, displayName: 'Erika Geheim' },
            total: 85,
            tray: 'Blech 3',
            plu: 107,
            doneAt: '2026-11-28T02:10:00.000Z',
            doneBy: { id: 3, displayName: 'Erika Geheim' },
            delta: { qty: 1, open: 1, count: 1 },
          },
        ],
      },
      {
        id: 'hefeteig',
        label: 'Hefeteig',
        lines: [
          {
            id: 12,
            itemId: 'kranz',
            name: 'Kranz | gefüllt',
            unit: 'Stück',
            variant: 'nuss',
            base: 4,
            seasonal: 1,
            preorders: 2,
            cap: 0,
            correction: 0,
            correctionReason: null,
            total: 7,
            tray: null,
            plu: null,
          },
        ],
      },
    ],
    hefeteig: {
      pieces: 21,
      dough_g: 2100,
      doughs: [
        {
          id: 'hefe',
          name: 'Hefeteig süß',
          batch_max_kg: 10,
          pieces: 21,
          dough_g: 2100,
          batches: 1,
          weighing: [
            {
              piece_g: 100,
              pieces: 21,
              items: [
                {
                  itemId: 'kranz',
                  name: 'Kranz',
                  products: 7,
                  piecesPerProduct: 3,
                  pieces: 21,
                },
              ],
            },
          ],
        },
      ],
    },
    fillings: [
      {
        id: 'nuss',
        name: 'Nuss',
        grams: 1400,
        missingFillingG: false,
        items: [
          {
            itemId: 'kranz',
            name: 'Kranz',
            pieces: 7,
            filling_g: 200,
            grams: 1400,
          },
        ],
        recipe: {
          title: 'Nussfüllung',
          batch_g: 1000,
          grams: 1400,
          factor: 1.4,
          complete: true,
          ingredients: [
            {
              name: 'Haselnüsse',
              g: 500,
              unit: 'g',
              raw: '500 g Haselnüsse',
              scaled_g: 700,
            },
            {
              name: 'Zimt',
              g: null,
              unit: null,
              raw: 'Zimt nach Gefühl',
              scaled_g: null,
            },
          ],
        },
        recipeMissing: false,
      },
    ],
    prep: [
      {
        id: 'sauerteig',
        name: 'Sauerteig ansetzen',
        variant: 'gross',
        note: 'warm stellen',
      },
    ],
    deltas: [
      {
        id: 5,
        itemId: 'weck',
        qty: 1,
        preorderId: 42,
        preorderCode: 'LA-2026-11-28-07',
        acknowledgedBy: { id: 3, displayName: 'Erika Geheim' },
      },
    ],
    warnings: [
      {
        code: 'base_unset',
        items: ['x'],
        message: 'Grundmenge für Samstag noch nicht festgelegt: Testzopf.',
      },
    ],
    configStatus: 'ok',
    configChangedSinceConfirm: false,
    customerPhone: '0170 1234567', // must not leak even if present
    ...overrides,
  }
}

describe('backzettelSnapshot', () => {
  test('keeps the quantities, Hefeteig, fillings and prep', () => {
    const s = core.backzettelSnapshot(day(), { role: 'backstube' })
    expect(s).toMatchObject({
      schema_version: 1,
      kind: 'backzettel',
      date: '2026-11-28',
      weekdayName: 'Samstag',
      seasonFactor: 1.2,
      confirmed: { at: '2026-11-27T13:05:00.000Z', role: 'backstube' },
      prepDate: '2026-11-27',
    })
    expect(s.sections[0].lines[0]).toEqual({
      itemId: 'weck',
      name: 'Weck',
      variant: null,
      unit: 'Stück',
      base: 60,
      seasonal: 12,
      preorders: 10,
      cap: 5,
      correction: -2,
      total: 85,
      tray: 'Blech 3',
      plu: 107,
    })
    expect(s.hefeteig.doughs[0].weighing[0].items[0].pieces).toBe(21)
    expect(s.fillings[0].recipe.ingredients[0]).toEqual({
      name: 'Haselnüsse',
      g: 500,
      unit: 'g',
      scaled_g: 700,
    })
    expect(s.prep).toEqual([
      {
        id: 'sauerteig',
        name: 'Sauerteig ansetzen',
        variant: 'gross',
        note: 'warm stellen',
      },
    ])
    expect(s.warnings).toEqual([
      {
        code: 'base_unset',
        message: 'Grundmenge für Samstag noch nicht festgelegt: Testzopf.',
      },
    ])
  })

  test('contains no personal data (names, reasons, codes, ids of people)', () => {
    const s = core.backzettelSnapshot(day(), { role: 'inhaber' })
    const json = core.toJsonFile(s)
    const md = core.backzettelMarkdown(s)
    for (const marker of MARKERS) {
      expect(json).not.toContain(marker)
      expect(md).not.toContain(marker)
    }
    for (const key of [
      'confirmedBy',
      'correctionBy',
      'correctionReason',
      'doneBy',
      'doneAt',
      'deltas',
      'preorderIds',
      'customerPhone',
    ]) {
      expect(json).not.toContain(`"${key}"`)
    }
  })

  test('an unknown role is not written', () => {
    expect(
      core.backzettelSnapshot(day(), { role: 'hacker' }).confirmed.role
    ).toBeNull()
    expect(core.backzettelSnapshot(day(), {}).confirmed.role).toBeNull()
  })

  test('refuses a draft or a broken date', () => {
    expect(() => core.backzettelSnapshot(day({ status: 'draft' }))).toThrow()
    expect(() => core.backzettelSnapshot(day({ date: '2026-02-30' }))).toThrow()
    expect(() => core.backzettelSnapshot(null)).toThrow()
  })
})

describe('backzettelMarkdown', () => {
  const md = core.backzettelMarkdown(
    core.backzettelSnapshot(day(), { role: 'backstube' })
  )

  test('German heading, role and Berlin time instead of a name', () => {
    expect(md.split('\n')[0]).toBe('# Backzettel Samstag, 28.11.2026')
    expect(md).toContain('Freigegeben (Backstube) am 27.11.2026 um 14:05 Uhr.')
    expect(md).toContain('Saisonfaktor 1,2')
  })

  test('sections as tables, pipes in names escaped', () => {
    expect(md).toContain('## Brötchen')
    expect(md).toContain(
      '| Weck |  | Stück | 60 | +12 | 10 | 5 | −2 | **85** | Blech 3 |'
    )
    expect(md).toContain('| Kranz / gefüllt | nuss |')
  })

  test('Hefeteig weighing list, fillings with recipe, prep, hints', () => {
    expect(md).toContain('## Hefeteig')
    expect(md).toContain('Insgesamt 21 Teigstücke, 2,1 kg Teig.')
    expect(md).toContain('1 Charge (höchstens 10 kg je Charge)')
    expect(md).toContain('| 100 g | 21 | 7 × Kranz (je 3 Stück) |')
    expect(md).toContain('### Nuss: 1,4 kg')
    expect(md).toContain('- 7 × Kranz à 200 g')
    expect(md).toContain('- Haselnüsse: 700 g')
    expect(md).toContain('- Zimt: nach Gefühl')
    expect(md).toContain('## Vorbereitung (am 27.11.2026)')
    expect(md).toContain('- Sauerteig ansetzen: gross - warm stellen')
    expect(md).toContain('## Hinweise')
  })

  test('an empty day says so; no Hefeteig section without doughs', () => {
    const empty = core.backzettelMarkdown(
      core.backzettelSnapshot(
        day({
          sections: [],
          hefeteig: { pieces: 0, dough_g: 0, doughs: [] },
          fillings: [],
          prep: [],
          warnings: [],
        }),
        { role: 'backstube' }
      )
    )
    expect(empty).toContain('_Keine Posten an diesem Tag._')
    expect(empty).not.toContain('## Hefeteig')
  })
})

describe('preorderSnapshot', () => {
  const dayData = {
    date: '2026-11-28',
    summary: { count: 3, total: 99.5 },
    sums: [
      {
        productId: 'test-stollen',
        variant: '',
        name: 'Teststollen',
        unit: 'Stück',
        quantity: 4,
        preorders: 2,
      },
      {
        productId: 'test-kranz',
        variant: 'nuss',
        name: 'Testkranz',
        unit: 'Stück',
        quantity: 1,
        preorders: 1,
      },
    ],
    pickupPoints: [
      {
        id: 'kindergarten-test',
        name: 'Sammelstelle Test',
        address: 'Teststraße 1',
      },
      { id: 'leer-test', name: 'Leere Stelle' },
    ],
    preorders: [
      {
        id: 1,
        code: 'LA-2026-11-28-01',
        channel: 'telefon',
        customerName: 'Erika Geheim',
        customerPhone: '0170 1234567',
        note: 'Frau Beispielkundin',
        status: 'offen',
        pickupPointId: null,
        total: 20,
      },
      {
        id: 2,
        code: 'MO-2026-11-28-01',
        channel: 'sammelstelle',
        customerName: 'Erika Geheim',
        status: 'bereit',
        pickupPointId: 'kindergarten-test',
        total: 30,
      },
      {
        id: 3,
        code: 'LA-2026-11-28-02',
        channel: 'laden',
        customerName: 'Erika Geheim',
        status: 'abgeholt',
        pickupPointId: null,
        total: 49.5,
      },
      {
        id: 4,
        code: 'LA-2026-11-28-03',
        channel: 'whatsapp',
        customerName: 'Erika Geheim',
        status: 'storniert',
        pickupPointId: null,
        total: 10,
      },
    ],
  }

  test('sums per product/variant and counts per channel and pickup point', () => {
    const s = core.preorderSnapshot(dayData)
    expect(s).toEqual({
      schema_version: 1,
      kind: 'vorbestellungen',
      date: '2026-11-28',
      preorderCount: 3,
      items: [
        {
          productId: 'test-stollen',
          variant: null,
          name: 'Teststollen',
          unit: 'Stück',
          quantity: 4,
          preorders: 2,
        },
        {
          productId: 'test-kranz',
          variant: 'nuss',
          name: 'Testkranz',
          unit: 'Stück',
          quantity: 1,
          preorders: 1,
        },
      ],
      channels: { laden: 1, telefon: 1, whatsapp: 0, shop: 0, sammelstelle: 1 },
      pickupPoints: [
        { id: 'laden', name: 'Laden', count: 2 },
        { id: 'kindergarten-test', name: 'Sammelstelle Test', count: 1 },
        { id: 'leer-test', name: 'Leere Stelle', count: 0 },
      ],
      source: 'Verwaltung (App)',
    })
  })

  test('no names, phones, notes, codes, money or timestamps', () => {
    const json = core.toJsonFile(core.preorderSnapshot(dayData))
    for (const marker of [
      ...MARKERS,
      'MO-2026',
      'Teststraße',
      '99.5',
      '49.5',
    ]) {
      expect(json).not.toContain(marker)
    }
    // Same input, same bytes: a rerun commits nothing.
    expect(core.toJsonFile(core.preorderSnapshot(dayData))).toBe(json)
  })

  test('refuses a bad date', () => {
    expect(() => core.preorderSnapshot({ date: '28.11.2026' })).toThrow()
  })
})

test('paths and commit messages', () => {
  expect(core.snapshotPaths('2026-11-28')).toEqual({
    backzettelJson: 'data/production/backzettel/2026-11-28.json',
    backzettelMd: 'data/production/backzettel/2026-11-28.md',
    preordersJson: 'data/production/vorbestellungen/2026-11-28.json',
  })
  expect(core.backzettelCommitMessage('2026-11-28')).toBe(
    'chore(production): Backzettel 2026-11-28 (App)\n'
  )
  expect(core.preordersCommitMessage('2026-11-28')).toBe(
    'chore(production): Vorbestellungen 2026-11-28 (App)\n'
  )
})
