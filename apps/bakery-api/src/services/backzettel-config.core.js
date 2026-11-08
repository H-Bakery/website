// Backzettel-Stammdaten (`hq/config/backzettel.yaml`): Schema-Pruefung und
// Normalisierung.
//
// Dependency-freies CommonJS wie `partner-stats.core.js`: diese Datei arbeitet
// auf einem bereits geparsten Objekt. Das YAML liest der duenne Loader
// `backzettel-config.loader.js`; das CLI `scripts/validate-backzettel.js`
// (vom hq-CI benutzt) und die API rufen beide genau diese Pruefung.
//
// Ein Backzettel-Posten ist ein *Produktionsposten*, kein Verkaufsprodukt. Er
// verweist mit einem Faktor auf hq-Produkte (ein Viertel = 0.25), hat optional
// Varianten (Fuellungen), ein Teigstueck, Fuellungsgramm, eine Blechposition
// und Grundmengen je ISO-Wochentag (1 = Montag ... 7 = Sonntag).
//
// Backzettel v2 (Z10, docs/backzettel-v2.md §2) ergaenzt - additiv, `version`
// bleibt 1 - Teigtage (`dough_days`, `items[].lead`), Teige als Stammdaten
// (`kg_per_liter`, `liter_rounding`, `combined_with`, `addons`), Brot je
// Laibgroesse (`sizes`, `products[].size`, `from_dough`) und Broetchen in
// Bruch (`bruch`, `bruch_pieces`). Eine Konfiguration ohne diese Schluessel
// ergibt dieselben Fehler und Warnungen wie vorher.
//
// Offene Stammdaten: `null` heisst „unbekannt“. Ein ausdrueckliches `null` auf
// einem offenen Feld ist weder Fehler noch Warnung, sondern steht in der
// dritten Liste `open` (`{ path, code, message }`); ein fehlender Schluessel
// gilt ebenso als unbekannt, mit Warnung. Die Normalisierung laesst den Wert
// `null` - nichts wird geschaetzt oder mit einem Standardwert gefuellt.

const SECTIONS = [
  'vorbereitung',
  'brot',
  'broetchen',
  'laugen',
  'kaffeestueckchen',
  'kuchen',
  'hefeteig',
]

const SECTION_LABELS = {
  vorbereitung: 'Vorbereitung',
  brot: 'Brot',
  broetchen: 'Brötchen',
  laugen: 'Laugen',
  kaffeestueckchen: 'Kaffeestückchen',
  kuchen: 'Kuchen',
  hefeteig: 'Hefeteig',
}

const UNITS = ['Stück', 'Liter', 'Blech', 'kg']
/** Einheiten, deren Mengen ganzzahlig sein muessen. Liter/kg duerfen Bruchteile haben (z. B. 1,25 l). */
const INTEGER_UNITS = new Set(['Stück', 'Blech'])

const WEEKDAY_NAMES = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/**
 * Groessen-IDs beginnen mit einem Buchstaben (`g500`, nicht `500`): sonst
 * macht YAML eine Zahl daraus, und in URLs liest sich die ID schlecht.
 */
const SIZE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** Hoechstens so viele Teigtage vor dem Backtag (Teiglinge zwei Tage voraus). */
const MAX_LEAD = 3
const ROUNDING_MODES = ['up', 'nearest', 'down']

const TOP_LEVEL_KEYS = new Set([
  'version',
  'days',
  'dough_days',
  'bruch_pieces',
  'sections',
  'items',
  'doughs',
  'fillings',
  'prep',
])
const ITEM_KEYS = new Set([
  'id',
  'name',
  'section',
  'unit',
  'products',
  'plu',
  'variants',
  'sizes',
  'dough',
  'filling_g',
  'tray',
  'base',
  'pieces_per_liter',
  'note',
  'lead',
  'bruch',
  'from_dough',
])
const SIZE_KEYS = new Set(['id', 'label', 'dough_g'])
const BRUCH_KEYS = new Set(['g', 'per_product', 'pieces', 'group'])
const FROM_DOUGH_KEYS = new Set(['id', 'mode', 'dough_kg', 'extras'])
const FROM_DOUGH_MODES = ['fixed', 'per_dough']
const ADDON_KEYS = new Set(['id', 'name', 'g_per_liter', 'rounding'])
/** Schluessel eines Teigs, die es erst seit Z10 gibt. */
const V2_DOUGH_KEYS = [
  'kg_per_liter',
  'liter_rounding',
  'combined_with',
  'combined_name',
  'addons',
]
const V2_ITEM_KEYS = ['lead', 'sizes', 'bruch', 'from_dough']
const PREP_KEYS = new Set([
  'id',
  'name',
  'by_weekday',
  'variant_labels',
  'when_item',
  'days',
  'note',
])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSlug(value) {
  return typeof value === 'string' && SLUG.test(value)
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/** Schluessel vorhanden und nicht `undefined` (JS-Objekte aus Tests). */
function isSet(obj, key) {
  return isPlainObject(obj) && hasOwn(obj, key) && obj[key] !== undefined
}

function isSizeId(value) {
  return typeof value === 'string' && SIZE_ID.test(value)
}

function isText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/** Rezepte liegen in hq unter diesem Verzeichnis; nur dort wird gelesen. */
const RECIPE_DIR = 'data/recipes/'

/**
 * `fillings[].recipe` muss ein relativer Pfad unter `data/recipes/` sein, der
 * auf `.md` endet - ohne `..`, `.`, leere Segmente, Backslash oder absoluten
 * Pfad. Die YAML schreibt spaeter die App (B5b) und das hq-CI merged sie
 * (H2); ein Pfad wie `/etc/passwd` oder `../../x` darf nie gelesen werden.
 */
function isSafeRecipePath(value) {
  if (typeof value !== 'string') return false
  if (!value.startsWith(RECIPE_DIR) || !value.endsWith('.md')) return false
  if (/[\\\0]/.test(value)) return false
  return value
    .split('/')
    .every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

/** YAML-Schluessel `6:` kommen als String "6" im Objekt an. */
function weekdayKey(key) {
  const n = Number(key)
  return Number.isInteger(n) && String(n) === String(key).trim() ? n : null
}

/**
 * Erlaubte Produkt-IDs aus dem hq-Katalog. Nimmt Strings oder Objekte mit
 * `id` (und optional `available`). `null`/`undefined` heisst: nicht pruefen.
 */
function catalogIndex(products) {
  if (!Array.isArray(products)) return null
  const index = new Map()
  for (const p of products) {
    if (typeof p === 'string') index.set(p, { id: p })
    else if (p && typeof p.id === 'string') index.set(p.id, p)
  }
  return index
}

function isLead(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_LEAD
}

function warnUnknownKeys(obj, allowed, path, warn) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key))
      warn(`${path}.${key}`, `Unbekannter Schlüssel „${key}“ wird ignoriert.`)
  }
}

/** `{ step > 0, mode: up|nearest|down }` - Liter- bzw. Gramm-Rundung (Z10). */
function validateRounding(path, value, err, warn) {
  if (!isPlainObject(value)) {
    err(path, 'Rundung muss { step, mode } oder null sein.')
    return
  }
  warnUnknownKeys(value, new Set(['step', 'mode']), path, warn)
  if (!isPositiveNumber(value.step))
    err(`${path}.step`, 'step (Rundungsschritt) muss eine Zahl größer 0 sein.')
  if (!ROUNDING_MODES.includes(value.mode))
    err(
      `${path}.mode`,
      `mode muss ${ROUNDING_MODES.join(
        ', '
      )} sein (aufrunden, kaufmännisch, abrunden).`
    )
}

/**
 * `lead` in fester Form: `{ default, <ISO-Wochentag des Backtags>: n }`.
 * Ohne Angabe 0 (Teig am Backtag); eine Zahl gilt fuer alle Backtage.
 */
function normalizeLead(raw) {
  if (Number.isInteger(raw)) return { default: raw }
  const out = { default: 0 }
  if (!isPlainObject(raw)) return out
  if (Number.isInteger(raw.default)) out.default = raw.default
  for (const [key, v] of Object.entries(raw)) {
    if (key === 'default') continue
    const wd = weekdayKey(key)
    if (wd !== null && Number.isInteger(v)) out[wd] = v
  }
  return out
}

/**
 * Bruchgewicht in fester Form: `{ default, <ISO-Wochentag des Backtags>: g }`,
 * jeder Wert Gramm oder `null` (unbekannt). Eine Zahl gilt fuer alle Backtage,
 * ein fehlendes `default` ist `null` - nie ein Schaetzwert.
 */
function normalizeBruchG(raw) {
  if (isPositiveNumber(raw)) return { default: raw }
  const out = { default: null }
  if (!isPlainObject(raw)) return out
  if (isPositiveNumber(raw.default)) out.default = raw.default
  for (const [key, v] of Object.entries(raw)) {
    if (key === 'default') continue
    const wd = weekdayKey(key)
    if (wd !== null) out[wd] = isPositiveNumber(v) ? v : null
  }
  return out
}

function validateBruchG(b, path, label, daySet, r) {
  const { err, warn, markOpen } = r
  if (!isSet(b, 'g')) {
    warn(
      `${path}.g`,
      `Posten „${label}“: Bruchgewicht (bruch.g) fehlt; die kg dieses Teigs bleiben unbekannt.`
    )
  } else if (b.g === null) {
    markOpen(
      `${path}.g`,
      'bruch_g_unknown',
      `Posten „${label}“: Bruchgewicht ist noch offen.`
    )
  } else if (isPlainObject(b.g)) {
    for (const [key, g] of Object.entries(b.g)) {
      const gp = `${path}.g.${key}`
      let wd = null
      if (key !== 'default') {
        wd = weekdayKey(key)
        if (wd === null || !daySet.has(wd)) {
          err(gp, `„${key}“ ist kein Backtag (days) und nicht „default“.`)
          continue
        }
      }
      if (g === null) {
        markOpen(
          gp,
          'bruch_g_unknown',
          wd === null
            ? `Posten „${label}“: Bruchgewicht (übrige Backtage) ist noch offen.`
            : `Posten „${label}“: Bruchgewicht am ${WEEKDAY_NAMES[wd]} ist noch offen.`
        )
      } else if (!isPositiveNumber(g)) {
        err(
          gp,
          'Bruchgewicht muss eine Zahl größer 0 (Gramm je Bruch) oder null sein.'
        )
      }
    }
    if (!hasOwn(b.g, 'default'))
      warn(
        `${path}.g.default`,
        `Posten „${label}“: Bruchgewicht ohne default; an den übrigen Backtagen bleibt es unbekannt.`
      )
  } else if (!isPositiveNumber(b.g)) {
    err(
      `${path}.g`,
      'bruch.g muss eine Zahl größer 0 (Gramm je Bruch), eine Zuordnung je Backtag oder null sein.'
    )
  }
}

function validateFromDough(f, path, label, r) {
  const { hasSizes, doughIds, err, warn, markOpen } = r
  if (!isPlainObject(f)) {
    err(path, 'from_dough muss { id, mode, dough_kg, extras? } sein.')
    return
  }
  warnUnknownKeys(f, FROM_DOUGH_KEYS, path, warn)
  if (!hasSizes)
    err(
      path,
      `Posten „${label}“ hat from_dough, aber keine sizes; einen Anteil an einem Teig gibt es nur für Brot je Laib.`
    )
  if (typeof f.id !== 'string' || !doughIds.has(f.id))
    err(`${path}.id`, `Teig ${JSON.stringify(f.id)} steht nicht in doughs.`)
  const from = typeof f.id === 'string' ? f.id : '?'
  if (!isSet(f, 'mode')) {
    warn(
      `${path}.mode`,
      `Posten „${label}“: from_dough.mode fehlt; der Teig „${from}“ bleibt unvollständig.`
    )
  } else if (f.mode === null) {
    markOpen(
      `${path}.mode`,
      'from_dough_mode_unknown',
      `Posten „${label}“: Anteil am Teig „${from}“ (fest je Ansatz oder je Teig) ist noch offen – der Teig bleibt unvollständig.`
    )
  } else if (!FROM_DOUGH_MODES.includes(f.mode)) {
    err(
      `${path}.mode`,
      `mode muss ${FROM_DOUGH_MODES.join(' oder ')} sein (oder null).`
    )
  }
  if (!isSet(f, 'dough_kg')) {
    warn(
      `${path}.dough_kg`,
      `Posten „${label}“: from_dough.dough_kg fehlt; der Anteil am Teig „${from}“ bleibt unbekannt.`
    )
  } else if (f.dough_kg === null) {
    markOpen(
      `${path}.dough_kg`,
      'from_dough_kg_unknown',
      `Posten „${label}“: kg Teig „${from}“ je Ansatz sind noch offen.`
    )
  } else if (!isPositiveNumber(f.dough_kg)) {
    err(`${path}.dough_kg`, 'dough_kg muss eine Zahl größer 0 oder null sein.')
  }
  if (isSet(f, 'extras') && f.extras !== null) {
    if (!Array.isArray(f.extras)) {
      err(`${path}.extras`, 'extras muss eine Liste von { name, kg } sein.')
      return
    }
    f.extras.forEach((x, j) => {
      const xp = `${path}.extras[${j}]`
      if (!isPlainObject(x))
        return err(xp, 'Eine Zugabe muss { name, kg } sein.')
      warnUnknownKeys(x, new Set(['name', 'kg']), xp, warn)
      if (!isText(x.name))
        err(`${xp}.name`, 'name muss ein nicht-leerer Text sein.')
      const xName = isText(x.name) ? x.name : xp
      if (!isSet(x, 'kg')) {
        warn(
          `${xp}.kg`,
          `Posten „${label}“: kg für „${xName}“ fehlen; die Zugabe bleibt unbekannt.`
        )
      } else if (x.kg === null) {
        markOpen(
          `${xp}.kg`,
          'extra_kg_unknown',
          `Posten „${label}“: kg „${xName}“ sind noch offen.`
        )
      } else if (!isPositiveNumber(x.kg)) {
        err(`${xp}.kg`, 'kg muss eine Zahl größer 0 oder null sein.')
      }
    })
  }
}

/**
 * Z10-Teigfelder (docs/backzettel-v2.md §2.3): kg je Liter, Literrundung,
 * zusammengelegte Teige und Zugaben. `usesV2`: nur dann warnt ein fehlender
 * neuer Schluessel - eine v1-Datei bleibt ohne neue Warnungen.
 */
function validateDoughsV2(doughs, doughIds, usesV2, r) {
  const { err, warn, markOpen } = r
  const byId = new Map()
  for (const d of doughs) {
    if (isPlainObject(d) && isSlug(d.id) && !byId.has(d.id)) byId.set(d.id, d)
  }
  doughs.forEach((d, i) => {
    if (!isPlainObject(d)) return
    const p = `doughs[${i}]`
    const label = isSlug(d.id) ? d.id : p

    // kg_per_liter
    if (!isSet(d, 'kg_per_liter')) {
      if (usesV2)
        warn(
          `${p}.kg_per_liter`,
          `Teig „${label}“ hat kein kg_per_liter; Liter werden nicht berechnet (der Zettel zeigt nur kg).`
        )
    } else if (d.kg_per_liter === null) {
      markOpen(
        `${p}.kg_per_liter`,
        'kg_per_liter_unknown',
        `Teig „${label}“: kg je Liter ist noch offen – der Zettel zeigt nur kg.`
      )
    } else if (!isPositiveNumber(d.kg_per_liter)) {
      err(
        `${p}.kg_per_liter`,
        'kg_per_liter (kg fertiger Teig je Rezept-Liter) muss eine Zahl größer 0 oder null sein.'
      )
    }

    // combined_with: eine Literzahl an der Maschine fuer mehrere Teige
    let member = false
    if (isSet(d, 'combined_with') && d.combined_with !== null) {
      const target = d.combined_with
      if (typeof target !== 'string' || !doughIds.has(target)) {
        err(
          `${p}.combined_with`,
          `Teig ${JSON.stringify(target)} steht nicht in doughs.`
        )
      } else if (target === d.id) {
        err(
          `${p}.combined_with`,
          `Teig „${label}“ kann nicht mit sich selbst zusammengelegt werden.`
        )
      } else {
        member = true
        const head = byId.get(target)
        if (head && isSet(head, 'combined_with') && head.combined_with !== null)
          err(
            `${p}.combined_with`,
            `Teig „${target}“ ist selbst mit ${JSON.stringify(
              head.combined_with
            )} zusammengelegt; combined_with muss auf den Kopf der Gruppe zeigen (keine Kette).`
          )
      }
    }

    // liter_rounding: gilt am Kopf der Gruppe (bzw. am einzelnen Teig)
    if (member) {
      if (isSet(d, 'liter_rounding') && d.liter_rounding !== null)
        warn(
          `${p}.liter_rounding`,
          `Teig „${label}“ ist mit „${d.combined_with}“ zusammengelegt; gerundet wird nach dem Kopf der Gruppe, diese Rundung wird ignoriert.`
        )
    } else if (!isSet(d, 'liter_rounding')) {
      if (usesV2)
        warn(
          `${p}.liter_rounding`,
          `Teig „${label}“ hat keine Literrundung (liter_rounding); der Zettel zeigt die genauen Liter.`
        )
    } else if (d.liter_rounding === null) {
      markOpen(
        `${p}.liter_rounding`,
        'liter_rounding_unknown',
        `Teig „${label}“: Literrundung ist noch offen – der Zettel zeigt die genauen Liter.`
      )
    } else {
      validateRounding(`${p}.liter_rounding`, d.liter_rounding, err, warn)
    }

    // combined_name
    if (isSet(d, 'combined_name') && d.combined_name !== null) {
      if (!isText(d.combined_name))
        err(`${p}.combined_name`, 'combined_name muss ein Text sein.')
      else if (member)
        warn(
          `${p}.combined_name`,
          `combined_name gilt nur am Kopf der Gruppe („${d.combined_with}“) und wird hier ignoriert.`
        )
    }

    // addons (Dunkelsauer-Muster): Gramm je Liter dieses Teigs
    if (isSet(d, 'addons') && d.addons !== null) {
      if (!Array.isArray(d.addons)) {
        err(
          `${p}.addons`,
          'addons muss eine Liste von { id, name, g_per_liter, rounding } sein.'
        )
        return
      }
      const seen = new Set()
      d.addons.forEach((a, j) => {
        const ap = `${p}.addons[${j}]`
        if (!isPlainObject(a))
          return err(
            ap,
            'Eine Zugabe muss { id, name, g_per_liter, rounding } sein.'
          )
        warnUnknownKeys(a, ADDON_KEYS, ap, warn)
        if (!isSlug(a.id)) err(`${ap}.id`, 'Zugabe-ID muss ein Slug sein.')
        else if (seen.has(a.id))
          err(`${ap}.id`, `Zugabe-ID „${a.id}“ ist doppelt.`)
        else seen.add(a.id)
        if (a.name !== undefined && !isText(a.name))
          err(`${ap}.name`, 'name muss ein nicht-leerer Text sein.')
        const aLabel = isText(a.name) ? a.name : isSlug(a.id) ? a.id : ap
        if (!isSet(a, 'g_per_liter')) {
          warn(
            `${ap}.g_per_liter`,
            `Teig „${label}“, Zugabe „${aLabel}“: g_per_liter fehlt; die Zugabe wird nicht berechnet.`
          )
        } else if (a.g_per_liter === null) {
          markOpen(
            `${ap}.g_per_liter`,
            'addon_unknown',
            `Teig „${label}“, Zugabe „${aLabel}“: Gramm je Liter sind noch offen.`
          )
        } else if (!isPositiveNumber(a.g_per_liter)) {
          err(
            `${ap}.g_per_liter`,
            'g_per_liter muss eine Zahl größer 0 oder null sein.'
          )
        }
        if (!isSet(a, 'rounding')) {
          warn(
            `${ap}.rounding`,
            `Teig „${label}“, Zugabe „${aLabel}“: Rundung fehlt; es stehen die genauen Gramm da.`
          )
        } else if (a.rounding === null) {
          markOpen(
            `${ap}.rounding`,
            'addon_rounding_unknown',
            `Teig „${label}“, Zugabe „${aLabel}“: Rundung ist noch offen – es stehen die genauen Gramm da.`
          )
        } else {
          validateRounding(`${ap}.rounding`, a.rounding, err, warn)
        }
      })
    }
  })
}

/**
 * Prueft die Backzettel-Stammdaten.
 *
 * @param {object} obj das geparste YAML.
 * @param {{products?: Array<string|{id:string, available?:boolean}>}} [options]
 *   `products`: der hq-Katalog; ohne ihn werden Produkt-IDs nicht geprueft.
 * @returns {{ok: boolean, errors: {path:string, message:string}[], warnings: {path:string, message:string}[], open: {path:string, code:string, message:string}[]}}
 *   `open`: je ausdruecklichem `null` auf einem offenen Stammdatenfeld ein
 *   Eintrag („offen“) - kein Fehler, keine Warnung (docs/backzettel-v2.md §3).
 *   Eine offene Grundmenge (`base`) steht nicht darin.
 */
function validateBackzettelConfig(obj, options) {
  const errors = []
  const warnings = []
  const open = []
  const err = (path, message) => errors.push({ path, message })
  const warn = (path, message) => warnings.push({ path, message })
  const markOpen = (path, code, message) => open.push({ path, code, message })
  const catalog = catalogIndex(options && options.products)

  if (!isPlainObject(obj)) {
    err('', 'Die Konfiguration muss ein Objekt (YAML-Mapping) sein.')
    return { ok: false, errors, warnings, open }
  }

  // Z10: Fehlende neue Schluessel (kg_per_liter, liter_rounding) warnen nur,
  // wenn die Datei schon v2-Schluessel benutzt - eine v1-Datei bleibt ohne
  // neue Warnungen.
  const usesV2 =
    isSet(obj, 'dough_days') ||
    isSet(obj, 'bruch_pieces') ||
    (Array.isArray(obj.items) &&
      obj.items.some(
        (it) => isPlainObject(it) && V2_ITEM_KEYS.some((k) => isSet(it, k))
      )) ||
    (Array.isArray(obj.doughs) &&
      obj.doughs.some(
        (d) => isPlainObject(d) && V2_DOUGH_KEYS.some((k) => isSet(d, k))
      ))

  for (const key of Object.keys(obj)) {
    if (!TOP_LEVEL_KEYS.has(key))
      warn(key, `Unbekannter Schlüssel „${key}“ wird ignoriert.`)
  }

  if (obj.version !== 1) {
    err('version', 'version muss 1 sein.')
  }

  // --- days ---------------------------------------------------------------
  let days = []
  if (!Array.isArray(obj.days) || obj.days.length === 0) {
    err(
      'days',
      'days muss eine nicht-leere Liste von ISO-Wochentagen (1–7) sein.'
    )
  } else {
    const seen = new Set()
    obj.days.forEach((d, i) => {
      if (!Number.isInteger(d) || d < 1 || d > 7) {
        err(
          `days[${i}]`,
          `Ungültiger Wochentag ${JSON.stringify(
            d
          )}; erlaubt sind 1 (Montag) bis 7 (Sonntag).`
        )
      } else if (seen.has(d)) {
        err(`days[${i}]`, `Wochentag ${d} steht doppelt in days.`)
      } else {
        seen.add(d)
      }
    })
    days = [...seen]
  }
  const daySet = new Set(days)

  // --- dough_days (Z10) ---------------------------------------------------
  if (isSet(obj, 'dough_days') && obj.dough_days !== null) {
    if (!Array.isArray(obj.dough_days) || obj.dough_days.length === 0) {
      err(
        'dough_days',
        'dough_days muss eine nicht-leere Liste von Wochentagen aus days sein.'
      )
    } else {
      const seen = new Set()
      obj.dough_days.forEach((d, i) => {
        if (!Number.isInteger(d) || d < 1 || d > 7) {
          err(
            `dough_days[${i}]`,
            `Ungültiger Teigtag ${JSON.stringify(
              d
            )}; erlaubt sind 1 (Montag) bis 7 (Sonntag).`
          )
        } else if (seen.has(d)) {
          err(`dough_days[${i}]`, `Teigtag ${d} steht doppelt in dough_days.`)
        } else {
          seen.add(d)
          if (days.length > 0 && !daySet.has(d))
            err(
              `dough_days[${i}]`,
              `${WEEKDAY_NAMES[d]} (${d}) ist kein Produktionstag (days); Teigtage müssen in days stehen.`
            )
        }
      })
    }
  }

  // --- bruch_pieces (Z10) -------------------------------------------------
  if (isSet(obj, 'bruch_pieces')) {
    if (obj.bruch_pieces === null) {
      markOpen(
        'bruch_pieces',
        'bruch_pieces_unknown',
        'Stück je Bruch (bruch_pieces) sind noch offen – Brüche werden nicht berechnet.'
      )
    } else if (!isPositiveInt(obj.bruch_pieces)) {
      err(
        'bruch_pieces',
        'bruch_pieces (Teigstücke je Druck der Teigteilmaschine) muss eine positive ganze Zahl oder null sein.'
      )
    }
  }

  // --- sections -----------------------------------------------------------
  let sections = []
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    err(
      'sections',
      `sections muss eine nicht-leere Liste sein (erlaubt: ${SECTIONS.join(
        ', '
      )}).`
    )
  } else {
    const seen = new Set()
    obj.sections.forEach((s, i) => {
      if (!SECTIONS.includes(s)) {
        err(
          `sections[${i}]`,
          `Unbekannter Abschnitt ${JSON.stringify(s)}; erlaubt: ${SECTIONS.join(
            ', '
          )}.`
        )
      } else if (seen.has(s)) {
        err(`sections[${i}]`, `Abschnitt „${s}“ steht doppelt in sections.`)
      } else {
        seen.add(s)
      }
    })
    sections = [...seen]
  }
  const sectionSet = new Set(sections)

  // --- doughs -------------------------------------------------------------
  const doughIds = new Set()
  if (obj.doughs !== undefined && obj.doughs !== null) {
    if (!Array.isArray(obj.doughs)) {
      err('doughs', 'doughs muss eine Liste sein.')
    } else {
      obj.doughs.forEach((d, i) => {
        const p = `doughs[${i}]`
        if (!isPlainObject(d)) return err(p, 'Ein Teig muss ein Objekt sein.')
        if (!isSlug(d.id))
          err(
            `${p}.id`,
            'Teig-ID muss ein Slug sein (kleinbuchstaben-mit-bindestrich).'
          )
        else if (doughIds.has(d.id))
          err(`${p}.id`, `Teig-ID „${d.id}“ ist doppelt.`)
        else doughIds.add(d.id)
        if (
          d.batch_max_kg !== undefined &&
          d.batch_max_kg !== null &&
          !isPositiveNumber(d.batch_max_kg)
        ) {
          err(
            `${p}.batch_max_kg`,
            'batch_max_kg muss eine positive Zahl oder null sein.'
          )
        }
        if (d.batch_max_kg === undefined) {
          warn(
            `${p}.batch_max_kg`,
            `Teig „${d.id}“ hat keine Chargengröße; Chargen werden nicht berechnet.`
          )
        } else if (d.batch_max_kg === null) {
          // Z10: ausdruecklich offen (O9) - „Chargen: unbekannt“.
          markOpen(
            `${p}.batch_max_kg`,
            'batch_max_kg_unknown',
            `Teig „${d.id}“: Chargengröße ist noch offen – Chargen werden nicht berechnet.`
          )
        }
        if (d.name !== undefined && typeof d.name !== 'string')
          err(`${p}.name`, 'name muss ein Text sein.')
      })
      validateDoughsV2(obj.doughs, doughIds, usesV2, { err, warn, markOpen })
    }
  }

  // --- fillings -----------------------------------------------------------
  const fillingIds = new Set()
  if (obj.fillings !== undefined && obj.fillings !== null) {
    if (!Array.isArray(obj.fillings)) {
      err('fillings', 'fillings muss eine Liste sein.')
    } else {
      obj.fillings.forEach((f, i) => {
        const p = `fillings[${i}]`
        if (!isPlainObject(f))
          return err(p, 'Eine Füllung muss ein Objekt sein.')
        if (!isSlug(f.id)) err(`${p}.id`, 'Füllungs-ID muss ein Slug sein.')
        else if (fillingIds.has(f.id))
          err(`${p}.id`, `Füllungs-ID „${f.id}“ ist doppelt.`)
        else fillingIds.add(f.id)
        if (
          f.recipe !== undefined &&
          f.recipe !== null &&
          (typeof f.recipe !== 'string' || !f.recipe.trim())
        ) {
          err(`${p}.recipe`, 'recipe muss ein Pfad (Text) sein.')
        } else if (
          typeof f.recipe === 'string' &&
          !isSafeRecipePath(f.recipe)
        ) {
          err(
            `${p}.recipe`,
            `Rezeptpfad ${JSON.stringify(
              f.recipe
            )} muss relativ unter ${RECIPE_DIR} liegen und auf .md enden (kein „..“, kein absoluter Pfad).`
          )
        }
        if (
          f.section !== undefined &&
          f.section !== null &&
          typeof f.section !== 'string'
        ) {
          err(
            `${p}.section`,
            'section muss die Überschrift im Rezept (Text) sein.'
          )
        }
        if (f.name !== undefined && typeof f.name !== 'string')
          err(`${p}.name`, 'name muss ein Text sein.')
      })
    }
  }

  // --- items --------------------------------------------------------------
  const itemIds = new Set()
  const productOwner = new Map()
  const pluOwner = new Map()
  const trayOwner = new Map()
  const bruchMembers = []
  let anyLead = false
  let needsTopLevelPieces = false
  if (!Array.isArray(obj.items)) {
    err('items', 'items muss eine Liste sein.')
  } else {
    obj.items.forEach((item, i) => {
      const p = `items[${i}]`
      if (!isPlainObject(item))
        return err(p, 'Ein Posten muss ein Objekt sein.')
      for (const key of Object.keys(item)) {
        if (!ITEM_KEYS.has(key))
          warn(`${p}.${key}`, `Unbekannter Schlüssel „${key}“ wird ignoriert.`)
      }

      const label = isSlug(item.id) ? item.id : p
      if (!isSlug(item.id))
        err(
          `${p}.id`,
          'Posten-ID muss ein Slug sein (kleinbuchstaben-mit-bindestrich).'
        )
      else if (itemIds.has(item.id))
        err(`${p}.id`, `Posten-ID „${item.id}“ ist doppelt.`)
      else itemIds.add(item.id)

      if (
        item.name !== undefined &&
        (typeof item.name !== 'string' || !item.name.trim())
      ) {
        err(`${p}.name`, 'name muss ein nicht-leerer Text sein.')
      }

      if (!sectionSet.has(item.section)) {
        err(
          `${p}.section`,
          `Posten „${label}“: Abschnitt ${JSON.stringify(
            item.section
          )} steht nicht in sections.`
        )
      }

      const unit = item.unit === undefined ? 'Stück' : item.unit
      if (!UNITS.includes(unit)) {
        err(
          `${p}.unit`,
          `Unbekannte Einheit ${JSON.stringify(
            item.unit
          )}; erlaubt: ${UNITS.join(', ')}.`
        )
      }
      const integerUnit = INTEGER_UNITS.has(unit)

      // variants
      let variants = []
      if (item.variants !== undefined && item.variants !== null) {
        if (!Array.isArray(item.variants)) {
          err(`${p}.variants`, 'variants muss eine Liste von Slugs sein.')
        } else {
          const seen = new Set()
          item.variants.forEach((v, j) => {
            if (!isSlug(v))
              err(
                `${p}.variants[${j}]`,
                `Variante ${JSON.stringify(v)} ist kein Slug.`
              )
            else if (seen.has(v))
              err(`${p}.variants[${j}]`, `Variante „${v}“ ist doppelt.`)
            else seen.add(v)
          })
          variants = [...seen]
        }
      }

      // sizes (Z10): Laibgroessen sind die Varianten eines Brot-Postens
      const hasSizes = isSet(item, 'sizes') && item.sizes !== null
      let sizeIds = []
      if (hasSizes) {
        if (!Array.isArray(item.sizes) || item.sizes.length === 0) {
          err(
            `${p}.sizes`,
            'sizes muss eine nicht-leere Liste von { id, label, dough_g } sein.'
          )
        } else {
          if (isSet(item, 'variants') && item.variants !== null)
            err(
              `${p}.sizes`,
              `Posten „${label}“ hat sizes und variants; Größen sind die Varianten eines Brots – bitte nur eines davon.`
            )
          const seen = new Set()
          item.sizes.forEach((size, j) => {
            const sp = `${p}.sizes[${j}]`
            if (!isPlainObject(size))
              return err(sp, 'Eine Größe muss { id, label, dough_g } sein.')
            warnUnknownKeys(size, SIZE_KEYS, sp, warn)
            if (!isSizeId(size.id))
              err(
                `${sp}.id`,
                `Größen-ID ${JSON.stringify(
                  size.id
                )} muss ein Slug sein, der mit einem Buchstaben beginnt (z. B. g500).`
              )
            else if (seen.has(size.id))
              err(`${sp}.id`, `Größe „${size.id}“ ist doppelt.`)
            else seen.add(size.id)
            if (!isText(size.label)) {
              // `{ label: 1,5 kg }` liest YAML als `label: 1` plus einen
              // Schlüssel „5 kg“: das Komma trennt in `{ }` die Einträge.
              const commaSplit =
                typeof size.label === 'number' &&
                Object.keys(size).some((k) => !SIZE_KEYS.has(k))
              err(
                `${sp}.label`,
                commaSplit
                  ? 'label (Anzeigename der Größe) ist keine Text-Angabe: ein Komma im Namen trennt in { } die Einträge – bitte in Anführungszeichen setzen, z. B. label: "1,5 kg".'
                  : 'label (Anzeigename der Größe, z. B. „500 g“) muss ein nicht-leerer Text sein.'
              )
            }
            const sizeLabel = isSizeId(size.id) ? size.id : sp
            if (!isSet(size, 'dough_g')) {
              warn(
                `${sp}.dough_g`,
                `Posten „${label}“, Größe „${sizeLabel}“: dough_g (Teig je Laib) fehlt; das Teiggewicht bleibt unbekannt.`
              )
            } else if (size.dough_g === null) {
              markOpen(
                `${sp}.dough_g`,
                'dough_g_unknown',
                `Posten „${label}“, Größe „${sizeLabel}“: Teig je Laib ist noch offen.`
              )
            } else if (!isPositiveNumber(size.dough_g)) {
              err(
                `${sp}.dough_g`,
                'dough_g (Gramm Teig je Laib) muss eine Zahl größer 0 oder null sein.'
              )
            }
          })
          sizeIds = [...seen]
        }
      }
      const isSizeItem = sizeIds.length > 0
      const sizeSet = new Set(sizeIds)
      const variantSet = isSizeItem ? sizeSet : new Set(variants)
      const variantWord = isSizeItem
        ? { one: 'Größe', list: 'sizes' }
        : { one: 'Variante', list: 'variants' }

      // products
      if (item.products !== undefined && item.products !== null) {
        if (!Array.isArray(item.products)) {
          err(
            `${p}.products`,
            'products muss eine Liste von {id, factor} sein.'
          )
        } else {
          const seen = new Set()
          item.products.forEach((prod, j) => {
            const pp = `${p}.products[${j}]`
            if (!isPlainObject(prod))
              return err(pp, 'Ein Produktverweis muss {id, factor} sein.')
            if (typeof prod.id !== 'string' || !prod.id.trim()) {
              err(`${pp}.id`, 'Produkt-ID fehlt.')
            } else {
              if (seen.has(prod.id))
                err(
                  `${pp}.id`,
                  `Produkt „${prod.id}“ steht doppelt in diesem Posten.`
                )
              seen.add(prod.id)
              if (catalog) {
                const entry = catalog.get(prod.id)
                if (!entry)
                  err(
                    `${pp}.id`,
                    `Produkt „${prod.id}“ gibt es im hq-Katalog nicht.`
                  )
                else if (entry.available === false)
                  warn(
                    `${pp}.id`,
                    `Produkt „${prod.id}“ ist im Katalog nicht verfügbar.`
                  )
              }
              const owner = productOwner.get(prod.id)
              if (owner && owner !== label) {
                err(
                  `${pp}.id`,
                  `Produkt „${prod.id}“ ist schon Posten „${owner}“ zugeordnet; Vorbestellungen würden doppelt gezählt.`
                )
              } else {
                productOwner.set(prod.id, label)
              }
            }
            const factor = prod.factor === undefined ? 1 : prod.factor
            if (!isPositiveNumber(factor))
              err(`${pp}.factor`, 'factor muss eine Zahl größer 0 sein.')
            // Z10: ein Produkt eines Brots je Groesse nennt seine Groesse
            const size = isSet(prod, 'size') ? prod.size : null
            if (isSizeItem) {
              if (size === null)
                err(
                  `${pp}.size`,
                  `Posten „${label}“ hat Größen; jedes Produkt braucht size (eine von ${sizeIds.join(
                    ', '
                  )}).`
                )
              else if (!sizeSet.has(size))
                err(
                  `${pp}.size`,
                  `Größe ${JSON.stringify(size)} steht nicht in sizes.`
                )
            } else if (!hasSizes && size !== null) {
              err(
                `${pp}.size`,
                `Posten „${label}“ hat keine sizes; size ist hier nicht erlaubt.`
              )
            }
          })
        }
      }

      // plu
      if (item.plu !== undefined && item.plu !== null) {
        if (!Array.isArray(item.plu)) {
          err(`${p}.plu`, 'plu muss eine Liste von Kassennummern sein.')
        } else {
          item.plu.forEach((plu, j) => {
            if (!isPositiveInt(plu)) {
              err(
                `${p}.plu[${j}]`,
                `PLU ${JSON.stringify(plu)} muss eine positive ganze Zahl sein.`
              )
            } else {
              const owner = pluOwner.get(plu)
              if (owner && owner !== label)
                warn(
                  `${p}.plu[${j}]`,
                  `PLU ${plu} ist auch Posten „${owner}“ zugeordnet.`
                )
              else pluOwner.set(plu, label)
            }
          })
        }
      }

      // dough
      const hasBruch = isSet(item, 'bruch') && item.bruch !== null
      if (item.dough !== undefined && item.dough !== null) {
        const d = item.dough
        if (!isPlainObject(d)) {
          err(`${p}.dough`, 'dough muss {id, piece_g, pieces} sein.')
        } else {
          if (!isSet(d, 'id')) {
            warn(
              `${p}.dough.id`,
              `Posten „${label}“: dough ohne id – der Teig bleibt unbekannt („Teig offen“).`
            )
          } else if (d.id === null) {
            markOpen(
              `${p}.dough.id`,
              'dough_unknown',
              `Posten „${label}“: Teig ist noch offen – die kg stehen unter „Teig offen“.`
            )
          } else if (!doughIds.has(d.id)) {
            err(
              `${p}.dough.id`,
              `Teig ${JSON.stringify(d.id)} steht nicht in doughs.`
            )
          }
          if (hasSizes || hasBruch) {
            // Das Gewicht steht an der Groesse bzw. am Bruch.
            if (isSet(d, 'piece_g'))
              err(
                `${p}.dough.piece_g`,
                `Posten „${label}“ hat ${
                  hasBruch ? 'bruch' : 'sizes'
                }; das Gewicht steht dort – piece_g bitte weglassen.`
              )
          } else if (d.piece_g === null) {
            markOpen(
              `${p}.dough.piece_g`,
              'piece_g_unknown',
              `Posten „${label}“: Gramm je Teigstück sind noch offen.`
            )
          } else if (!isPositiveNumber(d.piece_g)) {
            err(
              `${p}.dough.piece_g`,
              'piece_g (Gramm je Teigstück) muss größer 0 sein.'
            )
          }
          if (isSet(d, 'pieces') && d.pieces === null) {
            markOpen(
              `${p}.dough.pieces`,
              'pieces_unknown',
              `Posten „${label}“: Teigstücke je Produkt sind noch offen – das Teiggewicht bleibt unbekannt.`
            )
          } else {
            const pieces = d.pieces === undefined ? 1 : d.pieces
            if (!isPositiveInt(pieces))
              err(
                `${p}.dough.pieces`,
                'pieces (Teigstücke je Produkt) muss eine positive ganze Zahl sein.'
              )
          }
        }
      }

      // lead (Z10): Teigtage vor dem Backtag
      if (isSet(item, 'lead')) {
        const leadMsg = `lead muss eine ganze Zahl von 0 bis ${MAX_LEAD} sein (Teigtage vor dem Backtag).`
        const l = item.lead
        if (l === null) {
          err(
            `${p}.lead`,
            'lead darf nicht null sein; ohne lead gilt 0 (Teig am Backtag).'
          )
        } else if (isPlainObject(l)) {
          for (const [key, v] of Object.entries(l)) {
            const lp = `${p}.lead.${key}`
            if (key !== 'default') {
              const wd = weekdayKey(key)
              if (wd === null || !daySet.has(wd)) {
                err(lp, `„${key}“ ist kein Backtag (days) und nicht „default“.`)
                continue
              }
            }
            if (!isLead(v)) err(lp, leadMsg)
            else if (v > 0) anyLead = true
          }
        } else if (!isLead(l)) {
          err(`${p}.lead`, leadMsg)
        } else if (l > 0) {
          anyLead = true
        }
      }

      // bruch (Z10): Broetchen je Druck der Teigteilmaschine
      if (hasBruch) {
        const b = item.bruch
        if (!isPlainObject(b)) {
          err(
            `${p}.bruch`,
            'bruch muss { g, per_product?, pieces?, group? } sein.'
          )
        } else {
          warnUnknownKeys(b, BRUCH_KEYS, `${p}.bruch`, warn)
          if (hasSizes)
            err(
              `${p}.bruch`,
              `Posten „${label}“ hat sizes und bruch; Brot wird je Laib, Brötchen je Bruch gerechnet – bitte nur eines davon.`
            )
          if (item.dough === undefined || item.dough === null)
            err(
              `${p}.bruch`,
              `Posten „${label}“ hat bruch, aber keinen dough; ein Bruch kommt immer aus einem Teig (dough: { id }, die id darf null sein).`
            )
          validateBruchG(b, `${p}.bruch`, label, daySet, {
            err,
            warn,
            markOpen,
          })
          if (isSet(b, 'per_product') && !isPositiveInt(b.per_product))
            err(
              `${p}.bruch.per_product`,
              'per_product (Teigstücke je Brötchen) muss eine positive ganze Zahl sein.'
            )
          if (isSet(b, 'pieces')) {
            if (b.pieces === null)
              markOpen(
                `${p}.bruch.pieces`,
                'bruch_pieces_unknown',
                `Posten „${label}“: Stück je Bruch sind noch offen – Brüche werden nicht berechnet.`
              )
            else if (!isPositiveInt(b.pieces))
              err(
                `${p}.bruch.pieces`,
                'bruch.pieces (Teigstücke je Druck) muss eine positive ganze Zahl oder null sein.'
              )
          } else {
            needsTopLevelPieces = true
          }
          if (isSet(b, 'group') && b.group !== null && !isSlug(b.group))
            err(`${p}.bruch.group`, 'group muss ein Slug sein.')
          const ownPieces = isSet(b, 'pieces') ? b.pieces : obj.bruch_pieces
          bruchMembers.push({
            p,
            label,
            group: isSlug(b.group) ? b.group : label,
            dough:
              isPlainObject(item.dough) && typeof item.dough.id === 'string'
                ? item.dough.id
                : null,
            g: JSON.stringify(normalizeBruchG(b.g)),
            pieces: isPositiveInt(ownPieces) ? ownPieces : null,
            lead: JSON.stringify(normalizeLead(item.lead)),
            section: item.section,
          })
        }
      }

      // from_dough (Z10): Anteil an einem anderen Teig (Kerbricher-Muster)
      if (isSet(item, 'from_dough') && item.from_dough !== null) {
        validateFromDough(item.from_dough, `${p}.from_dough`, label, {
          hasSizes,
          doughIds,
          err,
          warn,
          markOpen,
        })
      }

      // filling_g - Z10: schon der Schluessel macht den Posten gefuellt;
      // `null` (ganz oder je Variante) heisst „Gramm unbekannt“.
      const hasFilling = isSet(item, 'filling_g')
      if (hasFilling) {
        if (variants.length === 0) {
          err(
            `${p}.filling_g`,
            `Posten „${label}“ hat filling_g, aber keine variants (Füllungen).`
          )
        }
        if (item.filling_g === null) {
          markOpen(
            `${p}.filling_g`,
            'filling_g_unknown',
            `Posten „${label}“: Füllungsgramm ist noch offen – der Füllungsbedarf steht nur in Stück.`
          )
        } else if (isPlainObject(item.filling_g)) {
          for (const [v, g] of Object.entries(item.filling_g)) {
            if (!variantSet.has(v))
              err(
                `${p}.filling_g.${v}`,
                `Variante „${v}“ steht nicht in variants.`
              )
            if (g === null) {
              if (variantSet.has(v))
                markOpen(
                  `${p}.filling_g.${v}`,
                  'filling_g_unknown',
                  `Posten „${label}“, Sorte „${v}“: Füllungsgramm ist noch offen.`
                )
            } else if (!isPositiveNumber(g))
              err(`${p}.filling_g.${v}`, 'Füllungsgramm muss größer 0 sein.')
          }
        } else if (!isPositiveNumber(item.filling_g)) {
          err(
            `${p}.filling_g`,
            'filling_g muss eine Zahl größer 0, eine Zuordnung je Variante oder null sein.'
          )
        }
        for (const v of variants) {
          if (!fillingIds.has(v))
            warn(
              `${p}.variants`,
              `Für Variante „${v}“ gibt es keine Füllung in fillings; ihr Füllungsbedarf wird ohne Rezept ausgegeben.`
            )
        }
      }

      // tray
      if (item.tray !== undefined && item.tray !== null) {
        const t = item.tray
        if (!isPlainObject(t)) {
          err(`${p}.tray`, 'tray muss {no, per_tray?} sein.')
        } else {
          const nos = Array.isArray(t.no) ? t.no : [t.no]
          if (nos.length === 0 || !nos.every(isPositiveInt)) {
            err(
              `${p}.tray.no`,
              'tray.no muss eine positive ganze Zahl oder eine Liste davon sein.'
            )
          } else if (new Set(nos).size !== nos.length) {
            err(`${p}.tray.no`, 'tray.no enthält eine Blechnummer doppelt.')
          } else {
            for (const no of nos) {
              const owner = trayOwner.get(no)
              if (owner && owner !== label)
                warn(
                  `${p}.tray.no`,
                  `Blech ${no} ist auch Posten „${owner}“ zugeordnet.`
                )
              else trayOwner.set(no, label)
            }
          }
          if (
            t.per_tray !== undefined &&
            t.per_tray !== null &&
            !isPositiveInt(t.per_tray)
          ) {
            err(
              `${p}.tray.per_tray`,
              'per_tray muss eine positive ganze Zahl sein.'
            )
          }
        }
      }

      // pieces_per_liter
      if (
        item.pieces_per_liter !== undefined &&
        item.pieces_per_liter !== null
      ) {
        if (!isPositiveNumber(item.pieces_per_liter)) {
          err(
            `${p}.pieces_per_liter`,
            'pieces_per_liter muss eine Zahl größer 0 oder null sein.'
          )
        } else if (unit !== 'Liter') {
          warn(
            `${p}.pieces_per_liter`,
            'pieces_per_liter wirkt nur bei der Einheit Liter.'
          )
        }
      }

      // base
      const checkQty = (path, value) => {
        if (!isNonNegativeNumber(value)) {
          err(path, `Menge ${JSON.stringify(value)} muss eine Zahl ≥ 0 sein.`)
        } else if (integerUnit && !Number.isInteger(value)) {
          err(
            path,
            `Menge ${String(value).replace(
              '.',
              ','
            )} muss bei der Einheit ${unit} ganzzahlig sein.`
          )
        }
      }
      if (item.base !== undefined && item.base !== null) {
        if (!isPlainObject(item.base)) {
          err(`${p}.base`, 'base muss eine Zuordnung Wochentag → Menge sein.')
        } else {
          for (const [key, value] of Object.entries(item.base)) {
            const bp = `${p}.base.${key}`
            const wd = weekdayKey(key)
            if (wd === null || wd < 1 || wd > 7) {
              err(bp, `Ungültiger Wochentag „${key}“ in base.`)
              continue
            }
            if (!daySet.has(wd)) {
              err(
                bp,
                `${WEEKDAY_NAMES[wd]} (${wd}) ist kein Produktionstag (days).`
              )
            }
            if (value === null) continue
            if (isPlainObject(value)) {
              if (variantSet.size === 0) {
                err(
                  bp,
                  `Posten „${label}“ hat keine variants; base braucht hier eine Zahl.`
                )
                continue
              }
              for (const [v, q] of Object.entries(value)) {
                if (!variantSet.has(v))
                  err(
                    `${bp}.${v}`,
                    `${variantWord.one} „${v}“ steht nicht in ${variantWord.list}.`
                  )
                if (q !== null) checkQty(`${bp}.${v}`, q)
              }
            } else {
              if (isSizeItem) {
                // Sonst landet die Tagesmenge auf einer Zeile ohne Groesse.
                err(
                  bp,
                  `Posten „${label}“ hat Größen (sizes); die Grundmenge braucht eine Menge je Größe, z. B. { ${sizeIds[0]}: ${value} }.`
                )
                continue
              }
              if (hasFilling) {
                // Sonst landet die ganze Tagesmenge auf der Zeile ohne
                // Variante und faellt aus dem Fuellungsbedarf.
                err(
                  bp,
                  `Posten „${label}“ ist gefüllt (filling_g); die Grundmenge braucht eine Menge je Variante, z. B. { ${
                    variants[0] || 'nuss'
                  }: ${value} }.`
                )
                continue
              }
              checkQty(bp, value)
            }
          }
        }
      }

      const hasBase =
        isPlainObject(item.base) && Object.keys(item.base).length > 0
      const hasProducts =
        Array.isArray(item.products) && item.products.length > 0
      if (!hasBase && !hasProducts) {
        warn(
          p,
          `Posten „${label}“ hat weder Grundmengen noch Produkte und erscheint nur mit einer Korrektur.`
        )
      }
    })
  }

  // --- Z10: Teigtage, Stück je Bruch, Bruch-Gruppen ----------------------
  const hasDoughDays = isSet(obj, 'dough_days') && obj.dough_days !== null
  if (anyLead && !hasDoughDays) {
    warn(
      'dough_days',
      'Teigtage (dough_days) fehlen; es gelten alle Produktionstage (days) als Teigtage.'
    )
  }
  if (needsTopLevelPieces && !isSet(obj, 'bruch_pieces')) {
    warn(
      'bruch_pieces',
      'bruch_pieces (Teigstücke je Druck der Teigteilmaschine) fehlt; Brüche werden nicht berechnet.'
    )
  }
  const groups = new Map()
  for (const m of bruchMembers) {
    if (!groups.has(m.group)) groups.set(m.group, [])
    groups.get(m.group).push(m)
  }
  for (const [group, members] of groups) {
    const first = members[0]
    for (const m of members.slice(1)) {
      const diff = []
      if (m.dough !== first.dough) diff.push('Teig')
      if (m.g !== first.g) diff.push('Bruchgewicht')
      if (m.pieces !== first.pieces) diff.push('Stück je Bruch')
      if (m.lead !== first.lead) diff.push('lead')
      if (m.section !== first.section) diff.push('Abschnitt')
      if (diff.length > 0)
        err(
          `${m.p}.bruch.group`,
          `Posten „${m.label}“ teilt die Bruch-Gruppe „${group}“ mit „${
            first.label
          }“, weicht aber ab bei: ${diff.join(
            ', '
          )}. Eine Gruppe teilt sich Brüche nur mit gleichem Teig, Bruchgewicht, Stück je Bruch, lead und Abschnitt.`
        )
    }
  }

  // --- prep ---------------------------------------------------------------
  if (obj.prep !== undefined && obj.prep !== null) {
    if (!Array.isArray(obj.prep)) {
      err('prep', 'prep muss eine Liste sein.')
    } else {
      const seen = new Set()
      obj.prep.forEach((task, i) => {
        const p = `prep[${i}]`
        if (!isPlainObject(task))
          return err(p, 'Eine Vorbereitung muss ein Objekt sein.')
        for (const key of Object.keys(task)) {
          if (!PREP_KEYS.has(key))
            warn(
              `${p}.${key}`,
              `Unbekannter Schlüssel „${key}“ wird ignoriert.`
            )
        }
        if (!isSlug(task.id))
          err(`${p}.id`, 'Vorbereitungs-ID muss ein Slug sein.')
        else if (seen.has(task.id))
          err(`${p}.id`, `Vorbereitungs-ID „${task.id}“ ist doppelt.`)
        else seen.add(task.id)
        if (
          task.name !== undefined &&
          (typeof task.name !== 'string' || !task.name.trim())
        ) {
          err(`${p}.name`, 'name muss ein nicht-leerer Text sein.')
        }
        if (
          task.when_item !== undefined &&
          task.when_item !== null &&
          !itemIds.has(task.when_item)
        ) {
          err(
            `${p}.when_item`,
            `Posten ${JSON.stringify(task.when_item)} gibt es nicht.`
          )
        }
        if (task.days !== undefined && task.days !== null) {
          if (!Array.isArray(task.days))
            err(`${p}.days`, 'days muss eine Liste von Wochentagen sein.')
          else
            task.days.forEach((d, j) => {
              if (!daySet.has(d))
                err(
                  `${p}.days[${j}]`,
                  `${JSON.stringify(d)} ist kein Produktionstag (days).`
                )
            })
        }
        if (task.by_weekday !== undefined && task.by_weekday !== null) {
          if (!isPlainObject(task.by_weekday)) {
            err(
              `${p}.by_weekday`,
              'by_weekday muss eine Zuordnung Wochentag/default → Variante sein.'
            )
          } else {
            for (const [key, value] of Object.entries(task.by_weekday)) {
              const bp = `${p}.by_weekday.${key}`
              if (key !== 'default') {
                const wd = weekdayKey(key)
                if (wd === null || !daySet.has(wd))
                  err(
                    bp,
                    `„${key}“ ist kein Produktionstag und nicht „default“.`
                  )
              }
              if (
                value !== null &&
                value !== false &&
                (typeof value !== 'string' || !value.trim())
              ) {
                err(bp, 'Wert muss ein Text (Variante), false oder null sein.')
              }
            }
          }
        }
        if (
          task.note !== undefined &&
          task.note !== null &&
          typeof task.note !== 'string'
        ) {
          err(`${p}.note`, 'note muss ein Text sein.')
        }
        // W4-verify r2: Anzeigename je Variante („gross" → „groß")
        if (task.variant_labels !== undefined && task.variant_labels !== null) {
          if (!isPlainObject(task.variant_labels)) {
            err(
              `${p}.variant_labels`,
              'variant_labels muss eine Zuordnung Variante → Anzeigename sein.'
            )
          } else {
            for (const [key, value] of Object.entries(task.variant_labels)) {
              if (typeof value !== 'string' || !value.trim())
                err(
                  `${p}.variant_labels.${key}`,
                  'Anzeigename muss ein nicht-leerer Text sein.'
                )
            }
          }
        }
      })
    }
  }

  return { ok: errors.length === 0, errors, warnings, open }
}

function toWeekdayMap(value, mapValue) {
  const out = {}
  if (!isPlainObject(value)) return out
  for (const [key, v] of Object.entries(value)) {
    const wd = weekdayKey(key)
    if (wd === null) continue
    out[wd] = mapValue(v)
  }
  return out
}

function normalizeRounding(value) {
  return isPlainObject(value) &&
    isPositiveNumber(value.step) &&
    ROUNDING_MODES.includes(value.mode)
    ? { step: value.step, mode: value.mode }
    : null
}

function positiveOrNull(value) {
  return isPositiveNumber(value) ? value : null
}

/**
 * Bringt eine (gepruefte) Konfiguration in eine feste Form: Standardwerte
 * gesetzt, Wochentage als Zahl-Schluessel, Listen statt `undefined`.
 * Idempotent - `normalizeConfig(normalizeConfig(x))` ist gleich.
 *
 * Z10 (docs/backzettel-v2.md §2): `dough_days` (ohne Angabe = `days`),
 * `bruch_pieces`; je Teig `kg_per_liter`, `liter_rounding`, `combined_with`,
 * `combined_name`, `addons`; je Posten `sizes` (`[]` ohne), `variantKind`
 * (`'size'` | `'filling'` | `null`), `lead` (`{ default, <Wochentag>: n }`),
 * `bruch` (`{ g: { default, <Wochentag>: g }, per_product, group,
 * piecesPerBruch }` oder `null`), `from_dough` und `products[].size`. Bei
 * einem Posten mit Groessen sind `variants` die Groessen-IDs. Offene Werte
 * bleiben `null`.
 *
 * `filling_g`: in der YAML macht schon der Schluessel den Posten gefuellt
 * (`null` = Gramm unbekannt → je Variante `null`). In der normalisierten
 * Form heisst `filling_g: null` dagegen „nicht gefuellt“; sie erkennt man am
 * Feld `variantKind`, das nur die Normalisierung setzt.
 */
function normalizeConfig(obj) {
  const src = isPlainObject(obj) ? obj : {}
  const sections = Array.isArray(src.sections)
    ? src.sections.filter((s) => SECTIONS.includes(s))
    : []
  const days = Array.isArray(src.days) ? [...src.days] : []
  const bruchPieces = isPositiveInt(src.bruch_pieces) ? src.bruch_pieces : null
  const doughs = (Array.isArray(src.doughs) ? src.doughs : [])
    .filter(isPlainObject)
    .map((d) => ({
      id: d.id,
      name: typeof d.name === 'string' && d.name.trim() ? d.name : d.id,
      batch_max_kg: isPositiveNumber(d.batch_max_kg) ? d.batch_max_kg : null,
      kg_per_liter: positiveOrNull(d.kg_per_liter),
      liter_rounding: normalizeRounding(d.liter_rounding),
      combined_with:
        typeof d.combined_with === 'string' && d.combined_with !== d.id
          ? d.combined_with
          : null,
      combined_name: isText(d.combined_name) ? d.combined_name : null,
      addons: (Array.isArray(d.addons) ? d.addons : [])
        .filter(isPlainObject)
        .map((a) => ({
          id: a.id,
          name: isText(a.name) ? a.name : a.id,
          g_per_liter: positiveOrNull(a.g_per_liter),
          rounding: normalizeRounding(a.rounding),
        })),
    }))
  const fillings = (Array.isArray(src.fillings) ? src.fillings : [])
    .filter(isPlainObject)
    .map((f) => ({
      id: f.id,
      name: typeof f.name === 'string' && f.name.trim() ? f.name : f.id,
      recipe: typeof f.recipe === 'string' && f.recipe.trim() ? f.recipe : null,
      section:
        typeof f.section === 'string' && f.section.trim() ? f.section : null,
    }))
  const items = (Array.isArray(src.items) ? src.items : [])
    .filter(isPlainObject)
    .map((item) => {
      const normalizedInput = hasOwn(item, 'variantKind')
      const sizes = (Array.isArray(item.sizes) ? item.sizes : [])
        .filter((s) => isPlainObject(s) && isSizeId(s.id))
        .map((s) => ({
          id: s.id,
          label: isText(s.label) ? s.label : s.id,
          dough_g: positiveOrNull(s.dough_g),
        }))
      const variants =
        sizes.length > 0
          ? sizes.map((s) => s.id)
          : Array.isArray(item.variants)
          ? [...item.variants]
          : []
      const variantKind =
        sizes.length > 0 ? 'size' : variants.length > 0 ? 'filling' : null
      const filled = normalizedInput
        ? isPlainObject(item.filling_g)
        : isSet(item, 'filling_g')
      let fillingG = null
      if (filled) {
        fillingG = {}
        for (const v of variants) {
          const g = isPlainObject(item.filling_g)
            ? item.filling_g[v]
            : item.filling_g
          fillingG[v] = isPositiveNumber(g) ? g : null
        }
      }
      let bruch = null
      if (isPlainObject(item.bruch)) {
        const b = item.bruch
        // eigenes `pieces` (YAML) bzw. `piecesPerBruch` (schon normalisiert)
        // vor dem `bruch_pieces` der Datei
        const pieces = hasOwn(b, 'pieces')
          ? b.pieces
          : hasOwn(b, 'piecesPerBruch')
          ? b.piecesPerBruch
          : bruchPieces
        bruch = {
          g: normalizeBruchG(b.g),
          per_product: isPositiveInt(b.per_product) ? b.per_product : 1,
          group: isSlug(b.group) ? b.group : item.id,
          piecesPerBruch: isPositiveInt(pieces) ? pieces : null,
        }
      }
      let fromDough = null
      if (isPlainObject(item.from_dough)) {
        const f = item.from_dough
        fromDough = {
          id: typeof f.id === 'string' ? f.id : null,
          mode: FROM_DOUGH_MODES.includes(f.mode) ? f.mode : null,
          dough_kg: positiveOrNull(f.dough_kg),
          extras: (Array.isArray(f.extras) ? f.extras : [])
            .filter(isPlainObject)
            .map((x) => ({
              name: isText(x.name) ? x.name : '',
              kg: positiveOrNull(x.kg),
            })),
        }
      }
      let tray = null
      if (isPlainObject(item.tray)) {
        const nos = Array.isArray(item.tray.no)
          ? [...item.tray.no]
          : [item.tray.no]
        tray = {
          no: nos,
          per_tray: isPositiveInt(item.tray.per_tray)
            ? item.tray.per_tray
            : null,
        }
      }
      return {
        id: item.id,
        name:
          typeof item.name === 'string' && item.name.trim()
            ? item.name
            : item.id,
        section: item.section,
        unit: item.unit === undefined ? 'Stück' : item.unit,
        products: (Array.isArray(item.products) ? item.products : [])
          .filter(isPlainObject)
          .map((p) => ({
            id: p.id,
            factor: p.factor === undefined ? 1 : p.factor,
            size: typeof p.size === 'string' ? p.size : null,
          })),
        plu: Array.isArray(item.plu) ? [...item.plu] : [],
        variants,
        dough: isPlainObject(item.dough)
          ? {
              id: typeof item.dough.id === 'string' ? item.dough.id : null,
              piece_g: positiveOrNull(item.dough.piece_g),
              pieces:
                item.dough.pieces === undefined
                  ? 1
                  : isPositiveInt(item.dough.pieces)
                  ? item.dough.pieces
                  : null,
            }
          : null,
        filling_g: fillingG,
        tray,
        base: toWeekdayMap(item.base, (v) => (isPlainObject(v) ? { ...v } : v)),
        pieces_per_liter: isPositiveNumber(item.pieces_per_liter)
          ? item.pieces_per_liter
          : null,
        note: typeof item.note === 'string' ? item.note : null,
        sizes,
        variantKind,
        lead: normalizeLead(item.lead),
        bruch,
        from_dough: fromDough,
      }
    })
  const prep = (Array.isArray(src.prep) ? src.prep : [])
    .filter(isPlainObject)
    .map((task) => {
      let byWeekday = null
      if (isPlainObject(task.by_weekday)) {
        byWeekday = {}
        for (const [key, value] of Object.entries(task.by_weekday)) {
          const k = key === 'default' ? 'default' : weekdayKey(key)
          if (k === null) continue
          byWeekday[k] = value === false || value === null ? null : value
        }
      }
      return {
        id: task.id,
        name:
          typeof task.name === 'string' && task.name.trim()
            ? task.name
            : task.id,
        by_weekday: byWeekday,
        when_item: typeof task.when_item === 'string' ? task.when_item : null,
        days: Array.isArray(task.days) ? [...task.days] : null,
        note: typeof task.note === 'string' ? task.note : null,
        variant_labels: isPlainObject(task.variant_labels)
          ? Object.fromEntries(
              Object.entries(task.variant_labels).filter(
                ([, v]) => typeof v === 'string' && v.trim()
              )
            )
          : null,
      }
    })
  return {
    version: src.version,
    days,
    sections,
    items,
    doughs,
    fillings,
    prep,
    dough_days: Array.isArray(src.dough_days) ? [...src.dough_days] : [...days],
    bruch_pieces: bruchPieces,
  }
}

/**
 * Anzeigename einer Variante: Groesse (`sizes[].label`, „500 g“) → Fuellung
 * (`fillings[].name`, „Nussfüllung“) → ID mit grossem Anfangsbuchstaben.
 * `null` fuer „keine Variante“. Fuer alle, die eine Zeile beschriften.
 */
function variantDisplayName(cfg, item, variant) {
  if (variant === null || variant === undefined || variant === '') return null
  const sizes = item && Array.isArray(item.sizes) ? item.sizes : []
  const size = sizes.find((s) => isPlainObject(s) && s.id === variant)
  if (size) return isText(size.label) ? size.label : size.id
  const fillings = cfg && Array.isArray(cfg.fillings) ? cfg.fillings : []
  const filling = fillings.find((f) => isPlainObject(f) && f.id === variant)
  if (filling && isText(filling.name)) return filling.name
  const text = String(variant)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

module.exports = {
  SECTIONS,
  SECTION_LABELS,
  UNITS,
  INTEGER_UNITS,
  WEEKDAY_NAMES,
  RECIPE_DIR,
  MAX_LEAD,
  ROUNDING_MODES,
  FROM_DOUGH_MODES,
  isSlug,
  isSizeId,
  isSafeRecipePath,
  validateBackzettelConfig,
  normalizeConfig,
  normalizeLead,
  normalizeBruchG,
  variantDisplayName,
}
