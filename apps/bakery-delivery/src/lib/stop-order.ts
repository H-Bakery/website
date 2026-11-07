import type { Stop } from './delivery-api'

type Ordered = Pick<Stop, 'id' | 'status' | 'completedAt'>

/**
 * Die Reihenfolge, in der die App Stopps zeigt und nummeriert: erst die
 * erledigten (geliefert oder nicht angetroffen) in der Reihenfolge, in der
 * sie abgehakt wurden, dann die offenen in der Reihenfolge der Tour.
 *
 * Der Server laesst erledigte Stopps beim „Route berechnen" auf ihrem alten
 * Platz und sortiert die offenen drumherum - die Liste stand dann
 * „1 Fink (offen), 2 Drossel, 3 Amsel (geliefert), 4 Buchfink (nicht
 * angetroffen), 5 Mörsbach (offen)", und die Nummer hiess nicht mehr
 * „so wird gefahren". Hier schon.
 */
export function displayOrder<T extends Ordered>(stops: readonly T[]): T[] {
  const indexed = stops.map((stop, index) => ({ stop, index }))
  const finished = indexed
    .filter(({ stop }) => stop.status !== 'open')
    .sort(
      (a, b) => completedKey(a.stop) - completedKey(b.stop) || a.index - b.index
    )
  const open = indexed.filter(({ stop }) => stop.status === 'open')
  return [...finished, ...open].map(({ stop }) => stop)
}

/**
 * Nummer je Stopp (ab 1) nach `displayOrder` - dieselbe in der Liste, im
 * Block „Nächster Stopp" und auf der Karte. Die Karte zaehlte frueher nur
 * die Stopps mit Koordinaten: fehlte dem ersten die Adresse, stand auf dem
 * Marker von Stopp 2 eine 1.
 */
export function stopPositions(stops: readonly Ordered[]): Map<number, number> {
  return new Map(displayOrder(stops).map((stop, index) => [stop.id, index + 1]))
}

/** Abhakzeit als Zahl; ohne (alte Daten) hinter die mit Zeit. */
function completedKey(stop: Ordered): number {
  const time = stop.completedAt ? Date.parse(stop.completedAt) : NaN
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}
