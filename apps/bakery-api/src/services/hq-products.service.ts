/**
 * hq-Produkte lesen und schreiben (B5, roadmap D6/D9/§4a).
 *
 * Lesen: aus dem Lese-Klon (`HQ_PRODUCTS_DIR`) über `hq-catalogue.ts`.
 *
 * Schreiben:
 *   - `HQ_WRITE_DIR` gesetzt (Box): die Datei landet in
 *     `${HQ_WRITE_DIR}/products` (Worktree auf `app/edits`) und wird dort
 *     committet - Autor `Verwaltung (App)`, Bearbeiter als
 *     `Co-authored-by`-Trailer. Push + PR macht B5b. Bis zum Merge
 *     unterscheidet sich die Datei vom Lese-Klon: das Produkt trägt
 *     `pendingApproval: true` ("wartet auf Freigabe").
 *   - `HQ_WRITE_DIR` nicht gesetzt (Entwicklung): direkt nach
 *     `HQ_PRODUCTS_DIR`, wie der Mock-Server, ohne git.
 *
 * Die Regeln (Feldübernahme, Slug, numeric_id, Commit-Text) stehen in
 * `hq-products.core.js`, die Prüfung in `product-input.core.js`, die
 * Serialisierung in `product-file.core.js`. Diese Datei macht nur I/O.
 */
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import {
  catalogueFor,
  defaultProductsDir,
  HqCatalogue,
  HqProduct,
  ProductFile,
} from './hq-catalogue'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-products.core')
const { serializeProductFile } = require('./product-file.core')
const { parsePrice, validateProductInput } = require('./product-input.core')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Ein Produkt der API-Antwort, mit Freigabestatus. */
export type ListedProduct = HqProduct & { pendingApproval: boolean }

/** Wer speichert (aus `req.user`). */
export interface Editor {
  username: string
  displayName: string
}

/** git im Schreib-Worktree: Argumente als Array, nie als Shell-String. */
export type GitRunner = (
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
) => Promise<void>

export const runGit: GitRunner = (args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd: options.cwd, env: options.env, timeout: 30_000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `git ${args[0]} failed: ${String(stderr || error.message).trim()}`
            )
          )
          return
        }
        resolve()
      }
    )
  })

export interface HqProductsOptions {
  /** Lese-Klon `products/` (Default `HQ_PRODUCTS_DIR`). */
  productsDir?: string
  /** Wurzel des Schreib-Worktrees (Default `HQ_WRITE_DIR`; leer = Entwicklung). */
  writeDir?: string | null
  /** Für Tests. */
  git?: GitRunner
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
  notFound: 'Produkt nicht gefunden.',
  fileExists: 'Eine Produktdatei mit diesem Namen existiert bereits.',
  commitFailed:
    'Die Änderung konnte nicht in hq gespeichert werden. Bitte später erneut versuchen.',
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
  private readonly git: GitRunner
  /** Schreibvorgänge nacheinander: lesen-ändern-schreiben + git-Index. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(options: HqProductsOptions = {}) {
    this.productsDir = path.resolve(options.productsDir ?? defaultProductsDir())
    const writeDir =
      options.writeDir === undefined
        ? process.env['HQ_WRITE_DIR'] || null
        : options.writeDir || null
    this.writeDir = writeDir ? path.resolve(writeDir) : null
    this.git = options.git ?? runGit
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

  /** Dateinamen, deren Inhalt im Schreib-Worktree vom Lese-Klon abweicht. */
  pendingFiles(): Set<string> {
    const pending = new Set<string>()
    const write = this.write
    if (!write) return pending
    const read = this.read
    for (const file of write.files()) {
      if (read.fileNamed(file.file)?.raw !== file.raw) pending.add(file.file)
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
   * Freigegebener Stand aus dem Lese-Klon, je Produkt mit `pendingApproval`.
   * `includeNew`: auch Produkte, die nur im Schreib-Worktree liegen (neu
   * angelegt, noch nicht gemergt) - für die Verwaltung, nicht für den Shop.
   */
  list(
    options: { category?: unknown; includeNew?: boolean } = {}
  ): ListedProduct[] {
    const pending = this.pendingFiles()
    const products: ListedProduct[] = []
    const seen = new Set<string>()
    for (const file of this.read.files()) {
      const product = this.withPending(file, pending)
      if (product) {
        products.push(product)
        seen.add(product.id)
      }
    }
    if (options.includeNew && this.write) {
      for (const file of this.write.files()) {
        if (!file.product || seen.has(file.product.id)) continue
        if (this.read.fileNamed(file.file)) continue
        products.push({ ...file.product, pendingApproval: true })
      }
    }
    const category =
      typeof options.category === 'string' ? options.category : undefined
    return core.filterByCategory(core.sortProducts(products), category)
  }

  /** Ein Produkt per Slug: Lese-Klon, sonst (neu, wartend) Schreib-Worktree. */
  get(id: string): ListedProduct | null {
    const pending = this.pendingFiles()
    const file = this.read.fileOf(id)
    if (file) return this.withPending(file, pending)
    const fresh = this.write?.fileOf(id)
    return fresh?.product ? { ...fresh.product, pendingApproval: true } : null
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job)
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Zielverzeichnis für Schreibvorgänge, oder ein Fehler. */
  private targetDir(): { dir: string } | { error: WriteResult } {
    const writeDir = this.writeProductsDir
    if (writeDir) {
      if (!fs.existsSync(writeDir)) {
        return { error: fail(503, 'hq_write_unavailable', MSG.writeMissing) }
      }
      return { dir: writeDir }
    }
    if (!this.read.available()) {
      return { error: fail(503, 'hq_unavailable', MSG.readMissing) }
    }
    return { dir: this.productsDir }
  }

  update(id: string, input: unknown, editor: Editor): Promise<WriteResult> {
    return this.enqueue(async () => {
      const target = this.targetDir()
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
      const target = this.targetDir()
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
    try {
      if (this.writeDir) await this.commit(file, action, product, editor)
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
  ): Promise<void> {
    const cwd = this.writeDir as string
    const env = this.gitEnv()
    const rel = `products/${file}`
    await this.git(['add', '--', rel], { cwd, env })
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
  }

  invalidate(): void {
    this.read.invalidate()
    this.write?.invalidate()
  }
}
