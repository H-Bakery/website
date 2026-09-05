// Deutsche Formatierung. Die App laeuft in Homburg, nicht in Zuerich - Locale
// ist ueberall `de-DE`.

import type { Preorder, Stop, StopItem } from './delivery-api'

export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatItems(items: StopItem[]): string {
  if (!items || items.length === 0) return ''
  return items.map((item) => `${item.qty}× ${item.name}`).join(', ')
}

/**
 * Geldbetrag als „12,40 €". Der Fahrer kassiert bar - der Betrag muss
 * aussehen wie auf dem Kassenbon, nicht wie eine Fliesskommazahl.
 */
export function formatCurrency(value: number): string {
  const amount = Number.isFinite(value) ? value : 0
  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
}

export const STOP_STATUS_LABEL: Record<Stop['status'], string> = {
  open: 'Offen',
  done: 'Geliefert',
  failed: 'Nicht angetroffen',
}

/**
 * An einer Sammelstelle wird nichts zugestellt, sondern ausgegeben - „Geliefert"
 * waere dort schlicht falsch. Die uebrigen Zustaende bleiben, wie sie sind.
 */
export const PICKUP_STOP_STATUS_LABEL: Record<Stop['status'], string> = {
  ...STOP_STATUS_LABEL,
  done: 'Abgeschlossen',
}

export const PREORDER_STATUS_LABEL: Record<Preorder['status'], string> = {
  open: 'Offen',
  handed_over: 'Übergeben',
  not_collected: 'Nicht abgeholt',
  cancelled: 'Storniert',
}

export const TOUR_STATUS_LABEL: Record<'planned' | 'active' | 'done', string> =
  {
    planned: 'Geplant',
    active: 'Unterwegs',
    done: 'Abgeschlossen',
  }

/** Datum von heute als JJJJ-MM-TT - lokal, damit spaetabends nicht der Folgetag kommt. */
export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Nächster Samstag (oder heute, wenn heute Samstag ist). */
export function nextSaturdayIso(): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7))
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
