/**
 * Z10 Backzettel v2 × „Rest am Abend“ (docs/backzettel-v2.md §5.5, R30)
 * against the real app: „gebacken“ of a bake day comes from every sheet
 * that makes its dough (Tuesday's rolls from Saturday's sheet, Tuesday's
 * bread from Tuesday's own), and bread by size is counted per size with
 * that size's products only. Synthetic master data `configV2()` (invented
 * numbers, nothing from hq) in a temp "hq".
 *
 * Own file (not in rest.test.ts): the models are process-global, so an app
 * with another hq cannot share that file's app (same as backzettelV2.test.ts).
 *
 * Dates (`configV2`: bake days Di-So, dough days Di-Sa, rolls `lead: 1`):
 *   Sa 2026-11-28  sheet: bread for Saturday, rolls for So + Di
 *   So 2026-11-29  only baked (rolls from Saturday)
 *   Mo 2026-11-30  Ruhetag
 *   Di 2026-12-01  „heute“: bread + Plunder from its own sheet, rolls from Sa
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { RestCount } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(30000)

const PINNED_NOW = new Date('2026-11-30T09:00:00Z')
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const MON = '2026-11-30'
const TUE = '2026-12-01'

let api: TestApp
let hqDir: string
let reportsDir: string
const tokens: Record<'inhaber' | 'backstube' | 'verkauf', string> = {
  inhaber: '',
  backstube: '',
  verkauf: '',
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

const restLine = (view: any, key: string) =>
  view.lines.find((l: any) => l.key === key)

const idle = () => (api.app.locals['backzettelIdle'] as () => Promise<void>)()

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z10-rest-hq-'))
  writeHq(hqDir)
  reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z10-rest-reports-'))
  fs.mkdirSync(path.join(reportsDir, 'converted'))
  api = await createTestApp({
    seedPartners: true,
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      hq: { reportsDir, today: TUE },
      preorders: {
        productsDir: path.join(hqDir, 'products'),
        variantsForProduct: () => null,
      },
    },
  })
  tokens.inhaber = await sessionFor(api.app, 'r2.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'r2.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'r2.verkauf', 'verkauf')
})

afterAll(async () => {
  await idle()
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
  fs.rmSync(reportsDir, { recursive: true, force: true })
})

describe('„gebacken“ from the bake list of the day', () => {
  it('before any confirm, Tuesday is planned from both sheets', async () => {
    const res = await as('verkauf').get(`/api/rest?date=${TUE}`)
    expect(res.status).toBe(200)
    const view = res.body.data
    expect(view).toMatchObject({ status: 'ok', backzettelStatus: 'draft' })
    // rolls from Saturday's sheet, bread from Tuesday's own
    expect(restLine(view, 'test-doppel|')).toMatchObject({
      planned: 40,
      baked: null,
    })
    expect(restLine(view, 'test-korn|g500')).toMatchObject({
      planned: 4,
      baked: null,
      variant: 'g500',
      variantLabel: '500 g',
    })
  })

  it('Saturday confirmed: Sunday is confirmed, Tuesday still planned (its own sheet is a draft)', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${SAT}/confirm`)).status
    ).toBe(200)
    const sun = (await as('verkauf').get(`/api/rest?date=${SUN}`)).body.data
    expect(sun.backzettelStatus).toBe('confirmed')
    expect(restLine(sun, 'test-doppel|')).toMatchObject({ baked: 60 })
    const tue = (await as('verkauf').get(`/api/rest?date=${TUE}`)).body.data
    expect(tue.backzettelStatus).toBe('draft')
    expect(restLine(tue, 'test-doppel|').baked).toBeNull()
  })

  it('Tuesday confirmed too: baked from both sheets, one row per size', async () => {
    expect(
      (await as('backstube').post(`/api/backzettel/${TUE}/confirm`)).status
    ).toBe(200)
    const view = (await as('verkauf').get(`/api/rest?date=${TUE}`)).body.data
    expect(view.backzettelStatus).toBe('confirmed')
    expect(restLine(view, 'test-doppel|')).toMatchObject({ baked: 40 })
    expect(restLine(view, 'test-plunder|')).toMatchObject({ baked: 10 })
    const g500 = restLine(view, 'test-korn|g500')
    expect(g500).toMatchObject({ baked: 4, variantLabel: '500 g' })
    expect(g500.rows.map((r: any) => r.productId)).toEqual(['test-korn-500'])
    const g1000 = restLine(view, 'test-korn|g1000')
    expect(g1000).toMatchObject({ baked: 2, variantLabel: '1 kg' })
    expect(g1000.rows.map((r: any) => r.productId)).toEqual(['test-korn-1000'])
    // The size without a Grundmenge (Kasten) is not baked: no row.
    expect(restLine(view, 'test-korn|kasten')).toBeUndefined()
  })

  it('an acknowledged Nachtrag on Saturday’s sheet counts on Tuesday', async () => {
    const pre = await as('verkauf')
      .post('/api/preorders')
      .send({
        channel: 'telefon',
        customerName: 'Testkunde',
        pickupDate: TUE,
        items: [{ productId: 'test-doppel', quantity: 3 }],
      })
    expect(pre.status).toBe(201)
    const sat = (await as('backstube').get(`/api/backzettel/${SAT}`)).body.data
    const delta = sat.deltas.find(
      (d: any) => d.itemId === 'test-doppel' && d.bakeDate === TUE
    )
    expect(delta).toBeTruthy()
    // open: not baked yet
    let view = (await as('verkauf').get(`/api/rest?date=${TUE}`)).body.data
    expect(restLine(view, 'test-doppel|').baked).toBe(40)
    expect(
      (
        await as('backstube').post(
          `/api/backzettel/${SAT}/deltas/${delta.id}/ack`
        )
      ).status
    ).toBe(200)
    view = (await as('verkauf').get(`/api/rest?date=${TUE}`)).body.data
    expect(restLine(view, 'test-doppel|').baked).toBe(43)
  })
})

describe('counting bread by size', () => {
  it('a product of another size is refused; the size’s own product is saved', async () => {
    const wrong = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          {
            itemId: 'test-korn',
            variant: 'g500',
            productId: 'test-korn-1000',
            qty: 1,
          },
        ],
      })
    expect(wrong.status).toBe(400)
    expect(wrong.body).toMatchObject({ error: 'unknown_product' })
    expect(wrong.body.message).toEqual(expect.any(String))

    const ok = await as('verkauf')
      .put(`/api/rest/${TUE}`)
      .send({
        items: [
          {
            itemId: 'test-korn',
            variant: 'g500',
            productId: 'test-korn-500',
            qty: 1,
          },
        ],
      })
    expect(ok.status).toBe(200)
    expect(restLine(ok.body.data, 'test-korn|g500')).toMatchObject({
      counted: true,
      rest: 1,
    })
    const stored = await RestCount.findOne({
      where: { businessDate: TUE, itemId: 'test-korn', variant: 'g500' },
    })
    expect(JSON.parse(String(stored?.lineRows))).toEqual(['test-korn-500'])
  })

  it('the summary rates Tuesday over both sheets, Sunday is a gap', async () => {
    const view = (await as('verkauf').get(`/api/rest?date=${TUE}`)).body.data
    const items = view.lines.flatMap((l: any) =>
      l.rows.map((r: any) => ({
        itemId: l.itemId,
        ...(l.variant ? { variant: l.variant } : {}),
        productId: r.productId,
        qty: r.qty ?? 0,
        expected: r.qty,
      }))
    )
    expect(
      (await as('verkauf').put(`/api/rest/${TUE}`).send({ items })).status
    ).toBe(200)
    const res = await as('inhaber').get(
      `/api/rest/summary?from=${SAT}&to=${TUE}`
    )
    expect(res.status).toBe(200)
    const s = res.body.data
    const status = Object.fromEntries(
      s.days.map((d: any) => [d.date, d.status])
    )
    expect(status).toMatchObject({
      [SUN]: 'not_counted',
      [MON]: 'ruhetag',
      [TUE]: 'counted',
    })
    expect(s.items.find((i: any) => i.itemId === 'test-doppel')).toMatchObject({
      days: 1,
      baked: 43,
    })
    const korn = s.items.find((i: any) => i.itemId === 'test-korn')
    expect(korn).toMatchObject({ days: 1, baked: 6, rest: 1 })
    expect(korn.variants.map((v: any) => v.label)).toEqual(['500 g', '1 kg'])
  })
})
