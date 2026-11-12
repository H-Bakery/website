/**
 * Formular-Modell der Rezepte (`/admin/rezepte/neu`, `…/bearbeiten/…`).
 *
 * Das Formular arbeitet auf Texten (Menge „0,5“, leeres Feld = offen); beim
 * Speichern entsteht daraus die Eingabe der API. Zwei Regeln, damit ein
 * Speichern ohne Änderung in hq nichts ändert (`docs/domains/rezepte.md`,
 * „Null-Diff“):
 *
 * - **Unberührtes geht unverändert zurück.** Eine Zeile, deren Felder noch so
 *   dastehen wie geladen, schickt die Zutat der API zurück, nicht eine neu
 *   gelesene - die API prüft unveränderte Werte nicht noch einmal.
 * - **Nur Geändertes wird geschickt.** `changedInput()` lässt jedes Feld weg,
 *   das dem geladenen Rezept entspricht (ein fehlendes Feld heißt „bleibt“).
 *
 * Geprüft wird hier nur, was die Eingabe unklar macht (Menge keine Zahl,
 * Einheit ohne Menge, Zutat ohne Namen). Alles Weitere prüft die API und
 * antwortet mit einer deutschen Meldung.
 */

import type {
  Recipe,
  RecipeIngredient,
  RecipeInput,
  RecipePart,
  RecipeStepGroup,
} from './recipesApi'

export interface IngredientRow {
  key: string
  /** Text des Mengenfelds; leer = offen. */
  amount: string
  /** `''` = ohne Einheit (Stückzahl). */
  unit: string
  name: string
  note: string
  /** Die Zutat, wie sie geladen wurde; `null` = neue Zeile. */
  original: RecipeIngredient | null
}

export interface PartForm {
  key: string
  title: string
  rows: IngredientRow[]
  /** Summenzeile der Datei - bleibt wörtlich, nur zur Information. */
  total: RecipePart['total']
  /** Aus der Datei geladen - bleibt auch leer erhalten (neue leere fallen weg). */
  existing: boolean
}

export interface StepForm {
  key: string
  text: string
}

export interface StepGroupForm {
  key: string
  title: string
  ordered: boolean
  items: StepForm[]
  /** Aus der Datei geladen - bleibt auch leer erhalten. */
  existing: boolean
}

export interface RecipeFormValues {
  title: string
  category: string
  /** „Ergibt“; leer = offen. */
  yield: string
  description: string
  parts: PartForm[]
  steps: StepGroupForm[]
  notes: string
}

let counter = 0
/** Schlüssel für React-Listen - stabil über Umsortieren hinweg. */
export function nextKey(prefix = 'k'): string {
  counter += 1
  return `${prefix}${counter}`
}

/** Menge für das Eingabefeld: `0.5` → „0,5“, `1400` → „1400“, offen → leer. */
export function amountInputText(amount: number | null): string {
  return amount === null ? '' : String(amount).replace('.', ',')
}

export type AmountParse =
  | { ok: true; value: number | null }
  | { ok: false; message: string }

/**
 * Mengenfeld lesen: leer = offen (`null`), sonst eine Zahl größer 0 mit
 * Komma oder Punkt, höchstens drei Nachkommastellen. Ein Tausenderpunkt
 * („1.350“) wird nicht geraten - die Meldung sagt, wie es geht.
 */
export function parseAmount(text: string): AmountParse {
  const raw = text.trim()
  if (raw === '') return { ok: true, value: null }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    return {
      ok: false,
      message: 'Bitte ohne Tausenderpunkt eingeben (z. B. 1350).',
    }
  }
  const normalized = raw.replace(',', '.')
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    return {
      ok: false,
      message:
        'Bitte eine Zahl eingeben (z. B. 250 oder 0,5) - leer lassen heißt „offen“.',
    }
  }
  const value = Number(normalized)
  if (!(value > 0)) {
    return {
      ok: false,
      message:
        'Die Menge muss größer als 0 sein - eine unbekannte Menge bleibt leer (offen).',
    }
  }
  return { ok: true, value }
}

export function newIngredientRow(): IngredientRow {
  return {
    key: nextKey('z'),
    amount: '',
    unit: '',
    name: '',
    note: '',
    original: null,
  }
}

function rowOf(ingredient: RecipeIngredient): IngredientRow {
  return {
    key: nextKey('z'),
    amount: amountInputText(ingredient.amount),
    unit: ingredient.unit ?? '',
    name: ingredient.name,
    note: ingredient.note ?? '',
    original: ingredient,
  }
}

export function newPart(title = ''): PartForm {
  return {
    key: nextKey('g'),
    title,
    rows: [newIngredientRow()],
    total: null,
    existing: false,
  }
}

export function newStepGroup(ordered = true): StepGroupForm {
  return {
    key: nextKey('a'),
    title: '',
    ordered,
    items: [{ key: nextKey('s'), text: '' }],
    existing: false,
  }
}

/** Leeres Formular für „Neues Rezept“. */
export function emptyRecipeForm(category: string): RecipeFormValues {
  return {
    title: '',
    category,
    yield: '',
    description: '',
    parts: [newPart()],
    steps: [newStepGroup()],
    notes: '',
  }
}

/** Formular aus einem geladenen Rezept. */
export function formFromRecipe(recipe: Recipe): RecipeFormValues {
  return {
    title: recipe.title,
    category: recipe.category,
    yield: recipe.yield ?? '',
    description: recipe.description ?? '',
    parts: recipe.parts.map((part) => ({
      key: nextKey('g'),
      title: part.title ?? '',
      rows: part.ingredients.map(rowOf),
      total: part.total,
      existing: true,
    })),
    steps: recipe.steps.map((group) => ({
      key: nextKey('a'),
      title: group.title ?? '',
      ordered: group.ordered,
      items: group.items.map((text) => ({ key: nextKey('s'), text })),
      existing: true,
    })),
    notes: recipe.notes ?? '',
  }
}

/** Ob die Zeile noch so dasteht, wie sie geladen wurde. */
function rowUntouched(row: IngredientRow): boolean {
  const original = row.original
  return (
    original !== null &&
    row.amount === amountInputText(original.amount) &&
    row.unit === (original.unit ?? '') &&
    row.name === original.name &&
    row.note === (original.note ?? '')
  )
}

/** Eine ganz leere Zeile - fällt beim Speichern weg. */
export function isEmptyRow(row: IngredientRow): boolean {
  return (
    row.amount.trim() === '' && row.name.trim() === '' && row.note.trim() === ''
  )
}

/** Ein Problem einer Zutatenzeile: welches Feld, und warum. */
export interface RowProblem {
  field: 'amount' | 'unit' | 'name'
  message: string
}

/** Warum eine Zeile so nicht gespeichert werden kann; `null` = in Ordnung. */
export function rowProblem(row: IngredientRow): RowProblem | null {
  if (rowUntouched(row) || isEmptyRow(row)) return null
  const amount = parseAmount(row.amount)
  if (!amount.ok) return { field: 'amount', message: amount.message }
  if (row.name.trim() === '') {
    return { field: 'name', message: 'Der Name der Zutat fehlt.' }
  }
  if (amount.value === null && row.unit !== '') {
    return {
      field: 'unit',
      message:
        'Zur Einheit fehlt die Menge - Menge eintragen oder die Einheit auf „–“ stellen.',
    }
  }
  return null
}

export interface FormProblems {
  title: string | null
  /** Zeilenschlüssel → Problem. */
  rows: Record<string, RowProblem>
  /** Anzahl aller Probleme. */
  count: number
}

export function formProblems(values: RecipeFormValues): FormProblems {
  const rows: Record<string, RowProblem> = {}
  for (const part of values.parts) {
    for (const row of part.rows) {
      const problem = rowProblem(row)
      if (problem) rows[row.key] = problem
    }
  }
  const title =
    values.title.trim() === ''
      ? 'Bitte einen Namen für das Rezept angeben.'
      : null
  return { title, rows, count: Object.keys(rows).length + (title ? 1 : 0) }
}

function ingredientOf(row: IngredientRow): RecipeIngredient | null {
  if (rowUntouched(row)) return row.original
  if (isEmptyRow(row)) return null
  const amount = parseAmount(row.amount)
  const value = amount.ok ? amount.value : null
  return {
    name: row.name.trim(),
    amount: value,
    unit: value === null ? null : row.unit || null,
    note: row.note.trim() || null,
  }
}

function titleOf(text: string): string | null {
  const title = text.trim()
  return title === '' ? null : title
}

type PartInput = NonNullable<RecipeInput['parts']>[number]

function partsOf(values: RecipeFormValues): PartInput[] {
  return values.parts.flatMap((part) => {
    const title = titleOf(part.title)
    const ingredients = part.rows
      .map(ingredientOf)
      .filter((ing): ing is RecipeIngredient => ing !== null)
    // Eine neu hinzugefügte, leer gebliebene Gruppe fällt weg.
    if (!part.existing && title === null && ingredients.length === 0) return []
    return [{ title, ingredients }]
  })
}

function stepsOf(values: RecipeFormValues): RecipeStepGroup[] {
  return values.steps.flatMap((group) => {
    const title = titleOf(group.title)
    const items = group.items
      .map((item) => item.text)
      .filter((text) => text.trim() !== '')
    if (!group.existing && title === null && items.length === 0) return []
    return [{ title, ordered: group.ordered, items }]
  })
}

function textOf(text: string): string | null {
  return text.trim() === '' ? null : text
}

/** Die ganze Eingabe - für ein neues Rezept. */
export function fullInput(
  values: RecipeFormValues
): RecipeInput & { title: string; category: string } {
  return {
    title: values.title.trim(),
    category: values.category,
    yield: titleOf(values.yield),
    description: textOf(values.description),
    parts: partsOf(values),
    steps: stepsOf(values),
    notes: textOf(values.notes),
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Nur was sich gegenüber `recipe` geändert hat - für `PUT`. Ein leeres
 * Ergebnis heißt: nichts geändert.
 */
export function changedInput(
  values: RecipeFormValues,
  recipe: Recipe
): RecipeInput {
  const out: RecipeInput = {}
  if (values.title.trim() !== recipe.title) out.title = values.title.trim()
  if (values.category !== recipe.category) out.category = values.category
  if (values.yield !== (recipe.yield ?? '')) out.yield = titleOf(values.yield)
  if (values.description !== (recipe.description ?? '')) {
    out.description = textOf(values.description)
  }
  if (values.notes !== (recipe.notes ?? '')) out.notes = textOf(values.notes)

  const parts = partsOf(values)
  const knownParts = recipe.parts.map((part) => ({
    title: part.title,
    ingredients: part.ingredients,
  }))
  if (!same(parts, knownParts)) out.parts = parts

  const steps = stepsOf(values)
  const knownSteps = recipe.steps.map((group) => ({
    title: group.title,
    ordered: group.ordered,
    items: group.items,
  }))
  if (!same(steps, knownSteps)) out.steps = steps
  return out
}

/** Ob das Formular vom geladenen Rezept abweicht. */
export function isChanged(values: RecipeFormValues, recipe: Recipe): boolean {
  return Object.keys(changedInput(values, recipe)).length > 0
}

/** Ob im neuen Formular schon etwas steht (für die Warnung beim Verlassen). */
export function hasContent(values: RecipeFormValues): boolean {
  const input = fullInput(values)
  return Boolean(
    input.title ||
      input.yield ||
      input.description ||
      input.notes ||
      (input.parts ?? []).length > 0 ||
      (input.steps ?? []).length > 0
  )
}

/** Verschiebt den Eintrag `index` um `delta` Plätze (außerhalb: unverändert). */
export function moveItem<T>(
  list: readonly T[],
  index: number,
  delta: number
): T[] {
  const target = index + delta
  const next = [...list]
  if (
    index < 0 ||
    index >= next.length ||
    target < 0 ||
    target >= next.length
  ) {
    return next
  }
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}
