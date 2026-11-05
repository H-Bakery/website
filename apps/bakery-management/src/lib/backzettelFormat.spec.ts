import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatFactor,
  formatGrams,
  formatQty,
  formatSigned,
  hasHefeteig,
  isIsoDate,
  isoWeekday,
  lineLabel,
  neighbourProductionDay,
  nextProductionDay,
  openDeltas,
  parseDecimal,
  preorderedPieces,
  todayIso,
  upcomingProductionDays,
} from './backzettelFormat'
import {
  TEST_CONFIG,
  saturdayConfirmed,
  saturdayDraft,
} from './backzettelFixtures'

describe('Backzettel-Kalender', () => {
  it('prüft Daten kalendarisch', () => {
    expect(isIsoDate('2026-11-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('28.11.2026')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })

  it('rechnet Wochentage und Tage über Monatsgrenzen', () => {
    expect(isoWeekday('2026-11-23')).toBe(1) // Montag
    expect(isoWeekday('2026-11-29')).toBe(7)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(todayIso(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
  })

  it('listet die kommenden 7 Tage ohne Montag (Ruhetag)', () => {
    // Do 2026-11-26 → Do, Fr, Sa, So, (Mo), Di, Mi
    expect(upcomingProductionDays('2026-11-26')).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-12-01',
      '2026-12-02',
    ])
    // Stammdaten mit anderen Tagen gewinnen
    expect(upcomingProductionDays('2026-11-26', [6])).toEqual(['2026-11-28'])
  })

  it('nächster Produktionstag ist der erste nach heute', () => {
    expect(nextProductionDay('2026-11-27')).toBe('2026-11-28')
    // Sonntag → über den Montag hinweg zum Dienstag
    expect(nextProductionDay('2026-11-29')).toBe('2026-12-01')
    expect(neighbourProductionDay('2026-12-01', -1)).toBe('2026-11-29')
    expect(neighbourProductionDay('2026-11-29', 1)).toBe('2026-12-01')
  })

  it('formatiert Daten deutsch', () => {
    expect(formatDateLong('2026-11-28')).toBe('Samstag, 28.11.2026')
    expect(formatDateShort('2026-12-01')).toBe('Di 01.12.')
  })
})

describe('Backzettel-Zahlen', () => {
  it('Mengen mit Einheit, Liter mit Komma', () => {
    expect(formatQty(40, 'Stück')).toBe('40')
    expect(formatQty(1.24, 'Liter')).toBe('1,24 l')
    expect(formatQty(3, 'Blech')).toBe('3 Bl.')
  })

  it('Vorzeichen, Gramm, Faktor', () => {
    expect(formatSigned(2)).toBe('+2')
    expect(formatSigned(-1.5)).toBe('−1,5')
    expect(formatSigned(0)).toBe('–')
    expect(formatGrams(450)).toBe('450 g')
    expect(formatGrams(2400)).toBe('2,4 kg')
    expect(formatFactor(1)).toBe('1,0')
    expect(formatFactor(1.25)).toBe('1,25')
  })

  it('liest Eingaben mit Komma oder Punkt, sonst NaN', () => {
    expect(parseDecimal('1,2')).toBe(1.2)
    expect(parseDecimal(' -3 ')).toBe(-3)
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('1,2,3')).toBeNaN()
  })
})

describe('Backzettel-Beschriftungen', () => {
  it('Sorte = Füllungsname aus den Stammdaten', () => {
    expect(
      lineLabel(
        { name: 'Testzopf gefüllt', variant: 'nuss', itemId: 'test-zopf' },
        TEST_CONFIG
      )
    ).toBe('Testzopf gefüllt – Testnussfüllung')
    expect(
      lineLabel(
        { name: 'Testzopf gefüllt', variant: null, itemId: 'test-zopf' },
        TEST_CONFIG
      )
    ).toBe('Testzopf gefüllt – ohne Füllungsangabe')
    expect(lineLabel({ name: 'X', variant: 'kirsch', itemId: 'x' }, null)).toBe(
      'X – Kirsch'
    )
  })

  it('zählt offene Nachträge und vorbestellte Stück', () => {
    expect(openDeltas(saturdayConfirmed())).toHaveLength(1)
    expect(openDeltas(saturdayDraft())).toHaveLength(0)
    expect(preorderedPieces(saturdayDraft())).toBe(2)
    expect(hasHefeteig(saturdayDraft())).toBe(true)
    expect(hasHefeteig({ hefeteig: null, fillings: [] })).toBe(false)
  })
})
