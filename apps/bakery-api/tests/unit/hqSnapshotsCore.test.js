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
  test('knows the Backstubenleitung as confirming role', () => {
    const s = core.backzettelSnapshot(day(), { role: 'backstubenleiter' })
    expect(s.confirmed).toMatchObject({ role: 'backstubenleiter' })
    expect(core.roleLabel('backstubenleiter')).toBe('Backstubenleitung')
    // an unknown role is never written into hq
    expect(
      core.backzettelSnapshot(day(), { role: 'test.login' }).confirmed.role
    ).toBeNull()
  })

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

  const variantsOf = (id) => (id === 'test-kranz' ? ['nuss', 'mohn'] : null)

  test('sums per product/variant and counts per channel and pickup point', () => {
    const s = core.preorderSnapshot(dayData, { variantsOf })
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

  test('only configured variants are written; free slugs merge into "ohne Sorte" (D13)', () => {
    const data = {
      date: '2026-11-28',
      sums: [
        { productId: 'test-kranz', variant: 'nuss', quantity: 2, preorders: 1 },
        {
          productId: 'test-kranz',
          variant: 'fuer-frau-beispielkundin',
          quantity: 1,
          preorders: 1,
        },
        { productId: 'test-kranz', variant: '', quantity: 3, preorders: 2 },
        // no Backzettel master data: any slug was accepted by the preorder
        {
          productId: 'test-frei',
          variant: 'erika-geheim',
          quantity: 5,
          preorders: 1,
        },
      ],
    }
    const s = core.preorderSnapshot(data, { variantsOf })
    expect(
      s.items.map(({ productId, variant, quantity, preorders }) => ({
        productId,
        variant,
        quantity,
        preorders,
      }))
    ).toEqual([
      { productId: 'test-kranz', variant: 'nuss', quantity: 2, preorders: 1 },
      { productId: 'test-kranz', variant: null, quantity: 4, preorders: 3 },
      { productId: 'test-frei', variant: null, quantity: 5, preorders: 1 },
    ])
    const json = core.toJsonFile(s)
    expect(json).not.toContain('beispielkundin')
    expect(json).not.toContain('erika-geheim')
    // without a lookup no slug is trusted
    expect(
      core.preorderSnapshot(data).items.every((i) => i.variant === null)
    ).toBe(true)
  })
})

describe('Backzettel warnings and reopen', () => {
  test('warnings quoting a raw variant get a fixed text without the slug', () => {
    const s = core.backzettelSnapshot(
      day({
        warnings: [
          {
            code: 'unknown_variant',
            itemId: 'zopf',
            variant: 'fuer-erika-geheim',
            message:
              '„Zopf“ kennt die Variante „fuer-erika-geheim“ nicht (Vorbestellung).',
          },
          {
            code: 'variant_ignored',
            itemId: 'weck',
            variant: 'frau-beispielkundin',
            message: '„Weck“ hat keine Varianten; „frau-beispielkundin“ ...',
          },
          {
            code: 'unknown_correction',
            itemId: 'weck',
            message:
              'Korrektur für „Weck“, Variante „erika-geheim“, wird ignoriert',
          },
          { code: 'base_unset', message: 'Grundmenge fehlt.' },
        ],
      }),
      { role: 'backstube' }
    )
    expect(s.warnings.map((w) => w.code)).toEqual([
      'unknown_variant',
      'variant_ignored',
      'unknown_correction',
      'base_unset',
    ])
    expect(s.warnings[0].message).toContain('„zopf“')
    expect(s.warnings[3].message).toBe('Grundmenge fehlt.')
    const out = core.toJsonFile(s) + core.backzettelMarkdown(s)
    expect(out).not.toMatch(/geheim|beispielkundin/i)
  })

  test('confirmed snapshots say so; a reopen replaces them with a note (role only)', () => {
    expect(core.backzettelSnapshot(day(), { role: 'backstube' }).status).toBe(
      'confirmed'
    )
    const s = core.backzettelReopenedSnapshot({
      date: '2026-11-28',
      at: '2026-11-27T15:00:00.000Z',
      role: 'inhaber',
    })
    expect(s).toEqual({
      schema_version: 1,
      kind: 'backzettel',
      status: 'reopened',
      date: '2026-11-28',
      reopened: { at: '2026-11-27T15:00:00.000Z', role: 'inhaber' },
      source: 'Verwaltung (App)',
    })
    const md = core.backzettelMarkdown(s)
    expect(md.split('\n')[0]).toBe('# Backzettel 28.11.2026: wieder geöffnet')
    expect(md).toContain(
      'Wieder geöffnet (Inhaber) am 27.11.2026 um 16:00 Uhr.'
    )
    expect(md).not.toContain('Freigegeben')
    expect(
      core.backzettelReopenedSnapshot({ date: '2026-11-28', role: 'x' })
        .reopened
    ).toEqual({ at: null, role: null })
    expect(() => core.backzettelReopenedSnapshot({ date: 'gestern' })).toThrow()
    expect(core.backzettelReopenedCommitMessage('2026-11-28')).toBe(
      'chore(production): Backzettel 2026-11-28 wieder geöffnet (App)\n'
    )
  })
})

test('paths and commit messages', () => {
  expect(core.snapshotPaths('2026-11-28')).toEqual({
    backzettelJson: 'data/production/backzettel/2026-11-28.json',
    backzettelMd: 'data/production/backzettel/2026-11-28.md',
    preordersJson: 'data/production/vorbestellungen/2026-11-28.json',
    restJson: 'data/production/rest/2026-11-28.json',
  })
  expect(core.backzettelCommitMessage('2026-11-28')).toBe(
    'chore(production): Backzettel 2026-11-28 (App)\n'
  )
  expect(core.preordersCommitMessage('2026-11-28')).toBe(
    'chore(production): Vorbestellungen 2026-11-28 (App)\n'
  )
})

describe('restSnapshot (M4 Rest am Abend)', () => {
  const view = {
    date: '2026-12-01',
    weekday: 2,
    status: 'ok',
    backzettelStatus: 'confirmed',
    summary: {
      lastCountedAt: '2026-12-01T17:00:00.000Z',
      lastCountedBy: { id: 3, displayName: 'Erika Geheim' },
    },
    lines: [
      {
        key: 'kranz|',
        itemId: 'kranz',
        variant: null,
        name: 'Kranz',
        section: 'hefeteig',
        unit: 'Stück',
        baked: 4,
        cap: 1,
        counted: true,
        rest: 1.5,
        rows: [
          {
            productId: 'test-kranz',
            label: 'Kranz',
            unit: 'Stück',
            factor: 1,
            qty: 1,
            countedAt: '2026-12-01T17:00:00.000Z',
            countedBy: { id: 3, displayName: 'Erika Geheim' },
            revision: 2,
          },
          {
            productId: 'test-kranz-viertel',
            label: 'Kranz Viertel',
            unit: 'Stück',
            factor: 0.25,
            qty: 2,
            countedBy: { id: 3, displayName: 'erika.geheim' },
          },
        ],
      },
      {
        key: 'weck|',
        itemId: 'weck',
        variant: null,
        name: 'Weck',
        section: 'broetchen',
        unit: 'Stück',
        baked: 40,
        cap: 0,
        counted: false,
        rest: null,
        restSoFar: null,
        rows: [
          {
            productId: 'test-weck',
            label: 'Weck',
            unit: 'Stück',
            factor: 1,
            qty: null,
          },
        ],
      },
    ],
  }

  it('writes baked, rest and counts per line - never who counted or when', () => {
    const s = core.restSnapshot(view)
    expect(s).toEqual({
      schema_version: 1,
      kind: 'rest',
      date: '2026-12-01',
      backzettel: 'confirmed',
      countedLines: 1,
      lines: 2,
      items: [
        {
          itemId: 'kranz',
          variant: null,
          name: 'Kranz',
          section: 'hefeteig',
          unit: 'Stück',
          baked: 4,
          cap: 1,
          counted: true,
          rest: 1.5,
          counts: [
            {
              productId: 'test-kranz',
              name: 'Kranz',
              unit: 'Stück',
              qty: 1,
              factor: 1,
            },
            {
              productId: 'test-kranz-viertel',
              name: 'Kranz Viertel',
              unit: 'Stück',
              qty: 2,
              factor: 0.25,
            },
          ],
        },
        {
          itemId: 'weck',
          variant: null,
          name: 'Weck',
          section: 'broetchen',
          unit: 'Stück',
          baked: 40,
          cap: 0,
          counted: false,
          rest: null,
          counts: [],
        },
      ],
      source: 'Verwaltung (App)',
    })
    const text = core.toJsonFile(s)
    for (const marker of MARKERS) expect(text).not.toContain(marker)
    expect(text).not.toContain('2026-12-01T17')
    expect(core.snapshotPaths('2026-12-01').restJson).toBe(
      'data/production/rest/2026-12-01.json'
    )
    expect(core.restCommitMessage('2026-12-01')).toBe(
      'chore(production): Rest am Abend 2026-12-01 (App)\n'
    )
  })

  it('refuses a view without a valid date', () => {
    expect(() => core.restSnapshot({ date: '2026-02-30', lines: [] })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Schema 2: dough-day sheets (Backzettel v2, Z10, R31). The day comes from
// the real core (`computeDoughDay` on the synthetic `configV2`), with the
// same planted personal markers as above.
// ---------------------------------------------------------------------------

describe('backzettelSnapshot schema 2 (Backzettel v2)', () => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const bz = require('../../src/services/backzettel.core')
  const configCore = require('../../src/services/backzettel-config.core')
  const fixture = require('../fixtures/backzettel.synthetic')
  /* eslint-enable @typescript-eslint/no-var-requires */
  const config = configCore.normalizeConfig(fixture.configV2())

  /** A confirmed dough-day sheet as the API answers it, with markers. */
  function sheet(date, opts = {}) {
    const s = bz.computeDoughDay({
      config: opts.config || config,
      date,
      seasonFactor: 1,
      bakeInputs: opts.bakeInputs || {},
      corrections: [],
      recipes: {},
      catalog: fixture.PRODUCTS_V2,
    })
    return {
      ...s,
      status: 'confirmed',
      confirmedAt: '2026-11-27T13:05:00.000Z',
      confirmedBy: { id: 3, displayName: 'Erika Geheim' },
      sections: s.sections.map((sec) => ({
        ...sec,
        lines: sec.lines.map((l, i) => ({
          id: 100 + i,
          ...l,
          correctionReason: 'für Frau Beispielkundin weniger',
          correctionBy: { id: 3, displayName: 'Erika Geheim' },
          doneBy: { id: 3, displayName: 'erika.geheim' },
          preorderIds: [41],
        })),
      })),
      deltas: [
        { id: 5, preorderCode: 'LA-2026-11-28-07', bakeDate: '2026-12-01' },
      ],
      customerPhone: '0170 1234567',
    }
  }

  test('writes schema 2 with bake days, doughs, machine and Brüche', () => {
    const s = core.backzettelSnapshot(sheet('2026-11-28'), {
      role: 'backstube',
    })
    expect(s).toMatchObject({
      schema_version: 2,
      sheetVersion: 2,
      isDoughDay: true,
      date: '2026-11-28',
      bakeDates: [
        expect.objectContaining({ date: '2026-11-28', label: 'heute' }),
        expect.objectContaining({ date: '2026-11-29' }),
        expect.objectContaining({ date: '2026-12-01' }),
      ],
    })
    expect(core.SNAPSHOT_SCHEMA_VERSION_V2).toBe(2)
    const lines = s.sections.flatMap((x) => x.lines)
    const tuesdayRoll = lines.find(
      (l) => l.itemId === 'test-doppel' && l.bakeDate === '2026-12-01'
    )
    expect(tuesdayRoll).toMatchObject({
      doughDate: '2026-11-28',
      total: 40,
      variantLabel: null,
    })
    expect(lines.find((l) => l.itemId === 'test-korn')).toMatchObject({
      variant: 'g500',
      variantLabel: '500 g',
      bakeDate: '2026-11-28',
    })
    const box = s.machine.find((m) => m.id === 'test-korn-teig')
    expect(box.doughIds).toEqual(['test-korn-teig', 'test-holz-teig'])
    expect(box.addons[0]).toMatchObject({ id: 'test-sauer' })
    const tuesday = s.rolls.find((b) => b.bakeDate === '2026-12-01')
    expect(tuesday.groups[0]).toMatchObject({
      brueche: 4,
      split: [expect.objectContaining({ itemId: 'test-doppel', total: 40 })],
    })
    expect(s.openMasterData.length).toBeGreaterThan(0)
    expect(Object.keys(s).pop()).toBe('source')
  })

  test('unknown master data stays null, never 0', () => {
    const sat = core.backzettelSnapshot(sheet('2026-11-28'), {})
    const flit = sat.machine.find((m) => m.id === 'test-flit-teig')
    expect(flit.liters).toEqual({
      exact: null,
      rounded: null,
      reason: 'kg_per_liter_unknown',
    })
    expect(flit.batches).toBeNull()
    const nuss = sat.fillings.find((f) => f.id === 'nuss')
    expect(nuss).toMatchObject({
      grams: null,
      gramsKnown: 0,
      missingFillingG: true,
    })
    // Tuesday: a size without a Grundmenge (`kasten: null`) stays open.
    const tue = core.backzettelSnapshot(sheet('2026-12-01'), {})
    const kasten = tue.sections
      .flatMap((x) => x.lines)
      .find((l) => l.itemId === 'test-korn' && l.variant === 'kasten')
    expect(kasten).toMatchObject({ base: null, baseUnset: true })
    const md = core.backzettelMarkdown(tue)
    expect(md).toMatch(/\| Testkorn \| Kasten \| Stück \| offen \|/)

    const satMd = core.backzettelMarkdown(sat)
    expect(satMd).toContain(
      '| Testflit | 6,2 kg | unbekannt (kg je Liter offen) | unbekannt |'
    )
    expect(satMd).toContain(
      '### Nussfüllung: Menge unbekannt (Füllmenge je Stück fehlt)'
    )
    expect(satMd).toContain('## Offene Stammdaten')
  })

  test('Markdown groups rolls by bake day', () => {
    const md = core.backzettelMarkdown(
      core.backzettelSnapshot(sheet('2026-11-28'), { role: 'backstube' })
    )
    expect(md).toContain(
      'Teig von heute auch für: Sonntag, 29.11.2026; Dienstag, 01.12.2026.'
    )
    expect(md).toContain('## Teige an der Maschine')
    expect(md).toContain('## Brötchen nach Backtag')
    expect(md).toContain(
      '- 4 Bruch × 1.200 g = 4,8 kg – 40 Testdoppel (je 2 Teigstücke)'
    )
    const broetchen = md.slice(md.indexOf('## Brötchen\n'))
    const sun = broetchen.indexOf('### Für Sonntag, 29.11.2026')
    const tue = broetchen.indexOf('### Für Dienstag, 01.12.2026')
    expect(sun).toBeGreaterThan(-1)
    expect(tue).toBeGreaterThan(sun)
  })

  test('Zugabe je Bruch (U3): JSON keeps addons, Markdown shows „+ … kg“', () => {
    const cfg = fixture.configV2()
    cfg.items.find((i) => i.id === 'test-doppel').bruch.addons = [
      { name: 'Testkörner', g: 300 },
    ]
    const s = core.backzettelSnapshot(sheet('2026-11-28', { config: cfg }), {})
    const tuesday = s.rolls.find((b) => b.bakeDate === '2026-12-01')
    expect(tuesday.groups[0].addons).toEqual([
      { name: 'Testkörner', gPerBruch: 300, g: 1200, gKnown: 1200 },
    ])
    expect(core.backzettelMarkdown(s)).toContain(
      '- 4 Bruch × 1.200 g = 4,8 kg + 1,2 kg Testkörner – 40 Testdoppel (je 2 Teigstücke)'
    )
  })

  test('keeps the whitelist: no names, reasons, codes, plan or bread view', () => {
    const s = core.backzettelSnapshot(sheet('2026-11-28'), { role: 'inhaber' })
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
      'deltas',
      'preorderIds',
      'customerPhone',
      'plan',
      'bread',
    ]) {
      expect(json).not.toContain(`"${key}"`)
    }
  })

  test('an open Grundmenge in a Bruch group stays open - JSON and Markdown (review Z10 round 2)', () => {
    const raw = fixture.configV2()
    raw.items.find((i) => i.id === 'test-kaese').base[2] = null
    raw.items.find((i) => i.id === 'test-stern').base[2] = null
    const TUE = '2026-12-01'
    const pre = (productId, qty) => ({ productId, qty, pickupDate: TUE })
    const s = core.backzettelSnapshot(
      sheet('2026-11-28', {
        config: configCore.normalizeConfig(raw),
        bakeInputs: {
          [TUE]: {
            preorderItems: [pre('test-stern', 7), pre('test-doppel', 3)],
            capTemplate: [],
          },
        },
      }),
      {}
    )
    const tue = s.rolls.find((b) => b.bakeDate === TUE)
    const mixed = tue.groups.find((g) => g.group === 'test-gemischt')
    expect(mixed).toMatchObject({
      brueche: null,
      kg: null,
      bruecheKnown: 1,
      complete: false,
    })
    expect(mixed.kgKnown).toBeGreaterThan(0)
    expect(mixed.split).toEqual([
      expect.objectContaining({
        itemId: 'test-stern',
        total: 7,
        totalIsMinimum: true,
      }),
      expect.objectContaining({
        itemId: 'test-kaese',
        total: 0,
        totalIsMinimum: true,
      }),
    ])
    const stern = s.sections
      .flatMap((x) => x.lines)
      .find((l) => l.itemId === 'test-stern' && l.bakeDate === TUE)
    expect(stern).toMatchObject({ total: 7, totalIsMinimum: true })

    const md = core.backzettelMarkdown(s)
    expect(md).toMatch(/- ≥ 1 Bruch × [^\n]* – ≥ 7 Teststern, Testkäse offen\n/)
    expect(md).not.toMatch(/ 0 Testkäse/)
    expect(md).toMatch(/\| Teststern \| [^\n]*\*\*≥ 7\*\*/)
    // per_product 2: 43 Doppel = 86 Teigstücke, 5 Bruch à 20 → 14 Teigstücke
    // frei = 7 Doppelweck, nicht „+14 frei“
    const doppel = tue.groups.find((g) => g.split[0].itemId === 'test-doppel')
    expect(doppel).toMatchObject({ spare: 14, spareProducts: 7, perProduct: 2 })
    expect(md).toContain('43 Testdoppel (je 2 Teigstücke) (+7 frei)')
  })

  test('a day confirmed before Z10 stays schema 1 without the new fields', () => {
    const s = core.backzettelSnapshot(
      day({ sheetVersion: 1, plan: { version: 1 } }),
      {}
    )
    expect(s.schema_version).toBe(1)
    for (const key of ['sheetVersion', 'bakeDates', 'machine', 'rolls']) {
      expect(s).not.toHaveProperty(key)
    }
    expect(s.sections[0].lines[0]).not.toHaveProperty('bakeDate')
    expect(core.backzettelMarkdown(s)).not.toContain('Teige an der Maschine')
  })
})
