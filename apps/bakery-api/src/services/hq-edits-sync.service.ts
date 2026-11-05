/**
 * B5b: master-data edits from the app reach hq as one rolling pull request
 * (roadmap D6, §4a "How the app syncs").
 *
 * B5 commits every product save in the write worktree `HQ_WRITE_DIR` (branch
 * `app/edits`). After each such commit, and every 15 minutes, `sync()`:
 *
 *   1. `fetch` origin `main` and `app/*`
 *   2. reads the approved product files from `origin/main` (for
 *      `pendingApproval`, see `approvedProductFiles()`)
 *   3. nothing of ours left on top of `origin/main` → fast-forward the
 *      worktree; the PR was merged (`mergedSince`)
 *   4. otherwise rebase `app/edits` onto `origin/main` (a conflict is aborted,
 *      the local commits stay, the error is recorded), then
 *      `push --force-with-lease origin app/edits` (lease = the remote value we
 *      just fetched; one retry after a rejected lease)
 *   5. makes sure exactly one PR `app/edits → main` is open (GitHub REST API)
 *
 * Every git step runs under `withRepoLock` (the same queue the product saves
 * use), so a rebase never meets a half-done commit. Offline: commits queue
 * locally, the timer retries. Without `HQ_WRITE_DIR` or a GitHub token the
 * sync is disabled and `status()` says why; saves still commit locally (B5).
 */
import * as path from 'path'

import {
  countCommits,
  currentBranch,
  HqGit,
  HqGitError,
  NETWORK_GIT_TIMEOUT_MS,
  readBlobs,
  revParse,
  runHqGit,
  conflictedFiles,
  withRepoLock,
} from './hq-git'
import { ensurePullRequest, FetchLike, GitHubError } from './github-pr'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-writeback.core')
const productsCore = require('./hq-products.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface SyncLog {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export interface HqEditsSyncOptions {
  /** Root of the write worktree (`HQ_WRITE_DIR`); `null` = disabled. */
  writeDir: string | null
  /** GitHub token (`HQ_GITHUB_TOKEN`, else `GITHUB_TOKEN`); `null` = disabled. */
  token: string | null
  branch?: string
  baseBranch?: string
  remote?: string
  /** `owner/repo` (`HQ_GITHUB_REPO`, default `H-Bakery/hq`). */
  githubRepo?: string
  /** REST base URL (`GITHUB_API_URL`, default `https://api.github.com`). */
  githubApiUrl?: string
  /** Interval of the retry timer (default 15 min). */
  retryMs?: number
  git?: HqGit
  fetch?: FetchLike
  now?: () => Date
  log?: SyncLog
}

export interface SyncError {
  code: string
  message: string
  detail: string | null
  files?: string[]
  at: string
}

export interface EditsSyncStatus {
  enabled: boolean
  /** Why it is disabled (German), else `null`. */
  reason: string | null
  branch: string
  baseBranch: string
  repo: string
  /** Local commits on `app/edits` not yet on GitHub (offline queue). */
  pendingCommits: number
  /** Commits on `app/edits` not yet in `main` (waiting for approval). */
  unmergedCommits: number
  lastPushAt: string | null
  lastAttemptAt: string | null
  lastError: SyncError | null
  prUrl: string | null
  /** Since when everything the app pushed is merged into `main`; `null` while something waits. */
  mergedSince: string | null
  running: boolean
}

const DEFAULT_LOG: SyncLog = {
  info: (...a) => console.log('[hq-sync]', ...a),
  warn: (...a) => console.warn('[hq-sync]', ...a),
  error: (...a) => console.error('[hq-sync]', ...a),
}

/** A failure the sync records and answers with, without throwing further. */
class SyncStop extends Error {
  constructor(
    readonly code: string,
    readonly detail: string | null = null,
    readonly files?: string[]
  ) {
    super(code)
  }
}

export class HqEditsSync {
  readonly writeDir: string | null
  readonly token: string | null
  readonly branch: string
  readonly baseBranch: string
  readonly remote: string
  readonly githubRepo: string
  readonly githubApiUrl: string
  readonly retryMs: number
  private readonly git: HqGit
  private readonly fetchImpl?: FetchLike
  private readonly now: () => Date
  private readonly log: SyncLog

  private approved: Map<string, string> | null = null
  private timer: NodeJS.Timeout | null = null
  private running: Promise<EditsSyncStatus> | null = null
  private again = false
  private worktreeListeners: (() => void)[] = []

  private pendingCommits = 0
  private unmergedCommits = 0
  private lastPushAt: string | null = null
  private lastAttemptAt: string | null = null
  private lastError: SyncError | null = null
  private prUrl: string | null = null
  private mergedSince: string | null = null

  constructor(options: HqEditsSyncOptions) {
    this.writeDir = options.writeDir ? path.resolve(options.writeDir) : null
    this.token = options.token || null
    this.branch = options.branch || core.EDITS_BRANCH
    this.baseBranch = options.baseBranch || core.BASE_BRANCH
    this.remote = options.remote || 'origin'
    this.githubRepo = options.githubRepo || core.DEFAULT_GITHUB_REPO
    this.githubApiUrl = options.githubApiUrl || core.DEFAULT_GITHUB_API_URL
    this.retryMs = options.retryMs ?? core.DEFAULT_RETRY_MS
    this.git = options.git ?? runHqGit
    this.fetchImpl = options.fetch
    this.now = options.now ?? (() => new Date())
    this.log = options.log ?? DEFAULT_LOG
  }

  get enabled(): boolean {
    return this.writeDir !== null && this.token !== null
  }

  /** Why the sync is off (German), or `null`. */
  get disabledReason(): string | null {
    if (!this.writeDir) {
      return 'HQ_WRITE_DIR ist nicht gesetzt - Änderungen werden nicht nach hq übertragen.'
    }
    if (!this.token) {
      return 'Kein GitHub-Token (HQ_GITHUB_TOKEN) - Änderungen bleiben als Commits auf der Box.'
    }
    return null
  }

  /** Called after the worktree's files changed (rebase, fast-forward). */
  onWorktreeChanged(listener: () => void): void {
    this.worktreeListeners.push(listener)
  }

  private worktreeChanged(): void {
    for (const listener of this.worktreeListeners) {
      try {
        listener()
      } catch (error) {
        this.log.error('worktree listener failed:', error)
      }
    }
  }

  /**
   * Product files on `origin/main` as fetched last: file name → raw content,
   * or `null` before the first successful read (no write dir, no
   * `origin/main` yet). `HqProductsService` compares against this for
   * `pendingApproval` instead of the read clone, which can lag 10 minutes.
   */
  approvedProductFiles(): ReadonlyMap<string, string> | null {
    return this.approved
  }

  status(): EditsSyncStatus {
    return {
      enabled: this.enabled,
      reason: this.disabledReason,
      branch: this.branch,
      baseBranch: this.baseBranch,
      repo: this.githubRepo,
      pendingCommits: this.pendingCommits,
      unmergedCommits: this.unmergedCommits,
      lastPushAt: this.lastPushAt,
      lastAttemptAt: this.lastAttemptAt,
      lastError: this.lastError,
      prUrl: this.prUrl,
      mergedSince: this.mergedSince,
      running: this.running !== null,
    }
  }

  /** Reads `origin/main` once without fetching (server start). */
  async init(): Promise<void> {
    const dir = this.writeDir
    if (!dir) return
    try {
      await withRepoLock(dir, async () => {
        await this.refreshApproved(dir)
        await this.updateCounts(dir)
      })
    } catch (error) {
      this.log.warn('could not read origin/main:', (error as Error).message)
    }
  }

  /** Starts the retry timer (unref'd) and a first sync. */
  start(): void {
    if (!this.enabled || this.timer) return
    this.timer = setInterval(() => {
      void this.sync()
    }, this.retryMs)
    this.timer.unref()
    void this.sync()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** After a B5 commit: push now (coalesced with a running sync). */
  notifyCommitted(): void {
    if (!this.enabled) return
    void this.sync()
  }

  /**
   * Runs a sync; while one runs, a second call makes it run once more and
   * resolves with that result. Never rejects - failures go to `lastError`.
   */
  sync(): Promise<EditsSyncStatus> {
    if (!this.enabled) return Promise.resolve(this.status())
    if (this.running) {
      this.again = true
      return this.running
    }
    const dir = this.writeDir as string
    const run = (async () => {
      try {
        do {
          this.again = false
          await withRepoLock(dir, () => this.syncOnce(dir)).catch((error) =>
            this.fail(error)
          )
        } while (this.again)
      } finally {
        this.running = null
      }
      return this.status()
    })()
    this.running = run
    return run
  }

  // ------------------------------------------------------------ internals

  private iso(): string {
    return this.now().toISOString()
  }

  private fail(error: unknown): void {
    let code = 'git_failed'
    let detail: string | null = null
    let files: string[] | undefined
    if (error instanceof SyncStop) {
      code = error.code
      detail = error.detail
      files = error.files
    } else if (error instanceof HqGitError) {
      code = error.code
      detail = error.stderr || error.message
    } else if (error instanceof GitHubError) {
      code = 'github_failed'
      detail = error.message
    } else {
      detail = String((error as Error)?.message ?? error)
    }
    this.lastError = {
      code,
      message: core.syncErrorMessage(code),
      detail: detail ? detail.slice(0, 500) : null,
      ...(files ? { files } : {}),
      at: this.iso(),
    }
    this.log.warn(`sync failed (${code}): ${detail ?? ''}`)
  }

  private networkOptions() {
    return { token: this.token, timeoutMs: NETWORK_GIT_TIMEOUT_MS }
  }

  private async fetch(dir: string): Promise<void> {
    await this.git(
      dir,
      [
        'fetch',
        '--prune',
        '--quiet',
        this.remote,
        `+refs/heads/${this.baseBranch}:refs/remotes/${this.remote}/${this.baseBranch}`,
        // A glob: no error while app/edits does not exist on GitHub yet.
        `+refs/heads/${this.branch.split('/')[0]}/*:refs/remotes/${
          this.remote
        }/${this.branch.split('/')[0]}/*`,
      ],
      this.networkOptions()
    )
  }

  private get baseRef(): string {
    return `refs/remotes/${this.remote}/${this.baseBranch}`
  }

  private get remoteEditsRef(): string {
    return `refs/remotes/${this.remote}/${this.branch}`
  }

  /** Approved product files from `origin/main` (see `approvedProductFiles`). */
  private async refreshApproved(dir: string): Promise<void> {
    const base = await revParse(this.git, dir, this.baseRef)
    if (!base) return
    const out = await this.git(dir, [
      'ls-tree',
      '-z',
      '--full-tree',
      base,
      '--',
      'products/',
    ])
    const entries: { id: string; file: string }[] = []
    for (const record of out.split('\0')) {
      const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(record)
      if (!match) continue
      const rel = match[2]
      if (path.posix.dirname(rel) !== 'products') continue
      const file = path.posix.basename(rel)
      if (!productsCore.isProductFileName(file)) continue
      entries.push({ id: match[1], file })
    }
    const blobs = await readBlobs(dir, [...new Set(entries.map((e) => e.id))])
    const approved = new Map<string, string>()
    for (const e of entries) {
      const raw = blobs.get(e.id)
      if (raw !== undefined) approved.set(e.file, raw)
    }
    this.approved = approved
  }

  private async updateCounts(dir: string): Promise<void> {
    const hasBase = (await revParse(this.git, dir, this.baseRef)) !== null
    this.unmergedCommits = hasBase
      ? await countCommits(this.git, dir, `${this.baseRef}..HEAD`)
      : 0
    // Not on GitHub at all: neither in app/edits nor (merged) in main.
    const remoteEdits = await revParse(this.git, dir, this.remoteEditsRef)
    if (!remoteEdits) {
      this.pendingCommits = this.unmergedCommits
      return
    }
    try {
      const out = await this.git(dir, [
        'rev-list',
        '--count',
        'HEAD',
        `^${this.remoteEditsRef}`,
        ...(hasBase ? [`^${this.baseRef}`] : []),
      ])
      this.pendingCommits = Number(out.trim()) || 0
    } catch {
      this.pendingCommits = 0
    }
  }

  private async syncOnce(dir: string): Promise<void> {
    this.lastAttemptAt = this.iso()
    let branch: string
    try {
      branch = await currentBranch(this.git, dir)
    } catch (error) {
      throw error instanceof HqGitError
        ? new SyncStop(error.code, error.message)
        : error
    }
    if (branch !== this.branch) {
      throw new SyncStop(
        'wrong_branch',
        `write worktree is on "${branch}", expected "${this.branch}"`
      )
    }

    try {
      await this.fetch(dir)
    } finally {
      // Offline: still report what is queued.
      await this.updateCounts(dir)
    }
    await this.refreshApproved(dir)

    const dirty = (
      await this.git(dir, ['status', '--porcelain', '--untracked-files=no'])
    ).trim()
    if (dirty) {
      throw new SyncStop(
        'worktree_dirty',
        dirty.split('\n').slice(0, 10).join('\n')
      )
    }

    let pushedOnce = false
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        await this.fetch(dir)
        await this.refreshApproved(dir)
      }
      const head = await revParse(this.git, dir, 'HEAD')
      const base = await revParse(this.git, dir, this.baseRef)
      if (!head || !base) {
        throw new SyncStop('git_failed', 'HEAD or origin/main missing')
      }

      if ((await countCommits(this.git, dir, `${this.baseRef}..HEAD`)) === 0) {
        await this.fastForward(dir, head, base)
        return
      }
      // Squash-merged: our content is all on main already, under other ids.
      const [headTree, baseTree] = await Promise.all([
        this.git(dir, ['rev-parse', 'HEAD^{tree}']),
        this.git(dir, ['rev-parse', `${this.baseRef}^{tree}`]),
      ])
      if (headTree.trim() === baseTree.trim()) {
        await this.git(dir, ['reset', '--quiet', '--keep', this.baseRef])
        this.worktreeChanged()
        await this.fastForward(dir, base, base)
        return
      }

      await this.rebase(dir, base)

      const expected =
        (await revParse(this.git, dir, this.remoteEditsRef)) ?? ''
      const now = await revParse(this.git, dir, 'HEAD')
      if (expected !== now) {
        try {
          await this.git(
            dir,
            [
              'push',
              '--porcelain',
              `--force-with-lease=refs/heads/${this.branch}:${expected}`,
              this.remote,
              `HEAD:refs/heads/${this.branch}`,
            ],
            this.networkOptions()
          )
        } catch (error) {
          if (
            attempt === 1 &&
            error instanceof HqGitError &&
            error.code === 'push_rejected'
          ) {
            this.log.warn('push rejected (lease), fetching and retrying once')
            continue
          }
          throw error
        }
        await this.git(dir, ['update-ref', this.remoteEditsRef, 'HEAD'])
        this.lastPushAt = this.iso()
        pushedOnce = true
        this.log.info(`pushed ${this.branch} (${now?.slice(0, 12)})`)
      }
      await this.updateCounts(dir)
      this.mergedSince = null
      await this.ensurePullRequest(dir, pushedOnce)
      this.lastError = null
      return
    }
  }

  /** Nothing of ours on top of main: follow main; record a merge. */
  private async fastForward(dir: string, head: string, base: string) {
    if (head !== base) {
      await this.git(dir, ['merge', '--ff-only', '--quiet', this.baseRef])
      this.worktreeChanged()
    }
    await this.updateCounts(dir)
    // First time we see nothing waiting: from now on everything is merged.
    if (!this.mergedSince) this.mergedSince = this.iso()
    this.prUrl = null
    this.lastError = null
  }

  private async rebase(dir: string, base: string): Promise<void> {
    const mergeBase = (
      await this.git(dir, ['merge-base', 'HEAD', this.baseRef])
    ).trim()
    if (mergeBase === base) return // already on top of origin/main
    try {
      await this.git(dir, ['rebase', '--quiet', this.baseRef])
    } catch (error) {
      const files = await conflictedFiles(this.git, dir)
      await this.git(dir, ['rebase', '--abort']).catch(() => undefined)
      this.worktreeChanged()
      await this.updateCounts(dir)
      throw new SyncStop(
        'rebase_conflict',
        error instanceof HqGitError ? error.stderr : String(error),
        files
      )
    }
    this.worktreeChanged()
  }

  private async ensurePullRequest(dir: string, pushed: boolean): Promise<void> {
    // After a push, or while we do not know the PR yet (a failed attempt).
    if (!pushed && this.prUrl) return
    const [names, log] = await Promise.all([
      this.git(dir, ['diff', '--name-only', `${this.baseRef}...HEAD`]),
      this.git(dir, ['log', '--format=%B', `${this.baseRef}..HEAD`]),
    ])
    const body = core.pullRequestBody({
      files: core.fileList(names),
      editors: core.editorsFromLog(log),
      commitCount: this.unmergedCommits,
    })
    const pr = await ensurePullRequest(
      {
        apiUrl: this.githubApiUrl,
        token: this.token as string,
        repo: this.githubRepo,
        fetch: this.fetchImpl,
      },
      {
        head: this.branch,
        base: this.baseBranch,
        title: core.PR_TITLE,
        body,
      }
    )
    if (pr.created) this.log.info(`opened PR ${pr.url}`)
    this.prUrl = pr.url
  }
}
