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
 * stays local and the retry timer (15 min) pushes it later. Every step runs
 * under `withRepoLock`, shared with the `app/edits` worktree of the same
 * clone and with the CLI process.
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
  git?: HqGit
  now?: () => Date
  log?: SyncLog
}

export interface SnapshotOutcome {
  /** Files written (relative to the hq root). */
  files: string[]
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

  /** Writes and pushes the preorder sums of one pickup day. */
  async writePreorders(dayData: unknown): Promise<SnapshotOutcome> {
    const snapshot = core.preorderSnapshot(dayData)
    const paths = core.snapshotPaths(snapshot.date)
    return this.commitFiles(
      [{ rel: paths.preordersJson, content: core.toJsonFile(snapshot) }],
      core.preordersCommitMessage(snapshot.date)
    )
  }

  /** Pushes queued commits (retry timer). */
  retry(): Promise<SnapshotOutcome> {
    const dir = this.snapshotDir
    if (!dir) {
      return Promise.resolve({
        files: [],
        committed: false,
        pushed: false,
        error: null,
      })
    }
    return withRepoLock(dir, async () => {
      this.lastAttemptAt = this.iso()
      const error = await this.push(dir)
      return { files: [], committed: false, pushed: !error, error }
    }).catch((error) => ({
      files: [],
      committed: false,
      pushed: false,
      error: this.record(error),
    }))
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
      return { files: [], committed: false, pushed: false, error: null }
    }
    return withRepoLock(dir, async () => {
      this.lastAttemptAt = this.iso()
      const branch = await currentBranch(this.git, dir)
      if (branch !== this.branch) throw new Error('wrong_branch')
      try {
        for (const f of files) writeFileAtomic(path.join(dir, f.rel), f.content)
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
      let committed = false
      if (staged) {
        await this.git(dir, [
          'commit',
          '-q',
          '-m',
          message,
          '--',
          core.SNAPSHOT_ROOT,
        ])
        committed = true
        this.lastCommitAt = this.iso()
        this.log.info(message.trim())
      }
      const error = await this.push(dir)
      return { files: rels, committed, pushed: !error, error }
    }).catch((error) => ({
      files: rels,
      committed: false,
      pushed: false,
      error: this.record(error),
    }))
  }

  /**
   * Pushes local commits to `main`: rejected → `pull --rebase` + one retry;
   * offline → stays queued. Returns the recorded error or `null`.
   */
  private async push(dir: string): Promise<SyncError | null> {
    const branch = await currentBranch(this.git, dir)
    if (branch !== this.branch) throw new Error('wrong_branch')
    const remoteRef = `refs/remotes/${this.remote}/${this.branch}`
    const net = { token: this.token, timeoutMs: NETWORK_GIT_TIMEOUT_MS }
    const count = async () =>
      (await revParse(this.git, dir, remoteRef))
        ? countCommits(this.git, dir, `${remoteRef}..HEAD`)
        : countCommits(this.git, dir, 'HEAD')

    this.pendingCommits = await count()
    if (this.pendingCommits === 0) {
      this.lastError = null
      return null
    }
    const pushOnce = () =>
      this.git(
        dir,
        ['push', '--porcelain', this.remote, `HEAD:refs/heads/${this.branch}`],
        net
      )
    try {
      try {
        await pushOnce()
      } catch (error) {
        if (!(error instanceof HqGitError) || error.code !== 'push_rejected') {
          throw error
        }
        this.log.warn('push rejected, pull --rebase and one retry')
        try {
          await this.git(
            dir,
            [
              'pull',
              '--rebase',
              '--autostash',
              '--quiet',
              this.remote,
              this.branch,
            ],
            net
          )
        } catch (pullError) {
          const files = await conflictedFiles(this.git, dir)
          if (
            files.length > 0 ||
            (pullError as HqGitError).code === 'rebase_conflict'
          ) {
            await this.git(dir, ['rebase', '--abort']).catch(() => undefined)
            this.pendingCommits = await count()
            return this.record(
              new HqGitError(
                'rebase_conflict',
                'rebase conflict',
                ['pull'],
                (pullError as HqGitError).stderr ?? String(pullError)
              ),
              files
            )
          }
          throw pullError
        }
        await pushOnce()
      }
    } catch (error) {
      this.pendingCommits = await count()
      return this.record(error)
    }
    await this.git(dir, ['update-ref', remoteRef, 'HEAD'])
    this.pendingCommits = 0
    this.lastPushAt = this.iso()
    this.lastError = null
    return null
  }
}
