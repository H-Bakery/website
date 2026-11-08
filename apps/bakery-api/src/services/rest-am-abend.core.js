// „Rest am Abend“ (roadmap §6 M4): was bei Ladenschluss je Produkt übrig ist.
// Misst das Ziel „unter 5 % unverkauft“ und ist die zweite Hälfte der
// Backzettel-v2-Referenz (§5.4: Verkauf über `plu` plus Rest am Abend - nie
// in die Grundmenge übernommen).
//
// Dependency-freies CommonJS wie `partner-stats.core.js`, genau einmal:
// die echte API (`rest-am-abend.service.ts`), die Tests und der hq-Schnappschuss
// rechnen hiermit. Keine zweite Implementierung anlegen.
//
// Begriffe:
//
//   - **Zeile** = ein Backzettel-Posten × Sorte (wie `backzettel_lines`).
//   - **Zählzeile** = was im Laden gezählt wird: je hq-Produkt des Postens
//     (Kornbrot 500 g und 1000 g, Kranz und Kranz-Viertel) in Stück, mit dem
//     Faktor des Backzettels (`products[].factor`) in die Einheit des
//     Postens umgerechnet. Ein Posten ohne Produkte wird in seiner eigenen
//     Einheit gezählt (Liter-Posten mit `pieces_per_liter` in Laiben).
//     Ein Brot je Laibgröße (Backzettel v2, `variantKind: 'size'`) wird je
//     Größe gezählt, nur mit den Produkten dieser Größe (`products[].size`).
//   - **Gebacken** = Gesamt des **freigegebenen** Backzettels plus die
//     quittierten Nachträge (nach dem Aufrunden, `delta.bake`). Ein Entwurf
//     hat nur „geplant“ - er zählt in der Auswertung nicht. Seit Backzettel v2
//     (Z10) ist das die Backliste des Tages: die Zeilen aller Zettel, deren
//     Teig für diesen Backtag gemacht wird (Brötchen vom Samstag für Sonntag
//     und Dienstag). Freigegeben ist der Tag nur, wenn jeder dieser Zettel
//     freigegeben ist. Überzählige Stücke eines aufgerundeten Bruchs
//     („+n frei“) zählen nie als gebacken.
//   - **Für den Laden** = gebacken − CAP-Lieferung (die geht morgens in den
//     Backschrank, dessen Rest die Besuche messen).
//   - **Restquote** = Rest ÷ für den Laden gebacken.
//
// Ein Tag ohne Zählung ist eine **Lücke, nie 0** - genau wie ein Tag ohne
// Kassenbericht. `null` heißt „nicht gezählt“, `0` heißt „nichts übrig“.

'use strict'

const configCore = require('./backzettel-config.core')
const refCore = require('./backzettel-reference.core')
const { csvCell, deNumber } = require('./partner-stats.core')

const { INTEGER_UNITS, WEEKDAY_NAMES, SECTION_LABELS } = configCore

/** Höchstmenge je Zählzeile (wie die Grundmengen). */
const MAX_QTY = 10000
/** Höchstens so viele Zählzeilen in einem Speichern. */
const MAX_BATCH = 500
/** Gezählt (und korrigiert) wird heute und bis zu 7 Tage zurück (Berlin). */
const COUNT_DAYS_BACK = 7
/** Längster Auswertungszeitraum - wie das Berichtsarchiv (`reports.core`). */
const MAX_RANGE_DAYS = 400
/** Standard-Zeitraum der Auswertung: die letzten 28 Tage bis heute. */
const DEFAULT_RANGE_DAYS = 28
/** Posten dieser Bereiche liegen nicht in der Theke. */
const NOT_SOLD_SECTIONS = new Set(['vorbereitung'])

const RATE_BASIS =
  'Restquote = Rest ÷ (gebacken − CAP-Lieferung). Gebacken = freigegebener Backzettel plus quittierte Nachträge. Nur Tage mit freigegebenem Backzettel und vollständiger Zählung; Tage ohne Zählung sind Lücken, keine 0.'

function round2(x) {
  const r = Math.round(x * 100) / 100
  return r === 0 ? 0 : r
}

function round4(x) {
  return Math.round(x * 10000) / 10000
}

function lineKey(itemId, variant) {
  return `${itemId}|${variant || ''}`
}

function rowKey(itemId, variant, productId) {
  return `${itemId}|${variant || ''}|${productId || ''}`
}

const isCalendarDate = refCore.isCalendarDate
const isoWeekday = refCore.isoWeekday
const addDays = refCore.addDays
const berlinToday = refCore.berlinToday

/** Deutsche Zahl für Meldungen (1.5 → „1,5“). */
function de(n) {
  return String(n).replace('.', ',')
}

/** ISO-Kalenderwoche `YYYY-Www` eines Datums. */
function isoWeek(date) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function listDates(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function catalogNamer(catalog) {
  const names = new Map()
  for (const p of Array.isArray(catalog) ? catalog : []) {
    if (p && p.id && typeof p.name === 'string' && p.name.trim()) {
      names.set(String(p.id), p.name.trim())
    }
  }
  return (id) => names.get(String(id)) || null
}

function itemsById(config) {
  const map = new Map()
  for (const item of config && Array.isArray(config.items)
    ? config.items
    : []) {
    map.set(item.id, item)
  }
  return map
}

/**
 * Anzeigename einer Sorte: bei Laibgrößen das Etikett der Größe („500 g“),
 * sonst der Füllungsname aus der Config, sonst der Slug.
 */
function variantLabel(config, variant, item) {
  if (!variant) return null
  if (isSizeItem(item))
    return configCore.variantDisplayName(config, item, variant)
  const f = (
    config && Array.isArray(config.fillings) ? config.fillings : []
  ).find((x) => x && x.id === variant)
  return f && f.name ? f.name : variant
}

function isCountable(item) {
  return !!item && !NOT_SOLD_SECTIONS.has(item.section)
}

/** Ein Brot je Laibgröße (Backzettel v2): die Größen sind die Sorten. */
function isSizeItem(item) {
  return (
    !!item &&
    item.variantKind === 'size' &&
    Array.isArray(item.sizes) &&
    item.sizes.length > 0
  )
}

/**
 * Die Produkte, die in einer Zeile (Posten × Sorte) gezählt werden. Bei
 * Laibgrößen nur die Produkte dieser Größe - „Testkorn 500 g“ liegt nicht in
 * der 1-kg-Zeile. Sonst alle Produkte des Postens (Sorten wie Nuss/Mohn
 * teilen sich die Produkte).
 */
function productsForVariant(item, variant) {
  const products = (Array.isArray(item.products) ? item.products : []).filter(
    (p) => p && p.id && Number(p.factor) > 0
  )
  if (!isSizeItem(item)) return products
  return products.filter((p) => (p.size || '') === (variant || ''))
}

/**
 * Die Zählzeilen eines Postens (je Sorte: `variant`, wichtig bei
 * Laibgrößen). Eine Größe ohne eigenes Produkt wird in der Einheit des
 * Postens gezählt.
 *
 * @returns {Array<{productId: string, label: string, unit: string, factor: number, integer: boolean, step: number}>}
 *   `factor` rechnet die Zählmenge in die Einheit des Postens um.
 */
function countRowsForItem(item, catalog, variant) {
  if (!item) return []
  const nameOf = catalogNamer(catalog)
  const products = productsForVariant(item, variant)
  const size =
    isSizeItem(item) && variant ? variantLabel(null, variant, item) : null
  const label = size ? `${item.name} ${size}` : item.name
  if (products.length > 0) {
    return products.map((p) => ({
      productId: String(p.id),
      label: nameOf(p.id) || (products.length === 1 ? label : String(p.id)),
      unit: 'Stück',
      factor: Number(p.factor),
      integer: true,
      step: 1,
    }))
  }
  if (item.unit === 'Liter' && Number(item.pieces_per_liter) > 0) {
    return [
      {
        productId: '',
        label: item.name,
        unit: 'Stück',
        factor: 1 / Number(item.pieces_per_liter),
        integer: true,
        step: 1,
      },
    ]
  }
  const unit = item.unit || 'Stück'
  const integer = INTEGER_UNITS.has(unit)
  return [
    {
      productId: '',
      label,
      unit,
      factor: 1,
      integer,
      step: integer ? 1 : 0.5,
    },
  ]
}

/**
 * Eine gezählte Menge lesen: Zahl oder Text („1,5“), `null`/leer = nicht
 * gezählt (löscht die Zählung). Ganze Zahlen in Stück/Blech, sonst höchstens
 * zwei Nachkommastellen; 0 … 10000.
 *
 * @returns {{ok: true, value: number|null} | {ok: false, message: string}}
 */
function parseQty(raw, row, label) {
  const what = label ? `„${label}“: ` : ''
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === 'string' && raw.trim() === '')
  ) {
    return { ok: true, value: null }
  }
  let n
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(raw)) {
    n = Number(raw.trim().replace(',', '.'))
  } else {
    return {
      ok: false,
      message: `${what}Die Menge muss eine Zahl ab 0 sein.`,
    }
  }
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      message: `${what}Die Menge muss eine Zahl ab 0 sein.`,
    }
  }
  if (n > MAX_QTY) {
    return {
      ok: false,
      message: `${what}Die Menge darf höchstens ${MAX_QTY} sein.`,
    }
  }
  const integer = !row || row.integer !== false
  if (integer && !Number.isInteger(n)) {
    return {
      ok: false,
      message: `${what}Die Menge ${de(n)} muss in ${
        row ? row.unit : 'Stück'
      } ganzzahlig sein.`,
    }
  }
  if (!integer && Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    return {
      ok: false,
      message: `${what}Die Menge darf höchstens zwei Nachkommastellen haben.`,
    }
  }
  return { ok: true, value: integer ? n : round2(n) }
}

function fail(status, error, message, extra) {
  return { ok: false, status, error, message, ...(extra || {}) }
}

/**
 * Ein Speichern prüfen: `{ items: [{ itemId, variant?, productId?, qty, expected? }] }`.
 * `qty: null` löscht eine Zählung. `expected` (optional) ist der Wert, den
 * der Bildschirm zeigte (`null` = nicht gezählt) - der Dienst lehnt dann
 * ab, wenn inzwischen jemand anderes etwas anderes gespeichert hat.
 *
 * @returns {{ok: true, entries: object[]} | {ok: false, status: number, error: string, message: string}}
 */
function validateBatch(body, options) {
  const config = options && options.config
  const catalog = options && options.catalog
  /** Posten mit Sorten, die der Backzettel des Tages auch ohne Sorte führt. */
  const emptyVariantItems = (options && options.emptyVariantItems) || null
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) {
    return fail(
      400,
      'validation',
      'Erwartet wird { items: [...] } mit den gezählten Mengen.'
    )
  }
  if (body.items.length === 0 || body.items.length > MAX_BATCH) {
    return fail(
      400,
      'validation',
      `Es müssen 1 bis ${MAX_BATCH} Zählzeilen auf einmal sein.`
    )
  }
  const items = itemsById(config)
  const seen = new Set()
  const entries = []
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return fail(400, 'validation', 'Jede Zählzeile muss ein Objekt sein.')
    }
    const itemId = typeof raw.itemId === 'string' ? raw.itemId : ''
    const item = items.get(itemId)
    if (!item) {
      return fail(
        400,
        'unknown_item',
        `Unbekannter Backzettel-Posten „${itemId}“.`
      )
    }
    if (!isCountable(item)) {
      return fail(
        400,
        'not_countable',
        `„${item.name}“ ist eine Vorbereitung und liegt nicht in der Theke.`
      )
    }
    const variant =
      raw.variant === undefined || raw.variant === null ? '' : raw.variant
    if (
      typeof variant !== 'string' ||
      (variant !== '' && !item.variants.includes(variant))
    ) {
      return fail(
        400,
        'unknown_variant',
        `„${item.name}“ hat keine Sorte „${String(variant)}“.`
      )
    }
    const productId =
      raw.productId === undefined || raw.productId === null
        ? ''
        : String(raw.productId)
    const row = countRowsForItem(item, catalog, variant).find(
      (r) => r.productId === productId
    )
    if (!row) {
      return fail(
        400,
        'unknown_product',
        productId
          ? `Das Produkt „${productId}“ gehört nicht zu „${item.name}“.`
          : `„${item.name}“ wird je Produkt gezählt - bitte das Produkt angeben.`
      )
    }
    const key = rowKey(itemId, variant, productId)
    if (seen.has(key)) {
      return fail(
        400,
        'duplicate_item',
        `„${row.label}“ steht zweimal in der Liste.`
      )
    }
    seen.add(key)
    const qty = parseQty(raw.qty, row, row.label)
    if (!qty.ok) return fail(400, 'invalid_quantity', qty.message)
    // Wie bei den Vorbestellungen (B7): ein Posten mit Sorten wird je Sorte
    // gezählt. Ohne Sorte nur, wenn der Backzettel des Tages selbst eine
    // Zeile ohne Sorte hat (gefüllte Ware ohne Sorte); Löschen geht immer.
    if (
      variant === '' &&
      item.variants.length > 0 &&
      qty.value !== null &&
      !(emptyVariantItems && emptyVariantItems.has(itemId))
    ) {
      return fail(
        400,
        'variant_required',
        `„${item.name}“ wird je Sorte gezählt - bitte die Sorte angeben.`
      )
    }
    const hasExpected = Object.prototype.hasOwnProperty.call(raw, 'expected')
    let expected = null
    if (hasExpected) {
      const e = parseQty(raw.expected, { ...row, integer: false }, row.label)
      if (!e.ok) {
        return fail(400, 'validation', `expected: ${e.message}`)
      }
      expected = e.value
    }
    entries.push({
      key,
      itemId,
      variant,
      productId,
      qty: qty.value,
      hasExpected,
      expected,
      name: row.label,
      itemName: item.name,
      unit: row.unit,
      factor: row.factor,
      itemUnit: item.unit || 'Stück',
    })
  }
  return { ok: true, entries }
}

/**
 * Posten im Request, die ohne Sorte gezählt werden sollen, obwohl sie Sorten
 * haben - nur dann muss der Dienst den Backzettel des Tages lesen.
 */
function emptyVariantCandidates(body, config) {
  const items = itemsById(config)
  const out = new Set()
  for (const raw of body && Array.isArray(body.items) ? body.items : []) {
    if (!raw || typeof raw !== 'object') continue
    const item = items.get(raw.itemId)
    if (!item || !Array.isArray(item.variants) || item.variants.length === 0)
      continue
    if (raw.variant === undefined || raw.variant === null || raw.variant === '')
      out.add(item.id)
  }
  return out
}

/** Posten, die der Backzettel des Tages ohne Sorte führt. */
function emptyVariantLines(backzettel, config) {
  const out = new Set()
  for (const l of backzettelLines(backzettel, config).values()) {
    if (l.variant === '') out.add(l.itemId)
  }
  return out
}

function sameQty(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined
  if (b === null || b === undefined) return false
  return Math.abs(Number(a) - Number(b)) < 1e-9
}

/**
 * Was ein Speichern ändert: je Eintrag `from` → `to` gegen die gespeicherten
 * Zeilen (`stored`: `{itemId, variant, productId, qty}`), dazu die Konflikte
 * (`expected` ≠ gespeichert, außer der Wunschwert steht schon da).
 */
function planBatch(entries, stored) {
  const byKey = new Map()
  for (const r of Array.isArray(stored) ? stored : []) {
    byKey.set(rowKey(r.itemId, r.variant, r.productId), r)
  }
  const changes = []
  const conflicts = []
  for (const e of entries) {
    const current = byKey.get(e.key) || null
    const from = current ? Number(current.qty) : null
    if (sameQty(from, e.qty)) continue // nichts zu tun, auch kein Konflikt
    if (e.hasExpected && !sameQty(from, e.expected)) {
      conflicts.push({ entry: e, current })
      continue
    }
    changes.push({ entry: e, current, from, to: e.qty })
  }
  return { changes, conflicts }
}

// ---------------------------------------------------------------------------
// Backzettel → gebacken
// ---------------------------------------------------------------------------

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

/** Zusätzlich gebacken durch quittierte Nachträge (nach dem Aufrunden). */
function acknowledgedExtra(delta) {
  if (!delta) return 0
  const all = delta.bake === undefined ? num(delta.qty) : num(delta.bake)
  const open =
    delta.bake === undefined
      ? num(delta.openQty)
      : delta.bakeOpen === undefined
      ? 0
      : num(delta.bakeOpen)
  return round2(all - open)
}

/**
 * Die Zeilen eines Backtages für den Rest: ohne Vorbereitung, je Schlüssel
 * `itemId|variant`. Eingabe ist die Backliste des Tages
 * (`BackzettelService.getBakeLines`, Z10: Zeilen aller Zettel, die für
 * diesen Tag Teig machen) oder - ältere Form - die Tagesansicht
 * `GET /api/backzettel/:date`. Freigegeben: `baked` = Gesamt + quittierte
 * Nachträge; Entwurf: `baked` `null`, nur `planned`.
 *
 * Steht ein Posten × Sorte für denselben Backtag auf zwei Zetteln (nur im
 * Übergang, die Backliste warnt dann), werden die Zeilen addiert, nie die
 * eine durch die andere ersetzt. Die Nachträge eines Schlüssels zählen
 * einmal: `deltaTotals[key]` (über alle Zettel summiert), sonst die
 * Nachträge an den Zeilen.
 *
 * @returns {Map<string, {itemId, variant, name, section, unit, planned, baked, cap, confirmed}>}
 */
function backzettelLines(day, config) {
  const out = new Map()
  if (!day || !Array.isArray(day.sections)) return out
  const confirmed = day.status === 'confirmed'
  const items = itemsById(config)
  const totals =
    day.deltaTotals && typeof day.deltaTotals === 'object'
      ? day.deltaTotals
      : {}
  const lineExtras = new Map()
  for (const section of day.sections) {
    if (!section || NOT_SOLD_SECTIONS.has(section.id)) continue
    for (const line of Array.isArray(section.lines) ? section.lines : []) {
      if (!line || !line.itemId) continue
      // Z10: ein Teigtag-Zettel trägt auch Zeilen anderer Backtage - die
      // zählen an ihrem eigenen Backtag, nicht hier.
      if (day.date && line.bakeDate && line.bakeDate !== day.date) continue
      const variant = line.variant || ''
      const key = lineKey(line.itemId, variant)
      const total = num(line.total)
      const extra = confirmed ? acknowledgedExtra(line.delta || null) : 0
      lineExtras.set(key, round2((lineExtras.get(key) || 0) + extra))
      const known = out.get(key)
      if (known) {
        known.planned = round2(known.planned + total)
        known.cap = round2(known.cap + num(line.cap))
        continue
      }
      out.set(key, {
        itemId: line.itemId,
        variant,
        name: line.name || line.itemId,
        section: line.section || section.id,
        unit: line.unit || 'Stück',
        planned: total,
        baked: null,
        cap: num(line.cap),
        confirmed,
      })
    }
  }
  if (confirmed) {
    for (const [key, l] of out) {
      const extra = totals[key]
        ? acknowledgedExtra(totals[key])
        : lineExtras.get(key) || 0
      l.baked = Math.max(0, round2(l.planned + extra))
    }
  }
  if (confirmed) {
    // Nachträge zu Posten ohne freigegebene Zeile (W4-verify r6).
    for (const [key, delta] of Object.entries(totals)) {
      if (out.has(key)) continue
      // `itemId|variant@bakeDate`: Nachtrag für einen anderen Backtag
      if (key.includes('@')) continue
      const [itemId, variant = ''] = key.split('|')
      const item = items.get(itemId)
      if (item && !isCountable(item)) continue
      const extra = acknowledgedExtra(delta)
      out.set(key, {
        itemId,
        variant,
        name: item ? item.name : itemId,
        section: item ? item.section : null,
        unit: item ? item.unit || 'Stück' : 'Stück',
        planned: 0,
        baked: Math.max(0, extra),
        cap: 0,
        confirmed: true,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Tagesansicht (Erfassung)
// ---------------------------------------------------------------------------

/** Rest einer Zeile in der Einheit des Postens; `null` ohne jede Zählung. */
function lineRest(rows) {
  let any = false
  let sum = 0
  for (const r of rows) {
    if (r.qty === null || r.qty === undefined) continue
    any = true
    sum += Number(r.qty) * Number(r.factor)
  }
  return any ? round2(sum) : null
}

/**
 * Ist eine Tageszeile (Posten × Sorte) vollständig gezählt? Jede Zählzeile
 * der Config hat einen Wert, und keine gespeicherte Zählung ist leer. Eine
 * Zeile ohne jede Zählung ist nie vollständig - nie als 0 lesen.
 */
function lineComplete(stored, expected) {
  return (
    stored.length > 0 &&
    expected.every((r) =>
      stored.some(
        (s) =>
          (s.productId || '') === r.productId &&
          s.qty !== null &&
          s.qty !== undefined
      )
    ) &&
    stored.every((s) => s.qty !== null && s.qty !== undefined)
  )
}

/**
 * Die Zählzeilen einer gespeicherten Tageszeile, **wie sie beim Zählen
 * galten** (`lineRows`, Spalte `line_rows`): sonst machte ein später in der
 * YAML ergänztes Produkt jeden früher vollständig gezählten Tag des Postens
 * zu „teilweise gezählt“ und nähme ihn aus Auswertung und Rest Ø. Ohne
 * Schnappschuss (Zählungen von vor der Spalte) gilt die aktuelle Config.
 *
 * @returns {Array<{productId: string}>}
 */
function expectedRowsForLine(item, catalog, stored, variant) {
  const snap = (stored || []).find((s) => s && Array.isArray(s.lineRows))
  if (snap) return snap.lineRows.map((id) => ({ productId: String(id || '') }))
  return item ? countRowsForItem(item, catalog, variant) : []
}

/**
 * Die Zeilenschlüssel eines Tages, über die gerechnet wird: alles, was
 * gezählt wurde, und alles, was laut freigegebenem Backzettel gebacken
 * wurde (`baked > 0`). Dieselbe Regel für Auswertung und Rest Ø.
 */
function evaluatedLineKeys(byLine, bz) {
  const keys = new Set(byLine.keys())
  for (const [key, l] of bz) if ((l.baked || 0) > 0) keys.add(key)
  return keys
}

function rowsByLine(rows) {
  const byLine = new Map()
  for (const r of rows) {
    const key = lineKey(r.itemId, r.variant)
    if (!byLine.has(key)) byLine.set(key, [])
    byLine.get(key).push(r)
  }
  return byLine
}

/** Mehr übrig, als für den Laden gebacken wurde (Gebacken − CAP)? */
function restExceedsShop(rest, baked, cap) {
  if (rest === null || rest === undefined) return false
  if (baked === null || baked === undefined) return false
  return rest > round2(baked - (cap || 0)) + 1e-9
}

function sectionOrder(config) {
  const order = new Map()
  const list =
    config && Array.isArray(config.sections) && config.sections.length > 0
      ? config.sections
      : Object.keys(SECTION_LABELS)
  list.forEach((s, i) => order.set(s, i))
  return (s) => (order.has(s) ? order.get(s) : 999)
}

/**
 * Bausteine einer Tageszeile: Zählzeilen aus der Config, gespeicherte
 * Zählungen darüber (auch zu Produkten, die die Config nicht mehr kennt).
 */
function mergeRows(item, catalog, stored, variant) {
  // Mit Schnappschuss nur die Zählzeilen, die beim Zählen galten - ein
  // inzwischen ergänztes Produkt gehört nicht zu diesem Tag.
  const snap = (stored || []).find((s) => s && Array.isArray(s.lineRows))
  const wanted = snap
    ? new Set(snap.lineRows.map((id) => String(id || '')))
    : null
  const rows = countRowsForItem(item, catalog, variant)
    .filter((r) => !wanted || wanted.has(r.productId))
    .map((r) => ({
      ...r,
      qty: null,
      countedAt: null,
      countedBy: null,
      revision: 0,
      stale: false,
    }))
  if (wanted) {
    // Damals gezählt werden sollte, heute nicht mehr in der Config: als
    // offene Zeile stehen lassen, sonst wirkte die Zeile vollständig.
    for (const productId of wanted) {
      if (rows.some((r) => r.productId === productId)) continue
      if (stored.some((s) => (s.productId || '') === productId)) continue
      rows.push({
        productId,
        label: productId || (item ? item.name : ''),
        unit: 'Stück',
        factor: 1,
        integer: true,
        step: 1,
        qty: null,
        countedAt: null,
        countedBy: null,
        revision: 0,
        stale: true,
      })
    }
  }
  for (const s of stored) {
    const productId = s.productId || ''
    let row = rows.find((r) => r.productId === productId)
    if (!row) {
      row = {
        productId,
        label: s.name || productId || s.itemId,
        unit: s.unit || 'Stück',
        factor: num(s.factor) || 1,
        integer: INTEGER_UNITS.has(s.unit || 'Stück'),
        step: 1,
        stale: true,
      }
      rows.push(row)
    }
    row.qty = s.qty === null || s.qty === undefined ? null : Number(s.qty)
    // Umgerechnet wird mit dem Faktor, der beim Zählen galt.
    row.factor = num(s.factor) || row.factor
    row.countedAt = s.countedAt || s.updatedAt || null
    row.countedBy = s.countedBy || null
    row.revision = s.revision || 1
  }
  return rows
}

/**
 * Die Antwort von `GET /api/rest?date=`.
 *
 * @param {object} a
 * @param {string} a.date
 * @param {string} a.today Berlin
 * @param {object|null} a.config normalisiert, `null` ohne gültige Stammdaten
 * @param {Array} [a.catalog]
 * @param {object|null} a.backzettel Tagesansicht des Backzettels (oder `null`)
 * @param {Array} a.rows gespeicherte Zählungen des Tages
 *   `{itemId, variant, productId, qty, unit, factor, name, itemName, itemUnit, countedAt, countedBy, revision}`
 */
function buildDayView(a) {
  const date = a.date
  const weekday = isoWeekday(date)
  const config = a.config || null
  const items = itemsById(config)
  const window = { from: addDays(a.today, -COUNT_DAYS_BACK), to: a.today }
  const inWindow = date >= window.from && date <= window.to
  const productionDay = config ? config.days.includes(weekday) : null
  const storedRows = Array.isArray(a.rows) ? a.rows : []
  const bz = backzettelLines(a.backzettel, config)

  const byLine = new Map()
  for (const r of storedRows) {
    const key = lineKey(r.itemId, r.variant)
    if (!byLine.has(key)) byLine.set(key, [])
    byLine.get(key).push(r)
  }
  const keys = []
  for (const [key, l] of bz) {
    if ((l.baked !== null ? l.baked : l.planned) > 0 || byLine.has(key)) {
      keys.push(key)
    }
  }
  for (const key of byLine.keys()) if (!bz.has(key)) keys.push(key)

  const order = sectionOrder(config)
  const configIndex = new Map(
    (config ? config.items : []).map((item, i) => [item.id, i])
  )
  const lines = keys.map((key) => {
    const stored = byLine.get(key) || []
    const b = bz.get(key) || null
    const [itemId, variant = ''] = key.split('|')
    const item = items.get(itemId) || null
    const first = stored[0] || {}
    const rows = mergeRows(item, a.catalog, stored, variant)
    const counted = rows.every((r) => r.qty !== null)
    const section = item ? item.section : b ? b.section : null
    return {
      key,
      itemId,
      variant: variant || null,
      variantLabel: variantLabel(config, variant, item),
      name: item ? item.name : b ? b.name : first.itemName || itemId,
      section,
      sectionLabel: (section && SECTION_LABELS[section]) || section || null,
      unit: item ? item.unit || 'Stück' : b ? b.unit : first.itemUnit || '',
      planned: b ? b.planned : null,
      baked: b ? b.baked : null,
      cap: b ? b.cap : 0,
      onBackzettel: !!b,
      rows,
      counted,
      rest: counted ? lineRest(rows) : null,
      restSoFar: lineRest(rows),
      // Mehr Rest als für den Laden gebacken: fast immer verzählt.
      restExceedsShop: restExceedsShop(
        lineRest(rows),
        b ? b.baked : null,
        b ? b.cap : 0
      ),
    }
  })
  lines.sort(
    (x, y) =>
      order(x.section) - order(y.section) ||
      (configIndex.has(x.itemId) ? configIndex.get(x.itemId) : 1e6) -
        (configIndex.has(y.itemId) ? configIndex.get(y.itemId) : 1e6) ||
      String(x.variant || '').localeCompare(String(y.variant || ''))
  )

  let last = null
  for (const r of storedRows) {
    const at = r.countedAt || r.updatedAt || null
    if (at && (!last || String(at) > String(last.at))) {
      last = { at, by: r.countedBy || null }
    }
  }
  const rowCount = lines.reduce((s, l) => s + l.rows.length, 0)
  const countedRows = lines.reduce(
    (s, l) => s + l.rows.filter((r) => r.qty !== null).length,
    0
  )
  const status = !config ? 'no-config' : productionDay ? 'ok' : 'ruhetag'
  return {
    date,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday] || null,
    today: a.today,
    status,
    ...(a.reasons ? { reasons: a.reasons } : {}),
    backzettelStatus: a.backzettel
      ? a.backzettel.status === 'confirmed'
        ? 'confirmed'
        : a.backzettel.status === 'draft'
        ? 'draft'
        : null
      : null,
    window,
    editable: status === 'ok' && inWindow,
    editIssue:
      status === 'no-config'
        ? 'Die Backzettel-Stammdaten fehlen oder sind ungültig - ohne sie gibt es keine Zählliste.'
        : status === 'ruhetag'
        ? `${WEEKDAY_NAMES[weekday]} ist Ruhetag.`
        : date > window.to
        ? 'Dieser Tag liegt in der Zukunft - gezählt wird bei Ladenschluss.'
        : date < window.from
        ? `Zählungen lassen sich nur bis ${COUNT_DAYS_BACK} Tage zurück erfassen oder korrigieren.`
        : null,
    lines,
    summary: {
      lines: lines.length,
      countedLines: lines.filter((l) => l.counted).length,
      rows: rowCount,
      countedRows,
      lastCountedAt: last ? last.at : null,
      lastCountedBy: last ? last.by : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

/**
 * `?from=&to=` lesen. Standard: die letzten 28 Tage bis heute.
 * @returns {{ok: true, from: string, to: string} | {ok: false, status, error, message}}
 */
function parseRange(query, today) {
  const q = query || {}
  const rawFrom = q.from
  const rawTo = q.to
  if (Array.isArray(rawFrom) || Array.isArray(rawTo)) {
    return fail(400, 'invalid_range', 'from und to bitte nur einmal angeben.')
  }
  const to = rawTo === undefined || rawTo === '' ? today : String(rawTo).trim()
  const from =
    rawFrom === undefined || rawFrom === ''
      ? addDays(to, -(DEFAULT_RANGE_DAYS - 1))
      : String(rawFrom).trim()
  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    return fail(
      400,
      'invalid_date',
      'Ungültiges Datum; erwartet wird JJJJ-MM-TT.'
    )
  }
  if (from > to) {
    return fail(
      400,
      'invalid_range',
      'Der Anfang des Zeitraums liegt nach dem Ende.'
    )
  }
  if (listDates(from, to).length > MAX_RANGE_DAYS) {
    return fail(
      400,
      'range_too_large',
      `Ein Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage lang sein.`
    )
  }
  return { ok: true, from, to }
}

function rate(rest, shopBaked) {
  return shopBaked > 0 ? round4(rest / shopBaked) : null
}

/**
 * Die Auswertung eines Zeitraums.
 *
 * @param {object} a
 * @param {string} a.from
 * @param {string} a.to
 * @param {string} a.today
 * @param {object|null} a.config normalisiert (für Zählzeilen, Ruhetage und Kassennummern)
 * @param {Array} [a.catalog]
 * @param {Object<string, {backzettel: object|null, rows: Array, report: object|null}>} a.days
 *   je Datum: Backzettel-Tagesansicht, gespeicherte Zählungen, aggregierter
 *   Kassenbericht (`reports.core` `aggregateDay`) oder `null`.
 * @param {boolean} [a.reportsAvailable]
 */
function summarize(a) {
  const config = a.config || null
  const items = itemsById(config)
  const resolve = config ? refCore.soldResolver(config, a.catalog) : null
  const soldInfo = new Map()
  const infoFor = (item) => {
    if (!soldInfo.has(item.id)) {
      soldInfo.set(item.id, refCore.itemSoldInfo(item, resolve))
    }
    return soldInfo.get(item.id)
  }
  const acc = new Map()
  const accFor = (itemId, meta) => {
    if (!acc.has(itemId)) {
      acc.set(itemId, {
        itemId,
        name: meta.name,
        section: meta.section,
        unit: meta.unit,
        days: 0,
        baked: 0,
        cap: 0,
        rest: 0,
        sold: 0,
        soldDays: 0,
        uncountedDates: [],
        restExceedsDates: [],
        variants: new Map(),
        weeks: new Map(),
      })
    }
    return acc.get(itemId)
  }

  const days = []
  const counts = {
    days: 0,
    counted: 0,
    partial: 0,
    notCounted: 0,
    noBackzettel: 0,
    ruhetag: 0,
    future: 0,
  }

  for (const date of listDates(a.from, a.to)) {
    counts.days += 1
    const weekday = isoWeekday(date)
    const input = (a.days && a.days[date]) || {}
    const rows = Array.isArray(input.rows) ? input.rows : []
    const day = {
      date,
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday] || null,
      status: 'not_counted',
      byUnit: {},
      // Posten mit mehr Rest als für den Laden gebacken (Zählung prüfen).
      restExceedsItems: [],
    }
    days.push(day)
    if (date > a.today) {
      day.status = 'future'
      counts.future += 1
      continue
    }
    if (config && !config.days.includes(weekday) && rows.length === 0) {
      day.status = 'ruhetag'
      counts.ruhetag += 1
      continue
    }
    const bz = backzettelLines(input.backzettel, config)
    const confirmed =
      !!input.backzettel && input.backzettel.status === 'confirmed'

    // Zählungen je Zeile
    const byLine = rowsByLine(rows)
    const lineKeys = evaluatedLineKeys(byLine, bz)

    // je Posten: alle Zeilen vollständig gezählt?
    const perItem = new Map()
    for (const key of lineKeys) {
      const [itemId, variant = ''] = key.split('|')
      const item = items.get(itemId) || null
      if (item && !isCountable(item)) continue
      const stored = byLine.get(key) || []
      const expected = expectedRowsForLine(item, a.catalog, stored, variant)
      const complete = lineComplete(stored, expected)
      const b = bz.get(key) || null
      const first = stored[0] || {}
      if (!perItem.has(itemId)) {
        perItem.set(itemId, {
          meta: {
            name: item ? item.name : b ? b.name : first.itemName || itemId,
            section: item ? item.section : b ? b.section : null,
            unit: item
              ? item.unit || 'Stück'
              : b
              ? b.unit
              : first.itemUnit || 'Stück',
          },
          item,
          lines: [],
        })
      }
      perItem.get(itemId).lines.push({
        variant,
        complete,
        anyCount: stored.length > 0,
        rest: lineRest(stored.map((s) => ({ ...s, factor: num(s.factor) }))),
        baked: b && b.baked !== null ? b.baked : confirmed ? 0 : null,
        cap: b ? b.cap : 0,
      })
    }

    let evaluatedItems = 0
    let uncountedItems = 0
    for (const [itemId, p] of perItem) {
      const complete = p.lines.every((l) => l.complete)
      if (!confirmed) continue
      if (!complete) {
        uncountedItems += 1
        accFor(itemId, p.meta).uncountedDates.push(date)
        continue
      }
      evaluatedItems += 1
      const t = accFor(itemId, p.meta)
      const baked = round2(p.lines.reduce((s, l) => s + (l.baked || 0), 0))
      const cap = round2(p.lines.reduce((s, l) => s + (l.cap || 0), 0))
      const rest = round2(p.lines.reduce((s, l) => s + (l.rest || 0), 0))
      t.days += 1
      if (restExceedsShop(rest, baked, cap)) {
        t.restExceedsDates.push(date)
        day.restExceedsItems.push(p.meta.name)
      }
      t.baked = round2(t.baked + baked)
      t.cap = round2(t.cap + cap)
      t.rest = round2(t.rest + rest)
      for (const l of p.lines) {
        const v = t.variants.get(l.variant) || { baked: 0, cap: 0, rest: 0 }
        v.baked = round2(v.baked + (l.baked || 0))
        v.cap = round2(v.cap + (l.cap || 0))
        v.rest = round2(v.rest + (l.rest || 0))
        t.variants.set(l.variant, v)
      }
      const week = isoWeek(date)
      const w = t.weeks.get(week) || { shopBaked: 0, rest: 0, days: 0 }
      w.shopBaked = round2(w.shopBaked + baked - cap)
      w.rest = round2(w.rest + rest)
      w.days += 1
      t.weeks.set(week, w)
      if (p.item && input.report && input.report.status === 'ok') {
        const info = infoFor(p.item)
        if (info.plu.length > 0) {
          const map = refCore.soldByPlu(input.report)
          t.sold = round2(t.sold + refCore.soldOnDay(info, map))
          t.soldDays += 1
        }
      }
      const u = p.meta.unit
      const bu = day.byUnit[u] || { shopBaked: 0, rest: 0, rate: null }
      bu.shopBaked = round2(bu.shopBaked + baked - cap)
      bu.rest = round2(bu.rest + rest)
      bu.rate = rate(bu.rest, bu.shopBaked)
      day.byUnit[u] = bu
    }

    if (!confirmed) {
      day.status =
        rows.length > 0 ? 'counted_without_backzettel' : 'no_backzettel'
      counts.noBackzettel += 1
    } else if (perItem.size === 0) {
      day.status = 'nothing_baked'
    } else if (uncountedItems === 0) {
      day.status = 'counted'
      counts.counted += 1
    } else if (evaluatedItems > 0 || rows.length > 0) {
      day.status = 'partial'
      counts.partial += 1
    } else {
      day.status = 'not_counted'
      counts.notCounted += 1
    }
  }

  const order = sectionOrder(config)
  const configIndex = new Map(
    (config ? config.items : []).map((item, i) => [item.id, i])
  )
  const out = [...acc.values()]
    .map((t) => {
      const item = items.get(t.itemId) || null
      const info = item ? infoFor(item) : null
      const shopBaked = round2(t.baked - t.cap)
      const soldStatus = !item
        ? 'no_config'
        : info.plu.length === 0
        ? 'no_plu'
        : t.soldDays === 0
        ? 'no_report'
        : t.soldDays < t.days
        ? 'partial'
        : 'ok'
      return {
        itemId: t.itemId,
        name: t.name,
        section: t.section,
        sectionLabel:
          (t.section && SECTION_LABELS[t.section]) || t.section || null,
        unit: t.unit,
        days: t.days,
        baked: t.baked,
        cap: t.cap,
        shopBaked,
        rest: t.rest,
        rate: t.days > 0 ? rate(t.rest, shopBaked) : null,
        sold: t.soldDays > 0 ? t.sold : null,
        soldDays: t.soldDays,
        soldConverted: info ? info.converted : false,
        soldStatus,
        uncountedDays: t.uncountedDates.length,
        uncountedDates: t.uncountedDates,
        // Tage, an denen mehr übrig war als für den Laden gebacken.
        restExceedsDates: t.restExceedsDates,
        variants: [...t.variants.entries()]
          .filter(([v]) => v !== '' || t.variants.size > 1)
          .map(([v, x]) => ({
            variant: v || null,
            label: v ? variantLabel(config, v, item) : 'ohne Sorte',
            baked: x.baked,
            cap: x.cap,
            rest: x.rest,
            rate: rate(x.rest, round2(x.baked - x.cap)),
          })),
        weeks: [...t.weeks.entries()]
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([week, w]) => ({
            week,
            days: w.days,
            shopBaked: w.shopBaked,
            rest: w.rest,
            rate: rate(w.rest, w.shopBaked),
          })),
      }
    })
    .sort(
      (x, y) =>
        order(x.section) - order(y.section) ||
        (configIndex.has(x.itemId) ? configIndex.get(x.itemId) : 1e6) -
          (configIndex.has(y.itemId) ? configIndex.get(y.itemId) : 1e6) ||
        x.name.localeCompare(y.name)
    )

  const totals = new Map()
  for (const i of out) {
    if (i.days === 0) continue
    const t = totals.get(i.unit) || {
      unit: i.unit,
      items: 0,
      baked: 0,
      cap: 0,
      shopBaked: 0,
      rest: 0,
      // Posten dieser Einheit mit mindestens einem „Zählung prüfen“-Tag.
      restExceedsItems: 0,
    }
    t.items += 1
    if (i.restExceedsDates.length > 0) t.restExceedsItems += 1
    t.baked = round2(t.baked + i.baked)
    t.cap = round2(t.cap + i.cap)
    t.shopBaked = round2(t.shopBaked + i.shopBaked)
    t.rest = round2(t.rest + i.rest)
    totals.set(i.unit, t)
  }

  return {
    from: a.from,
    to: a.to,
    today: a.today,
    configStatus: config ? 'ok' : 'no-config',
    reportsAvailable: a.reportsAvailable !== false,
    rateBasis: RATE_BASIS,
    counts,
    totals: [...totals.values()]
      .map((t) => ({ ...t, rate: rate(t.rest, t.shopBaked) }))
      .sort((x, y) => (x.unit === 'Stück' ? -1 : y.unit === 'Stück' ? 1 : 0)),
    items: out,
    days,
  }
}

const DAY_STATUS_LABELS = {
  counted: 'gezählt',
  partial: 'teilweise gezählt',
  not_counted: 'nicht gezählt',
  no_backzettel: 'kein freigegebener Backzettel',
  counted_without_backzettel: 'gezählt, Backzettel nicht freigegeben',
  nothing_baked: 'nichts gebacken',
  ruhetag: 'Ruhetag',
  future: 'noch nicht',
}

function pct(r) {
  return r === null || r === undefined ? '' : `${deNumber(r * 100, 1)}%`
}

function qtyCell(n) {
  if (n === null || n === undefined) return ''
  return Number.isInteger(n) ? String(n) : deNumber(n)
}

/** Die Auswertung als CSV (Semikolon, `csvCell` gegen Formel-Zellen). */
function summaryCsv(s) {
  const lines = []
  const push = (cells) => lines.push(cells.map(csvCell).join(';'))
  push(['Rest am Abend - Auswertung'])
  push(['Zeitraum', `${s.from} bis ${s.to}`])
  push(['Hinweis', s.rateBasis])
  if (s.counts.notCounted + s.counts.partial > 0) {
    push([
      'Hinweis',
      `${s.counts.notCounted} Tag(e) ohne und ${s.counts.partial} Tag(e) mit unvollständiger Zählung - nicht mitgerechnet`,
    ])
  }
  push([])
  push(['Je Posten'])
  push([
    'Bereich',
    'Posten',
    'Einheit',
    'Tage gezählt',
    'Gebacken',
    'davon CAP',
    'Für den Laden',
    'Verkauft (Kasse)',
    'Rest',
    'Restquote',
    'Tage ohne Zählung',
    'Zählung prüfen',
  ])
  for (const i of s.items) {
    push([
      i.sectionLabel || '',
      i.name,
      i.unit,
      i.days,
      qtyCell(i.baked),
      qtyCell(i.cap),
      qtyCell(i.shopBaked),
      i.sold === null
        ? ''
        : `${qtyCell(i.sold)}${i.soldConverted ? '' : ' St. (Kasse)'}`,
      qtyCell(i.rest),
      pct(i.rate),
      i.uncountedDays,
      // Mehr Rest als für den Laden gebacken - mitgerechnet, aber markiert.
      (i.restExceedsDates || []).join(', '),
    ])
    for (const v of i.variants) {
      push([
        '',
        `  ${i.name} - ${v.label}`,
        i.unit,
        '',
        qtyCell(v.baked),
        qtyCell(v.cap),
        qtyCell(round2(v.baked - v.cap)),
        '',
        qtyCell(v.rest),
        pct(v.rate),
        '',
        '',
      ])
    }
  }
  push([])
  push(['Je Tag'])
  const units = s.totals.map((t) => t.unit)
  push([
    'Datum',
    'Wochentag',
    'Status',
    ...units.flatMap((u) => [
      `Für den Laden (${u})`,
      `Rest (${u})`,
      `Restquote (${u})`,
    ]),
    'Zählung prüfen',
  ])
  for (const d of s.days) {
    push([
      d.date,
      d.weekdayName || '',
      DAY_STATUS_LABELS[d.status] || d.status,
      ...units.flatMap((u) => {
        const x = d.byUnit[u]
        return x
          ? [qtyCell(x.shopBaked), qtyCell(x.rest), pct(x.rate)]
          : ['', '', '']
      }),
      (d.restExceedsItems || []).join(', '),
    ])
  }
  push([])
  push(['Gesamt'])
  push(['Einheit', 'Für den Laden', 'Rest', 'Restquote'])
  for (const t of s.totals) {
    push([t.unit, qtyCell(t.shopBaked), qtyCell(t.rest), pct(t.rate)])
  }
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Rest Ø neben der Referenz (Grundmengen, Z4) - nur Information
// ---------------------------------------------------------------------------

/**
 * Mittlerer Rest je Posten und Wochentag über die letzten `weeks` gleichen
 * Wochentage **mit freigegebenem Backzettel und vollständiger Zählung** des
 * Postens (vor heute). Vollständig heißt wie in der Auswertung
 * (`summarize`): jede Zeile, die gezählt wurde oder laut Backzettel gebacken
 * wurde, ist ganz gezählt - eine gebackene, aber nicht gezählte Sorte macht
 * den Tag unbrauchbar, statt den Mittelwert zu drücken. Tage ohne Zählung
 * oder ohne Freigabe werden übersprungen, nie als 0 gezählt.
 *
 * @param {object} a `{ config, catalog, today, weeks, weekdays, rowsByDate, backzettelByDate }`
 *   `backzettelByDate`: je Datum die (freigegebene) Backzettel-Tagesansicht;
 *   fehlt ein Datum, ist der Tag nicht freigegeben.
 * @returns {Array<{weekday, weekdayName, items: [{itemId, mean, samples, dates}]}>}
 */
function weekdayRestAverages(a) {
  const config = a.config
  const bzCache = new Map()
  const linesOn = (date) => {
    if (!bzCache.has(date)) {
      const day = a.backzettelByDate ? a.backzettelByDate[date] : null
      bzCache.set(
        date,
        day && day.status === 'confirmed' ? backzettelLines(day, config) : null
      )
    }
    return bzCache.get(date)
  }
  const out = []
  for (const weekday of a.weekdays) {
    const { dates } = refCore.referenceDates({
      weekday,
      today: a.today,
      weeks: refCore.LOOKBACK_WEEKS,
      hasReport: () => true,
    })
    const items = []
    for (const item of config.items) {
      if (!isCountable(item)) continue
      const samples = []
      const excluded = []
      const used = []
      for (const date of dates) {
        if (samples.length >= a.weeks) break
        const bz = linesOn(date)
        if (!bz) continue
        const rows = ((a.rowsByDate && a.rowsByDate[date]) || []).filter(
          (r) => r.itemId === item.id
        )
        if (rows.length === 0) continue
        const byLine = rowsByLine(rows)
        const itemBz = new Map([...bz].filter(([, l]) => l.itemId === item.id))
        const keys = evaluatedLineKeys(byLine, itemBz)
        const complete = [...keys].every((key) => {
          const stored = byLine.get(key) || []
          return lineComplete(
            stored,
            expectedRowsForLine(item, a.catalog, stored, key.split('|')[1])
          )
        })
        if (!complete) continue
        const rest =
          lineRest(rows.map((r) => ({ ...r, factor: num(r.factor) }))) || 0
        // Mehr übrig als für den Laden gebacken ist fast immer verzählt
        // (Tagesansicht: „bitte nachzählen“) - nicht in den Mittelwert.
        let baked = 0
        let cap = 0
        for (const l of itemBz.values()) {
          baked += l.baked || 0
          cap += l.cap || 0
        }
        if (restExceedsShop(rest, round2(baked), round2(cap))) {
          excluded.push(date)
          continue
        }
        samples.push(rest)
        used.push(date)
      }
      if (samples.length === 0) continue
      items.push({
        itemId: item.id,
        mean: round2(samples.reduce((s, x) => s + x, 0) / samples.length),
        samples,
        dates: used,
        // Tage mit „Zählung prüfen“, die nicht mitgerechnet sind.
        excludedDates: excluded,
      })
    }
    out.push({ weekday, weekdayName: WEEKDAY_NAMES[weekday] || null, items })
  }
  return out
}

module.exports = {
  MAX_QTY,
  MAX_BATCH,
  COUNT_DAYS_BACK,
  MAX_RANGE_DAYS,
  DEFAULT_RANGE_DAYS,
  NOT_SOLD_SECTIONS,
  RATE_BASIS,
  DAY_STATUS_LABELS,
  lineKey,
  rowKey,
  isoWeek,
  listDates,
  isCalendarDate,
  isoWeekday,
  addDays,
  berlinToday,
  countRowsForItem,
  productsForVariant,
  parseQty,
  validateBatch,
  emptyVariantCandidates,
  emptyVariantLines,
  lineComplete,
  expectedRowsForLine,
  restExceedsShop,
  planBatch,
  acknowledgedExtra,
  backzettelLines,
  lineRest,
  buildDayView,
  parseRange,
  summarize,
  summaryCsv,
  weekdayRestAverages,
}
