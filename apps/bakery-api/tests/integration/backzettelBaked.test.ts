/**
 * Z10, owner decision O5 (2026-11-08): the „gebacken“ tick on the bake list,
 * separate from the dough-day „done“ tick (docs/backzettel-v2.md §8,
 * docs/api/backzettel.md). Synthetic master data `configV2()` (invented
 * numbers, nothing from hq) in a temp "hq", like backzettelV2.test.ts - own
 * file because the models are process-global.
 *
 *   Sa 2026-11-28  sheet: bread for Saturday, rolls for So + Di
 *   So 2026-11-29  bake list: the rolls from Saturday's sheet
 *   Di 2026-12-01  bake list: Tuesday's rolls (Saturday) + Tuesday's bread
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import {
  AuditLog,
  BackzettelDelta,
  BackzettelLine,
  PartnerDeliveryTemplate,
} from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(30000)

const PINNED_NOW = new Date('2026-11-20T09:00:00Z')
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const TUE = '2026-12-01'

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
  fs.writeFileSync(
    path.join(dir, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.configV2(), null, 2)
  )
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

const linesOf = (view: any): any[] => view.sections.flatMap((s: any) => s.lines)

async function bakeList(date: string): Promise<any> {
  const res = await as('backstube').get(`/api/backzettel/${date}/bake-list`)
  expect(res.status).toBe(200)
  return res.body.data
}

async function bakeLine(date: string, itemId: string): Promise<any> {
  const line = linesOf(await bakeList(date)).find(
    (l: any) => l.itemId === itemId
  )
  expect(line).toBeDefined()
  return line
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z10-baked-hq-'))
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
  tokens.inhaber = await sessionFor(api.app, 'bk.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'bk.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'bk.verkauf', 'verkauf')
  tokens.fahrer = await sessionFor(api.app, 'bk.fahrer', 'fahrer')
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

describe('gebacken on a draft sheet', () => {
  it('a stored row of a draft sheet is 409 not_confirmed, naming the dough day', async () => {
    // A correction stores the row while Saturday is still a draft.
    const put = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/test-stern/correction`)
      .send({ correction: 2, reason: 'Testgrund', bakeDate: SUN })
    expect(put.status).toBe(200)
    const stern = await bakeLine(SUN, 'test-stern')
    expect(stern).toMatchObject({
      sheetStatus: 'draft',
      id: expect.any(Number),
      bakedAt: null,
      bakedBy: null,
    })
    const res = await as('backstube').post(
      `/api/backzettel/${SUN}/bake/${stern.id}/baked`
    )
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'not_confirmed',
      doughDate: SAT,
      message: expect.stringContaining('Samstag, 28.11.'),
    })
  })
})

describe('gebacken on a confirmed sheet', () => {
  beforeAll(async () => {
    const res = await as('backstube').post(`/api/backzettel/${SAT}/confirm`)
    expect(res.status).toBe(200)
  })

  it('ticks a Sunday row of Saturday’s sheet, separate from „done“', async () => {
    const doppel = await bakeLine(SUN, 'test-doppel')
    expect(doppel).toMatchObject({
      doughDate: SAT,
      sheetStatus: 'confirmed',
      doneAt: null,
      bakedAt: null,
      previouslyBaked: null,
    })
    const res = await as('backstube')
      .post(`/api/backzettel/${SUN}/bake/${doppel.id}/baked`)
      .send({ expectedTotal: doppel.total })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      id: doppel.id,
      date: SAT,
      bakeDate: SUN,
      itemId: 'test-doppel',
      variant: null,
      bakedAt: expect.any(String),
      bakedBy: { id: expect.any(Number), displayName: 'Test bk.backstube' },
    })
    const after = await bakeLine(SUN, 'test-doppel')
    expect(after.bakedAt).toBe(res.body.data.bakedAt)
    expect(after.bakedBy).toEqual(res.body.data.bakedBy)
    // „done“ (made, on Saturday's sheet) stays as it was.
    expect(after.doneAt).toBeNull()
    // The dough-day sheet carries it too (additive).
    const sat = (await as('backstube').get(`/api/backzettel/${SAT}`)).body.data
    const onSheet = linesOf(sat).find((l: any) => l.id === doppel.id)
    expect(onSheet).toMatchObject({ bakedAt: after.bakedAt, doneAt: null })
  })

  it('is idempotent and audited once; unbaked clears it', async () => {
    const doppel = await bakeLine(SUN, 'test-doppel')
    const again = await as('backstube').post(
      `/api/backzettel/${SUN}/bake/${doppel.id}/baked`
    )
    expect(again.status).toBe(200)
    expect(again.body.data.bakedAt).toBe(doppel.bakedAt)
    expect(
      await AuditLog.count({
        where: { action: 'line_baked', entityId: String(doppel.id) },
      })
    ).toBe(1)
    const audit = await AuditLog.findOne({
      where: { action: 'line_baked', entityId: String(doppel.id) },
    })
    expect(audit?.data).toMatchObject({
      date: SAT,
      bakeDate: SUN,
      itemId: 'test-doppel',
      total: doppel.total,
    })

    const kaese = await bakeLine(SUN, 'test-kaese')
    await as('inhaber').post(`/api/backzettel/${SUN}/bake/${kaese.id}/baked`)
    const off = await as('inhaber').post(
      `/api/backzettel/${SUN}/bake/${kaese.id}/unbaked`
    )
    expect(off.status).toBe(200)
    expect(off.body.data).toMatchObject({ bakedAt: null, bakedBy: null })
    expect((await bakeLine(SUN, 'test-kaese')).bakedAt).toBeNull()
    expect(
      await AuditLog.count({
        where: { action: 'line_unbaked', entityId: String(kaese.id) },
      })
    ).toBe(1)
  })

  it('a done tick does not tick baked, and the other way round', async () => {
    const stern = await bakeLine(SUN, 'test-stern')
    const done = await as('backstube')
      .post(`/api/backzettel/${SAT}/lines/${stern.id}/done`)
      .send({ expectedTotal: stern.total })
    expect(done.status).toBe(200)
    expect(await bakeLine(SUN, 'test-stern')).toMatchObject({
      doneAt: expect.any(String),
      bakedAt: null,
    })
  })

  it('a row of another bake day is 404 not_on_bake_list', async () => {
    const doppel = await bakeLine(SUN, 'test-doppel')
    const res = await as('backstube').post(
      `/api/backzettel/${TUE}/bake/${doppel.id}/baked`
    )
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: 'not_on_bake_list',
      bakeDate: SUN,
      message: expect.stringContaining('Sonntag, 29.11.'),
    })
  })

  it('400 invalid_date / validation, 404 not_found, 409 line_changed', async () => {
    const flit = await bakeLine(SUN, 'test-flitweck')
    const bad = await as('backstube').post(
      `/api/backzettel/2026-02-30/bake/${flit.id}/baked`
    )
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'invalid_date' })
    const badId = await as('backstube').post(
      `/api/backzettel/${SUN}/bake/abc/baked`
    )
    expect(badId.status).toBe(400)
    expect(badId.body).toMatchObject({ error: 'validation' })
    const gone = await as('backstube').post(
      `/api/backzettel/${SUN}/bake/999999/baked`
    )
    expect(gone.status).toBe(404)
    expect(gone.body).toMatchObject({ error: 'not_found' })
    // The tablet showed fewer than are due now.
    const stale = await as('backstube')
      .post(`/api/backzettel/${SUN}/bake/${flit.id}/baked`)
      .send({ expectedTotal: flit.total - 5 })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({
      error: 'line_changed',
      total: flit.total,
      message: expect.stringContaining('Der Haken wurde nicht gesetzt.'),
    })
    expect((await bakeLine(SUN, 'test-flitweck')).bakedAt).toBeNull()
  })

  it('verkauf and fahrer may not tick', async () => {
    const flit = await bakeLine(SUN, 'test-flitweck')
    for (const role of ['verkauf', 'fahrer'] as const) {
      const res = await as(role).post(
        `/api/backzettel/${SUN}/bake/${flit.id}/baked`
      )
      expect(res.status).toBe(403)
      const deltas = await as(role)
        .post(`/api/backzettel/${SUN}/bake/deltas/baked`)
        .send({ ids: [1] })
      expect(deltas.status).toBe(403)
    }
  })
})

describe('gebacken for a Nachtrag', () => {
  let first: number

  it('a Nachtrag is ticked on its own; baked means seen', async () => {
    await apiPreorder(SUN, [{ productId: 'test-doppel', quantity: 3 }])
    const list = await bakeList(SUN)
    expect(list.deltas).toEqual([
      expect.objectContaining({
        itemId: 'test-doppel',
        doughDate: SAT,
        qty: 3,
        bakedAt: null,
        bakedBy: null,
        acknowledgedAt: null,
      }),
    ])
    first = list.deltas[0].id
    const doppel = linesOf(list).find((l: any) => l.itemId === 'test-doppel')
    expect(doppel.delta).toMatchObject({
      qty: 3,
      count: 1,
      open: 1,
      baked: 0,
      bakedQty: 0,
    })
    expect(doppel.delta.bakeUnbaked).toBe(doppel.delta.bake)

    const res = await as('backstube')
      .post(`/api/backzettel/${SUN}/bake/deltas/baked`)
      .send({ ids: [first] })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: first,
        date: SAT,
        bakeDate: SUN,
        bakedAt: expect.any(String),
        bakedBy: { id: expect.any(Number), displayName: 'Test bk.backstube' },
        acknowledgedAt: expect.any(String),
      }),
    ])
    const after = await bakeLine(SUN, 'test-doppel')
    expect(after.delta).toMatchObject({
      open: 0,
      baked: 1,
      bakedQty: 3,
      bakeUnbaked: 0,
    })
    // The line's own tick (frozen total) is not touched by it.
    expect(after.bakedAt).toEqual(expect.any(String))
    const audit = await AuditLog.findOne({
      where: { action: 'delta_baked', entityId: String(first) },
    })
    expect(audit?.data).toMatchObject({
      date: SAT,
      bakeDate: SUN,
      qty: 3,
      acknowledged: true,
    })
  })

  it('a later Nachtrag for the same row stays open; unbaked keeps „Gesehen“', async () => {
    await apiPreorder(SUN, [{ productId: 'test-doppel', quantity: 2 }])
    const list = await bakeList(SUN)
    const doppel = linesOf(list).find((l: any) => l.itemId === 'test-doppel')
    expect(doppel.delta).toMatchObject({
      qty: 5,
      count: 2,
      baked: 1,
      bakedQty: 3,
    })
    expect(doppel.delta.bakeUnbaked).toBeGreaterThan(0)
    const second = list.deltas.find((d: any) => d.id !== first)
    expect(second).toMatchObject({ bakedAt: null, acknowledgedAt: null })

    const off = await as('backstube')
      .post(`/api/backzettel/${SUN}/bake/deltas/unbaked`)
      .send({ ids: [first] })
    expect(off.status).toBe(200)
    expect(off.body.data[0]).toMatchObject({
      bakedAt: null,
      bakedBy: null,
      acknowledgedAt: expect.any(String),
    })
  })

  it('all or nothing: 404 not_found / not_on_bake_list, 400 validation', async () => {
    const ids = (await BackzettelDelta.findAll()).map((d) => d.id)
    const missing = await as('backstube')
      .post(`/api/backzettel/${SUN}/bake/deltas/baked`)
      .send({ ids: [...ids, 999999] })
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ error: 'not_found' })
    const other = await as('backstube')
      .post(`/api/backzettel/${TUE}/bake/deltas/baked`)
      .send({ ids })
    expect(other.status).toBe(404)
    expect(other.body).toMatchObject({
      error: 'not_on_bake_list',
      bakeDate: SUN,
    })
    expect(
      await BackzettelDelta.count({ where: { bakedAt: null } as any })
    ).toBe(ids.length)
    for (const body of [{}, { ids: [] }, { ids: ['x'] }, { ids: [0] }]) {
      const res = await as('backstube')
        .post(`/api/backzettel/${SUN}/bake/deltas/baked`)
        .send(body)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'validation' })
    }
  })
})

describe('tick survival on reopen and re-confirm (per row)', () => {
  it('a draft hides a baked tick whose row now asks for more; re-confirm clears it', async () => {
    // Before: Doppel (Sunday) baked; Käse (Sunday) baked; Nachträge +5 Doppel.
    const kaese = await bakeLine(SUN, 'test-kaese')
    await as('backstube').post(`/api/backzettel/${SUN}/bake/${kaese.id}/baked`)
    const doppelBefore = await bakeLine(SUN, 'test-doppel')
    expect(doppelBefore.bakedAt).toEqual(expect.any(String))

    const reopen = await as('inhaber')
      .post(`/api/backzettel/${SAT}/reopen`)
      .send({ reason: 'Testgrund' })
    expect(reopen.status).toBe(200)
    // The Nachträge are gone with their ticks (folded into the draft).
    expect(await BackzettelDelta.count({ where: { date: SAT } })).toBe(0)
    const draftList = await bakeList(SUN)
    const draftDoppel = linesOf(draftList).find(
      (l: any) => l.itemId === 'test-doppel'
    )
    expect(draftDoppel).toMatchObject({
      sheetStatus: 'draft',
      total: doppelBefore.total + 5,
      bakedAt: null,
    })
    // Käse asks for the same as before: the tick shows.
    expect(
      linesOf(draftList).find((l: any) => l.itemId === 'test-kaese')
    ).toMatchObject({ sheetStatus: 'draft', bakedAt: expect.any(String) })
    // A tick on a row of the draft sheet waits for the confirm.
    const blocked = await as('backstube').post(
      `/api/backzettel/${SUN}/bake/${kaese.id}/unbaked`
    )
    expect(blocked.status).toBe(409)
    expect(blocked.body).toMatchObject({ error: 'not_confirmed' })

    const confirm = await as('backstube').post(`/api/backzettel/${SAT}/confirm`)
    expect(confirm.status).toBe(200)
    const list = await bakeList(SUN)
    const doppel = linesOf(list).find((l: any) => l.itemId === 'test-doppel')
    expect(doppel).toMatchObject({
      total: doppelBefore.total + 5,
      bakedAt: null,
      bakedBy: null,
      previouslyBaked: {
        qty: doppelBefore.total,
        at: doppelBefore.bakedAt,
        by: { id: expect.any(Number), displayName: 'Test bk.backstube' },
      },
    })
    expect(
      linesOf(list).find((l: any) => l.itemId === 'test-kaese')
    ).toMatchObject({ bakedAt: expect.any(String), previouslyBaked: null })
    // The done tick of Stern was not affected by any of it.
    expect(
      linesOf(list).find((l: any) => l.itemId === 'test-stern')
    ).toMatchObject({ doneAt: expect.any(String), bakedAt: null })
    const audit = await AuditLog.findOne({
      where: { action: 'confirm', entityId: SAT },
      order: [['id', 'DESC']],
    })
    expect((audit?.data as any).clearedBakedTicks).toEqual([
      expect.objectContaining({
        itemId: 'test-doppel',
        bakeDate: SUN,
        from: doppelBefore.total,
        to: doppelBefore.total + 5,
      }),
    ])
    expect((audit?.data as any).clearedTicks).toEqual([])
    const row = await BackzettelLine.findByPk(doppel.id)
    expect(row?.bakedAt).toBeNull()
  })
})
