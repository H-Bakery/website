import fs from 'fs'
import os from 'os'
import path from 'path'
import { FIXTURE_ENV, pruefeExport } from './export-pruefung'
import { LOCK_FORMAT, parseLock, sha256Hex } from './model-lock'
import {
  SNAPSHOT_PATH,
  ausgeliefertesModell,
  ladeFixture,
} from '../src/test/fixtures/fixture-info'
import { belegungAusGlb } from './belegung'

// Ein synthetischer Export aus den Fixtures - das echte Modell und echte
// Produkttexte liegen nie im Repo. Das „Lock“ hier beschreibt das Mini-Modell.
const BASIS = '/digitale-baeckerei'
const QUELLE = ladeFixture().glb
const MODELL = ausgeliefertesModell()

const lock = parseLock({
  format: LOCK_FORMAT,
  source: {
    repo: 'beispiel/modell-daten',
    commit: '0123456789abcdef0123456789abcdef01234567',
    path: 'zones/testladen/built',
  },
  fetched: '2026-01-02',
  files: {
    'twin.glb': {
      sha256: sha256Hex(QUELLE),
      bytes: QUELLE.byteLength,
      ausgeliefert: { sha256: sha256Hex(MODELL), bytes: MODELL.byteLength },
    },
  },
})

let outDir: string
const schreibe = (rel: string, inhalt: string | Uint8Array) => {
  const file = path.join(outDir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, inhalt)
}
const pruefe = (env: Record<string, string | undefined> = {}) =>
  pruefeExport({ outDir, lock, env, basePath: BASIS })

beforeEach(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-pruefung-'))
  schreibe(
    'index.html',
    `<html><script src="${BASIS}/_next/static/chunks/main.js"></script></html>`
  )
  schreibe('_next/static/chunks/main.js', 'console.log("Testbrot")')
  schreibe('model/twin.glb', MODELL)
  schreibe(
    'data/belegung.json',
    JSON.stringify(belegungAusGlb(MODELL, 'fixture').belegung)
  )
  schreibe('data/products.snapshot.json', fs.readFileSync(SNAPSHOT_PATH))
})
afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
})

describe('pruefeExport', () => {
  it('lässt einen sauberen Export durch', () => {
    expect(pruefe()).toEqual([])
  })

  it('lehnt einen Fixture-Build ab', () => {
    expect(pruefe({ [FIXTURE_ENV]: '1' })).toEqual([
      expect.stringMatching(/DIGITALE_BAECKEREI_FIXTURE ist gesetzt/),
    ])
    // Leer gesetzt zählt nicht als gesetzt.
    expect(pruefe({ [FIXTURE_ENV]: '' })).toEqual([])
  })

  it('lehnt einen Export für einen anderen Pfad ab', () => {
    schreibe('index.html', '<script src="/_next/static/chunks/main.js">')
    expect(pruefe()).toEqual([
      expect.stringMatching(/nicht für den Unterpfad \/digitale-baeckerei/),
    ])
  })

  it('meldet einen fehlenden Export', () => {
    fs.rmSync(path.join(outDir, 'index.html'))
    expect(pruefe()).toEqual([expect.stringMatching(/index\.html fehlt/)])
  })

  it('lehnt das unbereinigte Modell ab', () => {
    schreibe('model/twin.glb', QUELLE)
    expect(pruefe()).toEqual([
      expect.stringMatching(
        /model\/twin\.glb ist nicht die Datei aus dem Lock/
      ),
    ])
  })

  it('lehnt ein Modell mit Preisschildern ab, auch wenn das Lock es so nennt', () => {
    schreibe('model/twin.glb', QUELLE)
    const falsch = parseLock({
      ...lock,
      files: {
        'twin.glb': {
          ...lock.files['twin.glb'],
          ausgeliefert: lock.files['twin.glb'],
        },
      },
    })
    expect(pruefeExport({ outDir, lock: falsch, basePath: BASIS })).toEqual([
      expect.stringMatching(/enthält Preisschilder/),
    ])
  })

  it('verlangt die Prüfsumme der ausgelieferten Datei im Lock', () => {
    const ohne = parseLock({
      ...lock,
      files: {
        'twin.glb': {
          sha256: lock.files['twin.glb'].sha256,
          bytes: lock.files['twin.glb'].bytes,
        },
      },
    })
    expect(pruefeExport({ outDir, lock: ohne, basePath: BASIS })).toEqual([
      expect.stringMatching(/ausgeliefert für twin\.glb fehlt/),
    ])
  })

  it('lehnt fremde Dateien neben Modell und Daten ab', () => {
    schreibe('model/catalogue.json', '{}')
    schreibe('data/geheim.json', '{}')
    expect(pruefe()).toEqual([
      'model/catalogue.json steht nicht im Lock und darf nicht raus',
      'data/geheim.json gehört nicht in den Export',
    ])
  })

  it('lehnt ein fehlendes Modell ab', () => {
    fs.rmSync(path.join(outDir, 'model', 'twin.glb'))
    expect(pruefe()).toEqual(['model/twin.glb fehlt'])
  })

  it('lehnt einen Snapshot mit einem Feld außerhalb des Vertrags ab - ohne den Inhalt zu nennen', () => {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    const id = Object.keys(snapshot.produkte)[0]
    snapshot.produkte[id].geheimfeld = 'GEHEIMER-INHALT'
    schreibe('data/products.snapshot.json', JSON.stringify(snapshot))
    const fehler = pruefe()
    expect(fehler).toEqual([expect.stringMatching(/Feld "geheimfeld"/)])
    expect(fehler.join(' ')).not.toContain('GEHEIMER-INHALT')
  })

  it('lehnt einen Snapshot mit Produkten ab, die nicht im Modell liegen', () => {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    snapshot.produkte.zusatzbrot = {
      id: 'zusatzbrot',
      name: 'Zusatzbrot',
      kategorie: 'brot',
      kurztext: 'Liegt nicht im Laden.',
      text: '',
    }
    schreibe('data/products.snapshot.json', JSON.stringify(snapshot))
    expect(pruefe()).toEqual([
      expect.stringMatching(/1 Produkt\(e\), die nicht im Modell liegen/),
    ])
  })

  it('lehnt einen fehlenden Snapshot ab', () => {
    fs.rmSync(path.join(outDir, 'data', 'products.snapshot.json'))
    expect(pruefe()).toEqual([
      expect.stringMatching(/products\.snapshot\.json fehlt/),
    ])
  })

  it('findet ein Währungszeichen in jeder Datei des Exports und nennt nur den Dateinamen', () => {
    const zeichen = String.fromCharCode(0x20ac)
    schreibe('_next/static/chunks/seite.js', `var a="Testbrot 9${zeichen}"`)
    const fehler = pruefe()
    expect(fehler).toHaveLength(1)
    expect(fehler[0]).toMatch(/^_next\/static\/chunks\/seite\.js enthält/)
    expect(fehler[0]).not.toContain('Testbrot')
  })
})
