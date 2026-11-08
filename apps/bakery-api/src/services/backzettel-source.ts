/**
 * Where the Backzettel master data comes from (Z3): `hq/config/backzettel.yaml`,
 * the hq product catalogue and the filling recipes, read through
 * `backzettel-config.loader.js` and validated by `backzettel-config.core.js`.
 *
 * Paths (first match wins):
 *   config   `options.configPath` → `HQ_BACKZETTEL_CONFIG` → `${hqDir}/config/backzettel.yaml`
 *   hq root  `options.hqDir` → `HQ_DIR` → `<cwd>/../hq` (cwd = website/, as the other loaders)
 *   products `options.productsDir` → `HQ_PRODUCTS_DIR` → `${hqDir}/products`
 *
 * Missing or invalid config is `{ ok: false, reasons }` - the API answers
 * `status: 'no-config'` and never computes with invented numbers. The result
 * is cached until the YAML or the products directory changes (mtime) and at
 * most `cacheMs` (default 60 s), so a pulled hq clone is picked up quickly.
 */
import * as fs from 'fs'
import * as path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
const loader = require('./backzettel-config.loader')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface BackzettelSourceOptions {
  configPath?: string
  hqDir?: string
  productsDir?: string
  /** Max cache age in ms (default 60 000; 0 = always reload). */
  cacheMs?: number
  env?: NodeJS.ProcessEnv
}

export interface ConfigReason {
  path: string
  message: string
}

export interface OpenMasterDataEntry {
  path: string
  code: string
  message: string
}

export interface CatalogProduct {
  id: string
  numeric_id?: number
  name?: string
  available?: boolean
}

export interface LoadedBackzettelConfig {
  ok: boolean
  /** Normalised config (`normalizeConfig`) when ok, else null. */
  config: any | null
  /** Validation errors / why there is no config. */
  reasons: ConfigReason[]
  warnings: ConfigReason[]
  /**
   * Z10: open master data - every explicit `null` on a value that is still
   * unknown (`{ path, code, message }`, docs/backzettel-v2.md §3). Not an
   * error, not a warning: shown as „offen“.
   */
  open: OpenMasterDataEntry[]
  /** Parsed filling recipes per filling id. */
  recipes: Record<string, unknown>
  recipesMissing: { id: string; message: string }[]
  catalog: CatalogProduct[] | undefined
  /** File name only (no server path) for the UI. */
  source: string
  loadedAt: string
}

export interface BackzettelSource {
  load(): LoadedBackzettelConfig
  paths: { configPath: string; hqDir: string; productsDir: string }
}

function mtime(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return null
  }
}

export function resolveBackzettelPaths(options: BackzettelSourceOptions = {}): {
  configPath: string
  hqDir: string
  productsDir: string
} {
  const env = options.env ?? process.env
  // An explicit `hqDir` option (tests, tools) also decides the derived
  // paths; the environment only fills in what no option names.
  const fromEnv = (name: string) =>
    options.hqDir === undefined ? env[name] : undefined
  const hqDir = path.resolve(
    options.hqDir ?? env['HQ_DIR'] ?? path.join(process.cwd(), '..', 'hq')
  )
  const configPath = path.resolve(
    options.configPath ??
      fromEnv('HQ_BACKZETTEL_CONFIG') ??
      path.join(hqDir, 'config', 'backzettel.yaml')
  )
  const productsDir = path.resolve(
    options.productsDir ??
      fromEnv('HQ_PRODUCTS_DIR') ??
      path.join(hqDir, 'products')
  )
  return { configPath, hqDir, productsDir }
}

export function createBackzettelSource(
  options: BackzettelSourceOptions = {}
): BackzettelSource {
  const paths = resolveBackzettelPaths(options)
  const cacheMs = options.cacheMs ?? 60_000
  let cached: {
    key: string
    at: number
    value: LoadedBackzettelConfig
  } | null = null

  function read(): LoadedBackzettelConfig {
    const base = {
      recipes: {},
      recipesMissing: [],
      source: path.basename(paths.configPath),
      loadedAt: new Date().toISOString(),
    }
    if (mtime(paths.configPath) === null) {
      return {
        ...base,
        ok: false,
        config: null,
        reasons: [
          {
            path: '',
            message: `Die Backzettel-Stammdaten (${path.basename(
              paths.configPath
            )}) fehlen in hq.`,
          },
        ],
        warnings: [],
        open: [],
        catalog: undefined,
      }
    }
    const warnings: ConfigReason[] = []
    let catalog: CatalogProduct[] | undefined
    if (mtime(paths.productsDir) !== null) {
      try {
        catalog = loader.readProductCatalog(paths.productsDir)
      } catch {
        catalog = undefined
      }
    }
    if (!catalog) {
      warnings.push({
        path: '',
        message:
          'Der hq-Produktkatalog wurde nicht gefunden; Produktverweise werden nicht geprüft.',
      })
    }
    const result = loader.loadBackzettelConfig(paths.configPath, {
      products: catalog,
    })
    if (!result.ok) {
      return {
        ...base,
        ok: false,
        config: null,
        reasons: result.errors,
        warnings: [...warnings, ...result.warnings],
        open: Array.isArray(result.open) ? result.open : [],
        catalog,
      }
    }
    const { recipes, missing } = loader.loadFillingRecipes(
      result.config,
      paths.hqDir
    )
    return {
      ...base,
      ok: true,
      config: result.config,
      reasons: [],
      warnings: [...warnings, ...result.warnings],
      open: Array.isArray(result.open) ? result.open : [],
      recipes,
      recipesMissing: missing,
      catalog,
    }
  }

  return {
    paths,
    load() {
      const key = `${mtime(paths.configPath)}|${mtime(paths.productsDir)}`
      const now = Date.now()
      if (cached && cached.key === key && now - cached.at < cacheMs) {
        return cached.value
      }
      const value = read()
      cached = { key, at: now, value }
      return value
    },
  }
}
