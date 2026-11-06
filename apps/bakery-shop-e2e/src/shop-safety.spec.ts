import { expect, test } from '@playwright/test'

import { API_BASE, fetchProducts, nextOpenDate } from './support/shop'

/**
 * Die drei Zusagen, die nicht still kaputtgehen dürfen.
 *
 * Anders als der Rest der Suite prüft diese Datei keine Bedienung, sondern
 * Eigenschaften, deren Verlust niemand beim Klicken bemerken würde:
 * Allergenangaben, die Vorbestellfrist und die Nicht-Aufzählbarkeit fremder
 * Bestellungen. Bricht hier etwas, ist es entweder ein Rechts- oder ein
 * Sicherheitsproblem — nie bloß ein Schönheitsfehler.
 */

/** Wörter, die der Shop über Allergene niemals sagen darf. */
const ABSENCE_CLAIM =
  /frei von|glutenfrei|laktosefrei|allergenfrei|nussfrei|ohne Gluten|enthält kein/i

test.describe('Allergene', () => {
  test('deklariertes Produkt nennt die Allergene und die Herkunft der Angabe', async ({
    page,
  }) => {
    await page.goto('/products/kornbrot-500g')

    const block = page.getByTestId('product-allergens')
    await expect(block).toBeVisible()

    // Aus dem echten Rezept abgeleitet: Roggenmehl, Weizenmehl, Sesam.
    await expect(block).toContainText('Gluten')
    await expect(block).toContainText('Weizen')
    await expect(block).toContainText('Sesam')

    // Die Angabe muss ihre Herkunft mitführen, sonst ist sie nicht prüfbar.
    await expect(block).toContainText(/Rezept/i)
  })

  test('undeklariertes Produkt sagt das ehrlich und nennt den Telefonweg', async ({
    page,
  }) => {
    // Für Torten gibt es kein Rezept in hq — hier darf nichts geraten werden.
    await page.goto('/products/schwarzwaelder-kirsch-torte')

    const unknown = page.getByTestId('product-allergens-unknown')
    await expect(unknown).toBeVisible()
    await expect(unknown).toContainText('06841 2229')

    // Und ganz sicher keine Liste, die nach einer Zusage aussieht.
    await expect(page.getByTestId('product-allergen-list')).toHaveCount(0)
  })

  test('keine Produktseite behauptet jemals Freiheit von Allergenen', async ({
    page,
  }) => {
    const products = await fetchProducts()
    const declared = products.filter((p) => Array.isArray(p['allergens']))
    const undeclared = products.filter((p) => !Array.isArray(p['allergens']))

    expect(declared.length).toBeGreaterThan(0)
    expect(undeclared.length).toBeGreaterThan(0)

    // Je eine Stichprobe aus beiden Gruppen — die Aussage muss für beide gelten.
    for (const product of [declared[0], undeclared[0]]) {
      await page.goto(`/products/${product.id}`)
      const text = (await page.getByTestId('product-detail').innerText()) ?? ''
      expect(text).not.toMatch(ABSENCE_CLAIM)
    }
  })
})

test.describe('Vorbestellfrist', () => {
  test('eine ganze Torte weist vor dem Kauf auf die Frist hin', async ({
    page,
  }) => {
    await page.goto('/products/schwarzwaelder-kirsch-torte')
    await expect(page.getByTestId('product-lead-time')).toBeVisible()
    await expect(page.getByTestId('product-lead-time')).toContainText(
      /zwei Tage/i
    )
  })

  test('ein einzelnes Stück aus der Theke braucht keine Frist', async ({
    page,
  }) => {
    // Derselbe Kuchen, andere Darreichung: das Stück liegt in der Theke.
    await page.goto('/products/kaesekuchen-1-stueck')
    await expect(page.getByTestId('product-detail')).toBeVisible()
    await expect(page.getByTestId('product-lead-time')).toHaveCount(0)
  })
})

test.describe('Bestellungen bleiben hinter der Anmeldung', () => {
  // B12: Die echte API hat keinen öffentlichen Bestellweg (Owner-Entscheidung
  // offen, siehe stubOrderEndpoint in support/shop.ts). Früher gab der
  // Mock-Server unter /api/orders/1 Name und Telefonnummer fremder Kundschaft
  // heraus - ohne Sitzung darf hier nichts davon ankommen.
  test('fremde Bestellungen lassen sich ohne Sitzung nicht lesen', async ({
    request,
  }) => {
    for (const id of ['1', '2', '3', '10', 'LA-2026-01-01-01']) {
      const response = await request.get(`${API_BASE}/api/orders/${id}`)
      expect(response.status()).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('unauthorized')
      expect(typeof body.message).toBe('string')
      expect(JSON.stringify(body)).not.toMatch(/customer|phone|telefon/i)
    }
  })

  test('ohne Sitzung nimmt die API keine Bestellung an', async ({
    request,
  }) => {
    const response = await request.post(`${API_BASE}/api/orders`, {
      data: {
        customerName: 'E2E Prüfung',
        phone: '06841 000000',
        pickupDate: nextOpenDate(),
        pickupTime: '08:00',
        items: [{ productId: 'kornbrot-500g', quantity: 1 }],
        total: 2.5,
      },
    })
    expect(response.status()).toBe(401)
    expect((await response.json()).error).toBe('unauthorized')
  })

  test('der Katalog ist ohne Sitzung lesbar, sonst nichts', async ({
    request,
  }) => {
    expect((await request.get(`${API_BASE}/api/products`)).status()).toBe(200)
    for (const path of [
      '/api/hq-products',
      '/api/preorders',
      '/api/partners',
    ]) {
      expect((await request.get(`${API_BASE}${path}`)).status()).toBe(401)
    }
  })
})
