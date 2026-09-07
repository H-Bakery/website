/**
 * @fileoverview Die Verwaltung, wie sie gebaut ist.
 *
 * Läuft gegen den Build in `dist/apps/bakery-management` (CI) oder den
 * Dev-Server, jeweils mit der Mock-API (`simple-server.js`). Produkte liest
 * die App beim Bauen aus `HQ_PRODUCTS_DIR` - in CI das synthetische Fixture
 * unter `tools/e2e/hq-products`, das auch die Mock-API bekommt. Deshalb
 * vergleicht die Suite Zahlen der Oberfläche mit dem, was die API liefert,
 * statt Werte fest zu verdrahten.
 *
 * Es gibt keinen Login: die App kennt keine Anmeldung, `/admin` ist offen.
 * Nichts hier speichert - `PUT /api/hq-products/:id` schriebe in die
 * Produktdateien, in CI also ins Fixture.
 */

import { expect, test, request as playwrightRequest } from '@playwright/test'

const API_BASE = process.env['API_URL'] || 'http://localhost:5000'

/** Anzahl der Einträge, die `GET <pfad>` der Mock-API liefert. */
async function apiCount(path: string): Promise<number> {
  const context = await playwrightRequest.newContext()
  try {
    const response = await context.get(`${API_BASE}${path}`)
    expect(response.ok(), `GET ${path} muss 2xx antworten`).toBeTruthy()
    const body = await response.json()
    const list = Array.isArray(body) ? body : body.data
    expect(Array.isArray(list)).toBe(true)
    return list.length
  } finally {
    await context.dispose()
  }
}

test.describe('Dashboard', () => {
  test('meldet die API als erreichbar und zählt das Sortiment', async ({
    page,
  }) => {
    const productCount = await apiCount('/api/products')
    expect(productCount).toBeGreaterThan(0)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Dashboard'
    )

    // Erst „wird geprüft …“, dann das Urteil - ohne API wäre es „nicht
    // erreichbar“, und die Zahlen darunter blieben 0.
    await expect(
      page.getByText('API erreichbar', { exact: true })
    ).toBeVisible()

    const productsCard = page
      .locator('.MuiPaper-root')
      .filter({ hasText: 'Produkte gesamt' })
      .first()
    await expect(productsCard).toContainText(String(productCount))
  })

  test('Schnellzugriff führt in die Produktverwaltung', async ({ page }) => {
    await page.goto('/admin')
    await page
      .getByRole('heading', { name: 'Produkte', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/admin\/products$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Produktverwaltung'
    )
  })
})

test.describe('Produkte', () => {
  test('Liste zeigt jedes Produkt aus hq und öffnet die Bearbeitung', async ({
    page,
  }) => {
    const productCount = await apiCount('/api/products')

    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Produktverwaltung'
    )
    // Die Liste kommt aus dem Markdown-Verzeichnis, die API liest dasselbe
    // Verzeichnis - beide müssen dieselbe Zahl nennen. Ohne Verzeichnis
    // stünde hier „Keine Produkte gefunden.“ und die Zahl wäre 0.
    await expect(page.getByText(`Produktliste (${productCount})`)).toBeVisible()
    await expect(page.getByText('Keine Produkte gefunden.')).toHaveCount(0)

    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(productCount)

    const firstName = (await rows.first().locator('td').first().innerText())
      .split('\n')[0]
      .trim()
    await rows
      .first()
      .getByRole('button', { name: `${firstName} bearbeiten` })
      .click()

    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/)
    await expect(page.getByLabel('Produktname')).toHaveValue(firstName)
    await expect(page.getByLabel('Preis (EUR)')).not.toHaveValue('')
  })

  test('unbekanntes Produkt endet nicht in einem leeren Formular', async ({
    page,
  }) => {
    await page.goto('/admin/products/gibt-es-nicht')
    await expect(page.getByLabel('Produktname')).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText(/nicht gefunden/i)
  })
})

test.describe('Bestellungen', () => {
  test('Liste zeigt die Bestellungen der API und filtert nach Status', async ({
    page,
  }) => {
    const orderCount = await apiCount('/api/orders')
    expect(orderCount).toBeGreaterThan(0)

    await page.goto('/admin/orders')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Bestellungen'
    )
    await expect(
      page.getByRole('status', { name: 'Bestellungen werden geladen' })
    ).toBeHidden()

    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(orderCount)

    // Der Filter nimmt Zeilen weg, aber die Seite bleibt bedienbar.
    const completed = await apiCount('/api/orders?status=completed')
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Abgeschlossen' }).click()
    if (completed > 0) {
      await expect(rows).toHaveCount(completed)
    } else {
      await expect(
        page.getByText('Keine Bestellungen mit diesem Status.')
      ).toBeVisible()
    }
  })
})
