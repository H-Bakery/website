/**
 * Recipes on the B5b write-back: a save commits in the `app/edits` worktree,
 * `HqEditsSync` pushes it into the one rolling PR, and "wartet auf Freigabe"
 * is measured against `origin/main` - against a temp bare repo as origin and
 * a local fake of the GitHub pulls API (never the real GitHub). Synthetic
 * recipes only.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { HqEditsSync } from '../../src/services/hq-edits-sync.service'
import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { git, removeTempDirs } from '../helpers/hqProducts'
import { fixtureRecipes, RECIPE_FIXTURE_DIR } from '../helpers/hqRecipes'
import {
  FakeGitHub,
  HqRemote,
  makeHqRemote,
  mergeEdits,
  originFile,
  pushForeign,
  startFakeGitHub,
} from '../helpers/hqRemote'

jest.setTimeout(60000)

const REPO = 'Test-Org/hq'
const QUIET = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
const QUIET_HQ = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

let api: TestApp
let lead: Record<string, string>
let github: FakeGitHub

beforeAll(async () => {
  api = await createTestApp()
  await createUser({
    username: 'test.leitung',
    role: 'backstubenleiter',
    displayName: 'Lars Testleitung',
  })
  lead = bearer((await login(api.app, 'test.leitung')).token)
  github = await startFakeGitHub(REPO)
})

afterAll(async () => {
  await github.close()
  await api.close()
  removeTempDirs()
})

beforeEach(() => {
  github.pulls.splice(0)
  github.requests.splice(0)
})

/** origin with the fixture recipes on main; write and read clone up to date. */
function setup(): { remote: HqRemote; edits: HqEditsSync; app: Application } {
  const remote = makeHqRemote()
  const files: Record<string, string> = {}
  for (const rel of fixtureRecipes()) {
    files[`data/recipes/${rel}`] = fs.readFileSync(
      path.join(RECIPE_FIXTURE_DIR, rel),
      'utf-8'
    )
  }
  pushForeign(remote, files, 'Rezepte')
  git(remote.read, 'pull', '-q', '--ff-only')
  git(remote.write, 'fetch', '-q', 'origin')
  git(remote.write, 'reset', '-q', '--hard', 'origin/main')
  const edits = new HqEditsSync({
    writeDir: remote.write,
    token: 'test-token',
    githubRepo: REPO,
    githubApiUrl: github.url,
    log: QUIET,
  })
  const app = createApp({
    logRequests: false,
    sequelize: api.sequelize,
    hq: { log: QUIET_HQ },
    hqProducts: {
      productsDir: path.join(remote.read, 'products'),
      writeDir: remote.write,
    },
    backzettel: { hqDir: remote.read },
    recipes: {
      recipesDir: path.join(remote.read, 'data', 'recipes'),
      allowDelete: true,
    },
    hqSync: { edits },
  })
  return { remote, edits, app }
}

const get = async (app: Application, id: string) =>
  request(app).get(`/api/recipes/${id}`).set(lead)

const formOf = (recipe: Record<string, unknown>) => ({
  expectedVersion: recipe['version'],
  title: recipe['title'],
  yield: recipe['yield'],
  description: recipe['description'],
  parts: recipe['parts'],
  steps: recipe['steps'],
  notes: recipe['notes'],
})

describe('recipes in the rolling hq PR', () => {
  it('reads the approved recipes from origin/main', async () => {
    const { edits } = setup()
    expect(edits.approvedRecipeFiles()).toBeNull()
    await edits.init()
    const approved = edits.approvedRecipeFiles()
    expect([...(approved?.keys() ?? [])].sort()).toEqual(
      fixtureRecipes().sort()
    )
    expect(approved?.get('cakes/Testkuchen.md')).toBe(
      fs.readFileSync(
        path.join(RECIPE_FIXTURE_DIR, 'cakes/Testkuchen.md'),
        'utf-8'
      )
    )
    // products and the Backzettel YAML are read as before
    expect(edits.approvedProductFiles()?.size).toBeGreaterThan(0)
  })

  it('an edit is pushed into the PR and stops waiting once hq merged it', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    const recipe = (await get(app, 'cakes/testkuchen')).body.data
    expect(recipe).toMatchObject({ pending: null })
    const put = await request(app)
      .put('/api/recipes/cakes/testkuchen')
      .set(lead)
      .send({ ...formOf(recipe), yield: 'für 4 Bleche' })
    expect(put.body).toMatchObject({ pending: true })
    const pushed = await edits.sync()
    expect(pushed).toMatchObject({ lastError: null, unmergedCommits: 1 })
    expect(
      originFile(remote, 'app/edits', 'data/recipes/cakes/Testkuchen.md')
    ).toContain('# 🍰 Testkuchen (für 4 Bleche)')
    expect(github.pulls).toHaveLength(1)
    expect(github.pulls[0].body).toContain('data/recipes/cakes/Testkuchen.md')
    expect(github.pulls[0].body).toContain('Lars Testleitung')
    expect((await get(app, 'cakes/testkuchen')).body.data).toMatchObject({
      pending: 'changed',
      pendingApproval: true,
    })

    mergeEdits(remote)
    await edits.sync()
    // the read clone has not pulled yet - "approved" is origin/main
    expect(
      fs.readFileSync(
        path.join(remote.read, 'data/recipes/cakes/Testkuchen.md'),
        'utf-8'
      )
    ).toContain('(für 3 Bleche)')
    expect((await get(app, 'cakes/testkuchen')).body.data).toMatchObject({
      yield: 'für 4 Bleche',
      pending: null,
      pendingApproval: false,
    })
  })

  it('a new recipe waits as created, a deleted one as deleted - until merged', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    const created = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send({ title: 'Probestollen', category: 'cakes', yield: '4 Stück' })
    expect(created.body.data).toMatchObject({
      id: 'cakes/probestollen',
      pending: 'created',
    })
    const old = (await get(app, 'cakes/musterschnitte')).body.data
    const removed = await request(app)
      .delete('/api/recipes/cakes/musterschnitte')
      .set(lead)
      .send({ expectedVersion: old.version })
    expect(removed.body).toMatchObject({ pending: true })
    await edits.sync()
    expect(
      originFile(remote, 'app/edits', 'data/recipes/cakes/probestollen.md')
    ).toContain('title: Probestollen')
    expect(
      originFile(remote, 'app/edits', 'data/recipes/cakes/Musterschnitte.md')
    ).toBeNull()
    expect(
      originFile(remote, 'main', 'data/recipes/cakes/Musterschnitte.md')
    ).not.toBeNull()
    const waiting = await request(app)
      .get('/api/recipes?category=cakes')
      .set(lead)
    expect(
      waiting.body.data.recipes.map((r: { slug: string; pending: unknown }) => [
        r.slug,
        r.pending,
      ])
    ).toEqual([
      ['musterschnitte', 'deleted'],
      ['probestollen', 'created'],
      ['testkuchen', null],
    ])

    mergeEdits(remote)
    await edits.sync()
    const merged = await request(app)
      .get('/api/recipes?category=cakes')
      .set(lead)
    expect(
      merged.body.data.recipes.map((r: { slug: string; pending: unknown }) => [
        r.slug,
        r.pending,
      ])
    ).toEqual([
      ['probestollen', null],
      ['testkuchen', null],
    ])
    // gone for good, although the read clone still has the file
    expect(
      fs.existsSync(
        path.join(remote.read, 'data/recipes/cakes/Musterschnitte.md')
      )
    ).toBe(true)
    expect((await get(app, 'cakes/musterschnitte')).status).toBe(404)
  })

  it('a recipe created under the name of one that waits for deletion keeps its id after the merge', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    const old = (await get(app, 'fillings/testkompott')).body.data
    const removed = await request(app)
      .delete('/api/recipes/fillings/testkompott')
      .set(lead)
      .send({ expectedVersion: old.version })
    expect(removed.body).toMatchObject({ pending: true })
    const created = await request(app)
      .post('/api/recipes')
      .set(lead)
      .send({ title: 'Testkompott', category: 'fillings', yield: '2 kg' })
    expect(created.status).toBe(201)
    // the address the app opens now is the one that stays
    expect(created.body.data).toMatchObject({
      id: 'fillings/testkompott',
      file: 'testkompott.md',
      pending: 'created',
    })
    const waiting = await request(app)
      .get('/api/recipes?category=fillings')
      .set(lead)
    expect(
      waiting.body.data.recipes
        .filter((r: { slug: string }) => r.slug.startsWith('testkompott'))
        .map((r: { slug: string; pending: unknown }) => [r.slug, r.pending])
        .sort()
    ).toEqual([
      ['testkompott', 'created'],
      ['testkompott-2', 'deleted'],
    ])
    await edits.sync()
    mergeEdits(remote)
    await edits.sync()
    const merged = (await get(app, 'fillings/testkompott')).body.data
    expect(merged).toMatchObject({
      id: 'fillings/testkompott',
      file: 'testkompott.md',
      yield: '2 kg',
      pending: null,
    })
    expect((await get(app, 'fillings/testkompott-2')).status).toBe(404)
  })

  it('an edit of a file with umlauts in its name survives main moving on (git quotes such paths)', async () => {
    // `git diff --name-only` prints non-ASCII paths quoted and escaped unless
    // core.quotePath is off. The squash-merge detection then compared a path
    // that matches nothing, took the edit for merged and dropped the commit.
    const { app, edits, remote } = setup()
    await edits.init()
    const id = 'fillings/gefuellte-testkraenze'
    const rel = 'data/recipes/fillings/Gefüllte-Testkränze.md'
    const recipe = (await get(app, id)).body.data
    const parts = JSON.parse(JSON.stringify(recipe.parts))
    parts[0].ingredients[1].amount = 475
    const put = await request(app)
      .put(`/api/recipes/${id}`)
      .set(lead)
      .send({ ...formOf(recipe), parts })
    expect(put.body).toMatchObject({ pending: true, changed: true })
    await edits.sync()
    expect(originFile(remote, 'app/edits', rel)).toContain(
      '| Wasser | 475 ml |'
    )
    expect(github.pulls[0].body).toContain(rel)

    // main moves on with another path (the daily cash reports do that)
    pushForeign(remote, { 'data/reports/heute.txt': 'Bericht\n' }, 'Pipeline')
    const status = await edits.sync()
    expect(status).toMatchObject({ lastError: null, unmergedCommits: 1 })
    expect(originFile(remote, 'app/edits', rel)).toContain(
      '| Wasser | 475 ml |'
    )
    expect((await get(app, id)).body.data).toMatchObject({
      pending: 'changed',
      pendingApproval: true,
    })
    expect(fs.readFileSync(path.join(remote.write, rel), 'utf-8')).toContain(
      '| Wasser | 475 ml |'
    )

    // a deletion of such a file is kept as well
    const old = (await get(app, 'rolls/muesli-wecken')).body.data
    await request(app)
      .delete('/api/recipes/rolls/muesli-wecken')
      .set(lead)
      .send({ expectedVersion: old.version })
    pushForeign(remote, { 'data/reports/morgen.txt': 'Bericht\n' }, 'Pipeline')
    expect(await edits.sync()).toMatchObject({
      lastError: null,
      unmergedCommits: 2,
    })
    expect(
      originFile(remote, 'app/edits', 'data/recipes/rolls/Müsli-Wecken.md')
    ).toBeNull()
    expect((await get(app, 'rolls/muesli-wecken')).body.data).toMatchObject({
      pending: 'deleted',
    })

    // and once hq squash-merged both, nothing waits any more
    pushForeign(
      remote,
      { [rel]: originFile(remote, 'app/edits', rel) + '\n' },
      'Stammdaten aus der Verwaltung (#1)'
    )
    git(remote.seed, 'rm', '-q', 'data/recipes/rolls/Müsli-Wecken.md')
    git(
      remote.seed,
      'commit',
      '-q',
      '-m',
      'Stammdaten aus der Verwaltung (#1), Teil 2'
    )
    git(remote.seed, 'push', '-q', 'origin', 'HEAD:refs/heads/main')
    expect(await edits.sync()).toMatchObject({
      lastError: null,
      unmergedCommits: 0,
    })
    expect((await get(app, id)).body.data).toMatchObject({ pending: null })
    expect((await get(app, 'rolls/muesli-wecken')).status).toBe(404)
  })

  it('a recipe added in hq by hand appears with the next sync, not as "deleted"', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    pushForeign(
      remote,
      {
        'data/recipes/cakes/Von-Hand.md':
          '# Von Hand\n\n### Zutaten:\n| Zutat | Menge |\n|---|---|\n| Salz | 1 g |\n',
      },
      'von Hand'
    )
    expect((await get(app, 'cakes/von-hand')).status).toBe(404)
    await edits.sync()
    const res = await get(app, 'cakes/von-hand')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      title: 'Von Hand',
      pending: null,
      editable: true,
    })
  })
})
