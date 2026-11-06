/**
 * M4 `/api/rest` - „Rest am Abend“ against the real app (in-memory SQLite,
 * all migrations). Synthetic master data from tests/fixtures (written to a
 * temp "hq"), a synthetic cash report, synthetic users. Nothing here comes
 * from the real hq.
 *
 * Dates: Di 2026-12-01 (counted), Mi 2026-12-02 (not confirmed),
 * Mo 2026-12-07 (Ruhetag), „heute“ Di 2026-12-08.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { AuditLog, PartnerDeliveryTemplate, RestCount } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, createUser, sessionFor } from '../helpers/auth'

/* eslint-disable @typescript-eslint/no-var-requires */
const fixture = require('../fixtures/backzettel.synthetic')
const grundmengen = require('../fixtures/backzettel-grundmengen.synthetic')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const TODAY = '2026-12-08'
const TUE = '2026-12-01'
const WED = '2026-12-02'
const MON = '2026-12-07'
const PINNED_NOW = new Date('2026-12-08T09:00:00Z')

let api: TestApp
let hqDir: string
let reportsDir: string
const counted: any[] = []
const tokens: Record<'inhaber' | 'backstube' | 'verkauf' | 'fahrer', string> = {
  inhaber: '',
  backstube: '',
  verkauf: '',
  fahrer: '',
}

const as = (role: keyof typeof tokens) => ({
  get: (p: string) => request(api.app).get(p).set(bearer(tokens[role])),
  put: (p: string) => request(api.app).put(p).set(bearer(tokens[role])),
  post: (p: string) => request(api.app).post(p).set(bearer(tokens[role])),
})

function writeHq(dir: string): void {
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'products'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data', 'recipes', 'fillings'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(dir, 'data', 'recipes', 'fillings', 'test.md'),
    fixture.RECIPE_MD
  )
  for (const p of fixture.PRODUCTS) {
    fs.writeFileSync(
      path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
      `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test ${
        p.id
      }\nprice: 1.5\navailable: ${p.available !== false}\n---\n\nText\n`
    )
  }
  fs.writeFileSync(
    path.join(dir, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.config(), null, 2)
  )
}

function line(view: any, itemId: string) {
  return view.lines.find((l: any) => l.itemId === itemId)
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-hq-'))
  writeHq(hqDir)
  reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-reports-'))
  fs.mkdirSync(path.join(reportsDir, 'converted'))
  // Tuesday: 9 Plunder (PLU 906) sold, one storno pair that nets out.
  fs.writeFileSync(
    path.join(reportsDir, 'converted', `${TUE}_90000001.json`),
    JSON.stringify(
      grundmengen.convertedReport(TUE, [
        { items: [[906, 9]] },
        { items: [[906, 1]] },
        { items: [[906, -1]] },
      ])
    )
  )
  api = await createTestApp({
    seedPartners: true,
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      hq: { reportsDir, today: TODAY },
      hqProducts: { productsDir: path.join(hqDir, 'products'), writeDir: null },
      rest: { onCounted: (view) => counted.push(view) },
    },
  })
  tokens.inhaber = await sessionFor(api.app, 'test.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'test.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'test.verkauf', 'verkauf')
  tokens.fahrer = await sessionFor(api.app, 'test.fahrer', 'fahrer')
  // CAP template Tuesday (partner 1 from the seeder): 12 Weck.
  await PartnerDeliveryTemplate.create({
    partnerId: 1,
    weekday: 2,
    items: [{ productId: 907, productSlug: 'test-weck', quantity: 12 }],
  })
})

afterAll(async () => {
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
  fs.rmSync(reportsDir, { recursive: true, force: true })
})

describe('access', () => {
  it('needs a session', async () => {
    const res = await request(api.app).get('/api/rest')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
  })

  it('fahrer gets nothing', async () => {
    for (const res of [
      await as('fahrer').get(`/api/rest?date=${TUE}`),
      await as('fahrer').put(`/api/rest/${TUE}`).send({ items: [] }),
      await as('fahrer').get('/api/rest/summary'),
      await as('fahrer').get('/api/rest/averages'),
    ]) {
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'forbidden' })
      expect(res.body.message).toEqual(expect.any(String))
    }
  })

  it('backstube reads the list and the averages, but neither counts nor sees the summary', async () => {
    expect((await as('backstube').get(`/api/rest?date=${TUE}`)).status).toBe(
      200
    )
    expect((await as('backstube').get('/api/rest/averages')).status).toBe(200)
    expect(
      (
        await as('backstube')
          .put(`/api/rest/${TUE}`)
          .send({
            items: [{ itemId: 'plunder', productId: 'test-plunder', qty: 1 }],
          })
      ).status
    ).toBe(403)
    expect((await as('backstube').get('/api/rest/summary')).status).toBe(403)
    expect((await as('backstube').get('/api/rest/summary.csv')).status).toBe(
      403
    )
  })

  it('verkauf counts but does not see the summary', async () => {
    expect((await as('verkauf').get('/api/rest/summary')).status).toBe(403)
    expect((await as('verkauf').get('/api/rest/averages')).status).toBe(403)
  })
})

describe('GET /api/rest', () => {
  it('defaults to today and lists the draft Backzettel as „geplant“', async () => {
    const res = await as('verkauf').get('/api/rest')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      date: TODAY,
      status: 'ok',
      backzettelStatus: 'draft',
      editable: true,
    })
    const weck = line(res.body.data, 'weck')
    expect(weck).toMatchObject({ planned: 52, baked: null, counted: false })
  })

  it('takes the frozen Gesamt as „gebacken“ once the day is confirmed', async () => {
    expect(
      (await as('inhaber').post(`/api/backzettel/${TUE}/confirm`)).status
    ).toBe(200)
    const res = await as('verkauf').get(`/api/rest?date=${TUE}`)
    expect(res.body.data.backzettelStatus).toBe('confirmed')
    expect(line(res.body.data, 'weck')).toMatchObject({
      baked: 52,
      cap: 12,
      rows: [
        expect.objectContaining({
          productId: 'test-weck',
          unit: 'Stück',
          qty: null,
        }),
      ],
    })
    expect(line(res.body.data, 'kornbrot')).toMatchObject({
      unit: 'Liter',
      baked: 4,
      rows: [expect.objectContaining({ unit: 'Stück', factor: 0.5 })],
    })
    // Schnecke has no hq product: counted in its own unit.
    expect(line(res.body.data, 'schnecke').rows[0]).toMatchObject({
      productId: '',
      unit: 'Stück',
    })
  })

  it('says Ruhetag and refuses a bad date', async () => {
    const mon = await as('verkauf').get(`/api/rest?date=${MON}`)
    expect(mon.body.data).toMatchObject({ status: 'ruhetag', editable: false })
    const bad = await as('verkauf').get('/api/rest?date=2026-02-30')
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'invalid_date' })
  })
})

describe('PUT /api/rest/:date', () => {
  it('saves a batch, converts to the item unit and audits it', async () => {
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          { itemId: 'weck', productId: 'test-weck', qty: 5, expected: null },
          { itemId: 'plunder', productId: 'test-plunder', qty: 0 },
          { itemId: 'kornbrot', productId: 'test-kornbrot', qty: '2' },
          { itemId: 'schnecke', qty: 1 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.changed).toBe(4)
    expect(line(res.body.data, 'kornbrot')).toMatchObject({
      counted: true,
      rest: 1,
    })
    expect(line(res.body.data, 'weck').rows[0]).toMatchObject({
      qty: 5,
      revision: 1,
      countedBy: { displayName: 'Test test.verkauf' },
    })
    const audits = await AuditLog.findAll({
      where: { action: 'rest_count', entityId: TUE },
    })
    expect(audits).toHaveLength(1)
    expect((audits[0].data as any).changes).toHaveLength(4)
    expect(counted.at(-1)).toMatchObject({ date: TUE })
  })

  it('a save of the same numbers changes nothing and audits nothing', async () => {
    const before = counted.length
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          { itemId: 'weck', productId: 'test-weck', qty: 5, expected: 4 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.changed).toBe(0)
    expect(await AuditLog.count({ where: { action: 'rest_count' } })).toBe(1)
    expect(counted.length).toBe(before)
  })

  it('a correction keeps the old value in the audit and counts the revision', async () => {
    const res = await as('inhaber')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          { itemId: 'weck', productId: 'test-weck', qty: 6, expected: 5 },
        ],
      })
    expect(res.status).toBe(200)
    expect(line(res.body.data, 'weck').rows[0]).toMatchObject({
      qty: 6,
      revision: 2,
      countedBy: { displayName: 'Test test.inhaber' },
    })
    const last = await AuditLog.findOne({
      where: { action: 'rest_count' },
      order: [['id', 'DESC']],
    })
    expect((last!.data as any).changes).toEqual([
      {
        itemId: 'weck',
        variant: '',
        productId: 'test-weck',
        from: 5,
        to: 6,
        correction: true,
      },
    ])
  })

  it('refuses a stale screen with 409 and saves nothing of the batch', async () => {
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          { itemId: 'plunder', productId: 'test-plunder', qty: 3, expected: 0 },
          { itemId: 'weck', productId: 'test-weck', qty: 7, expected: 5 },
        ],
      })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'rest_changed',
      current: [
        expect.objectContaining({
          itemId: 'weck',
          qty: 6,
          countedBy: expect.objectContaining({
            displayName: 'Test test.inhaber',
          }),
        }),
      ],
    })
    expect(res.body.message).toMatch(/Nichts wurde gespeichert/)
    const plunder = await RestCount.findOne({
      where: { businessDate: TUE, itemId: 'plunder' },
    })
    expect(Number(plunder!.qty)).toBe(0)
  })

  it('an item with Sorten needs the Sorte (400 variant_required), as preorders do', async () => {
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          { itemId: 'zopf-gefuellt', productId: 'test-zopf-gefuellt', qty: 1 },
        ],
      })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'variant_required',
      message: expect.stringContaining('Sorte'),
    })
    expect(
      await RestCount.count({
        where: { businessDate: TUE, itemId: 'zopf-gefuellt' },
      })
    ).toBe(0)
  })

  it('parallel saves of the same row: exactly one wins, the rest are 409, never 500', async () => {
    const send = (qty: number) =>
      as('verkauf')
        .put(`/api/rest/${WED}`)
        .send({
          items: [
            { itemId: 'weck', productId: 'test-weck', qty, expected: null },
          ],
        })
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => send(i + 1))
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(7)
    const winner = results.find((r) => r.status === 200)!
    const stored = await RestCount.findAll({
      where: { businessDate: WED, itemId: 'weck' },
    })
    expect(stored).toHaveLength(1)
    expect(Number(stored[0].qty)).toBe(
      line(winner.body.data, 'weck').rows[0].qty
    )
    for (const r of results.filter((x) => x.status === 409)) {
      expect(r.body).toMatchObject({ error: 'rest_changed' })
    }
  })

  it('qty null deletes a count (the audit keeps it)', async () => {
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({ items: [{ itemId: 'schnecke', qty: null }] })
    expect(res.status).toBe(200)
    expect(line(res.body.data, 'schnecke')).toMatchObject({ counted: false })
    expect(
      await RestCount.count({
        where: { businessDate: TUE, itemId: 'schnecke' },
      })
    ).toBe(0)
  })

  it.each([
    [
      { itemId: 'weck', productId: 'test-weck', qty: 'abc' },
      400,
      'invalid_quantity',
    ],
    [
      { itemId: 'weck', productId: 'test-weck', qty: 1.5 },
      400,
      'invalid_quantity',
    ],
    [
      { itemId: 'weck', productId: 'test-weck', qty: -1 },
      400,
      'invalid_quantity',
    ],
    [{ itemId: 'nope', qty: 1 }, 400, 'unknown_item'],
    [{ itemId: 'kranz', qty: 1 }, 400, 'unknown_product'],
  ])('refuses %j', async (entry, status, error) => {
    const res = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({ items: [entry] })
    expect(res.status).toBe(status)
    expect(res.body).toMatchObject({ error })
    expect(res.body.message).toEqual(expect.any(String))
  })

  it('only today and the 7 days before, never a Ruhetag', async () => {
    const item = { itemId: 'weck', productId: 'test-weck', qty: 1 }
    const future = await as('verkauf')
      .put('/api/rest/2026-12-09')
      .send({ items: [item] })
    expect(future.status).toBe(400)
    expect(future.body).toMatchObject({ error: 'date_out_of_range' })
    const old = await as('inhaber')
      .put('/api/rest/2026-11-29')
      .send({ items: [item] })
    expect(old.status).toBe(400)
    expect(old.body).toMatchObject({ error: 'date_out_of_range' })
    const mon = await as('verkauf')
      .put(`/api/rest/${MON}`)
      .send({ items: [item] })
    expect(mon.status).toBe(409)
    expect(mon.body).toMatchObject({ error: 'ruhetag' })
    const bad = await as('verkauf')
      .put('/api/rest/2026-13-01')
      .send({ items: [item] })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'invalid_date' })
  })

  it('works from a PIN station (the shop tablet)', async () => {
    const station = await as('inhaber')
      .post('/api/auth/stations')
      .send({ name: 'Laden-Tablet' })
    expect(station.status).toBe(201)
    const user = await createUser({
      username: 'test.laden',
      role: 'verkauf',
      pin: '0420',
    })
    const pin = await request(api.app)
      .post('/api/auth/pin')
      .set('X-Station-Token', station.body.data.token)
      .send({ userId: user.id, pin: '0420' })
    expect(pin.status).toBe(200)
    const res = await request(api.app)
      .put(`/api/rest/${WED}`)
      .set(bearer(pin.body.data.token))
      .send({
        items: [{ itemId: 'plunder', productId: 'test-plunder', qty: 2 }],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.backzettelStatus).toBe('draft')
  })
})

describe('GET /api/rest/summary', () => {
  it('rates rest against baked − CAP, with sold from the cash report; gaps are not 0', async () => {
    const res = await as('inhaber').get(
      `/api/rest/summary?from=${TUE}&to=${TODAY}`
    )
    expect(res.status).toBe(200)
    const s = res.body.data
    const weck = s.items.find((i: any) => i.itemId === 'weck')
    expect(weck).toMatchObject({
      days: 1,
      baked: 52,
      cap: 12,
      shopBaked: 40,
      rest: 6,
      rate: 0.15,
    })
    const plunder = s.items.find((i: any) => i.itemId === 'plunder')
    expect(plunder).toMatchObject({
      days: 1,
      baked: 10,
      rest: 0,
      rate: 0,
      sold: 9,
      soldStatus: 'ok',
      soldConverted: true,
    })
    const korn = s.items.find((i: any) => i.itemId === 'kornbrot')
    expect(korn).toMatchObject({ unit: 'Liter', rest: 1, rate: 0.25 })
    // Schnecke was deleted again: Tuesday is incomplete for it.
    const schnecke = s.items.find((i: any) => i.itemId === 'schnecke')
    expect(schnecke).toMatchObject({
      days: 0,
      rate: null,
      uncountedDates: [TUE],
    })
    const days = Object.fromEntries(s.days.map((d: any) => [d.date, d.status]))
    expect(days).toMatchObject({
      [TUE]: 'partial',
      [WED]: 'counted_without_backzettel',
      [MON]: 'ruhetag',
    })
    expect(s.reportsAvailable).toBe(true)
  })

  it('refuses a bad range', async () => {
    const res = await as('inhaber').get(
      '/api/rest/summary?from=2026-12-08&to=2026-12-01'
    )
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'invalid_range' })
    const big = await as('inhaber').get(
      '/api/rest/summary?from=2020-01-01&to=2026-12-08'
    )
    expect(big.body).toMatchObject({ error: 'range_too_large' })
  })

  it('exports CSV with a BOM, through the session', async () => {
    const res = await as('inhaber').get(
      `/api/rest/summary.csv?from=${TUE}&to=${TODAY}`
    )
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toContain(
      `rest-am-abend-${TUE}-bis-${TODAY}.csv`
    )
    expect(res.text.charCodeAt(0)).toBe(0xfeff)
    expect(res.text).toContain('Rest am Abend - Auswertung')
    expect(res.text).toContain('15,0%')
  })
})

describe('GET /api/rest/averages', () => {
  it('gives Rest Ø per weekday from complete counts only', async () => {
    const res = await as('backstube').get('/api/rest/averages?weeks=6')
    expect(res.status).toBe(200)
    const tue = res.body.data.weekdays.find((w: any) => w.weekday === 2)
    const ids = tue.items.map((i: any) => i.itemId)
    expect(ids).toEqual(expect.arrayContaining(['weck', 'plunder', 'kornbrot']))
    expect(ids).not.toContain('schnecke')
    expect(tue.items.find((i: any) => i.itemId === 'weck')).toMatchObject({
      mean: 6,
      dates: [TUE],
    })
    const bad = await as('backstube').get('/api/rest/averages?weeks=0')
    expect(bad.status).toBe(400)
  })
})

describe('summary reads the light Backzettel view', () => {
  it('„gebacken“ in the summary equals the day view, also with an acknowledged Nachtrag', async () => {
    const pre = await as('verkauf')
      .post('/api/preorders')
      .send({
        channel: 'telefon',
        customerName: 'Testkunde',
        pickupDate: TUE,
        items: [{ productId: 'test-weck', quantity: 3 }],
      })
    expect(pre.status).toBe(201)
    const bz = await as('backstube').get(`/api/backzettel/${TUE}`)
    const delta = bz.body.data.deltas.find((d: any) => d.itemId === 'weck')
    expect(delta).toBeTruthy()
    expect(
      (
        await as('backstube').post(
          `/api/backzettel/${TUE}/deltas/${delta.id}/ack`
        )
      ).status
    ).toBe(200)
    const day = await as('verkauf').get(`/api/rest?date=${TUE}`)
    const baked = line(day.body.data, 'weck').baked
    expect(baked).toBe(55)
    const s = await as('inhaber').get(`/api/rest/summary?from=${TUE}&to=${TUE}`)
    expect(
      s.body.data.items.find((i: any) => i.itemId === 'weck')
    ).toMatchObject({ baked, cap: 12 })
  })
})

describe('a later product in backzettel.yaml (Abschluss-Verifikation next)', () => {
  it('keeps a day counted under the old product list counted', async () => {
    const yamlPath = path.join(hqDir, 'config', 'backzettel.yaml')
    const original = fs.readFileSync(yamlPath, 'utf8')
    const before = await as('inhaber').get(
      `/api/rest/summary?from=${TUE}&to=${TUE}`
    )
    const plunderBefore = before.body.data.items.find(
      (i: any) => i.itemId === 'plunder'
    )
    expect(plunderBefore).toMatchObject({ days: 1, uncountedDays: 0 })
    // Plunder gets a second product (a new size) after the count.
    const grown = fixture.config()
    grown.items
      .find((i: any) => i.id === 'plunder')
      .products.push({ id: 'test-alt', factor: 1 })
    fs.writeFileSync(yamlPath, JSON.stringify(grown, null, 2))
    try {
      const config = await as('backstube').get('/api/backzettel/config')
      expect(config.body.data.status).toBe('ok')
      const after = await as('inhaber').get(
        `/api/rest/summary?from=${TUE}&to=${TUE}`
      )
      expect(
        after.body.data.items.find((i: any) => i.itemId === 'plunder')
      ).toMatchObject({ days: 1, uncountedDays: 0, rest: plunderBefore.rest })
      const day = await as('verkauf').get(`/api/rest?date=${TUE}`)
      expect(line(day.body.data, 'plunder')).toMatchObject({ counted: true })
      const avg = await as('backstube').get('/api/rest/averages?weeks=6')
      expect(avg.status).toBe(200)
      const tue = avg.body.data.weekdays.find((w: any) => w.weekday === 2)
      expect(tue.items.map((i: any) => i.itemId)).toContain('plunder')
    } finally {
      fs.writeFileSync(yamlPath, original)
    }
  })
})
