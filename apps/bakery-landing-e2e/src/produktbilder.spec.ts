/**
 * @fileoverview Aus den 3D-Modellen gerenderte Produktbilder (DB13).
 *
 * Läuft nur gegen einen Export, der mit `LANDING_PRODUKTBILDER_FIXTURE=1` und
 * dem erfundenen Katalog `tools/e2e/hq-products` gebaut wurde - dann liegen
 * synthetische Bilder für „Musterbrot Hell 500g“ und „Musterbrezel“ im Export.
 * Der gewöhnliche Export (ohne hq, ohne Daten-Repo - das, was nach GitHub
 * Pages geht) hat keine Bilder; dort ist diese Datei übersprungen, und
 * `landing-smoke.spec.ts` prüft die Seite.
 *
 * Lokal:
 *   HQ_PRODUCTS_DIR=$PWD/tools/e2e/hq-products LANDING_PRODUKTBILDER_FIXTURE=1 \
 *     npx nx build bakery-landing --skip-nx-cache
 *   LANDING_PRODUKTBILDER_FIXTURE=1 E2E_BUILT=1 npx nx e2e bakery-landing-e2e --grep=Produktbilder
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXTURE = process.env['LANDING_PRODUKTBILDER_FIXTURE'] === '1'

/** Musterbrot Hell 500g (numeric_id 3) hat ein Bild, Kornbrot 500g (1) nicht. */
const MIT_BILD = { id: 3, name: 'Musterbrot Hell 500g' }
const OHNE_BILD = { id: 1, name: 'Kornbrot 500g' }
const HINWEIS = 'Digitale Darstellung – kein Foto'

function bild(page: Page, name: string): Locator {
  return page.locator(`img[data-rendered-image][alt="${name}"]`)
}

async function geladen(img: Locator) {
  await expect
    .poll(() =>
      img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)
    )
    .toBe(true)
}

const groesse = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })

for (const [geraet, viewport, rahmenHoehe] of [
  // Rahmen der Produktseite: 250 px hoch mit 24 px Innenabstand, ab 900 px
  // Breite 450 px mit 48 px.
  ['Handy 390 px', { width: 390, height: 844 }, 202],
  ['Desktop', { width: 1280, height: 900 }, 354],
] as const) {
  test.describe(`Produktbilder – ${geraet}`, () => {
    test.skip(
      !FIXTURE,
      'Braucht den Export mit LANDING_PRODUKTBILDER_FIXTURE=1 - siehe Kopf der Datei.'
    )
    test.use({ viewport })

    test('Produktseite zeigt das Bild in den Maßen des Rahmens, mit Hinweis', async ({
      page,
    }) => {
      await page.goto(`/products/${MIT_BILD.id}`)

      const img = bild(page, MIT_BILD.name).first()
      await expect(img).toBeVisible()
      await geladen(img)

      // Eigenmaße und beide Varianten stehen im Markup.
      await expect(img).toHaveAttribute('width', '800')
      await expect(img).toHaveAttribute('height', '800')
      await expect(img).toHaveAttribute(
        'srcset',
        /haupt-400\.webp 400w, .*haupt-800\.webp 800w/
      )
      // Über der Falz: nicht lazy.
      await expect(img).toHaveAttribute('loading', 'eager')
      expect(
        await img.evaluate((el: HTMLImageElement) => el.currentSrc)
      ).toMatch(
        /\/produkte-3d\/bilder\/musterbrot-hell-500g\/haupt-(400|800)\.webp$/
      )

      // Gezeigt in den Maßen des Rahmens, nicht breiter als die Seite.
      const box = await groesse(img)
      expect(Math.round(box.height)).toBe(rahmenHoehe)
      expect(box.width).toBeGreaterThan(200)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(viewport.width)

      await expect(page.getByText(HINWEIS)).toBeVisible()
    })

    test('das Bild verschiebt beim Laden nichts', async ({ page }) => {
      // Die Bilddateien zurückhalten, die Seite vorher und nachher vermessen.
      let freigeben: () => void = () => undefined
      const frei = new Promise<void>((resolve) => (freigeben = resolve))
      await page.route('**/produkte-3d/bilder/**', async (route) => {
        await frei
        await route.continue()
      })
      await page.goto(`/products/${MIT_BILD.id}`, {
        waitUntil: 'domcontentloaded',
      })
      const img = bild(page, MIT_BILD.name).first()
      const hinweis = page.getByText(HINWEIS)
      await expect(hinweis).toBeVisible()
      expect(
        await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      ).toBe(0)

      // Größe des Bildes und Abstand des Hinweises darunter - relativ
      // zueinander, damit nachladende Schriften im Kopf der Seite nicht
      // mitgemessen werden.
      const messen = async () => {
        const b = await groesse(img)
        const h = await groesse(hinweis)
        return {
          breite: Math.round(b.width),
          hoehe: Math.round(b.height),
          hinweisDarunter: Math.round(h.y - b.y),
        }
      }
      const vorher = await messen()
      expect(vorher.hoehe).toBe(rahmenHoehe)

      freigeben()
      await geladen(img)
      const nachher = await messen()
      expect(nachher.breite).toBe(vorher.breite)
      expect(nachher.hoehe).toBe(vorher.hoehe)
      // Ein Pixel Spiel: Der Abstand ist aus zwei gerundeten Lagen gebildet,
      // und eine nachladende Schrift verschiebt beide um Bruchteile.
      expect(
        Math.abs(nachher.hinweisDarunter - vorher.hinweisDarunter)
      ).toBeLessThanOrEqual(1)
    })

    test('die Link-Vorschau nimmt das allgemeine Bild, kein transparentes WebP', async ({
      page,
    }) => {
      await page.goto(`/products/${MIT_BILD.id}`)
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /\/og-image\.jpg$/
      )
    })

    test('ein Produkt ohne Bild bleibt, wie es war - ohne Hinweis', async ({
      page,
    }) => {
      await page.goto(`/products/${OHNE_BILD.id}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        OHNE_BILD.name
      )
      await expect(bild(page, OHNE_BILD.name)).toHaveCount(0)
      await expect(page.getByText(HINWEIS)).toHaveCount(0)
    })

    test('Sortiment zeigt das Bild in der Karte, nachgeladen', async ({
      page,
    }) => {
      await page.goto('/products')
      const img = bild(page, MIT_BILD.name).first()
      await expect(img).toHaveAttribute('loading', 'lazy')
      await img.scrollIntoViewIfNeeded()
      await geladen(img)
      const box = await groesse(img)
      // Der Bildrahmen der Karte ist 200 px hoch.
      expect(Math.round(box.height)).toBe(200)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    })

    test('Startseite zeigt das Bild bei den ausgewählten Produkten', async ({
      page,
    }) => {
      await page.goto('/')
      const img = bild(page, 'Musterbrezel').first()
      await img.scrollIntoViewIfNeeded()
      await geladen(img)
      await expect(img).toHaveAttribute('srcset', /400w.*800w/)
      const box = await groesse(img)
      expect(box.width).toBeGreaterThan(100)
      expect(box.height).toBeGreaterThan(100)
    })
  })
}
