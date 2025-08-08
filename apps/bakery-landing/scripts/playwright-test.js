#!/usr/bin/env node

/**
 * Automated Playwright Test Script (JavaScript version)
 * Runs frontend health checks and generates reports
 */

const { chromium } = require('playwright')
const fs = require('fs').promises
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200'
const SCREENSHOT_DIR = path.join(__dirname, '../test-results/screenshots')
const REPORT_DIR = path.join(__dirname, '../test-results')

// Viewport configurations
const VIEWPORTS = {
  DESKTOP_DEFAULT: { width: 1280, height: 720 },
  MOBILE_DEFAULT: { width: 375, height: 667 },
  TABLET_DEFAULT: { width: 768, height: 1024 },
}

// Claude-safe viewport helper
function getClaudeSafeViewport(viewport) {
  const CLAUDE_MAX_DIMENSION = 8000
  const maxDimension = Math.max(viewport.width, viewport.height)
  if (maxDimension > CLAUDE_MAX_DIMENSION) {
    const scale = CLAUDE_MAX_DIMENSION / maxDimension
    return {
      width: Math.floor(viewport.width * scale),
      height: Math.floor(viewport.height * scale),
    }
  }
  return viewport
}

// Take Claude-safe screenshot
async function takeClaudeSafeScreenshot(page, filename) {
  await page.screenshot({
    path: filename,
    type: 'jpeg',
    quality: 80,
    fullPage: false,
  })
}

class FrontendTester {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null
    this.results = []
    this.consoleMessages = []
    this.networkRequests = []
  }

  async setup() {
    // Create directories
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
    await fs.mkdir(REPORT_DIR, { recursive: true })

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    this.context = await this.browser.newContext({
      viewport: getClaudeSafeViewport(VIEWPORTS.DESKTOP_DEFAULT),
      ignoreHTTPSErrors: true,
    })

    this.page = await this.context.newPage()

    // Set up event listeners
    this.setupEventListeners()
  }

  setupEventListeners() {
    if (!this.page) return

    // Console messages
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url,
      })
    })

    // Network requests
    this.page.on('request', (request) => {
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
      })
    })

    this.page.on('response', (response) => {
      const request = this.networkRequests.find(
        (r) => r.url === response.url() && !r.status
      )
      if (request) {
        request.status = response.status()
        request.duration = response.request().timing().responseEnd
      }
    })

    this.page.on('requestfailed', (request) => {
      const req = this.networkRequests.find(
        (r) => r.url === request.url() && !r.failed
      )
      if (req) {
        req.failed = true
        req.failureReason = request.failure()?.errorText
      }
    })
  }

  async runTest(name, testFn) {
    const startTime = Date.now()
    const result = {
      name,
      status: 'passed',
      duration: 0,
    }

    try {
      await testFn()
      console.log(`✅ ${name}`)
    } catch (error) {
      result.status = 'failed'
      result.error = error.message
      console.log(`❌ ${name}: ${result.error}`)

      // Take screenshot on failure
      if (this.page) {
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${name.replace(/\s+/g, '-')}-failure.jpg`
        )
        await takeClaudeSafeScreenshot(this.page, screenshotPath)
        result.screenshot = screenshotPath
      }
    }

    result.duration = Date.now() - startTime
    this.results.push(result)
    return result
  }

  async runAllTests() {
    if (!this.page) throw new Error('Page not initialized')

    console.log('🧪 Running Frontend Health Tests...\n')

    // Test 1: Page loads successfully
    await this.runTest('Page loads without errors', async () => {
      const response = await this.page.goto(BASE_URL, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })

      if (!response || response.status() >= 400) {
        throw new Error(`Page returned status ${response?.status()}`)
      }

      // Check for critical console errors
      const errors = this.consoleMessages.filter(
        (m) =>
          m.type === 'error' &&
          !m.text.includes('Map container is already initialized')
      )
      if (errors.length > 0) {
        throw new Error(
          `Console errors found: ${errors.map((e) => e.text).join(', ')}`
        )
      }
    })

    // Test 2: Critical elements are visible
    await this.runTest('Critical elements are visible', async () => {
      const criticalSelectors = [
        'text=Handwerkliche Backkunst',
        'text=Unser Sortiment',
        'text=Öffnungszeiten',
      ]

      for (const selector of criticalSelectors) {
        const element = this.page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 5000 })
      }
    })

    // Test 3: Navigation works
    await this.runTest('Navigation links are functional', async () => {
      const navLinks = await this.page.locator('nav a, header a').all()

      if (navLinks.length === 0) {
        throw new Error('No navigation links found')
      }

      // Check at least one link has proper href
      let validLinks = 0
      for (const link of navLinks) {
        const href = await link.getAttribute('href')
        if (href && href !== '#') {
          validLinks++
        }
      }

      if (validLinks === 0) {
        throw new Error('No valid navigation links found')
      }
    })

    // Test 4: Images load successfully
    await this.runTest('Images load successfully', async () => {
      await this.page.waitForLoadState('networkidle')

      const images = await this.page.locator('img').all()
      const brokenImages = []

      for (const img of images) {
        const src = await img.getAttribute('src')
        if (!src || src.startsWith('data:')) continue

        const isLoaded = await img.evaluate((el) => {
          return el.complete && el.naturalWidth > 0
        })

        if (!isLoaded && !src.includes('external')) {
          brokenImages.push(src)
        }
      }

      if (brokenImages.length > 0) {
        throw new Error(`Broken images: ${brokenImages.join(', ')}`)
      }
    })

    // Test 5: Responsive design
    await this.runTest('Responsive design works', async () => {
      // Test mobile viewport
      await this.page.setViewportSize(
        getClaudeSafeViewport(VIEWPORTS.MOBILE_DEFAULT)
      )
      await this.page.waitForTimeout(500)

      // Take mobile screenshot
      await takeClaudeSafeScreenshot(
        this.page,
        path.join(SCREENSHOT_DIR, 'mobile-view.jpg')
      )

      // Test tablet viewport
      await this.page.setViewportSize(
        getClaudeSafeViewport(VIEWPORTS.TABLET_DEFAULT)
      )
      await this.page.waitForTimeout(500)

      // Take tablet screenshot
      await takeClaudeSafeScreenshot(
        this.page,
        path.join(SCREENSHOT_DIR, 'tablet-view.jpg')
      )

      // Reset to desktop
      await this.page.setViewportSize(
        getClaudeSafeViewport(VIEWPORTS.DESKTOP_DEFAULT)
      )
    })

    // Test 6: Performance metrics
    await this.runTest('Performance metrics are acceptable', async () => {
      const metrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0]
        return {
          domContentLoaded:
            navigation.domContentLoadedEventEnd -
            navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        }
      })

      if (metrics.domContentLoaded > 3000) {
        throw new Error(
          `DOM content loaded too slowly: ${metrics.domContentLoaded}ms`
        )
      }
    })

    // Test 7: Accessibility basics
    await this.runTest('Basic accessibility checks', async () => {
      // Check for h1
      const h1Count = await this.page.locator('h1').count()
      if (h1Count === 0) {
        throw new Error('No h1 heading found')
      }

      // Check for alt text on images
      const imagesWithoutAlt = await this.page
        .locator('img:not([alt]):not([aria-label]):not([role="presentation"])')
        .count()
      if (imagesWithoutAlt > 0) {
        throw new Error(`${imagesWithoutAlt} images without alt text`)
      }
    })

    // Take final screenshots
    await this.takeScreenshots()
  }

  async takeScreenshots() {
    if (!this.page) return

    console.log('\n📸 Taking screenshots...')

    // Full page sections
    const sections = [
      { name: 'hero', selector: 'main > div:first-child' },
      { name: 'features', selector: 'text=Warum unsere Kunden uns vertrauen' },
      { name: 'products', selector: 'text=Schnellbestellung' },
      { name: 'footer', selector: 'footer' },
    ]

    for (const section of sections) {
      try {
        const element = this.page.locator(section.selector).first()
        if (await element.isVisible()) {
          await element.scrollIntoViewIfNeeded()
          await this.page.waitForTimeout(500)

          await takeClaudeSafeScreenshot(
            this.page,
            path.join(SCREENSHOT_DIR, `section-${section.name}.jpg`)
          )
        }
      } catch (error) {
        console.log(`⚠️  Could not screenshot ${section.name}`)
      }
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: BASE_URL,
      summary: {
        total: this.results.length,
        passed: this.results.filter((r) => r.status === 'passed').length,
        failed: this.results.filter((r) => r.status === 'failed').length,
        duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      },
      results: this.results,
      console: {
        total: this.consoleMessages.length,
        errors: this.consoleMessages.filter((m) => m.type === 'error').length,
        warnings: this.consoleMessages.filter((m) => m.type === 'warning')
          .length,
        messages: this.consoleMessages,
      },
      network: {
        total: this.networkRequests.length,
        failed: this.networkRequests.filter((r) => r.failed).length,
        requests: this.networkRequests,
      },
    }

    // Save report
    const reportPath = path.join(REPORT_DIR, 'test-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    // Generate summary
    console.log('\n📊 Test Summary:')
    console.log(`   Total Tests: ${report.summary.total}`)
    console.log(`   ✅ Passed: ${report.summary.passed}`)
    console.log(`   ❌ Failed: ${report.summary.failed}`)
    console.log(`   ⏱️  Duration: ${report.summary.duration}ms`)
    console.log(`   📁 Report saved to: ${reportPath}`)

    return report
  }

  async cleanup() {
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
  }
}

// Main execution
async function main() {
  const tester = new FrontendTester()

  try {
    await tester.setup()
    await tester.runAllTests()
    const report = await tester.generateReport()

    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  } finally {
    await tester.cleanup()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { FrontendTester }
