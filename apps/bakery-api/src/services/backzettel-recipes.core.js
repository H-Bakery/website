// Fuellungsrezepte aus `hq/data/recipes/fillings/*.md` lesen und skalieren.
//
// Dependency-freies CommonJS. Das hq-Format ist das handgeschriebene der
// Baeckerei: eine Datei kann mehrere Rezepte enthalten, jedes unter einer
// Ueberschrift (`### 🌰 Nussfüllung`) mit einer Tabelle `| Zutat | Menge |`.
// Mengen stehen deutsch notiert (`1.000 g`, `1.200 ml`, `150 g (nach Bedarf)`).
//
// Was nicht in Gramm umzurechnen ist (`1 Dose (ca. 3 kg)`, `2–5 g`), bleibt
// mit `g: null` und dem Originaltext stehen; das Rezept heisst dann
// `complete: false` und wird gar nicht skaliert (`factor: null`) statt mit
// einer falschen Chargengroesse. Milliliter zaehlen wie Gramm (Wasser) - so hat es auch der
// bisherige `FillingPreparation`-Rechner gemacht.

// Gelesen wird die Datei von `recipe-file.core.js` (der eine Parser für
// Rezeptdateien, auch der Rezeptverwaltung): Überschriften, Tabellen und
// Mengen kommen von dort; hier steht nur, was der Backzettel daraus macht
// (Gramm, Chargengröße, Skalieren).

const recipeFile = require('./recipe-file.core')

const { slugify } = recipeFile

/** Einheiten, die der Backzettel in Gramm umrechnet (1 ml = 1 g). */
const GRAMS_PER_UNIT = { g: 1, ml: 1, kg: 1000, l: 1000 }

/**
 * Liest eine deutsche Mengenangabe in Gramm.
 * @returns {{g: number|null, unit: string|null}}
 */
function parseAmount(raw) {
  const q = recipeFile.readQuantity(raw)
  const factor = q.unit ? GRAMS_PER_UNIT[q.unit] : undefined
  if (q.amount === null || factor === undefined) return { g: null, unit: null }
  return { g: Math.round(q.amount * factor * 1000) / 1000, unit: q.unit }
}

/**
 * Alle Rezepte einer Markdown-Datei.
 * @returns {Array<{id:string, title:string, batch_g:number, complete:boolean,
 *   ingredients: Array<{name:string, g:number|null, unit:string|null, raw:string}>}>}
 */
function parseFillingRecipes(markdown) {
  const recipes = []
  for (const table of recipeFile.scanIngredientTables(markdown)) {
    const ingredients = []
    for (const row of table.rows) {
      const name = (row.cells[0] || '').replace(/\*+$/, '').trim()
      const raw = row.cells[1] || ''
      if (!name) continue
      const { g, unit } = parseAmount(raw)
      ingredients.push({ name, g, unit, raw })
    }
    if (ingredients.length === 0) continue
    recipes.push({
      id: slugify(table.title || 'rezept'),
      title: table.title || 'Rezept',
      batch_g: ingredients.reduce((sum, i) => sum + (i.g || 0), 0),
      complete: ingredients.every((i) => i.g !== null),
      ingredients,
    })
  }
  return recipes
}

/**
 * Ein Rezept aus einer Datei. Mit `section` wird die Ueberschrift gesucht
 * (ohne Gross-/Kleinschreibung, exakt oder als Anfang); sonst das erste.
 * @returns {object|null}
 */
function parseFillingRecipe(markdown, options) {
  const recipes = parseFillingRecipes(markdown)
  const section = options && options.section
  if (!section) return recipes[0] || null
  return findRecipeBySection(recipes, section)
}

/**
 * Sucht in geparsten Rezepten die Ueberschrift `section` - bereinigt wie die
 * Ueberschriften selbst (Emoji, Doppelpunkt), ohne Gross-/Kleinschreibung,
 * exakt oder als Anfang. Einzige Stelle dafuer; Loader und
 * `parseFillingRecipe` benutzen beide diese Funktion.
 * @returns {object|null}
 */
function findRecipeBySection(recipes, section) {
  const list = Array.isArray(recipes) ? recipes : []
  const wanted = recipeFile.cleanHeading(String(section || '')).toLowerCase()
  if (!wanted) return null
  return (
    list.find((r) => r.title.toLowerCase() === wanted) ||
    list.find((r) => r.title.toLowerCase().startsWith(wanted)) ||
    null
  )
}

/**
 * Sucht das Rezept zu einer Fuellungs-ID ("nuss" -> "nussfuellung",
 * "schoko" -> "schokoladenfuellung").
 */
function findRecipeForFilling(recipes, fillingId) {
  const id = slugify(fillingId)
  return (recipes || []).find((r) => r.id === id || r.id.startsWith(id)) || null
}

/**
 * Das Rezept, auf das ein Eintrag der Stammdaten zeigt: mit `section` die
 * Ueberschrift, sonst ueber die id. Einzige Stelle dafuer - der Loader und
 * die Rezeptverwaltung (darf eine Aenderung den Verweis brechen?) fragen
 * beide hier.
 * @param {object[]} recipes Ergebnis von `parseFillingRecipes`
 * @param {{id?: string, section?: string|null}} reference
 * @returns {object|null}
 */
function findRecipeForReference(recipes, reference) {
  const ref = reference || {}
  return ref.section
    ? findRecipeBySection(recipes, ref.section)
    : findRecipeForFilling(recipes, ref.id)
}

/**
 * Skaliert ein Rezept auf `grams` Gesamtmenge. Zutaten werden auf `roundTo`
 * Gramm gerundet (Standard 10 g); eine Zutat, die gebraucht wird, rundet nie
 * auf 0, sondern auf mindestens `roundTo`.
 */
function scaleRecipe(recipe, grams, options) {
  const roundTo = (options && options.roundTo) || 10
  if (!recipe || !(recipe.batch_g > 0)) return null
  const target = Number(grams) > 0 ? Number(grams) : 0
  // Unvollstaendig (eine Zutat ohne Grammangabe, `1 Dose (ca. 2 kg)`):
  // `batch_g` ist dann nur die Summe der lesbaren Zutaten, der Faktor waere
  // falsch - aus 200 g lesbarer Masse und 400 g Bedarf wurde „× 2“ mit der
  // doppelten Zuckermenge zu einer ganzen Dose Aepfel (W4-Verifikation
  // Runde 2). Deshalb kein Faktor, keine skalierten Mengen; die Oberflaeche
  // zeigt das Grundrezept mit Hinweis.
  if (recipe.complete === false) {
    return {
      title: recipe.title,
      batch_g: null,
      grams: target,
      factor: null,
      complete: false,
      ingredients: recipe.ingredients.map((ing) => ({
        name: ing.name,
        g: ing.g === undefined ? null : ing.g,
        unit: ing.unit || null,
        raw: ing.raw,
        scaled_g: null,
      })),
    }
  }
  const factor = target / recipe.batch_g
  return {
    title: recipe.title,
    batch_g: recipe.batch_g,
    grams: target,
    factor: Math.round(factor * 1000) / 1000,
    complete: recipe.complete !== false,
    ingredients: recipe.ingredients.map((ing) => {
      if (ing.g === null || ing.g === undefined) {
        return {
          name: ing.name,
          g: null,
          unit: ing.unit || null,
          raw: ing.raw,
          scaled_g: null,
        }
      }
      const exact = ing.g * factor
      let scaled = Math.round(exact / roundTo) * roundTo
      if (exact > 0 && scaled === 0) scaled = roundTo
      return {
        name: ing.name,
        g: ing.g,
        unit: ing.unit,
        raw: ing.raw,
        scaled_g: scaled,
      }
    }),
  }
}

module.exports = {
  parseAmount,
  parseFillingRecipes,
  parseFillingRecipe,
  findRecipeBySection,
  findRecipeForFilling,
  findRecipeForReference,
  scaleRecipe,
  slugify,
}
