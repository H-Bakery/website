import { readHqProducts } from '@bakery/shared/hq-products'
import { Product } from '../types/product'

export interface HQProduct {
  id: string
  numeric_id: number
  name: string
  category: string
  price: number
  available: boolean
  seasonal: boolean
  image: string | null
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

  return products
    .map((p): HQProduct => {
      // Resolve image: use explicit image if it's a real path, otherwise fallback
      let image: string | null = null
      if (p.image && p.image !== 'images/' && p.image.length > 10) {
        image = p.image
      } else {
        image = CATEGORY_FALLBACK_IMAGE[p.category] || null
      }

      return {
        id: p.id,
        numeric_id: p.numeric_id ?? 0,
        name: p.name,
        category: p.category,
        price: p.price ?? 0,
        available: p.available ?? true,
        seasonal: p.seasonal ?? false,
        image,
        short_description: p.short_description || '',
        description: p.body || p.short_description || '',
      }
    })
    .sort((a, b) => a.numeric_id - b.numeric_id)
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
    if (!product.available) continue
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
 * Load all HQ products and map them to the display Product format.
 * Runs at build time (server component / static generation).
 */
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

export function loadProducts(): Product[] {
  const hq = getHQProducts()
  if (hq.length === 0) {
    console.warn('Using bundled fallback products (src/mocks/products).')
    return loadFallbackProducts()
  }
  return hq.map((p) => ({
    id: p.numeric_id,
    name: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    price: p.price,
    image: p.image,
    imageUrl: p.image,
    description: p.description || p.short_description || undefined,
    available: p.available,
    seasonal: p.seasonal,
  }))
}
