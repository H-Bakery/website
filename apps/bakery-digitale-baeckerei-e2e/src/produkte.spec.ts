/**
 * @fileoverview Produkte: im Bild antippen (auch durch Glas), das Bottom-Sheet
 * ohne Preis, die Liste „Alles hier“ - alles mit den erfundenen Produkten des
 * Fixtures.
 *
 * Die Plätze, die hier angetippt werden, liegen an der Theke mitten im Bild
 * (Hoch- und Querformat): siehe `src/test/fixtures/README.md` der App. Was die
 * Suite von der App erwartet, steht im Kopf von `support/app.ts`.
 */
import { expect, test } from '@playwright/test'
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
