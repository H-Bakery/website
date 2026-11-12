/**
 * @jest-environment node
 *
 * Null-Diff von der Oberfläche aus, über **Dateien**: jedes Rezept, das die
 * API liest, muss das Formular unverändert wieder hergeben - `changedInput()`
 * leer, keine Meldung beim Laden. Geprüft über die erfundenen Rezepte
 * (`tools/e2e/hq-recipes`, je Formatvariante eine Datei) und - nur lokal, wo
 * `hq` neben dem Repo liegt - über jede echte Datei (im CI übersprungen; aus
 * den echten Dateien steht hier nichts im Repo).
 */
import fs from 'fs'
import path from 'path'
import {
  changedInput,
  formFromRecipe,
  formProblems,
  type RecipeFormValues,
} from './recipeForm'
import type { Recipe } from './recipesApi'

// Der eine Parser der API - die Verwaltung liest das Format nie selbst.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries
const core = require('../../../bakery-api/src/services/recipe-file.core') as {
  parseRecipeFile: (
    text: string,
    options: { fileStem: string }
  ) => {
    model: Pick<
      Recipe,
      'title' | 'yield' | 'description' | 'parts' | 'steps' | 'notes'
    >
  }
  isRecipeFileName: (name: string) => boolean
  fileStem: (name: string) => string
}

const REPO_ROOT = path.resolve(__dirname, '../../../..')
const FIXTURES = path.join(REPO_ROOT, 'tools', 'e2e', 'hq-recipes')
const REAL_DIR = [
  process.env['HQ_REAL_RECIPES_DIR'],
  path.join(REPO_ROOT, '..', 'hq', 'data', 'recipes'),
  path.join(REPO_ROOT, '..', '..', '..', '..', 'hq', 'data', 'recipes'),
].find((dir): dir is string => Boolean(dir) && fs.existsSync(dir as string))

function recipesOf(root: string): { id: string; recipe: Recipe }[] {
  const out: { id: string; recipe: Recipe }[] = []
  for (const category of fs.readdirSync(root)) {
    const dir = path.join(root, category)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const file of fs.readdirSync(dir)) {
      if (!core.isRecipeFileName(file)) continue
      const doc = core.parseRecipeFile(
        fs.readFileSync(path.join(dir, file), 'utf-8'),
        { fileStem: core.fileStem(file) }
      )
      out.push({
        // Kategorie und Position - nie der Dateiname eines echten Rezepts.
        id: `${category} #${out.length + 1}`,
        recipe: { ...doc.model, category } as Recipe,
      })
    }
  }
  return out
}

/** Jede Zeile so, als wäre sie von Hand neu eingetippt worden. */
function retyped(values: RecipeFormValues): RecipeFormValues {
  return {
    ...values,
    parts: values.parts.map((part) => ({
      ...part,
      rows: part.rows.map((row) => ({ ...row, original: null })),
    })),
  }
}

function check(root: string) {
  const all = recipesOf(root)
  expect(all.length).toBeGreaterThan(0)
  const changed: string[] = []
  const problems: string[] = []
  const lossy: string[] = []
  for (const { id, recipe } of all) {
    const values = formFromRecipe(recipe)
    if (Object.keys(changedInput(values, recipe)).length > 0) changed.push(id)
    if (formProblems(values).count > 0) problems.push(id)
    // Auch aus den Feldern allein entsteht wieder dieselbe Zutat: Menge,
    // Einheit, Name und Hinweis gehen im Formular nicht verloren.
    const again = changedInput(retyped(values), recipe)
    if (again.parts) lossy.push(id)
  }
  // Die Meldung nennt nur Kategorie und Position, nie Inhalte.
  expect({ changed, problems, lossy }).toEqual({
    changed: [],
    problems: [],
    lossy: [],
  })
}

describe('Formular über Rezeptdateien: laden und unverändert zurückgeben', () => {
  it('erfundene Rezepte in jeder Formatvariante', () => {
    check(FIXTURES)
  })
  ;(REAL_DIR ? it : it.skip)('jede echte Datei aus hq (nur lokal)', () => {
    check(REAL_DIR as string)
  })
})
