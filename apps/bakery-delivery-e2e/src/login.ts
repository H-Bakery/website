import {
  test as base,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

/**
 * Anmeldung für die Fahrer-App (B8, seit B12 an der echten API).
 *
 * Die Suite läuft gegen das Bundle der echten API (`deliveryApiServer()` in
 * `tools/e2e/servers.js`, frische SQLite-Datenbank je Lauf). Angemeldet wird
 * der E2E-Inhaber, den die API beim Start aus `BOOTSTRAP_ADMIN_*` anlegt
 * (`E2E_ADMIN` in `servers.js`, synthetisch).
 *
 * Jede `/api`-Route braucht dort eine Sitzung. Das `test` dieser Datei gibt
 * den Specs deshalb einen `request`-Kontext, der jede Anfrage als Inhaber
 * schickt - die Tests legen ihre Touren und Vorbestellungen weiter direkt an.
 *
 * `useSession()` legt die Sitzung so in `localStorage`, wie die App sie
 * ablegt (`bakery-delivery-session`), bevor die Seite lädt. Die Anmeldung
 * über das Formular prüft `delivery.spec.ts` in einem eigenen Test.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { E2E_ADMIN } = require('../../../tools/e2e/servers')

export const API =
  process.env['API_URL'] ||
  `http://localhost:${process.env['API_PORT'] || '5000'}`

export const E2E_LOGIN: { username: string; password: string } = {
  username: E2E_ADMIN.username,
  password: E2E_ADMIN.password,
}

const SESSION_KEY = 'bakery-delivery-session'
const LAST_USER_KEY = 'bakery-delivery-last-user'

export async function issueSession(request: APIRequestContext) {
  const response = await request.post(`${API}/api/auth/login`, {
    data: E2E_LOGIN,
  })
  if (!response.ok()) {
    throw new Error(
      `Anmeldung an der API fehlgeschlagen: ${response.status()} ${await response.text()}`
    )
  }
  const { data } = await response.json()
  return {
    token: data.token as string,
    refreshToken: (data.refreshToken as string | undefined) ?? null,
    user: data.user as { id: number | string },
  }
}

/**
 * `test` mit einem angemeldeten `request`: jede Anfrage trägt das Token des
 * E2E-Inhabers (eine Anmeldung je Test-Worker).
 */
export const test = base.extend<object, { apiToken: string }>({
  apiToken: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext()
      const { token } = await issueSession(context)
      await context.dispose()
      await use(token)
    },
    { scope: 'worker' },
  ],
  request: async ({ playwright, apiToken }, use) => {
    const context = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${apiToken}` },
    })
    await use(context)
    await context.dispose()
  },
})

/**
 * Id des E2E-Fahrers. Die echte API legt keine Fahrer an (der Mock hatte zwei
 * im Seed) - der erste Aufruf legt „E2E-Fahrer“ an, danach wird er gefunden.
 * Der erste Aufruf ist `global-setup.ts`, vor allen Workern; sonst legten zwei
 * Worker gleichzeitig je einen an.
 */
export async function driverId(request: APIRequestContext): Promise<number> {
  const list = (await (
    await request.get(`${API}/api/deliveries/drivers`)
  ).json()) as Array<{ id: number; name: string }>
  const found = list.find((d) => d.name === 'E2E-Fahrer')
  if (found) return found.id
  const created = await request.post(`${API}/api/deliveries/drivers`, {
    data: { name: 'E2E-Fahrer' },
  })
  if (!created.ok()) {
    // Ein paralleler Worker war schneller - dann gibt es ihn jetzt.
    const again = (await (
      await request.get(`${API}/api/deliveries/drivers`)
    ).json()) as Array<{ id: number; name: string }>
    const other = again.find((d) => d.name === 'E2E-Fahrer')
    if (other) return other.id
    throw new Error(`Fahrer anlegen fehlgeschlagen: ${created.status()}`)
  }
  return (await created.json()).id
}

/** Die Seite startet angemeldet (gilt für jedes weitere `goto`/`reload`). */
export async function useSession(page: Page, request: APIRequestContext) {
  const session = await issueSession(request)
  await page.addInitScript(
    ([key, lastKey, json, id]) => {
      window.localStorage.setItem(key, json)
      window.localStorage.setItem(lastKey, id)
    },
    [
      SESSION_KEY,
      LAST_USER_KEY,
      JSON.stringify(session),
      String(session.user.id),
    ]
  )
}
