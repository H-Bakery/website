/**
 * B6: `cli.js import-partners` against a temp SQLite file (like the
 * create-user CLI tests). Synthetic store only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { main, parseArgs } from '../../src/cli'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import { Partner, PartnerVisit, initializeModels } from '../../src/models'

jest.setTimeout(30000)

const FIXTURE = path.resolve(
  __dirname,
  '../fixtures/partner-store.synthetic.json'
)

let dir: string
let out: string[]
const savedEnv = { ...process.env }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b6-import-'))
  process.env['DB_PATH'] = path.join(dir, 'import.db')
  out = []
  jest
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => void out.push(args.join(' ')))
  jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => void out.push(args.join(' ')))
})

afterEach(() => {
  jest.restoreAllMocks()
  process.env = { ...savedEnv }
  fs.rmSync(dir, { recursive: true, force: true })
})

async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  const { sequelize } = await openDatabase({ storage: process.env['DB_PATH']! })
  try {
    await runMigrations(sequelize, { log: () => undefined })
    await initializeModels(sequelize)
    return await fn()
  } finally {
    await sequelize.close()
  }
}

const visitCount = () => withDb(() => PartnerVisit.count())

describe('import-partners CLI', () => {
  it('parses --dry-run and --update-partners as flags without a value', () => {
    expect(
      parseArgs([
        'import-partners',
        '--file',
        'a.json',
        '--dry-run',
        '--update-partners',
      ])
    ).toEqual({
      command: 'import-partners',
      flags: { file: 'a.json', 'dry-run': 'true', 'update-partners': 'true' },
    })
    expect(() => parseArgs(['import-partners', '--dry-run=ja'])).toThrow(
      /nimmt keinen Wert/
    )
  })

  it('dry run, real run, second run - on a fresh database', async () => {
    expect(
      await main(['import-partners', '--file', FIXTURE, '--dry-run'])
    ).toBe(0)
    expect(out.join('\n')).toContain('Probelauf')
    expect(out.join('\n')).toContain('Besuche:  4 neu (6 Positionen)')
    expect(await visitCount()).toBe(0)

    out = []
    expect(await main(['import-partners', '--file', FIXTURE])).toBe(0)
    expect(out.join('\n')).toContain('Import abgeschlossen')
    expect(await visitCount()).toBe(4)
    // A fresh database has no seed: both partners come from the file.
    expect(
      await withDb(async () => (await Partner.findAll()).map((p) => p.slug))
    ).toEqual(['cap-markt-homburg-kirrberg', 'testmarkt-beispielstadt'])

    out = []
    expect(await main(['import-partners', '--file', FIXTURE])).toBe(0)
    expect(out.join('\n')).toContain(
      'Besuche:  0 neu (0 Positionen), 4 vorhanden'
    )
    expect(await visitCount()).toBe(4)
  })

  it('exit 2 and a list when entries were not imported', async () => {
    const store = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))
    store.visits.push({
      id: 9,
      partnerId: 1,
      businessDate: '2026-02-30',
      visitAt: '2026-03-01T06:00:00Z',
      visitType: 'refill',
      items: [],
    })
    const file = path.join(dir, 'store.json')
    fs.writeFileSync(file, JSON.stringify(store))
    expect(await main(['import-partners', '--file', file])).toBe(2)
    expect(out.join('\n')).toContain('Nicht übernommen (1)')
    expect(out.join('\n')).toContain('ungültiger Geschäftstag "2026-02-30"')
    expect(await visitCount()).toBe(4)
  })

  it('exit 1 and no database for a missing or broken file or a missing --file', async () => {
    expect(
      await main(['import-partners', '--file', path.join(dir, 'fehlt.json')])
    ).toBe(1)
    const broken = path.join(dir, 'kaputt.json')
    fs.writeFileSync(broken, '{"partners": [')
    expect(await main(['import-partners', '--file', broken])).toBe(1)
    expect(await main(['import-partners'])).toBe(1)
    expect(
      await main(['import-partners', '--file', FIXTURE, '--force', 'x'])
    ).toBe(1)
    expect(out.join('\n')).toContain('nicht gefunden')
    expect(out.join('\n')).toContain('kein gültiges JSON')
    expect(fs.existsSync(process.env['DB_PATH']!)).toBe(false)
  })

  it('exit 1 for JSON that is no partner store, before the database is opened', async () => {
    const file = path.join(dir, 'liste.json')
    fs.writeFileSync(file, '[]')
    expect(await main(['import-partners', '--file', file])).toBe(1)
    expect(out.join('\n')).toContain('kein Partner-Store')
    expect(fs.existsSync(process.env['DB_PATH']!)).toBe(false)
  })
})
