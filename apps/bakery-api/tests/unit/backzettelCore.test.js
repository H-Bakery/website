/**
 * Backzettel-Tagesrechnung (Z2, roadmap §5.4).
 *
 * Portiert die Faelle aus den frueheren (B12 geloeschten)
 * apps/bakery-management/src/features/production/ (productionCalculator.spec.ts
 * / HefezopfCalculator, FillingPreparation) und
 * feature-daily-prep/utils/trayInfo.spec.ts. Alle Zahlen sind erfunden.
 *
 * Kalender: Di 24.11.2026, Mi 25.11., Sa 28.11., So 29.11., Mo 30.11. (Ruhetag).
 */
const core = require('../../src/services/backzettel.core')
const recipesCore = require('../../src/services/backzettel-recipes.core')
const {
  PRODUCTS,
  config,
  RECIPE_MD,
} = require('../fixtures/backzettel.synthetic')

const TUE = '2026-11-24'
const WED = '2026-11-25'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const MON = '2026-11-30'

const RECIPES = {
  nuss: recipesCore.parseFillingRecipe(RECIPE_MD, { section: 'Nussfüllung' }),
  mohn: recipesCore.parseFillingRecipe(RECIPE_MD, { section: 'Mohnfüllung' }),
}

function day(date, extra = {}) {
  return core.computeDay({
    config: config(),
    date,
    recipes: RECIPES,
    catalog: PRODUCTS,
    ...extra,
  })
}

function line(result, itemId, variant = null) {
  return result.lines.find((l) => l.itemId === itemId && l.variant === variant)
}

function pre(productId, qty, extra = {}) {
  return { productId, qty, pickupDate: SAT, ...extra }
}

describe('Datum und Wochentag', () => {
  it('rechnet ISO-Wochentage', () => {
    expect(core.isoWeekday(TUE)).toBe(2)
    expect(core.isoWeekday(SAT)).toBe(6)
    expect(core.isoWeekday(SUN)).toBe(7)
    expect(core.isoWeekday(MON)).toBe(1)
  })

  it('lehnt ungueltige Daten mit message und error ab', () => {
    for (const date of ['2026-02-30', '28.11.2026', '', undefined]) {
      const r = core.computeDay({ config: config(), date })
      expect(r.error).toBe('invalid_date')
      expect(r.message).toMatch(/Ungültiges Datum/)
    }
  })

  it('liefert am Ruhetag keine Zeilen', () => {
    const r = day(MON)
    expect(r.open).toBe(false)
    expect(r.lines).toEqual([])
    expect(r.prep).toEqual([])
    expect(r.weekdayName).toBe('Montag')
  })

  it('warnt, wenn fuer einen Ruhetag vorbestellt wurde', () => {
    const r = day(MON, {
      preorderItems: [pre('test-weck', 5, { pickupDate: MON })],
    })
    expect(r.lines).toEqual([])
    expect(r.warnings.map((w) => w.code)).toContain('preorders_on_closed_day')
  })
})

describe('Wochentag vs. Samstag', () => {
  it('Dienstag: Grundmengen, Abschnitte in Reihenfolge, Blech-Angaben, Laibe je Liter', () => {
    const r = day(TUE)
    expect(r.open).toBe(true)
    expect(r.sections.map((s) => s.id)).toEqual([
      'brot',
      'broetchen',
      'kaffeestueckchen',
    ])
    expect(r.lines.map((l) => [l.itemId, l.total])).toEqual([
      ['kornbrot', 4],
      ['weck', 40],
      ['plunder', 10],
      ['schnecke', 6],
    ])
    // W4-verify r3: Bleche nach der Menge (10 Stück à 10 = 1 Blech)
    expect(line(r, 'plunder').tray).toBe('1 Blech à 10 (Blech 7)')
    expect(line(r, 'schnecke').tray).toBe('Blech 3')
    expect(line(r, 'weck').tray).toBeNull()
    expect(line(r, 'kornbrot').loavesEstimate).toBe(8)
    expect(line(r, 'weck').loavesEstimate).toBeUndefined()
    expect(r.hefeteig).toEqual({ doughs: [], pieces: 0, dough_g: 0 })
    expect(r.fillings).toEqual([])
  })

  it('Mittwoch: weniger Gebaeck, Vollkorn nur Mittwoch, Liter mit Bruchteilen', () => {
    const r = day(WED)
    expect(line(r, 'plunder').total).toBe(8)
    expect(line(r, 'vollkorn').total).toBe(2)
    expect(line(r, 'kornbrot').total).toBe(4.5)
  })

  it('Samstag: Gebaeck mit Grundmenge 0 faellt weg, Hefeteig-Varianten erscheinen', () => {
    const r = day(SAT)
    expect(line(r, 'plunder')).toBeUndefined()
    expect(line(r, 'schnecke')).toBeUndefined()
    expect(r.sections.map((s) => s.id)).toEqual([
      'brot',
      'broetchen',
      'hefeteig',
    ])
    expect(
      r.sections[2].lines.map((l) => [l.itemId, l.variant, l.total])
    ).toEqual([
      ['zopf-gefuellt', 'nuss', 4],
      ['zopf-gefuellt', 'mohn', 2],
      ['kranz-gefuellt', 'nuss', 3],
      ['kranz-gefuellt', 'mohn', 1],
      ['kranz', null, 2],
    ])
  })

  it('includeEmpty liefert auch Zeilen ohne Menge', () => {
    const r = day(SAT, { includeEmpty: true })
    expect(line(r, 'plunder')).toMatchObject({ base: 0, total: 0 })
    expect(line(r, 'zopf-gefuellt', null)).toMatchObject({ total: 0 })
  })
})

describe('Saisonfaktor', () => {
  it('ist standardmaessig 1,0', () => {
    const r = day(TUE)
    expect(r.seasonFactor).toBe(1)
    expect(line(r, 'weck').seasonal).toBe(0)
  })

  it('rundet je Stueck auf, ohne Fliesskomma-Fehler (10 × 1,1 = 11, nicht 12)', () => {
    const r = day(TUE, { seasonFactor: 1.1 })
    expect(line(r, 'plunder')).toMatchObject({
      base: 10,
      seasonal: 1,
      total: 11,
    })
    expect(line(r, 'weck')).toMatchObject({ base: 40, seasonal: 4, total: 44 })
    expect(line(r, 'schnecke')).toMatchObject({
      base: 6,
      seasonal: 1,
      total: 7,
    }) // 6,6 -> 7
  })

  it('rundet Liter auf 0,01 statt auf ganze Liter', () => {
    const r = day(SAT, { seasonFactor: 1.1 })
    expect(line(r, 'kornbrot')).toMatchObject({
      base: 2.25,
      seasonal: 0.23,
      total: 2.48,
    })
    expect(line(day(TUE), 'kornbrot').total).toBe(4)
  })

  it('kann auch senken', () => {
    expect(line(day(TUE, { seasonFactor: 0.8 }), 'weck')).toMatchObject({
      seasonal: -8,
      total: 32,
    })
  })

  it('faellt bei ungueltigem Faktor auf 1,0 zurueck und warnt', () => {
    const r = day(TUE, { seasonFactor: -2 })
    expect(r.seasonFactor).toBe(1)
    expect(r.warnings.map((w) => w.code)).toContain('invalid_season_factor')
  })
})

describe('Vorbestellungen', () => {
  it('zaehlt nur den Abholtag; andere Tage und Stornos fallen weg', () => {
    const r = day(SAT, {
      preorderItems: [
        pre('test-weck', 5),
        pre('test-weck', 7, { pickupDate: SUN }),
        pre('test-weck', 9, { status: 'cancelled' }),
        pre('test-weck', 4, { status: 'storniert' }), // B7-Status der echten API
        { productId: 'test-weck', quantity: 2, date: SAT }, // alternative Feldnamen
      ],
    })
    expect(line(r, 'weck')).toMatchObject({ base: 60, preorders: 7, total: 67 })
  })

  it('summiert Viertel erst und rundet dann je Zeile auf', () => {
    const r = day(SAT, {
      preorderItems: [
        pre('test-kranz-viertel', 1),
        pre('test-kranz-viertel', 2),
        pre('test-kranz', 1),
      ],
    })
    // 3 × 0,25 + 1 = 1,75 -> 2 (nicht 3 einzelne Viertel -> 3)
    expect(line(r, 'kranz')).toMatchObject({
      base: 2,
      preorders: 2,
      preordersExact: 1.75,
      total: 4,
    })
  })

  // W4-Verifikation Runde 4: Viertel aus Vorbestellung, CAP und Saison
  // werden zusammen aufgerundet, nicht je Spalte.
  it('summiert Viertel ueber Vorbestellungen und CAP, bevor aufgerundet wird', () => {
    const r = day(SAT, {
      preorderItems: [pre('test-kranz-viertel', 3)],
      capTemplate: {
        weekday: 6,
        items: [{ productSlug: 'test-kranz-viertel', quantity: 1 }],
      },
    })
    // 2 + 0,75 + 0,25 = 3 (je Spalte aufgerundet waeren es 2 + 1 + 1 = 4)
    expect(line(r, 'kranz')).toMatchObject({
      base: 2,
      preorders: 0.75,
      preordersExact: 0.75,
      cap: 0.25,
      subtotalExact: 3,
      quartersPooled: true,
      total: 3,
    })
  })

  it('rechnet den Saisonzuschlag mit den Vierteln zusammen', () => {
    const r = day(SAT, {
      seasonFactor: 1.1,
      preorderItems: [pre('test-kranz-viertel', 3)],
    })
    // 2 × 1,1 + 0,75 = 2,95 -> 3 (nicht 3 + 1 = 4); die Spalten addieren
    // sich zur Summe vor dem Aufrunden
    const l = line(r, 'kranz')
    expect(l).toMatchObject({ seasonal: 0.2, preorders: 0.75, total: 3 })
    expect(l.base + l.seasonal + l.preorders + l.cap).toBeCloseTo(2.95)
  })

  it('laesst ganze Spalten unveraendert, wenn nur eine Quelle Bruchteile hat', () => {
    const r = day(SAT, {
      seasonFactor: 1.1,
      preorderItems: [pre('test-kranz', 1)],
    })
    // 2,2 -> 3 (Saison +1), dazu 1 ganzer Kranz
    expect(line(r, 'kranz')).toMatchObject({
      seasonal: 1,
      preorders: 1,
      total: 4,
    })
    expect(line(r, 'kranz').quartersPooled).toBeUndefined()
  })

  it('genau vier Viertel sind ein Ganzes', () => {
    const r = day(SAT, { preorderItems: [pre('test-kranz-viertel', 4)] })
    expect(line(r, 'kranz').preorders).toBe(1)
  })

  it('ordnet Varianten zu und rundet Viertel je Variante', () => {
    const r = day(SAT, {
      preorderItems: [
        pre('test-kranz-gefuellt', 1, { variant: 'nuss' }),
        pre('test-kranz-gefuellt-viertel', 2, { variant: 'nuss' }),
        pre('test-kranz-gefuellt-viertel', 1, { variant: 'mohn' }),
      ],
    })
    expect(line(r, 'kranz-gefuellt', 'nuss')).toMatchObject({
      preorders: 2,
      preordersExact: 1.5,
      total: 5,
    })
    expect(line(r, 'kranz-gefuellt', 'mohn')).toMatchObject({
      preorders: 1,
      total: 2,
    })
  })

  it('zaehlt unbekannte Varianten unter "ohne Angabe" und warnt', () => {
    const r = day(SAT, {
      preorderItems: [pre('test-zopf-gefuellt', 2, { variant: 'marzipan' })],
    })
    expect(line(r, 'zopf-gefuellt', null)).toMatchObject({
      preorders: 2,
      total: 2,
    })
    expect(r.warnings.find((w) => w.code === 'unknown_variant')).toMatchObject({
      itemId: 'zopf-gefuellt',
      variant: 'marzipan',
    })
  })

  it('ignoriert eine Variante bei einem Posten ohne Varianten, mit Warnung', () => {
    const r = day(SAT, {
      preorderItems: [pre('test-weck', 3, { variant: 'mohn' })],
    })
    expect(line(r, 'weck').preorders).toBe(3)
    expect(r.warnings.map((w) => w.code)).toContain('variant_ignored')
  })

  it('loest numerische Produkt-IDs ueber den Katalog auf', () => {
    const r = day(SAT, { preorderItems: [pre(907, 4)] })
    expect(line(r, 'weck').preorders).toBe(4)
  })

  it('meldet Produkte ohne Backzettel-Posten, statt sie zu verschlucken', () => {
    const r = day(SAT, {
      preorderItems: [pre('unbekannt', 2), pre('unbekannt', 1)],
    })
    expect(r.warnings.find((w) => w.code === 'unmapped_product')).toMatchObject(
      { productId: 'unbekannt', qty: 3 }
    )
  })

  it('nennt nicht zugeordnete Produkte mit dem Namen aus dem Katalog (W4-verify r4)', () => {
    const r = day(SAT, {
      catalog: [
        ...PRODUCTS,
        {
          id: 'muster-kirsch-torte',
          numeric_id: 950,
          name: 'Muster-Kirsch-Torte',
        },
      ],
      preorderItems: [pre('muster-kirsch-torte', 5), pre(950, 3)],
      capTemplate: {
        weekday: 6,
        items: [{ productSlug: 'muster-kirsch-torte', quantity: 2 }],
      },
    })
    const w = r.warnings.find((x) => x.code === 'unmapped_product')
    expect(w.message).toBe(
      'Vorbestelltes Produkt „Muster-Kirsch-Torte“ (8 Stück) gehört zu keinem Backzettel-Posten.'
    )
    expect(
      r.warnings.find((x) => x.code === 'unmapped_cap_product').message
    ).toContain('„Muster-Kirsch-Torte“ (2 Stück)')
    // ohne Katalogeintrag bleibt die Kennung stehen
    const r2 = day(SAT, { preorderItems: [pre('unbekannt', 1)] })
    expect(
      r2.warnings.find((x) => x.code === 'unmapped_product').message
    ).toContain('„unbekannt“ (1 Stück)')
  })

  it('ueberspringt Mengen <= 0 und Unsinn', () => {
    const r = day(SAT, {
      preorderItems: [
        pre('test-weck', 0),
        pre('test-weck', -3),
        pre('test-weck', 'abc'),
        null,
      ],
    })
    expect(line(r, 'weck').preorders).toBe(0)
  })

  it('merkt sich die Vorbestellungs-IDs je Zeile', () => {
    const items = core.flattenPreorders([
      {
        id: 'P1',
        date: SAT,
        status: 'open',
        items: [{ productId: 'test-weck', qty: 2 }],
      },
      {
        id: 'P2',
        date: SAT,
        status: 'open',
        items: [
          { productId: 'test-weck', qty: 1 },
          { productId: 'test-zopf-gefuellt', qty: 1, variant: 'mohn' },
        ],
      },
      {
        id: 'P3',
        date: SAT,
        status: 'cancelled',
        items: [{ productId: 'test-weck', qty: 9 }],
      },
    ])
    expect(items).toHaveLength(4)
    const r = day(SAT, { preorderItems: items })
    expect(line(r, 'weck')).toMatchObject({
      preorders: 3,
      preorderIds: ['P1', 'P2'],
    })
    expect(line(r, 'zopf-gefuellt', 'mohn')).toMatchObject({
      preorders: 1,
      total: 3,
    })
  })
})

describe('CAP-Vorlage', () => {
  const templates = [
    {
      weekday: 2,
      active: true,
      items: [{ productSlug: 'test-weck', productId: 907, quantity: 12 }],
    },
    {
      weekday: 2,
      active: false,
      items: [{ productSlug: 'test-weck', quantity: 99 }],
    },
    {
      weekday: 3,
      active: true,
      items: [{ productSlug: 'test-weck', quantity: 50 }],
    },
  ]

  it('nimmt nur die aktive Vorlage des Wochentags', () => {
    expect(line(day(TUE, { capTemplate: templates }), 'weck')).toMatchObject({
      cap: 12,
      total: 52,
    })
    expect(line(day(WED, { capTemplate: templates }), 'weck')).toMatchObject({
      cap: 50,
      total: 80,
    })
    expect(line(day(SAT, { capTemplate: templates }), 'weck').cap).toBe(0)
  })

  it('nimmt auch eine einzelne Vorlage und rechnet Faktoren', () => {
    const t = {
      weekday: 2,
      items: [{ productSlug: 'test-kornbrot', quantity: 3 }],
    }
    expect(line(day(TUE, { capTemplate: t }), 'kornbrot')).toMatchObject({
      cap: 1.5,
      total: 5.5,
    })
  })

  it('meldet CAP-Produkte ohne Posten', () => {
    const r = day(TUE, {
      capTemplate: {
        weekday: 2,
        items: [{ productSlug: 'fremd', quantity: 2 }],
      },
    })
    expect(r.warnings.map((w) => w.code)).toContain('unmapped_cap_product')
  })
})

describe('Korrekturen', () => {
  it('addiert Korrekturen je Zeile und haengt Gruende an', () => {
    const r = day(TUE, {
      corrections: [
        { itemId: 'weck', qty: 5, reason: 'Markt' },
        { itemId: 'weck', qty: -2, reason: 'Regen' },
      ],
    })
    expect(line(r, 'weck')).toMatchObject({
      correction: 3,
      correctionReason: 'Markt; Regen',
      total: 43,
    })
  })

  it('klemmt eine negative Summe auf 0, zeigt die Zeile aber', () => {
    const r = day(TUE, { corrections: [{ itemId: 'weck', qty: -100 }] })
    expect(line(r, 'weck')).toMatchObject({
      base: 40,
      correction: -100,
      total: 0,
      correctionClamped: true,
    })
    // nie still (W4-Verifikation Runde 2): Warnung mit Zahlen
    const w = r.warnings.find((x) => x.code === 'correction_exceeds_line')
    expect(w).toBeDefined()
    expect(w.items).toEqual(['Weck'])
    expect(w.message).toMatch(/40 geplant, Korrektur −100/)
    // eine passende Korrektur ist keine Warnung
    const ok = day(TUE, { corrections: [{ itemId: 'weck', qty: -40 }] })
    expect(line(ok, 'weck').correctionClamped).toBeUndefined()
    expect(ok.warnings.map((x) => x.code)).not.toContain(
      'correction_exceeds_line'
    )
  })

  it('kann einen Posten ohne Grundmenge an diesem Tag hinzufuegen', () => {
    const r = day(TUE, {
      corrections: [{ itemId: 'zopf-gefuellt', variant: 'nuss', qty: 2 }],
    })
    expect(line(r, 'zopf-gefuellt', 'nuss')).toMatchObject({
      base: 0,
      correction: 2,
      total: 2,
    })
    expect(r.hefeteig.pieces).toBe(2)
  })

  it('ignoriert Korrekturen fuer unbekannte Posten oder Varianten, mit Warnung', () => {
    const r = day(TUE, {
      corrections: [
        { itemId: 'gibt-es-nicht', qty: 1 },
        { itemId: 'zopf-gefuellt', variant: 'marzipan', qty: 1 },
      ],
    })
    expect(
      r.warnings.filter((w) => w.code === 'unknown_correction')
    ).toHaveLength(2)
    expect(line(r, 'zopf-gefuellt', 'marzipan')).toBeUndefined()
  })
})

describe('Hefeteig (portiert aus HefezopfCalculator)', () => {
  it('rechnet Teigstuecke, Teiggewicht, Chargen und Abwiegeliste am Samstag', () => {
    const h = day(SAT).hefeteig
    // Zopf 6 × 1 × 500 = 3000; Kranz gefuellt 4 × 2 × 600 = 4800; Kranz 2 × 3 × 600 = 3600
    expect(h.dough_g).toBe(11400)
    expect(h.pieces).toBe(20)
    expect(h.doughs).toHaveLength(1)
    const d = h.doughs[0]
    expect(d).toMatchObject({
      id: 'hefeteig-test',
      name: 'Hefeteig (Test)',
      batch_max_kg: 10,
      batches: 2,
    })
    expect(d.weighing.map((w) => [w.piece_g, w.pieces])).toEqual([
      [600, 14],
      [500, 6],
    ])
    expect(d.weighing[0].items).toEqual([
      {
        itemId: 'kranz-gefuellt',
        name: 'Kranz gefüllt',
        products: 4,
        piecesPerProduct: 2,
        pieces: 8,
      },
      {
        itemId: 'kranz',
        name: 'Kranz',
        products: 2,
        piecesPerProduct: 3,
        pieces: 6,
      },
    ])
  })

  it('rechnet Gewicht als Stueckgewicht × Anzahl × Menge', () => {
    const cfg = config()
    for (const item of cfg.items)
      if (item.id !== 'kranz-gefuellt') delete item.base[6]
    cfg.items.find((i) => i.id === 'kranz-gefuellt').base = { 6: { nuss: 2 } }
    const h = core.computeDay({ config: cfg, date: SAT }).hefeteig
    expect(h.dough_g).toBe(2 * 2 * 600)
    expect(h.doughs[0].weighing[0]).toMatchObject({ piece_g: 600, pieces: 4 })
  })

  it('der gefuellte Kranz ist einstellbar (Q-B3; Testwert 2 × 600 g)', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'kranz-gefuellt').dough = {
      id: 'hefeteig-test',
      piece_g: 1200,
      pieces: 1,
    }
    const d = core.computeDay({ config: cfg, date: SAT }).hefeteig.doughs[0]
    expect(d.dough_g).toBe(11400) // gleiches Gewicht ...
    expect(d.pieces).toBe(16) // ... aber 4 statt 8 Teigstuecke
    expect(d.weighing.map((w) => w.piece_g)).toEqual([1200, 600, 500])
  })

  it('leerer Plan ohne Hefeteig-Zeilen', () => {
    const cfg = config()
    for (const item of cfg.items) delete item.base[6]
    const r = core.computeDay({ config: cfg, date: SAT })
    expect(r.hefeteig).toEqual({ doughs: [], pieces: 0, dough_g: 0 })
    expect(r.fillings).toEqual([])
  })

  it('rundet Chargen auf ganze Chargen auf, genau eine volle Charge bleibt eine', () => {
    const cfg = config()
    for (const item of cfg.items) delete item.base[6]
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base = { 6: { nuss: 20 } } // 20 × 500 = 10 kg
    expect(
      core.computeDay({ config: cfg, date: SAT }).hefeteig.doughs[0].batches
    ).toBe(1)
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base = { 6: { nuss: 21 } } // 10,5 kg
    expect(
      core.computeDay({ config: cfg, date: SAT }).hefeteig.doughs[0].batches
    ).toBe(2)
  })

  it('ohne Chargengroesse keine Chargenzahl', () => {
    const cfg = config()
    cfg.doughs[0].batch_max_kg = null
    expect(
      core.computeDay({ config: cfg, date: SAT }).hefeteig.doughs[0].batches
    ).toBeNull()
  })

  it('zaehlt Vorbestellungen und Korrekturen in die Teigmenge', () => {
    const r = day(SAT, {
      preorderItems: [pre('test-kranz-viertel', 4)],
      corrections: [{ itemId: 'zopf-gefuellt', variant: 'nuss', qty: -4 }],
    })
    // Kranz 3 × 3 × 600 = 5400; Zopf nur noch 2 × 500 = 1000; Kranz gefuellt 4800
    expect(r.hefeteig.dough_g).toBe(5400 + 1000 + 4800)
  })
})

describe('Fuellungen (portiert aus HefezopfCalculator / FillingPreparation)', () => {
  it('summiert Gramm je Fuellung ueber Posten und skaliert das Rezept', () => {
    const f = day(SAT).fillings
    expect(f.map((x) => [x.id, x.grams])).toEqual([
      ['nuss', 4 * 400 + 3 * 1000],
      ['mohn', 2 * 400 + 1 * 800],
    ])
    expect(f[0].items).toEqual([
      {
        itemId: 'zopf-gefuellt',
        name: 'Zopf gefüllt',
        pieces: 4,
        filling_g: 400,
        grams: 1600,
      },
      {
        itemId: 'kranz-gefuellt',
        name: 'Kranz gefüllt',
        pieces: 3,
        filling_g: 1000,
        grams: 3000,
      },
    ])
    // Nuss: 4600 / 2000 = 2,3
    expect(f[0].recipe.factor).toBe(2.3)
    expect(f[0].recipe.ingredients.map((i) => [i.name, i.scaled_g])).toEqual([
      ['Nüsse (gemahlen)', 2300],
      ['Wasser', 2300],
    ])
    // Mohn: 1600 / 2000 = 0,8
    expect(f[1].recipe.ingredients.map((i) => i.scaled_g)).toEqual([
      1200, 320, 80,
    ])
    expect(f[1].name).toBe('Mohnfüllung')
  })

  it('Posten ohne Fuellung tragen nichts bei', () => {
    const r = day(SAT, { preorderItems: [pre('test-kranz', 5)] })
    expect(r.fillings.reduce((s, f) => s + f.grams, 0)).toBe(6200)
  })

  it('ohne Rezept: Gramm ja, Rezept nein', () => {
    const f = core.computeDay({ config: config(), date: SAT }).fillings
    expect(f[0]).toMatchObject({
      id: 'nuss',
      grams: 4600,
      recipe: null,
      recipeMissing: true,
    })
  })

  it('markiert fehlende Fuellungsgramm je Variante', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'kranz-gefuellt').filling_g = {
      nuss: 1000,
      mohn: null,
    }
    const f = core.computeDay({
      config: cfg,
      date: SAT,
      recipes: RECIPES,
    }).fillings
    const mohn = f.find((x) => x.id === 'mohn')
    expect(mohn.missingFillingG).toBe(true)
    expect(mohn.grams).toBe(800) // nur der Zopf
    expect(mohn.items[1]).toMatchObject({
      itemId: 'kranz-gefuellt',
      filling_g: null,
      grams: null,
    })
  })

  it('warnt bei gefuellter Ware ohne Variantenangabe', () => {
    const r = day(SAT, { preorderItems: [pre('test-zopf-gefuellt', 2)] })
    expect(
      r.warnings.find((w) => w.code === 'filling_unassigned')
    ).toMatchObject({ itemId: 'zopf-gefuellt', qty: 2 })
    expect(r.hefeteig.dough_g).toBe(11400 + 2 * 500) // Teig wird trotzdem gebraucht
  })
})

describe('Vorbereitung je Wochentag', () => {
  const ids = (r) => r.prep.map((p) => [p.id, p.variant])

  it('Dienstag: Sauerteig misch (default) und Wagen', () => {
    expect(ids(day(TUE))).toEqual([
      ['sauerteig', 'misch'],
      ['wagen', null],
    ])
  })

  it('Mittwoch: Buttermilch-Sauerteig, Bruehstueck weil Vollkorn gebacken wird', () => {
    expect(ids(day(WED))).toEqual([
      ['sauerteig', 'buttermilch'],
      ['bruehstueck', null],
      ['wagen', null],
    ])
  })

  it('when_item entfaellt, wenn der Posten auf 0 korrigiert wird', () => {
    const r = day(WED, { corrections: [{ itemId: 'vollkorn', qty: -2 }] })
    expect(ids(r).map((x) => x[0])).not.toContain('bruehstueck')
  })

  it('Samstag: by_weekday false schaltet ab, Samstags-Aufgabe erscheint', () => {
    expect(ids(day(SAT))).toEqual([['samstag-only', 'gross']])
  })

  it('variant_labels gibt der Variante einen deutschen Namen (W4-verify r2)', () => {
    expect(day(SAT).prep[0]).toMatchObject({
      variant: 'gross',
      variantLabel: 'groß',
    })
    // ohne Eintrag: null, die Oberflaeche zeigt dann die ID
    expect(day(TUE).prep[0]).toMatchObject({
      variant: 'misch',
      variantLabel: null,
    })
  })

  it('Sonntag: default greift, Wagen nicht', () => {
    expect(ids(day(SUN))).toEqual([['sauerteig', 'misch']])
  })
})

describe('HefezopfCalculator-Spec, Zahlen 1:1 (Q-B3: gefuellter Kranz 3 × 600 g wie im alten Code)', () => {
  // Nachbau der Stammdaten aus apps/bakery-management/src/features/production
  // (data/doughPieces.ts, productionCalculator.ts) - oeffentlicher Altcode,
  // keine hq-Werte. Ein Produkt = ein Posten; Menge kommt als Korrektur.
  function oldConfig() {
    return {
      version: 1,
      days: [6],
      sections: ['hefeteig'],
      items: [
        {
          id: 'hefekranz',
          name: 'Hefekranz',
          section: 'hefeteig',
          variants: ['nuss', 'schoko'],
          dough: { id: 'hefeteig', piece_g: 600, pieces: 3 }, // „Gefüllter Kranz“
          filling_g: 1200,
        },
        {
          id: 'zopf-gefuellt',
          name: 'Gefüllter Zopf',
          section: 'hefeteig',
          variants: ['nuss', 'schoko'],
          dough: { id: 'hefeteig', piece_g: 500, pieces: 1 },
          filling_g: 450,
        },
        {
          id: 'hefezopf-plain',
          name: 'Hefezopf Plain',
          section: 'hefeteig',
          dough: { id: 'hefeteig', piece_g: 300, pieces: 3 }, // „Großer Zopf“
        },
      ],
      doughs: [{ id: 'hefeteig', name: 'Hefeteig', batch_max_kg: 40 }],
      fillings: [],
      prep: [],
    }
  }
  const run = (corrections) =>
    core.computeDay({ config: oldConfig(), date: SAT, corrections })

  it('Teiggewicht = Gewicht × Anzahl × Menge (2 × Hefekranz Nuss)', () => {
    const r = run([{ itemId: 'hefekranz', variant: 'nuss', qty: 2 }])
    expect(r.hefeteig.dough_g).toBe(2 * 3 * 600)
    expect(r.hefeteig.doughs[0].weighing).toEqual([
      expect.objectContaining({ piece_g: 600, pieces: 6 }),
    ])
  })

  it('Teigstuecke gleicher Art werden ueber Produkte summiert', () => {
    const r = run([
      { itemId: 'hefekranz', variant: 'nuss', qty: 1 },
      { itemId: 'hefekranz', variant: 'schoko', qty: 1 },
    ])
    expect(r.hefeteig.doughs[0].weighing[0].pieces).toBe(6)
  })

  it('Fuellung je Sorte: 2 × 1200 + 3 × 450 Nuss, Schoko 0', () => {
    const r = run([
      { itemId: 'hefekranz', variant: 'nuss', qty: 2 },
      { itemId: 'zopf-gefuellt', variant: 'nuss', qty: 3 },
      { itemId: 'hefezopf-plain', qty: 5 },
    ])
    expect(r.fillings.map((f) => [f.id, f.grams])).toEqual([
      ['nuss', 2 * 1200 + 3 * 450],
    ])
  })

  it('Chargen zu 40 kg: 1 × 900 g = 1, 45 × 900 g = 40,5 kg = 2', () => {
    expect(
      run([{ itemId: 'hefezopf-plain', qty: 1 }]).hefeteig.doughs[0].batches
    ).toBe(1)
    expect(
      run([{ itemId: 'hefezopf-plain', qty: 45 }]).hefeteig.doughs[0].batches
    ).toBe(2)
  })
})

describe('Grundmenge noch nicht festgelegt (null)', () => {
  it('zeigt die Zeile mit baseUnset und warnt, 0 bleibt still', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'kranz').base = { 6: null }
    cfg.items.find((i) => i.id === 'kranz-gefuellt').base = {
      6: { nuss: null, mohn: 1 },
    }
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base = { 6: null }
    cfg.items.find((i) => i.id === 'plunder').base[6] = 0
    const r = core.computeDay({ config: cfg, date: SAT })
    expect(line(r, 'kranz')).toMatchObject({ baseUnset: true, total: 0 })
    expect(line(r, 'kranz-gefuellt', 'nuss')).toMatchObject({
      baseUnset: true,
    })
    expect(line(r, 'kranz-gefuellt', 'mohn')).toMatchObject({
      baseUnset: false,
      total: 1,
    })
    expect(line(r, 'zopf-gefuellt', 'nuss').baseUnset).toBe(true)
    expect(line(r, 'zopf-gefuellt', 'mohn').baseUnset).toBe(true)
    expect(line(r, 'zopf-gefuellt', null)).toBeUndefined()
    expect(line(r, 'plunder')).toBeUndefined() // 0 = wird nicht gebacken
    const w = r.warnings.find((x) => x.code === 'base_unset')
    expect(w.items).toEqual([
      'Zopf gefüllt – Nussfüllung',
      'Zopf gefüllt – Mohnfüllung',
      'Kranz gefüllt – Nussfüllung',
      'Kranz',
    ])
    expect(w.message).toMatch(/Samstag noch nicht festgelegt/)
  })

  it('ohne null keine Warnung', () => {
    expect(day(SAT).warnings.some((w) => w.code === 'base_unset')).toBe(false)
    expect(day(SAT).lines.every((l) => l.baseUnset === false)).toBe(true)
  })

  it('eine Vorbestellung zaehlt auch auf einer offenen Zeile', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'kranz').base = { 6: null }
    const r = core.computeDay({
      config: cfg,
      date: SAT,
      preorderItems: [pre('test-kranz', 2)],
    })
    expect(line(r, 'kranz')).toMatchObject({ baseUnset: true, total: 2 })
  })
})

describe('computePreorderDeltas (je Vorbestellung, roadmap §5.3)', () => {
  const deltas = (before, after, extra = {}) =>
    core.computePreorderDeltas({
      config: config(),
      date: SAT,
      catalog: PRODUCTS,
      before,
      after,
      ...extra,
    })

  it('meldet ein Viertel, das in der Aufrundung verschwindet', () => {
    const before = [pre('test-kranz-viertel', 3, { preorderId: 1 })]
    const after = [...before, pre('test-kranz-viertel', 1, { preorderId: 2 })]
    // Zeilensumme bleibt gleich: ceil(0,75) = ceil(1,0) = 1
    const lb = day(SAT, { preorderItems: before }).lines
    const la = day(SAT, { preorderItems: after }).lines
    expect(line({ lines: la }, 'kranz').total).toBe(
      line({ lines: lb }, 'kranz').total
    )
    expect(deltas(before, after)).toEqual([
      {
        key: 'kranz|',
        itemId: 'kranz',
        name: 'Kranz',
        unit: 'Stück',
        variant: null,
        preorderId: 2,
        before: 0,
        after: 0.25,
        qty: 0.25,
        kind: 'added',
      },
    ])
    // und der Zeilenvergleich verschluckt es auch nicht mehr
    const d = core.computeDeltas(lb, la)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({
      itemId: 'kranz',
      qty: 0,
      preordersExact: 0.25,
      preorderIdsAdded: [2],
      preorderIdsRemoved: [],
    })
  })

  it('neue Bestellung plus gleich grosse Stornierung: zwei Deltas, Summe 0', () => {
    const before = [pre('test-weck', 3, { preorderId: 1 })]
    const after = [
      pre('test-weck', 3, { preorderId: 1, status: 'cancelled' }),
      pre('test-weck', 3, { preorderId: 2 }),
    ]
    const d = deltas(before, after)
    expect(d.map((x) => [x.preorderId, x.qty, x.kind])).toEqual([
      [2, 3, 'added'],
      [1, -3, 'cancelled'],
    ])
    const lines = core.computeDeltas(
      day(SAT, { preorderItems: before }).lines,
      day(SAT, { preorderItems: after }).lines
    )
    expect(lines[0]).toMatchObject({
      itemId: 'weck',
      qty: 0,
      preordersExact: 0,
      preorderIdsAdded: [2],
      preorderIdsRemoved: [1],
    })
  })

  it('geaenderte Menge, Variante, numerische ID und verschachtelte Form', () => {
    const before = [
      {
        id: 7,
        pickupDate: SAT,
        items: [{ productId: 902, qty: 1, variant: 'nuss' }],
      },
    ]
    const after = [
      {
        id: 7,
        pickupDate: SAT,
        items: [
          { productId: 902, qty: 1, variant: 'nuss' },
          {
            productSlug: 'test-kranz-gefuellt-viertel',
            qty: 2,
            variant: 'mohn',
          },
        ],
      },
    ]
    expect(
      deltas(before, after).map((x) => [x.key, x.preorderId, x.qty, x.kind])
    ).toEqual([['kranz-gefuellt|mohn', 7, 0.5, 'added']])
    const changed = [
      {
        id: 7,
        pickupDate: SAT,
        items: [{ productId: 902, qty: 3, variant: 'nuss' }],
      },
    ]
    expect(deltas(before, changed)[0]).toMatchObject({
      key: 'kranz-gefuellt|nuss',
      before: 1,
      after: 3,
      qty: 2,
      kind: 'changed',
    })
  })

  it('ignoriert andere Tage, Ruhetage, unbekannte Produkte; ohne Aenderung leer', () => {
    const before = [pre('test-weck', 3, { preorderId: 1 })]
    expect(deltas(before, before)).toEqual([])
    expect(
      deltas([], [pre('test-weck', 3, { preorderId: 1, pickupDate: SUN })])
    ).toEqual([])
    expect(deltas([], [pre('gibt-es-nicht', 3, { preorderId: 1 })])).toEqual([])
    expect(
      deltas([], [pre('test-weck', 3, { preorderId: 1, pickupDate: MON })], {
        date: MON,
      })
    ).toEqual([])
    expect(deltas(null, undefined, { date: 'kaputt' })).toEqual([])
  })
})

describe('variantsForProduct (fuer die Pruefung von preorder_items.variant, B7)', () => {
  it('liefert Posten, Faktor und erlaubte Varianten', () => {
    expect(
      core.variantsForProduct(config(), 'test-kranz-gefuellt-viertel')
    ).toEqual({
      itemId: 'kranz-gefuellt',
      name: 'Kranz gefüllt',
      unit: 'Stück',
      factor: 0.25,
      variants: ['nuss', 'mohn'],
    })
    expect(core.variantsForProduct(config(), 907, PRODUCTS)).toMatchObject({
      itemId: 'weck',
      variants: [],
    })
    expect(core.variantsForProduct(config(), 'gibt-es-nicht')).toBeNull()
  })
})

describe('variantsByProduct (Erfassungsmaske P1)', () => {
  it('listet jedes Produkt mit Sorten, ohne Produkte ohne Sorten', () => {
    expect(core.variantsByProduct(config())).toEqual({
      'test-zopf-gefuellt': ['nuss', 'mohn'],
      'test-kranz-gefuellt': ['nuss', 'mohn'],
      'test-kranz-gefuellt-viertel': ['nuss', 'mohn'],
    })
  })

  it('stimmt mit variantsForProduct überein', () => {
    const map = core.variantsByProduct(config())
    for (const id of Object.keys(map)) {
      expect(core.variantsForProduct(config(), id).variants).toEqual(map[id])
    }
  })

  it('liefert Kopien, nicht die Listen der Stammdaten', () => {
    const cfg = config()
    const map = core.variantsByProduct(cfg)
    map['test-zopf-gefuellt'].push('x')
    expect(core.variantsByProduct(cfg)['test-zopf-gefuellt']).toEqual([
      'nuss',
      'mohn',
    ])
  })
})

describe('computeDeltas', () => {
  it('meldet nur geaenderte Gesamtmengen, mit Herkunft der Aenderung', () => {
    const confirmed = day(SAT).lines
    const updated = day(SAT, {
      preorderItems: [
        pre('test-weck', 5),
        pre('test-zopf-gefuellt', 1, { variant: 'nuss' }),
      ],
    }).lines
    const deltas = core.computeDeltas(confirmed, updated)
    expect(
      deltas.map((d) => [d.itemId, d.variant, d.before, d.after, d.qty])
    ).toEqual([
      ['weck', null, 60, 65, 5],
      ['zopf-gefuellt', 'nuss', 4, 5, 1],
    ])
    expect(deltas[0].changes).toEqual({ preorders: 5 })
  })

  it('erkennt neue und weggefallene Zeilen', () => {
    const confirmed = day(TUE).lines
    const updated = day(TUE, {
      corrections: [
        { itemId: 'schnecke', qty: -6 },
        { itemId: 'zopf-gefuellt', variant: 'mohn', qty: 1 },
      ],
    }).lines.filter((l) => l.total > 0)
    const deltas = core.computeDeltas(confirmed, updated)
    expect(deltas.map((d) => [d.itemId, d.variant, d.qty])).toEqual([
      ['zopf-gefuellt', 'mohn', 1],
      ['schnecke', null, -6],
    ])
  })

  it('keine Aenderung, keine Deltas; Liter mit Bruchteilen', () => {
    expect(core.computeDeltas(day(SAT).lines, day(SAT).lines)).toEqual([])
    const d = core.computeDeltas(
      day(SAT).lines,
      day(SAT, { seasonFactor: 1.1 }).lines
    )
    expect(d.find((x) => x.itemId === 'kornbrot')).toMatchObject({
      before: 2.25,
      after: 2.48,
      qty: 0.23,
    })
    expect(core.computeDeltas(null, undefined)).toEqual([])
  })
})

describe('formatTrayInfo (aus dem früheren feature-daily-prep/utils/trayInfo.ts)', () => {
  it('formatiert wie das Original', () => {
    expect(core.formatTrayInfo({ tray_number: 5 })).toBe('Blech 5')
    expect(core.formatTrayInfo({ tray_number: 0 })).toBe('Blech 0')
    expect(core.formatTrayInfo({ tray_numbers: [11, 12, 13] })).toBe(
      'Bleche 11, 12, 13'
    )
    expect(
      core.formatTrayInfo({ tray_numbers: [15, 16, 17], trays_of: 12 })
    ).toBe('3 Bleche à 12 (Bleche 15, 16, 17)')
    expect(core.formatTrayInfo({})).toBeNull()
    expect(core.formatTrayInfo({ tray_numbers: [], trays_of: 5 })).toBeNull()
    expect(core.formatTrayInfo({ tray_number: Number.NaN })).toBeNull()
    expect(core.formatTrayInfo({ tray_numbers: [Number.NaN, 4] })).toBe(
      'Blech 4'
    )
    expect(
      core.getTrayNumbers({ tray_number: 1, tray_numbers: [2, 3] })
    ).toEqual([2, 3])
  })

  it('uebersetzt das YAML-Format tray: { no, per_tray }', () => {
    expect(core.trayText({ no: [4], per_tray: null })).toBe('Blech 4')
    expect(core.trayText({ no: [1, 2], per_tray: 6 })).toBe(
      '2 Bleche à 6 (Bleche 1, 2)'
    )
    expect(core.trayText(null)).toBeNull()
  })

  it('zählt Bleche nach der Menge der Zeile (W4-verify r3)', () => {
    const croissant = { no: [1, 2], per_tray: 12 }
    // 40 Stück: 4 Bleche, nicht „2 Bleche à 12“ (Platz für 24)
    expect(core.trayText(croissant, 40, 'Stück')).toBe(
      '4 Bleche à 12 (Bleche 1, 2 + 2 weitere)'
    )
    expect(core.trayText(croissant, 24, 'Stück')).toBe(
      '2 Bleche à 12 (Bleche 1, 2)'
    )
    expect(core.trayText(croissant, 27, 'Stück')).toBe(
      '3 Bleche à 12 (Bleche 1, 2 + 1 weiteres)'
    )
    expect(core.trayText(croissant, 12, 'Stück')).toBe('1 Blech à 12 (Blech 1)')
    expect(core.trayText({ no: [5], per_tray: 6 }, 7, 'Stück')).toBe(
      '2 Bleche à 6 (Blech 5 + 1 weiteres)'
    )
    // Ohne Menge oder ohne per_tray: wie bisher
    expect(core.trayText(croissant, 0, 'Stück')).toBe(
      '2 Bleche à 12 (Bleche 1, 2)'
    )
    expect(core.trayText({ no: [3] }, 40, 'Stück')).toBe('Blech 3')
    expect(core.trayText(croissant, 4, 'Liter')).toBe(
      '2 Bleche à 12 (Bleche 1, 2)'
    )
  })
})

describe('Zukauf und Hinweise an der Zeile', () => {
  it('Zeile traegt purchased, note und hint nur, wenn der Posten sie hat', () => {
    const raw = config()
    const schnecke = raw.items.find((i) => i.id === 'schnecke')
    schnecke.purchased = true
    schnecke.note = 'mit Käse bestreuen'
    raw.items.find((i) => i.id === 'plunder').note = 'für morgen'
    const r = core.computeDay({ config: raw, date: TUE })
    expect(line(r, 'schnecke')).toMatchObject({
      purchased: true,
      note: 'mit Käse bestreuen',
      hint: 'Zukauf – auflegen · mit Käse bestreuen',
    })
    const plunder = line(r, 'plunder')
    expect(plunder.hint).toBe('für morgen')
    expect(plunder).not.toHaveProperty('purchased')
    const weck = line(r, 'weck')
    expect(weck).not.toHaveProperty('hint')
    expect(weck).not.toHaveProperty('note')
  })
})

describe('Einheit Charge (Spezialbrot)', () => {
  it('rechnet Chargen-Faktoren wie Liter auf Hundertstel', () => {
    const raw = config()
    const korn = raw.items.find((i) => i.id === 'kornbrot')
    korn.unit = 'Charge'
    korn.base = { 2: 1.12 }
    korn.pieces_per_liter = null
    const r = core.computeDay({ config: raw, date: TUE, seasonFactor: 1.1 })
    const l = line(r, 'kornbrot')
    expect(l.unit).toBe('Charge')
    expect(l.total).toBe(1.24) // 1,12 × 1,1 = 1,232 → aufgerundet 1,24
    expect(l).not.toHaveProperty('loavesEstimate')
  })
})

describe('roundUp', () => {
  it('rundet Stueck auf ganze Zahlen und Liter auf Hundertstel, tolerant gegen Fliesskomma', () => {
    expect(core.roundUp(0.1 * 3 * 10, 'Stück')).toBe(3)
    expect(core.roundUp(2.01, 'Stück')).toBe(3)
    expect(core.roundUp(1.37 * 1.0, 'Liter')).toBe(1.37)
    expect(core.roundUp(1.371, 'Liter')).toBe(1.38)
    expect(core.roundUp(1.121, 'Charge')).toBe(1.13)
    expect(core.roundUp(Number.NaN, 'Stück')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Backzettel v2 (Z10, docs/backzettel-v2.md §4, §6): Zettel je Teigtag
// ---------------------------------------------------------------------------

const dayCore = require('../../src/services/backzettel-day.core')
const configCore = require('../../src/services/backzettel-config.core')
const planCore = require('../../src/services/backzettel-plan.core')
const { configV2, PRODUCTS_V2 } = require('../fixtures/backzettel.synthetic')
const {
  V1_DAY_CASES,
  fullArgs,
} = require('../fixtures/backzettel-v1-day-cases')
const V1_DAY_RECORDED = require('../fixtures/backzettel-v1-day.recorded.json')

const NEXT_TUE = '2026-12-01'
const FRI = '2026-11-27'

/** Ein Zettel je Teigtag mit configV2 (oder `config`). */
function sheetV2(date, extra = {}) {
  const { config: cfg, ...rest } = extra
  return core.computeDoughDay({
    config: cfg || configV2(),
    date,
    catalog: PRODUCTS_V2,
    recipes: RECIPES,
    ...rest,
  })
}
const lineAt = (r, key) => r.lines.find((l) => l.key === key)

/** Entfernt die additiven Z10-Felder eines Zettels (R1-Vergleich). */
function stripV2(sheet) {
  const LINE_FIELDS = [
    'bakeDate',
    'doughDate',
    'lead',
    'variantKind',
    'variantLabel',
    'bruch',
    'totalIsMinimum',
  ]
  const DOUGH_FIELDS = [
    'kg',
    'kgKnown',
    'complete',
    'missing',
    'liters',
    'piecesComplete',
  ]
  const s = JSON.parse(JSON.stringify(sheet))
  for (const k of [
    'sheetVersion',
    'isDoughDay',
    'dayKind', // U9: am Teigtag-Zettel immer, an computeDay nur mit Kalender
    'bakeDates',
    'plan',
    'doughs',
    'machine',
    'bread',
    'rolls',
    'openMasterData',
  ])
    delete s[k]
  const strip = (l) => LINE_FIELDS.forEach((f) => delete l[f])
  s.lines.forEach(strip)
  s.sections.forEach((sec) => sec.lines.forEach(strip))
  delete s.hefeteig.complete
  s.hefeteig.doughs.forEach((d) => DOUGH_FIELDS.forEach((f) => delete d[f]))
  return s
}

describe('R1: v1-Stammdaten rechnen wie vor Z10', () => {
  it.each(Object.keys(V1_DAY_CASES))(
    '%s ist Byte für Byte gleich der Aufnahme',
    (name) => {
      const result = V1_DAY_CASES[name]({ core, day: dayCore, configCore })
      expect(JSON.stringify(result)).toBe(JSON.stringify(V1_DAY_RECORDED[name]))
    }
  )

  it.each([
    ['2026-11-24'],
    ['2026-11-25'],
    ['2026-11-28'],
    ['2026-11-29'],
    ['2026-11-30'],
  ])(
    'der Zettel je Teigtag (%s) ist computeDay plus additive Felder',
    (date) => {
      for (const extra of [{}, { seasonFactor: 1.1, includeEmpty: true }]) {
        const args = fullArgs(date, extra)
        const v1 = core.computeDay(args)
        const sheet = core.computeDoughDay(args)
        expect(JSON.stringify(stripV2(sheet))).toBe(JSON.stringify(v1))
        // gleiche Schluessel, jede Zeile auf ihrem eigenen Tag
        for (const l of sheet.lines) {
          expect(l.bakeDate).toBe(date)
          expect(l.doughDate).toBe(date)
          expect(l.lead).toBe(0)
          expect(l.key).not.toMatch(/@/)
        }
        expect(sheet.plan.bakeDates.map((b) => b.date)).toEqual(
          sheet.open ? [date] : []
        )
      }
    }
  )
})

describe('Zettel je Teigtag (computeDoughDay)', () => {
  it('Samstag: Brot und Hefeteig heute, Brötchen für Sonntag und Dienstag', () => {
    const r = sheetV2(SAT)
    expect(r.sheetVersion).toBe(2)
    expect(r.isDoughDay).toBe(true)
    expect(r.bakeDates).toEqual([
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
        lineCount: 5,
      },
      {
        date: NEXT_TUE,
        weekday: 2,
        weekdayName: 'Dienstag',
        label: 'für Dienstag',
        lineCount: 4,
      },
    ])
    // Abschnitt, dann Backtag, dann Stammdaten
    expect(
      r.sections.find((s) => s.id === 'broetchen').lines.map((l) => l.key)
    ).toEqual([
      `test-doppel|@${SUN}`,
      `test-stern|@${SUN}`,
      `test-kaese|@${SUN}`,
      `test-flitweck|@${SUN}`,
      `test-flit-klein|@${SUN}`,
      `test-doppel|@${NEXT_TUE}`,
      `test-stern|@${NEXT_TUE}`,
      `test-kaese|@${NEXT_TUE}`,
      `test-flitweck|@${NEXT_TUE}`,
    ])
    expect(lineAt(r, `test-doppel|@${NEXT_TUE}`)).toMatchObject({
      bakeDate: NEXT_TUE,
      doughDate: SAT,
      lead: 1,
      variantKind: null,
      variantLabel: null,
      bruch: { group: 'test-doppel', perProduct: 2 },
      total: 40,
    })
    expect(lineAt(r, 'test-korn|g500')).toMatchObject({
      bakeDate: SAT,
      doughDate: SAT,
      lead: 0,
      variantKind: 'size',
      variantLabel: '500 g',
    })
    expect(lineAt(r, 'test-zopf|nuss').variantLabel).toBe('Nussfüllung')
    expect(r.warnings).toEqual([])
  })

  it('Sonntag: kein Teigtag, nur lead-0-Zeilen (hier keine); Montag geschlossen', () => {
    const sun = sheetV2(SUN)
    expect(sun.isDoughDay).toBe(false)
    expect(sun.open).toBe(true)
    expect(sun.lines).toEqual([])
    expect(sun.plan.bakeDates.map((b) => b.date)).toEqual([SUN])
    const mon = sheetV2(MON, {
      preorderItems: [{ productId: 'test-doppel', qty: 2, pickupDate: MON }],
    })
    expect(mon.open).toBe(false)
    expect(mon.plan.bakeDates).toEqual([])
    expect(mon.warnings.map((w) => w.code)).toEqual(['preorders_on_closed_day'])
  })

  it('O3: der Saisonfaktor des Zettels gilt für alle seine Backtage', () => {
    const r = sheetV2(SAT, { seasonFactor: 1.1 })
    expect(lineAt(r, `test-doppel|@${SUN}`).total).toBe(66)
    expect(lineAt(r, `test-doppel|@${NEXT_TUE}`).total).toBe(44)
    expect(r.seasonFactor).toBe(1.1)
    const bad = sheetV2(SAT, { seasonFactor: 0 })
    expect(
      bad.warnings.filter((w) => w.code === 'invalid_season_factor')
    ).toHaveLength(1)
  })

  it('Korrekturen gehören zu ihrem Backtag; ohne bakeDate zum Zettel-Tag', () => {
    const r = sheetV2(SAT, {
      corrections: [
        { itemId: 'test-doppel', qty: 5, reason: 'Fest', bakeDate: SUN },
        { itemId: 'test-plunder', qty: 2, reason: 'Markt' },
        { itemId: 'test-doppel', qty: 9, reason: 'nicht hier', bakeDate: FRI },
      ],
    })
    expect(lineAt(r, `test-doppel|@${SUN}`)).toMatchObject({
      correction: 5,
      correctionReason: 'Fest',
      total: 65,
    })
    expect(lineAt(r, `test-doppel|@${NEXT_TUE}`).correction).toBe(0)
    expect(lineAt(r, 'test-plunder|').total).toBe(22)
  })

  it('Hinweise anderer Backtage tragen ihren Backtag; fremde Produkte meldet der eigene Zettel', () => {
    const preorderItems = [
      { productId: 'test-doppel', variant: 'x', qty: 1, pickupDate: SUN },
      { productId: 'gibt-es-nicht', qty: 3, pickupDate: SUN },
    ]
    const sat = sheetV2(SAT, { preorderItems })
    expect(sat.warnings).toEqual([
      expect.objectContaining({ code: 'variant_ignored', bakeDate: SUN }),
    ])
    const sun = sheetV2(SUN, { preorderItems })
    expect(sun.warnings.map((w) => w.code)).toEqual(['unmapped_product'])
  })
})

describe('R19: Vorbestellungen und CAP gehören zum Backtag', () => {
  const caps = [
    {
      weekday: 7,
      active: true,
      items: [{ productSlug: 'test-stern', quantity: 4 }],
    },
    {
      weekday: 6,
      active: true,
      items: [{ productSlug: 'test-stern', quantity: 3 }],
    },
  ]
  const preorderItems = [
    { preorderId: 1, productId: 'test-doppel', qty: 5, pickupDate: SUN },
    { preorderId: 2, productId: 'test-doppel', qty: 7, pickupDate: SAT },
  ]

  it('der Samstagszettel nimmt die Abholung am Sonntag und die CAP-Vorlage des Sonntags', () => {
    const r = sheetV2(SAT, { preorderItems, capTemplate: caps })
    expect(lineAt(r, `test-doppel|@${SUN}`)).toMatchObject({
      preorders: 5,
      preorderIds: [1],
      total: 65,
    })
    expect(lineAt(r, `test-stern|@${SUN}`).cap).toBe(4)
    // Samstagsbrötchen macht der Freitag
    expect(
      r.lines.some((l) => l.bakeDate === SAT && l.itemId === 'test-doppel')
    ).toBe(false)
    const fri = sheetV2(FRI, { preorderItems, capTemplate: caps })
    expect(lineAt(fri, `test-doppel|@${SAT}`)).toMatchObject({
      preorders: 7,
      total: 7,
    })
    expect(lineAt(fri, `test-stern|@${SAT}`).cap).toBe(3)
  })

  it('bakeInputs je Backtag haben Vorrang', () => {
    const r = sheetV2(SAT, {
      preorderItems,
      bakeInputs: {
        [SUN]: {
          preorderItems: [
            { productId: 'test-doppel', qty: 2, pickupDate: SUN },
          ],
          capTemplate: [],
        },
      },
      capTemplate: caps,
    })
    expect(lineAt(r, `test-doppel|@${SUN}`).preorders).toBe(2)
    expect(lineAt(r, `test-stern|@${SUN}`).cap).toBe(0)
  })
})

describe('R20: Viertel je (Backtag × Posten × Variante), nicht über Backtage', () => {
  it('3 Viertel für Sonntag und 1 Viertel für Dienstag sind je ein Ganzes', () => {
    const cfg = configV2()
    cfg.items
      .find((i) => i.id === 'test-doppel')
      .products.push({ id: 'test-doppel-viertel', factor: 0.25 })
    const r = sheetV2(SAT, {
      config: cfg,
      preorderItems: [
        { productId: 'test-doppel-viertel', qty: 3, pickupDate: SUN },
        { productId: 'test-doppel-viertel', qty: 1, pickupDate: NEXT_TUE },
      ],
    })
    expect(lineAt(r, `test-doppel|@${SUN}`)).toMatchObject({
      preordersExact: 0.75,
      total: 61,
    })
    expect(lineAt(r, `test-doppel|@${NEXT_TUE}`)).toMatchObject({
      preordersExact: 0.25,
      total: 41,
    })
  })
})

describe('R21: Hefeteig mit Litern (kg ÷ 5, ganze Liter) und Chargen', () => {
  it('6,6 kg → 1,32 L → 1 L; ohne Chargengröße keine Chargen', () => {
    const h = sheetV2(SAT).hefeteig
    expect(h.doughs).toHaveLength(1)
    expect(h.doughs[0]).toMatchObject({
      id: 'test-hefe',
      pieces: 12,
      dough_g: 6600,
      kg: 6.6,
      complete: true,
      liters: { exact: 1.32, rounded: 1, reason: null },
      batches: null,
    })
    expect(h.complete).toBe(true)
  })

  it('mehr Kränze: 9 kg → 1,8 L → 2 L; mit Chargengröße 5 kg zwei Chargen', () => {
    const cfg = configV2()
    cfg.doughs.find((d) => d.id === 'test-hefe').batch_max_kg = 5
    const r = sheetV2(SAT, {
      config: cfg,
      corrections: [{ itemId: 'test-kranz', qty: 2, reason: 'Fest' }],
    })
    expect(r.hefeteig.doughs[0]).toMatchObject({
      kg: 9,
      liters: { exact: 1.8, rounded: 2 },
      batches: 2,
    })
  })

  it('Grundmenge offen: Hefeteig-Karte und Maschinenleiste sagen dasselbe (unvollständig)', () => {
    const cfg = configV2()
    cfg.items.find((i) => i.id === 'test-kranz').base[6] = null
    cfg.doughs.find((d) => d.id === 'test-hefe').batch_max_kg = 5
    const r = sheetV2(SAT, { config: cfg })
    const card = r.hefeteig.doughs[0]
    const machine = r.machine.find((m) => m.id === 'test-hefe')
    expect(machine).toMatchObject({ kg: null, complete: false, batches: null })
    expect(card).toMatchObject({
      kg: machine.kg,
      kgKnown: machine.kgKnown,
      complete: false,
      dough_g: null,
      batches: null,
      piecesComplete: false,
      liters: machine.liters,
    })
    expect(card.liters.reason).toBe('dough_incomplete')
    expect(card.missing.map((m) => m.code)).toContain('base_unset')
    expect(r.hefeteig.complete).toBe(false)
  })

  it('Grundmenge offen: Abwiegeliste nennt Stufe und Posten als „mindestens“', () => {
    const cfg = configV2()
    cfg.items.find((i) => i.id === 'test-zopf').base[6] = {
      nuss: null,
      mohn: 2,
    }
    const r = sheetV2(SAT, {
      config: cfg,
      preorderItems: [pre('test-zopf-v2', 1, { variant: 'nuss' })],
    })
    const weighing = r.hefeteig.doughs[0].weighing
    const zopf = weighing.find((w) => w.piece_g === 500)
    expect(zopf).toMatchObject({ pieces: 3, isMinimum: true })
    expect(zopf.items).toEqual([
      expect.objectContaining({
        itemId: 'test-zopf',
        products: 3,
        isMinimum: true,
      }),
    ])
    // der Kranz (Grundmenge bekannt) bleibt eine feste Zahl
    const kranz = weighing.find((w) => w.piece_g === 600)
    expect(kranz.pieces).toBe(6)
    expect(kranz.isMinimum).toBeUndefined()
    expect(kranz.items[0].isMinimum).toBeUndefined()
  })

  it('Grundmenge offen ohne Vorbestellung: der Posten steht trotzdem in der Abwiegeliste', () => {
    const cfg = configV2()
    cfg.items.find((i) => i.id === 'test-kranz').base[6] = null
    const weighing = sheetV2(SAT, { config: cfg }).hefeteig.doughs[0].weighing
    const kranz = weighing.find((w) => w.piece_g === 600)
    expect(kranz).toMatchObject({ pieces: 0, isMinimum: true })
    expect(kranz.items[0]).toMatchObject({
      itemId: 'test-kranz',
      products: 0,
      isMinimum: true,
    })
  })

  it('Hefeteig-Karte = Teigsumme des Zettels, auch vollständig', () => {
    const cfg = configV2()
    cfg.doughs.find((d) => d.id === 'test-hefe').batch_max_kg = 5
    const r = sheetV2(SAT, { config: cfg })
    const card = r.hefeteig.doughs[0]
    const summary = r.doughs.find((d) => d.id === 'test-hefe')
    for (const f of ['kg', 'kgKnown', 'complete', 'liters', 'batches'])
      expect(card[f]).toEqual(summary[f])
  })

  it('Stückgewicht offen: Teiggewicht unbekannt statt 0, keine Chargen', () => {
    const cfg = configV2()
    cfg.items.find((i) => i.id === 'test-kranz').dough.piece_g = null
    cfg.doughs.find((d) => d.id === 'test-hefe').batch_max_kg = 5
    const h = sheetV2(SAT, { config: cfg }).hefeteig
    expect(h.doughs[0]).toMatchObject({
      pieces: 12,
      dough_g: null,
      kg: null,
      kgKnown: 3,
      complete: false,
      batches: null,
      liters: { reason: 'dough_incomplete' },
    })
    expect(h.doughs[0].missing.map((m) => m.code)).toEqual(['piece_g_unknown'])
    expect(h.dough_g).toBeNull()
    // auch computeDay (v1-Form) zählt das nicht als 0 g
    const v1 = core.computeDay({ config: cfg, date: SAT })
    expect(v1.hefeteig.doughs[0].dough_g).toBeNull()
  })

  it('Brot je Größe und Brötchen in Bruch stehen nicht im Hefeteig', () => {
    // v1-Form (computeDay rechnet alle Posten des Backtags): Einzelstücke
    // (Testparty) zählen wie bisher, Größen und Brüche nie
    const v1Form = core.computeDay({ config: configV2(), date: SAT }).hefeteig
    expect(v1Form.doughs.map((d) => d.id)).toEqual([
      'test-flit-teig',
      'test-hefe',
    ])
    // der Zettel nimmt nur den Abschnitt Hefeteig
    expect(sheetV2(SAT).hefeteig.doughs.map((d) => d.id)).toEqual(['test-hefe'])
  })
})

describe('R22: filling_g null - gefüllt, Gramm unbekannt', () => {
  it('Füllungsbedarf nur in Stück, kein hochgerechnetes Rezept, offene Stammdaten', () => {
    const r = sheetV2(SAT)
    const nuss = r.fillings.find((f) => f.id === 'nuss')
    expect(nuss).toMatchObject({
      missingFillingG: true,
      grams: 0,
      recipe: null,
      recipeMissing: false,
    })
    expect(nuss.items).toEqual([
      {
        itemId: 'test-zopf',
        name: 'Testzopf gefüllt',
        pieces: 4,
        filling_g: null,
        grams: null,
      },
    ])
    expect(r.openMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items[12].filling_g',
          code: 'filling_g_unknown',
        }),
      ])
    )
  })

  it('Regel 7: fehlt das Gramm nur für einen Posten, gibt es kein Rezept für die Teilmenge', () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'kranz-gefuellt').filling_g = {
      nuss: 1000,
      mohn: null,
    }
    const f = core.computeDay({
      config: cfg,
      date: SAT,
      recipes: RECIPES,
    }).fillings
    expect(f.find((x) => x.id === 'mohn')).toMatchObject({
      missingFillingG: true,
      grams: 800,
      recipe: null,
    })
    expect(f.find((x) => x.id === 'nuss').recipe).not.toBeNull()
  })
})

describe('R23: Produkte mit Größe', () => {
  it('Vorbestellung und CAP landen auf ihrer Größe, ohne Sortenfrage', () => {
    const r = sheetV2(SAT, {
      preorderItems: [
        { productId: 'test-korn-500', qty: 2, pickupDate: SAT },
        { productId: 952, qty: 1, pickupDate: SAT },
        {
          productId: 'test-korn-500',
          variant: 'nuss',
          qty: 1,
          pickupDate: SAT,
        },
      ],
      capTemplate: {
        weekday: 6,
        items: [{ productSlug: 'test-korn-1000', quantity: 2 }],
      },
    })
    expect(lineAt(r, 'test-korn|g500')).toMatchObject({
      preorders: 3,
      total: 11,
    })
    expect(lineAt(r, 'test-korn|g1000')).toMatchObject({
      preorders: 1,
      cap: 2,
      total: 6,
    })
    expect(lineAt(r, 'test-korn|')).toBeUndefined()
    expect(r.warnings).toEqual([])
  })

  it('variantsForProduct → variants [] und size; variantsByProduct lässt sie aus', () => {
    expect(core.variantsForProduct(configV2(), 'test-korn-500')).toEqual({
      itemId: 'test-korn',
      name: 'Testkorn',
      unit: 'Stück',
      factor: 1,
      variants: [],
      size: 'g500',
    })
    expect(core.variantsForProduct(configV2(), 952, PRODUCTS_V2).size).toBe(
      'g1000'
    )
    expect(core.variantsByProduct(configV2())).toEqual({
      'test-zopf-v2': ['nuss', 'mohn'],
    })
  })

  it('Deltas einer Größen-Vorbestellung tragen die Größe', () => {
    const d = core.computePreorderDeltas({
      config: configV2(),
      date: SAT,
      before: [],
      after: [
        { preorderId: 5, productId: 'test-korn-1000', qty: 2, pickupDate: SAT },
      ],
    })
    expect(d).toEqual([
      expect.objectContaining({
        key: 'test-korn|g1000',
        variant: 'g1000',
        qty: 2,
      }),
    ])
  })
})

describe('R24 (Core): Deltas nach Teigtag', () => {
  const cfgN = configCore.normalizeConfig(configV2())
  const after = [
    { preorderId: 7, productId: 'test-doppel', qty: 4, pickupDate: NEXT_TUE },
    { preorderId: 8, productId: 'test-korn-500', qty: 1, pickupDate: SAT },
    { preorderId: 9, productId: 'test-doppel', qty: 2, pickupDate: SAT },
  ]

  it('Dienstagsbrötchen sind ein Delta auf dem Samstagszettel (Backtag Di)', () => {
    const d = core.computePreorderDeltas({
      config: cfgN,
      date: SAT,
      plan: planCore.planForSheet(cfgN, SAT),
      before: [],
      after,
    })
    expect(d.map((x) => [x.key, x.bakeDate, x.preorderId, x.qty])).toEqual([
      [`test-doppel|@${NEXT_TUE}`, NEXT_TUE, 7, 4],
      ['test-korn|g500', SAT, 8, 1],
    ])
  })

  it('…und keins auf dem Dienstagszettel selbst', () => {
    expect(
      core.computePreorderDeltas({
        config: cfgN,
        date: NEXT_TUE,
        plan: planCore.planForSheet(cfgN, NEXT_TUE),
        before: [],
        after,
      })
    ).toEqual([])
  })

  it('der Plan eines alten Tages (legacyPlan) rechnet wie v1, mit bakeDate', () => {
    const d = core.computePreorderDeltas({
      config: cfgN,
      date: NEXT_TUE,
      plan: planCore.legacyPlan(NEXT_TUE),
      before: [],
      after,
    })
    expect(d).toEqual([
      expect.objectContaining({
        key: 'test-doppel|',
        bakeDate: NEXT_TUE,
        qty: 4,
      }),
    ])
  })
})

describe('R25 (Core): Paare eines anderen freigegebenen Zettels', () => {
  it('der Samstagsentwurf lässt die Dienstagsbrötchen eines alten Dienstags aus', () => {
    const cfgN = configCore.normalizeConfig(configV2())
    // alter, vor dem Umstieg freigegebener Dienstag: alle Posten des Tages
    const legacy = planCore.legacyPlan(NEXT_TUE)
    const owned = cfgN.items
      .filter((i) => planCore.planIncludes(legacy, NEXT_TUE, i.id))
      .map((i) => planCore.ownedKey(NEXT_TUE, i.id))
    const r = sheetV2(SAT, { owned })
    expect(r.lines.some((l) => l.bakeDate === NEXT_TUE)).toBe(false)
    expect(r.plan.bakeDates[2]).toEqual({ date: NEXT_TUE, itemIds: [] })
    const w = r.warnings.find((x) => x.code === 'owned_elsewhere')
    expect(w.message).toMatch(/Testdoppel \(für Dienstag\)/)
    // Teig nur für Sonntag: 6 Brüche Doppel + 1 Bruch gemischt
    expect(r.machine.find((m) => m.id === 'test-weck-teig').kg).toBe(9.2)
    expect(r.bakeDates[2].lineCount).toBe(0)
  })
})

describe('R26 (Core): Backliste aus zwei Zetteln', () => {
  const sat = sheetV2(SAT)
  const tue = sheetV2(NEXT_TUE)
  const sources = [
    {
      doughDate: SAT,
      status: 'confirmed',
      lines: sat.lines,
      deltas: [
        {
          id: 1,
          itemId: 'test-doppel',
          variant: null,
          qty: 3,
          bakeDate: NEXT_TUE,
        },
        { id: 2, itemId: 'test-doppel', variant: null, qty: 1, bakeDate: SUN },
      ],
    },
    { doughDate: NEXT_TUE, status: 'draft', lines: tue.lines, deltas: [] },
  ]

  it('sammelt die Zeilen des Backtags mit Teigtag und Status, ohne Teigzahlen', () => {
    const list = core.bakeListFromLines(configV2(), NEXT_TUE, sources)
    expect(list.date).toBe(NEXT_TUE)
    expect(list.weekdayName).toBe('Dienstag')
    expect(list.sections.map((s) => s.id)).toEqual([
      'brot',
      'broetchen',
      'kaffeestueckchen',
    ])
    const doppel = list.sections[1].lines[0]
    expect(doppel).toMatchObject({
      itemId: 'test-doppel',
      total: 40,
      bakeDate: NEXT_TUE,
      doughDate: SAT,
      sheetStatus: 'confirmed',
      madeOn: 'Teig vom Samstag',
    })
    expect(list.sections[0].lines[0]).toMatchObject({
      itemId: 'test-korn',
      doughDate: NEXT_TUE,
      sheetStatus: 'draft',
      madeOn: 'Teig von heute',
    })
    // nur die Nachträge dieses Backtags
    expect(list.deltas).toEqual([
      {
        id: 1,
        itemId: 'test-doppel',
        variant: null,
        qty: 3,
        bakeDate: NEXT_TUE,
        doughDate: SAT,
      },
    ])
    expect(list.rolls).toHaveLength(1)
    expect(list.rolls[0]).toMatchObject({ bakeDate: NEXT_TUE, label: 'heute' })
    expect(list.rolls[0].groups.map((g) => [g.group, g.brueche])).toEqual([
      ['test-doppel', 4],
      ['test-gemischt', 1],
      ['test-flitweck', 1],
    ])
    expect(list).not.toHaveProperty('machine')
    expect(list).not.toHaveProperty('doughs')
    expect(list.warnings).toEqual([])
  })

  it('Sonntag: alles vom Samstag, der Sonntagszettel selbst ist leer', () => {
    const sun = sheetV2(SUN)
    const list = core.bakeListFromLines(configV2(), SUN, [
      sources[0],
      { doughDate: SUN, status: 'draft', lines: sun.lines },
    ])
    expect(list.sections.map((s) => s.lines.length)).toEqual([5])
    expect(list.deltas.map((d) => d.id)).toEqual([2])
  })

  it('steht ein Posten auf zwei Zetteln, sagt die Liste das', () => {
    const list = core.bakeListFromLines(configV2(), NEXT_TUE, [
      sources[0],
      {
        doughDate: NEXT_TUE,
        status: 'draft',
        lines: [
          {
            ...sat.lines.find((l) => l.key === `test-doppel|@${NEXT_TUE}`),
            key: 'test-doppel|',
            bakeDate: NEXT_TUE,
          },
        ],
      },
    ])
    expect(list.warnings.map((w) => w.code)).toEqual(['duplicate_bake_line'])
  })
})

describe('Review Z10 Runde 2: offene Grundmenge in Füllung und Hefeteig-Nachtrag', () => {
  /** v1-Stammdaten, Zopf gefüllt Mohn ohne Grundmenge am Samstag. */
  const openMohn = () => {
    const cfg = config()
    cfg.items.find((i) => i.id === 'zopf-gefuellt').base[6] = {
      nuss: 4,
      mohn: null,
    }
    return cfg
  }
  const zopfMohn = (qty) => ({
    productId: 'test-zopf-gefuellt',
    variant: 'mohn',
    qty,
    pickupDate: SAT,
  })

  it('Füllungsbedarf mit offener Grundmenge ist unvollständig - kein Rezept auf die Teilmenge', () => {
    const r = sheetV2(SAT, {
      config: openMohn(),
      catalog: PRODUCTS,
      preorderItems: [zopfMohn(3)],
    })
    const mohn = r.fillings.find((f) => f.id === 'mohn')
    // 3 Zopf × 400 g + 1 Kranz × 800 g sind bekannt - als Mindestmenge
    expect(mohn).toMatchObject({
      grams: 2000,
      missingFillingG: false,
      baseUnset: true,
      recipe: null,
    })
    expect(mohn.openItems).toEqual([expect.stringContaining('Zopf gefüllt')])
  })

  it('ohne bekannte Stück erscheint die Füllung trotzdem (offen), statt zu fehlen', () => {
    const cfg = openMohn()
    // Kranz Mohn auf 0: nur der offene Zopf hängt an der Füllung
    cfg.items.find((i) => i.id === 'kranz-gefuellt').base[6] = {
      nuss: 3,
      mohn: 0,
    }
    const r = sheetV2(SAT, { config: cfg, catalog: PRODUCTS })
    expect(r.fillings.find((f) => f.id === 'mohn')).toMatchObject({
      grams: 0,
      baseUnset: true,
      recipe: null,
    })
    // computeDay (v1-Form) bleibt wie vor Z10: ohne Stück keine Füllung
    const v1 = core.computeDay({ config: cfg, date: SAT, recipes: RECIPES })
    expect(v1.fillings.find((f) => f.id === 'mohn')).toBeUndefined()
  })

  it('Hefeteig-Nachtrag bei unvollständigem Teig: Zusatzteig aus Stück × Gramm, Gesamt nur Mindestmenge', () => {
    const dayCore = require('../../src/services/backzettel-day.core')
    const args = { config: openMohn(), catalog: PRODUCTS }
    const before = sheetV2(SAT, args)
    const after = sheetV2(SAT, {
      ...args,
      preorderItems: [
        {
          productId: 'test-kranz-gefuellt',
          variant: 'nuss',
          qty: 2,
          pickupDate: SAT,
        },
      ],
    })
    expect(after.hefeteig.doughs[0].dough_g).toBeNull()
    const diff = dayCore.hefeteigFillingsDiff(before, after)
    const d = diff.doughs[0]
    // 2 Kränze × 2 Teigstücke × 600 g - bekannt, nie „+0 g“
    expect(d).toMatchObject({
      pieces: 4,
      dough_g: 2400,
      totalDough_g: null,
      totalPiecesComplete: false,
    })
    expect(d.totalPieces).toBe(after.hefeteig.doughs[0].pieces)
    expect(d.totalDoughKnown_g).toBeGreaterThan(0)
  })
})
