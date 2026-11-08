/**
 * Varianten-Haken der Vorbestellungen (B7, roadmap §5.3): welche Sorten
 * (Füllungen) ein Produkt laut `hq/config/backzettel.yaml` hat.
 *
 *   const hook = createVariantsHook()
 *   hook('zopf-gefuellt-…')   // { itemId, variants: ['nuss', …] } | null
 *
 * `null` heißt "nichts zu prüfen": keine (gültige) Stammdatei oder das Produkt
 * steht in keinem Backzettel-Posten. Dann nimmt die Vorbestellung jeden
 * Sorten-Slug an. Steht das Produkt in einem Posten, prüft
 * `delivery-preorders.core.js` (`checkVariant`) gegen dessen `variants`.
 *
 * Z10: ein Produkt eines Größen-Postens (Brot je Laibgröße) nennt seine
 * Größe selbst (`products[].size`): `variants: []` - die Vorbestellung
 * speichert `''`, die Maske fragt nicht nach einer Sorte - und `size` dazu.
 *
 * `hook.all()` liefert alle Produkte mit Sorten auf einmal
 * (`{ [productId]: ['nuss', …] }`, `null` ohne gültige Stammdatei) - für
 * `GET /api/preorders/variants`, die Sorten-Chips der Erfassungsmaske (P1).
 *
 * Pfad (erster Treffer): `options.configPath` → `HQ_BACKZETTEL_CONFIG` →
 * `${HQ_DIR}/config/backzettel.yaml` → `<website>/../hq/config/backzettel.yaml`
 * (dieselbe Reihenfolge wie der Backzettel-Loader von Z3). Neu gelesen wird,
 * wenn sich die mtime der Datei ändert, spätestens nach 60 s.
 */
import * as fs from 'fs'
import * as path from 'path'

import { defaultProductsDir } from './hq-catalogue'

/* eslint-disable @typescript-eslint/no-var-requires */
const loader = require('./backzettel-config.loader')
const backzettel = require('./backzettel.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface VariantInfo {
  itemId: string
  variants: string[]
  /** Z10: die Laibgröße, auf die das Produkt fällt (nur Größen-Posten). */
  size?: string | null
}

export type VariantsForProduct = (productId: string) => VariantInfo | null

/** `{ [productId]: Sorten }` - nur Produkte, die Sorten haben. */
export type VariantsMap = Record<string, string[]>

/** Der Haken aus `createVariantsHook`: je Produkt, und alle auf einmal. */
export interface VariantsHook extends VariantsForProduct {
  all: () => VariantsMap | null
}

export interface VariantsHookOptions {
  configPath?: string
  cacheMs?: number
  env?: NodeJS.ProcessEnv
}

export function defaultBackzettelConfigPath(
  env: NodeJS.ProcessEnv = process.env
): string {
  const explicit = env['HQ_BACKZETTEL_CONFIG']?.trim()
  if (explicit) return path.resolve(explicit)
  const hq = env['HQ_DIR']?.trim()
  if (hq) return path.resolve(hq, 'config', 'backzettel.yaml')
  // defaultProductsDir() ends in <hq>/products
  return path.resolve(
    path.dirname(defaultProductsDir(env)),
    'config',
    'backzettel.yaml'
  )
}

export function createVariantsHook(
  options: VariantsHookOptions = {}
): VariantsHook {
  const configPath = path.resolve(
    options.configPath ?? defaultBackzettelConfigPath(options.env)
  )
  const cacheMs = options.cacheMs ?? 60_000
  let cached: { mtime: number | null; at: number; config: unknown } | null =
    null
  let warned = false

  const load = (): unknown => {
    let mtime: number | null = null
    try {
      mtime = fs.statSync(configPath).mtimeMs
    } catch {
      mtime = null
    }
    if (cached && cached.mtime === mtime && Date.now() - cached.at < cacheMs) {
      return cached.config
    }
    let config: unknown = null
    if (mtime !== null) {
      const result = loader.loadBackzettelConfig(configPath)
      if (result.ok) {
        config = result.config
        warned = false
      } else if (!warned) {
        console.warn(
          `[WARN] Backzettel-Stammdaten ungültig (${configPath}) - Vorbestellungen prüfen Sorten nicht.`
        )
        warned = true
      }
    }
    cached = { mtime, at: Date.now(), config }
    return config
  }

  const hook = ((productId: string) => {
    const config = load()
    if (!config) return null
    const info = backzettel.variantsForProduct(config, productId)
    if (!info) return null
    return info.size === undefined
      ? { itemId: info.itemId, variants: info.variants }
      : { itemId: info.itemId, variants: info.variants, size: info.size }
  }) as VariantsHook
  hook.all = () => {
    const config = load()
    return config ? (backzettel.variantsByProduct(config) as VariantsMap) : null
  }
  return hook
}
