/**
 * Temporary hq trees with recipes for tests. Only the synthetic recipes of
 * `tools/e2e/hq-recipes` are copied - never real hq data.
 *
 *   const hq = makeRecipesHq()                 // <tmp>/data/recipes/<category>/…
 *   const write = makeRecipesWriteRepo(hq)     // git repo on app/edits, same tree
 */
import * as fs from 'fs'
import * as path from 'path'

import { git, tempDir } from './hqProducts'

export const RECIPE_FIXTURE_DIR = path.resolve(
  __dirname,
  '../../../../tools/e2e/hq-recipes'
)

export interface RecipesHq {
  /** Root of the synthetic hq tree. */
  root: string
  /** `${root}/data/recipes`. */
  recipesDir: string
  /** `${root}/config/backzettel.yaml` (written only on request). */
  configPath: string
}

/** Every fixture recipe as `<category>/<file>`. */
export function fixtureRecipes(): string[] {
  const out: string[] = []
  for (const dir of fs.readdirSync(RECIPE_FIXTURE_DIR).sort()) {
    const full = path.join(RECIPE_FIXTURE_DIR, dir)
    if (!fs.statSync(full).isDirectory()) continue
    for (const file of fs.readdirSync(full).sort()) out.push(`${dir}/${file}`)
  }
  return out
}

/**
 * Master data that point at two fixture fillings - one by section, one by
 * id - like `fillings[]` in `config/backzettel.yaml`. Only what the recipe
 * references need; not a valid Backzettel config.
 */
export const BACKZETTEL_REFERENCES = `fillings:
  - { id: nuss, name: Testnussfüllung, recipe: data/recipes/fillings/Gefüllte-Testkränze.md, section: Testnussfüllung }
  - { id: probeschoko, name: Probeschokofüllung, recipe: data/recipes/fillings/Gefüllte-Testkränze.md }
`

/** A synthetic hq tree with all fixture recipes (and optionally the references). */
export function makeRecipesHq(
  options: { backzettel?: string | null } = {}
): RecipesHq {
  const root = tempDir('hq-recipes-')
  const recipesDir = path.join(root, 'data', 'recipes')
  fs.mkdirSync(recipesDir, { recursive: true })
  fs.cpSync(RECIPE_FIXTURE_DIR, recipesDir, { recursive: true })
  const configPath = path.join(root, 'config', 'backzettel.yaml')
  if (options.backzettel) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, options.backzettel)
  }
  return { root, recipesDir, configPath }
}

/**
 * A git repo on branch `app/edits` with the same tree as `hq`, one initial
 * commit - stands in for `HQ_WRITE_DIR`. Returns the repo root.
 */
export function makeRecipesWriteRepo(hq: RecipesHq): string {
  const root = tempDir('hq-recipes-write-')
  git(root, 'init', '-q', '-b', 'app/edits')
  git(root, 'config', 'commit.gpgsign', 'false')
  fs.cpSync(hq.root, root, { recursive: true })
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'initial')
  return root
}

export function readRecipe(recipesDir: string, rel: string): string {
  return fs.readFileSync(path.join(recipesDir, rel), 'utf-8')
}
