/**
 * hq-Produktkatalog (B5) - die eine Stelle, an der die API `hq/products/*.md`
 * liest. Benutzt von `/api/products` + `/api/hq-products` und, für Name und
 * Preis als Snapshot, von Partnern (B6) und Vorbestellungen (B7):
 *
 *   import { getCatalogue, getProduct } from '../services/hq-catalogue'
 *   const product = getProduct('kornbrot-500g')   // oder numeric_id: getProduct(1)
 *
 * Quelle ist der **Lese-Klon** (`HQ_PRODUCTS_DIR`, D9). Er wird nie
 * beschrieben (außer in der Entwicklung ohne `HQ_WRITE_DIR`).
 *
 * Cache im Speicher je Verzeichnis. Neu gelesen wird, wenn sich die mtime
 * des Verzeichnisses ändert (git legt Dateien beim Checkout/Reset neu an,
 * das ändert sie), spätestens aber nach 60 s - eine Datei, die an Ort und
 * Stelle überschrieben wird, ändert die Verzeichnis-mtime nicht. Eigene
 * Schreibvorgänge rufen `invalidate()` auf.
 */
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'

// Der Core ist absichtlich CommonJS ohne Typen - deshalb per require geladen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./hq-products.core')

/** Ein Produkt, wie `/api/products` es liefert (Mock: `loadHQProducts()`). */
export interface HqProduct {
  id: string
  numeric_id?: number
  name: string
  category: string
  price: number
  available: boolean
  seasonal: boolean
  image: string | null
  short_description: string
  allergens: string[] | null
  allergens_source: string | null
  allergen_recipe: string | null
  description: string
}

/** Eine gelesene Produktdatei. `product` ist `null`, wenn `id`/`name` fehlen. */
export interface ProductFile {
  file: string
  raw: string
  data: Record<string, unknown>
  content: string
  product: Readonly<HqProduct> | null
}

export const CATALOGUE_TTL_MS = 60_000

export interface CatalogueOptions {
  ttlMs?: number
  now?: () => number
}

function findMonorepoRoot(start: string): string | null {
  let dir = path.resolve(start)
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * `HQ_PRODUCTS_DIR`, sonst `<website>/../hq/products` (wie Mock und
 * Management-Loader). Wird bei jedem Aufruf neu gelesen.
 */
export function defaultProductsDir(env: NodeJS.ProcessEnv = process.env) {
  if (env['HQ_PRODUCTS_DIR']) return path.resolve(env['HQ_PRODUCTS_DIR'])
  const root =
    findMonorepoRoot(process.cwd()) ?? findMonorepoRoot(__dirname) ?? '.'
  return path.resolve(root, '..', 'hq', 'products')
}

/** Parst eine Produktdatei; `null` bei kaputtem YAML (wie im Mock: übersprungen). */
export function parseProductFile(
  file: string,
  raw: string
): ProductFile | null {
  try {
    // Mit Optionen-Objekt: gray-matter cached sonst je Inhalt und gibt dasselbe
    // `data`-Objekt an alle Aufrufer heraus.
    const parsed = matter(raw, {})
    const data = (parsed.data ?? {}) as Record<string, unknown>
    const product = core.toHqProduct(data, parsed.content) as HqProduct | null
    return {
      file,
      raw,
      data,
      content: parsed.content,
      product: product ? Object.freeze(product) : null,
    }
  } catch {
    return null
  }
}

/** Alle Produktdateien eines Verzeichnisses, `null`, wenn es fehlt. */
export function readProductFiles(dir: string): ProductFile[] | null {
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  const files: ProductFile[] = []
  for (const file of names.filter(core.isProductFileName).sort()) {
    let raw: string
    try {
      raw = fs.readFileSync(path.join(dir, file), 'utf-8')
    } catch {
      continue
    }
    const parsed = parseProductFile(file, raw)
    if (parsed) files.push(parsed)
  }
  return files
}

interface Snapshot {
  stamp: number | null
  loadedAt: number
  available: boolean
  files: ProductFile[]
  products: Readonly<HqProduct>[]
}

export class HqCatalogue {
  readonly dir: string
  private readonly ttlMs: number
  private readonly now: () => number
  private snapshot: Snapshot | null = null
  private warned = false

  constructor(dir: string, options: CatalogueOptions = {}) {
    this.dir = path.resolve(dir)
    this.ttlMs = options.ttlMs ?? CATALOGUE_TTL_MS
    this.now = options.now ?? Date.now
  }

  /** mtime des Verzeichnisses, `null`, wenn es fehlt. */
  private stamp(): number | null {
    try {
      return fs.statSync(this.dir).mtimeMs
    } catch {
      return null
    }
  }

  private load(): Snapshot {
    const stamp = this.stamp()
    const current = this.snapshot
    if (
      current &&
      current.stamp === stamp &&
      this.now() - current.loadedAt < this.ttlMs
    ) {
      return current
    }
    const files = stamp === null ? null : readProductFiles(this.dir)
    if (files === null && !this.warned) {
      console.warn(`HQ products directory not found: ${this.dir}`)
      this.warned = true
    }
    if (files !== null) this.warned = false
    const list = files ?? []
    this.snapshot = {
      stamp,
      loadedAt: this.now(),
      available: files !== null,
      files: list,
      products: core.sortProducts(
        list
          .map((f) => f.product)
          .filter((p): p is Readonly<HqProduct> => p !== null)
      ),
    }
    return this.snapshot
  }

  /** Gibt es das Verzeichnis? */
  available(): boolean {
    return this.load().available
  }

  /** Alle Produkte, nach `numeric_id` sortiert. Objekte sind eingefroren. */
  list(): Readonly<HqProduct>[] {
    return [...this.load().products]
  }

  /** Produkt per Slug oder `numeric_id` (Zahl oder `"1"`), sonst `null`. */
  get(key: string | number): Readonly<HqProduct> | null {
    return core.findProduct(this.load().products, key)
  }

  /** Die gelesenen Dateien (für Schreiben und den Abgleich "wartet auf Freigabe"). */
  files(): ProductFile[] {
    return [...this.load().files]
  }

  /** Datei eines Produkts per Slug. */
  fileOf(id: string): ProductFile | null {
    return this.load().files.find((f) => f.product?.id === id) ?? null
  }

  /** Datei per Dateiname. */
  fileNamed(file: string): ProductFile | null {
    return this.load().files.find((f) => f.file === file) ?? null
  }

  /** Nach eigenem Schreiben: beim nächsten Zugriff neu lesen. */
  invalidate(): void {
    this.snapshot = null
  }
}

const catalogues = new Map<string, HqCatalogue>()

/** Der (geteilte) Katalog eines Verzeichnisses - ein Cache je Pfad. */
export function catalogueFor(dir: string = defaultProductsDir()): HqCatalogue {
  const key = path.resolve(dir)
  let catalogue = catalogues.get(key)
  if (!catalogue) {
    catalogue = new HqCatalogue(key)
    catalogues.set(key, catalogue)
  }
  return catalogue
}

/** Alle Produkte aus dem Lese-Klon (`HQ_PRODUCTS_DIR`), freigegebener Stand. */
export function getCatalogue(): Readonly<HqProduct>[] {
  return catalogueFor().list()
}

/** Ein Produkt aus dem Lese-Klon per Slug oder `numeric_id`, sonst `null`. */
export function getProduct(key: string | number): Readonly<HqProduct> | null {
  return catalogueFor().get(key)
}

/** Alle Caches verwerfen (oder nur den eines Verzeichnisses). */
export function invalidateCatalogue(dir?: string): void {
  if (dir) {
    catalogues.get(path.resolve(dir))?.invalidate()
    return
  }
  for (const catalogue of catalogues.values()) catalogue.invalidate()
}
