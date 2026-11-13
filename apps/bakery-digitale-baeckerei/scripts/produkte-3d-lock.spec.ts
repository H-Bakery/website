import { sha256Hex } from './model-lock'
import {
  QUELLE_LOKAL,
  REGAL_DATEI,
  baueIndex,
  istModellId,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeManifestDatei,
  pruefeModell,
  regalPfad,
  repoPfad,
  ueberzaehlig,
  zielDatei,
} from './produkte-3d-lock'
import committedLock from '../produkte-3d.lock.json'

// Synthetische Inhalte - die echten Produkt-Modelle liegen nie im Repo.
const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'))
const BROT = bytes('kein echtes glb, nur ein Testbrot')
const WECK = bytes('kein echtes glb, nur ein Testweck')
const COMMIT = '0123456789abcdef0123456789abcdef01234567'
const BBOX = { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] }
const SHA = 'a'.repeat(64)

const LOCK = { quelle: QUELLE_LOKAL, commit: COMMIT, manifest: { sha256: SHA } }

const eintrag = (id: string, data: Uint8Array) => ({
  file: `models/${id}/model.glb`,
  sha256: sha256Hex(data),
  bytes: data.byteLength,
  triangles: 1234,
  bbox_m: BBOX,
  source: 'prozedural',
  created: '2026-01-02',
  note: 'synthetisch',
})
const manifestFor = (modelle: Record<string, Uint8Array>, version = 1) => ({
  version,
  models: Object.fromEntries(
    Object.entries(modelle).map(([id, data]) => [id, eintrag(id, data)])
  ),
})

describe('produkte-3d.lock.json (eingecheckt)', () => {
  it('ist gültig, nennt die lokale Quelle und einen vollen Commit', () => {
    const lock = parseLock(committedLock)
    expect(lock.quelle).toBe(QUELLE_LOKAL)
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(lock.manifest.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('nennt kein einziges Produkt: nur Quelle, Commit und die Prüfsumme des Manifests', () => {
    // Dieses Repo ist öffentlich - eine Liste von Modellen wäre eine Liste
    // echter Produkt-IDs.
    expect(Object.keys(committedLock).sort()).toEqual([
      'commit',
      'manifest',
      'quelle',
    ])
    expect(Object.keys(committedLock.manifest)).toEqual(['sha256'])
    const text = JSON.stringify(committedLock)
    expect(text).not.toMatch(/modelle|models|\.glb/)
    expect(text).not.toMatch(/€|EUR|preis|price/i)
    // Außer den vier Schlüsseln, der Quelle und Hex-Zeichen steht nichts darin.
    expect(
      text
        .replace(/"(quelle|commit|manifest|sha256)"/g, '')
        .replace(JSON.stringify(QUELLE_LOKAL), '')
        .replace(/[0-9a-f]{40,64}/g, '')
    ).toMatch(/^[{}:,"]*$/)
  })
})

describe('parseLock', () => {
  it('nimmt ein vollständiges Lock an', () => {
    expect(parseLock(LOCK)).toEqual(LOCK)
  })

  it('lehnt eine Liste von Modellen ab - Produkte gehören nicht ins Lock', () => {
    expect(() =>
      parseLock({
        ...LOCK,
        modelle: { 'testbrot-500g': { sha256: SHA, bytes: 5 } },
      })
    ).toThrow(/Feld "modelle" gehört nicht ins Lock .* keine Produkte/)
  })

  it.each([
    ['kein Objekt', null, /kein Objekt/],
    ['ohne Quelle', { ...LOCK, quelle: ' ' }, /quelle fehlt/],
    ['Branch statt Commit', { ...LOCK, commit: 'main' }, /voller Commit-Hash/],
    ['kurzer Hash', { ...LOCK, commit: COMMIT.slice(0, 12) }, /Commit-Hash/],
    [
      'ohne Prüfsumme des Manifests',
      { quelle: QUELLE_LOKAL, commit: COMMIT },
      /manifest\.sha256 fehlt/,
    ],
    [
      'Prüfsumme kein sha256',
      { ...LOCK, manifest: { sha256: 'abc' } },
      /manifest\.sha256/,
    ],
    [
      'mehr als die Prüfsumme am Manifest',
      { ...LOCK, manifest: { sha256: SHA, modelle: ['testbrot'] } },
      /manifest\.sha256/,
    ],
    ['ein fremdes Feld', { ...LOCK, notiz: 'x' }, /Feld "notiz"/],
  ])('lehnt ab: %s', (_, raw, meldung) => {
    expect(() => parseLock(raw)).toThrow(meldung)
  })
})

describe('pruefeManifestDatei', () => {
  const datei = bytes(JSON.stringify(manifestFor({ testweck: WECK })))

  it('nimmt genau die Datei an, deren Prüfsumme im Lock steht', () => {
    const lock = { ...LOCK, manifest: { sha256: sha256Hex(datei) } }
    expect(pruefeManifestDatei(datei, lock)).toEqual({ ok: true })
  })

  it('erkennt ein anderes Manifest - der Commit passt dann nicht zum Lock', () => {
    expect(pruefeManifestDatei(datei, LOCK)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/sha256 von manifest\.json/),
    })
  })
})

describe('Modell-IDs und Pfade', () => {
  it('lässt nur hq-IDs zu', () => {
    expect(istModellId('testbrot-500g')).toBe(true)
    for (const id of ['', '../x', 'a/b', 'Brot', 'a--b', '-a', 'a.glb', 7]) {
      expect(istModellId(id)).toBe(false)
    }
  })

  it('baut die Pfade im Daten-Repo und im Export', () => {
    expect(repoPfad('testbrot-500g')).toBe('models/testbrot-500g/model.glb')
    expect(regalPfad('testbrot-500g')).toBe('models/testbrot-500g/regal.glb')
    expect(zielDatei('testbrot-500g')).toBe('produkte-3d/testbrot-500g.glb')
    expect(() => repoPfad('../x')).toThrow(/ungültig/)
    expect(() => regalPfad('../x')).toThrow(/ungültig/)
    expect(() => zielDatei('a/b')).toThrow(/ungültig/)
  })
})

describe('pruefeManifest', () => {
  it('liefert je Modell Pfad, Rahmen und die Prüfsumme, gegen die beim Sync geprüft wird - nach ID sortiert', () => {
    const r = pruefeManifest(
      manifestFor({ testweck: WECK, 'testbrot-500g': BROT })
    )
    expect(r.modelle).toEqual([
      {
        id: 'testbrot-500g',
        pfad: 'models/testbrot-500g/model.glb',
        sha256: sha256Hex(BROT),
        bytes: BROT.byteLength,
        bbox_m: BBOX,
      },
      {
        id: 'testweck',
        pfad: 'models/testweck/model.glb',
        sha256: sha256Hex(WECK),
        bytes: WECK.byteLength,
        bbox_m: BBOX,
      },
    ])
    // Version 1 kennt keine Regal-Modelle.
    expect(r.regal).toEqual([])
  })

  it('ein Manifest ohne Modelle ist gültig', () => {
    expect(pruefeManifest(manifestFor({}))).toEqual({ modelle: [], regal: [] })
  })

  it('Manifest Version 2: dieselben Modelle, dazu die Regal-Modelle', () => {
    const v1 = manifestFor({ testweck: WECK, 'testbrot-500g': BROT })
    const v2 = {
      version: 2,
      models: {
        testweck: {
          ...v1.models.testweck,
          familie: 'broetchen',
          abgenommen: false,
          regal: {
            file: 'models/testweck/regal.glb',
            sha256: SHA,
            bytes: 7000,
            triangles: 240,
          },
        },
        // ein Modell ohne Regal-Modell
        'testbrot-500g': v1.models['testbrot-500g'],
      },
    }
    const r = pruefeManifest(v2)
    expect(r.modelle).toEqual(pruefeManifest(v1).modelle)
    expect(r.regal).toEqual([
      {
        id: 'testweck',
        pfad: 'models/testweck/regal.glb',
        sha256: SHA,
        bytes: 7000,
      },
    ])
  })

  it('bricht ab bei fremdem Pfad, fehlender Prüfsumme, fehlendem Rahmen, ungültiger ID oder falscher Version', () => {
    const gut = manifestFor({ testweck: WECK })
    const mit = (aenderung: Record<string, unknown>) => ({
      ...gut,
      models: { testweck: { ...gut.models.testweck, ...aenderung } },
    })
    expect(() =>
      pruefeManifest(mit({ file: 'models/anderes/model.glb' }))
    ).toThrow(/file für testweck/)
    expect(() => pruefeManifest(mit({ file: '../../etc/passwd' }))).toThrow(
      /file für testweck/
    )
    expect(() => pruefeManifest(mit({ sha256: 'kurz' }))).toThrow(
      /sha256\/bytes für testweck/
    )
    expect(() => pruefeManifest(mit({ bytes: 0 }))).toThrow(/sha256\/bytes/)
    expect(() => pruefeManifest(mit({ bbox_m: { min: [0] } }))).toThrow(
      /bbox_m/
    )
    expect(() =>
      pruefeManifest({ version: 1, models: { '../x': gut.models.testweck } })
    ).toThrow(/Modell-ID/)
    expect(() =>
      pruefeManifest({ version: 1, models: { testweck: 3 } })
    ).toThrow(/Eintrag für testweck/)
    expect(() => pruefeManifest({ ...gut, version: 3 })).toThrow(
      /version 1 oder 2/
    )
    expect(() => pruefeManifest({ version: 1 })).toThrow(/models fehlt/)
  })

  it.each([
    ['fremder Pfad', { file: 'models/anderes/regal.glb' }],
    ['Pfad nach außen', { file: '../regal.glb' }],
    ['keine Prüfsumme', { sha256: 'kurz' }],
    ['keine Größe', { bytes: 0 }],
  ])(
    'bricht ab bei einem Regal-Modell außerhalb des Vertrags: %s',
    (_n, falsch) => {
      const gut = manifestFor({ testweck: WECK }, 2)
      const v2 = {
        version: 2,
        models: {
          testweck: {
            ...gut.models.testweck,
            regal: {
              file: 'models/testweck/regal.glb',
              sha256: SHA,
              bytes: 7000,
              ...falsch,
            },
          },
        },
      }
      expect(() => pruefeManifest(v2)).toThrow(/regal für testweck/)
    }
  )
})

describe('pruefeModell', () => {
  const [modell] = pruefeManifest(manifestFor({ testweck: WECK })).modelle

  it('nimmt den Inhalt an, dessen Prüfsumme im Manifest steht', () => {
    expect(pruefeModell(WECK, modell)).toEqual({ ok: true })
  })

  it('erkennt eine andere Größe und einen anderen Inhalt', () => {
    expect(pruefeModell(BROT.slice(0, 5), modell)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Größe/),
    })
    const gleichLang = new Uint8Array(WECK)
    gleichLang[0] ^= 0xff
    expect(pruefeModell(gleichLang, modell)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/sha256/),
    })
  })
})

describe('Index für die App', () => {
  it('ist ohne Modelle leer, aber gültig - Byte für Byte der Index von früher', () => {
    expect(leererIndex()).toEqual({ version: 1, modelle: {} })
    expect(pruefeIndex(leererIndex())).toEqual(leererIndex())
    expect(JSON.stringify(leererIndex())).toBe('{"version":1,"modelle":{}}')
  })

  it('nennt je Modell Datei, Größe und Rahmen - sortiert, sonst nichts', () => {
    const { modelle } = pruefeManifest(
      manifestFor({ testweck: WECK, 'testbrot-500g': BROT })
    )
    const index = baueIndex([...modelle].reverse())
    expect(Object.keys(index.modelle)).toEqual(['testbrot-500g', 'testweck'])
    expect(index.modelle.testweck).toEqual({
      datei: 'produkte-3d/testweck.glb',
      bytes: WECK.byteLength,
      bbox_m: BBOX,
    })
    expect(pruefeIndex(index)).toBe(index)
    // Weder Prüfsumme noch Notiz noch Quelle aus dem Manifest.
    expect(JSON.stringify(index)).not.toMatch(/sha256|note|source|created/)
  })

  it('mit Regal-Modellen: der Index nennt das eine Paket und je Produkt Rahmen und Dreiecke', () => {
    const regal = {
      bytes: 3048,
      modelle: { testweck: { bbox_m: BBOX, dreiecke: 14 } },
    }
    const index = baueIndex(
      pruefeManifest(manifestFor({ testweck: WECK })).modelle,
      regal
    )
    expect(index.regal).toEqual({
      datei: 'produkte-3d/_regal.glb',
      bytes: 3048,
      modelle: { testweck: { bbox_m: BBOX, dreiecke: 14 } },
    })
    expect(pruefeIndex(index)).toBe(index)
    expect(REGAL_DATEI).toBe('produkte-3d/_regal.glb')
    // Die Nahansicht kann leer sein, die Regale nicht (und umgekehrt).
    expect(pruefeIndex(baueIndex([], regal)).modelle).toEqual({})
    // Ein leeres Paket steht gar nicht im Index: genau der leere Index von früher.
    expect(baueIndex([], { bytes: 12, modelle: {} })).toEqual({
      version: 1,
      modelle: {},
    })
  })

  it('lehnt einen Index mit fremder Datei oder fremden Feldern ab', () => {
    const gut = { datei: 'produkte-3d/testweck.glb', bytes: 5, bbox_m: BBOX }
    expect(() =>
      pruefeIndex({
        version: 1,
        modelle: { testweck: { ...gut, datei: 'https://example.org/x.glb' } },
      })
    ).toThrow(/testweck/)
    expect(() =>
      pruefeIndex({ version: 1, modelle: { testweck: { ...gut, preis: 1 } } })
    ).toThrow(/außerhalb des Vertrags/)
    expect(() => pruefeIndex({ version: 2, modelle: {} })).toThrow(/version/)
    expect(() => pruefeIndex({ version: 1, modelle: {}, mehr: true })).toThrow(
      /außerhalb des Vertrags \(mehr\)/
    )
  })

  it('lehnt ein Regal-Paket außerhalb des Vertrags ab', () => {
    const gut = {
      datei: 'produkte-3d/_regal.glb',
      bytes: 10,
      modelle: { testweck: { bbox_m: BBOX, dreiecke: 14 } },
    }
    const mit = (regal: unknown) => ({ version: 1, modelle: {}, regal })
    expect(pruefeIndex(mit(gut))).toEqual(mit(gut))
    expect(() =>
      pruefeIndex(mit({ ...gut, datei: 'https://example.org/regal.glb' }))
    ).toThrow(/regal ist ungültig/)
    expect(() => pruefeIndex(mit({ ...gut, bytes: 0 }))).toThrow(/regal/)
    expect(() => pruefeIndex(mit({ ...gut, sha256: 'x' }))).toThrow(/regal/)
    expect(() =>
      pruefeIndex(
        mit({ ...gut, modelle: { testweck: { bbox_m: BBOX, dreiecke: 0 } } })
      )
    ).toThrow(/Regal-Modell testweck/)
    expect(() =>
      pruefeIndex(
        mit({
          ...gut,
          modelle: { testweck: { bbox_m: BBOX, dreiecke: 14, preis: 1 } },
        })
      )
    ).toThrow(/Regal-Modell testweck/)
    // Eine ungültige ID wird nicht wiederholt.
    expect(() =>
      pruefeIndex(
        mit({ ...gut, modelle: { '../x': { bbox_m: BBOX, dreiecke: 14 } } })
      )
    ).toThrow(/\(ungültige ID\)/)
  })

  it('findet, was im Zielordner liegt und nicht im Index steht', () => {
    const index = {
      version: 1 as const,
      modelle: {
        testweck: { datei: 'produkte-3d/testweck.glb', bytes: 5, bbox_m: BBOX },
      },
    }
    expect(
      ueberzaehlig(['testweck.glb', 'altes-brot.glb', '.DS_Store'], index)
    ).toEqual(['.DS_Store', 'altes-brot.glb'])
    expect(ueberzaehlig([], index)).toEqual([])
  })

  it('das Regal-Paket gehört in den Zielordner, wenn der Index es nennt', () => {
    const mit = {
      version: 1 as const,
      modelle: {},
      regal: { datei: 'produkte-3d/_regal.glb', bytes: 5, modelle: {} },
    }
    expect(ueberzaehlig(['_regal.glb', 'altes.glb'], mit)).toEqual([
      'altes.glb',
    ])
    expect(
      ueberzaehlig(['_regal.glb'], { version: 1 as const, modelle: {} })
    ).toEqual(['_regal.glb'])
  })
})
