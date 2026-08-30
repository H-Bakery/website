// HQ product files follow a fixed frontmatter convention. Re-serialising them
// with matter.stringify() reorders keys and strips the quotes the files use,
// which turns every save into a noisy git diff. Write them by hand instead.
//
// Dependency-free CommonJS: der Mock-Server und die Tests benutzen dieselbe
// Implementierung, damit beide nicht auseinanderlaufen.

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

function yamlScalar(key, value) {
  if (typeof value === 'boolean' || typeof value === 'number')
    return String(value)
  const str = String(value ?? '')
  const needsQuotes =
    ALWAYS_QUOTED.has(key) ||
    str === '' ||
    /^[\s>|*&!%@`{}[\],#-]/.test(str) ||
    /:\s|\s#/.test(str) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(str) ||
    /^[\d.+-]+$/.test(str) ||
    str !== str.trim()
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
