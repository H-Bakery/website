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

  it('der gefuellte Kranz ist einstellbar (Q-B3: hq-Notiz 1 × 1200 g, alter Code 3 × 600 g; Testwert 2 × 600 g)', () => {
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

describe('roundUp', () => {
  it('rundet Stueck auf ganze Zahlen und Liter auf Hundertstel, tolerant gegen Fliesskomma', () => {
    expect(core.roundUp(0.1 * 3 * 10, 'Stück')).toBe(3)
    expect(core.roundUp(2.01, 'Stück')).toBe(3)
    expect(core.roundUp(1.24 * 1.0, 'Liter')).toBe(1.24)
    expect(core.roundUp(1.241, 'Liter')).toBe(1.25)
    expect(core.roundUp(Number.NaN, 'Stück')).toBe(0)
  })
})
