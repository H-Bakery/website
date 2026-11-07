// Was die Fahrer-App über die Warteschlange sagt - rein, ohne React, getestet
// in sync-messages.spec.ts.

import type { QueuedUpdate, RejectedUpdate, Tour } from './delivery-api'

/**
 * Der Balken oben: Funkloch, Serverfehler oder nur noch nicht gesendet. Ein
 * 5xx ist kein „Kein Netz“ - sonst suchte der Fahrer den Fehler am Handy.
 */
export function syncNotice(
  isOnline: boolean,
  serverTrouble: boolean,
  pendingCount: number
): string | null {
  const open = pendingCount > 0 ? ` (${pendingCount} offen)` : ''
  if (!isOnline) {
    return `Kein Netz. Änderungen werden gespeichert und automatisch nachgesendet${open}.`
  }
  if (serverTrouble) {
    return pendingCount > 0
      ? `Der Server hat einen Fehler gemeldet – ${
          pendingCount === 1 ? 'die Änderung wird' : 'die Änderungen werden'
        } automatisch erneut gesendet${open}. Bleibt das so, bitte im Büro melden.`
      : 'Der Server hat einen Fehler gemeldet. Bleibt das so, bitte im Büro melden.'
  }
  if (pendingCount === 0) return null
  return pendingCount === 1
    ? '1 Änderung wartet noch auf den Server und wird automatisch nachgesendet.'
    : `${pendingCount} Änderungen warten noch auf den Server und werden automatisch nachgesendet.`
}

/** Was eine Änderung der Warteschlange tun sollte, als Satzanfang. */
function describeChange(entry: QueuedUpdate, tours: Tour[]): string {
  if (entry.kind === 'preorder') {
    const preorder = tours
      .flatMap((tour) => tour.stops)
      .flatMap((stop) => stop.preorders ?? [])
      .find((p) => p.id === entry.preorderId)
    const name = preorder?.customer
    switch (entry.body.status) {
      // Die Liste zeigt die Vorschau der Warteschlange - ob die Bestellung
      // vorher schon übergeben war, lässt sich hier nicht mehr ablesen.
      case 'handed_over':
        return name ? `Übergabe an ${name}` : 'Übergabe einer Vorbestellung'
      case 'not_collected':
        return `„Nicht abgeholt“ bei ${name ?? 'einer Vorbestellung'}`
      default:
        return `Zurücksetzen bei ${name ?? 'einer Vorbestellung'}`
    }
  }
  const stop = tours
    .filter((tour) => tour.id === entry.tourId)
    .flatMap((tour) => tour.stops)
    .find((s) => s.id === entry.stopId)
  const who = stop ? stop.customer : 'einem Stopp'
  switch (entry.body.status) {
    case 'done':
      return stop?.pickupPointId
        ? `Abschluss der Sammelstelle ${who}`
        : `„Geliefert“ bei ${who}`
    case 'failed':
      return `„Nicht angetroffen“ bei ${who}`
    case 'open':
      return `Zurücksetzen bei ${who}`
    default:
      return `Änderung bei ${who}`
  }
}

/**
 * Die Meldung nach abgelehnten Nachsendungen: welche Änderung, bei wem, und
 * der Grund des Servers - nicht nur „1 Änderung verworfen“. `tours` ist der
 * Stand *vor* dem Neuladen (dort stehen die Namen noch).
 */
export function describeRejected(
  rejected: RejectedUpdate[],
  tours: Tour[]
): string {
  const lines = rejected.map((entry) => {
    const reason = entry.reason.trim().replace(/\.?$/, '.')
    return `${describeChange(entry, tours)} nicht gespeichert: ${reason}`
  })
  return `${lines.join(' ')} Angezeigt ist jetzt der Stand des Servers.`
}
