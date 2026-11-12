'use strict'

/**
 * Der eine Leser für `hq/products/*.md` der statischen Apps (Landingpage,
 * Digitale Bäckerei): Verzeichnis finden, Dateien lesen, Frontmatter parsen.
 * Was eine App daraus macht (Ersatzbilder, Kategorie-Namen, Mock-Fallback,
 * Snapshot ohne Preise), bleibt in der App.
 *
 * Form: CommonJS mit JSDoc-Typen wie die `*.core.js` der API - so läuft die
 * Datei ohne Build und ohne TypeScript in einem Node-Skript
 * (`require('../../../libs/shared/hq-products/src/index.js')`) und genauso in
 * Next und jest über den Alias `@bakery/shared/hq-products`
 * (tsconfig.base.json). Einzige Abhängigkeit: `gray-matter`. Nur zur Bauzeit /
 * auf dem Server benutzen (liest das Dateisystem).
 *
 * Nicht für die API: die hat ihren eigenen Leser mit Schreibweg
 * (apps/bakery-api/src/services/hq-products.*).
 */
const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')

/**
 * Ein Produkt, wie es in hq steht - nichts ergänzt, nichts ersetzt. Felder,
 * die in der Datei fehlen, fehlen hier auch (`undefined`).
 *
 * @typedef {object} HqProductRecord
 * @property {string} file Dateiname, z. B. `1-testbrot-500g.md`
 * @property {string} id hq-ID ohne Nummer, z. B. `testbrot-500g`
 * @property {number | undefined} numeric_id
 * @property {string} name
 * @property {string} category
 * @property {number | undefined} price
 * @property {boolean | undefined} available
 * @property {boolean | undefined} seasonal
 * @property {string | undefined} image
 * @property {string | number | undefined} weight Text wie `750g` oder Gramm als Zahl
 * @property {string | undefined} short_description
 * @property {string} body Text nach dem Frontmatter ohne die erste Überschrift (`''` ohne Text)
 */

/**
 * @typedef {object} HqProductsResult
 * @property {string} dir das gelesene Verzeichnis
 * @property {boolean} found `false`: das Verzeichnis gibt es nicht (kein hq)
 * @property {HqProductRecord[]} products in der Reihenfolge des Verzeichnisses
 */

/**
 * Wurzel des Monorepos: der nächste Ordner aufwärts mit `nx.json` (höchstens
 * fünf Ebenen), sonst `startDir`.
 * @param {string} [startDir]
 * @returns {string}
 */
function findMonorepoRoot(startDir = process.cwd()) {
  let dir = startDir
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir
    dir = path.dirname(dir)
  }
  return startDir
}

/**
 * `HQ_PRODUCTS_DIR`, sonst `<monorepo>/../hq/products`.
 * @param {{ env?: Record<string, string | undefined>, cwd?: string }} [options]
 * @returns {string}
 */
function resolveHqProductsDir(options = {}) {
  const env = options.env || process.env
  if (env.HQ_PRODUCTS_DIR) return env.HQ_PRODUCTS_DIR
  return path.join(findMonorepoRoot(options.cwd), '..', 'hq', 'products')
}

/**
 * Produktdateien eines Verzeichnisses: `*.md` ohne die mit `_` am Anfang
 * (Vorlage).
 * @param {string} dir
 * @returns {string[]}
 */
function listHqProductFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
}

/**
 * Parst den Inhalt einer Produktdatei. `null`, wenn `id` oder `name` fehlen.
 * Wirft, wenn das Frontmatter kein gültiges YAML ist.
 * @param {string} raw
 * @param {string} [file]
 * @returns {HqProductRecord | null}
 */
function parseHqProduct(raw, file = '') {
  const { data, content } = matter(raw)
  if (!data.id || !data.name) return null
  return {
    file,
    id: data.id,
    numeric_id: data.numeric_id,
    name: data.name,
    category: data.category,
    price: data.price,
    available: data.available,
    seasonal: data.seasonal,
    image: data.image,
    weight: data.weight,
    short_description: data.short_description,
    body: content
      .trim()
      .replace(/^#{1,6}[^\n]*\n+/, '')
      .trim(),
  }
}

/**
 * Liest alle Produkte. Gibt es das Verzeichnis nicht, ist `found` false und
 * die Liste leer - ob das ein Fehler ist, entscheidet die App. Dateien, die
 * sich nicht lesen oder parsen lassen oder denen `id`/`name` fehlen, werden
 * übersprungen.
 * @param {{ dir?: string, env?: Record<string, string | undefined>, cwd?: string }} [options]
 * @returns {HqProductsResult}
 */
function readHqProducts(options = {}) {
  const dir = options.dir || resolveHqProductsDir(options)
  if (!fs.existsSync(dir)) return { dir, found: false, products: [] }
  /** @type {HqProductRecord[]} */
  const products = []
  for (const file of listHqProductFiles(dir)) {
    try {
      const product = parseHqProduct(
        fs.readFileSync(path.join(dir, file), 'utf-8'),
        file
      )
      if (product) products.push(product)
    } catch {
      // unlesbare oder kaputte Datei: überspringen
    }
  }
  return { dir, found: true, products }
}

module.exports = {
  findMonorepoRoot,
  resolveHqProductsDir,
  listHqProductFiles,
  parseHqProduct,
  readHqProducts,
}
