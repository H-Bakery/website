/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests machen einen gültigen Index gezielt kaputt */
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  bildVarianten,
  istCommit,
  istModellId,
  leererBilderIndex,
  parseBilderLock,
  pruefeBild,
  pruefeBilderIndex,
  readBilderIndex,
  webpInfo,
} from './index'

// Nur erfundene Produkte und von Hand gebaute Dateiköpfe - echte Bilder liegen
// im Daten-Repo produkte-3d.
const SHA = 'a'.repeat(64)
const COMMIT = '0123456789abcdef0123456789abcdef01234567'

const variante = (breite: number, ansicht = 'haupt') => ({
  file: `bilder/testbrot-500g/${ansicht}-${breite}.webp`,
  ansicht,
  breite,
  hoehe: breite,
})

const index = () => ({
  version: 1,
  bilder: {
    'testbrot-500g': {
      modellSha256: SHA,
      varianten: [variante(800), variante(400)],
    },
  },
})

/** Kopf einer WebP-Datei im erweiterten Format (VP8X), ohne Bilddaten. */
function vp8x(breite: number, hoehe: number, alpha: boolean) {
  const b = Buffer.alloc(30)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(22, 4)
  b.write('WEBP', 8, 'latin1')
  b.write('VP8X', 12, 'latin1')
  b.writeUInt32LE(10, 16)
  b[20] = alpha ? 0x10 : 0
  b.writeUIntLE(breite - 1, 24, 3)
  b.writeUIntLE(hoehe - 1, 27, 3)
  return new Uint8Array(b)
}

/** Kopf einer verlustfreien WebP-Datei (VP8L). */
function vp8l(breite: number, hoehe: number, alpha: boolean) {
  const b = Buffer.alloc(30)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(22, 4)
  b.write('WEBP', 8, 'latin1')
  b.write('VP8L', 12, 'latin1')
  b.writeUInt32LE(10, 16)
  b[20] = 0x2f
  b.writeUInt32LE(
    ((breite - 1) | ((hoehe - 1) << 14) | ((alpha ? 1 : 0) << 28)) >>> 0,
    21
  )
  return new Uint8Array(b)
}

/** Kopf einer verlustbehafteten WebP-Datei ohne Alpha (VP8). */
function vp8(breite: number, hoehe: number) {
  const b = Buffer.alloc(30)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(22, 4)
  b.write('WEBP', 8, 'latin1')
  b.write('VP8 ', 12, 'latin1')
  b.writeUInt32LE(10, 16)
  b[23] = 0x9d
  b[24] = 0x01
  b[25] = 0x2a
  b.writeUInt16LE(breite, 26)
  b.writeUInt16LE(hoehe, 28)
  return new Uint8Array(b)
}

describe('istModellId / istCommit', () => {
  it('nimmt hq-IDs ohne Nummer und nichts, was ein Pfad sein könnte', () => {
    expect(istModellId('testbrot-500g')).toBe(true)
    expect(istModellId('../testbrot')).toBe(false)
    expect(istModellId('Testbrot')).toBe(false)
    expect(istModellId('')).toBe(false)
    expect(istModellId(7)).toBe(false)
  })

  it('nimmt nur einen vollen Commit-Hash', () => {
    expect(istCommit(COMMIT)).toBe(true)
    expect(istCommit('main')).toBe(false)
    expect(istCommit(COMMIT.slice(0, 12))).toBe(false)
    expect(istCommit(null)).toBe(false)
  })
})

describe('parseBilderLock', () => {
  it('liest quelle und commit', () => {
    expect(parseBilderLock({ quelle: 'lokal', commit: COMMIT })).toEqual({
      quelle: 'lokal',
      commit: COMMIT,
    })
  })

  it('lässt commit: null zu - noch kein Stand übernommen', () => {
    expect(parseBilderLock({ quelle: 'lokal', commit: null }).commit).toBeNull()
  })

  it('wirft bei einem Branch-Namen, fehlendem commit oder fehlender quelle', () => {
    expect(() => parseBilderLock({ quelle: 'lokal', commit: 'main' })).toThrow(
      /Commit-Hash/
    )
    expect(() => parseBilderLock({ quelle: 'lokal' })).toThrow(/Commit-Hash/)
    expect(() => parseBilderLock({ commit: COMMIT })).toThrow(/quelle/)
    expect(() => parseBilderLock([])).toThrow(/kein Objekt/)
  })
})

describe('pruefeBilderIndex', () => {
  it('gibt einen gültigen Index mit genau den Feldern des Vertrags zurück', () => {
    const roh = index()
    Object.assign(roh.bilder['testbrot-500g'], { fremd: 'x' })
    expect(pruefeBilderIndex(roh)).toEqual(index())
  })

  it('nimmt den leeren Index', () => {
    expect(pruefeBilderIndex(leererBilderIndex())).toEqual({
      version: 1,
      bilder: {},
    })
  })

  it.each([
    ['falsche Version', (i: any) => (i.version = 2), /version 1/],
    ['bilder fehlt', (i: any) => delete i.bilder, /bilder fehlt/],
    [
      'ungültige ID',
      (i: any) => (i.bilder['../x'] = i.bilder['testbrot-500g']),
      /ID "\.\.\/x"/,
    ],
    [
      'modellSha256 fehlt',
      (i: any) => delete i.bilder['testbrot-500g'].modellSha256,
      /modellSha256/,
    ],
    [
      'keine Varianten',
      (i: any) => (i.bilder['testbrot-500g'].varianten = []),
      /varianten/,
    ],
    [
      'Datei außerhalb von bilder/<id>/',
      (i: any) =>
        (i.bilder['testbrot-500g'].varianten[0].file =
          'bilder/anderes-brot/haupt-800.webp'),
      /Variante/,
    ],
    [
      'Pfad mit ..',
      (i: any) =>
        (i.bilder['testbrot-500g'].varianten[0].file =
          'bilder/testbrot-500g/../../x.webp'),
      /Variante/,
    ],
    [
      'kein WebP',
      (i: any) =>
        (i.bilder['testbrot-500g'].varianten[0].file =
          'bilder/testbrot-500g/haupt-800.png'),
      /Variante/,
    ],
    [
      'Breite keine ganze Zahl',
      (i: any) => (i.bilder['testbrot-500g'].varianten[0].breite = 800.5),
      /Variante/,
    ],
    [
      'dieselbe Datei zweimal',
      (i: any) =>
        (i.bilder['testbrot-500g'].varianten[1] =
          i.bilder['testbrot-500g'].varianten[0]),
      /zweimal/,
    ],
  ])('wirft: %s', (_name, kaputt, meldung) => {
    const roh = index()
    kaputt(roh)
    expect(() => pruefeBilderIndex(roh)).toThrow(meldung)
  })
})

describe('webpInfo', () => {
  it('liest Maße und Alpha aus VP8X', () => {
    expect(webpInfo(vp8x(800, 600, true))).toEqual({
      breite: 800,
      hoehe: 600,
      alpha: true,
    })
    expect(webpInfo(vp8x(400, 400, false)).alpha).toBe(false)
  })

  it('liest Maße und Alpha aus VP8L', () => {
    expect(webpInfo(vp8l(800, 400, true))).toEqual({
      breite: 800,
      hoehe: 400,
      alpha: true,
    })
    expect(webpInfo(vp8l(16, 16, false)).alpha).toBe(false)
  })

  it('liest Maße aus VP8 - dort gibt es kein Alpha', () => {
    expect(webpInfo(vp8(400, 300))).toEqual({
      breite: 400,
      hoehe: 300,
      alpha: false,
    })
  })

  it('wirft bei etwas anderem als WebP', () => {
    expect(() => webpInfo(new Uint8Array(Buffer.from('kein Bild')))).toThrow(
      /keine WebP-Datei/
    )
    const png = Buffer.alloc(40)
    png.write('\x89PNG', 0, 'latin1')
    expect(() => webpInfo(new Uint8Array(png))).toThrow(/keine WebP-Datei/)
  })
})

describe('pruefeBild', () => {
  it('ist ok, wenn Maße und Alpha stimmen', () => {
    expect(pruefeBild(vp8x(800, 800, true), variante(800))).toEqual({
      ok: true,
    })
  })

  it('meldet falsche Maße', () => {
    expect(pruefeBild(vp8x(400, 400, true), variante(800))).toEqual({
      ok: false,
      reason: expect.stringMatching(/400×400.*800×800/),
    })
  })

  it('meldet ein Bild ohne transparenten Hintergrund', () => {
    expect(pruefeBild(vp8(800, 800), variante(800))).toEqual({
      ok: false,
      reason: expect.stringMatching(/Alpha/),
    })
  })

  it('meldet eine leere Datei und etwas, das kein WebP ist', () => {
    expect(pruefeBild(new Uint8Array(0), variante(800)).ok).toBe(false)
    expect(
      pruefeBild(new Uint8Array(Buffer.alloc(64, 1)), variante(800))
    ).toEqual({ ok: false, reason: 'keine WebP-Datei' })
  })
})

describe('readBilderIndex', () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bilder-index-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('ist leer, wenn es die Datei nicht gibt - kein Fehler', () => {
    expect(readBilderIndex(path.join(tmp, 'fehlt.json'))).toEqual({
      version: 1,
      bilder: {},
    })
  })

  it('liest einen geschriebenen Index', () => {
    const datei = path.join(tmp, 'index.json')
    fs.writeFileSync(datei, JSON.stringify(index()))
    expect(readBilderIndex(datei)).toEqual(index())
  })

  it('wirft bei einer kaputten Datei, statt still ohne Bilder zu bauen', () => {
    const datei = path.join(tmp, 'index.json')
    fs.writeFileSync(datei, '{"version":1')
    expect(() => readBilderIndex(datei)).toThrow()
    fs.writeFileSync(datei, '{"version":3,"bilder":{}}')
    expect(() => readBilderIndex(datei)).toThrow(/version 1/)
  })
})

describe('bildVarianten', () => {
  it('liefert die Varianten einer Ansicht, schmalste zuerst', () => {
    const i = pruefeBilderIndex(index())
    i.bilder['testbrot-500g'].varianten.push(variante(1200, 'seite'))
    expect(bildVarianten(i, 'testbrot-500g').map((v) => v.breite)).toEqual([
      400, 800,
    ])
    expect(bildVarianten(i, 'testbrot-500g', 'seite')).toHaveLength(1)
  })

  it('ist leer für ein Produkt ohne Bild - auch für "constructor"', () => {
    const i = pruefeBilderIndex(index())
    expect(bildVarianten(i, 'testkuchen')).toEqual([])
    expect(bildVarianten(i, 'constructor')).toEqual([])
    expect(bildVarianten(i, 'testbrot-500g', 'oben')).toEqual([])
  })
})
