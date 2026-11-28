import {
  alleSlots,
  belegungAusGlb,
  belegungAusGltf,
  fasseZusammen,
  morgensPlatz,
  parseGlbJson,
} from './belegung'
import type { Platz } from './plaetze'

// Winzige, von Hand gebaute GLB-Puffer mit erfundenen Produkten - das echte
// Modell liegt nie im Repo.
const u32 = (n: number) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n, 0)
  return b
}

function glb(
  json: unknown,
  opts: {
    magic?: number
    version?: number
    chunkType?: number
    bin?: Buffer
  } = {}
): Uint8Array {
  let text = Buffer.from(
    typeof json === 'string' ? json : JSON.stringify(json),
    'utf8'
  )
  // Chunks sind auf 4 Bytes ausgerichtet, JSON wird mit Leerzeichen gefüllt.
  if (text.length % 4) {
    text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)])
  }
  const parts: Uint8Array[] = [
    u32(text.length),
    u32(opts.chunkType ?? 0x4e4f534a),
    text,
  ]
  if (opts.bin) parts.push(u32(opts.bin.length), u32(0x004e4942), opts.bin)
  const body = Buffer.concat(parts)
  return new Uint8Array(
    Buffer.concat([
      u32(opts.magic ?? 0x46546c67),
      u32(opts.version ?? 2),
      u32(12 + body.length),
      body,
    ])
  )
}

const COMMIT = '0123456789abcdef0123456789abcdef01234567'

const MODELL = {
  asset: { version: '2.0' },
  nodes: [
    { name: 'testregal', extras: { id: 'testregal', source: 'erfunden' } },
    {
      name: 'produkt/testregal/ebene-1/platz-01',
      extras: {
        id: 'testregal/ebene-1/platz-01',
        product: 'testbrot-500g',
        count: 4,
        fills: ['morgens'],
      },
    },
    {
      name: 'produkt/testregal/ebene-1/platz-02',
      extras: {
        id: 'testregal/ebene-1/platz-02',
        product: 'testbrötchen',
        fills: ['morgens', 'feierabend'],
      },
    },
    {
      // Variante für einen anderen Zustand: nicht in der Belegung.
      name: 'produkt/testregal/ebene-1/platz-01@feierabend',
      extras: {
        id: 'testregal/ebene-1/platz-01',
        product: 'testkeks',
        count: 1,
        fills: ['feierabend'],
      },
    },
    {
      // Neutrale Ware ohne eigenes Produkt.
      name: 'produkt/testregal/ebene-2/platz-01',
      extras: {
        id: 'testregal/ebene-2/platz-01',
        ware: 'glas',
        fills: ['morgens'],
      },
    },
    { name: 'ohne-extras' },
  ],
}

describe('parseGlbJson', () => {
  it('liest den JSON-Teil, auch mit Füllbytes und binärem Teil dahinter', () => {
    const json = parseGlbJson(glb(MODELL, { bin: Buffer.from([1, 2, 3, 4]) }))
    expect(json).toEqual(MODELL)
  })

  it('arbeitet auf einem Ausschnitt eines größeren Puffers', () => {
    const data = glb({ nodes: [] })
    const gross = new Uint8Array(data.byteLength + 8)
    gross.set(data, 8)
    expect(parseGlbJson(gross.subarray(8))).toEqual({ nodes: [] })
  })

  it.each([
    ['zu kurz', new Uint8Array(8), 'zu kurz'],
    ['falsche Kennung', glb({}, { magic: 0x12345678 }), 'Kennung'],
    ['falsche Version', glb({}, { version: 1 }), 'Version 1'],
    ['erster Teil kein JSON', glb({}, { chunkType: 0x004e4942 }), 'kein JSON'],
    ['kaputtes JSON', glb('{"nodes": [   '), 'nicht lesen'],
    ['JSON ist kein Objekt', glb('[1, 2]'), 'kein Objekt'],
  ])('wirft: %s', (_name, data, message) => {
    expect(() => parseGlbJson(data)).toThrow(message)
  })

  it('wirft bei einer abgeschnittenen Datei', () => {
    const data = glb(MODELL)
    expect(() => parseGlbJson(data.subarray(0, data.byteLength - 8))).toThrow(
      'Länge im Kopf passt nicht zur Datei'
    )
  })

  it('wirft, wenn der JSON-Teil länger sein soll als die Datei', () => {
    const data = Buffer.from(glb(MODELL))
    data.writeUInt32LE(data.length, 12)
    expect(() => parseGlbJson(data)).toThrow('länger als die Datei')
  })
})

describe('belegungAusGltf', () => {
  it('nimmt nur Knoten mit product, die morgens zu sehen sind', () => {
    expect(belegungAusGltf(MODELL, COMMIT)).toEqual({
      belegung: {
        version: 1,
        quelle: { commit: COMMIT },
        slots: [
          {
            slot: 'testregal/ebene-1/platz-01',
            produkt: 'testbrot-500g',
            anzahl: 4,
          },
          { slot: 'testregal/ebene-1/platz-02', produkt: 'testbrötchen' },
        ],
      },
      doppelt: [],
    })
  })

  it('lässt Knoten ohne fills-Liste aus und erfindet keine Anzahl', () => {
    const { belegung } = belegungAusGltf(
      {
        nodes: [
          { name: 'produkt/a', extras: { product: 'testbrot-500g' } },
          {
            name: 'produkt/b',
            extras: { product: 'testbrot-500g', fills: 'morgens' },
          },
          {
            name: 'produkt/c',
            extras: { product: 'testbrot-500g', fills: ['morgens'], count: 0 },
          },
          {
            name: 'produkt/d',
            extras: {
              product: 'testbrot-500g',
              fills: ['morgens'],
              count: '3',
            },
          },
          { name: 'produkt/e', extras: { product: '', fills: ['morgens'] } },
        ],
      },
      COMMIT
    )
    expect(belegung.slots).toEqual([
      { slot: 'c', produkt: 'testbrot-500g' },
      { slot: 'd', produkt: 'testbrot-500g' },
    ])
  })

  it('nimmt den Platz aus dem Namen (ohne @variante), sonst aus extras.id', () => {
    const { belegung } = belegungAusGltf(
      {
        nodes: [
          {
            name: 'produkt/testregal/platz-01@morgens',
            extras: { product: 'testbrot-500g', fills: ['morgens'] },
          },
          {
            name: 'irgendwie-anders',
            extras: {
              id: 'testregal/platz-02',
              product: 'testkeks',
              fills: ['morgens'],
            },
          },
          {
            name: 'ohne-platz',
            extras: { product: 'testkeks', fills: ['morgens'] },
          },
        ],
      },
      COMMIT
    )
    expect(belegung.slots).toEqual([
      { slot: 'testregal/platz-01', produkt: 'testbrot-500g' },
      { slot: 'testregal/platz-02', produkt: 'testkeks' },
    ])
  })

  it('meldet doppelt belegte Plätze, der erste Knoten gewinnt', () => {
    const node = (product: string) => ({
      name: 'produkt/testregal/platz-01',
      extras: { product, fills: ['morgens'] },
    })
    const { belegung, doppelt } = belegungAusGltf(
      { nodes: [node('testbrot-500g'), node('testkeks'), node('testkeks')] },
      COMMIT
    )
    expect(belegung.slots).toEqual([
      { slot: 'testregal/platz-01', produkt: 'testbrot-500g' },
    ])
    expect(doppelt).toEqual(['testregal/platz-01'])
  })

  it('ein Modell ohne Knoten ergibt eine leere Belegung', () => {
    expect(belegungAusGltf({}, COMMIT).belegung.slots).toEqual([])
  })
})

describe('belegungAusGlb', () => {
  it('liest die Belegung direkt aus dem GLB', () => {
    const { belegung } = belegungAusGlb(glb(MODELL), 'fixture')
    expect(belegung.quelle).toEqual({ commit: 'fixture' })
    expect(belegung.slots.map((s) => s.slot)).toEqual([
      'testregal/ebene-1/platz-01',
      'testregal/ebene-1/platz-02',
    ])
  })
})

describe('belegung.json: alle Räume in einer Datei', () => {
  const laden = belegungAusGlb(glb(MODELL), 'abc').belegung
  const leer = belegungAusGltf({}, 'def').belegung

  it('fasst die Räume zusammen, Schlüssel = id des Raums; ein Raum ohne Produkte steht leer darin', () => {
    expect(fasseZusammen({ laden, werkstatt: leer })).toEqual({
      version: 3,
      raeume: {
        laden: {
          quelle: { commit: 'abc' },
          slots: laden.slots,
          leer: [],
          plaetze: {},
        },
        werkstatt: {
          quelle: { commit: 'def' },
          slots: [],
          leer: [],
          plaetze: {},
        },
      },
    })
  })

  it('Version 3: leere Plätze und die Rahmen der Plätze stehen je Raum dabei', () => {
    const platz: Platz = {
      o: [1, 2, 3],
      r: [1, 0, 0],
      n: [0, 1, 0],
      f: [0, 0, 1],
      b: 0.2,
      t: 0.3,
      h: 0.1,
      art: 'reihen',
      neigung: 0,
    }
    const datei = fasseZusammen({
      laden: { ...laden, leer: ['a/b'], plaetze: { 'a/b': platz } },
    })
    expect(datei.raeume.laden.leer).toEqual(['a/b'])
    expect(datei.raeume.laden.plaetze).toEqual({ 'a/b': platz })
  })

  it('morgensPlatz: der Platz eines Knotens, auch mit neutraler Ware - nur im Zustand „Morgens“', () => {
    expect(
      morgensPlatz('produkt/regal/platz-01', {
        product: 'x',
        fills: ['morgens'],
      })
    ).toBe('regal/platz-01')
    expect(
      morgensPlatz('produkt/regal/platz-02', {
        ware: 'dose',
        fills: ['morgens', 'feierabend'],
      })
    ).toBe('regal/platz-02')
    expect(
      morgensPlatz('produkt/regal/platz-01@feierabend', {
        product: 'x',
        fills: ['feierabend'],
      })
    ).toBeNull()
    expect(morgensPlatz('regal/korpus', { id: 'regal/korpus' })).toBeNull()
    expect(morgensPlatz('produkt/regal/platz-03', undefined)).toBeNull()
  })

  it('alleSlots: die Plätze aller Räume hintereinander', () => {
    const datei = fasseZusammen({ laden, werkstatt: leer, lager: laden })
    expect(alleSlots(datei).slots).toEqual([...laden.slots, ...laden.slots])
    expect(alleSlots(fasseZusammen({})).slots).toEqual([])
  })

  it.each([
    [
      'altes Format (ein Raum)',
      { version: 1, quelle: { commit: 'x' }, slots: [] },
    ],
    ['kein Objekt', null],
    [
      'Version 2 (ohne Einrichtung)',
      { version: 2, raeume: { laden: { quelle: { commit: 'x' }, slots: [] } } },
    ],
    ['raeume fehlt', { version: 3 }],
  ])('alleSlots lehnt ab: %s', (_name, datei) => {
    expect(() => alleSlots(datei)).toThrow(/erwartete Form/)
  })

  it('alleSlots lehnt einen Raum ohne slots ab', () => {
    expect(() =>
      alleSlots({ version: 3, raeume: { laden: { quelle: { commit: 'x' } } } })
    ).toThrow(/slots für Raum laden fehlt/)
  })
})
