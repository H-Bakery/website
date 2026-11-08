/**
 * A synthetic hq "GitHub" for the write-back tests (B5b, Z9): a temp **bare**
 * repo as `origin` (never the real GitHub), a seed clone to push foreign
 * commits (people, the pipeline, a merged PR), the app's write clone with
 * its `app/edits` worktree plus a second worktree on `main` (snapshots), a
 * read clone - and a tiny fake of the GitHub pulls API on localhost.
 *
 * Only the synthetic E2E catalogue (`tools/e2e/hq-products`) is used.
 */
import * as fs from 'fs'
import * as http from 'http'
import type { AddressInfo } from 'net'
import * as path from 'path'

import { FIXTURE_DIR, git, SAMPLE_FILES, tempDir } from './hqProducts'

export interface HqRemote {
  /** The bare repo (`origin`). */
  bare: string
  /** A clone people "work in"; push foreign commits from here. */
  seed: string
  /** App write clone, worktree on `app/edits` (`HQ_WRITE_DIR`). */
  write: string
  /** Second worktree of the write clone, on `main` (`HQ_SNAPSHOT_DIR`). */
  snapshot: string
  /** Read clone on `main` (`HQ_PRODUCTS_DIR` = `${read}/products`). */
  read: string
}

/** Builds origin + clones. `files` = fixture product files on main. */
export function makeHqRemote(files: string[] = SAMPLE_FILES): HqRemote {
  const root = tempDir('hq-remote-')
  const bare = path.join(root, 'origin.git')
  const seed = path.join(root, 'seed')
  const write = path.join(root, 'hq-write')
  const snapshot = path.join(root, 'hq-write-main')
  const read = path.join(root, 'hq')

  git(root, 'init', '-q', '--bare', '-b', 'main', bare)
  git(root, 'clone', '-q', bare, seed)
  git(seed, 'config', 'commit.gpgsign', 'false')
  git(seed, 'checkout', '-q', '-B', 'main')
  fs.mkdirSync(path.join(seed, 'products'))
  for (const file of files) {
    fs.copyFileSync(
      path.join(FIXTURE_DIR, file),
      path.join(seed, 'products', file)
    )
  }
  fs.mkdirSync(path.join(seed, 'data', 'reports'), { recursive: true })
  fs.writeFileSync(
    path.join(seed, 'data', 'reports', 'README.md'),
    'Berichte\n'
  )
  git(seed, 'add', '-A')
  git(seed, 'commit', '-q', '-m', 'initial')
  git(seed, 'push', '-q', 'origin', 'main')

  git(root, 'clone', '-q', bare, write)
  git(write, 'config', 'commit.gpgsign', 'false')
  git(write, 'checkout', '-q', '-b', 'app/edits', 'origin/main')
  git(write, 'worktree', 'add', '-q', snapshot, 'main')

  git(root, 'clone', '-q', bare, read)
  return { bare, seed, write, snapshot, read }
}

/** Commits `files` (relative path → content) in the seed clone and pushes to `branch`. */
export function pushForeign(
  remote: HqRemote,
  files: Record<string, string>,
  message = 'foreign change',
  branch = 'main'
): string {
  git(remote.seed, 'fetch', '-q', 'origin')
  git(remote.seed, 'checkout', '-q', '-B', branch, `origin/${branch}`)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(remote.seed, rel)), { recursive: true })
    fs.writeFileSync(path.join(remote.seed, rel), content)
  }
  git(remote.seed, 'add', '-A')
  git(remote.seed, 'commit', '-q', '-m', message)
  git(remote.seed, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`)
  return git(remote.seed, 'rev-parse', 'HEAD')
}

/** Merges `origin/app/edits` into main with a merge commit (what H2 does). */
export function mergeEdits(remote: HqRemote): void {
  git(remote.seed, 'fetch', '-q', 'origin')
  git(remote.seed, 'checkout', '-q', '-B', 'main', 'origin/main')
  git(
    remote.seed,
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'Merge app/edits',
    'origin/app/edits'
  )
  git(remote.seed, 'push', '-q', 'origin', 'main')
}

/** Content of `rel` on `ref` in the bare origin, or `null`. */
export function originFile(
  remote: HqRemote,
  ref: string,
  rel: string
): string | null {
  try {
    return git(remote.bare, 'show', `${ref}:${rel}`)
  } catch {
    return null
  }
}

/** Takes origin "offline" (renamed) and returns a function to bring it back. */
export function takeOffline(remote: HqRemote): () => void {
  const away = `${remote.bare}.offline`
  fs.renameSync(remote.bare, away)
  return () => fs.renameSync(away, remote.bare)
}

// ------------------------------------------------------------ fake GitHub

export interface FakePull {
  number: number
  html_url: string
  title: string
  body: string
  head: string
  base: string
  state: 'open' | 'closed'
}

export interface FakeGitHub {
  url: string
  pulls: FakePull[]
  requests: { method: string; url: string; auth: string | undefined }[]
  /** Next N requests answer with this status (e.g. 500). */
  failNext: (status: number, count?: number) => void
  close: () => Promise<void>
}

/** A minimal `GET/POST /repos/:owner/:repo/pulls` on 127.0.0.1. */
export async function startFakeGitHub(
  repo = 'Test-Org/hq'
): Promise<FakeGitHub> {
  const pulls: FakePull[] = []
  const requests: FakeGitHub['requests'] = []
  let failures: { status: number; count: number } | null = null
  const prefix = `/repos/${repo}/pulls`

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        auth: req.headers['authorization'],
      })
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
      }
      if (failures && failures.count > 0) {
        failures.count -= 1
        send(failures.status, { message: 'Server Error' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== prefix) return send(404, { message: 'Not Found' })
      if (req.method === 'GET') {
        const head = url.searchParams.get('head') ?? ''
        const branch = head.includes(':') ? head.split(':')[1] : head
        return send(
          200,
          pulls.filter(
            (p) =>
              p.state === (url.searchParams.get('state') ?? 'open') &&
              p.head === branch &&
              p.base === url.searchParams.get('base')
          )
        )
      }
      if (req.method === 'POST') {
        const input = JSON.parse(body || '{}')
        if (
          pulls.some(
            (p) =>
              p.state === 'open' &&
              p.head === input.head &&
              p.base === input.base
          )
        ) {
          return send(422, { message: 'A pull request already exists' })
        }
        const pr: FakePull = {
          number: pulls.length + 1,
          html_url: `https://github.example/${repo}/pull/${pulls.length + 1}`,
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
          state: 'open',
        }
        pulls.push(pr)
        return send(201, pr)
      }
      send(405, { message: 'Method Not Allowed' })
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    pulls,
    requests,
    failNext: (status, count = 1) => {
      failures = { status, count }
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
