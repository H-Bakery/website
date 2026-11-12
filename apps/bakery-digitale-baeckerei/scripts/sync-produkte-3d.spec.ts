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
} from '../src/test/fixtures/fixture-info'
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

/** Ein erfundenes Daten-Repo mit einem Commit; liefert Commit und Lock-Datei. */
function datenRepo(inhalt: Record<string, Buffer>, lockInhalt = inhalt) {
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
      sha256: sha256Hex(data),
      bytes: data.byteLength,
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
    }
  }
  fs.writeFileSync(
    path.join(repo, 'manifest.json'),
    JSON.stringify({ version: 1, models })
  )
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
      modelle: Object.fromEntries(
        Object.entries(lockInhalt).map(([id, data]) => [
          id,
          { sha256: sha256Hex(data), bytes: data.byteLength },
        ])
      ),
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
    expect(modelle()).toEqual(['testbrot-500g.glb'])
    expect(
      fs
        .readFileSync(path.join(out, 'produkte-3d', 'testbrot-500g.glb'))
        .equals(fs.readFileSync(PRODUKT_GLB_PATH))
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

  it('bricht ab und schreibt nichts, wenn das Lock nicht zum Commit passt', () => {
    const { repo, lock } = datenRepo(
      { 'testbrot-500g': BROT },
      { 'testbrot-500g': WECK }
    )
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/passt nicht zum Lock|widersprechen/)
    expect(modelle()).toEqual([])
    expect(fs.existsSync(path.join(out, 'data', 'produkte-3d.json'))).toBe(
      false
    )
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
