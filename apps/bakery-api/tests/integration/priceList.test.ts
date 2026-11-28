/**
 * Preisliste (`/api/price-list`, `/api/price-list/export.csv`) against
 * `createApp()`: roles per audience, options, the partner assortment and
 * the CSV. Synthetic catalogue (`tools/e2e/hq-products`) and users only.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'

import { createApp } from '../../src/app'
import { invalidateCatalogue } from '../../src/services/hq-catalogue'
import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs, tempDir } from '../helpers/hqProducts'

jest.setTimeout(30000)

const NBSP = '\u00a0'
const FILES = [
  '1-kornbrot-500g.md',
  '2-kornbrot-1000g.md',
  '13-musterweck.md',
  '21-musterbaguette-klein.md',
  '22-musterbaguette-gross.md',
  '39-kaesekuchen-1-stueck.md',
  '45-musterkuchen-marmor.md',
  '40-musterkuchen-marmor-1-stueck.md',
]

let api: TestApp
let productsDir: string
const tokens: Record<string, string> = {}
const ROLES = ['inhaber', 'verkauf', 'backstube', 'fahrer'] as const
type Role = (typeof ROLES)[number]

function writeProduct(file: string, frontmatter: string[]): void {
  fs.writeFileSync(
    path.join(productsDir, file),
    ['---', ...frontmatter, '---', '', '# Testprodukt', ''].join('\n')
  )
}

beforeAll(async () => {
  productsDir = makeProductsDir(FILES)
  // Ein Produkt ohne Preis und ein nicht verfügbares - synthetisch.
  writeProduct('90-ohnepreis.md', [
    'id: ohnepreis',
    'numeric_id: 90',
    'name: Testgebäck ohne Preis',
    'category: teilchen',
    'available: true',
  ])
  writeProduct('91-ausverkauft.md', [
    'id: ausverkauft',
    'numeric_id: 91',
    'name: Testgebäck pausiert',
    'category: teilchen',
    'price: 1.3',
    'available: false',
  ])
  invalidateCatalogue(productsDir)
  api = await createTestApp({
    seedPartners: true,
    app: { hqProducts: { productsDir, writeDir: null } },
  })
  for (const role of ROLES) {
    await createUser({ username: `test.${role}`, role })
    tokens[role] = (await login(api.app, `test.${role}`)).token
  }
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

const get = (role: Role, url: string) =>
  request(api.app).get(url).set(bearer(tokens[role]))

function expectError(res: request.Response, status: number, error: string) {
  expect(res.status).toBe(status)
  expect(res.body).toMatchObject({ success: false, error })
  expect(typeof res.body.message).toBe('string')
  expect(res.body.message.length).toBeGreaterThan(0)
}

describe('roles', () => {
  const urls = ['/api/price-list', '/api/price-list/export.csv']

  it.each(urls)('GET %s: 401 without a session', async (url) => {
    expectError(await request(api.app).get(url), 401, 'unauthorized')
  })

  it.each(urls)(
    'GET %s: inhaber and verkauf get the shop list',
    async (url) => {
      expect((await get('inhaber', url)).status).toBe(200)
      expect((await get('verkauf', url)).status).toBe(200)
    }
  )

  it.each(urls)('GET %s: backstube and fahrer do not', async (url) => {
    expectError(await get('backstube', url), 403, 'forbidden')
    expectError(await get('fahrer', url), 403, 'forbidden')
  })

  it.each(urls)('GET %s: the partner list is for inhaber only', async (url) => {
    const res = await get('verkauf', `${url}?audience=partner&partnerId=1`)
    expectError(res, 403, 'forbidden')
    expect(res.body.message).toContain('Inhaber')
  })
})

describe('GET /api/price-list', () => {
  it('builds the shop list from the approved catalogue', async () => {
    const res = await get('verkauf', '/api/price-list')
    expect(res.status).toBe(200)
    const doc = res.body.data
    expect(doc).toMatchObject({
      status: 'ok',
      audience: 'laden',
      title: 'Preisliste',
      partner: null,
    })
    expect(doc.generatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(doc.categories.map((c: any) => c.key)).toEqual([
      'brot',
      'broetchen',
      'baguette',
      'kuchen',
    ])
    const brot = doc.categories[0]
    expect(brot.layout).toBe('matrix')
    expect(brot.rows).toHaveLength(1)
    expect(brot.rows[0].variants.map((v: any) => v.priceText)).toEqual([
      `2,50${NBSP}€`,
      `4,40${NBSP}€`,
    ])
  })

  it('leaves the product without a price out and names it', async () => {
    const doc = (await get('inhaber', '/api/price-list')).body.data
    expect(doc.omitted.noPrice).toEqual([
      expect.objectContaining({
        id: 'ohnepreis',
        name: 'Testgebäck ohne Preis',
        categoryLabel: 'Teilchen',
      }),
    ])
    expect(JSON.stringify(doc.categories)).not.toContain('ohne Preis')
  })

  it('hides unavailable products unless asked', async () => {
    const hidden = (await get('inhaber', '/api/price-list')).body.data
    expect(hidden.counts.hiddenUnavailable).toBe(1)
    expect(hidden.categories.some((c: any) => c.key === 'teilchen')).toBe(false)

    const shown = (await get('inhaber', '/api/price-list?includeUnavailable=1'))
      .body.data
    const teilchen = shown.categories.find((c: any) => c.key === 'teilchen')
    expect(teilchen.rows[0]).toMatchObject({
      name: 'Testgebäck pausiert',
      unavailable: true,
    })
  })

  it('filters categories, takes valid-from and adds allergens', async () => {
    const doc = (
      await get(
        'inhaber',
        '/api/price-list?categories=kuchen,brot&validFrom=2026-12-01&allergens=1'
      )
    ).body.data
    expect(doc.categories.map((c: any) => c.key)).toEqual(['brot', 'kuchen'])
    expect(doc.validFromText).toBe('01.12.2026')
    const marmor = doc.categories[1].rows.find(
      (r: any) => r.name === 'Musterkuchen Marmor'
    )
    // Reihenfolge und Bezeichnungen aus @bakery/shared/utils (formatAllergens)
    expect(marmor.variants.map((v: any) => v.label)).toEqual(['', 'Stück'])
    expect(marmor.allergens.text).toContain('Gluten, Weizen, Ei und Milch')
  })

  it('answers no-data for a selection without products', async () => {
    const res = await get('inhaber', '/api/price-list?categories=torten')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'no-data', categories: [] })
  })

  it('rejects bad input with a German message', async () => {
    expectError(
      await get('inhaber', '/api/price-list?audience=alle'),
      400,
      'invalid_audience'
    )
    expectError(
      await get('inhaber', '/api/price-list?validFrom=2026-02-30'),
      400,
      'invalid_date'
    )
    expectError(
      await get('inhaber', '/api/price-list?categories=a&categories=b'),
      400,
      'invalid_categories'
    )
  })

  it('answers 503 when the hq catalogue is missing', async () => {
    const other = createApp({
      logRequests: false,
      sequelize: api.sequelize,
      hqProducts: {
        productsDir: path.join(tempDir('hq-missing-'), 'nicht-da'),
        writeDir: null,
      },
    })
    const res = await request(other)
      .get('/api/price-list')
      .set(bearer(tokens['inhaber']))
    expectError(res, 503, 'hq_unavailable')
  })
})

describe('partner list', () => {
  it('needs a partner', async () => {
    expectError(
      await get('inhaber', '/api/price-list?audience=partner'),
      400,
      'partner_required'
    )
    expectError(
      await get('inhaber', '/api/price-list?audience=partner&partnerId=999'),
      404,
      'PARTNER_NOT_FOUND'
    )
  })

  it('refuses to guess an assortment', async () => {
    const res = await get(
      'inhaber',
      '/api/price-list?audience=partner&partnerId=1'
    )
    expectError(res, 409, 'no_assortment')
    expect(res.body.message).toContain('Standard-Bestückung')
  })

  it('falls back to what was delivered recently', async () => {
    const created = await request(api.app)
      .post('/api/partners')
      .set(bearer(tokens['inhaber']))
      .send({ name: 'Testmarkt Lieferung' })
    expect(created.status).toBe(201)
    const id = created.body.id
    const today = new Date().toISOString().slice(0, 10)
    const visit = await request(api.app)
      .post(`/api/partners/${id}/visits`)
      .set(bearer(tokens['inhaber']))
      .send({
        businessDate: today,
        visitType: 'refill',
        items: [{ productId: 13, productSlug: 'musterweck', deliveredQty: 4 }],
      })
    expect(visit.status).toBe(201)

    const doc = (
      await get('inhaber', `/api/price-list?audience=partner&partnerId=${id}`)
    ).body.data
    expect(doc.partner.assortmentSource).toBe('visits')
    expect(doc.categories.map((c: any) => c.key)).toEqual(['broetchen'])
  })

  it('lists the standard assortment at catalogue prices', async () => {
    const template = await request(api.app)
      .put('/api/partners/1/templates/2')
      .set(bearer(tokens['inhaber']))
      .send({
        items: [
          { productId: 1, productSlug: 'kornbrot-500g', quantity: 4 },
          { productId: 13, productSlug: 'musterweck', quantity: 20 },
        ],
      })
    expect(template.status).toBe(200)

    const res = await get(
      'inhaber',
      '/api/price-list?audience=partner&partnerId=1'
    )
    expect(res.status).toBe(200)
    const doc = res.body.data
    expect(doc.title).toBe('Preisliste für Partner')
    expect(doc.partner).toMatchObject({
      id: 1,
      settlementLabel: 'Kommission',
      assortmentSource: 'templates',
    })
    expect(doc.counts.listed).toBe(2)
    expect(
      doc.categories.flatMap((c: any) =>
        c.rows.flatMap((r: any) =>
          r.variants.map((v: any) => [r.name, v.label, v.price])
        )
      )
    ).toEqual([
      ['Kornbrot', `500${NBSP}g`, 2.5],
      ['Musterweck', '', 0.45],
    ])
  })
})

describe('GET /api/price-list/export.csv', () => {
  it('is a German Excel CSV with BOM and a file name', async () => {
    const res = await get(
      'verkauf',
      '/api/price-list/export.csv?categories=brot'
    ).buffer(true)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="preisliste-laden-brot-\d{4}-\d{2}-\d{2}\.csv"$/
    )
    expect(res.text.charCodeAt(0)).toBe(0xfeff)
    expect(res.text.slice(1).split('\r\n').slice(0, 3)).toEqual([
      'Kategorie;Artikel;Einheit;Preis (EUR);Artikelnummer',
      'Brot;Kornbrot;500 g;2,50;1',
      'Brot;Kornbrot;1000 g;4,40;2',
    ])
  })

  it('answers 404 with a message when there is nothing to export', async () => {
    expectError(
      await get('inhaber', '/api/price-list/export.csv?categories=torten'),
      404,
      'no_data'
    )
  })
})
