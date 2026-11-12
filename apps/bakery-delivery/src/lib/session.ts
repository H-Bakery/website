// Anmeldung der Fahrer-App (B8) gegen die echte API - der B3-Vertrag wie in
// der Management-App (`apps/bakery-management/src/lib/session.tsx`), nur das
// Nötigste davon: Benutzername + Passwort (persönliche Sitzung), Access- und
// Refresh-Token im localStorage, ein Refresh je Tab mit Rotation, 409
// `refresh_superseded` (ein anderer Tab war schneller) und Abmelden.
//
// Kein React Context: die App steht außerhalb des MUI/Context-Stacks. Der
// Zustand lebt in diesem Modul, Komponenten lesen ihn mit
// `useDeliverySession()` (useSyncExternalStore).
//
// Die Form des früheren Mock-Servers (B12 gelöscht) wird weiter gelesen, falls
// eine alte Sitzung im Speicher liegt: `email`/`firstName` statt
// `displayName`, Rolle `admin` → `inhaber`, `staff` → `verkauf`.

import { useSyncExternalStore } from 'react'

import { API_BASE_URL } from './api-base'

export type DeliveryRole =
  | 'inhaber'
  | 'verkauf'
  | 'backstube'
  | 'backstubenleiter'
  | 'fahrer'

export interface DeliveryUser {
  id: number | string
  username: string
  displayName: string
  role: DeliveryRole
}

export interface DeliverySession {
  token: string
  refreshToken: string | null
  user: DeliveryUser
}

export const SESSION_KEY = 'bakery-delivery-session'
/** Wer zuletzt angemeldet war - ein anderer Benutzer erbt keine Warteschlange. */
export const LAST_USER_KEY = 'bakery-delivery-last-user'

/** Rollen, die in der Fahrer-App etwas sehen dürfen (die API prüft selbst). */
export const APP_ROLES: readonly DeliveryRole[] = [
  'inhaber',
  'verkauf',
  'fahrer',
]

const ROLE_MAP: Record<string, DeliveryRole> = {
  inhaber: 'inhaber',
  verkauf: 'verkauf',
  backstube: 'backstube',
  backstubenleiter: 'backstubenleiter',
  fahrer: 'fahrer',
  admin: 'inhaber', // Mock
  staff: 'verkauf', // Mock
}

/** Was eine Rolle in dieser App darf - Bedienführung; durchgesetzt wird in der API. */
export function permissionsFor(role: DeliveryRole | null | undefined) {
  return {
    /** Touren anlegen, Stopps anlegen/entfernen, Planung. */
    plan: role === 'inhaber',
    /** Abhaken (Stopp, Vorbestellung), Position, „Route berechnen". */
    drive: role === 'inhaber' || role === 'fahrer',
    /** Auf den eigenen Fahrer festgelegt. */
    ownToursOnly: role === 'fahrer',
    /**
     * Eine Übergabe zurücknehmen (`abgeholt` → offen). Der Fahrer darf das
     * nicht (API: 403 `handover_undo_forbidden`) - das kann der Verkauf.
     */
    undoHandover: role === 'inhaber',
  }
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function normalizeUser(raw: unknown): DeliveryUser | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const role = ROLE_MAP[String(value['role'] ?? '')]
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

function readSession(): DeliverySession | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DeliverySession>
    const user = normalizeUser(parsed.user)
    if (typeof parsed.token !== 'string' || !parsed.token || !user) return null
    return {
      token: parsed.token,
      refreshToken:
        typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      user,
    }
  } catch {
    return null
  }
}

// --- Zustand + Abonnenten ---------------------------------------------------

let cached: DeliverySession | null | undefined
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

/** Die aktuelle Sitzung (aus dem Speicher, gecacht). */
export function currentSession(): DeliverySession | null {
  if (cached === undefined) cached = readSession()
  return cached
}

export function saveSession(session: DeliverySession | null): void {
  cached = session
  const store = storage()
  if (store) {
    try {
      if (session) store.setItem(SESSION_KEY, JSON.stringify(session))
      else store.removeItem(SESSION_KEY)
    } catch {
      // Kein Speicher - dann gilt die Sitzung nur bis zum Neuladen.
    }
  }
  emit()
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  // Ein anderer Tab meldet sich an/ab oder rotiert den Refresh-Token.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SESSION_KEY) return
    cached = readSession()
    listener()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

/**
 * `undefined` während des Server-Renderns und der Hydration (dort darf
 * localStorage nicht gelesen werden), danach Sitzung oder `null`.
 */
export function useDeliverySession(): DeliverySession | null | undefined {
  return useSyncExternalStore(subscribeSession, currentSession, () => undefined)
}

/** Für Tests: den Modul-Cache vergessen (der Speicher bleibt). */
export function resetSessionCache(): void {
  cached = undefined
}

// --- Anfragen ----------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

const AUTH_TIMEOUT_MS = 15_000

async function postAuth(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const signal =
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(AUTH_TIMEOUT_MS)
      : undefined
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  if (!response.ok) {
    throw new AuthError(
      String(data['message'] || data['error'] || `Fehler ${response.status}`),
      response.status,
      typeof data['error'] === 'string' ? data['error'] : undefined
    )
  }
  return data
}

function issued(
  data: Record<string, unknown>,
  previous: DeliverySession | null
): DeliverySession {
  const payload = (data['data'] ?? {}) as Record<string, unknown>
  const user = normalizeUser(payload['user']) ?? previous?.user ?? null
  const token = typeof payload['token'] === 'string' ? payload['token'] : ''
  if (!token || !user) {
    throw new AuthError(
      'Die Anmeldung wurde vom Server nicht vollständig bestätigt.',
      500
    )
  }
  return {
    token,
    // Der Mock rotiert nicht und schickt beim Refresh keinen neuen.
    refreshToken:
      typeof payload['refreshToken'] === 'string'
        ? payload['refreshToken']
        : previous?.refreshToken ?? null,
    user,
  }
}

/**
 * Anmelden mit Benutzername und Passwort. Rollen ohne Platz in der
 * Fahrer-App (Backstube) bekommen eine verständliche Absage, und ihre eben
 * entstandene Sitzung wird gleich wieder beendet.
 */
export async function login(
  username: string,
  password: string,
  /** Läuft vor dem Speichern - etwa um Daten eines anderen Benutzers zu löschen. */
  prepare?: (session: DeliverySession) => void
): Promise<DeliverySession> {
  const data = await postAuth('/api/auth/login', { username, password })
  const session = issued(data, null)
  if (!APP_ROLES.includes(session.user.role)) {
    void postAuth(
      '/api/auth/logout',
      { refreshToken: session.refreshToken },
      { Authorization: `Bearer ${session.token}` }
    ).catch(() => undefined)
    throw new AuthError(
      'Dieses Konto hat in der Fahrer-App nichts zu tun. Bitte die Verwaltung benutzen.',
      403,
      'forbidden'
    )
  }
  prepare?.(session)
  saveSession(session)
  return session
}

export type RefreshOutcome =
  | { ok: true; session: DeliverySession }
  | { ok: false; ended: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function doRefresh(): Promise<RefreshOutcome> {
  const stored = readSession()
  if (!stored?.refreshToken) {
    saveSession(null)
    return { ok: false, ended: true }
  }
  try {
    const data = await postAuth('/api/auth/refresh', {
      refreshToken: stored.refreshToken,
    })
    const next = issued(data, stored)
    // Der rotierte Token muss sofort in den Speicher - ein zweiter Tab liest
    // ihn dort, und der alte gilt nur noch 10 s.
    saveSession(next)
    return { ok: true, session: next }
  } catch (error) {
    const status = error instanceof AuthError ? error.status : undefined
    if (status === 409) {
      // Ein anderer Tab hat eben erneuert: dessen Token übernehmen, sobald
      // er im Speicher steht.
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(300)
        const again = readSession()
        if (again && again.refreshToken !== stored.refreshToken) {
          cached = again
          emit()
          return { ok: true, session: again }
        }
      }
      return { ok: false, ended: false }
    }
    if (status !== undefined && status >= 400 && status < 500) {
      saveSession(null)
      return { ok: false, ended: true }
    }
    // Funkloch oder Server weg: die Sitzung bleibt, nur die Anfrage scheitert.
    return { ok: false, ended: false }
  }
}

let inflightRefresh: Promise<RefreshOutcome> | null = null

/** Ein Refresh je Tab, egal wie viele Anfragen gleichzeitig 401 bekommen. */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!inflightRefresh) {
    inflightRefresh = doRefresh().finally(() => {
      inflightRefresh = null
    })
  }
  return inflightRefresh
}

/**
 * Abmelden: die Sitzung endet auf dem Server (Bearer, sonst Refresh-Token -
 * auch mit abgelaufenem Access-Token) und im Speicher. Ohne Netz endet sie
 * nur hier; der Server lässt das Access-Token nach spätestens einer Stunde
 * verfallen.
 */
export async function logout(): Promise<void> {
  const session = currentSession()
  saveSession(null)
  if (!session) return
  try {
    await postAuth(
      '/api/auth/logout',
      { refreshToken: session.refreshToken },
      { Authorization: `Bearer ${session.token}` }
    )
  } catch {
    // Server nicht erreichbar - lokal ist die Sitzung trotzdem weg.
  }
}

/** Wer zuletzt angemeldet war (`String(id)`), oder `null`. */
export function lastUser(): string | null {
  try {
    return storage()?.getItem(LAST_USER_KEY) ?? null
  } catch {
    return null
  }
}

export function rememberLastUser(id: number | string): void {
  try {
    storage()?.setItem(LAST_USER_KEY, String(id))
  } catch {
    // egal
  }
}
