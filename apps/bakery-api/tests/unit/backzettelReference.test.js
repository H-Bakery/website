/**
 * Z4: Referenzwert neben der Grundmenge - Median verkauft je Posten über
 * die letzten gleichen Wochentage mit Kassenbericht. Synthetische
 * Tagesfiles in einem Temp-Verzeichnis, gelesen über `reports-files.core.js`
 * wie im Berichtsarchiv.
 *
 * Kalender: Mo 2026-11-23 … So 2026-11-29; „heute" ist Mi 2026-12-02.
 * Samstage davor: 28.11., 21.11., 14.11., 07.11., 31.10., 24.10., 17.10., …
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const core = require('../../src/services/backzettel-reference.core')
const files = require('../../src/services/reports-files.core')
const configCore = require('../../src/services/backzettel-config.core')
const loader = require('../../src/services/backzettel-config.loader')
const fixture = require('../fixtures/backzettel-grundmengen.synthetic')

const config = configCore.normalizeConfig(
  loader.parseBackzettelYaml(fixture.CONFIG_YAML).data
)

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-ref-'))
  fs.mkdirSync(path.join(dir, 'converted'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function writeDay(date, transactions, suffix = '') {
  fs.writeFileSync(
    path.join(dir, 'converted', `${date}_90000001${suffix}.json`),
    JSON.stringify(fixture.convertedReport(date, transactions))
  )
}

/** Wie `backzettel-reference.ts`: Tage finden, Berichte lesen, rechnen. */
function reference(weekday, today, weeks = 6, catalog = undefined) {
  const have = new Set(files.listReportDates(dir, () => undefined))
  const { dates, skipped } = core.referenceDates({
    weekday,
    today,
    weeks,
    hasReport: (d) => have.has(d),
  })
  const reports = {}
  for (const d of dates) reports[d] = files.readDailyReport(dir, d)
  return core.computeWeekdayReference({
    config,
    weekday,
    weeks,
    dates,
    skipped,
    reports,
    catalog,
  })
}

const item = (ref, id) => ref.items.find((i) => i.itemId === id)

describe('referenceDates', () => {
  it('nimmt denselben Wochentag vor heute, neueste zuerst', () => {
    const { dates } = core.referenceDates({
      weekday: 6,
      today: '2026-12-02',
      weeks: 3,
      hasReport: () => true,
    })
    expect(dates).toEqual(['2026-11-28', '2026-11-21', '2026-11-14'])
  })

  it('zählt heute nie mit (der Tag ist nicht abgeschlossen)', () => {
    const { dates } = core.referenceDates({
      weekday: 3,
      today: '2026-12-02', // Mittwoch
      weeks: 2,
      hasReport: () => true,
    })
    expect(dates).toEqual(['2026-11-25', '2026-11-18'])
  })

  it('überspringt Tage ohne Bericht und schaut weiter zurück', () => {
    const missing = new Set(['2026-11-21', '2026-11-07'])
    const { dates, skipped } = core.referenceDates({
      weekday: 6,
      today: '2026-12-02',
      weeks: 4,
      hasReport: (d) => !missing.has(d),
    })
    expect(dates).toEqual([
      '2026-11-28',
      '2026-11-14',
      '2026-10-31',
      '2026-10-24',
    ])
    expect(skipped).toEqual(['2026-11-21', '2026-11-07'])
  })

  it('schaut höchstens LOOKBACK_WEEKS zurück', () => {
    const { dates, skipped } = core.referenceDates({
      weekday: 1,
      today: '2026-12-02',
      weeks: 6,
      hasReport: () => false,
    })
    expect(dates).toEqual([])
    expect(skipped).toHaveLength(core.LOOKBACK_WEEKS)
  })
})

describe('median', () => {
  it('ungerade und gerade Anzahl', () => {
    expect(core.median([5, 1, 3])).toBe(3)
    expect(core.median([4, 1, 3, 10])).toBe(3.5)
    expect(core.median([])).toBeNull()
  })
})

describe('Parameter', () => {
  it('weeks: Standard 6, 1…26, sonst Fehler', () => {
    expect(core.parseWeeks(undefined)).toEqual({ ok: true, weeks: 6 })
    expect(core.parseWeeks('8')).toEqual({ ok: true, weeks: 8 })
    expect(core.parseWeeks('0').ok).toBe(false)
    expect(core.parseWeeks('27').ok).toBe(false)
    expect(core.parseWeeks('2.5').ok).toBe(false)
  })

  it('weekday: leer = alle Produktionstage, Zahl oder Liste', () => {
    expect(core.parseWeekdays('', [7, 2, 3])).toEqual({
      ok: true,
      weekdays: [2, 3, 7],
    })
    expect(core.parseWeekdays('6', [2, 6])).toEqual({ ok: true, weekdays: [6] })
    expect(core.parseWeekdays('6,2,6', [])).toEqual({
      ok: true,
      weekdays: [2, 6],
    })
    expect(core.parseWeekdays('8', []).ok).toBe(false)
    expect(core.parseWeekdays('sa', []).ok).toBe(false)
    expect(core.parseWeekdays(['6', '2'], []).ok).toBe(false)
  })
})

describe('computeWeekdayReference', () => {
  it('Median der verkauften Stück je Posten über die Kassennummern', () => {
    // Musterweck (903): 50, 60, 70 → 60; Kornbrot (901 + 902): 3+1, 5+0, 2+2 → 4
    writeDay('2026-11-28', [
      {
        items: [
          [903, 30],
          [901, 3],
        ],
      },
      {
        items: [
          [903, 20],
          [902, 1],
        ],
      },
    ])
    writeDay('2026-11-21', [
      {
        items: [
          [903, 60],
          [901, 5],
        ],
      },
    ])
    writeDay('2026-11-14', [
      {
        items: [
          [903, 70],
          [901, 2],
          [902, 2],
        ],
      },
    ])
    const ref = reference(6, '2026-12-02', 6)
    expect(ref.weekdayName).toBe('Samstag')
    expect(ref.dates).toEqual(['2026-11-28', '2026-11-21', '2026-11-14'])
    expect(item(ref, 'musterweck')).toMatchObject({
      median: 60,
      samples: [50, 60, 70],
      status: 'ok',
      plu: [903],
    })
    expect(item(ref, 'kornbrot')).toMatchObject({
      median: 4,
      samples: [4, 5, 4],
    })
  })

  it('rechnet mit dem Faktor des Backzettels in die Einheit des Postens (W4-verify r6)', () => {
    // Kassennummer = numeric_id des hq-Produkts; 500-g-Laib = 0,5 l.
    const catalog = [
      { id: 'kornbrot-500g', numeric_id: 901 },
      { id: 'kornbrot-1000g', numeric_id: 902 },
      { id: 'musterweck', numeric_id: 903 },
    ]
    writeDay('2026-11-28', [
      {
        items: [
          [901, 3],
          [902, 1],
          [903, 50],
        ],
      },
    ])
    writeDay('2026-11-21', [{ items: [[901, 5]] }])
    writeDay('2026-11-14', [
      {
        items: [
          [901, 2],
          [902, 2],
        ],
      },
    ])
    const ref = reference(6, '2026-12-02', 6, catalog)
    // 3 × 0,5 + 1 = 2,5 l; 5 × 0,5 = 2,5 l; 2 × 0,5 + 2 = 3 l
    expect(item(ref, 'kornbrot')).toMatchObject({
      samples: [2.5, 2.5, 3],
      median: 2.5,
      converted: true,
    })
    expect(item(ref, 'musterweck')).toMatchObject({
      samples: [50, 0, 0],
      converted: true,
    })
    // Kassennummer ohne zugeordnetes Produkt: Stück laut Kasse, wie bisher
    expect(item(ref, 'zopf-gefuellt').converted).toBe(false)
  })

  it('ein Tag ohne Bericht ist eine Lücke, kein 0', () => {
    writeDay('2026-11-28', [{ items: [[903, 40]] }])
    // 21.11. fehlt (Feiertag/fehlender Export)
    writeDay('2026-11-14', [{ items: [[903, 60]] }])
    const ref = reference(6, '2026-12-02', 2)
    expect(ref.dates).toEqual(['2026-11-28', '2026-11-14'])
    expect(ref.skippedDates).toEqual(['2026-11-21'])
    expect(item(ref, 'musterweck').median).toBe(50)
  })

  it('ein Tag mit Bericht, an dem nichts verkauft wurde, zählt als 0', () => {
    writeDay('2026-11-28', [{ items: [[903, 40]] }])
    writeDay('2026-11-21', [{ items: [[999, 1]] }])
    writeDay('2026-11-14', [{ items: [[903, 10]] }])
    const ref = reference(6, '2026-12-02', 3)
    expect(item(ref, 'musterweck')).toMatchObject({
      samples: [40, 0, 10],
      median: 10,
    })
  })

  it('Stornos werden saldiert, abgebrochene Belege zählen nicht', () => {
    writeDay('2026-11-28', [
      { items: [[903, 10]] },
      { type: 'storno', items: [[903, -4]] },
      { type: 'cancelled', items: [[903, 100]] },
    ])
    const ref = reference(6, '2026-12-02', 1)
    expect(item(ref, 'musterweck').samples).toEqual([6])
  })

  it('zwei Kassenabschlüsse eines Tages zählen zusammen', () => {
    writeDay('2026-11-28', [{ items: [[903, 10]] }])
    writeDay('2026-11-28', [{ items: [[903, 5]] }], '_2')
    const ref = reference(6, '2026-12-02', 1)
    expect(item(ref, 'musterweck').samples).toEqual([15])
  })

  it('Posten ohne Kassennummer: no_plu; ohne Bericht im Zeitraum: no_data', () => {
    const ref = reference(6, '2026-12-02', 6)
    expect(item(ref, 'plunder')).toMatchObject({
      status: 'no_plu',
      median: null,
    })
    expect(item(ref, 'musterweck')).toMatchObject({
      status: 'no_data',
      median: null,
    })
    expect(ref.dates).toEqual([])
  })

  it('rundet auf eine Nachkommastelle', () => {
    writeDay('2026-11-28', [{ items: [[903, 1.25]] }])
    writeDay('2026-11-21', [{ items: [[903, 2]] }])
    const ref = reference(6, '2026-12-02', 2)
    expect(item(ref, 'musterweck').median).toBe(1.7)
  })

  it('ohne converted/-Verzeichnis: keine Daten, kein Fehler', () => {
    fs.rmSync(path.join(dir, 'converted'), { recursive: true })
    expect(files.reportsAvailable(dir, () => undefined)).toBe(false)
    expect(
      reference(6, '2026-12-02').items.every((i) => i.median === null)
    ).toBe(true)
  })
})

describe('Median je Laibgröße (Z10, §9 Punkt 10)', () => {
  const { configV2, PRODUCTS_V2 } = require('../fixtures/backzettel.synthetic')

  /** Testkorn mit erfundenen Kassennummern: 971 = 500 g, 972 + 973 = 1 kg, Kasten offen. */
  function sizedConfig() {
    const raw = configV2()
    const korn = raw.items.find((i) => i.id === 'test-korn')
    korn.plu = [971, 972, 973, 974]
    korn.sizes[0].plu = [971]
    korn.sizes[1].plu = [972, 973]
    korn.sizes[2].plu = null
    expect(configCore.validateBackzettelConfig(raw).errors).toEqual([])
    return configCore.normalizeConfig(raw)
  }

  function sizedReference(cfg, weeks = 6, catalog = undefined) {
    const have = new Set(files.listReportDates(dir, () => undefined))
    const { dates, skipped } = core.referenceDates({
      weekday: 6,
      today: '2026-12-02',
      weeks,
      hasReport: (d) => have.has(d),
    })
    const reports = {}
    for (const d of dates) reports[d] = files.readDailyReport(dir, d)
    return core.computeWeekdayReference({
      config: cfg,
      weekday: 6,
      weeks,
      dates,
      skipped,
      reports,
      catalog,
    })
  }

  it('rechnet den Median je Größe über deren Kassennummern; der Posten bleibt wie bisher', () => {
    writeDay('2026-11-28', [
      {
        items: [
          [971, 4],
          [972, 1],
          [974, 2],
        ],
      },
    ])
    writeDay('2026-11-21', [
      {
        items: [
          [971, 6],
          [973, 3],
        ],
      },
    ])
    writeDay('2026-11-14', [{ items: [[972, 2]] }])
    const ref = sizedReference(sizedConfig())
    const korn = item(ref, 'test-korn')
    // Posten: alle vier Kassennummern, wie vor Z10
    expect(korn).toMatchObject({
      plu: [971, 972, 973, 974],
      samples: [7, 9, 2],
      median: 7,
      status: 'ok',
    })
    expect(korn.sizes).toEqual([
      {
        sizeId: 'g500',
        plu: [971],
        median: 4,
        samples: [4, 6, 0],
        status: 'ok',
        converted: false,
      },
      {
        sizeId: 'g1000',
        plu: [972, 973],
        median: 2,
        samples: [1, 3, 2],
        status: 'ok',
        converted: false,
      },
      // ohne Kassennummer: unbekannt - nie 0, nie ein Anteil am Posten
      {
        sizeId: 'kasten',
        plu: [],
        median: null,
        samples: [],
        status: 'unknown',
        converted: false,
      },
    ])
  })

  it('ohne Bericht im Zeitraum: no_data je Größe mit Kassennummer', () => {
    const korn = item(sizedReference(sizedConfig()), 'test-korn')
    expect(korn.status).toBe('no_data')
    expect(korn.sizes.map((s) => s.status)).toEqual([
      'no_data',
      'no_data',
      'unknown',
    ])
  })

  it('Posten mit Größen ohne sizes[].plu: jede Größe unbekannt', () => {
    writeDay('2026-11-28', [{ items: [[951, 3]] }])
    const ref = sizedReference(configCore.normalizeConfig(configV2()))
    const korn = item(ref, 'test-korn')
    expect(korn.status).toBe('no_plu')
    expect(korn.sizes.map((s) => s.status)).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ])
    // Posten ohne Größen bekommen kein sizes-Feld (v1 unverändert)
    expect('sizes' in item(ref, 'test-hafer')).toBe(false)
  })

  it('rechnet je Größe mit demselben Faktor wie der Posten (converted)', () => {
    const raw = configV2()
    const korn = raw.items.find((i) => i.id === 'test-korn')
    // Kassennummer = numeric_id des Produkts (synthetisch 951/952)
    korn.plu = [951, 952]
    korn.sizes[0].plu = [951]
    korn.sizes[1].plu = [952]
    writeDay('2026-11-28', [
      {
        items: [
          [951, 5],
          [952, 2],
        ],
      },
    ])
    const ref = sizedReference(configCore.normalizeConfig(raw), 6, PRODUCTS_V2)
    const k = item(ref, 'test-korn')
    expect(k).toMatchObject({ converted: true, median: 7 })
    expect(k.sizes[0]).toMatchObject({ converted: true, median: 5 })
    expect(k.sizes[1]).toMatchObject({ converted: true, median: 2 })
    expect(k.sizes[2].status).toBe('unknown')
  })
})

describe('berlinToday', () => {
  it('nimmt die Berliner Uhr, nicht UTC', () => {
    // 23:30 UTC am 30.11. ist in Berlin schon der 01.12.
    expect(core.berlinToday(new Date('2026-11-30T23:30:00Z'))).toBe(
      '2026-12-01'
    )
  })
})
