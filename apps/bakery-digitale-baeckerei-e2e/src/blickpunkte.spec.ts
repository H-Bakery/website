/**
 * @fileoverview Blickpunkte wechseln: Chips „Theke“ · „Brotregal“ · „Regale“,
 * Pfeiltasten, und der Schnitt statt der Fahrt bei `prefers-reduced-motion`.
 *
 * Was die Suite dafür von der App erwartet, steht im Kopf von
 * `support/app.ts`.
 */
import { expect, test } from '@playwright/test'
import {
  BLICKPUNKTE,
  bilder,
  blickpunktKnopf,
  oeffne,
  ruhe,
  szene,
  wechsleZu,
} from './support/app'

test.describe('Blickpunkte', () => {
  test('startet an der Theke und bietet alle drei Blickpunkte an', async ({
    page,
  }) => {
    await oeffne(page)

    await expect(szene(page, 'Theke')).toBeVisible()
    for (const { name } of BLICKPUNKTE) {
      const knopf = blickpunktKnopf(page, name)
      await expect(knopf).toBeVisible()
      // Daumenreichweite: Ziel mindestens 44 px, in der unteren Bildhälfte.
      const box = await knopf.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.y).toBeGreaterThan((page.viewportSize()?.height ?? 0) / 2)
    }
  })

  test('wechselt über die Chips und zeigt dort wieder ein Bild', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)

    for (const name of ['Brotregal', 'Regale', 'Theke']) {
      // wechsleZu wartet, bis die Fahrt ausgeklungen ist.
      await wechsleZu(page, name)
      const stats = await page.evaluate(() =>
        window.__digitaleBaeckerei?.pixelStats()
      )
      expect(stats?.distinct, `Bild am Blickpunkt ${name}`).toBeGreaterThan(10)
    }
    // Ein Wechsel lädt das Modell nicht neu und wirft nichts.
    expect(
      protokoll.anfragen.filter((url) => url.endsWith('/model/twin.glb'))
    ).toHaveLength(1)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.konsole).toEqual([])
  })

  test('wechselt mit den Pfeiltasten', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pfeiltasten gibt es am Desktop.')
    await oeffne(page)

    await page.keyboard.press('ArrowRight')
    await expect(szene(page, 'Brotregal')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(szene(page, 'Regale')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(szene(page, 'Brotregal')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(szene(page, 'Theke')).toBeVisible()
  })

  test('schneidet statt zu gleiten, wenn Bewegung reduziert sein soll', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page)
    // Ruhe abwarten: gerendert wird nur bei Bedarf.
    await ruhe(page)
    const vorher = await bilder(page)

    await wechsleZu(page, 'Brotregal')

    // Eine Fahrt von 0,8 s zeichnet viele Bilder, ein Schnitt eine Handvoll.
    const gezeichnet = (await bilder(page)) - vorher
    expect(gezeichnet).toBeGreaterThanOrEqual(1)
    expect(gezeichnet).toBeLessThanOrEqual(6)
  })
})
