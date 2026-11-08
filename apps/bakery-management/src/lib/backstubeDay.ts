/**
 * Welcher Backzettel steht auf dem Backstube-Tablet (Z6, roadmap §5.5 Nr. 3)?
 *
 * Gebacken wird ein Produktionstag ab 2 Uhr nachts bis zum Mittag. Die Regel:
 *
 * - **vor 12 Uhr** zeigt das Tablet **heute** - die Backschicht läuft gerade
 *   (oder beginnt gleich, zwischen 0 und 2 Uhr),
 * - **ab 12 Uhr** den **nächsten Produktionstag** - nachmittags wird für ihn
 *   vorbereitet, und nachts steht er schon da, wenn die Schicht beginnt.
 * - Ist heute kein Produktionstag (Montag), gilt immer der nächste.
 *
 * Mit dem Umschalter „Heute“/„Morgen“ sieht man den anderen Tag. „Morgen“
 * ist der nächste Produktionstag nach heute; liegt er nicht auf dem
 * Kalender-Morgen (Sonntag → Dienstag), heißt der Knopf wie der Tag.
 *
 * Reine Funktionen ohne API; die Mengen kommen vom Server.
 */

import {
  DEFAULT_PRODUCTION_DAYS,
  WEEKDAY_SHORT,
  addDays,
  isoWeekday,
  nextProductionDay,
  todayIso,
} from './backzettelFormat'

/** Ab dieser Stunde (Ortszeit) zeigt das Tablet den nächsten Produktionstag. */
export const BACKSTUBE_SWITCH_HOUR = 12

/** Wie oft das Tablet den Zettel neu lädt. */
export const BACKSTUBE_REFRESH_MS = 60 * 1000

export type BackstubeChoice = 'heute' | 'morgen'

export interface BackstubeDates {
  /** Kalender-Heute. */
  today: string
  /** Ob heute gebacken wird. */
  todayIsProductionDay: boolean
  /** Der nächste Produktionstag nach heute. */
  next: string
  /** Was die Regel gerade zeigt. */
  auto: BackstubeChoice
}

function allowedDays(days?: readonly number[] | null): readonly number[] {
  return days && days.length > 0 ? days : DEFAULT_PRODUCTION_DAYS
}

export function isProductionDay(
  date: string,
  days?: readonly number[] | null
): boolean {
  return allowedDays(days).includes(isoWeekday(date))
}

/** Heute, nächster Produktionstag und welcher davon nach der Regel gilt. */
export function backstubeDates(
  now: Date,
  days?: readonly number[] | null
): BackstubeDates {
  const today = todayIso(now)
  const todayIsProductionDay = isProductionDay(today, days)
  const next = nextProductionDay(today, days)
  const auto: BackstubeChoice =
    todayIsProductionDay && now.getHours() < BACKSTUBE_SWITCH_HOUR
      ? 'heute'
      : 'morgen'
  return { today, todayIsProductionDay, next, auto }
}

/** Datum zur Auswahl. */
export function dateForChoice(
  dates: BackstubeDates,
  choice: BackstubeChoice
): string {
  return choice === 'heute' ? dates.today : dates.next
}

/** „Morgen“ - oder „Di 24.11.“, wenn der nächste Produktionstag später liegt. */
export function nextLabel(dates: BackstubeDates): string {
  if (dates.next === addDays(dates.today, 1)) return 'Morgen'
  const [, m, d] = dates.next.split('-')
  return `${WEEKDAY_SHORT[isoWeekday(dates.next)]} ${d}.${m}.`
}
