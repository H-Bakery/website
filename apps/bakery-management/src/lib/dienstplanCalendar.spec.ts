import {
  closedDayLabel,
  dienstplanHref,
  entriesByCell,
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
      dienstplanHref({ week: '2026-11-09', view: 'woche', area: 'alle' })
    ).toBe('/admin/dienstplan?woche=2026-11-09')
    expect(
      dienstplanHref({ week: '2026-11-09', view: 'monat', area: 'verkauf' })
    ).toBe('/admin/dienstplan?woche=2026-11-09&ansicht=monat&bereich=verkauf')
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

  it('Kopfzeile: geschlossen, „nichts geplant“ statt 0, sonst Besetzung', () => {
    expect(staffingText(day(), true)).toBe('Verkauf besetzt: 2')
    expect(staffingText(day({ verkaufBesetzt: 0 }), true)).toBe(
      'Verkauf besetzt: 0'
    )
    expect(staffingText(day({ verkaufBesetzt: 0 }), false)).toBe(
      'nichts geplant'
    )
    expect(staffingText(day({ closed: true, restDay: true }), true)).toBe(
      'geschlossen'
    )

    expect(closedDayLabel(day())).toBeNull()
    expect(closedDayLabel(day({ closed: true, restDay: true }))).toBe('Ruhetag')
    expect(
      closedDayLabel(day({ closed: true, holidayName: 'Allerheiligen' }))
    ).toBe('Allerheiligen')
  })
})
