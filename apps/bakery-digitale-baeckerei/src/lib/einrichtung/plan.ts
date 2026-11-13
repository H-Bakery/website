/**
 * Einrichtung des Raums (DB12): Was zeigt die Szene auf welchem Platz? Aus
 * der Belegung (Modell + Einrichtung aus hq), den Rahmen der Plätze, den
 * Regal-Modellen und dem, was im Modell selbst auf dem Platz liegt, entsteht
 * je Platz ein Plan. Reine Logik ohne three; die Rechnung der Lagen steht
 * einmal in scripts/auslage.js (auch `sync-produkte-3d` benutzt sie).
 *
 * Regeln:
 * - **Gibt es Regal-Modelle, liegen sie auf allen Plätzen** (`ALLE_LEGEN`),
 *   nicht nur auf den geänderten - sonst stünden zwei Bildsprachen
 *   nebeneinander (die Formen des Modells und die Regal-Modelle).
 * - Ein Platz, der `leer` ist, zeigt nichts.
 * - Hat das Produkt eines Platzes **kein Regal-Modell** (oder passt kein
 *   einziges Stück): Ist es das Produkt, das im Modell dort liegt, bleibt die
 *   Ware des Modells. Sonst bleibt der Platz im Bild leer - das Produkt steht
 *   weiter in der Liste. Nie die Form eines anderen Produkts.
 * - Ohne Regal-Modelle und ohne Einrichtung bleibt alles, wie es im Modell
 *   ist (so baut der öffentliche Deploy heute).
 */
import { auslage, gewendet, type Befund } from '../../../scripts/auslage'
import type { Blickpunkt } from '../../config/raeume'
import type { RegalModell } from '../produkte/modelle'
import type { Belegung, Platz } from '../produkte/types'

/** Mit Regal-Modellen alle Plätze legen (einheitliches Bild) - nicht nur geänderte. */
export const ALLE_LEGEN = true

/** Was im Modell selbst auf einem Platz liegt (`extras` des Knotens). */
export interface ImModell {
  produkt?: string
  ware?: string
  anzahl?: number
}

export type PlatzPlan =
  /** Die Ware des Modells bleibt, wie sie ist. */
  | { art: 'gebacken' }
  /** Nichts zu sehen, nichts anzutippen. */
  | { art: 'leer' }
  /** Die Ware des Modells verschwindet, Regal-Modelle liegen dort. */
  | {
      art: 'gelegt'
      produkt: string
      /** Verlangte Stückzahl. */
      anzahl: number
      /** Je Stück eine 4×4-Matrix im Rahmen des Modells (spaltenweise). */
      matrizen: number[][]
      befund: Befund
      /** Das Tablett des Modells bleibt liegen. */
      traeger: boolean
    }
  /** Die Ware des Modells verschwindet; für das Produkt gibt es kein Regal-Modell. */
  | { art: 'ohne-modell'; produkt: string; traeger: boolean }

const hat = <T>(
  o: Record<string, T> | undefined,
  key: string
): o is Record<string, T> => !!o && Object.prototype.hasOwnProperty.call(o, key)

const skalar = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Der Platz, wie ihn der Besucher sieht: „Vorn“ zeigt zum Standort des
 * Blickpunkts, zu dem der Platz gehört. Der Sync leitet „vorn“ aus der Ware ab
 * (Gefälle, gefüllt von vorn); wo das nichts hergibt, entscheidet der
 * Standort. Am Haken zeigt die Oberseite des Stücks zum Besucher.
 */
export function ausgerichtet(
  platz: Platz,
  slot: string,
  blickpunkte: readonly Pick<Blickpunkt, 'eye' | 'moebel'>[]
): Platz {
  const bp = blickpunkte.find((b) =>
    b.moebel.some((prefix) => slot.startsWith(prefix))
  )
  if (!bp) return platz
  const zum = [
    bp.eye[0] - platz.o[0],
    bp.eye[1] - platz.o[1],
    bp.eye[2] - platz.o[2],
  ]
  if (platz.art === 'haken') {
    // „oben“ ist hier die Richtung des Arms: die Schauseite hängt daran.
    if (skalar(zum, platz.n) >= 0) return platz
    return {
      ...platz,
      r: [-platz.r[0], -platz.r[1], -platz.r[2]],
      n: [-platz.n[0], -platz.n[1], -platz.n[2]],
    }
  }
  // Nur die waagerechte Richtung zählt (der Blick von oben auf einen geneigten Boden).
  const vorn = platz.f[0] * zum[0] + platz.f[2] * zum[2]
  return vorn >= 0 ? platz : (gewendet(platz) as Platz)
}

/**
 * Der Plan für alle Plätze eines Raums. `imModell`: je Platz, was das
 * geladene Modell dort zeigt (nur sichtbare Plätze).
 */
export function planeRaum(o: {
  belegung: Belegung
  regal?: Record<string, RegalModell>
  imModell: Record<string, ImModell>
  blickpunkte: readonly Pick<Blickpunkt, 'eye' | 'moebel'>[]
}): Record<string, PlatzPlan> {
  const { belegung, regal, imModell, blickpunkte } = o
  const plan: Record<string, PlatzPlan> = {}
  const leer = new Set(belegung.leer ?? [])
  const belegt = new Map(belegung.slots.map((s) => [s.slot, s]))
  const gibtRegale = !!regal && Object.keys(regal).length > 0

  for (const slot of Object.keys(imModell)) {
    if (leer.has(slot)) {
      plan[slot] = { art: 'leer' }
      continue
    }
    const eintrag = belegt.get(slot)
    const modell = imModell[slot]
    // Kein Produkt (neutrale Ware) und nichts eingerichtet: bleibt.
    if (!eintrag) {
      plan[slot] = { art: 'gebacken' }
      continue
    }
    const wieImModell = modell.produkt === eintrag.produkt
    const unveraendert =
      wieImModell &&
      (eintrag.anzahl === undefined || eintrag.anzahl === modell.anzahl)
    const platz = hat(belegung.plaetze, slot)
      ? belegung.plaetze[slot]
      : undefined
    const traeger = platz?.traeger === true
    if (!gibtRegale && unveraendert) {
      plan[slot] = { art: 'gebacken' }
      continue
    }
    if (!ALLE_LEGEN && unveraendert) {
      plan[slot] = { art: 'gebacken' }
      continue
    }
    const regalModell = hat(regal, eintrag.produkt)
      ? regal[eintrag.produkt]
      : undefined
    if (regalModell && platz) {
      const anzahl = eintrag.anzahl ?? 1
      const lage = auslage(
        slot,
        ausgerichtet(platz, slot, blickpunkte),
        regalModell.bbox_m,
        anzahl
      )
      if (lage.gelegt > 0) {
        plan[slot] = {
          art: 'gelegt',
          produkt: eintrag.produkt,
          anzahl,
          matrizen: lage.matrizen,
          befund: lage.befund,
          traeger,
        }
        continue
      }
    }
    plan[slot] = wieImModell
      ? { art: 'gebacken' }
      : { art: 'ohne-modell', produkt: eintrag.produkt, traeger }
  }
  return plan
}

/** Zahlen zum Plan - für den Messhaken und die Tests. */
export function zaehlePlan(plan: Record<string, PlatzPlan>): {
  gelegt: number
  stuecke: number
  leer: number
  ohneModell: number
  gebacken: number
} {
  const z = { gelegt: 0, stuecke: 0, leer: 0, ohneModell: 0, gebacken: 0 }
  for (const p of Object.values(plan)) {
    if (p.art === 'gelegt') {
      z.gelegt += 1
      z.stuecke += p.matrizen.length
    } else if (p.art === 'leer') z.leer += 1
    else if (p.art === 'ohne-modell') z.ohneModell += 1
    else z.gebacken += 1
  }
  return z
}
