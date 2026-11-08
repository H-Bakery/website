import type {
  BackzettelDeltaEntry,
  BackzettelLineDelta,
  BackzettelUserRef,
  BakeList,
} from './backzettelApi'

/**
 * Nachträge einer Zeile auf der Backliste mit ihrem „gebacken“-Haken (Z10,
 * Inhaber-Entscheidung O5, 2026-11-08). Jeder Nachtrag hat seinen eigenen
 * Haken auf dem Server; das Tablet zeigt sie je Zeile zusammen - ein Tippen
 * hakt alle noch nicht gebackenen dieser Zeile ab bzw. nimmt, wenn alle
 * gebacken sind, alle zurück. Gerechnet wird nichts Neues: die große Zahl
 * ist das Aufgerundete vom Server (`delta.bake` / `delta.bakeUnbaked`),
 * sonst (ältere Server, Nachtrag ohne Zeile) die Summe.
 */
export interface BakeDeltaGroup {
  key: string
  first: BackzettelDeltaEntry
  deltas: BackzettelDeltaEntry[]
  /** Summe aller Nachträge der Zeile. */
  qty: number
  /** `open`: keiner gebacken, `partial`: ein später gekommener ist offen. */
  state: 'open' | 'partial' | 'baked'
  /** Große Zahl: was noch zu backen ist (offen/teils) bzw. was gebacken wurde. */
  figure: number
  /** Schon gebacken (nur `partial`): so viel. */
  bakedFigure: number | null
  /** Ein Haken nur, wo es etwas zu backen gibt (nicht bei „−3“ / „±0“). */
  tickable: boolean
  /** Was ein Tippen ändert: diese IDs auf `toggleTo`. */
  toggleIds: number[]
  toggleTo: boolean
  /** Letzter gebacken-Haken der Zeile (Anzeige „gebacken 05:10 · Name“). */
  bakedAt: string | null
  bakedBy: BackzettelUserRef | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sumQty(deltas: BackzettelDeltaEntry[]): number {
  return round2(deltas.reduce((s, d) => s + (Number(d.qty) || 0), 0))
}

/** Die Nachtrag-Gruppen einer Backliste, Reihenfolge wie die erste Änderung. */
export function bakeDeltaGroups(
  list: Pick<BakeList, 'deltas' | 'sections'>
): BakeDeltaGroup[] {
  const lineDeltas = new Map<string, BackzettelLineDelta>()
  for (const s of list.sections) {
    for (const l of s.lines) if (l.delta) lineDeltas.set(l.key, l.delta)
  }
  const byKey = new Map<string, BackzettelDeltaEntry[]>()
  for (const d of list.deltas) {
    byKey.set(d.key, [...(byKey.get(d.key) ?? []), d])
  }
  return Array.from(byKey.entries()).map(([key, deltas]) => {
    const baked = deltas.filter((d) => !!d.bakedAt)
    const unbaked = deltas.filter((d) => !d.bakedAt)
    const qty = sumQty(deltas)
    const line = lineDeltas.get(key)
    // Nur wenn die Zeile dieselben Nachträge meint, ihre Zahlen nehmen.
    const sameLine = !!line && line.qty === qty && line.count === deltas.length
    const total = sameLine && typeof line?.bake === 'number' ? line.bake : qty
    const state: BakeDeltaGroup['state'] =
      baked.length === 0 ? 'open' : unbaked.length === 0 ? 'baked' : 'partial'
    let figure = total
    let bakedFigure: number | null = null
    if (state === 'partial') {
      const serverOpen =
        sameLine &&
        typeof line?.bakeUnbaked === 'number' &&
        line.bakedQty === sumQty(baked)
          ? line.bakeUnbaked
          : null
      figure = serverOpen ?? sumQty(unbaked)
      bakedFigure = round2(total - figure)
    }
    const last = baked.reduce<BackzettelDeltaEntry | null>(
      (latest, d) =>
        !latest || (d.bakedAt ?? '') > (latest.bakedAt ?? '') ? d : latest,
      null
    )
    return {
      key,
      first: deltas[0],
      deltas,
      qty,
      state,
      figure,
      bakedFigure,
      tickable: state === 'baked' || figure > 0,
      toggleIds: (state === 'baked' ? baked : unbaked).map((d) => d.id),
      toggleTo: state !== 'baked',
      bakedAt: last?.bakedAt ?? null,
      bakedBy: last?.bakedBy ?? null,
    }
  })
}
