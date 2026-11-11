/**
 * „Heute keine“ and the amount of the day for a line whose Grundmenge is
 * open (`null`), against the real app - plus the Hefeteig box of a single
 * Kranz added on a weekday (litres below the rounding step, never „0 L“).
 *
 * Synthetic master data: `configV2()` with Testkäse open on Tuesdays (its
 * dough is made on Saturday's sheet, bake day Tuesday). Invented numbers,
 * nothing from hq. Own file: the models are process-global, a second hq
 * cannot share another file's app.
 *
 *   Sa 2026-11-28  sheet with the rolls for So 29.11. and Di 01.12.
 *   Di 2026-12-01  Testkorn „Kasten“ open (lead 0), Testkranz has no base
 *   Mi 2026-12-02  nothing open
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { AuditLog, BackzettelLine } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(30000)

const PINNED_NOW = new Date('2026-11-20T09:00:00Z')
const SAT = '2026-11-28'
const TUE = '2026-12-01'
const KAESE = `test-kaese|@${TUE}`
const KAESE_URL = `/api/backzettel/${SAT}/lines/test-kaese/correction`

let api: TestApp
let hqDir: string
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
  for (const p of fixture.PRODUCTS_V2) {
    fs.writeFileSync(
      path.join(dir, 'products', `${p.numeric_id}-${p.id}.md`),
      `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test ${p.id}\nprice: 1.5\navailable: true\n---\n\nText\n`
    )
  }
  const config = fixture.configV2()
  config.items.find((i: any) => i.id === 'test-kaese').base[2] = null
  // JSON is valid YAML.
  fs.writeFileSync(
    path.join(dir, 'config', 'backzettel.yaml'),
    JSON.stringify(config, null, 2)
  )
}

const as = (role: keyof typeof tokens) => ({
  get: (p: string) => request(api.app).get(p).set(bearer(tokens[role])),
  put: (p: string) => request(api.app).put(p).set(bearer(tokens[role])),
  post: (p: string) => request(api.app).post(p).set(bearer(tokens[role])),
})

const idle = () => (api.app.locals['backzettelIdle'] as () => Promise<void>)()
const allLines = (day: any): any[] => day.sections.flatMap((s: any) => s.lines)
const line = (day: any, key: string): any =>
  allLines(day).find((l: any) => l.key === key)
const dough = (day: any, id: string): any =>
  day.doughs.find((d: any) => d.id === id)
const box = (day: any, id: string): any =>
  day.machine.find((m: any) => m.id === id)
const warning = (day: any, code: string): any[] =>
  day.warnings.filter((w: any) => w.code === code)
const kaeseRow = () =>
  BackzettelLine.findOne({ where: { date: SAT, itemId: 'test-kaese' } })

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'none-today-hq-'))
  writeHq(hqDir)
  api = await createTestApp({
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      preorders: {
        productsDir: path.join(hqDir, 'products'),
        variantsForProduct: () => null,
      },
    },
  })
  tokens.inhaber = await sessionFor(api.app, 'nt.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'nt.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'nt.verkauf', 'verkauf')
})

afterAll(async () => {
  await idle()
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
})

describe('an open Grundmenge without a decision', () => {
  it('stays „offen“: the line is a minimum, its dough has no litres', async () => {
    const res = await as('verkauf').get(`/api/backzettel/${SAT}`)
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(line(day, KAESE)).toMatchObject({
      baseUnset: true,
      totalIsMinimum: true,
      total: 0,
      correctionBy: null,
    })
    expect(line(day, KAESE).dayDecision).toBeUndefined()
    expect(dough(day, 'test-weck-teig')).toMatchObject({
      kg: null,
      complete: false,
      liters: { exact: null, rounded: null, reason: 'dough_incomplete' },
    })
    expect(warning(day, 'day_decisions')).toEqual([])
  })

  it('a correction of 0 still means „no correction“ - nothing is stored, nothing becomes 0', async () => {
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({ correction: 0, bakeDate: TUE })
    expect(res.status).toBe(200)
    expect(line(res.body.data, KAESE)).toMatchObject({ totalIsMinimum: true })
    expect(dough(res.body.data, 'test-weck-teig').complete).toBe(false)
    expect(await kaeseRow()).toBeNull()
  })
})

describe('PUT …/correction { noneToday: true }', () => {
  it('decides „Heute keine“: the dough becomes complete, the base stays open', async () => {
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({
        noneToday: true,
        bakeDate: TUE,
        expected: { correction: 0, reason: null },
      })
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(line(day, KAESE)).toMatchObject({
      base: 0,
      baseUnset: true,
      noneToday: true,
      dayDecision: 'none',
      totalIsMinimum: false,
      correction: 0,
      total: 0,
      id: expect.any(Number),
      correctionBy: { displayName: expect.any(String) },
    })
    const weck = dough(day, 'test-weck-teig')
    expect(weck.complete).toBe(true)
    expect(weck.kg).toEqual(expect.any(Number))
    expect(weck.liters).toMatchObject({
      rounded: expect.any(Number),
      reason: null,
    })
    expect(box(day, 'test-weck-teig').liters.rounded).toBe(weck.liters.rounded)
    // visible as a decision of the day - on screen, tablet and print
    expect(warning(day, 'day_decisions')).toEqual([
      expect.objectContaining({
        bakeDate: TUE,
        message:
          'Tagesentscheidung für Dienstag (Grundmenge offen): Testkäse – heute keine.',
      }),
    ])
    expect(await kaeseRow()).toMatchObject({
      bakeDate: TUE,
      noneToday: true,
      correctionReason: null,
    })
    expect(Number((await kaeseRow())?.correction)).toBe(0)
    const audit = await AuditLog.findOne({
      where: { action: 'correction', entityId: SAT },
      order: [['id', 'DESC']],
    })
    expect(audit?.data).toMatchObject({
      itemId: 'test-kaese',
      bakeDate: TUE,
      from: { correction: 0, noneToday: false },
      to: { correction: 0, noneToday: true },
    })
  })

  it('saving the same again is a no-op (no second audit row)', async () => {
    const count = () =>
      AuditLog.count({ where: { action: 'correction', entityId: SAT } })
    const before = await count()
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({ noneToday: true, bakeDate: TUE })
    expect(res.status).toBe(200)
    expect(await count()).toBe(before)
  })

  it('409 correction_changed when the editor was opened before the decision', async () => {
    const res = await as('inhaber')
      .put(KAESE_URL)
      .send({
        correction: 8,
        reason: 'Menge für heute',
        bakeDate: TUE,
        expected: { correction: 0, reason: null },
      })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'correction_changed',
      current: { correction: 0, noneToday: true },
    })
    expect(res.body.message).toMatch(/inzwischen auf „Heute keine“ gesetzt/)
    expect(await kaeseRow()).toMatchObject({ noneToday: true })
  })

  it('an optional reason is kept and shown', async () => {
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({
        noneToday: true,
        reason: ' Froster voll ',
        bakeDate: TUE,
        expected: { correction: 0, reason: null, noneToday: true },
      })
    expect(res.status).toBe(200)
    expect(line(res.body.data, KAESE)).toMatchObject({
      dayDecision: 'none',
      correctionReason: 'Froster voll',
    })
  })

  it('400 validation: „Heute keine“ together with an amount, or a wrong type', async () => {
    const both = await as('backstube')
      .put(KAESE_URL)
      .send({ noneToday: true, correction: 5, reason: 'x', bakeDate: TUE })
    expect(both.status).toBe(400)
    expect(both.body).toMatchObject({
      error: 'validation',
      message:
        '„Heute keine“ und eine Menge schließen sich aus - bitte nur eines von beiden eintragen.',
    })
    const type = await as('backstube')
      .put(KAESE_URL)
      .send({ noneToday: 'ja', correction: 0, bakeDate: TUE })
    expect(type.status).toBe(400)
    expect(type.body).toMatchObject({ error: 'validation' })
    expect(type.body.message).toEqual(expect.any(String))
  })

  it('400 base_not_open: a line with a Grundmenge is changed by a correction, not by „Heute keine“', async () => {
    // Teststern has 12 for Tuesday; Testmisch has none at all on Saturday's
    // Tuesday (0 = not baked) - both are not „offen“.
    const res = await as('backstube')
      .put(`/api/backzettel/${SAT}/lines/test-stern/correction`)
      .send({ noneToday: true, bakeDate: TUE })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'base_not_open' })
    expect(res.body.message).toMatch(
      /„Teststern“ hat für diesen Tag eine Grundmenge/
    )
    expect(
      await BackzettelLine.findOne({
        where: { date: SAT, itemId: 'test-stern' },
      })
    ).toBeNull()
    const zero = await as('backstube')
      .put(`/api/backzettel/${TUE}/lines/test-kranz/correction`)
      .send({ noneToday: true })
    expect(zero.status).toBe(400)
    expect(zero.body).toMatchObject({ error: 'base_not_open' })
  })

  it('403 for a role that may not plan', async () => {
    const res = await as('verkauf')
      .put(KAESE_URL)
      .send({ noneToday: true, bakeDate: TUE })
    expect(res.status).toBe(403)
  })
})

describe('confirm and reopen keep the decision', () => {
  it('the confirmed sheet still says „Heute keine“ with the base open - never a base of 0', async () => {
    const res = await as('inhaber').post(`/api/backzettel/${SAT}/confirm`)
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(day.status).toBe('confirmed')
    expect(line(day, KAESE)).toMatchObject({
      baseUnset: true,
      noneToday: true,
      dayDecision: 'none',
      totalIsMinimum: false,
      total: 0,
      correctionReason: 'Froster voll',
      correctionBy: { displayName: expect.any(String) },
    })
    expect(dough(day, 'test-weck-teig').complete).toBe(true)
    expect(warning(day, 'day_decisions')).toHaveLength(1)
    expect(day.configChangedSinceConfirm).toBe(false)
    await idle()
    const again = await as('verkauf').get(`/api/backzettel/${SAT}`)
    expect(line(again.body.data, KAESE)).toMatchObject({ dayDecision: 'none' })
  })

  it('reopen: the draft still carries it; clearing it makes the line „offen“ again', async () => {
    const reopen = await as('inhaber').post(`/api/backzettel/${SAT}/reopen`)
    expect(reopen.status).toBe(200)
    expect(line(reopen.body.data, KAESE)).toMatchObject({
      dayDecision: 'none',
      totalIsMinimum: false,
    })
    const clear = await as('inhaber')
      .put(KAESE_URL)
      .send({ correction: 0, bakeDate: TUE })
    expect(clear.status).toBe(200)
    const day = clear.body.data
    expect(line(day, KAESE)).toMatchObject({
      baseUnset: true,
      totalIsMinimum: true,
      correctionBy: null,
      correctionReason: null,
    })
    expect(line(day, KAESE).dayDecision).toBeUndefined()
    expect(dough(day, 'test-weck-teig').complete).toBe(false)
    expect(warning(day, 'day_decisions')).toEqual([])
    expect(await kaeseRow()).toMatchObject({
      noneToday: false,
      correctionBy: null,
    })
  })

  it('a re-confirm without the decision stores the line as open again', async () => {
    const res = await as('inhaber').post(`/api/backzettel/${SAT}/confirm`)
    expect(res.status).toBe(200)
    expect(line(res.body.data, KAESE)).toMatchObject({
      baseUnset: true,
      totalIsMinimum: true,
    })
    expect(line(res.body.data, KAESE).dayDecision).toBeUndefined()
    expect(await kaeseRow()).toMatchObject({ noneToday: false })
    await idle()
    await as('inhaber').post(`/api/backzettel/${SAT}/reopen`)
    await idle()
  })
})

describe('the amount of the day through the correction', () => {
  it('a correction on an open line is the decision „amount“ - the dough is complete', async () => {
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({ correction: 8, reason: 'Menge für heute', bakeDate: TUE })
    expect(res.status).toBe(200)
    const day = res.body.data
    expect(line(day, KAESE)).toMatchObject({
      baseUnset: true,
      dayDecision: 'amount',
      totalIsMinimum: false,
      correction: 8,
      total: 8,
    })
    expect(line(day, KAESE).noneToday).toBeUndefined()
    expect(dough(day, 'test-weck-teig').complete).toBe(true)
    expect(warning(day, 'day_decisions')[0].items).toEqual(['Testkäse – 8'])
  })

  it('switching to „Heute keine“ replaces the amount', async () => {
    const res = await as('backstube')
      .put(KAESE_URL)
      .send({
        noneToday: true,
        bakeDate: TUE,
        expected: { correction: 8, reason: 'Menge für heute' },
      })
    expect(res.status).toBe(200)
    expect(line(res.body.data, KAESE)).toMatchObject({
      dayDecision: 'none',
      correction: 0,
      total: 0,
    })
  })
})

describe('a single Kranz added on a weekday', () => {
  it('the Hefeteig box shows its kg and the exact litres, never „0 L“', async () => {
    const res = await as('backstube')
      .put(`/api/backzettel/${TUE}/lines/test-kranz/correction`)
      .send({ correction: 1, reason: 'bestellt' })
    expect(res.status).toBe(200)
    // 1 Kranz x 2 pieces x 600 g = 1.2 kg / 5 kg per litre = 0.24 L;
    // „nearest whole litre“ would say 0.
    const expected = {
      kg: 1.2,
      liters: {
        exact: 0.24,
        rounded: null,
        reason: 'below_rounding_step',
        step: 1,
      },
    }
    expect(dough(res.body.data, 'test-hefe')).toMatchObject(expected)
    expect(box(res.body.data, 'test-hefe')).toMatchObject(expected)
  })
})
