/**
 * Metadaten der Startseite und des Sortiments, dazu die Auswahl der Produkte,
 * die beide zeigen - gegen einen erfundenen hq-Katalog im Temp-Ordner.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import React from 'react'
import HomePage, { metadata as homeMetadata } from './page'
import ProductsPage, { metadata as productsMetadata } from './products/page'
import FeaturedProducts from '../components/home/FeaturedProducts'
import { SITE_URL } from '../config/legal'
import type { Product } from '../types/product'

type OpenGraphFields = {
  url?: string
  siteName?: string
  locale?: string
  images?: Array<{ url: string; width?: number; height?: number }>
}

describe.each([
  ['Startseite', homeMetadata, SITE_URL],
  ['Sortiment', productsMetadata, `${SITE_URL}/products`],
])('openGraph – %s', (_name, metadata, url) => {
  // Next übernimmt openGraph einer Seite als Ganzes: ohne diese Felder fehlten
  // Vorschaubild, Seitenname und Sprache aus dem Layout.
  const og = metadata.openGraph as OpenGraphFields

  it('hat das allgemeine Vorschaubild', () => {
    expect(og.images?.[0].url).toMatch(/\/og-image\.jpg$/)
    expect(og.images?.[0]).toMatchObject({ width: 1200, height: 630 })
  })

  it('hat Seitenname, Sprache und die eigene URL', () => {
    expect(og.siteName).toBe('Bäckerei Heusser')
    expect(og.locale).toBe('de_DE')
    expect(og.url).toBe(url)
  })
})

describe('angezeigte Produkte (available: false bleibt draußen)', () => {
  let tmp: string
  const env = { ...process.env }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-home-'))
    const md = (n: number, id: string, category: string, available: boolean) =>
      `---\nid: ${id}\nnumeric_id: ${n}\nname: ${id}\ncategory: ${category}\nprice: 1.5\navailable: ${available}\n---\n`
    fs.writeFileSync(
      path.join(tmp, '1-probebrot-alt.md'),
      md(1, 'probebrot-alt', 'brot', false)
    )
    fs.writeFileSync(
      path.join(tmp, '2-testbrot.md'),
      md(2, 'testbrot', 'brot', true)
    )
    fs.writeFileSync(
      path.join(tmp, '3-testbroetchen.md'),
      md(3, 'testbroetchen', 'broetchen', true)
    )
    fs.writeFileSync(
      path.join(tmp, '4-musterbrot.md'),
      md(4, 'musterbrot', 'brot', true)
    )
    process.env.HQ_PRODUCTS_DIR = tmp
    process.env.LANDING_PRODUKTBILDER_INDEX = path.join(tmp, 'index.json')
  })
  afterEach(() => {
    process.env = { ...env }
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('Startseite: je Kategorie das erste angebotene, dazu eins extra', () => {
    const page = HomePage() as React.ReactElement<{
      children: React.ReactNode
    }>
    const featured = React.Children.toArray(page.props.children).find(
      (child): child is React.ReactElement<{ products: Product[] }> =>
        React.isValidElement(child) && child.type === FeaturedProducts
    )

    expect(featured?.props.products.map((p) => p.id)).toEqual([2, 3, 4])
  })

  it('Sortiment: Liste und Suche bekommen nur angebotene Produkte', () => {
    const page = ProductsPage() as React.ReactElement<{
      initialProducts: Product[]
    }>

    expect(page.props.initialProducts.map((p) => p.id)).toEqual([2, 3, 4])
  })
})
