/**
 * @fileoverview Bedienung des Sortiments: Kategorie per Tastatur, Seitenwechsel
 * auf dem Handy, Suche aus der Adresse und „Zurück“ von einer Produktseite.
 *
 * Der statische CI-Export und der lokale Testserver verwenden den synthetischen
 * Katalog `tools/e2e/hq-products`. Die Tests sind datengetrieben:
 * Namen und Seitenzahlen kommen aus der Seite, nicht aus dem Test.
 */

import { expect, test, type Page } from '@playwright/test'

/** Alle Produktkarten des Sortiments (jede Karte ist ein Link zur Detailseite). */
function productCards(page: Page) {
  return page
    .getByRole('region', { name: 'Produkt Liste' })
    .locator('a[href^="/products/"]')
}

function categoryButton(page: Page, name: string) {
  return page
    .getByRole('group', { name: 'Kategorie' })
    .getByRole('button', { name, exact: true })
}

async function cardName(page: Page, index = 0) {
  const card = productCards(page).nth(index)
  return (await card.getByRole('heading').first().innerText()).trim()
}

/**
 * Öffnet das Sortiment und wartet, bis React die Kacheln übernommen hat: Das
 * HTML des Exports steht vorher schon da, ein Klick davor ginge ins Leere.
 * React hängt bei der Hydrierung `__reactProps…` an die DOM-Knoten.
 */
async function openSortiment(page: Page, query = '') {
  await page.goto(`/products${query}`)
  await expect(productCards(page).first()).toBeVisible()
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="Kategorie"] button')
    return (
      button !== null &&
      Object.keys(button).some((key) => key.startsWith('__reactProps'))
    )
  })
}

test.describe('Sortiment-Bedienung', () => {
  test('Kategorien sind per Tab erreichbar und mit der Tastatur wählbar', async ({
    page,
  }) => {
    await openSortiment(page)

    // Vom Element vor der Kategorieleiste (Seitenpfad „Startseite“) aus.
    await page
      .getByRole('navigation', { name: 'Seitenpfad' })
      .getByRole('link', { name: 'Startseite' })
      .focus()
    await page.keyboard.press('Tab')
    await expect(categoryButton(page, 'Alle')).toBeFocused()
    await expect(categoryButton(page, 'Alle')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.keyboard.press('Tab')
    await expect(categoryButton(page, 'Brot')).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(categoryButton(page, 'Brot')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(categoryButton(page, 'Alle')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    const brotChip = page.locator('.MuiChip-label', { hasText: /^Brot$/ })
    await expect(productCards(page).filter({ hasNot: brotChip })).toHaveCount(0)

    // Nach den acht Kacheln kommt das Suchfeld.
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
    await expect(categoryButton(page, 'Torten')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Produkte suchen')).toBeFocused()
  })

  test('nach dem Klick auf Seite 2 ist die erste neue Karte zu sehen', async ({
    page,
    isMobile,
  }) => {
    await openSortiment(page)
    const pagination = page.getByRole('navigation', {
      name: 'Produkt-Seitennavigation',
    })
    // Auf dem Handy die schmale Variante (ohne erste/letzte Seite), damit die
    // Seitennavigation in eine Zeile passt - erst nach der Hydrierung.
    await expect(
      pagination.getByRole('button', { name: 'Zur ersten Seite' })
    ).toHaveCount(isMobile ? 0 : 1)
    const page2 = pagination.getByRole('button', { name: 'Seite 2' })
    await page2.scrollIntoViewIfNeeded()
    await page2.click()

    await expect(
      pagination.getByRole('button', { name: 'Seite 2, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
    await expect(page).toHaveURL(/[?&]seite=2(&|$)/)
    await expect(productCards(page).first()).toBeInViewport()
    // Der Fokus steht auf der Überschrift der Liste, nicht mehr unten.
    await expect(
      page
        .getByRole('region', { name: 'Produkt Liste' })
        .getByRole('heading', { level: 2 })
    ).toBeFocused()
  })

  test.describe('schmales Handy (360 px)', () => {
    test.use({ viewport: { width: 360, height: 780 } })

    test('die Seitennavigation passt in eine Zeile', async ({ page }) => {
      await openSortiment(page)
      const pagination = page.getByRole('navigation', {
        name: 'Produkt-Seitennavigation',
      })
      // Schmale Variante (erst nach der Hydrierung): ohne erste/letzte Seite.
      await expect(
        pagination.getByRole('button', { name: 'Zur ersten Seite' })
      ).toHaveCount(0)

      const tops = await pagination
        .locator('li')
        .evaluateAll((items) =>
          items.map((li) => Math.round(li.getBoundingClientRect().top))
        )
      expect(tops.length).toBeGreaterThan(1)
      expect(new Set(tops).size).toBe(1)
    })
  })

  test('/products?search=… füllt das Suchfeld und filtert', async ({
    page,
  }) => {
    await openSortiment(page)
    const name = await cardName(page)

    await openSortiment(page, `?search=${encodeURIComponent(name)}`)

    await expect(page.getByLabel('Produkte suchen')).toHaveValue(name)
    await expect(productCards(page).first()).toContainText(name)
    await expect(productCards(page).filter({ hasNotText: name })).toHaveCount(0)
  })

  test('„Zurück“ von einer Produktseite stellt Kategorie und Seite wieder her', async ({
    page,
  }) => {
    await openSortiment(page)

    await categoryButton(page, 'Brot').click()
    await expect(categoryButton(page, 'Brot')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const pagination = page.getByRole('navigation', {
      name: 'Produkt-Seitennavigation',
    })
    await pagination.getByRole('button', { name: 'Seite 2' }).click()
    await expect(page).toHaveURL(/kategorie=Brot&seite=2$/)
    const name = await cardName(page)

    await productCards(page).first().click()
    await expect(page).toHaveURL(/\/products\/[^/?]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)

    await page.goBack()

    await expect(page).toHaveURL(/kategorie=Brot&seite=2$/)
    await expect(categoryButton(page, 'Brot')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(
      pagination.getByRole('button', { name: 'Seite 2, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
    await expect(productCards(page).first()).toContainText(name)
  })
})
