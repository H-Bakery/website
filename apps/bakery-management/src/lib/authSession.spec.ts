import { apiClient } from '@bakery/shared/data-access'
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearSession,
  currentToken,
  persistSession,
  restoreSession,
  safeNextPath,
} from './authSession'

// `test-setup.ts` ersetzt localStorage durch jest.fn()-Attrappen.
const store = window.localStorage as unknown as {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}

describe('authSession', () => {
  beforeEach(() => {
    apiClient.clearAuthToken()
    store.getItem.mockReset()
    store.setItem.mockReset()
    store.removeItem.mockReset()
  })

  it('liest das Token aus dem Bearer-Header', () => {
    expect(currentToken()).toBeNull()
    apiClient.setAuthToken('abc.def.ghi')
    expect(currentToken()).toBe('abc.def.ghi')
  })

  it('persistSession speichert das Token bzw. löscht den Eintrag', () => {
    persistSession()
    expect(store.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_STORAGE_KEY)
    apiClient.setAuthToken('tok')
    persistSession()
    expect(store.setItem).toHaveBeenCalledWith(AUTH_TOKEN_STORAGE_KEY, 'tok')
  })

  it('restoreSession setzt ein gespeichertes Token auf den apiClient', () => {
    store.getItem.mockReturnValue(null)
    expect(restoreSession()).toBe(false)
    expect(apiClient.isAuthenticated()).toBe(false)

    store.getItem.mockReturnValue('gespeichert')
    expect(restoreSession()).toBe(true)
    expect(currentToken()).toBe('gespeichert')
  })

  it('clearSession entfernt den Eintrag', () => {
    clearSession()
    expect(store.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_STORAGE_KEY)
  })

  it('überlebt einen werfenden Speicher', () => {
    store.getItem.mockImplementation(() => {
      throw new Error('blocked')
    })
    store.setItem.mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(restoreSession()).toBe(false)
    apiClient.setAuthToken('tok')
    expect(() => persistSession()).not.toThrow()
  })

  it('safeNextPath lässt nur Pfade innerhalb der App durch', () => {
    expect(safeNextPath('/admin/finance')).toBe('/admin/finance')
    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
    expect(safeNextPath('')).toBe('/admin')
    expect(safeNextPath('https://boese.example/admin')).toBe('/admin')
    expect(safeNextPath('//boese.example/admin')).toBe('/admin')
    expect(safeNextPath('/shop')).toBe('/admin')
  })
})
