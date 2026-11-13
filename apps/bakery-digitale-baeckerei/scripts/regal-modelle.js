/**
 * Regal-Modelle (DB12): die leichten Modelle einzelner Produkte, die die App
 * auf die Plätze des Ladens legt (`models/<id>/regal.glb` im Daten-Repo
 * `produkte-3d`, Manifest Version 2). Reine Logik ohne Dateisystem und ohne
 * git; getestet in regal-modelle.spec.ts. CommonJS, nur Node-Bordmittel.
 *
 * - `leseRegal`: prüft eine Datei gegen den Vertrag des Daten-Repos (README
 *   dort, „Regal-Modell“): ein Mesh, ein Primitiv, höchstens 250 Dreiecke und
 *   40 KB, `POSITION` als Float, `COLOR_0` als normalisierte 16-Bit-Werte,
 *   Indizes 16 Bit, `KHR_materials_unlit`, keine Kompression, keine Textur,
 *   kein Knoten mit Transformation, keine `extras`.
 * - `packeRegale`: fasst viele davon zu **einer** Datei zusammen (ein GLB,
 *   je Produkt ein Mesh mit dem Namen der Produkt-ID, ein gemeinsames
 *   Material) - eine Anfrage statt fünfzig. Die Bytes der Geometrie bleiben
 *   unverändert.
 * - `lesePaket`: liest ein solches Paket wieder (Export-Wächter, Tests).
 */
const { leseGlb, schreibeGlb } = require('./glb-bereinigen')
const { istModellId } = require('../../../libs/shared/produkte-3d/src/index.js')

const MAX_DREIECKE = 250
const MAX_BYTES = 40_000
const UNLIT = 'KHR_materials_unlit'
/** Datei des Pakets unter public/produkte-3d/ - `_` kann in keiner Produkt-ID stehen. */
const PAKET_DATEI = '_regal.glb'
const PAKET_MATERIAL = 'regal'

const FLOAT = 5126
const USHORT = 5123

/**
 * @typedef {{ min: number[], max: number[] }} Bbox
 * @typedef {{
 *   id: string,
 *   dreiecke: number,
 *   bbox_m: Bbox,
 *   indizes: Buffer, anzahlIndizes: number,
 *   ecken: Buffer, anzahlEcken: number, schritt: number,
 *   farbeAb: number,
 * }} Regal
 * @typedef {{ bbox_m: Bbox, dreiecke: number }} RegalEintrag
 */

const runde = (v) => {
  const r = Math.round(v * 1e4) / 1e4
  return r === 0 ? 0 : r
}

/**
 * Prüft ein `regal.glb` gegen den Vertrag und gibt seine Geometrie zurück.
 * Wirft mit einer Meldung, die sagt, was nicht stimmt.
 * @param {Uint8Array} data
 * @param {string} id
 * @returns {Regal}
 */
function leseRegal(data, id) {
  const wo = `regal.glb (${id})`
  if (!istModellId(id)) throw new Error(`Modell-ID "${id}" ist ungültig`)
  if (data.byteLength > MAX_BYTES) {
    throw new Error(`${wo}: ${data.byteLength} Bytes, höchstens ${MAX_BYTES}`)
  }
  const { json, bin } = leseGlb(data)
  if (!bin) throw new Error(`${wo}: ohne Daten`)
  const fremd = (json.extensionsUsed ?? []).filter((e) => e !== UNLIT)
  if (fremd.length > 0) {
    throw new Error(`${wo}: Erweiterung ${fremd[0]} ist nicht erlaubt`)
  }
  if (json.images || json.textures || json.animations || json.skins) {
    throw new Error(`${wo}: Texturen und Animationen sind nicht erlaubt`)
  }
  const meshes = json.meshes ?? []
  if (meshes.length !== 1 || (meshes[0].primitives ?? []).length !== 1) {
    throw new Error(`${wo}: genau ein Mesh mit einem Primitiv erwartet`)
  }
  for (const node of json.nodes ?? []) {
    if (node.matrix || node.translation || node.rotation || node.scale) {
      throw new Error(`${wo}: ein Knoten trägt eine Transformation`)
    }
    if (node.extras) throw new Error(`${wo}: extras sind nicht erlaubt`)
  }
  const prim = meshes[0].primitives[0]
  if (prim.mode !== undefined && prim.mode !== 4) {
    throw new Error(`${wo}: nur Dreiecke`)
  }
  const material = (json.materials ?? [])[prim.material]
  if (!material || !material.extensions || !material.extensions[UNLIT]) {
    throw new Error(`${wo}: das Material ist nicht ${UNLIT}`)
  }
  const attribute = Object.keys(prim.attributes ?? {}).sort()
  if (attribute.join(',') !== 'COLOR_0,POSITION') {
    throw new Error(`${wo}: erwartet POSITION und COLOR_0, sonst nichts`)
  }
  const acc = (i) => (json.accessors ?? [])[i]
  const pos = acc(prim.attributes.POSITION)
  const farbe = acc(prim.attributes.COLOR_0)
  const idx = acc(prim.indices)
  if (!pos || pos.type !== 'VEC3' || pos.componentType !== FLOAT) {
    throw new Error(`${wo}: POSITION muss VEC3 Float sein`)
  }
  if (
    !farbe ||
    farbe.type !== 'VEC3' ||
    farbe.componentType !== USHORT ||
    farbe.normalized !== true
  ) {
    throw new Error(`${wo}: COLOR_0 muss VEC3, 16 Bit, normalisiert sein`)
  }
  if (!idx || idx.type !== 'SCALAR' || idx.componentType !== USHORT) {
    throw new Error(`${wo}: Indizes müssen 16 Bit sein`)
  }
  if (idx.count % 3 !== 0 || idx.count / 3 > MAX_DREIECKE || idx.count === 0) {
    throw new Error(
      `${wo}: ${idx.count / 3} Dreiecke, erlaubt sind 1 bis ${MAX_DREIECKE}`
    )
  }
  if (pos.bufferView !== farbe.bufferView || pos.count !== farbe.count) {
    throw new Error(`${wo}: POSITION und COLOR_0 müssen in einer View liegen`)
  }
  const view = (i) => {
    const v = (json.bufferViews ?? [])[i]
    if (!v || v.extensions) throw new Error(`${wo}: BufferView ${i} fehlt`)
    const start = v.byteOffset ?? 0
    if (start + v.byteLength > bin.length) {
      throw new Error(`${wo}: BufferView ${i} reicht über die Daten hinaus`)
    }
    return { bytes: bin.subarray(start, start + v.byteLength), v }
  }
  const eckenView = view(pos.bufferView)
  const schritt = eckenView.v.byteStride ?? 0
  const posAb = pos.byteOffset ?? 0
  const farbeAb = farbe.byteOffset ?? 0
  if (
    schritt < 18 ||
    schritt % 4 !== 0 ||
    posAb !== 0 ||
    farbeAb < 12 ||
    farbeAb + 6 > schritt ||
    eckenView.bytes.length < pos.count * schritt
  ) {
    throw new Error(`${wo}: Aufbau der Eckpunkte ist nicht der des Vertrags`)
  }
  const idxView = view(idx.bufferView)
  const idxAb = idx.byteOffset ?? 0
  if (idxView.bytes.length < idxAb + idx.count * 2) {
    throw new Error(`${wo}: Indizes reichen über ihre View hinaus`)
  }
  const indizes = idxView.bytes.subarray(idxAb, idxAb + idx.count * 2)
  const ecken = eckenView.bytes.subarray(0, pos.count * schritt)
  for (let i = 0; i < idx.count; i += 1) {
    if (indizes.readUInt16LE(i * 2) >= pos.count) {
      throw new Error(`${wo}: ein Index zeigt auf keinen Eckpunkt`)
    }
  }
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.count; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      const wert = ecken.readFloatLE(i * schritt + k * 4)
      if (!Number.isFinite(wert)) {
        throw new Error(`${wo}: ein Eckpunkt ist keine Zahl`)
      }
      if (wert < min[k]) min[k] = wert
      if (wert > max[k]) max[k] = wert
    }
  }
  return {
    id,
    dreiecke: idx.count / 3,
    bbox_m: { min: min.map(runde), max: max.map(runde) },
    indizes,
    anzahlIndizes: idx.count,
    ecken,
    anzahlEcken: pos.count,
    schritt,
    farbeAb,
  }
}

/**
 * Fasst Regal-Modelle zu einem GLB zusammen (Reihenfolge: nach ID).
 * @param {Regal[]} regale
 * @returns {{ glb: Uint8Array, modelle: Record<string, RegalEintrag> }}
 */
function packeRegale(regale) {
  const sortiert = [...regale].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )
  const json = {
    asset: { version: '2.0', generator: 'bakery-digitale-baeckerei regal' },
    extensionsUsed: [UNLIT],
    scene: 0,
    scenes: [{ nodes: sortiert.map((_, i) => i) }],
    nodes: [],
    meshes: [],
    materials: [
      {
        name: PAKET_MATERIAL,
        pbrMetallicRoughness: {},
        extensions: { [UNLIT]: {} },
      },
    ],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  }
  /** @type {Buffer[]} */
  const teile = []
  let laenge = 0
  const haengeAn = (bytes) => {
    const start = laenge
    teile.push(bytes)
    laenge += bytes.length
    const rest = (4 - (laenge % 4)) % 4
    if (rest) {
      teile.push(Buffer.alloc(rest))
      laenge += rest
    }
    return start
  }
  /** @type {Record<string, RegalEintrag>} */
  const modelle = {}
  sortiert.forEach((regal, i) => {
    if (Object.prototype.hasOwnProperty.call(modelle, regal.id)) {
      throw new Error(`Regal-Modell ${regal.id} steht doppelt im Paket`)
    }
    const idxStart = haengeAn(regal.indizes)
    const eckenStart = haengeAn(regal.ecken)
    json.bufferViews.push(
      {
        buffer: 0,
        byteOffset: idxStart,
        byteLength: regal.indizes.length,
        target: 34963,
      },
      {
        buffer: 0,
        byteOffset: eckenStart,
        byteLength: regal.ecken.length,
        byteStride: regal.schritt,
        target: 34962,
      }
    )
    json.accessors.push(
      {
        bufferView: i * 2,
        componentType: USHORT,
        count: regal.anzahlIndizes,
        type: 'SCALAR',
      },
      {
        bufferView: i * 2 + 1,
        byteOffset: 0,
        componentType: FLOAT,
        count: regal.anzahlEcken,
        type: 'VEC3',
        min: regal.bbox_m.min,
        max: regal.bbox_m.max,
      },
      {
        bufferView: i * 2 + 1,
        byteOffset: regal.farbeAb,
        componentType: USHORT,
        normalized: true,
        count: regal.anzahlEcken,
        type: 'VEC3',
      }
    )
    json.meshes.push({
      name: regal.id,
      primitives: [
        {
          attributes: { POSITION: i * 3 + 1, COLOR_0: i * 3 + 2 },
          indices: i * 3,
          material: 0,
          mode: 4,
        },
      ],
    })
    json.nodes.push({ name: regal.id, mesh: i })
    modelle[regal.id] = { bbox_m: regal.bbox_m, dreiecke: regal.dreiecke }
  })
  json.buffers[0].byteLength = laenge
  return { glb: schreibeGlb(json, Buffer.concat(teile, laenge)), modelle }
}

/**
 * Welche Produkte stecken in einem Paket, mit wie vielen Dreiecken? Wirft,
 * wenn die Datei kein Paket aus `packeRegale` ist.
 * @param {Uint8Array} data
 * @returns {Record<string, { dreiecke: number }>}
 */
function lesePaket(data) {
  const { json } = leseGlb(data)
  /** @type {Record<string, { dreiecke: number }>} */
  const out = {}
  const fremd = (json.extensionsUsed ?? []).filter((e) => e !== UNLIT)
  if (fremd.length > 0 || json.images || json.textures) {
    throw new Error('Regal-Paket: unerwarteter Inhalt')
  }
  for (const node of json.nodes ?? []) {
    const mesh = (json.meshes ?? [])[node.mesh]
    const prim = mesh && mesh.primitives && mesh.primitives[0]
    const idx = prim && (json.accessors ?? [])[prim.indices]
    if (!istModellId(node.name) || !idx || mesh.primitives.length !== 1) {
      throw new Error('Regal-Paket: ein Knoten ist kein Regal-Modell')
    }
    if (node.extras || mesh.extras || prim.extras) {
      throw new Error('Regal-Paket: extras sind nicht erlaubt')
    }
    out[node.name] = { dreiecke: idx.count / 3 }
  }
  return out
}

module.exports = {
  MAX_BYTES,
  MAX_DREIECKE,
  PAKET_DATEI,
  leseRegal,
  lesePaket,
  packeRegale,
}
