/**
 * Reine Logik: aus einem GLB die Preisschilder herausnehmen, bevor es
 * ausgeliefert wird (DB8: keine Preise, auch nicht im Bild - und damit auch
 * nicht als Geometrie in der Datei, die jeder herunterladen kann).
 *
 * Was passiert:
 * 1. Jedes Primitiv, dessen Material `preiskarte` oder `preisschrift` heißt,
 *    fliegt aus seinem Mesh.
 * 2. Accessors, BufferViews und Materialien, die danach niemand mehr braucht,
 *    werden entfernt; alle Verweise werden neu durchgezählt. Was sich ein
 *    entferntes Primitiv mit anderer Geometrie teilt, bleibt unangetastet.
 * 3. Die Bytes der entfernten BufferViews werden aus dem BIN-Teil geschnitten
 *    (bei `EXT_meshopt_compression` die komprimierten Bereiche; der
 *    Ersatz-Puffer ohne Daten schrumpft nur als Zahl). Geschnitten wird in
 *    Vielfachen von 4 Bytes, damit die Ausrichtung aller übrigen Daten bleibt.
 * 4. `extras`, die der Browser nicht braucht (`source`, `sigma_m`,
 *    `confidence`), verschwinden von den Knoten.
 * 5. JSON- und BIN-Teil werden neu aufgefüllt, die Längen neu geschrieben.
 *
 * Gleiches GLB hinein = Byte für Byte gleiches GLB heraus. Ein Modell, dessen
 * Aufbau dieses Skript nicht kennt (Texturen, Animationen, Morph-Targets,
 * fremde Extensions), lässt es scheitern statt halb zu bereinigen.
 *
 * Ohne three, ohne Netz, ohne Dateisystem - getestet in glb-bereinigen.spec.ts.
 * CommonJS, nur Node-Bordmittel; scripts/sync-model.mjs ist die Hülle darum.
 */

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'
const CHUNK_BIN = 0x004e4942 // 'BIN\0'
const MESHOPT = 'EXT_meshopt_compression'

/** Materialnamen der Preisschilder (für die App steht die Regel in src/lib/scene/treffer.ts). */
const PREIS_MATERIALIEN = ['preiskarte', 'preisschrift']
/** Knoten-`extras`, die nur der Generator des Modells braucht. */
const EXTRAS_ENTFERNEN = ['source', 'sigma_m', 'confidence']

const BEKANNTE_TEILE = new Set([
  'asset',
  'scene',
  'scenes',
  'nodes',
  'meshes',
  'materials',
  'accessors',
  'bufferViews',
  'buffers',
  'extensionsUsed',
  'extensionsRequired',
])
const BEKANNTE_EXTENSIONS = new Set([
  MESHOPT,
  'KHR_mesh_quantization',
  'KHR_materials_unlit',
])
const BEKANNTE_PRIMITIV_FELDER = new Set([
  'attributes',
  'indices',
  'material',
  'mode',
  'extras',
])

/**
 * @typedef {{
 *   primitive: number,
 *   accessors: number,
 *   bufferViews: number,
 *   materialien: number,
 *   extras: number,
 *   bytesVorher: number,
 *   bytesNachher: number,
 * }} Bericht  was entfernt wurde
 */

/** @param {unknown} v @returns {any[]} */
const liste = (v) => (Array.isArray(v) ? v : [])

/**
 * Zerlegt ein GLB in JSON- und BIN-Teil und prüft Kopf und Längen streng: Was
 * hier nicht sauber aufgeht, wird nicht umgeschrieben.
 * @param {Uint8Array} data
 * @returns {{ json: any, bin: Buffer | null }}
 */
function leseGlb(data) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (buffer.length < 20) throw new Error('GLB: Datei ist zu kurz')
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('GLB: Kennung "glTF" fehlt')
  }
  const version = buffer.readUInt32LE(4)
  if (version !== 2) throw new Error(`GLB: Version ${version}, erwartet 2`)
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error('GLB: Länge im Kopf passt nicht zur Datei')
  }
  const jsonLength = buffer.readUInt32LE(12)
  if (buffer.readUInt32LE(16) !== CHUNK_JSON) {
    throw new Error('GLB: der erste Teil ist kein JSON')
  }
  const jsonEnd = 20 + jsonLength
  if (jsonEnd > buffer.length) {
    throw new Error('GLB: der JSON-Teil ist länger als die Datei')
  }
  let json
  try {
    json = JSON.parse(buffer.subarray(20, jsonEnd).toString('utf8'))
  } catch {
    throw new Error('GLB: der JSON-Teil lässt sich nicht lesen')
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('GLB: der JSON-Teil ist kein Objekt')
  }
  if (jsonEnd === buffer.length) return { json, bin: null }
  if (jsonEnd + 8 > buffer.length) {
    throw new Error('GLB: nach dem JSON-Teil stehen lose Bytes')
  }
  const binLength = buffer.readUInt32LE(jsonEnd)
  if (buffer.readUInt32LE(jsonEnd + 4) !== CHUNK_BIN) {
    throw new Error('GLB: der zweite Teil ist kein BIN')
  }
  if (jsonEnd + 8 + binLength !== buffer.length) {
    throw new Error('GLB: der BIN-Teil passt nicht zur Dateilänge')
  }
  return { json, bin: buffer.subarray(jsonEnd + 8, jsonEnd + 8 + binLength) }
}

/**
 * Baut ein GLB aus JSON und BIN: JSON mit Leerzeichen, BIN mit Nullen auf 4
 * Bytes aufgefüllt.
 * @param {any} json
 * @param {Buffer | null} bin
 * @returns {Uint8Array}
 */
function schreibeGlb(json, bin) {
  const text = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonLength = Math.ceil(text.length / 4) * 4
  const binLength = bin ? Math.ceil(bin.length / 4) * 4 : 0
  const total = 12 + 8 + jsonLength + (bin ? 8 + binLength : 0)
  const out = Buffer.alloc(total)
  out.writeUInt32LE(GLB_MAGIC, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonLength, 12)
  out.writeUInt32LE(CHUNK_JSON, 16)
  out.fill(0x20, 20, 20 + jsonLength)
  text.copy(out, 20)
  if (bin) {
    const at = 20 + jsonLength
    out.writeUInt32LE(binLength, at)
    out.writeUInt32LE(CHUNK_BIN, at + 4)
    bin.copy(out, at + 8)
  }
  return new Uint8Array(out.buffer, out.byteOffset, out.length)
}

/**
 * Sortiert Bereiche [von, bis) und fasst überlappende zusammen.
 * @param {[number, number][]} bereiche
 * @returns {[number, number][]}
 */
function vereinige(bereiche) {
  const sortiert = bereiche
    .filter(([von, bis]) => bis > von)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  /** @type {[number, number][]} */
  const out = []
  for (const [von, bis] of sortiert) {
    const last = out[out.length - 1]
    if (last && von <= last[1]) last[1] = Math.max(last[1], bis)
    else out.push([von, bis])
  }
  return out
}

/**
 * Was darf aus einem Puffer geschnitten werden? Die Bereiche aus `weg` samt
 * ihrer Füllbytes bis zur nächsten 4er-Grenze, soweit sie nichts aus `bleibt`
 * berühren - danach nach innen auf Vielfache von 4 gerundet, damit sich alles
 * dahinter nur um Vielfache von 4 verschiebt.
 * @param {[number, number][]} weg
 * @param {[number, number][]} bleibt
 * @returns {[number, number][]}
 */
function schnitte(weg, bleibt) {
  const behalten = vereinige(bleibt)
  /** @type {[number, number][]} */
  const frei = []
  const mitFuellbytes = weg.map(
    ([von, bis]) =>
      /** @type {[number, number]} */ ([von, Math.ceil(bis / 4) * 4])
  )
  for (const [von, bis] of vereinige(mitFuellbytes)) {
    let start = von
    for (const [bVon, bBis] of behalten) {
      if (bBis <= start) continue
      if (bVon >= bis) break
      if (bVon > start) frei.push([start, bVon])
      start = Math.max(start, bBis)
    }
    if (start < bis) frei.push([start, bis])
  }
  return vereinige(
    frei.map(([von, bis]) => [Math.ceil(von / 4) * 4, Math.floor(bis / 4) * 4])
  )
}

/**
 * Entfernt Einträge aus einer Liste und liefert die Umrechnung alter Index →
 * neuer Index.
 * @template T
 * @param {T[]} items
 * @param {Set<number>} entfernen
 * @returns {{ rest: T[], neu: (alt: number) => number }}
 */
function ohne(items, entfernen) {
  /** @type {number[]} */
  const map = []
  /** @type {T[]} */
  const rest = []
  items.forEach((item, i) => {
    map[i] = entfernen.has(i) ? -1 : rest.length
    if (!entfernen.has(i)) rest.push(item)
  })
  return {
    rest,
    neu: (alt) => {
      const n = map[alt]
      if (n === undefined || n < 0) {
        throw new Error(
          `GLB: Verweis auf entfernten oder fehlenden Index ${alt}`
        )
      }
      return n
    },
  }
}

/** Die Accessor-Indizes, die ein Primitiv benutzt. @param {any} primitiv */
function accessorsVon(primitiv) {
  const out = Object.values(primitiv.attributes || {})
  if (primitiv.indices !== undefined) out.push(primitiv.indices)
  return /** @type {number[]} */ (out)
}

/**
 * Die Byte-Bereiche, die eine BufferView belegt: im eigenen Puffer und - mit
 * meshopt - der komprimierte Bereich im Datenpuffer.
 * @param {any} view
 * @returns {{ ziel: any, buffer: number }[]}
 */
function bereicheVon(view) {
  const out = [{ ziel: view, buffer: view.buffer }]
  const ext = view.extensions && view.extensions[MESHOPT]
  if (ext) out.push({ ziel: ext, buffer: ext.buffer })
  return out
}

/** Bricht ab, wenn das Modell etwas enthält, das hier nicht umgerechnet wird. @param {any} json */
function pruefeAufbau(json) {
  for (const key of Object.keys(json)) {
    if (!BEKANNTE_TEILE.has(key)) {
      throw new Error(
        `GLB: "${key}" kennt die Bereinigung nicht - Preisschilder werden nicht halb entfernt`
      )
    }
  }
  for (const ext of liste(json.extensionsUsed)) {
    if (!BEKANNTE_EXTENSIONS.has(ext)) {
      throw new Error(`GLB: Extension ${ext} kennt die Bereinigung nicht`)
    }
  }
  for (const mesh of liste(json.meshes)) {
    for (const primitiv of liste(mesh.primitives)) {
      for (const key of Object.keys(primitiv)) {
        if (!BEKANNTE_PRIMITIV_FELDER.has(key)) {
          throw new Error(
            `GLB: Primitiv-Feld "${key}" kennt die Bereinigung nicht`
          )
        }
      }
    }
  }
  for (const accessor of liste(json.accessors)) {
    if (accessor.sparse !== undefined) {
      throw new Error('GLB: sparse Accessors kennt die Bereinigung nicht')
    }
  }
}

/**
 * Nimmt die Preisschilder und die überflüssigen `extras` aus einem GLB.
 * @param {Uint8Array} data
 * @returns {{ glb: Uint8Array, bericht: Bericht }}
 */
function bereinigeGlb(data) {
  const { json, bin } = leseGlb(data)
  /** @type {Bericht} */
  const bericht = {
    primitive: 0,
    accessors: 0,
    bufferViews: 0,
    materialien: 0,
    extras: 0,
    bytesVorher: data.byteLength,
    bytesNachher: 0,
  }

  const materialWeg = new Set(
    liste(json.materials)
      .map((m, i) => (PREIS_MATERIALIEN.includes(m && m.name) ? i : -1))
      .filter((i) => i >= 0)
  )

  if (materialWeg.size > 0) {
    pruefeAufbau(json)

    // 1. Primitive der Preisschilder aus den Meshes nehmen.
    /** @type {any[]} */
    const entfernt = []
    for (const mesh of liste(json.meshes)) {
      const bleibt = []
      for (const primitiv of liste(mesh.primitives)) {
        if (materialWeg.has(primitiv.material)) entfernt.push(primitiv)
        else bleibt.push(primitiv)
      }
      if (bleibt.length === 0 && liste(mesh.primitives).length > 0) {
        throw new Error(
          `GLB: Mesh "${
            mesh.name ?? '?'
          }" besteht nur aus Preisschildern - ein leeres Mesh ist nicht erlaubt`
        )
      }
      mesh.primitives = bleibt
    }
    bericht.primitive = entfernt.length
    const primitive = liste(json.meshes).flatMap((m) => m.primitives)

    // 2. Accessors, die nur die entfernten Primitive benutzt haben.
    const accGebraucht = new Set(primitive.flatMap(accessorsVon))
    const accWeg = new Set(
      entfernt.flatMap(accessorsVon).filter((i) => !accGebraucht.has(i))
    )
    const alteAccessors = liste(json.accessors)
    const acc = ohne(alteAccessors, accWeg)
    for (const primitiv of primitive) {
      for (const key of Object.keys(primitiv.attributes || {})) {
        primitiv.attributes[key] = acc.neu(primitiv.attributes[key])
      }
      if (primitiv.indices !== undefined) {
        primitiv.indices = acc.neu(primitiv.indices)
      }
    }
    bericht.accessors = accWeg.size

    // 3. BufferViews, die nur diese Accessors benutzt haben.
    const viewGebraucht = new Set(
      acc.rest.map((a) => a.bufferView).filter((i) => i !== undefined)
    )
    const viewWeg = new Set(
      [...accWeg]
        .map((i) => alteAccessors[i].bufferView)
        .filter((i) => i !== undefined && !viewGebraucht.has(i))
    )
    const alteViews = liste(json.bufferViews)
    const views = ohne(alteViews, viewWeg)
    for (const accessor of acc.rest) {
      if (accessor.bufferView !== undefined) {
        accessor.bufferView = views.neu(accessor.bufferView)
      }
    }
    bericht.bufferViews = viewWeg.size

    // 4. Die Materialien selbst.
    const mat = ohne(liste(json.materials), materialWeg)
    for (const primitiv of primitive) {
      if (primitiv.material !== undefined) {
        primitiv.material = mat.neu(primitiv.material)
      }
    }
    bericht.materialien = materialWeg.size

    if (json.accessors) json.accessors = acc.rest
    if (json.bufferViews) json.bufferViews = views.rest
    json.materials = mat.rest

    // 5. Die frei gewordenen Bytes aus den Puffern schneiden.
    const wegBereiche = [...viewWeg].flatMap((i) => bereicheVon(alteViews[i]))
    const bleibBereiche = views.rest.flatMap(bereicheVon)
    /** @param {{ ziel: any }} b @returns {[number, number]} */
    const spanne = ({ ziel }) => {
      const von = ziel.byteOffset || 0
      return [von, von + ziel.byteLength]
    }
    let neuesBin = bin
    liste(json.buffers).forEach((buffer, index) => {
      // Ein Puffer mit `uri` liegt außerhalb der Datei: nicht anfassen.
      if (buffer.uri !== undefined) return
      const cuts = schnitte(
        wegBereiche.filter((b) => b.buffer === index).map(spanne),
        bleibBereiche.filter((b) => b.buffer === index).map(spanne)
      )
      if (cuts.length === 0) return
      for (const b of bleibBereiche) {
        if (b.buffer !== index) continue
        const von = b.ziel.byteOffset || 0
        let davor = 0
        for (const [cVon, cBis] of cuts) if (cBis <= von) davor += cBis - cVon
        if (davor > 0) b.ziel.byteOffset = von - davor
      }
      const gesamt = cuts.reduce((sum, [von, bis]) => sum + bis - von, 0)
      // Der BIN-Teil gehört zum ersten Puffer; ein meshopt-Ersatzpuffer hat
      // keine Daten und schrumpft nur als Zahl.
      if (index === 0 && bin) {
        const teile = []
        let pos = 0
        for (const [von, bis] of cuts) {
          teile.push(bin.subarray(pos, von))
          pos = bis
        }
        teile.push(bin.subarray(pos))
        neuesBin = Buffer.concat(teile)
      }
      buffer.byteLength -= gesamt
    })
    return fertig(json, neuesBin, bericht)
  }
  return fertig(json, bin, bericht)
}

/**
 * Letzter Schritt: `extras` kürzen und schreiben.
 * @param {any} json
 * @param {Buffer | null} bin
 * @param {Bericht} bericht
 */
function fertig(json, bin, bericht) {
  for (const node of liste(json.nodes)) {
    const extras = node && node.extras
    if (typeof extras !== 'object' || extras === null) continue
    for (const key of EXTRAS_ENTFERNEN) {
      if (!Object.prototype.hasOwnProperty.call(extras, key)) continue
      delete extras[key]
      bericht.extras += 1
    }
    if (Object.keys(extras).length === 0) delete node.extras
  }
  const glb = schreibeGlb(json, bin)
  bericht.bytesNachher = glb.byteLength
  return { glb, bericht }
}

/**
 * Wie viele Primitive eines GLB tragen noch ein Preis-Material? Nach der
 * Bereinigung 0 - sync-model prüft das, bevor es die Datei ausliefert.
 * @param {Uint8Array} data
 */
function zaehlePreisPrimitive(data) {
  const { json } = leseGlb(data)
  const namen = liste(json.materials).map((m) => m && m.name)
  let primitive = 0
  for (const mesh of liste(json.meshes)) {
    for (const primitiv of liste(mesh.primitives)) {
      if (PREIS_MATERIALIEN.includes(namen[primitiv.material])) primitive += 1
    }
  }
  const materialien = namen.filter((n) => PREIS_MATERIALIEN.includes(n)).length
  return { primitive, materialien }
}

module.exports = {
  EXTRAS_ENTFERNEN,
  PREIS_MATERIALIEN,
  bereinigeGlb,
  leseGlb,
  schnitte,
  schreibeGlb,
  zaehlePreisPrimitive,
}
