/**
 * @fileoverview Mehrere Räume (DB11): Raum wechseln, Station antippen →
 * Karte, Link in einen Raum, „Zurück“, Liste, Tür, Ersatz ohne WebGL, kein
 * Leck beim Wechseln. Der zweite Raum ist die erfundene „Testbackstube“ des
 * Fixtures (vier Kisten als Stationen) - eine echte Backstube gibt es noch
 * nicht als Modell.
 */
import { expect, test } from '@playwright/test'
import {
  LADEN,
  NUR_BACKSTUBE,
  NUR_LADEN,
  PFAD,
  PREIS,
  STATIONEN,
  TESTBACKSTUBE,
  allesHierListe,
  erwarteKeinePreise,
  imRaum,
  knotenNamen,
  oeffne,
  oeffneRaum,
  ohneWebGL,
  produktSheet,
  protokolliere,
  raumWechsel,
  ruhe,
  szene,
  tippeAufPlatz,
  webglKontexte,
  wechsleZu,
} from './support/app'

const hervorgehoben = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__digitaleBaeckerei?.hervorgehoben ?? null)
const raumInAdresse = (page: import('@playwright/test').Page) =>
  new URL(page.url()).searchParams.get('raum')

test.describe('Raum wechseln', () => {
  test('der Knopf in der Leiste führt in die Testbackstube und wieder zurück', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)
    const knopf = raumWechsel(page)
    await expect(knopf).toHaveText(TESTBACKSTUBE.wechsel)
    // Daumenreichweite: unten in der Leiste, groß genug für einen Finger.
    const rahmen = await knopf.boundingBox()
    const hoehe = page.viewportSize()?.height ?? 0
    expect(rahmen?.height).toBeGreaterThanOrEqual(44)
    expect(rahmen?.y).toBeGreaterThan(hoehe * 0.6)

    await knopf.click()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
    expect(raumInAdresse(page)).toBe(TESTBACKSTUBE.id)
    // Das Modell des Ladens ist weg, das der Backstube steht - und ist zu sehen.
    expect(await knotenNamen(page, NUR_LADEN)).toEqual([])
    expect(await knotenNamen(page, 'produkt/')).toEqual([])
    await expect(page.locator('canvas')).toHaveCount(1)
    const bild = await page.evaluate(() =>
      window.__digitaleBaeckerei?.pixelStats()
    )
    expect(bild?.distinct).toBeGreaterThan(3)
    // Die Leiste zeigt die Blickpunkte dieses Raums.
    const leiste = page.getByTestId('blickpunkt-leiste')
    for (const blickpunkt of TESTBACKSTUBE.blickpunkte) {
      await expect(
        leiste.getByRole('button', { name: blickpunkt.name, exact: true })
      ).toBeVisible()
    }
    await expect(
      leiste.getByRole('button', { name: 'Theke', exact: true })
    ).toHaveCount(0)
    // Kamera sauber am Start-Blickpunkt des neuen Raums.
    const info = await page.evaluate(() => window.__digitaleBaeckerei?.info())
    expect(info?.blickpunkt).toBe(TESTBACKSTUBE.start)
    expect(info?.intro.laeuft).toBe(false)

    await expect(raumWechsel(page)).toHaveText(LADEN.wechsel)
    await raumWechsel(page).click()
    await imRaum(page, LADEN, NUR_LADEN)
    expect(raumInAdresse(page)).toBeNull()
    expect(await knotenNamen(page, NUR_BACKSTUBE)).toEqual([])
    await erwarteKeinePreise(page)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.antworten).toEqual([])
  })

  test('das Modell des anderen Raums wird erst beim Wechsel geladen', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)
    const modelle = () =>
      protokoll.anfragen
        .filter((url) => url.endsWith('.glb'))
        .map((url) => url.split('/').pop())
    expect(modelle()).toEqual([LADEN.modell])
    await raumWechsel(page).click()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
    expect(modelle()).toEqual([LADEN.modell, TESTBACKSTUBE.modell])
  })

  test('„Zurück“ und „Vor“ im Browser wechseln den Raum', async ({ page }) => {
    await oeffne(page)
    await raumWechsel(page).click()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)

    await page.goBack()
    await imRaum(page, LADEN, NUR_LADEN)
    expect(raumInAdresse(page)).toBeNull()
    // Der Messhaken (`?debug`) und `?intro=0` stehen noch in der Adresse.
    expect(new URL(page.url()).searchParams.has('debug')).toBe(true)

    await page.goForward()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
    expect(raumInAdresse(page)).toBe(TESTBACKSTUBE.id)
  })

  test('nichts wird auf dem Gerät gespeichert', async ({ page }) => {
    await oeffne(page)
    await raumWechsel(page).click()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
    const gespeichert = await page.evaluate(() => ({
      lokal: window.localStorage.length,
      sitzung: window.sessionStorage.length,
      cookies: document.cookie,
    }))
    expect(gespeichert).toEqual({ lokal: 0, sitzung: 0, cookies: '' })
  })

  test('mehrmals hin und her lässt keinen WebGL-Kontext zurück', async ({
    page,
  }) => {
    await oeffne(page)
    const kontexte = await webglKontexte(page)
    const vorher = await kontexte()
    expect(vorher).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < 3; i += 1) {
      await raumWechsel(page).click()
      await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
      await raumWechsel(page).click()
      await imRaum(page, LADEN, NUR_LADEN)
    }
    // Sechs Szenen wurden gebaut und abgebaut: Es bleibt bei der einen (der
    // zuletzt abgebaute Kontext darf noch an einem Rest hängen).
    await expect
      .poll(kontexte, { timeout: 15_000 })
      .toBeLessThanOrEqual(vorher + 1)
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})

test.describe('Link in einen Raum', () => {
  test('?raum=<id> öffnet die Testbackstube - ohne das Modell des Ladens zu laden', async ({
    page,
  }) => {
    const protokoll = await oeffneRaum(page, TESTBACKSTUBE)
    await expect(szene(page, 'Ofen')).toBeVisible()
    expect(
      protokoll.anfragen
        .filter((url) => url.endsWith('.glb'))
        .map((url) => url.split('/').pop())
    ).toEqual([TESTBACKSTUBE.modell])
    await expect(raumWechsel(page)).toHaveText(LADEN.wechsel)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.antworten).toEqual([])

    // Neu laden bleibt im Raum.
    await page.reload()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
  })

  test('ein unbekannter Raum landet im Laden', async ({ page }) => {
    const protokoll = protokolliere(page)
    await page.goto(`${PFAD}?debug&intro=0&raum=keller`)
    await imRaum(page, LADEN, NUR_LADEN)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
  })
})

test.describe('Stationen der Testbackstube', () => {
  test('Station antippen öffnet ihre Karte und hebt sie hervor', async ({
    page,
    hasTouch,
  }) => {
    await oeffneRaum(page, TESTBACKSTUBE)
    await tippeAufPlatz(page, STATIONEN.ofen.knoten, hasTouch)
    const karte = produktSheet(page)
    await expect(karte).toBeVisible()
    await expect(karte.getByRole('heading')).toHaveText(STATIONEN.ofen.titel)
    await expect(karte).toContainText('Ein erfundener Ofen aus zwei Kisten.')
    await ruhe(page)
    expect(await hervorgehoben(page)).toBe(STATIONEN.ofen.knoten)
    // Der lange Text steckt hinter „Mehr lesen“; eine Nahansicht gibt es nicht.
    await karte.getByRole('button', { name: 'Mehr lesen' }).click()
    await expect(karte).toContainText('Der Testofen steht nur in den Tests.')
    await expect(
      karte.getByRole('button', { name: 'In 3D ansehen' })
    ).toHaveCount(0)
    await expect(karte).not.toContainText(PREIS)

    await karte.getByRole('button', { name: 'Schließen' }).click()
    await expect(karte).toBeHidden()
    await ruhe(page)
    expect(await hervorgehoben(page)).toBeNull()
  })

  test('eine andere Station wechselt die Karte, eine ohne Infopunkt schließt sie', async ({
    page,
    hasTouch,
  }) => {
    await oeffneRaum(page, TESTBACKSTUBE)
    await tippeAufPlatz(page, STATIONEN.kneter.knoten, hasTouch)
    const karte = produktSheet(page)
    await expect(karte.getByRole('heading')).toHaveText(STATIONEN.kneter.titel)
    await karte.getByRole('button', { name: 'Schließen' }).click()
    await expect(karte).toBeHidden()

    await tippeAufPlatz(page, STATIONEN.ofen.knoten, hasTouch)
    await expect(karte.getByRole('heading')).toHaveText(STATIONEN.ofen.titel)
    await karte.getByRole('button', { name: 'Schließen' }).click()
    await expect(karte).toBeHidden()

    // Die Spüle hat keinen Infopunkt: kein Tipp öffnet eine Karte.
    await tippeAufPlatz(page, STATIONEN.ohneInfo.knoten, hasTouch)
    await ruhe(page)
    await expect(karte).toBeHidden()
    expect(await hervorgehoben(page)).toBeNull()
  })

  test('„Alles hier“ listet die Stationen des Blickpunkts; die Auswahl öffnet die Karte', async ({
    page,
  }) => {
    await oeffneRaum(page, TESTBACKSTUBE)
    await page.getByRole('button', { name: 'Alles hier' }).click()
    const liste = allesHierListe(page)
    await expect(liste).toBeVisible()
    await expect(liste.getByRole('heading')).toHaveText('Alles hier: Ofen')
    await expect(liste.getByRole('listitem')).toHaveText([
      STATIONEN.kneter.titel,
      STATIONEN.ofen.titel,
    ])
    // Produkte gibt es hier keine - also auch kein „entdeckt x von y“.
    await expect(liste.getByTestId('entdeckt')).toHaveCount(0)

    await liste.getByRole('button', { name: STATIONEN.ofen.titel }).click()
    await expect(liste).toBeHidden()
    await expect(produktSheet(page).getByRole('heading')).toHaveText(
      STATIONEN.ofen.titel
    )
    await ruhe(page)
    expect(await hervorgehoben(page)).toBe(STATIONEN.ofen.knoten)
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()

    await wechsleZu(page, 'Arbeitstisch', TESTBACKSTUBE)
    await page.getByRole('button', { name: 'Alles hier' }).click()
    await expect(liste.getByRole('listitem')).toHaveText([
      STATIONEN.tisch.titel,
    ])
  })

  test('die Tür am Arbeitstisch führt zurück in den Laden', async ({
    page,
    hasTouch,
  }) => {
    await oeffneRaum(page, TESTBACKSTUBE)
    await wechsleZu(page, 'Arbeitstisch', TESTBACKSTUBE)
    await tippeAufPlatz(page, STATIONEN.tisch.knoten, hasTouch)
    await expect(produktSheet(page).getByRole('heading')).toHaveText(
      STATIONEN.tisch.titel
    )
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()
    await expect(produktSheet(page)).toBeHidden()

    await tippeAufPlatz(page, STATIONEN.tuer.knoten, hasTouch)
    await imRaum(page, LADEN, NUR_LADEN)
    expect(raumInAdresse(page)).toBeNull()
    // Die Tür war ein eigener Schritt: „Zurück“ führt wieder in die Backstube.
    await page.goBack()
    await imRaum(page, TESTBACKSTUBE, NUR_BACKSTUBE)
  })
})

test.describe('Ohne WebGL: alle Räume als Liste', () => {
  test('zeigt beide Räume mit Überschrift - Produkte im Laden, Stationen in der Testbackstube', async ({
    page,
  }) => {
    await ohneWebGL(page)
    const protokoll = protokolliere(page)
    await page.goto(`${PFAD}?raum=${TESTBACKSTUBE.id}`)

    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(raumWechsel(page)).toHaveCount(0)
    await expect(ersatz.getByRole('heading', { level: 3 })).toHaveText([
      LADEN.name,
      TESTBACKSTUBE.name,
    ])

    const backstube = ersatz.getByRole('region', { name: TESTBACKSTUBE.name })
    for (const blickpunkt of TESTBACKSTUBE.blickpunkte) {
      await expect(
        backstube.getByRole('heading', { name: blickpunkt.name, exact: true })
      ).toBeVisible()
    }
    await expect(backstube.getByRole('listitem')).toHaveText([
      /Testkneter.*Ein erfundener Kneter mit Kessel\./,
      /Testofen.*Ein erfundener Ofen aus zwei Kisten\./,
      /Testtisch.*Ein erfundener Arbeitstisch/,
    ])
    // Die Spüle hat keinen Infopunkt und steht nirgends.
    await expect(ersatz).not.toContainText(/sp(ue|ü)le/i)
    await expect(
      ersatz.getByRole('region', { name: LADEN.name }).getByRole('listitem')
    ).not.toHaveCount(0)
    await expect(ersatz).not.toContainText(PREIS)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
  })
})
