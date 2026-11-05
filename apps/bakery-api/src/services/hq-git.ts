/**
 * git for the hq write clone (B5b, Z9; roadmap §4a, D6, D14).
 *
 * One place for every git call the API makes in `HQ_WRITE_DIR` and
 * `HQ_SNAPSHOT_DIR`:
 *
 *   - `execFile` with an **argument array**, never a shell string; a timeout
 *     per call (default 60 s, network calls get their own).
 *   - **One queue per repository** (`withRepoLock`): every git operation on a
 *     repo - product commit, rebase + push, snapshot commit + pull --rebase -
 *     runs one at a time. The key is the *common* git dir, so the write
 *     worktree (`app/edits`) and the snapshot worktree (`main`) of the same
 *     clone share one queue: they share refs (`origin/main`), and two fetches
 *     at once fail on the ref lock. A lock file in that git dir extends the
 *     queue to other processes (the nightly `snapshot-preorders` CLI next to
 *     the running server).
 *   - The app identity `Verwaltung (App) <verwaltung@bakery.local>` for author
 *     and committer; editors go into `Co-authored-by` trailers (D6).
 *   - The GitHub token only ever as an environment variable read by a
 *     one-call credential helper (as `deploy/scripts/hq-sync.sh` does), never
 *     in an argument list, a URL or `.git/config`.
 *   - Clear error codes (`HqGitError.code`), so callers can tell "offline"
 *     from "rejected" from "conflict".
 */
import { execFile, spawn } from 'child_process'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
const productsCore = require('./hq-products.core')
const writebackCore = require('./hq-writeback.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Author and committer of every app commit in hq (D6). */
export const APP_IDENTITY: { name: string; email: string } =
  productsCore.APP_AUTHOR

export const DEFAULT_GIT_TIMEOUT_MS = 60_000
/** fetch / push / pull: slow Wi-Fi is fine, a hanging connection is not. */
export const NETWORK_GIT_TIMEOUT_MS = 120_000

/**
 * Error codes:
 *   git_missing      the git binary is not installed
 *   git_timeout      the call ran longer than its timeout (killed)
 *   not_a_repo       the directory is not a git work tree
 *   network          fetch/push could not reach the remote (offline, DNS, auth)
 *   push_rejected    the remote refused the update (non-fast-forward, stale lease)
 *   rebase_conflict  rebase stopped on a conflict (aborted by the caller)
 *   repo_locked      another process held the repo lock for too long
 *   git_failed       anything else
 */
export type HqGitErrorCode =
  | 'git_missing'
  | 'git_timeout'
  | 'not_a_repo'
  | 'network'
  | 'push_rejected'
  | 'rebase_conflict'
  | 'repo_locked'
  | 'git_failed'

export class HqGitError extends Error {
  readonly code: HqGitErrorCode
  readonly args: string[]
  readonly stderr: string

  constructor(
    code: HqGitErrorCode,
    message: string,
    args: string[] = [],
    stderr = ''
  ) {
    super(message)
    this.name = 'HqGitError'
    this.code = code
    this.args = args
    this.stderr = stderr
  }
}

export interface GitCallOptions {
  /** Milliseconds before the call is killed (`git_timeout`). */
  timeoutMs?: number
  /** Extra environment (merged over the app identity). */
  env?: NodeJS.ProcessEnv
  /** GitHub token for this call only (credential helper, see above). */
  token?: string | null
}

/** Runs one git command in `cwd`. Resolves with stdout. */
export type HqGit = (
  cwd: string,
  args: string[],
  options?: GitCallOptions
) => Promise<string>

/** Environment of every app git call: identity, no prompts, no pager. */
export function appGitEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: APP_IDENTITY.name,
    GIT_AUTHOR_EMAIL: APP_IDENTITY.email,
    GIT_COMMITTER_NAME: APP_IDENTITY.name,
    GIT_COMMITTER_EMAIL: APP_IDENTITY.email,
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    ...extra,
  }
}

const TOKEN_ENV = 'BAKERY_HQ_GIT_TOKEN'

/**
 * `-c` options that hand the token to git through a credential helper which
 * reads it from the environment. The helper is a git alias-style shell
 * snippet (`!f() …`), run by git itself - the token never appears in an
 * argument list (`ps`) or on disk.
 */
function credentialArgs(token: string | null | undefined): string[] {
  if (!token) return []
  return [
    '-c',
    'credential.helper=',
    '-c',
    `credential.helper=!f() { test "$1" = get || exit 0; echo username=x-access-token; echo "password=$${TOKEN_ENV}"; }; f`,
  ]
}

/** The default runner: `execFile('git', args)`. */
export const runHqGit: HqGit = (cwd, args, options = {}) =>
  new Promise((resolve, reject) => {
    const fullArgs = [
      '-c',
      'commit.gpgsign=false',
      ...credentialArgs(options.token),
      ...args,
    ]
    const env = appGitEnv({
      ...(options.env ?? {}),
      ...(options.token ? { [TOKEN_ENV]: options.token } : {}),
    })
    execFile(
      'git',
      fullArgs,
      {
        cwd,
        env,
        timeout: options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(String(stdout))
          return
        }
        const err = error as NodeJS.ErrnoException & {
          killed?: boolean
          signal?: string | null
        }
        const text = String(stderr || err.message).trim()
        // `args` in the error: never the credential options.
        if (err.code === 'ENOENT') {
          reject(
            new HqGitError('git_missing', 'git ist nicht installiert.', args)
          )
          return
        }
        if (err.killed || err.signal === 'SIGKILL') {
          reject(
            new HqGitError(
              'git_timeout',
              `git ${args[0]} hat zu lange gebraucht und wurde abgebrochen.`,
              args,
              text
            )
          )
          return
        }
        const code = writebackCore.classifyGitError(
          args,
          text
        ) as HqGitErrorCode
        reject(
          new HqGitError(code, `git ${args[0]} failed: ${text}`, args, text)
        )
      }
    )
  })

// ------------------------------------------------------------------ locks

/**
 * The common git dir of a work tree (shared by all its linked worktrees), or
 * `null` when `dir` is not the root of a git work tree.
 */
export function commonGitDir(dir: string): string | null {
  const root = path.resolve(dir)
  const dotGit = path.join(root, '.git')
  try {
    const stat = fs.statSync(dotGit)
    if (stat.isDirectory()) return fs.realpathSync(dotGit)
    // A linked worktree: `.git` is a file `gitdir: <common>/worktrees/<name>`.
    const match = /^gitdir:\s*(.+)\s*$/m.exec(fs.readFileSync(dotGit, 'utf8'))
    if (!match) return null
    const gitDir = path.resolve(root, match[1].trim())
    const commondirFile = path.join(gitDir, 'commondir')
    if (fs.existsSync(commondirFile)) {
      const common = fs.readFileSync(commondirFile, 'utf8').trim()
      return fs.realpathSync(path.resolve(gitDir, common))
    }
    return fs.realpathSync(gitDir)
  } catch {
    return null
  }
}

/** Queue key of a directory: its common git dir, else the path itself. */
export function repoKey(dir: string): string {
  return commonGitDir(dir) ?? path.resolve(dir)
}

const queues = new Map<string, Promise<unknown>>()

export const LOCK_FILE = 'bakery-app.lock'
/** A lock older than this is considered left over from a crashed process. */
export const STALE_LOCK_MS = 10 * 60_000

export interface RepoLockOptions {
  /** How long to wait for another process's lock (default 60 s). */
  waitMs?: number
  pollMs?: number
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Takes the cross-process lock file in `gitDir`; returns its path. */
async function acquireFileLock(
  gitDir: string | null,
  options: RepoLockOptions
): Promise<string | null> {
  if (!gitDir) return null
  const file = path.join(gitDir, LOCK_FILE)
  const deadline = Date.now() + (options.waitMs ?? 60_000)
  for (;;) {
    try {
      fs.writeFileSync(file, `${process.pid} ${Date.now()}\n`, { flag: 'wx' })
      return file
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return null
    }
    // Held: by a live process (wait) or left over (take over).
    let stale = false
    try {
      const [pidRaw, atRaw] = fs.readFileSync(file, 'utf8').trim().split(/\s+/)
      const pid = Number(pidRaw)
      const at = Number(atRaw)
      stale =
        pid === process.pid ||
        !pidAlive(pid) ||
        !Number.isFinite(at) ||
        Date.now() - at > STALE_LOCK_MS
    } catch {
      stale = true // vanished or unreadable between the two calls
    }
    if (stale) {
      fs.rmSync(file, { force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new HqGitError(
        'repo_locked',
        'Das hq-Verzeichnis ist von einem anderen Vorgang belegt. Bitte später erneut versuchen.'
      )
    }
    await sleep(options.pollMs ?? 200)
  }
}

/**
 * Runs `job` while holding the repo's lock: in-process FIFO queue per common
 * git dir, plus a lock file in it against other processes. Jobs never run
 * concurrently on one repository; a failing job does not block the next.
 */
export function withRepoLock<T>(
  dir: string,
  job: () => Promise<T>,
  options: RepoLockOptions = {}
): Promise<T> {
  const gitDir = commonGitDir(dir)
  const key = gitDir ?? path.resolve(dir)
  const previous = queues.get(key) ?? Promise.resolve()
  const run = previous.then(async () => {
    // Only inside a real git dir - never a stray file in a work tree.
    const lock = await acquireFileLock(gitDir, options)
    try {
      return await job()
    } finally {
      if (lock) fs.rmSync(lock, { force: true })
    }
  })
  const tail = run.catch(() => undefined)
  queues.set(key, tail)
  // Drop the entry once idle so the map does not grow with temp repos.
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key)
  })
  return run
}

// ---------------------------------------------------------------- helpers

/** `git rev-parse --verify --quiet <ref>`; `null` when it does not exist. */
export async function revParse(
  git: HqGit,
  cwd: string,
  ref: string
): Promise<string | null> {
  try {
    const out = await git(cwd, [
      'rev-parse',
      '--verify',
      '--quiet',
      `${ref}^{commit}`,
    ])
    return out.trim() || null
  } catch {
    return null
  }
}

/** Current branch name (`HEAD` when detached); throws `not_a_repo`. */
export async function currentBranch(git: HqGit, cwd: string): Promise<string> {
  if (!fs.existsSync(cwd)) {
    throw new HqGitError('not_a_repo', `${cwd} existiert nicht.`)
  }
  try {
    return (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  } catch (error) {
    if (error instanceof HqGitError && error.code === 'git_missing') throw error
    throw new HqGitError(
      'not_a_repo',
      `${cwd} ist kein git-Arbeitsverzeichnis.`,
      ['rev-parse'],
      error instanceof HqGitError ? error.stderr : String(error)
    )
  }
}

/** Number of commits in `range` (`a..b`), 0 when a ref is missing. */
export async function countCommits(
  git: HqGit,
  cwd: string,
  range: string
): Promise<number> {
  try {
    return Number((await git(cwd, ['rev-list', '--count', range])).trim()) || 0
  } catch {
    return 0
  }
}

/** Files with conflicts during a stopped rebase/merge. */
export async function conflictedFiles(
  git: HqGit,
  cwd: string
): Promise<string[]> {
  try {
    const out = await git(cwd, ['diff', '--name-only', '--diff-filter=U'])
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Contents of blobs by id (`git cat-file --batch`), one process for all.
 * Returns a map id → UTF-8 text; missing objects are left out.
 */
export function readBlobs(
  cwd: string,
  ids: string[],
  timeoutMs = DEFAULT_GIT_TIMEOUT_MS
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (ids.length === 0) return Promise.resolve(result)
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], {
      cwd,
      env: appGitEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => (stderr += String(c)))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new HqGitError('git_failed', `git cat-file: ${error.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(
          new HqGitError(
            'git_failed',
            `git cat-file failed: ${stderr.trim()}`,
            ['cat-file'],
            stderr
          )
        )
        return
      }
      const buf = Buffer.concat(chunks)
      let pos = 0
      while (pos < buf.length) {
        const nl = buf.indexOf(10, pos)
        if (nl < 0) break
        const header = buf.subarray(pos, nl).toString('utf8').split(' ')
        pos = nl + 1
        if (header[1] === 'missing') continue
        const size = Number(header[2])
        result.set(header[0], buf.subarray(pos, pos + size).toString('utf8'))
        pos += size + 1 // content + trailing LF
      }
      resolve(result)
    })
    child.stdin.end(ids.map((id) => `${id}\n`).join(''))
  })
}

/** git's blob id of a text (what `git hash-object` prints). */
export function blobId(content: string): string {
  const body = Buffer.from(content, 'utf8')
  return createHash('sha1')
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest('hex')
}
