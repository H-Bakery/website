import { PRODUCTS } from '../../mocks/products'

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number
}

const BASE_URL = 'https://xn--bckerei-heusser-0kb.de'

export function generateSitemapXml(): string {
  const currentDate = new Date().toISOString().split('T')[0]

  // Static pages
  const staticPages: SitemapUrl[] = [
    {
      loc: BASE_URL,
      changefreq: 'weekly',
      priority: 1.0,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/products`,
      changefreq: 'weekly',
      priority: 0.9,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/about`,
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/bestellen`,
      changefreq: 'weekly',
      priority: 0.9,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/news`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/imprint`,
      changefreq: 'yearly',
      priority: 0.3,
      lastmod: currentDate,
    },
  ]

  // News pages
  const newsPages: SitemapUrl[] = [
    {
      loc: `${BASE_URL}/news/aushilfe-gesucht`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/news/geaenderte-oeffnungszeiten`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/news/neue-abholstation`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/news/verkaufspartner-gesucht`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: currentDate,
    },
  ]

  // Product pages
  const productPages: SitemapUrl[] = PRODUCTS.map((product) => ({
    loc: `${BASE_URL}/products/${product.id}`,
    changefreq: 'weekly' as const,
    priority: 0.7,
    lastmod: currentDate,
  }))

  // Combine all URLs
  const allUrls = [...staticPages, ...newsPages, ...productPages]

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>${
      url.lastmod
        ? `
    <lastmod>${url.lastmod}</lastmod>`
        : ''
    }${
      url.changefreq
        ? `
    <changefreq>${url.changefreq}</changefreq>`
        : ''
    }${
      url.priority !== undefined
        ? `
    <priority>${url.priority}</priority>`
        : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>`

  return xml
}

// Function to save sitemap to file (for build process)
export async function saveSitemapToFile(): Promise<void> {
  if (typeof window !== 'undefined') {
    console.warn(
      'saveSitemapToFile should only be called in Node.js environment'
    )
    return
  }

  const fs = await import('fs')
  const path = await import('path')

  const sitemapXml = generateSitemapXml()
  const publicDir = path.join(process.cwd(), 'public')
  const sitemapPath = path.join(publicDir, 'sitemap.xml')

  fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8')
  console.log(`Sitemap generated at: ${sitemapPath}`)
}
