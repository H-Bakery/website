/**
 * Z14: `GET /api/preorders/pickup-points` carries `pickupDays` - the pickup
 * days the calendar (kalender.yaml) or the weekly rest day closes, so the
 * preorder form does not offer them. Same rule as saving (`pickupDayClosed`).
 * Synthetic hq dir: invented products, invented closing days.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kalender = require('../../src/services/kalender.core')

jest.setTimeout(30000)

// Thursday 2026-11-12 10:00 Berlin
const NOW = new Date('2026-11-12T09:00:00.000Z')
const MOERSBACH = 'kindergarten-moersbach'
const PRODUCT = fixture.PRODUCTS_V2[0].id as string

let api: TestApp
let hqDir: string
let tokens: Record<'verkauf' | 'fahrer' | 'backstube', Record<string, string>>

const kalenderFile = () => path.join(hqDir, 'config', 'kalender.yaml')
const feiertage = (year: number) =>
  kalender.holidaysSaarland(year).map((h: { date: string; name: string }) => ({
    datum: h.date,
    name: h.name,
  }))

function writeKalender(): void {
  // JSON is valid YAML.
  fs.writeFileSync(
    kalenderFile(),
    JSON.stringify(
      {
        version: 1,
        bundesland: 'saarland',
        feiertage: { 2026: feiertage(2026) },
        tage: [
          {
            von: '2026-11-18',
            bis: '2026-11-19',
            typ: 'geschlossen',
            notiz: 'Betriebsferien',
          },
          { datum: '2026-11-21', typ: 'geschlossen', notiz: 'Inventur' },
          {
            datum: '2026-11-23',
            typ: 'sonderoeffnung',
            wie: 6,
            notiz: 'Kirmes',
          },
        ],
      },
      null,
      2
    )
  )
}

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-pickup-days-'))
  fs.mkdirSync(path.join(hqDir, 'config'), { recursive: true })
  fs.mkdirSync(path.join(hqDir, 'products'), { recursive: true })
  fs.mkdirSync(path.join(hqDir, 'data', 'recipes', 'fillings'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(hqDir, 'data', 'recipes', 'fillings', 'test.md'),
    fixture.RECIPE_MD
  )
  for (const p of fixture.PRODUCTS_V2) {
    fs.writeFileSync(
      path.join(hqDir, 'products', `${p.numeric_id}-${p.id}.md`),
      `---\nid: ${p.id}\nnumeric_id: ${p.numeric_id}\nname: Test ${p.id}\nprice: 1.5\navailable: true\n---\n\nText\n`
    )
  }
  fs.writeFileSync(
    path.join(hqDir, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.configV2(), null, 2)
  )
  writeKalender()

  api = await createTestApp({
    app: {
      hqProducts: {
        productsDir: path.join(hqDir, 'products'),
        writeDir: null,
      },
      backzettel: { hqDir, cacheMs: 0, now: () => NOW },
      preorders: {
        productsDir: path.join(hqDir, 'products'),
        variantsForProduct: () => null,
        now: () => NOW,
      },
    },
  })
  tokens = {
    verkauf: bearer(await sessionFor(api.app, 'tage.verkauf', 'verkauf')),
    fahrer: bearer(await sessionFor(api.app, 'tage.fahrer', 'fahrer')),
    backstube: bearer(await sessionFor(api.app, 'tage.backstube', 'backstube')),
  }
})

afterAll(async () => {
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
})

interface ClosedDay {
  date: string
  code: string
  reason: string | null
  message: string
  shopOnly: boolean
}

async function pickupDays(role: 'verkauf' | 'fahrer' = 'verkauf') {
  const res = await request(api.app)
    .get('/api/preorders/pickup-points')
    .set(tokens[role])
  expect(res.status).toBe(200)
  const days = res.body.pickupDays as {
    from: string
    to: string
    calendar: boolean
    closed: ClosedDay[]
  }
  return {
    res,
    days,
    byDate: Object.fromEntries(days.closed.map((d) => [d.date, d])),
  }
}

const order = (pickupDate: string, extra: Record<string, unknown> = {}) =>
  request(api.app)
    .post('/api/preorders')
    .set(tokens.verkauf)
    .send({
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      customerPhone: '0170 000 0001',
      pickupDate,
      items: [{ productId: PRODUCT, quantity: 1 }],
      ...extra,
    })

describe('GET /api/preorders/pickup-points → pickupDays (Z14)', () => {
  it('lists the closed days of the accepted window next to the pickup points', async () => {
    const { res, days, byDate } = await pickupDays()
    // the pickup points are unchanged
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: MOERSBACH, weekday: 6 }),
    ])
    expect(res.body.count).toBe(1)
    expect(days).toMatchObject({
      from: '2026-10-13',
      to: '2027-11-13',
      calendar: true,
    })
    expect(byDate['2026-11-19']).toEqual({
      date: '2026-11-19',
      code: 'geschlossen',
      reason: 'Betriebsferien',
      message:
        'Am Donnerstag, 19.11.2026 (Betriebsferien), ist die Bäckerei geschlossen - bitte einen anderen Abholtag wählen.',
      shopOnly: false,
    })
    expect(byDate['2026-11-21']).toMatchObject({
      code: 'geschlossen',
      reason: 'Inventur',
      shopOnly: false,
    })
    expect(byDate['2026-12-25']).toMatchObject({
      code: 'geschlossen',
      reason: '1. Weihnachtstag',
    })
    expect(byDate['2026-11-16']).toMatchObject({
      code: 'ruhetag',
      reason: null,
      shopOnly: true,
    })
    // special opening on a Monday, a normal day, a year without holidays
    expect(byDate['2026-11-23']).toBeUndefined()
    expect(byDate['2026-11-17']).toBeUndefined()
    expect(byDate['2027-01-01']).toBeUndefined()
  })

  it('agrees with what saving rejects and accepts', async () => {
    const { byDate } = await pickupDays()
    const closed = await order('2026-11-19')
    expect(closed.status).toBe(400)
    expect(closed.body).toMatchObject({
      error: 'geschlossen',
      message: byDate['2026-11-19'].message,
    })
    const monday = await order('2026-11-16')
    expect(monday.status).toBe(400)
    expect(monday.body).toMatchObject({
      error: 'ruhetag',
      message: byDate['2026-11-16'].message,
    })
    // Sammelstelle on its closed Saturday: rejected, listed as not shop-only
    const saturday = await order('2026-11-21', {
      channel: 'sammelstelle',
      pickupPointId: MOERSBACH,
    })
    expect(saturday.status).toBe(400)
    expect(saturday.body.error).toBe('geschlossen')
    // the special opening is not listed and can be ordered
    const open = await order('2026-11-23')
    expect(open.status).toBe(201)
  })

  it('fahrer reads it, backstube does not', async () => {
    const { days } = await pickupDays('fahrer')
    expect(days.closed.length).toBeGreaterThan(0)
    const res = await request(api.app)
      .get('/api/preorders/pickup-points')
      .set(tokens.backstube)
    expect(res.status).toBe(403)
    expect(res.body.message).toEqual(expect.any(String))
    expect(res.body.error).toEqual(expect.any(String))
  })

  it('no calendar file: only the Monday rule, as when saving', async () => {
    fs.rmSync(kalenderFile(), { force: true })
    try {
      const { days } = await pickupDays()
      expect(days.calendar).toBe(false)
      expect(days.closed.length).toBeGreaterThan(50)
      expect(
        days.closed.every(
          (d) =>
            d.code === 'ruhetag' &&
            d.shopOnly &&
            new Date(`${d.date}T12:00:00Z`).getUTCDay() === 1
        )
      ).toBe(true)
      const former = await order('2026-11-18')
      expect(former.status).toBe(201)
    } finally {
      writeKalender()
    }
  })

  it('invalid calendar: no invented closing day', async () => {
    fs.writeFileSync(kalenderFile(), '{ "version": 99 }')
    try {
      const { days, byDate } = await pickupDays()
      expect(days.calendar).toBe(false)
      expect(byDate['2026-11-19']).toBeUndefined()
      expect(byDate['2026-11-16']).toMatchObject({ code: 'ruhetag' })
    } finally {
      writeKalender()
    }
  })
})
