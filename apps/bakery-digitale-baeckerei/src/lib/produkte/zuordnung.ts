/**
 * Zuordnung Platz → Produkt: verbindet die Belegung aus dem Modell mit dem
 * Produkt-Snapshot aus hq. Ein Platz, dessen Produkt es in hq nicht (mehr)
 * gibt, hat keinen Eintrag - er bleibt im Bild sichtbar, aber ohne Karte.
 */
import type {
  Belegung,
  BelegungDatei,
  BelegungEintrag,
  ProduktInfo,
  ProduktSnapshot,
} from './types'

export interface ListenEintrag {
  slot: string
  produkt: ProduktInfo
  anzahl?: number
}

function produktVon(
  snapshot: ProduktSnapshot,
  id: string
): ProduktInfo | undefined {
  // hasOwnProperty: eine ID wie `toString` darf nichts aus dem Prototyp treffen.
  return Object.prototype.hasOwnProperty.call(snapshot.produkte, id)
    ? snapshot.produkte[id]
    : undefined
}

/**
 * Alle Plätze, deren ID mit einem der `moebel`-Präfixe beginnt (z. B.
 * `['theke/']`) und deren Produkt im Snapshot steht - in der Reihenfolge der
 * Belegung.
 */
export function eintraegeFuer(
  belegung: Belegung,
  snapshot: ProduktSnapshot,
  moebel: readonly string[]
): ListenEintrag[] {
  const eintraege: ListenEintrag[] = []
  for (const eintrag of belegung.slots) {
    if (!moebel.some((prefix) => eintrag.slot.startsWith(prefix))) continue
    const produkt = produktVon(snapshot, eintrag.produkt)
    if (!produkt) continue
    eintraege.push(
      eintrag.anzahl === undefined
        ? { slot: eintrag.slot, produkt }
        : { slot: eintrag.slot, produkt, anzahl: eintrag.anzahl }
    )
  }
  return eintraege
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * So lange darf eine Daten-Datei auf sich warten lassen - alle Versuche
 * zusammen. Die Szene wartet vor dem ersten Bild auf die Einrichtung (DB12) -
 * eine Anfrage, die hängt, darf sie nicht aufhalten: Danach gilt sie als nicht
 * ladbar, und der Laden zeigt die Ware seines Modells.
 */
export const DATEN_ZEIT_MS = 8000

/**
 * Pausen vor dem zweiten und dritten Versuch, wenn das Netz kurz weg ist
 * (fetch wirft TypeError) oder der Server hakt (5xx). Eine fehlende Datei
 * (4xx) oder unlesbares JSON wird nicht wiederholt - das wird beim nächsten
 * Versuch nicht besser.
 */
export const WIEDERHOLEN_NACH_MS: readonly number[] = [300, 900]

/**
 * Lädt eine JSON-Datei. Wirft mit einer deutschen Meldung („<was> konnten
 * nicht geladen werden.“), wenn sie fehlt, nicht lesbar ist oder nach
 * `DATEN_ZEIT_MS` noch nicht da ist. Netzfehler und 5xx werden bis zu
 * zweimal wiederholt, innerhalb derselben Frist.
 */
export async function ladeJson(url: string, was: string): Promise<unknown> {
  const nichtGeladen = () => new Error(`${was} konnten nicht geladen werden.`)
  let uhr: ReturnType<typeof setTimeout> | undefined
  let pauseUhr: ReturnType<typeof setTimeout> | undefined
  /** Die Frist ist um (oder es ist entschieden): kein neuer Versuch mehr. */
  let vorbei = false
  // Ein Wettlauf: Die Frist gilt für Antworten, Pausen und Inhalt zusammen.
  // Eine Anfrage, die hängt, läuft im Hintergrund aus - ihr Ergebnis braucht
  // dann niemand mehr, und nach ihr kommt kein weiterer Versuch.
  const zuSpaet = new Promise<never>((_, ablehnen) => {
    uhr = setTimeout(() => ablehnen(nichtGeladen()), DATEN_ZEIT_MS)
  })
  const pause = (ms: number) =>
    new Promise<void>((weiter) => {
      pauseUhr = setTimeout(weiter, ms)
    })
  const laden = async (): Promise<unknown> => {
    for (let versuch = 0; ; versuch += 1) {
      const nochmal =
        versuch < WIEDERHOLEN_NACH_MS.length
          ? WIEDERHOLEN_NACH_MS[versuch]
          : undefined
      let res: Response
      try {
        res = await fetch(url)
      } catch (err) {
        // Ein Netzfehler ist bei fetch ein TypeError; alles andere (etwa
        // ein Abbruch) wird nicht wiederholt.
        const netz = err instanceof TypeError
        if (!netz || nochmal === undefined || vorbei) throw nichtGeladen()
        await pause(nochmal)
        continue
      }
      if (!res.ok) {
        if (res.status >= 500 && nochmal !== undefined && !vorbei) {
          await pause(nochmal)
          continue
        }
        throw new Error(
          `${was} konnten nicht geladen werden (HTTP ${res.status}).`
        )
      }
      try {
        return await res.json()
      } catch {
        throw new Error(`${was} sind nicht lesbar.`)
      }
    }
  }
  try {
    return await Promise.race([laden(), zuSpaet])
  } finally {
    vorbei = true
    clearTimeout(uhr)
    clearTimeout(pauseUhr)
  }
}

function istSnapshot(v: unknown): v is ProduktSnapshot {
  return isRecord(v) && v.version === 1 && isRecord(v.produkte)
}

function istEintrag(v: unknown): v is BelegungEintrag {
  return (
    isRecord(v) && typeof v.slot === 'string' && typeof v.produkt === 'string'
  )
}

function istBelegung(v: unknown): v is BelegungDatei {
  return (
    isRecord(v) &&
    v.version === 3 &&
    isRecord(v.raeume) &&
    Object.values(v.raeume).every(
      (raum) =>
        isRecord(raum) &&
        isRecord(raum.quelle) &&
        Array.isArray(raum.slots) &&
        raum.slots.every(istEintrag)
    )
  )
}

/**
 * Die Belegung eines Raums. Nennt die Datei den Raum nicht (ein Raum ohne
 * Modell, oder ohne Produkte), ist sie leer - es wird nichts erfunden.
 */
export function belegungVon(datei: BelegungDatei, raumId: string): Belegung {
  const raum = Object.prototype.hasOwnProperty.call(datei.raeume, raumId)
    ? datei.raeume[raumId]
    : undefined
  return {
    version: 1,
    quelle: raum?.quelle ?? { commit: '' },
    slots: raum?.slots ?? [],
    leer: Array.isArray(raum?.leer) ? raum.leer : [],
    plaetze: isRecord(raum?.plaetze) ? raum.plaetze : {},
  }
}

/**
 * Lädt Snapshot und Belegung aus `${basePath}/data/` (public/data/, beim
 * Bauen geschrieben). Wirft mit einer deutschen Meldung, wenn eine Datei
 * fehlt oder nicht die erwartete Form hat.
 */
export async function ladeProduktdaten(
  basePath: string
): Promise<{ snapshot: ProduktSnapshot; belegung: BelegungDatei }> {
  const [snapshot, belegung] = await Promise.all([
    ladeJson(`${basePath}/data/products.snapshot.json`, 'Die Produktdaten'),
    ladeJson(`${basePath}/data/belegung.json`, 'Die Plätze im Regal'),
  ])
  if (!istSnapshot(snapshot)) {
    throw new Error('Die Produktdaten haben nicht die erwartete Form.')
  }
  if (!istBelegung(belegung)) {
    throw new Error('Die Plätze im Regal haben nicht die erwartete Form.')
  }
  return { snapshot, belegung }
}
