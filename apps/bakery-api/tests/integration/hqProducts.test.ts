/**
 * hq products router (B5) against `createApp()`: reads for every session,
 * writes for `inhaber`, zero-diff round trip, and the two write modes -
 * directly into the read dir (development) and committed into a git
 * worktree (`HQ_WRITE_DIR`, D6). Synthetic fixture files only.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import {
  git,
  makeProductsDir,
  makeWriteRepo,
  removeTempDirs,
  SAMPLE_FILES,
  tempDir,
} from '../helpers/hqProducts'

let api: TestApp
let owner: Record<string, string>
let seller: Record<string, string>

/** Another app on the same database (sessions stay valid) with other hq dirs. */
function appWith(
  productsDir: string,
  writeDir: string | null,
  extra: { production?: boolean; writeBranch?: string } = {}
): Application {
  return createApp({
    logRequests: false,
    sequelize: api.sequelize,
    hqProducts: { productsDir, writeDir, ...extra },
  })
}

/**
 * The body the management edit form sends, built from a GET. Like the app
 * (`toManagementProduct`, F4) it takes the body text from `rawDescription`,
 * not from `description` (which falls back to `short_description`).
 */
function editFormBody(product: Record<string, unknown>) {
  return {
    name: product['name'],
    category: product['category'],
    price: product['price'],
    short_description: product['short_description'],
    description: product['rawDescription'],
    image: product['image'] ?? '',
    available: product['available'],
    seasonal: product['seasonal'],
  }
}

const read = (dir: string, file: string) =>
  fs.readFileSync(path.join(dir, file), 'utf-8')

beforeAll(async () => {
  api = await createTestApp()
  owner = bearer(await sessionFor(api.app, 'test.inhaber', 'inhaber'))
  seller = bearer(await sessionFor(api.app, 'test.verkauf', 'verkauf'))
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

describe('sessions and roles', () => {
  let app: Application
  beforeAll(() => {
    app = appWith(makeProductsDir(), null)
  })

  it.each([
    ['get', '/api/products'],
    ['get', '/api/hq-products'],
    ['get', '/api/hq-products/kornbrot-500g'],
    ['put', '/api/hq-products/kornbrot-500g'],
    ['post', '/api/hq-products'],
  ] as const)('%s %s without a session is 401', async (method, url) => {
    const res = await request(app)[method](url).send({})
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
    expect(typeof res.body.message).toBe('string')
  })

  it('verkauf may read but not write (403 with message)', async () => {
    await request(app).get('/api/products').set(seller).expect(200)
    const put = await request(app)
      .put('/api/hq-products/kornbrot-500g')
      .set(seller)
      .send({ price: 1 })
    expect(put.status).toBe(403)
    expect(put.body).toMatchObject({ error: 'forbidden' })
    expect(put.body.message).toMatch(/Berechtigung/)
    const post = await request(app)
      .post('/api/hq-products')
      .set(seller)
      .send({ name: 'Neu', category: 'brot', price: 1 })
    expect(post.status).toBe(403)
  })

  it('has no DELETE', async () => {
    const res = await request(app)
      .delete('/api/hq-products/kornbrot-500g')
      .set(owner)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })
})

describe('reading', () => {
  let app: Application
  beforeAll(() => {
    app = appWith(makeProductsDir(), null)
  })

  it('GET /api/products lists the catalogue sorted by numeric_id', async () => {
    const res = await request(app).get('/api/products').set(seller).expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(SAMPLE_FILES.length)
    expect(
      res.body.data.map((p: { numeric_id: number }) => p.numeric_id)
    ).toEqual([1, 2, 13, 15, 21])
    expect(res.body.data[0]).toEqual({
      id: 'kornbrot-500g',
      numeric_id: 1,
      name: 'Kornbrot 500g',
      category: 'brot',
      price: 2.5,
      available: true,
      seasonal: false,
      image: '/assets/images/products/brot-rund.svg',
      short_description: 'Kernig & saftig — das Kornbrot der Testbäckerei.',
      allergens: ['gluten', 'roggen', 'sesam', 'weizen'],
      allergens_source: 'rezept',
      allergen_recipe: 'Kornbrot',
      description:
        'Kernig & saftig — das Kornbrot der Testbäckerei. Synthetisches Testprodukt der E2E-Suite — kein Artikel aus dem Sortiment.',
      pendingApproval: false,
    })
  })

  it('filters by ?category=', async () => {
    const res = await request(app)
      .get('/api/products?category=broetchen')
      .set(seller)
      .expect(200)
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([
      'musterweck',
      'mustersemmel',
    ])
    expect(res.body.count).toBe(2)
  })

  it('a repeated ?category= (array) matches nothing, like the mock', async () => {
    for (const url of [
      '/api/products?category=brot&category=broetchen',
      '/api/hq-products?category=brot&category=broetchen',
    ]) {
      const res = await request(app).get(url).set(seller).expect(200)
      expect(res.body).toEqual({ success: true, data: [], count: 0 })
    }
  })

  it('GET /api/hq-products lists the same products', async () => {
    const res = await request(app)
      .get('/api/hq-products')
      .set(seller)
      .expect(200)
    expect(res.body.count).toBe(SAMPLE_FILES.length)
  })

  it('GET /api/hq-products/:id returns one product, 404 with message otherwise', async () => {
    const ok = await request(app)
      .get('/api/hq-products/musterweck')
      .set(seller)
      .expect(200)
    expect(ok.body.data).toMatchObject({ id: 'musterweck', numeric_id: 13 })
    const missing = await request(app)
      .get('/api/hq-products/gibt-es-nicht')
      .set(seller)
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({
      success: false,
      error: 'not_found',
      message: 'Produkt nicht gefunden.',
    })
  })

  it('a missing products dir reads as an empty catalogue, writes are 503', async () => {
    const gone = appWith(path.join(tempDir('hq-none-'), 'products'), null)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const res = await request(gone)
        .get('/api/products')
        .set(seller)
        .expect(200)
      expect(res.body).toEqual({ success: true, data: [], count: 0 })
      const put = await request(gone)
        .put('/api/hq-products/kornbrot-500g')
        .set(owner)
        .send({ price: 1 })
      expect(put.status).toBe(503)
      expect(put.body.error).toBe('hq_unavailable')
      expect(put.body.message).toMatch(/hq/)
    } finally {
      warn.mockRestore()
    }
  })
})

describe('writing without HQ_WRITE_DIR (development)', () => {
  let dir: string
  let app: Application
  beforeEach(() => {
    dir = makeProductsDir()
    app = appWith(dir, null)
  })

  it.each(SAMPLE_FILES)(
    'saving %s unchanged from the edit form leaves the file byte-identical',
    async (file) => {
      const before = read(dir, file)
      const id = file.replace(/^\d+-/, '').replace(/\.md$/, '')
      const got = await request(app).get(`/api/hq-products/${id}`).set(owner)
      const res = await request(app)
        .put(`/api/hq-products/${id}`)
        .set(owner)
        .send(editFormBody(got.body.data))
      expect(res.status).toBe(200)
      expect(res.body.pending).toBe(false)
      expect(read(dir, file)).toBe(before)
    }
  )

  it('a product without description: rawDescription is empty, an unchanged save writes nothing (F4)', async () => {
    const created = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({
        name: 'Leertext Brot',
        category: 'brot',
        price: 2.5,
        short_description: 'Nur ein Teaser',
        description: '',
        image: '',
        available: true,
        seasonal: false,
      })
    expect(created.status).toBe(201)
    // POST answers the body without its heading - not the bare heading.
    expect(created.body.data.description).toBe('')
    const file = '22-leertext-brot.md'
    const before = read(dir, file)
    expect(before.endsWith('# Leertext Brot\n')).toBe(true)

    const got = await request(app)
      .get('/api/hq-products/leertext-brot')
      .set(owner)
      .expect(200)
    // Shop view keeps its fallback; the management field is the real body.
    expect(got.body.data.description).toBe('Nur ein Teaser')
    expect(got.body.data.rawDescription).toBe('')
    const listed = await request(app).get('/api/hq-products').set(owner)
    expect(
      listed.body.data.find((p: { id: string }) => p.id === 'leertext-brot')
        .rawDescription
    ).toBe('')

    const res = await request(app)
      .put('/api/hq-products/leertext-brot')
      .set(owner)
      .send(editFormBody(got.body.data))
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('')
    expect(read(dir, file)).toBe(before)
  })

  it('the shop view (/api/products) carries no rawDescription', async () => {
    const res = await request(app).get('/api/products').set(owner).expect(200)
    expect(res.body.data[0]).not.toHaveProperty('rawDescription')
  })

  it('an empty PUT also leaves the file identical', async () => {
    const before = read(dir, '13-musterweck.md')
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({})
      .expect(200)
    expect(read(dir, '13-musterweck.md')).toBe(before)
  })

  it('a price change touches exactly the price line and is served at once', async () => {
    const before = read(dir, '13-musterweck.md')
    const res = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: '0.55' })
      .expect(200)
    expect(res.body).toMatchObject({
      success: true,
      pending: false,
      data: { id: 'musterweck', price: 0.55, pendingApproval: false },
    })
    expect(read(dir, '13-musterweck.md')).toBe(
      before.replace('price: 0.45\n', 'price: 0.55\n')
    )
    const list = await request(app).get('/api/products').set(seller)
    expect(
      list.body.data.find((p: { id: string }) => p.id === 'musterweck').price
    ).toBe(0.55)
  })

  it('rejects invalid input with 400 + German message and does not write', async () => {
    const before = read(dir, '1-kornbrot-500g.md')
    const res = await request(app)
      .put('/api/hq-products/kornbrot-500g')
      .set(owner)
      .send({ price: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      success: false,
      error: 'validation',
      message: 'Preis ist ungültig',
    })
    expect(read(dir, '1-kornbrot-500g.md')).toBe(before)
  })

  it('PUT on an unknown id is 404', async () => {
    const res = await request(app)
      .put('/api/hq-products/gibt-es-nicht')
      .set(owner)
      .send({ price: 1 })
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Produkt nicht gefunden.')
  })

  it('POST creates {numeric_id}-{slug}.md with the next number', async () => {
    const res = await request(app).post('/api/hq-products').set(owner).send({
      name: 'Käsestange Test',
      category: 'snacks',
      price: 1.8,
      short_description: 'Synthetisch.',
      description: 'Ein Testprodukt.',
      image: '',
      available: true,
      seasonal: false,
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      id: 'kaesestange-test',
      numeric_id: 22,
      description: 'Ein Testprodukt.',
      pendingApproval: false,
    })
    expect(read(dir, '22-kaesestange-test.md')).toBe(
      [
        '---',
        'id: kaesestange-test',
        'numeric_id: 22',
        'name: Käsestange Test',
        'category: snacks',
        'price: 1.8',
        'available: true',
        'seasonal: false',
        'image: ""',
        'short_description: "Synthetisch."',
        '---',
        '',
        '# Käsestange Test',
        '',
        'Ein Testprodukt.',
        '',
      ].join('\n')
    )
    const got = await request(app)
      .get('/api/hq-products/kaesestange-test')
      .set(seller)
      .expect(200)
    expect(got.body.data.numeric_id).toBe(22)
  })

  it('POST refuses duplicates (409) and incomplete input (400)', async () => {
    const dup = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Musterweck', category: 'broetchen', price: 1 })
    expect(dup.status).toBe(409)
    expect(dup.body.error).toBe('product_exists')
    expect(dup.body.message).toContain('musterweck')
    const bad = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Ohne Kategorie', price: 1 })
    expect(bad.status).toBe(400)
    expect(bad.body.message).toBe('Kategorie ist erforderlich')
  })
})

describe('writing with HQ_WRITE_DIR (git worktree on app/edits)', () => {
  let readDir: string
  let writeRoot: string
  let app: Application
  beforeEach(() => {
    readDir = makeProductsDir()
    writeRoot = makeWriteRepo(readDir)
    app = appWith(readDir, writeRoot)
  })

  const commits = () => git(writeRoot, 'rev-list', '--count', 'HEAD')

  it('commits the edit as "Verwaltung (App)" with the editor as co-author', async () => {
    const readBefore = read(readDir, '13-musterweck.md')
    const res = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.6 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      pending: true,
      data: { id: 'musterweck', price: 0.6, pendingApproval: true },
    })

    // The read clone is never written to.
    expect(read(readDir, '13-musterweck.md')).toBe(readBefore)
    expect(read(path.join(writeRoot, 'products'), '13-musterweck.md')).toBe(
      readBefore.replace('price: 0.45\n', 'price: 0.6\n')
    )

    expect(commits()).toBe('2')
    expect(git(writeRoot, 'log', '-1', '--format=%an <%ae>|%cn')).toBe(
      'Verwaltung (App) <verwaltung@bakery.local>|Verwaltung (App)'
    )
    expect(git(writeRoot, 'log', '-1', '--format=%B')).toBe(
      'products: Musterweck (musterweck) geändert\n\n' +
        'Co-authored-by: Test test.inhaber <test.inhaber@bakery.local>'
    )
    expect(git(writeRoot, 'show', '--name-only', '--format=', 'HEAD')).toBe(
      'products/13-musterweck.md'
    )
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
  })

  it('the shop sees the approved version, the management the pending one', async () => {
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.6 })
      .expect(200)
    const list = await request(app).get('/api/products').set(seller)
    const byId = Object.fromEntries(
      list.body.data.map((p: { id: string }) => [p.id, p])
    )
    expect(byId['musterweck']).toMatchObject({
      price: 0.45,
      pendingApproval: true,
    })
    expect(byId['musterweck']).not.toHaveProperty('approved')
    expect(byId['kornbrot-500g'].pendingApproval).toBe(false)

    const one = await request(app)
      .get('/api/hq-products/musterweck')
      .set(seller)
    expect(one.body.data).toMatchObject({
      price: 0.6,
      pendingApproval: true,
      approved: { id: 'musterweck', price: 0.45 },
    })
    const mgmt = await request(app).get('/api/hq-products').set(seller)
    const managed = Object.fromEntries(
      mgmt.body.data.map((p: { id: string }) => [p.id, p])
    )
    expect(managed['musterweck']).toMatchObject({
      price: 0.6,
      pendingApproval: true,
      approved: { price: 0.45 },
    })
    expect(managed['kornbrot-500g'].pendingApproval).toBe(false)
    expect(managed['kornbrot-500g']).not.toHaveProperty('approved')
  })

  it('saving the full edit form of a pending product keeps the pending edit (no lost update)', async () => {
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 9.99 })
      .expect(200)
    const got = await request(app)
      .get('/api/hq-products/musterweck')
      .set(owner)
      .expect(200)
    const res = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({
        ...editFormBody(got.body.data),
        short_description: 'Zweite Änderung.',
      })
      .expect(200)
    expect(res.body.data).toMatchObject({
      price: 9.99,
      short_description: 'Zweite Änderung.',
    })
    const file = read(path.join(writeRoot, 'products'), '13-musterweck.md')
    expect(file).toContain('price: 9.99\n')
    expect(file).toContain('short_description: "Zweite Änderung."\n')
    expect(commits()).toBe('3')

    // Saving the form of a pending product unchanged commits nothing.
    const again = await request(app)
      .get('/api/hq-products/musterweck')
      .set(owner)
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send(editFormBody(again.body.data))
      .expect(200)
    expect(commits()).toBe('3')
  })

  it('a second edit builds on the pending one; reverting clears the flag', async () => {
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.6 })
      .expect(200)
    const second = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ short_description: 'Geänderter Teaser.' })
      .expect(200)
    expect(second.body.data).toMatchObject({
      price: 0.6,
      short_description: 'Geänderter Teaser.',
    })
    expect(commits()).toBe('3')

    const back = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({
        price: 0.45,
        short_description: 'Das klassische Musterbrötchen.',
      })
      .expect(200)
    expect(back.body.pending).toBe(false)
    expect(read(path.join(writeRoot, 'products'), '13-musterweck.md')).toBe(
      read(readDir, '13-musterweck.md')
    )
    const one = await request(app)
      .get('/api/hq-products/musterweck')
      .set(seller)
    expect(one.body.data.pendingApproval).toBe(false)
  })

  it('a no-op save writes and commits nothing', async () => {
    const got = await request(app)
      .get('/api/hq-products/kornbrot-500g')
      .set(owner)
    const res = await request(app)
      .put('/api/hq-products/kornbrot-500g')
      .set(owner)
      .send(editFormBody(got.body.data))
      .expect(200)
    expect(res.body.pending).toBe(false)
    expect(commits()).toBe('1')
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
  })

  it('commits only the product file, not what else sits in the index', async () => {
    fs.writeFileSync(path.join(writeRoot, 'fremd.txt'), 'nicht von der App\n')
    git(writeRoot, 'add', 'fremd.txt')
    await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ available: false })
      .expect(200)
    expect(git(writeRoot, 'show', '--name-only', '--format=', 'HEAD')).toBe(
      'products/13-musterweck.md'
    )
    expect(git(writeRoot, 'status', '--porcelain')).toBe('A  fremd.txt')
  })

  it('POST commits a new file; it shows as pending in the management list only', async () => {
    const res = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Neues Testbrot', category: 'brot', price: 3 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      pending: true,
      data: { id: 'neues-testbrot', numeric_id: 22, pendingApproval: true },
    })
    expect(fs.existsSync(path.join(readDir, '22-neues-testbrot.md'))).toBe(
      false
    )
    expect(git(writeRoot, 'log', '-1', '--format=%s')).toBe(
      'products: Neues Testbrot (neues-testbrot) angelegt'
    )

    const shop = await request(app).get('/api/products').set(seller)
    expect(shop.body.data.map((p: { id: string }) => p.id)).not.toContain(
      'neues-testbrot'
    )
    const mgmt = await request(app).get('/api/hq-products').set(seller)
    expect(mgmt.body.data.at(-1)).toMatchObject({
      id: 'neues-testbrot',
      pendingApproval: true,
    })
    const one = await request(app)
      .get('/api/hq-products/neues-testbrot')
      .set(seller)
      .expect(200)
    expect(one.body.data).toMatchObject({
      pendingApproval: true,
      approved: null,
    })

    // Its id and number stay taken until the merge.
    const dup = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Neues Testbrot', category: 'brot', price: 3 })
    expect(dup.status).toBe(409)
    const next = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Noch eins', category: 'brot', price: 3 })
    expect(next.body.data.numeric_id).toBe(23)
  })

  it('parallel saves are serialised (no git index.lock race)', async () => {
    const results = await Promise.all(
      [0.5, 0.51, 0.52, 0.53].map((price) =>
        request(app)
          .put('/api/hq-products/musterweck')
          .set(owner)
          .send({ price })
      )
    )
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect(commits()).toBe('5')
  })

  it('a rejected commit (pre-commit hook) answers 500 and restores the file', async () => {
    const hook = path.join(writeRoot, '.git', 'hooks', 'pre-commit')
    fs.writeFileSync(hook, '#!/bin/sh\necho "abgelehnt" >&2\nexit 1\n')
    fs.chmodSync(hook, 0o755)
    const dir = path.join(writeRoot, 'products')
    const before = read(dir, '13-musterweck.md')
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const res = await request(app)
        .put('/api/hq-products/musterweck')
        .set(owner)
        .send({ price: 0.99 })
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('hq_commit_failed')
      expect(res.body.message).toMatch(/nicht in hq gespeichert/)
      expect(read(dir, '13-musterweck.md')).toBe(before)

      const created = await request(app)
        .post('/api/hq-products')
        .set(owner)
        .send({ name: 'Wird nichts', category: 'brot', price: 1 })
      expect(created.status).toBe(500)
      expect(fs.existsSync(path.join(dir, '22-wird-nichts.md'))).toBe(false)

      // Nothing left staged or modified, no commit.
      expect(git(writeRoot, 'status', '--porcelain')).toBe('')
      expect(commits()).toBe('1')
      const got = await request(app)
        .get('/api/hq-products/musterweck')
        .set(owner)
      expect(got.body.data).toMatchObject({
        price: 0.45,
        pendingApproval: false,
      })
    } finally {
      error.mockRestore()
    }
  })

  it('a write dir that is no git repo is 503 and nothing is written', async () => {
    const broken = tempDir('hq-broken-')
    fs.mkdirSync(path.join(broken, 'products'))
    fs.copyFileSync(
      path.join(readDir, '13-musterweck.md'),
      path.join(broken, 'products', '13-musterweck.md')
    )
    fs.mkdirSync(path.join(broken, '.git')) // not a valid repo, stops git walking up
    const before = read(path.join(broken, 'products'), '13-musterweck.md')
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const res = await request(appWith(readDir, broken))
        .put('/api/hq-products/musterweck')
        .set(owner)
        .send({ price: 0.99 })
      expect(res.status).toBe(503)
      expect(res.body.error).toBe('hq_write_unavailable')
      expect(res.body.message).toMatch(/git/)
      expect(read(path.join(broken, 'products'), '13-musterweck.md')).toBe(
        before
      )
    } finally {
      error.mockRestore()
    }
  })

  it('refuses to commit when the write worktree is not on app/edits (503)', async () => {
    git(writeRoot, 'checkout', '-q', '-b', 'main')
    const dir = path.join(writeRoot, 'products')
    const before = read(dir, '13-musterweck.md')
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const res = await request(app)
        .put('/api/hq-products/musterweck')
        .set(owner)
        .send({ price: 0.99 })
      expect(res.status).toBe(503)
      expect(res.body.error).toBe('hq_write_wrong_branch')
      expect(res.body.message).toContain('app/edits')
      expect(res.body.message).toContain('main')
      expect(read(dir, '13-musterweck.md')).toBe(before)
      expect(commits()).toBe('1')

      // Detached HEAD is refused as well.
      git(writeRoot, 'checkout', '-q', '--detach')
      const detached = await request(app)
        .post('/api/hq-products')
        .set(owner)
        .send({ name: 'Losgelöst', category: 'brot', price: 1 })
      expect(detached.status).toBe(503)
      expect(detached.body.error).toBe('hq_write_wrong_branch')
    } finally {
      error.mockRestore()
    }
  })

  it('a dirty file saved back to the committed state is a successful no-op', async () => {
    const dir = path.join(writeRoot, 'products')
    const committed = read(dir, '13-musterweck.md')
    // Someone left the worktree dirty (not via the app).
    fs.writeFileSync(
      path.join(dir, '13-musterweck.md'),
      committed.replace('price: 0.45\n', 'price: 0.7\n')
    )
    const res = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.45 })
    expect(res.status).toBe(200)
    expect(res.body.pending).toBe(false)
    expect(read(dir, '13-musterweck.md')).toBe(committed)
    expect(commits()).toBe('1')
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
  })

  it('a write dir without products/ is 503', async () => {
    const empty = appWith(readDir, tempDir('hq-empty-'))
    const res = await request(empty)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 1 })
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('hq_write_unavailable')
  })
})

describe('production without HQ_WRITE_DIR', () => {
  it('refuses writes with 503 instead of writing into the read clone', async () => {
    const dir = makeProductsDir()
    const before = read(dir, '13-musterweck.md')
    const app = appWith(dir, null, { production: true })
    await request(app).get('/api/products').set(seller).expect(200)
    const put = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.99 })
    expect(put.status).toBe(503)
    expect(put.body.error).toBe('hq_write_unavailable')
    expect(put.body.message).toMatch(/HQ_WRITE_DIR/)
    const post = await request(app)
      .post('/api/hq-products')
      .set(owner)
      .send({ name: 'Neu', category: 'brot', price: 1 })
    expect(post.status).toBe(503)
    expect(read(dir, '13-musterweck.md')).toBe(before)
    expect(fs.readdirSync(dir)).toHaveLength(SAMPLE_FILES.length)
  })
})

describe('names YAML would misread', () => {
  let readDir: string
  let writeRoot: string
  let app: Application
  beforeEach(() => {
    readDir = makeProductsDir()
    writeRoot = makeWriteRepo(readDir)
    app = appWith(readDir, writeRoot)
  })

  it.each([
    'Brot:',
    "'s Mustersemmel",
    '"Brot" mit Kruste',
    '? Brot',
    '0x1F',
    '1e3',
  ])(
    'POST and PUT with the name %j round-trip through the file',
    async (name) => {
      const created = await request(app)
        .post('/api/hq-products')
        .set(owner)
        .send({ name, category: 'brot', price: 1 })
      expect(created.status).toBe(201)
      const id = created.body.data.id
      const got = await request(app)
        .get(`/api/hq-products/${id}`)
        .set(owner)
        .expect(200)
      expect(got.body.data.name).toBe(name)
      const mgmt = await request(app).get('/api/hq-products').set(owner)
      expect(mgmt.body.data.map((p: { id: string }) => p.id)).toContain(id)

      const renamed = await request(app)
        .put('/api/hq-products/musterweck')
        .set(owner)
        .send({ name })
        .expect(200)
      expect(renamed.body.data.name).toBe(name)
      const again = await request(app)
        .get('/api/hq-products/musterweck')
        .set(owner)
        .expect(200)
      expect(again.body.data.name).toBe(name)
    }
  )

  it('refuses (400) a save that would not read back as written', async () => {
    // A frontmatter field the serializer cannot reproduce: YAML reads the
    // bare date as a Date, which would be written back as Date#toString().
    const dir = path.join(writeRoot, 'products')
    const file = path.join(dir, '13-musterweck.md')
    fs.writeFileSync(
      file,
      read(dir, '13-musterweck.md').replace(
        'seasonal: false\n',
        'seasonal: false\ngeprueft: 2026-01-01\n'
      )
    )
    git(writeRoot, 'commit', '-q', '-am', 'Datumsfeld')
    const before = read(dir, '13-musterweck.md')
    const res = await request(app)
      .put('/api/hq-products/musterweck')
      .set(owner)
      .send({ price: 0.5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_product_file')
    expect(res.body.message).toMatch(/Produktdatei/)
    expect(read(dir, '13-musterweck.md')).toBe(before)
    expect(git(writeRoot, 'rev-list', '--count', 'HEAD')).toBe('2')
  })
})
