import { test, expect } from '@playwright/test'

test.describe('Management Workflows', () => {
  test.use({ storageState: 'apps/bakery-management-e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
  })

  test('should display admin dashboard with key metrics', async ({ page }) => {
    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Check metric cards are visible
    await expect(
      page.locator('[data-testid="metric-card-orders"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="metric-card-revenue"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="metric-card-products"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="metric-card-customers"]')
    ).toBeVisible()

    // Check charts are rendered
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="orders-chart"]')).toBeVisible()

    // Verify recent activity section
    await expect(page.locator('[data-testid="recent-orders"]')).toBeVisible()
    await expect(page.locator('[data-testid="low-stock-alerts"]')).toBeVisible()
  })

  test('should manage orders workflow', async ({ page }) => {
    // Navigate to orders
    await page.click('[data-testid="nav-orders"]')
    await expect(page).toHaveURL('/admin/orders')
    await expect(page.locator('h1')).toContainText('Bestellungen')

    // Check orders table
    const ordersTable = page.locator('[data-testid="orders-table"]')
    await expect(ordersTable).toBeVisible()

    // Filter orders by status
    await page.selectOption('[data-testid="status-filter"]', 'pending')
    await page.waitForLoadState('networkidle')

    // Click on first order to view details
    await page.click('[data-testid="order-row"]:first-child')
    await expect(page).toHaveURL(/\/admin\/orders\/\d+/)

    // Verify order details are displayed
    await expect(page.locator('[data-testid="order-id"]')).toBeVisible()
    await expect(page.locator('[data-testid="customer-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-items"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-total"]')).toBeVisible()

    // Update order status
    await page.selectOption('[data-testid="order-status-select"]', 'confirmed')
    await page.click('[data-testid="save-status-button"]')

    // Verify success notification
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Status aktualisiert')

    // Add order note
    await page.fill(
      '[data-testid="order-note-input"]',
      'Kunde wurde kontaktiert'
    )
    await page.click('[data-testid="add-note-button"]')

    // Verify note is added
    await expect(page.locator('[data-testid="order-notes"]')).toContainText(
      'Kunde wurde kontaktiert'
    )

    // Generate invoice
    await page.click('[data-testid="generate-invoice-button"]')

    // Wait for download
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="download-invoice-button"]')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toMatch(/rechnung-\d+\.pdf/)
  })

  test('should manage inventory workflow', async ({ page }) => {
    // Navigate to inventory
    await page.click('[data-testid="nav-inventory"]')
    await expect(page).toHaveURL('/admin/inventory')
    await expect(page.locator('h1')).toContainText('Lagerbestand')

    // Check inventory table
    const inventoryTable = page.locator('[data-testid="inventory-table"]')
    await expect(inventoryTable).toBeVisible()

    // Search for a product
    await page.fill('[data-testid="product-search"]', 'Brot')
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle')

    // Click on a product to edit
    await page.click('[data-testid="product-row"]:first-child')
    await expect(page).toHaveURL(/\/admin\/inventory\/products\/\d+/)

    // Update stock quantity
    const currentStock = await page
      .locator('[data-testid="current-stock"]')
      .inputValue()
    const newStock = parseInt(currentStock) + 10

    await page.fill('[data-testid="stock-adjustment"]', '10')
    await page.selectOption('[data-testid="adjustment-reason"]', 'delivery')
    await page.fill(
      '[data-testid="adjustment-note"]',
      'Neue Lieferung erhalten'
    )
    await page.click('[data-testid="apply-adjustment-button"]')

    // Verify stock updated
    await expect(page.locator('[data-testid="current-stock"]')).toHaveValue(
      newStock.toString()
    )
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Lagerbestand aktualisiert')

    // Set low stock alert
    await page.fill('[data-testid="low-stock-threshold"]', '20')
    await page.click('[data-testid="save-threshold-button"]')

    // Add supplier information
    await page.click('[data-testid="add-supplier-button"]')
    await page.fill('[data-testid="supplier-name"]', 'Müller Mühle AG')
    await page.fill('[data-testid="supplier-contact"]', '+41 44 123 45 67')
    await page.fill('[data-testid="supplier-email"]', 'info@mueller-muehle.ch')
    await page.click('[data-testid="save-supplier-button"]')

    // Verify supplier added
    await expect(page.locator('[data-testid="suppliers-list"]')).toContainText(
      'Müller Mühle AG'
    )
  })

  test('should manage production planning', async ({ page }) => {
    // Navigate to production
    await page.click('[data-testid="nav-production"]')
    await expect(page).toHaveURL('/admin/production')
    await expect(page.locator('h1')).toContainText('Produktionsplanung')

    // Check production schedule
    await expect(
      page.locator('[data-testid="production-calendar"]')
    ).toBeVisible()

    // Create production plan for tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateString = tomorrow.toISOString().split('T')[0]

    await page.click(`[data-testid="calendar-date-${dateString}"]`)
    await expect(page.locator('[data-testid="production-modal"]')).toBeVisible()

    // Add products to production
    await page.click('[data-testid="add-product-button"]')
    await page.selectOption('[data-testid="product-select"]', 'bauernbrot')
    await page.fill('[data-testid="quantity-input"]', '50')
    await page.click('[data-testid="confirm-product-button"]')

    // Add another product
    await page.click('[data-testid="add-product-button"]')
    await page.selectOption('[data-testid="product-select"]', 'croissant')
    await page.fill('[data-testid="quantity-input"]', '100')
    await page.click('[data-testid="confirm-product-button"]')

    // Set production time
    await page.fill('[data-testid="start-time"]', '04:00')
    await page.fill('[data-testid="end-time"]', '08:00')

    // Assign baker
    await page.selectOption('[data-testid="baker-select"]', 'johannes-meyer')

    // Save production plan
    await page.click('[data-testid="save-production-button"]')
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Produktionsplan erstellt')

    // Verify plan appears in calendar
    await expect(
      page.locator(`[data-testid="calendar-date-${dateString}"]`)
    ).toContainText('2 Produkte')
  })

  test('should generate and view reports', async ({ page }) => {
    // Navigate to reports
    await page.click('[data-testid="nav-reports"]')
    await expect(page).toHaveURL('/admin/reports')
    await expect(page.locator('h1')).toContainText('Berichte')

    // Generate sales report
    await page.click('[data-testid="report-type-sales"]')

    // Set date range
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 1)
    await page.fill(
      '[data-testid="start-date"]',
      startDate.toISOString().split('T')[0]
    )
    await page.fill(
      '[data-testid="end-date"]',
      new Date().toISOString().split('T')[0]
    )

    // Select report format
    await page.click('[data-testid="format-pdf"]')

    // Generate report
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="generate-report-button"]')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toMatch(
      /umsatzbericht-\d{4}-\d{2}-\d{2}\.pdf/
    )

    // View report preview
    await page.click('[data-testid="preview-report-button"]')
    await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-revenue"]')).toContainText(
      'CHF'
    )
    await expect(page.locator('[data-testid="total-orders"]')).toBeVisible()
    await expect(page.locator('[data-testid="top-products"]')).toBeVisible()
  })

  test('should manage staff and schedules', async ({ page }) => {
    // Navigate to staff management
    await page.click('[data-testid="nav-staff"]')
    await expect(page).toHaveURL('/admin/staff')
    await expect(page.locator('h1')).toContainText('Mitarbeiter')

    // View staff list
    await expect(page.locator('[data-testid="staff-list"]')).toBeVisible()

    // Add new staff member
    await page.click('[data-testid="add-staff-button"]')
    await expect(page.locator('[data-testid="staff-modal"]')).toBeVisible()

    await page.fill('[data-testid="staff-name"]', 'Maria Schmidt')
    await page.fill('[data-testid="staff-email"]', 'maria.schmidt@bakery.com')
    await page.fill('[data-testid="staff-phone"]', '+41 79 987 65 43')
    await page.selectOption('[data-testid="staff-role"]', 'baker')
    await page.fill(
      '[data-testid="staff-start-date"]',
      new Date().toISOString().split('T')[0]
    )

    await page.click('[data-testid="save-staff-button"]')
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Mitarbeiter hinzugefügt')

    // Create work schedule
    await page.click('[data-testid="nav-schedules"]')
    await page.click('[data-testid="create-schedule-button"]')

    // Select week
    await page.click('[data-testid="next-week-button"]')

    // Assign shifts
    await page.click('[data-testid="shift-monday-morning"]')
    await page.selectOption('[data-testid="staff-select"]', 'maria-schmidt')
    await page.fill('[data-testid="shift-start"]', '05:00')
    await page.fill('[data-testid="shift-end"]', '13:00')
    await page.click('[data-testid="confirm-shift-button"]')

    // Save schedule
    await page.click('[data-testid="save-schedule-button"]')
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Dienstplan erstellt')
  })

  test('should handle settings and configuration', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="settings-link"]')
    await expect(page).toHaveURL('/admin/settings')

    // Update business information
    await page.click('[data-testid="tab-business"]')
    await page.fill('[data-testid="business-name"]', 'Bäckerei Heusser GmbH')
    await page.fill(
      '[data-testid="business-address"]',
      'Hauptstrasse 123, 8000 Zürich'
    )
    await page.fill('[data-testid="business-phone"]', '+41 44 123 45 67')
    await page.fill(
      '[data-testid="business-email"]',
      'info@baeckerei-heusser.ch'
    )
    await page.click('[data-testid="save-business-button"]')

    // Configure opening hours
    await page.click('[data-testid="tab-hours"]')
    await page.fill('[data-testid="monday-open"]', '06:00')
    await page.fill('[data-testid="monday-close"]', '18:00')
    await page.click('[data-testid="copy-to-weekdays-button"]')
    await page.fill('[data-testid="saturday-open"]', '06:00')
    await page.fill('[data-testid="saturday-close"]', '14:00')
    await page.click('[data-testid="sunday-closed"]')
    await page.click('[data-testid="save-hours-button"]')

    // Configure notifications
    await page.click('[data-testid="tab-notifications"]')
    await page.check('[data-testid="notify-new-orders"]')
    await page.check('[data-testid="notify-low-stock"]')
    await page.fill(
      '[data-testid="notification-email"]',
      'manager@baeckerei-heusser.ch'
    )
    await page.click('[data-testid="save-notifications-button"]')

    // Verify all saved
    await expect(
      page.locator('[data-testid="success-notification"]')
    ).toContainText('Einstellungen gespeichert')
  })
})
