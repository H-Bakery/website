/**
 * Das Sync-Skript als Ganzes, in einem Temp-Ordner (`--out`, `--index`): ohne
 * Daten-Repo, ohne Stand im Lock, mit dem Fixture und mit einem erfundenen
 * Daten-Repo (git) - nie mit echten Bildern und nie in public/ der App.
 */
import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SCRIPT = path.join(__dirname, 'sync-produktbilder.js')
const FIXTURES = path.join(
  __dirname,
  '..',
  'src',
  'test',
  'fixtures',
  'produktbilder'
)
const fixtureBild = (id: string, breite: number) =>
  fs.readFileSync(path.join(FIXTURES, 'bilder', id, `haupt-${breite}.webp`))
const SHA_MODELL = 'c'.repeat(64)

let tmp: string
let out: string
let indexPath: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-produktbilder-'))
  out = path.join(tmp, 'public')
  indexPath = path.join(tmp, 'produkte-3d-bilder.json')
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function sync(env: Record<string, string>, args: string[] = []) {
  const umgebung: NodeJS.ProcessEnv = { ...process.env, ...env }
  if (!('LANDING_PRODUKTBILDER_FIXTURE' in env)) {
    delete umgebung.LANDING_PRODUKTBILDER_FIXTURE
  }
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--out', out, '--index', indexPath, ...args],
    { env: umgebung, encoding: 'utf8' }
  )
  return { status: r.status, stdout: r.stdout, stderr: r.stderr }
}

const index = () => JSON.parse(fs.readFileSync(indexPath, 'utf8'))

/** Alle Dateien unter public/, relativ und sortiert. */
function dateien(dir = out, basis = out): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? dateien(path.join(dir, e.name), basis)
        : [path.relative(basis, path.join(dir, e.name))]
    )
    .sort()
}

function lockDatei(commit: string | null) {
  const lock = path.join(tmp, 'lock.json')
  fs.writeFileSync(
    lock,
    JSON.stringify({ quelle: 'lokal: ../produkte-3d', commit })
  )
  return lock
}

interface RepoInhalt {
  /** Bilddateien: Pfad im Repo -> Inhalt */
  bilder: Record<string, Buffer>
  index: unknown
  /** sha256 je Modell im Manifest */
  modelle: Record<string, string>
}

const testbrot = (): RepoInhalt => ({
  bilder: {
    'bilder/testbrot-500g/haupt-800.webp': fixtureBild(
      'musterbrot-hell-500g',
      800
    ),
    'bilder/testbrot-500g/haupt-400.webp': fixtureBild(
      'musterbrot-hell-500g',
      400
    ),
  },
  index: {
    version: 1,
    bilder: {
      'testbrot-500g': {
        modellSha256: SHA_MODELL,
        varianten: [
          {
            file: 'bilder/testbrot-500g/haupt-800.webp',
            ansicht: 'haupt',
            breite: 800,
            hoehe: 800,
          },
          {
            file: 'bilder/testbrot-500g/haupt-400.webp',
            ansicht: 'haupt',
            breite: 400,
            hoehe: 400,
          },
        ],
      },
    },
  },
  modelle: { 'testbrot-500g': SHA_MODELL },
})

/** Ein erfundenes Daten-Repo mit einem Commit; liefert Repo und Lock-Datei. */
function datenRepo(inhalt: RepoInhalt) {
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
  for (const [file, data] of Object.entries(inhalt.bilder)) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    fs.writeFileSync(path.join(repo, file), data)
  }
  fs.mkdirSync(path.join(repo, 'bilder'), { recursive: true })
  fs.writeFileSync(
    path.join(repo, 'bilder', 'index.json'),
    JSON.stringify(inhalt.index)
  )
  fs.writeFileSync(
    path.join(repo, 'manifest.json'),
    JSON.stringify({
      version: 2,
      models: Object.fromEntries(
        Object.entries(inhalt.modelle).map(([id, sha256]) => [id, { sha256 }])
      ),
    })
  )
  git('add', '-A')
  git('commit', '-q', '-m', 'Testbilder')
  const commit = git('rev-parse', 'HEAD').trim()
  // Danach das Arbeitsverzeichnis verändern: Gelesen wird der Commit.
  fs.writeFileSync(
    path.join(repo, 'bilder', 'index.json'),
    '{"version":1,"bilder":{}}'
  )
  return { repo, lock: lockDatei(commit) }
}

describe('sync-produktbilder ohne Daten-Repo (CI, Deploy, andere Rechner)', () => {
  it('schreibt einen leeren Index, keinen Ordner, eine Info-Zeile und endet mit 0', () => {
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') })
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(r.stdout.trim().split('\n')).toHaveLength(1)
    expect(r.stdout).toMatch(/INFO kein Daten-Repo/)
    expect(index()).toEqual({ version: 1, bilder: {} })
    // Nichts unter public/: Der Export hat keine Datei mehr als ohne das Skript.
    expect(dateien()).toEqual([])
    expect(fs.existsSync(path.join(out, 'produkte-3d'))).toBe(false)
  })

  it('räumt Bilder eines früheren Laufs weg und lässt den Rest von public/ in Ruhe', () => {
    fs.mkdirSync(path.join(out, 'produkte-3d', 'bilder', 'altes-brot'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(out, 'produkte-3d', 'bilder', 'altes-brot', 'haupt-800.webp'),
      'alt'
    )
    fs.writeFileSync(path.join(out, 'robots.txt'), 'bleibt')
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') })
    expect(r.status).toBe(0)
    expect(dateien()).toEqual(['robots.txt'])
  })

  it('braucht dafür kein Lock', () => {
    const r = sync({ PRODUKTE_3D_DIR: path.join(tmp, 'gibt-es-nicht') }, [
      '--lock',
      path.join(tmp, 'kein-lock.json'),
    ])
    expect(r.status).toBe(0)
  })
})

describe('sync-produktbilder mit commit: null im Lock', () => {
  it('schreibt einen leeren Index und endet mit 0, auch wenn das Daten-Repo da ist', () => {
    const { repo } = datenRepo(testbrot())
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lockDatei(null)])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/INFO .*noch keinen Stand/)
    expect(index()).toEqual({ version: 1, bilder: {} })
    expect(dateien()).toEqual([])
  })
})

describe('sync-produktbilder mit LANDING_PRODUKTBILDER_FIXTURE=1', () => {
  it('kopiert die synthetischen Bilder und ihren Index Byte für Byte', () => {
    fs.mkdirSync(path.join(out, 'produkte-3d', 'bilder', 'echtes-brot'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(out, 'produkte-3d', 'bilder', 'echtes-brot', 'haupt-800.webp'),
      'echt'
    )
    const r = sync({
      LANDING_PRODUKTBILDER_FIXTURE: '1',
      // Auch wenn ein Daten-Repo da wäre: Im Fixture-Modus zählt es nicht.
      PRODUKTE_3D_DIR: tmp,
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/FIXTURE/)
    expect(fs.readFileSync(indexPath)).toEqual(
      fs.readFileSync(path.join(FIXTURES, 'index.json'))
    )
    expect(dateien()).toEqual([
      'produkte-3d/bilder/musterbrezel/haupt-400.webp',
      'produkte-3d/bilder/musterbrezel/haupt-800.webp',
      'produkte-3d/bilder/musterbrot-hell-500g/haupt-400.webp',
      'produkte-3d/bilder/musterbrot-hell-500g/haupt-800.webp',
    ])
    expect(
      fs.readFileSync(
        path.join(out, 'produkte-3d/bilder/musterbrezel/haupt-400.webp')
      )
    ).toEqual(fixtureBild('musterbrezel', 400))
  })
})

describe('sync-produktbilder mit einem Daten-Repo', () => {
  it('liest den gesperrten Commit, prüft und schreibt Bilder und Index', () => {
    const { repo, lock } = datenRepo(testbrot())
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    // Der Index des Commits - nicht der leere aus dem Arbeitsverzeichnis.
    expect(index()).toEqual(testbrot().index)
    expect(dateien()).toEqual([
      'produkte-3d/bilder/testbrot-500g/haupt-400.webp',
      'produkte-3d/bilder/testbrot-500g/haupt-800.webp',
    ])
    expect(
      fs.readFileSync(
        path.join(out, 'produkte-3d/bilder/testbrot-500g/haupt-800.webp')
      )
    ).toEqual(fixtureBild('musterbrot-hell-500g', 800))
  })

  it('bricht ab, wenn ein Bild andere Maße hat als im Index, und schreibt nichts', () => {
    const inhalt = testbrot()
    inhalt.bilder['bilder/testbrot-500g/haupt-800.webp'] = fixtureBild(
      'musterbrot-hell-500g',
      400
    )
    const { repo, lock } = datenRepo(inhalt)
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/haupt-800\.webp: 400×400 Pixel/)
    expect(dateien()).toEqual([])
    expect(fs.existsSync(indexPath)).toBe(false)
  })

  it('bricht ab, wenn eine Datei kein WebP ist', () => {
    const inhalt = testbrot()
    inhalt.bilder['bilder/testbrot-500g/haupt-400.webp'] =
      Buffer.from('kein Bild')
    const { repo, lock } = datenRepo(inhalt)
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/keine WebP-Datei/)
    expect(dateien()).toEqual([])
  })

  it('bricht ab, wenn eine Datei aus dem Index im Commit fehlt', () => {
    const inhalt = testbrot()
    delete inhalt.bilder['bilder/testbrot-500g/haupt-400.webp']
    const { repo, lock } = datenRepo(inhalt)
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/haupt-400\.webp lässt sich nicht lesen/)
  })

  it('bricht ab, wenn das Bild von einem anderen Modell-Stand gerendert ist', () => {
    const inhalt = testbrot()
    inhalt.modelle['testbrot-500g'] = 'd'.repeat(64)
    const { repo, lock } = datenRepo(inhalt)
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/testbrot-500g: Das Bild ist nicht vom Modell/)
    expect(dateien()).toEqual([])
  })

  it('bricht ab, wenn der Index auf einen Pfad außerhalb von bilder/<id>/ zeigt', () => {
    const inhalt = testbrot()
    ;(
      inhalt.index as {
        bilder: Record<string, { varianten: { file: string }[] }>
      }
    ).bilder['testbrot-500g'].varianten[0].file =
      'bilder/testbrot-500g/../../manifest.webp'
    const { repo, lock } = datenRepo(inhalt)
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/ungültig/)
  })

  it('bricht ab, wenn der Commit aus dem Lock im Daten-Repo fehlt', () => {
    const { repo } = datenRepo(testbrot())
    const r = sync({ PRODUKTE_3D_DIR: repo }, [
      '--lock',
      lockDatei('0123456789abcdef0123456789abcdef01234567'),
    ])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/bilder\/index\.json am gesperrten Commit/)
  })

  it('bricht ab bei einem Branch-Namen im Lock', () => {
    const { repo } = datenRepo(testbrot())
    const lock = path.join(tmp, 'lock.json')
    fs.writeFileSync(lock, JSON.stringify({ quelle: 'lokal', commit: 'main' }))
    const r = sync({ PRODUKTE_3D_DIR: repo }, ['--lock', lock])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/voller Commit-Hash/)
  })
})

describe('das eingecheckte Lock', () => {
  it('ist gültig', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { parseBilderLock } = require('@bakery/shared/produkte-3d')
    const lock = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'produkte-3d-bilder.lock.json'),
        'utf8'
      )
    )
    expect(() => parseBilderLock(lock)).not.toThrow()
  })
})
