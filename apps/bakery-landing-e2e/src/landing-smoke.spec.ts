/**
 * @fileoverview Die Landing, wie sie wirklich ausgeliefert wird.
 *
 * In CI läuft diese Suite gegen den statischen Export in
 * `apps/bakery-landing/out/` - dieselben Dateien, die nach GitHub Pages gehen.
 * Der Export hat kein `hq` und keine API: die Produkte kommen aus dem
 * gebündelten Fallback (`src/mocks/products`), genau wie auf der Live-Seite.
 * Deshalb steht hier keine feste Produktzahl; geprüft wird, dass die Seite
 * zeigt, was ihre Daten hergeben, und dass jede Karte auf eine existierende
 * Detailseite führt.
 */

import { expect, test, type Page } from '@playwright/test'

/** Alle Produktkarten des Sortiments (jede Karte ist ein Link zur Detailseite). */
function productCards(page: Page) {
  return page
    .getByRole('region', { name: 'Produkt Liste' })
    .locator('a[href^="/products/"]')
}

test.describe('Startseite', () => {
  test('lädt mit Titel, Überschrift und SEO-Tags', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Bäckerei Heusser/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Bäckerei Heusser'
    )

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Backwaren|Bäckerei/
    )
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Bäckerei Heusser/
    )
    // Strukturierte Daten (LocalBusiness usw.) sind Teil des Exports.
    expect(
      await page.locator('script[type="application/ld+json"]').count()
    ).toBeGreaterThan(0)
  })

  test('Kopfzeile führt zu Sortiment, Neuigkeiten, Über uns und Bestellen', async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      'Auf dem Handy steckt die Navigation im Menü - eigener Test.'
    )
    await page.goto('/')

    for (const [label, path, heading] of [
      ['Sortiment', '/products', 'Unser Sortiment'],
      ['Neuigkeiten', '/news', 'Neuigkeiten'],
      ['Über uns', '/about', 'Über uns'],
      ['Bestellen', '/bestellen', 'Bestellen'],
    ] as const) {
      await page.getByRole('link', { name: label, exact: true }).first().click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        heading
      )
    }

    // Das Logo führt zurück auf die Startseite.
    await page
      .getByRole('link', { name: 'Bäckerei Heusser – Startseite' })
      .click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('mobiles Menü öffnet und navigiert', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Nur im Mobilprofil sichtbar.')
    await page.goto('/')

    await page.getByRole('button', { name: 'Menü öffnen' }).click()
    const menu = page.getByLabel('Mobiles Menü')
    await expect(menu).toBeVisible()

    await menu.getByRole('link', { name: 'Über uns' }).click()
    await expect(page).toHaveURL(/\/about$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Über uns'
    )
    await expect(menu).toBeHidden()
  })
})

test.describe('Sortiment', () => {
  test('zeigt Produkte, filtert nach Kategorie und öffnet ein Produkt', async ({
    page,
  }) => {
    await page.goto('/products')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Unser Sortiment'
    )

    // Ohne Daten wäre die Seite "fertig", aber leer - genau das darf hier
    // nicht als Erfolg durchgehen.
    expect(await productCards(page).count()).toBeGreaterThan(0)

    // Kategoriefilter: danach trägt jede sichtbare Karte den Chip „Brot“.
    // Die Filterleiste steht im DOM vor den Karten (die denselben Text als
    // Chip tragen), deshalb `first()`.
    await page.getByText('Brot', { exact: true }).first().click()
    const brotChip = page.locator('.MuiChip-label', { hasText: /^Brot$/ })
    await expect(
      productCards(page).first().locator('.MuiChip-label')
    ).toContainText('Brot')
    expect(await productCards(page).count()).toBeGreaterThan(0)
    await expect(productCards(page).filter({ hasNot: brotChip })).toHaveCount(0)

    // Die Karte führt auf die Detailseite mit demselben Namen.
    const first = productCards(page).first()
    const name = (await first.getByRole('heading').first().innerText()).trim()
    await first.click()
    await expect(page).toHaveURL(/\/products\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  })

  test('Suche grenzt die Liste ein und lässt sich zurücksetzen', async ({
    page,
  }) => {
    await page.goto('/products')
    const first = productCards(page).first()
    await expect(first).toBeVisible()
    const name = (await first.getByRole('heading').first().innerText()).trim()

    // Datengetrieben: der Name der ersten Karte muss sich selbst finden -
    // und nichts anderes bleiben.
    const search = page.getByLabel('Produkte suchen')
    await search.fill(name)
    await expect(productCards(page).first()).toContainText(name)
    await expect(productCards(page).filter({ hasNotText: name })).toHaveCount(0)

    await search.fill('zzzz-gibt-es-nicht')
    await expect(page.getByText('Keine Produkte gefunden')).toBeVisible()
    await page.getByRole('button', { name: 'Suche zurücksetzen' }).click()
    await expect(search).toHaveValue('')
    expect(await productCards(page).count()).toBeGreaterThan(0)
  })
})

test.describe('Seiten', () => {
  test('Kontakt nennt Öffnungszeiten', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Kontakt'
    )
    const main = page.getByRole('main')
    await expect(main).toContainText('Öffnungszeiten')
    await expect(main).toContainText('Montag')
    await expect(main).toContainText('Samstag')
  })

  test('unbekannte Adresse liefert die 404-Seite mit Weg zurück', async ({
    page,
  }) => {
    const response = await page.goto('/diese-seite-gibt-es-nicht')
    // Der statische Export antwortet mit 404.html *und* Status 404 - so wie
    // GitHub Pages. Der Dev-Server tut dasselbe.
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Seite nicht gefunden'
    )

    await page.getByRole('link', { name: 'Zur Startseite' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
