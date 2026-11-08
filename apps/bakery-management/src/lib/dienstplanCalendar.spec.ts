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
} from './dienstplanCalendar'
import type { Absence, CalendarDay, Shift } from './dienstplanApi'

function day(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-11-10',
    weekday: 2,
    holidayName: null,
    restDay: false,
    closed: false,
    weight: 1,
    halfDayName: null,
    verkaufBesetzt: 2,
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

  it('Kopfzeile: geschlossen, „nichts geplant“ statt 0, sonst Besetzung', () => {
    expect(staffingText(day(), true)).toBe('Verkauf besetzt: 2')
    expect(staffingText(day({ verkaufBesetzt: 0 }), true)).toBe(
      'Verkauf besetzt: 0'
    )
    expect(staffingText(day({ verkaufBesetzt: 0 }), false)).toBe(
      'nichts geplant'
    )
    // Geschlossen: keine Zeile - der Name des Tags steht schon darüber.
    expect(staffingText(day({ closed: true, restDay: true }), true)).toBeNull()

    expect(closedDayLabel(day())).toBeNull()
    expect(closedDayLabel(day({ closed: true, restDay: true }))).toBe('Ruhetag')
    expect(
      closedDayLabel(day({ closed: true, holidayName: 'Allerheiligen' }))
    ).toBe('Allerheiligen')
  })
})
