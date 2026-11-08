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
const planCore = require('./backzettel-plan.core')
const doughCore = require('./backzettel-dough.core')
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

function isNum(x) {
  return typeof x === 'number' && Number.isFinite(x)
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
 * Z10: traegt die Vorbestellung `pickupDate`, steht er an jeder Position
 * (ein Zettel sammelt mehrere Backtage ein).
 * @returns {Array<{preorderId:number|null, productId:string, variant:string, qty:number, pickupDate?:string}>}
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
        ...(typeof p.pickupDate === 'string' && p.pickupDate
          ? { pickupDate: p.pickupDate }
          : {}),
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

/**
 * Schnappschuss -> Eingabe fuer `computeDay`/`computePreorderDeltas`. Der
 * Abholtag ist der der Position (Z10), sonst `date`.
 */
function toCorePreorderItems(snapshot, date) {
  return (Array.isArray(snapshot) ? snapshot : []).map((s) => ({
    preorderId: s.preorderId,
    productId: s.productId,
    variant: apiVariant(s.variant),
    qty: s.qty,
    pickupDate: s.pickupDate || date,
  }))
}

function deltaKey(preorderId, itemId, variant, bakeDate) {
  return `${
    preorderId === undefined || preorderId === null ? '' : preorderId
  }#${itemId}|${storedVariant(variant)}${bakeDate ? `@${bakeDate}` : ''}`
}

/** Summe je Vorbestellung × Posten × Variante (× Backtag), in Posten-Einheiten. */
function preorderSums(config, date, snapshot, catalog, plan) {
  const map = new Map()
  const entries = core.computePreorderDeltas({
    config,
    date,
    before: [],
    after: toCorePreorderItems(snapshot, date),
    catalog,
    ...(plan ? { plan } : {}),
  })
  for (const e of entries) {
    map.set(
      deltaKey(e.preorderId, e.itemId, e.variant, plan ? e.bakeDate : null),
      {
        itemId: e.itemId,
        variant: storedVariant(e.variant),
        preorderId: e.preorderId,
        qty: e.after,
        ...(plan ? { bakeDate: e.bakeDate } : {}),
      }
    )
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
 * @param {object} [args.plan] Z10: Plan des Zettels (`planForSheet`, bei
 *   alten Tagen `legacyPlan`). Dann zaehlen die Positionen aller Backtage des
 *   Plans, je Backtag getrennt, und jede Zeile traegt `bakeDate` (gespeicherte
 *   Zeilen ohne `bakeDate` gehoeren zum Zettel-Tag). Ohne Plan wie v1.
 * @param {Record<string, string|{status: string, pickupDate: string}>} [args.orders]
 *   Status (Z10: mit Abholtag) je Vorbestellung, die
 *   jetzt an diesem Tag liegt (auch `storniert`). Damit heisst eine Menge,
 *   die auf 0 faellt, nur dann `cancelled`, wenn die Bestellung storniert
 *   ist; liegt sie noch hier, ist die Zeile `removed`, liegt sie nicht mehr
 *   hier, ist sie `moved` (W4-Verifikation Runde 5). Ohne Angabe: wie
 *   bisher `cancelled`.
 * @returns {Array<{itemId:string, variant:string, preorderId:number|null, qty:number, kind:'added'|'changed'|'cancelled'|'removed'|'moved'}>}
 */
function goneKind(orders, preorderId, bakeDate) {
  if (!orders || preorderId === null || preorderId === undefined) {
    return 'cancelled'
  }
  const entry = orders[String(preorderId)]
  if (entry === undefined) return 'moved'
  // Z10: `{ status, pickupDate }` - ein Zettel je Teigtag traegt mehrere
  // Backtage; zieht eine Bestellung zwischen zweien davon um (Di → So),
  // liegt sie noch auf dem Zettel, ist aber verschoben, nicht entfernt.
  const status = entry && typeof entry === 'object' ? entry.status : entry
  if (
    entry &&
    typeof entry === 'object' &&
    bakeDate &&
    typeof entry.pickupDate === 'string' &&
    entry.pickupDate !== bakeDate &&
    status !== 'storniert' &&
    status !== 'cancelled'
  ) {
    return 'moved'
  }
  return status === 'storniert' || status === 'cancelled'
    ? 'cancelled'
    : 'removed'
}

function reconcileDeltas(args) {
  const a = args || {}
  const plan = a.plan || null
  const before = preorderSums(a.config, a.date, a.snapshot, a.catalog, plan)
  const after = preorderSums(a.config, a.date, a.current, a.catalog, plan)
  const recorded = new Map()
  for (const r of Array.isArray(a.recorded) ? a.recorded : []) {
    const bakeDate = plan ? r.bakeDate || a.date : null
    const k = deltaKey(r.preorderId, r.itemId, r.variant, bakeDate)
    const e = recorded.get(k) || {
      itemId: r.itemId,
      variant: storedVariant(r.variant),
      preorderId:
        r.preorderId === undefined || r.preorderId === null
          ? null
          : r.preorderId,
      qty: 0,
      ...(plan ? { bakeDate } : {}),
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
      kind:
        previous === 0
          ? 'added'
          : n === 0
          ? goneKind(a.orders, ref.preorderId, plan ? ref.bakeDate : null)
          : 'changed',
      ...(plan ? { bakeDate: ref.bakeDate } : {}),
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
    ...(l.bakeDate ? { bakeDate: l.bakeDate } : {}),
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
      ...(r.bakeDate ? { bakeDate: r.bakeDate } : {}),
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
  // Z10: Zeilen mit Backtag (`bake_date`) - Schluessel wie im Entwurf
  const bakeDate =
    typeof row.bakeDate === 'string' && row.bakeDate ? row.bakeDate : null
  const sheetDate = bakeDate && typeof row.date === 'string' ? row.date : null
  const key = core.lineKey(
    row.itemId,
    apiVariant(row.variant),
    bakeDate,
    sheetDate || bakeDate
  )
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
  if (bakeDate) {
    const doughDate = sheetDate || bakeDate
    Object.assign(line, {
      bakeDate,
      doughDate,
      lead: item ? planCore.leadFor(item, core.isoWeekday(bakeDate)) : 0,
      variantKind: item && item.variantKind ? item.variantKind : null,
      variantLabel: item
        ? configCore.variantDisplayName(config, item, line.variant)
        : line.variant,
      ...(item && item.bruch
        ? {
            bruch: {
              group: item.bruch.group,
              perProduct: item.bruch.per_product,
            },
          }
        : {}),
      totalIsMinimum: doughCore.qtyUnknown(line),
    })
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
    // Z10: innerhalb eines Abschnitts erst nach Backtag
    const bx = x.line.bakeDate || ''
    const by = y.line.bakeDate || ''
    if (bx !== by) return bx.localeCompare(by)
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
  // Z10: ein Zettel je Teigtag friert dazu Plan, Teige, Maschinen-Kästen,
  // Brot, Brötchen und die offenen Stammdaten ein (§5.3); ein Tag ohne
  // `plan` im Schnappschuss ist ein alter Tag (`legacyPlan`).
  const v2 =
    r.sheetVersion === 2
      ? {
          sheetVersion: 2,
          plan: r.plan === undefined ? null : r.plan,
          bakeDates: Array.isArray(r.bakeDates) ? r.bakeDates : [],
          doughs: Array.isArray(r.doughs) ? r.doughs : [],
          machine: Array.isArray(r.machine) ? r.machine : [],
          bread: r.bread === undefined ? null : r.bread,
          rolls: Array.isArray(r.rolls) ? r.rolls : [],
          openMasterData: Array.isArray(r.openMasterData)
            ? r.openMasterData
            : [],
        }
      : {}
  return JSON.parse(
    JSON.stringify({
      ...v2,
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
      // W4-Verifikation Runde 4: Summe aller Quellen vor dem Aufrunden
      // (Basis × Saison + Vorbestellt + CAP) - aufgerundet wird erst die
      // Summe, also rechnen auch die Nachtraege darauf.
      subtotalExact: Object.fromEntries(
        (Array.isArray(r.lines) ? r.lines : [])
          .filter((l) => l && Number.isFinite(Number(l.subtotalExact)))
          .map((l) => [l.key, round2(Number(l.subtotalExact))])
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
 * @param {Record<string, number> | null | undefined} [subtotalByKey] Summe
 *   aller Quellen vor dem Aufrunden (Freigabe-Schnappschuss ab Runde 4)
 * @returns {Record<string, number>} Zeilen-Schluessel -> zusaetzlich (Einheit der Zeile)
 */
function deltaBakeExtras(lines, deltaByKey, exactByKey, subtotalByKey) {
  const out = {}
  for (const line of Array.isArray(lines) ? lines : []) {
    const d = deltaByKey ? deltaByKey[line.key] : null
    if (!d || !Number(d.qty)) continue
    // Freigaben ab Runde 4: die ganze Zeile vor dem Aufrunden.
    const subtotal =
      subtotalByKey && Number.isFinite(Number(subtotalByKey[line.key]))
        ? Number(subtotalByKey[line.key])
        : null
    if (subtotal !== null) {
      out[line.key] = round2(
        core.roundUp(Math.max(0, subtotal + Number(d.qty)), line.unit) -
          core.roundUp(subtotal, line.unit)
      )
      continue
    }
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

/**
 * Die freigegebenen Zeilen plus je eine leere Zeile (alles 0) fuer jeden
 * Nachtrag, dessen Posten/Variante bei der Freigabe gar nicht gebacken
 * wurde (W4-Verifikation Runde 6): sonst bekam so ein Nachtrag keine
 * Backmenge (`+0,5 Kranz` statt `+1`) und fiel aus Hefeteig und Fuellungen.
 *
 * Z10: traegt der Nachtrag einen Backtag (`bakeDate`) und ist `sheetDate`
 * (der Zettel-Tag) angegeben, bekommt die leere Zeile denselben Backtag -
 * und damit denselben Schluessel wie der Nachtrag (`itemId|variant@bakeDate`).
 *
 * @param {Array<{key: string}>} lines freigegebene Zeilen (`frozenLine`)
 * @param {Array<{key: string, itemId: string, variant: string|null, bakeDate?: string}>} deltas
 * @param {object|null} config
 * @param {string} [sheetDate] Teigtag des Zettels (Z10)
 */
function linesForDeltas(lines, deltas, config, sheetDate) {
  const out = Array.isArray(lines) ? [...lines] : []
  const known = new Set(out.map((l) => l.key))
  for (const d of Array.isArray(deltas) ? deltas : []) {
    if (!d || known.has(d.key)) continue
    known.add(d.key)
    out.push(
      frozenLine(
        {
          itemId: d.itemId,
          variant: storedVariant(d.variant),
          base: 0,
          seasonal: 0,
          preorders: 0,
          cap: 0,
          correction: 0,
          total: 0,
          ...(sheetDate && d.bakeDate
            ? { date: sheetDate, bakeDate: d.bakeDate }
            : {}),
        },
        config,
        []
      )
    )
  }
  return out
}

/**
 * Vorbereitung eines freigegebenen Tages plus die Aufgaben, die erst durch
 * Nachtraege dazukommen (W4-Verifikation Runde 6): kommt per Nachtrag
 * Vollkorn auf den Tag, braucht es am Vortag das Bruehstueck. Die
 * freigegebene Liste bleibt, wie sie ist; neue Aufgaben stehen hinten,
 * mit `fromDelta: true` und dem Hinweis „Neu durch einen Nachtrag“.
 */
function prepWithDeltas(frozen, live) {
  const out = Array.isArray(frozen) ? [...frozen] : []
  const id = (t) =>
    `${t.id}|${t.variant === null || t.variant === undefined ? '' : t.variant}`
  const have = new Set(out.map(id))
  for (const task of Array.isArray(live) ? live : []) {
    if (!task || have.has(id(task))) continue
    have.add(id(task))
    out.push({
      ...task,
      fromDelta: true,
      note: [task.note, 'Neu durch einen Nachtrag'].filter(Boolean).join(' · '),
    })
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
 * Z10: der Plan eines freigegebenen Zettels - aus dem Schnappschuss, bei
 * Tagen von vor Z10 (`plan` fehlt) `legacyPlan(date)` (alle Posten des Tages).
 */
function planOfSnapshot(snapshot, date) {
  return snapshot && snapshot.plan && Array.isArray(snapshot.plan.bakeDates)
    ? snapshot.plan
    : planCore.legacyPlan(date)
}

/**
 * Was die Nachtraege eines freigegebenen Zettels fuer die Maschinen-Kaesten
 * heissen (Z10, `deltaBakeExtras` je Teig): die Kaesten ohne und mit den
 * zusaetzlichen Backmengen, nur die, die sich aendern. Der freigegebene Stand
 * bleibt eingefroren; das hier ist der Hinweis darueber.
 *
 * @param {object} config normalisierte Stammdaten
 * @param {Array} lines freigegebene Zeilen (`frozenLine`, mit `bakeDate`)
 * @param {Record<string, number>} extras Zeilen-Schluessel -> zusaetzlich
 * @param {string} sheetDate Teigtag
 * @returns {Array<{id, name, doughIds, kgBefore, kg, kgDelta, litersBefore, liters, batchesBefore, batches, complete}>}
 */
function machineDeltaExtras(config, lines, extras, sheetDate) {
  if (!config || !extras || Object.keys(extras).length === 0) return []
  const before = doughCore.computeSheetDoughs(config, lines, sheetDate).machine
  const after = doughCore.computeSheetDoughs(
    config,
    linesWithExtras(lines, extras),
    sheetDate
  ).machine
  const byId = new Map(before.map((m) => [m.id, m]))
  const out = []
  for (const m of after) {
    const b = byId.get(m.id) || {
      kg: 0,
      kgKnown: 0,
      liters: { exact: 0, rounded: 0, reason: null },
      batches: null,
    }
    const kgDelta = round2(m.kgKnown - b.kgKnown)
    if (kgDelta === 0) continue
    out.push({
      id: m.id,
      name: m.name,
      doughIds: m.doughIds,
      kgBefore: b.kg,
      kg: m.kg,
      kgDelta,
      complete: m.complete,
      litersBefore: b.liters,
      liters: m.liters,
      batchesBefore: b.batches,
      batches: m.batches,
    })
  }
  return out
}

/**
 * Was die Nachtraege eines freigegebenen Zettels fuer die Bruch-Gruppen
 * heissen (Z10, Review Runde 1): Teigstuecke vorher/nachher, Brueche
 * vorher/nachher und die freien Stuecke - „+1 Bruch“ oder „passt in die
 * freien Stuecke“. Nur Gruppen, deren Teigstuecke sich aendern. Unbekanntes
 * (Stueck je Bruch offen, Grundmenge offen) bleibt `null`, nie 0.
 *
 * @returns {Array<{key, name, bakeDate, piecesBefore, pieces, piecesDelta,
 *   bruecheBefore, brueche, bruecheDelta, spareBefore, spare,
 *   spareProductsBefore, spareProducts, complete}>}
 */
function bruchDeltaExtras(config, lines, extras, sheetDate) {
  if (!config || !extras || Object.keys(extras).length === 0) return []
  const before = doughCore.bruchGroups(config, lines, sheetDate)
  const after = doughCore.bruchGroups(
    config,
    linesWithExtras(lines, extras),
    sheetDate
  )
  const byKey = new Map(before.map((g) => [g.key, g]))
  const known = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const out = []
  for (const g of after) {
    const b = byKey.get(g.key) || {
      pieces: 0,
      piecesKnown: 0,
      brueche: 0,
      spare: 0,
      spareProducts: 0,
    }
    const piecesDelta = round2((g.piecesKnown || 0) - (b.piecesKnown || 0))
    if (piecesDelta === 0) continue
    const bruecheBefore = known(b.brueche)
    const brueche = known(g.brueche)
    out.push({
      key: g.key,
      group: g.group,
      name: g.name,
      bakeDate: g.bakeDate,
      piecesBefore: known(b.pieces),
      pieces: known(g.pieces),
      piecesDelta,
      bruecheBefore,
      brueche,
      bruecheDelta:
        bruecheBefore !== null && brueche !== null
          ? brueche - bruecheBefore
          : null,
      spareBefore: known(b.spare),
      spare: known(g.spare),
      spareProductsBefore:
        b.spareProducts === undefined ? null : known(b.spareProducts),
      spareProducts:
        g.spareProducts === undefined ? null : known(g.spareProducts),
      complete: Boolean(g.complete),
    })
  }
  return out
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
    // Unbekanntes bleibt unbekannt (Regel 8): `null - null` ist nicht 0.
    const minus = (x, y) =>
      x === null || x === undefined || y === null ? null : round2(x - (y || 0))
    const weighing = (d.weighing || [])
      .map((w) => ({
        piece_g: w.piece_g,
        pieces: minus(w.pieces, bw.has(w.piece_g) ? bw.get(w.piece_g) : 0),
        total: w.pieces,
      }))
      .filter((w) => w.pieces !== 0)
    const pieces = minus(d.pieces, b.pieces === undefined ? 0 : b.pieces)
    if (pieces === 0 && weighing.length === 0) continue
    // Zusatzteig: aus den Gesamtgewichten, sonst - Teig unvollständig, etwa
    // wegen einer offenen Grundmenge - aus dem, was zusätzlich abzuwiegen
    // ist (Teigstücke × Gramm), solange das ganz bekannt ist.
    let doughG = minus(d.dough_g, b.dough_g === undefined ? 0 : b.dough_g)
    if (
      doughG === null &&
      weighing.length > 0 &&
      weighing.every((w) => isNum(w.piece_g) && isNum(w.pieces))
    ) {
      doughG = round2(
        weighing.reduce((sum, w) => sum + w.pieces * w.piece_g, 0)
      )
    }
    const v2 = d.complete !== undefined || d.piecesComplete !== undefined
    doughs.push({
      id: d.id,
      name: d.name,
      pieces,
      totalPieces: d.pieces,
      // Z10: Stücke/Teig gesamt sind nur eine Mindestmenge, solange eine
      // Grundmenge des Teigs offen ist („≥ 37 Teigstücke“).
      ...(v2
        ? {
            totalPiecesComplete: d.piecesComplete !== false,
            totalDoughKnown_g: isNum(d.kgKnown)
              ? Math.round(d.kgKnown * 1000)
              : null,
          }
        : {}),
      dough_g: doughG,
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
    const v2 = f.baseUnset === true || f.missingFillingG === true
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
      ...(v2 ? { totalComplete: !f.baseUnset && !f.missingFillingG } : {}),
      recipe,
    })
  }
  return doughs.length || fillings.length ? { doughs, fillings } : null
}

/** Ist der Schnappschuss ein Teigtag-Zettel (Z10, mit eingefrorenem Plan)? */
function isSheetSnapshot(snapshot) {
  return !!(snapshot && snapshot.plan && Array.isArray(snapshot.plan.bakeDates))
}

/**
 * Der Plan eines freigegebenen Teigtag-Zettels, wie ihn die aktuellen
 * Stammdaten saehen (Z10, fuer `snapshotDiffers`): welche Backtage der Teigtag
 * beliefert (`bakeDatesFor`) und welche eingefrorenen Paare (Backtag ×
 * Posten) ihren Teig jetzt an einem anderen Tag haetten (`lead`,
 * `dough_days`) oder in hq fehlen. Uebernommene Posten (`adopted_orphans`)
 * stehen ohnehin am Backtag selbst und zaehlen nicht als verschoben.
 *
 * Mit `config` null: der eingefrorene Plan selbst (`moved` leer) - die Seite
 * des Schnappschusses im Vergleich.
 *
 * @returns {{ bakeDates: string[], moved: string[] } | null}
 */
function planDrift(config, plan, warnings) {
  if (!plan || !Array.isArray(plan.bakeDates)) return null
  const frozenDates = plan.bakeDates.map((b) => b && b.date)
  if (!config) return { bakeDates: frozenDates, moved: [] }
  const adopted = new Set()
  for (const w of Array.isArray(warnings) ? warnings : []) {
    if (w && w.code === 'adopted_orphans' && Array.isArray(w.items)) {
      for (const id of w.items) adopted.add(id)
    }
  }
  const items = new Map((config.items || []).map((i) => [i.id, i]))
  const moved = []
  for (const b of plan.bakeDates) {
    if (!b || !Array.isArray(b.itemIds)) continue
    for (const id of b.itemIds) {
      if (b.date === plan.doughDate && adopted.has(id)) continue
      const item = items.get(id)
      if (
        !item ||
        planCore.doughDateFor(config, item, b.date) !== plan.doughDate
      ) {
        moved.push(planCore.ownedKey(b.date, id))
      }
    }
  }
  return {
    bakeDates: planCore.bakeDatesFor(config, plan.doughDate),
    moved,
  }
}

/**
 * JSON mit sortierten Schluesseln: zwei Objekte mit denselben Werten ergeben
 * denselben Text, egal in welcher Reihenfolge ihre Felder entstanden sind
 * (der Schnappschuss kommt aus der Datenbank, die Neuberechnung frisch).
 * `undefined` faellt wie bei `JSON.stringify` weg.
 */
function stableJson(value) {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]])
        )
      : v
  )
}

/**
 * Wuerden die aktuellen Stammdaten fuer dieselben freigegebenen Mengen etwas
 * anderes ergeben? Nur ein Hinweis - der freigegebene Zettel bleibt, wie er
 * ist. Ein alter Tag (v1) vergleicht Hefeteig, Fuellungen und Vorbereitung;
 * ein Teigtag-Zettel (Z10) dazu alles, was die Stammdaten aus den Zeilen
 * machen: Teige und Maschinen-Streifen (`kg_per_liter`, Liter-Rundung,
 * Zugaben, `combined_with`), Brot (Groessen, `dough_g`, `from_dough`),
 * Broetchen (Bruch-Gewichte und -Stueck), offene Stammdaten und die Backtage
 * des Plans (`planDrift`: `lead`, `dough_days`). `recomputed` traegt dafuer
 * `sheetParts` der aktuellen Stammdaten und `planDrift`.
 */
function snapshotDiffers(snapshot, recomputed) {
  if (!snapshot || !recomputed) return false
  const sheet = isSheetSnapshot(snapshot)
  const field = (x, k, empty) => (x[k] === undefined ? empty : x[k])
  const pick = (x, plan) =>
    stableJson({
      hefeteig: field(x, 'hefeteig', null),
      fillings: field(x, 'fillings', null),
      prep: field(x, 'prep', null),
      ...(sheet
        ? {
            doughs: field(x, 'doughs', []),
            machine: field(x, 'machine', []),
            bread: field(x, 'bread', null),
            rolls: field(x, 'rolls', []),
            openMasterData: field(x, 'openMasterData', []),
            plan,
          }
        : {}),
    })
  return (
    pick(snapshot, sheet ? planDrift(null, snapshot.plan) : null) !==
    pick(recomputed, sheet ? field(recomputed, 'planDrift', null) : null)
  )
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
  linesForDeltas,
  linesWithExtras,
  machineDeltaExtras,
  bruchDeltaExtras,
  planOfSnapshot,
  prepWithDeltas,
  hefeteigFillingsDiff,
  isSheetSnapshot,
  planDrift,
  stableJson,
  snapshotDiffers,
  prepDateFor,
}
