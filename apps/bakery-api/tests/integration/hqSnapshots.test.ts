/**
 * Z9 against `createApp()`: a Backzettel confirm writes
 * `data/production/backzettel/<date>.{json,md}` into the snapshot worktree
 * (on `main`), commits only `data/production/**` and pushes to a temp bare
 * origin - with pull --rebase + one retry, an offline queue and a recorded
 * conflict. Synthetic master data (tests/fixtures), synthetic people.
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { Preorder, PreorderItem, RestCount, User } from '../../src/models'
import { createGitHubTokenProvider } from '../../src/services/github-token'
import {
  commonGitDir,
  HqGit,
  NETWORK_LOCK_FILE,
  runHqGit,
} from '../../src/services/hq-git'
import { HqSnapshotWriter } from '../../src/services/hq-snapshots.service'
import { bearer, createUser, login } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { git, removeTempDirs } from '../helpers/hqProducts'
import {
  HqRemote,
  makeHqRemote,
  originFile,
  pushForeign,
  takeOffline,
} from '../helpers/hqRemote'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

jest.setTimeout(60000)

const QUIET = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
// Tue-Sun production days (Monday 2026-11-23 is Ruhetag in the fixture)
const TUE = '2026-11-24'
/** "Today" for the planning window - the fixed dates above stay inside it. */
const PINNED_NOW = new Date('2026-11-20T09:00:00Z')
const WED = '2026-11-25'
const THU = '2026-11-26'
const FRI = '2026-11-27'
const SAT = '2026-11-28'
const SUN = '2026-11-29'
const TUE2 = '2026-12-01'

let api: TestApp
let hqDir: string
let remote: HqRemote
let writer: HqSnapshotWriter
let baker: Record<string, string>

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
      }\navailable: ${p.available !== false}\n---\n\nText\n`
    )
  }
  fs.writeFileSync(
    path.join(dir, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.config(), null, 2)
  )
}

const rel = (date: string, ext: 'json' | 'md') =>
  `data/production/backzettel/${date}.${ext}`
const confirm = (date: string) =>
  request(api.app).post(`/api/backzettel/${date}/confirm`).set(baker)

beforeAll(async () => {
  hqDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z9-hq-'))
  writeHq(hqDir)
  remote = makeHqRemote()
  writer = new HqSnapshotWriter({ snapshotDir: remote.snapshot, log: QUIET })
  api = await createTestApp({
    seedPartners: true,
    app: {
      backzettel: { hqDir, cacheMs: 0, now: () => PINNED_NOW },
      hqSync: { snapshots: writer },
    },
  })
  await createUser({
    username: 'test.geheim',
    role: 'backstube',
    displayName: 'Erika Geheim',
  })
  baker = bearer((await login(api.app, 'test.geheim')).token)

  // A preorder with a customer name that must never reach hq.
  const p = await Preorder.create({
    code: `LA-${SAT}-01`,
    channel: 'telefon',
    customerName: 'Frau Beispielkundin',
    customerPhone: '0170 1234567',
    note: 'ruft vorher an',
    pickupDate: SAT,
    status: 'offen',
  })
  await PreorderItem.create({
    preorderId: p.id,
    productId: 'test-weck',
    productName: 'Test test-weck',
    unitPrice: 1,
    quantity: 6,
    variant: '',
  })
})

afterAll(async () => {
  await writer.idle()
  await api.close()
  fs.rmSync(hqDir, { recursive: true, force: true })
  removeTempDirs()
})

describe('Backzettel confirm → hq', () => {
  it('writes json + md, commits only data/production as the app and pushes to main', async () => {
    // someone else's work staged in the same worktree must stay out
    fs.writeFileSync(
      path.join(remote.snapshot, 'fremd.txt'),
      'nicht von der App\n'
    )
    git(remote.snapshot, 'add', 'fremd.txt')

    const res = await confirm(SAT)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('confirmed')
    await writer.idle()

    const json = JSON.parse(
      originFile(remote, 'main', rel(SAT, 'json')) as string
    )
    expect(json).toMatchObject({
      schema_version: 1,
      kind: 'backzettel',
      date: SAT,
      weekdayName: 'Samstag',
      confirmed: { role: 'backstube' },
    })
    const weck = json.sections
      .flatMap((s: any) => s.lines)
      .find((l: any) => l.itemId === 'weck')
    expect(weck.preorders).toBe(6)
    expect(json.hefeteig.doughs.length).toBeGreaterThan(0)

    const md = originFile(remote, 'main', rel(SAT, 'md')) as string
    expect(md).toMatch(/^# Backzettel Samstag, 28\.11\.2026/)
    expect(md).toContain('Freigegeben (Backstube) am')
    expect(md).toContain('## Hefeteig')

    for (const text of [JSON.stringify(json), md]) {
      for (const secret of [
        'Erika Geheim',
        'test.geheim',
        'Beispielkundin',
        '0170',
        'ruft vorher an',
        `LA-${SAT}`,
      ]) {
        expect(text).not.toContain(secret)
      }
    }

    expect(
      git(remote.bare, 'log', '-1', '--format=%s|%an <%ae>|%cn', 'main')
    ).toBe(
      `chore(production): Backzettel ${SAT} (App)|Verwaltung (App) <verwaltung@bakery.local>|Verwaltung (App)`
    )
    expect(
      git(remote.bare, 'show', '--name-only', '--format=', 'main')
        .split('\n')
        .sort()
    ).toEqual([rel(SAT, 'json'), rel(SAT, 'md')])
    // the foreign file is still staged, not committed, not pushed
    expect(git(remote.snapshot, 'status', '--porcelain')).toBe('A  fremd.txt')
    expect(originFile(remote, 'main', 'fremd.txt')).toBeNull()
    expect(writer.status()).toMatchObject({
      pendingCommits: 0,
      lastError: null,
    })
    git(remote.snapshot, 'rm', '-q', '--cached', 'fremd.txt')
    fs.rmSync(path.join(remote.snapshot, 'fremd.txt'))
  })

  it('a rejected push gets pull --rebase and one retry (a staged foreign file survives it)', async () => {
    fs.writeFileSync(
      path.join(remote.snapshot, 'fremd.txt'),
      'nicht von der App\n'
    )
    git(remote.snapshot, 'add', 'fremd.txt')
    pushForeign(
      remote,
      { 'data/reports/converted/2026-11-24_test.json': '{}\n' },
      'pipeline report'
    )
    expect((await confirm(TUE)).status).toBe(200)
    await writer.idle()
    expect(originFile(remote, 'main', rel(TUE, 'json'))).not.toBeNull()
    expect(
      originFile(remote, 'main', 'data/reports/converted/2026-11-24_test.json')
    ).toBe('{}')
    expect(git(remote.bare, 'log', '-1', '--format=%s', 'main')).toBe(
      `chore(production): Backzettel ${TUE} (App)`
    )
    expect(writer.status()).toMatchObject({
      pendingCommits: 0,
      lastError: null,
    })
    expect(originFile(remote, 'main', 'fremd.txt')).toBeNull()
    expect(
      fs.readFileSync(path.join(remote.snapshot, 'fremd.txt'), 'utf8')
    ).toBe('nicht von der App\n')
    git(remote.snapshot, 'rm', '-q', '--cached', 'fremd.txt')
    fs.rmSync(path.join(remote.snapshot, 'fremd.txt'))
  })

  it('offline: the commit stays queued, the status says so, retry pushes it', async () => {
    const back = takeOffline(remote)
    try {
      expect((await confirm(WED)).status).toBe(200) // the confirm itself never waits for hq
      await writer.idle()
      expect(writer.status()).toMatchObject({
        pendingCommits: 1,
        lastError: {
          code: 'network',
          message: expect.stringContaining('15 Minuten'),
        },
      })
      expect(git(remote.snapshot, 'log', '-1', '--format=%s')).toBe(
        `chore(production): Backzettel ${WED} (App)`
      )
    } finally {
      back()
    }
    const owner = await createUser({ username: 'test.chef', role: 'inhaber' })
    const ownerToken = bearer((await login(api.app, owner.username)).token)
    const status = (
      await request(api.app).get('/api/hq-sync/status').set(ownerToken)
    ).body.data
    expect(status.snapshots).toMatchObject({ enabled: true, pendingCommits: 1 })
    const after = (
      await request(api.app).post('/api/hq-sync/retry').set(ownerToken)
    ).body.data
    expect(after.snapshots).toMatchObject({
      pendingCommits: 0,
      lastError: null,
    })
    expect(originFile(remote, 'main', rel(WED, 'md'))).not.toBeNull()
  })

  it('parallel confirms and a preorder snapshot: all committed and pushed, no lock race', async () => {
    const results = await Promise.all([
      confirm(THU),
      confirm(FRI),
      confirm(SUN),
      writer.writePreorders({
        date: SAT,
        sums: [],
        pickupPoints: [],
        preorders: [],
      }),
    ])
    for (const r of results.slice(0, 3)) expect((r as any).status).toBe(200)
    await writer.idle()
    for (const d of [THU, FRI, SUN]) {
      expect(originFile(remote, 'main', rel(d, 'json'))).not.toBeNull()
    }
    expect(
      originFile(remote, 'main', `data/production/vorbestellungen/${SAT}.json`)
    ).not.toBeNull()
    expect(writer.status()).toMatchObject({
      pendingCommits: 0,
      lastError: null,
    })
    expect(git(remote.snapshot, 'status', '--porcelain')).toBe('')
  })

  it('writing the same confirmed day again makes no commit', async () => {
    const before = git(remote.bare, 'rev-list', '--count', 'main')
    const outcome = await writer.writeBackzettel(
      JSON.parse(
        JSON.stringify(
          (
            await request(api.app).get(`/api/backzettel/${THU}`).set(baker)
          ).body.data
        )
      ),
      'backstube'
    )
    expect(outcome).toMatchObject({
      committed: false,
      pushed: true,
      error: null,
    })
    expect(git(remote.bare, 'rev-list', '--count', 'main')).toBe(before)
  })

  it('a conflict on the same snapshot file is recorded and the local commit kept', async () => {
    pushForeign(
      remote,
      { [rel(TUE2, 'json')]: '{"von":"jemand anders"}\n' },
      'hand edit'
    )
    expect((await confirm(TUE2)).status).toBe(200)
    await writer.idle()
    expect(writer.status()).toMatchObject({
      pendingCommits: 1,
      lastError: { code: 'rebase_conflict', files: [rel(TUE2, 'json')] },
    })
    expect(git(remote.snapshot, 'log', '-1', '--format=%s')).toBe(
      `chore(production): Backzettel ${TUE2} (App)`
    )
    expect(git(remote.snapshot, 'status', '--porcelain')).toBe('')
    expect(originFile(remote, 'main', rel(TUE2, 'json'))).toBe(
      '{"von":"jemand anders"}'
    )
  })

  it('a snapshot worktree off main is refused and recorded', async () => {
    const other = new HqSnapshotWriter({
      snapshotDir: remote.write,
      log: QUIET,
    }) // app/edits
    const outcome = await other.writePreorders({
      date: SAT,
      sums: [],
      pickupPoints: [],
      preorders: [],
    })
    expect(outcome).toMatchObject({
      committed: false,
      pushed: false,
      error: { code: 'wrong_branch' },
    })
    expect(fs.existsSync(path.join(remote.write, 'data', 'production'))).toBe(
      false
    )
  })
})

describe('reopen and locks', () => {
  it('a reopen replaces the day in hq with a "wieder geöffnet" note (role only)', async () => {
    // clear the conflict left by the test above
    git(remote.snapshot, 'fetch', '-q', 'origin')
    git(remote.snapshot, 'reset', '-q', '--hard', 'origin/main')
    await writer.retry()
    await createUser({
      username: 'test.chefin',
      role: 'inhaber',
      displayName: 'Erika Chefin',
    })
    const chefin = bearer((await login(api.app, 'test.chefin')).token)
    const res = await request(api.app)
      .post(`/api/backzettel/${SAT}/reopen`)
      .set(chefin)
      .send({ reason: 'Frau Beispielkundin hat angerufen' })
    expect(res.status).toBe(200)
    await writer.idle()
    const json = JSON.parse(
      originFile(remote, 'main', rel(SAT, 'json')) as string
    )
    expect(json).toMatchObject({
      kind: 'backzettel',
      status: 'reopened',
      date: SAT,
      reopened: { role: 'inhaber' },
    })
    expect(json.sections).toBeUndefined()
    const md = originFile(remote, 'main', rel(SAT, 'md')) as string
    expect(md).toContain('wieder geöffnet')
    expect(md).not.toContain('Freigegeben')
    for (const text of [JSON.stringify(json), md]) {
      expect(text).not.toContain('Chefin')
      expect(text).not.toContain('Beispielkundin')
    }
    expect(git(remote.bare, 'log', '-1', '--format=%s', 'main')).toBe(
      `chore(production): Backzettel ${SAT} wieder geöffnet (App)`
    )
    // confirming again writes the full Backzettel back
    expect((await confirm(SAT)).status).toBe(200)
    await writer.idle()
    expect(
      JSON.parse(originFile(remote, 'main', rel(SAT, 'json')) as string)
    ).toMatchObject({ status: 'confirmed', confirmed: { role: 'backstube' } })
  })

  it('another process pushing (network lock held): the snapshot is still written and committed, the push waits for the retry', async () => {
    const fresh = makeHqRemote()
    const w = new HqSnapshotWriter({
      snapshotDir: fresh.snapshot,
      networkLockWaitMs: 300,
      log: QUIET,
    })
    const lock = path.join(
      commonGitDir(fresh.snapshot) as string,
      NETWORK_LOCK_FILE
    )
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'])
    try {
      fs.writeFileSync(lock, `${child.pid} ${Date.now()}\n`)
      const t0 = Date.now()
      const outcome = await w.writePreorders({
        date: SAT,
        sums: [],
        pickupPoints: [],
        preorders: [],
      })
      expect(Date.now() - t0).toBeLessThan(5000)
      expect(outcome).toMatchObject({
        written: true,
        committed: true,
        pushed: false,
        error: { code: 'repo_locked' },
      })
      expect(git(fresh.snapshot, 'log', '-1', '--format=%s')).toBe(
        `chore(production): Vorbestellungen ${SAT} (App)`
      )
      expect(
        originFile(fresh, 'main', `data/production/vorbestellungen/${SAT}.json`)
      ).toBeNull()
      expect(w.status()).toMatchObject({ pendingCommits: 1 })
    } finally {
      child.kill('SIGKILL')
      fs.rmSync(lock, { force: true })
    }
    const later = await w.retry()
    expect(later).toMatchObject({ pushed: true, error: null })
    expect(
      originFile(fresh, 'main', `data/production/vorbestellungen/${SAT}.json`)
    ).not.toBeNull()
  })
})

describe('Rest am Abend → hq (M4)', () => {
  it('writes data/production/rest/<date>.json - figures only, no names, no times - and commits once', async () => {
    const fresh = makeHqRemote()
    const w = new HqSnapshotWriter({ snapshotDir: fresh.snapshot, log: QUIET })
    const counter = await User.findOne({ where: { username: 'test.geheim' } })
    await RestCount.create({
      businessDate: TUE2,
      itemId: 'weck',
      variant: '',
      productId: 'test-weck',
      name: 'Test test-weck',
      itemName: 'Weck',
      unit: 'Stück',
      itemUnit: 'Stück',
      factor: 1,
      qty: 4,
      countedBy: counter!.id,
    })
    const view = await request(api.app).get(`/api/rest?date=${TUE2}`).set(baker)
    expect(view.status).toBe(200)
    const outcome = await w.writeRest(view.body.data)
    expect(outcome).toMatchObject({
      committed: true,
      pushed: true,
      error: null,
    })
    const file = originFile(fresh, 'main', `data/production/rest/${TUE2}.json`)
    expect(file).not.toBeNull()
    const json = JSON.parse(file as string)
    expect(json).toMatchObject({ kind: 'rest', date: TUE2 })
    expect(json.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemId: 'weck' })])
    )
    expect(file).not.toContain('Geheim')
    expect(file).not.toContain('test.geheim')
    expect(file).not.toMatch(/countedAt|countedBy|T\d{2}:\d{2}/)
    expect(git(fresh.bare, 'log', '-1', '--format=%s', 'main')).toBe(
      `chore(production): Rest am Abend ${TUE2} (App)`
    )
    expect(
      git(fresh.bare, 'show', '--name-only', '--format=', 'main').trim()
    ).toBe(`data/production/rest/${TUE2}.json`)
    // The same numbers again: nothing to commit.
    const before = git(fresh.bare, 'rev-list', '--count', 'main')
    expect(await w.writeRest(view.body.data)).toMatchObject({
      committed: false,
      pushed: true,
      error: null,
    })
    expect(git(fresh.bare, 'rev-list', '--count', 'main')).toBe(before)
    await w.idle()
  })
})

describe('GitHub App token file (HQ_GITHUB_TOKEN_FILE, Q3)', () => {
  it('every push reads the token file anew; a missing file pushes without a token', async () => {
    const fresh = makeHqRemote()
    const tokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'z9-hq-token-'))
    const file = path.join(tokenDir, 'hq-token')
    const pushed: (string | null | undefined)[] = []
    const recording: HqGit = (cwd, args, options) => {
      if (args[0] === 'push') pushed.push(options?.token)
      return runHqGit(cwd, args, options)
    }
    const w = new HqSnapshotWriter({
      snapshotDir: fresh.snapshot,
      tokenProvider: createGitHubTokenProvider({ tokenFile: file }),
      git: recording,
      log: QUIET,
    })
    const commitLocal = (name: string) => {
      const rel = `data/production/test/${name}.json`
      fs.mkdirSync(path.join(fresh.snapshot, 'data/production/test'), {
        recursive: true,
      })
      fs.writeFileSync(path.join(fresh.snapshot, rel), '{}\n')
      git(fresh.snapshot, 'add', rel)
      git(fresh.snapshot, 'commit', '-q', '-m', name)
    }
    try {
      commitLocal('a')
      expect(await w.retry()).toMatchObject({ pushed: true, error: null })
      fs.writeFileSync(file, 'ghs_snapshot_one\n')
      commitLocal('b')
      expect(await w.retry()).toMatchObject({ pushed: true, error: null })
      fs.writeFileSync(`${file}.tmp`, 'ghs_snapshot_two\n')
      fs.renameSync(`${file}.tmp`, file)
      commitLocal('c')
      expect(await w.retry()).toMatchObject({ pushed: true, error: null })
      expect(pushed).toEqual([null, 'ghs_snapshot_one', 'ghs_snapshot_two'])
      expect(JSON.stringify(w.status())).not.toContain('ghs_snapshot')
    } finally {
      fs.rmSync(tokenDir, { recursive: true, force: true })
    }
  })
})
