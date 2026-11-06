/**
 * Endpunkte der Anmeldung und Benutzerverwaltung (B3-Vertrag, siehe
 * `apps/bakery-api/CLAUDE.md` „Auth (B3)“).
 *
 * Kapselt `apiClient` wie `partnerApi.ts`. Login, Refresh, PIN und Logout
 * laufen mit `retryOnUnauthorized: false`: ihre 401 heißt „falsche Daten“
 * bzw. „Sitzung vorbei“, nicht „bitte erneuern“ - sonst könnte ein Refresh
 * sich selbst auslösen. Fehler kommen als `ApiError` (Status, Code, deutsche
 * `message`) beim Aufrufer an.
 */

import { apiClient } from '@bakery/shared/data-access'
import type { PilotRole } from './roles'
import type { SessionKind } from './authSession'

export const STATION_TOKEN_HEADER = 'X-Station-Token'

const NO_RETRY = { retryOnUnauthorized: false } as const

/** `data` einer `{ success, data }`-Antwort. */
function unwrap<T>(res: { data?: T } | undefined): T {
  return res?.data as T
}

/** Antwort von login, refresh und pin. */
export interface IssuedSession {
  /** Roh, wie von der API - `normalizeUser()` macht daraus den `SessionUser`. */
  user: unknown
  token: string
  /** Fehlt beim Mock-Server an `/refresh`. */
  refreshToken?: string
  expiresIn: number
  sessionKind?: SessionKind
}

export async function login(
  username: string,
  password: string
): Promise<IssuedSession> {
  return unwrap(
    await apiClient.post<IssuedSession>(
      '/api/auth/login',
      { username, password },
      NO_RETRY
    )
  )
}

export async function refresh(refreshToken: string): Promise<IssuedSession> {
  return unwrap(
    await apiClient.post<IssuedSession>(
      '/api/auth/refresh',
      { refreshToken },
      NO_RETRY
    )
  )
}

export async function pinLogin(
  stationToken: string,
  userId: number | string,
  pin: string
): Promise<IssuedSession> {
  return unwrap(
    await apiClient.post<IssuedSession>(
      '/api/auth/pin',
      { userId, pin },
      { ...NO_RETRY, headers: { [STATION_TOKEN_HEADER]: stationToken } }
    )
  )
}

export async function fetchMe(): Promise<unknown> {
  return unwrap(await apiClient.get<unknown>('/api/auth/me'))
}

/**
 * Beendet die Sitzung dieses Geräts. Öffentlich: geht mit dem Access-Token
 * (Header) oder, wenn das schon abgelaufen ist, mit dem Refresh-Token.
 */
export async function logout(refreshToken?: string | null): Promise<void> {
  await apiClient.post(
    '/api/auth/logout',
    refreshToken ? { refreshToken } : undefined,
    NO_RETRY
  )
}

export interface StationUser {
  id: number
  displayName: string
  role: PilotRole
}

export async function fetchStationUsers(
  stationToken: string
): Promise<StationUser[]> {
  return (
    unwrap(
      await apiClient.get<StationUser[]>('/api/auth/station/users', undefined, {
        ...NO_RETRY,
        headers: { [STATION_TOKEN_HEADER]: stationToken },
      })
    ) ?? []
  )
}

export interface Station {
  id: number
  name: string
  createdBy: number | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function registerStation(
  name: string
): Promise<{ station: Station; token: string }> {
  return unwrap(
    await apiClient.post<{ station: Station; token: string }>(
      '/api/auth/stations',
      { name }
    )
  )
}

export async function fetchStations(): Promise<Station[]> {
  return unwrap(await apiClient.get<Station[]>('/api/auth/stations')) ?? []
}

export async function revokeStation(id: number): Promise<Station> {
  return unwrap(await apiClient.delete<Station>(`/api/auth/stations/${id}`))
}

/** `AdminUser` der API: nie ein Hash, nur `hasPin`. */
export interface AdminUser {
  id: number
  username: string
  displayName: string
  role: PilotRole
  active: boolean
  hasPin: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  username: string
  displayName: string
  role: PilotRole
  password: string
  pin?: string
}

export async function fetchUsers(): Promise<AdminUser[]> {
  return unwrap(await apiClient.get<AdminUser[]>('/api/users')) ?? []
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const body: Record<string, unknown> = { ...input }
  if (!input.pin) delete body['pin']
  return unwrap(await apiClient.post<AdminUser>('/api/users', body))
}

export async function updateUser(
  id: number,
  changes: Partial<Pick<AdminUser, 'displayName' | 'role' | 'active'>>
): Promise<AdminUser> {
  return unwrap(await apiClient.patch<AdminUser>(`/api/users/${id}`, changes))
}

export async function setUserPassword(
  id: number,
  password: string
): Promise<AdminUser> {
  return unwrap(
    await apiClient.post<AdminUser>(`/api/users/${id}/password`, { password })
  )
}

/** `pin: null` entfernt die PIN (der Benutzer verschwindet von den Stationen). */
export async function setUserPin(
  id: number,
  pin: string | null
): Promise<AdminUser> {
  return unwrap(
    await apiClient.post<AdminUser>(`/api/users/${id}/pin`, { pin })
  )
}
