import { sha256Hex } from './model-lock'
import {
  QUELLE_LOKAL,
  baueIndex,
  istModellId,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeModell,
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

const lockFor = (modelle: Record<string, Uint8Array>) => ({
  quelle: QUELLE_LOKAL,
  commit: COMMIT,
  modelle: Object.fromEntries(
    Object.entries(modelle).map(([id, data]) => [
      id,
      { sha256: sha256Hex(data), bytes: data.byteLength },
    ])
  ),
})

const manifestFor = (modelle: Record<string, Uint8Array>) => ({
  version: 1,
  models: Object.fromEntries(
    Object.entries(modelle).map(([id, data]) => [
      id,
      {
        file: `models/${id}/model.glb`,
        sha256: sha256Hex(data),
        bytes: data.byteLength,
        triangles: 162,
        bbox_m: BBOX,
        source: 'prozedural',
        created: '2026-01-02',
        note: 'Testmodell',
      },
    ])
  ),
})

describe('produkte-3d.lock.json (eingecheckt)', () => {
  it('ist gültig, nennt die lokale Quelle und einen vollen Commit', () => {
    const lock = parseLock(committedLock)
    expect(lock.quelle).toBe(QUELLE_LOKAL)
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(Object.keys(lock.modelle).length).toBeGreaterThan(0)
  })

  it('trägt nur Prüfsummen und Größen - keine Namen, Texte oder Beträge', () => {
    for (const eintrag of Object.values(committedLock.modelle)) {
      expect(Object.keys(eintrag).sort()).toEqual(['bytes', 'sha256'])
    }
    expect(JSON.stringify(committedLock)).not.toMatch(/€|EUR|preis|price/i)
  })
})

describe('parseLock', () => {
  it('nimmt ein vollständiges Lock an', () => {
    const lock = lockFor({ 'testbrot-500g': BROT })
    expect(parseLock(lock)).toEqual(lock)
  })

  it('erlaubt ein Lock ohne Modelle', () => {
    expect(parseLock(lockFor({})).modelle).toEqual({})
  })

  it.each([
    ['kein Objekt', null, /kein Objekt/],
    ['ohne Quelle', { ...lockFor({}), quelle: '' }, /quelle/],
    ['Branch statt Commit', { ...lockFor({}), commit: 'main' }, /commit/],
    ['kurzer Hash', { ...lockFor({}), commit: 'a97ed9d' }, /commit/],
    ['ohne modelle', { quelle: QUELLE_LOKAL, commit: COMMIT }, /modelle/],
    [
      'ID mit Pfad',
      { ...lockFor({}), modelle: { '../x': { sha256: 'a', bytes: 1 } } },
      /Modell-ID/,
    ],
    [
      'kaputte Prüfsumme',
      {
        ...lockFor({}),
        modelle: { testbrot: { sha256: 'abc', bytes: 10 } },
      },
      /sha256/,
    ],
    [
      'Größe 0',
      {
        ...lockFor({}),
        modelle: { testbrot: { sha256: sha256Hex(BROT), bytes: 0 } },
      },
      /bytes/,
    ],
  ])('lehnt ab: %s', (_, raw, meldung) => {
    expect(() => parseLock(raw)).toThrow(meldung)
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
    expect(zielDatei('testbrot-500g')).toBe('produkte-3d/testbrot-500g.glb')
    expect(() => repoPfad('../x')).toThrow(/ungültig/)
    expect(() => zielDatei('a/b')).toThrow(/ungültig/)
  })
})

describe('pruefeManifest', () => {
  it('liefert je gesperrtem Modell Pfad und Rahmen', () => {
    const modelle = { 'testbrot-500g': BROT, testweck: WECK }
    const r = pruefeManifest(manifestFor(modelle), lockFor(modelle))
    expect(r.modelle).toEqual([
      {
        id: 'testbrot-500g',
        pfad: 'models/testbrot-500g/model.glb',
        bbox_m: BBOX,
      },
      { id: 'testweck', pfad: 'models/testweck/model.glb', bbox_m: BBOX },
    ])
    expect(r.nichtImLock).toEqual([])
  })

  it('nimmt nur, was im Lock steht - der Rest wird gemeldet', () => {
    const r = pruefeManifest(
      manifestFor({ 'testbrot-500g': BROT, testweck: WECK }),
      lockFor({ testweck: WECK })
    )
    expect(r.modelle.map((m) => m.id)).toEqual(['testweck'])
    expect(r.nichtImLock).toEqual(['testbrot-500g'])
  })

  it('bricht ab, wenn ein gesperrtes Modell im Manifest fehlt', () => {
    expect(() =>
      pruefeManifest(manifestFor({}), lockFor({ testweck: WECK }))
    ).toThrow(/kennt testweck nicht/)
  })

  it('bricht ab, wenn Manifest und Lock sich widersprechen', () => {
    expect(() =>
      pruefeManifest(
        manifestFor({ testweck: BROT }),
        lockFor({ testweck: WECK })
      )
    ).toThrow(/widersprechen/)
  })

  it('bricht ab bei fremdem Pfad, fehlendem Rahmen oder falscher Version', () => {
    const lock = lockFor({ testweck: WECK })
    const manifest = manifestFor({ testweck: WECK })
    expect(() =>
      pruefeManifest(
        {
          ...manifest,
          models: {
            testweck: { ...manifest.models.testweck, file: '../geheim.glb' },
          },
        },
        lock
      )
    ).toThrow(/file/)
    expect(() =>
      pruefeManifest(
        {
          ...manifest,
          models: {
            testweck: { ...manifest.models.testweck, bbox_m: { min: [0] } },
          },
        },
        lock
      )
    ).toThrow(/bbox_m/)
    expect(() => pruefeManifest({ ...manifest, version: 2 }, lock)).toThrow(
      /version/
    )
  })
})

describe('pruefeModell', () => {
  const lock = lockFor({ testweck: WECK })

  it('nimmt den passenden Inhalt an', () => {
    expect(pruefeModell(WECK, lock.modelle.testweck)).toEqual({ ok: true })
  })

  it('erkennt eine andere Größe und einen anderen Inhalt', () => {
    expect(pruefeModell(BROT.slice(0, 5), lock.modelle.testweck)).toMatchObject(
      { ok: false, reason: expect.stringMatching(/Größe/) }
    )
    const gleichLang = new Uint8Array(WECK)
    gleichLang[0] ^= 0xff
    expect(pruefeModell(gleichLang, lock.modelle.testweck)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/sha256/),
    })
  })
})

describe('Index für die App', () => {
  it('ist ohne Modelle leer, aber gültig', () => {
    expect(leererIndex()).toEqual({ version: 1, modelle: {} })
    expect(pruefeIndex(leererIndex())).toEqual(leererIndex())
  })

  it('nennt je Modell Datei, Größe und Rahmen - sortiert, sonst nichts', () => {
    const modelle = { testweck: WECK, 'testbrot-500g': BROT }
    const lock = lockFor(modelle)
    const index = baueIndex(
      lock,
      pruefeManifest(manifestFor(modelle), lock).modelle
    )
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
  })

  it('findet, was im Zielordner liegt und nicht im Index steht', () => {
    const index = {
      version: 1 as const,
      modelle: {
        testweck: { datei: 'produkte-3d/testweck.glb', bytes: 5, bbox_m: BBOX },
      },
    }
    expect(
      ueberzaehlig(['testweck.glb', 'brezel.glb', 'notiz.txt'], index)
    ).toEqual(['brezel.glb', 'notiz.txt'])
    expect(ueberzaehlig(['brezel.glb'], leererIndex())).toEqual(['brezel.glb'])
  })
})
