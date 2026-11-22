/**
 * `/api/abgleich` - „Abgleich Produktion ↔ Kasse“ against the real app
 * (in-memory SQLite, all migrations). Synthetic master data from
 * tests/fixtures (written to a temp "hq"), a synthetic cash report,
 * synthetic users. Nothing here comes from the real hq.
 *
 * Dates: Di 2026-12-01 (report: 9 Plunder), Mi 2026-12-02 (no report),
 * Mo 2026-12-07 (Ruhetag), „heute“ Di 2026-12-08.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

/* eslint-disable @typescript-eslint/no-var-requires */
const fixture = require('../fixtures/backzettel.synthetic')
const grundmengen = require('../fixtures/backzettel-grundmengen.synthetic')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const TODAY = '2026-12-08'
const TUE = '2026-12-01'
const WED = '2026-12-02'
const THU = '2026-12-03'
const MON = '2026-12-07'
const PINNED_NOW = new Date('2026-12-08T09:00:00Z')

let api: TestApp
let hqDir: string
let reportsDir: string
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
  patch: (p: string) => request(api.app).patch(p).set(bearer(tokens[role])),
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

function posten(data: any, key: string) {
  return (
    data.items.find((p: any) => p.key === key) ||
    data.unmatched.find((p: any) => p.key === key)
  )
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abgleich-hq-'))
  writeHq(hqDir)
  reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abgleich-reports-'))
  fs.mkdirSync(path.join(reportsDir, 'converted'))
  // Tuesday: 9 Plunder (PLU 906) sold, one storno pair that nets out.
  const converted = grundmengen.convertedReport(TUE, [
    { items: [[906, 9]] },
    { items: [[906, 1]] },
    { items: [[906, -1]], type: 'storno' },
    { items: [[701, 3]] },
  ])
  const collective = converted.transactions[3].items[0]
  Object.assign(collective, { product: 'Diverse', group_name: 'Brötchen' })
  fs.writeFileSync(
    path.join(reportsDir, 'converted', `${TUE}_90000001.json`),
    JSON.stringify(converted)
  )
  api = await createTestApp({
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      hq: { reportsDir, today: TODAY },
      hqProducts: { productsDir: path.join(hqDir, 'products'), writeDir: null },
      preorders: { now: () => PINNED_NOW },
    },
  })
  tokens.inhaber = await sessionFor(api.app, 'test.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'test.backstube', 'backstube')
  tokens.verkauf = await sessionFor(api.app, 'test.verkauf', 'verkauf')
  tokens.fahrer = await sessionFor(api.app, 'test.fahrer', 'fahrer')
})

afterAll(async () => {
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
  fs.rmSync(reportsDir, { recursive: true, force: true })
})

describe('access', () => {
  it('needs a session', async () => {
    const res = await request(api.app).get('/api/abgleich')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
  })

  it('only the owner sees it (403 with a German message otherwise)', async () => {
    for (const role of ['verkauf', 'backstube', 'fahrer'] as const) {
      for (const p of ['/api/abgleich', '/api/abgleich/csv']) {
        const res = await as(role).get(p)
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({ error: 'forbidden' })
        expect(res.body.message).toEqual(expect.any(String))
      }
    }
  })
})

describe('GET /api/abgleich', () => {
  it('defaults to the last 7 bake days before today', async () => {
    const res = await as('inhaber').get('/api/abgleich')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      from: '2026-11-29',
      to: MON,
      today: TODAY,
      configStatus: 'ok',
      reportsAvailable: true,
    })
    expect(res.body.data.days.find((d: any) => d.date === MON).status).toBe(
      'ruhetag'
    )
  })

  it('refuses bad ranges with a code and a German message', async () => {
    const bad = await as('inhaber').get('/api/abgleich?from=2026-02-30')
    expect(bad.status).toBe(400)
    expect(bad.body).toMatchObject({ success: false, error: 'invalid_date' })
    expect(bad.body.message).toMatch(/Ungültiges Datum/)
    const reversed = await as('inhaber').get(
      `/api/abgleich?from=${WED}&to=${TUE}`
    )
    expect(reversed.status).toBe(400)
    expect(JSON.parse(reversed.text)).toMatchObject({ error: 'invalid_range' })
    const long = await as('inhaber').get(
      `/api/abgleich?from=2026-10-01&to=${MON}`
    )
    expect(long.status).toBe(400)
    expect(long.body).toMatchObject({ error: 'range_too_large' })
    expect(long.body.message).toMatch(/höchstens 62 Tage/)
  })

  it('an unconfirmed day counts with the plan and says „geplant“; no report is a gap', async () => {
    const res = await as('inhaber').get(`/api/abgleich?from=${TUE}&to=${WED}`)
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data.basis).toBe('geplant')
    expect(data.counts).toMatchObject({
      bakeDays: 2,
      planned: 2,
      confirmed: 0,
      noReport: 1,
    })
    const plunder = posten(data, 'plunder')
    expect(plunder).toMatchObject({
      status: 'vergleichbar',
      basis: 'geplant',
      comparableDays: 1,
      sold: 9,
      rest: null,
      unexplained: null,
    })
    expect(plunder.open).toBe(plunder.baked - 9)
    expect(plunder.gaps.noReport).toEqual([WED])
    // Weck has no PLU: listed apart.
    expect(posten(data, 'weck')).toMatchObject({ status: 'keine_plu' })
    expect(data.items.some((p: any) => p.key === 'weck')).toBe(false)
    expect(data.euro.days[0].abschnitte).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'broetchen',
          istEur: 3,
          sammelEur: 3,
        }),
        expect.objectContaining({ section: 'kaffeestueckchen', istEur: 9 }),
      ])
    )
  })

  it('zieht eine gekennzeichnete Vorbestellung im Entwurf und nach der Freigabe ab', async () => {
    const created = await as('verkauf')
      .post('/api/preorders')
      .send({
        channel: 'laden',
        customerName: 'Testbestellung Euro',
        pickupDate: THU,
        items: [{ productId: 'test-plunder', quantity: 2 }],
      })
    expect(created.status).toBe(201)
    expect(created.body.data.externalPayment).toBe(false)
    const order = `/api/preorders/${created.body.data.id}`
    const read = () =>
      as('inhaber').get(`/api/abgleich?from=${THU}&to=${THU}&folgetag=`)
    const item = (res: request.Response) =>
      res.body.data.euro.days[0].items.find(
        (p: { key: string }) => p.key === 'plunder'
      )
    const before = item(await read()).sollEur
    expect(before).toBeGreaterThan(3)
    const invalid = await as('verkauf')
      .patch(order)
      .send({ externalPayment: 'ja' })
    expect(invalid.body.error).toBe('invalid_external_payment')
    const updated = await as('verkauf')
      .patch(order)
      .send({ externalPayment: true })
    expect(updated.body.data).toMatchObject({
      externalPayment: true,
      paid: false,
    })
    expect(item(await read())).toMatchObject({
      sollEur: before - 3,
      istEur: null,
    })

    expect(
      (await as('inhaber').post(`/api/backzettel/${THU}/confirm`)).status
    ).toBe(200)
    const confirmed = await read()
    expect(confirmed.body.data.euro.days[0].basis).toBe('freigegeben')
    expect(item(confirmed)).toMatchObject({ sollEur: before - 3, istEur: null })

    const driver = await as('fahrer').post(`${order}/status`).send({
      status: 'abgeholt',
      paid: true,
      externalPayment: false,
    })
    expect(driver.status).toBe(403)

    const handover = await as('verkauf').post(`${order}/status`).send({
      status: 'abgeholt',
      paid: true,
      externalPayment: false,
    })
    expect(handover.body.data).toMatchObject({
      status: 'abgeholt',
      paid: true,
      externalPayment: false,
    })
    expect(item(await read()).sollEur).toBe(before)
    const undone = await as('verkauf')
      .post(`${order}/status`)
      .send({ status: 'offen' })
    expect(undone.body.data).toMatchObject({
      status: 'offen',
      paid: false,
      externalPayment: true,
    })
    expect(item(await read()).sollEur).toBe(before - 3)

    const invalidSection = await as('inhaber').get(
      '/api/abgleich?folgetag=unbekannt'
    )
    expect(invalidSection.body.error).toBe('invalid_next_day_sections')
  })

  it('with a confirmed sheet and a rest count it gives Ungeklärt', async () => {
    expect(
      (await as('inhaber').post(`/api/backzettel/${TUE}/confirm`)).status
    ).toBe(200)
    expect(
      (
        await as('verkauf')
          .put(`/api/rest/${TUE}`)
          .send({
            items: [{ itemId: 'plunder', productId: 'test-plunder', qty: 1 }],
          })
      ).status
    ).toBe(200)
    const res = await as('inhaber').get(`/api/abgleich?from=${TUE}&to=${TUE}`)
    const plunder = posten(res.body.data, 'plunder')
    expect(plunder).toMatchObject({
      basis: 'freigegeben',
      sold: 9,
      rest: 1,
      restDays: 1,
    })
    expect(plunder.unexplained).toBe(plunder.baked - plunder.cap - 9 - 1)
    expect(plunder.ampel).toEqual(expect.any(String))
    // No names of whoever counted.
    expect(JSON.stringify(res.body.data)).not.toMatch(/test\.verkauf|Test test/)
  })
})

describe('GET /api/abgleich/csv', () => {
  it('sends the CSV with BOM and a file name', async () => {
    const res = await as('inhaber').get(
      `/api/abgleich/csv?from=${TUE}&to=${WED}`
    )
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toContain(
      `abgleich-produktion-kasse-${TUE}-bis-${WED}.csv`
    )
    expect(res.text.charCodeAt(0)).toBe(0xfeff)
    expect(res.text).toContain('Abgleich Produktion - Kasse')
    expect(res.text).toContain('kein Kassenbericht')
  })

  it('refuses a bad range as JSON', async () => {
    const res = await as('inhaber').get('/api/abgleich/csv?to=kaputt')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'invalid_date' })
  })
})
