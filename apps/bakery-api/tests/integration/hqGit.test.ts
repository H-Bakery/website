/**
 * `hq-git.ts`: one queue per repository (shared by its worktrees), the
 * cross-process lock file, timeouts and error codes, blob reading.
 * Temp repos only.
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import {
  blobId,
  commonGitDir,
  HqGitError,
  LOCK_FILE,
  NETWORK_LOCK_FILE,
  readBlobs,
  removeLockIfUnchanged,
  runHqGit,
  withNetworkLock,
  withRepoLock,
} from '../../src/services/hq-git'
import { git, removeTempDirs, tempDir } from '../helpers/hqProducts'
import { makeHqRemote } from '../helpers/hqRemote'

jest.setTimeout(30000)

afterAll(() => removeTempDirs())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('withRepoLock', () => {
  it('serialises jobs on a repo and its linked worktree; other repos run alongside', async () => {
    const a = makeHqRemote()
    const b = makeHqRemote()
    expect(commonGitDir(a.snapshot)).toBe(commonGitDir(a.write))
    const log: string[] = []
    const job = (name: string, ms: number) => async () => {
      log.push(`${name}+`)
      await sleep(ms)
      log.push(`${name}-`)
    }
    await Promise.all([
      withRepoLock(a.write, job('a1', 80)),
      withRepoLock(a.snapshot, job('a2', 10)),
      withRepoLock(b.write, job('b1', 10)),
    ])
    expect(log.indexOf('a1-')).toBeLessThan(log.indexOf('a2+'))
    // b ran while a1 held its lock
    expect(log.indexOf('b1+')).toBeLessThan(log.indexOf('a1-'))
    expect(
      fs.existsSync(path.join(commonGitDir(a.write) as string, LOCK_FILE))
    ).toBe(false)
  })

  it('a failing job releases the lock for the next', async () => {
    const a = makeHqRemote()
    await expect(
      withRepoLock(a.write, async () => {
        throw new Error('kaputt')
      })
    ).rejects.toThrow('kaputt')
    await expect(withRepoLock(a.write, async () => 'weiter')).resolves.toBe(
      'weiter'
    )
  })

  it('waits for another live process, gives up with repo_locked, takes over a stale lock', async () => {
    const a = makeHqRemote()
    const lock = path.join(commonGitDir(a.write) as string, LOCK_FILE)
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'])
    try {
      fs.writeFileSync(lock, `${child.pid} ${Date.now()}\n`)
      const err = await withRepoLock(a.write, async () => 'nie', {
        waitMs: 300,
        pollMs: 50,
      }).catch((e) => e)
      expect(err).toBeInstanceOf(HqGitError)
      expect(err.code).toBe('repo_locked')
      expect(err.message).toMatch(/belegt/)
    } finally {
      child.kill('SIGKILL')
    }
    await new Promise((r) => child.once('exit', r))
    // the holder is gone: its lock is stale and taken over
    await expect(
      withRepoLock(a.write, async () => 'ok', { waitMs: 300 })
    ).resolves.toBe('ok')
    expect(fs.existsSync(lock)).toBe(false)
  })

  it('the network lock is a separate queue: a local job runs while a network job waits on the wire', async () => {
    const a = makeHqRemote()
    const log: string[] = []
    const net = withNetworkLock(a.write, async () => {
      log.push('net+')
      await sleep(400)
      log.push('net-')
    })
    await sleep(20)
    const t0 = Date.now()
    await withRepoLock(a.snapshot, async () => {
      log.push('local')
    })
    expect(Date.now() - t0).toBeLessThan(200)
    await net
    expect(log).toEqual(['net+', 'local', 'net-'])
    // a network job may take the local lock inside (never the other way round)
    await expect(
      withNetworkLock(a.write, () => withRepoLock(a.write, async () => 'ok'))
    ).resolves.toBe('ok')
    const gitDir = commonGitDir(a.write) as string
    expect(fs.existsSync(path.join(gitDir, LOCK_FILE))).toBe(false)
    expect(fs.existsSync(path.join(gitDir, NETWORK_LOCK_FILE))).toBe(false)
  })

  it('stale takeover removes the lock only if it is still the one judged stale', () => {
    const dir = tempDir('lock-')
    const file = path.join(dir, LOCK_FILE)
    fs.writeFileSync(file, '999999 1\n')
    // another waiter took over meanwhile: its fresh lock must survive
    fs.writeFileSync(file, `${process.pid} ${Date.now()}\n`)
    removeLockIfUnchanged(file, '999999 1\n')
    expect(fs.existsSync(file)).toBe(true)
    // a takeover in progress elsewhere: leave it alone
    fs.writeFileSync(file, '999999 1\n')
    fs.writeFileSync(`${file}.takeover`, `1 ${Date.now()}\n`)
    removeLockIfUnchanged(file, '999999 1\n')
    expect(fs.existsSync(file)).toBe(true)
    fs.rmSync(`${file}.takeover`)
    // unchanged: removed, guard cleaned up
    removeLockIfUnchanged(file, '999999 1\n')
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.existsSync(`${file}.takeover`)).toBe(false)
  })

  it('writes no lock file into a directory that is no repo', async () => {
    const dir = tempDir('no-repo-')
    await withRepoLock(dir, async () => undefined)
    expect(fs.readdirSync(dir)).toEqual([])
  })
})

describe('runHqGit', () => {
  it('commits as Verwaltung (App)', async () => {
    const a = makeHqRemote()
    fs.writeFileSync(path.join(a.write, 'x.md'), 'x\n')
    await runHqGit(a.write, ['add', 'x.md'])
    await runHqGit(a.write, ['commit', '-q', '-m', 'test'])
    expect(git(a.write, 'log', '-1', '--format=%an <%ae>|%cn <%ce>')).toBe(
      'Verwaltung (App) <verwaltung@bakery.local>|Verwaltung (App) <verwaltung@bakery.local>'
    )
  })

  it('error codes: not_a_repo, network, git_timeout', async () => {
    const dir = tempDir('no-repo-')
    await expect(runHqGit(dir, ['status'])).rejects.toMatchObject({
      code: 'not_a_repo',
    })
    const a = makeHqRemote()
    await expect(
      runHqGit(a.write, ['fetch', path.join(dir, 'missing.git')])
    ).rejects.toMatchObject({ code: 'network' })
    // waits for stdin forever → killed
    await expect(
      runHqGit(a.write, ['hash-object', '--stdin'], { timeoutMs: 200 })
    ).rejects.toMatchObject({ code: 'git_timeout' })
  })

  it('the token never shows up in the error args', async () => {
    const a = makeHqRemote()
    const err = await runHqGit(
      a.write,
      ['fetch', 'https://127.0.0.1:1/x.git'],
      {
        token: 'geheimes-token',
        timeoutMs: 10000,
      }
    ).catch((e) => e)
    expect(err).toBeInstanceOf(HqGitError)
    expect(JSON.stringify(err.args)).not.toContain('geheimes-token')
    expect(err.message).not.toContain('geheimes-token')
  })
})

describe('readBlobs / blobId', () => {
  it('reads many blobs in one process; ids match git hash-object', async () => {
    const a = makeHqRemote()
    const ids = git(
      a.write,
      'ls-tree',
      '-r',
      '--format=%(objectname)',
      'HEAD',
      '--',
      'products/'
    ).split('\n')
    const blobs = await readBlobs(a.write, [...ids, '0'.repeat(40)])
    expect(blobs.size).toBe(ids.length)
    for (const id of ids) expect(blobId(blobs.get(id) as string)).toBe(id)
  })
})
