import { WEEKDAY_HOURS } from '@bakery/shop/feature-cart/pickup'

// Landing und Shop verwenden dasselbe Wochenraster. Die API hält eine
// CommonJS-Fassung für den Dienstplan. openingHours.spec.ts prüft die Gleichheit.
export interface OpeningHoursDay {
  isOpen: boolean
  opens?: string // 24-hour format HH:MM
  closes?: string // 24-hour format HH:MM
}

export interface OpeningHoursWeek {
  monday: OpeningHoursDay
  tuesday: OpeningHoursDay
  wednesday: OpeningHoursDay
  thursday: OpeningHoursDay
  friday: OpeningHoursDay
  saturday: OpeningHoursDay
  sunday: OpeningHoursDay
}

function hoursFor(weekday: number): OpeningHoursDay {
  const window = WEEKDAY_HOURS[weekday]
  return window ? { isOpen: true, ...window } : { isOpen: false }
}

export const OPENING_HOURS: OpeningHoursWeek = {
  monday: hoursFor(1),
  tuesday: hoursFor(2),
  wednesday: hoursFor(3),
  thursday: hoursFor(4),
  friday: hoursFor(5),
  saturday: hoursFor(6),
  sunday: hoursFor(0),
}

// Day name mappings for different contexts
export const DAY_NAMES = {
  de: {
    monday: 'Montag',
    tuesday: 'Dienstag',
    wednesday: 'Mittwoch',
    thursday: 'Donnerstag',
    friday: 'Freitag',
    saturday: 'Samstag',
    sunday: 'Sonntag',
  },
  deAbbrev: {
    monday: 'Mo',
    tuesday: 'Di',
    wednesday: 'Mi',
    thursday: 'Do',
    friday: 'Fr',
    saturday: 'Sa',
    sunday: 'So',
  },
  en: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
} as const
