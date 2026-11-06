/**
 * Z3 `/api/backzettel` against the real app (in-memory SQLite, baseline +
 * Z3 migration). Synthetic master data from tests/fixtures (written to a
 * temp "hq"), synthetic preorders inserted through the models (draft inputs)
 * or through `POST /api/preorders` (W4: deltas come from the write path),
 * synthetic users. Nothing here comes from the real hq.
 *
 * Dates: Mo 2026-11-23 (Ruhetag), Di 2026-11-24, Mi 2026-11-25,
 * Do 2026-11-26 + Fr 2026-11-27 (write path), Sa 2026-11-28 (Hefeteig),
 * So 2026-11-29; for re-confirm and the frozen
 * snapshot Mi 2026-12-02 and Sa 2026-12-05.
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
import { resolveBackzettelPaths } from '../../src/services/backzettel-source'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(30000)

const MON = '2026-11-23'
const TUE = '2026-11-24'
/** "Today" for the planning window - the fixed dates above stay inside it. */
const PINNED_NOW = new Date('2026-11-20T09:00:00Z')
const WED = '2026-11-25'
const THU = '2026-11-26'
const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const WED2 = '2026-12-02'
const SAT2 = '2026-12-05'

let api: TestApp
let hqDir: string
let configFile: string
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
  for (const p of fixture.PRODUCTS) {
    fs.writeFileSync(
      path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
      `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test ${
        p.id
      }\nprice: 1.5\navailable: ${p.available !== false}\n---\n\nText\n`
    )
  }
  // JSON is valid YAML.
  fs.writeFileSync(configFile, JSON.stringify(fixture.config(), null, 2))
}

let codeSeq = 0
async function preorder(
  date: string,
  items: { productId: string; quantity: number; variant?: string }[],
  status: 'offen' | 'bereit' | 'abgeholt' | 'storniert' = 'offen'
): Promise<Preorder> {
  codeSeq += 1
  const p = await Preorder.create({
    code: `TEST-${date}-${String(codeSeq).padStart(2, '0')}`,
    channel: 'laden',
    customerName: 'Testkunde',
    pickupDate: date,
    status,
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
  patch: (p: string) => request(api.app).patch(p).set(bearer(tokens[role])),
})

/** A preorder through `POST /api/preorders` - the write path (W4). */
async function apiPreorder(
  date: string,
  items: { productId: string; quantity: number; variant?: string }[]
): Promise<{ id: number; code: string; updatedAt: string }> {
  const res = await as('verkauf').post('/api/preorders').send({
    channel: 'telefon',
    customerName: 'Testkunde',
    pickupDate: date,
    items,
  })
  expect(res.status).toBe(201)
  return res.body.data
}

const reconcile = (from = '2026-01-01') =>
  (
    api.app.locals['reconcileBackzettelDeltas'] as (o: {
      from: string
    }) => Promise<{ date: string; recorded: number | null }[]>
  )({ from })

const idle = () => (api.app.locals['backzettelIdle'] as () => Promise<void>)()

function line(
  dayData: any,
  itemId: string,
  variant: string | null = null
): any {
  for (const s of dayData.sections) {
    const hit = s.lines.find(
      (l: any) => l.itemId === itemId && l.variant === variant
    )
    if (hit) return hit
  }
  return undefined
}

async function auditActions(entityId: string): Promise<string[]> {
  const rows = await AuditLog.findAll({
    where: { entity: 'backzettel_day', entityId },
    order: [['id', 'ASC']],
  })
  return rows.map((r) => r.action)
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z3-hq-'))
  configFile = path.join(hqDir, 'config', 'backzettel.yaml')
  writeHq(hqDir)
  api = await createTestApp({
    seedPartners: true,
    app: {
      // Pinned clock for the planning window (today − 7 … today + 90).
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      // W4: deltas come from the preorder write path, so the tests write
      // preorders through the API (prices from the synthetic catalogue).
      preorders: {
        productsDir: path.join(hqDir, 'products'),
        variantsForProduct: () => null,
      },
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
})

describe('access', () => {
  it('needs a session', async () => {
    const res = await request(api.app).get(`/api/backzettel/${TUE}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
  })

  it.each(['verkauf', 'fahrer'] as const)(
    '%s may read but not plan, confirm or tick',
    async (role) => {
      expect((await as(role).get(`/api/backzettel/${TUE}`)).status).toBe(200)
      for (const res of [
        await as(role)
          .put(`/api/backzettel/${TUE}/season`)
          .send({ factor: 1.2 }),
        await as(role)
          .put(`/api/backzettel/${TUE}/lines/weck/correction`)
          .send({ correction: 1, reason: 'x' }),
        await as(role).post(`/api/backzettel/${TUE}/confirm`),
        await as(role).post(`/api/backzettel/${TUE}/lines/1/done`),
        await as(role).post(`/api/backzettel/${TUE}/deltas/1/ack`),
        await as(role).post(`/api/backzettel/${TUE}/reopen`),
      ]) {
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({ error: 'forbidden' })
        expect(res.body.message).toEqual(expect.any(String))
      }
    }
  )
})

describe('GET /api/backzettel/config', () => {
  it('returns the normalised config and validation result', async () => {
    const res = await as('verkauf').get('/api/backzettel/config')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      status: 'ok',
      source: 'backzettel.yaml',
      errors: [],
      recipesMissing: [],
      catalogSize: fixture.PRODUCTS.length,
    })
    expect(res.body.data.config.days).toEqual([2, 3, 4, 5, 6, 7])
    expect(res.body.data.config.items.map((i: any) => i.id)).toContain('weck')
    // never the server path
    expect(JSON.stringify(res.body)).not.toContain(hqDir)
  })
})

describe('GET /api/backzettel/:date (draft)', () => {
  it('400 for an invalid date, 409 ruhetag on Monday', async () => {
    const bad = await as('verkauf').get('/api/backzettel/2026-02-30')
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'invalid_date' })
    const mon = await as('verkauf').get(`/api/backzettel/${MON}`)
    expect(mon.status).toBe(409)
    expect(mon.body).toMatchObject({ error: 'ruhetag' })
    expect(mon.body.message).toMatch(/Montag ist Ruhetag/)
    const put = await as('backstube')
      .put(`/api/backzettel/${MON}/season`)
      .send({ factor: 1.1 })
    expect(put.status).toBe(409)
    expect(put.body.error).toBe('ruhetag')
  })

  it('computes base + preorders (not cancelled) + CAP live, without writing', async () => {
    await preorder(TUE, [{ productId: 'test-weck', quantity: 5 }])
    await preorder(TUE, [{ productId: 'test-weck', quantity: 2 }], 'abgeholt')
    await preorder(TUE, [{ productId: 'test-weck', quantity: 99 }], 'storniert')
    await preorder(WED, [{ productId: 'test-weck', quantity: 50 }])

    const res = await as('verkauf').get(`/api/backzettel/${TUE}`)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d).toMatchObject({
      date: TUE,
      weekday: 2,
      weekdayName: 'Dienstag',
      status: 'draft',
      seasonFactor: 1,
      confirmedBy: null,
      configStatus: 'ok',
      prepDate: '2026-11-23',
      deltas: [],
    })
    expect(line(d, 'weck')).toMatchObject({
      id: null,
      base: 40,
      seasonal: 0,
      preorders: 7,
      cap: 12,
      correction: 0,
      correctionReason: null,
      correctionBy: null,
      total: 59,
      doneAt: null,
    })
    // W4-verify r3: trays follow the line total, not the YAML count
    expect(line(d, 'plunder')).toMatchObject({
      total: 10,
      tray: '1 Blech à 10 (Blech 7)',
    })
    expect(d.prep.map((p: any) => p.id)).toEqual(['sauerteig', 'wagen'])
    expect(await BackzettelDay.count()).toBe(0)
  })

  it('Saturday: variants, quarters, Hefeteig and fillings', async () => {
    await preorder(SAT, [
      { productId: 'test-zopf-gefuellt', quantity: 2, variant: 'nuss' },
      { productId: 'test-kranz-viertel', quantity: 3 },
    ])
    const res = await as('backstube').get(`/api/backzettel/${SAT}`)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(line(d, 'zopf-gefuellt', 'nuss')).toMatchObject({
      base: 4,
      preorders: 2,
      total: 6,
    })
    expect(line(d, 'zopf-gefuellt', 'mohn').total).toBe(2)
    // three quarters are one Kranz, not three
    expect(line(d, 'kranz')).toMatchObject({ base: 2, preorders: 1, total: 3 })
    expect(d.hefeteig.doughs[0]).toMatchObject({ id: 'hefeteig-test' })
    // zopf 8 × 500 + kranz-gefuellt 4 × 2 × 600 + kranz 3 × 3 × 600
    expect(d.hefeteig.dough_g).toBe(8 * 500 + 4 * 2 * 600 + 3 * 3 * 600)
    const nuss = d.fillings.find((f: any) => f.id === 'nuss')
    expect(nuss.grams).toBe(6 * 400 + 3 * 1000)
    expect(nuss.recipe).not.toBeNull()
    expect(d.prep.map((p: any) => p.id)).toEqual(['samstag-only'])
  })
})

describe('season factor and corrections (draft)', () => {
  it('PUT season: validates, stores, audits', async () => {
    const bad = await as('backstube')
      .put(`/api/backzettel/${SUN}/season`)
      .send({ factor: 0 })
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ error: 'validation' })
    expect(bad.body.message).toMatch(/Saisonfaktor/)

    const res = await as('backstube')
      .put(`/api/backzettel/${SUN}/season`)
      .send({ factor: 1.5 })
    expect(res.status).toBe(200)
    expect(res.body.data.seasonFactor).toBe(1.5)
    expect(line(res.body.data, 'weck')).toMatchObject({
      base: 80,
      seasonal: 40,
      total: 120,
    })
    expect(await auditActions(SUN)).toEqual(['season'])
  })

  it('PUT correction: reason required, stored with user, variant path', async () => {
    const noReason = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/weck/correction`)
      .send({ correction: 5 })
    expect(noReason.status).toBe(400)
    expect(noReason.body).toMatchObject({ error: 'reason_required' })
    expect(noReason.body.message).toMatch(/Grund/)

    const res = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/weck/correction`)
      .send({ correction: 5, reason: 'Stadtfest' })
    expect(res.status).toBe(200)
    expect(line(res.body.data, 'weck')).toMatchObject({
      base: 60,
      correction: 5,
      correctionReason: 'Stadtfest',
      correctionBy: { displayName: 'Test test.backstube' },
      total: 65,
    })
    expect(line(res.body.data, 'weck').id).toEqual(expect.any(Number))

    const v = await as('inhaber')
      .put(`/api/backzettel/${SAT}/lines/zopf-gefuellt/mohn/correction`)
      .send({ correction: -2, reason: 'zu wenig Mohn' })
    expect(v.status).toBe(200)
    expect(line(v.body.data, 'zopf-gefuellt', 'mohn')).toMatchObject({
      correction: -2,
      total: 0,
    })

    const unknownItem = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/gibt-es-nicht/correction`)
      .send({ correction: 1, reason: 'x' })
    expect(unknownItem.status).toBe(404)
    expect(unknownItem.body.error).toBe('unknown_item')
    const unknownVariant = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/zopf-gefuellt/kaese/correction`)
      .send({ correction: 1, reason: 'x' })
    expect(unknownVariant.status).toBe(404)
    expect(unknownVariant.body.error).toBe('unknown_variant')
    // a variant segment on an item without variants
    const noVariants = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/weck/nuss/correction`)
      .send({ correction: 1, reason: 'x' })
    expect(noVariants.status).toBe(404)
    expect(noVariants.body.error).toBe('unknown_variant')
    expect(noVariants.body.message).toEqual(expect.any(String))
    const fraction = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/weck/correction`)
      .send({ correction: 1.5, reason: 'x' })
    expect(fraction.status).toBe(400)

    // 0 clears correction and reason
    const clear = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/zopf-gefuellt/mohn/correction`)
      .send({ correction: 0 })
    expect(line(clear.body.data, 'zopf-gefuellt', 'mohn')).toMatchObject({
      correction: 0,
      correctionReason: null,
      correctionBy: null,
      total: 2,
    })
    expect(await auditActions(SAT)).toEqual([
      'correction',
      'correction',
      'correction',
    ])
  })
})

describe('correction larger than the line (W4 verification round 2)', () => {
  it('refuses a correction that would push the line below 0', async () => {
    // Sunday: weck base 80 (season 1.5 from the test above -> 120)
    const res = await as('inhaber')
      .put(`/api/backzettel/${SUN}/lines/weck/correction`)
      .send({ correction: -200, reason: 'Stadtfest' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('correction_exceeds_line')
    expect(res.body.message).toMatch(/größer als die geplante Menge \(120\)/)
    // exactly the line is fine
    const ok = await as('inhaber')
      .put(`/api/backzettel/${SUN}/lines/weck/correction`)
      .send({ correction: -120, reason: 'Stadtfest' })
    expect(ok.status).toBe(200)
    expect(line(ok.body.data, 'weck')).toMatchObject({ total: 0 })
    expect(line(ok.body.data, 'weck').correctionClamped).toBeUndefined()
    // a later preorder raises the total again
    const p = await preorder(SUN, [{ productId: 'test-weck', quantity: 7 }])
    const after = await as('inhaber').get(`/api/backzettel/${SUN}`)
    expect(line(after.body.data, 'weck')).toMatchObject({
      preorders: 7,
      total: 7,
    })
    // reset for later tests
    await PreorderItem.destroy({ where: { preorderId: p.id } })
    await p.destroy()
    await as('inhaber')
      .put(`/api/backzettel/${SUN}/lines/weck/correction`)
      .send({ correction: 0 })
  })
})

describe('confirm, deltas, ticks, reopen', () => {
  let confirmed: any

  it('POST confirm freezes the lines and the preorder snapshot', async () => {
    const res = await as('backstube').post(`/api/backzettel/${TUE}/confirm`)
    expect(res.status).toBe(200)
    confirmed = res.body.data
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      confirmedBy: { displayName: 'Test test.backstube' },
      deltas: [],
      configStatus: 'ok',
    })
    expect(confirmed.confirmedAt).toEqual(expect.any(String))
    const weck = line(confirmed, 'weck')
    expect(weck).toMatchObject({
      preorders: 7,
      cap: 12,
      total: 59,
      delta: null,
    })
    expect(weck.id).toEqual(expect.any(Number))

    const day = await BackzettelDay.findByPk(TUE)
    expect(day?.status).toBe('confirmed')
    expect(day?.preorderSnapshot).toHaveLength(2)
    const rows = await BackzettelLine.findAll({ where: { date: TUE } })
    expect(rows.find((r) => r.itemId === 'weck')).toMatchObject({
      name: 'Weck',
      section: 'broetchen',
      unit: 'Stück',
    })
    expect(await auditActions(TUE)).toEqual(['confirm'])
  })

  it('planning writes outside today − 7 … today + 90 are 400 date_out_of_range (W4-verify)', async () => {
    for (const date of [
      '9999-12-31',
      '1970-01-03',
      '2026-11-12',
      '2027-02-19',
    ]) {
      const res = await as('backstube').post(`/api/backzettel/${date}/confirm`)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ error: 'date_out_of_range' })
      expect(res.body.message).toMatch(/außerhalb des Planungszeitraums/)
      const season = await as('backstube')
        .put(`/api/backzettel/${date}/season`)
        .send({ factor: 1.2 })
      expect(season.status).toBe(400)
      expect(await BackzettelDay.findByPk(date)).toBeNull()
    }
    // The edges are inside: today − 7 (Fri 13.11.) and today + 90 (Thu 18.02.).
    const edge = await as('backstube')
      .put('/api/backzettel/2026-11-13/season')
      .send({ factor: 1 })
    expect(edge.status).not.toBe(400)
  })

  it('a confirmed day is final for corrections, season and confirm', async () => {
    for (const res of [
      await as('backstube')
        .put(`/api/backzettel/${TUE}/lines/weck/correction`)
        .send({ correction: 1, reason: 'x' }),
      await as('backstube')
        .put(`/api/backzettel/${TUE}/season`)
        .send({ factor: 1.2 }),
      await as('inhaber').post(`/api/backzettel/${TUE}/confirm`),
    ]) {
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('confirmed')
      expect(res.body.message).toMatch(/freigegeben/)
    }
  })

  it('a preorder created after confirm is a delta at once, written by the preorder write (W4)', async () => {
    const late = await apiPreorder(TUE, [
      { productId: 'test-weck', quantity: 4 },
    ])
    // recorded in the preorder's own transaction - before anyone reads
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(1)
    const recorded = await AuditLog.findOne({
      where: {
        entity: 'backzettel_day',
        entityId: TUE,
        action: 'deltas_recorded',
      },
    })
    // attributed to whoever wrote the preorder
    expect(recorded?.userId).toEqual(expect.any(Number))
    expect(recorded?.data).toMatchObject({ via: 'preorder_create' })

    // reading is side-effect free: parallel reads add nothing
    const reads = await Promise.all(
      [1, 2, 3, 4].map(() => as('fahrer').get(`/api/backzettel/${TUE}`))
    )
    for (const r of reads) {
      expect(r.status).toBe(200)
      expect(r.body.data.deltasPending).toBe(false)
    }
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(1)
    expect(await auditActions(TUE)).toEqual(['confirm', 'deltas_recorded'])

    const d = (await as('verkauf').get(`/api/backzettel/${TUE}`)).body.data
    expect(d.deltas).toEqual([
      expect.objectContaining({
        itemId: 'weck',
        variant: null,
        qty: 4,
        kind: 'added',
        preorderId: late.id,
        preorderCode: late.code,
        acknowledgedAt: null,
      }),
    ])
    // frozen line unchanged, highlighted
    expect(line(d, 'weck')).toMatchObject({
      total: 59,
      delta: { qty: 4, open: 1, count: 1, bake: 4 },
    })

    // edit, then cancel through the API: one row each
    const edited = await as('verkauf')
      .patch(`/api/preorders/${late.id}`)
      .send({ items: [{ productId: 'test-weck', quantity: 6 }] })
    expect(edited.status).toBe(200)
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(2)

    // idempotent: a no-op edit, a status change without new quantities and
    // the reconciliation sweep record nothing
    expect(
      (
        await as('verkauf')
          .patch(`/api/preorders/${late.id}`)
          .send({ items: [{ productId: 'test-weck', quantity: 6 }] })
      ).status
    ).toBe(200)
    expect(
      (
        await as('verkauf')
          .post(`/api/preorders/${late.id}/status`)
          .send({ status: 'bereit' })
      ).status
    ).toBe(200)
    expect(await reconcile()).toEqual(
      expect.arrayContaining([{ date: TUE, recorded: 0 }])
    )
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(2)

    const cancelled = await as('verkauf').post(
      `/api/preorders/${late.id}/cancel`
    )
    expect(cancelled.status).toBe(200)
    const after = (await as('verkauf').get(`/api/backzettel/${TUE}`)).body.data
    expect(after.deltas.map((x: any) => [x.qty, x.kind])).toEqual([
      [4, 'added'],
      [2, 'changed'],
      [-6, 'cancelled'],
    ])
    expect(line(after, 'weck').delta).toEqual({
      qty: 0,
      open: 3,
      count: 3,
      bake: 0,
      openQty: 0,
      bakeOpen: 0,
    })
    expect(await auditActions(TUE)).toEqual([
      'confirm',
      'deltas_recorded',
      'deltas_recorded',
      'deltas_recorded',
    ])
    const vias = (
      await AuditLog.findAll({
        where: { entityId: TUE, action: 'deltas_recorded' },
        order: [['id', 'ASC']],
      })
    ).map((a) => (a.data as any).via)
    expect(vias).toEqual([
      'preorder_create',
      'preorder_update',
      'preorder_cancel',
    ])
  })

  it('POST deltas/:id/ack marks a delta as seen (idempotent)', async () => {
    const delta = await BackzettelDelta.findOne({ where: { date: TUE } })
    const res = await as('backstube').post(
      `/api/backzettel/${TUE}/deltas/${delta!.id}/ack`
    )
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: delta!.id,
      acknowledgedBy: { displayName: 'Test test.backstube' },
    })
    expect(res.body.data.acknowledgedAt).toEqual(expect.any(String))
    const again = await as('inhaber').post(
      `/api/backzettel/${TUE}/deltas/${delta!.id}/ack`
    )
    expect(again.body.data.acknowledgedBy.displayName).toBe(
      'Test test.backstube'
    )
    expect(
      await AuditLog.count({
        where: { action: 'delta_ack', entityId: String(delta!.id) },
      })
    ).toBe(1)

    const wrongDay = await as('backstube').post(
      `/api/backzettel/${SAT}/deltas/${delta!.id}/ack`
    )
    expect(wrongDay.status).toBe(404)
    const badId = await as('backstube').post(
      `/api/backzettel/${TUE}/deltas/abc/ack`
    )
    expect(badId.status).toBe(400)

    const d = (await as('verkauf').get(`/api/backzettel/${TUE}`)).body.data
    expect(line(d, 'weck').delta.open).toBe(2)
  })

  it('POST lines/:id/done and /undone tick a line', async () => {
    const weckId = line(confirmed, 'weck').id
    const done = await as('backstube').post(
      `/api/backzettel/${TUE}/lines/${weckId}/done`
    )
    expect(done.status).toBe(200)
    expect(done.body.data).toMatchObject({
      id: weckId,
      itemId: 'weck',
      variant: null,
      doneBy: { displayName: 'Test test.backstube' },
    })
    const d = (await as('verkauf').get(`/api/backzettel/${TUE}`)).body.data
    expect(line(d, 'weck').doneAt).toEqual(expect.any(String))

    // idempotent: no second audit row
    await as('inhaber').post(`/api/backzettel/${TUE}/lines/${weckId}/done`)
    const undone = await as('inhaber').post(
      `/api/backzettel/${TUE}/lines/${weckId}/undone`
    )
    expect(undone.body.data).toMatchObject({ doneAt: null, doneBy: null })
    const actions = (
      await AuditLog.findAll({
        where: { entity: 'backzettel_line', entityId: String(weckId) },
        order: [['id', 'ASC']],
      })
    ).map((a) => a.action)
    expect(actions).toEqual(['line_done', 'line_undone'])

    expect(
      (await as('backstube').post(`/api/backzettel/${TUE}/lines/99999/done`))
        .status
    ).toBe(404)
    expect(
      (
        await as('backstube').post(
          `/api/backzettel/${SAT}/lines/${weckId}/done`
        )
      ).body.error
    ).toBe('not_confirmed')
  })

  it('GET /:date/prep lists the Vorbereitung for the day (done on d−1)', async () => {
    const tue = await as('verkauf').get(`/api/backzettel/${TUE}/prep`)
    expect(tue.status).toBe(200)
    expect(tue.body.data).toMatchObject({
      date: TUE,
      status: 'confirmed',
      prepDate: '2026-11-23',
      // Monday is Ruhetag: who preps Tuesday is open (Q-B2)
      prepDateProvisional: true,
    })
    expect(tue.body.data.prep).toEqual([
      expect.objectContaining({ id: 'sauerteig', variant: 'misch' }),
      expect.objectContaining({ id: 'wagen' }),
    ])
    const wed = await as('verkauf').get(`/api/backzettel/${WED}/prep`)
    expect(wed.body.data).toMatchObject({
      prepDate: TUE,
      prepDateProvisional: false,
    })
    expect(wed.body.data.prep.map((p: any) => [p.id, p.variant])).toEqual([
      ['sauerteig', 'buttermilch'],
      ['bruehstueck', null],
      ['wagen', null],
    ])
    const mon = await as('verkauf').get(`/api/backzettel/${MON}/prep`)
    expect(mon.status).toBe(409)
  })

  it('POST reopen: inhaber only, back to draft, deltas folded in, audited', async () => {
    const denied = await as('backstube').post(`/api/backzettel/${TUE}/reopen`)
    expect(denied.status).toBe(403)

    // a new preorder after confirmation
    await preorder(TUE, [{ productId: 'test-weck', quantity: 3 }])
    const res = await as('inhaber')
      .post(`/api/backzettel/${TUE}/reopen`)
      .send({ reason: 'Nachbestellung Verein' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'draft', deltas: [] })
    expect(line(res.body.data, 'weck')).toMatchObject({
      preorders: 10,
      total: 62,
    })
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(0)
    const reopen = await AuditLog.findOne({
      where: { entity: 'backzettel_day', entityId: TUE, action: 'reopen' },
    })
    expect(reopen?.data).toMatchObject({ reason: 'Nachbestellung Verein' })
    expect((reopen?.data as any).discardedDeltas).toHaveLength(3)

    const notConfirmed = await as('inhaber').post(
      `/api/backzettel/${TUE}/reopen`
    )
    expect(notConfirmed.status).toBe(409)
    expect(notConfirmed.body.error).toBe('not_confirmed')

    // corrections possible again, then confirm again
    await as('backstube')
      .put(`/api/backzettel/${TUE}/lines/weck/correction`)
      .send({ correction: -2, reason: 'Rest vom Vortag' })
    const again = await as('backstube').post(`/api/backzettel/${TUE}/confirm`)
    expect(again.status).toBe(200)
    expect(line(again.body.data, 'weck')).toMatchObject({
      correction: -2,
      total: 60,
      delta: null,
    })
    expect((await BackzettelDay.findByPk(TUE))?.preorderSnapshot).toHaveLength(
      3
    )
  })
})

describe('re-confirm and the frozen snapshot', () => {
  afterAll(() => writeHq(hqDir))

  it('a re-confirm that changes a line clears its tick, unchanged lines keep theirs', async () => {
    const first = await as('backstube').post(`/api/backzettel/${WED2}/confirm`)
    expect(first.status).toBe(200)
    const weck = line(first.body.data, 'weck')
    const plunder = line(first.body.data, 'plunder')
    expect(weck.total).toBe(30)
    for (const id of [weck.id, plunder.id]) {
      const r = await as('backstube').post(
        `/api/backzettel/${WED2}/lines/${id}/done`
      )
      expect(r.status).toBe(200)
    }

    const reopened = await as('inhaber').post(`/api/backzettel/${WED2}/reopen`)
    expect(line(reopened.body.data, 'weck').doneAt).toEqual(expect.any(String))

    const draft = await as('backstube')
      .put(`/api/backzettel/${WED2}/lines/weck/correction`)
      .send({ correction: 10, reason: 'Vereinsfest' })
    // the draft no longer shows the stale tick
    expect(line(draft.body.data, 'weck')).toMatchObject({
      total: 40,
      doneAt: null,
      doneBy: null,
    })
    expect(line(draft.body.data, 'plunder').doneAt).toEqual(expect.any(String))

    const again = await as('backstube').post(`/api/backzettel/${WED2}/confirm`)
    expect(again.status).toBe(200)
    expect(line(again.body.data, 'weck')).toMatchObject({
      id: weck.id,
      total: 40,
      doneAt: null,
      doneBy: null,
    })
    expect(line(again.body.data, 'plunder')).toMatchObject({
      id: plunder.id,
      total: 8,
      doneBy: { displayName: 'Test test.backstube' },
    })
    // W4 verification round 2: the Backstube sees what was already baked
    expect(line(again.body.data, 'weck').previouslyDone).toEqual({
      qty: 30,
      at: expect.any(String),
      by: expect.objectContaining({ displayName: 'Test test.backstube' }),
    })
    expect(line(again.body.data, 'plunder').previouslyDone).toBeNull()
    const reticked = await as('backstube').post(
      `/api/backzettel/${WED2}/lines/${weck.id}/done`
    )
    expect(reticked.status).toBe(200)
    const after = await as('backstube').get(`/api/backzettel/${WED2}`)
    expect(line(after.body.data, 'weck').previouslyDone).toBeNull()
    await as('backstube').post(
      `/api/backzettel/${WED2}/lines/${weck.id}/undone`
    )
    const row = await BackzettelLine.findByPk(weck.id)
    expect(row?.doneAt).toBeNull()
    expect(row?.doneBy).toBeNull()

    const confirms = await AuditLog.findAll({
      where: { entity: 'backzettel_day', entityId: WED2, action: 'confirm' },
      order: [['id', 'ASC']],
    })
    expect((confirms[0].data as any).clearedTicks).toEqual([])
    expect((confirms[1].data as any).clearedTicks).toEqual([
      expect.objectContaining({
        itemId: 'weck',
        from: 30,
        to: 40,
        doneAt: expect.any(String),
      }),
    ])
  })

  it('a re-confirm that lowers a ticked line keeps the tick (W4-verify r3)', async () => {
    // WED2 is confirmed by the test above (weck unticked again)
    const first = await as('backstube').get(`/api/backzettel/${WED2}`)
    expect(first.body.data.status).toBe('confirmed')
    const weck = line(first.body.data, 'weck')
    if (!weck.doneAt) {
      expect(
        (
          await as('backstube').post(
            `/api/backzettel/${WED2}/lines/${weck.id}/done`
          )
        ).status
      ).toBe(200)
    }
    await as('inhaber').post(`/api/backzettel/${WED2}/reopen`)
    const lowered = await as('backstube')
      .put(`/api/backzettel/${WED2}/lines/weck/correction`)
      .send({ correction: -2, reason: 'Markt zu' })
    expect(lowered.status).toBe(200)
    const draftWeck = line(lowered.body.data, 'weck')
    expect(draftWeck.total).toBeLessThan(weck.total)
    expect(draftWeck.doneAt).toEqual(expect.any(String))
    const again = await as('backstube').post(`/api/backzettel/${WED2}/confirm`)
    expect(again.status).toBe(200)
    expect(line(again.body.data, 'weck')).toMatchObject({
      id: weck.id,
      total: draftWeck.total,
      doneAt: expect.any(String),
      previouslyDone: null,
    })
    const confirms = await AuditLog.findAll({
      where: { entity: 'backzettel_day', entityId: WED2, action: 'confirm' },
      order: [['id', 'DESC']],
      limit: 1,
    })
    expect((confirms[0].data as any).clearedTicks).toEqual([])
  })

  it('Hefeteig, fillings, prep and warnings stay as confirmed when the YAML changes', async () => {
    // a preorder for a product that is on no Backzettel item -> warning
    await preorder(SAT2, [
      { productId: 'test-alt', quantity: 2 },
      { productId: 'test-zopf-gefuellt', quantity: 1, variant: 'nuss' },
    ])
    const res = await as('inhaber').post(`/api/backzettel/${SAT2}/confirm`)
    expect(res.status).toBe(200)
    const confirmed = res.body.data
    expect(confirmed.configChangedSinceConfirm).toBe(false)
    expect(confirmed.warnings.map((w: any) => w.code)).toContain(
      'unmapped_product'
    )
    expect(confirmed.hefeteig.dough_g).toBe(
      // zopf nuss 4 + 1, mohn 2; kranz-gefuellt 4 × 2 pieces; kranz 2 × 3
      (5 + 2) * 500 + 4 * 2 * 600 + 2 * 3 * 600
    )
    expect(confirmed.prep.map((p: any) => p.id)).toEqual(['samstag-only'])

    // the owner doubles every piece weight and drops the Saturday prep
    const changed = fixture.config()
    for (const item of changed.items) {
      if (item.dough) item.dough.piece_g *= 2
    }
    changed.prep = changed.prep.filter((p: any) => p.id !== 'samstag-only')
    fs.writeFileSync(configFile, JSON.stringify(changed, null, 2))

    const after = (await as('backstube').get(`/api/backzettel/${SAT2}`)).body
      .data
    expect(after.status).toBe('confirmed')
    expect(after.hefeteig).toEqual(confirmed.hefeteig)
    expect(after.fillings).toEqual(confirmed.fillings)
    expect(after.prep).toEqual(confirmed.prep)
    expect(after.warnings).toEqual(confirmed.warnings)
    expect(after.configChangedSinceConfirm).toBe(true)
    expect(line(after, 'kranz').total).toBe(line(confirmed, 'kranz').total)

    // a reopen drops the snapshot; the next confirm uses the new YAML
    await as('inhaber').post(`/api/backzettel/${SAT2}/reopen`)
    expect((await BackzettelDay.findByPk(SAT2))?.computedSnapshot).toBeNull()
    const reconfirmed = (
      await as('inhaber').post(`/api/backzettel/${SAT2}/confirm`)
    ).body.data
    expect(reconfirmed.hefeteig.dough_g).toBe(2 * confirmed.hefeteig.dough_g)
    expect(reconfirmed.prep).toEqual([])
    expect(reconfirmed.configChangedSinceConfirm).toBe(false)
  })
})

describe('deltas on the preorder write path (W4)', () => {
  it('moving a preorder between two confirmed days records both days', async () => {
    for (const date of [THU, FRI]) {
      expect(
        (await as('backstube').post(`/api/backzettel/${date}/confirm`)).status
      ).toBe(200)
    }
    const p = await apiPreorder(THU, [{ productId: 'test-weck', quantity: 3 }])
    const moved = await as('verkauf')
      .patch(`/api/preorders/${p.id}`)
      .send({ pickupDate: FRI })
    expect(moved.status).toBe(200)
    const kinds = async (date: string) =>
      (
        await BackzettelDelta.findAll({
          where: { date, preorderId: p.id },
          order: [['id', 'ASC']],
        })
      ).map((r) => [Number(r.qty), r.kind])
    // W4-verify r5: not „storniert“ - the order still exists, on Friday
    expect(await kinds(THU)).toEqual([
      [3, 'added'],
      [-3, 'moved'],
    ])
    expect(await kinds(FRI)).toEqual([[3, 'added']])
  })

  it('bulk status: cancelling records a delta, a plain status change none', async () => {
    const a = await apiPreorder(FRI, [{ productId: 'test-weck', quantity: 2 }])
    const b = await apiPreorder(FRI, [{ productId: 'test-weck', quantity: 1 }])
    const count = await BackzettelDelta.count({ where: { date: FRI } })
    const ready = await as('verkauf')
      .post('/api/preorders/bulk-status')
      .send({ ids: [a.id, b.id], status: 'bereit' })
    expect(ready.status).toBe(200)
    expect(ready.body.data.counts).toMatchObject({ ok: 2 })
    expect(await BackzettelDelta.count({ where: { date: FRI } })).toBe(count)

    const cancel = await as('verkauf')
      .post('/api/preorders/bulk-status')
      .send({ ids: [a.id], status: 'storniert' })
    expect(cancel.status).toBe(200)
    const rows = await BackzettelDelta.findAll({
      where: { date: FRI, preorderId: a.id },
      order: [['id', 'ASC']],
    })
    expect(rows.map((r) => [Number(r.qty), r.kind])).toEqual([
      [2, 'added'],
      [-2, 'cancelled'],
    ])
    const via = await AuditLog.findOne({
      where: { entityId: FRI, action: 'deltas_recorded' },
      order: [['id', 'DESC']],
    })
    expect(via?.data).toMatchObject({ via: 'preorder_bulk_status' })
  })

  it('a preorder for a draft day records nothing (the draft is live)', async () => {
    await apiPreorder(SUN, [{ productId: 'test-weck', quantity: 1 }])
    expect(await BackzettelDelta.count({ where: { date: SUN } })).toBe(0)
  })
})

describe('what Nachträge mean for oven, dough and filling (W4-verify)', () => {
  const SAT3 = '2026-12-12'

  it('a quarter Kranz after confirm: bake one more, plus dough and filling', async () => {
    const confirmed = await as('backstube').post(
      `/api/backzettel/${SAT3}/confirm`
    )
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.data.deltaExtras).toBeNull()

    await apiPreorder(SAT3, [
      {
        productId: 'test-kranz-gefuellt-viertel',
        quantity: 1,
        variant: 'nuss',
      },
    ])
    const d = (await as('backstube').get(`/api/backzettel/${SAT3}`)).body.data
    const kranz = line(d, 'kranz-gefuellt', 'nuss')
    // +0,25 Kranz in the preorders, one whole Kranz more to bake
    expect(kranz.delta).toMatchObject({ qty: 0.25, bake: 1, open: 1 })
    // frozen figures stay; the difference is reported next to them
    expect(d.deltaExtras).toEqual({
      doughs: [
        expect.objectContaining({
          id: 'hefeteig-test',
          pieces: 2,
          dough_g: 1200,
          weighing: [{ piece_g: 600, pieces: 2, total: expect.any(Number) }],
        }),
      ],
      fillings: [expect.objectContaining({ id: 'nuss', grams: 1000 })],
    })

    // a second quarter needs no further Kranz (0,5 rounds up to the same 1)
    await apiPreorder(SAT3, [
      {
        productId: 'test-kranz-gefuellt-viertel',
        quantity: 1,
        variant: 'nuss',
      },
    ])
    const d2 = (await as('backstube').get(`/api/backzettel/${SAT3}`)).body.data
    expect(line(d2, 'kranz-gefuellt', 'nuss').delta).toMatchObject({
      qty: 0.5,
      bake: 1,
      openQty: 0.5,
      bakeOpen: 1,
    })

    // W4-verify r5: the Backstube panel shows the open Nachträge as what to
    // bake. After the first quarter was seen (one Kranz baked), the second
    // quarter means nothing more - not „+0,25“.
    const firstDelta = d2.deltas.find((x: any) => x.qty === 0.25)
    expect(
      (
        await as('backstube').post(
          `/api/backzettel/${SAT3}/deltas/${firstDelta.id}/ack`
        )
      ).status
    ).toBe(200)
    const d3 = (await as('backstube').get(`/api/backzettel/${SAT3}`)).body.data
    expect(line(d3, 'kranz-gefuellt', 'nuss').delta).toMatchObject({
      qty: 0.5,
      bake: 1,
      open: 1,
      openQty: 0.25,
      bakeOpen: 0,
    })
    // a third and fourth quarter after that: still within the same Kranz
    // (0,75 → 1), then the fifth makes 1,25 → 2: one more
    for (let i = 0; i < 3; i++) {
      await apiPreorder(SAT3, [
        {
          productId: 'test-kranz-gefuellt-viertel',
          quantity: 1,
          variant: 'nuss',
        },
      ])
    }
    const d4 = (await as('backstube').get(`/api/backzettel/${SAT3}`)).body.data
    expect(line(d4, 'kranz-gefuellt', 'nuss').delta).toMatchObject({
      qty: 1.25,
      bake: 2,
      openQty: 1,
      bakeOpen: 1,
    })
  })
})

describe('Nachtrag für einen Posten ohne freigegebene Zeile (W4-verify r6)', () => {
  const SUN3 = '2026-12-13'

  it('bekommt die Backmenge und landet in Hefeteig und Füllungen', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${SUN3}/confirm`)).status
    ).toBe(200)
    // Sonntag: nur Weck freigegeben - kein Kranz, kein Zopf.
    await apiPreorder(SUN3, [
      {
        productId: 'test-kranz-gefuellt-viertel',
        quantity: 2,
        variant: 'mohn',
      },
      { productId: 'test-zopf-gefuellt', quantity: 2, variant: 'nuss' },
    ])
    const d = (await as('backstube').get(`/api/backzettel/${SUN3}`)).body.data
    expect(line(d, 'kranz-gefuellt', 'mohn')).toBeUndefined()
    // 0,5 Kranz ist ein ganzer Kranz zu backen, nicht „+0,5“.
    expect(d.deltaTotals['kranz-gefuellt|mohn']).toMatchObject({
      qty: 0.5,
      bake: 1,
      bakeOpen: 1,
    })
    expect(d.deltaTotals['zopf-gefuellt|nuss']).toMatchObject({
      qty: 2,
      bake: 2,
    })
    expect(d.deltaExtras).toEqual({
      doughs: [
        expect.objectContaining({
          id: 'hefeteig-test',
          // 1 Kranz × 2 × 600 g + 2 Zopf × 1 × 500 g
          pieces: 4,
          dough_g: 2200,
        }),
      ],
      fillings: expect.arrayContaining([
        expect.objectContaining({ id: 'mohn', grams: 800 }),
        expect.objectContaining({ id: 'nuss', grams: 800 }),
      ]),
    })
  })
})

describe('Nachtrag bringt eine Vorbereitung mit (W4-verify r6)', () => {
  const SUN4 = '2026-12-20'
  afterAll(() => writeHq(hqDir))

  it('ein Posten, der erst per Nachtrag auf den Tag kommt, bringt seine Vorbereitung', async () => {
    // Wie das Brühstück für Vollkorn: eine Aufgabe, die nur gilt, wenn der
    // Posten am Tag gebacken wird (`when_item`).
    const cfg = fixture.config()
    cfg.prep.push({
      id: 'kranz-vor',
      name: 'Kranzfüllung ansetzen',
      when_item: 'kranz-gefuellt',
    })
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2))
    const confirmed = await as('backstube').post(
      `/api/backzettel/${SUN4}/confirm`
    )
    expect(confirmed.status).toBe(200)
    const before = confirmed.body.data.prep.map((p: any) => p.id)
    expect(before).not.toContain('kranz-vor')

    await apiPreorder(SUN4, [
      { productId: 'test-kranz-gefuellt', quantity: 1, variant: 'nuss' },
    ])
    const prep = (await as('backstube').get(`/api/backzettel/${SUN4}/prep`))
      .body.data.prep
    // die freigegebene Liste bleibt vorn, die neue Aufgabe kommt dazu
    expect(prep.map((p: any) => p.id)).toEqual([...before, 'kranz-vor'])
    expect(prep[prep.length - 1]).toMatchObject({
      fromDelta: true,
      note: 'Neu durch einen Nachtrag',
    })
  })
})

describe('Nachträge: entfernt, verschoben und der Code am Tag (W4-verify r5)', () => {
  const TUE5 = '2026-12-15'
  const WED5 = '2026-12-16'

  it('eine auf 0 gesetzte Zeile heißt „removed“, ein Tageswechsel „moved“ mit neuem Tag', async () => {
    expect(
      (await as('inhaber').post(`/api/backzettel/${TUE5}/confirm`)).status
    ).toBe(200)
    const order = await apiPreorder(TUE5, [
      { productId: 'test-weck', quantity: 4 },
      { productId: 'test-plunder', quantity: 2 },
    ])
    const removed = await as('verkauf')
      .patch(`/api/preorders/${order.id}`)
      .send({ items: [{ productId: 'test-plunder', quantity: 2 }] })
    expect(removed.status).toBe(200)
    const moved = await as('verkauf')
      .patch(`/api/preorders/${order.id}`)
      .send({ pickupDate: WED5 })
    expect(moved.status).toBe(200)
    const d = (await as('backstube').get(`/api/backzettel/${TUE5}`)).body.data
    const mine = d.deltas.filter((x: any) => x.preorderId === order.id)
    expect(mine.map((x: any) => [x.itemId, x.qty, x.kind])).toEqual(
      expect.arrayContaining([
        ['weck', 4, 'added'],
        ['weck', -4, 'removed'],
        ['plunder', -2, 'moved'],
      ])
    )
    expect(mine.some((x: any) => x.kind === 'cancelled')).toBe(false)
    for (const x of mine) {
      expect(x.preorderCode).toBe(moved.body.data.code)
      expect(x.preorderMovedTo).toBe(WED5)
    }
  })
})

describe('two devices at once (W4-verify r4)', () => {
  const TUE3 = '2026-12-08'
  const WED3 = '2026-12-09'
  const SAT4 = '2026-12-19'

  it('a tick from a stale view does not mark a larger total as baked', async () => {
    const first = await as('inhaber').post(`/api/backzettel/${TUE3}/confirm`)
    expect(first.status).toBe(200)
    const weck = line(first.body.data, 'weck')
    const shown = weck.total
    // owner reopens, adds 6, confirms again - the tablet still shows `shown`
    await as('inhaber').post(`/api/backzettel/${TUE3}/reopen`)
    await as('inhaber')
      .put(`/api/backzettel/${TUE3}/lines/weck/correction`)
      .send({ correction: 6, reason: 'Verein bestellt 6 mehr' })
    const again = await as('inhaber').post(`/api/backzettel/${TUE3}/confirm`)
    expect(line(again.body.data, 'weck').total).toBe(shown + 6)

    const stale = await as('backstube')
      .post(`/api/backzettel/${TUE3}/lines/${weck.id}/done`)
      .send({ expectedTotal: shown })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({
      error: 'line_changed',
      total: shown + 6,
      expectedTotal: shown,
    })
    expect(stale.body.message).toContain(`jetzt ${shown + 6} statt ${shown}`)
    expect((await BackzettelLine.findByPk(weck.id))?.doneAt).toBeNull()

    const fresh = await as('backstube')
      .post(`/api/backzettel/${TUE3}/lines/${weck.id}/done`)
      .send({ expectedTotal: shown + 6 })
    expect(fresh.status).toBe(200)
    const audit = await AuditLog.findOne({
      where: { action: 'line_done', entityId: String(weck.id) },
    })
    expect(audit?.data).toMatchObject({ itemId: 'weck', total: shown + 6 })

    const bad = await as('backstube')
      .post(`/api/backzettel/${TUE3}/lines/${weck.id}/done`)
      .send({ expectedTotal: 'viele' })
    expect(bad.status).toBe(400)
  })

  it('a correction saved on another device is not overwritten silently', async () => {
    const url = `/api/backzettel/${WED3}/lines/weck/correction`
    const tablet = await as('backstube')
      .put(url)
      .send({
        correction: 5,
        reason: 'Verein holt 5 extra',
        expected: { correction: 0, reason: null },
      })
    expect(tablet.status).toBe(200)

    // the PC opened its editor on „–“ before the tablet saved
    const pc = await as('inhaber')
      .put(url)
      .send({
        correction: 2,
        reason: 'Kita',
        expected: { correction: 0, reason: null },
      })
    expect(pc.status).toBe(409)
    expect(pc.body).toMatchObject({
      success: false,
      error: 'correction_changed',
      current: {
        correction: 5,
        reason: 'Verein holt 5 extra',
        by: { displayName: 'Test test.backstube' },
      },
    })
    expect(pc.body.message).toMatch(/\+5 \(„Verein holt 5 extra“\)/)
    expect(pc.body.message).toMatch(/nicht gespeichert/)
    const day = (await as('inhaber').get(`/api/backzettel/${WED3}`)).body.data
    expect(line(day, 'weck').correction).toBe(5)

    // same input again is a no-op, not a conflict
    const same = await as('inhaber')
      .put(url)
      .send({
        correction: 5,
        reason: 'Verein holt 5 extra',
        expected: { correction: 0, reason: null },
      })
    expect(same.status).toBe(200)

    // after reloading, the PC saves on top of the current value
    const ok = await as('inhaber')
      .put(url)
      .send({
        correction: 7,
        reason: 'Verein + Kita',
        expected: { correction: 5, reason: 'Verein holt 5 extra' },
      })
    expect(ok.status).toBe(200)
    expect(line(ok.body.data, 'weck').correction).toBe(7)

    // the season factor likewise
    const s1 = await as('backstube')
      .put(`/api/backzettel/${WED3}/season`)
      .send({ factor: 1.2, expectedFactor: 1 })
    expect(s1.status).toBe(200)
    const s2 = await as('inhaber')
      .put(`/api/backzettel/${WED3}/season`)
      .send({ factor: 1.3, expectedFactor: 1 })
    expect(s2.status).toBe(409)
    expect(s2.body).toMatchObject({ error: 'season_changed', current: 1.2 })
    expect(s2.body.message).toContain('1,2')
    // clients without the field keep working
    const legacy = await as('inhaber')
      .put(`/api/backzettel/${WED3}/season`)
      .send({ factor: 1.3 })
    expect(legacy.status).toBe(200)
  })

  it('POST deltas/ack quittiert mehrere Nachträge auf einmal, alles oder nichts', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${SAT4}/confirm`)).status
    ).toBe(200)
    await apiPreorder(SAT4, [{ productId: 'test-weck', quantity: 2 }])
    await apiPreorder(SAT4, [{ productId: 'test-weck', quantity: 3 }])
    await apiPreorder(SAT4, [{ productId: 'test-plunder', quantity: 1 }])
    const deltas = await BackzettelDelta.findAll({
      where: { date: SAT4 },
      order: [['id', 'ASC']],
    })
    expect(deltas).toHaveLength(3)
    const [a, b, c] = deltas.map((d) => d.id)

    const missing = await as('backstube')
      .post(`/api/backzettel/${SAT4}/deltas/ack`)
      .send({ ids: [a, 999999] })
    expect(missing.status).toBe(404)
    expect(missing.body.message).toMatch(/neu freigegeben/)
    expect(
      await BackzettelDelta.count({
        where: { date: SAT4, acknowledgedAt: null },
      })
    ).toBe(3)

    const res = await as('backstube')
      .post(`/api/backzettel/${SAT4}/deltas/ack`)
      .send({ ids: [a, b] })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0]).toMatchObject({
      acknowledgedBy: { displayName: 'Test test.backstube' },
    })
    const d = (await as('backstube').get(`/api/backzettel/${SAT4}`)).body.data
    expect(
      d.deltas.filter((x: any) => !x.acknowledgedAt).map((x: any) => x.id)
    ).toEqual([c])

    // idempotent
    const again = await as('backstube')
      .post(`/api/backzettel/${SAT4}/deltas/ack`)
      .send({ ids: [a, b, c] })
    expect(again.status).toBe(200)
    expect(
      await AuditLog.count({
        where: { action: 'delta_ack', entityId: [a, b, c].map(String) },
      })
    ).toBe(3)

    for (const body of [{}, { ids: [] }, { ids: ['x'] }, { ids: [0] }]) {
      const bad = await as('backstube')
        .post(`/api/backzettel/${SAT4}/deltas/ack`)
        .send(body)
      expect(bad.status).toBe(400)
    }
    const verkauf = await as('verkauf')
      .post(`/api/backzettel/${SAT4}/deltas/ack`)
      .send({ ids: [c] })
    expect(verkauf.status).toBe(403)
  })
})

describe('missing or invalid config', () => {
  afterEach(() => writeHq(hqDir))

  it('no file: GET → status no-config with reasons, writes → 409', async () => {
    fs.rmSync(configFile)
    const res = await as('verkauf').get(`/api/backzettel/${WED}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ date: WED, status: 'no-config' })
    expect(res.body.data.reasons[0].message).toMatch(/fehlen/)
    expect(res.body.data.sections).toBeUndefined()

    const cfg = await as('verkauf').get('/api/backzettel/config')
    expect(cfg.body.data).toMatchObject({ status: 'no-config', config: null })

    const put = await as('backstube')
      .put(`/api/backzettel/${WED}/lines/weck/correction`)
      .send({ correction: 1, reason: 'x' })
    expect(put.status).toBe(409)
    expect(put.body).toMatchObject({ error: 'no_config' })
    expect(put.body.message).toMatch(/Stammdaten/)
    expect(put.body.reasons).toEqual(expect.any(Array))
    const conf = await as('backstube').post(`/api/backzettel/${WED}/confirm`)
    expect(conf.status).toBe(409)
  })

  it('invalid YAML content: reasons from the validator', async () => {
    const broken = fixture.config()
    broken.items[0].products = [{ id: 'gibt-es-nicht', factor: 1 }]
    fs.writeFileSync(configFile, JSON.stringify(broken))
    const res = await as('verkauf').get(`/api/backzettel/${WED}`)
    expect(res.body.data.status).toBe('no-config')
    expect(JSON.stringify(res.body.data.reasons)).toContain('gibt-es-nicht')
  })

  it('a confirmed day stays readable without config', async () => {
    fs.writeFileSync(configFile, 'version: 1\nitems: [\n')
    const res = await as('backstube').get(`/api/backzettel/${TUE}`)
    expect(res.status).toBe(200)
    // Hefeteig, fillings and prep are frozen at confirm, so they survive
    expect(res.body.data).toMatchObject({
      status: 'confirmed',
      configStatus: 'no-config',
      configChangedSinceConfirm: null,
      prepDateProvisional: null,
      fillings: [],
    })
    expect(res.body.data.prep.map((p: any) => p.id)).toEqual([
      'sauerteig',
      'wagen',
    ])
    expect(line(res.body.data, 'weck')).toMatchObject({
      name: 'Weck',
      total: 60,
    })
  })

  it('a preorder written without loadable master data is caught up once (W4)', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${THU}/confirm`)).status
    ).toBe(409) // already confirmed in the write-path block
    const count = await BackzettelDelta.count({ where: { date: THU } })
    fs.writeFileSync(configFile, 'version: 1\nitems: [\n')
    // the preorder write is never blocked by the Backzettel
    const p = await apiPreorder(THU, [{ productId: 'test-weck', quantity: 5 }])
    expect(await BackzettelDelta.count({ where: { date: THU } })).toBe(count)
    const blind = (await as('backstube').get(`/api/backzettel/${THU}`)).body
      .data
    expect(blind).toMatchObject({
      configStatus: 'no-config',
      deltasPending: null,
    })

    writeHq(hqDir)
    const seen = (await as('backstube').get(`/api/backzettel/${THU}`)).body.data
    expect(seen.deltasPending).toBe(true)
    // ... and the GET started a background catch-up (W4 fixup): no further
    // preorder write, confirm or restart needed - the tablet's next reload
    // shows the delta.
    await idle()
    const rows = await BackzettelDelta.findAll({
      where: { date: THU, preorderId: p.id },
    })
    expect(rows.map((r) => [Number(r.qty), r.kind])).toEqual([[5, 'added']])
    const sweep = await AuditLog.findOne({
      where: { entityId: THU, action: 'deltas_recorded' },
      order: [['id', 'DESC']],
    })
    expect(sweep?.userId).toBeNull()
    expect(sweep?.data).toMatchObject({ via: 'reconcile' })
    // one catch-up only: a second read and a sweep find nothing
    expect(
      (await as('backstube').get(`/api/backzettel/${THU}`)).body.data
        .deltasPending
    ).toBe(false)
    await idle()
    expect(await BackzettelDelta.count({ where: { date: THU } })).toBe(
      count + 1
    )
    expect(await reconcile()).toEqual(
      expect.arrayContaining([{ date: THU, recorded: 0 }])
    )
    expect(
      (await as('backstube').get(`/api/backzettel/${THU}`)).body.data
        .deltasPending
    ).toBe(false)
  })
})

describe('resolveBackzettelPaths', () => {
  it('env: HQ_BACKZETTEL_CONFIG, HQ_PRODUCTS_DIR, HQ_DIR', () => {
    expect(
      resolveBackzettelPaths({
        env: { HQ_DIR: '/srv/hq', HQ_PRODUCTS_DIR: '/srv/p' },
      })
    ).toEqual({
      hqDir: '/srv/hq',
      configPath: '/srv/hq/config/backzettel.yaml',
      productsDir: '/srv/p',
    })
    expect(
      resolveBackzettelPaths({
        env: { HQ_DIR: '/srv/hq', HQ_BACKZETTEL_CONFIG: '/etc/bz.yaml' },
      }).configPath
    ).toBe('/etc/bz.yaml')
  })

  it('an explicit hqDir option wins over the environment', () => {
    expect(
      resolveBackzettelPaths({
        hqDir: '/tmp/hq',
        env: {
          HQ_PRODUCTS_DIR: '/srv/p',
          HQ_BACKZETTEL_CONFIG: '/etc/bz.yaml',
        },
      })
    ).toEqual({
      hqDir: '/tmp/hq',
      configPath: '/tmp/hq/config/backzettel.yaml',
      productsDir: '/tmp/hq/products',
    })
  })

  it('default: <cwd>/../hq', () => {
    expect(resolveBackzettelPaths({ env: {} }).hqDir).toBe(
      path.resolve(process.cwd(), '..', 'hq')
    )
  })
})
