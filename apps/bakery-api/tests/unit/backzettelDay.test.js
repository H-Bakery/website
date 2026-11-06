/**
 * Z3: backzettel-day.core.js - Eingaben, Schnappschuss, Deltas, freigegebene
 * Zeilen. Synthetische Stammdaten aus tests/fixtures/backzettel.synthetic.js.
 */
const day = require('../../src/services/backzettel-day.core')
const core = require('../../src/services/backzettel.core')
const configCore = require('../../src/services/backzettel-config.core')
const { config, PRODUCTS } = require('../fixtures/backzettel.synthetic')

const cfg = configCore.normalizeConfig(config())
const SAT = '2026-11-28'
const TUE = '2026-11-24'

describe('parseSeasonFactor', () => {
  it.each([
    [1, 1],
    [1.25, 1.25],
    ['1,5', 1.5],
    ['0.8', 0.8],
    [5, 5],
  ])('%p -> %p', (input, value) => {
    expect(day.parseSeasonFactor({ factor: input })).toEqual({
      ok: true,
      value,
    })
  })

  it.each([undefined, null, 'abc', '', true, 0, -1, 5.01, 1.234, '1e2'])(
    'lehnt %p ab',
    (input) => {
      const r = day.parseSeasonFactor({ factor: input })
      expect(r.ok).toBe(false)
      expect(r.error).toBe('validation')
      expect(r.message).toMatch(/Saisonfaktor/)
    }
  )

  it('lehnt einen fehlenden Body ab', () => {
    expect(day.parseSeasonFactor(null).ok).toBe(false)
  })
})

describe('resolveLine', () => {
  it('findet Posten ohne Variante', () => {
    const r = day.resolveLine(cfg, 'weck', undefined)
    expect(r.ok).toBe(true)
    expect(r.variant).toBe('')
    expect(r.item.id).toBe('weck')
  })

  it('findet eine Variante und die Zeile „ohne Angabe“', () => {
    expect(day.resolveLine(cfg, 'zopf-gefuellt', 'nuss').variant).toBe('nuss')
    expect(day.resolveLine(cfg, 'zopf-gefuellt', '').variant).toBe('')
  })

  it('meldet unbekannte Posten und Varianten', () => {
    expect(day.resolveLine(cfg, 'gibt-es-nicht')).toMatchObject({
      ok: false,
      error: 'unknown_item',
    })
    expect(day.resolveLine(cfg, 'zopf-gefuellt', 'kaese')).toMatchObject({
      ok: false,
      error: 'unknown_variant',
    })
    expect(day.resolveLine(cfg, 'weck', 'nuss')).toMatchObject({
      ok: false,
      error: 'unknown_variant',
      message: expect.stringMatching(/keine Varianten/),
    })
  })
})

describe('parseCorrection', () => {
  const weck = cfg.items.find((i) => i.id === 'weck')
  const korn = cfg.items.find((i) => i.id === 'kornbrot')

  it('verlangt einen Grund für eine Korrektur ungleich 0', () => {
    expect(day.parseCorrection({ correction: 5 }, weck)).toMatchObject({
      ok: false,
      error: 'reason_required',
    })
    expect(
      day.parseCorrection({ correction: -3, reason: '   ' }, weck).error
    ).toBe('reason_required')
  })

  it('nimmt Korrektur und getrimmten Grund', () => {
    expect(
      day.parseCorrection({ correction: -3, reason: ' Markt zu ' }, weck)
    ).toEqual({ ok: true, value: { correction: -3, reason: 'Markt zu' } })
  })

  it('0 löscht Korrektur und Grund', () => {
    expect(
      day.parseCorrection({ correction: 0, reason: 'egal' }, weck)
    ).toEqual({ ok: true, value: { correction: 0, reason: null } })
  })

  it('Stück ganzzahlig, Liter auf 0,01', () => {
    expect(day.parseCorrection({ correction: 1.5, reason: 'x' }, weck).ok).toBe(
      false
    )
    expect(
      day.parseCorrection({ correction: '0,25', reason: 'x' }, korn)
    ).toEqual({ ok: true, value: { correction: 0.25, reason: 'x' } })
    expect(
      day.parseCorrection({ correction: 0.125, reason: 'x' }, korn).ok
    ).toBe(false)
  })

  it('lehnt Unsinn ab, statt 0 daraus zu machen', () => {
    for (const correction of [undefined, null, 'abc', '', true, {}, NaN]) {
      expect(
        day.parseCorrection({ correction, reason: 'x' }, weck)
      ).toMatchObject({ ok: false, error: 'validation' })
    }
    expect(
      day.parseCorrection({ correction: 10001, reason: 'x' }, weck).ok
    ).toBe(false)
    expect(day.parseCorrection({ correction: 2, reason: 42 }, weck).error).toBe(
      'validation'
    )
    expect(
      day.parseCorrection({ correction: 2, reason: 'x'.repeat(501) }, weck)
        .error
    ).toBe('validation')
  })
})

describe('snapshotFromPreorders', () => {
  it('flacht ab, lässt Stornos und leere Mengen weg, Variante als ""', () => {
    const snap = day.snapshotFromPreorders([
      {
        id: 2,
        status: 'offen',
        items: [
          { productId: 'test-weck', variant: '', quantity: 3 },
          { productId: 'test-zopf-gefuellt', variant: 'nuss', quantity: 1 },
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
      {
        id: 4,
        status: 'bereit',
        items: [null, { productId: 'test-weck', quantity: 0 }],
      },
    ])
    expect(snap).toEqual([
      { preorderId: 1, productId: 'test-weck', variant: '', qty: 2 },
      { preorderId: 2, productId: 'test-weck', variant: '', qty: 3 },
      {
        preorderId: 2,
        productId: 'test-zopf-gefuellt',
        variant: 'nuss',
        qty: 1,
      },
    ])
  })

  it('wird von computeDay als Vorbestellungen gezählt', () => {
    const snap = day.snapshotFromPreorders([
      {
        id: 1,
        status: 'offen',
        items: [
          { productId: 'test-zopf-gefuellt', variant: 'nuss', quantity: 2 },
        ],
      },
    ])
    const result = core.computeDay({
      config: cfg,
      date: SAT,
      preorderItems: day.toCorePreorderItems(snap, SAT),
    })
    const nuss = result.lines.find(
      (l) => l.itemId === 'zopf-gefuellt' && l.variant === 'nuss'
    )
    expect(nuss.preorders).toBe(2)
    expect(nuss.total).toBe(6)
    expect(nuss.preorderIds).toEqual([1])
  })
})

describe('reconcileDeltas', () => {
  const base = [{ preorderId: 1, productId: 'test-weck', variant: '', qty: 5 }]
  const run = (current, recorded = [], snapshot = base) =>
    day.reconcileDeltas({
      config: cfg,
      date: TUE,
      snapshot,
      current,
      recorded,
      catalog: PRODUCTS,
    })

  it('nichts geändert -> keine Zeile', () => {
    expect(run(base)).toEqual([])
  })

  it('neue Vorbestellung -> added', () => {
    const current = [
      ...base,
      { preorderId: 2, productId: 'test-weck', variant: '', qty: 4 },
    ]
    expect(run(current)).toEqual([
      { itemId: 'weck', variant: '', preorderId: 2, qty: 4, kind: 'added' },
    ])
  })

  it('ist idempotent: gespeicherte Zeilen zählen mit', () => {
    const current = [
      ...base,
      { preorderId: 2, productId: 'test-weck', variant: '', qty: 4 },
    ]
    const recorded = [{ itemId: 'weck', variant: '', preorderId: 2, qty: 4 }]
    expect(run(current, recorded)).toEqual([])
  })

  it('eine Zeile je Änderung: geändert und storniert', () => {
    const recorded = [{ itemId: 'weck', variant: '', preorderId: 2, qty: 4 }]
    const changed = [
      ...base,
      { preorderId: 2, productId: 'test-weck', variant: '', qty: 6 },
    ]
    expect(run(changed, recorded)).toEqual([
      { itemId: 'weck', variant: '', preorderId: 2, qty: 2, kind: 'changed' },
    ])
    const recorded2 = [...recorded, { ...recorded[0], qty: 2 }]
    expect(run(base, recorded2)).toEqual([
      {
        itemId: 'weck',
        variant: '',
        preorderId: 2,
        qty: -6,
        kind: 'cancelled',
      },
    ])
  })

  it('Storno einer schon freigegebenen Vorbestellung', () => {
    expect(run([])).toEqual([
      {
        itemId: 'weck',
        variant: '',
        preorderId: 1,
        qty: -5,
        kind: 'cancelled',
      },
    ])
  })

  it('zurück zum alten Stand -> Gegenbuchung, keine stille Zusammenführung', () => {
    const recorded = [{ itemId: 'weck', variant: '', preorderId: 1, qty: 2 }]
    expect(run(base, recorded)).toEqual([
      { itemId: 'weck', variant: '', preorderId: 1, qty: -2, kind: 'changed' },
    ])
  })

  it('Viertel zählen als 0,25, auch wenn die Summe in der Aufrundung bleibt', () => {
    const snapshot = []
    const current = [
      { preorderId: 9, productId: 'test-kranz-viertel', variant: '', qty: 1 },
    ]
    expect(
      day.reconcileDeltas({
        config: cfg,
        date: SAT,
        snapshot,
        current,
        recorded: [],
      })
    ).toEqual([
      {
        itemId: 'kranz',
        variant: '',
        preorderId: 9,
        qty: 0.25,
        kind: 'added',
      },
    ])
  })

  it('Varianten getrennt, unbekannte Produkte ignoriert', () => {
    const current = [
      {
        preorderId: 3,
        productId: 'test-zopf-gefuellt',
        variant: 'nuss',
        qty: 1,
      },
      {
        preorderId: 3,
        productId: 'test-zopf-gefuellt',
        variant: 'mohn',
        qty: 2,
      },
      { preorderId: 3, productId: 'gibt-es-nicht', variant: '', qty: 7 },
    ]
    const rows = day.reconcileDeltas({
      config: cfg,
      date: SAT,
      snapshot: [],
      current,
      recorded: [],
    })
    expect(rows).toEqual([
      expect.objectContaining({ variant: 'nuss', qty: 1, kind: 'added' }),
      expect.objectContaining({ variant: 'mohn', qty: 2, kind: 'added' }),
    ])
  })

  it('nicht für Ruhetage', () => {
    expect(
      day.reconcileDeltas({
        config: cfg,
        date: '2026-11-23',
        snapshot: [],
        current: base,
        recorded: [],
      })
    ).toEqual([])
  })
})

describe('Freigabe und freigegebene Zeilen', () => {
  const result = core.computeDay({
    config: cfg,
    date: SAT,
    corrections: [{ itemId: 'weck', qty: 5, reason: 'Fest' }],
    preorderItems: [],
  })

  it('linesForConfirm: Speicherform mit Schnappschuss', () => {
    const rows = day.linesForConfirm(result.lines)
    const weck = rows.find((r) => r.itemId === 'weck')
    expect(weck).toEqual({
      itemId: 'weck',
      variant: '',
      name: 'Weck',
      section: 'broetchen',
      unit: 'Stück',
      base: 60,
      seasonal: 0,
      preorders: 0,
      cap: 0,
      correction: 5,
      correctionReason: 'Fest',
      total: 65,
    })
    expect(rows.find((r) => r.itemId === 'zopf-gefuellt').variant).toBe('nuss')
  })

  it('correctionsFromRows: nur Zeilen mit Korrektur', () => {
    expect(
      day.correctionsFromRows([
        { itemId: 'weck', variant: '', correction: 5, correctionReason: 'a' },
        {
          itemId: 'zopf-gefuellt',
          variant: 'nuss',
          correction: -1,
          correctionReason: 'b',
        },
        { itemId: 'kranz', variant: '', correction: 0, correctionReason: null },
      ])
    ).toEqual([
      { itemId: 'weck', variant: null, qty: 5, reason: 'a' },
      { itemId: 'zopf-gefuellt', variant: 'nuss', qty: -1, reason: 'b' },
    ])
  })

  it('frozenSections: gleiche Zahlen wie bei der Freigabe, Reihenfolge der Stammdaten', () => {
    const rows = day
      .linesForConfirm(result.lines)
      .map((r, i) => ({ id: i + 1, ...r }))
      .reverse()
    const sections = day.frozenSections(rows, cfg)
    expect(sections.map((s) => s.id)).toEqual(result.sections.map((s) => s.id))
    const frozen = sections.flatMap((s) => s.lines.map((l) => l.line))
    expect(frozen.map((l) => [l.key, l.total])).toEqual(
      result.lines.map((l) => [l.key, l.total])
    )
    // Hefeteig aus den eingefrorenen Zeilen = Hefeteig der Rechnung
    expect(core.computeHefeteig(cfg, frozen)).toEqual(result.hefeteig)
  })

  it('frozenSections geht auch ohne Stammdaten (kaputte YAML)', () => {
    const rows = [
      {
        id: 1,
        itemId: 'weck',
        variant: '',
        name: 'Weck',
        section: 'broetchen',
        unit: 'Stück',
        base: 40,
        seasonal: 0,
        preorders: 2,
        cap: null,
        correction: 0,
        total: 42,
      },
      {
        id: 2,
        itemId: 'alt',
        variant: '',
        name: 'Alter Posten',
        section: 'sonstiges',
        unit: 'Stück',
        base: 1,
        seasonal: 0,
        preorders: 0,
        cap: 0,
        correction: 0,
        total: 1,
      },
    ]
    const sections = day.frozenSections(rows, null)
    expect(sections.map((s) => s.id)).toEqual(['broetchen', 'sonstiges'])
    expect(sections[0].label).toBe('Brötchen')
    const weck = sections[0].lines[0]
    expect(weck.row.id).toBe(1)
    expect(weck.line).toMatchObject({
      name: 'Weck',
      total: 42,
      cap: 0,
      tray: null,
    })
  })

  it('frozenLine: Blech und Laibe aus den aktuellen Stammdaten', () => {
    const l = day.frozenLine(
      {
        itemId: 'kornbrot',
        variant: '',
        base: 4,
        seasonal: 0,
        preorders: 0,
        cap: 0,
        correction: 0,
        total: 4.5,
      },
      cfg
    )
    expect(l).toMatchObject({
      name: 'Kornbrot',
      unit: 'Liter',
      loavesEstimate: 9,
    })
    expect(
      day.frozenLine({ itemId: 'plunder', variant: '', total: 10 }, cfg).tray
    ).toBe('3 Bleche à 10 (Bleche 7, 8, 9)')
  })
})

describe('Varianten-Formen', () => {
  it('storedVariant / apiVariant', () => {
    expect(day.storedVariant(null)).toBe('')
    expect(day.storedVariant(undefined)).toBe('')
    expect(day.storedVariant('nuss')).toBe('nuss')
    expect(day.apiVariant('')).toBeNull()
    expect(day.apiVariant('nuss')).toBe('nuss')
  })

  it('parseNumber', () => {
    expect(day.parseNumber('2,5')).toBe(2.5)
    expect(day.parseNumber(' -3 ')).toBe(-3)
    expect(day.parseNumber('3 Stück')).toBeNaN()
    expect(day.parseNumber(null)).toBeNaN()
  })
})

describe('Erneute Freigabe und eingefrorene Berechnung', () => {
  const stored = {
    base: 30,
    seasonal: 0,
    preorders: 0,
    cap: 0,
    correction: 10,
    total: 30,
  }

  it('frozenQtyChanged: jede Mengenänderung, nicht die Korrektur selbst', () => {
    expect(day.frozenQtyChanged(stored, { ...stored })).toBe(false)
    // Korrektur steht schon im Entwurf in der Zeile; zählt über total
    expect(day.frozenQtyChanged(stored, { ...stored, total: 40 })).toBe(true)
    expect(day.frozenQtyChanged(stored, { ...stored, preorders: 2 })).toBe(true)
    expect(day.frozenQtyChanged(stored, { ...stored, cap: 1 })).toBe(true)
    // SQLite liefert DECIMAL als Zahl, andere Dialekte als Text
    expect(
      day.frozenQtyChanged(
        { ...stored, total: '4.50' },
        { ...stored, total: 4.5 }
      )
    ).toBe(false)
    expect(day.frozenQtyChanged(null, stored)).toBe(false)
  })

  it('computedSnapshot: Hefeteig, Füllungen, Vorbereitung und Hinweise als JSON', () => {
    const result = core.computeDay({
      config: cfg,
      date: SAT,
      preorderItems: day.toCorePreorderItems(
        [{ preorderId: 1, productId: 'test-alt', variant: '', qty: 2 }],
        SAT
      ),
      catalog: PRODUCTS,
      recipes: {},
    })
    const snap = day.computedSnapshot(result)
    expect(Object.keys(snap).sort()).toEqual([
      'fillings',
      'hefeteig',
      'preordersExact',
      'prep',
      'unsetKeys',
      'warnings',
    ])
    expect(snap.hefeteig).toEqual(result.hefeteig)
    expect(snap.prep).toEqual(result.prep)
    expect(snap.warnings.map((w) => w.code)).toContain('unmapped_product')
    expect(day.computedSnapshot(undefined)).toEqual({
      hefeteig: null,
      fillings: null,
      prep: null,
      warnings: [],
      unsetKeys: [],
      preordersExact: {},
    })
  })

  it('offene Grundmenge bleibt nach der Freigabe offen (unsetKeys)', () => {
    const raw = config()
    raw.items.find((i) => i.id === 'weck').base[6] = null
    const cfgUnset = configCore.normalizeConfig(raw)
    const result = core.computeDay({
      config: cfgUnset,
      date: SAT,
      preorderItems: [],
      catalog: PRODUCTS,
      recipes: {},
    })
    const weck = result.lines.find((l) => l.itemId === 'weck')
    expect(weck.baseUnset).toBe(true)
    const snap = day.computedSnapshot(result)
    expect(snap.unsetKeys).toEqual([weck.key])
    const rows = day
      .linesForConfirm(result.lines)
      .map((r, i) => ({ id: i + 1, ...r }))
    const frozen = day
      .frozenSections(rows, cfgUnset, snap.unsetKeys)
      .flatMap((s) => s.lines.map((l) => l.line))
    expect(frozen.find((l) => l.itemId === 'weck').baseUnset).toBe(true)
    expect(frozen.filter((l) => l.baseUnset)).toHaveLength(1)
    // ältere Freigaben ohne unsetKeys: wie bisher nicht offen
    expect(
      day
        .frozenSections(rows, cfgUnset)
        .flatMap((s) => s.lines)
        .some((l) => l.line.baseUnset)
    ).toBe(false)
  })

  it('snapshotDiffers: nur Hefeteig, Füllungen und Vorbereitung zählen', () => {
    const a = { hefeteig: { dough_g: 1 }, fillings: [], prep: [], warnings: [] }
    expect(day.snapshotDiffers(a, { ...a, warnings: [{ code: 'x' }] })).toBe(
      false
    )
    expect(day.snapshotDiffers(a, { ...a, hefeteig: { dough_g: 2 } })).toBe(
      true
    )
    expect(day.snapshotDiffers(a, { ...a, prep: [{ id: 'p' }] })).toBe(true)
    expect(day.snapshotDiffers(null, a)).toBe(false)
  })

  it('prepDateFor: Vortag, offen wenn der Vortag kein Produktionstag ist (Q-B2)', () => {
    expect(day.prepDateFor(TUE, cfg.days)).toEqual({
      prepDate: '2026-11-23',
      prepDateProvisional: true,
    })
    expect(day.prepDateFor(SAT, cfg.days)).toEqual({
      prepDate: '2026-11-27',
      prepDateProvisional: false,
    })
    expect(day.prepDateFor('2026-03-01', cfg.days).prepDate).toBe('2026-02-28')
    expect(day.prepDateFor(TUE, null).prepDateProvisional).toBeNull()
  })
})

describe('Nachträge in Backmengen (W4-Verifikation)', () => {
  const kranz = { key: 'kranz|nuss', unit: 'Stück', preorders: 2, total: 5 }
  const brot = { key: 'brot', unit: 'Liter', preorders: 1, total: 6.25 }

  it('deltaBakeExtras rundet mit dem exakten Stand bei der Freigabe', () => {
    expect(
      day.deltaBakeExtras(
        [kranz],
        { 'kranz|nuss': { qty: 0.25 } },
        {
          'kranz|nuss': 2,
        }
      )
    ).toEqual({ 'kranz|nuss': 1 })
    // exakt 1,75 → bei der Freigabe schon 2: ein Viertel mehr braucht nichts
    expect(
      day.deltaBakeExtras(
        [kranz],
        { 'kranz|nuss': { qty: 0.25 } },
        {
          'kranz|nuss': 1.75,
        }
      )
    ).toEqual({ 'kranz|nuss': 0 })
    // ohne exakten Stand (ältere Freigabe): gerundete Menge, eher zu viel
    expect(
      day.deltaBakeExtras([kranz], { 'kranz|nuss': { qty: 0.25 } }, null)
    ).toEqual({ 'kranz|nuss': 1 })
    // Storno: weniger backen
    expect(
      day.deltaBakeExtras(
        [kranz],
        { 'kranz|nuss': { qty: -1 } },
        {
          'kranz|nuss': 2,
        }
      )
    ).toEqual({ 'kranz|nuss': -1 })
    // Liter: auf 0,01
    expect(day.deltaBakeExtras([brot], { brot: { qty: 1 } }, {})).toEqual({
      brot: 1,
    })
  })

  it('linesWithExtras und hefeteigFillingsDiff melden nur Änderungen', () => {
    expect(day.linesWithExtras([kranz], { 'kranz|nuss': 1 })[0].total).toBe(6)
    const before = {
      hefeteig: {
        doughs: [
          {
            id: 'h',
            name: 'Hefeteig',
            pieces: 10,
            dough_g: 6000,
            batches: 1,
            weighing: [{ piece_g: 600, pieces: 10 }],
          },
        ],
      },
      fillings: [{ id: 'nuss', name: 'Nussfüllung', grams: 5000 }],
    }
    const after = {
      hefeteig: {
        doughs: [
          {
            ...before.hefeteig.doughs[0],
            pieces: 12,
            dough_g: 7200,
            weighing: [{ piece_g: 600, pieces: 12 }],
          },
        ],
      },
      fillings: [{ id: 'nuss', name: 'Nussfüllung', grams: 6000 }],
    }
    expect(day.hefeteigFillingsDiff(before, before)).toBeNull()
    expect(day.hefeteigFillingsDiff(before, after)).toEqual({
      doughs: [
        {
          id: 'h',
          name: 'Hefeteig',
          pieces: 2,
          totalPieces: 12,
          dough_g: 1200,
          totalDough_g: 7200,
          batches: 1,
          batchesBefore: 1,
          batch_max_kg: null,
          weighing: [{ piece_g: 600, pieces: 2, total: 12 }],
        },
      ],
      fillings: [
        {
          id: 'nuss',
          name: 'Nussfüllung',
          grams: 1000,
          totalGrams: 6000,
          recipe: null,
        },
      ],
    })
  })

  it('nennt die Chargen vor den Nachträgen und das Rezept für die Zusatzfüllung (W4-verify r2)', () => {
    const before = {
      hefeteig: {
        doughs: [
          {
            id: 'h',
            name: 'Hefeteig',
            batch_max_kg: 10,
            pieces: 35,
            dough_g: 20900,
            batches: 3,
            weighing: [],
          },
        ],
      },
      fillings: [],
    }
    const after = {
      hefeteig: {
        doughs: [
          {
            ...before.hefeteig.doughs[0],
            pieces: 52,
            dough_g: 31000,
            batches: 4,
          },
        ],
      },
      fillings: [
        {
          id: 'nuss',
          name: 'Nussfüllung',
          grams: 6000,
          recipe: {
            title: 'Nussfüllung',
            batch_g: 2000,
            complete: true,
            ingredients: [
              { name: 'Nüsse', g: 1000, unit: 'g', raw: '1.000 g' },
              { name: 'Zucker', g: 1000, unit: 'g', raw: '1.000 g' },
            ],
          },
        },
      ],
    }
    const diff = day.hefeteigFillingsDiff(before, after)
    expect(diff.doughs[0]).toMatchObject({
      batches: 4,
      batchesBefore: 3,
      batch_max_kg: 10,
      dough_g: 10100,
    })
    expect(diff.fillings[0].recipe).toMatchObject({
      factor: 3,
      ingredients: [
        expect.objectContaining({ name: 'Nüsse', scaled_g: 3000 }),
        expect.objectContaining({ name: 'Zucker', scaled_g: 3000 }),
      ],
    })
  })

  it('computedSnapshot hält die exakten Vorbestellungen fest', () => {
    expect(
      day.computedSnapshot({
        lines: [
          { key: 'a', preorders: 1, preordersExact: 0.75 },
          { key: 'b', preorders: 0, preordersExact: 0 },
        ],
      }).preordersExact
    ).toEqual({ a: 0.75 })
  })
})
