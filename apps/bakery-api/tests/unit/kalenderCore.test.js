/**
 * Kalender (U9, `kalender.core.js`) mit erfundenen Daten: Feiertage,
 * Schließtage, Teigtage über Schließtage, Tag vor Schließtagen, Hinweise.
 *
 * Synthetischer Dezember: Do 24.12.2026 offen, Fr 25./Sa 26.12. Feiertage
 * (zu), So 27.12. offen, Mo 28.12. Ruhetag, Di 29.12.-Do 31.12. normal,
 * Fr 01.01.2027 Feiertag, Sa 02.-Mo 04.01. Betriebsferien (Beispiel),
 * Di 05.01. wieder offen. `configV2()`: Teigtage Di-Sa, Backtage Di-So,
 * Testdoppel `lead: 1`.
 */
const kalender = require('../../src/services/kalender.core')
const plan = require('../../src/services/backzettel-plan.core')
const core = require('../../src/services/backzettel.core')
const dayCore = require('../../src/services/backzettel-day.core')
const configCore = require('../../src/services/backzettel-config.core')
const vacation = require('../../src/services/vacation.core')
const { configV2 } = require('../fixtures/backzettel.synthetic')

const feiertage = (year) =>
  kalender.holidaysSaarland(year).map((h) => ({ datum: h.date, name: h.name }))

function rawKalender(tage = []) {
  return {
    version: 1,
    bundesland: 'saarland',
    feiertage: { 2026: feiertage(2026), 2027: feiertage(2027) },
    tage,
  }
}

const FERIEN = {
  von: '2027-01-02',
  bis: '2027-01-04',
  typ: 'geschlossen',
  notiz: 'Betriebsferien',
}

function cfgWith(tage = [FERIEN], mutate) {
  const raw = configV2()
  if (mutate) mutate(raw)
  const cfg = configCore.normalizeConfig(raw)
  cfg.calendar = kalender.normalizeKalender(rawKalender(tage))
  return cfg
}

const item = (cfg, id) => cfg.items.find((i) => i.id === id)

describe('Feiertage Saarland (eine Fassung)', () => {
  it('2026 und 2027, Ostern beweglich; vacation.core nimmt dieselbe Formel', () => {
    expect(kalender.easterSunday(2027)).toBe('2027-03-28')
    expect(kalender.holidayName('2027-03-26')).toBe('Karfreitag')
    expect(kalender.holidayName('2026-12-25')).toBe('1. Weihnachtstag')
    expect(kalender.holidayName('2026-12-24')).toBeNull()
    expect(kalender.holidaysSaarland(2027)).toHaveLength(12)
    expect(vacation.holidaysSaarland).toBe(kalender.holidaysSaarland)
    expect(vacation.holidayName('2027-11-01')).toBe('Allerheiligen')
  })
})

describe('validateKalender', () => {
  const errorsOf = (raw, options) =>
    kalender.validateKalender(raw, options).errors.map((e) => e.path)

  it('gültiger Kalender ohne Fehler', () => {
    const r = kalender.validateKalender(rawKalender([FERIEN]))
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('Feiertagsliste muss der Formel entsprechen', () => {
    const raw = rawKalender()
    raw.feiertage[2027] = feiertage(2027).filter(
      (h) => h.datum !== '2027-12-26'
    )
    raw.feiertage[2027].push({ datum: '2027-12-24', name: 'Heiligabend' })
    const r = kalender.validateKalender(raw)
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => e.message).join(' ')).toMatch(
      /2027-12-24 ist im Saarland kein gesetzlicher Feiertag/
    )
    expect(r.errors.map((e) => e.message).join(' ')).toMatch(
      /2027-12-26 \(2\. Weihnachtstag\) fehlt/
    )
  })

  it('ohne feiertage, falsches Bundesland, falsche Version: Fehler', () => {
    expect(errorsOf({ version: 2, bundesland: 'bayern', tage: [] })).toEqual([
      'version',
      'bundesland',
      'feiertage',
    ])
  })

  it('Einträge: Typ, wie, offen_bis, notiz, Datum doppelt, von/bis', () => {
    const paths = errorsOf(
      rawKalender([
        { datum: '2026-12-21', typ: 'offen', notiz: 'x' },
        { datum: '2026-12-22', typ: 'sonderoeffnung', notiz: 'ohne wie' },
        { datum: '2026-12-23', typ: 'geschlossen', wie: 2, notiz: 'x' },
        {
          datum: '2026-12-24',
          typ: 'wie-sonntag',
          offen_bis: '12 Uhr',
          notiz: 'x',
        },
        { datum: '2026-12-30', typ: 'geschlossen' },
        { datum: '2026-12-30', typ: 'geschlossen', notiz: 'doppelt' },
        {
          von: '2027-01-05',
          bis: '2027-01-02',
          typ: 'geschlossen',
          notiz: 'x',
        },
        { datum: '2026-02-30', typ: 'geschlossen', notiz: 'x' },
        {
          datum: '2026-12-29',
          von: '2026-12-29',
          bis: '2026-12-30',
          typ: 'geschlossen',
          notiz: 'x',
        },
      ])
    )
    expect(paths).toEqual([
      'tage[0].typ',
      'tage[1].wie',
      'tage[2].wie',
      'tage[3].offen_bis',
      'tage[4].notiz',
      'tage[5].datum',
      'tage[6].bis',
      'tage[7].datum',
      'tage[8]',
    ])
  })

  it('mit Stammdaten: wie muss ein Produktionstag sein', () => {
    const cfg = configCore.normalizeConfig(configV2())
    expect(
      errorsOf(
        rawKalender([
          { datum: '2026-12-21', typ: 'sonderoeffnung', wie: 1, notiz: 'x' },
        ]),
        { config: cfg }
      )
    ).toEqual(['tage[0].wie'])
  })

  it('Warnungen: Überschneidung, Jahr ohne Feiertage', () => {
    const r = kalender.validateKalender(
      rawKalender([
        FERIEN,
        {
          von: '2027-01-04',
          bis: '2027-01-05',
          typ: 'geschlossen',
          notiz: 'x',
        },
        { datum: '2028-01-03', typ: 'geschlossen', notiz: 'x' },
      ])
    )
    expect(r.ok).toBe(true)
    const text = r.warnings.map((w) => w.message).join(' ')
    expect(text).toMatch(/überschneidet sich/)
    expect(text).toMatch(/Jahr 2028 fehlt unter feiertage/)
  })
})

describe('dayKind', () => {
  const cfg = cfgWith()

  it('Feiertag geschlossen: kein Back- und kein Teigtag', () => {
    const d = kalender.dayKind(cfg, '2026-12-25')
    expect(d).toMatchObject({
      kind: 'geschlossen',
      open: false,
      bakeDay: false,
      doughDay: false,
      holidayName: '1. Weihnachtstag',
      label: 'Geschlossen',
      detail: '1. Weihnachtstag',
      calendar: 'ok',
    })
  })

  it('Do 24.12.: Samstags-Satz (Sa geschlossen, So danach offen)', () => {
    const d = kalender.dayKind(cfg, '2026-12-24')
    expect(d.kind).toBe('normal')
    expect(d.before.type).toBe('samstag_ersatz')
    expect(d.before.closedDays.map((c) => c.date)).toEqual([
      '2026-12-25',
      '2026-12-26',
    ])
    expect(d.before.nextDoughDay).toBe('2026-12-29')
    expect(d.label).toBe('Samstags-Satz')
    expect(d.detail).toBe(
      'danach geschlossen: Fr 25.12. 1. Weihnachtstag, Sa 26.12. 2. Weihnachtstag'
    )
  })

  it('Do 31.12.: vor Feiertag (Sa zu, aber kein offener So danach)', () => {
    const d = kalender.dayKind(cfg, '2026-12-31')
    expect(d.before.type).toBe('vor_feiertag')
    expect(d.label).toBe('Vor Feiertag')
  })

  it('ist Sa 26.12. offen, wird Do 24.12. „vor Feiertag“', () => {
    const open = cfgWith([
      { datum: '2026-12-26', typ: 'sonderoeffnung', wie: 6, notiz: 'Test' },
    ])
    expect(kalender.dayKind(open, '2026-12-24').before.type).toBe(
      'vor_feiertag'
    )
    expect(kalender.dayKind(open, '2026-12-26')).toMatchObject({
      kind: 'sonderoeffnung',
      baseWeekday: 6,
      bakeDay: true,
      doughDay: true,
      label: 'Sonderöffnung (wie Samstag)',
    })
  })

  it('normaler Tag ohne Schließtag danach: kein before; Montag Ruhetag', () => {
    expect(kalender.dayKind(cfg, '2026-12-22').before).toBeNull()
    expect(kalender.dayKind(cfg, '2026-12-22').label).toBeNull()
    expect(kalender.dayKind(cfg, '2026-12-28')).toMatchObject({
      kind: 'ruhetag',
      bakeDay: false,
      label: 'Ruhetag',
    })
  })

  it('wie-sonntag an einem Feiertag: Grundmenge Sonntag, kein Teigtag, kein CAP', () => {
    const c = cfgWith([
      {
        datum: '2027-05-06',
        typ: 'wie-sonntag',
        offen_bis: '11:00',
        notiz: 'Himmelfahrt',
      },
    ])
    expect(kalender.dayKind(c, '2027-05-06')).toMatchObject({
      kind: 'wie-sonntag',
      baseWeekday: 7,
      bakeDay: true,
      doughDay: false,
      capWeekday: null,
      label: 'Wie Sonntag',
      detail: 'Himmelfahrt · offen bis 11:00 Uhr',
    })
    // Mi davor: nichts geschlossen dazwischen
    expect(kalender.dayKind(c, '2027-05-05').before).toBeNull()
  })

  it('ohne Kalender und für Jahre ohne Feiertagsliste: Wochenplan wie bisher', () => {
    const plain = configCore.normalizeConfig(configV2())
    expect(kalender.dayKind(plain, '2026-12-25')).toMatchObject({
      kind: 'normal',
      bakeDay: true,
      doughDay: true,
      calendar: 'missing',
      before: null,
    })
    expect(kalender.dayKind(cfg, '2028-12-26')).toMatchObject({
      kind: 'normal',
      bakeDay: true,
      calendar: 'year-missing',
    })
  })

  it('späterer Eintrag gewinnt; wochentage filtert einen Zeitraum', () => {
    const c = cfgWith([
      FERIEN,
      { datum: '2027-01-04', typ: 'teigtag', notiz: 'Teig für Di' },
      {
        von: '2027-06-27',
        bis: '2027-08-08',
        wochentage: [7],
        typ: 'geschlossen',
        notiz: 'Sommer, sonntags zu',
      },
    ])
    expect(kalender.dayKind(c, '2027-01-04')).toMatchObject({
      kind: 'teigtag',
      open: false,
      bakeDay: false,
      doughDay: true,
      label: 'Nur Teig (Laden geschlossen)',
    })
    expect(kalender.dayKind(c, '2027-01-03').kind).toBe('geschlossen')
    expect(kalender.dayKind(c, '2027-07-04').kind).toBe('geschlossen')
    expect(kalender.dayKind(c, '2027-07-03').kind).toBe('normal')
  })

  it('closedReason: 409-Grund für Ruhetag und Schließtag', () => {
    expect(kalender.closedReason(cfg, '2026-12-25')).toMatchObject({
      code: 'geschlossen',
      note: '1. Weihnachtstag',
    })
    expect(kalender.closedReason(cfg, '2026-12-25').message).toMatch(
      /^Freitag 25\.12\. 1\. Weihnachtstag - geschlossen/
    )
    expect(kalender.closedReason(cfg, '2026-12-28').code).toBe('ruhetag')
    expect(kalender.closedReason(cfg, '2026-12-24')).toBeNull()
  })
})

describe('Teigtage überspringen Schließtage (Plan-Kern)', () => {
  const cfg = cfgWith()
  const doppel = item(cfg, 'test-doppel')

  it('So 27.12. und Di 29.12. bekommen den Teig vom Do 24.12.', () => {
    expect(plan.doughDateFor(cfg, doppel, '2026-12-27')).toBe('2026-12-24')
    expect(plan.doughDateFor(cfg, doppel, '2026-12-29')).toBe('2026-12-24')
    expect(plan.doughDateFor(cfg, doppel, '2027-01-05')).toBe('2026-12-31')
    expect(plan.bakeDatesFor(cfg, '2026-12-24')).toEqual([
      '2026-12-24',
      '2026-12-27',
      '2026-12-29',
    ])
  })

  it('kein Zettel an Schließtagen', () => {
    expect(plan.bakeDatesFor(cfg, '2026-12-25')).toEqual([])
    expect(plan.isDoughDay(cfg, '2026-12-26')).toBe(false)
    expect(plan.isBakeDay(cfg, '2026-12-26')).toBe(false)
    expect(plan.doughDatesFor(cfg, '2026-12-25')).toEqual([])
  })

  it('teigtag im Kalender: Teig für Di 05.01. am Mo 04.01.', () => {
    const c = cfgWith([
      FERIEN,
      { datum: '2027-01-04', typ: 'teigtag', notiz: 'Teig für Di' },
    ])
    expect(plan.doughDateFor(c, item(c, 'test-doppel'), '2027-01-05')).toBe(
      '2027-01-04'
    )
    expect(plan.bakeDatesFor(c, '2027-01-04')).toEqual(['2027-01-05'])
    expect(kalender.isSheetDay(c, '2027-01-04')).toBe(true)
  })

  it('ohne Kalender: Fr 25.12. ist ein normaler Teigtag (wie bisher)', () => {
    const plain = configCore.normalizeConfig(configV2())
    expect(
      plan.doughDateFor(plain, item(plain, 'test-doppel'), '2026-12-27')
    ).toBe('2026-12-26')
  })
})

describe('Zettel je Teigtag mit Kalender (computeDoughDay)', () => {
  it('Do 24.12.: Blöcke für Do, So, Di; Vorlauf-Warnung für Di; Spalte fehlt', () => {
    const cfg = cfgWith()
    const r = core.computeDoughDay({ config: cfg, date: '2026-12-24' })
    expect(r.dayKind.before.type).toBe('samstag_ersatz')
    expect(r.bakeDates.map((b) => b.date)).toEqual([
      '2026-12-24',
      '2026-12-27',
      '2026-12-29',
    ])
    const doppel = r.lines.filter((l) => l.itemId === 'test-doppel')
    expect(doppel.map((l) => [l.bakeDate, l.total])).toEqual([
      ['2026-12-27', 60],
      ['2026-12-29', 40],
    ])
    const far = r.warnings.filter((w) => w.code === 'dough_day_far')
    expect(far).toHaveLength(1)
    expect(far[0]).toMatchObject({
      bakeDate: '2026-12-29',
      doughDate: '2026-12-24',
    })
    expect(far[0].message).toMatch(
      /^Teig für Di 29\.12\. schon am Do 24\.12\. \(5 Tage vorher, wegen Schließtagen\): Testdoppel/
    )
    expect(
      r.warnings.find((w) => w.code === 'special_base_missing')
    ).toBeTruthy()
  })

  it('Spalte samstag_ersatz wird die Grundmenge des Tages', () => {
    const cfg = cfgWith([FERIEN], (raw) => {
      const korn = raw.items.find((i) => i.id === 'test-korn')
      korn.base.samstag_ersatz = { g500: 5, g1000: 1 }
    })
    expect(item(cfg, 'test-korn').base).not.toHaveProperty('samstag_ersatz')
    const r = core.computeDoughDay({ config: cfg, date: '2026-12-24' })
    const korn = r.lines.filter(
      (l) => l.itemId === 'test-korn' && l.bakeDate === '2026-12-24'
    )
    expect(korn.map((l) => [l.variant, l.base])).toEqual([
      ['g500', 5],
      ['g1000', 1],
    ])
    expect(r.warnings.find((w) => w.code === 'special_base_missing')).toBe(
      undefined
    )
    // an einem normalen Donnerstag gilt die Spalte nicht
    const thu = core.computeDoughDay({ config: cfg, date: '2026-12-17' })
    expect(thu.lines.filter((l) => l.itemId === 'test-korn')).toEqual([])
  })

  it('Vorbestellungen an einem Schließtag stehen als Warnung auf dem Zettel davor', () => {
    const cfg = cfgWith()
    const r = core.computeDoughDay({
      config: cfg,
      date: '2026-12-24',
      preorderItems: [
        { productId: 'test-doppel', qty: 12, pickupDate: '2026-12-25' },
      ],
    })
    const w = r.warnings.find((x) => x.code === 'preorders_on_closed_day')
    expect(w).toMatchObject({ date: '2026-12-25', qty: 12 })
    expect(w.message).toMatch(
      /^Freitag, 25\.12\. \(1\. Weihnachtstag\) ist geschlossen/
    )
  })

  it('Spezialbrot des Ausfalltags als Hinweis', () => {
    const cfg = cfgWith([FERIEN], (raw) => {
      raw.items.push({
        id: 'test-fr-brot',
        name: 'Testfreitagsbrot',
        section: 'brot',
        unit: 'Liter',
        base: { 5: 2 },
      })
    })
    const r = core.computeDoughDay({ config: cfg, date: '2026-12-24' })
    const w = r.warnings.find((x) => x.code === 'closed_day_specials')
    expect(w).toMatchObject({ date: '2026-12-25', items: ['test-fr-brot'] })
    expect(w.message).toMatch(/Testfreitagsbrot - heute oder später backen\?/)
  })

  it('Spezialbrot mit gepflegter Sonderspalte steht nicht im Hinweis (schon eingeplant)', () => {
    const cfg = cfgWith([FERIEN], (raw) => {
      raw.items.push(
        {
          id: 'test-sa-brot',
          name: 'Testsamstagsbrot',
          section: 'brot',
          unit: 'Liter',
          base: { 6: 3, samstag_ersatz: 3 },
        },
        {
          id: 'test-sa-kuchen',
          name: 'Testsamstagskuchen',
          section: 'kuchen',
          base: { 6: 2 },
        }
      )
    })
    const r = core.computeDoughDay({ config: cfg, date: '2026-12-24' })
    expect(r.dayKind.before.type).toBe('samstag_ersatz')
    const w = r.warnings.find(
      (x) => x.code === 'closed_day_specials' && x.date === '2026-12-26'
    )
    expect(w.items).toContain('test-sa-kuchen')
    expect(w.items).not.toContain('test-sa-brot')
    expect(w.message).not.toMatch(/Testsamstagsbrot/)
    // die Menge der Spalte steht auf dem Zettel
    expect(r.lines.find((l) => l.itemId === 'test-sa-brot')).toMatchObject({
      base: 3,
    })
  })

  it('Sonderspalte 0 plant nicht ein: der Hinweis bleibt (auch für den Freitag)', () => {
    const cfg = cfgWith([FERIEN], (raw) => {
      raw.items.push(
        {
          id: 'test-fr-brot',
          name: 'Testfreitagsbrot',
          section: 'brot',
          unit: 'Liter',
          base: { 5: 4, samstag_ersatz: 0 },
        },
        {
          id: 'test-fr-korn',
          name: 'Testfreitagskorn',
          section: 'brot',
          unit: 'Liter',
          base: { 5: 2, samstag_ersatz: 2 },
        },
        {
          id: 'test-sa-brot',
          name: 'Testsamstagsbrot',
          section: 'brot',
          unit: 'Liter',
          base: { 6: 3, samstag_ersatz: 0 },
        },
        {
          id: 'test-sa-offen',
          name: 'Testsamstagoffen',
          section: 'brot',
          unit: 'Liter',
          base: { 6: 3, samstag_ersatz: null },
        }
      )
    })
    const r = core.computeDoughDay({ config: cfg, date: '2026-12-24' })
    expect(r.dayKind.before.type).toBe('samstag_ersatz')
    const of = (date) =>
      r.warnings.find(
        (x) => x.code === 'closed_day_specials' && x.date === date
      )
    // Fr 25.12.: mit 0 nicht auf dem Zettel -> gefragt; mit 2 eingeplant
    expect(r.lines.filter((l) => l.itemId === 'test-fr-brot')).toEqual([])
    expect(of('2026-12-25').items).toEqual(['test-fr-brot'])
    expect(r.lines.find((l) => l.itemId === 'test-fr-korn')).toMatchObject({
      base: 2,
    })
    // Sa 26.12.: 0 -> gefragt; offen steht als Zeile „Grundmenge fehlt“ da
    expect(of('2026-12-26').items).toContain('test-sa-brot')
    expect(of('2026-12-26').items).not.toContain('test-sa-offen')
    expect(r.lines.find((l) => l.itemId === 'test-sa-offen')).toMatchObject({
      baseUnset: true,
    })
  })

  it('Do 31.12.: Teig für Di 05.01. 5 Tage vorher; mit teigtag am 04.01. nicht', () => {
    const r = core.computeDoughDay({ config: cfgWith(), date: '2026-12-31' })
    expect(r.dayKind.before.type).toBe('vor_feiertag')
    expect(r.bakeDates.map((b) => b.date)).toEqual(['2026-12-31', '2027-01-05'])
    expect(
      r.warnings.some(
        (w) => w.code === 'dough_day_far' && w.bakeDate === '2027-01-05'
      )
    ).toBe(true)
    const c = cfgWith([
      FERIEN,
      { datum: '2027-01-04', typ: 'teigtag', notiz: 'Teig für Di' },
    ])
    const r2 = core.computeDoughDay({ config: c, date: '2026-12-31' })
    expect(r2.bakeDates.map((b) => b.date)).toEqual(['2026-12-31'])
    const teig = core.computeDoughDay({ config: c, date: '2027-01-04' })
    expect(teig.open).toBe(false)
    expect(teig.isDoughDay).toBe(true)
    expect(teig.dayKind.kind).toBe('teigtag')
    expect(teig.bakeDates.map((b) => b.date)).toEqual(['2027-01-05'])
    expect(teig.lines.every((l) => l.bakeDate === '2027-01-05')).toBe(true)
  })

  it('ohne Kalender: keine neuen Warnungen, Sa 26.12. macht So + Di', () => {
    const plain = configCore.normalizeConfig(configV2())
    const r = core.computeDoughDay({ config: plain, date: '2026-12-24' })
    expect(r.dayKind).toMatchObject({ calendar: 'missing', before: null })
    expect(
      r.warnings.filter((w) =>
        ['dough_day_far', 'special_base_missing'].includes(w.code)
      )
    ).toEqual([])
    expect(plan.bakeDatesFor(plain, '2026-12-26')).toEqual([
      '2026-12-26',
      '2026-12-27',
      '2026-12-29',
    ])
  })

  it('CAP nicht an einem gesetzlichen Feiertag, auch wenn offen', () => {
    const cfg = cfgWith([
      { datum: '2027-05-06', typ: 'sonderoeffnung', wie: 4, notiz: 'Test' },
    ])
    const capTemplate = {
      weekday: 4,
      items: [{ productId: 'test-doppel', quantity: 10 }],
    }
    const holiday = core.computeDay({
      config: cfg,
      date: '2027-05-06',
      capTemplate,
    })
    expect(holiday.lines.reduce((n, l) => n + l.cap, 0)).toBe(0)
    const normal = core.computeDay({
      config: cfg,
      date: '2027-05-13',
      capTemplate,
    })
    expect(normal.lines.reduce((n, l) => n + l.cap, 0)).toBe(10)
  })
})

describe('Vorbereitung (prepDateFor) mit Kalender', () => {
  it('Vortag geschlossen: offen, mit Grund; ohne Stammdaten null', () => {
    const cfg = cfgWith()
    expect(dayCore.prepDateFor('2026-12-27', cfg)).toEqual({
      prepDate: '2026-12-26',
      prepDateProvisional: true,
      prepDateReason: 'Sa 26.12. geschlossen (2. Weihnachtstag)',
    })
    expect(dayCore.prepDateFor('2026-12-29', cfg)).toEqual({
      prepDate: '2026-12-28',
      prepDateProvisional: true,
    })
    expect(dayCore.prepDateFor('2026-12-23', cfg)).toEqual({
      prepDate: '2026-12-22',
      prepDateProvisional: false,
    })
    expect(dayCore.prepDateFor('2026-12-23', null)).toEqual({
      prepDate: '2026-12-22',
      prepDateProvisional: null,
    })
  })
})
