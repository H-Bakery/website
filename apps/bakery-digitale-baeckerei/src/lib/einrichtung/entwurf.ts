/**
 * Einrichten-Modus (DB12, nur lokal): der Entwurf einer Einrichtung - die
 * Datei aus hq, die Änderungen des Inhabers darüber, und was daraus für die
 * Szene und die Listen folgt. Reine Logik; Lesen, Ändern und Prüfen der Datei
 * stehen einmal in scripts/einrichtung.js (derselbe Leser wie beim Bauen).
 *
 * Der Entwurf lebt nur im Arbeitsspeicher. Heraus kommt er als vollständige
 * `einrichtung.yaml` (herunterladen oder kopieren) - ohne Änderung Zeichen
 * für Zeichen die geladene Datei.
 */
import {
  aendereEinrichtung,
  leseEinrichtung,
  wendeAn,
} from '../../../scripts/einrichtung'
import type { Belegung, BelegungDatei } from '../produkte/types'

/** Was auf einem Platz liegen soll. */
export type Eintrag = { produkt: string; anzahl: number } | 'leer'
/** Je Raum und Platz: der neue Eintrag, oder `null` = wieder wie im Modell. */
export type Aenderungen = Record<string, Record<string, Eintrag | null>>

export interface Aenderung {
  raum: string
  slot: string
  /** Was die geladene Datei dort sagt (`undefined`: nichts - wie im Modell). */
  vorher?: Eintrag
  /** Was der Entwurf dort sagt (`undefined`: wieder wie im Modell). */
  jetzt?: Eintrag
}

export interface Entwurf {
  /** Die vollständige `einrichtung.yaml` des Entwurfs. */
  text: string
  /** Die Belegung je Raum, wie sie mit dem Entwurf gilt. */
  belegungen: Record<string, Belegung>
  /** Worin sich der Entwurf von der geladenen Datei unterscheidet. */
  aenderungen: Aenderung[]
}

const gleich = (a: Eintrag | undefined, b: Eintrag | undefined): boolean =>
  a === b ||
  (typeof a === 'object' &&
    typeof b === 'object' &&
    a.produkt === b.produkt &&
    a.anzahl === b.anzahl)

/** Eine Änderung mehr - ohne die bisherigen anzufassen. */
export function mitAenderung(
  aenderungen: Aenderungen,
  raum: string,
  slot: string,
  eintrag: Eintrag | null
): Aenderungen {
  return { ...aenderungen, [raum]: { ...aenderungen[raum], [slot]: eintrag } }
}

/** Eine Änderung zurücknehmen: Für den Platz gilt wieder die geladene Datei. */
export function ohneAenderung(
  aenderungen: Aenderungen,
  raum: string,
  slot: string
): Aenderungen {
  const rest = { ...aenderungen[raum] }
  delete rest[slot]
  return { ...aenderungen, [raum]: rest }
}

/**
 * Rechnet den Entwurf aus. Wirft mit einer deutschen Meldung, wenn die Datei
 * oder eine Änderung einen Platz oder ein Produkt nennt, das es nicht gibt.
 *
 * - `quelle`: Text der geladenen `einrichtung.yaml` (leer: es gibt noch keine)
 * - `modell`: die Belegung der Modelle ohne Einrichtung
 * - `gebaut`: die Belegung des Builds - von ihr kommen die Rahmen der Plätze
 * - `produkte`: alle Produkt-IDs, die es in hq gibt
 */
export function berechneEntwurf(o: {
  quelle: string
  aenderungen: Aenderungen
  modell: BelegungDatei
  gebaut: BelegungDatei
  produkte: readonly string[]
}): Entwurf {
  const text = aendereEinrichtung(o.quelle, o.aenderungen)
  const alt = leseEinrichtung(o.quelle)
  const neu = leseEinrichtung(text)
  const fremd = Object.keys(neu.raeume).filter(
    (raum) => !Object.prototype.hasOwnProperty.call(o.gebaut.raeume, raum)
  )
  if (fremd.length > 0) {
    throw new Error(`einrichtung.yaml: den Raum "${fremd[0]}" gibt es nicht.`)
  }
  const belegungen: Record<string, Belegung> = {}
  for (const [raum, gebaut] of Object.entries(o.gebaut.raeume)) {
    const plaetze = gebaut.plaetze ?? {}
    const modell = Object.prototype.hasOwnProperty.call(o.modell.raeume, raum)
      ? o.modell.raeume[raum]
      : { quelle: gebaut.quelle, slots: [] }
    const ergebnis = wendeAn({ slots: modell.slots }, neu.raeume[raum], {
      raum,
      bekannt: Object.keys(plaetze),
      produkte: o.produkte,
    })
    belegungen[raum] = {
      version: 1,
      quelle: gebaut.quelle,
      slots: ergebnis.slots,
      leer: ergebnis.leer,
      plaetze,
    }
  }
  const aenderungen: Aenderung[] = []
  const raeume = new Set([
    ...Object.keys(alt.raeume),
    ...Object.keys(neu.raeume),
  ])
  for (const raum of [...raeume].sort()) {
    const a = alt.raeume[raum] ?? {}
    const n = neu.raeume[raum] ?? {}
    const slots = new Set([...Object.keys(a), ...Object.keys(n)])
    for (const slot of [...slots].sort()) {
      const vorher = Object.prototype.hasOwnProperty.call(a, slot)
        ? a[slot]
        : undefined
      const jetzt = Object.prototype.hasOwnProperty.call(n, slot)
        ? n[slot]
        : undefined
      if (!gleich(vorher, jetzt)) {
        aenderungen.push({
          raum,
          slot,
          ...(vorher === undefined ? {} : { vorher }),
          ...(jetzt === undefined ? {} : { jetzt }),
        })
      }
    }
  }
  return { text, belegungen, aenderungen }
}

/** Eigene Namen für Möbel, deren ID sich nicht von selbst gut liest. */
const NAMEN: Record<string, string> = {
  brezelstaender: 'Brezelständer',
  getraenkekuehlschrank: 'Getränkekühlschrank',
  koerbe: 'Körbe',
  wuerfelregal: 'Würfelregal',
}

/** `brotregal/ebene-1/platz-01` → „Brotregal · Ebene 1 · Platz 1“. */
export function platzName(slot: string): string {
  return slot
    .split('/')
    .map((teil) => {
      if (Object.prototype.hasOwnProperty.call(NAMEN, teil)) return NAMEN[teil]
      const worte = teil
        .split('-')
        .map((wort) => (/^\d+$/.test(wort) ? String(Number(wort)) : wort))
        .join(' ')
      return worte.charAt(0).toUpperCase() + worte.slice(1)
    })
    .join(' · ')
}
