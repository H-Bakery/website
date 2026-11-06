/**
 * hq-Produkte (B5): Regeln für Lesen und Schreiben von `hq/products/*.md`,
 * aus `simple-server.js` herausgelöst (D3: der Vertrag des Mock-Servers gilt).
 *
 * Dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`:
 * hier stehen nur reine Funktionen. Dateien lesen, YAML parsen (gray-matter)
 * und git aufrufen macht `hq-catalogue.ts` / `hq-products.service.ts`; sie
 * reichen die geparsten `{ data, content }` herein.
 *
 * Serialisiert wird ausschließlich mit `serializeProductFile()` aus
 * `product-file.core.js` (Schlüsselreihenfolge, Anführungszeichen) - ein
 * Speichern ohne Änderung ergibt dieselbe Datei, Byte für Byte.
 */

/** Name und Adresse des App-Autors in hq (D6). */
const APP_AUTHOR = Object.freeze({
  name: 'Verwaltung (App)',
  email: 'verwaltung@bakery.local',
})

/** Dateien in `products/`, die Produkte sind (`_template.md` u. ä. nicht). */
function isProductFileName(file) {
  return (
    typeof file === 'string' && file.endsWith('.md') && !file.startsWith('_')
  )
}

/**
 * Body ohne die führende `# Überschrift`-Zeile. Auch ein Body, der nur aus
 * der Überschrift besteht (Produkt ohne Beschreibung), ergibt `''` - nach
 * dem `trim()` fehlt dort der Zeilenumbruch hinter der Überschrift.
 */
function stripHeading(body) {
  return String(body ?? '')
    .trim()
    .replace(/^#{1,6}[^\n]*(\n+|$)/, '')
    .trim()
}

/** "Käse-Brötchen 500g" -> "kaese-broetchen-500g" */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Ein Produkt aus geparster Frontmatter + Body - dieselbe Form wie
 * `loadHQProducts()` im Mock (`HQProduct`). `null`, wenn `id` oder `name`
 * fehlt (solche Dateien sind keine Produkte).
 */
function toHqProduct(data, content) {
  if (!data || typeof data !== 'object' || !data.id || !data.name) return null
  return {
    id: data.id,
    numeric_id: data.numeric_id,
    name: data.name,
    category: data.category,
    price: data.price,
    available: data.available ?? true,
    seasonal: data.seasonal ?? false,
    image: data.image || null,
    short_description: data.short_description || '',
    // Pflichtangaben nach LMIV. Bewusst nur durchgereicht, nie ergänzt:
    // fehlende Angaben müssen im Shop als fehlend sichtbar bleiben.
    allergens: Array.isArray(data.allergens) ? data.allergens : null,
    allergens_source: data.allergens_source || null,
    allergen_recipe: data.allergen_recipe || null,
    // Shop-Sicht: ohne eigenen Text steht der Kurztext da. Die Verwaltung
    // braucht den echten Body - `rawDescription` (siehe `managedFields`).
    description: stripHeading(content) || data.short_description || '',
  }
}

/**
 * Zusatzfelder der Verwaltungssicht (`/api/hq-products[/:id]`, F4):
 * `rawDescription` ist der Body der Datei ohne Überschrift, **ohne** den
 * Rückgriff auf `short_description`, den `description` für den Shop hat.
 * Das Bearbeiten-Formular schickt `description` immer mit; läse es den
 * Rückgriff, schriebe ein Speichern ohne Änderung den Kurztext in den Body
 * einer Datei ohne Beschreibung (Null-Diff-Invariante).
 */
function managedFields(content) {
  return { rawDescription: stripHeading(content) }
}

/** Sortierung wie im Mock: nach `numeric_id`, fehlende zuerst. */
function sortProducts(products) {
  return [...products].sort((a, b) => (a.numeric_id || 0) - (b.numeric_id || 0))
}

/**
 * `?category=` wie im Mock: fehlt oder leer -> alle; ein Text filtert; alles
 * andere (`?category=a&category=b` ist ein Array) trifft keine Kategorie -
 * der Mock vergleicht mit `===` und liefert dann eine leere Liste.
 */
function filterByCategory(products, category) {
  if (category === undefined || category === null || category === '') {
    return products
  }
  if (typeof category !== 'string') return []
  return products.filter((p) => p.category === category)
}

/**
 * Lookup für Snapshots (B6/B7): Slug (`"kornbrot-500g"`) oder `numeric_id`
 * (als Zahl oder als Text `"1"`).
 */
function findProduct(products, key) {
  if (key === undefined || key === null || key === '') return null
  if (typeof key === 'number') {
    return products.find((p) => p.numeric_id === key) || null
  }
  const text = String(key)
  return (
    products.find((p) => p.id === text) ||
    products.find(
      (p) => p.numeric_id !== undefined && String(p.numeric_id) === text
    ) ||
    null
  )
}

/**
 * PUT: neue Frontmatter + neuer Body aus Original und (geprüftem) Body.
 * Exakt die Regeln des Mocks: nur mitgeschickte Felder ändern sich,
 * `description` ersetzt den ganzen Body unter neuer Überschrift, ein neuer
 * Name ohne `description` setzt nur die Überschrift neu.
 *
 * @param {object} originalData  Frontmatter der Datei (wird nicht verändert)
 * @param {string} originalContent  Body der Datei
 * @param {object} input  Request-Body, vorher mit `validateProductInput` geprüft
 * @param {(price: unknown) => number} parsePrice  aus `product-input.core.js`
 */
function applyProductUpdate(originalData, originalContent, input, parsePrice) {
  const body = input || {}
  const data = { ...originalData }
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.category !== undefined) data.category = body.category
  if (body.price !== undefined) data.price = parsePrice(body.price)
  if (body.short_description !== undefined)
    data.short_description = body.short_description
  if (body.image !== undefined) data.image = body.image
  if (body.available !== undefined) data.available = body.available
  if (body.seasonal !== undefined) data.seasonal = body.seasonal

  let text = String(originalContent ?? '').trim()
  if (body.description !== undefined) {
    text = `# ${data.name}\n\n${String(body.description).trim()}`
  } else if (body.name !== undefined) {
    text = text.replace(/^#{1,6}[^\n]*/, `# ${data.name}`)
  }
  return { data, body: text }
}

/** Antwort auf PUT/POST wie im Mock: Frontmatter + `description` ohne Überschrift. */
function writeResponse(data, body) {
  return { ...data, description: stripHeading(body) }
}

/**
 * POST: Frontmatter, Body und Dateiname eines neuen Produkts. Die ID ist der
 * Slug des Namens, `numeric_id` die nächste freie Nummer über **alle**
 * bekannten Produkte (Lese-Klon und Schreib-Worktree).
 *
 * @returns {{ ok: true, data: object, body: string, fileName: string }
 *   | { ok: false, status: number, error: string, message: string }}
 */
function buildNewProduct(input, existing, parsePrice) {
  const body = input || {}
  const id = slugify(body.name)
  if (!id) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_id',
      message: 'Aus dem Namen lässt sich keine ID ableiten',
    }
  }
  if (existing.some((p) => p.id === id)) {
    return {
      ok: false,
      status: 409,
      error: 'product_exists',
      message: `Ein Produkt mit der ID "${id}" existiert bereits`,
    }
  }
  const numericId =
    existing.reduce((max, p) => Math.max(max, Number(p.numeric_id) || 0), 0) + 1
  const data = {
    id,
    numeric_id: numericId,
    name: String(body.name).trim(),
    category: String(body.category).trim(),
    price: parsePrice(body.price),
    available: body.available !== false,
    seasonal: body.seasonal === true,
    image: body.image ? String(body.image).trim() : '',
    short_description: body.short_description
      ? String(body.short_description).trim()
      : '',
  }
  const text = `# ${data.name}\n\n${String(body.description || '').trim()}`
  return { ok: true, data, body: text, fileName: `${numericId}-${id}.md` }
}

/** Strukturgleichheit von YAML-Werten (Schlüsselreihenfolge egal). */
function sameValue(a, b) {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b)
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameValue(item, b[i]))
    )
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a).filter((k) => a[k] !== undefined)
    const keysB = Object.keys(b).filter((k) => b[k] !== undefined)
    return (
      keysA.length === keysB.length &&
      keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k)) &&
      keysA.every((k) => sameValue(a[k], b[k]))
    )
  }
  return false
}

/**
 * Prüft eine serialisierte Datei, bevor sie geschrieben wird: liest der
 * YAML-Parser genau die Frontmatter zurück, die gemeint war, und bleibt es ein
 * Produkt? `parsed` ist das Ergebnis von gray-matter (oder `null`, wenn es
 * geworfen hat). Sonst würde eine unlesbare Datei committet, die aus allen
 * Listen fällt und die rollende PR blockiert (B5-Review).
 *
 * @returns {boolean}
 */
function roundTripsAs(parsed, data, body) {
  if (!parsed || !parsed.data) return false
  if (!sameValue(parsed.data, data)) return false
  if (String(parsed.content ?? '').trim() !== String(body ?? '').trim()) {
    return false
  }
  return toHqProduct(parsed.data, parsed.content) !== null
}

/** Eine Zeile ohne Zeilenumbrüche und spitze Klammern (git-Trailer). */
function oneLine(value, fallback) {
  const text = String(value ?? '')
    .replace(/[\r\n<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

/** `Co-authored-by: Anna <anna@bakery.local>` für den Bearbeiter (D6). */
function coAuthorTrailer(user) {
  const username = oneLine(user && user.username, 'unbekannt')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
  const name = oneLine(user && user.displayName, username)
  return `Co-authored-by: ${name} <${username}@bakery.local>`
}

/**
 * Commit-Nachricht für hq: eine Betreffzeile, Leerzeile, Trailer.
 * `action`: `'update'` oder `'create'`.
 */
function commitMessage(action, product, user) {
  const verb = action === 'create' ? 'angelegt' : 'geändert'
  const id = oneLine(product && product.id, 'unbekannt')
  const name = oneLine(product && product.name, id)
  return `products: ${name} (${id}) ${verb}\n\n${coAuthorTrailer(user)}\n`
}

module.exports = {
  APP_AUTHOR,
  applyProductUpdate,
  buildNewProduct,
  coAuthorTrailer,
  commitMessage,
  filterByCategory,
  findProduct,
  isProductFileName,
  roundTripsAs,
  sameValue,
  slugify,
  sortProducts,
  stripHeading,
  toHqProduct,
  managedFields,
  writeResponse,
}
