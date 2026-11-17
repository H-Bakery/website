/**
 * @fileoverview Datenabruf: Eine kurze Störung beim Laden der Produktdaten
 * heilt von selbst. Die App wiederholt einen Abruf, der am Netz scheitert -
 * ohne dass jemand „Noch einmal versuchen“ tippt -, und Karte und Liste
 * „Alles hier“ haben ihre Produkte. Alles mit den erfundenen Produkten des
 * Fixtures.
 *
 * Was die Suite von der App erwartet, steht im Kopf von `support/app.ts`.
 */
import { expect, test } from '@playwright/test'
import {
  allesHierListe,
  erwarteteEintraege,
  moebelVon,
  oeffne,
  produktSheet,
  tippeAufPlatz,
} from './support/app'

/** Steht auf der Vitrine an der Theke, mitten im Bild (wie in produkte.spec). */
const KEKSE = { slot: 'theke/vitrine/ebene-3/platz-01', name: 'Testkekse' }

test('ein abgebrochener erster Abruf der Produktdaten wird von selbst wiederholt', async ({
  page,
  hasTouch,
}) => {
  const abrufe: string[] = []
  await page.route('**/data/products.snapshot.json', async (route) => {
    abrufe.push(route.request().url())
    // Nur der erste Abruf scheitert (wie ein kurzes Funkloch).
    if (abrufe.length === 1) await route.abort('failed')
    else await route.continue()
  })
  const protokoll = await oeffne(page)

  // Ohne einen Klick dazwischen: Antippen öffnet die Karte des Produkts …
  await tippeAufPlatz(page, KEKSE.slot, hasTouch)
  const sheet = produktSheet(page)
  await expect(sheet.getByText(KEKSE.name, { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(sheet).toBeHidden()

  // … und „Alles hier“ zeigt die Zeilen der Theke.
  await page.getByRole('button', { name: 'Alles hier' }).click()
  const liste = allesHierListe(page)
  await expect(liste).toBeVisible()
  const theke = erwarteteEintraege(moebelVon('theke'))
  expect(theke.length).toBeGreaterThan(0)
  for (const eintrag of theke) {
    await expect(
      liste.getByText(eintrag.name, { exact: true }).first()
    ).toBeVisible()
  }

  // Genau ein zweiter Abruf, und nichts ist dabei kaputtgegangen.
  expect(abrufe).toHaveLength(2)
  expect(protokoll.ausnahmen).toEqual([])
})
