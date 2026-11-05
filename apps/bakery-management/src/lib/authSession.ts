/**
 * Hält die Anmeldung über Neuladen und Tabs hinweg (F1).
 *
 * Die Sitzung liegt in `localStorage`, weil Access- und Refresh-Token sonst
 * mit jedem Neuladen verloren gingen (der `ApiClient` hält das Token nur im
 * Speicher). Gespeichert werden:
 *
 * - `bakery-management-session`: Access-Token, Refresh-Token, Benutzer,
 *   Sitzungsart (`personal` | `station`) und Anmeldezeit,
 * - `bakery-management-activity`: letzte Bedienung (Leerlauf-Abmeldung, von
 *   allen Tabs gemeinsam geschrieben),
 * - `bakery-management-station`: Stations-Token dieses Geräts (bleibt beim
 *   Abmelden erhalten - das Gerät bleibt Station).
 *
 * Zusätzlich spiegeln `saveSession`/`restoreSession`/`clearSession` das
 * Access-Token in das Cookie aus `sessionCookie.ts`, damit `src/proxy.ts`
 * serverseitig prüfen kann, ob eine Seite überhaupt rendern darf.
 *
 * Der Refresh-Token muss gespeichert werden: die echte API nimmt an
 * `/api/auth/refresh` kein Access-Token an und rotiert den Refresh-Token bei
 * jedem Aufruf (B3).
 *
 * `localStorage` kann fehlen oder werfen (SSR, private Fenster, blockierte
 * Site-Daten) - jeder Zugriff ist deshalb abgesichert.
 */

import { apiClient } from '@bakery/shared/data-access'
import { normalizeRole, type PilotRole } from './roles'
import { writeSessionCookie } from './sessionCookie'

export const SESSION_STORAGE_KEY = 'bakery-management-session'
export const ACTIVITY_STORAGE_KEY = 'bakery-management-activity'
export const STATION_STORAGE_KEY = 'bakery-management-station'
/** Altschlüssel (Mock-Login vor F1): nur noch zum Aufräumen. */
export const LEGACY_TOKEN_STORAGE_KEY = 'bakery-management-auth-token'

export type SessionKind = 'personal' | 'station'

/** Der angemeldete Benutzer, wie ihn die App braucht. */
export interface SessionUser {
  id: number | string
  username: string
  displayName: string
  role: PilotRole
}

export interface StoredSession {
  token: string
  /** Fehlt nur beim Mock-Server, der keinen Refresh-Token rotiert. */
  refreshToken: string | null
  user: SessionUser
  sessionKind: SessionKind
  /** Anmeldezeit (ms) - Stationen enden 12 h danach. */
  startedAt: number
}

export interface StoredStation {
  token: string
  name: string
  id?: number
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function readJson<T>(key: string): T | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  const store = storage()
  if (!store) return
  try {
    if (value === null) store.removeItem(key)
    else store.setItem(key, value)
  } catch {
    // Speicher nicht verfügbar - die Sitzung gilt dann nur für diese Seite.
  }
}

/**
 * Benutzer aus einer API-Antwort: echte API `{ id, username, displayName,
 * role }`, Mock `{ id, email, firstName, lastName, role: 'admin' }`.
 * `null`, wenn die Rolle unbekannt ist.
 */
export function normalizeUser(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const role = normalizeRole(value['role'])
  if (!role || value['id'] === undefined || value['id'] === null) return null
  const str = (key: string) =>
    typeof value[key] === 'string' ? (value[key] as string).trim() : ''
  const username = str('username') || str('email')
  const fullName = [str('firstName'), str('lastName')].filter(Boolean).join(' ')
  return {
    id: value['id'] as number | string,
    username,
    displayName: str('displayName') || fullName || username,
    role,
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<StoredSession>
  return (
    typeof v.token === 'string' &&
    v.token.length > 0 &&
    (v.sessionKind === 'personal' || v.sessionKind === 'station') &&
    typeof v.startedAt === 'number' &&
    normalizeUser(v.user) !== null
  )
}

/** Die gespeicherte Sitzung oder `null` (auch bei kaputtem Eintrag). */
export function loadSession(): StoredSession | null {
  const value = readJson<unknown>(SESSION_STORAGE_KEY)
  return isStoredSession(value) ? value : null
}

export function saveSession(session: StoredSession): void {
  write(SESSION_STORAGE_KEY, JSON.stringify(session))
  write(LEGACY_TOKEN_STORAGE_KEY, null)
  writeSessionCookie(session.token)
}

/** Vergisst die Sitzung (nicht die Station) und nimmt das Token vom `apiClient`. */
export function clearSession(): void {
  write(SESSION_STORAGE_KEY, null)
  write(ACTIVITY_STORAGE_KEY, null)
  write(LEGACY_TOKEN_STORAGE_KEY, null)
  writeSessionCookie(null)
  apiClient.clearAuthToken()
}

/**
 * Setzt das Token einer gespeicherten Sitzung auf den `apiClient`. Ob es noch
 * gilt, entscheidet erst `GET /api/auth/me` (mit einem Refresh bei 401).
 */
export function restoreSession(): StoredSession | null {
  const session = loadSession()
  if (session) {
    apiClient.setAuthToken(session.token)
    writeSessionCookie(session.token)
  }
  return session
}

/** Das aktuell auf dem `apiClient` gesetzte Token, ohne `Bearer `-Präfix. */
export function currentToken(): string | null {
  const header = apiClient.getAuthHeader()['Authorization']
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1] : null
}

/** Letzte Bedienung (ms); `null`, wenn nie gespeichert. */
export function loadLastActivity(): number | null {
  const value = readJson<unknown>(ACTIVITY_STORAGE_KEY)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function saveLastActivity(at: number): void {
  write(ACTIVITY_STORAGE_KEY, JSON.stringify(at))
}

export function loadStation(): StoredStation | null {
  const value = readJson<Partial<StoredStation>>(STATION_STORAGE_KEY)
  if (!value || typeof value.token !== 'string' || !value.token) return null
  return {
    token: value.token,
    name: typeof value.name === 'string' ? value.name : 'Station',
    ...(typeof value.id === 'number' ? { id: value.id } : {}),
  }
}

export function saveStation(station: StoredStation): void {
  write(STATION_STORAGE_KEY, JSON.stringify(station))
}

export function clearStation(): void {
  write(STATION_STORAGE_KEY, null)
}

/**
 * Ziel nach der Anmeldung (`?next=`): nur Pfade innerhalb der App
 * (`/admin…`, `/backstube…`, `/station`). Ein fremder Host oder ein
 * protokollrelativer Pfad (`//…`) fällt auf `/admin`.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (
    value &&
    !value.startsWith('//') &&
    /^\/(admin|backstube|station)(\/|\?|#|$)/.test(value)
  ) {
    return value
  }
  return '/admin'
}
