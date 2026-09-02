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
