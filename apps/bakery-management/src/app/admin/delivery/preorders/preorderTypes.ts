/**
 * Anzeigehilfen der Mörsbach-Seiten (Sammelstelle, samstags Kindergarten
 * Mörsbach): Liefertag, Bestellschluss, Adresse.
 *
 * Seit P2 laufen die Seiten auf `/api/preorders` - Typen und Client kommen
 * aus `lib/preordersTypes.ts` / `lib/preordersApi.ts` (ein Client für alle
 * Vorbestell-Seiten). Der Alias `/api/deliveries/*` bleibt auf der API nur
 * für alte Clients stehen.
 *
 * Bewusst frei von `fs`/`path`: die Datei wird von Server- und
 * Client-Komponenten importiert. Achtung Wochentage: Sammelstellen zählen
 * nach `Date.getDay()` (0 = Sonntag … 6 = Samstag), die Verkaufspartner nach
 * ISO (1 = Montag). Deshalb eigene Labels statt `WEEKDAY_LABELS` aus
 * `partnerTypes`.
 */

export {
  formatCurrency,
  formatDate,
  isBusinessDate,
  shiftDate,
  toBusinessDate,
} from '../../../../lib/partnerTypes'

import { formatDate, toBusinessDate } from '../../../../lib/partnerTypes'
import type { PickupPoint } from '../../../../lib/preordersTypes'

export type { PickupPoint } from '../../../../lib/preordersTypes'

/** Wochentage nach `Date.getDay()` - so, wie die Liefer-API sie zählt. */
export const DELIVERY_WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sonntag',
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
}

/** Wochentag eines `YYYY-MM-DD` nach `Date.getDay()` (0 = Sonntag). */
export function deliveryWeekdayOf(date: string): number | null {
  const parts = date.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(d.getTime())) return null
  return d.getDay()
}

/**
 * Nächster Liefertag dieses Wochentags. Fällt `from` schon darauf, ist es
 * dieser Tag selbst - samstags früh soll die Maske den laufenden Tag zeigen,
 * nicht den in einer Woche.
 */
export function nextDeliveryDate(
  weekday: number,
  from: Date = new Date()
): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const delta = (weekday - d.getDay() + 7) % 7
  d.setDate(d.getDate() + delta)
  return toBusinessDate(d)
}

/** `Freitag, 11.09.2026, 12:00 Uhr` - der Bestellschluss zum Vorlesen. */
export function formatDeadline(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${DELIVERY_WEEKDAY_LABELS[d.getDay()]}, ${formatDate(
    toBusinessDate(d)
  )}, ${time} Uhr`
}

/** `12.09.2026, 09:14 Uhr` */
export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${formatDate(toBusinessDate(d))}, ${d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })} Uhr`
}

export interface DeadlineNotice {
  text: string
  passed: boolean
}

/**
 * Der Satz über der Liste: wann Bestellschluss ist und wie viel Zeit bleibt.
 *
 * `now` wird von außen gereicht, damit der Text nicht beim Rendern aus der Uhr
 * gelesen wird - das gäbe zwischen Server-Render und Hydration einen Mismatch.
 */
export function deadlineNotice(
  deadline: string | null,
  now: Date
): DeadlineNotice | null {
  const label = formatDeadline(deadline)
  if (!label || !deadline) return null
  const at = Date.parse(deadline)
  if (!Number.isFinite(at)) return null

  const remainingMs = at - now.getTime()
  if (remainingMs <= 0) {
    return { text: `Bestellschluss war ${label} - vorbei.`, passed: true }
  }
  const minutes = Math.floor(remainingMs / 60000)
  const rest =
    minutes < 60
      ? `noch ${minutes} Minute${minutes === 1 ? '' : 'n'}`
      : minutes < 60 * 48
      ? `noch ${Math.floor(minutes / 60)} Stunde${
          Math.floor(minutes / 60) === 1 ? '' : 'n'
        }`
      : `noch ${Math.floor(minutes / (60 * 24))} Tage`
  return { text: `Bestellschluss: ${label} - ${rest}.`, passed: false }
}

/** Ist die Adresse der Sammelstelle hinterlegt? Ohne Straße kein Kartenpunkt. */
export function hasPickupAddress(point: PickupPoint | null): boolean {
  return Boolean(point && String(point.street || '').trim())
}

/** `Straße 1, 66482 Zweibrücken-Mörsbach` - leere Teile fallen weg. */
export function formatPickupAddress(point: PickupPoint | null): string {
  if (!point) return ''
  const street = String(point.street || '').trim()
  const place = [point.zip, point.city]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
  return [street, place].filter(Boolean).join(', ')
}
