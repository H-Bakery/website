import type { ListenZeile } from '../lib/karte'

/**
 * Leerer Abschnitt in „Alles hier“ und im Ersatz ohne WebGL. Bewusst nicht
 * „hier liegt nichts“: An den Regalen steht Ware, zu der es (noch) keine
 * Produktinfos gibt - der Text behauptet nur, was die Daten hergeben.
 */
export const KEINE_PRODUKTINFOS_TEXT =
  'Für diesen Bereich gibt es noch keine Produktinfos.'

/**
 * Leerer Abschnitt in einem Raum ohne Produkte (Backstube): Dort gibt es nur
 * Infopunkte - und für diesen Bereich (noch) keine.
 */
export const KEINE_INFOS_TEXT = 'Für diesen Bereich gibt es noch keine Infos.'

/**
 * Macht aus den belegten Plätzen eine Produktliste: Dasselbe Produkt auf
 * mehreren Plätzen wird eine Zeile (der erste Platz bleibt), sortiert nach Name.
 * Infopunkte laufen genauso mit (jeder hat seine eigene id). Die einzige
 * Stelle für diese Regel - „Alles hier“ und der Ersatz ohne WebGL nutzen
 * beide sie.
 */
export function gruppiereEintraege<T extends ListenZeile>(
  eintraege: readonly T[]
): T[] {
  const jeProdukt = new Map<string, T>()
  for (const eintrag of eintraege) {
    if (!jeProdukt.has(eintrag.produkt.id)) {
      jeProdukt.set(eintrag.produkt.id, eintrag)
    }
  }
  return [...jeProdukt.values()].sort((a, b) =>
    a.produkt.name.localeCompare(b.produkt.name, 'de')
  )
}
