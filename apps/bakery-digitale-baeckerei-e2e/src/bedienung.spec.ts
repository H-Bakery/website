/**
 * @fileoverview Bedienung der Szene: Umschauen in Grenzen, Zoom über den
 * Öffnungswinkel, Doppeltipp hin und zurück, die Karte bei laufender Szene,
 * Auswahl aus der Liste, Preisschilder - mit dem synthetischen Fixture.
 *
 * Was die Suite dafür von der App erwartet, steht im Kopf von
 * `support/app.ts`.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  WAISE,
  allesHierListe,
  bilder,
  oeffne,
  produktSheet,
  szene,
  tippeAufPlatz,
} from './support/app'

const KEKSE = 'theke/vitrine/ebene-3/platz-01'
/** Liegt in der Vitrine hinter der Scheibe. */
const PLUNDER = {
  slot: 'theke/vitrine/ebene-1/platz-04',
  name: 'Musterplunder Apfel',
}

const info = (page: Page) =>
  page.evaluate(() => {
    const haken = window.__digitaleBaeckerei
    if (!haken) throw new Error('Messhaken fehlt')
    return haken.info()
  })

/** Oberstes Brot im Regal: an der Theke (Desktop) oben rechts im Bild. */
const BROT_OBEN = { slot: 'brotregal/ebene-3/platz-01', name: 'Testbrot' }

const hervorgehoben = (page: Page) =>
  page.evaluate(() => window.__digitaleBaeckerei?.hervorgehoben ?? null)

const position = (page: Page, slot: string) =>
  page.evaluate((s) => window.__digitaleBaeckerei?.screenPos(s) ?? null, slot)

/** Blickrichtung um die Hochachse in Grad. */
const yaw = async (page: Page) => {
  const { richtung } = await info(page)
  return (Math.atan2(richtung[0], richtung[2]) * 180) / Math.PI
}

/** Wartet, bis die Szene nichts mehr zeichnet (Fahrt, Feder, Einblenden). */
async function ruhe(page: Page): Promise<void> {
  let vorher = -1
  await expect
    .poll(
      async () => {
        const jetzt = await bilder(page)
        const still = jetzt === vorher
        vorher = jetzt
        return still
      },
      { intervals: [400], timeout: 15_000 }
    )
    .toBe(true)
}

/** Mitte der freien Bildfläche über der Leiste - dort liegt kein Bedienelement. */
const bildmitte = (page: Page) => {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
  return { x: width / 2, y: height * 0.3 }
}

test.describe('Umschauen und Zoom', () => {
  test('zeichnet in Ruhe nichts', async ({ page }) => {
    await oeffne(page)
    await ruhe(page)
    const vorher = await bilder(page)
    await page.waitForTimeout(1500)
    expect(await bilder(page)).toBe(vorher)
  })

  test('Ziehen dreht den Blick, über die Grenze hinaus federt er zurück', async ({
    page,
  }) => {
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const yaw0 = await yaw(page)
    const { x, y } = bildmitte(page)

    // Weit über die Grenze (± 20°) hinaus ziehen und loslassen.
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(x + i * 60, y)
    const gezogen = await yaw(page)
    await page.mouse.up()
    await ruhe(page)
    const danach = await info(page)
    const yaw1 = await yaw(page)

    // Gedreht, aber nur bis zur Grenze: 20° plus das, was das schmalere Bild
    // hergibt - nie die 100°+, die der Weg des Zeigers bedeutet hätte.
    expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(15)
    expect(Math.abs(yaw1 - yaw0)).toBeLessThan(26)
    // Während des Ziehens stand der Blick weiter draußen (Gummiband).
    expect(Math.abs(gezogen - yaw0)).toBeGreaterThan(Math.abs(yaw1 - yaw0))
    // Der Standort bleibt, der Öffnungswinkel auch.
    expect(danach.eye).toEqual(start.eye)
    expect(danach.fov).toBeCloseTo(start.fov, 5)
    // Ein Ziehen ist kein Tipp.
    await expect(produktSheet(page)).toBeHidden()
  })

  test('das Mausrad ändert nur den Öffnungswinkel, die Seite scrollt nicht', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Ein Mausrad gibt es am Desktop.')
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const { x, y } = bildmitte(page)

    await page.mouse.move(x, y)
    await page.mouse.wheel(0, -400)
    await ruhe(page)
    const nah = await info(page)
    expect(nah.fov).toBeLessThan(start.fov - 5)
    expect(nah.eye).toEqual(start.eye)

    // Ganz hinaus: nie weiter als die Startweite.
    await page.mouse.wheel(0, 5000)
    await ruhe(page)
    expect((await info(page)).fov).toBeCloseTo(start.fov, 5)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('Doppeltipp auf ein Produkt zoomt heran, der nächste zoomt zurück', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const doppelt = async (x: number, y: number) => {
      if (hasTouch) {
        await page.touchscreen.tap(x, y)
        await page.touchscreen.tap(x, y)
      } else {
        await page.mouse.dblclick(x, y)
      }
    }

    const kekse = await position(page, KEKSE)
    expect(kekse).not.toBeNull()
    await doppelt(kekse?.x ?? 0, kekse?.y ?? 0)
    await ruhe(page)
    const nah = await info(page)
    expect(nah.fov).toBeLessThan(start.fov * 0.6)
    expect(nah.eye).toEqual(start.eye)
    // Der erste Tipp des Doppeltipps hat die Karte geöffnet.
    await expect(produktSheet(page)).toBeVisible()

    // Zweiter Doppeltipp - auf eine leere Stelle - zoomt zurück zur Startweite.
    const { x, y } = bildmitte(page)
    await doppelt(x, 40 + y / 4)
    await ruhe(page)
    expect((await info(page)).fov).toBeCloseTo(start.fov, 5)
  })
})

test.describe('Karte bei laufender Szene', () => {
  test('ein Tipp ohne Produkt schließt die Karte und nimmt die Hervorhebung weg', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    await expect.poll(() => hervorgehoben(page)).toBe(KEKSE)

    // Ein Produkt, das der Snapshot nicht kennt, hat keine Karte - der Tipp
    // gilt als „daneben“.
    await tippeAufPlatz(page, WAISE.slot, hasTouch)
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
  })

  test('das gewählte Produkt bleibt neben der Karte zu sehen', async ({
    page,
    isMobile,
  }) => {
    // Am Desktop steht die Karte oben rechts - dort liegt an der Theke das
    // oberste Brot des Regals. Im Hochformat liegt im Fixture kein Produkt so
    // tief, dass das Sheet es verdeckt (Rechnung: bildausschnitt.spec.ts).
    test.skip(
      isMobile,
      'Im Fixture liegt im Hochformat nichts unter dem Sheet.'
    )
    await oeffne(page)
    await ruhe(page)
    const vorher = await position(page, BROT_OBEN.slot)
    await tippeAufPlatz(page, BROT_OBEN.slot, false)
    const sheet = produktSheet(page)
    await expect(sheet.getByText(BROT_OBEN.name, { exact: true })).toBeVisible()
    await ruhe(page)

    const karte = await sheet.boundingBox()
    const produkt = await position(page, BROT_OBEN.slot)
    expect(karte).not.toBeNull()
    expect(produkt, 'das Produkt ist noch im Bild').not.toBeNull()
    if (!karte || !produkt || !vorher) return
    // Ohne Schwenk läge es unter der Karte ...
    expect(vorher.x).toBeGreaterThan(karte.x)
    expect(vorher.y).toBeLessThan(karte.y + karte.height)
    // ... jetzt steht es links daneben.
    expect(produkt.x).toBeLessThan(karte.x)
  })

  test('Escape schließt die Karte, der Fokus kehrt zur Szene zurück', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Tastatur gibt es am Desktop.')
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, false)
    await expect(produktSheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
    await expect(szene(page, 'Theke')).toBeFocused()
  })

  test('ein Wechsel des Blickpunkts schließt die Karte', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    // Im Hochformat liegt die Karte über der Leiste: erst schließen ist dort
    // der Weg. Am Desktop bleibt die Leiste frei.
    const brotregal = page
      .getByTestId('blickpunkt-leiste')
      .getByRole('button', { name: 'Brotregal', exact: true })
    if (hasTouch) {
      await produktSheet(page)
        .getByRole('button', { name: 'Schließen' })
        .click()
    }
    await brotregal.click()
    await expect(szene(page, 'Brotregal')).toBeVisible()
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
  })
})

test.describe('Auswahl aus der Liste', () => {
  test('schließt die Liste, hebt den Platz hervor und öffnet die Karte', async ({
    page,
  }) => {
    await oeffne(page)
    await page.getByRole('button', { name: 'Alles hier' }).click()
    await allesHierListe(page).getByText(PLUNDER.name, { exact: true }).click()

    await expect(allesHierListe(page)).toBeHidden()
    await expect(
      produktSheet(page).getByText(PLUNDER.name, { exact: true })
    ).toBeVisible()
    await expect.poll(() => hervorgehoben(page)).toBe(PLUNDER.slot)
    await ruhe(page)
    expect(
      await position(page, PLUNDER.slot),
      'der Platz steht im Bild'
    ).not.toBeNull()
  })
})

test.describe('Preisschilder (DB8)', () => {
  test('sind im Bild ausgeblendet', async ({ page }) => {
    await oeffne(page)
    // Das Fixture hat vier Brote mit Preiskarte und Preisschrift.
    expect((await info(page)).preisschilder).toBe(8)
  })
})

test.describe('Außenraum', () => {
  test('ist an den Regalen ausgeblendet und an der Theke wieder da', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page)
    expect((await info(page)).aussenSichtbar).toBe(true)
    const leiste = page.getByTestId('blickpunkt-leiste')
    await leiste.getByRole('button', { name: 'Regale', exact: true }).click()
    await expect.poll(async () => (await info(page)).aussenSichtbar).toBe(false)
    await leiste.getByRole('button', { name: 'Theke', exact: true }).click()
    await expect.poll(async () => (await info(page)).aussenSichtbar).toBe(true)
  })
})
