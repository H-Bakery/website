// Quick browser check of a bakery-dev instance: node lib/check.cjs <instanceDir>
// Fahrer-App login as verify.fahrer (own tour), management login as inhaber + /admin/rest.
const { chromium } = require(require('path').join(
  process.env.TREE || process.cwd(),
  'node_modules/playwright'
))
const path = require('path')
const I = process.argv[2]
const w = require(path.join(I, 'world.json'))
;(async () => {
  const browser = await chromium.launch()
  const out = {}
  if (w.second.kind === 'delivery') {
    const page = await (
      await browser.newContext({ viewport: { width: 390, height: 900 } })
    ).newPage()
    const errs = []
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
    await page.goto(w.second.url + '/')
    await page.fill('#login-username', w.users.fahrer.username)
    await page.fill('#login-password', w.users.fahrer.password)
    await page.click('button[type=submit]')
    await page.waitForSelector('text=Abmelden', { timeout: 15000 })
    await page.fill('input[type=date]', w.saturday)
    await page.waitForTimeout(3000)
    const body = await page.locator('body').innerText()
    out.delivery = {
      ownStop: body.includes('Testkundin Amsel'),
      foreignStop: body.includes('Testkunde Gimpel'),
      moersbach: body.includes('Mörsbach'),
      estimate: body.includes('geschätzt'),
      consoleErrors: errs.length,
    }
    await page.screenshot({
      path: path.join(I, 'shots', 'check-delivery-fahrer.png'),
      fullPage: true,
    })
  }
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage()
  await page.goto(w.web.login)
  await page.fill('input[autocomplete=username]', w.users.inhaber.username)
  await page.fill('input[type=password]', w.users.inhaber.password)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), {
    timeout: 20000,
  })
  await page.goto(w.web.rest)
  await page.waitForTimeout(3000)
  const restText = await page.locator('main, body').first().innerText()
  out.mgmt = {
    mode: w.mode,
    restUnavailable: restText.includes('Im Pilotbetrieb nicht verfügbar'),
    restHasCountList:
      /Rest am Abend/.test(restText) &&
      !restText.includes('Im Pilotbetrieb nicht verfügbar'),
  }
  await page.screenshot({
    path: path.join(I, 'shots', `check-rest-${w.mode}.png`),
    fullPage: true,
  })
  console.log(JSON.stringify(out))
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
