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
/** Einheiten, deren Mengen ganzzahlig sein muessen. Liter/kg duerfen Bruchteile haben (Haferbrot 1,24 l). */
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

const TOP_LEVEL_KEYS = new Set([
  'version',
  'days',
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
  'dough',
  'filling_g',
  'tray',
  'base',
  'pieces_per_liter',
  'note',
])
const PREP_KEYS = new Set([
  'id',
  'name',
  'by_weekday',
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

/**
 * Prueft die Backzettel-Stammdaten.
 *
 * @param {object} obj das geparste YAML.
 * @param {{products?: Array<string|{id:string, available?:boolean}>}} [options]
 *   `products`: der hq-Katalog; ohne ihn werden Produkt-IDs nicht geprueft.
 * @returns {{ok: boolean, errors: {path:string, message:string}[], warnings: {path:string, message:string}[]}}
 */
function validateBackzettelConfig(obj, options) {
  const errors = []
  const warnings = []
  const err = (path, message) => errors.push({ path, message })
  const warn = (path, message) => warnings.push({ path, message })
  const catalog = catalogIndex(options && options.products)

  if (!isPlainObject(obj)) {
    err('', 'Die Konfiguration muss ein Objekt (YAML-Mapping) sein.')
    return { ok: false, errors, warnings }
  }

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
        if (d.batch_max_kg === undefined || d.batch_max_kg === null) {
          warn(
            `${p}.batch_max_kg`,
            `Teig „${d.id}“ hat keine Chargengröße; Chargen werden nicht berechnet.`
          )
        }
        if (d.name !== undefined && typeof d.name !== 'string')
          err(`${p}.name`, 'name muss ein Text sein.')
      })
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
      const variantSet = new Set(variants)

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
      if (item.dough !== undefined && item.dough !== null) {
        const d = item.dough
        if (!isPlainObject(d)) {
          err(`${p}.dough`, 'dough muss {id, piece_g, pieces} sein.')
        } else {
          if (!doughIds.has(d.id))
            err(
              `${p}.dough.id`,
              `Teig ${JSON.stringify(d.id)} steht nicht in doughs.`
            )
          if (!isPositiveNumber(d.piece_g))
            err(
              `${p}.dough.piece_g`,
              'piece_g (Gramm je Teigstück) muss größer 0 sein.'
            )
          const pieces = d.pieces === undefined ? 1 : d.pieces
          if (!isPositiveInt(pieces))
            err(
              `${p}.dough.pieces`,
              'pieces (Teigstücke je Produkt) muss eine positive ganze Zahl sein.'
            )
        }
      }

      // filling_g
      if (item.filling_g !== undefined && item.filling_g !== null) {
        if (variants.length === 0) {
          err(
            `${p}.filling_g`,
            `Posten „${label}“ hat filling_g, aber keine variants (Füllungen).`
          )
        }
        if (isPlainObject(item.filling_g)) {
          for (const [v, g] of Object.entries(item.filling_g)) {
            if (!variantSet.has(v))
              err(
                `${p}.filling_g.${v}`,
                `Variante „${v}“ steht nicht in variants.`
              )
            if (g !== null && !isPositiveNumber(g))
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
            `Menge ${value} muss bei der Einheit ${unit} ganzzahlig sein.`
          )
        }
      }
      const hasFilling = item.filling_g !== undefined && item.filling_g !== null
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
              if (variants.length === 0) {
                err(
                  bp,
                  `Posten „${label}“ hat keine variants; base braucht hier eine Zahl.`
                )
                continue
              }
              for (const [v, q] of Object.entries(value)) {
                if (!variantSet.has(v))
                  err(`${bp}.${v}`, `Variante „${v}“ steht nicht in variants.`)
                if (q !== null) checkQty(`${bp}.${v}`, q)
              }
            } else {
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
      })
    }
  }

  return { ok: errors.length === 0, errors, warnings }
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

/**
 * Bringt eine (gepruefte) Konfiguration in eine feste Form: Standardwerte
 * gesetzt, Wochentage als Zahl-Schluessel, Listen statt `undefined`.
 * Idempotent - `normalizeConfig(normalizeConfig(x))` ist gleich.
 */
function normalizeConfig(obj) {
  const src = isPlainObject(obj) ? obj : {}
  const sections = Array.isArray(src.sections)
    ? src.sections.filter((s) => SECTIONS.includes(s))
    : []
  const doughs = (Array.isArray(src.doughs) ? src.doughs : [])
    .filter(isPlainObject)
    .map((d) => ({
      id: d.id,
      name: typeof d.name === 'string' && d.name.trim() ? d.name : d.id,
      batch_max_kg: isPositiveNumber(d.batch_max_kg) ? d.batch_max_kg : null,
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
      const variants = Array.isArray(item.variants) ? [...item.variants] : []
      let fillingG = null
      if (isPlainObject(item.filling_g)) {
        fillingG = {}
        for (const v of variants) {
          const g = item.filling_g[v]
          fillingG[v] = isPositiveNumber(g) ? g : null
        }
      } else if (isPositiveNumber(item.filling_g)) {
        fillingG = {}
        for (const v of variants) fillingG[v] = item.filling_g
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
          })),
        plu: Array.isArray(item.plu) ? [...item.plu] : [],
        variants,
        dough: isPlainObject(item.dough)
          ? {
              id: item.dough.id,
              piece_g: item.dough.piece_g,
              pieces: item.dough.pieces === undefined ? 1 : item.dough.pieces,
            }
          : null,
        filling_g: fillingG,
        tray,
        base: toWeekdayMap(item.base, (v) => (isPlainObject(v) ? { ...v } : v)),
        pieces_per_liter: isPositiveNumber(item.pieces_per_liter)
          ? item.pieces_per_liter
          : null,
        note: typeof item.note === 'string' ? item.note : null,
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
      }
    })
  return {
    version: src.version,
    days: Array.isArray(src.days) ? [...src.days] : [],
    sections,
    items,
    doughs,
    fillings,
    prep,
  }
}

module.exports = {
  SECTIONS,
  SECTION_LABELS,
  UNITS,
  INTEGER_UNITS,
  WEEKDAY_NAMES,
  RECIPE_DIR,
  isSlug,
  isSafeRecipePath,
  validateBackzettelConfig,
  normalizeConfig,
}
