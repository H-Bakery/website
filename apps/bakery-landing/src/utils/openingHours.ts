/**
 * Utility functions for formatting opening hours from centralized config
 */

import {
  OPENING_HOURS,
  DAY_NAMES,
  OpeningHoursDay,
  OpeningHoursWeek,
} from '../config/openingHours'

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
 * Check if bakery is currently open
 */
export function isCurrentlyOpen(): boolean {
  const now = new Date()
  const days: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const currentDayName = days[now.getDay()]
  const dayHours = OPENING_HOURS[currentDayName]

  if (!dayHours.isOpen || !dayHours.opens || !dayHours.closes) {
    return false
  }

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const [openHour, openMin] = dayHours.opens.split(':').map(Number)
  const [closeHour, closeMin] = dayHours.closes.split(':').map(Number)
  const openTime = openHour * 100 + openMin
  const closeTime = closeHour * 100 + closeMin

  return currentTime >= openTime && currentTime <= closeTime
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

/**
 * Get today's formatted hours string
 */
export function getTodayHours(): string {
  const now = new Date()
  const days: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const currentDayName = days[now.getDay()]
  return formatDayHours(OPENING_HOURS[currentDayName])
}

/**
 * Check if today is an open day but current time is before opening time.
 * Returns true if the bakery will open later today.
 */
export function opensLaterToday(): boolean {
  const now = new Date()
  const days: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const currentDayName = days[now.getDay()]
  const dayHours = OPENING_HOURS[currentDayName]

  if (!dayHours.isOpen || !dayHours.opens) {
    return false
  }

  const currentTime = now.getHours() * 100 + now.getMinutes()
  const [openHour, openMin] = dayHours.opens.split(':').map(Number)
  const openTime = openHour * 100 + openMin

  return currentTime < openTime
}

/**
 * Get today's opening time (formatted for display), or null if today is closed.
 */
export function getTodayOpeningTime(): string | null {
  const now = new Date()
  const days: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]
  const currentDayName = days[now.getDay()]
  const dayHours = OPENING_HOURS[currentDayName]

  if (!dayHours.isOpen || !dayHours.opens) {
    return null
  }

  return formatTime(dayHours.opens)
}

/**
 * Get next opening day and time.
 * Checks if the bakery opens later today before looking at future days.
 */
export function getNextOpening(): { day: string; time: string } | null {
  const now = new Date()
  const days: DayKey[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  // Check if the bakery opens later today
  const currentDayName = days[now.getDay()]
  const todayHours = OPENING_HOURS[currentDayName]

  if (todayHours.isOpen && todayHours.opens) {
    const currentTime = now.getHours() * 100 + now.getMinutes()
    const [openHour, openMin] = todayHours.opens.split(':').map(Number)
    const openTime = openHour * 100 + openMin

    if (currentTime < openTime) {
      return {
        day: 'Heute',
        time: todayHours.opens,
      }
    }
  }

  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    const dayName = days[futureDate.getDay()]
    const dayHours = OPENING_HOURS[dayName]

    if (dayHours.isOpen && dayHours.opens) {
      return {
        day: DAY_NAMES.de[dayName],
        time: dayHours.opens,
      }
    }
  }

  return null
}
