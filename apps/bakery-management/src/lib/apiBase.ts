/**
 * Wohin die Management-App ihre API-Anfragen schickt (F4).
 *
 * - **Browser:** an die eigene Origin (`/api/...`). Auf der Box leitet Caddy
 *   `/api/*` direkt an die API, in Entwicklung und E2E leitet `src/proxy.ts`
 *   weiter. Kein CORS, und die App funktioniert unter jedem Hostnamen (LAN,
 *   Tailscale). `NEXT_PUBLIC_API_URL` überschreibt das nur, wenn es gesetzt
 *   ist - beim Build eingebacken, also nur für Sonderfälle.
 * - **Server (Next):** `API_URL`, zur Laufzeit gelesen - Ziel des
 *   `/api`-Proxys und der Sitzungsprüfung in `src/proxy.ts`.
 */

/** Vorgabe für `API_URL`, wenn nichts gesetzt ist (lokale API). */
export const DEFAULT_SERVER_API_URL = 'http://localhost:5000'

function trimBase(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

/**
 * Basis-URL des `ApiClient` im Browser: `''` (gleiche Origin), außer
 * `NEXT_PUBLIC_API_URL` ist gesetzt. Der Standardwert muss
 * `process.env.NEXT_PUBLIC_API_URL` wörtlich lesen, sonst setzt Next ihn
 * beim Build nicht ein.
 */
export function resolveBrowserApiBase(
  value: string | undefined = process.env.NEXT_PUBLIC_API_URL
): string {
  return trimBase(value)
}

/** Ziel der API auf dem Server (`API_URL`, Laufzeit). */
export function resolveServerApiUrl(
  value: string | undefined = process.env.API_URL
): string {
  return trimBase(value) || DEFAULT_SERVER_API_URL
}

/** Ob `pathname` zur API gehört (`/api` oder `/api/...`). */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

/**
 * Absolute Ziel-URL für einen `/api`-Aufruf an die App, oder `null`, wenn der
 * Pfad nicht zur API gehört. Query bleibt erhalten.
 */
export function apiProxyTarget(
  pathname: string,
  search: string,
  apiUrl: string = resolveServerApiUrl()
): string | null {
  if (!isApiPath(pathname)) return null
  return `${trimBase(apiUrl)}${pathname}${search || ''}`
}
