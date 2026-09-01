/**
 * @fileoverview Die Kasse — Leerlauf-Schutz, Validierung, echte Bestellung und
 * der Fehlerfall.
 *
 * Wichtigster Test hier: schlägt `POST /api/orders` fehl, muss der Warenkorb
 * *erhalten bleiben*. Ein Kunde darf seinen Korb nicht verlieren, nur weil der
 * Server hustet.
 */

import { expect, test, type Page } from '@playwright/test'

import {
  SAFE_PICKUP_TIME,
  expectCartCount,
  clearCartStorage,
  fetchProducts,
  fieldError,
  formatEuro,
  nextMonday,
  nextOpenDate,
  pastDate,
  priceOf,
  seedCart,
  storedCartItems,
  type ApiProduct,
} from './support/shop'

let products: ApiProduct[]

/** Was der Server im Fehlerfall zurückmeldet — muss beim Kunden ankommen. */
const SERVER_MESSAGE =
  'Die Bestellung konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.'

test.beforeAll(async () => {
  products = await fetchProducts()
})

/** Zwei echte Produkte im Korb — Menge 2 und 1. */
async function seedTwoLines(page: Page) {
  const [first, second] = products
  await seedCart(page, [
    {
      id: first.numeric_id,
      slug: first.id,
      name: first.name,
      price: first.price,
      quantity: 2,
    },
    {
      id: second.numeric_id,
      slug: second.id,
      name: second.name,
      price: second.price,
      quantity: 1,
    },
  ])
  return { first, second }
}

/** Füllt das Formular vollständig gültig aus; einzelne Felder überschreibbar. */
async function fillCheckout(
  page: Page,
  overrides: Partial<{
    name: string
    phone: string
    email: string
    date: string
    time: string
    notes: string
  }> = {}
) {
  const values = {
    name: 'Erika Mustermann',
    phone: '06841 123456',
    email: 'erika@beispiel.de',
    date: nextOpenDate(),
    time: SAFE_PICKUP_TIME,
    notes: '',
    ...overrides,
  }

  await page.getByTestId('customer-name').fill(values.name)
  await page.getByTestId('customer-phone').fill(values.phone)
  await page.getByTestId('customer-email').fill(values.email)
  await page.getByTestId('pickup-date').fill(values.date)
  if (values.time) {
    await page.getByTestId('pickup-time').selectOption(values.time)
  }
  if (values.notes) {
    await page.getByTestId('order-notes').fill(values.notes)
  }
  return values
}

test.describe('Kasse — Zugang', () => {
  test('leerer Warenkorb: kein Bestellformular, nur der Weg zurück', async ({
    page,
  }) => {
    await clearCartStorage(page)
    await page.goto('/kasse')

    await expect(page.getByTestId('checkout-page')).toBeVisible()
    await expect(page.getByText('Ihr Warenkorb ist leer')).toBeVisible()
    await expect(page.getByTestId('submit-order')).toHaveCount(0)
    await expect(page.getByTestId('customer-name')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Weiter einkaufen' })
    ).toBeVisible()
  })

  test('gefüllter Warenkorb: Formular und Bestellübersicht stehen', async ({
    page,
  }) => {
    const { first, second } = await seedTwoLines(page)
    await page.goto('/kasse')

    await expect(page.getByTestId('submit-order')).toBeVisible()
    await expect(page.getByTestId('checkout-page')).toContainText(first.name)
    await expect(page.getByTestId('checkout-page')).toContainText(second.name)
    await expect(page.getByTestId('checkout-page')).toContainText(
      formatEuro(first.price * 2 + second.price)
    )
    await expectCartCount(page, 3)
  })
})

test.describe('Kasse — Validierung', () => {
  test.beforeEach(async ({ page }) => {
    await seedTwoLines(page)
    await page.goto('/kasse')
    await expect(page.getByTestId('submit-order')).toBeVisible()
  })

  test('leeres Formular zeigt deutsche Feldfehler', async ({ page }) => {
    await page.getByTestId('submit-order').click()

    // Die Meldung steht als Hilfetext unter dem jeweiligen Feld, nicht
    // irgendwo auf der Seite — genau dort wird geprüft.
    await expect(fieldError(page, 'customer-name')).toHaveText(
      'Bitte geben Sie Ihren Namen ein.'
    )
    await expect(fieldError(page, 'customer-phone')).toHaveText(
      'Bitte geben Sie Ihre Telefonnummer ein.'
    )
    await expect(fieldError(page, 'pickup-date')).toHaveText(
      'Bitte wählen Sie ein Abholdatum.'
    )
    await expect(fieldError(page, 'pickup-time')).toHaveText(
      'Bitte wählen Sie eine Abholzeit.'
    )

    // Nichts wurde abgeschickt.
    await expect(page).toHaveURL(/\/kasse$/)
    await expect(page.getByTestId('checkout-error')).toHaveCount(0)
  })

  test('unplausible Telefonnummer wird abgelehnt', async ({ page }) => {
    await fillCheckout(page, { phone: 'ruf mich an' })
    await page.getByTestId('submit-order').click()

    await expect(fieldError(page, 'customer-phone')).toHaveText(
      'Bitte geben Sie eine gültige Telefonnummer ein.'
    )
    await expect(page).toHaveURL(/\/kasse$/)
  })

  test('unplausible E-Mail-Adresse wird abgelehnt', async ({ page }) => {
    await fillCheckout(page, { email: 'erika(at)beispiel' })
    await page.getByTestId('submit-order').click()

    await expect(fieldError(page, 'customer-email')).toHaveText(
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
    )
    await expect(page).toHaveURL(/\/kasse$/)
  })

  test('Montag ist Ruhetag und wird abgelehnt', async ({ page }) => {
    await fillCheckout(page, { date: nextMonday(), time: '' })
    await page.getByTestId('submit-order').click()

    // Nicht irgendein „Montag ist Ruhetag“ auf der Seite (das steht auch im
    // Öffnungszeiten-Hinweis), sondern der Fehler am Datumsfeld.
    await expect(fieldError(page, 'pickup-date')).toContainText(
      'Montag ist Ruhetag.'
    )
    await expect(page).toHaveURL(/\/kasse$/)
  })

  test('ein Datum in der Vergangenheit wird abgelehnt', async ({ page }) => {
    await fillCheckout(page, { date: pastDate() })
    await page.getByTestId('submit-order').click()

    await expect(fieldError(page, 'pickup-date')).toHaveText(
      'Das Abholdatum darf nicht in der Vergangenheit liegen.'
    )
    await expect(page).toHaveURL(/\/kasse$/)
  })
})

test.describe('Kasse — Bestellung', () => {
  test('gültige Bestellung landet auf der Bestätigung und leert den Korb', async ({
    page,
  }) => {
    const { first, second } = await seedTwoLines(page)
    await page.goto('/kasse')
    await expect(page.getByTestId('submit-order')).toBeVisible()

    const values = await fillCheckout(page, {
      notes: 'Brot bitte ungeschnitten.',
    })
    await page.getByTestId('submit-order').click()

    await expect(page).toHaveURL(/\/bestellung\/[^/]+$/)
    await expect(page.getByTestId('order-confirmation')).toBeVisible()

    const orderNumber = page.getByTestId('order-number')
    await expect(orderNumber).toBeVisible()
    await expect(orderNumber).not.toBeEmpty()
    await expect(orderNumber).not.toHaveText('unbekannt')

    // Die Bestätigung zeigt die echte Bestellung aus der API.
    await expect(page.getByTestId('order-confirmation')).toContainText(
      values.name
    )
    await expect(page.getByTestId('order-confirmation')).toContainText(
      `${values.time} Uhr`
    )
    await expect(page.getByTestId('order-confirmation')).toContainText(
      first.name
    )
    await expect(page.getByTestId('order-confirmation')).toContainText(
      second.name
    )
    await expect(page.getByTestId('order-confirmation')).toContainText(
      formatEuro(first.price * 2 + second.price)
    )

    // Erst nach dem erfolgreichen Absenden ist der Korb leer.
    await expectCartCount(page, 0)
    await expect.poll(async () => (await storedCartItems(page)).length).toBe(0)

    await page.getByTestId('cart-link').click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('Serverfehler zeigt eine deutsche Meldung und behält den Warenkorb', async ({
    page,
  }) => {
    const { first, second } = await seedTwoLines(page)

    // Ein 500er von POST /api/orders — inklusive CORS-Header, sonst käme statt
    // der Serverantwort ein Netzwerkfehler an und der Test prüfte das Falsche.
    await page.route('**/api/orders', async (route) => {
      const method = route.request().method()
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
          },
        })
        return
      }
      if (method !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: SERVER_MESSAGE }),
      })
    })

    await page.goto('/kasse')
    await expect(page.getByTestId('submit-order')).toBeVisible()
    await fillCheckout(page)
    await page.getByTestId('submit-order').click()

    const error = page.getByTestId('checkout-error')
    await expect(error).toBeVisible()
    // Die Meldung des Servers erreicht den Kunden. Dass genau *dieser* Satz
    // ankommt, beweist zugleich: es war eine echte 500-Antwort, kein am
    // Browser gescheiterter Aufruf (dann stünde hier der Standardtext).
    await expect(error).toHaveText(SERVER_MESSAGE)

    // Der Korb überlebt den Fehlschlag — Inhalt, Zähler und Speicher.
    await expect(page).toHaveURL(/\/kasse$/)
    await expectCartCount(page, 3)
    await expect(page.getByTestId('checkout-page')).toContainText(first.name)
    await expect(page.getByTestId('checkout-page')).toContainText(second.name)
    await expect.poll(async () => (await storedCartItems(page)).length).toBe(2)

    // Und man kann es sofort erneut versuchen: der Button ist wieder aktiv.
    await expect(page.getByTestId('submit-order')).toBeEnabled()

    await page.getByTestId('cart-link').click()
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
    await expect
      .poll(() => priceOf(page.getByTestId('cart-total')))
      .toBeCloseTo(first.price * 2 + second.price, 2)
  })

  test('nicht erreichbare API: deutscher Standardtext, Warenkorb bleibt', async ({
    page,
  }) => {
    await seedTwoLines(page)

    // Kein Server am anderen Ende — der Aufruf scheitert im Netz.
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() === 'POST') {
        await route.abort('failed')
        return
      }
      await route.continue()
    })

    await page.goto('/kasse')
    await expect(page.getByTestId('submit-order')).toBeVisible()
    await fillCheckout(page)
    await page.getByTestId('submit-order').click()

    await expect(page.getByTestId('checkout-error')).toHaveText(
      'Bestellung konnte nicht übermittelt werden.'
    )
    await expect(page).toHaveURL(/\/kasse$/)
    await expectCartCount(page, 3)
    await expect.poll(async () => (await storedCartItems(page)).length).toBe(2)
  })
})
