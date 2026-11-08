import { partybrezelConfig as config } from '../config/partybrezel.config'
import {
  addDays,
  doughDate,
  doughDateIsRuhetag,
  earliestPickupDate,
  formatDateLong,
  formatDateShort,
  isIsoDate,
  isoWeekday,
  pickupDates,
  todayInBerlin,
} from './dates'

const rules = (overrides: Partial<Parameters<typeof pickupDates>[1]> = {}) => ({
  leadTimeDays: 2,
  availableWeekdays: [2, 3, 4, 5, 6, 7],
  count: 14,
  ...overrides,
})

describe('dates', () => {
  it('rechnet mit Kalendertagen', () => {
    expect(addDays('2026-11-06', 2)).toBe('2026-11-08')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29') // Sommerzeit
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(isoWeekday('2026-11-09')).toBe(1) // Montag
    expect(isoWeekday('2026-11-08')).toBe(7) // Sonntag
  })

  it('erkennt ungültige Tage', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-2-3')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })

  it('beginnt bei heute + Vorlauf und lässt Montag aus', () => {
    // Freitag, 06.11.2026 + 2 Tage = Sonntag 08.11.
    const dates = pickupDates('2026-11-06', rules({ count: 3 }))
    expect(dates.map((d) => d.date)).toEqual([
      '2026-11-08',
      '2026-11-10',
      '2026-11-11',
    ])
    expect(earliestPickupDate('2026-11-06', 2)).toBe('2026-11-08')
  })

  it('bietet Montag nie an, auch wenn die Config ihn nennt', () => {
    const dates = pickupDates(
      '2026-11-06',
      rules({ availableWeekdays: [1, 2, 3, 4, 5, 6, 7], count: 30 })
    )
    expect(dates.some((d) => d.weekday === 1)).toBe(false)
    expect(dates).toHaveLength(30)
  })

  it('filtert nach Wochentagen', () => {
    const dates = pickupDates(
      '2026-11-06',
      rules({ availableWeekdays: [6], count: 3 })
    )
    // frühestens So 08.11. - der Samstag davor ist zu früh
    expect(dates.map((d) => d.date)).toEqual([
      '2026-11-14',
      '2026-11-21',
      '2026-11-28',
    ])
    expect(dates.every((d) => d.weekday === 6)).toBe(true)
  })

  it('geht über den Jahreswechsel', () => {
    const dates = pickupDates('2026-12-30', rules({ count: 4 }))
    expect(dates.map((d) => d.date)).toEqual([
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
      '2027-01-05', // 04.01. ist Montag
    ])
  })

  it('Vorlauf 0 erlaubt heute, ein Ruhetag wird übersprungen', () => {
    expect(
      pickupDates('2026-11-09', rules({ leadTimeDays: 0, count: 1 }))[0].date
    ).toBe('2026-11-10')
    expect(
      pickupDates('2026-11-10', rules({ leadTimeDays: 0, count: 1 }))[0].date
    ).toBe('2026-11-10')
  })

  it('liefert eine leere Liste statt endlos zu suchen', () => {
    expect(
      pickupDates('2026-11-06', rules({ availableWeekdays: [1] }))
    ).toEqual([])
    expect(pickupDates('2026-11-06', rules({ availableWeekdays: [] }))).toEqual(
      []
    )
  })

  it('nimmt die Werte der Config', () => {
    const dates = pickupDates('2026-11-06', {
      leadTimeDays: config.leadTimeDays,
      availableWeekdays: config.availableWeekdays,
      count: config.pickupDaysShown,
    })
    expect(dates).toHaveLength(config.pickupDaysShown)
    expect(dates[0].date >= addDays('2026-11-06', config.leadTimeDays)).toBe(
      true
    )
  })

  it('beschriftet deutsch', () => {
    expect(formatDateShort('2026-11-10')).toBe('Di, 10.11.')
    expect(formatDateLong('2026-11-10')).toBe('Dienstag, 10. November 2026')
    expect(formatDateLong('2027-03-01')).toBe('Montag, 1. März 2027')
  })

  it('der Teig entsteht am Vortag', () => {
    expect(doughDate('2026-11-10')).toBe('2026-11-09')
    expect(doughDate('2027-01-01')).toBe('2026-12-31')
  })

  it('markiert Abholtage, deren Teigtag der Ruhetag ist (Dienstag)', () => {
    expect(doughDateIsRuhetag('2026-11-10')).toBe(true) // Di -> Mo
    expect(doughDateIsRuhetag('2026-11-11')).toBe(false) // Mi -> Di
    expect(doughDateIsRuhetag('2026-11-08')).toBe(false) // So -> Sa
    const days = pickupDates('2026-11-06', rules())
    const tuesday = days.find((d) => d.date === '2026-11-10')
    expect(tuesday?.doughOnRuhetag).toBe(true)
    expect(
      days.filter((d) => d.doughOnRuhetag).every((d) => d.weekday === 2)
    ).toBe(true)
    expect(days.find((d) => d.date === '2026-11-08')?.doughOnRuhetag).toBe(
      false
    )
  })

  it('bestimmt heute in Europe/Berlin, nicht in UTC', () => {
    // 23:30 UTC am 07.11. ist in Berlin (MEZ) schon der 08.11.
    expect(todayInBerlin(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08')
    expect(todayInBerlin(new Date('2026-11-07T22:59:00Z'))).toBe('2026-11-07')
    // Sommerzeit (MESZ, UTC+2)
    expect(todayInBerlin(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
  })
})
