/**
 * @fileoverview Lesbarkeit und Tippziele auf dem Handy.
 *
 * - Der Kartenhinweis (Zwei-Klick-Lösung für OpenStreetMap) war auf dem Handy
 *   in einen 300 px (Startseite) bzw. 400 px (Kontakt) hohen Rahmen gesperrt
 *   und wurde abgeschnitten - Knopf und Datenschutzhinweis lagen teils
 *   außerhalb. Jetzt wächst er mit seinem Inhalt.
 * - Telefon, WhatsApp und E-Mail auf /contact und alle Links im Footer sind
 *   mindestens 44 px hohe Tippziele.
 *
 * Nur im Mobilprofil (Pixel 5): auf dem Desktop passt der Hinweis ohnehin.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

const NOTIZ = 'Ihre Entscheidung wird lokal in Ihrem Browser gespeichert.'
const MIN_TAP = 44

type Box = { x: number; y: number; width: number; height: number }

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  expect(b, 'Element hat keine Box').not.toBeNull()
  return b as Box
}

/** `inner` liegt vollständig in `outer` (halbe Pixel Rundung erlaubt). */
function expectInside(inner: Box, outer: Box, what: string) {
  const eps = 0.5
  expect(inner.x, `${what}: links`).toBeGreaterThanOrEqual(outer.x - eps)
  expect(inner.y, `${what}: oben`).toBeGreaterThanOrEqual(outer.y - eps)
  expect(inner.x + inner.width, `${what}: rechts`).toBeLessThanOrEqual(
    outer.x + outer.width + eps
  )
  expect(inner.y + inner.height, `${what}: unten`).toBeLessThanOrEqual(
    outer.y + outer.height + eps
  )
}

async function expectConsentComplete(page: Page) {
  const hinweis = page.getByRole('region', { name: 'Kartenhinweis' })
  await expect(hinweis).toBeVisible()
  await hinweis.scrollIntoViewIfNeeded()

  // Der Rahmen um den Hinweis schneidet ab (overflow: hidden), deshalb gegen
  // beide prüfen.
  const rahmen = hinweis.locator('xpath=..')
  const hinweisBox = await box(hinweis)
  const rahmenBox = await box(rahmen)

  for (const [what, el] of [
    ['Karte laden', hinweis.getByRole('button', { name: /Karte laden/ })],
    ['Hinweis', hinweis.getByText(NOTIZ)],
  ] as const) {
    await expect(el).toBeVisible()
    const b = await box(el)
    expectInside(b, hinweisBox, `${what} im Kartenhinweis`)
    expectInside(b, rahmenBox, `${what} im Kartenrahmen`)
  }
}

test.describe('Lesbarkeit auf dem Handy', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'Nur im Mobilprofil (Pixel 5).')
  })

  test('Kartenhinweis auf der Startseite ist vollständig', async ({ page }) => {
    await page.goto('/')
    await expectConsentComplete(page)
  })

  test('Kartenhinweis auf der Kontaktseite ist vollständig', async ({
    page,
  }) => {
    await page.goto('/contact')
    await expectConsentComplete(page)
  })

  test('Telefon, WhatsApp und E-Mail auf /contact sind große Tippziele', async ({
    page,
  }) => {
    await page.goto('/contact')
    const main = page.getByRole('main')

    for (const [name, href] of [
      [/^Telefon/, /^tel:/],
      [/^Mobil \/ WhatsApp/, /^tel:/],
      [/^E-Mail/, /^mailto:/],
    ] as const) {
      const link = main.getByRole('link', { name })
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute('href', href)
      const b = await box(link)
      expect(b.height, `${name} Höhe`).toBeGreaterThanOrEqual(MIN_TAP)
    }
  })

  test('Links im Footer sind mindestens 44 px hoch', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')
    await footer.scrollIntoViewIfNeeded()

    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(12)

    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const name =
        (await link.getAttribute('aria-label')) ?? (await link.innerText())
      const b = await box(link)
      expect(b.height, `Footer-Link „${name}“`).toBeGreaterThanOrEqual(MIN_TAP)
    }
  })
})
