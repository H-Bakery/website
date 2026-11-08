// HQ product files follow a fixed frontmatter convention. Re-serialising them
// with matter.stringify() reorders keys and strips the quotes the files use,
// which turns every save into a noisy git diff. Write them by hand instead.
//
// Dependency-free CommonJS: die API (`hq-products.service.ts`) und die Tests
// benutzen dieselbe Implementierung.

const FRONTMATTER_ORDER = [
  'id',
  'numeric_id',
  'name',
  'category',
  'price',
  'weight',
  'available',
  'seasonal',
  'tags',
  'image',
  'short_description',
]
const ALWAYS_QUOTED = new Set(['image', 'short_description'])

/**
 * Texte, die YAML (gray-matter: js-yaml 3, YAML 1.1) ungequotet als etwas
 * anderes liest oder gar nicht parsen kann. Lieber einmal zu oft quoten:
 * ein ungequoteter Name, der zur Zahl wird oder die Datei unlesbar macht,
 * nimmt das Produkt aus allen Listen (B5-Review).
 */
const NEEDS_QUOTES = [
  // Indikatorzeichen am Anfang - auch Anführungszeichen, `?` und `:`.
  /^[\s>|*&!%@`{}[\],#?:'"-]/,
  // `: ` / ` #` mitten im Text, `:` am Ende (Schlüssel-Syntax).
  /:\s|\s#|:$/,
  // null / bool, alle Schreibweisen von YAML 1.1.
  /^(true|false|null|yes|no|on|off|y|n|~)$/i,
  // Zahlen: dezimal, mit `_`, Exponent, hex/oktal/binär, Sexagesimal.
  /^[-+]?[\d.][\d_.:a-fA-FxXoObB+-]*$/,
  // .inf / .nan
  /^[-+]?\.(inf|nan)$/i,
  // Datum/Zeitstempel (wird zu Date).
  /^\d{4}-\d\d?-\d\d?/,
  // Steuerzeichen (Zeilenumbruch, Tab, ...) nur in doppelten Anführungszeichen.
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f]/,
]

function yamlScalar(key, value) {
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value)
  const str = String(value ?? '')
  const needsQuotes =
    ALWAYS_QUOTED.has(key) ||
    str === '' ||
    str !== str.trim() ||
    NEEDS_QUOTES.some((pattern) => pattern.test(str))
  return needsQuotes ? JSON.stringify(str) : str
}

/**
 * Ein Element einer Inline-Liste. Dort sind zusaetzlich Komma und Klammern
 * bedeutungstragend, die muessen also auch dann in Anfuehrungszeichen.
 */
function yamlFlowItem(key, value) {
  const scalar = yamlScalar(key, value)
  if (scalar.startsWith('"')) return scalar
  return /[,[\]{}]/.test(scalar) ? JSON.stringify(scalar) : scalar
}

function serializeProductFile(data, body) {
  const keys = [
    ...FRONTMATTER_ORDER.filter((k) => data[k] !== undefined),
    ...Object.keys(data).filter((k) => !FRONTMATTER_ORDER.includes(k)),
  ]
  const lines = ['---']
  for (const key of keys) {
    const value = data[key]
    if (Array.isArray(value)) {
      // hq notiert Listen inline (`allergens: [gluten, weizen]`). Block-Syntax
      // wuerde hier aus jedem Speichern ein Mehrzeilen-Diff machen.
      const items = value.map((item) => yamlFlowItem(key, item))
      lines.push(`${key}: [${items.join(', ')}]`)
    } else {
      lines.push(`${key}: ${yamlScalar(key, value)}`)
    }
  }
  lines.push('---', '')
  return `${lines.join('\n')}\n${body.trim()}\n`
}

module.exports = { FRONTMATTER_ORDER, serializeProductFile }
