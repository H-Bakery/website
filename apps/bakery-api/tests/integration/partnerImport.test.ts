/**
 * B6: import of the mock's `partner-store.json` into SQLite
 * (`partner-import.service.ts`) on :memory: with the pilot baseline.
 * Synthetic store only (`tests/fixtures/partner-store.synthetic.json`).
 */
import request from 'supertest'

import {
  AuditLog,
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
} from '../../src/models'
import {
  ImportInputError,
  formatImportReport,
  importPartnerStore,
} from '../../src/services/partner-import.service'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/partner-store.synthetic.json')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const partnerStats = require('../../src/services/partner-stats.core')

let api: TestApp
let token: string

const store = () => JSON.parse(JSON.stringify(fixture))

beforeEach(async () => {
  api = await createTestApp({ seedPartners: true })
  token = await sessionFor(api.app, 'test.inhaber', 'inhaber')
})

afterEach(async () => {
  await api.close()
})

async function counts() {
  return {
    partners: await Partner.count(),
    templates: await PartnerDeliveryTemplate.count(),
    visits: await PartnerVisit.count(),
    items: await PartnerVisitItem.count(),
  }
}

describe('importPartnerStore', () => {
  it('imports partners (by slug), templates and visits with their snapshots', async () => {
    const report = await importPartnerStore(store())
    expect(report).toEqual({
      dryRun: false,
      partners: { created: 1, existing: 1, updated: 0 },
      templates: { created: 3, existing: 0, updated: 0 },
      visits: { created: 4, existing: 0, items: 6 },
      problems: [],
    })
    expect(await counts()).toEqual({
      partners: 2,
      templates: 3,
      visits: 4,
      items: 6,
    })

    // The seeded CAP-Markt is matched by slug and left as it was.
    const cap = await Partner.findByPk(1)
    expect(cap!.street).toBe('')
    const other = await Partner.findOne({
      where: { slug: 'testmarkt-beispielstadt' },
    })
    expect(other).toMatchObject({
      name: 'Testmarkt Beispielstadt',
      settlementModel: 'firm_sale',
      active: false,
    })

    const res = await request(api.app)
      .get('/api/partners/1/visits?from=2026-03-03&to=2026-03-03')
      .set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({
      visitType: 'initial',
      sequence: 1,
      visitAt: '2026-03-03T05:30:00.000Z',
      staffId: null, // the mock's staffId points at no user
      staffName: 'Test Fahrer',
    })
    // Snapshots stay - also for a product hq no longer knows.
    expect(res.body[0].items).toEqual([
      expect.objectContaining({
        productSlug: 'kornbrot-500g',
        productName: 'Kornbrot 500g (alter Name)',
        unitPrice: 2.1,
        countedQty: null,
        deliveredQty: 8,
      }),
      expect.objectContaining({
        productSlug: 'altes-testbrot',
        productId: 9001,
        unitPrice: 1.5,
      }),
    ])
    expect(res.body[1].items.map((i: any) => i.countedQty)).toEqual([2, 0])

    const template = await request(api.app)
      .get(`/api/partners/${other!.id}/templates`)
      .set(bearer(token))
    expect(template.body).toEqual([
      expect.objectContaining({
        weekday: 6,
        active: false,
        items: [{ productId: 13, productSlug: 'musterweck', quantity: 12 }],
      }),
    ])
  })

  it('the API computes the same stats as the mock did from the file', async () => {
    await importPartnerStore(store())
    const res = await request(api.app)
      .get('/api/partners/1/stats?from=2026-03-01&to=2026-03-31')
      .set(bearer(token))
    const fromFile = partnerStats.computeStats(
      fixture.visits.filter((v: any) => v.partnerId === 1),
      { from: '2026-03-01', to: '2026-03-31' }
    )
    expect(res.body).toEqual(JSON.parse(JSON.stringify(fromFile)))
    expect(res.body.totals.revenue).toBeGreaterThan(0)
  })

  it('is idempotent: a second run creates nothing', async () => {
    await importPartnerStore(store())
    const before = await counts()
    const again = await importPartnerStore(store())
    expect(again).toMatchObject({
      partners: { created: 0, existing: 2, updated: 0 },
      templates: { created: 0, existing: 3, updated: 0 },
      visits: { created: 0, existing: 4, items: 0 },
      problems: [],
    })
    expect(await counts()).toEqual(before)
  })

  it('keeps visits recorded in the app since, and adds only what is new', async () => {
    await importPartnerStore(store())
    const s = store()
    s.visits.push({
      id: 5,
      partnerId: 2,
      businessDate: '2026-03-04',
      visitAt: '2026-03-04T17:00:00.000Z',
      visitType: 'pickup',
      sequence: 2,
      items: [
        {
          productId: 13,
          productSlug: 'musterweck',
          productName: 'Musterweck',
          unitPrice: 0.4,
          countedQty: 1,
        },
      ],
    })
    const report = await importPartnerStore(s)
    expect(report.visits).toEqual({ created: 1, existing: 4, items: 1 })
  })

  it('a dry run reports exactly what a real run would do and saves nothing', async () => {
    const before = await counts()
    const auditBefore = await AuditLog.count()
    const dry = await importPartnerStore(store(), { dryRun: true })
    expect(await counts()).toEqual(before)
    expect(await AuditLog.count()).toBe(auditBefore)
    const real = await importPartnerStore(store())
    expect({ ...dry, dryRun: false }).toEqual(real)
    expect(formatImportReport(dry)).toContain('Probelauf')
  })

  it('--update-partners overwrites master data and templates of existing partners', async () => {
    await importPartnerStore(store())
    const s = store()
    s.templates[0].items = [
      { productId: 13, productSlug: 'musterweck', quantity: 9 },
    ]
    const report = await importPartnerStore(s, { updatePartners: true })
    expect(report.partners).toEqual({ created: 0, existing: 1, updated: 1 })
    expect(report.templates).toEqual({ created: 0, existing: 2, updated: 1 })
    const cap = await Partner.findByPk(1)
    expect(cap).toMatchObject({
      street: 'Musterweg 1',
      city: 'Musterstadt',
      contactName: 'Test Kontakt',
    })
    const tuesday = await PartnerDeliveryTemplate.findOne({
      where: { partnerId: 1, weekday: 2 },
    })
    expect(tuesday!.items).toEqual([
      { productId: 13, productSlug: 'musterweck', quantity: 9 },
    ])
    // Nothing changed any more: a third run updates nothing.
    const third = await importPartnerStore(s, { updatePartners: true })
    expect(third.partners.updated).toBe(0)
    expect(third.templates.updated).toBe(0)
  })

  it('reports a conflicting initial visit in the database, imports the rest, re-sequences', async () => {
    // Recorded in the app before the import: another initial and a refill
    // with sequence 2 on the same day.
    await PartnerVisit.create({
      partnerId: 1,
      businessDate: '2026-03-03',
      visitAt: new Date('2026-03-03T06:00:00.000Z'),
      visitType: 'initial',
      sequence: 1,
    })
    await PartnerVisit.create({
      partnerId: 1,
      businessDate: '2026-03-03',
      visitAt: new Date('2026-03-03T11:00:00.000Z'),
      visitType: 'refill',
      sequence: 2,
    })
    const report = await importPartnerStore(store())
    expect(report.visits.created).toBe(3)
    expect(report.problems).toEqual([
      {
        entity: 'visit',
        sourceId: 1,
        message: expect.stringContaining(
          'gibt es in der Datenbank schon eine andere Erstbestückung'
        ),
      },
    ])
    const pickup = await PartnerVisit.findOne({
      where: { partnerId: 1, businessDate: '2026-03-03', visitType: 'pickup' },
    })
    expect(pickup!.sequence).toBe(3)
    expect(formatImportReport(report)).toContain('Nicht übernommen (1)')
  })

  it('reports problems of the file and imports everything else', async () => {
    const s = store()
    s.visits.push({
      id: 9,
      partnerId: 1,
      businessDate: '2026-03-05',
      visitAt: '2026-03-05T06:00:00Z',
      visitType: 'refill',
      items: [{ productSlug: 'kornbrot-500g', countedQty: 'abc' }],
    })
    const report = await importPartnerStore(s)
    expect(report.visits.created).toBe(4)
    expect(report.problems).toHaveLength(1)
    expect(report.problems[0]).toMatchObject({ entity: 'visit', sourceId: 9 })
  })

  it('is all or nothing: a failure half-way leaves the database untouched', async () => {
    const before = await counts()
    const spy = jest
      .spyOn(PartnerVisitItem, 'bulkCreate')
      .mockImplementationOnce(async () => {
        throw new Error('Platte voll (simuliert)')
      })
    await expect(importPartnerStore(store())).rejects.toThrow('Platte voll')
    spy.mockRestore()
    expect(await counts()).toEqual(before)
  })

  it('refuses a file that is no partner store, before touching anything', async () => {
    await expect(importPartnerStore({ visits: [] })).rejects.toBeInstanceOf(
      ImportInputError
    )
    await expect(importPartnerStore([])).rejects.toThrow(/Partner-Store/)
  })

  it('writes one audit row for a real run', async () => {
    const before = await AuditLog.count()
    await importPartnerStore(store())
    const rows = await AuditLog.findAll({ order: [['id', 'ASC']] })
    expect(rows).toHaveLength(before + 1)
    expect(rows[rows.length - 1]).toMatchObject({
      action: 'import',
      entity: 'partner_store',
      userId: null,
    })
  })
})
