/**
 * Client der Rezepte (`/admin/rezepte`, `docs/domains/rezepte.md`).
 *
 *   GET    /api/recipes[?category=&q=]     Liste, Kategorien, Einheiten,
 *                                          `writable`, `canDelete`
 *   GET    /api/recipes/:category/:slug    ein Rezept (mit `version`)
 *   POST   /api/recipes                    anlegen → hq (rollende PR)
 *   PUT    /api/recipes/:category/:slug    ändern (`expectedVersion`)
 *   DELETE /api/recipes/:category/:slug    löschen (`expectedVersion`)
 *
 * Vertrag: `docs/api/recipes.md`. Fehler kommen als `ApiError` (Status,
 * `code`, deutsche `message`) beim Aufrufer an. Hier wird nichts gedeutet:
 * das Rezeptformat liest und schreibt allein die API
 * (`recipe-file.core.js`) - die Verwaltung zeigt ihr Modell.
 */

import { apiClient, ApiError } from '@bakery/shared/data-access'

const BASE = '/api/recipes'

/** Seiten der Rezepte - an einer Stelle, damit Links und Rollen übereinstimmen. */
export const RECIPES_HREF = '/admin/rezepte'
export const NEW_RECIPE_HREF = '/admin/rezepte/neu'

export type RecipeFormat = 'standard' | 'table' | 'teig' | 'unknown'

/** `null` = freigegeben; sonst wartet die Änderung in der hq-PR. */
export type RecipePending = null | 'created' | 'changed' | 'deleted'

export interface RecipeIngredient {
  name: string
  /** `null` = Menge offen - nie 0. */
  amount: number | null
  unit: string | null
  note: string | null
}

export interface RecipePart {
  /** `null` = unbenannter Teil. */
  title: string | null
  ingredients: RecipeIngredient[]
  /** Summenzeile der Datei - nur Anzeige, wird nie neu berechnet. */
  total: { label: string; text: string } | null
}

export interface RecipeStepGroup {
  title: string | null
  /** `true` = nummerierte Schritte, `false` = Stichpunkte. */
  ordered: boolean
  /** Ein Schritt ist ein Text; Unterpunkte sind eingerückte weitere Zeilen. */
  items: string[]
}

/** Wo der Backzettel ein Rezept verwendet (`config/backzettel.yaml`). */
export interface RecipeUse {
  kind: string
  id: string
  name: string
  section: string | null
}

export interface RecipeSummary {
  /** `<kategorie>/<kennung>` - zugleich der Pfad in der API und der App. */
  id: string
  category: string
  categoryLabel: string
  slug: string
  file: string
  /** Pfad in hq, z. B. `data/recipes/breads/Musterkruste.md`. */
  path: string
  format: RecipeFormat
  title: string
  /** Freitext der Datei; `null` = offen. */
  yield: string | null
  ingredientCount: number
  editable: boolean
  /** Deutsch, wenn `editable` falsch ist. */
  readOnlyReason: string | null
  pendingApproval: boolean
  pending: RecipePending
  usedByBackzettel: RecipeUse[]
}

export interface Recipe extends RecipeSummary {
  description: string | null
  parts: RecipePart[]
  steps: RecipeStepGroup[]
  /** Markdown-Text. */
  notes: string | null
  /** Rest des Dateikopfs (Backtemperatur …) - nur Anzeige. */
  meta: { key: string; label: string; value: string | null }[]
  /** Abschnitte, die das Modell nicht deutet - wörtlich, nur Anzeige. */
  sections: { title: string; text: string }[]
  /** Stand der Datei; geht als `expectedVersion` zurück. */
  version: string
  deletable: boolean
  deleteBlockedReason: string | null
}

export interface RecipeCategory {
  id: string
  label: string
  /** Anzahl ohne Filter. */
  count: number
  /** Ob die Verwaltung dort anlegen und ändern darf (`teige`: nein). */
  writable: boolean
}

export interface RecipeList {
  status: 'ok' | 'no-data'
  message?: string
  categories: RecipeCategory[]
  recipes: RecipeSummary[]
  count: number
  /** Was `unit` annimmt. */
  units: string[]
  /** Ob der Server speichern kann (sagt nichts über die Rolle). */
  writable: boolean
  writeIssue: { error: string; message: string } | null
  /** Ob Löschen und Verschieben eingeschaltet sind. */
  canDelete: boolean
  deleteIssue: string | null
}

/** Eine Zutat, wie die API sie beim Speichern annimmt. */
export type RecipeIngredientInput = RecipeIngredient

export interface RecipeInput {
  title?: string
  category?: string
  yield?: string | null
  description?: string | null
  parts?: { title: string | null; ingredients: RecipeIngredientInput[] }[]
  steps?: RecipeStepGroup[]
  notes?: string | null
}

export interface RecipeWriteResult {
  recipe: Recipe
  /** Die Änderung wartet jetzt in der hq-PR auf Freigabe. */
  pending: boolean
  /** `false` = das Speichern hat nichts geändert (nichts geschrieben). */
  changed: boolean
}

function unwrap<T>(res: { data?: T } | undefined): T {
  if (!res || res.data === undefined || res.data === null) {
    throw new Error('Leere Antwort vom Server.')
  }
  return res.data
}

/** `breads/musterkruste` → `breads`, `musterkruste`; sonst `null`. */
export function splitRecipeId(
  id: string
): { category: string; slug: string } | null {
  const parts = id.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { category: parts[0], slug: parts[1] }
}

function apiPath(category: string, slug: string): string {
  return `${BASE}/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`
}

/** Seite eines Rezepts (Ansicht). */
export function recipeHref(recipe: { category: string; slug: string }): string {
  return `${RECIPES_HREF}/${encodeURIComponent(
    recipe.category
  )}/${encodeURIComponent(recipe.slug)}`
}

/** Formular zum Ändern eines Rezepts. */
export function recipeEditHref(recipe: {
  category: string
  slug: string
}): string {
  return `${RECIPES_HREF}/bearbeiten/${encodeURIComponent(
    recipe.category
  )}/${encodeURIComponent(recipe.slug)}`
}

export async function fetchRecipes(
  filter: { category?: string | null; q?: string | null } = {}
): Promise<RecipeList> {
  return unwrap(
    await apiClient.get<RecipeList>(BASE, {
      category: filter.category || undefined,
      q: filter.q?.trim() || undefined,
    })
  )
}

/** Ein Rezept; `null`, wenn die API 404 antwortet. */
export async function fetchRecipe(
  category: string,
  slug: string
): Promise<Recipe | null> {
  try {
    return unwrap(await apiClient.get<Recipe>(apiPath(category, slug)))
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

function writeResult(res: unknown): RecipeWriteResult {
  const body = res as { data?: Recipe; pending?: unknown; changed?: unknown }
  return {
    recipe: unwrap(body),
    pending: body.pending === true,
    changed: body.changed === true,
  }
}

export async function createRecipe(
  input: RecipeInput & { title: string; category: string }
): Promise<RecipeWriteResult> {
  return writeResult(await apiClient.post<Recipe>(BASE, input))
}

export async function updateRecipe(
  recipe: { category: string; slug: string },
  expectedVersion: string,
  input: RecipeInput
): Promise<RecipeWriteResult> {
  return writeResult(
    await apiClient.put<Recipe>(apiPath(recipe.category, recipe.slug), {
      expectedVersion,
      ...input,
    })
  )
}

export async function deleteRecipe(
  recipe: { category: string; slug: string },
  expectedVersion: string
): Promise<{ pending: boolean }> {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    `${apiPath(
      recipe.category,
      recipe.slug
    )}?expectedVersion=${encodeURIComponent(expectedVersion)}`
  )
  return { pending: (res as { pending?: unknown })?.pending === true }
}

// ---------------------------------------------------------------- Anzeige

/** Text für eine fehlende Angabe - nie 0, nie ein Beispielwert. */
export const OPEN_LABEL = 'offen'

export const PENDING_LABELS: Record<Exclude<RecipePending, null>, string> = {
  created: 'neu · wartet auf Freigabe',
  changed: 'wartet auf Freigabe',
  deleted: 'gelöscht · wartet auf Freigabe',
}

/** Ein Satz zum Freigabe-Stand eines Rezepts (leer = freigegeben). */
export function pendingHint(pending: RecipePending): string {
  switch (pending) {
    case 'created':
      return 'Neues Rezept - gespeichert, wartet auf die Freigabe in hq.'
    case 'changed':
      return 'Diese Änderung ist gespeichert und wartet auf die Freigabe in hq.'
    case 'deleted':
      return 'Dieses Rezept wurde gelöscht. Es bleibt bis zur Freigabe in hq in der Liste und ist nur noch zum Ansehen.'
    default:
      return ''
  }
}

/** Wo der Backzettel das Rezept verwendet - als Aufzählung für einen Satz. */
export function backzettelUseText(uses: readonly RecipeUse[]): string {
  const names = Array.from(
    new Set(uses.map((use) => use.name || use.section || use.id))
  )
  return names.map((name) => `„${name}“`).join(', ')
}

/** Zahl deutsch: `0.5` → „0,5“, `1400` → „1.400“ (höchstens 3 Nachkommastellen). */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}

/**
 * Bei offener Menge kann der Hinweis der Datei selbst die Mengenangabe sein
 * („3–6 g (nach Geschmack)“, „1 Dose (ca. 3 kg)“) - erkennbar an einer
 * Ziffer. Ein Hinweis ohne Zahl („zum Bestreichen“, „nach Geschmack“) ist
 * keine Menge: die bleibt dann „offen“.
 */
function noteIsQuantity(ingredient: RecipeIngredient): boolean {
  return (
    ingredient.amount === null &&
    ingredient.note !== null &&
    /\d/.test(ingredient.note)
  )
}

/** Ob in der Mengenspalte „offen“ steht (keine Zahl, kein Mengentext). */
export function ingredientAmountOpen(ingredient: RecipeIngredient): boolean {
  return ingredient.amount === null && !noteIsQuantity(ingredient)
}

/**
 * Menge einer Zutat für die Anzeige: „1.400 g“, „4“ (Stückzahl ohne
 * Einheit), bei offener Menge der Mengentext der Datei („3–6 g (nach
 * Geschmack)“) oder „offen“ - nie ein Hinweis ohne Zahl an Stelle der Menge.
 */
export function ingredientAmountText(ingredient: RecipeIngredient): string {
  if (ingredient.amount === null) {
    return noteIsQuantity(ingredient) ? (ingredient.note as string) : OPEN_LABEL
  }
  const amount = formatAmount(ingredient.amount)
  return ingredient.unit ? `${amount} ${ingredient.unit}` : amount
}

/** Der Hinweis neben dem Namen - nur, wenn er nicht schon als Menge steht. */
export function ingredientNoteText(
  ingredient: RecipeIngredient
): string | null {
  return noteIsQuantity(ingredient) ? null : ingredient.note || null
}

/**
 * „Ergibt: 3 Laibe à 700g“ bzw. „Ergibt: offen“. Manche Dateien schreiben
 * das Wort schon selbst („Ergibt ca. 16 Fladen“) - dann steht es nur einmal.
 */
export function yieldText(value: string | null): string {
  if (value === null || value.trim() === '') return `Ergibt: ${OPEN_LABEL}`
  return /^ergibt\b/i.test(value.trim()) ? value.trim() : `Ergibt: ${value}`
}

/** „13 Zutaten“ / „1 Zutat“ / „keine Zutaten“. */
export function ingredientCountText(count: number): string {
  if (count === 0) return 'keine Zutaten'
  return count === 1 ? '1 Zutat' : `${count} Zutaten`
}
