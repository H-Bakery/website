/**
 * @fileoverview Die Verwaltung gegen die echte API (F4).
 *
 * Läuft gegen den Build in `dist/apps/bakery-management` (CI) oder den
 * Dev-Server, jeweils mit der **echten API** (esbuild-Bundle,
 * `tools/e2e/real-api.js`: frische SQLite-Datenbank, Inhaber aus
 * `BOOTSTRAP_ADMIN_*`) und im Pilotbetrieb (`NEXT_PUBLIC_PILOT_MODE=1`, wie
 * auf der Box). App und API lesen dasselbe synthetische hq
 * (`prepareE2eHq()` in `tools/e2e/servers.js`): eine Kopie des
 * Produkt-Fixtures plus erfundene Kassenberichte und Finanzdaten. Deshalb
 * vergleicht die Suite Zahlen der Oberfläche mit dem, was die API liefert,
 * statt Werte fest zu verdrahten.
 *
 * Der Browser spricht die API nur über die eigene Origin an (`/api/...`,
 * `src/proxy.ts` reicht weiter) - ein CORS- oder Proxy-Fehler fiele hier auf.
 * Nichts hier speichert Produkte.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { E2E_ADMIN, apiCount, signIn } from './login'

test.describe('Anmeldung', () => {
  test('ohne Sitzung führt /admin zur Anmeldung', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/admin/products')
      await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fproducts/)
      await expect(
        page.getByRole('heading', { name: 'Anmeldung' })
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('Anmeldung über die Oberfläche an der echten API', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/admin/login?next=%2Fadmin%2Fproducts')
      await page.getByLabel(/Benutzername/).fill(E2E_ADMIN.username)
      await page.getByLabel(/Passwort/).fill(E2E_ADMIN.password)
      await page.getByRole('button', { name: /Anmelden/ }).click()
      await expect(page).toHaveURL(/\/admin\/products$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Produktverwaltung'
      )
    } finally {
      await context.close()
    }
  })

  test('ohne Sitzung liefert der Server keine Seitendaten aus', async ({
    playwright,
    baseURL,
  }) => {
    // Seiten mit Serverdaten (Dashboard-Kasse, Berichte) schreibt
    // src/proxy.ts ohne gültiges Sitzungs-Cookie auf die leere Prüfseite um;
    // /api ohne Token beantwortet die API mit 401.
    const anonymous = await playwright.request.newContext({ baseURL })
    try {
      const page = await anonymous.get('/admin/reports')
      expect(page.status()).toBe(200)
      expect(await page.text()).not.toContain('Kassenbericht vom')
      const api = await anonymous.get('/api/products')
      expect(api.status()).toBe(401)
      const body = await api.json()
      expect(body.error).toBeTruthy()
      expect(body.message).toBeTruthy()
    } finally {
      await anonymous.dispose()
    }
  })
})

test.describe('mit Sitzung (Inhaber)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('Dashboard meldet die API erreichbar und zählt das Sortiment', async ({
    page,
  }) => {
    const productCount = await apiCount('/api/products')
    expect(productCount).toBeGreaterThan(0)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Dashboard'
    )
    await expect(
      page.getByText('API erreichbar', { exact: true })
    ).toBeVisible()
    const productsCard = page
      .locator('.MuiPaper-root')
      .filter({ hasText: 'Produkte gesamt' })
      .first()
    await expect(productsCard).toContainText(String(productCount))
    // Kassen-Kachel aus dem synthetischen Kassenbericht (Server-Komponente).
    await expect(page.getByText(/Stand:/).first()).toBeVisible()
  })

  test('Produkte: Liste aus /api/hq-products, Bearbeiten öffnet sich', async ({
    page,
  }) => {
    const productCount = await apiCount('/api/hq-products')

    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Produktverwaltung'
    )
    await expect(page.getByText(`Produktliste (${productCount})`)).toBeVisible()
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(productCount)

    const firstName = (await rows.first().locator('td').first().innerText())
      .split('\n')[0]
      .trim()
    const editButton = rows
      .first()
      .getByRole('button', { name: `${firstName} bearbeiten` })
    await clickUntilURL(page, editButton, /\/admin\/products\/[^/]+$/)
    await expect(page.getByLabel('Produktname')).toHaveValue(firstName)
    await expect(page.getByLabel('Preis (EUR)')).not.toHaveValue('')
  })

  test('unbekanntes Produkt endet nicht in einem leeren Formular', async ({
    page,
  }) => {
    await page.goto('/admin/products/gibt-es-nicht')
    await expect(page.getByRole('main')).toContainText(/nicht gefunden/i)
    await expect(page.getByLabel('Produktname')).toHaveCount(0)
  })

  test('Backschrank: Partner aus der Datenbank, Report als CSV mit Token', async ({
    page,
  }) => {
    const partners = await apiCount('/api/partners')
    expect(partners).toBeGreaterThan(0)

    await page.goto('/admin/partners')
    const reportLink = page.getByRole('link', { name: 'Report' }).first()
    await expect(reportLink).toBeVisible()
    await clickUntilURL(page, reportLink, /\/admin\/partners\/\d+\/report/)
    await expect(
      page.getByRole('heading', { name: 'Partner-Report' })
    ).toBeVisible()

    const exportButton = page.getByRole('button', { name: 'CSV exportieren' })
    await expect(exportButton).toBeEnabled()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
    await expect(page.getByText(/CSV-Export fehlgeschlagen/)).toHaveCount(0)
  })

  // Je Seite ein eigener Test: ein `goto` direkt nach dem vorigen konnte im
  // Dev-Server an dessen später Client-Navigation abbrechen (ERR_ABORTED).
  for (const [path, what] of [
    ['/admin/reports', 'Kassenberichte'],
    ['/admin/analytics', 'Analysen'],
    ['/admin/finance', 'Finanzen'],
    ['/admin/finance/tagesziel', 'Tagesziel'],
  ] as const) {
    test(`${what} laden für den Inhaber ohne Fehlerhinweis`, async ({
      page,
    }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Nur für Inhaber')).toHaveCount(0)
      await expect(page.getByText('Keine Berechtigung')).toHaveCount(0)
      await expect(page.getByText(/Kein Zugriff/)).toHaveCount(0)
      await expect(page.getByText(/konnten nicht geladen werden/)).toHaveCount(
        0
      )
    })
  }

  test('Sammelstelle Mörsbach liest den Alias der echten API', async ({
    page,
  }) => {
    await page.goto('/admin/delivery/preorders')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      page.getByRole('alert').filter({ hasText: /Fehler/ })
    ).toHaveCount(0)
  })
})

test.describe('Rollen', () => {
  test('Verkauf sieht Produkte ohne Bearbeiten und keine Finanzen', async ({
    page,
  }) => {
    await signIn(page, 'verkauf')
    await page.goto('/admin/products')
    await expect(page.getByText(/Produktliste \(\d+\)/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Neues Produkt/ })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: /bearbeiten$/ })).toHaveCount(
      0
    )

    await page.goto('/admin/finance')
    await expect(page.getByText(/Kein Zugriff/).first()).toBeVisible()
  })

  test('Inhaber an der PIN-Station: Finanzen verlangen die Passwort-Anmeldung', async ({
    page,
  }) => {
    await signIn(page, 'station')
    await page.goto('/admin/finance')
    await expect(
      page.getByText(
        'Bitte mit Passwort anmelden – an der PIN-Station nicht verfügbar.'
      )
    ).toBeVisible()
  })
})

/** Klickt, bis die URL wechselt - der Dev-Server hydriert spät. */
async function clickUntilURL(page: Page, target: Locator, url: RegExp) {
  await expect(async () => {
    if (!url.test(page.url())) await target.click({ timeout: 2_000 })
    await expect(page).toHaveURL(url, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}
