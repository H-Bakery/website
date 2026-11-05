/**
 * Z3 `/api/backzettel` against the real app (in-memory SQLite, baseline +
 * Z3 migration). Synthetic master data from tests/fixtures (written to a
 * temp "hq"), synthetic preorders inserted through the models (B7 runs in
 * parallel), synthetic users. Nothing here comes from the real hq.
 *
 * Dates: Mo 2026-11-23 (Ruhetag), Di 2026-11-24, Mi 2026-11-25,
 * Sa 2026-11-28 (Hefeteig), So 2026-11-29.
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
const WED = '2026-11-25'
const SAT = '2026-11-28'
const SUN = '2026-11-29'

let api: TestApp
let hqDir: string
let configFile: string
const tokens: Record<'inhaber' | 'backstube' | 'verkauf', string> = {
  inhaber: '',
  backstube: '',
  verkauf: '',
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
      }\navailable: ${p.available !== false}\n---\n\nText\n`
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
})

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
    app: { backzettel: { hqDir, cacheMs: 0 } },
  })
  tokens.inhaber = await sessionFor(api.app, 'test.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'test.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'test.verkauf', 'verkauf')

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

  it('verkauf may read but not plan, confirm or tick', async () => {
    expect((await as('verkauf').get(`/api/backzettel/${TUE}`)).status).toBe(200)
    for (const res of [
      await as('verkauf')
        .put(`/api/backzettel/${TUE}/season`)
        .send({ factor: 1.2 }),
      await as('verkauf')
        .put(`/api/backzettel/${TUE}/lines/weck/correction`)
        .send({ correction: 1, reason: 'x' }),
      await as('verkauf').post(`/api/backzettel/${TUE}/confirm`),
      await as('verkauf').post(`/api/backzettel/${TUE}/lines/1/done`),
      await as('verkauf').post(`/api/backzettel/${TUE}/deltas/1/ack`),
      await as('verkauf').post(`/api/backzettel/${TUE}/reopen`),
    ]) {
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'forbidden' })
      expect(res.body.message).toEqual(expect.any(String))
    }
  })
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
    expect(line(d, 'plunder').tray).toBe('3 Bleche à 10 (Bleche 7, 8, 9)')
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

  it('later preorders become deltas: one row per change, idempotent, never merged', async () => {
    const late = await preorder(TUE, [{ productId: 'test-weck', quantity: 4 }])

    // parallel readers record the change once
    const reads = await Promise.all(
      [1, 2, 3, 4].map(() => as('verkauf').get(`/api/backzettel/${TUE}`))
    )
    for (const r of reads) expect(r.status).toBe(200)
    expect(await BackzettelDelta.count({ where: { date: TUE } })).toBe(1)

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
      delta: { qty: 4, open: 1, count: 1 },
    })

    // change, then cancel: one row each
    await PreorderItem.update(
      { quantity: 6 },
      { where: { preorderId: late.id } }
    )
    await as('verkauf').get(`/api/backzettel/${TUE}`)
    await late.update({ status: 'storniert' })
    const after = (await as('verkauf').get(`/api/backzettel/${TUE}`)).body.data
    expect(after.deltas.map((x: any) => [x.qty, x.kind])).toEqual([
      [4, 'added'],
      [2, 'changed'],
      [-6, 'cancelled'],
    ])
    expect(line(after, 'weck').delta).toEqual({ qty: 0, open: 3, count: 3 })
    expect(await auditActions(TUE)).toEqual([
      'confirm',
      'deltas_recorded',
      'deltas_recorded',
      'deltas_recorded',
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
    })
    expect(tue.body.data.prep).toEqual([
      expect.objectContaining({ id: 'sauerteig', variant: 'misch' }),
      expect.objectContaining({ id: 'wagen' }),
    ])
    const wed = await as('verkauf').get(`/api/backzettel/${WED}/prep`)
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
    expect(res.body.data).toMatchObject({
      status: 'confirmed',
      configStatus: 'no-config',
      hefeteig: null,
      fillings: null,
      prep: null,
    })
    expect(line(res.body.data, 'weck')).toMatchObject({
      name: 'Weck',
      total: 60,
    })
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
