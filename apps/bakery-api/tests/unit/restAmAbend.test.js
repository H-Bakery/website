/**
 * M4 „Rest am Abend“: die Regeln in `rest-am-abend.core.js`. Synthetische
 * Stammdaten (`tests/fixtures/backzettel.synthetic.js`), erfundene
 * Backzettel-Tage und Kassenberichte in einem Temp-Verzeichnis - nichts aus
 * dem privaten hq.
 *
 * Kalender: Di 2026-12-01 … So 2026-12-06, Mo 2026-12-07 Ruhetag,
 * Di 2026-12-08. „Heute“ ist meist Di 2026-12-08.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const core = require('../../src/services/rest-am-abend.core')
const configCore = require('../../src/services/backzettel-config.core')
const files = require('../../src/services/reports-files.core')
const fixture = require('../fixtures/backzettel.synthetic')
const grundmengen = require('../fixtures/backzettel-grundmengen.synthetic')

const config = configCore.normalizeConfig(fixture.config())
const catalog = fixture.PRODUCTS.map((p) => ({
  ...p,
  name: `Test ${p.id.replace('test-', '')}`,
}))
const item = (id) => config.items.find((i) => i.id === id)

const TODAY = '2026-12-08'

/** Ein Backzettel-Tag wie `GET /api/backzettel/:date` (nur was der Rest liest). */
function bzDay(status, lines, deltaTotals) {
  const bySection = new Map()
  for (const l of lines) {
    const id = l.section || item(l.itemId).section
    if (!bySection.has(id)) bySection.set(id, [])
    bySection.get(id).push({
      key: `${l.itemId}|${l.variant || ''}`,
      variant: null,
      cap: 0,
      name: item(l.itemId) ? item(l.itemId).name : l.itemId,
      unit: item(l.itemId) ? item(l.itemId).unit : 'Stück',
      section: id,
      delta: null,
      ...l,
    })
  }
  return {
    status,
    sections: [...bySection.entries()].map(([id, ls]) => ({
      id,
      label: id,
      lines: ls,
    })),
    ...(deltaTotals ? { deltaTotals } : {}),
  }
}

/** Gespeicherte Zählung (wie der Dienst sie liest). */
function row(itemId, qty, extra = {}) {
  const it = item(itemId)
  const rows = core.countRowsForItem(it, catalog)
  const r =
    rows.find((x) => x.productId === (extra.productId || rows[0].productId)) ||
    rows[0]
  return {
    itemId,
    variant: '',
    productId: r.productId,
    name: r.label,
    itemName: it.name,
    unit: r.unit,
    itemUnit: it.unit,
    factor: r.factor,
    qty,
    countedAt: '2026-12-01T17:00:00.000Z',
    countedBy: { id: 7, displayName: 'Test Verkauf' },
    revision: 1,
    ...extra,
  }
}

describe('countRowsForItem', () => {
  it('zählt je hq-Produkt in Stück, mit dem Faktor des Backzettels', () => {
    expect(core.countRowsForItem(item('kranz'), catalog)).toEqual([
      {
        productId: 'test-kranz',
        label: 'Test kranz',
        unit: 'Stück',
        factor: 1,
        integer: true,
        step: 1,
      },
      {
        productId: 'test-kranz-viertel',
        label: 'Test kranz-viertel',
        unit: 'Stück',
        factor: 0.25,
        integer: true,
        step: 1,
      },
    ])
  })

  it('zählt Brot je Laib, umgerechnet in Liter', () => {
    const [r] = core.countRowsForItem(item('kornbrot'), catalog)
    expect(r).toMatchObject({
      productId: 'test-kornbrot',
      unit: 'Stück',
      factor: 0.5,
    })
  })

  it('zählt einen Liter-Posten ohne Produkt in Liter (halbe Schritte)', () => {
    expect(core.countRowsForItem(item('vollkorn'), catalog)).toEqual([
      {
        productId: '',
        label: 'Vollkornbrot',
        unit: 'Liter',
        factor: 1,
        integer: false,
        step: 0.5,
      },
    ])
  })

  it('zählt einen Liter-Posten mit pieces_per_liter ohne Produkt in Laiben', () => {
    const it = { ...item('vollkorn'), pieces_per_liter: 4 }
    expect(core.countRowsForItem(it, catalog)[0]).toMatchObject({
      unit: 'Stück',
      factor: 0.25,
      integer: true,
    })
  })

  it('nimmt den Postennamen, wenn das einzige Produkt keinen Namen hat', () => {
    expect(core.countRowsForItem(item('weck'), [])[0].label).toBe('Weck')
  })
})

describe('parseQty', () => {
  const stueck = { unit: 'Stück', integer: true }
  const liter = { unit: 'Liter', integer: false }
  it('liest Zahlen und Text mit Komma', () => {
    expect(core.parseQty(3, stueck)).toEqual({ ok: true, value: 3 })
    expect(core.parseQty('1,5', liter)).toEqual({ ok: true, value: 1.5 })
    expect(core.parseQty(' 2 ', stueck)).toEqual({ ok: true, value: 2 })
  })
  it('null/leer heißt nicht gezählt, 0 heißt nichts übrig', () => {
    expect(core.parseQty(null, stueck)).toEqual({ ok: true, value: null })
    expect(core.parseQty('', stueck)).toEqual({ ok: true, value: null })
    expect(core.parseQty(0, stueck)).toEqual({ ok: true, value: 0 })
  })
  it('lehnt Unsinn ab statt ihn zu 0 zu machen', () => {
    for (const bad of ['abc', -1, '−1', NaN, Infinity, true, {}, '1e3']) {
      expect(core.parseQty(bad, stueck).ok).toBe(false)
    }
    expect(core.parseQty(10001, stueck).message).toMatch(/höchstens 10000/)
    expect(core.parseQty(1.5, stueck, 'Weck').message).toBe(
      '„Weck“: Die Menge 1,5 muss in Stück ganzzahlig sein.'
    )
    expect(core.parseQty(1.234, liter).ok).toBe(false)
  })
})

describe('validateBatch', () => {
  const v = (items) => core.validateBatch({ items }, { config, catalog })
  it('nimmt gültige Zählzeilen mit Snapshot an', () => {
    const r = v([
      { itemId: 'kornbrot', productId: 'test-kornbrot', qty: 3 },
      {
        itemId: 'zopf-gefuellt',
        variant: 'nuss',
        productId: 'test-zopf-gefuellt',
        qty: 0,
      },
      { itemId: 'vollkorn', qty: '1,5', expected: null },
    ])
    expect(r.ok).toBe(true)
    expect(r.entries[0]).toMatchObject({
      key: 'kornbrot||test-kornbrot',
      qty: 3,
      unit: 'Stück',
      factor: 0.5,
      itemUnit: 'Liter',
      hasExpected: false,
    })
    expect(r.entries[1]).toMatchObject({ variant: 'nuss', qty: 0 })
    expect(r.entries[2]).toMatchObject({
      productId: '',
      qty: 1.5,
      hasExpected: true,
      expected: null,
    })
  })
  it.each([
    [{ itemId: 'gibtsnicht', qty: 1 }, 'unknown_item'],
    [
      { itemId: 'weck', productId: 'test-weck', variant: 'nuss', qty: 1 },
      'unknown_variant',
    ],
    [{ itemId: 'kranz', productId: 'test-weck', qty: 1 }, 'unknown_product'],
    [{ itemId: 'kranz', qty: 1 }, 'unknown_product'],
    [
      { itemId: 'weck', productId: 'test-weck', qty: 'abc' },
      'invalid_quantity',
    ],
    [{ itemId: 'weck', productId: 'test-weck', qty: 2.5 }, 'invalid_quantity'],
  ])('lehnt %j ab (%s)', (entry, error) => {
    const r = v([entry])
    expect(r).toMatchObject({ ok: false, status: 400, error })
    expect(typeof r.message).toBe('string')
  })
  it('ein Posten mit Sorten braucht die Sorte (wie bei Vorbestellungen)', () => {
    const e = { itemId: 'zopf-gefuellt', productId: 'test-zopf-gefuellt' }
    expect(v([{ ...e, qty: 1 }])).toMatchObject({
      ok: false,
      status: 400,
      error: 'variant_required',
    })
    // Löschen einer Zählung ohne Sorte geht immer (Altbestand).
    expect(v([{ ...e, qty: null }]).ok).toBe(true)
    // Führt der Backzettel des Tages den Posten ohne Sorte, ist es eine Zeile.
    expect(
      core.validateBatch(
        { items: [{ ...e, qty: 1 }] },
        { config, catalog, emptyVariantItems: new Set(['zopf-gefuellt']) }
      ).ok
    ).toBe(true)
    expect(
      core.emptyVariantCandidates(
        {
          items: [
            { ...e, qty: 1 },
            { ...e, variant: 'nuss', qty: 1 },
            { itemId: 'weck', qty: 1 },
          ],
        },
        config
      )
    ).toEqual(new Set(['zopf-gefuellt']))
    expect(
      core.emptyVariantLines(
        bzDay('confirmed', [
          { itemId: 'zopf-gefuellt', variant: 'nuss', total: 2 },
          { itemId: 'zopf-gefuellt', total: 1 },
          { itemId: 'weck', total: 5 },
        ]),
        config
      )
    ).toEqual(new Set(['zopf-gefuellt', 'weck']))
  })
  it('lehnt doppelte Zeilen, leere und übergroße Listen ab', () => {
    const e = { itemId: 'weck', productId: 'test-weck', qty: 1 }
    expect(v([e, { ...e, qty: 2 }])).toMatchObject({ error: 'duplicate_item' })
    expect(v([])).toMatchObject({ error: 'validation' })
    expect(core.validateBatch({}, { config })).toMatchObject({
      error: 'validation',
    })
    expect(core.validateBatch(null, { config })).toMatchObject({
      error: 'validation',
    })
  })
  it('lässt Vorbereitungs-Posten nicht zählen', () => {
    const cfg = configCore.normalizeConfig(
      fixture.config({
        items: [
          ...fixture.config().items,
          {
            id: 'sauer',
            name: 'Sauerteig',
            section: 'vorbereitung',
            unit: 'Liter',
            base: {},
          },
        ],
      })
    )
    expect(
      core.validateBatch(
        { items: [{ itemId: 'sauer', qty: 1 }] },
        { config: cfg }
      )
    ).toMatchObject({ error: 'not_countable' })
  })
})

describe('planBatch', () => {
  const entries = core.validateBatch(
    {
      items: [
        { itemId: 'weck', productId: 'test-weck', qty: 5, expected: 3 },
        { itemId: 'plunder', productId: 'test-plunder', qty: 2 },
        { itemId: 'schnecke', qty: null },
      ],
    },
    { config, catalog }
  ).entries
  it('rechnet von → nach und überspringt, was schon dasteht', () => {
    const stored = [
      { itemId: 'weck', variant: '', productId: 'test-weck', qty: 3 },
      { itemId: 'plunder', variant: '', productId: 'test-plunder', qty: 2 },
      { itemId: 'schnecke', variant: '', productId: '', qty: 1 },
    ]
    const plan = core.planBatch(entries, stored)
    expect(plan.conflicts).toEqual([])
    expect(plan.changes.map((c) => [c.entry.itemId, c.from, c.to])).toEqual([
      ['weck', 3, 5],
      ['schnecke', 1, null],
    ])
  })
  it('meldet einen Konflikt, wenn ein anderer Wert gespeichert wurde', () => {
    const stored = [
      { itemId: 'weck', variant: '', productId: 'test-weck', qty: 4 },
    ]
    const plan = core.planBatch(entries, stored)
    expect(plan.conflicts.map((c) => c.entry.itemId)).toEqual(['weck'])
  })
  it('kein Konflikt, wenn der Wunschwert schon gespeichert ist', () => {
    const stored = [
      { itemId: 'weck', variant: '', productId: 'test-weck', qty: 5 },
    ]
    expect(core.planBatch(entries, stored).conflicts).toEqual([])
  })
})

describe('backzettelLines', () => {
  it('gebacken = Gesamt + quittierte Nachträge (nach dem Aufrunden), ohne Vorbereitung', () => {
    const day = bzDay(
      'confirmed',
      [
        { itemId: 'weck', total: 40, cap: 10 },
        {
          itemId: 'kranz',
          total: 2,
          delta: { qty: 1.5, openQty: 0.25, bake: 2, bakeOpen: 1 },
        },
        { itemId: 'sauer', section: 'vorbereitung', total: 3 },
      ],
      {
        'kranz|': { qty: 1.5, openQty: 0.25, bake: 2, bakeOpen: 1 },
        'plunder|': { qty: 3, openQty: 0, bake: 3, bakeOpen: 0 },
      }
    )
    const lines = core.backzettelLines(day, config)
    expect(lines.get('weck|')).toMatchObject({
      baked: 40,
      cap: 10,
      confirmed: true,
    })
    expect(lines.get('kranz|').baked).toBe(3) // 2 + (2 − 1)
    expect(lines.get('plunder|')).toMatchObject({ baked: 3, planned: 0 })
    expect(lines.has('sauer|')).toBe(false)
  })
  it('ältere Server ohne bake: Summe minus offene Menge', () => {
    expect(core.acknowledgedExtra({ qty: 4, openQty: 1 })).toBe(3)
    expect(core.acknowledgedExtra(null)).toBe(0)
  })
  it('ein Entwurf hat nur „geplant“', () => {
    const lines = core.backzettelLines(
      bzDay('draft', [{ itemId: 'weck', total: 40 }]),
      config
    )
    expect(lines.get('weck|')).toMatchObject({ planned: 40, baked: null })
  })
})

describe('buildDayView', () => {
  const base = {
    date: '2026-12-08',
    today: TODAY,
    config,
    catalog,
  }
  it('listet die Zeilen des Backzettels mit Zählzeilen und rechnet den Rest um', () => {
    const view = core.buildDayView({
      ...base,
      backzettel: bzDay('confirmed', [
        { itemId: 'kornbrot', total: 4 },
        { itemId: 'weck', total: 40 },
        { itemId: 'kranz', total: 2 },
        { itemId: 'schnecke', total: 0 },
      ]),
      rows: [
        row('kornbrot', 3, { factor: 0.5 }),
        row('kranz', 1, { productId: 'test-kranz', factor: 1 }),
        row('kranz', 2, {
          productId: 'test-kranz-viertel',
          factor: 0.25,
          name: 'Test kranz-viertel',
        }),
      ],
    })
    expect(view).toMatchObject({
      status: 'ok',
      backzettelStatus: 'confirmed',
      editable: true,
      editIssue: null,
      weekdayName: 'Dienstag',
    })
    expect(view.lines.map((l) => l.itemId)).toEqual([
      'kornbrot',
      'weck',
      'kranz',
    ])
    const korn = view.lines[0]
    expect(korn).toMatchObject({
      baked: 4,
      counted: true,
      rest: 1.5,
      unit: 'Liter',
    })
    expect(korn.rows[0]).toMatchObject({
      qty: 3,
      countedBy: { displayName: 'Test Verkauf' },
    })
    expect(view.lines[1]).toMatchObject({ counted: false, rest: null })
    expect(view.lines[2]).toMatchObject({ counted: true, rest: 1.5 })
    expect(view.summary).toMatchObject({
      lines: 3,
      countedLines: 2,
      rows: 4,
      countedRows: 3,
      lastCountedBy: { id: 7, displayName: 'Test Verkauf' },
    })
  })
  it('behält Zählungen zu Produkten, die die Config nicht mehr kennt', () => {
    const view = core.buildDayView({
      ...base,
      backzettel: null,
      rows: [
        row('weck', 4, {
          productId: 'test-alt',
          name: 'Alter Weck',
          factor: 1,
        }),
      ],
    })
    const line = view.lines[0]
    expect(line.rows.map((r) => [r.productId, r.stale, r.qty])).toEqual([
      ['test-weck', false, null],
      ['test-alt', true, 4],
    ])
    expect(line.counted).toBe(false)
    expect(line.restSoFar).toBe(4)
  })
  it('sagt, warum nicht gezählt werden kann', () => {
    expect(
      core.buildDayView({
        ...base,
        date: '2026-12-09',
        backzettel: null,
        rows: [],
      })
    ).toMatchObject({
      editable: false,
      editIssue: expect.stringMatching(/Zukunft/),
    })
    expect(
      core.buildDayView({
        ...base,
        date: '2026-11-30',
        backzettel: null,
        rows: [],
      })
    ).toMatchObject({ status: 'ruhetag', editable: false })
    expect(
      core.buildDayView({
        ...base,
        date: '2026-11-24',
        backzettel: null,
        rows: [],
      })
    ).toMatchObject({
      editable: false,
      editIssue: expect.stringMatching(/7 Tage/),
    })
    expect(
      core.buildDayView({ ...base, config: null, backzettel: null, rows: [] })
    ).toMatchObject({ status: 'no-config', editable: false })
  })
})

describe('parseRange', () => {
  it('Standard: die letzten 28 Tage bis heute', () => {
    expect(core.parseRange({}, TODAY)).toEqual({
      ok: true,
      from: '2026-11-11',
      to: TODAY,
    })
  })
  it('prüft Datum, Reihenfolge und Länge', () => {
    expect(core.parseRange({ from: 'x' }, TODAY)).toMatchObject({
      error: 'invalid_date',
    })
    expect(
      core.parseRange({ from: '2026-02-30', to: '2026-03-01' }, TODAY)
    ).toMatchObject({ error: 'invalid_date' })
    expect(
      core.parseRange({ from: '2026-12-02', to: '2026-12-01' }, TODAY)
    ).toMatchObject({ error: 'invalid_range' })
    expect(
      core.parseRange({ from: '2020-01-01', to: TODAY }, TODAY)
    ).toMatchObject({ status: 400, error: 'range_too_large' })
    expect(core.parseRange({ from: ['a', 'b'] }, TODAY)).toMatchObject({
      error: 'invalid_range',
    })
  })
})

describe('summarize', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-core-'))
    fs.mkdirSync(path.join(dir, 'converted'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  function report(date, items) {
    fs.writeFileSync(
      path.join(dir, 'converted', `${date}_90000001.json`),
      JSON.stringify(grundmengen.convertedReport(date, [{ items }]))
    )
    return files.readDailyReport(dir, date)
  }

  function run(days, from = '2026-12-01', to = '2026-12-08', today = TODAY) {
    return core.summarize({ from, to, today, config, catalog, days })
  }

  it('rechnet Rest ÷ (gebacken − CAP) über gezählte Tage; Lücken zählen nicht als 0', () => {
    const s = run({
      // Di: alles gezählt
      '2026-12-01': {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 10 },
          { itemId: 'weck', total: 50, cap: 10 },
        ]),
        rows: [row('plunder', 1), row('weck', 4)],
        report: report('2026-12-01', [[906, 8]]),
      },
      // Mi: freigegeben, nichts gezählt → Lücke
      '2026-12-02': {
        backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
        rows: [],
        report: null,
      },
      // Do: nur Plunder gezählt
      '2026-12-03': {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 10 },
          { itemId: 'weck', total: 40 },
        ]),
        rows: [row('plunder', 0)],
        report: null,
      },
      // Fr: gezählt, aber Backzettel nicht freigegeben
      '2026-12-04': {
        backzettel: bzDay('draft', [{ itemId: 'plunder', total: 10 }]),
        rows: [row('plunder', 5)],
        report: null,
      },
    })
    const plunder = s.items.find((i) => i.itemId === 'plunder')
    expect(plunder).toMatchObject({
      days: 2,
      baked: 20,
      shopBaked: 20,
      rest: 1,
      rate: 0.05,
      sold: 8,
      soldDays: 1,
      soldStatus: 'partial',
      soldConverted: true,
      uncountedDays: 1,
      uncountedDates: ['2026-12-02'],
    })
    const weck = s.items.find((i) => i.itemId === 'weck')
    expect(weck).toMatchObject({
      days: 1,
      baked: 50,
      cap: 10,
      shopBaked: 40,
      rest: 4,
      rate: 0.1,
      soldStatus: 'no_plu',
      uncountedDates: ['2026-12-03'],
    })
    expect(s.days.map((d) => d.status)).toEqual([
      'counted', // Di
      'not_counted', // Mi
      'partial', // Do
      'counted_without_backzettel', // Fr
      'no_backzettel', // Sa
      'no_backzettel', // So
      'ruhetag', // Mo
      'no_backzettel', // Di (heute)
    ])
    expect(s.counts).toMatchObject({
      counted: 1,
      partial: 1,
      notCounted: 1,
      ruhetag: 1,
    })
    expect(s.days[0].byUnit['Stück']).toEqual({
      shopBaked: 50,
      rest: 5,
      rate: 0.1,
    })
    expect(s.totals).toEqual([
      {
        unit: 'Stück',
        items: 2,
        baked: 70,
        cap: 10,
        shopBaked: 60,
        rest: 5,
        rate: 0.0833,
      },
    ])
    expect(plunder.weeks).toEqual([
      { week: '2026-W49', days: 2, shopBaked: 20, rest: 1, rate: 0.05 },
    ])
  })

  it('Sorten und Produkte eines Postens: erst je Zeile, dann je Posten', () => {
    const s = run({
      '2026-12-05': {
        backzettel: bzDay('confirmed', [
          { itemId: 'zopf-gefuellt', variant: 'nuss', total: 4 },
          { itemId: 'zopf-gefuellt', variant: 'mohn', total: 2 },
          { itemId: 'kranz', total: 4 },
        ]),
        rows: [
          row('zopf-gefuellt', 1, { variant: 'nuss' }),
          row('zopf-gefuellt', 0, { variant: 'mohn' }),
          row('kranz', 1, { productId: 'test-kranz', factor: 1 }),
          row('kranz', 2, { productId: 'test-kranz-viertel', factor: 0.25 }),
        ],
        report: null,
      },
    })
    const zopf = s.items.find((i) => i.itemId === 'zopf-gefuellt')
    expect(zopf).toMatchObject({ baked: 6, rest: 1, rate: 0.1667 })
    expect(zopf.variants).toEqual([
      {
        variant: 'nuss',
        label: 'Nussfüllung',
        baked: 4,
        cap: 0,
        rest: 1,
        rate: 0.25,
      },
      {
        variant: 'mohn',
        label: 'Mohnfüllung',
        baked: 2,
        cap: 0,
        rest: 0,
        rate: 0,
      },
    ])
    expect(s.items.find((i) => i.itemId === 'kranz')).toMatchObject({
      rest: 1.5,
      rate: 0.375,
    })
  })

  it('mehr Rest als für den Laden gebacken wird markiert, nicht verschluckt', () => {
    const s = run({
      '2026-12-05': {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 10 },
          { itemId: 'weck', total: 20, cap: 10 },
        ]),
        rows: [row('plunder', 3), row('weck', 11)],
        report: null,
      },
    })
    expect(s.items.find((i) => i.itemId === 'weck').restExceedsDates).toEqual([
      '2026-12-05',
    ])
    expect(
      s.items.find((i) => i.itemId === 'plunder').restExceedsDates
    ).toEqual([])
    const view = core.buildDayView({
      date: '2026-12-05',
      today: TODAY,
      config,
      catalog,
      backzettel: bzDay('confirmed', [{ itemId: 'weck', total: 20, cap: 10 }]),
      rows: [row('weck', 11)],
    })
    expect(view.lines[0]).toMatchObject({ rest: 11, restExceedsShop: true })
    expect(core.restExceedsShop(10, 20, 10)).toBe(false)
    expect(core.restExceedsShop(null, 20, 10)).toBe(false)
    expect(core.restExceedsShop(5, null, 0)).toBe(false)
  })

  it('ein Posten mit nur einem gezählten Produkt ist unvollständig', () => {
    const s = run({
      '2026-12-05': {
        backzettel: bzDay('confirmed', [{ itemId: 'kranz', total: 4 }]),
        rows: [row('kranz', 1, { productId: 'test-kranz', factor: 1 })],
        report: null,
      },
    })
    expect(s.items[0]).toMatchObject({ days: 0, rate: null, uncountedDays: 1 })
    expect(s.days.find((d) => d.date === '2026-12-05').status).toBe('partial')
  })

  it('Liter-Posten bleiben in Litern und haben eine eigene Summe', () => {
    const s = run({
      '2026-12-01': {
        backzettel: bzDay('confirmed', [{ itemId: 'kornbrot', total: 4 }]),
        rows: [row('kornbrot', 2, { factor: 0.5 })],
        report: report('2026-12-01', [[908, 4]]),
      },
    })
    expect(s.items[0]).toMatchObject({
      unit: 'Liter',
      rest: 1,
      rate: 0.25,
      soldStatus: 'no_plu',
    })
    expect(s.totals).toEqual([
      {
        unit: 'Liter',
        items: 1,
        baked: 4,
        cap: 0,
        shopBaked: 4,
        rest: 1,
        rate: 0.25,
      },
    ])
  })

  it('Zukunft ist keine Lücke', () => {
    const s = run({}, '2026-12-08', '2026-12-09')
    expect(s.days.map((d) => d.status)).toEqual(['no_backzettel', 'future'])
  })

  it('CSV: Semikolon, deutsche Zahlen, Formel-Zellen entschärft', () => {
    const cfg = configCore.normalizeConfig(
      fixture.config({
        items: fixture
          .config()
          .items.map((i) =>
            i.id === 'plunder' ? { ...i, name: '=HYPERLINK("x")' } : i
          ),
      })
    )
    const s = core.summarize({
      from: '2026-12-01',
      to: '2026-12-01',
      today: TODAY,
      config: cfg,
      catalog,
      days: {
        '2026-12-01': {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 8 }]),
          rows: [row('plunder', 1)],
          report: null,
        },
      },
    })
    const csv = core.summaryCsv(s)
    expect(csv).toContain('Rest am Abend - Auswertung')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(';8;0;8;;1;12,5%;0')
    expect(csv.split('\r\n').length).toBeGreaterThan(10)
  })
})

describe('weekdayRestAverages', () => {
  it('mittelt über die letzten gleichen Wochentage mit vollständiger Zählung', () => {
    const rowsByDate = {
      '2026-12-01': [
        row('plunder', 2),
        row('kranz', 1, { productId: 'test-kranz', factor: 1 }),
      ],
      '2026-11-24': [row('plunder', 4)],
      '2026-11-17': [],
      '2026-11-10': [row('plunder', 0)],
    }
    const confirmed = bzDay('confirmed', [{ itemId: 'plunder', total: 10 }])
    const backzettelByDate = {
      '2026-12-01': confirmed,
      '2026-11-24': confirmed,
      '2026-11-17': confirmed,
      '2026-11-10': confirmed,
    }
    const [tue] = core.weekdayRestAverages({
      config,
      catalog,
      today: TODAY,
      weeks: 6,
      weekdays: [2],
      rowsByDate,
      backzettelByDate,
    })
    expect(tue.weekdayName).toBe('Dienstag')
    expect(tue.items).toEqual([
      {
        itemId: 'plunder',
        mean: 2,
        samples: [2, 4, 0],
        dates: ['2026-12-01', '2026-11-24', '2026-11-10'],
      },
    ])
  })
})

describe('weekdayRestAverages - wie die Auswertung vollständig', () => {
  const sat = (rows, backzettel) =>
    core.weekdayRestAverages({
      config,
      catalog,
      today: TODAY,
      weeks: 6,
      weekdays: [6],
      rowsByDate: { '2026-12-05': rows },
      backzettelByDate: backzettel ? { '2026-12-05': backzettel } : {},
    })[0].items

  it('eine gebackene, aber nicht gezählte Sorte macht den Tag unbrauchbar', () => {
    const bz = bzDay('confirmed', [
      { itemId: 'zopf-gefuellt', variant: 'nuss', total: 4 },
      { itemId: 'zopf-gefuellt', variant: 'mohn', total: 2 },
    ])
    expect(sat([row('zopf-gefuellt', 1, { variant: 'nuss' })], bz)).toEqual([])
    expect(
      sat(
        [
          row('zopf-gefuellt', 1, { variant: 'nuss' }),
          row('zopf-gefuellt', 2, { variant: 'mohn' }),
        ],
        bz
      )
    ).toEqual([
      { itemId: 'zopf-gefuellt', mean: 3, samples: [3], dates: ['2026-12-05'] },
    ])
  })

  it('ohne freigegebenen Backzettel zählt der Tag nicht', () => {
    const rows = [row('plunder', 2)]
    expect(sat(rows, null)).toEqual([])
    expect(
      sat(rows, bzDay('draft', [{ itemId: 'plunder', total: 10 }]))
    ).toEqual([])
    expect(
      sat(rows, bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]))
    ).toHaveLength(1)
  })
})

describe('isoWeek', () => {
  it('rechnet ISO-Wochen über den Jahreswechsel', () => {
    expect(core.isoWeek('2026-12-28')).toBe('2026-W53')
    expect(core.isoWeek('2027-01-04')).toBe('2027-W01')
    expect(core.isoWeek('2026-12-01')).toBe('2026-W49')
  })
})
