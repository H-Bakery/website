/**
 * Sitzungs-Cookie der Management-App (F1, serverseitige Wache).
 *
 * Die Sitzung selbst liegt in `localStorage` (authSession.ts). Der Server
 * sieht `localStorage` nicht - Server-Komponenten wie das Berichtsarchiv,
 * ein Kassentag oder die Kassen-Kachel des Dashboards würden ihre Daten sonst
 * jedem ausliefern, der die URL aufruft. Deshalb spiegelt der Browser das
 * aktuelle **Access-Token** zusätzlich in dieses Cookie; `src/proxy.ts` prüft
 * es an der API (`GET /api/auth/me`) und lässt `/admin/**` und `/backstube/**`
 * nur mit gültiger Sitzung und passender Rolle rendern.
 *
 * Das Cookie setzt JavaScript, es ist also nicht `HttpOnly` - es trägt aber
 * genau das Token, das ohnehin in `localStorage` steht, ist damit nicht
 * schwächer geschützt als dieses. Die API nimmt Cookies nicht an (nur
 * `Authorization: Bearer`), ein Cookie allein öffnet dort also nichts (kein
 * CSRF-Weg); es entscheidet nur, ob der Next-Server eine Seite rendert.
 */

export const SESSION_COOKIE_NAME = 'bakery-management-at'

/**
 * Vom Proxy gesetzt, nachdem er das Cookie an der API geprüft hat. Eingehende
 * Header dieses Namens löscht der Proxy immer - ein Browser kann sie nicht
 * vortäuschen.
 */
export const ROLE_HEADER = 'x-bakery-role'
export const SESSION_KIND_HEADER = 'x-bakery-session-kind'

/** So lange wie der Refresh-Token der API (14 Tage); das Token darin lebt 1 h. */
const COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60

function secureFlag(): string {
  try {
    return window.location.protocol === 'https:' ? '; Secure' : ''
  } catch {
    return ''
  }
}

/** Setzt (Token) oder löscht (`null`) das Sitzungs-Cookie. Nur im Browser. */
export function writeSessionCookie(token: string | null): void {
  if (typeof document === 'undefined') return
  try {
    document.cookie = token
      ? `${SESSION_COOKIE_NAME}=${encodeURIComponent(
          token
        )}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag()}`
      : `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag()}`
  } catch {
    // Cookies blockiert: Seiten mit Serverdaten bleiben dann beim Ladezustand.
  }
}

/** Das gespiegelte Token aus `document.cookie` (Tests, Fehlersuche). */
export function readSessionCookie(): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${SESSION_COOKIE_NAME}=`
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!entry) return null
  const value = decodeURIComponent(entry.slice(prefix.length))
  return value || null
}

/**
 * Ziel der Umschreibung durch `src/proxy.ts`, wenn der Server eine geschützte
 * Seite nicht rendern darf (kein/abgelaufenes Cookie, falsche Rolle). Die
 * Ersatzseite trägt keine Daten; im Browser erneuert sie das Token und lädt
 * die Original-URL neu (`SessionCheckPending`).
 */
export const SESSION_CHECK_PATH = '/admin/sitzung-pruefen'
