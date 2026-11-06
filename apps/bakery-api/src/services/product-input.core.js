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

/**
 * Obergrenzen (W4-Verifikation): ein Name mit 100 000 Zeichen landete in hq,
 * einer mit 5000 scheiterte erst am Dateinamen (ENAMETOOLONG, 500). Die
 * echten Produkte liegen weit darunter.
 */
const PRODUCT_LIMITS = Object.freeze({
  name: 120,
  short_description: 500,
  image: 500,
  description: 20000,
  price: 10000,
})

/**
 * Steuerzeichen: NUL brach den git-Commit (500 `hq_commit_failed`), Bidi-
 * Steuerzeichen drehen Namen optisch um. Im Langtext bleiben Zeilenumbruch
 * und Tab erlaubt.
 */
const {
  NAME_CONTROL_CHARS: NAME_CONTROL,
  TEXT_CONTROL_CHARS: TEXT_CONTROL,
} = require('./control-chars.core')

const MESSAGES = Object.freeze({
  name: 'Produktname ist erforderlich',
  nameTooLong: `Produktname ist zu lang (höchstens ${PRODUCT_LIMITS.name} Zeichen)`,
  nameControl: 'Produktname enthält unzulässige Steuerzeichen',
  priceRange: `Preis muss zwischen 0 und ${PRODUCT_LIMITS.price} € liegen`,
  priceCents: 'Preis höchstens mit zwei Nachkommastellen angeben',
  textTooLong: 'Text ist zu lang',
  textControl: 'Text enthält unzulässige Steuerzeichen',
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
    if (input.name.trim().length > PRODUCT_LIMITS.name) {
      return MESSAGES.nameTooLong
    }
    if (NAME_CONTROL.test(input.name)) return MESSAGES.nameControl
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
    if (price > PRODUCT_LIMITS.price) return MESSAGES.priceRange
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
      return MESSAGES.priceCents
    }
  }
  for (const key of ['available', 'seasonal']) {
    if (present(key) && typeof input[key] !== 'boolean') return MESSAGES.flag
  }
  for (const key of ['short_description', 'image', 'description']) {
    if (!present(key)) continue
    if (typeof input[key] !== 'string') return MESSAGES.text
    if (input[key].length > PRODUCT_LIMITS[key]) return MESSAGES.textTooLong
    if (TEXT_CONTROL.test(input[key])) return MESSAGES.textControl
  }
  return null
}

module.exports = {
  MESSAGES,
  PRODUCT_LIMITS,
  PRODUCT_CATEGORIES,
  parsePrice,
  validateProductInput,
}
