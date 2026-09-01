/**
 * @fileoverview Shared helpers for the bakery-shop e2e suite.
 *
 * Nothing in here asserts on business data by hard-coded literal: product
 * counts, names and prices are read back from the same API the shop reads, so
 * the suite tests "the page shows what the data says" instead of rotting the
 * day someone edits `hq/products/*.md`.
 */

import {
  expect,
  request as playwrightRequest,
  type Locator,
  type Page,
} from '@playwright/test'

/** Where the shop's data comes from (`GET /api/products`, `POST /api/orders`). */
export const API_BASE = process.env['API_URL'] || 'http://localhost:5000'

/** localStorage key of the persisted cart (`CartProvider`'s `storageKey`). */
export const CART_STORAGE_KEY = 'bakery-cart'

/** The catalog renders this many cards per "Mehr anzeigen" step. */
export const CATALOG_PAGE_SIZE = 24

/** One product as `GET /api/products` delivers it (snake_case). */
export interface ApiProduct {
  id: string
  numeric_id: number
  name: string
  category: string
  price: number
  available?: boolean
  seasonal?: boolean
  short_description?: string
}

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Reads the live product list — the exact data the shop renders.
 *
 * Builds its own request context instead of taking the `request` fixture, so
 * it can be called from `beforeAll` (that hook may only use worker fixtures).
 */
export async function fetchProducts(): Promise<ApiProduct[]> {
  const context = await playwrightRequest.newContext()
  try {
    const response = await context.get(`${API_BASE}/api/products`)
    expect(response.ok(), 'GET /api/products muss 2xx antworten').toBeTruthy()
    const body = await response.json()
    const list: ApiProduct[] = Array.isArray(body) ? body : body.data
    expect(Array.isArray(list)).toBe(true)
    // Schutz gegen "0 Produkte im UI == 0 Produkte in der API == grün".
    expect(list.length).toBeGreaterThan(50)
    return list
  } finally {
    await context.dispose()
  }
}

/** Mirrors the catalog's own filter: name or teaser contains the term. */
export function matchesQuery(product: ApiProduct, term: string): boolean {
  const needle = term.trim().toLowerCase()
  return (
    product.name.toLowerCase().includes(needle) ||
    (product.short_description ?? '').toLowerCase().includes(needle)
  )
}

/** Sorts like the catalog's default (`Name A–Z`, German collation). */
export function byName(products: ApiProduct[]): ApiProduct[] {
  const collator = new Intl.Collator('de-DE', { sensitivity: 'base' })
  return [...products].sort((a, b) => collator.compare(a.name, b.name))
}

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Collapses every kind of space (the € price uses a NON-BREAKING space) so
 * strings from the DOM and from `Intl` can be compared at all.
 */
export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

const EURO_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

/** `2.5` -> `'2,50 €'` (with a normal space, matching {@link normalizeSpaces}). */
export function formatEuro(value: number): string {
  return normalizeSpaces(EURO_FORMATTER.format(value))
}

/** `'1.234,50 €'` -> `1234.5`; throws when the text holds no price at all. */
export function parseEuro(text: string): number {
  const match = normalizeSpaces(text).match(/-?[\d.]*\d,\d{2}/)
  if (!match) throw new Error(`Kein Preis in „${text}“ gefunden.`)
  return Number(match[0].replace(/\./g, '').replace(',', '.'))
}

/** Reads a rendered price out of any locator (`product-card-price`, `cart-total`, …). */
export async function priceOf(locator: Locator): Promise<number> {
  return parseEuro((await locator.innerText()) ?? '')
}

/* -------------------------------------------------------------------------- */
/* Cart state                                                                  */
/* -------------------------------------------------------------------------- */

/** One persisted cart line — the subset of `CartItem` the shop actually reads. */
export interface SeedCartItem {
  id: number
  slug: string
  name: string
  price: number
  quantity: number
  unit?: string
  image?: string
}

/**
 * Empties the persisted cart — once, on the first page load of this context.
 *
 * Deliberately *not* on every navigation: a reload has to be able to prove
 * that the cart survives, so the guard remembers in sessionStorage that it has
 * already run.
 */
export async function clearCartStorage(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    try {
      if (window.sessionStorage.getItem('e2e-cart-cleared')) return
      window.localStorage.removeItem(key)
      window.sessionStorage.setItem('e2e-cart-cleared', '1')
    } catch {
      /* private mode — the cart then simply starts empty */
    }
  }, CART_STORAGE_KEY)
}

/**
 * Pre-fills the cart through localStorage.
 *
 * Used by the checkout suite so each test starts from a known basket without
 * walking the catalog first; the *real* add-to-cart path is covered end to end
 * in `shop-journey.spec.ts`.
 */
export async function seedCart(
  page: Page,
  items: SeedCartItem[]
): Promise<void> {
  const payload = JSON.stringify({
    items: items.map((item) => ({
      unit: 'Stück',
      stock: 999,
      ...item,
    })),
    discountCode: null,
    discountAmount: 0,
    savedAt: new Date().toISOString(),
  })
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* ignore */
      }
    },
    [CART_STORAGE_KEY, payload] as [string, string]
  )
}

/** The cart lines currently in localStorage (`[]` when nothing is stored). */
export async function storedCartItems(
  page: Page
): Promise<Array<{ id: number; quantity: number }>> {
  return page.evaluate((key: string) => {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.items) ? parsed.items : []
    } catch {
      return []
    }
  }, CART_STORAGE_KEY)
}

/* -------------------------------------------------------------------------- */
/* Locators                                                                    */
/* -------------------------------------------------------------------------- */

/** The header badge showing the number of items in the cart. */
export function cartBadge(page: Page): Locator {
  return page.getByTestId('cart-badge')
}

/**
 * Asserts the header's item counter.
 *
 * At zero the *badge* cannot be read as text: MUI keeps the previous number in
 * the DOM while it scales the bubble away, so an emptied cart still reads "3"
 * there. The cart link's aria-label is the honest number in every state and is
 * checked always; the badge's own text is checked whenever it is on screen.
 */
export async function expectCartCount(
  page: Page,
  count: number
): Promise<void> {
  await expect(page.getByTestId('cart-link')).toHaveAttribute(
    'aria-label',
    count === 1 ? 'Warenkorb, 1 Artikel' : `Warenkorb, ${count} Artikel`
  )
  if (count > 0) {
    await expect(cartBadge(page)).toHaveText(String(count))
  } else {
    await expect(cartBadge(page).locator('.MuiBadge-badge')).toBeHidden()
  }
}

/** Helper text of one checkout field — where its German error message lands. */
export function fieldError(page: Page, testId: string): Locator {
  return page.locator(`#${testId}-helper-text`)
}

/** The catalog's result line, e.g. `103 Produkte · 24 angezeigt`. */
export function resultCount(page: Page): Locator {
  return page.getByText(/^\d+ Produkte?( ·|$)/)
}

/** All cards of the product grid on the current page. */
export function productCards(page: Page): Locator {
  return page.getByTestId('product-grid').getByTestId('product-card')
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/** Local `YYYY-MM-DD` — never UTC, that would shift the day. */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * The next date the bakery is open, starting tomorrow.
 *
 * Always in the future (so no Vorlaufzeit narrowing kicks in) and never a
 * Monday (Ruhetag). Computed, never hard-coded — a fixed date would age out.
 */
export function nextOpenDate(from: Date = new Date()): string {
  let candidate = addDays(from, 1)
  while (candidate.getDay() === 1) candidate = addDays(candidate, 1)
  return isoDate(candidate)
}

/** The next Monday in the future — the bakery's Ruhetag. */
export function nextMonday(from: Date = new Date()): string {
  let candidate = addDays(from, 1)
  while (candidate.getDay() !== 1) candidate = addDays(candidate, 1)
  return isoDate(candidate)
}

/** Yesterday — a date the checkout must refuse. */
export function pastDate(from: Date = new Date()): string {
  return isoDate(addDays(from, -1))
}

/**
 * A pickup slot that exists on every open day: Sundays run 08:00–11:00,
 * all other open days start at 05:30, so 09:00 is always offered.
 */
export const SAFE_PICKUP_TIME = '09:00'
