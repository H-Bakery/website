/**
 * @fileoverview Der Weg von der Kasse zur Bestellbestätigung.
 * @module @bakery/shop/feature-cart/confirmation-link
 *
 * Die Kasse schreibt den Suchparameter, die Bestätigung liest ihn. Beide
 * nehmen die Konstanten von hier, damit der Vertrag nicht auseinanderläuft.
 */

import { sameCents } from './order-totals'

/** Suchparameter, mit dem die Kasse eine Preisänderung des Servers meldet. */
export const PRICE_UPDATED_PARAM = 'preis'
export const PRICE_UPDATED_VALUE = 'aktualisiert'

/**
 * Pfad zur Bestätigung. `POST /api/orders` rechnet mit den hq-Preisen und gibt
 * die gebuchte Summe zurück. Weicht sie von dem ab, was an der Kasse stand,
 * trägt der Link das im Suchparameter — die Bestätigung sagt es dann dazu,
 * statt still eine andere Zahl zu zeigen. Antwortet der Server ohne Summe,
 * gibt es nichts zu vergleichen.
 */
export function confirmationPath(
  orderId: string,
  totals: { displayed: number; booked: unknown }
): string {
  const path = `/bestellung/${encodeURIComponent(orderId)}`
  const booked = totals.booked
  const changed =
    typeof booked === 'number' &&
    Number.isFinite(booked) &&
    !sameCents(booked, totals.displayed)
  return changed
    ? `${path}?${PRICE_UPDATED_PARAM}=${PRICE_UPDATED_VALUE}`
    : path
}

/**
 * Bestellcodes, die in diesem Tab gerade an der Kasse angenommen wurden
 * (`sessionStorage`). Nur für sie darf die Bestätigung „Danke“ sagen, wenn
 * der Server die Einzelheiten danach nicht liefert - für einen beliebigen
 * Code in der URL wäre das eine Zusage ohne Grundlage (Abschluss-Verifikation
 * next). Jeder Zugriff in try/catch (privates Fenster, gesperrter Speicher).
 */
export const PLACED_ORDERS_KEY = 'bakery-shop-placed-orders'

function readPlaced(): string[] {
  try {
    const raw = window.sessionStorage.getItem(PLACED_ORDERS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

export function rememberPlacedOrder(orderId: string): void {
  try {
    const next = [...readPlaced().filter((id) => id !== orderId), orderId]
    window.sessionStorage.setItem(
      PLACED_ORDERS_KEY,
      JSON.stringify(next.slice(-10))
    )
  } catch {
    // ohne Speicher zeigt die Bestätigung im Fehlerfall die neutrale Seite
  }
}

export function wasPlacedHere(orderId: string): boolean {
  return orderId !== '' && readPlaced().includes(orderId)
}
