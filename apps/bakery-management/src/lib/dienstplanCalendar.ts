/**
 * Anzeige-Helfer des Dienstplan-Kalenders (TASK-042): Woche, Ansicht und
 * Bereich aus der URL, Kalenderwochen, Zuordnung der Einträge zu Zellen und
 * die Kopfzeile je Tag. Reine Funktionen im Stil von `backzettelFormat.ts`,
 * ohne Datums-Bibliothek.
 *
 * Gerechnet wird hier nichts Fachliches: Feiertage, Ruhetag, Tagesgewicht,
 * Öffnungszeit, Besetzung des Verkaufs und Plan-/Soll-Stunden kommen fertig
 * aus `GET /api/dienstplan` (`vacation.core.js`); hier werden sie nur in
 * Text übersetzt.
 */

import { addDays, isIsoDate, isoWeekday } from './backzettelFormat'
import {
  AREAS,
  formatMinutes,
  formatSignedMinutes,
  formatTargetMinutes,
  type Absence,
  type Area,
  type Besetzung,
  type Calendar,
  type CalendarDay,
  type Employee,
  type PlannedHours,
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

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const

/** Kurzname des Wochentags (1 = Montag … 7 = Sonntag). */
export const WEEKDAY_LETTERS = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Anzahl Tage des Monats, in dem `date` liegt. */
export function daysInMonth(date: string): number {
  const [y, m] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Erster Tag des Zeitraums einer Ansicht, in dem `date` liegt: Montag der
 * Woche, Erster des Monats, 1. Januar.
 */
export function periodStart(view: CalendarView, date: string): string {
  if (view === 'woche') return mondayOf(date)
  if (view === 'monat') return `${date.slice(0, 7)}-01`
  return `${date.slice(0, 4)}-01-01`
}

/** Letzter Tag des Zeitraums ab `start` (dem ersten Tag). */
export function periodEnd(view: CalendarView, start: string): string {
  if (view === 'woche') return addDays(start, 6)
  if (view === 'monat') {
    return `${start.slice(0, 7)}-${pad2(daysInMonth(start))}`
  }
  return `${start.slice(0, 4)}-12-31`
}

/** Voriger/nächster Zeitraum: sieben Tage, ein Monat oder ein Jahr. */
export function stepPeriod(
  view: CalendarView,
  start: string,
  direction: 1 | -1
): string {
  if (view === 'woche') return addDays(mondayOf(start), direction * 7)
  const [y, m] = start.split('-').map(Number)
  if (view === 'jahr') return `${y + direction}-01-01`
  const index = y * 12 + (m - 1) + direction
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}-01`
}

/**
 * Zeitraum nach einem Ansichtswechsel. Liegt heute im bisherigen Zeitraum,
 * zeigt die neue Ansicht den Zeitraum mit heute; sonst den mit dem vierten
 * Tag des bisherigen (der Donnerstag einer Woche - wie bei der
 * Kalenderwoche entscheidet er, zu welchem Monat und Jahr sie gehört; aus
 * einem Monat wird so die erste Woche mit Donnerstag in diesem Monat).
 */
export function switchPeriod(
  from: CalendarView,
  start: string,
  to: CalendarView,
  today: string
): string {
  const inside = today >= start && today <= periodEnd(from, start)
  return periodStart(to, inside ? today : addDays(start, 3))
}

/** `?monat=JJJJ-MM` lesen → Erster des Monats; sonst `null`. */
export function parseMonth(raw: string | undefined): string | null {
  const first = `${raw ?? ''}-01`
  return /^\d{4}-\d{2}$/.test(raw ?? '') && isIsoDate(first) ? first : null
}

/**
 * Jahre, die die Jahresansicht zeigt - so weit, wie die API das
 * Urlaubskonto rechnet (`GET /api/dienstplan/balance`, sonst `invalid_year`).
 */
export const YEAR_MIN = 2000
export const YEAR_MAX = 2100

/** `?jahr=JJJJ` (2000-2100) lesen → 1. Januar; sonst `null`. */
export function parseYear(raw: string | undefined): string | null {
  if (!/^\d{4}$/.test(raw ?? '')) return null
  const year = Number(raw)
  return year >= YEAR_MIN && year <= YEAR_MAX ? `${raw}-01-01` : null
}

/**
 * Zeitraum aus der URL: `woche` (ein Tag der Woche), `monat` (JJJJ-MM) oder
 * `jahr` (JJJJ), je nach Ansicht. Fehlt der passende Parameter, wird aus
 * dem eines anderen abgeleitet (z. B. ein alter Link mit `woche` und
 * `ansicht=monat`), sonst gilt heute.
 */
export function parsePeriod(
  view: CalendarView,
  params: { week?: string; month?: string; year?: string },
  today: string
): string {
  const week = parseWeek(params.week)
  const month = parseMonth(params.month)
  const year = parseYear(params.year)
  const own = view === 'woche' ? week : view === 'monat' ? month : year
  if (own) return own
  if (week) return switchPeriod('woche', week, view, today)
  if (month) return switchPeriod('monat', month, view, today)
  if (year) return switchPeriod('jahr', year, view, today)
  return periodStart(view, today)
}

/** Alle Tage des Monats ab dem Ersten. */
export function monthDates(monthStart: string): string[] {
  return Array.from({ length: daysInMonth(monthStart) }, (_, i) =>
    addDays(monthStart, i)
  )
}

/** „November 2026“ */
export function formatMonthTitle(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Titel des Zeitraums je Ansicht. */
export function formatPeriodTitle(view: CalendarView, start: string): string {
  if (view === 'woche') return formatWeekTitle(start)
  if (view === 'monat') return formatMonthTitle(start)
  return `Jahr ${start.slice(0, 4)}`
}

/**
 * URL des Kalenders. Die Woche steht als `woche=`, Monat und Jahr mit
 * `ansicht=` und `monat=`/`jahr=`; Standardwerte (Woche, alle Bereiche)
 * bleiben weg.
 */
export function dienstplanHref(state: {
  view: CalendarView
  start: string
  area: AreaFilter
}): string {
  const params = new URLSearchParams()
  if (state.view === 'woche') {
    params.set('woche', mondayOf(state.start))
  } else {
    params.set('ansicht', state.view)
    if (state.view === 'monat') params.set('monat', state.start.slice(0, 7))
    else params.set('jahr', state.start.slice(0, 4))
  }
  if (state.area !== 'alle') params.set('bereich', state.area)
  return `/admin/dienstplan?${params.toString()}`
}

/**
 * Teil einer Abwesenheit in einem Monat, als Anteil der Monatsbreite
 * (Jahresansicht): `left` und `width` zwischen 0 und 1. Berührt die
 * Abwesenheit den Monat nicht → `null`.
 */
export function monthSegment(
  absence: Pick<Absence, 'startDate' | 'endDate'>,
  monthStart: string
): { left: number; width: number } | null {
  const monthEnd = periodEnd('monat', monthStart)
  if (absence.endDate < monthStart || absence.startDate > monthEnd) return null
  const from = absence.startDate > monthStart ? absence.startDate : monthStart
  const to = absence.endDate < monthEnd ? absence.endDate : monthEnd
  const total = daysInMonth(monthStart)
  const first = Number(from.slice(8, 10))
  const last = Number(to.slice(8, 10))
  return { left: (first - 1) / total, width: (last - first + 1) / total }
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

/** Öffnungszeit eines Tags als „05:30–13:30“; ohne Öffnungszeit `null`. */
export function openingHoursText(day: CalendarDay): string | null {
  return day.openingHours
    ? `${day.openingHours.opens}–${day.openingHours.closes}`
    : null
}

/**
 * Gibt es im Zeitraum überhaupt Schichten im Verkauf? Ohne sie zeigt die
 * Besetzung „nichts geplant“ statt an jedem Tag „unbesetzt“.
 */
export function hasVerkaufShifts(
  calendar: Pick<Calendar, 'employees' | 'shifts'>
): boolean {
  const verkauf = new Set(
    calendar.employees.filter((e) => e.area === 'verkauf').map((e) => e.id)
  )
  return calendar.shifts.some((s) => verkauf.has(s.employeeId))
}

/**
 * Kurzname je Person für die enge Besetzungszeile: das erste Wort des
 * Anzeigenamens („Vera“), bei zwei gleichen ersten Wörtern der volle Name.
 */
export function shortNames(
  employees: readonly Pick<Employee, 'id' | 'displayName'>[]
): Map<number, string> {
  const first = (name: string) => name.trim().split(/\s+/)[0] || name
  const counts = new Map<string, number>()
  for (const e of employees) {
    const f = first(e.displayName)
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return new Map(
    employees.map((e) => {
      const f = first(e.displayName)
      return [e.id, (counts.get(f) ?? 0) > 1 ? e.displayName : f]
    })
  )
}

/**
 * Eine Lücke als Text: reicht sie bis Ladenschluss „ab 13:00 unbesetzt“,
 * sonst „unbesetzt 05:30–06:00“.
 */
export function gapText(
  gap: { from: string; to: string },
  closes: string
): string {
  return gap.to === closes
    ? `ab ${gap.from} unbesetzt`
    : `unbesetzt ${gap.from}–${gap.to}`
}

export interface BesetzungLine {
  kind: 'segment' | 'gap'
  from: string
  to: string
  text: string
}

/**
 * Zeilen der Besetzung in der Reihenfolge des Tages: Abschnitte mit
 * Uhrzeit und Namen („05:30–10:00 Vera, Mia“), Lücken als „unbesetzt …“.
 */
export function besetzungLines(
  besetzung: Besetzung,
  names: ReadonlyMap<number, string>
): BesetzungLine[] {
  return besetzung.segments.map((seg) =>
    seg.employeeIds.length === 0
      ? {
          kind: 'gap',
          from: seg.from,
          to: seg.to,
          text: gapText(seg, besetzung.closes),
        }
      : {
          kind: 'segment',
          from: seg.from,
          to: seg.to,
          text: `${seg.from}–${seg.to} ${seg.employeeIds
            .map((id) => names.get(id) ?? `#${id}`)
            .join(', ')}`,
        }
  )
}

/**
 * Überschrift der Besetzung eines Tags (Zeile „Besetzung Verkauf“ der
 * Woche): geschlossen → `null` (der Kopf nennt Ruhetag oder Feiertag); eine
 * Woche ganz ohne Schichten im Verkauf → „nichts geplant“ (keine Lücke an
 * jedem Tag, die nach Alarm aussieht); ohne hinterlegte Öffnungszeit die
 * alte Zählung; durchgehend besetzt → „durchgehend besetzt“; mit Lücken
 * `null` - die Zeilen sagen „unbesetzt …“.
 */
export function staffingText(
  day: CalendarDay,
  anyVerkaufShifts: boolean
): string | null {
  if (day.closed) return null
  if (!anyVerkaufShifts) return 'nichts geplant'
  if (!day.besetzung) {
    return `Öffnungszeit nicht hinterlegt · Verkauf besetzt: ${day.verkaufBesetzt}`
  }
  return day.besetzung.covered ? 'durchgehend besetzt' : null
}

/**
 * Stunden einer Person als Text: Plan, Soll („offen“ ohne Wochenstunden)
 * und die Differenz Plan − Soll mit Vorzeichen (`null` ohne Soll).
 */
export function hoursTexts(hours: PlannedHours): {
  plan: string
  target: string
  diff: string | null
  sign: 'plus' | 'minus' | 'zero' | null
} {
  const d = hours.diffMinutes
  return {
    plan: formatMinutes(hours.plannedMinutes),
    target: formatTargetMinutes(hours.targetMinutes),
    diff: d === null ? null : formatSignedMinutes(d),
    sign: d === null ? null : d > 0 ? 'plus' : d < 0 ? 'minus' : 'zero',
  }
}
