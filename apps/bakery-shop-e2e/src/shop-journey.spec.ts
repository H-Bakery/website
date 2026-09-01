/**
 * @fileoverview Der echte Einkaufsweg: stöbern → filtern → suchen → Detail →
 * Warenkorb.
 *
 * Alles hier prüft die Oberfläche gegen die *gleichen* Daten, die der Shop
 * lädt (`GET /api/products`) — keine erfundenen Produktnamen, keine
 * hartkodierten Stückzahlen.
 */

import { expect, test } from '@playwright/test'

import {
  CATALOG_PAGE_SIZE,
  expectCartCount,
  clearCartStorage,
  fetchProducts,
  formatEuro,
  matchesQuery,
  priceOf,
  productCards,
  resultCount,
  storedCartItems,
  byName,
  type ApiProduct,
} from './support/shop'

let products: ApiProduct[]

test.beforeAll(async () => {
  products = await fetchProducts()
})

test.beforeEach(async ({ page }) => {
  await clearCartStorage(page)
})

test.describe('Startseite', () => {
  test('zeigt Suche, Kategorien mit Anzahl und eine Auslage', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('shop-header')).toBeVisible()
    await expect(page.getByTestId('home-search-input')).toBeVisible()
    await expectCartCount(page, 0)

    // Sieben Kategorien als Kacheln. Eingegrenzt auf den Kachelblock: die
    // Kopfzeile *und* die Themenreihen verlinken dieselben Kategorien.
    const tiles = page
      .getByTestId('category-tiles')
      .locator('a[href^="/products?category="]')
    await expect(tiles).toHaveCount(7)

    const brotCount = products.filter((p) => p.category === 'brot').length
    await expect(
      page
        .getByTestId('category-tiles')
        .locator('a[href="/products?category=brot"]')
    ).toContainText(`${brotCount} Sorten`)

    // Die Auslage zeigt eine kurze Reihe, nicht das ganze Sortiment.
    await expect(page.getByTestId('product-grid')).toBeVisible()
    const railCount = await productCards(page).count()
    expect(railCount).toBeGreaterThan(0)
    expect(railCount).toBeLessThanOrEqual(8)
  })

  test('führt vom Versprechen über die Themenreihen bis zum Abholweg', async ({
    page,
  }) => {
    await page.goto('/')

    // Die drei Zusagen, die vor dem ersten Klick beantwortet sein müssen.
    await expect(
      page.getByRole('heading', { name: 'Zahlung im Laden' })
    ).toBeVisible()

    // Themenreihen liegen neben der großen Auslage und haben eigene IDs,
    // damit `product-grid` genau einmal auf der Seite vorkommt.
    for (const testId of ['home-rail-breakfast', 'home-rail-coffee']) {
      const rail = page.getByTestId(testId)
      await expect(rail).toBeVisible()
      const count = await rail.getByTestId('product-card').count()
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(4)
    }

    await expect(
      page.getByRole('heading', { name: 'So kommen Sie an Ihre Tüte' })
    ).toBeVisible()
  })

  test('die Fotos der Startseite werden wirklich ausgeliefert', async ({
    page,
  }) => {
    await page.goto('/')

    // Schützt davor, dass eine Bilddatei beim Kopieren vergessen wurde: ein
    // 404 sieht im Layout wie eine leere Fläche aus, nicht wie ein Fehler.
    for (const fragment of ['fresh-bread-hero', 'theke']) {
      const image = page.locator(`img[src*="${fragment}"]`).first()
      await expect(image).toBeVisible()
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0)
    }
  })

  test('der Abholstatus nennt einen Termin, den die Kasse auch annimmt', async ({
    page,
  }) => {
    await page.goto('/')

    const status = page.getByTestId('pickup-status')
    await expect(status).toBeVisible()
    // Wird erst nach dem Mount gefüllt (Server- und Client-Uhr weichen ab).
    await expect(status).toContainText(/(Jetzt geöffnet|Gerade geschlossen)/)
    await expect(status).toContainText(
      /Nächste Abholung: .* ab \d{2}:\d{2} Uhr/
    )
  })

  test('eine fertige Tüte landet mit einem Klick vollständig im Warenkorb', async ({
    page,
  }) => {
    await page.goto('/')

    const bundles = page.getByTestId('bundle-card')
    await expect(bundles).toHaveCount(3)

    const first = bundles.first()
    await expect(first).toContainText('Frühstückstüte')

    // Die Mengen stehen auf der Karte – daraus ergibt sich der Zählerstand.
    const quantities = await first
      .locator('li')
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          Number((node.textContent ?? '').match(/^(\d+)×/)?.[1] ?? 0)
        )
      )
    const expected = quantities.reduce((sum, value) => sum + value, 0)
    expect(expected).toBeGreaterThan(0)

    await first.getByTestId('bundle-add').click()

    await expect(first).toContainText('Liegt im Warenkorb')
    await expectCartCount(page, expected)
  })

  test('zeigt Bewertungen im Wortlaut, ohne erfundene Kaufanreize', async ({
    page,
  }) => {
    await page.goto('/')

    const proof = page.getByTestId('social-proof')
    await expect(proof).toBeVisible()
    await expect(proof).toContainText('134')
    await expect(proof).toContainText('Familienbetrieb seit 1933')

    // Keine Dringlichkeit, für die es keine Daten gibt (§ 5 UWG).
    await expect(page.getByRole('main')).not.toContainText(
      /nur noch \d+|solange der Vorrat|statt \d+,\d{2}/i
    )
  })

  test('Suche auf der Startseite führt in den gefilterten Katalog', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByTestId('home-search-input').fill('Kornbrot')
    // Die Kopfzeile hat einen zweiten „Suchen“-Knopf – hier zählt der der Theke.
    await page.getByRole('main').getByRole('button', { name: 'Suchen' }).click()

    await expect(page).toHaveURL(/\/products\?q=Kornbrot/)
    const expected = products.filter((p) => matchesQuery(p, 'Kornbrot')).length
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${expected} Produkte?`)
    )
  })
})

test.describe('Katalog', () => {
  test('rendert das Sortiment und blättert seitenweise nach', async ({
    page,
  }) => {
    await page.goto('/products')

    await expect(page.getByTestId('product-grid')).toBeVisible()
    // Die Zählzeile nennt das ganze Sortiment (aktuell 103 Produkte).
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${products.length} Produkte`)
    )
    await expect(productCards(page)).toHaveCount(CATALOG_PAGE_SIZE)

    const first = productCards(page).first()
    await expect(first.getByTestId('product-card-name')).toHaveText(
      byName(products)[0].name
    )
    await expect(first.getByTestId('product-card-price')).toContainText(',')
    await expect(first.getByTestId('add-to-cart')).toBeVisible()

    await page.getByRole('button', { name: /Mehr anzeigen/ }).click()
    await expect(productCards(page)).toHaveCount(2 * CATALOG_PAGE_SIZE)
  })

  test('Kategoriefilter grenzt ein und schreibt die URL', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByTestId('category-filter')).toBeVisible()

    const brot = products.filter((p) => p.category === 'brot')
    await page.getByTestId('category-brot').click()

    await expect(page).toHaveURL(/[?&]category=brot/)
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${brot.length} Produkte`)
    )
    await expect(productCards(page)).toHaveCount(
      Math.min(brot.length, CATALOG_PAGE_SIZE)
    )

    // Zurück auf „Alle“ – der Filter verschwindet auch wieder aus der URL.
    await page.getByTestId('category-all').click()
    await expect(page).not.toHaveURL(/category=/)
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${products.length} Produkte`)
    )
  })

  test('?category=torten ist direkt verlinkbar', async ({ page }) => {
    const torten = products.filter((p) => p.category === 'torten')
    await page.goto('/products?category=torten')

    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${torten.length} Produkte`)
    )
    await expect(productCards(page)).toHaveCount(
      Math.min(torten.length, CATALOG_PAGE_SIZE)
    )
    await expect(page.getByTestId('category-torten')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('Suche findet ein bekanntes Produkt', async ({ page }) => {
    await page.goto('/products')

    const expected = products.filter((p) => matchesQuery(p, 'Kornbrot'))
    await page.getByTestId('catalog-search-input').fill('Kornbrot')

    await expect(productCards(page)).toHaveCount(expected.length)
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${expected.length} Produkte?`)
    )
    await expect(
      productCards(page).first().getByTestId('product-card-name')
    ).toContainText('Kornbrot')

    // Der Suchbegriff landet verzögert in der URL und ist damit teilbar.
    await expect(page).toHaveURL(/[?&]q=Kornbrot/)
  })

  test('Suche ohne Treffer behält das Suchfeld sichtbar', async ({ page }) => {
    await page.goto('/products')

    const search = page.getByTestId('catalog-search-input')
    await search.fill('zzzzzznichtsda')

    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    // Der eigentliche Regressionsschutz: aus einer erfolglosen Suche muss man
    // wieder herauskommen können.
    await expect(search).toBeVisible()
    await expect(search).toHaveValue('zzzzzznichtsda')
    await expect(page.getByTestId('category-filter')).toBeVisible()

    await page
      .getByTestId('catalog-empty')
      .getByRole('button', { name: 'Filter zurücksetzen' })
      .click()

    await expect(search).toHaveValue('')
    await expect(page.getByTestId('catalog-empty')).toBeHidden()
    await expect(resultCount(page)).toHaveText(
      new RegExp(`^${products.length} Produkte`)
    )
  })

  test('Sortierung ändert die Reihenfolge', async ({ page }) => {
    await page.goto('/products')

    const cheapest = Math.min(...products.map((p) => p.price))
    const dearest = Math.max(...products.map((p) => p.price))
    const firstPrice = productCards(page)
      .first()
      .getByTestId('product-card-price')

    // Preise nie als Regex vergleichen: Intl setzt ein geschütztes
    // Leerzeichen vor das €. Deshalb wird der Betrag ausgelesen.
    await page.getByRole('combobox', { name: 'Sortierung' }).click()
    await page.getByRole('option', { name: 'Preis aufsteigend' }).click()

    await expect(page).toHaveURL(/[?&]sort=price-asc/)
    await expect.poll(() => priceOf(firstPrice)).toBe(cheapest)

    await page.getByRole('combobox', { name: 'Sortierung' }).click()
    await page.getByRole('option', { name: 'Preis absteigend' }).click()

    await expect(page).toHaveURL(/[?&]sort=price-desc/)
    await expect.poll(() => priceOf(firstPrice)).toBe(dearest)
  })

  test('?sort=price-asc ist direkt verlinkbar', async ({ page }) => {
    await page.goto('/products?sort=price-asc')
    const cheapest = Math.min(...products.map((p) => p.price))
    await expect
      .poll(() =>
        priceOf(productCards(page).first().getByTestId('product-card-price'))
      )
      .toBe(cheapest)
  })
})

test.describe('Produktdetail', () => {
  test('Karte führt auf die Detailseite', async ({ page }) => {
    await page.goto('/products')

    const card = productCards(page).first()
    const name = (
      await card.getByTestId('product-card-name').innerText()
    ).trim()
    const price = await priceOf(card.getByTestId('product-card-price'))

    await card.getByTestId('product-card-name').click()

    await expect(page).toHaveURL(/\/products\/[^/?]+$/)
    await expect(page.getByTestId('product-detail')).toBeVisible()
    await expect(page.getByTestId('product-detail-name')).toHaveText(name)
    expect(await priceOf(page.getByTestId('product-detail-price'))).toBe(price)
  })

  test('Detailseite per Slug und per numerischer ID', async ({ page }) => {
    const product = products[0]

    await page.goto(`/products/${product.id}`)
    await expect(page.getByTestId('product-detail-name')).toHaveText(
      product.name
    )
    expect(await priceOf(page.getByTestId('product-detail-price'))).toBe(
      product.price
    )

    await page.goto(`/products/${product.numeric_id}`)
    await expect(page.getByTestId('product-detail')).toBeVisible()
    await expect(page.getByTestId('product-detail-name')).toHaveText(
      product.name
    )
  })

  test('unbekanntes Produkt zeigt einen ehrlichen Leerzustand', async ({
    page,
  }) => {
    await page.goto('/products/gibt-es-hier-nicht')
    await expect(page.getByTestId('product-not-found')).toBeVisible()
    await expect(page.getByTestId('product-detail')).toHaveCount(0)
  })

  test('Mengenwähler zählt hoch und runter, aber nie unter 1', async ({
    page,
  }) => {
    await page.goto(`/products/${products[0].id}`)

    const quantity = page.getByTestId('quantity-input')
    await expect(quantity).toHaveValue('1')
    await expect(page.getByTestId('quantity-decrease')).toBeDisabled()

    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('quantity-increase').click()
    await expect(quantity).toHaveValue('3')

    await page.getByTestId('quantity-decrease').click()
    await expect(quantity).toHaveValue('2')
    await page.getByTestId('quantity-decrease').click()
    await expect(quantity).toHaveValue('1')
    await expect(page.getByTestId('quantity-decrease')).toBeDisabled()
  })
})

test.describe('Warenkorb', () => {
  test('Legen von der Karte aktualisiert den Zähler', async ({ page }) => {
    await page.goto('/products')
    await expectCartCount(page, 0)

    await productCards(page).first().getByTestId('add-to-cart').click()
    await expectCartCount(page, 1)

    await productCards(page).nth(1).getByTestId('add-to-cart').click()
    await expectCartCount(page, 2)

    await page.getByTestId('cart-link').click()
    await expect(page.getByTestId('cart-page')).toBeVisible()
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
  })

  test('Legen von der Detailseite übernimmt die Menge', async ({ page }) => {
    await page.goto(`/products/${products[0].id}`)

    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('detail-add-to-cart').click()

    await expectCartCount(page, 3)
  })

  test('rechnet Zeilensumme und Gesamt, ändert und entfernt Positionen', async ({
    page,
  }) => {
    const product = products[0]
    await page.goto(`/products/${product.id}`)
    const unitPrice = await priceOf(page.getByTestId('product-detail-price'))

    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('detail-add-to-cart').click()
    await page.getByTestId('cart-link').click()

    const line = page.getByTestId('cart-item').first()
    await expect(line.getByTestId('cart-item-name')).toHaveText(product.name)
    // Die Menge ist ein Textknoten, kein Eingabefeld.
    await expect(line.getByTestId('cart-item-quantity')).toHaveText('3')
    // Zeilensumme = Menge × Einzelpreis.
    await expect(line).toContainText(formatEuro(unitPrice * 3))
    await expect
      .poll(() => priceOf(page.getByTestId('cart-total')))
      .toBeCloseTo(unitPrice * 3, 2)

    await line.getByTestId('cart-increase').click()
    await expect(line.getByTestId('cart-item-quantity')).toHaveText('4')
    await expect
      .poll(() => priceOf(page.getByTestId('cart-total')))
      .toBeCloseTo(unitPrice * 4, 2)

    await line.getByTestId('cart-decrease').click()
    await line.getByTestId('cart-decrease').click()
    await expect(line.getByTestId('cart-item-quantity')).toHaveText('2')
    await expect
      .poll(() => priceOf(page.getByTestId('cart-total')))
      .toBeCloseTo(unitPrice * 2, 2)
    await expectCartCount(page, 2)

    await line.getByTestId('cart-remove').click()
    await expect(page.getByTestId('cart-item')).toHaveCount(0)
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expectCartCount(page, 0)
    await expect(page.getByTestId('cart-checkout')).toBeDisabled()
  })

  test('überlebt einen Reload (localStorage)', async ({ page }) => {
    const product = products[0]
    await page.goto(`/products/${product.id}`)
    await page.getByTestId('quantity-increase').click()
    await page.getByTestId('detail-add-to-cart').click()
    await expectCartCount(page, 2)

    // Der CartProvider schreibt entprellt; erst warten, dann neu laden.
    await expect
      .poll(async () => (await storedCartItems(page)).length)
      .toBeGreaterThan(0)

    await page.reload()
    await expectCartCount(page, 2)

    await page.goto('/cart')
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expect(
      page.getByTestId('cart-item').first().getByTestId('cart-item-quantity')
    ).toHaveText('2')
    await expect(page.getByTestId('cart-item-name')).toHaveText(product.name)
  })

  test('leerer Warenkorb bietet den Weg zurück ins Sortiment', async ({
    page,
  }) => {
    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expect(page.getByTestId('cart-item')).toHaveCount(0)
    await expect(page.getByTestId('cart-checkout')).toBeDisabled()
  })
})

test.describe('Routen', () => {
  test('/bestellen leitet dauerhaft auf /kasse um', async ({ page }) => {
    const response = await page.goto('/bestellen')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/kasse$/)
    await expect(page.getByTestId('checkout-page')).toBeVisible()
  })
})
