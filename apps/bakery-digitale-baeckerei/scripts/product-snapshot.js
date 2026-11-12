/**
 * Reine Logik zum Produkt-Snapshot (`public/data/products.snapshot.json`, Form
 * `ProduktSnapshot` aus src/lib/produkte/types.ts): aus den hq-Produkten die
 * Felder für die App bauen - OHNE Preise (DB8) und ohne Allergene -, den
 * fertigen Snapshot prüfen und melden, was die Belegung zeigt, hq aber nicht
 * hat. Ohne Dateisystem, getestet in product-snapshot.spec.ts. CommonJS, nur
 * Node-Bordmittel; scripts/sync-products.mjs ist die Hülle darum, gelesen wird
 * hq über die Lib libs/shared/hq-products.
 */

/**
 * Adresse der Landingpage. Dieselbe wie `SITE_URL` in
 * apps/bakery-landing/src/config/legal.ts (product-snapshot.spec.ts prüft
 * das). Produktseiten liegen dort unter `/products/<numeric_id>`.
 */
const LANDING_URL = 'https://xn--bckerei-heusser-0kb.de'

/** Felder eines Produkts im Snapshot - alles andere ist ein Fehler. */
const FELDER = [
  'id',
  'name',
  'kategorie',
  'einheit',
  'kurztext',
  'text',
  'seite',
]
const PFLICHT = ['id', 'name', 'kategorie', 'kurztext', 'text']

/**
 * @typedef {import('../../../libs/shared/hq-products/src/index.js').HqProductRecord} HqProductRecord
 * @typedef {{ id: string, name: string, kategorie: string, einheit?: string, kurztext: string, text: string, seite?: string }} ProduktInfo
 * @typedef {{ version: 1, erstellt: string, produkte: Record<string, ProduktInfo> }} ProduktSnapshot
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Einheit aus dem hq-Feld `weight`: `750g` → `750 g`, `1,5kg` → `1,5 kg`,
 * die Zahl 750 → `750 g` (hq: „Gramm als Zahl“). Anderer Text bleibt, wie er
 * ist. Ohne `weight`: `undefined` - nie aus dem Namen oder der ID geraten.
 * @param {unknown} weight
 * @returns {string | undefined}
 */
function einheitAus(weight) {
  if (typeof weight === 'number') {
    return Number.isFinite(weight) && weight > 0 ? `${weight} g` : undefined
  }
  if (typeof weight !== 'string') return undefined
  const text = weight.trim()
  if (text === '') return undefined
  const m = /^(\d+(?:[.,]\d+)?)\s*([A-Za-zÄÖÜäöü]+)$/.exec(text)
  return m ? `${m[1]} ${m[2]}` : text
}

/**
 * Baut den Snapshot aus den hq-Produkten: nur verfügbare (`available` nicht
 * `false`, wie auf der Landingpage), nach ID sortiert. `uebersprungen` nennt
 * Dateien, die nicht in den Snapshot passen (mit Grund).
 * @param {HqProductRecord[]} records
 * @param {{ erstellt: string, landingUrl?: string }} options
 * @returns {{ snapshot: ProduktSnapshot, uebersprungen: { file: string, grund: string }[] }}
 */
function baueSnapshot(records, options) {
  const landingUrl = (options.landingUrl || LANDING_URL).replace(/\/+$/, '')
  /** @type {Map<string, ProduktInfo>} */
  const byId = new Map()
  /** @type {{ file: string, grund: string }[]} */
  const uebersprungen = []
  for (const r of records) {
    if (r.available === false) continue
    if (typeof r.id !== 'string' || typeof r.name !== 'string') {
      uebersprungen.push({ file: r.file, grund: 'id oder name ist kein Text' })
      continue
    }
    if (typeof r.category !== 'string' || r.category === '') {
      uebersprungen.push({ file: r.file, grund: 'category fehlt' })
      continue
    }
    if (byId.has(r.id)) {
      uebersprungen.push({ file: r.file, grund: `id ${r.id} doppelt` })
      continue
    }
    /** @type {ProduktInfo} */
    const info = { id: r.id, name: r.name, kategorie: r.category }
    const einheit = einheitAus(r.weight)
    if (einheit !== undefined) info.einheit = einheit
    info.kurztext =
      typeof r.short_description === 'string' ? r.short_description.trim() : ''
    // Ein Text, der nur aus einer Überschrift besteht, ist keiner.
    info.text = /^#{1,6}[^\n]*$/.test(r.body) ? '' : r.body
    // Die Landingpage baut für jedes hq-Produkt eine Seite unter seiner Nummer.
    if (Number.isInteger(r.numeric_id) && Number(r.numeric_id) > 0) {
      info.seite = `${landingUrl}/products/${r.numeric_id}`
    }
    byId.set(r.id, info)
  }
  /** @type {Record<string, ProduktInfo>} */
  const produkte = {}
  for (const id of [...byId.keys()].sort()) {
    produkte[id] = /** @type {ProduktInfo} */ (byId.get(id))
  }
  return {
    snapshot: { version: 1, erstellt: options.erstellt, produkte },
    uebersprungen,
  }
}

/**
 * Prüft einen Snapshot, bevor er nach public/ geht (gebaut oder Fixture):
 * Form, nur die erlaubten Felder - also kein Preis, keine Allergene - und kein
 * „€“ in einem Text (DB8). Wirft mit einer deutschen Meldung.
 * @param {unknown} raw
 * @returns {ProduktSnapshot}
 */
function pruefeSnapshot(raw) {
  if (!isRecord(raw)) throw new Error('Snapshot: kein Objekt')
  if (raw.version !== 1) throw new Error('Snapshot: version muss 1 sein')
  if (typeof raw.erstellt !== 'string' || raw.erstellt === '') {
    throw new Error('Snapshot: erstellt fehlt')
  }
  if (!isRecord(raw.produkte)) throw new Error('Snapshot: produkte fehlt')
  for (const [key, p] of Object.entries(raw.produkte)) {
    if (!isRecord(p)) throw new Error(`Snapshot: ${key} ist kein Objekt`)
    if (p.id !== key) throw new Error(`Snapshot: ${key} hat die id ${p.id}`)
    for (const feld of Object.keys(p)) {
      if (!FELDER.includes(feld)) {
        throw new Error(
          `Snapshot: ${key} hat das Feld "${feld}" - erlaubt sind nur ${FELDER.join(
            ', '
          )} (keine Preise, keine Allergene)`
        )
      }
      if (typeof p[feld] !== 'string') {
        throw new Error(`Snapshot: ${key}.${feld} ist kein Text`)
      }
      if (p[feld].includes('€')) {
        throw new Error(
          `Snapshot: ${key}.${feld} enthält „€“ - vorerst keine Preise (DB8). Den Text in hq ändern.`
        )
      }
    }
    for (const feld of PFLICHT) {
      if (typeof p[feld] !== 'string') {
        throw new Error(`Snapshot: ${key}.${feld} fehlt`)
      }
    }
  }
  return /** @type {ProduktSnapshot} */ (/** @type {unknown} */ (raw))
}

/**
 * Was zeigt das Modell, das der Snapshot nicht hat? Solche Plätze bleiben
 * sichtbar, aber ohne Karte - der Build meldet sie (Plan, „Produktdaten“).
 * `nichtVerfuegbar`: steht in hq, aber mit `available: false`. Braucht nur
 * `slots[].produkt` der Belegung.
 * @param {{ slots: { produkt: string }[] }} belegung
 * @param {{ produkte: Record<string, unknown> }} snapshot
 * @param {{ id: unknown }[]} [records] alle hq-Produkte (auch nicht verfügbare)
 * @returns {{ imModell: number, gefunden: number, fehlt: string[], nichtVerfuegbar: string[] }}
 */
function fehlendeProdukte(belegung, snapshot, records = []) {
  const ids = [...new Set(belegung.slots.map((s) => s.produkt))].sort()
  const inHq = new Set(records.map((r) => r.id))
  const has = (/** @type {string} */ id) =>
    Object.prototype.hasOwnProperty.call(snapshot.produkte, id)
  const offen = ids.filter((id) => !has(id))
  return {
    imModell: ids.length,
    gefunden: ids.length - offen.length,
    fehlt: offen.filter((id) => !inHq.has(id)),
    nichtVerfuegbar: offen.filter((id) => inHq.has(id)),
  }
}

module.exports = {
  LANDING_URL,
  einheitAus,
  baueSnapshot,
  pruefeSnapshot,
  fehlendeProdukte,
}
