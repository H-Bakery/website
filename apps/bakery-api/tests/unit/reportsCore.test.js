/**
 * Tests für die Rechenlogik der Kassenberichte (TASK-038).
 *
 * Alle Fixtures sind synthetisch - keine echten Tagesfiles aus `hq`. Die
 * Erwartungswerte sind von Hand aus den Formeln abgeleitet:
 *
 *   Umsatz  = Σ Bon-Total (ohne abgebrochene Belege, Stornos negativ)
 *   Bons    = Verkaufsbons (ohne Storno-Gegenbuchungen, ohne Abbrüche)
 *   Ø Bon   = Umsatz / Bons
 *   Karte   = payment 'Unbar'
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const core = require('../../src/services/reports.core')
const files = require('../../src/services/reports-files.core')

// --- Fixtures ---------------------------------------------------------------

let txCounter = 0

function tx(overrides) {
  txCounter += 1
  const items = overrides.items || [
    { product: 'Testbrot', product_id: '101', quantity: 1, price: 4, total: 4 },
  ]
  return {
    id: `T${txCounter}`,
    timestamp: '2026-03-10T08:15:00+01:00',
    type: 'sale',
    user: 'Kasse',
    payment: 'Bar',
    total: items.reduce((s, i) => s + i.total, 0),
    ...overrides,
    items,
  }
}

function day(date, transactions, extra) {
  return {
    date,
    register_id: '4711',
    report_number: 1,
    company: 'Testbäckerei',
    transactions,
    ...extra,
  }
}

const BROT = {
  product: 'Testbrot',
  product_id: '101',
  quantity: 1,
  price: 4,
  total: 4,
}
const HOERNCHEN = {
  product: 'Testhörnchen',
  product_id: '102',
  quantity: 2,
  price: 1.5,
  total: 3,
}

// --- Dateinamen ---------------------------------------------------------------

describe('parseReportFilename', () => {
  it('zerlegt Tag, Kasse und Abschlussnummer', () => {
    expect(core.parseReportFilename('2026-03-10_4711.json')).toEqual({
      filename: '2026-03-10_4711.json',
      date: '2026-03-10',
      registerId: '4711',
      closing: 1,
    })
    expect(core.parseReportFilename('2026-03-10_4711_2.json')).toMatchObject({
      date: '2026-03-10',
      closing: 2,
    })
  })

  it('ignoriert alles, was kein Tagesfile ist', () => {
    expect(core.parseReportFilename('README.md')).toBeNull()
    expect(core.parseReportFilename('2026-02-30_4711.json')).toBeNull()
    expect(core.parseReportFilename('conversion-log.json')).toBeNull()
  })
})

// --- Tag ------------------------------------------------------------------------

describe('aggregateDay', () => {
  it('rechnet Umsatz, Bons, Ø Bon und Zahlungsmix - Unbar ist Karte', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        filename: '2026-03-10_4711.json',
        data: day('2026-03-10', [
          tx({ items: [BROT], payment: 'Bar' }), // 4,00 bar
          tx({ items: [HOERNCHEN], payment: 'Unbar' }), // 3,00 Karte
          tx({ items: [BROT, HOERNCHEN], payment: 'Unbar' }), // 7,00 Karte
        ]),
      },
    ])

    expect(report.status).toBe('ok')
    expect(report.weekday).toBe('Dienstag')
    expect(report.revenue).toBe(14)
    expect(report.receiptCount).toBe(3)
    expect(report.avgReceipt).toBeCloseTo(4.67, 2)
    expect(report.payments.cash).toEqual({ amount: 4, count: 1 })
    expect(report.payments.card).toEqual({ amount: 10, count: 2 })
    expect(report.payments.other).toEqual({ amount: 0, count: 0 })
    expect(report.cardShare).toBeCloseTo(71.4, 1)
    expect(report.cashShare).toBeCloseTo(28.6, 1)
    expect(report.closingCount).toBe(1)
    expect(report.closings[0]).toMatchObject({
      registerId: '4711',
      reportNumber: 1,
      transactionCount: 3,
    })
  })

  it('unterscheidet „kein Bericht" von „Umsatz 0"', () => {
    expect(core.aggregateDay('2026-03-11', [])).toEqual({
      status: 'no-data',
      date: '2026-03-11',
      weekday: 'Mittwoch',
    })

    const empty = core.aggregateDay('2026-03-11', [
      { data: day('2026-03-11', []) },
    ])
    expect(empty.status).toBe('ok')
    expect(empty.revenue).toBe(0)
    expect(empty.receiptCount).toBe(0)
    expect(empty.avgReceipt).toBe(0)
  })

  it('neutralisiert ein Storno-Paar in Umsatz und Menge, zählt es aber nicht als Bon', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        data: day('2026-03-10', [
          tx({ items: [BROT] }), // Fehleingabe: 4,00
          tx({
            type: 'storno',
            items: [{ ...BROT, quantity: -1, total: -4 }],
            total: -4,
          }),
          tx({ items: [HOERNCHEN] }), // echter Verkauf: 3,00
        ]),
      },
    ])

    expect(report.revenue).toBe(3)
    // Der stornierte Bon bleibt gezählt, die Gegenbuchung nicht - sonst
    // stünden zwei Bons für einen Vorgang da, der nie stattfand.
    expect(report.receiptCount).toBe(2)
    expect(report.stornoCount).toBe(1)
    expect(report.stornoAmount).toBe(-4)
    expect(report.avgReceipt).toBe(1.5)

    const brot = report.products.find((p) => p.productId === '101')
    expect(brot).toMatchObject({ quantity: 0, revenue: 0 })
    expect(report.products[0]).toMatchObject({
      productId: '102',
      quantity: 2,
      revenue: 3,
    })
  })

  it('lässt eine Gegenbuchung ohne Ursprungsbon als negative Menge sichtbar', () => {
    const report = core.aggregateDay('2026-03-11', [
      {
        data: day('2026-03-11', [
          tx({
            items: [{ ...BROT, quantity: -1, total: -4 }],
            total: -4,
          }),
        ]),
      },
    ])
    expect(report.revenue).toBe(-4)
    expect(report.products[0].quantity).toBe(-1)
  })

  it('addiert einen zweiten Abschluss am selben Tag statt ihn zu ersetzen', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        filename: '2026-03-10_4711.json',
        data: day('2026-03-10', [tx({ items: [BROT] })]),
      },
      {
        filename: '2026-03-10_4711_2.json',
        data: day(
          '2026-03-10',
          [tx({ items: [HOERNCHEN], payment: 'Unbar' })],
          { report_number: 2 }
        ),
      },
    ])

    expect(report.closingCount).toBe(2)
    expect(report.closings.map((c) => c.reportNumber)).toEqual([1, 2])
    expect(report.revenue).toBe(7)
    expect(report.receiptCount).toBe(2)
    expect(report.payments.cash.amount).toBe(4)
    expect(report.payments.card.amount).toBe(3)
  })

  it('zählt abgebrochene Belege weder zum Umsatz noch zu den Bons', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        data: day('2026-03-10', [
          tx({ items: [BROT] }),
          tx({ type: 'cancelled', items: [BROT, HOERNCHEN], total: 7 }),
        ]),
      },
    ])
    expect(report.revenue).toBe(4)
    expect(report.receiptCount).toBe(1)
    expect(report.cancelledCount).toBe(1)
    expect(report.products.find((p) => p.productId === '102')).toBeUndefined()
  })

  it('sortiert Zahlungen ohne Zahlungsart unter „Sonstige" und rechnet in Cent', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        data: day('2026-03-10', [
          tx({ payment: 'Keine', items: [{ ...BROT, price: 0, total: 0 }] }),
          tx({ items: [{ ...BROT, price: 0.1, total: 0.1 }] }),
          tx({ items: [{ ...BROT, price: 0.2, total: 0.2 }] }),
        ]),
      },
    ])
    expect(report.payments.other).toEqual({ amount: 0, count: 1 })
    // 0.1 + 0.2 wäre in Fließkomma 0.30000000000000004
    expect(report.revenue).toBe(0.3)
    expect(report.receiptCount).toBe(3)
  })

  it('liefert Stundenverlauf und Kassenzeiten ohne Zeitzonenumrechnung', () => {
    const report = core.aggregateDay('2026-03-10', [
      {
        data: day('2026-03-10', [
          tx({ timestamp: '2026-03-10T06:40:00+01:00', items: [BROT] }),
          tx({ timestamp: '2026-03-10T06:55:00+01:00', items: [BROT] }),
          tx({ timestamp: '2026-03-10T11:05:00+01:00', items: [HOERNCHEN] }),
        ]),
      },
    ])
    expect(report.firstReceipt).toBe('06:40')
    expect(report.lastReceipt).toBe('11:05')
    expect(report.hours).toEqual([
      { hour: '06', revenue: 8, receiptCount: 2 },
      { hour: '11', revenue: 3, receiptCount: 1 },
    ])
  })

  it('toDailySummary lässt Positionen und Stunden weg, Kennzahlen bleiben', () => {
    const report = core.aggregateDay('2026-03-10', [
      { data: day('2026-03-10', [tx({ items: [BROT] })]) },
    ])
    const summary = core.toDailySummary(report)
    expect(summary.products).toBeUndefined()
    expect(summary.hours).toBeUndefined()
    expect(summary.revenue).toBe(4)
    expect(core.toDailySummary({ status: 'no-data', date: 'x' })).toEqual({
      status: 'no-data',
      date: 'x',
    })
  })
})

// --- Zeitraum / Monat ------------------------------------------------------------

describe('aggregateRange / aggregateMonth', () => {
  const march = [
    core.aggregateDay('2026-03-10', [
      { data: day('2026-03-10', [tx({ items: [BROT] })]) }, // Di, 4,00
    ]),
    core.aggregateDay('2026-03-11', []), // Lücke
    core.aggregateDay('2026-03-12', [
      {
        data: day('2026-03-12', [
          tx({ items: [BROT, HOERNCHEN], payment: 'Unbar' }), // Do, 7,00
          tx({ items: [HOERNCHEN] }), // 3,00
        ]),
      },
    ]),
  ]

  it('verdichtet Tage und zählt fehlende Tage als Lücke, nicht als 0', () => {
    const range = core.aggregateRange('2026-03-10', '2026-03-13', march)
    expect(range.status).toBe('ok')
    expect(range.dayCount).toBe(2)
    expect(range.missingDays).toEqual(['2026-03-11', '2026-03-13'])
    expect(range.revenue).toBe(14)
    expect(range.receiptCount).toBe(3)
    expect(range.avgReceipt).toBeCloseTo(4.67, 2)
    expect(range.avgDayRevenue).toBe(7)
    expect(range.bestDay).toMatchObject({ date: '2026-03-12', revenue: 10 })
    expect(range.weakestDay).toMatchObject({ date: '2026-03-10', revenue: 4 })
    expect(range.payments.card).toEqual({ amount: 7, count: 1 })
    expect(range.cardShare).toBe(50)
    expect(range.products[0]).toMatchObject({
      productId: '101',
      quantity: 2,
      revenue: 8,
    })
    expect(range.products[1]).toMatchObject({
      productId: '102',
      quantity: 4,
      revenue: 6,
    })
    expect(range.weekdays.map((w) => w.weekday)).toEqual([
      'Dienstag',
      'Donnerstag',
    ])
  })

  it('meldet no-data, wenn kein Tag im Zeitraum einen Bericht hat', () => {
    const range = core.aggregateRange('2026-04-01', '2026-04-02', [
      core.aggregateDay('2026-04-01', []),
    ])
    expect(range.status).toBe('no-data')
    expect(range.dayCount).toBe(0)
    expect(range.missingDays).toEqual(['2026-04-01', '2026-04-02'])
  })

  it('aggregateMonth nimmt nur Tage des Monats und benennt ihn deutsch', () => {
    const month = core.aggregateMonth('2026-03', [
      ...march,
      core.aggregateDay('2026-04-01', [
        { data: day('2026-04-01', [tx({ items: [BROT] })]) },
      ]),
    ])
    expect(month.status).toBe('ok')
    expect(month.label).toBe('März 2026')
    expect(month.from).toBe('2026-03-01')
    expect(month.to).toBe('2026-03-31')
    expect(month.dayCount).toBe(2)
    expect(month.revenue).toBe(14)
    expect(month.missingDays).toHaveLength(29)
    expect(core.aggregateMonth('2026-13', march).status).toBe('no-data')
  })
})

// --- Umsatzreihe ------------------------------------------------------------------

describe('groupByPeriod', () => {
  const days = [
    core.aggregateDay('2025-12-29', [
      { data: day('2025-12-29', [tx({ items: [BROT] })]) }, // Mo, KW 1/2026
    ]),
    core.aggregateDay('2026-01-03', [
      { data: day('2026-01-03', [tx({ items: [HOERNCHEN] })]) }, // Sa, KW 1
    ]),
    core.aggregateDay('2026-01-05', [
      { data: day('2026-01-05', [tx({ items: [BROT, HOERNCHEN] })]) }, // Mo, KW 2
    ]),
    core.aggregateDay('2026-01-06', []),
  ]

  it('täglich: ein Punkt je Tag mit Bericht, Lücken fehlen', () => {
    const series = core.groupByPeriod(days, 'daily')
    expect(series.map((p) => p.date)).toEqual([
      '2025-12-29',
      '2026-01-03',
      '2026-01-05',
    ])
    expect(series[2]).toEqual({
      date: '2026-01-05',
      revenue: 7,
      transactionCount: 1,
      dayCount: 1,
    })
  })

  it('wöchentlich: ISO-Wochen ab Montag, Jahreswechsel inklusive', () => {
    const series = core.groupByPeriod(days, 'weekly')
    expect(series).toEqual([
      {
        date: '2025-12-29',
        week: '2026-W01',
        revenue: 7,
        transactionCount: 2,
        dayCount: 2,
      },
      {
        date: '2026-01-05',
        week: '2026-W02',
        revenue: 7,
        transactionCount: 1,
        dayCount: 1,
      },
    ])
  })

  it('monatlich: Monatsanfang als Datum', () => {
    const series = core.groupByPeriod(days, 'monthly')
    expect(series.map((p) => [p.date, p.revenue, p.dayCount])).toEqual([
      ['2025-12-01', 4, 1],
      ['2026-01-01', 10, 2],
    ])
  })
})

// --- Kalender-Helfer ------------------------------------------------------------

describe('Kalender', () => {
  it('validiert Daten und Monate streng', () => {
    expect(core.isValidDate('2026-02-28')).toBe(true)
    expect(core.isValidDate('2026-02-30')).toBe(false)
    expect(core.isValidDate('26-2-3')).toBe(false)
    expect(core.isValidMonth('2026-12')).toBe(true)
    expect(core.isValidMonth('2026-00')).toBe(false)
  })

  it('listet Kalendertage inklusive Grenzen und über Monatsgrenzen', () => {
    expect(core.listDates('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ])
    expect(core.listDates('2026-02-02', '2026-02-01')).toEqual([])
  })

  it('kennt Monatsgrenzen und Schaltjahre', () => {
    expect(core.monthBounds('2024-02')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
    expect(core.monthBounds('2026-02').to).toBe('2026-02-28')
  })

  it('rechnet ISO-Wochen', () => {
    expect(core.isoWeek('2026-01-01')).toBe('2026-W01')
    expect(core.isoWeek('2027-01-01')).toBe('2026-W53')
    expect(core.isoWeekStart('2026-01-04')).toBe('2025-12-29')
  })
})

// --- Datei-Lese-Schicht -------------------------------------------------------

describe('reports-files.core', () => {
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-core-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function writeDay(name, data) {
    const dir = path.join(root, 'converted')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data))
  }

  it('meldet ein fehlendes Verzeichnis einmal und antwortet leer statt zu werfen', () => {
    const missing = path.join(root, 'gibt-es-nicht')
    const log = jest.fn()
    expect(files.reportsAvailable(missing, log)).toBe(false)
    expect(files.listReportFiles(missing, log)).toEqual([])
    expect(files.readDailyReport(missing, '2026-03-10', log)).toEqual({
      status: 'no-data',
      date: '2026-03-10',
      weekday: 'Dienstag',
    })
    expect(
      files.readDailyReportsInRange(missing, '2026-03-01', '2026-03-31', log)
    ).toEqual([])
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('HQ reports directory not found')
  })

  it('löst das Verzeichnis über HQ_REPORTS_DIR oder <website>/../hq auf', () => {
    expect(
      files.resolveReportsDir('/repo/website', { HQ_REPORTS_DIR: '/x' })
    ).toBe('/x')
    expect(files.resolveReportsDir('/repo/website', {})).toBe(
      path.join('/repo', 'hq', 'data', 'reports')
    )
  })

  it('liest Tage, fasst zwei Abschlüsse zusammen und überspringt kaputte Dateien', () => {
    writeDay('2026-03-10_4711.json', day('2026-03-10', [tx({ items: [BROT] })]))
    writeDay(
      '2026-03-10_4711_2.json',
      day('2026-03-10', [tx({ items: [HOERNCHEN], payment: 'Unbar' })])
    )
    writeDay('2026-03-12_4711.json', day('2026-03-12', [tx({ items: [BROT] })]))
    fs.writeFileSync(path.join(root, 'converted', '2026-03-13_4711.json'), '{')
    fs.writeFileSync(path.join(root, 'converted', 'notes.txt'), 'x')
    const log = jest.fn()

    expect(files.listReportDates(root, log)).toEqual([
      '2026-03-10',
      '2026-03-12',
      '2026-03-13',
    ])

    const single = files.readDailyReport(root, '2026-03-10', log)
    expect(single.closingCount).toBe(2)
    expect(single.revenue).toBe(7)

    const range = files.readDailyReportsInRange(
      root,
      '2026-03-01',
      '2026-03-31',
      log
    )
    expect(range.map((r) => r.date)).toEqual(['2026-03-10', '2026-03-12'])
    expect(files.readDailyReport(root, '2026-03-11', log).status).toBe(
      'no-data'
    )
    expect(files.readDailyReport(root, '2026-03-13', log).status).toBe(
      'no-data'
    )
    expect(log).toHaveBeenCalled()
    expect(log.mock.calls[0][0]).toContain('2026-03-13_4711.json')
  })
})
