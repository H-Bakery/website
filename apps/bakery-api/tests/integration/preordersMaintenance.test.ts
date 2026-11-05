/**
 * B7 import of the mock store and P4 anonymisation - as functions on an
 * in-memory database and through the CLI (`import-preorders`,
 * `anonymize-preorders`) on a temp SQLite file. Synthetic data only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { main } from '../../src/cli'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import {
  AuditLog,
  initializeModels,
  PickupPoint,
  Preorder,
  PreorderItem,
} from '../../src/models'
import {
  anonymizePreorders,
  importDeliveryStore,
} from '../../src/services/preorders-maintenance'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

jest.setTimeout(30000)

const MOERSBACH = 'kindergarten-moersbach'

function legacy(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: n,
    reference: `MO-2026-08-01-${String(n).padStart(2, '0')}`,
    pickupPointId: MOERSBACH,
    date: '2026-08-01',
    customer: `Testkunde ${n}`,
    phone: '0170 000000' + n,
    items: [
      {
        productId: 'musterweck',
        name: 'Musterweck',
        qty: n,
        unit: 'Stück',
        unitPrice: 0.45,
        lineTotal: 0.45 * n,
      },
    ],
    total: 0.45 * n,
    note: n === 1 ? 'ruft vorher an' : null,
    status: 'open',
    handedOverAt: null,
    createdAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z',
    ...extra,
  }
}

const STORE = {
  depot: { name: 'Testdepot' },
  pickupPoints: [
    {
      id: MOERSBACH,
      name: 'Kindergarten Mörsbach',
      street: 'Höhenstraße 24',
      zip: '66482',
      city: 'Zweibrücken-Mörsbach',
      weekday: 6,
      window: '09:00-09:30',
      orderDeadline: { weekday: 5, time: '12:00' },
      active: true,
    },
    {
      id: 'testkita-nord',
      name: 'Testkita Nord',
      street: '',
      zip: '',
      city: 'Teststadt-Nord',
      weekday: 6,
      window: null,
      orderDeadline: null,
      active: true,
    },
  ],
  preorders: [
    legacy(1, {
      status: 'handed_over',
      handedOverAt: '2026-08-01T07:05:00.000Z',
    }),
    legacy(2, { status: 'cancelled' }),
    legacy(3, { status: 'not_collected' }),
    legacy(4),
    legacy(5, { pickupPointId: 'unbekannt' }),
    legacy(6, { items: [] }),
    {
      ...legacy(7),
      pickupPointId: 'testkita-nord',
      reference: 'NO-2026-08-01-01',
    },
  ],
  tours: [],
}

describe('import + anonymise (functions)', () => {
  let api: TestApp

  beforeAll(async () => {
    api = await createTestApp()
  })
  afterAll(() => api.close())

  it('dry run reports but writes nothing', async () => {
    const report = await importDeliveryStore(STORE, { dryRun: true })
    expect(report).toMatchObject({
      dryRun: true,
      pickupPoints: { created: ['testkita-nord'], existing: [MOERSBACH] },
    })
    expect(report.imported).toHaveLength(5)
    expect(await Preorder.count()).toBe(0)
    expect(await PickupPoint.count()).toBe(1)
    expect(await AuditLog.count()).toBe(0)
  })

  it('imports, maps statuses, keeps snapshots and is idempotent', async () => {
    const report = await importDeliveryStore(STORE)
    expect(report.imported.map((r) => r.reference)).toEqual([
      'MO-2026-08-01-01',
      'MO-2026-08-01-02',
      'MO-2026-08-01-03',
      'MO-2026-08-01-04',
      'NO-2026-08-01-01',
    ])
    expect(report.skipped).toEqual([
      {
        reference: 'MO-2026-08-01-05',
        reason: 'Sammelstelle „unbekannt“ unbekannt',
      },
      { reference: 'MO-2026-08-01-06', reason: 'ohne Positionen' },
    ])
    const rows = await Preorder.findAll({
      order: [['id', 'ASC']],
      include: [{ model: PreorderItem, as: 'items' }],
    })
    expect(
      rows.map((r) => [r.code, r.channel, r.status, r.paid, !!r.notCollectedAt])
    ).toEqual([
      ['MO-2026-08-01-01', 'sammelstelle', 'abgeholt', true, false],
      ['MO-2026-08-01-02', 'sammelstelle', 'storniert', false, false],
      ['MO-2026-08-01-03', 'sammelstelle', 'bereit', false, true],
      ['MO-2026-08-01-04', 'sammelstelle', 'offen', false, false],
      ['NO-2026-08-01-01', 'sammelstelle', 'offen', false, false],
    ])
    expect(rows[0].pickedUpAt?.toISOString()).toBe('2026-08-01T07:05:00.000Z')
    expect(rows[0].createdAt.toISOString()).toBe('2026-07-30T10:00:00.000Z')
    expect(rows[3].items?.[0]).toMatchObject({
      productId: 'musterweck',
      productName: 'Musterweck',
      unitPrice: 0.45,
      quantity: 4,
      variant: '',
    })

    const again = await importDeliveryStore(STORE)
    expect(again.imported).toEqual([])
    expect(again.alreadyImported).toHaveLength(5)
    expect(again.pickupPoints.existing).toEqual([MOERSBACH, 'testkita-nord'])
    expect(await Preorder.count()).toBe(5)
    const audit = await AuditLog.findAll({
      where: { action: 'import', entity: 'preorder' },
    })
    expect(audit).toHaveLength(5)
    expect(JSON.stringify(audit.map((a) => a.data))).not.toContain('Testkunde')
  })

  it('gives an imported preorder a new code when its reference is taken', async () => {
    const report = await importDeliveryStore({
      preorders: [legacy(9, { reference: 'MO-2026-08-01-01', id: 99 })],
    })
    // the reference is a known source reference already
    expect(report.alreadyImported).toEqual(['MO-2026-08-01-01'])
    const fresh = await importDeliveryStore({
      preorders: [legacy(8, { reference: 'MO-2026-08-01-04-x' })],
    })
    expect(fresh.imported).toHaveLength(1)
    await Preorder.update(
      { code: 'MO-2026-08-01-77' },
      { where: { code: 'MO-2026-08-01-04-x' } }
    )
    const clash = await importDeliveryStore({
      preorders: [legacy(10, { reference: 'MO-2026-08-01-77' })],
    })
    expect(clash.imported[0]).toMatchObject({
      reference: 'MO-2026-08-01-77',
      code: 'MO-2026-08-01-78',
    })
  })

  it('anonymises finished preorders 90 days after pickup, leaves open ones', async () => {
    // today 2026-10-31: cutoff 2026-08-02, pickup 2026-08-01 is due
    const dry = await anonymizePreorders({ today: '2026-10-31', dryRun: true })
    expect(dry.cutoff).toBe('2026-08-02')
    expect(dry.anonymized.map((a) => a.code)).toEqual([
      'MO-2026-08-01-01',
      'MO-2026-08-01-02',
      'MO-2026-08-01-03',
    ])
    expect(await Preorder.count({ where: { anonymizedAt: null } })).toBe(
      await Preorder.count()
    )

    const tooEarly = await anonymizePreorders({ today: '2026-10-30' })
    expect(tooEarly.anonymized).toEqual([])

    const report = await anonymizePreorders({ today: '2026-10-31' })
    expect(report.anonymized).toHaveLength(3)
    expect(report.stillOpen).toBeGreaterThanOrEqual(2)
    const done = await Preorder.findOne({ where: { code: 'MO-2026-08-01-01' } })
    expect(done).toMatchObject({
      customerName: 'anonymisiert',
      customerPhone: null,
      note: null,
      status: 'abgeholt',
    })
    expect(done?.anonymizedAt).toBeInstanceOf(Date)
    const open = await Preorder.findOne({ where: { code: 'MO-2026-08-01-04' } })
    expect(open?.customerName).toBe('Testkunde 4')

    expect(
      (await anonymizePreorders({ today: '2026-10-31' })).anonymized
    ).toEqual([])
    expect(
      await AuditLog.count({
        where: { action: 'anonymize', entity: 'preorder' },
      })
    ).toBe(3)
  })

  it('locks anonymised preorders against edits over HTTP', async () => {
    const token = bearer(await sessionFor(api.app, 'test.verkauf', 'verkauf'))
    const done = await Preorder.findOne({ where: { code: 'MO-2026-08-01-01' } })
    const res = await request(api.app)
      .post(`/api/preorders/${done?.id}/status`)
      .set(token)
      .send({ status: 'offen' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('anonymized')
    const read = await request(api.app)
      .get(`/api/preorders/${done?.id}`)
      .set(token)
    expect(read.body.data).toMatchObject({
      customerName: 'anonymisiert',
      customerPhone: null,
      anonymizedAt: expect.any(String),
    })
  })
})

describe('CLI', () => {
  let dir: string
  const savedEnv = { ...process.env }
  let out: string[]

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b7-cli-'))
    process.env['DB_PATH'] = path.join(dir, 'cli.db')
    out = []
    jest.spyOn(console, 'log').mockImplementation((m: string) => {
      out.push(m)
    })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...savedEnv }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  async function count(): Promise<number> {
    const { sequelize } = await openDatabase({
      storage: process.env['DB_PATH']!,
    })
    try {
      await runMigrations(sequelize, { log: () => undefined })
      await initializeModels(sequelize)
      return await Preorder.count()
    } finally {
      await sequelize.close()
    }
  }

  it('import-preorders: dry run, run, rerun', async () => {
    const file = path.join(dir, 'delivery-store.json')
    fs.writeFileSync(file, JSON.stringify(STORE))
    expect(await main(['import-preorders', '--file', file, '--dry-run'])).toBe(
      0
    )
    expect(JSON.parse(out[0])).toMatchObject({ dryRun: true })
    expect(await count()).toBe(0)
    expect(await main(['import-preorders', '--file', file])).toBe(0)
    expect(await count()).toBe(5)
    expect(await main(['import-preorders', '--file', file])).toBe(0)
    expect(JSON.parse(out[2]).alreadyImported).toHaveLength(5)
    expect(await count()).toBe(5)
  })

  it('anonymize-preorders runs with options and rejects bad ones', async () => {
    const file = path.join(dir, 'delivery-store.json')
    fs.writeFileSync(file, JSON.stringify(STORE))
    expect(await main(['import-preorders', '--file', file])).toBe(0)
    expect(
      await main(['anonymize-preorders', '--today', '2026-10-31', '--dry-run'])
    ).toBe(0)
    expect(JSON.parse(out[1])).toMatchObject({
      dryRun: true,
      cutoff: '2026-08-02',
    })
    expect(
      await main(['anonymize-preorders', '--today=2026-10-31', '--days', '30'])
    ).toBe(0)
    expect(JSON.parse(out[2]).anonymized).toHaveLength(3)
    expect(await main(['anonymize-preorders'])).toBe(0) // today = Berlin date

    expect(await main(['anonymize-preorders', '--days', '0'])).toBe(1)
    expect(await main(['anonymize-preorders', '--today', '31.10.2026'])).toBe(1)
    expect(await main(['anonymize-preorders', '--today', '2026-02-30'])).toBe(1)
    expect(await main(['anonymize-preorders', '--force'])).toBe(1)
    expect(await main(['import-preorders'])).toBe(1)
    expect(
      await main(['import-preorders', '--file', path.join(dir, 'fehlt.json')])
    ).toBe(1)
  })
})
