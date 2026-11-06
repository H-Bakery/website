/**
 * B8: `cli.js import-deliveries` against a temp SQLite file (like the
 * import-partners CLI tests). Synthetic store only
 * (`tests/fixtures/delivery-store.synthetic.json`).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { main, parseArgs } from '../../src/cli'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import {
  AuditLog,
  DeliveryDepot,
  DeliveryDriver,
  DeliveryGeocache,
  DeliveryStop,
  DeliveryTour,
  initializeModels,
} from '../../src/models'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('../../src/services/delivery-import.core')

jest.setTimeout(30000)

const FIXTURE = path.resolve(
  __dirname,
  '../fixtures/delivery-store.synthetic.json'
)
const fixture = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf-8'))

let dir: string
let out: string[]
const savedEnv = { ...process.env }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b8-import-'))
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

const counts = () =>
  withDb(async () => ({
    drivers: await DeliveryDriver.count(),
    tours: await DeliveryTour.count(),
    stops: await DeliveryStop.count(),
    geocache: await DeliveryGeocache.count(),
  }))

describe('delivery-import.core', () => {
  it('plans drivers, tours, stops and cache, listing what does not fit', () => {
    const plan = core.planDeliveryImport(fixture())
    expect(plan.drivers.map((d: { key: string }) => d.key)).toEqual([
      'mock:driver:1',
      'mock:driver:2',
    ])
    expect(plan.drivers[0].data).toEqual({
      name: 'Testfahrer Eins',
      phone: '01700000001',
      vehicle: 'van',
      active: true,
    })
    expect(plan.tours.map((t: { key: string }) => t.key)).toEqual([
      'mock:tour:1:2026-09-12',
      'mock:tour:2:2026-09-19',
    ])
    const [first, second] = plan.tours
    expect(first.driverKey).toBe('mock:driver:1')
    expect(first.data).toMatchObject({
      status: 'done',
      isEstimate: false,
      distance: 42100,
      lastPosition: { lat: 49.3, lon: 7.39, accuracy: 9, speed: null },
    })
    expect(first.stops.map((s: { key: string }) => s.key)).toEqual([
      'mock:tour:1:2026-09-12:stop:1',
      'mock:tour:1:2026-09-12:stop:2',
      'mock:tour:1:2026-09-12:stop:3',
    ])
    expect(first.stops[0].data).toMatchObject({
      status: 'done',
      completedAt: '2026-09-12T05:10:00.000Z',
      geocodeSource: 'nominatim',
      geocodePrecision: 'house',
    })
    // (0, 0) is not a place: dropped, searched again on the next read
    expect(first.stops[2].data).toMatchObject({
      status: 'failed',
      failureReason: 'Nicht angetroffen',
      goodsDisposition: 'taken_back',
      lat: null,
      lon: null,
      geocodeSource: null,
    })
    expect(first.stops[1].data.pickupPointId).toBe('kindergarten-moersbach')
    expect(second.driverKey).toBeNull()
    expect(second.data.plannedStart).toBe('06:30')
    expect(second.stops).toHaveLength(1)
    expect(plan.geocache).toEqual([
      expect.objectContaining({ lat: 49.32, lon: 7.32, precision: 'house' }),
    ])
    expect(plan.problems).toHaveLength(5)
  })

  it('refuses a file that is not a delivery store', () => {
    expect(() => core.assertDeliveryStore([])).toThrow(/kein Liefer-Store/)
    expect(() => core.assertDeliveryStore({ drivers: [] })).toThrow(/tours/)
  })
})

describe('import-deliveries CLI', () => {
  it('parses --dry-run and --update-depot as flags', () => {
    expect(
      parseArgs([
        'import-deliveries',
        '--file',
        'x.json',
        '--dry-run',
        '--update-depot',
      ])
    ).toEqual({
      command: 'import-deliveries',
      flags: { file: 'x.json', 'dry-run': 'true', 'update-depot': 'true' },
    })
  })

  it('dry run computes everything and stores nothing', async () => {
    const code = await main([
      'import-deliveries',
      '--file',
      FIXTURE,
      '--dry-run',
    ])
    expect(code).toBe(2)
    expect(out.join('\n')).toContain('Probelauf')
    expect(await counts()).toEqual({
      drivers: 0,
      tours: 0,
      stops: 0,
      geocache: 0,
    })
  })

  it('imports once; a second run adds nothing', async () => {
    expect(await main(['import-deliveries', '--file', FIXTURE])).toBe(2)
    const report = out.join('\n')
    expect(report).toContain('Touren:  2 neu (4 Stopps)')
    expect(report).toContain('gibt-es-nicht')
    expect(report).toContain('weicht ab')
    expect(await counts()).toEqual({
      drivers: 2,
      tours: 2,
      stops: 4,
      geocache: 1,
    })

    await withDb(async () => {
      const tour = await DeliveryTour.findOne({
        where: { importKey: 'mock:tour:1:2026-09-12' },
      })
      expect(tour).toMatchObject({ status: 'done', isEstimate: false })
      const driver = await DeliveryDriver.findByPk(tour!.driverId!)
      expect(driver?.name).toBe('Testfahrer Eins')
      const stops = await DeliveryStop.findAll({
        where: { tourId: tour!.id },
        order: [['position', 'ASC']],
      })
      expect(stops.map((s) => s.customer)).toEqual([
        'Testkundin A',
        'Kindergarten Mörsbach',
        'Testkunde B',
      ])
      expect(stops[1].pickupPointId).toBe('kindergarten-moersbach')
      const unlinked = await DeliveryStop.findOne({
        where: { importKey: 'mock:tour:2:2026-09-19:stop:2' },
      })
      expect(unlinked?.pickupPointId).toBeNull()
      const audit = await AuditLog.findOne({
        where: { action: 'import', entity: 'delivery_store' },
      })
      expect(JSON.stringify(audit?.data)).not.toContain('Testkundin')
      // the depot stays without --update-depot
      expect((await DeliveryDepot.findByPk(1))?.street).not.toBe('Probeweg 1')
    })

    out = []
    expect(await main(['import-deliveries', '--file', FIXTURE])).toBe(2)
    expect(out.join('\n')).toContain('Touren:  0 neu (0 Stopps), 2 vorhanden')
    expect(await counts()).toEqual({
      drivers: 2,
      tours: 2,
      stops: 4,
      geocache: 1,
    })
  })

  it('--update-depot takes the depot from the file', async () => {
    expect(
      await main(['import-deliveries', '--file', FIXTURE, '--update-depot'])
    ).toBe(2)
    await withDb(async () => {
      expect((await DeliveryDepot.findByPk(1))?.street).toBe('Probeweg 1')
    })
  })

  it('a clean store exits 0; a broken file exits 1 before the database is opened', async () => {
    const clean = path.join(dir, 'clean.json')
    const store = fixture()
    store.drivers = store.drivers.slice(0, 2)
    store.tours = [store.tours[0]]
    fs.writeFileSync(clean, JSON.stringify(store))
    expect(await main(['import-deliveries', '--file', clean])).toBe(0)

    const broken = path.join(dir, 'broken.json')
    fs.writeFileSync(broken, '{"tours": 5}')
    const fresh = path.join(dir, 'fresh.db')
    process.env['DB_PATH'] = fresh
    expect(await main(['import-deliveries', '--file', broken])).toBe(1)
    expect(fs.existsSync(fresh)).toBe(false)
    expect(await main(['import-deliveries'])).toBe(1)
    expect(
      await main(['import-deliveries', '--file', broken, '--update-partners'])
    ).toBe(1)
  })
})
