import {
  cumulativePoints,
  expenseBars,
  flowExtremes,
  hasEstimates,
  incomeParts,
  shortMonth,
  trendFlowPoints,
  yearFlowPoints,
} from './financeCharts'
import {
  completeMonthFixture,
  finalYearFixture,
  partialMonthFixture,
  provisionalYearFixture,
} from './financeReportFixtures'

describe('financeCharts - Jahr', () => {
  it('trennt Ist und Schätzung je Monat, Ergebnis durchgezogen bzw. gestrichelt', () => {
    const points = yearFlowPoints(provisionalYearFixture())
    expect(points).toHaveLength(12)
    expect(points[0]).toMatchObject({
      key: '2026-01',
      label: 'Jan',
      sublabel: '2026',
      income: 10000,
      expense: -8400,
      estIncome: 0,
      result: 1600,
      openResult: null,
      open: false,
    })
    // September schließt die gestrichelte Linie an.
    expect(points[8]).toMatchObject({ result: 1600, openResult: 1600 })
    // Oktober: Ist bis 15. + geschätzter Rest, Ergebnis hochgerechnet.
    expect(points[9]).toMatchObject({
      income: 6000,
      expense: -4400,
      estIncome: 4000,
      estExpense: -3600,
      result: null,
      openResult: 2000,
      open: true,
    })
    expect(points[9].title).toBe(
      'Oktober 2026 · Ist bis 15.10., Rest geschätzt'
    )
    expect(points[9].tooltip[0]).toEqual({
      label: 'Einnahmen',
      value: expect.stringContaining('10.000,00'),
      hint: expect.stringContaining('davon geschätzt 4.000,00'),
    })
    // November: nur geschätzt.
    expect(points[10]).toMatchObject({
      income: null,
      expense: null,
      estIncome: 9000,
      estExpense: -7200,
      openResult: 1800,
    })
    expect(hasEstimates(points)).toBe(true)
  })

  it('ein abgeschlossenes Jahr hat nichts Geschätztes und nichts Offenes', () => {
    const points = yearFlowPoints(finalYearFixture())
    expect(hasEstimates(points)).toBe(false)
    expect(points.every((p) => !p.open && p.result === 1500)).toBe(true)
    expect(points.every((p) => p.openResult === null)).toBe(true)
  })

  it('ohne Hochrechnung bleiben künftige Monate leer', () => {
    const report = { ...provisionalYearFixture(), projection: null }
    const points = yearFlowPoints(report)
    expect(points[9]).toMatchObject({
      income: 6000,
      estIncome: 0,
      result: null,
      openResult: 1600,
      open: true,
    })
    expect(points[11]).toMatchObject({
      income: null,
      openResult: null,
      tooltip: [{ label: 'Keine Bankdaten', value: '' }],
    })
  })

  it('aufgelaufenes Ergebnis: Ist bis zum Stichtag, Hochrechnung ab dem letzten vollen Monat', () => {
    const points = cumulativePoints(provisionalYearFixture())
    expect(points.map((p) => p.actual)).toEqual([
      1600,
      3200,
      4800,
      6400,
      8000,
      9600,
      11200,
      12800,
      14400,
      16000,
      null,
      null,
    ])
    expect(points.map((p) => p.projected)).toEqual([
      ...Array(8).fill(null),
      14400,
      16400,
      18200,
      20000,
    ])
    expect(points[11].projected).toBe(
      provisionalYearFixture().projection?.result
    )
  })

  it('bester und schwächster Monat nur über abgeschlossene Monate', () => {
    const report = provisionalYearFixture()
    report.months[2] = { ...report.months[2], result: -500 }
    report.months[5] = { ...report.months[5], result: 3000 }
    const extremes = flowExtremes(yearFlowPoints(report))
    expect(extremes?.best.key).toBe('2026-06')
    expect(extremes?.worst.key).toBe('2026-03')
    expect(flowExtremes(yearFlowPoints(finalYearFixture()))).toBeNull()
  })
})

describe('financeCharts - Herkunft und Posten', () => {
  it('teilt den Umsatz in seine Unterkategorien, größter Teil zuerst', () => {
    const parts = incomeParts(provisionalYearFixture().statement)
    expect(parts.map((p) => [p.label, p.value])).toEqual([
      ['Bareinzahlungen', 50000],
      ['Kartenzahlungen', 38000],
      ['Verkaufspartner', 6000],
      ['Sonstige', 2000],
    ])
    expect(parts.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1)
  })

  it('fasst über die Grenze hinaus zu „Übrige“ zusammen', () => {
    const parts = incomeParts(provisionalYearFixture().statement, 3)
    expect(parts.map((p) => p.label)).toEqual([
      'Bareinzahlungen',
      'Kartenzahlungen',
      'Übrige (2)',
    ])
    expect(parts[2].value).toBe(8000)
  })

  it('Ausgaben als positive Balken, größte zuerst, Rest als „Übrige“', () => {
    const statement = provisionalYearFixture().statement
    expect(expenseBars(statement).map((b) => [b.label, b.value])).toEqual([
      ['Wareneinkauf', 40000],
      ['Personal', 24000],
      ['Miete', 9600],
      ['Nicht zugeordnet', 6400],
    ])
    const grouped = expenseBars(statement, 2)
    expect(grouped).toHaveLength(3)
    expect(grouped[2]).toMatchObject({
      key: 'uebrige',
      label: 'Übrige (2 Posten)',
      value: 16000,
    })
    expect(grouped[2].share).toBeCloseTo(0.2)
  })

  it('trägt den Ø als positive Größe; eine Erstattung hat keinen Balken', () => {
    const statement = completeMonthFixture().statement
    const bars = expenseBars(statement)
    expect(bars.find((b) => b.key === 'reparatur')).toMatchObject({
      value: 1000,
      average: 50,
      refund: false,
    })
    const refund = expenseBars({
      ...statement,
      expense: {
        ...statement.expense,
        rows: [
          ...statement.expense.rows,
          {
            ...statement.expense.rows[0],
            category: 'steuern',
            label: 'Steuern',
            amount: 300,
            average: -200,
          },
        ],
      },
    }).find((b) => b.key === 'steuern')
    expect(refund).toMatchObject({ value: 0, average: 200, refund: true })
  })
})

describe('financeCharts - Verlauf der Monatsanalyse', () => {
  it('13 Monate, Jahr unter dem ersten Monat und unter Januar', () => {
    const points = trendFlowPoints(completeMonthFixture())
    expect(points).toHaveLength(13)
    expect(points[0]).toMatchObject({ key: '2025-09', sublabel: '2025' })
    expect(points.find((p) => p.key === '2026-01')?.sublabel).toBe('2026')
    expect(points.find((p) => p.key === '2026-02')?.sublabel).toBeUndefined()
    expect(points[12]).toMatchObject({
      key: '2026-09',
      result: 1600,
      open: false,
    })
  })

  it('der laufende Monat ist offen und gestrichelt angeschlossen', () => {
    const points = trendFlowPoints(partialMonthFixture())
    expect(points[12]).toMatchObject({
      key: '2026-10',
      open: true,
      result: null,
      openResult: 1600,
    })
    expect(points[12].title).toBe('Oktober 2026 · bis 15.10.')
    expect(points[11].openResult).toBe(points[11].result)
    expect(points[12].tooltip[2].label).toBe('Ergebnis bisher')
  })

  it('Monatskürzel', () => {
    expect(shortMonth('2026-03')).toBe('Mär')
    expect(shortMonth('2026-12')).toBe('Dez')
  })
})
