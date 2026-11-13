import {
  LOCK_FORMAT,
  LOCK_FORMAT_V1,
  ausgeliefert,
  checkFile,
  fileUrl,
  lockDateien,
  migriereV1,
  parseLock,
  planSync,
  sha256Hex,
  staleFiles,
} from './model-lock'
import committedLock from '../model.lock.json'

// Synthetische Inhalte - das echte Modell liegt nie im Repo.
const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'))
const GLB = bytes('kein echtes glb, nur ein Testinhalt')
const ZWEITES = bytes('ein zweites erfundenes Modell')
const BEREINIGT = bytes('bereinigt')

const SOURCE = {
  repo: 'beispiel/modell-daten',
  commit: '0123456789abcdef0123456789abcdef01234567',
  path: 'zones/testladen/built',
}

/** Ein Lock mit je einem Raum pro Eintrag: Raum-id → [Datei, Inhalt]. */
const lockFor = (raeume: Record<string, [string, Uint8Array]>) => ({
  format: LOCK_FORMAT,
  raeume: Object.fromEntries(
    Object.entries(raeume).map(([id, [datei, data]]) => [
      id,
      {
        datei,
        source: SOURCE,
        fetched: '2026-01-02',
        sha256: sha256Hex(data),
        bytes: data.byteLength,
      } as Record<string, unknown>,
    ])
  ),
})
const EIN_RAUM = () => lockFor({ laden: ['twin.glb', GLB] })
/** Den einen Raum eines Locks mit geänderten Feldern. */
const mit = (aenderung: Record<string, unknown>) => {
  const raw = EIN_RAUM()
  return { ...raw, raeume: { laden: { ...raw.raeume.laden, ...aenderung } } }
}

/** Das Lock, wie es bis P4 eingecheckt war (Format v1) - Wort für Wort. */
const ALTES_LOCK = {
  format: 'bakery-model-lock-v1',
  source: {
    repo: 'Open-Kirrberg/saar-lidar-data',
    commit: '8b416d5e0f834d0080bdbda0ff4ebd2c397e35c5',
    path: 'zones/baeckerei-heusser/built',
  },
  fetched: '2026-11-12',
  files: {
    'twin.glb': {
      sha256:
        '7b63bc5795e8b49016e20e50aad7a6c4179cb58f75bad4b349a8fd4a1c2d7f7a',
      bytes: 3237272,
      ausgeliefert: {
        sha256:
          '3da786222bf13849f87c56eeae9bda90dce779a39a98428e9e1a54e677536bbe',
        bytes: 3127052,
      },
    },
  },
}

describe('sha256Hex', () => {
  it('rechnet den bekannten Wert der leeren Eingabe', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
})

describe('parseLock', () => {
  it('nimmt ein vollständiges Lock an', () => {
    const lock = parseLock(EIN_RAUM())
    expect(lock.raeume.laden.source.commit).toHaveLength(40)
    expect(lock.raeume.laden.datei).toBe('twin.glb')
    expect(lock.raeume.laden.bytes).toBe(GLB.byteLength)
    // Ohne eigene Angabe heißt die Datei an der Quelle wie unter public/model/.
    expect(lock.raeume.laden.source.datei).toBe('twin.glb')
  })

  it('nimmt mehrere Räume an, jeder mit eigener Quelle und eigener Datei', () => {
    const raw = lockFor({
      laden: ['twin.glb', GLB],
      backstube: ['backstube.glb', ZWEITES],
    })
    raw.raeume.backstube.source = {
      ...SOURCE,
      path: 'zones/testbackstube/built',
      datei: 'twin.glb',
    }
    const lock = parseLock(raw)
    expect(Object.keys(lock.raeume)).toEqual(['laden', 'backstube'])
    expect(lockDateien(lock)).toEqual(['twin.glb', 'backstube.glb'])
    expect(lock.raeume.backstube.source.datei).toBe('twin.glb')
  })

  it('nimmt das eingecheckte model.lock.json an - nur der Verkaufsraum, kein Katalog mit Preisen', () => {
    const lock = parseLock(committedLock)
    expect(Object.keys(lock.raeume)).toEqual(['laden'])
    expect(lockDateien(lock)).toEqual(['twin.glb'])
  })

  it('das eingecheckte Lock nennt die ausgelieferte Datei: eine andere, kleinere als die Quelle', () => {
    const entry = parseLock(committedLock).raeume.laden
    expect(entry.ausgeliefert).toBeDefined()
    expect(entry.ausgeliefert?.sha256).not.toBe(entry.sha256)
    expect(entry.ausgeliefert?.bytes).toBeLessThan(entry.bytes)
  })

  it('liest die Prüfsumme der ausgelieferten Datei', () => {
    const lock = parseLock(
      mit({ ausgeliefert: { sha256: sha256Hex(BEREINIGT), bytes: 9 } })
    )
    expect(lock.raeume.laden.ausgeliefert).toEqual({
      sha256: sha256Hex(BEREINIGT),
      bytes: 9,
    })
  })

  it.each([
    ['kein Objekt', 'abc', /ausgeliefert für twin\.glb ist ungültig/],
    ['sha256 fehlt', { bytes: 3 }, /sha256 für twin\.glb \(ausgeliefert\)/],
    [
      'bytes ist keine Zahl',
      { sha256: sha256Hex(GLB), bytes: '3' },
      /bytes für twin\.glb \(ausgeliefert\)/,
    ],
  ])('lehnt ab: ausgeliefert - %s', (_name, wert, message) => {
    expect(() => parseLock(mit({ ausgeliefert: wert }))).toThrow(message)
  })

  it.each([
    ['kein Objekt', null, /kein Objekt/],
    ['falsches Format', { ...EIN_RAUM(), format: 'x' }, /format/],
    [
      'Branch statt Commit',
      mit({ source: { repo: 'a/b', commit: 'main', path: 'p' } }),
      /Commit-Hash/,
    ],
    [
      'gekürzter Commit',
      mit({ source: { repo: 'a/b', commit: '0123abc', path: 'p' } }),
      /Commit-Hash/,
    ],
    [
      'Pfad mit ..',
      mit({ source: { ...SOURCE, path: 'zones/../geheim' } }),
      /source\.path/,
    ],
    ['Quelle fehlt', mit({ source: undefined }), /raeume\.laden\.source fehlt/],
    [
      'Datei an der Quelle mit Pfad',
      mit({ source: { ...SOURCE, datei: '../twin.glb' } }),
      /source\.datei/,
    ],
    ['ohne Räume', { format: LOCK_FORMAT, raeume: {} }, /raeume/],
    [
      'Raum-id mit Großbuchstaben',
      lockFor({ Laden: ['twin.glb', GLB] }),
      /keine gültige id/,
    ],
    ['Dateiname mit Pfad', mit({ datei: '../twin.glb' }), /datei ist ungültig/],
    ['Datei fehlt', mit({ datei: undefined }), /datei ist ungültig/],
    [
      'zwei Räume, dieselbe Datei',
      lockFor({ laden: ['twin.glb', GLB], backstube: ['twin.glb', ZWEITES] }),
      /mehr als einem Raum/,
    ],
    ['sha256 zu kurz', mit({ sha256: 'abc' }), /sha256/],
    ['bytes fehlt', mit({ bytes: undefined }), /bytes/],
    ['Datum fehlt', mit({ fetched: 'gestern' }), /fetched/],
  ])('lehnt ab: %s', (_name, raw, message) => {
    expect(() => parseLock(raw)).toThrow(message)
  })
})

describe('altes Format (v1) → Räume', () => {
  it('das alte Lock des Verkaufsraums ergibt genau das eingecheckte neue: gleiche Quelle, gleiche Prüfsummen', () => {
    expect(ALTES_LOCK.format).toBe(LOCK_FORMAT_V1)
    expect(parseLock(ALTES_LOCK)).toEqual(parseLock(committedLock))
  })

  it('die Prüfsumme der ausgelieferten Datei ist unverändert', () => {
    expect(parseLock(committedLock).raeume.laden.ausgeliefert).toEqual(
      ALTES_LOCK.files['twin.glb'].ausgeliefert
    )
    expect(fileUrl(parseLock(committedLock), 'laden')).toBe(
      'https://raw.githubusercontent.com/Open-Kirrberg/saar-lidar-data/8b416d5e0f834d0080bdbda0ff4ebd2c397e35c5/zones/baeckerei-heusser/built/twin.glb'
    )
  })

  it('macht aus twin.glb den Raum „laden“ mit der gemeinsamen Quelle', () => {
    const neu = migriereV1(ALTES_LOCK)
    expect(neu.format).toBe(LOCK_FORMAT)
    expect(neu.raeume).toEqual({
      laden: {
        datei: 'twin.glb',
        source: ALTES_LOCK.source,
        fetched: ALTES_LOCK.fetched,
        ...ALTES_LOCK.files['twin.glb'],
      },
    })
  })

  it('eine andere Datei gehört im alten Format zu keinem Raum', () => {
    expect(() =>
      parseLock({
        ...ALTES_LOCK,
        files: { 'catalogue.json': ALTES_LOCK.files['twin.glb'] },
      })
    ).toThrow(/gehört zu keinem Raum/)
    expect(() => parseLock({ ...ALTES_LOCK, files: {} })).toThrow(/files/)
  })

  it('prüft auch ein altes Lock: kein Branch als Stand', () => {
    expect(() =>
      parseLock({
        ...ALTES_LOCK,
        source: { ...ALTES_LOCK.source, commit: 'main' },
      })
    ).toThrow(/Commit-Hash/)
  })
})

describe('fileUrl', () => {
  const lock = parseLock(
    lockFor({ laden: ['twin.glb', GLB], backstube: ['backstube.glb', ZWEITES] })
  )

  it('zeigt auf den festen Commit', () => {
    expect(fileUrl(lock, 'laden')).toBe(
      'https://raw.githubusercontent.com/beispiel/modell-daten/0123456789abcdef0123456789abcdef01234567/zones/testladen/built/twin.glb'
    )
    expect(fileUrl(lock, 'backstube')).toMatch(/\/built\/backstube\.glb$/)
  })

  it('nimmt den Namen an der Quelle, wenn er anders ist als der ausgelieferte', () => {
    const raw = lockFor({ backstube: ['backstube.glb', ZWEITES] })
    raw.raeume.backstube.source = { ...SOURCE, datei: 'twin.glb' }
    expect(fileUrl(parseLock(raw), 'backstube')).toMatch(/\/built\/twin\.glb$/)
  })

  it('kennt nur Räume aus dem Lock', () => {
    expect(() => fileUrl(lock, 'keller')).toThrow(/kennt den Raum keller nicht/)
    expect(() => fileUrl(lock, 'toString')).toThrow(/kennt den Raum/)
  })
})

describe('checkFile', () => {
  const entry = parseLock(EIN_RAUM()).raeume.laden

  it('stimmt bei gleichem Inhalt', () => {
    expect(checkFile(GLB, entry)).toEqual({ ok: true })
  })

  it('meldet eine andere Größe', () => {
    const result = checkFile(bytes('kürzer'), entry)
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      reason: expect.stringMatching(/Größe \d+ Bytes, erwartet/),
    })
  })

  it('meldet einen anderen Inhalt gleicher Größe', () => {
    const other = new Uint8Array(GLB)
    other[0] ^= 0xff
    const result = checkFile(other, entry)
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      reason: expect.stringMatching(/^sha256 /),
    })
  })
})

describe('planSync', () => {
  const lock = parseLock(
    lockFor({ laden: ['twin.glb', GLB], backstube: ['backstube.glb', ZWEITES] })
  )

  it('lädt, was fehlt - je Raum', () => {
    const plan = planSync(lock, () => null)
    expect(plan.map((p) => [p.raum, p.name, p.action])).toEqual([
      ['laden', 'twin.glb', 'fetch'],
      ['backstube', 'backstube.glb', 'fetch'],
    ])
    expect(plan[0].url).toBe(fileUrl(lock, 'laden'))
  })

  it('lädt nichts, wenn alles passend da ist', () => {
    const local: Record<string, Uint8Array> = {
      'twin.glb': GLB,
      'backstube.glb': ZWEITES,
    }
    const plan = planSync(lock, (name) => local[name] ?? null)
    expect(plan.map((p) => p.action)).toEqual(['keep', 'keep'])
  })

  it('lädt eine veraltete Datei neu und lässt die passende stehen', () => {
    const local: Record<string, Uint8Array> = {
      'twin.glb': bytes('alter Stand'),
      'backstube.glb': ZWEITES,
    }
    const plan = planSync(lock, (name) => local[name] ?? null)
    expect(plan.map((p) => p.action)).toEqual(['fetch', 'keep'])
    expect(plan[0].reason).toMatch(/^veraltet/)
  })
})

describe('ausgeliefert', () => {
  const quelle = { sha256: sha256Hex(GLB), bytes: GLB.byteLength }
  const bereinigt = {
    sha256: sha256Hex(BEREINIGT),
    bytes: BEREINIGT.byteLength,
  }

  it('ohne zweite Prüfsumme wird die Datei der Quelle ausgeliefert', () => {
    expect(ausgeliefert(quelle)).toEqual(quelle)
  })

  it('mit zweiter Prüfsumme gilt die', () => {
    expect(ausgeliefert({ ...quelle, ausgeliefert: bereinigt })).toEqual(
      bereinigt
    )
  })

  it('planSync vergleicht die Datei im Zielordner mit der ausgelieferten Prüfsumme', () => {
    const lock = parseLock(mit({ ausgeliefert: bereinigt }))
    // Im Zielordner liegt die bereinigte Datei: nichts zu tun.
    expect(planSync(lock, () => BEREINIGT)[0].action).toBe('keep')
    // Läge dort das Original der Quelle, wäre das veraltet.
    expect(planSync(lock, () => GLB)[0].action).toBe('fetch')
  })
})

describe('staleFiles', () => {
  it('nennt, was im Ordner liegt und nicht im Lock steht', () => {
    expect(
      staleFiles(['twin.glb', 'catalogue.json', 'alt.glb'], ['twin.glb'])
    ).toEqual(['alt.glb', 'catalogue.json'])
  })

  it('ein passender Ordner bleibt, wie er ist', () => {
    expect(staleFiles(['twin.glb'], ['twin.glb'])).toEqual([])
    expect(staleFiles([], ['twin.glb'])).toEqual([])
  })
})
