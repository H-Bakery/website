import { apiClient } from '@bakery/shared/data-access'
import {
  LEGACY_TOKEN_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  STATION_STORAGE_KEY,
  clearSession,
  clearStation,
  currentToken,
  loadLastActivity,
  loadSession,
  loadStation,
  normalizeUser,
  restoreSession,
  safeNextPath,
  saveLastActivity,
  saveSession,
  saveStation,
  type StoredSession,
} from './authSession'
import { useMemoryStorage } from './testing/memoryStorage'
import { SESSION_COOKIE_NAME, readSessionCookie } from './sessionCookie'

const SESSION: StoredSession = {
  token: 'acc-1',
  refreshToken: 'rt_1',
  user: {
    id: 3,
    username: 'test.inhaber',
    displayName: 'Test Inhaber',
    role: 'inhaber',
  },
  sessionKind: 'personal',
  startedAt: 1_000,
}

describe('authSession', () => {
  let data: Map<string, string>

  beforeEach(() => {
    apiClient.clearAuthToken()
    data = useMemoryStorage()
  })

  it('speichert und lädt die Sitzung mit Refresh-Token und räumt den Altschlüssel weg', () => {
    data.set(LEGACY_TOKEN_STORAGE_KEY, 'alt')
    saveSession(SESSION)
    expect(loadSession()).toEqual(SESSION)
    expect(data.has(LEGACY_TOKEN_STORAGE_KEY)).toBe(false)
  })

  it('verwirft einen kaputten oder unvollständigen Eintrag', () => {
    data.set(SESSION_STORAGE_KEY, '{kein json')
    expect(loadSession()).toBeNull()
    data.set(SESSION_STORAGE_KEY, JSON.stringify({ ...SESSION, token: '' }))
    expect(loadSession()).toBeNull()
    data.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ ...SESSION, user: { ...SESSION.user, role: 'chef' } })
    )
    expect(loadSession()).toBeNull()
  })

  it('restoreSession setzt das Token auf den apiClient, clearSession nimmt es weg', () => {
    expect(restoreSession()).toBeNull()
    expect(apiClient.isAuthenticated()).toBe(false)
    saveSession(SESSION)
    expect(restoreSession()).toEqual(SESSION)
    expect(currentToken()).toBe('acc-1')
    saveLastActivity(5)
    clearSession()
    expect(loadSession()).toBeNull()
    expect(loadLastActivity()).toBeNull()
    expect(currentToken()).toBeNull()
  })

  it('spiegelt das Access-Token ins Sitzungs-Cookie für den Proxy', () => {
    clearSession()
    expect(readSessionCookie()).toBeNull()
    saveSession({ ...SESSION, token: 'acc-2' })
    expect(readSessionCookie()).toBe('acc-2')
    expect(document.cookie).toContain(`${SESSION_COOKIE_NAME}=acc-2`)
    // Alte Sitzung ohne Cookie (vor F1-Fix): restoreSession setzt es nach.
    document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0`
    expect(readSessionCookie()).toBeNull()
    restoreSession()
    expect(readSessionCookie()).toBe('acc-2')
    clearSession()
    expect(readSessionCookie()).toBeNull()
  })

  it('lässt das Stations-Token beim Abmelden stehen', () => {
    saveStation({ token: 'st_x', name: 'Laden-Tablet', id: 2 })
    saveSession(SESSION)
    clearSession()
    expect(loadStation()).toEqual({
      token: 'st_x',
      name: 'Laden-Tablet',
      id: 2,
    })
    clearStation()
    expect(loadStation()).toBeNull()
    expect(data.has(STATION_STORAGE_KEY)).toBe(false)
  })

  it('überlebt einen werfenden Speicher', () => {
    const store = window.localStorage as unknown as Record<string, jest.Mock>
    store.getItem.mockImplementation(() => {
      throw new Error('blocked')
    })
    store.setItem.mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveSession(SESSION)).not.toThrow()
    expect(loadSession()).toBeNull()
    expect(loadStation()).toBeNull()
    expect(() => clearSession()).not.toThrow()
  })

  describe('normalizeUser', () => {
    it('nimmt den Benutzer der echten API', () => {
      expect(
        normalizeUser({
          id: 7,
          username: 'test.verkauf',
          displayName: 'Test Verkauf',
          role: 'verkauf',
          active: true,
        })
      ).toEqual({
        id: 7,
        username: 'test.verkauf',
        displayName: 'Test Verkauf',
        role: 'verkauf',
      })
    })

    it('übersetzt den Mock-Benutzer (admin → inhaber, Name aus Vor-/Nachname)', () => {
      expect(
        normalizeUser({
          id: 'admin',
          email: 'admin@mock.local',
          firstName: 'Mock',
          lastName: 'Admin',
          role: 'admin',
        })
      ).toEqual({
        id: 'admin',
        username: 'admin@mock.local',
        displayName: 'Mock Admin',
        role: 'inhaber',
      })
    })

    it('lehnt unbekannte Rollen und fehlende IDs ab', () => {
      expect(normalizeUser({ id: 1, role: 'kunde' })).toBeNull()
      expect(normalizeUser({ role: 'inhaber' })).toBeNull()
      expect(normalizeUser(null)).toBeNull()
    })
  })

  it('safeNextPath lässt nur App-Pfade durch', () => {
    expect(safeNextPath('/admin/finance')).toBe('/admin/finance')
    expect(safeNextPath('/backstube')).toBe('/backstube')
    expect(safeNextPath('/station')).toBe('/station')
    expect(safeNextPath('/administrator')).toBe('/admin')
    expect(safeNextPath('//evil.example/admin')).toBe('/admin')
    expect(safeNextPath('https://evil.example')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
  })
})
