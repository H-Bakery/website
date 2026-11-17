/**
 * Utility functions for formatting opening hours from centralized config
 */

import {
  OPENING_HOURS,
  DAY_NAMES,
  OpeningHoursDay,
  OpeningHoursWeek,
} from '../config/openingHours'
import { addDays, holidayName } from '../config/holidays'

type DayKey = keyof OpeningHoursWeek

const DAY_ORDER: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * Strip leading zero from time string for display: '05:30' → '5:30'
 */
function formatTime(time: string): string {
  return time.replace(/^0/, '')
}

interface DayGroup {
  days: DayKey[]
  isOpen: boolean
  opens?: string
  closes?: string
}

/**
 * Group consecutive days with identical schedules
 */
function groupDaysBySchedule(): DayGroup[] {
  const groups: DayGroup[] = []

  for (const day of DAY_ORDER) {
    const hours = OPENING_HOURS[day]
    const last = groups[groups.length - 1]

    const sameSchedule =
      last &&
      last.isOpen === hours.isOpen &&
      last.opens === hours.opens &&
      last.closes === hours.closes

    if (sameSchedule) {
      last.days.push(day)
    } else {
      groups.push({
        days: [day],
        isOpen: hours.isOpen,
        opens: hours.opens,
        closes: hours.closes,
      })
    }
  }

  return groups
}

/**
 * Format a group's hours for display: '5:30 - 13:30 Uhr'
 */
function formatGroupHours(group: DayGroup): string {
  if (!group.isOpen || !group.opens || !group.closes) {
    return 'Geschlossen'
  }
  return `${formatTime(group.opens)} - ${formatTime(group.closes)} Uhr`
}

/**
 * Format hours for the map component (zeiten.ts format)
 * Uses abbreviated day names and lists each day in a group: 'Di, Mi, Do, Fr'
 *
 * Deliberately no holiday claim here: the config has no holiday entry and
 * holidays are not simply "like Sunday" (e.g. Mariä Himmelfahrt 2025 was
 * closed). The contact page carries the "an Feiertagen abweichend" note.
 */
export function getMapDisplayHours() {
  return groupDaysBySchedule().map((group) => {
    const labels = group.days.map((d) => DAY_NAMES.deAbbrev[d])

    return {
      label: labels.join(', '),
      value: formatGroupHours(group),
    }
  })
}

/**
 * Format hours for footer display
 * Uses range format for >2 consecutive days: 'Di-Fr'
 */
export function getFooterHours() {
  return groupDaysBySchedule().map((group) => {
    const abbrevs = group.days.map((d) => DAY_NAMES.deAbbrev[d])
    const label =
      abbrevs.length > 2
        ? `${abbrevs[0]}-${abbrevs[abbrevs.length - 1]}`
        : abbrevs.join(', ')

    return {
      label,
      value: formatGroupHours(group),
    }
  })
}

/**
 * Format hours for contact page
 * Uses full German day names with range format: 'Dienstag - Freitag'
 */
export function getContactPageHours() {
  return groupDaysBySchedule().map((group) => {
    const names = group.days.map((d) => DAY_NAMES.de[d])
    const day =
      names.length > 2
        ? `${names[0]} - ${names[names.length - 1]}`
        : names.join(', ')

    return {
      day,
      hours: formatGroupHours(group),
    }
  })
}

/**
 * Format hours for SEO structured data (schema.org OpeningHoursSpecification)
 * Only includes open days
 */
export function getSeoOpeningHours() {
  return groupDaysBySchedule()
    .filter((group) => group.isOpen)
    .map((group) => {
      const dayNames = group.days.map((d) => DAY_NAMES.en[d])
      return {
        '@type': 'OpeningHoursSpecification' as const,
        dayOfWeek: dayNames.length === 1 ? dayNames[0] : dayNames,
        opens: group.opens!,
        closes: group.closes!,
      }
    })
}

/**
 * Get opening time for hero badge — returns display-formatted earliest time, e.g. '5:30'
 */
export function getEarliestOpeningTime(): string {
  const openDays = Object.values(OPENING_HOURS).filter(
    (day) => day.isOpen && day.opens
  )
  const earliest = openDays.reduce((min, day) => {
    return day.opens! < min ? day.opens! : min
  }, openDays[0]?.opens ?? '05:30')

  return formatTime(earliest)
}

/**
 * Get a label like 'Ab 5:30 Uhr' for trust badges / marketing text
 */
export function getEarliestOpeningLabel(): string {
  return `Ab ${getEarliestOpeningTime()} Uhr`
}

/**
 * Get a compact one-line summary of hours
 * e.g. 'Di-Fr 5:30-13:30, Sa 5:30-12:30, So 8:00-11:00 Uhr'
 */
export function getCompactHoursSummary(): string {
  const groups = groupDaysBySchedule().filter((g) => g.isOpen)
  return groups
    .map((group, i) => {
      const abbrevs = group.days.map((d) => DAY_NAMES.deAbbrev[d])
      const dayLabel =
        abbrevs.length > 2
          ? `${abbrevs[0]}-${abbrevs[abbrevs.length - 1]}`
          : abbrevs.join(', ')
      const times = `${formatTime(group.opens!)}-${formatTime(group.closes!)}`
      const suffix = i === groups.length - 1 ? ' Uhr' : ''
      return `${dayLabel} ${times}${suffix}`
    })
    .join(', ')
}

/**
 * Format a single day's hours for display
 */
export function formatDayHours(day: OpeningHoursDay): string {
  if (!day.isOpen || !day.opens || !day.closes) {
    return 'Geschlossen'
  }
  return `${formatTime(day.opens)} - ${formatTime(day.closes)} Uhr`
}

// ---------------------------------------------------------------------------
// Öffnungsstatus „jetzt“
// ---------------------------------------------------------------------------

/** Der Laden steht in Homburg: der Status gilt in deutscher Zeit, nie in der des Geräts. */
export const SHOP_TIME_ZONE = 'Europe/Berlin'

/**
 * So weit sucht `getOpenStatus` die nächste Öffnung. Feiertage und Ruhetag
 * hintereinander sind höchstens ein paar Tage; die Grenze verhindert nur eine
 * Endlosschleife bei einer Konfiguration ohne offenen Tag.
 */
const NEXT_OPENING_LOOKAHEAD_DAYS = 21

/** `Date#getUTCDay()` → Schlüssel der Wochentabelle */
const DAY_BY_INDEX: DayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export interface NextOpening {
  /** 'Heute', ein Wochentag ('Dienstag') oder - ab einer Woche - mit Datum ('Dienstag, 5.1.') */
  day: string
  /** Anzeigeformat, z. B. '5:30' */
  time: string
}

interface OpenDayStatus {
  /** z. B. '5:30 - 13:30 Uhr' */
  todayHours: string
  /** Öffnungszeit heute, Anzeigeformat */
  opens: string
  next: NextOpening | null
}

/**
 * Was der Laden gerade ist. `next` ist die nächste Öffnung nach heute (bei
 * 'opens-later' heute selbst), Ruhetag und Feiertage übersprungen. Für
 * Feiertage kennt die Konfiguration keine Zeiten: 'feiertag' ist nie
 * „geöffnet“ und nennt keine Zeit für heute.
 */
export type OpenStatus =
  | ({ kind: 'open' } & OpenDayStatus)
  | ({ kind: 'opens-later' } & OpenDayStatus)
  | ({ kind: 'closed-for-today' } & OpenDayStatus)
  | { kind: 'ruhetag'; next: NextOpening | null }
  | { kind: 'feiertag'; name: string; next: NextOpening | null }

let shopClockFormat: Intl.DateTimeFormat | null = null

/** Datum (`YYYY-MM-DD`) und Minuten seit Mitternacht in deutscher Zeit. */
function shopClock(now: Date): { date: string; minutes: number } {
  if (!shopClockFormat) {
    shopClockFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: SHOP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of shopClockFormat.formatToParts(now)) {
    parts[part.type] = part.value
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    // `% 24`: ältere Engines schreiben Mitternacht trotz h23 als '24'.
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  }
}

function dayKeyOf(date: string): DayKey {
  const [y, m, d] = date.split('-').map(Number)
  return DAY_BY_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/** Erste Öffnung nach `date`; Feiertage und geschlossene Wochentage übersprungen. */
function nextOpeningAfter(date: string): NextOpening | null {
  for (let i = 1; i <= NEXT_OPENING_LOOKAHEAD_DAYS; i++) {
    const day = addDays(date, i)
    if (holidayName(day)) continue
    const key = dayKeyOf(day)
    const hours = OPENING_HOURS[key]
    if (!hours.isOpen || !hours.opens) continue
    const [, month, dayOfMonth] = day.split('-').map(Number)
    return {
      // Ab einer Woche wäre der Wochentag allein mehrdeutig.
      day:
        i < 7
          ? DAY_NAMES.de[key]
          : `${DAY_NAMES.de[key]}, ${dayOfMonth}.${month}.`,
      time: formatTime(hours.opens),
    }
  }
  return null
}

/**
 * Öffnungsstatus zum Zeitpunkt `now`, gerechnet in deutscher Zeit
 * (Europe/Berlin): ein Gerät in einer anderen Zeitzone sieht denselben
 * Status. Ein gesetzlicher Feiertag im Saarland (`config/holidays.ts`) geht
 * dem Wochenplan und dem Ruhetag vor.
 */
export function getOpenStatus(now: Date = new Date()): OpenStatus {
  const { date, minutes } = shopClock(now)
  const holiday = holidayName(date)
  if (holiday) {
    return { kind: 'feiertag', name: holiday, next: nextOpeningAfter(date) }
  }

  const hours = OPENING_HOURS[dayKeyOf(date)]
  if (!hours.isOpen || !hours.opens || !hours.closes) {
    return { kind: 'ruhetag', next: nextOpeningAfter(date) }
  }

  const today = {
    todayHours: formatDayHours(hours),
    opens: formatTime(hours.opens),
  }
  if (minutes < toMinutes(hours.opens)) {
    return {
      kind: 'opens-later',
      ...today,
      next: { day: 'Heute', time: today.opens },
    }
  }
  if (minutes <= toMinutes(hours.closes)) {
    return { kind: 'open', ...today, next: nextOpeningAfter(date) }
  }
  return { kind: 'closed-for-today', ...today, next: nextOpeningAfter(date) }
}

/** Is the bakery open right now (German time)? Never on a holiday. */
export function isCurrentlyOpen(now: Date = new Date()): boolean {
  return getOpenStatus(now).kind === 'open'
}

/**
 * Today's formatted hours: '5:30 - 13:30 Uhr', 'Geschlossen' on the Ruhetag,
 * 'Feiertag (Name)' on a holiday (no hours are configured for holidays).
 */
export function getTodayHours(now: Date = new Date()): string {
  const status = getOpenStatus(now)
  if (status.kind === 'feiertag') return `Feiertag (${status.name})`
  if (status.kind === 'ruhetag') return 'Geschlossen'
  return status.todayHours
}

/** True if today is an open day (not a holiday) and opening time is still ahead. */
export function opensLaterToday(now: Date = new Date()): boolean {
  return getOpenStatus(now).kind === 'opens-later'
}

/** Today's opening time (formatted for display), or null on the Ruhetag or a holiday. */
export function getTodayOpeningTime(now: Date = new Date()): string | null {
  const status = getOpenStatus(now)
  return status.kind === 'ruhetag' || status.kind === 'feiertag'
    ? null
    : status.opens
}

/**
 * Next opening day and time (time formatted for display, e.g. '5:30'):
 * 'Heute' before opening time, otherwise the next open day, skipping the
 * Ruhetag and holidays.
 */
export function getNextOpening(now: Date = new Date()): NextOpening | null {
  return getOpenStatus(now).next
}
