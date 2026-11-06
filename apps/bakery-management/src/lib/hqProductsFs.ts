import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

/**
 * Server-only: liest `hq/products/*.md` direkt vom Dateisystem.
 *
 * Seit F4 braucht das nur noch der Katalog der Verkaufspartner-Masken
 * (`lib/partners.ts`, Server-Komponenten der Erfassung und der Vorlagen) -
 * so kommt die Maske am Handy ohne zusätzlichen Produkt-Request aus. Gelesen
 * wird `HQ_PRODUCTS_DIR`, auf der Box derselbe Lese-Klon wie die API
 * (freigegebener Stand); die API prüft jede Position ohnehin gegen ihren
 * Katalog. Die Produktverwaltung liest dagegen `GET /api/hq-products`
 * (`lib/products.ts`) - sie braucht den Stand im Schreib-Worktree.
 *
 * Nie aus einer 'use client'-Datei importieren (`fs`).
 */

export interface HQProductFile {
  id: string
  numeric_id: number
  name: string
  category: string
  price: number
  available: boolean
  seasonal: boolean
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

export function getHQProducts(): HQProductFile[] {
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
        return {
          id: data.id,
          numeric_id: data.numeric_id ?? 0,
          name: data.name,
          category: data.category,
          price: data.price ?? 0,
          available: data.available ?? true,
          seasonal: data.seasonal ?? false,
        } as HQProductFile
      } catch {
        return null
      }
    })
    .filter((p): p is HQProductFile => p !== null)
    .sort((a, b) => a.numeric_id - b.numeric_id)
}
