import path from 'path'
import {
  findMonorepoRoot,
  isListedHqProduct,
  readHqProducts,
} from '@bakery/shared/hq-products'
import {
  bildVarianten,
  readBilderIndex,
  type BilderIndex,
} from '@bakery/shared/produkte-3d'
import { Product, RenderedProductImage } from '../types/product'
import type { OrderProduct } from './order/order-config'

export interface HQProduct {
  id: string
  numeric_id: number
  name: string
  category: string
  price: number | null
  available: boolean
  seasonal: boolean
  image: string | null
  /** Set only when `image` is an image rendered from the product's 3D model. */
  renderedImage?: RenderedProductImage
  short_description: string
  description: string
}

/** Display label for each category key */
export const CATEGORY_LABELS: Record<string, string> = {
  brot: 'Brot',
  broetchen: 'Brötchen',
  baguette: 'Baguette',
  teilchen: 'Teilchen',
  snacks: 'Snacks',
  kuchen: 'Kuchen',
  torten: 'Torten',
}

/** Default fallback image per category */
const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  brot: '/assets/images/products/brot-rund.svg',
  broetchen: '/assets/images/products/broetchen.svg',
  baguette: '/assets/images/products/baguette.svg',
  teilchen: '/assets/images/products/croissant.svg',
  snacks: '/assets/images/products/brezel.svg',
  kuchen: '/assets/images/products/kuchen.svg',
  torten: '/assets/images/products/kuchen.svg',
}

/** Display order for categories */
const CATEGORY_ORDER = [
  'brot',
  'baguette',
  'broetchen',
  'teilchen',
  'snacks',
  'kuchen',
  'torten',
]

/** Where `scripts/sync-produktbilder.js` serves the data repo's files from. */
const RENDERED_IMAGE_BASE = '/produkte-3d/'

/**
 * The index of product images rendered from the 3D models (DB13), written by
 * `scripts/sync-produktbilder.js` before the build. No file (no sync ran, CI
 * and the deploy have no data repo) = no images.
 */
export function loadRenderedImageIndex(): BilderIndex {
  return readBilderIndex(
    process.env.LANDING_PRODUKTBILDER_INDEX ||
      path.join(
        findMonorepoRoot(),
        'apps',
        'bakery-landing',
        'produkte-3d-bilder.json'
      )
  )
}

/** The rendered image of a product (`haupt` view), or `undefined`. */
export function renderedImageFor(
  index: BilderIndex,
  id: string
): RenderedProductImage | undefined {
  const varianten = bildVarianten(index, id)
  if (varianten.length === 0) return undefined
  const largest = varianten[varianten.length - 1]
  return {
    src: `${RENDERED_IMAGE_BASE}${largest.file}`,
    srcSet: varianten
      .map((v) => `${RENDERED_IMAGE_BASE}${v.file} ${v.breite}w`)
      .join(', '),
    width: largest.breite,
    height: largest.hoehe,
  }
}

/** A real photo: an explicit raster file. `images/` is hq's empty placeholder. */
function isPhotoPath(image: string | undefined): boolean {
  return (
    !!image &&
    image !== 'images/' &&
    image.length > 10 &&
    !image.toLowerCase().endsWith('.svg')
  )
}

/**
 * Which image a product shows - the one place that decides:
 *
 * 1. a real photo set in hq (`image:` with a raster file) always wins,
 * 2. else the image rendered from the product's 3D model, if there is one,
 * 3. else the vector illustration set in hq (`image:` with an `.svg`),
 * 4. else the category illustration.
 *
 * Without rendered images (CI, deploy) this is exactly the old behaviour.
 */
export function resolveProductImage(
  product: { id: string; category: string; image?: string },
  index: BilderIndex
): { image: string | null; renderedImage?: RenderedProductImage } {
  if (isPhotoPath(product.image)) return { image: product.image ?? null }
  const renderedImage = renderedImageFor(index, product.id)
  if (renderedImage) return { image: renderedImage.src, renderedImage }
  // Explicit image if it's a real path, otherwise the category fallback.
  if (
    product.image &&
    product.image !== 'images/' &&
    product.image.length > 10
  ) {
    return { image: product.image }
  }
  return { image: CATEGORY_FALLBACK_IMAGE[product.category] || null }
}

/**
 * Read all products from HQ and map them to the landing page's shape
 * (fallback image per category, defaults for missing fields).
 * This runs at build time (server component / static generation).
 *
 * Reading and parsing `hq/products/*.md` (`HQ_PRODUCTS_DIR`, else
 * `<monorepo>/../hq/products`) lives once in `@bakery/shared/hq-products`.
 */
export function getHQProducts(): HQProduct[] {
  const { dir, found, products } = readHqProducts()

  if (!found) {
    console.warn(`HQ products directory not found: ${dir}`)
    return []
  }

  const renderedImages = loadRenderedImageIndex()

  return products
    .map((p): HQProduct => {
      const { image, renderedImage } = resolveProductImage(p, renderedImages)

      return {
        id: p.id,
        numeric_id: p.numeric_id ?? 0,
        name: p.name,
        category: p.category,
        price:
          typeof p.price === 'number' &&
          Number.isFinite(p.price) &&
          p.price >= 0
            ? p.price
            : null,
        available: p.available ?? true,
        seasonal: p.seasonal ?? false,
        image,
        // Only present with a rendered image: without one the product has
        // exactly the fields it had before (the export stays the same).
        ...(renderedImage ? { renderedImage } : {}),
        short_description: p.short_description || '',
        description: p.body || p.short_description || '',
      }
    })
    .sort((a, b) => a.numeric_id - b.numeric_id)
}

/** Nur hq-Daten für die Vorbestellung. Die gebündelte Liste dient der Ansicht. */
export function loadOrderCatalogue(): OrderProduct[] {
  const products = getHQProducts()
  const section = (category: string) => {
    const index = CATEGORY_ORDER.indexOf(category)
    return index === -1 ? CATEGORY_ORDER.length : index
  }
  return products
    .sort((a, b) => section(a.category) - section(b.category))
    .map(({ id, name, category, price, available, image, renderedImage }) => ({
      id,
      name,
      category,
      price,
      available,
      image,
      ...(renderedImage ? { renderedImage } : {}),
    }))
}

export interface ProductsByCategory {
  key: string
  label: string
  products: HQProduct[]
}

/**
 * Group products by category, sorted in display order.
 */
export function getProductsByCategory(): ProductsByCategory[] {
  const products = getHQProducts()

  const grouped = new Map<string, HQProduct[]>()
  for (const product of products) {
    if (!isListed(product)) continue
    const cat = product.category
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(product)
  }

  return CATEGORY_ORDER.filter((key) => grouped.has(key)).map((key) => ({
    key,
    label: CATEGORY_LABELS[key] || key,
    products: grouped.get(key)!,
  }))
}

/**
 * Fallback: gebündelte Produktliste (src/mocks/products), falls das externe
 * HQ-Produktverzeichnis nicht verfügbar ist (z. B. im CI-Build für GitHub Pages).
 */
function loadFallbackProducts(): Product[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PRODUCTS } = require('../mocks/products') as {
    PRODUCTS: Array<{
      id: number
      name: string
      category: string
      image?: string
      price: number
      description?: string
    }>
  }
  return PRODUCTS.map((p) => {
    const categoryKey =
      Object.keys(CATEGORY_LABELS).find(
        (k) => CATEGORY_LABELS[k] === p.category
      ) || ''
    const image =
      p.image && p.image.length > 10
        ? p.image
        : CATEGORY_FALLBACK_IMAGE[categoryKey] || null
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      image,
      imageUrl: image,
      description: p.description,
      available: true,
      seasonal: false,
    }
  })
}

/**
 * Load all HQ products and map them to the display Product format.
 * Runs at build time (server component / static generation).
 *
 * All of them, including the ones hq marks `available: false`: every product
 * keeps its page (old links, and the deploy guard wants one page per hq file).
 * What customers browse - listing, search, featured, related, sitemap - goes
 * through `loadListedProducts()` / `isListed()`.
 */
export function loadProducts(): Product[] {
  const hq = getHQProducts()
  if (hq.length === 0) {
    console.warn('Using bundled fallback products (src/mocks/products).')
    return loadFallbackProducts()
  }
  return hq.map((p) => ({
    id: p.numeric_id,
    orderId: p.id,
    name: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    price: p.price,
    image: p.image,
    imageUrl: p.image,
    ...(p.renderedImage ? { renderedImage: p.renderedImage } : {}),
    description: p.description || p.short_description || undefined,
    available: p.available,
    seasonal: p.seasonal,
  }))
}

/**
 * Whether a product is currently offered (`available` is not `false` in hq).
 * The rule itself lives once in `@bakery/shared/hq-products`.
 */
export function isListed(product: { available?: boolean | null }): boolean {
  return isListedHqProduct(product)
}

/** The products currently offered: listing, search and the start page. */
export function loadListedProducts(): Product[] {
  return loadProducts().filter(isListed)
}

/**
 * Related products for a product page: the next `count` offered products of
 * the same category by id after `current`, wrapping around to the start of
 * the category - so every product page links to its neighbours, not all of
 * them to the first four. Never `current` itself, never an unlisted product.
 * Works for an unlisted `current` too (then: alternatives).
 */
export function relatedProducts(
  all: Product[],
  current: Product,
  count = 4
): Product[] {
  const sameCategory = all
    .filter(
      (p) =>
        p.category === current.category && p.id !== current.id && isListed(p)
    )
    .sort((a, b) => a.id - b.id)
  const after = sameCategory.filter((p) => p.id > current.id)
  const before = sameCategory.filter((p) => p.id < current.id)
  return [...after, ...before].slice(0, count)
}
