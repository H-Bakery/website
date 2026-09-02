/**
 * @fileoverview Abholtermine (pickup dates and time slots) for the shop checkout.
 * @module @bakery/shop/feature-cart/pickup
 *
 * The opening hours below mirror `apps/bakery-landing/src/config/openingHours.ts`.
 * That file stays the single source of truth — a `libs/bakery-shop/*` lib may not
 * import from an app (Nx module boundaries), so the values are duplicated here.
 * If the bakery's hours change, change them there and mirror the change here.
 *
 * Bäckerei Heusser: **Montag ist Ruhetag.**
 *
 * Everything in this module is pure and timezone-local — no `Intl`, no UTC
 * parsing — so a rendered date never shifts by a day for customers east or west
 * of Greenwich, and nothing here can differ between server and client render.
 */

/** An opening window in local time, `HH:mm`. */
export interface OpeningWindow {
  opens: string
  closes: string
}

/** Indexed by `Date#getDay()`: 0 = Sonntag … 6 = Samstag. `null` = geschlossen. */
const WEEKDAY_HOURS: ReadonlyArray<OpeningWindow | null> = [
  { opens: '08:00', closes: '11:00' }, // 0 Sonntag
  null, //                                1 Montag — Ruhetag
  { opens: '05:30', closes: '13:30' }, // 2 Dienstag
  { opens: '05:30', closes: '13:30' }, // 3 Mittwoch
  { opens: '05:30', closes: '13:30' }, // 4 Donnerstag
  { opens: '05:30', closes: '13:30' }, // 5 Freitag
  { opens: '05:30', closes: '12:30' }, // 6 Samstag
]

/** German weekday names, indexed like {@link WEEKDAY_HOURS}. */
export const WEEKDAY_NAMES_DE: ReadonlyArray<string> = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]

/** Abholzeiten are offered on a half-hour raster. */
const SLOT_STEP_MINUTES = 30

/**
 * Vorlaufzeit for a same-day pickup: the bakery needs an hour's notice, so
 * today's already-passed (and imminent) slots are not offered.
 */
export const PICKUP_LEAD_MINUTES = 60

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** `330` -> `'05:30'`. */
export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes))
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`
}

/** `'05:30'` -> `330`; `null` for anything that is not a valid `HH:mm`. */
export function timeToMinutes(time: string): number | null {
  if (typeof time !== 'string' || !TIME_PATTERN.test(time)) return null
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/** Local `YYYY-MM-DD` for a `Date` (never UTC — that would shift the day). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`
}

/**
 * Today's local date as `YYYY-MM-DD`.
 *
 * Call this from an effect, never during render: the server's "today" and the
 * browser's "today" can differ around midnight, which would break hydration.
 */
export function isoToday(): string {
  return toIsoDate(new Date())
}

/** Local midnight for a `YYYY-MM-DD` string; `null` if the date is malformed or does not exist. */
export function parseIsoDate(value: string): Date | null {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  // Rejects overflow dates such as 2026-02-31, which JS would roll into March.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/** The opening window of a given date, or `null` when the bakery is closed (or the date is invalid). */
export function openingWindowFor(isoDate: string): OpeningWindow | null {
  const date = parseIsoDate(isoDate)
  if (!date) return null
  return WEEKDAY_HOURS[date.getDay()] ?? null
}

/** German weekday name of a date, or `''` for an invalid date. */
export function weekdayNameFor(isoDate: string): string {
  const date = parseIsoDate(isoDate)
  return date ? WEEKDAY_NAMES_DE[date.getDay()] : ''
}

/** `'2026-09-01'` -> `'Dienstag, 01.09.2026'`; `''` for an invalid date. */
export function formatGermanDate(isoDate: string): string {
  const date = parseIsoDate(isoDate)
  if (!date) return ''
  return `${WEEKDAY_NAMES_DE[date.getDay()]}, ${pad2(date.getDate())}.${pad2(
    date.getMonth() + 1
  )}.${date.getFullYear()}`
}

/**
 * Builds the half-hour slots inside one opening window. The last slot sits a
 * full step before closing time, so nobody is asked to collect their order at
 * the very moment the shop locks up.
 */
function slotsForWindow(window: OpeningWindow, minMinutes: number): string[] {
  const opens = timeToMinutes(window.opens)
  const closes = timeToMinutes(window.closes)
  if (opens === null || closes === null) return []

  const slots: string[] = []
  const last = closes - SLOT_STEP_MINUTES
  // Snap the lower bound up onto the raster so we never offer 06:07.
  const start = Math.max(
    opens,
    Math.ceil(minMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES
  )

  for (let minutes = start; minutes <= last; minutes += SLOT_STEP_MINUTES) {
    slots.push(minutesToTime(minutes))
  }
  return slots
}

/**
 * The pickup slots available on `isoDate`.
 *
 * @param isoDate `YYYY-MM-DD`.
 * @param minMinutes minutes-since-midnight the slot must not fall before —
 * pass `now + PICKUP_LEAD_MINUTES` when the date is today, omit otherwise.
 * @returns an empty array on a Ruhetag, an invalid date, or when every slot of
 * the day has already passed.
 */
export function pickupTimeSlots(isoDate: string, minMinutes = 0): string[] {
  const window = openingWindowFor(isoDate)
  if (!window) return []
  return slotsForWindow(window, minMinutes)
}

/**
 * Every slot the bakery ever offers, across all open days (05:30 – 13:00).
 *
 * Used as the fallback option list so the Abholzeit field is never an empty,
 * unusable select before a date has been chosen. The chosen time is always
 * validated against the *actual* day on submit.
 */
export const ALL_PICKUP_SLOTS: ReadonlyArray<string> = (() => {
  const seen = new Set<number>()
  for (const window of WEEKDAY_HOURS) {
    if (!window) continue
    for (const slot of slotsForWindow(window, 0)) {
      const minutes = timeToMinutes(slot)
      if (minutes !== null) seen.add(minutes)
    }
  }
  return Array.from(seen)
    .sort((a, b) => a - b)
    .map(minutesToTime)
})()

/** Short German summary of a day's hours, e.g. `'05:30 – 13:30 Uhr'`. */
export function formatOpeningWindow(window: OpeningWindow): string {
  return `${window.opens} – ${window.closes} Uhr`
}

/* -------------------------------------------------------------------------- */
/* Öffnungszeiten für die Anzeige                                              */
/* -------------------------------------------------------------------------- */

/** Eine Zeile der Öffnungszeiten-Tabelle. */
export interface OpeningHoursRow {
  /** `'Di – Fr'` bei einer Spanne, `'Samstag'` bei einem einzelnen Tag. */
  days: string
  /** `'05:30 – 13:30 Uhr'` oder `'Ruhetag'`. */
  time: string
}

/** Kurzformen der Wochentage, gleich indiziert wie {@link WEEKDAY_HOURS}. */
const WEEKDAY_SHORT_DE: ReadonlyArray<string> = [
  'So',
  'Mo',
  'Di',
  'Mi',
  'Do',
  'Fr',
  'Sa',
]

/** Anzeigereihenfolge: der erste Öffnungstag zuerst, der Ruhetag zuletzt. */
const DISPLAY_ORDER: ReadonlyArray<number> = [2, 3, 4, 5, 6, 0, 1]

function hoursLabel(day: number): string {
  const window = WEEKDAY_HOURS[day]
  return window ? formatOpeningWindow(window) : 'Ruhetag'
}

/**
 * Die Öffnungszeiten als Tabelle — **abgeleitet** aus {@link WEEKDAY_HOURS},
 * nicht danebengeschrieben. Aufeinanderfolgende Tage mit gleichen Zeiten werden
 * zu einer Zeile zusammengefasst (`Di – Fr`).
 *
 * Dadurch kann die angezeigte Öffnungszeit nie von den Abholzeiten abweichen,
 * die die Kasse tatsächlich anbietet.
 */
export const OPENING_HOURS_ROWS: ReadonlyArray<OpeningHoursRow> = (() => {
  const rows: OpeningHoursRow[] = []
  let group: number[] = []

  const flush = () => {
    if (group.length === 0) return
    const first = group[0]
    const last = group[group.length - 1]
    rows.push({
      days:
        group.length === 1
          ? WEEKDAY_NAMES_DE[first]
          : `${WEEKDAY_SHORT_DE[first]} – ${WEEKDAY_SHORT_DE[last]}`,
      time: hoursLabel(first),
    })
    group = []
  }

  for (const day of DISPLAY_ORDER) {
    const previous = group[group.length - 1]
    if (previous !== undefined && hoursLabel(previous) !== hoursLabel(day)) {
      flush()
    }
    group.push(day)
  }
  flush()

  return rows
})()

/**
 * Die Öffnungszeiten als ein Satz für Fließtext, z. B. unter „Wann passt es
 * Ihnen?" in der Kasse — aus {@link OPENING_HOURS_ROWS} abgeleitet, damit
 * nirgends eine zweite Tabelle steht, die bei der nächsten Änderung
 * stillschweigend abweicht.
 */
export function openingHoursSentence(): string {
  return OPENING_HOURS_ROWS.map((row) =>
    row.time === 'Ruhetag'
      ? `${row.days} ist Ruhetag`
      : `${row.days} ${row.time}`
  ).join(' · ')
}

/* -------------------------------------------------------------------------- */
/* Abhol-Status für die Anzeige                                                */
/* -------------------------------------------------------------------------- */

/** Der nächste buchbare Abholtermin. */
export interface NextPickup {
  /** `YYYY-MM-DD`. */
  isoDate: string
  /** `HH:mm` – der erste Slot, den die Kasse an diesem Tag noch annimmt. */
  time: string
  /** Deutscher Wochentagsname. */
  weekday: string
  isToday: boolean
}

/** Wo die Abholung in diesem Moment steht. */
export interface PickupStatus {
  isOpenNow: boolean
  /** Schließzeit als `HH:mm`, solange geöffnet ist – sonst `null`. */
  closesAt: string | null
  /** `null`, wenn in den nächsten sieben Tagen kein Slot frei ist. */
  next: NextPickup | null
}

/**
 * Öffnungs- und Abholstatus zu einem Zeitpunkt.
 *
 * Der nächste Termin wird über {@link pickupTimeSlots} gesucht — also über
 * dieselbe Funktion, aus der die Kasse ihre Auswahl baut, inklusive
 * {@link PICKUP_LEAD_MINUTES}. Die Startseite kann dadurch keinen Termin
 * versprechen, den die Kasse anschließend ablehnt.
 *
 * `now` wird bewusst übergeben statt hier gelesen: `new Date()` während des
 * Renderns liefert auf Server und Client verschiedene Werte und bricht die
 * Hydration. Aufrufer holen die Zeit im Effect.
 */
export function pickupStatusAt(now: Date): PickupStatus {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todayWindow = WEEKDAY_HOURS[now.getDay()] ?? null
  const opens = todayWindow ? timeToMinutes(todayWindow.opens) : null
  const closes = todayWindow ? timeToMinutes(todayWindow.closes) : null
  const isOpenNow =
    opens !== null &&
    closes !== null &&
    nowMinutes >= opens &&
    nowMinutes < closes

  let next: NextPickup | null = null
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset
    )
    const isoDate = toIsoDate(date)
    const slots = pickupTimeSlots(
      isoDate,
      offset === 0 ? nowMinutes + PICKUP_LEAD_MINUTES : 0
    )
    if (slots.length > 0) {
      next = {
        isoDate,
        time: slots[0],
        weekday: WEEKDAY_NAMES_DE[date.getDay()],
        isToday: offset === 0,
      }
      break
    }
  }

  return {
    isOpenNow,
    closesAt: isOpenNow && todayWindow ? todayWindow.closes : null,
    next,
  }
}
