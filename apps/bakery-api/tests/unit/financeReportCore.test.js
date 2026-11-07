/**
 * Jahresabschluss und Monatsanalyse (`finance-report.core.js`) auf der
 * synthetischen Reihe aus `tests/fixtures/finance-report.synthetic.js`.
 * Alle Zahlen erfunden; die Erwartungen sind im Kopf nachrechenbar.
 */
const report = require('../../src/services/finance-report.core')
const {
  buildReportSummary,
  kasseMonth,
} = require('../fixtures/finance-report.synthetic')

describe('finance-report.core - monthCoverage', () => {
  const period = { from: '2025-03-15', to: '2026-05-10' }

  it('unterscheidet vollständig, angebrochen und fehlend', () => {
    expect(report.monthCoverage('2025-04', period)).toMatchObject({
      status: 'complete',
      days: 30,
    })
    expect(report.monthCoverage('2025-03', period)).toMatchObject({
      status: 'partial',
      from: '2025-03-15',
      to: '2025-03-31',
      days: 17,
    })
    expect(report.monthCoverage('2026-05', period)).toMatchObject({
      status: 'partial',
      from: '2026-05-01',
      to: '2026-05-10',
      days: 10,
      days_in_month: 31,
    })
    expect(report.monthCoverage('2025-02', period).status).toBe('missing')
    expect(report.monthCoverage('2026-06', period).status).toBe('missing')
  })

  it('kennt Schaltjahre', () => {
    expect(
      report.monthCoverage('2028-02', { from: '2028-01-01', to: '2028-02-29' })
    ).toMatchObject({ status: 'complete', days: 29 })
  })

  it('latestCompleteMonth überspringt den laufenden Monat', () => {
    expect(report.latestCompleteMonth(buildReportSummary())).toBe('2026-04')
  })
})

describe('finance-report.core - Jahresabschluss', () => {
  const summary = buildReportSummary()

  it('ein ganz abgedecktes Jahr ist abgeschlossen', () => {
    const { status, data } = report.buildYearReport(summary, '2025')
    expect(status).toBe('ok')
    expect(data.status).toBe('final')
    expect(data.statement.income.total).toBe(120000)
    expect(data.statement.expense.total).toBe(-96000)
    expect(data.statement.result).toBe(24000)
    expect(data.statement.neutral.total).toBe(-12000)
    expect(data.statement.net_change).toBe(12000)
    expect(data.projection).toBeNull()
    expect(data.months).toHaveLength(12)
    expect(data.months.every((m) => m.coverage === 'complete')).toBe(true)
    expect(data.next_year).toBe('2026')
    expect(data.previous_year).toBeNull()
    expect(data.notes.map((n) => n.key)).not.toContain('year_open')
  })

  it('gliedert mit Unterkategorien und Anteilen', () => {
    const { data } = report.buildYearReport(summary, '2025')
    const umsatz = data.statement.income.rows[0]
    expect(umsatz).toMatchObject({
      category: 'umsatz',
      amount: 120000,
      share: 1,
    })
    expect(umsatz.subcategories.map((s) => [s.label, s.amount])).toEqual([
      ['Bareinzahlung', 72000],
      ['Kartenumsatz', 36000],
      ['Rechnung', 12000],
    ])
    expect(
      data.statement.expense.rows.map((r) => [r.category, r.share])
    ).toEqual([
      ['personal', 0.5],
      ['wareneinsatz', 0.375],
      ['energie', 0.125],
    ])
    expect(data.statement.neutral.rows.map((r) => r.category)).toEqual([
      'geldtransit',
      'privat',
    ])
  })

  it('das laufende Jahr ist vorläufig, mit Hochrechnung', () => {
    const { data } = report.buildYearReport(summary, '2026')
    expect(data.status).toBe('provisional')
    expect(data.as_of).toBe('2026-05-10')
    expect(data.statement.income.total).toBe(40000)
    expect(data.statement.expense.total).toBe(-35650)
    expect(data.statement.result).toBe(4350)
    // Ergebnis = Einnahmen + Ausgaben, Kontoveränderung = Ergebnis + Neutral.
    expect(data.statement.net_change).toBe(
      Math.round((data.statement.result + data.statement.neutral.total) * 100) /
        100
    )
    expect(data.months.map((m) => m.coverage)).toEqual([
      'complete',
      'complete',
      'complete',
      'complete',
      'partial',
      ...Array(7).fill('missing'),
    ])
    expect(data.months[4].covered_to).toBe('2026-05-10')

    // Mai: Ist + Vorjahres-Mai × 21/31; Juni–Dez: Vorjahresmonate.
    expect(data.projection.income).toBe(116774.19)
    expect(data.projection.expense).toBe(-97069.35)
    expect(data.projection.result).toBe(19704.84)
    expect(data.projection.basis[4]).toEqual({
      month: '2026-05',
      source: 'partial_previous_year',
      fraction: 0.68,
    })
    expect(data.projection.basis[11].source).toBe('previous_year')
    expect(data.notes.find((n) => n.key === 'year_open').text).toContain(
      '10.05.2026'
    )
  })

  it('ohne Vorjahresmonat rechnet die Hochrechnung mit dem Schnitt', () => {
    const short = buildReportSummary({ from: '2025-06-01' })
    const { data } = report.buildYearReport(short, '2026')
    expect(data.projection.basis[4].source).toBe('partial_average')
    expect(data.projection.basis[5].source).toBe('previous_year')
    expect(data.projection.average_window).toEqual({
      from: '2025-06',
      to: '2026-04',
      months: 11,
    })
  })

  it('beginnen die Bankdaten mitten im Jahr, ist es unvollständig - ohne Hochrechnung', () => {
    const late = buildReportSummary({ from: '2025-03-15' })
    const { data } = report.buildYearReport(late, '2025')
    expect(data.status).toBe('incomplete')
    expect(data.projection).toBeNull()
    expect(data.coverage.missing_before).toEqual(['2025-01', '2025-02'])
    const note = data.notes.find((n) => n.key === 'data_start')
    expect(note.severity).toBe('warning')
    expect(note.text).toContain('15.03.2025')
    expect(note.text).toContain('Januar bis Februar fehlen')
  })

  it('Hinweise: nicht zugeordnet, Geldtransit, Grundsätze', () => {
    const { data } = report.buildYearReport(summary, '2026')
    const keys = data.notes.map((n) => n.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'unassigned',
        'transit',
        'cash_basis',
        'gross',
        'neutral',
      ])
    )
    expect(data.notes.find((n) => n.key === 'unassigned').text).toMatch(
      /^2 Buchungen sind keiner Kategorie zugeordnet \(−150,00 €\)/
    )
    expect(data.notes.find((n) => n.key === 'transit').text).toContain(
      '3.200,00 €'
    )
  })

  it('Kassenabgleich nur über vollständige Monate mit Kasse', () => {
    const kasseByMonth = {}
    for (const m of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']) {
      kasseByMonth[m] = kasseMonth()
    }
    const { data } = report.buildYearReport(summary, '2026', { kasseByMonth })
    expect(data.reconciliation).toMatchObject({
      months: 4,
      from: '2026-01',
      to: '2026-04',
      kasse_cash: 25600,
      kasse_card: 12400,
      bank_cash: 22200,
      bank_card: 11100,
      diff_total: -4700,
    })
    expect(data.kasse.revenue).toBe(47500)
    expect(data.months[0].kasse).toMatchObject({ revenue: 9500, days: 25 })
    expect(data.notes.find((n) => n.key === 'kasse_bank')).toBeTruthy()
  })

  it('kein Jahr ohne Daten, kein ungültiges Jahr', () => {
    expect(report.buildYearReport(summary, '2024').status).toBe('no-data')
    expect(report.buildYearReport(summary, '26').status).toBe('no-data')
    expect(report.availableYears(summary)).toEqual(['2026', '2025'])
  })
})

describe('finance-report.core - Monatsanalyse', () => {
  const summary = buildReportSummary()

  it('ein normaler Monat: Summen, Vergleiche, keine Auffälligkeiten', () => {
    const { data } = report.buildMonthReport(summary, '2026-02')
    expect(data).toMatchObject({
      label: 'Februar 2026',
      income: 10000,
      expense: -8000,
      result: 2000,
      previous_month: '2026-01',
      next_month: '2026-03',
    })
    expect(data.highlights).toEqual([])
    expect(data.comparison.previous_year).toMatchObject({
      month: '2025-02',
      result: 2000,
      diff_result: 0,
    })
    expect(data.comparison.average).toMatchObject({
      months: 12,
      result: 2000,
      diff_result: 0,
    })
    expect(data.highlights_reason).toBeNull()
    const energie = data.statement.expense.rows.find(
      (r) => r.category === 'energie'
    )
    expect(energie).toMatchObject({ amount: -1000, average: -1000, diff: 0 })
  })

  it('erkennt Ausreißer und neue Ausgaben', () => {
    const { data } = report.buildMonthReport(summary, '2026-03')
    expect(data.result).toBe(-1500)
    expect(data.highlights.map((h) => [h.kind, h.category])).toEqual([
      ['expense_high', 'energie'],
      ['expense_new', 'technik_wartung'],
    ])
    expect(data.highlights[0]).toMatchObject({
      ratio: 3,
      amount: -3000,
      average: -1000,
    })
    expect(data.highlights[0].text).toBe(
      'Energie & Wasser: 3.000,00 € statt üblich 1.000,00 € (3× so viel).'
    )
  })

  it('erkennt fehlende regelmäßige Zahlungen und schwache Einnahmen', () => {
    const { data } = report.buildMonthReport(summary, '2026-04')
    expect(data.highlights.map((h) => [h.kind, h.category])).toEqual([
      ['income_low', null],
      ['expense_missing', 'energie'],
    ])
    expect(data.highlights[0].text).toContain('30 % unter dem Schnitt')
    expect(data.comparison.previous_month).toMatchObject({
      month: '2026-03',
      result: -1500,
      diff_result: 1350,
    })
    expect(data.notes.map((n) => n.key)).toContain('unassigned')
  })

  it('eine Steuererstattung macht Steuern nicht zur „neuen“ Ausgabe', () => {
    const s = buildReportSummary()
    s.category_kinds.steuern = 'ausgabe'
    s.category_labels.steuern = 'Steuern'
    for (const m of s.months) {
      // Jeden Monat 400 € Abfluss, im Februar 2026 eine große Erstattung:
      // netto ist der Schnitt dann positiv, der Abfluss bleibt 400 €.
      const refund = m.month === '2026-02' ? 6000 : 0
      m.categories.steuern = {
        amount: refund - 400,
        count: refund ? 2 : 1,
        income: refund,
        expense: -400,
        subcategories: {},
      }
    }
    const { data } = report.buildMonthReport(s, '2026-03')
    expect(data.highlights.map((h) => h.category)).not.toContain('steuern')
  })

  it('der laufende Monat hat keine Auffälligkeiten, aber einen Hinweis', () => {
    const { data } = report.buildMonthReport(summary, '2026-05')
    expect(data.coverage.status).toBe('partial')
    expect(data.highlights).toEqual([])
    expect(data.reconciliation).toBeNull()
    expect(data.highlights_reason).toBe('partial')
    expect(data.comparison).toEqual({
      previous_month: null,
      previous_year: null,
      average: null,
    })
    expect(data.statement.expense.rows.every((r) => r.average === null)).toBe(
      true
    )
    expect(data.notes[0]).toMatchObject({ key: 'partial', severity: 'info' })
    expect(data.notes[0].text).toContain('10.05.2026')
    expect(data.next_month).toBeNull()
  })

  it('zu wenige Vergleichsmonate: keine Auffälligkeiten', () => {
    const s = buildReportSummary({ from: '2025-11-01' })
    const { data } = report.buildMonthReport(s, '2026-03')
    expect(data.highlights).toEqual([])
    expect(data.highlights_reason).toBe('too_few_months')
  })

  it('Kassenabgleich im Monat', () => {
    const { data } = report.buildMonthReport(summary, '2026-03', {
      kasse: kasseMonth(),
      kassePreviousYear: kasseMonth({ revenue: 9000 }),
    })
    expect(data.kasse).toMatchObject({
      revenue: 9500,
      avg_day: 380,
      cash: 6400,
    })
    expect(data.kasse_previous_year.revenue).toBe(9000)
    expect(data.reconciliation).toMatchObject({
      bank_cash: 6000,
      bank_card: 3000,
      diff_cash: -400,
      diff_card: -100,
      kasse_total: 9500,
      bank_total: 9000,
      diff_total: -500,
    })
  })

  it('unbekannter oder ungültiger Monat', () => {
    expect(report.buildMonthReport(summary, '2024-01').status).toBe('no-data')
    expect(report.buildMonthReport(summary, '2026-13').status).toBe('no-data')
  })
})
