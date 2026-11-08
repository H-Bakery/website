/**
 * Z4 against the real app: `PUT /api/backzettel/config/base` (Grundmengen →
 * hq, rolling PR) and `GET /api/backzettel/reference` (median sold from the
 * cash reports). Synthetic master data and reports from tests/fixtures, temp
 * git repos (a bare repo as origin, never GitHub), synthetic users.
 *
 * Calendar: Di 2026-11-24, Sa 2026-11-28; "today" for the reference is
 * Mi 2026-12-02.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp, CreateAppOptions } from '../../src/app'
import { HqEditsSync } from '../../src/services/hq-edits-sync.service'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import {
  FIXTURE_DIR,
  git,
  removeTempDirs,
  tempDir,
} from '../helpers/hqProducts'
import {
  FakeGitHub,
  makeHqRemote,
  mergeEdits,
  originFile,
  pushForeign,
  startFakeGitHub,
} from '../helpers/hqRemote'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel-grundmengen.synthetic')

jest.setTimeout(60000)

const CONFIG_REL = 'config/backzettel.yaml'
const QUIET = {
  log: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

let api: TestApp
let github: FakeGitHub
let bakerId: number
const tokens: Record<'inhaber' | 'backstube' | 'verkauf' | 'fahrer', string> = {
  inhaber: '',
  backstube: '',
  verkauf: '',
  fahrer: '',
}

beforeAll(async () => {
  api = await createTestApp()
  tokens.inhaber = await sessionFor(api.app, 'test.inhaber', 'inhaber')
  const baker = await createUser({
    username: 'test.backstube',
    role: 'backstube',
    displayName: 'Test Bäcker',
  })
  bakerId = baker.id
  tokens.backstube = (await login(api.app, 'test.backstube')).token
  tokens.verkauf = await sessionFor(api.app, 'test.verkauf', 'verkauf')
  tokens.fahrer = await sessionFor(api.app, 'test.fahrer', 'fahrer')
  github = await startFakeGitHub('Test-Org/hq')
})

afterAll(async () => {
  await github.close()
  await api.close()
  removeTempDirs()
})

/** A synthetic hq tree: config + the referenced fixture products. */
function writeHq(dir: string, yaml: string | null = fixture.CONFIG_YAML): void {
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'products'), { recursive: true })
  for (const file of fixture.PRODUCT_FILES) {
    fs.copyFileSync(
      path.join(FIXTURE_DIR, file),
      path.join(dir, 'products', file)
    )
  }
  if (yaml !== null) fs.writeFileSync(path.join(dir, CONFIG_REL), yaml)
}

function app(options: CreateAppOptions): Application {
  return createApp({
    logRequests: false,
    sequelize: api.sequelize,
    ...options,
    hq: { log: QUIET, today: '2026-12-02', ...options.hq },
  })
}

const as = (a: Application, role: keyof typeof tokens) => ({
  get: (p: string) => request(a).get(p).set(bearer(tokens[role])),
  put: (p: string, body: unknown) =>
    request(a)
      .put(p)
      .set(bearer(tokens[role]))
      .send(body as object),
})

const workingBase = (data: any, itemId: string) =>
  data.working.config.items.find((i: any) => i.id === itemId).base

// --------------------------------------------------------------- dev mode

describe('PUT /config/base without HQ_WRITE_DIR (development)', () => {
  let hqDir: string
  let a: Application
  const file = () => path.join(hqDir, CONFIG_REL)

  beforeEach(() => {
    hqDir = tempDir('bz-dev-')
    writeHq(hqDir)
    a = app({
      backzettel: { hqDir, cacheMs: 0 },
      hqProducts: { productsDir: path.join(hqDir, 'products'), writeDir: null },
    })
  })

  it('needs a session and the role inhaber or backstube', async () => {
    const body = { itemId: 'kornbrot', weekday: 2, value: 5 }
    expect(
      (await request(a).put('/api/backzettel/config/base').send(body)).status
    ).toBe(401)
    for (const role of ['verkauf', 'fahrer'] as const) {
      const res = await as(a, role).put('/api/backzettel/config/base', body)
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({
        error: 'forbidden',
        message: expect.any(String),
      })
    }
    expect(fs.readFileSync(file(), 'utf-8')).toBe(fixture.CONFIG_YAML)
    // reading the master data stays open to every session
    expect((await as(a, 'verkauf').get('/api/backzettel/config')).status).toBe(
      200
    )
  })

  it('writes exactly one value into the YAML and answers the new state', async () => {
    const res = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'musterweck',
      weekday: 3,
      value: 25,
    })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      changed: true,
      pending: false,
      pendingApproval: false,
      writable: true,
      status: 'ok',
    })
    expect(workingBase(res.body.data, 'musterweck')[3]).toBe(25)
    const text = fs.readFileSync(file(), 'utf-8')
    expect(text).toBe(
      fixture.CONFIG_YAML.replace(
        '      3: 30 # Mittwoch schwächer',
        '      3: 25 # Mittwoch schwächer'
      )
    )
  })

  it('a save without a change writes nothing (zero diff)', async () => {
    const before = fs.statSync(file()).mtimeMs
    const res = await as(a, 'inhaber').put('/api/backzettel/config/base', {
      itemId: 'kornbrot',
      weekday: 2,
      value: '4',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.changed).toBe(false)
    expect(fs.readFileSync(file(), 'utf-8')).toBe(fixture.CONFIG_YAML)
    expect(fs.statSync(file()).mtimeMs).toBe(before)
  })

  it('per variant: the open variant stays open', async () => {
    const res = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'zopf-gefuellt',
      weekday: 6,
      variants: { mohn: 2 },
    })
    expect(res.status).toBe(200)
    expect(workingBase(res.body.data, 'zopf-gefuellt')[6]).toEqual({
      nuss: 4,
      mohn: 2,
    })
    expect(fs.readFileSync(file(), 'utf-8')).toContain(
      'base: { 6: { nuss: 4, mohn: 2 } }'
    )
  })

  it('the day computation uses the saved Grundmenge', async () => {
    await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'mustersemmel',
      weekday: 2,
      value: 12,
    })
    const day = await as(a, 'backstube').get('/api/backzettel/2026-11-24')
    expect(day.status).toBe(200)
    const line = day.body.data.sections
      .flatMap((s: any) => s.lines)
      .find((l: any) => l.itemId === 'mustersemmel')
    expect(line).toMatchObject({ base: 12, total: 12 })
  })

  it.each([
    [{ itemId: 'kornbrot', weekday: 2, value: -1 }, 400, 'invalid_quantity'],
    [
      { itemId: 'kornbrot', weekday: 2, value: 'viel' },
      400,
      'invalid_quantity',
    ],
    [{ itemId: 'gibtsnicht', weekday: 2, value: 1 }, 404, 'unknown_item'],
    [{ itemId: 'kornbrot', weekday: 1, value: 1 }, 400, 'invalid_weekday'],
    [
      { itemId: 'zopf-gefuellt', weekday: 6, variants: { apfel: 1 } },
      404,
      'unknown_variant',
    ],
    [{ itemId: 'kornbrot', weekday: 2 }, 400, 'validation'],
  ])('%j → %i %s, nothing written', async (body, status, error) => {
    const res = await as(a, 'backstube').put(
      '/api/backzettel/config/base',
      body
    )
    expect(res.status).toBe(status)
    expect(res.body).toMatchObject({
      success: false,
      error,
      message: expect.any(String),
    })
    expect(fs.readFileSync(file(), 'utf-8')).toBe(fixture.CONFIG_YAML)
  })

  it('a value the schema rejects is 400 validation with the errors', async () => {
    // Stück must be whole numbers
    const res = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'musterweck',
      weekday: 2,
      value: 40.5,
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation')
    expect(res.body.message).toMatch(/ganzzahlig/)
    expect(res.body.errors).toEqual([
      expect.objectContaining({ path: 'items[1].base.2' }),
    ])
    // a filled item needs its Grundmenge per variant
    const filled = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'zopf-gefuellt',
      weekday: 6,
      value: 5,
    })
    expect(filled.status).toBe(400)
    expect(filled.body.message).toMatch(/je Variante/)
    expect(fs.readFileSync(file(), 'utf-8')).toBe(fixture.CONFIG_YAML)
  })

  it('without master data: 409 no_config', async () => {
    fs.rmSync(file())
    const res = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'kornbrot',
      weekday: 2,
      value: 1,
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('no_config')
  })

  it('production without HQ_WRITE_DIR refuses to write (503)', async () => {
    const prod = app({
      backzettel: { hqDir, cacheMs: 0 },
      hqProducts: {
        productsDir: path.join(hqDir, 'products'),
        writeDir: null,
        production: true,
      },
    })
    const res = await as(prod, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'kornbrot',
      weekday: 2,
      value: 1,
    })
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('hq_write_unavailable')
    const cfg = await as(prod, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data.writable).toBe(false)
  })
})

// ------------------------------------------------------ write worktree (B5)

describe('PUT /config/base with HQ_WRITE_DIR (commit in app/edits)', () => {
  let read: string
  let write: string
  let a: Application

  beforeEach(() => {
    read = tempDir('bz-read-')
    writeHq(read)
    write = tempDir('bz-write-')
    git(write, 'init', '-q', '-b', 'app/edits')
    git(write, 'config', 'commit.gpgsign', 'false')
    writeHq(write)
    git(write, 'add', '-A')
    git(write, 'commit', '-q', '-m', 'initial')
    a = app({
      backzettel: { hqDir: read, cacheMs: 0 },
      hqProducts: { productsDir: path.join(read, 'products'), writeDir: write },
    })
  })

  const put = (body: unknown) =>
    as(a, 'backstube').put('/api/backzettel/config/base', body)

  it('commits as Verwaltung (App) with the editor as Co-authored-by (user id only)', async () => {
    const res = await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      changed: true,
      pending: true,
      pendingApproval: true,
    })
    expect(git(write, 'log', '-1', '--format=%an <%ae>|%s')).toBe(
      'Verwaltung (App) <verwaltung@bakery.local>|config: Grundmenge Kornbrot (kornbrot) Samstag geändert'
    )
    expect(git(write, 'log', '-1', '--format=%b')).toBe(
      `Co-authored-by: Test Bäcker <user-${bakerId}@bakery.local>`
    )
    expect(git(write, 'show', '--stat', '--format=', 'HEAD')).toContain(
      CONFIG_REL
    )
    expect(git(write, 'diff', 'HEAD~1', '--numstat')).toBe(
      `1\t1\t${CONFIG_REL}`
    )
    expect(git(write, 'status', '--porcelain')).toBe('')
    // the read clone (what the Backzettel computes with) is untouched
    expect(fs.readFileSync(path.join(read, CONFIG_REL), 'utf-8')).toBe(
      fixture.CONFIG_YAML
    )
  })

  it('GET /config: approved config + working version + pendingApproval', async () => {
    let cfg = await as(a, 'verkauf').get('/api/backzettel/config')
    expect(cfg.body.data).toMatchObject({
      pendingApproval: false,
      writable: true,
    })
    await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    cfg = await as(a, 'verkauf').get('/api/backzettel/config')
    const d = cfg.body.data
    expect(d.pendingApproval).toBe(true)
    expect(
      d.config.items.find((i: any) => i.id === 'kornbrot').base[6]
    ).toBeNull()
    expect(workingBase(d, 'kornbrot')[6]).toBe(2)
  })

  it('a second save builds on the waiting one; a no-op commits nothing', async () => {
    await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    await put({ itemId: 'musterweck', weekday: 7, value: 80 })
    const text = fs.readFileSync(path.join(write, CONFIG_REL), 'utf-8')
    expect(text).toContain('6: 2 } # OFFEN: Samstag')
    expect(text).toContain('      6: 60\n      7: 80\n')
    const count = git(write, 'rev-list', '--count', 'HEAD')
    const res = await put({ itemId: 'musterweck', weekday: 7, value: 80 })
    expect(res.body.data.changed).toBe(false)
    expect(git(write, 'rev-list', '--count', 'HEAD')).toBe(count)
  })

  it('saving back the approved value is no longer pending', async () => {
    await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    const res = await put({ itemId: 'kornbrot', weekday: 6, value: null })
    expect(res.body.data.pendingApproval).toBe(false)
  })

  it('only commits the YAML - a foreign staged file stays staged', async () => {
    fs.writeFileSync(path.join(write, 'notiz.md'), 'fremd\n')
    git(write, 'add', 'notiz.md')
    await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    expect(git(write, 'show', '--name-only', '--format=', 'HEAD')).toBe(
      CONFIG_REL
    )
    expect(git(write, 'diff', '--cached', '--name-only')).toBe('notiz.md')
  })

  it('creates the YAML in the worktree from the read clone when missing there', async () => {
    git(write, 'rm', '-q', CONFIG_REL)
    git(write, 'commit', '-q', '-m', 'ohne config')
    const res = await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    expect(res.status).toBe(200)
    expect(git(write, 'show', '--name-status', '--format=', 'HEAD')).toBe(
      `A\t${CONFIG_REL}`
    )
  })

  it('wrong branch → 503 hq_write_wrong_branch, nothing written', async () => {
    git(write, 'checkout', '-q', '-b', 'anders')
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
    spy.mockRestore()
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('hq_write_wrong_branch')
    expect(fs.readFileSync(path.join(write, CONFIG_REL), 'utf-8')).toBe(
      fixture.CONFIG_YAML
    )
  })

  it('GET /config: a worktree off app/edits (or no repo) is not writable', async () => {
    git(write, 'checkout', '-q', '-b', 'anders')
    // a fresh app: the branch check is cached for a few seconds per writer
    let cfg = await as(a, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data).toMatchObject({
      writable: false,
      writeIssue: {
        error: 'hq_write_wrong_branch',
        message: expect.stringContaining('app/edits'),
      },
    })
    const plain = tempDir('bz-plain-')
    writeHq(plain)
    const b = app({
      backzettel: { hqDir: read, cacheMs: 0 },
      hqProducts: { productsDir: path.join(read, 'products'), writeDir: plain },
    })
    cfg = await as(b, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data).toMatchObject({
      writable: false,
      writeIssue: { error: 'hq_write_unavailable' },
    })
  })

  it('a foreign validation error keeps the grid: working.config + errors, saves still work', async () => {
    const broken = fixture.CONFIG_YAML.replace(
      'products: [{ id: musterweck, factor: 1 }]',
      'products: [{ id: geloeschtes-produkt, factor: 1 }]'
    )
    expect(broken).not.toBe(fixture.CONFIG_YAML)
    fs.writeFileSync(path.join(write, CONFIG_REL), broken)
    git(write, 'commit', '-q', '-am', 'produkt weg')
    let cfg = await as(a, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data.working.status).toBe('no-config')
    expect(cfg.body.data.working.errors).toEqual([
      expect.objectContaining({ path: expect.stringContaining('items[1]') }),
    ])
    expect(workingBase(cfg.body.data, 'musterweck')[2]).toBe(40)
    const res = await put({ itemId: 'musterweck', weekday: 2, value: 42 })
    expect(res.status).toBe(200)
    expect(workingBase(res.body.data, 'musterweck')[2]).toBe(42)
    // dev mode reads the read clone directly - same rule there
    fs.writeFileSync(path.join(read, CONFIG_REL), broken)
    const dev = app({
      backzettel: { hqDir: read, cacheMs: 0 },
      hqProducts: { productsDir: path.join(read, 'products'), writeDir: null },
    })
    cfg = await as(dev, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data).toMatchObject({
      status: 'no-config',
      writable: true,
      writeIssue: null,
      working: { status: 'no-config' },
    })
    expect(workingBase(cfg.body.data, 'kornbrot')[2]).toBe(4)
  })

  it('a failing commit restores the file and answers 500', async () => {
    const hook = path.join(write, '.git', 'hooks', 'pre-commit')
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    const err = console.error
    console.error = () => undefined
    try {
      const res = await put({ itemId: 'kornbrot', weekday: 6, value: 2 })
      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({
        error: 'hq_commit_failed',
        message: expect.any(String),
      })
    } finally {
      console.error = err
    }
    expect(fs.readFileSync(path.join(write, CONFIG_REL), 'utf-8')).toBe(
      fixture.CONFIG_YAML
    )
    expect(git(write, 'status', '--porcelain')).toBe('')
  })

  it('parallel saves of different cells all land, one commit each', async () => {
    const results = await Promise.all([
      put({ itemId: 'kornbrot', weekday: 6, value: 2 }),
      put({ itemId: 'musterweck', weekday: 5, value: 45 }),
      put({ itemId: 'plunder', weekday: 7, value: 3 }),
      put({ itemId: 'zopf-gefuellt', weekday: 6, variants: { mohn: 1 } }),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect(git(write, 'rev-list', '--count', 'HEAD')).toBe('5')
    const text = fs.readFileSync(path.join(write, CONFIG_REL), 'utf-8')
    expect(text).toContain('6: 2 } # OFFEN: Samstag')
    expect(text).toContain('      5: 45\n')
    expect(text).toContain('base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 0, 7: 3 }')
    expect(text).toContain('base: { 6: { nuss: 4, mohn: 1 } }')
  })
})

// ------------------------------------------------- rolling PR (B5b) + merge

describe('B5b: Grundmengen go to the rolling PR', () => {
  it('push to app/edits, one PR, "wartet auf Freigabe" until merged into main', async () => {
    const remote = makeHqRemote(fixture.PRODUCT_FILES)
    pushForeign(remote, { [CONFIG_REL]: fixture.CONFIG_YAML }, 'config')
    git(remote.read, 'pull', '-q', 'origin', 'main')
    const edits = new HqEditsSync({
      writeDir: remote.write,
      token: 'test-token',
      githubRepo: 'Test-Org/hq',
      githubApiUrl: github.url,
      log: QUIET,
    })
    const a = app({
      backzettel: { hqDir: remote.read, cacheMs: 0 },
      hqProducts: {
        productsDir: path.join(remote.read, 'products'),
        writeDir: remote.write,
      },
      hqSync: { edits },
    })
    await edits.sync() // fast-forward the write clone onto main (with the YAML)
    expect(fs.existsSync(path.join(remote.write, CONFIG_REL))).toBe(true)

    const res = await as(a, 'backstube').put('/api/backzettel/config/base', {
      itemId: 'plunder',
      weekday: 6,
      value: 4,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.pendingApproval).toBe(true)
    const status = await edits.sync()
    expect(status.lastError).toBeNull()
    expect(originFile(remote, 'app/edits', CONFIG_REL)).toContain(
      'base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 4 }'
    )
    expect(github.pulls.filter((p) => p.state === 'open')).toHaveLength(1)
    expect(github.pulls[0].body).toContain(CONFIG_REL)

    // H2 merges; the read clone has not pulled yet - still "approved"
    // because pendingApproval is measured against origin/main
    mergeEdits(remote)
    await edits.sync()
    const cfg = await as(a, 'backstube').get('/api/backzettel/config')
    expect(cfg.body.data.pendingApproval).toBe(false)
    expect(workingBase(cfg.body.data, 'plunder')[6]).toBe(4)
  })
})

// ----------------------------------------------------------- reference

describe('GET /reference', () => {
  let hqDir: string
  let reportsDir: string
  let a: Application

  function day(date: string, transactions: unknown[]): void {
    fs.writeFileSync(
      path.join(reportsDir, 'converted', `${date}_90000001.json`),
      JSON.stringify(fixture.convertedReport(date, transactions))
    )
  }

  beforeAll(() => {
    hqDir = tempDir('bz-ref-hq-')
    writeHq(hqDir)
    reportsDir = tempDir('bz-ref-reports-')
    fs.mkdirSync(path.join(reportsDir, 'converted'))
    day('2026-11-28', [
      {
        items: [
          [903, 50],
          [905, 6],
        ],
      },
      { type: 'storno', items: [[903, -2]] },
    ])
    day('2026-11-21', [{ items: [[903, 60]] }])
    // 14.11. missing: a gap, not zero
    day('2026-11-07', [
      {
        items: [
          [903, 70],
          [905, 2],
        ],
      },
    ])
    day('2026-11-24', [{ items: [[903, 30]] }])
    // today (Mi 02.12.) is never counted, even with a report
    day('2026-12-02', [{ items: [[903, 999]] }])
    day('2026-11-25', [{ items: [[903, 20]] }])
    a = app({
      backzettel: { hqDir, cacheMs: 0 },
      hqProducts: { productsDir: path.join(hqDir, 'products'), writeDir: null },
      hq: { reportsDir },
    })
  })

  it('inhaber and backstube only', async () => {
    expect((await request(a).get('/api/backzettel/reference')).status).toBe(401)
    expect(
      (await as(a, 'verkauf').get('/api/backzettel/reference')).status
    ).toBe(403)
    expect(
      (await as(a, 'fahrer').get('/api/backzettel/reference')).status
    ).toBe(403)
    expect(
      (await as(a, 'inhaber').get('/api/backzettel/reference')).status
    ).toBe(200)
  })

  it('median per item over the last same weekdays with a report', async () => {
    const res = await as(a, 'backstube').get(
      '/api/backzettel/reference?weekday=6&weeks=6'
    )
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d).toMatchObject({
      status: 'ok',
      available: true,
      today: '2026-12-02',
      weeks: 6,
    })
    expect(d.weekdays).toHaveLength(1)
    const sat = d.weekdays[0]
    expect(sat).toMatchObject({ weekday: 6, weekdayName: 'Samstag' })
    expect(sat.dates).toEqual(['2026-11-28', '2026-11-21', '2026-11-07'])
    expect(sat.skippedDates).toContain('2026-11-14')
    const item = (id: string) => sat.items.find((i: any) => i.itemId === id)
    expect(item('musterweck')).toMatchObject({
      median: 60,
      samples: [48, 60, 70],
    })
    expect(item('zopf-gefuellt')).toMatchObject({
      median: 2,
      samples: [6, 0, 2],
    })
    expect(item('plunder')).toMatchObject({ status: 'no_plu', median: null })
  })

  it('without weekday: every production day; today is never counted', async () => {
    const res = await as(a, 'backstube').get('/api/backzettel/reference')
    const days = res.body.data.weekdays
    expect(days.map((w: any) => w.weekday)).toEqual([2, 3, 4, 5, 6, 7])
    const wed = days.find((w: any) => w.weekday === 3)
    expect(wed.dates).toEqual(['2026-11-25'])
    expect(wed.items.find((i: any) => i.itemId === 'musterweck').median).toBe(
      20
    )
  })

  it('bad parameters → 400', async () => {
    const weeks = await as(a, 'backstube').get(
      '/api/backzettel/reference?weeks=0'
    )
    expect(weeks.status).toBe(400)
    expect(weeks.body).toMatchObject({
      error: 'validation',
      message: expect.any(String),
    })
    const wd = await as(a, 'backstube').get(
      '/api/backzettel/reference?weekday=9'
    )
    expect(wd.status).toBe(400)
    expect(wd.body.error).toBe('invalid_weekday')
  })

  it('without reports: available false, no numbers; without config: no-config', async () => {
    const noReports = app({
      backzettel: { hqDir, cacheMs: 0 },
      hqProducts: { productsDir: path.join(hqDir, 'products'), writeDir: null },
      hq: { reportsDir: path.join(hqDir, 'nirgends') },
    })
    const res = await as(noReports, 'backstube').get(
      '/api/backzettel/reference?weekday=6'
    )
    expect(res.body.data.available).toBe(false)
    expect(
      res.body.data.weekdays[0].items.every((i: any) => i.median === null)
    ).toBe(true)

    const empty = tempDir('bz-ref-empty-')
    writeHq(empty, null)
    const noConfig = app({
      backzettel: { hqDir: empty, cacheMs: 0 },
      hqProducts: { productsDir: path.join(empty, 'products'), writeDir: null },
      hq: { reportsDir },
    })
    const nc = await as(noConfig, 'backstube').get('/api/backzettel/reference')
    expect(nc.status).toBe(200)
    expect(nc.body.data).toMatchObject({ status: 'no-config', weekdays: [] })
  })

  it('"reference" is never read as a date by GET /:date', async () => {
    const res = await as(a, 'backstube').get('/api/backzettel/reference')
    expect(res.body.data.status).toBe('ok')
  })
})
