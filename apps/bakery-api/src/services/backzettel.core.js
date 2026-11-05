// Backzettel: die Tagesrechnung (roadmap §5.4), genau einmal.
//
// Dependency-freies CommonJS wie `partner-stats.core.js`. Die echte API
// (Z3), der Druck und die Tests rechnen alle hiermit; keine zweite
// Implementierung anlegen.
//
//   line(item, variant, d) = max(0,
//       ceil(base(item, weekday(d), variant) × season(d))
//     + ceil(Σ preorders(products of item × factor, variant, pickup = d))
//     + ceil(Σ capTemplate(products of item × factor, weekday(d)))
//     + correction(item, variant, d))
//
// Viertel (factor 0.25) werden je Zeile erst summiert und dann aufgerundet:
// drei bestellte Viertel Kranz sind ein Kranz, nicht drei.
//
// Hefeteig (Samstag zuerst): Teigstuecke = Σ Zeile × Stuecke je Produkt,
// Teig g = Σ Stuecke × Stueckgewicht je Teig, Chargen = ceil(Teig / Charge),
// dazu eine Abwiegeliste je Stueckgewicht. Fuellungen: g je Fuellung =
// Σ Zeile(Variante) × filling_g; das Grundrezept wird auf diese Menge
// skaliert (10-g-Schritte). Das ist die Logik des frueheren
// `HefezopfCalculator`/`FillingPreparation` aus apps/bakery-management -
// Teigstuecke und Fuellungsgramm kommen jetzt aus der YAML (der gefuellte
// Kranz, Q-B3, ist dort einstellbar, nicht hier fest verdrahtet).

const configCore = require('./backzettel-config.core')
const recipesCore = require('./backzettel-recipes.core')

const { SECTION_LABELS, INTEGER_UNITS, WEEKDAY_NAMES } = configCore

const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Blech-Angabe. DUPLIKAT von
// libs/bakery-management/feature-daily-prep/src/lib/utils/trayInfo.ts
// (TypeScript/ESM; die CommonJS-Grenze laesst sich ohne Build-Umbau nicht
// ueberbruecken - gleiche Konvention wie delivery-tours.core.js und
// @bakery/delivery/routing). Wer die Formatierung aendert, aendert beide.
// ---------------------------------------------------------------------------

const isTrayNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value)

function getTrayNumbers(item) {
  if (Array.isArray(item.tray_numbers))
    return item.tray_numbers.filter(isTrayNumber)
  return isTrayNumber(item.tray_number) ? [item.tray_number] : []
}

/** "Blech 5", "Bleche 11, 12, 13", "3 Bleche à 5 (Bleche 11, 12, 13)" oder null. */
function formatTrayInfo(item) {
  const trays = getTrayNumbers(item || {})
  if (trays.length === 0) return null
  const list =
    trays.length === 1 ? `Blech ${trays[0]}` : `Bleche ${trays.join(', ')}`
  if (trays.length > 1 && isTrayNumber(item.trays_of) && item.trays_of > 0) {
    return `${trays.length} Bleche à ${item.trays_of} (${list})`
  }
  return list
}

/** Blech-Angabe aus dem YAML-Format `tray: { no, per_tray }`. */
function trayText(tray) {
  if (!tray || !Array.isArray(tray.no)) return null
  return tray.no.length === 1
    ? formatTrayInfo({ tray_number: tray.no[0] })
    : formatTrayInfo({ tray_numbers: tray.no, trays_of: tray.per_tray })
}

// ---------------------------------------------------------------------------
// Datum, Runden
// ---------------------------------------------------------------------------

function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  )
}

/** ISO-Wochentag (1 = Montag ... 7 = Sonntag) eines `YYYY-MM-DD`. */
function isoWeekday(date) {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

function round2(x) {
  return Math.round(x * 100) / 100
}

/**
 * Aufrunden je Einheit: Stueck/Blech auf ganze Zahlen, Liter/kg auf 0,01.
 * Mit Toleranz, damit 10 × 1.1 = 11.000000000000002 nicht 12 ergibt.
 */
function roundUp(x, unit) {
  if (!Number.isFinite(x)) return 0
  const r = INTEGER_UNITS.has(unit)
    ? Math.ceil(x - EPSILON)
    : Math.ceil(x * 100 - 1e-6) / 100
  return r === 0 ? 0 : r // kein -0 (Math.ceil(-1e-9) ist -0)
}

function tidy(x, unit) {
  return INTEGER_UNITS.has(unit) ? Math.round(x) : round2(x)
}

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

function ensureNormalized(config) {
  return config && config.__normalized
    ? config
    : markNormalized(configCore.normalizeConfig(config))
}

function markNormalized(cfg) {
  Object.defineProperty(cfg, '__normalized', { value: true, enumerable: false })
  return cfg
}

/**
 * Macht aus Vorbestellungen (`{id, date, status, items:[{productId, qty, variant}]}`)
 * die flache Liste, die `computeDay` erwartet.
 */
function flattenPreorders(preorders) {
  const out = []
  for (const p of Array.isArray(preorders) ? preorders : []) {
    if (!p) continue
    for (const item of Array.isArray(p.items) ? p.items : []) {
      out.push({
        preorderId: p.id === undefined ? null : p.id,
        pickupDate: p.pickupDate || p.date,
        status: p.status,
        productId: item.productSlug || item.productId,
        variant: item.variant === undefined ? null : item.variant,
        qty: item.qty === undefined ? item.quantity : item.qty,
      })
    }
  }
  return out
}

function productIndex(cfg) {
  const index = new Map()
  for (const item of cfg.items) {
    for (const p of item.products)
      index.set(String(p.id), { item, factor: p.factor })
  }
  return index
}

function numericIndex(catalog) {
  const map = new Map()
  for (const p of Array.isArray(catalog) ? catalog : []) {
    if (p && p.numeric_id !== undefined && p.numeric_id !== null && p.id) {
      map.set(String(p.numeric_id), String(p.id))
    }
  }
  return map
}

function lineKey(itemId, variant) {
  return `${itemId}|${variant || ''}`
}

/**
 * Loest eine Produkt-ID (hq-Slug oder numerische ID aus dem Katalog) zu
 * Posten und Faktor auf. Einzige Stelle dafuer: `computeDay`,
 * `computePreorderDeltas` und `variantsForProduct` benutzen sie.
 * @returns {(productId: unknown) => ({item: object, factor: number} | null)}
 */
function createProductResolver(config, catalog) {
  const cfg = ensureNormalized(config)
  const products = productIndex(cfg)
  const numeric = numericIndex(catalog)
  return (raw) => {
    if (raw === undefined || raw === null) return null
    const key = String(raw)
    if (products.has(key)) return products.get(key)
    const slug = numeric.get(key)
    return slug && products.has(slug) ? products.get(slug) : null
  }
}

/**
 * Welcher Posten, welcher Faktor und welche Varianten gehoeren zu einem
 * Produkt? Fuer die Pruefung von `preorder_items.variant` (B7, roadmap §5.3):
 * `variants` leer heisst, das Produkt nimmt keine Variante an.
 * @returns {{itemId:string, name:string, unit:string, factor:number, variants:string[]} | null}
 */
function variantsForProduct(config, productId, catalog) {
  const hit = createProductResolver(config, catalog)(productId)
  if (!hit) return null
  return {
    itemId: hit.item.id,
    name: hit.item.name,
    unit: hit.item.unit,
    factor: hit.factor,
    variants: [...hit.item.variants],
  }
}

/** `null`/`''`/unbekannt -> `null`; sonst die Variante. Ohne Warnungen. */
function cleanVariant(item, variant) {
  const v = variant === undefined || variant === '' ? null : variant
  if (v === null || item.variants.length === 0) return null
  return item.variants.includes(v) ? v : null
}

/** Akzeptiert flache Positionen oder Vorbestellungen mit `items`. */
function asPreorderItems(list) {
  const arr = Array.isArray(list) ? list : []
  return arr.some((p) => p && Array.isArray(p.items))
    ? flattenPreorders(arr)
    : arr
}

/** Zaehlt eine Position fuer `date`? (nicht storniert, Menge > 0, Abholtag) */
function countablePreorderQty(raw, date) {
  if (!raw || raw.status === 'cancelled') return null
  if ((raw.pickupDate || raw.date) !== date) return null
  const qty = Number(raw.qty === undefined ? raw.quantity : raw.qty)
  return Number.isFinite(qty) && qty > 0 ? qty : null
}

// ---------------------------------------------------------------------------
// Tagesrechnung
// ---------------------------------------------------------------------------

/**
 * Rechnet den Backzettel eines Tages.
 *
 * @param {object} args
 * @param {object} args.config Stammdaten (roh oder normalisiert, vorher geprueft).
 * @param {string} args.date Produktionstag `YYYY-MM-DD`.
 * @param {Array} [args.preorderItems] flach: `{productId|productSlug, qty|quantity,
 *   variant?, pickupDate|date, status?}`; siehe `flattenPreorders`.
 * @param {object|Array} [args.capTemplate] CAP-Liefervorlage(n)
 *   `{weekday, active, items:[{productSlug|productId, quantity}]}`.
 * @param {Array} [args.corrections] `{itemId, variant?, qty, reason?}`.
 * @param {number} [args.seasonFactor=1] Saisonfaktor (D10: Standard 1.0).
 * @param {object} [args.recipes] geparste Fuellungsrezepte je Fuellungs-ID.
 * @param {Array} [args.catalog] hq-Produkte `{id, numeric_id}`, um numerische IDs aufzuloesen.
 * @param {boolean} [args.includeEmpty=false] auch Zeilen ohne jede Menge liefern.
 */
function computeDay(args) {
  const a = args || {}
  const date = a.date
  if (!isValidDate(date)) {
    return {
      error: 'invalid_date',
      message: `Ungültiges Datum ${JSON.stringify(
        date
      )}; erwartet wird JJJJ-MM-TT.`,
    }
  }
  const cfg = ensureNormalized(a.config)
  const weekday = isoWeekday(date)
  const warnings = []

  let seasonFactor =
    a.seasonFactor === undefined || a.seasonFactor === null
      ? 1
      : Number(a.seasonFactor)
  if (!Number.isFinite(seasonFactor) || seasonFactor <= 0) {
    warnings.push({
      code: 'invalid_season_factor',
      message: `Saisonfaktor ${JSON.stringify(
        a.seasonFactor
      )} ist ungültig; gerechnet wird mit 1,0.`,
    })
    seasonFactor = 1
  }

  const open = cfg.days.includes(weekday)
  const resolveProduct = createProductResolver(cfg, a.catalog)
  const itemsById = new Map(cfg.items.map((i) => [i.id, i]))

  // Sammeltöpfe je Zeile: exakte (ungerundete) Summen
  const acc = new Map()
  const bucket = (item, variant) => {
    const key = lineKey(item.id, variant)
    let b = acc.get(key)
    if (!b) {
      b = { preorders: 0, cap: 0, correction: 0, reasons: [], preorderIds: [] }
      acc.set(key, b)
    }
    return b
  }

  const resolveVariant = (item, variant, source) => {
    const v = variant === undefined || variant === '' ? null : variant
    if (item.variants.length === 0) {
      if (v !== null) {
        warnings.push({
          code: 'variant_ignored',
          itemId: item.id,
          variant: v,
          message: `„${item.name}“ hat keine Varianten; „${v}“ (${source}) wird ohne Variante gezählt.`,
        })
      }
      return null
    }
    if (v === null) return null
    if (item.variants.includes(v)) return v
    warnings.push({
      code: 'unknown_variant',
      itemId: item.id,
      variant: v,
      message: `„${item.name}“ kennt die Variante „${v}“ nicht (${source}); gezählt unter „ohne Angabe“.`,
    })
    return null
  }

  // Vorbestellungen
  const unmatched = new Map()
  let preordersOnClosedDay = 0
  for (const raw of asPreorderItems(a.preorderItems)) {
    const qty = countablePreorderQty(raw, date)
    if (qty === null) continue
    const productId = raw.productSlug || raw.productId
    const hit = resolveProduct(productId)
    if (!hit) {
      const k = String(productId)
      unmatched.set(k, (unmatched.get(k) || 0) + qty)
      continue
    }
    if (!open) {
      preordersOnClosedDay += qty
      continue
    }
    const b = bucket(
      hit.item,
      resolveVariant(hit.item, raw.variant, 'Vorbestellung')
    )
    b.preorders += qty * hit.factor
    if (
      raw.preorderId !== undefined &&
      raw.preorderId !== null &&
      !b.preorderIds.includes(raw.preorderId)
    ) {
      b.preorderIds.push(raw.preorderId)
    }
  }
  for (const [productId, qty] of unmatched) {
    warnings.push({
      code: 'unmapped_product',
      productId,
      qty,
      message: `Vorbestelltes Produkt „${productId}“ (${qty}) gehört zu keinem Backzettel-Posten.`,
    })
  }
  if (preordersOnClosedDay > 0) {
    warnings.push({
      code: 'preorders_on_closed_day',
      qty: preordersOnClosedDay,
      message: `${WEEKDAY_NAMES[weekday]} ist kein Produktionstag, es liegen aber Vorbestellungen vor.`,
    })
  }

  // CAP-Liefervorlage
  const templates = Array.isArray(a.capTemplate)
    ? a.capTemplate
    : a.capTemplate
    ? [a.capTemplate]
    : []
  if (open) {
    for (const t of templates) {
      if (!t || t.active === false || Number(t.weekday) !== weekday) continue
      for (const raw of Array.isArray(t.items) ? t.items : []) {
        const qty = Number(
          raw && raw.quantity !== undefined ? raw.quantity : raw && raw.qty
        )
        if (!Number.isFinite(qty) || qty <= 0) continue
        const productId = raw.productSlug || raw.productId
        const hit = resolveProduct(productId)
        if (!hit) {
          warnings.push({
            code: 'unmapped_cap_product',
            productId: String(productId),
            qty,
            message: `CAP-Produkt „${productId}“ (${qty}) gehört zu keinem Backzettel-Posten.`,
          })
          continue
        }
        bucket(hit.item, null).cap += qty * hit.factor
      }
    }
  }

  // Korrekturen
  if (open) {
    for (const c of Array.isArray(a.corrections) ? a.corrections : []) {
      if (!c) continue
      const item = itemsById.get(c.itemId)
      const qty = Number(c.qty)
      if (!item) {
        warnings.push({
          code: 'unknown_correction',
          itemId: c.itemId,
          message: `Korrektur für unbekannten Posten „${c.itemId}“ wird ignoriert.`,
        })
        continue
      }
      if (!Number.isFinite(qty)) continue
      const variant =
        c.variant === undefined || c.variant === '' ? null : c.variant
      if (variant !== null && !item.variants.includes(variant)) {
        warnings.push({
          code: 'unknown_correction',
          itemId: c.itemId,
          variant,
          message: `Korrektur für „${item.name}“, Variante „${variant}“, wird ignoriert - die Variante gibt es nicht.`,
        })
        continue
      }
      const b = bucket(item, variant)
      b.correction += qty
      if (typeof c.reason === 'string' && c.reason.trim())
        b.reasons.push(c.reason.trim())
    }
  }

  // Zeilen. `null` als Grundmenge heisst „noch nicht festgelegt“ (anders als
  // 0 = „wird nicht gebacken“): die Zeile erscheint mit `baseUnset: true`,
  // auch ohne Menge, und es gibt eine Warnung `base_unset`.
  const lines = []
  const unset = []
  if (open) {
    for (const item of cfg.items) {
      const hasDay = Object.prototype.hasOwnProperty.call(item.base, weekday)
      const baseDay = item.base[weekday]
      const variants =
        item.variants.length > 0 ? [...item.variants, null] : [null]
      for (const variant of variants) {
        let base = 0
        let baseUnset = false
        if (hasDay && baseDay === null) {
          // ganzer Tag offen: bei Varianten jede Variante, sonst die Zeile
          baseUnset = item.variants.length === 0 || variant !== null
        } else if (baseDay !== undefined && baseDay !== null) {
          if (typeof baseDay === 'object') {
            if (variant !== null) {
              const v = baseDay[variant]
              if (v === null) baseUnset = true
              else base = Number(v) || 0
            }
          } else if (variant === null) {
            base = Number(baseDay) || 0
          }
        }
        if (baseUnset)
          unset.push(variant ? `${item.name} (${variant})` : item.name)
        const b = acc.get(lineKey(item.id, variant)) || {
          preorders: 0,
          cap: 0,
          correction: 0,
          reasons: [],
          preorderIds: [],
        }
        const seasoned = roundUp(base * seasonFactor, item.unit)
        const preorders = roundUp(b.preorders, item.unit)
        const cap = roundUp(b.cap, item.unit)
        const correction = tidy(b.correction, item.unit)
        const empty =
          base === 0 && preorders === 0 && cap === 0 && correction === 0
        if (empty && !baseUnset && !a.includeEmpty) continue
        const total = Math.max(
          0,
          tidy(seasoned + preorders + cap + correction, item.unit)
        )
        const line = {
          key: lineKey(item.id, variant),
          itemId: item.id,
          name: item.name,
          section: item.section,
          unit: item.unit,
          variant,
          base,
          baseUnset,
          seasonal: tidy(seasoned - base, item.unit),
          preorders,
          preordersExact: round2(b.preorders),
          preorderIds: b.preorderIds,
          cap,
          correction,
          correctionReason: b.reasons.length ? b.reasons.join('; ') : null,
          total,
          tray: trayText(item.tray),
          plu: item.plu,
        }
        if (item.unit === 'Liter' && item.pieces_per_liter) {
          line.loavesEstimate = Math.round(total * item.pieces_per_liter)
        }
        lines.push(line)
      }
    }
  }

  if (unset.length > 0) {
    warnings.push({
      code: 'base_unset',
      items: unset,
      message: `Grundmenge für ${
        WEEKDAY_NAMES[weekday]
      } noch nicht festgelegt: ${unset.join(', ')}.`,
    })
  }

  const sections = cfg.sections
    .map((id) => ({
      id,
      label: SECTION_LABELS[id] || id,
      lines: lines.filter((l) => l.section === id),
    }))
    .filter((s) => s.lines.length > 0)
  // Zeilen in Abschnittsreihenfolge
  const ordered = sections.flatMap((s) => s.lines)

  const hefeteig = computeHefeteig(cfg, ordered)
  const fillings = computeFillings(cfg, ordered, a.recipes || {}, warnings)
  const prep = open ? computePrep(cfg, ordered, weekday) : []

  return {
    date,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday],
    open,
    seasonFactor,
    sections,
    lines: ordered,
    hefeteig,
    fillings,
    prep,
    warnings,
  }
}

/**
 * Hefeteig-Zusammenfassung: Teigstuecke, Teiggewicht, Chargen und eine
 * Abwiegeliste je Teig und Stueckgewicht.
 */
function computeHefeteig(cfg, lines) {
  const itemsById = new Map(cfg.items.map((i) => [i.id, i]))
  const byDough = new Map()
  for (const line of lines) {
    const item = itemsById.get(line.itemId)
    if (!item || !item.dough || !(line.total > 0)) continue
    const dough = cfg.doughs.find((d) => d.id === item.dough.id) || {
      id: item.dough.id,
      name: item.dough.id,
      batch_max_kg: null,
    }
    let entry = byDough.get(dough.id)
    if (!entry) {
      entry = {
        id: dough.id,
        name: dough.name,
        batch_max_kg: dough.batch_max_kg,
        pieces: 0,
        dough_g: 0,
        batches: null,
        weights: new Map(),
      }
      byDough.set(dough.id, entry)
    }
    const pieces = line.total * item.dough.pieces
    entry.pieces += pieces
    entry.dough_g += pieces * item.dough.piece_g
    let w = entry.weights.get(item.dough.piece_g)
    if (!w) {
      w = { piece_g: item.dough.piece_g, pieces: 0, items: new Map() }
      entry.weights.set(item.dough.piece_g, w)
    }
    w.pieces += pieces
    const wi = w.items.get(item.id) || {
      itemId: item.id,
      name: item.name,
      products: 0,
      piecesPerProduct: item.dough.pieces,
      pieces: 0,
    }
    wi.products += line.total
    wi.pieces += pieces
    w.items.set(item.id, wi)
  }
  const doughs = cfg.doughs
    .map((d) => d.id)
    .concat(
      [...byDough.keys()].filter((id) => !cfg.doughs.some((d) => d.id === id))
    )
    .filter((id) => byDough.has(id))
    .map((id) => {
      const e = byDough.get(id)
      return {
        id: e.id,
        name: e.name,
        batch_max_kg: e.batch_max_kg,
        pieces: e.pieces,
        dough_g: e.dough_g,
        batches: e.batch_max_kg
          ? Math.ceil(e.dough_g / (e.batch_max_kg * 1000) - EPSILON)
          : null,
        weighing: [...e.weights.values()]
          .sort((x, y) => y.piece_g - x.piece_g)
          .map((w) => ({
            piece_g: w.piece_g,
            pieces: w.pieces,
            items: [...w.items.values()],
          })),
      }
    })
  return {
    doughs,
    pieces: doughs.reduce((s, d) => s + d.pieces, 0),
    dough_g: doughs.reduce((s, d) => s + d.dough_g, 0),
  }
}

/**
 * Fuellungsbedarf je Fuellung (= Variante) und das darauf skalierte Rezept.
 */
function computeFillings(cfg, lines, recipes, warnings) {
  const itemsById = new Map(cfg.items.map((i) => [i.id, i]))
  const byFilling = new Map()
  for (const line of lines) {
    const item = itemsById.get(line.itemId)
    if (!item || !item.filling_g || !(line.total > 0)) continue
    if (line.variant === null) {
      warnings.push({
        code: 'filling_unassigned',
        itemId: item.id,
        qty: line.total,
        message: `${line.total} × „${item.name}“ ohne Füllungsangabe - nicht im Füllungsbedarf enthalten.`,
      })
      continue
    }
    const perPiece = item.filling_g[line.variant]
    let entry = byFilling.get(line.variant)
    if (!entry) {
      const f = cfg.fillings.find((x) => x.id === line.variant)
      entry = {
        id: line.variant,
        name: f ? f.name : line.variant,
        grams: 0,
        missingFillingG: false,
        items: [],
      }
      byFilling.set(line.variant, entry)
    }
    const grams = perPiece ? line.total * perPiece : null
    if (grams === null) entry.missingFillingG = true
    else entry.grams += grams
    entry.items.push({
      itemId: item.id,
      name: item.name,
      pieces: line.total,
      filling_g: perPiece || null,
      grams,
    })
  }
  const order = cfg.fillings.map((f) => f.id)
  return [...byFilling.values()]
    .sort((x, y) => {
      const ix = order.indexOf(x.id)
      const iy = order.indexOf(y.id)
      return (ix === -1 ? Infinity : ix) - (iy === -1 ? Infinity : iy)
    })
    .map((e) => {
      const recipe = recipes[e.id] || null
      return {
        ...e,
        recipe:
          recipe && e.grams > 0
            ? recipesCore.scaleRecipe(recipe, e.grams)
            : null,
        recipeMissing: !recipe,
      }
    })
}

/**
 * Vorbereitungen fuer den Produktionstag (erledigt am Vortag um 14 Uhr).
 * `by_weekday` waehlt die Variante (`default` sonst; `null`/`false` = nicht
 * an diesem Tag), `when_item` nur wenn der Posten an dem Tag gebacken wird,
 * `days` beschraenkt auf Wochentage.
 */
function computePrep(cfg, lines, weekday) {
  const itemTotals = new Map()
  for (const l of lines)
    itemTotals.set(l.itemId, (itemTotals.get(l.itemId) || 0) + l.total)
  const out = []
  for (const task of cfg.prep) {
    if (task.days && !task.days.includes(weekday)) continue
    let variant = null
    if (task.by_weekday) {
      if (Object.prototype.hasOwnProperty.call(task.by_weekday, weekday))
        variant = task.by_weekday[weekday]
      else if (Object.prototype.hasOwnProperty.call(task.by_weekday, 'default'))
        variant = task.by_weekday.default
      else continue
      if (variant === null) continue
    }
    if (task.when_item && !(itemTotals.get(task.when_item) > 0)) continue
    out.push({ id: task.id, name: task.name, variant, note: task.note })
  }
  return out
}

/**
 * Vorbestellungs-Deltas nach der Freigabe (roadmap §5.3/§5.4): je
 * Vorbestellung × Posten × Variante, wie viel sich gegenueber dem Stand bei
 * der Freigabe geaendert hat - in Posten-Einheiten (Viertel = 0,25).
 *
 * Die Grundlage sind die Vorbestellungen selbst, nicht die Zeilensummen:
 * eine neue Viertel-Bestellung, die in der Aufrundung verschwindet, oder
 * eine neue Bestellung plus eine gleich grosse Stornierung aendern keine
 * Gesamtmenge, sind aber trotzdem Deltas. Nie still zusammengefuehrt.
 *
 * Z3 speichert bei der Freigabe die (flachen) Vorbestellungspositionen des
 * Tages als `before`; jede Zeile des Ergebnisses passt 1:1 auf
 * `backzettel_deltas` (date, item_id, variant, qty, preorder_id).
 *
 * @param {object} args
 * @param {object} args.config Stammdaten.
 * @param {string} args.date Produktionstag.
 * @param {Array} args.before Positionen zum Zeitpunkt der Freigabe.
 * @param {Array} args.after Positionen jetzt (flach oder `{id, items}`).
 * @param {Array} [args.catalog] hq-Produkte fuer numerische IDs.
 * @returns {Array<{key, itemId, name, unit, variant, preorderId, before, after, qty, kind}>}
 *   `kind`: `added` (vorher 0), `cancelled` (jetzt 0) oder `changed`.
 */
function computePreorderDeltas(args) {
  const a = args || {}
  if (!isValidDate(a.date)) return []
  const cfg = ensureNormalized(a.config)
  if (!cfg.days.includes(isoWeekday(a.date))) return []
  const resolve = createProductResolver(cfg, a.catalog)

  const sum = (list) => {
    const out = new Map()
    for (const raw of asPreorderItems(list)) {
      const qty = countablePreorderQty(raw, a.date)
      if (qty === null) continue
      const hit = resolve(raw.productSlug || raw.productId)
      if (!hit) continue // unbekannte Produkte meldet computeDay
      const variant = cleanVariant(hit.item, raw.variant)
      const preorderId =
        raw.preorderId === undefined || raw.preorderId === null
          ? null
          : raw.preorderId
      const k = `${String(preorderId)}#${lineKey(hit.item.id, variant)}`
      const e = out.get(k) || { item: hit.item, variant, preorderId, qty: 0 }
      e.qty += qty * hit.factor
      out.set(k, e)
    }
    return out
  }

  const before = sum(a.before)
  const after = sum(a.after)
  const keys = [
    ...after.keys(),
    ...[...before.keys()].filter((k) => !after.has(k)),
  ]
  const deltas = []
  for (const k of keys) {
    const b = before.get(k)
    const n = after.get(k)
    const ref = n || b
    const qtyBefore = b ? round2(b.qty) : 0
    const qtyAfter = n ? round2(n.qty) : 0
    const qty = round2(qtyAfter - qtyBefore)
    if (qty === 0) continue
    deltas.push({
      key: lineKey(ref.item.id, ref.variant),
      itemId: ref.item.id,
      name: ref.item.name,
      unit: ref.item.unit,
      variant: ref.variant,
      preorderId: ref.preorderId,
      before: qtyBefore,
      after: qtyAfter,
      qty,
      kind:
        qtyBefore === 0 ? 'added' : qtyAfter === 0 ? 'cancelled' : 'changed',
    })
  }
  return deltas
}

/**
 * Zeilen-Vergleich zwischen dem freigegebenen und dem neu gerechneten
 * Zettel, als Zusatzinformation fuer die Anzeige. Gemeldet wird eine Zeile,
 * wenn sich `total` geaendert hat ODER sich ihre Vorbestellungen geaendert
 * haben (`preordersExact`, `preorderIds`) - auch wenn die Gesamtmenge gleich
 * bleibt (Viertel in der Aufrundung, Neu + Storno). Die Deltas je
 * Vorbestellung liefert `computePreorderDeltas`.
 */
function computeDeltas(confirmedLines, newLines) {
  const before = new Map()
  for (const l of Array.isArray(confirmedLines) ? confirmedLines : []) {
    if (l) before.set(l.key || lineKey(l.itemId, l.variant), l)
  }
  const after = new Map()
  for (const l of Array.isArray(newLines) ? newLines : []) {
    if (l) after.set(l.key || lineKey(l.itemId, l.variant), l)
  }
  const keys = [
    ...after.keys(),
    ...[...before.keys()].filter((k) => !after.has(k)),
  ]
  const fields = ['base', 'seasonal', 'preorders', 'cap', 'correction']
  const ids = (l) => (l && Array.isArray(l.preorderIds) ? l.preorderIds : [])
  const deltas = []
  for (const key of keys) {
    const b = before.get(key)
    const n = after.get(key)
    const ref = n || b
    const totalBefore = b ? Number(b.total) || 0 : 0
    const totalAfter = n ? Number(n.total) || 0 : 0
    const qty = round2(totalAfter - totalBefore)
    const idsBefore = ids(b)
    const idsAfter = ids(n)
    const preorderIdsAdded = idsAfter.filter((id) => !idsBefore.includes(id))
    const preorderIdsRemoved = idsBefore.filter((id) => !idsAfter.includes(id))
    const exactDelta = round2(
      (n ? Number(n.preordersExact) || 0 : 0) -
        (b ? Number(b.preordersExact) || 0 : 0)
    )
    if (
      qty === 0 &&
      exactDelta === 0 &&
      preorderIdsAdded.length === 0 &&
      preorderIdsRemoved.length === 0
    )
      continue
    const changes = {}
    for (const f of fields) {
      const d = round2(
        (n ? Number(n[f]) || 0 : 0) - (b ? Number(b[f]) || 0 : 0)
      )
      if (d !== 0) changes[f] = d
    }
    deltas.push({
      key,
      itemId: ref.itemId,
      name: ref.name,
      variant: ref.variant === undefined ? null : ref.variant,
      unit: ref.unit,
      before: totalBefore,
      after: totalAfter,
      qty,
      changes,
      preordersExact: exactDelta,
      preorderIdsAdded,
      preorderIdsRemoved,
    })
  }
  return deltas
}

module.exports = {
  computeDay,
  computeDeltas,
  computePreorderDeltas,
  createProductResolver,
  variantsForProduct,
  computeHefeteig,
  computeFillings,
  computePrep,
  flattenPreorders,
  formatTrayInfo,
  getTrayNumbers,
  trayText,
  isoWeekday,
  isValidDate,
  roundUp,
  lineKey,
}
