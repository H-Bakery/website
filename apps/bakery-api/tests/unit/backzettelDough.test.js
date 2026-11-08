/**
 * Backzettel v2 (Z10): Teige, Liter, Bruch (`backzettel-dough.core.js`,
 * docs/backzettel-v2.md §3, §4.3). Regeln R2–R15 aus §6 - jede Regel der
 * Papierzettel mit erfundenen Zahlen nachgerechnet (`configV2()`).
 *
 * Kalender: Di 24.11.2026, Mi 25.11., Fr 27.11., Sa 28.11., So 29.11.,
 * Di 01.12. Teigtage Di–Sa, 20 Stück je Bruch.
 */
const dough = require('../../src/services/backzettel-dough.core')
const core = require('../../src/services/backzettel.core')
const { configV2, PRODUCTS_V2 } = require('../fixtures/backzettel.synthetic')

const TUE = '2026-11-24'
const WED = '2026-11-25'
const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const NEXT_TUE = '2026-12-01'

/** configV2 mit einer Änderung an den rohen Stammdaten. */
function v2(mutate) {
  const c = configV2()
  if (mutate) mutate(c)
  return c
}
const rawItem = (c, id) => c.items.find((i) => i.id === id)
const rawDough = (c, id) => c.doughs.find((d) => d.id === id)

function sheet(date, extra = {}) {
  const { config, ...rest } = extra
  return core.computeDoughDay({
    config: config || configV2(),
    date,
    catalog: PRODUCTS_V2,
    ...rest,
  })
}
const box = (s, id) => s.machine.find((m) => m.id === id)
const doughOf = (s, id) => s.doughs.find((d) => d.id === id)
const rolls = (s, bakeDate) => s.rolls.find((r) => r.bakeDate === bakeDate)
const group = (s, bakeDate, g) =>
  rolls(s, bakeDate).groups.find((x) => x.group === g)
const pre = (productId, qty, pickupDate, extra = {}) => ({
  productId,
  qty,
  pickupDate,
  ...extra,
})

describe('R2: Liter = kg ÷ kg je Liter, gerundet nach Schritt und Art', () => {
  it('roundTo: auf, nächster (kaufmännisch), ab', () => {
    expect(dough.roundTo(5.7, { step: 0.5, mode: 'up' })).toBe(6)
    expect(dough.roundTo(5.5, { step: 0.5, mode: 'up' })).toBe(5.5)
    expect(dough.roundTo(5.33, { step: 0.5, mode: 'nearest' })).toBe(5.5)
    expect(dough.roundTo(5.2, { step: 0.5, mode: 'nearest' })).toBe(5)
    expect(dough.roundTo(5.25, { step: 0.5, mode: 'nearest' })).toBe(5.5)
    expect(dough.roundTo(5.49, { step: 0.5, mode: 'down' })).toBe(5)
    expect(dough.roundTo(3.33, { step: 0.1, mode: 'up' })).toBe(3.4)
    expect(dough.roundTo(1.32, { step: 1, mode: 'nearest' })).toBe(1)
    expect(dough.roundTo(18, { step: 5, mode: 'nearest' })).toBe(20)
  })

  it('mit Toleranz: 10 × 1,1 wird nicht zu 11,5 bzw. 12', () => {
    const x = 10 * 1.1 // 11.000000000000002
    expect(dough.roundTo(x, { step: 0.5, mode: 'up' })).toBe(11)
    expect(dough.roundTo(x, { step: 1, mode: 'up' })).toBe(11)
    expect(dough.roundTo(0.1 * 3, { step: 0.1, mode: 'up' })).toBe(0.3)
    expect(
      dough.litersFor(
        { kg_per_liter: 2, liter_rounding: { step: 0.5, mode: 'up' } },
        x * 2
      )
    ).toEqual({ exact: 11, rounded: 11, reason: null })
  })

  it('litersFor: genaue Liter auf 0,01, gerundet nach dem Teig', () => {
    expect(
      dough.litersFor(
        { kg_per_liter: 3, liter_rounding: { step: 0.5, mode: 'nearest' } },
        16
      )
    ).toEqual({ exact: 5.33, rounded: 5.5, reason: null })
  })

  it('im Zettel: Testweck 16 kg ÷ 3 = 5,33 L → 5,5 L, Chargen ⌈16 ÷ 40⌉ = 1', () => {
    expect(box(sheet(SAT), 'test-weck-teig')).toMatchObject({
      kg: 16,
      complete: true,
      liters: { exact: 5.33, rounded: 5.5, reason: null },
      batches: 1,
      batch_max_kg: 40,
    })
  })
})

describe('R3: ohne kg je Liter nur kg', () => {
  it('litersFor gibt null mit Grund, die kg bleiben', () => {
    expect(dough.litersFor({ kg_per_liter: null }, 6.2)).toEqual({
      exact: null,
      rounded: null,
      reason: 'kg_per_liter_unknown',
    })
    const s = sheet(SAT)
    expect(box(s, 'test-flit-teig')).toMatchObject({
      kg: 6.2,
      complete: true,
      liters: { exact: null, rounded: null, reason: 'kg_per_liter_unknown' },
      batches: null,
    })
    expect(s.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'doughs[4].kg_per_liter',
          code: 'kg_per_liter_unknown',
        }),
      ])
    )
  })

  it('ohne vollständige kg keine Liter (dough_incomplete)', () => {
    expect(dough.litersFor({ kg_per_liter: 2 }, null).reason).toBe(
      'dough_incomplete'
    )
  })
})

describe('R4: ohne Rundung die genauen Liter', () => {
  it('rounded null, Grund rounding_unknown, offene Stammdaten nennen die Rundung', () => {
    const s = sheet(SAT, {
      config: v2((c) => (rawDough(c, 'test-weck-teig').liter_rounding = null)),
    })
    expect(box(s, 'test-weck-teig').liters).toEqual({
      exact: 5.33,
      rounded: null,
      reason: 'rounding_unknown',
    })
    expect(s.openMasterData.map((o) => o.path)).toContain(
      'doughs[3].liter_rounding'
    )
  })
})

describe('R5: Teig je Größe = Σ Laibe × Teig je Laib', () => {
  it('Samstag: Testkorn 8 × 600 g + 3 × 1000 g = 7,8 kg', () => {
    const s = sheet(SAT)
    expect(doughOf(s, 'test-korn-teig')).toMatchObject({
      kg: 7.8,
      kgKnown: 7.8,
      complete: true,
      missing: [],
      parts: [
        {
          kind: 'sizes',
          itemId: 'test-korn',
          name: 'Testkorn',
          bakeDate: SAT,
          kg: 7.8,
        },
      ],
    })
    const row = s.bread.rows.find((r) => r.itemId === 'test-korn')
    expect(row).toMatchObject({
      kg: 7.8,
      complete: true,
      doughId: 'test-korn-teig',
    })
    expect(row.cells.g500).toMatchObject({ key: 'test-korn|g500', total: 8 })
    expect(row.cells.g1000).toMatchObject({ total: 3 })
    // Größe ohne Zeile: editierbar mit 0, Größe eines anderen Postens: null
    expect(row.cells.kasten).toEqual({
      key: 'test-korn|kasten',
      variant: 'kasten',
      total: 0,
      baseUnset: false,
    })
    expect(
      s.bread.rows.find((r) => r.itemId === 'test-holz').cells.g1000
    ).toBeNull()
    expect(s.bread.sizes).toEqual([
      { id: 'g500', label: '500 g' },
      { id: 'g1000', label: '1 kg' },
      { id: 'kasten', label: 'Kasten' },
    ])
  })

  it('Größe ohne Teiggewicht: unvollständig, kgKnown aus den bekannten Laiben', () => {
    const s = sheet(TUE, {
      corrections: [
        { itemId: 'test-korn', variant: 'kasten', qty: 2, reason: 'Markt' },
      ],
    })
    const korn = doughOf(s, 'test-korn-teig')
    expect(korn).toMatchObject({ kg: null, kgKnown: 4.4, complete: false })
    expect(korn.missing).toEqual([
      expect.objectContaining({
        itemId: 'test-korn',
        code: 'dough_g_unknown',
        field: 'sizes.dough_g',
      }),
    ])
    expect(korn.liters.reason).toBe('dough_incomplete')
    expect(s.openMasterData.map((o) => o.path)).toContain(
      'items[0].sizes[2].dough_g'
    )
    const row = s.bread.rows.find((r) => r.itemId === 'test-korn')
    expect(row).toMatchObject({ kg: null, kgKnown: 4.4, complete: false })
  })

  it('Regel 8: offene Grundmenge ohne Korrektur macht den Teig unvollständig, nie 0', () => {
    // Dienstag: Kasten hat Grundmenge null
    const korn = doughOf(sheet(TUE), 'test-korn-teig')
    expect(korn).toMatchObject({ kg: null, kgKnown: 4.4, complete: false })
    // Menge offen und (für Kasten) auch das Teiggewicht - beides fehlt
    expect(korn.missing.map((m) => m.code)).toEqual([
      'base_unset',
      'dough_g_unknown',
    ])
    expect(korn.missing[0].message).toMatch(/Testkorn – Kasten/)
    // mit festgelegter Grundmenge 0 für Kasten ist der Teig vollständig
    const set = sheet(TUE, {
      config: v2((c) => (rawItem(c, 'test-korn').base[2].kasten = 0)),
    })
    expect(doughOf(set, 'test-korn-teig')).toMatchObject({
      kg: 4.4,
      complete: true,
    })
  })
})

describe('R6: gemeinsamer Teig - eine Literzahl aus der Summe der genauen Liter', () => {
  it('Korn + Holz: Mitglieder mit eigenen kg, ein Kasten mit Literzahl', () => {
    const s = sheet(SAT)
    expect(doughOf(s, 'test-korn-teig').liters.exact).toBe(3.9)
    expect(doughOf(s, 'test-holz-teig')).toMatchObject({
      kg: 3.6,
      combinedWith: 'test-korn-teig',
      liters: { exact: 1.8 },
    })
    expect(box(s, 'test-korn-teig')).toMatchObject({
      name: 'Korn + Holz',
      doughIds: ['test-korn-teig', 'test-holz-teig'],
      kg: 11.4,
      liters: { exact: 5.7, rounded: 6, reason: null },
    })
    expect(box(s, 'test-holz-teig')).toBeUndefined()
  })

  it('Σ der Mitglieder-Liter, nicht Gesamt-kg ÷ kg je Liter des Kopfes', () => {
    const s = sheet(SAT, {
      config: v2((c) => (rawDough(c, 'test-holz-teig').kg_per_liter = 3)),
    })
    // 7,8 ÷ 2 + 3,6 ÷ 3 = 3,9 + 1,2 = 5,1 → 5,5 (11,4 ÷ 2 = 5,7 → 6 wäre falsch)
    expect(box(s, 'test-korn-teig').liters).toEqual({
      exact: 5.1,
      rounded: 5.5,
      reason: null,
    })
  })

  it('ein Mitglied unvollständig → keine Literzahl für die Gruppe', () => {
    const s = sheet(TUE, {
      corrections: [
        { itemId: 'test-korn', variant: 'kasten', qty: 2, reason: 'Markt' },
      ],
    })
    expect(box(s, 'test-korn-teig')).toMatchObject({
      kg: null,
      kgKnown: 5.6,
      complete: false,
      liters: { exact: null, rounded: null, reason: 'dough_incomplete' },
    })
  })

  it('ein Mitglied ohne kg je Liter → Gruppe ohne Liter (kg_per_liter_unknown)', () => {
    const s = sheet(SAT, {
      config: v2((c) => (rawDough(c, 'test-holz-teig').kg_per_liter = null)),
    })
    expect(box(s, 'test-korn-teig')).toMatchObject({
      kg: 11.4,
      complete: true,
      liters: { exact: null, rounded: null, reason: 'kg_per_liter_unknown' },
    })
  })

  it('nur das Mitglied gebacken: Kasten des Kopfes, Rundung des Kopfes', () => {
    const s = sheet(SAT, {
      corrections: [
        { itemId: 'test-korn', variant: 'g500', qty: -8, reason: 'aus' },
        { itemId: 'test-korn', variant: 'g1000', qty: -3, reason: 'aus' },
      ],
    })
    expect(box(s, 'test-korn-teig')).toMatchObject({
      doughIds: ['test-holz-teig'],
      kg: 3.6,
      liters: { exact: 1.8, rounded: 2, reason: null },
    })
  })
})

describe('R7: Zugabe je Liter des eigenen Teigs', () => {
  it('10 g × 1,8 L Testholz = 18 g → 20 g (nicht 10 g × 6 L der Gruppe)', () => {
    expect(box(sheet(SAT), 'test-korn-teig').addons).toEqual([
      {
        id: 'test-sauer',
        name: 'Testsauer',
        doughId: 'test-holz-teig',
        g_per_liter: 10,
        grams: { exact: 18, rounded: 20 },
        reason: null,
      },
    ])
  })

  it('unbekannte Gramm je Liter, Rundung oder Liter → null mit Grund', () => {
    const d = {
      id: 'x',
      addons: [
        { id: 'a', name: 'A', g_per_liter: null, rounding: null },
        { id: 'b', name: 'B', g_per_liter: 7, rounding: null },
      ],
    }
    expect(dough.addonsFor(d, 2.5)).toEqual([
      {
        id: 'a',
        name: 'A',
        doughId: 'x',
        g_per_liter: null,
        grams: null,
        reason: 'g_per_liter_unknown',
      },
      {
        id: 'b',
        name: 'B',
        doughId: 'x',
        g_per_liter: 7,
        grams: { exact: 17.5, rounded: null },
        reason: 'rounding_unknown',
      },
    ])
    expect(dough.addonsFor(d, null)[1]).toMatchObject({
      grams: null,
      reason: 'liters_unknown',
    })
    const s = sheet(SAT, {
      config: v2(
        (c) => (rawDough(c, 'test-holz-teig').addons[0].g_per_liter = null)
      ),
    })
    expect(s.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'doughs[1].addons[0].g_per_liter',
          code: 'addon_unknown',
        }),
      ])
    )
  })
})

describe('R8: fester Anteil aus einem anderen Teig (Kerbricher-Muster)', () => {
  it('Testmisch 4 kg + 5 kg je Ansatz für Testkerb = 9 kg; Körner nur gelistet', () => {
    const s = sheet(SAT)
    const misch = doughOf(s, 'test-misch-teig')
    expect(misch).toMatchObject({
      kg: 9,
      complete: true,
      liters: { exact: 3, rounded: 3, reason: null },
      extras: [{ name: 'Körner', kg: 1, itemId: 'test-kerb' }],
    })
    expect(misch.parts).toEqual([
      {
        kind: 'sizes',
        itemId: 'test-misch',
        name: 'Testmisch',
        bakeDate: SAT,
        kg: 4,
      },
      {
        kind: 'from_dough',
        itemId: 'test-kerb',
        name: 'Testkerb',
        bakeDate: SAT,
        kg: 5,
      },
    ])
    const row = s.bread.rows.find((r) => r.itemId === 'test-kerb')
    expect(row.kg).toBe(5)
    expect(row.note).toBe('Aus Teig „Testmisch“: 5 kg je Ansatz + Körner 1 kg')
  })

  it('einmal je Ansatz, egal wie viele Laibe; ohne Laibe kein Anteil', () => {
    const fewer = sheet(SAT, {
      corrections: [
        { itemId: 'test-kerb', variant: 'g500', qty: -7, reason: 'x' },
      ],
    })
    expect(doughOf(fewer, 'test-misch-teig').kg).toBe(9)
    const none = sheet(SAT, {
      corrections: [
        { itemId: 'test-kerb', variant: 'g500', qty: -10, reason: 'x' },
      ],
    })
    expect(doughOf(none, 'test-misch-teig')).toMatchObject({
      kg: 4,
      extras: [],
    })
  })
})

describe('R9: Anteil je Teig wächst mit dem Posten', () => {
  const perDough = () =>
    v2((c) => (rawItem(c, 'test-kerb').from_dough.mode = 'per_dough'))

  it('10 × 600 g = 6 kg → 6 × 5/6 = 5 kg Testmisch + 1 kg Körner', () => {
    const misch = doughOf(sheet(SAT, { config: perDough() }), 'test-misch-teig')
    expect(misch).toMatchObject({
      kg: 9,
      extras: [{ name: 'Körner', kg: 1, itemId: 'test-kerb' }],
    })
  })

  it('12 Laibe = 7,2 kg → 6 kg Testmisch + 1,2 kg Körner', () => {
    const s = sheet(SAT, {
      config: perDough(),
      corrections: [
        { itemId: 'test-kerb', variant: 'g500', qty: 2, reason: 'x' },
      ],
    })
    const misch = doughOf(s, 'test-misch-teig')
    expect(misch).toMatchObject({
      kg: 10,
      liters: { exact: 3.33, rounded: 3.4 },
      extras: [{ name: 'Körner', kg: 1.2, itemId: 'test-kerb' }],
    })
  })

  it('Zugabe ohne kg: Anteil unbekannt, der Teig unvollständig', () => {
    const c = perDough()
    rawItem(c, 'test-kerb').from_dough.extras[0].kg = null
    const misch = doughOf(sheet(SAT, { config: c }), 'test-misch-teig')
    expect(misch).toMatchObject({ kg: null, kgKnown: 4, complete: false })
    expect(misch.missing.map((m) => m.code)).toEqual(['extra_kg_unknown'])
  })
})

describe('R10: Art des Anteils offen', () => {
  it('Zielteig unvollständig, keine Liter, Eintrag in den offenen Stammdaten', () => {
    const s = sheet(SAT, {
      config: v2((c) => (rawItem(c, 'test-kerb').from_dough.mode = null)),
    })
    const misch = doughOf(s, 'test-misch-teig')
    expect(misch).toMatchObject({
      kg: null,
      kgKnown: 4,
      complete: false,
      liters: { exact: null, rounded: null, reason: 'dough_incomplete' },
    })
    expect(misch.missing).toEqual([
      expect.objectContaining({
        itemId: 'test-kerb',
        code: 'from_dough_mode_unknown',
        field: 'from_dough.mode',
      }),
    ])
    expect(box(s, 'test-misch-teig')).toMatchObject({
      kg: null,
      complete: false,
    })
    expect(s.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items[3].from_dough.mode',
          code: 'from_dough_mode_unknown',
        }),
      ])
    )
    expect(s.bread.rows.find((r) => r.itemId === 'test-kerb').note).toBe(
      'Anteil am Teig „Testmisch“ noch offen'
    )
  })
})

describe('R11: ein Bruch = Stück je Bruch; zwei Teigstücke je Brötchen', () => {
  it('60 Doppel = 120 Teigstücke = 6 Brüche à 1200 g', () => {
    expect(group(sheet(SAT), SUN, 'test-doppel')).toMatchObject({
      key: `${SUN}|test-doppel`,
      doughId: 'test-weck-teig',
      g: 1200,
      piecesPerBruch: 20,
      pieces: 120,
      brueche: 6,
      spare: 0,
      kg: 7.2,
      complete: true,
    })
  })

  it('aufgerundet; die freien Stücke stehen da, zählen aber in keiner Zeile', () => {
    const s = sheet(SAT, { preorderItems: [pre('test-doppel', 3, SUN)] })
    expect(group(s, SUN, 'test-doppel')).toMatchObject({
      pieces: 126,
      brueche: 7,
      spare: 14,
      kg: 8.4,
    })
    const line = s.lines.find((l) => l.key === `test-doppel|@${SUN}`)
    expect(line.total).toBe(63)
  })

  it('Stück je Bruch offen: keine Brüche, keine kg, Teig unvollständig', () => {
    const s = sheet(SAT, { config: v2((c) => (c.bruch_pieces = null)) })
    expect(group(s, SUN, 'test-doppel')).toMatchObject({
      brueche: null,
      spare: null,
      kg: null,
      complete: false,
    })
    expect(doughOf(s, 'test-weck-teig')).toMatchObject({
      kg: null,
      complete: false,
    })
    expect(s.openMasterData.map((o) => o.path)).toContain('bruch_pieces')
  })
})

describe('R12: ein Bruch für mehrere Produkte einer Gruppe', () => {
  it('Stern 12 + Käse 13 = 25 Stück → 2 Brüche, 15 frei, Aufteilung', () => {
    const s = sheet(SAT, { preorderItems: [pre('test-kaese', 5, SUN)] })
    const g = group(s, SUN, 'test-gemischt')
    expect(g).toMatchObject({
      name: 'Teststern + Testkäse',
      pieces: 25,
      brueche: 2,
      spare: 15,
      g: 2000,
      kg: 4,
    })
    expect(g.split).toEqual([
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
        total: 13,
        perProduct: 1,
        doughPieces: 13,
      },
    ])
  })
})

describe('R13: Bruchgewicht je Backtag', () => {
  it('ein Zettel, zwei Backtage, zwei Gewichte: So 1000 g, Di 1200 g', () => {
    const s = sheet(SAT)
    expect(group(s, SUN, 'test-flitweck')).toMatchObject({
      g: 1000,
      brueche: 2,
      kg: 2,
    })
    expect(group(s, NEXT_TUE, 'test-flitweck')).toMatchObject({
      g: 1200,
      brueche: 1,
      kg: 1.2,
    })
    // Flit: 2 + 1,2 + 3 (Einzelstücke) = 6,2 kg
    expect(doughOf(s, 'test-flit-teig').kg).toBe(6.2)
  })
})

describe('R14: Bruchgewicht offen', () => {
  it('Brüche stehen da, kg null, Teig unvollständig, Lücke mit Pfad', () => {
    const s = sheet(TUE, {
      corrections: [
        { bakeDate: WED, itemId: 'test-flitweck', qty: 10, reason: 'Markt' },
      ],
    })
    const g = group(s, WED, 'test-flitweck')
    expect(g).toMatchObject({
      g: null,
      pieces: 10,
      brueche: 1,
      spare: 10,
      kg: null,
      complete: false,
    })
    expect(g.missing[0]).toMatchObject({ code: 'bruch_g_unknown' })
    expect(g.missing[0].message).toMatch(/am Mittwoch/)
    expect(doughOf(s, 'test-flit-teig')).toMatchObject({
      kg: null,
      kgKnown: 0,
      complete: false,
    })
    expect(s.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items[8].bruch.g.default',
          code: 'bruch_g_unknown',
        }),
      ])
    )
  })
})

describe('R15: Einzelstücke ohne Teilmaschine', () => {
  it('Stück × Teigstücke × Gramm: 10 × 1 × 300 g = 3 kg', () => {
    const r = rolls(sheet(SAT), SUN)
    expect(r.label).toBe('für Sonntag')
    expect(r.singles).toEqual([
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
    ])
    const two = sheet(SAT, {
      config: v2((c) => (rawItem(c, 'test-flit-klein').dough.pieces = 2)),
    })
    expect(rolls(two, SUN).singles[0].kg).toBe(6)
  })

  it('Teigstücke je Produkt offen → kg unbekannt, Teig unvollständig', () => {
    const s = sheet(FRI)
    const party = rolls(s, SAT).singles.find((x) => x.itemId === 'test-party')
    expect(party).toMatchObject({ total: 5, pieces: null, kg: null })
    const flit = doughOf(s, 'test-flit-teig')
    expect(flit).toMatchObject({ kg: null, complete: false })
    expect(flit.missing.map((m) => m.code)).toEqual(['pieces_unknown'])
    expect(s.openMasterData.map((o) => o.path)).toContain(
      'items[10].dough.pieces'
    )
  })
})

describe('Teig offen, Hilfsfunktionen', () => {
  it('Posten ohne Teig-ID: kg unter „Teig offen“, Lücke dough_unknown', () => {
    const s = sheet(SAT, {
      config: v2((c) => (rawItem(c, 'test-flit-klein').dough.id = null)),
    })
    const open = doughOf(s, null)
    expect(open).toMatchObject({
      name: 'Teig offen',
      kg: 3,
      liters: { reason: 'kg_per_liter_unknown' },
    })
    expect(s.machine[s.machine.length - 1]).toMatchObject({
      id: null,
      name: 'Teig offen',
      kg: 3,
    })
    expect(s.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items[9].dough.id',
          code: 'dough_unknown',
        }),
      ])
    )
  })

  it('batchesFor nur mit beiden Zahlen, mit Toleranz', () => {
    expect(dough.batchesFor(40, 40)).toBe(1)
    expect(dough.batchesFor(40.5, 40)).toBe(2)
    expect(dough.batchesFor(null, 40)).toBeNull()
    expect(dough.batchesFor(12, null)).toBeNull()
  })

  it('Maschinen-Kästen in der Reihenfolge der Teige, mit Abschnitt', () => {
    const s = sheet(SAT)
    expect(s.machine.map((m) => [m.id, m.section])).toEqual([
      ['test-korn-teig', 'brot'],
      ['test-misch-teig', 'brot'],
      ['test-weck-teig', 'broetchen'],
      ['test-flit-teig', 'broetchen'],
      ['test-hefe', 'hefeteig'],
    ])
  })

  it('offene Stammdaten nur für Teige und Posten dieses Zettels, je Pfad einmal', () => {
    const paths = sheet(SAT).openMasterData.map((o) => o.path)
    expect(paths).toEqual([...new Set(paths)])
    expect(paths).toEqual(
      expect.arrayContaining([
        'doughs[0].batch_max_kg',
        'doughs[4].kg_per_liter',
        'doughs[4].liter_rounding',
        'items[12].filling_g',
      ])
    )
    // Kasten wird am Samstag nicht gebacken, Testparty nicht auf diesem Zettel
    expect(paths).not.toContain('items[0].sizes[2].dough_g')
    expect(paths).not.toContain('items[10].dough.pieces')
    // Mitglied einer Gruppe: Rundung und Chargen gehören dem Kopf
    expect(paths).not.toContain('doughs[1].liter_rounding')
  })
})
