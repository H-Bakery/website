/**
 * Kalender-Loader und CLI `scripts/validate-kalender.js` (U9, vom hq-CI
 * übernommen). Erfundene Einträge in einem Temp-Verzeichnis.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const loader = require('../../src/services/kalender.loader')
const kalender = require('../../src/services/kalender.core')
const cli = require('../../scripts/validate-kalender')
const { configV2 } = require('../fixtures/backzettel.synthetic')

const yamlList = (year) =>
  kalender
    .holidaysSaarland(year)
    .map((h) => `    - { datum: ${h.date}, name: ${JSON.stringify(h.name)} }`)
    .join('\n')

const VALID = `version: 1
bundesland: saarland
feiertage:
  2026:
${yamlList(2026)}
  2027:
${yamlList(2027)}
tage:
  - { von: 2027-01-02, bis: 2027-01-03, typ: geschlossen, notiz: Testferien }
  - { datum: 2026-12-21, typ: sonderoeffnung, wie: 2, offen_bis: "12:30", notiz: Testöffnung }
`

let dir
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kalender-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const write = (name, text) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, text)
  return file
}

function quietly(fn) {
  const out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    return fn()
  } finally {
    out.mockRestore()
  }
}

describe('loadKalender', () => {
  it('liest YAML mit Datum als Text (CORE_SCHEMA) und normalisiert', () => {
    const r = loader.loadKalender(write('kalender.yaml', VALID))
    expect(r.status).toBe('ok')
    expect(r.errors).toEqual([])
    expect(r.calendar.years).toEqual([2026, 2027])
    expect(r.calendar.entries[1]).toMatchObject({
      from: '2026-12-21',
      to: '2026-12-21',
      type: 'sonderoeffnung',
      wie: 2,
      openUntil: '12:30',
      note: 'Testöffnung',
    })
  })

  it('fehlt die Datei: missing; kaputtes YAML: invalid', () => {
    expect(loader.loadKalender(path.join(dir, 'fehlt.yaml'))).toMatchObject({
      status: 'missing',
      calendar: null,
    })
    const r = loader.loadKalender(write('kalender.yaml', 'tage: [kaputt'))
    expect(r.status).toBe('invalid')
    expect(r.errors[0].message).toMatch(/YAML lässt sich nicht lesen/)
  })
})

describe('validate-kalender.js', () => {
  it('Exit 0 für einen gültigen Kalender, 1 bei Fehlern, 2 ohne Datei', () => {
    write('backzettel.yaml', JSON.stringify(configV2()))
    expect(quietly(() => cli.main([path.join(dir, 'kalender.yaml')]))).toBe(0)
    write('kalender.yaml', VALID)
    expect(quietly(() => cli.main([path.join(dir, 'kalender.yaml')]))).toBe(0)
    write(
      'kalender.yaml',
      VALID.replace('wie: 2', 'wie: 1') // Montag ist kein Produktionstag
    )
    expect(quietly(() => cli.main([path.join(dir, 'kalender.yaml')]))).toBe(1)
    const err = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    expect(cli.main([])).toBe(2)
    err.mockRestore()
  })

  it('--json nennt Status, Jahre und Einträge', () => {
    const file = write('kalender.yaml', VALID)
    let out = ''
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((s) => ((out += s), true))
    cli.main([file, '--json'])
    spy.mockRestore()
    expect(JSON.parse(out)).toMatchObject({
      ok: true,
      status: 'ok',
      years: [2026, 2027],
      entries: 2,
    })
  })
})
