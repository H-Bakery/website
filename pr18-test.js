const { chromium } = require('playwright')

;(async () => {
  const screenshotDir =
    '/home/bakery/develop/website/test-results/pr-18/round-1'
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  const results = []

  // Test 1: Homepage loads
  try {
    await page.goto('http://localhost:3333/', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/01-homepage.png`,
      fullPage: false,
    })
    results.push({ test: 'Homepage loads', status: 'PASS' })
  } catch (e) {
    results.push({ test: 'Homepage loads', status: 'FAIL', error: e.message })
  }

  // Test 2: About page
  try {
    await page.goto('http://localhost:3333/about', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/02-about.png`,
      fullPage: false,
    })
    results.push({ test: 'About page loads', status: 'PASS' })
  } catch (e) {
    results.push({ test: 'About page loads', status: 'FAIL', error: e.message })
  }

  // Test 3: Products page
  try {
    await page.goto('http://localhost:3333/products', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/03-products.png`,
      fullPage: false,
    })
    results.push({ test: 'Products page loads', status: 'PASS' })
  } catch (e) {
    results.push({
      test: 'Products page loads',
      status: 'FAIL',
      error: e.message,
    })
  }

  // Test 4: News page
  try {
    await page.goto('http://localhost:3333/news', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/04-news.png`,
      fullPage: false,
    })
    results.push({ test: 'News page loads', status: 'PASS' })
  } catch (e) {
    results.push({ test: 'News page loads', status: 'FAIL', error: e.message })
  }

  // Test 5: Navigation works
  try {
    await page.goto('http://localhost:3333/', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    const navLinks = await page.$$('nav a, header a')
    results.push({
      test: 'Navigation links present',
      status: navLinks.length > 0 ? 'PASS' : 'FAIL',
      detail: `${navLinks.length} links found`,
    })
  } catch (e) {
    results.push({
      test: 'Navigation links present',
      status: 'FAIL',
      error: e.message,
    })
  }

  // Test 6: Mobile viewport
  try {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:3333/', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/05-mobile-homepage.png`,
      fullPage: false,
    })
    results.push({ test: 'Mobile viewport renders', status: 'PASS' })
  } catch (e) {
    results.push({
      test: 'Mobile viewport renders',
      status: 'FAIL',
      error: e.message,
    })
  }

  // Test 7: Imprint page
  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('http://localhost:3333/imprint', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/06-imprint.png`,
      fullPage: false,
    })
    results.push({ test: 'Imprint page loads', status: 'PASS' })
  } catch (e) {
    results.push({
      test: 'Imprint page loads',
      status: 'FAIL',
      error: e.message,
    })
  }

  // Test 8: Contact page
  try {
    await page.goto('http://localhost:3333/contact', {
      waitUntil: 'networkidle',
      timeout: 15000,
    })
    await page.screenshot({
      path: `${screenshotDir}/07-contact.png`,
      fullPage: false,
    })
    results.push({ test: 'Contact page loads', status: 'PASS' })
  } catch (e) {
    results.push({
      test: 'Contact page loads',
      status: 'FAIL',
      error: e.message,
    })
  }

  await browser.close()

  console.log('\n=== PLAYWRIGHT TEST RESULTS ===')
  results.forEach((r) => {
    console.log(
      `${r.status === 'PASS' ? '✅' : '❌'} ${r.test}${
        r.detail ? ` (${r.detail})` : ''
      }${r.error ? ` — ${r.error}` : ''}`
    )
  })
  console.log(`\nConsole errors: ${errors.length}`)
  if (errors.length > 0) {
    errors.forEach((e) => console.log(`  ⚠ ${e}`))
  }
  console.log(`\nScreenshots saved to: ${screenshotDir}`)
  const passed = results.filter((r) => r.status === 'PASS').length
  console.log(`\nTotal: ${passed}/${results.length} passed`)
})()
