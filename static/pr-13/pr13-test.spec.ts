import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/bakery/develop/website/static/pr-13/round-1'

test.describe('PR #13 — Landing Page Products', () => {
  test('01 — Home page loads without errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-homepage-loaded.png`,
      fullPage: false,
    })

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('Warning') && !e.includes('DevTools')
    )
    expect(criticalErrors).toEqual([])
  })

  test('02 — Sortiment section visible on homepage', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const sortimentHeading = page.getByRole('heading', {
      name: /Unser Sortiment/i,
    })
    await expect(sortimentHeading).toBeVisible()

    await sortimentHeading.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-sortiment-section.png`,
      fullPage: false,
    })
  })

  test('03 — Category filter chips are shown', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const alleChip = page.getByRole('button', { name: /Alle/i })
    await alleChip.scrollIntoViewIfNeeded()
    await expect(alleChip).toBeVisible()

    const brotChip = page.getByRole('button', { name: /Brot/i })
    await expect(brotChip).toBeVisible()

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-category-chips.png`,
      fullPage: false,
    })
  })

  test('04 — Products are displayed in grid', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const sortiment = page.locator('section[aria-label="Unser Sortiment"]')
    await sortiment.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const productTexts = await sortiment
      .locator('text=/\\d+,\\d+\\s*€/')
      .count()
    expect(productTexts).toBeGreaterThan(0)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-product-grid.png`,
      fullPage: false,
    })
  })

  test('05 — Category filter works (click Brot)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const sortiment = page.locator('section[aria-label="Unser Sortiment"]')
    await sortiment.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    const brotChip = page.getByRole('button', { name: /Brot \(/i })
    await brotChip.click()
    await page.waitForTimeout(300)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-filter-brot.png`,
      fullPage: false,
    })

    const brotHeading = sortiment.getByRole('heading', { name: /Brot/i })
    await expect(brotHeading).toBeVisible()
  })

  test('06 — Full page screenshot', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-full-page.png`,
      fullPage: true,
    })
  })

  test('07 — Mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const sortiment = page.locator('section[aria-label="Unser Sortiment"]')
    await sortiment.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-mobile-sortiment.png`,
      fullPage: false,
    })
  })

  test('08 — Products page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/products`, {
      waitUntil: 'networkidle',
    })
    expect(response?.status()).toBe(200)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-products-page.png`,
      fullPage: false,
    })
  })

  test('09 — API products endpoint returns data', async ({ request }) => {
    const response = await request.get('http://localhost:5000/api/products')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    expect(json.count).toBeGreaterThan(0)
  })

  test('10 — API category filter works', async ({ request }) => {
    const response = await request.get(
      'http://localhost:5000/api/products?category=brot'
    )
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.every((p: any) => p.category === 'brot')).toBe(true)
  })

  test('11 — No console errors during navigation', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' })
    await page.goto(`${BASE_URL}/about`, { waitUntil: 'networkidle' })
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('Warning') &&
        !e.includes('DevTools') &&
        !e.includes('favicon') &&
        !e.includes('Failed to load resource')
    )

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-navigation-test.png`,
      fullPage: false,
    })
    expect(criticalErrors).toEqual([])
  })
})
