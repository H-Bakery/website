/**
 * TASK-042: Feiertage Saarland, Öffnungstage, Tagesgewicht, Urlaubstage,
 * anteiliger Anspruch, Jahreskonto mit Übertrag, Schichtregeln -
 * `src/services/vacation.core.js`. Erfundene Werte, keine echten Personen.
 */
'use strict'

const core = require('../../src/services/vacation.core')

const MONDAY = [1]

describe('easterSunday / holidaysSaarland', () => {
  it.each([
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('Ostersonntag %i = %s', (year, date) => {
    expect(core.easterSunday(year)).toBe(date)
  })

  it('lists the twelve Saarland holidays of 2026', () => {
    expect(core.holidaysSaarland(2026)).toEqual([
      { date: '2026-01-01', name: 'Neujahr' },
      { date: '2026-04-03', name: 'Karfreitag' },
      { date: '2026-04-06', name: 'Ostermontag' },
      { date: '2026-05-01', name: 'Tag der Arbeit' },
      { date: '2026-05-14', name: 'Christi Himmelfahrt' },
      { date: '2026-05-25', name: 'Pfingstmontag' },
      { date: '2026-06-04', name: 'Fronleichnam' },
      { date: '2026-08-15', name: 'Mariä Himmelfahrt' },
      { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
      { date: '2026-11-01', name: 'Allerheiligen' },
      { date: '2026-12-25', name: '1. Weihnachtstag' },
      { date: '2026-12-26', name: '2. Weihnachtstag' },
    ])
  })

  it.each([
    [
      2024,
      ['2024-03-29', '2024-04-01', '2024-05-09', '2024-05-20', '2024-05-30'],
    ],
    [
      2025,
      ['2025-04-18', '2025-04-21', '2025-05-29', '2025-06-09', '2025-06-19'],
    ],
    [
      2027,
      ['2027-03-26', '2027-03-29', '2027-05-06', '2027-05-17', '2027-05-27'],
    ],
  ])('moving holidays %i', (year, dates) => {
    const names = [
      'Karfreitag',
      'Ostermontag',
      'Christi Himmelfahrt',
      'Pfingstmontag',
      'Fronleichnam',
    ]
    dates.forEach((date, i) => expect(core.holidayName(date)).toBe(names[i]))
  })

  it('has no Ostersonntag, Pfingstsonntag, Reformationstag or Buß- und Bettag', () => {
    expect(core.holidayName('2026-04-05')).toBeNull()
    expect(core.holidayName('2026-05-24')).toBeNull()
    expect(core.holidayName('2026-10-31')).toBeNull()
    expect(core.holidayName('2026-11-18')).toBeNull()
    expect(core.holidaysSaarland(2027)).toHaveLength(12)
    // the cached list cannot be changed by a caller
    const cached = core.holidaysSaarland(2027)
    expect(Object.isFrozen(cached)).toBe(true)
    expect(() => cached.push({ date: '2027-12-31', name: 'x' })).toThrow()
    expect(core.holidaysSaarland(2027)).toHaveLength(12)
  })
})

describe('closedWeekdaysFrom', () => {
  it('reads closed_weekdays from the finance config', () => {
    expect(core.closedWeekdaysFrom({ closed_weekdays: [2, 1, 1] })).toEqual({
      weekdays: [1, 2],
      source: 'config',
    })
  })

  it('defaults to Monday only when the config has no valid list', () => {
    for (const config of [
      null,
      {},
      { closed_weekdays: 'Montag' },
      { closed_weekdays: [0] },
      { closed_weekdays: [1, 2, 3, 4, 5, 6, 7] },
    ]) {
      expect(core.closedWeekdaysFrom(config)).toEqual({
        weekdays: [1],
        source: 'default',
      })
    }
  })

  it('keeps an explicit empty list (open every day)', () => {
    expect(core.closedWeekdaysFrom({ closed_weekdays: [] })).toEqual({
      weekdays: [],
      source: 'config',
    })
  })
})

describe('dayInfo / dayWeight', () => {
  it('Ruhetag (Monday) and holidays are closed with weight 0', () => {
    expect(core.dayInfo('2026-11-09', MONDAY)).toMatchObject({
      weekday: 1,
      restDay: true,
      closed: true,
      holidayName: null,
      weight: 0,
    })
    expect(core.dayInfo('2026-06-04', MONDAY)).toMatchObject({
      weekday: 4,
      restDay: false,
      closed: true,
      holidayName: 'Fronleichnam',
      weight: 0,
    })
  })

  it('Saturday and Sunday are normal opening days', () => {
    expect(core.dayWeight('2026-11-14', MONDAY)).toBe(1)
    expect(core.dayWeight('2026-11-15', MONDAY)).toBe(1)
  })

  it('24.12. and 31.12. count half when open, nothing when closed', () => {
    expect(core.dayInfo('2026-12-24', MONDAY)).toMatchObject({
      weight: 0.5,
      halfDayName: 'Heiligabend',
    })
    expect(core.dayWeight('2026-12-31', MONDAY)).toBe(0.5)
    // 2029-12-24 and 2029-12-31 are Mondays
    expect(core.dayInfo('2029-12-24', MONDAY)).toMatchObject({
      weight: 0,
      halfDayName: null,
    })
    expect(core.dayWeight('2029-12-31', MONDAY)).toBe(0)
  })

  it('uses the configured Ruhetage', () => {
    expect(core.dayWeight('2026-11-10', [2])).toBe(0)
    expect(core.dayWeight('2026-11-09', [2])).toBe(1)
  })
})

describe('absenceDays', () => {
  it('counts opening days only (a week Tue-Mon = 6 days)', () => {
    expect(
      core.absenceDays(
        { startDate: '2026-11-10', endDate: '2026-11-16' },
        MONDAY
      )
    ).toBe(6)
  })

  it('skips holidays and the Ruhetag', () => {
    // Do 2026-05-14 Christi Himmelfahrt, Mo 2026-05-18 Ruhetag
    expect(
      core.absenceDays(
        { startDate: '2026-05-12', endDate: '2026-05-19' },
        MONDAY
      )
    ).toBe(6)
  })

  it('half day = 0.5, also on 24.12.; 0 on a closed day', () => {
    const one = (date) => ({ startDate: date, endDate: date, halfDay: true })
    expect(core.absenceDays(one('2026-11-11'), MONDAY)).toBe(0.5)
    expect(core.absenceDays(one('2026-12-24'), MONDAY)).toBe(0.5)
    expect(core.absenceDays(one('2026-11-09'), MONDAY)).toBe(0)
  })

  it('Christmas week: 24. half, 25./26. holidays, 31. half', () => {
    // 2026-12-22 (Di) … 2027-01-02 (Sa): 22, 23 = 2; 24 = 0.5; 25, 26 = 0;
    // 27 (So) = 1; 28 (Mo) = 0; 29, 30 = 2; 31 = 0.5; 01.01. = 0; 02.01. = 1
    expect(
      core.absenceDays(
        { startDate: '2026-12-22', endDate: '2027-01-02' },
        MONDAY
      )
    ).toBe(7)
  })

  it('counts only the part inside a window', () => {
    const a = { startDate: '2026-12-29', endDate: '2027-01-05' }
    expect(
      core.absenceDays(a, MONDAY, { from: '2026-01-01', to: '2026-12-31' })
    ).toBe(2.5)
    expect(
      core.absenceDays(a, MONDAY, { from: '2027-01-01', to: '2027-12-31' })
    ).toBe(3) // 01.01. Neujahr, Sa, So, 04.01. Ruhetag, Di
  })
})

describe('proRataEntitlement (§ 5 BUrlG)', () => {
  it('full year: the whole entitlement', () => {
    expect(core.proRataEntitlement(26, 2026, null, null)).toEqual({
      entitlement: 26,
      months: 12,
      fullYear: true,
    })
    expect(core.proRataEntitlement(26, 2026, '2020-04-01', null)).toEqual({
      entitlement: 26,
      months: 12,
      fullYear: true,
    })
  })

  it('entry mid-year: 1/12 per full month, half a day or more rounds up', () => {
    // 15.03.-31.12. = 9 full months: 30 * 9 / 12 = 22.5 -> 23
    expect(core.proRataEntitlement(30, 2026, '2026-03-15', null)).toEqual({
      entitlement: 23,
      months: 9,
      fullYear: false,
    })
    // 01.08.-31.12. = 5 months: 26 * 5 / 12 = 10.83 -> 11
    expect(
      core.proRataEntitlement(26, 2026, '2026-08-01', null).entitlement
    ).toBe(11)
  })

  it('a fraction below half a day is kept, not rounded down', () => {
    // 01.12.-31.12. = 1 month: 25 / 12 = 2.083
    expect(
      core.proRataEntitlement(25, 2026, '2026-12-01', null).entitlement
    ).toBe(2.08)
  })

  it('exit mid-year', () => {
    // 01.01.-30.06. = 6 months: 25 * 6 / 12 = 12.5 -> 13
    expect(core.proRataEntitlement(25, 2026, null, '2026-06-30')).toEqual({
      entitlement: 13,
      months: 6,
      fullYear: false,
    })
    // 01.01.-14.06. = 5 full months
    expect(core.proRataEntitlement(24, 2026, null, '2026-06-14')).toEqual({
      entitlement: 10,
      months: 5,
      fullYear: false,
    })
  })

  it('entry and exit in the same year', () => {
    // 01.04.-30.09. = 6 months
    expect(
      core.proRataEntitlement(24, 2026, '2026-04-01', '2026-09-30').entitlement
    ).toBe(12)
  })

  it('a start day missing in the month ends that month on its last day (§ 188 Abs. 3 BGB)', () => {
    const months = (entry, exit) =>
      core.employmentMonthsInYear(2026, entry, exit).months
    expect(months('2026-01-31', '2026-02-27')).toBe(0)
    expect(months('2026-01-31', '2026-02-28')).toBe(1)
    expect(months('2026-03-31', '2026-04-29')).toBe(0)
    expect(months('2026-03-31', '2026-04-30')).toBe(1)
    expect(months('2026-01-30', '2026-02-27')).toBe(0)
    expect(months('2026-01-30', '2026-02-28')).toBe(1)
    // 31.01. → 28.02. → 30.03. (day 30 exists in March)
    expect(months('2026-01-31', '2026-03-29')).toBe(1)
    expect(months('2026-01-31', '2026-03-30')).toBe(2)
    // leap year: 31.01.2028 → 29.02.2028
    expect(
      core.employmentMonthsInYear(2028, '2028-01-31', '2028-02-28')
    ).toEqual({ months: 0, fullYear: false })
    expect(
      core.employmentMonthsInYear(2028, '2028-01-31', '2028-02-29')
    ).toEqual({ months: 1, fullYear: false })
    // an ordinary start day: 15.03. → 14.04.
    expect(months('2026-03-15', '2026-04-13')).toBe(0)
    expect(months('2026-03-15', '2026-04-14')).toBe(1)
  })

  it('no employment in the year: null', () => {
    expect(core.proRataEntitlement(24, 2026, '2027-01-01', null)).toBeNull()
    expect(core.proRataEntitlement(24, 2026, null, '2025-12-31')).toBeNull()
  })
})

describe('vacationBalance', () => {
  const urlaub = (startDate, endDate, status = 'genehmigt', extra = {}) => ({
    type: 'urlaub',
    status,
    startDate,
    endDate,
    halfDay: false,
    ...extra,
  })

  it('entitlement − approved, planned shown separately', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 26, carryoverDays: null },
      absences: [
        urlaub('2026-07-07', '2026-07-12'), // Di-So = 6
        urlaub('2026-11-24', '2026-11-28', 'geplant'), // Di-Sa = 5
        { ...urlaub('2026-08-04', '2026-08-04'), type: 'frei' },
      ],
      closedWeekdays: MONDAY,
    })
    expect(b).toMatchObject({
      status: 'ok',
      entitlementDays: 26,
      entitlement: 26,
      carryoverDays: null,
      approvedDays: 6,
      plannedDays: 5,
      remainingDays: 20,
      remainingAfterPlannedDays: 15,
    })
  })

  it('no entitlement: no-config, remaining offen (null), facts still counted', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: null,
      absences: [urlaub('2026-07-07', '2026-07-08')],
      closedWeekdays: MONDAY,
    })
    expect(b).toMatchObject({
      status: 'no-config',
      entitlementDays: null,
      entitlement: null,
      remainingDays: null,
      remainingAfterPlannedDays: null,
      approvedDays: 2,
    })
    const nullRow = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: null, carryoverDays: 3 },
      absences: [],
      closedWeekdays: MONDAY,
    })
    expect(nullRow.status).toBe('no-config')
    expect(nullRow.remainingDays).toBeNull()
  })

  it('carryover is used first by approved vacation until 31.03., the rest expires', () => {
    const input = {
      year: 2026,
      entitlement: { entitlementDays: 25, carryoverDays: 5 },
      absences: [
        urlaub('2026-03-03', '2026-03-05'), // Di-Do = 3, before the deadline
        urlaub('2026-06-02', '2026-06-06'), // Di-Sa, 04.06. Fronleichnam = 4
        urlaub('2026-03-24', '2026-03-25', 'geplant'), // planned: not used
      ],
      closedWeekdays: MONDAY,
    }
    const before = core.vacationBalance({ ...input, today: '2026-03-10' })
    expect(before).toMatchObject({
      status: 'ok',
      carryoverDeadline: '2026-03-31',
      carryoverUsed: 3,
      carryoverExpired: 0,
      carryoverOpen: 2,
      approvedDays: 7,
      plannedDays: 2,
      remainingDays: 23, // 25 + 5 - 7
    })
    const after = core.vacationBalance({ ...input, today: '2026-04-01' })
    expect(after).toMatchObject({
      carryoverUsed: 3,
      carryoverExpired: 2,
      carryoverOpen: 0,
      remainingDays: 21, // 25 + 5 - 2 - 7
      remainingAfterPlannedDays: 19,
    })
  })

  it('no carryover entered: carryover fields null, remaining counts 0', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 20, carryoverDays: null },
      absences: [urlaub('2026-02-03', '2026-02-07')], // 5
      closedWeekdays: MONDAY,
    })
    expect(b).toMatchObject({
      status: 'ok',
      carryoverDays: null,
      carryoverUsed: null,
      carryoverExpired: null,
      carryoverOpen: null,
      remainingDays: 15,
    })
    const zero = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 20, carryoverDays: 0 },
      absences: [],
      closedWeekdays: MONDAY,
    })
    expect(zero).toMatchObject({
      carryoverUsed: 0,
      carryoverExpired: 0,
      carryoverOpen: 0,
    })
  })

  it('carryover larger than the vacation until 31.03. is capped', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-12-01',
      entitlement: { entitlementDays: 20, carryoverDays: 2 },
      absences: [urlaub('2026-02-03', '2026-02-07')], // 5
      closedWeekdays: MONDAY,
    })
    expect(b).toMatchObject({
      carryoverUsed: 2,
      carryoverExpired: 0,
      remainingDays: 17,
    })
  })

  it('pro-rata entitlement on entry mid-year', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 24, carryoverDays: 0 },
      entryDate: '2026-07-01',
      absences: [],
      closedWeekdays: MONDAY,
    })
    expect(b).toMatchObject({
      status: 'ok',
      entitlementDays: 24,
      entitlement: 12,
      months: 6,
      fullYear: false,
      remainingDays: 12,
    })
  })

  it('a year outside the employment: not-employed', () => {
    const b = core.vacationBalance({
      year: 2025,
      today: '2026-11-08',
      entitlement: { entitlementDays: 24, carryoverDays: 0 },
      entryDate: '2026-07-01',
      absences: [],
      closedWeekdays: MONDAY,
    })
    expect(b.status).toBe('not-employed')
    expect(b.remainingDays).toBeNull()
  })

  it('a vacation across New Year counts in each year only its part', () => {
    const absences = [urlaub('2026-12-29', '2027-01-05')]
    const y26 = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 20, carryoverDays: null },
      absences,
      closedWeekdays: MONDAY,
    })
    const y27 = core.vacationBalance({
      year: 2027,
      today: '2026-11-08',
      entitlement: { entitlementDays: 20, carryoverDays: null },
      absences,
      closedWeekdays: MONDAY,
    })
    expect(y26.approvedDays).toBe(2.5)
    expect(y27.approvedDays).toBe(3)
  })

  it('a half day counts 0.5', () => {
    const b = core.vacationBalance({
      year: 2026,
      today: '2026-11-08',
      entitlement: { entitlementDays: 20, carryoverDays: null },
      absences: [
        urlaub('2026-11-11', '2026-11-11', 'genehmigt', { halfDay: true }),
      ],
      closedWeekdays: MONDAY,
    })
    expect(b.approvedDays).toBe(0.5)
    expect(b.remainingDays).toBe(19.5)
  })
})

describe('shifts', () => {
  it('checkShiftTimes: end after start, same day, break shorter than the shift', () => {
    expect(core.checkShiftTimes('06:00', '12:00', 30)).toEqual({ ok: true })
    expect(core.checkShiftTimes('06:00', '12:00')).toEqual({ ok: true })
    expect(core.checkShiftTimes('12:00', '12:00', 0)).toMatchObject({
      ok: false,
      code: 'end_before_start',
    })
    expect(core.checkShiftTimes('22:00', '02:00', 0)).toMatchObject({
      ok: false,
      code: 'end_before_start',
    })
    expect(core.checkShiftTimes('6:00', '12:00', 0)).toMatchObject({
      ok: false,
      code: 'invalid_time',
    })
    expect(core.checkShiftTimes('24:00', '23:00', 0).ok).toBe(false)
    expect(core.checkShiftTimes('06:00', '07:00', 60)).toMatchObject({
      ok: false,
      code: 'invalid_break',
    })
    expect(core.checkShiftTimes('06:00', '07:00', 1.5).ok).toBe(false)
  })

  it('shiftMinutes and shiftsOverlap', () => {
    const a = { date: '2026-11-10', startTime: '06:00', endTime: '12:00' }
    expect(core.shiftMinutes({ ...a, breakMinutes: 30 })).toBe(330)
    expect(
      core.shiftsOverlap(a, { ...a, startTime: '11:00', endTime: '14:00' })
    ).toBe(true)
    expect(
      core.shiftsOverlap(a, { ...a, startTime: '12:00', endTime: '18:00' })
    ).toBe(false)
    expect(core.shiftsOverlap(a, { ...a, date: '2026-11-11' })).toBe(false)
  })
})

describe('calendarDays / verkaufBesetzt', () => {
  const employees = [
    { id: 1, area: 'verkauf' },
    { id: 2, area: 'verkauf' },
    { id: 3, area: 'backstube' },
  ]
  const shift = (employeeId, date) => ({
    employeeId,
    date,
    startTime: '06:00',
    endTime: '12:00',
  })

  it('counts Verkauf people with a shift, not absent the whole day', () => {
    const shifts = [
      shift(1, '2026-11-10'),
      shift(1, '2026-11-10'),
      shift(2, '2026-11-10'),
      shift(3, '2026-11-10'),
      shift(2, '2026-11-11'),
    ]
    const absences = [
      { employeeId: 2, startDate: '2026-11-11', endDate: '2026-11-12' },
      {
        employeeId: 1,
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        halfDay: true,
      },
    ]
    const days = core.calendarDays(
      '2026-11-09',
      '2026-11-11',
      MONDAY,
      employees,
      shifts,
      absences
    )
    expect(days.map((d) => [d.date, d.closed, d.verkaufBesetzt])).toEqual([
      ['2026-11-09', true, 0],
      ['2026-11-10', false, 2],
      ['2026-11-11', false, 0],
    ])
    expect(days[0]).toMatchObject({ weekday: 1, restDay: true, weight: 0 })
  })

  it('carries opening hours and the Besetzung per day', () => {
    const days = core.calendarDays(
      '2026-11-09',
      '2026-11-10',
      MONDAY,
      employees,
      [shift(1, '2026-11-10')],
      []
    )
    expect(days[0]).toMatchObject({ openingHours: null, besetzung: null })
    expect(days[1].openingHours).toEqual({ opens: '05:30', closes: '13:30' })
    expect(days[1].besetzung).toMatchObject({
      covered: false,
      gaps: [
        { from: '05:30', to: '06:00' },
        { from: '12:00', to: '13:30' },
      ],
    })
  })
})

describe('opening hours (opening-hours.core.js)', () => {
  const hours = require('../../src/services/opening-hours.core')

  it('one table: Mo closed, Di-Fr 05:30-13:30, Sa 05:30-12:30, So 08:00-11:00', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(hours.openingHoursForWeekday)).toEqual([
      null,
      { opens: '05:30', closes: '13:30' },
      { opens: '05:30', closes: '13:30' },
      { opens: '05:30', closes: '13:30' },
      { opens: '05:30', closes: '13:30' },
      { opens: '05:30', closes: '12:30' },
      { opens: '08:00', closes: '11:00' },
    ])
  })

  it('the table closes exactly the default Ruhetag', () => {
    expect(hours.weekdaysWithoutHours()).toEqual(core.DEFAULT_CLOSED_WEEKDAYS)
  })

  it('a copy, the table itself is frozen', () => {
    const tue = hours.openingHoursForWeekday(2)
    tue.opens = '00:00'
    expect(hours.openingHoursForWeekday(2).opens).toBe('05:30')
    expect(Object.isFrozen(hours.OPENING_HOURS)).toBe(true)
  })

  it('dayInfo: hours on open days, none on Ruhetag and holidays', () => {
    expect(core.dayInfo('2026-11-14', MONDAY).openingHours).toEqual({
      opens: '05:30',
      closes: '12:30',
    })
    expect(core.dayInfo('2026-11-15', MONDAY).openingHours).toEqual({
      opens: '08:00',
      closes: '11:00',
    })
    expect(core.dayInfo('2026-11-09', MONDAY).openingHours).toBeNull()
    // Fronleichnam (Thursday) and Allerheiligen on a Sunday
    expect(core.dayInfo('2026-06-04', MONDAY).openingHours).toBeNull()
    expect(core.dayInfo('2026-11-01', MONDAY).openingHours).toBeNull()
    // 24.12. keeps the normal hours of its weekday (Thursday in 2026)
    expect(core.dayInfo('2026-12-24', MONDAY).openingHours).toEqual({
      opens: '05:30',
      closes: '13:30',
    })
  })

  it('follows the configured Ruhetage: closed day without hours, an opened Monday without a table entry', () => {
    expect(core.dayInfo('2026-11-15', [1, 7]).openingHours).toBeNull()
    const monday = core.dayInfo('2026-11-09', [])
    expect(monday.closed).toBe(false)
    expect(monday.openingHours).toBeNull()
  })
})

describe('verkaufCoverage (Besetzung)', () => {
  const employees = [
    { id: 1, area: 'verkauf' },
    { id: 2, area: 'verkauf' },
    { id: 3, area: 'backstube' },
  ]
  const OPEN = { opens: '05:30', closes: '13:30' }
  const s = (employeeId, startTime, endTime, extra = {}) => ({
    employeeId,
    date: '2026-11-10',
    startTime,
    endTime,
    breakMinutes: 30,
    ...extra,
  })
  const cover = (shifts, absences = [], hours = OPEN) =>
    core.verkaufCoverage('2026-11-10', hours, employees, shifts, absences)

  it('no opening hours: null', () => {
    expect(cover([s(1, '06:00', '12:00')], [], null)).toBeNull()
  })

  it('nobody planned: one gap over the whole opening time', () => {
    expect(cover([])).toEqual({
      opens: '05:30',
      closes: '13:30',
      segments: [{ from: '05:30', to: '13:30', employeeIds: [] }],
      gaps: [{ from: '05:30', to: '13:30' }],
      covered: false,
    })
  })

  it('who covers which part, gaps at the start and the end, clipped to the opening time', () => {
    const res = cover([
      s(2, '09:00', '14:00'),
      s(1, '06:00', '10:00'),
      s(3, '03:00', '13:30'), // Backstube: never counts
    ])
    expect(res.segments).toEqual([
      { from: '05:30', to: '06:00', employeeIds: [] },
      { from: '06:00', to: '09:00', employeeIds: [1] },
      { from: '09:00', to: '10:00', employeeIds: [1, 2] },
      { from: '10:00', to: '13:30', employeeIds: [2] },
    ])
    expect(res.gaps).toEqual([{ from: '05:30', to: '06:00' }])
    expect(res.covered).toBe(false)
  })

  it('handover without a gap is covered; the break is no gap', () => {
    const res = cover([s(1, '05:30', '09:30'), s(2, '09:30', '13:30')])
    expect(res.covered).toBe(true)
    expect(res.gaps).toEqual([])
    expect(res.segments.map((x) => x.employeeIds)).toEqual([[1], [2]])
  })

  it('a gap in the middle and two shifts of the same person', () => {
    const res = cover([s(1, '05:30', '08:00'), s(1, '09:00', '13:30')])
    expect(res.gaps).toEqual([{ from: '08:00', to: '09:00' }])
    expect(res.segments).toHaveLength(3)
  })

  it('shifts outside the opening time and on other days do not count', () => {
    const res = cover([
      s(1, '04:00', '05:30'),
      s(2, '13:30', '15:00'),
      s(2, '05:30', '13:30', { date: '2026-11-11' }),
    ])
    expect(res.gaps).toEqual([{ from: '05:30', to: '13:30' }])
  })

  it('a whole-day absence removes the shift, a half-day absence keeps it', () => {
    const shifts = [s(1, '05:30', '13:30')]
    const whole = [
      { employeeId: 1, startDate: '2026-11-09', endDate: '2026-11-12' },
    ]
    const half = [
      {
        employeeId: 1,
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        halfDay: true,
      },
    ]
    expect(cover(shifts, whole).covered).toBe(false)
    expect(cover(shifts, half).covered).toBe(true)
  })
})

describe('plannedHours (Plan und Soll)', () => {
  // KW 46/2026: Mo 09.11. (Ruhetag) … So 15.11.
  const WEEK = { from: '2026-11-09', to: '2026-11-15' }
  const person = (extra = {}) => ({
    id: 7,
    weeklyHours: 30,
    entryDate: null,
    exitDate: null,
    ...extra,
  })
  const shift = (
    date,
    startTime,
    endTime,
    breakMinutes = 0,
    employeeId = 7
  ) => ({
    employeeId,
    date,
    startTime,
    endTime,
    breakMinutes,
  })
  const hours = (extra) =>
    core.plannedHours({
      ...WEEK,
      employee: person(),
      shifts: [],
      absences: [],
      closedWeekdays: MONDAY,
      ...extra,
    })

  it('daily target: weekly hours over the open weekdays', () => {
    expect(core.dailyTargetMinutes(30, MONDAY)).toBe(300)
    expect(core.dailyTargetMinutes(35, [])).toBe(300)
    expect(core.dailyTargetMinutes(null, MONDAY)).toBeNull()
    expect(core.dailyTargetMinutes(10, [1, 2, 3, 4, 5, 6, 7])).toBeNull()
  })

  it('plan = Σ (end − start − break); a full week is exactly the weekly hours', () => {
    const res = hours({
      shifts: [
        shift('2026-11-10', '06:00', '12:00', 30),
        shift('2026-11-11', '06:00', '12:00'),
        shift('2026-11-12', '12:00', '18:30', 30),
        shift('2026-11-16', '06:00', '12:00'), // next week
        shift('2026-11-10', '06:00', '12:00', 0, 8), // someone else
      ],
    })
    expect(res).toEqual({
      employeeId: 7,
      from: '2026-11-09',
      to: '2026-11-15',
      weeklyHours: 30,
      plannedMinutes: 330 + 360 + 360,
      shiftCount: 3,
      targetMinutes: 1800,
      diffMinutes: 1050 - 1800,
      targetDays: 6,
      creditedDays: 0,
      status: 'ok',
    })
  })

  it('without weekly hours the target is open (null), never 0', () => {
    const res = hours({
      employee: person({ weeklyHours: null }),
      shifts: [shift('2026-11-10', '06:00', '12:00')],
    })
    expect(res).toMatchObject({
      plannedMinutes: 360,
      targetMinutes: null,
      diffMinutes: null,
      status: 'no-target',
    })
  })

  it('urlaub and abwesend reduce the target, half days by half; frei does not', () => {
    const absence = (type, startDate, endDate, halfDay = false) => ({
      employeeId: 7,
      type,
      status: 'geplant',
      startDate,
      endDate,
      halfDay,
    })
    expect(
      hours({ absences: [absence('urlaub', '2026-11-09', '2026-11-11')] })
    ).toMatchObject({ creditedDays: 2, targetDays: 4, targetMinutes: 1200 })
    expect(
      hours({
        absences: [absence('abwesend', '2026-11-12', '2026-11-12', true)],
      })
    ).toMatchObject({ creditedDays: 0.5, targetMinutes: 1650 })
    expect(
      hours({ absences: [absence('frei', '2026-11-12', '2026-11-12')] })
    ).toMatchObject({ creditedDays: 0, targetMinutes: 1800 })
    // another person's absence does not count
    expect(
      hours({
        absences: [
          { ...absence('urlaub', '2026-11-10', '2026-11-15'), employeeId: 8 },
        ],
      })
    ).toMatchObject({ targetMinutes: 1800 })
  })

  it('holidays, 24.12. and the employment period shape the target', () => {
    // KW 52/2026: Mo 21.12. … So 27.12.: 24.12. half, 25./26.12. holidays
    const xmas = hours({ from: '2026-12-21', to: '2026-12-27' })
    expect(xmas).toMatchObject({ targetDays: 3.5, targetMinutes: 1050 })
    // entry on Friday 13.11.: Fr, Sa, So
    const entry = hours({ employee: person({ entryDate: '2026-11-13' }) })
    expect(entry).toMatchObject({ targetDays: 3, targetMinutes: 900 })
  })

  it('a month averages weekly hours × 13/3', () => {
    // November 2026: 30 days, 5 Mondays, Allerheiligen on Sunday 01.11.
    const nov = hours({ from: '2026-11-01', to: '2026-11-30' })
    expect(nov.targetDays).toBe(24)
    expect(nov.targetMinutes).toBe(24 * 300)
    // over a year without holidays the months average weeklyHours × 13/3
    const perDay = core.dailyTargetMinutes(30, MONDAY)
    expect((perDay * 6 * 52) / 12).toBeCloseTo(30 * 60 * (13 / 3), 6)
  })

  it('hoursByEmployee keeps the order of the employees', () => {
    const res = core.hoursByEmployee(
      WEEK.from,
      WEEK.to,
      [person({ id: 2 }), person({ id: 1, weeklyHours: null })],
      [],
      [],
      MONDAY
    )
    expect(res.map((h) => [h.employeeId, h.status])).toEqual([
      [2, 'ok'],
      [1, 'no-target'],
    ])
  })
})

describe('withinEmployment', () => {
  it('respects entry and exit, each optional', () => {
    expect(core.withinEmployment('2026-05-01', null, null)).toBe(true)
    expect(core.withinEmployment('2026-05-01', '2026-05-02', null)).toBe(false)
    expect(core.withinEmployment('2026-05-02', '2026-05-02', null)).toBe(true)
    expect(core.withinEmployment('2026-05-03', null, '2026-05-02')).toBe(false)
  })
})

describe('dayInfo with the bakery calendar (Z14, kalender.core.js)', () => {
  const kalender = require('../../src/services/kalender.core')
  const feiertage = (year) =>
    kalender
      .holidaysSaarland(year)
      .map((h) => ({ datum: h.date, name: h.name }))
  // Erfundener Kalender: nur 2026 geführt.
  const calendar = kalender.normalizeKalender({
    version: 1,
    bundesland: 'saarland',
    feiertage: { 2026: feiertage(2026) },
    tage: [
      {
        von: '2026-11-17',
        bis: '2026-11-18',
        typ: 'geschlossen',
        notiz: 'Betriebsferien',
      },
      { datum: '2026-06-04', typ: 'wie-sonntag', notiz: 'Fronleichnam offen' },
      {
        datum: '2026-11-23',
        typ: 'sonderoeffnung',
        wie: 6,
        offen_bis: '11:00',
        notiz: 'Testmarkt',
      },
      { datum: '2026-11-24', typ: 'teigtag', notiz: 'Teig für Mittwoch' },
      { datum: '2027-02-02', typ: 'geschlossen', notiz: 'Inventur' },
    ],
  })

  it('without a calendar the answer is exactly the old one, plus the day kind', () => {
    for (const date of [
      '2026-11-09',
      '2026-06-04',
      '2026-11-14',
      '2026-12-24',
    ]) {
      const before = core.dayInfo(date, MONDAY)
      expect(core.dayInfo(date, MONDAY, null)).toEqual(before)
      expect(before.calendar).toBe('missing')
    }
    expect(core.dayInfo('2026-11-09', MONDAY)).toMatchObject({
      kind: 'ruhetag',
      kindLabel: 'Ruhetag',
    })
    expect(core.dayInfo('2026-06-04', MONDAY)).toMatchObject({
      kind: 'geschlossen',
      kindLabel: 'Geschlossen',
      kindDetail: 'Fronleichnam',
    })
    expect(core.dayInfo('2026-11-14', MONDAY)).toMatchObject({
      kind: 'normal',
      kindLabel: null,
      kindDetail: null,
    })
  })

  it('a normal day, a Ruhetag and a holiday stay what they were', () => {
    for (const date of [
      '2026-11-09',
      '2026-11-14',
      '2026-12-25',
      '2026-12-24',
    ]) {
      const { calendar: state, ...rest } = core.dayInfo(date, MONDAY, calendar)
      const { calendar: _old, ...before } = core.dayInfo(date, MONDAY)
      expect(rest).toEqual(before)
      expect(state).toBe('ok')
    }
  })

  it('a closing day of the calendar is closed, but still costs a vacation day', () => {
    expect(core.dayInfo('2026-11-17', MONDAY, calendar)).toMatchObject({
      closed: true,
      restDay: false,
      holidayName: null,
      kind: 'geschlossen',
      kindLabel: 'Geschlossen',
      kindDetail: 'Betriebsferien',
      openingHours: null,
      weight: 1,
    })
    expect(
      core.absenceDays(
        { startDate: '2026-11-17', endDate: '2026-11-18' },
        MONDAY
      )
    ).toBe(2)
  })

  it('a holiday opened "wie Sonntag" is open with Sunday hours and never a vacation day', () => {
    expect(core.dayInfo('2026-06-04', MONDAY, calendar)).toMatchObject({
      closed: false,
      holidayName: 'Fronleichnam',
      kind: 'wie-sonntag',
      kindLabel: 'Wie Sonntag',
      openingHours: { opens: '08:00', closes: '11:00' },
      weight: 0,
    })
  })

  it('a Sonderöffnung on the Ruhetag opens with the hours of its weekday, cut by offen_bis', () => {
    expect(core.dayInfo('2026-11-23', MONDAY, calendar)).toMatchObject({
      weekday: 1,
      restDay: true,
      closed: false,
      kind: 'sonderoeffnung',
      kindLabel: 'Sonderöffnung (wie Samstag)',
      kindDetail: 'Testmarkt · offen bis 11:00 Uhr',
      openingHours: { opens: '05:30', closes: '11:00' },
      weight: 0,
    })
  })

  it('a dough-only day keeps the shop closed', () => {
    expect(core.dayInfo('2026-11-24', MONDAY, calendar)).toMatchObject({
      closed: true,
      kind: 'teigtag',
      kindLabel: 'Nur Teig (Laden geschlossen)',
      openingHours: null,
      weight: 1,
    })
  })

  it('a year the calendar does not list: holidays stay closed, entries still apply', () => {
    expect(core.dayInfo('2027-01-01', MONDAY, calendar)).toMatchObject({
      closed: true,
      holidayName: 'Neujahr',
      kind: 'geschlossen',
      kindDetail: 'Neujahr',
      weight: 0,
      calendar: 'year-missing',
    })
    expect(core.dayInfo('2027-02-02', MONDAY, calendar)).toMatchObject({
      closed: true,
      kind: 'geschlossen',
      kindDetail: 'Inventur',
      calendar: 'year-missing',
    })
    expect(core.dayInfo('2027-02-03', MONDAY, calendar)).toMatchObject({
      closed: false,
      kind: 'normal',
    })
  })

  it('calendarDays: no Besetzung on a closing day, Besetzung over the special hours', () => {
    const employees = [{ id: 1, area: 'verkauf' }]
    const shifts = [
      {
        employeeId: 1,
        date: '2026-11-23',
        startTime: '05:30',
        endTime: '11:00',
        breakMinutes: 0,
      },
    ]
    const days = core.calendarDays(
      '2026-11-17',
      '2026-11-23',
      MONDAY,
      employees,
      shifts,
      [],
      calendar
    )
    expect(days[0]).toMatchObject({ closed: true, besetzung: null })
    expect(days[6]).toMatchObject({
      closed: false,
      kind: 'sonderoeffnung',
      besetzung: expect.objectContaining({ covered: true }),
    })
    // Soll: das Gewicht hängt nicht am Kalender
    const withoutCalendar = core.calendarDays(
      '2026-11-17',
      '2026-11-23',
      MONDAY,
      employees,
      shifts,
      []
    )
    expect(days.map((d) => d.weight)).toEqual(
      withoutCalendar.map((d) => d.weight)
    )
  })
})
