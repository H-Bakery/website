import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  EINRICHTEN_ENV,
  EINRICHTEN_SPUR,
  FIXTURE_ENV,
  TEST_SPUREN,
  pruefeExport,
} from './export-pruefung'
import { LOCK_FORMAT, parseLock, sha256Hex } from './model-lock'
import {
  REGAL_GLB_PATH,
  SNAPSHOT_PATH,
  ausgeliefertesModell,
  ladeFixture,
} from '../src/test/fixtures/fixture-info'
import { bauePaket } from '../src/test/fixtures/regal-fixture'
import { belegungAusGlb, fasseZusammen } from './belegung'
import { alsDatei, leereRauminfos } from './rauminfos'
import { leererIndex } from './produkte-3d-lock'

// Ein synthetischer Export aus den Fixtures - das echte Modell und echte
// Produkttexte liegen nie im Repo. Das „Lock“ hier beschreibt das Mini-Modell.
const BASIS = '/digitale-baeckerei'
const QUELLE = ladeFixture().glb
const MODELL = ausgeliefertesModell()

const SOURCE = {
  repo: 'beispiel/modell-daten',
  commit: '0123456789abcdef0123456789abcdef01234567',
  path: 'zones/testladen/built',
}
const LADEN = {
  datei: 'twin.glb',
  source: SOURCE,
  fetched: '2026-01-02',
  sha256: sha256Hex(QUELLE),
  bytes: QUELLE.byteLength,
  ausgeliefert: { sha256: sha256Hex(MODELL), bytes: MODELL.byteLength },
}
const lock = parseLock({ format: LOCK_FORMAT, raeume: { laden: LADEN } })
/** Ein zweiter Raum, wie er später im Lock stehen könnte (hier: das Testmodell). */
const WERKSTATT = ausgeliefertesModell('testbackstube')
const lockMitZweiRaeumen = parseLock({
  format: LOCK_FORMAT,
  raeume: {
    laden: LADEN,
    werkstatt: {
      datei: 'werkstatt.glb',
      source: SOURCE,
      fetched: '2026-01-02',
      sha256: sha256Hex(WERKSTATT),
      bytes: WERKSTATT.byteLength,
      ausgeliefert: {
        sha256: sha256Hex(WERKSTATT),
        bytes: WERKSTATT.byteLength,
      },
    },
  },
})
const belegungDatei = (raeume: Record<string, Uint8Array>) =>
  JSON.stringify(
    fasseZusammen(
      Object.fromEntries(
        Object.entries(raeume).map(([raum, glb]) => [
          raum,
          belegungAusGlb(glb, 'fixture').belegung,
        ])
      )
    )
  )

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
  schreibe('data/belegung.json', belegungDatei({ laden: MODELL }))
  // So schreibt sync-rauminfos die Datei, wenn es in hq keine Infopunkte gibt.
  schreibe('data/rauminfos.json', alsDatei(leereRauminfos()))
  schreibe('data/products.snapshot.json', fs.readFileSync(SNAPSHOT_PATH))
  // So schreibt sync-produkte-3d den Index, wenn es das Daten-Repo nicht gibt.
  schreibe('data/produkte-3d.json', `${JSON.stringify(leererIndex())}\n`)
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
      format: LOCK_FORMAT,
      raeume: {
        laden: {
          ...LADEN,
          ausgeliefert: { sha256: LADEN.sha256, bytes: LADEN.bytes },
        },
      },
    })
    expect(pruefeExport({ outDir, lock: falsch, basePath: BASIS })).toEqual([
      expect.stringMatching(/enthält Preisschilder/),
    ])
  })

  it('verlangt die Prüfsumme der ausgelieferten Datei im Lock', () => {
    const ohne = parseLock({
      format: LOCK_FORMAT,
      raeume: { laden: { ...LADEN, ausgeliefert: undefined } },
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

  it('lässt den leeren Index der Nahansicht und einen leeren Ordner durch', () => {
    fs.mkdirSync(path.join(outDir, 'produkte-3d'))
    expect(pruefe()).toEqual([])
  })

  it('lehnt 3D-Modelle einzelner Produkte ab - ohne ihre Namen zu nennen', () => {
    schreibe('produkte-3d/testbrot-500g.glb', ladeFixture().glb)
    schreibe(
      'data/produkte-3d.json',
      JSON.stringify({
        version: 1,
        modelle: {
          'testbrot-500g': {
            datei: 'produkte-3d/testbrot-500g.glb',
            bytes: 14580,
            bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] },
          },
        },
      })
    )
    const fehler = pruefe()
    expect(fehler).toEqual([
      expect.stringMatching(/^data\/produkte-3d\.json nennt 1 3D-Modell\(e\)/),
      expect.stringMatching(/^produkte-3d\/ enthält 1 Datei\(en\)/),
    ])
    expect(fehler.join(' ')).not.toContain('testbrot')
  })

  it('lehnt eine Modell-Datei ab, auch wenn der Index leer ist', () => {
    schreibe('produkte-3d/testbrot-500g.glb', ladeFixture().glb)
    expect(pruefe()).toEqual([
      expect.stringMatching(/^produkte-3d\/ enthält 1 Datei\(en\)/),
    ])
  })

  it('lehnt einen fehlenden oder unlesbaren Index der Nahansicht ab', () => {
    fs.rmSync(path.join(outDir, 'data', 'produkte-3d.json'))
    expect(pruefe()).toEqual([expect.stringMatching(/produkte-3d\.json fehlt/)])
    schreibe('data/produkte-3d.json', JSON.stringify({ version: 2 }))
    expect(pruefe()).toEqual([
      'data/produkte-3d.json hat nicht die erwartete Form',
    ])
  })

  describe('mehrere Räume', () => {
    const pruefeZwei = () =>
      pruefeExport({ outDir, lock: lockMitZweiRaeumen, basePath: BASIS })
    beforeEach(() => {
      schreibe('model/werkstatt.glb', WERKSTATT)
      schreibe(
        'data/belegung.json',
        belegungDatei({ laden: MODELL, werkstatt: WERKSTATT })
      )
    })

    it('lässt einen Export mit zwei Räumen aus dem Lock durch - mit Infopunkten', () => {
      schreibe(
        'data/rauminfos.json',
        alsDatei({
          version: 1,
          raeume: {
            werkstatt: {
              infopunkte: [
                { knoten: 'ofen', titel: 'Probeofen', kurz: 'Nur ein Test.' },
              ],
            },
          },
        })
      )
      expect(pruefeZwei()).toEqual([])
    })

    it('prüft das Modell jedes Raums: fehlt eines oder ist es ein anderes, darf nichts raus', () => {
      fs.rmSync(path.join(outDir, 'model', 'werkstatt.glb'))
      expect(pruefeZwei()).toEqual(['model/werkstatt.glb fehlt'])
      schreibe('model/werkstatt.glb', MODELL)
      expect(pruefeZwei()).toEqual([
        expect.stringMatching(
          /model\/werkstatt\.glb ist nicht die Datei aus dem Lock/
        ),
      ])
    })

    it('ein Raum, der nicht im Lock steht, darf nicht im Export liegen - weder Modell noch Daten', () => {
      // Derselbe Export gegen das Lock mit nur dem Laden.
      schreibe(
        'data/rauminfos.json',
        alsDatei({
          version: 1,
          raeume: {
            werkstatt: {
              infopunkte: [{ knoten: 'ofen', titel: 'Probeofen', kurz: 'x' }],
            },
          },
        })
      )
      expect(pruefe()).toEqual([
        'model/werkstatt.glb steht nicht im Lock und darf nicht raus',
        'data/belegung.json nennt 1 Raum/Räume, die nicht im Lock stehen',
        'data/rauminfos.json nennt 1 Raum/Räume, die nicht im Lock stehen',
      ])
    })
  })

  it('lehnt eine Belegung im alten Format ab', () => {
    schreibe(
      'data/belegung.json',
      JSON.stringify(belegungAusGlb(MODELL, 'fixture').belegung)
    )
    expect(pruefe()).toContain(
      'data/belegung.json hat nicht die erwartete Form'
    )
  })

  it('lehnt fehlende oder vertragswidrige Rauminfos ab - ohne den Inhalt zu nennen', () => {
    fs.rmSync(path.join(outDir, 'data', 'rauminfos.json'))
    expect(pruefe()).toEqual([expect.stringMatching(/rauminfos\.json fehlt/)])
    schreibe(
      'data/rauminfos.json',
      JSON.stringify({
        version: 1,
        raeume: {
          laden: {
            infopunkte: [
              {
                knoten: 'theke',
                titel: 'Probetheke',
                kurz: 'x',
                geheimfeld: 'GEHEIMER-INHALT',
              },
            ],
          },
        },
      })
    )
    const fehler = pruefe()
    expect(fehler).toEqual([expect.stringMatching(/Feld "geheimfeld"/)])
    expect(fehler.join(' ')).not.toContain('GEHEIMER-INHALT')
  })

  it('findet jede Spur der synthetischen Test-Räume - im Code, in den Daten, als Datei', () => {
    expect(TEST_SPUREN).toEqual(['testbackstube', 'Testbackstube'])
    schreibe('_next/static/chunks/seite.js', 'var r={id:"testbackstube"}')
    expect(pruefe()).toEqual([
      '_next/static/chunks/seite.js enthält einen synthetischen Test-Raum - den gibt es nur im Fixture-Build',
    ])
    schreibe('_next/static/chunks/seite.js', 'var n="Testbackstube"')
    expect(pruefe()).toHaveLength(1)
    schreibe('_next/static/chunks/seite.js', 'var n="Backstube"')
    expect(pruefe()).toEqual([])
    // Das Modell des Test-Raums unter seinem Namen: doppelt falsch.
    schreibe('model/testbackstube.glb', WERKSTATT)
    expect(pruefe()).toEqual([
      'model/testbackstube.glb steht nicht im Lock und darf nicht raus',
      'model/testbackstube.glb enthält einen synthetischen Test-Raum - den gibt es nur im Fixture-Build',
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

describe('pruefeExport: Einrichtung (DB12)', () => {
  const REGAL = fs.readFileSync(REGAL_GLB_PATH)
  const NAH = ladeFixture().glb
  /** Index mit der Nahansicht für ein Produkt und dem Paket der Regal-Modelle. */
  const indexMit = (
    regalModelle = bauePaket().regal.modelle,
    nahansicht: string[] = ['testbrot-500g']
  ) =>
    JSON.stringify({
      version: 1,
      modelle: Object.fromEntries(
        nahansicht.map((id) => [
          id,
          {
            datei: `produkte-3d/${id}.glb`,
            bytes: NAH.byteLength,
            bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] },
          },
        ])
      ),
      regal: {
        datei: 'produkte-3d/_regal.glb',
        bytes: REGAL.byteLength,
        modelle: regalModelle,
      },
    })
  const mit3d = () =>
    pruefeExport({ outDir, lock, basePath: BASIS, produkte3d: 'erlaubt' })

  it('lehnt den Einrichten-Modus ab: den Schalter, das Werkzeug im Code, seine Daten', () => {
    expect(pruefe({ [EINRICHTEN_ENV]: '1' })).toEqual([
      expect.stringMatching(/DIGITALE_BAECKEREI_EINRICHTEN ist gesetzt/),
    ])
    expect(pruefe({ [EINRICHTEN_ENV]: '' })).toEqual([])

    schreibe('_next/static/chunks/werkzeug.js', `children:"${EINRICHTEN_SPUR}"`)
    expect(pruefe()).toEqual([
      '_next/static/chunks/werkzeug.js enthält das Werkzeug des Einrichten-Modus - das gibt es nur lokal',
    ])
    fs.rmSync(path.join(outDir, '_next/static/chunks/werkzeug.js'))

    schreibe('data/einrichtung.quelle.yaml', 'raeume: {}\n')
    schreibe('data/einrichtung.modell.json', '{}')
    expect(pruefe()).toEqual([
      'data/einrichtung.modell.json gehört nicht in den Export',
      'data/einrichtung.quelle.yaml gehört nicht in den Export',
    ])
  })

  it('lässt eine Belegung mit Einrichtung durch: Version 3 mit leeren Plätzen und Rahmen', () => {
    const datei = JSON.parse(belegungDatei({ laden: MODELL }))
    const [erster, ...rest] = datei.raeume.laden.slots
    datei.raeume.laden.slots = rest
    datei.raeume.laden.leer = [erster.slot]
    datei.raeume.laden.plaetze = {
      [erster.slot]: {
        o: [0, 0, 0],
        r: [1, 0, 0],
        n: [0, 1, 0],
        f: [0, 0, 1],
        b: 0.2,
        t: 0.2,
        h: 0.2,
        art: 'reihen',
        neigung: 0,
      },
    }
    schreibe('data/belegung.json', JSON.stringify(datei))
    expect(pruefe()).toEqual([])
  })

  it('lehnt die alte Belegung (Version 2) ab', () => {
    const datei = JSON.parse(belegungDatei({ laden: MODELL }))
    schreibe('data/belegung.json', JSON.stringify({ ...datei, version: 2 }))
    expect(pruefe()).toContain(
      'data/belegung.json hat nicht die erwartete Form'
    )
  })

  it('ohne Freigabe (so läuft der Deploy): weder Regal-Modelle im Index noch das Paket im Ordner', () => {
    schreibe('data/produkte-3d.json', indexMit(undefined, []))
    schreibe('produkte-3d/_regal.glb', REGAL)
    const fehler = pruefe()
    expect(fehler).toEqual([
      expect.stringMatching(
        /^data\/produkte-3d\.json nennt 3 Regal-Modell\(e\) .* dürfen nicht raus$/
      ),
      expect.stringMatching(/^produkte-3d\/ enthält 1 Datei\(en\)/),
    ])
    // nur Zahlen, keine Produkt-ID
    expect(fehler.join(' ')).not.toContain('testbrot')
  })

  describe('mit Freigabe (produkte3d: erlaubt)', () => {
    beforeEach(() => {
      schreibe('data/produkte-3d.json', indexMit())
      schreibe('produkte-3d/_regal.glb', REGAL)
      schreibe('produkte-3d/testbrot-500g.glb', NAH)
    })

    it('lässt Nahansicht und Regal-Modelle durch, wenn Index, Ordner und Belegung zusammenpassen', () => {
      expect(mit3d()).toEqual([])
      // … ohne Freigabe bleibt derselbe Export verboten
      expect(pruefe().length).toBeGreaterThan(0)
    })

    it('auch der leere Index bleibt in Ordnung', () => {
      fs.rmSync(path.join(outDir, 'produkte-3d'), { recursive: true })
      schreibe('data/produkte-3d.json', `${JSON.stringify(leererIndex())}\n`)
      expect(mit3d()).toEqual([])
    })

    it('lehnt ab, was nicht im Index steht, fehlt oder eine andere Größe hat', () => {
      schreibe('produkte-3d/echtes-brot.glb', 'echt')
      expect(mit3d()).toEqual([
        'produkte-3d/echtes-brot.glb steht nicht im Index',
      ])
      fs.rmSync(path.join(outDir, 'produkte-3d/echtes-brot.glb'))
      fs.rmSync(path.join(outDir, 'produkte-3d/testbrot-500g.glb'))
      expect(mit3d()).toEqual(['produkte-3d/testbrot-500g.glb fehlt'])
      schreibe('produkte-3d/testbrot-500g.glb', 'kürzer')
      expect(mit3d()).toEqual([
        'produkte-3d/testbrot-500g.glb ist nicht so groß wie im Index',
      ])
    })

    it('lehnt ein Paket ab, das nicht genau die Regal-Modelle aus dem Index enthält', () => {
      const zwei = { ...bauePaket().regal.modelle }
      delete zwei.musterweck
      schreibe('data/produkte-3d.json', indexMit(zwei))
      expect(mit3d()).toEqual([
        'produkte-3d/_regal.glb enthält nicht genau die Regal-Modelle aus dem Index',
      ])
    })

    it('lehnt eine Datei ab, die kein Paket von Regal-Modellen ist', () => {
      schreibe('produkte-3d/_regal.glb', Buffer.alloc(REGAL.byteLength, 1))
      expect(mit3d()).toEqual([
        'produkte-3d/_regal.glb ist kein Paket von Regal-Modellen',
      ])
    })

    it('lehnt Modelle für Produkte ab, die in keinem Raum liegen', () => {
      const modelle = bauePaket().regal.modelle
      schreibe(
        'data/produkte-3d.json',
        indexMit({ ...modelle, 'nirgends-im-laden': modelle.musterweck }, [
          'testbrot-500g',
        ])
      )
      const fehler = mit3d()
      expect(fehler).toContain(
        'data/produkte-3d.json nennt 1 Modell(e) für Produkte, die in keinem Raum liegen'
      )
      expect(fehler.join(' ')).not.toContain('nirgends')
    })
  })
})
