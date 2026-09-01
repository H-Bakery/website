import { expect, test } from '@playwright/test'

/**
 * Fahrer-App der Samstagsauslieferung.
 *
 * Die Tests fahren den Weg ab, den der Fahrer morgens nimmt: Tour oeffnen,
 * Reihenfolge berechnen, Stopps abhaken. Sie legen ihre eigenen Stopps an und
 * raeumen sie wieder weg, damit sie den Liefer-Store nicht vollmuellen.
 */

const API = process.env['API_URL'] || 'http://localhost:5000'

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
})
