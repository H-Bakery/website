/**
 * „Entdeckt x von y“: welche Produkte in diesem Besuch schon einmal als Karte
 * offen waren. Reine Rechnung; den Stand hält `DigitaleBaeckerei` nur im
 * Arbeitsspeicher - nichts davon wird auf dem Gerät gespeichert.
 */
import type { Belegung, ProduktSnapshot } from './types'

/**
 * Alle Produkte, die man entdecken kann: jedes Produkt der Belegung genau
 * einmal, sofern der Snapshot es kennt (nur dann gibt es eine Karte).
 */
export function entdeckbare(
  belegung: Belegung,
  snapshot: ProduktSnapshot
): string[] {
  const ids = new Set<string>()
  for (const { produkt } of belegung.slots) {
    if (Object.prototype.hasOwnProperty.call(snapshot.produkte, produkt)) {
      ids.add(produkt)
    }
  }
  return [...ids]
}

/**
 * Ein Produkt als entdeckt merken. Liefert dieselbe Menge zurück, wenn es
 * schon dabei war (React rendert dann nicht neu).
 */
export function merkeEntdeckt(
  entdeckt: ReadonlySet<string>,
  id: string
): ReadonlySet<string> {
  if (entdeckt.has(id)) return entdeckt
  return new Set(entdeckt).add(id)
}

/** x von y: Gezählt wird nur, was es (noch) zu entdecken gibt. */
export function zaehleEntdeckt(
  entdeckt: ReadonlySet<string>,
  alle: readonly string[]
): { entdeckt: number; gesamt: number } {
  const menge = new Set(alle)
  let x = 0
  for (const id of menge) if (entdeckt.has(id)) x += 1
  return { entdeckt: x, gesamt: menge.size }
}

/** „12 von 48 Produkten im Laden entdeckt“ - `null`, wenn es nichts zu entdecken gibt. */
export function entdecktText(stand: {
  entdeckt: number
  gesamt: number
}): string | null {
  if (!(stand.gesamt > 0)) return null
  if (stand.entdeckt >= stand.gesamt) {
    return stand.gesamt === 1
      ? 'Das eine Produkt im Laden entdeckt'
      : `Alle ${stand.gesamt} Produkte im Laden entdeckt`
  }
  return `${stand.entdeckt} von ${stand.gesamt} ${
    stand.gesamt === 1 ? 'Produkt' : 'Produkten'
  } im Laden entdeckt`
}
