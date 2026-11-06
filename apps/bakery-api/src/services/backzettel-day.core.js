// Backzettel-Tag (Z3): Eingabepruefung, Freigabe-Schnappschuss, Deltas und
// die Anzeige eines freigegebenen Tages.
//
// Dependency-freies CommonJS wie `backzettel.core.js`. Hier steht keine
// Mengenformel - die Tagesrechnung bleibt in `backzettel.core.js`. Diese
// Datei uebersetzt nur zwischen den gespeicherten Zeilen (`backzettel_lines`,
// `backzettel_deltas`, Vorbestellungen) und dem Core, damit die Route
// (`src/routes/backzettel.routes.ts`) duenn bleibt und alles hier ohne
// Datenbank getestet werden kann.

const core = require('./backzettel.core')
const configCore = require('./backzettel-config.core')
const recipesCore = require('./backzettel-recipes.core')
const { hasNameControlChars } = require('./control-chars.core')

const { INTEGER_UNITS, SECTION_LABELS } = configCore

/** Groesste Korrektur je Zeile (Stueck, Liter, ...), wie bei den Backschrank-Mengen. */
const MAX_CORRECTION = 10000
/** Saisonfaktor: > 0 und hoechstens 5 (D10: Standard 1,0). */
const MAX_SEASON_FACTOR = 5
const MAX_REASON_LENGTH = 500
const REASON_CONTROL_MESSAGE = 'Der Grund enthält unzulässige Steuerzeichen.'

function round2(x) {
  const r = Math.round(x * 100) / 100
  return r === 0 ? 0 : r
}

function fail(error, message) {
  return { ok: false, error, message }
}

/** `''`/`null`/`undefined` -> `''` (Speicherform „ohne Variante“). */
function storedVariant(variant) {
  return variant === undefined || variant === null ? '' : String(variant)
}

/** Speicherform -> Core-/Antwortform (`null` = ohne Variante). */
function apiVariant(variant) {
  return variant === undefined || variant === null || variant === ''
    ? null
    : String(variant)
}

/**
 * Liest eine Zahl aus JSON: Zahl oder Zeichenkette mit Punkt oder Komma
 * („1,2“). Alles andere ist `NaN` - nie stillschweigend 0.
 */
function parseNumber(raw) {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string' && /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(raw)) {
    return Number(raw.trim().replace(',', '.'))
  }
  return NaN
}

/**
 * Saisonfaktor aus `{ factor }`.
 * @returns {{ok:true, value:number} | {ok:false, error:string, message:string}}
 */
function parseSeasonFactor(body) {
  const raw = body && typeof body === 'object' ? body.factor : undefined
  const factor = parseNumber(raw)
  if (!Number.isFinite(factor)) {
    return fail('validation', 'Saisonfaktor fehlt oder ist keine Zahl.')
  }
  const value = round2(factor)
  if (value <= 0 || value > MAX_SEASON_FACTOR) {
    return fail(
      'validation',
      `Der Saisonfaktor muss größer als 0 und höchstens ${MAX_SEASON_FACTOR} sein.`
    )
  }
  if (Math.abs(value - factor) > 1e-9) {
    return fail(
      'validation',
      'Der Saisonfaktor hat höchstens zwei Nachkommastellen.'
    )
  }
  return { ok: true, value }
}

/**
 * Prueft, ob Posten und Variante einer Korrektur im Stammdatensatz stehen.
 * `variant` `''`/`undefined` ist „ohne Variante“; bei Posten mit Varianten ist
 * das die Zeile „ohne Angabe“, die der Core auch rechnet.
 * @returns {{ok:true, item:object, variant:string} | {ok:false, error, message}}
 */
function resolveLine(config, itemId, variant) {
  const items = (config && config.items) || []
  const item = items.find((i) => i.id === itemId)
  if (!item) {
    return fail(
      'unknown_item',
      `Den Backzettel-Posten „${itemId}“ gibt es nicht.`
    )
  }
  const v = storedVariant(variant)
  if (v === '') return { ok: true, item, variant: '' }
  if (!item.variants.includes(v)) {
    return fail(
      'unknown_variant',
      item.variants.length === 0
        ? `„${item.name}“ hat keine Varianten.`
        : `„${item.name}“ kennt die Variante „${v}“ nicht.`
    )
  }
  return { ok: true, item, variant: v }
}

/**
 * Korrektur aus `{ correction, reason }`. Eine Korrektur ungleich 0 braucht
 * einen Grund; 0 loescht Korrektur und Grund. Stueck/Blech ganzzahlig,
 * Liter/kg auf 0,01.
 * @returns {{ok:true, value:{correction:number, reason:string|null}} | {ok:false, error, message}}
 */
function parseCorrection(body, item) {
  const b = body && typeof body === 'object' ? body : {}
  const correction = parseNumber(b.correction)
  if (!Number.isFinite(correction)) {
    return fail('validation', 'Korrektur fehlt oder ist keine Zahl.')
  }
  if (Math.abs(correction) > MAX_CORRECTION) {
    return fail(
      'validation',
      `Die Korrektur darf höchstens ±${MAX_CORRECTION} betragen.`
    )
  }
  const unit = (item && item.unit) || 'Stück'
  if (INTEGER_UNITS.has(unit) && !Number.isInteger(correction)) {
    return fail(
      'validation',
      `Korrekturen in ${unit} müssen ganze Zahlen sein.`
    )
  }
  if (
    !INTEGER_UNITS.has(unit) &&
    Math.abs(round2(correction) - correction) > 1e-9
  ) {
    return fail(
      'validation',
      `Korrekturen in ${unit} haben höchstens zwei Nachkommastellen.`
    )
  }
  if (correction === 0) {
    return { ok: true, value: { correction: 0, reason: null } }
  }
  if (
    b.reason !== undefined &&
    b.reason !== null &&
    typeof b.reason !== 'string'
  ) {
    return fail('validation', 'Der Grund muss ein Text sein.')
  }
  const reason = typeof b.reason === 'string' ? b.reason.trim() : ''
  if (!reason) {
    return fail('reason_required', 'Für eine Korrektur ist ein Grund nötig.')
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return fail(
      'validation',
      `Der Grund darf höchstens ${MAX_REASON_LENGTH} Zeichen lang sein.`
    )
  }
  // Einzeilig auf Zettel und Ausdruck (W4-Verifikation Runde 3): ein RLO
  // drehte den Grund um, NUL/BEL haben dort nichts verloren.
  if (hasNameControlChars(reason)) {
    return fail('INVALID_TEXT', REASON_CONTROL_MESSAGE)
  }
  return { ok: true, value: { correction: round2(correction), reason } }
}

/**
 * Flache Vorbestellungspositionen eines Tages (Schnappschuss-Form) aus
 * Vorbestellungen `{id, status, items:[{productId, variant, quantity}]}`.
 * Stornierte zaehlen nicht. Sortiert, damit gleiche Staende gleich aussehen.
 * @returns {Array<{preorderId:number|null, productId:string, variant:string, qty:number}>}
 */
function snapshotFromPreorders(preorders) {
  const out = []
  for (const p of Array.isArray(preorders) ? preorders : []) {
    if (!p || p.status === 'storniert') continue
    for (const item of Array.isArray(p.items) ? p.items : []) {
      if (!item) continue
      const qty = Number(item.quantity === undefined ? item.qty : item.quantity)
      if (!Number.isFinite(qty) || qty <= 0) continue
      out.push({
        preorderId: p.id === undefined || p.id === null ? null : p.id,
        productId: String(item.productId),
        variant: storedVariant(item.variant),
        qty,
      })
    }
  }
  return out.sort(
    (a, b) =>
      String(a.preorderId).localeCompare(String(b.preorderId), 'en', {
        numeric: true,
      }) ||
      a.productId.localeCompare(b.productId) ||
      a.variant.localeCompare(b.variant)
  )
}

/** Schnappschuss -> Eingabe fuer `computeDay`/`computePreorderDeltas`. */
function toCorePreorderItems(snapshot, date) {
  return (Array.isArray(snapshot) ? snapshot : []).map((s) => ({
    preorderId: s.preorderId,
    productId: s.productId,
    variant: apiVariant(s.variant),
    qty: s.qty,
    pickupDate: date,
  }))
}

function deltaKey(preorderId, itemId, variant) {
  return `${
    preorderId === undefined || preorderId === null ? '' : preorderId
  }#${itemId}|${storedVariant(variant)}`
}

/** Summe je Vorbestellung × Posten × Variante, in Posten-Einheiten. */
function preorderSums(config, date, snapshot, catalog) {
  const map = new Map()
  const entries = core.computePreorderDeltas({
    config,
    date,
    before: [],
    after: toCorePreorderItems(snapshot, date),
    catalog,
  })
  for (const e of entries) {
    map.set(deltaKey(e.preorderId, e.itemId, e.variant), {
      itemId: e.itemId,
      variant: storedVariant(e.variant),
      preorderId: e.preorderId,
      qty: e.after,
    })
  }
  return map
}

/**
 * Welche Delta-Zeilen fehlen noch? Vergleicht je Vorbestellung × Posten ×
 * Variante den Stand bei der Freigabe (`snapshot`), den Stand jetzt
 * (`current`) und die schon gespeicherten Zeilen (`recorded`). Jede Zeile
 * ist die Aenderung seit der letzten - so ist das Ergebnis idempotent: ein
 * zweiter Aufruf mit denselben Staenden liefert nichts.
 *
 * @param {object} args
 * @param {object} args.config normalisierte Stammdaten
 * @param {string} args.date Produktionstag
 * @param {Array} args.snapshot Positionen bei der Freigabe (Schnappschuss-Form)
 * @param {Array} args.current Positionen jetzt (Schnappschuss-Form)
 * @param {Array} args.recorded gespeicherte Deltas `{itemId, variant, preorderId, qty}`
 * @param {Array} [args.catalog] hq-Produkte fuer numerische IDs
 * @returns {Array<{itemId:string, variant:string, preorderId:number|null, qty:number, kind:'added'|'changed'|'cancelled'}>}
 */
function reconcileDeltas(args) {
  const a = args || {}
  const before = preorderSums(a.config, a.date, a.snapshot, a.catalog)
  const after = preorderSums(a.config, a.date, a.current, a.catalog)
  const recorded = new Map()
  for (const r of Array.isArray(a.recorded) ? a.recorded : []) {
    const k = deltaKey(r.preorderId, r.itemId, r.variant)
    const e = recorded.get(k) || {
      itemId: r.itemId,
      variant: storedVariant(r.variant),
      preorderId:
        r.preorderId === undefined || r.preorderId === null
          ? null
          : r.preorderId,
      qty: 0,
    }
    e.qty = round2(e.qty + Number(r.qty || 0))
    recorded.set(k, e)
  }
  const keys = [
    ...after.keys(),
    ...[...before.keys()].filter((k) => !after.has(k)),
    ...[...recorded.keys()].filter((k) => !after.has(k) && !before.has(k)),
  ]
  const out = []
  for (const k of keys) {
    const ref = after.get(k) || before.get(k) || recorded.get(k)
    const b = before.has(k) ? before.get(k).qty : 0
    const n = after.has(k) ? after.get(k).qty : 0
    const r = recorded.has(k) ? recorded.get(k).qty : 0
    const qty = round2(n - b - r)
    if (qty === 0) continue
    const previous = round2(b + r)
    out.push({
      itemId: ref.itemId,
      variant: ref.variant,
      preorderId: ref.preorderId,
      qty,
      kind: previous === 0 ? 'added' : n === 0 ? 'cancelled' : 'changed',
    })
  }
  return out
}

/**
 * Zeilen, die bei der Freigabe gespeichert werden (eine je Posten ×
 * Variante, `variant` in Speicherform).
 */
function linesForConfirm(computedLines) {
  return (Array.isArray(computedLines) ? computedLines : []).map((l) => ({
    itemId: l.itemId,
    variant: storedVariant(l.variant),
    name: l.name,
    section: l.section,
    unit: l.unit,
    base: l.base,
    seasonal: l.seasonal,
    preorders: l.preorders,
    cap: l.cap,
    correction: l.correction,
    correctionReason: l.correction === 0 ? null : l.correctionReason,
    total: l.total,
  }))
}

/**
 * Korrekturen eines Entwurfs aus den gespeicherten Zeilen, in der Form, die
 * `computeDay` erwartet. Zeilen ohne Korrektur zaehlen nicht.
 */
function correctionsFromRows(rows) {
  const out = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const qty = Number(r.correction)
    if (!Number.isFinite(qty) || qty === 0) continue
    out.push({
      itemId: r.itemId,
      variant: apiVariant(r.variant),
      qty,
      reason: r.correctionReason || null,
    })
  }
  return out
}

/**
 * Eine freigegebene Zeile in der Form des Cores (`computeDay().lines[]`).
 * Name, Abschnitt und Einheit kommen aus dem Schnappschuss der Zeile; Blech
 * und PLU (reine Anzeige) aus den aktuellen Stammdaten, wenn der Posten dort
 * noch steht. `unsetKeys` (aus `computedSnapshot().unsetKeys`) sagt, welche
 * Zeilen bei der Freigabe keine Grundmenge hatten - sonst laese sich eine
 * offene Grundmenge auf dem freigegebenen Zettel als „0, nicht backen".
 */
function frozenLine(row, config, unsetKeys) {
  const item =
    config && Array.isArray(config.items)
      ? config.items.find((i) => i.id === row.itemId)
      : null
  const unit = row.unit || (item ? item.unit : 'Stück')
  const total = Number(row.total) || 0
  const key = core.lineKey(row.itemId, apiVariant(row.variant))
  const line = {
    key,
    itemId: row.itemId,
    name: row.name || (item ? item.name : row.itemId),
    section: row.section || (item ? item.section : null),
    unit,
    variant: apiVariant(row.variant),
    base: Number(row.base) || 0,
    baseUnset: Array.isArray(unsetKeys) ? unsetKeys.includes(key) : false,
    seasonal: Number(row.seasonal) || 0,
    preorders: Number(row.preorders) || 0,
    cap: Number(row.cap) || 0,
    correction: Number(row.correction) || 0,
    correctionReason: row.correctionReason || null,
    total,
    tray: item ? core.trayText(item.tray, total, unit) : null,
    plu: item ? item.plu : [],
  }
  if (item && unit === 'Liter' && item.pieces_per_liter) {
    line.loavesEstimate = Math.round(total * item.pieces_per_liter)
  }
  return line
}

/**
 * Abschnitte eines freigegebenen Tages aus den gespeicherten Zeilen, in der
 * Reihenfolge der Stammdaten (unbekannte Abschnitte hinten, Zeilen in der
 * Reihenfolge der Posten). Geht auch ohne gueltige Stammdaten (`config`
 * null), damit ein freigegebener Zettel lesbar bleibt, wenn die YAML kaputt ist.
 */
function frozenSections(rows, config, unsetKeys) {
  const lines = (Array.isArray(rows) ? rows : []).map((r) => ({
    row: r,
    line: frozenLine(r, config, unsetKeys),
  }))
  const sectionOrder = config && config.sections ? [...config.sections] : []
  for (const { line } of lines) {
    if (line.section && !sectionOrder.includes(line.section))
      sectionOrder.push(line.section)
  }
  const itemOrder = new Map(
    ((config && config.items) || []).map((item, i) => [item.id, i])
  )
  const variantRank = (item, variant) => {
    if (!item) return 0
    const i =
      variant === null ? item.variants.length : item.variants.indexOf(variant)
    return i === -1 ? item.variants.length + 1 : i
  }
  const itemsById = new Map(
    ((config && config.items) || []).map((item) => [item.id, item])
  )
  lines.sort((x, y) => {
    const ix = itemOrder.has(x.line.itemId)
      ? itemOrder.get(x.line.itemId)
      : Infinity
    const iy = itemOrder.has(y.line.itemId)
      ? itemOrder.get(y.line.itemId)
      : Infinity
    if (ix !== iy) return ix - iy
    if (x.line.itemId !== y.line.itemId)
      return x.line.itemId.localeCompare(y.line.itemId)
    const item = itemsById.get(x.line.itemId)
    return variantRank(item, x.line.variant) - variantRank(item, y.line.variant)
  })
  return sectionOrder
    .map((id) => ({
      id,
      label: SECTION_LABELS[id] || id,
      lines: lines.filter((l) => l.line.section === id),
    }))
    .filter((s) => s.lines.length > 0)
}

/** Mengenfelder einer freigegebenen Zeile, die der Baecker abarbeitet. */
const FROZEN_QTY_FIELDS = ['base', 'seasonal', 'preorders', 'cap', 'total']

/**
 * Hat sich die Menge einer schon gespeicherten Zeile bei einer erneuten
 * Freigabe geaendert? Dann gilt ein Haken aus der vorigen Freigabe nicht
 * mehr (sonst sieht die Backstube eine erledigte Zeile und uebersieht die
 * zusaetzlichen Stuecke). `correction` zaehlt nicht eigens: sie wird schon im
 * Entwurf in die Zeile geschrieben und steckt in `total`.
 */
function frozenQtyChanged(row, values) {
  if (!row || !values) return false
  return FROZEN_QTY_FIELDS.some(
    (f) => round2(Number(row[f]) || 0) !== round2(Number(values[f]) || 0)
  )
}

/**
 * Bleibt der Haken einer Zeile bei einer erneuten Freigabe stehen? Ja, wenn
 * die Menge gleich blieb - und auch, wenn sie kleiner wurde (W4-Verifikation
 * Runde 3): wer 14 gebacken hat und jetzt nur 12 braucht, ist fertig. Nur
 * wenn mehr nötig ist, fällt der Haken weg, sonst übersähe die Backstube die
 * zusätzlichen Stücke.
 */
function tickStillValid(row, values) {
  if (!frozenQtyChanged(row, values)) return true
  return round2(Number(values.total) || 0) <= round2(Number(row.total) || 0)
}

/**
 * Was der Core neben den Zeilen bei der Freigabe gerechnet hat; ein
 * freigegebener Tag wird daraus gezeigt, nicht aus der aktuellen YAML.
 */
function computedSnapshot(result) {
  const r = result || {}
  return JSON.parse(
    JSON.stringify({
      hefeteig: r.hefeteig === undefined ? null : r.hefeteig,
      fillings: r.fillings === undefined ? null : r.fillings,
      prep: r.prep === undefined ? null : r.prep,
      warnings: Array.isArray(r.warnings) ? r.warnings : [],
      // Zeilen ohne festgelegte Grundmenge (`baseUnset`): die Tabelle der
      // Zeilen hat dafuer keine Spalte.
      unsetKeys: (Array.isArray(r.lines) ? r.lines : [])
        .filter((l) => l && l.baseUnset)
        .map((l) => l.key),
      // Vorbestellungen je Zeile vor dem Aufrunden (Viertel): nur damit
      // spaetere Nachtraege genau sagen koennen, was zusaetzlich zu backen
      // ist (`deltaBakeExtras`). Die Zeilentabelle speichert nur gerundet.
      preordersExact: Object.fromEntries(
        (Array.isArray(r.lines) ? r.lines : [])
          .filter(
            (l) => l && Number.isFinite(Number(l.preordersExact)) && l.preorders
          )
          .map((l) => [l.key, round2(Number(l.preordersExact))])
      ),
    })
  )
}

/**
 * Was die Nachtraege einer freigegebenen Zeile zusaetzlich zu backen
 * bedeuten (W4-Verifikation): ein Nachtrag von +0,25 Kranz ist nicht
 * „0,25 mehr“, sondern - nach dem Aufrunden - ein ganzer Kranz oder keiner.
 *
 *   extra = roundUp(exakt + Nachtrag) − roundUp(exakt)
 *
 * `exactByKey` kommt aus dem Freigabe-Schnappschuss (`preordersExact`); fuer
 * Tage, die vor dieser Angabe freigegeben wurden, gilt die gerundete
 * Vorbestellmenge der Zeile - das kann um hoechstens eine Einheit zu viel
 * ergeben, nie zu wenig.
 *
 * @param {Array<{key: string, unit: string, preorders: number}>} lines
 * @param {Record<string, {qty: number}>} deltaByKey
 * @param {Record<string, number> | null | undefined} exactByKey
 * @returns {Record<string, number>} Zeilen-Schluessel -> zusaetzlich (Einheit der Zeile)
 */
function deltaBakeExtras(lines, deltaByKey, exactByKey) {
  const out = {}
  for (const line of Array.isArray(lines) ? lines : []) {
    const d = deltaByKey ? deltaByKey[line.key] : null
    if (!d || !Number(d.qty)) continue
    const known =
      exactByKey && Number.isFinite(Number(exactByKey[line.key]))
        ? Number(exactByKey[line.key])
        : null
    const exact = known === null ? Number(line.preorders) || 0 : known
    const before = core.roundUp(exact, line.unit)
    const after = core.roundUp(Math.max(0, exact + Number(d.qty)), line.unit)
    out[line.key] = round2(after - before)
  }
  return out
}

/** Zeilen mit den Nachtraegen in `total` (fuer Hefeteig und Fuellungen). */
function linesWithExtras(lines, extras) {
  return (Array.isArray(lines) ? lines : []).map((line) =>
    extras && extras[line.key]
      ? { ...line, total: Math.max(0, round2(line.total + extras[line.key])) }
      : line
  )
}

/**
 * Unterschied Hefeteig/Fuellungen ohne und mit Nachtraegen - nur, was sich
 * aendert. `null`, wenn sich nichts aendert.
 */
function hefeteigFillingsDiff(before, after) {
  const doughs = []
  const beforeDoughs = new Map(
    ((before && before.hefeteig && before.hefeteig.doughs) || []).map((d) => [
      d.id,
      d,
    ])
  )
  for (const d of (after && after.hefeteig && after.hefeteig.doughs) || []) {
    const b = beforeDoughs.get(d.id) || {
      pieces: 0,
      dough_g: 0,
      weighing: [],
      batches: null,
    }
    const bw = new Map((b.weighing || []).map((w) => [w.piece_g, w.pieces]))
    const weighing = (d.weighing || [])
      .map((w) => ({
        piece_g: w.piece_g,
        pieces: round2(w.pieces - (bw.get(w.piece_g) || 0)),
        total: w.pieces,
      }))
      .filter((w) => w.pieces !== 0)
    const pieces = round2(d.pieces - (b.pieces || 0))
    if (pieces === 0 && weighing.length === 0) continue
    doughs.push({
      id: d.id,
      name: d.name,
      pieces,
      totalPieces: d.pieces,
      dough_g: round2(d.dough_g - (b.dough_g || 0)),
      totalDough_g: d.dough_g,
      batches: d.batches,
      // W4-Verifikation Runde 2: Chargen vor den Nachtraegen und die
      // Chargengroesse - sonst sieht die Backstube nicht, dass es jetzt eine
      // Charge mehr ist.
      batchesBefore: b.batches === undefined ? null : b.batches,
      batch_max_kg: d.batch_max_kg === undefined ? null : d.batch_max_kg,
      weighing,
    })
  }
  const fillings = []
  const beforeFillings = new Map(
    ((before && before.fillings) || []).map((f) => [f.id, f])
  )
  for (const f of (after && after.fillings) || []) {
    const b = beforeFillings.get(f.id)
    const grams = round2((f.grams || 0) - ((b && b.grams) || 0))
    if (grams === 0) continue
    // Das Rezept fuer die zusaetzliche Menge (nur bei mehr, nur wenn es sich
    // hochrechnen laesst) - sonst rechnet die Backstube von Hand.
    const recipe =
      grams > 0 && f.recipe && f.recipe.complete !== false
        ? recipesCore.scaleRecipe(f.recipe, grams)
        : null
    fillings.push({
      id: f.id,
      name: f.name,
      grams,
      totalGrams: f.grams,
      recipe,
    })
  }
  return doughs.length || fillings.length ? { doughs, fillings } : null
}

/**
 * Wuerden die aktuellen Stammdaten fuer dieselben freigegebenen Mengen etwas
 * anderes ergeben (Hefeteig, Fuellungen, Vorbereitung)? Nur ein Hinweis -
 * der freigegebene Zettel bleibt, wie er ist.
 */
function snapshotDiffers(snapshot, recomputed) {
  if (!snapshot || !recomputed) return false
  const pick = (x) =>
    JSON.stringify({
      hefeteig: x.hefeteig === undefined ? null : x.hefeteig,
      fillings: x.fillings === undefined ? null : x.fillings,
      prep: x.prep === undefined ? null : x.prep,
    })
  return pick(snapshot) !== pick(recomputed)
}

function shiftDate(date, days) {
  const [y, m, d] = String(date).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Vorbereitungstag fuer `date`: der Kalender-Vortag (roadmap §5.4, „d−1 um
 * 14 Uhr“). Ist der Vortag selbst kein Produktionstag (Dienstag nach dem
 * Ruhetag Montag), ist der Termin offen (Q-B2) - `prepDateProvisional`.
 * Ohne Stammdaten (`days` unbekannt) `null`.
 */
function prepDateFor(date, days) {
  const prepDate = shiftDate(date, -1)
  const provisional = Array.isArray(days)
    ? !days.includes(core.isoWeekday(prepDate))
    : null
  return { prepDate, prepDateProvisional: provisional }
}

module.exports = {
  MAX_CORRECTION,
  MAX_SEASON_FACTOR,
  MAX_REASON_LENGTH,
  REASON_CONTROL_MESSAGE,
  hasNameControlChars,
  storedVariant,
  apiVariant,
  parseNumber,
  parseSeasonFactor,
  parseCorrection,
  resolveLine,
  snapshotFromPreorders,
  toCorePreorderItems,
  reconcileDeltas,
  linesForConfirm,
  correctionsFromRows,
  frozenLine,
  frozenSections,
  FROZEN_QTY_FIELDS,
  frozenQtyChanged,
  tickStillValid,
  computedSnapshot,
  deltaBakeExtras,
  linesWithExtras,
  hefeteigFillingsDiff,
  snapshotDiffers,
  prepDateFor,
}
