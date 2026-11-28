/**
 * Das Sync-Skript als Ganzes, in einem Temp-Ordner (`--out`): ohne Daten-Repo,
 * mit dem Fixture und mit einem erfundenen Daten-Repo (git) - nie mit den
 * echten Modellen und nie in public/ der App.
 */
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  PRODUKT_GLB_PATH,
  PRODUKT_INDEX_PATH,
  REGAL_GLB_PATH,
} from '../src/test/fixtures/fixture-info'
import { FORMEN, baueRegal } from '../src/test/fixtures/regal-fixture'
import { lesePaket } from './regal-modelle'
import { sha256Hex } from './model-lock'

const SCRIPT = path.join(__dirname, 'sync-produkte-3d.mjs')

let tmp: string
let out: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-produkte-3d-'))
  out = path.join(tmp, 'public')
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function sync(env: Record<string, string>, args: string[] = []) {
  const umgebung: NodeJS.ProcessEnv = { ...process.env, ...env }
  if (!('DIGITALE_BAECKEREI_FIXTURE' in env)) {
    delete umgebung.DIGITALE_BAECKEREI_FIXTURE
  }
  const r = spawnSync(process.execPath, [SCRIPT, '--out', out, ...args], {
    env: umgebung,
    encoding: 'utf8',
  })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr }
}

const index = () =>
  JSON.parse(
    fs.readFileSync(path.join(out, 'data', 'produkte-3d.json'), 'utf8')
  )
const modelle = () => {
  const dir = path.join(out, 'produkte-3d')
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

/**
 * Ein erfundenes Daten-Repo mit einem Commit; liefert Repo und Lock-Datei.
 * Das Lock nennt keine Modelle - nur Commit und Prüfsumme des Manifests.
 * `imManifest`: wofür das Manifest die Prüfsummen nennt (sonst der Inhalt).
 */
function datenRepo(inhalt: Record<string, Buffer>, imManifest = inhalt) {
  const repo = path.join(tmp, 'produkte-3d')
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-C',
        repo,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  fs.mkdirSync(repo, { recursive: true })
  git('init', '-q')
  const models: Record<string, unknown> = {}
  for (const [id, data] of Object.entries(inhalt)) {
    fs.mkdirSync(path.join(repo, 'models', id), { recursive: true })
    fs.writeFileSync(path.join(repo, 'models', id, 'model.glb'), data)
    models[id] = {
      file: `models/${id}/model.glb`,
      sha256: sha256Hex(imManifest[id]),
      bytes: imManifest[id].byteLength,
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
    }
  }
  const manifest = JSON.stringify({ version: 1, models })
  fs.writeFileSync(path.join(repo, 'manifest.json'), manifest)
  git('add', '-A')
  git('commit', '-q', '-m', 'Testmodelle')
  const commit = git('rev-parse', 'HEAD').trim()
  // Danach das Arbeitsverzeichnis verändern: Gelesen wird der Commit.
  fs.writeFileSync(
    path.join(repo, 'manifest.json'),
    '{"version":1,"models":{}}'
  )
  const lock = path.join(tmp, 'lock.json')
  fs.writeFileSync(
    lock,
    JSON.stringify({
      quelle: 'lokal: ../produkte-3d',
      commit,
      manifest: { sha256: sha256Hex(Buffer.from(manifest)) },
    })
  )
  return { repo, lock }
}

describe('sync-produkte-3d ohne Daten-Repo (CI, Deploy, andere Rechner)', () => {
  it('schreibt einen leeren Index, eine Info-Zeile und endet mit 0', () => {
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') })
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toHaveLength(1)
    expect(r.stdout).toMatch(/INFO kein Daten-Repo/)
    expect(index()).toEqual({ version: 1, modelle: {} })
    expect(modelle()).toEqual([])
  })

  it('räumt Modelle eines früheren Laufs weg', () => {
    fs.mkdirSync(path.join(out, 'produkte-3d'), { recursive: true })
    fs.writeFileSync(path.join(out, 'produkte-3d', 'altes-brot.glb'), 'alt')
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') })
    expect(r.status).toBe(0)
    expect(modelle()).toEqual([])
    expect(index()).toEqual({ version: 1, modelle: {} })
  })
})

describe('sync-produkte-3d mit DIGITALE_BAECKEREI_FIXTURE=1', () => {
  it('kopiert das synthetische Modell und seinen Index Byte für Byte', () => {
    fs.mkdirSync(path.join(out, 'produkte-3d'), { recursive: true })
    fs.writeFileSync(path.join(out, 'produkte-3d', 'echtes-brot.glb'), 'echt')
    const r = sync({
      DIGITALE_BAECKEREI_FIXTURE: '1',
      // Auch wenn ein Daten-Repo da wäre: Im Fixture-Modus zählt es nicht.
      PRODUKTE_3D_DIR: tmp,
    })
    expect(r.status).toBe(0)
    expect(modelle()).toEqual(['_regal.glb', 'testbrot-500g.glb'])
    expect(
      fs
        .readFileSync(path.join(out, 'produkte-3d', 'testbrot-500g.glb'))
        .equals(fs.readFileSync(PRODUKT_GLB_PATH))
    ).toBe(true)
    // Regal-Modelle (DB12): das synthetische Paket, Byte für Byte.
    expect(
      fs
        .readFileSync(path.join(out, 'produkte-3d', '_regal.glb'))
        .equals(fs.readFileSync(REGAL_GLB_PATH))
    ).toBe(true)
    expect(
      fs
        .readFileSync(path.join(out, 'data', 'produkte-3d.json'))
        .equals(fs.readFileSync(PRODUKT_INDEX_PATH))
    ).toBe(true)
  })
})

describe('sync-produkte-3d mit einem Daten-Repo', () => {
  const BROT = Buffer.from('kein echtes glb, nur ein Testbrot')
  const WECK = Buffer.from('kein echtes glb, nur ein Testweck')

  it('liest genau den gesperrten Commit, prüft und schreibt Modelle und Index', () => {
    const { repo, lock } = datenRepo({ 'testbrot-500g': BROT, testweck: WECK })
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(modelle()).toEqual(['testbrot-500g.glb', 'testweck.glb'])
    expect(
      fs
        .readFileSync(path.join(out, 'produkte-3d', 'testweck.glb'))
        .equals(WECK)
    ).toBe(true)
    expect(index()).toEqual({
      version: 1,
      modelle: {
        'testbrot-500g': {
          datei: 'produkte-3d/testbrot-500g.glb',
          bytes: BROT.byteLength,
          bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
        },
        testweck: {
          datei: 'produkte-3d/testweck.glb',
          bytes: WECK.byteLength,
          bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
        },
      },
    })
  })

  it('das Lock nennt kein Produkt - und der Sync findet trotzdem alle Modelle des Commits', () => {
    const { repo, lock } = datenRepo({ 'testbrot-500g': BROT, testweck: WECK })
    const text = fs.readFileSync(lock, 'utf8')
    expect(text).not.toMatch(/testbrot|testweck|modelle/)
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      'commit',
      'manifest',
      'quelle',
    ])
    expect(sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock]).status).toBe(0)
    expect(modelle()).toEqual(['testbrot-500g.glb', 'testweck.glb'])
  })

  it('bricht ab und schreibt nichts, wenn das Manifest des Commits nicht das aus dem Lock ist', () => {
    const { repo, lock } = datenRepo({ 'testbrot-500g': BROT })
    const anders = JSON.parse(fs.readFileSync(lock, 'utf8'))
    anders.manifest.sha256 = 'f'.repeat(64)
    fs.writeFileSync(lock, JSON.stringify(anders))
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(
      /manifest\.json am gesperrten Commit passt nicht zum Lock/
    )
    expect(modelle()).toEqual([])
    expect(fs.existsSync(path.join(out, 'data', 'produkte-3d.json'))).toBe(
      false
    )
  })

  it('bricht ab und schreibt nichts, wenn ein Modell nicht zur Prüfsumme im Manifest passt', () => {
    const { repo, lock } = datenRepo(
      { 'testbrot-500g': BROT, testweck: WECK },
      { 'testbrot-500g': BROT, testweck: BROT }
    )
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/testweck: .*model\.glb passt nicht zum Manifest/)
    expect(modelle()).toEqual([])
    expect(fs.existsSync(path.join(out, 'data', 'produkte-3d.json'))).toBe(
      false
    )
  })

  it('lehnt ein Lock mit einer Liste von Modellen ab', () => {
    const { repo, lock } = datenRepo({ 'testbrot-500g': BROT })
    const alt = JSON.parse(fs.readFileSync(lock, 'utf8'))
    alt.modelle = { 'testbrot-500g': { sha256: 'a'.repeat(64), bytes: 5 } }
    fs.writeFileSync(lock, JSON.stringify(alt))
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Feld "modelle" gehört nicht ins Lock/)
  })

  it('bricht ab, wenn es den gesperrten Commit dort nicht gibt', () => {
    const { repo, lock } = datenRepo({ 'testbrot-500g': BROT })
    const kaputt = JSON.parse(fs.readFileSync(lock, 'utf8'))
    kaputt.commit = '0123456789abcdef0123456789abcdef01234567'
    fs.writeFileSync(lock, JSON.stringify(kaputt))
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(modelle()).toEqual([])
  })
})

describe('sync-produkte-3d: Regal-Modelle (Manifest Version 2, DB12)', () => {
  const NAH = Buffer.from('kein echtes glb, nur eine Nahansicht')
  const [BREZEL, WECK, BROT] = FORMEN
  const PLATZ = {
    o: [0, 1, 0],
    r: [1, 0, 0],
    n: [0, 1, 0],
    f: [0, 0, 1],
    b: 0.45,
    t: 0.12,
    h: 0.2,
    art: 'reihen',
    neigung: 0,
  }

  /** Ein erfundenes Daten-Repo mit Manifest Version 2: je Produkt Nahansicht und Regal-Modell. */
  function repoV2(formen: typeof FORMEN, verfaelscht?: string) {
    const repo = path.join(tmp, 'produkte-3d')
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        [
          '-C',
          repo,
          '-c',
          'user.name=Test',
          '-c',
          'user.email=test@example.invalid',
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
    fs.mkdirSync(repo, { recursive: true })
    git('init', '-q')
    const models: Record<string, unknown> = {}
    for (const form of formen) {
      const dir = path.join(repo, 'models', form.id)
      fs.mkdirSync(dir, { recursive: true })
      const regal = baueRegal(form)
      fs.writeFileSync(path.join(dir, 'model.glb'), NAH)
      fs.writeFileSync(path.join(dir, 'regal.glb'), regal)
      models[form.id] = {
        file: `models/${form.id}/model.glb`,
        sha256: sha256Hex(NAH),
        bytes: NAH.byteLength,
        triangles: 12000,
        bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
        source: 'prozedural',
        familie: 'testform',
        abgenommen: false,
        regal: {
          file: `models/${form.id}/regal.glb`,
          sha256: verfaelscht === form.id ? 'f'.repeat(64) : sha256Hex(regal),
          bytes: regal.byteLength,
          triangles: 14,
        },
      }
    }
    const manifest = JSON.stringify({ version: 2, models })
    fs.writeFileSync(path.join(repo, 'manifest.json'), manifest)
    git('add', '-A')
    git('commit', '-q', '-m', 'Testmodelle')
    const lock = path.join(tmp, 'lock.json')
    fs.writeFileSync(
      lock,
      JSON.stringify({
        quelle: 'lokal: ../produkte-3d',
        commit: git('rev-parse', 'HEAD').trim(),
        manifest: { sha256: sha256Hex(Buffer.from(manifest)) },
      })
    )
    return { repo, lock }
  }

  /** `data/belegung.json`, wie sync-model sie schreibt. */
  function belegung(slots: Record<string, unknown>[]) {
    fs.mkdirSync(path.join(out, 'data'), { recursive: true })
    fs.writeFileSync(
      path.join(out, 'data', 'belegung.json'),
      JSON.stringify({
        version: 3,
        raeume: {
          laden: {
            quelle: { commit: 'x' },
            slots,
            leer: [],
            plaetze: Object.fromEntries(slots.map((s) => [s.slot, PLATZ])),
          },
        },
      })
    )
  }
  const paket = () =>
    lesePaket(fs.readFileSync(path.join(out, 'produkte-3d', '_regal.glb')))

  it('liefert Regal-Modelle und Nahansicht nur für Produkte, die in einem Raum liegen - alle Regal-Modelle in einem Paket', () => {
    const { repo, lock } = repoV2([BREZEL, WECK, BROT])
    belegung([
      { slot: 'regal/platz-01', produkt: BROT.id, anzahl: 2 },
      { slot: 'regal/platz-02', produkt: WECK.id, anzahl: 3 },
    ])
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(modelle()).toEqual([
      '_regal.glb',
      'musterweck.glb',
      'testbrot-500g.glb',
    ])
    expect(Object.keys(paket())).toEqual(['musterweck', 'testbrot-500g'])
    const i = index()
    expect(i.version).toBe(1)
    expect(Object.keys(i.modelle)).toEqual(['musterweck', 'testbrot-500g'])
    expect(i.regal.datei).toBe('produkte-3d/_regal.glb')
    expect(i.regal.bytes).toBe(
      fs.statSync(path.join(out, 'produkte-3d', '_regal.glb')).size
    )
    expect(i.regal.modelle['testbrot-500g']).toEqual({
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.0765, 0.05] },
      dreiecke: 14,
    })
    expect(r.stdout).toMatch(/2 Regal-Modelle/)
    expect(r.stdout).toMatch(/jede Stückzahl passt/)
  })

  it('meldet, wo eine Stückzahl nicht passt und wo ein eingerichtetes Produkt kein Regal-Modell hat - und baut trotzdem', () => {
    const { repo, lock } = repoV2([BROT])
    belegung([
      { slot: 'regal/platz-01', produkt: BROT.id, anzahl: 5 },
      {
        slot: 'regal/platz-02',
        produkt: 'testkuchen',
        anzahl: 1,
        quelle: 'einrichtung',
      },
      // aus dem Modell, ohne Regal-Modell: kein Hinweis (die Ware des Modells bleibt)
      { slot: 'regal/platz-03', produkt: 'testtorte', anzahl: 1 },
    ])
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(0)
    expect(r.stderr).toMatch(
      /HINWEIS Raum laden, regal\/platz-01: testbrot-500g × 5 - nur 2 von 5 passen/
    )
    expect(r.stderr).toMatch(
      /HINWEIS Raum laden, regal\/platz-02: für testkuchen gibt es kein Regal-Modell/
    )
    expect(r.stderr).not.toMatch(/testtorte/)
    expect(Object.keys(paket())).toEqual(['testbrot-500g'])
  })

  it('liegt kein Produkt mit Regal-Modell in einem Raum, gibt es kein Paket - der Index bleibt ohne „regal“', () => {
    const { repo, lock } = repoV2([BROT])
    belegung([{ slot: 'regal/platz-01', produkt: 'testtorte', anzahl: 1 }])
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(0)
    expect(modelle()).toEqual([])
    expect(index()).toEqual({ version: 1, modelle: {} })
  })

  it('Einrichten-Modus: die Regal-Modelle aller Produkte, die Nahansicht nur für die gelegten', () => {
    const { repo, lock } = repoV2([BREZEL, WECK, BROT])
    belegung([{ slot: 'regal/platz-01', produkt: BROT.id, anzahl: 1 }])
    const r = sync(
      { PRODUKTE_3D_DIR: repo, DIGITALE_BAECKEREI_EINRICHTEN: '1' },
      ['--lock', lock]
    )
    expect(r.status).toBe(0)
    expect(Object.keys(paket())).toEqual([
      'musterbrezel',
      'musterweck',
      'testbrot-500g',
    ])
    expect(Object.keys(index().modelle)).toEqual(['testbrot-500g'])
  })

  it('bricht ab und schreibt nichts, wenn ein Regal-Modell nicht zur Prüfsumme im Manifest passt', () => {
    const { repo, lock } = repoV2([BROT], BROT.id)
    belegung([{ slot: 'regal/platz-01', produkt: BROT.id, anzahl: 1 }])
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/regal\.glb passt nicht zum Manifest/)
    expect(modelle()).toEqual([])
    expect(fs.existsSync(path.join(out, 'data', 'produkte-3d.json'))).toBe(
      false
    )
  })

  it('ohne Daten-Repo bleibt es beim leeren Index - auch mit Belegung (so baut der Deploy)', () => {
    belegung([{ slot: 'regal/platz-01', produkt: BROT.id, anzahl: 1 }])
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') })
    expect(r.status).toBe(0)
    expect(
      fs.readFileSync(path.join(out, 'data', 'produkte-3d.json'), 'utf8')
    ).toBe('{"version":1,"modelle":{}}\n')
    expect(modelle()).toEqual([])
  })
})
