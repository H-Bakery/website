/**
 * @fileoverview Die Digitale Bäckerei, wie sie ausgeliefert wird: statischer
 * Export unter `/digitale-baeckerei`, mit dem synthetischen Mini-Modell
 * (`apps/bakery-digitale-baeckerei/src/test/fixtures/`). Diese Datei prüft das
 * Laden - alles hier trägt schon der Stand P0.
 */
import { expect, test } from '@playwright/test'
import {
  PFAD,
  VARIANTE,
  erwarteKeinePreise,
  oeffne,
  ohneWebGL,
  protokolliere,
} from './support/app'

test.describe('Laden unter dem Unterpfad', () => {
  test('lädt ohne Konsolenfehler und ohne fehlende Dateien', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)
    // Nachzügler (Icon, nachgeladene Chunks) abwarten.
    await page.waitForLoadState('networkidle')

    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.antworten).toEqual([])

    await expect(page).toHaveTitle(/Digitale Bäckerei/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Digitale Bäckerei' })
    ).toBeVisible()
  })

  test('holt alles vom eigenen Ursprung und aus dem Unterpfad', async ({
    page,
    baseURL,
  }) => {
    const protokoll = await oeffne(page)
    await page.waitForLoadState('networkidle')

    const fremd = protokoll.anfragen.filter(
      (url) => !url.startsWith(`${baseURL}${PFAD}`)
    )
    // Kein Tracking, keine Fremd-Fonts, nichts neben dem Unterpfad.
    expect(fremd).toEqual([])
    expect(protokoll.anfragen).toContain(`${baseURL}${PFAD}model/twin.glb`)
    expect(await page.context().cookies()).toEqual([])
  })

  test('zeigt die Szene: das Canvas ist nicht leer', async ({ page }) => {
    await oeffne(page)

    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(
      page.getByRole('img', { name: /3D-Ansicht der Bäckerei/ })
    ).toBeVisible()

    const stats = await page.evaluate(() =>
      window.__digitaleBaeckerei?.pixelStats()
    )
    // Ein Raster von Messpunkten: viele verschiedene Farben, kaum Hintergrund.
    expect(stats?.distinct).toBeGreaterThan(10)
    expect(stats?.backgroundShare).toBeLessThan(0.5)
  })

  test('zeigt nur die Auslage vom Morgen', async ({ page }) => {
    await oeffne(page)

    const plaetze = await page.evaluate(
      () => window.__digitaleBaeckerei?.nodes('produkt/') ?? []
    )
    const platz = plaetze.filter((n) =>
      n.name.startsWith(`produkt/${VARIANTE.slot}`)
    )
    expect(platz.map((n) => ({ name: n.name, visible: n.visible }))).toEqual([
      { name: `produkt/${VARIANTE.slot}`, visible: true },
      { name: `produkt/${VARIANTE.slot}@feierabend`, visible: false },
    ])
    // Sonst ist jeder Platz zu sehen, und kein Platz ist doppelt belegt.
    expect(plaetze.filter((n) => !n.visible)).toHaveLength(1)
    const fill = await page.evaluate(
      () => window.__digitaleBaeckerei?.info().fill
    )
    expect(fill?.doubled).toEqual([])
  })

  test('bleibt vorerst aus dem Suchindex', async ({ page }) => {
    await oeffne(page)

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /nofollow/
    )
  })

  test('nennt nirgends einen Preis', async ({ page }) => {
    await oeffne(page)
    await erwarteKeinePreise(page)
  })

  test('hat den Messhaken nur mit ?debug', async ({ page }) => {
    await page.goto(PFAD)
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    expect(await page.evaluate(() => '__digitaleBaeckerei' in window)).toBe(
      false
    )
  })
})

test.describe('Ohne WebGL', () => {
  test('stürzt nicht ab und sagt, dass es kein 3D gibt', async ({ page }) => {
    await ohneWebGL(page)
    const protokoll = protokolliere(page)
    await page.goto(PFAD)

    await expect(page.locator('main[data-zustand="kein-webgl"]')).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Digitale Bäckerei' })
    ).toBeVisible()
    // three meldet den fehlenden Kontext in der Konsole - das ist in Ordnung.
    // Eine unbehandelte Ausnahme wäre es nicht.
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
    await erwarteKeinePreise(page)
  })
})
