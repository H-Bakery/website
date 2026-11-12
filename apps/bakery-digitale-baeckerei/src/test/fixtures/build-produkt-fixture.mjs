#!/usr/bin/env node
/**
 * Baut das synthetische Produkt-Modell `produkt.fixture.glb` für die
 * Nahansicht („In 3D ansehen“) in Unit- und Playwright-Tests: ein kantiger,
 * erfundener Laib für das Fixture-Produkt `testbrot-500g`. Die echten
 * Produkt-Modelle liegen im Daten-Repo `produkte-3d` (nur lokal) und gehören
 * nicht in dieses Repo.
 *
 * Wie die echten Modelle: Meter in echter Größe, Y nach oben, Ursprung in der
 * Mitte der Grundfläche, Unterkante auf y = 0, PBR-Material (nicht
 * metallisch, **beleuchtet** - nicht unlit), Vertex-Farben in COLOR_0.
 * Anders: ohne meshopt, ohne Quantisierung, ohne Textur - schlichte
 * Float-Accessoren, ohne Decoder lesbar.
 *
 * Die Form ist nicht drehsymmetrisch (ein Ende dunkler, drei Einschnitte
 * oben, eine Mehlseite), damit ein Test sieht, dass Drehen das Bild ändert.
 *
 * Deterministisch: nur feste Zahlen, Multiplikation und Wurzel (IEEE-genau),
 * keine Winkelfunktionen - gleiche Bytes auf jeder Plattform
 * (fixture.spec.ts prüft die eingecheckte Datei gegen diese Ausgabe). Nur
 * Node-Bordmittel.
 *
 * Aufruf:
 *   node src/test/fixtures/build-produkt-fixture.mjs            schreibt produkt.fixture.glb
 *   node src/test/fixtures/build-produkt-fixture.mjs --check    Exit 1, wenn die Datei abweicht
 *   node src/test/fixtures/build-produkt-fixture.mjs --out <f>  schreibt woandershin
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(HERE, 'produkt.fixture.glb')

/** Halbe Länge (x), halbe Breite (z), Höhe (y) in Metern. */
const HALB_LAENGE = 0.1
const HALB_BREITE = 0.05
const HOEHE = 0.075

/** Querschnitt (z, y) von links unten über den Rücken nach rechts unten. */
const PROFIL = [
  [-0.8, 0],
  [-1, 0.25],
  [-0.95, 0.6],
  [-0.6, 0.92],
  [0, 1],
  [0.6, 0.92],
  [0.95, 0.6],
  [1, 0.25],
  [0.8, 0],
]
/** Stationen entlang der Länge: [x, Maß des Querschnitts]. */
const STATIONEN = [
  [-1, 0.3],
  [-0.9, 0.62],
  [-0.65, 0.86],
  [-0.3, 0.97],
  [0, 1],
  [0.3, 0.97],
  [0.65, 0.86],
  [0.9, 0.62],
  [1, 0.3],
]

/** Vertex-Farben 0-255, linear gelesen (darum dunkel gewählt) - nur ein Testmodell. */
const KRUSTE = [120, 60, 18]
const KRUSTE_DUNKEL = [52, 24, 8]
const EINSCHNITT = [205, 155, 85]
const MEHL = [215, 198, 165]
const BODEN = [84, 46, 18]

const punkt = (s, p) => {
  const [x, mass] = STATIONEN[s]
  const [z, y] = PROFIL[p]
  return [x * HALB_LAENGE, y * mass * HOEHE, z * mass * HALB_BREITE]
}

/** @type {{ p: number[][], farbe: number[] }[]} */
const dreiecke = []
const dreieck = (a, b, c, farbe) => dreiecke.push({ p: [a, b, c], farbe })

const letztesProfil = PROFIL.length - 1
for (let s = 0; s < STATIONEN.length - 1; s += 1) {
  // Mantel: je Profilkante ein Viereck. Normale nach außen.
  for (let p = 0; p < letztesProfil; p += 1) {
    const a = punkt(s, p)
    const b = punkt(s, p + 1)
    const c = punkt(s + 1, p + 1)
    const d = punkt(s + 1, p)
    const oben = p === 3 || p === 4
    let farbe = KRUSTE
    // Ein Ende ist dunkler gebacken, die Seite z > 0 trägt Mehl, oben sitzen
    // drei helle Einschnitte.
    if (s === 0) farbe = KRUSTE_DUNKEL
    else if (oben && (s === 2 || s === 4 || s === 6)) farbe = EINSCHNITT
    else if (p === 5 && s >= 3) farbe = MEHL
    dreieck(a, b, c, farbe)
    dreieck(a, c, d, farbe)
  }
  // Boden: flach auf y = 0, Normale nach unten.
  const a = punkt(s, 0)
  const b = punkt(s, letztesProfil)
  const c = punkt(s + 1, letztesProfil)
  const d = punkt(s + 1, 0)
  dreieck(a, c, b, BODEN)
  dreieck(a, d, c, BODEN)
}
// Stirnseiten: Fächer um die Mitte des Querschnitts.
for (const [s, richtung] of [
  [0, -1],
  [STATIONEN.length - 1, 1],
]) {
  const [x, mass] = STATIONEN[s]
  const mitte = [x * HALB_LAENGE, 0.45 * mass * HOEHE, 0]
  const farbe = s === 0 ? KRUSTE_DUNKEL : KRUSTE
  for (let p = 0; p < PROFIL.length; p += 1) {
    const a = punkt(s, p)
    const b = punkt(s, (p + 1) % PROFIL.length)
    if (richtung < 0) dreieck(mitte, b, a, farbe)
    else dreieck(mitte, a, b, farbe)
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const kreuz = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const anzahl = dreiecke.length * 3
const positionen = Buffer.alloc(anzahl * 12)
const normalen = Buffer.alloc(anzahl * 12)
const farben = Buffer.alloc(anzahl * 4)
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
dreiecke.forEach(({ p, farbe }, t) => {
  const n = kreuz(sub(p[1], p[0]), sub(p[2], p[0]))
  const laenge = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2])
  if (!(laenge > 0)) throw new Error(`Dreieck ${t} ist entartet`)
  for (let e = 0; e < 3; e += 1) {
    const v = t * 3 + e
    for (let k = 0; k < 3; k += 1) {
      const wert = Math.fround(p[e][k])
      positionen.writeFloatLE(wert, v * 12 + k * 4)
      normalen.writeFloatLE(n[k] / laenge, v * 12 + k * 4)
      min[k] = Math.min(min[k], wert)
      max[k] = Math.max(max[k], wert)
      farben[v * 4 + k] = farbe[k]
    }
    farben[v * 4 + 3] = 255
  }
})
const bin = Buffer.concat([positionen, normalen, farben])

const gltf = {
  asset: {
    generator: 'bakery-digitale-baeckerei build-produkt-fixture',
    version: '2.0',
  },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [
    {
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
          mode: 4,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 0.75,
      },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: anzahl,
      type: 'VEC3',
      min,
      max,
    },
    { bufferView: 1, componentType: 5126, count: anzahl, type: 'VEC3' },
    {
      bufferView: 2,
      componentType: 5121,
      normalized: true,
      count: anzahl,
      type: 'VEC4',
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positionen.length, target: 34962 },
    {
      buffer: 0,
      byteOffset: positionen.length,
      byteLength: normalen.length,
      target: 34962,
    },
    {
      buffer: 0,
      byteOffset: positionen.length + normalen.length,
      byteLength: farben.length,
      target: 34962,
    },
  ],
  buffers: [{ byteLength: bin.length }],
}

/** GLB-Container: Kopf, JSON-Chunk (mit Leerzeichen aufgefüllt), BIN-Chunk. */
function glb(json, binary) {
  const pad = (buffer, fill) => {
    const rest = (4 - (buffer.length % 4)) % 4
    return rest ? Buffer.concat([buffer, Buffer.alloc(rest, fill)]) : buffer
  }
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const binChunk = pad(binary, 0)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0) // 'glTF'
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunkHead = (length, type) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(length, 0)
    head.writeUInt32LE(type, 4)
    return head
  }
  return Buffer.concat([
    header,
    chunkHead(jsonChunk.length, 0x4e4f534a), // 'JSON'
    jsonChunk,
    chunkHead(binChunk.length, 0x004e4942), // 'BIN\0'
    binChunk,
  ])
}

const bytes = glb(gltf, bin)
const args = process.argv.slice(2)

if (args.includes('--check')) {
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET) : null
  if (!current || !current.equals(bytes)) {
    console.error(
      'build-produkt-fixture: produkt.fixture.glb weicht vom Generator ab - neu bauen: node src/test/fixtures/build-produkt-fixture.mjs'
    )
    process.exit(1)
  }
  console.log(
    `build-produkt-fixture: produkt.fixture.glb ist aktuell (${bytes.length} Bytes)`
  )
} else {
  const at = args.indexOf('--out')
  const target = at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : TARGET
  fs.writeFileSync(target, bytes)
  console.log(
    `build-produkt-fixture: ${target} - ${bytes.length} Bytes, ${
      dreiecke.length
    } Dreiecke, Rahmen ${JSON.stringify({ min, max })}`
  )
}
