import { expect, test } from '@playwright/test'
import * as axe from 'axe-core'

declare global {
  interface Window {
    axe: typeof axe
  }
}

const testTime = new Date('2026-11-23T09:00:00Z') // Montag im Laden
const storageKey = 'heusser-korb-v1'

test.beforeEach(async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 })
})

test('drei Artikel suchen und vorbestellen, Korb behalten und Angaben vergessen', async ({
  page,
}) => {
  await page.clock.setFixedTime(testTime)
  await page
    .context()
    .route('https://wa.me/**', (route) => route.fulfill({ body: '' }))

  await page.goto('/bestellen')
  await page.getByRole('link', { name: 'Zum Sortiment' }).click()
  await page.getByRole('textbox', { name: /suchen/i }).waitFor()
  await page.getByRole('textbox', { name: /suchen/i }).fill('Musterbrot Hell')
  await page
    .getByRole('button', { name: 'Musterbrot Hell 500g in den Korb' })
    .click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Musterbrot Hell 500g im Korb, 1 Stück' })
  ).toHaveCount(1)

  await page.getByRole('textbox', { name: /suchen/i }).fill('Musterweck')
  await page
    .getByRole('button', { name: 'Musterweck in den Korb', exact: true })
    .click()

  await page.goto('/products/50')
  await page
    .getByRole('button', { name: 'Mustertorte Sahne in den Korb', exact: true })
    .click()
  const bar = page.getByRole('button', { name: /3 Artikel.*Korb/ })
  await bar.click()
  const sheet = page.getByRole('dialog', { name: 'Ihr Korb' })
  await expect(sheet).toBeVisible()

  await page.addScriptTag({ content: axe.source })
  const results = await sheet.evaluate((dialog) =>
    window.axe.run(dialog, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    })
  )
  expect(results.violations).toEqual([])

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(bar).toBeFocused()
  await bar.click()
  await sheet.getByRole('button', { name: 'Mehr Musterbrot Hell 500g' }).click()
  await sheet
    .getByRole('textbox', { name: 'Notiz für Mustertorte Sahne (optional)' })
    .fill('Aufschrift „Alles Gute“')
  await sheet.getByRole('button', { name: 'Abholung wählen' }).click()
  const days = sheet.getByRole('group', { name: 'Abholtag' })
  await expect(
    days.getByRole('button', { name: /Montag, 23\.11\.2026/ })
  ).toBeDisabled()
  await expect(
    days.getByRole('button', { name: /Dienstag, 24\.11\.2026/ })
  ).toBeDisabled()
  await expect(days.getByText(/zwei Tage/)).toBeVisible()
  await days.getByRole('button', { name: /Mittwoch, 25\.11\.2026/ }).click()
  await sheet.getByRole('button', { name: '09:30 Uhr' }).click()
  await sheet.getByRole('button', { name: 'Weiter zu Ihren Angaben' }).click()
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Erika Beispielfrau')
  await sheet
    .getByRole('textbox', { name: 'Anmerkung (optional)' })
    .fill('Danke & bis Mittwoch!')

  const send = sheet.getByRole('link', { name: 'Per WhatsApp senden' })
  const href = (await send.getAttribute('href')) ?? ''
  expect(href).toMatch(/^https:\/\/wa\.me\//)
  const message = new URL(href).searchParams.get('text')
  expect(message).toMatch(
    /^Hallo, ich möchte vorbestellen:\n\n2× Musterbrot Hell 500g\n1× Musterweck\n1× Mustertorte Sahne – Aufschrift „Alles Gute“\n\nAbholung: Mittwoch, 25\.11\.2026, 09:30 Uhr\nAbholort: Laden\nName: Erika Beispielfrau\nAnmerkung: Danke & bis Mittwoch!\n\nSumme ca\. 37,05 € \(bezahlt wird bei Abholung\)\nBestell-Nr\. W-[A-HJ-NP-Z2-9]{4}$/
  )
  await expect(sheet.locator('pre')).toHaveJSProperty('textContent', message)
  const qr = sheet.getByRole('img', {
    name: 'QR-Code für Ihre WhatsApp-Nachricht',
  })
  if ((page.viewportSize()?.width ?? 0) >= 900) await expect(qr).toBeVisible()
  else await expect(qr).toBeHidden()

  await send.click()
  const followUp = page.getByRole('dialog', { name: 'WhatsApp-Vorbestellung' })
  await expect(
    followUp.getByText(
      'Wir bestätigen Ihre Vorbestellung per WhatsApp. Erst dann ist sie fest.'
    )
  ).toBeVisible()
  await followUp.getByRole('button', { name: 'Zurück zum Korb' }).click()
  await expect(send).toHaveAttribute('href', href)
  await page.reload()
  await page.getByRole('button', { name: /4 Artikel.*Korb/ }).click()
  await expect(
    sheet.getByRole('group', { name: 'Menge für Musterbrot Hell 500g' })
  ).toContainText('2')
  await sheet.getByRole('button', { name: '3. Senden' }).click()
  await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Erika Beispielfrau'
  )
  await sheet.getByRole('button', { name: 'Angaben vergessen' }).click()
  await expect(sheet.getByText('Ihr Korb ist leer.')).toBeVisible()
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBeNull()
})

test('der Warenkorb funktioniert auch bei gesperrtem Speicher', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Speicher gesperrt', 'SecurityError')
      },
    })
  })
  await page.goto('/products/3')
  await page
    .getByRole('button', { name: 'Musterbrot Hell 500g in den Korb' })
    .click()
  await page.getByRole('button', { name: /1 Artikel.*Korb/ }).click()
  await expect(
    page.getByRole('dialog').getByText('Musterbrot Hell 500g', { exact: true })
  ).toBeVisible()
})
