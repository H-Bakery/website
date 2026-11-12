import {
  LOCK_FORMAT,
  checkFile,
  fileUrl,
  parseLock,
  planSync,
  sha256Hex,
} from './model-lock'
import committedLock from '../model.lock.json'

// Synthetische Inhalte - das echte Modell liegt nie im Repo.
const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'))
const GLB = bytes('kein echtes glb, nur ein Testinhalt')
const CATALOGUE = bytes('{"products":{"testbrot":{"name_de":"Testbrot"}}}')

const lockFor = (files: Record<string, Uint8Array>) => ({
  format: LOCK_FORMAT,
  source: {
    repo: 'beispiel/modell-daten',
    commit: '0123456789abcdef0123456789abcdef01234567',
    path: 'zones/testladen/built',
  },
  fetched: '2026-01-02',
  files: Object.fromEntries(
    Object.entries(files).map(([name, data]) => [
      name,
      { sha256: sha256Hex(data), bytes: data.byteLength },
    ])
  ),
})

describe('sha256Hex', () => {
  it('rechnet den bekannten Wert der leeren Eingabe', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
})

describe('parseLock', () => {
  it('nimmt ein vollständiges Lock an', () => {
    const lock = parseLock(lockFor({ 'twin.glb': GLB }))
    expect(lock.source.commit).toHaveLength(40)
    expect(lock.files['twin.glb'].bytes).toBe(GLB.byteLength)
  })

  it('nimmt das eingecheckte model.lock.json an', () => {
    const lock = parseLock(committedLock)
    expect(Object.keys(lock.files).sort()).toEqual([
      'catalogue.json',
      'twin.glb',
    ])
  })

  it.each([
    ['kein Objekt', null, /kein Objekt/],
    ['falsches Format', { ...lockFor({ a: GLB }), format: 'x' }, /format/],
    [
      'Branch statt Commit',
      {
        ...lockFor({ a: GLB }),
        source: { repo: 'a/b', commit: 'main', path: 'p' },
      },
      /Commit-Hash/,
    ],
    [
      'gekürzter Commit',
      {
        ...lockFor({ a: GLB }),
        source: { repo: 'a/b', commit: '0123abc', path: 'p' },
      },
      /Commit-Hash/,
    ],
    [
      'Pfad mit ..',
      {
        ...lockFor({ a: GLB }),
        source: {
          repo: 'a/b',
          commit: '0123456789abcdef0123456789abcdef01234567',
          path: 'zones/../geheim',
        },
      },
      /source\.path/,
    ],
    ['ohne Dateien', { ...lockFor({}) }, /files/],
    ['Dateiname mit Pfad', { ...lockFor({ '../twin.glb': GLB }) }, /Dateiname/],
    [
      'sha256 zu kurz',
      {
        ...lockFor({ a: GLB }),
        files: { a: { sha256: 'abc', bytes: 3 } },
      },
      /sha256/,
    ],
    [
      'bytes fehlt',
      {
        ...lockFor({ a: GLB }),
        files: { a: { sha256: sha256Hex(GLB) } },
      },
      /bytes/,
    ],
    ['Datum fehlt', { ...lockFor({ a: GLB }), fetched: 'gestern' }, /fetched/],
  ])('lehnt ab: %s', (_name, raw, message) => {
    expect(() => parseLock(raw)).toThrow(message)
  })
})

describe('fileUrl', () => {
  const lock = parseLock(lockFor({ 'twin.glb': GLB }))

  it('zeigt auf den festen Commit', () => {
    expect(fileUrl(lock, 'twin.glb')).toBe(
      'https://raw.githubusercontent.com/beispiel/modell-daten/0123456789abcdef0123456789abcdef01234567/zones/testladen/built/twin.glb'
    )
  })

  it('kennt nur Dateien aus dem Lock', () => {
    expect(() => fileUrl(lock, 'anderes.glb')).toThrow(/kennt anderes\.glb/)
    expect(() => fileUrl(lock, 'toString')).toThrow(/kennt toString/)
  })
})

describe('checkFile', () => {
  const entry = { sha256: sha256Hex(GLB), bytes: GLB.byteLength }

  it('stimmt bei gleichem Inhalt', () => {
    expect(checkFile(GLB, entry)).toEqual({ ok: true })
  })

  it('meldet eine andere Größe', () => {
    const result = checkFile(bytes('kürzer'), entry)
    expect(result).toEqual({
      ok: false,
      reason: expect.stringMatching(/Größe/),
    })
  })

  it('meldet einen anderen Inhalt gleicher Größe', () => {
    const other = GLB.slice()
    other[0] ^= 0xff
    const result = checkFile(other, entry)
    expect(result).toEqual({
      ok: false,
      reason: expect.stringMatching(/^sha256 /),
    })
  })
})

describe('planSync', () => {
  const lock = parseLock(
    lockFor({ 'twin.glb': GLB, 'catalogue.json': CATALOGUE })
  )

  it('lädt, was fehlt', () => {
    const plan = planSync(lock, () => null)
    expect(plan.map((p) => [p.name, p.action])).toEqual([
      ['twin.glb', 'fetch'],
      ['catalogue.json', 'fetch'],
    ])
    expect(plan[0].url).toContain('/zones/testladen/built/twin.glb')
  })

  it('lädt nichts, wenn alles passend da ist', () => {
    const have: Record<string, Uint8Array> = {
      'twin.glb': GLB,
      'catalogue.json': CATALOGUE,
    }
    const plan = planSync(lock, (name) => have[name] ?? null)
    expect(plan.every((p) => p.action === 'keep')).toBe(true)
  })

  it('lädt eine veraltete Datei neu und lässt die passende stehen', () => {
    const have: Record<string, Uint8Array> = {
      'twin.glb': bytes('alter Stand des Modells'),
      'catalogue.json': CATALOGUE,
    }
    const plan = planSync(lock, (name) => have[name] ?? null)
    expect(plan.map((p) => [p.name, p.action])).toEqual([
      ['twin.glb', 'fetch'],
      ['catalogue.json', 'keep'],
    ])
    expect(plan[0].reason).toMatch(/veraltet/)
  })
})
