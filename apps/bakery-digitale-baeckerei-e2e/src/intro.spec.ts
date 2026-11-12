/**
 * @fileoverview Der Flug zum Start („Von der Straße zur Theke“) und der
 * Zähler „entdeckt“ - am synthetischen Mini-Modell: Dessen Wand zur Straße
 * hat eine offene Tür, durch die der Weg aus `raeume.ts` führt.
 *
 * Alle anderen Dateien der Suite öffnen mit `?intro=0` (`oeffne()`), nur
 * diese lässt den Flug laufen.
 */
import { expect, test, type Page } from '@playwright/test'
// Blickpunkte und ihre Rechnung gehören zur App (dort prüft sie jest); die
// Suite liest sie nur.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
} from '../../bakery-digitale-baeckerei/src/config/raeume'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ansichtFuer } from '../../bakery-digitale-baeckerei/src/lib/scene/view'
import {
  allesHierListe,
  bilder,
  erwarteKeinePreise,
  oeffne,
  produktSheet,
  ruhe,
  szene,
  tippeAufPlatz,
  wechsleZu,
} from './support/app'

const raum = findeRaum(START_RAUM_ID)
const theke = raum && findeBlickpunkt(raum, 'theke')
if (!theke) throw new Error('Blickpunkt Theke fehlt in raeume.ts')

const KEKSE = 'theke/vitrine/ebene-3/platz-01'

/**
 * Steht die Kamera draußen? Der Verkaufsraum des Mini-Modells reicht bis
 * x = 6,84 (Wand zur Straße) und z = 1,91.
 */
const draussen = (eye: number[]) => eye[0] > 6.9 || eye[2] > 2

const info = (page: Page) =>
  page.evaluate(() => {
    const haken = window.__digitaleBaeckerei
    if (!haken) throw new Error('Messhaken fehlt')
    return haken.info()
  })

const ueberspringen = (page: Page) =>
  page.getByRole('button', { name: 'Überspringen' })
const flug = (page: Page) =>
  page.getByRole('img', { name: /Flug von der Straße zur Theke/ })
const leiste = (page: Page) => page.getByTestId('blickpunkt-leiste')
const hinweis = (page: Page) => page.getByTestId('hinweis')

/** Die Kamera steht in der Ruhelage der Theke für das aktuelle Bildformat. */
async function erwarteAnDerTheke(page: Page): Promise<void> {
  const viewport = page.viewportSize()
  if (!viewport || !theke) throw new Error('kein Viewport')
  const soll = ansichtFuer(theke, viewport.width / viewport.height)
  const ist = await info(page)
  expect(ist.blickpunkt).toBe('theke')
  for (let k = 0; k < 3; k += 1) {
    expect(ist.eye[k]).toBeCloseTo(soll.eye[k], 3)
  }
  const d = [
    soll.look[0] - soll.eye[0],
    soll.look[1] - soll.eye[1],
    soll.look[2] - soll.eye[2],
  ]
  const l = Math.hypot(d[0], d[1], d[2])
  for (let k = 0; k < 3; k += 1) {
    expect(ist.richtung[k]).toBeCloseTo(d[k] / l, 3)
  }
  expect(ist.fov).toBeCloseTo(soll.fov, 3)
  expect(ist.aussenSichtbar).toBe(true)
}

/** In 1,5 s ohne Bedienung kommt kein einziges Bild dazu. */
async function erwarteStillstand(page: Page): Promise<void> {
  await ruhe(page)
  const vorher = await bilder(page)
  await page.waitForTimeout(1500)
  expect(await bilder(page)).toBe(vorher)
}

test.describe('Flug zum Start', () => {
  test('läuft nach dem Laden von selbst und endet an der Theke', async ({
    page,
  }) => {
    const protokoll = await oeffne(page, { intro: true })

    // Unterwegs: nur „Überspringen“, unten in Daumenreichweite.
    await expect(flug(page)).toBeVisible()
    const knopf = ueberspringen(page)
    await expect(knopf).toBeVisible()
    const box = await knopf.boundingBox()
    const hoehe = page.viewportSize()?.height ?? 0
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.y).toBeGreaterThan(hoehe * 0.75)
    await expect(leiste(page)).toHaveCount(0)
    await expect(hinweis(page)).toHaveCount(0)
    await expect(page.getByTestId('status')).toHaveText(
      'Kurzer Flug von der Straße zur Theke. Überspringen möglich.'
    )

    const start = await info(page)
    expect(start.intro.id).toBe('kurz')
    expect(start.aussenSichtbar).toBe(true)
    // Draußen auf der Straße, nicht an der Theke - und die Kamera bewegt sich.
    expect(draussen(start.eye)).toBe(true)
    await expect
      .poll(async () => {
        const jetzt = await info(page)
        return Math.hypot(
          jetzt.eye[0] - start.eye[0],
          jetzt.eye[2] - start.eye[2]
        )
      })
      .toBeGreaterThan(0.5)

    // Ankunft: Das Canvas nennt den Blickpunkt, die Bedienung ist da.
    await expect(szene(page, 'Theke')).toBeVisible({ timeout: 30_000 })
    await expect(ueberspringen(page)).toHaveCount(0)
    await expect(leiste(page)).toBeVisible()
    await expect(hinweis(page)).toHaveAttribute('data-sichtbar', 'true')
    await expect(page.getByTestId('status')).toHaveText('Blickpunkt Theke.')
    const ende = await info(page)
    expect(ende.intro.laeuft).toBe(false)
    // „langsam“: Auf einem lahmen Rechner schneidet die App nach der ersten
    // Sekunde an die Theke, statt zu ruckeln - auch das ist ein gutes Ende.
    expect(['ende', 'langsam']).toContain(ende.intro.ende)
    expect(ende.intro.bilder).toBeGreaterThan(0)
    await erwarteAnDerTheke(page)

    // Danach wieder: gerendert wird nur bei Bedarf.
    await erwarteStillstand(page)

    // Und der Laden lässt sich bedienen wie ohne Flug.
    await wechsleZu(page, 'Brotregal')
    await wechsleZu(page, 'Theke')

    await page.waitForLoadState('networkidle')
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.antworten).toEqual([])
    await erwarteKeinePreise(page)
  })

  test('„Überspringen“ führt sofort an die Theke', async ({ page }) => {
    await oeffne(page, { intro: true })
    await ueberspringen(page).click()

    await expect(szene(page, 'Theke')).toBeVisible()
    await expect(ueberspringen(page)).toHaveCount(0)
    await expect(leiste(page)).toBeVisible()
    await expect(hinweis(page)).toHaveAttribute('data-sichtbar', 'true')
    expect((await info(page)).intro.ende).toBe('uebersprungen')
    await erwarteAnDerTheke(page)
    await erwarteStillstand(page)
  })

  test('ein Tipp ins Bild überspringt - ohne etwas anzutippen', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page, { intro: true })
    await expect(ueberspringen(page)).toBeVisible()
    const viewport = page.viewportSize()
    const x = (viewport?.width ?? 0) / 2
    const y = (viewport?.height ?? 0) * 0.4
    if (hasTouch) await page.touchscreen.tap(x, y)
    else await page.mouse.click(x, y)

    await expect(szene(page, 'Theke')).toBeVisible()
    expect((await info(page)).intro.ende).toBe('uebersprungen')
    await erwarteAnDerTheke(page)
    // Der Tipp galt dem Flug: keine Karte, und der Hinweis steht noch.
    await expect(produktSheet(page)).not.toBeVisible()
    await expect(hinweis(page)).toHaveAttribute('data-sichtbar', 'true')

    // Der nächste Tipp trifft wieder Ware.
    await ruhe(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
  })

  for (const taste of ['Escape', 'Enter', 'Space']) {
    test(`die Taste ${taste} überspringt`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'Tastatur: nur am Desktop geprüft')
      await oeffne(page, { intro: true })
      await expect(ueberspringen(page)).toBeVisible()
      await page.keyboard.press(taste)
      await expect(szene(page, 'Theke')).toBeVisible()
      expect((await info(page)).intro.ende).toBe('uebersprungen')
      await erwarteAnDerTheke(page)
    })
  }

  test('unterwegs wechseln weder Pfeiltasten noch Mausrad etwas', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Tastatur und Rad: nur am Desktop geprüft')
    await oeffne(page, { intro: true })
    await expect(ueberspringen(page)).toBeVisible()
    const fov = (await info(page)).fov
    await page.keyboard.press('ArrowRight')
    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, -400)
    const jetzt = await info(page)
    expect(jetzt.blickpunkt).toBe('theke')
    expect(jetzt.fov).toBeCloseTo(fov, 6)
    await expect(flug(page)).toBeVisible()
  })

  test('?intro=0 startet ohne Flug; unter „Quellen“ lässt er sich ansehen', async ({
    page,
  }) => {
    await oeffne(page)
    await expect(szene(page, 'Theke')).toBeVisible()
    await expect(ueberspringen(page)).toHaveCount(0)
    await expect(leiste(page)).toBeVisible()
    const start = await info(page)
    expect(start.intro).toMatchObject({ laeuft: false, id: 'kurz', ende: null })
    await erwarteAnDerTheke(page)

    // Von einem anderen Blickpunkt aus: Der Flug beginnt trotzdem draußen
    // und endet an der Theke.
    await wechsleZu(page, 'Regale')
    await page.getByRole('button', { name: 'Quellen' }).click()
    const nochmal = page.getByRole('button', {
      name: 'Flug von der Straße noch einmal ansehen',
    })
    await expect(nochmal).toBeVisible()
    const box = await nochmal.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    await nochmal.click()

    await expect(ueberspringen(page)).toBeVisible()
    await expect(flug(page)).toBeVisible()
    await expect(leiste(page)).toHaveCount(0)
    const unterwegs = await info(page)
    expect(unterwegs.intro.laeuft).toBe(true)
    expect(unterwegs.aussenSichtbar).toBe(true)
    expect(draussen(unterwegs.eye)).toBe(true)

    await ueberspringen(page).click()
    await expect(szene(page, 'Theke')).toBeVisible()
    await erwarteAnDerTheke(page)
    await erwarteStillstand(page)
  })

  test('ohne Bewegung (prefers-reduced-motion) gibt es keinen Flug', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page, { intro: true })

    await expect(szene(page, 'Theke')).toBeVisible()
    await expect(ueberspringen(page)).toHaveCount(0)
    await expect(leiste(page)).toBeVisible()
    await expect(page.getByTestId('status')).toHaveText(
      'Der Laden ist geladen. Du stehst an der Theke.'
    )
    expect((await info(page)).intro).toMatchObject({
      laeuft: false,
      id: null,
      ende: null,
      bilder: 0,
    })
    await erwarteAnDerTheke(page)
    await erwarteStillstand(page)

    // … und auch kein Angebot, ihn anzusehen.
    await page.getByRole('button', { name: 'Quellen' }).click()
    await expect(page.getByRole('dialog', { name: 'Quellen' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Flug von der Straße/ })
    ).toHaveCount(0)
  })

  test('das Gerät mitten im Flug gedreht: Er endet in der Ruhelage des neuen Formats', async ({
    page,
  }) => {
    await oeffne(page, { intro: true })
    await expect(ueberspringen(page)).toBeVisible()
    const viewport = page.viewportSize()
    if (!viewport) throw new Error('kein Viewport')
    // Hoch ↔ quer (am Desktop: ein schmales, hohes Fenster).
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    })
    // Der Flug läuft weiter - die Kamera steht noch nicht an der Theke.
    expect((await info(page)).intro.laeuft).toBe(true)
    expect(draussen((await info(page)).eye)).toBe(true)

    await expect(szene(page, 'Theke')).toBeVisible({ timeout: 30_000 })
    expect(['ende', 'langsam']).toContain((await info(page)).intro.ende)
    await erwarteAnDerTheke(page)
    await erwarteStillstand(page)
  })

  test('legt auch mit Flug weder Cookies noch Speicher-Einträge an', async ({
    page,
  }) => {
    await oeffne(page, { intro: true })
    await ueberspringen(page).click()
    await expect(szene(page, 'Theke')).toBeVisible()
    await page.getByRole('button', { name: 'Quellen' }).click()
    await page
      .getByRole('button', { name: 'Flug von der Straße noch einmal ansehen' })
      .click()
    await expect(ueberspringen(page)).toBeVisible()
    await ueberspringen(page).click()
    await expect(szene(page, 'Theke')).toBeVisible()
    await ruhe(page)

    expect(await page.context().cookies()).toEqual([])
    const speicher = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
    }))
    expect(speicher).toEqual({ local: [], session: [] })
  })
})

test.describe('„Entdeckt“ in der Liste', () => {
  test('zählt geöffnete Karten - nur in der Liste, nur bis zum Neuladen', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    const zaehler = page.getByTestId('entdeckt')
    const haken = page.getByTestId('entdeckt-haken')

    await page.getByRole('button', { name: 'Alles hier' }).click()
    await expect(allesHierListe(page)).toBeVisible()
    await expect(zaehler).toHaveText(/^0 von \d+ Produkten im Laden entdeckt$/)
    await expect(haken).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(allesHierListe(page)).not.toBeVisible()
    // Über der Szene steht kein Zähler.
    await expect(zaehler).toHaveCount(0)

    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    const name = (
      await produktSheet(page).getByRole('heading').innerText()
    ).trim()
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()

    await page.getByRole('button', { name: 'Alles hier' }).click()
    await expect(zaehler).toHaveText(/^1 von \d+ Produkten im Laden entdeckt$/)
    await expect(haken).toHaveCount(1)
    await expect(haken).toHaveAttribute('aria-label', 'schon entdeckt')
    await expect(
      allesHierListe(page).getByRole('button', { name: new RegExp(name) })
    ).toHaveAccessibleName(new RegExp(`${name}.*schon entdeckt$`))
    await erwarteKeinePreise(page)

    // Nichts davon ist gespeichert: Nach dem Neuladen zählt es wieder von vorn.
    const speicher = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
    }))
    expect(speicher).toEqual({ local: [], session: [] })
    await page.reload()
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    await page.getByRole('button', { name: 'Alles hier' }).click()
    await expect(zaehler).toHaveText(/^0 von \d+ Produkten im Laden entdeckt$/)
    await expect(haken).toHaveCount(0)
  })
})
