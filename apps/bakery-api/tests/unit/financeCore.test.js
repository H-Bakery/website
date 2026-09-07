/**
 * Rechen- und Bereinigungslogik der Finanzdaten (`finance.core.js`).
 * Alle Daten sind synthetisch - siehe `tests/fixtures/finance-summary.synthetic.js`.
 */
const core = require('../../src/services/finance.core')
const {
  buildSyntheticSummary,
  FAKE_IBANS,
  FAKE_NAMES,
} = require('../fixtures/finance-summary.synthetic')

describe('finance.core - Sanitizer', () => {
  it('entfernt Kontonummern, Klarnamen und Einzelbuchungen', () => {
    const raw = buildSyntheticSummary()
    const clean = core.sanitizeSummary(raw)

    expect(clean).not.toHaveProperty('accounts')
    expect(clean).not.toHaveProperty('top_counterparties')
    expect(clean.uncategorized).toEqual({ count: 3, amount: -500 })
    expect(clean.uncategorized).not.toHaveProperty('transactions')

    const serialized = JSON.stringify(clean)
    for (const iban of FAKE_IBANS) expect(serialized).not.toContain(iban)
    for (const name of FAKE_NAMES) expect(serialized).not.toContain(name)
    expect(serialized).not.toMatch(/DE\d{2}\s?\d{4}/)
    expect(serialized).not.toContain('Rechnung 4711')
  })

  it('ist eine Whitelist - unbekannte Felder kommen nicht durch', () => {
    const raw = buildSyntheticSummary()
    raw.new_export_field = { holder: FAKE_NAMES[0] }
    raw.months[0].note = FAKE_NAMES[1]
    raw.months[0].categories.personal.employees = FAKE_NAMES
    const clean = core.sanitizeSummary(raw)
    const serialized = JSON.stringify(clean)
    expect(clean).not.toHaveProperty('new_export_field')
    for (const name of FAKE_NAMES) expect(serialized).not.toContain(name)
  })

  it('behält die Summen, Labels und Monatszeilen', () => {
    const raw = buildSyntheticSummary()
    const clean = core.sanitizeSummary(raw)
    expect(clean.generated_at).toBe(raw.generated_at)
    expect(clean.period).toEqual(raw.period)
    expect(clean.transaction_count).toBe(117)
    expect(clean.category_labels.umsatz).toBe('Umsatzerlöse')
    expect(clean.category_kinds.privat).toBe('neutral')
    expect(clean.totals.wareneinsatz.expense).toBe(-12000)
    expect(clean.months).toHaveLength(3)
    expect(clean.months[0].categories.umsatz.subcategories).toEqual({
      bar: 6000,
      karte: 4000,
    })
  })

  it('verändert das Original nicht', () => {
    const raw = buildSyntheticSummary()
    const before = JSON.stringify(raw)
    core.sanitizeSummary(raw)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('sortiert Monate und wirft kaputte Monatsschlüssel weg', () => {
    const raw = buildSyntheticSummary()
    raw.months.reverse()
    raw.months.push({ month: 'kaputt', operating_income: 1 })
    const clean = core.sanitizeSummary(raw)
    expect(clean.months.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })
})

describe('finance.core - Schema', () => {
  it('akzeptiert schema_version 1', () => {
    const parsed = core.parseSummary(JSON.stringify(buildSyntheticSummary()))
    expect(parsed.status).toBe('ok')
    expect(parsed.summary).not.toHaveProperty('accounts')
  })

  it('lehnt eine fremde schema_version als no-data ab', () => {
    const raw = buildSyntheticSummary()
    raw.schema_version = 2
    const parsed = core.parseSummary(JSON.stringify(raw))
    expect(parsed.status).toBe('no-data')
    expect(parsed.reason).toContain('schema_version')
  })

  it('lehnt fehlende schema_version und fehlende Monate ab', () => {
    const raw = buildSyntheticSummary()
    delete raw.schema_version
    expect(core.parseSummary(JSON.stringify(raw)).status).toBe('no-data')

    const noMonths = buildSyntheticSummary()
    delete noMonths.months
    expect(core.validateSummary(noMonths).ok).toBe(false)
  })

  it('wirft bei kaputtem JSON nicht, sondern meldet no-data', () => {
    expect(core.parseSummary('{ nicht json').status).toBe('no-data')
    expect(core.parseSummary('[]').status).toBe('no-data')
    expect(core.parseSummary('null').status).toBe('no-data')
  })
})

describe('finance.core - Invariante', () => {
  it('Einnahmen + Ausgaben + Neutral = Kontoveränderung geht auf', () => {
    const result = core.checkInvariant(buildSyntheticSummary())
    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('gilt auch für die bereinigte Fassung', () => {
    const clean = core.sanitizeSummary(buildSyntheticSummary())
    expect(core.checkInvariant(clean).ok).toBe(true)
  })

  it('meldet einen Monat, in dem die Summe nicht stimmt', () => {
    const raw = buildSyntheticSummary()
    raw.months[1].net_change += 10
    const result = core.checkInvariant(raw)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(2) // Monat + Gesamtsumme
    expect(result.violations[0]).toMatchObject({
      month: '2026-02',
      rule: 'income + expense + neutral = net_change',
      diff: 10,
    })
  })

  it('meldet ein Ergebnis, das nicht Einnahmen + Ausgaben ist', () => {
    const raw = buildSyntheticSummary()
    raw.months[0].operating_result = 0
    const result = core.checkInvariant(raw)
    expect(result.ok).toBe(false)
    expect(result.violations[0].rule).toBe(
      'income + expense = operating_result'
    )
  })

  it('toleriert Rundung auf den Cent', () => {
    const raw = buildSyntheticSummary()
    raw.months[0].operating_income = 0.1
    raw.months[0].operating_expense = 0.2
    raw.months[0].neutral = 0
    raw.months[0].operating_result = 0.3
    raw.months[0].net_change = 0.3
    raw.totals = { umsatz: { amount: 0.3 + 2700 + 2000 } }
    expect(core.checkInvariant(raw).ok).toBe(true)
  })
})

describe('finance.core - Monatsreihe', () => {
  it('liefert Einnahmen/Ausgaben/Ergebnis/Neutral/net_change je Monat', () => {
    const series = core.monthSeries(buildSyntheticSummary())
    expect(series).toHaveLength(3)
    expect(series[0]).toEqual({
      month: '2026-01',
      transactions: 40,
      income: 10000,
      expense: -7000,
      result: 3000,
      neutral: -500,
      net_change: 2500,
    })
  })

  it('schränkt inklusiv auf from..to ein', () => {
    const summary = buildSyntheticSummary()
    expect(
      core.monthSeries(summary, { from: '2026-02' }).map((m) => m.month)
    ).toEqual(['2026-02', '2026-03'])
    expect(
      core.monthSeries(summary, { to: '2026-02' }).map((m) => m.month)
    ).toEqual(['2026-01', '2026-02'])
    expect(
      core.monthSeries(summary, { from: '2026-02', to: '2026-02' })
    ).toHaveLength(1)
    expect(core.monthSeries(summary, { from: '2027-01' })).toEqual([])
  })

  it('prüft Monatsparameter', () => {
    expect(core.isValidMonthParam('2026-02')).toBe(true)
    expect(core.isValidMonthParam(undefined)).toBe(true)
    expect(core.isValidMonthParam('')).toBe(true)
    expect(core.isValidMonthParam('2026-13')).toBe(false)
    expect(core.isValidMonthParam('2026-2')).toBe(false)
    expect(core.isValidMonthParam('2026-02-01')).toBe(false)
  })
})

describe('finance.core - Auswertungen', () => {
  it('summiert die Übersicht über den Zeitraum', () => {
    const ov = core.overview(buildSyntheticSummary())
    expect(ov).toEqual({
      months: 3,
      from: '2026-01',
      to: '2026-03',
      transactions: 117,
      income: 30000,
      expense: -21500,
      result: 8500,
      neutral: -1300,
      net_change: 7200,
    })
  })

  it('bildet die Kostenstruktur aus Ausgaben und Offenem, größter Abfluss zuerst', () => {
    const costs = core.costStructure(buildSyntheticSummary())
    expect(costs.map((c) => c.category)).toEqual([
      'wareneinsatz',
      'personal',
      'unkategorisiert',
    ])
    expect(costs[0].label).toBe('Wareneinsatz')
    expect(costs[0].share).toBeCloseTo(12000 / 21500, 6)
    expect(costs.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 6)
    // Neutrale Kategorien (Privat, Geldtransit) sind keine Kosten.
    expect(costs.find((c) => c.category === 'privat')).toBeUndefined()
  })

  it('bildet die Einnahmenstruktur', () => {
    const income = core.incomeStructure(buildSyntheticSummary())
    expect(income).toHaveLength(1)
    expect(income[0]).toMatchObject({ category: 'umsatz', share: 1 })
  })

  it('buildSummaryResponse ist bereinigt und trägt die Ableitungen', () => {
    const response = core.buildSummaryResponse(buildSyntheticSummary())
    const serialized = JSON.stringify(response)
    for (const iban of FAKE_IBANS) expect(serialized).not.toContain(iban)
    for (const name of FAKE_NAMES) expect(serialized).not.toContain(name)
    expect(response.derived.series).toHaveLength(3)
    expect(response.derived.cost_structure[0].category).toBe('wareneinsatz')
    expect(response.derived.invariant.ok).toBe(true)
    expect(response.derived.overview.net_change).toBe(7200)
  })
})

describe('finance.core - Kategorien über den Zeitraum', () => {
  it('ohne Filter entsprechen die Monatssummen den totals', () => {
    const raw = buildSyntheticSummary()
    const agg = core.aggregateCategories(raw)
    for (const [slug, bucket] of Object.entries(raw.totals)) {
      expect(agg[slug]).toEqual(bucket)
    }
  })

  it('Kostenstruktur eines einzelnen Monats', () => {
    const costs = core.costStructure(buildSyntheticSummary(), {
      from: '2026-02',
      to: '2026-02',
    })
    expect(costs.map((c) => c.category)).toEqual(['wareneinsatz', 'personal'])
    expect(costs[0].expense).toBe(-3500)
    expect(costs[0].share).toBeCloseTo(3500 / 6500, 6)
  })
})
