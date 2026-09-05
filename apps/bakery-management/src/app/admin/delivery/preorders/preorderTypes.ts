/**
 * Typen und Anzeigehilfen für die Vorbestellungen an der Sammelstelle
 * (samstags Kindergarten Mörsbach).
 *
 * Bewusst frei von `fs`/`path`: die Datei wird von Server- und
 * Client-Komponenten importiert. Gerechnet wird auf dem Server
 * (`apps/bakery-api/src/services/delivery-preorders.core.js`) - hier steht nur,
 * was die Oberfläche zum Anzeigen braucht.
 *
 * Achtung Wochentage: die Liefer-API zählt nach `Date.getDay()`
 * (0 = Sonntag … 6 = Samstag), die Verkaufspartner nach ISO (1 = Montag).
 * Deshalb eigene Labels statt `WEEKDAY_LABELS` aus `partnerTypes`.
 */

export {
  formatCurrency,
  formatDate,
  isBusinessDate,
  shiftDate,
  toBusinessDate,
} from '../../../../lib/partnerTypes'

import { formatDate, toBusinessDate } from '../../../../lib/partnerTypes'

export type PreorderStatus =
  | 'open'
  | 'handed_over'
  | 'not_collected'
  | 'cancelled'

export interface OrderDeadline {
  /** Wochentag nach `Date.getDay()`, 0 = Sonntag … 6 = Samstag. */
  weekday: number
  /** `HH:MM`, lokale Zeit. */
  time: string
}

export interface PickupPoint {
  id: string
  name: string
  street: string
  zip: string
  city: string
  /** Liefertag nach `Date.getDay()`. */
  weekday: number
  /** Übergabefenster vor Ort, `HH:MM-HH:MM`. */
  window: string | null
  orderDeadline: OrderDeadline | null
  notes: string | null
  active: boolean
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  geocodePrecision: string | null
}

export interface PickupPointPayload {
  name: string
  street: string
  zip: string
  city: string
  weekday: number
  window: string | null
  orderDeadline: OrderDeadline | null
  notes: string | null
  active: boolean
}

export interface PreorderItem {
  /** HQ-Slug des Produkts, z. B. `bauernbrot`. */
  productId: string
  /** Snapshot des Namens zum Zeitpunkt der Bestellung. */
  name: string
  qty: number
  unit: string
  /** Snapshot des HQ-Preises - eine spätere Preisänderung ändert nichts rückwirkend. */
  unitPrice: number
  lineTotal: number
}

export interface Preorder {
  id: number
  /** Nummer für den Zuruf vor Ort, z. B. `MO-2026-09-12-03`. */
  reference: string
  pickupPointId: string
  /** Liefertag `YYYY-MM-DD`. */
  date: string
  customer: string
  phone: string | null
  items: PreorderItem[]
  total: number
  note: string | null
  status: PreorderStatus
  handedOverAt: string | null
  createdAt: string
  updatedAt: string
  /** Berechnet: Zeitpunkt des Bestellschlusses zu diesem Liefertag. */
  deadline: string | null
  /** Berechnet: nach Bestellschluss angelegt. Blockiert nichts, ist nur ein Hinweis. */
  afterDeadline: boolean
}

export interface PreorderPayload {
  pickupPointId?: string
  date: string
  customer: string
  phone?: string | null
  note?: string | null
  status?: PreorderStatus
  /** Der Server nimmt nur `productId` und `qty` - Name und Preis kommen aus `hq`. */
  items?: Array<{ productId: string; qty: number }>
}

export interface PreorderSummaryProduct {
  productId: string
  name: string
  unit: string
  qty: number
}

export interface PreorderSummary {
  date: string
  pickupPointId: string | null
  /** Berechnet: Bestellschluss zu diesem Liefertag - auch ohne Vorbestellung. */
  deadline: string | null
  /**
   * Gibt es an diesem Tag eine Tour mit dem Stopp der Sammelstelle? Ohne ihn
   * erreicht die Übergabeliste den Fahrer nicht.
   */
  hasPickupStop: boolean
  count: number
  total: number
  open: number
  handedOver: number
  notCollected: number
  cancelled: number
  byProduct: PreorderSummaryProduct[]
}

/** Ein bestellbares Produkt, wie es die Maske aus `GET /api/products` bezieht. */
export interface PreorderProduct {
  /** HQ-Slug - genau das schickt die Maske als `productId`. */
  productId: string
  name: string
  price: number
  category: string
}

export const PREORDER_STATUS_LABELS: Record<PreorderStatus, string> = {
  open: 'Offen',
  handed_over: 'Übergeben',
  not_collected: 'Nicht abgeholt',
  cancelled: 'Storniert',
}

export const PREORDER_STATUS_COLORS: Record<
  PreorderStatus,
  'default' | 'success' | 'warning'
> = {
  open: 'default',
  handed_over: 'success',
  not_collected: 'warning',
  cancelled: 'default',
}

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

/** `2× Bauernbrot, 10× Brötchen` - die Positionen einer Zeile in der Tabelle. */
export function formatItems(items: PreorderItem[] | undefined): string {
  if (!Array.isArray(items) || items.length === 0) return '–'
  return items.map((item) => `${item.qty}× ${item.name}`).join(', ')
}

/**
 * Zeilensumme für die Live-Anzeige der Maske.
 *
 * Verbindlich ist der Server: er rechnet die Summe beim Speichern neu, egal was
 * der Client schickt. Diese Kopie zeigt nur an, was gleich herauskommt - mit
 * derselben Rundung auf Cent, sonst stünde `12.299999999999999` im Formular.
 */
export function previewLineTotal(qty: number, unitPrice: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) return 0
  return Math.round(qty * unitPrice * 100) / 100
}

/** Gesamtsumme für die Live-Anzeige - Zeilensummen runden, dann addieren. */
export function previewTotal(
  rows: Array<{ qty: number; unitPrice: number }>
): number {
  const sum = rows.reduce(
    (acc, row) => acc + previewLineTotal(row.qty, row.unitPrice),
    0
  )
  return Math.round(sum * 100) / 100
}
