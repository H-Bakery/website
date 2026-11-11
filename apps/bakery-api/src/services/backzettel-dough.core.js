// Backzettel v2 (Z10): Teige, Liter, Bruch (docs/backzettel-v2.md §3, §4.3).
//
// Dependency-freies CommonJS wie `backzettel.core.js`. Die Teigrechnung steht
// genau einmal hier; `computeDoughDay` (backzettel.core.js), die API und die
// Tests rechnen damit. Die Verwaltung rechnet nichts nach.
//
//   Teig kg   = Σ Teile: Laibe × Teig je Laib (Größen), Brüche × Bruchgewicht,
//               Stück × Teigstücke × Gramm (Einzelstücke), Anteil aus
//               `from_dough` (fest je Ansatz oder je Teig)
//   Liter     = kg ÷ kg je Liter, gerundet nach `liter_rounding`
//   Gemeinsam = Σ der genauen Liter der Mitglieder, Rundung des Kopfes
//   Zugabe g  = g je Liter × genaue Liter des eigenen Teigs
//   Chargen   = ⌈kg ÷ Chargengröße⌉
//   Brüche    = ⌈Teigstücke ÷ Stück je Bruch⌉, frei = Brüche × Stück − Teigstücke
//   Zugabe je Bruch g = Brüche × g je Bruch (`bruch.addons`, kommt AUF das
//               Bruchgewicht, zählt nicht zu kg/Liter des Teigs)
//
// Unbekannt (`null`) bleibt unbekannt: ein Teil ohne Gewicht macht den Teig
// unvollständig (`kg: null`, `kgKnown` = Summe der bekannten Teile,
// `complete: false`, `missing` nennt den Teil); ohne kg je Liter gibt es keine
// Liter, ohne Rundung nur die genauen Liter. Nichts wird geschätzt oder zu 0.

const configCore = require('./backzettel-config.core')

const { WEEKDAY_NAMES } = configCore

const EPSILON = 1e-9

function round(x, digits) {
  const f = 10 ** digits
  const r = Math.round(x * f) / f
  return r === 0 ? 0 : r
}
const round1 = (x) => round(x, 1)
const round2 = (x) => round(x, 2)
const round3 = (x) => round(x, 3)

function isoWeekday(date) {
  const [y, m, d] = String(date).split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * Rundet `x` auf Schritte `{ step, mode }` (`up` = auf, `down` = ab,
 * `nearest` = kaufmännisch), mit Toleranz: 10 × 1,1 L wird nicht zu 11,5.
 * Ohne Rundung oder ohne Zahl `null`.
 */
function roundTo(x, rounding) {
  if (!isNum(x) || !rounding || !(rounding.step > 0)) return null
  const q = x / rounding.step
  let n
  if (rounding.mode === 'up') n = Math.ceil(q - EPSILON)
  else if (rounding.mode === 'down') n = Math.floor(q + EPSILON)
  else if (rounding.mode === 'nearest') n = Math.floor(q + 0.5 + EPSILON)
  else return null
  const r = round(n * rounding.step, 6)
  return r === 0 ? 0 : r
}

/**
 * Liter eines Teigs aus seinen kg (Regel 2): nur mit vollständigen kg und
 * kg je Liter. `exact` auf 0,01 L; `rounded` nach `rounding` (Standard: die
 * des Teigs) oder `null` mit `rounding_unknown`.
 * @returns {{exact: number|null, rounded: number|null, reason: string|null}}
 */
function litersFor(dough, kg, rounding) {
  const raw = rawLiters(dough, kg)
  if (raw === null) {
    return {
      exact: null,
      rounded: null,
      reason: !isNum(kg) ? 'dough_incomplete' : 'kg_per_liter_unknown',
    }
  }
  return litersFromRaw(
    raw,
    rounding === undefined ? dough.liter_rounding : rounding
  )
}

/** Ungerundete Liter (kg ÷ kg je Liter) oder `null`. */
function rawLiters(dough, kg) {
  const kpl = dough ? dough.kg_per_liter : null
  if (!isNum(kg) || !isNum(kpl) || kpl <= 0) return null
  return kg / kpl
}

/**
 * Liter aus dem ungerundeten Quotienten: gerundet wird von dort, nicht von
 * der 2-stelligen Anzeige - sonst wird 6,01 kg ÷ 3 (2,0033 L) „auf 0,5 L
 * aufgerundet“ zu 2 statt 2,5. `exact` ist nur die Anzeige (0,01 L).
 */
function litersFromRaw(raw, rounding) {
  const rounded = roundTo(round(raw, 9), rounding)
  // Eine kleine Menge unter der Rundungsstufe (1,2 kg Hefeteig ÷ 4 = 0,3 L,
  // „auf ganze Liter“ → 0) ist nicht „0 L“: die Rundung gilt für die großen
  // Ansätze. Dann stehen nur die genauen Liter da (`below_rounding_step`).
  if (rounded === 0 && raw > EPSILON) {
    return {
      exact: round2(raw),
      rounded: null,
      reason: 'below_rounding_step',
      step: rounding.step,
    }
  }
  return {
    exact: round2(raw),
    rounded,
    reason: rounded === null ? 'rounding_unknown' : null,
  }
}

/**
 * Zugaben eines Teigs (Regel 4, z. B. Sauer): g je Liter × genaue
 * (ungerundete) Liter des Teigs - nicht der gerundeten Literzahl einer Gruppe.
 */
function addonsFor(dough, rawLitersOfDough) {
  const exactLiters = rawLitersOfDough
  return ((dough && dough.addons) || []).map((a) => {
    const base = {
      id: a.id,
      name: a.name,
      doughId: dough.id,
      g_per_liter: isNum(a.g_per_liter) ? a.g_per_liter : null,
    }
    if (base.g_per_liter === null) {
      return { ...base, grams: null, reason: 'g_per_liter_unknown' }
    }
    if (!isNum(exactLiters)) {
      return { ...base, grams: null, reason: 'liters_unknown' }
    }
    const grams = base.g_per_liter * exactLiters
    const exact = round1(grams)
    const rounded = roundTo(round(grams, 9), a.rounding)
    // wie bei den Litern: nie „0 g“ für eine Menge unter der Rundungsstufe
    if (rounded === 0 && grams > EPSILON) {
      return {
        ...base,
        grams: { exact, rounded: null },
        reason: 'below_rounding_step',
      }
    }
    return {
      ...base,
      grams: { exact, rounded },
      reason: rounded === null ? 'rounding_unknown' : null,
    }
  })
}

/** Chargen (Regel 5): nur mit bekannten kg und bekannter Chargengröße. */
function batchesFor(kg, batchMaxKg) {
  return isNum(kg) && isNum(batchMaxKg) && batchMaxKg > 0
    ? Math.ceil(kg / batchMaxKg - EPSILON)
    : null
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function itemIndex(cfg) {
  const map = new Map()
  cfg.items.forEach((item, i) => map.set(item.id, { item, index: i }))
  return map
}

function lineBakeDate(line, sheetDate) {
  return line && typeof line.bakeDate === 'string' && line.bakeDate
    ? line.bakeDate
    : sheetDate
}

function lineLabel(line) {
  const v =
    line.variantLabel ||
    (line.variant
      ? String(line.variant).charAt(0).toUpperCase() +
        String(line.variant).slice(1)
      : null)
  return v ? `${line.name} – ${v}` : line.name
}

/**
 * Tagesentscheidung an einer Zeile mit offener Grundmenge: `'amount'` = die
 * Menge für heute steht als Korrektur da, `'none'` = „Heute keine“
 * (`noneToday`, ausdrücklich gesetzt - eine Korrektur 0 allein heißt nur
 * „keine Korrektur“). `null`: nichts entschieden oder Grundmenge nicht offen.
 * Die Grundmenge selbst bleibt offen; nichts wird still zu 0.
 */
function dayDecision(line) {
  if (!line || !line.baseUnset) return null
  if (Number(line.correction)) return 'amount'
  return line.noneToday === true ? 'none' : null
}

/** `{ dayDecision }` für Zeilen, Zellen und Bruch-Mitglieder - fehlt ohne. */
function dayDecisionField(line) {
  const d = dayDecision(line)
  return d ? { dayDecision: d } : {}
}

/** Menge der Zeile unbekannt: Grundmenge offen und am Tag nichts entschieden. */
function qtyUnknown(line) {
  return Boolean(line && line.baseUnset) && dayDecision(line) === null
}

function baseUnsetMissing(line) {
  return {
    itemId: line.itemId,
    name: line.name,
    field: 'base',
    code: 'base_unset',
    path: null,
    message: `„${lineLabel(line)}“: Grundmenge ist noch nicht festgelegt.`,
  }
}

/** Zählt die Zeile für den Teig? (Menge > 0 oder Menge unbekannt) */
function counts(line) {
  return Number(line.total) > 0 || qtyUnknown(line)
}

function isSizeItem(item) {
  return Array.isArray(item.sizes) && item.sizes.length > 0
}

function isPieceItem(item) {
  return Boolean(item.dough) && !isSizeItem(item) && !item.bruch
}

/** Bruchgewicht eines Postens am Backtag: Wochentag, sonst `default`. */
function bruchGFor(item, weekday) {
  const g = item.bruch && item.bruch.g ? item.bruch.g : { default: null }
  if (Object.prototype.hasOwnProperty.call(g, weekday)) {
    return { g: isNum(g[weekday]) ? g[weekday] : null, key: String(weekday) }
  }
  const hasDays = Object.keys(g).some((k) => k !== 'default')
  return {
    g: isNum(g.default) ? g.default : null,
    key: hasDays ? 'default' : null,
  }
}

// ---------------------------------------------------------------------------
// Bruch
// ---------------------------------------------------------------------------

/**
 * Bruch-Gruppen je (Backtag × Gruppe) - Regeln 6, R11–R14. Mitglieder einer
 * Gruppe teilen Teig, Gewicht, Stück je Bruch und Teigtag (Validator).
 *
 * @param {object} cfg normalisierte Stammdaten
 * @param {Array} lines Zeilen (mit `bakeDate`, sonst gilt `sheetDate`)
 * @param {string} [sheetDate]
 * @returns {Array} `BruchGroup` (docs/backzettel-v2.md §4.3) plus `missing`
 */
function bruchGroups(cfg, lines, sheetDate) {
  const items = itemIndex(cfg)
  const groups = new Map()
  for (const line of Array.isArray(lines) ? lines : []) {
    const hit = items.get(line.itemId)
    if (!hit || !hit.item.bruch || !counts(line)) continue
    const { item, index } = hit
    const bakeDate = lineBakeDate(line, sheetDate)
    const key = `${bakeDate}|${item.bruch.group}`
    let g = groups.get(key)
    if (!g) {
      const weekday = bakeDate ? isoWeekday(bakeDate) : null
      const gram = bruchGFor(item, weekday)
      g = {
        key,
        group: item.bruch.group,
        doughId: item.dough ? item.dough.id : null,
        bakeDate,
        g: gram.g,
        piecesPerBruch: item.bruch.piecesPerBruch,
        pieces: 0,
        brueche: null,
        kg: null,
        spare: null,
        split: [],
        missing: [],
        _order: index,
        _gramKey: gram.key,
        _itemIndex: index,
        _weekday: weekday,
        _names: [],
        _addons: (item.bruch.addons || []).map((a, k) => ({
          name: a.name,
          gPerBruch: isNum(a.g) ? a.g : null,
          path: `items[${index}].bruch.addons[${k}].g`,
        })),
      }
      groups.set(key, g)
    }
    const perProduct = item.bruch.per_product
    const total = Number(line.total) || 0
    g.pieces += total * perProduct
    g.split.push({
      key: line.key,
      itemId: item.id,
      name: line.name,
      variant: line.variant === undefined ? null : line.variant,
      total,
      perProduct,
      doughPieces: total * perProduct,
      // Grundmenge offen: `total` ist nur das Bekannte (Vorbestellt, CAP) -
      // eine Mindestmenge („≥ 7“), nie „offen“ statt der bekannten Stücke.
      totalIsMinimum: qtyUnknown(line),
      ...dayDecisionField(line),
    })
    if (!g._names.includes(line.name)) g._names.push(line.name)
    if (qtyUnknown(line)) {
      g.missing.push(baseUnsetMissing(line))
      g._unknownQty = true
    }
  }
  const out = []
  for (const g of groups.values()) {
    const name = g._names.join(' + ')
    g.pieces = round3(g.pieces)
    // Eine Grundmenge offen (Regel 8): Brüche, kg und „frei“ sind unbekannt;
    // `bruecheKnown`/`kgKnown`/`piecesKnown` zählen nur die bekannten Mitglieder.
    g.piecesKnown = g.pieces
    g.complete = !g._unknownQty
    const per = [...new Set(g.split.map((m) => m.perProduct))]
    g.perProduct = per.length === 1 ? per[0] : null
    g.bruecheKnown = null
    g.spareProducts = null
    if (isNum(g.piecesPerBruch)) {
      const brueche = Math.ceil(g.pieces / g.piecesPerBruch - EPSILON) || 0
      g.bruecheKnown = brueche
      if (!g._unknownQty) {
        g.brueche = brueche
        g.spare = round3(brueche * g.piecesPerBruch - g.pieces)
        // „+n frei“ in Produkten, nicht in Teigstücken (Doppelweck: 2 je Stück)
        g.spareProducts =
          g.perProduct !== null
            ? Math.floor(g.spare / g.perProduct + EPSILON)
            : null
      }
    } else {
      g.missing.push({
        itemId: g.split[0].itemId,
        name,
        field: 'bruch.pieces',
        code: 'bruch_pieces_unknown',
        path:
          cfg.bruch_pieces === null || cfg.bruch_pieces === undefined
            ? 'bruch_pieces'
            : `items[${g._itemIndex}].bruch.pieces`,
        message: `„${name}“: Stück je Bruch sind noch offen – Brüche werden nicht berechnet.`,
      })
    }
    if (g.g === null) {
      g.missing.push({
        itemId: g.split[0].itemId,
        name,
        field: 'bruch.g',
        code: 'bruch_g_unknown',
        path: `items[${g._itemIndex}].bruch.g${
          g._gramKey === null ? '' : `.${g._gramKey}`
        }`,
        // Wochentag nur nennen, wenn genau dessen Eintrag fehlt: ein
        // offenes `default` (oder eine bloße Zahl) gilt für alle Tage, und
        // die Lücke wird je Pfad nur einmal gemeldet (dedupeGaps).
        message: `„${name}“: Bruchgewicht${
          g._weekday && g._gramKey === String(g._weekday)
            ? ` am ${WEEKDAY_NAMES[g._weekday]}`
            : ''
        } ist noch offen.`,
      })
    }
    g.kg =
      g.brueche !== null && g.g !== null
        ? round3((g.brueche * g.g) / 1000)
        : null
    g.kgKnown =
      g.bruecheKnown !== null && g.g !== null
        ? round3((g.bruecheKnown * g.g) / 1000)
        : null
    if (g._unknownQty) g.pieces = null
    g.name = name
    // Zugaben je Bruch (U3): Brüche × g je Bruch; unbekannte Brüche oder
    // Gramm bleiben `null` (`gKnown` = bekannte Brüche × g, „≥ …“).
    g.addons = g._addons.map((a) => ({
      name: a.name,
      gPerBruch: a.gPerBruch,
      g:
        a.gPerBruch !== null && g.brueche !== null
          ? round1(g.brueche * a.gPerBruch)
          : null,
      gKnown:
        a.gPerBruch !== null && g.bruecheKnown !== null
          ? round1(g.bruecheKnown * a.gPerBruch)
          : null,
    }))
    g.addonGaps = g._addons
      .filter((a) => a.gPerBruch === null)
      .map((a) => ({
        path: a.path,
        code: 'bruch_addon_g_unknown',
        message: `„${name}“: Gramm „${a.name}“ je Bruch sind noch offen.`,
      }))
    out.push(g)
  }
  return out
    .sort((a, b) =>
      a.bakeDate === b.bakeDate
        ? a._order - b._order
        : String(a.bakeDate).localeCompare(String(b.bakeDate))
    )
    .map((g) => {
      const clean = { ...g }
      for (const k of Object.keys(clean)) if (k.startsWith('_')) delete clean[k]
      return clean
    })
}

// ---------------------------------------------------------------------------
// Teile eines Teigs
// ---------------------------------------------------------------------------

/**
 * Teile je Teig (Regeln 1, R5, R8–R10, R15): Laibe je Größe, Bruch-Gruppen,
 * Einzelstücke und `from_dough`-Anteile. Ein Teil ohne Gewicht hat `kg: null`
 * und nennt in `missing`, was fehlt. Posten ohne Teig tragen nichts bei.
 *
 * @returns {Array<{doughId: string|null, kind: 'sizes'|'bruch'|'pieces'|'from_dough',
 *   itemId: string, name: string, bakeDate: string, kg: number|null, kgKnown: number,
 *   missing: Array, extras?: Array, gaps: Array}>}
 */
function doughParts(cfg, lines, groups, sheetDate) {
  const items = itemIndex(cfg)
  const parts = []
  const byItem = new Map() // `${bakeDate}|${itemId}` -> Teil (Größen / Einzelstücke / from_dough)

  const partFor = (kind, item, index, bakeDate, doughId) => {
    const key = `${kind}|${bakeDate}|${item.id}`
    let p = byItem.get(key)
    if (!p) {
      p = {
        doughId,
        kind,
        itemId: item.id,
        name: item.name,
        section: item.section,
        bakeDate,
        kg: 0,
        kgKnown: 0,
        missing: [],
        gaps: [],
        _index: index,
        _item: item,
        _lines: [],
      }
      byItem.set(key, p)
      parts.push(p)
    }
    return p
  }
  const addKg = (p, kg, missing) => {
    if (missing) {
      p.missing.push(missing)
      p.kg = null
      return
    }
    p.kgKnown = round3(p.kgKnown + kg)
    if (p.kg !== null) p.kg = round3(p.kg + kg)
  }

  for (const line of Array.isArray(lines) ? lines : []) {
    const hit = items.get(line.itemId)
    if (!hit || !hit.item.dough || hit.item.bruch || !counts(line)) continue
    const { item, index } = hit
    const bakeDate = lineBakeDate(line, sheetDate)
    const total = Number(line.total) || 0

    if (item.from_dough) {
      const p = partFor('from_dough', item, index, bakeDate, item.from_dough.id)
      p._lines.push(line)
      continue
    }
    const doughId = item.dough.id
    if (isSizeItem(item)) {
      const p = partFor('sizes', item, index, bakeDate, doughId)
      if (qtyUnknown(line)) p.missing.push(baseUnsetMissing(line))
      if (line.variant === null || line.variant === undefined) {
        if (total > 0) {
          addKg(p, 0, {
            itemId: item.id,
            name: item.name,
            field: 'size',
            code: 'size_unassigned',
            path: null,
            message: `${total} × „${item.name}“ ohne Größe – Teig unbekannt.`,
          })
        }
        continue
      }
      const sizeIndex = item.sizes.findIndex((s) => s.id === line.variant)
      const size = item.sizes[sizeIndex]
      if (!size || !isNum(size.dough_g)) {
        if (total > 0 || qtyUnknown(line)) {
          addKg(p, 0, {
            itemId: item.id,
            name: item.name,
            field: 'sizes.dough_g',
            code: 'dough_g_unknown',
            path: `items[${index}].sizes[${sizeIndex}].dough_g`,
            message: `„${item.name}“, Größe „${
              size ? size.label : line.variant
            }“: Teig je Laib ist noch offen.`,
          })
        }
        continue
      }
      addKg(p, (total * size.dough_g) / 1000)
      continue
    }
    // Einzelstücke (Teigstücke × Gramm)
    const p = partFor('pieces', item, index, bakeDate, doughId)
    if (qtyUnknown(line)) p.missing.push(baseUnsetMissing(line))
    const pieceG = item.dough.piece_g
    const pieces = item.dough.pieces
    if (!isNum(pieces)) {
      addKg(p, 0, {
        itemId: item.id,
        name: item.name,
        field: 'dough.pieces',
        code: 'pieces_unknown',
        path: `items[${index}].dough.pieces`,
        message: `„${item.name}“: Teigstücke je Produkt sind noch offen – das Teiggewicht bleibt unbekannt.`,
      })
    } else if (!isNum(pieceG)) {
      addKg(p, 0, {
        itemId: item.id,
        name: item.name,
        field: 'dough.piece_g',
        code: 'piece_g_unknown',
        path: `items[${index}].dough.piece_g`,
        message: `„${item.name}“: Gramm je Teigstück sind noch offen.`,
      })
    } else {
      addKg(p, (total * pieces * pieceG) / 1000)
    }
  }

  // Bruch-Gruppen: ein Teil je Gruppe
  for (const g of Array.isArray(groups) ? groups : []) {
    const first = items.get(g.split[0] && g.split[0].itemId)
    parts.push({
      doughId: g.doughId,
      kind: 'bruch',
      itemId: g.group,
      name: g.name || g.split.map((s) => s.name).join(' + '),
      section: first ? first.item.section : null,
      bakeDate: g.bakeDate,
      kg: g.missing.length === 0 ? g.kg : null,
      kgKnown: isNum(g.kgKnown) ? g.kgKnown : 0,
      missing: [...g.missing],
      // Zugabe je Bruch ohne Gramm: nur Lücke, der Teig bleibt vollständig
      gaps: [...(g.addonGaps || [])],
      _index: first ? first.index : Infinity,
      _item: first ? first.item : null,
    })
  }

  // from_dough: Anteil am Teig `from_dough.id` (Regeln R8–R10)
  for (const p of parts) {
    if (p.kind !== 'from_dough') continue
    const item = p._item
    const index = p._index
    const f = item.from_dough
    let itemKg = 0
    let itemKgKnown = true
    let unknownQty = false
    let anyBaked = false
    for (const line of p._lines) {
      if (qtyUnknown(line)) {
        unknownQty = true
        p.missing.push(baseUnsetMissing(line))
      }
      const total = Number(line.total) || 0
      if (total > 0) anyBaked = true
      const size = item.sizes.find((s) => s.id === line.variant)
      if (total > 0 && (!size || !isNum(size.dough_g))) itemKgKnown = false
      else if (size && isNum(size.dough_g))
        itemKg += (total * size.dough_g) / 1000
    }
    // Teig des Postens selbst (Laibe × Teig je Laib) - für die Brot-Zeile;
    // der Anteil am Teig `from_dough.id` steht daneben in `kg`.
    p.loavesKgKnown = round3(itemKg)
    p.loavesKg = itemKgKnown && !unknownQty ? round3(itemKg) : null
    const extrasSum = f.extras.reduce(
      (s, x) => (s === null || !isNum(x.kg) ? null : s + x.kg),
      0
    )
    p.extras = f.extras.map((x, k) => ({
      name: x.name,
      kg: null,
      itemId: item.id,
      _k: k,
    }))
    p.kg = null
    p.kgKnown = 0
    if (f.mode === null) {
      p.missing.push({
        itemId: item.id,
        name: item.name,
        field: 'from_dough.mode',
        code: 'from_dough_mode_unknown',
        path: `items[${index}].from_dough.mode`,
        message: `„${item.name}“: Anteil am Teig (fest je Ansatz oder je Teig) ist noch offen – der Teig bleibt unvollständig.`,
      })
    } else if (f.mode === 'fixed') {
      if (!isNum(f.dough_kg)) {
        if (anyBaked || unknownQty) {
          p.missing.push({
            itemId: item.id,
            name: item.name,
            field: 'from_dough.dough_kg',
            code: 'from_dough_kg_unknown',
            path: `items[${index}].from_dough.dough_kg`,
            message: `„${item.name}“: kg Teig je Ansatz sind noch offen.`,
          })
        }
      } else if (anyBaked) {
        p.kgKnown = f.dough_kg
        if (!unknownQty) p.kg = f.dough_kg
        p.extras = p.extras.map((x) => ({
          ...x,
          kg: isNum(f.extras[x._k].kg) ? f.extras[x._k].kg : null,
        }))
      } else if (!unknownQty) {
        p.kg = 0
        p.extras = []
      }
    } else {
      // per_dough: Anteil = kg des Postens × dough_kg / (dough_kg + Σ Zugaben)
      const known = itemKgKnown && isNum(f.dough_kg) && extrasSum !== null
      if (!isNum(f.dough_kg)) {
        p.missing.push({
          itemId: item.id,
          name: item.name,
          field: 'from_dough.dough_kg',
          code: 'from_dough_kg_unknown',
          path: `items[${index}].from_dough.dough_kg`,
          message: `„${item.name}“: kg Teig je Ansatz sind noch offen.`,
        })
      }
      if (extrasSum === null) {
        f.extras.forEach((x, k) => {
          if (isNum(x.kg)) return
          p.missing.push({
            itemId: item.id,
            name: item.name,
            field: 'from_dough.extras.kg',
            code: 'extra_kg_unknown',
            path: `items[${index}].from_dough.extras[${k}].kg`,
            message: `„${item.name}“: kg „${x.name}“ sind noch offen.`,
          })
        })
      }
      if (!itemKgKnown) {
        item.sizes.forEach((s, j) => {
          if (isNum(s.dough_g)) return
          if (!p._lines.some((l) => l.variant === s.id && Number(l.total) > 0))
            return
          p.missing.push({
            itemId: item.id,
            name: item.name,
            field: 'sizes.dough_g',
            code: 'dough_g_unknown',
            path: `items[${index}].sizes[${j}].dough_g`,
            message: `„${item.name}“, Größe „${s.label}“: Teig je Laib ist noch offen.`,
          })
        })
      }
      if (known) {
        const ratio = f.dough_kg / (f.dough_kg + extrasSum)
        p.kgKnown = round3(itemKg * ratio)
        if (!unknownQty) p.kg = p.kgKnown
        p.extras = p.extras.map((x) => ({
          ...x,
          kg: round3((itemKg * f.extras[x._k].kg) / (f.dough_kg + extrasSum)),
        }))
      }
    }
    // Zugaben ohne kg: nur Lücke, der Teig bleibt (bei „fest“) vollständig
    f.extras.forEach((x, k) => {
      if (isNum(x.kg) || f.mode === 'per_dough') return
      p.gaps.push({
        path: `items[${index}].from_dough.extras[${k}].kg`,
        code: 'extra_kg_unknown',
        message: `„${item.name}“: kg „${x.name}“ sind noch offen.`,
      })
    })
    p.extras = p.extras.map(({ _k, ...x }) => x)
  }

  // Posten ohne bekannten Teig
  for (const p of parts) {
    if (p.doughId !== null || p.kind === 'bruch' || !p._item) continue
    p.gaps.push({
      path: `items[${p._index}].dough.id`,
      code: 'dough_unknown',
      message: `„${p.name}“: Teig ist noch offen – die kg stehen unter „Teig offen“.`,
    })
  }

  return parts
    .map((p) => {
      if (p.missing.length > 0) p.kg = null
      const out = { ...p }
      delete out._index
      delete out._item
      delete out._lines
      if (out.kind !== 'from_dough') delete out.extras
      // from_dough: `loavesKg` = Laibe × Teig je Laib (Brot-Zeile), `kg` =
      // Anteil am Teig `from_dough.id` - unabhängig voneinander bekannt.
      return { ...out, _order: p._index }
    })
    .sort((a, b) =>
      a._order === b._order
        ? String(a.bakeDate).localeCompare(String(b.bakeDate))
        : a._order - b._order
    )
    .map(({ _order, ...p }) => p)
}

// ---------------------------------------------------------------------------
// Teige und Maschinen-Kästen
// ---------------------------------------------------------------------------

/** Der gemeinsame Abschnitt der Teile (Anzeige „Wasser … L“ beim Hefeteig), sonst `null`. */
function commonSection(sections) {
  const set = new Set(sections)
  return set.size === 1 ? [...set][0] : null
}

function doughGap(index, field, code, message) {
  return { path: `doughs[${index}].${field}`, code, message }
}

/**
 * Teige des Zettels und die Maschinen-Kästen (Regeln 1–5, R6/R7).
 * @returns {{ doughs: Array, machine: Array, gaps: Array<{path, code, message}> }}
 */
function summarizeDoughs(cfg, parts) {
  const list = Array.isArray(parts) ? parts : []
  const doughIndex = new Map(cfg.doughs.map((d, i) => [d.id, i]))
  const ids = []
  for (const p of list) if (!ids.includes(p.doughId)) ids.push(p.doughId)
  const order = (id) =>
    id === null ? Infinity : doughIndex.has(id) ? doughIndex.get(id) : 1e6
  ids.sort((a, b) => order(a) - order(b))

  const gaps = []
  for (const p of list) for (const g of p.gaps || []) gaps.push(g)

  const recordOf = (id) => {
    if (id !== null && doughIndex.has(id)) return cfg.doughs[doughIndex.get(id)]
    return {
      id,
      name: id === null ? 'Teig offen' : id,
      batch_max_kg: null,
      kg_per_liter: null,
      liter_rounding: null,
      combined_with: null,
      combined_name: null,
      addons: [],
    }
  }
  const headOf = (d) =>
    d.combined_with && doughIndex.has(d.combined_with)
      ? cfg.doughs[doughIndex.get(d.combined_with)]
      : d

  const summaries = ids.map((id) => {
    const d = recordOf(id)
    const di = doughIndex.has(id) ? doughIndex.get(id) : null
    const own = list.filter((p) => p.doughId === id)
    const missing = own.flatMap((p) => p.missing)
    for (const p of own) for (const m of p.missing) if (m.path) gaps.push(m)
    const kgKnown = round3(own.reduce((s, p) => s + (p.kgKnown || 0), 0))
    const complete = missing.length === 0
    const kg = complete ? kgKnown : null
    const head = headOf(d)
    const liters = litersFor(d, kg, head.liter_rounding)
    const raw = rawLiters(d, kg)
    if (di !== null) {
      if (d.kg_per_liter === null) {
        gaps.push(
          doughGap(
            di,
            'kg_per_liter',
            'kg_per_liter_unknown',
            `Teig „${d.name}“: kg je Liter ist noch offen – der Zettel zeigt nur kg.`
          )
        )
      }
      if (head === d && d.liter_rounding === null) {
        gaps.push(
          doughGap(
            di,
            'liter_rounding',
            'liter_rounding_unknown',
            `Teig „${d.name}“: Literrundung ist noch offen – der Zettel zeigt die genauen Liter.`
          )
        )
      }
      if (head === d && d.batch_max_kg === null) {
        gaps.push(
          doughGap(
            di,
            'batch_max_kg',
            'batch_max_kg_unknown',
            `Teig „${d.name}“: Chargengröße ist noch offen – Chargen werden nicht berechnet.`
          )
        )
      }
      d.addons.forEach((a, k) => {
        if (a.g_per_liter === null) {
          gaps.push(
            doughGap(
              di,
              `addons[${k}].g_per_liter`,
              'addon_unknown',
              `Teig „${d.name}“, Zugabe „${a.name}“: Gramm je Liter sind noch offen.`
            )
          )
        } else if (a.rounding === null) {
          gaps.push(
            doughGap(
              di,
              `addons[${k}].rounding`,
              'addon_rounding_unknown',
              `Teig „${d.name}“, Zugabe „${a.name}“: Rundung ist noch offen – es stehen die genauen Gramm da.`
            )
          )
        }
      })
    }
    return {
      id,
      name: d.name,
      kg,
      kgKnown,
      complete,
      missing: missing.map(({ path, ...m }) => m),
      liters,
      batches: batchesFor(kg, d.batch_max_kg),
      batch_max_kg: d.batch_max_kg,
      addons: addonsFor(d, raw),
      parts: own.map((p) => ({
        kind: p.kind,
        itemId: p.itemId,
        name: p.name,
        bakeDate: p.bakeDate,
        kg: p.kg,
      })),
      extras: own.flatMap((p) => (p.kind === 'from_dough' ? p.extras : [])),
      combinedWith: d.combined_with || null,
      _sections: own.map((p) => p.section).filter(Boolean),
      _raw: raw,
    }
  })

  // Kopf einer gemeinsamen Gruppe ohne eigene Teile auf dem Zettel: seine
  // offene Rundung/Chargengröße betrifft den Kasten trotzdem.
  for (const s of summaries) {
    const d = recordOf(s.id)
    const head = headOf(d)
    if (head === d || ids.includes(head.id) || !doughIndex.has(head.id))
      continue
    const hi = doughIndex.get(head.id)
    if (head.liter_rounding === null) {
      gaps.push(
        doughGap(
          hi,
          'liter_rounding',
          'liter_rounding_unknown',
          `Teig „${head.name}“: Literrundung ist noch offen – der Zettel zeigt die genauen Liter.`
        )
      )
    }
    if (head.batch_max_kg === null) {
      gaps.push(
        doughGap(
          hi,
          'batch_max_kg',
          'batch_max_kg_unknown',
          `Teig „${head.name}“: Chargengröße ist noch offen – Chargen werden nicht berechnet.`
        )
      )
    }
  }

  // Maschinen-Kästen: ein Kasten je Teig oder je gemeinsamer Gruppe
  const boxes = new Map()
  for (const s of summaries) {
    const d = recordOf(s.id)
    const head = headOf(d)
    const key = head.id === null ? '\u0000' : head.id
    let box = boxes.get(key)
    if (!box) {
      box = { head, members: [] }
      boxes.set(key, box)
    }
    box.members.push(s)
  }
  const machine = [...boxes.values()]
    .sort((a, b) => order(a.head.id) - order(b.head.id))
    .map(({ head, members }) => {
      const complete = members.every((m) => m.complete)
      const kgKnown = round3(members.reduce((s, m) => s + m.kgKnown, 0))
      const kg = complete ? kgKnown : null
      let liters
      if (members.length === 1 && members[0].id === head.id) {
        liters = members[0].liters
      } else if (!complete) {
        liters = { exact: null, rounded: null, reason: 'dough_incomplete' }
      } else if (members.some((m) => m._raw === null)) {
        liters = { exact: null, rounded: null, reason: 'kg_per_liter_unknown' }
      } else {
        liters = litersFromRaw(
          members.reduce((s, m) => s + m._raw, 0),
          head.liter_rounding
        )
      }
      const combined = members.length > 1 || members[0].id !== head.id
      return {
        id: head.id,
        name: combined
          ? head.combined_name ||
            [
              head.id,
              ...cfg.doughs
                .filter((x) => x.combined_with === head.id)
                .map((x) => x.id),
            ]
              .map((id) => recordOf(id).name)
              .join(' + ')
          : head.name,
        doughIds: members.map((m) => m.id),
        kg,
        kgKnown,
        complete,
        liters,
        batches: batchesFor(kg, head.batch_max_kg),
        batch_max_kg: head.batch_max_kg,
        addons: members.flatMap((m) => m.addons),
        section: commonSection(members.flatMap((m) => m._sections)),
      }
    })

  return {
    doughs: summaries.map(({ _sections, _raw, ...s }) => s),
    machine,
    gaps,
  }
}

/** Teile, Bruch-Gruppen, Teige und Maschinen-Kästen von Zeilen in einem Zug. */
function computeSheetDoughs(cfg, lines, sheetDate) {
  const groups = bruchGroups(cfg, lines, sheetDate)
  const parts = doughParts(cfg, lines, groups, sheetDate)
  const { doughs, machine, gaps } = summarizeDoughs(cfg, parts)
  return { groups, parts, doughs, machine, gaps }
}

// ---------------------------------------------------------------------------
// Ansichten des Zettels (die Oberfläche rechnet nichts)
// ---------------------------------------------------------------------------

function bakeDayLabel(bakeDate, sheetDate) {
  return bakeDate === sheetDate
    ? 'heute'
    : `für ${WEEKDAY_NAMES[isoWeekday(bakeDate)]}`
}

function breadNote(cfg, item) {
  const notes = []
  // Zukauf und `note` aus der YAML zuerst - dieselben Worte wie an der Zeile
  const hint = configCore.itemHint(item)
  if (hint) notes.push(hint)
  const dough = item.dough
    ? cfg.doughs.find((d) => d.id === item.dough.id)
    : null
  if (dough) {
    const headId = dough.combined_with || dough.id
    const members = cfg.doughs.filter(
      (d) => d.id === headId || d.combined_with === headId
    )
    if (members.length > 1) {
      const head = cfg.doughs.find((d) => d.id === headId)
      notes.push(
        `Gemeinsamer Teig: ${
          (head && head.combined_name) || members.map((d) => d.name).join(' + ')
        }`
      )
    }
  }
  const f = item.from_dough
  if (f) {
    const from = cfg.doughs.find((d) => d.id === f.id)
    const fromName = from ? from.name : f.id || 'unbekannt'
    const extras = f.extras
      .map((x) => `${x.name} ${isNum(x.kg) ? `${fmt(x.kg)} kg` : '(kg offen)'}`)
      .join(', ')
    if (f.mode === 'fixed') {
      notes.push(
        `Aus Teig „${fromName}“: ${
          isNum(f.dough_kg) ? `${fmt(f.dough_kg)} kg` : 'kg offen'
        } je Ansatz${extras ? ` + ${extras}` : ''}`
      )
    } else if (f.mode === 'per_dough') {
      notes.push(`Anteil aus Teig „${fromName}“${extras ? ` + ${extras}` : ''}`)
    } else {
      notes.push(`Anteil am Teig „${fromName}“ noch offen`)
    }
  }
  return notes.length ? notes.join(' · ') : null
}

function fmt(n) {
  return String(round3(n)).replace('.', ',')
}

/**
 * Brot-Tabelle: Zeilen = Posten mit Größen (und alte Liter-Posten im
 * Abschnitt Brot), Spalten = Größen.
 */
function breadView(cfg, lines, parts, sheetDate) {
  const items = itemIndex(cfg)
  const rows = new Map()
  const sizes = []
  for (const line of Array.isArray(lines) ? lines : []) {
    const hit = items.get(line.itemId)
    if (!hit) continue
    const { item } = hit
    const sized = isSizeItem(item)
    if (!sized && line.section !== 'brot') continue
    const bakeDate = lineBakeDate(line, sheetDate)
    const key = `${bakeDate}|${item.id}`
    let row = rows.get(key)
    if (!row) {
      row = {
        itemId: item.id,
        name: item.name,
        bakeDate,
        doughId: item.dough ? item.dough.id : null,
        unit: item.unit,
        cells: {},
        single: null,
        kg: null,
        complete: true,
        note: breadNote(cfg, item),
        _index: hit.index,
        _item: item,
      }
      rows.set(key, row)
      if (sized) {
        for (const s of item.sizes) {
          if (!sizes.some((x) => x.id === s.id))
            sizes.push({ id: s.id, label: s.label })
        }
      }
    }
    const cell = {
      key: line.key,
      variant: line.variant === undefined ? null : line.variant,
      total: Number(line.total) || 0,
      baseUnset: Boolean(line.baseUnset),
      totalIsMinimum: qtyUnknown(line),
      ...dayDecisionField(line),
    }
    if (sized && line.variant) row.cells[line.variant] = cell
    else row.single = { ...cell, unit: item.unit }
  }
  const out = [...rows.values()]
    .sort((a, b) =>
      a.bakeDate === b.bakeDate
        ? a._index - b._index
        : String(a.bakeDate).localeCompare(String(b.bakeDate))
    )
    .map(({ _index, _item, ...row }) => {
      const cells = {}
      for (const s of sizes) {
        const has = _item.sizes.some((x) => x.id === s.id)
        cells[s.id] = row.cells[s.id]
          ? row.cells[s.id]
          : has
          ? {
              key: `${_item.id}|${s.id}${
                row.bakeDate === sheetDate || !sheetDate
                  ? ''
                  : `@${row.bakeDate}`
              }`,
              variant: s.id,
              total: 0,
              baseUnset: false,
              totalIsMinimum: false,
            }
          : null
      }
      const own = (Array.isArray(parts) ? parts : []).filter(
        (p) =>
          p.itemId === row.itemId &&
          p.bakeDate === row.bakeDate &&
          (p.kind === 'sizes' || p.kind === 'from_dough')
      )
      // Teig der Zeile = Teig des Brots selbst; bei from_dough Laibe × Teig
      // je Laib (§4.1), der Anteil am Mischteig steht im Hinweis.
      const rowKg = (p) => (p.kind === 'from_dough' ? p.loavesKg : p.kg)
      const rowKgKnown = (p) =>
        p.kind === 'from_dough' ? p.loavesKgKnown : p.kgKnown
      const complete = own.every((p) => rowKg(p) !== null)
      const shares = own.filter((p) => p.kind === 'from_dough')
      let note = row.note
      // Offener Anteil steht schon in breadNote („noch offen“, „kg offen“).
      if (shares.length > 0 && shares.every((p) => p.kg !== null)) {
        const from = cfg.doughs.find((d) => d.id === shares[0].doughId)
        const fromName = from ? from.name : shares[0].doughId
        const share = `davon ${fmt(
          shares.reduce((s, p) => s + p.kg, 0)
        )} kg ${fromName}`
        note = note ? `${note} · ${share}` : share
      }
      return {
        ...row,
        note,
        cells,
        kg:
          own.length === 0
            ? null
            : complete
            ? round3(own.reduce((s, p) => s + rowKg(p), 0))
            : null,
        kgKnown: round3(own.reduce((s, p) => s + (rowKgKnown(p) || 0), 0)),
        // ohne Teil: alte Liter-Zeile (kein Teig) oder Groessen-Posten ohne Teig
        complete: own.length === 0 ? !isSizeItem(_item) : complete,
      }
    })
  return { sizes, rows: out }
}

/**
 * Brötchen je Backtag: Bruch-Gruppen und Einzelstücke (Teigstücke ohne
 * Teilmaschine, außerhalb des Hefeteigs).
 */
function rollsView(cfg, lines, groups, sheetDate) {
  const items = itemIndex(cfg)
  const blocks = new Map()
  const block = (bakeDate) => {
    let b = blocks.get(bakeDate)
    if (!b) {
      b = {
        bakeDate,
        label: bakeDayLabel(bakeDate, sheetDate),
        groups: [],
        singles: [],
      }
      blocks.set(bakeDate, b)
    }
    return b
  }
  for (const g of Array.isArray(groups) ? groups : []) {
    const { missing, addonGaps, ...rest } = g
    block(g.bakeDate).groups.push({
      ...rest,
      complete: missing.length === 0,
      missing: missing.map(({ path, ...m }) => m),
    })
  }
  for (const line of Array.isArray(lines) ? lines : []) {
    const hit = items.get(line.itemId)
    if (!hit || !isPieceItem(hit.item) || line.section === 'hefeteig') continue
    if (!counts(line)) continue
    const { item } = hit
    const total = Number(line.total) || 0
    const pieceG = item.dough.piece_g
    const pieces = item.dough.pieces
    block(lineBakeDate(line, sheetDate)).singles.push({
      key: line.key,
      itemId: item.id,
      name: line.name,
      variant: line.variant === undefined ? null : line.variant,
      total,
      baseUnset: Boolean(line.baseUnset),
      totalIsMinimum: qtyUnknown(line),
      ...dayDecisionField(line),
      piece_g: isNum(pieceG) ? pieceG : null,
      pieces: isNum(pieces) ? pieces : null,
      kg:
        isNum(pieceG) && isNum(pieces) && !qtyUnknown(line)
          ? round3((total * pieces * pieceG) / 1000)
          : null,
      // der bekannte Teil (Grundmenge offen): steckt im kgKnown des Teigs,
      // die Zeile zeigt ihn als „≥ …“ statt „–“ (Regel 1)
      kgKnown:
        isNum(pieceG) && isNum(pieces)
          ? round3((total * pieces * pieceG) / 1000)
          : null,
    })
  }
  return [...blocks.values()].sort((a, b) =>
    String(a.bakeDate).localeCompare(String(b.bakeDate))
  )
}

/** Lücken nach Pfad zusammengefasst, Reihenfolge des ersten Auftretens. */
function dedupeGaps(gaps) {
  const seen = new Set()
  const out = []
  for (const g of Array.isArray(gaps) ? gaps : []) {
    if (!g || !g.path || seen.has(g.path)) continue
    seen.add(g.path)
    out.push({ path: g.path, code: g.code, message: g.message })
  }
  return out
}

module.exports = {
  EPSILON,
  roundTo,
  litersFor,
  addonsFor,
  batchesFor,
  bruchGroups,
  doughParts,
  summarizeDoughs,
  computeSheetDoughs,
  breadView,
  rollsView,
  bakeDayLabel,
  dedupeGaps,
  isSizeItem,
  isPieceItem,
  qtyUnknown,
  dayDecision,
  dayDecisionField,
}
