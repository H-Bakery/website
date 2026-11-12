import {
  EXTRAS_ENTFERNEN,
  bereinigeGlb,
  leseGlb,
  schnitte,
  schreibeGlb,
  zaehlePreisPrimitive,
} from './glb-bereinigen'
import { sha256Hex } from './model-lock'
import { ladeFixture } from '../src/test/fixtures/fixture-info'

// Von Hand gebaute Mini-GLBs mit erfundenem Inhalt - das echte Modell liegt
// nie im Repo. Die „Geometrie“ sind erkennbare Byte-Muster: So lässt sich
// prüfen, dass nach dem Schneiden jeder Accessor noch dieselben Bytes sieht.

/** `laenge` Bytes mit einem erkennbaren Muster je Block. */
const muster = (kennung: number, laenge: number) =>
  Buffer.from(Array.from({ length: laenge }, (_, i) => (kennung + i) & 0xff))

interface View {
  buffer: number
  byteOffset?: number
  byteLength: number
  extensions?: {
    EXT_meshopt_compression: {
      buffer: number
      byteOffset?: number
      byteLength: number
    }
  }
}

/** Die Bytes, die ein Accessor im BIN-Teil sieht (ohne meshopt). */
function bytesVon(glb: Uint8Array, accessorIndex: number, laenge: number) {
  const { json, bin } = leseGlb(glb)
  const accessor = json.accessors[accessorIndex]
  const view: View = json.bufferViews[accessor.bufferView]
  const von = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return Buffer.from((bin as Buffer).subarray(von, von + laenge))
}

/** Der BIN-Teil eines GLB. */
function binVon(glb: Uint8Array): Buffer {
  const { bin } = leseGlb(glb)
  if (!bin) throw new Error('GLB ohne BIN-Teil')
  return bin
}

/** Die komprimierten Bytes einer meshopt-BufferView. */
function komprimiert(glb: Uint8Array, viewIndex: number) {
  const { json, bin } = leseGlb(glb)
  const ext = json.bufferViews[viewIndex].extensions.EXT_meshopt_compression
  const von = ext.byteOffset ?? 0
  return Buffer.from((bin as Buffer).subarray(von, von + ext.byteLength))
}

const MATERIALIEN = [
  { name: 'kruste' },
  { name: 'preiskarte' },
  { name: 'preisschrift' },
  { name: 'mehl' },
]

/**
 * Ein Brot mit Preisschild, ein Brot ohne. BIN-Aufbau (ohne meshopt):
 *   View 0  [0, 12)    Indizes, geteilt von allen Primitiven
 *   View 1  [12, 36)   Position Brot 1 (kruste)
 *   View 2  [36, 60)   Position Preiskarte            ← fliegt raus
 *   View 3  [60, 90)   Position Preisschrift (30 B.)  ← fliegt raus
 *   View 4  [92, 116)  Position Brot 2 (mehl)
 *   View 5  [116, 140) Farben: Accessor 5 (Brot, Offset 0) und Accessor 6
 *                      (Preisschrift, Offset 12) teilen sich die View
 */
function einfachesModell() {
  const bin = Buffer.concat([
    muster(0x10, 12),
    muster(0x20, 24),
    muster(0x30, 24),
    muster(0x40, 30),
    Buffer.alloc(2),
    muster(0x50, 24),
    muster(0x60, 24),
  ])
  const json = {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_materials_unlit', 'KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      {
        name: 'produkt/testregal/ebene-1/platz-01',
        mesh: 0,
        extras: {
          id: 'testregal/ebene-1/platz-01',
          product: 'testbrot',
          count: 2,
          fills: ['morgens'],
          source: 'erfunden',
          sigma_m: 0.01,
          confidence: 'hoch',
        },
      },
      { name: 'testregal/korpus', mesh: 1, extras: { source: 'erfunden' } },
    ],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 1, COLOR_0: 5 }, indices: 0, material: 0 },
          { attributes: { POSITION: 2, COLOR_0: 5 }, indices: 0, material: 1 },
          { attributes: { POSITION: 3, COLOR_0: 6 }, indices: 0, material: 2 },
        ],
      },
      {
        primitives: [
          { attributes: { POSITION: 4, COLOR_0: 5 }, indices: 0, material: 3 },
        ],
      },
    ],
    materials: MATERIALIEN,
    accessors: [
      { bufferView: 0, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: 1, componentType: 5122, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5122, count: 4, type: 'VEC3' },
      { bufferView: 3, componentType: 5122, count: 5, type: 'VEC3' },
      { bufferView: 4, componentType: 5122, count: 4, type: 'VEC3' },
      { bufferView: 5, componentType: 5121, count: 4, type: 'VEC3' },
      {
        bufferView: 5,
        byteOffset: 12,
        componentType: 5121,
        count: 4,
        type: 'VEC3',
      },
    ],
    bufferViews: [
      { buffer: 0, byteLength: 12 },
      { buffer: 0, byteOffset: 12, byteLength: 24 },
      { buffer: 0, byteOffset: 36, byteLength: 24 },
      { buffer: 0, byteOffset: 60, byteLength: 30 },
      { buffer: 0, byteOffset: 92, byteLength: 24 },
      { buffer: 0, byteOffset: 116, byteLength: 24 },
    ],
    buffers: [{ byteLength: bin.length }],
  }
  return { json, bin, glb: schreibeGlb(json, bin) }
}

/**
 * Dasselbe mit `EXT_meshopt_compression`, wie das echte Modell: Jede View
 * zeigt in den Ersatzpuffer 1 (ohne Daten) und trägt den komprimierten
 * Bereich im Datenpuffer 0.
 *   View 0  komprimiert [0, 8)    Indizes (geteilt)
 *   View 1  komprimiert [8, 20)   Position Brot
 *   View 2  komprimiert [20, 31)  Position Preisschrift (11 B.) ← fliegt raus
 *   View 3  komprimiert [32, 44)  Farbe Preisschrift            ← fliegt raus
 *   View 4  komprimiert [44, 56)  Farbe Brot
 */
function meshoptModell() {
  const bin = Buffer.concat([
    muster(0x10, 8),
    muster(0x20, 12),
    muster(0x30, 11),
    Buffer.alloc(1),
    muster(0x40, 12),
    muster(0x50, 12),
  ])
  const view = (
    fallbackOffset: number,
    fallbackLength: number,
    byteOffset: number,
    byteLength: number
  ) => ({
    buffer: 1,
    byteOffset: fallbackOffset,
    byteLength: fallbackLength,
    extensions: {
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset,
        byteLength,
        mode: 'ATTRIBUTES',
        byteStride: 4,
        count: fallbackLength / 4,
      },
    },
  })
  const json = {
    asset: { version: '2.0' },
    extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
    extensionsRequired: ['EXT_meshopt_compression'],
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'produkt/testregal/platz-01', mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 1, COLOR_0: 4 }, indices: 0, material: 0 },
          { attributes: { POSITION: 2, COLOR_0: 3 }, indices: 0, material: 2 },
        ],
      },
    ],
    materials: MATERIALIEN,
    accessors: [0, 1, 2, 3, 4].map((bufferView) => ({
      bufferView,
      componentType: 5121,
      count: 4,
      type: 'VEC4',
    })),
    bufferViews: [
      view(0, 16, 0, 8),
      view(16, 40, 8, 12),
      view(56, 40, 20, 11),
      view(96, 40, 32, 12),
      view(136, 40, 44, 12),
    ],
    buffers: [
      { byteLength: bin.length },
      {
        byteLength: 176,
        extensions: { EXT_meshopt_compression: { fallback: true } },
      },
    ],
  }
  return { json, bin, glb: schreibeGlb(json, bin) }
}

describe('schnitte', () => {
  it('schneidet, was wegfällt, und lässt aus, was bleibt', () => {
    expect(
      schnitte(
        [
          [8, 24],
          [40, 48],
        ],
        [[16, 20]]
      )
    ).toEqual([
      [8, 16],
      [20, 24],
      [40, 48],
    ])
  })

  it('nimmt die Füllbytes bis zur 4er-Grenze mit und rundet sonst nach innen', () => {
    expect(schnitte([[5, 31]], [])).toEqual([[8, 32]])
    expect(schnitte([[5, 7]], [])).toEqual([])
    // Die Füllbytes gehören hier schon zu etwas, das bleibt.
    expect(schnitte([[8, 14]], [[14, 20]])).toEqual([[8, 12]])
  })

  it('fasst aneinanderliegende Bereiche zusammen', () => {
    expect(
      schnitte(
        [
          [12, 18],
          [18, 24],
          [16, 20],
        ],
        []
      )
    ).toEqual([[12, 24]])
  })

  it('schneidet nichts, wenn alles noch gebraucht wird', () => {
    expect(schnitte([[0, 16]], [[0, 32]])).toEqual([])
  })
})

describe('bereinigeGlb', () => {
  it('nimmt die Primitive der Preisschilder aus den Meshes', () => {
    const { glb } = einfachesModell()
    expect(zaehlePreisPrimitive(glb)).toEqual({ primitive: 2, materialien: 2 })

    const { glb: sauber, bericht } = bereinigeGlb(glb)

    expect(zaehlePreisPrimitive(sauber)).toEqual({
      primitive: 0,
      materialien: 0,
    })
    expect(bericht).toMatchObject({
      primitive: 2,
      accessors: 3,
      bufferViews: 2,
      materialien: 2,
    })
    const { json } = leseGlb(sauber)
    expect(json.meshes[0].primitives).toHaveLength(1)
    expect(json.meshes[1].primitives).toHaveLength(1)
    expect(json.materials.map((m: { name: string }) => m.name)).toEqual([
      'kruste',
      'mehl',
    ])
  })

  it('zählt Accessors, BufferViews und Materialien neu durch', () => {
    const { json } = leseGlb(bereinigeGlb(einfachesModell().glb).glb)
    expect(json.accessors).toHaveLength(4)
    expect(json.bufferViews).toHaveLength(4)
    expect(json.meshes[0].primitives[0]).toEqual({
      attributes: { POSITION: 1, COLOR_0: 3 },
      indices: 0,
      material: 0,
    })
    // Brot 2: Accessor 4 → 2, Material „mehl“ 3 → 1
    expect(json.meshes[1].primitives[0]).toEqual({
      attributes: { POSITION: 2, COLOR_0: 3 },
      indices: 0,
      material: 1,
    })
    expect(
      json.accessors.map((a: { bufferView: number }) => a.bufferView)
    ).toEqual([0, 1, 2, 3])
  })

  it('schneidet die Bytes der Preisschilder aus dem BIN-Teil - der Rest bleibt Byte für Byte', () => {
    const { glb, bin } = einfachesModell()
    const { glb: sauber, bericht } = bereinigeGlb(glb)
    const nachher = leseGlb(sauber)

    // 24 Bytes Preiskarte + 30 Bytes Preisschrift + 2 Füllbytes: [36, 92).
    expect(nachher.bin).toHaveLength(bin.length - 56)
    expect(nachher.json.buffers[0].byteLength).toBe(bin.length - 56)
    expect(bericht.bytesVorher - bericht.bytesNachher).toBeGreaterThanOrEqual(
      56
    )

    expect(bytesVon(sauber, 0, 12)).toEqual(muster(0x10, 12))
    expect(bytesVon(sauber, 1, 24)).toEqual(muster(0x20, 24))
    expect(bytesVon(sauber, 2, 24)).toEqual(muster(0x50, 24))
    expect(bytesVon(sauber, 3, 12)).toEqual(muster(0x60, 12))

    // Nichts von der Geometrie der Preisschilder ist noch in der Datei.
    const datei = Buffer.from(sauber)
    expect(datei.includes(muster(0x30, 24))).toBe(false)
    expect(datei.includes(muster(0x40, 4))).toBe(false)
  })

  it('lässt eine BufferView stehen, die sich ein Preisschild mit anderer Geometrie teilt', () => {
    const { glb } = einfachesModell()
    const { json } = leseGlb(bereinigeGlb(glb).glb)
    // View 5 (Farben) bleibt ganz, obwohl Accessor 6 (Preisschrift) wegfällt.
    expect(json.bufferViews[3]).toEqual({
      buffer: 0,
      byteOffset: 116 - 56,
      byteLength: 24,
    })
    // Die geteilten Indizes bleiben, wo sie waren.
    expect(json.bufferViews[0]).toEqual({ buffer: 0, byteLength: 12 })
  })

  it('verschiebt nur um Vielfache von 4 - die Ausrichtung bleibt', () => {
    const vorher = leseGlb(einfachesModell().glb).json
    const nachher = leseGlb(bereinigeGlb(einfachesModell().glb).glb).json
    const alt = [0, 1, 4, 5].map((i) => vorher.bufferViews[i].byteOffset ?? 0)
    const neu = nachher.bufferViews.map((v: View) => v.byteOffset ?? 0)
    neu.forEach((offset: number, i: number) => {
      expect((alt[i] - offset) % 4).toBe(0)
    })
  })

  it('schreibt einen gültigen Container: Längen, Füllbytes', () => {
    const { glb: sauber } = bereinigeGlb(einfachesModell().glb)
    const datei = Buffer.from(sauber)
    expect(datei.readUInt32LE(8)).toBe(datei.length)
    const jsonLaenge = datei.readUInt32LE(12)
    expect(jsonLaenge % 4).toBe(0)
    const binLaenge = datei.readUInt32LE(20 + jsonLaenge)
    expect(binLaenge % 4).toBe(0)
    expect(20 + jsonLaenge + 8 + binLaenge).toBe(datei.length)
    // leseGlb prüft dasselbe noch einmal streng
    expect(() => leseGlb(sauber)).not.toThrow()
  })

  it('meshopt: schneidet die komprimierten Bereiche und lässt den Ersatzpuffer nur als Zahl schrumpfen', () => {
    const { glb, bin } = meshoptModell()
    const { glb: sauber, bericht } = bereinigeGlb(glb)
    const { json, bin: neuesBin } = leseGlb(sauber)

    expect(bericht).toMatchObject({
      primitive: 1,
      accessors: 2,
      bufferViews: 2,
    })
    // Komprimiert [20, 44) fällt weg (11 + 1 Füllbyte + 12 = 24 Bytes).
    expect(neuesBin).toHaveLength(bin.length - 24)
    expect(json.buffers[0].byteLength).toBe(bin.length - 24)
    // Ersatzpuffer: [56, 136) fällt weg.
    expect(json.buffers[1]).toEqual({
      byteLength: 176 - 80,
      extensions: { EXT_meshopt_compression: { fallback: true } },
    })
    expect(json.bufferViews).toHaveLength(3)
    expect(json.bufferViews[2]).toMatchObject({
      buffer: 1,
      byteOffset: 136 - 80,
      byteLength: 40,
      extensions: {
        EXT_meshopt_compression: { buffer: 0, byteOffset: 20, byteLength: 12 },
      },
    })

    // Was bleibt, zeigt auf dieselben komprimierten Bytes wie vorher - keine
    // View zeigt mehr auf einen geschnittenen oder genullten Bereich.
    expect(komprimiert(sauber, 0)).toEqual(muster(0x10, 8))
    expect(komprimiert(sauber, 1)).toEqual(muster(0x20, 12))
    expect(komprimiert(sauber, 2)).toEqual(muster(0x50, 12))
    expect(Buffer.from(sauber).includes(muster(0x30, 11))).toBe(false)
    expect(Buffer.from(sauber).includes(muster(0x40, 12))).toBe(false)
  })

  it('ist deterministisch und ändert ein bereinigtes Modell nicht mehr', () => {
    for (const modell of [einfachesModell(), meshoptModell()]) {
      const a = bereinigeGlb(modell.glb).glb
      const b = bereinigeGlb(modell.glb).glb
      expect(sha256Hex(a)).toBe(sha256Hex(b))
      const nochmal = bereinigeGlb(a)
      expect(sha256Hex(nochmal.glb)).toBe(sha256Hex(a))
      expect(nochmal.bericht).toMatchObject({ primitive: 0, extras: 0 })
    }
  })

  it('verändert die Eingabe nicht', () => {
    const { glb } = einfachesModell()
    const vorher = sha256Hex(glb)
    bereinigeGlb(glb)
    expect(sha256Hex(glb)).toBe(vorher)
  })

  it('nimmt source, sigma_m und confidence aus den extras - der Rest bleibt', () => {
    const { glb: sauber, bericht } = bereinigeGlb(einfachesModell().glb)
    const { json } = leseGlb(sauber)
    expect(EXTRAS_ENTFERNEN).toEqual(['source', 'sigma_m', 'confidence'])
    expect(json.nodes[0].extras).toEqual({
      id: 'testregal/ebene-1/platz-01',
      product: 'testbrot',
      count: 2,
      fills: ['morgens'],
    })
    // Bleibt nichts übrig, verschwindet `extras` ganz.
    expect(json.nodes[1]).toEqual({ name: 'testregal/korpus', mesh: 1 })
    expect(bericht.extras).toBe(4)
  })

  it('ohne Preisschilder bleibt die Geometrie, wie sie ist', () => {
    const { json, bin } = einfachesModell()
    const ohne = {
      ...json,
      materials: [{ name: 'kruste' }, { name: 'mehl' }],
      meshes: [
        { primitives: [json.meshes[0].primitives[0]] },
        {
          primitives: [{ ...json.meshes[1].primitives[0], material: 1 }],
        },
      ],
    }
    const { glb: sauber, bericht } = bereinigeGlb(schreibeGlb(ohne, bin))
    expect(bericht).toMatchObject({
      primitive: 0,
      accessors: 0,
      bufferViews: 0,
      materialien: 0,
    })
    const nachher = leseGlb(sauber)
    expect(nachher.bin).toEqual(bin)
    expect(nachher.json.accessors).toEqual(json.accessors)
    expect(nachher.json.bufferViews).toEqual(json.bufferViews)
  })

  describe('bricht ab, statt halb zu bereinigen', () => {
    type Modell = ReturnType<typeof einfachesModell>['json']
    const mit = (aendern: (json: Modell) => void) => {
      const { json, bin } = einfachesModell()
      aendern(json)
      return schreibeGlb(json, bin)
    }

    it.each([
      [
        'ein Mesh nur aus Preisschildern',
        (json: Modell) => {
          json.meshes[1].primitives[0].material = 1
        },
        /nur aus Preisschildern/,
      ],
      [
        'eine fremde Extension',
        (json: Modell) => {
          json.extensionsUsed.push('KHR_draco_mesh_compression')
        },
        /Extension KHR_draco_mesh_compression/,
      ],
      [
        'Animationen',
        (json: Modell) => {
          Object.assign(json, { animations: [] })
        },
        /"animations"/,
      ],
      [
        'Texturen',
        (json: Modell) => {
          Object.assign(json, {
            images: [{ bufferView: 0, mimeType: 'image/png' }],
          })
        },
        /"images"/,
      ],
      [
        'Morph-Targets',
        (json: Modell) => {
          Object.assign(json.meshes[0].primitives[0], {
            targets: [{ POSITION: 2 }],
          })
        },
        /"targets"/,
      ],
      [
        'sparse Accessors',
        (json: Modell) => {
          Object.assign(json.accessors[1], { sparse: { count: 1 } })
        },
        /sparse/,
      ],
    ])('%s', (_name, aendern, meldung) => {
      expect(() => bereinigeGlb(mit(aendern))).toThrow(meldung)
    })

    it('ein kaputter Container', () => {
      const { glb } = einfachesModell()
      expect(() => bereinigeGlb(glb.slice(0, glb.length - 4))).toThrow(
        /Länge im Kopf/
      )
      expect(() => bereinigeGlb(new Uint8Array(8))).toThrow(/zu kurz/)
      const falsch = Buffer.from(glb)
      falsch.writeUInt32LE(0, 0)
      expect(() => bereinigeGlb(falsch)).toThrow(/Kennung/)
    })
  })
})

describe('das Fixture-Modell', () => {
  const { glb } = ladeFixture()

  it('trägt Preisschilder mit eigener Geometrie - und verliert sie beim Bereinigen', () => {
    expect(zaehlePreisPrimitive(glb)).toEqual({ primitive: 8, materialien: 2 })
    const { glb: sauber, bericht } = bereinigeGlb(glb)
    expect(zaehlePreisPrimitive(sauber)).toEqual({
      primitive: 0,
      materialien: 0,
    })
    expect(bericht.primitive).toBe(8)
    // Die eigene BufferView der Preisschilder ist weg, ihre Bytes auch.
    expect(bericht.bufferViews).toBe(1)
    expect(binVon(sauber).length).toBeLessThan(binVon(glb).length)
  })

  it('behält jedes andere Primitiv mit denselben Positionen', () => {
    const vorher = leseGlb(glb)
    const { glb: sauber } = bereinigeGlb(glb)
    const nachher = leseGlb(sauber)
    const preis = new Set<number>(
      vorher.json.materials
        .map((m: { name: string }, i: number) =>
          /^preis/.test(m.name) ? i : -1
        )
        .filter((i: number) => i >= 0)
    )
    interface Primitiv {
      material: number
      attributes: { POSITION: number }
    }
    const positionen = (datei: Uint8Array, ohne: Set<number>) => {
      const { json } = leseGlb(datei)
      const bin = binVon(datei)
      return json.meshes.flatMap((mesh: { primitives: Primitiv[] }) =>
        mesh.primitives
          .filter((p) => !ohne.has(p.material))
          .map((p) => {
            const accessor = json.accessors[p.attributes.POSITION]
            const view = json.bufferViews[accessor.bufferView]
            const von = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
            return bin
              .subarray(von, von + accessor.count * view.byteStride)
              .toString('hex')
          })
      )
    }
    const erwartet = positionen(glb, preis)
    expect(erwartet.length).toBeGreaterThan(50)
    expect(positionen(sauber, new Set())).toEqual(erwartet)
    expect(nachher.json.nodes.map((n: { name: string }) => n.name)).toEqual(
      vorher.json.nodes.map((n: { name: string }) => n.name)
    )
  })
})
