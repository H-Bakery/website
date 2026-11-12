'use strict'

/**
 * Rezeptdateien aus `hq/data/recipes/<kategorie>/<datei>` lesen und
 * schreiben - der einzige Parser/Serialisierer dafür. Dependency-freies
 * CommonJS; `backzettel-recipes.core.js` (Füllungen für den Backzettel)
 * baut auf `scanIngredientTables` und `readQuantity` von hier auf.
 *
 * In hq gibt es drei Formate (siehe `docs/domains/rezepte.md`):
 *
 *   standard  YAML-Kopf (`title`, `category`, `yield`, …) und Markdown mit
 *             `## Zutaten` (`### Gruppe`, `- [ ] 100 g Mehl`),
 *             `## Zubereitung` (`### Gruppe`, `1. Schritt`, `- **Gare:** …`),
 *             `## Notizen`, weiteren Abschnitten und einer Fußzeile.
 *   table     handgeschrieben, ohne Kopf: `# 🍰 Name (für 3 Bleche)`, je
 *             Rezeptteil eine Überschrift und eine Tabelle `| Zutat | Menge |`
 *             (`1.350 g`, `1 Prise`, `1 Dose (ca. 4 kg)`), optional
 *             `- **Menge**: …` und `### Zubereitung:` mit Stichpunkten.
 *   teig      YAML-Kopf mit `id`, `art`, `basis`, `zutaten: - { name, g }`
 *             (U10) - Rechengrundlage, in hq geprüft; hier nur lesbar.
 *
 * Verlustfrei: die Datei wird in Bereiche (`regions`) zerlegt, deren
 * Rohtext zusammen genau die Datei ergibt. Beim Speichern wird nur neu
 * geschrieben, was sich geändert hat - Bereich, Gruppe und Zeile behalten
 * sonst ihren Rohtext. Ein Speichern ohne Änderung ergibt dieselben Bytes.
 * Was der Parser nicht versteht, macht die Datei schreibgeschützt
 * (`editable: false` mit deutschem Grund) statt sie verlustbehaftet neu zu
 * schreiben.
 *
 * Keine erfundenen Werte: fehlende Menge = `amount: null`, fehlender Ertrag
 * = `yield: null` („offen“), nie 0.
 */

// ----------------------------------------------------------------- Kategorien

/**
 * Verzeichnisse unter `data/recipes/`. `frontmatter` ist der Wert von
 * `category:` im YAML-Kopf (Einzahl, wie in hq). In `teige/` liegt das
 * Rechenformat (U10): nur lesen.
 */
const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'breads', label: 'Brote', frontmatter: 'bread' }),
  Object.freeze({ id: 'rolls', label: 'Brötchen', frontmatter: 'roll' }),
  Object.freeze({
    id: 'baguettes',
    label: 'Baguettes',
    frontmatter: 'baguette',
  }),
  Object.freeze({ id: 'snacks', label: 'Snacks', frontmatter: 'snack' }),
  Object.freeze({ id: 'cakes', label: 'Kuchen', frontmatter: 'cake' }),
  Object.freeze({ id: 'fillings', label: 'Füllungen', frontmatter: 'filling' }),
  Object.freeze({
    id: 'special',
    label: 'Spezialprodukte',
    frontmatter: 'special',
  }),
  Object.freeze({
    id: 'teige',
    label: 'Teige (Backzettel)',
    frontmatter: null,
    readOnly: true,
  }),
])

const TEIG_READ_ONLY =
  'Teig-Rezepte sind die Rechengrundlage des Backzettels (Mengen je Liter Schüttwasser, in hq geprüft) und werden vorerst nur in hq gepflegt.'

function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) || null
}

/** Verzeichnisname einer Kategorie, wie er in hq vorkommen darf. */
const CATEGORY_DIR = /^[a-z0-9][a-z0-9_-]{0,40}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG_MAX = 80

// ----------------------------------------------------------------- Grenzen

const LIMITS = Object.freeze({
  title: 120,
  yield: 200,
  text: 10000,
  parts: 30,
  ingredients: 100,
  name: 200,
  note: 200,
  groups: 30,
  steps: 100,
  step: 2000,
  amountMax: 1000000,
})

// ----------------------------------------------------------------- Zeilen

/** Zeilen mit ihrem Zeilenende - zusammengesetzt wieder genau der Text. */
function splitLines(text) {
  return String(text).match(/[^\n]*\n|[^\n]+$/g) || []
}

function lineText(raw) {
  return raw.replace(/\r?\n$/, '')
}

const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/
const HR = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/
const ITALIC_LINE = /^\*[^*].*\*[ \t]*$/
const LIST_ITEM = /^([ ]?)([-*+])[ \t]+(\[[ xX]\][ \t]+)?(.*)$/
const ORDERED_ITEM = /^([ ]?)(\d{1,3})([.)])[ \t]+(.*)$/
const CONTINUATION = /^(?:[ ]{2,}|\t)\s*\S/

function isBlank(text) {
  return text.trim() === ''
}

/** Leerzeile oder Trennlinie: steht zwischen Bereichen, trägt keinen Inhalt. */
function isTrivia(text) {
  return isBlank(text) || HR.test(text)
}

function cleanHeading(text) {
  // Emojis und Zierzeichen vorne weg: "🌰 Testnussfüllung:" -> "Testnussfüllung"
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

// ----------------------------------------------------------------- Mengen

/** Einheiten in ihrer Schreibweise; die ersten vier rechnet der Backzettel in Gramm um. */
const UNITS = Object.freeze([
  'g',
  'kg',
  'ml',
  'l',
  'mg',
  'cl',
  'dl',
  'Stück',
  'Stk.',
  'TL',
  'EL',
  'Prise',
  'Prisen',
  'Msp.',
  'Dose',
  'Dosen',
  'Pck.',
  'Päckchen',
  'Bund',
  'Blatt',
  'Würfel',
  'Becher',
])

const UNIT_BY_KEY = (() => {
  const map = new Map()
  for (const unit of UNITS) {
    map.set(unit.toLowerCase(), unit)
    if (unit.endsWith('.')) map.set(unit.slice(0, -1).toLowerCase(), unit)
  }
  return map
})()

/** Längste zuerst, damit `ml` nicht als `m…` und `Prisen` nicht als `Prise` endet. */
const UNIT_SOURCE = [...UNIT_BY_KEY.keys()]
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/\./g, '\\.'))
  .join('|')

const QUANTITY = new RegExp(
  `^(ca\\.?\\s*)?(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d+))?(?:\\s*(${UNIT_SOURCE})(?![a-zäöüß]))?`,
  'i'
)

function canonicalUnit(unit) {
  if (typeof unit !== 'string') return null
  return UNIT_BY_KEY.get(unit.trim().toLowerCase()) || null
}

/**
 * Liest eine deutsch notierte Menge am Anfang von `raw`: `1.000 g`,
 * `0,5 l`, `ca. 3 kg`, `2 EL`, `3` (ohne Einheit). `rest` ist, was danach
 * steht. Ohne Zahl am Anfang: `amount: null`.
 * @returns {{amount: number|null, unit: string|null, approx: boolean, rest: string}}
 */
function readQuantity(raw) {
  const text = String(raw || '').trim()
  const m = QUANTITY.exec(text)
  if (!m) return { amount: null, unit: null, approx: false, rest: text }
  const whole = Number(m[2].replace(/\./g, ''))
  const frac = m[3] ? Number(`0.${m[3]}`) : 0
  return {
    amount: whole + frac,
    unit: m[4] ? canonicalUnit(m[4]) : null,
    approx: Boolean(m[1]),
    rest: text.slice(m[0].length),
  }
}

function roundAmount(n) {
  return Math.round(n * 1000) / 1000
}

/** `1234.5` → `1.234,5` (Tabelle) bzw. `1234,5` (Liste). */
function formatAmount(amount, style) {
  const [whole, frac] = String(roundAmount(amount)).split('.')
  const grouped =
    style === 'table' ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : whole
  return frac ? `${grouped},${frac}` : grouped
}

// ----------------------------------------------------------------- Tabellen

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

function isTableLine(text) {
  return text.trim().startsWith('|')
}

/**
 * Findet die Zutatentabellen eines Markdown-Texts: eine Tabelle, deren
 * Kopfzeile mit „Zutat“ beginnt, unter der zuletzt gelesenen Überschrift
 * (`### Zutaten:` benennt kein eigenes Rezept). Eine Tabelle endet an der
 * nächsten Überschrift oder Nicht-Tabellenzeile; Leerzeilen beenden sie
 * nicht. Einzige Stelle dafür - Backzettel und Rezeptverwaltung lesen
 * dieselben Tabellen.
 * @param {string|string[]} source Text oder Zeilen (ohne Zeilenende)
 * @returns {Array<{title: string|null, titleLine: number, headerLine: number,
 *   separators: number[], rows: Array<{line: number, cells: string[]}>}>}
 */
function scanIngredientTables(source) {
  const lines = Array.isArray(source)
    ? source
    : String(source || '').split(/\r?\n/)
  const tables = []
  let title = null
  let titleLine = -1
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      current = null
      const text = cleanHeading(heading[2])
      // "### Zutaten:" unter "# Apfelfüllung" benennt kein eigenes Rezept.
      if (!/^zutaten$/i.test(text)) {
        title = text
        titleLine = i
      }
      continue
    }
    if (!isTableLine(line)) {
      if (current && line.trim() !== '') current = null
      continue
    }
    const cells = splitRow(line)
    if (!current) {
      // Kopfzeile: erste Spalte "Zutat"
      if (/^zutat/i.test(cells[0] || '')) {
        current = {
          title: title || null,
          titleLine,
          headerLine: i,
          header: cells,
          separators: [],
          rows: [],
        }
        tables.push(current)
      }
      continue
    }
    if (isSeparatorRow(cells)) {
      current.separators.push(i)
      continue
    }
    current.rows.push({ line: i, cells })
  }
  return tables
}

/** `Menge (g)` in der Kopfzeile: Zahlen ohne Einheit sind Gramm. */
function headerUnit(header) {
  const m = /\(\s*(kg|g|ml|l)\s*\)\s*$/i.exec((header && header[1]) || '')
  return m ? canonicalUnit(m[1]) : null
}

function isTotalRow(cells) {
  return /^\*\*.+\*\*$/.test(cells[0] || '')
}

// ----------------------------------------------------------------- Zutaten

function emptyIngredient() {
  return { name: '', amount: null, unit: null, note: null }
}

const LIST_NUMBER = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?/

/** Nach einer Menge steht nichts mehr, ein Leerzeichen, eine Klammer oder `, `. */
function endsQuantity(rest) {
  return rest === '' || /^(?:\s|\(|[,;]\s)/.test(rest)
}

/** `2 x 500 g`, `3 - 6 g`, `2 bis 3 EL`, `500 g + 50 g`: keine einzelne Menge. */
const QUANTITY_CONTINUES = /^\s*(?:[x×*/+–—-]|bis\s)\s*\d/i

/**
 * Die Menge am Anfang einer Listenzeile - nur, wenn die Zahl für sich
 * steht. `405er Mehl`, `5-Korn-Mischung`, `1.5 kg`, `1/2 TL`, `3-6 g` und
 * `2 x 500 g` sind keine Menge, die sich als Zahl lesen lässt: dann bleibt
 * die ganze Zeile der Name und die Menge offen (nie eine halbe Zahl).
 * @returns {{amount: number, unit: string|null, rest: string}|null}
 */
function readListQuantity(body) {
  const q = readQuantity(body)
  if (q.amount === null || q.approx) return null
  let found = q
  if (!endsQuantity(q.rest)) {
    // `3 EL-Maß`: die Einheit klebt am Namen - dann zählt nur die Zahl.
    if (q.unit === null) return null
    const rest = body.slice(LIST_NUMBER.exec(body)[0].length)
    if (!endsQuantity(rest)) return null
    found = { amount: q.amount, unit: null, rest }
  }
  if (QUANTITY_CONTINUES.test(found.rest)) return null
  return found
}

/** `- [ ] 100 g Weizenmehl` → Zutat; `note` gibt es in der Listenform nicht. */
function parseListIngredient(text) {
  const m = LIST_ITEM.exec(text)
  if (!m) return null
  const body = m[4].trim()
  const q = readListQuantity(body)
  if (!q) return { ...emptyIngredient(), name: body }
  return {
    name: q.rest.trim(),
    amount: roundAmount(q.amount),
    unit: q.unit,
    note: null,
  }
}

function renderListIngredient(v, marker) {
  const parts = []
  if (v.amount !== null) {
    parts.push(formatAmount(v.amount, 'list'))
    if (v.unit) parts.push(v.unit)
  }
  if (v.name) parts.push(v.name)
  return `${marker}${parts.join(' ')}`
}

/** Tabellenzeile `| Zucker | 120 g (nach Bedarf) |` → Zutat. */
function parseTableIngredient(cells, defaultUnit) {
  const name = (cells[0] || '').trim()
  const text = (cells[1] || '').trim()
  if (text === '') return { ...emptyIngredient(), name }
  const q = readQuantity(text)
  if (q.amount !== null && !q.approx) {
    const rest = q.rest.trim()
    const paren = /^\(([^()]*)\)$/.exec(rest)
    if (rest === '' || paren) {
      return {
        name,
        amount: roundAmount(q.amount),
        unit: q.unit || defaultUnit || null,
        note: paren && paren[1].trim() ? paren[1].trim() : null,
      }
    }
  }
  // "1 Dose (ca. 4 kg)" bleibt als Menge lesbar, "3–6 g" ist keine Zahl.
  return { name, amount: null, unit: null, note: text }
}

function renderTableIngredient(v, defaultUnit) {
  let quantity = ''
  if (v.amount !== null) {
    quantity = formatAmount(v.amount, 'table')
    if (v.unit && v.unit !== defaultUnit) quantity += ` ${v.unit}`
    if (v.note) quantity += ` (${v.note})`
  } else if (v.note) {
    quantity = v.note
  }
  return `| ${v.name} | ${quantity} |`
}

// ----------------------------------------------------------------- YAML-Kopf

const YAML_SPECIAL =
  /^(?:true|false|yes|no|on|off|null|~|y|n|[-+]?(?:\d[\d_]*)?\.?\d+(?:e[-+]?\d+)?|0x[0-9a-f]+|0o[0-7]+|\.inf|-\.inf|\.nan|\d{4}-\d{2}-\d{2}.*)$/i

/** Ein Wert für `key: wert`: schlicht, sonst in doppelten Anführungszeichen. */
function renderScalar(value) {
  const text = String(value)
  const plain =
    /^[\p{L}\p{N}(][^\n]*$/u.test(text) &&
    !/:\s|\s#|:$|\s$/.test(text) &&
    !YAML_SPECIAL.test(text)
  return plain ? text : JSON.stringify(text)
}

/**
 * Liest den Wert hinter `key:` als Text. `ok: false`, wenn es kein
 * einzeiliger Skalar ist (Block, Liste, Anker …).
 */
function parseScalar(raw) {
  const text = String(raw).trim()
  if (text === '') return { ok: true, value: null }
  const first = text[0]
  if (first === '"') {
    const m = /^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/.exec(text)
    if (!m) return { ok: false, value: null }
    try {
      return { ok: true, value: String(JSON.parse(m[1])) }
    } catch {
      return { ok: false, value: null }
    }
  }
  if (first === "'") {
    const m = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(text)
    if (!m) return { ok: false, value: null }
    return { ok: true, value: m[1].replace(/''/g, "'") }
  }
  if ('|>[{&*!%@`'.includes(first)) return { ok: false, value: null }
  const plain = text.replace(/\s+#.*$/, '').trim()
  if (plain === '' || plain === '~' || /^null$/i.test(plain)) {
    return { ok: true, value: null }
  }
  return { ok: true, value: plain }
}

/** Trennt `a, b, { c: d }` an den Kommas der obersten Ebene. */
function splitFlow(text) {
  const out = []
  let depth = 0
  let quote = null
  let current = ''
  for (const ch of text) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '[' || ch === '{') depth++
    if (ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() !== '') out.push(current)
  return out.map((s) => s.trim())
}

/** Schneidet einen Kommentar (` # …`) außerhalb von Anführungszeichen ab. */
function stripComment(text) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i)
    }
  }
  return text
}

/**
 * Kleiner Leser für die Flow-Schreibweise der Teig-Rezepte
 * (`{ name: Wasser, g: 1000, auch: [Backmittel] }`). Nur für die Anzeige.
 */
function parseFlow(raw) {
  const text = stripComment(String(raw)).trim()
  if (text.startsWith('{') && text.endsWith('}')) {
    const map = {}
    for (const pair of splitFlow(text.slice(1, -1))) {
      const m = /^([^:]+):\s*(.*)$/.exec(pair)
      if (m) map[m[1].trim()] = parseFlow(m[2])
    }
    return map
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitFlow(text.slice(1, -1)).map(parseFlow)
  }
  const scalar = parseScalar(text)
  return scalar.ok ? scalar.value : text
}

/**
 * Zerlegt den YAML-Kopf (Zeilen zwischen den `---`) in Einträge der obersten
 * Ebene. Eingerückte Zeilen, Kommentare und Leerzeilen hängen am Eintrag
 * davor.
 */
function frontmatterEntries(lines, from, to) {
  const entries = []
  let odd = false
  for (let i = from; i < to; i++) {
    const text = lines[i]
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/.exec(text)
    if (m) {
      entries.push({ key: m[1], start: i, end: i + 1, valueText: m[2] })
      continue
    }
    if (!isBlank(text) && !/^\s/.test(text) && !/^#/.test(text)) odd = true
    const last = entries[entries.length - 1]
    if (last) last.end = i + 1
    else entries.push({ key: null, start: i, end: i + 1, valueText: '' })
  }
  return { entries, odd }
}

const META_LABELS = Object.freeze({
  total_mass: 'Gesamtmasse (g)',
  equipment: 'Geräte',
  'baking.temperature': 'Backtemperatur (°C)',
  'baking.time': 'Backzeit (Min.)',
  'baking.steam': 'Schwaden',
  preparation_time: 'Vorbereitung (Min.)',
  resting_time: 'Ruhezeit (Min.)',
  difficulty: 'Schwierigkeit',
  tags: 'Schlagworte',
  id: 'Kennung',
  art: 'Art',
  teig: 'Gehört zu Teig',
  basis: 'Basis',
  teig_kg_je_l: 'Teig je Liter Schüttwasser (kg)',
  quelle: 'Quelle',
  bestaetigt: 'Bestätigt',
})

const BOOLEAN_TEXT = Object.freeze({ true: 'ja', false: 'nein' })

/** Kopfwerte, die Zahlen sind: in der Anzeige mit Dezimalkomma. */
const META_NUMBERS = Object.freeze([
  'total_mass',
  'teig_kg_je_l',
  'baking.temperature',
  'baking.time',
  'preparation_time',
  'resting_time',
])

const ART_TEXT = Object.freeze({ teig: 'Teig', zusatz: 'Zusatz' })

/**
 * Ein Kopfwert so, wie ihn die Backstube liest: `2.7475` → `2,7475`,
 * `2100` Gramm → `2.100`, `{ wasser_l: 1 }` → „je 1 L Schüttwasser“,
 * `teig` → „Teig“. Was sich nicht deuten lässt, bleibt wie in der Datei.
 */
function metaDisplay(key, value) {
  if (key === 'basis') return basisText(value) || metaValue(value)
  const text = metaValue(value)
  if (text === null) return null
  if (key === 'art') return ART_TEXT[text] || text
  if (META_NUMBERS.includes(key) && /^\d+(\.\d+)?$/.test(text)) {
    const [whole, frac] = text.split('.')
    const grouped =
      key === 'total_mass' ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : whole
    return frac ? `${grouped},${frac}` : grouped
  }
  return text
}

function metaValue(value) {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) {
    return value
      .map(metaValue)
      .filter((v) => v !== null)
      .join(', ')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${metaValue(v) ?? 'offen'}`)
      .join(', ')
  }
  const text = String(value)
  return BOOLEAN_TEXT[text] || text
}

/** Was im Kopf sonst noch steht, lesbar für die Anzeige (nie bearbeitet). */
function frontmatterMeta(lines, entries, skip) {
  const meta = []
  const push = (key, value) => {
    meta.push({ key, label: META_LABELS[key] || key, value })
  }
  for (const entry of entries) {
    if (!entry.key || skip.includes(entry.key)) continue
    const inline = stripComment(entry.valueText).trim()
    if (inline !== '') {
      push(entry.key, metaDisplay(entry.key, parseFlow(inline)))
      continue
    }
    const items = []
    let nested = false
    for (let i = entry.start + 1; i < entry.end; i++) {
      const text = stripComment(lines[i])
      if (isBlank(text)) continue
      const item = /^\s+-\s+(.*)$/.exec(text)
      const pair = /^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(text)
      if (item) items.push(metaValue(parseFlow(item[1])))
      else if (pair) {
        nested = true
        const key = `${entry.key}.${pair[1]}`
        push(key, metaDisplay(key, parseFlow(pair[2])))
      }
    }
    if (items.length > 0) push(entry.key, items.join(', '))
    else if (!nested) push(entry.key, null)
  }
  return meta
}

// ----------------------------------------------------------------- Abschnitte

const SECTION_TYPES = Object.freeze({
  zutaten: 'ingredients',
  zubereitung: 'steps',
  ablauf: 'steps',
  herstellung: 'steps',
  notizen: 'notes',
  notiz: 'notes',
  hinweise: 'notes',
  hinweis: 'notes',
  beschreibung: 'description',
})

const SECTION_TITLES = Object.freeze({
  ingredients: 'Zutaten',
  steps: 'Zubereitung',
  notes: 'Notizen',
  description: 'Beschreibung',
})

/** Reihenfolge, in der neue Abschnitte einsortiert werden. */
const SECTION_RANK = Object.freeze({
  description: 1,
  ingredients: 2,
  part: 2,
  steps: 3,
  notes: 5,
})

const YIELD_BULLET =
  /^[ ]?[-*+][ \t]+\*\*(?:Menge|Ergibt|Ertrag|Ausbeute)\s*:?\*\*\s*:?\s*(.*)$/i

function joinRaw(rawLines, from, to) {
  return rawLines.slice(from, to).join('')
}

function ingredientValue(v) {
  return { name: v.name, amount: v.amount, unit: v.unit, note: v.note }
}

function sameIngredient(a, b) {
  return (
    a.name === b.name &&
    a.amount === b.amount &&
    a.unit === b.unit &&
    a.note === b.note
  )
}

function samePart(a, b) {
  return (
    a.title === b.title &&
    a.ingredients.length === b.ingredients.length &&
    a.ingredients.every((ing, i) => sameIngredient(ing, b.ingredients[i]))
  )
}

function sameGroup(a, b) {
  return (
    a.title === b.title &&
    a.ordered === b.ordered &&
    a.items.length === b.items.length &&
    a.items.every((item, i) => item === b.items[i])
  )
}

function sameList(a, b, same) {
  return a.length === b.length && a.every((x, i) => same(x, b[i]))
}

/**
 * Zutaten eines Bereichs in Gruppen: je Gruppe eine optionale Überschrift
 * und Zeilen (`- [ ] …` oder eine Zutatentabelle). `first` ist die Gruppe,
 * die die Abschnittsüberschrift selbst trägt (Tabellenformat), sonst null.
 */
function parsePartChunks(ctx, from, to, level, first) {
  const { lines, rawLines, tables } = ctx
  const chunks = []
  let current = first
  if (current) chunks.push(current)

  const open = (i) => {
    current = newPartChunk(null, null, i)
    chunks.push(current)
  }
  const tableAt = new Map()
  for (const table of tables) {
    if (table.headerLine >= from && table.headerLine < to) {
      tableAt.set(table.headerLine, table)
    }
  }
  const covered = new Map()

  for (let i = from; i < to; i++) {
    const text = lines[i]
    if (isTrivia(text) && !covered.has(i)) continue
    const heading = ctx.fenced[i] ? null : HEADING.exec(text)
    if (heading) {
      if (heading[1].length <= level) {
        ctx.problem(i, 'eine Überschrift an unerwarteter Stelle')
        continue
      }
      current = newPartChunk(cleanHeading(heading[2]) || null, i, i)
      chunks.push(current)
      continue
    }
    if (covered.has(i)) {
      const use = covered.get(i)
      if (use.kind === 'separator') {
        if (use.chunk.items.length > 0 || use.chunk.totals.length > 0) {
          ctx.problem(i, 'eine Trennzeile mitten in der Tabelle')
        } else {
          use.chunk.head.push(i)
        }
      } else if (use.cells.length !== 2) {
        ctx.problem(
          i,
          'eine Tabellenzeile mit mehr oder weniger als zwei Spalten'
        )
      } else if (isTotalRow(use.cells)) {
        use.chunk.totals.push({ line: i, cells: use.cells })
      } else if (use.chunk.totals.length > 0) {
        ctx.problem(i, 'eine Zutat nach der Summenzeile')
      } else if ((use.cells[0] || '').trim() === '') {
        ctx.problem(i, 'eine Tabellenzeile ohne Zutat')
      } else {
        use.chunk.items.push({
          line: i,
          end: i + 1,
          value: parseTableIngredient(use.cells, use.chunk.defaultUnit),
        })
      }
      use.chunk.end = i + 1
      continue
    }
    if (tableAt.has(i)) {
      if (!current) open(i)
      if (current.style !== null) {
        ctx.problem(i, 'eine zweite Tabelle in derselben Gruppe')
        continue
      }
      const table = tableAt.get(i)
      current.style = 'table'
      current.head.push(i)
      current.defaultUnit = headerUnit(table.header)
      if (table.header.length !== 2) {
        ctx.problem(i, 'eine Tabelle mit mehr oder weniger als zwei Spalten')
      }
      for (const line of table.separators) {
        covered.set(line, { kind: 'separator', chunk: current })
      }
      for (const row of table.rows) {
        covered.set(row.line, { kind: 'row', chunk: current, cells: row.cells })
      }
      current.end = i + 1
      continue
    }
    const item = ctx.fenced[i] ? null : parseListIngredient(text)
    if (item) {
      if (!current) open(i)
      if (current.style === 'table') {
        ctx.problem(i, 'eine Listenzeile neben einer Tabelle')
        continue
      }
      current.style = 'list'
      if (item.name === '' && item.amount === null) {
        ctx.problem(i, 'eine leere Zutatenzeile')
      }
      if (current.marker === null) {
        const m = LIST_ITEM.exec(text)
        current.marker = `${m[1]}${m[2]} ${m[3] ? `${m[3].trim()} ` : ''}`
      }
      current.items.push({ line: i, end: i + 1, value: item })
      current.end = i + 1
      continue
    }
    ctx.problem(i, 'eine Zeile, die keine Zutat ist')
  }

  for (const chunk of chunks) {
    chunk.raw = joinRaw(rawLines, chunk.start, chunk.end)
    chunk.value = {
      title: chunk.title,
      ingredients: chunk.items.map((item) => item.value),
    }
    for (const item of chunk.items) item.raw = rawLines[item.line]
  }
  return chunks
}

function newPartChunk(title, headingLine, start) {
  return {
    title,
    headingLine,
    start,
    end: start + 1,
    style: null,
    marker: null,
    defaultUnit: null,
    head: [],
    items: [],
    totals: [],
    raw: '',
    value: null,
  }
}

/** Arbeitsschritte in Gruppen: Überschrift, nummerierte Schritte oder Stichpunkte. */
function parseStepChunks(ctx, from, to, level) {
  const { lines, rawLines } = ctx
  const chunks = []
  let current = null
  let item = null

  const open = (title, headingLine, start) => {
    current = {
      title,
      headingLine,
      start,
      end: start + 1,
      items: [],
      raw: '',
      value: null,
    }
    chunks.push(current)
    item = null
  }

  for (let i = from; i < to; i++) {
    const text = lines[i]
    if (isTrivia(text)) continue
    const heading = ctx.fenced[i] ? null : HEADING.exec(text)
    if (heading) {
      if (heading[1].length <= level) {
        ctx.problem(i, 'eine Überschrift an unerwarteter Stelle')
        continue
      }
      open(cleanHeading(heading[2]) || null, i, i)
      continue
    }
    const ordered = ctx.fenced[i] ? null : ORDERED_ITEM.exec(text)
    const bullet = ctx.fenced[i] || ordered ? null : LIST_ITEM.exec(text)
    if (ordered || bullet) {
      if (!current) open(null, null, i)
      item = {
        line: i,
        end: i + 1,
        ordered: Boolean(ordered),
        number: ordered ? Number(ordered[2]) : null,
        texts: [
          (ordered ? ordered[4] : text.replace(/^[ ]?[-*+][ \t]+/, '')).trim(),
        ],
      }
      if (item.texts[0] === '') ctx.problem(i, 'ein leerer Arbeitsschritt')
      current.items.push(item)
      current.end = i + 1
      continue
    }
    if (item && CONTINUATION.test(text)) {
      item.texts.push(text.replace(/\s+$/, ''))
      item.end = i + 1
      current.end = i + 1
      continue
    }
    ctx.problem(i, 'eine Zeile, die kein Arbeitsschritt ist')
  }

  for (const chunk of chunks) {
    const kinds = new Set(chunk.items.map((it) => it.ordered))
    if (kinds.size > 1) {
      ctx.problem(
        chunk.start,
        'nummerierte Schritte und Stichpunkte gemischt in einer Gruppe'
      )
    }
    chunk.raw = joinRaw(rawLines, chunk.start, chunk.end)
    for (const it of chunk.items) {
      it.raw = joinRaw(rawLines, it.line, it.end)
      it.value = it.texts.join('\n')
    }
    chunk.value = {
      title: chunk.title,
      ordered: chunk.items.length === 0 ? true : chunk.items[0].ordered,
      items: chunk.items.map((it) => it.value),
    }
  }
  return chunks
}

/**
 * Kopf, Gruppen, Zwischenräume und Ende eines Bereichs mit Gruppen - als
 * Rohtext, damit beim Neuschreiben einer Gruppe der Rest stehen bleibt.
 */
function blockLayout(rawLines, from, to, chunks) {
  if (chunks.length === 0) {
    return { head: joinRaw(rawLines, from, to), gaps: [], tail: '' }
  }
  const gaps = []
  for (let k = 0; k + 1 < chunks.length; k++) {
    gaps.push(joinRaw(rawLines, chunks[k].end, chunks[k + 1].start))
  }
  return {
    head: joinRaw(rawLines, from, chunks[0].start),
    gaps,
    tail: joinRaw(rawLines, chunks[chunks.length - 1].end, to),
  }
}

/** Text eines Abschnitts ohne Leerzeilen und Trennlinien am Rand. */
function textBlock(ctx, from, to) {
  const { lines, rawLines } = ctx
  let a = from
  let b = to
  while (a < b && isTrivia(lines[a])) a++
  while (b > a && isTrivia(lines[b - 1])) b--
  return {
    lead: joinRaw(rawLines, from, a),
    text: a < b ? lines.slice(a, b).join('\n') : null,
    trail: joinRaw(rawLines, b, to),
  }
}

/** Zeilen innerhalb eines Code-Zauns (``` … ```): dort gilt nichts als Struktur. */
function fencedLines(lines) {
  const fenced = []
  let open = null
  for (let i = 0; i < lines.length; i++) {
    const m = /^[ ]{0,3}(```+|~~~+)/.exec(lines[i])
    if (open) {
      fenced.push(true)
      if (m && m[1][0] === open[0] && m[1].length >= open.length) open = null
      continue
    }
    if (m) {
      open = m[1]
      fenced.push(true)
      continue
    }
    fenced.push(false)
  }
  return fenced
}

/** Fußzeile: letzte Trennlinie, nach der nur noch kursive Zeilen stehen. */
function footerStart(lines, from, to) {
  let i = to - 1
  let italics = 0
  while (i >= from && (isBlank(lines[i]) || ITALIC_LINE.test(lines[i]))) {
    if (!isBlank(lines[i])) italics++
    i--
  }
  if (italics > 0 && i >= from && HR.test(lines[i])) return i
  return to
}

function parseTableHeading(text) {
  const prefix = (/^[^\p{L}\p{N}]+/u.exec(text) || [''])[0]
  const body = text.slice(prefix.length)
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(body)
  const yieldText = m && m[2].trim() ? m[2].trim() : null
  const title = (yieldText ? m[1] : body).replace(/[:\s]+$/, '').trim()
  return { prefix, title, yield: yieldText }
}

function emptyModel(title) {
  return {
    title: title || '',
    yield: null,
    description: null,
    parts: [],
    steps: [],
    notes: null,
    meta: [],
    sections: [],
  }
}

/**
 * Der Körper (alles nach dem YAML-Kopf) in Bereichen: Vorspann, `# Titel`,
 * Einleitung, je Überschrift der obersten Ebene ein Abschnitt, Fußzeile.
 */
function parseBody(ctx, from, to) {
  const { lines, rawLines, format } = ctx
  const regions = []
  const end = footerStart(lines, from, to)

  const headings = []
  for (let i = from; i < end; i++) {
    if (ctx.fenced[i]) continue
    const m = HEADING.exec(lines[i])
    if (m) headings.push({ line: i, level: m[1].length, text: m[2] })
  }
  const h1 = headings.length > 0 && headings[0].level === 1 ? headings[0] : null
  const rest = h1 ? headings.slice(1) : headings
  const level =
    rest.length > 0
      ? Math.min(...rest.map((h) => h.level))
      : format === 'standard' || format === 'teig'
      ? 2
      : 3
  const starts = rest.filter((h) => h.level === level)
  const firstSection = starts.length > 0 ? starts[0].line : end

  let cursor = from
  if (h1) {
    if (h1.line > cursor) {
      regions.push({
        kind: 'verbatim',
        raw: joinRaw(rawLines, cursor, h1.line),
      })
    }
    const parsed =
      format === 'table'
        ? parseTableHeading(h1.text)
        : { prefix: '', title: h1.text.trim(), yield: null }
    regions.push({ kind: 'h1', raw: rawLines[h1.line], ...parsed })
    cursor = h1.line + 1
  }

  // Einleitung: zwischen Titel und erstem Abschnitt
  if (firstSection > cursor) {
    const intro = {
      kind: 'intro',
      raw: joinRaw(rawLines, cursor, firstSection),
      yield: null,
      notes: null,
      lead: '',
      trail: '',
      plain: true,
    }
    let a = cursor
    let b = firstSection
    while (a < b && isTrivia(lines[a])) a++
    while (b > a && isTrivia(lines[b - 1])) b--
    intro.lead = joinRaw(rawLines, cursor, a)
    intro.trail = joinRaw(rawLines, b, firstSection)
    const notes = []
    for (let i = a; i < b; i++) {
      const text = lines[i]
      const bullet = YIELD_BULLET.exec(text)
      if (
        format === 'table' &&
        bullet &&
        intro.yield === null &&
        bullet[1].trim()
      ) {
        intro.yield = bullet[1].trim()
        continue
      }
      if (isTableLine(text)) {
        intro.plain = false
        ctx.problem(i, 'eine Tabelle ohne eigene Überschrift')
      }
      notes.push(text)
    }
    while (notes.length > 0 && isBlank(notes[notes.length - 1])) notes.pop()
    while (notes.length > 0 && isBlank(notes[0])) notes.shift()
    intro.notes = notes.length > 0 ? notes.join('\n') : null
    regions.push(intro)
  }

  const seen = new Set()
  for (let k = 0; k < starts.length; k++) {
    const start = starts[k].line
    const stop = k + 1 < starts.length ? starts[k + 1].line : end
    const title = cleanHeading(starts[k].text)
    const section = {
      kind: 'section',
      type: 'other',
      level,
      title,
      headingRaw: rawLines[start],
      raw: joinRaw(rawLines, start, stop),
    }
    let type = SECTION_TYPES[title.toLowerCase()] || 'other'
    const hasTable = ctx.tables.some(
      (t) => t.headerLine > start && t.headerLine < stop
    )
    // Tabellenformat: jede Überschrift mit Zutatentabelle ist ein Rezeptteil
    // („Zutaten“ = der unbenannte).
    if (
      format === 'table' &&
      hasTable &&
      (type === 'ingredients' || type === 'other')
    ) {
      type = 'part'
    }
    if (type !== 'part' && type !== 'other') {
      if (seen.has(type)) type = 'other'
      else seen.add(type)
    }
    section.type = type

    if (type === 'part') {
      const chunk = newPartChunk(
        SECTION_TYPES[title.toLowerCase()] === 'ingredients'
          ? null
          : title || null,
        start,
        start
      )
      const chunks = parsePartChunks(ctx, start + 1, stop, level, chunk)
      if (chunks.length > 1) {
        ctx.problem(
          chunks[1].start,
          'mehrere Gruppen unter einer Tabellenüberschrift'
        )
      }
      section.chunk = chunk
      section.tail = joinRaw(rawLines, chunk.end, stop)
    } else if (type === 'ingredients') {
      section.chunks = parsePartChunks(ctx, start + 1, stop, level, null)
      Object.assign(section, blockLayout(rawLines, start, stop, section.chunks))
    } else if (type === 'steps') {
      section.chunks = parseStepChunks(ctx, start + 1, stop, level)
      Object.assign(section, blockLayout(rawLines, start, stop, section.chunks))
    } else {
      const block = textBlock(ctx, start + 1, stop)
      section.head = rawLines[start] + block.lead
      section.lead = block.lead
      section.text = block.text
      section.tail = block.trail
    }
    regions.push(section)
  }

  if (end < to) {
    regions.push({ kind: 'footer', raw: joinRaw(rawLines, end, to) })
  }
  return { regions, level }
}

// ----------------------------------------------------------------- Parsen

/** Anzeige der Basis eines Teig-Rezepts als Ertrag. */
function basisText(basis) {
  if (!basis || typeof basis !== 'object') return null
  const [key, value] = Object.entries(basis)[0] || []
  if (key === undefined) return null
  const n = String(value).replace('.', ',')
  if (key === 'wasser_l') return `je ${n} L Schüttwasser`
  if (key === 'teig_kg') return `je ${n} kg Teig`
  if (key === 'bruch') return `je ${n} Bruch`
  return `${key}: ${n}`
}

function teigIngredients(lines, entry) {
  const out = []
  for (let i = entry.start + 1; i < entry.end; i++) {
    const m = /^\s+-\s+(.*)$/.exec(lines[i])
    if (!m) continue
    const item = parseFlow(m[1])
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const g = Number(item.g)
    const notes = []
    if (Array.isArray(item.auch) && item.auch.length > 0) {
      notes.push(`auch: ${item.auch.join(', ')}`)
    }
    if (item.notiz) notes.push(String(item.notiz))
    out.push({
      name: String(item.name ?? ''),
      amount:
        item.g !== null && item.g !== undefined && Number.isFinite(g)
          ? g
          : null,
      unit:
        item.g !== null && item.g !== undefined && Number.isFinite(g)
          ? 'g'
          : null,
      note: notes.length > 0 ? notes.join('; ') : null,
    })
  }
  return out
}

/**
 * Liest eine Rezeptdatei.
 * @param {string} text Dateiinhalt
 * @param {{fileStem?: string}} [options] Dateiname ohne Endung (Titel, wenn die Datei keinen nennt)
 * @returns {{format: 'standard'|'table'|'teig'|'unknown', text: string, eol: string,
 *   regions: object[], model: object, editable: boolean, readOnlyReason: string|null}}
 */
function parseRecipeFile(text, options) {
  const source = String(text ?? '')
  const stem = (options && options.fileStem) || ''
  const fallbackTitle = stem.replace(/[-_]+/g, ' ').trim()
  const rawLines = splitLines(source)
  const lines = rawLines.map(lineText)
  // Byte-Order-Mark am Dateianfang: gehört zur Datei, nicht zur ersten Zeile.
  if (lines.length > 0 && lines[0].charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1)
  }
  const problems = []
  const ctx = {
    rawLines,
    lines,
    format: 'unknown',
    fenced: fencedLines(lines),
    tables: scanIngredientTables(lines),
    problem: (line, what) => {
      problems.push(`Zeile ${line + 1}: ${what}`)
    },
  }
  const doc = {
    format: 'unknown',
    text: source,
    fileStem: stem,
    eol: /\r\n/.test(source) ? '\r\n' : '\n',
    regions: [],
    level: 2,
    model: emptyModel(fallbackTitle),
    editable: false,
    readOnlyReason: null,
  }

  const readOnly = (reason) => {
    doc.editable = false
    doc.readOnlyReason = reason
    return doc
  }
  const verbatim = () => {
    doc.regions = [{ kind: 'verbatim', raw: source }]
  }

  let bodyStart = 0
  let fm = null
  if (lines.length > 0 && lines[0].trimEnd() === '---') {
    let close = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trimEnd() === '---') {
        close = i
        break
      }
    }
    if (close < 0) {
      verbatim()
      doc.model.sections = [{ title: null, text: source.trim() }]
      return readOnly(
        'Der YAML-Kopf der Datei ist nicht abgeschlossen (die zweite Zeile „---“ fehlt).'
      )
    }
    fm = { close, ...frontmatterEntries(lines, 1, close) }
    bodyStart = close + 1
  }

  const keys = fm ? fm.entries.map((e) => e.key).filter(Boolean) : []
  doc.format = !fm
    ? 'table'
    : keys.some((k) => k === 'zutaten' || k === 'art' || k === 'basis')
    ? 'teig'
    : 'standard'
  ctx.format = doc.format

  const entryOf = (key) => (fm ? fm.entries.filter((e) => e.key === key) : [])
  const scalarOf = (key) => {
    const found = entryOf(key)
    if (found.length === 0) return { present: false, value: null }
    const parsed = parseScalar(found[0].valueText)
    const simple =
      found.length === 1 && parsed.ok && found[0].end === found[0].start + 1
    return { present: true, simple, value: parsed.ok ? parsed.value : null }
  }

  const body = parseBody(ctx, bodyStart, lines.length)
  doc.level = body.level
  const model = doc.model
  const sections = body.regions.filter((r) => r.kind === 'section')
  const h1 = body.regions.find((r) => r.kind === 'h1') || null
  const intro = body.regions.find((r) => r.kind === 'intro') || null
  const byType = (type) => sections.find((s) => s.type === type) || null

  // --- Teig-Format: nur Anzeige ---------------------------------------
  if (doc.format === 'teig') {
    verbatim()
    const name = scalarOf('name')
    model.title = name.value || (h1 && h1.title) || fallbackTitle
    const basis = entryOf('basis')[0]
    model.yield = basis ? basisText(parseFlow(basis.valueText)) : null
    const zutaten = entryOf('zutaten')[0]
    const ingredients = zutaten ? teigIngredients(lines, zutaten) : []
    model.parts =
      ingredients.length > 0 ? [{ title: null, ingredients, total: null }] : []
    model.meta = frontmatterMeta(lines, fm.entries, ['name', 'zutaten'])
    if (intro && intro.notes !== null) {
      model.sections.push({ title: null, text: intro.notes })
    }
    for (const section of sections) {
      const groups = section.type === 'steps' ? section.chunks : []
      if (groups.length > 0 && groups.every((g) => g.items.length > 0)) {
        model.steps = groups.map((g) => g.value)
        continue
      }
      model.sections.push({ title: section.title, text: sectionText(section) })
    }
    return readOnly(TEIG_READ_ONLY)
  }

  // --- Bereiche ---------------------------------------------------------
  const regions = []
  if (fm) {
    regions.push({ kind: 'fm-open', raw: rawLines[0] })
    for (const entry of fm.entries) {
      regions.push({
        kind: 'fm-entry',
        key: entry.key,
        raw: joinRaw(rawLines, entry.start, entry.end),
      })
    }
    regions.push({ kind: 'fm-close', raw: rawLines[fm.close] })
  }
  regions.push(...body.regions)
  doc.regions = regions

  // --- Modell -----------------------------------------------------------
  if (doc.format === 'standard') {
    const title = scalarOf('title')
    const yieldValue = scalarOf('yield')
    if (fm.odd) problems.push('Der YAML-Kopf enthält Zeilen ohne Schlüssel.')
    for (const [key, value] of [
      ['title', title],
      ['yield', yieldValue],
      ['category', scalarOf('category')],
    ]) {
      if (value.present && !value.simple) {
        problems.push(
          `Der Eintrag „${key}“ im YAML-Kopf ist kein einfacher einzeiliger Wert.`
        )
      }
    }
    model.title = title.value || (h1 && h1.title) || fallbackTitle
    model.yield = yieldValue.value
    model.meta = frontmatterMeta(lines, fm.entries, [
      'title',
      'category',
      'yield',
    ])
    if (intro && intro.notes !== null) {
      model.sections.push({ title: null, text: intro.notes })
    }
  } else {
    model.title = (h1 && h1.title) || fallbackTitle
    model.yield = (h1 && h1.yield) || (intro && intro.yield) || null
  }

  const description = byType('description')
  model.description = description ? description.text : null

  const ingredientsSection = byType('ingredients')
  const partSections = sections.filter((s) => s.type === 'part')
  if (ingredientsSection && partSections.length > 0) {
    problems.push(
      'Zutaten stehen an mehreren Stellen der Datei (Liste und Tabellen).'
    )
  }
  if (partSections.length > 1) {
    const indexes = partSections.map((s) => regions.indexOf(s))
    const contiguous = indexes.every(
      (idx, k) => k === 0 || idx === indexes[k - 1] + 1
    )
    if (!contiguous) {
      problems.push('Zwischen den Zutatentabellen stehen andere Abschnitte.')
    }
  }
  const partChunks = ingredientsSection
    ? ingredientsSection.chunks
    : partSections.map((s) => s.chunk)
  model.parts = partChunks.map((chunk) => ({
    ...chunk.value,
    total: totalOf(chunk),
  }))
  if (ingredientsSection) {
    const untitled = ingredientsSection.chunks.findIndex(
      (chunk, k) => k > 0 && chunk.title === null
    )
    if (untitled >= 0)
      problems.push('Eine Zutatengruppe ohne Namen steht nicht am Anfang.')
  }

  const steps = byType('steps')
  model.steps = steps ? steps.chunks.map((chunk) => chunk.value) : []

  const notes = byType('notes')
  if (notes) {
    model.notes = notes.text
    if (doc.format === 'table' && intro && intro.notes !== null) {
      model.sections.push({ title: null, text: intro.notes })
    }
  } else if (doc.format === 'table' && intro) {
    model.notes = intro.notes
  }

  for (const section of sections) {
    if (section.type === 'other') {
      model.sections.push({ title: section.title, text: section.text || '' })
    }
  }

  // Ohne gefundene Gruppen: wenigstens anzeigen, was die Tabellen hergeben.
  if (model.parts.length === 0 && ctx.tables.length > 0) {
    model.parts = ctx.tables.map((table) => ({
      title: table.title,
      ingredients: table.rows
        .filter((row) => !isTotalRow(row.cells) && (row.cells[0] || '').trim())
        .map((row) =>
          parseTableIngredient(row.cells, headerUnit(table.header))
        ),
      total: null,
    }))
  }

  if (regions.map((r) => r.raw).join('') !== source) {
    problems.push(
      'Die Datei lässt sich nicht verlustfrei in Abschnitte zerlegen.'
    )
  }

  if (problems.length > 0) {
    return readOnly(
      `Diese Datei enthält Stellen, die die Verwaltung nicht versteht, und lässt sich deshalb nur in hq bearbeiten (${problems
        .slice(0, 3)
        .join('; ')}${problems.length > 3 ? '; …' : ''}).`
    )
  }
  doc.editable = true
  return doc
}

function sectionText(section) {
  if (typeof section.text === 'string') return section.text
  const rawBody = section.raw.slice(section.headingRaw.length)
  return rawBody.replace(/^\s*\n/, '').replace(/\s+$/, '')
}

// ----------------------------------------------------------------- Eingabe

const controlChars = require('./control-chars.core')

class RecipeInputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RecipeInputError'
  }
}

function fail(message) {
  throw new RecipeInputError(message)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function singleLine(value, label, max, { required } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) fail(`${label} fehlt.`)
    return null
  }
  if (typeof value !== 'string') fail(`${label} muss ein Text sein.`)
  const text = value.trim()
  if (text === '') {
    if (required) fail(`${label} fehlt.`)
    return null
  }
  if (text.length > max)
    fail(`${label} darf höchstens ${max} Zeichen lang sein.`)
  if (/[\r\n]/.test(text) || controlChars.hasNameControlChars(text)) {
    fail(`${label} enthält unzulässige Steuerzeichen oder Zeilenumbrüche.`)
  }
  return text
}

function multiLine(value, label, max, level) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') fail(`${label} muss ein Text sein.`)
  // Zeilen bleiben, wie sie sind (auch Leerzeichen am Ende): ein
  // unverändertes Feld muss denselben Text ergeben wie beim Lesen.
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && isTrivia(lines[0])) lines.shift()
  while (lines.length > 0 && isTrivia(lines[lines.length - 1])) lines.pop()
  if (lines.length === 0) return null
  const text = lines.join('\n')
  if (text.length > max)
    fail(`${label} darf höchstens ${max} Zeichen lang sein.`)
  if (controlChars.hasTextControlChars(text)) {
    fail(`${label} enthält unzulässige Steuerzeichen.`)
  }
  for (const line of lines) {
    const heading = HEADING.exec(line)
    if ((heading && heading[1].length <= level) || HR.test(line)) {
      fail(
        `${label}: Zeilen mit Überschrift (#) oder Trennlinie (---) lassen sich hier nicht speichern.`
      )
    }
  }
  return text
}

function cellText(value, label, max) {
  const text = singleLine(value, label, max)
  if (text !== null && text.includes('|')) {
    fail(`${label} darf kein „|“ enthalten.`)
  }
  return text
}

function normalizeIngredient(raw, where) {
  if (!isObject(raw)) fail(`${where}: Die Zutat ist ungültig.`)
  const name = cellText(raw.name, `${where}: Name der Zutat`, LIMITS.name) || ''
  let note = cellText(raw.note, `${where}: Hinweis zur Menge`, LIMITS.note)
  let amount = null
  if (raw.amount !== null && raw.amount !== undefined && raw.amount !== '') {
    if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount)) {
      fail(
        `${where}: Die Menge muss eine Zahl sein (oder leer bleiben = offen).`
      )
    }
    if (raw.amount <= 0 || raw.amount > LIMITS.amountMax) {
      fail(
        `${where}: Die Menge muss größer als 0 sein; eine unbekannte Menge bleibt leer (offen).`
      )
    }
    amount = roundAmount(raw.amount)
    if (amount <= 0)
      fail(
        `${where}: Die Menge ist zu klein (höchstens drei Nachkommastellen).`
      )
  }
  let unit = null
  if (raw.unit !== null && raw.unit !== undefined && raw.unit !== '') {
    unit = canonicalUnit(raw.unit)
    if (!unit) {
      fail(`${where}: Unbekannte Einheit. Erlaubt: ${UNITS.join(', ')}.`)
    }
  }
  // Ohne Menge gibt es keine Einheit - „offen“ bleibt offen.
  if (amount === null) unit = null
  if (name === '' && amount === null && note === null) return null
  if (name === '' && amount === null)
    fail(`${where}: Der Name der Zutat fehlt.`)
  if (note === '') note = null
  return { name, amount, unit, note }
}

function normalizeStep(raw, where) {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') fail(`${where}: Der Schritt muss ein Text sein.`)
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
  if (lines.length === 0) return null
  const text = [
    lines[0].trim(),
    ...lines
      .slice(1)
      .map((line) => (CONTINUATION.test(line) ? line : `   ${line.trim()}`)),
  ].join('\n')
  if (text.length > LIMITS.step) {
    fail(
      `${where}: Ein Schritt darf höchstens ${LIMITS.step} Zeichen lang sein.`
    )
  }
  if (controlChars.hasTextControlChars(text)) {
    fail(`${where}: Der Schritt enthält unzulässige Steuerzeichen.`)
  }
  return text
}

/**
 * Prüft die Eingabe der Verwaltung und füllt Fehlendes aus dem aktuellen
 * Stand (`current` = Modell der Datei; für ein neues Rezept leer).
 * Leere Zutatenzeilen und leere Schritte fallen weg. Was unverändert aus
 * der Datei zurückkommt, wird nicht noch einmal geprüft - ein Speichern
 * ohne Änderung scheitert nie an einer Regel, die die Datei schon bricht.
 * @throws {RecipeInputError} mit deutscher Meldung
 */
function normalizeRecipeInput(input, current, level) {
  if (!isObject(input)) fail('Die Angaben zum Rezept fehlen.')
  const base = current || emptyModel('')
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key)
  const out = {}

  const ingredientKey = (v) =>
    JSON.stringify([v.name, v.amount, v.unit, v.note])
  const knownIngredients = new Set(
    base.parts.flatMap((part) => part.ingredients.map(ingredientKey))
  )
  const knownTitles = new Set(
    [...base.parts, ...base.steps].map((g) => g.title).filter((t) => t !== null)
  )
  const knownSteps = new Set(base.steps.flatMap((group) => group.items))
  const groupTitle = (value, where) => {
    if (typeof value === 'string' && knownTitles.has(value)) return value
    const title = singleLine(value, `${where}: Name der Gruppe`, LIMITS.title)
    if (title !== null && /^#/.test(title)) {
      fail(`${where}: Der Name darf nicht mit „#“ beginnen.`)
    }
    return title
  }

  out.title =
    !has('title') || input.title === base.title
      ? base.title
      : singleLine(input.title, 'Der Name des Rezepts', LIMITS.title, {
          required: true,
        })
  if (!out.title) fail('Der Name des Rezepts fehlt.')
  out.yield =
    !has('yield') || input.yield === base.yield
      ? base.yield
      : singleLine(input.yield, 'Die Angabe „Ergibt“', LIMITS.yield)
  out.description =
    !has('description') || input.description === base.description
      ? base.description
      : multiLine(input.description, 'Die Beschreibung', LIMITS.text, level)
  out.notes =
    !has('notes') || input.notes === base.notes
      ? base.notes
      : multiLine(input.notes, 'Die Notizen', LIMITS.text, level)

  if (has('parts')) {
    if (!Array.isArray(input.parts))
      fail('Die Zutaten müssen eine Liste von Gruppen sein.')
    if (input.parts.length > Math.max(LIMITS.parts, base.parts.length)) {
      fail(`Ein Rezept darf höchstens ${LIMITS.parts} Zutatengruppen haben.`)
    }
    out.parts = []
    input.parts.forEach((part, p) => {
      const where = `Zutatengruppe ${p + 1}`
      if (!isObject(part)) fail(`${where} ist ungültig.`)
      const title = groupTitle(part.title, where)
      const list = part.ingredients === undefined ? [] : part.ingredients
      if (!Array.isArray(list))
        fail(`${where}: Die Zutaten müssen eine Liste sein.`)
      const most = Math.max(
        LIMITS.ingredients,
        ...base.parts.map((known) => known.ingredients.length)
      )
      if (list.length > most) {
        fail(`${where}: höchstens ${LIMITS.ingredients} Zutaten je Gruppe.`)
      }
      const ingredients = list
        .map((ing, i) => {
          if (isObject(ing)) {
            const same = {
              name: ing.name,
              amount: ing.amount === undefined ? null : ing.amount,
              unit: ing.unit === undefined ? null : ing.unit,
              note: ing.note === undefined ? null : ing.note,
            }
            if (
              typeof same.name === 'string' &&
              knownIngredients.has(ingredientKey(same))
            ) {
              return same
            }
          }
          return normalizeIngredient(ing, `${where}, Zutat ${i + 1}`)
        })
        .filter(Boolean)
      if (title === null && ingredients.length === 0) return
      out.parts.push({ title, ingredients })
    })
  } else {
    out.parts = base.parts.map((part) => ({
      title: part.title,
      ingredients: part.ingredients.map(ingredientValue),
    }))
  }

  if (has('steps')) {
    if (!Array.isArray(input.steps))
      fail('Die Zubereitung muss eine Liste von Gruppen sein.')
    if (input.steps.length > Math.max(LIMITS.groups, base.steps.length)) {
      fail(`Die Zubereitung darf höchstens ${LIMITS.groups} Gruppen haben.`)
    }
    out.steps = []
    input.steps.forEach((group, g) => {
      const where = `Zubereitung, Gruppe ${g + 1}`
      if (!isObject(group)) fail(`${where} ist ungültig.`)
      const title = groupTitle(group.title, where)
      const list = group.items === undefined ? [] : group.items
      if (!Array.isArray(list))
        fail(`${where}: Die Schritte müssen eine Liste sein.`)
      const most = Math.max(
        LIMITS.steps,
        ...base.steps.map((known) => known.items.length)
      )
      if (list.length > most) {
        fail(`${where}: höchstens ${LIMITS.steps} Schritte je Gruppe.`)
      }
      const items = list
        .map((step, i) =>
          typeof step === 'string' && knownSteps.has(step)
            ? step
            : normalizeStep(step, `${where}, Schritt ${i + 1}`)
        )
        .filter((step) => step !== null)
      if (title === null && items.length === 0) return
      out.steps.push({ title, ordered: group.ordered !== false, items })
    })
  } else {
    out.steps = base.steps.map((group) => ({
      ...group,
      items: [...group.items],
    }))
  }
  return out
}

// ----------------------------------------------------------------- Schreiben

/** Sammelt die Ausgabe; nie zwei Bereiche in einer Zeile. */
function createOutput(eol) {
  let text = ''
  return {
    push(chunk) {
      if (!chunk) return
      if (text !== '' && !text.endsWith('\n')) text += eol
      text += chunk
    },
    blankLine() {
      if (text === '') return
      if (!text.endsWith('\n')) text += eol
      if (!/\n\r?\n$/.test(text)) text += eol
    },
    get text() {
      return text
    },
    set text(value) {
      text = value
    },
  }
}

/**
 * Ordnet neuen Gruppen die alten zu: gleicher Platz und Titel zuerst, dann
 * gleicher Titel. Eine umbenannte Gruppe hat keinen Titel mehr gemeinsam -
 * sie wird am Inhalt erkannt (`sameContent`: derselbe Inhalt; sonst
 * `related`: am selben Platz oder irgendwo ein gemeinsamer Eintrag), damit
 * ihre Zeilen, die Tabellenkopfzeile und die Summenzeile stehen bleiben.
 */
function matchChunks(values, chunks, sameContent, related) {
  const used = new Set()
  const match = values.map(() => null)
  const take = (j, k) => {
    used.add(k)
    match[j] = chunks[k]
  }
  const pass = (find) => {
    values.forEach((value, j) => {
      if (match[j]) return
      const k = find(value, j)
      if (k >= 0) take(j, k)
    })
  }
  const free = (k) => k >= 0 && k < chunks.length && !used.has(k)
  pass((value, j) => (free(j) && chunks[j].title === value.title ? j : -1))
  pass((value) =>
    chunks.findIndex((c, k) => free(k) && c.title === value.title)
  )
  pass((value) =>
    chunks.findIndex((c, k) => free(k) && sameContent(c.value, value))
  )
  pass((value, j) => (free(j) && related(chunks[j].value, value) ? j : -1))
  pass((value) =>
    chunks.findIndex((c, k) => free(k) && related(c.value, value))
  )
  return match
}

function sameIngredients(a, b) {
  return sameList(a.ingredients, b.ingredients, sameIngredient)
}

/** Mindestens eine gemeinsame Zutat (oder beide leer). */
function relatedPart(a, b) {
  if (a.ingredients.length === 0 && b.ingredients.length === 0) return true
  return a.ingredients.some((x) =>
    b.ingredients.some((y) => sameIngredient(x, y))
  )
}

function sameItems(a, b) {
  return a.ordered === b.ordered && sameList(a.items, b.items, Object.is)
}

function relatedGroup(a, b) {
  if (a.items.length === 0 && b.items.length === 0) return true
  return a.items.some((x) => b.items.includes(x))
}

function matchParts(parts, chunks) {
  return matchChunks(parts, chunks, sameIngredients, relatedPart)
}

function matchSteps(groups, chunks) {
  return matchChunks(groups, chunks, sameItems, relatedGroup)
}

/**
 * Überschrift einer Gruppe. Unverändert: die Zeile der Datei. Umbenannt: die
 * Zier der alten Zeile bleibt (`### 🌰 Füllung:` → `### 🌰 Creme:`).
 * `title` ist der Name im Modell (`null` = unbenannt), `shown` der Text der
 * Überschrift (im Tabellenformat heißt die unbenannte Gruppe „Zutaten“).
 */
function groupHeading(level, title, shown, original, rawLines, eol) {
  const raw =
    original && original.headingLine !== null
      ? rawLines[original.headingLine]
      : null
  if (raw !== null && original.title === title) return withEol(raw, eol)
  const old = raw !== null ? HEADING.exec(lineText(raw)) : null
  if (!old || title === null) return `${'#'.repeat(level)} ${shown}${eol}`
  // „Zutaten:“ → „Teig:“ behält nur den Doppelpunkt, ein Name auch sein Emoji.
  const prefix =
    original.title === null ? '' : (/^[^\p{L}\p{N}]+/u.exec(old[2]) || [''])[0]
  const suffix = (/:\s*$/.exec(old[2]) || [''])[0].trimEnd()
  return `${old[1]} ${prefix}${shown}${suffix}${eol}`
}

/**
 * Die Zeilen einer Gruppe ohne ihre Überschrift, wie sie in der Datei
 * stehen - für eine Gruppe, die nur anders heißt. Ohne neue Überschrift
 * (`headed` falsch) fallen die Leerzeilen davor weg.
 */
function groupBodyRaw(original, rawLines, eol, headed) {
  const from =
    original.headingLine !== null ? original.headingLine + 1 : original.start
  const body = rawLines.slice(from, original.end)
  while (!headed && body.length > 0 && isBlank(lineText(body[0]))) body.shift()
  return body.map((raw) => withEol(raw, eol)).join('')
}

/** Rohzeile wiederverwenden, wenn sie genau diesen Wert trägt. */
function takeRaw(items, used, same) {
  const k = items.findIndex((item, idx) => !used.has(idx) && same(item))
  if (k < 0) return null
  used.add(k)
  return items[k].raw
}

function withEol(raw, eol) {
  return raw.endsWith('\n') ? raw : raw + eol
}

function renderPartChunk(value, original, options) {
  const { eol, style, level, headed, rawLines } = options
  const defaultUnit = original ? original.defaultUnit : null
  if (original && samePart(original.value, value)) return original.raw
  let out = ''
  const title =
    value.title === null && headed ? SECTION_TITLES.ingredients : value.title
  if (title !== null) {
    out += groupHeading(level, value.title, title, original, rawLines, eol)
  }
  // Nur der Name ist anders: alle Zeilen bleiben, wie sie sind.
  if (original && sameIngredients(original.value, value)) {
    return out + groupBodyRaw(original, rawLines, eol, out !== '')
  }
  if (style === 'table') {
    if (original && original.head.length > 0) {
      for (const line of original.head) out += withEol(rawLines[line], eol)
    } else {
      out += `| Zutat | Menge |${eol}|-------|-------|${eol}`
    }
  }
  const used = new Set()
  const items = original ? original.items : []
  for (const ing of value.ingredients) {
    const raw = takeRaw(items, used, (item) => sameIngredient(item.value, ing))
    if (raw !== null) out += withEol(raw, eol)
    else if (style === 'table')
      out += renderTableIngredient(ing, defaultUnit) + eol
    else out += renderListIngredient(ing, options.marker) + eol
  }
  if (original) {
    for (const total of original.totals)
      out += withEol(rawLines[total.line], eol)
  }
  return out
}

function renderStepItem(text, number, ordered) {
  const [first, ...more] = text.split('\n')
  return [`${ordered ? `${number}.` : '-'} ${first}`, ...more]
}

function renderStepChunk(value, original, options) {
  const { eol, level, rawLines } = options
  if (original && sameGroup(original.value, value)) return original.raw
  let out = ''
  if (value.title !== null) {
    out += groupHeading(
      level,
      value.title,
      value.title,
      original,
      rawLines,
      eol
    )
  }
  if (original && sameItems(original.value, value)) {
    return out + groupBodyRaw(original, rawLines, eol, out !== '')
  }
  const used = new Set()
  const items = original ? original.items : []
  value.items.forEach((text, i) => {
    const raw = takeRaw(
      items,
      used,
      (item) =>
        item.value === text &&
        item.ordered === value.ordered &&
        (!value.ordered || item.number === i + 1)
    )
    if (raw !== null) out += withEol(raw, eol)
    else out += renderStepItem(text, i + 1, value.ordered).join(eol) + eol
  })
  return out
}

/** Gruppen mit ihren alten Zwischenräumen; neue bekommen eine Leerzeile. */
function renderChunks(values, match, gaps, render, eol) {
  let out = ''
  values.forEach((value, j) => {
    out += withEol(render(value, match[j] || null), eol)
    if (j + 1 < values.length) {
      out +=
        gaps[j] !== undefined
          ? gaps[j]
          : gaps.length > 0
          ? gaps[gaps.length - 1]
          : eol
    }
  })
  return out
}

/** Die Zutat, wie die Datei sie nach dem Schreiben wieder läse. */
function rereadIngredient(ing, style, defaultUnit, marker) {
  if (style === 'table') {
    return parseTableIngredient(
      splitRow(renderTableIngredient(ing, defaultUnit)),
      defaultUnit
    )
  }
  return parseListIngredient(renderListIngredient(ing, marker))
}

/**
 * Warum die Datei diese Zutat anders läse, als sie eingegeben wurde -
 * `null`, wenn sie genau so zurückkommt. Nichts wird umgedeutet: aus einem
 * Namen wird nie eine Menge (`1050 Roggenmehl` ohne Menge wäre „1050 ×
 * Roggenmehl“), aus einem Hinweis nie ein Teil des Namens.
 */
function ingredientProblem(ing, read, style) {
  if (style !== 'table' && ing.note !== null) {
    return 'Diese Zutatengruppe ist eine Liste und führt keinen eigenen Hinweis je Zutat. Bitte den Hinweis in den Namen schreiben, z. B. „Ei (zum Abglänzen)“.'
  }
  if (sameIngredient(ing, read)) return null
  if (ing.amount === null && read.amount !== null) {
    return style === 'table'
      ? `Der Hinweis „${ing.note}“ würde in der Rezeptdatei als Menge gelesen. Bitte die Menge in das Feld „Menge“ eintragen.`
      : `„${ing.name}“ beginnt mit einer Zahl, die in der Rezeptdatei als Menge gelesen würde. Bitte die Menge in das Feld „Menge“ eintragen oder den Namen umstellen (z. B. „Roggenmehl 1050“ statt „1050 Roggenmehl“).`
  }
  return 'Menge, Einheit und Name lassen sich so nicht eindeutig in der Rezeptdatei speichern (z. B. ein Name, der mit einer Einheit beginnt, oder Klammern im Hinweis). Bitte die Angaben in die jeweiligen Felder eintragen.'
}

/**
 * Zutaten in der Schreibweise der Datei. Einzige Umdeutung: in einer
 * Tabelle mit `Menge (g)` trägt eine Zahl ohne Einheit die Einheit der
 * Spalte. Alles andere, was die Datei anders läse, wird abgelehnt.
 * @throws {RecipeInputError}
 */
function canonicalParts(parts, match, blockStyle, marker) {
  return parts.map((part, j) => {
    const original = match[j]
    const style = (original && original.style) || blockStyle
    const unit = original ? original.defaultUnit : null
    const known = original ? original.items.map((item) => item.value) : []
    return {
      title: part.title,
      ingredients: part.ingredients.map((ing, i) => {
        // Steht so in dieser Gruppe der Datei: die Zeile bleibt, wie sie ist.
        if (known.some((value) => sameIngredient(value, ing))) return ing
        const read = rereadIngredient(ing, style, unit, marker)
        const wanted =
          style === 'table' && ing.amount !== null && ing.unit === null && unit
            ? { ...ing, unit }
            : ing
        const problem = ingredientProblem(wanted, read, style)
        if (problem) {
          fail(`Zutatengruppe ${j + 1}, Zutat ${i + 1}: ${problem}`)
        }
        return read
      }),
    }
  })
}

function canonicalSteps(groups) {
  return groups.map((group) => ({
    title: group.title,
    ordered: group.items.length === 0 ? true : group.ordered,
    items: group.items,
  }))
}

function totalOf(chunk) {
  if (!chunk || chunk.totals.length === 0) return null
  return {
    label: chunk.totals[0].cells[0].replace(/^\*\*|\*\*$/g, '').trim(),
    text: (chunk.totals[0].cells[1] || '').replace(/\*\*/g, '').trim(),
  }
}

const MASS_IN_G = Object.freeze({ g: 1, kg: 1000 })

/**
 * Passt die Summenzeile der Datei noch zu den Zutaten darüber? Die App
 * rechnet die Zeile nie neu (sie bleibt wörtlich stehen) - nach einer
 * geänderten Menge stünde sonst eine alte Summe wie eine gültige da.
 * Geprüft wird nur, wenn jede Zutat eine Menge in g/kg hat und die
 * Summenzeile eine Masse nennt; sonst `null` (keine Aussage).
 * @returns {{matches: boolean, sum: number, sumText: string}|null}
 */
function partTotalCheck(part) {
  if (!part || !part.total || !Array.isArray(part.ingredients)) return null
  if (part.ingredients.length === 0) return null
  const stated = readQuantity(part.total.text)
  if (stated.amount === null || !MASS_IN_G[stated.unit]) return null
  let sum = 0
  for (const ingredient of part.ingredients) {
    const factor = MASS_IN_G[ingredient.unit]
    if (typeof ingredient.amount !== 'number' || !factor) return null
    sum += ingredient.amount * factor
  }
  sum = roundAmount(sum)
  return {
    matches: Math.abs(sum - stated.amount * MASS_IN_G[stated.unit]) <= 0.5,
    sum,
    sumText: `${formatAmount(sum, 'table')} g`,
  }
}

function sameTotal(a, b) {
  if (a === null || b === null) return a === b
  return a.label === b.label && a.text === b.text
}

const UNSAFE_FILE =
  'Die Angaben lassen sich in dieser Rezeptdatei nicht eindeutig speichern. Bitte Sonderzeichen in Namen, Mengen und Texten prüfen (z. B. Klammern am Ende des Namens, „#“ am Zeilenanfang, „|“).'

/**
 * Schreibt die Eingabe in die Datei: unveränderte Bereiche, Gruppen und
 * Zeilen behalten ihren Rohtext. Das Ergebnis wird noch einmal gelesen und
 * mit der Eingabe verglichen - stimmt es nicht überein, wird nichts
 * geliefert (`invalid_recipe_file`).
 * @param {object} doc Ergebnis von `parseRecipeFile`
 * @param {object} input Felder der Verwaltung (`title`, `yield`, `description`,
 *   `parts`, `steps`, `notes`); was fehlt, bleibt
 * @param {{category?: string}} [options] neue Kategorie (Verschieben): setzt `category:` im Kopf
 * @returns {{ok: true, text: string, changed: boolean, model: object}
 *   | {ok: false, error: string, message: string}}
 */
function applyRecipeInput(doc, input, options) {
  if (!doc.editable) {
    return { ok: false, error: 'recipe_read_only', message: doc.readOnlyReason }
  }
  const invalid = (error) => {
    if (error instanceof RecipeInputError) {
      return { ok: false, error: 'validation', message: error.message }
    }
    throw error
  }
  let target
  try {
    target = normalizeRecipeInput(input, doc.model, doc.level)
  } catch (error) {
    return invalid(error)
  }

  const { eol, regions, format, model } = doc
  const rawLines = splitLines(doc.text)
  const level = doc.level
  const sections = regions.filter((r) => r.kind === 'section')
  const byType = (type) => sections.find((s) => s.type === type) || null
  const h1 = regions.find((r) => r.kind === 'h1') || null
  const intro = regions.find((r) => r.kind === 'intro') || null
  const ingredientsSection = byType('ingredients')
  const partSections = sections.filter((s) => s.type === 'part')
  const stepsSection = byType('steps')
  const notesSection = byType('notes')
  const descriptionSection = byType('description')
  const fmEntry = (key) =>
    regions.find((r) => r.kind === 'fm-entry' && r.key === key) || null

  // --- Zutaten in der Schreibweise der Datei ------------------------------
  const partChunks = ingredientsSection
    ? ingredientsSection.chunks
    : partSections.map((s) => s.chunk)
  const blockStyle =
    (partChunks.find((c) => c.style) || {}).style ||
    (format === 'table' ? 'table' : 'list')
  const marker =
    (partChunks.find((c) => c.marker) || {}).marker ||
    (format === 'standard' ? '- [ ] ' : '- ')
  const tableLayout =
    partSections.length > 0 || (!ingredientsSection && format === 'table')
  if (
    !tableLayout &&
    target.parts.some((part, j) => j > 0 && part.title === null)
  ) {
    return {
      ok: false,
      error: 'validation',
      message:
        'Bei mehreren Zutatengruppen braucht jede Gruppe ab der zweiten einen Namen.',
    }
  }
  // Welche Gruppe der Datei zu welcher der Eingabe gehört - einmal bestimmt,
  // für Schreibweise, Rohtext und die Summenzeilen.
  const partMatch = matchParts(target.parts, partChunks)
  try {
    target.parts = canonicalParts(target.parts, partMatch, blockStyle, marker)
  } catch (error) {
    return invalid(error)
  }
  target.steps = canonicalSteps(target.steps)
  const stepMatch = matchSteps(
    target.steps,
    stepsSection ? stepsSection.chunks : []
  )
  /** Eine Summenzeile gehört zu ihrer Gruppe und bleibt mit ihr stehen. */
  const totals = partMatch.map(totalOf)

  const titleChanged = target.title !== model.title
  const categoryFm =
    options && options.category
      ? (categoryOf(options.category) || {}).frontmatter
      : null

  // --- Tabellenformat: wo steht der Ertrag ------------------------------
  const yieldInIntro =
    format === 'table' && !(h1 && h1.yield) && intro && intro.yield !== null
  const notesInIntro = format === 'table' && !notesSection && intro !== null

  const partOptions = { eol, rawLines, style: blockStyle, marker }
  const out = createOutput(eol)
  const sectionLevel = level
  const newHeading = (type) =>
    `${'#'.repeat(sectionLevel)} ${SECTION_TITLES[type]}${eol}`

  const renderParts = (values, match, gaps, headed) =>
    renderChunks(
      values,
      match,
      gaps,
      (value, original) =>
        renderPartChunk(value, original, {
          ...partOptions,
          style: (original && original.style) || blockStyle,
          level: headed ? sectionLevel : sectionLevel + 1,
          headed,
        }),
      eol
    )
  const renderSteps = (values, match, gaps) =>
    renderChunks(
      values,
      match,
      gaps,
      (value, original) =>
        renderStepChunk(value, original, {
          eol,
          rawLines,
          level: sectionLevel + 1,
        }),
      eol
    )
  const renderText = (type, text) =>
    `${newHeading(type)}${text.split('\n').join(eol)}${eol}`

  /** Neue Abschnitte, die es in der Datei noch nicht gibt. */
  const additions = []
  if (target.description !== null && !descriptionSection) {
    additions.push({
      type: 'description',
      text: renderText('description', target.description),
    })
  }
  if (
    target.parts.length > 0 &&
    partChunks.length === 0 &&
    !ingredientsSection
  ) {
    additions.push({
      type: 'ingredients',
      text: tableLayout
        ? renderParts(target.parts, [], [], true)
        : newHeading('ingredients') +
          (target.parts[0].title !== null ? eol : '') +
          renderParts(target.parts, [], [], false),
    })
  }
  if (target.steps.length > 0 && !stepsSection) {
    additions.push({
      type: 'steps',
      text:
        newHeading('steps') +
        (target.steps[0].title !== null ? eol : '') +
        renderSteps(target.steps, [], []),
    })
  }
  if (target.notes !== null && !notesSection && !notesInIntro) {
    additions.push({ type: 'notes', text: renderText('notes', target.notes) })
  }
  /** Hinter welchem Bereich ein neuer Abschnitt landet. */
  const anchorOf = (type) => {
    const rank = SECTION_RANK[type]
    let anchor = -1
    regions.forEach((r, idx) => {
      if (r.kind === 'footer') return
      if (r.kind !== 'section') anchor = Math.max(anchor, idx)
      else if (type === 'notes' || (SECTION_RANK[r.type] || 99) < rank)
        anchor = idx
    })
    if (type !== 'notes') {
      // nie hinter einen Abschnitt, der danach kommen soll
      const firstLater = regions.findIndex(
        (r) => r.kind === 'section' && (SECTION_RANK[r.type] || 4) > rank
      )
      if (firstLater >= 0 && anchor > firstLater) anchor = firstLater - 1
    }
    return anchor
  }
  const insertAfter = new Map()
  for (const addition of additions) {
    const anchor = anchorOf(addition.type)
    if (!insertAfter.has(anchor)) insertAfter.set(anchor, [])
    insertAfter.get(anchor).push(addition)
  }
  let endsWithAddition = false
  /** Der zuletzt geschriebene Bereich fiel weg (Abschnitt geleert). */
  let endsWithRemoval = false
  const flush = (index) => {
    for (const addition of insertAfter.get(index) || []) {
      out.blankLine()
      out.push(addition.text)
      out.push(eol)
      endsWithAddition = true
      endsWithRemoval = false
    }
  }

  // Tabellenformat ohne `# Titel`: erst anlegen, wenn Titel oder Ertrag es brauchen.
  if (
    format === 'table' &&
    !h1 &&
    (titleChanged || (target.yield !== null && !yieldInIntro))
  ) {
    out.push(
      `# ${target.title}${
        target.yield !== null && !yieldInIntro ? ` (${target.yield})` : ''
      }${eol}`
    )
    out.push(eol)
  }
  flush(-1)

  let yieldWritten = fmEntry('yield') !== null || format !== 'standard'
  const yieldAnchor = fmEntry('category') || fmEntry('title')
  const yieldLine = () => `yield: ${renderScalar(target.yield)}${eol}`
  const firstPart = partSections[0] || null

  regions.forEach((region, index) => {
    endsWithAddition = false
    endsWithRemoval = false
    switch (region.kind) {
      case 'fm-entry': {
        if (region.key === 'title' && titleChanged) {
          out.push(`title: ${renderScalar(target.title)}${eol}`)
        } else if (
          region.key === 'yield' &&
          format === 'standard' &&
          target.yield !== model.yield
        ) {
          if (target.yield !== null) out.push(yieldLine())
        } else if (
          region.key === 'category' &&
          categoryFm &&
          parseScalar(lineText(region.raw).replace(/^category:/, '')).value !==
            categoryFm
        ) {
          out.push(`category: ${renderScalar(categoryFm)}${eol}`)
        } else {
          out.push(region.raw)
        }
        if (!yieldWritten && region === yieldAnchor && target.yield !== null) {
          out.push(yieldLine())
          yieldWritten = true
        }
        break
      }
      case 'fm-close': {
        if (format === 'standard' && titleChanged && !fmEntry('title') && !h1) {
          out.push(`title: ${renderScalar(target.title)}${eol}`)
        }
        if (!yieldWritten && target.yield !== null) {
          out.push(yieldLine())
          yieldWritten = true
        }
        out.push(region.raw)
        break
      }
      case 'h1': {
        if (format === 'table') {
          const wanted = yieldInIntro ? null : target.yield
          if (titleChanged || wanted !== region.yield) {
            out.push(
              `# ${region.prefix}${target.title}${
                wanted !== null ? ` (${wanted})` : ''
              }${eol}`
            )
          } else {
            out.push(region.raw)
          }
        } else if (titleChanged) {
          out.push(`# ${target.title}${eol}`)
        } else {
          out.push(region.raw)
        }
        break
      }
      case 'intro': {
        if (format !== 'table') {
          out.push(region.raw)
          break
        }
        const wantedYield = yieldInIntro ? target.yield : region.yield
        const wantedNotes = notesInIntro ? target.notes : region.notes
        if (wantedYield === region.yield && wantedNotes === region.notes) {
          out.push(region.raw)
          break
        }
        const content = []
        if (wantedYield !== null) content.push(`- **Menge**: ${wantedYield}`)
        if (wantedNotes !== null) content.push(...wantedNotes.split('\n'))
        if (content.length === 0) {
          out.push(eol)
        } else {
          out.push(region.lead || eol)
          out.push(content.join(eol) + eol)
          out.push(region.trail || eol)
        }
        break
      }
      case 'section': {
        if (region.type === 'ingredients') {
          const values = region.chunks.map((c) => c.value)
          if (sameList(values, target.parts, samePart)) out.push(region.raw)
          else if (target.parts.length > 0) {
            out.push(region.head)
            out.push(renderParts(target.parts, partMatch, region.gaps, false))
            out.push(region.tail)
          } else endsWithRemoval = true
        } else if (region.type === 'part') {
          if (region !== firstPart) {
            endsWithRemoval = target.parts.length === 0
            break
          }
          const values = partSections.map((s) => s.chunk.value)
          if (sameList(values, target.parts, samePart)) {
            for (const s of partSections) out.push(s.raw)
          } else if (target.parts.length > 0) {
            const last = partSections[partSections.length - 1]
            out.push(
              renderParts(
                target.parts,
                partMatch,
                partSections.slice(0, -1).map((s) => s.tail),
                true
              )
            )
            out.push(last.tail)
          } else endsWithRemoval = true
        } else if (region.type === 'steps') {
          const values = region.chunks.map((c) => c.value)
          if (sameList(values, target.steps, sameGroup)) out.push(region.raw)
          else if (target.steps.length > 0) {
            out.push(region.head)
            out.push(renderSteps(target.steps, stepMatch, region.gaps))
            out.push(region.tail)
          } else endsWithRemoval = true
        } else if (region.type === 'notes' || region.type === 'description') {
          const wanted =
            region.type === 'notes' ? target.notes : target.description
          if (wanted === region.text) out.push(region.raw)
          else if (wanted !== null) {
            // Bisher leer: die Leerzeilen nach der Überschrift bleiben dahinter.
            out.push(
              region.text === null
                ? withEol(region.headingRaw, eol)
                : region.head
            )
            out.push(wanted.split('\n').join(eol) + eol)
            out.push(region.text === null ? region.lead : region.tail)
          } else endsWithRemoval = true
        } else {
          out.push(region.raw)
        }
        break
      }
      default:
        out.push(region.raw)
    }
    flush(index)
  })

  let text = out.text
  // Ein neu angehängter oder entfernter Abschnitt am Dateiende: keine
  // Leerzeile am Schluss stehen lassen.
  if (endsWithAddition || endsWithRemoval)
    text = text.replace(/(?:\r?\n)+$/, eol)

  const changed = text !== doc.text
  if (!changed) {
    return { ok: true, text: doc.text, changed: false, model: doc.model }
  }
  // Mit demselben Dateinamen: ohne Titel in der Datei ist er der Titel.
  const check = parseRecipeFile(text, { fileStem: doc.fileStem })
  const sameModel =
    check.editable &&
    check.format === format &&
    check.model.title === target.title &&
    check.model.yield === target.yield &&
    check.model.description === target.description &&
    check.model.notes === target.notes &&
    sameList(check.model.parts, target.parts, samePart) &&
    // keine Summenzeile geht verloren oder wandert in eine andere Gruppe
    check.model.parts.every((part, j) => sameTotal(part.total, totals[j])) &&
    sameList(check.model.steps, target.steps, sameGroup)
  if (!sameModel) {
    return { ok: false, error: 'invalid_recipe_file', message: UNSAFE_FILE }
  }
  return { ok: true, text, changed: true, model: check.model }
}

/**
 * Text einer neuen Rezeptdatei im Standardformat (YAML-Kopf mit `title`,
 * `category`, `yield`; nur was angegeben ist - nichts Erfundenes).
 * @returns {{ok: true, text: string, model: object} | {ok: false, error: string, message: string}}
 */
function newRecipeFile(input, options) {
  let title
  try {
    title = normalizeRecipeInput(input, null, 2).title
  } catch (error) {
    if (error instanceof RecipeInputError) {
      return { ok: false, error: 'validation', message: error.message }
    }
    throw error
  }
  const category = categoryOf(options && options.category)
  const head = [`title: ${renderScalar(title)}`]
  if (category && category.frontmatter) {
    head.push(`category: ${renderScalar(category.frontmatter)}`)
  }
  const skeleton = `---\n${head.join('\n')}\n---\n\n# ${title}\n`
  const doc = parseRecipeFile(skeleton, { fileStem: '' })
  if (!doc.editable || doc.model.title !== title) {
    return { ok: false, error: 'invalid_recipe_file', message: UNSAFE_FILE }
  }
  const result = applyRecipeInput(doc, input)
  if (!result.ok) return result
  return { ok: true, text: result.text, model: result.model }
}

// ----------------------------------------------------------------- Sicht der API

/** Die bearbeitbaren Felder eines Modells - genau das, was ein PUT zurückschickt. */
function recipeInputOf(model) {
  return {
    title: model.title,
    yield: model.yield,
    description: model.description,
    parts: model.parts.map((part) => ({
      title: part.title,
      ingredients: part.ingredients.map(ingredientValue),
    })),
    steps: model.steps.map((group) => ({
      title: group.title,
      ordered: group.ordered,
      items: [...group.items],
    })),
    notes: model.notes,
  }
}

/** Ohne Akzente und Großschreibung, für die Suche. */
function searchKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

/** Findet `query` (alle Wörter) in Titel, Zutaten, Schlagworten oder Dateiname. */
function matchesSearch(model, query, extra) {
  const words = searchKey(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = searchKey(
    [
      model.title,
      extra || '',
      ...model.parts.flatMap((part) => [
        part.title || '',
        ...part.ingredients.map((i) => i.name),
      ]),
      ...model.meta.filter((m) => m.key === 'tags').map((m) => m.value || ''),
    ].join('\n')
  )
  return words.every((word) => haystack.includes(word))
}

// ----------------------------------------------------------------- Dateinamen

/**
 * Dateien, die als Rezept zählen: `*.md` oder ohne Endung, keine versteckten,
 * kein README, keine Pfad- oder Anführungszeichen, kein Leerraum am Rand.
 */
function isRecipeFileName(name) {
  if (typeof name !== 'string' || name === '' || name.length > 200) return false
  if (/^[._]/.test(name) || /[\\/"]/.test(name)) return false
  // git schreibt solche Namen in Anführungszeichen bzw. der Zeilenleser
  // schneidet sie ab - als Pfadangabe träfen sie dann nichts.
  if (name !== name.trim()) return false
  if (controlChars.hasNameControlChars(name)) return false
  if (/^readme(\.md)?$/i.test(name)) return false
  return /\.md$/i.test(name) || !name.includes('.')
}

function fileStem(name) {
  return String(name).replace(/\.md$/i, '')
}

/**
 * Kennungen (`slug`) für die Dateien eines Kategorie-Verzeichnisses, aus dem
 * Dateinamen abgeleitet (`Gefüllte-Testkränze.md` → `gefuellte-testkraenze`).
 * Gleiche Ergebnisse bekommen in Namensreihenfolge `-2`, `-3` …
 * `leaving` sind Dateien, deren Löschung auf Freigabe wartet: sie kommen
 * zuletzt dran. Ein Rezept, das unter demselben Namen neu angelegt wird,
 * hat so von Anfang an die Kennung, die es nach der Freigabe behält.
 * @param {Iterable<string>} names
 * @param {Iterable<string>} [leaving]
 * @returns {Map<string, string>} Dateiname → slug (Dateien ohne brauchbaren Namen fehlen)
 */
function slugsForFiles(names, leaving) {
  const out = new Map()
  const taken = new Set()
  const last = new Set(leaving || [])
  const byName = (a, b) =>
    a.normalize('NFC') < b.normalize('NFC')
      ? -1
      : a.normalize('NFC') > b.normalize('NFC')
      ? 1
      : 0
  const all = [...names]
  const sorted = [
    ...all.filter((name) => !last.has(name)).sort(byName),
    ...all.filter((name) => last.has(name)).sort(byName),
  ]
  for (const name of sorted) {
    if (!isRecipeFileName(name)) continue
    const base = slugify(fileStem(name).normalize('NFC'))
      .slice(0, SLUG_MAX)
      .replace(/-+$/, '')
    if (!base) continue
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    taken.add(slug)
    out.set(name, slug)
  }
  return out
}

/** Dateiname für ein neues Rezept, oder `null`, wenn der Name keinen hergibt. */
function newFileName(title) {
  const slug = slugify(String(title).normalize('NFC'))
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
  if (!SLUG.test(slug) || slug === 'readme') return null
  return { slug, fileName: `${slug}.md` }
}

// ----------------------------------------------------------------- Backzettel-Verweise

/**
 * Alle `recipe:`-Pfade der Backzettel-Stammdaten (heute `fillings[]`,
 * genauso `doughs[]`, sobald dort einer steht): wer ein Rezept benutzt.
 * @param {object} config geparste `config/backzettel.yaml`
 * @returns {Array<{kind: string, id: string|null, name: string|null, recipe: string, section: string|null}>}
 */
function collectRecipeReferences(config) {
  const out = []
  if (!isObject(config)) return out
  const KINDS = { fillings: 'filling', doughs: 'dough' }
  for (const [key, list] of Object.entries(config)) {
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (!isObject(entry) || typeof entry.recipe !== 'string') continue
      const recipe = entry.recipe.trim()
      if (!recipe) continue
      out.push({
        kind: KINDS[key] || key,
        id:
          entry.id === undefined || entry.id === null ? null : String(entry.id),
        name: typeof entry.name === 'string' ? entry.name : null,
        recipe,
        section:
          typeof entry.section === 'string' && entry.section.trim()
            ? entry.section.trim()
            : null,
      })
    }
  }
  return out
}

/** Pfad eines Verweises, vergleichbar gemacht (`data/recipes/…`, NFC, `/`). */
function referenceKey(recipePath) {
  return String(recipePath)
    .normalize('NFC')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/** Betreff + Trailer eines hq-Commits. `action`: create | update | delete | move. */
function commitSubject(action, title, rel) {
  const verb =
    { create: 'angelegt', delete: 'gelöscht', move: 'verschoben' }[action] ||
    'geändert'
  const clean = (value) =>
    String(value ?? '')
      .replace(/[\r\n<>]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  return `recipes: ${clean(title) || 'Rezept'} (${clean(rel)}) ${verb}`
}

module.exports = {
  CATEGORIES,
  CATEGORY_DIR,
  LIMITS,
  UNITS,
  TEIG_READ_ONLY,
  RecipeInputError,
  applyRecipeInput,
  canonicalUnit,
  categoryOf,
  cleanHeading,
  collectRecipeReferences,
  commitSubject,
  fileStem,
  formatAmount,
  isRecipeFileName,
  matchesSearch,
  newFileName,
  newRecipeFile,
  normalizeRecipeInput,
  parseRecipeFile,
  partTotalCheck,
  readQuantity,
  recipeInputOf,
  referenceKey,
  scanIngredientTables,
  slugify,
  slugsForFiles,
  splitRow,
  isSeparatorRow,
}
