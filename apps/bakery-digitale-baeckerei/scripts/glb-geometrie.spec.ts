import { ausgeliefertesModell } from '../src/test/fixtures/fixture-info'
import { morgensPlatz } from './belegung'
import { schreibeGlb } from './glb-bereinigen'
import { brauchtDecoder, knotenGeometrie } from './glb-geometrie'
import { leitePlaetzeAb, wareVon } from './plaetze'

// Winzige, von Hand gebaute GLB-Puffer mit erfundenen Knoten.

/** Ein Dreieck als Float-Positionen. */
const DREIECK = [0, 0, 0, 1, 0, 0, 0, 2, 0]

function modell(
  nodes: unknown[],
  o: { quantisiert?: boolean; normalisiert?: boolean; meshopt?: boolean } = {}
): Uint8Array {
  let bin: Buffer
  let componentType = 5126
  if (o.quantisiert) {
    componentType = 5122
    bin = Buffer.alloc(18)
    // normalisiert: 32767 = 1; sonst die Zahl selbst
    const f = o.normalisiert ? 16383.5 : 1
    DREIECK.forEach((v, i) => bin.writeInt16LE(Math.round(v * f), i * 2))
  } else {
    bin = Buffer.alloc(36)
    DREIECK.forEach((v, i) => bin.writeFloatLE(v, i * 4))
  }
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0 }, material: 0 },
          { attributes: { POSITION: 0 }, material: 1 },
        ],
      },
    ],
    materials: [{ name: 'kruste' }, { name: 'lack-schwarz' }],
    accessors: [
      {
        bufferView: 0,
        componentType,
        count: 3,
        type: 'VEC3',
        ...(o.normalisiert ? { normalized: true } : {}),
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: bin.length,
        ...(o.meshopt
          ? {
              extensions: {
                EXT_meshopt_compression: {
                  buffer: 0,
                  byteOffset: 0,
                  byteLength: bin.length,
                  byteStride: 12,
                  count: 3,
                  mode: 'ATTRIBUTES',
                },
              },
            }
          : {}),
      },
    ],
    buffers: [{ byteLength: bin.length }],
  }
  return schreibeGlb(json, bin)
}

const alle = () => true
const punkte = (teil: { punkte: Float64Array }) =>
  [...teil.punkte].map((v) => Math.round(v * 1000) / 1000)

describe('knotenGeometrie', () => {
  it('liefert je Primitiv Material und Eckpunkte im Rahmen der Szene', () => {
    const [k] = knotenGeometrie(
      modell([
        {
          name: 'produkt/regal/platz-01',
          mesh: 0,
          translation: [10, 20, 30],
          scale: [2, 2, 2],
          extras: { id: 'regal/platz-01', product: 'testbrot' },
        },
      ]),
      alle
    )
    expect(k.name).toBe('produkt/regal/platz-01')
    expect(k.extras).toEqual({ id: 'regal/platz-01', product: 'testbrot' })
    expect(k.teile.map((t) => t.material)).toEqual(['kruste', 'lack-schwarz'])
    expect(punkte(k.teile[0])).toEqual([10, 20, 30, 12, 20, 30, 10, 24, 30])
  })

  it('liest quantisierte Positionen - als Zahl und normalisiert', () => {
    const knoten = { name: 'a', mesh: 0, scale: [0.5, 0.5, 0.5] }
    const [roh] = knotenGeometrie(modell([knoten], { quantisiert: true }), alle)
    expect(punkte(roh.teile[0])).toEqual([0, 0, 0, 0.5, 0, 0, 0, 1, 0])
    const [norm] = knotenGeometrie(
      modell([knoten], { quantisiert: true, normalisiert: true }),
      alle
    )
    // 16384 / 32767 ≈ 0,5; mal Maßstab 0,5
    expect(punkte(norm.teile[0])).toEqual([0, 0, 0, 0.25, 0, 0, 0, 0.5, 0])
  })

  it('dreht mit der Rotation des Knotens (vor dem Verschieben, nach dem Maßstab)', () => {
    // 90° um y: x → −z
    const s = Math.SQRT1_2
    const [k] = knotenGeometrie(
      modell([
        { name: 'a', mesh: 0, rotation: [0, s, 0, s], translation: [1, 0, 0] },
      ]),
      alle
    )
    expect(punkte(k.teile[0])).toEqual([1, 0, 0, 1, 0, -1, 1, 2, 0])
  })

  it('nimmt nur gewählte Knoten und lässt aus, was es nicht lesen kann', () => {
    const glb = modell([
      { name: 'produkt/a', mesh: 0, extras: { fills: ['morgens'] } },
      { name: 'moebel', mesh: 0 },
      { name: 'ohne-mesh' },
      { name: 'produkt/mit-matrix', mesh: 0, matrix: [1] },
      { name: 'produkt/mit-kindern', mesh: 0, children: [0] },
    ])
    const gewaehlt = knotenGeometrie(glb, (name) => name.startsWith('produkt/'))
    expect(gewaehlt.map((k) => k.name)).toEqual(['produkt/a'])
  })

  it('ein meshopt-komprimiertes Modell braucht den Decoder - und bekommt seine Parameter', () => {
    const glb = modell([{ name: 'a', mesh: 0 }], { meshopt: true })
    expect(() => knotenGeometrie(glb, alle)).toThrow(/keinen Decoder/)
    const decoder = {
      decodeGltfBuffer: jest.fn(
        (ziel: Uint8Array, _n: number, _s: number, quelle: Uint8Array) =>
          ziel.set(quelle)
      ),
    }
    const [k] = knotenGeometrie(glb, alle, decoder)
    expect(decoder.decodeGltfBuffer).toHaveBeenCalledTimes(1)
    expect(decoder.decodeGltfBuffer.mock.calls[0].slice(1, 3)).toEqual([3, 12])
    const aufruf: unknown[] = decoder.decodeGltfBuffer.mock.calls[0]
    expect(aufruf[4]).toBe('ATTRIBUTES')
    expect(punkte(k.teile[0])).toEqual(DREIECK)
  })
})

describe('brauchtDecoder', () => {
  it('nur mit EXT_meshopt_compression an einer BufferView', () => {
    expect(brauchtDecoder({ bufferViews: [{ buffer: 0 }] })).toBe(false)
    expect(
      brauchtDecoder({
        bufferViews: [{ extensions: { EXT_meshopt_compression: {} } }],
      })
    ).toBe(true)
    expect(brauchtDecoder({})).toBe(false)
  })
})

describe('am synthetischen Laden: von der Datei bis zu den Plätzen', () => {
  const glb = new Uint8Array(ausgeliefertesModell('laden'))
  const knoten = knotenGeometrie(
    glb,
    (name, extras) => morgensPlatz(name, extras) !== null
  )
  const plaetze = leitePlaetzeAb(
    knoten.map((k) =>
      wareVon(morgensPlatz(k.name, k.extras) as string, k.teile)
    )
  )

  it('das Fixture braucht keinen Decoder', () => {
    expect(brauchtDecoder({ bufferViews: [] })).toBe(false)
    expect(knoten.length).toBeGreaterThan(30)
  })

  it('jeder Platz, den der Laden morgens zeigt, bekommt einen Rahmen - auch neutrale Ware, nie die Feierabend-Variante', () => {
    expect(Object.keys(plaetze)).toHaveLength(knoten.length)
    expect(plaetze).toHaveProperty(['dosenregal/platz-01'])
    expect(plaetze).toHaveProperty(['brotregal/ebene-1/platz-01'])
    expect(knoten.some((k) => k.name.endsWith('@feierabend'))).toBe(false)
  })

  it('Arten: Haken am Brezelständer, Körbe gehäuft, sonst Reihen', () => {
    expect(plaetze['theke/brezelstaender/platz-01'].art).toBe('haken')
    expect(plaetze['brotregal/koerbe/korb-1/platz-01'].art).toBe('korb')
    expect(plaetze['theke/vitrine/ebene-1/platz-01'].art).toBe('reihen')
  })

  it('die Plätze eines Bodens liegen nebeneinander und überlappen nicht', () => {
    const boden = [1, 2, 3, 4].map(
      (n) => plaetze[`brotregal/ebene-1/platz-0${n}`]
    )
    const laengs = boden.map(
      (p) => p.o[0] * boden[0].r[0] + p.o[2] * boden[0].r[2]
    )
    const sortiert = boden
      .map((p, i) => ({ mitte: laengs[i], halb: p.b / 2 }))
      .sort((a, b) => a.mitte - b.mitte)
    for (let i = 1; i < sortiert.length; i += 1) {
      expect(sortiert[i].mitte - sortiert[i].halb).toBeGreaterThanOrEqual(
        sortiert[i - 1].mitte + sortiert[i - 1].halb - 1e-6
      )
    }
    // Maße in einer Größenordnung, in der Ware liegt
    for (const p of Object.values(plaetze)) {
      expect(p.b).toBeGreaterThan(0.01)
      expect(p.b).toBeLessThan(2)
      expect(p.t).toBeGreaterThan(0.01)
      expect(p.h).toBeGreaterThan(0.01)
    }
  })
})
