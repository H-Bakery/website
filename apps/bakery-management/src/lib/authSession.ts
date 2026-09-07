/**
 * Hält die Anmeldung über einen Seitenwechsel hinweg.
 *
 * Der `ApiClient` merkt sich das Token nur im Speicher, und der `AuthProvider`
 * legt selbst nichts ab - nach jedem Neuladen wäre man abgemeldet. Diese zwei
 * Funktionen schließen die Lücke: `persistSession()` schreibt das gerade
 * gesetzte Token nach `localStorage`, `restoreSession()` setzt es beim Start
 * wieder auf den `apiClient`, **bevor** der `AuthProvider` seine Prüfung
 * (`GET /api/auth/me`) startet. Ein abgelaufenes Token fällt dort durch, der
 * Provider räumt es weg, und die Finanzseite zeigt den Link zur Anmeldung.
 *
 * `localStorage` kann fehlen oder werfen (SSR, private Fenster, blockierte
 * Site-Daten) - jede Zugriff ist deshalb abgesichert.
 */

import { apiClient } from '@bakery/shared/data-access'

export const AUTH_TOKEN_STORAGE_KEY = 'bakery-management-auth-token'

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Das aktuell auf dem `apiClient` gesetzte Token, ohne `Bearer `-Präfix. */
export function currentToken(): string | null {
  const header = apiClient.getAuthHeader()['Authorization']
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1] : null
}

/** Merkt sich das Token des `apiClient`; ohne Token wird der Eintrag gelöscht. */
export function persistSession(): void {
  const store = storage()
  if (!store) return
  try {
    const token = currentToken()
    if (token) store.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    else store.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // Speicher nicht verfügbar - die Sitzung gilt dann nur für diese Seite.
  }
}

export function clearSession(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // siehe oben
  }
}

/**
 * Setzt ein gespeichertes Token wieder auf den `apiClient`. Liefert `true`,
 * wenn eines da war - ob es noch gilt, entscheidet erst `GET /api/auth/me`.
 */
export function restoreSession(): boolean {
  const store = storage()
  if (!store) return false
  try {
    const token = store.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (!token) return false
    apiClient.setAuthToken(token)
    return true
  } catch {
    return false
  }
}

/**
 * Ziel nach der Anmeldung (`?next=`): nur Pfade innerhalb der App. Ein
 * fremder Host oder ein protokollrelativer Pfad (`//…`) fällt auf `/admin`.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (value && value.startsWith('/admin') && !value.startsWith('//')) {
    return value
  }
  return '/admin'
}
