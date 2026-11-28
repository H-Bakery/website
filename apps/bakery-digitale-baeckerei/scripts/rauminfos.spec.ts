import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  alsDatei,
  baueRauminfos,
  leereRauminfos,
  leseRaumYaml,
  leseVerzeichnis,
  pruefeRauminfos,
} from './rauminfos'

// Nur erfundene Stationen und Texte - die echten stehen in hq.
const YAML = `
infopunkte:
  - knoten: ofen/
    titel: Probeofen
    kurz: Ein erfundener Ofen.
    text: |
      Erster Absatz.

      Zweiter Absatz.
  - knoten: kneter
    titel: Probekneter
    kurz: "  Ein erfundener Kneter.  "
`

describe('leseRaumYaml', () => {
  it('liest Infopunkte: knoten ohne Schrägstrich am Ende, Texte ohne Rand, text nur wenn es einen gibt', () => {
    expect(leseRaumYaml(YAML, 'werkstatt.yaml')).toEqual({
      infopunkte: [
        {
          knoten: 'ofen',
          titel: 'Probeofen',
          kurz: 'Ein erfundener Ofen.',
          text: 'Erster Absatz.\n\nZweiter Absatz.',
        },
        {
          knoten: 'kneter',
          titel: 'Probekneter',
          kurz: 'Ein erfundener Kneter.',
        },
      ],
    })
  })

  it('eine leere Datei oder eine ohne Einträge heißt: keine Infopunkte', () => {
    expect(leseRaumYaml('', 'a.yaml')).toEqual({ infopunkte: [] })
    expect(leseRaumYaml('# nur ein Kommentar\n', 'a.yaml')).toEqual({
      infopunkte: [],
    })
    expect(leseRaumYaml('infopunkte: []\n', 'a.yaml')).toEqual({
      infopunkte: [],
    })
    expect(leseRaumYaml('{}', 'a.yaml')).toEqual({ infopunkte: [] })
  })

  it('ein leerer langer Text fällt weg', () => {
    const { infopunkte } = leseRaumYaml(
      'infopunkte:\n  - { knoten: ofen, titel: A, kurz: B, text: "  " }\n',
      'a.yaml'
    )
    expect(infopunkte).toEqual([{ knoten: 'ofen', titel: 'A', kurz: 'B' }])
  })

  it.each([
    ['kein YAML', 'infopunkte: [', /a\.yaml: kein gültiges YAML/],
    ['eine Liste statt eines Objekts', '- a\n', /kein Objekt/],
    ['fremdes Feld oben', 'preise: []\n', /unbekanntes Feld "preise"/],
    ['infopunkte ist keine Liste', 'infopunkte: 3\n', /muss eine Liste sein/],
    ['Eintrag ist kein Objekt', 'infopunkte: [x]\n', /\[0\] ist kein Objekt/],
    [
      'fremdes Feld im Eintrag',
      'infopunkte:\n  - { knoten: a, titel: A, kurz: B, preis: 3 }\n',
      /infopunkte\[0\]: unbekanntes Feld "preis"/,
    ],
    [
      'knoten fehlt',
      'infopunkte:\n  - { titel: A, kurz: B }\n',
      /knoten fehlt oder ist keine Knoten-ID/,
    ],
    [
      'knoten mit Großbuchstaben',
      'infopunkte:\n  - { knoten: Ofen, titel: A, kurz: B }\n',
      /keine Knoten-ID/,
    ],
    [
      'knoten mit ..',
      'infopunkte:\n  - { knoten: ../ofen, titel: A, kurz: B }\n',
      /keine Knoten-ID/,
    ],
    [
      'knoten doppelt (auch mit Schrägstrich)',
      'infopunkte:\n  - { knoten: ofen, titel: A, kurz: B }\n  - { knoten: ofen/, titel: C, kurz: D }\n',
      /infopunkte\[1\]: knoten steht doppelt/,
    ],
    ['titel fehlt', 'infopunkte:\n  - { knoten: a, kurz: B }\n', /titel fehlt/],
    [
      'kurz leer',
      'infopunkte:\n  - { knoten: a, titel: A, kurz: "" }\n',
      /kurz ist leer/,
    ],
    [
      'titel ist kein Text',
      'infopunkte:\n  - { knoten: a, titel: 3, kurz: B }\n',
      /titel muss Text sein/,
    ],
    [
      'titel zu lang',
      `infopunkte:\n  - { knoten: a, titel: ${'x'.repeat(81)}, kurz: B }\n`,
      /titel ist länger als 80 Zeichen/,
    ],
  ])('lehnt ab: %s', (_name, inhalt, meldung) => {
    expect(() => leseRaumYaml(inhalt, 'a.yaml')).toThrow(meldung)
  })

  it('keine Preise (DB8): ein Währungszeichen im Text ist ein Fehler - gemeldet ohne den Text', () => {
    const zeichen = String.fromCharCode(0x20ac)
    const lesen = () =>
      leseRaumYaml(
        `infopunkte:\n  - { knoten: a, titel: A, kurz: "GEHEIM 3 ${zeichen}" }\n`,
        'a.yaml'
      )
    expect(lesen).toThrow(/a\.yaml: infopunkte\[0\]: kurz enthält/)
    try {
      lesen()
    } catch (err) {
      expect(String(err)).not.toContain('GEHEIM')
    }
  })

  it('die Meldung eines YAML-Fehlers zitiert die Datei nicht', () => {
    try {
      leseRaumYaml('titel: "GEHEIMER-INHALT\n  x: [', 'a.yaml')
      throw new Error('hätte werfen müssen')
    } catch (err) {
      expect(String(err)).toBe('Error: a.yaml: kein gültiges YAML')
    }
  })
})

describe('baueRauminfos / pruefeRauminfos', () => {
  const werkstatt = leseRaumYaml(YAML, 'werkstatt.yaml')

  it('nimmt nur Räume mit Infopunkten auf', () => {
    expect(baueRauminfos({ werkstatt, laden: { infopunkte: [] } })).toEqual({
      version: 1,
      raeume: { werkstatt },
    })
    expect(baueRauminfos({})).toEqual(leereRauminfos())
  })

  it('lehnt eine Raum-id ab, die keine ist', () => {
    expect(() => baueRauminfos({ '../x': werkstatt })).toThrow(/Raum-id/)
  })

  it('schreibt die Datei immer gleich: eine Zeile JSON', () => {
    expect(alsDatei(leereRauminfos())).toBe('{"version":1,"raeume":{}}\n')
  })

  it('die fertige Datei besteht ihre eigene Prüfung', () => {
    const datei = JSON.parse(alsDatei(baueRauminfos({ werkstatt })))
    expect(pruefeRauminfos(datei)).toEqual(datei)
  })

  it.each([
    ['kein Objekt', null],
    ['falsche Version', { version: 2, raeume: {} }],
    ['raeume fehlt', { version: 1 }],
  ])('lehnt eine Datei ab: %s', (_name, raw) => {
    expect(() => pruefeRauminfos(raw)).toThrow(/nicht die erwartete Form/)
  })

  it('lehnt fremde Felder in der Datei ab', () => {
    expect(() =>
      pruefeRauminfos({ version: 1, raeume: {}, preise: {} })
    ).toThrow(/unbekanntes Feld "preise"/)
    expect(() =>
      pruefeRauminfos({
        version: 1,
        raeume: {
          werkstatt: {
            infopunkte: [{ knoten: 'a', titel: 'A', kurz: 'B', preis: 1 }],
          },
        },
      })
    ).toThrow(/rauminfos\.json: werkstatt: infopunkte\[0\]: unbekanntes Feld/)
  })
})

describe('leseVerzeichnis', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rauminfos-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('liest nur die Dateien der genannten Räume - andere bleiben liegen', () => {
    fs.writeFileSync(path.join(dir, 'werkstatt.yaml'), YAML)
    fs.writeFileSync(
      path.join(dir, 'keller.yaml'),
      'infopunkte:\n  - { knoten: fass, titel: Probefass, kurz: Nicht gebaut. }\n'
    )
    const { rauminfos, gelesen } = leseVerzeichnis(dir, ['laden', 'werkstatt'])
    expect(gelesen).toEqual(['werkstatt.yaml'])
    expect(Object.keys(rauminfos.raeume)).toEqual(['werkstatt'])
    expect(JSON.stringify(rauminfos)).not.toContain('Probefass')
  })

  it('ohne Ordner oder ohne Datei: keine Infopunkte, kein Fehler - nichts wird erfunden', () => {
    expect(leseVerzeichnis(path.join(dir, 'gibt-es-nicht'), ['laden'])).toEqual(
      { rauminfos: leereRauminfos(), gelesen: [] }
    )
    expect(leseVerzeichnis(dir, ['laden'])).toEqual({
      rauminfos: leereRauminfos(),
      gelesen: [],
    })
  })

  it('eine Datei außerhalb des Vertrags bricht ab und nennt die Datei', () => {
    fs.writeFileSync(path.join(dir, 'werkstatt.yaml'), 'infopunkte: 3\n')
    expect(() => leseVerzeichnis(dir, ['werkstatt'])).toThrow(
      /^werkstatt\.yaml: infopunkte muss eine Liste sein/
    )
  })

  it('eine Raum-id, die keine ist, liest nichts (kein Pfad aus dem Ordner hinaus)', () => {
    expect(leseVerzeichnis(dir, ['../geheim']).gelesen).toEqual([])
  })
})
