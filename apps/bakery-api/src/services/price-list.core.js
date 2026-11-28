/**
 * Preisliste (Export der Produktseite): aus dem freigegebenen hq-Katalog wird
 * EIN Dokument gebaut - Kategorien, Zeilen, Varianten, formatierte Preise -,
 * das Druckansicht (Management-App) und CSV gleich lesen. Gruppieren,
 * Sortieren und Formatieren stehen nur hier.
 *
 * Dependency-freies CommonJS wie die anderen `*.core.js`; Dateien, Datenbank
 * und Rollen macht `routes/price-list.routes.ts`.
 *
 * Regeln (docs/domains/produkte.md, „Preisliste“):
 * - **Preise wie gespeichert**, nur auf zwei Nachkommastellen aufgefüllt
 *   (`2.5` -> „2,50 €“). Gerundet wird nichts; ein Preis mit mehr als zwei
 *   Nachkommastellen bleibt so stehen und steht in `dataWarnings`.
 * - **Kein Preis ist kein Preis.** Ein Produkt ohne brauchbaren Preis (fehlt,
 *   kein Zahlwert, 0 oder negativ) steht nicht in der Liste, sondern in
 *   `omitted.noPrice` - die App zeigt es intern als „Preis offen“.
 * - **Einheiten nur, wo der Name sie trägt** („500g“, „(1/4 Stück)“,
 *   „klein“/„groß“ bei Geschwistern). hq hat kein Einheiten-Feld; „ganz“ oder
 *   „je Stück“ wird nicht dazugedichtet.
 * - **Allergene nur als positive Angabe** (wie `@bakery/shared/utils`): ohne
 *   Eintrag in hq ist die Angabe offen (`declared: false`), nie „keine“.
 */

const { csvCell } = require('./partner-stats.core')

/** Reihenfolge der Kategorien auf der Liste (wie `hq/products/_template.md`). */
const CATEGORY_ORDER = Object.freeze([
  'brot',
  'broetchen',
  'baguette',
  'snacks',
  'teilchen',
  'kuchen',
  'torten',
])

/** Bezeichnungen wie in der Produktliste der Verwaltung (`lib/products.ts`). */
const CATEGORY_LABELS = Object.freeze({
  brot: 'Brot',
  broetchen: 'Brötchen',
  baguette: 'Baguette',
  snacks: 'Snacks',
  teilchen: 'Teilchen',
  kuchen: 'Kuchen',
  torten: 'Torten',
})

const AUDIENCES = Object.freeze(['laden', 'partner'])

const SETTLEMENT_LABELS = Object.freeze({
  commission: 'Kommission',
  firm_sale: 'Festkauf',
})

/** Höchstens so viele Gewichts-Spalten, sonst wird die Kategorie eine Liste. */
const MAX_MATRIX_COLUMNS = 4

const NBSP = '\u00a0'

function categoryLabel(key) {
  const k = String(key ?? '')
  if (CATEGORY_LABELS[k]) return CATEGORY_LABELS[k]
  if (k === '') return 'Ohne Kategorie'
  return k.charAt(0).toUpperCase() + k.slice(1)
}

/** Sortierschlüssel: bekannte Kategorien in fester Reihenfolge, Rest alphabetisch. */
function compareCategories(a, b) {
  const ia = CATEGORY_ORDER.indexOf(a)
  const ib = CATEGORY_ORDER.indexOf(b)
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  }
  return String(a).localeCompare(String(b), 'de')
}

/**
 * Der Preis eines Produkts als Zahl - oder `null`, wenn keiner da ist.
 * Text wie `"3.5"` aus einer von Hand geschriebenen Datei zählt; `""`, `null`,
 * `0` und Negatives nicht (eine Liste mit „0,00 €“ verschenkt Ware).
 */
function readPrice(value) {
  let n = null
  if (typeof value === 'number') n = value
  else if (typeof value === 'string' && /^\d+([.,]\d+)?$/.test(value.trim())) {
    n = Number(value.trim().replace(',', '.'))
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return null
  return n
}

/** Nachkommastellen, wie sie gespeichert sind (`1.895` -> 3). */
function storedDecimals(price) {
  const text = String(price)
  if (/e/i.test(text)) return 2
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

/** `1234.5` -> „1.234,50“ - nie gerundet, höchstens aufgefüllt. */
function formatAmount(price) {
  const decimals = Math.max(2, storedDecimals(price))
  const [int, frac] = Number(price).toFixed(decimals).split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`
}

/** „2,50 €“ mit geschütztem Leerzeichen. */
function formatPrice(price) {
  return `${formatAmount(price)}${NBSP}€`
}

/** `2026-12-01` -> „01.12.2026“; alles andere `''`. */
function formatDate(iso) {
  if (!isIsoDate(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Kalendarisch gültiges `YYYY-MM-DD`. */
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

const PIECE_RE = /^(.*\S)\s*\((\d+(?:\/\d+)?)\s*Stück\)$/
const WEIGHT_RE = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s?(g|kg)$/i
const SIZE_RE = /^(.*\S)\s+(klein|mittel|groß)$/i
const FRACTIONS = Object.freeze({ '1/4': '¼', '1/2': '½', '3/4': '¾' })

function pieceLabel(amount) {
  if (amount === '1') return 'Stück'
  if (FRACTIONS[amount]) return `${FRACTIONS[amount]}${NBSP}Stück`
  return `${amount}${NBSP}Stück`
}

/**
 * Zerlegt einen Produktnamen in Grundnamen und die Einheiten, die er trägt:
 * „Kornbrot 500g“ -> Kornbrot / 500 g, „Rahmkuchen (1 Stück)“ -> Rahmkuchen /
 * Stück, „Baguette klein“ -> Baguette / klein. Nichts davon ändert den Namen
 * in hq - es ist nur die Darstellung auf der Liste.
 */
function splitName(rawName) {
  let base = String(rawName ?? '').trim()
  let piece = null
  let weight = null
  let grams = null
  let size = null

  const p = PIECE_RE.exec(base)
  if (p) {
    base = p[1]
    piece = pieceLabel(p[2])
  }
  const w = WEIGHT_RE.exec(base)
  if (w) {
    base = w[1]
    const unit = w[3].toLowerCase()
    weight = `${w[2].replace('.', ',')}${NBSP}${unit}`
    grams = Number(w[2].replace(',', '.')) * (unit === 'kg' ? 1000 : 1)
  }
  const baseWithSize = base
  const s = SIZE_RE.exec(base)
  if (s) {
    base = s[1]
    size = s[2].toLowerCase()
  }
  return { base, baseWithSize, piece, weight, grams, size }
}

function allergenKeys(product) {
  if (!Array.isArray(product.allergens)) return null
  return product.allergens.filter((k) => typeof k === 'string' && k.trim())
}

function sameKeys(a, b) {
  if (a === null || b === null) return a === b
  if (a.length !== b.length) return false
  const sorted = [...b].sort()
  return [...a].sort().every((k, i) => k === sorted[i])
}

/**
 * Allergen-Angabe einer Zeile. Haben alle Varianten dieselbe Angabe, steht
 * sie einmal da; weichen sie ab, je Variante - nie die Vereinigung (das wäre
 * für eine Variante eine falsche Aussage) und nie „keine“.
 */
function rowAllergens(variants, allergenText) {
  const lists = variants.map((v) => v.allergenKeys)
  const text = (keys) =>
    keys === null || keys.length === 0 ? null : allergenText(keys)
  if (lists.every((l) => sameKeys(l, lists[0]))) {
    const t = text(lists[0])
    return { declared: t !== null, text: t, partial: false }
  }
  const parts = variants.map((v) => {
    const t = text(v.allergenKeys)
    return `${v.label || 'ohne Zusatz'}: ${t === null ? 'Angabe offen' : t}`
  })
  return {
    declared: true,
    text: parts.join('; '),
    partial: lists.some((l) => l === null || l.length === 0),
  }
}

function defaultAllergenText(keys) {
  return keys.join(', ')
}

function numericId(product) {
  const n = Number(product.numeric_id)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/**
 * Die Zeilen einer Kategorie: Produkte mit gleichem Grundnamen werden eine
 * Zeile mit Varianten. Reihenfolge wie in hq (`numeric_id`); Varianten: ohne
 * Zusatz zuerst, dann nach Gewicht, sonst nach `numeric_id`.
 */
function buildRows(products, options) {
  const parsed = products.map((product) => ({
    product,
    parts: splitName(product.name),
  }))

  // „klein“/„groß“ ist nur dann eine Variante, wenn es ein Geschwister gibt
  // („Baguette klein“ + „Baguette groß“); sonst gehört es zum Namen.
  const perBase = new Map()
  for (const { parts } of parsed) {
    perBase.set(parts.base, (perBase.get(parts.base) || 0) + 1)
  }

  const groups = new Map()
  for (const { product, parts } of parsed) {
    const useSize = parts.size !== null && perBase.get(parts.base) > 1
    const name = useSize ? parts.base : parts.baseWithSize
    const labelParts = [
      useSize ? parts.size : null,
      parts.weight,
      parts.piece,
    ].filter(Boolean)
    const variant = {
      productId: product.id,
      numericId: Number.isFinite(Number(product.numeric_id))
        ? Number(product.numeric_id)
        : null,
      fullName: String(product.name),
      label: labelParts.join(', '),
      isWeight: labelParts.length === 1 && parts.weight !== null,
      grams: parts.grams,
      price: product.price,
      priceText: formatPrice(product.price),
      unavailable: product.available === false,
      seasonal: product.seasonal === true,
      allergenKeys: allergenKeys(product),
      order: numericId(product),
    }
    const group = groups.get(name)
    if (group) group.push(variant)
    else groups.set(name, [variant])
  }

  const rows = []
  for (const [name, variants] of groups) {
    variants.sort((a, b) => {
      // Ohne Zusatz zuerst (der ganze Kuchen vor seinem Stück).
      if ((a.label === '') !== (b.label === '')) return a.label === '' ? -1 : 1
      if (a.isWeight && b.isWeight && a.grams !== b.grams) {
        return a.grams - b.grams
      }
      return a.order - b.order
    })
    const allergens = options.withAllergens
      ? rowAllergens(variants, options.allergenText)
      : null
    rows.push({
      key: variants[0].productId,
      name,
      order: Math.min(...variants.map((v) => v.order)),
      seasonal: variants.every((v) => v.seasonal),
      unavailable: variants.every((v) => v.unavailable),
      allergens,
      variants: variants.map((v) => ({
        productId: v.productId,
        numericId: v.numericId,
        fullName: v.fullName,
        label: v.label,
        isWeight: v.isWeight,
        grams: v.grams,
        price: v.price,
        priceText: v.priceText,
        unavailable: v.unavailable,
        seasonal: v.seasonal,
        note: variantNote(v),
      })),
    })
  }
  rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'))
  return rows.map(({ order, ...row }) => row)
}

/**
 * Darstellung einer Kategorie: `matrix`, wenn jede Variante genau ein Gewicht
 * trägt und es höchstens vier verschiedene gibt (Brot: 500 g | 750 g |
 * 1000 g) - sonst `list` (eine Preiszeile je Variante).
 */
function layoutOf(rows) {
  const columns = new Map()
  for (const row of rows) {
    const seen = new Set()
    for (const v of row.variants) {
      if (!v.isWeight || seen.has(v.label)) return { layout: 'list' }
      seen.add(v.label)
      columns.set(v.label, v.grams)
    }
  }
  if (columns.size < 2 || columns.size > MAX_MATRIX_COLUMNS) {
    return { layout: 'list' }
  }
  return {
    layout: 'matrix',
    columns: [...columns.entries()]
      .sort((a, b) => a[1] - b[1])
      .map((e) => e[0]),
  }
}

/**
 * Sortiment eines Partners als Prüf-Funktion. `assortment` ist
 * `{ slugs: string[], numericIds: number[] }` (aus Standard-Bestückung oder
 * Besuchen) oder `null` = ganzes Sortiment.
 */
function assortmentFilter(assortment) {
  if (!assortment) return null
  const slugs = new Set((assortment.slugs || []).map(String))
  const ids = new Set(
    (assortment.numericIds || []).map(Number).filter(Number.isFinite)
  )
  return (product) =>
    slugs.has(String(product.id)) ||
    (product.numeric_id !== undefined && ids.has(Number(product.numeric_id)))
}

/**
 * Baut die Preisliste.
 *
 * @param {ReadonlyArray<object>} products  Katalog (`HqProduct`, freigegebener Stand)
 * @param {object} [options]
 * @param {'laden'|'partner'} [options.audience]
 * @param {string[]|null} [options.categories]  nur diese Kategorien (Schlüssel)
 * @param {string|null} [options.validFrom]  `YYYY-MM-DD` oder leer
 * @param {string} [options.today]  `YYYY-MM-DD` - „Stand“
 * @param {boolean} [options.includeUnavailable]
 * @param {boolean} [options.withAllergens]
 * @param {(keys: string[]) => string} [options.allergenText]
 * @param {{slugs?: string[], numericIds?: number[]}|null} [options.assortment]
 * @param {object|null} [options.partner]  Stammdaten für den Kopf der Partnerliste
 */
function buildPriceList(products, options = {}) {
  const audience = options.audience === 'partner' ? 'partner' : 'laden'
  const includeUnavailable = options.includeUnavailable === true
  const withAllergens = options.withAllergens === true
  const allergenText =
    typeof options.allergenText === 'function'
      ? options.allergenText
      : defaultAllergenText
  const validFrom = isIsoDate(options.validFrom) ? options.validFrom : null
  const today = isIsoDate(options.today) ? options.today : null
  const wanted =
    Array.isArray(options.categories) && options.categories.length > 0
      ? new Set(options.categories.map(String))
      : null
  const inAssortment = assortmentFilter(options.assortment)

  const scope = (Array.isArray(products) ? products : []).filter(
    (p) => p && p.id && p.name && (!inAssortment || inAssortment(p))
  )

  // Kategorien zur Auswahl: alles im Umfang (Sortiment), vor dem Filter.
  const perCategory = new Map()
  for (const p of scope) {
    const key = String(p.category ?? '')
    perCategory.set(key, (perCategory.get(key) || 0) + 1)
  }
  const availableCategories = [...perCategory.keys()]
    .sort(compareCategories)
    .map((key) => ({
      key,
      label: categoryLabel(key),
      count: perCategory.get(key),
    }))

  const noPrice = []
  const dataWarnings = []
  let hiddenUnavailable = 0
  const listed = new Map()
  for (const p of scope) {
    const key = String(p.category ?? '')
    if (wanted && !wanted.has(key)) continue
    if (p.available === false && !includeUnavailable) {
      hiddenUnavailable += 1
      continue
    }
    const price = readPrice(p.price)
    if (price === null) {
      noPrice.push({
        id: String(p.id),
        name: String(p.name),
        category: key,
        categoryLabel: categoryLabel(key),
      })
      continue
    }
    if (storedDecimals(price) > 2) {
      dataWarnings.push({
        id: String(p.id),
        name: String(p.name),
        code: 'price_decimals',
        message: `${
          p.name
        }: Preis mit mehr als zwei Nachkommastellen (${formatAmount(
          price
        )} €) - steht ungerundet auf der Liste.`,
      })
    }
    const list = listed.get(key)
    const product = { ...p, price }
    if (list) list.push(product)
    else listed.set(key, [product])
  }

  const categories = [...listed.keys()].sort(compareCategories).map((key) => {
    const rows = buildRows(listed.get(key), { withAllergens, allergenText })
    return {
      key,
      label: categoryLabel(key),
      count: listed.get(key).length,
      ...layoutOf(rows),
      rows,
    }
  })

  const listedCount = categories.reduce((sum, c) => sum + c.count, 0)
  const assortmentSize = inAssortment
    ? new Set([
        ...(options.assortment.slugs || []).map(String),
        ...(options.assortment.numericIds || []).map((n) => `#${n}`),
      ]).size
    : null

  const partner =
    audience === 'partner' && options.partner
      ? {
          id: options.partner.id ?? null,
          name: String(options.partner.name ?? ''),
          street: String(options.partner.street ?? ''),
          zip: String(options.partner.zip ?? ''),
          city: String(options.partner.city ?? ''),
          settlementModel:
            options.partner.settlementModel === 'firm_sale'
              ? 'firm_sale'
              : 'commission',
          settlementLabel:
            SETTLEMENT_LABELS[
              options.partner.settlementModel === 'firm_sale'
                ? 'firm_sale'
                : 'commission'
            ],
          assortmentSource: options.partner.assortmentSource ?? null,
        }
      : null

  return {
    status: listedCount > 0 ? 'ok' : 'no-data',
    audience,
    title: audience === 'partner' ? 'Preisliste für Partner' : 'Preisliste',
    generatedOn: today,
    generatedOnText: today ? formatDate(today) : '',
    validFrom,
    validFromText: validFrom ? formatDate(validFrom) : '',
    options: {
      categories: wanted ? [...wanted].sort(compareCategories) : null,
      includeUnavailable,
      withAllergens,
    },
    partner,
    availableCategories,
    categories,
    counts: {
      listed: listedCount,
      rows: categories.reduce((sum, c) => sum + c.rows.length, 0),
      noPrice: noPrice.length,
      hiddenUnavailable,
      assortment: assortmentSize,
    },
    omitted: { noPrice },
    dataWarnings,
  }
}

/** Zeilenhinweis fürs CSV und den Druck: „saisonal“, „derzeit nicht erhältlich“. */
function variantNote(variant) {
  const notes = []
  if (variant.seasonal) notes.push('saisonal')
  if (variant.unavailable) notes.push('derzeit nicht erhältlich')
  return notes.join(', ')
}

/**
 * Die Liste als CSV für Excel (DE): Semikolon, Dezimalkomma, eine Zeile je
 * Produkt. Der Aufrufer setzt das BOM davor. Zellen über `csvCell`
 * (Formel-Schutz, einmal in `partner-stats.core.js`).
 */
function priceListToCsv(doc) {
  const withAllergens = doc.options.withAllergens
  const withNotes = doc.categories.some((c) =>
    c.rows.some((r) => r.variants.some((v) => variantNote(v) !== ''))
  )
  const header = ['Kategorie', 'Artikel', 'Einheit', 'Preis (EUR)']
  if (withAllergens) header.push('Allergene')
  if (withNotes) header.push('Hinweis')
  header.push('Artikelnummer')

  const lines = [header.map(csvCell).join(';')]
  for (const category of doc.categories) {
    for (const row of category.rows) {
      for (const variant of row.variants) {
        const cells = [
          category.label,
          row.name,
          variant.label.replace(/\u00a0/g, ' '),
          formatAmount(variant.price),
        ]
        if (withAllergens) {
          cells.push(
            row.allergens && row.allergens.declared
              ? row.allergens.text
              : 'Angabe offen'
          )
        }
        if (withNotes) cells.push(variantNote(variant))
        cells.push(variant.numericId === null ? '' : String(variant.numericId))
        lines.push(cells.map(csvCell).join(';'))
      }
    }
  }
  return `${lines.join('\r\n')}\r\n`
}

/** Dateiname ohne Endung: `preisliste-laden-2026-11-13`, `…-brot-kuchen-…`. */
function priceListFileName(doc) {
  const parts = ['preisliste', doc.audience]
  if (doc.options.categories && doc.options.categories.length <= 3) {
    parts.push(...doc.options.categories)
  } else if (doc.options.categories) {
    parts.push('auswahl')
  }
  if (doc.generatedOn) parts.push(doc.generatedOn)
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
}

module.exports = {
  AUDIENCES,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  MAX_MATRIX_COLUMNS,
  categoryLabel,
  compareCategories,
  readPrice,
  formatAmount,
  formatPrice,
  formatDate,
  isIsoDate,
  splitName,
  buildPriceList,
  variantNote,
  priceListToCsv,
  priceListFileName,
}
