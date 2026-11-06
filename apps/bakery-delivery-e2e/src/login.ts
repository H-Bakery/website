import type { APIRequestContext, Page } from '@playwright/test'

/**
 * Anmeldung für die Fahrer-App (B8).
 *
 * Die Suite läuft gegen den Mock-Server (`simple-server.js`, siehe
 * `playwright.config.ts`); dessen Login kennt `admin`/`admin`
 * (`MOCK_ADMIN_USER`/`MOCK_ADMIN_PASSWORD`), Rolle `admin` - die App liest
 * das als `inhaber` (`normalizeUser()` in `src/lib/session.ts`). Die
 * Liefer-Endpunkte des Mocks verlangen keine Sitzung; die Tests legen ihre
 * Touren deshalb weiter direkt an.
 *
 * `useSession()` legt die Sitzung so in `localStorage`, wie die App sie
 * ablegt (`bakery-delivery-session`), bevor die Seite lädt. Die Anmeldung
 * über das Formular prüft `delivery.spec.ts` in einem eigenen Test.
 */

export const API =
  process.env['API_URL'] ||
  `http://localhost:${process.env['API_PORT'] || '5000'}`

export const E2E_LOGIN = {
  username: process.env['MOCK_ADMIN_USER'] || 'admin',
  password: process.env['MOCK_ADMIN_PASSWORD'] || 'admin',
}

const SESSION_KEY = 'bakery-delivery-session'
const LAST_USER_KEY = 'bakery-delivery-last-user'

export async function issueSession(request: APIRequestContext) {
  const response = await request.post(`${API}/api/auth/login`, {
    data: E2E_LOGIN,
  })
  if (!response.ok()) {
    throw new Error(
      `Anmeldung an der Mock-API fehlgeschlagen: ${response.status()}`
    )
  }
  const { data } = await response.json()
  return {
    token: data.token as string,
    refreshToken: (data.refreshToken as string | undefined) ?? null,
    user: data.user as { id: number | string },
  }
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
