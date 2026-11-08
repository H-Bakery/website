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
//
// Backzettel v2 (Z10, docs/backzettel-v2.md §4): `computeDoughDay` rechnet
// den Zettel eines Teigtags - die Zeilen aller Backtage, deren Teig an dem
// Tag gemacht wird (`backzettel-plan.core.js`), dazu Teige, Liter, Bruch
// (`backzettel-dough.core.js`). `computeDay` bleibt die Rechnung eines
// Backtags; mit v1-Stammdaten liefern beide dasselbe wie vor Z10.

const configCore = require('./backzettel-config.core')
const recipesCore = require('./backzettel-recipes.core')
const planCore = require('./backzettel-plan.core')
const doughCore = require('./backzettel-dough.core')

const { SECTION_LABELS, INTEGER_UNITS, WEEKDAY_NAMES } = configCore

const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Blech-Angabe. Uebernommen aus dem frueheren
// feature-daily-prep/utils/trayInfo.ts (roadmap §5.1, „keep“); das Original ist
// mit der alten Vorbereitungsseite in B12 geloescht, die Faelle seiner Spec
// stehen in tests/unit/backzettelCore.test.js. Einzige Fassung.
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

/**
 * Blech-Angabe aus dem YAML-Format `tray: { no, per_tray }`.
 *
 * Mit `total` (Stück der Zeile) und `per_tray` zählt die Angabe die Bleche
 * nach der Menge, nicht nach der YAML (W4-Verifikation Runde 3: bei 40
 * Croissants stand „2 Bleche à 12“ da - Platz für 24). Reichen die
 * hinterlegten Blechnummern nicht, steht dabei, wie viele weitere es
 * braucht; brauchen sie weniger, stehen nur die ersten da.
 */
function trayText(tray, total, unit) {
  if (!tray || !Array.isArray(tray.no)) return null
  const per = tray.per_tray
  const countable =
    typeof total === 'number' &&
    Number.isFinite(total) &&
    total > 0 &&
    (unit === undefined || unit === 'Stück') &&
    isTrayNumber(per) &&
    per > 0
  if (!countable) {
    return tray.no.length === 1
      ? formatTrayInfo({ tray_number: tray.no[0] })
      : formatTrayInfo({ tray_numbers: tray.no, trays_of: per })
  }
  const needed = Math.ceil(total / per - 1e-9)
  const numbers = tray.no.filter(isTrayNumber)
  const used = numbers.slice(0, needed)
  const extra = needed - used.length
  const list =
    used.length === 0
      ? ''
      : used.length === 1
      ? `Blech ${used[0]}`
      : `Bleche ${used.join(', ')}`
  const more =
    extra > 0 ? `${extra} ${extra === 1 ? 'weiteres' : 'weitere'}` : ''
  const where = [list, more].filter(Boolean).join(' + ')
  return `${needed} ${needed === 1 ? 'Blech' : 'Bleche'} à ${per}${
    where ? ` (${where})` : ''
  }`
}

// ---------------------------------------------------------------------------
// Datum, Runden
// ---------------------------------------------------------------------------

// Datum: einzige Fassung in `backzettel-plan.core.js`.
const { isValidDate, isoWeekday } = planCore

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
      index.set(String(p.id), {
        item,
        factor: p.factor,
        // Z10: Groesse des Produkts bei Posten mit `sizes` (sonst null)
        size:
          item.variantKind === 'size' && typeof p.size === 'string'
            ? p.size
            : null,
      })
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

/**
 * Anzeigename eines hq-Produkts (Slug oder numerische ID) aus dem Katalog;
 * ohne Treffer der Slug selbst (W4-Verifikation Runde 4: Hinweise nannten
 * „schwarzwaelder-kirsch-torte“ statt des Produktnamens).
 */
function catalogNamer(catalog) {
  const names = new Map()
  for (const p of Array.isArray(catalog) ? catalog : []) {
    if (!p || !p.id || typeof p.name !== 'string' || !p.name.trim()) continue
    names.set(String(p.id), p.name.trim())
    if (p.numeric_id !== undefined && p.numeric_id !== null) {
      names.set(String(p.numeric_id), p.name.trim())
    }
  }
  return (productId) => names.get(String(productId)) || String(productId)
}

/**
 * Schluessel einer Zeile: `itemId|variant`. Z10: liegt der Backtag nicht auf
 * dem Zettel-Tag (Teig am Vortag), kommt er dazu - `itemId|variant@bakeDate`.
 * Alle v1-Schluessel bleiben gueltig.
 */
function lineKey(itemId, variant, bakeDate, sheetDate) {
  const base = `${itemId}|${variant || ''}`
  return bakeDate && sheetDate && bakeDate !== sheetDate
    ? `${base}@${bakeDate}`
    : base
}

/**
 * Loest eine Produkt-ID (hq-Slug oder numerische ID aus dem Katalog) zu
 * Posten und Faktor auf. Einzige Stelle dafuer: `computeDay`,
 * `computePreorderDeltas` und `variantsForProduct` benutzen sie.
 * @returns {(productId: unknown) => ({item: object, factor: number, size: string|null} | null)}
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
 *
 * Z10: ein Produkt eines Groessen-Postens nennt seine Groesse selbst
 * (`products[].size`) - `variants: []` (die Vorbestellung speichert `''`) und
 * `size` dazu.
 * @returns {{itemId:string, name:string, unit:string, factor:number, variants:string[], size?:string|null} | null}
 */
function variantsForProduct(config, productId, catalog) {
  const hit = createProductResolver(config, catalog)(productId)
  if (!hit) return null
  if (hit.item.variantKind === 'size') {
    return {
      itemId: hit.item.id,
      name: hit.item.name,
      unit: hit.item.unit,
      factor: hit.factor,
      variants: [],
      size: hit.size,
    }
  }
  return {
    itemId: hit.item.id,
    name: hit.item.name,
    unit: hit.item.unit,
    factor: hit.factor,
    variants: [...hit.item.variants],
  }
}

/**
 * Alle Produkte mit Sorten, fuer die Erfassungsmaske der Vorbestellungen
 * (P1, `GET /api/preorders/variants`): `{ [productId]: ['nuss', ...] }`.
 * Produkte ohne Sorten fehlen - auch Produkte eines Groessen-Postens (Z10,
 * die Groesse steht am Produkt) -, wie bei `variantsForProduct` gewinnt der
 * letzte Posten, falls ein Produkt in mehreren steht.
 * @returns {Record<string, string[]>}
 */
function variantsByProduct(config) {
  const cfg = ensureNormalized(config)
  const index = productIndex(cfg)
  const out = {}
  for (const [productId, hit] of index) {
    if (hit.item.variants.length > 0 && hit.item.variantKind !== 'size')
      out[productId] = [...hit.item.variants]
  }
  return out
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

/**
 * Zaehlt eine Position fuer `date`? (nicht storniert, Menge > 0, Abholtag)
 * Storniert heisst im Mock `cancelled`, in der echten API (B7) `storniert`.
 */
function countablePreorderQty(raw, date) {
  if (!raw || raw.status === 'cancelled' || raw.status === 'storniert') {
    return null
  }
  if ((raw.pickupDate || raw.date) !== date) return null
  const qty = Number(raw.qty === undefined ? raw.quantity : raw.qty)
  return Number.isFinite(qty) && qty > 0 ? qty : null
}

// ---------------------------------------------------------------------------
// Tagesrechnung
// ---------------------------------------------------------------------------

/** Saisonfaktor aus der Eingabe; ungueltig -> 1,0 mit Warnung. */
function seasonFactorOf(raw, warnings) {
  const factor = raw === undefined || raw === null ? 1 : Number(raw)
  if (Number.isFinite(factor) && factor > 0) return factor
  warnings.push({
    code: 'invalid_season_factor',
    message: `Saisonfaktor ${JSON.stringify(
      raw
    )} ist ungültig; gerechnet wird mit 1,0.`,
  })
  return 1
}

/**
 * Die Zeilen eines Backtags (ohne Hefeteig, Fuellungen, Vorbereitung).
 * Gemeinsamer Kern von `computeDay` (v1) und `computeDoughDay` (v2).
 *
 * v2-Form, sobald `sheetDate` oder `onlyItems` angegeben ist: nur die Posten
 * aus `onlyItems`, jede Zeile mit `bakeDate`, `doughDate`, `lead`,
 * `variantKind`, `variantLabel` (Bruch-Posten auch `bruch`) und dem
 * Schluessel `lineKey(itemId, variant, bakeDate, sheetDate)`. Hinweise, die
 * dem Backtag selbst gehoeren (nicht zugeordnete Produkte, Vorbestellungen am
 * Ruhetag), erscheinen nur auf dessen eigenem Zettel.
 */
function computeLines(args) {
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
  const v2 = a.sheetDate !== undefined || a.onlyItems !== undefined
  const sheetDate = v2 && isValidDate(a.sheetDate) ? a.sheetDate : date
  const only =
    a.onlyItems === undefined || a.onlyItems === null
      ? null
      : new Set(a.onlyItems)
  const ownDay = sheetDate === date
  const included = (item) => only === null || only.has(item.id)

  const seasonFactor = a.seasonFactorChecked
    ? Number(a.seasonFactor)
    : seasonFactorOf(a.seasonFactor, warnings)

  const open = cfg.days.includes(weekday)
  const resolveProduct = createProductResolver(cfg, a.catalog)
  const numericSlugs = numericIndex(a.catalog)
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
  // Produkte eines Groessen-Postens tragen ihre Groesse (`products[].size`):
  // eine Vorbestellung „Testkorn 500 g“ landet ohne Sortenfrage auf `g500`.
  const variantOf = (hit, variant, source) =>
    hit.size ? hit.size : resolveVariant(hit.item, variant, source)

  // Vorbestellungen
  const unmatched = new Map()
  let preordersOnClosedDay = 0
  for (const raw of asPreorderItems(a.preorderItems)) {
    const qty = countablePreorderQty(raw, date)
    if (qty === null) continue
    const productId = raw.productSlug || raw.productId
    const hit = resolveProduct(productId)
    if (!hit) {
      // numerische ID und Slug desselben Produkts zusammen melden
      const k = numericSlugs.get(String(productId)) || String(productId)
      unmatched.set(k, (unmatched.get(k) || 0) + qty)
      continue
    }
    if (!open) {
      preordersOnClosedDay += qty
      continue
    }
    if (!included(hit.item)) continue
    const b = bucket(hit.item, variantOf(hit, raw.variant, 'Vorbestellung'))
    b.preorders += qty * hit.factor
    if (
      raw.preorderId !== undefined &&
      raw.preorderId !== null &&
      !b.preorderIds.includes(raw.preorderId)
    ) {
      b.preorderIds.push(raw.preorderId)
    }
  }
  const productName = catalogNamer(a.catalog)
  if (ownDay) {
    for (const [productId, qty] of unmatched) {
      warnings.push({
        code: 'unmapped_product',
        productId,
        qty,
        message: `Vorbestelltes Produkt „${productName(
          productId
        )}“ (${qty} Stück) gehört zu keinem Backzettel-Posten.`,
      })
    }
    if (preordersOnClosedDay > 0) {
      warnings.push({
        code: 'preorders_on_closed_day',
        qty: preordersOnClosedDay,
        message: `${WEEKDAY_NAMES[weekday]} ist kein Produktionstag, es liegen aber Vorbestellungen vor.`,
      })
    }
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
          if (!ownDay) continue
          warnings.push({
            code: 'unmapped_cap_product',
            productId: String(productId),
            qty,
            message: `CAP-Produkt „${productName(
              productId
            )}“ (${qty} Stück) gehört zu keinem Backzettel-Posten.`,
          })
          continue
        }
        if (!included(hit.item)) continue
        bucket(hit.item, hit.size || null).cap += qty * hit.factor
      }
    }
  }

  // Korrekturen (je Backtag: `bakeDate`, ohne Angabe der Tag selbst)
  if (open) {
    for (const c of Array.isArray(a.corrections) ? a.corrections : []) {
      if (!c) continue
      if (
        c.bakeDate !== undefined &&
        c.bakeDate !== null &&
        c.bakeDate !== '' &&
        c.bakeDate !== date
      )
        continue
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
      if (!included(item)) continue
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

  // Sortenname wie in der Oberfläche („Zopf gefüllt – Nussfüllung“,
  // „Testkorn – 500 g“): Groesse, Füllungsname aus den Stammdaten, sonst die
  // ID mit grossem Anfang - nie die rohe YAML-ID in Klammern.
  const displayName = (item, v) => configCore.variantDisplayName(cfg, item, v)

  // Zeilen. `null` als Grundmenge heisst „noch nicht festgelegt“ (anders als
  // 0 = „wird nicht gebacken“): die Zeile erscheint mit `baseUnset: true`,
  // auch ohne Menge, und es gibt eine Warnung `base_unset`.
  const lines = []
  const unset = []
  const clamped = []
  const noDoughDay = []
  if (open) {
    for (const item of cfg.items) {
      if (!included(item)) continue
      const hasDay = Object.prototype.hasOwnProperty.call(item.base, weekday)
      const baseDay = item.base[weekday]
      const variants =
        item.variants.length > 0 ? [...item.variants, null] : [null]
      const dough = v2 ? planCore.resolveDoughDate(cfg, item, date) : null
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
          unset.push(
            variant ? `${item.name} – ${displayName(item, variant)}` : item.name
          )
        const b = acc.get(lineKey(item.id, variant)) || {
          preorders: 0,
          cap: 0,
          correction: 0,
          reasons: [],
          preorderIds: [],
        }
        // Viertel erst summieren, dann aufrunden - ueber alle Quellen der
        // Zeile (W4-Verifikation Runde 4): 2 + 0,75 Vorbestellt + 0,25 CAP
        // sind 3 Kuchen, nicht 2 + 1 + 1. Je Spalte aufgerundet ergibt das
        // dasselbe, solange hoechstens eine Quelle Bruchteile hat; sonst
        // zeigen die Spalten die genauen Werte, damit sie sich zu `total`
        // (vor dem Aufrunden) addieren - `quartersPooled` markiert das.
        const seasonedExact = base * seasonFactor
        const subtotalExact = seasonedExact + b.preorders + b.cap
        const pooledSubtotal = roundUp(subtotalExact, item.unit)
        const seasonedUp = roundUp(seasonedExact, item.unit)
        const preordersUp = roundUp(b.preorders, item.unit)
        const capUp = roundUp(b.cap, item.unit)
        const pooled =
          pooledSubtotal < tidy(seasonedUp + preordersUp + capUp, item.unit)
        const seasoned = pooled ? round2(seasonedExact) : seasonedUp
        const preorders = pooled ? round2(b.preorders) : preordersUp
        const cap = pooled ? round2(b.cap) : capUp
        const correction = tidy(b.correction, item.unit)
        const empty =
          base === 0 && preorders === 0 && cap === 0 && correction === 0
        if (empty && !baseUnset && !a.includeEmpty) continue
        // Eine Korrektur, die die Zeile unter 0 drueckt, wird auf 0 gekappt -
        // aber nie still: die Zeile traegt `correctionClamped`, es gibt eine
        // Warnung, und spaetere Vorbestellungen verschwaenden still in dem
        // negativen Rest (W4-Verifikation Runde 2). Speichern lehnt so eine
        // Korrektur ab; gekappt wird nur, wenn die Zeile spaeter kleiner wird
        // (Grundmenge, Storno).
        const raw = tidy(pooledSubtotal + correction, item.unit)
        const total = Math.max(0, raw)
        if (raw < 0) {
          clamped.push({
            name: variant
              ? `${item.name} – ${displayName(item, variant)}`
              : item.name,
            subtotal: pooledSubtotal,
            correction,
          })
        }
        const line = {
          key: v2
            ? lineKey(item.id, variant, date, sheetDate)
            : lineKey(item.id, variant),
          itemId: item.id,
          name: item.name,
          section: item.section,
          unit: item.unit,
          variant,
          base,
          baseUnset,
          seasonal: pooled
            ? round2(seasoned - base)
            : tidy(seasoned - base, item.unit),
          preorders,
          preordersExact: round2(b.preorders),
          subtotalExact: round2(subtotalExact),
          ...(pooled ? { quartersPooled: true } : {}),
          preorderIds: b.preorderIds,
          cap,
          correction,
          correctionReason: b.reasons.length ? b.reasons.join('; ') : null,
          total,
          ...(raw < 0 ? { correctionClamped: true } : {}),
          tray: trayText(item.tray, total, item.unit),
          plu: item.plu,
        }
        if (item.unit === 'Liter' && item.pieces_per_liter) {
          line.loavesEstimate = Math.round(total * item.pieces_per_liter)
        }
        if (v2) {
          Object.assign(line, v2LineFields(cfg, item, variant, date, dough))
          // Grundmenge offen (ohne Korrektur): `total` ist nur das Bekannte -
          // eine Mindestmenge („≥ 4“), keine fertige Zahl (Regel 8).
          line.totalIsMinimum = doughCore.qtyUnknown(line)
          if (!dough.found && !noDoughDay.includes(item.name))
            noDoughDay.push(item.name)
        }
        lines.push(line)
      }
    }
  }

  if (clamped.length > 0) {
    warnings.push({
      code: 'correction_exceeds_line',
      items: clamped.map((c) => c.name),
      message: `Korrektur größer als die Menge: ${clamped
        .map(
          (c) =>
            `${c.name} (${String(c.subtotal).replace(
              '.',
              ','
            )} geplant, Korrektur ${String(c.correction)
              .replace('.', ',')
              .replace('-', '−')})`
        )
        .join(
          ', '
        )} - Gesamt steht auf 0, auch neue Vorbestellungen ändern daran nichts. Bitte die Korrektur prüfen.`,
    })
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

  if (noDoughDay.length > 0) {
    warnings.push({
      code: 'no_dough_day',
      items: noDoughDay,
      message: `Kein Teigtag in den ${planCore.LOOKAHEAD_DAYS} Tagen vor ${
        WEEKDAY_NAMES[weekday]
      } gefunden: ${noDoughDay.join(
        ', '
      )} - steht deshalb auf dem Zettel des Backtags.`,
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

  return {
    cfg,
    date,
    weekday,
    open,
    seasonFactor,
    sections,
    lines: ordered,
    warnings,
  }
}

/** `2026-11-28` → „Samstag, 28.11.“ (Hinweise). */
function dayLabel(date) {
  const [, m, d] = String(date).split('-')
  return `${WEEKDAY_NAMES[isoWeekday(date)]}, ${d}.${m}.`
}

/** Die v2-Felder einer Zeile (Backtag, Teigtag, Sortenname, Bruch). */
function v2LineFields(cfg, item, variant, bakeDate, dough) {
  const d = dough || planCore.resolveDoughDate(cfg, item, bakeDate)
  return {
    bakeDate,
    doughDate: d.date,
    lead: d.lead,
    variantKind: item.variantKind === undefined ? null : item.variantKind,
    variantLabel: configCore.variantDisplayName(cfg, item, variant),
    ...(item.bruch
      ? {
          bruch: {
            group: item.bruch.group,
            perProduct: item.bruch.per_product,
          },
        }
      : {}),
  }
}

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
 * @param {Array} [args.corrections] `{itemId, variant?, qty, reason?, bakeDate?}`;
 *   eine Korrektur mit anderem `bakeDate` zaehlt hier nicht.
 * @param {number} [args.seasonFactor=1] Saisonfaktor (D10: Standard 1.0).
 * @param {object} [args.recipes] geparste Fuellungsrezepte je Fuellungs-ID.
 * @param {Array} [args.catalog] hq-Produkte `{id, numeric_id}`, um numerische IDs aufzuloesen.
 * @param {boolean} [args.includeEmpty=false] auch Zeilen ohne jede Menge liefern.
 * @param {Iterable<string>} [args.onlyItems] Z10: nur Zeilen dieser Posten.
 * @param {string} [args.sheetDate] Z10: der Teigtag, fuer den gerechnet wird;
 *   mit `onlyItems` oder `sheetDate` tragen die Zeilen die v2-Felder.
 */
function computeDay(args) {
  const a = args || {}
  const r = computeLines(a)
  if (r.error) return r
  const { cfg, date, weekday, open, seasonFactor, sections, lines, warnings } =
    r
  const hefeteig = computeHefeteig(cfg, lines)
  const fillings = computeFillings(cfg, lines, a.recipes || {}, warnings)
  const prep = open ? computePrep(cfg, lines, weekday) : []

  return {
    date,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday],
    open,
    seasonFactor,
    sections,
    lines,
    hefeteig,
    fillings,
    prep,
    warnings,
  }
}

/**
 * Hefeteig-Zusammenfassung: Teigstuecke, Teiggewicht, Chargen und eine
 * Abwiegeliste je Teig und Stueckgewicht.
 *
 * Gezaehlt werden Posten mit Teigstuecken (`dough.piece_g`); Brot je Groesse
 * und Broetchen in Bruch (Z10) rechnet `backzettel-dough.core.js`. Ist das
 * Stueckgewicht oder die Stueckzahl je Produkt offen (`null`), ist das
 * Teiggewicht des Teigs unbekannt (`dough_g: null`, keine Chargen) - nie 0.
 *
 * Mit `{ withLiters: true }` (der Zettel je Teigtag, Z10) traegt jeder Teig
 * dazu `kg`, `kgKnown`, `complete`, `missing` und `liters` (kg ÷ kg je Liter,
 * Regel 2), das Ganze `complete`.
 */
function computeHefeteig(cfg, lines, options) {
  const withLiters = Boolean(options && options.withLiters)
  // Z10: die Teigsummen des Zettels (`summarizeDoughs`) - kg, Liter,
  // Chargen und Vollständigkeit kommen von dort, damit Hefeteig-Karte und
  // Maschinenleiste dieselbe Zahl zeigen (eine Regel).
  const summaries = new Map(
    (options && Array.isArray(options.summaries) ? options.summaries : []).map(
      (d) => [d.id, d]
    )
  )
  const itemsById = new Map(cfg.items.map((i) => [i.id, i]))
  const byDough = new Map()
  for (const line of lines) {
    const item = itemsById.get(line.itemId)
    if (!item || !doughCore.isPieceItem(item)) continue
    const unknownQty = withLiters && doughCore.qtyUnknown(line)
    if (!(line.total > 0) && !unknownQty) continue
    const dough = cfg.doughs.find((d) => d.id === item.dough.id) || {
      id: item.dough.id,
      name: item.dough.id === null ? 'Teig offen' : item.dough.id,
      batch_max_kg: null,
      kg_per_liter: null,
      liter_rounding: null,
    }
    let entry = byDough.get(dough.id)
    if (!entry) {
      entry = {
        id: dough.id,
        name: dough.name,
        batch_max_kg: dough.batch_max_kg,
        record: dough,
        pieces: 0,
        piecesKnown: true,
        dough_g: 0,
        missing: [],
        batches: null,
        weights: new Map(),
      }
      byDough.set(dough.id, entry)
    }
    if (unknownQty) {
      // Grundmenge offen: der Teig ist unvollständig, nie „0“ (Regel 8)
      entry.missing.push({
        itemId: item.id,
        name: item.name,
        field: 'base',
        code: 'base_unset',
        message: `„${
          line.variantLabel ? `${item.name} – ${line.variantLabel}` : item.name
        }“: Grundmenge ist noch nicht festgelegt.`,
      })
      entry.baseUnset = true
      if (!(line.total > 0)) continue
    }
    const perProduct = item.dough.pieces
    const pieceG = item.dough.piece_g
    const pieces =
      typeof perProduct === 'number' ? line.total * perProduct : null
    if (pieces === null) {
      entry.piecesKnown = false
      entry.missing.push({
        itemId: item.id,
        name: item.name,
        field: 'dough.pieces',
        code: 'pieces_unknown',
        message: `„${item.name}“: Teigstücke je Produkt sind noch offen – das Teiggewicht bleibt unbekannt.`,
      })
    } else {
      entry.pieces += pieces
      if (typeof pieceG === 'number') entry.dough_g += pieces * pieceG
      else
        entry.missing.push({
          itemId: item.id,
          name: item.name,
          field: 'dough.piece_g',
          code: 'piece_g_unknown',
          message: `„${item.name}“: Gramm je Teigstück sind noch offen.`,
        })
    }
    let w = entry.weights.get(pieceG)
    if (!w) {
      w = { piece_g: pieceG, pieces: 0, items: new Map() }
      entry.weights.set(pieceG, w)
    }
    if (pieces !== null) w.pieces += pieces
    else w.piecesUnknown = true
    const wi = w.items.get(item.id) || {
      itemId: item.id,
      name: item.name,
      products: 0,
      piecesPerProduct: perProduct,
      pieces: 0,
    }
    wi.products += line.total
    if (pieces !== null && wi.pieces !== null) wi.pieces += pieces
    else wi.pieces = null
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
      const complete = e.missing.length === 0
      const doughG = complete ? e.dough_g : null
      const out = {
        id: e.id,
        name: e.name,
        batch_max_kg: e.batch_max_kg,
        pieces: e.piecesKnown ? e.pieces : null,
        dough_g: doughG,
        batches:
          e.batch_max_kg && doughG !== null
            ? Math.ceil(doughG / (e.batch_max_kg * 1000) - EPSILON)
            : null,
        weighing: [...e.weights.values()]
          .sort((x, y) => (y.piece_g || 0) - (x.piece_g || 0))
          .map((w) => ({
            piece_g: w.piece_g,
            pieces: w.piecesUnknown ? null : w.pieces,
            items: [...w.items.values()],
          })),
      }
      if (withLiters) {
        const kg = doughG === null ? null : Math.round(doughG) / 1000
        Object.assign(out, {
          kg,
          kgKnown: Math.round(e.dough_g) / 1000,
          complete,
          missing: e.missing,
          liters: doughCore.litersFor(e.record, kg),
          // Teigstücke ohne die Posten mit offener Grundmenge
          piecesComplete: !e.baseUnset && e.piecesKnown,
        })
        const s = summaries.get(e.id)
        if (s) {
          Object.assign(out, {
            kg: s.kg,
            kgKnown: s.kgKnown,
            complete: s.complete,
            missing: s.missing,
            liters: s.liters,
            batches: s.batches,
            dough_g: s.kg === null ? null : Math.round(s.kg * 1000),
          })
        }
      }
      return out
    })
  const sum = (field) =>
    doughs.some((d) => d[field] === null)
      ? null
      : doughs.reduce((s, d) => s + d[field], 0)
  const out = {
    doughs,
    pieces: sum('pieces'),
    dough_g: sum('dough_g'),
  }
  if (withLiters) out.complete = doughs.every((d) => d.complete)
  return out
}

/**
 * Fuellungsbedarf je Fuellung (= Variante) und das darauf skalierte Rezept.
 */
function computeFillings(cfg, lines, recipes, warnings, options) {
  // Z10 (Teigtag-Zettel): ein gefüllter Posten mit offener Grundmenge macht
  // den Bedarf seiner Füllung unvollständig (Regel 1/8) - auch mit 0 Stück,
  // damit die Füllung als „offen“ erscheint statt zu fehlen.
  const withOpen = Boolean(options && options.withOpenBase)
  const itemsById = new Map(cfg.items.map((i) => [i.id, i]))
  const byFilling = new Map()
  for (const line of lines) {
    const item = itemsById.get(line.itemId)
    if (!item || !item.filling_g) continue
    const openBase =
      withOpen && line.variant !== null && doughCore.qtyUnknown(line)
    if (!(line.total > 0) && !openBase) continue
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
    if (openBase) {
      // nur dann gesetzt: ohne offene Grundmenge bleibt die Form wie v1
      entry.baseUnset = true
      if (!entry.openItems) entry.openItems = []
      const label = line.variantLabel
        ? `${item.name} – ${line.variantLabel}`
        : item.name
      if (!entry.openItems.includes(label)) entry.openItems.push(label)
      if (!(line.total > 0)) continue
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
        // Regel 7 (Z10): ohne alle Gramm kein hochgerechnetes Rezept - eine
        // Teilmenge saehe aus wie der ganze Bedarf.
        recipe:
          recipe && e.grams > 0 && !e.missingFillingG && !e.baseUnset
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
    const labels = task.variant_labels
    const variantLabel =
      variant && labels && Object.prototype.hasOwnProperty.call(labels, variant)
        ? labels[variant]
        : null
    out.push({
      id: task.id,
      name: task.name,
      variant,
      variantLabel,
      note: task.note,
    })
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
 * @param {object} [args.plan] Z10: Plan des Zettels (`planForSheet`). Eine
 *   Position zaehlt, wenn ihr Abholtag ein Backtag des Plans ist und der Plan
 *   den Posten an diesem Backtag traegt; jede Zeile traegt dann `bakeDate`,
 *   der Schluessel `itemId|variant@bakeDate`, wenn der Backtag nicht der
 *   Zettel-Tag ist. Ohne Plan wie v1 (`legacyPlan(date)`, ohne `bakeDate`).
 * @returns {Array<{key, itemId, name, unit, variant, preorderId, before, after, qty, kind, bakeDate?}>}
 *   `kind`: `added` (vorher 0), `cancelled` (jetzt 0) oder `changed`.
 */
function computePreorderDeltas(args) {
  const a = args || {}
  if (!isValidDate(a.date)) return []
  const cfg = ensureNormalized(a.config)
  const plan = a.plan || null
  if (!plan && !cfg.days.includes(isoWeekday(a.date))) return []
  const resolve = createProductResolver(cfg, a.catalog)
  const bakeDates = plan
    ? planCore
        .planBakeDates(plan)
        .filter((d) => isValidDate(d) && cfg.days.includes(isoWeekday(d)))
    : [a.date]

  const sum = (list) => {
    const out = new Map()
    for (const raw of asPreorderItems(list)) {
      const pickup = raw && (raw.pickupDate || raw.date)
      if (!bakeDates.includes(pickup)) continue
      const qty = countablePreorderQty(raw, pickup)
      if (qty === null) continue
      const hit = resolve(raw.productSlug || raw.productId)
      if (!hit) continue // unbekannte Produkte meldet computeDay
      if (plan && !planCore.planCovers(cfg, plan, pickup, hit.item)) continue
      const variant = hit.size ? hit.size : cleanVariant(hit.item, raw.variant)
      const preorderId =
        raw.preorderId === undefined || raw.preorderId === null
          ? null
          : raw.preorderId
      const k = `${String(preorderId)}#${lineKey(hit.item.id, variant)}${
        plan ? `@${pickup}` : ''
      }`
      const e = out.get(k) || {
        item: hit.item,
        variant,
        preorderId,
        bakeDate: pickup,
        qty: 0,
      }
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
      key: plan
        ? lineKey(ref.item.id, ref.variant, ref.bakeDate, plan.doughDate)
        : lineKey(ref.item.id, ref.variant),
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
      ...(plan ? { bakeDate: ref.bakeDate } : {}),
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

// ---------------------------------------------------------------------------
// Zettel je Teigtag (Z10, docs/backzettel-v2.md §4.3) und Backliste (§4.4)
// ---------------------------------------------------------------------------

/** Zeilen-Reihenfolge eines Zettels: Abschnitt, Backtag, Stammdaten. */
function sortSheetLines(cfg, tagged) {
  const sectionIndex = (id) => {
    const i = cfg.sections.indexOf(id)
    return i === -1 ? Infinity : i
  }
  return tagged
    .sort(
      (x, y) =>
        sectionIndex(x.line.section) - sectionIndex(y.line.section) ||
        String(x.line.bakeDate || '').localeCompare(
          String(y.line.bakeDate || '')
        ) ||
        x.index - y.index
    )
    .map((t) => t.line)
}

function sectionsOf(cfg, lines) {
  return cfg.sections
    .map((id) => ({
      id,
      label: SECTION_LABELS[id] || id,
      lines: lines.filter((l) => l.section === id),
    }))
    .filter((s) => s.lines.length > 0)
}

/** Lücken der Füllungen: gefüllte Posten auf dem Zettel ohne Gramm. */
function fillingGaps(cfg, fillings) {
  const out = []
  for (const f of Array.isArray(fillings) ? fillings : []) {
    for (const it of f.items || []) {
      if (it.grams !== null) continue
      const index = cfg.items.findIndex((i) => i.id === it.itemId)
      out.push({
        path: `items[${index}].filling_g`,
        code: 'filling_g_unknown',
        message: `Posten „${it.name}“: Füllungsgramm ist noch offen – der Füllungsbedarf steht nur in Stück.`,
      })
    }
  }
  return out
}

/**
 * Hefeteig, Füllungen, Teige, Brot- und Brötchen-Ansicht und offene
 * Stammdaten aus den Zeilen eines Zettels - gemeinsam für den Entwurf und
 * (aus den eingefrorenen Zeilen) für einen freigegebenen Zettel.
 */
function sheetParts(cfg, lines, sheetDate, recipes, warnings) {
  const doughs = doughCore.computeSheetDoughs(cfg, lines, sheetDate)
  const hefeteig = computeHefeteig(
    cfg,
    lines.filter((l) => l.section === 'hefeteig'),
    { withLiters: true, summaries: doughs.doughs }
  )
  const fillings = computeFillings(cfg, lines, recipes || {}, warnings, {
    withOpenBase: true,
  })
  return {
    hefeteig,
    fillings,
    doughs: doughs.doughs,
    machine: doughs.machine,
    bread: doughCore.breadView(cfg, lines, doughs.parts, sheetDate),
    rolls: doughCore.rollsView(cfg, lines, doughs.groups, sheetDate),
    openMasterData: doughCore.dedupeGaps([
      ...doughs.gaps,
      ...fillingGaps(cfg, fillings),
    ]),
  }
}

/**
 * Der Zettel eines Teigtags D: alle Zeilen, deren Teig an D gemacht wird -
 * die Posten mit lead 0, die an D gebacken werden, und die Posten mit
 * lead > 0, deren Teigtag D ist (Samstag: Brötchen für Sonntag und Dienstag).
 * Vorbestellungen und CAP gehören zum Backtag; Saisonfaktor und Vorbereitung
 * zum Zettel. Eine Superset-Form von `computeDay` (v1-Felder plus Z10).
 *
 * @param {object} args
 * @param {object} args.config Stammdaten.
 * @param {string} args.date Teigtag D.
 * @param {number} [args.seasonFactor] Saisonfaktor des Zettels (für alle Backtage).
 * @param {Record<string, {preorderItems?: Array, capTemplate?: object|Array}>} [args.bakeInputs]
 *   je Backtag; fehlt ein Backtag, gelten `preorderItems`/`capTemplate` (nach
 *   Abholtag bzw. Wochentag gefiltert).
 * @param {Array} [args.preorderItems]
 * @param {object|Array} [args.capTemplate]
 * @param {Array} [args.corrections] `{bakeDate?, itemId, variant?, qty, reason?}`;
 *   ohne `bakeDate` gilt D.
 * @param {Iterable<string>} [args.owned] `${bakeDate}|${itemId}`, die ein
 *   anderer freigegebener Zettel trägt (§5.4) - hier ausgelassen.
 * @param {object} [args.recipes]
 * @param {Array} [args.catalog]
 * @param {boolean} [args.includeEmpty]
 */
function computeDoughDay(args) {
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
  const seasonFactor = seasonFactorOf(a.seasonFactor, warnings)
  const owned = new Set(a.owned || [])
  // Posten des eigenen Backtags, die sonst auf keinem Zettel stünden (§5.4)
  const adopted = (Array.isArray(a.adopted) ? a.adopted : [])
    .map((x) => (typeof x === 'string' ? { itemId: x, doughDate: null } : x))
    .filter(
      (x) =>
        x &&
        cfg.items.some((i) => i.id === x.itemId) &&
        !owned.has(planCore.ownedKey(date, x.itemId))
    )
  const adoptedIds = new Set(adopted.map((x) => x.itemId))
  const plan = planCore.planForSheet(cfg, date, owned, adoptedIds)

  // Paare, die ein anderer freigegebener Zettel schon trägt (§5.4)
  const full = owned.size > 0 ? planCore.planForSheet(cfg, date) : plan
  const skipped = []
  for (const b of full.bakeDates) {
    const kept = plan.bakeDates.find((x) => x.date === b.date)
    for (const itemId of b.itemIds) {
      if (!kept || !kept.itemIds.includes(itemId))
        skipped.push({ date: b.date, itemId })
    }
  }

  const corrections = (Array.isArray(a.corrections) ? a.corrections : [])
    .filter(Boolean)
    .map((c) => ({
      ...c,
      bakeDate:
        c.bakeDate === undefined || c.bakeDate === null || c.bakeDate === ''
          ? date
          : c.bakeDate,
    }))
  const inputsFor = (b) => {
    const own = a.bakeInputs && a.bakeInputs[b] ? a.bakeInputs[b] : {}
    return {
      preorderItems:
        own.preorderItems !== undefined ? own.preorderItems : a.preorderItems,
      capTemplate:
        own.capTemplate !== undefined ? own.capTemplate : a.capTemplate,
    }
  }

  // Der Teigtag selbst zählt immer (Hinweise des Tages), auch als Ruhetag.
  const runs = plan.bakeDates.some((b) => b.date === date)
    ? plan.bakeDates
    : [{ date, itemIds: [] }, ...plan.bakeDates]
  const tagged = []
  const lineCounts = new Map()
  for (const b of runs) {
    const r = computeLines({
      config: cfg,
      date: b.date,
      ...inputsFor(b.date),
      corrections: corrections.filter((c) => c.bakeDate === b.date),
      seasonFactor,
      seasonFactorChecked: true,
      catalog: a.catalog,
      includeEmpty: a.includeEmpty,
      onlyItems: b.itemIds,
      sheetDate: date,
    })
    lineCounts.set(b.date, r.lines.length)
    r.lines.forEach((line, index) => tagged.push({ line, index }))
    for (const w of r.warnings) {
      warnings.push(b.date === date ? w : { ...w, bakeDate: b.date })
    }
  }
  // Übernommene Posten: auf diesem Zettel, Teig am Backtag selbst
  if (adopted.length > 0) {
    for (const { line } of tagged) {
      if (line.bakeDate === date && adoptedIds.has(line.itemId)) {
        line.doughDate = date
        line.lead = 0
        line.adopted = true
      }
    }
    const byDough = new Map()
    for (const x of adopted) {
      const k = x.doughDate || ''
      if (!byDough.has(k)) byDough.set(k, [])
      const item = cfg.items.find((i) => i.id === x.itemId)
      byDough.get(k).push(item ? item.name : x.itemId)
    }
    for (const [dd, names] of byDough) {
      warnings.push({
        code: 'adopted_orphans',
        doughDate: dd || null,
        items: adopted
          .filter((x) => (x.doughDate || '') === dd)
          .map((x) => x.itemId),
        message: `${names.join(', ')} ${
          names.length === 1 ? 'steht' : 'stehen'
        } hier, weil ${
          dd
            ? `der Zettel vom ${dayLabel(dd)} schon freigegeben ist und ${
                names.length === 1 ? 'ihn' : 'sie'
              } nicht enthält`
            : 'sie sonst auf keinem Zettel stünden'
        }. Soll${names.length === 1 ? '' : 'en'} ${
          names.length === 1 ? 'er' : 'sie'
        } dort gemacht werden: dort „Wieder öffnen“ und neu freigeben.`,
      })
    }
  }
  // Korrekturen für Paare, die dieser Zettel nicht trägt: nie still weg
  const planned = (b, itemId) =>
    plan.bakeDates.some((x) => x.date === b && x.itemIds.includes(itemId))
  const foreign = corrections.filter(
    (c) =>
      Number(c.qty) !== 0 &&
      Number.isFinite(Number(c.qty)) &&
      cfg.items.some((i) => i.id === c.itemId) &&
      isValidDate(c.bakeDate) &&
      cfg.days.includes(isoWeekday(c.bakeDate)) &&
      !planned(c.bakeDate, c.itemId)
  )
  if (foreign.length > 0) {
    warnings.push({
      code: 'correction_not_on_sheet',
      items: foreign.map((c) => ({
        itemId: c.itemId,
        variant: c.variant === undefined ? null : c.variant,
        bakeDate: c.bakeDate,
        qty: Number(c.qty),
      })),
      message: `Korrektur ${foreign
        .map((c) => {
          const item = cfg.items.find((i) => i.id === c.itemId)
          const n = Number(c.qty)
          return `${n > 0 ? '+' : ''}${String(n).replace('.', ',')} ${
            item ? item.name : c.itemId
          } (für ${WEEKDAY_NAMES[isoWeekday(c.bakeDate)]})`
        })
        .join(
          ', '
        )} gehört nicht mehr zu diesem Zettel und wird hier nicht gerechnet - beim Freigeben fällt sie weg. Bitte auf dem Zettel eintragen, der die Ware jetzt trägt.`,
    })
  }
  if (skipped.length > 0) {
    const names = skipped.map((s) => {
      const item = cfg.items.find((i) => i.id === s.itemId)
      return `${item ? item.name : s.itemId} (für ${
        WEEKDAY_NAMES[isoWeekday(s.date)]
      })`
    })
    warnings.push({
      code: 'owned_elsewhere',
      items: skipped,
      message: `Schon auf einem anderen freigegebenen Zettel: ${names.join(
        ', '
      )} - hier nicht noch einmal gerechnet.`,
    })
  }

  const lines = sortSheetLines(cfg, tagged)
  const open = cfg.days.includes(weekday)
  const parts = sheetParts(cfg, lines, date, a.recipes, warnings)
  const prep = open ? computePrep(cfg, lines, weekday) : []

  return {
    date,
    weekday,
    weekdayName: WEEKDAY_NAMES[weekday],
    open,
    seasonFactor,
    sections: sectionsOf(cfg, lines),
    lines,
    hefeteig: parts.hefeteig,
    fillings: parts.fillings,
    prep,
    warnings,
    sheetVersion: 2,
    isDoughDay: planCore.isDoughDay(cfg, date),
    bakeDates: plan.bakeDates.map((b) => ({
      date: b.date,
      weekday: isoWeekday(b.date),
      weekdayName: WEEKDAY_NAMES[isoWeekday(b.date)],
      label: doughCore.bakeDayLabel(b.date, date),
      lineCount: lineCounts.get(b.date) || 0,
    })),
    // Posten, die es beim Freigeben gab: ein später in hq ergänzter Posten
    // bleibt mit seinen Vorbestellungen bei diesem Zettel (`planCovers`).
    plan: { ...plan, knownItems: cfg.items.map((i) => i.id) },
    doughs: parts.doughs,
    machine: parts.machine,
    bread: parts.bread,
    rolls: parts.rolls,
    openMasterData: parts.openMasterData,
  }
}

/**
 * Übergang (§5.4, docs/backzettel-v2.md §9.2): was an Posten auf keinem
 * Zettel stünde, weil ihr Teigtag ein freigegebener Zettel ist, der sie nicht
 * trägt. Ein Entwurf ihres Backtags nimmt sie auf (`adopted`, an
 * `computeDoughDay`); ist auch der freigegeben, stehen sie auf keinem Zettel
 * (`not_on_confirmed_sheet`). Ein freigegebener Teigtag-Zettel sagt, wohin
 * seine Posten gewandert sind (`moved_to_bake_day`).
 *
 * @param {object} config Stammdaten.
 * @param {string} date der Zettel (Teigtag) bzw. Backtag.
 * @param {Array<{date: string, plan: object}>} confirmed freigegebene Zettel
 *   in [date − 14, date + 14] (Plan aus `computed_snapshot`, alte Tage `legacyPlan`).
 * @returns {{ adopted: Array<{itemId, name, doughDate}>, warnings: Array, lostOwn: Array }}
 *   `adopted` für den Entwurf des Zettels `date`; `warnings` für den Zettel
 *   `date` (nur wenn er freigegeben ist); `lostOwn` = Posten des Backtags
 *   `date`, die auf keinem Zettel stehen (für die Backliste).
 */
function transitionFor(config, date, confirmed) {
  const cfg = ensureNormalized(config)
  const list = Array.isArray(confirmed) ? confirmed : []
  const isConfirmed = (d) => list.some((c) => c.date === d)
  const own = planCore.orphanedItems(cfg, date, list)
  const lostText = (items, bakeDate) =>
    `${items.map((i) => i.name).join(', ')} für ${dayLabel(bakeDate)} ${
      items.length === 1 ? 'steht' : 'stehen'
    } auf keinem Zettel: der Zettel vom ${dayLabel(
      items[0].doughDate
    )} wurde vor der Umstellung freigegeben. Bitte einen der Zettel „Wieder öffnen“ und neu freigeben.`
  const warnings = []
  const lostOwn = isConfirmed(date) ? own : []
  if (isConfirmed(date)) {
    const byDough = new Map()
    for (const o of own) {
      if (!byDough.has(o.doughDate)) byDough.set(o.doughDate, [])
      byDough.get(o.doughDate).push(o)
    }
    for (const [dd, items] of byDough) {
      warnings.push({
        code: 'not_on_confirmed_sheet',
        bakeDate: date,
        doughDate: dd,
        items: items.map((i) => i.itemId),
        message: lostText(items, date),
      })
    }
    for (const b of planCore.bakeDatesFor(cfg, date)) {
      if (b === date) continue
      const items = planCore
        .orphanedItems(cfg, b, list)
        .filter((o) => o.doughDate === date)
      if (items.length === 0) continue
      warnings.push(
        isConfirmed(b)
          ? {
              code: 'not_on_confirmed_sheet',
              bakeDate: b,
              doughDate: date,
              items: items.map((i) => i.itemId),
              message: lostText(items, b),
            }
          : {
              code: 'moved_to_bake_day',
              bakeDate: b,
              doughDate: date,
              items: items.map((i) => i.itemId),
              message: `${items.map((i) => i.name).join(', ')} für ${dayLabel(
                b
              )} ${
                items.length === 1 ? 'steht' : 'stehen'
              } nicht auf diesem Zettel (vor der Umstellung freigegeben), sondern auf dem Zettel vom ${dayLabel(
                b
              )}.`,
            }
      )
    }
  }
  return { adopted: isConfirmed(date) ? [] : own, warnings, lostOwn }
}

/**
 * Backliste eines Backtags (§4.4): was an `bakeDate` gebacken wird, aus allen
 * Zetteln, die dafür Teig machen - ohne Teigzahlen. Für die Person, die nur
 * backt (Sonntag).
 *
 * @param {object} config Stammdaten.
 * @param {string} bakeDate Backtag.
 * @param {Array<{doughDate: string, status: 'draft'|'confirmed', lines: Array, deltas?: Array, rolls?: Array}>} sources
 *   die Zettel (Entwurf live gerechnet, freigegeben aus den gespeicherten
 *   Zeilen); Zeilen und Nachträge anderer Backtage werden ausgelassen.
 *   Ohne Stammdaten (`config` null) kommen die Brötchen aus den
 *   eingefrorenen `rolls` der Zettel.
 */
function bakeListFromLines(config, bakeDate, sources) {
  const cfg = ensureNormalized(config)
  const warnings = []
  const lines = []
  const deltas = []
  const seen = new Map()
  const itemOrder = new Map(cfg.items.map((item, i) => [item.id, i]))
  for (const src of Array.isArray(sources) ? sources : []) {
    if (!src) continue
    const doughDate = src.doughDate
    for (const line of Array.isArray(src.lines) ? src.lines : []) {
      if (!line) continue
      const b = line.bakeDate || doughDate
      if (b !== bakeDate) continue
      const id = `${line.itemId}|${line.variant || ''}`
      if (seen.has(id) && seen.get(id) !== doughDate) {
        warnings.push({
          code: 'duplicate_bake_line',
          itemId: line.itemId,
          variant: line.variant === undefined ? null : line.variant,
          message: `„${
            line.name
          }“ steht für diesen Backtag auf zwei Zetteln (${seen.get(
            id
          )} und ${doughDate}) - bitte prüfen.`,
        })
      }
      seen.set(id, doughDate)
      lines.push({
        ...line,
        bakeDate,
        doughDate,
        sheetStatus: src.status,
        madeOn:
          doughDate === bakeDate
            ? 'Teig von heute'
            : `Teig vom ${WEEKDAY_NAMES[isoWeekday(doughDate)]}`,
      })
    }
    for (const d of Array.isArray(src.deltas) ? src.deltas : []) {
      if (!d || (d.bakeDate || doughDate) !== bakeDate) continue
      deltas.push({ ...d, bakeDate, doughDate })
    }
  }
  const variantRank = (line) => {
    const item = cfg.items.find((i) => i.id === line.itemId)
    if (!item) return 0
    const i =
      line.variant === null || line.variant === undefined
        ? item.variants.length
        : item.variants.indexOf(line.variant)
    return i === -1 ? item.variants.length + 1 : i
  }
  const sectionIndex = (id) => {
    const i = cfg.sections.indexOf(id)
    return i === -1 ? Infinity : i
  }
  lines.sort((x, y) => {
    const sx = sectionIndex(x.section)
    const sy = sectionIndex(y.section)
    if (sx !== sy) return sx - sy
    const ix = itemOrder.has(x.itemId) ? itemOrder.get(x.itemId) : Infinity
    const iy = itemOrder.has(y.itemId) ? itemOrder.get(y.itemId) : Infinity
    if (ix !== iy) return ix - iy
    return variantRank(x) - variantRank(y)
  })
  const sectionIds = [...cfg.sections]
  for (const l of lines)
    if (l.section && !sectionIds.includes(l.section)) sectionIds.push(l.section)
  const groups = doughCore.bruchGroups(cfg, lines, bakeDate)
  return {
    date: bakeDate,
    weekday: isoWeekday(bakeDate),
    weekdayName: WEEKDAY_NAMES[isoWeekday(bakeDate)],
    sections: sectionIds
      .map((id) => ({
        id,
        label: SECTION_LABELS[id] || id,
        lines: lines.filter((l) => l.section === id),
      }))
      .filter((s) => s.lines.length > 0),
    // Ohne Stammdaten (nur freigegebene Zettel): die eingefrorenen
    // Brötchen-Blöcke dieses Backtags, nie neu gerechnet.
    rolls: config
      ? doughCore.rollsView(cfg, lines, groups, bakeDate)
      : (Array.isArray(sources) ? sources : []).flatMap((src) =>
          (src && Array.isArray(src.rolls) ? src.rolls : [])
            .filter((r) => r && r.bakeDate === bakeDate)
            .map((r) => ({
              ...r,
              label:
                src.doughDate === bakeDate
                  ? 'heute'
                  : `Teig vom ${WEEKDAY_NAMES[isoWeekday(src.doughDate)]}`,
            }))
        ),
    deltas,
    warnings,
  }
}

module.exports = {
  computeDay,
  computeDoughDay,
  bakeListFromLines,
  sheetParts,
  computeDeltas,
  computePreorderDeltas,
  transitionFor,
  createProductResolver,
  variantsForProduct,
  variantsByProduct,
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
