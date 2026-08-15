#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Import the products data
const { PRODUCTS } = require('../src/mocks/products')

const BASE_URL = 'https://xn--bckerei-heusser-0kb.de'

function generateSitemapXml() {
  const currentDate = new Date().toISOString().split('T')[0]

  // Static pages
  const staticPages = [
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
    {
      loc: `${BASE_URL}/datenschutz`,
      changefreq: 'yearly',
      priority: 0.3,
      lastmod: currentDate,
    },
    {
      loc: `${BASE_URL}/contact`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: currentDate,
    },
  ]

  // News pages
  const newsPages = [
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
  const productPages = PRODUCTS.map((product) => ({
    loc: `${BASE_URL}/products/${product.id}`,
    changefreq: 'weekly',
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

// Generate and save sitemap
const sitemapXml = generateSitemapXml()
const publicDir = path.join(__dirname, '..', 'public')
const sitemapPath = path.join(publicDir, 'sitemap.xml')

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8')
console.log(`✅ Sitemap generated successfully at: ${sitemapPath}`)
console.log(`📝 Total URLs in sitemap: ${sitemapXml.match(/<url>/g).length}`)
