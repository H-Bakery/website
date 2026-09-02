/**
 * Atomares Schreiben und Quarantäne kaputter Dateien - der Schutz dafür, dass
 * ein Absturz mitten im Schreiben keine Backschrank-Besuche kostet.
 * Läuft gegen ein Temp-Verzeichnis und fasst `apps/bakery-api/data/` nicht an.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const jsonStore = require('../../src/services/json-store.core')

const STORE = { partners: [{ id: 1, name: 'CAP-Markt' }], visits: [{ id: 1 }] }

let dir
let file
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-store-'))
  file = path.join(dir, 'partner-store.json')
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

/** Simuliert einen Absturz mitten im Schreiben: nur die ersten 70 % bleiben. */
function truncate(target) {
  const bytes = fs.readFileSync(target)
  const kept = bytes.subarray(0, Math.floor(bytes.length * 0.7))
  fs.writeFileSync(target, kept)
  return kept
}

describe('writeJsonAtomic', () => {
  test('schreibt lesbares JSON und lässt keine .tmp-Datei zurück', () => {
    jsonStore.writeJsonAtomic(file, STORE)
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual(STORE)
    expect(fs.readdirSync(dir)).toEqual(['partner-store.json'])
  })

  test('legt ein fehlendes Verzeichnis an', () => {
    const nested = path.join(dir, 'data', 'store.json')
    jsonStore.writeJsonAtomic(nested, { ok: true })
    expect(JSON.parse(fs.readFileSync(nested, 'utf-8'))).toEqual({ ok: true })
  })

  test('ersetzt eine bestehende Datei vollständig, auch durch kürzeren Inhalt', () => {
    jsonStore.writeJsonAtomic(file, STORE)
    jsonStore.writeJsonAtomic(file, { visits: [] })
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual({ visits: [] })
  })
})

describe('readJsonOrQuarantine', () => {
  test('liest zurück, was writeJsonAtomic geschrieben hat', () => {
    jsonStore.writeJsonAtomic(file, STORE)
    expect(jsonStore.readJsonOrQuarantine(file)).toEqual({ data: STORE })
  })

  test('meldet eine fehlende Datei als missing, ohne etwas anzulegen', () => {
    expect(jsonStore.readJsonOrQuarantine(file)).toEqual({
      data: null,
      missing: true,
    })
    expect(fs.readdirSync(dir)).toEqual([])
  })

  test('verschiebt eine abgeschnittene Datei nach .corrupt-* statt sie liegen zu lassen', () => {
    jsonStore.writeJsonAtomic(file, STORE)
    const damaged = truncate(file)

    const read = jsonStore.readJsonOrQuarantine(file)

    expect(read.data).toBeNull()
    expect(read.missing).toBeUndefined()
    expect(read.reason).toMatch(/JSON/)
    expect(read.quarantine).toMatch(
      /partner-store\.json\.corrupt-\d{4}-\d{2}-\d{2}T/
    )
    // Die kaputte Datei ist weg, die Bytes liegen unverändert in der Quarantäne.
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.readFileSync(read.quarantine)).toEqual(damaged)
  })

  test('ein Speichern nach der Quarantäne lässt die verschobene Kopie unangetastet', () => {
    jsonStore.writeJsonAtomic(file, STORE)
    const damaged = truncate(file)
    const { quarantine } = jsonStore.readJsonOrQuarantine(file)

    // So macht es der Server: kaputt -> Seed -> beim nächsten Request speichern.
    jsonStore.writeJsonAtomic(file, { partners: [], visits: [] })

    expect(fs.readFileSync(quarantine)).toEqual(damaged)
    expect(jsonStore.readJsonOrQuarantine(file)).toEqual({
      data: { partners: [], visits: [] },
    })
    expect(fs.readdirSync(dir).sort()).toEqual(
      ['partner-store.json', path.basename(quarantine)].sort()
    )
  })

  test('eine leere Datei gilt ebenfalls als kaputt', () => {
    fs.writeFileSync(file, '')
    const read = jsonStore.readJsonOrQuarantine(file)
    expect(read.data).toBeNull()
    expect(fs.existsSync(read.quarantine)).toBe(true)
  })

  test('wirft andere Lesefehler durch und verschiebt dabei nichts', () => {
    // Ein Verzeichnis statt einer Datei: kein Parse-Fehler, sondern EISDIR.
    fs.mkdirSync(file)
    expect(() => jsonStore.readJsonOrQuarantine(file)).toThrow()
    expect(fs.readdirSync(dir)).toEqual(['partner-store.json'])
  })
})

describe('quarantinePath', () => {
  test('hängt einen dateinamentauglichen Zeitstempel an', () => {
    const at = new Date('2026-09-02T15:07:00.405Z')
    expect(jsonStore.quarantinePath('/x/store.json', at)).toBe(
      '/x/store.json.corrupt-2026-09-02T15-07-00-405Z'
    )
  })
})
