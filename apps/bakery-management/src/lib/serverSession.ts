/**
 * Serverseitige Prüfung des Sitzungs-Cookies (F1) - die Logik hinter
 * `src/proxy.ts`, ohne Next-Abhängigkeit, damit sie testbar bleibt.
 *
 * Der Next-Server entscheidet nicht selbst, ob ein Token gilt: er fragt die
 * API (`GET {API_URL}/api/auth/me`), die Signatur, Ablauf, Widerruf der
 * Sitzung und aktive Benutzer prüft (B3). So wirkt ein Abmelden oder ein
 * gesperrtes Konto auch hier, und der Next-Server braucht kein `JWT_SECRET`.
 *
 * - Ergebnisse werden kurz zwischengespeichert (`CACHE_TTL_MS`), damit nicht
 *   jede Navigation und jeder Prefetch die API fragt. Ein widerrufenes Token
 *   rendert also höchstens so lange weiter Seiten; die API selbst lehnt es
 *   sofort ab.
 * - Ein Token, dessen `exp` (unsigniert gelesen) vorbei ist, wird gar nicht
 *   erst gefragt.
 * - Ist die API nicht erreichbar, gilt das Token als ungültig (fail closed):
 *   die Seite zeigt dann den Ladezustand statt Serverdaten.
 */

import {
  isPathAllowedForRole,
  isProtectedPath,
  normalizeRole,
  type AccessSessionKind,
  type PilotRole,
} from './roles'

export interface ServerPrincipal {
  role: PilotRole
  sessionKind: AccessSessionKind
}

export type SessionVerifier = (
  token: string | null | undefined
) => Promise<ServerPrincipal | null>

export const CACHE_TTL_MS = 30 * 1000
/** Negative Antworten kürzer, damit ein frisch erneuertes Token sofort gilt. */
export const NEGATIVE_CACHE_TTL_MS = 5 * 1000
export const CACHE_MAX_ENTRIES = 500
export const VERIFY_TIMEOUT_MS = 3000

/** `exp` (Sekunden) aus dem JWT-Payload, ohne Signaturprüfung; sonst `null`. */
export function readTokenExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8')
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

/** Rolle und Sitzungsart aus der `/api/auth/me`-Antwort (echte API oder Mock). */
export function principalFromMe(body: unknown): ServerPrincipal | null {
  const data =
    body && typeof body === 'object' && 'data' in body
      ? (body as { data: unknown }).data
      : body
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  const role = normalizeRole(value['role'])
  if (!role) return null
  return {
    role,
    sessionKind: value['sessionKind'] === 'station' ? 'station' : 'personal',
  }
}

export interface VerifierOptions {
  apiUrl: string
  fetchImpl?: typeof fetch
  now?: () => number
  timeoutMs?: number
}

/** Ein Prüfer mit eigenem Zwischenspeicher (je Server-Prozess einer). */
export function createSessionVerifier(
  options: VerifierOptions
): SessionVerifier {
  // Spät auflösen: so greift ein später gesetztes globales `fetch` (Tests).
  const fetchImpl: typeof fetch =
    options.fetchImpl ?? ((input, init) => fetch(input, init))
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? VERIFY_TIMEOUT_MS
  const base = options.apiUrl.replace(/\/+$/, '')
  const cache = new Map<
    string,
    { principal: ServerPrincipal | null; until: number }
  >()

  function remember(token: string, principal: ServerPrincipal | null) {
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(token, {
      principal,
      until: now() + (principal ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
    })
  }

  return async (token) => {
    if (!token) return null
    const exp = readTokenExpiry(token)
    if (exp !== null && exp * 1000 <= now()) return null

    const hit = cache.get(token)
    if (hit && hit.until > now()) return hit.principal
    if (hit) cache.delete(token)

    let principal: ServerPrincipal | null = null
    try {
      const response = await fetchImpl(`${base}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.ok) principal = principalFromMe(await response.json())
      // 401/403: ungültig -> merken. 5xx: nicht merken, nächstes Mal neu fragen.
      if (response.ok || response.status < 500) remember(token, principal)
    } catch {
      // API weg oder Zeitüberschreitung: fail closed, nicht merken.
      return null
    }
    return principal
  }
}

export type AccessDecision =
  | { kind: 'public' }
  | { kind: 'allow'; principal: ServerPrincipal }
  | { kind: 'deny' }

/**
 * Ob der Server `pathname` rendern darf: öffentliche Pfade immer; geschützte
 * (`/admin/**`, `/backstube/**` ohne `/admin/login`) nur mit gültigem Token
 * und einer Rolle/Sitzungsart, die `ROLE_ACCESS` die Seite erlaubt.
 */
export async function decideAccess(
  pathname: string,
  token: string | null | undefined,
  verify: SessionVerifier
): Promise<AccessDecision> {
  if (!isProtectedPath(pathname)) return { kind: 'public' }
  const principal = await verify(token)
  if (
    !principal ||
    !isPathAllowedForRole(pathname, principal.role, principal.sessionKind)
  ) {
    return { kind: 'deny' }
  }
  return { kind: 'allow', principal }
}

/**
 * Die Rolle, die der Proxy für diese Anfrage geprüft hat (Header
 * `x-bakery-role`), oder `null`. Für Server-Komponenten, die je Rolle
 * weniger laden (Dashboard: Kassen-Kachel).
 */
export function verifiedRoleFromHeader(
  value: string | null | undefined
): PilotRole | null {
  return normalizeRole(value)
}

/**
 * Ob die vom Proxy geprüfte Rolle (Header `x-bakery-role` /
 * `x-bakery-session-kind`) die Kassenzahlen sehen darf - dieselbe Regel wie
 * das Berichtsarchiv. Ohne Header: nein.
 */
export function mayLoadCashTile(
  roleHeader: string | null | undefined,
  sessionKindHeader: string | null | undefined
): boolean {
  const role = verifiedRoleFromHeader(roleHeader)
  const kind = sessionKindHeader === 'station' ? 'station' : 'personal'
  return role !== null && isPathAllowedForRole('/admin/reports', role, kind)
}
