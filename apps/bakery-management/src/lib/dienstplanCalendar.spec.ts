import {
  closedDayLabel,
  daysInMonth,
  dienstplanHref,
  entriesByCell,
  formatMonthTitle,
  formatPeriodTitle,
  monthDates,
  monthSegment,
  parseMonth,
  parsePeriod,
  parseYear,
  periodEnd,
  periodStart,
  stepPeriod,
  switchPeriod,
  formatWeekTitle,
  isoWeekNumber,
  mondayOf,
  parseAreaFilter,
  parseView,
  parseWeek,
  staffingText,
  weekDates,
  besetzungLines,
  gapText,
  hasVerkaufShifts,
  hoursTexts,
  openingHoursText,
  shortNames,
} from './dienstplanCalendar'
import type {
  Absence,
  Besetzung,
  CalendarDay,
  Employee,
  PlannedHours,
  Shift,
} from './dienstplanApi'

function day(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-11-10',
    weekday: 2,
    holidayName: null,
    restDay: false,
    closed: false,
    weight: 1,
    halfDayName: null,
    openingHours: { opens: '05:30', closes: '13:30' },
    verkaufBesetzt: 2,
    besetzung: {
      opens: '05:30',
      closes: '13:30',
      segments: [{ from: '05:30', to: '13:30', employeeIds: [1, 2] }],
      gaps: [],
      covered: true,
    },
    ...overrides,
  }
}

describe('dienstplanCalendar', () => {
  it('liest Woche, Ansicht und Bereich aus der URL', () => {
    expect(parseWeek('2026-11-12')).toBe('2026-11-09')
    expect(parseWeek('2026-11-09')).toBe('2026-11-09')
    expect(parseWeek('2026-11-15')).toBe('2026-11-09')
    expect(parseWeek('2026-02-30')).toBeNull()
    expect(parseWeek('kw46')).toBeNull()
    expect(parseWeek(undefined)).toBeNull()

    expect(parseView('monat')).toBe('monat')
    expect(parseView('jahr')).toBe('jahr')
    expect(parseView('tag')).toBe('woche')
    expect(parseView(undefined)).toBe('woche')

    expect(parseAreaFilter('verkauf')).toBe('verkauf')
    expect(parseAreaFilter('buero')).toBe('buero')
    expect(parseAreaFilter('lager')).toBe('alle')
    expect(parseAreaFilter(undefined)).toBe('alle')
  })

  it('rechnet Montag, Wochentage und Kalenderwoche (ISO 8601)', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02')
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
    expect(weekDates('2026-12-28')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
    expect(isoWeekNumber('2026-11-09')).toBe(46)
    expect(isoWeekNumber('2026-01-01')).toBe(1)
    expect(isoWeekNumber('2026-12-28')).toBe(53)
    expect(isoWeekNumber('2027-01-01')).toBe(53)
    expect(isoWeekNumber('2027-01-04')).toBe(1)
    expect(isoWeekNumber('2024-12-30')).toBe(1)
    expect(formatWeekTitle('2026-11-09')).toBe('KW 46 · 09.11. – 15.11.2026')
    expect(formatWeekTitle('2026-12-28')).toBe('KW 53 · 28.12. – 03.01.2027')
  })

  it('baut die URL ohne Standardwerte', () => {
    expect(
      dienstplanHref({ start: '2026-11-09', view: 'woche', area: 'alle' })
    ).toBe('/admin/dienstplan?woche=2026-11-09')
    expect(
      dienstplanHref({ start: '2026-11-01', view: 'monat', area: 'verkauf' })
    ).toBe('/admin/dienstplan?ansicht=monat&monat=2026-11&bereich=verkauf')
    expect(
      dienstplanHref({ start: '2026-01-01', view: 'jahr', area: 'alle' })
    ).toBe('/admin/dienstplan?ansicht=jahr&jahr=2026')
  })

  it('ordnet Schichten und mehrtägige Abwesenheiten den Zellen zu', () => {
    const shift: Shift = {
      id: 1,
      employeeId: 3,
      date: '2026-11-10',
      startTime: '06:00',
      endTime: '12:00',
      breakMinutes: 0,
      minutes: 360,
      note: null,
    }
    const outside: Shift = { ...shift, id: 2, date: '2026-11-16' }
    const absence: Absence = {
      id: 7,
      employeeId: 4,
      type: 'urlaub',
      status: 'geplant',
      startDate: '2026-11-05',
      endDate: '2026-11-11',
      halfDay: false,
      days: 5,
      note: null,
    }
    const cells = entriesByCell(
      { shifts: [shift, outside], absences: [absence] },
      weekDates('2026-11-09')
    )
    expect(cells.get('3:2026-11-10')?.shifts).toEqual([shift])
    expect(cells.has('3:2026-11-16')).toBe(false)
    expect(cells.get('4:2026-11-09')?.absences).toEqual([absence])
    expect(cells.get('4:2026-11-11')?.absences).toEqual([absence])
    expect(cells.has('4:2026-11-12')).toBe(false)
  })

  it('Zeitraum je Ansicht: Anfang, Ende, Blättern', () => {
    expect(periodStart('woche', '2026-11-12')).toBe('2026-11-09')
    expect(periodStart('monat', '2026-11-12')).toBe('2026-11-01')
    expect(periodStart('jahr', '2026-11-12')).toBe('2026-01-01')
    expect(periodEnd('woche', '2026-11-09')).toBe('2026-11-15')
    expect(periodEnd('monat', '2028-02-01')).toBe('2028-02-29')
    expect(periodEnd('monat', '2026-02-01')).toBe('2026-02-28')
    expect(periodEnd('jahr', '2026-01-01')).toBe('2026-12-31')
    expect(daysInMonth('2026-11-01')).toBe(30)
    expect(monthDates('2026-02-01')).toHaveLength(28)

    expect(stepPeriod('woche', '2026-11-09', 1)).toBe('2026-11-16')
    expect(stepPeriod('monat', '2026-12-01', 1)).toBe('2027-01-01')
    expect(stepPeriod('monat', '2026-01-01', -1)).toBe('2025-12-01')
    expect(stepPeriod('jahr', '2026-01-01', -1)).toBe('2025-01-01')

    expect(formatMonthTitle('2026-03-01')).toBe('März 2026')
    expect(formatPeriodTitle('jahr', '2026-01-01')).toBe('Jahr 2026')
  })

  it('Ansichtswechsel: Zeitraum mit heute, sonst nach dem Donnerstag', () => {
    const today = '2026-11-10'
    // Woche 30.11.-06.12. (Donnerstag 03.12.) → Dezember
    expect(switchPeriod('woche', '2026-11-30', 'monat', today)).toBe(
      '2026-12-01'
    )
    // Woche mit heute → Monat von heute
    expect(switchPeriod('woche', '2026-11-09', 'monat', today)).toBe(
      '2026-11-01'
    )
    // Monat ohne heute → erste Woche mit Donnerstag im Monat
    expect(switchPeriod('monat', '2027-01-01', 'woche', today)).toBe(
      '2027-01-04'
    )
    expect(switchPeriod('monat', '2026-10-01', 'woche', today)).toBe(
      '2026-09-28'
    )
    // Jahr mit heute → Woche von heute; anderes Jahr → Januar
    expect(switchPeriod('jahr', '2026-01-01', 'woche', today)).toBe(
      '2026-11-09'
    )
    expect(switchPeriod('jahr', '2027-01-01', 'monat', today)).toBe(
      '2027-01-01'
    )
    // Woche 28.12.2026-03.01.2027 (Donnerstag 31.12.) → Jahr 2026
    expect(switchPeriod('woche', '2026-12-28', 'jahr', today)).toBe(
      '2026-01-01'
    )
  })

  it('liest Monat und Jahr aus der URL, sonst aus der Woche oder heute', () => {
    expect(parseMonth('2026-11')).toBe('2026-11-01')
    expect(parseMonth('2026-13')).toBeNull()
    expect(parseMonth('2026-11-05')).toBeNull()
    expect(parseYear('2026')).toBe('2026-01-01')
    expect(parseYear('26')).toBeNull()
    // Nur Jahre, für die die API ein Urlaubskonto rechnet (2000-2100).
    expect(parseYear('2000')).toBe('2000-01-01')
    expect(parseYear('2100')).toBe('2100-01-01')
    expect(parseYear('1999')).toBeNull()
    expect(parseYear('2101')).toBeNull()
    const today = '2026-11-10'
    expect(parsePeriod('monat', { month: '2026-03' }, today)).toBe('2026-03-01')
    expect(parsePeriod('monat', { week: '2026-12-02' }, today)).toBe(
      '2026-12-01'
    )
    expect(parsePeriod('jahr', { year: 'x' }, today)).toBe('2026-01-01')
    expect(parsePeriod('jahr', { year: '1999' }, today)).toBe('2026-01-01')
    expect(parsePeriod('woche', {}, today)).toBe('2026-11-09')
  })

  it('Balken der Jahresansicht: Anteil im Monat', () => {
    const absence = { startDate: '2026-07-27', endDate: '2026-08-08' }
    expect(monthSegment(absence, '2026-07-01')).toEqual({
      left: 26 / 31,
      width: 5 / 31,
    })
    expect(monthSegment(absence, '2026-08-01')).toEqual({
      left: 0,
      width: 8 / 31,
    })
    expect(monthSegment(absence, '2026-09-01')).toBeNull()
  })

  it('Besetzung: geschlossen, „nichts geplant“ statt Lücken, durchgehend besetzt', () => {
    expect(staffingText(day(), true)).toBe('durchgehend besetzt')
    const gappy = day({
      besetzung: {
        opens: '05:30',
        closes: '13:30',
        segments: [
          { from: '05:30', to: '12:00', employeeIds: [1] },
          { from: '12:00', to: '13:30', employeeIds: [] },
        ],
        gaps: [{ from: '12:00', to: '13:30' }],
        covered: false,
      },
    })
    // Mit Lücken keine Überschrift - die Zeilen sagen „unbesetzt …“.
    expect(staffingText(gappy, true)).toBeNull()
    expect(staffingText(day({ verkaufBesetzt: 0 }), false)).toBe(
      'nichts geplant'
    )
    // Offener Tag ohne hinterlegte Öffnungszeit: die alte Zählung.
    expect(
      staffingText(day({ openingHours: null, besetzung: null }), true)
    ).toBe('Öffnungszeit nicht hinterlegt · Verkauf besetzt: 2')
    // Geschlossen: keine Zeile - der Name des Tags steht schon darüber.
    expect(staffingText(day({ closed: true, restDay: true }), true)).toBeNull()

    expect(closedDayLabel(day())).toBeNull()
    expect(closedDayLabel(day({ closed: true, restDay: true }))).toBe('Ruhetag')
    expect(
      closedDayLabel(day({ closed: true, holidayName: 'Allerheiligen' }))
    ).toBe('Allerheiligen')
  })
})

describe('Öffnungszeit, Besetzung und Stunden (nur Anzeige)', () => {
  it('Öffnungszeit als „05:30–13:30“, geschlossen ohne', () => {
    expect(openingHoursText(day())).toBe('05:30–13:30')
    expect(
      openingHoursText(day({ closed: true, openingHours: null }))
    ).toBeNull()
  })

  it('Lücken: bis Ladenschluss „ab … unbesetzt“, sonst „unbesetzt von–bis“', () => {
    expect(gapText({ from: '13:00', to: '13:30' }, '13:30')).toBe(
      'ab 13:00 unbesetzt'
    )
    expect(gapText({ from: '05:30', to: '13:30' }, '13:30')).toBe(
      'ab 05:30 unbesetzt'
    )
    expect(gapText({ from: '13:30', to: '14:00' }, '15:00')).toBe(
      'unbesetzt 13:30–14:00'
    )
  })

  it('Zeilen der Besetzung mit Kurznamen', () => {
    const besetzung: Besetzung = {
      opens: '05:30',
      closes: '13:30',
      segments: [
        { from: '05:30', to: '06:00', employeeIds: [] },
        { from: '06:00', to: '10:00', employeeIds: [1, 2] },
        { from: '10:00', to: '13:30', employeeIds: [2] },
      ],
      gaps: [{ from: '05:30', to: '06:00' }],
      covered: false,
    }
    const names = shortNames([
      { id: 1, displayName: 'Vera Beispiel' },
      { id: 2, displayName: 'Mia Muster' },
    ])
    expect(besetzungLines(besetzung, names)).toEqual([
      {
        kind: 'gap',
        from: '05:30',
        to: '06:00',
        text: 'unbesetzt 05:30–06:00',
      },
      {
        kind: 'segment',
        from: '06:00',
        to: '10:00',
        text: '06:00–10:00 Vera, Mia',
      },
      { kind: 'segment', from: '10:00', to: '13:30', text: '10:00–13:30 Mia' },
    ])
  })

  it('Kurzname: erstes Wort, bei Gleichheit der volle Name', () => {
    const names = shortNames([
      { id: 1, displayName: 'Anna Alpha' },
      { id: 2, displayName: 'Anna Beta' },
      { id: 3, displayName: 'Bert' },
    ])
    expect([...names.values()]).toEqual(['Anna Alpha', 'Anna Beta', 'Bert'])
  })

  it('Schichten im Verkauf erkennen (Backstube zählt nicht)', () => {
    const employees = [
      { id: 1, area: 'verkauf' },
      { id: 2, area: 'backstube' },
    ] as Employee[]
    const shift = (employeeId: number) => ({ employeeId } as Shift)
    expect(hasVerkaufShifts({ employees, shifts: [shift(2)] })).toBe(false)
    expect(hasVerkaufShifts({ employees, shifts: [shift(1)] })).toBe(true)
  })

  it('Stunden: Plan, Soll, Differenz mit Vorzeichen; ohne Soll „offen“', () => {
    const base: PlannedHours = {
      employeeId: 1,
      from: '2026-11-09',
      to: '2026-11-15',
      weeklyHours: 30,
      plannedMinutes: 1950,
      shiftCount: 5,
      targetMinutes: 1800,
      diffMinutes: 150,
      targetDays: 6,
      creditedDays: 0,
      status: 'ok',
    }
    expect(hoursTexts(base)).toEqual({
      plan: '32:30 h',
      target: '30:00 h',
      diff: '+2:30 h',
      sign: 'plus',
    })
    expect(hoursTexts({ ...base, diffMinutes: -240 })).toMatchObject({
      diff: '−4:00 h',
      sign: 'minus',
    })
    expect(hoursTexts({ ...base, diffMinutes: 0 })).toMatchObject({
      diff: '±0:00 h',
      sign: 'zero',
    })
    expect(
      hoursTexts({
        ...base,
        weeklyHours: null,
        targetMinutes: null,
        diffMinutes: null,
        status: 'no-target',
      })
    ).toEqual({ plan: '32:30 h', target: 'offen', diff: null, sign: null })
  })
})
