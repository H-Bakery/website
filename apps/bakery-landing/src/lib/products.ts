import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

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
}

/** Display label for each category key */
const CATEGORY_LABELS: Record<string, string> = {
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
  brot: '/assets/images/products/Type=Brot Rund.svg',
  broetchen: '/assets/images/products/Type=Brötchen.svg',
  baguette: '/assets/images/products/Type=Baguette.svg',
  teilchen: '/assets/images/products/Type=Croissant.svg',
  snacks: '/assets/images/products/Type=Brezel.svg',
  kuchen: '/assets/images/products/Type=Kuchen.svg',
  torten: '/assets/images/products/Type=Kuchen.svg',
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
        const { data } = matter(raw)
        if (!data.id || !data.name) return null

        // Resolve image: use explicit image if it's a real path, otherwise fallback
        let image: string | null = null
        if (data.image && data.image !== 'images/' && data.image.length > 10) {
          image = data.image
        } else {
          image = CATEGORY_FALLBACK_IMAGE[data.category] || null
        }

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
