/**
 * @fileoverview Nahansicht „In 3D ansehen“: das 3D-Modell eines Produkts im
 * Dialog drehen und zoomen - mit dem synthetischen Produkt-Modell des Fixtures
 * (ein kantiger Laib für „Testbrot“). Nur dieses eine Produkt hat ein Modell.
 *
 * Was die Suite von der App erwartet, steht im Kopf von `support/app.ts`.
 */
import { expect, test, type Page } from '@playwright/test'
// Die Grenzen des Drehtellers gehören zur App (dort prüft sie jest).
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  PITCH_MAX,
  PITCH_MIN,
  ZOOM_MAX,
} from '../../bakery-digitale-baeckerei/src/lib/scene/drehteller'
import {
  MIT_MODELL,
  OHNE_MODELL,
  allesHierListe,
  bilder,
  oeffne,
  produktSheet,
  ruhe,
  tippeAufPlatz,
  wechsleZu,
} from './support/app'

const KNOPF = 'In 3D ansehen'
const MODELL_DATEI = `/produkte-3d/${MIT_MODELL.produkt}.glb`
/** Steht auf der Vitrine an der Theke: ein Produkt ohne 3D-Modell. */
const KEKSE_SLOT = 'theke/vitrine/ebene-3/platz-01'

const nahansicht = (page: Page) => page.getByTestId('nahansicht')
const buehne = (page: Page) => page.getByTestId('nahansicht-buehne')
const knopf = (page: Page) =>
  produktSheet(page).getByRole('button', { name: KNOPF })
const modellBild = (page: Page) =>
  nahansicht(page).getByRole('img', { name: `3D-Modell: ${MIT_MODELL.name}` })

/** Zustand der Nahansicht aus dem Messhaken; `null`, wenn keine offen ist. */
const stand = (page: Page) =>
  page.evaluate(() => {
    const h = window.__digitaleBaeckereiNahansicht
    if (!h) return null
    const info = h.info()
    return {
      frames: h.frames,
      dreht: h.dreht,
      yaw: info.zustand.yaw,
      pitch: info.zustand.pitch,
      zoom: info.zustand.zoom,
      zoomMin: info.zoomMin,
      pixelRatio: info.pixelRatio,
    }
  })

/** Zeichnet neu und liest das Bild der Nahansicht aus (zählt als ein Bild). */
const bildVon = (page: Page) =>
  page.evaluate(
    () => window.__digitaleBaeckereiNahansicht?.pixelStats() ?? null
  )

const framesVon = async (page: Page) => (await stand(page))?.frames ?? -2

/** Öffnet am Brotregal über die Liste die Karte des Produkts mit Modell. */
async function karteMitModell(page: Page): Promise<void> {
  await wechsleZu(page, 'Brotregal')
  await page.getByRole('button', { name: 'Alles hier' }).click()
  await allesHierListe(page)
    .getByText(MIT_MODELL.name, { exact: true })
    .first()
    .click()
  await expect(
    produktSheet(page).getByText(MIT_MODELL.name, { exact: true })
  ).toBeVisible()
}

/** Tippt „In 3D ansehen“ und wartet, bis das Modell im Bild steht. */
async function oeffneNahansicht(page: Page): Promise<void> {
  await knopf(page).click()
  await expect(buehne(page)).toHaveAttribute('data-phase', 'bereit', {
    timeout: 60_000,
  })
  await page.waitForFunction(
    () => window.__digitaleBaeckereiNahansicht?.ready === true
  )
}

/** Wartet, bis die Nahansicht nichts mehr zeichnet. */
async function nahansichtRuht(page: Page): Promise<void> {
  let vorher = -1
  await expect
    .poll(
      async () => {
        const jetzt = await framesVon(page)
        const still = jetzt === vorher
        vorher = jetzt
        return still
      },
      { intervals: [400], timeout: 30_000 }
    )
    .toBe(true)
}

/** Zieht mit der Maus über das Bild der Nahansicht. */
async function ziehe(page: Page, dx: number, dy: number): Promise<void> {
  const box = await modellBild(page).boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 })
  await page.mouse.move(x + dx, y + dy, { steps: 4 })
  await page.mouse.up()
}

test.describe('Nahansicht „In 3D ansehen“', () => {
  test('Produkt mit Modell: öffnen, drehen, zoomen, schließen - der Laden bleibt bedienbar', async ({
    page,
    hasTouch,
    baseURL,
  }) => {
    // Ohne die Runde vom Öffnen: Das Bild steht still, bis die Suite dreht.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const protokoll = await oeffne(page)
    await karteMitModell(page)

    // Das Modell wird erst beim Öffnen geholt.
    expect(protokoll.anfragen.filter((u) => u.endsWith(MODELL_DATEI))).toEqual(
      []
    )
    await expect(knopf(page)).toBeVisible()
    const mass = await knopf(page).boundingBox()
    expect(mass?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(mass?.width ?? 0).toBeGreaterThanOrEqual(44)

    await oeffneNahansicht(page)
    expect(
      protokoll.anfragen.filter((u) => u.endsWith(MODELL_DATEI))
    ).toHaveLength(1)

    // Dialog mit dem Namen als Überschrift, beschriftetes Bild, „Zurück“.
    await expect(
      page.getByRole('dialog', { name: MIT_MODELL.name })
    ).toBeVisible()
    await expect(
      nahansicht(page).getByRole('heading', { name: MIT_MODELL.name })
    ).toBeVisible()
    await expect(modellBild(page)).toBeVisible()
    const zurueck = nahansicht(page).getByRole('button', { name: 'Zurück' })
    expect((await zurueck.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44
    )

    // Das Bild ist nicht leer: das Produkt steht mittig vor dem Hintergrund.
    const bild = await bildVon(page)
    expect(bild).not.toBeNull()
    expect(bild?.backgroundShare).toBeLessThan(0.97)
    expect(bild?.backgroundShare).toBeGreaterThan(0.2)
    expect(bild?.distinct).toBeGreaterThan(8)
    expect(bild?.breite).toBeGreaterThan(0.3)
    expect(Math.abs((bild?.mitteX ?? 0) - 0.5)).toBeLessThan(0.15)
    expect(Math.abs((bild?.mitteY ?? 0) - 0.5)).toBeLessThan(0.2)
    expect((await stand(page))?.pixelRatio ?? 99).toBeLessThanOrEqual(2)

    // Ohne Bedienung wird nichts gezeichnet.
    await nahansichtRuht(page)
    const ruheBilder = await framesVon(page)
    await page.waitForTimeout(1200)
    expect(await framesVon(page)).toBe(ruheBilder)

    // Drehen ändert das Bild.
    const vorher = { yaw: (await stand(page))?.yaw, bild: await bildVon(page) }
    await ziehe(page, 110, 0)
    await nahansichtRuht(page)
    const gedreht = { yaw: (await stand(page))?.yaw, bild: await bildVon(page) }
    expect(gedreht.yaw).not.toBeCloseTo(vorher.yaw ?? 0, 2)
    expect(gedreht.bild?.summe).not.toBe(vorher.bild?.summe)

    // Kippen hat Grenzen: nie von unten, nie genau von oben.
    await ziehe(page, 0, -260)
    await ziehe(page, 0, -260)
    expect((await stand(page))?.pitch).toBeCloseTo(PITCH_MIN, 5)
    await ziehe(page, 0, 260)
    await ziehe(page, 0, 260)
    expect((await stand(page))?.pitch).toBeCloseTo(PITCH_MAX, 5)

    // Zoomen hat Grenzen: nie ins Modell, nie winzig.
    await modellBild(page).hover()
    for (let i = 0; i < 30; i += 1) await page.mouse.wheel(0, -400)
    await nahansichtRuht(page)
    const nah = await stand(page)
    expect(nah?.zoom).toBeCloseTo(nah?.zoomMin ?? -1, 5)
    expect(nah?.zoomMin).toBeGreaterThan(0)
    // Ganz nah füllt das Produkt das Bild, ohne dass man hineinschaut.
    expect((await bildVon(page))?.backgroundShare).toBeLessThan(0.6)
    for (let i = 0; i < 30; i += 1) await page.mouse.wheel(0, 400)
    await nahansichtRuht(page)
    expect((await stand(page))?.zoom).toBeCloseTo(ZOOM_MAX, 5)
    expect((await bildVon(page))?.breite).toBeGreaterThan(0.15)

    // Schließen: alles weg, die Karte und der Laden sind noch da.
    const ladenBilder = await bilder(page)
    await zurueck.click()
    await expect(nahansicht(page)).toBeHidden()
    await expect
      .poll(() =>
        page.evaluate(() => window.__digitaleBaeckereiNahansicht === undefined)
      )
      .toBe(true)
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(
      produktSheet(page).getByText(MIT_MODELL.name, { exact: true })
    ).toBeVisible()
    await expect(knopf(page)).toBeVisible()

    // Der Laden hat währenddessen nichts gezeichnet und zeichnet auch jetzt nicht.
    await ruhe(page)
    const danach = await bilder(page)
    expect(danach - ladenBilder).toBeLessThanOrEqual(2)
    await page.waitForTimeout(1200)
    expect(await bilder(page)).toBe(danach)

    // Und er lässt sich weiter bedienen: wechseln, antippen. Ein Produkt
    // ohne Modell hat keinen Knopf.
    // (Im Hochformat liegt die offene Karte über der Leiste: erst schließen.)
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()
    await wechsleZu(page, 'Theke')
    await tippeAufPlatz(page, KEKSE_SLOT, hasTouch)
    await expect(
      produktSheet(page).getByText(OHNE_MODELL.name, { exact: true })
    ).toBeVisible()
    await expect(knopf(page)).toHaveCount(0)

    // Sauber: keine Fehler, nichts gespeichert, nichts von fremden Servern.
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
    const fremd = protokoll.anfragen.filter(
      (u) => !u.startsWith(baseURL ?? '') && !u.startsWith('blob:')
    )
    expect(fremd).toEqual([])
    expect(
      await page.evaluate(() => localStorage.length + sessionStorage.length)
    ).toBe(0)
    expect(await page.evaluate(() => document.cookie)).toBe('')
  })

  test('dreht beim Öffnen eine langsame Runde und steht dann still', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)
    await karteMitModell(page)
    await oeffneNahansicht(page)

    const start = await stand(page)
    expect(start?.dreht).toBe(true)
    await expect
      .poll(() => framesVon(page), { timeout: 15_000 })
      .toBeGreaterThan((start?.frames ?? 0) + 3)

    // Eine Runde, dann Ruhe: kein Dauer-Loop.
    await expect
      .poll(async () => (await stand(page))?.dreht, {
        intervals: [500],
        timeout: 45_000,
      })
      .toBe(false)
    await nahansichtRuht(page)
    const ende = await framesVon(page)
    await page.waitForTimeout(1500)
    expect(await framesVon(page)).toBe(ende)

    expect(protokoll.konsole).toEqual([])
    expect(protokoll.ausnahmen).toEqual([])
  })

  test('wer selbst dreht, beendet die Runde', async ({ page }) => {
    await oeffne(page)
    await karteMitModell(page)
    await oeffneNahansicht(page)
    expect((await stand(page))?.dreht).toBe(true)

    await ziehe(page, 60, 0)
    expect((await stand(page))?.dreht).toBe(false)
    await nahansichtRuht(page)
  })

  test('Escape schließt nur die Nahansicht - die Karte bleibt offen', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page)
    await karteMitModell(page)
    await oeffneNahansicht(page)

    await page.keyboard.press('Escape')
    await expect(nahansicht(page)).toBeHidden()
    await expect(
      produktSheet(page).getByText(MIT_MODELL.name, { exact: true })
    ).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(1)

    // Noch einmal öffnen geht (neuer Renderer, neues Canvas).
    await oeffneNahansicht(page)
    await expect(page.locator('canvas')).toHaveCount(2)
    expect((await bildVon(page))?.backgroundShare).toBeLessThan(0.97)
  })

  test('mehrmals öffnen und schließen lässt keinen WebGL-Kontext zurück', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page)
    await karteMitModell(page)

    // Lebende WebGL-Kontexte zählen (Chromium, DevTools-Protokoll). Jede
    // Nahansicht hat ihren eigenen Renderer - nach dem Schließen muss er
    // ganz weg sein, sonst sammelt ein Handy mit jedem Öffnen einen Kontext
    // samt Canvas und Texturen an.
    const cdp = await page.context().newCDPSession(page)
    const kontexte = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage')
      const proto = await cdp.send('Runtime.evaluate', {
        expression: 'WebGL2RenderingContext.prototype',
        objectGroup: 'zaehlen',
      })
      const alle = await cdp.send('Runtime.queryObjects', {
        prototypeObjectId: proto.result.objectId ?? '',
        objectGroup: 'zaehlen',
      })
      const anzahl = await cdp.send('Runtime.callFunctionOn', {
        objectId: alle.objects.objectId,
        functionDeclaration: 'function () { return this.length }',
        returnByValue: true,
      })
      // Die eigene Liste wieder loslassen - sonst hält die Messung fest.
      await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'zaehlen' })
      return anzahl.result.value as number
    }

    const vorher = await kontexte()
    expect(vorher).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < 4; i += 1) {
      await oeffneNahansicht(page)
      await nahansicht(page).getByRole('button', { name: 'Zurück' }).click()
      await expect(nahansicht(page)).toBeHidden()
    }
    // Der zuletzt geschlossene darf noch an einem Rest hängen (das letzte
    // Klick-Ereignis in React) - aber es werden nicht mehr mit jedem Öffnen.
    await expect
      .poll(kontexte, { timeout: 15_000 })
      .toBeLessThanOrEqual(vorher + 1)
    await expect(page.locator('canvas')).toHaveCount(1)
  })

  test('Modell lädt nicht: Meldung im Dialog, die Karte bleibt benutzbar', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let scheitern = true
    await page.route(`**${MODELL_DATEI}`, (route) =>
      scheitern ? route.fulfill({ status: 404, body: '' }) : route.continue()
    )
    await oeffne(page)
    await karteMitModell(page)
    await knopf(page).click()

    await expect(buehne(page)).toHaveAttribute('data-phase', 'fehler')
    await expect(nahansicht(page).getByRole('alert')).toContainText(
      'Das 3D-Modell konnte nicht geladen werden.'
    )

    // Noch einmal versuchen - jetzt klappt es.
    scheitern = false
    await nahansicht(page)
      .getByRole('button', { name: 'Noch einmal versuchen' })
      .click()
    await expect(buehne(page)).toHaveAttribute('data-phase', 'bereit', {
      timeout: 60_000,
    })
    await expect(nahansicht(page).locator('canvas')).toHaveCount(1)

    await nahansicht(page).getByRole('button', { name: 'Zurück' }).click()
    await expect(nahansicht(page)).toBeHidden()
    await expect(
      produktSheet(page).getByText(MIT_MODELL.name, { exact: true })
    ).toBeVisible()
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()
    await expect(produktSheet(page)).toBeHidden()
  })

  test('kein WebGL-Kontext für die Nahansicht: Meldung, der Laden läuft weiter', async ({
    page,
  }) => {
    await oeffne(page)
    await karteMitModell(page)
    // Der Laden hat seinen Kontext schon - ein zweiter ist nicht zu haben.
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (/webgl/i.test(type)) return null
        return (original as (...args: unknown[]) => unknown).call(
          this,
          type,
          ...rest
        )
      } as typeof original
    })
    await knopf(page).click()

    await expect(buehne(page)).toHaveAttribute('data-phase', 'kein-webgl')
    await expect(nahansicht(page).getByRole('alert')).toContainText(
      'Die 3D-Ansicht lässt sich auf diesem Gerät gerade nicht öffnen.'
    )
    await nahansicht(page).getByRole('button', { name: 'Zurück' }).click()
    await expect(nahansicht(page)).toBeHidden()

    // Karte und Laden sind unberührt.
    await expect(
      produktSheet(page).getByText(MIT_MODELL.name, { exact: true })
    ).toBeVisible()
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(1)
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()
    await wechsleZu(page, 'Theke')
  })

  for (const [fall, antwort] of [
    ['leer ist', { status: 200, body: '{"version":1,"modelle":{}}' }],
    ['fehlt', { status: 404, body: '' }],
  ] as const) {
    test(`kein Knopf, wenn der Index der Modelle ${fall} (Build ohne Daten-Repo)`, async ({
      page,
    }) => {
      await page.route('**/data/produkte-3d.json', (route) =>
        route.fulfill({ ...antwort, contentType: 'application/json' })
      )
      const protokoll = await oeffne(page)
      await karteMitModell(page)
      await expect(knopf(page)).toHaveCount(0)
      expect(
        protokoll.anfragen.filter((u) => u.includes('/produkte-3d/'))
      ).toEqual([])
      expect(protokoll.ausnahmen).toEqual([])
      await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible()
    })
  }
})
