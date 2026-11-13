/**
 * Infopunkte der Räume: `public/data/rauminfos.json`, beim Bauen geschrieben
 * von scripts/sync-rauminfos.mjs aus hq
 * (`config/digitale-baeckerei/raeume/<raum>.yaml`; Leser und Vertrag:
 * scripts/rauminfos.js). Ein Infopunkt gehört zu einem Stück des Modells
 * (Ofen, Kneter …) - ein Tipp darauf öffnet dieselbe Karte wie bei einem
 * Produkt, und er steht in „Alles hier“ und im Ersatz ohne WebGL.
 *
 * Fehlt die Datei oder nennt sie einen Raum nicht, hat der Raum keine
 * Infopunkte - das ist kein Fehler, und es wird nichts erfunden.
 */
import type { Karte } from '../karte'

export interface Infopunkt {
  /** Anfang der Knoten-ID im Modell, ohne Schrägstrich am Ende (`ofen`). */
  knoten: string
  titel: string
  kurz: string
  /** langer Text hinter „Mehr lesen“ */
  text?: string
}

export interface Rauminfos {
  version: 1
  /** Schlüssel = id des Raums; Räume ohne Infopunkte fehlen. */
  raeume: Record<string, { infopunkte: Infopunkt[] }>
}

export const LEERE_RAUMINFOS: Rauminfos = { version: 1, raeume: {} }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function istInfopunkt(v: unknown): v is Infopunkt {
  return (
    isRecord(v) &&
    typeof v.knoten === 'string' &&
    v.knoten !== '' &&
    typeof v.titel === 'string' &&
    v.titel !== '' &&
    typeof v.kurz === 'string' &&
    (v.text === undefined || typeof v.text === 'string')
  )
}

/**
 * Liest die Datei tolerant: Einträge, die nicht dem Vertrag entsprechen,
 * fallen weg; eine unbekannte Form ergibt „keine Infopunkte“.
 */
export function leseRauminfos(raw: unknown): Rauminfos {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.raeume)) {
    return LEERE_RAUMINFOS
  }
  const raeume: Rauminfos['raeume'] = {}
  for (const [raum, eintrag] of Object.entries(raw.raeume)) {
    if (!isRecord(eintrag) || !Array.isArray(eintrag.infopunkte)) continue
    const infopunkte = eintrag.infopunkte.filter(istInfopunkt).map((p) => ({
      knoten: p.knoten.replace(/\/+$/, ''),
      titel: p.titel,
      kurz: p.kurz,
      ...(p.text ? { text: p.text } : {}),
    }))
    if (infopunkte.length > 0) raeume[raum] = { infopunkte }
  }
  return { version: 1, raeume }
}

/** Lädt `${basePath}/data/rauminfos.json`. Wirft nie. */
export async function ladeRauminfos(basePath: string): Promise<Rauminfos> {
  try {
    const res = await fetch(`${basePath}/data/rauminfos.json`)
    if (!res.ok) return LEERE_RAUMINFOS
    return leseRauminfos(await res.json())
  } catch {
    return LEERE_RAUMINFOS
  }
}

/** Die Infopunkte eines Raums (leer, wenn er keine hat). */
export function infopunkteVon(
  rauminfos: Rauminfos,
  raumId: string
): readonly Infopunkt[] {
  return Object.prototype.hasOwnProperty.call(rauminfos.raeume, raumId)
    ? rauminfos.raeume[raumId].infopunkte
    : []
}

/**
 * Gehört die Knoten-ID `id` (`ofen/tuer`) zum Anfang `knoten` (`ofen`)? Der
 * Anfang gilt abschnittsweise: `ofen` trifft `ofen` und `ofen/…`, nicht
 * `ofenrohr`. Die eine Regel für Infopunkte und Türen.
 */
export function gehoertZu(id: string, knoten: string): boolean {
  const anfang = knoten.replace(/\/+$/, '')
  return anfang !== '' && (id === anfang || id.startsWith(`${anfang}/`))
}

/** Der Eintrag mit dem längsten passenden `knoten` - der genaueste gewinnt. */
export function findeFuerKnoten<T extends { knoten: string }>(
  eintraege: readonly T[],
  id: string
): T | undefined {
  let best: T | undefined
  for (const eintrag of eintraege) {
    if (!gehoertZu(id, eintrag.knoten)) continue
    if (!best || eintrag.knoten.length > best.knoten.length) best = eintrag
  }
  return best
}

/** Präfix der Karten-id eines Infopunkts - nie die id eines Produkts. */
const INFO_ID = 'info:'

/** Ein Infopunkt als Inhalt der Karte. */
export function karteVon(punkt: Infopunkt): Karte {
  return {
    id: `${INFO_ID}${punkt.knoten}`,
    name: punkt.titel,
    kurztext: punkt.kurz,
    text: punkt.text ?? '',
  }
}

/** Ist das die Karte eines Infopunkts (und nicht die eines Produkts)? */
export function istInfoKarte(karte: Karte): boolean {
  return karte.id.startsWith(INFO_ID)
}

/** Eine Zeile in „Alles hier“ / im Ersatz ohne WebGL: `slot` ist der `knoten`. */
export interface InfoEintrag {
  slot: string
  produkt: Karte
}

/**
 * Die Infopunkte eines Blickpunkts: alle, deren `knoten` zu einem seiner
 * `moebel`-Präfixe gehört (`['ofen/']`) - wie bei den Plätzen der Produkte
 * (`eintraegeFuer`), in der Reihenfolge der Datei.
 */
export function infoEintraegeFuer(
  infopunkte: readonly Infopunkt[],
  moebel: readonly string[]
): InfoEintrag[] {
  return infopunkte
    .filter((p) => moebel.some((prefix) => gehoertZu(p.knoten, prefix)))
    .map((p) => ({ slot: p.knoten, produkt: karteVon(p) }))
}
