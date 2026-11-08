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
})

describe('withinEmployment', () => {
  it('respects entry and exit, each optional', () => {
    expect(core.withinEmployment('2026-05-01', null, null)).toBe(true)
    expect(core.withinEmployment('2026-05-01', '2026-05-02', null)).toBe(false)
    expect(core.withinEmployment('2026-05-02', '2026-05-02', null)).toBe(true)
    expect(core.withinEmployment('2026-05-03', null, '2026-05-02')).toBe(false)
  })
})
