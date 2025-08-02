import { test, expect, devices } from '@playwright/test'

test.use({
  ...devices['iPhone 12'],
})

test.describe('Shop Mobile Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have mobile-optimized navigation', async ({ page }) => {
    // Mobile menu should be visible
    await expect(
      page.locator('[data-testid="mobile-menu-button"]')
    ).toBeVisible()

    // Desktop navigation should be hidden
    await expect(
      page.locator('[data-testid="desktop-navigation"]')
    ).toBeHidden()

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()

    // Check mobile menu items
    await expect(
      page.locator('[data-testid="mobile-menu"] >> text=Products')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="mobile-menu"] >> text=Cart')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="mobile-menu"] >> text=Account')
    ).toBeVisible()

    // Navigate to products via mobile menu
    await page.click('[data-testid="mobile-menu"] >> text=Products')
    await expect(page).toHaveURL('/products')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeHidden()
  })

  test('should have touch-friendly product cards', async ({ page }) => {
    await page.goto('/products')

    // Product cards should be properly sized for mobile
    const productCard = page.locator('[data-testid="product-card"]').first()
    const cardBox = await productCard.boundingBox()

    // Card should take most of the viewport width
    expect(cardBox?.width).toBeGreaterThan(300)

    // Add to cart button should be large enough for touch
    const addToCartButton = productCard.locator('[data-testid="add-to-cart"]')
    const buttonBox = await addToCartButton.boundingBox()

    // Button should be at least 44x44 pixels (iOS touch target guidelines)
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44)
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44)
  })

  test('should have mobile-optimized cart', async ({ page }) => {
    // Add a product first
    await page.goto('/products')
    await page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('[data-testid="add-to-cart"]')
      .click()

    // Navigate to cart
    await page.click('[data-testid="cart-button"]')

    // Cart items should be stacked vertically on mobile
    const cartItems = page.locator('[data-testid="cart-item"]')
    await expect(cartItems).toHaveCount(1)

    // Quantity controls should be touch-friendly
    const incrementButton = cartItems
      .first()
      .locator('[data-testid="quantity-increment"]')
    const decrementButton = cartItems
      .first()
      .locator('[data-testid="quantity-decrement"]')

    const incrementBox = await incrementButton.boundingBox()
    const decrementBox = await decrementButton.boundingBox()

    // Touch targets should be at least 44x44 pixels
    expect(incrementBox?.height).toBeGreaterThanOrEqual(44)
    expect(incrementBox?.width).toBeGreaterThanOrEqual(44)
    expect(decrementBox?.height).toBeGreaterThanOrEqual(44)
    expect(decrementBox?.width).toBeGreaterThanOrEqual(44)
  })

  test('should have mobile-friendly checkout form', async ({ page }) => {
    // Add a product and go to checkout
    await page.goto('/products')
    await page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('[data-testid="add-to-cart"]')
      .click()
    await page.click('[data-testid="cart-button"]')
    await page.click('[data-testid="checkout-button"]')

    // Form inputs should be properly sized for mobile
    const nameInput = page.locator('[data-testid="customer-name"]')
    const emailInput = page.locator('[data-testid="customer-email"]')
    const phoneInput = page.locator('[data-testid="customer-phone"]')

    // Check that inputs are visible and have appropriate attributes
    await expect(nameInput).toBeVisible()
    await expect(emailInput).toBeVisible()
    await expect(phoneInput).toBeVisible()

    // Phone input should have tel type for mobile keyboard
    await expect(phoneInput).toHaveAttribute('type', 'tel')

    // Email input should have email type for mobile keyboard
    await expect(emailInput).toHaveAttribute('type', 'email')

    // Form should be scrollable
    const form = page.locator('form')
    const formBox = await form.boundingBox()
    const viewportSize = page.viewportSize()

    // Form might be taller than viewport on mobile
    expect(formBox?.height).toBeDefined()
  })

  test('should have sticky mobile cart button', async ({ page }) => {
    await page.goto('/products')

    // Cart button should be visible
    const cartButton = page.locator('[data-testid="cart-button"]')
    await expect(cartButton).toBeVisible()

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500))

    // Cart button should still be visible (sticky/fixed)
    await expect(cartButton).toBeVisible()

    // Add product to cart
    await page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('[data-testid="add-to-cart"]')
      .click()

    // Badge should update and be visible
    await expect(
      page.locator('[data-testid="cart-button-badge"]')
    ).toContainText('1')
  })

  test('should handle swipe gestures for product images', async ({ page }) => {
    // Navigate to product detail
    await page.goto('/products')
    await page.locator('[data-testid="product-card"]').first().click()

    // Product image gallery should be visible
    const imageGallery = page.locator('[data-testid="product-image-gallery"]')
    await expect(imageGallery).toBeVisible()

    // Simulate swipe (if multiple images)
    const images = page.locator('[data-testid="product-image"]')
    const imageCount = await images.count()

    if (imageCount > 1) {
      // Swipe to next image
      await imageGallery.swipe('left')

      // Check that next image is visible
      await expect(images.nth(1)).toBeVisible()
    }
  })

  test('should have mobile-optimized search', async ({ page }) => {
    await page.goto('/products')

    // Search should be accessible on mobile
    const searchButton = page.locator('[data-testid="mobile-search-button"]')
    await expect(searchButton).toBeVisible()

    // Click search button to open search overlay
    await searchButton.click()

    const searchOverlay = page.locator('[data-testid="search-overlay"]')
    await expect(searchOverlay).toBeVisible()

    const searchInput = searchOverlay.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toBeFocused()

    // Type search query
    await searchInput.fill('Brot')
    await searchInput.press('Enter')

    // Search overlay should close and results should be shown
    await expect(searchOverlay).toBeHidden()
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(5) // Bread products
  })

  test('should have bottom navigation on mobile', async ({ page }) => {
    // Bottom navigation should be visible
    const bottomNav = page.locator('[data-testid="mobile-bottom-nav"]')
    await expect(bottomNav).toBeVisible()

    // Check navigation items
    await expect(bottomNav.locator('[data-testid="nav-home"]')).toBeVisible()
    await expect(
      bottomNav.locator('[data-testid="nav-products"]')
    ).toBeVisible()
    await expect(bottomNav.locator('[data-testid="nav-cart"]')).toBeVisible()
    await expect(bottomNav.locator('[data-testid="nav-account"]')).toBeVisible()

    // Navigate using bottom nav
    await bottomNav.locator('[data-testid="nav-products"]').click()
    await expect(page).toHaveURL('/products')

    // Active state should be visible
    await expect(
      bottomNav.locator('[data-testid="nav-products"]')
    ).toHaveAttribute('data-active', 'true')
  })
})
