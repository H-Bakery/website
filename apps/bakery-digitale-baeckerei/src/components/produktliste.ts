import type { ListenEintrag } from './typen'

/**
 * Macht aus den belegten Plätzen eine Produktliste: Dasselbe Produkt auf
 * mehreren Plätzen wird eine Zeile (der erste Platz bleibt), sortiert nach Name.
 * Die einzige Stelle für diese Regel - „Alles hier“ und der Ersatz ohne WebGL
 * nutzen beide sie.
 */
export function gruppiereEintraege(
  eintraege: ListenEintrag[]
): ListenEintrag[] {
  const jeProdukt = new Map<string, ListenEintrag>()
  for (const eintrag of eintraege) {
    if (!jeProdukt.has(eintrag.produkt.id)) {
      jeProdukt.set(eintrag.produkt.id, eintrag)
    }
  }
  return [...jeProdukt.values()].sort((a, b) =>
    a.produkt.name.localeCompare(b.produkt.name, 'de')
  )
}
