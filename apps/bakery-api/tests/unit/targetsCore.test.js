/**
 * Rechenlogik der Tagesziel-Ampel (`targets.core.js`).
 *
 * Alle Zahlen hier sind erfunden und rund gewählt, damit man die Formeln im
 * Kopf nachrechnen kann - kein Wert stammt aus dem privaten `hq`-Repo.
 */
const core = require('../../src/services/targets.core')

// ---------------------------------------------------------------------------
// Synthetische Bausteine
// ---------------------------------------------------------------------------

/** Eine plausible Config im Modus `derived`. */
function derivedConfig(overrides = {}) {
  return {
    schema_version: 1,
    updated: '2026-06-01',
    mode: 'derived',
    cost_window_months: 3,
    variable_categories: ['wareneinsatz', 'verpackung'],
    non_pos_revenue_monthly: null,
    private_draw_monthly: null,
    business_days_per_month: 20,
    weekday_window_months: 3,
    thresholds: { green: 1.0, amber: 0.9 },
    closed_weekdays: [1],
    ...overrides,
  }
}

function manualConfig(overrides = {}) {
  return derivedConfig({
    mode: 'manual',
    fixed_costs_monthly: 8000,
    variable_cost_ratio: 0.2,
    non_pos_revenue_monthly: 0,
    private_draw_monthly: 2000,
    cost_window_months: undefined,
    variable_categories: undefined,
    ...overrides,
  })
}

function bucket(amount, subcategories = {}) {
  return {
    amount,
    count: 1,
    income: amount > 0 ? amount : 0,
    expense: amount < 0 ? amount : 0,
    subcategories,
  }
}

/**
 * Drei identische Monate: Einnahmen 10000 (davon 8000 Kasse, 2000 Rechnung),
 * variable Kosten 3000, Fixkosten 4000, Geldtransit −1000.
 *   Kostenquote          = 3000 / 10000 = 0.3
 *   Deckungsbeitragsquote = 0.7
 *   Break-even            = 4000 / 0.7 = 5714.29
 *   Kassenziel            = 5714.29 − 2000 = 3714.29
 *   Tagesbasis            = 3714.29 / 20 = 185.71
 */
function syntheticSummary(overrides = {}) {
  const month = (m) => ({
    month: m,
    transactions: 10,
    operating_income: 10000,
    operating_expense: -7000,
    operating_result: 3000,
    neutral: -1000,
    net_change: 2000,
    categories: {
      umsatz: bucket(10000, { bar: 5000, karte: 3000, rechnung: 2000 }),
      wareneinsatz: bucket(-2500, { mehl: -2500 }),
      verpackung: bucket(-500),
      personal: bucket(-3000),
      energie: bucket(-1000),
      geldtransit: bucket(-1000),
      ...(overrides.categories || {}),
    },
  })
  return {
    schema_version: 1,
    category_kinds: {
      umsatz: 'einnahme',
      wareneinsatz: 'ausgabe',
      verpackung: 'ausgabe',
      personal: 'ausgabe',
      energie: 'ausgabe',
      geldtransit: 'neutral',
      ...(overrides.kinds || {}),
    },
    months: ['2026-03', '2026-04', '2026-05'].map(month),
  }
}

/**
 * Tagesreihe mit festem Umsatz je Wochentag über `weeks` Wochen, endend am
 * Sonntag `lastSunday`. Montag ist Ruhetag und hat keinen Bericht.
 */
const REVENUE_BY_ISO = { 2: 100, 3: 100, 4: 100, 5: 100, 6: 200, 7: 50 }

function syntheticDays(lastSunday, weeks, overrides = {}) {
  const days = []
  const from = core.addDays(lastSunday, -(weeks * 7 - 1))
  for (const date of core.listDates(from, lastSunday)) {
    const iso = core.isoWeekday(date)
    if (overrides[date] === 'missing') continue
    if (iso === 1) continue
    const revenue =
      overrides[date] !== undefined ? overrides[date] : REVENUE_BY_ISO[iso]
    days.push({ date, status: 'ok', revenue })
  }
  return days
}

const LAST_SUNDAY = '2026-05-31'

function fullTargets(configOverrides = {}, dayOverrides = {}) {
  const config = core.validateConfig(derivedConfig(configOverrides)).config
  const costBase = core.computeCostBase(syntheticSummary(), config)
  const days = syntheticDays(LAST_SUNDAY, 8, dayOverrides)
  const factors = core.computeWeekdayFactors(days, config, {
    asOf: LAST_SUNDAY,
  })
  return {
    config,
    days,
    costBase,
    factors,
    targets: core.computeTargets(costBase, factors, config),
  }
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

describe('targets.core - Konfiguration', () => {
  it('nimmt eine plausible Config an und normalisiert sie', () => {
    const result = core.validateConfig(derivedConfig())
    expect(result.ok).toBe(true)
    expect(result.config.mode).toBe('derived')
    expect(result.config.closed_weekdays).toEqual([1])
    expect(result.config.pos_revenue_subcategories).toEqual(
      core.DEFAULT_POS_REVENUE_SUBCATEGORIES
    )
    expect(result.config.fixed_costs_monthly).toBeNull()
  })

  it.each([
    ['kein Objekt', null],
    ['falsche Schema-Version', derivedConfig({ schema_version: 2 })],
    ['unbekannter Modus', derivedConfig({ mode: 'auto' })],
    ['kein Stand', derivedConfig({ updated: 'gestern' })],
    ['Geschäftstage 0', derivedConfig({ business_days_per_month: 0 })],
    ['Geschäftstage 40', derivedConfig({ business_days_per_month: 40 })],
    ['Fenster 0', derivedConfig({ weekday_window_months: 0 })],
    [
      'gelb über grün',
      derivedConfig({ thresholds: { green: 0.8, amber: 0.9 } }),
    ],
    ['grün unplausibel', derivedConfig({ thresholds: { green: 5, amber: 1 } })],
    ['Ruhetag 8', derivedConfig({ closed_weekdays: [8] })],
    ['alle Tage zu', derivedConfig({ closed_weekdays: [1, 2, 3, 4, 5, 6, 7] })],
    [
      'negativer Rechnungsumsatz',
      derivedConfig({ non_pos_revenue_monthly: -1 }),
    ],
    ['derived ohne Kostenfenster', derivedConfig({ cost_window_months: null })],
    [
      'derived ohne variable Kategorien',
      derivedConfig({ variable_categories: 'x' }),
    ],
    ['manual ohne Fixkosten', manualConfig({ fixed_costs_monthly: 0 })],
    ['manual Kostenquote 1', manualConfig({ variable_cost_ratio: 1 })],
  ])('lehnt ab: %s', (_label, raw) => {
    const result = core.validateConfig(raw)
    expect(result.ok).toBe(false)
    expect(typeof result.reason).toBe('string')
  })

  it('parseConfig liefert bei kaputtem JSON kein Ziel', () => {
    expect(core.parseConfig('{ nicht json').status).toBe('no-target')
    expect(core.parseConfig(JSON.stringify(derivedConfig())).status).toBe('ok')
  })

  it('kennzeichnet eine Kostenbasis, die älter als sechs Monate ist', () => {
    const config = core.validateConfig(derivedConfig()).config
    expect(core.configAge(config, '2026-11-30')).toMatchObject({
      age_months: 5,
      stale: false,
    })
    expect(core.configAge(config, '2027-01-02')).toMatchObject({
      age_months: 7,
      stale: true,
    })
  })
})

// ---------------------------------------------------------------------------
// Kostenbasis
// ---------------------------------------------------------------------------

describe('targets.core - computeCostBase', () => {
  it('leitet Fixkosten, Kostenquote und Deckungsbeitrag aus dem Fenster ab', () => {
    const config = core.validateConfig(derivedConfig()).config
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.status).toBe('ok')
    expect(base.window).toEqual({ from: '2026-03', to: '2026-05', months: 3 })
    expect(base.fixed_costs_monthly).toBe(4000)
    expect(base.variable_costs_monthly).toBe(3000)
    expect(base.revenue_monthly).toBe(10000)
    expect(base.variable_cost_ratio).toBe(0.3)
    expect(base.contribution_ratio).toBe(0.7)
  })

  it('trennt Kassen- und Rechnungsumsatz über die Unterkategorien', () => {
    const config = core.validateConfig(derivedConfig()).config
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.pos_revenue_monthly).toBe(8000)
    expect(base.non_pos_revenue_monthly).toBe(2000)
    expect(base.non_pos_source).toBe('subcategories')
    expect(base.assumptions.some((a) => /außerhalb der Kasse/.test(a))).toBe(
      true
    )
  })

  it('setzt den Umsatz außerhalb der Kasse auf 0, wenn er nicht unterscheidbar ist', () => {
    const config = core.validateConfig(derivedConfig()).config
    const summary = syntheticSummary({
      categories: { umsatz: bucket(10000, { sonstige: 10000 }) },
    })
    const base = core.computeCostBase(summary, config)
    expect(base.non_pos_revenue_monthly).toBe(0)
    expect(base.non_pos_source).toBe('none')
    expect(base.pos_revenue_monthly).toBeNull()
  })

  it('bevorzugt den konfigurierten Rechnungsumsatz vor der Ableitung', () => {
    const config = core.validateConfig(
      derivedConfig({ non_pos_revenue_monthly: 500 })
    ).config
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.non_pos_revenue_monthly).toBe(500)
    expect(base.non_pos_source).toBe('config')
  })

  it('leitet die Privatentnahme aus den neutralen Kategorien ab und kennzeichnet das', () => {
    const config = core.validateConfig(derivedConfig()).config
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.private_draw_monthly).toBe(1000)
    expect(base.private_draw_source).toBe('derived')
    expect(base.assumptions.some((a) => /Privatentnahme/.test(a))).toBe(true)
  })

  it('rechnet mit Netto je Kategorie - eine Rückerstattung mindert die Fixkosten', () => {
    const config = core.validateConfig(derivedConfig()).config
    const summary = syntheticSummary({
      categories: {
        energie: {
          amount: -700,
          count: 2,
          income: 300,
          expense: -1000,
          subcategories: {},
        },
      },
    })
    const base = core.computeCostBase(summary, config)
    expect(base.fixed_costs_monthly).toBe(3700)
  })

  it('zählt "offen" (nicht zugeordnet) zu den Fixkosten', () => {
    const config = core.validateConfig(derivedConfig()).config
    const summary = syntheticSummary({
      categories: { unkategorisiert: bucket(-100) },
      kinds: { unkategorisiert: 'offen' },
    })
    const base = core.computeCostBase(summary, config)
    expect(base.fixed_costs_monthly).toBe(4100)
  })

  it('nimmt nur die letzten cost_window_months Monate', () => {
    const config = core.validateConfig(
      derivedConfig({ cost_window_months: 1 })
    ).config
    const summary = syntheticSummary()
    summary.months[0].categories.personal = bucket(-99999)
    const base = core.computeCostBase(summary, config)
    expect(base.window).toEqual({ from: '2026-05', to: '2026-05', months: 1 })
    expect(base.fixed_costs_monthly).toBe(4000)
  })

  it('meldet ein zu kurzes Fenster als Annahme', () => {
    const config = core.validateConfig(
      derivedConfig({ cost_window_months: 12 })
    ).config
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.status).toBe('ok')
    expect(base.window.months).toBe(3)
    expect(base.assumptions.some((a) => /3 von 12 Monaten/.test(a))).toBe(true)
  })

  it.each([
    ['ohne Monate', { months: [] }],
    ['ohne Einnahmen', { noRevenue: true }],
    ['ohne Fixkosten', { noFixed: true }],
    ['Kostenquote ≥ 1', { hugeVariable: true }],
  ])('liefert kein Ziel: %s', (_label, tweak) => {
    const config = core.validateConfig(derivedConfig()).config
    const summary = syntheticSummary()
    if (tweak.months) summary.months = tweak.months
    for (const m of summary.months) {
      if (tweak.noRevenue) m.categories.umsatz = bucket(0)
      if (tweak.noFixed) {
        delete m.categories.personal
        delete m.categories.energie
      }
      if (tweak.hugeVariable) m.categories.wareneinsatz = bucket(-20000)
    }
    const base = core.computeCostBase(summary, config)
    expect(base.status).toBe('no-target')
    expect(typeof base.reason).toBe('string')
  })

  it('mode manual überschreibt die Ableitung vollständig', () => {
    const config = core.validateConfig(manualConfig()).config
    // Die Zusammenfassung würde etwas ganz anderes ergeben - sie wird ignoriert.
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(base.mode).toBe('manual')
    expect(base.fixed_costs_monthly).toBe(8000)
    expect(base.variable_cost_ratio).toBe(0.2)
    expect(base.contribution_ratio).toBe(0.8)
    expect(base.non_pos_revenue_monthly).toBe(0)
    expect(base.private_draw_monthly).toBe(2000)
    expect(base.private_draw_source).toBe('config')
    expect(base.revenue_monthly).toBeNull()
    // und braucht die Zusammenfassung gar nicht
    expect(core.computeCostBase(null, config).status).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// Wochentagsfaktoren
// ---------------------------------------------------------------------------

describe('targets.core - computeWeekdayFactors', () => {
  it('normiert die Faktoren der geöffneten Wochentage auf Mittelwert 1', () => {
    const config = core.validateConfig(derivedConfig()).config
    const days = syntheticDays(LAST_SUNDAY, 8)
    const factors = core.computeWeekdayFactors(days, config, {
      asOf: LAST_SUNDAY,
    })
    expect(factors.status).toBe('ok')
    const open = factors.weekdays.filter((w) => !w.closed)
    const mean = open.reduce((s, w) => s + w.factor, 0) / open.length
    expect(mean).toBeCloseTo(1, 3)
    // Mittel der Wochentagsmittel: (100·4 + 200 + 50) / 6 = 108.33
    expect(factors.weekdays[5].factor).toBeCloseTo(200 / 108.3333, 3)
    expect(factors.weekdays[6].factor).toBeCloseTo(50 / 108.3333, 3)
    expect(factors.weekdays[1].average_revenue).toBe(100)
  })

  it('gibt dem Ruhetag keinen Faktor', () => {
    const { factors } = fullTargets()
    expect(factors.weekdays[0]).toMatchObject({
      iso: 1,
      label: 'Montag',
      closed: true,
      factor: null,
      samples: 0,
    })
  })

  it('ignoriert Berichte am Ruhetag, auch wenn welche da sind', () => {
    const config = core.validateConfig(derivedConfig()).config
    const days = syntheticDays(LAST_SUNDAY, 8)
    days.push({ date: '2026-05-25', status: 'ok', revenue: 9999 })
    const factors = core.computeWeekdayFactors(days, config, {
      asOf: LAST_SUNDAY,
    })
    expect(factors.weekdays[0].factor).toBeNull()
    expect(factors.weekdays[5].factor).toBeCloseTo(200 / 108.3333, 3)
  })

  it('lässt Tage ohne Bericht (Ferien, Feiertage) nicht als Null einfließen', () => {
    const config = core.validateConfig(derivedConfig()).config
    const reference = core.computeWeekdayFactors(
      syntheticDays(LAST_SUNDAY, 8),
      config,
      { asOf: LAST_SUNDAY }
    )
    // Eine ganze Woche Betriebsferien plus ein `no-data`-Eintrag
    const withHoliday = syntheticDays(LAST_SUNDAY, 8, {
      '2026-04-14': 'missing',
      '2026-04-15': 'missing',
      '2026-04-16': 'missing',
      '2026-04-17': 'missing',
      '2026-04-18': 'missing',
      '2026-04-19': 'missing',
    })
    withHoliday.push({ date: '2026-04-16', status: 'no-data' })
    const factors = core.computeWeekdayFactors(withHoliday, config, {
      asOf: LAST_SUNDAY,
    })
    expect(factors.days_used).toBe(reference.days_used - 6)
    for (let i = 0; i < 7; i++) {
      expect(factors.weekdays[i].factor).toEqual(reference.weekdays[i].factor)
    }
  })

  it('lässt Storno-Tage ohne positiven Umsatz nicht einfließen', () => {
    const config = core.validateConfig(derivedConfig()).config
    const days = syntheticDays(LAST_SUNDAY, 8, { '2026-05-30': -40 })
    const factors = core.computeWeekdayFactors(days, config, {
      asOf: LAST_SUNDAY,
    })
    expect(factors.weekdays[5].samples).toBe(7)
    expect(factors.weekdays[5].average_revenue).toBe(200)
  })

  it('beschränkt sich auf das rollierende Fenster', () => {
    const config = core.validateConfig(
      derivedConfig({ weekday_window_months: 1 })
    ).config
    const days = syntheticDays(LAST_SUNDAY, 8, { '2026-03-07': 100000 })
    const factors = core.computeWeekdayFactors(days, config, {
      asOf: LAST_SUNDAY,
    })
    expect(factors.window.from).toBe('2026-05-01')
    expect(factors.window.to).toBe(LAST_SUNDAY)
    expect(factors.weekdays[5].average_revenue).toBe(200)
  })

  it('liefert kein Ziel ohne Geschäftstag mit Umsatz', () => {
    const config = core.validateConfig(derivedConfig()).config
    expect(core.computeWeekdayFactors([], config).status).toBe('no-target')
    const zero = syntheticDays(LAST_SUNDAY, 1)
    for (const d of zero) d.revenue = 0
    expect(
      core.computeWeekdayFactors(zero, config, { asOf: LAST_SUNDAY }).status
    ).toBe('no-target')
  })
})

// ---------------------------------------------------------------------------
// Zielwerte
// ---------------------------------------------------------------------------

describe('targets.core - computeTargets', () => {
  it('rechnet beide Zielstufen bis zum Tagesziel je Wochentag durch', () => {
    const { targets } = fullTargets()
    expect(targets.status).toBe('ok')
    const be = targets.levels.breakeven
    expect(be.assumed).toBe(false)
    expect(be.breakeven_monthly).toBeCloseTo(5714.29, 2)
    expect(be.pos_target_monthly).toBeCloseTo(3714.29, 2)
    expect(be.daily_base).toBeCloseTo(185.71, 2)
    // Samstag: Basis × 1.8462
    expect(be.weekdays[5].target).toBeCloseTo(185.71 * (200 / 108.3333), 1)
    expect(be.weekdays[0].target).toBeNull()

    const draw = targets.levels.draw
    expect(draw.assumed).toBe(true)
    expect(draw.private_draw_monthly).toBe(1000)
    // (4000 + 1000) / 0.7 − 2000
    expect(draw.pos_target_monthly).toBeCloseTo(5142.86, 2)
    expect(draw.daily_base).toBeGreaterThan(be.daily_base)
  })

  it('Break-even reagiert auf die Kostenquote', () => {
    const config = core.validateConfig(derivedConfig()).config
    const factors = core.computeWeekdayFactors(
      syntheticDays(LAST_SUNDAY, 8),
      config,
      { asOf: LAST_SUNDAY }
    )
    const lean = core.computeCostBase(syntheticSummary(), config)
    const heavy = syntheticSummary({
      categories: { wareneinsatz: bucket(-4500, { mehl: -4500 }) },
    })
    const heavyBase = core.computeCostBase(heavy, config)
    expect(heavyBase.variable_cost_ratio).toBe(0.5)
    const a = core.computeTargets(lean, factors, config)
    const b = core.computeTargets(heavyBase, factors, config)
    // Fixkosten gleich, Quote von 0.3 auf 0.5: Break-even 4000/0.7 → 4000/0.5
    expect(b.levels.breakeven.breakeven_monthly).toBeCloseTo(8000, 2)
    expect(b.levels.breakeven.breakeven_monthly).toBeGreaterThan(
      a.levels.breakeven.breakeven_monthly
    )
  })

  it('die Entnahme-Stufe ist nicht mehr Annahme, wenn sie konfiguriert ist', () => {
    const { targets } = fullTargets({ private_draw_monthly: 1500 })
    expect(targets.levels.draw.assumed).toBe(false)
    expect(targets.levels.draw.private_draw_source).toBe('config')
  })

  it('ein Kassenziel unter 0 wird auf 0 gekappt', () => {
    const { targets } = fullTargets({ non_pos_revenue_monthly: 99999 })
    expect(targets.levels.breakeven.pos_target_monthly).toBe(0)
    expect(targets.levels.breakeven.weekdays[5].target).toBe(0)
  })

  it('reicht "kein Ziel" aus Kostenbasis oder Faktoren durch', () => {
    const config = core.validateConfig(derivedConfig()).config
    const noBase = { status: 'no-target', reason: 'x' }
    const factors = core.computeWeekdayFactors(
      syntheticDays(LAST_SUNDAY, 8),
      config,
      { asOf: LAST_SUNDAY }
    )
    expect(core.computeTargets(noBase, factors, config)).toEqual({
      status: 'no-target',
      reason: 'x',
    })
    const base = core.computeCostBase(syntheticSummary(), config)
    expect(
      core.computeTargets(base, { status: 'no-target', reason: 'y' }, config)
        .status
    ).toBe('no-target')
  })
})

// ---------------------------------------------------------------------------
// Ampel
// ---------------------------------------------------------------------------

describe('targets.core - evaluateDay', () => {
  const thresholds = { green: 1.0, amber: 0.9 }

  it.each([
    [100, 100, 'green', 'Ziel erreicht'],
    [150, 100, 'green', 'Ziel erreicht'],
    [99.99, 100, 'amber', 'Knapp unter Ziel'],
    [90, 100, 'amber', 'Knapp unter Ziel'],
    [89.99, 100, 'red', 'Unter Ziel'],
    [0, 100, 'red', 'Unter Ziel'],
  ])('%s gegen %s ist %s', (actual, target, status, label) => {
    const ev = core.evaluateDay(actual, target, thresholds)
    expect(ev.status).toBe(status)
    expect(ev.label).toBe(label)
    expect(ev.ratio).toBeCloseTo(actual / target, 4)
    expect(ev.diff).toBeCloseTo(actual - target, 2)
  })

  it('liefert immer Zahl und Textlabel', () => {
    const ev = core.evaluateDay(120, 100, thresholds)
    expect(ev).toMatchObject({
      actual: 120,
      target: 100,
      label: 'Ziel erreicht',
    })
    expect(core.STATUS_LABELS[ev.status]).toBe(ev.label)
  })

  it('ist offen ohne Ist-Wert oder ohne Ziel, nie rot', () => {
    expect(core.evaluateDay(null, 100, thresholds)).toMatchObject({
      status: 'open',
      label: 'Kein Bericht',
      ratio: null,
    })
    expect(core.evaluateDay(null, 100, thresholds, 'today')).toMatchObject({
      status: 'open',
      label: 'Laufender Tag',
    })
    expect(core.evaluateDay(50, null, thresholds)).toMatchObject({
      status: 'open',
      label: 'Kein Ziel',
    })
  })

  it('ein Ziel von 0 ist immer erreicht', () => {
    expect(core.evaluateDay(0, 0, thresholds).status).toBe('green')
  })

  it('benutzt die konfigurierten Schwellen', () => {
    const strict = { green: 1.1, amber: 1.0 }
    expect(core.evaluateDay(105, 100, strict).status).toBe('amber')
    expect(core.evaluateDay(110, 100, strict).status).toBe('green')
    expect(core.evaluateDay(99, 100, strict).status).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// Zeiträume
// ---------------------------------------------------------------------------

describe('targets.core - aggregatePeriod', () => {
  it('bewertet jeden Tag und summiert nur bewertete Tage', () => {
    const { config, days, targets } = fullTargets()
    const period = core.aggregatePeriod(
      '2026-05-25',
      '2026-05-31',
      days,
      targets,
      config,
      { today: '2026-06-03' }
    )
    expect(period.status).toBe('ok')
    expect(period.days).toHaveLength(7)
    expect(period.days[0].levels.breakeven).toMatchObject({
      status: 'open',
      reason: 'closed',
      label: 'Ruhetag',
    })
    const be = period.levels.breakeven
    expect(be.days_counted).toBe(6)
    expect(be.actual).toBe(100 * 4 + 200 + 50)
    const targetSum = targets.levels.breakeven.weekdays
      .filter((w) => w.target !== null)
      .reduce((s, w) => s + w.target, 0)
    expect(be.target).toBeCloseTo(targetSum, 1)
    expect(['green', 'amber', 'red']).toContain(be.status)
    expect(period.last_evaluated_date).toBe('2026-05-31')
  })

  it('der laufende Tag ist offen, nicht rot - auch mit frühem Bericht', () => {
    const { config, targets } = fullTargets()
    const days = [
      { date: '2026-06-02', status: 'ok', revenue: 100 },
      { date: '2026-06-03', status: 'ok', revenue: 1 },
    ]
    const period = core.aggregatePeriod(
      '2026-06-02',
      '2026-06-04',
      days,
      targets,
      config,
      { today: '2026-06-03' }
    )
    const [yesterday, today, tomorrow] = period.days.map(
      (d) => d.levels.breakeven
    )
    expect(yesterday.status).not.toBe('open')
    expect(today).toMatchObject({ status: 'open', reason: 'today' })
    expect(tomorrow).toMatchObject({ status: 'open', reason: 'future' })
    expect(period.levels.breakeven.days_counted).toBe(1)
    expect(period.last_evaluated_date).toBe('2026-06-02')
  })

  it('ein vergangener Tag ohne Bericht ist "kein Bericht", nicht rot', () => {
    const { config, targets } = fullTargets()
    const period = core.aggregatePeriod(
      '2026-05-26',
      '2026-05-26',
      [],
      targets,
      config,
      { today: '2026-06-03' }
    )
    expect(period.days[0].levels.breakeven).toMatchObject({
      status: 'open',
      reason: 'no-report',
      label: 'Kein Bericht',
    })
    expect(period.levels.breakeven).toMatchObject({
      status: 'open',
      days_counted: 0,
      label: 'Noch kein Tag bewertet',
    })
  })

  it('lehnt einen ungültigen Zeitraum ab', () => {
    const { config, days, targets } = fullTargets()
    expect(
      core.aggregatePeriod('2026-06-05', '2026-06-01', days, targets, config)
        .status
    ).toBe('invalid')
  })

  it('ohne Ziel sind alle Tage offen mit Grund "kein Ziel"', () => {
    const { config, days } = fullTargets()
    const period = core.aggregatePeriod(
      '2026-05-26',
      '2026-05-27',
      days,
      { status: 'no-target' },
      config,
      { today: '2026-06-03' }
    )
    expect(period.days[0].levels.breakeven).toMatchObject({
      status: 'open',
      label: 'Kein Ziel',
      actual: 100,
    })
  })
})

describe('targets.core - aggregateToDate', () => {
  it('liefert Woche und Monat bis zum Bezugstag samt Hochrechnung', () => {
    const { config, days, targets } = fullTargets()
    const result = core.aggregateToDate('2026-05-27', days, targets, config, {
      today: '2026-05-28',
    })
    expect(result.status).toBe('ok')
    expect(result.week.from).toBe('2026-05-25')
    expect(result.week.to).toBe('2026-05-27')
    expect(result.week.iso_week).toBe('2026-W22')
    expect(result.week.levels.breakeven.days_counted).toBe(2)

    expect(result.month.month).toBe('2026-05')
    expect(result.month.from).toBe('2026-05-01')
    expect(result.month.to).toBe('2026-05-27')
    expect(result.month.month_end).toBe('2026-05-31')

    const proj = result.month.projection.breakeven
    // 28.–31.05.: Do, Fr, Sa, So → vier Resttage
    expect(proj.remaining_days).toBe(4)
    const wd = targets.levels.breakeven.weekdays
    expect(proj.remaining_target).toBeCloseTo(
      wd[3].target + wd[4].target + wd[5].target + wd[6].target,
      1
    )
    const toDate = result.month.levels.breakeven
    expect(proj.month_target).toBeCloseTo(
      toDate.target + proj.remaining_target,
      1
    )
    // Hochrechnung überträgt den bisherigen Erreichungsgrad auf den Rest
    expect(proj.projected_actual).toBeCloseTo(
      (toDate.actual * proj.month_target) / toDate.target,
      1
    )
    expect(proj.ratio).toBeCloseTo(toDate.ratio, 3)
    expect(proj.status).toBe(toDate.status)
  })

  it('ohne bewerteten Tag im Monat ist die Hochrechnung offen', () => {
    const { config, targets } = fullTargets()
    const result = core.aggregateToDate('2026-06-02', [], targets, config, {
      today: '2026-06-03',
    })
    expect(result.month.levels.breakeven.status).toBe('open')
    expect(result.month.projection.breakeven).toMatchObject({
      status: 'open',
      projected_actual: null,
    })
  })
})

// ---------------------------------------------------------------------------
// Alles zusammen
// ---------------------------------------------------------------------------

describe('targets.core - buildTargets', () => {
  it('setzt den jüngsten ausgewerteten Tag und die Faktoren bis dahin', () => {
    const config = core.validateConfig(derivedConfig()).config
    const days = syntheticDays(LAST_SUNDAY, 8)
    const result = core.buildTargets(syntheticSummary(), config, days, {
      today: '2026-06-03',
    })
    expect(result.status).toBe('ok')
    expect(result.last_evaluated_date).toBe(LAST_SUNDAY)
    expect(result.factors.window.to).toBe(LAST_SUNDAY)
    expect(result.config).toMatchObject({
      mode: 'derived',
      updated: '2026-06-01',
      stale: false,
      thresholds: { green: 1, amber: 0.9 },
    })
    expect(result.levels.breakeven.daily_base).toBeCloseTo(185.71, 2)
  })

  it('ein Bericht für heute zählt nicht als ausgewertet', () => {
    const config = core.validateConfig(derivedConfig()).config
    const days = syntheticDays(LAST_SUNDAY, 8)
    days.push({ date: '2026-06-02', status: 'ok', revenue: 100 })
    const result = core.buildTargets(syntheticSummary(), config, days, {
      today: '2026-06-02',
    })
    expect(result.last_evaluated_date).toBe(LAST_SUNDAY)
    expect(result.factors.window.to).toBe(LAST_SUNDAY)
  })

  it('liefert kein Ziel, wenn die Kostenbasis fehlt - aber den Grund', () => {
    const config = core.validateConfig(derivedConfig()).config
    const result = core.buildTargets(
      { months: [] },
      config,
      syntheticDays(LAST_SUNDAY, 8),
      { today: '2026-06-03' }
    )
    expect(result.status).toBe('no-target')
    expect(result.levels).toBeUndefined()
    expect(result.cost_base.status).toBe('no-target')
    expect(typeof result.reason).toBe('string')
  })
})
