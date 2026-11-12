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

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'
const FILL = 'morgens'
const PREFIX = 'produkt/'

/**
 * @typedef {{ slot: string, produkt: string, anzahl?: number }} BelegungEintrag
 * @typedef {{ version: 1, quelle: { commit: string }, slots: BelegungEintrag[] }} Belegung
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Liest den JSON-Teil (erster Chunk) eines binären glTF 2.0. Wirft mit einer
 * deutschen Meldung, wenn die Datei kein GLB ist.
 * @param {Uint8Array} data
 * @returns {Record<string, unknown>}
 */
function parseGlbJson(data) {
  if (data.byteLength < 20) throw new Error('GLB: Datei ist zu kurz')
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('GLB: Kennung "glTF" fehlt')
  }
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`GLB: Version ${version}, erwartet 2`)
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== CHUNK_JSON) {
    throw new Error('GLB: der erste Teil ist kein JSON')
  }
  if (20 + chunkLength > data.byteLength) {
    throw new Error('GLB: der JSON-Teil ist länger als die Datei')
  }
  const text = Buffer.from(
    data.buffer,
    data.byteOffset + 20,
    chunkLength
  ).toString('utf8')
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('GLB: der JSON-Teil lässt sich nicht lesen')
  }
  if (!isRecord(json)) throw new Error('GLB: der JSON-Teil ist kein Objekt')
  return json
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

module.exports = { parseGlbJson, belegungAusGltf, belegungAusGlb }
