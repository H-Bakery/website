/**
 * Index der 3D-Modelle einzelner Produkte für die Nahansicht („In 3D
 * ansehen“): `public/data/produkte-3d.json`, beim Bauen geschrieben von
 * scripts/sync-produkte-3d.mjs aus dem Daten-Repo `produkte-3d`.
 *
 * Die Nahansicht ist eine Zugabe: Fehlt der Index, ist er leer oder nicht
 * lesbar, gibt es schlicht keine - der Laden läuft unverändert weiter. Ein
 * Produkt ohne Eintrag bekommt keinen Knopf (kein Ersatzmodell).
 */

export interface ProduktModell {
  /** Pfad der GLB-Datei relativ zum Basis-Pfad, z. B. `produkte-3d/testbrot-500g.glb` */
  datei: string
  /** Größe in Bytes, für die Fortschrittsanzeige */
  bytes: number
  /** Rahmen des Modells in Metern (Y nach oben, steht auf y = 0) */
  bbox_m: { min: number[]; max: number[] }
}

/** Ein leichtes Regal-Modell (DB12): sein Rahmen in Metern, y oben, steht auf y = 0. */
export interface RegalModell {
  bbox_m: { min: number[]; max: number[] }
  dreiecke: number
}

/** Alle Regal-Modelle liegen in einer Datei (scripts/regal-modelle.js). */
export interface RegalPaket {
  /** Pfad relativ zum Basis-Pfad: `produkte-3d/_regal.glb` */
  datei: string
  bytes: number
  /** Schlüssel = hq-ID ohne Nummer = Name des Meshes im Paket */
  modelle: Record<string, RegalModell>
}

export interface ProduktModellIndex {
  version: 1
  /** Schlüssel = hq-ID ohne Nummer (wie `ProduktInfo.id`) */
  modelle: Record<string, ProduktModell>
  /** Nur wenn es Regal-Modelle gibt - sonst zeigt der Laden die Ware seines Modells. */
  regal?: RegalPaket
}

/** Die eine Datei, die ein Regal-Paket sein darf. */
export const REGAL_DATEI = 'produkte-3d/_regal.glb'

export const LEERER_MODELL_INDEX: ProduktModellIndex = {
  version: 1,
  modelle: {},
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const istVec3 = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n))

function istModell(v: unknown): v is ProduktModell {
  return (
    isRecord(v) &&
    typeof v.datei === 'string' &&
    // Nur eine Datei aus dem eigenen Ordner - nie eine fremde Adresse.
    /^produkte-3d\/[a-z0-9]+(-[a-z0-9]+)*\.glb$/.test(v.datei) &&
    typeof v.bytes === 'number' &&
    Number.isFinite(v.bytes) &&
    v.bytes > 0 &&
    isRecord(v.bbox_m) &&
    istVec3(v.bbox_m.min) &&
    istVec3(v.bbox_m.max)
  )
}

/**
 * Liest einen Index tolerant: Einträge, die nicht dem Vertrag entsprechen,
 * fallen weg; eine unbekannte Form ergibt den leeren Index.
 */
export function leseModellIndex(raw: unknown): ProduktModellIndex {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.modelle)) {
    return LEERER_MODELL_INDEX
  }
  const modelle: Record<string, ProduktModell> = {}
  for (const [id, eintrag] of Object.entries(raw.modelle)) {
    if (istModell(eintrag)) {
      modelle[id] = {
        datei: eintrag.datei,
        bytes: eintrag.bytes,
        bbox_m: { min: [...eintrag.bbox_m.min], max: [...eintrag.bbox_m.max] },
      }
    }
  }
  const regal = leseRegalPaket(raw.regal)
  return regal ? { version: 1, modelle, regal } : { version: 1, modelle }
}

function leseRegalPaket(raw: unknown): RegalPaket | undefined {
  if (
    !isRecord(raw) ||
    // Nur die eigene Datei - nie eine fremde Adresse.
    raw.datei !== REGAL_DATEI ||
    typeof raw.bytes !== 'number' ||
    !(raw.bytes > 0) ||
    !isRecord(raw.modelle)
  ) {
    return undefined
  }
  const modelle: Record<string, RegalModell> = {}
  for (const [id, eintrag] of Object.entries(raw.modelle)) {
    if (
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) &&
      isRecord(eintrag) &&
      isRecord(eintrag.bbox_m) &&
      istVec3(eintrag.bbox_m.min) &&
      istVec3(eintrag.bbox_m.max) &&
      typeof eintrag.dreiecke === 'number'
    ) {
      modelle[id] = {
        bbox_m: { min: [...eintrag.bbox_m.min], max: [...eintrag.bbox_m.max] },
        dreiecke: eintrag.dreiecke,
      }
    }
  }
  if (Object.keys(modelle).length === 0) return undefined
  return { datei: REGAL_DATEI, bytes: raw.bytes, modelle }
}

/** So lange darf der Index auf sich warten lassen (wie die Produktdaten). */
export const MODELL_INDEX_ZEIT_MS = 8000

/**
 * Lädt `${basePath}/data/produkte-3d.json`. Wirft nie: Ohne Index gibt es
 * keine Nahansicht, das ist kein Fehler der App.
 */
export async function ladeModellIndex(
  basePath: string
): Promise<ProduktModellIndex> {
  let uhr: ReturnType<typeof setTimeout> | undefined
  // Die Szene wartet vor dem ersten Bild auch auf diesen Index (Regal-Modelle,
  // DB12): Hängt die Anfrage, gibt es nach kurzer Zeit eben keine Modelle.
  const zuSpaet = new Promise<null>((fertig) => {
    uhr = setTimeout(() => fertig(null), MODELL_INDEX_ZEIT_MS)
  })
  try {
    const laden = async (): Promise<ProduktModellIndex> => {
      const res = await fetch(`${basePath}/data/produkte-3d.json`)
      if (!res.ok) return LEERER_MODELL_INDEX
      return leseModellIndex(await res.json())
    }
    return (await Promise.race([laden(), zuSpaet])) ?? LEERER_MODELL_INDEX
  } catch {
    return LEERER_MODELL_INDEX
  } finally {
    clearTimeout(uhr)
  }
}

/** Das Modell zu einem Produkt, wenn es eines gibt. */
export function modellFuer(
  index: ProduktModellIndex,
  produktId: string
): ProduktModell | undefined {
  // hasOwnProperty: eine ID wie `toString` darf nichts aus dem Prototyp treffen.
  return Object.prototype.hasOwnProperty.call(index.modelle, produktId)
    ? index.modelle[produktId]
    : undefined
}

/** Adresse der GLB-Datei eines Modells. */
export function modellAdresse(modell: ProduktModell, basePath: string): string {
  return `${basePath}/${modell.datei}`
}
