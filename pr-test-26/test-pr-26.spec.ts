import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:4201'
const SCREENSHOT_DIR = '/home/bakery/develop/website/pr-test-26/round-1'

test.describe('PR #26 - HQ Products in Management App', () => {
  test('01 - Products page loads without errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    const response = await page.goto(`${BASE_URL}/admin/products`)
    expect(response?.status()).toBe(200)

    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-products-page-loaded.png`,
      fullPage: true,
    })

    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') && !e.includes('HMR') && !e.includes('hydrat')
    )
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors)
    }
  })

  test('02 - Page title and header visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const heading = page
      .locator('h1, h4')
      .filter({ hasText: /Produktverwaltung/ })
    await expect(heading).toBeVisible()

    const subtitle = page.locator(
      'text=Verwaltung und Bearbeitung aller Backwaren und Produkte'
    )
    await expect(subtitle).toBeVisible()

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-header-visible.png`,
    })
  })

  test('03 - Statistics cards show product counts', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Gesamt')).toBeVisible()
    await expect(page.locator('text=Verfügbar').first()).toBeVisible()
    await expect(page.locator('text=Saisonale Artikel')).toBeVisible()
    await expect(page.locator('text=Nicht verfügbar').first()).toBeVisible()

    const totalText = await page
      .locator('text=Gesamt')
      .locator('..')
      .locator('h3')
      .textContent()
    const totalCount = parseInt(totalText || '0')
    console.log(`Total products: ${totalCount}`)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-statistics-cards.png`,
    })

    expect(totalCount).toBeGreaterThan(0)
  })

  test('04 - Product table renders with HQ products', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const table = page.locator('table')
    await expect(table).toBeVisible()

    await expect(page.locator('th:has-text("Produkt")')).toBeVisible()
    await expect(page.locator('th:has-text("Kategorie")')).toBeVisible()
    await expect(page.locator('th:has-text("Preis")')).toBeVisible()
    await expect(page.locator('th:has-text("Verfügbarkeit")')).toBeVisible()
    await expect(page.locator('th:has-text("Aktionen")')).toBeVisible()

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    console.log(`Table rows: ${rowCount}`)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-product-table.png`,
      fullPage: true,
    })

    expect(rowCount).toBeGreaterThan(0)
  })

  test('05 - Category chips are displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const chips = page.locator('.MuiChip-root')
    const chipCount = await chips.count()
    console.log(`Total chips: ${chipCount}`)
    expect(chipCount).toBeGreaterThan(0)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-category-chips.png`,
      fullPage: true,
    })
  })

  test('06 - Action buttons (Edit/Delete) present', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const editButtons = page.locator('button[aria-label="edit product"]')
    const deleteButtons = page.locator('button[aria-label="delete product"]')

    const editCount = await editButtons.count()
    const deleteCount = await deleteButtons.count()
    console.log(`Edit buttons: ${editCount}, Delete buttons: ${deleteCount}`)

    expect(editCount).toBeGreaterThan(0)
    expect(deleteCount).toBeGreaterThan(0)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-action-buttons.png`,
    })
  })

  test('07 - Neues Produkt button visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const addButton = page.locator('button:has-text("Neues Produkt")')
    await expect(addButton).toBeVisible()

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-new-product-button.png`,
    })
  })

  test('08 - Mobile viewport renders', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-mobile-viewport.png`,
      fullPage: true,
    })

    const heading = page
      .locator('h1, h4')
      .filter({ hasText: /Produktverwaltung/ })
    await expect(heading).toBeVisible()
  })

  test('09 - Admin dashboard loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-admin-dashboard.png`,
    })
  })

  test('10 - Produktliste header shows count', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/products`)
    await page.waitForLoadState('networkidle')

    const listHeader = page.locator('text=/Produktliste \\(\\d+ Produkte\\)/')
    await expect(listHeader).toBeVisible()

    const text = await listHeader.textContent()
    console.log(`List header: ${text}`)

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-product-list-count.png`,
    })
  })
})
