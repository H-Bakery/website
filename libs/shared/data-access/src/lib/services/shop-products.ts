/**
 * @fileoverview Real product data access for the customer shop (apps/bakery-shop).
 * @module @bakery/shared/data-access/shop-products
 *
 * This is the single source of truth for shop product data. It talks to the live
 * API (`GET /api/products`), which serves the ~103 real products from `hq/products/*.md`.
 *
 * It intentionally lives next to — and does NOT replace — the legacy `bakeryAPI`
 * mock (`../mocks/products.ts`), which other apps still import. The shop must use
 * this module only.
 */

import {
  Product,
  ProductCategory,
  ProductStatus,
  ProductType,
} from '@bakery/shared/types'

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** The seven product categories that actually exist in the `hq` content. */
export type ShopCategory =
  | 'brot'
  | 'broetchen'
  | 'baguette'
  | 'teilchen'
  | 'snacks'
  | 'kuchen'
  | 'torten'

/**
 * A product as the shop consumes it: camelCase, fully normalised, with the
 * one-line teaser (`shortDescription`) and the long body text (`description`)
 * kept strictly apart. Collapsing those two fields caused a data-loss bug
 * before — do not merge them.
 */
export interface ShopProduct {
  /** Slug id, e.g. `'kornbrot-500g'`. Stable, used in URLs. */
  id: string
  /** Numeric id, e.g. `1`. Used as the cart key (`Product.id` is a number). */
  numericId: number
  name: string
  category: ShopCategory
  price: number
  available: boolean
  seasonal: boolean
  /** Public image path, e.g. `'/assets/images/products/kornbrot.svg'`, or `null`. */
  image: string | null
  /** One-line teaser from the markdown frontmatter. */
  shortDescription: string
  /** Long body text from the markdown file. */
  description: string
  /**
   * Allergene nach LMIV Anhang II, aus dem Rezept der Backstube abgeleitet.
   *
   * `null` heisst **nicht deklariert** und ist etwas voellig anderes als `[]`
   * ("enthaelt keines der 14 Allergene"). Die Unterscheidung muss bis in die
   * Oberflaeche durchgehalten werden: fuer ein Produkt ohne Angabe darf der
   * Shop keine Freiheit von Allergenen behaupten.
   */
  allergens?: string[] | null
  /** `'rezept'` = aus dem Rezept abgeleitet, `'geprueft'` = von der Baeckerei bestaetigt. */
  allergensSource?: 'rezept' | 'geprueft' | null
  /** Name des Rezepts, aus dem die Angaben stammen. Nur bei `'rezept'`. */
  allergenRecipe?: string | null
}

/**
 * A {@link Product} enriched with the shop's slug id so that an order line can
 * reference the human-readable product id after a round trip through the cart.
 * Assignable to `Product` everywhere, so callers may keep typing it as `Product`.
 */
export interface ShopCartProduct extends Product {
  /** The {@link ShopProduct.id} slug, e.g. `'kornbrot-500g'`. */
  slug: string
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/** All shop categories with their German labels, in display order. */
export const SHOP_CATEGORIES: ReadonlyArray<{
  key: ShopCategory
  label: string
}> = [
  { key: 'brot', label: 'Brot' },
  { key: 'broetchen', label: 'Brötchen' },
  { key: 'baguette', label: 'Baguette' },
  { key: 'teilchen', label: 'Teilchen' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'kuchen', label: 'Kuchen' },
  { key: 'torten', label: 'Torten' },
]

const SHOP_CATEGORY_KEYS: ReadonlyArray<ShopCategory> = SHOP_CATEGORIES.map(
  (entry) => entry.key
)

/** Fallback for products whose category is missing or unknown. */
const FALLBACK_CATEGORY: ShopCategory = 'snacks'

/** Type guard for values coming from URLs, query params or the API. */
export function isShopCategory(value: unknown): value is ShopCategory {
  return (
    typeof value === 'string' &&
    SHOP_CATEGORY_KEYS.includes(value as ShopCategory)
  )
}

/** German label for a category key. */
export function shopCategoryLabel(category: ShopCategory): string {
  const match = SHOP_CATEGORIES.find((entry) => entry.key === category)
  return match ? match.label : category
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

// Built once at module scope — constructing an Intl formatter per call is slow.
const EURO_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

/**
 * Formats a number as a German price, e.g. `2.5` -> `"2,50 €"`.
 * Note: Intl inserts a non-breaking space before the currency symbol.
 */
export function formatEuro(value: number): string {
  return EURO_FORMATTER.format(Number.isFinite(value) ? value : 0)
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                        */
/* -------------------------------------------------------------------------- */

const DEFAULT_API_BASE_URL = 'http://localhost:5000'

const PRODUCTS_ERROR = 'Produkte konnten nicht geladen werden.'

/**
 * Resolves the API base URL (`NEXT_PUBLIC_API_URL`, else localhost:5000),
 * without a trailing slash. Read per call so tests and runtime config apply.
 */
export function resolveShopApiBaseUrl(): string {
  const configured =
    typeof process !== 'undefined'
      ? process.env?.['NEXT_PUBLIC_API_URL']
      : undefined
  const base =
    typeof configured === 'string' && configured.trim().length > 0
      ? configured.trim()
      : DEFAULT_API_BASE_URL
  return base.replace(/\/+$/, '')
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/** Raw payload shape as delivered by `GET /api/products` (snake_case). */
interface RawShopProduct {
  id?: unknown
  numeric_id?: unknown
  name?: unknown
  category?: unknown
  price?: unknown
  available?: unknown
  seasonal?: unknown
  image?: unknown
  short_description?: unknown
  description?: unknown
  allergens?: unknown
  allergens_source?: unknown
  allergen_recipe?: unknown
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/**
 * Allergenliste normalisieren.
 *
 * Gibt `null` zurueck, wenn das Feld fehlt oder keine Liste ist - "nicht
 * deklariert". Eine vorhandene, aber leere Liste bleibt `[]` erhalten: das ist
 * eine Aussage der Baeckerei und darf nicht zu "nicht deklariert" verfallen.
 */
function asAllergenList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const keys = value
    .map((entry) =>
      typeof entry === 'string' ? entry.trim().toLowerCase() : ''
    )
    .filter((entry) => entry.length > 0)
  return Array.from(new Set(keys)).sort()
}

function asAllergenSource(value: unknown): 'rezept' | 'geprueft' | null {
  const source = asTrimmedString(value).toLowerCase()
  return source === 'rezept' || source === 'geprueft' ? source : null
}

/**
 * Maps one raw API record to a {@link ShopProduct}. Returns `null` for records
 * without a usable id or name so a single bad markdown file cannot break the shop.
 */
function mapShopProduct(entry: unknown): ShopProduct | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as RawShopProduct

  const id = asTrimmedString(raw.id)
  const name = asTrimmedString(raw.name)
  if (!id || !name) return null

  const image = asTrimmedString(raw.image)
  const category = isShopCategory(raw.category)
    ? raw.category
    : FALLBACK_CATEGORY

  return {
    id,
    numericId: asNumber(raw.numeric_id, 0),
    name,
    category,
    price: asNumber(raw.price, 0),
    // The API defaults `available` to true; only an explicit `false` hides a product.
    available: raw.available !== false,
    seasonal: raw.seasonal === true,
    image: image.length > 0 ? image : null,
    shortDescription: asTrimmedString(raw.short_description),
    description: asTrimmedString(raw.description),
    allergens: asAllergenList(raw.allergens),
    allergensSource: asAllergenSource(raw.allergens_source),
    allergenRecipe: asTrimmedString(raw.allergen_recipe) || null,
  }
}

/** Accepts both `{ data: [...] }` and a bare array. */
function extractList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) return data
  }
  return []
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Loads every real product from the API.
 *
 * @throws {Error} `'Produkte konnten nicht geladen werden.'` on network or HTTP
 * failure, so pages can surface a German message.
 */
export async function fetchShopProducts(): Promise<ShopProduct[]> {
  let response: Response
  try {
    response = await fetch(`${resolveShopApiBaseUrl()}/api/products`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    throw new Error(PRODUCTS_ERROR)
  }

  if (!response.ok) {
    throw new Error(PRODUCTS_ERROR)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error(PRODUCTS_ERROR)
  }

  return extractList(payload)
    .map(mapShopProduct)
    .filter((product): product is ShopProduct => product !== null)
}

/**
 * Loads a single product by EITHER its slug id (`'kornbrot-500g'`) or its
 * numeric id (`'1'`) — both shapes appear in URLs.
 *
 * @returns the product, or `null` when it does not exist (no throw).
 * @throws {Error} only when the product list itself cannot be loaded.
 */
export async function fetchShopProduct(
  idOrNumericId: string
): Promise<ShopProduct | null> {
  const key = asTrimmedString(idOrNumericId)
  if (!key) return null

  const normalized = key.toLowerCase()
  const products = await fetchShopProducts()

  const match = products.find(
    (product) =>
      product.id.toLowerCase() === normalized ||
      String(product.numericId) === normalized
  )

  return match ?? null
}

/* -------------------------------------------------------------------------- */
/* Cart interop                                                                */
/* -------------------------------------------------------------------------- */

const CATEGORY_TO_PRODUCT_CATEGORY: Record<ShopCategory, ProductCategory> = {
  brot: ProductCategory.Bread,
  // Baguette has no dedicated enum member; it is bread.
  baguette: ProductCategory.Bread,
  broetchen: ProductCategory.Buns,
  teilchen: ProductCategory.Pastries,
  snacks: ProductCategory.Snacks,
  kuchen: ProductCategory.Cakes,
  torten: ProductCategory.SpecialCakes,
}

/**
 * Stock is not tracked by the content API. The cart validates
 * `quantity > stock`, so an available product gets a high sentinel and an
 * unavailable one gets 0.
 */
const AVAILABLE_STOCK_SENTINEL = 999

/**
 * Maps a {@link ShopProduct} onto the canonical `Product` type so it can be put
 * into `CartContext` via `addToCart()`.
 *
 * - `Product.id` is the numeric id — the cart keys on it.
 * - `Product.description` carries the short teaser (that is what a cart line
 *   should show); the long body stays on {@link ShopProduct.description}.
 * - The slug is preserved as {@link ShopCartProduct.slug} so the order payload
 *   can reference `'kornbrot-500g'` rather than `'1'`.
 */
export function toCartProduct(p: ShopProduct): ShopCartProduct {
  return {
    id: p.numericId,
    // BaseEntity requires these; the content API has no timestamps and a
    // generated one would differ between server and client render (hydration).
    createdAt: '',
    updatedAt: '',
    slug: p.id,
    name: p.name,
    description: p.shortDescription || p.description,
    category: CATEGORY_TO_PRODUCT_CATEGORY[p.category],
    type: p.seasonal ? ProductType.Seasonal : ProductType.Fresh,
    price: p.price,
    unit: 'Stück',
    stock: p.available ? AVAILABLE_STOCK_SENTINEL : 0,
    status: p.available ? ProductStatus.Available : ProductStatus.OutOfStock,
    image: p.image ?? undefined,
    imageUrl: p.image ?? undefined,
    isActive: p.available,
  }
}
