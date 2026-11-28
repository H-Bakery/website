/**
 * Liest die Eckpunkte der Knoten eines GLB im Rahmen der Szene - für die
 * Plätze der Einrichtung (plaetze.js): Wo liegt die Ware eines Platzes, wie
 * breit und tief ist sie? Reine Logik ohne Dateisystem; getestet in
 * glb-geometrie.spec.ts. CommonJS, nur Node-Bordmittel.
 *
 * Gelesen wird, was die Modelle der Digitalen Bäckerei benutzen:
 * - Knoten als Wurzeln der Szene mit `translation`, `rotation`, `scale`
 *   (kein `matrix`, keine Kinder - ein solcher Knoten wird ausgelassen);
 * - `POSITION` als Float oder quantisiert (`KHR_mesh_quantization`:
 *   int8/int16, auch normalisiert);
 * - BufferViews mit `EXT_meshopt_compression`: Dafür braucht es einen
 *   Decoder (`MeshoptDecoder` aus three), den der Aufrufer mitgibt. Das
 *   synthetische Modell der Tests ist nicht komprimiert und braucht keinen.
 */
const { leseGlb } = require('./glb-bereinigen')

const MESHOPT = 'EXT_meshopt_compression'

/** Bytes je Komponente nach glTF-`componentType`. */
const KOMPONENTE = {
  5120: { bytes: 1, lies: 'getInt8', max: 127 },
  5121: { bytes: 1, lies: 'getUint8', max: 255 },
  5122: { bytes: 2, lies: 'getInt16', max: 32767 },
  5123: { bytes: 2, lies: 'getUint16', max: 65535 },
  5125: { bytes: 4, lies: 'getUint32', max: 1 },
  5126: { bytes: 4, lies: 'getFloat32', max: 1 },
}

/**
 * @typedef {{
 *   decodeGltfBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string) => void
 * }} Decoder
 * @typedef {{ material: string, punkte: Float64Array }} Teil  Eckpunkte x,y,z hintereinander, im Rahmen der Szene
 * @typedef {{ name: string, extras: Record<string, unknown>, teile: Teil[] }} KnotenGeometrie
 */

/** Braucht dieses GLB einen meshopt-Decoder? @param {any} json */
function brauchtDecoder(json) {
  return (
    Array.isArray(json.bufferViews) &&
    json.bufferViews.some((v) => v && v.extensions && v.extensions[MESHOPT])
  )
}

/**
 * Die Bytes einer BufferView, bei meshopt entpackt.
 * @param {any} json
 * @param {Buffer} bin
 * @param {number} index
 * @param {Decoder | null} decoder
 * @param {Map<number, { daten: Uint8Array, stride: number }>} cache
 */
function viewBytes(json, bin, index, decoder, cache) {
  const hit = cache.get(index)
  if (hit) return hit
  const view = json.bufferViews[index]
  if (!view) throw new Error(`GLB: BufferView ${index} fehlt`)
  const ext = view.extensions && view.extensions[MESHOPT]
  let out
  if (ext) {
    if (!decoder) {
      throw new Error(
        'GLB: das Modell ist meshopt-komprimiert, aber es gibt keinen Decoder'
      )
    }
    const quelle = bin.subarray(
      ext.byteOffset || 0,
      (ext.byteOffset || 0) + ext.byteLength
    )
    const daten = new Uint8Array(ext.count * ext.byteStride)
    decoder.decodeGltfBuffer(
      daten,
      ext.count,
      ext.byteStride,
      quelle,
      ext.mode,
      ext.filter
    )
    out = { daten, stride: ext.byteStride }
  } else {
    const start = view.byteOffset || 0
    out = {
      daten: bin.subarray(start, start + view.byteLength),
      stride: view.byteStride || 0,
    }
  }
  cache.set(index, out)
  return out
}

/**
 * Ein VEC3-Accessor als Zahlen (normalisierte Ganzzahlen schon geteilt).
 * @returns {Float64Array}
 */
function liesVec3(json, bin, accessorIndex, decoder, cache) {
  const acc = json.accessors[accessorIndex]
  if (!acc || acc.type !== 'VEC3') {
    throw new Error(`GLB: Accessor ${accessorIndex} ist kein VEC3`)
  }
  const komp = KOMPONENTE[acc.componentType]
  if (!komp) throw new Error(`GLB: componentType ${acc.componentType}`)
  const { daten, stride } = viewBytes(json, bin, acc.bufferView, decoder, cache)
  const schritt = stride || komp.bytes * 3
  const start = acc.byteOffset || 0
  const sicht = new DataView(daten.buffer, daten.byteOffset, daten.byteLength)
  const out = new Float64Array(acc.count * 3)
  const teiler = acc.normalized ? komp.max : 1
  for (let i = 0; i < acc.count; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      const wert = sicht[komp.lies](start + i * schritt + k * komp.bytes, true)
      out[i * 3 + k] = acc.normalized ? Math.max(wert / teiler, -1) : wert
    }
  }
  return out
}

/** Dreht `v` mit dem Quaternion `q` = [x, y, z, w]. */
function drehe(q, x, y, z) {
  const [qx, qy, qz, qw] = q
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ]
}

/**
 * Die Geometrie aller Knoten, für die `waehle(name, extras)` wahr ist: je
 * Primitiv das Material und die Eckpunkte im Rahmen der Szene.
 * @param {Uint8Array} glb
 * @param {(name: string, extras: Record<string, unknown>) => boolean} waehle
 * @param {Decoder | null} [decoder]
 * @returns {KnotenGeometrie[]}
 */
function knotenGeometrie(glb, waehle, decoder = null) {
  const { json, bin } = leseGlb(glb)
  if (!bin) return []
  const cache = new Map()
  /** @type {KnotenGeometrie[]} */
  const out = []
  for (const node of Array.isArray(json.nodes) ? json.nodes : []) {
    if (!node || typeof node.name !== 'string') continue
    if (typeof node.mesh !== 'number' || node.matrix || node.children) continue
    const extras =
      node.extras && typeof node.extras === 'object' ? node.extras : {}
    if (!waehle(node.name, extras)) continue
    const mesh = json.meshes[node.mesh]
    const t = node.translation || [0, 0, 0]
    const s = node.scale || [1, 1, 1]
    const q = node.rotation || null
    /** @type {Teil[]} */
    const teile = []
    for (const prim of (mesh && mesh.primitives) || []) {
      if (!prim.attributes || typeof prim.attributes.POSITION !== 'number') {
        continue
      }
      const roh = liesVec3(json, bin, prim.attributes.POSITION, decoder, cache)
      const punkte = new Float64Array(roh.length)
      for (let i = 0; i < roh.length; i += 3) {
        let x = roh[i] * s[0]
        let y = roh[i + 1] * s[1]
        let z = roh[i + 2] * s[2]
        if (q) [x, y, z] = drehe(q, x, y, z)
        punkte[i] = x + t[0]
        punkte[i + 1] = y + t[1]
        punkte[i + 2] = z + t[2]
      }
      const material =
        typeof prim.material === 'number' && json.materials[prim.material]
          ? String(json.materials[prim.material].name ?? '')
          : ''
      teile.push({ material, punkte })
    }
    out.push({ name: node.name, extras, teile })
  }
  return out
}

module.exports = { brauchtDecoder, knotenGeometrie }
