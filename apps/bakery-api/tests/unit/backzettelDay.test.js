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

  it('lehnt Steuerzeichen im Grund ab (W4-verify r3)', () => {
    for (const reason of ['Grund\u0000', 'Grund\u202eTSET', 'Grund\u0007']) {
      expect(day.parseCorrection({ correction: 1, reason }, weck)).toEqual({
        ok: false,
        error: 'INVALID_TEXT',
        message: 'Der Grund enthält unzulässige Steuerzeichen.',
      })
    }
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

  it('Menge auf 0: storniert nur bei Storno, sonst entfernt bzw. verschoben (W4-verify r5)', () => {
    const at = (orders) =>
      day.reconcileDeltas({
        config: cfg,
        date: TUE,
        snapshot: base,
        current: [],
        recorded: [],
        catalog: PRODUCTS,
        orders,
      })[0].kind
    expect(at({ 1: 'storniert' })).toBe('cancelled')
    expect(at({ 1: 'offen' })).toBe('removed')
    expect(at({})).toBe('moved')
    // ohne Angabe wie bisher
    expect(at(undefined)).toBe('cancelled')
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
    ).toBe('1 Blech à 10 (Blech 7)')
    expect(
      day.frozenLine({ itemId: 'plunder', variant: '', total: 25 }, cfg).tray
    ).toBe('3 Bleche à 10 (Bleche 7, 8, 9)')
  })

  it('frozenLine: Zukauf-Hinweis aus den aktuellen Stammdaten, sonst ohne', () => {
    const raw = config()
    const schnecke = raw.items.find((i) => i.id === 'schnecke')
    schnecke.purchased = true
    schnecke.note = 'mit Käse bestreuen'
    const withHint = configCore.normalizeConfig(raw)
    expect(
      day.frozenLine({ itemId: 'schnecke', variant: '', total: 6 }, withHint)
    ).toMatchObject({
      purchased: true,
      note: 'mit Käse bestreuen',
      hint: 'Zukauf – auflegen · mit Käse bestreuen',
    })
    const plain = day.frozenLine({ itemId: 'weck', variant: '', total: 6 }, cfg)
    expect(plain).not.toHaveProperty('hint')
    expect(plain).not.toHaveProperty('purchased')
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

  it('ticksAfterConfirm (O5): erledigt und gebacken nach derselben Regel, je für sich', () => {
    const at = '2026-11-28T04:00:00.000Z'
    const both = { ...stored, doneAt: at, bakedAt: at }
    // Gleiche Menge oder weniger: beide Haken bleiben.
    expect(day.ticksAfterConfirm(both, { ...stored })).toEqual({
      done: true,
      baked: true,
    })
    expect(day.ticksAfterConfirm(both, { ...stored, total: 24 })).toEqual({
      done: true,
      baked: true,
    })
    // Mehr nötig: beide fallen weg.
    expect(day.ticksAfterConfirm(both, { ...stored, total: 36 })).toEqual({
      done: false,
      baked: false,
    })
    // Nur gebacken gesetzt (nicht „gemacht“ getippt) - unabhängig.
    expect(
      day.ticksAfterConfirm(
        { ...stored, doneAt: null, bakedAt: at },
        { ...stored, total: 36 }
      )
    ).toEqual({ done: null, baked: false })
    expect(
      day.ticksAfterConfirm({ ...stored, doneAt: at }, { ...stored })
    ).toEqual({ done: true, baked: null })
  })

  it('bakedAfterConfirm (O5): gebackene Nachträge zählen nach Wieder öffnen mit', () => {
    const at = '2026-11-28T04:00:00.000Z'
    const row = { ...stored, bakedAt: at }
    const more = { ...stored, total: stored.total + 8 }
    // Zeile gebacken, +8 als Nachtrag gebacken: deckt die neue Menge.
    expect(day.bakedAfterConfirm(row, more, 8)).toEqual({
      baked: true,
      qty: stored.total + 8,
    })
    // Nur +5 der +8 gebacken: Haken fällt, schon gebacken ist Zeile + 5.
    expect(day.bakedAfterConfirm(row, more, 5)).toEqual({
      baked: false,
      qty: stored.total + 5,
    })
    // Zeile nicht gebacken, nur der Nachtrag: teils gebacken.
    expect(day.bakedAfterConfirm({ ...stored }, more, 8)).toEqual({
      baked: false,
      qty: 8,
    })
    // Neue Zeile nur aus einem gebackenen Nachtrag: gesetzt.
    expect(day.bakedAfterConfirm(null, { total: 6 }, 6)).toEqual({
      baked: true,
      qty: 6,
    })
    // Ohne gebackene Nachträge die Regel von „erledigt“; nie unter 0.
    expect(day.bakedAfterConfirm(row, more, 0).baked).toBe(false)
    expect(day.bakedAfterConfirm(row, { ...stored }, -3)).toEqual({
      baked: true,
      qty: stored.total,
    })
    expect(day.bakedAfterConfirm({ ...stored }, more, null)).toEqual({
      baked: null,
      qty: 0,
    })
    expect(day.ticksAfterConfirm(row, more, 8)).toEqual({
      done: null,
      baked: true,
    })
    expect(day.ticksAfterConfirm(null, more, 8)).toEqual({
      done: null,
      baked: false,
    })
  })

  it('deltaBakedUpdate (O5): gebacken heißt auch gesehen, zurücknehmen nur den Haken', () => {
    const at = new Date('2026-11-29T05:00:00Z')
    const open = { bakedAt: null, acknowledgedAt: null }
    expect(day.deltaBakedUpdate(open, true, at, 7)).toEqual({
      bakedAt: at,
      bakedBy: 7,
      acknowledgedAt: at,
      acknowledgedBy: 7,
    })
    const seen = { bakedAt: null, acknowledgedAt: '2026-11-28T10:00:00Z' }
    expect(day.deltaBakedUpdate(seen, true, at, 7)).toEqual({
      bakedAt: at,
      bakedBy: 7,
    })
    // Schon gebacken / nicht gebacken: nichts zu tun.
    const baked = { ...seen, bakedAt: at }
    expect(day.deltaBakedUpdate(baked, true, at, 7)).toBeNull()
    expect(day.deltaBakedUpdate(open, false, at, 7)).toBeNull()
    expect(day.deltaBakedUpdate(baked, false, at, 7)).toEqual({
      bakedAt: null,
      bakedBy: null,
    })
    // Ohne Person (Skript): null, nie undefined.
    expect(day.deltaBakedUpdate(seen, true, at, undefined)).toEqual({
      bakedAt: at,
      bakedBy: null,
    })
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
      'subtotalExact',
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
      subtotalExact: {},
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

  it('snapshotDiffers (Z10): ein Teigtag-Zettel vergleicht auch Teige, Maschine, Brot, Brötchen und Plan', () => {
    const plan = {
      version: 2,
      doughDate: '2026-11-28',
      bakeDates: [{ date: '2026-11-28', itemIds: ['a'] }],
    }
    const snap = {
      hefeteig: null,
      fillings: [],
      prep: [],
      plan,
      doughs: [{ id: 'd', kg: 6, liters: 2 }],
      machine: [{ id: 'd', kg: 6 }],
      bread: null,
      rolls: [],
      openMasterData: [],
    }
    const same = {
      // andere Reihenfolge der Felder: gleich
      machine: [{ kg: 6, id: 'd' }],
      doughs: [{ liters: 2, kg: 6, id: 'd' }],
      prep: [],
      fillings: [],
      hefeteig: null,
      bread: null,
      rolls: [],
      openMasterData: [],
      planDrift: { bakeDates: ['2026-11-28'], moved: [], added: [] },
    }
    expect(day.snapshotDiffers(snap, same)).toBe(false)
    expect(
      day.snapshotDiffers(snap, { ...same, machine: [{ id: 'd', kg: 8 }] })
    ).toBe(true)
    expect(
      day.snapshotDiffers(snap, {
        ...same,
        planDrift: {
          bakeDates: ['2026-11-28'],
          moved: ['2026-11-28|a'],
          added: [],
        },
      })
    ).toBe(true)
    expect(
      day.snapshotDiffers(snap, {
        ...same,
        planDrift: {
          bakeDates: ['2026-11-28'],
          moved: [],
          added: ['2026-11-28|b'],
        },
      })
    ).toBe(true)
    // ein alter Tag (ohne Plan) vergleicht wie bisher nur Hefeteig & Co.
    const { plan: _p, ...old } = snap
    void _p
    expect(
      day.snapshotDiffers(old, { ...same, machine: [{ id: 'd', kg: 8 }] })
    ).toBe(false)
  })

  it('planDrift: Backtage und verschobene Paare, übernommene Posten zählen nicht', () => {
    const c = {
      days: [2, 3, 4, 5, 6, 7],
      dough_days: [2, 3, 4, 5, 6],
      items: [{ id: 'weck', lead: 1 }, { id: 'brot' }],
    }
    const plan = {
      version: 2,
      doughDate: '2026-11-28',
      bakeDates: [
        { date: '2026-11-28', itemIds: ['brot', 'alt'] },
        { date: '2026-11-29', itemIds: ['weck'] },
      ],
    }
    const adopted = [{ code: 'adopted_orphans', items: ['alt'] }]
    expect(day.planDrift(null, plan)).toEqual({
      bakeDates: ['2026-11-28', '2026-11-29'],
      moved: [],
      added: [],
    })
    // „alt“ fehlt in hq, ist aber übernommen; sonst passt alles
    expect(day.planDrift(c, plan, adopted).moved).toEqual([])
    expect(day.planDrift(c, plan, []).moved).toEqual(['2026-11-28|alt'])
    // lead 0: der Sonntags-Weck wäre jetzt am Sonntag dran
    const moved = day.planDrift(
      { ...c, items: [{ id: 'weck' }, { id: 'brot' }] },
      plan,
      adopted
    )
    expect(moved).toEqual({
      bakeDates: ['2026-11-28'],
      moved: ['2026-11-29|weck'],
      added: [],
    })
  })

  it('planDrift: Paare, die neu auf den Teigtag fallen (lead), ohne Fehlalarm', () => {
    // Samstag 2026-11-28: Weck für Sonntag und Dienstag, Brot am Samstag
    const c = {
      days: [2, 3, 4, 5, 6, 7],
      dough_days: [2, 3, 4, 5, 6],
      items: [{ id: 'weck', lead: 1 }, { id: 'brot' }, { id: 'sonntag-x' }],
    }
    const plan = {
      version: 2,
      doughDate: '2026-11-28',
      bakeDates: [
        { date: '2026-11-28', itemIds: ['brot', 'sonntag-x'] },
        { date: '2026-11-29', itemIds: ['weck'] },
        { date: '2026-12-01', itemIds: ['weck'] },
      ],
      knownItems: ['weck', 'brot', 'sonntag-x'],
    }
    // unverändert: nichts verschoben, nichts neu
    expect(day.planDrift(c, plan, [])).toEqual({
      bakeDates: ['2026-11-28', '2026-11-29', '2026-12-01'],
      moved: [],
      added: [],
    })
    // der Sonntags-Posten wird jetzt am Samstag gemacht (lead 1 nur sonntags)
    const sundayOnly = {
      ...c,
      items: [
        { id: 'weck', lead: 1 },
        { id: 'brot' },
        { id: 'sonntag-x', lead: { 7: 1 } },
      ],
    }
    expect(day.planDrift(sundayOnly, plan, [])).toEqual({
      bakeDates: ['2026-11-28', '2026-11-29', '2026-12-01'],
      moved: [],
      added: ['2026-11-29|sonntag-x'],
    })
    // trägt ein anderer freigegebener Zettel das Paar, bleibt es dort
    expect(
      day.planDrift(sundayOnly, plan, [], new Set(['2026-11-29|sonntag-x']))
        .added
    ).toEqual([])
    expect(
      day.planDrift(
        sundayOnly,
        plan,
        [],
        new Map([['2026-11-29|sonntag-x', '2026-11-29']])
      ).added
    ).toEqual([])
    // trug es schon beim Freigeben ein anderer Zettel, fehlt es nicht wegen
    // der Stammdaten - auch wenn jener Zettel inzwischen wieder offen ist
    const skipped = [
      {
        code: 'owned_elsewhere',
        items: [{ date: '2026-11-29', itemId: 'sonntag-x' }],
      },
    ]
    expect(day.planDrift(sundayOnly, plan, skipped).added).toEqual([])
    // ein später in hq ergänzter Posten deckt der Plan ohnehin (planCovers)
    const neu = { ...c, items: [...c.items, { id: 'neu', lead: 1 }] }
    expect(day.planDrift(neu, plan, []).added).toEqual([])
    // ohne knownItems lässt sich neu und verschoben nicht unterscheiden
    const { knownItems: _k, ...noKnown } = plan
    void _k
    expect(day.planDrift(sundayOnly, noKnown, []).added).toEqual([])
    // der Vergleich sieht es
    const snap = { plan, warnings: [] }
    expect(
      day.snapshotDiffers(snap, { planDrift: day.planDrift(c, plan, []) })
    ).toBe(false)
    expect(
      day.snapshotDiffers(snap, {
        planDrift: day.planDrift(sundayOnly, plan, []),
      })
    ).toBe(true)
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

  it('deltaBakeExtras rechnet auf der ganzen Zeile vor dem Aufrunden (W4-verify r4)', () => {
    // Freigabe: 2 + 0,75 Vorbestellt + 0,25 CAP = genau 3. Ein Viertel mehr
    // ist ein vierter Kranz - mit nur den Vorbestellungen (1,0) sähe es nach
    // „nichts zusätzlich“ aus.
    expect(
      day.deltaBakeExtras(
        [kranz],
        { 'kranz|nuss': { qty: 0.25 } },
        { 'kranz|nuss': 1 },
        { 'kranz|nuss': 3 }
      )
    ).toEqual({ 'kranz|nuss': 1 })
    expect(
      day.deltaBakeExtras(
        [kranz],
        { 'kranz|nuss': { qty: 0.25 } },
        { 'kranz|nuss': 1 },
        { 'kranz|nuss': 2.7 }
      )
    ).toEqual({ 'kranz|nuss': 0 })
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

// ---------------------------------------------------------------------------
// Backzettel v2 (Z10): Zettel je Teigtag, Deltas nach Plan, Freigabe v2
// ---------------------------------------------------------------------------

const planCore = require('../../src/services/backzettel-plan.core')
const { configV2, PRODUCTS_V2 } = require('../fixtures/backzettel.synthetic')

describe('Z10: Teigtag-Zettel im Tages-Core', () => {
  const cfgV2 = configCore.normalizeConfig(configV2())
  const SUN = '2026-11-29'
  const NEXT_TUE = '2026-12-01'
  const satPlan = planCore.planForSheet(cfgV2, SAT)
  const tuePlan = planCore.planForSheet(cfgV2, NEXT_TUE)
  const confirmedSnapshot = [
    {
      preorderId: 1,
      productId: 'test-doppel',
      variant: '',
      qty: 2,
      pickupDate: NEXT_TUE,
    },
    {
      preorderId: 2,
      productId: 'test-stern',
      variant: '',
      qty: 5,
      pickupDate: SUN,
    },
  ]

  it('snapshotFromPreorders nimmt den Abholtag mit, toCorePreorderItems behält ihn', () => {
    const snap = day.snapshotFromPreorders([
      {
        id: 4,
        status: 'offen',
        pickupDate: NEXT_TUE,
        items: [{ productId: 'test-doppel', variant: '', quantity: 3 }],
      },
      {
        id: 5,
        status: 'offen',
        items: [{ productId: 'test-weck', quantity: 1 }],
      },
    ])
    expect(snap).toEqual([
      {
        preorderId: 4,
        productId: 'test-doppel',
        variant: '',
        qty: 3,
        pickupDate: NEXT_TUE,
      },
      { preorderId: 5, productId: 'test-weck', variant: '', qty: 1 },
    ])
    expect(day.toCorePreorderItems(snap, SAT).map((p) => p.pickupDate)).toEqual(
      [NEXT_TUE, SAT]
    )
  })

  it('eine Bestellung zieht zwischen zwei Backtagen desselben Zettels um: „verschoben“, nicht „entfernt“ (Review Z10 Runde 2)', () => {
    const rows = day.reconcileDeltas({
      config: cfgV2,
      date: SAT,
      plan: satPlan,
      snapshot: [confirmedSnapshot[0]],
      current: [{ ...confirmedSnapshot[0], pickupDate: SUN }],
      recorded: [],
      catalog: PRODUCTS_V2,
      orders: { 1: { status: 'offen', pickupDate: SUN } },
    })
    expect(rows).toEqual([
      expect.objectContaining({ qty: 2, kind: 'added', bakeDate: SUN }),
      expect.objectContaining({ qty: -2, kind: 'moved', bakeDate: NEXT_TUE }),
    ])
    // dieselbe Bestellung, nur die Position gestrichen: entfernt
    const removed = day.reconcileDeltas({
      config: cfgV2,
      date: SAT,
      plan: satPlan,
      snapshot: [confirmedSnapshot[0]],
      current: [],
      recorded: [],
      catalog: PRODUCTS_V2,
      orders: { 1: { status: 'offen', pickupDate: NEXT_TUE } },
    })
    expect(removed).toEqual([
      expect.objectContaining({ qty: -2, kind: 'removed' }),
    ])
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: SAT,
        plan: satPlan,
        snapshot: [confirmedSnapshot[0]],
        current: [],
        recorded: [],
        catalog: PRODUCTS_V2,
        orders: { 1: { status: 'storniert', pickupDate: SUN } },
      })[0].kind
    ).toBe('cancelled')
  })

  it('R24: neue Dienstagsbrötchen nach der Samstagsfreigabe → Delta am Samstag, Backtag Di', () => {
    const current = [
      ...confirmedSnapshot,
      {
        preorderId: 3,
        productId: 'test-doppel',
        variant: '',
        qty: 4,
        pickupDate: NEXT_TUE,
      },
    ]
    const rows = day.reconcileDeltas({
      config: cfgV2,
      date: SAT,
      plan: satPlan,
      snapshot: confirmedSnapshot,
      current,
      recorded: [],
      catalog: PRODUCTS_V2,
    })
    expect(rows).toEqual([
      {
        itemId: 'test-doppel',
        variant: '',
        preorderId: 3,
        qty: 4,
        kind: 'added',
        bakeDate: NEXT_TUE,
      },
    ])
    // gespeichert (mit Backtag) → nichts mehr offen
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: SAT,
        plan: satPlan,
        snapshot: confirmedSnapshot,
        current,
        recorded: rows,
      })
    ).toEqual([])
    // gespeicherte Zeilen ohne Backtag gehören zum Zettel-Tag, nicht zum Dienstag
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: SAT,
        plan: satPlan,
        snapshot: confirmedSnapshot,
        current,
        recorded: [
          { itemId: 'test-doppel', variant: '', preorderId: 3, qty: 4 },
        ],
      })
    ).toHaveLength(2)
    // …und kein Delta auf dem Dienstagszettel selbst
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: NEXT_TUE,
        plan: tuePlan,
        snapshot: [],
        current,
        recorded: [],
      })
    ).toEqual([])
  })

  it('R24: Verschieben vom Sonntag auf den Dienstag sind zwei Zeilen desselben Zettels', () => {
    const current = [
      confirmedSnapshot[0],
      { ...confirmedSnapshot[1], pickupDate: NEXT_TUE },
    ]
    const rows = day.reconcileDeltas({
      config: cfgV2,
      date: SAT,
      plan: satPlan,
      snapshot: confirmedSnapshot,
      current,
      recorded: [],
      orders: { 1: 'offen', 2: 'offen' },
    })
    expect(rows.map((r) => [r.preorderId, r.bakeDate, r.qty, r.kind])).toEqual([
      [2, NEXT_TUE, 5, 'added'],
      [2, SUN, -5, 'removed'],
    ])
  })

  it('R25: ein alter, freigegebener Dienstag behält seine Brötchen - kein doppeltes Delta', () => {
    const legacy = planCore.legacyPlan(NEXT_TUE)
    const oldSnapshot = [confirmedSnapshot[0]]
    const current = [
      confirmedSnapshot[0],
      {
        preorderId: 3,
        productId: 'test-doppel',
        variant: '',
        qty: 4,
        pickupDate: NEXT_TUE,
      },
    ]
    // der alte Dienstag (Plan: alle Posten des Tages) sieht nur die neue Bestellung
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: NEXT_TUE,
        plan: legacy,
        snapshot: oldSnapshot,
        current,
        recorded: [],
      })
    ).toEqual([
      {
        itemId: 'test-doppel',
        variant: '',
        preorderId: 3,
        qty: 4,
        kind: 'added',
        bakeDate: NEXT_TUE,
      },
    ])
    // mit dem neuen Plan sähe er die neue Bestellung gar nicht - und der
    // Samstag nimmt sie wegen des Besitzes auch nicht: sie ginge verloren.
    // Deshalb rechnet ein alter Tag mit seinem eingefrorenen legacyPlan.
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: NEXT_TUE,
        plan: tuePlan,
        snapshot: oldSnapshot,
        current,
        recorded: [],
      })
    ).toEqual([])
    // der Samstag (ohne die Paare des alten Dienstags) bucht nichts
    const owned = cfgV2.items.map((i) => planCore.ownedKey(NEXT_TUE, i.id))
    expect(
      day.reconcileDeltas({
        config: cfgV2,
        date: SAT,
        plan: planCore.planForSheet(cfgV2, SAT, owned),
        snapshot: [],
        current,
        recorded: [],
      })
    ).toEqual([])
    expect(day.planOfSnapshot({ plan: satPlan }, SAT)).toBe(satPlan)
    expect(day.planOfSnapshot({ hefeteig: null }, NEXT_TUE)).toEqual(legacy)
    expect(day.planOfSnapshot(null, NEXT_TUE)).toEqual(legacy)
  })

  it('Freigabe v2: Zeilen mit Backtag, Schluessel wie im Entwurf, Reihenfolge nach Backtag', () => {
    const sheet = core.computeDoughDay({
      config: cfgV2,
      date: SAT,
      catalog: PRODUCTS_V2,
      corrections: [
        { itemId: 'test-doppel', bakeDate: SUN, qty: 2, reason: 'Fest' },
      ],
    })
    const rows = day
      .linesForConfirm(sheet.lines)
      .map((r, i) => ({ id: i + 1, date: SAT, ...r }))
    const doppelTue = rows.find(
      (r) => r.itemId === 'test-doppel' && r.bakeDate === NEXT_TUE
    )
    expect(doppelTue).toMatchObject({
      bakeDate: NEXT_TUE,
      variant: '',
      total: 40,
    })
    expect(day.correctionsFromRows(rows)).toEqual([
      {
        bakeDate: SUN,
        itemId: 'test-doppel',
        variant: null,
        qty: 2,
        reason: 'Fest',
      },
    ])
    const frozen = day
      .frozenSections([...rows].reverse(), cfgV2)
      .flatMap((s) => s.lines.map((l) => l.line))
    expect(frozen.map((l) => [l.key, l.total])).toEqual(
      sheet.lines.map((l) => [l.key, l.total])
    )
    expect(
      frozen.find((l) => l.key === `test-doppel|@${NEXT_TUE}`)
    ).toMatchObject({
      bakeDate: NEXT_TUE,
      doughDate: SAT,
      lead: 1,
      variantKind: null,
      variantLabel: null,
      bruch: { group: 'test-doppel', perProduct: 2 },
    })
    expect(frozen.find((l) => l.key === 'test-korn|g500').variantLabel).toBe(
      '500 g'
    )
    // die Teig-Ansichten aus den eingefrorenen Zeilen = Entwurf
    const parts = core.sheetParts(cfgV2, frozen, SAT, {}, [])
    expect(parts.machine).toEqual(sheet.machine)
    expect(parts.rolls).toEqual(sheet.rolls)
    expect(parts.bread).toEqual(sheet.bread)
  })

  it('computedSnapshot v2 friert Plan, Teige, Kästen, Brot, Brötchen und Lücken ein', () => {
    const sheet = core.computeDoughDay({
      config: cfgV2,
      date: SAT,
      catalog: PRODUCTS_V2,
    })
    const snap = day.computedSnapshot(sheet)
    expect(snap).toMatchObject({
      sheetVersion: 2,
      plan: satPlan,
      bakeDates: sheet.bakeDates,
      doughs: sheet.doughs,
      machine: sheet.machine,
      bread: sheet.bread,
      rolls: sheet.rolls,
      openMasterData: sheet.openMasterData,
    })
    expect(Object.keys(snap.subtotalExact)).toContain(
      `test-doppel|@${NEXT_TUE}`
    )
    // v1-Ergebnis: kein Plan (alter Tag)
    expect(
      day.computedSnapshot(core.computeDay({ config: cfg, date: SAT }))
    ).not.toHaveProperty('plan')
  })

  it('machineDeltaExtras: was ein Nachtrag für die Maschine heißt', () => {
    const sheet = core.computeDoughDay({
      config: cfgV2,
      date: SAT,
      catalog: PRODUCTS_V2,
    })
    const extras = { [`test-doppel|@${NEXT_TUE}`]: 3 }
    expect(day.machineDeltaExtras(cfgV2, sheet.lines, extras, SAT)).toEqual([
      {
        id: 'test-weck-teig',
        name: 'Testweck',
        doughIds: ['test-weck-teig'],
        kgBefore: 16,
        kg: 17.2,
        kgDelta: 1.2,
        complete: true,
        litersBefore: { exact: 5.33, rounded: 5.5, reason: null },
        liters: { exact: 5.73, rounded: 5.5, reason: null },
        batchesBefore: 1,
        batches: 1,
      },
    ])
    expect(day.machineDeltaExtras(cfgV2, sheet.lines, {}, SAT)).toEqual([])
    expect(day.machineDeltaExtras(null, sheet.lines, extras, SAT)).toEqual([])
  })

  it('bruchDeltaExtras: „+1 Bruch“ oder „passt in die freien Stücke“', () => {
    const sheet = core.computeDoughDay({
      config: cfgV2,
      date: SAT,
      catalog: PRODUCTS_V2,
    })
    const before = sheet.rolls
      .flatMap((r) => r.groups)
      .find((g) => g.key === `${NEXT_TUE}|test-doppel`)
    expect(before).toBeDefined()
    // So viele Brötchen, wie gerade noch in die freien Stücke passen …
    const fits = before.spareProducts
    if (fits > 0) {
      const [g] = day.bruchDeltaExtras(
        cfgV2,
        sheet.lines,
        { [`test-doppel|@${NEXT_TUE}`]: fits },
        SAT
      )
      expect(g).toMatchObject({
        key: `${NEXT_TUE}|test-doppel`,
        bruecheBefore: before.brueche,
        brueche: before.brueche,
        bruecheDelta: 0,
        spareProducts: 0,
      })
    }
    // … und eins mehr braucht einen Bruch mehr.
    const [more] = day.bruchDeltaExtras(
      cfgV2,
      sheet.lines,
      { [`test-doppel|@${NEXT_TUE}`]: fits + 1 },
      SAT
    )
    expect(more).toMatchObject({
      key: `${NEXT_TUE}|test-doppel`,
      piecesBefore: before.pieces,
      piecesDelta: (fits + 1) * before.perProduct,
      bruecheBefore: before.brueche,
      brueche: before.brueche + 1,
      bruecheDelta: 1,
      complete: true,
    })
    expect(day.bruchDeltaExtras(cfgV2, sheet.lines, {}, SAT)).toEqual([])
    expect(day.bruchDeltaExtras(null, sheet.lines, { x: 1 }, SAT)).toEqual([])
  })

  it('bruchDeltaExtras: Stück je Bruch offen - Brüche bleiben unbekannt, nie 0', () => {
    const cfg = configCore.normalizeConfig(configV2({ bruch_pieces: null }))
    const sheet = core.computeDoughDay({
      config: cfg,
      date: SAT,
      catalog: PRODUCTS_V2,
    })
    const [g] = day.bruchDeltaExtras(
      cfg,
      sheet.lines,
      { [`test-doppel|@${NEXT_TUE}`]: 3 },
      SAT
    )
    expect(g).toMatchObject({ brueche: null, bruecheDelta: null })
    expect(g.piecesDelta).toBe(6)
  })

  it('linesForDeltas: ein Nachtrag für einen anderen Backtag bekommt eine Zeile mit seinem Schlüssel (S3)', () => {
    const key = `test-kaese|@${NEXT_TUE}`
    const delta = {
      key,
      itemId: 'test-kaese',
      variant: null,
      bakeDate: NEXT_TUE,
      qty: 3,
    }
    const out = day.linesForDeltas([], [delta], cfgV2, SAT)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      key,
      bakeDate: NEXT_TUE,
      doughDate: SAT,
      total: 0,
    })
    // Backmenge je Zeile, über den passenden Schlüssel
    expect(day.deltaBakeExtras(out, { [key]: { qty: 3 } }, null, null)).toEqual(
      { [key]: 3 }
    )
    // ohne Zettel-Tag wie bisher (v1-Schlüssel)
    expect(day.linesForDeltas([], [delta], cfgV2)[0].key).toBe('test-kaese|')
  })
})
