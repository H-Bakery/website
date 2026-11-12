/**
 * @fileoverview Ersatz ohne WebGL: dieselben Listen wie „Alles hier“, für alle
 * Blickpunkte - auch der Weg für Screenreader. (Dass die Seite ohne WebGL
 * nicht abstürzt, prüft schon `laden.spec.ts`.)
 */
import { expect, test } from '@playwright/test'
import {
  BLICKPUNKTE,
  PFAD,
  PREIS,
  WAISE,
  erwarteKeinePreise,
  erwarteteEintraege,
  ohneWebGL,
  protokolliere,
} from './support/app'

test.describe('Ohne WebGL: Produktlisten statt 3D', () => {
  // FIXME(P1-Integration): braucht die Komponente OhneWebGL (data-testid
  // „ohne-webgl“) mit den Listen je Blickpunkt. P0 zeigt nur einen Hinweis.
  // Nach der Integration diese Zeile löschen.
  test.fixme(true, 'P1-Integration: OhneWebGL fehlt noch')

  test('zeigt je Blickpunkt die Produkte aus dem Snapshot', async ({
    page,
  }) => {
    await ohneWebGL(page)
    const protokoll = protokolliere(page)
    await page.goto(PFAD)

    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)

    for (const blickpunkt of BLICKPUNKTE) {
      await expect(
        ersatz.getByRole('heading', { name: blickpunkt.name })
      ).toBeVisible()
      for (const eintrag of erwarteteEintraege([...blickpunkt.moebel])) {
        await expect(
          ersatz.getByText(eintrag.name, { exact: true }).first()
        ).toBeVisible()
      }
    }
    await expect(ersatz.getByText(WAISE.produkt)).toHaveCount(0)
    await expect(ersatz).not.toContainText(PREIS)
    await erwarteKeinePreise(page)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
  })
})
