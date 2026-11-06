/**
 * Z9: daily snapshots to hq (roadmap D14, §4a). The app writes into its own
 * path `data/production/**` of a **second worktree on `main`**
 * (`HQ_SNAPSHOT_DIR`, next to the `app/edits` worktree of the write clone)
 * and pushes straight to `main`, like the cash-register pipeline does with
 * its reports.
 *
 *   - after a Backzettel confirm (`backzettelConfirmed`, hooked into the Z3
 *     service): `data/production/backzettel/YYYY-MM-DD.{json,md}`
 *   - nightly (`snapshot-preorders` CLI, 22:15): `data/production/
 *     vorbestellungen/YYYY-MM-DD.json`
 *
 * Content comes from `hq-snapshots.core.js` (whitelists, no personal data -
 * D13). git: `add` + `commit` **with the pathspec `data/production`** only
 * (whatever else sits in the index stays out), then `push origin HEAD:main`;
 * a rejected push gets `pull --rebase` and one retry. Offline, the commit
 * stays local and the retry timer (15 min) pushes it later. Writing and
 * committing run under the short local lock (`withRepoLock`), fetch and push
 * under the network lock (`withNetworkLock`) - both shared with the
 * `app/edits` worktree of the same clone and with the CLI process. The commit
 * is made before the push waits for the network: whatever happens on the
 * wire, the snapshot is on disk and in the local history (`written`), and
 * the server's retry timer pushes it.
 */
import * as fs from 'fs'
import * as path from 'path'

import {
  countCommits,
  currentBranch,
  HqGit,
  HqGitError,
  NETWORK_GIT_TIMEOUT_MS,
  revParse,
  runHqGit,
  conflictedFiles,
  withNetworkLock,
  withRepoLock,
} from './hq-git'
import type { SyncError, SyncLog } from './hq-edits-sync.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-snapshots.core')
const writeback = require('./hq-writeback.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface HqSnapshotsOptions {
  /** Worktree on `main` (`HQ_SNAPSHOT_DIR`); `null` = disabled. */
  snapshotDir: string | null
  token?: string | null
  branch?: string
  remote?: string
  retryMs?: number
  /** Wait for another process's local lock (default 60 s; the CLI waits longer). */
  lockWaitMs?: number
  /** Wait for another process's network lock (default `NETWORK_LOCK_WAIT_MS`). */
  networkLockWaitMs?: number
  git?: HqGit
  now?: () => Date
  log?: SyncLog
}

export interface SnapshotOutcome {
  /** Files written (relative to the hq root). */
  files: string[]
  /**
   * The files are on disk and committed locally (or were unchanged) - the
   * push may still be pending. `false`: nothing was written (wrong branch,
   * disk, lock) and the snapshot must be made again.
   */
  written: boolean
  /** A new commit was made (false = nothing changed). */
  committed: boolean
  /** Everything is on GitHub (false = queued for the retry timer). */
  pushed: boolean
  error: SyncError | null
}

export interface SnapshotStatus {
  enabled: boolean
  reason: string | null
  branch: string
  pendingCommits: number
  lastCommitAt: string | null
  lastPushAt: string | null
  lastAttemptAt: string | null
  lastError: SyncError | null
}

const DEFAULT_LOG: SyncLog = {
  info: (...a) => console.log('[hq-snapshots]', ...a),
  warn: (...a) => console.warn('[hq-snapshots]', ...a),
  error: (...a) => console.error('[hq-snapshots]', ...a),
}

const MESSAGES: Record<string, string> = {
  wrong_branch:
    'Das Snapshot-Verzeichnis steht nicht auf main. Bitte den Entwickler informieren.',
  write_failed:
    'Die Snapshot-Dateien konnten nicht geschrieben werden (Platte voll? Rechte?).',
}

/** Writes `content` via `.tmp` + rename, creating the directory. */
function writeFileAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.tmp`
  )
  fs.writeFileSync(tmp, content, 'utf-8')
  try {
    fs.renameSync(tmp, file)
  } catch (error) {
    fs.rmSync(tmp, { force: true })
    throw error
  }
}

export class HqSnapshotWriter {
  readonly snapshotDir: string | null
  readonly branch: string
  readonly remote: string
  readonly retryMs: number
  private readonly token: string | null
  private readonly git: HqGit
  private readonly now: () => Date
  private readonly log: SyncLog
  private readonly lockWaitMs?: number
  private readonly networkLockWaitMs?: number
  private timer: NodeJS.Timeout | null = null
  private inflight = new Set<Promise<unknown>>()

  private pendingCommits = 0
  private lastCommitAt: string | null = null
  private lastPushAt: string | null = null
  private lastAttemptAt: string | null = null
  private lastError: SyncError | null = null

  constructor(options: HqSnapshotsOptions) {
    this.snapshotDir = options.snapshotDir
      ? path.resolve(options.snapshotDir)
      : null
    this.token = options.token || null
    this.branch = options.branch || writeback.BASE_BRANCH
    this.remote = options.remote || 'origin'
    this.retryMs = options.retryMs ?? writeback.DEFAULT_RETRY_MS
    this.git = options.git ?? runHqGit
    this.now = options.now ?? (() => new Date())
    this.log = options.log ?? DEFAULT_LOG
    this.lockWaitMs = options.lockWaitMs
    this.networkLockWaitMs = options.networkLockWaitMs
  }

  get enabled(): boolean {
    return this.snapshotDir !== null
  }

  status(): SnapshotStatus {
    return {
      enabled: this.enabled,
      reason: this.enabled
        ? null
        : 'HQ_SNAPSHOT_DIR ist nicht gesetzt - Backzettel und Vorbestellungen werden nicht nach hq geschrieben.',
      branch: this.branch,
      pendingCommits: this.pendingCommits,
      lastCommitAt: this.lastCommitAt,
      lastPushAt: this.lastPushAt,
      lastAttemptAt: this.lastAttemptAt,
      lastError: this.lastError,
    }
  }

  start(): void {
    if (!this.enabled || this.timer) return
    this.timer = setInterval(() => {
      void this.track(this.retry())
    }, this.retryMs)
    this.timer.unref()
    void this.track(this.retry())
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Resolves when every snapshot started so far has finished (tests, shutdown). */
  async idle(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.allSettled([...this.inflight])
    }
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.inflight.add(promise)
    promise.then(
      () => this.inflight.delete(promise),
      () => this.inflight.delete(promise)
    )
    return promise
  }

  /**
   * Hook for the Backzettel confirm (Z3). Never throws and never delays the
   * confirm: the write runs in the background, failures go to the status.
   */
  backzettelConfirmed(day: unknown, role: string | null | undefined): void {
    if (!this.enabled) return
    void this.track(
      this.writeBackzettel(day, role).catch((error) => {
        this.log.error('Backzettel snapshot failed:', error)
      })
    )
  }

  /**
   * Hook for the Backzettel reopen (Z3): the day's snapshot in hq is
   * replaced by a "wieder geöffnet" note, so nobody reads a release that no
   * longer holds. Background, never throws (like `backzettelConfirmed`).
   */
  backzettelReopened(date: string, role: string | null | undefined): void {
    if (!this.enabled) return
    void this.track(
      this.writeBackzettelReopened(date, role).catch((error) => {
        this.log.error('Backzettel reopen snapshot failed:', error)
      })
    )
  }

  async writeBackzettelReopened(
    date: string,
    role: string | null | undefined
  ): Promise<SnapshotOutcome> {
    const snapshot = core.backzettelReopenedSnapshot({
      date,
      at: this.now(),
      role,
    })
    const paths = core.snapshotPaths(snapshot.date)
    return this.commitFiles(
      [
        { rel: paths.backzettelJson, content: core.toJsonFile(snapshot) },
        { rel: paths.backzettelMd, content: core.backzettelMarkdown(snapshot) },
      ],
      core.backzettelReopenedCommitMessage(snapshot.date)
    )
  }

  /** Writes and pushes the snapshot of a confirmed Backzettel day. */
  async writeBackzettel(
    day: unknown,
    role: string | null | undefined
  ): Promise<SnapshotOutcome> {
    const snapshot = core.backzettelSnapshot(day, { role })
    const paths = core.snapshotPaths(snapshot.date)
    return this.commitFiles(
      [
        { rel: paths.backzettelJson, content: core.toJsonFile(snapshot) },
        { rel: paths.backzettelMd, content: core.backzettelMarkdown(snapshot) },
      ],
      core.backzettelCommitMessage(snapshot.date)
    )
  }

  /**
   * Writes and pushes the preorder sums of one pickup day. `variantsOf`
   * (product id → configured variants, `null` = none known) keeps only
   * configured variant slugs - free-typed ones become `null` (D13).
   */
  async writePreorders(
    dayData: unknown,
    options: { variantsOf?: (productId: string) => string[] | null } = {}
  ): Promise<SnapshotOutcome> {
    const snapshot = core.preorderSnapshot(dayData, {
      variantsOf: options.variantsOf,
    })
    const paths = core.snapshotPaths(snapshot.date)
    return this.commitFiles(
      [{ rel: paths.preordersJson, content: core.toJsonFile(snapshot) }],
      core.preordersCommitMessage(snapshot.date)
    )
  }

  /** Pushes queued commits (retry timer). */
  async retry(): Promise<SnapshotOutcome> {
    const dir = this.snapshotDir
    if (!dir) {
      return {
        files: [],
        written: false,
        committed: false,
        pushed: false,
        error: null,
      }
    }
    this.lastAttemptAt = this.iso()
    const error = await this.push(dir)
    return { files: [], written: true, committed: false, pushed: !error, error }
  }

  // ------------------------------------------------------------ internals

  private iso(): string {
    return this.now().toISOString()
  }

  private record(error: unknown, files?: string[]): SyncError {
    let code = 'git_failed'
    let detail: string | null = null
    if (error instanceof HqGitError) {
      code = error.code
      detail = error.stderr || error.message
    } else if (error instanceof Error && error.message in MESSAGES) {
      code = error.message
    } else {
      detail = String((error as Error)?.message ?? error)
    }
    this.lastError = {
      code,
      message: MESSAGES[code] ?? writeback.syncErrorMessage(code),
      detail: detail ? detail.slice(0, 500) : null,
      ...(files ? { files } : {}),
      at: this.iso(),
    }
    this.log.warn(`snapshot sync failed (${code}): ${detail ?? ''}`)
    return this.lastError
  }

  private async commitFiles(
    files: { rel: string; content: string }[],
    message: string
  ): Promise<SnapshotOutcome> {
    const dir = this.snapshotDir
    const rels = files.map((f) => f.rel)
    if (!dir) {
      return {
        files: [],
        written: false,
        committed: false,
        pushed: false,
        error: null,
      }
    }
    let committed = false
    try {
      // Local lock only: write + commit take a moment, never the network.
      committed = await withRepoLock(
        dir,
        async () => {
          this.lastAttemptAt = this.iso()
          const branch = await currentBranch(this.git, dir)
          if (branch !== this.branch) throw new Error('wrong_branch')
          try {
            for (const f of files) {
              writeFileAtomic(path.join(dir, f.rel), f.content)
            }
          } catch (error) {
            this.log.error('writing snapshot files failed:', error)
            throw new Error('write_failed')
          }
          // Only our path - ever. Also picks up an earlier write whose commit
          // failed; a file staged by hand elsewhere is never committed.
          await this.git(dir, ['add', '-A', '--', core.SNAPSHOT_ROOT])
          const staged = (
            await this.git(dir, [
              'diff',
              '--cached',
              '--name-only',
              '--',
              core.SNAPSHOT_ROOT,
            ])
          ).trim()
          if (!staged) return false
          await this.git(dir, [
            'commit',
            '-q',
            '-m',
            message,
            '--',
            core.SNAPSHOT_ROOT,
          ])
          this.lastCommitAt = this.iso()
          this.log.info(message.trim())
          return true
        },
        { waitMs: this.lockWaitMs }
      )
    } catch (error) {
      return {
        files: rels,
        written: false,
        committed: false,
        pushed: false,
        error: this.record(error),
      }
    }
    const error = await this.push(dir)
    return { files: rels, written: true, committed, pushed: !error, error }
  }

  /**
   * Pushes local commits to `main` under the network lock: rejected → fetch,
   * rebase onto `origin/main` (local lock, `--autostash`: a file staged by
   * hand survives) + one retry; offline or locked → stays queued. Pushes the
   * sha it read, so a commit made meanwhile simply waits for the next push.
   * Returns the recorded error or `null`; never throws.
   */
  private async push(dir: string): Promise<SyncError | null> {
    const remoteRef = `refs/remotes/${this.remote}/${this.branch}`
    const net = { token: this.token, timeoutMs: NETWORK_GIT_TIMEOUT_MS }
    const count = async () =>
      (await revParse(this.git, dir, remoteRef))
        ? countCommits(this.git, dir, `${remoteRef}..HEAD`)
        : countCommits(this.git, dir, 'HEAD')
    const pushSha = (sha: string) =>
      this.git(
        dir,
        [
          'push',
          '--porcelain',
          this.remote,
          `${sha}:refs/heads/${this.branch}`,
        ],
        net
      )

    try {
      return await withNetworkLock(
        dir,
        async () => {
          const branch = await currentBranch(this.git, dir)
          if (branch !== this.branch) throw new Error('wrong_branch')
          this.pendingCommits = await count()
          if (this.pendingCommits === 0) {
            this.lastError = null
            return null
          }
          let head = (await revParse(this.git, dir, 'HEAD')) as string
          try {
            try {
              await pushSha(head)
            } catch (error) {
              if (
                !(error instanceof HqGitError) ||
                error.code !== 'push_rejected'
              ) {
                throw error
              }
              this.log.warn('push rejected, fetch + rebase and one retry')
              await this.git(
                dir,
                [
                  'fetch',
                  '--quiet',
                  this.remote,
                  `+refs/heads/${this.branch}:${remoteRef}`,
                ],
                net
              )
              const conflict = await withRepoLock(
                dir,
                () => this.rebaseOntoRemote(dir, remoteRef),
                { waitMs: this.lockWaitMs }
              )
              if (conflict) {
                this.pendingCommits = await count()
                return this.record(
                  new HqGitError(
                    'rebase_conflict',
                    'rebase conflict',
                    ['rebase'],
                    conflict.detail
                  ),
                  conflict.files
                )
              }
              head = (await revParse(this.git, dir, 'HEAD')) as string
              await pushSha(head)
            }
          } catch (error) {
            this.pendingCommits = await count()
            return this.record(error)
          }
          await this.git(dir, ['update-ref', remoteRef, head])
          this.pendingCommits = await count()
          this.lastPushAt = this.iso()
          this.lastError = null
          return null
        },
        { waitMs: this.networkLockWaitMs }
      )
    } catch (error) {
      // wrong branch, repo_locked: the commit (if any) stays queued.
      this.pendingCommits = await count().catch(() => this.pendingCommits)
      return this.record(error)
    }
  }

  /** `rebase --autostash` onto the fetched main; a conflict is aborted. */
  private async rebaseOntoRemote(
    dir: string,
    remoteRef: string
  ): Promise<{ files: string[]; detail: string } | null> {
    try {
      await this.git(dir, ['rebase', '--autostash', '--quiet', remoteRef])
      return null
    } catch (error) {
      const files = await conflictedFiles(this.git, dir)
      await this.git(dir, ['rebase', '--abort']).catch(() => undefined)
      if (
        files.length > 0 ||
        (error instanceof HqGitError && error.code === 'rebase_conflict')
      ) {
        return {
          files,
          detail: error instanceof HqGitError ? error.stderr : String(error),
        }
      }
      throw error
    }
  }
}
