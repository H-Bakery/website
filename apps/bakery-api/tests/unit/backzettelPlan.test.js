/**
 * Backzettel v2 (Z10): Teigtag ≠ Backtag (`backzettel-plan.core.js`,
 * docs/backzettel-v2.md §2.4). Regeln R16–R18 aus §6 mit erfundenen Daten.
 *
 * Kalender: Di 24.11.2026, Mi 25.11., Do 26.11., Fr 27.11., Sa 28.11.,
 * So 29.11., Mo 30.11. (Ruhetag), Di 01.12. `configV2()`: Teigtage Di–Sa,
 * Backtage Di–So.
 */
const plan = require('../../src/services/backzettel-plan.core')
const core = require('../../src/services/backzettel.core')
const configCore = require('../../src/services/backzettel-config.core')
const {
  config,
  configV2,
  PRODUCTS_V2,
} = require('../fixtures/backzettel.synthetic')

const TUE = '2026-11-24'
const WED = '2026-11-25'
const THU = '2026-11-26'
const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const MON = '2026-11-30'
const NEXT_TUE = '2026-12-01'

const cfg = configCore.normalizeConfig(configV2())
const item = (id) => cfg.items.find((i) => i.id === id)
const ROLLS = [
  'test-doppel',
  'test-stern',
  'test-kaese',
  'test-flitweck',
  'test-flit-klein',
  'test-party',
]
const SAME_DAY = [
  'test-korn',
  'test-holz',
  'test-misch',
  'test-kerb',
  'test-hafer',
  'test-plunder',
  'test-zopf',
  'test-kranz',
]

describe('Datum', () => {
  it('addDays und isoWeekday ueber Monats- und Jahresgrenzen', () => {
    expect(plan.addDays(SAT, 3)).toBe(NEXT_TUE)
    expect(plan.addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(plan.addDays(TUE, -1)).toBe('2026-11-23')
    expect(plan.isoWeekday(MON)).toBe(1)
    expect(plan.isoWeekday(SUN)).toBe(7)
    expect(plan.isValidDate('2026-02-30')).toBe(false)
  })
})

describe('leadFor', () => {
  it('ohne lead 0, Zahl fuer alle Backtage, Karte je Backtag mit default', () => {
    expect(plan.leadFor(item('test-korn'), 6)).toBe(0)
    expect(plan.leadFor(item('test-doppel'), 2)).toBe(1)
    expect(plan.leadFor(item('test-flitweck'), 6)).toBe(2)
    expect(plan.leadFor(item('test-flitweck'), 7)).toBe(1)
    expect(plan.leadFor({ lead: 2 }, 3)).toBe(2)
    expect(plan.leadFor({ lead: { 3: 1 } }, 4)).toBe(0)
    expect(plan.leadFor({}, 4)).toBe(0)
  })
})

describe('R16: Samstag macht den Teig fuer Sonntag und Dienstag', () => {
  it('Brötchen mit lead 1: So ← Sa, Di ← Sa (Mo und So keine Teigtage), Mi ← Di', () => {
    const doppel = item('test-doppel')
    expect(plan.doughDateFor(cfg, doppel, SUN)).toBe(SAT)
    expect(plan.doughDateFor(cfg, doppel, NEXT_TUE)).toBe(SAT)
    expect(plan.doughDateFor(cfg, doppel, WED)).toBe(TUE)
    // lead 0: Teigtag = Backtag
    expect(plan.doughDateFor(cfg, item('test-korn'), SAT)).toBe(SAT)
  })

  it('der Samstagszettel sammelt So und Di ein, Brot und Hefeteig bleiben am Samstag', () => {
    expect(plan.bakeDatesFor(cfg, SAT)).toEqual([SAT, SUN, NEXT_TUE])
    expect(plan.planForSheet(cfg, SAT)).toEqual({
      version: 2,
      doughDate: SAT,
      bakeDates: [
        { date: SAT, itemIds: SAME_DAY },
        { date: SUN, itemIds: ROLLS },
        { date: NEXT_TUE, itemIds: ROLLS },
      ],
    })
  })

  it('Dienstagsbrötchen kommen von zwei Teigtagen nicht - nur vom Samstag', () => {
    expect(plan.doughDatesFor(cfg, NEXT_TUE)).toEqual([SAT, NEXT_TUE])
    expect(plan.doughDatesFor(cfg, SUN)).toEqual([SAT, SUN])
    expect(plan.doughDatesFor(cfg, MON)).toEqual([])
    // Dienstag selbst traegt nur seine lead-0-Posten und die Brötchen fuer Mittwoch
    const tue = plan.planForSheet(cfg, NEXT_TUE)
    expect(tue.bakeDates.map((b) => b.date)).toEqual([NEXT_TUE, '2026-12-02'])
    expect(tue.bakeDates[0].itemIds).toEqual(SAME_DAY)
  })

  it('Sonntag ist kein Teigtag: nur seine lead-0-Zeilen; Montag hat keinen Plan', () => {
    expect(plan.isDoughDay(cfg, SUN)).toBe(false)
    expect(plan.isDoughDay(cfg, SAT)).toBe(true)
    expect(plan.planForSheet(cfg, SUN).bakeDates).toEqual([
      { date: SUN, itemIds: SAME_DAY },
    ])
    expect(plan.planForSheet(cfg, MON).bakeDates).toEqual([])
  })

  it('ohne dough_days gelten die Backtage (Sonntag wird dann Teigtag)', () => {
    const c = configCore.normalizeConfig(configV2({ dough_days: undefined }))
    expect(c.dough_days).toEqual([2, 3, 4, 5, 6, 7])
    expect(plan.doughDateFor(c, item('test-doppel'), NEXT_TUE)).toBe(SUN)
  })
})

describe('R17: Teiglinge zwei Tage voraus, lead je Backtag', () => {
  it('Flitweck fuer Samstag am Donnerstag, fuer Sonntag am Samstag', () => {
    const flit = item('test-flitweck')
    expect(plan.doughDateFor(cfg, flit, SAT)).toBe(THU)
    expect(plan.doughDateFor(cfg, flit, SUN)).toBe(SAT)
    expect(plan.planForSheet(cfg, THU).bakeDates).toEqual([
      { date: THU, itemIds: SAME_DAY },
      { date: FRI, itemIds: ROLLS },
      { date: SAT, itemIds: ['test-flitweck'] },
    ])
    // Freitag macht die uebrigen Samstagsbroetchen (lead 1), nicht den Flitweck
    const fri = plan.planForSheet(cfg, FRI)
    expect(fri.bakeDates.find((b) => b.date === SAT).itemIds).toEqual([
      'test-doppel',
      'test-stern',
      'test-kaese',
      'test-flit-klein',
      'test-party',
    ])
  })

  it('lead 2 zaehlt nur Teigtage: Mittwoch ← Samstag (Mo, So uebersprungen)', () => {
    expect(plan.doughDateFor(cfg, { lead: 2 }, WED)).toBe('2026-11-21')
    expect(plan.doughDateFor(cfg, { lead: 3 }, WED)).toBe('2026-11-20')
  })
})

describe('R18: kein Teigtag in 14 Tagen', () => {
  const sparse = () =>
    configV2({
      dough_days: [6],
      items: configV2().items.map((i) =>
        i.id === 'test-doppel' ? { ...i, lead: 3 } : i
      ),
    })

  it('die Zeile bleibt auf ihrem Backtag', () => {
    const c = configCore.normalizeConfig(sparse())
    const doppel = c.items.find((i) => i.id === 'test-doppel')
    expect(plan.resolveDoughDate(c, doppel, NEXT_TUE)).toEqual({
      date: NEXT_TUE,
      lead: 3,
      found: false,
    })
    expect(plan.planForSheet(c, NEXT_TUE).bakeDates[0].itemIds).toContain(
      'test-doppel'
    )
  })

  it('der Zettel des Backtags warnt no_dough_day und rechnet die Zeile', () => {
    const sheet = core.computeDoughDay({
      config: sparse(),
      date: NEXT_TUE,
      catalog: PRODUCTS_V2,
    })
    const w = sheet.warnings.find((x) => x.code === 'no_dough_day')
    expect(w.items).toEqual(['Testdoppel'])
    expect(w.message).toMatch(/Kein Teigtag in den 14 Tagen vor Dienstag/)
    const line = sheet.lines.find((l) => l.itemId === 'test-doppel')
    expect(line).toMatchObject({
      key: 'test-doppel|',
      bakeDate: NEXT_TUE,
      doughDate: NEXT_TUE,
      lead: 3,
      total: 40,
    })
  })
})

describe('Plan: Besitz, alte Tage', () => {
  it('owned laesst Paare aus, die ein anderer freigegebener Zettel traegt', () => {
    const p = plan.planForSheet(
      cfg,
      SAT,
      new Set([
        plan.ownedKey(NEXT_TUE, 'test-doppel'),
        plan.ownedKey(NEXT_TUE, 'test-stern'),
      ])
    )
    expect(p.bakeDates[2].itemIds).toEqual([
      'test-kaese',
      'test-flitweck',
      'test-flit-klein',
      'test-party',
    ])
    expect(p.bakeDates[1].itemIds).toEqual(ROLLS)
  })

  it('legacyPlan traegt alle Posten des Tages; planIncludes fragt den Plan', () => {
    const legacy = plan.legacyPlan(NEXT_TUE)
    expect(legacy).toEqual({
      version: 1,
      doughDate: NEXT_TUE,
      bakeDates: [{ date: NEXT_TUE, itemIds: null }],
    })
    expect(plan.planIncludes(legacy, NEXT_TUE, 'test-doppel')).toBe(true)
    expect(plan.planIncludes(legacy, SAT, 'test-doppel')).toBe(false)
    const sat = plan.planForSheet(cfg, SAT)
    expect(plan.planIncludes(sat, NEXT_TUE, 'test-doppel')).toBe(true)
    expect(plan.planIncludes(sat, NEXT_TUE, 'test-korn')).toBe(false)
    expect(plan.planIncludes(null, SAT, 'x')).toBe(false)
    expect(plan.planBakeDates(sat)).toEqual([SAT, SUN, NEXT_TUE])
  })

  it('v1-Stammdaten: jeder Zettel ist genau sein Backtag', () => {
    const v1 = configCore.normalizeConfig(config())
    for (const d of [TUE, WED, SAT, SUN]) {
      expect(plan.bakeDatesFor(v1, d)).toEqual([d])
      expect(plan.doughDatesFor(v1, d)).toEqual([d])
      expect(plan.planForSheet(v1, d).bakeDates).toEqual([
        { date: d, itemIds: v1.items.map((i) => i.id) },
      ])
    }
    expect(plan.planForSheet(v1, MON).bakeDates).toEqual([])
  })
})

describe('Übergang: planCovers und orphanedItems (§5.4)', () => {
  const v2Plan = (date, bakeDates, knownItems) => ({
    version: 2,
    doughDate: date,
    bakeDates,
    ...(knownItems ? { knownItems } : {}),
  })

  it('ein Posten, den es beim Freigeben noch nicht gab, gehört zum Zettel seines Teigtags', () => {
    const p = v2Plan(SAT, [{ date: SAT, itemIds: [] }], ['test-korn'])
    // test-plunder (lead 0) wird am Samstag gemacht und war nicht bekannt
    expect(plan.planCovers(cfg, p, SAT, item('test-plunder'))).toBe(true)
    // bekannt, aber nicht im Plan → nicht gedeckt
    expect(plan.planCovers(cfg, p, SAT, item('test-korn'))).toBe(false)
    // ohne knownItems (alter v2-Plan) wie planIncludes
    expect(
      plan.planCovers(
        cfg,
        v2Plan(SAT, [{ date: SAT, itemIds: [] }]),
        SAT,
        item('test-plunder')
      )
    ).toBe(false)
    // alter Tag: alles des eigenen Tages
    expect(
      plan.planCovers(cfg, plan.legacyPlan(SAT), SAT, item('test-plunder'))
    ).toBe(true)
  })

  it('Brötchen, deren Teigtag ohne sie freigegeben wurde, stehen auf keinem Zettel', () => {
    const known = cfg.items.map((i) => i.id)
    const sat = {
      date: SAT,
      plan: v2Plan(
        SAT,
        [
          { date: SAT, itemIds: [] },
          { date: NEXT_TUE, itemIds: [] },
        ],
        known
      ),
    }
    const orphans = plan.orphanedItems(cfg, NEXT_TUE, [sat])
    expect(orphans.map((o) => o.itemId)).toEqual(
      expect.arrayContaining(['test-doppel', 'test-stern', 'test-kaese'])
    )
    expect(orphans.every((o) => o.doughDate === SAT)).toBe(true)
    // hält ein anderer freigegebener Zettel sie (alter Dienstag), keine Waisen
    const oldTue = { date: NEXT_TUE, plan: plan.legacyPlan(NEXT_TUE) }
    expect(plan.orphanedItems(cfg, NEXT_TUE, [sat, oldTue])).toEqual([])
    // Teigtag nicht freigegeben: sein Entwurf trägt sie
    expect(plan.orphanedItems(cfg, NEXT_TUE, [])).toEqual([])
    // Montag ist kein Backtag
    expect(plan.orphanedItems(cfg, MON, [sat])).toEqual([])
  })

  it('planForSheet nimmt übernommene Posten in den eigenen Backtag auf', () => {
    const p = plan.planForSheet(cfg, NEXT_TUE, undefined, ['test-doppel'])
    const own = p.bakeDates.find((b) => b.date === NEXT_TUE)
    expect(own.itemIds).toContain('test-doppel')
    // ohne Übernahme nicht (Teigtag Samstag)
    expect(
      plan
        .planForSheet(cfg, NEXT_TUE)
        .bakeDates.find((b) => b.date === NEXT_TUE).itemIds
    ).not.toContain('test-doppel')
  })
})
