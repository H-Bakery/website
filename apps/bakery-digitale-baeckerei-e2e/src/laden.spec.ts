/**
 * @fileoverview Die Digitale Bäckerei, wie sie ausgeliefert wird: statischer
 * Export unter `/digitale-baeckerei`, mit dem synthetischen Mini-Modell
 * (`apps/bakery-digitale-baeckerei/src/test/fixtures/`). Diese Datei prüft das
 * Laden - alles hier trägt schon der Stand P0.
 */
import { expect, test } from '@playwright/test'
import {
  EINGERICHTET,
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

  test('darf in den Suchindex und nennt ihre Adresse auf der Landingpage', async ({
    page,
  }) => {
    await oeffne(page)

    // Seit der Abnahme (P2) gibt es kein noindex mehr.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://xn--bckerei-heusser-0kb.de/digitale-baeckerei/'
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
