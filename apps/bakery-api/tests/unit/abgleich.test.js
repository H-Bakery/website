/**
 * „Abgleich Produktion ↔ Kasse“: die Regeln in `abgleich.core.js`.
 * Synthetische Stammdaten (`tests/fixtures/backzettel.synthetic.js`),
 * erfundene Backzettel-Tage, Zählungen und Kassenberichte (Temp-Verzeichnis)
 * - nichts aus dem privaten hq.
 *
 * Kalender: Di 2026-12-01 … So 2026-12-06 Backtage, Mo 2026-12-07 Ruhetag.
 * „Heute“ ist Di 2026-12-08.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const core = require('../../src/services/abgleich.core')
const restCore = require('../../src/services/rest-am-abend.core')
const configCore = require('../../src/services/backzettel-config.core')
const kalender = require('../../src/services/kalender.core')
const files = require('../../src/services/reports-files.core')
const { aggregateDay } = require('../../src/services/reports.core')
const fixture = require('../fixtures/backzettel.synthetic')
const grundmengen = require('../fixtures/backzettel-grundmengen.synthetic')

const TODAY = '2026-12-08'
const TUE = '2026-12-01'
const WED = '2026-12-02'
const THU = '2026-12-03'

/**
 * Stammdaten mit Kassennummern: Plunder (906, Stück), Kranz gefüllt mit
 * Sorten und Viertel-Produkt (902/903, Faktor 1 und 0,25), Vollkorn mit
 * einer Kassennummer ohne eigenes Produkt (909 → nicht umrechenbar),
 * Schnecke (Stück, ohne Produkt, 990 → Stück gegen Stück) und Kranz
 * (Produkte ganz und Viertel, 991 ohne Produkt → nicht umrechenbar).
 */
function baseConfig(extra = {}) {
  const raw = fixture.config(extra)
  raw.items = raw.items.map((i) =>
    i.id === 'kranz-gefuellt'
      ? { ...i, plu: [902, 903] }
      : i.id === 'vollkorn'
      ? { ...i, plu: [909] }
      : i.id === 'schnecke'
      ? { ...i, plu: [990] }
      : i.id === 'kranz'
      ? { ...i, plu: [991] }
      : i
  )
  return configCore.normalizeConfig(raw)
}

const config = baseConfig()
const catalog = fixture.PRODUCTS.map((p) => ({
  ...p,
  name: `Test ${p.id.replace('test-', '')}`,
}))
const item = (id, cfg = config) => cfg.items.find((i) => i.id === id)

/** Eine Backliste wie `getBakeLines` (nur was der Abgleich liest). */
function bzDay(status, lines, cfg = config) {
  const bySection = new Map()
  for (const l of lines) {
    const it = item(l.itemId, cfg)
    const id = it.section
    if (!bySection.has(id)) bySection.set(id, [])
    bySection.get(id).push({
      key: `${l.itemId}|${l.variant || ''}`,
      variant: l.variant || null,
      cap: 0,
      name: it.name,
      unit: it.unit || 'Stück',
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
  }
}

/** Eine gespeicherte Zählung je Produkt (wie der Dienst sie liest). */
function row(itemId, qty, extra = {}, cfg = config, cat = catalog) {
  const it = item(itemId, cfg)
  const variant = extra.variant || ''
  const rows = restCore.countRowsForItem(it, cat, variant)
  const r =
    rows.find((x) => x.productId === (extra.productId || rows[0].productId)) ||
    rows[0]
  return {
    itemId,
    variant,
    productId: r.productId,
    name: r.label,
    itemName: it.name,
    unit: r.unit,
    itemUnit: it.unit || 'Stück',
    factor: r.factor,
    qty,
    lineRows: rows.map((x) => x.productId),
    revision: 1,
    ...extra,
  }
}

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abgleich-core-'))
  fs.mkdirSync(path.join(dir, 'converted'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

/** Ein erfundener Kassenbericht, aggregiert wie im Dienst. */
function report(date, items) {
  fs.writeFileSync(
    path.join(dir, 'converted', `${date}_90000001.json`),
    JSON.stringify(grundmengen.convertedReport(date, [{ items }]))
  )
  return files.readDailyReport(dir, date)
}

function run(days, opts = {}) {
  return core.reconcile({
    from: opts.from || TUE,
    to: opts.to || TUE,
    today: TODAY,
    config: opts.config || config,
    catalog: opts.catalog || catalog,
    days,
  })
}

const posten = (s, key) =>
  s.items.find((p) => p.key === key) || s.unmatched.find((p) => p.key === key)

describe('parseRange', () => {
  it('nimmt ohne Angabe die letzten 7 Backtage vor heute (Ruhetage zählen nicht)', () => {
    // bis Mo 07.12. (Ruhetag), zurück über So…Di (6 Backtage), Mo 30.11.
    // Ruhetag, So 29.11. ist der siebte.
    expect(core.parseRange({}, TODAY, config)).toEqual({
      ok: true,
      from: '2026-11-29',
      to: '2026-12-07',
    })
  })

  it('nimmt from/to wie angegeben', () => {
    expect(core.parseRange({ from: TUE, to: THU }, TODAY, config)).toEqual({
      ok: true,
      from: TUE,
      to: THU,
    })
  })

  it('meldet Fehler deutsch mit Code', () => {
    expect(core.parseRange({ from: 'gestern' }, TODAY, config)).toMatchObject({
      ok: false,
      status: 400,
      error: 'invalid_date',
    })
    expect(
      core.parseRange({ from: THU, to: TUE }, TODAY, config)
    ).toMatchObject({ ok: false, error: 'invalid_range' })
    expect(core.parseRange({ from: [TUE, WED] }, TODAY, config)).toMatchObject({
      ok: false,
      error: 'invalid_range',
    })
    const tooLong = core.parseRange(
      { from: '2026-10-01', to: '2026-12-07' },
      TODAY,
      config
    )
    expect(tooLong).toMatchObject({ ok: false, error: 'range_too_large' })
    expect(tooLong.message).toMatch(/höchstens 62 Tage/)
  })
})

describe('classify (Ampel, vorläufige Schwellen)', () => {
  it('ok bis max(1 Stück, 5 %), auffällig bis 15 %, sonst prüfen', () => {
    expect(core.classify(5, 100, 1)).toBe('ok')
    expect(core.classify(-5, 100, 1)).toBe('ok')
    expect(core.classify(6, 100, 1)).toBe('auffaellig')
    expect(core.classify(15, 100, 1)).toBe('auffaellig')
    expect(core.classify(16, 100, 1)).toBe('pruefen')
    // wenig gebacken: 1 Stück Spielraum
    expect(core.classify(1, 10, 1)).toBe('ok')
    expect(core.classify(1.5, 10, 1)).toBe('auffaellig')
    expect(core.classify(2, 10, 1)).toBe('pruefen')
    // nichts gebacken, trotzdem verkauft
    expect(core.classify(-3, 0, 1)).toBe('pruefen')
    // 1 Stück eines Viertel-Produkts = 0,25
    expect(core.classify(0.25, 0, 0.25)).toBe('ok')
    expect(core.classify(0.5, 0, 0.25)).toBe('pruefen')
  })
})

describe('reconcile', () => {
  it('freigegeben, gezählt: Ungeklärt = gebacken − CAP − verkauft − Rest', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 30, cap: 10 },
        ]),
        rows: [row('plunder', 2)],
        report: report(TUE, [[906, 15]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      status: 'vergleichbar',
      basis: 'freigegeben',
      baked: 30,
      cap: 10,
      shopBaked: 20,
      sold: 15,
      open: 5,
      rest: 2,
      unexplained: 3,
      ampel: 'auffaellig',
      ampelBasis: 'mit_rest',
      direction: 'fehlt',
      comparableDays: 1,
      restDays: 1,
    })
    expect(p.dayRows[0]).toMatchObject({
      status: 'ok',
      basis: 'freigegeben',
      restStatus: 'counted',
      unexplained: 3,
    })
    expect(s.basis).toBe('freigegeben')
    expect(s.counts).toMatchObject({ bakeDays: 1, confirmed: 1, planned: 0 })
  })

  it('CAP wird abgezogen - alles erklärt ist „ok“', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 30, cap: 10 },
        ]),
        rows: [row('plunder', 3)],
        report: report(TUE, [[906, 17]]),
      },
    })
    expect(posten(s, 'plunder')).toMatchObject({
      unexplained: 0,
      ampel: 'ok',
      direction: null,
    })
  })

  it('nicht freigegeben: rechnet mit dem geplanten Wert und sagt „geplant“', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('draft', [{ itemId: 'plunder', total: 10 }]),
        rows: [row('plunder', 1)],
        report: report(TUE, [[906, 9]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      basis: 'geplant',
      baked: 10,
      plannedDays: 1,
      unexplained: 0,
      ampel: 'ok',
    })
    expect(p.dayRows[0].basis).toBe('geplant')
    expect(s.basis).toBe('geplant')
    expect(s.days[0]).toMatchObject({ basis: 'geplant', report: true })
  })

  it('ohne Zählung: kein Ungeklärt, nur „nicht verkauft oder nicht kassiert“ - nie Rest 0', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
        rows: [],
        report: report(TUE, [[906, 12]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      open: 8,
      rest: null,
      unexplained: null,
      ampel: null,
      restDays: 0,
      comparableDays: 1,
    })
    expect(p.gaps.restMissing).toEqual([TUE])
    expect(p.dayRows[0]).toMatchObject({
      status: 'ohne_rest',
      restStatus: 'not_counted',
      rest: null,
    })
    expect(s.counts.restNotCounted).toBe(1)
  })

  it('ohne Zählung, aber mehr verkauft als gebacken: Signal auch ohne Rest', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
        rows: [],
        report: report(TUE, [[906, 14]]),
      },
    })
    expect(posten(s, 'plunder')).toMatchObject({
      open: -4,
      unexplained: null,
      ampel: 'pruefen',
      ampelBasis: 'ohne_rest',
      direction: 'mehr_verkauft',
    })
  })

  it('verkauft, aber nicht gebacken: eigene Zeile mit gebacken 0', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'weck', total: 40 }]),
        rows: [],
        report: report(TUE, [[906, 4]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      baked: 0,
      sold: 4,
      open: -4,
      ampel: 'pruefen',
      direction: 'mehr_verkauft',
    })
    expect(p.dayRows[0].restStatus).toBe('not_on_backzettel')
    // keine Zähllücke: der Posten stand nicht auf dem Backzettel
    expect(p.gaps.restMissing).toEqual([])
    expect(p.gaps.notOnBackzettel).toEqual([TUE])
    expect(core.abgleichCsv(s)).toMatch(
      new RegExp(`Plunder;Stück;freigegeben;.*;;;${TUE}$`, 'm')
    )
  })

  it('Sorten: teilweise gezählt ist kein Rest; Kasse über alle Sorten, mit Faktor umgerechnet', () => {
    const kranz = (variant, whole, quarter) => [
      row('kranz-gefuellt', whole, {
        variant,
        productId: 'test-kranz-gefuellt',
      }),
      row('kranz-gefuellt', quarter, {
        variant,
        productId: 'test-kranz-gefuellt-viertel',
      }),
    ]
    const bz = bzDay('confirmed', [
      { itemId: 'kranz-gefuellt', variant: 'nuss', total: 3 },
      { itemId: 'kranz-gefuellt', variant: 'mohn', total: 2 },
    ])
    // 3 ganze + 4 Viertel = 4 Kränze verkauft
    const partial = run({
      [TUE]: {
        backzettel: bz,
        rows: kranz('nuss', 0, 2),
        report: report(TUE, [
          [902, 3],
          [903, 4],
        ]),
      },
    })
    const p = posten(partial, 'kranz-gefuellt')
    expect(p).toMatchObject({
      converted: true,
      tolerance: 0.25,
      baked: 5,
      sold: 4,
      open: 1,
      rest: null,
      unexplained: null,
    })
    expect(p.gaps.restPartial).toEqual([TUE])
    expect(p.dayRows[0].restStatus).toBe('partial')
    expect(p.variants.map((v) => v.label)).toEqual([
      'Nussfüllung',
      'Mohnfüllung',
    ])

    const full = run({
      [TUE]: {
        backzettel: bz,
        rows: [...kranz('nuss', 0, 2), ...kranz('mohn', 0, 0)],
        report: report(TUE, [
          [902, 3],
          [903, 4],
        ]),
      },
    })
    expect(posten(full, 'kranz-gefuellt')).toMatchObject({
      rest: 0.5,
      unexplained: 0.5,
      // 0,5 Kranz bei 5 gebacken: über 1 Stück (0,25) und 5 %, unter 15 %
      ampel: 'auffaellig',
    })
  })

  it('nicht umrechenbar: „nicht vergleichbar (Einheit)“, getrennt aufgeführt', () => {
    const s = run(
      {
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'vollkorn', total: 2 }]),
          rows: [],
          report: report(WED, [[909, 3]]),
        },
      },
      { from: WED, to: WED }
    )
    expect(s.items.find((p) => p.key === 'vollkorn')).toBeUndefined()
    expect(posten(s, 'vollkorn')).toMatchObject({
      status: 'einheit',
      converted: false,
      unexplained: null,
      ampel: null,
      allBaked: 2,
      soldPieces: 3,
    })
  })

  it('Stück-Posten mit Produkten zu je einem Stück: Kasse zählt dasselbe, auch ohne Zuordnung', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'schnecke', total: 6 }]),
        rows: [row('schnecke', 1)],
        report: report(TUE, [[990, 5]]),
      },
    })
    expect(posten(s, 'schnecke')).toMatchObject({
      status: 'vergleichbar',
      converted: true,
      soldBasis: 'stueck',
      sold: 5,
      unexplained: 0,
      ampel: 'ok',
    })
    expect(posten(s, 'plunder')).toBeUndefined()
  })

  it('Posten mit Teil-Produkten (Viertel) ohne Zuordnung bleibt nicht vergleichbar', () => {
    const s = run(
      {
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'kranz', total: 2 }]),
          rows: [],
          report: report(WED, [[991, 4]]),
        },
      },
      { from: WED, to: WED }
    )
    expect(posten(s, 'kranz')).toMatchObject({
      status: 'einheit',
      soldBasis: null,
      soldPieces: 4,
    })
  })

  it('ohne vergleichbaren Tag zeigt gebacken die Tage ohne Bericht', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('draft', [{ itemId: 'plunder', total: 12 }]),
        rows: [],
        report: null,
      },
    })
    expect(posten(s, 'plunder')).toMatchObject({
      comparableDays: 0,
      baked: 12,
      sold: null,
      open: null,
    })
  })

  it('ohne Kassennummer: „keine Kassennummer“, getrennt aufgeführt', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [
          { itemId: 'weck', total: 50, cap: 12 },
        ]),
        rows: [row('weck', 4)],
        report: report(TUE, []),
      },
    })
    expect(s.items).toHaveLength(0)
    expect(posten(s, 'weck')).toMatchObject({
      status: 'keine_plu',
      allBaked: 50,
      allCap: 12,
      plu: [],
      ampel: null,
    })
  })

  it('ohne Kassenbericht: eine Lücke, nie 0', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
          rows: [row('plunder', 1)],
          report: report(TUE, [[906, 9]]),
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
          rows: [row('plunder', 2)],
          report: null,
        },
      },
      { to: WED }
    )
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      days: 2,
      comparableDays: 1,
      baked: 10,
      sold: 9,
      unexplained: 0,
    })
    expect(p.gaps.noReport).toEqual([WED])
    expect(p.dayRows[1]).toMatchObject({ status: 'kein_bericht', sold: null })
    expect(s.counts.noReport).toBe(1)
    expect(s.days[1]).toMatchObject({ date: WED, report: false })
  })

  it('Ruhetag wird übersprungen, Schließtag steht als „geschlossen“', () => {
    const feiertage = kalender
      .holidaysSaarland(2026)
      .map((h) => ({ datum: h.date, name: h.name }))
    const withCalendar = {
      ...config,
      calendar: kalender.normalizeKalender({
        version: 1,
        bundesland: 'saarland',
        feiertage: { 2026: feiertage },
        tage: [{ datum: WED, typ: 'geschlossen', notiz: 'Inventur' }],
      }),
    }
    const s = run(
      {
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
          rows: [],
          report: report(WED, [[906, 3]]),
        },
      },
      { from: WED, to: '2026-12-07', config: withCalendar }
    )
    expect(s.days.find((d) => d.date === WED)).toMatchObject({
      status: 'geschlossen',
      dayKind: expect.objectContaining({ note: 'Inventur' }),
    })
    expect(s.days.find((d) => d.date === '2026-12-07').status).toBe('ruhetag')
    expect(s.counts).toMatchObject({ geschlossen: 1, ruhetag: 1 })
    // am Schließtag nichts verglichen
    expect(posten(s, 'plunder')).toBeUndefined()
  })

  it('Restquote über 10 %: Hinweis „zu viel produziert“', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
        rows: [row('plunder', 5)],
        report: report(TUE, [[906, 15]]),
      },
    })
    expect(posten(s, 'plunder')).toMatchObject({
      rate: 0.25,
      overproduction: true,
      unexplained: 0,
      ampel: 'ok',
    })
  })

  it('sortiert „prüfen“ zuerst, dann nach Größe des Unterschieds', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [
          { itemId: 'plunder', total: 20 },
          { itemId: 'kranz-gefuellt', variant: 'nuss', total: 2 },
        ]),
        rows: [
          row('plunder', 0),
          row('kranz-gefuellt', 0, {
            variant: 'nuss',
            productId: 'test-kranz-gefuellt',
          }),
          row('kranz-gefuellt', 0, {
            variant: 'nuss',
            productId: 'test-kranz-gefuellt-viertel',
          }),
        ],
        report: report(TUE, [
          [906, 19],
          [902, 6],
        ]),
      },
    })
    expect(s.items.map((p) => [p.key, p.ampel])).toEqual([
      ['kranz-gefuellt', 'pruefen'],
      ['plunder', 'ok'],
    ])
    expect(s.signals).toMatchObject({ pruefen: 1, ok: 1 })
    expect(s.days[0].signals.pruefen).toBe(1)
  })

  it('Zeitraum-Ampel: ein Tag ohne Rest mit „mehr verkauft“ zählt neben den gezählten Tagen', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
          rows: [row('plunder', 2)],
          report: report(TUE, [[906, 18]]),
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
          rows: [],
          report: report(WED, [[906, 40]]),
        },
      },
      { to: WED }
    )
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      unexplained: 0,
      ampel: 'pruefen',
      ampelBasis: 'ohne_rest',
      direction: 'mehr_verkauft',
      signal: -20,
      signalDays: { pruefen: 1, auffaellig: 0 },
    })
    expect(s.signals).toMatchObject({ pruefen: 1, ok: 0 })
  })

  it('Zeitraum-Ampel ohne Rest: übrige Ware eines Tages gleicht „mehr verkauft“ eines anderen nicht aus', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 30 }]),
          rows: [],
          report: report(TUE, [[906, 15]]),
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
          rows: [],
          report: report(WED, [[906, 30]]),
        },
      },
      { to: WED }
    )
    expect(posten(s, 'plunder')).toMatchObject({
      open: 5,
      ampel: 'pruefen',
      ampelBasis: 'ohne_rest',
      direction: 'mehr_verkauft',
      signal: -10,
      // die Zahl hinter „prüfen (ohne Rest)“ steht eigens da
      shortWithoutRest: -10,
      shortDays: 1,
    })
    expect(core.abgleichCsv(s)).toMatch(
      /Plunder;Stück;freigegeben;2;50;2;50;0;45;5;-10;0;/
    )
  })

  it('Rest nur an einem Teil der Tage: Ungeklärt nennt seine Grundlage', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
          rows: [row('plunder', 2)],
          report: report(TUE, [[906, 15]]),
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 20 }]),
          rows: [],
          report: report(WED, [[906, 10]]),
        },
      },
      { to: WED }
    )
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      baked: 40,
      sold: 25,
      open: 15,
      restDays: 1,
      comparableDays: 2,
      restShopBaked: 20,
      restSold: 15,
      rest: 2,
      unexplained: 3,
    })
    const csv = core.abgleichCsv(s)
    expect(csv).toContain(
      'Gebacken − CAP (Tage mit Rest);Verkauft (Tage mit Rest)'
    )
    expect(csv).toMatch(
      /Plunder;Stück;freigegeben;2;40;2;40;0;25;15;;1;20;15;2;3;/
    )
    expect(csv).toContain(
      'Gebacken (alle Tage);Tage vergleichbar;Gebacken (vergleichbare Tage)'
    )
  })

  it('Grundmenge offen: gebacken ist nur ein Mindestwert - kein Ungeklärt, keine Ampel', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('draft', [
          {
            itemId: 'plunder',
            total: 2,
            cap: 2,
            baseUnset: true,
            totalIsMinimum: true,
          },
        ]),
        rows: [],
        report: report(TUE, [[906, 25]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      status: 'vergleichbar',
      comparableDays: 0,
      bakedIsMinimum: true,
      sold: null,
      open: null,
      unexplained: null,
      ampel: null,
      direction: null,
    })
    expect(p.gaps.baseOpen).toEqual([TUE])
    expect(p.dayRows[0]).toMatchObject({
      status: 'grundmenge_offen',
      bakedIsMinimum: true,
      baked: 2,
      sold: 25,
      open: null,
      ampel: null,
    })
    expect(s.signals).toMatchObject({ pruefen: 0, ohneAmpel: 1 })
    expect(s.counts.baseOpen).toBe(1)
    expect(s.days[0]).toMatchObject({ baseOpen: 1, signals: { pruefen: 0 } })
    const csv = core.abgleichCsv(s)
    expect(csv).toContain('Grundmenge offen – kein Plan')
    // gebacken nur als Mindestwert, nie als feste Zahl
    expect(csv).toMatch(/Plunder;Stück;geplant – nicht freigegeben;1;≥ 2;0;;;/)
    expect(csv).toMatch(
      new RegExp(
        `${TUE};Dienstag;Plunder;Stück;geplant – nicht freigegeben;≥ 2;2;25;`
      )
    )
  })

  it('Grundmenge offen mit Gesamt 0: bleibt „Grundmenge offen“, nicht „verkauft, aber nicht gebacken“', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('draft', [
          { itemId: 'plunder', total: 0, baseUnset: true },
          { itemId: 'weck', total: 30 },
        ]),
        rows: [],
        report: report(TUE, [[906, 9]]),
      },
    })
    const p = posten(s, 'plunder')
    expect(p.dayRows[0]).toMatchObject({
      status: 'grundmenge_offen',
      restStatus: 'not_counted',
    })
    expect(p).toMatchObject({ ampel: null, direction: null })
  })

  it('Grundmenge offen, aber für den Tag entschieden: normal verglichen', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('draft', [
          { itemId: 'plunder', total: 10, baseUnset: true, correction: 10 },
        ]),
        rows: [row('plunder', 1)],
        report: report(TUE, [[906, 9]]),
      },
    })
    expect(posten(s, 'plunder')).toMatchObject({
      bakedIsMinimum: false,
      unexplained: 0,
      ampel: 'ok',
    })
  })

  it('Entwurf ohne eine Zeile: „kein Backzettel“, keine Alarme', () => {
    const s = run({
      [TUE]: {
        backzettel: { status: 'draft', sections: [] },
        rows: [],
        report: report(TUE, [[906, 9]]),
      },
    })
    expect(s.days[0].status).toBe('no_backzettel')
    expect(s.counts).toMatchObject({ bakeDays: 0, noBackzettel: 1 })
    expect(posten(s, 'plunder')).toBeUndefined()
  })

  it('nicht umrechenbar bleibt getrennt, auch ohne Kassenbericht - mit Lücke', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'vollkorn', total: 2 }]),
          rows: [],
          report: null,
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'vollkorn', total: 2 }]),
          rows: [],
          report: null,
        },
      },
      { to: WED }
    )
    expect(s.items.find((p) => p.key === 'vollkorn')).toBeUndefined()
    const p = posten(s, 'vollkorn')
    expect(p).toMatchObject({ status: 'einheit', soldPieces: null })
    expect(p.gaps.noReport).toEqual([TUE, WED])
  })

  it('nicht umrechenbar, Bericht nur an einem Tag: verkauft nur dort, der andere Tag ist eine Lücke', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('confirmed', [{ itemId: 'vollkorn', total: 2 }]),
          rows: [],
          report: report(TUE, [[909, 3]]),
        },
        [WED]: {
          backzettel: bzDay('confirmed', [{ itemId: 'vollkorn', total: 2 }]),
          rows: [],
          report: null,
        },
      },
      { to: WED }
    )
    const p = posten(s, 'vollkorn')
    expect(p).toMatchObject({ status: 'einheit', allBaked: 4, soldPieces: 3 })
    expect(p.gaps.noReport).toEqual([WED])
    expect(core.abgleichCsv(s)).toContain(
      `Vollkornbrot;Liter;nicht vergleichbar (Einheit);4;0;3;${WED}`
    )
  })

  it('Stück-Posten mit einer Kassennummer eines anderen Postens: nicht vergleichbar, nie still mitgezählt', () => {
    const raw = fixture.config()
    raw.items = raw.items.map((i) =>
      i.id === 'schnecke' ? { ...i, plu: [990, 906] } : i
    )
    const cfg = configCore.normalizeConfig(raw)
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay(
            'confirmed',
            [{ itemId: 'schnecke', total: 6 }],
            cfg
          ),
          rows: [],
          report: report(TUE, [
            [990, 5],
            [906, 8],
          ]),
        },
      },
      { config: cfg }
    )
    expect(posten(s, 'schnecke')).toMatchObject({
      status: 'einheit',
      converted: false,
      soldBasis: null,
      foreignPlu: [906],
      ampel: null,
    })
  })

  it('Kassennummer, die zufällig die numeric_id eines fremden Produkts ist: nicht fremd, Stück gegen Stück', () => {
    // 907 ist die numeric_id von test-weck (Posten Weck ohne Kassennummer).
    // Kassennummern und numeric_id sind nicht derselbe Nummernkreis.
    const raw = fixture.config()
    raw.items = raw.items.map((i) =>
      i.id === 'schnecke' ? { ...i, plu: [990, 907] } : i
    )
    const cfg = configCore.normalizeConfig(raw)
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay(
            'confirmed',
            [{ itemId: 'schnecke', total: 10 }],
            cfg
          ),
          rows: [],
          report: report(TUE, [
            [990, 5],
            [907, 3],
          ]),
        },
      },
      { config: cfg }
    )
    expect(posten(s, 'schnecke')).toMatchObject({
      status: 'vergleichbar',
      converted: true,
      soldBasis: 'stueck',
      foreignPlu: [],
      sold: 8,
      open: 2,
    })
    expect(
      core.comparison(item('schnecke', cfg), null, {
        pluOwners: new Map([['907', ['weck']]]),
      }).foreignPlu
    ).toEqual(['907'])
  })

  it('Gebacken je Posten zählt nur vergleichbare Tage; alle Tage stehen daneben', () => {
    const s = run(
      {
        [TUE]: {
          backzettel: bzDay('draft', [{ itemId: 'plunder', total: 20 }]),
          rows: [],
          report: report(TUE, [[906, 18]]),
        },
        [WED]: {
          backzettel: bzDay('draft', [{ itemId: 'plunder', total: 20 }]),
          rows: [],
          report: null,
        },
      },
      { to: WED }
    )
    const p = posten(s, 'plunder')
    expect(p).toMatchObject({
      days: 2,
      comparableDays: 1,
      baked: 20,
      allBaked: 40,
    })
    expect(core.abgleichCsv(s)).toMatch(
      /Plunder;Stück;geplant – nicht freigegeben;2;40;1;20;0;18;2;;0;/
    )
  })

  it('nennt niemanden: keine Namen in der Antwort', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [{ itemId: 'plunder', total: 10 }]),
        rows: [
          row('plunder', 1, {
            countedBy: { id: 7, displayName: 'Test Verkauf' },
          }),
        ],
        report: report(TUE, [[906, 9]]),
      },
    })
    expect(JSON.stringify(s)).not.toMatch(/Test Verkauf|countedBy/)
  })
})

describe('Laibgrößen (Backzettel v2)', () => {
  const catalogV2 = fixture.PRODUCTS_V2.map((p) => ({
    ...p,
    name: `Test ${p.id.replace('test-', '')}`,
  }))

  /** Testkorn mit Kassennummern; `kasten` ohne eigene → je Posten. */
  function v2(withKasten) {
    const raw = fixture.configV2()
    raw.items = raw.items.map((i) => {
      if (i.id !== 'test-korn') return i
      const sizes = [
        { id: 'g500', label: '500 g', dough_g: 600, plu: [951] },
        { id: 'g1000', label: '1 kg', dough_g: 1000, plu: [952] },
      ]
      return withKasten
        ? {
            ...i,
            plu: [951, 952],
            sizes: [
              ...sizes,
              { id: 'kasten', label: 'Kasten', dough_g: null, plu: null },
            ],
          }
        : {
            ...i,
            plu: [951, 952],
            sizes,
            base: { 2: { g500: 4, g1000: 2 }, 6: { g500: 8, g1000: 3 } },
          }
    })
    return configCore.normalizeConfig(raw)
  }

  const days = (cfg) => ({
    [TUE]: {
      backzettel: bzDay(
        'confirmed',
        [
          { itemId: 'test-korn', variant: 'g500', total: 4 },
          { itemId: 'test-korn', variant: 'g1000', total: 2 },
        ],
        cfg
      ),
      rows: [
        row('test-korn', 1, { variant: 'g500' }, cfg, catalogV2),
        row('test-korn', 0, { variant: 'g1000' }, cfg, catalogV2),
      ],
      report: report(TUE, [
        [951, 3],
        [952, 4],
      ]),
    },
  })

  it('vergleicht je Laibgröße, wenn jede Größe eigene Kassennummern hat', () => {
    const cfg = v2(false)
    const s = run(days(cfg), { config: cfg, catalog: catalogV2 })
    expect(posten(s, 'test-korn|g500')).toMatchObject({
      sizeLabel: '500 g',
      baked: 4,
      sold: 3,
      rest: 1,
      unexplained: 0,
      ampel: 'ok',
    })
    expect(posten(s, 'test-korn|g1000')).toMatchObject({
      sizeLabel: '1 kg',
      baked: 2,
      sold: 4,
      rest: 0,
      unexplained: -2,
      ampel: 'pruefen',
      direction: 'mehr_verkauft',
    })
  })

  it('sonst den ganzen Posten über alle Größen', () => {
    const cfg = v2(true)
    const s = run(days(cfg), { config: cfg, catalog: catalogV2 })
    expect(posten(s, 'test-korn|g500')).toBeUndefined()
    expect(posten(s, 'test-korn')).toMatchObject({
      sizeId: null,
      baked: 6,
      sold: 7,
      rest: 1,
      unexplained: -2,
    })
  })
})

describe('abgleichCsv', () => {
  it('schreibt Posten, Tage und die getrennte Liste; mit Dezimalkomma', () => {
    const s = run({
      [TUE]: {
        backzettel: bzDay('confirmed', [
          { itemId: 'kranz-gefuellt', variant: 'nuss', total: 2 },
          { itemId: 'weck', total: 40 },
        ]),
        rows: [],
        report: report(TUE, [[903, 2]]),
      },
    })
    const csv = core.abgleichCsv(s)
    expect(csv).toContain('Abgleich Produktion - Kasse')
    expect(csv).toContain('Zeitraum;2026-12-01 bis 2026-12-01')
    expect(csv).toContain('Ungeklärt')
    // 2 Viertel = 0,5 verkauft, 1,5 nicht verkauft oder nicht kassiert
    expect(csv).toMatch(
      /Kranz gefüllt;Stück;freigegeben;1;2;1;2;0;0,50;1,50;;0;/
    )
    expect(csv).toContain('Weck;Stück;keine Kassennummer;40')
    expect(csv).toContain('Rest nicht gezählt')
  })
})

describe('Euro-Abgleich', () => {
  const SAT = '2026-12-05'
  const SUN = '2026-12-06'
  const euroConfig = configCore.normalizeConfig(
    fixture.config({
      sections: ['brot', 'broetchen', 'laugen', 'kuchen', 'hefeteig'],
      items: [
        {
          id: 'test-wecken',
          section: 'broetchen',
          plu: [711],
          products: [{ id: 'test-wecken' }],
        },
        {
          id: 'test-kuchen',
          section: 'kuchen',
          plu: [811],
          products: [{ id: 'test-kuchen' }],
        },
        {
          id: 'test-brot',
          section: 'brot',
          unit: 'Liter',
          plu: [611],
          products: [{ id: 'test-brot', factor: 0.5 }],
        },
        {
          id: 'test-brezel',
          section: 'laugen',
          plu: [511],
          products: [{ id: 'test-brezel' }],
          purchased: true,
        },
        { id: 'test-ohne-preis', section: 'hefeteig' },
      ],
    })
  )
  const euroCatalog = [
    { id: 'test-wecken', price: 1.25 },
    { id: 'test-kuchen', price: 4.4 },
    { id: 'test-brezel', price: 2.1 },
  ]
  const sale = (productId, productName, quantity, revenue, groupName) => ({
    productId,
    productName,
    quantity,
    revenue,
    groupName,
  })
  const weekend = {
    [SAT]: {
      backzettel: {
        ...bzDay(
          'confirmed',
          [
            { itemId: 'test-wecken', total: 20, cap: 4 },
            { itemId: 'test-kuchen', total: 10 },
            { itemId: 'test-brot', total: 3 },
            { itemId: 'test-brezel', total: 7 },
            { itemId: 'test-ohne-preis', total: 4 },
            { itemId: 'test-wecken', total: 200, bakeDate: SUN },
          ],
          euroConfig
        ),
        date: SAT,
        preorderSources: [
          {
            doughDate: SAT,
            status: 'confirmed',
            snapshot: [
              {
                preorderId: 14,
                productId: 'test-wecken',
                qty: 2,
                pickupDate: SAT,
              },
            ],
            deltas: [
              {
                preorderId: 14,
                itemId: 'test-wecken',
                qty: 1,
                acknowledgedAt: null,
              },
            ],
          },
        ],
      },
      externalPreorders: [
        { preorderId: 14, productId: 'test-wecken', qty: 3, pickupDate: SAT },
      ],
      rows: [row('test-kuchen', 4, {}, euroConfig, euroCatalog)],
      report: {
        status: 'ok',
        revenue: 57.3,
        products: [
          sale(711, 'Testwecken', 10, 12.5),
          sale(799, 'Diverse', 3, 4),
          sale(811, 'Testkuchen', 5, 22),
          sale(999, 'Sonstige', 1, 4.4, 'Kuchen'),
          sale(611, 'Testbrot', 2, 6),
          sale(511, 'Testbrezel', 4, 8.4),
        ],
      },
    },
    [SUN]: {
      backzettel: bzDay(
        'draft',
        [
          { itemId: 'test-wecken', total: 4 },
          { itemId: 'test-kuchen', total: 5 },
        ],
        euroConfig
      ),
      report: {
        status: 'ok',
        revenue: 42.7,
        products: [
          sale(711, 'Testwecken', 6, 7.5),
          sale(811, 'Testkuchen', 8, 35.2),
        ],
      },
    },
  }
  const reconcile = (options = {}) =>
    core.reconcile({
      from: SAT,
      to: SUN,
      today: TODAY,
      config: euroConfig,
      catalog: euroCatalog,
      days: weekend,
      ...options,
    })
  const section = (day, id) => day.abschnitte.find((s) => s.section === id)

  const breadDay = (transactions, price) =>
    reconcile({
      to: SAT,
      catalog: [...euroCatalog, { id: 'test-brot', price }],
      days: {
        [SAT]: {
          backzettel: bzDay(
            'confirmed',
            [{ itemId: 'test-brot', total: 2 }],
            euroConfig
          ),
          report: aggregateDay(SAT, [{ transactions }], {
            includeProductGroups: true,
          }),
        },
      },
    }).euro.days[0]
  const breadSale = {
    product_id: 611,
    product: 'Testbrot',
    quantity: 2,
    total: 6,
  }

  it('zählt eine eindeutig gruppierte Kassenposition ohne Posten zum Abschnitts-Ist', () => {
    const day = breadDay(
      [
        {
          total: 16,
          items: [
            breadSale,
            {
              product_id: 612,
              product: 'Testfladen',
              group_name: 'Brot',
              quantity: 2,
              total: 8,
            },
            {
              product_id: 613,
              product: 'Diverse',
              group_name: 'Getränke',
              quantity: 1,
              total: 2,
            },
          ],
        },
      ],
      3.5
    )
    expect(section(day, 'brot')).toMatchObject({
      sollEur: 14,
      istEur: 14,
      differenzEur: 0,
      sammelEur: 0,
    })
    expect(day.items[0].istEur).toBe(6)
    expect(day.handelswareEur).toBe(2)
    expect(day.nichtZuordenbar).toMatchObject([
      { plu: '612', section: 'brot', sammel: false, istEur: 8 },
    ])
  })

  it('lässt die Differenz bei mehrdeutiger Kassengruppe oder unklarer Handelsware offen', () => {
    const day = breadDay(
      [
        {
          total: 14,
          items: [
            breadSale,
            {
              product_id: 612,
              product: 'Testartikel',
              group_name: 'Brot und Brötchen',
              quantity: 2,
              total: 8,
            },
          ],
        },
      ],
      3.5
    )
    expect(section(day, 'brot')).toMatchObject({
      sollEur: 14,
      istEur: null,
      differenzEur: null,
    })
    expect(day.nichtZuordenbar[0].section).toBeNull()
  })

  it('lässt das Ist eines Umsatzbons ohne Positionen offen und behält einen vollständigen Nullumsatz', () => {
    const missing = breadDay([{ total: 14, items: [] }], 3.5)
    expect(missing.kasseEur).toBe(14)
    expect(section(missing, 'brot')).toMatchObject({
      sollEur: 14,
      istEur: null,
      differenzEur: null,
    })
    expect(missing.items[0].istEur).toBeNull()

    const complete = breadDay([{ total: 0, items: [] }], 3.5)
    expect(section(complete, 'brot')).toMatchObject({
      sollEur: 14,
      istEur: 0,
      differenzEur: -14,
    })
    expect(complete.items[0].istEur).toBe(0)
  })

  it.each([null, undefined, '', 'ungültig', true])(
    'lässt den Ersatzpreis bei einer unvollständigen PLU-Menge (%s) offen',
    (quantity) => {
      const day = breadDay([
        { total: 12, items: [breadSale, { ...breadSale, quantity }] },
      ])
      expect(section(day, 'brot')).toMatchObject({
        sollEur: null,
        istEur: 12,
        differenzEur: null,
        preisOffen: ['test-brot'],
      })
    }
  )

  it('stimmt für Samstag und Sonntag mit der Handrechnung überein', () => {
    const { euro } = reconcile()
    const [sat, sun] = euro.days
    expect(euro).toMatchObject({
      sammelEur: 8.4,
      sammelAnteil: 0.084,
      abschnitte: [
        { id: 'brot', folgetag: true },
        { id: 'broetchen', folgetag: false },
        { id: 'laugen', folgetag: false },
        { id: 'kuchen', folgetag: true },
        { id: 'hefeteig', folgetag: false },
      ],
    })
    // (20 gebacken − 4 CAP − 2 Überweisung) × 1,25 = 17,50.
    // 12,50 einzeln + 4,00 Sammelnummer = 16,50 → −1,00.
    expect(section(sat, 'broetchen')).toMatchObject({
      sollEur: 17.5,
      istEur: 16.5,
      differenzEur: -1,
      sammelEur: 4,
      folgetagEur: 0,
    })
    expect(sat.items.find((p) => p.key === 'test-wecken')).toMatchObject({
      sollEur: 17.5,
      istEur: 12.5,
    })
    expect(sat.nichtZuordenbar).toEqual([
      expect.objectContaining({
        plu: '799',
        section: 'broetchen',
        sammel: true,
        istEur: 4,
      }),
      expect.objectContaining({
        plu: '999',
        section: 'kuchen',
        sammel: true,
        istEur: 4.4,
      }),
    ])
    // 6 € / 2 Laibe zu je 0,5 l = 6 € pro Liter, 3 l × 6 € = 18 €.
    expect(section(sat, 'brot')).toMatchObject({
      sollEur: 18,
      istEur: 6,
      differenzEur: -12,
    })
    expect(section(sat, 'hefeteig')).toMatchObject({
      sollEur: null,
      differenzEur: null,
      preisOffen: ['test-ohne-preis'],
    })
    expect(sat.handelswareEur).toBe(8.4)
    expect(section(sat, 'laugen')).toMatchObject({
      sollEur: 0,
      istEur: 0,
      handelswareEur: 8.4,
      differenzEur: 0,
    })
    // Kuchen: Sa 44,00 Soll und 26,40 Ist, So 22,00 Soll und 35,20 Ist.
    // Vom So gehen 13,20 Überschuss auf Sa, übrig bleiben 4,40 Lücke.
    expect(section(sat, 'kuchen')).toMatchObject({
      sollEur: 44,
      istEur: 26.4,
      folgetagEur: 13.2,
      differenzEur: -4.4,
      restCounted: true,
    })
    expect(section(sun, 'kuchen')).toMatchObject({
      sollEur: 22,
      istEur: 35.2,
      folgetagEur: -13.2,
      differenzEur: 0,
    })
    expect(section(sun, 'broetchen')).toMatchObject({
      sollEur: 5,
      istEur: 7.5,
      differenzEur: 2.5,
    })
    expect(sun.basis).toBe('geplant')
  })

  it('berücksichtigt den Folgetag am Zeitraumrand und kann ihn abschalten', () => {
    const onlySat = reconcile({ to: SAT })
    expect(onlySat.days).toHaveLength(1)
    expect(section(onlySat.euro.days[0], 'kuchen').folgetagEur).toBe(13.2)
    const { euro } = reconcile({ folgetag: [] })
    expect(section(euro.days[0], 'kuchen').differenzEur).toBe(-17.6)
    expect(section(euro.days[1], 'kuchen').differenzEur).toBe(13.2)
  })

  it('verrechnet höchstens den Wert des vollständig gezählten Rests', () => {
    const sat = {
      ...weekend[SAT],
      rows: [row('test-kuchen', 1, {}, euroConfig, euroCatalog)],
    }
    const { euro } = reconcile({ days: { ...weekend, [SAT]: sat } })
    expect(section(euro.days[0], 'kuchen').folgetagEur).toBe(4.4)
    expect(section(euro.days[1], 'kuchen').differenzEur).toBe(8.8)
  })

  it('hält offene Grundmenge und fehlenden Bericht als Lücken fest', () => {
    const sun = {
      backzettel: bzDay(
        'draft',
        [
          { itemId: 'test-wecken', total: 4 },
          { itemId: 'test-kuchen', total: 5, totalIsMinimum: true },
        ],
        euroConfig
      ),
    }
    const { euro } = reconcile({ days: { ...weekend, [SUN]: sun } })
    expect(section(euro.days[1], 'kuchen')).toMatchObject({
      sollEur: null,
      istEur: null,
      differenzEur: null,
      preisOffen: [],
      folgetagEur: 0,
    })
    expect(section(euro.days[1], 'broetchen')).toMatchObject({
      sollEur: 5,
      istEur: null,
      differenzEur: null,
    })
    expect(section(euro.days[0], 'kuchen').folgetagEur).toBe(0)
  })
})
