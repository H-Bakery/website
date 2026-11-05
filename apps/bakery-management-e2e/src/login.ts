/**
 * @fileoverview Anmeldung für die Smoke-Suite (F1).
 *
 * Seit F1 braucht jede Seite unter `/admin` eine Sitzung. Die Suite meldet
 * sich deshalb einmal an der Mock-API an (`auth.mock.js`, Vorgabe
 * `admin`/`admin`, überschreibbar mit `MOCK_ADMIN_USER`/`MOCK_ADMIN_PASSWORD`)
 * und legt die Sitzung so in `localStorage`, wie die App sie selbst ablegt
 * (`src/lib/authSession.ts`, Schlüssel `bakery-management-session`). Die
 * Rolle kommt aus der Login-Antwort und wird wie in der App normalisiert
 * (`normalizeRole` in `src/lib/roles.ts`: Mock-`admin` = `inhaber`). Dazu
 * setzt `signIn()` das Sitzungs-Cookie (`src/lib/sessionCookie.ts`), das
 * `src/proxy.ts` serverseitig prüft - sonst rendert der Server jede Seite
 * unter `/admin` nur als Ladezustand.
 */

import {
  expect,
  request as playwrightRequest,
  type Page,
} from '@playwright/test'

const API_BASE = process.env['API_URL'] || 'http://localhost:5000'
const SESSION_KEY = 'bakery-management-session'
/** Wie `SESSION_COOKIE_NAME` in apps/bakery-management/src/lib/sessionCookie.ts. */
const SESSION_COOKIE = 'bakery-management-at'
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3001'

/** Wie `normalizeRole()` der App - eine unbekannte Rolle bricht den Lauf ab. */
export function pilotRole(raw: unknown): string {
  const role = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (['inhaber', 'verkauf', 'backstube', 'fahrer'].includes(role)) return role
  if (role === 'admin') return 'inhaber'
  if (role === 'staff' || role === 'manager') return 'verkauf'
  throw new Error(`Unbekannte Rolle aus /api/auth/login: ${String(raw)}`)
}

let cached: { json: string; token: string } | null = null

async function issuedSession(): Promise<{ json: string; token: string }> {
  if (cached) return cached
  const context = await playwrightRequest.newContext()
  try {
    const response = await context.post(`${API_BASE}/api/auth/login`, {
      data: {
        username: process.env['MOCK_ADMIN_USER'] || 'admin',
        password: process.env['MOCK_ADMIN_PASSWORD'] || 'admin',
      },
    })
    expect(response.ok(), 'Anmeldung an der Mock-API').toBeTruthy()
    const { data } = await response.json()
    const username = data.user.username || data.user.email || 'admin'
    const json = JSON.stringify({
      token: data.token,
      refreshToken: data.refreshToken ?? null,
      user: {
        id: data.user.id,
        username,
        displayName: data.user.displayName || username,
        role: pilotRole(data.user.role),
      },
      sessionKind: data.sessionKind === 'station' ? 'station' : 'personal',
      startedAt: Date.now(),
    })
    cached = { json, token: data.token }
    return cached
  } finally {
    await context.dispose()
  }
}

/** Vor dem ersten `page.goto`: die Seite startet angemeldet (Mock: Inhaber). */
export async function signIn(page: Page): Promise<void> {
  const { json, token } = await issuedSession()
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE, value: encodeURIComponent(token), url: BASE_URL },
    ])
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [SESSION_KEY, json] as const
  )
}
