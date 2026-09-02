import { expect, test, type Route } from '@playwright/test'

/**
 * Fahrer-App der Samstagsauslieferung.
 *
 * Die Tests fahren den Weg ab, den der Fahrer morgens nimmt: Tour oeffnen,
 * Reihenfolge berechnen, Stopps abhaken. Sie legen ihre eigenen Stopps an und
 * raeumen sie wieder weg, damit sie den Liefer-Store nicht vollmuellen.
 */

// Muss zu `playwright.config.ts` passen: API_URL, sonst API_PORT, sonst 5000.
const API =
  process.env['API_URL'] ||
  `http://localhost:${process.env['API_PORT'] || '5000'}`

test.describe('Liefertour', () => {
  test('zeigt Kopf und Bedienelemente der Tour', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toHaveText('Liefertour')
    await expect(page.getByText('Bäckerei Heusser')).toBeVisible()
    await expect(page.getByLabel('Fahrer', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Tag', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Nächster Samstag' })
    ).toBeVisible()
  })

  test('legt einen Stopp an, berechnet die Route und hakt ihn ab', async ({
    page,
    request,
  }) => {
    // Eigene Tour, damit der Test nicht an fremden Daten haengt.
    const created = await request.post(`${API}/api/deliveries/tours`, {
      data: { date: '2026-09-05', driverId: 1, name: 'E2E-Tour' },
    })
    expect(created.ok()).toBeTruthy()
    const tour = await created.json()

    try {
      await page.goto('/')
      await page.getByLabel('Tag', { exact: true }).fill('2026-09-05')
      await page
        .getByRole('combobox', { name: 'Tour' })
        .selectOption(String(tour.id))

      await page.getByRole('button', { name: 'Tour planen' }).click()
      await page.getByLabel('Kunde *', { exact: true }).fill('E2E Testkunde')
      await page
        .getByLabel('Straße und Hausnummer *', { exact: true })
        .fill('Talstraße 5')
      await page.getByLabel('Ware', { exact: true }).fill('2x Bauernbrot')
      await page.getByRole('button', { name: 'Stopp hinzufügen' }).click()

      const stop = page
        .getByRole('listitem')
        .filter({ hasText: 'E2E Testkunde' })
      await expect(stop.first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('2× Bauernbrot').first()).toBeVisible()

      await page.getByRole('button', { name: 'Route berechnen' }).click()
      // Strecke steht erst, wenn der Router geantwortet hat (oder geschaetzt wurde).
      await expect(page.getByText(/\d+(,\d+)? (m|km)/).first()).toBeVisible({
        timeout: 20_000,
      })

      await page.getByRole('button', { name: 'Geliefert' }).first().click()
      await expect(page.getByText(/1 von 1 geliefert/)).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText('Abgeschlossen')).toBeVisible()
    } finally {
      await request.delete(`${API}/api/deliveries/tours/${tour.id}`)
    }
  })

  test('rendert eine Genauigkeit von 0 m als Text, nicht als nackte Null', async ({
    page,
    context,
  }) => {
    // Regression: `{location.accuracy && <p/>}` liess React bei 0 eine nackte
    // 0 in die Seite schreiben.
    await context.setGeolocation({
      latitude: 49.3226,
      longitude: 7.3389,
      accuracy: 0,
    })
    await page.goto('/')

    await expect(page.getByText('49.32260, 7.33890 · ±0 m')).toBeVisible({
      timeout: 15_000,
    })

    const lines = (await page.locator('body').innerText()).split('\n')
    expect(lines.filter((line) => line.trim() === '0')).toHaveLength(0)
  })

  test('bleibt bedienbar, wenn ein Tag ohne Tour gewählt wird', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Tag', { exact: true }).fill('2030-01-05')

    await expect(
      page.getByRole('button', { name: 'Tour anlegen' })
    ).toBeVisible({
      timeout: 15_000,
    })
  })

  test('zeigt im Funkloch die gespeicherte Tour, auch nach dem Neuladen', async ({
    page,
    request,
  }) => {
    // Eigener Tag je Playwright-Projekt: beide laufen parallel gegen
    // denselben Store und sollen sich nicht gegenseitig die Tour vorsetzen.
    const date =
      test.info().project.name === 'chromium' ? '2027-03-06' : '2027-03-13'
    const created = await request.post(`${API}/api/deliveries/tours`, {
      data: { date, driverId: 1, name: 'Funkloch-Tour' },
    })
    expect(created.ok()).toBeTruthy()
    const tour = await created.json()

    try {
      // Koordinaten direkt mitgeben - der Test soll nicht an Nominatim haengen.
      const added = await request.post(
        `${API}/api/deliveries/tours/${tour.id}/stops`,
        {
          data: {
            customer: 'Funkloch Testkunde',
            street: 'Talstraße 5',
            zip: '66424',
            city: 'Homburg',
            phone: '06841 12345',
            lat: 49.3226,
            lon: 7.3389,
          },
        }
      )
      expect(added.ok()).toBeTruthy()

      await page.goto('/')
      await page.getByLabel('Tag', { exact: true }).fill(date)
      await expect(page.getByText('Funkloch Testkunde').first()).toBeVisible({
        timeout: 15_000,
      })

      // Funkloch: kein Aufruf erreicht die API. Dann Neuladen - so kommt das
      // Handy aus der Navi-App zurueck. Der Tag ist bewusst nicht gespeichert
      // (nach dem Neuladen steht der naechste Samstag), also noch einmal waehlen.
      await page.route('**/api/deliveries/**', (route) => route.abort())
      await page.reload()
      await page.getByLabel('Tag', { exact: true }).fill(date)

      await expect(page.getByText('Funkloch Testkunde').first()).toBeVisible({
        timeout: 15_000,
      })
      await expect(
        page.getByText('Talstraße 5, 66424 Homburg').first()
      ).toBeVisible()
      await expect(page.getByLabel('Fahrer', { exact: true })).toHaveValue('1')
      await expect(
        page.getByText(/Gespeicherter Stand von \d{2}:\d{2} Uhr/)
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Tour anlegen' })
      ).toHaveCount(0)
      await expect(
        page.getByText('Keine Verbindung zur Bäckerei-API')
      ).toHaveCount(0)

      // Abhaken ohne Netz landet in der Warteschlange - und bleibt auch nach
      // einem weiteren Neuladen auf der Kopie sichtbar.
      await page.getByRole('button', { name: 'Geliefert' }).first().click()
      await expect(page.getByText(/1 von 1 geliefert/)).toBeVisible()
      await page.reload()
      await page.getByLabel('Tag', { exact: true }).fill(date)
      await expect(page.getByText(/1 von 1 geliefert/)).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText(/1 offen/)).toBeVisible()
    } finally {
      await request.delete(`${API}/api/deliveries/tours/${tour.id}`)
    }
  })

  test('zeigt bei leerer Kopie ohne API „Erneut laden“, nicht „Tour anlegen“', async ({
    page,
  }) => {
    // Zuletzt online gesehen: an diesem Tag war nichts geplant. Ohne Server
    // ist das genauso wenig pruefbar wie gar keine Antwort - seit dem letzten
    // Blick kann die Backstube die Tour angelegt haben. Eine leere Kopie
    // darf deshalb kein "Tour anlegen" anbieten.
    await page.goto('/')
    await page.getByLabel('Tag', { exact: true }).fill('2030-01-05')
    await expect(
      page.getByRole('button', { name: 'Tour anlegen' })
    ).toBeVisible({ timeout: 15_000 })

    await page.route('**/api/deliveries/**', (route) => route.abort())
    await page.reload()
    await page.getByLabel('Tag', { exact: true }).fill('2030-01-05')

    await expect(
      page.getByRole('heading', { name: 'Tour konnte nicht geladen werden' })
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: 'Tour anlegen' })
    ).toHaveCount(0)
    await expect(page.getByText(/noch nichts geplant/)).toHaveCount(0)
    await expect(page.getByText(/Gespeicherter Stand/)).toHaveCount(0)
  })

  test('bietet ohne API kein „Tour anlegen“ an, sondern „Erneut laden“', async ({
    page,
  }) => {
    // Server aus oder Funkloch: jede Anfrage scheitert wie im Browser mit
    // "Failed to fetch". Vorher stand dann "noch nichts geplant" samt aktivem
    // "Tour anlegen" da - obwohl die Tour auf dem Server längst existierte.
    const apiDown = (route: Route) => route.abort('connectionrefused')
    await page.route('**/api/deliveries/**', apiDown)
    await page.goto('/')
    await page.getByLabel('Tag', { exact: true }).fill('2030-01-05')

    await expect(
      page.getByRole('heading', { name: 'Tour konnte nicht geladen werden' })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/noch nichts geplant/)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Tour anlegen' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Keine Verbindung' })
    ).toBeVisible()

    // Netz zurück: "Erneut laden" holt den echten Stand des Tages.
    await page.unroute('**/api/deliveries/**', apiDown)
    await page.getByRole('button', { name: 'Erneut laden' }).click()

    await expect(
      page.getByRole('button', { name: 'Tour anlegen' })
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: 'Erneut laden' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Keine Verbindung' })
    ).toHaveCount(0)
  })
})
