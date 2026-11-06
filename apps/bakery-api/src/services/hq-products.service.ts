/**
 * hq-Produkte lesen und schreiben (B5, roadmap D6/D9/§4a).
 *
 * Lesen: Shop (`/api/products`) nur aus dem Lese-Klon (`HQ_PRODUCTS_DIR`,
 * freigegebener Stand). Verwaltung (`/api/hq-products`) sieht den Stand, auf
 * dem ein PUT aufbaut: die Datei im Schreib-Worktree, falls vorhanden, mit
 * `pendingApproval` und dem freigegebenen Stand als `approved`. Sonst würde
 * das Bearbeiten-Formular (schickt alle Felder) beim zweiten Speichern die
 * freigegebenen Werte über die wartende Änderung schreiben (B5-Review).
 *
 * Schreiben:
 *   - `HQ_WRITE_DIR` gesetzt (Box): die Datei landet in
 *     `${HQ_WRITE_DIR}/products` (Worktree auf `app/edits`) und wird dort
 *     committet - Autor `Verwaltung (App)`, Bearbeiter als
 *     `Co-authored-by`-Trailer. Push + rollende PR macht
 *     `hq-edits-sync.service.ts` (B5b, `afterCommit`). Bis zum Merge
 *     unterscheidet sich die Datei von `origin/main` (B5b, `approvedFiles`;
 *     ohne B5b vom Lese-Klon): das Produkt trägt `pendingApproval: true`
 *     ("wartet auf Freigabe").
 *   - `HQ_WRITE_DIR` nicht gesetzt (Entwicklung): direkt nach
 *     `HQ_PRODUCTS_DIR`, ohne git.
 *
 * Die Regeln (Feldübernahme, Slug, numeric_id, Commit-Text) stehen in
 * `hq-products.core.js`, die Prüfung in `product-input.core.js`, die
 * Serialisierung in `product-file.core.js`. Diese Datei macht nur I/O.
 */
import * as fs from 'fs'
import * as path from 'path'

import matter from 'gray-matter'

import {
  catalogueFor,
  defaultProductsDir,
  HqCatalogue,
  HqProduct,
  parseProductFile,
  ProductFile,
} from './hq-catalogue'
import { runHqGit, withRepoLock } from './hq-git'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-products.core')
const { serializeProductFile } = require('./product-file.core')
const { parsePrice, validateProductInput } = require('./product-input.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Ein Produkt der API-Antwort, mit Freigabestatus. */
export type ListedProduct = HqProduct & { pendingApproval: boolean }

/**
 * Ein Produkt für die Verwaltung: der Stand im Schreib-Worktree. Wartet er
 * auf Freigabe, steht der freigegebene Stand daneben (`null` = neu angelegt).
 */
export type ManagedProduct = ListedProduct & {
  /** Body ohne Überschrift, ohne Rückgriff auf `short_description` (F4). */
  rawDescription: string
  approved?: Readonly<HqProduct> | null
}

/** Branch des Schreib-Worktrees (D6). */
export const DEFAULT_WRITE_BRANCH = 'app/edits'

/** Wer speichert (aus `req.user`). */
export interface Editor {
  /** Interne Benutzer-ID - steht als `user-<id>@bakery.local` im Trailer. */
  id?: number | null
  /** Login; geht nicht nach hq (D13), nur noch für Logs. */
  username: string
  displayName: string
}

/** git im Schreib-Worktree: Argumente als Array, nie als Shell-String. Liefert stdout. */
export type GitRunner = (
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
) => Promise<string>

/** Default runner: `hq-git.ts` (execFile, argument array, timeout). */
export const runGit: GitRunner = (args, options) =>
  runHqGit(options.cwd, args, { env: options.env, timeoutMs: 30_000 })

export interface HqProductsOptions {
  /** Lese-Klon `products/` (Default `HQ_PRODUCTS_DIR`). */
  productsDir?: string
  /** Wurzel des Schreib-Worktrees (Default `HQ_WRITE_DIR`; leer = Entwicklung). */
  writeDir?: string | null
  /** Branch, auf dem der Schreib-Worktree stehen muss (Default `HQ_WRITE_BRANCH` / `app/edits`). */
  writeBranch?: string
  /**
   * Produktion: ohne Schreib-Worktree wird nicht geschrieben (503) - sonst
   * landete die Änderung im Lese-Klon, den `hq-sync.sh` alle 10 min per
   * `reset --hard` zurücksetzt (D6). Default `NODE_ENV === 'production'`.
   */
  production?: boolean
  /** Für Tests. */
  git?: GitRunner
  /**
   * B5b: Produktdateien auf `origin/main` (Dateiname → Inhalt), gegen die
   * `pendingApproval` gerechnet wird. `null`/nicht gesetzt = Lese-Klon.
   */
  approvedFiles?: () => ReadonlyMap<string, string> | null
  /** B5b: nach jedem Commit im Schreib-Worktree (Push + PR anstoßen). */
  afterCommit?: () => void
}

/**
 * Ergebnis eines Schreibvorgangs. `ok: false` trägt `error` + `message` und
 * wird mit `sendError` beantwortet; `ok: true` trägt `data` + `pending`.
 * (Eine flache Form: ohne `strictNullChecks` verengt TS keine Union über `ok`.)
 */
export interface WriteResult {
  ok: boolean
  status: number
  data?: Record<string, unknown>
  pending?: boolean
  error?: string
  message?: string
}

const fail = (status: number, error: string, message: string): WriteResult => ({
  ok: false,
  status,
  error,
  message,
})

const MSG = {
  readMissing: 'Das Produktverzeichnis aus hq wurde nicht gefunden.',
  writeMissing: 'Das Schreibverzeichnis für hq (HQ_WRITE_DIR) fehlt.',
  writeNotRepo:
    'Das Schreibverzeichnis für hq ist kein git-Arbeitsverzeichnis. Bitte die Einrichtung prüfen.',
  wrongBranch: (branch: string, actual: string) =>
    `Das Schreibverzeichnis für hq steht nicht auf dem Branch ${branch} (sondern auf ${actual}). Änderungen werden nicht gespeichert.`,
  unsafeFile:
    'Die Angaben lassen sich nicht unverändert in der Produktdatei speichern. Bitte Name und Texte prüfen (z. B. Sonderzeichen am Anfang oder Ende).',
  notFound: 'Produkt nicht gefunden.',
  fileExists: 'Eine Produktdatei mit diesem Namen existiert bereits.',
  commitFailed:
    'Die Änderung konnte nicht in hq gespeichert werden. Bitte später erneut versuchen.',
}

/**
 * Liest gray-matter genau das zurück, was geschrieben werden soll? Sonst
 * würde eine Datei committet, die aus allen Listen fällt (B5-Review).
 */
function roundTrips(
  serialized: string,
  data: Record<string, unknown>,
  body: string
): boolean {
  let parsed: { data: unknown; content: string } | null = null
  try {
    // Mit Optionen-Objekt: kein gray-matter-Cache.
    parsed = matter(serialized, {})
  } catch {
    parsed = null
  }
  return core.roundTripsAs(parsed, data, body)
}

/** Atomar schreiben: erst `.tmp`, dann `rename` - nie eine halbe Produktdatei. */
function writeFileAtomic(file: string, content: string): void {
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

export class HqProductsService {
  readonly productsDir: string
  /** Wurzel des Schreib-Worktrees oder `null` (Entwicklung). */
  readonly writeDir: string | null
  readonly writeBranch: string
  readonly production: boolean
  private readonly git: GitRunner
  private readonly approvedFiles: () => ReadonlyMap<string, string> | null
  private readonly afterCommit: () => void
  /** Geparste freigegebene Dateien, je Inhalt (B5b). */
  private approvedParsed = new Map<string, ProductFile | null>()
  /** Schreibvorgänge nacheinander: lesen-ändern-schreiben + git-Index. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(options: HqProductsOptions = {}) {
    this.productsDir = path.resolve(options.productsDir ?? defaultProductsDir())
    const writeDir =
      options.writeDir === undefined
        ? process.env['HQ_WRITE_DIR'] || null
        : options.writeDir || null
    this.writeDir = writeDir ? path.resolve(writeDir) : null
    this.writeBranch =
      options.writeBranch ||
      process.env['HQ_WRITE_BRANCH'] ||
      DEFAULT_WRITE_BRANCH
    this.production =
      options.production ?? process.env['NODE_ENV'] === 'production'
    this.git = options.git ?? runGit
    this.approvedFiles = options.approvedFiles ?? (() => null)
    this.afterCommit = options.afterCommit ?? (() => undefined)
  }

  get read(): HqCatalogue {
    return catalogueFor(this.productsDir)
  }

  /** `${HQ_WRITE_DIR}/products` oder `null`. */
  get writeProductsDir(): string | null {
    return this.writeDir ? path.join(this.writeDir, 'products') : null
  }

  private get write(): HqCatalogue | null {
    const dir = this.writeProductsDir
    return dir ? catalogueFor(dir) : null
  }

  /**
   * Der freigegebene Inhalt einer Produktdatei: aus `origin/main` (B5b, wie
   * zuletzt abgeholt), sonst aus dem Lese-Klon. `undefined` = gibt es dort
   * nicht. Der Lese-Klon hinkt `origin/main` bis zu 10 min hinterher - gegen
   * ihn gerechnet stünde ein gerade gemergtes Produkt noch als wartend da.
   */
  private approvedRaw(file: string): string | undefined {
    const approved = this.approvedFiles()
    if (approved) return approved.get(file)
    return this.read.fileNamed(file)?.raw
  }

  /** Der freigegebene Stand als Produktdatei (`null` = neu). */
  private approvedFile(file: string): ProductFile | null {
    const approved = this.approvedFiles()
    if (!approved) return this.read.fileNamed(file)
    const raw = approved.get(file)
    if (raw === undefined) return null
    const key = `${file}\0${raw}`
    if (!this.approvedParsed.has(key)) {
      if (this.approvedParsed.size > 500) this.approvedParsed.clear()
      this.approvedParsed.set(key, parseProductFile(file, raw))
    }
    return this.approvedParsed.get(key) ?? null
  }

  /** Dateinamen, deren Inhalt im Schreib-Worktree vom freigegebenen abweicht. */
  pendingFiles(): Set<string> {
    const pending = new Set<string>()
    const write = this.write
    if (!write) return pending
    for (const file of write.files()) {
      if (this.approvedRaw(file.file) !== file.raw) pending.add(file.file)
    }
    return pending
  }

  private withPending(
    file: ProductFile,
    pending: Set<string>
  ): ListedProduct | null {
    if (!file.product) return null
    return { ...file.product, pendingApproval: pending.has(file.file) }
  }

  /**
   * Shop: freigegebener Stand aus dem Lese-Klon, je Produkt mit
   * `pendingApproval`. Neue, noch nicht gemergte Produkte fehlen hier.
   */
  list(options: { category?: unknown } = {}): ListedProduct[] {
    const pending = this.pendingFiles()
    const products: ListedProduct[] = []
    for (const file of this.read.files()) {
      const product = this.withPending(file, pending)
      if (product) products.push(product)
    }
    return core.filterByCategory(core.sortProducts(products), options.category)
  }

  /** Ein Produkt per Slug, freigegebener Stand (Lese-Klon). */
  get(id: string): ListedProduct | null {
    const file = this.read.fileOf(id)
    return file ? this.withPending(file, this.pendingFiles()) : null
  }

  /**
   * Verwaltungssicht einer Datei: der Stand im Schreib-Worktree (falls es ihn
   * gibt) - genau der, auf dem ein PUT aufbaut.
   */
  private managed(
    readFile: ProductFile | null,
    writeFile: ProductFile | null
  ): ManagedProduct | null {
    const current = writeFile ?? readFile
    if (!current?.product) return null
    const pending =
      writeFile !== null && writeFile.raw !== this.approvedRaw(writeFile.file)
    const product: ManagedProduct = {
      ...current.product,
      ...(core.managedFields(current.content) as { rawDescription: string }),
      pendingApproval: pending,
    }
    if (pending) {
      product.approved = this.approvedFile(current.file)?.product ?? null
    }
    return product
  }

  /** Verwaltung: alle Produkte im Stand des Schreib-Worktrees, auch neue. */
  listManaged(options: { category?: unknown } = {}): ManagedProduct[] {
    const write = this.write
    const products: ManagedProduct[] = []
    const seenFiles = new Set<string>()
    for (const file of this.read.files()) {
      seenFiles.add(file.file)
      const product = this.managed(file, write?.fileNamed(file.file) ?? null)
      if (product) products.push(product)
    }
    if (write) {
      for (const file of write.files()) {
        if (seenFiles.has(file.file)) continue
        const product = this.managed(null, file)
        if (product) products.push(product)
      }
    }
    return core.filterByCategory(core.sortProducts(products), options.category)
  }

  /** Verwaltung: ein Produkt per Slug im Stand des Schreib-Worktrees. */
  getManaged(id: string): ManagedProduct | null {
    const writeFile = this.write?.fileOf(id) ?? null
    if (writeFile) {
      return this.managed(this.read.fileNamed(writeFile.file), writeFile)
    }
    return this.managed(this.read.fileOf(id), null)
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    // Im Schreib-Worktree dieselbe Warteschlange wie Rebase + Push (B5b):
    // ein Rebase trifft nie auf einen halben Commit.
    const writeDir = this.writeDir
    const locked = writeDir ? () => withRepoLock(writeDir, job) : job
    const run = this.queue.then(locked, locked)
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Zielverzeichnis für Schreibvorgänge, oder ein Fehler. */
  private async targetDir(): Promise<{ dir: string } | { error: WriteResult }> {
    const writeDir = this.writeProductsDir
    if (writeDir) {
      if (!fs.existsSync(writeDir)) {
        return { error: fail(503, 'hq_write_unavailable', MSG.writeMissing) }
      }
      const branch = await this.currentBranch()
      if (branch === null) {
        return { error: fail(503, 'hq_write_unavailable', MSG.writeNotRepo) }
      }
      if (branch !== this.writeBranch) {
        console.error(
          `[hq-products] write worktree is on "${branch}", expected "${this.writeBranch}" - refusing to commit`
        )
        return {
          error: fail(
            503,
            'hq_write_wrong_branch',
            MSG.wrongBranch(this.writeBranch, branch)
          ),
        }
      }
      return { dir: writeDir }
    }
    if (this.production) {
      return { error: fail(503, 'hq_write_unavailable', MSG.writeMissing) }
    }
    if (!this.read.available()) {
      return { error: fail(503, 'hq_unavailable', MSG.readMissing) }
    }
    return { dir: this.productsDir }
  }

  update(id: string, input: unknown, editor: Editor): Promise<WriteResult> {
    return this.enqueue(async () => {
      const target = await this.targetDir()
      if ('error' in target) return target.error

      // Basis: der Stand im Schreib-Worktree (enthält frühere, noch nicht
      // gemergte Änderungen), sonst der Lese-Klon unter demselben Dateinamen.
      const base = this.write?.fileOf(id) ?? this.read.fileOf(id)
      if (!base) return fail(404, 'not_found', MSG.notFound)

      const invalid = validateProductInput(input, { partial: true })
      if (invalid) return fail(400, 'validation', invalid)

      const { data, body } = core.applyProductUpdate(
        base.data,
        base.content,
        input,
        parsePrice
      )
      const serialized: string = serializeProductFile(data, body)
      if (!roundTrips(serialized, data, body)) {
        return fail(400, 'invalid_product_file', MSG.unsafeFile)
      }
      const result = await this.persist(
        target.dir,
        base.file,
        serialized,
        'update',
        data,
        editor
      )
      if (!result.ok) return result
      return {
        ok: true,
        status: 200,
        data: core.writeResponse(data, body),
        pending: result.pending,
      }
    })
  }

  create(input: unknown, editor: Editor): Promise<WriteResult> {
    return this.enqueue(async () => {
      const target = await this.targetDir()
      if ('error' in target) return target.error

      const invalid = validateProductInput(input, { partial: false })
      if (invalid) return fail(400, 'validation', invalid)

      // IDs und Nummern beider Stände belegen: auch ein noch nicht gemergtes
      // neues Produkt hält seinen Slug und seine numeric_id.
      const existing = [
        ...this.read.list(),
        ...(this.write ? this.write.list() : []),
      ]
      const built = core.buildNewProduct(input, existing, parsePrice)
      if (!built.ok) return fail(built.status, built.error, built.message)
      if (
        fs.existsSync(path.join(target.dir, built.fileName)) ||
        this.read.fileNamed(built.fileName)
      ) {
        return fail(409, 'product_exists', MSG.fileExists)
      }

      const serialized: string = serializeProductFile(built.data, built.body)
      if (!roundTrips(serialized, built.data, built.body)) {
        return fail(400, 'invalid_product_file', MSG.unsafeFile)
      }
      const result = await this.persist(
        target.dir,
        built.fileName,
        serialized,
        'create',
        built.data,
        editor
      )
      if (!result.ok) return result
      return {
        ok: true,
        status: 201,
        data: core.writeResponse(built.data, built.body),
        pending: result.pending,
      }
    })
  }

  /**
   * Schreibt die Datei (nur wenn sich etwas ändert) und committet sie im
   * Schreib-Worktree. Schlägt git fehl, wird die Datei zurückgesetzt.
   */
  private async persist(
    dir: string,
    file: string,
    content: string,
    action: 'update' | 'create',
    product: Record<string, unknown>,
    editor: Editor
  ): Promise<WriteResult> {
    const full = path.join(dir, file)
    const before = fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null
    const pending = this.writeDir
      ? this.read.fileNamed(file)?.raw !== content
      : false

    // Ein Speichern ohne Änderung schreibt nichts und committet nichts.
    if (before === content) return { ok: true, status: 200, pending }

    writeFileAtomic(full, content)
    let committed = false
    try {
      if (this.writeDir) {
        committed = await this.commit(file, action, product, editor)
      }
    } catch (error) {
      console.error('[hq-products] commit failed:', error)
      try {
        if (before === null) fs.rmSync(full, { force: true })
        else writeFileAtomic(full, before)
        await this.git(['reset', '-q', '--', `products/${file}`], {
          cwd: this.writeDir as string,
          env: this.gitEnv(),
        }).catch(() => undefined)
      } finally {
        this.invalidate()
      }
      return fail(500, 'hq_commit_failed', MSG.commitFailed)
    }
    this.invalidate()
    if (committed) {
      try {
        this.afterCommit()
      } catch (error) {
        console.error('[hq-products] afterCommit failed:', error)
      }
    }
    return { ok: true, status: 200, pending }
  }

  private gitEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      GIT_AUTHOR_NAME: core.APP_AUTHOR.name,
      GIT_AUTHOR_EMAIL: core.APP_AUTHOR.email,
      GIT_COMMITTER_NAME: core.APP_AUTHOR.name,
      GIT_COMMITTER_EMAIL: core.APP_AUTHOR.email,
      GIT_TERMINAL_PROMPT: '0',
    }
  }

  private async commit(
    file: string,
    action: 'update' | 'create',
    product: Record<string, unknown>,
    editor: Editor
  ): Promise<boolean> {
    const cwd = this.writeDir as string
    const env = this.gitEnv()
    const rel = `products/${file}`
    await this.git(['add', '--', rel], { cwd, env })
    // Gleicht die Datei nach dem Schreiben wieder HEAD (ein schmutziger
    // Worktree wurde auf den committeten Stand zurückgesetzt), gibt es nichts
    // zu committen - `git commit -- path` schlüge dann fehl.
    const staged = await this.git(
      ['diff', '--cached', '--name-only', '--', rel],
      { cwd, env }
    )
    if (staged.trim() === '') return false
    // Pfadangabe beim Commit: nur diese Datei, nie was sonst im Index liegt.
    await this.git(
      [
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-q',
        '-m',
        core.commitMessage(action, product, editor),
        '--',
        rel,
      ],
      { cwd, env }
    )
    return true
  }

  /** Branch des Schreib-Worktrees (`HEAD` = losgelöst), `null` = kein Repo. */
  private async currentBranch(): Promise<string | null> {
    try {
      const out = await this.git(['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.writeDir as string,
        env: this.gitEnv(),
      })
      return out.trim()
    } catch (error) {
      console.error('[hq-products] write worktree unusable:', error)
      return null
    }
  }

  invalidate(): void {
    this.read.invalidate()
    this.write?.invalidate()
  }
}
