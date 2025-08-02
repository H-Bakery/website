import { test, expect } from '@playwright/test'

test.describe('Landing Page Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load landing page with all key sections', async ({ page }) => {
    // Verify page title and meta
    await expect(page).toHaveTitle(/Bäckerei Heusser/)

    // Check hero section
    const hero = page.locator('[data-testid="hero-section"]')
    await expect(hero).toBeVisible()
    await expect(hero).toContainText('Traditionelle Handwerksbäckerei')
    await expect(hero.locator('[data-testid="hero-cta"]')).toContainText(
      'Unsere Produkte'
    )

    // Check about section
    const about = page.locator('[data-testid="about-section"]')
    await expect(about).toBeVisible()
    await expect(about).toContainText('Seit 1933')

    // Check features/USP section
    const features = page.locator('[data-testid="features-section"]')
    await expect(features).toBeVisible()
    await expect(features.locator('[data-testid="feature-card"]')).toHaveCount(
      3
    )

    // Check testimonials
    const testimonials = page.locator('[data-testid="testimonials-section"]')
    await expect(testimonials).toBeVisible()

    // Check CTA section
    const cta = page.locator('[data-testid="cta-section"]')
    await expect(cta).toBeVisible()
    await expect(cta).toContainText('Besuchen Sie uns')

    // Check footer
    const footer = page.locator('[data-testid="footer"]')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText('Bäckerei Heusser')
  })

  test('should navigate through all main pages', async ({ page }) => {
    // Navigate to About page
    await page.click('[data-testid="nav-about"]')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('h1')).toContainText('Über uns')

    // Check breadcrumbs
    await expect(page.locator('[data-testid="breadcrumbs"]')).toBeVisible()
    await expect(page.locator('[data-testid="breadcrumbs"]')).toContainText(
      'Home'
    )
    await expect(page.locator('[data-testid="breadcrumbs"]')).toContainText(
      'About'
    )

    // Navigate to Contact page
    await page.click('[data-testid="nav-contact"]')
    await expect(page).toHaveURL('/contact')
    await expect(page.locator('h1')).toContainText('Kontakt')

    // Navigate back to home
    await page.click('[data-testid="logo"]')
    await expect(page).toHaveURL('/')
  })

  test('should display and submit contact form', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact')

    // Verify contact information is displayed
    await expect(page.locator('[data-testid="contact-info"]')).toBeVisible()
    await expect(page.locator('[data-testid="address"]')).toContainText(
      'Hauptstrasse'
    )
    await expect(page.locator('[data-testid="phone"]')).toContainText('+41')
    await expect(page.locator('[data-testid="email"]')).toContainText('@')

    // Check opening hours
    await expect(page.locator('[data-testid="opening-hours"]')).toBeVisible()
    await expect(page.locator('[data-testid="opening-hours"]')).toContainText(
      'Montag'
    )
    await expect(page.locator('[data-testid="opening-hours"]')).toContainText(
      'Samstag'
    )

    // Fill contact form
    await page.fill('[data-testid="contact-name"]', 'Max Mustermann')
    await page.fill('[data-testid="contact-email"]', 'max@example.com')
    await page.fill('[data-testid="contact-phone"]', '+41 79 123 45 67')
    await page.selectOption('[data-testid="contact-subject"]', 'catering')
    await page.fill(
      '[data-testid="contact-message"]',
      'Ich interessiere mich für Ihr Catering-Angebot für eine Firmenfeier mit 50 Personen.'
    )

    // Accept privacy policy
    await page.check('[data-testid="privacy-consent"]')

    // Submit form
    await page.click('[data-testid="submit-contact"]')

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Vielen Dank'
    )

    // Form should be reset
    await expect(page.locator('[data-testid="contact-name"]')).toHaveValue('')
  })

  test('should display location map and directions', async ({ page }) => {
    await page.goto('/contact')

    // Check map is loaded
    const map = page.locator('[data-testid="location-map"]')
    await expect(map).toBeVisible()

    // Check directions button
    await page.click('[data-testid="get-directions"]')

    // Should open in new tab (Google Maps)
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-testid="directions-google"]'),
    ])

    // Verify new tab opened with maps
    expect(newPage.url()).toContain('maps.google.com')
    await newPage.close()
  })

  test('should handle newsletter subscription', async ({ page }) => {
    // Scroll to footer
    await page.locator('[data-testid="footer"]').scrollIntoViewIfNeeded()

    // Find newsletter form
    const newsletter = page.locator('[data-testid="newsletter-form"]')
    await expect(newsletter).toBeVisible()

    // Try to submit without email
    await page.click('[data-testid="newsletter-submit"]')
    await expect(
      page.locator('[data-testid="newsletter-error"]')
    ).toContainText('Bitte geben Sie Ihre E-Mail-Adresse ein')

    // Submit with invalid email
    await page.fill('[data-testid="newsletter-email"]', 'invalid-email')
    await page.click('[data-testid="newsletter-submit"]')
    await expect(
      page.locator('[data-testid="newsletter-error"]')
    ).toContainText('Bitte geben Sie eine gültige E-Mail-Adresse ein')

    // Submit with valid email
    await page.fill('[data-testid="newsletter-email"]', 'test@example.com')
    await page.click('[data-testid="newsletter-submit"]')

    // Verify success
    await expect(
      page.locator('[data-testid="newsletter-success"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="newsletter-success"]')
    ).toContainText('Erfolgreich angemeldet')
  })

  test('should display social media links', async ({ page }) => {
    // Scroll to footer
    await page.locator('[data-testid="footer"]').scrollIntoViewIfNeeded()

    // Check social media links
    const socialLinks = page.locator('[data-testid="social-links"]')
    await expect(socialLinks).toBeVisible()

    // Verify each social link
    await expect(
      socialLinks.locator('[data-testid="social-facebook"]')
    ).toBeVisible()
    await expect(
      socialLinks.locator('[data-testid="social-instagram"]')
    ).toBeVisible()
    await expect(
      socialLinks.locator('[data-testid="social-whatsapp"]')
    ).toBeVisible()

    // Check links open in new tab
    const facebookLink = socialLinks.locator('[data-testid="social-facebook"]')
    await expect(facebookLink).toHaveAttribute('target', '_blank')
    await expect(facebookLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('should handle responsive navigation on mobile', async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) {
      // Skip this test on desktop
      test.skip()
    }

    // Mobile menu should be visible
    await expect(
      page.locator('[data-testid="mobile-menu-button"]')
    ).toBeVisible()

    // Desktop nav should be hidden
    await expect(page.locator('[data-testid="desktop-nav"]')).toBeHidden()

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()

    // Navigate via mobile menu
    await page.click('[data-testid="mobile-nav-about"]')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeHidden()
  })

  test('should display special offers and promotions', async ({ page }) => {
    // Check if promotional banner is visible
    const promoBanner = page.locator('[data-testid="promo-banner"]')

    // Promotional content might be seasonal
    const promoCount = await promoBanner.count()
    if (promoCount > 0) {
      await expect(promoBanner).toBeVisible()
      await expect(promoBanner).toContainText(/Aktion|Angebot|Special/)

      // Click on promotion
      await promoBanner.click()

      // Should navigate to promotion page or section
      await expect(page.url()).toMatch(/promo|aktion|angebot/)
    }
  })

  test('should link to online shop', async ({ page }) => {
    // Find shop CTA button
    const shopButton = page.locator('[data-testid="shop-cta"]')
    await expect(shopButton).toBeVisible()
    await expect(shopButton).toContainText('Online Shop')

    // Click should navigate to shop
    await shopButton.click()

    // Verify navigation to shop (might be external)
    await expect(page).toHaveURL(/shop|store/)
  })

  test('should display and navigate through image gallery', async ({
    page,
  }) => {
    // Navigate to about page where gallery might be
    await page.goto('/about')

    // Check if gallery exists
    const gallery = page.locator('[data-testid="image-gallery"]')
    const galleryCount = await gallery.count()

    if (galleryCount > 0) {
      await expect(gallery).toBeVisible()

      // Check gallery images
      const images = gallery.locator('[data-testid="gallery-image"]')
      const imageCount = await images.count()
      expect(imageCount).toBeGreaterThan(0)

      // Click on first image to open lightbox
      await images.first().click()

      // Verify lightbox opened
      const lightbox = page.locator('[data-testid="lightbox"]')
      await expect(lightbox).toBeVisible()

      // Navigate to next image
      await page.click('[data-testid="lightbox-next"]')

      // Close lightbox
      await page.click('[data-testid="lightbox-close"]')
      await expect(lightbox).toBeHidden()
    }
  })

  test('should handle 404 pages gracefully', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/non-existent-page-12345')

    // Should show 404 page
    await expect(page.locator('h1')).toContainText('404')
    await expect(page.locator('[data-testid="404-message"]')).toContainText(
      'Seite nicht gefunden'
    )

    // Should have link to home
    await page.click('[data-testid="back-to-home"]')
    await expect(page).toHaveURL('/')
  })

  test('should load with proper SEO tags', async ({ page }) => {
    // Check meta tags
    const description = await page.getAttribute(
      'meta[name="description"]',
      'content'
    )
    expect(description).toContain('Bäckerei')

    // Check Open Graph tags
    const ogTitle = await page.getAttribute(
      'meta[property="og:title"]',
      'content'
    )
    expect(ogTitle).toContain('Bäckerei Heusser')

    const ogImage = await page.getAttribute(
      'meta[property="og:image"]',
      'content'
    )
    expect(ogImage).toBeTruthy()

    // Check structured data
    const structuredData = await page.locator(
      'script[type="application/ld+json"]'
    )
    const structuredDataCount = await structuredData.count()
    expect(structuredDataCount).toBeGreaterThan(0)
  })
})
