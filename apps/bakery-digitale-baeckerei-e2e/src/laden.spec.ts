/**
 * @fileoverview Die Digitale Bäckerei, wie sie ausgeliefert wird: statischer
 * Export unter `/digitale-baeckerei`, mit dem synthetischen Mini-Modell
 * (`apps/bakery-digitale-baeckerei/src/test/fixtures/`). Diese Datei prüft das
 * Laden - alles hier trägt schon der Stand P0.
 */
import { expect, test, type Page, type Route } from '@playwright/test'
import {
  EINGERICHTET,
  PFAD,
  VARIANTE,
  allesHierListe,
  erwarteKeinePreise,
  erwarteteEintraege,
  moebelVon,
  oeffne,
  ohneWebGL,
  produktSheet,
  protokolliere,
  ruhe,
  tippeAufPlatz,
} from './support/app'

/** Steht auf der Vitrine, mitten im Bild (wie in produkte.spec.ts). */
const KEKSE = { slot: 'theke/vitrine/ebene-3/platz-01', name: 'Testkekse' }

/** Dateiname am Ende einer Adresse. */
const dateiVon = (url: string) => new URL(url).pathname.split('/').pop() ?? ''

/**
 * Nachgeladener Code: alles unter `_next/static/chunks/`, was das HTML nicht
 * schon nennt - beim Start ist das die Szene mit three.js.
 */
async function nachgeladenerCode(
  page: Page,
  html: string,
  umgang: (route: Route) => unknown
): Promise<void> {
  await page.route('**/_next/static/chunks/**', (route) => {
    const datei = dateiVon(route.request().url())
    if (datei && !html.includes(datei)) return umgang(route)
    return route.continue()
  })
}

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
    // Sonst ist jeder Platz zu sehen - bis auf den, den die synthetische
    // Einrichtung leert (DB12) -, und kein Platz ist doppelt belegt.
    expect(plaetze.filter((n) => !n.visible).map((n) => n.name)).toEqual([
      `produkt/${VARIANTE.slot}@feierabend`,
      `produkt/${EINGERICHTET.leer.slot}`,
    ])
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

test.describe('Das Modell wird vorab geladen', () => {
  // Der Fixture-Build hat zwei Räume: Welches Modell gebraucht wird, steht
  // erst in der Adresse - darum setzt ein kleines Skript im <head> den
  // preload-Link (mit nur einem Raum steht er fest im HTML; das prüft
  // `src/app/layout.spec.tsx` der App).
  test('wird schon mit dem HTML angefragt und genau einmal geholt', async ({
    page,
    baseURL,
    request,
  }) => {
    const html = await (await request.get(PFAD)).text()
    const kopf = html.slice(0, html.indexOf('</head>'))
    expect(kopf).toContain('"/digitale-baeckerei/model/twin.glb"')
    expect(kopf).toContain("l.rel='preload';l.setAttribute('as','fetch')")

    const protokoll = await oeffne(page)
    const links = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="preload"]')
      )
        .filter((l) => l.as === 'fetch')
        .map((l) => ({ href: l.getAttribute('href'), cors: l.crossOrigin }))
    )
    expect(links).toEqual([
      { href: '/digitale-baeckerei/model/twin.glb', cors: 'anonymous' },
    ])
    await page.waitForLoadState('networkidle')
    const modell = `${baseURL}${PFAD}model/twin.glb`
    expect(protokoll.anfragen.filter((url) => url === modell)).toHaveLength(1)
    // Auch der Browser selbst hat es nur einmal übertragen - der Abruf der
    // App nimmt die vorab geladene Antwort.
    const uebertragen = await page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((e) => e.name.endsWith('/model/twin.glb'))
          .filter((e) => (e as PerformanceResourceTiming).transferSize > 0)
          .length
    )
    expect(uebertragen).toBe(1)
    // Kein „preload nicht benutzt“ in der Konsole.
    expect(protokoll.konsole).toEqual([])
  })
})

test.describe('Der 3D-Code lädt nicht', () => {
  test('zeigt den Ladefehler auf Deutsch mit der Liste, der zweite Versuch gelingt', async ({
    page,
    request,
  }) => {
    // Alles, was das HTML nicht schon nennt, ist nachgeladen: die Szene mit
    // three.js. Genau diese Dateien brechen ab - wie im wackligen Mobilnetz.
    const html = await (await request.get(PFAD)).text()
    let abbrechen = true
    await page.route('**/_next/static/chunks/**', (route) => {
      const datei = new URL(route.request().url()).pathname.split('/').pop()
      if (abbrechen && datei && !html.includes(datei)) return route.abort()
      return route.continue()
    })
    const ausnahmen: string[] = []
    page.on('pageerror', (error) => ausnahmen.push(error.message))

    await page.goto(`${PFAD}?debug`)
    await expect(page.locator('main[data-zustand="fehler"]')).toBeVisible()
    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz.getByRole('status')).toContainText(
      'Der Laden konnte nicht geladen werden.'
    )
    // Die Liste bleibt benutzbar, die Seite steht - auf Deutsch.
    await expect(ersatz.getByText('Testkekse', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Digitale Bäckerei' })
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Application error/i)
    expect(ausnahmen).toEqual([])
    await erwarteKeinePreise(page)

    abbrechen = false
    await ersatz.getByRole('button', { name: 'Noch einmal versuchen' }).click()
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})

test.describe('Fortschritt ab dem ersten Byte', () => {
  test('der Balken läuft schon, während der 3D-Code noch unterwegs ist', async ({
    page,
    request,
  }) => {
    // Der three-Chunk kommt erst nach 4 s - wie im langsamen Mobilnetz. Das
    // Modell holt die App unabhängig davon und zeigt, wie weit es ist.
    const html = await (await request.get(PFAD)).text()
    let verzoegert = 0
    await nachgeladenerCode(page, html, async (route) => {
      verzoegert += 1
      await new Promise((weiter) => setTimeout(weiter, 4000))
      return route.continue()
    })

    await page.goto(`${PFAD}?debug&intro=0`)
    // Ein Moment, in dem der Balken mehr als 0 % zeigt und noch kein Canvas
    // da ist - three also noch fehlt.
    await page.waitForFunction(
      () => {
        const text = document.querySelector(
          '[data-testid="lade-prozent"]'
        )?.textContent
        return (
          Number.parseInt(text ?? '', 10) > 0 &&
          document.querySelectorAll('canvas').length === 0
        )
      },
      undefined,
      { timeout: 20_000 }
    )
    expect(verzoegert).toBeGreaterThan(0)
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})

test.describe('Das Modell fehlt', () => {
  test('404: der Ladefehler mit der Liste, der zweite Versuch steht', async ({
    page,
  }) => {
    let fehlt = true
    let anfragen = 0
    await page.route('**/model/twin.glb', (route) => {
      anfragen += 1
      return fehlt
        ? route.fulfill({ status: 404, body: 'Nicht gefunden' })
        : route.continue()
    })
    await page.goto(`${PFAD}?debug&intro=0`)

    await expect(page.locator('main[data-zustand="fehler"]')).toBeVisible()
    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz.getByRole('status')).toContainText(
      'Der Laden konnte nicht geladen werden.'
    )
    await expect(ersatz.getByText(KEKSE.name, { exact: true })).toBeVisible()
    // Ein Fehlerstatus wird nicht wiederholt: höchstens der preload-Link und
    // ein Abruf der App.
    expect(anfragen).toBeLessThanOrEqual(2)

    fehlt = false
    await ersatz.getByRole('button', { name: 'Noch einmal versuchen' }).click()
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})

test.describe('Die Produktinfos fehlen', () => {
  test('„Noch einmal versuchen“ in „Alles hier“ holt sie; danach steht die Liste, und ein Tipp öffnet die Karte', async ({
    page,
    hasTouch,
  }) => {
    let fehlt = true
    await page.route('**/data/products.snapshot.json', (route) =>
      fehlt ? route.abort('failed') : route.continue()
    )
    await oeffne(page)
    // Ohne Produktinfos verspricht der Hinweis kein „Tippen für Infos“.
    await expect(page.getByTestId('hinweis')).toContainText(
      'Infos fehlen gerade'
    )

    await page.getByRole('button', { name: 'Alles hier' }).click()
    const liste = allesHierListe(page)
    await expect(liste).toContainText(
      'Die Produktinfos konnten nicht geladen werden.'
    )
    fehlt = false
    await liste.getByRole('button', { name: 'Noch einmal versuchen' }).click()
    for (const eintrag of erwarteteEintraege(moebelVon('theke'))) {
      await expect(
        liste.getByText(eintrag.name, { exact: true }).first()
      ).toBeVisible()
    }
    await liste.getByRole('button', { name: 'Schließen' }).click()
    await expect(liste).toBeHidden()

    // Die laufende Szene richtet sich jetzt nachträglich ein (DB12).
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window.__digitaleBaeckerei?.info() as unknown as {
                einrichtung: unknown
              }
            ).einrichtung !== null
        )
      )
      .toBe(true)
    await ruhe(page)
    await tippeAufPlatz(page, KEKSE.slot, hasTouch)
    await expect(
      produktSheet(page).getByText(KEKSE.name, { exact: true })
    ).toBeVisible()
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
    // Eine Warnung in der Konsole wäre in Ordnung, eine unbehandelte Ausnahme
    // nicht.
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
    await erwarteKeinePreise(page)
  })

  test('holt weder den 3D-Code noch (selbst) das Modell - nur die Liste', async ({
    page,
    request,
  }) => {
    const html = await (await request.get(PFAD)).text()
    await ohneWebGL(page)
    // Was die App selbst abruft; den preload-Link im HTML holt der Browser.
    await page.addInitScript(() => {
      const abrufe: string[] = []
      Object.assign(window, { __abrufe: abrufe })
      const original = window.fetch.bind(window)
      window.fetch = (eingabe, init) => {
        abrufe.push(
          typeof eingabe === 'string'
            ? eingabe
            : eingabe instanceof URL
            ? eingabe.href
            : eingabe.url
        )
        return original(eingabe, init)
      }
    })
    const protokoll = protokolliere(page)
    await page.goto(PFAD)

    await expect(page.locator('main[data-zustand="kein-webgl"]')).toBeVisible()
    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible()
    await expect(ersatz.getByText(KEKSE.name, { exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const nachgeladen = protokoll.anfragen
      .filter((url) => url.includes('/_next/static/chunks/'))
      .map(dateiVon)
      .filter((datei) => !html.includes(datei))
    expect(nachgeladen).toEqual([])
    const abrufe = await page.evaluate(
      () => (window as unknown as { __abrufe: string[] }).__abrufe
    )
    expect(abrufe.filter((url) => url.endsWith('.glb'))).toEqual([])
    expect(abrufe.length).toBeGreaterThan(0)
    // Im Netz höchstens der preload-Link.
    expect(
      protokoll.anfragen.filter((url) => url.endsWith('/model/twin.glb')).length
    ).toBeLessThanOrEqual(1)
    expect(protokoll.ausnahmen).toEqual([])
  })
})

test.describe('Titelkarte', () => {
  for (const [breite, hoehe] of [
    [390, 844],
    [844, 390],
  ]) {
    test(`${breite}×${hoehe}: nennt die Bäckerei, führt zur Website und endet oben bei höchstens 76 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breite, height: hoehe })
      await oeffne(page)
      const kopf = page.locator('header')
      await expect(
        kopf.getByRole('heading', { level: 1, name: 'Digitale Bäckerei' })
      ).toBeVisible()
      const link = kopf.getByRole('link', { name: 'Bäckerei Heusser' })
      await expect(link).toBeVisible()
      // Die Startseite der Website - nicht die der App unter dem Unterpfad.
      await expect(link).toHaveAttribute('href', '/')

      const karte = await kopf.boundingBox()
      expect(karte).not.toBeNull()
      expect((karte?.y ?? 0) + (karte?.height ?? 0)).toBeLessThanOrEqual(76)

      // Die Tippfläche des Links ist 44 px hoch, auch wenn die Zeile flacher ist.
      const flaeche = await link.evaluate((a) => {
        const { left, top, bottom, width } = a.getBoundingClientRect()
        const x = left + width / 2
        let oben = top
        while (document.elementFromPoint(x, oben - 1) === a) oben -= 1
        let unten = bottom
        while (document.elementFromPoint(x, unten) === a) unten += 1
        return unten - oben
      })
      expect(flaeche).toBeGreaterThanOrEqual(44)
    })
  }
})
