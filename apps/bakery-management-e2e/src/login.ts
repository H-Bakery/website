/**
 * @fileoverview Anmeldung für die Smoke-Suite (F1).
 *
 * Seit F1 braucht jede Seite unter `/admin` eine Sitzung. Die Suite meldet
 * sich deshalb einmal an der Mock-API an (`auth.mock.js`, Vorgabe
 * `admin`/`admin`, überschreibbar mit `MOCK_ADMIN_USER`/`MOCK_ADMIN_PASSWORD`)
 * und legt die Sitzung so in `localStorage`, wie die App sie selbst ablegt
 * (`src/lib/authSession.ts`, Schlüssel `bakery-management-session`). Die
 * Mock-Rolle `admin` gilt in der App als `inhaber`.
 */

import {
  expect,
  request as playwrightRequest,
  type Page,
} from '@playwright/test'

const API_BASE = process.env['API_URL'] || 'http://localhost:5000'
const SESSION_KEY = 'bakery-management-session'

let cached: string | null = null

async function sessionJson(): Promise<string> {
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
    cached = JSON.stringify({
      token: data.token,
      refreshToken: data.refreshToken ?? null,
      user: {
        id: data.user.id,
        username: data.user.username || data.user.email || 'admin',
        displayName: 'E2E Inhaber',
        role: 'inhaber',
      },
      sessionKind: 'personal',
      startedAt: Date.now(),
    })
    return cached
  } finally {
    await context.dispose()
  }
}

/** Vor dem ersten `page.goto`: die Seite startet angemeldet als Inhaber. */
export async function signIn(page: Page): Promise<void> {
  const value = await sessionJson()
  await page.addInitScript(
    ([key, json]) => {
      window.localStorage.setItem(key, json)
    },
    [SESSION_KEY, value] as const
  )
}
