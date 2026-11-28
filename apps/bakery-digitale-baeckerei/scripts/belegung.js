/**
 * Reine Logik zur Belegung: den JSON-Teil eines GLB lesen und daraus ableiten,
 * welches Produkt auf welchem Platz liegt (`public/data/belegung.json`, Form
 * `Belegung` aus src/lib/produkte/types.ts). Ohne three, ohne Netz, ohne
 * Dateisystem - getestet in belegung.spec.ts mit winzigen, von Hand gebauten
 * GLB-Puffern. CommonJS, nur Node-Bordmittel; scripts/sync-model.mjs ist die
 * Hülle darum.
 *
 * Die Namensregel `produkt/<slot>[@<fill>]` steht für die App in
 * src/lib/scene/fills.ts (`parseProduktName`); dieses Skript läuft ohne
 * TypeScript und liest sie deshalb selbst.
 */

const { leseGlb } = require('./glb-bereinigen')

const FILL = 'morgens'
const PREFIX = 'produkt/'

/**
 * @typedef {{ slot: string, produkt: string, anzahl?: number, quelle?: 'einrichtung' }} BelegungEintrag
 * @typedef {{ version: 1, quelle: { commit: string }, slots: BelegungEintrag[] }} Belegung
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Liest den JSON-Teil eines binären glTF 2.0. Wirft mit einer deutschen
 * Meldung, wenn die Datei kein GLB ist. Der Leser selbst steht einmal in
 * glb-bereinigen.js.
 * @param {Uint8Array} data
 * @returns {Record<string, unknown>}
 */
function parseGlbJson(data) {
  return leseGlb(data).json
}

/**
 * Platz eines Knotens: der Name ohne `produkt/` und ohne `@<fill>`, sonst
 * `extras.id`.
 * @param {unknown} name
 * @param {unknown} id
 * @returns {string | null}
 */
function slotVon(name, id) {
  if (typeof name === 'string' && name.startsWith(PREFIX)) {
    const rest = name.slice(PREFIX.length)
    const at = rest.lastIndexOf('@')
    const slot = at < 0 ? rest : rest.slice(0, at)
    if (slot) return slot
  }
  return typeof id === 'string' && id ? id : null
}

/**
 * Die Belegung im Zustand „Morgens“: alle Knoten mit `extras.product`, deren
 * `extras.fills` `morgens` enthält - in der Reihenfolge des Modells. Knoten
 * mit `extras.ware` (neutrale Ware) und Möbel haben kein `product` und fehlen.
 * `doppelt` nennt Plätze, die im Modell mehr als einmal belegt sind (der erste
 * Knoten gewinnt).
 * @param {Record<string, unknown>} gltf
 * @param {string} commit
 * @returns {{ belegung: Belegung, doppelt: string[] }}
 */
function belegungAusGltf(gltf, commit) {
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : []
  /** @type {BelegungEintrag[]} */
  const slots = []
  const seen = new Set()
  const doppelt = new Set()
  for (const node of nodes) {
    if (!isRecord(node) || !isRecord(node.extras)) continue
    const { product, fills, count, id } = node.extras
    if (typeof product !== 'string' || product === '') continue
    if (!Array.isArray(fills) || !fills.includes(FILL)) continue
    const slot = slotVon(node.name, id)
    if (slot === null) continue
    if (seen.has(slot)) {
      doppelt.add(slot)
      continue
    }
    seen.add(slot)
    /** @type {BelegungEintrag} */
    const eintrag = { slot, produkt: product }
    if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
      eintrag.anzahl = count
    }
    slots.push(eintrag)
  }
  return {
    belegung: { version: 1, quelle: { commit }, slots },
    doppelt: [...doppelt],
  }
}

/**
 * @param {Uint8Array} glb
 * @param {string} commit
 */
function belegungAusGlb(glb, commit) {
  return belegungAusGltf(parseGlbJson(glb), commit)
}

/**
 * Der Platz eines Knotens, wenn er im Zustand „Morgens“ zu sehen ist - auch
 * mit neutraler Ware (`extras.ware`): Die Einrichtung (DB12) darf jeden
 * dieser Plätze neu belegen. Sonst `null`.
 * @param {unknown} name
 * @param {unknown} extras
 * @returns {string | null}
 */
function morgensPlatz(name, extras) {
  if (typeof name !== 'string' || !name.startsWith(PREFIX)) return null
  if (!isRecord(extras)) return null
  if (!Array.isArray(extras.fills) || !extras.fills.includes(FILL)) return null
  return slotVon(name, extras.id)
}

/**
 * `public/data/belegung.json`: die Belegung aller gebauten Räume in einer
 * Datei, Schlüssel = id des Raums (src/config/raeume.ts). Ein Raum ohne
 * Produkte (Backstube) steht mit leeren `slots` darin.
 *
 * Version 3 (DB12, „einrichtbar“): `slots` ist die Belegung, wie sie gilt -
 * das Modell, darüber die Einrichtung aus hq (einrichtung.js; solche Einträge
 * tragen `quelle: 'einrichtung'`). `leer`: Plätze, die die Einrichtung
 * ausdrücklich leert. `plaetze`: der Rahmen jedes Platzes des Modells
 * (plaetze.js) - darauf legt die App die Regal-Modelle.
 * @typedef {import('./plaetze').Platz} Platz
 * @typedef {{ quelle: { commit: string }, slots: BelegungEintrag[], leer: string[], plaetze: Record<string, Platz> }} BelegungRaum
 * @typedef {{ version: 3, raeume: Record<string, BelegungRaum> }} BelegungDatei
 * @param {Record<string, { quelle: { commit: string }, slots: BelegungEintrag[], leer?: string[], plaetze?: Record<string, Platz> }>} jeRaum
 * @returns {BelegungDatei}
 */
function fasseZusammen(jeRaum) {
  /** @type {BelegungDatei['raeume']} */
  const raeume = {}
  for (const [raum, belegung] of Object.entries(jeRaum)) {
    raeume[raum] = {
      quelle: belegung.quelle,
      slots: belegung.slots,
      leer: belegung.leer ?? [],
      plaetze: belegung.plaetze ?? {},
    }
  }
  return { version: 3, raeume }
}

/**
 * Alle belegten Plätze aller Räume hintereinander - für alles, was nur
 * wissen will, welche Produkte irgendwo liegen (Snapshot, Export-Wächter).
 * Wirft, wenn die Datei nicht die Form `BelegungDatei` hat.
 * @param {unknown} datei
 * @returns {{ slots: BelegungEintrag[] }}
 */
function alleSlots(datei) {
  if (!isRecord(datei) || datei.version !== 3 || !isRecord(datei.raeume)) {
    throw new Error('belegung.json hat nicht die erwartete Form (version 3)')
  }
  /** @type {BelegungEintrag[]} */
  const slots = []
  for (const [raum, eintrag] of Object.entries(datei.raeume)) {
    if (!isRecord(eintrag) || !Array.isArray(eintrag.slots)) {
      throw new Error(`belegung.json: slots für Raum ${raum} fehlt`)
    }
    slots.push(...eintrag.slots)
  }
  return { slots }
}

module.exports = {
  alleSlots,
  belegungAusGlb,
  belegungAusGltf,
  fasseZusammen,
  morgensPlatz,
  parseGlbJson,
}
