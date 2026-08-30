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
  /** Raw `image:` value from the file, before any category fallback is applied. */
  rawImage: string
  short_description: string
  /** Markdown body of the file, with the leading `# Heading` stripped. */
  description: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  brot: 'Brot',
  broetchen: 'Brötchen',
  baguette: 'Baguette',
  teilchen: 'Teilchen',
  snacks: 'Snacks',
  kuchen: 'Kuchen',
  torten: 'Torten',
}

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  brot: '/assets/images/products/brot-rund.svg',
  broetchen: '/assets/images/products/broetchen.svg',
  baguette: '/assets/images/products/baguette.svg',
  teilchen: '/assets/images/products/croissant.svg',
  snacks: '/assets/images/products/brezel.svg',
  kuchen: '/assets/images/products/kuchen.svg',
  torten: '/assets/images/products/kuchen.svg',
}

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

        // Body text without the leading `# Produktname` heading.
        const bodyText = content
          .trim()
          .replace(/^#{1,6}[^\n]*\n+/, '')
          .trim()

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
          rawImage: typeof data.image === 'string' ? data.image : '',
          short_description: data.short_description || '',
          description: bodyText,
        } as HQProduct
      } catch {
        return null
      }
    })
    .filter((p): p is HQProduct => p !== null)
    .sort((a, b) => a.numeric_id - b.numeric_id)
}

export interface ManagementProduct {
  id: string
  name: string
  category: string
  categoryKey: string
  price: number
  status: 'active' | 'seasonal' | 'unavailable'
  image: string | null
  rawImage: string
  /** One-liner for list/teaser views (frontmatter `short_description`). */
  shortDescription: string
  /** Full body text of the product file. */
  description: string
}

export function getManagementProducts(): ManagementProduct[] {
  return getHQProducts().map((p) => ({
    id: p.id,
    name: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    categoryKey: p.category,
    price: p.price,
    status: !p.available ? 'unavailable' : p.seasonal ? 'seasonal' : 'active',
    image: p.image,
    rawImage: p.rawImage,
    shortDescription: p.short_description,
    description: p.description,
  }))
}
