/**
 * Abholtage. Reine Funktionen auf 'YYYY-MM-DD'-Strings: gerechnet wird in
 * UTC-Mitternacht, damit weder die Zeitzone des Rechners noch die
 * Sommerzeit einen Tag verschiebt. "Heute" wird immer hineingereicht
 * (`todayInBerlin(new Date())` nur an der Oberfläche).
 */

export const WEEKDAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

const MONTH_NAMES = [
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

/** ISO-Wochentag des Ruhetags. */
export const RUHETAG = 1

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

function toUtc(iso: string): Date {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`Kein Datum im Format YYYY-MM-DD: ${iso}`)
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  )
  if (date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Kein gültiger Kalendertag: ${iso}`)
  }
  return date
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    toUtc(value)
    return true
  } catch {
    return false
  }
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/** 1 = Montag … 7 = Sonntag. */
export function isoWeekday(iso: string): number {
  const day = toUtc(iso).getUTCDay()
  return day === 0 ? 7 : day
}

/** Kalendertag in Europe/Berlin zu einem Zeitpunkt (z. B. `new Date()`). */
export function todayInBerlin(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** "Di, 10.11." */
export function formatDateShort(iso: string): string {
  const date = toUtc(iso)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${WEEKDAY_SHORT[isoWeekday(iso) - 1]}, ${dd}.${mm}.`
}

/** "Dienstag, 10. November 2026" */
export function formatDateLong(iso: string): string {
  const date = toUtc(iso)
  return `${WEEKDAY_NAMES[isoWeekday(iso) - 1]}, ${date.getUTCDate()}. ${
    MONTH_NAMES[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`
}

export interface PickupDateRules {
  leadTimeDays: number
  availableWeekdays: number[]
  /** Wie viele Tage höchstens geliefert werden. */
  count: number
}

export interface PickupDate {
  date: string
  weekday: number
  shortLabel: string
  longLabel: string
  /**
   * Der Vortag (Teigtag) ist Ruhetag - bei Abholung am Dienstag müsste der
   * Teig am Montag entstehen. Wer dann ansetzt, ist offen (Q-P4/Q-P7, wie
   * `prepDateProvisional` beim Backzettel, Q-B2).
   */
  doughOnRuhetag: boolean
}

export function isPickupWeekday(iso: string, availableWeekdays: number[]) {
  const weekday = isoWeekday(iso)
  return weekday !== RUHETAG && availableWeekdays.includes(weekday)
}

/** Frühester denkbarer Abholtag: heute + Vorlauf (vor dem Wochentagsfilter). */
export function earliestPickupDate(today: string, leadTimeDays: number) {
  return addDays(today, Math.max(0, Math.floor(leadTimeDays)))
}

/**
 * Die nächsten `count` wählbaren Abholtage ab heute + Vorlauf: nur Wochentage
 * aus `availableWeekdays`, nie Montag. Höchstens ein Jahr wird durchsucht -
 * eine Config ohne gültigen Wochentag liefert eine leere Liste statt einer
 * Endlosschleife.
 */
export function pickupDates(
  today: string,
  rules: PickupDateRules
): PickupDate[] {
  const result: PickupDate[] = []
  let day = earliestPickupDate(today, rules.leadTimeDays)
  for (let i = 0; i < 366 && result.length < rules.count; i += 1) {
    if (isPickupWeekday(day, rules.availableWeekdays)) {
      result.push({
        date: day,
        weekday: isoWeekday(day),
        shortLabel: formatDateShort(day),
        longLabel: formatDateLong(day),
        doughOnRuhetag: doughDateIsRuhetag(day),
      })
    }
    day = addDays(day, 1)
  }
  return result
}

/** Der Teig entsteht am Vortag des Backtags (= Abholtag). */
export function doughDate(pickupDate: string): string {
  return addDays(pickupDate, -1)
}

/**
 * `true`, wenn der Teigtag (Vortag) auf den Ruhetag fällt. Dann ist der
 * Teigtag kein Fakt, sondern offen - die Oberfläche nennt dann kein Datum.
 */
export function doughDateIsRuhetag(pickupDate: string): boolean {
  return isoWeekday(doughDate(pickupDate)) === RUHETAG
}
