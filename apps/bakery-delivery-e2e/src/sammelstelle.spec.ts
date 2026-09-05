import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Sammelstelle Kindergarten Mörsbach.
 *
 * Der Fahrer steht samstags im Zeitfenster vor dem Kindergarten und gibt
 * vorbestellte Ware an die Familien aus. Die Tests fahren genau das ab:
 * Übergabeliste lesen, abhaken, den Stopp mit offenen Bestellungen abschließen
 * wollen. Sie laufen in beiden Projekten - Desktop und Pixel 5 -, weil die App
 * auf dem Handy des Fahrers bedient wird.
 *
 * Jeder Test legt seine eigene Tour und seine eigenen Vorbestellungen an und
 * räumt sie wieder weg; der Liefer-Store ist derselbe wie im Betrieb.
 */

const API =
  process.env['API_URL'] ||
  `http://localhost:${process.env['API_PORT'] || '5000'}`

/** Ein Samstag weit genug in der Zukunft, dass er keiner echten Tour ins Gehege kommt. */
const BASE_SATURDAY = '2027-08-07'

/**
 * Jeder Test bekommt seinen eigenen Samstag.
 *
 * Vorbestellungen haengen am *Tag*, nicht an der Tour - zwei Tests am selben
 * Datum saehen also gegenseitig ihre Bestellungen. Und die beiden Projekte
 * (Desktop, Pixel 5) laufen parallel gegen denselben Store, deshalb bekommt
 * das Handy zusaetzlich einen ganz anderen Monat.
 */
function saturday(slot: number): string {
  const projectOffset = test.info().project.name === 'chromium' ? 0 : 10
  const base = new Date(`${BASE_SATURDAY}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + (slot + projectOffset) * 7)
  return base.toISOString().slice(0, 10)
}

/**
 * Den Tag leerräumen, bevor der Test ihn benutzt.
 *
 * Ein abgebrochener Lauf hinterlässt Tour und Vorbestellungen - der nächste
 * Lauf sähe sie doppelt und würde an Kleinigkeiten scheitern, die gar nicht
 * kaputt sind.
 */
async function resetDay(request: APIRequestContext, date: string) {
  const tours = await (
    await request.get(`${API}/api/deliveries/tours?date=${date}`)
  ).json()
  for (const tour of tours) {
    await request.delete(`${API}/api/deliveries/tours/${tour.id}`)
  }
  const existing = await (
    await request.get(`${API}/api/deliveries/preorders?date=${date}`)
  ).json()
  for (const preorder of existing) {
    // Eine uebergebene Bestellung laesst sich nicht stornieren - das ist die
    // Regel, die verhindert, dass kassiertes Geld aus der Abrechnung faellt.
    // Fuer das Aufraeumen hier also erst zurueck auf offen.
    if (preorder.status !== 'open' && preorder.status !== 'cancelled') {
      await request.patch(`${API}/api/deliveries/preorders/${preorder.id}`, {
        data: { status: 'open' },
      })
    }
    await request.delete(`${API}/api/deliveries/preorders/${preorder.id}`)
  }
}

async function createTour(
  request: APIRequestContext,
  date: string,
  name: string
) {
  const created = await request.post(`${API}/api/deliveries/tours`, {
    data: { date, driverId: 1, name },
  })
  expect(created.ok()).toBeTruthy()
  return created.json()
}

async function createPreorder(
  request: APIRequestContext,
  date: string,
  customer: string,
  items: Array<{ productId: string; qty: number }>,
  extra: Record<string, unknown> = {}
) {
  const created = await request.post(`${API}/api/deliveries/preorders`, {
    data: { date, customer, items, ...extra },
  })
  expect(
    created.ok(),
    `Vorbestellung ${customer}: ${await created.text()}`
  ).toBeTruthy()
  return created.json()
}

/** Storniert räumt nicht weg, sondern markiert - genau deshalb hier per DELETE. */
async function cleanup(
  request: APIRequestContext,
  tourId: number,
  preorderIds: number[]
) {
  for (const id of preorderIds) {
    await request.delete(`${API}/api/deliveries/preorders/${id}`)
  }
  await request.delete(`${API}/api/deliveries/tours/${tourId}`)
}

/**
 * Die Tour öffnen und auf den Sammelstellen-Stopp warten.
 *
 * Kein `selectOption` auf der Tour-Auswahl: jeder Test hat seinen eigenen Tag
 * und damit genau eine Tour, und dann blendet die App die Auswahl gar nicht
 * erst ein - der Test würde ewig auf ein Feld warten, das es nicht gibt.
 */
async function openTour(
  page: import('@playwright/test').Page,
  date: string,
  tourName: string
) {
  await page.goto('/')
  await page.getByLabel('Tag', { exact: true }).fill(date)
  await expect(
    page.getByRole('heading', { name: tourName, level: 2 })
  ).toBeVisible({ timeout: 20_000 })
  const stop = page
    .getByRole('listitem')
    .filter({ hasText: 'Kindergarten Mörsbach' })
    .first()
  await expect(stop).toBeVisible({ timeout: 20_000 })
  return stop
}

test.describe('Sammelstelle', () => {
  test('haengt die Vorbestellungen des Tages an den Stopp', async ({
    page,
    request,
  }) => {
    // Neue Touren an einem Samstag bekommen den Sammelstellen-Stopp
    // automatisch - sonst erreichten die Vorbestellungen den Fahrer nie.
    const date = saturday(0)
    await resetDay(request, date)
    const tour = await createTour(request, date, 'E2E Sammelstelle')
    const first = await createPreorder(request, date, 'E2E Familie Weber', [
      { productId: 'kornbrot-500g', qty: 2 },
    ])
    const second = await createPreorder(request, date, 'E2E Familie Klein', [
      { productId: 'kornbrot-500g', qty: 1 },
    ])

    try {
      const stop = await openTour(page, date, 'E2E Sammelstelle')

      await expect(stop.getByText('E2E Familie Weber')).toBeVisible()
      await expect(stop.getByText('E2E Familie Klein')).toBeVisible()
      // Referenz statt Adresse: an der Sammelstelle wird aufgerufen, nicht gefahren.
      await expect(stop.getByText(first.reference)).toBeVisible()
      // Preise kommen aus hq, nicht aus dem Formular: 2 x 2,50 EUR.
      await expect(stop.getByText('5,00 €')).toBeVisible()
      await expect(stop.getByText('0 von 2 übergeben')).toBeVisible()
      // Summe der offenen Beträge, sauber gerundet.
      await expect(stop.getByText('Bar zu kassieren: 7,50 €')).toBeVisible()
    } finally {
      await cleanup(request, tour.id, [first.id, second.id])
    }
  })

  test('hakt eine Uebergabe ab und behaelt sie nach dem Neuladen', async ({
    page,
    request,
  }) => {
    const date = saturday(1)
    await resetDay(request, date)
    const tour = await createTour(request, date, 'E2E Übergabe')
    const preorder = await createPreorder(request, date, 'E2E Familie Roth', [
      { productId: 'kornbrot-500g', qty: 1 },
    ])

    try {
      const stop = await openTour(page, date, 'E2E Übergabe')
      const row = stop
        .getByRole('listitem')
        .filter({ hasText: 'E2E Familie Roth' })
        .first()

      await row.getByRole('button', { name: 'Übergeben' }).click()
      await expect(stop.getByText('1 von 1 übergeben')).toBeVisible({
        timeout: 15_000,
      })
      await expect(stop.getByText('Bar zu kassieren: 0,00 €')).toBeVisible()

      // Der Server hat es wirklich - nicht nur der Bildschirm. Der Tag steht
      // nach dem Neuladen wieder auf heute, also noch einmal hinstellen.
      await page.reload()
      const reloaded = await openTour(page, date, 'E2E Übergabe')
      await expect(reloaded.getByText('1 von 1 übergeben')).toBeVisible({
        timeout: 20_000,
      })
    } finally {
      await cleanup(request, tour.id, [preorder.id])
    }
  })

  test('fragt nach, bevor ein Stopp mit offenen Vorbestellungen schliesst', async ({
    page,
    request,
  }) => {
    // Ungeklärte Ware darf nicht lautlos aus der Abrechnung fallen. Die
    // Rückfrage steht in der Oberfläche, nicht in `window.confirm` - ein
    // blockierender Dialog sieht auf dem Handy aus wie ein Absturz.
    const date = saturday(2)
    await resetDay(request, date)
    const tour = await createTour(request, date, 'E2E Rückfrage')
    const preorder = await createPreorder(request, date, 'E2E Familie Braun', [
      { productId: 'kornbrot-500g', qty: 1 },
    ])

    try {
      const stop = await openTour(page, date, 'E2E Rückfrage')

      await stop.getByRole('button', { name: 'Stopp abschließen' }).click()
      await expect(
        stop.getByText('1 Vorbestellung ist noch offen. Trotzdem abschließen?')
      ).toBeVisible()

      // Abbrechen lässt den Stopp offen.
      await stop.getByRole('button', { name: 'Abbrechen' }).click()
      await expect(
        stop.getByRole('button', { name: 'Stopp abschließen' })
      ).toBeVisible()

      await stop.getByRole('button', { name: 'Stopp abschließen' }).click()
      await stop.getByRole('button', { name: 'Trotzdem abschließen' }).click()
      await expect(stop.getByText('Abgeschlossen')).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await cleanup(request, tour.id, [preorder.id])
    }
  })

  test('nimmt eine Nichtabholung auf und laesst sie zuruecksetzen', async ({
    page,
    request,
  }) => {
    const date = saturday(3)
    await resetDay(request, date)
    const tour = await createTour(request, date, 'E2E Nichtabholung')
    const preorder = await createPreorder(request, date, 'E2E Familie Sauer', [
      { productId: 'kornbrot-500g', qty: 1 },
    ])

    try {
      const stop = await openTour(page, date, 'E2E Nichtabholung')
      const row = stop
        .getByRole('listitem')
        .filter({ hasText: 'E2E Familie Sauer' })
        .first()

      await row.getByRole('button', { name: 'Nicht abgeholt' }).click()
      await expect(stop.getByText('1 nicht abgeholt')).toBeVisible({
        timeout: 15_000,
      })

      await row.getByRole('button', { name: 'Zurücksetzen' }).click()
      await expect(row.getByRole('button', { name: 'Übergeben' })).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await cleanup(request, tour.id, [preorder.id])
    }
  })
})

test.describe('Farbschema', () => {
  test('merkt sich Dunkel ueber das Neuladen hinweg, ohne Flash', async ({
    page,
  }) => {
    await page.goto('/')

    const toggle = page.getByRole('group', { name: 'Farbschema der App' })
    await expect(toggle).toBeVisible()

    await toggle.getByRole('button', { name: 'Farbschema dunkel' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    // Das Inline-Skript setzt das Attribut vor dem ersten Paint: direkt nach
    // dem Laden steht es schon, ohne auf React zu warten.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(
      toggle.getByRole('button', { name: 'Farbschema dunkel' })
    ).toHaveAttribute('aria-pressed', 'true')

    // Dunkel heißt auch wirklich dunkel - sonst bliebe der Umschalter Kosmetik.
    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    )
    const channels = background.match(/\d+/g)?.map(Number) ?? [255, 255, 255]
    expect(Math.max(...channels.slice(0, 3))).toBeLessThan(90)

    await toggle.getByRole('button', { name: 'Farbschema hell' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})
