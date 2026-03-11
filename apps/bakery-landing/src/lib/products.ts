import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
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

function findMonorepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

function getHQProductsDir(): string {
  if (process.env.HQ_PRODUCTS_DIR) return process.env.HQ_PRODUCTS_DIR
  const root = findMonorepoRoot()
  return path.join(root, '..', 'hq', 'products')
}

/**
 * Read all product markdown files from HQ and parse their frontmatter.
 * This runs at build time (server component / static generation).
 */
export function getHQProducts(): HQProduct[] {
  const dir = getHQProductsDir()

  if (!fs.existsSync(dir)) {
    console.warn(`HQ products directory not found: ${dir}`)
    return []
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))

  return files
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        const { data, content } = matter(raw)
        if (!data.id || !data.name) return null

        // Resolve image: use explicit image if it's a real path, otherwise fallback
        let image: string | null = null
        if (data.image && data.image !== 'images/' && data.image.length > 10) {
          image = data.image
        } else {
          image = CATEGORY_FALLBACK_IMAGE[data.category] || null
        }

        // Extract body text (after frontmatter, strip the h1 heading)
        const bodyText = content.replace(/^#[^\n]*\n/, '').trim()

        return {
          id: data.id,
          numeric_id: data.numeric_id ?? 0,
          name: data.name,
          category: data.category,
          price: data.price ?? 0,
          available: data.available ?? true,
          seasonal: data.seasonal ?? false,
          image,
          short_description: data.short_description || '',
          description: bodyText || data.short_description || '',
        } as HQProduct
      } catch {
        return null
      }
    })
    .filter((p): p is HQProduct => p !== null)
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
export function loadProducts(): Product[] {
  return getHQProducts().map((p) => ({
    id: p.numeric_id,
    name: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    price: p.price,
    image: p.image,
    imageUrl: p.image,
    description: p.short_description || undefined,
    available: p.available,
    seasonal: p.seasonal,
  }))
}
