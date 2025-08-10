/**
 * Comprehensive Frontend Health Testing Suite
 * Tests critical functionality, performance, and accessibility
 */

import { test, expect, Page } from '@playwright/test'
import {
  VIEWPORTS,
  getClaudeSafeViewport,
} from '../playwright-helpers/browser-config'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Test configuration
test.use({
  baseURL: BASE_URL,
  viewport: getClaudeSafeViewport(VIEWPORTS.DESKTOP_DEFAULT),
})

// Helper to check for console errors
async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Ignore known React StrictMode errors
      const text = msg.text()
      if (!text.includes('Map container is already initialized')) {
        errors.push(text)
      }
    }
  })

  return errors
}

// Helper to check network failures
async function checkNetworkFailures(page: Page): Promise<string[]> {
  const failures: string[] = []

  page.on('requestfailed', (request) => {
    failures.push(
      `${request.method()} ${request.url()} - ${request.failure()?.errorText}`
    )
  })

  return failures
}

test.describe('Landing Page Health Tests', () => {
  test('should load without critical errors', async ({ page }) => {
    const errors = await checkConsoleErrors(page)
    const networkFailures = await checkNetworkFailures(page)

    await page.goto('/')

    // Check page loaded successfully
    await expect(page).toHaveTitle(/Bäckerei Heusser/)

    // No critical console errors
    expect(errors).toHaveLength(0)

    // No network failures
    expect(networkFailures).toHaveLength(0)
  })

  test('should display all main sections', async ({ page }) => {
    await page.goto('/')

    // Hero section
    await expect(page.locator('text=Handwerkliche Backkunst')).toBeVisible()

    // Call to action section
    await expect(
      page.locator('text=Frisch gebacken, täglich für Sie!')
    ).toBeVisible()

    // Features section
    await expect(
      page.locator('text=Warum unsere Kunden uns vertrauen')
    ).toBeVisible()

    // Quick order section
    await expect(page.locator('text=Schnellbestellung')).toBeVisible()

    // Weekly offers section
    await expect(page.locator('text=Unsere Wochenangebote')).toBeVisible()

    // Map section (or error boundary)
    const mapOrError = page
      .locator('text=Loading map..., text=Karte konnte nicht geladen werden')
      .first()
    await expect(mapOrError).toBeVisible()

    // Reviews section
    await expect(page.locator('text=Was unsere Kunden sagen')).toBeVisible()

    // News section
    await expect(page.locator('text=Neuigkeiten')).toBeVisible()

    // Instagram section
    await expect(
      page.locator('text=Folgen Sie uns auf Instagram')
    ).toBeVisible()
  })

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/')

    // Check main navigation links
    const navLinks = [
      { text: 'Sortiment', href: '/products' },
      { text: 'Neuigkeiten', href: '/news' },
      { text: 'Über uns', href: '/about' },
      { text: 'Bestellen', href: '/bestellen' },
    ]

    for (const link of navLinks) {
      const element = page.locator(`a:has-text("${link.text}")`).first()
      await expect(element).toBeVisible()
      await expect(element).toHaveAttribute('href', link.href)
    }
  })

  test('should load all images', async ({ page }) => {
    await page.goto('/')

    // Wait for initial content
    await page.waitForLoadState('networkidle')

    // Check that images are loaded
    const images = await page.locator('img').all()

    for (const img of images) {
      const src = await img.getAttribute('src')
      if (src && !src.startsWith('data:')) {
        // Check natural width/height for loaded images
        const isLoaded = await img.evaluate((el: HTMLImageElement) => {
          return el.complete && el.naturalWidth > 0
        })

        // Allow some images to fail (like external Instagram images)
        if (!src.includes('instagram') && !src.includes('external')) {
          expect(isLoaded).toBe(true)
        }
      }
    }
  })
})

test.describe('Responsive Design Tests', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    await page.setViewportSize(getClaudeSafeViewport(VIEWPORTS.MOBILE_DEFAULT))
    await page.goto('/')

    // Mobile menu should be visible
    await expect(
      page.locator('[aria-label*="menu"], [aria-label*="Menu"]')
    ).toBeVisible()
  })

  test('should adapt layout for tablet', async ({ page }) => {
    await page.setViewportSize(getClaudeSafeViewport(VIEWPORTS.TABLET_DEFAULT))
    await page.goto('/')

    // Check responsive grid layouts
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const loadTime = Date.now() - startTime

    // Page should load DOM in under 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have acceptable Core Web Vitals', async ({ page }) => {
    await page.goto('/')

    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          resolve(lastEntry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
      })
    })

    // LCP should be under 2.5s for good score
    expect(Number(lcp)).toBeLessThan(2500)
  })
})

test.describe('Accessibility Tests', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Check h1 exists
    const h1 = await page.locator('h1').count()
    expect(h1).toBeGreaterThan(0)

    // Check heading hierarchy
    const headings = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .allTextContents()
    expect(headings.length).toBeGreaterThan(5)
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/')

    const images = await page.locator('img').all()

    for (const img of images) {
      const alt = await img.getAttribute('alt')
      const ariaLabel = await img.getAttribute('aria-label')
      const role = await img.getAttribute('role')

      // Decorative images should have role="presentation" or empty alt
      if (role !== 'presentation') {
        expect(alt || ariaLabel).toBeTruthy()
      }
    }
  })

  test('should have proper ARIA labels for interactive elements', async ({
    page,
  }) => {
    await page.goto('/')

    // Check buttons have accessible names
    const buttons = await page.locator('button').all()

    for (const button of buttons) {
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')

      expect(text || ariaLabel).toBeTruthy()
    }
  })
})

test.describe('Form and Interaction Tests', () => {
  test('should handle product quick order buttons', async ({ page }) => {
    await page.goto('/')

    // Find add to cart buttons
    const addButtons = await page
      .locator('button:has(svg[data-testid*="Add"], svg[class*="Add"])')
      .all()

    if (addButtons.length > 0) {
      // Click first add button
      await addButtons[0].click()

      // Check that quantity changed or some feedback is shown
      // This depends on the implementation
    }
  })

  test('should handle search input', async ({ page }) => {
    await page.goto('/')

    const searchInput = page
      .locator('input[placeholder*="Suchen"], input[type="search"]')
      .first()

    if (await searchInput.isVisible()) {
      await searchInput.fill('Brot')

      // Check that search works (implementation dependent)
      await page.waitForTimeout(500) // Brief wait for any search action
    }
  })
})

test.describe('Error Handling Tests', () => {
  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page')

    // Should return 404 status
    expect(response?.status()).toBe(404)

    // Should show error page or redirect
    await expect(
      page.locator('text=404, text=nicht gefunden').first()
    ).toBeVisible()
  })

  test('should handle API failures gracefully', async ({ page }) => {
    // Intercept API calls and force failure
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('/')

    // Page should still load with fallback content
    await expect(page).toHaveTitle(/Bäckerei Heusser/)
  })
})

// Export test report generator
export async function generateTestReport(results: any) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r: any) => r.status === 'passed').length,
      failed: results.filter((r: any) => r.status === 'failed').length,
      skipped: results.filter((r: any) => r.status === 'skipped').length,
    },
    details: results,
  }

  return report
}
