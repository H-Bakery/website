/**
 * @fileoverview Anmeldung für die Smoke-Suite gegen die echte API (F4).
 *
 * Jede Seite unter `/admin` braucht eine Sitzung, jede `/api`-Route auch
 * (B3). Die Sitzungen holt `global-setup.ts` **einmal** vor allen Tests
 * (`issueSessions()`), direkt an der API (`API_URL`):
 *
 * - `inhaber`: der Inhaber, den `tools/e2e/real-api.js` beim Start über
 *   `BOOTSTRAP_ADMIN_*` anlegt (`E2E_ADMIN` in `tools/e2e/servers.js`),
 * - `verkauf`: ein Konto, das der Inhaber über `POST /api/users` anlegt,
 * - `station`: der Inhaber an einer PIN-Station (Station registrieren, PIN
 *   setzen, `POST /api/auth/pin`).
 *
 * Warum nicht je Worker: eine neue PIN beendet die Stations-Sitzungen des
 * Benutzers - zwei Projekte, die je eine eigene PIN setzen, würden sich
 * gegenseitig abmelden. (Das Login-Limit der API zählt seit W4 nur noch
 * Fehlversuche; gleichzeitige erfolgreiche Anmeldungen bekämen kein 429
 * mehr.)
 *
 * Die Sitzungen reisen als JSON in `E2E_SESSIONS` zu den Workern (Playwright
 * gibt Umgebungsvariablen aus dem Global Setup weiter). `useSession()` legt
 * eine davon so in `localStorage`, wie die App sie selbst ablegt
 * (`src/lib/authSession.ts`, Schlüssel `bakery-management-session`), dazu das
 * Sitzungs-Cookie (`src/lib/sessionCookie.ts`), das `src/proxy.ts`
 * serverseitig prüft. Kein Test meldet diese Sitzungen ab oder erneuert sie
 * (Access-Token 1 h), sonst rotierte ein Tab das Refresh-Token der anderen.
 * Die Anmeldung über die Oberfläche prüft `management-smoke.spec.ts` mit
 * einer eigenen Sitzung.
 */

import {
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { E2E_ADMIN } = require('../../../tools/e2e/servers') as {
  E2E_ADMIN: { username: string; password: string }
}

export const API_BASE = process.env['API_URL'] || 'http://localhost:5000'
const SESSION_KEY = 'bakery-management-session'
/** Wie `SESSION_COOKIE_NAME` in apps/bakery-management/src/lib/sessionCookie.ts. */
const SESSION_COOKIE = 'bakery-management-at'
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3001'
const SESSIONS_ENV = 'E2E_SESSIONS'

export { E2E_ADMIN }

export type PilotRole = 'inhaber' | 'verkauf' | 'backstube' | 'fahrer'
export type SessionName = 'inhaber' | 'verkauf' | 'station'

export interface IssuedSession {
  /** Was die App unter `bakery-management-session` ablegt. */
  json: string
  token: string
}

export type IssuedSessions = Record<SessionName, IssuedSession>

/** Antwort von login/pin der echten API (`data`). */
interface IssuedData {
  token: string
  refreshToken: string | null
  sessionKind?: string
  user: {
    id: number
    username?: string
    displayName?: string
    role: string
    sessionKind?: string
  }
}

/** Wie `normalizeRole()` der App - eine unbekannte Rolle bricht den Lauf ab. */
export function pilotRole(raw: unknown): PilotRole {
  const role = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (['inhaber', 'verkauf', 'backstube', 'fahrer'].includes(role)) {
    return role as PilotRole
  }
  throw new Error(`Unbekannte Rolle von der API: ${String(raw)}`)
}

function toSession(data: IssuedData): IssuedSession {
  const username = data.user.username || String(data.user.id)
  const kind = data.sessionKind ?? data.user.sessionKind
  const json = JSON.stringify({
    token: data.token,
    refreshToken: data.refreshToken ?? null,
    user: {
      id: data.user.id,
      username,
      displayName: data.user.displayName || username,
      role: pilotRole(data.user.role),
    },
    sessionKind: kind === 'station' ? 'station' : 'personal',
    startedAt: Date.now(),
  })
  return { json, token: data.token }
}

async function withApi<T>(work: (api: APIRequestContext) => Promise<T>) {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE })
  try {
    return await work(api)
  } finally {
    await api.dispose()
  }
}

async function expectOk(response: APIResponse, what: string, ok = [200]) {
  if (!ok.includes(response.status())) {
    throw new Error(
      `${what}: HTTP ${response.status()} ${await response.text()}`
    )
  }
  return response
}

/**
 * In Entwicklung verwendet Playwright einen schon laufenden Server auf dem
 * API-Port wieder (`reuseExistingServer`). Läuft dort der Mock
 * (`serve:api:simple`), scheiterte die Anmeldung sonst mit einer
 * rätselhaften 401. Die echte API meldet in `/health` die Datenbank
 * (`database: 'ok'`), der Mock nicht (`status: 'healthy'`).
 */
async function expectRealApi(api: APIRequestContext): Promise<void> {
  let body: Record<string, unknown> | null = null
  try {
    body = (await (await api.get('/health')).json()) as Record<string, unknown>
  } catch {
    body = null
  }
  if (!body || body['database'] !== 'ok') {
    throw new Error(
      `Auf ${API_BASE} läuft nicht die echte API (GET /health ohne database: 'ok'` +
        `${body ? `, Antwort: ${JSON.stringify(body)}` : ''}). ` +
        'Den Server auf diesem Port beenden (z. B. serve:api:simple) - die ' +
        'Suite startet die echte API selbst (tools/e2e/real-api.js).'
    )
  }
}

const E2E_USER_PASSWORD = 'e2e-Benutzer-Passwort-1'
const E2E_PIN = '0420'

/**
 * Für `global-setup.ts`: meldet Inhaber, Verkauf und Inhaber-an-der-Station
 * nacheinander an. Synthetische Namen und Geheimnisse.
 */
export async function issueSessions(): Promise<IssuedSessions> {
  return withApi(async (api) => {
    await expectRealApi(api)
    const login = async (username: string, password: string) => {
      const response = await expectOk(
        await api.post('/api/auth/login', { data: { username, password } }),
        `Anmeldung als ${username}`
      )
      return ((await response.json()) as { data: IssuedData }).data
    }

    const owner = await login(E2E_ADMIN.username, E2E_ADMIN.password)
    const auth = { Authorization: `Bearer ${owner.token}` }

    // Verkauf: 409 username_taken heißt, ein früherer Lauf gegen dieselbe
    // (wiederverwendete) API hat das Konto schon angelegt.
    await expectOk(
      await api.post('/api/users', {
        headers: auth,
        data: {
          username: 'e2e.verkauf',
          displayName: 'Test Verkauf',
          role: 'verkauf',
          password: E2E_USER_PASSWORD,
        },
      }),
      'Konto e2e.verkauf anlegen',
      [201, 409]
    )
    const sales = await login('e2e.verkauf', E2E_USER_PASSWORD)

    // Station: registrieren (Token kommt einmal), PIN des Inhabers setzen,
    // an der Station mit PIN anmelden.
    const station = await expectOk(
      await api.post('/api/auth/stations', {
        headers: auth,
        data: { name: `E2E-Station ${Date.now()}` },
      }),
      'Station registrieren',
      [201]
    )
    const stationToken = ((await station.json()) as { data: { token: string } })
      .data.token
    await expectOk(
      await api.post(`/api/users/${owner.user.id}/pin`, {
        headers: auth,
        data: { pin: E2E_PIN },
      }),
      'PIN setzen'
    )
    const pin = await expectOk(
      await api.post('/api/auth/pin', {
        headers: { 'X-Station-Token': stationToken },
        data: { userId: owner.user.id, pin: E2E_PIN },
      }),
      'PIN-Anmeldung'
    )
    const atStation = ((await pin.json()) as { data: IssuedData }).data
    if ((atStation.sessionKind ?? atStation.user.sessionKind) !== 'station') {
      throw new Error('PIN-Anmeldung lieferte keine Stations-Sitzung')
    }

    return {
      inhaber: toSession(owner),
      verkauf: toSession(sales),
      station: toSession(atStation),
    }
  })
}

/** Eine der Sitzungen aus dem Global Setup. */
export function session(name: SessionName): IssuedSession {
  const raw = process.env[SESSIONS_ENV]
  if (!raw) {
    throw new Error(
      `${SESSIONS_ENV} fehlt - läuft global-setup.ts (playwright.config.ts)?`
    )
  }
  return (JSON.parse(raw) as IssuedSessions)[name]
}

export function storeSessions(sessions: IssuedSessions): void {
  process.env[SESSIONS_ENV] = JSON.stringify(sessions)
}

/** `GET` an der API mit dem Token des Inhabers. */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const { token } = session('inhaber')
  return withApi(async (api) => {
    const response = await expectOk(
      await api.get(path, { headers: { Authorization: `Bearer ${token}` } }),
      `GET ${path}`
    )
    return (await response.json()) as T
  })
}

/**
 * Schreibender Aufruf an der API mit dem Token des Inhabers (Testdaten
 * anlegen, W4). Wirft bei einem anderen Status als `ok`.
 */
export async function apiSend<T = unknown>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  data: unknown,
  ok: number[] = [200, 201]
): Promise<T> {
  const { token } = session('inhaber')
  return withApi(async (api) => {
    const response = await expectOk(
      await api.fetch(path, {
        method,
        data,
        headers: { Authorization: `Bearer ${token}` },
      }),
      `${method} ${path}`,
      ok
    )
    return (await response.json()) as T
  })
}

/** Anzahl der Einträge, die `GET <pfad>` liefert (Liste oder `data`). */
export async function apiCount(path: string): Promise<number> {
  const body = await apiGet<unknown>(path)
  const list = Array.isArray(body) ? body : (body as { data: unknown }).data
  if (!Array.isArray(list)) throw new Error(`GET ${path}: keine Liste`)
  return list.length
}

/** Legt eine fertige Sitzung vor dem ersten `page.goto` in die Seite. */
export async function useSession(
  page: Page,
  issued: IssuedSession
): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(issued.token),
      url: BASE_URL,
    },
  ])
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [SESSION_KEY, issued.json] as const
  )
}

/** Vor dem ersten `page.goto`: die Seite startet angemeldet. */
export async function signIn(page: Page, name: SessionName = 'inhaber') {
  await useSession(page, session(name))
}
