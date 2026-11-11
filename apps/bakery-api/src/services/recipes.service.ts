/**
 * Rezepte aus `hq/data/recipes/<kategorie>/<datei>` lesen und schreiben
 * (Owner-Wunsch 2026-11-11, vorgezogen aus M5). Regeln:
 * `docs/domains/rezepte.md`, Vertrag: `docs/api/recipes.md`.
 *
 * Lesen: der Stand, auf dem ein Speichern aufbaut - die Datei im
 * Schreib-Worktree, falls vorhanden, sonst der freigegebene Stand (wie bei
 * den hq-Produkten, B5). Je Rezept `pending`: `created` / `changed` /
 * `deleted`, solange der Schreib-Worktree vom freigegebenen Stand
 * (`origin/main`, sonst Lese-Klon) abweicht.
 *
 * Schreiben - derselbe Weg wie Produkte und Grundmengen (B5/B5b):
 *   - `HQ_WRITE_DIR` gesetzt (Box): Datei im Worktree (`app/edits`) ändern
 *     und dort mit Pfadangabe committen, Autor `Verwaltung (App)`,
 *     Bearbeiter als `Co-authored-by`. Push + rollende PR macht
 *     `HqEditsSync` (`afterCommit`). Der Lese-Klon wird nie geschrieben.
 *   - ohne `HQ_WRITE_DIR` (Entwicklung): direkt ins gelesene Verzeichnis,
 *     ohne git. In Produktion wird dann nicht geschrieben (503).
 *
 * Geparst und serialisiert wird ausschließlich in `recipe-file.core.js`
 * (verlustfrei; ein Speichern ohne Änderung schreibt und committet nichts).
 * Diese Datei macht nur I/O, git und die Verweise des Backzettels.
 */
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import {
  currentBranch,
  HqGit,
  HqGitError,
  runHqGit,
  withRepoLock,
} from './hq-git'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./recipe-file.core')
const backzettelRecipes = require('./backzettel-recipes.core')
const backzettelLoader = require('./backzettel-config.loader')
const { coAuthorTrailer } = require('./hq-products.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Verzeichnis der Rezepte in hq (relativ zur Wurzel des Repos). */
export const RECIPES_REL = 'data/recipes'
/** Größere Dateien sind kein Rezept (und werden nicht gelesen). */
export const RECIPE_MAX_BYTES = 512 * 1024

export interface RecipeIngredient {
  name: string
  /** `null` = Menge offen (nie 0). */
  amount: number | null
  unit: string | null
  note: string | null
}

export interface RecipePart {
  title: string | null
  ingredients: RecipeIngredient[]
  /** Summenzeile der Datei (`**Gesamtmasse**`), wie sie dort steht. */
  total: { label: string; text: string } | null
}

export interface RecipeStepGroup {
  title: string | null
  /** Nummerierte Schritte (`1.`) oder Stichpunkte (`-`). */
  ordered: boolean
  items: string[]
}

/** Wer in `config/backzettel.yaml` auf das Rezept zeigt. */
export interface RecipeUse {
  kind: string
  id: string | null
  name: string | null
  section: string | null
}

export type RecipePending = null | 'created' | 'changed' | 'deleted'
export type RecipeFormat = 'standard' | 'table' | 'teig' | 'unknown'

export interface RecipeSummary {
  /** `<category>/<slug>` - auch der Pfad der API. */
  id: string
  category: string
  categoryLabel: string
  slug: string
  /** Dateiname in hq. */
  file: string
  /** Pfad in hq, z. B. `data/recipes/breads/musterbrot.md`. */
  path: string
  format: RecipeFormat
  title: string
  /** Ertrag als Text der Datei; `null` = offen. */
  yield: string | null
  ingredientCount: number
  editable: boolean
  readOnlyReason: string | null
  pendingApproval: boolean
  pending: RecipePending
  usedByBackzettel: RecipeUse[]
}

export interface Recipe extends RecipeSummary {
  description: string | null
  parts: RecipePart[]
  steps: RecipeStepGroup[]
  notes: string | null
  /** Was die Datei sonst noch sagt (Backzeit, Schlagworte, Quelle …), nur Anzeige. */
  meta: { key: string; label: string; value: string | null }[]
  /** Abschnitte, die das Modell nicht deutet - wörtlich, nur Anzeige. */
  sections: { title: string | null; text: string }[]
  /** Für `expectedVersion` beim Speichern und Löschen. */
  version: string
  deletable: boolean
  deleteBlockedReason: string | null
}

export interface RecipeCategory {
  id: string
  label: string
  count: number
  /** Neue Rezepte und Änderungen möglich (nicht `teige`). */
  writable: boolean
}

export interface RecipeList {
  status: 'ok' | 'no-data'
  /** Nur bei `no-data`. */
  message?: string
  categories: RecipeCategory[]
  recipes: RecipeSummary[]
  count: number
  /** Einheiten, die beim Speichern erlaubt sind. */
  units: string[]
  /** Schreibziel vorhanden (unabhängig von der Rolle). */
  writable: boolean
  writeIssue: { error: string; message: string } | null
  /** Löschen und Verschieben freigeschaltet. */
  canDelete: boolean
  deleteIssue: string | null
}

export interface RecipeEditor {
  id?: number | null
  displayName: string
}

export interface RecipesOptions {
  /** Lese-Klon `data/recipes` (Default `HQ_RECIPES_DIR`, sonst `${HQ_DIR}/data/recipes`). */
  recipesDir?: string
  /** Wurzel des Schreib-Worktrees (`HQ_WRITE_DIR`), `null` = Entwicklung. */
  writeDir?: string | null
  /** Branch, auf dem der Worktree stehen muss (Default `app/edits`). */
  writeBranch?: string
  /** Produktion: ohne Schreib-Worktree nicht schreiben (503). */
  production?: boolean
  git?: HqGit
  /**
   * B5b: Rezeptdateien auf `origin/main` (Pfad unter `data/recipes` →
   * Inhalt). `null`/nicht gesetzt = Lese-Klon.
   */
  approvedFiles?: () => ReadonlyMap<string, string> | null
  /** B5b: nach jedem Commit (Push + PR anstoßen). */
  afterCommit?: () => void
  /**
   * `config/backzettel.yaml` in allen Ständen (freigegeben, Schreib-Worktree):
   * ein Rezept, auf das eine davon zeigt, wird nicht gelöscht oder verschoben.
   */
  backzettelConfigPaths?: () => string[]
  /**
   * Löschen und Verschieben erlauben. Default: `HQ_RECIPES_ALLOW_DELETE=1`,
   * sonst nur ohne Schreib-Worktree (Entwicklung) - die Pfadwache von hq
   * lehnt Löschungen aus `app/edits` ab, bis sie es für Rezepte erlaubt.
   */
  allowDelete?: boolean
}

/** Ergebnis eines Schreibvorgangs (flach, wie bei den Produkten). */
export interface RecipeWriteResult {
  ok: boolean
  status: number
  data?: Recipe | { id: string; deleted: true }
  pending?: boolean
  changed?: boolean
  /** Für das Audit-Log. */
  audit?: {
    action: 'create' | 'update' | 'delete'
    id: string
    data: Record<string, unknown>
  }
  error?: string
  message?: string
  extra?: Record<string, unknown>
}

const fail = (
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): RecipeWriteResult => ({ ok: false, status, error, message, extra })

const MSG = {
  noData:
    'Das Rezeptverzeichnis aus hq (data/recipes) wurde nicht gefunden. Rezepte gibt es erst, wenn hq eingerichtet ist.',
  readMissing: 'Das Rezeptverzeichnis aus hq wurde nicht gefunden.',
  writeMissing: 'Das Schreibverzeichnis für hq (HQ_WRITE_DIR) fehlt.',
  writeNotRepo:
    'Das Schreibverzeichnis für hq ist kein git-Arbeitsverzeichnis. Bitte die Einrichtung prüfen.',
  wrongBranch: (branch: string, actual: string) =>
    `Das Schreibverzeichnis für hq steht nicht auf dem Branch ${branch} (sondern auf ${actual}). Änderungen werden nicht gespeichert.`,
  repoLocked:
    'hq wird gerade von einem anderen Vorgang benutzt. Bitte gleich noch einmal versuchen.',
  notFound: 'Rezept nicht gefunden.',
  versionRequired:
    'Der Stand des Rezepts fehlt (expectedVersion). Bitte das Rezept neu laden und noch einmal speichern.',
  stale:
    'Das Rezept wurde inzwischen geändert. Bitte neu laden und die Änderung noch einmal eintragen.',
  exists: 'Ein Rezept mit diesem Namen gibt es in dieser Kategorie schon.',
  invalidCategory:
    'Diese Kategorie gibt es nicht oder sie lässt sich hier nicht bearbeiten.',
  invalidId:
    'Aus dem Namen lässt sich kein Dateiname bilden. Bitte einen Namen mit Buchstaben oder Ziffern wählen.',
  deleted:
    'Dieses Rezept wurde gelöscht; die Löschung wartet auf Freigabe in hq.',
  deleteOff:
    'Löschen und Verschieben von Rezepten ist noch nicht freigeschaltet: hq nimmt Löschungen aus der Verwaltung erst an, wenn die Pfadwache dort angepasst ist.',
  outOfSync:
    'Das Rezept ist im Schreibverzeichnis von hq noch nicht vorhanden. Bitte in ein paar Minuten noch einmal versuchen.',
  notUtf8:
    'Die Datei ist kein gültiger UTF-8-Text und lässt sich nur in hq bearbeiten.',
  commitFailed:
    'Die Änderung konnte nicht in hq gespeichert werden. Bitte später erneut versuchen.',
  inUse: (uses: RecipeUse[]) =>
    `Der Backzettel verwendet dieses Rezept (${uses
      .map((u) => u.name || u.id || u.kind)
      .join(
        ', '
      )}). Es lässt sich bearbeiten, aber nicht löschen oder verschieben.`,
  sectionInUse: (use: RecipeUse) =>
    `Der Backzettel verwendet aus diesem Rezept den Teil „${
      use.section || use.name || use.id
    }“. Er lässt sich bearbeiten, aber nicht umbenennen oder entfernen.`,
}

/** Was `parseRecipeFile` liefert, soweit der Dienst es braucht. */
interface ParsedRecipe {
  format: RecipeFormat
  model: {
    title: string
    yield: string | null
    description: string | null
    parts: RecipePart[]
    steps: RecipeStepGroup[]
    notes: string | null
    meta: Recipe['meta']
    sections: Recipe['sections']
  }
  editable: boolean
  readOnlyReason: string | null
}

interface FileOnDisk {
  category: string
  fileName: string
  full: string
}

interface Entry {
  category: string
  fileName: string
  slug: string
  id: string
  /** `<category>/<fileName>`, NFC - Schlüssel über alle Stände. */
  rel: string
  /** Inhalt, auf dem ein Speichern aufbaut. */
  text: string
  /** Die Datei liegt im Schreibziel (sonst nur im freigegebenen Stand). */
  inTarget: boolean
  pending: RecipePending
  lossless: boolean
}

const BRANCH_CHECK_MS = 5_000

function nfc(text: string): string {
  return text.normalize('NFC')
}

function versionOf(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex')
    .slice(0, 24)
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

/** Rezeptdateien eines `data/recipes`-Verzeichnisses (nie Symlinks, nie außerhalb). */
function filesIn(root: string | null): Map<string, FileOnDisk> {
  const out = new Map<string, FileOnDisk>()
  if (!root) return out
  let dirs: fs.Dirent[]
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const dir of dirs) {
    if (!dir.isDirectory() || !core.CATEGORY_DIR.test(dir.name)) continue
    let files: fs.Dirent[]
    try {
      files = fs.readdirSync(path.join(root, dir.name), { withFileTypes: true })
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.isFile() || !core.isRecipeFileName(file.name)) continue
      out.set(`${dir.name}/${nfc(file.name)}`, {
        category: dir.name,
        fileName: file.name,
        full: path.join(root, dir.name, file.name),
      })
    }
  }
  return out
}

function readText(full: string): { text: string; lossless: boolean } | null {
  try {
    const stat = fs.statSync(full)
    if (!stat.isFile() || stat.size > RECIPE_MAX_BYTES) return null
    const buffer = fs.readFileSync(full)
    const text = buffer.toString('utf-8')
    return {
      text,
      lossless:
        !text.includes('\u0000') && Buffer.from(text, 'utf-8').equals(buffer),
    }
  } catch {
    return null
  }
}

export class RecipesService {
  /** Lese-Klon `data/recipes`. */
  readonly recipesDir: string
  readonly writeDir: string | null
  readonly writeBranch: string
  readonly production: boolean
  readonly allowDelete: boolean
  private readonly git: HqGit
  private readonly approvedFiles: () => ReadonlyMap<string, string> | null
  private readonly afterCommit: () => void
  private readonly backzettelConfigPaths: () => string[]
  private queue: Promise<unknown> = Promise.resolve()
  private branchCheck: { at: number; issue: RecipeList['writeIssue'] } | null =
    null
  private deletedCache: { head: string; paths: Set<string> } | null = null
  private configCache = new Map<
    string,
    { stamp: string; uses: (RecipeUse & { key: string })[] }
  >()

  constructor(options: RecipesOptions = {}) {
    this.recipesDir = path.resolve(
      options.recipesDir ??
        process.env['HQ_RECIPES_DIR'] ??
        path.join(
          process.env['HQ_DIR'] ?? path.join(process.cwd(), '..', 'hq'),
          'data',
          'recipes'
        )
    )
    this.writeDir = options.writeDir ? path.resolve(options.writeDir) : null
    this.writeBranch = options.writeBranch || 'app/edits'
    this.production =
      options.production ?? process.env['NODE_ENV'] === 'production'
    this.allowDelete =
      options.allowDelete ??
      (process.env['HQ_RECIPES_ALLOW_DELETE'] === '1' || this.writeDir === null)
    this.git = options.git ?? runHqGit
    this.approvedFiles = options.approvedFiles ?? (() => null)
    this.afterCommit = options.afterCommit ?? (() => undefined)
    this.backzettelConfigPaths = options.backzettelConfigPaths ?? (() => [])
  }

  /** `${HQ_WRITE_DIR}/data/recipes` oder `null`. */
  get writeRecipesDir(): string | null {
    return this.writeDir ? path.join(this.writeDir, RECIPES_REL) : null
  }

  // ------------------------------------------------------------ Verweise

  /** Alle `recipe:`-Verweise der Backzettel-Stammdaten (beide Stände). */
  private references(): (RecipeUse & { key: string })[] {
    const out: (RecipeUse & { key: string })[] = []
    const seen = new Set<string>()
    for (const file of new Set(this.backzettelConfigPaths())) {
      let stamp: string
      try {
        const stat = fs.statSync(file)
        stamp = `${stat.mtimeMs}:${stat.size}`
      } catch {
        this.configCache.delete(file)
        continue
      }
      let cached = this.configCache.get(file)
      if (!cached || cached.stamp !== stamp) {
        let uses: (RecipeUse & { key: string })[] = []
        try {
          const parsed = backzettelLoader.parseBackzettelYaml(
            fs.readFileSync(file, 'utf-8')
          )
          if (parsed.ok) {
            uses = core
              .collectRecipeReferences(parsed.data)
              .map((r: RecipeUse & { recipe: string }) => ({
                kind: r.kind,
                id: r.id,
                name: r.name,
                section: r.section,
                key: core.referenceKey(r.recipe),
              }))
          }
        } catch {
          uses = []
        }
        cached = { stamp, uses }
        this.configCache.set(file, cached)
      }
      for (const use of cached.uses) {
        const id = `${use.key}\0${use.kind}\0${use.id}\0${use.section}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push(use)
      }
    }
    return out
  }

  private usesOf(
    rel: string,
    references: (RecipeUse & { key: string })[]
  ): RecipeUse[] {
    const key = `${RECIPES_REL}/${rel}`
    return references
      .filter((r) => r.key === key)
      .map(({ kind, id, name, section }) => ({ kind, id, name, section }))
  }

  // ------------------------------------------------------------ Stände

  /** Freigegebener Stand: `origin/main` (B5b), sonst der Lese-Klon. */
  private approved(readFiles: Map<string, FileOnDisk>): {
    has: (rel: string) => boolean
    text: (rel: string) => string | undefined
    names: () => Map<string, { category: string; fileName: string }>
  } {
    const fromMain = this.approvedFiles()
    if (fromMain) {
      const map = new Map<
        string,
        { raw: string; category: string; fileName: string }
      >()
      for (const [rel, raw] of fromMain) {
        const parts = rel.split('/')
        if (parts.length !== 2) continue
        if (
          !core.CATEGORY_DIR.test(parts[0]) ||
          !core.isRecipeFileName(parts[1])
        )
          continue
        map.set(nfc(rel), { raw, category: parts[0], fileName: parts[1] })
      }
      return {
        has: (rel) => map.has(rel),
        text: (rel) => map.get(rel)?.raw,
        names: () => map,
      }
    }
    return {
      has: (rel) => readFiles.has(rel),
      text: (rel) => {
        const file = readFiles.get(rel)
        return file ? readText(file.full)?.text : undefined
      },
      names: () => readFiles,
    }
  }

  /**
   * Pfade unter `data/recipes`, die auf dem Branch des Schreib-Worktrees
   * gelöscht wurden (irgendwann in dessen Geschichte). Zusammen mit „fehlt
   * im Worktree, ist aber freigegeben" heißt das: Löschung wartet.
   */
  private async deletedInWorktree(): Promise<Set<string>> {
    const dir = this.writeDir
    if (!dir || !fs.existsSync(dir)) return new Set()
    try {
      const head = (await this.git(dir, ['rev-parse', 'HEAD'])).trim()
      if (this.deletedCache && this.deletedCache.head === head) {
        return this.deletedCache.paths
      }
      const out = await this.git(dir, [
        '-c',
        'core.quotePath=false',
        'log',
        // ohne Umbenennungs-Erkennung: ein Verschieben ist Löschen + Anlegen
        '--no-renames',
        '--diff-filter=D',
        '--name-only',
        '--format=',
        '-z',
        'HEAD',
        '--',
        RECIPES_REL,
      ])
      const paths = new Set<string>()
      for (const record of out.split(/[\0\n]/)) {
        const rel = record.trim()
        if (rel.startsWith(`${RECIPES_REL}/`)) {
          paths.add(nfc(rel.slice(RECIPES_REL.length + 1)))
        }
      }
      this.deletedCache = { head, paths }
      return paths
    } catch {
      return new Set()
    }
  }

  /** Alle Rezepte im Arbeitsstand, mit Kennung und Freigabestatus. */
  private async snapshot(): Promise<{ available: boolean; entries: Entry[] }> {
    const readFiles = filesIn(this.recipesDir)
    const writeRoot = this.writeRecipesDir
    const writeFiles = filesIn(writeRoot)
    const available =
      fs.existsSync(this.recipesDir) ||
      (writeRoot !== null && fs.existsSync(writeRoot))
    const approved = this.approved(readFiles)
    const deleted = writeRoot
      ? await this.deletedInWorktree()
      : new Set<string>()

    const found = new Map<string, { category: string; fileName: string }>()
    for (const [rel, file] of writeFiles) found.set(rel, file)
    for (const [rel, file] of approved.names()) {
      if (!found.has(rel)) found.set(rel, file)
    }

    const namesByCategory = new Map<string, string[]>()
    for (const file of found.values()) {
      const list = namesByCategory.get(file.category) ?? []
      list.push(file.fileName)
      namesByCategory.set(file.category, list)
    }
    const slugs = new Map<string, Map<string, string>>()
    for (const [category, names] of namesByCategory) {
      slugs.set(category, core.slugsForFiles(names))
    }

    const entries: Entry[] = []
    for (const [rel, file] of found) {
      const slug = slugs.get(file.category)?.get(file.fileName)
      if (!slug) continue
      const inWrite = writeFiles.get(rel)
      let text: string | undefined
      let lossless = true
      let pending: RecipePending = null
      let inTarget = false
      if (inWrite) {
        const read = readText(inWrite.full)
        if (!read) continue
        text = read.text
        lossless = read.lossless
        inTarget = true
        const approvedText = approved.text(rel)
        pending =
          approvedText === undefined
            ? 'created'
            : approvedText !== text
            ? 'changed'
            : null
      } else {
        text = approved.text(rel)
        if (text === undefined) continue
        if (writeRoot) {
          pending = deleted.has(rel) ? 'deleted' : null
        } else {
          inTarget = true
          const onDisk = readFiles.get(rel)
          lossless = onDisk ? readText(onDisk.full)?.lossless !== false : true
        }
      }
      entries.push({
        category: file.category,
        fileName: file.fileName,
        slug,
        id: `${file.category}/${slug}`,
        rel,
        text,
        inTarget,
        pending,
        lossless,
      })
    }
    return { available, entries }
  }

  private docOf(entry: Entry): ParsedRecipe {
    const doc: ParsedRecipe = core.parseRecipeFile(entry.text, {
      fileStem: core.fileStem(entry.fileName),
    })
    const category = core.categoryOf(entry.category)
    if (entry.pending === 'deleted') {
      doc.editable = false
      doc.readOnlyReason = MSG.deleted
    } else if (!entry.lossless) {
      doc.editable = false
      doc.readOnlyReason = MSG.notUtf8
    } else if (category && category.readOnly) {
      doc.editable = false
      doc.readOnlyReason = core.TEIG_READ_ONLY
    }
    return doc
  }

  private summaryOf(
    entry: Entry,
    doc: ParsedRecipe,
    uses: RecipeUse[]
  ): RecipeSummary {
    const category = core.categoryOf(entry.category)
    const model = doc.model
    return {
      id: entry.id,
      category: entry.category,
      categoryLabel: category ? category.label : entry.category,
      slug: entry.slug,
      file: entry.fileName,
      path: `${RECIPES_REL}/${entry.category}/${entry.fileName}`,
      format: doc.format,
      title: model.title || core.fileStem(entry.fileName),
      yield: model.yield ?? null,
      ingredientCount: model.parts.reduce(
        (sum: number, part: RecipePart) => sum + part.ingredients.length,
        0
      ),
      editable: doc.editable,
      readOnlyReason: doc.readOnlyReason,
      pendingApproval: entry.pending !== null,
      pending: entry.pending,
      usedByBackzettel: uses,
    }
  }

  private deleteBlock(entry: Entry, uses: RecipeUse[]): string | null {
    if (entry.pending === 'deleted') return MSG.deleted
    if (!this.allowDelete) return MSG.deleteOff
    const category = core.categoryOf(entry.category)
    if (category && category.readOnly) return core.TEIG_READ_ONLY
    if (uses.length > 0) return MSG.inUse(uses)
    return null
  }

  private recipeOf(entry: Entry, uses: RecipeUse[]): Recipe {
    const doc = this.docOf(entry)
    const model = doc.model
    const blocked = this.deleteBlock(entry, uses)
    return {
      ...this.summaryOf(entry, doc, uses),
      description: model.description ?? null,
      parts: model.parts,
      steps: model.steps,
      notes: model.notes ?? null,
      meta: model.meta,
      sections: model.sections,
      version: versionOf(entry.text),
      deletable: blocked === null,
      deleteBlockedReason: blocked,
    }
  }

  // ------------------------------------------------------------ Lesen

  /** Dieselbe Prüfung wie beim Schreiben, für die Anzeige kurz gecacht. */
  private async writeIssue(): Promise<RecipeList['writeIssue']> {
    const dir = this.writeDir
    if (!dir) {
      if (this.production) {
        return { error: 'hq_write_unavailable', message: MSG.writeMissing }
      }
      return fs.existsSync(this.recipesDir)
        ? null
        : { error: 'hq_unavailable', message: MSG.readMissing }
    }
    if (!fs.existsSync(dir)) {
      return { error: 'hq_write_unavailable', message: MSG.writeMissing }
    }
    const now = Date.now()
    if (this.branchCheck && now - this.branchCheck.at < BRANCH_CHECK_MS) {
      return this.branchCheck.issue
    }
    let issue: RecipeList['writeIssue'] = null
    try {
      const branch = await currentBranch(this.git, dir)
      if (branch !== this.writeBranch) {
        issue = {
          error: 'hq_write_wrong_branch',
          message: MSG.wrongBranch(this.writeBranch, branch),
        }
      }
    } catch {
      issue = { error: 'hq_write_unavailable', message: MSG.writeNotRepo }
    }
    this.branchCheck = { at: now, issue }
    return issue
  }

  /** `GET /api/recipes[?category=&q=]`. */
  async list(
    options: { category?: unknown; q?: unknown } = {}
  ): Promise<RecipeList> {
    const issue = await this.writeIssue()
    const base = {
      units: [...core.UNITS] as string[],
      writable: issue === null,
      writeIssue: issue,
      canDelete: this.allowDelete,
      deleteIssue: this.allowDelete ? null : MSG.deleteOff,
    }
    const { available, entries } = await this.snapshot()
    if (!available) {
      return {
        status: 'no-data',
        message: MSG.noData,
        categories: [],
        recipes: [],
        count: 0,
        ...base,
        writable: false,
      }
    }
    const references = this.references()
    const all = entries.map((entry) => {
      const doc = this.docOf(entry)
      return {
        doc,
        summary: this.summaryOf(entry, doc, this.usesOf(entry.rel, references)),
      }
    })

    const known: { id: string; label: string; readOnly?: boolean }[] =
      core.CATEGORIES
    const categories: RecipeCategory[] = known.map((c) => ({
      id: c.id,
      label: c.label,
      count: 0,
      writable: !c.readOnly,
    }))
    for (const { summary } of all) {
      let category = categories.find((c) => c.id === summary.category)
      if (!category) {
        category = {
          id: summary.category,
          label: summary.category,
          count: 0,
          writable: true,
        }
        categories.push(category)
      }
      category.count += 1
    }

    const wanted = options.category
    const query = typeof options.q === 'string' ? options.q.slice(0, 200) : ''
    const order = new Map(categories.map((c, i) => [c.id, i]))
    const recipes = all
      .filter(({ summary }) =>
        wanted === undefined || wanted === ''
          ? true
          : typeof wanted === 'string' && summary.category === wanted
      )
      .filter(({ doc, summary }) =>
        core.matchesSearch(doc.model, query, summary.file)
      )
      .map(({ summary }) => summary)
      .sort(
        (a, b) =>
          (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) ||
          a.title.localeCompare(b.title, 'de') ||
          a.id.localeCompare(b.id)
      )
    return { status: 'ok', categories, recipes, count: recipes.length, ...base }
  }

  /** `GET /api/recipes/:category/:slug`. */
  async get(category: string, slug: string): Promise<Recipe | null> {
    const { entries } = await this.snapshot()
    const entry = entries.find(
      (e) => e.category === category && e.slug === slug
    )
    if (!entry) return null
    return this.recipeOf(entry, this.usesOf(entry.rel, this.references()))
  }

  // ------------------------------------------------------------ Schreiben

  private enqueue(
    job: () => Promise<RecipeWriteResult>
  ): Promise<RecipeWriteResult> {
    // Im Schreib-Worktree dieselbe Sperre wie Rebase + Push (B5b).
    const writeDir = this.writeDir
    const locked = writeDir ? () => withRepoLock(writeDir, job) : job
    const run = this.queue.then(locked, locked).catch((error) => {
      if (error instanceof HqGitError && error.code === 'repo_locked') {
        return fail(503, 'repo_locked', MSG.repoLocked)
      }
      throw error
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Zielverzeichnis (`…/data/recipes`) für Schreibvorgänge, oder ein Fehler. */
  private async target(): Promise<
    { root: string } | { error: RecipeWriteResult }
  > {
    const dir = this.writeDir
    if (dir) {
      if (!fs.existsSync(dir)) {
        return { error: fail(503, 'hq_write_unavailable', MSG.writeMissing) }
      }
      let branch: string
      try {
        branch = await currentBranch(this.git, dir)
      } catch (error) {
        console.error('[recipes] write worktree unusable:', error)
        return { error: fail(503, 'hq_write_unavailable', MSG.writeNotRepo) }
      }
      if (branch !== this.writeBranch) {
        console.error(
          `[recipes] write worktree is on "${branch}", expected "${this.writeBranch}" - refusing to commit`
        )
        return {
          error: fail(
            503,
            'hq_write_wrong_branch',
            MSG.wrongBranch(this.writeBranch, branch)
          ),
        }
      }
      return { root: path.join(dir, RECIPES_REL) }
    }
    if (this.production) {
      return { error: fail(503, 'hq_write_unavailable', MSG.writeMissing) }
    }
    if (!fs.existsSync(this.recipesDir)) {
      return { error: fail(503, 'hq_unavailable', MSG.readMissing) }
    }
    return { root: this.recipesDir }
  }

  /**
   * Das Kategorie-Verzeichnis im Schreibziel ist ein echtes Verzeichnis (oder
   * fehlt noch) - nie durch einen Symlink aus hq hinausschreiben.
   */
  private realCategoryDir(root: string, category: string): boolean {
    try {
      return fs.lstatSync(path.join(root, category)).isDirectory()
    } catch {
      return true
    }
  }

  private checkVersion(
    entry: Entry,
    expected: unknown
  ): RecipeWriteResult | null {
    if (typeof expected !== 'string' || expected === '') {
      return fail(400, 'version_required', MSG.versionRequired)
    }
    const current = versionOf(entry.text)
    if (expected !== current) {
      return fail(409, 'stale_recipe', MSG.stale, { currentVersion: current })
    }
    return null
  }

  /**
   * Committet genau diese Pfade (relativ zur hq-Wurzel) im Schreib-Worktree.
   * `false`, wenn nichts zu committen war.
   */
  private async commit(paths: string[], message: string): Promise<boolean> {
    const cwd = this.writeDir as string
    await this.git(cwd, ['add', '-A', '--', ...paths])
    const staged = await this.git(cwd, [
      'diff',
      '--cached',
      '--name-only',
      '--',
      ...paths,
    ])
    if (staged.trim() === '') return false
    // Pfadangabe: nur diese Dateien, nie was sonst im Index liegt.
    await this.git(cwd, ['commit', '-q', '-m', message, '--', ...paths])
    return true
  }

  /**
   * Führt die Dateiänderungen aus und committet sie; schlägt git fehl, steht
   * danach wieder der alte Stand.
   * `writes`: Pfad unter `data/recipes` → neuer Inhalt (`null` = löschen).
   */
  private async persist(
    root: string,
    writes: { category: string; fileName: string; content: string | null }[],
    message: string
  ): Promise<RecipeWriteResult | null> {
    const before = writes.map((w) => {
      const full = path.join(root, w.category, w.fileName)
      return { full, old: fs.existsSync(full) ? fs.readFileSync(full) : null }
    })
    const rels = writes.map((w) => `${RECIPES_REL}/${w.category}/${w.fileName}`)
    const restore = async () => {
      for (const b of before) {
        try {
          if (b.old === null) fs.rmSync(b.full, { force: true })
          else {
            fs.mkdirSync(path.dirname(b.full), { recursive: true })
            fs.writeFileSync(b.full, b.old)
          }
        } catch (error) {
          console.error('[recipes] restore failed:', error)
        }
      }
      if (this.writeDir) {
        await this.git(this.writeDir, ['reset', '-q', '--', ...rels]).catch(
          () => undefined
        )
      }
    }
    let committed = false
    try {
      writes.forEach((w, i) => {
        if (w.content === null) fs.rmSync(before[i].full, { force: true })
        else writeFileAtomic(before[i].full, w.content)
      })
      if (this.writeDir) committed = await this.commit(rels, message)
    } catch (error) {
      console.error('[recipes] write failed:', error)
      await restore()
      return fail(500, 'hq_commit_failed', MSG.commitFailed)
    }
    if (committed) {
      try {
        this.afterCommit()
      } catch (error) {
        console.error('[recipes] afterCommit failed:', error)
      }
    }
    return null
  }

  private message(
    action: 'create' | 'update' | 'delete' | 'move',
    title: string,
    rel: string,
    editor: RecipeEditor
  ): string {
    return `${core.commitSubject(action, title, rel)}\n\n${coAuthorTrailer(
      editor
    )}\n`
  }

  private async answer(
    status: number,
    category: string,
    slug: string,
    changed: boolean,
    action: 'create' | 'update'
  ): Promise<RecipeWriteResult> {
    const recipe = await this.get(category, slug)
    if (!recipe) return fail(500, 'hq_commit_failed', MSG.commitFailed)
    return {
      ok: true,
      status,
      data: recipe,
      pending: recipe.pendingApproval,
      changed,
      audit: changed
        ? {
            action,
            id: recipe.id,
            data: {
              path: recipe.path,
              title: recipe.title,
              pending: recipe.pending,
            },
          }
        : undefined,
    }
  }

  /** `POST /api/recipes`. */
  create(input: unknown, editor: RecipeEditor): Promise<RecipeWriteResult> {
    return this.enqueue(async () => {
      const target = await this.target()
      if ('error' in target) return target.error
      const body = (input && typeof input === 'object' ? input : {}) as Record<
        string,
        unknown
      >
      const category = core.categoryOf(body['category'])
      if (!category || category.readOnly) {
        return fail(400, 'invalid_category', MSG.invalidCategory)
      }
      const built = core.newRecipeFile(body, { category: category.id })
      if (!built.ok) return fail(400, built.error, built.message)
      const name = core.newFileName(built.model.title)
      if (!name) return fail(400, 'invalid_id', MSG.invalidId)

      const { entries } = await this.snapshot()
      const clash = entries.find(
        (e) =>
          e.category === category.id &&
          e.pending !== 'deleted' &&
          (e.slug === name.slug ||
            nfc(e.fileName).toLowerCase() === name.fileName)
      )
      const full = path.join(target.root, category.id, name.fileName)
      if (clash || fs.existsSync(full)) {
        return fail(409, 'recipe_exists', MSG.exists)
      }
      if (!this.realCategoryDir(target.root, category.id)) {
        return fail(400, 'invalid_category', MSG.invalidCategory)
      }
      const failed = await this.persist(
        target.root,
        [
          {
            category: category.id,
            fileName: name.fileName,
            content: built.text,
          },
        ],
        this.message(
          'create',
          built.model.title,
          `${category.id}/${name.fileName}`,
          editor
        )
      )
      if (failed) return failed
      const after = await this.snapshot()
      const created = after.entries.find(
        (e) => e.category === category.id && e.fileName === name.fileName
      )
      if (!created) return fail(500, 'hq_commit_failed', MSG.commitFailed)
      return this.answer(201, created.category, created.slug, true, 'create')
    })
  }

  /** `PUT /api/recipes/:category/:slug`. */
  update(
    category: string,
    slug: string,
    input: unknown,
    editor: RecipeEditor
  ): Promise<RecipeWriteResult> {
    return this.enqueue(async () => {
      const target = await this.target()
      if ('error' in target) return target.error
      const { entries } = await this.snapshot()
      const entry = entries.find(
        (e) => e.category === category && e.slug === slug
      )
      if (!entry) return fail(404, 'not_found', MSG.notFound)
      if (entry.pending === 'deleted')
        return fail(409, 'recipe_deleted', MSG.deleted)
      const body = (input && typeof input === 'object' ? input : {}) as Record<
        string,
        unknown
      >
      const stale = this.checkVersion(entry, body['expectedVersion'])
      if (stale) return stale
      const doc = this.docOf(entry)
      if (!doc.editable) {
        return fail(409, 'recipe_read_only', doc.readOnlyReason || MSG.notFound)
      }
      const uses = this.usesOf(entry.rel, this.references())

      // Kategorie geändert = Datei verschieben (löschen + anlegen in hq).
      let moveTo: string | null = null
      if (
        body['category'] !== undefined &&
        body['category'] !== entry.category
      ) {
        const wanted = core.categoryOf(body['category'])
        if (!wanted || wanted.readOnly) {
          return fail(400, 'invalid_category', MSG.invalidCategory)
        }
        if (uses.length > 0) {
          return fail(409, 'recipe_in_use', MSG.inUse(uses), {
            usedByBackzettel: uses,
          })
        }
        if (!this.allowDelete) {
          return fail(409, 'recipe_delete_unavailable', MSG.deleteOff)
        }
        const taken = entries.some(
          (e) =>
            e.category === wanted.id &&
            (e.slug === entry.slug || nfc(e.fileName) === nfc(entry.fileName))
        )
        if (
          taken ||
          fs.existsSync(path.join(target.root, wanted.id, entry.fileName))
        ) {
          return fail(409, 'recipe_exists', MSG.exists)
        }
        if (this.writeDir && !entry.inTarget) {
          return fail(409, 'hq_write_out_of_sync', MSG.outOfSync)
        }
        if (!this.realCategoryDir(target.root, wanted.id)) {
          return fail(400, 'invalid_category', MSG.invalidCategory)
        }
        moveTo = wanted.id
      }

      const result = core.applyRecipeInput(
        doc,
        body,
        moveTo ? { category: moveTo } : undefined
      )
      if (!result.ok) {
        return fail(
          result.error === 'recipe_read_only' ? 409 : 400,
          result.error,
          result.message
        )
      }
      if (!result.changed && !moveTo) {
        // Ein Speichern ohne Änderung schreibt nichts und committet nichts.
        return this.answer(200, entry.category, entry.slug, false, 'update')
      }

      // Der Backzettel muss seine Rezeptteile danach noch finden.
      if (uses.length > 0) {
        const before = backzettelRecipes.parseFillingRecipes(entry.text)
        const after = backzettelRecipes.parseFillingRecipes(result.text)
        for (const use of uses) {
          if (
            backzettelRecipes.findRecipeForReference(before, use) &&
            !backzettelRecipes.findRecipeForReference(after, use)
          ) {
            return fail(409, 'recipe_section_in_use', MSG.sectionInUse(use), {
              usedByBackzettel: uses,
            })
          }
        }
      }

      const title: string = result.model.title
      const failed = moveTo
        ? await this.persist(
            target.root,
            [
              {
                category: entry.category,
                fileName: entry.fileName,
                content: null,
              },
              {
                category: moveTo,
                fileName: entry.fileName,
                content: result.text,
              },
            ],
            this.message('move', title, `${moveTo}/${entry.fileName}`, editor)
          )
        : await this.persist(
            target.root,
            [
              {
                category: entry.category,
                fileName: entry.fileName,
                content: result.text,
              },
            ],
            this.message('update', title, entry.rel, editor)
          )
      if (failed) return failed
      if (!moveTo)
        return this.answer(200, entry.category, entry.slug, true, 'update')
      const after = await this.snapshot()
      const moved = after.entries.find(
        (e) =>
          e.category === moveTo &&
          e.fileName === entry.fileName &&
          e.pending !== 'deleted'
      )
      if (!moved) return fail(500, 'hq_commit_failed', MSG.commitFailed)
      const answer = await this.answer(
        200,
        moved.category,
        moved.slug,
        true,
        'update'
      )
      if (answer.audit) answer.audit.data['movedFrom'] = entry.id
      return answer
    })
  }

  /** `DELETE /api/recipes/:category/:slug`. */
  remove(
    category: string,
    slug: string,
    expectedVersion: unknown,
    editor: RecipeEditor
  ): Promise<RecipeWriteResult> {
    return this.enqueue(async () => {
      const target = await this.target()
      if ('error' in target) return target.error
      const { entries } = await this.snapshot()
      const entry = entries.find(
        (e) => e.category === category && e.slug === slug
      )
      if (!entry) return fail(404, 'not_found', MSG.notFound)
      if (entry.pending === 'deleted')
        return fail(409, 'recipe_deleted', MSG.deleted)
      const stale = this.checkVersion(entry, expectedVersion)
      if (stale) return stale
      const known = core.categoryOf(entry.category)
      if (known && known.readOnly) {
        return fail(409, 'recipe_read_only', core.TEIG_READ_ONLY)
      }
      const uses = this.usesOf(entry.rel, this.references())
      if (uses.length > 0) {
        return fail(409, 'recipe_in_use', MSG.inUse(uses), {
          usedByBackzettel: uses,
        })
      }
      if (!this.allowDelete) {
        return fail(409, 'recipe_delete_unavailable', MSG.deleteOff)
      }
      const full = path.join(target.root, entry.category, entry.fileName)
      if (!entry.inTarget || !fs.existsSync(full)) {
        return fail(409, 'hq_write_out_of_sync', MSG.outOfSync)
      }
      const doc = this.docOf(entry)
      const title: string = doc.model.title || core.fileStem(entry.fileName)
      const failed = await this.persist(
        target.root,
        [{ category: entry.category, fileName: entry.fileName, content: null }],
        this.message('delete', title, entry.rel, editor)
      )
      if (failed) return failed
      const after = await this.snapshot()
      const left = after.entries.find((e) => e.rel === entry.rel)
      return {
        ok: true,
        status: 200,
        data: { id: entry.id, deleted: true },
        pending: left?.pending === 'deleted',
        changed: true,
        audit: {
          action: 'delete',
          id: entry.id,
          data: { path: `${RECIPES_REL}/${entry.rel}`, title },
        },
      }
    })
  }
}
