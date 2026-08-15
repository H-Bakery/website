#!/usr/bin/env node
/**
 * Generates public/sitemap.xml for the static landing page build.
 *
 * URLs:
 *  - static routes
 *  - all product detail pages (/products/<id>) – mirrors src/lib/products.ts:
 *    prefers the HQ product markdown directory (env HQ_PRODUCTS_DIR or
 *    <monorepo>/../hq/products), falls back to src/mocks/products/*.json
 *  - all news articles (/news/<slug>) from content/news/*.md
 *
 * Runs before `next build` (see project.json → build-static-standalone).
 */

const fs = require('fs')
const path = require('path')

const APP_DIR = path.join(__dirname, '..')
const MONOREPO_ROOT = path.join(APP_DIR, '..', '..')
const BASE_URL = 'https://xn--bckerei-heusser-0kb.de' // keep in sync with src/config/legal.ts SITE_URL

const TODAY = new Date().toISOString().split('T')[0]

const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/products', changefreq: 'weekly', priority: 0.9 },
  { path: '/bestellen', changefreq: 'weekly', priority: 0.9 },
  { path: '/about', changefreq: 'monthly', priority: 0.8 },
  { path: '/news', changefreq: 'weekly', priority: 0.7 },
  { path: '/contact', changefreq: 'monthly', priority: 0.6 },
  { path: '/imprint', changefreq: 'yearly', priority: 0.3 },
  { path: '/datenschutz', changefreq: 'yearly', priority: 0.3 },
]

/** Minimal YAML frontmatter reader (only top-level `key: value` pairs). */
function readFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!match) return {}
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[m[1]] = value
  }
  return data
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
}

function getHQProductsDir() {
  if (process.env.HQ_PRODUCTS_DIR) return process.env.HQ_PRODUCTS_DIR
  return path.join(MONOREPO_ROOT, '..', 'hq', 'products')
}

/** Product ids from HQ markdown (numeric_id, like loadProducts()). */
function getHQProductIds() {
  const dir = getHQProductsDir()
  const ids = []
  for (const file of listMarkdownFiles(dir)) {
    try {
      const data = readFrontmatter(
        fs.readFileSync(path.join(dir, file), 'utf-8')
      )
      if (!data.id || !data.name) continue
      const numericId = Number(data.numeric_id)
      ids.push(
        Number.isFinite(numericId) && numericId > 0 ? numericId : data.id
      )
    } catch {
      // ignore unreadable file
    }
  }
  return ids
}

/** Product ids from bundled JSON mocks (fallback). */
function getMockProductIds() {
  const dir = path.join(APP_DIR, 'src', 'mocks', 'products')
  if (!fs.existsSync(dir)) return []
  const ids = []
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      const products = JSON.parse(
        fs.readFileSync(path.join(dir, file), 'utf-8')
      )
      if (!Array.isArray(products)) continue
      for (const p of products) {
        if (p && p.id !== undefined && p.id !== null) ids.push(p.id)
      }
    } catch (err) {
      console.warn(`⚠️  Could not read ${file}: ${err.message}`)
    }
  }
  return ids
}

function getProductIds() {
  const hqIds = getHQProductIds()
  if (hqIds.length > 0) {
    console.log(`📦 Products: ${hqIds.length} from HQ (${getHQProductsDir()})`)
    return hqIds
  }
  const mockIds = getMockProductIds()
  console.log(
    `📦 Products: ${mockIds.length} from src/mocks/products (fallback)`
  )
  return mockIds
}

function getNewsSlugs() {
  const dir = path.join(MONOREPO_ROOT, 'content', 'news')
  const slugs = []
  for (const file of listMarkdownFiles(dir)) {
    try {
      const data = readFrontmatter(
        fs.readFileSync(path.join(dir, file), 'utf-8')
      )
      slugs.push(data.slug || file.replace(/\.md$/, ''))
    } catch {
      slugs.push(file.replace(/\.md$/, ''))
    }
  }
  console.log(`📰 News: ${slugs.length} articles from ${dir}`)
  return slugs
}

function unique(list) {
  return [...new Set(list.map(String))]
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildUrls() {
  const urls = STATIC_ROUTES.map((r) => ({
    loc: r.path === '/' ? BASE_URL : `${BASE_URL}${r.path}`,
    changefreq: r.changefreq,
    priority: r.priority,
  }))

  for (const id of unique(getProductIds())) {
    urls.push({
      loc: `${BASE_URL}/products/${encodeURIComponent(id)}`,
      changefreq: 'weekly',
      priority: 0.7,
    })
  }

  for (const slug of unique(getNewsSlugs())) {
    urls.push({
      loc: `${BASE_URL}/news/${encodeURIComponent(slug)}`,
      changefreq: 'monthly',
      priority: 0.6,
    })
  }

  return urls
}

function generateSitemapXml() {
  const urls = buildUrls()
  const entries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries}
</urlset>
`
}

const sitemapXml = generateSitemapXml()
const publicDir = path.join(APP_DIR, 'public')
const sitemapPath = path.join(publicDir, 'sitemap.xml')

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8')
console.log(`✅ Sitemap generated at: ${sitemapPath}`)
console.log(
  `📝 Total URLs in sitemap: ${(sitemapXml.match(/<url>/g) || []).length}`
)
