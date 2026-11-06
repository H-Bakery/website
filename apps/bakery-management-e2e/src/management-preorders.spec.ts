/**
 * @fileoverview Sammelstelle Mörsbach und Abholliste gegen die echte API (W4).
 *
 * Anders als `management-smoke.spec.ts` **schreibt** diese Suite: sie legt
 * über die API Vorbestellungen an der Sammelstelle an, findet sie in der
 * Mörsbach-Liste und in der Abholliste wieder, stellt sie dort per
 * Sammelaktion auf „bereit" (`POST /api/preorders/bulk-status`) und übergibt
 * eine davon. Geschrieben wird nur in die Wegwerf-Datenbank der Test-API
 * (`tools/e2e/real-api.js`, `mkdtemp`), nie in hq.
 *
 * Jedes Projekt (Desktop, Pixel 5) bekommt einen **eigenen Samstag**, damit
 * die Sammelaktion des einen nicht die Bestellungen des anderen berührt
 * (beide laufen parallel gegen dieselbe API). Namen sind synthetisch.
 */

import { expect, test } from '@playwright/test'
import { apiGet, apiSend, signIn } from './login'

const POINT = 'kindergarten-moersbach'

interface Preorder {
  id: number
  code: string
  customerName: string
  status: string
  paid: boolean
  pickupDate: string
}

/** Heutiger Geschäftstag in Berlin, `YYYY-MM-DD`. */
function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Der nächste Samstag (heute eingeschlossen) plus `weeks` Wochen. */
function saturday(weeks: number): string {
  const [y, m, d] = berlinToday().split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const ahead = (6 - date.getUTCDay() + 7) % 7
  date.setUTCDate(date.getUTCDate() + ahead + weeks * 7)
  return date.toISOString().slice(0, 10)
}

async function createPreorder(
  date: string,
  customerName: string,
  paid: boolean
): Promise<Preorder> {
  const body = await apiSend<{ data: Preorder }>(
    'POST',
    '/api/preorders',
    {
      channel: 'sammelstelle',
      customerName,
      pickupDate: date,
      pickupPointId: POINT,
      items: [{ productId: 'kornbrot-500g', quantity: 2 }],
      paid,
    },
    [201]
  )
  return body.data
}

async function fetchPreorder(id: number): Promise<Preorder> {
  return (await apiGet<{ data: Preorder }>(`/api/preorders/${id}`)).data
}

test.describe('Vorbestellungen an der Sammelstelle (echte API)', () => {
  test('anlegen, in Mörsbach-Liste und Abholliste finden, bereit, übergeben', async ({
    page,
  }, testInfo) => {
    const date = saturday(testInfo.project.name === 'mobile' ? 2 : 1)
    const run = `${testInfo.project.name}-${Date.now().toString(36)}`
    const paidOne = await createPreorder(date, `Test Abholung ${run}`, true)
    const openOne = await createPreorder(date, `Test Offen ${run}`, false)
    expect(paidOne.code).toMatch(new RegExp(`^MO-${date}-\\d{2}$`))
    expect(paidOne.status).toBe('offen')

    await signIn(page, 'inhaber')

    // Mörsbach-Liste (Alias-Seiten seit P2 auf /api/preorders/day)
    await page.goto(`/admin/delivery/preorders?date=${date}`)
    await expect(page.getByText(paidOne.code).first()).toBeVisible()
    await expect(page.getByText(openOne.customerName).first()).toBeVisible()

    // Abholliste derselben Sammelstelle
    await page.goto(`/admin/preorders/abholliste?date=${date}&point=${POINT}`)
    const paidRow = page.getByTestId(`abhol-${paidOne.code}`)
    await expect(paidRow).toBeVisible()
    await expect(page.getByTestId(`abhol-${openOne.code}`)).toBeVisible()

    // Sammelaktion: ein Request, eine Transaktion (W4)
    const bulk = page.waitForResponse(
      (r) =>
        r.url().includes('/api/preorders/bulk-status') &&
        r.request().method() === 'POST'
    )
    await page
      .getByRole('button', { name: /Alle offenen als bereit markieren/ })
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(paidOne.code)
    await dialog.getByRole('button', { name: 'Als bereit markieren' }).click()
    const bulkResponse = await bulk
    expect(bulkResponse.status()).toBe(200)
    await expect(
      page.getByText(/Bestellungen? als bereit markiert\./)
    ).toBeVisible()
    await expect
      .poll(async () => (await fetchPreorder(openOne.id)).status)
      .toBe('bereit')
    expect((await fetchPreorder(paidOne.id)).status).toBe('bereit')

    // Übergabe: bezahlt + Inhaber = ein Tipp
    await paidRow
      .getByRole('button', { name: `${paidOne.customerName} übergeben` })
      .click()
    await expect(
      page.getByText(`${paidOne.customerName} übergeben.`)
    ).toBeVisible()
    await expect(paidRow).toHaveAttribute('data-status', 'abgeholt')
    await expect
      .poll(async () => (await fetchPreorder(paidOne.id)).status)
      .toBe('abgeholt')
    // die andere wartet weiter
    expect((await fetchPreorder(openOne.id)).status).toBe('bereit')

    // Mörsbach-Liste zeigt den neuen Stand
    await page.goto(`/admin/delivery/preorders?date=${date}`)
    await expect(page.getByText(paidOne.code).first()).toBeVisible()
    const paidListRow = page.getByRole('row').filter({ hasText: paidOne.code })
    await expect(paidListRow).toContainText(/Übergeben|Abgeholt/i)
  })
})
