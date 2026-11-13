/**
 * Die synthetischen Regal-Modelle der Tests (DB12): drei erfundene, kantige
 * Formen für die Fixture-Produkte `testbrot-500g`, `musterbrezel` und
 * `musterweck`. CommonJS ohne Abhängigkeiten außer den Sync-Skripten, damit
 * der Generator (`build-regal-fixture.mjs`) und die jest-Specs dieselbe Datei
 * laden. Die echten Regal-Modelle liegen im Daten-Repo `produkte-3d` (nur
 * lokal) und gehören nicht in dieses Repo.
 *
 * Jede Form ist ein Pyramidenstumpf mit einer hellen Kerbe auf der Oberseite
 * und hält den Vertrag der echten Regal-Modelle ein: Meter, y nach oben,
 * steht auf y = 0, mittig in x/z, ein Mesh, ein Primitiv, `POSITION` als
 * Float, `COLOR_0` normalisiert 16 Bit (linear), Indizes 16 Bit,
 * `KHR_materials_unlit`, keine Kompression.
 *
 * Deterministisch: nur feste Zahlen und Multiplikation - gleiche Bytes auf
 * jeder Plattform.
 */
const { leseRegal, packeRegale } = require('../../../scripts/regal-modelle')
const { REGAL_DATEI } = require('../../../scripts/produkte-3d-lock')

/**
 * Die erfundenen Formen: Breite (x), Tiefe (z), Höhe (y) in Metern, Farbe
 * unten und oben (linear, 0…1).
 */
const FORMEN = [
  {
    id: 'musterbrezel',
    masse: [0.14, 0.1, 0.03],
    unten: [0.2, 0.08, 0.03],
    oben: [0.42, 0.2, 0.07],
  },
  {
    id: 'musterweck',
    masse: [0.08, 0.07, 0.05],
    unten: [0.45, 0.3, 0.14],
    oben: [0.75, 0.55, 0.3],
  },
  {
    id: 'testbrot-500g',
    masse: [0.2, 0.1, 0.075],
    unten: [0.25, 0.12, 0.05],
    oben: [0.5, 0.28, 0.12],
  },
]
/** Die Oberseite ist um diesen Anteil schmaler als die Grundfläche. */
const OBEN = 0.7
const KERBE = [0.95, 0.9, 0.8]
const SCHRITT = 20

/**
 * Ein `regal.glb` nach dem Vertrag des Daten-Repos.
 * @param {{ id: string, masse: number[], unten: number[], oben: number[] }} form
 * @returns {Buffer}
 */
function baueRegal({ id, masse, unten, oben }) {
  const [w, d, h] = masse
  const x = w / 2
  const z = d / 2
  /** @type {[number[], number[]][]} Eckpunkt und Farbe */
  const ecken = [
    [[-x, 0, -z], unten],
    [[x, 0, -z], unten],
    [[x, 0, z], unten],
    [[-x, 0, z], unten],
    [[-x * OBEN, h, -z * OBEN], oben],
    [[x * OBEN, h, -z * OBEN], oben],
    [[x * OBEN, h, z * OBEN], oben],
    [[-x * OBEN, h, z * OBEN], oben],
    // Kerbe: ein heller Streifen quer über die Oberseite, knapp darüber.
    [[-x * 0.1, h * 1.02, -z * OBEN * 0.8], KERBE],
    [[x * 0.1, h * 1.02, -z * OBEN * 0.8], KERBE],
    [[x * 0.1, h * 1.02, z * OBEN * 0.8], KERBE],
    [[-x * 0.1, h * 1.02, z * OBEN * 0.8], KERBE],
  ]
  // Außenflächen gegen den Uhrzeigersinn (von außen gesehen).
  // prettier-ignore
  const dreiecke = [
    [0, 1, 2], [0, 2, 3], // Boden
    [4, 6, 5], [4, 7, 6], // Deckel
    [0, 4, 5], [0, 5, 1],
    [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3],
    [3, 7, 4], [3, 4, 0],
    [8, 10, 9], [8, 11, 10], // Kerbe
  ]
  const idx = Buffer.alloc(dreiecke.length * 3 * 2)
  dreiecke.flat().forEach((i, n) => idx.writeUInt16LE(i, n * 2))
  const vtx = Buffer.alloc(ecken.length * SCHRITT)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  ecken.forEach(([p, farbe], i) => {
    for (let k = 0; k < 3; k += 1) {
      vtx.writeFloatLE(p[k], i * SCHRITT + k * 4)
      const gelesen = vtx.readFloatLE(i * SCHRITT + k * 4)
      min[k] = Math.min(min[k], gelesen)
      max[k] = Math.max(max[k], gelesen)
      vtx.writeUInt16LE(Math.round(farbe[k] * 65535), i * SCHRITT + 12 + k * 2)
    }
  })
  const json = {
    asset: { version: '2.0', generator: 'bakery-digitale-baeckerei fixture' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ name: id, nodes: [0] }],
    nodes: [{ name: id, mesh: 0 }],
    meshes: [
      {
        name: id,
        primitives: [
          {
            attributes: { POSITION: 1, COLOR_0: 2 },
            indices: 0,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: [
      {
        name: id,
        pbrMetallicRoughness: {},
        extensions: { KHR_materials_unlit: {} },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5123,
        count: idx.length / 2,
        type: 'SCALAR',
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5126,
        count: ecken.length,
        type: 'VEC3',
        min,
        max,
      },
      {
        bufferView: 1,
        byteOffset: 12,
        componentType: 5123,
        normalized: true,
        count: ecken.length,
        type: 'VEC3',
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: idx.length, target: 34963 },
      {
        buffer: 0,
        byteOffset: idx.length,
        byteLength: vtx.length,
        byteStride: SCHRITT,
        target: 34962,
      },
    ],
    buffers: [{ byteLength: idx.length + vtx.length }],
  }
  return schreibeGlb(json, Buffer.concat([idx, vtx]))
}

/** GLB-Container aus JSON und BIN (JSON mit Leerzeichen auf 4 Bytes aufgefüllt). */
function schreibeGlb(json, bin) {
  const text = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonLen = Math.ceil(text.length / 4) * 4
  const out = Buffer.alloc(12 + 8 + jsonLen + 8 + bin.length)
  out.writeUInt32LE(0x46546c67, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(out.length, 8)
  out.writeUInt32LE(jsonLen, 12)
  out.writeUInt32LE(0x4e4f534a, 16)
  out.fill(0x20, 20, 20 + jsonLen)
  text.copy(out, 20)
  out.writeUInt32LE(bin.length, 20 + jsonLen)
  out.writeUInt32LE(0x004e4942, 24 + jsonLen)
  bin.copy(out, 28 + jsonLen)
  return out
}

/** Das Paket aller Formen und sein Abschnitt für den Index. */
function bauePaket() {
  const paket = packeRegale(
    FORMEN.map((form) => leseRegal(new Uint8Array(baueRegal(form)), form.id))
  )
  return {
    glb: Buffer.from(paket.glb),
    regal: {
      datei: REGAL_DATEI,
      bytes: paket.glb.byteLength,
      modelle: paket.modelle,
    },
  }
}

/** Der Fixture-Index mit dem Abschnitt `regal` (die Nahansicht bleibt, wie sie ist). */
function indexMitRegal(index, regal) {
  // Zahlenlisten in einer Zeile - so formatiert es auch prettier.
  return `${JSON.stringify({ ...index, regal }, null, 2).replace(
    /\[\s+(-?[\d.e-]+(?:,\s+-?[\d.e-]+)*)\s+\]/g,
    (_, zahlen) => `[${zahlen.replace(/\s+/g, ' ')}]`
  )}\n`
}

module.exports = { FORMEN, baueRegal, bauePaket, indexMitRegal }
