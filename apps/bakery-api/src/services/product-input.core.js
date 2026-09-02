/**
 * Prüfung der Produktdaten, die über `PUT /api/hq-products/:id` und
 * `POST /api/hq-products` in die git-versionierten Dateien `hq/products/*.md`
 * geschrieben werden.
 *
 * Dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`:
 * der Mock-Server (`simple-server.js`) und die Tests
 * (`tests/unit/productInputValidation.test.js`) benutzen dieselbe
 * Implementierung.
 *
 * Warum es diese Datei gibt: `PUT` hat vorher nichts geprüft. `{"price":"abc"}`
 * schrieb `price: NaN` in die Datei, danach zeigten Landing, Shop und
 * Verwaltung „NaN"; `{"name":""}` ließ das Produkt aus allen Listen
 * verschwinden; eine unbekannte Kategorie wurde wörtlich übernommen. Weil die
 * Dateien in `hq` liegen, blieb so ein Fehler bis zum nächsten `git checkout`
 * bestehen.
 *
 * `partial: true` (PUT) prüft nur die Felder, die mitgeschickt wurden;
 * `partial: false` (POST) verlangt Name, Kategorie und Preis.
 */

/** Die sieben Kategorien aus `hq/products` (siehe CLAUDE.md). */
const PRODUCT_CATEGORIES = Object.freeze([
  'brot',
  'broetchen',
  'baguette',
  'teilchen',
  'snacks',
  'kuchen',
  'torten',
])

const MESSAGES = Object.freeze({
  name: 'Produktname ist erforderlich',
  category: 'Unbekannte Kategorie',
  categoryRequired: 'Kategorie ist erforderlich',
  price: 'Preis ist ungültig',
  flag: 'Verfügbarkeit muss true oder false sein',
  text: 'Ungültige Eingabe',
})

/**
 * Preis als Zahl - `Number`, nicht `parseFloat`, damit „2abc" nicht als 2
 * durchgeht. Leere Strings wären mit `Number('')` 0, deshalb vorher abfangen.
 */
function parsePrice(price) {
  if (typeof price === 'string' && price.trim() === '') return NaN
  if (typeof price !== 'number' && typeof price !== 'string') return NaN
  return Number(price)
}

function isValidName(name) {
  return typeof name === 'string' && name.trim() !== '' && !/[\r\n]/.test(name)
}

/**
 * @param {object} body  Request-Body
 * @param {{ partial: boolean }} options  `partial: true` für PUT
 * @returns {string | null}  deutsche Fehlermeldung oder `null`, wenn gültig
 */
function validateProductInput(body, options) {
  const partial = Boolean(options && options.partial)
  const input = body && typeof body === 'object' ? body : {}
  const present = (key) => input[key] !== undefined

  if (present('name') || !partial) {
    if (!isValidName(input.name)) return MESSAGES.name
  }
  if (present('category') || !partial) {
    if (!partial && (input.category === undefined || input.category === '')) {
      return MESSAGES.categoryRequired
    }
    if (!PRODUCT_CATEGORIES.includes(input.category)) return MESSAGES.category
  }
  if (present('price') || !partial) {
    const price = parsePrice(input.price)
    if (!Number.isFinite(price) || price < 0) return MESSAGES.price
  }
  for (const key of ['available', 'seasonal']) {
    if (present(key) && typeof input[key] !== 'boolean') return MESSAGES.flag
  }
  for (const key of ['short_description', 'image', 'description']) {
    if (present(key) && typeof input[key] !== 'string') return MESSAGES.text
  }
  return null
}

module.exports = {
  MESSAGES,
  PRODUCT_CATEGORIES,
  parsePrice,
  validateProductInput,
}
