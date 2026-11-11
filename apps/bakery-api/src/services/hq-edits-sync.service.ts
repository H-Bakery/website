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
 *      worktree; the PR was merged (`mergedSince`). A squash merge is
 *      recognised by content: the newest of our commits whose files all have
 *      the same content on `origin/main` marks what was merged
 *      (`mergedPrefix`) - those commits are dropped, the rest is replayed
 *   4. otherwise rebase `app/edits` onto `origin/main` (a conflict is aborted,
 *      the local commits stay, the error is recorded)
 *   5. commits someone else pushed to `app/edits` (a fix for a failing check)
 *      are cherry-picked on top instead of being overwritten
 *      (`adoptForeignCommits`); if that conflicts nothing is pushed
 *   6. `push --force-with-lease origin <sha>:app/edits` (lease = the remote
 *      value we just fetched; one retry after a rejected lease)
 *   7. makes sure exactly one PR `app/edits → main` is open (GitHub REST API)
 *
 * Locks (see `hq-git.ts`): fetch and push run under the **network** lock,
 * the worktree steps (rebase, reset, cherry-pick, fast-forward) under the
 * short **local** lock the product saves use - a save never waits for
 * GitHub, and a rebase never meets a half-done commit. The GitHub API is
 * called with no lock held. Offline: commits queue locally, the timer
 * retries. Without `HQ_WRITE_DIR` or a GitHub token the sync is disabled and
 * `status()` says why; saves still commit locally (B5), and `pendingApproval`
 * is measured against the read clone as in B5.
 *
 * The token comes from a `GitHubTokenProvider` (github-token.ts) and is read
 * at the time of use - a GitHub App token in `HQ_GITHUB_TOKEN_FILE` is renewed
 * every 30 minutes by `hq-token.sh`. With a token file the retry timer runs
 * even while the file is missing, so the sync starts by itself once the
 * first token is there.
 */
import * as path from 'path'

import {
  countCommits,
  currentBranch,
  HqGit,
  HqGitError,
  APP_IDENTITY,
  NETWORK_GIT_TIMEOUT_MS,
  readBlobs,
  revParse,
  runHqGit,
  conflictedFiles,
  withNetworkLock,
  withRepoLock,
} from './hq-git'
import { ensurePullRequest, FetchLike, GitHubError } from './github-pr'
import {
  describeTokenProblem,
  GitHubTokenProvider,
  GitHubTokenState,
  staticGitHubToken,
} from './github-token'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-writeback.core')
const productsCore = require('./hq-products.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Master-data files besides `products/` whose `origin/main` content is kept
 * for "wartet auf Freigabe" (Z4: the Backzettel Grundmengen).
 */
export const APPROVED_TEXT_FILES: readonly string[] = ['config/backzettel.yaml']

/** Recipes (`data/recipes/<category>/<file>`): kept like the products. */
export const APPROVED_RECIPES_DIR = 'data/recipes'

export interface SyncLog {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export interface HqEditsSyncOptions {
  /** Root of the write worktree (`HQ_WRITE_DIR`); `null` = disabled. */
  writeDir: string | null
  /**
   * Fixed GitHub token; `null` = disabled. Ignored when `tokenProvider` is
   * given (server.ts: `HQ_GITHUB_TOKEN` or `HQ_GITHUB_TOKEN_FILE`).
   */
  token?: string | null
  /** Where the token is read from at the time of use (github-token.ts). */
  tokenProvider?: GitHubTokenProvider
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

/** Where the token comes from - never the token itself. */
export interface TokenStatus {
  source: GitHubTokenState['source']
  /** `HQ_GITHUB_TOKEN_FILE`, else `null`. */
  file: string | null
  /** Last renewal of the token file (an App token is valid 1 h). */
  updatedAt: string | null
  problem: GitHubTokenState['problem']
}

export interface EditsSyncStatus {
  enabled: boolean
  /** Why it is disabled (German), else `null`. */
  reason: string | null
  token: TokenStatus
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
  readonly tokenProvider: GitHubTokenProvider
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
  /** Other master-data files on `origin/main` (`APPROVED_TEXT_FILES`). */
  private approvedText = new Map<string, string>()
  /** Recipe files on `origin/main`: path below `data/recipes` → content. */
  private approvedRecipes = new Map<string, string>()
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
    this.tokenProvider =
      options.tokenProvider ?? staticGitHubToken(options.token || null)
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

  /** The token right now (the token file is read on every call). */
  private currentToken(): string | null {
    return this.tokenProvider.read().token
  }

  /** A write dir and, right now, a token. */
  get enabled(): boolean {
    return this.writeDir !== null && this.currentToken() !== null
  }

  /** Why the sync is off (German), or `null`. */
  get disabledReason(): string | null {
    return this.reasonFor(this.tokenProvider.read())
  }

  private reasonFor(state: GitHubTokenState): string | null {
    if (!this.writeDir) {
      return 'HQ_WRITE_DIR ist nicht gesetzt - Änderungen werden nicht nach hq übertragen.'
    }
    if (!state.token) {
      const problem = describeTokenProblem(state)
      return problem
        ? `Kein GitHub-Token (HQ_GITHUB_TOKEN_FILE: ${problem}) - Änderungen bleiben als Commits auf der Box.`
        : 'Kein GitHub-Token (HQ_GITHUB_TOKEN) - Änderungen bleiben als Commits auf der Box.'
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
    // Disabled: `origin/main` of the write clone is never fetched and would
    // go stale - B5 compares against the read clone instead.
    return this.enabled ? this.approved : null
  }

  /**
   * Content of a master-data file (`APPROVED_TEXT_FILES`, e.g. the Backzettel
   * YAML, Z4) on `origin/main` as fetched last: `null` = not on main,
   * `undefined` = unknown (sync disabled or not read yet) - the caller then
   * compares with the read clone, as for the products.
   */
  approvedTextFile(rel: string): string | null | undefined {
    if (!this.enabled || this.approved === null) return undefined
    if (!APPROVED_TEXT_FILES.includes(rel)) return undefined
    return this.approvedText.get(rel) ?? null
  }

  /**
   * Recipe files on `origin/main` as fetched last: path below `data/recipes`
   * (`fillings/x.md`) → raw content; `null` = unknown (sync disabled or not
   * read yet) - `RecipesService` then compares with the read clone.
   */
  approvedRecipeFiles(): ReadonlyMap<string, string> | null {
    if (!this.enabled || this.approved === null) return null
    return this.approvedRecipes
  }

  status(): EditsSyncStatus {
    const token = this.tokenProvider.read()
    return {
      enabled: this.writeDir !== null && token.token !== null,
      reason: this.reasonFor(token),
      token: {
        source: token.source,
        file: token.file,
        updatedAt: token.updatedAt,
        problem: token.problem,
      },
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
        if (this.enabled) await this.refreshApproved(dir)
        await this.updateCounts(dir)
      })
    } catch (error) {
      this.log.warn('could not read origin/main:', (error as Error).message)
    }
  }

  /**
   * Starts the retry timer (unref'd) and a first sync. With a token file the
   * timer runs even while the file is missing or empty: every tick reads it
   * again, so the first token minted after the start is picked up.
   */
  start(): void {
    if (!this.writeDir || !this.tokenProvider.configured || this.timer) return
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
          await this.syncOnce(dir).catch((error) => this.fail(error))
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

  /** Read at the time of use: an App token in a file is renewed every 30 min. */
  private networkOptions() {
    return { token: this.currentToken(), timeoutMs: NETWORK_GIT_TIMEOUT_MS }
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
      '-r',
      '-z',
      '--full-tree',
      base,
      '--',
      'products/',
      `${APPROVED_RECIPES_DIR}/`,
      ...APPROVED_TEXT_FILES,
    ])
    const entries: { id: string; file: string }[] = []
    const texts: { id: string; rel: string }[] = []
    const recipes: { id: string; rel: string }[] = []
    for (const record of out.split('\0')) {
      const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(record)
      if (!match) continue
      const rel = match[2]
      if (APPROVED_TEXT_FILES.includes(rel)) {
        texts.push({ id: match[1], rel })
        continue
      }
      if (rel.startsWith(`${APPROVED_RECIPES_DIR}/`)) {
        recipes.push({
          id: match[1],
          rel: rel.slice(APPROVED_RECIPES_DIR.length + 1),
        })
        continue
      }
      if (path.posix.dirname(rel) !== 'products') continue
      const file = path.posix.basename(rel)
      if (!productsCore.isProductFileName(file)) continue
      entries.push({ id: match[1], file })
    }
    const blobs = await readBlobs(dir, [
      ...new Set([...entries, ...texts, ...recipes].map((e) => e.id)),
    ])
    const approved = new Map<string, string>()
    for (const e of entries) {
      const raw = blobs.get(e.id)
      if (raw !== undefined) approved.set(e.file, raw)
    }
    const approvedText = new Map<string, string>()
    for (const t of texts) {
      const raw = blobs.get(t.id)
      if (raw !== undefined) approvedText.set(t.rel, raw)
    }
    const approvedRecipes = new Map<string, string>()
    for (const r of recipes) {
      const raw = blobs.get(r.id)
      if (raw !== undefined) approvedRecipes.set(r.rel, raw)
    }
    this.approvedRecipes = approvedRecipes
    this.approvedText = approvedText
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

  /** Worktree steps: short, under the local lock (shared with saves). */
  private local<T>(dir: string, job: () => Promise<T>): Promise<T> {
    return withRepoLock(dir, job)
  }

  /** fetch / push / remote-tracking refs: under the network lock. */
  private net<T>(dir: string, job: () => Promise<T>): Promise<T> {
    return withNetworkLock(dir, job)
  }

  private async checkBranch(dir: string): Promise<void> {
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
  }

  private async syncOnce(dir: string): Promise<void> {
    this.lastAttemptAt = this.iso()
    await this.checkBranch(dir)
    try {
      await this.net(dir, () => this.fetch(dir))
    } finally {
      // Offline: still report what is queued.
      await this.local(dir, () => this.updateCounts(dir))
    }

    let pushedOnce = false
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) await this.net(dir, () => this.fetch(dir))
      const plan = await this.local(dir, () => this.prepare(dir))
      if (!plan) return // merged / nothing to push: fast-forwarded

      if (plan.lease !== plan.head) {
        try {
          await this.net(dir, async () => {
            await this.git(
              dir,
              [
                'push',
                '--porcelain',
                `--force-with-lease=refs/heads/${this.branch}:${plan.lease}`,
                this.remote,
                `${plan.head}:refs/heads/${this.branch}`,
              ],
              this.networkOptions()
            )
            await this.git(dir, ['update-ref', this.remoteEditsRef, plan.head])
          })
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
        this.lastPushAt = this.iso()
        pushedOnce = true
        this.log.info(`pushed ${this.branch} (${plan.head.slice(0, 12)})`)
      }
      await this.local(dir, () => this.updateCounts(dir))
      this.mergedSince = null
      // GitHub with no lock held: a slow API never blocks git.
      await this.ensurePullRequest(dir, pushedOnce, plan)
      this.lastError = null
      return
    }
  }

  /**
   * The local part of a sync (under the local lock): approved files, merge
   * detection, rebase, adopting foreign commits. Returns what to push, or
   * `null` when nothing of ours waits (fast-forwarded).
   */
  private async prepare(
    dir: string
  ): Promise<{ head: string; base: string; lease: string } | null> {
    await this.checkBranch(dir)
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
    const head = await revParse(this.git, dir, 'HEAD')
    const base = await revParse(this.git, dir, this.baseRef)
    if (!head || !base) {
      throw new SyncStop('git_failed', 'HEAD or origin/main missing')
    }
    if ((await countCommits(this.git, dir, `${base}..HEAD`)) === 0) {
      await this.fastForward(dir, head, base)
      return null
    }

    const mergeBase = (await this.git(dir, ['merge-base', 'HEAD', base])).trim()
    if (mergeBase !== base) {
      // main moved: maybe it took our commits (squash merge) - by content.
      const commits = (
        await this.git(dir, ['rev-list', '--reverse', `${base}..HEAD`])
      )
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      const merged = await this.mergedPrefix(dir, base, mergeBase, commits)
      if (merged === commits.length - 1) {
        this.log.info('app/edits was merged (by content) - following main')
        await this.git(dir, ['reset', '--quiet', '--keep', base])
        this.worktreeChanged()
        await this.fastForward(dir, base, base)
        return null
      }
      await this.rebase(dir, base, merged >= 0 ? commits[merged] : null)
    }

    const remoteEdits = await revParse(this.git, dir, this.remoteEditsRef)
    if (remoteEdits) await this.adoptForeignCommits(dir, base, remoteEdits)
    const now = (await revParse(this.git, dir, 'HEAD')) as string
    return { head: now, base, lease: remoteEdits ?? '' }
  }

  /**
   * Squash merge detection by content (D6; hq should merge with merge
   * commits, but a squash in the GitHub UI must not wedge the sync). Our
   * commits `commits` (oldest first, all not on `base`) fork at `mergeBase`.
   * Returns the index of the newest commit C such that every file changed
   * between `mergeBase` and C has the same content in C and on `base` - all
   * commits up to C are on main already (their effect is), even when main
   * has moved on with other paths (daily reports). `-1` when none.
   */
  private async mergedPrefix(
    dir: string,
    base: string,
    mergeBase: string,
    commits: string[]
  ): Promise<number> {
    const literal = { env: { GIT_LITERAL_PATHSPECS: '1' } }
    for (let k = commits.length - 1; k >= 0; k--) {
      const files = core.fileList(
        await this.git(dir, [
          'diff',
          '--name-only',
          '--no-renames',
          mergeBase,
          commits[k],
        ])
      )
      if (files.length === 0) return k // no net change: nothing to lose
      const differ = (
        await this.git(
          dir,
          [
            'diff',
            '--name-only',
            '--no-renames',
            base,
            commits[k],
            '--',
            ...files,
          ],
          literal
        )
      ).trim()
      if (!differ) return k
    }
    return -1
  }

  /**
   * Commits on `origin/app/edits` that are neither ours nor on main (someone
   * fixed the PR by hand): cherry-picked onto HEAD so the next push keeps
   * them. "Ours" = committed as the app, or the same patch as one of ours
   * (`--cherry-pick`); merge commits (GitHub "Update branch") are skipped,
   * main is rebased in anyway. A pick that is already applied is skipped; a
   * conflict rolls the picks back and stops the sync (nothing is pushed, so
   * nothing is overwritten).
   */
  private async adoptForeignCommits(
    dir: string,
    base: string,
    remoteEdits: string
  ): Promise<void> {
    const out = await this.git(dir, [
      'log',
      '--no-merges',
      '--cherry-pick',
      '--right-only',
      '--reverse',
      '--format=%H %ce',
      `HEAD...${remoteEdits}`,
      '--not',
      base,
    ])
    const foreign = out
      .split('\n')
      .map((l) => l.trim().split(' '))
      .filter(
        ([sha, mail]) =>
          sha && mail?.toLowerCase() !== APP_IDENTITY.email.toLowerCase()
      )
      .map(([sha]) => sha)
    if (foreign.length === 0) return
    const before = (await revParse(this.git, dir, 'HEAD')) as string
    for (const sha of foreign) {
      try {
        await this.git(dir, ['cherry-pick', sha])
      } catch (error) {
        const files = await conflictedFiles(this.git, dir)
        if (files.length === 0) {
          // Already in HEAD / on main: the pick is empty.
          await this.git(dir, ['cherry-pick', '--skip']).catch(() =>
            this.git(dir, ['cherry-pick', '--abort'])
          )
          continue
        }
        await this.git(dir, ['cherry-pick', '--abort']).catch(() => undefined)
        await this.git(dir, ['reset', '--quiet', '--keep', before])
        this.worktreeChanged()
        throw new SyncStop(
          'foreign_conflict',
          error instanceof HqGitError ? error.stderr : String(error),
          files
        )
      }
      this.log.info(`adopted foreign commit ${sha.slice(0, 12)} on app/edits`)
    }
    this.worktreeChanged()
  }

  /** Nothing of ours on top of main: follow main; record a merge. */
  private async fastForward(dir: string, head: string, base: string) {
    if (head !== base) {
      await this.git(dir, ['merge', '--ff-only', '--quiet', base])
      this.worktreeChanged()
    }
    await this.updateCounts(dir)
    // First time we see nothing waiting: from now on everything is merged.
    if (!this.mergedSince) this.mergedSince = this.iso()
    this.prUrl = null
    this.lastError = null
  }

  /**
   * Rebases our commits onto `base`; with `mergedUpTo`, only the commits
   * after it (the ones before are on main already, see `mergedPrefix`).
   */
  private async rebase(
    dir: string,
    base: string,
    mergedUpTo: string | null
  ): Promise<void> {
    try {
      await this.git(
        dir,
        mergedUpTo
          ? ['rebase', '--quiet', '--onto', base, mergedUpTo]
          : ['rebase', '--quiet', base]
      )
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

  private async ensurePullRequest(
    dir: string,
    pushed: boolean,
    plan: { head: string; base: string }
  ): Promise<void> {
    // After a push, or while we do not know the PR yet (a failed attempt).
    if (!pushed && this.prUrl) return
    const [names, log] = await Promise.all([
      this.git(dir, ['diff', '--name-only', `${plan.base}...${plan.head}`]),
      this.git(dir, ['log', '--format=%B', `${plan.base}..${plan.head}`]),
    ])
    const body = core.pullRequestBody({
      files: core.fileList(names),
      editors: core.editorsFromLog(log),
      commitCount: this.unmergedCommits,
    })
    const token = this.currentToken()
    if (!token) {
      throw new GitHubError('Kein GitHub-Token für die Pull-Request.')
    }
    const pr = await ensurePullRequest(
      {
        apiUrl: this.githubApiUrl,
        token,
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
