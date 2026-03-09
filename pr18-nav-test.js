const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://localhost:3333/', { waitUntil: 'networkidle' })

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map((e) => ({
        text: (e.textContent || '').trim(),
        href: e.href,
      }))
      .filter((l) => l.text)
  })

  console.log('Links found:', links.length)
  links.slice(0, 15).forEach((l) => console.log('  -', l.text, '->', l.href))

  await page.screenshot({
    path: '/home/bakery/develop/website/test-results/pr-18/round-1/08-navigation-detail.png',
    fullPage: false,
  })

  await browser.close()
})()
