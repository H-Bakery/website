import { test, expect } from '@playwright/test'

test.describe('Shop User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should complete full shopping journey from browse to checkout', async ({
    page,
  }) => {
    // Step 1: Verify home page loads with hero and featured products
    await expect(page).toHaveTitle(/Bäckerei Heusser - Online Shop/)
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="featured-products"]')
    ).toBeVisible()

    // Check that featured products are displayed
    const featuredProducts = page.locator('[data-testid="product-card"]')
    await expect(featuredProducts).toHaveCount(3) // Expecting 3 featured products

    // Step 2: Navigate to products page
    await page.click('text=Alle Produkte ansehen')
    await expect(page).toHaveURL('/products')
    await expect(page.locator('h1')).toContainText('Unsere Produkte')

    // Step 3: Filter products by category
    await page.click('[data-testid="category-filter-brot"]')
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(5) // Bread products

    // Step 4: Add a product to cart
    const firstProduct = page.locator('[data-testid="product-card"]').first()
    const productName = await firstProduct
      .locator('[data-testid="product-name"]')
      .textContent()
    await firstProduct.locator('[data-testid="add-to-cart"]').click()

    // Verify cart button updates
    await expect(
      page.locator('[data-testid="cart-button-badge"]')
    ).toContainText('1')

    // Step 5: Add another product
    await page.click('[data-testid="category-filter-broetchen"]')
    const secondProduct = page.locator('[data-testid="product-card"]').first()
    await secondProduct.locator('[data-testid="add-to-cart"]').click()
    await expect(
      page.locator('[data-testid="cart-button-badge"]')
    ).toContainText('2')

    // Step 6: Navigate to cart
    await page.click('[data-testid="cart-button"]')
    await expect(page).toHaveURL('/cart')
    await expect(page.locator('h1')).toContainText('Warenkorb')

    // Step 7: Verify cart contents
    const cartItems = page.locator('[data-testid="cart-item"]')
    await expect(cartItems).toHaveCount(2)

    // Step 8: Update quantity
    const quantityInput = cartItems
      .first()
      .locator('[data-testid="quantity-input"]')
    await quantityInput.clear()
    await quantityInput.fill('3')
    await page.keyboard.press('Enter')

    // Verify total updates
    await expect(page.locator('[data-testid="cart-total"]')).toContainText(
      'CHF'
    )

    // Step 9: Remove an item
    await cartItems.last().locator('[data-testid="remove-item"]').click()
    await expect(cartItems).toHaveCount(1)

    // Step 10: Proceed to checkout
    await page.click('[data-testid="checkout-button"]')
    await expect(page).toHaveURL('/checkout')
    await expect(page.locator('h1')).toContainText('Bestellung')

    // Step 11: Fill checkout form
    await page.fill('[data-testid="customer-name"]', 'Max Mustermann')
    await page.fill('[data-testid="customer-email"]', 'max@example.com')
    await page.fill('[data-testid="customer-phone"]', '+41 79 123 45 67')
    await page.fill(
      '[data-testid="delivery-address"]',
      'Hauptstrasse 123, 8000 Zürich'
    )

    // Select delivery time
    await page.click('[data-testid="delivery-date"]')
    await page.click('text=Tomorrow') // Select tomorrow's date
    await page.selectOption('[data-testid="delivery-time"]', '10:00')

    // Add order notes
    await page.fill(
      '[data-testid="order-notes"]',
      'Bitte bei Nachbar abgeben falls nicht zu Hause'
    )

    // Step 12: Review order
    await expect(page.locator('[data-testid="order-summary"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-total"]')).toContainText(
      'CHF'
    )

    // Step 13: Place order
    await page.click('[data-testid="place-order-button"]')

    // Step 14: Verify order confirmation
    await expect(page).toHaveURL(/\/order-confirmation/)
    await expect(page.locator('h1')).toContainText('Bestellung erfolgreich')
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="confirmation-message"]')
    ).toContainText('Vielen Dank für Ihre Bestellung')
  })

  test('should handle empty cart correctly', async ({ page }) => {
    // Navigate directly to cart
    await page.goto('/cart')

    // Verify empty cart message
    await expect(
      page.locator('[data-testid="empty-cart-message"]')
    ).toContainText('Ihr Warenkorb ist leer')
    await expect(
      page.locator('[data-testid="continue-shopping-button"]')
    ).toBeVisible()

    // Click continue shopping
    await page.click('[data-testid="continue-shopping-button"]')
    await expect(page).toHaveURL('/products')
  })

  test('should persist cart across page refreshes', async ({ page }) => {
    // Add product to cart
    await page.goto('/products')
    await page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('[data-testid="add-to-cart"]')
      .click()

    // Verify cart has 1 item
    await expect(
      page.locator('[data-testid="cart-button-badge"]')
    ).toContainText('1')

    // Refresh page
    await page.reload()

    // Verify cart still has 1 item
    await expect(
      page.locator('[data-testid="cart-button-badge"]')
    ).toContainText('1')

    // Navigate to cart and verify item is there
    await page.click('[data-testid="cart-button"]')
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1)
  })

  test('should show product details', async ({ page }) => {
    // Navigate to products
    await page.goto('/products')

    // Click on a product
    const product = page.locator('[data-testid="product-card"]').first()
    const productName = await product
      .locator('[data-testid="product-name"]')
      .textContent()
    await product.click()

    // Verify product detail page
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.locator('h1')).toContainText(productName || '')
    await expect(
      page.locator('[data-testid="product-description"]')
    ).toBeVisible()
    await expect(page.locator('[data-testid="product-price"]')).toContainText(
      'CHF'
    )
    await expect(
      page.locator('[data-testid="add-to-cart-detail"]')
    ).toBeVisible()
  })

  test('should search for products', async ({ page }) => {
    // Navigate to products
    await page.goto('/products')

    // Search for "Brot"
    await page.fill('[data-testid="product-search"]', 'Brot')
    await page.keyboard.press('Enter')

    // Verify search results
    const searchResults = page.locator('[data-testid="product-card"]')
    const count = await searchResults.count()

    // Check that all results contain "Brot" in their name
    for (let i = 0; i < count; i++) {
      const productName = await searchResults
        .nth(i)
        .locator('[data-testid="product-name"]')
        .textContent()
      expect(productName?.toLowerCase()).toContain('brot')
    }
  })

  test('should handle cart quantity limits', async ({ page }) => {
    // Navigate to products
    await page.goto('/products')

    // Add product to cart
    await page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('[data-testid="add-to-cart"]')
      .click()

    // Go to cart
    await page.click('[data-testid="cart-button"]')

    // Try to set quantity to 0
    const quantityInput = page.locator('[data-testid="quantity-input"]')
    await quantityInput.clear()
    await quantityInput.fill('0')
    await page.keyboard.press('Enter')

    // Verify item is removed or quantity is set to 1
    const cartItems = page.locator('[data-testid="cart-item"]')
    const itemCount = await cartItems.count()
    if (itemCount > 0) {
      await expect(quantityInput).toHaveValue('1')
    } else {
      await expect(
        page.locator('[data-testid="empty-cart-message"]')
      ).toBeVisible()
    }

    // Add product again if removed
    if (itemCount === 0) {
      await page.goto('/products')
      await page
        .locator('[data-testid="product-card"]')
        .first()
        .locator('[data-testid="add-to-cart"]')
        .click()
      await page.click('[data-testid="cart-button"]')
    }

    // Try to set quantity to very high number (e.g., 100)
    await quantityInput.clear()
    await quantityInput.fill('100')
    await page.keyboard.press('Enter')

    // Verify quantity is limited (e.g., to 99 or shows error)
    const finalQuantity = await quantityInput.inputValue()
    expect(parseInt(finalQuantity)).toBeLessThanOrEqual(99)
  })
})
