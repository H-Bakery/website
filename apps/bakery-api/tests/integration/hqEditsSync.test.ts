/**
 * B5b against `createApp()`: a product save commits in the `app/edits`
 * worktree, the sync rebases onto `origin/main`, pushes with lease and keeps
 * exactly one PR open - against a temp bare repo as origin and a local fake
 * of the GitHub pulls API (never the real GitHub). Synthetic products only.
 */
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import type { Application } from 'express'

import { createApp } from '../../src/app'
import { HqEditsSync } from '../../src/services/hq-edits-sync.service'
import { HqGit, runHqGit } from '../../src/services/hq-git'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { git, removeTempDirs } from '../helpers/hqProducts'
import {
  FakeGitHub,
  HqRemote,
  makeHqRemote,
  mergeEdits,
  originFile,
  pushForeign,
  startFakeGitHub,
  takeOffline,
} from '../helpers/hqRemote'

jest.setTimeout(60000)

const REPO = 'Test-Org/hq'
const QUIET = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
const KORNBROT = '1-kornbrot-500g.md'
const WECK = '13-musterweck.md'

let api: TestApp
let owner: Record<string, string>
let github: FakeGitHub

beforeAll(async () => {
  api = await createTestApp()
  await createUser({
    username: 'test.erika',
    role: 'inhaber',
    displayName: 'Erika Test',
  })
  owner = bearer((await login(api.app, 'test.erika')).token)
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

interface Setup {
  remote: HqRemote
  edits: HqEditsSync
  app: Application
}

function setup(options: { token?: string | null; git?: HqGit } = {}): Setup {
  const remote = makeHqRemote()
  const edits = new HqEditsSync({
    writeDir: remote.write,
    token: options.token === undefined ? 'test-token' : options.token,
    githubRepo: REPO,
    githubApiUrl: github.url,
    git: options.git,
    log: QUIET,
  })
  const app = createApp({
    logRequests: false,
    sequelize: api.sequelize,
    hqProducts: {
      productsDir: path.join(remote.read, 'products'),
      writeDir: remote.write,
    },
    hqSync: { edits },
  })
  return { remote, edits, app }
}

const put = (app: Application, file: string, body: Record<string, unknown>) =>
  request(app)
    .put(`/api/hq-products/${file.replace(/^\d+-/, '').replace(/\.md$/, '')}`)
    .set(owner)
    .send(body)

const status = async (app: Application) =>
  (await request(app).get('/api/hq-sync/status').set(owner)).body.data

describe('access and disabled state', () => {
  it('status is inhaber only (401 without, 403 for verkauf)', async () => {
    const { app } = setup()
    expect((await request(app).get('/api/hq-sync/status')).status).toBe(401)
    const seller = bearer(await sessionFor(api.app, 'test.verkauf', 'verkauf'))
    const res = await request(app).get('/api/hq-sync/status').set(seller)
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({
      error: 'forbidden',
      message: expect.any(String),
    })
  })

  it('without a token the sync is off and says why; saves still commit locally', async () => {
    const { app, remote } = setup({ token: null })
    expect(await status(app)).toMatchObject({
      enabled: false,
      reason: expect.stringContaining('HQ_GITHUB_TOKEN'),
      pendingCommits: 0,
      prUrl: null,
      snapshots: {
        enabled: false,
        reason: expect.stringContaining('HQ_SNAPSHOT_DIR'),
      },
    })
    expect((await put(app, KORNBROT, { price: 3.33 })).status).toBe(200)
    expect(git(remote.write, 'log', '-1', '--format=%s')).toMatch(/^products: /)
    expect(originFile(remote, 'app/edits', `products/${KORNBROT}`)).toBeNull()
    expect(github.requests).toHaveLength(0)
  })

  it('without HQ_WRITE_DIR (createApp default) it is off', async () => {
    const res = await request(api.app).get('/api/hq-sync/status').set(owner)
    expect(res.body.data).toMatchObject({
      enabled: false,
      reason: expect.stringContaining('HQ_WRITE_DIR'),
    })
  })
})

describe('push and the one rolling PR', () => {
  it('a save is pushed to app/edits and opens one PR; a second save only pushes', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    expect((await put(app, KORNBROT, { price: 4.44 })).status).toBe(200)
    let s = await edits.sync() // coalesces with the sync the save started
    expect(s).toMatchObject({
      enabled: true,
      pendingCommits: 0,
      unmergedCommits: 1,
      lastError: null,
      prUrl: `https://github.example/${REPO}/pull/1`,
      mergedSince: null,
    })
    expect(s.lastPushAt).toEqual(expect.any(String))
    expect(originFile(remote, 'app/edits', `products/${KORNBROT}`)).toContain(
      'price: 4.44'
    )
    // committed as the app, editor as co-author
    expect(git(remote.bare, 'log', '-1', '--format=%an|%cn', 'app/edits')).toBe(
      'Verwaltung (App)|Verwaltung (App)'
    )
    expect(github.pulls).toHaveLength(1)
    const pr = github.pulls[0]
    expect(pr).toMatchObject({
      title: 'Stammdaten aus der Verwaltung',
      head: 'app/edits',
      base: 'main',
    })
    expect(pr.body).toContain(`\`products/${KORNBROT}\``)
    expect(pr.body).toContain('**Bearbeitet von:** Erika Test')
    expect(pr.body).not.toContain('@bakery.local')
    expect(github.requests.every((r) => r.auth === 'Bearer test-token')).toBe(
      true
    )

    expect((await put(app, WECK, { price: 0.99 })).status).toBe(200)
    s = await edits.sync()
    expect(s.unmergedCommits).toBe(2)
    expect(originFile(remote, 'app/edits', `products/${WECK}`)).toContain(
      'price: 0.99'
    )
    expect(github.pulls).toHaveLength(1) // appended, not a second PR
    expect(github.requests.filter((r) => r.method === 'POST')).toHaveLength(1)

    // pending in the management view until merged
    const product = (
      await request(app).get('/api/hq-products/kornbrot-500g').set(owner)
    ).body.data
    expect(product.pendingApproval).toBe(true)
    expect(product.approved.price).not.toBe(4.44)
  })

  it('pendingApproval follows origin/main, not the (stale) read clone; merge is detected', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    await put(app, KORNBROT, { price: 5.55 })
    await edits.sync()
    mergeEdits(remote) // H2 merged the PR; the read clone was not synced yet
    const s = await edits.sync()
    expect(s).toMatchObject({
      unmergedCommits: 0,
      pendingCommits: 0,
      prUrl: null,
      lastError: null,
    })
    expect(s.mergedSince).toEqual(expect.any(String))
    // read clone still has the old price ...
    expect(
      fs.readFileSync(path.join(remote.read, 'products', KORNBROT), 'utf8')
    ).not.toContain('5.55')
    // ... but nothing is "wartet auf Freigabe" any more
    const managed = (
      await request(app).get('/api/hq-products/kornbrot-500g').set(owner)
    ).body.data
    expect(managed).toMatchObject({ price: 5.55, pendingApproval: false })
    expect(managed.approved).toBeUndefined()
    const shop = (await request(app).get('/api/products').set(owner)).body.data
    expect(shop.every((p: any) => p.pendingApproval === false)).toBe(true)
    // the worktree follows main (fast-forward)
    expect(git(remote.write, 'rev-parse', 'HEAD')).toBe(
      git(remote.bare, 'rev-parse', 'main')
    )
  })

  it('a squash merge (same content, other commit) is detected as merged', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    await put(app, KORNBROT, { price: 6.66 })
    await edits.sync()
    const content = originFile(
      remote,
      'app/edits',
      `products/${KORNBROT}`
    ) as string
    pushForeign(
      remote,
      { [`products/${KORNBROT}`]: `${content}\n` },
      'Squash app/edits'
    )
    const s = await edits.sync()
    expect(s).toMatchObject({
      unmergedCommits: 0,
      lastError: null,
      prUrl: null,
    })
    expect(git(remote.write, 'status', '--porcelain')).toBe('')
  })

  it('rebases onto new main commits before pushing', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    await put(app, KORNBROT, { price: 7.77 })
    const foreign = pushForeign(
      remote,
      { 'notes/neu.md': 'Notiz\n' },
      'people write notes'
    )
    const s = await edits.sync()
    expect(s.lastError).toBeNull()
    // app/edits on origin sits on top of the new main commit
    expect(git(remote.bare, 'merge-base', 'main', 'app/edits')).toBe(foreign)
    expect(originFile(remote, 'app/edits', 'notes/neu.md')).toBe('Notiz')
  })

  it('a conflict aborts the rebase, keeps the local commits and records the error', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    await put(app, KORNBROT, { price: 8.88 })
    const before = git(remote.write, 'rev-parse', 'HEAD')
    pushForeign(
      remote,
      {
        [`products/${KORNBROT}`]: '---\nid: kornbrot-500g\nname: Anders\n---\n',
      },
      'conflicting edit'
    )
    const s = await edits.sync()
    expect(s.lastError).toMatchObject({
      code: 'rebase_conflict',
      message: expect.stringContaining('bleiben auf der Box'),
      files: [`products/${KORNBROT}`],
    })
    expect(git(remote.write, 'rev-parse', 'HEAD')).toBe(before)
    expect(git(remote.write, 'status', '--porcelain')).toBe('')
    expect(fs.existsSync(path.join(remote.write, '.git', 'rebase-merge'))).toBe(
      false
    )
    expect(s.unmergedCommits).toBe(1)
    expect(originFile(remote, 'app/edits', `products/${KORNBROT}`)).toBeNull()
    expect(github.pulls).toHaveLength(0)
  })

  it('a rejected lease is fetched, rebased and retried once', async () => {
    let remoteRef: HqRemote | null = null
    let interfered = false
    const sneaky: HqGit = async (cwd, args, options) => {
      if (args[0] === 'push' && !interfered && remoteRef) {
        interfered = true
        // someone pushes app/edits between our fetch and our push
        pushForeign(
          remoteRef,
          { 'notes/x.md': 'x\n' },
          'foreign on app/edits',
          'app/edits'
        )
      }
      return runHqGit(cwd, args, options)
    }
    const { app, edits, remote } = setup({ git: sneaky })
    remoteRef = remote
    await edits.init()
    // first push creates app/edits (no interference: remoteRef set late)
    await put(app, KORNBROT, { price: 1.11 })
    interfered = true
    await edits.sync()
    interfered = false
    await put(app, WECK, { price: 1.22 })
    const s = await edits.sync()
    expect(interfered).toBe(true)
    expect(s.lastError).toBeNull()
    expect(originFile(remote, 'app/edits', `products/${WECK}`)).toContain(
      'price: 1.22'
    )
    expect(git(remote.bare, 'rev-parse', 'app/edits')).toBe(
      git(remote.write, 'rev-parse', 'HEAD')
    )
  })

  it('offline: commits queue, status says so, the retry timer pushes them later', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    const back = takeOffline(remote)
    await put(app, KORNBROT, { price: 2.22 })
    let s = await edits.sync()
    expect(s.lastError).toMatchObject({
      code: 'network',
      message: expect.stringContaining('15 Minuten'),
    })
    expect(s.pendingCommits).toBe(1)
    back()

    const timed = new HqEditsSync({
      writeDir: remote.write,
      token: 'test-token',
      githubRepo: REPO,
      githubApiUrl: github.url,
      retryMs: 100,
      log: QUIET,
    })
    timed.start()
    try {
      const deadline = Date.now() + 15000
      while (
        Date.now() < deadline &&
        originFile(remote, 'app/edits', `products/${KORNBROT}`) === null
      ) {
        await new Promise((r) => setTimeout(r, 100))
      }
    } finally {
      timed.stop()
      await timed.sync()
    }
    expect(originFile(remote, 'app/edits', `products/${KORNBROT}`)).toContain(
      'price: 2.22'
    )
    s = timed.status()
    expect(s).toMatchObject({ pendingCommits: 0, lastError: null })
  })

  it('a failed PR call keeps the push and is retried on the next sync', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    github.failNext(500, 10) // also the coalesced rerun of the save's own sync
    await put(app, KORNBROT, { price: 9.01 })
    let s = await edits.sync()
    expect(s.lastError).toMatchObject({ code: 'github_failed' })
    expect(originFile(remote, 'app/edits', `products/${KORNBROT}`)).toContain(
      '9.01'
    )
    expect(github.pulls).toHaveLength(0)
    github.failNext(500, 0) // GitHub is back
    s = (await request(app).post('/api/hq-sync/retry').set(owner)).body.data
    expect(s).toMatchObject({
      lastError: null,
      prUrl: expect.stringContaining('/pull/1'),
    })
    expect(github.pulls).toHaveLength(1)
  })

  it('parallel saves and syncs are serialised (no index.lock race, nothing lost)', async () => {
    const { app, edits, remote } = setup()
    await edits.init()
    const prices = [1.01, 1.02, 1.03, 1.04, 1.05]
    const files = [
      '1-kornbrot-500g.md',
      '2-kornbrot-1000g.md',
      '13-musterweck.md',
      '15-mustersemmel.md',
      '21-musterbaguette-klein.md',
    ]
    const results = await Promise.all([
      ...files.map((f, i) => put(app, f, { price: prices[i] })),
      edits.sync(),
      edits.sync(),
    ])
    for (const r of results.slice(0, files.length))
      expect((r as any).status).toBe(200)
    const s = await edits.sync()
    expect(s).toMatchObject({
      lastError: null,
      pendingCommits: 0,
      unmergedCommits: 5,
    })
    files.forEach((f, i) =>
      expect(originFile(remote, 'app/edits', `products/${f}`)).toContain(
        `price: ${prices[i]}`
      )
    )
    expect(github.pulls).toHaveLength(1)
    expect(
      fs.existsSync(path.join(remote.write, '.git', 'bakery-app.lock'))
    ).toBe(false)
  })

  it('a worktree on the wrong branch is recorded, nothing is pushed', async () => {
    const { edits, remote } = setup()
    git(remote.write, 'checkout', '-q', '-b', 'irgendwas')
    const s = await edits.sync()
    expect(s.lastError).toMatchObject({ code: 'wrong_branch' })
    expect(git(remote.bare, 'branch', '--list', 'app/edits')).toBe('')
  })
})
