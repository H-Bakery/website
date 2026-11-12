/**
 * Was die Rezept-Seiten aus der Adresse lesen - ohne `'use client'`, damit
 * die Server-Hüllen (`page.tsx`) es aufrufen können.
 *
 *   /admin/rezepte?kategorie=breads&q=mehl      Filter der Liste
 *   /admin/rezepte?geloescht=<Name>[&wartet=1]  Hinweis nach dem Löschen
 *   /admin/rezepte/<kat>/<kennung>?gespeichert=…  Hinweis nach dem Speichern
 *   /admin/rezepte/neu?kategorie=breads         Vorauswahl der Kategorie
 */

export type RecipeQuery = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value : ''

export interface RecipeListFilters {
  category: string | null
  q: string
}

export function recipeFiltersFromQuery(query: RecipeQuery): RecipeListFilters {
  return { category: one(query['kategorie']) || null, q: one(query['q']) }
}

/** Was nach dem Löschen oben auf der Liste steht. */
export interface RecipeListFlash {
  /** Name des gelöschten Rezepts. */
  deleted: string
  /** Die Löschung wartet auf Freigabe in hq. */
  pending: boolean
}

export function recipeListFlashFromQuery(
  query: RecipeQuery
): RecipeListFlash | null {
  const deleted = one(query['geloescht']).trim().slice(0, 200)
  return deleted ? { deleted, pending: one(query['wartet']) === '1' } : null
}

/** Was nach dem Speichern oben auf dem Rezept steht (`?gespeichert=`). */
export const RECIPE_SAVED_TEXT = {
  angelegt: 'Rezept angelegt.',
  'angelegt-wartet':
    'Rezept angelegt - es wartet jetzt auf die Freigabe in hq.',
  gespeichert: 'Gespeichert.',
  'gespeichert-wartet':
    'Gespeichert - die Änderung wartet jetzt auf die Freigabe in hq.',
} as const

export type RecipeSavedFlash = keyof typeof RECIPE_SAVED_TEXT

export function recipeSavedFlashFromQuery(
  query: RecipeQuery
): RecipeSavedFlash | null {
  const value = one(query['gespeichert'])
  return Object.prototype.hasOwnProperty.call(RECIPE_SAVED_TEXT, value)
    ? (value as RecipeSavedFlash)
    : null
}

/** Der Hinweis für die Adresse nach einem Schreibvorgang. */
export function recipeSavedFlash(
  action: 'angelegt' | 'gespeichert',
  pending: boolean
): RecipeSavedFlash {
  return pending ? `${action}-wartet` : action
}
