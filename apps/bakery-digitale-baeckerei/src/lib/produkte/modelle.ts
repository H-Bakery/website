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

export interface ProduktModellIndex {
  version: 1
  /** Schlüssel = hq-ID ohne Nummer (wie `ProduktInfo.id`) */
  modelle: Record<string, ProduktModell>
}

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
  return { version: 1, modelle }
}

/**
 * Lädt `${basePath}/data/produkte-3d.json`. Wirft nie: Ohne Index gibt es
 * keine Nahansicht, das ist kein Fehler der App.
 */
export async function ladeModellIndex(
  basePath: string
): Promise<ProduktModellIndex> {
  try {
    const res = await fetch(`${basePath}/data/produkte-3d.json`)
    if (!res.ok) return LEERER_MODELL_INDEX
    return leseModellIndex(await res.json())
  } catch {
    return LEERER_MODELL_INDEX
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
