// Fuellungsrezepte aus `hq/data/recipes/fillings/*.md` lesen und skalieren.
//
// Dependency-freies CommonJS. Das hq-Format ist das handgeschriebene der
// Baeckerei: eine Datei kann mehrere Rezepte enthalten, jedes unter einer
// Ueberschrift (`### 🌰 Nussfüllung`) mit einer Tabelle `| Zutat | Menge |`.
// Mengen stehen deutsch notiert (`1.000 g`, `1.200 ml`, `150 g (nach Bedarf)`).
//
// Was nicht in Gramm umzurechnen ist (`1 Dose (ca. 3 kg)`, `2–5 g`), bleibt
// mit `g: null` und dem Originaltext stehen; das Rezept heisst dann
// `complete: false` und wird nicht still mit einer falschen Chargengroesse
// skaliert. Milliliter zaehlen wie Gramm (Wasser) - so hat es auch der
// bisherige `FillingPreparation`-Rechner gemacht.

const AMOUNT =
  /^(?:ca\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(kg|g|ml|l)(?![a-zäöüß])/i

function cleanHeading(text) {
  // Emojis und Zierzeichen vorne weg: "🌰 Nussfüllung" -> "Nussfüllung"
  return String(text)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[:\s]+$/, '')
    .trim()
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Liest eine deutsche Mengenangabe in Gramm.
 * @returns {{g: number|null, unit: string|null}}
 */
function parseAmount(raw) {
  const text = String(raw || '').trim()
  const m = AMOUNT.exec(text)
  if (!m) return { g: null, unit: null }
  const whole = Number(m[1].replace(/\./g, ''))
  const frac = m[2] ? Number(`0.${m[2]}`) : 0
  const n = whole + frac
  const unit = m[3].toLowerCase()
  const factor = unit === 'kg' || unit === 'l' ? 1000 : 1
  return { g: Math.round(n * factor * 1000) / 1000, unit }
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-{2,}:?$/.test(c))
}

/**
 * Alle Rezepte einer Markdown-Datei.
 * @returns {Array<{id:string, title:string, batch_g:number, complete:boolean,
 *   ingredients: Array<{name:string, g:number|null, unit:string|null, raw:string}>}>}
 */
function parseFillingRecipes(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  const recipes = []
  let title = null
  let current = null
  let headerSeen = false

  const finish = () => {
    if (current && current.ingredients.length > 0) {
      current.batch_g = current.ingredients.reduce(
        (sum, i) => sum + (i.g || 0),
        0
      )
      current.complete = current.ingredients.every((i) => i.g !== null)
      recipes.push(current)
    }
    current = null
    headerSeen = false
  }

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      finish()
      const text = cleanHeading(heading[2])
      // "### Zutaten:" unter "# Apfelfüllung" benennt kein eigenes Rezept.
      if (!/^zutaten$/i.test(text)) title = text
      continue
    }
    if (!line.trim().startsWith('|')) {
      if (current && line.trim() !== '') finish()
      continue
    }
    const cells = splitRow(line)
    if (!current) {
      // Kopfzeile: erste Spalte "Zutat"
      if (/^zutat/i.test(cells[0] || '')) {
        current = {
          id: slugify(title || 'rezept'),
          title: title || 'Rezept',
          batch_g: 0,
          complete: true,
          ingredients: [],
        }
        headerSeen = true
      }
      continue
    }
    if (headerSeen && isSeparatorRow(cells)) continue
    const name = (cells[0] || '').replace(/\*+$/, '').trim()
    const raw = cells[1] || ''
    if (!name) continue
    const { g, unit } = parseAmount(raw)
    current.ingredients.push({ name, g, unit, raw })
  }
  finish()
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
  const wanted = cleanHeading(String(section || '')).toLowerCase()
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
 * Skaliert ein Rezept auf `grams` Gesamtmenge. Zutaten werden auf `roundTo`
 * Gramm gerundet (Standard 10 g); eine Zutat, die gebraucht wird, rundet nie
 * auf 0, sondern auf mindestens `roundTo`.
 */
function scaleRecipe(recipe, grams, options) {
  const roundTo = (options && options.roundTo) || 10
  if (!recipe || !(recipe.batch_g > 0)) return null
  const target = Number(grams) > 0 ? Number(grams) : 0
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
  scaleRecipe,
  slugify,
}
