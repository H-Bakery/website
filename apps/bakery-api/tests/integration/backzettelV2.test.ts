/**
 * Z10 Backzettel v2 against the real app (docs/backzettel-v2.md §5, slice
 * S3): the sheet of a dough day, the bake list, deltas by dough day, the
 * transition from days confirmed before Z10, corrections with `bakeDate`,
 * Ruhetag and roles. Synthetic master data `configV2()` (invented numbers,
 * nothing from hq) written to a temp "hq"; preorders through the models
 * (draft inputs) or `POST /api/preorders` (write path → deltas).
 *
 * Own file (not a `describe('v2')` in backzettel.test.ts): the models are
 * process-global, so a second app with another hq cannot share that file's
 * app; the v1 catalogue assertions there stay as they are.
 *
 * Dates (`configV2`: bake days Di-So, dough days Di-Sa, rolls `lead: 1`):
 *   Sa 2026-11-28  sheet: bread + Hefeteig for Saturday, rolls for So + Di
 *   So 2026-11-29  no dough day: empty sheet, full bake list
 *   Mo 2026-11-30  Ruhetag
 *   Di 2026-12-01  sheet: bread + Plunder for Tuesday (rolls come from Sa)
 *   Sa 2026-12-05 / Di 2026-12-08  transition (Tuesday confirmed before Z10)
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import {
  AuditLog,
  BackzettelDay,
  BackzettelDelta,
  BackzettelLine,
  PartnerDeliveryTemplate,
  Preorder,
  PreorderItem,
} from '../../src/models'
import { createBackzettelSource } from '../../src/services/backzettel-source'
import { createBackzettelService } from '../../src/services/backzettel.service'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(30000)

const PINNED_NOW = new Date('2026-11-20T09:00:00Z')
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const MON = '2026-11-30'
const TUE = '2026-12-01'
const WED = '2026-12-02'
const SAT2 = '2026-12-05'
const TUE2 = '2026-12-08'

let api: TestApp
let hqDir: string
const tokens: Record<'inhaber' | 'backstube' | 'verkauf' | 'fahrer', string> = {
  inhaber: '',
  backstube: '',
  verkauf: '',
  fahrer: '',
}

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
  for (const p of fixture.PRODUCTS_V2) {
    fs.writeFileSync(
      path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
      `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test ${p.id}\nprice: 1.5\navailable: true\n---\n\nText\n`
    )
  }
  // JSON is valid YAML.
  fs.writeFileSync(
    path.join(dir, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.configV2(), null, 2)
  )
}

let codeSeq = 0
async function preorder(
  date: string,
  items: { productId: string; quantity: number; variant?: string }[]
): Promise<Preorder> {
  codeSeq += 1
  const p = await Preorder.create({
    code: `V2-${date}-${String(codeSeq).padStart(2, '0')}`,
    channel: 'laden',
    customerName: 'Testkunde',
    pickupDate: date,
    status: 'offen',
  })
  for (const item of items) {
    await PreorderItem.create({
      preorderId: p.id,
      productId: item.productId,
      productName: `Test ${item.productId}`,
      unitPrice: 1,
      quantity: item.quantity,
      variant: item.variant ?? '',
    })
  }
  return p
}

const as = (role: keyof typeof tokens) => ({
  get: (p: string) => request(api.app).get(p).set(bearer(tokens[role])),
  put: (p: string) => request(api.app).put(p).set(bearer(tokens[role])),
  post: (p: string) => request(api.app).post(p).set(bearer(tokens[role])),
})

async function apiPreorder(
  date: string,
  items: { productId: string; quantity: number }[]
): Promise<{ id: number }> {
  const res = await as('verkauf').post('/api/preorders').send({
    channel: 'telefon',
    customerName: 'Testkunde',
    pickupDate: date,
    items,
  })
  expect(res.status).toBe(201)
  return res.body.data
}

const idle = () => (api.app.locals['backzettelIdle'] as () => Promise<void>)()

const allLines = (day: any): any[] => day.sections.flatMap((s: any) => s.lines)

function line(day: any, key: string): any {
  return allLines(day).find((l: any) => l.key === key)
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z10-hq-'))
  writeHq(hqDir)
  api = await createTestApp({
    seedPartners: true,
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      preorders: {
        productsDir: path.join(hqDir, 'products'),
        variantsForProduct: () => null,
      },
    },
  })
  tokens.inhaber = await sessionFor(api.app, 'v2.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'v2.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'v2.verkauf', 'verkauf')
  tokens.fahrer = await sessionFor(api.app, 'v2.fahrer', 'fahrer')
  // CAP on Sunday: 6 Testdoppel - belongs to the bake day (Sunday), so it
  // lands on Saturday's sheet with the Sunday rolls.
  await PartnerDeliveryTemplate.create({
    partnerId: 1,
    weekday: 7,
    items: [{ productId: 956, productSlug: 'test-doppel', quantity: 6 }],
  })
})

afterAll(async () => {
  await idle()
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
})

describe('GET /config (Z10)', () => {
  it('lists the open master data, also for the working version', async () => {
    const res = await as('verkauf').get('/api/backzettel/config')
    expect(res.status).toBe(200)
    const pairs = (list: any[]) => list.map((o) => [o.path, o.code])
    expect(pairs(res.body.data.open)).toEqual(fixture.OPEN_V2)
    expect(pairs(res.body.data.working.open)).toEqual(fixture.OPEN_V2)
    for (const o of res.body.data.open)
      expect(o.message).toEqual(expect.any(String))
    const korn = res.body.data.config.items.find(
      (i: any) => i.id === 'test-korn'
    )
    expect(korn).toMatchObject({
      variantKind: 'size',
      variants: ['g500', 'g1000', 'kasten'],
    })
  })
})

describe('the sheet of a dough day (draft)', () => {
  it('Saturday collects its own bread and the rolls for Sunday and Tuesday', async () => {
    // Preorders and CAP belong to the bake day: 4 Doppel for Tuesday.
    await preorder(TUE, [{ productId: 'test-doppel', quantity: 4 }])
    const res = await as('backstube').get(`/api/backzettel/${SAT}`)
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(day).toMatchObject({
      date: SAT,
      status: 'draft',
      sheetVersion: 2,
      isDoughDay: true,
      plan: { version: 2, doughDate: SAT },
    })
    expect(
      day.bakeDates.map((b: any) => [b.date, b.label, b.lineCount])
    ).toEqual([
      [SAT, 'heute', 9],
      [SUN, 'für Sonntag', 5],
      [TUE, 'für Dienstag', 4],
    ])
    // Same-day lines keep their v1 keys, the others carry the bake day.
    expect(line(day, 'test-korn|g500')).toMatchObject({
      bakeDate: SAT,
      doughDate: SAT,
      variantLabel: '500 g',
      total: 8,
      id: null,
    })
    expect(line(day, `test-doppel|@${SUN}`)).toMatchObject({
      bakeDate: SUN,
      doughDate: SAT,
      lead: 1,
      base: 60,
      cap: 6,
      total: 66,
    })
    expect(line(day, `test-doppel|@${TUE}`)).toMatchObject({
      bakeDate: TUE,
      doughDate: SAT,
      preorders: 4,
      total: 44,
    })
    // Dough at the machine: kg, litres (or why not), batches.
    const machine = Object.fromEntries(day.machine.map((m: any) => [m.id, m]))
    expect(machine['test-flit-teig'].liters).toEqual({
      exact: null,
      rounded: null,
      reason: 'kg_per_liter_unknown',
    })
    expect(machine['test-flit-teig'].batches).toBeNull()
    expect(machine['test-weck-teig'].kg).toBeGreaterThan(0)
    // Rolls per bake day, in Brüche (spare pieces shown, never added).
    expect(day.rolls.map((r: any) => [r.bakeDate, r.label])).toEqual([
      [SUN, 'für Sonntag'],
      [TUE, 'für Dienstag'],
    ])
    const sunDoppel = day.rolls[0].groups.find(
      (g: any) => g.group === 'test-doppel'
    )
    // (60 + 6 CAP) × 2 pieces = 132 → 7 Brüche à 20, 8 frei.
    expect(sunDoppel).toMatchObject({
      piecesPerBruch: 20,
      brueche: 7,
      spare: 8,
      g: 1200,
    })
    expect(line(day, `test-doppel|@${SUN}`).total).toBe(66)
    expect(day.bread.sizes.map((s: any) => s.id)).toEqual(
      expect.arrayContaining(['g500', 'g1000'])
    )
    expect(day.openMasterData.map((o: any) => o.code)).toEqual(
      expect.arrayContaining(['kg_per_liter_unknown', 'filling_g_unknown'])
    )
    // Reading writes nothing.
    expect(await BackzettelDay.findByPk(SAT)).toBeNull()
  })

  it('Sunday (not a dough day) has a sheet with only its own lines - here none', async () => {
    const res = await as('verkauf').get(`/api/backzettel/${SUN}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      status: 'draft',
      sheetVersion: 2,
      isDoughDay: false,
      sections: [],
      bakeDates: [{ date: SUN, label: 'heute', lineCount: 0 }],
    })
  })

  it('Monday stays 409 ruhetag, its bake list says so', async () => {
    const res = await as('verkauf').get(`/api/backzettel/${MON}`)
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'ruhetag' })
    expect(res.body.message).toMatch(/Montag ist Ruhetag/)
    const list = await as('verkauf').get(`/api/backzettel/${MON}/bake-list`)
    expect(list.status).toBe(200)
    expect(list.body.data).toMatchObject({
      date: MON,
      status: 'ruhetag',
      sections: [],
      sources: [],
    })
    expect(list.body.data.message).toMatch(/Ruhetag/)
  })
})

describe('the bake list', () => {
  it('Sunday: every roll from Saturday’s sheet, made on Saturday, no dough figures', async () => {
    const res = await as('fahrer').get(`/api/backzettel/${SUN}/bake-list`)
    expect(res.status).toBe(200)
    const list = res.body.data
    expect(list).toMatchObject({
      date: SUN,
      weekdayName: 'Sonntag',
      status: 'ok',
      sources: [{ doughDate: SAT, status: 'draft', lineCount: 5 }],
      deltas: [],
      deltasPending: false,
    })
    const lines = list.sections.flatMap((s: any) => s.lines)
    expect(lines.map((l: any) => [l.itemId, l.total, l.madeOn])).toEqual([
      ['test-doppel', 66, 'Teig vom Samstag'],
      ['test-stern', 12, 'Teig vom Samstag'],
      ['test-kaese', 8, 'Teig vom Samstag'],
      ['test-flitweck', 40, 'Teig vom Samstag'],
      ['test-flit-klein', 10, 'Teig vom Samstag'],
    ])
    expect(list.rolls).toHaveLength(1)
    expect(list.rolls[0].bakeDate).toBe(SUN)
    for (const k of ['machine', 'doughs', 'hefeteig', 'bread'])
      expect(list[k]).toBeUndefined()
  })

  it('400 for an invalid date', async () => {
    const res = await as('verkauf').get('/api/backzettel/2026-02-30/bake-list')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'invalid_date' })
  })
})

describe('corrections with bakeDate', () => {
  it('a correction for Tuesday’s rolls goes on Saturday’s sheet', async () => {
    const res = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/test-stern/correction`)
      .send({ correction: 4, reason: 'Testgrund', bakeDate: TUE })
    expect(res.status).toBe(200)
    expect(line(res.body.data, `test-stern|@${TUE}`)).toMatchObject({
      correction: 4,
      total: 16,
      id: expect.any(Number),
    })
    // Sunday's Stern are untouched.
    expect(line(res.body.data, `test-stern|@${SUN}`)).toMatchObject({
      correction: 0,
      total: 12,
    })
    const row = await BackzettelLine.findOne({
      where: { date: SAT, itemId: 'test-stern' },
    })
    expect(row).toMatchObject({ bakeDate: TUE })
    const audit = await AuditLog.findOne({
      where: { action: 'correction', entityId: SAT },
      order: [['id', 'DESC']],
    })
    expect(audit?.data).toMatchObject({ itemId: 'test-stern', bakeDate: TUE })
  })

  it('400 invalid_bake_date: not a bake day of the sheet, item not made here, malformed', async () => {
    for (const [bakeDate, pattern] of [
      [WED, /kein Backtag des Zettels vom Samstag, 28\.11\./],
      ['2026-11-3', /Ungültiger Backtag/],
    ] as const) {
      const res = await as('backstube')
        .put(`/api/backzettel/${SAT}/lines/test-doppel/correction`)
        .send({ correction: 1, reason: 'Testgrund', bakeDate })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'invalid_bake_date' })
      expect(res.body.message).toMatch(pattern)
    }
    // Saturday's Flitweck are made on Thursday (lead 2 on Saturdays).
    const res = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/test-flitweck/correction`)
      .send({ correction: 1, reason: 'Testgrund' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'invalid_bake_date',
      doughDate: '2026-11-26',
    })
    expect(res.body.message).toMatch(/Donnerstag, 26\.11\./)
  })

  it('verkauf and fahrer may read the sheet and the bake list, not correct', async () => {
    for (const role of ['verkauf', 'fahrer'] as const) {
      expect((await as(role).get(`/api/backzettel/${SAT}`)).status).toBe(200)
      expect(
        (await as(role).get(`/api/backzettel/${TUE}/bake-list`)).status
      ).toBe(200)
      const res = await as(role)
        .put(`/api/backzettel/${SAT}/lines/test-doppel/correction`)
        .send({ correction: 1, reason: 'x', bakeDate: TUE })
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'forbidden' })
    }
    const anon = await request(api.app).get(`/api/backzettel/${SUN}/bake-list`)
    expect(anon.status).toBe(401)
  })
})

describe('confirm, deltas by dough day, bake list', () => {
  it('confirming Saturday freezes rows per bake day and the plan', async () => {
    const res = await as('backstube').post(`/api/backzettel/${SAT}/confirm`)
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(day).toMatchObject({
      status: 'confirmed',
      sheetVersion: 2,
      plan: { version: 2, doughDate: SAT },
      configChangedSinceConfirm: false,
      deltasPending: false,
    })
    expect(day.machine.length).toBeGreaterThan(0)
    expect(day.rolls.map((r: any) => r.bakeDate)).toEqual([SUN, TUE])
    const rows = await BackzettelLine.findAll({ where: { date: SAT } })
    const byBake = (d: string) =>
      rows
        .filter((r) => r.bakeDate === d)
        .map((r) => r.itemId)
        .sort()
    expect(byBake(TUE)).toEqual([
      'test-doppel',
      'test-flitweck',
      'test-kaese',
      'test-stern',
    ])
    expect(byBake(SUN)).toHaveLength(5)
    expect(line(day, `test-stern|@${TUE}`)).toMatchObject({
      total: 16,
      correction: 4,
      id: expect.any(Number),
    })
    const stored = await BackzettelDay.findByPk(SAT)
    expect(
      stored?.computedSnapshot?.plan?.bakeDates.map((b) => b.date)
    ).toEqual([SAT, SUN, TUE])
    expect(stored?.preorderSnapshot).toEqual([
      expect.objectContaining({
        productId: 'test-doppel',
        qty: 4,
        pickupDate: TUE,
      }),
    ])
  })

  it('a tick on a Tuesday line of Saturday’s sheet means made', async () => {
    const day = (await as('backstube').get(`/api/backzettel/${SAT}`)).body.data
    const doppel = line(day, `test-doppel|@${TUE}`)
    const res = await as('backstube')
      .post(`/api/backzettel/${SAT}/lines/${doppel.id}/done`)
      .send({ expectedTotal: doppel.total })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: doppel.id,
      date: SAT,
      bakeDate: TUE,
      itemId: 'test-doppel',
      doneAt: expect.any(String),
    })
  })

  it('a Tuesday-roll preorder after Saturday’s confirm is a delta on Saturday and shows on Tuesday’s bake list', async () => {
    const tue = await as('backstube').post(`/api/backzettel/${TUE}/confirm`)
    expect(tue.status).toBe(200)
    expect(tue.body.data.plan.bakeDates.map((b: any) => b.date)).toEqual([
      TUE,
      WED,
    ])

    const p = await apiPreorder(TUE, [
      { productId: 'test-doppel', quantity: 3 },
      { productId: 'test-plunder-v2', quantity: 2 },
    ])
    // Saturday: the rolls (bake date Tuesday); Tuesday: the Plunder only.
    const sat = (await as('backstube').get(`/api/backzettel/${SAT}`)).body.data
    expect(sat.deltas).toEqual([
      expect.objectContaining({
        key: `test-doppel|@${TUE}`,
        bakeDate: TUE,
        itemId: 'test-doppel',
        qty: 3,
        kind: 'added',
        preorderId: p.id,
        preorderMovedTo: null,
      }),
    ])
    expect(line(sat, `test-doppel|@${TUE}`).delta).toMatchObject({
      qty: 3,
      open: 1,
    })
    expect(sat.deltasPending).toBe(false)
    // 44 → 47 Doppel = 94 pieces: still 5 Brüche (spare pieces), so the
    // machine strip does not change; Hefeteig and fillings neither.
    expect(sat.deltaMachine).toEqual([])
    // … and the Bruch group says so: +6 pieces fit into the free ones.
    expect(sat.deltaBruch).toEqual([
      expect.objectContaining({
        key: `${TUE}|test-doppel`,
        piecesBefore: 88,
        pieces: 94,
        piecesDelta: 6,
        bruecheBefore: 5,
        brueche: 5,
        bruecheDelta: 0,
      }),
    ])
    expect(sat.deltaExtras).toBeNull()
    const tueDay = (await as('backstube').get(`/api/backzettel/${TUE}`)).body
      .data
    expect(tueDay.deltas).toEqual([
      expect.objectContaining({
        key: 'test-plunder|',
        bakeDate: TUE,
        qty: 2,
      }),
    ])
    const rows = await BackzettelDelta.findAll({ order: [['id', 'ASC']] })
    expect(
      rows.map((r) => [r.date, r.bakeDate, r.itemId, Number(r.qty)])
    ).toEqual([
      [SAT, TUE, 'test-doppel', 3],
      [TUE, TUE, 'test-plunder', 2],
    ])

    // Tuesday's bake list: rolls from Saturday (made), bread from Tuesday,
    // both Nachträge.
    const list = (await as('verkauf').get(`/api/backzettel/${TUE}/bake-list`))
      .body.data
    expect(list.sources.map((s: any) => [s.doughDate, s.status])).toEqual([
      [SAT, 'confirmed'],
      [TUE, 'confirmed'],
    ])
    const lines = list.sections.flatMap((s: any) => s.lines)
    expect(
      lines
        .filter((l: any) => l.itemId === 'test-doppel')
        .map((l: any) => [l.total, l.madeOn, l.sheetStatus, !!l.doneAt])
    ).toEqual([[44, 'Teig vom Samstag', 'confirmed', true]])
    expect(lines.find((l: any) => l.itemId === 'test-plunder')).toMatchObject({
      madeOn: 'Teig von heute',
      doughDate: TUE,
    })
    expect(list.deltas.map((d: any) => [d.itemId, d.doughDate, d.qty])).toEqual(
      [
        ['test-doppel', SAT, 3],
        ['test-plunder', TUE, 2],
      ]
    )
    expect(list.deltasPending).toBe(false)

    // „Gesehen“ on the sheet the delta belongs to.
    const ack = await as('backstube').post(
      `/api/backzettel/${SAT}/deltas/${rows[0].id}/ack`
    )
    expect(ack.status).toBe(200)
    expect(ack.body.data).toMatchObject({ bakeDate: TUE, qty: 3 })
  })

  it('getBakeLines (Rest am Abend, S4) sees Tuesday as confirmed, keyed per bake day', async () => {
    // Same models (process-global), own service instance on the same hq.
    const service = createBackzettelService(
      createBackzettelSource({ hqDir, cacheMs: 0 })
    )
    const view: any = await service.getBakeLines(TUE)
    expect(view).toMatchObject({ date: TUE, status: 'confirmed' })
    expect(view.sources.map((s: any) => s.doughDate)).toEqual([SAT, TUE])
    expect(
      allLines(view).find((l: any) => l.itemId === 'test-doppel')
    ).toMatchObject({ total: 44, bakeDate: TUE })
    expect(view.deltaTotals['test-doppel|']).toMatchObject({ qty: 3 })
    expect(view.deltaTotals['test-plunder|']).toMatchObject({ qty: 2 })
    expect(await service.getBakeLines(MON)).toBeNull()
    // Sunday: Saturday's sheet is the only source, still confirmed.
    expect((await service.getBakeLines(SUN))?.status).toBe('confirmed')
  })

  it('reopen frees the pairs: Saturday is a draft with its Tuesday rolls again', async () => {
    const res = await as('inhaber')
      .post(`/api/backzettel/${SAT}/reopen`)
      .send({ reason: 'Testgrund' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'draft', sheetVersion: 2 })
    // The preorder is now part of the live draft (4 + 3).
    expect(line(res.body.data, `test-doppel|@${TUE}`)).toMatchObject({
      preorders: 7,
      total: 47,
    })
    expect(await BackzettelDelta.count({ where: { date: SAT } })).toBe(0)
    const list = (await as('verkauf').get(`/api/backzettel/${TUE}/bake-list`))
      .body.data
    expect(list.sources.map((s: any) => [s.doughDate, s.status])).toEqual([
      [SAT, 'draft'],
      [TUE, 'confirmed'],
    ])
  })
})

describe('transition: a Tuesday confirmed before Z10 (legacy plan)', () => {
  beforeAll(async () => {
    // As the migration leaves a day confirmed before Z10: rows with
    // bake_date = date, a snapshot without plan.
    await BackzettelDay.create({
      date: TUE2,
      status: 'confirmed',
      confirmedAt: new Date('2026-11-20T08:00:00Z'),
      preorderSnapshot: [],
      computedSnapshot: {
        hefeteig: null,
        fillings: [],
        prep: [],
        warnings: [],
      },
    })
    for (const [itemId, total] of [
      ['test-doppel', 40],
      ['test-stern', 12],
    ] as const) {
      await BackzettelLine.create({
        date: TUE2,
        bakeDate: TUE2,
        itemId,
        variant: '',
        name: itemId,
        section: 'broetchen',
        unit: 'Stück',
        base: total,
        total,
      })
    }
  })

  it('reads as a v1 day', async () => {
    const day = (await as('verkauf').get(`/api/backzettel/${TUE2}`)).body.data
    expect(day).toMatchObject({
      status: 'confirmed',
      sheetVersion: 1,
      plan: { version: 1, bakeDates: [{ date: TUE2, itemIds: null }] },
    })
    expect(day.machine).toBeUndefined()
    expect(line(day, 'test-doppel|')).toMatchObject({
      bakeDate: TUE2,
      lead: 0,
      total: 40,
    })
  })

  it('Saturday’s draft skips the pairs the old Tuesday holds', async () => {
    const day = (await as('backstube').get(`/api/backzettel/${SAT2}`)).body.data
    // A day confirmed before Z10 holds every item of its date (legacy plan)
    // - also the ones it had no line for: none of Tuesday's rolls are here,
    // Sunday's are.
    for (const id of [
      'test-doppel',
      'test-stern',
      'test-kaese',
      'test-flitweck',
    ])
      expect(line(day, `${id}|@${TUE2}`)).toBeUndefined()
    expect(line(day, `test-kaese|@${'2026-12-06'}`)).toMatchObject({ total: 8 })
    expect(day.bakeDates.find((b: any) => b.date === TUE2).lineCount).toBe(0)
    const warning = day.warnings.find((w: any) => w.code === 'owned_elsewhere')
    expect(warning.message).toMatch(/Testdoppel \(für Dienstag\)/)
    const res = await as('backstube')
      .put(`/api/backzettel/${SAT2}/lines/test-doppel/correction`)
      .send({ correction: 2, reason: 'Testgrund', bakeDate: TUE2 })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'owned_elsewhere',
      sheetDate: TUE2,
    })
    expect(res.body.message).toMatch(
      /freigegebenen Zettel vom Dienstag, 08\.12\./
    )
  })

  it('a later preorder is one delta, on the old Tuesday - never twice', async () => {
    const sat = await as('backstube').post(`/api/backzettel/${SAT2}/confirm`)
    expect(sat.status).toBe(200)
    expect(
      sat.body.data.plan.bakeDates.find((b: any) => b.date === TUE2).itemIds
    ).toEqual([])
    const before = await BackzettelDelta.count()
    await apiPreorder(TUE2, [
      { productId: 'test-doppel', quantity: 5 },
      { productId: 'test-kaese', quantity: 1 },
    ])
    const rows = await BackzettelDelta.findAll({
      where: { date: [SAT2, TUE2] },
      order: [['id', 'ASC']],
    })
    expect(await BackzettelDelta.count()).toBe(before + 2)
    expect(
      rows.map((r) => [r.date, r.bakeDate, r.itemId, Number(r.qty)])
    ).toEqual([
      [TUE2, TUE2, 'test-doppel', 5],
      [TUE2, TUE2, 'test-kaese', 1],
    ])
    const list = (await as('verkauf').get(`/api/backzettel/${TUE2}/bake-list`))
      .body.data
    expect(list.sources.map((s: any) => [s.doughDate, s.status])).toEqual([
      [SAT2, 'confirmed'],
      [TUE2, 'confirmed'],
    ])
    expect(list.warnings.map((w: any) => w.code)).not.toContain(
      'duplicate_bake_line'
    )
    expect(list.sources.map((s: any) => s.lineCount)).toEqual([0, 2])
    const lines = list.sections.flatMap((s: any) => s.lines)
    expect(
      lines
        .filter((l: any) => l.itemId === 'test-doppel')
        .map((l: any) => [l.total, l.doughDate])
    ).toEqual([[40, TUE2]])
    expect(list.deltas.map((d: any) => [d.itemId, d.doughDate])).toEqual([
      ['test-doppel', TUE2],
      ['test-kaese', TUE2],
    ])
  })
})

describe('transition: a Saturday confirmed before Z10', () => {
  const SAT3 = '2026-12-12'
  const TUE3 = '2026-12-15'

  it('Tuesday’s own draft takes the rolls no sheet holds, and says why', async () => {
    await BackzettelDay.create({
      date: SAT3,
      status: 'confirmed',
      confirmedAt: new Date('2026-11-20T08:00:00Z'),
      preorderSnapshot: [],
      computedSnapshot: {
        hefeteig: null,
        fillings: [],
        prep: [],
        warnings: [],
      },
    })
    // A correction on Tuesday's sheet for its rolls is accepted there.
    const corr = await as('backstube')
      .put(`/api/backzettel/${TUE3}/lines/test-doppel/correction`)
      .send({ correction: 3, reason: 'Testgrund' })
    expect(corr.status).toBe(200)
    const tue = (await as('backstube').get(`/api/backzettel/${TUE3}`)).body.data
    // On Tuesday's sheet, made that day; the stored correction counts.
    expect(line(tue, 'test-doppel|')).toMatchObject({
      bakeDate: TUE3,
      doughDate: TUE3,
      lead: 0,
      adopted: true,
      correction: 3,
    })
    expect(
      tue.plan.bakeDates.find((b: any) => b.date === TUE3).itemIds
    ).toEqual(expect.arrayContaining(['test-doppel', 'test-stern']))
    const adopted = tue.warnings.find((w: any) => w.code === 'adopted_orphans')
    expect(adopted).toMatchObject({
      doughDate: SAT3,
      items: expect.arrayContaining(['test-doppel', 'test-stern']),
    })
    expect(adopted.message).toMatch(
      /Testdoppel.*der Zettel vom Samstag, 12\.12\. schon freigegeben ist/
    )
    // The old Saturday says where they went.
    const sat = (await as('backstube').get(`/api/backzettel/${SAT3}`)).body.data
    const moved = sat.warnings.find(
      (w: any) => w.code === 'moved_to_bake_day' && w.bakeDate === TUE3
    )
    expect(moved.message).toMatch(
      /stehen nicht auf diesem Zettel .* sondern auf dem Zettel vom Dienstag, 15\.12\./
    )
    // The bake list has them from Tuesday's draft - nothing lost.
    const list = (await as('verkauf').get(`/api/backzettel/${TUE3}/bake-list`))
      .body.data
    expect(list.warnings.map((w: any) => w.code)).not.toContain(
      'not_on_confirmed_sheet'
    )
    expect(list.sources.map((s: any) => s.doughDate)).toEqual([TUE3])
    expect(
      list.sections
        .flatMap((s: any) => s.lines)
        .find((l: any) => l.itemId === 'test-doppel')
    ).toMatchObject({ doughDate: TUE3, correction: 3 })
  })

  it('confirming Tuesday freezes them into its plan', async () => {
    const res = await as('backstube').post(`/api/backzettel/${TUE3}/confirm`)
    expect(res.status).toBe(200)
    expect(
      res.body.data.plan.bakeDates.find((b: any) => b.date === TUE3).itemIds
    ).toEqual(expect.arrayContaining(['test-doppel', 'test-stern']))
    expect(
      await BackzettelLine.count({
        where: { date: TUE3, itemId: 'test-doppel' },
      })
    ).toBe(1)
    const list = (await as('verkauf').get(`/api/backzettel/${TUE3}/bake-list`))
      .body.data
    expect(list.warnings.map((w: any) => w.code)).not.toContain(
      'not_on_confirmed_sheet'
    )
  })

  it('if Tuesday was confirmed without them too, both the sheet and the bake list say so', async () => {
    const SAT4 = '2026-12-19'
    const TUE4 = '2026-12-22'
    for (const date of [SAT4, TUE4]) {
      await BackzettelDay.create({
        date,
        status: 'confirmed',
        confirmedAt: new Date('2026-11-20T08:00:00Z'),
        preorderSnapshot: [],
        computedSnapshot: {
          hefeteig: null,
          fillings: [],
          prep: [],
          warnings: [],
          // v2 sheets that hold nothing of Tuesday's rolls
          plan: {
            version: 2,
            doughDate: date,
            bakeDates: [{ date, itemIds: [] }],
            knownItems: fixture.configV2().items.map((i: any) => i.id),
          },
        },
      })
    }
    const list = (await as('verkauf').get(`/api/backzettel/${TUE4}/bake-list`))
      .body.data
    const warning = list.warnings.find(
      (w: any) => w.code === 'not_on_confirmed_sheet' && w.doughDate === SAT4
    )
    expect(warning).toMatchObject({
      doughDate: SAT4,
      items: expect.arrayContaining(['test-doppel', 'test-stern']),
    })
    expect(warning.message).toMatch(
      /Testdoppel.*stehen auf keinem Zettel: der Zettel vom Samstag, 19\.12\. wurde vor der Umstellung freigegeben/
    )
    for (const date of [TUE4, SAT4]) {
      const day = (await as('backstube').get(`/api/backzettel/${date}`)).body
        .data
      expect(
        day.warnings.find(
          (w: any) =>
            w.code === 'not_on_confirmed_sheet' &&
            w.doughDate === SAT4 &&
            w.bakeDate === TUE4
        )
      ).toMatchObject({ items: expect.arrayContaining(['test-doppel']) })
    }
  })
})

describe('transition: a legacy Tuesday reopened after Saturday’s v2 confirm', () => {
  it('Tuesday’s draft takes its rolls back; nothing is lost', async () => {
    // TUE2 (legacy) and SAT2 (v2, Tuesday itemIds []) are confirmed above.
    const reopened = await as('inhaber')
      .post(`/api/backzettel/${TUE2}/reopen`)
      .send({ reason: 'Testgrund' })
    expect(reopened.status).toBe(200)
    const tue = reopened.body.data
    expect(line(tue, 'test-doppel|')).toMatchObject({
      doughDate: TUE2,
      adopted: true,
    })
    expect(tue.warnings.map((w: any) => w.code)).toContain('adopted_orphans')
    const sat = (await as('backstube').get(`/api/backzettel/${SAT2}`)).body.data
    expect(
      sat.warnings.find(
        (w: any) => w.code === 'moved_to_bake_day' && w.bakeDate === TUE2
      )
    ).toBeTruthy()
    // A new preorder shows live on Tuesday's draft (no delta needed).
    await apiPreorder(TUE2, [{ productId: 'test-doppel', quantity: 7 }])
    const after = (await as('backstube').get(`/api/backzettel/${TUE2}`)).body
      .data
    expect(line(after, 'test-doppel|').preorders).toBeGreaterThanOrEqual(7)
    const confirmed = await as('backstube').post(
      `/api/backzettel/${TUE2}/confirm`
    )
    expect(confirmed.status).toBe(200)
    expect(
      await BackzettelLine.count({
        where: { date: TUE2, bakeDate: TUE2, itemId: 'test-doppel' },
      })
    ).toBe(1)
    const svc = createBackzettelService(
      createBackzettelSource({ hqDir, cacheMs: 0 })
    )
    const bake: any = await svc.getBakeLines(TUE2)
    expect(bake.status).toBe('confirmed')
    expect(
      allLines(bake).find((l: any) => l.itemId === 'test-doppel')
    ).toBeTruthy()
  })
})

describe('configChangedSinceConfirm on a dough-day sheet', () => {
  // Saturday 2027-01-02: bread, Hefeteig, rolls for Sunday and Tuesday.
  const SAT6 = '2027-01-02'
  const writeConfig = (cfg: unknown) =>
    fs.writeFileSync(
      path.join(hqDir, 'config', 'backzettel.yaml'),
      JSON.stringify(cfg, null, 2)
    )
  const changedAfter = async (edit: (cfg: any) => unknown) => {
    const cfg = fixture.configV2()
    writeConfig(edit(cfg) ?? cfg)
    const res = await as('backstube').get(`/api/backzettel/${SAT6}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      status: 'confirmed',
      sheetVersion: 2,
    })
    return res.body.data.configChangedSinceConfirm
  }
  const byId = (list: any[], id: string) => list.find((x) => x.id === id)

  beforeAll(async () => {
    const res = await as('backstube').post(`/api/backzettel/${SAT6}/confirm`)
    expect(res.status).toBe(200)
    expect(res.body.data.configChangedSinceConfirm).toBe(false)
  })
  afterEach(() => writeHq(hqDir))

  it('stays false while the master data are unchanged', async () => {
    expect(await changedAfter(() => undefined)).toBe(false)
  })

  it('a changed kg_per_liter (machine strip)', async () => {
    expect(
      await changedAfter((cfg) => {
        byId(cfg.doughs, 'test-weck-teig').kg_per_liter = 4
      })
    ).toBe(true)
  })

  it('a changed Bruch weight (rolls)', async () => {
    expect(
      await changedAfter((cfg) => {
        byId(cfg.items, 'test-doppel').bruch.g = 1300
      })
    ).toBe(true)
  })

  it('a changed dough_g of a bread size', async () => {
    expect(
      await changedAfter((cfg) => {
        byId(cfg.items, 'test-korn').sizes[0].dough_g = 650
      })
    ).toBe(true)
  })

  it('a changed lead (the rolls would now be made on their bake day)', async () => {
    expect(
      await changedAfter((cfg) => {
        byId(cfg.items, 'test-doppel').lead = 0
      })
    ).toBe(true)
  })

  it('master data swapped back to v1 (no doughs, sizes, Bruch or lead)', async () => {
    expect(
      await changedAfter((cfg) => {
        const { dough_days, bruch_pieces, ...rest } = cfg
        void dough_days
        void bruch_pieces
        return {
          ...rest,
          items: cfg.items
            .filter((i: any) => !i.sizes)
            .map((i: any) => {
              const { lead, bruch, dough, ...item } = i
              void lead
              void bruch
              return i.section === 'hefeteig' ? { ...item, dough } : item
            }),
          // Hefeteig unchanged: only the v2 parts tell the difference
          doughs: cfg.doughs.filter((d: any) => d.id === 'test-hefe'),
        }
      })
    ).toBe(true)
    // the swapped config is valid - the answer is a real comparison
    const day = (await as('backstube').get(`/api/backzettel/${SAT6}`)).body.data
    expect(day.configStatus).toBe('ok')
  })

  // A lead that only moves Sunday's bread: nothing leaves Saturday's sheet,
  // the Sunday bread newly lands on it.
  const sundayBreadOnSaturday = (cfg: any) => {
    byId(cfg.items, 'test-holz').lead = { 7: 1 }
  }

  it('an item newly moved onto this dough day by a lead', async () => {
    expect(await changedAfter(sundayBreadOnSaturday)).toBe(true)
  })

  it('not while another confirmed sheet holds the pair, again once it is reopened', async () => {
    const SUN6 = '2027-01-03'
    const confirmed = await as('backstube').post(
      `/api/backzettel/${SUN6}/confirm`
    )
    expect(confirmed.status).toBe(200)
    // Sunday's own sheet keeps its bread - Saturday would not compute it
    expect(await changedAfter(sundayBreadOnSaturday)).toBe(false)
    const reopened = await as('inhaber')
      .post(`/api/backzettel/${SUN6}/reopen`)
      .send({ reason: 'Testgrund' })
    expect(reopened.status).toBe(200)
    // now the master data put it on Saturday's sheet, which lacks it
    expect(await changedAfter(sundayBreadOnSaturday)).toBe(true)
  })
})

describe('configChangedSinceConfirm: a pair another sheet held at confirm', () => {
  // Sunday is confirmed first (bread on its own sheet), then hq moves the
  // Sunday bread to Saturday and Saturday is confirmed without it
  // (`owned_elsewhere`). Reopening Sunday changes ownership, not the master
  // data - Saturday must not say "Stammdaten geändert".
  const SAT7 = '2027-01-16'
  const SUN7 = '2027-01-17'
  afterAll(() => writeHq(hqDir))

  it('stays false after the owner is reopened', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${SUN7}/confirm`)).status
    ).toBe(200)
    const cfg = fixture.configV2()
    cfg.items.find((i: any) => i.id === 'test-holz').lead = { 7: 1 }
    fs.writeFileSync(
      path.join(hqDir, 'config', 'backzettel.yaml'),
      JSON.stringify(cfg, null, 2)
    )
    const sat = await as('backstube').post(`/api/backzettel/${SAT7}/confirm`)
    expect(sat.status).toBe(200)
    expect(sat.body.data.warnings.map((w: any) => w.code)).toContain(
      'owned_elsewhere'
    )
    expect(sat.body.data.configChangedSinceConfirm).toBe(false)
    const reopened = await as('inhaber')
      .post(`/api/backzettel/${SUN7}/reopen`)
      .send({ reason: 'Testgrund' })
    expect(reopened.status).toBe(200)
    const res = await as('backstube').get(`/api/backzettel/${SAT7}`)
    expect(res.body.data.status).toBe('confirmed')
    expect(res.body.data.configChangedSinceConfirm).toBe(false)
  })
})

describe('an item added to hq after a sheet was confirmed', () => {
  const SAT5 = '2027-01-09'
  afterAll(() => writeHq(hqDir))

  it('its preorders become Nachträge on that sheet (as in v1)', async () => {
    const res = await as('backstube').post(`/api/backzettel/${SAT5}/confirm`)
    expect(res.status).toBe(200)
    expect(res.body.data.plan.knownItems).toContain('test-doppel')
    // hq adds a lead-0 item and moves a product onto it
    const cfg = fixture.configV2()
    const plunder = cfg.items.find((i: any) => i.id === 'test-plunder')
    const product = plunder.products[0].id
    plunder.products = []
    cfg.items.push({
      id: 'test-neu',
      name: 'Testneu',
      section: plunder.section,
      unit: 'Stück',
      products: [{ id: product }],
      base: {},
    })
    fs.writeFileSync(
      path.join(hqDir, 'config', 'backzettel.yaml'),
      JSON.stringify(cfg, null, 2)
    )
    await apiPreorder(SAT5, [{ productId: product, quantity: 4 }])
    const rows = await BackzettelDelta.findAll({ where: { date: SAT5 } })
    expect(rows.map((r) => [r.itemId, Number(r.qty)])).toEqual([
      ['test-neu', 4],
    ])
  })
})

describe('the bake list without master data', () => {
  afterAll(() => writeHq(hqDir))

  it('still lists the confirmed sheets’ lines (Sunday from Saturday)', async () => {
    // SAT2 (2026-12-05) is confirmed above; its Sunday rolls are frozen.
    const SUN2 = '2026-12-06'
    fs.writeFileSync(
      path.join(hqDir, 'config', 'backzettel.yaml'),
      'version: [kaputt'
    )
    const res = await as('backstube').get(`/api/backzettel/${SUN2}/bake-list`)
    expect(res.status).toBe(200)
    const list = res.body.data
    expect(list).toMatchObject({ status: 'ok', configStatus: 'no-config' })
    expect(list.warnings.map((w: any) => w.code)).toContain('no_config')
    expect(list.sources.map((s: any) => [s.doughDate, s.status])).toEqual([
      [SAT2, 'confirmed'],
    ])
    const lines = list.sections.flatMap((s: any) => s.lines)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l: any) => l.bakeDate === SUN2)).toBe(true)
    // A day no confirmed sheet feeds stays no-config.
    const later = (
      await as('backstube').get('/api/backzettel/2027-02-03/bake-list')
    ).body.data
    expect(later.status).toBe('no-config')
  })
})

describe('calendar (U9): holidays and closing days from kalender.yaml', () => {
  // Synthetic calendar: the legal holidays (formula) plus invented closing
  // days and a dough-only day in January.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kalender = require('../../src/services/kalender.core')
  const kalenderFile = () => path.join(hqDir, 'config', 'kalender.yaml')
  const feiertage = (year: number) =>
    kalender
      .holidaysSaarland(year)
      .map((h: any) => ({ datum: h.date, name: h.name }))
  const writeKalender = (raw: unknown) =>
    fs.writeFileSync(kalenderFile(), JSON.stringify(raw, null, 2))

  beforeAll(() =>
    writeKalender({
      version: 1,
      bundesland: 'saarland',
      feiertage: { 2026: feiertage(2026), 2027: feiertage(2027) },
      tage: [
        {
          von: '2027-01-02',
          bis: '2027-01-04',
          typ: 'geschlossen',
          notiz: 'Betriebsferien',
        },
        { datum: '2027-01-04', typ: 'teigtag', notiz: 'Teig für Dienstag' },
      ],
    })
  )
  afterAll(() => fs.rmSync(kalenderFile(), { force: true }))

  it('a holiday is 409 geschlossen with its name; the bake list says so', async () => {
    const res = await as('backstube').get('/api/backzettel/2026-12-25')
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'geschlossen' })
    expect(res.body.message).toMatch(/1\. Weihnachtstag - geschlossen/)
    const list = await as('backstube').get(
      '/api/backzettel/2026-12-25/bake-list'
    )
    expect(list.status).toBe(200)
    expect(list.body.data).toMatchObject({
      status: 'geschlossen',
      note: '1. Weihnachtstag',
      sections: [],
    })
  })

  it('Thursday before the closed Friday + Saturday makes Sunday and Tuesday', async () => {
    const res = await as('backstube').get('/api/backzettel/2026-12-24')
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(day.dayKind).toMatchObject({
      kind: 'normal',
      before: { type: 'samstag_ersatz' },
      label: 'Samstags-Satz',
    })
    expect(day.calendarHint).toBeNull()
    expect(day.bakeDates.map((b: any) => b.date)).toEqual([
      '2026-12-24',
      '2026-12-27',
      '2026-12-29',
    ])
    expect(day.warnings.map((w: any) => w.code)).toEqual(
      expect.arrayContaining(['dough_day_far', 'special_base_missing'])
    )
    // Sunday's bake list: the rolls come from Thursday
    const sun = await as('backstube').get(
      '/api/backzettel/2026-12-27/bake-list'
    )
    expect(sun.body.data.sources.map((s: any) => s.doughDate)).toContain(
      '2026-12-24'
    )
  })

  it('Samstags-Satz: an item with base.samstag_ersatz is planned, not asked about again (Z14)', async () => {
    const cfg = fixture.configV2()
    const kranz = cfg.items.find((i: any) => i.id === 'test-kranz')
    kranz.base = { ...kranz.base, samstag_ersatz: 3 }
    fs.writeFileSync(
      path.join(hqDir, 'config', 'backzettel.yaml'),
      JSON.stringify(cfg, null, 2)
    )
    try {
      const res = await as('backstube').get('/api/backzettel/2026-12-24')
      expect(res.status).toBe(200)
      const day = res.body.data
      expect(day.dayKind).toMatchObject({ label: 'Samstags-Satz' })
      const codes = day.warnings.map((w: any) => w.code)
      expect(codes).not.toContain('special_base_missing')
      const specials = day.warnings.find(
        (w: any) => w.code === 'closed_day_specials' && w.date === '2026-12-26'
      )
      // Saturday-only items without the column are still asked about …
      expect(specials.items).toContain('test-party')
      // … the one with the column is on the sheet with that quantity.
      expect(specials.items).not.toContain('test-kranz')
      expect(specials.message).not.toMatch(/Testkranz/)
      const line = day.sections
        .flatMap((s: any) => s.lines)
        .find((l: any) => l.itemId === 'test-kranz')
      expect(line).toMatchObject({ base: 3 })
    } finally {
      writeHq(hqDir)
    }
  })

  it('a dough-only day has a sheet (dough for Tuesday) but no bake list', async () => {
    const res = await as('backstube').get('/api/backzettel/2027-01-04')
    expect(res.status).toBe(200)
    expect(res.body.data.dayKind).toMatchObject({
      kind: 'teigtag',
      label: 'Nur Teig (Laden geschlossen)',
    })
    expect(res.body.data.bakeDates.map((b: any) => b.date)).toEqual([
      '2027-01-05',
    ])
    const list = await as('backstube').get(
      '/api/backzettel/2027-01-04/bake-list'
    )
    expect(list.body.data.status).toBe('ruhetag')
    expect(list.body.data.message).toMatch(/nur Teig/)
  })

  it('missing or invalid calendar: weekly plan as before, with a hint', async () => {
    writeKalender({ version: 1, bundesland: 'saarland', tage: [] })
    const invalid = await as('backstube').get('/api/backzettel/2026-12-25')
    expect(invalid.status).toBe(200)
    expect(invalid.body.data.calendarHint).toMatchObject({
      code: 'calendar_invalid',
    })
    fs.rmSync(kalenderFile(), { force: true })
    const missing = await as('backstube').get('/api/backzettel/2026-12-25')
    expect(missing.status).toBe(200)
    expect(missing.body.data.calendarHint).toMatchObject({
      code: 'calendar_missing',
    })
    expect(missing.body.data.dayKind).toMatchObject({
      kind: 'normal',
      calendar: 'missing',
    })
  })
})
