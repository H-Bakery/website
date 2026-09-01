#!/usr/bin/env node
/**
 * @file Leitet Allergene aus den echten Rezepten der Bäckerei ab und schreibt
 *       sie in das Frontmatter von `hq/products/*.md`.
 *
 * ## Die eine Regel, die alles andere bestimmt
 *
 * **Es werden ausschließlich positive Aussagen erzeugt** ("enthält Weizen").
 * Nie eine Aussage über Abwesenheit — kein "frei von", kein "glutenfrei",
 * kein "laktosefrei", auch keine leere Liste. Eine falsche "enthält"-Angabe
 * ärgert jemanden; eine falsche "enthält nicht"-Angabe bringt jemanden ins
 * Krankenhaus.
 *
 * Daraus folgt der gesamte Aufbau:
 *
 * 1. **Kein Raten.** Ein Produkt ohne Rezept bekommt *keine* der drei Keys —
 *    nicht `allergens: []`, nicht eine plausible Liste. Fehlende Daten müssen
 *    sichtbar fehlen, damit die Oberfläche den ehrlichen Hinweis zeigen kann.
 * 2. **Kein Schluss aus Name oder Kategorie.** "Käsekuchen" enthält
 *    offensichtlich Milch — ohne belastbares Rezept wird das trotzdem nicht
 *    deklariert.
 * 3. **Eine unbekannte Zutat blockiert das ganze Rezept.** Eine Allergenliste
 *    wird als vollständig gelesen. Wenn auch nur eine Zeile des Rezepts nicht
 *    aufgelöst werden kann, ist die Vollständigkeit nicht belegt — dann lieber
 *    gar keine Angabe. Jede blockierende Zutat wird im Bericht genannt.
 * 4. **Im Zweifel dazu, nie weg.** "Butter oder Margarine" ergibt Milch.
 *    "Hafermehl (glutenfrei)" ergibt trotzdem Hafer und Gluten: Hafer steht in
 *    Anhang II LMIV, und eine Auslobung im Rezept darf ein Allergen nie
 *    entfernen.
 *
 * ## Warum nur ein Teil der Rezepte benutzt wird
 *
 * Verwendet werden nur Rezepte mit einem `## Zutaten`-Abschnitt — das sind die
 * vollständigen Rezepturen (Frontmatter, Teigführung, Backparameter).
 * Bewusst **nicht** verwendet werden die Tabellen-Rezepte unter `cakes/` und
 * `fillings/`: das sind Teil-Rezepte für eine Masse oder Füllung, kein
 * komplettes Produkt. `cakes/Käsekuchen.md` listet Quark, Ei, Sahne, Wasser,
 * Milchpulver, Salz — und **keinen Boden**. Daraus abgeleitet stünde am
 * Käsekuchen "Ei, Milch", und ausgerechnet das Gluten des Mürbeteigs fehlte.
 * Genau dieser Fall ist der gefährliche.
 *
 * ## Quellen
 *
 * - Zutaten je Rezept: `hq/data/recipes/**\/*.md`
 * - Zutat → Allergen: `hq/data/inventory/ingredients/ingredient-database.yaml`
 * - Allergenliste: Anhang II LMIV (VO (EU) Nr. 1169/2011). Glutenhaltiges
 *   Getreide wird dort namentlich genannt (Weizen, Roggen, Gerste, Hafer,
 *   Dinkel), deshalb steht neben `gluten` immer auch das Getreide.
 *
 * ## Aufruf
 *
 * ```bash
 * node tools/allergens/derive-allergens.mjs            # Vorschau (Standard)
 * node tools/allergens/derive-allergens.mjs --write     # schreibt hq/products/*.md
 * node tools/allergens/derive-allergens.mjs --verbose   # zusätzlich je Produkt
 * ```
 *
 * Ohne `--write` wird nichts angefasst. Der Lauf ist idempotent: ein zweiter
 * `--write`-Lauf erzeugt einen leeren git-Diff.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Pfade
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url))
/** `website/tools/allergens` → `…/bakery`. */
const WORKSPACE = resolve(HERE, '../../..')
const HQ_DIR = process.env.HQ_DIR
  ? resolve(process.env.HQ_DIR)
  : join(WORKSPACE, 'hq')
const PRODUCTS_DIR = process.env.HQ_PRODUCTS_DIR
  ? resolve(process.env.HQ_PRODUCTS_DIR)
  : join(HQ_DIR, 'products')
const RECIPES_DIR = join(HQ_DIR, 'data', 'recipes')
const INGREDIENT_DB = join(
  HQ_DIR,
  'data',
  'inventory',
  'ingredients',
  'ingredient-database.yaml'
)

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/**
 * Kleinschreibung, ß→ss, Umlaute ausgeschrieben, restliche Diakritika weg.
 * Reihenfolge ist wichtig: erst NFC, damit ein zerlegtes "ä" wieder ein
 * Zeichen ist, dann die deutschen Ersetzungen, dann der Rest.
 */
export function normalise(value) {
  return String(value)
    .normalize('NFC')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Normalisiert und zerlegt in Wörter. */
function words(value) {
  return normalise(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Normalisierter Schlüssel ohne Trenn- und Leerzeichen ("Kasten-Weißbrot" → "kastenweissbrot"). */
function compactKey(value) {
  return normalise(value).replace(/[^a-z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Allergen-Schlüssel
// ---------------------------------------------------------------------------

/**
 * Die Schlüssel, die dieses Skript erzeugen darf. Identisch mit `AllergenKey`
 * in `libs/shared/utils/src/lib/allergens.ts` — wer hier einen ergänzt, muss
 * ihn dort ergänzen, sonst zeigt der Shop ein rohes Wort an.
 */
const ALLERGEN_KEYS = [
  'cashew',
  'dinkel',
  'ei',
  'gerste',
  'gluten',
  'hafer',
  'haselnuss',
  'mandel',
  'milch',
  'roggen',
  'sesam',
  'walnuss',
  'weizen',
]

/** Glutenhaltige Getreide nach Anhang II Nr. 1 LMIV. Eines davon ⇒ auch `gluten`. */
const GLUTEN_CEREALS = ['weizen', 'roggen', 'gerste', 'hafer', 'dinkel']

// ---------------------------------------------------------------------------
// Wortregeln
// ---------------------------------------------------------------------------

/**
 * Wörter, die in einer Zutatenzeile stehen dürfen, ohne eine Zutat zu sein:
 * Mengen, Temperaturen, Zustandsbeschreibungen.
 *
 * `glutenfrei` steht hier bewusst: das Wort taucht in einem Rezept als
 * Auslobung auf ("Hafermehl (glutenfrei)"). Es wird ignoriert und entfernt
 * niemals ein Allergen — Hafer bleibt Hafer.
 */
const STOPWORDS = new Set([
  'abgekuehlt',
  'abgeseiht',
  'aus',
  'bespruehen',
  'bestreichen',
  'c',
  'croissant',
  'dose',
  'einweichen',
  'el',
  'falls',
  'fein',
  'frisch',
  'g',
  'ganz',
  'ganze',
  'gehackt',
  'gehackte',
  'gekocht',
  'gekochter',
  'gemahlen',
  'gemahlene',
  'gemischte',
  'gerieben',
  'geschrotet',
  'geschrotete',
  'getrocknet',
  'getrocknete',
  'gewuerfelt',
  'glutenfrei',
  'grob',
  'grobes',
  'in',
  'kalt',
  'kernig',
  'kg',
  'kochend',
  'l',
  'lauwarm',
  'lt',
  'mild',
  'min',
  'mit',
  'mittel',
  'ml',
  'msp',
  'neutral',
  'oder',
  'ohne',
  'optional',
  'prise',
  'qualitaet',
  'raumtemperatur',
  'schwarzer',
  'spuelen',
  'std',
  'streifen',
  'stueck',
  'tl',
  'type',
  'und',
  'ungeschaelt',
  'verwendet',
  'vollkorn',
  'vom',
  'von',
  'vortag',
  'warm',
  'weich',
  'zart',
  'zimmerwarm',
  'zu',
  'zum',
  'zur',
])

/**
 * Zutat → Allergene, Wort für Wort. Pro Wort gewinnt die **erste** passende
 * Regel, deshalb ist die Reihenfolge Teil der Aussage: `buchweizen` steht vor
 * `weizen`, `schmalz` vor `malz`.
 *
 * `allergens: []` heißt "diese Zutat trägt kein Allergen aus Anhang II LMIV" —
 * das ist eine Aussage über die *Zutat*, nicht über das Produkt, und deshalb
 * mit der Sicherheitsregel vereinbar.
 *
 * `review: true` markiert eine bewusst konservative Annahme. Solche Zeilen
 * druckt der Bericht aus, damit die Bäckerei sie bestätigen kann.
 */
const WORD_RULES = [
  // --- Fallen: Wörter, die ein Allergen enthalten, aber keines sind --------
  {
    re: /^buchweizen/,
    allergens: [],
    note: 'Buchweizen ist kein Weizen (Knöterichgewächs, kein Gluten)',
  },
  {
    re: /^muskatnuss/,
    allergens: [],
    note: 'Muskatnuss ist ein Gewürz, keine Schalenfrucht',
  },
  {
    re: /schmalz/,
    allergens: [],
    note: 'Schweineschmalz — kein Anhang-II-Allergen',
  },
  {
    re: /^kokos/,
    allergens: [],
    note: 'Kokosnuss ist keine Schalenfrucht im Sinne Anhang II',
  },

  // --- Glutenhaltige Getreide (Anhang II Nr. 1) ---------------------------
  { re: /weizen/, allergens: ['weizen'] },
  { re: /roggen/, allergens: ['roggen'] },
  { re: /dinkel/, allergens: ['dinkel'] },
  { re: /gerste|gersten/, allergens: ['gerste'] },
  { re: /hafer/, allergens: ['hafer'] },
  {
    re: /malz/,
    allergens: ['gerste'],
    review: true,
    note: 'Backmalz/Malzextrakt ist in der Bäckerei Gerstenmalz (so auch die Zutaten-Datenbank)',
  },
  {
    re: /bier/,
    allergens: ['gerste'],
    review: true,
    note: 'Bier wird aus Gerstenmalz gebraut',
  },
  {
    re: /lievito|madre/,
    allergens: ['weizen'],
    review: true,
    note: 'Lievito Madre ist ein Weizensauerteig',
  },

  // --- Milch (Anhang II Nr. 7) --------------------------------------------
  { re: /milch/, allergens: ['milch'] },
  { re: /butter/, allergens: ['milch'] },
  { re: /sahne|rahm/, allergens: ['milch'] },
  { re: /quark/, allergens: ['milch'] },
  { re: /joghurt/, allergens: ['milch'] },
  {
    re: /^kaese|emmentaler|gouda|parmesan|edamer|mozzarella/,
    allergens: ['milch'],
  },

  // --- Ei (Anhang II Nr. 3) -----------------------------------------------
  { re: /^ei$|^eier$|^eiern$/, allergens: ['ei'] },
  { re: /^eigelb|^eiklar|^volleipulver/, allergens: ['ei'] },
  {
    re: /^eiweiss/,
    allergens: ['ei'],
    review: true,
    note: 'Eiweißpulver: als Hühnereiweiß gewertet, auch wenn "neutral" danebensteht',
  },

  // --- Sesam und Schalenfrüchte (Anhang II Nr. 8 und 11) -------------------
  { re: /sesam/, allergens: ['sesam'] },
  { re: /mandel/, allergens: ['mandel'] },
  { re: /haselnuss|haselnuesse/, allergens: ['haselnuss'] },
  { re: /walnuss|walnuesse/, allergens: ['walnuss'] },
  { re: /cashew/, allergens: ['cashew'] },

  // --- Vorstufen: verweisen auf einen eigenen Abschnitt desselben Rezepts,
  //     dessen Zutaten bereits einzeln gezählt werden. -----------------------
  {
    re: /^anstellgut$/,
    allergens: [],
    note: 'Anstellgut — Mehl und Wasser aus demselben Abschnitt',
  },
  {
    re: /sauerteig/,
    allergens: [],
    note: 'Verweis auf den Sauerteig-Abschnitt des Rezepts',
  },
  {
    re: /^vorteig$|^poolish$/,
    allergens: [],
    note: 'Verweis auf den Vorteig-Abschnitt',
  },
  {
    re: /quellstueck|bruehstueck|^quell$/,
    allergens: [],
    note: 'Verweis auf das Quell-/Brühstück',
  },
  {
    re: /^keimlinge$/,
    allergens: [],
    note: 'Keimlinge aus dem Quellstück desselben Rezepts',
  },
  {
    re: /^gel$/,
    allergens: [],
    note: 'Chia-Gel — Verweis auf den eigenen Abschnitt',
  },

  // --- Zutaten ohne Anhang-II-Allergen ------------------------------------
  { re: /^wasser$/, allergens: [] },
  { re: /salz/, allergens: [] },
  {
    re: /zucker|agavendicksaft|honig|ruebensirup|ruebenkraut|sirup/,
    allergens: [],
  },
  { re: /hefe$|^hefe/, allergens: [] },
  { re: /^backpulver$|^natron$|^natronlauge$/, allergens: [] },
  { re: /margarine|pflanzenfett|^fett$/, allergens: [] },
  { re: /oel$|^oel/, allergens: [] },
  { re: /essig/, allergens: [] },
  { re: /^sonnenblume|^kuerbis|^kerne$|^koerner/, allergens: [] },
  {
    re: /leinsamen|^chia|hanfsamen|^flohsamenschalen$|^mohn$|^blaumohn$/,
    allergens: [],
  },
  { re: /^quinoa$|^amaranth|^reis(mehl)?$|^hirse/, allergens: [] },
  {
    re: /^goji$|^beeren$|^feigen$|^rosinen$|^sultaninen$|^cranberries$|^kirschen$|^apfel/,
    allergens: [],
  },
  {
    re: /gewuerz|^kuemmel$|^koriander$|^fenchel|^anis$|^thymian$|^majoran$|^bergkraeuter$|kraeuter|^quendel$|^galgant$|^bertram$|^zimt$|^paprikapulver$|^pfeffer$|^schnittlauch$|^vanille/,
    allergens: [],
  },
  {
    re: /^schinken$/,
    allergens: [],
    review: true,
    note: 'Kochschinken trägt kein Anhang-II-Allergen; Zusätze der Metzgerei sind hier nicht belegt',
  },

  // --- Kein Lebensmittel ---------------------------------------------------
  {
    re: /^schutzhandschuhe$|^schutzbrille$/,
    allergens: [],
    note: 'Arbeitsschutz, keine Zutat',
  },
]

/**
 * Löst ein einzelnes Wort auf.
 * @returns {{allergens: string[], rule: object} | null} `null` = unbekannt.
 */
function resolveWord(word) {
  if (STOPWORDS.has(word)) return { allergens: [], rule: null }
  if (/^\d+(g|kg|ml|l|%)?$/.test(word)) return { allergens: [], rule: null }
  for (const rule of WORD_RULES) {
    if (rule.re.test(word)) return { allergens: rule.allergens, rule }
  }
  return null
}

// ---------------------------------------------------------------------------
// Zutaten-Datenbank aus hq
// ---------------------------------------------------------------------------

/**
 * Liest `ingredient-database.yaml`. Bewusst ein eigener, winziger Parser:
 * `js-yaml` steht nicht in der `package.json` des Workspaces (es liegt nur als
 * transitive Abhängigkeit in `node_modules`), und dieses Skript soll ohne neue
 * Abhängigkeit laufen. Die Datei hat eine feste, flache Form.
 *
 * @returns {Map<string, {key: string, name: string, allergens: string[]}>}
 *   Nachschlagewerk Token → Eintrag. Tokens sind der normalisierte `name`
 *   ("weizenmehl type 405") und der Schlüsselstamm ("weizenmehl").
 */
function loadIngredientDatabase(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const entries = []
  let inIngredients = false
  let current = null

  for (const line of lines) {
    if (/^ingredients:\s*$/.test(line)) {
      inIngredients = true
      continue
    }
    if (!inIngredients) continue
    // Ein neuer Top-Level-Block (Spalte 0) beendet den ingredients-Baum.
    if (/^\S/.test(line)) break

    const entry = line.match(/^ {2}([a-z0-9_]+):\s*$/i)
    if (entry) {
      current = { key: entry[1], name: '', allergens: [] }
      entries.push(current)
      continue
    }
    if (!current) continue

    const name = line.match(/^ {4}name:\s*"?([^"]*)"?\s*$/)
    if (name) current.name = name[1].trim()

    const allergens = line.match(/^ {4}allergens:\s*\[(.*)\]\s*$/)
    if (allergens) {
      current.allergens = allergens[1]
        .split(',')
        .map((a) => a.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
  }

  if (entries.length < 30) {
    throw new Error(
      `Zutaten-Datenbank nicht plausibel gelesen (${entries.length} Einträge) — ${file}`
    )
  }
  for (const expected of [
    'weizenmehl_405',
    'roggenmehl_1150',
    'milch_38',
    'eier_m',
    'sesam',
  ]) {
    if (!entries.some((e) => e.key === expected)) {
      throw new Error(
        `Zutaten-Datenbank: Eintrag "${expected}" fehlt — Parser prüfen`
      )
    }
  }

  const lookup = new Map()
  for (const entry of entries) {
    const unknown = entry.allergens.filter((a) => !ALLERGEN_KEYS.includes(a))
    if (unknown.length) {
      throw new Error(
        `Zutaten-Datenbank nennt unbekannte Allergene [${unknown.join(
          ', '
        )}] bei "${entry.key}". ` +
          'ALLERGEN_KEYS hier und AllergenKey in libs/shared/utils ergänzen, dann erneut laufen.'
      )
    }
    const tokens = new Set()
    if (entry.name)
      tokens.add(normalise(entry.name).replace(/\s+/g, ' ').trim())
    // "weizenmehl_405" → "weizenmehl", "salz_fein" → "salz fein"
    tokens.add(
      entry.key
        .split('_')
        .filter((part) => !/^\d+$/.test(part))
        .join(' ')
    )
    for (const token of tokens) {
      if (token.length < 4) continue
      if (!lookup.has(token)) lookup.set(token, entry)
    }
  }
  return { entries, lookup }
}

// ---------------------------------------------------------------------------
// Rezepte
// ---------------------------------------------------------------------------

function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...listFiles(path))
    else out.push(path)
  }
  return out
}

/** Zerlegt eine Zeile wie `- [ ] 150 g Roggenmehl Type 1150` in den Zutatentext. */
function ingredientText(line) {
  let text = line.trim().replace(/^-\s*(\[[ xX]?\]\s*)?/, '')
  text = text.replace(/^[0-9]+(?:[.,][0-9]+)?\s*/, '')
  text = text.replace(
    /^(g|kg|ml|l|el|tl|msp\.?|prise|stück|st\.?|dose)\s+/i,
    ''
  )
  return text.trim()
}

/**
 * Liest alle Rezepte mit `## Zutaten`. Tabellen-Rezepte (`cakes/`, `fillings/`)
 * haben diesen Abschnitt nicht und werden bewusst übergangen — siehe Kopf.
 */
function loadRecipes(dir) {
  const recipes = []
  const skipped = []

  for (const file of listFiles(dir)) {
    if (!file.endsWith('.md') || basename(file) === 'README.md') continue
    const raw = readFileSync(file, 'utf8')
    const sections = raw.split(/^## /m)
    const zutaten = sections.find((section) =>
      /^Zutaten\s*$/m.test(section.split('\n')[0])
    )
    if (!zutaten) {
      skipped.push({
        file,
        reason: 'kein "## Zutaten"-Abschnitt (Teil-Rezept ohne Teig/Boden)',
      })
      continue
    }

    const title =
      (raw.match(/^title:\s*(.+)$/m)?.[1] ?? '').trim() ||
      basename(file, '.md').replace(/-/g, ' ')

    const ingredients = zutaten
      .split('\n')
      .filter((line) => /^\s*-\s/.test(line))
      .map(ingredientText)
      .filter(Boolean)

    if (ingredients.length < 3) {
      skipped.push({
        file,
        reason: `nur ${ingredients.length} Zutaten gelesen — Parser prüfen`,
      })
      continue
    }

    recipes.push({ file, title, key: compactKey(title), ingredients })
  }

  if (recipes.length === 0)
    throw new Error(`Keine Rezepte gefunden unter ${dir}`)
  return { recipes, skipped }
}

// ---------------------------------------------------------------------------
// Ableitung
// ---------------------------------------------------------------------------

/**
 * Allergene eines Rezepts.
 *
 * Jede Zutatenzeile muss vollständig aufgelöst werden: erst über die
 * Zutaten-Datenbank aus `hq` (normalisierter Teilstring auf dem Namen), dann
 * Wort für Wort über {@link WORD_RULES}. Bleibt ein Wort übrig, das keine
 * Regel kennt, gilt das ganze Rezept als nicht belegbar.
 */
function deriveRecipe(recipe, db) {
  const allergens = new Set()
  const unresolved = []
  const reviews = []
  const usedDbEntries = new Set()

  for (const text of recipe.ingredients) {
    const flat = normalise(text).replace(/\s+/g, ' ')

    // 1. Zutaten-Datenbank: normalisierter Teilstring auf Name bzw. Schlüssel.
    for (const [token, entry] of db.lookup) {
      if (flat.includes(token)) {
        for (const allergen of entry.allergens) allergens.add(allergen)
        usedDbEntries.add(entry.key)
      }
    }

    // 2. Wortregeln — sie müssen jedes Wort abdecken.
    for (const word of words(text)) {
      const hit = resolveWord(word)
      if (!hit) {
        unresolved.push({ recipe: recipe.title, file: recipe.file, text, word })
        continue
      }
      for (const allergen of hit.allergens) allergens.add(allergen)
      if (hit.rule?.review)
        reviews.push({ recipe: recipe.title, text, note: hit.rule.note })
    }
  }

  // 3. Glutenhaltiges Getreide zieht immer "gluten" nach sich (Anhang II Nr. 1).
  if ([...allergens].some((a) => GLUTEN_CEREALS.includes(a)))
    allergens.add('gluten')

  const unknown = [...allergens].filter((a) => !ALLERGEN_KEYS.includes(a))
  if (unknown.length) {
    throw new Error(
      `Rezept "${recipe.title}" ergibt unbekannte Allergene: ${unknown.join(
        ', '
      )}`
    )
  }

  return {
    allergens: [...allergens].sort(),
    unresolved,
    reviews,
    usedDbEntries: [...usedDbEntries],
    blocked: unresolved.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Produkte
// ---------------------------------------------------------------------------

/**
 * Größenangaben, die ein Produkt vom Rezept trennen. "Kornbrot 500g" ist
 * dasselbe Gebäck wie "Kornbrot", "Baguette groß" dasselbe wie "Baguette".
 */
function productMatchKey(name) {
  let value = normalise(name)
  value = value.replace(/\(\s*1\s*\/\s*4\s*stueck\s*\)/g, ' ')
  value = value.replace(/\(\s*1\s*stueck\s*\)/g, ' ')
  value = value.replace(/\b\d+\s*(g|kg|ml|l)\b/g, ' ')
  value = value.replace(/\b(gross|klein|mittel)\b/g, ' ')
  return value.replace(/[^a-z0-9]/g, '')
}

/**
 * Von Hand geprüfte Zuordnungen, die die Namensregel nicht findet.
 * Schlüssel ist die Produkt-`id`, Wert der Rezepttitel.
 *
 * Jeder Eintrag braucht eine Begründung. Ohne Beleg gehört hier nichts hinein —
 * "klingt ähnlich" ist kein Beleg.
 */
const PRODUCT_RECIPE_ALIASES = {
  // Tippfehler im Produktnamen: "Schwabenkornt 500g". Der Fließtext derselben
  // Datei schreibt "Das Schwabenkorn 500g ist …", und das 1000g-Geschwister
  // heißt korrekt "Schwabenkorn 1000g".
  'schwabenkornt-500g': 'Schwabenkorn',
}

/** Liest das Frontmatter eines Produkts ohne es zu verändern. */
function readProduct(file) {
  const raw = readFileSync(file, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return null
  const front = match[1]
  const value = (key) => {
    const hit = front.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    if (!hit) return undefined
    return hit[1].trim().replace(/^["']|["']$/g, '')
  }
  return {
    file,
    raw,
    front,
    frontStart: match[0],
    body: raw.slice(match[0].length),
    id: value('id'),
    name: value('name'),
    category: value('category'),
    allergens: value('allergens'),
    allergensSource: value('allergens_source'),
    allergenRecipe: value('allergen_recipe'),
  }
}

/** YAML-Skalar: nur quoten, wenn es sein muss. */
function yamlScalar(value) {
  return /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .\-_/()&+']*$/.test(value)
    ? value
    : `"${value.replace(/"/g, '\\"')}"`
}

const MANAGED_KEYS = ['allergens', 'allergens_source', 'allergen_recipe']

/**
 * Setzt die drei Keys im Frontmatter — als Textoperation, nicht über einen
 * YAML-Serialisierer.
 *
 * Der Grund steht in `CLAUDE.md`: `hq/products/*.md` hat eine feste
 * Schlüsselreihenfolge und eine eigene Quoting-Konvention (`image` und
 * `short_description` in Anführungszeichen, `price` ohne). Ein Round-Trip
 * durch einen Serialisierer formatiert die ganze Datei um. Hier wird deshalb
 * nur angehängt bzw. der eigene Block ersetzt; jedes andere Zeichen der Datei
 * bleibt, wie es war.
 *
 * @param {object} product
 * @param {{allergens: string[], source: string, recipe?: string} | null} data
 *   `null` entfernt die Keys wieder.
 * @returns {string} der neue Dateiinhalt
 */
function applyFrontmatter(product, data) {
  const kept = []
  const lines = product.front.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const key = lines[i].match(/^([A-Za-z0-9_]+):/)?.[1]
    if (key && MANAGED_KEYS.includes(key)) {
      // Auch einen eventuellen Block-Stil (`allergens:` gefolgt von "  - x")
      // vollständig entfernen.
      while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) i += 1
      continue
    }
    kept.push(lines[i])
  }
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop()

  if (data) {
    kept.push(`allergens: [${data.allergens.join(', ')}]`)
    kept.push(`allergens_source: ${data.source}`)
    if (data.recipe) kept.push(`allergen_recipe: ${yamlScalar(data.recipe)}`)
  }

  const eol = product.raw.includes('\r\n') ? '\r\n' : '\n'
  return `---${eol}${kept.join(eol)}${eol}---${eol}${product.body}`
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const verbose = argv.includes('--verbose')
  const unknownFlags = argv.filter(
    (a) => !['--write', '--dry-run', '--verbose'].includes(a)
  )
  if (unknownFlags.length) {
    console.error(`Unbekannte Option: ${unknownFlags.join(', ')}`)
    process.exit(2)
  }

  const db = loadIngredientDatabase(INGREDIENT_DB)
  const { recipes, skipped } = loadRecipes(RECIPES_DIR)

  // Rezepttitel müssen eindeutig sein, sonst ist die Zuordnung nicht sicher.
  const byKey = new Map()
  const ambiguous = new Set()
  for (const recipe of recipes) {
    if (byKey.has(recipe.key)) ambiguous.add(recipe.key)
    byKey.set(recipe.key, recipe)
  }
  for (const key of ambiguous) byKey.delete(key)

  const derived = new Map()
  for (const recipe of recipes)
    derived.set(recipe.file, deriveRecipe(recipe, db))

  const productFiles = readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))

  const report = {
    written: [],
    unchanged: [],
    cleared: [],
    confirmed: [],
    unmatched: [],
    blocked: [],
  }

  for (const fileName of productFiles) {
    const file = join(PRODUCTS_DIR, fileName)
    const product = readProduct(file)
    if (!product || !product.id || !product.name) {
      report.unmatched.push({
        name: fileName,
        category: '?',
        reason: 'kein lesbares Frontmatter',
      })
      continue
    }

    // Von der Bäckerei bestätigte Angaben sind stärker als jede Ableitung.
    if (product.allergensSource === 'geprueft') {
      report.confirmed.push(product)
      continue
    }

    const aliasTitle = PRODUCT_RECIPE_ALIASES[product.id]
    const recipe = aliasTitle
      ? recipes.find((r) => r.title === aliasTitle)
      : byKey.get(productMatchKey(product.name))

    if (!recipe) {
      const reason = ambiguous.has(productMatchKey(product.name))
        ? 'mehrdeutig: mehrere Rezepte mit diesem Namen'
        : 'kein Rezept mit diesem Namen'
      report.unmatched.push({
        name: product.name,
        category: product.category,
        reason,
      })
      if (product.allergens !== undefined) {
        const next = applyFrontmatter(product, null)
        if (next !== product.raw) {
          report.cleared.push(product.name)
          if (write) writeFileSync(file, next, 'utf8')
        }
      }
      continue
    }

    const result = derived.get(recipe.file)
    if (result.blocked) {
      report.blocked.push({ name: product.name, recipe: recipe.title })
      continue
    }

    const next = applyFrontmatter(product, {
      allergens: result.allergens,
      source: 'rezept',
      recipe: recipe.title,
    })
    if (next === product.raw) {
      report.unchanged.push(product.name)
    } else {
      report.written.push({
        name: product.name,
        category: product.category,
        recipe: recipe.title,
        allergens: result.allergens,
        alias: Boolean(aliasTitle),
      })
      if (write) writeFileSync(file, next, 'utf8')
    }
  }

  // -------------------------------------------------------------------------
  // Bericht
  // -------------------------------------------------------------------------

  const rel = (p) => relative(WORKSPACE, p)
  const mode = write
    ? 'SCHREIBEN'
    : 'VORSCHAU (nichts geschrieben, --write zum Anwenden)'
  console.log(`\nAllergene aus Rezepten ableiten — ${mode}`)
  console.log(
    `  Zutaten-Datenbank: ${rel(INGREDIENT_DB)} (${db.entries.length} Zutaten)`
  )
  console.log(
    `  Rezepte:           ${rel(RECIPES_DIR)} (${
      recipes.length
    } mit "## Zutaten")`
  )
  console.log(
    `  Produkte:          ${rel(PRODUCTS_DIR)} (${
      productFiles.length
    } Dateien)\n`
  )

  const total = report.written.length + report.unchanged.length
  console.log(`Deklariert:        ${total} Produkte`)
  console.log(`  davon geändert:  ${report.written.length}`)
  console.log(`  bereits aktuell: ${report.unchanged.length}`)
  if (report.confirmed.length)
    console.log(
      `Von der Bäckerei bestätigt (unangetastet): ${report.confirmed.length}`
    )
  if (report.cleared.length)
    console.log(
      `Veraltete Angaben entfernt: ${
        report.cleared.length
      } (${report.cleared.join(', ')})`
    )
  console.log(
    `Ohne Angabe:       ${
      report.unmatched.length + report.blocked.length
    } Produkte\n`
  )

  if (verbose && report.written.length) {
    console.log('Geändert:')
    for (const item of report.written) {
      console.log(
        `  ${item.name.padEnd(34)} ← ${item.recipe.padEnd(
          24
        )} [${item.allergens.join(', ')}]` +
          (item.alias ? '  (von Hand zugeordnete Ausnahme)' : '')
      )
    }
    console.log('')
  }

  // Lücke 1: Produkte ohne Rezept.
  const byCategory = new Map()
  for (const item of report.unmatched) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, [])
    byCategory.get(item.category).push(item)
  }
  console.log(
    `Produkte ohne Deklaration (${report.unmatched.length}) — bewusst keine Angabe:`
  )
  for (const [category, items] of [...byCategory].sort()) {
    console.log(`  ${category} (${items.length}):`)
    for (const item of items)
      console.log(`    - ${item.name}  [${item.reason}]`)
  }
  console.log('')

  if (report.blocked.length) {
    console.log(
      `Rezept vorhanden, aber nicht belegbar (${report.blocked.length}):`
    )
    for (const item of report.blocked)
      console.log(`  - ${item.name} (Rezept "${item.recipe}")`)
    console.log('')
  }

  // Lücke 2: Zutaten, die keine Regel kennt.
  const unresolved = new Map()
  for (const result of derived.values()) {
    for (const item of result.unresolved) {
      const key = `${item.word}|${item.text}`
      if (!unresolved.has(key))
        unresolved.set(key, { ...item, recipes: new Set() })
      unresolved.get(key).recipes.add(item.recipe)
    }
  }
  if (unresolved.size) {
    console.log(
      `Nicht aufgelöste Zutaten (${unresolved.size}) — blockieren ihr Rezept:`
    )
    for (const item of unresolved.values()) {
      console.log(
        `  - "${item.word}" in "${item.text}" (${[...item.recipes].join(', ')})`
      )
    }
    console.log('')
  } else {
    console.log('Nicht aufgelöste Zutaten: keine.\n')
  }

  // Rezepte, die zu keinem Produkt gehören.
  const usedRecipes = new Set(report.written.map((i) => i.recipe))
  for (const name of report.unchanged) {
    const product = productFiles
      .map((f) => readProduct(join(PRODUCTS_DIR, f)))
      .find((p) => p?.name === name)
    if (product?.allergenRecipe) usedRecipes.add(product.allergenRecipe)
  }
  const orphanRecipes = recipes.filter((r) => !usedRecipes.has(r.title))
  if (orphanRecipes.length) {
    console.log(`Rezepte ohne Produkt (${orphanRecipes.length}):`)
    for (const recipe of orphanRecipes)
      console.log(`  - ${recipe.title}  (${rel(recipe.file)})`)
    console.log('')
  }

  if (skipped.length) {
    console.log(`Übergangene Rezeptdateien (${skipped.length}):`)
    for (const item of skipped)
      console.log(`  - ${rel(item.file)}: ${item.reason}`)
    console.log('')
  }

  // Konservative Annahmen, die jemand bestätigen sollte.
  const reviews = new Map()
  for (const result of derived.values()) {
    for (const item of result.reviews) {
      if (!reviews.has(item.note)) reviews.set(item.note, new Set())
      reviews.get(item.note).add(`${item.recipe}: ${item.text}`)
    }
  }
  if (reviews.size) {
    console.log(
      'Konservative Annahmen (im Zweifel dazu — bitte in der Backstube bestätigen):'
    )
    for (const [note, where] of reviews) {
      console.log(`  - ${note}`)
      for (const entry of [...where].sort()) console.log(`      ${entry}`)
    }
    console.log('')
  }

  if (!write) console.log('Nichts geschrieben. Mit --write anwenden.\n')
}

main()
