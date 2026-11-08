/**
 * Anzeige-Helfer des Dienstplan-Kalenders (TASK-042): Woche, Ansicht und
 * Bereich aus der URL, Kalenderwochen, Zuordnung der Einträge zu Zellen und
 * die Kopfzeile je Tag. Reine Funktionen im Stil von `backzettelFormat.ts`,
 * ohne Datums-Bibliothek.
 *
 * Gerechnet wird hier nichts Fachliches: Feiertage, Ruhetag, Tagesgewicht
 * und „Verkauf besetzt“ kommen fertig aus `GET /api/dienstplan`
 * (`vacation.core.js`).
 */

import { addDays, isIsoDate, isoWeekday } from './backzettelFormat'
import {
  AREAS,
  type Absence,
  type Area,
  type Calendar,
  type CalendarDay,
  type Shift,
} from './dienstplanApi'

export const CALENDAR_VIEWS = ['woche', 'monat', 'jahr'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  woche: 'Woche',
  monat: 'Monat',
  jahr: 'Jahr',
}

export type AreaFilter = Area | 'alle'

/** `?ansicht=` lesen; alles Unbekannte ist die Woche (Standard). */
export function parseView(raw: string | undefined): CalendarView {
  return (CALENDAR_VIEWS as readonly string[]).includes(raw ?? '')
    ? (raw as CalendarView)
    : 'woche'
}

/** `?bereich=` lesen; alles Unbekannte zeigt alle Bereiche. */
export function parseAreaFilter(raw: string | undefined): AreaFilter {
  return (AREAS as readonly string[]).includes(raw ?? '')
    ? (raw as Area)
    : 'alle'
}

/** Montag der Woche, in der `date` liegt. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

/** `?woche=` lesen: irgendein Tag der Woche → ihr Montag; sonst `null`. */
export function parseWeek(raw: string | undefined): string | null {
  return isIsoDate(raw) ? mondayOf(raw) : null
}

/** Die sieben Tage Mo-So ab `monday`. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Kalenderwoche nach ISO 8601 (die Woche mit dem Donnerstag zählt). */
export function isoWeekNumber(date: string): number {
  const thursday = addDays(date, 4 - isoWeekday(date))
  const year = Number(thursday.slice(0, 4))
  const firstOfYear = Date.UTC(year, 0, 1)
  const [y, m, d] = thursday.split('-').map(Number)
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - firstOfYear) / 864e5)
  return Math.floor(dayOfYear / 7) + 1
}

function dayMonth(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}.${m}.`
}

/** „KW 46 · 09.11. – 15.11.2026“ */
export function formatWeekTitle(monday: string): string {
  const sunday = addDays(monday, 6)
  return `KW ${isoWeekNumber(monday)} · ${dayMonth(monday)} – ${dayMonth(
    sunday
  )}${sunday.slice(0, 4)}`
}

/** URL des Kalenders; Standardwerte (Woche, alle Bereiche) bleiben weg. */
export function dienstplanHref(state: {
  week: string
  view: CalendarView
  area: AreaFilter
}): string {
  const params = new URLSearchParams()
  params.set('woche', state.week)
  if (state.view !== 'woche') params.set('ansicht', state.view)
  if (state.area !== 'alle') params.set('bereich', state.area)
  return `/admin/dienstplan?${params.toString()}`
}

export interface CellEntries {
  shifts: Shift[]
  absences: Absence[]
}

export function cellKey(employeeId: number, date: string): string {
  return `${employeeId}:${date}`
}

/**
 * Schichten und Abwesenheiten je Zelle (Mitarbeiter × Tag) für die
 * gezeigten Tage. Eine Abwesenheit über mehrere Tage steht in jeder ihrer
 * Zellen; Schichten in der Reihenfolge der API (nach Beginn).
 */
export function entriesByCell(
  calendar: Pick<Calendar, 'shifts' | 'absences'>,
  dates: readonly string[]
): Map<string, CellEntries> {
  const map = new Map<string, CellEntries>()
  const cell = (employeeId: number, date: string): CellEntries => {
    const key = cellKey(employeeId, date)
    let entry = map.get(key)
    if (!entry) {
      entry = { shifts: [], absences: [] }
      map.set(key, entry)
    }
    return entry
  }
  const shown = new Set(dates)
  for (const shift of calendar.shifts) {
    if (shown.has(shift.date))
      cell(shift.employeeId, shift.date).shifts.push(shift)
  }
  for (const absence of calendar.absences) {
    for (const date of dates) {
      if (date >= absence.startDate && date <= absence.endDate) {
        cell(absence.employeeId, date).absences.push(absence)
      }
    }
  }
  return map
}

/** Name des geschlossenen Tags: Feiertag oder „Ruhetag“; offen → `null`. */
export function closedDayLabel(day: CalendarDay): string | null {
  if (day.holidayName) return day.holidayName
  if (day.restDay) return 'Ruhetag'
  return day.closed ? 'geschlossen' : null
}

/**
 * Kopfzeile eines Tags: „Verkauf besetzt: n“ als Lückencheck. Ein
 * geschlossener Tag ist „geschlossen“; eine Woche ganz ohne Schichten ist
 * „nichts geplant“ - keine 0, die nach Lücke aussieht.
 */
export function staffingText(
  day: CalendarDay,
  anyShiftsInRange: boolean
): string {
  if (day.closed) return 'geschlossen'
  if (!anyShiftsInRange) return 'nichts geplant'
  return `Verkauf besetzt: ${day.verkaufBesetzt}`
}
