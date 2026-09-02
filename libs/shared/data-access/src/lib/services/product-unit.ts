/**
 * @fileoverview Verkaufseinheit hinter dem Preis: „pro Stück“, „pro Kuchen“, „pro Torte“.
 * @module @bakery/shared/data-access/product-unit
 *
 * In dieser Bäckerei heißt „Stück“ ein Portionsstück: „Apfelkuchen (1 Stück)“
 * kostet 1,80 €, der ganze „Apfelkuchen“ 18 €. Stand hinter beiden „pro Stück“,
 * las sich der teuerste Artikel der Kategorie wie ein Tortenstück für 18 € —
 * direkt neben dem echten Stück für 1,80 €.
 *
 * `hq` führt keine Verkaufseinheit; sie steckt, wie das Gewicht für den
 * Grundpreis, nur im Namen und in der Kategorie. Die Regeln stehen deshalb
 * genau hier, in einer Tabelle, und nirgends sonst. Karte, Detailseite und
 * Warenkorb (`toCartProduct`) fragen alle diese eine Funktion.
 */

/** Wofür der Preis gilt. Steht direkt hinter „pro“, also im Singular. */
export type ShopUnit = 'Stück' | 'Kuchen' | 'Torte' | 'Rolle'

/**
 * Nur in diesen Kategorien werden ganze Kuchen, Torten und Rollen verkauft.
 * Ein „Butterkuchen“ aus den Teilchen ist ein Teilchen — ein Stück.
 */
const WHOLE_ITEM_CATEGORIES: ReadonlySet<string> = new Set(['kuchen', 'torten'])

/** „(1 Stück)“, „(1/4 Stück)“ — ein Portionsstück, egal aus welcher Kategorie. */
const PORTION_IN_NAME = /\bStück\b/i

/**
 * Was ein ganzer Artikel ist, in der Reihenfolge der Prüfung.
 * `\b` hält „Tortenboden“ von „Torte“ fern; `rollen?` fängt „Sahnerollen“.
 */
const WHOLE_ITEM_RULES: ReadonlyArray<readonly [RegExp, ShopUnit]> = [
  [/torte\b/i, 'Torte'],
  [/kuchen\b/i, 'Kuchen'],
  [/rollen?\b/i, 'Rolle'],
]

/**
 * Die Verkaufseinheit eines Produkts, wie sie hinter „pro“ steht.
 *
 * Bewusst über Name und Kategorie, nicht über den Preis: eine Preisschwelle
 * würde bei der nächsten Preisänderung still kippen.
 *
 * @returns `'Stück'` für alles, was nicht erkennbar ein ganzer Kuchen, eine
 * ganze Torte oder eine ganze Rolle ist — Zopf, Rosinenbrot, Obstboden und
 * Tortenboden eingeschlossen, denn dort ist das Stück das Ganze.
 */
export function productUnit(product: {
  name: string
  category?: string | null
}): ShopUnit {
  const name = typeof product?.name === 'string' ? product.name : ''
  if (PORTION_IN_NAME.test(name)) return 'Stück'

  const category = typeof product?.category === 'string' ? product.category : ''
  if (!WHOLE_ITEM_CATEGORIES.has(category)) return 'Stück'

  for (const [pattern, unit] of WHOLE_ITEM_RULES) {
    if (pattern.test(name)) return unit
  }
  return 'Stück'
}
