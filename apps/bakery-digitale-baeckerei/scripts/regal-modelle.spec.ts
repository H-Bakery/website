import { FORMEN, baueRegal } from '../src/test/fixtures/regal-fixture'
import { leseGlb, schreibeGlb } from './glb-bereinigen'
import {
  MAX_BYTES,
  MAX_DREIECKE,
  PAKET_DATEI,
  leseRegal,
  lesePaket,
  packeRegale,
} from './regal-modelle'

/** Ein Stück glTF-JSON, wie die Tests es verbiegen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gltf = any

// Synthetische Regal-Modelle (erfundene Formen) - die echten liegen nie im Repo.
const [BREZEL, WECK, BROT] = FORMEN
const glb = (form = BROT) => new Uint8Array(baueRegal(form))

/** Dasselbe Modell mit verändertem JSON-Teil. */
function veraendert(aendere: (json: Gltf) => void, form = BROT): Uint8Array {
  const { json, bin } = leseGlb(glb(form))
  aendere(json)
  return schreibeGlb(json, bin)
}

describe('leseRegal: der Vertrag des Daten-Repos', () => {
  it('liest ein Regal-Modell: Dreiecke, Rahmen in Metern, Geometrie', () => {
    const regal = leseRegal(glb(), 'testbrot-500g')
    expect(regal.id).toBe('testbrot-500g')
    expect(regal.dreiecke).toBe(14)
    expect(regal.bbox_m).toEqual({
      min: [-0.1, 0, -0.05],
      max: [0.1, 0.0765, 0.05],
    })
    expect(regal.anzahlIndizes).toBe(42)
    expect(regal.anzahlEcken).toBe(12)
    expect(regal.schritt).toBe(20)
    expect(regal.indizes).toHaveLength(84)
    expect(regal.ecken).toHaveLength(240)
  })

  it.each([
    [
      'eine Kompression',
      (j: Gltf) => (j.extensionsUsed = ['EXT_meshopt_compression']),
      /EXT_meshopt_compression ist nicht erlaubt/,
    ],
    ['eine Textur', (j: Gltf) => (j.textures = [{}]), /Texturen/],
    [
      'zwei Primitive',
      (j: Gltf) => j.meshes[0].primitives.push(j.meshes[0].primitives[0]),
      /genau ein Mesh mit einem Primitiv/,
    ],
    [
      'ein verschobener Knoten',
      (j: Gltf) => (j.nodes[0].translation = [1, 0, 0]),
      /Transformation/,
    ],
    ['extras', (j: Gltf) => (j.nodes[0].extras = { preis: 1 }), /extras/],
    [
      'ein beleuchtetes Material',
      (j: Gltf) => delete j.materials[0].extensions,
      /nicht KHR_materials_unlit/,
    ],
    [
      'Normalen dabei',
      (j: Gltf) => (j.meshes[0].primitives[0].attributes.NORMAL = 1),
      /POSITION und COLOR_0, sonst nichts/,
    ],
    [
      'quantisierte Positionen',
      (j: Gltf) => (j.accessors[1].componentType = 5122),
      /POSITION muss VEC3 Float/,
    ],
    [
      'Farben nicht normalisiert',
      (j: Gltf) => delete j.accessors[2].normalized,
      /COLOR_0/,
    ],
    [
      'Indizes mit 32 Bit',
      (j: Gltf) => (j.accessors[0].componentType = 5125),
      /Indizes müssen 16 Bit/,
    ],
    [
      'zu viele Dreiecke',
      (j: Gltf) => (j.accessors[0].count = (MAX_DREIECKE + 1) * 3),
      /Dreiecke/,
    ],
    [
      'eine View über die Daten hinaus',
      (j: Gltf) => (j.bufferViews[1].byteLength = 99999),
      /reicht über die Daten hinaus/,
    ],
  ])('lehnt ab: %s', (_name, aendere, meldung) => {
    expect(() => leseRegal(veraendert(aendere), 'testbrot-500g')).toThrow(
      meldung
    )
  })

  it('lehnt einen Index ab, der auf keinen Eckpunkt zeigt', () => {
    const { json, bin } = leseGlb(glb())
    const kopie = Buffer.from(bin as Buffer)
    kopie.writeUInt16LE(500, 0)
    expect(() => leseRegal(schreibeGlb(json, kopie), 'testbrot-500g')).toThrow(
      /zeigt auf keinen Eckpunkt/
    )
  })

  it('lehnt eine zu große Datei und eine ungültige ID ab', () => {
    expect(() =>
      leseRegal(new Uint8Array(MAX_BYTES + 1), 'testbrot-500g')
    ).toThrow(/höchstens/)
    expect(() => leseRegal(glb(), '../boese')).toThrow(/ungültig/)
  })

  it('die Meldung nennt die Produkt-ID', () => {
    expect(() =>
      leseRegal(
        veraendert((j) => (j.textures = [{}])),
        'testbrot-500g'
      )
    ).toThrow('regal.glb (testbrot-500g)')
  })
})

describe('packeRegale: viele Modelle, eine Datei', () => {
  const regale = [BROT, BREZEL, WECK].map((f) => leseRegal(glb(f), f.id))
  const paket = packeRegale(regale)

  it('ein GLB mit je einem Mesh je Produkt, nach ID sortiert, ein Material für alle', () => {
    const { json } = leseGlb(paket.glb)
    expect(json.nodes.map((n: Gltf) => n.name)).toEqual([
      'musterbrezel',
      'musterweck',
      'testbrot-500g',
    ])
    expect(json.meshes.map((m: Gltf) => m.name)).toEqual(
      json.nodes.map((n: Gltf) => n.name)
    )
    expect(json.materials).toHaveLength(1)
    expect(json.materials[0].extensions).toEqual({ KHR_materials_unlit: {} })
    expect(json.meshes.every((m: Gltf) => m.primitives[0].material === 0)).toBe(
      true
    )
    expect(json.extensionsUsed).toEqual(['KHR_materials_unlit'])
  })

  it('der Index nennt je Produkt Rahmen und Dreiecke - sonst nichts', () => {
    expect(paket.modelle['testbrot-500g']).toEqual({
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.0765, 0.05] },
      dreiecke: 14,
    })
    expect(Object.keys(paket.modelle)).toEqual([
      'musterbrezel',
      'musterweck',
      'testbrot-500g',
    ])
  })

  it('die Geometrie bleibt Byte für Byte, alles auf 4 Bytes ausgerichtet', () => {
    const { json, bin } = leseGlb(paket.glb)
    json.meshes.forEach((mesh: Gltf, i: number) => {
      const prim = mesh.primitives[0]
      const regal = regale.find((r) => r.id === mesh.name)
      const idx = json.bufferViews[json.accessors[prim.indices].bufferView]
      const vtx =
        json.bufferViews[json.accessors[prim.attributes.POSITION].bufferView]
      expect(idx.byteOffset % 4).toBe(0)
      expect(vtx.byteOffset % 4).toBe(0)
      expect(vtx.byteStride).toBe(20)
      const b = bin as Buffer
      expect(
        b
          .subarray(idx.byteOffset, idx.byteOffset + idx.byteLength)
          .equals(regal?.indizes as Buffer)
      ).toBe(true)
      expect(
        b
          .subarray(vtx.byteOffset, vtx.byteOffset + vtx.byteLength)
          .equals(regal?.ecken as Buffer)
      ).toBe(true)
      expect(json.nodes[i].mesh).toBe(i)
    })
  })

  it('gleiche Eingabe, gleiche Bytes - unabhängig von der Reihenfolge', () => {
    const anders = packeRegale([...regale].reverse())
    expect(Buffer.from(anders.glb).equals(Buffer.from(paket.glb))).toBe(true)
  })

  it('lesePaket nennt die Produkte wieder', () => {
    expect(lesePaket(paket.glb)).toEqual({
      musterbrezel: { dreiecke: 14 },
      musterweck: { dreiecke: 14 },
      'testbrot-500g': { dreiecke: 14 },
    })
  })

  it('lesePaket lehnt Fremdes ab', () => {
    const { json, bin } = leseGlb(paket.glb)
    json.nodes[0].name = 'Mit Leerzeichen'
    expect(() => lesePaket(schreibeGlb(json, bin))).toThrow(/kein Regal-Modell/)
    const mitExtras = leseGlb(paket.glb)
    mitExtras.json.nodes[0].extras = { preis: 2 }
    expect(() => lesePaket(schreibeGlb(mitExtras.json, mitExtras.bin))).toThrow(
      /extras/
    )
  })

  it('ein Produkt steht nur einmal im Paket', () => {
    expect(() => packeRegale([regale[0], regale[0]])).toThrow(/doppelt/)
  })

  it('der Dateiname kann keine Produkt-ID sein', () => {
    expect(PAKET_DATEI).toBe('_regal.glb')
  })
})
