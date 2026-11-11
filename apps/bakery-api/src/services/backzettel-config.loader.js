// Duenner Datei-Loader fuer die Backzettel-Stammdaten.
//
// Liest `hq/config/backzettel.yaml`, den hq-Produktkatalog und die
// Fuellungsrezepte von der Platte; geprueft und gerechnet wird in den
// dependency-freien Cores daneben. Die einzige Abhaengigkeit ist js-yaml.
// ACHTUNG: im Root-package.json ist js-yaml (noch) nicht deklariert; es
// liegt nur als v3 ueber gray-matter im Root-node_modules (B0 soll js-yaml ^4
// aufnehmen). v3 und v4 funktionieren beide, weil nur `load` mit
// `CORE_SCHEMA` benutzt wird - kein `!!js/...`. Wer den Loader ins hq-CI
// kopiert (H2), muss dort js-yaml installieren.

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const configCore = require('./backzettel-config.core')
const recipesCore = require('./backzettel-recipes.core')

function parseYaml(text) {
  return yaml.load(text, { schema: yaml.CORE_SCHEMA })
}

/**
 * Parst den YAML-Text der Stammdaten.
 * @returns {{ok: true, data: object} | {ok: false, errors: {path:string, message:string}[]}}
 */
function parseBackzettelYaml(text) {
  try {
    const data = parseYaml(String(text))
    return { ok: true, data }
  } catch (e) {
    const where =
      e && e.mark
        ? ` (Zeile ${e.mark.line + 1}, Spalte ${e.mark.column + 1})`
        : ''
    return {
      ok: false,
      errors: [
        {
          path: '',
          message: `YAML lässt sich nicht lesen${where}: ${
            e && e.reason ? e.reason : e.message
          }`,
        },
      ],
    }
  }
}

/**
 * Liest die Frontmatter aller `*.md` eines hq-Produktverzeichnisses
 * (Dateien mit `_` am Anfang, etwa `_template.md`, zaehlen nicht).
 * @returns {Array<{id:string, numeric_id?:number, name?:string, available?:boolean, file:string}>}
 */
function readProductCatalog(dir) {
  const out = []
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    if (!m) continue
    let fm
    try {
      fm = parseYaml(m[1])
    } catch {
      continue
    }
    if (!fm || typeof fm.id !== 'string') continue
    out.push({
      id: fm.id,
      numeric_id: fm.numeric_id,
      name: fm.name,
      available: fm.available,
      file,
    })
  }
  return out
}

/**
 * Laedt, parst und prueft die Stammdaten.
 *
 * @param {string} filePath Pfad zu `backzettel.yaml`.
 * @param {{products?: Array, productsDir?: string}} [options]
 * @returns {{ok:boolean, config: object|null, errors: Array, warnings: Array, open: Array}}
 *   `config` ist normalisiert, wenn `ok`; `open` sind die offenen
 *   Stammdaten (ausdrueckliches `null`, Z10).
 */
function loadBackzettelConfig(filePath, options) {
  const opts = options || {}
  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    return {
      ok: false,
      config: null,
      errors: [
        {
          path: '',
          message: `Datei ${filePath} lässt sich nicht lesen: ${e.message}`,
        },
      ],
      warnings: [],
      open: [],
    }
  }
  const parsed = parseBackzettelYaml(text)
  if (!parsed.ok)
    return {
      ok: false,
      config: null,
      errors: parsed.errors,
      warnings: [],
      open: [],
    }
  const products =
    opts.products ||
    (opts.productsDir ? readProductCatalog(opts.productsDir) : undefined)
  const result = configCore.validateBackzettelConfig(parsed.data, { products })
  return {
    ok: result.ok,
    config: result.ok ? configCore.normalizeConfig(parsed.data) : null,
    errors: result.errors,
    warnings: result.warnings,
    open: result.open,
  }
}

/**
 * Laedt die Fuellungsrezepte, auf die `fillings[].recipe` zeigt (relativ zur
 * hq-Wurzel). Fehlende Dateien oder Abschnitte landen in `missing`.
 * @returns {{recipes: Object<string, object>, missing: Array<{id:string, message:string}>}}
 */
function loadFillingRecipes(config, hqRoot) {
  const recipes = {}
  const missing = []
  const cache = new Map()
  for (const f of (config && config.fillings) || []) {
    if (!f.recipe) {
      missing.push({
        id: f.id,
        noRecipe: true,
        message: `Für „${f.name || f.id}“ ist kein Rezept hinterlegt.`,
      })
      continue
    }
    // Nie ausserhalb von hq lesen: der Validator verlangt schon einen
    // relativen Pfad unter data/recipes/, hier wird es noch einmal am
    // aufgeloesten Pfad geprueft (Zweitschutz, falls jemand ungeprueft laedt).
    const root = path.resolve(hqRoot)
    const file = path.resolve(root, f.recipe)
    if (
      !configCore.isSafeRecipePath(f.recipe) ||
      !file.startsWith(root + path.sep)
    ) {
      missing.push({
        id: f.id,
        message: `Rezeptpfad ${JSON.stringify(
          f.recipe
        )} liegt nicht unter data/recipes/ in hq und wird nicht gelesen.`,
      })
      continue
    }
    if (!cache.has(file)) {
      let parsed = null
      try {
        parsed = recipesCore.parseFillingRecipes(fs.readFileSync(file, 'utf8'))
      } catch {
        parsed = null
      }
      cache.set(file, parsed)
    }
    const all = cache.get(file)
    if (!all) {
      missing.push({
        id: f.id,
        message: `Rezeptdatei ${f.recipe} lässt sich nicht lesen.`,
      })
      continue
    }
    const recipe = recipesCore.findRecipeForReference(all, f)
    if (!recipe) {
      missing.push({
        id: f.id,
        message: `In ${f.recipe} gibt es kein Rezept „${f.section || f.id}“.`,
      })
      continue
    }
    recipes[f.id] = recipe
  }
  return { recipes, missing }
}

module.exports = {
  parseBackzettelYaml,
  readProductCatalog,
  loadBackzettelConfig,
  loadFillingRecipes,
}
