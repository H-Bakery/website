// Grundmengen bearbeiten (Z4): Regeln für `PUT /api/backzettel/config/base`.
//
// Dependency-freies CommonJS. Hier steht, was eine Änderung bedeutet - die
// Prüfung der Anfrage, der neue Wert eines Wochentags und die
// Commit-Nachricht. Wie daraus Text in `backzettel.yaml` wird (ohne
// Kommentare und Reihenfolge anzufassen), macht
// `backzettel-config.editor.js`; ob das Ergebnis gültige Stammdaten sind,
// `backzettel-config.core.js`.
//
// Bedeutung der Werte (wie im Z2-Core):
//   - Zahl       = Grundmenge, 0 = „wird an dem Tag nicht gebacken"
//   - null       = „noch nicht festgelegt" (die Zeile erscheint mit Hinweis)
//   - fehlt      = 0 (deshalb wird hier nie ein Schlüssel gelöscht)
//   - Varianten  = { nuss: 4, mohn: null } je Wochentag; fehlt eine Variante,
//                  ist sie 0.

'use strict'

const { coAuthorTrailer } = require('./hq-products.core')

const WEEKDAY_NAMES = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

/** Obergrenze je Feld - schützt vor Tippfehlern wie 40000 statt 40. */
const MAX_QTY = 10000

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(status, error, message) {
  return { ok: false, status, error, message }
}

/**
 * Eine Menge aus der Anfrage: Zahl, `null` (offen) oder ein Text wie „1,5".
 * Leerer Text ist `null`. Liefert `{ ok, value }` oder einen Fehler.
 */
function parseQuantity(raw, label) {
  if (raw === null) return { ok: true, value: null }
  let value = raw
  if (typeof raw === 'string') {
    const text = raw.trim().replace(',', '.')
    if (text === '') return { ok: true, value: null }
    if (!/^\d+(\.\d+)?$/.test(text)) {
      return fail(
        400,
        'invalid_quantity',
        `${label}: „${raw}“ ist keine Menge. Bitte eine Zahl ≥ 0 eingeben oder das Feld leeren (= noch nicht festgelegt).`
      )
    }
    value = Number(text)
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(
      400,
      'invalid_quantity',
      `${label}: Bitte eine Zahl ≥ 0 eingeben oder das Feld leeren (= noch nicht festgelegt).`
    )
  }
  if (value < 0) {
    return fail(
      400,
      'invalid_quantity',
      `${label}: Eine Grundmenge kann nicht negativ sein.`
    )
  }
  if (value > MAX_QTY) {
    return fail(
      400,
      'invalid_quantity',
      `${label}: ${value} ist unplausibel groß (höchstens ${MAX_QTY}).`
    )
  }
  // Zwei Nachkommastellen reichen (z. B. 1,25 l); mehr ist Rauschen.
  return { ok: true, value: Math.round(value * 100) / 100 }
}

/**
 * Prüft den Body von `PUT /config/base` gegen die (normalisierte) Config.
 *
 * Body: `{ itemId, weekday, value }` (ganzer Tag: Zahl oder null) oder
 * `{ itemId, weekday, variants: { nuss: 4, mohn: null } }`.
 *
 * @returns {{ok: true, edit: {itemId, weekday, item, value?, variants?}} | {ok: false, status, error, message}}
 */
function parseBaseEdit(body, config) {
  if (!isPlainObject(body)) {
    return fail(400, 'validation', 'Die Anfrage braucht itemId und weekday.')
  }
  const items = config && Array.isArray(config.items) ? config.items : []
  const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : ''
  if (!itemId) return fail(400, 'validation', 'itemId fehlt.')
  const item = items.find((i) => i.id === itemId)
  if (!item) {
    return fail(
      404,
      'unknown_item',
      `Den Posten „${itemId}“ gibt es in den Backzettel-Stammdaten nicht.`
    )
  }
  const wd = Number(body.weekday)
  if (
    !Number.isInteger(wd) ||
    wd < 1 ||
    wd > 7 ||
    String(body.weekday).trim() !== String(wd)
  ) {
    return fail(
      400,
      'invalid_weekday',
      'weekday muss ein Wochentag 1…7 sein (1 = Montag).'
    )
  }
  const days = Array.isArray(config.days) ? config.days : []
  if (!days.includes(wd)) {
    return fail(
      400,
      'invalid_weekday',
      `${WEEKDAY_NAMES[wd]} ist kein Produktionstag - dafür gibt es keine Grundmenge.`
    )
  }
  const hasValue = Object.prototype.hasOwnProperty.call(body, 'value')
  const hasVariants = Object.prototype.hasOwnProperty.call(body, 'variants')
  if (hasValue === hasVariants) {
    return fail(
      400,
      'validation',
      'Bitte entweder value (ganzer Tag) oder variants (je Sorte) angeben.'
    )
  }
  const label = `${item.name || item.id}, ${WEEKDAY_NAMES[wd]}`
  if (hasValue) {
    const q = parseQuantity(body.value, label)
    if (!q.ok) return q
    return { ok: true, edit: { itemId, weekday: wd, item, value: q.value } }
  }
  if (
    !isPlainObject(body.variants) ||
    Object.keys(body.variants).length === 0
  ) {
    return fail(
      400,
      'validation',
      'variants muss mindestens eine Sorte mit Menge enthalten.'
    )
  }
  const allowed = Array.isArray(item.variants) ? item.variants : []
  if (allowed.length === 0) {
    return fail(
      400,
      'validation',
      `„${
        item.name || item.id
      }“ hat keine Sorten; bitte value statt variants senden.`
    )
  }
  const variants = {}
  for (const [variant, raw] of Object.entries(body.variants)) {
    if (!allowed.includes(variant)) {
      return fail(
        404,
        'unknown_variant',
        `„${item.name || item.id}“ hat keine Sorte „${variant}“.`
      )
    }
    const q = parseQuantity(raw, `${label}, ${variant}`)
    if (!q.ok) return q
    variants[variant] = q.value
  }
  return { ok: true, edit: { itemId, weekday: wd, item, variants } }
}

/**
 * Der neue Wert eines Wochentags (`base[weekday]`) aus dem bisherigen und der
 * Änderung. Eine Sorten-Änderung an einem bisher ganz offenen Tag (`null`)
 * lässt die übrigen Sorten offen; an einem Tag ohne Eintrag (= 0) bleiben
 * sie 0 (fehlen). Stand dort eine Gesamtzahl ohne Sorte, wird sie durch die
 * Sortenangabe ersetzt.
 */
function nextDayValue(current, edit) {
  if (Object.prototype.hasOwnProperty.call(edit, 'value')) return edit.value
  const order = Array.isArray(edit.item && edit.item.variants)
    ? edit.item.variants
    : []
  let base = {}
  if (isPlainObject(current)) base = { ...current }
  else if (current === null) {
    for (const v of order) base[v] = null
  }
  for (const [variant, value] of Object.entries(edit.variants)) {
    base[variant] = value
  }
  // Reihenfolge: bestehende Schlüssel bleiben, neue nach `variants`.
  const out = {}
  if (isPlainObject(current)) {
    for (const key of Object.keys(current)) out[key] = base[key]
  }
  for (const v of order) if (v in base && !(v in out)) out[v] = base[v]
  for (const key of Object.keys(base)) if (!(key in out)) out[key] = base[key]
  return out
}

/** Tiefer Vergleich für Mengenwerte (Zahl, null, undefined, flaches Objekt). */
function sameValue(a, b) {
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => sameValue(a[k], b[k]))
  }
  return a === b
}

/** Wert eines Wochentags im rohen (geparsten) YAML-Objekt eines Postens. */
function currentDayValue(rawItem, weekday) {
  if (!isPlainObject(rawItem) || !isPlainObject(rawItem.base)) return undefined
  for (const [key, value] of Object.entries(rawItem.base)) {
    if (String(key).trim() === String(weekday)) return value
  }
  return undefined
}

/**
 * Prüffehler, die erst durch die Änderung entstehen. Was vorher schon falsch
 * war (etwa ein inzwischen gelöschtes hq-Produkt), blockiert das Speichern
 * einer Grundmenge nicht - es steht weiter in `errors` der Config.
 */
function newErrors(before, after) {
  const seen = new Set(
    (Array.isArray(before) ? before : []).map((e) => `${e.path}\0${e.message}`)
  )
  return (Array.isArray(after) ? after : []).filter(
    (e) => !seen.has(`${e.path}\0${e.message}`)
  )
}

function oneLine(value, fallback) {
  const text = String(value === undefined || value === null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

/**
 * Commit-Nachricht für hq: Betreff, Leerzeile, `Co-authored-by` mit der
 * Benutzer-ID (nie dem Login, D13 - wie bei den Produkten).
 */
function commitMessage(edit, user) {
  const id = oneLine(edit && edit.itemId, 'unbekannt')
  const name = oneLine(edit && edit.item && edit.item.name, id)
  const day = WEEKDAY_NAMES[edit && edit.weekday] || 'unbekannter Tag'
  return `config: Grundmenge ${name} (${id}) ${day} geändert\n\n${coAuthorTrailer(
    user
  )}\n`
}

module.exports = {
  MAX_QTY,
  WEEKDAY_NAMES,
  parseQuantity,
  parseBaseEdit,
  nextDayValue,
  sameValue,
  currentDayValue,
  newErrors,
  commitMessage,
}
