/**
 * @fileoverview Produkte: im Bild antippen (auch durch Glas), das Bottom-Sheet
 * ohne Preis, die Liste „Alles hier“ - alles mit den erfundenen Produkten des
 * Fixtures.
 *
 * Die Plätze, die hier angetippt werden, liegen an der Theke mitten im Bild
 * (Hoch- und Querformat): siehe `src/test/fixtures/README.md` der App. Was die
 * Suite von der App erwartet, steht im Kopf von `support/app.ts`.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  PREIS,
  VARIANTE,
  WAISE,
  allesHierListe,
  erwarteKeinePreise,
  erwarteteEintraege,
  moebelVon,
  oeffne,
  produktSheet,
  ruhe,
  tippeAufPlatz,
  wechsleZu,
} from './support/app'

/** Steht im Brotregal und hat einen langen Text: aufgeklappt wird die Karte hoch. */
const KRUSTE = 'Musterkruste'

/** Steht auf der Vitrine, also ohne Scheibe davor. Hat Einheit und Seite. */
const KEKSE = {
  slot: 'theke/vitrine/ebene-3/platz-01',
  name: 'Testkekse',
  einheit: '200 g',
  kurztext: 'Mürbe Kekse im Glas, stehen auf der Vitrine.',
  seite: 'https://www.example.org/products/testkekse',
}
/** Liegt in der Vitrine hinter der Frontscheibe. Ohne Einheit, ohne Seite. */
const HOERNCHEN = {
  slot: VARIANTE.slot,
  name: 'Testhörnchen',
  kurztext: 'Blättrig und buttrig.',
}

test.describe('Produkt antippen', () => {
  test('öffnet das Sheet mit Name, Einheit und Kurztext - ohne Preis', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await expect(produktSheet(page)).toBeHidden()

    await tippeAufPlatz(page, KEKSE.slot, hasTouch)

    const sheet = produktSheet(page)
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText(KEKSE.name, { exact: true })).toBeVisible()
    await expect(sheet.getByText(KEKSE.einheit)).toBeVisible()
    await expect(sheet.getByText(KEKSE.kurztext)).toBeVisible()
    await expect(
      sheet.getByRole('link', { name: 'Mehr auf der Website' })
    ).toHaveAttribute('href', KEKSE.seite)
    await expect(sheet).not.toContainText(PREIS)
    await erwarteKeinePreise(page)
  })

  test('trifft die Ware durch die Scheibe der Vitrine', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)

    await tippeAufPlatz(page, HOERNCHEN.slot, hasTouch)

    const sheet = produktSheet(page)
    await expect(sheet).toBeVisible()
    // Das Produkt vom Morgen - nicht die ausgeblendete Feierabend-Variante.
    await expect(sheet.getByText(HOERNCHEN.name, { exact: true })).toBeVisible()
    await expect(sheet.getByText(HOERNCHEN.kurztext)).toBeVisible()
    // Kein Link, wenn es keine Produktseite gibt.
    await expect(
      sheet.getByRole('link', { name: 'Mehr auf der Website' })
    ).toHaveCount(0)
    await expect(sheet).not.toContainText(PREIS)
  })

  test('wechselt das Sheet beim nächsten Produkt', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)

    await tippeAufPlatz(page, KEKSE.slot, hasTouch)
    await expect(
      produktSheet(page).getByText(KEKSE.name, { exact: true })
    ).toBeVisible()

    await tippeAufPlatz(page, HOERNCHEN.slot, hasTouch)
    await expect(
      produktSheet(page).getByText(HOERNCHEN.name, { exact: true })
    ).toBeVisible()
    await expect(
      produktSheet(page).getByText(KEKSE.name, { exact: true })
    ).toHaveCount(0)
  })

  test('zeigt keine Karte für ein Produkt, das der Snapshot nicht kennt', async ({
    page,
    hasTouch,
  }) => {
    const protokoll = await oeffne(page)

    await tippeAufPlatz(page, WAISE.slot, hasTouch)
    await ruhe(page)
    await expect(produktSheet(page)).toBeHidden()
    await expect(page.getByText(WAISE.produkt)).toHaveCount(0)
    expect(protokoll.ausnahmen).toEqual([])

    // Gegenprobe: das Tippen selbst funktioniert an dieser Stelle des Bildes.
    await tippeAufPlatz(page, KEKSE.slot, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
  })

  test('zeigt an den Regalen Karten für Produkte, nicht für neutrale Ware', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await wechsleZu(page, 'Regale')

    // Dosen ohne eigenes Produkt (extras.ware).
    await tippeAufPlatz(page, 'dosenregal/platz-01', hasTouch)
    // Das kurze Aufleuchten der Ware abwarten - eine Karte kommt nicht.
    await ruhe(page)
    await expect(produktSheet(page)).toBeHidden()

    await tippeAufPlatz(page, 'dosenregal/platz-03', hasTouch)
    await expect(
      produktSheet(page).getByText('Probiergebäck in der Dose', { exact: true })
    ).toBeVisible()
  })
})

test.describe('Liste „Alles hier“', () => {
  test('zeigt die Produkte des Blickpunkts mit Name und Einheit', async ({
    page,
  }) => {
    await oeffne(page)
    await page.getByRole('button', { name: 'Alles hier' }).click()

    const liste = allesHierListe(page)
    await expect(liste).toBeVisible()
    const theke = erwarteteEintraege(moebelVon('theke'))
    for (const eintrag of theke) {
      await expect(
        liste.getByText(eintrag.name, { exact: true }).first()
      ).toBeVisible()
    }
    await expect(liste.getByText('200 g')).toBeVisible()
    // Nichts vom Brotregal, nicht das Produkt ohne Eintrag, kein Preis.
    await expect(liste.getByText('Testbrot', { exact: true })).toHaveCount(0)
    await expect(liste.getByText(WAISE.produkt)).toHaveCount(0)
    await expect(liste).not.toContainText(PREIS)
  })

  test('zeigt nach dem Wechsel die Produkte des neuen Blickpunkts', async ({
    page,
  }) => {
    await oeffne(page)
    await wechsleZu(page, 'Brotregal')
    await page.getByRole('button', { name: 'Alles hier' }).click()

    const liste = allesHierListe(page)
    for (const eintrag of erwarteteEintraege(moebelVon('brotregal'))) {
      await expect(
        liste.getByText(eintrag.name, { exact: true }).first()
      ).toBeVisible()
    }
    await expect(liste.getByText('Testkekse', { exact: true })).toHaveCount(0)
  })

  test('hebt das gewählte Produkt im Bild hervor', async ({ page }) => {
    await oeffne(page)
    await page.getByRole('button', { name: 'Alles hier' }).click()

    await allesHierListe(page).getByText(KEKSE.name, { exact: true }).click()

    await expect
      .poll(() =>
        page.evaluate(() => window.__digitaleBaeckerei?.hervorgehoben ?? null)
      )
      .toBe(KEKSE.slot)
  })
})

/**
 * Öffnet die Karte eines Produkts über die Liste „Alles hier“ - unabhängig
 * davon, wo es im Bild steht - und wartet, bis sie eingeblendet ist.
 */
async function oeffneKarte(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Alles hier' }).click()
  await allesHierListe(page).getByText(name, { exact: true }).click()
  await expect(allesHierListe(page)).toBeHidden()
  const sheet = produktSheet(page)
  await expect(sheet.getByRole('heading', { name })).toBeVisible()
  await steht(sheet)
  return sheet
}

/** Die Karte ist eingeblendet bzw. zurückgefedert: keine Verschiebung mehr. */
const steht = (sheet: Locator) =>
  expect
    .poll(() => sheet.evaluate((el) => getComputedStyle(el).transform))
    .toBe('none')

/**
 * Trifft ein Tipp auf die Mitte jedes Knopfs der Leiste diesen Knopf - oder
 * liegt etwas darüber (`elementFromPoint`)?
 */
const leistenTreffer = (page: Page) =>
  page.getByTestId('blickpunkt-leiste').evaluate((leiste) =>
    Array.from(leiste.querySelectorAll('button')).map((knopf) => {
      const r = knopf.getBoundingClientRect()
      const ziel = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2
      )
      return `${knopf.textContent}: ${
        ziel && knopf.contains(ziel) ? 'frei' : 'verdeckt'
      }`
    })
  )

/** Jeder Knopf der Leiste ist frei, darunter die Chips und „Alles hier“. */
async function erwarteLeisteFrei(page: Page): Promise<void> {
  const treffer = await leistenTreffer(page)
  for (const name of ['Theke', 'Brotregal', 'Regale', 'Alles hier']) {
    expect(treffer).toContainEqual(expect.stringContaining(`${name}: `))
  }
  expect(treffer.filter((t) => !t.endsWith(': frei'))).toEqual([])
}

test.describe('Karte und Leiste', () => {
  for (const { breite, hoehe } of [
    { breite: 390, hoehe: 844 },
    { breite: 360, hoehe: 640 },
  ]) {
    test(`${breite}×${hoehe}: die offene Karte steht über der Leiste und lässt sie frei`, async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, 'Hochformat am Handy')
      await page.setViewportSize({ width: breite, height: hoehe })
      await oeffne(page)
      const sheet = await oeffneKarte(page, KEKSE.name)

      // Chips, „Alles hier“, Raumwechsel und „Quellen“ bleiben zu treffen.
      await erwarteLeisteFrei(page)

      // Titel, Kurztext und Knöpfe stehen ganz in der Karte - ohne Scrollen.
      for (const teil of [
        sheet.getByRole('heading', { name: KEKSE.name }),
        sheet.getByText(KEKSE.kurztext),
        sheet.getByRole('button', { name: 'Mehr lesen' }),
        sheet.getByRole('link', { name: 'Mehr auf der Website' }),
        sheet.getByRole('button', { name: 'Schließen' }),
      ]) {
        await expect(teil).toBeInViewport({ ratio: 1 })
      }
      expect(
        await sheet
          .getByTestId('sheet-inhalt')
          .evaluate((el) => el.scrollHeight - el.clientHeight)
      ).toBeLessThanOrEqual(0)

      // Zugeklappt nehmen Karte und Leiste höchstens die halbe Höhe ein,
      // und die Karte endet über der Leiste.
      const karte = await sheet.boundingBox()
      const leiste = await page.getByTestId('blickpunkt-leiste').boundingBox()
      if (!karte || !leiste) throw new Error('Karte oder Leiste fehlt')
      expect(hoehe - karte.y).toBeLessThanOrEqual(hoehe / 2)
      expect(karte.y + karte.height).toBeLessThanOrEqual(leiste.y)
    })
  }

  test('844×390: auch die aufgeklappte Karte lässt die Leiste frei', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Querformat am Handy')
    await page.setViewportSize({ width: 844, height: 390 })
    await oeffne(page)
    await wechsleZu(page, 'Brotregal')
    const sheet = await oeffneKarte(page, KRUSTE)
    await erwarteLeisteFrei(page)

    // Der lange Text macht die Karte so hoch, wie sie werden darf.
    await sheet.getByRole('button', { name: 'Mehr lesen' }).click()
    await expect(sheet).toHaveAttribute('data-aufgeklappt', 'true')
    await erwarteLeisteFrei(page)
    const karte = await sheet.boundingBox()
    const leiste = await page.getByTestId('blickpunkt-leiste').boundingBox()
    if (!karte || !leiste) throw new Error('Karte oder Leiste fehlt')
    expect(karte.y + karte.height).toBeLessThanOrEqual(leiste.y)
  })

  test('der Hinweis nennt die Bedienung des Geräts', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    const hinweis = page.getByTestId('hinweis')
    await expect(hinweis).toHaveAttribute('data-sichtbar', 'true')
    const [zeigt, nicht] = hasTouch
      ? ['Tippen für Infos', 'Klicken für Infos']
      : ['Klicken für Infos', 'Tippen für Infos']
    await expect(hinweis.getByText(zeigt, { exact: false })).toBeVisible()
    await expect(hinweis.getByText(nicht, { exact: false })).toBeHidden()
  })

  test('mit der Maus am Griff ziehen: kurz federt zurück, weit schließt', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Maus gibt es am Desktop.')
    // Schmal und hoch: die Karte steht unten über der Leiste.
    await page.setViewportSize({ width: 800, height: 1000 })
    await oeffne(page)
    const sheet = await oeffneKarte(page, KEKSE.name)
    const titel = await sheet
      .getByRole('heading', { name: KEKSE.name })
      .boundingBox()
    if (!titel) throw new Error('Titel fehlt')
    const x = titel.x + titel.width / 2
    const y = titel.y + titel.height / 2
    const verschiebung = () =>
      sheet.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)

    // 40 px: unter der Schwelle. Losgelassen neben der Karte (links am Rand).
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 40, { steps: 5 })
    await expect.poll(verschiebung).toBe(40)
    await page.mouse.move(2, y + 40, { steps: 5 })
    await page.mouse.up()
    await steht(sheet)
    await expect(sheet).toBeVisible()
    // Der Titel ist beim Ziehen nicht markiert worden.
    expect(
      await page.evaluate(() => window.getSelection()?.toString() ?? '')
    ).toBe('')

    // 100 px: über der Schwelle - zu.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 100, { steps: 10 })
    await page.mouse.up()
    await expect(sheet).toBeHidden()
  })

  test('auf dem Text nach unten wischen: kurz federt zurück, weit schließt', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Wischen gibt es am Handy.')
    await oeffne(page)
    const sheet = await oeffneKarte(page, KEKSE.name)
    const text = await sheet.getByText(KEKSE.kurztext).boundingBox()
    if (!text) throw new Error('Kurztext fehlt')
    // Echte Berührungen über das DevTools-Protokoll: So entscheidet Chromium
    // selbst, ob es scrollt - wie auf dem Handy.
    const cdp = await page.context().newCDPSession(page)
    const x = text.x + text.width / 2
    const y = text.y + text.height / 2
    const wische = async (weg: number) => {
      const punkt = (dy: number) => [{ x, y: y + dy, id: 1 }]
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: punkt(0),
      })
      for (let i = 1; i <= 10; i += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: punkt((weg * i) / 10),
        })
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
    }

    await wische(30)
    await steht(sheet)
    await expect(sheet).toBeVisible()

    await wische(120)
    await expect(sheet).toBeHidden()
  })
})
