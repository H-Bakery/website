/**
 * @fileoverview Der Shop am Telefon (Pixel 5, 393 px).
 *
 * Läuft im Playwright-Projekt `mobile` — ein echtes Mobilgerät-Profil mit
 * Touch, nicht bloß ein schmales Desktop-Fenster.
 */

import { expect, test, type Page } from '@playwright/test'

import {
  expectCartCount,
  clearCartStorage,
  fetchProducts,
  productCards,
  type ApiProduct,
} from './support/shop'

let products: ApiProduct[]

test.beforeAll(async () => {
  products = await fetchProducts()
})

test.beforeEach(async ({ page }) => {
  await clearCartStorage(page)
})

/** Breite der Seite gegen die Breite des Fensters — kein Querscrollen. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth - root.clientWidth
  })
}

test.describe('Shop am Telefon', () => {
  test('läuft im Mobilprofil mit Touch', async ({ page, isMobile }) => {
    expect(isMobile).toBe(true)
    await page.goto('/')
    expect(page.viewportSize()?.width).toBeLessThanOrEqual(400)
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true)
  })

  test('Kopfzeile: Marke, Suche und Warenkorb sind erreichbar', async ({
    page,
  }) => {
    await page.goto('/products')

    const header = page.getByTestId('shop-header')
    await expect(header).toBeVisible()
    await expect(page.getByTestId('shop-search')).toBeVisible()
    await expect(page.getByTestId('shop-search-input')).toBeVisible()
    await expect(page.getByTestId('cart-link')).toBeVisible()
    await expectCartCount(page, 0)

    // Kein Element der Kopfzeile ragt aus dem Fenster.
    const viewport = page.viewportSize()?.width ?? 0
    const box = await header.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport + 1)

    // Die Suche der Kopfzeile führt in den gefilterten Katalog.
    await page.getByTestId('shop-search-input').fill('Kornbrot')
    await page.getByTestId('shop-search-input').press('Enter')
    await expect(page).toHaveURL(/\/products\?q=Kornbrot/)
    await expect(
      productCards(page).first().getByTestId('product-card-name')
    ).toContainText('Kornbrot')
  })

  test('Kategorieleiste scrollt seitlich statt zu stapeln', async ({
    page,
  }) => {
    await page.goto('/')

    const nav = page.getByTestId('shop-category-nav')
    await expect(nav).toBeVisible()

    const metrics = await nav.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      overflowX: getComputedStyle(element).overflowX,
    }))

    // Acht Links passen nicht in 393 px: sie müssen scrollen …
    expect(metrics.overflowX).toBe('auto')
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
    // … und dabei eine einzige Zeile bleiben, nicht acht übereinander.
    expect(metrics.clientHeight).toBeLessThan(64)

    const scrolled = await nav.evaluate((element) => {
      element.scrollLeft = 200
      return element.scrollLeft
    })
    expect(scrolled).toBeGreaterThan(0)
  })

  test('Produktraster zeigt zwei Spalten', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByTestId('product-grid')).toBeVisible()

    const columns = await page
      .getByTestId('product-grid')
      .evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/)
      )
    expect(columns).toHaveLength(2)

    // Beide Spalten sind gleich breit und passen nebeneinander ins Fenster.
    const [left, right] = columns.map((value) => Number.parseFloat(value))
    expect(left).toBeCloseTo(right, 0)
    expect(left * 2).toBeLessThan(page.viewportSize()?.width ?? 0)
  })

  test.describe('kein waagerechtes Überlaufen', () => {
    for (const path of [
      '/',
      '/products',
      '/products?category=torten',
      '/cart',
      '/kasse',
    ]) {
      test(`auf ${path}`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByTestId('shop-header')).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
      })
    }

    test('auf der Produktdetailseite', async ({ page }) => {
      await page.goto(`/products/${products[0].id}`)
      await expect(page.getByTestId('product-detail')).toBeVisible()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
  })

  test('In den Warenkorb legen funktioniert per Touch', async ({ page }) => {
    await page.goto('/products')

    const card = productCards(page).nth(1)
    const button = card.getByTestId('add-to-cart')
    // Mittig ins Bild scrollen, damit die klebende Kopfzeile nicht im Weg ist.
    await button.evaluate((element) =>
      element.scrollIntoView({ block: 'center' })
    )
    await button.tap()

    await expectCartCount(page, 1)
    await expect(button).toContainText('Hinzugefügt')

    await page.getByTestId('cart-link').tap()
    await expect(page.getByTestId('cart-page')).toBeVisible()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(
      page.getByTestId('cart-item').first().getByTestId('cart-item-quantity')
    ).toHaveText('1')
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
})
