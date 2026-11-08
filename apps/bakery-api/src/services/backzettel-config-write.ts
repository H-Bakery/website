/**
 * Grundmengen in `hq/config/backzettel.yaml` speichern (Z4, roadmap D6, §5.5
 * Bildschirm 1) - derselbe Weg wie die hq-Produkte (B5/B5b):
 *
 *   - `HQ_WRITE_DIR` gesetzt (Box): die Datei im Schreib-Worktree
 *     (`app/edits`) ändern und dort committen, Autor `Verwaltung (App)`,
 *     Bearbeiter als `Co-authored-by`. Push + rollende PR macht
 *     `HqEditsSync` (`afterCommit`). Bis zum Merge ist die YAML im Worktree
 *     anders als auf `origin/main`: `pendingApproval` („wartet auf
 *     Freigabe"). Der Backzettel rechnet bis dahin mit dem freigegebenen
 *     Stand (Lese-Klon).
 *   - ohne `HQ_WRITE_DIR` (Entwicklung): direkt in die gelesene Datei
 *     (`HQ_BACKZETTEL_CONFIG` bzw. `${HQ_DIR}/config/backzettel.yaml`), ohne
 *     git. In Produktion wird dann nicht geschrieben (503).
 *
 * Geändert wird nur der Text des einen Werts (`backzettel-config.editor.js`);
 * Kommentare, Reihenfolge und Schreibweise bleiben. Eine Änderung, die
 * nichts ändert, schreibt und committet nichts. Vor dem Schreiben prüft
 * `validateBackzettelConfig` das Ergebnis; neue Fehler → 400, nichts
 * geschrieben.
 */
import * as fs from 'fs'
import * as path from 'path'

import { BackzettelSource, OpenMasterDataEntry } from './backzettel-source'
import { BackzettelError } from './backzettel.service'
import {
  currentBranch,
  HqGit,
  HqGitError,
  runHqGit,
  withRepoLock,
} from './hq-git'

/* eslint-disable @typescript-eslint/no-var-requires */
const loader = require('./backzettel-config.loader')
const configCore = require('./backzettel-config.core')
const baseCore = require('./backzettel-base.core')
const editor = require('./backzettel-config.editor')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Pfad der Stammdaten in hq (relativ zur Wurzel des Repos). */
export const BACKZETTEL_CONFIG_REL = 'config/backzettel.yaml'

export interface ConfigEditor {
  id?: number | null
  displayName: string
}

export interface BackzettelConfigWriteOptions {
  /** Wurzel des Schreib-Worktrees (`HQ_WRITE_DIR`), `null` = Entwicklung. */
  writeDir?: string | null
  /** Branch, auf dem der Worktree stehen muss (Default `app/edits`). */
  writeBranch?: string
  /** Produktion: ohne Schreib-Worktree nicht schreiben (503). */
  production?: boolean
  git?: HqGit
  /** B5b: nach jedem Commit (Push + PR anstoßen). */
  afterCommit?: () => void
  /**
   * B5b: Inhalt einer Datei auf `origin/main` (`null` = gibt es dort nicht,
   * `undefined` = unbekannt → Lese-Klon).
   */
  approvedFile?: (rel: string) => string | null | undefined
}

export interface ConfigReason {
  path: string
  message: string
}

/**
 * Die Stammdaten, auf denen ein Speichern aufbaut. `config` ist auch bei
 * `status: 'no-config'` gesetzt, solange sich die YAML lesen lässt
 * (normalisiert, mit `errors`): ein Speichern scheitert nur an Fehlern, die
 * es selbst hinzufügt - ein fremder Fehler (z. B. ein in hq gelöschtes
 * Produkt) darf die Grundmengen-Seite nicht leer machen.
 */
export interface WorkingConfig {
  status: 'ok' | 'no-config'
  config: unknown | null
  errors: ConfigReason[]
  warnings: ConfigReason[]
  /** Z10: open master data of the working version (see `open` of the source). */
  open: OpenMasterDataEntry[]
}

export interface ConfigWriteStatus {
  /** Die YAML im Schreib-Worktree weicht vom freigegebenen Stand ab. */
  pendingApproval: boolean
  /**
   * Ob gespeichert werden kann: Schreibziel vorhanden und - mit
   * `HQ_WRITE_DIR` - ein git-Worktree auf `app/edits` (wie `target()`).
   */
  writable: boolean
  /** Warum nicht (`error` wie die 503 beim Speichern, `message` deutsch). */
  writeIssue: { error: string; message: string } | null
  /** Stand im Schreib-Worktree (sonst = freigegebener Stand). */
  working: WorkingConfig
}

/** Wie lange `GET /config` den geprüften Branch wiederverwendet. */
const BRANCH_CHECK_MS = 5_000

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch {
    return null
  }
}

/** Atomar schreiben: erst `.tmp`, dann `rename`. */
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

const MSG = {
  writeMissing: 'Das Schreibverzeichnis für hq (HQ_WRITE_DIR) fehlt.',
  writeNotRepo:
    'Das Schreibverzeichnis für hq ist kein git-Arbeitsverzeichnis. Bitte die Einrichtung prüfen.',
  wrongBranch: (branch: string, actual: string) =>
    `Das Schreibverzeichnis für hq steht nicht auf dem Branch ${branch} (sondern auf ${actual}). Änderungen werden nicht gespeichert.`,
  noConfig:
    'Die Backzettel-Stammdaten fehlen in hq; Grundmengen lassen sich erst speichern, wenn die Datei existiert.',
  commitFailed:
    'Die Änderung konnte nicht in hq gespeichert werden. Bitte später erneut versuchen.',
}

const EDIT_STATUS: Record<string, number> = {
  unknown_item: 404,
  config_unreadable: 409,
  config_layout_unsupported: 409,
  config_edit_failed: 409,
}

export function createBackzettelConfigWriter(
  source: BackzettelSource,
  options: BackzettelConfigWriteOptions = {}
) {
  const writeDir = options.writeDir ? path.resolve(options.writeDir) : null
  const writeBranch = options.writeBranch || 'app/edits'
  const production =
    options.production ?? process.env['NODE_ENV'] === 'production'
  const git = options.git ?? runHqGit
  const afterCommit = options.afterCommit ?? (() => undefined)
  const approvedFile = options.approvedFile ?? (() => undefined)
  const writeFile = writeDir ? path.join(writeDir, BACKZETTEL_CONFIG_REL) : null
  let queue: Promise<unknown> = Promise.resolve()

  /** Freigegebener Inhalt: `origin/main` (B5b), sonst der Lese-Klon. */
  function approvedText(): string | null {
    const fromMain = approvedFile(BACKZETTEL_CONFIG_REL)
    if (fromMain !== undefined) return fromMain
    return readIfExists(source.paths.configPath)
  }

  /**
   * Normalisierte Config trotz Validierungsfehlern, solange die YAML sich
   * parsen lässt (`null` sonst) - Grundlage der Tabelle bei fremden Fehlern.
   */
  function parsedConfig(text: string | null): unknown | null {
    if (text === null) return null
    const parsed = loader.parseBackzettelYaml(text)
    if (!parsed.ok) return null
    try {
      return configCore.normalizeConfig(parsed.data)
    } catch {
      return null
    }
  }

  function working(catalog: unknown): WorkingConfig {
    const result = loader.loadBackzettelConfig(writeFile as string, {
      products: catalog,
    })
    return {
      status: result.ok ? 'ok' : 'no-config',
      config: result.ok
        ? result.config
        : parsedConfig(readIfExists(writeFile as string)),
      errors: result.errors,
      warnings: result.warnings,
      open: Array.isArray(result.open) ? result.open : [],
    }
  }

  let branchCheck: {
    at: number
    issue: ConfigWriteStatus['writeIssue']
  } | null = null

  /** Dieselbe Prüfung wie `target()`, für die Anzeige kurz gecacht. */
  async function writeIssue(): Promise<ConfigWriteStatus['writeIssue']> {
    if (!writeDir) {
      return production
        ? { error: 'hq_write_unavailable', message: MSG.writeMissing }
        : null
    }
    if (!fs.existsSync(writeDir)) {
      return { error: 'hq_write_unavailable', message: MSG.writeMissing }
    }
    const now = Date.now()
    if (branchCheck && now - branchCheck.at < BRANCH_CHECK_MS) {
      return branchCheck.issue
    }
    let issue: ConfigWriteStatus['writeIssue'] = null
    try {
      const branch = await currentBranch(git, writeDir)
      if (branch !== writeBranch) {
        issue = {
          error: 'hq_write_wrong_branch',
          message: MSG.wrongBranch(writeBranch, branch),
        }
      }
    } catch {
      issue = { error: 'hq_write_unavailable', message: MSG.writeNotRepo }
    }
    branchCheck = { at: now, issue }
    return issue
  }

  /** Für `GET /config`: Freigabestatus, Schreibbarkeit und Arbeitsstand. */
  async function status(): Promise<ConfigWriteStatus> {
    const loaded = source.load()
    const issue = await writeIssue()
    const own = writeFile ? readIfExists(writeFile) : null
    if (own === null) {
      const exists = fs.existsSync(source.paths.configPath)
      return {
        pendingApproval: false,
        writable: issue === null && exists,
        writeIssue: issue,
        working: {
          status: loaded.ok ? 'ok' : 'no-config',
          config: loaded.ok
            ? loaded.config
            : parsedConfig(readIfExists(source.paths.configPath)),
          errors: loaded.reasons,
          warnings: loaded.warnings,
          open: loaded.open,
        },
      }
    }
    return {
      pendingApproval: own !== approvedText(),
      writable: issue === null,
      writeIssue: issue,
      working: working(loaded.catalog),
    }
  }

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const locked = writeDir ? () => withRepoLock(writeDir, job) : job
    const run = queue.then(locked, locked).catch((error) => {
      // Ein anderer Vorgang (Rebase, CLI) hält das Repo länger als 60 s.
      if (error instanceof HqGitError && error.code === 'repo_locked') {
        throw new BackzettelError(503, 'repo_locked', error.message)
      }
      throw error
    })
    queue = run.catch(() => undefined)
    return run
  }

  /** Zieldatei, oder ein Fehler (503) - wie bei den Produkten. */
  async function target(): Promise<string> {
    if (writeDir) {
      if (!fs.existsSync(writeDir)) {
        throw new BackzettelError(503, 'hq_write_unavailable', MSG.writeMissing)
      }
      let branch: string
      try {
        branch = await currentBranch(git, writeDir)
      } catch (error) {
        console.error('[backzettel] write worktree unusable:', error)
        throw new BackzettelError(503, 'hq_write_unavailable', MSG.writeNotRepo)
      }
      if (branch !== writeBranch) {
        console.error(
          `[backzettel] write worktree is on "${branch}", expected "${writeBranch}" - refusing to commit`
        )
        throw new BackzettelError(
          503,
          'hq_write_wrong_branch',
          MSG.wrongBranch(writeBranch, branch)
        )
      }
      return writeFile as string
    }
    if (production) {
      throw new BackzettelError(503, 'hq_write_unavailable', MSG.writeMissing)
    }
    return source.paths.configPath
  }

  async function commit(message: string): Promise<boolean> {
    const cwd = writeDir as string
    await git(cwd, ['add', '--', BACKZETTEL_CONFIG_REL])
    const staged = await git(cwd, [
      'diff',
      '--cached',
      '--name-only',
      '--',
      BACKZETTEL_CONFIG_REL,
    ])
    if (staged.trim() === '') return false
    // Pfadangabe: nur diese Datei, nie was sonst im Index liegt.
    await git(cwd, ['commit', '-q', '-m', message, '--', BACKZETTEL_CONFIG_REL])
    return true
  }

  /**
   * `PUT /config/base`: eine Grundmenge (ganzer Tag oder je Sorte) setzen.
   * Antwortet mit dem neuen Stand (`status()`) und `pending`.
   */
  function setBase(
    body: unknown,
    user: ConfigEditor
  ): Promise<ConfigWriteStatus & { pending: boolean; changed: boolean }> {
    return enqueue(async () => {
      const file = await target()
      // Basis: der Stand im Schreib-Worktree (frühere, noch nicht gemergte
      // Änderungen), sonst der freigegebene im Lese-Klon.
      const own = readIfExists(file)
      const text =
        own ?? (writeDir ? readIfExists(source.paths.configPath) : null)
      if (text === null) {
        throw new BackzettelError(409, 'no_config', MSG.noConfig)
      }
      const parsed = loader.parseBackzettelYaml(text)
      if (!parsed.ok) {
        throw new BackzettelError(
          409,
          'config_unreadable',
          `Die Backzettel-Stammdaten lassen sich nicht lesen: ${parsed.errors[0].message}`
        )
      }
      const check = baseCore.parseBaseEdit(
        body,
        configCore.normalizeConfig(parsed.data)
      )
      if (!check.ok) {
        throw new BackzettelError(check.status, check.error, check.message)
      }
      const edit = check.edit
      const result = editor.applyBaseEdit(text, edit)
      if (!result.ok) {
        throw new BackzettelError(
          EDIT_STATUS[result.error] ?? 409,
          result.error,
          result.message
        )
      }
      if (!result.changed) {
        const now = await status()
        return { ...now, pending: now.pendingApproval, changed: false }
      }

      const catalog = source.load().catalog
      const before = configCore.validateBackzettelConfig(result.before, {
        products: catalog,
      })
      const after = configCore.validateBackzettelConfig(result.after, {
        products: catalog,
      })
      const added = baseCore.newErrors(before.errors, after.errors)
      if (added.length > 0) {
        throw new BackzettelError(
          400,
          'validation',
          `So lässt sich die Grundmenge nicht speichern: ${added
            .slice(0, 3)
            .map((e: ConfigReason) => e.message)
            .join(' ')}`,
          { errors: added }
        )
      }

      writeFileAtomic(file, result.text)
      let committed = false
      if (writeDir) {
        try {
          committed = await commit(baseCore.commitMessage(edit, user))
        } catch (error) {
          console.error('[backzettel] commit failed:', error)
          if (own === null) fs.rmSync(file, { force: true })
          else writeFileAtomic(file, own)
          await git(writeDir, [
            'reset',
            '-q',
            '--',
            BACKZETTEL_CONFIG_REL,
          ]).catch(() => undefined)
          throw new BackzettelError(500, 'hq_commit_failed', MSG.commitFailed)
        }
      }
      if (committed) {
        try {
          afterCommit()
        } catch (error) {
          console.error('[backzettel] afterCommit failed:', error)
        }
      }
      const now = await status()
      return { ...now, pending: now.pendingApproval, changed: true }
    })
  }

  return { status, setBase, writeDir, writeFile }
}

export type BackzettelConfigWriter = ReturnType<
  typeof createBackzettelConfigWriter
>
