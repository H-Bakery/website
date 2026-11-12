/**
 * `/api/recipes` against `createApp()`: roles (incl. the new
 * `backstubenleiter`), reading, and both write modes - directly into the
 * read dir (development) and committed into a git worktree (`HQ_WRITE_DIR`,
 * like the products). Synthetic recipes only (`tools/e2e/hq-recipes`).
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { AuditLog } from '../../src/models'
import type { RecipesOptions } from '../../src/services/recipes.service'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { git, removeTempDirs, tempDir } from '../helpers/hqProducts'
import {
  BACKZETTEL_REFERENCES,
  fixtureRecipes,
  makeRecipesHq,
  makeRecipesWriteRepo,
  readRecipe,
  RecipesHq,
} from '../helpers/hqRecipes'

jest.setTimeout(30000)

type Headers = Record<string, string>

const QUIET = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

let api: TestApp
let owner: Headers
let lead: Headers
let baker: Headers
let seller: Headers
let driver: Headers

/** Another app on the same database (sessions stay valid) with other hq dirs. */
function appWith(
  hq: RecipesHq,
  writeDir: string | null = null,
  extra: Partial<RecipesOptions> = {}
): Application {
  return createApp({
    logRequests: false,
    sequelize: api.sequelize,
    hq: { log: QUIET },
    hqProducts: { productsDir: path.join(hq.root, 'products'), writeDir },
    backzettel: { hqDir: hq.root },
    recipes: { recipesDir: hq.recipesDir, ...extra },
  })
}

/** What the edit form sends back: the editable fields of a GET plus the version. */
function formOf(recipe: Record<string, unknown>) {
  return {
    expectedVersion: recipe['version'],
    title: recipe['title'],
    category: recipe['category'],
    yield: recipe['yield'],
    description: recipe['description'],
    parts: recipe['parts'],
    steps: recipe['steps'],
    notes: recipe['notes'],
  }
}

const get = async (app: Application, id: string, as: Headers = owner) =>
  (await request(app).get(`/api/recipes/${id}`).set(as)).body.data

const NEW_RECIPE = {
  title: 'Testzopf süß',
  category: 'cakes',
  yield: '2 Zöpfe',
  parts: [
    {
      title: null,
      ingredients: [
        { name: 'Probemehl', amount: 1000, unit: 'g', note: null },
        { name: 'Testmilch', amount: 0.5, unit: 'l', note: null },
        { name: 'Salz', amount: null, unit: null, note: null },
      ],
    },
  ],
  steps: [{ title: null, ordered: true, items: ['Kneten', 'Flechten'] }],
  notes: 'Mit Hagelzucker bestreuen.',
}

beforeAll(async () => {
  api = await createTestApp()
  await createUser({
    username: 'test.inhaber',
    role: 'inhaber',
    displayName: 'Ines Test',
  })
  owner = bearer((await login(api.app, 'test.inhaber')).token)
  await createUser({
    username: 'test.leitung',
    role: 'backstubenleiter',
    displayName: 'Lars Testleitung',
  })
  lead = bearer((await login(api.app, 'test.leitung')).token)
  baker = bearer(await sessionFor(api.app, 'test.backstube', 'backstube'))
  seller = bearer(await sessionFor(api.app, 'test.verkauf', 'verkauf'))
  driver = bearer(await sessionFor(api.app, 'test.fahrer', 'fahrer'))
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

describe('sessions and roles', () => {
  let app: Application
  let hq: RecipesHq
  beforeAll(() => {
    hq = makeRecipesHq()
    app = appWith(hq)
  })

  const ENDPOINTS: [string, 'get' | 'post' | 'put' | 'delete', string][] = [
    ['list', 'get', '/api/recipes'],
    ['read', 'get', '/api/recipes/cakes/testkuchen'],
    ['create', 'post', '/api/recipes'],
    ['update', 'put', '/api/recipes/cakes/testkuchen'],
    ['delete', 'delete', '/api/recipes/cakes/testkuchen'],
  ]

  it.each(ENDPOINTS)('%s needs a session (401)', async (_name, method, url) => {
    const res = await request(app)[method](url).send({})
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({
      success: false,
      error: 'unauthorized',
      message: expect.any(String),
    })
  })

  it.each(ENDPOINTS)(
    '%s: verkauf and fahrer are refused (403)',
    async (_name, method, url) => {
      for (const as of [seller, driver]) {
        const res = await request(app)[method](url).set(as).send({})
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({
          error: 'forbidden',
          message: expect.any(String),
        })
      }
    }
  )

  it('backstube reads, but may not create, change or delete (403)', async () => {
    expect((await request(app).get('/api/recipes').set(baker)).status).toBe(200)
    const one = await request(app)
      .get('/api/recipes/cakes/testkuchen')
      .set(baker)
    expect(one.status).toBe(200)
    const before = readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    for (const res of [
      await request(app).post('/api/recipes').set(baker).send(NEW_RECIPE),
      await request(app)
        .put('/api/recipes/cakes/testkuchen')
        .set(baker)
        .send({ ...formOf(one.body.data), title: 'Anders' }),
      await request(app)
        .delete('/api/recipes/cakes/testkuchen')
        .set(baker)
        .send({ expectedVersion: one.body.data.version }),
    ]) {
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ error: 'forbidden' })
    }
    expect(readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')).toBe(before)
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'cakes/testzopf-suess.md'))
    ).toBe(false)
  })

  it.each([
    ['inhaber', () => owner],
    ['backstubenleiter', () => lead],
  ])('%s creates, changes and deletes', async (role, as) => {
    const own = makeRecipesHq()
    const mine = appWith(own)
    const created = await request(mine)
      .post('/api/recipes')
      .set(as())
      .send({ ...NEW_RECIPE, title: `Testzopf ${role}` })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    const changed = await request(mine)
      .put(`/api/recipes/${id}`)
      .set(as())
      .send({ ...formOf(created.body.data), yield: '3 Zöpfe' })
    expect(changed.status).toBe(200)
    const removed = await request(mine)
      .delete(`/api/recipes/${id}`)
      .set(as())
      .send({ expectedVersion: changed.body.data.version })
    expect(removed.status).toBe(200)
  })
})

describe('reading', () => {
  let app: Application
  let hq: RecipesHq
  beforeAll(() => {
    hq = makeRecipesHq({ backzettel: BACKZETTEL_REFERENCES })
    app = appWith(hq)
  })

  it('lists every recipe with categories, units and what may be done', async () => {
    const res = await request(app).get('/api/recipes').set(baker)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const data = res.body.data
    expect(data).toMatchObject({
      status: 'ok',
      count: fixtureRecipes().length,
      writable: true,
      writeIssue: null,
      canDelete: true,
      deleteIssue: null,
    })
    expect(data.units).toEqual(
      expect.arrayContaining(['g', 'kg', 'ml', 'l', 'Stück'])
    )
    expect(data.categories).toEqual([
      { id: 'breads', label: 'Brote', count: 2, writable: true },
      { id: 'rolls', label: 'Brötchen', count: 1, writable: true },
      { id: 'baguettes', label: 'Baguettes', count: 1, writable: true },
      { id: 'snacks', label: 'Snacks', count: 1, writable: true },
      { id: 'cakes', label: 'Kuchen', count: 2, writable: true },
      { id: 'fillings', label: 'Füllungen', count: 2, writable: true },
      { id: 'special', label: 'Spezialprodukte', count: 1, writable: true },
      { id: 'teige', label: 'Teige (Backzettel)', count: 2, writable: false },
    ])
    expect(data.recipes.map((r: { id: string }) => r.id)).toEqual([
      'breads/musterkruste',
      'breads/probelaib',
      'rolls/muesli-wecken',
      'baguettes/musterstange',
      'snacks/testknoten',
      'cakes/musterschnitte',
      'cakes/testkuchen',
      // innerhalb der Kategorie nach Titel („Testfüllungen …" vor „Testkompott")
      'fillings/gefuellte-testkraenze',
      'fillings/testkompott',
      'special/probe-duennbrot',
      'teige/musterteig-koerner',
      'teige/musterteig',
    ])
    expect(data.recipes[0]).toEqual({
      id: 'breads/musterkruste',
      category: 'breads',
      categoryLabel: 'Brote',
      slug: 'musterkruste',
      file: 'Musterkruste.md',
      path: 'data/recipes/breads/Musterkruste.md',
      format: 'standard',
      title: 'Musterkruste',
      yield: '3 Laibe à 700g',
      ingredientCount: 13,
      editable: true,
      readOnlyReason: null,
      pendingApproval: false,
      pending: null,
      usedByBackzettel: [],
    })
    // offen ist null, nie 0 oder ein Beispielwert
    expect(
      data.recipes.find((r: { id: string }) => r.id === 'fillings/testkompott')
    ).toMatchObject({ yield: null })
  })

  it('filters by ?category= and searches with ?q=', async () => {
    const cakes = await request(app)
      .get('/api/recipes?category=cakes')
      .set(owner)
    expect(
      cakes.body.data.recipes.map((r: { slug: string }) => r.slug)
    ).toEqual(['musterschnitte', 'testkuchen'])
    // die Zähler der Kategorien bleiben die Gesamtzahlen
    expect(cakes.body.data.categories[0].count).toBe(2)
    const search = await request(app)
      .get(`/api/recipes?q=${encodeURIComponent('probequark')}`)
      .set(owner)
    expect(search.body.data.recipes.map((r: { id: string }) => r.id)).toEqual([
      'cakes/testkuchen',
      'fillings/gefuellte-testkraenze',
    ])
    const both = await request(app)
      .get(
        `/api/recipes?category=fillings&q=${encodeURIComponent('TESTNÜSSE')}`
      )
      .set(owner)
    expect(both.body.data.count).toBe(1)
    for (const url of [
      '/api/recipes?category=gibt-es-nicht',
      '/api/recipes?category=cakes&category=breads',
      '/api/recipes?q=xyzzy',
    ]) {
      const none = await request(app).get(url).set(owner)
      expect(none.body.data).toMatchObject({
        status: 'ok',
        count: 0,
        recipes: [],
      })
    }
  })

  it('returns one recipe with everything the screens need', async () => {
    const res = await request(app)
      .get('/api/recipes/special/probe-duennbrot')
      .set(lead)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      id: 'special/probe-duennbrot',
      category: 'special',
      categoryLabel: 'Spezialprodukte',
      slug: 'probe-duennbrot',
      file: 'Probe-Dünnbrot',
      path: 'data/recipes/special/Probe-Dünnbrot',
      format: 'table',
      title: 'Probe-Dünnbrot',
      yield: 'Ergibt ca. 16 Fladen à 110 g',
      ingredientCount: 5,
      editable: true,
      readOnlyReason: null,
      pendingApproval: false,
      pending: null,
      usedByBackzettel: [],
      description: null,
      parts: [
        {
          title: null,
          ingredients: [
            { name: 'Wasser', amount: 640, unit: 'g', note: null },
            { name: 'Probemehl', amount: 1000, unit: 'g', note: null },
            { name: 'Testöl', amount: 45, unit: 'g', note: null },
            { name: 'Salz', amount: 22, unit: 'g', note: null },
            { name: 'Testhefe', amount: 28, unit: 'g', note: null },
          ],
          total: { label: 'Gesamtmasse', text: '1.735 g' },
        },
      ],
      steps: [
        {
          title: null,
          ordered: false,
          items: [
            'Kneten: 6 Min langsam + 3 Min schnell',
            'Backen: 260 °C, ohne Schwaden, 7–9 Minuten',
          ],
        },
      ],
      notes: '- **Hinweis**: Vor dem Backen mit Testöl bestreichen',
      meta: [],
      sections: [],
      version: expect.stringMatching(/^[0-9a-f]{24}$/),
      deletable: true,
      deleteBlockedReason: null,
    })
  })

  it('says which recipes the Backzettel uses', async () => {
    const used = await get(app, 'fillings/gefuellte-testkraenze')
    expect(used.usedByBackzettel).toEqual([
      {
        kind: 'filling',
        id: 'nuss',
        name: 'Testnussfüllung',
        section: 'Testnussfüllung',
      },
      {
        kind: 'filling',
        id: 'probeschoko',
        name: 'Probeschokofüllung',
        section: null,
      },
    ])
    expect(used).toMatchObject({ editable: true, deletable: false })
    expect(used.deleteBlockedReason).toMatch(
      /Backzettel verwendet dieses Rezept/
    )
    const list = await request(app)
      .get('/api/recipes?category=fillings')
      .set(owner)
    expect(
      list.body.data.recipes.map(
        (r: { usedByBackzettel: unknown[] }) => r.usedByBackzettel.length
      )
    ).toEqual([2, 0])
  })

  it('serves teig recipes read-only with the reason', async () => {
    const teig = await get(app, 'teige/musterteig', baker)
    expect(teig).toMatchObject({
      format: 'teig',
      title: 'Musterteig',
      yield: 'je 1 L Schüttwasser',
      editable: false,
      deletable: false,
    })
    expect(teig.readOnlyReason).toMatch(/Rechengrundlage des Backzettels/)
    expect(teig.parts[0].ingredients).toHaveLength(5)
  })

  it('404 with message for what is not a recipe - also for path tricks', async () => {
    for (const url of [
      '/api/recipes/cakes/gibt-es-nicht',
      '/api/recipes/gibt-es-nicht/testkuchen',
      '/api/recipes/cakes/Testkuchen.md',
      '/api/recipes/cakes/..%2F..%2F..%2Fconfig%2Fbackzettel.yaml',
      '/api/recipes/..%2F..%2Fconfig/backzettel.yaml',
      '/api/recipes/%2e%2e/%2e%2e',
      '/api/recipes/cakes/testkuchen%00',
      '/api/recipes/cakes',
    ]) {
      const res = await request(app).get(url).set(owner)
      expect([url, res.status]).toEqual([url, 404])
      expect(res.body).toMatchObject({
        success: false,
        error: 'not_found',
        message: expect.any(String),
      })
    }
  })

  it('ignores what is not a recipe file: hidden files, other types, links, nested dirs', async () => {
    const own = makeRecipesHq()
    const dir = own.recipesDir
    fs.writeFileSync(path.join(dir, 'cakes', '.versteckt.md'), '# Nein\n')
    fs.writeFileSync(path.join(dir, 'cakes', '_vorlage.md'), '# Nein\n')
    fs.writeFileSync(path.join(dir, 'cakes', 'README.md'), '# Nein\n')
    fs.writeFileSync(path.join(dir, 'cakes', 'tabelle.xlsx'), 'PK')
    fs.mkdirSync(path.join(dir, 'cakes', 'unterordner'))
    fs.writeFileSync(
      path.join(dir, 'cakes', 'unterordner', 'tief.md'),
      '# Nein\n'
    )
    fs.mkdirSync(path.join(dir, 'Mit Leerzeichen'))
    fs.writeFileSync(path.join(dir, 'Mit Leerzeichen', 'x.md'), '# Nein\n')
    const outside = path.join(tempDir('hq-outside-'), 'geheim.md')
    fs.writeFileSync(outside, '# Geheim\n')
    fs.symlinkSync(outside, path.join(dir, 'cakes', 'link.md'))
    const res = await request(appWith(own))
      .get('/api/recipes?category=cakes')
      .set(owner)
    expect(res.body.data.recipes.map((r: { slug: string }) => r.slug)).toEqual([
      'musterschnitte',
      'testkuchen',
    ])
    expect(
      res.body.data.categories.map((c: { id: string }) => c.id)
    ).not.toContain('Mit Leerzeichen')
  })

  it('a file the parser does not understand is read-only with a German reason', async () => {
    const own = makeRecipesHq()
    fs.writeFileSync(
      path.join(own.recipesDir, 'cakes', 'Freitext.md'),
      '---\ntitle: Freitext\n---\n\n## Zutaten\n- [ ] 1 g Salz\nNach Gefühl würzen.\n'
    )
    const mine = appWith(own)
    const recipe = await get(mine, 'cakes/freitext')
    expect(recipe).toMatchObject({ title: 'Freitext', editable: false })
    expect(recipe.readOnlyReason).toMatch(/nur in hq bearbeiten \(Zeile 7/)
    const before = readRecipe(own.recipesDir, 'cakes/Freitext.md')
    const res = await request(mine)
      .put('/api/recipes/cakes/freitext')
      .set(owner)
      .send({ ...formOf(recipe), title: 'Anders' })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'recipe_read_only',
      message: expect.stringMatching(/nur in hq bearbeiten/),
    })
    expect(readRecipe(own.recipesDir, 'cakes/Freitext.md')).toBe(before)
  })

  it('without the recipes directory: status no-data, never samples', async () => {
    const empty = tempDir('hq-empty-')
    const mine = createApp({
      logRequests: false,
      sequelize: api.sequelize,
      hq: { log: QUIET },
      backzettel: { hqDir: empty },
      recipes: { recipesDir: path.join(empty, 'data', 'recipes') },
    })
    const res = await request(mine).get('/api/recipes').set(owner)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      status: 'no-data',
      message: expect.stringMatching(/Rezeptverzeichnis/),
      recipes: [],
      categories: [],
      count: 0,
      writable: false,
      writeIssue: { error: 'hq_unavailable' },
    })
    expect(
      (await request(mine).get('/api/recipes/cakes/testkuchen').set(owner))
        .status
    ).toBe(404)
    const write = await request(mine)
      .post('/api/recipes')
      .set(owner)
      .send(NEW_RECIPE)
    expect(write.status).toBe(503)
    expect(write.body).toMatchObject({
      error: 'hq_unavailable',
      message: expect.any(String),
    })
    expect(fs.existsSync(path.join(empty, 'data'))).toBe(false)
  })
})

describe('writing without HQ_WRITE_DIR (development)', () => {
  let app: Application
  let hq: RecipesHq
  beforeEach(() => {
    hq = makeRecipesHq({ backzettel: BACKZETTEL_REFERENCES })
    app = appWith(hq)
  })

  const auditRows = () =>
    AuditLog.findAll({ where: { entity: 'recipe' }, order: [['id', 'ASC']] })

  it('saving the unchanged form leaves every fixture file byte-identical', async () => {
    const list = (await request(app).get('/api/recipes').set(owner)).body.data
      .recipes
    const auditBefore = (await auditRows()).length
    let saved = 0
    for (const summary of list) {
      const recipe = await get(app, summary.id)
      const before = readRecipe(
        hq.recipesDir,
        `${recipe.category}/${recipe.file}`
      )
      const stat = fs.statSync(
        path.join(hq.recipesDir, recipe.category, recipe.file)
      )
      const res = await request(app)
        .put(`/api/recipes/${recipe.id}`)
        .set(lead)
        .send(formOf(recipe))
      if (!recipe.editable) {
        expect(res.status).toBe(409)
      } else {
        expect([recipe.id, res.status]).toEqual([recipe.id, 200])
        expect(res.body).toMatchObject({
          success: true,
          changed: false,
          pending: false,
        })
        expect(res.body.data.version).toBe(recipe.version)
        saved++
      }
      expect(
        readRecipe(hq.recipesDir, `${recipe.category}/${recipe.file}`)
      ).toBe(before)
      // nicht einmal neu geschrieben
      expect(
        fs.statSync(path.join(hq.recipesDir, recipe.category, recipe.file))
          .mtimeMs
      ).toBe(stat.mtimeMs)
    }
    expect(saved).toBe(fixtureRecipes().length - 2)
    expect((await auditRows()).length).toBe(auditBefore)
  })

  it('creates a recipe as <category>/<slug>.md and serves it at once', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send(NEW_RECIPE)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      success: true,
      pending: false,
      changed: true,
    })
    expect(res.body.data).toMatchObject({
      id: 'cakes/testzopf-suess',
      file: 'testzopf-suess.md',
      path: 'data/recipes/cakes/testzopf-suess.md',
      format: 'standard',
      title: 'Testzopf süß',
      yield: '2 Zöpfe',
      editable: true,
      pending: null,
    })
    expect(readRecipe(hq.recipesDir, 'cakes/testzopf-suess.md')).toBe(
      [
        '---',
        'title: Testzopf süß',
        'category: cake',
        'yield: 2 Zöpfe',
        '---',
        '',
        '# Testzopf süß',
        '',
        '## Zutaten',
        '- [ ] 1000 g Probemehl',
        '- [ ] 0,5 l Testmilch',
        '- [ ] Salz',
        '',
        '## Zubereitung',
        '1. Kneten',
        '2. Flechten',
        '',
        '## Notizen',
        'Mit Hagelzucker bestreuen.',
        '',
      ].join('\n')
    )
    // Salz ohne Menge bleibt offen
    expect(res.body.data.parts[0].ingredients[2]).toEqual({
      name: 'Salz',
      amount: null,
      unit: null,
      note: null,
    })
    expect(await get(app, 'cakes/testzopf-suess', baker)).toEqual(res.body.data)
    const audit = (await auditRows()).pop()
    expect(audit).toMatchObject({
      action: 'create',
      entity: 'recipe',
      entityId: 'cakes/testzopf-suess',
    })
    expect(audit?.data).toMatchObject({
      path: 'data/recipes/cakes/testzopf-suess.md',
    })
  })

  it('refuses a second recipe of the same name, odd names and odd categories', async () => {
    expect(
      (await request(app).post('/api/recipes').set(owner).send(NEW_RECIPE))
        .status
    ).toBe(201)
    const twice = await request(app)
      .post('/api/recipes')
      .set(owner)
      .send(NEW_RECIPE)
    expect(twice.status).toBe(409)
    expect(twice.body).toMatchObject({
      error: 'recipe_exists',
      message: expect.any(String),
    })
    // derselbe Dateiname wie ein vorhandenes Rezept (Testkuchen.md)
    const clash = await request(app)
      .post('/api/recipes')
      .set(owner)
      .send({ title: 'testkuchen', category: 'cakes' })
    expect(clash.status).toBe(409)

    for (const [body, error] of [
      [{ ...NEW_RECIPE, title: '🍞🍞' }, 'invalid_id'],
      [{ ...NEW_RECIPE, title: 'README' }, 'invalid_id'],
      [{ ...NEW_RECIPE, title: '' }, 'validation'],
      [{ ...NEW_RECIPE, category: 'teige' }, 'invalid_category'],
      [{ ...NEW_RECIPE, category: '../../products' }, 'invalid_category'],
      [{ ...NEW_RECIPE, category: 'gibt-es-nicht' }, 'invalid_category'],
      [{ ...NEW_RECIPE, category: undefined }, 'invalid_category'],
      [{ ...NEW_RECIPE, category: ['cakes'] }, 'invalid_category'],
      [
        {
          ...NEW_RECIPE,
          parts: [{ ingredients: [{ name: 'Mehl', amount: 0 }] }],
        },
        'validation',
      ],
      [{ ...NEW_RECIPE, notes: '# Überschrift' }, 'validation'],
    ] as [Record<string, unknown>, string][]) {
      const res = await request(app).post('/api/recipes').set(owner).send(body)
      expect([error, res.status]).toEqual([error, 400])
      expect(res.body).toMatchObject({
        success: false,
        error,
        message: expect.any(String),
      })
    }
    // ein Name voller Pfadzeichen wird ein harmloser Dateiname in der Kategorie
    const tricky = await request(app)
      .post('/api/recipes')
      .set(owner)
      .send({ title: '../../config/backzettel', category: 'cakes' })
    expect(tricky.status).toBe(201)
    expect(tricky.body.data.path).toBe(
      'data/recipes/cakes/config-backzettel.md'
    )
    expect(fs.readdirSync(hq.root).sort()).toEqual(['config', 'data'])
    expect(fs.readdirSync(path.join(hq.root, 'config'))).toEqual([
      'backzettel.yaml',
    ])
  })

  it('never writes through a category directory that is a link out of hq', async () => {
    const outside = tempDir('hq-outside-')
    fs.rmSync(path.join(hq.recipesDir, 'snacks'), { recursive: true })
    fs.symlinkSync(outside, path.join(hq.recipesDir, 'snacks'))
    const created = await request(app)
      .post('/api/recipes')
      .set(owner)
      .send({ ...NEW_RECIPE, category: 'snacks' })
    expect(created.status).toBe(400)
    expect(created.body).toMatchObject({ error: 'invalid_category' })
    const recipe = await get(app, 'cakes/testkuchen')
    const moved = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ ...formOf(recipe), category: 'snacks' })
    expect(moved.status).toBe(400)
    expect(fs.readdirSync(outside)).toEqual([])
    expect(fs.existsSync(path.join(hq.recipesDir, 'cakes/Testkuchen.md'))).toBe(
      true
    )
  })

  it('an edit changes only its lines and returns the new version', async () => {
    const recipe = await get(app, 'breads/musterkruste')
    const before = readRecipe(hq.recipesDir, 'breads/Musterkruste.md')
    const form = formOf(recipe)
    const parts = JSON.parse(JSON.stringify(recipe.parts))
    parts[1].ingredients[4].amount = 19
    const res = await request(app)
      .put('/api/recipes/breads/musterkruste')
      .set(lead)
      .send({ ...form, parts })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ changed: true, pending: false })
    expect(res.body.data.version).not.toBe(recipe.version)
    const after = readRecipe(hq.recipesDir, 'breads/Musterkruste.md')
    const a = before.split('\n')
    const b = after.split('\n')
    expect(b).toHaveLength(a.length)
    expect(a.filter((line, i) => line !== b[i])).toEqual(['- [ ] 23 g Salz'])
    expect(b.filter((line, i) => line !== a[i])).toEqual(['- [ ] 19 g Salz'])
    const audit = (await auditRows()).pop()
    expect(audit).toMatchObject({
      action: 'update',
      entityId: 'breads/musterkruste',
    })
  })

  it('detects a stale version: 409 and nothing written', async () => {
    const recipe = await get(app, 'cakes/testkuchen')
    const first = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(lead)
      .send({ ...formOf(recipe), yield: 'für 4 Bleche' })
    expect(first.status).toBe(200)
    const saved = readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    // der zweite Bearbeiter hat noch den alten Stand offen
    const second = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ ...formOf(recipe), notes: 'Zu spät' })
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({
      error: 'stale_recipe',
      message: expect.stringMatching(/inzwischen geändert/),
      currentVersion: first.body.data.version,
    })
    const missing = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ notes: 'Ohne Stand' })
    expect(missing.status).toBe(400)
    expect(missing.body).toMatchObject({ error: 'version_required' })
    const gone = await request(app)
      .delete('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ expectedVersion: recipe.version })
    expect(gone.status).toBe(409)
    expect(gone.body).toMatchObject({ error: 'stale_recipe' })
    expect(readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')).toBe(saved)
    // eine Datei, die jemand in hq geändert hat, zählt genauso
    fs.appendFileSync(path.join(hq.recipesDir, 'cakes/Testkuchen.md'), '\n')
    const outside = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ ...formOf(first.body.data), notes: 'Auch zu spät' })
    expect(outside.status).toBe(409)
  })

  it('rejects invalid input with 400 + German message and does not write', async () => {
    const recipe = await get(app, 'cakes/testkuchen')
    const before = readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    for (const [change, error] of [
      [{ title: '' }, 'validation'],
      [
        {
          parts: [
            {
              title: null,
              ingredients: [{ name: 'A', amount: 1, unit: 'Eimer' }],
            },
          ],
        },
        'validation',
      ],
      [
        {
          parts: [{ title: null, ingredients: [{ name: 'A | B', amount: 1 }] }],
        },
        'validation',
      ],
      [
        {
          // ein Hinweis, der als Menge gelesen würde
          parts: [
            {
              title: null,
              ingredients: [{ name: 'A', amount: null, note: '5 g' }],
            },
          ],
        },
        'validation',
      ],
      [{ title: 'Kuchen (hell)', yield: null }, 'invalid_recipe_file'],
      [{ category: 'teige' }, 'invalid_category'],
      [{ category: '../breads' }, 'invalid_category'],
    ] as [Record<string, unknown>, string][]) {
      const res = await request(app)
        .put('/api/recipes/cakes/testkuchen')
        .set(owner)
        .send({ ...formOf(recipe), ...change })
      expect([error, res.status]).toEqual([error, 400])
      expect(res.body).toMatchObject({
        success: false,
        error,
        message: expect.any(String),
      })
    }
    expect(readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')).toBe(before)
    const unknown = await request(app)
      .put('/api/recipes/cakes/gibt-es-nicht')
      .set(owner)
      .send(formOf(recipe))
    expect(unknown.status).toBe(404)
  })

  it('never turns the start of a name into an amount (400, nothing written)', async () => {
    const names = ['1050 Testmehl', '1 Prise Salz', '2 Eier']
    for (const name of names) {
      const created = await request(app)
        .post('/api/recipes')
        .set(lead)
        .send({
          title: 'Zahlentest',
          category: 'breads',
          parts: [{ title: null, ingredients: [{ name, amount: null }] }],
        })
      expect(created.status).toBe(400)
      expect(created.body).toMatchObject({
        success: false,
        error: 'validation',
        message: expect.stringMatching(/beginnt mit einer Zahl.*„Menge“/),
      })
    }
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'breads/zahlentest.md'))
    ).toBe(false)

    // eine Zahl, die zum Namen gehört, bleibt Name - Menge offen
    const ok = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send({
        title: 'Zahlentest',
        category: 'breads',
        parts: [
          {
            title: null,
            ingredients: [
              { name: '405er Testmehl', amount: null },
              { name: '5-Korn-Probemischung', amount: null },
            ],
          },
        ],
      })
    expect(ok.status).toBe(201)
    expect(ok.body.data.parts[0].ingredients).toEqual([
      { name: '405er Testmehl', amount: null, unit: null, note: null },
      { name: '5-Korn-Probemischung', amount: null, unit: null, note: null },
    ])
    expect(readRecipe(hq.recipesDir, 'breads/zahlentest.md')).toContain(
      '- [ ] 405er Testmehl\n- [ ] 5-Korn-Probemischung\n'
    )

    // dasselbe beim Ändern eines Rezepts im Listenformat
    const recipe = await get(app, 'breads/probelaib')
    const before = readRecipe(hq.recipesDir, 'breads/Probelaib.md')
    const parts = JSON.parse(JSON.stringify(recipe.parts))
    parts[0].ingredients.push({ name: '1050 Testmehl', amount: null })
    const put = await request(app)
      .put('/api/recipes/breads/probelaib')
      .set(lead)
      .send({ ...formOf(recipe), parts })
    expect(put.status).toBe(400)
    expect(put.body).toMatchObject({ error: 'validation' })
    // ein Hinweis hat im Listenformat kein eigenes Feld
    const noted = JSON.parse(JSON.stringify(recipe.parts))
    noted[0].ingredients.push({
      name: 'Zimt',
      amount: 2,
      unit: 'g',
      note: 'gemahlen',
    })
    const note = await request(app)
      .put('/api/recipes/breads/probelaib')
      .set(lead)
      .send({ ...formOf(recipe), parts: noted })
    expect(note.status).toBe(400)
    expect(note.body).toMatchObject({
      error: 'validation',
      message: expect.stringMatching(/keinen eigenen Hinweis/),
    })
    expect(readRecipe(hq.recipesDir, 'breads/Probelaib.md')).toBe(before)
  })

  it('renaming a part keeps its table, sum row and every other line', async () => {
    const recipe = await get(app, 'special/probe-duennbrot')
    const before = readRecipe(hq.recipesDir, 'special/Probe-Dünnbrot')
    expect(recipe.parts[0]).toMatchObject({
      title: null,
      total: { label: 'Gesamtmasse' },
    })
    const parts = JSON.parse(JSON.stringify(recipe.parts))
    parts[0].title = 'Teig'
    const res = await request(app)
      .put('/api/recipes/special/probe-duennbrot')
      .set(lead)
      .send({ ...formOf(recipe), parts })
    expect(res.status).toBe(200)
    expect(res.body.data.parts[0]).toMatchObject({
      title: 'Teig',
      total: recipe.parts[0].total,
    })
    const after = readRecipe(hq.recipesDir, 'special/Probe-Dünnbrot')
    const a = before.split('\n')
    const b = after.split('\n')
    expect(b).toHaveLength(a.length)
    expect(b.filter((line, i) => line !== a[i])).toEqual(['### Teig:'])
  })

  it('teig recipes cannot be changed or deleted', async () => {
    const teig = await get(app, 'teige/musterteig')
    const before = readRecipe(hq.recipesDir, 'teige/musterteig.md')
    const put = await request(app)
      .put('/api/recipes/teige/musterteig')
      .set(owner)
      .send({ ...formOf(teig), title: 'Anders' })
    expect(put.status).toBe(409)
    expect(put.body).toMatchObject({ error: 'recipe_read_only' })
    const del = await request(app)
      .delete('/api/recipes/teige/musterteig')
      .set(owner)
      .send({ expectedVersion: teig.version })
    expect(del.status).toBe(409)
    expect(del.body).toMatchObject({ error: 'recipe_read_only' })
    expect(readRecipe(hq.recipesDir, 'teige/musterteig.md')).toBe(before)
  })

  it('deletes a recipe (version as body or query) and audits it', async () => {
    const recipe = await get(app, 'cakes/musterschnitte')
    const noVersion = await request(app)
      .delete('/api/recipes/cakes/musterschnitte')
      .set(lead)
    expect(noVersion.status).toBe(400)
    expect(noVersion.body).toMatchObject({ error: 'version_required' })
    const res = await request(app)
      .delete(
        `/api/recipes/cakes/musterschnitte?expectedVersion=${recipe.version}`
      )
      .set(lead)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { id: 'cakes/musterschnitte', deleted: true },
      pending: false,
      changed: true,
    })
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'cakes/Musterschnitte.md'))
    ).toBe(false)
    expect(
      (await request(app).get('/api/recipes/cakes/musterschnitte').set(owner))
        .status
    ).toBe(404)
    const again = await request(app)
      .delete(
        `/api/recipes/cakes/musterschnitte?expectedVersion=${recipe.version}`
      )
      .set(lead)
    expect(again.status).toBe(404)
    const audit = (await auditRows()).pop()
    expect(audit).toMatchObject({
      action: 'delete',
      entityId: 'cakes/musterschnitte',
    })
  })

  it('moves a recipe when the category changes', async () => {
    const recipe = await get(app, 'breads/probelaib')
    const res = await request(app)
      .put('/api/recipes/breads/probelaib')
      .set(lead)
      .send({ ...formOf(recipe), category: 'rolls' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: 'rolls/probelaib',
      category: 'rolls',
      path: 'data/recipes/rolls/Probelaib.md',
    })
    expect(fs.existsSync(path.join(hq.recipesDir, 'breads/Probelaib.md'))).toBe(
      false
    )
    expect(readRecipe(hq.recipesDir, 'rolls/Probelaib.md')).toContain(
      '\ncategory: roll\n'
    )
    // wo es den Namen schon gibt, wird nicht überschrieben
    const back = await request(app)
      .put('/api/recipes/rolls/probelaib')
      .set(lead)
      .send({ ...formOf(res.body.data), category: 'breads' })
    expect(back.status).toBe(200)
    fs.copyFileSync(
      path.join(hq.recipesDir, 'breads/Probelaib.md'),
      path.join(hq.recipesDir, 'rolls/probelaib.md')
    )
    const clash = await request(app)
      .put('/api/recipes/breads/probelaib')
      .set(lead)
      .send({ ...formOf(back.body.data), category: 'rolls' })
    expect(clash.status).toBe(409)
    expect(clash.body).toMatchObject({ error: 'recipe_exists' })
  })

  describe('a recipe the Backzettel uses', () => {
    const ID = 'fillings/gefuellte-testkraenze'
    const FILE = 'fillings/Gefüllte-Testkränze.md'

    it('can be edited', async () => {
      const recipe = await get(app, ID)
      const parts = JSON.parse(JSON.stringify(recipe.parts))
      parts[0].ingredients[1].amount = 475
      parts.push({
        title: 'Testmohnfüllung',
        ingredients: [{ name: 'Probemohn', amount: 1, unit: 'kg' }],
      })
      const res = await request(app)
        .put(`/api/recipes/${ID}`)
        .set(lead)
        .send({ ...formOf(recipe), parts })
      expect(res.status).toBe(200)
      expect(res.body.data.usedByBackzettel).toHaveLength(2)
      expect(readRecipe(hq.recipesDir, FILE)).toContain('| Wasser | 475 ml |')
    })

    it('cannot be deleted or moved (409)', async () => {
      const recipe = await get(app, ID)
      const before = readRecipe(hq.recipesDir, FILE)
      const del = await request(app)
        .delete(`/api/recipes/${ID}`)
        .set(owner)
        .send({ expectedVersion: recipe.version })
      expect(del.status).toBe(409)
      expect(del.body).toMatchObject({
        success: false,
        error: 'recipe_in_use',
        message: expect.stringMatching(
          /Backzettel verwendet dieses Rezept \(Testnussfüllung/
        ),
      })
      expect(del.body.usedByBackzettel).toHaveLength(2)
      const move = await request(app)
        .put(`/api/recipes/${ID}`)
        .set(owner)
        .send({ ...formOf(recipe), category: 'cakes' })
      expect(move.status).toBe(409)
      expect(move.body).toMatchObject({ error: 'recipe_in_use' })
      expect(readRecipe(hq.recipesDir, FILE)).toBe(before)
      expect(
        fs.existsSync(path.join(hq.recipesDir, 'cakes/Gefüllte-Testkränze.md'))
      ).toBe(false)
    })

    it('the parts the Backzettel reads cannot be renamed away or removed (409)', async () => {
      const recipe = await get(app, ID)
      const before = readRecipe(hq.recipesDir, FILE)
      const renamed = JSON.parse(JSON.stringify(recipe.parts))
      renamed[0].title = 'Haselnussfüllung'
      const res = await request(app)
        .put(`/api/recipes/${ID}`)
        .set(lead)
        .send({ ...formOf(recipe), parts: renamed })
      expect(res.status).toBe(409)
      expect(res.body).toMatchObject({
        error: 'recipe_section_in_use',
        message: expect.stringMatching(/Teil „Testnussfüllung“/),
      })
      // der zweite Verweis läuft über die id (probeschoko → Probeschokofüllung)
      const removed = JSON.parse(JSON.stringify(recipe.parts))
      removed.splice(1, 1)
      const gone = await request(app)
        .put(`/api/recipes/${ID}`)
        .set(lead)
        .send({ ...formOf(recipe), parts: removed })
      expect(gone.status).toBe(409)
      expect(gone.body).toMatchObject({ error: 'recipe_section_in_use' })
      expect(readRecipe(hq.recipesDir, FILE)).toBe(before)
      // der dritte Teil ist frei
      const free = JSON.parse(JSON.stringify(recipe.parts))
      free[2].title = 'Testquarkfüllung'
      const ok = await request(app)
        .put(`/api/recipes/${ID}`)
        .set(lead)
        .send({ ...formOf(recipe), parts: free })
      expect(ok.status).toBe(200)
    })

    it('a new part cannot take the place of the one the Backzettel reads (409)', async () => {
      const recipe = await get(app, ID)
      const before = readRecipe(hq.recipesDir, FILE)
      const extra = (title: string) => ({
        title,
        ingredients: [{ name: 'Testwasser', amount: 5, unit: 'g' }],
      })
      const put = (parts: unknown[]) =>
        request(app)
          .put(`/api/recipes/${ID}`)
          .set(lead)
          .send({ ...formOf(recipe), parts })

      // derselbe Name noch einmal, davor: der Verweis über `section` fände den neuen
      const twice = await put([extra('Testnussfüllung'), ...recipe.parts])
      expect(twice.status).toBe(409)
      expect(twice.body).toMatchObject({
        error: 'recipe_section_in_use',
        message: expect.stringMatching(/„Testnussfüllung“.*nur einmal/),
      })
      // auch dahinter bleibt der Name einmalig
      expect(
        (await put([...recipe.parts, extra('Testnussfüllung')])).status
      ).toBe(409)
      // gleicher Anfang, davor: der Verweis über die id (probeschoko) fände den neuen
      const light = await put([
        recipe.parts[0],
        extra('Probeschoko Light'),
        ...recipe.parts.slice(1),
      ])
      expect(light.status).toBe(409)
      expect(light.body).toMatchObject({
        error: 'recipe_section_in_use',
        message: expect.stringMatching(
          /„Probeschokofüllung“.*stattdessen „Probeschoko Light“/
        ),
      })
      expect(light.body.usedByBackzettel).toHaveLength(2)
      expect(readRecipe(hq.recipesDir, FILE)).toBe(before)

      // dahinter eingeordnet liest der Backzettel weiter denselben Teil
      const behind = await put([...recipe.parts, extra('Probeschoko Light')])
      expect(behind.status).toBe(200)
      expect(readRecipe(hq.recipesDir, FILE)).toContain('### Probeschoko Light')
    })

    it('unreadable Backzettel master data lock delete, move and part names instead of unlocking them', async () => {
      const recipe = await get(app, ID)
      const before = readRecipe(hq.recipesDir, FILE)
      // eine Handänderung in hq, die das YAML bricht
      fs.appendFileSync(hq.configPath, 'fillings: [unclosed\n  - : :\n')
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      try {
        const broken = await get(app, ID)
        expect(broken).toMatchObject({
          deletable: false,
          deleteBlockedReason: expect.stringMatching(
            /Stammdaten des Backzettels .* nicht lesen/
          ),
        })
        const del = await request(app)
          .delete(`/api/recipes/${ID}`)
          .set(lead)
          .send({ expectedVersion: recipe.version })
        expect(del.status).toBe(409)
        expect(del.body).toMatchObject({
          success: false,
          error: 'backzettel_config_unreadable',
          message: expect.stringMatching(/nicht lesen/),
        })
        const move = await request(app)
          .put(`/api/recipes/${ID}`)
          .set(owner)
          .send({ ...formOf(recipe), category: 'cakes' })
        expect(move.status).toBe(409)
        expect(move.body).toMatchObject({
          error: 'backzettel_config_unreadable',
        })
        const renamed = JSON.parse(JSON.stringify(recipe.parts))
        renamed[0].title = 'Haselnussfüllung'
        const rename = await request(app)
          .put(`/api/recipes/${ID}`)
          .set(lead)
          .send({ ...formOf(recipe), parts: renamed })
        expect(rename.status).toBe(409)
        expect(rename.body).toMatchObject({
          error: 'backzettel_config_unreadable',
        })
        expect(readRecipe(hq.recipesDir, FILE)).toBe(before)
        // auch ein Rezept, auf das (soweit bekannt) nichts zeigt
        const other = await get(app, 'cakes/testkuchen')
        expect(other.deletable).toBe(false)
        const otherDel = await request(app)
          .delete('/api/recipes/cakes/testkuchen')
          .set(owner)
          .send({ expectedVersion: other.version })
        expect(otherDel.status).toBe(409)
        expect(
          fs.existsSync(path.join(hq.recipesDir, 'cakes/Testkuchen.md'))
        ).toBe(true)

        // Mengen ändern geht weiter
        const parts = JSON.parse(JSON.stringify(recipe.parts))
        parts[0].ingredients[1].amount = 480
        const edit = await request(app)
          .put(`/api/recipes/${ID}`)
          .set(lead)
          .send({ ...formOf(recipe), parts })
        expect(edit.status).toBe(200)
      } finally {
        error.mockRestore()
      }

      // repariert: wieder der genaue Grund
      fs.writeFileSync(hq.configPath, BACKZETTEL_REFERENCES)
      const again = await get(app, ID)
      expect(again.usedByBackzettel).toHaveLength(2)
      const del = await request(app)
        .delete(`/api/recipes/${ID}`)
        .set(lead)
        .send({ expectedVersion: again.version })
      expect(del.status).toBe(409)
      expect(del.body).toMatchObject({ error: 'recipe_in_use' })
    })
  })

  it('without config/backzettel.yaml nothing is referenced - delete works', async () => {
    const plain = makeRecipesHq()
    const other = appWith(plain)
    const recipe = await get(other, 'fillings/gefuellte-testkraenze')
    expect(recipe).toMatchObject({ usedByBackzettel: [], deletable: true })
    const del = await request(other)
      .delete('/api/recipes/fillings/gefuellte-testkraenze')
      .set(lead)
      .send({ expectedVersion: recipe.version })
    expect(del.status).toBe(200)
  })
})

describe('writing with HQ_WRITE_DIR (git worktree on app/edits)', () => {
  let hq: RecipesHq
  let writeRoot: string
  let app: Application
  beforeEach(() => {
    hq = makeRecipesHq({ backzettel: BACKZETTEL_REFERENCES })
    writeRoot = makeRecipesWriteRepo(hq)
    app = appWith(hq, writeRoot, { allowDelete: true })
  })

  const commits = () => git(writeRoot, 'rev-list', '--count', 'HEAD')
  const writeFile = (rel: string) =>
    path.join(writeRoot, 'data', 'recipes', rel)

  it('commits the edit as "Verwaltung (App)" with the editor as co-author; the read clone stays', async () => {
    const recipe = await get(app, 'cakes/testkuchen')
    expect(recipe).toMatchObject({ pending: null, pendingApproval: false })
    const before = readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    const res = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(lead)
      .send({ ...formOf(recipe), yield: 'für 4 Bleche' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      pending: true,
      changed: true,
    })
    expect(res.body.data).toMatchObject({
      yield: 'für 4 Bleche',
      pending: 'changed',
      pendingApproval: true,
    })
    expect(readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')).toBe(before)
    expect(
      fs.readFileSync(writeFile('cakes/Testkuchen.md'), 'utf-8')
    ).toContain('# 🍰 Testkuchen (für 4 Bleche)\n')
    expect(commits()).toBe('2')
    expect(git(writeRoot, 'log', '-1', '--format=%an <%ae>|%cn')).toBe(
      'Verwaltung (App) <verwaltung@bakery.local>|Verwaltung (App)'
    )
    const leadId = (await request(app).get('/api/auth/me').set(lead)).body.data
      .id
    expect(git(writeRoot, 'log', '-1', '--format=%B')).toBe(
      `recipes: Testkuchen (cakes/Testkuchen.md) geändert\n\nCo-authored-by: Lars Testleitung <user-${leadId}@bakery.local>`
    )
    // nie der Login (D13)
    expect(git(writeRoot, 'log', '-1', '--format=%B')).not.toContain(
      'test.leitung'
    )
    expect(git(writeRoot, 'show', '--name-only', '--format=', 'HEAD')).toBe(
      'data/recipes/cakes/Testkuchen.md'
    )
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
    // die Liste zeigt, was wartet
    const list = await request(app)
      .get('/api/recipes?category=cakes')
      .set(baker)
    expect(
      list.body.data.recipes.map((r: { slug: string; pending: unknown }) => [
        r.slug,
        r.pending,
      ])
    ).toEqual([
      ['musterschnitte', null],
      ['testkuchen', 'changed'],
    ])
  })

  it('a second edit builds on the pending one; reverting clears the flag', async () => {
    const first = await get(app, 'cakes/testkuchen')
    const one = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(lead)
      .send({ ...formOf(first), yield: 'für 4 Bleche' })
    const two = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ ...formOf(one.body.data), notes: 'Im Wasserbad.' })
    expect(two.status).toBe(200)
    expect(two.body.data).toMatchObject({
      yield: 'für 4 Bleche',
      notes: 'Im Wasserbad.',
      pending: 'changed',
    })
    const back = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(owner)
      .send({ ...formOf(first), expectedVersion: two.body.data.version })
    expect(back.body).toMatchObject({ changed: true, pending: false })
    expect(back.body.data).toMatchObject({
      pending: null,
      version: first.version,
    })
    expect(fs.readFileSync(writeFile('cakes/Testkuchen.md'), 'utf-8')).toBe(
      readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    )
    expect(commits()).toBe('4')
  })

  it('a no-op save writes and commits nothing - for every fixture file', async () => {
    const list = (await request(app).get('/api/recipes').set(owner)).body.data
      .recipes
    for (const summary of list.filter(
      (r: { editable: boolean }) => r.editable
    )) {
      const recipe = await get(app, summary.id)
      const res = await request(app)
        .put(`/api/recipes/${recipe.id}`)
        .set(lead)
        .send(formOf(recipe))
      expect(res.body).toMatchObject({
        success: true,
        changed: false,
        pending: false,
      })
    }
    expect(commits()).toBe('1')
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
    expect(git(writeRoot, 'diff', '--stat')).toBe('')
  })

  it('commits only the recipe file, not what else sits in the index', async () => {
    fs.writeFileSync(path.join(writeRoot, 'fremd.txt'), 'nicht von der App\n')
    git(writeRoot, 'add', 'fremd.txt')
    const recipe = await get(app, 'cakes/testkuchen')
    await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(lead)
      .send({ ...formOf(recipe), notes: 'Neu' })
    expect(git(writeRoot, 'show', '--name-only', '--format=', 'HEAD')).toBe(
      'data/recipes/cakes/Testkuchen.md'
    )
    expect(git(writeRoot, 'status', '--porcelain')).toBe('A  fremd.txt')
  })

  it('POST commits a new file; it shows as created until hq has it', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send(NEW_RECIPE)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ pending: true })
    expect(res.body.data).toMatchObject({
      id: 'cakes/testzopf-suess',
      pending: 'created',
    })
    expect(git(writeRoot, 'log', '-1', '--format=%s')).toBe(
      'recipes: Testzopf süß (cakes/testzopf-suess.md) angelegt'
    )
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'cakes/testzopf-suess.md'))
    ).toBe(false)
  })

  it('DELETE commits the removal; the recipe stays listed as "deleted, waiting"', async () => {
    const recipe = await get(app, 'cakes/musterschnitte')
    const res = await request(app)
      .delete('/api/recipes/cakes/musterschnitte')
      .set(lead)
      .send({ expectedVersion: recipe.version })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { id: 'cakes/musterschnitte', deleted: true },
      pending: true,
      changed: true,
    })
    expect(git(writeRoot, 'log', '-1', '--format=%s')).toBe(
      'recipes: Musterschnitte (cakes/Musterschnitte.md) gelöscht'
    )
    expect(git(writeRoot, 'show', '--name-status', '--format=', 'HEAD')).toBe(
      'D\tdata/recipes/cakes/Musterschnitte.md'
    )
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'cakes/Musterschnitte.md'))
    ).toBe(true)
    const waiting = await get(app, 'cakes/musterschnitte')
    expect(waiting).toMatchObject({
      title: 'Musterschnitte',
      pending: 'deleted',
      pendingApproval: true,
      editable: false,
      deletable: false,
    })
    expect(waiting.readOnlyReason).toMatch(/Löschung wartet auf Freigabe/)
    for (const again of [
      await request(app)
        .put('/api/recipes/cakes/musterschnitte')
        .set(lead)
        .send(formOf(waiting)),
      await request(app)
        .delete('/api/recipes/cakes/musterschnitte')
        .set(lead)
        .send({ expectedVersion: waiting.version }),
    ]) {
      expect(again.status).toBe(409)
      expect(again.body).toMatchObject({ error: 'recipe_deleted' })
    }
    // unter demselben Namen neu anlegen geht
    const recreated = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send({ title: 'Musterschnitte', category: 'cakes' })
    expect(recreated.status).toBe(201)
  })

  it('a move is one commit with both paths', async () => {
    const recipe = await get(app, 'breads/probelaib')
    const res = await request(app)
      .put('/api/recipes/breads/probelaib')
      .set(lead)
      .send({ ...formOf(recipe), category: 'rolls' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: 'rolls/probelaib',
      pending: 'created',
    })
    expect(git(writeRoot, 'log', '-1', '--format=%s')).toBe(
      'recipes: Probelaib: hell (rolls/Probelaib.md) verschoben'
    )
    expect(
      git(
        writeRoot,
        'show',
        '--name-status',
        '--no-renames',
        '--format=',
        'HEAD'
      ).split('\n')
    ).toEqual([
      'D\tdata/recipes/breads/Probelaib.md',
      'A\tdata/recipes/rolls/Probelaib.md',
    ])
    expect(await get(app, 'breads/probelaib')).toMatchObject({
      pending: 'deleted',
    })
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
  })

  it('deleting and moving are off until hq allows them (default with a write dir)', async () => {
    const guarded = appWith(hq, writeRoot)
    const list = await request(guarded).get('/api/recipes').set(lead)
    expect(list.body.data).toMatchObject({
      canDelete: false,
      deleteIssue: expect.stringMatching(/noch nicht freigeschaltet/),
    })
    const recipe = await get(guarded, 'cakes/musterschnitte')
    expect(recipe).toMatchObject({ deletable: false })
    const del = await request(guarded)
      .delete('/api/recipes/cakes/musterschnitte')
      .set(lead)
      .send({ expectedVersion: recipe.version })
    expect(del.status).toBe(409)
    expect(del.body).toMatchObject({
      error: 'recipe_delete_unavailable',
      message: expect.stringMatching(/noch nicht freigeschaltet/),
    })
    const move = await request(guarded)
      .put('/api/recipes/cakes/musterschnitte')
      .set(lead)
      .send({ ...formOf(recipe), category: 'breads' })
    expect(move.status).toBe(409)
    expect(move.body).toMatchObject({ error: 'recipe_delete_unavailable' })
    expect(commits()).toBe('1')
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
    // Ändern und Anlegen gehen weiter
    const put = await request(guarded)
      .put('/api/recipes/cakes/musterschnitte')
      .set(lead)
      .send({ ...formOf(recipe), notes: 'Geht' })
    expect(put.status).toBe(200)
  })

  it('the references of a pending Backzettel edit count too', async () => {
    // im Schreib-Worktree zeigt die (noch nicht freigegebene) YAML auf ein weiteres Rezept
    fs.appendFileSync(
      path.join(writeRoot, 'config', 'backzettel.yaml'),
      '  - { id: kompott, name: Testkompott, recipe: data/recipes/fillings/Testkompott.md }\n'
    )
    git(writeRoot, 'commit', '-q', '-am', 'config: wartende Änderung')
    const recipe = await get(app, 'fillings/testkompott')
    expect(recipe.usedByBackzettel).toEqual([
      { kind: 'filling', id: 'kompott', name: 'Testkompott', section: null },
    ])
    const del = await request(app)
      .delete('/api/recipes/fillings/testkompott')
      .set(owner)
      .send({ expectedVersion: recipe.version })
    expect(del.status).toBe(409)
    expect(del.body).toMatchObject({ error: 'recipe_in_use' })
  })

  it('parallel saves are serialised (no git index.lock race)', async () => {
    const ids = [
      'cakes/testkuchen',
      'cakes/musterschnitte',
      'breads/musterkruste',
      'rolls/muesli-wecken',
    ]
    const recipes = await Promise.all(ids.map((id) => get(app, id)))
    const results = await Promise.all(
      recipes.map((recipe, i) =>
        request(app)
          .put(`/api/recipes/${recipe.id}`)
          .set(i % 2 ? owner : lead)
          .send({ ...formOf(recipe), notes: `Notiz ${i}` })
      )
    )
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect(commits()).toBe('5')
    expect(git(writeRoot, 'status', '--porcelain')).toBe('')
  })

  it('a rejected commit (pre-commit hook) answers 500 and restores the files', async () => {
    const hook = path.join(writeRoot, '.git', 'hooks', 'pre-commit')
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const recipe = await get(app, 'cakes/testkuchen')
      const before = fs.readFileSync(writeFile('cakes/Testkuchen.md'), 'utf-8')
      const put = await request(app)
        .put('/api/recipes/cakes/testkuchen')
        .set(lead)
        .send({ ...formOf(recipe), notes: 'Scheitert' })
      expect(put.status).toBe(500)
      expect(put.body).toMatchObject({
        error: 'hq_commit_failed',
        message: expect.any(String),
      })
      expect(fs.readFileSync(writeFile('cakes/Testkuchen.md'), 'utf-8')).toBe(
        before
      )
      const del = await request(app)
        .delete('/api/recipes/cakes/testkuchen')
        .set(lead)
        .send({ expectedVersion: recipe.version })
      expect(del.status).toBe(500)
      expect(fs.readFileSync(writeFile('cakes/Testkuchen.md'), 'utf-8')).toBe(
        before
      )
      const post = await request(app)
        .post('/api/recipes')
        .set(lead)
        .send(NEW_RECIPE)
      expect(post.status).toBe(500)
      expect(fs.existsSync(writeFile('cakes/testzopf-suess.md'))).toBe(false)
      expect(git(writeRoot, 'status', '--porcelain')).toBe('')
      expect(commits()).toBe('1')
    } finally {
      error.mockRestore()
      fs.rmSync(hook)
    }
  })

  it('refuses to commit when the write worktree is not on app/edits (503)', async () => {
    const recipe = await get(app, 'cakes/testkuchen')
    git(writeRoot, 'checkout', '-q', '-b', 'main')
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const other = appWith(hq, writeRoot, { allowDelete: true })
      const res = await request(other)
        .put('/api/recipes/cakes/testkuchen')
        .set(lead)
        .send({ ...formOf(recipe), notes: 'Falscher Branch' })
      expect(res.status).toBe(503)
      expect(res.body).toMatchObject({
        error: 'hq_write_wrong_branch',
        message: expect.stringMatching(/app\/edits/),
      })
      const list = await request(other).get('/api/recipes').set(lead)
      expect(list.body.data).toMatchObject({
        status: 'ok',
        writable: false,
        writeIssue: { error: 'hq_write_wrong_branch' },
      })
      expect(git(writeRoot, 'status', '--porcelain')).toBe('')
    } finally {
      error.mockRestore()
    }
  })

  it('a write dir that is no git repo is 503 and nothing is written', async () => {
    const plain = tempDir('hq-no-repo-')
    fs.cpSync(hq.root, plain, { recursive: true })
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const other = appWith(hq, plain)
      const recipe = await get(other, 'cakes/testkuchen')
      const before = fs.readFileSync(
        path.join(plain, 'data/recipes/cakes/Testkuchen.md'),
        'utf-8'
      )
      const res = await request(other)
        .put('/api/recipes/cakes/testkuchen')
        .set(lead)
        .send({ ...formOf(recipe), notes: 'Kein Repo' })
      expect(res.status).toBe(503)
      expect(res.body).toMatchObject({ error: 'hq_write_unavailable' })
      expect(
        fs.readFileSync(
          path.join(plain, 'data/recipes/cakes/Testkuchen.md'),
          'utf-8'
        )
      ).toBe(before)
    } finally {
      error.mockRestore()
    }
  })

  it('a recipe that is only in the approved version waits for the worktree: no edit, no delete (409)', async () => {
    // ein Schreib-Worktree, der das Rezept (noch) nicht hat
    fs.rmSync(writeFile('cakes/Testkuchen.md'))
    git(writeRoot, 'commit', '-q', '-am', 'fehlt hier')
    // als Stand von main gilt hier der Lese-Klon; „gelöscht" ist es trotzdem,
    // weil der Branch die Löschung enthält
    expect(await get(app, 'cakes/testkuchen')).toMatchObject({
      pending: 'deleted',
    })

    const fresh = makeRecipesHq()
    const bare = makeRecipesWriteRepo(fresh)
    fs.writeFileSync(
      path.join(fresh.recipesDir, 'cakes', 'Nur-freigegeben.md'),
      '# Nur freigegeben\n\n### Zutaten:\n| Zutat | Menge |\n|---|---|\n| Salz | 1 g |\n'
    )
    const other = appWith(fresh, bare, { allowDelete: true })
    const recipe = await get(other, 'cakes/nur-freigegeben')
    expect(recipe).toMatchObject({ pending: null, editable: true })
    const head = git(bare, 'rev-parse', 'HEAD')
    const inWorktree = path.join(bare, 'data/recipes/cakes/Nur-freigegeben.md')
    const del = await request(other)
      .delete('/api/recipes/cakes/nur-freigegeben')
      .set(lead)
      .send({ expectedVersion: recipe.version })
    expect(del.status).toBe(409)
    expect(del.body).toMatchObject({ error: 'hq_write_out_of_sync' })
    // Ändern legte die Datei im Worktree neu an - beim nächsten Rebase auf
    // main kollidierte sie mit der dortigen (add/add), die PR bliebe stehen
    const put = await request(other)
      .put('/api/recipes/cakes/nur-freigegeben')
      .set(lead)
      .send({ ...formOf(recipe), yield: '1 Stück' })
    expect(put.status).toBe(409)
    expect(put.body).toMatchObject({
      success: false,
      error: 'hq_write_out_of_sync',
      message: expect.stringMatching(/noch nicht angekommen/),
    })
    const move = await request(other)
      .put('/api/recipes/cakes/nur-freigegeben')
      .set(lead)
      .send({ ...formOf(recipe), category: 'special' })
    expect(move.status).toBe(409)
    expect(move.body).toMatchObject({ error: 'hq_write_out_of_sync' })
    expect(git(bare, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(bare, 'status', '--porcelain')).toBe('')
    expect(fs.existsSync(inWorktree)).toBe(false)
    // ein Speichern ohne Änderung schreibt ohnehin nichts
    const same = await request(other)
      .put('/api/recipes/cakes/nur-freigegeben')
      .set(lead)
      .send(formOf(recipe))
    expect(same.status).toBe(200)
    expect(same.body).toMatchObject({ changed: false })
    expect(fs.existsSync(inWorktree)).toBe(false)

    // sobald der Worktree die Datei hat (Rebase auf main), geht es
    fs.copyFileSync(
      path.join(fresh.recipesDir, 'cakes', 'Nur-freigegeben.md'),
      inWorktree
    )
    git(bare, 'add', '-A')
    git(bare, 'commit', '-q', '-m', 'main: Rezept angekommen')
    const later = await request(other)
      .put('/api/recipes/cakes/nur-freigegeben')
      .set(lead)
      .send({ ...formOf(recipe), yield: '1 Stück' })
    expect(later.status).toBe(200)
    expect(git(bare, 'show', '--name-status', '--format=', 'HEAD')).toBe(
      'M\tdata/recipes/cakes/Nur-freigegeben.md'
    )
  })

  it('unreadable Backzettel master data in the worktree lock delete even when the read clone is fine', async () => {
    const recipe = await get(app, 'cakes/testkuchen')
    expect(recipe.deletable).toBe(true)
    fs.writeFileSync(
      path.join(writeRoot, 'config', 'backzettel.yaml'),
      'fillings:\n  - { id: nuss\n'
    )
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      const del = await request(app)
        .delete('/api/recipes/cakes/testkuchen')
        .set(owner)
        .send({ expectedVersion: recipe.version })
      expect(del.status).toBe(409)
      expect(del.body).toMatchObject({ error: 'backzettel_config_unreadable' })
      expect(fs.existsSync(writeFile('cakes/Testkuchen.md'))).toBe(true)
    } finally {
      error.mockRestore()
    }
  })
})

describe('production without HQ_WRITE_DIR', () => {
  it('refuses writes with 503 instead of writing into the read clone', async () => {
    const hq = makeRecipesHq()
    const app = appWith(hq, null, { production: true })
    const list = await request(app).get('/api/recipes').set(owner)
    expect(list.body.data).toMatchObject({
      status: 'ok',
      writable: false,
      writeIssue: { error: 'hq_write_unavailable' },
    })
    const recipe = await get(app, 'cakes/testkuchen')
    const before = readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')
    for (const res of [
      await request(app)
        .put('/api/recipes/cakes/testkuchen')
        .set(owner)
        .send({ ...formOf(recipe), notes: 'Nein' }),
      await request(app).post('/api/recipes').set(owner).send(NEW_RECIPE),
      await request(app)
        .delete('/api/recipes/cakes/testkuchen')
        .set(owner)
        .send({ expectedVersion: recipe.version }),
    ]) {
      expect(res.status).toBe(503)
      expect(res.body).toMatchObject({
        error: 'hq_write_unavailable',
        message: expect.any(String),
      })
    }
    expect(readRecipe(hq.recipesDir, 'cakes/Testkuchen.md')).toBe(before)
    expect(
      fs.existsSync(path.join(hq.recipesDir, 'cakes/testzopf-suess.md'))
    ).toBe(false)
  })
})
