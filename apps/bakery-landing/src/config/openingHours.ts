/**
 * Centralized opening hours configuration for Bäckerei Heusser
 * Single source of truth for all opening hours across the application
 *
 * Die Zeiten stehen auch in der API (`apps/bakery-api/src/services/
 * opening-hours.core.js`, Dienstplan-Besetzung) - die Landing-Page kann die
 * CommonJS-Datei als statischer Export nicht importieren.
 * `openingHours.spec.ts` prüft, dass beide übereinstimmen: wer hier eine Zeit
 * ändert, ändert sie dort mit.
 */

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

export const OPENING_HOURS: OpeningHoursWeek = {
  monday: {
    isOpen: false,
  },
  tuesday: {
    isOpen: true,
    opens: '05:30',
    closes: '13:30',
  },
  wednesday: {
    isOpen: true,
    opens: '05:30',
    closes: '13:30',
  },
  thursday: {
    isOpen: true,
    opens: '05:30',
    closes: '13:30',
  },
  friday: {
    isOpen: true,
    opens: '05:30',
    closes: '13:30',
  },
  saturday: {
    isOpen: true,
    opens: '05:30',
    closes: '12:30',
  },
  sunday: {
    isOpen: true,
    opens: '08:00',
    closes: '11:00',
  },
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
